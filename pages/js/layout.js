/*
 * Dashboard chrome shared by every internal page: sidebar, mobile top bar, Test-mode strip, ⌘K palette.
 * Pages declare <body data-page="id"> and an empty <div class="app" data-app><div class="main">…</div></div>.
 * The nav below is the single source of truth for sidebar items and page files.
 * Load after icons.js and dom.js, before components.js and shell.js.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, iconEl } = Portal;

  const NAV = {
    primary: [
      { id: 'overview', label: 'Overview', icon: 'home', href: 'overview.html' },
      { group: 'payments', label: 'Payments', icon: 'payments', children: [
        { id: 'transactions', label: 'Transactions', href: 'transactions.html' },
        { id: 'payouts', label: 'Payouts', href: 'payouts.html' },
        { id: 'refunds', label: 'Refunds', href: 'refunds.html' },
      ] },
      { group: 'cards', label: 'Cards', icon: 'cards', children: [
        { id: 'cardholders', label: 'Cardholders', href: 'cardholders.html' },
        { id: 'card-orders', label: 'Card orders', href: 'card-orders.html' },
        { id: 'issuers', label: 'Issuers', href: 'issuers.html' },
      ] },
      { id: 'reports', label: 'Reports', icon: 'reports', href: 'reports.html' },
    ],
    developers: [
      { id: 'api-keys', label: 'API keys', icon: 'key', href: 'api-keys.html' },
      { id: 'webhooks', label: 'Webhooks', icon: 'webhook', href: 'webhooks.html' },
      { id: 'event-logs', label: 'Event logs', icon: 'logs', href: 'event-logs.html' },
      { id: 'docs', label: 'Docs', icon: 'docs', href: 'docs.html' },
    ],
    footer: [
      { id: 'team', label: 'Invite your team', icon: 'invite', href: 'team.html' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: 'settings.html' },
      { id: 'support', label: 'Contact support', icon: 'support', href: 'support.html' },
    ],
  };
  Portal.nav = NAV;

  const current = document.body.dataset.page;
  const app = document.querySelector('[data-app]');
  const main = app?.querySelector('.main');
  if (!app || !main) return;

  const label = (text) => el('span', { className: 'nav__label', text });

  function link(item, { withIcon = true } = {}) {
    return el('a', { className: 'nav__item', attrs: { href: item.href, 'aria-current': item.id === current ? 'page' : false } },
      [withIcon && item.icon && iconEl(item.icon), label(item.label)]);
  }

  function group(item) {
    const id = `group-${item.group}`;
    const containsCurrent = item.children.some((c) => c.id === current);
    const open = containsCurrent || (item.group === 'payments' && current === 'overview');
    return [
      el('button', { className: 'nav__item', attrs: { type: 'button', 'data-disclosure': '', 'aria-expanded': String(open), 'aria-controls': id } },
        [iconEl(item.icon), label(item.label), iconEl('chevron-down', 'nav__chevron')]),
      el('div', { className: 'nav__group', attrs: { id } }, [el('div', { className: 'nav' }, item.children.map((c) => link(c, { withIcon: false })))]),
    ];
  }

  function themeSwitch() {
    return el('button', { className: 'theme-switch', attrs: { type: 'button', role: 'switch', 'aria-checked': 'false', 'aria-label': 'Dark mode', 'data-theme-toggle': '' } }, [
      el('span', { className: 'theme-switch__knob', attrs: { 'aria-hidden': 'true' } }),
      el('span', { className: 'theme-switch__icon theme-switch__icon--sun', attrs: { 'aria-hidden': 'true' } }, [iconEl('sun')]),
      el('span', { className: 'theme-switch__icon theme-switch__icon--moon', attrs: { 'aria-hidden': 'true' } }, [iconEl('moon')]),
    ]);
  }

  const logo = el('a', { className: 'sidebar__logo', attrs: { href: 'overview.html', 'aria-label': 'The Orange Card, go to Overview' } }, [
    el('span', { className: 'logo', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { className: 'logo__the', text: 'THE' }),
      el('span', { className: 'logo__word' }, [el('span', { className: 'logo__orange', text: 'ORANGE' }), el('span', { className: 'logo__card', text: 'CARD' })]),
    ]),
    el('span', { className: 'logo-mark', text: 'O', attrs: { 'aria-hidden': 'true' } }),
  ]);

  const sidebar = el('aside', { className: 'sidebar', attrs: { 'aria-label': 'Main' } }, [
    el('div', { className: 'sidebar__brand' }, [
      logo,
      el('button', { className: 'btn btn--ghost btn--icon btn--sm collapse-toggle', attrs: { type: 'button', 'data-collapse-toggle': '', 'aria-pressed': 'false', 'aria-label': 'Collapse sidebar' } }, [iconEl('sidebar')]),
    ]),
    el('div', { className: 'sidebar__actions' }, [
      el('div', { className: 'workspace' }, [el('span', { className: 'workspace__avatar', text: 'D', attrs: { 'aria-hidden': 'true' } }), label('Digital Center')]),
      el('div', { className: 'segmented segmented--sm segmented--block collapsible', attrs: { role: 'radiogroup', 'aria-label': 'Environment', 'data-segmented': '', 'data-env-control': '' } }, [
        el('button', { className: 'segmented__option', text: 'Live', attrs: { type: 'button', role: 'radio', 'aria-checked': 'true', 'data-value': 'live' } }),
        el('button', { className: 'segmented__option', text: 'Test', attrs: { type: 'button', role: 'radio', 'aria-checked': 'false', 'data-value': 'test' } }),
      ]),
      el('button', { className: 'btn btn--sm btn--block new-payment', attrs: { type: 'button', 'data-create-payment': '' } }, [iconEl('plus'), el('span', { text: 'New payment' })]),
      el('button', { className: 'search-trigger', attrs: { type: 'button', 'data-command-open': '', 'aria-label': 'Search (Ctrl or Command K)' } }, [iconEl('search'), el('span', { text: 'Search' }), el('span', { className: 'kbd', text: '⌘K', attrs: { 'aria-hidden': 'true' } })]),
    ]),
    el('div', { className: 'sidebar__scroll' }, [
      el('nav', { className: 'nav', attrs: { 'aria-label': 'Primary' } }, NAV.primary.flatMap((item) => (item.group ? group(item) : [link(item)]))),
      el('p', { className: 'nav__section', text: 'Developers' }),
      el('nav', { className: 'nav', attrs: { 'aria-label': 'Developers' } }, NAV.developers.map((item) => link(item))),
    ]),
    el('div', { className: 'sidebar__foot' }, [
      ...NAV.footer.map((item) => link(item)),
      el('div', { className: 'meter' }, [
        el('div', { className: 'meter__row' }, [el('b', { className: 't-label', text: 'API requests' }), el('span', { text: '13.3k of 20.0k' })]),
        el('div', { className: 'progress', attrs: { role: 'progressbar', 'aria-label': 'API requests used this month', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '66' } }, [el('div', { className: 'progress__fill', attrs: { 'data-progress': '66' } })]),
      ]),
      el('div', { className: 'sidebar__row' }, [el('span', { text: 'Light mode', attrs: { 'data-theme-label': '' } }), themeSwitch()]),
      el('div', { className: 'user' }, [
        el('span', { className: 'user__avatar', text: 'P', attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'user__name', text: 'pocket@pocket.com' }),
        el('a', { className: 'btn btn--ghost btn--icon btn--sm', attrs: { href: 'login.html', 'aria-label': 'Sign out' } }, [iconEl('logout')]),
      ]),
    ]),
  ]);

  const pageTitle = document.body.dataset.title || document.querySelector('h1')?.textContent.trim() || 'Portal';
  const topbar = el('header', { className: 'topbar' }, [
    el('button', { className: 'btn btn--ghost btn--icon', attrs: { type: 'button', 'data-nav-open': '', 'aria-expanded': 'false', 'aria-label': 'Open navigation' } }, [iconEl('menu')]),
    el('span', { className: 'topbar__title', text: pageTitle }),
    el('button', { className: 'btn btn--ghost btn--icon', attrs: { type: 'button', 'data-command-open': '', 'aria-label': 'Search' } }, [iconEl('search')]),
    themeSwitch(),
  ]);
  const envStrip = el('div', { className: 'env-strip', attrs: { role: 'status' } }, [iconEl('alert'), 'Test mode: test data only. No real money moves.']);

  const palette = el('dialog', { className: 'dialog cmd', attrs: { id: 'command-palette', 'aria-label': 'Search' } }, [
    el('div', { className: 'cmd__search' }, [
      iconEl('search'),
      el('input', { className: 'cmd__input', attrs: { type: 'text', placeholder: 'Search payments, pages and actions', 'aria-label': 'Search', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'cmd-list', autocomplete: 'off', spellcheck: 'false', maxlength: '80' } }),
      el('span', { className: 'kbd', text: 'Esc' }),
    ]),
    el('div', { className: 'cmd__list', attrs: { id: 'cmd-list', role: 'listbox' } }),
  ]);

  app.prepend(el('div', { className: 'scrim', attrs: { 'data-nav-close': '' } }), sidebar);
  main.prepend(topbar, envStrip);
  document.body.appendChild(palette);
})();
