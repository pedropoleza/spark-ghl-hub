# Contributing to spark-ghl-hub

Thanks for your interest in improving the Spark GHL Hub. This guide covers everything you need to add a module, fix a bug, or improve the docs.

## Getting started

```bash
git clone https://github.com/sparkleads/spark-ghl-hub.git
cd spark-ghl-hub
node server.js
```

The local dev server serves the `dist/` directory at `http://localhost:3456`. There is no build step — edit files in `dist/` and refresh.

You will need Node 18+ installed. No `npm install` is required (the server has zero dependencies).

## Project layout

```
dist/
  spark-sidebar.css         Loader stylesheet (imports module CSS)
  spark-sidebar.js          Loader script (boots window.__SPARK_HUB and modules)
  modules/                  Feature modules (one folder per module)
    _template.js            Starter template for new modules (planned)
    <module-id>/
      index.js
      styles.css
      README.md
  probe-baselines/          DOM snapshots per release (used by dom-probe)
docs/
  01-architecture.md
  02-patterns.md
  03-gotchas.md
  06-modules/               One doc per module
server.js                   Local dev server (port 3456, serves dist/)
```

## Add a new module

1. Copy `dist/modules/_template.js` to `dist/modules/<your-id>/index.js`.
2. Register the module on load:

   ```js
   window.__SPARK_HUB.register({
     id: 'your-id',
     version: '0.1.0',
     match: function (ctx) { return ctx.path.indexOf('/contacts') === 0; },
     configSchema: { /* JSON schema for module options */ },
     init: function (ctx) { /* DOM mutations, listeners, cleanup */ }
   });
   ```

3. Add a doc at `docs/06-modules/<your-id>.md` describing what the module does, which routes it targets, and any configuration.
4. If your module ships CSS, put it next to `index.js` and import it from the loader.

Keep modules self-contained. Avoid reaching into other modules' DOM or state.

## Test in a real GHL account

Manual verification in a live GHL location is required before opening a PR. Automated tests cannot catch the SPA re-render edge cases.

1. Deploy a preview build:

   ```bash
   vercel deploy dist/ --token=$VERCEL_TOKEN
   ```

2. Copy the preview URL printed by the CLI.
3. In GHL: Settings > Company > Whitelabel > Custom CSS and Custom JS — temporarily swap the production URL for your preview URL.
4. Reload GHL, walk through the affected routes, and confirm the change behaves correctly across at least: the main sidebar, the Settings page, the collapsed sidebar state, and one SPA route transition.
5. Revert the GHL Custom Code back to the production URL when done.

Include screenshots or a short screen recording in the PR.

## Run dom-probe

Run `dom-probe` before and after your change to confirm the GHL DOM you depend on has not regressed:

```bash
node tools/dom-probe.js --baseline dist/probe-baselines/<release>.json
```

A diff with unexpected removals usually means a selector needs updating. Commit a new baseline only when the change to GHL is intentional and verified.

## Code style

- Vanilla JavaScript only. No TypeScript, no bundler, no transpiler.
- 2-space indent, single quotes, semicolons.
- ES5-compatible output. Some agencies still use older Safari — avoid `let`/`const` in hot paths only if you have a measured reason; otherwise modern syntax is fine as long as it parses in Safari 12+. No optional chaining, no nullish coalescing, no arrow functions in places that must be ES5.
- CSS: `!important` is acceptable and often necessary — we are overriding Tailwind utility classes. Prefer `:has()` over JS for conditional styling where browser support allows.
- Keep selectors as specific as possible without becoming brittle. Prefer stable IDs (`#sb_*`) over class chains.

## PR checklist

See `.github/pull_request_template.md`. At minimum, every PR should confirm:

- Tested in a live GHL location (note which one).
- `dom-probe` run before and after.
- Docs updated (`docs/06-modules/<id>.md` or relevant architecture doc).
- No new console errors in GHL with the module loaded.
- Cache-bust note included for the release.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new module or capability
- `fix:` bug fix
- `docs:` documentation only
- `chore:` tooling, deps, housekeeping
- `refactor:` code change that neither fixes a bug nor adds a feature

Scope is optional but encouraged: `feat(other-tools): collapse by default`.

## Release process

1. Merge PR to `main`.
2. GitHub Actions deploys `dist/` to Vercel production.
3. Reminder: bump the `?v=N` query param in your GHL Custom Code so clients pick up the new build:

   ```
   @import url('https://dist-iota-one-53.vercel.app/spark-sidebar.css?v=N');
   <script src="https://dist-iota-one-53.vercel.app/spark-sidebar.js?v=N"></script>
   ```

   Without the bump, browsers will keep serving the cached version for hours.

Questions? Open a discussion on the repo before sinking time into a large change.
