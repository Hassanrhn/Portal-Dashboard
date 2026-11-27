/*
 * Payouts: withdrawals from the partner balance to crypto wallets through ForumPay
 * (offering FORUMPAY.PAYMENT_API.WITHDRAWAL.PAYOUT).
 * KPI strip (balances, approvals, 30-day volume), filterable payout list, a detail drawer with
 * approve / reject / cancel, and a two-step "New payout" drawer (form → review → submit).
 * Payouts over the approval threshold wait for a second admin. Deep link: ?payout=<id>.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const payouts = Portal.data.payouts;
  const { OFFERING, NETWORKS, MIN_AMOUNT, APPROVAL_THRESHOLD, balances } = Portal.data.payoutConfig;
  const NOW = Date.UTC(2026, 10, 27, 12);
  const DAY = 86400000;
  const ME = 'pocket@pocket.com';
  const CURRENCIES = ['USDT', 'USDC'];
  const AMOUNT_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;
  const REFERENCE_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;
  const ADDRESS_RULES = {
    TRC20: { pattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/, hint: 'A TRC20 address starts with T and is 34 characters.', placeholder: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', maxlength: 34 },
    ERC20: { pattern: /^0x[0-9a-fA-F]{40}$/, hint: 'An ERC20 address is 0x followed by 40 hex characters.', placeholder: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', maxlength: 42 },
    Polygon: { pattern: /^0x[0-9a-fA-F]{40}$/, hint: 'A Polygon address is 0x followed by 40 hex characters.', placeholder: '0x9fB2a1C4d7E83b06A5F1c2D9e4B7a3C8F0d6E215', maxlength: 42 },
  };
  const STATUS_BADGE = {
    awaiting_approval: ['awaiting', 'Awaiting approval'],
    processing: ['processing', 'Processing'],
    paid: ['paid', 'Paid'],
    failed: ['failed', 'Failed'],
    cancelled: ['cancelled', 'Cancelled'],
  };
  const $ = (s, scope = document) => scope.querySelector(s);

  const filters = { q: '', status: 'all', currency: '' };
  const params = new URLSearchParams(window.location.search);
  ['q', 'status', 'currency'].forEach((key) => { if (params.get(key)) filters[key] = params.get(key).slice(0, 80); });

  /* Helpers ------------------------------------------------------------------- */
  const statusBadge = (status) => Portal.badge(...STATUS_BADGE[status]);
  const shortAddress = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  /** Short address on screen, full address on the copy button. */
  function addressCopy(address) {
    const node = Portal.copyable(address, { label: 'Copy address' });
    node.firstChild.textContent = shortAddress(address);
    node.firstChild.title = address;
    return node;
  }
  const money = (value, currency) => `${fmt.money(value)} ${currency}`;
  const amountCell = (value, currency) => el('span', {}, [fmt.money(value), el('span', { className: 'amount__currency', text: ` ${currency}` })]);
  const nowIso = () => new Date(NOW).toISOString();
  const isLive = () => document.documentElement.dataset.env !== 'test';
  const kv = (pairs) => el('dl', { className: 'kv' }, pairs.filter(Boolean).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, [v])]));
  const section = (title, children) => el('section', { className: 'drawer__section' }, [el('h3', { className: 'drawer__section-title', text: title }), ...children]);
  const needsSecondAdmin = (amount) => Number(amount) > Number(APPROVAL_THRESHOLD);
  const recipientGets = (p) => (Number(p.amount) - Number(p.fee)).toFixed(2);
  const reserves = (p) => p.status === 'awaiting_approval' || p.status === 'processing';

  /* KPIs ------------------------------------------------------------------------ */
  function renderKpis() {
    CURRENCIES.forEach((cur) => {
      const pending = payouts.filter((p) => p.currency === cur && reserves(p)).reduce((sum, p) => sum + Number(p.amount), 0);
      $(`[data-kpi="${cur}"]`).textContent = fmt.money(balances[cur]);
      $(`[data-kpi-meta="${cur}"]`).textContent = `${fmt.money(pending)} held for pending payouts`;
    });
    const awaiting = payouts.filter((p) => p.status === 'awaiting_approval');
    $('[data-kpi="awaiting"]').textContent = fmt.count(awaiting.length);
    $('[data-kpi-meta="awaiting"]').textContent = `Over ${fmt.count(APPROVAL_THRESHOLD)} need a second admin`;
    const paid = payouts.filter((p) => p.status === 'paid' && NOW - new Date(p.confirmedAt).getTime() <= 30 * DAY);
    $('[data-kpi="paid"]').textContent = fmt.money(paid.reduce((sum, p) => sum + Number(p.amount), 0));
    $('[data-kpi-meta="paid"]').textContent = `${fmt.count(paid.length)} payouts confirmed on chain`;
  }

  Portal.lazy.register('payout-kpis', {
    fetch: () => Portal.request(balances),
    render: renderKpis,
  });

  /* Table --------------------------------------------------------------------- */
  const table = Portal.dataTable($('[data-table]'), {
    pageSize: 12,
    onRowClick: openPayout,
    rowLabel: (p) => `payout ${p.id}`,
    empty: { icon: 'search', title: 'No payouts match these filters', text: 'Try another status or clear the filters.', action: btn('Clear filters', { onClick: clearFilters }) },
    columns: [
      { label: 'Payout ID', filter: { type: 'text', value: (p) => p.id }, render: (p) => Portal.copyable(p.id, { label: 'Copy payout ID' }) },
      { label: 'Destination', filter: { type: 'options', value: (p) => p.network, label: String }, render: (p) => el('span', { className: 'payout-dest' }, [el('span', { className: 'chip', text: p.network }), addressCopy(p.address)]) },
      { label: 'Reference', filter: { type: 'text', value: (p) => p.ref, placeholder: 'e.g. WD-2041' }, render: (p) => el('span', { className: 'u-muted', text: p.ref }) },
      { label: 'Status', filter: { type: 'options', value: (p) => p.status, label: (s) => STATUS_BADGE[s][1] }, render: (p) => statusBadge(p.status) },
      { label: 'Amount', num: true, filter: { type: 'number', value: (p) => p.amount }, render: (p) => amountCell(p.amount, p.currency) },
      { label: 'Created', num: true, filter: { type: 'date', value: (p) => p.created }, render: (p) => el('span', { className: 'u-muted', text: fmt.dateTime(p.created) }) },
    ],
  });

  function matches(p, { ignoreStatus = false } = {}) {
    const q = filters.q.trim().toLowerCase();
    return (!q || [p.id, p.ref, p.address, p.txHash || ''].some((v) => v.toLowerCase().includes(q)))
      && (ignoreStatus || filters.status === 'all' || p.status === filters.status)
      && (!filters.currency || p.currency === filters.currency);
  }

  function apply() {
    const base = payouts.filter((p) => matches(p, { ignoreStatus: true }));
    document.querySelectorAll('[data-count]').forEach((node) => {
      const status = node.dataset.count;
      node.textContent = fmt.count(status === 'all' ? base.length : base.filter((p) => p.status === status).length);
    });
    table.setRows(base.filter((p) => filters.status === 'all' || p.status === filters.status));
    $('[data-clear]').hidden = !(filters.q || filters.status !== 'all' || filters.currency);
    renderKpis();
  }

  function syncControls() {
    $('[data-filter="q"]').value = filters.q;
    $('[data-filter="currency"]').value = filters.currency;
    $('[data-filter="status"]').portalSelect?.(filters.status);
  }

  function clearFilters() {
    Object.assign(filters, { q: '', status: 'all', currency: '' });
    syncControls();
    apply();
  }

  let searchTimer;
  $('[data-filter="q"]').addEventListener('input', (event) => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { filters.q = event.target.value; apply(); }, 150);
  });
  $('[data-filter="currency"]').addEventListener('change', (event) => { filters.currency = event.target.value; apply(); });
  $('[data-filter="status"]').addEventListener('segmented:change', (event) => { filters.status = event.detail.value; apply(); });
  $('[data-clear]').addEventListener('click', clearFilters);

  $('[data-export]').addEventListener('click', () => {
    Portal.downloadCsv('payouts.csv', [
      { label: 'payout_id', value: (p) => p.id }, { label: 'reference_id', value: (p) => p.ref },
      { label: 'status', value: (p) => p.status.toUpperCase() }, { label: 'amount', value: (p) => p.amount },
      { label: 'currency', value: (p) => p.currency }, { label: 'network', value: (p) => p.network },
      { label: 'network_fee', value: (p) => p.fee }, { label: 'address', value: (p) => p.address },
      { label: 'tx_hash', value: (p) => p.txHash || '' }, { label: 'created_at', value: (p) => p.created },
    ], table.rows);
  });

  Portal.lazy.register('payouts', {
    fetch: () => Portal.request(payouts),
    render: () => { syncControls(); apply(); },
  });

  /* Payout detail drawer ------------------------------------------------------------ */
  function timelineSteps(p) {
    const chain = NETWORKS[p.network].chain;
    const steps = [{ title: 'Requested', desc: `By ${p.requestedBy}`, time: p.created, tone: '' }];
    if (p.status === 'cancelled') {
      if (p.approvedAt) steps.push({ title: 'Approved', desc: `By ${p.approvedBy}`, time: p.approvedAt, tone: '' });
      steps.push({ title: p.approvedAt ? 'Cancelled' : 'Rejected', desc: p.cancelNote, time: p.cancelledAt, tone: '' });
      return steps;
    }
    steps.push(p.approvedAt
      ? { title: 'Approved', desc: `By ${p.approvedBy}`, time: p.approvedAt, tone: '' }
      : { title: 'Approval', desc: needsSecondAdmin(p.amount) ? `Over ${fmt.count(APPROVAL_THRESHOLD)}: needs a second admin` : 'Waiting for an admin', tone: 'warning', upcoming: true });
    steps.push(p.broadcastAt
      ? { title: 'Broadcast', desc: `Sent to ${chain} by ForumPay`, time: p.broadcastAt, tone: '' }
      : { title: 'Broadcast', desc: p.approvedAt ? 'Queued at ForumPay' : 'After approval', tone: p.approvedAt ? 'warning' : '', upcoming: true });
    if (p.status === 'failed') {
      steps.push({ title: 'Failed', desc: p.failure, time: p.failedAt, tone: 'danger' });
      return steps;
    }
    steps.push(p.confirmedAt
      ? { title: 'Confirmed', desc: `${money(recipientGets(p), p.currency)} arrived at the destination`, time: p.confirmedAt, tone: 'success' }
      : { title: 'Confirmed', desc: 'Waiting for network confirmations', tone: '', upcoming: true });
    return steps;
  }

  function timeline(steps) {
    return el('ol', { className: 'timeline' }, steps.map((s) => el('li', { className: ['timeline__item', s.tone && `timeline__item--${s.tone}`, s.upcoming && 'timeline__item--upcoming'].filter(Boolean).join(' ') }, [
      el('span', { className: 'timeline__dot', attrs: { 'aria-hidden': 'true' } }),
      el('span', {}, [el('p', { className: 'timeline__title', text: s.title }), el('p', { className: 'timeline__desc', text: s.desc })]),
      s.time ? el('time', { className: 'timeline__time', text: fmt.dateTime(s.time), attrs: { datetime: s.time } }) : el('span', { className: 'timeline__time', text: 'Pending' }),
    ])));
  }

  function detailBody(p) {
    return [
      el('div', { className: 'amount-hero' }, [
        el('span', { className: 'amount-hero__value', text: fmt.money(p.amount) }),
        el('span', { className: 'amount-hero__currency', text: p.currency }),
        statusBadge(p.status),
      ]),
      p.failure ? el('div', { className: 'note note--danger' }, [iconEl('x-circle'), el('span', {}, [el('b', { text: 'Why it failed: ' }), `${p.failure}. The amount is back in your ${p.currency} balance.`])]) : null,
      p.status === 'awaiting_approval' && p.requestedBy === ME && needsSecondAdmin(p.amount)
        ? el('div', { className: 'note' }, [iconEl('info'), el('span', { text: `You requested this payout. Payouts over ${fmt.count(APPROVAL_THRESHOLD)} need a second admin's approval.` })])
        : null,
      section('Timeline', [timeline(timelineSteps(p))]),
      section('Details', [kv([
        ['Payout ID', Portal.copyable(p.id)],
        ['Reference', Portal.copyable(p.ref, { mono: false })],
        ['Offering', el('span', { className: 'chip chip--mono', text: OFFERING })],
        ['Network', `${p.network} · ${NETWORKS[p.network].chain}`],
        ['Address', Portal.copyable(p.address, { label: 'Copy address' })],
        p.txHash ? ['Tx hash', Portal.copyable(p.txHash, { label: 'Copy transaction hash' })] : null,
        ['Requested by', p.requestedBy],
        ['Created', fmt.dateTime(p.created)],
      ])]),
      section('Amounts', [kv([
        ['Amount', money(p.amount, p.currency)],
        ['Network fee', money(p.fee, p.currency)],
        ['Recipient gets', money(recipientGets(p), p.currency)],
      ])]),
    ];
  }

  function actionsFor(p, drawer) {
    const actions = [btn('Close', { attrs: { 'data-dialog-close': '' } })];
    if (p.status === 'awaiting_approval') {
      const selfApproval = p.requestedBy === ME && needsSecondAdmin(p.amount);
      actions.push(
        btn('Reject', { variant: 'danger', onClick: () => rejectPayout(p, drawer) }),
        btn('Approve', { variant: 'primary', iconName: 'check', onClick: () => approvePayout(p, drawer), attrs: { disabled: selfApproval, title: selfApproval ? 'Another admin must approve this payout' : false } }),
      );
    }
    if (p.status === 'processing' && !p.broadcastAt) actions.push(btn('Cancel payout', { variant: 'danger', onClick: () => cancelPayout(p, drawer) }));
    if (p.status === 'failed') actions.push(el('a', { className: 'btn', attrs: { href: `support.html?payout=${encodeURIComponent(p.id)}` } }, [iconEl('support'), 'Ask support']));
    return actions;
  }

  function showDetail(p, drawer) {
    drawer.setTitle(`Payout ${p.ref}`);
    drawer.setBody(detailBody(p));
    drawer.setFooter(actionsFor(p, drawer));
  }

  function openPayout(p) {
    const drawer = Portal.drawer.open({ title: `Payout ${p.ref}`, subtitle: `${p.network} · ${fmt.dateTime(p.created)}` });
    showDetail(p, drawer);
  }

  function refreshAfterChange(p, drawer, message) {
    showDetail(p, drawer);
    apply();
    Portal.toast(message);
  }

  async function approvePayout(p, drawer) {
    const ok = await Portal.confirm({
      title: `Approve ${money(p.amount, p.currency)}?`, confirmLabel: 'Approve payout',
      message: 'ForumPay broadcasts the transfer right after approval. Crypto transfers cannot be reversed.',
      details: [['To', `${shortAddress(p.address)} (${p.network})`], ['Requested by', p.requestedBy], ['Recipient gets', money(recipientGets(p), p.currency)]],
    });
    if (!ok) return;
    Object.assign(p, { status: 'processing', approvedBy: ME, approvedAt: nowIso() });
    refreshAfterChange(p, drawer, 'Payout approved');
  }

  async function rejectPayout(p, drawer) {
    const ok = await Portal.confirm({
      title: 'Reject this payout?', tone: 'danger', confirmLabel: 'Reject payout', cancelLabel: 'Keep it',
      message: `The amount goes back to your ${p.currency} balance and ${p.requestedBy} is notified. This cannot be undone.`,
      details: [['Payout', p.id], ['Amount', money(p.amount, p.currency)]],
    });
    if (!ok) return;
    Object.assign(p, { status: 'cancelled', cancelledAt: nowIso(), cancelNote: `Rejected by ${ME}` });
    balances[p.currency] = (Number(balances[p.currency]) + Number(p.amount)).toFixed(2);
    refreshAfterChange(p, drawer, 'Payout rejected');
  }

  async function cancelPayout(p, drawer) {
    const ok = await Portal.confirm({
      title: 'Cancel this payout?', tone: 'danger', confirmLabel: 'Cancel payout', cancelLabel: 'Keep payout',
      message: `It has not been broadcast yet, so the amount goes back to your ${p.currency} balance.`,
      details: [['Payout', p.id], ['Amount', money(p.amount, p.currency)]],
    });
    if (!ok) return;
    Object.assign(p, { status: 'cancelled', cancelledAt: nowIso(), cancelNote: `Cancelled by ${ME} before broadcast` });
    balances[p.currency] = (Number(balances[p.currency]) + Number(p.amount)).toFixed(2);
    refreshAfterChange(p, drawer, 'Payout cancelled');
  }

  /* New payout drawer ------------------------------------------------------------------ */
  const field = (id, label, control, help) => el('div', { className: 'field' }, [
    el('label', { className: 'field__label', text: label, attrs: { for: id } }),
    control,
    help ? el('p', { className: 'field__help', text: help, attrs: { id: `${id}-help` } }) : null,
  ]);
  const nextReference = () => `WD-${Math.max(...payouts.map((p) => Number(p.ref.slice(3)) || 0)) + 1}`;

  function payoutForm() {
    const currency = el('select', { className: 'select select--block', attrs: { id: 'po-currency' } }, CURRENCIES.map((c) => el('option', { text: c })));
    const network = el('select', { className: 'select select--block', attrs: { id: 'po-network' } });
    const address = el('input', { className: 'input input--mono', attrs: { id: 'po-address', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', 'aria-describedby': 'po-address-help' } });
    const amount = el('input', { className: 'input u-num', attrs: { id: 'po-amount', inputmode: 'decimal', autocomplete: 'off', maxlength: '12', placeholder: '2500.00', 'aria-describedby': 'po-amount-help' } });
    const reference = el('input', { className: 'input', attrs: { id: 'po-reference', maxlength: '40', autocomplete: 'off', value: nextReference(), placeholder: nextReference(), 'aria-describedby': 'po-reference-help' } });
    const balanceHelp = el('p', { className: 'field__help', attrs: { id: 'po-amount-help' } });
    const addressHelp = el('p', { className: 'field__help', attrs: { id: 'po-address-help' } });
    const unit = el('span', { className: 'input-affix__addon' });
    const useMax = btn('Use full balance', { variant: 'ghost', size: 'sm', onClick: () => { amount.value = balances[currency.value]; Portal.fieldError(amount, ''); } });

    function syncNetworks() {
      const current = network.value;
      const options = Object.keys(NETWORKS).filter((n) => NETWORKS[n].currencies.includes(currency.value));
      network.replaceChildren(...options.map((n) => el('option', { text: `${n} · ${NETWORKS[n].chain}`, attrs: { value: n } })));
      network.value = options.includes(current) ? current : options[0];
      unit.textContent = currency.value;
      balanceHelp.textContent = `Available: ${money(balances[currency.value], currency.value)}. Minimum ${fmt.money(MIN_AMOUNT)}.`;
      syncAddress();
    }
    function syncAddress() {
      const rule = ADDRESS_RULES[network.value];
      address.placeholder = rule.placeholder;
      address.maxLength = rule.maxlength;
      addressHelp.textContent = `${rule.hint} Network fee ${money(NETWORKS[network.value].fee, currency.value)}.`;
      if (address.value) Portal.fieldError(address, '');
    }
    currency.addEventListener('change', syncNetworks);
    network.addEventListener('change', syncAddress);
    syncNetworks();

    const nodes = [
      el('div', { className: 'note' }, [iconEl('info'), el('span', { text: `Payouts over ${fmt.count(APPROVAL_THRESHOLD)} need a second admin's approval before ForumPay sends them.` })]),
      el('div', { className: 'form-grid form-grid--2' }, [field('po-currency', 'Currency', currency), field('po-network', 'Network', network)]),
      el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Destination address', attrs: { for: 'po-address' } }), address, addressHelp]),
      el('div', { className: 'field' }, [
        el('div', { className: 'field__row' }, [el('label', { className: 'field__label', text: 'Amount', attrs: { for: 'po-amount' } }), useMax]),
        el('div', { className: 'input-affix' }, [unit, amount]),
        balanceHelp,
      ]),
      field('po-reference', 'Reference', reference, 'Your own ID for this payout, for example an invoice number. Letters, numbers, dot, dash and underscore.'),
    ];
    return { nodes, currency, network, address, amount, reference };
  }

  function validate(form) {
    const cur = form.currency.value;
    const rule = ADDRESS_RULES[form.network.value];
    const addr = form.address.value.trim();
    const value = form.amount.value.trim();
    const ref = form.reference.value.trim();
    const fee = Number(NETWORKS[form.network.value].fee);
    let amountError = '';
    if (!AMOUNT_PATTERN.test(value)) amountError = 'Enter an amount like 250 or 250.50.';
    else if (Number(value) < Number(MIN_AMOUNT)) amountError = `The minimum payout is ${fmt.money(MIN_AMOUNT)} ${cur}.`;
    else if (Number(value) > Number(balances[cur])) amountError = `You have ${money(balances[cur], cur)} available.`;
    else if (Number(value) <= fee) amountError = `The amount must be more than the ${money(fee, cur)} network fee.`;
    const results = [
      Portal.fieldError(form.address, !addr ? 'Enter the destination address.' : rule.pattern.test(addr) ? '' : `This is not a valid ${form.network.value} address.`),
      Portal.fieldError(form.amount, amountError),
      Portal.fieldError(form.reference, REFERENCE_PATTERN.test(ref) ? '' : 'Use 1–40 letters, numbers, dots, dashes or underscores.'),
    ];
    const firstInvalid = [form.address, form.amount, form.reference][results.indexOf(false)];
    firstInvalid?.focus();
    return results.every(Boolean);
  }

  function draftFrom(form) {
    const network = form.network.value;
    return {
      currency: form.currency.value, network, address: form.address.value.trim(),
      amount: Number(form.amount.value.trim()).toFixed(2), fee: NETWORKS[network].fee, ref: form.reference.value.trim(),
    };
  }

  function reviewBody(d) {
    const secondAdmin = needsSecondAdmin(d.amount);
    return [
      el('div', { className: 'amount-hero' }, [
        el('span', { className: 'amount-hero__value', text: fmt.money(d.amount) }),
        el('span', { className: 'amount-hero__currency', text: d.currency }),
      ]),
      section('Review', [kv([
        ['From', `${d.currency} balance (${money(balances[d.currency], d.currency)} available)`],
        ['Network', `${d.network} · ${NETWORKS[d.network].chain}`],
        ['Destination', Portal.copyable(d.address, { label: 'Copy address' })],
        ['Reference', d.ref],
        ['Offering', el('span', { className: 'chip chip--mono', text: OFFERING })],
      ])]),
      section('Amounts', [kv([
        ['Amount', money(d.amount, d.currency)],
        ['Network fee', money(d.fee, d.currency)],
        ['Recipient gets', el('b', { text: money((Number(d.amount) - Number(d.fee)).toFixed(2), d.currency) })],
      ])]),
      el('div', { className: 'note' }, [iconEl(secondAdmin ? 'shield' : 'info'), el('span', {
        text: secondAdmin
          ? `This payout is over ${fmt.count(APPROVAL_THRESHOLD)}, so it waits in Awaiting approval until a second admin approves it.`
          : `Payouts over ${fmt.count(APPROVAL_THRESHOLD)} need a second admin's approval. This one goes to ForumPay right away.`,
      })]),
      el('p', { className: 't-meta', text: 'Check the address and network carefully. Crypto sent to a wrong address or network cannot be recovered.' }),
    ];
  }

  function createPayout(d) {
    const secondAdmin = needsSecondAdmin(d.amount);
    const id = `po_${Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
    const p = {
      id, ref: d.ref, status: secondAdmin ? 'awaiting_approval' : 'processing', currency: d.currency, network: d.network,
      address: d.address, amount: d.amount, fee: d.fee, created: nowIso(), requestedBy: ME,
      approvedBy: secondAdmin ? null : ME, approvedAt: secondAdmin ? null : nowIso(),
      broadcastAt: null, confirmedAt: null, txHash: null, failure: null, failedAt: null, cancelledAt: null, cancelNote: null,
    };
    payouts.unshift(p);
    balances[d.currency] = (Number(balances[d.currency]) - Number(d.amount)).toFixed(2);
    return p;
  }

  function openNewPayout() {
    const drawer = Portal.drawer.open({ title: 'New payout', subtitle: 'Withdraw to a crypto wallet through ForumPay' });
    const form = payoutForm();

    function showForm() {
      drawer.setTitle('New payout');
      drawer.setBody(form.nodes);
      drawer.setFooter([
        btn('Cancel', { attrs: { 'data-dialog-close': '' } }),
        btn('Review payout', { variant: 'primary', onClick: () => { if (validate(form)) showReview(draftFrom(form)); } }),
      ], isLive() ? 'Live mode: real funds' : 'Test mode: no funds move');
    }

    function showReview(d) {
      drawer.setTitle('Review payout');
      drawer.setBody(reviewBody(d));
      drawer.setFooter([
        btn('Back', { onClick: showForm }),
        btn('Submit payout', { variant: 'primary', iconName: 'send', onClick: () => submit(d) }),
      ]);
    }

    async function submit(d) {
      if (isLive()) {
        const ok = await Portal.confirm({
          title: `Send ${money(d.amount, d.currency)} from your live balance?`, confirmLabel: 'Submit payout',
          message: 'This moves real funds. Crypto transfers cannot be reversed once broadcast.',
          details: [['To', `${shortAddress(d.address)} (${d.network})`], ['Recipient gets', money((Number(d.amount) - Number(d.fee)).toFixed(2), d.currency)], ['Reference', d.ref]],
        });
        if (!ok) return;
      }
      const p = createPayout(d);
      drawer.close();
      clearFilters();
      Portal.toast(p.status === 'awaiting_approval' ? 'Payout requested. It needs a second admin.' : 'Payout submitted to ForumPay');
    }

    showForm();
  }

  $('[data-new-payout]').addEventListener('click', openNewPayout);

  /* Search palette entries + deep link to a payout ------------------------------------ */
  Portal.searchIndex = [
    { label: 'New payout', hint: 'Withdraw to a crypto wallet', run: openNewPayout },
    ...payouts.slice(0, 30).map((p) => ({ label: p.id, hint: `${p.ref} · ${p.amount} ${p.currency}`, run: () => openPayout(p) })),
  ];
  const deepLink = params.get('payout');
  if (deepLink) {
    const target = payouts.find((p) => p.id === deepLink);
    if (target) window.setTimeout(() => openPayout(target), 400);
  }
})();
