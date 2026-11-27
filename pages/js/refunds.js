/*
 * Refunds: money returned to customers on paid payments.
 * KPI strip (30-day refunded amount, pending, refund rate), filterable refund list, a detail drawer
 * linking back to the original payment, and a three-step "Refund a payment" drawer
 * (pick a paid payment → amount and reason → confirm). Deep link: ?refund=<id>.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const refunds = Portal.data.refunds;
  const payments = Portal.data.payments;
  const REASONS = Portal.data.refundReasons;
  const NOW = Date.UTC(2026, 10, 27, 12);
  const DAY = 86400000;
  const ME = 'pocket@pocket.com';
  const USD_PER = { USD: 1, USDC: 1, USDT: 1, AED: 1 / 3.6725 };
  const AMOUNT_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;
  const MAX_RESULTS = 8;
  const $ = (s, scope = document) => scope.querySelector(s);

  const filters = { q: '', status: 'all' };
  const params = new URLSearchParams(window.location.search);
  ['q', 'status'].forEach((key) => { if (params.get(key)) filters[key] = params.get(key).slice(0, 80); });

  /* Helpers ------------------------------------------------------------------- */
  const money = (value, currency) => `${fmt.money(value)} ${currency}`;
  const amountCell = (value, currency) => el('span', {}, [fmt.money(value), el('span', { className: 'amount__currency', text: ` ${currency}` })]);
  const paymentHref = (id) => `transactions.html?payment=${encodeURIComponent(id)}`;
  const paymentLink = (id) => el('a', { className: 'inline-link u-mono', text: id, attrs: { href: paymentHref(id) } });
  const kv = (pairs) => el('dl', { className: 'kv' }, pairs.filter(Boolean).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, [v])]));
  const section = (title, children) => el('section', { className: 'drawer__section' }, [el('h3', { className: 'drawer__section-title', text: title }), ...children]);
  const within30 = (iso) => NOW - new Date(iso).getTime() <= 30 * DAY;
  const toUsd = (amount, currency) => Number(amount) * USD_PER[currency];
  const nowIso = () => new Date(NOW).toISOString();
  const isLive = () => document.documentElement.dataset.env !== 'test';
  const hasOpenRefund = (p) => refunds.some((r) => r.paymentId === p.id && r.status === 'pending');

  /* KPIs ------------------------------------------------------------------------ */
  function renderKpis() {
    const done = refunds.filter((r) => r.status === 'succeeded' && within30(r.completedAt));
    $('[data-kpi="refunded"]').textContent = fmt.money(done.reduce((sum, r) => sum + toUsd(r.amount, r.currency), 0));
    $('[data-kpi-meta="refunded"]').textContent = `${fmt.count(done.length)} refunds succeeded`;
    const pending = refunds.filter((r) => r.status === 'pending');
    $('[data-kpi="pending"]').textContent = fmt.count(pending.length);
    $('[data-kpi-meta="pending"]').textContent = `${fmt.money(pending.reduce((sum, r) => sum + toUsd(r.amount, r.currency), 0))} USD eq. on its way back`;
    const settled = payments.filter((p) => (p.status === 'paid' || p.status === 'refunded' || p.status === 'partially_refunded') && within30(p.created));
    const refundedPayments = new Set(done.map((r) => r.paymentId));
    const rate = settled.length ? (refundedPayments.size / settled.length) * 100 : 0;
    $('[data-kpi="rate"]').textContent = rate.toFixed(1);
    $('[data-kpi-meta="rate"]').textContent = `${fmt.count(refundedPayments.size)} of ${fmt.count(settled.length)} paid payments`;
  }

  Portal.lazy.register('refund-kpis', {
    fetch: () => Portal.request(refunds),
    render: renderKpis,
  });

  /* Table --------------------------------------------------------------------- */
  const table = Portal.dataTable($('[data-table]'), {
    pageSize: 12,
    onRowClick: openRefund,
    rowLabel: (r) => `refund ${r.id}`,
    empty: { icon: 'refund', title: 'No refunds match these filters', text: 'Try another status or clear the search.', action: btn('Clear filters', { onClick: clearFilters }) },
    columns: [
      { label: 'Refund ID', render: (r) => Portal.copyable(r.id, { label: 'Copy refund ID' }) },
      { label: 'Payment', render: (r) => paymentLink(r.paymentId) },
      { label: 'Reference', render: (r) => el('span', { className: 'u-muted', text: r.ref }) },
      { label: 'Reason', render: (r) => el('span', { className: 'u-muted', text: r.reason }) },
      { label: 'Status', render: (r) => Portal.badge(r.status) },
      { label: 'Amount', num: true, render: (r) => amountCell(r.amount, r.currency) },
      { label: 'Created', num: true, render: (r) => el('span', { className: 'u-muted', text: fmt.dateTime(r.created) }) },
    ],
  });

  function matches(r, { ignoreStatus = false } = {}) {
    const q = filters.q.trim().toLowerCase();
    return (!q || [r.id, r.paymentId, r.ref].some((v) => v.toLowerCase().includes(q)))
      && (ignoreStatus || filters.status === 'all' || r.status === filters.status);
  }

  function apply() {
    const base = refunds.filter((r) => matches(r, { ignoreStatus: true }));
    document.querySelectorAll('[data-count]').forEach((node) => {
      const status = node.dataset.count;
      node.textContent = fmt.count(status === 'all' ? base.length : base.filter((r) => r.status === status).length);
    });
    table.setRows(base.filter((r) => filters.status === 'all' || r.status === filters.status));
    $('[data-clear]').hidden = !(filters.q || filters.status !== 'all');
    renderKpis();
  }

  function syncControls() {
    $('[data-filter="q"]').value = filters.q;
    $('[data-filter="status"]').portalSelect?.(filters.status);
  }

  function clearFilters() {
    Object.assign(filters, { q: '', status: 'all' });
    syncControls();
    apply();
  }

  let searchTimer;
  $('[data-filter="q"]').addEventListener('input', (event) => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { filters.q = event.target.value; apply(); }, 150);
  });
  $('[data-filter="status"]').addEventListener('segmented:change', (event) => { filters.status = event.detail.value; apply(); });
  $('[data-clear]').addEventListener('click', clearFilters);

  $('[data-export]').addEventListener('click', () => {
    Portal.downloadCsv('refunds.csv', [
      { label: 'refund_id', value: (r) => r.id }, { label: 'request_id', value: (r) => r.paymentId },
      { label: 'reference_id', value: (r) => r.ref }, { label: 'status', value: (r) => r.status.toUpperCase() },
      { label: 'amount', value: (r) => r.amount }, { label: 'currency', value: (r) => r.currency },
      { label: 'reason', value: (r) => r.reason }, { label: 'created_at', value: (r) => r.created },
    ], table.rows);
  });

  Portal.lazy.register('refunds', {
    fetch: () => Portal.request(refunds),
    render: () => { syncControls(); apply(); },
  });

  /* Refund detail drawer ------------------------------------------------------------ */
  function timelineSteps(r) {
    const steps = [
      { title: 'Refund requested', desc: `${r.reason} · by ${r.requestedBy}`, time: r.created, tone: '' },
      { title: `Sent to ${r.route}`, desc: `Provider reference ${r.providerRef}`, time: r.created, tone: '' },
    ];
    if (r.status === 'succeeded') steps.push({ title: 'Refund succeeded', desc: `${money(r.amount, r.currency)} returned to the original ${r.method === 'FIAT_CARD' ? 'card' : 'wallet'}`, time: r.completedAt, tone: 'success' });
    if (r.status === 'failed') steps.push({ title: 'Refund failed', desc: r.failure, time: r.completedAt, tone: 'danger' });
    if (r.status === 'pending') steps.push({ title: 'Waiting for provider', desc: r.method === 'FIAT_CARD' ? 'Card refunds usually take 5–10 business days' : 'Crypto refunds usually settle within an hour', tone: 'warning', upcoming: true });
    return steps;
  }

  function timeline(steps) {
    return el('ol', { className: 'timeline' }, steps.map((s) => el('li', { className: ['timeline__item', s.tone && `timeline__item--${s.tone}`, s.upcoming && 'timeline__item--upcoming'].filter(Boolean).join(' ') }, [
      el('span', { className: 'timeline__dot', attrs: { 'aria-hidden': 'true' } }),
      el('span', {}, [el('p', { className: 'timeline__title', text: s.title }), el('p', { className: 'timeline__desc', text: s.desc })]),
      s.time ? el('time', { className: 'timeline__time', text: fmt.dateTime(s.time), attrs: { datetime: s.time } }) : el('span', { className: 'timeline__time', text: 'Pending' }),
    ])));
  }

  function detailBody(r) {
    return [
      el('div', { className: 'amount-hero' }, [
        el('span', { className: 'amount-hero__value', text: fmt.money(r.amount) }),
        el('span', { className: 'amount-hero__currency', text: r.currency }),
        Portal.badge(r.status),
      ]),
      r.failure ? el('div', { className: 'note note--danger' }, [iconEl('x-circle'), el('span', {}, [el('b', { text: 'Why it failed: ' }), `${r.failure}. The payment stays paid; contact the customer for another way to return the money.`])]) : null,
      section('Timeline', [timeline(timelineSteps(r))]),
      section('Details', [kv([
        ['Refund ID', Portal.copyable(r.id)],
        ['Payment', paymentLink(r.paymentId)],
        ['Reference', Portal.copyable(r.ref, { mono: false })],
        ['Route', `${r.route} · ${r.method === 'FIAT_CARD' ? 'Card' : 'Crypto'}`],
        ['Reason', r.reason],
        ['Requested by', r.requestedBy],
        ['Created', fmt.dateTime(r.created)],
      ])]),
      section('Amounts', [kv([
        ['Paid amount', money(r.paidAmount, r.currency)],
        ['Refund', money(r.amount, r.currency)],
        ['Processing fee', `${money(r.fee, r.currency)} (not returned)`],
      ])]),
    ];
  }

  function openRefund(r) {
    Portal.drawer.open({
      title: `Refund ${r.ref}`,
      subtitle: `${r.route} · ${fmt.dateTime(r.created)}`,
      body: detailBody(r),
      footer: [
        btn('Close', { attrs: { 'data-dialog-close': '' } }),
        el('a', { className: 'btn', attrs: { href: paymentHref(r.paymentId) } }, ['Open payment', iconEl('arrow-right')]),
      ],
    });
  }

  /* Refund a payment: step 1, pick a paid payment ------------------------------------- */
  function refundable(q) {
    const query = q.trim().toLowerCase();
    return payments.filter((p) => p.status === 'paid' && !hasOpenRefund(p)
      && (!query || p.id.toLowerCase().includes(query) || p.ref.toLowerCase().includes(query)));
  }

  function pickStep(flow) {
    const search = el('input', { className: 'input', attrs: { id: 'rf-search', type: 'search', maxlength: '80', autocomplete: 'off', placeholder: 'req_77b0d415aa or ORD-10492', value: flow.query } });
    const results = el('div', { attrs: { role: 'radiogroup', 'aria-label': 'Paid payments' } });
    const count = el('p', { className: 'field__help', attrs: { 'aria-live': 'polite' } });

    function renderResults() {
      const found = refundable(search.value);
      flow.query = search.value;
      count.textContent = found.length > MAX_RESULTS
        ? `Showing ${MAX_RESULTS} of ${fmt.count(found.length)} paid payments. Refine the search to see others.`
        : `${fmt.count(found.length)} paid ${found.length === 1 ? 'payment' : 'payments'} can be refunded.`;
      if (!found.length) {
        results.replaceChildren(el('div', { className: 'empty' }, [
          el('span', { className: 'empty__icon' }, [iconEl('search')]),
          el('p', { className: 'empty__title', text: 'No paid payment matches' }),
          el('p', { className: 'empty__text', text: 'Only paid payments without a pending refund can be refunded.' }),
        ]));
        return;
      }
      results.replaceChildren(el('div', { className: 'pick-list' }, found.slice(0, MAX_RESULTS).map((p) => el('label', { className: 'pick' }, [
        el('input', { attrs: { type: 'radio', name: 'rf-payment', value: p.id, checked: flow.payment === p }, on: { change: () => { Object.assign(flow, { payment: p, type: 'full', amount: '' }); Portal.fieldError(search, ''); } } }),
        el('span', { className: 'pick__dot', attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'pick__main' }, [
          el('span', { className: 'u-mono', text: p.id }),
          el('span', { className: 'pick__sub', text: `${p.ref} · ${p.customer} · ${fmt.dateTime(p.created)}` }),
        ]),
        el('span', { className: 'pick__amount' }, [amountCell(p.amount, p.currency)]),
      ]))));
    }

    let timer;
    search.addEventListener('input', () => { window.clearTimeout(timer); timer = window.setTimeout(renderResults, 150); });
    renderResults();

    return {
      nodes: [
        el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Find a paid payment', attrs: { for: 'rf-search' } }), search, count]),
        results,
      ],
      validate: () => {
        const ok = Portal.fieldError(search, flow.payment ? '' : 'Choose the payment to refund.');
        if (!ok) search.focus();
        return ok;
      },
    };
  }

  /* Step 2: amount and reason ------------------------------------------------------------ */
  function amountStep(flow) {
    const p = flow.payment;
    const amount = el('input', { className: 'input u-num', attrs: { id: 'rf-amount', inputmode: 'decimal', autocomplete: 'off', maxlength: '12', value: flow.amount || p.amount, placeholder: p.amount, disabled: flow.type !== 'partial' } });
    const reason = el('select', { className: 'select select--block', attrs: { id: 'rf-reason' } }, REASONS.map((r) => el('option', { text: r, attrs: { selected: r === flow.reason } })));
    const type = el('div', { className: 'radio-cards radio-cards--2', attrs: { role: 'radiogroup', 'aria-label': 'Refund type' } }, [['full', 'Full refund', money(p.amount, p.currency)], ['partial', 'Partial refund', 'Choose an amount']].map(([v, t, d]) => el('label', { className: 'radio-card' }, [
      el('input', { attrs: { type: 'radio', name: 'rf-type', value: v, checked: v === flow.type } }),
      el('span', { className: 'radio-card__body' }, [el('span', { className: 'radio-card__title', text: t }), el('span', { className: 'radio-card__desc', text: d })]),
      el('span', { className: 'radio-card__dot', attrs: { 'aria-hidden': 'true' } }),
    ])));
    type.addEventListener('change', (event) => {
      flow.type = event.target.value;
      amount.disabled = flow.type === 'full';
      Portal.fieldError(amount, '');
      if (amount.disabled) amount.value = p.amount; else { amount.value = ''; amount.focus(); }
    });
    reason.addEventListener('change', () => { flow.reason = reason.value; });

    return {
      nodes: [
        kv([['Payment', Portal.copyable(p.id, { label: 'Copy request ID' })], ['Reference', p.ref], ['Paid', `${money(p.amount, p.currency)} via ${p.route}`]]),
        type,
        el('div', { className: 'form-grid form-grid--2' }, [
          el('div', { className: 'field' }, [el('label', { className: 'field__label', text: `Amount (${p.currency})`, attrs: { for: 'rf-amount' } }), amount]),
          el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Reason', attrs: { for: 'rf-reason' } }), reason]),
        ]),
        el('div', { className: 'note' }, [iconEl('info'), el('span', { text: `The processing fee of ${money(p.fee, p.currency)} is not returned. The refund goes back to the original ${p.method === 'FIAT_CARD' ? 'card' : 'wallet'} through ${p.route}.` })]),
      ],
      validate: () => {
        const value = amount.value.trim();
        const valid = AMOUNT_PATTERN.test(value) && Number(value) > 0 && Number(value) <= Number(p.amount);
        if (!Portal.fieldError(amount, valid ? '' : `Enter an amount between 0.01 and ${p.amount}.`)) { amount.focus(); return false; }
        flow.amount = Number(value).toFixed(2);
        flow.reason = reason.value;
        return true;
      },
    };
  }

  /* Step 3: confirm ----------------------------------------------------------------------- */
  function confirmStep(flow) {
    const p = flow.payment;
    const full = Number(flow.amount) === Number(p.amount);
    return {
      nodes: [
        el('div', { className: 'amount-hero' }, [
          el('span', { className: 'amount-hero__value', text: fmt.money(flow.amount) }),
          el('span', { className: 'amount-hero__currency', text: p.currency }),
        ]),
        kv([
          ['Payment', Portal.copyable(p.id, { label: 'Copy request ID' })],
          ['Reference', p.ref],
          ['Customer', p.customer],
          ['Type', full ? 'Full refund' : `Partial refund of ${money(p.amount, p.currency)}`],
          ['Reason', flow.reason],
          ['Fee kept', money(p.fee, p.currency)],
          ['Returns to', `Original ${p.method === 'FIAT_CARD' ? 'card' : 'wallet'} via ${p.route}`],
        ]),
        el('p', { className: 't-meta', text: isLive()
          ? 'Live mode: this returns real money. You cannot cancel a refund once it is sent.'
          : 'Test mode: no money moves. The refund follows the same steps as in Live.' }),
      ],
      validate: () => true,
    };
  }

  function createRefund(flow) {
    const p = flow.payment;
    const bytes = crypto.getRandomValues(new Uint8Array(5));
    const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const r = {
      id: `rf_${suffix}`, paymentId: p.id, ref: p.ref, route: p.route, method: p.method, currency: p.currency,
      paidAmount: p.amount, fee: p.fee, amount: flow.amount, reason: flow.reason, status: 'pending', created: nowIso(),
      requestedBy: ME, providerRef: `${p.route.slice(0, 2).toUpperCase()}-RF-${suffix.slice(0, 8).toUpperCase()}`, completedAt: null, failure: null,
    };
    refunds.unshift(r);
    return r;
  }

  const STEPS = [
    { title: 'Choose a payment', build: pickStep, next: 'Continue' },
    { title: 'Amount and reason', build: amountStep, next: 'Review refund' },
    { title: 'Confirm refund', build: confirmStep, next: 'Send refund' },
  ];

  function openNewRefund() {
    const flow = { query: '', payment: null, type: 'full', amount: '', reason: REASONS[0] };
    const drawer = Portal.drawer.open({ title: 'Refund a payment' });
    const stepLabel = el('p', { className: 'steps' });
    drawer.el.querySelector('.drawer__titles').appendChild(stepLabel);

    function show(index) {
      const step = STEPS[index];
      const view = step.build(flow);
      stepLabel.textContent = `Step ${index + 1} of ${STEPS.length} · ${step.title}`;
      drawer.setBody(view.nodes);
      drawer.setFooter([
        index ? btn('Back', { onClick: () => show(index - 1) }) : btn('Cancel', { attrs: { 'data-dialog-close': '' } }),
        btn(step.next, { variant: 'primary', iconName: index === STEPS.length - 1 ? 'refund' : null, onClick: () => {
          if (!view.validate()) return;
          if (index < STEPS.length - 1) { show(index + 1); return; }
          const r = createRefund(flow);
          drawer.close();
          clearFilters();
          Portal.toast(`Refund of ${money(r.amount, r.currency)} sent to ${r.route}`);
        } }),
      ]);
    }
    show(0);
  }

  $('[data-new-refund]').addEventListener('click', openNewRefund);

  /* Search palette entries + deep links -------------------------------------------- */
  Portal.searchIndex = [
    { label: 'Refund a payment', hint: 'Start a refund on a paid payment', run: openNewRefund },
    ...refunds.slice(0, 30).map((r) => ({ label: r.id, hint: `${r.ref} · ${r.amount} ${r.currency}`, run: () => openRefund(r) })),
  ];
  const deepLink = params.get('refund');
  if (deepLink) {
    const target = refunds.find((r) => r.id === deepLink);
    if (target) window.setTimeout(() => openRefund(target), 400);
  }
})();
