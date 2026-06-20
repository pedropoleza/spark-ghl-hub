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
  var WIDGET_BASE = 'https://dist-iota-one-53.vercel.app';
  var CSS_URL = WIDGET_BASE + '/spark-onboarding.css?v=2';
  var DRIVER_JS = 'https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.js.iife.js';
  var DRIVER_CSS = 'https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.css';
  var APPSTORE_URL = 'https://apps.apple.com/us/app/lead-connector/id1564302502';
  var PLAYSTORE_URL = 'https://play.google.com/store/apps/details?id=com.gohighlevel.leadconnector';
  var ONBOARDING_LINK = 'https://link.exemplo.com'; // TODO Pedro: link real de agendamento 1:1
  var STEPS_CACHE_KEY = 'sparkOnbV2:steps:2'; // bump do sufixo invalida cache em deploy
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
    spark: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.4 3.2 1.8 4.6 5 5-3.2.4-4.6 1.8-5 5-.4-3.2-1.8-4.6-5-5 3.2-.4 4.6-1.8 5-5Z"/><path d="M18.5 13c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z"/></svg>',
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
    'tour-conversations-middle': 'message', 'tour-conversations-webphones': 'phone',
    'tour-conversations-right': 'checklist', 'tour-dashboard': 'chart', 'tour-finalization': 'rocket',
  };

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
      w_items: function (s, t) { return s + ' configurações + ' + t + ' telas de tour'; },
      w_items_sub: 'Passo a passo, no seu ritmo',
      w_plan_sub: 'Seu plano',
      w_start: 'Começar', w_skip: 'Deixar pra depois',
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
      dock_no_targets: 'Não achei os elementos nessa tela — siga as instruções e marque feito quando terminar.',
      dock_nav_hint: 'Te levei pra tela certa. Siga os destaques!',
      transition_done: 'Setup completo!',
      schedule_btn: 'Agendar onboarding 1:1',
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
      w_items: function (s, t) { return s + ' setup items + ' + t + ' tour screens'; },
      w_items_sub: 'Step by step, at your pace',
      w_plan_sub: 'Your plan',
      w_start: 'Get started', w_skip: 'Maybe later',
      c_title: 'Done — your account is all set!',
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
      dock_no_targets: 'Couldn’t find the elements on this screen — follow the instructions and mark done when finished.',
      dock_nav_hint: 'I brought you to the right screen. Follow the highlights!',
      transition_done: 'Setup complete!',
      schedule_btn: 'Book 1:1 onboarding',
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
     achou o primeiro → segura +900ms pra página hidratar (evita tour parcial) */
  function waitForTargets(marks, timeoutMs) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function poll() {
        for (var i = 0; i < (marks || []).length; i++) {
          if (Coach.resolveMark(marks[i])) {
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
    this._dir = 'fwd';
    this._navToken = 0;
    var rank = PLAN_RANK[this.plan] != null ? PLAN_RANK[this.plan] : 0;
    this.steps = allSteps.filter(function (s) { return (PLAN_RANK[s.plan_min] || 0) <= rank; });
    // resume por id (não por índice) — lista de steps pode mudar no DB entre sessões
    if (ws.active_step) {
      for (var i = 0; i < this.steps.length; i++) {
        if (this.steps[i].id === ws.active_step) { this.index = i; break; }
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
      return Math.max(0, this.steps.length - handled);
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
      if (this.screen === 'welcome') this._renderWelcome();
      else if (this.screen === 'done') this._renderDone();
      else this._renderWizard(animate !== false);
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
              '<div class="welcome__row-tx"><b>' + esc(u.w_items(this.setupCount(), this.tourCount())) + '</b><span>' + esc(u.w_items_sub) + '</span></div>' +
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
      if (step.id === 'ob-st-7') return this._mountTransition(ctx);
      if (step.id === 'ob-gr-2') return this._mountExamples(ctx);
      if (step.id === 'tour-finalization') return this._mountFinalization(ctx);
      if (step.step_type === 'action') return this._mountAction(ctx);
      if (this.isRedirect(step)) return this._mountRedirectIntro(ctx);
      /* info simples: sem corpo extra */
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

    /* QR codes do app móvel */
    _mountQr: function (ctx) {
      var qr = function (data) {
        return 'https://api.qrserver.com/v1/create-qr-code/?size=312x312&margin=0&data=' + encodeURIComponent(data);
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

    /* transição setup → tour (ob-st-7): mini celebração */
    _mountTransition: function (ctx) {
      var u = this.ui();
      ctx.root.appendChild(el('<div style="display:flex;flex-direction:column;align-items:center;gap:10px">' +
        '<span class="phase-chip" style="height:30px;font-size:12px">' + I.checkCircle + esc(u.transition_done) + '</span>' +
      '</div>'));
      if (!reduceMotion()) this._confetti(this.sparkEl, 18);
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

    /* finalização: CTA agendar 1:1 */
    _mountFinalization: function (ctx) {
      var u = this.ui();
      var a = el('<a class="btn btn--lg" style="width:100%;max-width:340px;margin:0 auto" href="' + ONBOARDING_LINK + '" target="_blank" rel="noopener">' + I.calendar + esc(u.schedule_btn) + '</a>');
      ctx.root.appendChild(a);
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
      this.mode = 'dock';
      this.index = this.steps.indexOf(step);
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
      var hasPractice = !!step.practice_action;
      // resume sem navigate: mostra a descrição do step, não "te levei pra tela certa"
      var subTxt = opts.navigate ? u.dock_nav_hint : (desc || u.dock_nav_hint);

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
            (marks.length ? '<button class="btn btn--sm d-tour">' + I.eye + esc(u.dock_tour) + '</button>' : '') +
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
        Coach.run(marks, self.lang, function (status) {
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
        waitForTargets(marks, 9000).then(function (found) {
          if (!document.body.contains(dock)) return;
          if (found && marks.length) runTour();
          else if (marks.length) {
            var sub = dock.querySelector('.spark-dock__sub');
            if (sub) sub.textContent = u.dock_no_targets;
            setState('expanded');
          }
        });
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
    _mountFab: function () {
      var self = this, u = this.ui();
      this._removeFab();
      if (this.pendingCount() === 0) return;
      var fab = el('<button class="spark-fab has-pending" aria-label="' + esc(u.fab_aria) + '">' + I.rocket +
        '<span class="spark-fab__badge">' + this.pendingCount() + '</span></button>');
      fab.onclick = function () { self.openFullscreen(self.screen === 'done' ? 'done' : 'wizard'); };
      this.root.appendChild(fab);
      this._fab = fab;
    },
    _removeFab: function () {
      if (this._fab) { this._fab.remove(); this._fab = null; }
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
      if (this.mode === 'dock' && ws_active && !this.completed.has(ws_active.id)) {
        // user estava no meio de um step no GHL — restaura dock sem navegar
        this._renderDock(ws_active, { navigate: false });
      } else if (!this.everOpened) {
        // primeira visita: abre welcome automaticamente
        this.openFullscreen('welcome');
      } else {
        // visitas seguintes: só FAB
        this.mode = 'fullscreen';
        this._mountFab();
      }
    },

    destroy: function () {
      Coach.stop();
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

  function boot() {
    var locId = getLocationId();
    if (!locId || locId === bootedFor) return;
    bootedFor = locId;
    if (engine) { engine.destroy(); engine = null; }

    Promise.all([loadProgress(locId), loadSteps()]).then(function (res) {
      if (getLocationId() !== locId) return; // user trocou de location durante o fetch
      var progress = res[0], steps = res[1];
      if (!progress) return;                 // gate: sem row = sem widget
      if (progress.completed_at) return;     // já concluiu
      if (!steps || !steps.length) return;
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
