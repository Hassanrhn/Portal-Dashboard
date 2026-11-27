/*
 * Team: members table (role change drawer, remove), pending invites (resend with cooldown, revoke),
 * an invite drawer that parses and validates up to 10 emails, and the roles and permissions matrix.
 * The signed-in admin (pocket@pocket.com) cannot remove themself or change their own role.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl, fmt } = Portal;
  const { members, invites } = Portal.data.team;
  const $ = (s, scope = document) => scope.querySelector(s);
  const NOW = Date.UTC(2026, 10, 27, 12);
  const ME = 'pocket@pocket.com';
  const MAX_INVITES = 10;
  const RESEND_COOLDOWN_MS = 30000;
  const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;

  const ROLES = [
    { id: 'Admin', desc: 'Everything, including team, security and go-live.' },
    { id: 'Developer', desc: 'API keys, webhooks, docs and test payments.' },
    { id: 'Finance', desc: 'Payments, refunds, payout approval and reports. Never sees API keys.' },
    { id: 'Viewer', desc: 'Read-only access to payments, cards and reports.' },
  ];
  const MATRIX = [
    ['Payments', ['Admin', 'Developer', 'Finance']],
    ['Refunds', ['Admin', 'Finance']],
    ['Payouts approval', ['Admin', 'Finance']],
    ['Cards', ['Admin', 'Developer']],
    ['API keys', ['Admin', 'Developer']],
    ['Webhooks', ['Admin', 'Developer']],
    ['Reports', ['Admin', 'Developer', 'Finance', 'Viewer']],
    ['Team and settings', ['Admin']],
  ];

  const initials = (name) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const isMe = (m) => m.email === ME;

  function roleCards(name, selected) {
    return el('div', { className: 'radio-cards radio-cards--2', attrs: { role: 'radiogroup', 'aria-label': 'Role' } }, ROLES.map((r) => el('label', { className: 'radio-card' }, [
      el('input', { attrs: { type: 'radio', name, value: r.id, checked: r.id === selected } }),
      el('span', { className: 'radio-card__body' }, [el('span', { className: 'radio-card__title', text: r.id }), el('span', { className: 'radio-card__desc', text: r.desc })]),
      el('span', { className: 'radio-card__dot', attrs: { 'aria-hidden': 'true' } }),
    ])));
  }
  const checkedRole = (scope) => scope.querySelector('input[type="radio"]:checked')?.value;

  /* Members ----------------------------------------------------------------------------- */
  const membersTable = Portal.dataTable($('[data-members]'), {
    pageSize: 20,
    rowLabel: (m) => m.email,
    empty: { icon: 'invite', title: 'No members yet', text: 'Invite your team to share access.' },
    columns: [
      { label: 'Member', filter: { type: 'text', value: (m) => `${m.name} ${m.email}`, placeholder: 'Name or email' }, render: (m) => el('span', { className: 'table__lead' }, [
        el('span', { className: 'tile', text: initials(m.name), attrs: { 'aria-hidden': 'true' } }),
        el('span', {}, [m.name, isMe(m) ? el('span', { className: 'chip team__you', text: 'You' }) : null, el('span', { className: 'cell-sub', text: m.email })]),
      ]) },
      { label: 'Role', filter: { type: 'options', value: (m) => m.role, options: ROLES.map((r) => r.id) }, render: (m) => m.role },
      { label: 'Two-factor', filter: { type: 'options', value: (m) => m.twoFactor, options: [true, false], label: (on) => (on ? 'On' : 'Off') }, render: (m) => (m.twoFactor ? Portal.badge('active', 'On') : Portal.badge('review', 'Off')) },
      { label: 'Last active', filter: { type: 'date', value: (m) => m.lastActive }, render: (m) => el('span', { className: 'u-muted', text: fmt.relative(m.lastActive, NOW) }) },
      { label: 'Actions', className: 'cell-actions', render: (m) => Portal.menu.button(() => memberMenu(m), `Actions for ${m.name}`) },
    ],
  });

  function memberMenu(m) {
    const self = isMe(m);
    return [
      { label: 'Change role…', icon: 'shield', description: self ? 'Ask another admin to change your role' : `Currently ${m.role}`, disabled: self, onSelect: () => openRoleDrawer(m) },
      'separator',
      { label: 'Remove member', icon: 'trash', tone: 'danger', description: self ? "You can't remove yourself" : 'Signs them out and removes access', disabled: self, onSelect: () => removeMember(m) },
    ];
  }

  function renderMembers() {
    $('[data-member-count]').textContent = fmt.count(members.length);
    membersTable.setRows(members);
  }

  function openRoleDrawer(m) {
    const cards = roleCards('member-role', m.role);
    const drawer = Portal.drawer.open({
      title: 'Change role',
      subtitle: `${m.name} · ${m.email}`,
      body: [el('p', { className: 't-meta', text: 'The new role applies the next time they load a page.' }), cards],
    });
    drawer.setFooter([
      btn('Cancel', { attrs: { 'data-dialog-close': '' } }),
      btn('Save role', { variant: 'primary', onClick: async () => {
        const role = checkedRole(cards);
        if (role === m.role) { drawer.close(); return; }
        const ok = await Portal.confirm({
          title: `Make ${m.name} ${role === 'Admin' ? 'an' : 'a'} ${role}?`, confirmLabel: 'Change role',
          message: ROLES.find((r) => r.id === role).desc,
          details: [['Member', m.email], ['From', m.role], ['To', role]],
        });
        if (!ok) return;
        m.role = role;
        drawer.close();
        renderMembers();
        Portal.toast(`${m.name} is now ${role}`);
      } }),
    ]);
  }

  async function removeMember(m) {
    const ok = await Portal.confirm({
      title: `Remove ${m.name}?`, tone: 'danger', confirmLabel: 'Remove member',
      message: 'They are signed out everywhere and lose access to The Orange Card right away. You can invite them again later.',
      details: [['Email', m.email], ['Role', m.role]],
    });
    if (!ok) return;
    members.splice(members.indexOf(m), 1);
    renderMembers();
    Portal.toast(`${m.name} removed`);
  }

  Portal.lazy.register('members', { fetch: () => Portal.request(members), render: renderMembers });

  /* Pending invites ---------------------------------------------------------------------- */
  const resendButtons = new Map(); // invite id → button, rebuilt on each render
  let cooldownTimer = null;

  const invitesTable = Portal.dataTable($('[data-invites]'), {
    pageSize: 20,
    rowLabel: (i) => i.email,
    empty: { icon: 'mail', title: 'No pending invites', text: 'People you invite appear here until they accept.', action: btn('Invite members', { iconName: 'invite', onClick: openInviteDrawer }) },
    columns: [
      { label: 'Email', filter: { type: 'text', value: (i) => i.email, placeholder: 'e.g. name@company.com' }, render: (i) => i.email },
      { label: 'Role', filter: { type: 'options', value: (i) => i.role, options: ROLES.map((r) => r.id) }, render: (i) => i.role },
      { label: 'Sent', filter: { type: 'date', value: (i) => i.sent }, render: (i) => el('span', { className: 'u-muted', text: fmt.relative(i.sent, NOW) }) },
      { label: 'Actions', className: 'cell-actions', render: (i) => el('span', { className: 'team__actions' }, [resendButton(i), btn('Revoke', { variant: 'ghost', size: 'sm', onClick: () => revokeInvite(i), attrs: { 'aria-label': `Revoke invite for ${i.email}` } })]) },
    ],
  });

  function resendButton(invite) {
    const button = btn('Resend', { size: 'sm', iconName: 'send', onClick: () => resendInvite(invite) });
    resendButtons.set(invite.id, button);
    syncResend(invite, button);
    return button;
  }

  function syncResend(invite, button) {
    const left = Math.ceil(((invite.cooldownUntil || 0) - Date.now()) / 1000);
    button.disabled = left > 0;
    button.lastChild.textContent = left > 0 ? `Resend in ${left} s` : 'Resend';
    button.setAttribute('aria-label', left > 0 ? `Resend available in ${left} seconds` : `Resend invite to ${invite.email}`);
  }

  function tickCooldowns() {
    let active = false;
    invites.forEach((invite) => {
      const button = resendButtons.get(invite.id);
      if (button) syncResend(invite, button);
      if ((invite.cooldownUntil || 0) > Date.now()) active = true;
    });
    if (!active) { window.clearInterval(cooldownTimer); cooldownTimer = null; }
  }

  async function resendInvite(invite) {
    const button = resendButtons.get(invite.id);
    button.setAttribute('aria-busy', 'true');
    await Portal.request(null, { delay: 400 });
    button.removeAttribute('aria-busy');
    invite.cooldownUntil = Date.now() + RESEND_COOLDOWN_MS;
    invite.sent = new Date(NOW).toISOString();
    syncResend(invite, button);
    if (!cooldownTimer) cooldownTimer = window.setInterval(tickCooldowns, 1000);
    Portal.toast(`Invite resent to ${invite.email}`, { icon: 'mail' });
  }

  async function revokeInvite(invite) {
    const ok = await Portal.confirm({
      title: 'Revoke this invite?', tone: 'danger', confirmLabel: 'Revoke invite',
      message: 'The link in their email stops working. You can invite them again later.',
      details: [['Email', invite.email], ['Role', invite.role]],
    });
    if (!ok) return;
    invites.splice(invites.indexOf(invite), 1);
    renderInvites();
    Portal.toast(`Invite for ${invite.email} revoked`);
  }

  function renderInvites() {
    resendButtons.clear();
    $('[data-invite-count]').textContent = fmt.count(invites.length);
    invitesTable.setRows(invites);
  }

  Portal.lazy.register('invites', { fetch: () => Portal.request(invites), render: renderInvites });

  /* Invite drawer ---------------------------------------------------------------------- */
  function parseEmails(text) {
    return text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  }

  function emailProblem(email, index, list) {
    if (!EMAIL.test(email)) return 'not a valid email';
    if (list.indexOf(email) !== index) return 'listed twice';
    if (members.some((m) => m.email === email)) return 'already a member';
    if (invites.some((i) => i.email === email)) return 'already invited';
    return '';
  }

  function openInviteDrawer() {
    const textarea = el('textarea', { className: 'input textarea', attrs: { id: 'invite-emails', rows: '4', maxlength: '1200', placeholder: 'name@company.com, another@company.com', autocomplete: 'off', spellcheck: 'false', inputmode: 'email', 'aria-describedby': 'invite-help' } });
    const chips = el('div', { className: 'chips team__chips', attrs: { 'aria-live': 'polite' } });
    const cards = roleCards('invite-role', 'Developer');
    const renderChips = () => {
      const list = parseEmails(textarea.value);
      chips.replaceChildren(...list.map((email, i) => {
        const problem = emailProblem(email, i, list) || (i >= MAX_INVITES ? 'over the limit of 10' : '');
        return el('span', { className: `chip${problem ? ' chip--invalid' : ''}`, attrs: { title: problem || false } }, [email, problem ? el('span', { className: 'u-sr-only', text: `: ${problem}` }) : null]);
      }));
    };
    textarea.addEventListener('input', renderChips);

    const drawer = Portal.drawer.open({
      title: 'Invite members',
      subtitle: 'They get an email with a link that expires in 7 days.',
      body: [
        el('div', { className: 'field' }, [
          el('label', { className: 'field__label', text: 'Email addresses', attrs: { for: 'invite-emails' } }),
          textarea,
          el('p', { className: 'field__help', text: `Separate with commas or new lines. Up to ${MAX_INVITES} at a time.`, attrs: { id: 'invite-help' } }),
          chips,
        ]),
        el('fieldset', { className: 'field' }, [el('legend', { className: 'field__label', text: 'Role' }), cards]),
      ],
    });
    drawer.setFooter([
      btn('Cancel', { attrs: { 'data-dialog-close': '' } }),
      btn('Send invites', { variant: 'primary', iconName: 'send', onClick: (event) => sendInvites(event.currentTarget, textarea, cards, drawer) }),
    ]);
    textarea.focus();
  }

  function inviteError(list) {
    if (!list.length) return 'Enter at least one email address.';
    if (list.length > MAX_INVITES) return `You can invite up to ${MAX_INVITES} people at a time. Remove ${list.length - MAX_INVITES}.`;
    const problems = list.map((email, i) => [email, emailProblem(email, i, list)]).filter(([, p]) => p);
    return problems.length ? problems.map(([email, p]) => `${email} is ${p}`).join('; ') + '.' : '';
  }

  async function sendInvites(button, textarea, cards, drawer) {
    const list = parseEmails(textarea.value);
    if (!Portal.fieldError(textarea, inviteError(list))) { textarea.focus(); return; }
    const role = checkedRole(cards);
    button.setAttribute('aria-busy', 'true');
    await Portal.request(null, { delay: 600 });
    button.removeAttribute('aria-busy');
    const sent = new Date(NOW).toISOString();
    list.forEach((email, i) => invites.unshift({ id: `inv_${Date.now().toString(36)}${i}`, email, role, sent }));
    drawer.close();
    renderInvites();
    Portal.toast(list.length === 1 ? `Invite sent to ${list[0]}` : `${list.length} invites sent`, { icon: 'mail' });
  }

  $('[data-invite]').addEventListener('click', openInviteDrawer);

  /* Roles and permissions matrix ---------------------------------------------------------- */
  function renderMatrix(rows, section) {
    const cell = (allowed, role, area) => el('td', {}, [allowed
      ? el('span', { className: 'matrix__yes' }, [iconEl('check'), el('span', { className: 'u-sr-only', text: `${role} can manage ${area}` })])
      : el('span', { className: 'matrix__no' }, [el('span', { text: '—', attrs: { 'aria-hidden': 'true' } }), el('span', { className: 'u-sr-only', text: `${role} cannot manage ${area}` })])]);
    $('[data-roles]', section).replaceChildren(
      el('div', { className: 'table-wrap' }, [el('table', { className: 'table matrix' }, [
        el('thead', {}, [el('tr', {}, [el('th', { text: 'Area', attrs: { scope: 'col' } }), ...ROLES.map((r) => el('th', { text: r.id, attrs: { scope: 'col' } }))])]),
        el('tbody', {}, rows.map(([area, allowed]) => el('tr', {}, [el('th', { text: area, attrs: { scope: 'row' } }), ...ROLES.map((r) => cell(allowed.includes(r.id), r.id, area))]))),
      ])]),
      el('p', { className: 't-meta matrix__note', text: 'Viewers can open payments, cards and reports but cannot change them. Finance never sees API keys.' }),
    );
  }

  Portal.lazy.register('roles', { fetch: () => Portal.request(MATRIX), render: renderMatrix });
})();
