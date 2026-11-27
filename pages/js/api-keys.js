/*
 * API keys: Live/Test filtered key list with scopes, offering restrictions, created and last-used dates.
 * Create key drawer (name, environment, scopes, offerings, IP allowlist) → reveal-once secret dialog.
 * Each row has one overflow menu: rename, rotate secret (24 h overlap, reveal once) and revoke (danger confirm).
 * Secrets are generated with crypto.getRandomValues, never stored, never put in the URL or the DOM after Done.
 * ?scope=cards opens the create drawer with the Cards scope preselected (linked from the card pages).
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const keys = Portal.data.apiKeys;
  const OFFERINGS = Portal.data.offerings;
  const NOW = Date.UTC(2026, 10, 27, 12);
  const $ = (s, scope = document) => scope.querySelector(s);

  const SCOPES = [
    { id: 'payments', label: 'Payments', desc: 'Create and read pay-ins, payouts, refunds and cancellations.' },
    { id: 'cards', label: 'Cards', desc: 'Manage cardholders, cards and card orders with Axys, Hypercard and Interlace.' },
    { id: 'reports', label: 'Reports read', desc: 'Download statements and exports. Read only.' },
  ];
  const SCOPE_LABEL = Object.fromEntries(SCOPES.map((s) => [s.id, s.label]));
  const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const SECRET_LENGTH = 40;
  const NAME_MAX = 60;
  const IP_PATTERN = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\/(3[0-2]|[12]?\d))?$/;

  const filters = { env: 'live', q: '' };
  const params = new URLSearchParams(window.location.search);

  /* Secrets and masking ---------------------------------------------------------------- */
  /** Unbiased random string from ALPHABET using crypto.getRandomValues (rejection sampling). */
  function randomString(length, alphabet = ALPHABET) {
    const limit = 256 - (256 % alphabet.length);
    let out = '';
    while (out.length < length) {
      const bytes = crypto.getRandomValues(new Uint8Array(length));
      bytes.forEach((b) => { if (b < limit && out.length < length) out += alphabet[b % alphabet.length]; });
    }
    return out;
  }
  const newKeyId = (env) => `pk_${env}_${randomString(12, '0123456789abcdef')}`;
  const maskId = (id) => `${id.slice(0, id.lastIndexOf('_') + 1)}…${id.slice(-4)}`;

  /** Masked key ID with a copy button that copies the key ID (never the secret). */
  function keyIdCell(id) {
    const button = el('button', { className: 'copy__btn', attrs: { type: 'button', 'data-copy': id, 'aria-label': `Copy key ID ${id}` } }, [iconEl('copy', 'icon-copy'), iconEl('check', 'icon-check')]);
    return el('span', { className: 'copy' }, [el('span', { className: 'u-mono', text: maskId(id), attrs: { title: id } }), button]);
  }

  /* Small dialogs (reveal once, rename) ----------------------------------------------------- */
  function openDialog({ title, body, footer, locked = () => false }) {
    const titleId = `dlg-${randomString(6, 'abcdefghij')}`;
    const dialog = el('dialog', { className: 'dialog', attrs: { 'aria-labelledby': titleId } }, [
      el('div', { className: 'dialog__head' }, [el('h2', { className: 'dialog__title', text: title, attrs: { id: titleId } })]),
      el('div', { className: 'dialog__body' }, body),
      el('div', { className: 'dialog__foot' }, footer),
    ]);
    // Esc and backdrop clicks are ignored while locked (the secret has not been acknowledged yet).
    const guard = (event) => {
      if (event.target !== dialog || !locked()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      Portal.toast('Confirm you have stored the secret first', { icon: 'alert' });
    };
    window.addEventListener('cancel', guard, true);
    dialog.addEventListener('click', guard);
    dialog.addEventListener('close', () => { window.removeEventListener('cancel', guard, true); dialog.remove(); });
    document.body.appendChild(dialog);
    Portal.dialog.open(dialog);
    return dialog;
  }

  /** Shows a full secret once. Done stays disabled until the user confirms they stored it. */
  function revealSecret({ title, intro, secret }) {
    const field = el('input', { className: 'input input--mono', attrs: { id: 'reveal-secret', readonly: true, value: secret, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Secret key' } });
    // Shared copy button and animation; the toast never echoes the secret.
    const copy = el('button', {
      className: 'copy__btn', attrs: { type: 'button', 'data-copy': secret, 'data-copy-toast': 'Secret copied to the clipboard', 'aria-label': 'Copy secret key' },
    }, [iconEl('copy', 'icon-copy'), iconEl('check', 'icon-check')]);
    const ack = el('input', { attrs: { type: 'checkbox', id: 'reveal-ack' } });
    const done = btn('Done', { variant: 'primary', attrs: { disabled: true }, onClick: () => Portal.dialog.close(dialog) });
    ack.addEventListener('change', () => { done.disabled = !ack.checked; });
    const dialog = openDialog({
      title,
      locked: () => !ack.checked,
      body: [el('div', { className: 'stack--tight' }, [
        el('p', { text: intro }),
        el('div', { className: 'input-group input-group--trailing' }, [field, el('span', { className: 'input-group__action' }, [copy])]),
        el('p', { className: 'banner' }, [iconEl('alert'), el('span', { text: 'This secret will not be shown again. Store it in your secret manager now. If you lose it, rotate the key.' })]),
        el('label', { className: 'check' }, [ack, el('span', { text: "I've stored this secret safely" })]),
      ])],
      footer: [done],
    });
    dialog.addEventListener('close', () => { field.value = ''; copy.removeAttribute('data-copy'); });
    field.addEventListener('focus', () => field.select());
  }

  /* Table ------------------------------------------------------------------------------- */
  const table = Portal.dataTable($('[data-table]'), {
    pageSize: 10,
    rowLabel: (k) => `key ${k.name}`,
    empty: { icon: 'key', title: 'No keys here yet', text: 'Create a key to call the API from your server. Start with a Test key.', action: btn('Create key', { variant: 'primary', iconName: 'plus', onClick: () => openCreate() }) },
    columns: [
      { label: 'Name', render: (k) => el('span', {}, [k.name, k.ips.length ? el('span', { className: 'cell-sub', text: `${k.ips.length} allowed IP ${k.ips.length === 1 ? 'range' : 'ranges'}` }) : null]) },
      { label: 'Key ID', render: (k) => keyIdCell(k.id) },
      { label: 'Scopes', render: (k) => el('span', { className: 'chips' }, k.scopes.map((s) => el('span', { className: 'chip', text: SCOPE_LABEL[s] }))) },
      { label: 'Offerings', render: (k) => el('span', { className: k.offerings.length ? '' : 'u-muted', text: k.offerings.length ? `${k.offerings.length} restricted` : 'All' }) },
      { label: 'Created', render: (k) => el('span', { className: 'u-muted', text: fmt.date(k.created) }) },
      { label: 'Last used', render: (k) => el('span', { className: 'u-muted', text: k.lastUsed ? fmt.relative(k.lastUsed) : 'Never', attrs: { title: k.lastUsed ? `${fmt.dateTime(k.lastUsed)} UTC` : null } }) },
      { label: 'Status', render: (k) => Portal.badge(k.status) },
      { label: 'Actions', className: 'cell-actions', render: rowMenu },
    ],
  });

  function rowMenu(k) {
    const trigger = Portal.menu.button([
      { label: 'Rename', icon: 'edit', description: 'Change the label your team sees', onSelect: () => renameKey(k) },
      { label: 'Rotate secret', icon: 'rotate', description: 'Old secret works for 24 hours more', onSelect: () => rotateKey(k) },
      'separator',
      { label: 'Revoke', icon: 'trash', tone: 'danger', description: 'Requests fail immediately', onSelect: () => revokeKey(k) },
    ], `Actions for ${k.name}`);
    if (k.status === 'revoked') trigger.disabled = true;
    return trigger;
  }

  function matches(k) {
    const q = filters.q.trim().toLowerCase();
    return !q || k.name.toLowerCase().includes(q) || k.id.toLowerCase().includes(q);
  }

  function apply() {
    const visible = keys.filter(matches);
    document.querySelectorAll('[data-count]').forEach((node) => { node.textContent = fmt.count(visible.filter((k) => k.env === node.dataset.count).length); });
    const rows = visible.filter((k) => k.env === filters.env).sort((a, b) => (a.status === 'revoked') - (b.status === 'revoked') || b.created.localeCompare(a.created));
    $('[data-active-count]').textContent = `${rows.filter((k) => k.status === 'active').length} active`;
    table.setRows(rows);
  }

  let searchTimer;
  $('[data-filter="q"]').addEventListener('input', (event) => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { filters.q = event.target.value; apply(); }, 150);
  });
  $('[data-filter="env"]').addEventListener('segmented:change', (event) => { filters.env = event.detail.value; apply(); });

  Portal.lazy.register('keys', {
    fetch: () => Portal.request(keys),
    render: () => {
      filters.env = document.documentElement.dataset.env === 'test' ? 'test' : 'live';
      $('[data-filter="env"]').portalSelect?.(filters.env);
      apply();
    },
  });

  /* Create key drawer --------------------------------------------------------------------- */
  const field = (label, control, help, forId) => el('div', { className: 'field' }, [
    el('label', { className: 'field__label', text: label, attrs: { for: forId || control.id } }),
    control,
    help ? el('p', { className: 'field__help', text: help }) : null,
  ]);

  function radioCard(name, value, title, desc, checked) {
    return el('label', { className: 'radio-card' }, [
      el('input', { attrs: { type: 'radio', name, value, checked } }),
      el('span', { className: 'radio-card__body' }, [el('span', { className: 'radio-card__title', text: title }), el('span', { className: 'radio-card__desc', text: desc })]),
      el('span', { className: 'radio-card__dot', attrs: { 'aria-hidden': 'true' } }),
    ]);
  }

  function checkOption(name, value, title, desc, checked) {
    return el('label', { className: 'check' }, [
      el('input', { attrs: { type: 'checkbox', name, value, checked } }),
      el('span', { className: 'check__text' }, [el('span', { className: title.includes('.') ? 'u-mono' : '', text: title }), desc ? el('span', { className: 'check__desc', text: desc }) : null]),
    ]);
  }

  function group(labelText, id, children) {
    return el('div', { className: 'field', attrs: { role: 'group', 'aria-labelledby': id } }, [el('p', { className: 'field__label', text: labelText, attrs: { id } }), ...children]);
  }

  /** Returns the lines of the allowlist that are not IPv4 addresses or CIDR ranges. */
  const invalidIps = (lines) => lines.filter((line) => !IP_PATTERN.test(line));

  function openCreate({ preselect = [] } = {}) {
    const name = el('input', { className: 'input', attrs: { id: 'ck-name', maxlength: String(NAME_MAX), autocomplete: 'off', placeholder: 'Production checkout', required: true } });
    const envCards = el('div', { className: 'radio-cards radio-cards--2', attrs: { role: 'radiogroup', 'aria-label': 'Environment' } }, [
      radioCard('ck-env', 'test', 'Test (recommended)', 'Test data only. No real money moves.', true),
      radioCard('ck-env', 'live', 'Live', 'Real payments and cards.', false),
    ]);
    const scopeList = el('div', { className: 'stack stack--tight' }, SCOPES.map((s) => checkOption('ck-scope', s.id, s.label, s.desc, s.id === 'payments' || preselect.includes(s.id))));
    const offeringList = el('div', { className: 'offering-list', attrs: { id: 'ck-offerings', hidden: true } }, OFFERINGS.map((o) => checkOption('ck-offering', o, o)));
    const restrict = el('input', { attrs: { type: 'checkbox', id: 'ck-restrict', 'aria-controls': 'ck-offerings', 'aria-expanded': 'false' } });
    restrict.addEventListener('change', () => { offeringList.hidden = !restrict.checked; restrict.setAttribute('aria-expanded', String(restrict.checked)); });
    const ips = el('textarea', { className: 'input textarea input--mono', attrs: { id: 'ck-ips', rows: '3', maxlength: '1000', autocomplete: 'off', spellcheck: 'false', placeholder: '34.120.18.0/24\n52.14.201.7' } });

    const drawer = Portal.drawer.open({
      title: 'Create API key',
      subtitle: 'The secret is shown once after you create the key.',
    });
    drawer.setBody([
      preselect.includes('cards') ? el('p', { className: 'note' }, [iconEl('cards'), el('span', { text: 'Needed for the card program. Cards is preselected so this key can reach cardholders, cards and card orders.' })]) : null,
      el('div', { className: 'form-grid' }, [
        field('Name', name, 'Only your team sees this. Up to 60 characters.'),
        group('Environment', 'ck-env-label', [envCards]),
        group('Scopes', 'ck-scope-label', [scopeList]),
        el('div', { className: 'field' }, [
          el('label', { className: 'check' }, [restrict, el('span', { className: 'check__text' }, [el('span', { text: 'Restrict to offerings' }), el('span', { className: 'check__desc', text: 'Optional. Without a restriction the key reaches every offering its scopes allow.' })])]),
          offeringList,
        ]),
        field('IP allowlist (optional)', ips, 'One IPv4 address or CIDR range per line. Leave empty to allow any IP.'),
      ]),
    ]);
    drawer.setFooter([
      btn('Cancel', { attrs: { 'data-dialog-close': '' } }),
      btn('Create key', { variant: 'primary', onClick: () => submitCreate(drawer, { name, ips, restrict }) }),
    ]);
    window.setTimeout(() => name.focus(), 50);
  }

  function submitCreate(drawer, { name, ips, restrict }) {
    const form = drawer.body;
    const scopes = [...form.querySelectorAll('[name="ck-scope"]:checked')].map((i) => i.value);
    const offerings = restrict.checked ? [...form.querySelectorAll('[name="ck-offering"]:checked')].map((i) => i.value) : [];
    const ipLines = ips.value.split('\n').map((l) => l.trim()).filter(Boolean);
    const badIps = invalidIps(ipLines);
    const label = name.value.trim();

    const checks = [
      Portal.fieldError(name, label ? '' : 'Enter a name so your team can tell keys apart.'),
      Portal.fieldError(form.querySelector('[name="ck-scope"]'), scopes.length ? '' : 'Choose at least one scope.'),
      Portal.fieldError(restrict, !restrict.checked || offerings.length ? '' : 'Choose at least one offering, or turn off the restriction.'),
      Portal.fieldError(ips, badIps.length ? `Not an IPv4 address or CIDR range: ${badIps[0].slice(0, 40)}` : ''),
    ];
    if (checks.includes(false)) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }

    const env = form.querySelector('[name="ck-env"]:checked').value;
    const key = { id: newKeyId(env), name: label, env, scopes, offerings, ips: ipLines, created: new Date(NOW).toISOString(), lastUsed: null, status: 'active' };
    keys.unshift(key);
    drawer.close();
    filters.env = env;
    $('[data-filter="env"]').portalSelect?.(env);
    apply();
    revealSecret({ title: `Key created: ${label}`, intro: `Use this as the X-Api-Key header for ${env === 'test' ? 'Test' : 'Live'} requests.`, secret: `${key.id}.${randomString(SECRET_LENGTH)}` });
  }

  /* Row actions ---------------------------------------------------------------------------- */
  function renameKey(k) {
    const input = el('input', { className: 'input', attrs: { id: 'rn-name', value: k.name, maxlength: String(NAME_MAX), autocomplete: 'off', placeholder: 'Production checkout' } });
    const save = () => {
      const value = input.value.trim();
      if (!Portal.fieldError(input, value ? '' : 'Enter a name.')) { input.focus(); return; }
      k.name = value;
      Portal.dialog.close(dialog);
      apply();
      Portal.toast('Key renamed');
    };
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') save(); });
    const dialog = openDialog({
      title: 'Rename key',
      body: [el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Name', attrs: { for: 'rn-name' } }), input, el('p', { className: 'field__help', text: `Key ID ${maskId(k.id)} does not change.` })])],
      footer: [btn('Cancel', { attrs: { 'data-dialog-close': '' } }), btn('Save', { variant: 'primary', onClick: save })],
    });
    input.select();
  }

  const lastUsedText = (k) => (k.lastUsed ? `${fmt.relative(k.lastUsed)} (${fmt.dateTime(k.lastUsed)} UTC)` : 'Never');

  async function rotateKey(k) {
    const ok = await Portal.confirm({
      title: `Rotate the secret for ${k.name}?`,
      confirmLabel: 'Rotate secret',
      message: 'A new secret is created now. The old secret keeps working for 24 hours so you can deploy the new one, then it stops working.',
      details: [['Key ID', maskId(k.id)], ['Last used', lastUsedText(k)]],
    });
    if (!ok) return;
    revealSecret({ title: `New secret for ${k.name}`, intro: 'The old secret stops working in 24 hours. The key ID stays the same.', secret: `${k.id}.${randomString(SECRET_LENGTH)}` });
  }

  async function revokeKey(k) {
    const ok = await Portal.confirm({
      title: `Revoke ${k.name}?`,
      tone: 'danger',
      confirmLabel: 'Revoke key',
      cancelLabel: 'Keep key',
      message: 'Requests using this key will fail immediately. This cannot be undone.',
      details: [['Key ID', maskId(k.id)], ['Environment', k.env === 'live' ? 'Live' : 'Test'], ['Last used', lastUsedText(k)]],
    });
    if (!ok) return;
    k.status = 'revoked';
    apply();
    Portal.toast(`${k.name} revoked`);
  }

  /* Header, palette entries and deep link ------------------------------------------------- */
  $('[data-create-key]').addEventListener('click', () => openCreate());
  Portal.searchIndex = [
    { label: 'Create API key', hint: 'API keys', run: () => openCreate() },
    { label: 'Create a key with the Cards scope', hint: 'Card program access', run: () => openCreate({ preselect: ['cards'] }) },
    ...keys.map((k) => ({ label: k.name, hint: maskId(k.id), run: () => { filters.env = k.env; $('[data-filter="env"]').portalSelect?.(k.env); apply(); } })),
  ];
  if (params.get('scope') === 'cards') window.setTimeout(() => openCreate({ preselect: ['cards'] }), 400);
})();
