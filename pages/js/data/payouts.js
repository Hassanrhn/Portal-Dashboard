/*
 * Sample payouts: withdrawals from the partner balance to crypto wallets through ForumPay.
 * Deterministic so every reviewer sees the same data. Replace with GET /payouts and GET /balances.
 */
(function () {
  'use strict';

  const OFFERING = 'FORUMPAY.PAYMENT_API.WITHDRAWAL.PAYOUT';
  const NETWORKS = {
    TRC20: { chain: 'Tron', fee: '1.00', currencies: ['USDT'] },
    ERC20: { chain: 'Ethereum', fee: '4.50', currencies: ['USDT', 'USDC'] },
    Polygon: { chain: 'Polygon PoS', fee: '0.10', currencies: ['USDT', 'USDC'] },
  };
  const REQUESTERS = ['pocket@pocket.com', 'finance@theorangecard.com', 'ops@theorangecard.com'];
  const APPROVERS = ['pocket@pocket.com', 'finance@theorangecard.com'];
  const FAILURES = [
    'Destination address rejected by the network',
    'Transaction dropped after 3 broadcast attempts (network congestion)',
    'ForumPay hot wallet temporarily short of liquidity',
  ];
  const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const MIN = 60000;

  function seeded(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
  const rand = seeded(7319);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  const address = (network) => (network === 'TRC20' ? `T${Array.from({ length: 33 }, () => pick(BASE58)).join('')}` : `0x${hex(40)}`);
  const txHash = (network) => (network === 'TRC20' ? hex(64) : `0x${hex(64)}`);
  const iso = (ms) => new Date(ms).toISOString();

  /** Builds one payout with the timestamps its status implies. */
  function build({ status, network, currency, amount, created, requestedBy, broadcast = true }, index) {
    const t = new Date(created).getTime();
    const approved = status !== 'awaiting_approval' && !(status === 'cancelled' && index % 2 === 0);
    const sent = approved && broadcast && status !== 'cancelled';
    const p = {
      id: `po_${hex(10)}`,
      ref: `WD-${2060 - index}`,
      status,
      currency,
      network,
      address: address(network),
      amount,
      fee: NETWORKS[network].fee,
      created,
      requestedBy,
      approvedBy: approved ? APPROVERS.find((a) => a !== requestedBy) : null,
      approvedAt: approved ? iso(t + (14 + index * 3) * MIN) : null,
      broadcastAt: null,
      confirmedAt: null,
      txHash: null,
      failure: null,
      failedAt: null,
      cancelledAt: null,
      cancelNote: null,
    };
    if (sent) {
      p.broadcastAt = iso(new Date(p.approvedAt).getTime() + 3 * MIN);
      p.txHash = txHash(network);
    }
    if (status === 'paid') p.confirmedAt = iso(new Date(p.broadcastAt).getTime() + (network === 'ERC20' ? 6 : 2) * MIN);
    if (status === 'failed') {
      p.failure = FAILURES[index % FAILURES.length];
      p.failedAt = iso(new Date(p.broadcastAt).getTime() + 9 * MIN);
    }
    if (status === 'cancelled') {
      p.cancelledAt = iso(t + 40 * MIN);
      p.cancelNote = approved ? `Cancelled by ${p.approvedBy} before broadcast` : `Rejected by ${APPROVERS.find((a) => a !== requestedBy)}`;
    }
    return p;
  }

  // The newest rows are fixed so the queue always shows each state.
  const fixed = [
    { status: 'awaiting_approval', network: 'TRC20', currency: 'USDT', amount: '2400.00', created: '2026-11-27T09:12:00Z', requestedBy: 'finance@theorangecard.com' },
    { status: 'awaiting_approval', network: 'Polygon', currency: 'USDC', amount: '1850.75', created: '2026-11-27T08:03:00Z', requestedBy: 'ops@theorangecard.com' },
    { status: 'processing', network: 'ERC20', currency: 'USDT', amount: '640.00', created: '2026-11-27T07:40:00Z', requestedBy: 'pocket@pocket.com', broadcast: false },
    { status: 'processing', network: 'TRC20', currency: 'USDT', amount: '315.20', created: '2026-11-27T06:58:00Z', requestedBy: 'ops@theorangecard.com' },
    { status: 'awaiting_approval', network: 'ERC20', currency: 'USDC', amount: '4200.00', created: '2026-11-26T17:25:00Z', requestedBy: 'pocket@pocket.com' },
    { status: 'paid', network: 'TRC20', currency: 'USDT', amount: '980.00', created: '2026-11-26T14:10:00Z', requestedBy: 'finance@theorangecard.com' },
    { status: 'failed', network: 'Polygon', currency: 'USDT', amount: '120.00', created: '2026-11-26T11:47:00Z', requestedBy: 'ops@theorangecard.com' },
  ];

  const rows = fixed.map(build);
  const statuses = ['paid', 'paid', 'paid', 'paid', 'paid', 'failed', 'cancelled', 'paid'];
  const networks = Object.keys(NETWORKS);
  let time = new Date('2026-11-26T09:00:00Z').getTime();
  for (let i = 0; i < 29; i += 1) {
    time -= (8 + rand() * 40) * 60 * MIN;
    const network = pick(networks);
    const status = pick(statuses);
    rows.push(build({
      status,
      network,
      currency: pick(NETWORKS[network].currencies),
      amount: (40 + rand() * (status === 'paid' ? 2600 : 900)).toFixed(2),
      created: iso(time),
      requestedBy: pick(REQUESTERS),
    }, i + fixed.length));
  }

  window.Portal.data = Object.assign(window.Portal.data || {}, {
    payouts: rows,
    payoutConfig: {
      OFFERING,
      NETWORKS,
      MIN_AMOUNT: '10.00',
      APPROVAL_THRESHOLD: '1000.00',
      balances: { USDT: '18420.55', USDC: '9310.20' },
    },
  });
})();
