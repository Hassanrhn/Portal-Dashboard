# Portal: handoff and build guide

Start here if you are continuing this project, whether you are a person or an AI tool such as Codex or AntiGravity.

## What this is

A static, dependency-free HTML/CSS/JS prototype of **Portal**, the partner dashboard of a payment orchestration platform. The client is The Orange Card.

- Product context: `PROJECT_DESCRIPTION.md`
- Previous version screenshots: `Last version design/`
- Visual reference: Figma file `Portal-Dashboard`, page *moodboard*

Open `index.html` in a browser. No build or server is needed.

## Folder map

```
index.html                 Review hub (links to every page)
PROJECT_DESCRIPTION.md     Product, users, design review, IA, flows
docs/HANDOFF.md            This file
design-system/             Tokens, CSS components, shared JS (see design-system/README.md)
  tokens/*.json            Source of truth → run: node design-system/scripts/build-tokens.mjs
  css/portal.css           Single stylesheet entry
  js/                      theme, icons, dom helpers, components, patterns, lazy, shell
  preview/index.html       Component gallery
pages/                     One HTML file per screen
  js/layout.js             Sidebar, mobile top bar, Test strip, ⌘K: the NAV config lives here
  js/create-payment.js     Create payment drawer (any [data-create-payment] button)
  js/data/*.js             Sample data per domain (replace with API calls)
  js/<page>.js             Page logic
  css/<page>.css           Optional page-only styles (tokens only)
  login.html               ORIGINAL sign-in prototype. Do not restyle.
archive/v0/                Old prototypes, for reference only
```

## Rules (keep these)

1. **No hard-coded colours, sizes, radii or durations.** Use CSS variables from `design-system/css/tokens.css`. Add new values to `design-system/tokens/*.json` and rebuild.
2. **No shadows.** Use 1px borders and background steps. Overlays use a blurred backdrop.
3. **Sentence case.** No all-caps labels. Status is never colour-only; badges have text.
4. **Security (CSP is strict):**
   - No inline `<script>` or `<style>`, no `style=""` attributes, no `innerHTML`.
   - Build DOM with `Portal.el()`. Setting properties via `el.style.setProperty` in JS is fine.
   - No third-party URLs.
5. **Money:**
   - Decimal strings at the API boundary, shown with `Portal.fmt.money()`.
   - Right-aligned in tables with `num: true`.
   - Always shows its currency.
6. **IDs are copyable** (`Portal.copyable(id)`).
7. **Destructive actions** go in a `Portal.menu.button()` overflow and are confirmed with `Portal.confirm({ tone: 'danger' })`.
8. **Every data section is lazy:**
   - Put `data-lazy="name" aria-busy="true"` on the section.
   - Inside it, add a `data-skeleton` placeholder and a `data-lazy-content` wrapper.
   - Register it with `Portal.lazy.register(name, { fetch: () => Portal.request(data), render })`.
9. **Do not change** `pages/login.html`. Do not redesign `pages/overview.html`.

## Page template

Copy `pages/transactions.html`. Keep the `<head>` exactly, including the CSP meta, and keep the script order:

```
theme.js (no defer) → icons → dom → layout → components → patterns → lazy → data → page.js → create-payment → shell
```

- `<body data-page="<id>">`, where the id matches `Portal.nav` in `pages/js/layout.js`.
- The body contains `<div class="app" data-app><div class="main"><main class="page" id="main">…</main></div></div>`. The layout script injects the sidebar, top bar and palette.

## Shared JS API (window.Portal)

| Helper | Use |
| --- | --- |
| `el(tag, {className,text,attrs,on,dataset}, children)` | Safe element builder |
| `iconEl(name, cls)` / `<i data-icon="name">` | Icons (list in `design-system/js/icons.js`) |
| `btn(label, {variant,size,iconName,iconOnly,onClick,attrs})` | Button |
| `badge(status, label?)` | Status badge with tone mapping |
| `copyable(value, {mono,label})` | ID with copy button |
| `fmt.money/count/date/dateTime/time/relative/humanize` | Formatting |
| `codePanel(label, objectOrString)` / `jsonBlock(obj)` | Code / JSON viewer with copy |
| `request(value, {delay, fail})` | Simulated API latency. Replace with `fetch()` and allow the host in `connect-src` |
| `drawer.open({title, subtitle, body, footer, footNote})` | Right drawer. Returns `{setBody, setFooter, setTitle, close, body}` |
| `confirm({title, message, details:[[k,v]], confirmLabel, tone})` | Returns a Promise of true or false |
| `menu.button(items)` | Overflow menu. Items are `{label, icon, description, tone:'danger', onSelect}` or `'separator'` |
| `dataTable(host, {columns:[{label,render,num}], pageSize, empty:{icon,title,text,action}, onRowClick})` | Table with pagination and empty state. Call `.setRows(rows)` |
| `downloadCsv(filename, [{label,value}], rows)` | CSV export, protected against formula injection |
| `fieldError(input, message)` | Inline validation message (pass `''` to clear) |
| `trackDirty(form, saveBar, {onSave})` | Unsaved-changes bar for settings forms |
| `toast(message, {icon})` | Confirmation toast |
| `lazy.register(name, {fetch, render})` / `lazy.reload(name)` | Lazy sections |
| `searchIndex = [{label, hint, run}]` | Adds items to the ⌘K palette on this page |
| `[data-segmented]`, `[data-tabs]`, `[data-disclosure]`, `[data-switch]`, `[data-copy]`, `[data-dialog-open]` | Declarative components |

## CSS components (class names)

| Component | Classes |
| --- | --- |
| Layout | `page`, `page__head`, `page__sub`, `page__actions`, `stack`, `grid-2` |
| Cards and KPIs | `card`, `card__head`, `card__title`, `card__body`, `kpi-strip`, `kpi`, `delta--up/--down` |
| Tables | `table-card`, `toolbar`, `toolbar__search`, `toolbar__spacer`, `table`, `cell-sub`, `tile`, `table__lead`, `pagination` |
| Forms | `field`, `field__label`, `field__help`, `field__row`, `input`, `textarea`, `select`, `check`, `radio-cards`, `radio-card`, `form-grid(--2)`, `input-affix` |
| Controls | `switch` (role="switch"), `segmented`, `tabs` / `tabs__tab` (role="tab"), `btn` with variants `--primary/--ghost/--danger` and sizes `--sm/--lg/--xl/--icon` |
| Details | `kv` (dl), `rows` / `rows__item`, `timeline`, `code`, `chips` / `chip`, `amount-hero`, `note(--danger/--success)`, `banner`, `empty` |
| Settings | `settings`, `setting`, `setting__title/desc/control`, `save-bar` |
| Loading | `skeleton(--title/--figure/--text/--short/--pill/--bar/--block)`, `skeleton-list[data-rows]` |

## Page status

| Page | File | Status |
| --- | --- | --- |
| Overview | overview.html | Done |
| Transactions + payment detail, refund, cancel | transactions.html | Done (reference implementation) |
| Payouts | payouts.html | See the table at the bottom |
| Refunds | refunds.html | |
| Cardholders | cardholders.html | |
| Card orders | card-orders.html | |
| Issuers | issuers.html | |
| Reports | reports.html | |
| API keys | api-keys.html | |
| Webhooks | webhooks.html | |
| Event logs | event-logs.html | |
| Docs (+ go-live checklist, API explorer) | docs.html | |
| Team | team.html | |
| Settings | settings.html | |
| Contact support | support.html | |
| Sign in | login.html | Original, untouched |

## Domain facts to keep consistent

- Base URL `https://pay-api.the-block.com`. Header `X-Api-Key: <keyId>.<secret>`. JSON only; money is a decimal string.
- Routes and providers:
  - Crossmint: card, `FIAT_CARD`
  - ForumPay: crypto, also payouts
  - Blockchain rail: stablecoin, `CRYPTO`
- Currencies: USD, USDC, USDT, AED.
- Offering id is `PROVIDER.PRODUCT.VARIANT.ACTION`, where ACTION is PAYIN, PAYOUT, CANCEL, REFUND or QUERY.
- Payment status: PENDING, PAID, FAILED, CANCELLED (plus refunded states).
- Card issuers: Axys, Hypercard, Interlace. Card access needs an API key with the `CARDS` scope.
- Card webhooks: `card_order.status_updated`, `cardholder.status_updated`.
- Webhooks: at most 10 endpoints, at most 5 delivery attempts, then dead-lettered.
- Roles: Admin, Developer, Finance, Viewer. Finance never sees API keys.
- Signed-in user: `pocket@pocket.com`. Partner: The Orange Card. Today is 27 Nov 2026 (UTC).

## Verify a page

Use the Playwright test script described in `docs/TESTING.md`. It checks for console errors in light and dark, and at phone width.
