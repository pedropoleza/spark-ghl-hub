---
name: Bug report
about: Something is broken in the hub
title: '[bug] '
labels: bug
---

## What happened
<description>

## Expected
<what should have happened>

## Steps to reproduce
1.
2.
3.

## Environment
- GHL location ID:
- Sidebar version (URL `?v=` param):
- Browser + version:
- Affected modules:

## DOM probe dump
Run in DevTools console:
```js
localStorage.SPARK_PROBE='1'; location.reload();
// reproduce the bug, then:
copy(JSON.stringify(window.__SPARK_PROBE, null, 2))
```
Paste below:
```json
```

## Console errors
<paste any red errors from DevTools>

## Screenshot
<drag & drop>
