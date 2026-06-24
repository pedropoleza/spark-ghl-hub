/* ============================================================
   SPARK ONBOARDING WIZARD v2
   Wizard SETUP → TOUR (29 steps dinâmicos do Supabase) com:
   - tela cheia (welcome / steps / done) — base visual Claude Design
   - dock inferior adaptativo quando o user navega no GHL
   - coach marks via Driver.js (CDN, com degradação graciosa)
   - progresso em onboarding_progress (projeto GHL Token)
   - steps em snapshot_onboarding_steps (projeto Sparkleads OS)
   Injetado pelo spark-sidebar.js. Gate: só aparece pra location
   com row em onboarding_progress e completed_at NULL.
   ============================================================ */
(function () {
  'use strict';
  if (window.__sparkOnbV2) return;
  window.__sparkOnbV2 = true;

  /* ── Config ─────────────────────────────────────────────── */
  // Steps (Sparkleads OS) — anon key, RLS público de leitura
  var STEPS_DB = {
    url: 'https://nsqwgjbgcdqyzozyaltz.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zcXdnamJnY2RxeXpvenlhbHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNDkzOTAsImV4cCI6MjA5MTYyNTM5MH0.pq4CHqnoLEfa7DeM1MEsy0xQAJJcRar3TQKkGs_2HQ8',
  };
  // Progresso (GHL Token) — mesma tabela do widget v1
  var PROGRESS_DB = {
    url: 'https://tbziahcpkrfiksqhuhpe.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiemlhaGNwa3JmaWtzcWh1aHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MDIyOTAsImV4cCI6MjA3NzE3ODI5MH0.17eqja9Gab-K757ZGy5WvDvVngXzDGvFV1WSlirwJX4',
  };
  // Sinais de ativação (AI Agent Hub) — RPC get_onboarding_signals, anon, boolean-only
  var SIGNALS_DB = {
    url: 'https://vyfkpdnwevtuxauacouj.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZmtwZG53ZXZ0dXhhdWFjb3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODgwNDYsImV4cCI6MjA5MTA2NDA0Nn0.vN-mnwB4kG9DXVPnXkec1Wxbp0HKpYzrZ7dSJot_CAY',
  };
  var FIVERINGS_EXT_URL = 'https://chromewebstore.google.com/detail/five-rings-financial-sync/emdahpiepkhilcpgompfkeneokcmcobc';
  var FIVERINGS_PORTAL_URL = 'https://portal.fiveringsfinancial.com/';
  var WHATSAPP_LINK_UUID = 'b967c18f-cfa6-4cb1-aa2a-340a1d2a5dfa';
  var WIDGET_BASE = 'https://dist-iota-one-53.vercel.app';
  var CSS_URL = WIDGET_BASE + '/spark-onboarding.css?v=6';
  var DRIVER_JS = 'https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.js.iife.js';
  var DRIVER_CSS = 'https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.css';
  var APPSTORE_URL = 'https://apps.apple.com/us/app/lead-connector/id1564302502';
  var PLAYSTORE_URL = 'https://play.google.com/store/apps/details?id=com.gohighlevel.leadconnector';
  var COMMUNITY_URL = 'https://chat.whatsapp.com/DGgxI7WbFaa79hDuKXZIPv?mode=gi_t'; // Grupo WhatsApp da comunidade Spark (Pedro 2026-06-21)
  var SPARKBOT_NUMBER = '+18134079657'; // SparkBot WhatsApp (confirmado por Pedro 2026-06-21)
  var STEPS_CACHE_KEY = 'sparkOnbV2:steps:11'; // bump do sufixo invalida cache em deploy
  var STEPS_CACHE_TTL = 30 * 60 * 1000;
  var PLAN_RANK = { starter: 0, growth: 1, agency: 2 };

  /* ── DOM helpers ────────────────────────────────────────── */
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function reduceMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function getLocationId() {
    var m = window.location.pathname.match(/\/v2\/location\/([^\/]+)/);
    return m ? m[1] : null;
  }
  function getBasePath() {
    var m = window.location.pathname.match(/\/v2\/location\/[^\/]+/);
    return m ? m[0] : '';
  }

  /* ── Ícones (inline SVG, currentColor) ──────────────────── */
  var S = function (p, fill) {
    return '<svg viewBox="0 0 24 24" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="' + (fill ? 'none' : 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  };
  var I = {
    // marca Spark = raio (Zap, lucide), preenchido pra contrastar no quadrado teal
    spark: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4.5 13.2a.7.7 0 0 0 .56 1.12H11l-1 7.66a.35.35 0 0 0 .63.26L19.5 10.8a.7.7 0 0 0-.56-1.12H13l1-7.4a.35.35 0 0 0-.63-.28Z"/></svg>',
    rocket: S('<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 -.2Z"/><path d="M12 15l-3-3a14 14 0 0 1 7-9 6.5 6.5 0 0 1 5 5 14 14 0 0 1-9 7Z"/><path d="M9 12H4s.5-2.8 2-4c1.7-1.3 4 0 4 0"/><path d="M12 15v5s2.8-.5 4-2c1.3-1.7 0-4 0-4"/><circle cx="15" cy="9" r="1.2"/>'),
    clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    checklist: S('<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="m3 6 1.2 1.2L6.5 5"/><path d="m3 12 1.2 1.2L6.5 11"/><path d="m3 18 1.2 1.2L6.5 17"/>'),
    arrowRight: S('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'),
    arrowLeft: S('<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>'),
    x: S('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    minus: S('<path d="M5 12h14"/>'),
    check: S('<path d="M20 6 9 17l-5-5"/>'),
    checkCircle: S('<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
    info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'),
    eye: S('<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
    wave: S('<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M10 10.5V5a1.5 1.5 0 0 1 3 0v6"/><path d="M13 11V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M16 9.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1.5a5 5 0 0 1-3.7-1.6L4 14.5a1.6 1.6 0 0 1 2.3-2.2L7 13"/>'),
    building: S('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 21v-4h6v4"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2"/>'),
    user: S('<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>'),
    phone: S('<path d="M6.5 4h3l1.2 4-2 1.4a11 11 0 0 0 5 5l1.4-2 4 1.2v3a1.6 1.6 0 0 1-1.8 1.6A15.5 15.5 0 0 1 5 6.8 1.6 1.6 0 0 1 6.5 4Z"/>'),
    video: S('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>'),
    mobile: S('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
    apple: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.7 12.8c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-0.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.7-3.9ZM14.4 5.6c.7-.8 1.1-1.9 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z"/></svg>',
    android: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.8 9.5c-.7 0-1.3.6-1.3 1.3v5.4a1.3 1.3 0 0 0 2.6 0v-5.4c0-.7-.6-1.3-1.3-1.3Zm16.4 0c-.7 0-1.3.6-1.3 1.3v5.4a1.3 1.3 0 0 0 2.6 0v-5.4c0-.7-.6-1.3-1.3-1.3ZM6 9.3v8.2c0 .8.6 1.4 1.4 1.4h1v3a1.3 1.3 0 0 0 2.6 0v-3h2v3a1.3 1.3 0 0 0 2.6 0v-3h1c.8 0 1.4-.6 1.4-1.4V9.3H6Zm9.8-4.6.9-1.6a.3.3 0 0 0-.5-.3l-.9 1.7a6.3 6.3 0 0 0-5.6 0l-1-1.7a.3.3 0 0 0-.4.3l.9 1.6A5.3 5.3 0 0 0 6 8.6h12a5.3 5.3 0 0 0-2.2-3.9ZM9.5 7.1a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2Zm5 0a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2Z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2a9.7 9.7 0 0 0-8.3 14.7L2.2 22l5.3-1.4A9.7 9.7 0 1 0 12 2.2Zm0 1.8a7.9 7.9 0 0 1 6.7 12.1l-.2.3.8 2.9-3-.8-.3.2A7.9 7.9 0 1 1 12 4Zm-2.7 3.6c-.2 0-.5 0-.7.4-.3.4-1 1-1 2.4s1 2.8 1.2 3c.2.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.8.6 0 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.7-.4l-2-1c-.3-.1-.5-.1-.7.2l-.7.9c-.1.2-.3.2-.5.1-.7-.3-1.6-.6-2.6-1.5-.7-.7-1.2-1.5-1.4-1.7-.1-.3 0-.4.1-.5l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5L9.9 8c-.2-.4-.4-.4-.6-.4Z"/></svg>',
    message: S('<path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z"/>'),
    calendar: S('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/><path d="M8 13h.01M12 13h3M8 17h6"/>'),
    shield: S('<path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6Z"/><path d="m9 12 2 2 4-4"/>'),
    handshake: S('<path d="m11 12 2 2 4-4 4 4"/><path d="M21 14v-3l-4-4-3 2-3-2-4 3v4"/><path d="m3 12 4 4 2-1"/><path d="m11 18 2 2 2-1"/>'),
    trophy: S('<path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/><path d="M12 14v3M9 21h6M10 21v-2h4v2"/>'),
    repeat: S('<path d="m17 3 3 3-3 3"/><path d="M20 6H8a4 4 0 0 0-4 4v1"/><path d="m7 21-3-3 3-3"/><path d="M4 18h12a4 4 0 0 0 4-4v-1"/>'),
    bot: S('<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V5M12 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M2 13v2M22 13v2"/><circle cx="9" cy="13.5" r="1.2"/><circle cx="15" cy="13.5" r="1.2"/><path d="M9.5 16.5h5"/>'),
    database: S('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'),
    layers: S('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>'),
    sparkles: S('<path d="M12 4c.5 3.5 2 5 5.5 5.5-3.5.5-5 2-5.5 5.5-.5-3.5-2-5-5.5-5.5C10 9 11.5 7.5 12 4Z"/><path d="M19 14c.2 1.4.8 2 2.2 2.2-1.4.2-2 .8-2.2 2.2-.2-1.4-.8-2-2.2-2.2 1.4-.2 2-.8 2.2-2.2Z"/>'),
    chevronRight: S('<path d="m9 6 6 6-6 6"/>'),
    chevronUp: S('<path d="m6 15 6-6 6 6"/>'),
    target: S('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
    compass: S('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>'),
    chart: S('<path d="M4 20V6M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>'),
    externalLink: S('<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>'),
  };

  /* ícone por step (DB não guarda ícone — mapping local) */
  var STEP_ICONS = {
    'ob-st-1': 'wave', 'ob-st-2': 'building', 'ob-st-3': 'whatsapp', 'ob-st-3a': 'mobile',
    'ob-st-4': 'calendar', 'ob-st-5': 'target', 'ob-st-6': 'repeat', 'ob-st-7': 'sparkles',
    'ob-gr-1': 'bot', 'ob-gr-2': 'bot', 'ob-gr-3': 'database', 'ob-gr-4': 'shield', 'ob-gr-5': 'phone',
    'ob-ag-1': 'layers',
    'tour-intro': 'compass', 'tour-contacts': 'user', 'tour-calendar': 'calendar',
    'tour-opportunities': 'target', 'tour-prospects': 'target', 'tour-policies': 'shield',
    'tour-recruiting': 'handshake', 'tour-agency-view': 'layers',
    'tour-conversations-overview': 'message', 'tour-conversations-left': 'message',
    'tour-conversations-middle': 'message',
    'tour-conversations-right': 'checklist', 'tour-dashboard': 'chart',
    'tour-community': 'whatsapp', 'tour-finalization': 'rocket',
  };

  /* ── Itens de ativação (Camada 1) — ordem por VALOR, plano-aware.
     detect: chave do sinal real (get_onboarding_signals) | 'manual'.
     action: 'redirect' (navega + dock + spotlight) | 'sparkbot' | 'fiverings'. ── */
  /* Itens de CONFIGURAÇÃO (Parte 1) — checklist plano-aware. Pedro 2026-06-22: setup separado do tour.
     Todas as telas de settings são noSpotlight (campos voláteis): navega + instrução no dock + "Já fiz".
     whatsapp tem detecção real (whatsapp_connected); o resto é manual. */
  var ACTIVATION_ITEMS = [
    { key: 'account', icon: 'building', plan_min: 'starter', action: 'redirect',
      path: '/settings/company', detect: 'manual', noSpotlight: true, mark: { selector_guesses: [] } },
    { key: 'whatsapp', icon: 'whatsapp', plan_min: 'starter', action: 'redirect',
      path: '/custom-menu-link/' + WHATSAPP_LINK_UUID, detect: 'whatsapp_connected',
      // QR de conexão fica num iframe cross-origin do Stevo (inalcançável) — instrução-only.
      noSpotlight: true, mark: { selector_guesses: [] } },
    { key: 'calconnect', icon: 'calendar', plan_min: 'starter', action: 'redirect',
      path: '/settings/calendars/connections', detect: 'manual', noSpotlight: true, mark: { selector_guesses: [] } },
    { key: 'availability', icon: 'clock', plan_min: 'starter', action: 'redirect',
      path: '/settings/calendars/availability', detect: 'manual', noSpotlight: true, mark: { selector_guesses: [] } },
    { key: 'zoom', icon: 'video', plan_min: 'starter', action: 'redirect',
      path: '/settings/calendars/connections', detect: 'manual', noSpotlight: true, mark: { selector_guesses: [] } },
    { key: 'fiverings', icon: 'database', plan_min: 'growth', action: 'fiverings', detect: 'manual' },
    { key: 'automations', icon: 'repeat', plan_min: 'starter', action: 'redirect',
      path: '/automation/workflows', detect: 'manual', noSpotlight: true, mark: { selector_guesses: [] } },
    { key: 'telephony', icon: 'phone', plan_min: 'growth', action: 'redirect',
      path: '/settings/phone_system?tab=manage', detect: 'manual', noSpotlight: true, mark: { selector_guesses: [] } },
  ];

  /* ── i18n (chrome do widget; conteúdo dos steps vem do DB) ─ */
  var UI = {
    pt: {
      config: 'Configuração Spark',
      back: 'Voltar', next: 'Próximo', skip_step: 'Pular este step',
      finish: 'Concluído', got_it: 'Entendi',
      counter: function (n, t) { return n + ' de ' + t; },
      close_aria: 'Fechar onboarding',
      phase_setup: 'Configuração', phase_tour: 'Tour da plataforma',
      w_title: 'Bem-vindo ao Spark Leads',
      w_sub: 'Vamos configurar sua conta em alguns minutos',
      w_time: '~20 minutos', w_time_sub: 'Configuração + tour completo, tudo guiado',
      w_items: function (a, t) { return a + ' passos de ativação + ' + t + ' telas de tour'; },
      w_items_sub: 'Passo a passo, no seu ritmo',
      w_plan_sub: 'Seu plano',
      w_start: 'Começar', w_skip: 'Deixar pra depois',
      /* conceito (Camada 0 — modelo mental) — prefixo cn_ pra não colidir com c_ do completion */
      cn_eyebrow: 'Como o Spark funciona',
      cn_title: 'Tudo gira em torno do Contato',
      cn_sub: 'O SparkBot é o seu funcionário: ele fala com cada contato no WhatsApp, qualifica e agenda. E tudo vira um card no seu funil, do primeiro oi até virar cliente.',
      cn_node_contact: 'Contato', cn_node_contact_sub: 'a base de tudo',
      cn_node_bot: 'SparkBot', cn_node_bot_sub: 'fala no WhatsApp',
      cn_node_funnel: 'Funil', cn_node_funnel_sub: 'do oi ao cliente',
      cn_start: 'Bora ativar', cn_later: 'Agora não',
      /* ativação (Camada 1) */
      act_eyebrow: 'Configuração',
      act_title: 'Configure sua conta',
      act_sub: 'Passos rápidos pra deixar tudo pronto. Faça cada um no Spark e marque aqui (o WhatsApp eu confirmo sozinho).',
      act_account_created: 'Conta criada',
      act_progress: function (d, t) { return d + ' de ' + t; },
      act_doing: 'Fazendo no Spark', act_detecting: 'Verificando', act_done_label: 'Feito',
      act_mark_done: 'Já fiz', act_open: 'Abrir',
      act_done_title: 'Tudo configurado!', act_done_sub: 'Conta pronta e o Spark no jeito. Agora bora conhecer a plataforma.',
      act_tour_cta: 'Conhecer a plataforma', act_tour_later: 'Agora não',
      it_whatsapp_t: 'Conecte o WhatsApp', it_whatsapp_d: 'Pro SparkBot responder seus leads 24 horas por dia.', it_whatsapp_c: 'Conectar',
      it_whatsapp_dock: 'Aponte o WhatsApp do seu celular no QR Code da tela pra conectar. Quando conectar, eu marco aqui sozinho.',
      it_account_t: 'Dados da conta', it_account_d: 'Nome, telefone, fuso e idioma do negócio.', it_account_c: 'Preencher',
      it_account_dock: 'Preencha o nome do negócio, telefone, fuso horário e idioma e salve. Marco aqui quando você terminar.',
      it_calconnect_t: 'Conecte seu calendário', it_calconnect_d: 'Ligue o Google ou Outlook pro Spark ver sua agenda.', it_calconnect_c: 'Conectar',
      it_calconnect_dock: 'Na aba Connections, conecte seu calendário (Google ou Outlook). Marco aqui quando você terminar.',
      it_availability_t: 'Defina a disponibilidade', it_availability_d: 'Os horários em que você aceita reunião.', it_availability_c: 'Definir',
      it_availability_dock: 'Na aba Availability, marque os dias e horários em que aceita reunião. O SparkBot usa isso pra sugerir slots aos leads. Marco aqui quando você terminar.',
      it_zoom_t: 'Conecte o Zoom', it_zoom_d: 'Pras reuniões gerarem link automático.', it_zoom_c: 'Conectar',
      it_zoom_dock: 'Na aba Connections, abra Video conferencing e conecte o Zoom. Marco aqui quando você terminar.',
      it_automations_t: 'Revise as automações', it_automations_d: 'Veja o que já vem ligado e ajuste.', it_automations_c: 'Revisar',
      it_automations_dock: 'Confira os workflows que já vêm ligados (nurturing, follow-ups, boas-vindas) e desligue o que não quiser. Marco aqui quando você terminar.',
      it_telephony_t: 'Habilite a telefonia', it_telephony_d: 'Ligue as chamadas e o WhatsApp Calling.', it_telephony_c: 'Ativar',
      it_telephony_dock: 'Ative as chamadas, incluindo o WhatsApp Calling, pra falar com leads sem sair do Spark. Marco aqui quando você terminar.',
      it_sparkbot_t: 'Fale com o SparkBot', it_sparkbot_d: 'Mande uma mensagem e veja ele responder na hora.', it_sparkbot_c: 'Abrir SparkBot',
      it_fiverings_t: 'Sincronize a Five Rings', it_fiverings_d: 'Instale a extensão e abra o portal pra trazer seus clientes pro Spark.', it_fiverings_c: 'Instalar extensão',
      it_fiverings_step2: 'Agora abra o portal Five Rings pra começar a sincronizar.', it_fiverings_c2: 'Abrir portal',
      it_contact_t: 'Salve seu 1º contato', it_contact_d: 'Crie o Suporte Spark e veja como é rápido cadastrar uma pessoa.', it_contact_c: 'Criar contato',
      it_contact_sample: 'Nome: Suporte Spark · Telefone: +1 786 627 6787 (celular, Estados Unidos)',
      sparkbot_prompt: 'Pergunte ao SparkBot: quais meus contatos novos hoje?',
      c_title: 'Pronto, sua conta tá configurada!',
      c_sub: 'Você já conhece o essencial do Spark Leads. Bora pro trabalho!',
      c_done_label: 'concluídos', c_skip_label: 'pulados',
      c_summary: 'Ver o que foi feito',
      c_dashboard: 'Começar a usar', c_review: 'Revisar steps',
      m_title: 'Tem certeza?',
      m_desc: 'Você ainda tem itens pendentes. Pode continuar depois pelo botão 🚀 a qualquer momento.',
      m_continue: 'Continuar onboarding', m_leave: 'Fechar mesmo assim',
      fab_aria: 'Continuar configuração',
      skipped_label: 'pulado',
      dock_done: 'Marcar feito', dock_tour: 'Ver na tela', dock_stop: 'Parar tour',
      dock_back: 'Voltar ao guia', dock_min_aria: 'Minimizar', dock_expand_aria: 'Detalhes',
      dock_resume: 'Continuar', dock_practice: 'Pratique agora',
      dock_no_targets: 'Não achei os elementos nessa tela. Siga as instruções e marque feito quando terminar.',
      dock_nav_hint: 'Te levei pra tela certa. Siga os destaques!',
      transition_done: 'Setup completo!',
      driver_next: 'Próximo', driver_prev: 'Anterior', driver_done: 'Entendi',
    },
    en: {
      config: 'Spark Setup',
      back: 'Back', next: 'Next', skip_step: 'Skip this step',
      finish: 'Done', got_it: 'Got it',
      counter: function (n, t) { return n + ' of ' + t; },
      close_aria: 'Close onboarding',
      phase_setup: 'Setup', phase_tour: 'Platform tour',
      w_title: 'Welcome to Spark Leads',
      w_sub: 'Let’s set up your account in just a few minutes',
      w_time: '~20 minutes', w_time_sub: 'Setup + full tour, fully guided',
      w_items: function (a, t) { return a + ' activation steps + ' + t + ' tour screens'; },
      w_items_sub: 'Step by step, at your pace',
      w_plan_sub: 'Your plan',
      w_start: 'Get started', w_skip: 'Maybe later',
      /* concept (Layer 0 — mental model) — cn_ prefix to avoid colliding with completion's c_ */
      cn_eyebrow: 'How Spark works',
      cn_title: 'Everything revolves around the Contact',
      cn_sub: 'SparkBot is your employee: it talks to every contact on WhatsApp, qualifies and books. And it all becomes a card in your funnel, from the first hello to a closed client.',
      cn_node_contact: 'Contact', cn_node_contact_sub: 'the base of it all',
      cn_node_bot: 'SparkBot', cn_node_bot_sub: 'talks on WhatsApp',
      cn_node_funnel: 'Funnel', cn_node_funnel_sub: 'from hi to client',
      cn_start: 'Let’s activate', cn_later: 'Not now',
      /* activation (Layer 1) */
      act_eyebrow: 'Setup',
      act_title: 'Set up your account',
      act_sub: 'Quick steps to get everything ready. Do each one in Spark and mark it here (WhatsApp I confirm on my own).',
      act_account_created: 'Account created',
      act_progress: function (d, t) { return d + ' of ' + t; },
      act_doing: 'Doing it in Spark', act_detecting: 'Checking', act_done_label: 'Done',
      act_mark_done: 'I did it', act_open: 'Open',
      act_done_title: 'All set up!', act_done_sub: 'Account ready and Spark good to go. Now let us tour the platform.',
      act_tour_cta: 'Explore the platform', act_tour_later: 'Not now',
      it_whatsapp_t: 'Connect WhatsApp', it_whatsapp_d: 'So SparkBot answers your leads 24 hours a day.', it_whatsapp_c: 'Connect',
      it_whatsapp_dock: 'Point your phone WhatsApp at the QR Code on screen to connect. Once it connects, I check this off automatically.',
      it_account_t: 'Account basics', it_account_d: 'Business name, phone, timezone and language.', it_account_c: 'Fill in',
      it_account_dock: 'Fill in your business name, phone, timezone and language, then save. I check this off when you are done.',
      it_calconnect_t: 'Connect your calendar', it_calconnect_d: 'Link Google or Outlook so Spark sees your schedule.', it_calconnect_c: 'Connect',
      it_calconnect_dock: 'On the Connections tab, connect your calendar (Google or Outlook). I check this off when you are done.',
      it_availability_t: 'Set availability', it_availability_d: 'The hours you accept meetings.', it_availability_c: 'Set',
      it_availability_dock: 'On the Availability tab, set the days and hours you accept meetings. SparkBot uses this to suggest slots to leads. I check this off when you are done.',
      it_zoom_t: 'Connect Zoom', it_zoom_d: 'So meetings get a link automatically.', it_zoom_c: 'Connect',
      it_zoom_dock: 'On the Connections tab, open Video conferencing and connect Zoom. I check this off when you are done.',
      it_automations_t: 'Review automations', it_automations_d: 'See what is on and adjust.', it_automations_c: 'Review',
      it_automations_dock: 'Check the workflows already on (nurturing, follow-ups, welcomes) and turn off what you do not want. I check this off when you are done.',
      it_telephony_t: 'Enable calling', it_telephony_d: 'Turn on calls and WhatsApp Calling.', it_telephony_c: 'Enable',
      it_telephony_dock: 'Enable calling, including WhatsApp Calling, to reach leads without leaving Spark. I check this off when you are done.',
      it_sparkbot_t: 'Talk to SparkBot', it_sparkbot_d: 'Send a message and watch it reply instantly.', it_sparkbot_c: 'Open SparkBot',
      it_fiverings_t: 'Sync Five Rings', it_fiverings_d: 'Install the extension and open the portal to bring your clients into Spark.', it_fiverings_c: 'Install extension',
      it_fiverings_step2: 'Now open the Five Rings portal to start syncing.', it_fiverings_c2: 'Open portal',
      it_contact_t: 'Save your 1st contact', it_contact_d: 'Create Spark Support and see how fast it is to add someone.', it_contact_c: 'Create contact',
      it_contact_sample: 'Name: Spark Support · Phone: +1 786 627 6787 (mobile, United States)',
      sparkbot_prompt: 'Ask SparkBot: who are my new contacts today?',
      c_title: 'Done, your account is all set!',
      c_sub: 'You now know the essentials of Spark Leads. Let’s get to work!',
      c_done_label: 'completed', c_skip_label: 'skipped',
      c_summary: 'See what was done',
      c_dashboard: 'Start using', c_review: 'Review steps',
      m_title: 'Are you sure?',
      m_desc: 'You still have pending items. You can pick this back up anytime from the 🚀 button.',
      m_continue: 'Continue onboarding', m_leave: 'Close anyway',
      fab_aria: 'Resume setup',
      skipped_label: 'skipped',
      dock_done: 'Mark done', dock_tour: 'Show me', dock_stop: 'Stop tour',
      dock_back: 'Back to guide', dock_min_aria: 'Minimize', dock_expand_aria: 'Details',
      dock_resume: 'Resume', dock_practice: 'Try it now',
      dock_no_targets: 'Couldn’t find the elements on this screen. Follow the instructions and mark done when finished.',
      dock_nav_hint: 'I brought you to the right screen. Follow the highlights!',
      transition_done: 'Setup complete!',
      driver_next: 'Next', driver_prev: 'Previous', driver_done: 'Got it',
    },
  };

  /* ── Data layer ─────────────────────────────────────────── */
  function sbGet(db, path) {
    return fetch(db.url + '/rest/v1/' + path, {
      headers: { apikey: db.key, Authorization: 'Bearer ' + db.key, Accept: 'application/json' },
    }).then(function (r) { if (!r.ok) throw new Error('sb ' + r.status); return r.json(); });
  }
  function sbPatch(db, path, body) {
    return fetch(db.url + '/rest/v1/' + path, {
      method: 'PATCH',
      headers: {
        apikey: db.key, Authorization: 'Bearer ' + db.key,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
      keepalive: true, // sobrevive a navegação full-reload (fallback do navigateTo)
    }).then(function (r) {
      if (!r.ok) console.warn('[SparkOnb] save HTTP ' + r.status);
      return r;
    }).catch(function (e) { console.warn('[SparkOnb] save fail', e); });
  }
  // INSERT idempotente (ON CONFLICT location_id DO NOTHING via PostgREST). Usado no self-provision
  // do 1o login. Conflito = row já existe (cron ou outra aba) = no-op silencioso.
  function sbInsert(db, path, body) {
    return fetch(db.url + '/rest/v1/' + path, {
      method: 'POST',
      headers: {
        apikey: db.key, Authorization: 'Bearer ' + db.key,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).then(function (r) {
      if (!r.ok) console.warn('[SparkOnb] provision HTTP ' + r.status);
      return r;
    }).catch(function (e) { console.warn('[SparkOnb] provision fail', e); });
  }

  function loadSteps() {
    try {
      var raw = localStorage.getItem(STEPS_CACHE_KEY);
      if (raw) {
        var c = JSON.parse(raw);
        if (Date.now() - c.ts < STEPS_CACHE_TTL && Array.isArray(c.data) && c.data.length) {
          return Promise.resolve(c.data);
        }
      }
    } catch (e) {}
    return sbGet(STEPS_DB, 'snapshot_onboarding_steps?select=*&order=display_order.asc').then(function (rows) {
      try { localStorage.setItem(STEPS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: rows })); } catch (e) {}
      return rows;
    });
  }
  function loadProgress(locId) {
    return sbGet(PROGRESS_DB, 'onboarding_progress?location_id=eq.' + encodeURIComponent(locId) + '&select=*&limit=1')
      .then(function (rows) { return rows && rows[0] ? rows[0] : null; });
  }

  /* sinais de ativação REAIS (RPC boolean-only na AI Agent Hub) */
  function loadSignals(locId) {
    return fetch(SIGNALS_DB.url + '/rest/v1/rpc/get_onboarding_signals', {
      method: 'POST',
      headers: { apikey: SIGNALS_DB.key, Authorization: 'Bearer ' + SIGNALS_DB.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_location_id: locId }),
    }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* ── Coach marks (Driver.js wrapper) ────────────────────── */
  var Coach = {
    _loading: null,
    _active: null,
    load: function () {
      if (window.driver && window.driver.js) return Promise.resolve(true);
      if (this._loading) return this._loading;
      var self = this;
      this._loading = new Promise(function (resolve) {
        var css = document.createElement('link');
        css.rel = 'stylesheet'; css.href = DRIVER_CSS;
        document.head.appendChild(css);
        var js = document.createElement('script');
        js.src = DRIVER_JS;
        js.onload = function () { resolve(true); };
        js.onerror = function () { self._loading = null; resolve(false); }; // falha transitória do CDN não cacheia — retry no próximo tour
        document.head.appendChild(js);
      });
      return this._loading;
    },
    /* resolve 1 seletor (com suporte a :has-text("...") custom) */
    resolveOne: function (sel) {
      try {
        var m = sel.match(/^(.*?):has-text\(["'](.+?)["']\)\s*$/);
        if (m) {
          var base = m[1] || '*';
          var txt = m[2].toLowerCase();
          var cands = document.querySelectorAll(base);
          for (var i = 0; i < cands.length; i++) {
            var c = cands[i];
            if ((c.textContent || '').toLowerCase().indexOf(txt) !== -1 && this.visible(c)) return c;
          }
          return null;
        }
        var node = document.querySelector(sel);
        return node && this.visible(node) ? node : null;
      } catch (e) { return null; }
    },
    visible: function (node) {
      if (!node) return false;
      var r = node.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    },
    resolveMark: function (mark) {
      var guesses = mark.selector_guesses || [];
      for (var i = 0; i < guesses.length; i++) {
        var node = this.resolveOne(guesses[i]);
        if (node) return node;
      }
      return null;
    },
    stop: function () {
      if (this._active) { try { this._active.destroy(); } catch (e) {} this._active = null; }
    },
    /* roda a sequência; cb(status): 'done' | 'closed' | 'no_targets' | 'no_driver' */
    run: function (marks, lang, cb) {
      var self = this;
      this.stop();
      this.load().then(function (ok) {
        if (!ok || !window.driver || !window.driver.js) { cb && cb('no_driver'); return; }
        var u = UI[lang] || UI.pt;
        var steps = [];
        (marks || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (mk) {
          var node = self.resolveMark(mk);
          if (!node) return;
          steps.push({
            // node direto: driver 1.3.1 NÃO aceita função (getBoundingClientRect crash).
            // stale refs mitigados pelo settle de 900ms no waitForTargets antes da captura.
            element: node,
            popover: {
              title: lang === 'en' ? (mk.title_en || mk.title_pt) : (mk.title_pt || mk.title_en),
              description: lang === 'en' ? (mk.description_en || mk.description_pt) : (mk.description_pt || mk.description_en),
            },
          });
        });
        if (!steps.length) { cb && cb('no_targets'); return; }
        var finished = false;
        var d;
        try {
          d = window.driver.js.driver({
          showProgress: steps.length > 1,
          showButtons: ['next', 'previous', 'close'],
          nextBtnText: u.driver_next, prevBtnText: u.driver_prev, doneBtnText: u.driver_done,
          popoverClass: 'spark-driver',
          overlayColor: 'rgba(0, 0, 0, 0.65)',
          stagePadding: 6,
          // GHL/FullCalendar refluem no scroll — o pulo desalinha o recorte. Sem smooth scroll.
          smoothScroll: false,
          // Fix bug observado em prod 2026-06-21: GHL é Vue SPA e reflui async DEPOIS do highlight
          // (FullCalendar resize, painel Manage view, kanban). O recorte do Driver ficava no lugar
          // velho = "spotlight errado". Re-pina o stage no elemento conforme o GHL assenta.
          onHighlighted: function () {
            // só re-pina se este driver ainda é o ativo — evita refresh fantasma pós-destroy (auditoria 2026-06-22)
            [120, 360, 760].forEach(function (ms) {
              setTimeout(function () { try { if (self._active === d) d.refresh(); } catch (e) {} }, ms);
            });
          },
          steps: steps,
          onDestroyStarted: function () {
            finished = !d.hasNextStep();
            d.destroy();
          },
          onDestroyed: function () {
            self._active = null;
            cb && cb(finished ? 'done' : 'closed');
          },
          });
          self._active = d;
          d.drive();
        } catch (e) {
          console.warn('[SparkOnb] driver crash', e);
          self._active = null;
          cb && cb('closed'); // garante que o dock não fica preso em driving
        }
      });
    },
  };

  /* ── Navegação SPA (Vue router; fallback assign) ────────── */
  function navigateTo(path) {
    var full = getBasePath() + path;
    try {
      var app = document.getElementById('app');
      if (app && app.__vue_app__) {
        var router = app.__vue_app__.config.globalProperties.$router;
        if (router) { router.push(full); return; }
      }
      if (app && app.__vue__ && app.__vue__.$router) { app.__vue__.$router.push(full); return; }
    } catch (e) {}
    window.location.assign(full);
  }

  /* aguarda algum target dos coach marks aparecer no DOM.
     achou o primeiro → segura +900ms pra página hidratar (evita tour parcial).
     GHL é SPA com render assíncrono lento (lista de contatos pode levar >15s ou
     travar em branco). Por isso o default subiu pra 20s + degradação graciosa no caller. */
  /* Fecha drawers/painéis nativos do GHL que espremem a área útil e bagunçam o recorte do
     spotlight. Fix bug observado em prod 2026-06-21: o drawer "Manage view" do calendário
     deixava a grade em ~523px (cheia é ~843) e o Driver capturava o stage torto. Seguro:
     só age quando o drawer existe (= painel aberto), nunca abre por engano. */
  function tidyHostUi() {
    try {
      var drawer = document.querySelector('#calendar-view-filter-drawer');
      var toggle = document.querySelector('#customizations-button');
      if (drawer && toggle && toggle.offsetParent !== null) toggle.click();
    } catch (e) {}
  }

  function waitForTargets(marks, timeoutMs) {
    timeoutMs = timeoutMs || 20000;
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function poll() {
        for (var i = 0; i < (marks || []).length; i++) {
          if (Coach.resolveMark(marks[i])) {
            tidyHostUi();  // fecha o painel que espreme a tela antes do settle + captura
            return setTimeout(function () { resolve(true); }, 900);
          }
        }
        if (Date.now() - t0 > timeoutMs) return resolve(false);
        setTimeout(poll, 500);
      })();
    });
  }

  /* ── Engine ─────────────────────────────────────────────── */
  function Engine(locId, progress, allSteps) {
    this.locId = locId;
    this.plan = progress.plan || 'starter';
    this.lang = progress.lang || ((navigator.language || 'pt').slice(0, 2) === 'en' ? 'en' : 'pt');
    this.completed = new Set(progress.completed_steps || []);
    this.skipped = new Set(progress.skipped_steps || []);
    var ws = progress.wizard_state || {};
    this.index = typeof ws.index === 'number' ? ws.index : 0;
    this.screen = ws.screen || 'welcome';
    this.mode = ws.mode || 'fullscreen';   // fullscreen | dock
    this.everOpened = !!ws.screen;          // wizard_state vazio = primeira visita
    this.actDone = new Set(ws.activation || []);  // itens de ativação concluídos (Camada 1)
    this._actDoing = null;
    this._dir = 'fwd';
    this._navToken = 0;
    var rank = PLAN_RANK[this.plan] != null ? PLAN_RANK[this.plan] : 0;
    // wizard = TOUR do Victor (a ativação substituiu os setup steps na v4)
    this.steps = allSteps.filter(function (s) { return (PLAN_RANK[s.plan_min] || 0) <= rank && s.step_phase === 'tour'; });
    // resume por id (não por índice) — lista de steps pode mudar no DB entre sessões
    this._activeResolved = true;
    if (ws.active_step) {
      this._activeResolved = false; // só restaura dock se o active_step persistido ainda existir na lista do plano
      for (var i = 0; i < this.steps.length; i++) {
        if (this.steps[i].id === ws.active_step) { this.index = i; this._activeResolved = true; break; }
      }
    }
    if (this.index >= this.steps.length) this.index = Math.max(0, this.steps.length - 1);
    this._buildRoot();
  }

  Engine.prototype = {
    /* ---- helpers ---- */
    ui: function () { return UI[this.lang] || UI.pt; },
    t: function (step, field) {
      var v = step[field + '_' + this.lang];
      return v != null && v !== '' ? v : (step[field + '_pt'] || step[field + '_en'] || '');
    },
    tMark: function (mk, field) {
      var v = mk[field + '_' + this.lang];
      return v != null && v !== '' ? v : (mk[field + '_pt'] || mk[field + '_en'] || '');
    },
    icon: function (step) { return I[STEP_ICONS[step.id]] || I.sparkles; },
    isRedirect: function (step) {
      return !!(step.ghl_path && (step.coach_marks || []).length &&
        ['redirect_tour', 'interactive_demo', 'import', 'info'].indexOf(step.step_type) !== -1 &&
        step.step_type !== 'action' && step.id !== 'ob-st-3a');
    },
    pendingCount: function () {
      var handled = 0, self = this;
      this.steps.forEach(function (s) { if (self.completed.has(s.id) || self.skipped.has(s.id)) handled++; });
      var tourPending = Math.max(0, this.steps.length - handled);
      var actPending = this.activationItems().filter(function (i) { return !self.actDone.has(i.key); }).length;
      // enquanto a ativação não fecha, o badge mostra os passos de ativação (prioridade)
      return actPending > 0 ? actPending : tourPending;
    },
    setupCount: function () { return this.steps.filter(function (s) { return s.step_phase === 'setup'; }).length; },
    tourCount: function () { return this.steps.filter(function (s) { return s.step_phase === 'tour'; }).length; },

    save: function (extra) {
      var body = {
        completed_steps: Array.from(this.completed),
        skipped_steps: Array.from(this.skipped),
        wizard_state: {
          screen: this.screen, index: this.index, mode: this.mode,
          active_step: this.steps[this.index] ? this.steps[this.index].id : null,
        },
        lang: this.lang,
        updated_at: new Date().toISOString(),
      };
      if (extra) for (var k in extra) body[k] = extra[k];
      sbPatch(PROGRESS_DB, 'onboarding_progress?location_id=eq.' + encodeURIComponent(this.locId), body);
    },

    /* ---- raiz / host ---- */
    _buildRoot: function () {
      // limpa widget v1 legado se tiver sobrado (cache misto)
      ['spark-onboarding-btn', 'spark-onboarding-panel', 'spark-onboarding-overlay'].forEach(function (id) {
        var n = document.getElementById(id); if (n) n.remove();
      });
      this.root = el('<div class="spark-onb"></div>');
      this.host = el('<div class="spark-onb__host is-hidden"><div class="spark"></div></div>');
      this.root.appendChild(this.host);
      this.sparkEl = this.host.querySelector('.spark');
      document.body.appendChild(this.root);
      // ESC no fullscreen → modal de confirmação (modal aberto trata o próprio ESC)
      var self = this;
      this._onKey = function (e) {
        if (e.key !== 'Escape') return;
        if (!self.root || self.host.classList.contains('is-hidden')) return;
        if (self.sparkEl.querySelector('.overlay')) return;
        if (self.screen === 'done') return;
        self._requestExit();
      };
      document.addEventListener('keydown', this._onKey);
    },

    openFullscreen: function (screen) {
      Coach.stop();
      this._removeDock();
      this._removeFab();
      if (screen) this.screen = screen;
      this.mode = 'fullscreen';
      this.host.classList.remove('is-hidden');
      this.render();
      this.save();
    },
    closeFullscreen: function () {
      this.host.classList.add('is-hidden');
    },

    /* ---- render router ---- */
    render: function (animate) {
      this.sparkEl.classList.toggle('anim-on', !reduceMotion() && document.visibilityState !== 'hidden');
      clear(this.sparkEl);
      if (this.screen === 'concept') this.screen = 'activation'; // conceito removido (Pedro 2026-06-22): normaliza estado legado
      if (this.screen === 'activation') this._renderActivation();
      else if (this.screen === 'welcome') this._renderWelcome();
      else if (this.screen === 'done') this._renderDone();
      else this._renderWizard(animate !== false);
    },

    /* ====================================================
       CAMADA 1 — ATIVAÇÃO (checklist de eventos reais)
       ==================================================== */
    activationItems: function () {
      var rank = PLAN_RANK[this.plan] != null ? PLAN_RANK[this.plan] : 0;
      return ACTIVATION_ITEMS.filter(function (i) { return (PLAN_RANK[i.plan_min] || 0) <= rank; });
    },
    itemText: function (key, field) {
      // it_<key>_<t|d|c> nas strings i18n
      var map = { t: 't', d: 'd', c: 'c' };
      return this.ui()['it_' + key + '_' + map[field]] || key;
    },
    actAllDone: function () {
      var self = this;
      return this.activationItems().every(function (i) { return self.actDone.has(i.key); });
    },

    _renderActivation: function () {
      var u = this.ui(), self = this;
      var items = this.activationItems();
      var total = items.length;
      var doneN = items.filter(function (i) { return self.actDone.has(i.key); }).length;
      // progresso endossado: "conta criada" conta como passo grátis (Zeigarnik / endowed progress)
      var pct = Math.round(((doneN + 1) / (total + 1)) * 100);
      var planLabel = this.plan.toUpperCase();

      if (this.actAllDone()) return this._renderActivationDone();

      var rows = items.map(function (it) {
        var done = self.actDone.has(it.key);
        var doing = self._actDoing === it.key;
        var ic = I[it.icon] || I.sparkles;
        var statusHtml;
        if (done) statusHtml = '<div class="act-row__check">' + I.check + '</div>';
        else if (doing) statusHtml = '<span class="act-row__detect">' + (it.detect !== 'manual' ? esc(u.act_detecting) : '') +
          '<span class="dots"><span></span><span></span><span></span></span></span>' +
          (it.detect === 'manual' ? '<button class="btn btn--sm act-row__manual" data-k="' + it.key + '">' + esc(u.act_mark_done) + '</button>' : '');
        else statusHtml = '<button class="btn btn--sm btn--primary act-row__cta" data-k="' + it.key + '">' + esc(self.itemText(it.key, 'c')) + I.arrowRight + '</button>';
        return '<div class="act-row' + (done ? ' is-done' : '') + (doing ? ' is-doing' : '') + '">' +
          '<div class="act-row__ic">' + ic + '</div>' +
          '<div class="act-row__tx"><b>' + esc(self.itemText(it.key, 't')) + '</b><span>' + esc(self.itemText(it.key, 'd')) + '</span></div>' +
          '<div class="act-row__status">' + statusHtml + '</div>' +
        '</div>';
      }).join('');

      var node = el('<div class="welcome activation">' +
        '<header class="wiz__top act__top">' +
          '<div class="wiz__brand"><span class="spark-logo">' + I.spark + '</span><span class="wiz__brand-tx">' + esc(u.config) + '</span></div>' +
          '<div class="act__lang"></div>' +
          '<div class="wiz__top-right"><span class="plan-badge plan-badge--' + this.plan + '">' + planLabel + '</span>' +
            '<button class="icon-btn act__close" aria-label="' + esc(u.close_aria) + '">' + I.x + '</button></div>' +
        '</header>' +
        '<div class="act__body"><div class="act__inner">' +
          '<div class="act__eyebrow">' + esc(u.act_eyebrow) + '</div>' +
          '<h1 class="act__title">' + esc(u.act_title) + '</h1>' +
          '<p class="act__sub">' + esc(u.act_sub) + '</p>' +
          '<div class="act__progress"><div class="act__progress-bar"><i style="width:' + pct + '%"></i></div>' +
            '<span class="act__progress-tx">' + esc(u.act_progress(doneN, total)) + '</span></div>' +
          '<div class="act__list">' +
            '<div class="act-row is-done act-row--free"><div class="act-row__ic">' + I.spark + '</div>' +
              '<div class="act-row__tx"><b>' + esc(u.act_account_created) + '</b></div>' +
              '<div class="act-row__status"><div class="act-row__check">' + I.check + '</div></div></div>' +
            rows +
          '</div>' +
        '</div></div></div>');

      node.querySelector('.act__lang').appendChild(this._langToggle());
      node.querySelector('.act__close').onclick = function () { self._dismiss(); };
      node.querySelectorAll('.act-row__cta').forEach(function (b) {
        b.onclick = function () { self._startActivationItem(b.getAttribute('data-k')); };
      });
      node.querySelectorAll('.act-row__manual').forEach(function (b) {
        b.onclick = function () { self._completeActivation(b.getAttribute('data-k')); };
      });
      this.sparkEl.appendChild(node);
      this._pollSignals();
    },

    _renderActivationDone: function () {
      var u = this.ui(), self = this;
      var node = el('<div class="done-screen activation-done">' +
        '<div class="confetti"></div>' +
        '<div class="done-screen__inner">' +
          '<div class="hero-ic hero-ic--80 hero-ic--success fade-up">' + I.checkCircle + '</div>' +
          '<h1 class="welcome__title fade-up fade-up-1">' + esc(u.act_done_title) + ' <span style="font-size:0.9em">🎉</span></h1>' +
          '<p class="welcome__sub fade-up fade-up-2">' + esc(u.act_done_sub) + '</p>' +
          '<button class="btn btn--primary btn--lg done-cta fade-up fade-up-3" style="margin-top:28px">' + esc(u.act_tour_cta) + I.arrowRight + '</button>' +
          '<button class="btn btn--text fade-up fade-up-3 act-done__later">' + esc(u.act_tour_later) + '</button>' +
        '</div></div>');
      node.querySelector('.done-cta').onclick = function () {
        self.screen = 'wizard'; self.index = 0; self._dir = 'fwd'; self.render(); self.save();
      };
      node.querySelector('.act-done__later').onclick = function () { self._dismiss(); };
      this.sparkEl.appendChild(node);
      if (!reduceMotion()) this._confetti(node.querySelector('.confetti'), 44);
    },

    /* dispara a ação de um item (navega + dock + spotlight, ou abre link) */
    _startActivationItem: function (key) {
      var self = this;
      var item = this.activationItems().filter(function (i) { return i.key === key; })[0];
      if (!item) return;
      this._actDoing = key;
      if (item.action === 'sparkbot') {
        // destaca o botão do SparkBot na tela + instrução
        this.closeFullscreen();
        this._actDockSimple(item, this.ui().sparkbot_prompt);
        return;
      }
      if (item.action === 'fiverings') {
        // 2 sub-passos: extensão → portal. Abre a Web Store; o portal vem no "abrir portal".
        window.open(FIVERINGS_EXT_URL, '_blank', 'noopener');
        this.closeFullscreen();
        this._actDockFiveRings(item);
        return;
      }
      // redirect: navega pra tela e mostra dock com o spotlight + ação real
      this.closeFullscreen();
      this._actDockRedirect(item);
    },

    /* dock simples (SparkBot): instrução + abrir + já fiz */
    _actDockSimple: function (item, instruction) {
      var self = this, u = this.ui();
      this._removeDock(); this._removeFab();
      var dock = el('<div class="spark-dock">' +
        '<div class="spark-dock__bar">' +
          '<div class="spark-dock__ic">' + (I[item.icon] || I.sparkles) + '</div>' +
          '<div class="spark-dock__tx"><div class="spark-dock__title">' + esc(self.itemText(item.key, 't')) + '</div>' +
            '<div class="spark-dock__sub">' + esc(instruction || self.itemText(item.key, 'd')) + '</div></div>' +
          '<div class="spark-dock__actions">' +
            '<button class="btn btn--sm d-open">' + I.eye + esc(u.act_open) + '</button>' +
            '<button class="btn btn--sm btn--primary d-done">' + I.check + esc(u.act_mark_done) + '</button>' +
            '<button class="icon-btn d-back" aria-label="' + esc(u.dock_back) + '">' + I.x + '</button>' +
          '</div>' +
        '</div></div>');
      dock.querySelector('.d-open').onclick = function () {
        var b = document.querySelector('#hl_header--copilot-icon, button[aria-label*="SparkBot"], button[aria-label*="Ask AI"]');
        if (b) b.click();
        Coach.run([{ order: 1, selector_guesses: item.mark.selector_guesses, title_pt: self.itemText(item.key, 't'), title_en: self.itemText(item.key, 't'), description_pt: instruction, description_en: instruction }], self.lang, function () {});
      };
      dock.querySelector('.d-done').onclick = function () { self._completeActivation(item.key); };
      dock.querySelector('.d-back').onclick = function () { self.openFullscreen('activation'); };
      this.root.appendChild(dock); this._dock = dock;
      this._pollSignals();
    },

    _actDockFiveRings: function (item) {
      var self = this, u = this.ui();
      this._removeDock(); this._removeFab();
      var step2 = false;
      var dock = el('<div class="spark-dock">' +
        '<div class="spark-dock__bar">' +
          '<div class="spark-dock__ic">' + I.database + '</div>' +
          '<div class="spark-dock__tx"><div class="spark-dock__title">' + esc(self.itemText('fiverings', 't')) + '</div>' +
            '<div class="spark-dock__sub d-sub">' + esc(self.itemText('fiverings', 'd')) + '</div></div>' +
          '<div class="spark-dock__actions">' +
            '<button class="btn btn--sm d-next">' + I.externalLink + esc(u.it_fiverings_c2) + '</button>' +
            '<button class="btn btn--sm btn--primary d-done">' + I.check + esc(u.act_mark_done) + '</button>' +
            '<button class="icon-btn d-back" aria-label="' + esc(u.dock_back) + '">' + I.x + '</button>' +
          '</div>' +
        '</div></div>');
      dock.querySelector('.d-next').onclick = function () {
        window.open(FIVERINGS_PORTAL_URL, '_blank', 'noopener');
        dock.querySelector('.d-sub').textContent = u.it_fiverings_step2;
      };
      dock.querySelector('.d-done').onclick = function () { self._completeActivation('fiverings'); };
      dock.querySelector('.d-back').onclick = function () { self.openFullscreen('activation'); };
      this.root.appendChild(dock); this._dock = dock;
      void step2;
    },

    _actDockRedirect: function (item) {
      var self = this, u = this.ui();
      this._removeDock(); this._removeFab();
      // noSpotlight: alvo inalcançável (ex: QR do WhatsApp em iframe cross-origin do Stevo).
      // Navega pra tela e mostra só a instrução no dock — nunca um spotlight errado (Pedro 2026-06-22).
      var noSpot = !!item.noSpotlight || !(item.mark && item.mark.selector_guesses && item.mark.selector_guesses.length);
      var marks = noSpot ? [] : [{ order: 1, selector_guesses: item.mark.selector_guesses, title_pt: self.itemText(item.key, 't'), title_en: self.itemText(item.key, 't'), description_pt: self.itemText(item.key, 'd'), description_en: self.itemText(item.key, 'd') }];
      var sample = item.key === 'contact' ? u.it_contact_sample : '';
      var dockSub = noSpot ? (u['it_' + item.key + '_dock'] || self.itemText(item.key, 'd')) : u.dock_nav_hint;
      var dock = el('<div class="spark-dock">' +
        '<div class="spark-dock__bar">' +
          '<div class="spark-dock__ic">' + (I[item.icon] || I.sparkles) + '</div>' +
          '<div class="spark-dock__tx"><div class="spark-dock__title">' + esc(self.itemText(item.key, 't')) + '</div>' +
            '<div class="spark-dock__sub">' + esc(dockSub) + '</div></div>' +
          '<div class="spark-dock__actions">' +
            (noSpot ? '' : '<button class="btn btn--sm d-tour">' + I.eye + esc(u.dock_tour) + '</button>') +
            '<button class="btn btn--sm btn--primary d-done">' + I.check + esc(u.act_mark_done) + '</button>' +
            '<button class="icon-btn d-back" aria-label="' + esc(u.dock_back) + '">' + I.x + '</button>' +
          '</div>' +
        '</div>' +
        (sample ? '<div class="spark-dock__detail" style="display:block"><div class="practice-box"><div class="practice-box__head">' + I.sparkles + esc(u.dock_practice) + '</div><pre>' + esc(sample) + '</pre></div></div>' : '') +
      '</div>');
      var runTour = function () {
        Coach.run(marks, self.lang, function (status) {
          if (!document.body.contains(dock)) return;
          if (status === 'no_targets' || status === 'no_driver') {
            var sub = dock.querySelector('.spark-dock__sub'); if (sub) sub.textContent = u.dock_no_targets;
          }
        });
      };
      if (!noSpot) dock.querySelector('.d-tour').onclick = runTour;
      dock.querySelector('.d-done').onclick = function () { self._completeActivation(item.key); };
      dock.querySelector('.d-back').onclick = function () { Coach.stop(); self.openFullscreen('activation'); };
      this.root.appendChild(dock); this._dock = dock;
      if (item.path) {
        navigateTo(item.path);
        if (!noSpot) {
          waitForTargets(marks, 20000).then(function (found) {
            if (!document.body.contains(dock)) return;
            if (found) runTour();
            else { var sub = dock.querySelector('.spark-dock__sub'); if (sub) sub.textContent = u.dock_no_targets; }
          });
        }
      }
      this._pollSignals();
    },

    /* marca um item de ativação como feito (manual ou detecção) */
    _completeActivation: function (key) {
      this.actDone.add(key);
      this._actDoing = null;
      Coach.stop();
      this._burstAtBody();
      this.openFullscreen('activation');
      this.save({ wizard_state: { concept_seen: true, screen: 'activation', mode: 'fullscreen', activation: Array.from(this.actDone) } });
    },

    _burstAtBody: function () { /* micro-celebração no centro */
      if (reduceMotion()) return;
      this._confetti(this.sparkEl, 14);
    },

    /* polling dos sinais reais (RPC) — flipa whatsapp/sparkbot quando o evento acontece */
    _pollSignals: function () {
      var self = this;
      if (this._sigPoll) clearInterval(this._sigPoll);
      var check = function () {
        loadSignals(self.locId).then(function (sig) {
          if (!sig) return;
          var changed = false;
          if (sig.whatsapp_connected && !self.actDone.has('whatsapp')) { self.actDone.add('whatsapp'); changed = true; }
          if (changed) {
            // Fix bug auditoria 2026-06-22: o sinal (whatsapp/sparkbot) costuma chegar enquanto o rep
            // está no DOCK do item (host hidden). Antes só re-renderizava no fullscreen → o item não
            // marcava sozinho, contradizendo "eu confirmo aqui quando acontecer". Agora traz o checklist.
            var wasInActDock = self._actDoing != null && self.host.classList.contains('is-hidden');
            self._actDoing = null;
            self.save({ wizard_state: { concept_seen: true, screen: self.screen, mode: self.mode, activation: Array.from(self.actDone) } });
            if (self.screen === 'activation' && !self.host.classList.contains('is-hidden')) self.render();
            else if (wasInActDock) { self.openFullscreen('activation'); self._burstAtBody(); }
          }
        });
      };
      check();
      this._sigPoll = setInterval(check, 6000);
    },

    /* ---- WELCOME ---- */
    _renderWelcome: function () {
      var u = this.ui(), self = this;
      var planLabel = this.plan.toUpperCase();
      var node = el('<div class="welcome">' +
        '<div class="welcome__lang"></div>' +
        '<div class="welcome__inner">' +
          '<div class="spark-logo fade-up">' + I.spark + '</div>' +
          '<h1 class="welcome__title fade-up fade-up-1">' + esc(u.w_title) + '</h1>' +
          '<p class="welcome__sub fade-up fade-up-2">' + esc(u.w_sub) + '</p>' +
          '<div class="welcome__card fade-up fade-up-3">' +
            '<div class="welcome__row">' +
              '<div class="welcome__row-ic">' + I.clock + '</div>' +
              '<div class="welcome__row-tx"><b>' + esc(u.w_time) + '</b><span>' + esc(u.w_time_sub) + '</span></div>' +
            '</div>' +
            '<div class="welcome__row">' +
              '<div class="welcome__row-ic">' + I.checklist + '</div>' +
              '<div class="welcome__row-tx"><b>' + esc(u.w_items(this.activationItems().length, this.tourCount())) + '</b><span>' + esc(u.w_items_sub) + '</span></div>' +
            '</div>' +
            '<div class="welcome__row">' +
              '<div class="welcome__row-ic">' + I.sparkles + '</div>' +
              '<div class="welcome__row-tx" style="display:flex;align-items:center;justify-content:space-between;width:100%">' +
                '<span style="color:var(--text-muted);font-size:13px">' + esc(u.w_plan_sub) + '</span>' +
                '<span class="plan-badge plan-badge--' + this.plan + '">' + planLabel + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<button class="btn btn--primary btn--lg welcome__cta fade-up fade-up-4">' + esc(u.w_start) + I.arrowRight + '</button>' +
          '<button class="btn btn--text welcome__skip fade-up fade-up-4">' + esc(u.w_skip) + '</button>' +
        '</div></div>');
      node.querySelector('.welcome__lang').appendChild(this._langToggle());
      node.querySelector('.welcome__cta').onclick = function () {
        self.screen = 'wizard'; self.index = 0; self._dir = 'fwd'; self.render(); self.save();
      };
      node.querySelector('.welcome__skip').onclick = function () { self._dismiss(); };
      this.sparkEl.appendChild(node);
    },

    /* ---- WIZARD shell ---- */
    _renderWizard: function (animate) {
      var u = this.ui(), self = this;
      var step = this.steps[this.index];
      if (!step) { this.screen = 'done'; this.render(); return; }
      var planLabel = this.plan.toUpperCase();
      var pct = ((this.index + 1) / this.steps.length) * 100;
      var phase = step.step_phase === 'tour' ? u.phase_tour : u.phase_setup;
      var phaseCls = step.step_phase === 'tour' ? ' phase-chip--tour' : '';
      var phaseIcon = step.step_phase === 'tour' ? I.compass : I.checklist;

      var wiz = el('<div class="wiz">' +
        '<div class="wiz__progress"><div class="wiz__progress-fill" style="width:' + pct + '%"></div></div>' +
        '<header class="wiz__top">' +
          '<div class="wiz__brand"><span class="spark-logo">' + I.spark + '</span><span class="wiz__brand-tx">' + esc(u.config) + '</span></div>' +
          '<div class="wiz__lang"></div>' +
          '<div class="wiz__top-right">' +
            '<span class="phase-chip' + phaseCls + '">' + phaseIcon + esc(phase) + '</span>' +
            '<span class="wiz__counter"><b>' + (this.index + 1) + '</b> / ' + this.steps.length + '</span>' +
            '<span class="plan-badge plan-badge--' + this.plan + '">' + planLabel + '</span>' +
            '<button class="icon-btn wiz__close" aria-label="' + esc(u.close_aria) + '">' + I.x + '</button>' +
          '</div>' +
        '</header>' +
        '<main class="wiz__body"><div class="wiz__stage"></div></main>' +
        '<footer class="wiz__footer"><div class="wiz__footer-l"></div><div class="wiz__footer-c"></div><div class="wiz__footer-r"></div></footer>' +
      '</div>');

      wiz.querySelector('.wiz__lang').appendChild(this._langToggle());
      wiz.querySelector('.wiz__close').onclick = function () { self._requestExit(); };

      // shell do step
      var isInfoHero = step.step_type === 'info' && !this.isRedirect(step);
      var heroSize = isInfoHero ? 80 : 56;
      var title = this.t(step, 'title');
      var desc = this.t(step, 'description');
      var stepEl = el('<div class="step ' + (animate ? (this._dir === 'fwd' ? 'step-enter-fwd' : 'step-enter-back') : '') + '">' +
        '<div class="hero-ic hero-ic--' + heroSize + (step.step_phase === 'tour' ? ' hero-ic--gold' : '') + '">' + this.icon(step) + '</div>' +
        '<h1 class="step__title' + (heroSize === 80 ? ' step__title--lg' : '') + '">' + esc(title) + '</h1>' +
        (desc ? '<p class="step__desc' + (heroSize === 80 ? ' step__desc--lg' : '') + '">' + esc(desc) + '</p>' : '') +
        '<div class="step__action"></div>' +
      '</div>');
      wiz.querySelector('.wiz__stage').appendChild(stepEl);

      // footer
      var footL = wiz.querySelector('.wiz__footer-l');
      var footC = wiz.querySelector('.wiz__footer-c');
      var footR = wiz.querySelector('.wiz__footer-r');
      if (this.index > 0) {
        var back = el('<button class="btn btn--ghost">' + I.arrowLeft + esc(u.back) + '</button>');
        back.onclick = function () { self._go(-1); };
        footL.appendChild(back);
      }
      if (step.can_skip !== false) {
        var skip = el('<button class="btn btn--text">' + esc(u.skip_step) + '</button>');
        skip.onclick = function () {
          self.skipped.add(step.id); self.completed.delete(step.id); self._go(1);
        };
        footC.appendChild(skip);
      }
      var isLast = this.index === this.steps.length - 1;
      var ctaLabel = this.t(step, 'cta_label') || (isLast ? u.finish : u.next);
      var primary = el('<button class="btn btn--primary btn--lg">' + esc(ctaLabel) + I.arrowRight + '</button>');
      footR.appendChild(primary);

      // mount por tipo
      var ctx = {
        engine: this, step: step, stepEl: stepEl,
        root: stepEl.querySelector('.step__action'),
        primaryBtn: primary, u: u,
      };
      var advance = function () {
        self.completed.add(step.id); self.skipped.delete(step.id);
        self._burstAt(primary);
        self._go(1);
      };
      primary.onclick = function () {
        if (ctx._beforeNext && !ctx._beforeNext()) return;
        if (self.isRedirect(step)) { self.enterDock(step); return; }
        advance();
      };
      this._mountStep(ctx);

      this.sparkEl.appendChild(wiz);
      requestAnimationFrame(function () {
        var fill = wiz.querySelector('.wiz__progress-fill');
        if (fill) fill.classList.add('is-pulsing');
      });
    },

    /* ---- builders por step ---- */
    _mountStep: function (ctx) {
      var step = ctx.step;
      if (step.id === 'ob-st-3a') return this._mountQr(ctx);
      if (step.id === 'tour-community') return this._mountCommunityQr(ctx);
      if (step.id === 'ob-gr-2') return this._mountExamples(ctx);
      if (step.step_type === 'action') return this._mountAction(ctx);
      if (this.isRedirect(step)) return this._mountRedirectIntro(ctx);
      /* info simples: sem corpo extra */
    },

    /* QR único centralizado (comunidade) — preto no branco */
    _mountCommunityQr: function (ctx) {
      var src = 'https://api.qrserver.com/v1/create-qr-code/?size=312x312&margin=0&color=0B0B0F&bgcolor=FFFFFF&data=' + encodeURIComponent(COMMUNITY_URL);
      var openLabel = this.lang === 'en' ? 'Open link' : 'Abrir link';
      ctx.root.appendChild(el('<div class="qr-grid qr-grid--one">' +
        '<div class="qr-card community-qr">' +
          '<div class="qr-card__label">' + I.sparkles + ' Spark</div>' +
          '<div class="qr-card__img"><img alt="QR comunidade Spark" loading="lazy" src="' + src + '"></div>' +
          '<a class="btn btn--sm" href="' + COMMUNITY_URL + '" target="_blank" rel="noopener">' + I.externalLink + esc(openLabel) + '</a>' +
        '</div>' +
      '</div>'));
    },

    /* preview "o que você vai ver" + practice box */
    _mountRedirectIntro: function (ctx) {
      var self = this, step = ctx.step;
      var marks = (step.coach_marks || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      if (marks.length) {
        var prev = el('<div class="marks-preview"></div>');
        marks.forEach(function (mk, i) {
          prev.appendChild(el('<div class="marks-preview__row">' +
            '<div class="marks-preview__n">' + (i + 1) + '</div>' +
            '<div class="marks-preview__tx"><b>' + esc(self.tMark(mk, 'title')) + '</b>' +
            '<span>' + esc(self.tMark(mk, 'description')) + '</span></div>' +
          '</div>'));
        });
        ctx.root.appendChild(prev);
      }
      this._appendPractice(ctx.root, step);
    },

    _appendPractice: function (parent, step) {
      var pa = step.practice_action;
      if (!pa) return;
      var u = this.ui();
      var desc = this.lang === 'en' ? (pa.description_en || pa.description_pt) : (pa.description_pt || pa.description_en);
      var sample = this.lang === 'en' ? (pa.sample_data_en || pa.sample_data_pt) : (pa.sample_data_pt || pa.sample_data_en);
      if (!desc) return;
      parent.appendChild(el('<div class="practice-box">' +
        '<div class="practice-box__head">' + I.sparkles + esc(u.dock_practice) + '</div>' +
        '<p>' + esc(desc) + '</p>' +
        (sample ? '<pre>' + esc(sample) + '</pre>' : '') +
      '</div>'));
    },

    /* QR codes do app móvel — preto no branco (padrão do guia) */
    _mountQr: function (ctx) {
      var qr = function (data) {
        return 'https://api.qrserver.com/v1/create-qr-code/?size=312x312&margin=0&color=0B0B0F&bgcolor=FFFFFF&data=' + encodeURIComponent(data);
      };
      var openLabel = this.lang === 'en' ? 'Open link' : 'Abrir link';
      ctx.root.appendChild(el('<div class="qr-grid">' +
        '<div class="qr-card">' +
          '<div class="qr-card__label">' + I.apple + ' iPhone</div>' +
          '<div class="qr-card__img"><img alt="QR App Store" loading="lazy" src="' + qr(APPSTORE_URL) + '"></div>' +
          '<a class="btn btn--sm" href="' + APPSTORE_URL + '" target="_blank" rel="noopener">' + I.externalLink + 'App Store</a>' +
        '</div>' +
        '<div class="qr-card">' +
          '<div class="qr-card__label">' + I.android + ' Android</div>' +
          '<div class="qr-card__img"><img alt="QR Play Store" loading="lazy" src="' + qr(PLAYSTORE_URL) + '"></div>' +
          '<a class="btn btn--sm" href="' + PLAYSTORE_URL + '" target="_blank" rel="noopener">' + I.externalLink + 'Play Store</a>' +
        '</div>' +
      '</div>'));
      void openLabel;
    },

    /* exemplos SparkBot (ob-gr-2): coach_marks viram cards */
    _mountExamples: function (ctx) {
      var self = this;
      var list = el('<div class="auto-list" style="margin-top:4px"></div>');
      (ctx.step.coach_marks || []).forEach(function (mk) {
        list.appendChild(el('<div class="auto-row">' +
          '<div class="auto-row__ic">' + I.bot + '</div>' +
          '<div class="auto-row__tx"><b>' + esc(self.tMark(mk, 'title')) + '</b><span>' + esc(self.tMark(mk, 'description')) + '</span></div>' +
        '</div>'));
      });
      ctx.root.appendChild(list);
    },

    /* ativação SparkBot (ob-gr-1) — visual progressivo.
       TODO V2: chamar ativação real (registro agent_id) no backend. */
    _mountAction: function (ctx) {
      var self = this;
      var procs = this.lang === 'en'
        ? ['Registering agent_id…', 'Configuring WhatsApp + SMS channels…', 'Validating webhook receiver…', 'Training the bot on your funnel…']
        : ['Registrando agent_id…', 'Configurando canais WhatsApp + SMS…', 'Validando webhook receiver…', 'Treinando o bot com o seu funil…'];
      var list = el('<div class="proc-list"></div>');
      var rows = procs.map(function (p) {
        var r = el('<div class="proc-row"><div class="proc-row__tx">' + esc(p) + '</div><div class="proc-row__ind"></div></div>');
        list.appendChild(r);
        return r;
      });
      ctx.root.appendChild(list);
      var dots = '<span class="dots"><span></span><span></span><span></span></span>';
      var check = '<svg class="check-draw is-drawn" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11"/><path d="M7 12.5l3.2 3.2L17 9"/></svg>';
      if (this.completed.has(ctx.step.id)) {
        // já ativado — não replay da animação nem trava o botão
        rows.forEach(function (r) { r.classList.add('is-done'); r.querySelector('.proc-row__ind').innerHTML = check; });
        return;
      }
      ctx.primaryBtn.disabled = true;
      var i = 0;
      var run = function () {
        if (!document.body.contains(list)) return;
        if (i >= rows.length) {
          ctx.primaryBtn.disabled = false;
          self._burstAt(ctx.primaryBtn, '#10b981');
          return;
        }
        var r = rows[i];
        r.classList.add('is-active');
        r.querySelector('.proc-row__ind').innerHTML = dots;
        setTimeout(function () {
          r.classList.remove('is-active'); r.classList.add('is-done');
          r.querySelector('.proc-row__ind').innerHTML = check;
          self._burstAt(r.querySelector('.proc-row__ind'));
          i++; run();
        }, 850 + Math.random() * 400);
      };
      setTimeout(run, 400);
    },

    /* ---- navegação entre steps ---- */
    _go: function (delta) {
      var next = this.index + delta;
      this._dir = delta > 0 ? 'fwd' : 'back';
      if (next < 0) { this.screen = 'welcome'; this.render(); this.save(); return; }
      if (next >= this.steps.length) { this.screen = 'done'; this.render(); this.save(); return; }
      var self = this;
      var token = ++this._navToken; // cliques rápidos: só a última navegação aplica
      var cur = this.sparkEl.querySelector('.step');
      var wiz = this.sparkEl.querySelector('.wiz');
      if (cur && wiz && !reduceMotion() && document.visibilityState !== 'hidden') {
        cur.classList.remove('step-enter-fwd', 'step-enter-back');
        cur.classList.add(this._dir === 'fwd' ? 'step-exit-fwd' : 'step-exit-back');
        var pct = ((next + 1) / this.steps.length) * 100;
        var fill = wiz.querySelector('.wiz__progress-fill');
        if (fill) { fill.style.width = pct + '%'; fill.classList.add('is-pulsing'); }
        setTimeout(function () {
          if (token !== self._navToken) return;
          self.index = next; self.render(); self.save();
        }, 190);
      } else {
        this.index = next; this.render(); this.save();
      }
    },

    /* ====================================================
       DOCK — modo navegação no GHL
       ==================================================== */
    enterDock: function (step) {
      var i = this.steps.indexOf(step);
      if (i < 0) return; // step fora da lista filtrada por plano — não entra em estado inválido (idx -1)
      this.mode = 'dock';
      this.index = i;
      this.closeFullscreen();
      this.save(); // antes do navigate — fallback full-reload abortaria o PATCH
      this._renderDock(step, { navigate: true });
    },

    _renderDock: function (step, opts) {
      opts = opts || {};
      var self = this, u = this.ui();
      this._removeDock();
      this._removeFab();

      var idx = this.steps.indexOf(step);
      var pct = ((idx + 1) / this.steps.length) * 100;
      var desc = this.t(step, 'description');
      var marks = (step.coach_marks || []);
      // só fazem spotlight ao vivo os marks COM seletor. Marks sem seletor (telas de config/conversas
      // não-mapeadas) viram instrução-only: navega + mostra a descrição, sem "Ver na tela" nem timeout 20s.
      var liveMarks = marks.filter(function (m) { return (m.selector_guesses || []).length; });
      var hasPractice = !!step.practice_action;
      // resume sem navigate (ou navigate sem spotlight): mostra a descrição, não "te levei pra tela certa"
      var subTxt = (opts.navigate && liveMarks.length) ? u.dock_nav_hint : (desc || u.dock_nav_hint);

      var dock = el('<div class="spark-dock">' +
        '<div class="spark-dock__progress"><i style="width:' + pct + '%"></i></div>' +
        '<div class="spark-dock__bar">' +
          '<div class="spark-dock__ic">' + this.icon(step) + '</div>' +
          '<div class="spark-dock__tx">' +
            '<div class="spark-dock__title">' + esc(this.t(step, 'title')) + '<span class="spark-dock__count">' + (idx + 1) + '/' + this.steps.length + '</span></div>' +
            '<div class="spark-dock__sub">' + esc(subTxt) + '</div>' +
          '</div>' +
          '<div class="spark-dock__actions">' +
            ((desc || hasPractice) ? '<button class="icon-btn d-expand" aria-label="' + esc(u.dock_expand_aria) + '">' + I.chevronUp + '</button>' : '') +
            (liveMarks.length ? '<button class="btn btn--sm d-tour">' + I.eye + esc(u.dock_tour) + '</button>' : '') +
            '<button class="btn btn--sm btn--primary d-done">' + I.check + esc(u.dock_done) + '</button>' +
            '<button class="icon-btn d-min" aria-label="' + esc(u.dock_min_aria) + '">' + I.minus + '</button>' +
            '<button class="icon-btn d-wizard" aria-label="' + esc(u.dock_back) + '" title="' + esc(u.dock_back) + '">' + I.arrowLeft + '</button>' +
            '<button class="icon-btn d-close" aria-label="' + esc(u.close_aria) + '" title="' + esc(u.close_aria) + '">' + I.x + '</button>' +
            '<button class="btn btn--sm btn--primary spark-dock__restore" style="display:none">' + I.rocket + esc(u.dock_resume) + '</button>' +
            '<button class="btn btn--sm spark-dock__stop" style="display:none">' + esc(u.dock_stop) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="spark-dock__detail">' +
          (desc ? '<p>' + esc(desc) + '</p>' : '') +
        '</div>' +
      '</div>');

      // practice no detail
      this._appendPractice(dock.querySelector('.spark-dock__detail'), step);

      var setState = function (st) {
        dock.classList.remove('is-driving', 'is-min', 'is-expanded');
        dock.querySelector('.spark-dock__restore').style.display = 'none';
        dock.querySelector('.spark-dock__stop').style.display = 'none';
        if (st === 'driving') { dock.classList.add('is-driving'); dock.querySelector('.spark-dock__stop').style.display = ''; }
        if (st === 'min') { dock.classList.add('is-min'); dock.querySelector('.spark-dock__restore').style.display = ''; }
        if (st === 'expanded') dock.classList.add('is-expanded');
      };

      var runTour = function () {
        setState('driving');
        Coach.run(liveMarks, self.lang, function (status) {
          if (!document.body.contains(dock)) return;
          setState(hasPractice ? 'expanded' : 'default');
          if (status === 'no_targets' || status === 'no_driver') {
            var sub = dock.querySelector('.spark-dock__sub');
            if (sub) sub.textContent = u.dock_no_targets;
            setState('expanded');
          }
        });
      };

      var expandBtn = dock.querySelector('.d-expand');
      if (expandBtn) expandBtn.onclick = function () {
        dock.classList.toggle('is-expanded');
      };
      var tourBtn = dock.querySelector('.d-tour');
      if (tourBtn) tourBtn.onclick = runTour;
      dock.querySelector('.d-done').onclick = function () {
        Coach.stop();
        self.completed.add(step.id); self.skipped.delete(step.id);
        self._nextFromDock(step);
      };
      dock.querySelector('.d-min').onclick = function () { setState('min'); };
      dock.querySelector('.spark-dock__restore').onclick = function () { setState('default'); };
      dock.querySelector('.spark-dock__stop').onclick = function () { Coach.stop(); };
      dock.querySelector('.d-wizard').onclick = function () {
        Coach.stop();
        self.openFullscreen('wizard');
      };
      dock.querySelector('.d-close').onclick = function () {
        // dispensa o dock — FAB fica pra retomar; reload não restaura dock
        Coach.stop();
        self.mode = 'fullscreen';
        self._removeDock();
        self.save();
        self._mountFab();
      };

      this.root.appendChild(dock);
      this._dock = dock;

      if (opts.navigate && step.ghl_path) {
        navigateTo(step.ghl_path);
        if (liveMarks.length) {
          waitForTargets(liveMarks, 20000).then(function (found) {
            if (!document.body.contains(dock)) return;
            if (found) runTour();
            else {
              var sub = dock.querySelector('.spark-dock__sub');
              if (sub) sub.textContent = u.dock_no_targets;
              setState('expanded');
            }
          });
        } else if (desc || hasPractice) {
          // instrução-only: abre o detalhe pra a orientação ficar visível sem clique
          setState('expanded');
        }
      }
    },

    _nextFromDock: function (step) {
      var idx = this.steps.indexOf(step);
      var next = this.steps[idx + 1];
      this.index = Math.min(idx + 1, this.steps.length - 1);
      if (!next) {
        this.screen = 'done';
        this.openFullscreen('done');
        return;
      }
      if (this.isRedirect(next)) {
        // continua no dock, atualiza in place + navega
        this.save(); // antes do navigate
        this._renderDock(next, { navigate: true });
      } else {
        this.screen = 'wizard';
        this.openFullscreen('wizard');
      }
    },

    _removeDock: function () {
      if (this._dock) { this._dock.remove(); this._dock = null; }
    },

    /* ====================================================
       DONE
       ==================================================== */
    _renderDone: function () {
      var u = this.ui(), self = this;
      var doneN = this.completed.size, skipN = this.skipped.size;
      var items = this.steps.map(function (s) {
        var done = self.completed.has(s.id);
        var skip = self.skipped.has(s.id);
        if (!done && !skip) return '';
        return '<li class="' + (skip ? 'skipped' : '') + '">' +
          (skip ? I.chevronRight : '<span style="color:var(--success)">' + I.check + '</span>') +
          esc(self.t(s, 'title')) +
          (skip ? ' <span style="font-size:11px;color:var(--text-subtle)">· ' + esc(u.skipped_label) + '</span>' : '') +
        '</li>';
      }).join('');

      var node = el('<div class="done-screen">' +
        '<div class="confetti"></div>' +
        '<div class="done-screen__inner">' +
          '<div class="hero-ic hero-ic--80 hero-ic--success fade-up">' + I.checkCircle + '</div>' +
          '<h1 class="welcome__title fade-up fade-up-1">' + esc(u.c_title) + ' <span style="font-size:0.9em">🎉</span></h1>' +
          '<p class="welcome__sub fade-up fade-up-2">' + esc(u.c_sub) + '</p>' +
          '<div class="done-summary fade-up fade-up-3">' +
            '<div class="done-summary__head">' +
              '<div class="done-stat"><div class="done-stat__n done-stat__n--ok">' + doneN + '</div><div class="done-stat__l">' + esc(u.c_done_label) + '</div></div>' +
              (skipN > 0 ? '<div class="done-stat"><div class="done-stat__n done-stat__n--skip">' + skipN + '</div><div class="done-stat__l">' + esc(u.c_skip_label) + '</div></div>' : '') +
            '</div>' +
            '<details class="done-disclosure">' +
              '<summary><span class="chev">' + I.chevronRight + '</span>' + esc(u.c_summary) + '</summary>' +
              '<ul>' + items + '</ul>' +
            '</details>' +
          '</div>' +
          '<button class="btn btn--primary btn--lg done-cta fade-up fade-up-4">' + esc(u.c_dashboard) + I.arrowRight + '</button>' +
          '<button class="btn btn--text done-secondary fade-up fade-up-4">' + esc(u.c_review) + '</button>' +
        '</div></div>');

      node.querySelector('.done-cta').onclick = function () { self._complete(); };
      node.querySelector('.done-secondary').onclick = function () {
        self.screen = 'wizard'; self.index = 0; self.render(); self.save();
      };
      this.sparkEl.appendChild(node);
      if (!reduceMotion()) this._confetti(node.querySelector('.confetti'), 44);
    },

    _complete: function () {
      this.save({ completed_at: new Date().toISOString() });
      Coach.stop();
      this._stopLauncher(); // finalizou: some o launcher da topbar + mata o interval (Pedro 2026-06-22)
      if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
      if (this.root) { this.root.remove(); this.root = null; } // watchdog checa engine.root — sem null o done screen ressuscita a cada 2.5s
      engine = null;
    },

    /* dismiss (welcome skip / modal leave): some, FAB fica */
    _dismiss: function () {
      this.screen = 'wizard';
      this.mode = 'fullscreen';
      this.closeFullscreen();
      this._removeDock();
      this.save();
      this._mountFab();
    },

    /* ====================================================
       FAB
       ==================================================== */
    /* Launcher minimizado: injetado na TOPBAR do GHL (.hl_header--controls), não bottom-right.
       Pedro 2026-06-22. Padrão do spark-zoom: persistência via routeChangeEvent + interval (SPA re-render). */
    _mountFab: function () {
      if (this.pendingCount() === 0) { this._removeFab(); return; }
      this._launcherWant = true;
      this._injectLauncher();
      if (!this._launcherTick) {
        var self = this;
        this._launcherTick = setInterval(function () { if (self._launcherWant) self._injectLauncher(); }, 1000);
        this._launcherOnRoute = function () { if (self._launcherWant) setTimeout(function () { self._injectLauncher(); }, 200); };
        window.addEventListener('routeChangeEvent', this._launcherOnRoute);
      }
    },
    _injectLauncher: function () {
      var self = this, u = this.ui();
      var controls = document.querySelector('.hl_header--controls');
      var existing = document.getElementById('spark-onb-topbtn');
      var pend = this.pendingCount();
      if (!this._launcherWant || pend === 0 || !controls) { if (existing) existing.remove(); return; }
      if (existing && existing.parentElement === controls) {
        var b = existing.querySelector('.spark-onb-topbtn__badge'); if (b) b.textContent = pend; return;
      }
      if (existing) existing.remove();
      var btn = el('<button id="spark-onb-topbtn" class="spark-onb-topbtn" title="' + esc(u.fab_aria) + '" aria-label="' + esc(u.fab_aria) + '">' + I.rocket +
        '<span class="spark-onb-topbtn__badge">' + pend + '</span></button>');
      btn.onclick = function () {
        var target = self.screen === 'done' ? 'done' : (!self.actAllDone() ? 'activation' : 'wizard');
        self.openFullscreen(target);
      };
      controls.insertBefore(btn, controls.firstChild);
      this._fab = btn;
    },
    _removeFab: function () {
      // esconde o launcher (ex: onboarding aberto) mas mantém o tick vivo pra reaparecer ao minimizar
      this._launcherWant = false;
      var existing = document.getElementById('spark-onb-topbtn');
      if (existing) existing.remove();
      this._fab = null;
    },
    _stopLauncher: function () {
      // remove de vez (finalizou / destroy): some o launcher e mata o interval
      this._launcherWant = false;
      if (this._launcherTick) { clearInterval(this._launcherTick); this._launcherTick = null; }
      if (this._launcherOnRoute) { window.removeEventListener('routeChangeEvent', this._launcherOnRoute); this._launcherOnRoute = null; }
      var existing = document.getElementById('spark-onb-topbtn');
      if (existing) existing.remove();
      this._fab = null;
    },

    /* ====================================================
       Lang toggle / close modal / efeitos
       ==================================================== */
    _langToggle: function () {
      var self = this;
      var wrap = el('<div class="lang" role="group" aria-label="Language">' +
        '<button data-l="pt" class="' + (this.lang === 'pt' ? 'is-on' : '') + '">🇧🇷 PT</button>' +
        '<button data-l="en" class="' + (this.lang === 'en' ? 'is-on' : '') + '">🇺🇸 EN</button></div>');
      wrap.querySelectorAll('button').forEach(function (b) {
        b.onclick = function () {
          if (self.lang !== b.dataset.l) {
            self.lang = b.dataset.l;
            self.render(false);
            self.save();
          }
        };
      });
      return wrap;
    },

    _requestExit: function () {
      if (this.pendingCount() === 0) { this._complete(); return; }
      this._showCloseModal();
    },

    _showCloseModal: function () {
      var u = this.ui(), self = this;
      var overlay = el('<div class="overlay">' +
        '<div class="modal" role="dialog" aria-modal="true">' +
          '<div class="modal__ic">' + I.rocket + '</div>' +
          '<h2 class="modal__title">' + esc(u.m_title) + '</h2>' +
          '<p class="modal__desc">' + esc(u.m_desc) + '</p>' +
          '<div class="modal__actions">' +
            '<button class="btn btn--primary btn--lg m-continue">' + esc(u.m_continue) + '</button>' +
            '<button class="btn btn--ghost m-leave">' + esc(u.m_leave) + '</button>' +
          '</div></div></div>');
      var onKey = function (e) { if (e.key === 'Escape') close(); };
      var close = function () { overlay.remove(); document.removeEventListener('keydown', onKey); };
      overlay.querySelector('.m-continue').onclick = close;
      overlay.querySelector('.m-leave').onclick = function () { close(); self._dismiss(); };
      overlay.onclick = function (e) { if (e.target === overlay) close(); };
      document.addEventListener('keydown', onKey);
      this.sparkEl.appendChild(overlay);
      overlay.querySelector('.m-continue').focus();
    },

    _confetti: function (layer, n) {
      var colors = ['#3b82f6', '#60a5fa', '#f5b731', '#e5a320', '#10b981'];
      var host = layer.classList && layer.classList.contains('confetti') ? layer : (function () {
        var c = el('<div class="confetti"></div>');
        layer.appendChild(c);
        return c;
      })();
      for (var i = 0; i < n; i++) {
        var p = document.createElement('i');
        p.style.left = (Math.random() * 100) + '%';
        p.style.background = colors[i % colors.length];
        p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
        p.style.setProperty('--dy', (window.innerHeight * 0.9 + Math.random() * 200) + 'px');
        p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
        p.style.setProperty('--dur', (1.6 + Math.random() * 1.2) + 's');
        p.style.animationDelay = (Math.random() * 0.4) + 's';
        if (i % 3 === 0) p.style.borderRadius = '50%';
        host.appendChild(p);
      }
      setTimeout(function () { clear(host); }, 3400);
    },

    _burstAt: function (node, color) {
      if (reduceMotion() || !node || !document.body.contains(node)) return;
      var r = node.getBoundingClientRect();
      var hostR = this.sparkEl.getBoundingClientRect();
      var x = r.left - hostR.left + r.width / 2;
      var y = r.top - hostR.top + r.height / 2;
      var layer = el('<div class="burst" style="left:' + x + 'px;top:' + y + 'px"></div>');
      for (var i = 0; i < 7; i++) {
        var ang = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
        var dist = 22 + Math.random() * 16;
        var p = document.createElement('i');
        if (color) p.style.background = color;
        p.style.setProperty('--bx', Math.cos(ang) * dist + 'px');
        p.style.setProperty('--by', Math.sin(ang) * dist + 'px');
        layer.appendChild(p);
      }
      this.sparkEl.appendChild(layer);
      setTimeout(function () { layer.remove(); }, 750);
    },

    /* ---- boot do estado restaurado ---- */
    resume: function () {
      var ws_active = null;
      var self = this;
      if (this.mode === 'dock') {
        var stepId = (function () {
          var s = self.steps[self.index];
          return s ? s.id : null;
        })();
        ws_active = this.steps.filter(function (s) { return s.id === stepId; })[0];
      }
      if (this.mode === 'dock' && ws_active && this._activeResolved && !this.completed.has(ws_active.id)) {
        // user estava no meio de um step no GHL — restaura dock sem navegar
        this._renderDock(ws_active, { navigate: false });
      } else if (!this.everOpened) {
        // primeira visita: abre a ATIVAÇÃO direto. Sem tela de conceito isolada (Pedro 2026-06-21):
        // o modelo mental (contato → SparkBot → funil) vai tecido no início do tour (tour-intro).
        this.openFullscreen('activation');
      } else if (this.screen === 'activation' && !this.actAllDone()) {
        // estava na ativação e ainda falta item: reabre o checklist (detecção continua via poll)
        this.mode = 'fullscreen';
        this._mountFab();
        this._pollSignals();
      } else {
        // visitas seguintes: só FAB
        this.mode = 'fullscreen';
        this._mountFab();
      }
    },

    destroy: function () {
      Coach.stop();
      this._stopLauncher();
      if (this._sigPoll) { clearInterval(this._sigPoll); this._sigPoll = null; }
      if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
      if (this.root) { this.root.remove(); this.root = null; }
    },
  };

  /* ── Bootstrap ──────────────────────────────────────────── */
  var engine = null;
  var bootedFor = null;

  function injectCss() {
    // check exato (?v=2) — link v1 de cache antigo não conta
    if (document.querySelector('link[href="' + CSS_URL + '"]')) return;
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = CSS_URL;
    document.head.appendChild(css);
  }

  /* Data de criação da sub-conta GHL, lida do Vue store (currentLocation.date_added é um
     Firestore Timestamp). Pedro 2026-06-23: widget só aparece se a conta tem < 30 dias.
     Retorna ms ou null se indisponível (store ainda não carregou / conta sem data). */
  function getAccountCreatedMs() {
    try {
      var app = document.getElementById('app');
      var gp = app && app.__vue_app__ && app.__vue_app__.config.globalProperties;
      var s = gp && gp.$store && gp.$store.state;
      var cur = s && s.locations && s.locations.currentLocation;
      var d = cur && cur.date_added;
      if (d == null) return null;
      if (typeof d === 'number') return d > 1e12 ? d : d * 1000;            // ms ou segundos
      if (typeof d.toMillis === 'function') return d.toMillis();             // Firestore Timestamp
      if (d.seconds != null) return d.seconds * 1000 + (d.nanoseconds ? Math.floor(d.nanoseconds / 1e6) : 0);
      if (typeof d.toJSDate === 'function') return d.toJSDate().getTime();   // Luxon
      var t = new Date(d).getTime();
      return isNaN(t) ? null : t;
    } catch (e) { return null; }
  }
  var ONB_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

  // Plano SaaS da sub-conta, lido do Vue store do GHL (mesma fonte que o cron usa via API:
  // settings.saas_settings.stripe_plan_details.price_id). Mapa priceId -> plano. Mantido em
  // sincronia com o edge function onboarding-provision (PLAN_BY_PRICE). Pedro 2026-06-23.
  var PLAN_BY_PRICE = {
    '6a0cbc6f9f3f184b2c6ba66a': 'growth',
    '6a0cbb5dd9543ee3671cb432': 'starter',
    '6a0cbce993431a096dbde01e': 'agency',
  };
  // Retorna 'starter'|'growth'|'agency' se a conta tem SaaS ATIVO e plano mapeado; senão null
  // (sem SaaS / Stripe legado / plano novo ainda não mapeado = não auto-provisiona).
  function getAccountPlan() {
    try {
      var app = document.getElementById('app');
      var gp = app && app.__vue_app__ && app.__vue_app__.config.globalProperties;
      var s = gp && gp.$store && gp.$store.state;
      var cur = s && s.locations && s.locations.currentLocation;
      var ss = cur && cur.settings && cur.settings.saas_settings;
      if (!ss || ss.saas_mode !== 'activated') return null;
      var spd = ss.stripe_plan_details;
      if (!spd || spd.subscription_status !== 'active' || !spd.price_id) return null;
      return PLAN_BY_PRICE[spd.price_id] || null;
    } catch (e) { return null; }
  }

  function boot() {
    var locId = getLocationId();
    if (!locId || locId === bootedFor) return;
    bootedFor = locId;
    if (engine) { engine.destroy(); engine = null; }

    Promise.all([loadProgress(locId), loadSteps()]).then(function (res) {
      if (getLocationId() !== locId) return; // user trocou de location durante o fetch
      var progress = res[0], steps = res[1];
      if (!steps || !steps.length) return;

      // Regra de visibilidade por idade (Pedro 2026-06-23): conta > 30 dias = esconde.
      // Data do GHL (live); fallback no account_created_at salvo. Idade desconhecida = não esconde.
      var createdMs = getAccountCreatedMs();
      if (createdMs == null && progress && progress.account_created_at) createdMs = new Date(progress.account_created_at).getTime();
      if (createdMs != null && (Date.now() - createdMs) > ONB_MAX_AGE_MS) return; // > 30 dias

      // Self-provision no 1o login (Pedro 2026-06-23): conta < 30 dias com SaaS ATIVO ganha o
      // widget NA HORA, sem esperar o cron diário. Plano lido do store do GHL. Idempotente:
      // UNIQUE(location_id) + o cron é a autoridade que corrige/backfilla depois.
      if (!progress) {
        var newPlan = getAccountPlan();
        if (createdMs == null || newPlan == null) return; // idade desconhecida ou sem plano mapeado = sem widget
        progress = { location_id: locId, plan: newPlan, lang: 'pt', current_step: 0,
                     account_created_at: new Date(createdMs).toISOString() };
        sbInsert(PROGRESS_DB, 'onboarding_progress?on_conflict=location_id', progress); // fire-and-forget
      }
      if (progress.completed_at) return;     // já concluiu

      // backfill: guarda a data de criação no row (registro) se ainda não tem
      if (createdMs != null && !progress.account_created_at) {
        try { sbPatch(PROGRESS_DB, 'onboarding_progress?location_id=eq.' + encodeURIComponent(locId), { account_created_at: new Date(createdMs).toISOString() }); } catch (e) {}
      }

      injectCss();
      engine = new Engine(locId, progress, steps);
      engine.resume();
    }).catch(function (e) {
      console.warn('[SparkOnb] boot fail', e);
      bootedFor = null; // fetch transitório falhou — watchdog tenta de novo
    });
  }

  function init() {
    setTimeout(boot, 3000);
    // watchdog: troca de location no SPA + revive elementos + esconde fora de location
    setInterval(function () {
      var locId = getLocationId();
      if (locId && locId !== bootedFor) { boot(); return; }
      if (engine && engine.root) {
        // rota sem location (agency view etc): esconde; volta quando re-entrar
        engine.root.style.display = locId ? '' : 'none';
        if (!document.body.contains(engine.root)) document.body.appendChild(engine.root);
      }
    }, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
