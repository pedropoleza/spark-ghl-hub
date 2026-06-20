/* =============================================
   SPARK GHL HUB · dom-probe.js  v0.1.0
   Gated DOM + error probe for GHL pages.

   Enable:    localStorage.SPARK_PROBE = '1'; location.reload();
   Dump:      __SPARK_PROBE.copy()    // copies redacted JSON
   Stop:      __SPARK_PROBE.stop()    // or remove the localStorage key + reload
   Validate:  __SPARK_PROBE.assertNoSecrets()  // throws if secrets leak

   SECURITY: this module redacts JWTs, emails, and phone numbers from all
   captured error messages and stacks. It never captures localStorage,
   sessionStorage, location.search, request/response bodies, or input values.
   See assertNoSecrets() for the verification pass.
   ============================================= */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Install guard — never double-install (e.g. if the script is injected twice
  // by a SPA route change or a duplicate <script> tag).
  // ---------------------------------------------------------------------------
  if (window.__SPARK_PROBE_INSTALLED) return;
  window.__SPARK_PROBE_INSTALLED = true;

  // ---------------------------------------------------------------------------
  // Gate — exit early with zero runtime overhead unless the user has opted in
  // via localStorage. Accept '1' (data probe) or 'ui' (floating widget — v0.2,
  // stubbed for now so the gate still works).
  // ---------------------------------------------------------------------------
  const gate = (function () {
    try {
      return localStorage.getItem('SPARK_PROBE');
    } catch (e) {
      // Some sandboxed iframes throw on localStorage access — treat as disabled.
      return null;
    }
  })();

  if (gate !== '1' && gate !== 'ui') {
    // Expose a tiny stub so callers can inspect state without ReferenceErrors.
    window.__SPARK_PROBE = window.__SPARK_PROBE || { status: 'disabled' };
    return;
  }

  // =============================================================================
  // Constants & known catalog
  // =============================================================================

  const PROBE_VERSION = '0.1.0';
  const SNAPSHOT_INTERVAL_MS = 1500;
  const SNAPSHOT_RING_MAX = 200;
  const ERROR_RING_MAX = 100;
  const RECENT_ERRORS_PER_SNAPSHOT = 10;

  // Known sb_* IDs from the main sidebar (see CLAUDE.md). Note: "sb_AI Agents"
  // contains a literal space and must be matched with attribute selectors.
  const KNOWN_SIDEBAR_IDS = [
    'sb_launchpad',
    'sb_dashboard',
    'sb_conversations',
    'sb_opportunities',
    'sb_calendars',
    'sb_contacts',
    'sb_email-marketing',
    'sb_automation',
    'sb_sites',
    'sb_memberships',
    'sb_app-media',
    'sb_reputation',
    'sb_reporting',
    'sb_app-marketplace',
    'sb_location-mobile-app',
    'sb_payments',
    'sb_settings',
    'sb_ai-employee-promo',
    'sb_AI Agents'
  ];

  // sb_* IDs we expect to be present on a standard sidebar (subset of known).
  // Anything missing from this list is flagged in `sidebar.missingExpected`.
  const EXPECTED_SIDEBAR_IDS = [
    'sb_dashboard',
    'sb_conversations',
    'sb_opportunities',
    'sb_calendars',
    'sb_contacts',
    'sb_automation',
    'sb_reporting',
    'sb_settings'
  ];

  // Mount points we want to know "present? class? childCount?" for every tick.
  const MOUNT_POINT_SELECTORS = [
    '#app',
    '#sidebar-v2',
    '.hl_nav-header > nav',
    '.hl_nav-header-without-footer',
    '#central-panel-conversations-mount',
    '#location-switcher-sidbar-v2',
    '#globalSearchOpener',
    '#quickActions',
    '#conv-channel-bar-provider-trigger',
    '.agency-logo-container'
  ];

  // =============================================================================
  // Redaction — strip secrets from any string before it lands in the buffer.
  // The order matters: JWTs first (most specific), then email, then phone.
  // =============================================================================

  const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
  const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  const PHONE_RE = /\+?\d[\d\s\-()]{7,}/g;

  function redact(s) {
    if (s == null) return s;
    if (typeof s !== 'string') {
      try { s = String(s); } catch (e) { return '[REDACTION-FAILED]'; }
    }
    return s
      .replace(JWT_RE, '[REDACTED-JWT]')
      .replace(EMAIL_RE, '[REDACTED-EMAIL]')
      .replace(PHONE_RE, '[REDACTED-PHONE]');
  }

  // =============================================================================
  // Module state — kept in module-scope vars and mirrored onto window.__SPARK_PROBE
  // =============================================================================

  const startedAt = Date.now();
  const snapshots = []; // ring buffer
  const errors = [];    // ring buffer of every captured error event
  let errorCountSinceStart = 0;
  let intervalHandle = null;
  let installedListeners = false;
  let status = 'running';

  // Save originals so stop() can restore + tests can detect tampering.
  const originalConsoleError = console.error.bind(console);

  // =============================================================================
  // Small helpers
  // =============================================================================

  function pushRing(arr, item, max) {
    arr.push(item);
    if (arr.length > max) arr.splice(0, arr.length - max);
  }

  function safeQuery(sel) {
    try { return document.querySelector(sel); } catch (e) { return null; }
  }

  function safeQueryAll(sel) {
    try { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    catch (e) { return []; }
  }

  // Pull the GHL account / location id out of the pathname (no search!).
  // Pathname shapes: /v2/location/<id>/<module>/... or /v2/preview/...
  function parseAccountIdFromPath(pathname) {
    const m = pathname.match(/\/v2\/location\/([^/]+)/);
    return m ? m[1] : '';
  }

  function parseModuleFromPath(pathname) {
    // Strip the /v2/location/<id>/ prefix if present.
    const tail = pathname.replace(/^\/v2\/location\/[^/]+\//, '');
    const first = tail.split('/')[0] || '';
    const known = [
      'conversations', 'contacts', 'opportunities', 'calendars',
      'settings', 'dashboard'
    ];
    return known.indexOf(first) !== -1 ? first : 'other';
  }

  // Best-effort federation introspection — returns one of 'loaded'|'failed'|'unknown'.
  // We never throw; if we can't tell, we report 'unknown'.
  function probeRemote(name) {
    try {
      const wp = window.__webpack_require__;
      if (!wp || !wp.federation) return 'unknown';
      const fed = wp.federation;
      // Try common federation runtime shapes — different webpack versions differ.
      const containers = fed.runtime && fed.runtime.remotes;
      if (containers && containers[name]) {
        const c = containers[name];
        if (c.loaded === true) return 'loaded';
        if (c.error || c.failed) return 'failed';
      }
      if (fed.initOptions && fed.initOptions.remotes) {
        // Walk the configured remotes list — presence alone isn't "loaded".
        const list = fed.initOptions.remotes;
        for (let i = 0; i < list.length; i++) {
          if (list[i] && list[i].name === name) return 'unknown';
        }
      }
      return 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  // =============================================================================
  // Mount-point sampler
  // =============================================================================

  function sampleMountPoints() {
    const out = {};
    for (let i = 0; i < MOUNT_POINT_SELECTORS.length; i++) {
      const sel = MOUNT_POINT_SELECTORS[i];
      const el = safeQuery(sel);
      if (!el) {
        out[sel] = { present: false, classes: null, childCount: null };
      } else {
        out[sel] = {
          present: true,
          classes: el.className && typeof el.className === 'string'
            ? el.className
            : (el.getAttribute && el.getAttribute('class')) || '',
          childCount: el.children ? el.children.length : 0
        };
      }
    }
    return out;
  }

  // =============================================================================
  // Sidebar sampler
  // =============================================================================

  function sampleSidebar() {
    const sidebar = safeQuery('#sidebar-v2');
    const open = !!(sidebar && sidebar.classList && sidebar.classList.contains('w-56'));

    // Collect every sb_* id present in the DOM (main + settings + footer navs).
    const allAnchors = safeQueryAll('a[id^="sb_"], a[id="sb_AI Agents"]');
    const menuItemIds = [];
    const activeIds = [];
    for (let i = 0; i < allAnchors.length; i++) {
      const a = allAnchors[i];
      const id = a.id || '';
      if (!id) continue;
      if (menuItemIds.indexOf(id) === -1) menuItemIds.push(id);
      if (a.classList && (a.classList.contains('active') || a.classList.contains('exact-active'))) {
        if (activeIds.indexOf(id) === -1) activeIds.push(id);
      }
    }

    // Diff against the known catalog and the "expected on every page" subset.
    const unknownIds = [];
    for (let i = 0; i < menuItemIds.length; i++) {
      if (KNOWN_SIDEBAR_IDS.indexOf(menuItemIds[i]) === -1) {
        unknownIds.push(menuItemIds[i]);
      }
    }
    const missingExpected = [];
    for (let i = 0; i < EXPECTED_SIDEBAR_IDS.length; i++) {
      if (menuItemIds.indexOf(EXPECTED_SIDEBAR_IDS[i]) === -1) {
        missingExpected.push(EXPECTED_SIDEBAR_IDS[i]);
      }
    }

    // Count custom-link UUID anchors — do NOT capture the UUIDs themselves,
    // they are tenant-specific and could correlate with the customer org.
    const customLinks = safeQueryAll('a.custom-link[id]');
    let customLinkUuidsCount = 0;
    const uuidRe = /^[0-9a-f-]{16,}$/i;
    for (let i = 0; i < customLinks.length; i++) {
      if (uuidRe.test(customLinks[i].id)) customLinkUuidsCount++;
    }

    // Spark-injected DOM markers — these tell us if our own JS landed.
    const sparkMarkers = {
      folder: !!safeQuery('[data-spark-folder]'),
      templates: !!safeQuery('#spark-templates, a[data-spark="1"][id*="templates" i]') ||
                 !!safeQuery('a[data-spark="1"]'),
      expanders: safeQueryAll('[data-spark-expander]').length,
      settingsSections: safeQueryAll('[data-spark-settings-section]').length
    };

    return {
      open: open,
      menuItemIds: menuItemIds,
      unknownIds: unknownIds,
      missingExpected: missingExpected,
      customLinkUuidsCount: customLinkUuidsCount,
      activeIds: activeIds,
      sparkMarkers: sparkMarkers
    };
  }

  // =============================================================================
  // Hub state sampler — peeks at window.__SPARK_HUB if a future hub loader
  // has populated it. Always returns a well-shaped object.
  // =============================================================================

  function sampleHubState() {
    const hub = window.__SPARK_HUB || {};
    const cfg = hub.config || {};
    return {
      loadedModules: Array.isArray(hub.loaded) ? hub.loaded.slice() : [],
      failedModules: Array.isArray(hub.failed) ? hub.failed.slice() : [],
      configLoaded: !!cfg && Object.keys(cfg).length > 0,
      configSource: cfg.__source === 'supabase' ? 'supabase'
                  : cfg.__source === 'fallback' ? 'fallback'
                  : 'none'
    };
  }

  // =============================================================================
  // Snapshot — the big one. Wrapped in try/catch by the caller.
  // =============================================================================

  function takeSnapshot() {
    const t0 = (performance && performance.now) ? performance.now() : Date.now();
    const now = Date.now();
    const pathname = location.pathname; // intentionally NOT location.search

    const route = {
      pathname: pathname,
      accountId: parseAccountIdFromPath(pathname),
      module: parseModuleFromPath(pathname),
      isSettings: pathname.indexOf('/settings/') !== -1 || /\/settings(\/|$)/.test(pathname),
      isTemplates: pathname.indexOf('/templates') !== -1 ||
                   pathname.indexOf('/conversations/templates') !== -1
    };

    const mountPoints = sampleMountPoints();
    const sidebar = sampleSidebar();
    const hubState = sampleHubState();

    const remotes = {
      copilotApp: probeRemote('copilotApp'),
      launchpadApp: probeRemote('launchpadApp')
    };

    // Pull the last N errors for embedding in this snapshot. They are already
    // redacted at capture time; we copy refs (the items are frozen-ish).
    const recent = errors.slice(-RECENT_ERRORS_PER_SNAPSHOT);

    const t1 = (performance && performance.now) ? performance.now() : Date.now();

    return {
      ts: now,
      iso: new Date(now).toISOString(),
      route: route,
      mountPoints: mountPoints,
      sidebar: sidebar,
      hubState: hubState,
      remotes: remotes,
      errors: {
        countSinceStart: errorCountSinceStart,
        recent: recent
      },
      perf: {
        timeSinceLoadMs: now - startedAt,
        snapshotMs: Math.round((t1 - t0) * 1000) / 1000
      }
    };
  }

  function tick() {
    try {
      const snap = takeSnapshot();
      pushRing(snapshots, snap, SNAPSHOT_RING_MAX);
    } catch (e) {
      // Snapshot failures must not kill the probe — record them and move on.
      pushRing(errors, {
        ts: Date.now(),
        type: 'console',
        message: '[SPARK-PROBE] snapshot failure: ' + redact(e && e.message || String(e)),
        stack: redact((e && e.stack) || ''),
        routeAtError: location.pathname
      }, ERROR_RING_MAX);
      errorCountSinceStart++;
    }
  }

  // =============================================================================
  // Error listeners
  // =============================================================================

  function onWindowError(e) {
    try {
      errorCountSinceStart++;
      pushRing(errors, {
        ts: Date.now(),
        type: 'error',
        message: redact((e && e.message) || ''),
        filename: redact((e && e.filename) || ''),
        lineno: (e && e.lineno) || 0,
        stack: redact((e && e.error && e.error.stack) || ''),
        routeAtError: location.pathname
      }, ERROR_RING_MAX);
    } catch (_) { /* swallow — probe must never throw inside a handler */ }
  }

  function onUnhandledRejection(e) {
    try {
      errorCountSinceStart++;
      const reason = e && (e.reason || e.detail);
      const msg = reason && (reason.message || reason.toString && reason.toString()) || '';
      const stack = reason && reason.stack || '';
      pushRing(errors, {
        ts: Date.now(),
        type: 'unhandledrejection',
        message: redact(String(msg)),
        stack: redact(String(stack)),
        routeAtError: location.pathname
      }, ERROR_RING_MAX);
    } catch (_) { /* swallow */ }
  }

  function wrapConsoleError() {
    console.error = function () {
      try {
        const parts = [];
        for (let i = 0; i < arguments.length; i++) {
          const a = arguments[i];
          if (a && a.stack) parts.push(String(a.message || a) + '\n' + a.stack);
          else if (typeof a === 'object') {
            try { parts.push(JSON.stringify(a)); } catch (_) { parts.push(String(a)); }
          } else {
            parts.push(String(a));
          }
        }
        const joined = parts.join(' ');
        errorCountSinceStart++;
        pushRing(errors, {
          ts: Date.now(),
          type: 'console',
          message: redact(joined),
          stack: '',
          routeAtError: location.pathname
        }, ERROR_RING_MAX);
      } catch (_) { /* swallow */ }
      // Preserve original behavior — we do NOT swallow the developer's log.
      return originalConsoleError.apply(console, arguments);
    };
  }

  function installListeners() {
    if (installedListeners) return;
    window.addEventListener('error', onWindowError, true);
    window.addEventListener('unhandledrejection', onUnhandledRejection, true);
    wrapConsoleError();
    installedListeners = true;
  }

  function removeListeners() {
    if (!installedListeners) return;
    window.removeEventListener('error', onWindowError, true);
    window.removeEventListener('unhandledrejection', onUnhandledRejection, true);
    console.error = originalConsoleError;
    installedListeners = false;
  }

  // =============================================================================
  // Public API
  // =============================================================================

  // Walk the entire probe state stringified and FAIL if any of the redaction
  // patterns survived. This is the user's last line of defense before pasting
  // a dump into chat / issue tracker / Slack.
  function assertNoSecrets() {
    let serialized;
    try {
      serialized = JSON.stringify({
        snapshots: snapshots,
        errors: errors
      });
    } catch (e) {
      throw new Error('[SPARK-PROBE] assertNoSecrets: failed to serialize probe state: ' + e.message);
    }

    const findings = [];
    if (JWT_RE.test(serialized)) findings.push('JWT');
    // Re-create regexes — /g state would be poisoned by the .test() above.
    if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(serialized)) findings.push('email');
    if (/\+?\d[\d\s\-()]{7,}/.test(serialized)) findings.push('phone');

    if (findings.length) {
      throw new Error('[SPARK-PROBE] assertNoSecrets FAILED — found: ' + findings.join(', ') +
        '. DO NOT paste this dump anywhere. File a bug against dom-probe.js redact().');
    }
    return true;
  }

  function dump() {
    assertNoSecrets();
    return JSON.stringify({
      version: PROBE_VERSION,
      startedAt: startedAt,
      now: Date.now(),
      status: status,
      snapshots: snapshots,
      errors: errors
    }, null, 2);
  }

  function copy() {
    const payload = dump(); // also asserts
    // Prefer the devtools-injected `copy()` helper if present — it shows the
    // "copied" toast in Chrome's console. Fall back to the async clipboard API.
    try {
      if (typeof window.copy === 'function') {
        window.copy(payload);
        console.log('%c[SPARK-PROBE] dump copied (devtools copy()). Bytes: ' + payload.length,
          'color:#8b5cf6');
        return true;
      }
    } catch (_) { /* fall through */ }
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(payload).then(function () {
        console.log('%c[SPARK-PROBE] dump copied to clipboard. Bytes: ' + payload.length,
          'color:#8b5cf6');
        return true;
      });
    }
    console.warn('[SPARK-PROBE] no clipboard API available — here is the payload:');
    console.log(payload);
    return false;
  }

  function stop() {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    removeListeners();
    status = 'stopped';
    window.__SPARK_PROBE.status = status;
    console.log('%c[SPARK-PROBE] stopped.', 'color:#8b5cf6');
  }

  // =============================================================================
  // Init
  // =============================================================================

  window.__SPARK_PROBE = {
    version: PROBE_VERSION,
    status: status,
    snapshots: snapshots,
    errors: errors,
    assertNoSecrets: assertNoSecrets,
    dump: dump,
    copy: copy,
    stop: stop,
    // Power-user escape hatch: take an extra snapshot on demand.
    snapshotNow: function () { tick(); return snapshots[snapshots.length - 1]; }
  };

  installListeners();

  // First snapshot at t=0 — don't make the user wait 1.5s for the first datapoint.
  tick();
  intervalHandle = setInterval(tick, SNAPSHOT_INTERVAL_MS);

  // The 'ui' gate is reserved for the floating widget (v0.2). For v0.1 we only
  // emit a hint so users know what to look forward to.
  if (gate === 'ui') {
    console.log('%c[SPARK-PROBE] UI mode requested — floating widget is a v0.2 stub. ' +
      'Data probe is running normally.', 'color:#8b5cf6');
    // TODO(v0.2): mount the floating widget here.
  }

  console.log('%c[SPARK-PROBE] enabled. Use __SPARK_PROBE.copy() to grab a dump.',
    'color:#8b5cf6;font-weight:bold');
})();
