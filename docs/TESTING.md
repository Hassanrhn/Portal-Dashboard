# Testing a page

These pages are static, so a headless browser is enough to check them. Chromium and Playwright must be installed (`npm i -D playwright`, then `npx playwright install chromium`).

```bash
node tools/check-page.js "$PWD/pages/transactions.html" /tmp/tx shot dark shot mobile
```

- The script prints `no errors`, or each console error or CSP violation.
- It writes `/tmp/tx-0.png`, `/tmp/tx-1.png` and so on: one for each `shot`, plus the final state.
- Actions run in order:
  - `dark` switches the theme
  - `click:<css selector>` clicks an element
  - `type:<selector>=<text>` fills a field
  - `wait:<ms>` pauses
  - `mobile` (first argument only) uses an iPhone 13 viewport
  - `full` captures the full page

Check before you push:

1. No console errors.
2. Light and dark both look right.
3. 390px wide: no horizontal page scroll; the sidebar becomes a drawer.
4. Keyboard: Tab reaches every control, Esc closes drawers, dialogs and menus.
5. Rebuild tokens if any JSON changed: `node design-system/scripts/build-tokens.mjs`.
