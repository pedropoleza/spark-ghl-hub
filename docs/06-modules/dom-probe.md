# dom-probe

Gated DOM + error probe for GHL pages. Captures structural snapshots of the
sidebar, mount points, hub state, and recent errors so a future debugging
session can reason about the page without needing live access.

Source: [`dist/modules/dom-probe.js`](../../dist/modules/dom-probe.js)
Version: `0.1.0`

## What it does

When enabled, the probe takes a snapshot every **1500 ms** and keeps the last
**200** in a ring buffer (`__SPARK_PROBE.snapshots`). It also captures up to
**100** recent error events (`window.onerror`, `unhandledrejection`, and a
wrapped `console.error`) into `__SPARK_PROBE.errors`.

Each snapshot includes:

- **route** — `pathname` (no query!), parsed `accountId`, `module`, `isSettings`, `isTemplates`
- **mountPoints** — presence / class / childCount for `#app`, `#sidebar-v2`, the two nav containers, the conversations mount, the location switcher, search, quick actions, the channel-bar trigger, and the agency-logo container
- **sidebar** — open/collapsed state, all `sb_*` IDs found, unknown IDs vs. the known catalog, missing expected IDs, count of custom-link UUIDs (count only, never the UUIDs), currently-active IDs, and Spark injection markers
- **hubState** — `window.__SPARK_HUB.loaded` / `.failed` / config source
- **remotes** — best-effort federation status for `copilotApp` and `launchpadApp` (`loaded` / `failed` / `unknown`)
- **errors** — running count + last 10 recent (redacted)
- **perf** — `timeSinceLoadMs`, `snapshotMs`

## How to enable

```js
localStorage.SPARK_PROBE = '1';
location.reload();
```

Then in the console:

```js
__SPARK_PROBE.copy()              // validates + copies redacted JSON
__SPARK_PROBE.dump()              // returns the JSON string
__SPARK_PROBE.assertNoSecrets()   // throws if any secret survived
__SPARK_PROBE.snapshotNow()       // force an extra snapshot
__SPARK_PROBE.stop()              // stop and remove listeners
```

To disable, remove the localStorage key and reload, or call `stop()`.

`localStorage.SPARK_PROBE = 'ui'` reserves the floating-widget mode (v0.2 stub
— the data probe still runs as normal).

## What it redacts

Every captured error message and stack passes through `redact()`, which strips:

- JWTs → `[REDACTED-JWT]`
- emails → `[REDACTED-EMAIL]`
- phone numbers → `[REDACTED-PHONE]`

`__SPARK_PROBE.assertNoSecrets()` re-scans the entire serialized probe state
and **throws** if any of those patterns survived. Always run it (directly or
via `copy()` / `dump()`, which both call it) before pasting a dump anywhere.

## What it never captures

- `localStorage` / `sessionStorage` contents
- `location.search` (only `pathname`)
- Request or response bodies
- Input `.value`s
- `textContent` of `[data-contact-*]` nodes
- Tenant-specific custom-link UUIDs (only the count is recorded)
