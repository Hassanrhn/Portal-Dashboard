/*
 * Sample reporting data: saved exports, monthly statements, settlement batches for reconciliation
 * and a few card orders for the card-order export. Load after data/payments.js.
 * Deterministic. Replace with GET /reports/exports, /statements and /settlements.
 */
(function () {
  'use strict';

  const payments = window.Portal.data.payments;

  // Saved exports. Rows are counted from the sample data when the page renders.
  const exports = [
    { id: 'exp_7d21c0a9f3', type: 'transactions', from: '2026-11-01', to: '2026-11-26', format: 'csv', includeTest: false, created: '2026-11-26T08:10:00Z', createdBy: 'finance@theorangecard.com' },
    { id: 'exp_4b90e2d6a1', type: 'payouts', from: '2026-10-28', to: '2026-11-26', format: 'csv', includeTest: false, created: '2026-11-25T16:42:00Z', createdBy: 'pocket@pocket.com' },
    { id: 'exp_c38f15be07', type: 'fees', from: '2026-11-01', to: '2026-11-24', format: 'json', includeTest: true, created: '2026-11-24T09:05:00Z', createdBy: 'ops@theorangecard.com' },
    { id: 'exp_91a6d4c2e8', type: 'refunds', from: '2026-10-01', to: '2026-10-31', format: 'csv', includeTest: false, created: '2026-11-12T10:30:00Z', createdBy: 'finance@theorangecard.com' },
  ];

  // Monthly statements in USD equivalent. Net = gross − fees − refunds.
  const statements = [
    ['2026-11', '48210.40', '1102.35', '658.67', '28163.71', 'open'],
    ['2026-10', '61874.15', '1418.90', '912.40', '52300.00', 'closed'],
    ['2026-09', '57340.80', '1311.62', '1044.18', '49850.25', 'closed'],
    ['2026-08', '52906.55', '1207.44', '701.93', '46120.00', 'closed'],
    ['2026-07', '44718.20', '1021.06', '533.10', '40200.00', 'closed'],
    ['2026-06', '39582.65', '903.77', '612.45', '35000.00', 'closed'],
  ].map(([period, gross, fees, refunds, payouts, status]) => ({
    period, gross, fees, refunds, payouts, status,
    net: (Number(gross) - Number(fees) - Number(refunds)).toFixed(2),
  }));

  // Settlement batches: what each provider paid out versus what Portal expected.
  const PROVIDERS = { Crossmint: { code: 'cm', currency: 'USD' }, ForumPay: { code: 'fp', currency: 'USDT' }, 'Blockchain rail': { code: 'br', currency: 'USDC' } };
  const MISMATCHES = {
    'stl_cm_20261126': [['Missing from settlement', 0], ['Fee charged twice', 4]],
    'stl_fp_20261125': [['Underpaid by provider', 1]],
    'stl_br_20261123': [['Missing from settlement', 2], ['Unexpected network fee', 0]],
  };
  const ITEM_AMOUNTS = { 'Missing from settlement': null, 'Fee charged twice': '1.05', 'Underpaid by provider': '3.20', 'Unexpected network fee': '0.85' };
  const days = ['26', '25', '24', '23', '22', '21'];
  const batches = [];
  days.forEach((day, d) => {
    Object.entries(PROVIDERS).forEach(([provider, { code, currency }], p) => {
      if ((d + p) % 3 === 2) return;
      const id = `stl_${code}_202611${day}`;
      const routePayments = payments.filter((x) => x.route === provider && x.currency === currency && x.status === 'paid');
      const expected = (1800 + ((d * 7 + p * 13) % 11) * 437.35).toFixed(2);
      const items = (MISMATCHES[id] || []).map(([kind, index]) => {
        const payment = routePayments[index % routePayments.length];
        return { kind, paymentId: payment.id, ref: payment.ref, amount: ITEM_AMOUNTS[kind] || payment.amount };
      });
      const missing = items.reduce((sum, i) => sum + Number(i.amount), 0);
      batches.push({
        id, provider, currency, expected,
        received: (Number(expected) - missing).toFixed(2),
        settledAt: `2026-11-${day}T0${2 + p}:15:00Z`,
        status: items.length ? 'mismatch' : 'matched',
        items,
        resolvedBy: null,
      });
    });
  });

  // Card orders for the "Card orders" export only (the Cards pages own the full model).
  const ISSUERS = ['Axys', 'Hypercard', 'Interlace'];
  const ORDER_STATUS = ['shipped', 'shipped', 'in_transit', 'pending', 'delivered'];
  const cardOrders = Array.from({ length: 18 }, (_, i) => ({
    id: `co_${(0x5a21c3 + i * 7919).toString(16)}e${i}`,
    issuer: ISSUERS[i % ISSUERS.length],
    cardholder: `ch_${(0x91b40 + i * 4111).toString(16)}`,
    type: i % 4 === 0 ? 'physical' : 'virtual',
    status: ORDER_STATUS[i % ORDER_STATUS.length],
    created: new Date(Date.UTC(2026, 10, 26, 15) - i * 2.6 * 86400000).toISOString(),
  }));

  window.Portal.data = Object.assign(window.Portal.data || {}, {
    reports: { exports, statements, batches, cardOrders },
  });
})();
