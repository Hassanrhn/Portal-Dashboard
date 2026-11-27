/*
 * Contact support: one column with your requests (conversation drawer with reply box), live system
 * status and other ways to reach us. "New request" opens a validated form in a drawer (a bottom sheet
 * on phones); ?request=req_… opens it prefilled with that request ID.
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
  const TOPICS = ['Payments', 'Payouts', 'Refunds', 'Cards', 'Webhooks', 'API and keys', 'Account'];
  const PRIORITIES = ['Low', 'Normal', 'Urgent'];
  const TICKET_STATUS = { open: ['open', 'Open'], waiting: ['awaiting', 'Waiting on you'], closed: ['closed', 'Closed'] };
  const SERVICE_STATUS = { operational: ['active', 'Operational'], degraded: ['review', 'Degraded'], outage: ['failed', 'Outage'] };

  /* New request drawer ---------------------------------------------------------------------- */
  function field(id, labelText, control, extra = []) {
    return el('div', { className: 'field' }, [el('label', { className: 'field__label', text: labelText, attrs: { for: id } }), control, ...extra]);
  }

  function prioritySegmented(selected) {
    return el('div', { className: 'segmented segmented--block', attrs: { role: 'radiogroup', 'aria-labelledby': 'tk-priority-label', 'data-segmented': '' } }, PRIORITIES.map((p) => el('button', {
      className: 'segmented__option', text: p, attrs: { type: 'button', role: 'radio', 'aria-checked': String(p === selected) }, dataset: { value: p },
    })));
  }

  function openNewRequest({ requestId = '', priority = 'Normal' } = {}) {
    const topic = el('select', { className: 'select select--block', attrs: { id: 'tk-topic' } }, [
      el('option', { text: 'Choose a topic', attrs: { value: '' } }),
      ...TOPICS.map((t) => el('option', { text: t, attrs: { value: t, selected: Boolean(requestId) && t === 'Payments' } })),
    ]);
    const request = el('input', { className: 'input input--mono', attrs: { id: 'tk-request', maxlength: '40', autocomplete: 'off', spellcheck: 'false', placeholder: 'req_8f3a91c2e7', value: requestId } });
    const subject = el('input', { className: 'input', attrs: { id: 'tk-subject', maxlength: '120', autocomplete: 'off', placeholder: 'Card payments declined since 10:00 UTC' } });
    const message = el('textarea', { className: 'input textarea', attrs: { id: 'tk-message', rows: '7', maxlength: String(MAX_MESSAGE), 'aria-describedby': 'tk-message-help', placeholder: 'Since 10:00 UTC every FIAT_CARD payment on Crossmint fails with 3-D Secure error, e.g. req_5d4410ee09. We expected them to succeed as before.' } });
    const counter = el('span', { className: 'field__counter', attrs: { 'aria-live': 'polite' } });
    const urgentNote = el('div', { className: 'banner', attrs: { hidden: priority !== 'Urgent' } }, [iconEl('alert'), el('span', { text: 'Urgent is for live payment outages, such as all payments failing. We page the on-call engineer.' })]);
    const priorityControl = prioritySegmented(priority);
    let chosenPriority = priority;

    const syncCounter = () => {
      counter.textContent = `${fmt.count(message.value.length)} / ${fmt.count(MAX_MESSAGE)}`;
      counter.classList.toggle('is-over', message.value.length >= MAX_MESSAGE);
    };
    message.addEventListener('input', syncCounter);
    priorityControl.addEventListener('segmented:change', (event) => { chosenPriority = event.detail.value; urgentNote.hidden = chosenPriority !== 'Urgent'; });
    [topic, request, subject, message].forEach((input) => input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') Portal.fieldError(input, ''); }));
    syncCounter();

    const form = el('form', { className: 'form-grid', attrs: { id: 'tk-form', novalidate: true } }, [
      el('div', { className: 'form-grid form-grid--2' }, [
        field('tk-topic', 'Topic', topic),
        field('tk-request', 'Related request ID (optional)', request),
      ]),
      el('div', { className: 'field' }, [el('span', { className: 'field__label', text: 'Priority', attrs: { id: 'tk-priority-label' } }), priorityControl, urgentNote]),
      field('tk-subject', 'Subject', subject),
      el('div', { className: 'field' }, [
        el('div', { className: 'field__row' }, [el('label', { className: 'field__label', text: 'Message', attrs: { for: 'tk-message' } }), counter]),
        message,
        el('p', { className: 'field__help', text: 'Paste request IDs, offering IDs or error codes instead of screenshots. Never include card numbers, API secrets or other personal data.', attrs: { id: 'tk-message-help' } }),
      ]),
    ]);

    const drawer = Portal.drawer.open({ title: 'New request', subtitle: 'We reply by email and on this page.', body: [form] });
    Portal.initComponents(drawer.el);
    drawer.setFooter([
      btn('Cancel', { attrs: { 'data-dialog-close': '' } }),
      btn('Send request', { variant: 'primary', iconName: 'send', attrs: { type: 'submit', form: 'tk-form' } }),
    ]);
    if (requestId) Portal.fieldError(request, REQUEST_ID.test(requestId) ? '' : 'This does not look like a request ID. They start with req_.');
    form.addEventListener('submit', (event) => { event.preventDefault(); submitTicket(drawer, { topic, request, subject, message, priority: () => chosenPriority }); });
    window.setTimeout(() => (requestId ? subject : topic).focus(), 50);
  }

  function validateForm({ topic, request, subject, message }) {
    const requestId = request.value.trim();
    const checks = [
      [topic, topic.value ? '' : 'Choose a topic.'],
      [request, !requestId || REQUEST_ID.test(requestId) ? '' : 'Request IDs start with req_, for example req_8f3a91c2e7.'],
      [subject, subject.value.trim().length >= 5 ? '' : 'Add a short subject (at least 5 characters).'],
      [message, message.value.trim().length >= 20 ? '' : 'Describe the problem in at least 20 characters.'],
    ];
    const failed = checks.filter(([input, error]) => !Portal.fieldError(input, error));
    failed[0]?.[0].focus();
    return !failed.length;
  }

  function nextTicketId() {
    const top = Math.max(...tickets.map((t) => Number(t.id.slice(4))), 2041);
    return `TKT-${top + 1}`;
  }

  async function submitTicket(drawer, fields) {
    if (!validateForm(fields)) return;
    const submit = drawer.el.querySelector('.drawer__foot .btn--primary');
    submit.setAttribute('aria-busy', 'true');
    await Portal.request(null, { delay: 700 });
    const time = new Date(NOW).toISOString();
    const ticket = {
      id: nextTicketId(), subject: fields.subject.value.trim(), topic: fields.topic.value, priority: fields.priority(), status: 'open',
      requestId: fields.request.value.trim(), updated: time,
      thread: [{ from: ME, staff: false, time, text: fields.message.value.trim() }],
    };
    tickets.unshift(ticket);
    renderTickets();
    drawer.close();
    Portal.toast(`Request ${ticket.id} sent. We will reply by email and here.`);
  }

  $('[data-new-request]').addEventListener('click', () => openNewRequest());

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
      el('div', { className: 'support__ticket-meta' }, [
        ticketBadge(t), el('span', { className: 'chip', text: t.topic }), el('span', { className: 'chip', text: `${t.priority} priority` }),
        Portal.copyable(t.id, { label: 'Copy ticket ID' }),
        t.requestId ? Portal.copyable(t.requestId, { label: 'Copy request ID' }) : null,
      ]),
      t.status === 'closed' ? el('div', { className: 'note' }, [iconEl('info'), el('span', { text: 'This request is closed. Replying reopens it.' })]) : null,
      el('ol', { className: 'support__thread' }, t.thread.map((m) => el('li', { className: `support__message${m.staff ? ' support__message--staff' : ''}` }, [
        el('div', { className: 'support__message-head' }, [el('span', { className: 't-label', text: m.staff ? 'Portal support' : m.from }), el('time', { className: 't-meta', text: fmt.dateTime(m.time), attrs: { datetime: m.time } })]),
        el('p', { className: 'support__message-text', text: m.text }),
      ]))),
    ];
  }

  function openTicket(t) {
    const reply = el('textarea', { className: 'input textarea', attrs: { id: 'tk-reply', rows: '4', maxlength: String(MAX_MESSAGE), placeholder: 'Yes, the customer completed the bank app step at 18:42 UTC.' } });
    const drawer = Portal.drawer.open({ title: t.subject, subtitle: `${t.id} · opened ${fmt.dateTime(t.thread[0].time)}` });
    const replyField = field('tk-reply', 'Reply', reply);
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

  /* System status ---------------------------------------------------------------------------- */
  function renderStatus(rows) {
    const issues = rows.filter((s) => s.state !== 'operational').length;
    $('[data-status-summary]').textContent = issues ? `${issues} service degraded` : 'All systems operational';
    $('[data-status]').replaceChildren(...rows.map((s) => el('li', { className: 'rows__item' }, [
      el('span', { className: 'rows__main' }, [el('span', { text: s.name }), el('span', { className: 'rows__sub', text: s.note })]),
      Portal.badge(...SERVICE_STATUS[s.state]),
    ])));
  }

  Portal.lazy.register('status', { fetch: () => Portal.request(status), render: renderStatus });

  /* Other ways to reach us ------------------------------------------------------------------- */
  const emailButton = (email) => el('a', { className: 'btn btn--sm', attrs: { href: `mailto:${email}` } }, [iconEl('mail'), 'Email']);
  const office = () => {
    const flag = Portal.flag('AE');
    flag.setAttribute('aria-hidden', 'true');
    return el('span', { className: 'rows__sub support__office' }, [flag, 'Dubai, United Arab Emirates · Sun to Thu, 09:00 to 18:00 GST']);
  };
  const CONTACTS = [
    { icon: 'mail', title: 'General support', email: 'support@the-block.com', desc: 'Payments, payouts and integration questions. Reply within one business day.' },
    { icon: 'support', title: 'Live outage', desc: 'Open an Urgent request and we page the on-call engineer within the hour.', action: () => btn('Urgent request', { size: 'sm', iconName: 'alert', onClick: () => openNewRequest({ priority: 'Urgent' }) }) },
    { icon: 'globe', title: 'Security', email: 'security@the-block.com', desc: 'Report a vulnerability or a leaked API key. Watched around the clock.' },
    { icon: 'building', title: 'Account manager', email: 'accounts@the-block.com', extra: office, desc: 'Pricing, contracts and go-live reviews.' },
  ];

  $('[data-contacts]').replaceChildren(...CONTACTS.map((c) => el('li', { className: 'rows__item' }, [
    el('span', { className: 'table__lead' }, [
      el('span', { className: 'tile', attrs: { 'aria-hidden': 'true' } }, [iconEl(c.icon)]),
      el('span', { className: 'rows__main' }, [
        el('span', { className: 'support__contact-title' }, [el('span', { className: 't-label', text: c.title }), c.email ? Portal.copyable(c.email, { mono: false, label: 'Copy email' }) : null]),
        el('span', { className: 'rows__sub', text: c.desc }),
        c.extra ? c.extra() : null,
      ]),
    ]),
    c.action ? c.action() : emailButton(c.email),
  ])));

  /* Deep link: ?request=req_… opens a prefilled new request --------------------------------- */
  const prefill = new URLSearchParams(window.location.search).get('request');
  if (prefill) window.setTimeout(() => openNewRequest({ requestId: prefill.slice(0, 40) }), 300);
})();
