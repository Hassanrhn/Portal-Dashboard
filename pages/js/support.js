/*
 * Contact support: a validated "New request" form (prefilled from ?request=req_…), the list of
 * your requests with a conversation drawer and reply box, live system status and contact emails.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const { tickets, status } = Portal.data.support;
  const $ = (s, scope = document) => scope.querySelector(s);
  const NOW = Date.UTC(2026, 10, 27, 12);
  const ME = 'pocket@pocket.com';
  const MAX_MESSAGE = 2000;
  const REQUEST_ID = /^req_[a-z0-9]{6,32}$/i;
  const TICKET_STATUS = { open: ['open', 'Open'], waiting: ['awaiting', 'Waiting on you'], closed: ['closed', 'Closed'] };
  const SERVICE_STATUS = { operational: ['active', 'Operational'], degraded: ['review', 'Degraded'], outage: ['failed', 'Outage'] };
  const CONTACTS = [
    ['support@the-block.com', 'General support, one business day'],
    ['security@the-block.com', 'Report a security issue'],
  ];

  const form = $('[data-ticket-form]');
  const fields = { topic: $('#tk-topic'), request: $('#tk-request'), subject: $('#tk-subject'), message: $('#tk-message') };
  let priority = 'Normal';

  /* New request form ---------------------------------------------------------------------- */
  const prefill = new URLSearchParams(window.location.search).get('request');
  if (prefill) {
    fields.request.value = prefill.slice(0, 40);
    Portal.fieldError(fields.request, REQUEST_ID.test(fields.request.value) ? '' : 'This does not look like a request ID. They start with req_.');
    if (!fields.topic.value) fields.topic.value = 'Payments';
  }

  function syncCounter() {
    const length = fields.message.value.length;
    const counter = $('[data-counter]');
    counter.textContent = `${fmt.count(length)} / ${fmt.count(MAX_MESSAGE)}`;
    counter.classList.toggle('is-over', length >= MAX_MESSAGE);
  }

  function validateForm() {
    const requestId = fields.request.value.trim();
    const checks = [
      [fields.topic, fields.topic.value ? '' : 'Choose a topic.'],
      [fields.request, !requestId || REQUEST_ID.test(requestId) ? '' : 'Request IDs start with req_, for example req_8f3a91c2e7.'],
      [fields.subject, fields.subject.value.trim().length >= 5 ? '' : 'Add a short subject (at least 5 characters).'],
      [fields.message, fields.message.value.trim().length >= 20 ? '' : 'Describe the problem in at least 20 characters.'],
    ];
    const failed = checks.filter(([input, message]) => !Portal.fieldError(input, message));
    failed[0]?.[0].focus();
    return !failed.length;
  }

  function nextTicketId() {
    const top = Math.max(...tickets.map((t) => Number(t.id.slice(4))), 2041);
    return `TKT-${top + 1}`;
  }

  async function submitTicket(event) {
    event.preventDefault();
    if (!validateForm()) return;
    const submit = $('[data-submit]');
    submit.setAttribute('aria-busy', 'true');
    await Portal.request(null, { delay: 700 });
    submit.removeAttribute('aria-busy');
    const time = new Date(NOW).toISOString();
    const ticket = {
      id: nextTicketId(), subject: fields.subject.value.trim(), topic: fields.topic.value, priority, status: 'open',
      requestId: fields.request.value.trim(), updated: time,
      thread: [{ from: ME, staff: false, time, text: fields.message.value.trim() }],
    };
    tickets.unshift(ticket);
    renderTickets();
    form.reset();
    $('[data-priority]').portalSelect('Normal');
    setPriority('Normal');
    syncCounter();
    Portal.toast(`Request ${ticket.id} sent. We will reply by email and here.`);
  }

  function setPriority(value) {
    priority = value;
    $('[data-urgent-note]').hidden = value !== 'Urgent';
  }

  fields.message.addEventListener('input', syncCounter);
  Object.values(fields).forEach((input) => input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') Portal.fieldError(input, ''); }));
  $('[data-priority]').addEventListener('segmented:change', (event) => setPriority(event.detail.value));
  form.addEventListener('submit', submitTicket);
  syncCounter();

  /* Your requests -------------------------------------------------------------------------- */
  const ticketBadge = (t) => Portal.badge(...TICKET_STATUS[t.status]);

  function renderTickets() {
    const list = $('[data-tickets]');
    if (!tickets.length) {
      list.replaceChildren(el('li', { className: 'rows__item u-muted', text: 'No requests yet. Your requests appear here.' }));
      return;
    }
    list.replaceChildren(...tickets.map((t) => el('li', { className: 'rows__item support__ticket' }, [
      el('button', { className: 'support__ticket-btn', attrs: { type: 'button', 'aria-label': `Open ${t.id}: ${t.subject}` }, on: { click: () => openTicket(t) } }, [
        el('span', { className: 'rows__main' }, [
          el('span', { className: 'support__subject', text: t.subject }),
          el('span', { className: 'rows__sub', text: `${t.id} · ${t.topic} · updated ${fmt.relative(t.updated, NOW)}` }),
        ]),
        el('span', { className: 'rows__meta' }, [ticketBadge(t), iconEl('chevron-right')]),
      ]),
    ])));
  }

  function threadBody(t) {
    return [
      el('div', { className: 'support__ticket-meta' }, [ticketBadge(t), el('span', { className: 'chip', text: t.topic }), el('span', { className: 'chip', text: `${t.priority} priority` }), t.requestId ? Portal.copyable(t.requestId, { label: 'Copy request ID' }) : null]),
      t.status === 'closed' ? el('div', { className: 'note' }, [iconEl('info'), el('span', { text: 'This request is closed. Replying reopens it.' })]) : null,
      el('ol', { className: 'support__thread' }, t.thread.map((m) => el('li', { className: `support__message${m.staff ? ' support__message--staff' : ''}` }, [
        el('div', { className: 'support__message-head' }, [el('span', { className: 't-label', text: m.staff ? 'Portal support' : m.from }), el('time', { className: 't-meta', text: fmt.dateTime(m.time), attrs: { datetime: m.time } })]),
        el('p', { className: 'support__message-text', text: m.text }),
      ]))),
    ];
  }

  function openTicket(t) {
    const reply = el('textarea', { className: 'input textarea', attrs: { id: 'tk-reply', rows: '4', maxlength: String(MAX_MESSAGE), placeholder: 'Write a reply' } });
    const drawer = Portal.drawer.open({ title: t.subject, subtitle: `${t.id} · opened ${fmt.dateTime(t.thread[0].time)}` });
    const replyField = el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Reply', attrs: { for: 'tk-reply' } }), reply]);
    const render = () => drawer.setBody([...threadBody(t), replyField]);
    render();
    drawer.setFooter([
      btn('Close', { attrs: { 'data-dialog-close': '' } }),
      btn('Send reply', { variant: 'primary', iconName: 'send', onClick: async (event) => {
        const text = reply.value.trim();
        if (!Portal.fieldError(reply, text.length >= 2 ? '' : 'Write a reply first.')) { reply.focus(); return; }
        const button = event.currentTarget;
        button.setAttribute('aria-busy', 'true');
        await Portal.request(null, { delay: 500 });
        button.removeAttribute('aria-busy');
        const time = new Date(NOW).toISOString();
        t.thread.push({ from: ME, staff: false, time, text });
        t.status = 'open';
        t.updated = time;
        reply.value = '';
        render();
        renderTickets();
        Portal.toast(`Reply sent on ${t.id}`);
      } }),
    ]);
  }

  Portal.lazy.register('tickets', { fetch: () => Portal.request(tickets), render: renderTickets });

  /* System status + contacts ---------------------------------------------------------------- */
  function renderStatus(rows) {
    const issues = rows.filter((s) => s.state !== 'operational').length;
    $('[data-status-summary]').textContent = issues ? `${issues} service degraded` : 'All systems operational';
    $('[data-status]').replaceChildren(...rows.map((s) => el('li', { className: 'rows__item' }, [
      el('span', { className: 'rows__main' }, [el('span', { text: s.name }), el('span', { className: 'rows__sub', text: s.note })]),
      Portal.badge(...SERVICE_STATUS[s.state]),
    ])));
  }

  Portal.lazy.register('status', { fetch: () => Portal.request(status), render: renderStatus });

  $('[data-contacts]').replaceChildren(...CONTACTS.map(([email, desc]) => el('li', { className: 'rows__item' }, [
    el('span', { className: 'rows__main' }, [Portal.copyable(email, { mono: false, label: 'Copy email' }), el('span', { className: 'rows__sub', text: desc })]),
    el('a', { className: 'btn btn--sm', attrs: { href: `mailto:${email}` } }, [iconEl('mail'), 'Email']),
  ])));

})();
