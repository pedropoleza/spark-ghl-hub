# Security Policy — spark-ghl-hub

## Reporting a vulnerability

Email **info@sparkleads.pro** with the subject line:

```
[security] spark-ghl-hub
```

Please include a clear description, reproduction steps, and any proof-of-concept code or screenshots. **Do not open a public GitHub issue** for security reports — disclose privately first so a fix can ship before details are public.

## Supported versions

Only one version is supported: the current deploy at **`dist-iota-one-53.vercel.app`**, which tracks the `HEAD` of the `main` branch.

There are no semver promises yet. Older snapshots, forks, and local copies are not supported. If you can reproduce an issue against the live deploy, it qualifies.

## Scope

**In scope:**

- XSS via DOM injected by `spark-sidebar.js`, `spark-onboarding.js`, or any other script under `dist/`
- Secret leakage via the dom-probe diagnostic dump
- Privilege escalation via the `fetch` interceptor
- Row-Level Security (RLS) bypass via Supabase config writes from the client

**Out of scope:**

- Vulnerabilities in GoHighLevel itself (report those to HighLevel)
- Vulnerabilities in third-party CDNs we load assets from
- Social-engineering, physical access, or denial-of-service against Vercel/Supabase infrastructure
- Best-practice nits without a demonstrable security impact

## Known design notes (not vulnerabilities)

The following are intentional and have already been reviewed. Please do not report them as vulnerabilities:

- **Supabase anon key in `dist/spark-onboarding.js` is intentional.** It is the public anonymous key and is protected by Row-Level Security policies on the database side. Finding it in the bundle is expected.
- **All debug flags are gated by `localStorage` and off by default.** A user must explicitly opt in (for example, by setting a flag in their own browser's `localStorage`) before any debug output is produced.
- **The dom-probe explicitly redacts sensitive material** before capture: JWTs, email addresses, phone numbers, and the contents of `sessionStorage` and `localStorage` are stripped from its output.

If you believe one of the above protections is broken or bypassable (for example, a code path that emits a non-redacted dom-probe capture, or an RLS policy that allows an unintended write), that **is** in scope and we would like to hear about it.

## Response time

Best effort: an acknowledgement within **7 days** of your report. Complex issues may take longer to triage and fix, and we will keep you updated on progress.

Thank you for helping keep Spark and our users safe.
