# Spark Sidebar Customizer

Custom CSS + JS theme for the Sparkleads GoHighLevel (GHL) sidebar.

## Architecture

Two production files deployed to Vercel, loaded by GHL via Custom Code:

- **`dist/spark-sidebar.css`** — Theme, layout, ordering, hiding, collapsible styles
- **`dist/spark-sidebar.js`** — Templates link injection, Other Tools folder, expandable sub-menus, settings collapsible sections, SPA route handling

## Deployment

```bash
cd "/Users/pedropoleza/SPARK APPS/spark-side-bar"
vercel deploy dist/ --prod --yes
```

**Production URL:** `https://dist-iota-one-53.vercel.app`

After deploying, bump the `?v=N` query param in GHL to bust cache:

- **Settings > Company > Whitelabel > Custom CSS:**
  ```
  @import url('https://dist-iota-one-53.vercel.app/spark-sidebar.css?v=N');
  ```

- **Settings > Company > Whitelabel > Custom JS:**
  ```html
  <script src="https://dist-iota-one-53.vercel.app/spark-sidebar.js?v=N"></script>
  ```

**Important:** Custom CSS field = raw CSS only (no `<style>` tags). Custom JS field = HTML with `<script>` tags.

## GHL Sidebar Structure

- Sidebar: `aside#sidebar-v2` (open: `.w-56`, collapsed: not `.w-56`)
- Main nav: `.hl_nav-header > nav` (flex container for ordering)
- Settings nav: `.hl_nav-header-without-footer` (different container)
- Settings footer nav: `.hl_nav-settings > nav`
- Menu items: `<a id="sb_xxx">` with `.nav-title` span for text
- Custom links: `<a id="UUID" class="custom-link">` with `<i>` FA icons
- Dividers: `<div class="divider">` with `<span class="uppercase">` section name
- Logo: `.agency-logo-container > img.agency-logo`
- Location switcher: `#location-switcher-sidbar-v2`
- Search: `#globalSearchOpener`
- Quick Actions: `#quickActions`
- Collapse button: `#sidebar-v2 > .absolute.z-50 > button > i.hl_collapse-button`

## GHL is a Vue SPA

- DOM is destroyed/recreated on route changes
- Use `routeChangeEvent` listener + `setInterval` polling to re-apply JS
- Settings page detected via `pathname.indexOf('/settings/') !== -1`
- Active items use classes `.active` and `.exact-active`

## CSS Techniques Used

| Technique | How |
|---|---|
| **Reorder items** | `flex` on nav + `order` on each `<a>` |
| **Hide items** | `display: none !important` |
| **Rename items** | `text-indent: -99999px` + `::after { content: "New Name" }` |
| **Active indicator** | `::before` pseudo-element, 3px blue bar with glow |
| **Collapsed sidebar** | `#sidebar-v2:not(.w-56)` selector |
| **Font** | `@import` Plus Jakarta Sans, applied to `.nav-title` etc (NOT `<i>` tags) |

## Known Menu Item IDs

### Main sidebar
| ID | Item |
|---|---|
| `sb_launchpad` | Launchpad (hidden) |
| `sb_dashboard` | Dashboard |
| `sb_conversations` | Conversations |
| `sb_opportunities` | Opportunities |
| `sb_calendars` | Calendars |
| `sb_contacts` | Contacts |
| `sb_email-marketing` | Marketing (in Other Tools) |
| `sb_automation` | Automation |
| `sb_sites` | Sites (in Other Tools) |
| `sb_memberships` | Memberships (in Other Tools) |
| `sb_app-media` | Media Storage (in Other Tools) |
| `sb_reputation` | Reputation (in Other Tools) |
| `sb_reporting` | Reporting |
| `sb_app-marketplace` | App Marketplace (in Other Tools) |
| `sb_location-mobile-app` | Mobile App (in Other Tools) |
| `sb_payments` | Payments (in Other Tools) |
| `sb_settings` | Settings |
| `sb_ai-employee-promo` | AI Promo (hidden) |
| `sb_AI Agents` | AI Agents (hidden, note: ID has a space) |

### Custom Menu Links (UUIDs)
| UUID | Item |
|---|---|
| `928e6850-5198-44cf-94fb-8d912e973243` | Five Rings Import |
| `fa3284a1-fd70-4acd-8c2e-8e2db702d5a8` | Tutoriais Spark |
| `425e6d9b-1b91-4fd9-9f4f-ae01f43724ca` | Templates (hidden — replaced by injected link) |
| `b967c18f-cfa6-4cb1-aa2a-340a1d2a5dfa` | Whatsapp |
| `b945dffb-70bb-40be-9219-dbcaafc178d4` | Whatsapp Connection (hidden, dupe) |
| `6656fbe08a310e28e65540b3` | WhatsApp (hidden, dupe) |

### Settings page
| ID | Item |
|---|---|
| `sb_business_info` | Business Profile |
| `sb_saas-billing` | Billing |
| `sb_my-staff` | My Staff |
| `sb_Opportunities-Pipelines` | Opportunities & Pipelines |
| `sb_calendars` | Calendars |
| `sb_location-email-services` | Email Services |
| `sb_phone-system` | Phone System |
| `sb_whatsapp` | WhatsApp |
| `sb_objects` | Objects |
| `sb_custom-fields-settings` | Custom Fields |
| `sb_custom-values` | Custom Values |
| `sb_manage-scoring` | Manage Scoring |
| `sb_domains-urlRedirects` | Domains & URL Redirects |
| `sb_external-tracking` | External Tracking |
| `sb_common.sidebar.lcIntegrations` | Integrations (moved to Business Services) |
| `sb_common.sidebar.privateIntegrations` | Private Integrations |
| `sb_tags` | Tags |
| `sb_labs` | Labs |
| `sb_audit-logs-location` | Audit Logs |

## Current Menu Order

1. Dashboard
2. Conversations
3. Opportunities (expandable: Pipeline, List View)
4. Calendars (expandable: Calendar View, Appointments, Settings)
5. Contacts (expandable: Smart Lists, Bulk Actions)
6. --- Divider ---
7. Tutoriais Spark (custom link)
8. Templates (injected, links to `/conversations/templates?tab=folders&page=1&size=20`)
9. Automation (expandable: Workflows)
10. Reporting (expandable: Reports, Attribution)
11. Five Rings Import (custom link)
12. Whatsapp (custom link)
13. Other custom links (auto-ordered)
14. **Other Tools folder** (collapsed by default): Marketing, Payments, Sites, Memberships, Media Storage, Reputation, App Marketplace, Mobile App

## Color Palette (CSS vars)

```
--s-bg: #13161c          (sidebar background)
--s-surface: #1a1e27     (cards, inputs)
--s-hover: #212733       (hover backgrounds)
--s-border: rgba(255,255,255,0.06)
--s-text-muted: #4b5468
--s-text: #8892a4        (default text)
--s-text-bright: #e2e6ed (hover/active text)
--s-blue: #3b82f6        (active accent)
--s-gold: #f5b731        (brand accent)
--s-radius: 10px
--s-t: 0.18s ease        (transition)
```

## Logo

Circular Spark logo, 56x56px, centered. Replaced via CSS `content` property:
```
https://assets.cdn.filesafe.space/efZEjK6PqtPGDHqB2vV6/media/67fd6cd5131f1be412b5955b.png
```

## Common Changes

### Hide a menu item
CSS: `#sb_ITEM_ID { display: none !important; }`

### Change menu order
CSS: `#sidebar-v2 .hl_nav-header > nav > a#sb_ITEM_ID { order: N !important; }`

### Rename a menu item (CSS only)
```css
#sb_ITEM_ID .nav-title { display: block !important; text-indent: -99999px !important; line-height: 0 !important; }
#sb_ITEM_ID .nav-title::after { content: "New Name" !important; line-height: initial !important; display: block !important; text-indent: 0 !important; }
```

### Add a new injected link
In JS `applySpark()`, create an `<a>` element similar to `spark-templates`. Set `data-spark='1'` so it gets cleaned on re-apply.

### Add sub-items to a menu item
In JS `SUB_ITEMS` config object, add entry: `'sb_ITEM_ID': [{ label: 'Name', path: '/route' }]`

### Change colors
Edit CSS variables in `:root { }` block.

### Change logo
Edit the `content: url('...')` in `#sidebar-v2 img.agency-logo`.

## Files in this project

```
dist/
  spark-sidebar.css     ← Production CSS (deployed to Vercel)
  spark-sidebar.js      ← Production JS (deployed to Vercel)
  vercel.json           ← CORS headers for Vercel
server.js               ← Local dev server (node server.js on port 3456)
index.html / styles.css / app.js  ← Customizer UI (legacy, not actively used)
```

## Gotchas

- GHL uses Tailwind CSS — almost all overrides need `!important`
- Never apply `font-family` to `<i>` tags — breaks Font Awesome icons
- Never use `overflow: hidden` on `#sidebar-v2` — breaks account switcher dropdown
- Never use `translateX` on hover — causes horizontal scrollbar
- Settings page uses `.hl_nav-header-without-footer` not `.hl_nav-header`
- Custom link IDs are UUIDs, use `a[id="UUID"]` selector (not `#UUID` if it has special chars)
- `a[id="sb_AI Agents"]` has a space in the ID — must use attribute selector
- GHL updates can change class names/structure — inspect and adapt
- Cache busting: always bump `?v=N` in GHL Custom Code after deploy
