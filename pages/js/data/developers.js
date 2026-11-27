/*
 * Sample data for the Developers section: API keys, webhook endpoints and their deliveries,
 * API request logs and platform events. Deterministic so every reviewer sees the same data.
 * Replace with GET /api-keys, GET /webhooks, GET /webhooks/{id}/deliveries, GET /logs and GET /events.
 * Secrets are never part of this data except the webhook signing secrets, which the API
 * returns on an explicit reveal call; API key secrets exist only at creation time.
 */
(function () {
  'use strict';

  const NOW = Date.UTC(2026, 10, 27, 12);
  const ago = (mins) => new Date(NOW - mins * 60000).toISOString();

  function seeded(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
  const rand = seeded(9157);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  const b62 = (n) => Array.from({ length: n }, () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'[Math.floor(rand() * 62)]).join('');

  /* Offerings a key can be restricted to (PROVIDER.PRODUCT.VARIANT.ACTION) ------------------ */
  const offerings = [
    'CROSSMINT.PAYMENT_API.START_PAYMENT.PAYIN',
    'CROSSMINT.PAYMENT_API.START_PAYMENT.REFUND',
    'CROSSMINT.PAYMENT_API.START_PAYMENT.QUERY',
    'FORUMPAY.PAYMENT_API.START_PAYMENT.PAYIN',
    'FORUMPAY.PAYMENT_API.START_PAYMENT.CANCEL',
    'FORUMPAY.PAYMENT_API.WITHDRAWAL.PAYOUT',
    'BLOCKCHAIN_RAIL.PAYMENT_API.TRANSFER.PAYIN',
    'BLOCKCHAIN_RAIL.PAYMENT_API.TRANSFER.QUERY',
  ];

  /* API keys ---------------------------------------------------------------------------- */
  const apiKeys = [
    { id: 'pk_live_8c21d0b94f2a', name: 'Production checkout', env: 'live', scopes: ['payments'], offerings: [], ips: ['34.120.18.0/24'], created: '2026-06-02T09:14:00Z', lastUsed: ago(2), status: 'active' },
    { id: 'pk_live_3c51b2c4ba78', name: 'Card program backend', env: 'live', scopes: ['payments', 'cards'], offerings: [], ips: [], created: '2026-08-19T13:40:00Z', lastUsed: ago(14), status: 'active' },
    { id: 'pk_live_b180d98bee5b', name: 'Widget', env: 'live', scopes: ['payments'], offerings: ['BLOCKCHAIN_RAIL.PAYMENT_API.TRANSFER.PAYIN', 'CROSSMINT.PAYMENT_API.START_PAYMENT.PAYIN', 'FORUMPAY.PAYMENT_API.START_PAYMENT.PAYIN'], ips: [], created: '2026-09-03T08:02:00Z', lastUsed: ago(95), status: 'active' },
    { id: 'pk_live_44ba2a1efa11', name: 'Finance reporting job', env: 'live', scopes: ['reports'], offerings: [], ips: ['52.14.201.7'], created: '2026-07-11T16:25:00Z', lastUsed: ago(60 * 21), status: 'active' },
    { id: 'pk_live_9eabd3b4b082', name: 'Cloudflare worker', env: 'live', scopes: ['payments'], offerings: ['FORUMPAY.PAYMENT_API.WITHDRAWAL.PAYOUT'], ips: [], created: '2026-04-28T10:10:00Z', lastUsed: ago(60 * 24 * 38), status: 'revoked' },
    { id: 'pk_test_51f0c7e2d913', name: 'Local development', env: 'test', scopes: ['payments', 'cards'], offerings: [], ips: [], created: '2026-11-02T11:30:00Z', lastUsed: ago(40), status: 'active' },
    { id: 'pk_test_a7d93e0c6b44', name: 'CI integration tests', env: 'test', scopes: ['payments', 'cards', 'reports'], offerings: [], ips: ['35.231.0.0/16'], created: '2026-10-15T07:45:00Z', lastUsed: ago(60 * 5), status: 'active' },
    { id: 'pk_test_0b6e2f9a1c57', name: 'Staging', env: 'test', scopes: ['payments'], offerings: ['CROSSMINT.PAYMENT_API.START_PAYMENT.PAYIN', 'CROSSMINT.PAYMENT_API.START_PAYMENT.QUERY'], ips: [], created: '2026-09-21T14:05:00Z', lastUsed: ago(60 * 24 * 3), status: 'active' },
  ];

  /* Webhook endpoints and deliveries --------------------------------------------------- */
  const WEBHOOK_EVENTS = {
    Payments: ['payment.created', 'payment.status_updated', 'refund.status_updated', 'payout.status_updated'],
    Cards: ['card_order.status_updated', 'cardholder.status_updated'],
  };
  // Payment IDs that exist in data/payments.js, so links to transactions.html?payment= resolve.
  const PAYMENT_IDS = ['req_8f3a91c2e7', 'req_77b0d415aa', 'req_c19e2f0b63', 'req_5d4410ee09', 'req_2ab9c3d871', 'req_e04b7a19c5', 'req_91fd02c6b8'];
  const OBJECT_PREFIX = { payment: 'req_', refund: 'rf_', payout: 'po_', card_order: 'co_', cardholder: 'ch_' };

  function eventPayload(type, objectId, created) {
    const kind = type.split('.')[0];
    const data = {
      payment: { requestId: objectId, status: type === 'payment.created' ? 'PENDING' : 'PAID', amount: '25.00', currency: 'USD', offeringId: 'CROSSMINT.PAYMENT_API.START_PAYMENT.PAYIN' },
      refund: { refundId: objectId, requestId: 'req_e04b7a19c5', status: 'SUCCEEDED', amount: '32.75', currency: 'USD' },
      payout: { payoutId: objectId, status: 'PAID', amount: '150.00', currency: 'USDT', offeringId: 'FORUMPAY.PAYMENT_API.WITHDRAWAL.PAYOUT' },
      card_order: { cardOrderId: objectId, issuer: 'Axys', status: 'SHIPPED' },
      cardholder: { cardholderId: objectId, issuer: 'Interlace', status: 'VERIFIED' },
    }[kind];
    return { type, createdAt: created, data };
  }

  function buildDelivery(endpoint, index, { failing }) {
    const types = endpoint.events;
    const type = types[index % types.length];
    const kind = type.split('.')[0];
    const objectId = kind === 'payment' ? pick(PAYMENT_IDS) : `${OBJECT_PREFIX[kind]}${hex(10)}`;
    const time = ago(8 + index * (37 + Math.floor(rand() * 40)));
    const roll = rand();
    let status = 'delivered';
    if (failing && index < 4) status = index === 0 ? 'retrying' : 'dead';
    else if (roll < 0.06) status = 'dead';
    else if (roll < 0.1) status = 'retrying';
    const code = status === 'delivered' ? 200 : pick([500, 502, 503, 504]);
    return {
      id: `dl_${hex(12)}`,
      event: type,
      eventId: `evt_${hex(12)}`,
      objectId,
      status,
      attempts: status === 'delivered' ? (rand() < 0.15 ? 2 : 1) : status === 'dead' ? 5 : 2 + Math.floor(rand() * 2),
      code,
      time,
      duration: status === 'delivered' ? 80 + Math.floor(rand() * 260) : 10000,
      payload: eventPayload(type, objectId, time),
    };
  }

  const endpointSeeds = [
    { url: 'https://api.theorangecard.com/webhooks/portal', description: 'Production order service', events: [...WEBHOOK_EVENTS.Payments], status: 'active', created: '2026-05-14T10:00:00Z' },
    { url: 'https://cards.theorangecard.com/hooks/issuing', description: 'Card program lifecycle', events: [...WEBHOOK_EVENTS.Cards], status: 'failing', created: '2026-08-20T09:30:00Z' },
    { url: 'https://widget.theorangecard.com/hooks/upstream', description: 'Checkout widget status sync', events: ['payment.status_updated', 'refund.status_updated'], status: 'disabled', created: '2026-09-04T15:12:00Z' },
  ];

  const webhookEndpoints = endpointSeeds.map((seed, i) => {
    const endpoint = { id: `we_${hex(14)}`, ...seed, secret: `whsec_${b62(32)}`, deliveries: [] };
    const count = seed.status === 'disabled' ? 6 : 16 - i * 2;
    endpoint.deliveries = Array.from({ length: count }, (_, n) => buildDelivery(endpoint, n, { failing: seed.status === 'failing' }));
    if (seed.status === 'disabled') endpoint.deliveries.forEach((d) => { d.time = new Date(new Date(d.time).getTime() - 3 * 86400000).toISOString(); });
    return endpoint;
  });

  /* Events --------------------------------------------------------------------------------- */
  const events = [];
  webhookEndpoints.forEach((endpoint) => endpoint.deliveries.forEach((d) => {
    let event = events.find((e) => e.id === d.eventId);
    if (!event) {
      event = { id: d.eventId, type: d.event, objectId: d.objectId, created: d.time, payload: d.payload, delivered: 0, total: 0 };
      events.push(event);
    }
    event.total += 1;
    if (d.status === 'delivered') event.delivered += 1;
  }));
  events.sort((a, b) => b.created.localeCompare(a.created));

  /* API request log ----------------------------------------------------------------------- */
  const ROUTES = [
    { method: 'POST', path: () => '/payments', ok: 201, errors: [400, 422, 409], body: () => ({ offeringId: 'CROSSMINT.PAYMENT_API.START_PAYMENT.PAYIN', requestId: pick(PAYMENT_IDS), referenceId: `ORD-${10400 + Math.floor(rand() * 99)}`, amount: '25.00', currency: 'USD' }) },
    { method: 'GET', path: () => `/payments/${pick(PAYMENT_IDS)}`, ok: 200, errors: [404] },
    { method: 'GET', path: () => '/offerings', ok: 200, errors: [401] },
    { method: 'POST', path: () => '/payments/cancel', ok: 200, errors: [409], body: () => ({ requestId: pick(PAYMENT_IDS) }) },
    { method: 'POST', path: () => '/refunds', ok: 201, errors: [422], body: () => ({ requestId: pick(PAYMENT_IDS), amount: '10.00' }) },
    { method: 'POST', path: () => '/payouts', ok: 201, errors: [400, 422], body: () => ({ offeringId: 'FORUMPAY.PAYMENT_API.WITHDRAWAL.PAYOUT', amount: '150.00', currency: 'USDT' }) },
    { method: 'GET', path: () => '/cards/cardholders', ok: 200, errors: [403] },
    { method: 'POST', path: () => '/cards/orders', ok: 201, errors: [403, 422], body: () => ({ cardholderId: `ch_${hex(10)}`, issuer: 'Axys' }) },
    { method: 'DELETE', path: () => `/webhooks/we_${hex(10)}`, ok: 204, errors: [404] },
  ];
  const ERROR_TEXT = { 400: 'Bad request', 401: 'Invalid API key', 403: 'API key is missing the CARDS scope', 404: 'Not found', 409: 'Payment is no longer pending', 422: 'Amount is below the offering minimum', 429: 'Rate limit exceeded', 500: 'Internal error', 502: 'Provider unavailable', 503: 'Service unavailable' };
  const liveKeys = apiKeys.filter((k) => k.env === 'live' && k.status === 'active');

  function buildRequest(time) {
    const route = pick(ROUTES);
    const roll = rand();
    const status = roll < 0.78 ? route.ok : roll < 0.95 ? pick(route.errors) : pick([429, 500, 502, 503]);
    const path = route.path();
    const key = path.startsWith('/cards') && status !== 403 ? apiKeys[1] : pick(liveKeys);
    const body = route.body ? route.body() : null;
    return {
      id: `rq_${hex(14)}`,
      time,
      method: route.method,
      path,
      status,
      duration: status >= 500 ? 900 + Math.floor(rand() * 2000) : 40 + Math.floor(rand() * 420),
      keyId: key.id,
      keyName: key.name,
      ip: pick(['34.120.18.44', '34.120.18.91', '52.14.201.7']),
      requestBody: body,
      responseBody: status >= 400
        ? { error: { code: status, message: ERROR_TEXT[status] } }
        : status === 204 ? null : { ok: true, ...(body?.requestId ? { requestId: body.requestId } : {}), ...(path.startsWith('/payments/req_') ? { requestId: path.split('/')[2], status: 'PAID' } : {}) },
    };
  }

  const apiRequests = [];
  let t = NOW - 45000;
  for (let i = 0; i < 140; i += 1) {
    apiRequests.push(buildRequest(new Date(t).toISOString()));
    t -= (20 + rand() * 600) * 1000;
  }

  window.Portal.data = Object.assign(window.Portal.data || {}, {
    offerings,
    apiKeys,
    webhookEvents: WEBHOOK_EVENTS,
    webhookEndpoints,
    events,
    apiRequests,
    /** Simulates one more request for the Event logs live tail. */
    simulateRequest: (time) => buildRequest(time),
  });
})();
