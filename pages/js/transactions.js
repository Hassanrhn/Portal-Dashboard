/*
 * Transactions: filterable ledger + payment detail drawer (timeline, failure reason, fees,
 * provider reference, webhooks, raw payload) with refund and cancel actions.
 * URL filters (?status=failed&q=ORD-10489) let other pages deep-link, e.g. from an Overview alert.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const payments = Portal.data.payments;
  const NOW = Date.UTC(2026, 10, 27, 12);
  const $ = (s, scope = document) => scope.querySelector(s);

  const filters = { q: '', status: 'all', route: '', method: '', range: '30' };
  const params = new URLSearchParams(window.location.search);
  ['q', 'status', 'route', 'method', 'range'].forEach((key) => { if (params.get(key)) filters[key] = params.get(key).slice(0, 80); });

  /* Table --------------------------------------------------------------------- */
  const table = Portal.dataTable($('[data-table]'), {
    pageSize: 12,
    onRowClick: openPayment,
    rowLabel: (p) => `payment ${p.id}`,
    empty: { icon: 'search', title: 'No payments match these filters', text: 'Try a wider date range or clear the filters.', action: btn('Clear filters', { onClick: clearFilters }) },
    columns: [
      { label: 'Request ID', filter: { type: 'text', value: (p) => p.id }, render: (p) => Portal.copyable(p.id, { label: 'Copy request ID' }) },
      { label: 'Reference', filter: { type: 'text', value: (p) => p.ref, placeholder: 'e.g. ORD-10489' }, render: (p) => el('span', { className: 'u-muted', text: p.ref }) },
      { label: 'Customer', filter: { type: 'text', value: (p) => p.customer, placeholder: 'Name or email' }, render: (p) => el('span', { className: 'u-muted', text: p.customer }) },
      { label: 'Route', filter: { type: 'options', value: (p) => p.route }, render: (p) => el('span', {}, [p.route, el('span', { className: 'cell-sub', text: p.method === 'FIAT_CARD' ? 'Card' : 'Crypto' })]) },
      { label: 'Status', filter: { type: 'options', value: (p) => p.status }, render: (p) => Portal.badge(p.status) },
      { label: 'Amount', num: true, filter: { type: 'number', value: (p) => p.amount }, render: (p) => el('span', {}, [fmt.money(p.amount), el('span', { className: 'amount__currency', text: ` ${p.currency}` })]) },
      { label: 'Date', num: true, filter: { type: 'date', value: (p) => p.created }, render: (p) => el('span', { className: 'u-muted', text: fmt.dateTime(p.created) }) },
    ],
  });

  function inRange(p) {
    const days = Number(filters.range);
    return !days || NOW - new Date(p.created).getTime() <= days * 86400000;
  }

  function matches(p, { ignoreStatus = false } = {}) {
    const q = filters.q.trim().toLowerCase();
    return (!q || [p.id, p.ref, p.customer, p.providerRef].some((v) => v.toLowerCase().includes(q)))
      && (ignoreStatus || filters.status === 'all' || p.status === filters.status)
      && (!filters.route || p.route === filters.route)
      && (!filters.method || p.method === filters.method)
      && inRange(p);
  }

  function apply() {
    const base = payments.filter((p) => matches(p, { ignoreStatus: true }));
    document.querySelectorAll('[data-count]').forEach((node) => {
      const status = node.dataset.count;
      node.textContent = fmt.count(status === 'all' ? base.length : base.filter((p) => p.status === status).length);
    });
    table.setRows(base.filter((p) => filters.status === 'all' || p.status === filters.status));
    $('[data-clear]').hidden = !(filters.q || filters.status !== 'all' || filters.route || filters.method || filters.range !== '30');
  }

  function syncControls() {
    $('[data-filter="q"]').value = filters.q;
    $('[data-filter="route"]').value = filters.route;
    $('[data-filter="method"]').value = filters.method;
    $('[data-filter="range"]').value = filters.range;
    $('[data-filter="status"]').portalSelect?.(filters.status);
  }

  function clearFilters() {
    Object.assign(filters, { q: '', status: 'all', route: '', method: '', range: '30' });
    syncControls();
    apply();
  }

  let searchTimer;
  $('[data-filter="q"]').addEventListener('input', (event) => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { filters.q = event.target.value; apply(); }, 150);
  });
  ['route', 'method', 'range'].forEach((key) => $(`[data-filter="${key}"]`).addEventListener('change', (event) => { filters[key] = event.target.value; apply(); }));
  $('[data-filter="status"]').addEventListener('segmented:change', (event) => { filters.status = event.detail.value; apply(); });
  $('[data-clear]').addEventListener('click', clearFilters);

  $('[data-export]').addEventListener('click', () => {
    Portal.downloadCsv('transactions.csv', [
      { label: 'request_id', value: (p) => p.id }, { label: 'reference_id', value: (p) => p.ref },
      { label: 'status', value: (p) => p.status.toUpperCase() }, { label: 'amount', value: (p) => p.amount },
      { label: 'currency', value: (p) => p.currency }, { label: 'fee', value: (p) => p.fee },
      { label: 'route', value: (p) => p.route }, { label: 'offering', value: (p) => p.offering },
      { label: 'created_at', value: (p) => p.created },
    ], table.rows);
  });

  Portal.lazy.register('transactions', {
    fetch: () => Portal.request(payments),
    render: () => { syncControls(); apply(); },
  });

  /* Payment detail drawer --------------------------------------------------------- */
  const kv = (pairs) => el('dl', { className: 'kv' }, pairs.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, [v])]));

  function payload(p) {
    return {
      requestId: p.id, referenceId: p.ref, offeringId: p.offering, status: p.status.toUpperCase(),
      amount: p.amount, currency: p.currency, fee: p.fee, providerReference: p.providerRef,
      customer: { email: p.customer }, createdAt: p.created, ...(p.failure ? { failureReason: p.failure } : {}),
    };
  }

  function detailBody(p) {
    return [
      el('div', { className: 'amount-hero' }, [
        el('span', { className: 'amount-hero__value', text: fmt.money(p.amount) }),
        el('span', { className: 'amount-hero__currency', text: p.currency }),
        Portal.badge(p.status),
      ]),
      p.failure ? el('div', { className: 'note note--danger' }, [iconEl('x-circle'), el('span', {}, [el('b', { text: 'Why it failed: ' }), p.failure])]) : null,
      el('section', { className: 'drawer__section' }, [
        el('h3', { className: 'drawer__section-title', text: 'Timeline' }),
        el('ol', { className: 'timeline' }, p.events.map((e) => el('li', { className: `timeline__item${e.tone ? ` timeline__item--${e.tone}` : ''}` }, [
          el('span', { className: 'timeline__dot', attrs: { 'aria-hidden': 'true' } }),
          el('span', {}, [el('p', { className: 'timeline__title', text: e.title }), el('p', { className: 'timeline__desc', text: e.desc })]),
          el('time', { className: 'timeline__time', text: fmt.dateTime(e.time), attrs: { datetime: e.time } }),
        ]))),
      ]),
      el('section', { className: 'drawer__section' }, [
        el('h3', { className: 'drawer__section-title', text: 'Details' }),
        kv([
          ['Request ID', Portal.copyable(p.id)],
          ['Reference', Portal.copyable(p.ref, { mono: false })],
          ['Offering', el('span', { className: 'chip chip--mono', text: p.offering })],
          ['Route', p.route],
          ['Method', p.method === 'FIAT_CARD' ? 'Card (FIAT_CARD)' : 'Crypto (CRYPTO)'],
          ['Provider reference', Portal.copyable(p.providerRef)],
          ['Customer', p.customer],
          ['Created', fmt.dateTime(p.created)],
        ]),
      ]),
      el('section', { className: 'drawer__section' }, [
        el('h3', { className: 'drawer__section-title', text: 'Amounts' }),
        kv([
          ['Amount', `${fmt.money(p.amount)} ${p.currency}`],
          ['Processing fee', `${fmt.money(p.fee)} ${p.currency}`],
          ['Net', p.status === 'paid' ? `${fmt.money(p.net)} ${p.currency}` : 'Not settled'],
        ]),
      ]),
      el('section', { className: 'drawer__section' }, [
        el('div', { className: 'field__row' }, [el('h3', { className: 'drawer__section-title', text: 'Webhooks sent' }), el('a', { className: 'btn btn--ghost btn--sm', attrs: { href: 'webhooks.html' } }, ['Open webhooks', iconEl('arrow-right')])]),
        el('ul', { className: 'rows' }, p.webhooks.map((w) => el('li', { className: 'rows__item' }, [
          el('span', { className: 'u-mono', text: w.event }),
          el('span', { className: 'rows__meta' }, [el('span', { className: 'u-muted', text: `HTTP ${w.code} · ${fmt.time(w.time)}` }), Portal.badge(w.status)]),
        ]))),
      ]),
      el('section', { className: 'drawer__section' }, [
        el('h3', { className: 'drawer__section-title', text: 'Raw response' }),
        Portal.codePanel('GET /payments/' + p.id, payload(p)),
      ]),
    ];
  }

  function actionsFor(p, drawer) {
    const actions = [];
    if (p.status === 'paid') actions.push(btn('Refund', { iconName: 'refund', onClick: () => refundForm(p, drawer) }));
    if (p.status === 'pending') actions.push(btn('Cancel payment', { variant: 'danger', onClick: () => cancelPayment(p, drawer) }));
    if (p.status === 'failed') actions.push(el('a', { className: 'btn', attrs: { href: `support.html?request=${encodeURIComponent(p.id)}` } }, [iconEl('support'), 'Ask support']));
    return [btn('Close', { attrs: { 'data-dialog-close': '' } }), ...actions];
  }

  function openPayment(p) {
    const drawer = Portal.drawer.open({ title: `Payment ${p.ref}`, subtitle: `${p.route} · ${fmt.dateTime(p.created)}` });
    drawer.setBody(detailBody(p));
    drawer.setFooter(actionsFor(p, drawer));
  }

  async function cancelPayment(p, drawer) {
    const ok = await Portal.confirm({
      title: 'Cancel this payment?', tone: 'danger', confirmLabel: 'Cancel payment', cancelLabel: 'Keep payment',
      message: 'The customer will no longer be able to pay. This cannot be undone.',
      details: [['Request ID', p.id], ['Amount', `${fmt.money(p.amount)} ${p.currency}`]],
    });
    if (!ok) return;
    p.status = 'cancelled';
    p.events.push({ title: 'Payment cancelled', desc: 'Cancelled from Portal by pocket@pocket.com', time: new Date(NOW).toISOString(), tone: '' });
    drawer.setBody(detailBody(p));
    drawer.setFooter(actionsFor(p, drawer));
    apply();
    Portal.toast('Payment cancelled');
  }

  function refundForm(p, drawer) {
    const amount = el('input', { className: 'input u-num', attrs: { id: 'rf-amount', inputmode: 'decimal', value: p.amount, placeholder: p.amount, maxlength: '12', disabled: true } });
    const reason = el('select', { className: 'select select--block', attrs: { id: 'rf-reason' } }, ['Requested by customer', 'Duplicate payment', 'Fraudulent', 'Other'].map((r) => el('option', { text: r })));
    const type = el('div', { className: 'radio-cards radio-cards--2', attrs: { role: 'radiogroup', 'aria-label': 'Refund type' } }, [['full', 'Full refund', `${fmt.money(p.amount)} ${p.currency}`], ['partial', 'Partial refund', 'Choose an amount']].map(([v, t, d]) => el('label', { className: 'radio-card' }, [
      el('input', { attrs: { type: 'radio', name: 'refund-type', value: v, checked: v === 'full' } }),
      el('span', { className: 'radio-card__body' }, [el('span', { className: 'radio-card__title', text: t }), el('span', { className: 'radio-card__desc', text: d })]),
      el('span', { className: 'radio-card__dot', attrs: { 'aria-hidden': 'true' } }),
    ])));
    type.addEventListener('change', (event) => {
      amount.disabled = event.target.value === 'full';
      if (amount.disabled) amount.value = p.amount; else { amount.value = ''; amount.focus(); }
    });
    drawer.setTitle(`Refund ${p.ref}`);
    drawer.setBody([
      el('p', { className: 't-meta', text: `Refunds go back to the original ${p.method === 'FIAT_CARD' ? 'card' : 'wallet'} through ${p.route}. The processing fee of ${fmt.money(p.fee)} ${p.currency} is not returned.` }),
      type,
      el('div', { className: 'form-grid form-grid--2' }, [
        el('div', { className: 'field' }, [el('label', { className: 'field__label', text: `Amount (${p.currency})`, attrs: { for: 'rf-amount' } }), amount]),
        el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Reason', attrs: { for: 'rf-reason' } }), reason]),
      ]),
    ]);
    drawer.setFooter([
      btn('Back', { onClick: () => { drawer.setTitle(`Payment ${p.ref}`); drawer.setBody(detailBody(p)); drawer.setFooter(actionsFor(p, drawer)); } }),
      btn('Review refund', { variant: 'primary', onClick: async () => {
        const value = amount.value.trim();
        const valid = /^\d{1,9}(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= Number(p.amount);
        if (!Portal.fieldError(amount, valid ? '' : `Enter an amount between 0.01 and ${p.amount}.`)) { amount.focus(); return; }
        const ok = await Portal.confirm({
          title: `Refund ${fmt.money(value)} ${p.currency}?`, confirmLabel: 'Send refund',
          message: 'The customer usually sees the money in 5–10 business days. You cannot cancel a refund once sent.',
          details: [['Payment', p.id], ['Refund', `${fmt.money(value)} ${p.currency}`], ['Fee kept', `${fmt.money(p.fee)} ${p.currency}`], ['Reason', reason.value]],
        });
        if (!ok) return;
        const full = Number(value) === Number(p.amount);
        p.status = full ? 'refunded' : 'partially_refunded';
        p.events.push({ title: full ? 'Refunded' : 'Partially refunded', desc: `${fmt.money(value)} ${p.currency} · ${reason.value}`, time: new Date(NOW).toISOString(), tone: '' });
        drawer.setTitle(`Payment ${p.ref}`);
        drawer.setBody(detailBody(p));
        drawer.setFooter(actionsFor(p, drawer));
        apply();
        Portal.toast('Refund sent');
      } }),
    ]);
  }

  /* Search palette entries + deep link to a payment ------------------------------------ */
  Portal.searchIndex = payments.slice(0, 40).map((p) => ({ label: p.id, hint: `${p.ref} · ${p.amount} ${p.currency}`, run: () => openPayment(p) }));
  const deepLink = params.get('payment');
  if (deepLink) {
    const target = payments.find((p) => p.id === deepLink);
    if (target) window.setTimeout(() => openPayment(target), 400);
  }
})();
