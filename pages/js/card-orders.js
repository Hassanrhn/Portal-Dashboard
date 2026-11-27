/*
 * Card orders: filterable list of virtual and physical card orders across issuers.
 * Order drawer: card_order.status_updated timeline, shipping address and tracking for physical cards,
 * failure reason, Retry (failed) and Cancel (requested). "New card order" drawer: details → review → create.
 * Deep links: ?status=failed&issuer=Axys&type=physical&q=…, ?order=<id>, and
 * ?new=1&cardholder=<id> (used by the Cardholders drawer) opens the new order drawer prefilled.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const { NOW, networkOf, issuers, cardholders, cards, orders } = Portal.data.cards;
  const { countries } = Portal;
  const $ = (s, scope = document) => scope.querySelector(s);

  const STATUSES = ['requested', 'processing', 'shipped', 'active', 'failed'];
  const LIMIT = /^\d{1,6}(\.\d{1,2})?$/;
  const LIMIT_MIN = 10;
  const LIMIT_MAX = 25000;
  const POSTAL = /^[A-Za-z0-9 -]{3,10}$/;

  const filters = { q: '', status: 'all', issuer: '', type: '' };
  const params = new URLSearchParams(window.location.search);
  if (STATUSES.includes(params.get('status'))) filters.status = params.get('status');
  if (issuers.some((i) => i.name === params.get('issuer'))) filters.issuer = params.get('issuer');
  if (['virtual', 'physical'].includes(params.get('type'))) filters.type = params.get('type');
  if (params.get('q')) filters.q = params.get('q').slice(0, 80);

  const holderOf = (order) => cardholders.find((h) => h.id === order.cardholderId);
  const issuerOf = (name) => issuers.find((i) => i.name === name);
  const countryName = (code) => countries.find((c) => c.code === code)?.name || code;
  const issuerLabel = (issuer, text = issuer) => el('span', { className: 'with-flag' }, [iconEl(networkOf(issuer), 'network-mark'), text]);
  /** Flag + text; the flag is decorative because the text already names the country. */
  function withFlag(code, text) {
    const flag = Portal.flag(code);
    flag.setAttribute('aria-hidden', 'true');
    return el('span', { className: 'with-flag' }, [flag, text]);
  }
  const nowIso = () => new Date(NOW).toISOString();
  const randomHex = (bytes) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
  const orderable = () => cardholders.filter((h) => h.kyc === 'verified' && h.status !== 'suspended' && issuerOf(h.issuer).status === 'connected');

  /* Table --------------------------------------------------------------------- */
  const table = Portal.dataTable($('[data-table]'), {
    pageSize: 12,
    onRowClick: openOrder,
    rowLabel: (o) => `card order ${o.id}`,
    empty: { icon: 'search', title: 'No card orders match these filters', text: 'Try another status or issuer, or clear the filters.', action: btn('Clear filters', { onClick: clearFilters }) },
    columns: [
      { label: 'Order ID', filter: { type: 'text', value: (o) => o.id }, render: (o) => Portal.copyable(o.id, { label: 'Copy order ID' }) },
      { label: 'Cardholder', filter: { type: 'text', value: (o) => `${holderOf(o).name} ${holderOf(o).email}`, placeholder: 'Name or email' }, render: (o) => { const h = holderOf(o); return el('span', {}, [h.name, el('span', { className: 'cell-sub', text: h.email })]); } },
      { label: 'Issuer', filter: { type: 'options', value: (o) => o.issuer }, render: (o) => issuerLabel(o.issuer) },
      { label: 'Card type', filter: { type: 'options', value: (o) => o.type }, render: (o) => el('span', {}, [fmt.humanize(o.type), el('span', { className: 'cell-sub', text: o.currency })]) },
      { label: 'Status', filter: { type: 'options', value: (o) => o.status }, render: (o) => Portal.badge(o.status) },
      { label: 'Created', num: true, filter: { type: 'date', value: (o) => o.created }, render: (o) => el('span', { className: 'u-muted', text: fmt.dateTime(o.created) }) },
    ],
  });

  function matches(o, { ignoreStatus = false } = {}) {
    const q = filters.q.trim().toLowerCase();
    const h = holderOf(o);
    return (!q || [o.id, h.name, h.email, o.tracking || ''].some((v) => v.toLowerCase().includes(q)))
      && (ignoreStatus || filters.status === 'all' || o.status === filters.status)
      && (!filters.issuer || o.issuer === filters.issuer)
      && (!filters.type || o.type === filters.type);
  }

  function apply() {
    const base = orders.filter((o) => matches(o, { ignoreStatus: true }));
    document.querySelectorAll('[data-count]').forEach((node) => {
      const status = node.dataset.count;
      node.textContent = fmt.count(status === 'all' ? base.length : base.filter((o) => o.status === status).length);
    });
    table.setRows(base.filter((o) => filters.status === 'all' || o.status === filters.status));
    $('[data-clear]').hidden = !(filters.q || filters.status !== 'all' || filters.issuer || filters.type);
  }

  function syncControls() {
    $('[data-filter="q"]').value = filters.q;
    $('[data-filter="issuer"]').value = filters.issuer;
    $('[data-filter="type"]').value = filters.type;
    $('[data-filter="status"]').portalSelect?.(filters.status);
  }

  function clearFilters() {
    Object.assign(filters, { q: '', status: 'all', issuer: '', type: '' });
    syncControls();
    apply();
  }

  let searchTimer;
  $('[data-filter="q"]').addEventListener('input', (event) => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { filters.q = event.target.value; apply(); }, 150);
  });
  ['issuer', 'type'].forEach((key) => $(`[data-filter="${key}"]`).addEventListener('change', (event) => { filters[key] = event.target.value; apply(); }));
  $('[data-filter="status"]').addEventListener('segmented:change', (event) => { filters.status = event.detail.value; apply(); });
  $('[data-clear]').addEventListener('click', clearFilters);

  $('[data-export]').addEventListener('click', () => {
    Portal.downloadCsv('card-orders.csv', [
      { label: 'order_id', value: (o) => o.id }, { label: 'cardholder_id', value: (o) => o.cardholderId },
      { label: 'issuer', value: (o) => o.issuer }, { label: 'card_type', value: (o) => o.type.toUpperCase() },
      { label: 'status', value: (o) => o.status.toUpperCase() }, { label: 'currency', value: (o) => o.currency },
      { label: 'spending_limit', value: (o) => o.limit }, { label: 'tracking_number', value: (o) => o.tracking || '' },
      { label: 'created_at', value: (o) => o.created },
    ], table.rows);
  });

  Portal.lazy.register('card-orders', {
    fetch: () => Portal.request(orders),
    render: () => { syncControls(); apply(); },
  });

  /* Shared drawer pieces ------------------------------------------------------------ */
  const kv = (pairs) => el('dl', { className: 'kv' }, pairs.filter(Boolean).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, [v])]));
  const section = (title, children, aside) => el('section', { className: 'drawer__section' }, [
    aside ? el('div', { className: 'field__row' }, [el('h3', { className: 'drawer__section-title', text: title }), aside]) : el('h3', { className: 'drawer__section-title', text: title }),
    ...children,
  ]);

  function field(id, labelText, control, help) {
    return el('div', { className: 'field' }, [
      el('label', { className: 'field__label', text: labelText, attrs: { for: id } }),
      control,
      help && el('p', { className: 'field__help', text: help }),
    ]);
  }

  function timeline(events) {
    return el('ol', { className: 'timeline' }, events.map((e) => el('li', { className: `timeline__item${e.tone ? ` timeline__item--${e.tone}` : ''}` }, [
      el('span', { className: 'timeline__dot', attrs: { 'aria-hidden': 'true' } }),
      el('span', {}, [el('p', { className: 'timeline__title', text: e.title }), el('p', { className: 'timeline__desc', text: e.desc })]),
      el('time', { className: 'timeline__time', text: fmt.dateTime(e.time), attrs: { datetime: e.time } }),
    ])));
  }

  /* Order detail drawer --------------------------------------------------------------- */
  function shippingSection(o) {
    const s = o.shipping;
    return section('Shipping', [kv([
      ['Address', `${s.line1}, ${s.city} ${s.postal}`],
      ['Country', withFlag(s.country, countryName(s.country))],
      ['Tracking number', o.tracking ? Portal.copyable(o.tracking) : el('span', { className: 'u-muted', text: 'Assigned when the card ships' })],
    ])]);
  }

  function detailBody(o) {
    const h = holderOf(o);
    return [
      el('div', { className: 'amount-hero' }, [
        el('span', { className: 'amount-hero__value', text: fmt.humanize(o.type) }),
        el('span', { className: 'amount-hero__currency', text: `card · ${o.issuer}` }),
        iconEl(networkOf(o.issuer), 'network-mark'),
        Portal.badge(o.status),
      ]),
      o.failure ? el('div', { className: 'note note--danger' }, [iconEl('x-circle'), el('span', {}, [el('b', { text: 'Why it failed: ' }), o.failure])]) : null,
      section('Timeline', [timeline(o.events)], el('a', { className: 'btn btn--ghost btn--sm', attrs: { href: 'webhooks.html' } }, ['Webhooks', iconEl('arrow-right')])),
      section('Details', [kv([
        ['Order ID', Portal.copyable(o.id)],
        ['Cardholder', el('a', { className: 'inline-link', text: h.name, attrs: { href: `cardholders.html?cardholder=${encodeURIComponent(h.id)}` } })],
        ['Issuer', issuerLabel(o.issuer, `${o.issuer} · ${issuerOf(o.issuer).program}`)],
        ['Card type', fmt.humanize(o.type)],
        ['Spending limit', `${fmt.money(o.limit)} ${o.currency}`],
        o.cardId ? ['Card', issuerLabel(o.issuer, `•••• ${cards.find((c) => c.id === o.cardId)?.last4 || '----'}`)] : null,
        ['Created', fmt.dateTime(o.created)],
      ])]),
      o.shipping ? shippingSection(o) : null,
    ];
  }

  function actionsFor(o, drawer) {
    const actions = [];
    if (o.status === 'failed') actions.push(btn('Retry order', { variant: 'primary', iconName: 'rotate', onClick: () => retryOrder(o, drawer) }));
    if (o.status === 'requested') actions.push(btn('Cancel order', { variant: 'danger', onClick: () => cancelOrder(o, drawer) }));
    return [btn('Close', { attrs: { 'data-dialog-close': '' } }), ...actions];
  }

  function showOrder(o, drawer) {
    drawer.setTitle(`Card order ${o.id}`);
    drawer.setBody(detailBody(o));
    drawer.setFooter(actionsFor(o, drawer));
  }

  function openOrder(o) {
    const drawer = Portal.drawer.open({ title: `Card order ${o.id}`, subtitle: `${holderOf(o).name} · ${fmt.dateTime(o.created)}` });
    showOrder(o, drawer);
  }

  async function retryOrder(o, drawer) {
    const button = drawer.el.querySelector('.drawer__foot .btn--primary');
    button.setAttribute('aria-busy', 'true');
    await Portal.request(null, { delay: 700 });
    o.status = 'requested';
    o.failure = null;
    o.events.push({ title: 'Order retried', desc: 'card_order.status_updated · requested again by pocket@pocket.com', time: nowIso(), tone: '' });
    showOrder(o, drawer);
    apply();
    Portal.toast('Card order sent to the issuer again');
  }

  async function cancelOrder(o, drawer) {
    const ok = await Portal.confirm({
      title: 'Cancel this card order?', tone: 'danger', confirmLabel: 'Cancel order', cancelLabel: 'Keep order',
      message: 'The issuer will not create this card. Place a new order if the cardholder still needs one.',
      details: [['Order ID', o.id], ['Cardholder', holderOf(o).name], ['Card', `${fmt.humanize(o.type)} · ${o.currency}`]],
    });
    if (!ok) return;
    o.status = 'cancelled';
    o.events.push({ title: 'Order cancelled', desc: 'card_order.status_updated · cancelled from Portal by pocket@pocket.com', time: nowIso(), tone: '' });
    showOrder(o, drawer);
    apply();
    Portal.toast('Card order cancelled');
  }

  /* New card order drawer ---------------------------------------------------------------- */
  function newOrder(prefillId) {
    const prefill = orderable().find((h) => h.id === prefillId);
    const values = { cardholderId: prefill?.id || '', issuer: prefill?.issuer || '', type: 'virtual', currency: '', limit: '1000.00', line1: '', city: '', postal: '', country: prefill?.country || '' };
    const drawer = Portal.drawer.open({ title: 'New card order', subtitle: 'Only cardholders with verified KYC can receive a card' });
    detailsStep();

    function detailsStep() {
      const issuer = el('select', { className: 'select select--block', attrs: { id: 'no-issuer' } }, [
        el('option', { text: 'Any issuer', attrs: { value: '' } }),
        ...issuers.map((i) => el('option', { text: i.status === 'connected' ? i.name : `${i.name} (needs Cards scope)`, attrs: { value: i.name, disabled: i.status !== 'connected', selected: i.name === values.issuer } })),
      ]);
      const holder = el('select', { className: 'select select--block', attrs: { id: 'no-holder' } });
      const currency = el('select', { className: 'select select--block', attrs: { id: 'no-currency' } });
      const limit = el('input', { className: 'input u-num', attrs: { id: 'no-limit', inputmode: 'decimal', maxlength: '9', value: values.limit, placeholder: '1000.00' } });
      const type = el('div', { className: 'radio-cards radio-cards--2', attrs: { role: 'radiogroup', 'aria-label': 'Card type' } }, [
        ['virtual', 'Virtual', 'Usable right away in wallets and online'],
        ['physical', 'Physical', 'Shipped to the cardholder in 5–10 days'],
      ].map(([v, t, d]) => el('label', { className: 'radio-card' }, [
        el('input', { attrs: { type: 'radio', name: 'card-type', value: v, checked: v === values.type } }),
        el('span', { className: 'radio-card__body' }, [el('span', { className: 'radio-card__title', text: t }), el('span', { className: 'radio-card__desc', text: d })]),
        el('span', { className: 'radio-card__dot', attrs: { 'aria-hidden': 'true' } }),
      ])));
      const line1 = el('input', { className: 'input', attrs: { id: 'no-line1', maxlength: '80', value: values.line1, autocomplete: 'off', placeholder: '12 Marina Walk, Apt 1804' } });
      const city = el('input', { className: 'input', attrs: { id: 'no-city', maxlength: '40', value: values.city, autocomplete: 'off', placeholder: 'Dubai' } });
      const postal = el('input', { className: 'input', attrs: { id: 'no-postal', maxlength: '10', value: values.postal, autocomplete: 'off', placeholder: '00000' } });
      const country = el('select', { className: 'select select--block', attrs: { id: 'no-country' } }, [
        el('option', { text: 'Select a country', attrs: { value: '' } }),
        ...countries.map((c) => el('option', { text: `${c.flag} ${c.name}`, attrs: { value: c.code, selected: c.code === values.country } })),
      ]);
      const shipping = el('section', { className: 'drawer__section', attrs: { hidden: values.type !== 'physical' } }, [
        el('h3', { className: 'drawer__section-title', text: 'Shipping address' }),
        el('div', { className: 'form-grid form-grid--2' }, [
          el('div', { className: 'span-2' }, [field('no-line1', 'Street address', line1)]),
          field('no-city', 'City', city),
          field('no-postal', 'Postal code', postal),
          el('div', { className: 'span-2' }, [field('no-country', 'Country', country)]),
        ]),
      ]);

      function fillHolders() {
        const list = orderable().filter((h) => !issuer.value || h.issuer === issuer.value);
        holder.replaceChildren(
          el('option', { text: 'Select a cardholder', attrs: { value: '' } }),
          ...list.map((h) => el('option', { text: `${h.name} · ${h.email}`, attrs: { value: h.id, selected: h.id === values.cardholderId } })),
        );
      }
      function fillCurrencies() {
        const list = issuerOf(issuer.value)?.currencies || ['USD'];
        currency.replaceChildren(...list.map((c) => el('option', { text: c, attrs: { value: c, selected: c === values.currency } })));
      }
      issuer.addEventListener('change', () => { fillHolders(); fillCurrencies(); });
      holder.addEventListener('change', () => {
        const h = cardholders.find((x) => x.id === holder.value);
        if (!h) return;
        if (issuer.value !== h.issuer) { issuer.value = h.issuer; fillCurrencies(); }
        if (!country.value) country.value = h.country;
      });
      type.addEventListener('change', (event) => { shipping.hidden = event.target.value !== 'physical'; });
      fillHolders();
      fillCurrencies();

      drawer.setTitle('New card order');
      drawer.setBody([
        el('div', { className: 'form-grid form-grid--2' }, [
          el('div', { className: 'span-2' }, [field('no-holder', 'Cardholder', holder, 'Only verified cardholders are listed.')]),
          el('div', { className: 'span-2' }, [field('no-issuer', 'Issuer', issuer, 'Set from the cardholder. Interlace needs an API key with the CARDS scope.')]),
        ]),
        el('div', { className: 'field' }, [el('span', { className: 'field__label', text: 'Card type' }), type]),
        el('div', { className: 'form-grid form-grid--2' }, [
          field('no-currency', 'Currency', currency),
          field('no-limit', 'Spending limit', limit, `Per month, ${LIMIT_MIN} to ${fmt.count(LIMIT_MAX)}.`),
        ]),
        shipping,
      ]);
      drawer.setFooter([
        btn('Cancel', { attrs: { 'data-dialog-close': '' } }),
        btn('Review order', { variant: 'primary', onClick: () => {
          const physical = type.querySelector('input:checked').value === 'physical';
          const amount = limit.value.trim();
          const selected = cardholders.find((h) => h.id === holder.value);
          const checks = [
            [holder, Portal.fieldError(holder, selected ? '' : 'Select a verified cardholder.')],
            [issuer, Portal.fieldError(issuer, !selected || issuer.value === selected.issuer ? '' : `${selected.name} belongs to ${selected.issuer}.`)],
            [limit, Portal.fieldError(limit, LIMIT.test(amount) && Number(amount) >= LIMIT_MIN && Number(amount) <= LIMIT_MAX ? '' : `Enter an amount between ${LIMIT_MIN} and ${fmt.count(LIMIT_MAX)}.`)],
            ...(physical ? [
              [line1, Portal.fieldError(line1, line1.value.trim().length >= 4 ? '' : 'Enter the street and number.')],
              [city, Portal.fieldError(city, city.value.trim().length >= 2 ? '' : 'Enter a city.')],
              [postal, Portal.fieldError(postal, POSTAL.test(postal.value.trim()) ? '' : 'Enter a postal code (3 to 10 letters or digits).')],
              [country, Portal.fieldError(country, country.value ? '' : 'Select a country.')],
            ] : []),
          ];
          const invalid = checks.find(([, ok]) => !ok);
          if (invalid) { invalid[0].focus(); return; }
          Object.assign(values, {
            cardholderId: holder.value, issuer: issuer.value, type: physical ? 'physical' : 'virtual', currency: currency.value,
            limit: Number(amount).toFixed(2), line1: line1.value.trim(), city: city.value.trim(), postal: postal.value.trim().toUpperCase(), country: country.value,
          });
          reviewStep();
        } }),
      ]);
      (prefill ? limit : holder).focus();
    }

    function reviewStep() {
      const h = cardholders.find((x) => x.id === values.cardholderId);
      const physical = values.type === 'physical';
      drawer.setTitle('Review card order');
      drawer.setBody([
        el('p', { className: 't-meta', text: `${values.issuer} creates the card after you confirm. You will get card_order.status_updated webhooks as it moves from requested to active.` }),
        kv([
          ['Cardholder', `${h.name} · ${h.email}`],
          ['Issuer', issuerLabel(values.issuer, `${values.issuer} · ${issuerOf(values.issuer).program}`)],
          ['Card type', fmt.humanize(values.type)],
          ['Currency', values.currency],
          ['Spending limit', `${fmt.money(values.limit)} ${values.currency} per month`],
          physical ? ['Ship to', withFlag(values.country, `${values.line1}, ${values.city} ${values.postal}, ${countryName(values.country)}`)] : null,
        ]),
      ]);
      drawer.setFooter([
        btn('Back', { onClick: detailsStep }),
        btn('Create order', { variant: 'primary', onClick: create }),
      ]);
    }

    async function create() {
      const button = drawer.el.querySelector('.drawer__foot .btn--primary');
      button.setAttribute('aria-busy', 'true');
      const order = {
        id: `co_${randomHex(6)}`, cardholderId: values.cardholderId, issuer: values.issuer, type: values.type, status: 'requested',
        currency: values.currency, limit: values.limit, created: nowIso(), cardId: null, tracking: null, failure: null,
        shipping: values.type === 'physical' ? { line1: values.line1, city: values.city, postal: values.postal, country: values.country } : null,
        events: [{ title: 'Order requested', desc: 'card_order.status_updated · requested by pocket@pocket.com', time: nowIso(), tone: '' }],
      };
      await Portal.request(order, { delay: 600 });
      orders.unshift(order);
      apply();
      Portal.toast(`Card order ${order.id} created`);
      showOrder(order, drawer);
    }
  }

  $('[data-new-order]').addEventListener('click', () => newOrder());

  /* Search palette entries + deep links ----------------------------------------------------- */
  Portal.searchIndex = orders.slice(0, 40).map((o) => ({ label: o.id, hint: `${holderOf(o).name} · ${o.issuer} · ${o.status}`, run: () => openOrder(o) }));
  const deepOrder = orders.find((o) => o.id === params.get('order'));
  if (params.get('new') === '1') window.setTimeout(() => newOrder(params.get('cardholder')), 400);
  else if (deepOrder) window.setTimeout(() => openOrder(deepOrder), 400);
})();
