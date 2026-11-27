/*
 * Sample refunds, derived from the shared payments (load after data/payments.js).
 * Refunded payments get a succeeded full refund; a few paid payments have a pending or failed one,
 * which leaves the payment itself "paid". Deterministic. Replace with GET /refunds.
 */
(function () {
  'use strict';

  const payments = window.Portal.data.payments;
  const NOW = Date.UTC(2026, 10, 27, 12);
  const MIN = 60000;
  const REASONS = ['Requested by customer', 'Duplicate payment', 'Fraudulent', 'Other'];
  const REQUESTERS = ['pocket@pocket.com', 'finance@theorangecard.com', 'ops@theorangecard.com'];
  const FAILURES = {
    FIAT_CARD: 'Issuer rejected the refund: the card is closed',
    CRYPTO: 'Customer wallet no longer accepts deposits on this network',
  };

  function seeded(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
  const rand = seeded(5150);
  const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  const iso = (ms) => new Date(Math.min(ms, NOW)).toISOString();

  function build(p, { status, amount, delayMins }, index) {
    const created = iso(new Date(p.created).getTime() + delayMins * MIN);
    const settle = new Date(created).getTime() + (p.method === 'FIAT_CARD' ? 95 : 12) * MIN;
    return {
      id: `rf_${hex(10)}`,
      paymentId: p.id,
      ref: p.ref,
      route: p.route,
      method: p.method,
      currency: p.currency,
      paidAmount: p.amount,
      fee: p.fee,
      amount,
      reason: REASONS[index % REASONS.length],
      status,
      created,
      requestedBy: REQUESTERS[index % REQUESTERS.length],
      providerRef: `${p.route.slice(0, 2).toUpperCase()}-RF-${hex(8).toUpperCase()}`,
      completedAt: status === 'pending' ? null : iso(settle),
      failure: status === 'failed' ? FAILURES[p.method] : null,
    };
  }

  const refunded = payments.filter((p) => p.status === 'refunded')
    .map((p, i) => build(p, { status: 'succeeded', amount: p.amount, delayMins: 1440 }, i));

  // Pending and failed refunds sit on payments that are still "paid" (partial amounts are common).
  const paid = payments.filter((p) => p.status === 'paid');
  const open = [
    [1, 'pending', 1], [4, 'pending', 0.5], [7, 'failed', 1], [11, 'pending', 1], [15, 'failed', 0.4],
  ].filter(([i]) => paid[i]).map(([i, status, share], n) => {
    const p = paid[i];
    const amount = (Number(p.amount) * share).toFixed(2);
    return build(p, { status, amount, delayMins: 90 + n * 140 }, n + refunded.length);
  });

  const rows = [...refunded, ...open].sort((a, b) => b.created.localeCompare(a.created));
  window.Portal.data = Object.assign(window.Portal.data || {}, { refunds: rows, refundReasons: REASONS });
})();
