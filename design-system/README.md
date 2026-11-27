# Portal design system

Version 1.0 (review). Built from the Figma moodboard (file `Portal-Dashboard`, page *moodboard*), adapted to the Portal brand. The orange accent is kept; the neutrals, sizes, radii and component patterns follow the references.

The sign-in prototype (`pages/login.html`) deliberately keeps its own original design and is not built from this system.

## Preview

Open `index.html` at the repo root in a browser. No build step or server is needed. It links to:

| Page | File |
| --- | --- |
| Overview dashboard | `pages/overview.html` |
| Sign in (original v0.14, unchanged) | `pages/login.html` |
| Component gallery, with a live token panel | `design-system/preview/index.html` |

## Folder structure

```
design-system/
  tokens/                 ← source of truth (edit these)
    primitives.json         tier 1: raw values (colour scales, type sizes, spacing, radii, motion)
    semantic.json           tier 2: meaning, per theme (light / dark)
    components.json         tier 3: per-component tokens (button, input, nav, card, table…)
  scripts/build-tokens.mjs  JSON → css/tokens.css
  css/
    tokens.css              GENERATED, do not edit
    portal.css              single entry point; pages link only this
    foundations/            fonts, base reset, type roles
    components/             one file per component
    layouts/                app shell
  js/                       theme bootstrap, icons, component behaviour, app shell
  fonts/                    self-hosted Inter + JetBrains Mono (SIL OFL)
  preview/                  component gallery
pages/                      screens built from the system (html + css + js)
archive/v0/                 previous overview prototype and v0.1 tokens, for reference
```

## How tokens connect

```
primitives.json      color.neutral.790  = #2B2B2B
semantic.json        action.primary-bg  = {color.neutral.790}   (dark: #F3F3F3)
components.json      button.primary-bg  = {action.primary-bg}
button.css           .btn--primary { background: var(--button-primary-bg) }
```

The build emits every reference as `var()`, not as a copied value. A change at any tier therefore updates everything below it at runtime:

- Change `control.radius` and buttons, inputs and the segmented control all follow.
- Change `accent.solid` and the switch, progress bar, focus ring, nav icon and theme knob all follow.

Component CSS never contains raw colours or sizes. The build fails on unknown references, duplicate names, or light and dark modes with different keys.

```bash
node design-system/scripts/build-tokens.mjs
```

Theme: `data-theme="light|dark"` on `<html>`. It is set before first paint by `js/theme.js`, saved per browser, and defaults to the OS setting.

## Lazy loading (dashboard pages)

Every dashboard section is a lazy region. The sign-in page is excluded.

```html
<section class="card" data-lazy="volume" aria-busy="true">
  <div data-skeleton>…skeleton in the content's shape…</div>
  <div data-lazy-content>…real content…</div>
</section>
```

```js
Portal.lazy.register('volume', { fetch: () => api('/volume'), render: (data, el) => draw(data) });
Portal.lazy.reload('volume'); // e.g. after a filter change
```

`js/lazy.js` behaviour:

- A section fetches only when it comes within 120px of the viewport.
- The skeleton shows while the section is busy. Content then fades in, and `render` runs once it is visible, so charts can measure their size.
- A failed fetch shows an inline "Try again" instead of a blank card.

On Overview, `request()` in `pages/js/overview.js` simulates the API. Replace it with `fetch()`, and add the API host to the CSP `connect-src`.

## Rules

- No shadows. Surfaces separate by 1px borders and background steps; overlays use a blurred backdrop.
- Sentence case everywhere. Labels are never all caps.
- Status is never colour alone. Badges carry text.
- Money uses tabular figures, is right-aligned in tables, and always shows its currency and period.
- Destructive actions use `btn--danger` inside a dialog.
- Motion responds to user actions: the segmented indicator slides, the switch knob springs, nav groups expand, the copy button shows a check, the chart scrubs. On load there is one orchestrated moment, the KPI count-up and chart draw. `prefers-reduced-motion` turns all of it off.

## Front-end security

- Strict Content-Security-Policy on every page:
  - no inline scripts or styles, no third-party hosts;
  - `connect-src 'none'`, `form-action 'none'`, `base-uri 'none'`.
- No `innerHTML`. Dynamic content is built with `createElement` / `textContent`, and icons with `createElementNS`.
- `localStorage` holds UI preferences only (theme, sidebar, environment). Credentials, tokens and data are never stored.
- `referrer: no-referrer` and `noindex` on every page.
- **The server must still:**
  - send `frame-ancestors 'none'` (or `X-Frame-Options: DENY`), HSTS and the same CSP as HTTP headers. `frame-ancestors` has no effect in a `<meta>` tag.
  - enforce auth, rate limits and session cookies (`HttpOnly`, `Secure`, `SameSite=Strict`).

## Open items

- Focus and error states were not in the references. They follow the accent ring and the danger colour.
- Gumloop's own dark screens were the reference for the dark palette.
- Data on all pages is sample data (`pages/js/overview-data.js`).
