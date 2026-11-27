# Portal Design System — v0.1.0 (review)
Import tokens.css once at application root; select light/dark via data-theme on html. Load Inter through the application's existing font pipeline. tokens.json contains the same resolved values, in CSS-ready format (not a Figma import format).
Use semantic variables rather than hard-coded colors. Primary #FF6F00 uses #171717 foreground (6.42:1); white text fails (2.79:1). Use accent for selected navigation, ring for keyboard focus. Never encode status or Live/Test through color alone. Use tabular numerals for money, preserve currency and time range. Do not aggregate currencies without defined conversion.
## Proposed component contract (not verified Figma mappings)
| Component | Token bindings | Behavior / states |
|---|---|---|
| Button | primary, primary-foreground, secondary, destructive, ring, border-radius-md | default, hover, pressed, focus, disabled, loading; confirm destructive actions |
| Input / search / select / textarea | card, foreground, input, muted-foreground, ring, destructive, border-radius-md | label, placeholder, focus, error, disabled, read-only |
| Checkbox / radio / switch | primary, primary-foreground, input, ring | checked, unchecked, mixed where applicable, disabled |
| Badge / status | success, warning, destructive, info, muted-foreground and matching opacity-*-10 | textual labels, not color alone |
| Tooltip / dropdown / popover | popover, popover-foreground, border, shadow-default | keyboard access, dismiss, focus return |
| Dialog / drawer | card, card-foreground, custom-backdrop-overlay, border-radius-lg | focus trap, escape, restore focus; confirm live destructive actions |
| Tabs / sidebar / breadcrumb | sidebar, sidebar-foreground, sidebar-primary, sidebar-primary-foreground, sidebar-accent, sidebar-ring | current item, hover, focus, collapsed navigation |
| Card / KPI | card, card-foreground, border, typography-h2, typography-small | loading, error, empty, currency, date range |
| Table / filters / pagination | card, foreground, muted, muted-foreground, border, accent, ring | sort, filter, pagination, loading, empty, error, selected rows; right-align amounts; copy IDs |
| Chart | chart-1 through chart-5, muted-foreground, border | legend, accessible values, tooltip; stable series identity |
| Alert / toast | info, success, warning, destructive, matching opacity-*-10 | message, action, dismiss; announce changes |
| Skeleton / empty state | muted, muted-foreground, card | loading, no data, filtered-empty, error recovery |
| Shell / environment control | background, sidebar, border, ring, info | persistent explicit Live/Test label; environment not coupled to theme |
| Payment detail / receipt | card, border, foreground, muted-foreground, status colors | timeline, provider reference, failure reason, copy IDs, related webhook |
| API key / webhook management | table, input, dialog and status contracts | reveal once, revoke confirmation, retry, logs; role-aware |
| Card program / reports / settings | shell, table, form, status contracts | issuer filter, permissions, export and report states subject to backend support |
All entries are proposed semantic bindings, not actual Figma node/variant IDs. Hover and pressed values, spacing, font weights, line height, and component dimensions still need approval; do not infer from this table. No component implementation included.
## Migration and review
118 source names retained as normalized unique CSS custom properties; external aliases resolved from the uploaded export (source primitive collections not supplied); internal alias values resolved for CSS output. Original Figma export remains untouched. Existing code syntax for malformed/duplicate custom properties is normalized; developer must migrate old references. No token deletion until actual usage inventory is available. Verify source license, Figma font/style bindings, exact component and variant mapping, frontend framework, keyboard navigation and contrast across all states before production. Dark mode is optional for product release but retained for compatibility.
