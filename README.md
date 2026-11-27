# Portal Dashboard

A redesign prototype of Portal, the partner dashboard for The Orange Card's payment orchestration platform. It is static HTML, CSS and JS: no framework, and no build step apart from design tokens.

- **Preview:** open `index.html` in a browser. It links to every page and to the component gallery.
- **Continue the work:** read [`docs/HANDOFF.md`](docs/HANDOFF.md) for structure, rules, the shared API and page status.
- **Design system:** see [`design-system/README.md`](design-system/README.md) for tokens, components and how a token change spreads through the system.
- **Testing:** see [`docs/TESTING.md`](docs/TESTING.md).
- **Product context:** see [`PROJECT_DESCRIPTION.md`](PROJECT_DESCRIPTION.md). The previous version's screenshots are in `Last version design/`.

```bash
node design-system/scripts/build-tokens.mjs                            # rebuild tokens after editing design-system/tokens/*.json
node tools/check-page.js "$PWD/pages/overview.html" /tmp/ov shot dark  # screenshot + console check (needs Playwright)
```
