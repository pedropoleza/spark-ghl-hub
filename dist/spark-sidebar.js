/* =============================================
   SPARK SIDEBAR JS v4
   Folders, expandable sub-items, SPA-aware
   ============================================= */
(function() {
  'use strict';

  /* ── Debug interceptor (gated; logs GHL message/upload network traffic) ──
     Enable in DevTools:   localStorage.setItem('SPARK_DEBUG','1'); location.reload();
     After reproducing:    copy(JSON.stringify(window.__SPARK_CAPTURES, null, 2))
     Disable:              localStorage.removeItem('SPARK_DEBUG'); location.reload(); */
  try {
    if (localStorage.getItem('SPARK_DEBUG') === '1') {
      window.__SPARK_CAPTURES = [];
      var isInteresting = function(url) {
        return /\/(conversations\/messages|messaging\/messages|messages\/upload|media|files\/upload|attachments|sms|sendMessage)/i.test(url || '');
      };
      var serializeBody = function(body) {
        if (!body) return null;
        try {
          if (body instanceof FormData) {
            var parts = {};
            body.forEach(function(v, k) {
              parts[k] = (v && v.name !== undefined && v.size !== undefined)
                ? '[File name=' + v.name + ' size=' + v.size + 'B type=' + v.type + ']'
                : String(v).slice(0, 800);
            });
            return { type: 'FormData', parts: parts };
          }
          if (typeof body === 'string') {
            try { return { type: 'JSON', data: JSON.parse(body) }; }
            catch (e) { return { type: 'text', data: body.slice(0, 2000) }; }
          }
        } catch (e) {}
        return { type: 'other', repr: String(body).slice(0, 400) };
      };
      var capture = function(rec) {
        window.__SPARK_CAPTURES.push(rec);
        console.groupCollapsed('[SPARK-INTERCEPT] ' + rec.method + ' ' + rec.url + ' → ' + rec.status);
        console.log('Request:', rec.requestBody);
        console.log('Response:', rec.responseBody);
        console.groupEnd();
      };

      var origFetch = window.fetch;
      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (!isInteresting(url)) return origFetch.apply(this, arguments);
        var method = (init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET';
        var requestBody = serializeBody(init && init.body);
        return origFetch.apply(this, arguments).then(function(resp) {
          try {
            resp.clone().text().then(function(text) {
              var parsed;
              try { parsed = JSON.parse(text); } catch (e) { parsed = (text || '').slice(0, 2000); }
              capture({ source: 'fetch', method: method, url: url, status: resp.status, requestBody: requestBody, responseBody: parsed });
            });
          } catch (e) {}
          return resp;
        });
      };

      var XHRopen = XMLHttpRequest.prototype.open;
      var XHRsend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url) {
        this.__sparkUrl = url; this.__sparkMethod = method;
        return XHRopen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function(body) {
        var url = this.__sparkUrl || '';
        if (!isInteresting(url)) return XHRsend.apply(this, arguments);
        var requestBody = serializeBody(body);
        var self = this;
        this.addEventListener('load', function() {
          var parsed;
          try { parsed = JSON.parse(self.responseText); }
          catch (e) { parsed = (self.responseText || '').slice(0, 2000); }
          capture({ source: 'xhr', method: self.__sparkMethod, url: url, status: self.status, requestBody: requestBody, responseBody: parsed });
        });
        return XHRsend.apply(this, arguments);
      };

      console.log('%c[SPARK-INTERCEPT] enabled. Reproduce the action, then run: copy(JSON.stringify(window.__SPARK_CAPTURES, null, 2))', 'color:#f5b731;font-weight:bold');
    }
  } catch (e) {
    console.warn('[SPARK-INTERCEPT] init failed:', e);
  }

  /* ── 5MB → link fix (gated; enable via localStorage.setItem('SPARK_5MB_FIX','1')) ──
     GHL converts >5MB uploads into a shortlink in the message body (because it
     applies the SMS 5MB limit even when the custom WhatsApp provider is selected).
     This rewrites the outgoing draft/send: if body is *only* a shortlink and
     attachments is empty, we move the link to attachments so the custom provider
     handles it as a media attachment. */
  try {
    if (localStorage.getItem('SPARK_5MB_FIX') === '1') {
      var SHORTLINK_RX = /^https?:\/\/[^\s\/]+\/l\/[A-Za-z0-9_-]{4,}$/;
      var MSG_ENDPOINT_RX = /\/conversations\/messages(\/drafts)?(\?|$|\/)/;

      var tryFixBody = function(jsonStr) {
        var data;
        try { data = JSON.parse(jsonStr); } catch (e) { return jsonStr; }
        if (!data) return jsonStr;
        /* Drafts use "body"; the actual send uses "message" */
        var field = null;
        if (typeof data.body === 'string' && data.body) field = 'body';
        else if (typeof data.message === 'string' && data.message) field = 'message';
        if (!field) return jsonStr;
        if (data.attachments && data.attachments.length > 0) return jsonStr;
        var trimmed = data[field].trim();
        if (!SHORTLINK_RX.test(trimmed)) return jsonStr;
        data.attachments = [trimmed];
        data[field] = '';
        console.log('%c[SPARK-5MB-FIX] ' + field + ' shortlink → attachment', 'color:#3b82f6;font-weight:bold', trimmed);
        return JSON.stringify(data);
      };

      var fix_origFetch = window.fetch;
      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = (init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET';
        if (method.toUpperCase() === 'POST' && MSG_ENDPOINT_RX.test(url) && init && typeof init.body === 'string') {
          init = Object.assign({}, init, { body: tryFixBody(init.body) });
        }
        return fix_origFetch.call(this, input, init);
      };

      var fix_XHRopen = XMLHttpRequest.prototype.open;
      var fix_XHRsend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url) {
        this.__spark5Url = url; this.__spark5Method = method;
        return fix_XHRopen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function(body) {
        var url = this.__spark5Url || '';
        var method = (this.__spark5Method || '').toUpperCase();
        if (method === 'POST' && MSG_ENDPOINT_RX.test(url) && typeof body === 'string') {
          body = tryFixBody(body);
        }
        return fix_XHRsend.call(this, body);
      };

      console.log('%c[SPARK-5MB-FIX] enabled', 'color:#3b82f6;font-weight:bold');
    }
  } catch (e) {
    console.warn('[SPARK-5MB-FIX] init failed:', e);
  }

  /* ── Module loader ──
     baseURL is derived from this script's src so forks deployed elsewhere
     still load their own modules. Modules are loaded async and set globals
     the rest of this file reads via `window.__SPARK_*` (e.g. ACCOUNT_OVERRIDES).
     applySpark()'s polling cycle picks them up once available. */
  var __sparkScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('spark-sidebar.js') !== -1) return scripts[i];
    }
    return null;
  })();
  var __sparkBaseUrl = __sparkScript
    ? __sparkScript.src.replace(/spark-sidebar\.js.*$/, '')
    : 'https://dist-iota-one-53.vercel.app/';

  function loadSparkModule(name) {
    if (window['__SPARK_MODULE_LOADING_' + name]) return;
    window['__SPARK_MODULE_LOADING_' + name] = true;
    var s = document.createElement('script');
    s.src = __sparkBaseUrl + 'modules/' + name + '.js?v=1';
    s.async = true;
    document.head.appendChild(s);
  }

  /* Always load: per-account overrides (hardcoded fallback; Supabase-backed soon) */
  loadSparkModule('account-overrides');

  /* Opt-in: DOM probe + error capture for debugging */
  try {
    var __probeFlag = localStorage.getItem('SPARK_PROBE');
    if (__probeFlag === '1' || __probeFlag === 'ui') loadSparkModule('dom-probe');
  } catch (e) { /* localStorage unavailable */ }

  /* ── Config ── */
  var OTHER_TOOLS_IDS = [
    'sb_email-marketing', 'sb_payments', 'sb_sites',
    'sb_memberships', 'sb_app-media', 'sb_reputation',
    'sb_app-marketplace', 'sb_location-mobile-app'
  ];

  var SUB_ITEMS = {
    'sb_opportunities': [
      { label: 'Pipeline', path: '/opportunities/pipeline' },
      { label: 'List View', path: '/opportunities/list' },
    ],
    'sb_contacts': [
      { label: 'Smart Lists', path: '/contacts/smart_list/All' },
      { label: 'Bulk Actions', path: '/contacts/bulk/actions' },
    ],
    'sb_calendars': [
      { label: 'Calendar View', path: '/calendars/view' },
      { label: 'Appointments', path: '/calendars/appointments' },
      { label: 'Settings', path: '/settings/calendars' },
    ],
    'sb_email-marketing': [
      { label: 'Social Planner', path: '/marketing/social-planner' },
      { label: 'Email Marketing', path: '/marketing/emails' },
    ],
    'sb_payments': [
      { label: 'Invoices', path: '/payments/invoices' },
      { label: 'Products', path: '/payments/products' },
      { label: 'Orders', path: '/payments/orders' },
    ],
    'sb_sites': [
      { label: 'Funnels', path: '/funnels-websites/funnels' },
      { label: 'Websites', path: '/funnels-websites/websites' },
    ],
    'sb_automation': [
      { label: 'Workflows', path: '/automation/workflows' },
    ],
    'sb_reporting': [
      { label: 'Reports', path: '/reporting/reports' },
      { label: 'Attribution', path: '/reporting/attribution' },
    ],
  };

  /* Account-specific overrides now live in dist/modules/account-overrides.js
     and are read from window.__SPARK_ACCOUNT_OVERRIDES at apply time. */

  var folderOpen = false;
  var expandedMenus = {};

  /* ── Helpers ── */
  function getBasePath() {
    var m = window.location.pathname.match(/\/v2\/location\/[^\/]+/);
    return m ? m[0] : '';
  }

  function getAccountId() {
    var m = window.location.pathname.match(/\/v2\/location\/([^\/]+)/);
    return m ? m[1] : '';
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* ── Detect settings page ── */
  function isSettingsPage() {
    return window.location.pathname.indexOf('/settings/') !== -1;
  }

  /* ── Settings: collapsible sections ── */
  var settingsState = { 'OTHER SETTINGS': true }; /* OTHER SETTINGS collapsed by default */
  var settingsApplied = false;

  function applySettingsCollapse() {
    if (!isSettingsPage()) { settingsApplied = false; return; }
    var sidebar = document.getElementById('sidebar-v2');
    if (!sidebar) return;

    /* Settings uses hl_nav-header-without-footer, not hl_nav-header */
    var navContainer = sidebar.querySelector('.hl_nav-header-without-footer') || sidebar.querySelector('.hl_nav-header');
    if (!navContainer) return;

    /* Find all section dividers */
    var dividers = navContainer.querySelectorAll('.divider');
    if (dividers.length === 0) return;
    if (settingsApplied) return;

    dividers.forEach(function(divider) {
      var span = divider.querySelector('span.uppercase');
      if (!span || divider.querySelector('.spark-section-chevron')) return;
      var name = span.textContent.replace(/[\s\u00A0]+/g, ' ').trim();
      if (!name) return;

      var isCollapsed = settingsState[name] === true;

      /* Add chevron SVG */
      var chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chev.setAttribute('class', 'spark-section-chevron' + (isCollapsed ? ' collapsed' : ''));
      chev.setAttribute('viewBox', '0 0 24 24');
      chev.setAttribute('fill', 'none');
      chev.setAttribute('stroke', 'currentColor');
      chev.setAttribute('stroke-width', '2.5');
      chev.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
      span.appendChild(chev);

      divider.classList.add('spark-section-toggle');

      /* Get sibling items until next divider */
      var siblings = [];
      var next = divider.nextElementSibling;
      while (next && !next.classList.contains('divider')) {
        siblings.push(next);
        next = next.nextElementSibling;
      }

      /* Move Integrations into Business Services if this is Business Services */
      if (name === 'BUSINESS SERVICES') {
        var intEl = document.getElementById('sb_common.sidebar.lcIntegrations');
        if (intEl && siblings.indexOf(intEl) === -1) {
          /* Insert before the next divider */
          var lastSibling = siblings[siblings.length - 1];
          if (lastSibling && lastSibling.nextSibling) {
            lastSibling.parentNode.insertBefore(intEl, lastSibling.nextSibling);
          }
          siblings.push(intEl);
        }
      }

      /* Apply initial collapsed state */
      if (isCollapsed) {
        siblings.forEach(function(s) { s.classList.add('spark-section-hidden'); });
      }

      /* Click handler */
      divider.addEventListener('click', function(e) {
        e.stopPropagation();
        var c = divider.querySelector('.spark-section-chevron');
        var hidden = siblings[0] && siblings[0].classList.contains('spark-section-hidden');
        siblings.forEach(function(s) {
          if (hidden) s.classList.remove('spark-section-hidden');
          else s.classList.add('spark-section-hidden');
        });
        if (hidden) { c.classList.remove('collapsed'); settingsState[name] = false; }
        else { c.classList.add('collapsed'); settingsState[name] = true; }
      });
    });

    settingsApplied = true;

    /* Hide spark items that shouldn't show on settings */
    var tpl = document.getElementById('spark-templates');
    if (tpl) tpl.style.display = 'none';
    sidebar.querySelectorAll('.spark-folder-toggle, .spark-folder-body').forEach(function(el) {
      el.style.display = 'none';
    });
  }

  /* ── Main ── */
  function applySpark() {
    var sidebar = document.getElementById('sidebar-v2');
    if (!sidebar) return;
    /* On settings page, apply collapsible sections instead */
    if (isSettingsPage()) {
      applySettingsCollapse();
      return;
    }

    var nav = sidebar.querySelector('.hl_nav-header nav');
    if (!nav || nav.querySelectorAll('a').length < 3) return;
    /* Reset settings flag when leaving settings */
    settingsApplied = false;

    /* Clean previous injections */
    sidebar.querySelectorAll('[data-spark]').forEach(function(el) {
      if (el.classList.contains('spark-folder-body')) {
        while (el.firstChild) nav.appendChild(el.firstChild);
      }
      el.remove();
    });

    var base = getBasePath();

    /* ── Account-specific overrides ── */
    var accountId = getAccountId();
    var overrides = (window.__SPARK_ACCOUNT_OVERRIDES || {})[accountId];
    if (overrides) {
      sidebar.setAttribute('data-spark-account', accountId);
      if (overrides.hide) {
        overrides.hide.forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
      }
      if (overrides.firstItem) {
        var firstEl = document.getElementById(overrides.firstItem) || nav.querySelector('a[id="' + overrides.firstItem + '"]');
        if (firstEl) firstEl.style.order = '0';
      }
    } else {
      sidebar.removeAttribute('data-spark-account');
    }

    /* ── Inject Templates link ── */
    if (!document.getElementById('spark-templates')) {
      var tpl = document.createElement('a');
      tpl.id = 'spark-templates';
      tpl.href = base + '/conversations/templates?tab=folders&page=1&size=20';
      tpl.setAttribute('data-spark', '1');
      tpl.className = 'w-full group px-3 flex items-center justify-start lg:justify-start xl:justify-start text-sm font-medium rounded-md cursor-pointer py-2 md:py-2';
      tpl.innerHTML = '<span class="h-5 w-5 mr-2 lg:mr-2 xl:mr-2" style="display:inline-flex;align-items:center;justify-content:center;"><i class="fas fa-file-alt" style="font-size:15px"></i></span><span class="hl_text-overflow sm:hidden md:hidden nav-title lg:block xl:block">Templates</span>';
      /* Only active if on templates page */
      if (window.location.pathname.match(/\/conversations\/templates(\/|$)/)) {
        tpl.classList.add('spark-active');
        /* Remove active from Conversations since we're on templates sub-page */
        var convEl = document.getElementById('sb_conversations');
        if (convEl) {
          convEl.classList.remove('active', 'exact-active');
        }
      }
      tpl.addEventListener('click', function(e) {
        e.preventDefault();
        /* Mark as active immediately */
        tpl.classList.add('spark-active');
        var convEl = document.getElementById('sb_conversations');
        if (convEl) convEl.classList.remove('active', 'exact-active');
        /* Navigate */
        try {
          var app = document.getElementById('app');
          if (app && app.__vue_app__) {
            var router = app.__vue_app__.config.globalProperties.$router;
            if (router) { router.push(base + '/conversations/templates?tab=folders&page=1&size=20'); return; }
          }
          if (app && app.__vue__ && app.__vue__.$router) {
            app.__vue__.$router.push(base + '/conversations/templates?tab=folders&page=1&size=20'); return;
          }
        } catch(err) {}
        window.location.assign(base + '/conversations/templates?tab=folders&page=1&size=20');
      });
      nav.appendChild(tpl);
    }

    /* ── Inject "Other Tools" folder ── */
    var toggle = document.createElement('div');
    toggle.className = 'spark-folder-toggle';
    toggle.setAttribute('data-spark', '1');
    toggle.style.order = '20';
    toggle.innerHTML = '<svg class="spark-folder-chevron' + (folderOpen ? ' open' : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg><span class="spark-folder-label">Other Tools</span>';

    var body = document.createElement('div');
    body.className = 'spark-folder-body' + (folderOpen ? '' : ' collapsed');
    body.setAttribute('data-spark', '1');
    body.style.order = '21';

    toggle.addEventListener('click', function() {
      folderOpen = !folderOpen;
      var chev = toggle.querySelector('.spark-folder-chevron');
      if (folderOpen) { body.classList.remove('collapsed'); chev.classList.add('open'); }
      else { body.classList.add('collapsed'); chev.classList.remove('open'); }
    });

    nav.appendChild(toggle);

    OTHER_TOOLS_IDS.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) body.appendChild(el);
    });

    nav.appendChild(body);

    /* ── Inject expandable sub-items ── */
    Object.keys(SUB_ITEMS).forEach(function(parentId) {
      var parentEl = document.getElementById(parentId);
      if (!parentEl) return;

      var subs = SUB_ITEMS[parentId];
      var isOpen = !!expandedMenus[parentId];

      /* Add expand button inside the <a> */
      var existing = parentEl.querySelector('.spark-expand-btn');
      if (!existing) {
        var btn = document.createElement('button');
        btn.className = 'spark-expand-btn' + (isOpen ? ' open' : '');
        btn.setAttribute('data-spark', '1');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>';
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          expandedMenus[parentId] = !expandedMenus[parentId];
          var submenu = parentEl.nextElementSibling;
          if (submenu && submenu.classList.contains('spark-submenu')) {
            if (expandedMenus[parentId]) { submenu.classList.remove('collapsed'); btn.classList.add('open'); }
            else { submenu.classList.add('collapsed'); btn.classList.remove('open'); }
          }
        });
        parentEl.style.position = 'relative';
        parentEl.appendChild(btn);
      }

      /* Create submenu div right after the parent <a> */
      var subId = 'spark-sub-' + parentId;
      var existingSub = document.getElementById(subId);
      if (existingSub) existingSub.remove();

      var submenu = document.createElement('div');
      submenu.id = subId;
      submenu.className = 'spark-submenu' + (isOpen ? '' : ' collapsed');
      submenu.setAttribute('data-spark', '1');
      submenu.style.order = parentEl.style.order || getComputedStyle(parentEl).order;

      var currentPath = window.location.pathname;

      subs.forEach(function(sub) {
        var a = document.createElement('a');
        a.href = base + sub.path;
        a.textContent = sub.label;
        if (currentPath.indexOf(sub.path) !== -1) a.classList.add('spark-sub-active');
        a.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          /* Navigate via GHL's Vue Router by finding the app's router instance */
          var fullPath = base + sub.path;
          try {
            /* Try Vue Router push via the app instance */
            var app = document.getElementById('app');
            if (app && app.__vue_app__) {
              var router = app.__vue_app__.config.globalProperties.$router;
              if (router) {
                router.push(fullPath);
                return;
              }
            }
            /* Fallback: try __vue__ on app */
            if (app && app.__vue__ && app.__vue__.$router) {
              app.__vue__.$router.push(fullPath);
              return;
            }
          } catch(err) {}
          /* Last fallback: soft navigation via location assign (still better than href) */
          window.location.assign(fullPath);
        });
        submenu.appendChild(a);
      });

      /* Insert after parent */
      if (parentEl.nextSibling) {
        parentEl.parentNode.insertBefore(submenu, parentEl.nextSibling);
      } else {
        parentEl.parentNode.appendChild(submenu);
      }
    });
  }

  /* ── Persistent observer — watches for nav changes and re-applies ── */
  var lastApplied = 0;

  function checkAndApply() {
    var now = Date.now();
    if (now - lastApplied < 500) return; /* debounce */

    /* Settings page — check if sections need collapsing */
    if (isSettingsPage()) {
      if (!settingsApplied) {
        lastApplied = now;
        applySettingsCollapse();
      }
      /* Always hide spark items on settings */
      var tpl = document.getElementById('spark-templates');
      if (tpl) tpl.style.display = 'none';
      document.querySelectorAll('.spark-folder-toggle, .spark-folder-body, .spark-submenu').forEach(function(el) {
        el.style.display = 'none';
      });
      return;
    }

    var nav = document.querySelector('#sidebar-v2 .hl_nav-header nav');
    if (!nav || nav.querySelectorAll('a').length < 5) return;
    /* Check if our folder is missing (GHL re-rendered) */
    var hasFolder = nav.querySelector('[data-spark]');
    if (!hasFolder) {
      lastApplied = now;
      applySpark();
    }
    /* Sync Templates active state */
    syncTemplatesActive();
    /* Hide "Send a Review Request" from Quick Actions */
    hideReviewRequest();
  }

  function hideReviewRequest() {
    /* Handled by CSS: #quick-send-review-v2 { display: none } */
  }

  function syncTemplatesActive() {
    var tpl = document.getElementById('spark-templates');
    if (!tpl) return;
    var onTemplates = window.location.pathname.match(/\/conversations\/templates(\/|$)/);
    if (onTemplates) {
      tpl.classList.add('spark-active');
      var convEl = document.getElementById('sb_conversations');
      if (convEl) convEl.classList.remove('active', 'exact-active');
    } else {
      tpl.classList.remove('spark-active');
    }
  }

  /* Persistent poll every 1.5s — catches ALL re-renders including Settings back */
  setInterval(checkAndApply, 1500);

  /* Also watch DOM mutations for faster response */
  var obs = new MutationObserver(function() { checkAndApply(); });
  obs.observe(document.body, { childList: true, subtree: true });

  /* Route change backup */
  window.addEventListener('routeChangeEvent', function() {
    setTimeout(checkAndApply, 300);
    setTimeout(checkAndApply, 800);
    setTimeout(checkAndApply, 2000);
  });

  /* Initial */
  setTimeout(checkAndApply, 500);

  /* ── Load Onboarding Widget (v2 — wizard SETUP+TOUR) ── */
  var obScript = document.createElement('script');
  obScript.src = __sparkBaseUrl + 'spark-onboarding.js?v=2';
  document.head.appendChild(obScript);

})();
