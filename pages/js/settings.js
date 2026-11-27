/*
 * Settings: one form across four tabs (Organization, Security, Checkout, Notifications) with a shared
 * unsaved-changes bar (Portal.trackDirty). Save validates every tab and jumps to the first error.
 * Security lists active sessions with sign-out; Organization ends with a "Close account" danger zone.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, fmt } = Portal;
  const sessions = Portal.data.team.sessions;
  const $ = (s, scope = document) => scope.querySelector(s);
  const NOW = Date.UTC(2026, 10, 27, 12);
  const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
  const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  const MAX_RECIPIENTS = 10;
  const SAMPLE_REQUEST_ID = 'req_8f3a91c2e7';

  const form = $('[data-settings-form]');
  const tabs = $('[data-tabs]');
  const lines = (value) => value.split(/[\n,]+/).map((v) => v.trim()).filter(Boolean);

  /* Validation ------------------------------------------------------------------------- */
  function isIpv4OrCidr(value) {
    const [ip, mask, extra] = value.split('/');
    if (extra !== undefined) return false;
    const parts = ip.split('.');
    const octetsOk = parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
    const maskOk = mask === undefined || (/^\d{1,2}$/.test(mask) && Number(mask) <= 32);
    return octetsOk && maskOk;
  }

  function httpsUrlError(value) {
    if (!value) return 'Enter a URL.';
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return 'Use an https:// URL.';
      if (!HOSTNAME.test(url.hostname)) return 'Enter a URL with a valid domain.';
    } catch {
      return 'Enter a full URL, such as https://shop.example.com/done.';
    }
    return '';
  }

  // Each rule: [tab, input id, () => error message or ''].
  const RULES = [
    ['org', 'org-display', (v) => (v.trim() ? '' : 'Enter a display name.')],
    ['org', 'org-legal', (v) => (v.trim().length >= 2 ? '' : 'Enter the legal name of your company.')],
    ['org', 'org-email', (v) => (EMAIL.test(v.trim()) ? '' : 'Enter a valid email, such as help@company.com.')],
    ['security', 'sec-ips', (v) => {
      const bad = lines(v).filter((line) => !isIpv4OrCidr(line));
      return bad.length ? `Not a valid IPv4 address or CIDR range: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}` : '';
    }],
    ['checkout', 'co-success', (v) => httpsUrlError(v.trim())],
    ['checkout', 'co-cancel', (v) => httpsUrlError(v.trim())],
    ['checkout', 'co-domains', (v) => {
      const bad = lines(v).filter((d) => !HOSTNAME.test(d));
      return bad.length ? `Not a valid domain: ${bad.slice(0, 3).join(', ')}. Use a bare domain, such as shop.example.com.` : '';
    }],
    ['notifications', 'rule-rate', (v) => (/^\d{1,2}$/.test(v.trim()) && Number(v) >= 50 && Number(v) <= 99 ? '' : 'Enter a whole number from 50 to 99.')],
    ['notifications', 'ch-recipients', (v) => {
      const list = lines(v);
      const emailOn = $('[data-name="channelEmail"]').getAttribute('aria-checked') === 'true';
      if (emailOn && !list.length) return 'Add at least one recipient, or turn off email.';
      if (list.length > MAX_RECIPIENTS) return `Up to ${MAX_RECIPIENTS} recipients.`;
      const bad = list.filter((e) => !EMAIL.test(e));
      return bad.length ? `Not a valid email: ${bad.slice(0, 3).join(', ')}` : '';
    }],
  ];

  function validate() {
    const failed = RULES.filter(([, id, check]) => !Portal.fieldError($(`#${id}`), check($(`#${id}`).value)));
    if (!failed.length) return true;
    const [tab, id] = failed[0];
    tabs.portalSelect(tab);
    $(`#${id}`).focus();
    Portal.toast(`Fix ${failed.length === 1 ? 'the highlighted field' : `${failed.length} highlighted fields`} before saving`, { icon: 'alert' });
    return false;
  }

  Portal.trackDirty(form, $('[data-save-bar]'), { onSave: () => validate() });
  form.addEventListener('submit', (event) => event.preventDefault());

  /* Checkout redirect preview ------------------------------------------------------------ */
  function renderPreview() {
    const value = $('#co-success').value.trim();
    const preview = $('[data-redirect-preview]');
    if (httpsUrlError(value)) { preview.replaceChildren(el('span', { className: 'u-muted', text: 'Enter a valid https success URL to see the redirect.' })); return; }
    const url = new URL(value);
    const query = `${url.search ? '&' : '?'}requestId=${SAMPLE_REQUEST_ID}&status=PAID`;
    preview.replaceChildren(`${url.origin}${url.pathname}${url.search}`, el('span', { className: 'redirect-preview__query', text: query }));
  }
  $('#co-success').addEventListener('input', renderPreview);
  $('[data-save-bar] [data-discard]').addEventListener('click', renderPreview);
  renderPreview();

  /* Active sessions ------------------------------------------------------------------------ */
  function renderSessions() {
    const others = sessions.filter((s) => !s.current);
    $('[data-signout-all]').disabled = !others.length;
    $('[data-sessions]').replaceChildren(...sessions.map((s) => el('li', { className: 'rows__item' }, [
      el('span', { className: 'rows__main' }, [
        el('span', { text: s.device }),
        el('span', { className: 'rows__sub', text: `${s.location} · ${s.ip}` }),
      ]),
      el('span', { className: 'rows__meta' }, [
        el('span', { className: 'u-muted', text: s.current ? 'Active now' : fmt.relative(s.lastActive, NOW) }),
        s.current ? Portal.badge('active', 'This device') : btn('Sign out', { size: 'sm', onClick: () => signOut(s), attrs: { 'aria-label': `Sign out ${s.device} in ${s.location}` } }),
      ]),
    ])));
  }

  async function signOut(session) {
    const ok = await Portal.confirm({
      title: 'Sign out this session?', confirmLabel: 'Sign out',
      message: 'Whoever is using it has to sign in again with their password and two-factor code.',
      details: [['Device', session.device], ['Location', `${session.location} · ${session.ip}`]],
    });
    if (!ok) return;
    sessions.splice(sessions.indexOf(session), 1);
    renderSessions();
    Portal.toast(`Signed out ${session.device}`);
  }

  $('[data-signout-all]').addEventListener('click', async () => {
    const others = sessions.filter((s) => !s.current);
    const ok = await Portal.confirm({
      title: 'Sign out all other sessions?', tone: 'danger', confirmLabel: 'Sign out all',
      message: `${others.length} other ${others.length === 1 ? 'session is' : 'sessions are'} signed out. This device stays signed in.`,
    });
    if (!ok) return;
    others.forEach((s) => sessions.splice(sessions.indexOf(s), 1));
    renderSessions();
    Portal.toast('Signed out all other sessions');
  });

  Portal.lazy.register('sessions', { fetch: () => Portal.request(sessions), render: renderSessions });

  /* Danger zone ------------------------------------------------------------------------------ */
  $('[data-close-account]').addEventListener('click', async () => {
    const ok = await Portal.confirm({
      title: 'Request to close this account?', tone: 'danger', confirmLabel: 'Send close request',
      message: 'Your account manager contacts you to confirm, settle open balances and stop Live payments. Nothing closes until then.',
      details: [['Partner', 'The Orange Card'], ['Requested by', 'pocket@pocket.com']],
    });
    if (ok) Portal.toast('Close request sent to your account manager');
  });

  /* Deep link to a tab (?tab=checkout) -------------------------------------------------------- */
  const tab = new URLSearchParams(window.location.search).get('tab');
  if (tab) tabs.portalSelect(tab);
})();
