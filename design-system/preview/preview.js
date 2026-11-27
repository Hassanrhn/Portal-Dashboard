/*
 * Design system docs shell: sidebar navigation, hash routing (#button), Light/Dark preview tabs.
 * Only the selected page is rendered; pages are built on navigation from the PV registry.
 */
(function () {
  'use strict';

  const { PV, Portal } = window;
  const { el } = Portal;
  const root = document.documentElement;
  const $ = (s) => document.querySelector(s);

  const pages = PV.pages;
  const byId = new Map(pages.map((p) => [p.id, p]));
  const main = $('#pv-main');
  const navHost = $('[data-pv-nav]');
  const side = $('#pv-side');
  const filter = $('[data-pv-filter]');
  const openers = document.querySelectorAll('[data-pv-nav-open]');
  const isCompact = window.matchMedia('(max-width: 860px)');
  let currentId = null;

  /* Theme tabs: preview only, never saved, so the app's own theme stays as the user set it. */
  const themeTabs = $('[data-preview-theme]');
  const syncTheme = () => {
    const theme = Portal.theme.get();
    themeTabs.portalSelect?.(theme);
    document.querySelectorAll('[data-pv-theme-switch]').forEach((s) => s.setAttribute('aria-checked', String(theme === 'dark')));
  };
  syncTheme();
  themeTabs.addEventListener('segmented:change', (event) => Portal.theme.set(event.detail.value, { persist: false }));
  let refreshQueued = false;
  new MutationObserver(() => {
    syncTheme();
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => { refreshQueued = false; PV.refreshTokens(main); });
  }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'style'] });

  /* Sidebar ----------------------------------------------------------------------------- */
  const links = new Map();
  navHost.replaceChildren(...PV.groups.map((group) => {
    const items = pages.filter((p) => p.group === group);
    const id = `pv-nav-${group.toLowerCase()}`;
    return el('div', { className: 'pv-side__group', dataset: { group } }, [
      el('p', { className: 'nav__section pv-side__section', text: group, attrs: { id } }),
      el('ul', { className: 'nav pv-side__list', attrs: { 'aria-labelledby': id } }, items.map((p) => {
        const link = el('a', { className: 'nav__item', attrs: { href: `#${p.id}` } }, [el('span', { className: 'nav__label', text: p.title })]);
        links.set(p.id, link);
        return el('li', {}, [link]);
      })),
    ]);
  }));

  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    links.forEach((link, id) => { link.parentElement.hidden = Boolean(q) && !byId.get(id).title.toLowerCase().includes(q); });
    navHost.querySelectorAll('.pv-side__group').forEach((g) => { g.hidden = !g.querySelector('li:not([hidden])'); });
  });
  filter.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const first = navHost.querySelector('li:not([hidden]) a');
    if (first) { event.preventDefault(); first.click(); }
  });

  /* Phone and tablet: the sidebar is a drawer opened from the bar at the top. */
  const setNavOpen = (open) => {
    document.body.classList.toggle('pv-nav-open', open);
    openers.forEach((b) => b.setAttribute('aria-expanded', String(open)));
    side.inert = isCompact.matches && !open;
    if (open) (side.querySelector('[aria-current="page"]') || filter).focus();
  };
  openers.forEach((b) => b.addEventListener('click', () => setNavOpen(true)));
  const focusOpener = () => Array.from(openers).find((b) => b.offsetParent)?.focus();
  document.querySelectorAll('[data-pv-nav-close]').forEach((b) => b.addEventListener('click', () => { setNavOpen(false); focusOpener(); }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && document.body.classList.contains('pv-nav-open')) { setNavOpen(false); focusOpener(); } });
  navHost.addEventListener('click', (event) => { if (event.target.closest('a')) setNavOpen(false); });
  $('.pv-skip')?.addEventListener('click', (event) => { event.preventDefault(); main.querySelector('h1')?.focus(); });
  isCompact.addEventListener('change', () => setNavOpen(false));
  setNavOpen(false);

  /* Pages ----------------------------------------------------------------------------------- */
  function pager(index) {
    const link = (p, dir) => (p ? el('a', { className: `pv-pager__link pv-pager__link--${dir}`, attrs: { href: `#${p.id}` } }, [
      el('span', { className: 't-meta', text: dir === 'prev' ? 'Previous' : 'Next' }),
      el('span', { className: 'pv-pager__title', text: p.title }),
    ]) : el('span'));
    return el('nav', { className: 'pv-pager', attrs: { 'aria-label': 'Previous and next page' } }, [link(pages[index - 1], 'prev'), link(pages[index + 1], 'next')]);
  }

  function render(id, { focus = true } = {}) {
    const page = byId.get(id) || pages[0];
    if (page.id === currentId) return;
    currentId = page.id;
    Portal.menu?.close({ restoreFocus: false });

    const mounts = [];
    const h = PV.helpers(mounts);
    const body = [].concat(page.render(h)).flat().filter(Boolean);
    const heading = el('h1', { className: 'pv-title', text: page.title, attrs: { tabindex: '-1' } });
    main.replaceChildren(
      el('header', { className: 'pv-head' }, [el('p', { className: 'pv-eyebrow', text: page.group }), heading, el('p', { className: 'pv-desc', text: page.desc })]),
      ...body,
      page.tokens ? h.tokens(page.tokens) : null,
      pager(pages.indexOf(page)),
    );

    Portal.hydrateIcons(main);
    Portal.initComponents(main);
    Portal.initTabs(main);
    Portal.enhanceSelects(main);
    mounts.forEach((fn) => fn());
    PV.refreshTokens(main);

    links.forEach((link, linkId) => { if (linkId === page.id) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    links.get(page.id)?.scrollIntoView({ block: 'nearest' });
    $('[data-pv-jump-group]').textContent = page.group;
    $('[data-pv-jump-title]').textContent = page.title;
    document.title = `${page.title} · Portal design system`;
    window.scrollTo(0, 0);
    if (focus) heading.focus({ preventScroll: true });
  }

  function route({ focus = true } = {}) {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id && !byId.has(id)) {
      if (currentId) return; // not a page: leave the current one
      render(pages[0].id, { focus });
      return;
    }
    render(id || pages[0].id, { focus });
    setNavOpen(false);
  }
  window.addEventListener('hashchange', () => route());
  route({ focus: false });
})();
