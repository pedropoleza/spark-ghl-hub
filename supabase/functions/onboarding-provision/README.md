# onboarding-provision

Provisiona as rows de `onboarding_progress` que ligam o **widget de onboarding** pras sub-contas
novas do Spark Leads (white-label GoHighLevel). Pedro 2026-06-23.

## O que faz

1. Lista todas as sub-contas via API GHL (`/locations/search`, paginado).
2. Filtra as criadas **< 30 dias** (campo `dateAdded`).
3. Pra cada uma, lê o plano SaaS via `/locations/{id}` -> `settings.saasSettings.planDetails.priceId`.
4. Mapeia `priceId` -> plano e **INSERE** uma row em `onboarding_progress` (se ainda não existir).

Idempotente: só insere quem não tem row. Em rows existentes sem `account_created_at`, faz backfill da data.
Quem não tem SaaS ativo (templates/masters) ou tem `priceId` não-mapeado (Stripe legado) é **pulado** (sem row).

A regra de **mostrar/esconder** o widget é client-side (em `dist/spark-onboarding.js`, `boot()`): conta
> 30 dias esconde; sem row esconde; `completed_at` esconde. Esta função só **cria as rows** das < 30 dias.

## Mapa priceId -> plano

| priceId | plano |
|---|---|
| `6a0cbc6f9f3f184b2c6ba66a` | growth |
| `6a0cbb5dd9543ee3671cb432` | starter |
| `6a0cbce993431a096dbde01e` | agency |
| `price_1PGxDVBWo9pIJAZW8hDHu8PD` (Stripe legado) | **pular** |
| sem SaaS (NO_SAAS) | **pular** |

O plano é cumulativo no widget: `starter` < `growth` < `agency` (agency vê tudo).

**Adicionar um plano novo:** quando a agência criar um novo SaaS plan no GHL, descobrir o `priceId`
(rodar com `?dry=1` — ele aparece em `skipped_no_plan`) e adicionar no `PLAN_BY_PRICE` em `index.ts`,
depois redeploy.

## Deploy

Projeto Supabase **GHL Token** (`tbziahcpkrfiksqhuhpe`), `verify_jwt=false` (gate por `?k=`).

```
# via MCP supabase deploy_edge_function (name=onboarding-provision)
```

## Rodar manual

```bash
# dry-run (preview, não escreve):
curl "https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/onboarding-provision?k=<SECRET>&dry=1" \
  -H "Authorization: Bearer <ANON_KEY>"

# pra valer:
curl "https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/onboarding-provision?k=<SECRET>" \
  -H "Authorization: Bearer <ANON_KEY>"
```

Retorna JSON: `{ created_count, created[], backfilled_count, skipped_existing, skipped_no_plan[] }`.

## Cron

`pg_cron` job `onboarding-provision-daily`, todo dia **08:00 UTC** (05:00 BRT), via `pg_net.http_post`.
Pega contas novas dentro de 24h.

```sql
-- ver:    SELECT * FROM cron.job WHERE jobname = 'onboarding-provision-daily';
-- ver run: SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname='onboarding-provision-daily') ORDER BY start_time DESC LIMIT 5;
```

## Segurança

- `?k=<SECRET>` é o único gate (verify_jwt off). Token OAuth de agência (tabela `Token Refresher`,
  companyId `TdmQMjj86Y3LgppiB96K`) é **sensível** — fica server-side, nunca no cliente.
- O probe antigo de descoberta (`onboarding-provision-probe`) foi neutralizado pra `410 Gone`.
  Pedro pode deletar de vez pelo dashboard.

## Verificar que rodou

```sql
SELECT plan, count(*) FROM onboarding_progress GROUP BY plan;
-- observabilidade do cron (1 row por run):
SELECT ran_at, total, recent, created, detail_errors, unmapped, truncated
FROM onboarding_provision_runs ORDER BY ran_at DESC LIMIT 10;
```

## AÇÃO PENDENTE (Pedro) — segurança (auditoria 2026-06-23)

Dois fixes de access-control que **só o Pedro** aplica (eu não mexo em permissão de recurso existente).
Projeto: GHL Token (`tbziahcpkrfiksqhuhpe`).

### 1. CRÍTICO — token de agência vazado pela anon key pública

A tabela `"Token Refresher"` (access_token + refresh_token OAuth da agência) tem policy `anon read
USING(true)` + grants anon. A anon key está embutida no widget JS público → qualquer um lê o token e
controla as ~287 sub-contas. **Rotacionar o OAuth do app GHL (access E refresh — assumir comprometido)**,
depois:

```sql
DROP POLICY IF EXISTS "Allow anon read access" ON public."Token Refresher";
REVOKE ALL ON public."Token Refresher" FROM anon, authenticated;
-- só service_role (que o edge function usa) deve ler. Nenhum browser lê essa tabela → não quebra nada.
```

### 2. HIGH — onboarding_progress com escrita anon total

RLS off, anon com SELECT/INSERT/UPDATE/DELETE/TRUNCATE. O widget precisa de SELECT/INSERT/UPDATE
(self-provision + save de progresso), mas NÃO de DELETE/TRUNCATE:

```sql
REVOKE DELETE, TRUNCATE ON public.onboarding_progress FROM anon, authenticated;
-- mantém SELECT/INSERT/UPDATE (o widget self-provisiona e salva progresso com a anon key).
```
