## Summary

<short description of the change and why>

## Changes

- `dist/spark-sidebar.css` — <what changed>
- `dist/spark-sidebar.js` — <what changed>
- `docs/06-modules/<id>.md` — <what changed>

## Tested

- [ ] Loaded in a real GHL account (location ID: ___)
- [ ] No console errors after refresh
- [ ] Ran `localStorage.SPARK_PROBE='1'`, dump JSON shows no regressions vs baseline
- [ ] Screenshot of before/after (attach below)
- [ ] CSS changes: tested in collapsed AND expanded sidebar
- [ ] JS changes: tested with debug flags off (production parity)

## Security

- [ ] No new secrets in source
- [ ] No new selectors that could leak PII via dom-probe
- [ ] Any new fetch interceptors: documented in module file header

## Release

- [ ] If user-facing: bumped `?v=N` reminder noted in CHANGELOG.md
- [ ] Docs updated: `docs/06-modules/<id>.md`
