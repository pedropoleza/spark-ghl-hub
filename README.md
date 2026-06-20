# Spark GHL Hub

Open-source customization hub for GoHighLevel white-label instances.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Vercel](https://img.shields.io/badge/Vercel-deploy-black?logo=vercel)](https://dist-iota-one-53.vercel.app)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

---

## What it does

Spark GHL Hub is a drop-in CSS + JS bundle that restyles and rewires the GoHighLevel sidebar, settings panel, and conversation surfaces for white-label agencies. It ships as two static assets served from a stable CDN — paste two snippets into your GHL whitelabel settings and the entire theme, navigation reorder, sub-menus, folders, and platform fixes apply instantly across every sub-account. No build step, no backend, no GHL app install.

![Spark sidebar](docs/screenshots/sidebar-after.png)

---

## Install

Three steps. No build, no CLI, no rebuild on update — the CDN serves the latest published version.

### 1. Add the CSS

Navigate to **Settings > Company > Whitelabel > Custom CSS** and paste:

```css
@import url('https://dist-iota-one-53.vercel.app/spark-sidebar.css?v=1');
```

### 2. Add the JS

Navigate to **Settings > Company > Whitelabel > Custom JS** and paste:

```html
<script src="https://dist-iota-one-53.vercel.app/spark-sidebar.js?v=1"></script>
```

### 3. Refresh GHL

Hard-refresh the page (Cmd/Ctrl + Shift + R). The new sidebar, theme, and modules load on every route, including SPA navigations.

> **Cache busting:** bump the `?v=N` query param whenever you want to force a fresh fetch of the assets across all users.

---

## Modules

The hub is split into focused modules. Each one is independently togglable and documented in `./docs/modules/`.

| Module | Description |
|---|---|
| `sidebar-theme` | Dark theme, Plus Jakarta Sans typography, active-state indicators, and color tokens for the entire `aside#sidebar-v2` shell. |
| `sidebar-folder` | Collapsible "Other Tools" folder that groups Marketing, Sites, Memberships, Media Storage, Reputation, App Marketplace, Mobile App, and Payments. |
| `sidebar-submenu` | Expandable sub-menus under top-level items (Opportunities, Calendars, Contacts, Automation, Reporting) with route-aware active states. |
| `settings-collapse` | Collapsible section groups on the Settings page so long nav lists stay scannable. |
| `templates-link` | Injects a direct "Templates" link to `/conversations/templates` and hides the duplicate custom-link entry. |
| `conv-channel-rename` | Renames noisy default conversation channel labels to agency-friendly names. |
| `msg-5mb-fix` | Replaces GHL's "Message exceeds 5MB" error with an auto-generated shareable link to the attachment. |
| `account-overrides` | Per-location overrides for logo, brand color, and module toggles via `localStorage`. |
| `onboarding-wizard` | First-run wizard for sub-account admins that points to docs, templates, and the WhatsApp connector. |
| `debug-capture` | Captures unhandled errors and slow network calls for support tickets. |
| `dom-probe` | One-shot DOM walker that dumps the current sidebar structure to console — useful when GHL ships a breaking change. |
| `sidebar-reorder` | Flexbox-based reorder of top-level nav items via `order:` so item position is deterministic across GHL deploys. |

---

## Debug flags

All flags are read from `localStorage` so you can toggle them per-user without redeploying. Open DevTools console on a GHL tab and run:

### `SPARK_DEBUG` — log network + lifecycle

```js
localStorage.SPARK_DEBUG = '1'; location.reload();
```

Logs every Spark module init, every SPA route change handled, and every network call intercepted by the hub. Dump the captured buffer with:

```js
copy(JSON.stringify(window.__sparkDebug || [], null, 2));
```

### `SPARK_5MB_FIX` — replace 5MB error with link

```js
localStorage.SPARK_5MB_FIX = '1'; location.reload();
```

Intercepts the "Message exceeds 5MB" toast and replaces the failed payload with an uploaded link to the attachment. Dump the last 20 intercepted attachments with:

```js
copy(JSON.stringify(window.__spark5mb || [], null, 2));
```

### `SPARK_PROBE` — DOM + error probe

```js
localStorage.SPARK_PROBE = '1'; location.reload();
```

Walks `#sidebar-v2`, captures the rendered structure, and listens for `window.onerror` + unhandled promise rejections. Dump the report with:

```js
copy(JSON.stringify(window.__sparkProbe || {}, null, 2));
```

Disable any flag with `localStorage.removeItem('SPARK_DEBUG')` (etc.) and reload.

---

## Documentation

Full module documentation, architecture notes, and the GHL DOM reference live in [`./docs/`](./docs/).

- [`docs/architecture.md`](./docs/architecture.md) — how the CSS + JS bundle is structured
- [`docs/modules/`](./docs/modules/) — one page per module
- [`docs/ghl-dom-reference.md`](./docs/ghl-dom-reference.md) — known IDs, classes, and selectors
- [`docs/deploying-your-own.md`](./docs/deploying-your-own.md) — fork, customize, and host on your own Vercel project

---

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the local dev loop, coding conventions, and the module-authoring checklist.

Short version:

```bash
git clone https://github.com/pedropoleza/spark-ghl-hub.git
cd spark-ghl-hub
node server.js   # serves dist/ on http://localhost:3456
```

Point your GHL Custom CSS/JS at `http://localhost:3456/spark-sidebar.css` and `http://localhost:3456/spark-sidebar.js` while iterating.

---

## License

[MIT](./LICENSE). Use it, fork it, ship it under your own brand.

---

## Acknowledgements

Built and maintained by [Sparkleads](https://sparkleads.pro) and contributors from the GHL agency community. Thanks to everyone who filed issues, shared selectors after GHL deploys, and tested modules in production.
