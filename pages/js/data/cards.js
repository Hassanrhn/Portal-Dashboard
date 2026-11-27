/*
 * Sample card program data shared by Cardholders, Card orders and Issuers.
 * Deterministic so every reviewer sees the same data. Replace with GET /cards/issuers, /cardholders, /cards, /card-orders.
 * Interlace is connected with a key that lacks the CARDS scope, so Portal cannot read any of its records.
 */
(function () {
  'use strict';

  const NOW = Date.UTC(2026, 10, 27, 12);
  const DAY = 86400000;

  const ISSUERS = [
    {
      name: 'Axys', status: 'connected', program: 'Orange Visa Debit', currencies: ['USD', 'USDC'],
      lastWebhook: '2026-11-27T11:48:00Z', events: ['card_order.status_updated', 'cardholder.status_updated'],
    },
    {
      name: 'Hypercard', status: 'connected', program: 'Orange Mastercard Prepaid', currencies: ['USD', 'AED', 'USDT'],
      lastWebhook: '2026-11-27T10:05:00Z', events: ['card_order.status_updated', 'cardholder.status_updated'],
    },
    {
      name: 'Interlace', status: 'needs_scope', program: 'Orange Travel Card', currencies: ['USD', 'USDC'],
      lastWebhook: null, events: [],
    },
  ];

  const COUNTRIES = [
    { code: 'AE', name: 'United Arab Emirates', dial: '+971', city: 'Dubai', postal: '00000' },
    { code: 'GB', name: 'United Kingdom', dial: '+44', city: 'London', postal: 'EC2A 4NE' },
    { code: 'US', name: 'United States', dial: '+1', city: 'Austin', postal: '78701' },
    { code: 'DE', name: 'Germany', dial: '+49', city: 'Berlin', postal: '10115' },
    { code: 'SG', name: 'Singapore', dial: '+65', city: 'Singapore', postal: '018956' },
    { code: 'FR', name: 'France', dial: '+33', city: 'Paris', postal: '75002' },
  ];

  const PEOPLE = [
    ['Ava', 'Haddad'], ['Noah', 'Fischer'], ['Mia', 'Tanaka'], ['Liam', 'Okafor'], ['Zara', 'Khan'], ['Omar', 'Saleh'],
    ['Lena', 'Weber'], ['Ravi', 'Menon'], ['Sara', 'Lindqvist'], ['Theo', 'Martin'], ['Yuki', 'Sato'], ['Ines', 'Moreau'],
    ['Karim', 'Nasser'], ['Chloe', 'Bennett'], ['Jonas', 'Becker'], ['Priya', 'Shah'], ['Leo', 'Rossi'], ['Hana', 'Kim'],
    ['Adam', 'Novak'], ['Maya', 'Cohen'], ['Ethan', 'Wright'], ['Nora', 'Aziz'], ['Felix', 'Wagner'], ['Lucia', 'Garcia'],
    ['Samir', 'Rahman'], ['Elena', 'Popescu'], ['Daniel', 'Reyes'], ['Aisha', 'Bello'], ['Marco', 'Bianchi'], ['Julia', 'Kowalski'],
  ];
  const STREETS = ['12 Marina Walk', '48 Old Street', '901 Congress Ave', '7 Torstraße', '1 Raffles Place', '22 Rue du Mail'];
  const FAILURES = [
    'Issuer rejected the order: shipping address could not be verified',
    'Issuer timeout while creating the card (no response after 30 s)',
    'Cardholder KYC was not verified when the order reached the issuer',
  ];

  function seeded(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
  const rand = seeded(2711);
  const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  const digits = (n) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join('');
  const iso = (t) => new Date(t).toISOString();

  /* Cardholders ---------------------------------------------------------------- */
  const KYC = ['verified', 'verified', 'verified', 'verified', 'pending', 'verified', 'rejected', 'verified', 'pending'];

  function kycEvents(kyc, created) {
    const events = [{ title: 'Cardholder created', desc: 'KYC submitted to the issuer', time: iso(created), tone: '' }];
    if (kyc === 'pending') events.push({ title: 'KYC pending', desc: 'cardholder.status_updated · waiting for document review', time: iso(created + 20 * 60000), tone: 'warning' });
    if (kyc === 'verified') events.push({ title: 'KYC verified', desc: 'cardholder.status_updated · identity and address confirmed', time: iso(created + 3 * 3600000), tone: 'success' });
    if (kyc === 'rejected') events.push({ title: 'KYC rejected', desc: 'cardholder.status_updated · document expired', time: iso(created + 5 * 3600000), tone: 'danger' });
    return events;
  }

  const cardholders = PEOPLE.map(([first, last], i) => {
    const country = COUNTRIES[i % COUNTRIES.length];
    const issuer = i % 3 === 2 ? 'Hypercard' : 'Axys';
    const created = NOW - (2 + i * 2.6 + rand()) * DAY;
    const kyc = KYC[i % KYC.length];
    return {
      id: `ch_${hex(12)}`, first, last, name: `${first} ${last}`,
      email: `${first}.${last}@example.com`.toLowerCase(),
      phone: `${country.dial} ${digits(3)} ${digits(4)}`,
      country: country.code, issuer, kyc, status: 'active',
      created: iso(created), events: kycEvents(kyc, created),
    };
  });

  /* Cards and their orders ------------------------------------------------------- */
  const cards = [];
  const orders = [];

  function orderEvents(status, type, created) {
    const at = (h) => iso(created + h * 3600000);
    const steps = [{ title: 'Order requested', desc: 'card_order.status_updated · requested', time: at(0), tone: '' }];
    if (status === 'requested') return steps;
    steps.push({ title: 'Processing', desc: 'card_order.status_updated · issuer is creating the card', time: at(0.2), tone: status === 'processing' ? 'warning' : '' });
    if (status === 'failed') { steps.push({ title: 'Order failed', desc: 'card_order.status_updated · failed', time: at(1), tone: 'danger' }); return steps; }
    if (status === 'processing') return steps;
    if (type === 'physical') steps.push({ title: 'Shipped', desc: 'card_order.status_updated · handed to courier', time: at(30), tone: status === 'shipped' ? 'warning' : '' });
    if (status === 'active') steps.push({ title: 'Card active', desc: 'card_order.status_updated · active', time: at(type === 'physical' ? 96 : 0.5), tone: 'success' });
    return steps;
  }

  function addOrder(holder, { type, status, currency, limit, created, cardId }) {
    const country = COUNTRIES.find((c) => c.code === holder.country);
    const physical = type === 'physical';
    const order = {
      id: `co_${hex(12)}`, cardholderId: holder.id, issuer: holder.issuer, type, status, currency, limit,
      created: iso(created), cardId: cardId || null,
      shipping: physical ? { line1: STREETS[COUNTRIES.indexOf(country)], city: country.city, postal: country.postal, country: country.code } : null,
      tracking: physical && (status === 'shipped' || status === 'active') ? `DHL${digits(10)}` : null,
      failure: status === 'failed' ? FAILURES[orders.length % FAILURES.length] : null,
      events: orderEvents(status, type, created),
    };
    orders.push(order);
    return order;
  }

  cardholders.filter((h) => h.kyc === 'verified').forEach((holder, i) => {
    const issuer = ISSUERS.find((x) => x.name === holder.issuer);
    const count = i % 4 === 0 ? 2 : 1;
    for (let n = 0; n < count; n += 1) {
      const type = (i + n) % 3 === 0 ? 'physical' : 'virtual';
      const currency = issuer.currencies[(i + n) % issuer.currencies.length];
      const created = new Date(holder.created).getTime() + (4 + n * 30) * 3600000;
      const card = {
        id: `card_${hex(12)}`, cardholderId: holder.id, issuer: holder.issuer, type, currency,
        last4: digits(4), status: (i + n) % 7 === 5 ? 'frozen' : 'active', limit: ['500.00', '1000.00', '2500.00'][(i + n) % 3],
      };
      cards.push(card);
      addOrder(holder, { type, status: 'active', currency, limit: card.limit, created, cardId: card.id });
    }
  });

  // Orders still in flight or failed, newest first in the table after sorting.
  const verified = cardholders.filter((h) => h.kyc === 'verified');
  [['requested', 'virtual'], ['processing', 'physical'], ['shipped', 'physical'], ['failed', 'physical'], ['requested', 'physical'],
    ['processing', 'virtual'], ['failed', 'virtual'], ['shipped', 'physical'], ['requested', 'virtual']].forEach(([status, type], i) => {
    const holder = verified[(i * 5 + 3) % verified.length];
    const issuer = ISSUERS.find((x) => x.name === holder.issuer);
    addOrder(holder, { type, status, currency: issuer.currencies[i % issuer.currencies.length], limit: '1000.00', created: NOW - (0.1 + i * 0.7) * DAY });
  });

  orders.sort((a, b) => b.created.localeCompare(a.created));
  cardholders.sort((a, b) => b.created.localeCompare(a.created));

  /* Webhook health for the two card events -------------------------------------------- */
  const webhooks = [
    { event: 'card_order.status_updated', endpoint: 'https://api.theorangecard.com/hooks/cards', delivered: 142, failed: 0, last: '2026-11-27T11:48:00Z', status: 'delivered' },
    { event: 'cardholder.status_updated', endpoint: 'https://api.theorangecard.com/hooks/cards', delivered: 61, failed: 2, last: '2026-11-27T10:05:00Z', status: 'retrying' },
  ];

  window.Portal.data = Object.assign(window.Portal.data || {}, {
    cards: { NOW, issuers: ISSUERS, countries: COUNTRIES, cardholders, cards, orders, webhooks },
  });
})();
