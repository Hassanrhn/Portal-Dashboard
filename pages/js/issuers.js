/*
 * Issuers: one card per card issuer (Axys, Hypercard, Interlace) with connection status, program stats,
 * last webhook and subscribed events. Actions: Test connection, View cardholders (cardholders.html?issuer=X)
 * and Disconnect (danger confirm). An issuer whose key lacks the CARDS scope explains why and links to
 * api-keys.html?scope=cards. Below, the two card webhook events with their delivery health.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const { NOW, issuers, cardholders, cards, orders, webhooks } = Portal.data.cards;
  const $ = (s, scope = document) => scope.querySelector(s);

  const DAYS_30 = 30 * 86400000;
  const NETWORK_LABEL = { visa: 'Visa', mastercard: 'Mastercard' };
  const STATUS_LABEL = { connected: 'Connected', needs_scope: 'Needs Cards scope', disconnected: 'Disconnected' };
  const SCOPE_ERROR = 'The key authenticates, but the issuer API answered 403 insufficient_scope: CARDS is missing.';

  // Per-issuer UI state that is not part of the issuer record.
  const testResults = new Map(); // name → { ok, time }

  /* Issuer cards ------------------------------------------------------------- */
  function statsFor(issuer) {
    if (issuer.status === 'needs_scope') return null;
    const holders = cardholders.filter((h) => h.issuer === issuer.name);
    return {
      cardholders: holders.length,
      active: cards.filter((c) => c.issuer === issuer.name && c.status === 'active').length,
      orders: orders.filter((o) => o.issuer === issuer.name && NOW - new Date(o.created).getTime() <= DAYS_30).length,
    };
  }

  function networkMark(network) {
    const mark = iconEl(network, 'network-mark');
    mark.setAttribute('role', 'img');
    mark.setAttribute('aria-label', NETWORK_LABEL[network]);
    mark.removeAttribute('aria-hidden');
    return mark;
  }

  function stat(label, value) {
    return el('div', { className: 'issuer__stat' }, [
      el('span', { className: 'issuer__stat-label', text: label }),
      el('span', { className: 'issuer__stat-value', text: value === null ? '—' : fmt.count(value) }),
    ]);
  }

  function scopeNote(issuer) {
    return el('div', { className: 'note issuer__note' }, [
      el('span', { text: `The API key connected to ${issuer.name} does not have the CARDS scope, so Portal cannot read its cardholders, cards or orders, and no card webhooks are sent. Create a key with the Cards scope, then reconnect.` }),
      el('a', { className: 'btn btn--primary btn--sm', attrs: { href: 'api-keys.html?scope=cards' } }, [iconEl('key'), 'Create key with Cards scope']),
    ]);
  }

  function testNote(issuer) {
    const result = testResults.get(issuer.name);
    if (!result || result.ok) return null;
    return el('div', { className: 'note note--danger', attrs: { role: 'alert' } }, [iconEl('x-circle'), el('span', {}, [el('b', { text: 'Connection test failed. ' }), SCOPE_ERROR])]);
  }

  function lastWebhook(issuer) {
    if (!issuer.lastWebhook) return 'Never received';
    return `${fmt.relative(issuer.lastWebhook, NOW)} · ${fmt.dateTime(issuer.lastWebhook)}`;
  }

  function issuerCard(issuer) {
    const stats = statsFor(issuer);
    const result = testResults.get(issuer.name);
    const body = el('div', { className: 'card__body issuer__body' }, [
      el('div', { className: 'issuer__stats' }, [
        stat('Cardholders', stats && stats.cardholders),
        stat('Active cards', stats && stats.active),
        stat('30-day orders', stats && stats.orders),
      ]),
      el('div', { className: 'issuer__meta' }, [
        el('span', { className: 'issuer__meta-label', text: 'Currencies' }),
        el('div', { className: 'chips' }, issuer.currencies.map((c) => el('span', { className: 'chip', text: c }))),
      ]),
      el('div', { className: 'issuer__meta' }, [
        el('span', { className: 'issuer__meta-label', text: 'Last webhook received' }),
        el('span', { text: lastWebhook(issuer) }),
      ]),
      el('div', { className: 'issuer__meta' }, [
        el('span', { className: 'issuer__meta-label', text: 'Subscribed events' }),
        issuer.events.length
          ? el('div', { className: 'chips' }, issuer.events.map((e) => el('span', { className: 'chip chip--mono', text: e })))
          : el('span', { className: 'u-muted', text: 'None until the key has the CARDS scope' }),
      ]),
      result?.ok ? el('div', { className: 'note note--success' }, [iconEl('check-circle'), el('span', { text: `Connection OK · checked ${fmt.time(result.time)} UTC` })]) : null,
      testNote(issuer),
      issuer.status === 'needs_scope' ? scopeNote(issuer) : null,
      issuer.status === 'disconnected' ? el('div', { className: 'note note--danger' }, [iconEl('power'), el('span', { text: 'Disconnected. Existing cards keep working at the issuer, but Portal no longer receives updates.' })]) : null,
    ]);

    const actions = issuer.status === 'disconnected'
      ? [btn('Reconnect', { variant: 'primary', size: 'sm', iconName: 'link', onClick: (event) => reconnect(issuer, event.currentTarget) })]
      : [
        btn('Test connection', { size: 'sm', iconName: 'zap', onClick: (event) => testConnection(issuer, event.currentTarget) }),
        el('a', { className: 'btn btn--sm', attrs: { href: `cardholders.html?issuer=${encodeURIComponent(issuer.name)}` } }, ['View cardholders', iconEl('arrow-right')]),
      ];

    return el('article', { className: 'card issuer', attrs: { 'aria-labelledby': `issuer-${issuer.name}` } }, [
      el('div', { className: 'card__head' }, [
        el('div', { className: 'table__lead' }, [
          networkMark(issuer.network),
          el('div', {}, [
            el('h2', { className: 'card__title', text: issuer.name, attrs: { id: `issuer-${issuer.name}` } }),
            el('p', { className: 'issuer__program', text: issuer.program }),
          ]),
        ]),
        el('div', { className: 'issuer__head-meta' }, [Portal.badge(issuer.status, STATUS_LABEL[issuer.status]), issuerMenu(issuer)]),
      ]),
      body,
      el('div', { className: 'issuer__actions' }, actions),
    ]);
  }

  function issuerMenu(issuer) {
    const items = [
      { label: 'View card orders', icon: 'truck', description: `Orders placed with ${issuer.name}`, onSelect: () => { window.location.href = `card-orders.html?issuer=${encodeURIComponent(issuer.name)}`; } },
    ];
    if (issuer.status !== 'disconnected') items.push('separator', { label: 'Disconnect', icon: 'power', tone: 'danger', description: 'Stop syncing this issuer', onSelect: () => disconnect(issuer) });
    return Portal.menu.button(items, `More actions for ${issuer.name}`);
  }

  function renderIssuers() {
    $('[data-issuers]').replaceChildren(...issuers.map(issuerCard));
  }

  Portal.lazy.register('issuers', { fetch: () => Portal.request(issuers), render: renderIssuers });

  /* Issuer actions --------------------------------------------------------------- */
  async function testConnection(issuer, button) {
    button.setAttribute('aria-busy', 'true');
    await Portal.request(null, { delay: 900 });
    button.removeAttribute('aria-busy');
    const ok = issuer.status === 'connected';
    testResults.set(issuer.name, { ok, time: new Date(NOW).toISOString() });
    renderIssuers();
    if (ok) Portal.toast(`${issuer.name} connection OK`);
    else Portal.toast(`${issuer.name} test failed: missing CARDS scope`, { icon: 'alert' });
  }

  async function disconnect(issuer) {
    const ok = await Portal.confirm({
      title: `Disconnect ${issuer.name}?`, tone: 'danger', confirmLabel: 'Disconnect', cancelLabel: 'Stay connected',
      message: 'Portal stops syncing cardholders, cards and orders from this issuer, and card webhooks stop. Cards already issued keep working.',
      details: [['Issuer', issuer.name], ['Program', issuer.program], ['Cardholders', String(cardholders.filter((h) => h.issuer === issuer.name).length)]],
    });
    if (!ok) return;
    issuer.previousStatus = issuer.status;
    issuer.status = 'disconnected';
    testResults.delete(issuer.name);
    renderIssuers();
    Portal.toast(`${issuer.name} disconnected`, { icon: 'power' });
  }

  async function reconnect(issuer, button) {
    button.setAttribute('aria-busy', 'true');
    await Portal.request(null, { delay: 800 });
    issuer.status = issuer.previousStatus || 'connected';
    renderIssuers();
    Portal.toast(`${issuer.name} reconnected`);
  }

  /* Card webhooks ------------------------------------------------------------------- */
  function webhookRow(w) {
    const healthy = w.failed === 0;
    return el('li', { className: 'rows__item' }, [
      el('span', { className: 'rows__main' }, [
        el('span', { className: 'u-mono', text: w.event }),
        el('span', { className: 'rows__sub' }, [Portal.copyable(w.endpoint, { mono: false, label: 'Copy endpoint URL' }), `last ${fmt.relative(w.last, NOW)}`]),
      ]),
      el('span', { className: 'rows__meta' }, [
        el('span', { className: 'u-muted', text: `${fmt.count(w.delivered)} delivered · ${fmt.count(w.failed)} failed` }),
        Portal.badge(healthy ? 'delivered' : 'retrying', healthy ? 'Healthy' : 'Retrying'),
        el('a', { className: 'btn btn--ghost btn--sm btn--icon', attrs: { href: `webhooks.html?event=${encodeURIComponent(w.event)}`, 'aria-label': `Open deliveries for ${w.event}` } }, [iconEl('chevron-right')]),
      ]),
    ]);
  }

  Portal.lazy.register('card-webhooks', {
    fetch: () => Portal.request(webhooks),
    render: () => $('[data-webhooks]').replaceChildren(...webhooks.map(webhookRow)),
  });

  /* Search palette entries ------------------------------------------------------------ */
  Portal.searchIndex = issuers.map((i) => ({ label: `${i.name} cardholders`, hint: STATUS_LABEL[i.status], run: () => { window.location.href = `cardholders.html?issuer=${encodeURIComponent(i.name)}`; } }));
})();
