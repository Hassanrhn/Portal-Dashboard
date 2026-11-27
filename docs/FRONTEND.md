# Portal frontend guide

For the frontend team. This explains how the Portal prototype is built, the rules it follows, and how to extend it or connect it to the real API. Read `docs/HANDOFF.md` for the short version and page status, and `docs/API.md` for the backend contract.

## Contents

1. [Architecture](#1-architecture)
2. [Folder structure](#2-folder-structure)
3. [Design tokens](#3-design-tokens)
4. [CSS component catalogue](#4-css-component-catalogue)
5. [JavaScript API (`window.Portal`)](#5-javascript-api-windowportal)
6. [Page template and script order](#6-page-template-and-script-order)
7. [Adding a new page](#7-adding-a-new-page)
8. [Patterns](#8-patterns)
   - [Lazy sections and skeletons](#81-lazy-sections-and-skeletons)
   - [Drawers and bottom sheets](#82-drawers-and-bottom-sheets)
   - [Tables](#83-tables)
   - [Forms and validation](#84-forms-and-validation)
   - [Copy and identifiers](#85-copy-and-identifiers)
   - [Toasts](#86-toasts)
   - [Menus and the right-click menu](#87-menus-and-the-right-click-menu)
   - [⌘K search](#88-k-search)
   - [Test and Live environment](#89-test-and-live-environment)
   - [Theme](#810-theme)
9. [Responsive rules](#9-responsive-rules)
10. [Accessibility checklist](#10-accessibility-checklist)
11. [Security rules](#11-security-rules)
12. [Performance](#12-performance)
13. [Testing](#13-testing)
14. [Connecting the real API](#14-connecting-the-real-api)
15. [Coding conventions](#15-coding-conventions)
16. [Known limitations](#16-known-limitations)

---

## 1. Architecture

Portal is a set of static HTML pages with plain CSS and plain JavaScript. There is no framework, no bundler and no runtime dependency. Open `index.html` in a browser and every page works from the file system.

### Why no framework

- **Reviewable.** Designers, product and backend people can open any page and read its HTML, CSS and JS without installing anything.
- **Fast to change.** The prototype went through three feedback rounds in a short time. A token or class change shows up on reload.
- **Strict CSP is easy.** With no inline scripts, no eval and no third-party code, the Content-Security-Policy can be `default-src 'none'` with only `'self'` added back.
- **No lock-in.** The production team can choose its framework later. The design system (tokens, CSS classes, behaviours) carries over unchanged.

### How it maps to a framework later

The prototype is already organised like a component library. Each piece has a CSS class family and, where it has behaviour, a `Portal.*` helper.

| Prototype | In a framework (React, Vue, Svelte…) |
| --- | --- |
| `design-system/tokens/*.json` → `tokens.css` | Keep as is. Import `tokens.css` once at the app root |
| `design-system/css/components/*.css` | Keep as global CSS, or move each file next to its component |
| `Portal.btn()`, `.btn--primary` | `<Button variant="primary">` |
| `Portal.badge(status)` | `<StatusBadge status>` |
| `Portal.copyable(id)` | `<Copyable value>` |
| `Portal.drawer.open({...})` | `<Drawer open title footer>` |
| `Portal.confirm({...})` | `useConfirm()` returning a promise |
| `Portal.menu.button(items)` | `<OverflowMenu items>` |
| `Portal.dataTable(host, { columns })` | `<DataTable columns rows filters>` |
| `Portal.lazy.register(name, {...})` | A data hook (`useQuery`) plus `<Skeleton>` while loading |
| `Portal.toast()` | Toast provider |
| `Portal.fieldError()` | Form library error display |
| `Portal.data.*` and `Portal.request()` | API client module |
| `pages/js/layout.js` (NAV config) | App shell and router config |
| `data-page` on `<body>` | Current route |
| Deep links (`?payment=req_…`) | Route or search params |

When porting, keep the markup each helper produces (class names, ARIA attributes, `data-*` hooks), so the CSS keeps working without change.

## 2. Folder structure

```
index.html                    Review hub: links to every page and the component gallery
README.md                     Entry point with links to all docs
PROJECT_DESCRIPTION.md        Product, users, design review, IA
docs/
  HANDOFF.md                  Short build guide, rules, page status
  API.md                      Backend API specification
  FRONTEND.md                 This file
  DESIGN-PROCESS.md           How the design was reached
  TESTING.md                  Playwright check script
design-system/
  tokens/
    primitives.json           Tier 1: raw values
    semantic.json             Tier 2: meaning, per theme (light and dark)
    components.json           Tier 3: per-component tokens
  scripts/build-tokens.mjs    JSON → css/tokens.css
  css/
    tokens.css                GENERATED. Do not edit
    portal.css                The only stylesheet pages link
    foundations/              fonts.css, base.css, typography.css
    components/               One file per component (button.css, table.css, drawer.css…)
    layouts/app-shell.css     Sidebar, app bar, page layout
  js/
    theme.js                  Portal namespace, safe storage, theme before first paint
    icons.js                  Inline SVG icon set
    dom.js                    el(), btn(), badge(), copyable(), fmt, codePanel(), request(), countries
    components.js             Toast, segmented, disclosure, switch, copy, dialog, custom select, table labels
    patterns.js               Drawer, confirm, menu, tabs, dataTable with column filters, CSV, fieldError, trackDirty
    lazy.js                   Lazy sections
    shell.js                  Sidebar toggle, environment, ⌘K palette, right-click menu
  fonts/                      Self-hosted Inter, JetBrains Mono, Archivo (SIL OFL)
  preview/                    Design system site: tokens, components and their states
pages/
  <page>.html                 One file per screen
  css/<page>.css              Optional page-only styles (tokens only)
  js/layout.js                Sidebar, app bar, Test strip, palette markup. NAV lives here
  js/create-payment.js        Create payment drawer for any [data-create-payment] button
  js/<page>.js                Page logic
  js/data/*.js                Sample data per domain
  js/overview-data.js         Sample data for Overview
  assets/avatars/             Sample avatar SVGs (see LICENSE.md there)
  login.html                  Original sign-in prototype (v0.14). Do not restyle
tools/
  check-page.js               Screenshot plus console and CSP error check
  check-overflow.js           Finds horizontal overflow at phone width on every page
archive/v0/                   v0.1 tokens and the first prototype, for reference only
```

## 3. Design tokens

### 3.1 Three tiers

| Tier | File | Contains | Example |
| --- | --- | --- | --- |
| 1. Primitives | `primitives.json` | Raw values: colour scales (neutral, slate, orange, blue, pink, green, red, amber), font sizes, weights, spacing, radii, motion | `color.orange.500 = #FF6F00` |
| 2. Semantic | `semantic.json` | Meaning, defined once for `light` and once for `dark`: `bg`, `border`, `text`, `action`, `accent`, `status`, `chart`, `code` | `action.primary-bg = {color.orange.500}` |
| 3. Components | `components.json` | Per component and role: `focus`, `type`, `layout`, `control`, `button`, `input`, `nav`, `card`, `badge`, `table`, `switch`, `segmented`, `skeleton`, `progress`, `drawer`, `motion` | `button.primary-bg = {action.primary-bg}` |

Rules:

- Components reference semantic tokens or primitives, never raw values.
- Semantic tokens reference primitives. Both modes must define the same keys.
- CSS in `components/` and `pages/css/` uses only `var(--…)`. No hex values, pixel sizes, radii or durations.

### 3.2 The build script

```bash
node design-system/scripts/build-tokens.mjs
```

It reads the three JSON files and writes `design-system/css/tokens.css`:

- Tier 1 → `:root { --color-orange-500: #FF6F00; … }`
- Tier 2 → `:root, [data-theme="light"] { … }` and `[data-theme="dark"] { … }`
- Tier 3 → `:root { --button-primary-bg: var(--action-primary-bg); … }`

References (`{path.to.token}`) are written as `var(--path-to-token)`, not as copied values. The build fails on an unknown reference, a duplicate custom property name, or light and dark modes with different keys. Commit both the JSON and the generated `tokens.css`.

### 3.3 How a change propagates

```
primitives.json     color.orange.500       = #FF6F00
semantic.json       action.primary-bg      = {color.orange.500}
components.json     button.primary-bg      = {action.primary-bg}
button.css          .btn--primary { background: var(--button-primary-bg) }
```

- Change `color.orange.500` and every orange in both themes changes.
- Change `action.primary-bg` and every primary action changes, but not the orange used for focus rings or charts.
- Change `button.primary-bg` and only buttons change.
- Change `control.radius` and buttons, inputs and segmented controls follow.

Because the output uses `var()`, you can try a value live in the browser's devtools on `:root`, or in the "Try a token change" panel of the design system site (`design-system/preview/index.html`), before editing JSON.

### 3.4 Light and dark

- The theme is `data-theme="light|dark"` on `<html>`.
- Only tier 2 changes between themes. Primitives and component tokens are the same in both.
- The dark palette is measured from the Gumloop references: dark greys with steps between background, surface and raised layers, not pure black.
- Primary buttons are orange with dark text in both themes (`action.primary-fg = neutral.900`). White text on `#FF6F00` fails contrast (2.79:1); near-black passes (about 6.4:1).

### 3.5 Key values

| Token | Value |
| --- | --- |
| Body text | Inter 14px, line height 1.45 |
| Page title | 20px, medium |
| Labels | 13px; meta 12px |
| Mono | JetBrains Mono |
| Control heights | `control.height-sm/md/lg/xl` |
| Button radius | 10px; lip 3px |
| Sidebar width | 256px |
| App bar height | 56px |
| Page max width | 1120px |
| Page padding | 64px sides, 32px top (less on small screens) |
| Borders | 1px |
| Shadows | None |

## 4. CSS component catalogue

Pages link one stylesheet: `design-system/css/portal.css`. It imports tokens, foundations, components and the layout in a fixed order.

| Component | File | Classes | Notes |
| --- | --- | --- | --- |
| Page layout | `layouts/app-shell.css` | `app`, `sidebar`, `main`, `appbar`, `crumbs`, `page`, `page__head`, `page__sub`, `page__actions`, `stack`, `grid-2`, `env-strip` | `app.is-collapsed`, `app.is-nav-open` |
| Typography | `foundations/typography.css` | `t-title`, `t-heading`, `t-label`, `t-meta`, `u-mono`, `u-num`, `u-muted`, `u-sr-only` | `u-num` = tabular figures |
| Button | `components/button.css` | `btn`, `btn--primary`, `btn--ghost`, `btn--danger`, `btn--sm`, `btn--lg`, `btn--xl`, `btn--icon` | Primary and danger have a pressed "lip" (bottom edge) that sinks on press |
| Inputs | `components/input.css` | `input`, `textarea`, `select`, `input-group`, `input-affix`, `input--mono` | `aria-invalid="true"` shows the error state |
| Form layout | `components/form-controls.css` | `field`, `field__label`, `field__help`, `field__error`, `field__row`, `form-grid`, `form-grid--2`, `check`, `radio-cards`, `radio-card`, `cselect` | `cselect` is the custom select |
| Switch | `components/switch.css` | `switch` with `role="switch"` | |
| Segmented | `components/segmented.css` | `segmented`, `segmented--sm`, `segmented__option`, `segmented__count` | Sliding indicator |
| Tabs | `components/tabs.css` | `tabs`, `tabs__tab` (`role="tab"`) | Underline indicator |
| Badge | `components/badge.css` | `badge`, `badge--success/warning/danger/info` | Always has text |
| Card and KPI | `components/card.css` | `card`, `card__head`, `card__title`, `card__body`, `kpi-strip`, `kpi-strip--3`, `kpi`, `delta--up`, `delta--down` | |
| Table | `components/table.css` | `table-card`, `table-wrap`, `table`, `is-num`, `cell-sub`, `cell-actions`, `table__lead`, `pagination`, `column-filter__*`, `chip--filter` | Stacks on phones |
| Toolbar | `components/toolbar.css` | `toolbar`, `toolbar__search`, `toolbar__spacer` | Wraps; segmented scrolls on phones |
| Details | `components/descriptions.css` | `kv`, `rows`, `rows__item`, `timeline`, `timeline__item--success/warning/danger`, `code`, `chips`, `chip`, `chip--mono`, `amount-hero` | |
| Feedback | `components/feedback.css` | `note`, `note--danger`, `note--success`, `banner`, `empty`, `toast`, `toast-region`, `copy`, `copy__btn` | `copy__btn.is-copied` shows a check |
| Dialog | `components/dialog.css` | `dialog`, `dialog__head`, `dialog__body`, `dialog__foot`, `cmd` (palette) | Native `<dialog>` |
| Drawer | `components/drawer.css` | `drawer`, `drawer__head`, `drawer__body`, `drawer__foot`, `drawer__section` | Bottom sheet below 600px |
| Menu | `components/menu.css` | `menu`, `menu__item`, `menu__item--danger`, `menu__sep`, `menu__desc` | Also used by column filters and the right-click menu |
| Navigation | `components/nav.css` | `nav`, `nav__item`, `nav__group`, `nav__section`, `nav__label` | `[data-tooltip]` when collapsed |
| Settings | `components/settings.css` | `settings`, `setting`, `setting__title`, `setting__desc`, `setting__control`, `save-bar` | |
| Skeleton | `components/skeleton.css` | `skeleton`, `skeleton--title/figure/text/short/pill/bar/block`, `skeleton-list[data-rows]` | |
| Chart | `components/chart.css` | `chart__line`, `chart__area`, `chart__grid`, `chart__axis`, `chart__cursor`, `share__*` | |
| Logo | `components/logo.css` | `logo`, `logo__the`, `logo__orange`, `logo__card`, `logo-mark` | Archivo at 125% width |

Every component and its states (hover, focus, disabled, error, loading, empty) is shown on the design system site.

## 5. JavaScript API (`window.Portal`)

All helpers live on `window.Portal`. They build DOM with `createElement` and `textContent` only.

### 5.1 DOM and formatting (`dom.js`)

```js
Portal.el(tag, { className, text, attrs, on, dataset }, children)
```

Builds an element. `children` may be nodes, strings or falsy values (skipped). Attributes with `false`, `null` or `undefined` are skipped; `true` sets an empty attribute.

```js
const row = Portal.el('li', { className: 'rows__item' }, [
  Portal.el('span', { className: 'u-mono', text: 'payment.created' }),
  Portal.badge('delivered'),
]);
```

| Helper | Signature | Returns |
| --- | --- | --- |
| `iconEl` | `(name, className?)` | `<svg>`. Names are in `design-system/js/icons.js` |
| `btn` | `(label, { variant, size, iconName, iconOnly, onClick, attrs })` | `<button type="button">`. `iconOnly` sets `aria-label` |
| `badge` | `(status, label?)` | Badge with the tone for that status (see `STATUS_TONE` in `dom.js`) |
| `copyable` | `(value, { mono = true, label = 'Copy' })` | Value plus copy button |
| `fmt.money` | `(decimalString)` | `"1,850.75"` |
| `fmt.count` | `(n)` | `"13,300"` |
| `fmt.date` / `dateTime` / `time` | `(iso)` | UTC formatting |
| `fmt.relative` | `(iso, now?)` | `"14 min ago"`, `"yesterday"` |
| `fmt.humanize` | `(snake_case)` | `"Awaiting approval"` |
| `jsonBlock` | `(object)` | `<pre>` with coloured tokens |
| `codePanel` | `(label, objectOrString)` | Code block with a header and copy button |
| `request` | `(value, { delay, fail })` | Promise that resolves with `value` after a delay. Stand-in for `fetch` |
| `flag` | `(countryCode)` | Flag emoji with an accessible name |
| `countries` | array | `{ code, name, dial, flag }` |

### 5.2 Components (`components.js`)

| Helper or hook | Use |
| --- | --- |
| `Portal.toast(message, { icon, duration })` | Transient confirmation in a polite live region. At most three at once |
| `[data-segmented]` | Segmented control. Emits `segmented:change` with `detail.value`. `el.portalSelect(value)` sets it without an event |
| `[data-disclosure]` + `aria-controls` | Expand and collapse (nav groups) |
| `[data-switch]` | Switch. Emits `switch:change` with `detail.checked` |
| `[data-copy="value"]` | Copies on click, shows a check, toasts. `data-copy-toast` overrides the message (use it for secrets and long values) |
| `[data-dialog-open="id"]`, `[data-dialog-close]` | Open and close a native `<dialog>`. Backdrop click and Esc close it with an exit animation |
| `Portal.dialog.open(dialog)` / `.close(dialog)` | Same, in code |
| `[data-progress="0-100"]` | Progress bar fill |
| `Portal.initComponents(scope)` | Initialise the above inside new markup |
| `Portal.enhanceSelects(scope)` | Replace `select.select` elements with the custom dropdown. Runs on load. `data-native` opts out |

### 5.3 Patterns (`patterns.js`)

```js
const drawer = Portal.drawer.open({ title, subtitle, body, footer, footNote, onClose });
drawer.setBody(nodes); drawer.setFooter(nodes, note); drawer.setTitle(text); drawer.close();
```

```js
const ok = await Portal.confirm({
  title: 'Revoke Production checkout?',
  message: 'Requests using this key will fail immediately. This cannot be undone.',
  details: [['Key ID', 'pk_live_…94f2a'], ['Environment', 'Live']],
  confirmLabel: 'Revoke key', cancelLabel: 'Keep key', tone: 'danger',
});
```

With `tone: 'danger'` focus starts on Cancel, so Enter does not destroy anything.

```js
Portal.menu.button([
  { label: 'Rotate secret', icon: 'rotate', description: 'Old secret works for 24 hours more', onSelect: rotate },
  'separator',
  { label: 'Revoke', icon: 'trash', tone: 'danger', onSelect: revoke },
], 'Actions for Production checkout');
```

`items` can also be a function, evaluated each time the menu opens. `Portal.menu.open(anchor, items)` and `Portal.menu.close()` work with any anchor.

```js
const table = Portal.dataTable(host, { columns, pageSize, empty, onRowClick, rowLabel });
table.setRows(rows); table.setEmpty(empty); table.refresh(); table.rows;
```

See [Tables](#83-tables).

| Helper | Use |
| --- | --- |
| `Portal.downloadCsv(filename, [{ label, value }], rows)` | Builds a CSV in the browser, quotes every cell and neutralises formula injection |
| `Portal.fieldError(input, message)` | Shows or clears (`''`) an inline error, sets `aria-invalid` and `aria-describedby`. Returns `true` when valid |
| `Portal.trackDirty(form, saveBar, { onSave })` | Shows the save bar while the form differs from the saved state. `onSave` can return `false` to stop. Returns `{ reset, sync }` |
| `Portal.initTabs(scope)` | Underline tabs. Emits `tabs:change`. `list.portalSelect(value)` |

### 5.4 Shell and other modules

| Helper | File | Use |
| --- | --- | --- |
| `Portal.theme.get()`, `.set(theme, { animate, persist })`, `.toggle()` | `theme.js` | Theme |
| `Portal.store.get(key)`, `.set(key, value)` | `theme.js` | `localStorage` wrapper for UI preferences, never throws |
| `Portal.env.get()`, `.set('live'|'test', { announce })` | `shell.js` | Environment |
| `Portal.searchIndex = [{ label, hint, group, icon, run }]` | page scripts | Records for the ⌘K palette |
| `Portal.lazy.register(name, { fetch, render })`, `.reload(name)` | `lazy.js` | Lazy sections |
| `Portal.nav` | `layout.js` | The navigation config |
| `Portal.createPayment()` | `create-payment.js` | Opens the Create payment drawer |
| `Portal.data` | data files | Sample data (to be replaced) |

## 6. Page template and script order

Copy `pages/transactions.html`. Keep the `<head>` as it is.

```html
<!doctype html>
<html lang="en" data-theme="light" data-env="live">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'">
  <meta name="referrer" content="no-referrer">
  <meta name="robots" content="noindex, nofollow">
  <title>Transactions · Portal</title>
  <link rel="stylesheet" href="../design-system/css/portal.css">
  <script src="../design-system/js/theme.js"></script>
  <script src="../design-system/js/icons.js" defer></script>
  <script src="../design-system/js/dom.js" defer></script>
  <script src="js/layout.js" defer></script>
  <script src="../design-system/js/components.js" defer></script>
  <script src="../design-system/js/patterns.js" defer></script>
  <script src="../design-system/js/lazy.js" defer></script>
  <script src="js/data/payments.js" defer></script>
  <script src="js/transactions.js" defer></script>
  <script src="js/create-payment.js" defer></script>
  <script src="../design-system/js/shell.js" defer></script>
</head>
<body data-page="transactions">
<div class="app" data-app>
  <div class="main">
    <main class="page" id="main">…</main>
  </div>
</div>
</body>
</html>
```

Script order and why:

| Order | Script | Why here |
| --- | --- | --- |
| 1 | `theme.js` (no `defer`) | Sets `data-theme` before first paint, so there is no flash |
| 2 | `icons.js` | `Portal.icon` is needed by everything below |
| 3 | `dom.js` | `Portal.el`, `btn`, `badge` |
| 4 | `layout.js` | Injects sidebar, app bar, Test strip and palette markup before components initialise |
| 5 | `components.js` | Initialises segmented controls, switches, selects, also in the injected shell |
| 6 | `patterns.js` | Drawer, confirm, menu, tables |
| 7 | `lazy.js` | Must exist before page scripts register sections |
| 8 | `data/*.js` | Sample data. `refunds.js` and `reports.js` need `payments.js` first |
| 9 | `<page>.js` | Page logic |
| 10 | `create-payment.js` | The header's New payment button works on every page |
| 11 | `shell.js` | Last: wires the sidebar toggle, environment, palette (reads `Portal.searchIndex`) and right-click menu |

`defer` keeps the order and runs scripts after parsing. Page CSS, if any, goes in a second `<link>` after `portal.css`.

## 7. Adding a new page

Example: a "Disputes" page under Payments.

1. **Copy** `pages/transactions.html` to `pages/disputes.html`. Change `<title>` to `Disputes · Portal` and `data-page="disputes"`.
2. **Add it to the nav** in `pages/js/layout.js`:
   ```js
   { id: 'disputes', label: 'Disputes', href: 'disputes.html' },
   ```
   inside the `payments` group's `children`. The breadcrumb, sidebar highlight, tooltip and ⌘K "Go to" entry follow automatically.
3. **Write the head** of the page: one `h1.t-title`, one `page__sub` sentence, and at most one primary button in `page__actions`.
4. **Add a lazy section** for each block of data (see [8.1](#81-lazy-sections-and-skeletons)).
5. **Add sample data** in `pages/js/data/disputes.js`, deterministic (seeded random), and add its endpoint to `docs/API.md`.
6. **Write** `pages/js/disputes.js` in an IIFE with `'use strict'`. Use `Portal.dataTable`, `Portal.drawer`, `Portal.confirm`. Add records to `Portal.searchIndex`. Support a deep link (`?dispute=`).
7. **Page styles** only if needed, in `pages/css/disputes.css`, using tokens only.
8. **Link it** from `index.html` (the review hub).
9. **Check** with `tools/check-page.js` (light, dark, mobile) and `tools/check-overflow.js` (add the page name to its list).
10. **Update** the page status table in `docs/HANDOFF.md`.

## 8. Patterns

### 8.1 Lazy sections and skeletons

Every block of data on a dashboard page is a lazy section:

```html
<section class="card table-card" data-lazy="disputes" aria-busy="true" aria-label="Disputes">
  <div class="toolbar">…filters…</div>
  <div data-skeleton class="skeleton-list" data-rows="8"></div>
  <div data-lazy-content data-table></div>
</section>
```

```js
Portal.lazy.register('disputes', {
  fetch: () => Portal.request(Portal.data.disputes),
  render: (rows, section) => table.setRows(rows),
});
// After a filter that needs new data from the server:
Portal.lazy.reload('disputes');
```

- A section starts loading when it comes within 120px of the viewport.
- The skeleton has the shape of the content (KPI figures, chart block, table rows), so nothing jumps when data arrives.
- Content fades in, then `render` runs, so charts can measure their size.
- A failed `fetch` shows "This section didn't load." with Try again, not an empty card.
- `aria-busy` tells screen readers the section is loading.
- An empty `.skeleton-list` is filled with `data-rows` row skeletons automatically.

### 8.2 Drawers and bottom sheets

Detail views and multi-step forms open in a drawer from the right. Pages never navigate away for details, so the list keeps its filters and scroll position.

- Desktop: right side panel over a blurred backdrop.
- Below 600px: a bottom sheet. Dragging its header down more than 90px closes it.
- Esc, the close button and a backdrop click close it, with an exit animation (none with reduced motion).
- Multi-step flows (create payment: details → review → created; refund; new payout; new card order) replace the body and footer with `setBody` and `setFooter` in the same drawer. The footer always has Back or Cancel on the left and one primary action on the right.
- Footers hold actions; destructive ones (Cancel payment) use `btn--danger` and go through `Portal.confirm`.

### 8.3 Tables

```js
const table = Portal.dataTable(document.querySelector('[data-table]'), {
  pageSize: 12,
  onRowClick: openPayment,
  rowLabel: (p) => `payment ${p.id}`,
  empty: { icon: 'search', title: 'No payments match these filters', text: 'Try a wider date range or clear the filters.', action: Portal.btn('Clear filters', { onClick: clearFilters }) },
  columns: [
    { label: 'Request ID', filter: { type: 'text', value: (p) => p.id }, render: (p) => Portal.copyable(p.id, { label: 'Copy request ID' }) },
    { label: 'Status', filter: { type: 'options', value: (p) => p.status }, render: (p) => Portal.badge(p.status) },
    { label: 'Amount', num: true, filter: { type: 'number', value: (p) => p.amount }, render: (p) => amountCell(p) },
    { label: 'Date', num: true, filter: { type: 'date', value: (p) => p.created }, render: (p) => Portal.fmt.dateTime(p.created) },
  ],
});
table.setRows(rows);
```

**Columns.** `label`, `render(row)` (returns a node or string), `num: true` for right-aligned tabular numbers, `className` (for example `cell-actions`).

**Toolbar filters** (search, segmented status, selects, date range) live in the page's `.toolbar`. The page filters the rows and calls `setRows`. Counts on segments are computed with all other filters applied.

**Column filters.** A column with `filter` gets a filter button in its header.

| `filter.type` | Form | Chip text |
| --- | --- | --- |
| `text` | "Contains" input | `Reference: contains "ORD-104"` |
| `number` | Min and max | `Amount: 10 – 100` |
| `date` | From and to, with presets Today, Last 7 days, Last 30 days | `Created: Nov 1 – Nov 26` |
| `options` | Checkboxes with counts, built from the data or `filter.options` | `Status: Paid, Failed` |

- `filter.value(row)` returns the raw value to test. `filter.label(value)` names options (for example country codes to names). `filter.placeholder` sets the hint.
- Active column filters show as removable chips above the table, combine with AND, and work on top of the toolbar filters.
- Option counts reflect the other active filters, so users don't pick a value that returns nothing.
- When column filters remove every row, the empty state says so and offers "Clear column filters".
- On phones the header row is hidden, so a "Filter columns" button opens the same filters in a bottom sheet, with a count of active filters.
- With the real API, these map to query parameters such as `amount[gte]` (see `docs/API.md` section 4.3).

**Pagination** shows "1–12 of 64" and Page n of m. **Rows** with `onRowClick` are focusable and open with Enter. Clicks on buttons, links and inputs inside a row do not open it.

**Mobile stacking.** Below 600px a table card becomes a list of stacked rows. `components.js` copies each header's text into its cells' `data-label`, and CSS shows the label beside the value. Actions align right.

**Empty states** always say what happened and what to do next, with an action when there is one ("Create key", "Add endpoint", "Clear filters").

**CSV export** uses the rows after filtering (`table.rows` for toolbar filters).

### 8.4 Forms and validation

- Every input has a visible `<label>` (`field__label`) and a placeholder showing a realistic example (`ORD-10493`, `25.00`, `TQn9Y…`).
- Help text (`field__help`) states the rule before the user types ("Letters, numbers, - and _ only").
- Validate on submit (Review, Save), not on every keystroke. Use `Portal.fieldError(input, message)`; when anything fails, focus the first `[aria-invalid="true"]`.
- Messages say what to do: "Enter an amount like 25.00.", "The minimum for this offering is 5.00 USDT.", "This is not a valid TRC20 address."
- Money inputs use `inputmode="decimal"`, `u-num`, a `maxlength`, and keep the value as a string.
- Money-moving and destructive forms end in a review step or a `Portal.confirm` that repeats the amount, currency, destination and environment.
- Settings use one form across tabs with `Portal.trackDirty` and a save bar. Save validates every tab and jumps to the first tab with an error.
- The rules are listed in `docs/API.md` section 11; the server repeats them.

### 8.5 Copy and identifiers

- Every ID (request, refund, payout, cardholder, order, key, endpoint, delivery, batch, ticket) uses `Portal.copyable(id, { label })`.
- The copy button swaps to a check for 1.6 seconds and toasts "Copied req_8f3a91c2e7". Values over 40 characters toast "Copied to clipboard", so secrets and URLs are not echoed on screen.
- Use `data-copy-toast` for a custom message.
- Copy buttons stop click propagation, so copying in a table row does not open the drawer.
- If the clipboard is blocked, the toast says to select the text instead.

### 8.6 Toasts

`Portal.toast(message, { icon })` confirms an action that succeeded: "Payment cancelled", "Refund sent", "Key renamed". Rules:

- Past tense, short, sentence case, no exclamation marks.
- Do not toast errors that need action; show them inline. Use the `alert` icon for warnings that need no action ("Copy is blocked in this browser").
- Toasts announce through a polite live region and do not take focus.

### 8.7 Menus and the right-click menu

- Row actions go in an overflow menu (`Portal.menu.button`), one per row, not in a row of buttons. Destructive items are last, after a separator, in red, and always confirmed.
- Menus open with Enter or Space, move with arrow keys, close with Esc or Tab, and return focus to the trigger.
- **Right-click menu.** `shell.js` replaces the browser menu on dashboard pages with a Portal menu that fits what was clicked: Copy selection, Copy value (on an ID), Open details (on a table row), Open in new tab and Copy link (on a link), then Copy page link, Search, theme and Reload. Inputs and text areas keep the native menu (paste, spellcheck). Shift + right-click opens the native menu anywhere.

### 8.8 ⌘K search

- ⌘K or Ctrl+K, or the search button in the header, opens the palette.
- It lists, in order: records the page adds to `Portal.searchIndex`, every sidebar page ("Go to"), and actions (toggle dark mode, switch environment).
- Add records like this:
  ```js
  Portal.searchIndex = payments.slice(0, 40).map((p) => ({
    label: p.id, hint: `${p.ref} · ${p.amount} ${p.currency}`, group: 'Payments', icon: 'payments', run: () => openPayment(p),
  }));
  ```
- Matching is a case-insensitive "contains" on label and hint, top 12 results.
- With the backend, replace the per-page index with `GET /search` (debounced, see `docs/API.md` 8.17), keeping pages and actions local.

### 8.9 Test and Live environment

- The header's Test mode switch sets `data-env="test|live"` on `<html>` and stores it per browser (`portal:env`).
- In Test mode, a strip under the app bar says "Test mode: test data only. No real money moves." CSS keys off `[data-env="test"]`.
- Pages read it with `Portal.env.get()` or `document.documentElement.dataset.env`.
- Live-mode warnings: Create payment shows "You are in Live mode. This creates a real payment request." The API explorer on Docs only sends in Test mode.
- With the backend, every request sends `Portal-Environment: test|live`, and switching environment reloads lazy sections (`Portal.lazy.reload`) or the page. Never cache data across environments.

### 8.10 Theme

- `theme.js` runs in `<head>` without `defer`, reads `portal:theme` or the OS setting, and sets `data-theme` before first paint.
- The theme switch in the sidebar footer and the palette action call `Portal.theme.toggle()`. During a change, `is-theming` on `<html>` cross-fades colours for 260 ms.
- `Portal.theme.set(theme, { persist: false })` changes the theme without saving it. The design system site uses this for its preview tabs, so previewing dark mode does not change the app's saved theme.

## 9. Responsive rules

| Breakpoint | Changes |
| --- | --- |
| > 1100px | Full layout: sidebar 256px, KPI strips in a row, two-column grids |
| ≤ 1100px | KPI strips and two-column grids stack; page padding shrinks |
| 861–1100px | Sidebar can collapse to icons (state saved) |
| ≤ 860px | Sidebar becomes an off-canvas drawer opened by the header toggle, with a scrim; Esc closes it |
| ≤ 600px | Drawers become bottom sheets; tables stack into labelled rows; form grids become one column; toasts go full width; segmented controls scroll sideways; column filters open in a sheet |

Rules:

- **No horizontal page scroll** at 390px. `tools/check-overflow.js` checks every page. Only code blocks, segmented controls and tabs may scroll sideways inside themselves.
- Long text **wraps** (descriptions, notes) or is **truncated with an ellipsis** and a full value in `title` or a copy button (IDs, URLs, addresses). Use `min-width: 0` on flex and grid children so ellipsis works.
- Aim for touch targets of at least 40px on phones (WCAG 2.2 asks for 24px minimum; check icon buttons especially).
- Test at 390px (iPhone 13), 860px, 1100px and 1440px.

## 10. Accessibility checklist

- [ ] One `h1` per page; headings in order.
- [ ] Every control has a visible label or an `aria-label` (icon buttons always do).
- [ ] Focus is visible (accent ring from `focus.ring-*` tokens) and never removed.
- [ ] Tab reaches every control; Esc closes drawers, dialogs, menus, popovers and the mobile sidebar.
- [ ] Dialogs and drawers use native `<dialog>` with `showModal()`, so focus is trapped and returns to the opener.
- [ ] Destructive confirms start focus on Cancel.
- [ ] Status is never colour alone: badges have text, deltas have an arrow and a sign, chart series have labels and values.
- [ ] Segmented controls and tabs use `radiogroup`/`radio` and `tablist`/`tab` with arrow-key support.
- [ ] Switches use `role="switch"` with `aria-checked`.
- [ ] Custom selects use `listbox`/`option` with keyboard support, and keep the native `<select>` as the value.
- [ ] Table rows that open drawers are focusable with an `aria-label` ("Open payment req_…").
- [ ] Charts are keyboard-scrubbable (arrows, Home, End) and the readout shows the value in text.
- [ ] Loading sections set `aria-busy`; errors use `role="alert"`; toasts use a polite live region.
- [ ] Form errors are linked with `aria-describedby` and set `aria-invalid`.
- [ ] Contrast meets WCAG 2.1 AA in both themes (orange buttons use dark text).
- [ ] `prefers-reduced-motion` turns off count-ups, chart drawing, slides and skeleton shimmer.
- [ ] The collapsed sidebar shows tooltips on hover and on focus.
- [ ] Flags have an accessible country name, or are hidden when the text already names the country.

## 11. Security rules

1. **Content-Security-Policy** on every page (meta tag now, HTTP header in production):
   `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'`.
   No inline `<script>`, no inline `<style>`, no `style=""` attributes in HTML. Setting `el.style.setProperty()` from JS is allowed (CSSOM is not blocked by `style-src`).
2. **No `innerHTML`**, `outerHTML`, `insertAdjacentHTML` or `document.write`. Build DOM with `Portal.el` and `textContent`. Icons are built with `createElementNS`.
3. **No third-party URLs**: no CDN scripts, fonts or analytics. Everything is self-hosted.
4. **Secrets**:
   - API key secrets are shown once in a reveal dialog after creation or rotation. The dialog makes the user confirm they stored it before closing.
   - Webhook signing secrets are masked (`whsec_••••7Qx2`) and revealed for 10 seconds on request.
   - Secrets are never written to `localStorage`, URLs, logs, toasts or the console.
   - Key IDs in tables and logs are masked (`pk_live_…94f2a`).
5. **Storage**: `localStorage` holds UI preferences only (`portal:theme`, `portal:sidebar`, `portal:env`). Never tokens or data.
6. **URL parameters** used for deep links are length-limited (80 characters) and matched against known values or IDs before use. They are never inserted as HTML.
7. **CSV**: use `Portal.downloadCsv`, which neutralises formula injection.
8. **Links** that open new tabs use `noopener`.
9. **Production server** must add `frame-ancestors 'none'`, HSTS, `X-Content-Type-Options: nosniff` and the CSP as headers.
10. **Authorization** happens on the server. Hiding a button for a role is a convenience only.

## 12. Performance

- No framework and no dependencies. Each page loads one CSS file (plus optional page CSS) and about ten small scripts.
- Fonts are self-hosted variable WOFF2 files (Inter, JetBrains Mono, Archivo), Latin subset, with `font-display: swap`.
- Icons are inline SVG paths built in JS, so there are no icon requests.
- Lazy sections fetch only near the viewport; skeletons reserve space so there is no layout shift.
- Animations use `transform` and `opacity`. Count-ups and chart drawing run once on load.
- Avatars are small SVGs (about 10 KB each).
- With the backend: paginate on the server (25 per page), debounce search inputs (150 ms), cancel stale requests with `AbortController`, and pause the Event logs live tail when the tab is hidden.

## 13. Testing

Playwright and Chromium are needed (`npm i -D playwright`, then `npx playwright install chromium`).

```bash
# Screenshot, console and CSP errors, in light, dark and at phone width
node tools/check-page.js "$PWD/pages/transactions.html" /tmp/tx shot dark shot
node tools/check-page.js "$PWD/pages/transactions.html" /tmp/tx-m mobile shot click:"[data-create-payment]" shot

# Horizontal overflow at 390px on every page
node tools/check-overflow.js

# Rebuild tokens after editing JSON
node design-system/scripts/build-tokens.mjs
```

Actions for `check-page.js`: `dark`, `mobile` (first argument only), `full`, `shot`, `wait:<ms>`, `click:<selector>`, `type:<selector>=<text>`. See `docs/TESTING.md`.

Before pushing:

1. No console errors or CSP violations.
2. Light and dark both look right.
3. No horizontal scroll at 390px; the sidebar is a drawer.
4. Keyboard: Tab reaches everything, Esc closes overlays.
5. Tokens rebuilt if any JSON changed.

Suggested next step: add Playwright tests for the main flows (create payment, refund, approve payout, create key) and an axe accessibility scan per page.

## 14. Connecting the real API

### 14.1 Replace `Portal.request`

`Portal.request(value, { delay, fail })` in `design-system/js/dom.js` resolves with sample data after a delay. Replace it with an API client that keeps the same promise-based use:

```js
const API = 'https://pay-api.the-block.com';
let csrfToken = null;

Portal.api = async function api(path, { method = 'GET', body, query, idempotencyKey, signal } = {}) {
  const url = new URL(path, API);
  if (query) Object.entries(query).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) url.searchParams.set(k, v); });
  const headers = { Accept: 'application/json', 'Portal-Environment': Portal.env.get() };
  if (body) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    headers['X-CSRF-Token'] = csrfToken;
    headers['Idempotency-Key'] = idempotencyKey || crypto.randomUUID();
  }
  const response = await fetch(url, { method, headers, body: body && JSON.stringify(body), credentials: 'include', signal });
  if (response.status === 401) { window.location.href = 'login.html'; return new Promise(() => {}); }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || 'Request failed'), data?.error);
  return data;
};
```

- Load `GET /me` first to get `csrfToken`, the user and permissions.
- On `403 REAUTH_REQUIRED`, open a 2FA dialog, call `POST /auth/reauth`, and retry.
- Map errors with a `field` to `Portal.fieldError`; others to an inline note in the drawer.
- Keep money as strings end to end.

### 14.2 Replace the data files

Each `pages/js/data/*.js` file becomes calls in the page script's lazy `fetch`:

```js
// Before
Portal.lazy.register('transactions', { fetch: () => Portal.request(payments), render });
// After
Portal.lazy.register('transactions', { fetch: () => Portal.api('/payments', { query: currentQuery() }), render: (list) => { table.setRows(list.data.map(fromApi)); setCounts(list.counts); } });
```

- Write a small `fromApi` mapper per object, using the field mapping table in `docs/API.md` section 16, so page code changes as little as possible.
- Move filtering, sorting and pagination to the server: toolbar filters and column filters become query parameters (`docs/API.md` section 4), and `dataTable` should get a server mode (`onQueryChange` plus `setPage({ rows, hasMore, totalCount })`). Until then, client-side filtering works for small lists.
- After a create, update or delete, call `Portal.lazy.reload(name)` or update the row from the response.
- Remove the data `<script>` tags from each page when its file is no longer used.

### 14.3 Update the CSP

Allow the API host in `connect-src` on every page (meta tag and server header):

```
connect-src https://pay-api.the-block.com
```

If avatars or statement PDFs are served from another host, add it to `img-src` or use signed same-origin URLs. If the live tail uses Server-Sent Events, it uses `connect-src` too. Keep `form-action 'none'` unless the sign-in form posts directly.

### 14.4 Other wiring

- Sign-in (`login.html`) posts with `fetch`, handles 2FA and OAuth redirects, then goes to `overview.html`.
- Sign out calls `POST /auth/sign-out`.
- The sidebar user, usage meter and role-based visibility come from `GET /me`.
- Hide or disable actions the user's permissions do not allow, with a tooltip saying why ("Another admin must approve this payout").

## 15. Coding conventions

- **JS**: one IIFE per file with `'use strict'`. `const` by default. Two-space indent, single quotes, semicolons, trailing commas in multi-line literals. Short helpers at the top, page sections separated by comment rules.
- **No globals** except `window.Portal`. Page-only helpers stay inside the IIFE.
- **Data attributes for hooks** (`data-filter`, `data-table`, `data-export`), classes for styling. Do not select by styling classes in JS.
- **CSS**: BEM-like names (`block__element--modifier`), one file per component, tokens only, no `!important`, no IDs. Logical order: layout, box, type, colour, motion.
- **Copy**: sentence case, plain English, no exclamation marks, numbers with units and currency, "Cancel payment" not "Cancel" on destructive buttons. Uppercase only for codes (`PAID`, `FIAT_CARD`).
- **Money**: strings at the boundary, `fmt.money` for display, currency beside every amount, right-aligned in tables.
- **Dates**: UTC everywhere, shown with `fmt.*`, with `UTC` in titles where exact times matter.
- **Deterministic sample data**: seeded random, fixed "now" (27 Nov 2026, 12:00 UTC).
- **Comments** explain why, not what. Each file starts with a short header saying what it does.
- **Do not change** `pages/login.html`, and do not redesign `pages/overview.html` without design review.

## Round 4 changes (component rules)

- **Buttons** are tactile: a solid fill, a 4px darker lip, a 12px radius and bold labels. On press the button sinks onto the lip.
  - `btn--primary` (orange) is for the main action on a screen.
  - `btn--neutral` (graphite gray) is used **only** for Create payment / New payment (`[data-create-payment]`). Don't use it elsewhere.
  - `btn` (secondary), `btn--ghost` and `btn--danger` are unchanged.
  - Tokens: `button.lip`, `button.radius`, `button.neutral-*`, `button.primary-lip`.
- **Page headers** (`.page__head`): title and description on the left, actions on the right, vertically centred, never wrapping on desktop. On phones the actions stay opposite the title.
- **Phones (≤600px):** a button with an icon inside `.page__actions`, `.card__head`, `.toolbar` or `.appbar` drops its visible label and becomes a square icon button. The label stays available to screen readers, so always keep a text label or `aria-label`.
- **Context menu** (`shell.js`): items depend on the target, and only the most relevant ones are shown:

  | Target | Items |
  | --- | --- |
  | Selected text | Copy, Search for "…" |
  | Table row | Open details, Copy ID, Copy reference, Copy row |
  | Table header | Filter column |
  | Copyable value | Copy |
  | Link | Open in new tab, Copy link |
  | Elsewhere | New payment, Search, Copy page link |

  Text fields and Shift+right-click keep the native menu.
- **Scrollbars:** thin and token-coloured everywhere, on both axes (`scrollbar.*` tokens; `base.css`).
- **Usage meter / progress:** `[data-progress]` sets `data-level="warning"` at 75% or more and `"danger"` at 90% or more (`progress.fill-warning` / `progress.fill-danger`).
- **Theme preference:** `Portal.theme.setPreference('light' | 'dark' | 'system')`. System is the default and follows the OS live. `Portal.theme.preference()` reads it back. The sidebar switch sets an explicit light or dark choice. Preview pages use `Portal.theme.set(x, { persist: false })`.
- **KPI status values** (`.kpi__value .status-dot`) use 16px, not the figure size.

## Round 5 changes

- **Orange is for page-header actions only.** Any `btn--primary` or `btn--neutral` inside `.page__actions` renders orange with white text (`button.header-*` tokens). Everywhere else, `btn--primary` is graphite with white text.
- **Create payment** is only in the app bar, as an icon-only "+" button (`.new-payment`, `aria-label="New payment"`). Page headers no longer repeat it.
- **Usage meter** has three states from `[data-progress]`: `ok` (green, under 75%), `warning` (orange, 75–89%), `danger` (red, 90% and above).
- **Sidebar collapse** is applied before first paint: `theme.js` sets `html[data-sidebar="collapsed"]` from storage, so navigating between pages never animates the sidebar. The CSS keys off `.app:is(.is-collapsed, [data-sidebar="collapsed"] *)`.
- **Theme:** the sidebar no longer has a theme switch. Users change it in Settings → Appearance (Light, Dark or System).
- **Docs contents list** sticks 24px below the app bar: `top: calc(var(--layout-appbar-height) + var(--space-24))`.

## Round 6 changes

- **Content swaps animate.** Use `Portal.animateSwap(node)` whenever content is replaced in place: a short fade-and-rise (`.is-swapping`).
  - It is automatic for drawer and pop-up step changes (`setBody`), table re-renders (rows enter), tab panels and lazy sections.
  - The Docs API explorer calls it when the endpoint changes and when a response arrives.
- **Sortable columns.** `Portal.dataTable` makes every column with a `number` or `date` filter sortable. To sort another column, pass `sort: (row) => value`.
  - The header shows an arrow button: ↕ unsorted, ↑ ascending, ↓ descending.
  - Clicking cycles through them; `th[aria-sort]` reflects the state.
  - Sorting runs after column filters and before pagination.
- **Pop-up variant.** `Portal.drawer.open({ modal: true, … })` opens the same head/body/foot as a centred pop-up; it is still a bottom sheet on phones. Create payment (the app bar "+") uses it.

## 16. Known limitations

- All data is sample data; actions change in-memory objects and are lost on reload.
- Filtering, sorting and pagination run in the browser; they must move to the server for real volumes.
- `Portal.request` always succeeds unless told to fail; error states are only partly exercised.
- No real auth: the sign-in page redirects to Overview for the demo; there is no session, 2FA check, role or permission enforcement. All pages behave as an Admin.
- No routing: each page is a separate HTML file and reloads the shell. Deep links use query strings.
- The ⌘K palette only searches records loaded on the current page.
- Environment state is per browser (`localStorage`) and does not change the data shown.
- Overview metrics are fixed per range; metric definitions are not confirmed (see `docs/API.md`).
- PDF statements, the audit log, alerts delivery and the bell menu are not built.
- Charts are hand-written SVG for this dashboard's needs; a charting library may be wanted for more chart types.
- The custom select enhances `select.select` by patching `HTMLSelectElement.prototype.value` so page code keeps working; a framework port should use a proper listbox component instead.
- The sign-in page (`login.html`) is the original v0.14 design. It does not use the design system and keeps its own inline script and styles, so it does not follow the CSP rules above; it needs its own pass before production.
- No automated tests beyond the screenshot and overflow scripts.
- Only tested in recent Chromium; Safari and Firefox need a pass (especially `<dialog>`, backdrop blur and clipboard).
