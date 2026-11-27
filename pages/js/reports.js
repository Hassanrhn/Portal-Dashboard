/*
 * Reports: three tabs for finance.
 *   Exports         saved exports (generating → ready, simulated), "New export" drawer, CSV / JSON download, delete.
 *   Statements      monthly totals; PDF arrives with the backend, CSV summary works now.
 *   Reconciliation  settlement batches versus expected amounts, with a drawer to resolve mismatches.
 * Exports are built from the same sample data the other pages use. Deep link: ?tab=statements.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const { exports, statements, batches, cardOrders } = Portal.data.reports;
  const { payments, payouts, refunds } = Portal.data;
  const NOW = Date.UTC(2026, 10, 27, 12);
  const TODAY = '2026-11-27';
  const DAY = 86400000;
  const ME = 'pocket@pocket.com';
  const EXPIRY_DAYS = 7;
  const MAX_RANGE_DAYS = 366;
  const EARLIEST = '2025-01-01';
  const PROGRESS_TICK_MS = 350;
  const USD_PER = { USD: 1, USDC: 1, USDT: 1, AED: 1 / 3.6725 };
  const $ = (s, scope = document) => scope.querySelector(s);

  /* Helpers ------------------------------------------------------------------- */
  const money = (value, currency) => `${fmt.money(value)} ${currency}`;
  const amountCell = (value, currency) => el('span', {}, [fmt.money(value), el('span', { className: 'amount__currency', text: ` ${currency}` })]);
  const kv = (pairs) => el('dl', { className: 'kv' }, pairs.filter(Boolean).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, [v])]));
  const section = (title, children) => el('section', { className: 'drawer__section' }, [el('h3', { className: 'drawer__section-title', text: title }), ...children]);
  const dayStart = (date) => Date.parse(`${date}T00:00:00Z`);
  const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
  const rangeLabel = (from, to) => `${fmt.date(`${from}T00:00:00Z`).replace(/, \d{4}$/, '')} – ${fmt.date(`${to}T00:00:00Z`)}`;

  /* Report types: label, sample rows, date field and CSV columns ------------------------------ */
  const REPORT_TYPES = {
    transactions: {
      label: 'Transactions', rows: () => payments, date: (p) => p.created,
      columns: [['request_id', (p) => p.id], ['reference_id', (p) => p.ref], ['status', (p) => p.status.toUpperCase()], ['amount', (p) => p.amount], ['currency', (p) => p.currency], ['fee', (p) => p.fee], ['route', (p) => p.route], ['offering', (p) => p.offering], ['created_at', (p) => p.created]],
    },
    payouts: {
      label: 'Payouts', rows: () => payouts, date: (p) => p.created,
      columns: [['payout_id', (p) => p.id], ['reference_id', (p) => p.ref], ['status', (p) => p.status.toUpperCase()], ['amount', (p) => p.amount], ['currency', (p) => p.currency], ['network', (p) => p.network], ['network_fee', (p) => p.fee], ['address', (p) => p.address], ['tx_hash', (p) => p.txHash || ''], ['created_at', (p) => p.created]],
    },
    refunds: {
      label: 'Refunds', rows: () => refunds, date: (r) => r.created,
      columns: [['refund_id', (r) => r.id], ['request_id', (r) => r.paymentId], ['reference_id', (r) => r.ref], ['status', (r) => r.status.toUpperCase()], ['amount', (r) => r.amount], ['currency', (r) => r.currency], ['reason', (r) => r.reason], ['created_at', (r) => r.created]],
    },
    fees: {
      label: 'Fees', rows: () => payments.filter((p) => p.status === 'paid' || p.status === 'refunded'), date: (p) => p.created,
      columns: [['request_id', (p) => p.id], ['route', (p) => p.route], ['amount', (p) => p.amount], ['fee', (p) => p.fee], ['net', (p) => (Number(p.amount) - Number(p.fee)).toFixed(2)], ['currency', (p) => p.currency], ['created_at', (p) => p.created]],
    },
    card_orders: {
      label: 'Card orders', rows: () => cardOrders, date: (o) => o.created,
      columns: [['card_order_id', (o) => o.id], ['issuer', (o) => o.issuer], ['cardholder_id', (o) => o.cardholder], ['card_type', (o) => o.type], ['status', (o) => o.status.toUpperCase()], ['created_at', (o) => o.created]],
    },
  };

  function rowsFor(e) {
    const type = REPORT_TYPES[e.type];
    const from = dayStart(e.from);
    const to = dayStart(e.to) + DAY;
    return type.rows().filter((r) => { const t = Date.parse(type.date(r)); return t >= from && t < to; });
  }

  /* Exports ------------------------------------------------------------------------ */
  const exportName = (e) => `${e.type}_${e.from}_${e.to}.${e.format}`;
  const expiresAt = (e) => new Date(Date.parse(e.readyAt || e.created) + EXPIRY_DAYS * DAY).toISOString();
  const exportStatus = (e) => (e.progress < 100 ? 'generating' : Date.parse(expiresAt(e)) <= NOW ? 'expired' : 'ready');
  const progressNodes = new Map(); // export id → { fill, label } while generating

  exports.forEach((e) => { e.progress = 100; e.readyAt = e.created; });

  function statusCell(e) {
    const status = exportStatus(e);
    if (status !== 'generating') return Portal.badge(status);
    const label = Portal.badge('generating', `Generating ${e.progress}%`);
    const fill = el('div', { className: 'progress__fill' });
    fill.style.setProperty('--value', `${e.progress}%`);
    progressNodes.set(e.id, { fill, label });
    return el('div', { className: 'export-status' }, [label, el('div', { className: 'progress', attrs: { role: 'progressbar', 'aria-label': `Generating ${exportName(e)}`, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(e.progress) } }, [fill])]);
  }

  function expiresCell(e) {
    const status = exportStatus(e);
    if (status === 'generating') return el('span', { className: 'u-muted', text: 'When ready' });
    if (status === 'expired') return el('span', { className: 'u-muted', text: `Expired ${fmt.date(expiresAt(e))}` });
    return el('span', {}, [fmt.date(expiresAt(e)), el('span', { className: 'cell-sub', text: `in ${Math.ceil((Date.parse(expiresAt(e)) - NOW) / DAY)} days` })]);
  }

  function exportActions(e) {
    const ready = exportStatus(e) === 'ready';
    return el('span', { className: 'row-actions' }, [
      btn(`Download ${exportName(e)}`, { variant: 'ghost', size: 'sm', iconName: 'download', iconOnly: true, onClick: () => download(e), attrs: { disabled: !ready } }),
      Portal.menu.button(() => [
        { label: `Download ${e.format.toUpperCase()}`, icon: 'download', description: `${fmt.count(rowsFor(e).length)} rows`, disabled: !ready, onSelect: () => download(e) },
        'separator',
        { label: 'Delete export', icon: 'trash', description: 'Removes the file for everyone', tone: 'danger', onSelect: () => deleteExport(e) },
      ], `More actions for ${exportName(e)}`),
    ]);
  }

  const exportsTable = Portal.dataTable($('[data-exports]'), {
    pageSize: 10,
    empty: { icon: 'file', title: 'No exports yet', text: 'Create an export to download transactions, payouts, refunds, fees or card orders.', action: btn('New export', { variant: 'primary', iconName: 'plus', onClick: openNewExport }) },
    columns: [
      { label: 'Name', render: (e) => el('span', {}, [el('span', { className: 'u-mono', text: exportName(e) }), el('span', { className: 'cell-sub', text: `${e.createdBy}${e.includeTest ? ' · includes Test data' : ''}` })]) },
      { label: 'Type', render: (e) => el('span', { className: 'chip', text: REPORT_TYPES[e.type].label }) },
      { label: 'Range', render: (e) => el('span', { className: 'u-muted', text: rangeLabel(e.from, e.to) }) },
      { label: 'Rows', num: true, render: (e) => (exportStatus(e) === 'generating' ? el('span', { className: 'u-muted', text: 'Counting' }) : fmt.count(rowsFor(e).length)) },
      { label: 'Status', render: statusCell },
      { label: 'Expires', render: expiresCell },
      { label: 'Actions', className: 'cell-actions', render: exportActions },
    ],
  });

  function renderExports() {
    progressNodes.clear();
    exportsTable.setRows(exports);
  }

  Portal.lazy.register('exports', { fetch: () => Portal.request(exports), render: renderExports });

  function downloadJson(filename, data) {
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = el('a', { attrs: { href: url, download: filename } });
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    Portal.toast(`Exported ${fmt.count(data.data.length)} rows to ${filename}`);
  }

  function download(e) {
    const type = REPORT_TYPES[e.type];
    const rows = rowsFor(e);
    if (e.format === 'csv') {
      Portal.downloadCsv(exportName(e), type.columns.map(([label, value]) => ({ label, value })), rows);
      return;
    }
    downloadJson(exportName(e), {
      report: e.type, from: e.from, to: e.to, includesTestData: e.includeTest, generatedAt: e.readyAt,
      data: rows.map((r) => Object.fromEntries(type.columns.map(([label, value]) => [label, value(r)]))),
    });
  }

  async function deleteExport(e) {
    const ok = await Portal.confirm({
      title: 'Delete this export?', tone: 'danger', confirmLabel: 'Delete export', cancelLabel: 'Keep it',
      message: 'The file is removed for everyone on your team. You can create the same export again.',
      details: [['Export', exportName(e)], ['Format', e.format.toUpperCase()]],
    });
    if (!ok) return;
    exports.splice(exports.indexOf(e), 1);
    renderExports();
    Portal.toast('Export deleted', { icon: 'trash' });
  }

  /** Simulated generation: progress ticks until 100%, then the row turns ready. */
  function generate(e) {
    const timer = window.setInterval(() => {
      e.progress = Math.min(100, e.progress + 9 + Math.round(Math.random() * 14));
      const nodes = progressNodes.get(e.id);
      if (nodes) {
        nodes.fill.style.setProperty('--value', `${e.progress}%`);
        nodes.fill.parentElement.setAttribute('aria-valuenow', String(e.progress));
        nodes.label.textContent = `Generating ${e.progress}%`;
      }
      if (e.progress < 100) return;
      window.clearInterval(timer);
      e.readyAt = new Date(NOW).toISOString();
      if (exports.includes(e)) {
        progressNodes.delete(e.id);
        exportsTable.refresh();
        Portal.toast(`${exportName(e)} is ready`);
      }
    }, PROGRESS_TICK_MS);
  }

  /* New export drawer --------------------------------------------------------------------- */
  const PRESETS = {
    last7: { label: 'Last 7 days', range: () => [isoDate(NOW - 6 * DAY), TODAY] },
    last30: { label: 'Last 30 days', range: () => [isoDate(NOW - 29 * DAY), TODAY] },
    thisMonth: { label: 'This month', range: () => ['2026-11-01', TODAY] },
    lastMonth: { label: 'Last month', range: () => ['2026-10-01', '2026-10-31'] },
    custom: { label: 'Custom range', range: null },
  };

  function exportForm() {
    const type = el('select', { className: 'select select--block', attrs: { id: 'ex-type' } }, Object.entries(REPORT_TYPES).map(([value, t]) => el('option', { text: t.label, attrs: { value } })));
    const preset = el('select', { className: 'select select--block', attrs: { id: 'ex-preset' } }, Object.entries(PRESETS).map(([value, p]) => el('option', { text: p.label, attrs: { value, selected: value === 'last30' } })));
    const from = el('input', { className: 'input', attrs: { id: 'ex-from', type: 'date', min: EARLIEST, max: TODAY, value: isoDate(NOW - 29 * DAY) } });
    const to = el('input', { className: 'input', attrs: { id: 'ex-to', type: 'date', min: EARLIEST, max: TODAY, value: TODAY } });
    const custom = el('div', { className: 'form-grid form-grid--2 date-range', attrs: { hidden: true } }, [
      el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'From', attrs: { for: 'ex-from' } }), from]),
      el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'To', attrs: { for: 'ex-to' } }), to]),
    ]);
    const format = el('div', { className: 'radio-cards radio-cards--2', attrs: { role: 'radiogroup', 'aria-labelledby': 'ex-format-label' } }, [['csv', 'CSV', 'Opens in Excel, Sheets and Numbers'], ['json', 'JSON', 'For scripts and data tools']].map(([v, t, d]) => el('label', { className: 'radio-card' }, [
      el('input', { attrs: { type: 'radio', name: 'ex-format', value: v, checked: v === 'csv' } }),
      el('span', { className: 'radio-card__body' }, [el('span', { className: 'radio-card__title', text: t }), el('span', { className: 'radio-card__desc', text: d })]),
      el('span', { className: 'radio-card__dot', attrs: { 'aria-hidden': 'true' } }),
    ])));
    const includeTest = el('button', { className: 'switch', attrs: { type: 'button', role: 'switch', 'aria-checked': 'false', 'aria-labelledby': 'ex-test-label', 'aria-describedby': 'ex-test-desc', 'data-switch': '' } });
    const estimate = el('p', { className: 't-meta', attrs: { 'aria-live': 'polite' } });

    const range = () => (preset.value === 'custom' ? [from.value, to.value] : PRESETS[preset.value].range());
    function syncEstimate() {
      const [f, t] = range();
      estimate.textContent = f && t && f <= t
        ? `About ${fmt.count(rowsFor({ type: type.value, from: f, to: t }).length)} rows from ${rangeLabel(f, t)}.`
        : 'Choose a valid date range to see how many rows the export has.';
    }
    preset.addEventListener('change', () => {
      custom.hidden = preset.value !== 'custom';
      if (preset.value === 'custom') from.focus();
      syncEstimate();
    });
    [type, from, to].forEach((input) => input.addEventListener('change', () => { Portal.fieldError(from, ''); Portal.fieldError(to, ''); syncEstimate(); }));
    syncEstimate();

    const nodes = [
      el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Report type', attrs: { for: 'ex-type' } }), type]),
      el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Date range', attrs: { for: 'ex-preset' } }), preset]),
      custom,
      el('div', { className: 'field' }, [el('span', { className: 'field__label', text: 'Format', attrs: { id: 'ex-format-label' } }), format]),
      el('div', { className: 'switch-row' }, [
        el('div', { className: 'check__text' }, [
          el('span', { className: 'field__label', text: 'Include Test data', attrs: { id: 'ex-test-label' } }),
          el('span', { className: 'check__desc', text: 'Adds payments made with test keys, marked as test.', attrs: { id: 'ex-test-desc' } }),
        ]),
        includeTest,
      ]),
      estimate,
    ];

    function validate() {
      if (preset.value !== 'custom') return true;
      let fromError = '';
      let toError = '';
      if (!from.value) fromError = 'Choose a start date.';
      else if (from.value < EARLIEST) fromError = 'Data before Jan 1, 2025 is not available.';
      if (!to.value) toError = 'Choose an end date.';
      else if (to.value > TODAY) toError = 'The end date cannot be in the future.';
      else if (from.value && from.value > to.value) toError = 'The end date must be on or after the start date.';
      else if (from.value && (dayStart(to.value) - dayStart(from.value)) / DAY + 1 > MAX_RANGE_DAYS) toError = `Choose a range of ${MAX_RANGE_DAYS} days or less.`;
      const ok = [Portal.fieldError(from, fromError), Portal.fieldError(to, toError)];
      if (!ok[0]) from.focus(); else if (!ok[1]) to.focus();
      return ok.every(Boolean);
    }

    function value() {
      const [f, t] = range();
      return { type: type.value, from: f, to: t, format: format.querySelector('input:checked').value, includeTest: includeTest.getAttribute('aria-checked') === 'true' };
    }

    return { nodes, validate, value };
  }

  function openNewExport() {
    $('#tab-exports').click();
    const form = exportForm();
    const drawer = Portal.drawer.open({ title: 'New export', subtitle: 'Download your data as CSV or JSON', body: form.nodes });
    Portal.initComponents(drawer.body);
    drawer.setFooter([
      btn('Cancel', { attrs: { 'data-dialog-close': '' } }),
      btn('Create export', { variant: 'primary', onClick: () => {
        if (!form.validate()) return;
        const suffix = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join('');
        const e = { id: `exp_${suffix}`, ...form.value(), created: new Date(NOW).toISOString(), createdBy: ME, progress: 0, readyAt: null };
        exports.unshift(e);
        drawer.close();
        renderExports();
        generate(e);
        Portal.toast(`Generating ${REPORT_TYPES[e.type].label.toLowerCase()} export`, { icon: 'clock' });
      } }),
    ], 'Exports include data you can see with your role.');
  }

  $('[data-new-export]').addEventListener('click', openNewExport);

  /* Statements ---------------------------------------------------------------------------- */
  const periodLabel = (s) => new Date(`${s.period}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const STATEMENT_COLUMNS = [
    { label: 'period', value: (s) => s.period }, { label: 'gross_usd', value: (s) => s.gross }, { label: 'fees_usd', value: (s) => s.fees },
    { label: 'refunds_usd', value: (s) => s.refunds }, { label: 'net_usd', value: (s) => s.net }, { label: 'payouts_usd', value: (s) => s.payouts },
    { label: 'status', value: (s) => (s.status === 'open' ? 'MONTH_TO_DATE' : 'FINAL') },
  ];

  function statementDownload(s) {
    const trigger = btn('Download', { size: 'sm', iconName: 'download', attrs: { 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': `Download ${periodLabel(s)} statement` } });
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      Portal.menu.open(trigger, [
        { label: 'PDF statement', icon: 'file', description: 'Arrives with the backend', onSelect: () => Portal.toast('PDF statements arrive with the backend. Download the CSV summary instead.', { icon: 'info' }) },
        { label: 'CSV summary', icon: 'download', description: `Totals for ${periodLabel(s)}`, onSelect: () => Portal.downloadCsv(`statement_${s.period}.csv`, STATEMENT_COLUMNS, [s]) },
      ]);
    });
    return trigger;
  }

  const statementsTable = Portal.dataTable($('[data-statements]'), {
    pageSize: 12,
    columns: [
      { label: 'Period', render: (s) => el('span', {}, [periodLabel(s), el('span', { className: 'cell-sub', text: s.status === 'open' ? 'Month to date' : 'Closed' })]) },
      { label: 'Gross', num: true, render: (s) => fmt.money(s.gross) },
      { label: 'Fees', num: true, render: (s) => el('span', { className: 'u-muted', text: `−${fmt.money(s.fees)}` }) },
      { label: 'Refunds', num: true, render: (s) => el('span', { className: 'u-muted', text: `−${fmt.money(s.refunds)}` }) },
      { label: 'Net', num: true, render: (s) => el('b', { text: fmt.money(s.net) }) },
      { label: 'Payouts', num: true, render: (s) => fmt.money(s.payouts) },
      { label: 'Status', render: (s) => (s.status === 'open' ? Portal.badge('open', 'In progress') : Portal.badge('closed', 'Final')) },
      { label: 'Download', className: 'cell-actions', render: statementDownload },
    ],
  });

  Portal.lazy.register('statements', { fetch: () => Portal.request(statements), render: () => statementsTable.setRows(statements) });
  $('[data-statements-csv]').addEventListener('click', () => Portal.downloadCsv('statements_2026.csv', STATEMENT_COLUMNS, statements));

  /* Reconciliation ------------------------------------------------------------------------ */
  const difference = (b) => Number(b.received) - Number(b.expected);
  const isOpen = (b) => b.status === 'mismatch';
  const BATCH_BADGE = { matched: ['paid', 'Matched'], mismatch: ['failed', 'Mismatch'], resolved: ['closed', 'Resolved'] };

  function diffCell(b) {
    const diff = difference(b);
    const text = diff === 0 ? '0.00' : `${diff > 0 ? '+' : '−'}${fmt.money(Math.abs(diff))}`;
    return el('span', { className: diff < 0 && isOpen(b) ? 'diff--negative' : 'u-muted' }, [text, el('span', { className: 'amount__currency', text: ` ${b.currency}` })]);
  }

  function renderReconKpis() {
    const open = batches.filter(isOpen);
    const items = open.flatMap((b) => b.items);
    $('[data-kpi="matched"]').textContent = `${fmt.count(batches.length - open.length)} of ${fmt.count(batches.length)}`;
    $('[data-kpi-meta="matched"]').textContent = 'Settled Nov 21 – Nov 26';
    $('[data-kpi="unmatched"]').textContent = fmt.count(items.length);
    $('[data-kpi-meta="unmatched"]').textContent = open.length ? `In ${fmt.count(open.length)} ${open.length === 1 ? 'batch' : 'batches'} to review` : 'Everything is reconciled';
    $('[data-kpi="difference"]').textContent = fmt.money(open.reduce((sum, b) => sum + Math.abs(difference(b)) * USD_PER[b.currency], 0));
    $('[data-kpi-meta="difference"]').textContent = 'Received less than expected';
  }

  const batchesTable = Portal.dataTable($('[data-batches]'), {
    pageSize: 12,
    onRowClick: openBatch,
    rowLabel: (b) => `settlement batch ${b.id}`,
    columns: [
      { label: 'Batch ID', render: (b) => Portal.copyable(b.id, { label: 'Copy batch ID' }) },
      { label: 'Provider', render: (b) => b.provider },
      { label: 'Settled at', render: (b) => el('span', { className: 'u-muted', text: fmt.dateTime(b.settledAt) }) },
      { label: 'Expected', num: true, render: (b) => amountCell(b.expected, b.currency) },
      { label: 'Received', num: true, render: (b) => amountCell(b.received, b.currency) },
      { label: 'Difference', num: true, render: diffCell },
      { label: 'Status', render: (b) => Portal.badge(...BATCH_BADGE[b.status]) },
    ],
  });

  function renderBatches() {
    batchesTable.setRows(batches);
    renderReconKpis();
  }

  Portal.lazy.register('recon-kpis', { fetch: () => Portal.request(batches), render: renderReconKpis });
  Portal.lazy.register('batches', { fetch: () => Portal.request(batches), render: renderBatches });

  function batchBody(b) {
    return [
      el('div', { className: 'amount-hero' }, [
        el('span', { className: 'amount-hero__value', text: fmt.money(b.received) }),
        el('span', { className: 'amount-hero__currency', text: `${b.currency} received` }),
        Portal.badge(...BATCH_BADGE[b.status]),
      ]),
      isOpen(b) ? el('div', { className: 'note note--danger' }, [iconEl('alert'), el('span', { text: `${b.provider} settled ${money(Math.abs(difference(b)), b.currency)} less than expected. Check each item with the provider, then mark the batch as resolved.` })]) : null,
      b.status === 'resolved' ? el('div', { className: 'note note--success' }, [iconEl('check-circle'), el('span', { text: `Resolved by ${b.resolvedBy}.` })]) : null,
      section('Settlement', [kv([
        ['Batch ID', Portal.copyable(b.id)],
        ['Provider', b.provider],
        ['Settled at', fmt.dateTime(b.settledAt)],
        ['Expected', money(b.expected, b.currency)],
        ['Received', money(b.received, b.currency)],
        ['Difference', diffCell(b)],
      ])]),
      b.items.length ? section(`Unmatched items (${b.items.length})`, [el('ul', { className: 'rows' }, b.items.map((item) => el('li', { className: 'rows__item' }, [
        el('span', { className: 'rows__main' }, [
          el('span', { text: item.kind }),
          el('span', { className: 'rows__sub' }, [el('a', { className: 'inline-link u-mono', text: item.paymentId, attrs: { href: `transactions.html?payment=${encodeURIComponent(item.paymentId)}` } }), ` · ${item.ref}`]),
        ]),
        el('span', { className: 'rows__meta' }, [el('span', { className: 'u-num', text: `−${money(item.amount, b.currency)}` })]),
      ])))]) : el('p', { className: 't-meta', text: 'Every payment in this batch matched what the provider settled.' }),
    ];
  }

  function batchActions(b, drawer) {
    const actions = [btn('Close', { attrs: { 'data-dialog-close': '' } })];
    if (isOpen(b)) actions.push(btn('Mark as resolved', { variant: 'primary', iconName: 'check', onClick: () => resolveBatch(b, drawer) }));
    return actions;
  }

  function openBatch(b) {
    const drawer = Portal.drawer.open({ title: `Batch ${b.id}`, subtitle: `${b.provider} · ${fmt.dateTime(b.settledAt)}` });
    drawer.setBody(batchBody(b));
    drawer.setFooter(batchActions(b, drawer));
  }

  async function resolveBatch(b, drawer) {
    const ok = await Portal.confirm({
      title: 'Mark this batch as resolved?', confirmLabel: 'Mark as resolved',
      message: 'Do this once the provider has explained or repaid each item. The difference stays in the audit log.',
      details: [['Batch', b.id], ['Unmatched items', String(b.items.length)], ['Difference', money(Math.abs(difference(b)), b.currency)]],
    });
    if (!ok) return;
    Object.assign(b, { status: 'resolved', resolvedBy: ME });
    drawer.setBody(batchBody(b));
    drawer.setFooter(batchActions(b, drawer));
    batchesTable.refresh();
    renderReconKpis();
    Portal.toast('Batch marked as resolved');
  }

  /* Palette entries + tab deep link ------------------------------------------------------ */
  Portal.searchIndex = [
    { label: 'New export', hint: 'Reports', run: openNewExport },
    { label: 'Statements', hint: 'Reports tab', run: () => $('#tab-statements').click() },
    { label: 'Reconciliation', hint: 'Reports tab', run: () => $('#tab-reconciliation').click() },
    ...batches.filter(isOpen).map((b) => ({ label: b.id, hint: `${b.provider} · mismatch`, run: () => openBatch(b) })),
  ];
  const tab = new URLSearchParams(window.location.search).get('tab');
  if (tab) $('[data-tabs]').portalSelect?.(tab);
})();
