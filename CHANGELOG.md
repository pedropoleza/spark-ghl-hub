# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

When you ship a change that requires users to bump `?v=N` in their GHL Custom
Code, add a "Cache bump required" callout under the relevant version.

## [Unreleased]

### Added
- (placeholder)

### Changed
- (placeholder)

### Fixed
- (placeholder)

## [0.1.0] - 2026-06-20

### Added
- Initial public release scaffolding (LICENSE, README, CONTRIBUTING, SECURITY, issue/PR templates)
- `dist/modules/dom-probe.js` — gated DOM + error probe (`localStorage.SPARK_PROBE='1'`)
- `dist/modules/account-overrides.js` — extracted from `spark-sidebar.js` (fallback config; Supabase fetch coming)
- `docs/` directory placeholder (full architecture docs in next release)

### Existing features (rolled into 0.1.0)
- Sidebar theme + reorder + hide/rename
- Other Tools folder (collapsible)
- Expandable sub-menus (Opportunities, Contacts, Calendars, etc.)
- Settings page collapsible sections
- Conversations channel rename (SMS → "Whatsapp QR/SMS")
- 5MB upload → shortlink fix (gated `localStorage.SPARK_5MB_FIX='1'`)
- Templates link injection
- Account-specific dashboard replacement (UxgO7..., NdzeZ...)
- Onboarding widget loader
- Debug network capture (gated `localStorage.SPARK_DEBUG='1'`)
