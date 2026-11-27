/*
 * Docs: integration guide with a sticky, scrollspy table of contents (a select on mobile),
 * a go-live checklist with progress, code samples in tabs, and a simulated API explorer that
 * only runs in Test mode. The explorer never makes network calls and never asks for an API key.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const payments = Portal.data.payments;
  const $ = (s, scope = document) => scope.querySelector(s);
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BASE_URL = 'https://pay-api.the-block.com';

  /* Table of contents + scrollspy ----------------------------------------------------- */
  const tocLinks = Array.from(document.querySelectorAll('[data-toc] a'));
  const tocSelect = $('[data-toc-select]');
  const sections = tocLinks.map((link) => document.getElementById(link.hash.slice(1)));

  tocLinks.forEach((link) => tocSelect.appendChild(el('option', { text: link.textContent, attrs: { value: link.hash.slice(1) } })));

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
    setActive(id);
  }

  function setActive(id) {
    tocLinks.forEach((link) => {
      const on = link.hash === `#${id}`;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    tocSelect.value = id;
  }

  document.querySelectorAll('[data-toc] a, [data-toc-jump]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    scrollToSection(link.hash.slice(1));
  }));
  tocSelect.addEventListener('change', () => scrollToSection(tocSelect.value));

  const visible = new Set();
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) visible.add(entry.target.id); else visible.delete(entry.target.id); });
    syncSpy();
  }, { rootMargin: '-15% 0px -70% 0px' });

  // The last sections are short and never reach the spy band, so the page bottom selects the last one.
  function syncSpy() {
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const first = atBottom ? sections[sections.length - 1] : sections.find((s) => visible.has(s.id));
    if (first) setActive(first.id);
  }
  window.addEventListener('scroll', () => { if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) syncSpy(); }, { passive: true });
  sections.forEach((s) => spy.observe(s));
  setActive(window.location.hash.slice(1) && document.getElementById(window.location.hash.slice(1)) ? window.location.hash.slice(1) : sections[0].id);

  /* Go-live checklist ----------------------------------------------------------------- */
  const STEPS = [
    { id: 'key', title: 'Create a Test API key', desc: 'Generate a Test key and store the secret on your server.', link: { label: 'Open API keys', href: 'api-keys.html' }, done: true },
    { id: 'payment', title: 'Make a test payment', desc: 'Create a payment in Test mode and follow it to PAID.', link: { label: 'Create payment', createPayment: true }, done: true },
    { id: 'webhook', title: 'Add a webhook endpoint and send a test event', desc: 'Your endpoint should answer 2xx and verify the signature.', link: { label: 'Open webhooks', href: 'webhooks.html' }, done: false },
    { id: 'golive', title: 'Request go-live', desc: 'Your account manager reviews your integration and turns on Live payments, usually within one business day.', done: false, requested: false },
  ];
  const checklist = $('[data-checklist]');

  function stepLink(step) {
    if (!step.link) return null;
    if (step.link.createPayment) return el('button', { className: 'btn btn--sm', attrs: { type: 'button', 'data-create-payment': '' } }, [iconEl('plus'), step.link.label]);
    return el('a', { className: 'btn btn--sm', attrs: { href: step.link.href } }, [step.link.label, iconEl('arrow-right')]);
  }

  function stepAction(step) {
    if (step.id === 'golive') {
      if (step.requested) return Portal.badge('review', 'In review');
      const ready = STEPS.slice(0, 3).every((s) => s.done);
      return btn('Request go-live', { variant: 'primary', size: 'sm', onClick: requestGoLive, attrs: { disabled: !ready, title: ready ? false : 'Finish steps 1 to 3 first' } });
    }
    if (step.done) return btn('Mark as not done', { variant: 'ghost', size: 'sm', onClick: () => toggleStep(step) });
    return btn('Mark done', { size: 'sm', iconName: 'check', onClick: () => toggleStep(step) });
  }

  function renderChecklist() {
    const done = STEPS.filter((s) => s.done || s.requested).length;
    $('[data-progress-label]').textContent = `${done} of ${STEPS.length} steps done`;
    $('[data-progress-meta]').textContent = STEPS[3].requested ? 'Go-live review requested' : 'Test mode';
    $('[data-progress-bar]').setAttribute('aria-valuenow', String(done));
    $('[data-progress-fill]').style.setProperty('--value', `${(done / STEPS.length) * 100}%`);
    checklist.replaceChildren(...STEPS.map((step, i) => {
      const complete = step.done || step.requested;
      return el('li', { className: `checklist__item${complete ? ' is-done' : ''}` }, [
        el('span', { className: 'checklist__mark', attrs: { 'aria-hidden': 'true' } }, [complete ? iconEl('check') : String(i + 1)]),
        el('div', { className: 'checklist__main' }, [
          el('p', { className: 'checklist__title' }, [step.title, ' ', Portal.badge(complete ? 'completed' : 'draft', step.requested ? 'Requested' : complete ? 'Done' : 'To do')]),
          el('p', { className: 't-meta', text: step.desc }),
        ]),
        el('div', { className: 'checklist__actions' }, [stepLink(step), stepAction(step)]),
      ]);
    }));
  }

  function toggleStep(step) {
    step.done = !step.done;
    renderChecklist();
    Portal.toast(step.done ? `Marked "${step.title}" as done` : `Marked "${step.title}" as not done`, { icon: step.done ? 'check-circle' : 'refund' });
  }

  async function requestGoLive() {
    const ok = await Portal.confirm({
      title: 'Request go-live review?', confirmLabel: 'Request review',
      message: 'Your account manager checks your test payments and webhook, then turns on Live payments. You will get an email when it is done.',
      details: [['Partner', 'The Orange Card'], ['Requested by', 'pocket@pocket.com']],
    });
    if (!ok) return;
    STEPS[3].requested = true;
    renderChecklist();
    Portal.toast('Go-live review requested');
  }

  Portal.lazy.register('checklist', { fetch: () => Portal.request(STEPS), render: renderChecklist });

  /* Offerings table ------------------------------------------------------------------- */
  const OFFERINGS = [
    { id: 'CROSSMINT.PAYMENT_API.START_PAYMENT.PAYIN', provider: 'Crossmint', action: 'PAYIN', currencies: ['USD', 'AED'] },
    { id: 'FORUMPAY.PAYMENT_API.START_PAYMENT.PAYIN', provider: 'ForumPay', action: 'PAYIN', currencies: ['USDT', 'USDC'] },
    { id: 'FORUMPAY.PAYMENT_API.START_PAYMENT.CANCEL', provider: 'ForumPay', action: 'CANCEL', currencies: ['USDT', 'USDC'] },
    { id: 'FORUMPAY.PAYOUT_API.WITHDRAW.PAYOUT', provider: 'ForumPay', action: 'PAYOUT', currencies: ['USDT', 'USDC'] },
    { id: 'BLOCKCHAIN_RAIL.PAYMENT_API.TRANSFER.PAYIN', provider: 'Blockchain rail', action: 'PAYIN', currencies: ['USDC', 'USDT'] },
    { id: 'CROSSMINT.PAYMENT_API.START_PAYMENT.REFUND', provider: 'Crossmint', action: 'REFUND', currencies: ['USD', 'AED'] },
  ];
  const offeringsTable = Portal.dataTable($('[data-offerings]'), {
    pageSize: 10,
    rowLabel: (o) => o.id,
    columns: [
      { label: 'Offering ID', filter: { type: 'text', value: (o) => o.id, placeholder: 'e.g. CROSSMINT' }, render: (o) => Portal.copyable(o.id, { label: 'Copy offering ID' }) },
      { label: 'Provider', filter: { type: 'options', value: (o) => o.provider }, render: (o) => o.provider },
      { label: 'Action', filter: { type: 'options', value: (o) => o.action }, render: (o) => el('span', { className: 'chip chip--mono', text: o.action }) },
      { label: 'Currencies', render: (o) => el('span', { className: 'chips' }, o.currencies.map((c) => el('span', { className: 'chip', text: c }))) },
    ],
  });
  Portal.lazy.register('offerings', { fetch: () => Portal.request(OFFERINGS), render: (rows) => offeringsTable.setRows(rows) });

  /* Code samples ---------------------------------------------------------------------- */
  const SAMPLE_BODY = { offeringId: 'CROSSMINT.PAYMENT_API.START_PAYMENT.PAYIN', requestId: 'ORD-10493', referenceId: 'INV-2026-1193', amount: '25.00', currency: 'USD', customer: { email: 'ava@example.com' } };
  const SAMPLES = {
    curl: ['cURL', `curl -X POST ${BASE_URL}/payments \\
  -H "X-Api-Key: $PORTAL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(SAMPLE_BODY)}'`],
    js: ['JavaScript (Node 18+)', `const response = await fetch('${BASE_URL}/payments', {
  method: 'POST',
  headers: { 'X-Api-Key': process.env.PORTAL_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(${JSON.stringify(SAMPLE_BODY, null, 2).replace(/\n/g, '\n  ')}),
});
const payment = await response.json();
console.log(payment.status); // "PENDING"`],
    py: ['Python (requests)', `import os, requests

payment = requests.post(
    "${BASE_URL}/payments",
    headers={"X-Api-Key": os.environ["PORTAL_API_KEY"]},
    json=${JSON.stringify(SAMPLE_BODY).replace(/":/g, '": ')},
    timeout=10,
).json()
print(payment["status"])  # "PENDING"`],
    verify: ['Verify a webhook signature (Node)', `import crypto from 'node:crypto';

export function isValidSignature(rawBody, timestamp, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(\`\${timestamp}.\${rawBody}\`).digest('hex');
  const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  const fresh = Math.abs(Date.now() / 1000 - Number(timestamp)) < 300; // reject replays older than 5 minutes
  return ok && fresh;
}`],
  };
  document.querySelectorAll('[data-sample]').forEach((host) => {
    const [label, code] = SAMPLES[host.dataset.sample];
    host.appendChild(Portal.codePanel(label, code));
  });

  /* API explorer (simulated, Test mode only) ------------------------------------------ */
  const form = $('[data-explorer]');
  const endpoint = $('[data-explorer-endpoint]');
  const bodyInput = $('#ex-body');
  const requestInput = $('#ex-request');
  const sendBtn = $('[data-explorer-send]');
  const responseHost = $('[data-explorer-response]');
  const REQUEST_ID = /^[A-Za-z0-9_-]{3,40}$/;
  const ENDPOINTS = {
    create: { method: 'POST', path: '/payments', body: SAMPLE_BODY },
    get: { method: 'GET', path: '/payments/{requestId}', body: null },
    cancel: { method: 'POST', path: '/payments/cancel', body: { requestId: 'req_77b0d415aa', reason: 'Customer abandoned checkout' } },
    offerings: { method: 'GET', path: '/offerings', body: null },
  };
  const isTest = () => document.documentElement.dataset.env === 'test';

  function syncEndpoint() {
    const spec = ENDPOINTS[endpoint.value];
    $('[data-explorer-body-field]').hidden = !spec.body;
    $('[data-explorer-path]').hidden = endpoint.value !== 'get';
    bodyInput.value = spec.body ? JSON.stringify(spec.body, null, 2) : '';
    Portal.fieldError(bodyInput, '');
    Portal.fieldError(requestInput, '');
    responseHost.replaceChildren();
  }

  function syncEnv() {
    $('[data-explorer-live]').hidden = isTest();
    sendBtn.disabled = !isTest();
  }

  const error = (status, code, message) => ({ status, body: { code, message } });

  function simulate(key, body) {
    const findPayment = (id) => payments.find((p) => p.id === id || p.ref === id);
    if (key === 'offerings') return { status: 200, body: { offerings: OFFERINGS.map((o) => ({ offeringId: o.id, provider: o.provider, action: o.action, currencies: o.currencies })) } };
    if (key === 'get') {
      const p = findPayment(requestInput.value.trim());
      if (!p) return error(404, 'PAYMENT_NOT_FOUND', `No payment with requestId ${requestInput.value.trim()}.`);
      return { status: 200, body: { requestId: p.id, referenceId: p.ref, offeringId: p.offering, status: p.status.toUpperCase(), amount: p.amount, currency: p.currency, createdAt: p.created } };
    }
    if (key === 'cancel') {
      if (!body.requestId) return error(400, 'VALIDATION_ERROR', 'requestId is required.');
      const p = findPayment(body.requestId);
      if (!p) return error(404, 'PAYMENT_NOT_FOUND', `No payment with requestId ${body.requestId}.`);
      if (p.status !== 'pending') return error(409, 'PAYMENT_NOT_CANCELLABLE', `Payment is ${p.status.toUpperCase()}; only PENDING payments can be cancelled.`);
      return { status: 200, body: { requestId: p.id, status: 'CANCELLED', cancelledAt: new Date().toISOString() } };
    }
    const missing = ['offeringId', 'requestId', 'amount', 'currency'].filter((f) => !body[f]);
    if (missing.length) return error(400, 'VALIDATION_ERROR', `Missing required fields: ${missing.join(', ')}.`);
    if (typeof body.amount !== 'string' || !/^\d+(\.\d{1,2})?$/.test(body.amount)) return error(400, 'VALIDATION_ERROR', 'amount must be a decimal string such as "25.00".');
    const offering = OFFERINGS.find((o) => o.id === body.offeringId && o.action === 'PAYIN');
    if (!offering) return error(422, 'OFFERING_UNAVAILABLE', `${body.offeringId} is not a pay-in offering on this account.`);
    if (!offering.currencies.includes(body.currency)) return error(400, 'VALIDATION_ERROR', `${offering.provider} accepts ${offering.currencies.join(', ')}.`);
    if (findPayment(body.requestId)) return error(409, 'DUPLICATE_REQUEST_ID', `requestId ${body.requestId} was already used.`);
    return {
      status: 201,
      body: {
        requestId: body.requestId, referenceId: body.referenceId || null, offeringId: body.offeringId, status: 'PENDING', amount: body.amount, currency: body.currency,
        nextAction: offering.provider === 'Crossmint' ? { type: 'REDIRECT', url: 'https://checkout.test.pay-api.the-block.com/c/7f3e2a' } : { type: 'DEPOSIT_ADDRESS', network: 'TRON', address: 'TQ4p8v3sYc1Lw9xJm2RkA7bN5dHf6GzE1u' },
        createdAt: new Date().toISOString(),
      },
    };
  }

  function parseBody(spec) {
    if (!spec.body) return {};
    try {
      const value = JSON.parse(bodyInput.value);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Body must be a JSON object.');
      Portal.fieldError(bodyInput, '');
      return value;
    } catch (err) {
      Portal.fieldError(bodyInput, `Invalid JSON: ${err.message}`);
      bodyInput.focus();
      return null;
    }
  }

  async function send(event) {
    event.preventDefault();
    if (!isTest()) return;
    const key = endpoint.value;
    const spec = ENDPOINTS[key];
    if (key === 'get' && !Portal.fieldError(requestInput, REQUEST_ID.test(requestInput.value.trim()) ? '' : 'Enter a requestId of 3 to 40 letters, digits, - or _.')) { requestInput.focus(); return; }
    const body = parseBody(spec);
    if (!body) return;
    sendBtn.setAttribute('aria-busy', 'true');
    const started = performance.now();
    const result = await Portal.request(simulate(key, body), { delay: 180 + Math.random() * 320 });
    const ms = Math.round(performance.now() - started);
    sendBtn.removeAttribute('aria-busy');
    const path = key === 'get' ? `/payments/${requestInput.value.trim()}` : spec.path;
    responseHost.replaceChildren(
      el('div', { className: 'field__row docs__response-meta' }, [
        el('span', { className: 'u-mono', text: `${spec.method} ${path}` }),
        el('span', { className: 'rows__meta' }, [Portal.badge(result.status < 300 ? 'succeeded' : 'failed', `HTTP ${result.status}`), el('span', { className: 't-meta', text: `${fmt.count(ms)} ms · Test` })]),
      ]),
      Portal.codePanel('Response', result.body),
    );
  }

  endpoint.addEventListener('change', syncEndpoint);
  $('[data-explorer-reset]').addEventListener('click', syncEndpoint);
  form.addEventListener('submit', send);
  new MutationObserver(syncEnv).observe(document.documentElement, { attributes: true, attributeFilter: ['data-env'] });
  syncEndpoint();
  syncEnv();

})();
