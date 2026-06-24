# Onboarding v4 — changelog (rebuild enterprise)

## 2026-06-23 — Provisionamento automático (regra 30 dias) + auditoria de segurança

Objetivo (Pedro): widget aparece populado em TODA conta < 30 dias (existentes + a serem criadas);
some depois de 30 dias. Plano vem do SaaS plan real do Spark Leads.

### Provisionamento — 3 camadas
1. **Self-provision no 1o login (instantâneo)** — `dist/spark-onboarding.js` `boot()`: conta < 30 dias
   SEM row + SaaS ativo lê o plano do Vue store (`settings.saas_settings.stripe_plan_details.price_id`)
   via `getAccountPlan()`, mapeia priceId→plano, INSERE a row (`sbInsert`, idempotente on_conflict) e
   mostra o widget na hora. Fecha o gap das contas a serem criadas (sem esperar cron). **Verificado ao
   vivo** (yQ9/agency): deletei a row → reload → self-provision recriou com plano agency → overlay
   fixed 1680×888 "Configure sua conta". Loader `?v=22`.
2. **Cron diário (backstop + autoridade)** — edge function `onboarding-provision` (projeto GHL Token):
   lista locations via API GHL, filtra < 30 dias, lê priceId do detail, INSERE quem falta. Idempotente.
   pg_cron `onboarding-provision-daily` (08:00 UTC). Backfilla data + corrige plano em upgrade.
3. **Backfill inicial** — rodou 1x: 24 rows criadas (13 growth, 10 starter, 5 agency). 9 puladas
   (2 Stripe legado "Ignorar" + 7 NO_SAAS masters/ORFA). 2 rows legadas plan=null (março, completed,
   escondidas pela regra de 30 dias).

Mapa priceId→plano: `66a`=growth, `432`=starter, `01e`=agency. Source + runbook versionados em
`supabase/functions/onboarding-provision/`.

### Regra de visibilidade (cliente)
`getAccountCreatedMs()` lê `currentLocation.date_added` (Firestore Timestamp, `.toMillis()`). `boot()`:
> 30 dias = esconde; sem row = (tenta self-provision, senão esconde); `completed_at` = esconde.
Backfilla `account_created_at` na row. Verificado: yQ9 ageDays 1.3 via toMillis.

### Auditoria multi-agente (33 agentes, 18 achados confirmados)
- **CRÍTICO (PENDENTE — precisa do Pedro):** tabela `"Token Refresher"` tem policy `anon read USING(true)`
  + grants anon → o token OAuth de agência é legível pela anon key pública do widget. Fix: rotacionar
  OAuth (access+refresh) + `DROP POLICY "Allow anon read access"` + `REVOKE ALL ... FROM anon, authenticated`.
- **HIGH (PENDENTE — Pedro):** `onboarding_progress` sem RLS, anon com escrita total. Fix: revogar
  DELETE/TRUNCATE do anon (manter SELECT/INSERT/UPDATE p/ o widget self-provisionar).
- **HIGH (FEITO):** cron via pg_net cortava em 5s (default) → função nunca completava. Fix: paralelizei
  detail calls (8 concorrentes, ~15s→1.6s) + `timeout_milliseconds := 120000` + secret em header
  (`x-onb-secret`, fora da query string). Verificado end-to-end (pg_net→função→200).
- **HIGH (FEITO):** detail-fetch 429/timeout virava "NO_SAAS" e sumia cliente pago. Fix: status check +
  retry + bucket `detail_errors[]` separado.
- **FEITO:** observabilidade (tabela `onboarding_provision_runs`, 1 row/run), plan-update em upgrade,
  truncation signal, json try/catch fail-closed, unmapped-priceId alert, POST status check.
- Follow-ups (medium/low) rastreados; não bloqueiam.

## Entregue e VERIFICADO na tela (2026-06-21)

Rebuild completo baseado no estudo enterprise + doc/HTML do Victor + seletores verificados ao vivo.
Arquitetura em camadas, deploy `dist-iota-one-53.vercel.app` (`?v=5`).

### Camada 0 — Conceito (modelo mental)
- Tela única fullscreen: "Tudo gira em torno do Contato", diagrama **Contato → SparkBot → Funil**,
  plano-aware, teal Spark OS. Consentimento leve "Bora ativar / Agora não".
- Strings `cn_*` (evita colisão com `c_*` do completion). ✓ verificado.

### Camada 1 — Checklist de ativação (eventos reais)
- "Deixe o Spark trabalhando por você", progresso endossado ("Conta criada ✓"), linguagem de resultado.
- Itens plano-aware (`ACTIVATION_ITEMS`): Conecte o WhatsApp · Fale com o SparkBot · **Sincronize a
  Five Rings (Growth+)** · Salve seu 1º contato.
- **Detecção REAL** via RPC `get_onboarding_signals(p_location_id)` na AI Agent Hub (boolean-only, anon,
  sem conteúdo): whatsapp_connected (proxy: msg channel=whatsapp), sparkbot_reply (role=assistant),
  sparkbot_user_msg. Poll a cada 6s; flipa o item sozinho. ✓ RPC testado + checklist verificado (Growth).

### Micro-tour por item (faça, não narre)
- Item redirect (WhatsApp/contato): navega pra tela + dock + Driver.js coach mark com selector verificado.
  ✓ verificado (WhatsApp: navegou + dock + popover).
- SparkBot: dock destaca o botão do copilot + instrução "Pergunte: quais meus contatos novos hoje?".
- Five Rings: 2 sub-passos — abre Web Store (extensão) → "Abrir portal" (`portal.fiveringsfinancial.com`).

### Camada 2.5 — Tour completo do Victor (após ativação)
- 3/3 ativação → "Tudo ativado! 🎉" → "Conhecer a plataforma" → tour (phase chip "TOUR DA PLATAFORMA",
  contador 1/13 Growth). Copy de resultado re-autorada, coach marks com **selectors verificados**.
  ✓ verificado: coach mark caiu no `#sidebar-v2` (spotlight correto).

### Infra
- RPC `get_onboarding_signals` (AI Agent Hub vyfkpdnwevtuxauacouj).
- Policy anon SELECT em `snapshot_onboarding_steps` (Spark OS havia trancado pra authenticated).
- waitForTargets 20s (SPA lento do GHL) + degradação graciosa.
- wizard_state.activation persiste os itens feitos; resume reabre o estado certo; FAB abre a camada certa.

## Placeholders resolvidos (Pedro 2026-06-21) — deploy v=6
- `COMMUNITY_URL` → grupo WhatsApp `https://chat.whatsapp.com/DGgxI7WbFaa79hDuKXZIPv?mode=gi_t`.
  QR + "Abrir link" do step `tour-community` apontam pra ele. ✓ verificado na tela (QR renderiza, href confere).
- **Agendamento 1:1 REMOVIDO** (não era trocar placeholder, era tirar o CTA). Removidos: const
  `ONBOARDING_LINK`, função `_mountFinalization` + dispatch, i18n `schedule_btn` (PT/EN). A copy do step
  `tour-finalization` foi reescrita (DB) pra não prometer onboarding 1:1; `cta_label` anulado → footer cai
  no "Concluído"/"Done" automático. ✓ verificado: finalização sem CTA, fecha o wizard → tela "done".
- `SPARKBOT_NUMBER` confirmado `+18134079657` (anexo do Pedro). Sem mudança de valor.

Cache-bust: loader `spark-onboarding.js?v=6` + `STEPS_CACHE_KEY` bump `:2→:3`. Deploy Vercel (projeto dist).

## Reorder PM-F4 (Pedro 2026-06-22) — tour único fluido, setup do Victor restaurado

Pedro: "substituí o fluxo do Victor em vez de append". Causa: motor (linha 468) só carregava
`step_phase='tour'` e descartava os 14 steps de setup (intactos no banco). Correção:
- **Conceito removido** como tela isolada (1ª visita abre ATIVAÇÃO direto). Modelo mental
  (Contato → SparkBot → Funil) tecido no `tour-intro`. Engine line ~1500 `concept`→`activation`.
- **Setup do Victor restaurado** num tour único e fluido: 8 steps de setup viraram `phase='tour'`,
  intercalados por área (dados conta, disponibilidade, automações, telefonia, SparkBot exemplos, app).
- **Dedup vs ativação**: WhatsApp/SparkBot/Five Rings/boas-vindas/transição ficam `setup` (motor ignora).
- **Dedup redundância** (fluxo limpo): "Revisar funil"(ob-st-5)/"Revisar apólices"(ob-gr-4) escondidos
  (redundantes com tour-prospects/tour-policies). Counts finais: **16 starter / 19 growth / 21 agency**
  (cumulativo: agency ⊃ growth ⊃ starter).
- **Calendário perfeito**: âncoras estáveis (#today-button/#new-appointment-button) + Driver.js
  `smoothScroll:false` + `onHighlighted`→`d.refresh()` (re-pina após reflow) + `tidyHostUi()`
  fecha o drawer `#calendar-view-filter-drawer` (grade 523→843px). Verificado na tela.

### Pendente de verificação na tela (BLOQUEADO em login — Pedro precisa logar)
Os 4 steps de config restaurados têm seletores ESPECULATIVOS nunca verificados (telas não-mapeadas):
- ob-st-2 `/settings/company`, ob-st-4 `/settings/calendars`, ob-st-6 `/automation/workflows`,
  ob-gr-5 `/settings/phone-system`. Degradam gracioso (instrução no dock), mas spotlight não acerta
  até mapear cada tela ao vivo. ob-gr-2/ob-st-3a renderizam fullscreen (cards/QR), não usam seletor.
- Falta: master test dos 21 steps nos 3 planos + cache bump (:6→:7, loader v=11) + deploy final.

## Auditoria multi-agente PM-F5 (Pedro 2026-06-22, "max effort até 100%") — deploy v=12

Rodei auditoria exaustiva (5 revisores paralelos + síntese): 56 findings → 30 priorizados (0 critical,
7 high, 12 medium, 11 low). Corrigido OFFLINE (DB + motor), sintaxe validada (`node --check`), deployado:

### DB (snapshot_onboarding_steps)
- **Acentos PT-BR** (eu tinha stripado): tour-intro (funcionário/começa/área/até + "é o seu"), tour-calendar (mês/reunião).
- **Seletores de estágio errados → verificados**: tour-prospects/policies/recruiting/agency-view usavam
  `.pipeline-board`/`.kanban-board` (palpite) → `.stage-scrollable-container`/`.opportunitiesCard`/`.stageHeaderBg`
  (igual tour-opportunities, verificado). Switcher padronizado pro verificado.
- **4 telas de config → instrução-only**: ob-st-2/ob-st-4/ob-st-6/ob-gr-5 miravam campos de form voláteis
  (palpites). `selector_guesses` zerados (mantêm título/descrição pro preview). Engine trata como noSpotlight.
- **conversations-left → instrução-only** (lista/busca/filtros sem id estável). **conversations-middle**: fallback
  PT "Comentário interno" antes do inglês no has-text.
- **ob-st-2 can_skip=true** (era o único travando o tour). **ob-gr-2 → starter** (SparkBot é incluso) + título
  "Exemplos do SparkBot" (era "Tour SparkBot, exemplos"). **ob-st-2 phone**: "documentos legais". Counts: 17/19/21.

### Motor (spark-onboarding.js)
- **liveMarks** (`_renderDock`): marks sem seletor não viram spotlight nem timeout 20s — navega + instrução,
  sem botão "Ver na tela". Habilita as telas de config/conversas como instrução-only limpo.
- **_pollSignals → dock** (HIGH): sinal (whatsapp/sparkbot) detectado enquanto o rep está no DOCK agora traz o
  checklist de volta com o item feito (`openFullscreen('activation')`). Antes só atualizava no fullscreen →
  o item não marcava sozinho, contradizendo "eu confirmo aqui".
- **Welcome "0 configurações"** (regressão do reorder): `setupCount()` sempre 0 → trocado por `activationItems().length`.
- **STEP_ICONS**: +`tour-community`:whatsapp; removido fantasma `tour-conversations-webphones`.
- Robustez: `onHighlighted` só re-pina se `Coach._active===d` (sem refresh fantasma pós-destroy); `enterDock`
  guard `indexOf<0`; `resume()` não restaura dock de step não-resolvido (`_activeResolved`).
- **Código morto removido**: `_renderConcept`, `_mountTransition`, dispatch ob-st-7, branch render 'concept'
  (normaliza estado legado → 'activation'). Inertes restantes (não removidos, zero ref de código): strings
  `cn_*`/`transition_done` no i18n + CSS `.concept__*` — removíveis depois.

### PENDENTE — precisa login GHL (não dá pra confirmar rota sem sessão):
1. **ghl_path `/opportunities/pipeline`** (5 steps de pipeline) vs doc `/opportunities/list` — se a rota não for
   válida, TODOS os coach marks de estágio falham. **Prioridade 1 ao logar.** NÃO mudei às cegas (doc pode estar velho).
2. **ghl_path `/conversations`** (4 steps) vs doc `/conversations/conversations` + garantir conversa aberta pro composer.
3. Validar os marks restantes ao vivo nos 3 planos (master test ponta a ponta).

### PENDENTE — decisão do Pedro (não mexi):
- **Fadiga de pipelines**: agency vê 5 steps seguidos em /opportunities/pipeline. Condensar policies/recruiting/agency? (UX)
- **Config intercalada**: mover ob-st-6/ob-gr-5 pro fim ou pro checklist de ativação?
- **"LeadConnector"** em ob-st-3a: vira "Spark"? (marca branca — depende se o app mobile é branded).
- **FAB badge**: salto 1→17 entre ativação e tour (somar os dois?).

## Master test na tela PM-F6 (Pedro logado 2026-06-22) — deploy v=15

Rodei o master test logado nos coach marks. Achou e corrigiu **2 bugs de rota reais** (quebrariam steps
inteiros) + 1 de copy, todos verificados na tela:
- **ROTA pipeline (P0)**: `/opportunities/pipeline` abre a tela de GERENCIAR pipelines (lista), NÃO o kanban.
  Corrigido pra `/opportunities/list` nos 5 steps. ✓ verificado: switcher (`input.hr-base-selection-input`) +
  estágios (`.stage-scrollable-container`, 74 cards) spotlightam exato.
- **ROTA conversas (P0)**: `/conversations` abre em branco; `/conversations/conversations` abre a inbox com
  conversa. Corrigido nos 4 steps. ✓ verificado: spotlight no `#sidebar-contact-icon` (1 de 6), 3 zonas.
- **COPY plano**: "Você tem 4 funis" era falso pra starter(1)/growth(2 pipelines). Genérico agora.
- ✓ Config instrução-only verificado na tela (ob-st-4 → /settings/calendars: sem spotlight errado, sem
  botão "Ver na tela", instrução no dock). ✓ Starter: 17 steps, vê os exemplos do SparkBot (ob-gr-2).
- ✓ Calendário/contatos/dashboard já verificados em sessões anteriores (mesmo motor).

**Verificado funcionando**: ativação (3/4 itens) · pipeline · conversas · config instrução-only · calendário ·
contagem plano-aware 17/19/21. Motor adversarialmente clean.

## Pendente (decisão de design do Pedro)
- Densidade dos pipelines (agency: 5 seguidos), config intercalada, "LeadConnector"→"Spark"?, FAB badge.
- Copy "(Prospects, Policies, Recruiting, Agency)" no switcher ainda lista os 4 nomes mesmo pra quem tem 1-2
  funis — aceitável (framing genérico), mas dá pra enxugar se quiser.

## Reestrutura PM-F7 (Pedro 2026-06-22) — Configuração separada do Tour — deploy v=16

Pedro: "a primeira parte é configuração (tudo que é setar: disponibilidade, whatsapp, calendário, zoom...),
no tour só o tour da plataforma." Separação limpa em 2 partes:

**PARTE 1 — CONFIGURAÇÃO** (checklist, ACTIVATION_ITEMS no JS, plano-aware, formato escolhido pelo Pedro):
- Dados da conta (/settings/company) · Conecte o WhatsApp (Stevo, detecção real) ·
  Conecte seu calendário (/settings/calendars/connections) · Defina a disponibilidade
  (/settings/calendars/availability) · Conecte o Zoom (mesma /connections, aba Video conferencing) ·
  Sincronize a Five Rings [G] · Revise as automações (/automation/workflows) · Habilite a telefonia
  (/settings/phone_system?tab=manage) [G]. Todas noSpotlight (settings = campos voláteis): navega + instrução + "Já fiz".
  Slugs verificadas na tela (v=17): calendário/zoom em /settings/calendars/connections, disponib. em
  /settings/calendars/availability, telefonia em /settings/phone_system?tab=manage.
- Itens: **6 starter / 8 growth+** (Five Rings + telefonia são growth+). Tela reframeada "Configure sua conta".
- ✓ verificado na tela: checklist renderiza, item de calendário navega pra /connections + instrução, sem spotlight errado.

**PARTE 2 — TOUR** (puro, só conhecer): intro → contatos → calendário(uso) → oportunidades+pipelines →
exemplos SparkBot → conversas → dashboard → app → comunidade → fim. **14 starter / 15 growth / 17 agency.**
Configs (ob-st-2/4/6, ob-gr-5) saíram do tour (phase=setup). SparkBot+contato saíram da ativação (são experiência,
não config): contato vira a prática de Contatos, SparkBot vira o step de Exemplos.

Ícone `video` add pro Zoom. Poll só detecta whatsapp agora (sparkbot saiu do checklist).

## PM-F8 (Pedro 2026-06-22) — launcher na topbar + título legível + some ao finalizar — deploy v=18

- **Título ilegível** (escuro no fundo escuro): os títulos (.welcome__title/.act__title/.step__title) não tinham
  `color` próprio e herdavam a cor escura do body do GHL. Fix: `color: var(--cream)` (#FCFCFC) nos 3. ✓ verificado.
- **Launcher na TOPBAR** (não bottom-right): `_mountFab` agora injeta `#spark-onb-topbtn` em `.hl_header--controls`
  (mesmo cluster do spark-zoom/stevo), com persistência via routeChangeEvent + interval 1s (SPA re-render).
  CSS un-scoped `#spark-onb-topbtn`. Some quando o onboarding abre, reaparece ao minimizar. ✓ verificado.
- **Some ao finalizar**: boot já checava `completed_at` (não reaparece no reload); `_complete`/`destroy` agora chamam
  `_stopLauncher()` (remove o launcher da topbar + mata o interval na mesma sessão). ✓ verificado: completed_at →
  zero widget, zero launcher.

## PM-F9 (Pedro 2026-06-23) — regra de visibilidade por idade (30 dias) — deploy v=21

Pedro: widget só aparece em contas criadas há < 30 dias; depois esconde. Pra contas novas e antigas.
- **Fonte da data**: o GHL EXPÕE a data de criação da location client-side, no Vue store:
  `app.__vue_app__.config.globalProperties.$store.state.locations.currentLocation.date_added` — é um
  Firestore Timestamp (`.toMillis()`). → regra 100% client-side, automática pra novas E antigas, SEM backend/cron/API/backfill.
  (O GHL NÃO expõe o plano/SaaS client-side — só reseller/stripe vazios.)
- **Implementação** (boot): `getAccountCreatedMs()` lê a data; `if idade > 30 dias → return` (não mostra).
  Backfill: guarda `account_created_at` (coluna nova) no row na 1ª carga. Idade desconhecida = não esconde (fail-open).
- **Verificado**: yQ9 (1 dia) mostra; Growth (18 dias) mostra; com limite temporário de 7 dias, Growth (18d)
  SOME (widget+launcher false). Backfill confirmado no banco.

### Pendente (decisão do Pedro): auto-provisionar contas NOVAS sem registro
O gate `if (!progress) return` mantém: conta sem onboarding_progress não mostra. Pra cobrir "todas as contas
novas automático", o widget precisaria auto-criar o registro — mas isso exige um PLANO (GHL não expõe).
Opções: (a) default fixo + corrigir exceções; (b) edge function lê o SaaS plan da API do GHL; (c) manual.

## Pendente (polish, sem bloqueio)
- Verificar item SparkBot/Five Rings/contato individualmente ponta a ponta (padrão já provado via WhatsApp).
- Lista de Contatos do GHL às vezes trava em branco (flakiness do GHL; degradação graciosa cobre).
- Detecção real de Five Rings/contato (hoje manual "Já fiz"; sinal real exigiria GHL API server-side).
