/*
 * Sample payments shared by Transactions, Refunds and search.
 * Deterministic so every reviewer sees the same data. Replace with GET /payments.
 */
(function () {
  'use strict';

  const OFFERINGS = {
    Crossmint: { offering: 'CROSSMINT.PAYMENT_API.START_PAYMENT.PAYIN', method: 'FIAT_CARD', currencies: ['USD', 'USD', 'AED'] },
    ForumPay: { offering: 'FORUMPAY.PAYMENT_API.START_PAYMENT.PAYIN', method: 'CRYPTO', currencies: ['USDT', 'USDC'] },
    'Blockchain rail': { offering: 'BLOCKCHAIN_RAIL.PAYMENT_API.TRANSFER.PAYIN', method: 'CRYPTO', currencies: ['USDC', 'USDT'] },
  };
  const FAILURES = {
    Crossmint: ['Card declined by issuer (insufficient funds)', '3-D Secure authentication failed', 'Card declined: suspected fraud'],
    ForumPay: ['Payment expired before funds arrived', 'Underpaid: received less than requested'],
    'Blockchain rail': ['Transfer sent on an unsupported network', 'Payment expired before funds arrived'],
  };
  const NAMES = ['ava', 'noah', 'mia', 'liam', 'zara', 'omar', 'lena', 'ravi', 'sara', 'theo', 'yuki', 'ines'];

  function seeded(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
  const rand = seeded(4242);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');

  // The first seven match the Overview "Recent payments" table exactly.
  const fixed = [
    ['req_8f3a91c2e7', 'ORD-10492', 'Crossmint', 'paid', '25.00', 'USD', '2026-11-27T10:42:00Z'],
    ['req_77b0d415aa', 'ORD-10491', 'ForumPay', 'pending', '40.00', 'USDT', '2026-11-27T10:18:00Z'],
    ['req_c19e2f0b63', 'ORD-10490', 'Blockchain rail', 'paid', '12.50', 'USDC', '2026-11-27T09:55:00Z'],
    ['req_5d4410ee09', 'ORD-10489', 'Crossmint', 'failed', '60.00', 'USD', '2026-11-26T18:31:00Z'],
    ['req_2ab9c3d871', 'ORD-10488', 'ForumPay', 'cancelled', '18.00', 'USDT', '2026-11-26T16:07:00Z'],
    ['req_e04b7a19c5', 'ORD-10487', 'Crossmint', 'paid', '32.75', 'USD', '2026-11-26T11:20:00Z'],
    ['req_91fd02c6b8', 'ORD-10486', 'Blockchain rail', 'failed', '9.99', 'USDC', '2026-11-25T21:02:00Z'],
  ];

  function build([id, ref, route, status, amount, currency, created], index) {
    const o = OFFERINGS[route];
    const fee = (Number(amount) * (o.method === 'FIAT_CARD' ? 0.029 : 0.01) + (o.method === 'FIAT_CARD' ? 0.3 : 0)).toFixed(2);
    const t = new Date(created).getTime();
    const at = (mins) => new Date(t + mins * 60000).toISOString();
    const events = [{ title: 'Payment created', desc: 'POST /payments accepted', time: created, tone: '' }];
    events.push({ title: `Sent to ${route}`, desc: o.method === 'FIAT_CARD' ? 'Hosted card page opened' : 'Deposit address issued', time: at(1), tone: '' });
    const failure = status === 'failed' ? FAILURES[route][index % FAILURES[route].length] : null;
    if (status === 'paid') events.push({ title: 'Payment received', desc: `${amount} ${currency} confirmed by ${route}`, time: at(4), tone: 'success' });
    if (status === 'failed') events.push({ title: 'Payment failed', desc: failure, time: at(6), tone: 'danger' });
    if (status === 'cancelled') events.push({ title: 'Payment cancelled', desc: 'Cancelled by partner (POST /payments/cancel)', time: at(9), tone: '' });
    if (status === 'pending') events.push({ title: 'Waiting for customer', desc: 'Expires in 26 minutes', time: at(2), tone: 'warning' });
    if (status === 'refunded') events.push({ title: 'Payment received', desc: `${amount} ${currency} confirmed`, time: at(4), tone: 'success' }, { title: 'Refunded', desc: 'Full refund to the original method', time: at(1440), tone: '' });
    return {
      id, ref, route, status, amount, currency, created, fee,
      net: status === 'paid' ? (Number(amount) - Number(fee)).toFixed(2) : '0.00',
      method: o.method,
      offering: o.offering,
      customer: `${NAMES[index % NAMES.length]}@example.com`,
      providerRef: `${route.slice(0, 2).toUpperCase()}-${hex(10).toUpperCase()}`,
      failure,
      events,
      webhooks: [
        { event: 'payment.created', status: 'delivered', code: 200, time: at(0) },
        ...(status === 'pending' ? [] : [{ event: 'payment.status_updated', status: index % 5 === 3 ? 'retrying' : 'delivered', code: index % 5 === 3 ? 503 : 200, time: at(5) }]),
      ],
    };
  }

  const rows = fixed.map(build);
  const routes = Object.keys(OFFERINGS);
  const statuses = ['paid', 'paid', 'paid', 'paid', 'failed', 'pending', 'cancelled', 'paid', 'refunded'];
  let time = new Date('2026-11-25T18:00:00Z').getTime();
  for (let i = 0; i < 57; i += 1) {
    time -= (40 + rand() * 600) * 60000;
    const route = pick(routes);
    const amount = (5 + rand() * 120).toFixed(2);
    rows.push(build([`req_${hex(10)}`, `ORD-${10485 - i}`, route, pick(statuses), amount, pick(OFFERINGS[route].currencies), new Date(time).toISOString()], i + 7));
  }

  window.Portal.data = Object.assign(window.Portal.data || {}, { payments: rows });
})();
