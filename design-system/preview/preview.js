/* Gallery-only behaviour: live colour list, token tuning panel, demo triggers. */
(function () {
  'use strict';

  const Portal = window.Portal;
  const root = document.documentElement;

  /* Colour roles: read the live computed value of each semantic token. */
  const COLOR_TOKENS = [
    'bg-app', 'bg-sidebar', 'bg-surface', 'bg-raised', 'bg-hover', 'bg-muted',
    'border-default', 'border-strong', 'border-subtle',
    'text-primary', 'text-secondary', 'text-tertiary',
    'action-primary-bg', 'action-secondary-bg', 'accent-solid', 'accent-subtle',
    'status-success-fg', 'status-success-bg', 'status-warning-fg', 'status-warning-bg',
    'status-danger-fg', 'status-danger-bg', 'status-info-fg', 'status-info-bg',
    'chart-1', 'chart-2', 'chart-3', 'chart-4',
  ];
  const grid = document.querySelector('[data-color-grid]');

  function toHex(color) {
    const probe = document.createElement('span');
    probe.style.color = color;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) || [];
    probe.remove();
    const [r, g, b, a] = rgb.map(Number);
    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    return a !== undefined && a < 1 ? `${hex} · ${Math.round(a * 100)}%` : hex;
  }

  function renderColors() {
    const styles = getComputedStyle(root);
    grid.replaceChildren(...COLOR_TOKENS.map((name) => {
      const card = document.createElement('div');
      card.className = 'pv-color';
      const chip = document.createElement('span');
      chip.className = 'pv-color__chip';
      chip.style.setProperty('--chip', `var(--${name})`);
      const label = document.createElement('span');
      label.className = 'pv-color__name';
      label.textContent = name.replace('-', '.');
      const value = document.createElement('span');
      value.className = 'pv-color__value';
      value.textContent = toHex(styles.getPropertyValue(`--${name}`).trim());
      card.append(chip, label, value);
      return card;
    }));
  }
  renderColors();
  new MutationObserver(() => window.setTimeout(renderColors, 280)).observe(root, { attributes: true, attributeFilter: ['data-theme', 'style'] });

  /* Token tuning: writes overrides on <html>; every component bound to the token follows. */
  document.querySelectorAll('[data-tune] [role="radio"]').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const group = swatch.closest('[data-tune]');
      group.querySelectorAll('[role="radio"]').forEach((s) => s.setAttribute('aria-checked', String(s === swatch)));
      if (swatch.dataset.value) root.style.setProperty(group.dataset.tune, swatch.dataset.value);
      else root.style.removeProperty(group.dataset.tune);
    });
  });
  document.querySelectorAll('[data-tune-range]').forEach((range) => {
    range.addEventListener('input', () => {
      const value = `${range.value}${range.dataset.unit}`;
      root.style.setProperty(range.dataset.tuneRange, value);
      document.querySelector(`[data-out="${range.dataset.outTarget}"]`).textContent = value;
    });
  });
  document.querySelector('[data-tune-reset]').addEventListener('click', () => {
    root.removeAttribute('style');
    document.querySelectorAll('[data-tune-range]').forEach((range) => {
      range.value = range.defaultValue;
      document.querySelector(`[data-out="${range.dataset.outTarget}"]`).textContent = `${range.defaultValue}${range.dataset.unit}`;
    });
    document.querySelectorAll('[data-tune] [role="radio"]').forEach((s, i) => s.setAttribute('aria-checked', String(i === 0)));
  });

  /* Demo triggers */
  document.querySelector('[data-demo-toast]').addEventListener('click', () => Portal.toast('API key created'));
  document.querySelector('[data-demo-busy]').addEventListener('click', (event) => {
    const button = event.currentTarget;
    button.setAttribute('aria-busy', 'true');
    window.setTimeout(() => button.removeAttribute('aria-busy'), 1400);
  });
  document.querySelectorAll('.pv-nav a').forEach((link) => link.addEventListener('click', (event) => event.preventDefault()));
})();

/* Light / Dark review tabs and the new component demos. */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const $ = (s) => document.querySelector(s);

  /* Theme tabs */
  const themeTabs = $('[data-preview-theme]');
  themeTabs.portalSelect?.(Portal.theme.get());
  themeTabs.addEventListener('segmented:change', (event) => Portal.theme.set(event.detail.value, { persist: false }));

  /* Header demo: Test mode switch */
  const env = $('[data-pv-env]');
  env.addEventListener('click', () => {
    const on = env.getAttribute('aria-checked') !== 'true';
    env.setAttribute('aria-checked', String(on));
    env.querySelector('.switch').setAttribute('aria-checked', String(on));
  });

  /* Copy */
  $('[data-pv-copy]').append(
    ...[['Request ID', 'req_8f3a91c2e7'], ['Wallet address', '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'], ['Webhook URL', 'https://api.theorangecard.com/webhooks/portal'], ['Support email', 'partners@the-block.com']]
      .map(([label, value]) => el('div', { className: 'pv-row' }, [el('span', { className: 'pv-label', text: label }), Portal.copyable(value)])),
  );

  /* Overlays */
  const sampleKv = () => el('dl', { className: 'kv' }, [['Request ID', Portal.copyable('req_8f3a91c2e7')], ['Route', 'Crossmint'], ['Amount', '25.00 USD']]
    .flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, [v])]));
  $('[data-pv-drawer]').addEventListener('click', () => {
    Portal.drawer.open({
      title: 'Payment ORD-10492', subtitle: 'Crossmint · Nov 27, 10:42',
      body: [el('div', { className: 'amount-hero' }, [el('span', { className: 'amount-hero__value', text: '25.00' }), el('span', { className: 'amount-hero__currency', text: 'USD' }), Portal.badge('paid')]), sampleKv()],
      footer: [btn('Close', { attrs: { 'data-dialog-close': '' } }), btn('Refund', { variant: 'primary', iconName: 'refund' })],
    });
  });
  $('[data-pv-confirm]').addEventListener('click', () => Portal.confirm({
    title: 'Revoke API key?', tone: 'danger', confirmLabel: 'Revoke key',
    message: 'Requests using this key will fail immediately.', details: [['Key', 'pk_live_…4f2a'], ['Last used', '3 min ago']],
  }).then((ok) => ok && Portal.toast('Key revoked')));
  $('[data-pv-menu]').replaceWith(Portal.menu.button([
    { label: 'Edit endpoint', icon: 'edit', description: 'Change URL or events' },
    { label: 'Send test event', icon: 'send' },
    'separator',
    { label: 'Delete', icon: 'trash', tone: 'danger' },
  ]));
  $('[data-pv-toast]').addEventListener('click', () => Portal.toast('Changes saved'));

  /* Details */
  $('[data-pv-details]').append(
    sampleKv(),
    el('ol', { className: 'timeline' }, [['Payment created', 'POST /payments accepted', ''], ['Sent to Crossmint', 'Hosted card page opened', ''], ['Payment received', '25.00 USD confirmed', 'success']]
      .map(([title, desc, tone]) => el('li', { className: `timeline__item${tone ? ` timeline__item--${tone}` : ''}` }, [el('span', { className: 'timeline__dot' }), el('span', {}, [el('p', { className: 'timeline__title', text: title }), el('p', { className: 'timeline__desc', text: desc })]), el('span', { className: 'timeline__time', text: '10:42' })]))),
    el('ul', { className: 'rows' }, ['payment.created', 'payment.status_updated'].map((event) => el('li', { className: 'rows__item' }, [el('span', { className: 'u-mono', text: event }), el('span', { className: 'rows__meta' }, [el('span', { className: 'u-muted', text: 'HTTP 200' }), Portal.badge('delivered')])]))),
    Portal.codePanel('Response', { requestId: 'req_8f3a91c2e7', status: 'PAID', amount: '25.00', currency: 'USD' }),
    el('div', { className: 'chips' }, ['payment.created', 'refund.status_updated'].map((t) => el('span', { className: 'chip chip--mono', text: t }))),
    el('div', { className: 'note' }, [iconEl('info'), el('span', { text: 'Info note for context.' })]),
    el('div', { className: 'empty' }, [el('span', { className: 'empty__icon' }, [iconEl('webhook')]), el('p', { className: 'empty__title', text: 'No endpoints yet' }), el('p', { className: 'empty__text', text: 'Add an endpoint to receive payment events.' }), btn('Add endpoint', { variant: 'primary', iconName: 'plus' })]),
  );

  /* Countries */
  const dial = el('select', { className: 'select', attrs: { 'aria-label': 'Country code' } }, Portal.countries.map((c) => el('option', { text: `${c.flag} ${c.dial}`, attrs: { value: c.dial } })));
  const phone = el('input', { className: 'input', attrs: { type: 'tel', inputmode: 'tel', placeholder: '50 123 4567', 'aria-label': 'Phone number', maxlength: '15' } });
  $('[data-pv-phone]').append(el('div', { className: 'phone-field' }, [dial, phone]));
  $('[data-pv-country]').append(el('select', { className: 'select', attrs: { 'aria-label': 'Country' } }, Portal.countries.map((c) => el('option', { text: `${c.flag}  ${c.name}`, attrs: { value: c.code } }))));

  /* Table */
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: `req_${(0x8f3a91c2e7 - i * 9973).toString(16)}`, route: ['Crossmint', 'ForumPay', 'Blockchain rail'][i % 3], status: ['paid', 'pending', 'failed'][i % 3], amount: (12.5 + i * 3.25).toFixed(2), country: Portal.countries[i % 6].code }));
  Portal.dataTable($('[data-pv-table]'), {
    pageSize: 6,
    columns: [
      { label: 'Request ID', render: (r) => Portal.copyable(r.id) },
      { label: 'Country', render: (r) => el('span', {}, [Portal.flag(r.country), ` ${r.country}`]) },
      { label: 'Route', render: (r) => r.route },
      { label: 'Status', render: (r) => Portal.badge(r.status) },
      { label: 'Amount', num: true, render: (r) => `${fmt.money(r.amount)} USD` },
    ],
  }).setRows(rows);
})();
