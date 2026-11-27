/*
 * Webhooks: up to 10 endpoints, 24 h delivery KPIs, and an endpoint table with one overflow menu per row
 * (edit, send test event, disable/enable, delete). The add/edit drawer validates a public https URL and
 * subscribes to named events (grouped, with select all); a new endpoint reveals its signing secret once.
 * The detail drawer has Overview (secret reveal for 10 s, rotate, events, retry policy) and Deliveries
 * (request and response, retry dead-lettered deliveries, send a test event).
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const endpoints = Portal.data.webhookEndpoints;
  const EVENT_GROUPS = Portal.data.webhookEvents;
  const NOW = Date.UTC(2026, 10, 27, 12);
  const DAY = 86400000;
  const MAX_ENDPOINTS = 10;
  const MAX_ATTEMPTS = 5;
  const REVEAL_SECONDS = 10;
  const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const PRIVATE_V4 = [/^10\./, /^127\./, /^0\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];
  const $ = (s, scope = document) => scope.querySelector(s);
  const at = (offsetMs = 0) => new Date(NOW + offsetMs).toISOString();

  /* Helpers ------------------------------------------------------------------------------ */
  function randomString(length, alphabet = ALPHABET) {
    const limit = 256 - (256 % alphabet.length);
    let out = '';
    while (out.length < length) {
      crypto.getRandomValues(new Uint8Array(length)).forEach((b) => { if (b < limit && out.length < length) out += alphabet[b % alphabet.length]; });
    }
    return out;
  }
  const newSecret = () => `whsec_${randomString(32)}`;
  const maskSecret = (secret) => `whsec_${'•'.repeat(12)}${secret.slice(-4)}`;
  const kv = (pairs) => el('dl', { className: 'kv' }, pairs.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, [v])]));
  /** Copy button for a secret: shared copy animation, and a toast that never echoes the value. */
  const secretCopyButton = (secret) => el('button', {
    className: 'copy__btn', attrs: { type: 'button', 'data-copy': secret, 'data-copy-toast': 'Signing secret copied to the clipboard', 'aria-label': 'Copy signing secret' },
  }, [iconEl('copy', 'icon-copy'), iconEl('check', 'icon-check')]);
  function urlCopy(url) {
    const node = Portal.copyable(url, { label: 'Copy endpoint URL' });
    node.firstChild.classList.add('endpoint-url');
    node.firstChild.title = url;
    return node;
  }
  const statusBadge = (status) => (status === 'failing' ? Portal.badge('failed', 'Failing') : Portal.badge(status));
  const deliveryBadge = (status) => (status === 'dead' ? Portal.badge('dead', 'Dead-lettered') : Portal.badge(status));

  /** Rejects non-https URLs, credentials, localhost and private or link-local addresses. */
  function urlProblem(value) {
    let url;
    try { url = new URL(value); } catch { return 'Enter a full URL, for example https://api.example.com/webhooks.'; }
    if (url.protocol !== 'https:') return 'The URL must start with https://.';
    if (url.username || url.password) return 'Remove the user name and password from the URL.';
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || /\.(localhost|local|internal)$/.test(host)) return 'Use a public address. Localhost and internal hosts cannot receive webhooks.';
    if (host.startsWith('[') || PRIVATE_V4.some((re) => re.test(host))) return 'Use a public address. Private and loopback IPs cannot receive webhooks.';
    if (!host.includes('.')) return 'Use a fully qualified domain name.';
    return '';
  }

  function stats(endpoint) {
    const week = endpoint.deliveries.filter((d) => NOW - new Date(d.time).getTime() <= 7 * DAY);
    const last = endpoint.deliveries.reduce((max, d) => (d.time > max ? d.time : max), '');
    return { rate: week.length ? (week.filter((d) => d.status === 'delivered').length / week.length) * 100 : null, last };
  }

  /* Header count + KPIs ---------------------------------------------------------------- */
  function renderCount() {
    const full = endpoints.length >= MAX_ENDPOINTS;
    $('[data-endpoint-count]').textContent = `${endpoints.length} of ${MAX_ENDPOINTS} endpoints`;
    $('[data-add-endpoint]').disabled = full;
    $('[data-limit-note]').hidden = !full;
  }

  function renderKpis() {
    const day = endpoints.flatMap((e) => e.deliveries).filter((d) => NOW - new Date(d.time).getTime() <= DAY);
    const all = endpoints.flatMap((e) => e.deliveries);
    const delivered = day.filter((d) => d.status === 'delivered').length;
    const set = (key, value, meta) => { $(`[data-kpi="${key}"]`).textContent = value; $(`[data-kpi-meta="${key}"]`).textContent = meta; };
    set('total', fmt.count(day.length), `across ${endpoints.filter((e) => e.status !== 'disabled').length} enabled endpoints`);
    set('rate', day.length ? `${((delivered / day.length) * 100).toFixed(1)}%` : '–', `${fmt.count(delivered)} of ${fmt.count(day.length)} delivered`);
    set('retrying', fmt.count(all.filter((d) => d.status === 'retrying').length), 'Next attempt within 30 minutes');
    set('dead', fmt.count(all.filter((d) => d.status === 'dead').length), 'Failed 5 attempts. Retry from an endpoint.');
  }

  Portal.lazy.register('webhook-kpis', { fetch: () => Portal.request(endpoints), render: renderKpis });

  /* Endpoints table ---------------------------------------------------------------------- */
  function eventChips(events) {
    const shown = events.slice(0, 2).map((e) => el('span', { className: 'chip chip--mono', text: e }));
    const rest = events.length - 2;
    return el('span', { className: 'chips' }, [...shown, rest > 0 ? el('span', { className: 'chip', text: `+${rest}`, attrs: { title: events.slice(2).join(', ') } }) : null]);
  }

  const table = Portal.dataTable($('[data-table]'), {
    pageSize: MAX_ENDPOINTS,
    onRowClick: (e) => openDetail(e),
    rowLabel: (e) => `endpoint ${e.url}`,
    empty: { icon: 'webhook', title: 'No endpoints yet', text: 'Add an https endpoint to get payment and card events pushed to your server.', action: btn('Add endpoint', { variant: 'primary', iconName: 'plus', onClick: () => openForm() }) },
    columns: [
      { label: 'Endpoint', render: (e) => el('span', { className: 'endpoint-cell' }, [urlCopy(e.url), e.description ? el('span', { className: 'cell-sub', text: e.description }) : null]) },
      { label: 'Events', render: (e) => eventChips(e.events) },
      { label: 'Status', render: (e) => statusBadge(e.status) },
      { label: '7-day success', num: true, render: (e) => { const r = stats(e).rate; return el('span', { className: r === null ? 'u-muted' : '', text: r === null ? 'No deliveries' : `${r.toFixed(1)}%` }); } },
      { label: 'Last delivery', render: (e) => { const last = stats(e).last; return el('span', { className: 'u-muted', text: last ? fmt.relative(last) : 'Never' }); } },
      { label: 'Actions', className: 'cell-actions', render: rowMenu },
    ],
  });

  function rowMenu(e) {
    const enabled = e.status !== 'disabled';
    return Portal.menu.button(() => [
      { label: 'Edit', icon: 'edit', description: 'URL, description and events', onSelect: () => openForm(e) },
      { label: 'Send test event', icon: 'send', description: enabled ? 'Deliver a sample payload now' : 'Enable the endpoint first', disabled: !enabled, onSelect: () => openDetail(e, { tab: 'deliveries' }) },
      { label: enabled ? 'Disable' : 'Enable', icon: 'power', description: enabled ? 'Pause deliveries to this URL' : 'Resume deliveries to this URL', onSelect: () => toggleEndpoint(e) },
      'separator',
      { label: 'Delete', icon: 'trash', tone: 'danger', description: 'Stop all deliveries permanently', onSelect: () => deleteEndpoint(e) },
    ], `Actions for ${e.url}`);
  }

  function refresh() {
    renderCount();
    renderKpis();
    table.setRows([...endpoints]);
  }

  Portal.lazy.register('endpoints', { fetch: () => Portal.request(endpoints), render: refresh });

  function toggleEndpoint(e) {
    e.status = e.status === 'disabled' ? 'active' : 'disabled';
    refresh();
    Portal.toast(e.status === 'disabled' ? 'Endpoint disabled. Events are no longer sent to it.' : 'Endpoint enabled');
  }

  async function deleteEndpoint(e) {
    const ok = await Portal.confirm({
      title: 'Delete this endpoint?', tone: 'danger', confirmLabel: 'Delete endpoint', cancelLabel: 'Keep endpoint',
      message: 'Deliveries stop immediately and pending retries are dropped. This cannot be undone.',
      details: [['URL', e.url], ['Events', `${e.events.length} subscribed`]],
    });
    if (!ok) return;
    endpoints.splice(endpoints.indexOf(e), 1);
    refresh();
    Portal.toast('Endpoint deleted');
  }

  /* Add / edit drawer ------------------------------------------------------------------------ */
  function eventGroup(name, selected) {
    const boxes = EVENT_GROUPS[name].map((type) => el('input', { attrs: { type: 'checkbox', name: 'wh-event', value: type, checked: selected.includes(type) } }));
    const all = el('input', { attrs: { type: 'checkbox', 'aria-label': `Select all ${name.toLowerCase()} events` } });
    const sync = () => {
      const count = boxes.filter((b) => b.checked).length;
      all.checked = count === boxes.length;
      all.indeterminate = count > 0 && count < boxes.length;
    };
    all.addEventListener('change', () => { boxes.forEach((b) => { b.checked = all.checked; }); sync(); });
    boxes.forEach((b) => b.addEventListener('change', sync));
    sync();
    return el('div', { className: 'event-group', attrs: { role: 'group', 'aria-label': `${name} events` } }, [
      el('div', { className: 'event-group__head' }, [el('span', { className: 't-label', text: name }), el('label', { className: 'check' }, [all, el('span', { text: 'Select all' })])]),
      ...boxes.map((b) => el('label', { className: 'check' }, [b, el('span', { className: 'u-mono', text: b.value })])),
    ]);
  }

  function openForm(endpoint) {
    const editing = Boolean(endpoint);
    const url = el('input', { className: 'input input--mono', attrs: { id: 'wh-url', type: 'url', inputmode: 'url', maxlength: '2048', autocomplete: 'off', spellcheck: 'false', placeholder: 'https://api.yourcompany.com/webhooks/portal', value: endpoint?.url } });
    const description = el('input', { className: 'input', attrs: { id: 'wh-desc', maxlength: '120', autocomplete: 'off', placeholder: 'Production order service', value: endpoint?.description } });
    const groups = el('div', { className: 'event-groups' }, Object.keys(EVENT_GROUPS).map((name) => eventGroup(name, endpoint?.events || [])));
    const drawer = Portal.drawer.open({ title: editing ? 'Edit endpoint' : 'Add endpoint', subtitle: editing ? endpoint.url : 'Events are signed with a secret you can verify on your server.' });
    drawer.setBody(el('div', { className: 'form-grid' }, [
      el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Endpoint URL', attrs: { for: 'wh-url' } }), url, el('p', { className: 'field__help', text: 'Public https URL. Localhost and private IPs are not allowed.' })]),
      el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Description (optional)', attrs: { for: 'wh-desc' } }), description]),
      el('div', { className: 'field', attrs: { role: 'group', 'aria-labelledby': 'wh-events-label' } }, [el('p', { className: 'field__label', text: 'Events', attrs: { id: 'wh-events-label' } }), groups]),
    ]));
    drawer.setFooter([
      btn('Cancel', { attrs: { 'data-dialog-close': '' } }),
      btn(editing ? 'Save changes' : 'Add endpoint', { variant: 'primary', onClick: () => submitForm(drawer, endpoint, { url, description }) }),
    ]);
    window.setTimeout(() => url.focus(), 50);
  }

  function submitForm(drawer, endpoint, { url, description }) {
    const value = url.value.trim();
    const events = [...drawer.body.querySelectorAll('[name="wh-event"]:checked')].map((b) => b.value);
    const duplicate = endpoints.some((e) => e !== endpoint && e.url === value);
    const checks = [
      Portal.fieldError(url, urlProblem(value) || (duplicate ? 'An endpoint with this URL already exists.' : '')),
      Portal.fieldError(drawer.body.querySelector('[name="wh-event"]'), events.length ? '' : 'Choose at least one event.'),
    ];
    if (checks.includes(false)) { drawer.body.querySelector('[aria-invalid="true"]')?.focus(); return; }
    if (endpoint) {
      Object.assign(endpoint, { url: value, description: description.value.trim(), events });
      drawer.close();
      refresh();
      Portal.toast('Endpoint updated');
      return;
    }
    const created = { id: `we_${randomString(14, '0123456789abcdef')}`, url: value, description: description.value.trim(), events, status: 'active', created: at(), secret: newSecret(), deliveries: [] };
    endpoints.push(created);
    refresh();
    showNewSecret(drawer, created);
  }

  /** Shows the new endpoint's signing secret once inside the drawer; Done unlocks after acknowledging. */
  function showNewSecret(drawer, endpoint) {
    const field = el('input', { className: 'input input--mono', attrs: { readonly: true, value: endpoint.secret, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Signing secret' } });
    const copy = secretCopyButton(endpoint.secret);
    const ack = el('input', { attrs: { type: 'checkbox' } });
    const done = btn('Done', { variant: 'primary', attrs: { disabled: true }, onClick: () => drawer.close() });
    const guard = (event) => {
      if (event.target !== drawer.el || ack.checked) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      Portal.toast('Confirm you have stored the secret first', { icon: 'alert' });
    };
    window.addEventListener('cancel', guard, true);
    drawer.el.addEventListener('click', guard);
    drawer.el.addEventListener('close', () => { window.removeEventListener('cancel', guard, true); field.value = ''; copy.removeAttribute('data-copy'); });
    drawer.el.querySelector('.drawer__head [data-dialog-close]').hidden = true;
    ack.addEventListener('change', () => { done.disabled = !ack.checked; });
    drawer.setTitle('Endpoint added');
    drawer.setBody([
      el('p', { className: 'note note--success' }, [iconEl('check-circle'), el('span', { text: `Events will be sent to ${endpoint.url}.` })]),
      el('section', { className: 'drawer__section' }, [
        el('h3', { className: 'drawer__section-title', text: 'Signing secret' }),
        el('div', { className: 'input-group input-group--trailing' }, [field, el('span', { className: 'input-group__action' }, [copy])]),
        el('p', { className: 'field__help', text: 'Verify the Webhook-Signature header of every request with this secret.' }),
      ]),
      el('p', { className: 'banner' }, [iconEl('alert'), el('span', { text: 'This is the only time the full secret is shown here. You can reveal it briefly later from the endpoint.' })]),
      el('label', { className: 'check' }, [ack, el('span', { text: "I've stored this secret safely" })]),
    ]);
    drawer.setFooter([done]);
  }

  /* Endpoint detail drawer ---------------------------------------------------------------------- */
  function tabButton(id, label, selected) {
    return el('button', { className: 'tabs__tab', attrs: { type: 'button', role: 'tab', id: `wh-tab-${id}`, 'aria-controls': `wh-panel-${id}`, 'aria-selected': String(selected) }, dataset: { value: id } }, [label]);
  }

  function openDetail(endpoint, { tab = 'overview' } = {}) {
    const drawer = Portal.drawer.open({ title: endpoint.description || 'Endpoint', subtitle: endpoint.url });
    const overview = el('div', { className: 'stack drawer-panel', attrs: { role: 'tabpanel', id: 'wh-panel-overview', 'aria-labelledby': 'wh-tab-overview' } });
    const deliveries = el('div', { className: 'stack drawer-panel', attrs: { role: 'tabpanel', id: 'wh-panel-deliveries', 'aria-labelledby': 'wh-tab-deliveries' } });
    const tabs = el('div', { className: 'tabs', attrs: { role: 'tablist', 'aria-label': 'Endpoint details', 'data-tabs': '' } }, [
      tabButton('overview', 'Overview', tab === 'overview'),
      tabButton('deliveries', 'Deliveries', tab === 'deliveries'),
    ]);
    const ctx = { endpoint, drawer, overview, deliveries, timer: null };
    drawer.el.addEventListener('close', () => window.clearInterval(ctx.timer));
    // One block wrapper: as a direct grid child of .drawer__body the scrollable tab list collapses to 0 height.
    drawer.setBody(el('div', {}, [tabs, overview, deliveries]));
    Portal.initTabs(drawer.el);
    renderOverview(ctx);
    renderDeliveries(ctx);
    drawer.setFooter([btn('Close', { attrs: { 'data-dialog-close': '' } }), btn('Edit endpoint', { iconName: 'edit', onClick: () => { drawer.close(); openForm(endpoint); } })]);
    if (tab === 'deliveries') window.setTimeout(() => deliveries.querySelector('select')?.focus(), 80);
  }

  function renderOverview(ctx) {
    const { endpoint } = ctx;
    const secretText = el('span', { className: 'secret-row__value u-mono', text: maskSecret(endpoint.secret) });
    const reveal = btn('Reveal', { size: 'sm', variant: 'ghost', iconName: 'eye', attrs: { 'data-reveal': '' }, onClick: () => revealFor(ctx, secretText, reveal) });
    const rotate = btn('Rotate', { size: 'sm', variant: 'ghost', iconName: 'rotate', onClick: () => rotateSecret(ctx) });
    ctx.overview.replaceChildren(
      kv([
        ['URL', Portal.copyable(endpoint.url, { label: 'Copy endpoint URL' })],
        ['Endpoint ID', Portal.copyable(endpoint.id, { label: 'Copy endpoint ID' })],
        ['Status', statusBadge(endpoint.status)],
        ['Created', fmt.date(endpoint.created)],
        ['Signing secret', el('span', { className: 'secret-row' }, [secretText, el('span', { className: 'secret-row__actions' }, [reveal, rotate])])],
      ]),
      el('section', { className: 'drawer__section' }, [
        el('h3', { className: 'drawer__section-title', text: `Events (${endpoint.events.length})` }),
        el('div', { className: 'chips' }, endpoint.events.map((e) => el('span', { className: 'chip chip--mono', text: e }))),
      ]),
      el('p', { className: 'note' }, [iconEl('info'), el('span', { text: `Retry policy: up to ${MAX_ATTEMPTS} attempts with backoff, then dead-lettered. You can retry dead-lettered deliveries by hand.` })]),
    );
  }

  /** Shows the full signing secret (with a copy button) for REVEAL_SECONDS, then masks it again. */
  function revealFor(ctx, slot, button) {
    let left = REVEAL_SECONDS;
    slot.replaceChildren(ctx.endpoint.secret, secretCopyButton(ctx.endpoint.secret));
    button.disabled = true;
    const tick = () => { button.lastChild.textContent = `Hides in ${left} s`; };
    tick();
    window.clearInterval(ctx.timer);
    ctx.timer = window.setInterval(() => {
      left -= 1;
      if (left > 0) { tick(); return; }
      window.clearInterval(ctx.timer);
      slot.replaceChildren(maskSecret(ctx.endpoint.secret));
      button.lastChild.textContent = 'Reveal';
      button.disabled = false;
    }, 1000);
  }

  async function rotateSecret(ctx) {
    const ok = await Portal.confirm({
      title: 'Rotate the signing secret?', confirmLabel: 'Rotate secret',
      message: 'A new secret signs every delivery from now on. Requests are also signed with the old secret for 24 hours so you can deploy the new one.',
      details: [['Endpoint', ctx.endpoint.url], ['Current secret', maskSecret(ctx.endpoint.secret)]],
    });
    if (!ok) return;
    ctx.endpoint.secret = newSecret();
    window.clearInterval(ctx.timer);
    renderOverview(ctx);
    const row = ctx.overview.querySelector('.secret-row');
    revealFor(ctx, row.querySelector('.secret-row__value'), row.querySelector('[data-reveal]'));
    Portal.toast('Signing secret rotated. Copy the new one now.');
  }

  function renderDeliveries(ctx) {
    const { endpoint } = ctx;
    const enabled = endpoint.status !== 'disabled';
    const select = el('select', { className: 'select select--sm', attrs: { id: 'wh-test-event', 'aria-label': 'Event type for the test', disabled: !enabled } }, endpoint.events.map((e) => el('option', { text: e, attrs: { value: e } })));
    const send = btn('Send test event', { size: 'sm', iconName: 'send', attrs: { disabled: !enabled }, onClick: () => sendTest(ctx, select.value) });
    const list = [...endpoint.deliveries].sort((a, b) => b.time.localeCompare(a.time));
    ctx.deliveries.replaceChildren(
      el('div', { className: 'test-event' }, [select, send, enabled ? null : el('span', { className: 't-meta', text: 'Enable the endpoint to send test events.' })]),
      list.length
        ? el('ul', { className: 'rows' }, list.map((d) => deliveryRow(ctx, d)))
        : el('div', { className: 'empty' }, [el('span', { className: 'empty__icon' }, [iconEl('send')]), el('p', { className: 'empty__title', text: 'No deliveries yet' }), el('p', { className: 'empty__text', text: 'Send a test event to check your endpoint responds with a 2xx code.' })]),
    );
  }

  function deliveryRow(ctx, d) {
    const open = () => renderDelivery(ctx, d);
    return el('li', { className: `rows__item delivery-row${d.isNew ? ' is-new' : ''}`, attrs: { tabindex: '0', role: 'button', 'aria-label': `Delivery ${d.event}, ${d.status}` }, on: { click: open, keydown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } } } }, [
      el('span', { className: 'rows__main' }, [
        el('span', { className: 'u-mono', text: d.event }),
        el('span', { className: 'rows__sub', text: `${fmt.dateTime(d.time)} · ${d.attempts}/${MAX_ATTEMPTS} attempts · HTTP ${d.code}` }),
      ]),
      el('span', { className: 'rows__meta' }, [deliveryBadge(d.status), iconEl('chevron-right')]),
    ]);
  }

  function requestText(endpoint, d) {
    const url = new URL(endpoint.url);
    const signature = Array.from(d.id + endpoint.id, (c) => c.charCodeAt(0).toString(16)).join('').slice(0, 40);
    return [
      `POST ${url.pathname} HTTP/1.1`, `Host: ${url.host}`, 'Content-Type: application/json', 'User-Agent: Portal-Webhooks/1.0',
      `Webhook-Id: ${d.id}`, `Webhook-Timestamp: ${Math.floor(new Date(d.time).getTime() / 1000)}`, `Webhook-Signature: v1=${signature}`,
      '', JSON.stringify({ id: d.eventId, ...d.payload }, null, 2),
    ].join('\n');
  }

  function responseText(d) {
    if (d.status === 'delivered') return `HTTP/1.1 ${d.code} OK\nContent-Type: application/json\n\n{\n  "received": true\n}`;
    const reason = { 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' }[d.code] || 'Error';
    return `HTTP/1.1 ${d.code} ${reason}\nContent-Type: text/plain\n\nupstream connect error or disconnect/reset before headers`;
  }

  function renderDelivery(ctx, d) {
    const back = btn('All deliveries', { size: 'sm', variant: 'ghost', iconName: 'chevron-left', onClick: () => renderDeliveries(ctx) });
    ctx.deliveries.replaceChildren(
      el('div', { className: 'field__row' }, [back, d.status === 'dead' ? btn('Retry delivery', { size: 'sm', variant: 'primary', iconName: 'rotate', onClick: () => retryDelivery(ctx, d) }) : null]),
      kv([
        ['Event', el('span', { className: 'u-mono', text: d.event })],
        ['Status', deliveryBadge(d.status)],
        ['Attempts', `${d.attempts} of ${MAX_ATTEMPTS}`],
        ['Response', `HTTP ${d.code} · ${fmt.count(d.duration)} ms`],
        ['Time', `${fmt.dateTime(d.time)} UTC`],
        ['Delivery ID', Portal.copyable(d.id)],
      ]),
      Portal.codePanel(`Request · POST ${ctx.endpoint.url}`, requestText(ctx.endpoint, d)),
      Portal.codePanel(`Response · HTTP ${d.code}`, responseText(d)),
    );
    ctx.deliveries.querySelector('button')?.focus();
  }

  async function retryDelivery(ctx, d) {
    await Portal.request(null, { delay: 500 });
    Object.assign(d, { status: 'delivered', code: 200, duration: 142, time: at() });
    renderDelivery(ctx, d);
    table.refresh();
    renderKpis();
    Portal.toast('Delivery retried: HTTP 200');
  }

  function sendTest(ctx, type) {
    const failing = ctx.endpoint.status === 'failing';
    const objectId = `${type.startsWith('card') ? 'co_' : 'req_'}test${randomString(6, '0123456789abcdef')}`;
    const d = {
      id: `dl_${randomString(12, '0123456789abcdef')}`, eventId: `evt_test_${randomString(8, '0123456789abcdef')}`, event: type, objectId,
      status: failing ? 'retrying' : 'delivered', attempts: 1, code: failing ? 503 : 200, duration: failing ? 10000 : 118, time: at(), isNew: true,
      payload: { type, test: true, createdAt: at(), data: { id: objectId } },
    };
    ctx.endpoint.deliveries.push(d);
    renderDeliveries(ctx);
    d.isNew = false;
    table.refresh();
    renderKpis();
    Portal.toast(failing ? 'Test event sent: HTTP 503. It will be retried.' : 'Test event delivered: HTTP 200', failing ? { icon: 'alert' } : undefined);
  }

  /* Header, palette entries ----------------------------------------------------------------------- */
  $('[data-add-endpoint]').addEventListener('click', () => openForm());
  Portal.searchIndex = [
    { label: 'Add webhook endpoint', hint: 'Webhooks', run: () => { if (endpoints.length < MAX_ENDPOINTS) openForm(); } },
    ...endpoints.map((e) => ({ label: e.url, hint: e.description, run: () => openDetail(e) })),
  ];
})();
