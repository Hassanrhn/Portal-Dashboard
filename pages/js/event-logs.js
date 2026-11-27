/*
 * Event logs: two tabs.
 *   API requests: every call made with the partner's keys, filterable by status class (with counts), method and
 *   path / request ID, plus a live tail that prepends a simulated request every 3 s (paused while the browser tab
 *   is hidden). The drawer shows headers with the API key masked, request and response bodies, and links to the payment.
 *   Events: every platform event with its webhook delivery count; the drawer shows the JSON payload.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const requests = Portal.data.apiRequests;
  const events = Portal.data.events;
  const NOW = Date.UTC(2026, 10, 27, 12);
  const TAIL_INTERVAL = 3000;
  const API_HOST = 'pay-api.the-block.com';
  const PAYMENT_ID = /\breq_[a-z0-9]+/;
  const STATUS_CLASS = { '2xx': [200, 300], '4xx': [400, 500], '5xx': [500, 600] };
  const $ = (s, scope = document) => scope.querySelector(s);

  const filters = { q: '', status: 'all', method: '', eventQ: '' };
  const kv = (pairs) => el('dl', { className: 'kv' }, pairs.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, [v])]));
  const maskKey = (id) => `${id.slice(0, id.lastIndexOf('_') + 1)}…${id.slice(-4)}`;
  /** Masked key ID on screen; the copy button copies the full key ID (never a secret). */
  function keyIdCopy(id) {
    const node = Portal.copyable(id, { label: 'Copy key ID' });
    node.firstChild.textContent = maskKey(id);
    node.firstChild.classList.add('u-muted');
    return node;
  }
  const inClass = (code, cls) => code >= STATUS_CLASS[cls][0] && code < STATUS_CLASS[cls][1];

  function codeBadge(code) {
    const tone = code >= 500 ? 'failed' : code >= 400 ? 'pending' : 'succeeded';
    return Portal.badge(tone, String(code));
  }

  /* API requests table ------------------------------------------------------------------- */
  const requestTable = Portal.dataTable($('[data-requests-table]'), {
    pageSize: 15,
    onRowClick: openRequest,
    rowLabel: (r) => `request ${r.method} ${r.path}`,
    empty: { icon: 'logs', title: 'No requests match these filters', text: 'Clear the filters or widen your search.', action: btn('Clear filters', { onClick: clearFilters }) },
    columns: [
      { label: 'Time', render: (r) => el('span', { className: 'u-muted u-num', text: fmt.time(r.time), attrs: { title: `${fmt.dateTime(r.time)} UTC` } }) },
      { label: 'Method', render: (r) => el('span', { className: 'chip chip--mono', text: r.method }) },
      { label: 'Path', render: (r) => el('span', { className: 'u-mono', text: r.path }) },
      { label: 'Status', render: (r) => codeBadge(r.status) },
      { label: 'Duration', num: true, render: (r) => el('span', { className: 'u-muted', text: `${fmt.count(r.duration)} ms` }) },
      { label: 'Request ID', render: (r) => Portal.copyable(r.id, { label: 'Copy request ID' }) },
      { label: 'API key', render: (r) => el('span', { className: 'u-muted', text: r.keyName }) },
    ],
  });

  function matches(r, { ignoreStatus = false } = {}) {
    const q = filters.q.trim().toLowerCase();
    return (!q || r.path.toLowerCase().includes(q) || r.id.includes(q))
      && (!filters.method || r.method === filters.method)
      && (ignoreStatus || filters.status === 'all' || inClass(r.status, filters.status));
  }

  /** Re-renders the table. With animateFirstOnly, only the newly tailed row plays the row-enter animation. */
  function apply({ animateFirstOnly = false } = {}) {
    const base = requests.filter((r) => matches(r, { ignoreStatus: true }));
    document.querySelectorAll('[data-count]').forEach((node) => {
      const cls = node.dataset.count;
      node.textContent = fmt.count(cls === 'all' ? base.length : base.filter((r) => inClass(r.status, cls)).length);
    });
    requestTable.setRows(base.filter((r) => filters.status === 'all' || inClass(r.status, filters.status)));
    if (animateFirstOnly) document.querySelectorAll('[data-requests-table] tbody tr:not(:first-child)').forEach((tr) => tr.classList.remove('is-entering'));
  }

  function clearFilters() {
    Object.assign(filters, { q: '', status: 'all', method: '' });
    $('[data-filter="q"]').value = '';
    $('[data-filter="method"]').value = '';
    $('[data-filter="status"]').portalSelect?.('all');
    apply();
  }

  let searchTimer;
  $('[data-filter="q"]').addEventListener('input', (event) => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { filters.q = event.target.value; apply(); }, 150);
  });
  $('[data-filter="method"]').addEventListener('change', (event) => { filters.method = event.target.value; apply(); });
  $('[data-filter="status"]').addEventListener('segmented:change', (event) => { filters.status = event.detail.value; apply(); });

  Portal.lazy.register('requests', { fetch: () => Portal.request(requests), render: () => apply() });

  /* Live tail ------------------------------------------------------------------------------- */
  let tailTimer = null;
  let tailClock = NOW;

  function tailTick() {
    if (document.hidden) return;
    tailClock += TAIL_INTERVAL;
    requests.unshift(Portal.data.simulateRequest(new Date(tailClock).toISOString()));
    apply({ animateFirstOnly: true });
  }

  function setTail(on) {
    window.clearInterval(tailTimer);
    tailTimer = on ? window.setInterval(tailTick, TAIL_INTERVAL) : null;
    $('[data-tail-dot]').classList.toggle('is-on', on);
    Portal.toast(on ? 'Live tail on. New requests appear every few seconds.' : 'Live tail paused', { icon: on ? 'zap' : 'check-circle' });
  }
  $('[data-tail]').addEventListener('switch:change', (event) => setTail(event.detail.checked));

  /* API request drawer --------------------------------------------------------------------- */
  function headersText(r) {
    return [
      `${r.method} ${r.path} HTTP/1.1`,
      `Host: ${API_HOST}`,
      `X-Api-Key: ${maskKey(r.keyId)}.••••`,
      'Content-Type: application/json',
      'Accept: application/json',
      'User-Agent: theorangecard-backend/2.4',
      `X-Request-Id: ${r.id}`,
    ].join('\n');
  }

  function paymentLink(r) {
    const match = r.path.match(PAYMENT_ID) || (r.requestBody?.requestId || '').match(PAYMENT_ID);
    if (!match) return null;
    return el('a', { className: 'btn btn--sm', attrs: { href: `transactions.html?payment=${encodeURIComponent(match[0])}` } }, [iconEl('payments'), `Open payment ${match[0]}`]);
  }

  function openRequest(r) {
    const drawer = Portal.drawer.open({ title: `${r.method} ${r.path}`, subtitle: `${fmt.dateTime(r.time)} UTC · ${r.keyName}` });
    drawer.setBody([
      el('section', { className: 'drawer__section' }, [
        el('h3', { className: 'drawer__section-title', text: 'Summary' }),
        kv([
          ['Request ID', Portal.copyable(r.id)],
          ['Status', codeBadge(r.status)],
          ['Duration', `${fmt.count(r.duration)} ms`],
          ['API key', el('span', { className: 'key-id' }, [r.keyName, keyIdCopy(r.keyId)])],
          ['Source IP', Portal.copyable(r.ip, { label: 'Copy IP address' })],
          ['Time', `${fmt.dateTime(r.time)} UTC`],
        ]),
      ]),
      el('section', { className: 'drawer__section' }, [
        el('h3', { className: 'drawer__section-title', text: 'Request headers' }),
        Portal.codePanel('Headers (API key masked)', headersText(r)),
      ]),
      el('section', { className: 'drawer__section' }, [
        el('h3', { className: 'drawer__section-title', text: 'Request body' }),
        r.requestBody ? Portal.codePanel('application/json', r.requestBody) : el('p', { className: 't-meta', text: `No body. ${r.method} requests send parameters in the path.` }),
      ]),
      el('section', { className: 'drawer__section' }, [
        el('h3', { className: 'drawer__section-title', text: 'Response body' }),
        r.responseBody ? Portal.codePanel(`HTTP ${r.status}`, r.responseBody) : el('p', { className: 't-meta', text: `HTTP ${r.status}. No content.` }),
      ]),
    ]);
    drawer.setFooter([btn('Close', { attrs: { 'data-dialog-close': '' } }), paymentLink(r)]);
  }

  /* Events table ------------------------------------------------------------------------------ */
  function webhookBadge(e) {
    if (!e.total) return el('span', { className: 'u-muted', text: 'No endpoints' });
    return Portal.badge(e.delivered === e.total ? 'delivered' : 'retrying', `Delivered ${e.delivered}/${e.total}`);
  }

  const eventTable = Portal.dataTable($('[data-events-table]'), {
    pageSize: 15,
    onRowClick: openEvent,
    rowLabel: (e) => `event ${e.type} ${e.objectId}`,
    empty: { icon: 'search', title: 'No events match this search', text: 'Search by event type, such as payment.status_updated, or by object ID.' },
    columns: [
      { label: 'Event type', render: (e) => el('span', { className: 'u-mono', text: e.type }) },
      { label: 'Object ID', render: (e) => Portal.copyable(e.objectId, { label: 'Copy object ID' }) },
      { label: 'Created', render: (e) => el('span', { className: 'u-muted', text: fmt.dateTime(e.created) }) },
      { label: 'Webhooks', render: webhookBadge },
    ],
  });

  function applyEvents() {
    const q = filters.eventQ.trim().toLowerCase();
    eventTable.setRows(events.filter((e) => !q || e.type.includes(q) || e.objectId.toLowerCase().includes(q) || e.id.includes(q)));
  }
  $('[data-filter="event-q"]').addEventListener('input', (event) => { filters.eventQ = event.target.value; applyEvents(); });
  Portal.lazy.register('events', { fetch: () => Portal.request(events), render: applyEvents });

  function openEvent(e) {
    const drawer = Portal.drawer.open({ title: e.type, subtitle: `${fmt.dateTime(e.created)} UTC` });
    const payment = e.objectId.match(PAYMENT_ID);
    drawer.setBody([
      kv([
        ['Event ID', Portal.copyable(e.id)],
        ['Object ID', Portal.copyable(e.objectId)],
        ['Webhooks', webhookBadge(e)],
      ]),
      el('section', { className: 'drawer__section' }, [
        el('h3', { className: 'drawer__section-title', text: 'Payload' }),
        Portal.codePanel('application/json', { id: e.id, ...e.payload }),
      ]),
    ]);
    drawer.setFooter([
      btn('Close', { attrs: { 'data-dialog-close': '' } }),
      payment ? el('a', { className: 'btn', attrs: { href: `transactions.html?payment=${encodeURIComponent(payment[0])}` } }, [iconEl('payments'), 'Open payment']) : null,
      el('a', { className: 'btn btn--primary', attrs: { href: 'webhooks.html' } }, ['View deliveries', iconEl('arrow-right')]),
    ]);
  }

  /* Palette entries ---------------------------------------------------------------------------- */
  Portal.searchIndex = requests.slice(0, 30).map((r) => ({ label: r.id, hint: `${r.method} ${r.path} · ${r.status}`, run: () => openRequest(r) }));
})();
