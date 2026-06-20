/* =============================================
   SPARK GHL HUB · account-overrides.js  v0.1.0
   Per-location overrides for the GHL sidebar.

   Exposes:  window.__SPARK_ACCOUNT_OVERRIDES
   Shape:    { [locationId]: { hide?: string[], firstItem?: string } }

   The loader (spark-sidebar.js) reads this global on every applySpark()
   tick. If the global is missing or empty for the current location, the
   defaults apply (no overrides).

   ROADMAP: this module will be rewritten to fetch from the Supabase
   `ghl_hub_config` table (project nsqwgjbgcdqyzozyaltz) once that
   migration lands. Until then, the hardcoded FALLBACK below is the
   source of truth, mirroring the legacy spark-sidebar.js v6 behavior.
   ============================================= */
(function () {
  'use strict';

  if (window.__SPARK_ACCOUNT_OVERRIDES_LOADED) return;
  window.__SPARK_ACCOUNT_OVERRIDES_LOADED = true;

  /* Hardcoded fallback while Supabase wiring is pending.
     When the table is live, this becomes the empty-state fallback only. */
  var FALLBACK = {
    'UxgO7LJMqUWOZmiy5JOu': {
      hide: ['sb_dashboard'],
      firstItem: '88d8d11c-d99b-41dd-9f4f-d8a367ccde33'
    },
    'NdzeZDCKa8NmcmwsCU8T': {
      hide: ['sb_dashboard'],
      firstItem: 'f077df9a-3363-44ff-a15e-c554081ed5a9'
    }
  };

  /* Publish to the global the loader reads. Merge if something already set it
     (allows a separate runtime — e.g. a Supabase fetch — to seed it earlier). */
  var existing = window.__SPARK_ACCOUNT_OVERRIDES || {};
  var merged = {};
  Object.keys(FALLBACK).forEach(function (k) { merged[k] = FALLBACK[k]; });
  Object.keys(existing).forEach(function (k) { merged[k] = existing[k]; });
  window.__SPARK_ACCOUNT_OVERRIDES = merged;
  window.__SPARK_ACCOUNT_OVERRIDES_SOURCE = 'fallback';
})();
