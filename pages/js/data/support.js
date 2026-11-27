/*
 * Sample support tickets and system status for Contact support.
 * Deterministic so every reviewer sees the same data. Replace with GET /support/tickets and the status feed.
 */
(function () {
  'use strict';

  const tickets = [
    {
      id: 'TKT-2041', subject: 'Card payments declined with 3-D Secure error', topic: 'Payments', priority: 'Normal', status: 'waiting',
      requestId: 'req_5d4410ee09', updated: '2026-11-27T09:20:00Z',
      thread: [
        { from: 'pocket@pocket.com', staff: false, time: '2026-11-26T18:50:00Z', text: 'Several card payments failed tonight with "3-D Secure authentication failed". Example: req_5d4410ee09.' },
        { from: 'Portal support', staff: true, time: '2026-11-27T09:20:00Z', text: 'Crossmint confirms the issuer rejected the challenge. Can you tell us if the customer completed the bank app step? We can then raise it with the issuer.' },
      ],
    },
    {
      id: 'TKT-2033', subject: 'Payout to treasury wallet still pending', topic: 'Payouts', priority: 'Normal', status: 'open',
      requestId: '', updated: '2026-11-26T13:05:00Z',
      thread: [
        { from: 'pocket@pocket.com', staff: false, time: '2026-11-26T11:30:00Z', text: 'A USDT payout approved yesterday is still pending on ForumPay.' },
        { from: 'Portal support', staff: true, time: '2026-11-26T13:05:00Z', text: 'Thanks, we are checking with ForumPay and will update you here.' },
      ],
    },
    {
      id: 'TKT-1987', subject: 'Webhook signature mismatch after key rotation', topic: 'Webhooks', priority: 'Low', status: 'closed',
      requestId: '', updated: '2026-11-18T10:00:00Z',
      thread: [
        { from: 'pocket@pocket.com', staff: false, time: '2026-11-17T09:00:00Z', text: 'Signatures stopped matching after we rotated the signing secret.' },
        { from: 'Portal support', staff: true, time: '2026-11-17T12:40:00Z', text: 'Deliveries in flight keep the old signature for up to 5 minutes after rotation. Accept both secrets during that window.' },
        { from: 'pocket@pocket.com', staff: false, time: '2026-11-18T10:00:00Z', text: 'That fixed it, thanks.' },
      ],
    },
  ];

  const status = [
    { name: 'Payments API', state: 'operational', note: '99.99% uptime, last 30 days' },
    { name: 'Crossmint', state: 'operational', note: 'Card pay-ins' },
    { name: 'ForumPay', state: 'degraded', note: 'Slower crypto confirmations since 08:10 UTC' },
    { name: 'Blockchain rail', state: 'operational', note: 'USDC and USDT transfers' },
    { name: 'Webhook delivery', state: 'operational', note: 'Median delay 1.2 s' },
    { name: 'Card issuers', state: 'operational', note: 'Axys, Hypercard, Interlace' },
  ];

  window.Portal.data = Object.assign(window.Portal.data || {}, { support: { tickets, status } });
})();
