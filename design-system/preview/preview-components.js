/* Design system docs: Components pages. Each page: live examples, a static States grid and its tokens. */
(function () {
  'use strict';

  const { PV, Portal } = window;
  const { el, fmt } = Portal;
  const { ic } = PV;
  const page = (id, title, desc, tokens, render) => PV.page({ id, group: 'Components', title, desc, tokens, render });
  const B = PV.button;
  const sw = (checked, label, extra = {}) => el('button', { className: 'switch', attrs: { type: 'button', role: 'switch', 'aria-checked': String(checked), 'aria-label': label, ...extra } });
  const themeSwitch = (checked, attrs = {}) => el('button', { className: 'theme-switch', attrs: { type: 'button', role: 'switch', 'aria-checked': String(checked), 'aria-label': 'Dark mode', ...attrs } }, [
    el('span', { className: 'theme-switch__knob', attrs: { 'aria-hidden': 'true' } }),
    el('span', { className: 'theme-switch__icon theme-switch__icon--sun', attrs: { 'aria-hidden': 'true' } }, [ic('sun')]),
    el('span', { className: 'theme-switch__icon theme-switch__icon--moon', attrs: { 'aria-hidden': 'true' } }, [ic('moon')]),
  ]);
  const envToggle = (on, attrs = {}) => el('button', { className: 'env-toggle', attrs: { type: 'button', role: 'switch', 'aria-checked': String(on), ...attrs } }, [
    el('span', { className: 'switch', attrs: { 'aria-hidden': 'true', 'aria-checked': String(on) } }),
    el('span', { className: 'env-toggle__label', text: 'Test mode' }),
  ]);
  const segmented = (options, { checked = 0, size, label = 'Options', block } = {}) => el('div', {
    className: ['segmented', size && `segmented--${size}`, block && 'segmented--block'].filter(Boolean).join(' '),
    attrs: { role: 'radiogroup', 'aria-label': label, 'data-segmented': '' },
  }, options.map((o, i) => {
    const [text, count] = [].concat(o);
    return el('button', { className: 'segmented__option', attrs: { type: 'button', role: 'radio', 'aria-checked': String(i === checked), 'data-value': text.toLowerCase().replace(/\s+/g, '-') } },
      [text, count !== undefined ? el('span', { className: 'segmented__count', text: count }) : null]);
  }));
  const input = (attrs = {}, cls = '') => el('input', { className: `input ${cls}`.trim(), attrs: { type: 'text', ...attrs } });
  const select = (options, attrs = {}, cls = '') => el('select', { className: `select ${cls}`.trim(), attrs }, options.map((o) => el('option', { text: o, attrs: { value: o } })));
  const cselectStatic = (text, attrs = {}, cls = '') => el('button', { className: `select cselect ${cls}`.trim(), attrs: { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', ...attrs } }, [el('span', { className: 'cselect__label', text })]);
  const check = (type, label, { checked, disabled, desc, name = 'pv-check' } = {}) => el('label', { className: 'check' }, [
    el('input', { attrs: { type, name, checked, disabled } }),
    el('span', { className: 'check__text' }, [label, desc ? el('span', { className: 'check__desc', text: desc }) : null]),
  ]);
  const radioCard = (type, title, desc, { checked, name = 'pv-rc' } = {}) => el('label', { className: 'radio-card' }, [
    el('input', { attrs: { type, name, checked } }),
    el('span', { className: 'radio-card__dot', attrs: { 'aria-hidden': 'true' } }),
    el('span', { className: 'radio-card__body' }, [el('span', { className: 'radio-card__title', text: title }), el('span', { className: 'radio-card__desc', text: desc })]),
  ]);
  const copyBtn = (value, copied) => el('span', { className: 'copy' }, [
    el('span', { className: 'u-mono', text: value }),
    el('button', { className: `copy__btn${copied ? ' is-copied' : ''}`, attrs: { type: 'button', 'data-copy': value, 'aria-label': `Copy ${value}` } }, [ic('copy', 'icon-copy'), ic('check', 'icon-check')]),
  ]);
  const staticMenu = (items) => el('div', { className: 'menu pv-static', attrs: { role: 'menu' } }, items.map((item) => (item === 'separator'
    ? el('div', { className: 'menu__sep', attrs: { role: 'separator' } })
    : el('button', { className: `menu__item${item.tone === 'danger' ? ' menu__item--danger' : ''}`, attrs: { type: 'button', role: 'menuitem', disabled: item.disabled } }, [
      item.icon ? ic(item.icon) : null,
      el('span', { className: 'menu__text' }, [el('span', { text: item.label }), item.description ? el('span', { className: 'menu__desc', text: item.description }) : null]),
    ]))));
  const MENU_ITEMS = [
    { label: 'Edit endpoint', icon: 'edit', description: 'Change URL or events' },
    { label: 'Send test event', icon: 'send' },
    { label: 'Rotate secret', icon: 'rotate', disabled: true },
    'separator',
    { label: 'Delete endpoint', icon: 'trash', tone: 'danger' },
  ];
  const sampleRows = (n = 23) => Array.from({ length: n }, (_, i) => ({
    id: `req_${(0x8f3a91c2e7 - i * 9973).toString(16)}`,
    created: new Date(Date.UTC(2026, 10, 27, 12) - i * 31 * 3600000).toISOString(),
    route: ['Crossmint', 'ForumPay', 'Blockchain rail'][i % 3],
    status: ['paid', 'pending', 'failed', 'paid', 'cancelled'][i % 5],
    amount: (12.5 + i * 13.25).toFixed(2),
    currency: ['USD', 'USDT', 'USDC', 'AED'][i % 4],
    country: Portal.countries[i % 8].code,
  }));

  /* Button ------------------------------------------------------------------------------- */
  page('button', 'Button', 'Solid fill with a darker lip underneath; on press the button sinks onto the lip. One primary action per view.', ['--button-', '--control-height', '--focus-ring-'], (h) => {
    const variants = [['primary', 'Primary'], [undefined, 'Secondary'], ['ghost', 'Ghost'], ['danger', 'Danger']];
    const sizes = [['sm', 'Small 28'], [undefined, 'Medium 32'], ['lg', 'Large 36'], ['xl', 'XL 48'], ['icon', 'Icon']];
    const states = [['Default', {}], ['Hover', { cls: 'is-hover' }], ['Pressed', { cls: 'is-active' }], ['Focus', { cls: 'is-focus' }], ['Disabled', { attrs: { disabled: true } }], ['Loading', { attrs: { 'aria-busy': 'true' } }]];
    const busy = B('Save changes', { variant: 'primary' });
    busy.addEventListener('click', () => { busy.setAttribute('aria-busy', 'true'); window.setTimeout(() => busy.removeAttribute('aria-busy'), 1400); });
    return [
      h.example('Variants', [h.row(B('Create payment', { variant: 'primary', icon: 'plus' }), B('Export', { icon: 'download' }), B('Cancel', { variant: 'ghost' }), B('Revoke key', { variant: 'danger', icon: 'trash' }), B('More actions', { iconOnly: true, icon: 'more' }))]),
      h.example('Sizes', [h.row(B('Small', { variant: 'primary', size: 'sm' }), B('Medium', { variant: 'primary' }), B('Large', { variant: 'primary', size: 'lg' }), B('Extra large', { variant: 'primary', size: 'xl' }))]),
      h.example('Icon motion, keyboard hint and loading', [h.row(
        B('Next', { icon: 'arrow-right' }), B('Refund', { icon: 'refund' }), B('Send', { icon: 'send' }),
        el('button', { className: 'btn', attrs: { type: 'button' } }, ['Search', el('span', { className: 'btn__kbd', text: '⌘K' })]),
        busy,
      )], { note: 'Hover the buttons: each icon moves in the direction of its meaning. Click “Save changes” to see the loading state.' }),
      h.example('Block button', [B('Continue', { variant: 'primary', size: 'xl', cls: 'btn--block' })]),
      ...variants.map(([variant, name]) => h.states(states.map(([s]) => s), sizes.map(([size, sizeName]) => ({
        label: sizeName,
        cells: states.map(([, st]) => {
          const isIcon = size === 'icon';
          return B(isIcon ? 'Add' : 'Button', { variant, size: isIcon ? undefined : size, icon: isIcon ? 'plus' : undefined, iconOnly: isIcon, cls: st.cls ? [st.cls] : [], attrs: st.attrs || {} });
        }),
      })), { title: `States · ${name}`, note: variant === 'primary' ? 'Forced with .is-hover, .is-active and .is-focus; disabled and aria-busy="true" are real attributes.' : undefined })),
      h.tune(),
    ];
  });

  /* Input ------------------------------------------------------------------------------- */
  page('input', 'Input', 'Text field with label, help and inline error. Errors say how to fix the value.', ['--input-', '--focus-ring-'], (h) => {
    const counter = el('span', { className: 'field__counter', text: '0 / 60' });
    const area = el('textarea', { className: 'input textarea', attrs: { id: 'pv-desc', maxlength: '60', placeholder: 'Shown on the receipt' } });
    area.addEventListener('input', () => { counter.textContent = `${area.value.length} / 60`; });
    const group = (attrs) => el('div', { className: 'input-group' }, [ic('search', 'input-group__icon'), input({ placeholder: 'Request ID or reference', ...attrs })]);
    const addon = (attrs) => el('div', { className: 'input-affix' }, [el('span', { className: 'input-affix__addon', text: 'https://' }), input({ placeholder: 'api.example.com/hooks', ...attrs })]);
    const suffix = (attrs) => el('div', { className: 'input-affix input-affix--suffix' }, [input({ placeholder: '0.00', inputmode: 'decimal', ...attrs }, 'u-num'), el('span', { className: 'input-affix__addon', text: 'USD' })]);
    const st = (label, node, error) => el('div', { className: 'field pv-state-field' }, [el('span', { className: 'field__label', text: label }), node, error ? el('p', { className: 'field__error', text: error }) : null]);
    return [
      h.example('Text field', [PV.field('Key name', input({ placeholder: 'Production server', maxlength: '60' }), { id: 'pv-name', help: 'Shown in logs and the API keys list.' })], { canvasClass: 'pv-narrow' }),
      h.example('Invalid with error', [PV.field('Endpoint URL', input({ value: 'http://example' }), { id: 'pv-url', error: 'Use an https:// URL.' })], { canvasClass: 'pv-narrow' }),
      h.example('With icon, addon and suffix', [h.stack(group({ 'aria-label': 'Search' }), addon({ 'aria-label': 'Endpoint host' }), suffix({ 'aria-label': 'Amount' }))], { canvasClass: 'pv-narrow' }),
      h.example('Textarea with counter', [el('div', { className: 'field' }, [el('div', { className: 'field__row' }, [el('label', { className: 'field__label', text: 'Description', attrs: { for: 'pv-desc' } }), counter]), area])], { canvasClass: 'pv-narrow' }),
      h.example('Large input', [input({ placeholder: 'you@company.com', 'aria-label': 'Email' }, 'input--xl')], { canvasClass: 'pv-narrow' }),
      h.states(['Default', 'Hover', 'Focus', 'Filled', 'Invalid', 'Disabled'], [
        { label: 'Plain', cells: [input({ placeholder: 'Placeholder' }), input({ placeholder: 'Placeholder' }, 'pv-hover'), input({ value: 'Typing' }, 'pv-focus'), input({ value: 'Production server' }), st('', input({ value: 'http://example', 'aria-invalid': 'true' }), 'Use an https:// URL.'), input({ value: 'Read only value', disabled: true })] },
        { label: 'With icon', cells: [group({}), group({ class: 'input pv-hover' }), group({ class: 'input pv-focus' }), group({ value: 'req_8f3a91c2e7' }), group({ 'aria-invalid': 'true', value: 'req_' }), group({ disabled: true })] },
        { label: 'With addon', cells: [addon({}), addon({ class: 'input pv-hover' }), addon({ class: 'input pv-focus' }), addon({ value: 'hooks.partner.com' }), addon({ 'aria-invalid': 'true', value: 'localhost' }), addon({ disabled: true })] },
        { label: 'With suffix', cells: [suffix({}), suffix({ class: 'input u-num pv-hover' }), suffix({ class: 'input u-num pv-focus' }), suffix({ value: '250.00' }), suffix({ 'aria-invalid': 'true', value: '25,0.0' }), suffix({ disabled: true })] },
      ], { note: 'Hover and focus are simulated with preview-only classes; invalid is aria-invalid="true".' }),
    ];
  });

  /* Select --------------------------------------------------------------------------------- */
  page('select', 'Select (custom dropdown)', 'A native <select class="select"> is upgraded to a listbox styled like our menus. The native element stays as the source of truth.', ['--input-', '--surface-raised-'], (h) => {
    const sel = select(['All routes', 'Crossmint', 'ForumPay', 'Blockchain rail'], { id: 'pv-route' }, 'select--block');
    const out = el('span', { className: 't-meta', text: 'Value: All routes' });
    sel.addEventListener('change', () => { out.textContent = `Value: ${sel.value}`; });
    const openList = el('div', { className: 'menu cselect__list pv-static', attrs: { role: 'listbox' } }, ['USD', 'USDC', 'USDT', 'AED'].map((c, i) => el('button', { className: 'menu__item cselect__option', attrs: { type: 'button', role: 'option', 'aria-selected': String(i === 1) } }, [el('span', { text: c }), ic('check')])));
    return [
      h.example('Custom dropdown', [el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Route', attrs: { for: 'pv-route' } }), sel, out])], {
        canvasClass: 'pv-narrow', note: 'Keyboard: arrows open and move, Enter selects, Esc closes, typing a letter jumps.',
      }),
      h.example('Small, disabled and native', [h.row(
        select(['Last 7 days', 'Last 30 days'], { 'aria-label': 'Range' }, 'select--sm'),
        select(['Locked'], { 'aria-label': 'Disabled select', disabled: true }),
        select(['Native OS list', 'Second'], { 'aria-label': 'Native select', 'data-native': '' }),
      )], { note: 'Add data-native to keep the operating system dropdown.' }),
      h.states(['Default', 'Hover', 'Focus', 'Open', 'Invalid', 'Disabled'], [{
        label: 'Select',
        cells: [
          cselectStatic('USDC'), cselectStatic('USDC', {}, 'pv-hover'), cselectStatic('USDC', {}, 'pv-focus'),
          el('div', { className: 'pv-stack pv-stack--tight' }, [cselectStatic('USDC', { 'aria-expanded': 'true' }), openList]),
          cselectStatic('Choose a currency', { 'aria-invalid': 'true' }), cselectStatic('USDC', { disabled: true }),
        ],
      }]),
    ];
  });

  /* Checkbox and radio cards ------------------------------------------------------------ */
  page('checks', 'Checkbox and radio cards', 'Checkboxes and radios for short lists; radio cards for choices that need a description.', ['--accent-solid', '--accent-subtle', '--input-border'], (h) => [
    h.example('Checkboxes', [h.stack(check('checkbox', 'payment.created', { checked: true, name: 'ev' }), check('checkbox', 'payment.status_updated', { name: 'ev' }), check('checkbox', 'refund.status_updated', { name: 'ev', desc: 'Sent when a refund settles or fails.' }))]),
    h.example('Radios', [h.stack(check('radio', 'Live', { checked: true, name: 'envr' }), check('radio', 'Test', { name: 'envr' }))]),
    h.example('Radio cards', [el('div', { className: 'radio-cards radio-cards--2' }, [radioCard('radio', 'Card', 'Crossmint hosted card page', { checked: true }), radioCard('radio', 'Crypto', 'ForumPay or a blockchain rail')])]),
    h.example('Checkbox cards', [el('div', { className: 'radio-cards' }, [radioCard('checkbox', 'Payments', 'PAYIN, CANCEL, REFUND, QUERY', { checked: true, name: 'sc' }), radioCard('checkbox', 'Cards', 'Needs the CARDS scope', { name: 'sc' })])]),
    h.states(['Unchecked', 'Checked', 'Disabled', 'Disabled checked'], [
      { label: 'Checkbox', cells: [check('checkbox', 'Label', { name: 's1' }), check('checkbox', 'Label', { checked: true, name: 's2' }), check('checkbox', 'Label', { disabled: true, name: 's3' }), check('checkbox', 'Label', { checked: true, disabled: true, name: 's4' })] },
      { label: 'Radio', cells: [check('radio', 'Label', { name: 's5' }), check('radio', 'Label', { checked: true, name: 's6' }), check('radio', 'Label', { disabled: true, name: 's7' }), check('radio', 'Label', { checked: true, disabled: true, name: 's8' })] },
      { label: 'Radio card', cells: [radioCard('radio', 'Card', 'Hosted page', { name: 's9' }), radioCard('radio', 'Card', 'Hosted page', { checked: true, name: 's10' }), null, null] },
    ]),
  ]);

  /* Switch --------------------------------------------------------------------------------- */
  page('switch', 'Switch', 'role="switch" button for settings that apply at once. Use a checkbox inside forms that need Save.', ['--switch-'], (h) => {
    const s = sw(true, 'Email alerts', { 'data-switch': '' });
    const out = el('span', { className: 't-meta', text: 'On' });
    s.addEventListener('switch:change', (e) => { out.textContent = e.detail.checked ? 'On' : 'Off'; });
    return [
      h.example('Switch', [h.row(s, el('span', { text: 'Email alerts' }), out)], { code: "// [data-switch] emits switch:change with detail.checked\nbutton.addEventListener('switch:change', (e) => save(e.detail.checked));" }),
      h.states(['Off', 'On', 'Disabled off', 'Disabled on'], [{ label: 'Switch', cells: [sw(false, 'Off'), sw(true, 'On'), sw(false, 'Disabled', { disabled: true }), sw(true, 'Disabled', { disabled: true })] }], { note: 'Disabled switches use the disabled attribute; pair them with a reason.' }),
    ];
  });

  /* Theme switch ------------------------------------------------------------------------- */
  page('theme-switch', 'Theme switch', 'Sun and moon in the track; the accent knob slides under the active icon. In the app it carries data-theme-toggle.', ['--accent-solid', '--accent-solid-fg'], (h) => {
    const demo = themeSwitch(Portal.theme.get() === 'dark', { 'data-pv-theme-switch': '' });
    demo.addEventListener('click', () => Portal.theme.set(Portal.theme.get() === 'dark' ? 'light' : 'dark', { persist: false }));
    return [
      h.example('Theme switch', [h.row(demo, el('span', { className: 't-meta', text: 'Here it previews the theme without saving it, like the tabs in the top bar.' }))], {
        code: "// In the app shell (saves the preference):\n<button class=\"theme-switch\" role=\"switch\" data-theme-toggle>…</button>\n\n// Preview only, not saved:\nPortal.theme.set('dark', { persist: false });",
      }),
      h.states(['Light', 'Dark'], [{ label: 'Theme switch', cells: [themeSwitch(false), themeSwitch(true)] }]),
    ];
  });

  /* Test mode switch ------------------------------------------------------------------------ */
  page('test-mode', 'Test mode switch', 'Stripe-like label and switch in the app bar. When on, the text turns warning and a Test strip appears under the bar.', ['--status-warning-'], (h) => {
    const demo = envToggle(false);
    const strip = el('div', { className: 'pv-env-strip', attrs: { hidden: true } }, [ic('alert'), 'Test mode: test data only. No real money moves.']);
    demo.addEventListener('click', () => {
      const on = demo.getAttribute('aria-checked') !== 'true';
      demo.setAttribute('aria-checked', String(on));
      demo.querySelector('.switch').setAttribute('aria-checked', String(on));
      strip.hidden = !on;
    });
    return [
      h.example('Test mode switch', [h.stack(h.row(demo), strip)], { code: '// In the app: [data-env-toggle] (shell.js) sets <html data-env="test"> and saves it.\nPortal.env.set(\'test\', { announce: true });' }),
      h.states(['Live (off)', 'Test (on)'], [{ label: 'Toggle', cells: [envToggle(false), envToggle(true)] }]),
    ];
  });

  /* Segmented -------------------------------------------------------------------------------- */
  page('segmented', 'Segmented control', 'Mutually exclusive filters or views. A single indicator slides between options.', ['--segmented-'], (h) => {
    const seg = segmented(['7 days', '30 days', '90 days']);
    const out = el('span', { className: 't-meta', text: 'Selected: 7-days' });
    seg.addEventListener('segmented:change', (e) => { out.textContent = `Selected: ${e.detail.value}`; });
    return [
      h.example('Range', [h.row(seg, out)], { code: "group.addEventListener('segmented:change', (e) => load(e.detail.value));\ngroup.portalSelect('30-days'); // select without emitting" }),
      h.example('Small with counts', [segmented([['All', 49], ['Paid', 16], ['Failed', 12]], { size: 'sm', label: 'Status' })]),
      h.example('Block', [segmented(['Card', 'Crypto', 'Stablecoin'], { block: true, label: 'Method' })]),
      h.states(['First selected', 'Middle selected', 'Last selected'], [
        { label: 'Default', cells: [0, 1, 2].map((i) => segmented(['Day', 'Week', 'Month'], { checked: i })) },
        { label: 'Small', cells: [0, 1, 2].map((i) => segmented([['All', 9], ['Paid', 4], ['Failed', 2]], { checked: i, size: 'sm' })) },
      ]),
    ];
  });

  /* Tabs --------------------------------------------------------------------------------- */
  page('tabs', 'Tabs', 'Underline tabs switch panels inside a page or drawer. Arrow keys move between tabs.', ['--border-default', '--text-primary', '--text-secondary'], (h) => {
    const tabs = (sel, uid, live) => {
      const names = [['Overview'], ['Deliveries', 12], ['Settings']];
      const list = el('div', { className: 'tabs', attrs: { role: 'tablist', 'aria-label': 'Example tabs', 'data-tabs': live ? '' : undefined } }, names.map(([t, c], i) => el('button', {
        className: 'tabs__tab', attrs: { type: 'button', role: 'tab', id: `${uid}-t${i}`, 'aria-controls': `${uid}-p${i}`, 'aria-selected': String(i === sel) },
      }, [t, c ? el('span', { className: 'tabs__count', text: c }) : null])));
      if (!live) return list;
      return [list, ...names.map(([t], i) => el('div', { className: 'pv-tabpanel', text: `${t} panel content.`, attrs: { role: 'tabpanel', id: `${uid}-p${i}`, 'aria-labelledby': `${uid}-t${i}`, hidden: i !== sel } }))];
    };
    return [
      h.example('Tabs with panels', tabs(0, 'pvt', true), { code: "list.addEventListener('tabs:change', (e) => console.log(e.detail.value));\nPortal.initTabs(scope); // for markup added later" }),
      h.states(['First selected', 'Second selected'], [{ label: 'Tabs', cells: [tabs(0, 'pvs1', false), tabs(1, 'pvs2', false)] }], { note: 'Static: the underline indicator is added by JS, so the selected tab shows by colour here.' }),
    ];
  });

  /* Badge --------------------------------------------------------------------------------- */
  page('badge', 'Badge', 'Status with a dot and text. Colour is never the only signal. Pending pulses gently.', ['--badge-', '--status-'], (h) => [
    h.example('Tones', [h.row(...['success', 'warning', 'danger', 'info', ''].map((tone, i) => el('span', { className: `badge${tone ? ` badge--${tone}` : ''}`, text: ['Paid', 'Pending', 'Failed', 'Refunded', 'Cancelled'][i] })))]),
    h.example('From a status', [h.row(...['paid', 'pending', 'awaiting_approval', 'failed', 'frozen', 'draft'].map((s) => Portal.badge(s)))], { code: "Portal.badge('awaiting_approval'); // → Awaiting approval, warning tone" }),
    h.example('Plain and keyboard key', [h.row(el('span', { className: 'badge badge--plain', text: 'Beta' }), el('span', { className: 'kbd', text: '⌘' }), el('span', { className: 'kbd', text: 'K' }))]),
    h.states(['Success', 'Warning', 'Danger', 'Info', 'Neutral'], [{ label: 'Badge', cells: ['success', 'warning', 'danger', 'info', ''].map((t) => el('span', { className: `badge${t ? ` badge--${t}` : ''}`, text: t ? fmt.humanize(t) : 'Neutral' })) }]),
  ]);

  /* Chip --------------------------------------------------------------------------------- */
  page('chip', 'Chip', 'Compact tags for event names, scopes and active filters.', ['--border-default', '--bg-sidebar'], (h) => {
    const filterChip = (text) => el('span', { className: 'chip chip--filter' }, [el('span', { className: 'chip__text', text }), el('button', { className: 'chip__remove', attrs: { type: 'button', 'aria-label': `Remove ${text}` } }, [ic('x')])]);
    const removable = el('div', { className: 'chips' }, [filterChip('Status: Paid, Failed'), filterChip('Amount: ≥ 100')]);
    removable.addEventListener('click', (e) => { const b = e.target.closest('.chip__remove'); if (b) b.closest('.chip').remove(); });
    return [
      h.example('Chips', [el('div', { className: 'chips' }, ['Payments', 'Cards', 'Read only'].map((t) => el('span', { className: 'chip', text: t })))]),
      h.example('Mono', [el('div', { className: 'chips' }, ['payment.created', 'refund.status_updated', 'card_order.status_updated'].map((t) => el('span', { className: 'chip chip--mono', text: t })))]),
      h.example('Filter chips (removable)', [removable]),
      h.states(['Default', 'Mono', 'Filter', 'Long (truncates)'], [{ label: 'Chip', cells: [el('span', { className: 'chip', text: 'Payments' }), el('span', { className: 'chip chip--mono', text: 'payment.created' }), filterChip('Route: Crossmint'), el('span', { className: 'chip pv-truncate', text: 'A very long chip label that keeps going and going' })] }]),
    ];
  });

  /* Avatar --------------------------------------------------------------------------------- */
  page('avatar', 'Avatar', 'Round photo with an initials fallback. Decorative: always show the name next to it.', ['--size-24', '--size-32', '--size-48'], (h) => [
    h.example('Sizes', [h.row(...['sm', 'md', 'lg'].map((size) => Portal.avatar({ name: 'Pocket Admin', size })))], { code: "Portal.avatar({ src, name: 'Pocket Admin', size: 'md' }); // sm 24 · md 32 · lg 48" }),
    h.example('With a name', [el('div', { className: 'table__lead' }, [Portal.avatar({ name: 'Mira Haddad' }), el('span', {}, [el('span', { text: 'Mira Haddad' }), el('span', { className: 'cell-sub', text: 'Finance' })])])]),
    h.states(['Small', 'Medium', 'Large', 'No name'], [{ label: 'Avatar', cells: [Portal.avatar({ name: 'Ana Ruiz', size: 'sm' }), Portal.avatar({ name: 'Ana Ruiz' }), Portal.avatar({ name: 'Ana Ruiz', size: 'lg' }), Portal.avatar({})] }]),
  ]);

  /* Copy --------------------------------------------------------------------------------- */
  page('copy', 'Copy', 'IDs, addresses and secrets are copyable. The icon turns into a check and a toast confirms.', ['--status-success-icon'], (h) => [
    h.example('Copyable values', [h.stack(...[['Request ID', 'req_8f3a91c2e7'], ['Wallet address', '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'], ['Support email', 'partners@the-block.com']]
      .map(([label, value]) => el('div', { className: 'pv-row' }, [h.label(label), Portal.copyable(value)])))], { code: "Portal.copyable('req_8f3a91c2e7'); // mono by default\nPortal.copyable('partners@the-block.com', { mono: false });" }),
    h.example('Copy button', [h.row(el('button', { className: 'btn btn--sm', attrs: { type: 'button', 'data-copy': 'whsec_••••4f2a', 'data-copy-toast': 'Signing secret copied' } }, [ic('copy'), 'Copy secret']))], { note: 'Long values are never echoed in the toast; data-copy-toast sets the message.' }),
    h.states(['Default', 'Copied (.is-copied)'], [
      { label: 'Icon button', cells: [copyBtn('req_8f3a91c2e7', false), copyBtn('req_8f3a91c2e7', true)] },
      { label: 'Text button', cells: [el('button', { className: 'btn btn--sm', attrs: { type: 'button' } }, [ic('copy'), 'Copy']), el('button', { className: 'btn btn--sm is-copied', attrs: { type: 'button' } }, [ic('check', 'icon-check-inline'), 'Copied'])] },
    ]),
  ]);

  /* Tooltip (collapsed nav) ---------------------------------------------------------------- */
  page('tooltip', 'Tooltip (collapsed nav)', 'When the sidebar collapses to icons, each item shows its label in a tooltip on hover or keyboard focus.', ['--nav-'], (h) => {
    const item = (icon, label, { current, open } = {}) => el('a', { className: `nav__item${open ? ' pv-tip-open' : ''}`, attrs: { href: '#tooltip', 'aria-current': current ? 'page' : undefined, 'data-tooltip': label } }, [ic(icon), el('span', { className: 'nav__label', text: label })]);
    const mini = (items) => el('div', { className: 'app is-collapsed pv-mini-app' }, [el('aside', { className: 'sidebar' }, [el('nav', { className: 'nav', attrs: { 'aria-label': 'Collapsed example' } }, items)])]);
    const live = mini([item('home', 'Overview', { current: true }), item('payments', 'Transactions'), item('cards', 'Cards'), item('key', 'API keys'), item('settings', 'Settings')]);
    live.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); });
    return [
      h.example('Collapsed sidebar', [live], { note: 'Hover or Tab to an icon. The label comes from data-tooltip.' }),
      h.states(['Default', 'Current', 'Tooltip shown'], [{ label: 'Nav item', cells: [mini([item('payments', 'Transactions')]), mini([item('home', 'Overview', { current: true })]), mini([item('key', 'API keys', { open: true })])] }], { note: 'Tooltip shown is forced with a preview-only class.' }),
    ];
  });

  /* Card and KPI ------------------------------------------------------------------------------ */
  page('card', 'Card and KPI', 'Flat cards: border only, no shadow. KPIs sit in one bordered strip divided into cells.', ['--card-', '--status-success-icon'], (h) => {
    const kpi = (label, value, unit, meta) => el('div', { className: 'kpi' }, [el('p', { className: 'kpi__label', text: label }), el('p', { className: 'kpi__value t-figure' }, [value, unit ? el('span', { className: 'kpi__unit', text: unit }) : null]), el('p', { className: 'kpi__meta' }, [].concat(meta))]);
    return [
      h.example('Card', [el('section', { className: 'card' }, [el('div', { className: 'card__head' }, [el('h2', { className: 'card__title', text: 'Balances' }), B('View all', { variant: 'ghost', size: 'sm', icon: 'arrow-right' })]), el('div', { className: 'card__body' }, [el('p', { className: 't-meta', text: 'Card body content.' })])])]),
      h.example('Dashed card', [el('div', { className: 'card card--dashed card__body' }, [el('p', { className: 't-meta', text: 'Placeholder for an optional section.' })])]),
      h.example('KPI strip', [el('div', { className: 'kpi-strip' }, [
        kpi('Gross volume', '299.28', 'USD eq.', [el('span', { className: 'delta delta--up', text: '+12.4%' }), ' vs previous 30 days']),
        kpi('Success rate', '32.7', '%', [el('span', { className: 'delta delta--down', text: '−4.1 pts' }), ' 16 of 49']),
        kpi('Payouts', '8', '', '2 awaiting approval'),
        el('div', { className: 'kpi' }, [el('p', { className: 'kpi__label', text: 'API status' }), el('p', { className: 'kpi__value t-figure' }, [el('span', { className: 'status-dot', text: 'Connected' })]), el('p', { className: 'kpi__meta', text: 'Keys verified' })]),
      ])], { canvasClass: 'pv-flush' }),
      h.states(['Delta up', 'Delta down', 'Status', 'Loading'], [{ label: 'KPI', cells: [
        kpi('Volume', '1,204', 'USD', el('span', { className: 'delta delta--up', text: '+8%' })),
        kpi('Failures', '12', '', el('span', { className: 'delta delta--down', text: '+3' })),
        el('div', { className: 'kpi' }, [el('p', { className: 'kpi__label', text: 'API' }), el('p', { className: 'kpi__value t-figure' }, [el('span', { className: 'status-dot', text: 'Live' })])]),
        el('div', { className: 'kpi' }, [el('p', { className: 'kpi__label', text: 'Volume' }), el('div', { className: 'skeleton-stack kpi__skeleton' }, [el('span', { className: 'skeleton skeleton--figure' }), el('span', { className: 'skeleton skeleton--short' })])]),
      ] }]),
    ];
  });

  /* Table ------------------------------------------------------------------------------------- */
  page('table', 'Table', 'Portal.dataTable with column filters and pagination: filter any column from its header, paginate, open a row. On phones rows stack into label and value pairs.', ['--table-', '--card-'], (h) => {
    const host = el('div');
    const emptyHost = el('div');
    h.onMount(() => {
      const routes = ['Crossmint', 'ForumPay', 'Blockchain rail'];
      Portal.dataTable(host, {
        pageSize: 6,
        onRowClick: (row) => Portal.drawer.open({ title: `Payment ${row.id}`, subtitle: `${row.route} · ${fmt.dateTime(row.created)}`, body: [el('div', { className: 'amount-hero' }, [el('span', { className: 'amount-hero__value', text: fmt.money(row.amount) }), el('span', { className: 'amount-hero__currency', text: row.currency }), Portal.badge(row.status)]), PV.sampleKv()] }),
        columns: [
          { label: 'Request ID', render: (r) => Portal.copyable(r.id), filter: { type: 'text', value: (r) => r.id } },
          { label: 'Created', render: (r) => fmt.dateTime(r.created), filter: { type: 'date', value: (r) => r.created } },
          { label: 'Route', render: (r) => el('span', {}, [Portal.flag(r.country), ` ${r.route}`]), filter: { type: 'options', value: (r) => r.route, options: routes, label: (v) => v } },
          { label: 'Status', render: (r) => Portal.badge(r.status), filter: { type: 'options', value: (r) => r.status } },
          { label: 'Amount', num: true, render: (r) => el('span', {}, [fmt.money(r.amount), el('span', { className: 'amount__currency', text: r.currency })]), filter: { type: 'number', value: (r) => Number(r.amount) } },
        ],
      }).setRows(sampleRows());
      Portal.dataTable(emptyHost, { columns: [{ label: 'Request ID', render: (r) => r.id }, { label: 'Status', render: (r) => r.status }], empty: { icon: 'payments', title: 'No payments yet', text: 'Payments appear here as soon as your first request is accepted.', action: Portal.btn('Create payment', { variant: 'primary', iconName: 'plus' }) } }).setRows([]);
    });
    const staticTable = el('div', { className: 'card table-card' }, [el('div', { className: 'table-wrap' }, [el('table', { className: 'table' }, [
      el('thead', {}, [el('tr', {}, ['Request ID', 'Route', 'Status'].map((t) => el('th', { text: t, attrs: { scope: 'col' } })).concat(el('th', { className: 'is-num', text: 'Amount', attrs: { scope: 'col' } })))]),
      el('tbody', {}, [['req_8f3a91c2e7', 'Crossmint', 'paid', '25.00 USD'], ['req_77b0d415aa', 'ForumPay', 'pending', '40.00 USDT']].map(([id, r, s, a]) => el('tr', {}, [el('td', {}, [el('span', { className: 'u-mono', text: id })]), el('td', { text: r }), el('td', {}, [Portal.badge(s)]), el('td', { className: 'is-num', text: a })]))),
    ])])]);
    return [
      h.example('Data table with column filters', [el('div', { className: 'card table-card' }, [host])], {
        html: false, canvasClass: 'pv-flush',
        note: 'Use the filter icon in each header (text, date, options, number). On phones, “Filter columns” opens a bottom sheet. Click a row to open its drawer.',
        code: "Portal.dataTable(host, {\n  pageSize: 6,\n  onRowClick: (row) => openPayment(row),\n  columns: [\n    { label: 'Request ID', render: (r) => Portal.copyable(r.id), filter: { type: 'text', value: (r) => r.id } },\n    { label: 'Created', render: (r) => fmt.dateTime(r.created), filter: { type: 'date', value: (r) => r.created } },\n    { label: 'Status', render: (r) => Portal.badge(r.status), filter: { type: 'options', value: (r) => r.status } },\n    { label: 'Amount', num: true, render: …, filter: { type: 'number', value: (r) => Number(r.amount) } },\n  ],\n}).setRows(rows);",
      }),
      h.example('Static markup', [staticTable], { canvasClass: 'pv-flush' }),
      h.example('Empty', [el('div', { className: 'card table-card' }, [emptyHost])], { html: false, canvasClass: 'pv-flush' }),
      h.states(['Default', 'Active filter', 'Popover open'], [{ label: 'Header filter', cells: [
        el('span', { className: 'column-filter__head' }, ['Status', el('button', { className: 'column-filter__trigger', attrs: { type: 'button', 'aria-label': 'Filter Status' } }, [ic('filter')])]),
        el('span', { className: 'column-filter__head' }, ['Status', el('button', { className: 'column-filter__trigger is-active', attrs: { type: 'button', 'aria-label': 'Filter Status' } }, [ic('filter')])]),
        el('span', { className: 'column-filter__head' }, ['Status', el('button', { className: 'column-filter__trigger', attrs: { type: 'button', 'aria-label': 'Filter Status', 'aria-expanded': 'true' } }, [ic('filter')])]),
      ] }]),
    ];
  });

  /* Toolbar --------------------------------------------------------------------------------- */
  page('toolbar', 'Toolbar', 'Filters above a table: search, segmented status, count and actions. Wraps on small screens.', ['--card-pad'], (h) => [
    h.example('Toolbar', [el('div', { className: 'card table-card' }, [el('div', { className: 'toolbar' }, [
      el('div', { className: 'input-group toolbar__search' }, [ic('search', 'input-group__icon'), input({ type: 'search', placeholder: 'Request ID or reference', 'aria-label': 'Search' })]),
      segmented([['All', 49], ['Failed', 12]], { size: 'sm', label: 'Status' }),
      el('span', { className: 'toolbar__spacer' }),
      el('span', { className: 'toolbar__count', text: '49 payments' }),
      B('Export', { size: 'sm', icon: 'download' }),
    ])])], { canvasClass: 'pv-flush' }),
    h.example('Pagination', [el('div', { className: 'card' }, [el('div', { className: 'pagination pv-pagination' }, [el('span', { text: '1–10 of 49' }), el('div', { className: 'pagination__controls' }, [el('span', { className: 'pagination__page', text: 'Page 1 of 5' }), B('Previous page', { size: 'sm', icon: 'chevron-left', iconOnly: true, attrs: { disabled: true } }), B('Next page', { size: 'sm', icon: 'chevron-right', iconOnly: true })])])])], { canvasClass: 'pv-flush' }),
  ]);

  /* Key/value list ---------------------------------------------------------------------------- */
  page('kv', 'Key/value list', 'Details in drawers and cards. Labels left, values right; values wrap instead of overflowing.', ['--border-subtle'], (h) => [
    h.example('Key/value list', [PV.sampleKv()], { canvasClass: 'pv-narrow' }),
    h.example('Amount hero', [el('div', { className: 'amount-hero' }, [el('span', { className: 'amount-hero__value', text: '25.00' }), el('span', { className: 'amount-hero__currency', text: 'USD' }), Portal.badge('paid')])]),
    h.states(['Text', 'Copyable', 'Badge', 'Long value'], [{ label: 'Row', cells: [
      el('dl', { className: 'kv' }, [el('dt', { text: 'Route' }), el('dd', { text: 'Crossmint' })]),
      el('dl', { className: 'kv' }, [el('dt', { text: 'ID' }), el('dd', {}, [Portal.copyable('req_8f3a')])]),
      el('dl', { className: 'kv' }, [el('dt', { text: 'Status' }), el('dd', {}, [Portal.badge('pending')])]),
      el('dl', { className: 'kv' }, [el('dt', { text: 'Wallet' }), el('dd', { text: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' })]),
    ] }]),
  ]);

  /* Rows list ---------------------------------------------------------------------------- */
  page('rows', 'Rows list', 'A simple bordered list: label left, meta right. For short lists that do not need a table.', ['--border-subtle'], (h) => {
    const row = (main, sub, meta) => el('li', { className: 'rows__item' }, [el('span', { className: 'rows__main' }, [el('span', { className: 'u-mono', text: main }), sub ? el('span', { className: 'rows__sub', text: sub }) : null]), el('span', { className: 'rows__meta' }, meta)]);
    return [
      h.example('Rows', [el('ul', { className: 'rows card' }, [
        row('payment.created', 'Nov 27, 10:42', [el('span', { className: 'u-muted', text: 'HTTP 200' }), Portal.badge('delivered')]),
        row('payment.status_updated', 'Nov 27, 10:43', [el('span', { className: 'u-muted', text: 'HTTP 500' }), Portal.badge('retrying')]),
        row('refund.status_updated', null, [Portal.badge('failed'), Portal.menu.button([{ label: 'Retry', icon: 'rotate', onSelect: () => Portal.toast('Retry queued') }])]),
      ])]),
    ];
  });

  /* Timeline ------------------------------------------------------------------------------------ */
  page('timeline', 'Timeline', 'Status history for payments, payouts and card orders. The dot carries the tone; the title carries the meaning.', ['--status-success-icon', '--status-danger-fg', '--status-warning-fg'], (h) => {
    const item = (title, desc, tone, time) => el('li', { className: `timeline__item${tone ? ` timeline__item--${tone}` : ''}` }, [el('span', { className: 'timeline__dot' }), el('span', {}, [el('p', { className: 'timeline__title', text: title }), el('p', { className: 'timeline__desc', text: desc })]), el('span', { className: 'timeline__time', text: time })]);
    return [
      h.example('Timeline', [el('ol', { className: 'timeline' }, [item('Payment created', 'POST /payments accepted', '', '10:42'), item('Sent to Crossmint', 'Hosted card page opened', 'warning', '10:42'), item('Payment received', '25.00 USD confirmed', 'success', '10:44')])], { canvasClass: 'pv-narrow' }),
      h.states(['Neutral', 'Success', 'Warning', 'Danger'], [{ label: 'Item', cells: ['', 'success', 'warning', 'danger'].map((t) => el('ol', { className: 'timeline' }, [item(t ? fmt.humanize(t) : 'Neutral', 'Step detail', t, '10:42')])) }]),
    ];
  });

  /* Code panel -------------------------------------------------------------------------------- */
  page('code', 'Code panel', 'JSON and code with a header label and a copy button. JSON is coloured with text nodes only.', ['--code-'], (h) => [
    h.example('JSON', [Portal.codePanel('Response', { requestId: 'req_8f3a91c2e7', status: 'PAID', amount: '25.00', currency: 'USD', test: false })], { html: false, code: "Portal.codePanel('Response', { requestId: 'req_8f3a91c2e7', status: 'PAID' });" }),
    h.example('Text', [Portal.codePanel('cURL', "curl https://pay-api.the-block.com/payments \\\n  -H 'X-Api-Key: <keyId>.<secret>' \\\n  -H 'Content-Type: application/json'")], { html: false, code: "Portal.codePanel('cURL', 'curl …');" }),
  ]);

  /* Empty state ------------------------------------------------------------------------------- */
  page('empty', 'Empty state', 'Says what will appear here and offers the next step. Dashed border, no illustration.', ['--border-strong'], (h) => [
    h.example('Empty state', [el('div', { className: 'empty' }, [el('span', { className: 'empty__icon' }, [ic('webhook')]), el('p', { className: 'empty__title', text: 'No endpoints yet' }), el('p', { className: 'empty__text', text: 'Add an endpoint to receive payment events.' }), B('Add endpoint', { variant: 'primary', icon: 'plus' })])]),
    h.states(['First use', 'No results', 'Error'], [{ label: 'Empty', cells: [
      el('div', { className: 'empty' }, [el('span', { className: 'empty__icon' }, [ic('payments')]), el('p', { className: 'empty__title', text: 'No payments yet' })]),
      el('div', { className: 'empty' }, [el('span', { className: 'empty__icon' }, [ic('search')]), el('p', { className: 'empty__title', text: 'No matches' }), el('p', { className: 'empty__text', text: 'Try another ID.' })]),
      el('div', { className: 'lazy-error' }, [el('span', { text: "This section didn't load." }), B('Try again', { size: 'sm' })]),
    ] }]),
  ]);

  /* Note and banner ------------------------------------------------------------------------- */
  page('note', 'Note and banner', 'Inline notes explain context; the warning banner flags Test mode or a risky state.', ['--status-info-', '--status-danger-', '--status-success-', '--status-warning-'], (h) => {
    const note = (tone, icon, text) => el('div', { className: `note${tone ? ` note--${tone}` : ''}` }, [ic(icon), el('span', { text })]);
    return [
      h.example('Notes', [h.stack(note('', 'info', 'Card access needs an API key with the CARDS scope.'), note('success', 'check-circle', 'Endpoint verified. Events will be delivered.'), note('danger', 'alert', 'This key was revoked. Requests using it fail.'))]),
      h.example('Banner', [el('div', { className: 'banner' }, [ic('alert'), 'Test mode: test data only. No real money moves.'])]),
      h.states(['Info', 'Success', 'Danger', 'Warning banner'], [{ label: 'Tone', cells: [note('', 'info', 'Info'), note('success', 'check-circle', 'Success'), note('danger', 'alert', 'Danger'), el('div', { className: 'banner' }, [ic('alert'), 'Warning'])] }]),
    ];
  });

  /* Toast ------------------------------------------------------------------------------------- */
  page('toast', 'Toast', 'Short confirmation after an action, bottom right (full width on phones). Up to three stack.', ['--bg-raised', '--status-success-icon'], (h) => {
    const t = (label, msg, opts) => { const b = B(label); b.addEventListener('click', () => Portal.toast(msg, opts)); return b; };
    return [
      h.example('Show a toast', [h.row(t('Saved', 'Changes saved'), t('Copied', 'Copied req_8f3a91c2e7', { icon: 'copy' }), t('Warning', 'Copy is blocked in this browser.', { icon: 'alert' }))], { html: false, code: "Portal.toast('Changes saved');\nPortal.toast('Copy is blocked in this browser.', { icon: 'alert' });" }),
      h.states(['Success', 'Info icon', 'Alert icon'], [{ label: 'Toast', cells: [['check-circle', 'Changes saved'], ['copy', 'Copied'], ['alert', 'Copy is blocked']].map(([i, m]) => el('div', { className: 'toast pv-static' }, [ic(i), el('span', { text: m })])) }]),
    ];
  });

  /* Dialog / confirm ---------------------------------------------------------------------------- */
  page('dialog', 'Dialog / confirm', 'Native <dialog> with a blurred backdrop. Destructive confirms focus Cancel first. On phones dialogs dock to the bottom.', ['--surface-raised-', '--bg-overlay'], (h) => {
    const dialog = el('dialog', { className: 'dialog', attrs: { id: 'pv-dialog', 'aria-labelledby': 'pv-dialog-title' } }, [
      el('div', { className: 'dialog__head' }, [el('h2', { className: 'dialog__title', text: 'Invite a member', attrs: { id: 'pv-dialog-title' } }), el('button', { className: 'btn btn--ghost btn--icon btn--sm', attrs: { type: 'button', 'data-dialog-close': '', 'aria-label': 'Close' } }, [ic('x')])]),
      el('div', { className: 'dialog__body' }, [el('p', { text: 'They get an email with a link that expires in 7 days.' })]),
      el('div', { className: 'dialog__foot' }, [el('button', { className: 'btn', text: 'Cancel', attrs: { type: 'button', 'data-dialog-close': '' } }), el('button', { className: 'btn btn--primary', text: 'Send invite', attrs: { type: 'button', 'data-dialog-close': '' } })]),
    ]);
    const confirm = (tone) => {
      const b = B(tone === 'danger' ? 'Revoke key' : 'Approve payout', { variant: tone === 'danger' ? 'danger' : 'primary', icon: tone === 'danger' ? 'trash' : 'check' });
      b.addEventListener('click', () => Portal.confirm(tone === 'danger'
        ? { title: 'Revoke API key?', tone: 'danger', confirmLabel: 'Revoke key', message: 'Requests using this key will fail immediately.', details: [['Key', 'pk_live_…4f2a'], ['Last used', '3 min ago']] }
        : { title: 'Approve payout?', confirmLabel: 'Approve', message: 'The payout is sent to the saved wallet.', details: [['Amount', '1,250.00 USDT']] }).then((ok) => Portal.toast(ok ? 'Confirmed' : 'Cancelled', { icon: ok ? 'check-circle' : 'x-circle' })));
      return b;
    };
    const anatomy = el('div', { className: 'dialog pv-static' }, [
      el('div', { className: 'dialog__head' }, [el('h2', { className: 'dialog__title', text: 'Revoke API key?' })]),
      el('div', { className: 'dialog__body' }, [el('p', { text: 'Requests using this key will fail immediately.' }), el('dl', { className: 'confirm__details' }, [el('div', {}, [el('dt', { text: 'Key' }), el('dd', { text: 'pk_live_…4f2a' })])])]),
      el('div', { className: 'dialog__foot' }, [el('button', { className: 'btn', text: 'Cancel', attrs: { type: 'button' } }), el('button', { className: 'btn btn--danger', text: 'Revoke key', attrs: { type: 'button' } })]),
    ]);
    return [
      h.example('Declarative dialog', [h.row(el('button', { className: 'btn', attrs: { type: 'button', 'data-dialog-open': 'pv-dialog' } }, [ic('invite'), 'Open dialog'])), dialog], { note: 'Esc, the close button or a click on the backdrop closes it.' }),
      h.example('Confirm', [h.row(confirm('primary'), confirm('danger'))], { html: false, code: "const ok = await Portal.confirm({\n  title: 'Revoke API key?', tone: 'danger', confirmLabel: 'Revoke key',\n  message: 'Requests using this key will fail immediately.',\n  details: [['Key', 'pk_live_…4f2a']],\n});" }),
      h.example('Anatomy (static)', [anatomy], { html: false, canvasClass: 'pv-center' }),
    ];
  });

  /* Drawer / bottom sheet ------------------------------------------------------------------------- */
  page('drawer', 'Drawer / bottom sheet', 'Right-side panel for record details and forms. On phones it becomes a bottom sheet you can drag down to close.', ['--drawer-', '--surface-raised-'], (h) => {
    const open = (label, opts, variant) => { const b = B(label, { variant, icon: 'arrow-right' }); b.addEventListener('click', () => Portal.drawer.open(opts())); return b; };
    return [
      h.example('Open a drawer', [h.row(
        open('Payment details', () => ({
          title: 'Payment ORD-10492', subtitle: 'Crossmint · Nov 27, 10:42',
          body: [el('div', { className: 'amount-hero' }, [el('span', { className: 'amount-hero__value', text: '25.00' }), el('span', { className: 'amount-hero__currency', text: 'USD' }), Portal.badge('paid')]), PV.sampleKv()],
          footer: [el('button', { className: 'btn', text: 'Close', attrs: { type: 'button', 'data-dialog-close': '' } }), B('Refund', { variant: 'primary', icon: 'refund' })],
          footNote: 'Refunds settle in 1–3 days.',
        }), 'primary'),
        open('Cardholder (with avatar)', () => ({ title: 'Mira Haddad', subtitle: 'Verified · 2 cards', leading: Portal.avatar({ name: 'Mira Haddad', size: 'lg' }), body: [PV.sampleKv()] })),
        open('Sections', () => ({ title: 'Filter payments', body: ['Status', 'Route'].map((t) => el('section', { className: 'drawer__section' }, [el('h3', { className: 'drawer__section-title', text: t }), el('div', { className: 'chips' }, ['One', 'Two'].map((c) => el('span', { className: 'chip', text: c })))])) })),
      )], { html: false, code: "const drawer = Portal.drawer.open({\n  title: 'Payment ORD-10492', subtitle: 'Crossmint · Nov 27, 10:42',\n  body: [amountHero, kvList],\n  footer: [closeBtn, refundBtn], footNote: 'Refunds settle in 1–3 days.',\n});\ndrawer.setBody(nodes); drawer.close();" }),
    ];
  });

  /* Menu (overflow) -------------------------------------------------------------------------------- */
  page('menu', 'Menu (overflow)', 'Secondary and destructive row actions live behind ⋯. On phones the menu becomes a bottom sheet.', ['--surface-raised-'], (h) => {
    const items = MENU_ITEMS.map((i) => (i === 'separator' ? i : { ...i, onSelect: () => (i.tone === 'danger'
      ? Portal.confirm({ title: 'Delete endpoint?', tone: 'danger', confirmLabel: 'Delete', message: 'Deliveries stop straight away.' }).then((ok) => ok && Portal.toast('Endpoint deleted'))
      : Portal.toast(i.label)) }));
    return [
      h.example('Overflow menu', [h.row(Portal.menu.button(items), el('span', { className: 't-meta', text: 'Arrow keys move, Esc closes.' }))], { html: false, code: "Portal.menu.button([\n  { label: 'Edit endpoint', icon: 'edit', description: 'Change URL or events', onSelect },\n  'separator',\n  { label: 'Delete endpoint', icon: 'trash', tone: 'danger', onSelect: confirmDelete },\n]);" }),
      h.example('Open menu (static)', [staticMenu(MENU_ITEMS)], { canvasClass: 'pv-center' }),
      h.states(['Default', 'Disabled', 'Danger'], [{ label: 'Item', cells: [staticMenu([{ label: 'Edit', icon: 'edit' }]), staticMenu([{ label: 'Rotate', icon: 'rotate', disabled: true }]), staticMenu([{ label: 'Delete', icon: 'trash', tone: 'danger' }])] }]),
    ];
  });

  /* Context menu ------------------------------------------------------------------------------- */
  page('context-menu', 'Context menu', 'On dashboard pages a right-click (or long-press) offers actions for what was clicked. Text fields keep the native menu; Shift+right-click too.', ['--surface-raised-'], (h) => {
    const area = el('div', { className: 'pv-context', attrs: { tabindex: '0', 'aria-label': 'Context menu demo area' } }, [ic('more'), el('p', { text: 'Right-click or long-press here' }), Portal.copyable('req_8f3a91c2e7')]);
    area.addEventListener('contextmenu', (event) => {
      if (event.shiftKey) return;
      event.preventDefault();
      document.querySelectorAll('.context-anchor').forEach((a) => a.remove());
      const anchor = el('span', { className: 'context-anchor', attrs: { tabindex: '-1' } });
      anchor.style.setProperty('left', `${event.clientX}px`);
      anchor.style.setProperty('top', `${event.clientY}px`);
      document.body.appendChild(anchor);
      const value = event.target.closest('.copy')?.querySelector('[data-copy]')?.dataset.copy;
      Portal.menu.open(anchor, [
        ...(value ? [{ label: 'Copy value', icon: 'copy', description: value, onSelect: () => Portal.toast(`Copied ${value}`) }, 'separator'] : []),
        { label: 'Copy page link', icon: 'link', onSelect: () => Portal.toast('Page link copied') },
        { label: 'Search', icon: 'search', description: '⌘K', onSelect: () => Portal.toast('Opens the command palette in the app') },
        { label: Portal.theme.get() === 'dark' ? 'Light mode' : 'Dark mode', icon: Portal.theme.get() === 'dark' ? 'sun' : 'moon', onSelect: () => Portal.theme.set(Portal.theme.get() === 'dark' ? 'light' : 'dark', { persist: false }) },
        { label: 'Reload', icon: 'rotate', onSelect: () => Portal.toast('Reload') },
      ]);
    });
    return [h.example('Right-click demo', [area], { html: false, code: "// shell.js (dashboard pages)\ndocument.addEventListener('contextmenu', (e) => {\n  e.preventDefault();\n  Portal.menu.open(anchorAt(e.clientX, e.clientY), itemsFor(e.target));\n});" })];
  });

  /* Skeleton / lazy section -------------------------------------------------------------------- */
  let lazyRun = 0;
  page('skeleton', 'Skeleton and lazy section', 'Every data section loads lazily. The skeleton has the shape of the content so nothing jumps.', ['--skeleton-'], (h) => {
    const name = `pv-lazy-${(lazyRun += 1)}`;
    const failName = `${name}-fail`;
    const section = (n, content) => el('section', { className: 'card card__body', attrs: { 'data-lazy': n, 'aria-busy': 'true' } }, [
      el('div', { className: 'skeleton-stack', attrs: { 'data-skeleton': '' } }, [el('span', { className: 'skeleton skeleton--title' }), el('span', { className: 'skeleton skeleton--text' }), el('span', { className: 'skeleton skeleton--short' })]),
      el('div', { attrs: { 'data-lazy-content': '' } }, [content]),
    ]);
    const content = el('div', { className: 'pv-stack' }, [el('p', { className: 't-heading', text: 'Balances' }), el('p', { className: 't-figure', text: '' }), el('p', { className: 't-meta', text: 'Loaded after a simulated request.' })]);
    let attempts = 0;
    h.onMount(() => {
      Portal.lazy.register(name, { fetch: () => Portal.request({ total: 12840.5 }, { delay: 1200 }), render: (data, node) => { node.querySelector('.t-figure').textContent = `${fmt.money(data.total)} USD`; } });
      Portal.lazy.register(failName, { fetch: () => { attempts += 1; return Portal.request(null, { delay: 900, fail: attempts === 1 }); }, render: () => {} });
    });
    const reload = B('Reload section', { size: 'sm', icon: 'rotate' });
    reload.addEventListener('click', () => Portal.lazy.reload(name));
    return [
      h.example('Lazy section', [h.stack(section(name, content), h.row(reload))], { html: false, code: "<section class=\"card\" data-lazy=\"balances\" aria-busy=\"true\">\n  <div data-skeleton>…</div>\n  <div data-lazy-content>…</div>\n</section>\n\nPortal.lazy.register('balances', { fetch: () => Portal.request(data), render });\nPortal.lazy.reload('balances');" }),
      h.example('Failed load with retry', [section(failName, el('p', { className: 't-meta', text: 'Loaded on the second try.' }))], { html: false, note: 'The first request fails on purpose: press Try again.' }),
      h.example('Skeleton shapes', [h.stack(...['title', 'figure', 'text', 'short', 'pill', 'bar'].map((v) => el('div', { className: 'pv-row' }, [h.label(v), el('span', { className: `skeleton skeleton--${v} pv-grow` })])))]),
      h.states(['Busy', 'Loaded'], [{ label: 'Section', cells: [
        el('div', { className: 'skeleton-stack' }, [el('span', { className: 'skeleton skeleton--figure' }), el('span', { className: 'skeleton skeleton--text' })]),
        el('div', {}, [el('p', { className: 't-figure', text: '12,840.50' }), el('p', { className: 't-meta', text: 'USD' })]),
      ] }], { note: 'Toggled by aria-busy on the [data-lazy] section.' }),
    ];
  });

  /* Progress -------------------------------------------------------------------------------- */
  page('progress', 'Progress', 'A thin meter for limits and uploads. Always pair it with the numbers.', ['--progress-'], (h) => {
    const bar = (v) => el('div', { className: 'progress' }, [el('div', { className: 'progress__fill', attrs: { 'data-progress': String(v) } })]);
    const live = bar(30);
    const fill = live.firstChild;
    const step = B('Add 10%', { size: 'sm', icon: 'plus' });
    step.addEventListener('click', () => { const v = (Number(fill.dataset.progress) + 10) % 110; fill.dataset.progress = String(v); fill.style.setProperty('--value', `${v}%`); });
    return [
      h.example('Meter', [el('div', { className: 'meter' }, [el('div', { className: 'meter__row' }, ['Monthly volume', el('span', { text: '6,600 / 10,000 USD' })]), bar(66)])], { canvasClass: 'pv-narrow' }),
      h.example('Update', [h.stack(live, h.row(step))], { html: false, canvasClass: 'pv-narrow', code: "fill.style.setProperty('--value', '40%'); // or data-progress=\"40\" before Portal.initComponents()" }),
      h.states(['0%', '33%', '66%', '100%'], [{ label: 'Progress', cells: [0, 33, 66, 100].map(bar) }]),
    ];
  });

  /* Settings row and save bar ---------------------------------------------------------------------- */
  page('settings', 'Settings row and save bar', 'Title and description left, control right. Edits show a save bar until saved or discarded.', ['--card-pad', '--border-subtle'], (h) => {
    const bar = el('div', { className: 'save-bar', attrs: { role: 'region', 'aria-label': 'Unsaved changes' } }, [el('span', { className: 'save-bar__dot', attrs: { 'aria-hidden': 'true' } }), el('span', { text: 'Unsaved changes' }), el('button', { className: 'btn btn--ghost btn--sm', text: 'Discard', attrs: { type: 'button', 'data-discard': '' } }), el('button', { className: 'btn btn--primary btn--sm', text: 'Save', attrs: { type: 'button', 'data-save': '' } })]);
    const setting = (title, desc, control) => el('div', { className: 'setting' }, [el('div', {}, [el('p', { className: 'setting__title', text: title }), el('p', { className: 'setting__desc', text: desc })]), el('div', { className: 'setting__control' }, [control])]);
    const form = el('form', { className: 'card settings', attrs: { novalidate: '' } }, [
      setting('Organization name', 'Shown on receipts and statements.', input({ name: 'org', value: 'The Orange Card', 'aria-label': 'Organization name' })),
      setting('Require two-factor sign-in', 'Every member must use an authenticator app.', sw(true, 'Require two-factor', { 'data-switch': '', 'data-name': '2fa' })),
      setting('Default currency', 'Used for new payment links.', select(['USD', 'USDC', 'USDT', 'AED'], { name: 'currency', 'aria-label': 'Default currency' })),
    ]);
    form.addEventListener('submit', (e) => e.preventDefault());
    h.onMount(() => Portal.trackDirty(form, bar));
    const staticBar = el('div', { className: 'save-bar is-visible pv-static' }, [el('span', { className: 'save-bar__dot' }), el('span', { text: 'Unsaved changes' }), el('button', { className: 'btn btn--ghost btn--sm', text: 'Discard', attrs: { type: 'button' } }), el('button', { className: 'btn btn--primary btn--sm', text: 'Save', attrs: { type: 'button' } })]);
    return [
      h.example('Settings form', [h.stack(form, bar)], { html: false, note: 'Change any value to show the save bar.', code: "Portal.trackDirty(form, saveBar, { onSave: () => validate() });" }),
      h.states(['Hidden', 'Visible', 'Saving'], [{ label: 'Save bar', cells: [
        el('span', { className: 't-meta', text: 'No changes: no bar' }),
        staticBar,
        el('div', { className: 'save-bar is-visible pv-static' }, [el('span', { text: 'Saving…' }), el('button', { className: 'btn btn--primary btn--sm', text: 'Save', attrs: { type: 'button', 'aria-busy': 'true' } })]),
      ] }]),
    ];
  });

  /* Header and breadcrumbs ------------------------------------------------------------------------- */
  page('header', 'Header and breadcrumbs', 'The app bar holds breadcrumbs, search (⌘K), the Test mode switch and the primary action. Present on every size.', ['--layout-appbar-height'], (h) => {
    const appbar = (current) => el('header', { className: 'appbar pv-appbar' }, [
      el('nav', { className: 'crumbs', attrs: { 'aria-label': 'Breadcrumb' } }, [el('a', { className: 'crumbs__parent', text: 'Payments', attrs: { href: '#header' } }), ic('chevron-right'), el('span', { text: current, attrs: { 'aria-current': 'page' } })]),
      el('span', { className: 'appbar__spacer' }),
      el('button', { className: 'search-trigger', attrs: { type: 'button' } }, [ic('search'), el('span', { text: 'Search payments, pages…' }), el('span', { className: 'kbd', text: '⌘K' })]),
      envToggle(false),
      el('button', { className: 'btn btn--primary btn--sm new-payment', attrs: { type: 'button' } }, [ic('plus'), el('span', { text: 'New payment' })]),
    ]);
    const bar = appbar('Transactions');
    bar.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); const t = e.target.closest('.env-toggle'); if (t) { const on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(on)); t.querySelector('.switch').setAttribute('aria-checked', String(on)); } });
    return [
      h.example('App bar', [el('div', { className: 'card pv-clip' }, [bar])], { canvasClass: 'pv-flush', note: 'On phones the parent crumb, the search text and the button labels hide.' }),
      h.example('Breadcrumbs', [el('nav', { className: 'crumbs', attrs: { 'aria-label': 'Breadcrumb example' } }, [el('a', { className: 'crumbs__parent', text: 'Cards', attrs: { href: '#header' } }), ic('chevron-right'), el('span', { text: 'Card orders', attrs: { 'aria-current': 'page' } })])]),
    ];
  });

  /* Sidebar nav ---------------------------------------------------------------------------------- */
  page('sidebar-nav', 'Sidebar nav', 'Primary navigation with collapsible groups. The current page is highlighted; groups expand without measuring.', ['--nav-'], (h) => {
    const nav = el('nav', { className: 'nav', attrs: { 'aria-label': 'Example' } }, [
      el('a', { className: 'nav__item', attrs: { href: '#sidebar-nav', 'aria-current': 'page' } }, [ic('home'), el('span', { className: 'nav__label', text: 'Overview' })]),
      el('button', { className: 'nav__item', attrs: { type: 'button', 'data-disclosure': '', 'aria-expanded': 'true', 'aria-controls': 'pv-nav-group' } }, [ic('payments'), el('span', { className: 'nav__label', text: 'Payments' }), ic('chevron-down', 'nav__chevron')]),
      el('div', { className: 'nav__group', attrs: { id: 'pv-nav-group' } }, [el('div', { className: 'nav' }, ['Transactions', 'Payouts', 'Refunds'].map((t) => el('a', { className: 'nav__item', attrs: { href: '#sidebar-nav' } }, [el('span', { className: 'nav__label', text: t })])))]),
      el('p', { className: 'nav__section', text: 'Developers' }),
      el('a', { className: 'nav__item', attrs: { href: '#sidebar-nav' } }, [ic('key'), el('span', { className: 'nav__label', text: 'API keys' })]),
      el('a', { className: 'nav__item', attrs: { href: '#sidebar-nav' } }, [ic('webhook'), el('span', { className: 'nav__label', text: 'Webhooks' })]),
    ]);
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); });
    const item = (label, attrs = {}, icon = 'cards') => el('nav', { className: 'nav', attrs: { 'aria-label': label } }, [el('a', { className: 'nav__item', attrs: { href: '#sidebar-nav', ...attrs } }, [ic(icon), el('span', { className: 'nav__label', text: label })])]);
    return [
      h.example('Sidebar nav', [el('div', { className: 'pv-nav-demo' }, [nav])], { note: 'Payments is a disclosure group. Below 860px the whole sidebar becomes a drawer.' }),
      h.states(['Default', 'Hover', 'Current'], [{ label: 'Item', cells: [item('Cards'), item('Cards', { class: 'nav__item pv-nav-hover' }), item('Cards', { 'aria-current': 'page' })] }], { note: 'Collapsed icons with tooltips: see Tooltip (collapsed nav).' }),
    ];
  });

  /* Flags and phone field ---------------------------------------------------------------------------- */
  page('flags', 'Flags and phone field', 'Flags are emoji from the ISO code: no image requests. The phone field joins a dial code select to the number.', ['--input-'], (h) => {
    const dial = el('select', { className: 'select', attrs: { 'aria-label': 'Country code' } }, Portal.countries.map((c) => el('option', { text: `${c.flag} ${c.dial}`, attrs: { value: c.dial } })));
    const phone = input({ type: 'tel', inputmode: 'tel', placeholder: '50 123 4567', 'aria-label': 'Phone number', maxlength: '15' });
    const country = el('select', { className: 'select select--block', attrs: { 'aria-label': 'Country' } }, Portal.countries.map((c) => el('option', { text: `${c.flag}  ${c.name}`, attrs: { value: c.code } })));
    return [
      h.example('Flags', [h.row(...Portal.countries.slice(0, 8).map((c) => el('span', { className: 'chip' }, [Portal.flag(c.code), c.code])))], { html: false, code: "Portal.flag('AE'); // <span class=\"flag\" role=\"img\" aria-label=\"United Arab Emirates\">🇦🇪</span>" }),
      h.example('Phone field', [el('div', { className: 'phone-field' }, [dial, phone])], { canvasClass: 'pv-narrow' }),
      h.example('Country select', [country], { canvasClass: 'pv-narrow' }),
      h.states(['Default', 'Invalid'], [{ label: 'Phone', cells: [
        el('div', { className: 'phone-field' }, [cselectStatic('🇦🇪 +971'), input({ value: '50 123 4567', 'aria-label': 'Phone' })]),
        el('div', { className: 'phone-field' }, [cselectStatic('🇦🇪 +971'), input({ value: '12', 'aria-invalid': 'true', 'aria-label': 'Phone' })]),
      ] }]),
    ];
  });

  /* Card networks ----------------------------------------------------------------------------- */
  page('networks', 'Card networks', 'Visa and Mastercard marks for card rows and checkout. Brand colours are part of the marks, not tokens.', null, (h) => [
    h.example('Marks', [h.row(ic('visa', 'network-mark'), ic('mastercard', 'network-mark'))]),
    h.example('In a row', [el('div', { className: 'table__lead' }, [ic('visa', 'network-mark'), el('span', {}, [el('span', { className: 'u-mono', text: '•••• 4242' }), el('span', { className: 'cell-sub', text: 'Expires 08/29' })])])]),
  ]);

  /* Charts ------------------------------------------------------------------------------------ */
  page('charts', 'Charts', 'Soft area and line chart with a dashed grid, hover guide and tooltip; share bars with a legend. Colours from --chart-*.', ['--chart-'], (h) => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v))); return n; };
    const DATA = [120, 180, 150, 240, 210, 300, 260, 340, 310, 420, 380, 460];
    const LABELS = ['Nov 16', 'Nov 20', 'Nov 24', 'Nov 27'];
    const host = el('div', { className: 'chart is-scrubbing pv-chart' });
    function draw() {
      const padX = parseFloat(getComputedStyle(host).paddingLeft) || 0;
      const w = host.clientWidth - 2 * padX;
      const hgt = host.clientHeight;
      if (w <= 0 || hgt <= 0) return;
      const pad = { top: 12, right: 8, bottom: 24, left: 36 };
      const max = 500;
      const x = (i) => pad.left + (i / (DATA.length - 1)) * (w - pad.left - pad.right);
      const y = (v) => pad.top + (1 - v / max) * (hgt - pad.top - pad.bottom);
      const pts = DATA.map((v, i) => [x(i), y(v)]);
      let d = `M${pts[0][0]},${pts[0][1]}`;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const [p0, p1, p2, p3] = [pts[i - 1] || pts[i], pts[i], pts[i + 1], pts[i + 2] || pts[i + 1]];
        d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
      }
      const base = y(0);
      const root = svg('svg', { viewBox: `0 0 ${w} ${hgt}`, 'aria-hidden': 'true' });
      const grad = svg('linearGradient', { id: 'pv-chart-fill', x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.append(svg('stop', { offset: 0, class: 'pv-chart__stop-top' }), svg('stop', { offset: 1, class: 'pv-chart__stop-bottom' }));
      const defs = svg('defs'); defs.appendChild(grad); root.appendChild(defs);
      const axes = svg('g', { class: 'chart__axes' });
      [0, 250, 500].forEach((v) => {
        root.appendChild(svg('line', { class: 'chart__grid', x1: pad.left, x2: w - pad.right, y1: y(v), y2: y(v) }));
        const t = svg('text', { class: 'chart__axis', x: 0, y: y(v) + 4 }); t.textContent = String(v); axes.appendChild(t);
      });
      LABELS.forEach((label, i) => {
        const t = svg('text', { class: 'chart__axis', x: pad.left + (i / (LABELS.length - 1)) * (w - pad.left - pad.right), y: hgt - 4, 'text-anchor': i === 0 ? 'start' : i === LABELS.length - 1 ? 'end' : 'middle' });
        t.textContent = label; axes.appendChild(t);
      });
      root.appendChild(axes);
      root.appendChild(svg('path', { class: 'chart__area', d: `${d} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z`, fill: 'url(#pv-chart-fill)' }));
      root.appendChild(svg('path', { class: 'chart__line', d }));
      const [mx, my] = pts[8];
      const guide = svg('line', { class: 'chart__guide', x1: 0, x2: 0, y1: pad.top, y2: base });
      guide.style.setProperty('transform', `translateX(${mx}px)`);
      const marker = svg('g', { class: 'chart__marker' });
      marker.append(svg('circle', { class: 'chart__ring', r: 9 }), svg('circle', { class: 'chart__dot', r: 4 }));
      marker.style.setProperty('transform', `translate(${mx}px, ${my}px)`);
      root.append(guide, marker);
      const tip = el('div', { className: 'chart__tooltip', attrs: { 'aria-hidden': 'true' } }, [el('span', { className: 'chart__tooltip-date', text: 'Nov 24' }), el('span', { className: 'chart__tooltip-value' }, ['310.00', el('span', { className: 'chart__tooltip-unit', text: 'USD eq.' })])]);
      tip.style.setProperty('transform', `translate(${padX + Math.max(0, Math.min(mx + 28, w - 130))}px, ${Math.max(0, my - 56)}px)`);
      host.replaceChildren(root, tip);
    }
    h.onMount(() => { draw(); new ResizeObserver(() => draw()).observe(host); });

    const shares = [['Crossmint', 0.52, 'chart-1'], ['ForumPay', 0.28, 'chart-2'], ['Blockchain rail', 0.14, 'chart-3'], ['Other', 0.06, 'chart-4']];
    const total = 12840.5;
    const share = el('div', { className: 'share' }, [
      el('div', { className: 'share__bar', attrs: { 'aria-hidden': 'true' } }, shares.map(([, s, c], i) => { const seg = el('span', { className: `share__seg ${c}` }); seg.style.setProperty('flex-grow', String(s)); seg.style.setProperty('--i', String(i)); return seg; })),
      el('ul', { className: 'share__list' }, shares.map(([n, s, c]) => el('li', { className: `share__row ${c}` }, [el('span', { className: 'share__swatch', attrs: { 'aria-hidden': 'true' } }), el('span', { text: n }), el('span', { className: 'share__value', text: fmt.money(total * s) }), el('span', { className: 'share__pct', text: `${Math.round(s * 100)}%` })]))),
    ]);
    share.addEventListener('pointerover', (e) => {
      const row = e.target.closest('.share__row');
      share.classList.toggle('is-focusing', Boolean(row));
      const idx = row ? Array.from(row.parentNode.children).indexOf(row) : -1;
      share.querySelectorAll('.share__seg').forEach((s, i) => s.classList.toggle('is-active', i === idx));
      share.querySelectorAll('.share__row').forEach((r, i) => r.classList.toggle('is-active', i === idx));
    });
    share.addEventListener('pointerleave', () => share.classList.remove('is-focusing'));
    return [
      h.example('Volume (line and area)', [el('div', { className: 'card card__body' }, [el('p', { className: 'card__title', text: 'Volume' }), host])], {
        html: false, note: 'Static example with the hover state shown (.chart.is-scrubbing). On Overview the guide follows the pointer and the line draws on first load.',
        code: '<div class="chart is-scrubbing">\n  <svg>\n    <line class="chart__grid"/> <text class="chart__axis"/>\n    <path class="chart__area" fill="url(#gradient)"/> <path class="chart__line"/>\n    <line class="chart__guide"/> <g class="chart__marker"><circle class="chart__ring"/><circle class="chart__dot"/></g>\n  </svg>\n  <div class="chart__tooltip">…</div>\n</div>',
      }),
      h.example('Share bar', [el('div', { className: 'card card__body' }, [share])], { note: 'Hover a legend row to focus its segment.' }),
    ];
  });
})();
