import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Provisiona onboarding_progress pras sub-contas GHL criadas < 30 dias, com o plano vindo do
// SaaS plan (priceId) da API do GHL. Pedro 2026-06-23. Idempotente: so INSERE quem nao tem row.
// Endurecido pos-auditoria 2026-06-23 (detail-fail buckets, paralelizacao, plan-update, observabilidade).
//
// Deploy: projeto GHL Token (tbziahcpkrfiksqhuhpe), verify_jwt=false (gate por header x-onb-secret OU ?k=).
// Cron: pg_cron 'onboarding-provision-daily' (0 8 * * * UTC) via pg_net.http_post (header + timeout 120s).
// Token GHL: tabela "Token Refresher" (sensivel) — lido SO server-side com service role.
// Auth via header (x-onb-secret) pra nao vazar em log de URL; ?k= mantido pra teste manual.

const SECRET = "spk_onb_prov_kQ7vR2mX9pL4nT8w";
const PLAN_BY_PRICE: Record<string, string> = {
  "6a0cbc6f9f3f184b2c6ba66a": "growth",
  "6a0cbb5dd9543ee3671cb432": "starter",
  "6a0cbce993431a096dbde01e": "agency",
};
// Stripe legado: contas que o Pedro mandou IGNORAR (nao provisionar). Distinto de "plano desconhecido".
const LEGACY_PRICE_IDS = new Set(["price_1PGxDVBWo9pIJAZW8hDHu8PD"]);
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DETAIL_CONCURRENCY = 8;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function jsonOrNull(r: Response): Promise<any> { try { return await r.json(); } catch { return null; } }

// Le o priceId da conta via /locations/{id}. Distingue OK-sem-saas de FALHA-de-leitura (retentavel).
async function fetchDetail(id: string, G: Record<string, string>): Promise<{ ok: boolean; status: number; hasSaas: boolean; priceId?: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const dr = await fetch(`https://services.leadconnectorhq.com/locations/${id}`, { headers: G });
      if (dr.status === 200) {
        const loc = (await jsonOrNull(dr))?.location || {};
        const ss = loc?.settings?.saasSettings;
        return { ok: true, status: 200, hasSaas: !!ss, priceId: ss?.planDetails?.priceId };
      }
      if (dr.status === 429 || dr.status >= 500) { await sleep(400 * (attempt + 1)); continue; } // retentavel
      return { ok: false, status: dr.status, hasSaas: false }; // 401/403/404 = nao retenta
    } catch (_e) { await sleep(400 * (attempt + 1)); }
  }
  return { ok: false, status: 0, hasSaas: false };
}

Deno.serve(async (req: Request) => {
  const u = new URL(req.url);
  const provided = req.headers.get("x-onb-secret") || u.searchParams.get("k");
  if (provided !== SECRET) return new Response("unauthorized", { status: 401 });
  const dry = u.searchParams.get("dry") === "1";

  const SUPA = Deno.env.get("SUPABASE_URL")!;
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sh = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

  // token GHL (fail-closed: sem token nao da pra fazer nada)
  let token: string | undefined, companyId: string | undefined;
  try {
    const tr = await fetch(`${SUPA}/rest/v1/Token%20Refresher?select=access_token,companyId&limit=1`, { headers: sh });
    const tok = (await jsonOrNull(tr))?.[0];
    token = tok?.access_token; companyId = tok?.companyId;
  } catch (_e) { /* cai no guard abaixo */ }
  if (!token) return new Response(JSON.stringify({ error: "no token" }), { status: 500, headers: { "Content-Type": "application/json" } });
  const G: Record<string, string> = { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" };

  // rows existentes (fail-CLOSED: sem a lista, abortar — re-INSERT duplicado seria pior)
  const existing = new Map<string, any>();
  try {
    const exRes = await fetch(`${SUPA}/rest/v1/onboarding_progress?select=location_id,plan,account_created_at`, { headers: sh });
    const rows = await jsonOrNull(exRes);
    if (!Array.isArray(rows)) throw new Error("existing rows nao e array");
    rows.forEach((r: any) => existing.set(r.location_id, r));
  } catch (e) {
    return new Response(JSON.stringify({ error: "existing fetch failed", msg: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // lista locations (paginado, com sinal de truncamento e erro de pagina)
  let all: any[] = [], skip = 0, truncated = false, pageError: any = null;
  for (let p = 0; p < 8; p++) {
    let locs: any[] = [];
    try {
      const r = await fetch(`https://services.leadconnectorhq.com/locations/search?companyId=${companyId}&limit=100&skip=${skip}`, { headers: G });
      if (r.status !== 200) { pageError = { page: p, status: r.status }; break; }
      locs = (await jsonOrNull(r))?.locations || [];
    } catch (e) { pageError = { page: p, msg: String(e) }; break; }
    all = all.concat(locs);
    if (locs.length < 100) break;
    skip += 100;
    if (p === 7 && locs.length === 100) truncated = true; // saiu no cap com pagina cheia
  }

  const now = Date.now();
  const recent = all.filter((l) => l.dateAdded && (now - new Date(l.dateAdded).getTime()) < MAX_AGE_MS);

  const created: any[] = [], backfilled: string[] = [], planUpdated: any[] = [];
  const skippedNoSaas: string[] = [], skippedLegacy: string[] = [], unmappedPlan: any[] = [], detailErrors: any[] = [], insertErrors: any[] = [];
  let skippedExisting = 0, insertRace = 0;

  for (let i = 0; i < recent.length; i += DETAIL_CONCURRENCY) {
    await Promise.all(recent.slice(i, i + DETAIL_CONCURRENCY).map(async (l) => {
      const ex = existing.get(l.id);
      const d = await fetchDetail(l.id, G);
      const plan = d.ok && d.priceId ? PLAN_BY_PRICE[d.priceId] : undefined;

      if (ex) {
        if (!ex.account_created_at) {
          if (!dry) await fetch(`${SUPA}/rest/v1/onboarding_progress?location_id=eq.${l.id}`, { method: "PATCH", headers: { ...sh, Prefer: "return=minimal" }, body: JSON.stringify({ account_created_at: l.dateAdded }) });
          backfilled.push(l.name);
        } else skippedExisting++;
        // plan-update no upgrade: SO quando o detail veio OK e o plano mapeado difere (nao rebaixa em falha)
        if (d.ok && plan && ex.plan && plan !== ex.plan) {
          if (!dry) await fetch(`${SUPA}/rest/v1/onboarding_progress?location_id=eq.${l.id}`, { method: "PATCH", headers: { ...sh, Prefer: "return=minimal" }, body: JSON.stringify({ plan }) });
          planUpdated.push({ name: l.name, from: ex.plan, to: plan });
        }
        return;
      }

      // sem row: classifica (falha de leitura NUNCA vira "no-saas" — fica visivel + cron re-tenta amanha)
      if (!d.ok) { detailErrors.push({ name: l.name, status: d.status }); return; }
      if (!d.hasSaas || !d.priceId) { skippedNoSaas.push(l.name); return; }
      if (LEGACY_PRICE_IDS.has(d.priceId)) { skippedLegacy.push(l.name); return; }
      if (!plan) { unmappedPlan.push({ name: l.name, priceId: d.priceId }); return; } // ALERTA: pagando plano nao mapeado

      if (dry) { created.push({ name: l.name, plan }); return; }
      const r = await fetch(`${SUPA}/rest/v1/onboarding_progress?on_conflict=location_id`, { method: "POST", headers: { ...sh, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ location_id: l.id, plan, lang: "pt", account_created_at: l.dateAdded }) });
      if (r.status === 409) insertRace++;
      else if (r.ok) created.push({ name: l.name, plan });
      else insertErrors.push({ name: l.name, status: r.status });
    }));
  }

  const summary = {
    dry, total: all.length, recent: recent.length,
    created_count: created.length, created,
    backfilled_count: backfilled.length, plan_updated: planUpdated,
    skipped_existing: skippedExisting, skipped_no_saas_count: skippedNoSaas.length, skipped_legacy_count: skippedLegacy.length,
    unmapped_plan: unmappedPlan, detail_errors: detailErrors, insert_errors: insertErrors, insert_race: insertRace,
    truncated, page_error: pageError,
  };

  // observabilidade: 1 row por run (best-effort; nao falha o run se a tabela faltar)
  if (!dry) {
    try {
      await fetch(`${SUPA}/rest/v1/onboarding_provision_runs`, { method: "POST", headers: { ...sh, Prefer: "return=minimal" }, body: JSON.stringify({ total: all.length, recent: recent.length, created: created.length, backfilled: backfilled.length, detail_errors: detailErrors.length, unmapped: unmappedPlan.length, truncated, summary }) });
    } catch (_e) { /* best-effort */ }
  }

  return new Response(JSON.stringify(summary, null, 2), { headers: { "Content-Type": "application/json" } });
});
