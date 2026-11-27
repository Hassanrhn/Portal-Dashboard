/*
 * Cardholders: KPI strip + filterable list of people in the card program (issuer is a filter, not a page).
 * Row drawer: profile, KYC timeline (cardholder.status_updated), cards with a freeze switch, order card,
 * edit details and suspend. "Add cardholder" drawer validates and creates a KYC-pending row.
 * URL filters (?issuer=Axys&kyc=pending&q=…) let Issuers and other pages deep-link here.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const { NOW, issuers, countries, cardholders, cards } = Portal.data.cards;
  const $ = (s, scope = document) => scope.querySelector(s);

  const ISSUER_NAMES = issuers.map((i) => i.name);
  const NAME = /^[\p{L}][\p{L}' -]{0,39}$/u;
  const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
  const PHONE = /^[0-9 ]{6,15}$/;
  const MIN_AGE = 18;

  const filters = { q: '', kyc: 'all', issuer: '' };
  const params = new URLSearchParams(window.location.search);
  if (ISSUER_NAMES.includes(params.get('issuer'))) filters.issuer = params.get('issuer');
  if (['verified', 'pending', 'rejected'].includes(params.get('kyc'))) filters.kyc = params.get('kyc');
  if (params.get('q')) filters.q = params.get('q').slice(0, 80);

  const issuerOf = (name) => issuers.find((i) => i.name === name);
  const countryOf = (code) => countries.find((c) => c.code === code);
  const cardsOf = (holder) => cards.filter((c) => c.cardholderId === holder.id);
  const initials = (holder) => `${holder.first[0]}${holder.last[0]}`.toUpperCase();
  const nowIso = () => new Date(NOW).toISOString();

  /* KPIs ---------------------------------------------------------------------- */
  function renderKpis() {
    const total = cardholders.length;
    const count = (kyc) => cardholders.filter((h) => h.kyc === kyc).length;
    const active = cards.filter((c) => c.status === 'active').length;
    const set = (key, value, meta) => { $(`[data-kpi="${key}"]`).textContent = fmt.count(value); $(`[data-kpi-meta="${key}"]`).textContent = meta; };
    set('total', total, `${issuers.filter((i) => i.status === 'connected').length} issuers connected`);
    set('verified', count('verified'), `${Math.round((count('verified') / Math.max(1, total)) * 100)}% of cardholders`);
    set('pending', count('pending'), 'Waiting on issuer review');
    set('cards', active, `${cards.length - active} frozen`);
  }

  Portal.lazy.register('cardholder-kpis', { fetch: () => Portal.request(cardholders), render: renderKpis });

  /* Table --------------------------------------------------------------------------- */
  function emptyState() {
    if (filters.issuer && issuerOf(filters.issuer).status === 'needs_scope') {
      return {
        icon: 'lock', title: `${filters.issuer} needs the Cards scope`,
        text: 'Portal cannot read cardholders from this issuer until its API key has the CARDS scope.',
        action: el('a', { className: 'btn btn--primary', attrs: { href: 'api-keys.html?scope=cards' } }, [iconEl('key'), 'Create key with Cards scope']),
      };
    }
    return { icon: 'search', title: 'No cardholders match these filters', text: 'Try another issuer or clear the filters.', action: btn('Clear filters', { onClick: clearFilters }) };
  }

  const tableHost = $('[data-table]');
  const tableOptions = {
    pageSize: 12,
    onRowClick: openCardholder,
    rowLabel: (h) => `cardholder ${h.name}`,
    empty: emptyState(),
    columns: [
      { label: 'Cardholder', render: (h) => el('span', { className: 'table__lead' }, [
        el('span', { className: 'tile', text: initials(h), attrs: { 'aria-hidden': 'true' } }),
        el('span', {}, [h.name, el('span', { className: 'cell-sub', text: h.email })]),
      ]) },
      { label: 'Issuer', render: (h) => el('span', { className: 'u-muted', text: h.issuer }) },
      { label: 'KYC', render: (h) => (h.status === 'suspended' ? Portal.badge('blocked', 'Suspended') : Portal.badge(h.kyc)) },
      { label: 'Cards', num: true, render: (h) => fmt.count(cardsOf(h).length) },
      { label: 'Created', num: true, render: (h) => el('span', { className: 'u-muted', text: fmt.date(h.created) }) },
    ],
  };
  let table = Portal.dataTable(tableHost, tableOptions);

  function matches(h, { ignoreKyc = false } = {}) {
    const q = filters.q.trim().toLowerCase();
    return (!q || [h.id, h.name, h.email].some((v) => v.toLowerCase().includes(q)))
      && (ignoreKyc || filters.kyc === 'all' || h.kyc === filters.kyc)
      && (!filters.issuer || h.issuer === filters.issuer);
  }

  function rebuildTableForEmptyState() {
    // dataTable reads its empty state once, so rebuild it when the reason for "empty" changes.
    tableHost.replaceChildren();
    table = Portal.dataTable(tableHost, { ...tableOptions, empty: emptyState() });
  }

  let lastEmptyKey = '';
  function apply() {
    const emptyKey = filters.issuer && issuerOf(filters.issuer).status === 'needs_scope' ? 'scope' : 'filters';
    if (emptyKey !== lastEmptyKey) { lastEmptyKey = emptyKey; rebuildTableForEmptyState(); }
    const base = cardholders.filter((h) => matches(h, { ignoreKyc: true }));
    document.querySelectorAll('[data-count]').forEach((node) => {
      const kyc = node.dataset.count;
      node.textContent = fmt.count(kyc === 'all' ? base.length : base.filter((h) => h.kyc === kyc).length);
    });
    table.setRows(base.filter((h) => filters.kyc === 'all' || h.kyc === filters.kyc));
    $('[data-clear]').hidden = !(filters.q || filters.kyc !== 'all' || filters.issuer);
  }

  function syncControls() {
    $('[data-filter="q"]').value = filters.q;
    $('[data-filter="issuer"]').value = filters.issuer;
    $('[data-filter="kyc"]').portalSelect?.(filters.kyc);
  }

  function clearFilters() {
    Object.assign(filters, { q: '', kyc: 'all', issuer: '' });
    syncControls();
    apply();
  }

  let searchTimer;
  $('[data-filter="q"]').addEventListener('input', (event) => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { filters.q = event.target.value; apply(); }, 150);
  });
  $('[data-filter="issuer"]').addEventListener('change', (event) => { filters.issuer = event.target.value; apply(); });
  $('[data-filter="kyc"]').addEventListener('segmented:change', (event) => { filters.kyc = event.detail.value; apply(); });
  $('[data-clear]').addEventListener('click', clearFilters);

  Portal.lazy.register('cardholders', {
    fetch: () => Portal.request(cardholders),
    render: () => { syncControls(); apply(); },
  });

  /* Shared drawer pieces ------------------------------------------------------------ */
  const kv = (pairs) => el('dl', { className: 'kv' }, pairs.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, [v])]));
  const section = (title, children, aside) => el('section', { className: 'drawer__section' }, [
    aside ? el('div', { className: 'field__row' }, [el('h3', { className: 'drawer__section-title', text: title }), aside]) : el('h3', { className: 'drawer__section-title', text: title }),
    ...children,
  ]);

  function field(id, labelText, control, help) {
    return el('div', { className: 'field' }, [
      el('label', { className: 'field__label', text: labelText, attrs: { for: id } }),
      control,
      help && el('p', { className: 'field__help', text: help }),
    ]);
  }

  function timeline(events) {
    return el('ol', { className: 'timeline' }, events.map((e) => el('li', { className: `timeline__item${e.tone ? ` timeline__item--${e.tone}` : ''}` }, [
      el('span', { className: 'timeline__dot', attrs: { 'aria-hidden': 'true' } }),
      el('span', {}, [el('p', { className: 'timeline__title', text: e.title }), el('p', { className: 'timeline__desc', text: e.desc })]),
      el('time', { className: 'timeline__time', text: fmt.dateTime(e.time), attrs: { datetime: e.time } }),
    ])));
  }

  /* Cardholder drawer ------------------------------------------------------------------ */
  function cardRow(card, holder, drawer) {
    const pan = `•••• ${card.last4}`;
    const toggle = el('button', {
      className: 'switch',
      attrs: { type: 'button', role: 'switch', 'aria-checked': String(card.status === 'active'), 'aria-label': `Card ${pan} active` },
      on: { click: () => toggleFreeze(card, holder, drawer) },
    });
    return el('li', { className: 'rows__item' }, [
      el('span', { className: 'table__lead' }, [
        el('span', { className: 'tile', attrs: { 'aria-hidden': 'true' } }, [iconEl(card.type === 'physical' ? 'cards' : 'zap')]),
        el('span', { className: 'rows__main' }, [
          el('span', { className: 'card-row__pan', text: pan }),
          el('span', { className: 'rows__sub', text: `${fmt.humanize(card.type)} · ${card.currency} · limit ${fmt.money(card.limit)} ${card.currency}` }),
        ]),
      ]),
      el('span', { className: 'rows__meta' }, [Portal.badge(card.status), el('span', { className: 'card-row__switch' }, [toggle])]),
    ]);
  }

  async function toggleFreeze(card, holder, drawer) {
    const pan = `•••• ${card.last4}`;
    if (card.status === 'active') {
      const ok = await Portal.confirm({
        title: `Freeze card ${pan}?`, confirmLabel: 'Freeze card', cancelLabel: 'Keep active',
        message: 'New purchases are declined while the card is frozen. You can unfreeze it at any time.',
        details: [['Cardholder', holder.name], ['Issuer', card.issuer], ['Card', `${fmt.humanize(card.type)} ${pan}`]],
      });
      if (!ok) return;
      card.status = 'frozen';
      Portal.toast(`Card ${pan} frozen`, { icon: 'snowflake' });
    } else {
      card.status = 'active';
      Portal.toast(`Card ${pan} unfrozen`);
    }
    drawer.setBody(detailBody(holder, drawer));
    renderKpis();
  }

  function cardsSection(holder, drawer) {
    const list = cardsOf(holder);
    const order = holder.kyc === 'verified' && holder.status !== 'suspended'
      ? el('a', { className: 'btn btn--sm', attrs: { href: `card-orders.html?new=1&cardholder=${encodeURIComponent(holder.id)}` } }, [iconEl('plus'), 'Order card'])
      : null;
    const content = list.length
      ? el('ul', { className: 'rows' }, list.map((c) => cardRow(c, holder, drawer)))
      : el('div', { className: 'empty' }, [
        el('span', { className: 'empty__icon' }, [iconEl('cards')]),
        el('p', { className: 'empty__title', text: 'No cards yet' }),
        el('p', { className: 'empty__text', text: holder.kyc === 'verified' ? 'Order a virtual or physical card for this cardholder.' : 'Cards can be ordered once KYC is verified.' }),
      ]);
    return section('Cards', [content], order);
  }

  function detailBody(holder, drawer) {
    const country = countryOf(holder.country);
    return [
      holder.status === 'suspended' ? el('div', { className: 'note note--danger' }, [iconEl('lock'), el('span', { text: 'This cardholder is suspended. Their cards decline every purchase.' })]) : null,
      holder.kyc === 'rejected' ? el('div', { className: 'note note--danger' }, [iconEl('x-circle'), el('span', {}, [el('b', { text: 'KYC rejected: ' }), 'the issuer could not verify the identity document. Ask the cardholder to resubmit.'])]) : null,
      section('Profile', [kv([
        ['Cardholder ID', Portal.copyable(holder.id)],
        ['Email', holder.email],
        ['Phone', holder.phone],
        ['Country', country ? country.name : holder.country],
        ['Issuer', `${holder.issuer} · ${issuerOf(holder.issuer).program}`],
        ['Created', fmt.dateTime(holder.created)],
      ])]),
      section('KYC', [timeline(holder.events)], el('a', { className: 'btn btn--ghost btn--sm', attrs: { href: 'webhooks.html' } }, ['Webhooks', iconEl('arrow-right')])),
      cardsSection(holder, drawer),
    ];
  }

  function footerFor(holder, drawer) {
    const menu = Portal.menu.button(() => [
      { label: 'Edit details', icon: 'edit', description: 'Change email or phone', onSelect: () => editForm(holder, drawer) },
      'separator',
      { label: 'Suspend cardholder', icon: 'lock', tone: 'danger', description: 'Decline all purchases on every card', disabled: holder.status === 'suspended', onSelect: () => suspend(holder, drawer) },
    ]);
    return [menu, el('span', { className: 'toolbar__spacer' }), btn('Close', { attrs: { 'data-dialog-close': '' } })];
  }

  function showDetail(holder, drawer) {
    drawer.setTitle(holder.name);
    drawer.setBody(detailBody(holder, drawer));
    drawer.setFooter(footerFor(holder, drawer));
  }

  function openCardholder(holder) {
    const drawer = Portal.drawer.open({ title: holder.name, subtitle: `${holder.email} · ${holder.issuer}` });
    showDetail(holder, drawer);
  }

  async function suspend(holder, drawer) {
    const ok = await Portal.confirm({
      title: `Suspend ${holder.name}?`, tone: 'danger', confirmLabel: 'Suspend cardholder', cancelLabel: 'Keep active',
      message: 'Every card for this cardholder declines purchases until the issuer reinstates them.',
      details: [['Cardholder ID', holder.id], ['Issuer', holder.issuer], ['Cards affected', String(cardsOf(holder).length)]],
    });
    if (!ok) return;
    holder.status = 'suspended';
    cardsOf(holder).forEach((c) => { c.status = 'frozen'; });
    holder.events.push({ title: 'Cardholder suspended', desc: 'cardholder.status_updated · suspended from Portal by pocket@pocket.com', time: nowIso(), tone: 'danger' });
    showDetail(holder, drawer);
    apply();
    renderKpis();
    Portal.toast(`${holder.name} suspended`, { icon: 'lock' });
  }

  function editForm(holder, drawer) {
    const email = el('input', { className: 'input', attrs: { id: 'ed-email', type: 'email', value: holder.email, maxlength: '254', inputmode: 'email', autocomplete: 'off' } });
    const phone = el('input', { className: 'input', attrs: { id: 'ed-phone', type: 'tel', value: holder.phone, maxlength: '20', inputmode: 'tel' } });
    drawer.setTitle(`Edit ${holder.name}`);
    drawer.setBody([
      el('p', { className: 't-meta', text: `Name, date of birth and country come from KYC and can only change through ${holder.issuer}.` }),
      el('div', { className: 'form-grid' }, [field('ed-email', 'Email', email), field('ed-phone', 'Phone', phone, 'Include the country code, for example +971 50 123 4567.')]),
    ]);
    drawer.setFooter([
      btn('Back', { onClick: () => showDetail(holder, drawer) }),
      btn('Save changes', { variant: 'primary', onClick: () => {
        const okEmail = Portal.fieldError(email, EMAIL.test(email.value.trim()) ? '' : 'Enter a valid email address.');
        const okPhone = Portal.fieldError(phone, /^\+\d{1,4} [0-9 ]{6,15}$/.test(phone.value.trim()) ? '' : 'Enter a phone number with its country code.');
        if (!okEmail || !okPhone) return;
        holder.email = email.value.trim().toLowerCase();
        holder.phone = phone.value.trim();
        showDetail(holder, drawer);
        apply();
        Portal.toast('Cardholder details saved');
      } }),
    ]);
    email.focus();
  }

  /* Add cardholder drawer --------------------------------------------------------------- */
  function ageOn(dob, now) {
    const birth = new Date(`${dob}T00:00:00Z`);
    const today = new Date(now);
    let age = today.getUTCFullYear() - birth.getUTCFullYear();
    if (today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age -= 1;
    return age;
  }

  function addCardholder() {
    const maxDob = new Date(NOW).toISOString().slice(0, 10);
    const text = (id, attrs = {}) => el('input', { className: 'input', attrs: { id, type: 'text', maxlength: '40', autocomplete: 'off', ...attrs } });
    const first = text('ac-first');
    const last = text('ac-last');
    const email = text('ac-email', { type: 'email', maxlength: '254', inputmode: 'email' });
    const dial = el('select', { className: 'select', attrs: { id: 'ac-dial', 'aria-label': 'Country code' } }, countries.map((c) => el('option', { text: `${c.code} ${c.dial}`, attrs: { value: c.dial } })));
    const phone = text('ac-phone', { type: 'tel', maxlength: '15', inputmode: 'tel', placeholder: '50 123 4567' });
    const dob = el('input', { className: 'input', attrs: { id: 'ac-dob', type: 'date', max: maxDob, min: '1900-01-01' } });
    const country = el('select', { className: 'select select--block', attrs: { id: 'ac-country' } }, [
      el('option', { text: 'Select a country', attrs: { value: '' } }),
      ...countries.map((c) => el('option', { text: c.name, attrs: { value: c.code } })),
    ]);
    const issuer = el('select', { className: 'select select--block', attrs: { id: 'ac-issuer' } }, issuers.map((i) => el('option', {
      text: i.status === 'connected' ? `${i.name} · ${i.program}` : `${i.name} (needs Cards scope)`,
      attrs: { value: i.name, disabled: i.status !== 'connected' },
    })));
    if (filters.issuer && issuerOf(filters.issuer).status === 'connected') issuer.value = filters.issuer;
    country.addEventListener('change', () => { const c = countryOf(country.value); if (c) dial.value = c.dial; });

    const drawer = Portal.drawer.open({ title: 'Add cardholder', subtitle: 'The issuer runs KYC after you submit' });
    drawer.setBody([
      el('div', { className: 'form-grid form-grid--2' }, [
        field('ac-first', 'First name', first),
        field('ac-last', 'Last name', last),
        el('div', { className: 'span-2' }, [field('ac-email', 'Email', email)]),
        el('div', { className: 'span-2' }, [field('ac-phone', 'Phone', el('div', { className: 'phone-row' }, [dial, phone]))]),
        field('ac-dob', 'Date of birth', dob, `Cardholders must be ${MIN_AGE} or older.`),
        field('ac-country', 'Country of residence', country),
        el('div', { className: 'span-2' }, [field('ac-issuer', 'Issuer', issuer, 'Interlace is unavailable until its API key has the CARDS scope.')]),
      ]),
    ]);
    drawer.setFooter([
      btn('Cancel', { attrs: { 'data-dialog-close': '' } }),
      btn('Add cardholder', { variant: 'primary', onClick: () => submit() }),
    ], 'KYC starts as pending');
    first.focus();

    function validate() {
      const age = dob.value ? ageOn(dob.value, NOW) : NaN;
      const checks = [
        Portal.fieldError(first, NAME.test(first.value.trim()) ? '' : 'Enter a first name using letters only.'),
        Portal.fieldError(last, NAME.test(last.value.trim()) ? '' : 'Enter a last name using letters only.'),
        Portal.fieldError(email, !EMAIL.test(email.value.trim()) ? 'Enter a valid email address.'
          : cardholders.some((h) => h.email === email.value.trim().toLowerCase()) ? 'A cardholder with this email already exists.' : ''),
        Portal.fieldError(phone, PHONE.test(phone.value.trim()) ? '' : 'Enter 6 to 15 digits, without the country code.'),
        Portal.fieldError(dob, !dob.value || Number.isNaN(age) || age > 120 ? 'Enter a date of birth.' : age < MIN_AGE ? `Cardholders must be ${MIN_AGE} or older.` : ''),
        Portal.fieldError(country, country.value ? '' : 'Select a country.'),
        Portal.fieldError(issuer, issuerOf(issuer.value)?.status === 'connected' ? '' : 'Select a connected issuer.'),
      ];
      const firstInvalid = [first, last, email, phone, dob, country, issuer][checks.indexOf(false)];
      firstInvalid?.focus();
      return !firstInvalid;
    }

    async function submit() {
      if (!validate()) return;
      const button = drawer.el.querySelector('.drawer__foot .btn--primary');
      button.setAttribute('aria-busy', 'true');
      const id = `ch_${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
      const holder = {
        id, first: first.value.trim(), last: last.value.trim(), name: `${first.value.trim()} ${last.value.trim()}`,
        email: email.value.trim().toLowerCase(), phone: `${dial.value} ${phone.value.trim()}`, country: country.value,
        issuer: issuer.value, kyc: 'pending', status: 'active', created: nowIso(),
        events: [
          { title: 'Cardholder created', desc: 'Added from Portal by pocket@pocket.com', time: nowIso(), tone: '' },
          { title: 'KYC pending', desc: 'cardholder.status_updated · waiting for document review', time: nowIso(), tone: 'warning' },
        ],
      };
      await Portal.request(holder, { delay: 500 });
      cardholders.unshift(holder);
      drawer.close();
      apply();
      renderKpis();
      Portal.toast(`${holder.name} added. KYC is pending.`);
    }
  }

  $('[data-add-cardholder]').addEventListener('click', addCardholder);

  /* Search palette entries + deep link to a cardholder ------------------------------------ */
  Portal.searchIndex = cardholders.slice(0, 40).map((h) => ({ label: h.name, hint: `${h.email} · ${h.issuer}`, run: () => openCardholder(h) }));
  const deepLink = params.get('cardholder');
  if (deepLink) {
    const target = cardholders.find((h) => h.id === deepLink);
    if (target) window.setTimeout(() => openCardholder(target), 400);
  }
})();
