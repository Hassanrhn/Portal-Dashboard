/*
 * Sample data for the Overview prototype. Replace with API responses when wiring to the backend.
 * Money is kept as decimal strings at the boundary (as the Portal API does) and converted only for charts.
 */
(function () {
  'use strict';

  /** Deterministic pseudo-random generator so the prototype looks the same on every load. */
  function seeded(seed) {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  }

  /** Daily volume series that sums exactly to `total` (two decimals). */
  function series(days, total, seed) {
    const rand = seeded(seed);
    const raw = Array.from({ length: days }, (_, i) => 0.4 + rand() + Math.sin(i / 3.5) * 0.25);
    const sum = raw.reduce((a, b) => a + b, 0);
    const cents = raw.map((v) => Math.round((v / sum) * total * 100));
    cents[cents.length - 1] += Math.round(total * 100) - cents.reduce((a, b) => a + b, 0);
    const end = new Date(Date.UTC(2026, 10, 27));
    return cents.map((c, i) => ({ date: new Date(end.getTime() - (days - 1 - i) * 86400000), value: c / 100 }));
  }

  const ranges = {
    '7d':  { label: 'Last 7 days',  period: 'vs previous 7 days',  total: '71.40',  volumeDelta: 8.2,  rate: 37.5, rateDelta: 2.3,  paid: 6,  payments: 16,  paidDelta: 1 },
    '30d': { label: 'Last 30 days', period: 'vs previous 30 days', total: '299.28', volumeDelta: 12.4, rate: 32.7, rateDelta: -4.1, paid: 16, payments: 49,  paidDelta: 3 },
    '90d': { label: 'Last 90 days', period: 'vs previous 90 days', total: '842.10', volumeDelta: 21.9, rate: 35.1, rateDelta: 1.6,  paid: 51, payments: 145, paidDelta: 14 },
  };
  const seeds = { '7d': 7, '30d': 30, '90d': 90 };
  Object.entries(ranges).forEach(([key, r]) => { r.series = series(parseInt(key, 10), Number(r.total), seeds[key]); });
  // Route and currency mix shift a little per range, so the share bars visibly animate between ranges.
  ranges['7d'].shares = {
    route: [['Crossmint', 0.52, 'chart-1'], ['ForumPay', 0.27, 'chart-2'], ['Blockchain rail', 0.21, 'chart-3']],
    currency: [['USD', 0.66, 'chart-1'], ['USDT', 0.21, 'chart-2'], ['USDC', 0.13, 'chart-3']],
  };
  ranges['90d'].shares = {
    route: [['Crossmint', 0.41, 'chart-1'], ['ForumPay', 0.34, 'chart-2'], ['Blockchain rail', 0.25, 'chart-3']],
    currency: [['USD', 0.74, 'chart-1'], ['USDT', 0.15, 'chart-2'], ['USDC', 0.11, 'chart-3']],
  };

  window.Portal.data = Object.freeze({
    overview: {
      ranges,
      shares: {
        route:    [['Crossmint', 0.4748, 'chart-1'], ['ForumPay', 0.3097, 'chart-2'], ['Blockchain rail', 0.2155, 'chart-3']],
        currency: [['USD', 0.7197, 'chart-1'], ['USDT', 0.1597, 'chart-2'], ['USDC', 0.1206, 'chart-3']],
      },
      payments: [
        { id: 'req_8f3a91c2e7', ref: 'ORD-10492', route: 'Crossmint',       status: 'paid',      amount: '25.00', currency: 'USD',  date: '2026-11-27T10:42:00Z' },
        { id: 'req_77b0d415aa', ref: 'ORD-10491', route: 'ForumPay',        status: 'pending',   amount: '40.00', currency: 'USDT', date: '2026-11-27T10:18:00Z' },
        { id: 'req_c19e2f0b63', ref: 'ORD-10490', route: 'Blockchain rail', status: 'paid',      amount: '12.50', currency: 'USDC', date: '2026-11-27T09:55:00Z' },
        { id: 'req_5d4410ee09', ref: 'ORD-10489', route: 'Crossmint',       status: 'failed',    amount: '60.00', currency: 'USD',  date: '2026-11-26T18:31:00Z' },
        { id: 'req_2ab9c3d871', ref: 'ORD-10488', route: 'ForumPay',        status: 'cancelled', amount: '18.00', currency: 'USDT', date: '2026-11-26T16:07:00Z' },
        { id: 'req_e04b7a19c5', ref: 'ORD-10487', route: 'Crossmint',       status: 'paid',      amount: '32.75', currency: 'USD',  date: '2026-11-26T11:20:00Z' },
        { id: 'req_91fd02c6b8', ref: 'ORD-10486', route: 'Blockchain rail', status: 'failed',    amount: '9.99',  currency: 'USDC', date: '2026-11-25T21:02:00Z' },
      ],
    },
  });
})();
