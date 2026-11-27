/*
 * App shell behaviour: sidebar collapse, mobile drawer, Live/Test environment, ⌘K command palette.
 * Requires theme.js, icons.js and components.js.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const root = document.documentElement;
  const app = document.querySelector('[data-app]');
  if (!app) return;

  /* Sidebar toggle (one header button): collapses to icons on desktop, opens the drawer below 860px */
  const toggle = document.querySelector('[data-sidebar-toggle]');
  const sidebar = app.querySelector('.sidebar');
  const isCompact = () => window.matchMedia('(max-width: 860px)').matches;
  const setCollapsed = (collapsed) => {
    app.classList.toggle('is-collapsed', collapsed);
    if (collapsed) root.dataset.sidebar = 'collapsed'; else delete root.dataset.sidebar;
    Portal.store.set('sidebar', collapsed ? 'collapsed' : 'expanded');
    syncToggle();
  };
  const setNavOpen = (open) => {
    app.classList.toggle('is-nav-open', open);
    syncToggle();
    if (open) sidebar.querySelector('a, button')?.focus();
    else if (sidebar.contains(document.activeElement)) toggle?.focus();
  };
  function syncToggle() {
    if (!toggle) return;
    const expanded = isCompact() ? app.classList.contains('is-nav-open') : !app.classList.contains('is-collapsed');
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? 'Hide sidebar' : 'Show sidebar');
  }
  setCollapsed(Portal.store.get('sidebar') === 'collapsed');
  toggle?.addEventListener('click', () => (isCompact() ? setNavOpen(!app.classList.contains('is-nav-open')) : setCollapsed(!app.classList.contains('is-collapsed'))));
  app.querySelector('[data-nav-close]')?.addEventListener('click', () => setNavOpen(false));
  window.matchMedia('(max-width: 860px)').addEventListener('change', syncToggle);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && app.classList.contains('is-nav-open')) setNavOpen(false);
  });

  /* Environment ---------------------------------------------------------------- */
  const ENVS = ['live', 'test'];
  const envToggles = () => document.querySelectorAll('[data-env-toggle]');
  const setEnv = (env, { announce = false } = {}) => {
    if (!ENVS.includes(env)) return;
    root.dataset.env = env;
    Portal.store.set('env', env);
    envToggles().forEach((toggle) => {
      toggle.setAttribute('aria-checked', String(env === 'test'));
      toggle.querySelector('.switch')?.setAttribute('aria-checked', String(env === 'test'));
    });
    if (announce) Portal.toast(env === 'test' ? 'Switched to Test mode. No real money moves.' : 'Switched to Live mode.');
  };
  Portal.env = { get: () => root.dataset.env, set: setEnv };
  setEnv(ENVS.includes(Portal.store.get('env')) ? Portal.store.get('env') : 'live');
  envToggles().forEach((toggle) => toggle.addEventListener('click', () => setEnv(root.dataset.env === 'test' ? 'live' : 'test', { announce: true })));

  /* Pages not built yet: explain instead of following a dead link ------------------ */
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-soon]');
    if (!link) return;
    event.preventDefault();
    Portal.toast(`${link.dataset.soon} is designed next. This prototype covers Overview and Sign in.`, { icon: 'alert' });
  });

  /* Command palette ------------------------------------------------------------- */
  const dialog = document.getElementById('command-palette');
  if (!dialog) return;
  const input = dialog.querySelector('.cmd__input');
  const list = dialog.querySelector('.cmd__list');
  let results = [];
  let activeIndex = 0;

  function collectCommands() {
    const pages = Array.from(app.querySelectorAll('.sidebar a.nav__item')).map((link) => ({
      group: 'Go to',
      label: link.querySelector('.nav__label')?.textContent.trim() || link.textContent.trim(),
      run: () => link.click(),
    }));
    const actions = [
      { group: 'Actions', label: 'Toggle dark mode', icon: 'moon', run: () => Portal.theme.toggle() },
      { group: 'Actions', label: root.dataset.env === 'test' ? 'Switch to Live mode' : 'Switch to Test mode', icon: 'refund',
        run: () => setEnv(root.dataset.env === 'test' ? 'live' : 'test', { announce: true }) },
    ];
    const records = (Portal.searchIndex || []).map((r) => ({ group: r.group || 'Payments', label: r.label, hint: r.hint, icon: r.icon || 'payments', run: r.run }));
    return [...records, ...pages, ...actions];
  }

  function render(query) {
    const q = query.trim().toLowerCase();
    results = collectCommands().filter((c) => !q || `${c.label} ${c.hint || ''}`.toLowerCase().includes(q)).slice(0, 12);
    activeIndex = 0;
    list.replaceChildren();
    if (!results.length) {
      const empty = document.createElement('p');
      empty.className = 'cmd__empty';
      empty.textContent = 'No matches. Try a request ID, an order reference or a page name.';
      list.appendChild(empty);
      return;
    }
    let lastGroup = null;
    results.forEach((command, index) => {
      if (command.group !== lastGroup) {
        const heading = document.createElement('div');
        heading.className = 'cmd__group';
        heading.textContent = command.group;
        list.appendChild(heading);
        lastGroup = command.group;
      }
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'cmd__item';
      item.id = `cmd-${index}`;
      item.setAttribute('role', 'option');
      const svg = Portal.icon(command.icon || 'arrow-right');
      if (svg) item.appendChild(svg);
      const label = document.createElement('span');
      label.textContent = command.label;
      item.appendChild(label);
      if (command.hint) {
        const hint = document.createElement('span');
        hint.className = 'cmd__hint';
        hint.textContent = command.hint;
        item.appendChild(hint);
      }
      item.addEventListener('click', () => execute(index));
      item.addEventListener('pointermove', () => highlight(index));
      list.appendChild(item);
    });
    highlight(0);
  }

  function highlight(index) {
    activeIndex = index;
    list.querySelectorAll('.cmd__item').forEach((el, i) => el.setAttribute('aria-selected', String(i === index)));
    const active = list.querySelector(`#cmd-${index}`);
    active?.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', active ? active.id : '');
  }

  function execute(index) {
    const command = results[index];
    if (!command) return;
    Portal.dialog.close(dialog);
    command.run();
  }

  function openPalette() {
    input.value = '';
    render('');
    Portal.dialog.open(dialog);
    input.focus();
  }

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!results.length) return;
      highlight((activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      execute(activeIndex);
    }
  });
  document.querySelectorAll('[data-command-open]').forEach((el) => el.addEventListener('click', openPalette));
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      dialog.open ? Portal.dialog.close(dialog) : openPalette();
    }
  });
})();

/*
 * Custom context menu (right-click / long-press) replacing the browser menu on dashboard pages.
 * Offers actions that fit what was clicked: copy a value or selection, open a row or link, page actions.
 * Text fields keep the native menu so paste/spellcheck still work.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  if (!document.querySelector('[data-app]') || !Portal.menu) return;

  const copy = async (value, toast) => {
    if (await Portal.copyText(value)) Portal.toast(toast); else Portal.toast('Copy is blocked in this browser.', { icon: 'alert' });
  };

  /** Actions depend on what was right-clicked; only the most relevant ones are offered. */
  function itemsFor(target) {
    const selection = String(window.getSelection() || '').trim();
    if (selection) {
      return [
        { label: 'Copy', icon: 'copy', onSelect: () => copy(selection, 'Copied') },
        { label: `Search for “${selection.length > 24 ? `${selection.slice(0, 22)}…` : selection}”`, icon: 'search', onSelect: () => openSearch(selection) },
      ];
    }
    const row = target.closest('tr.is-clickable, tbody tr');
    if (row) {
      const ids = Array.from(row.querySelectorAll('[data-copy]')).map((b) => b.dataset.copy);
      const header = row.closest('table')?.querySelector('thead th')?.textContent.trim() || 'ID';
      return [
        row.classList.contains('is-clickable') && { label: 'Open details', icon: 'arrow-right', onSelect: () => row.click() },
        ids[0] && { label: `Copy ${header.toLowerCase()}`, icon: 'copy', description: ids[0], onSelect: () => copy(ids[0], 'Copied') },
        ids[1] && { label: 'Copy reference', icon: 'copy', description: ids[1], onSelect: () => copy(ids[1], 'Copied') },
        { label: 'Copy row', icon: 'file', onSelect: () => copy(Array.from(row.cells).map((c) => c.innerText.replace(/\s+/g, ' ').trim()).join('\t'), 'Row copied') },
      ].filter(Boolean);
    }
    const head = target.closest('thead th');
    if (head) {
      const filter = head.querySelector('button');
      return [filter && { label: `Filter ${head.textContent.trim().toLowerCase()}`, icon: 'filter', onSelect: () => filter.click() }].filter(Boolean);
    }
    const copyable = target.closest('.copy')?.querySelector('[data-copy]') || target.closest('[data-copy]');
    if (copyable) return [{ label: 'Copy', icon: 'copy', description: copyable.dataset.copy.length > 36 ? `${copyable.dataset.copy.slice(0, 34)}…` : copyable.dataset.copy, onSelect: () => copy(copyable.dataset.copy, 'Copied') }];
    const link = target.closest('a[href]');
    if (link) {
      return [
        { label: 'Open in new tab', icon: 'external', onSelect: () => window.open(link.href, '_blank', 'noopener') },
        { label: 'Copy link', icon: 'link', onSelect: () => copy(link.href, 'Link copied') },
      ];
    }
    return [
      { label: 'New payment', icon: 'plus', onSelect: () => Portal.createPayment?.() },
      { label: 'Search', icon: 'search', description: '⌘K', onSelect: () => openSearch('') },
      { label: 'Copy page link', icon: 'link', onSelect: () => copy(window.location.href, 'Page link copied') },
    ];
  }

  function openSearch(query) {
    document.querySelector('[data-command-open]')?.click();
    const input = document.querySelector('.cmd__input');
    if (input && query) { input.value = query; input.dispatchEvent(new Event('input')); }
  }

  document.addEventListener('contextmenu', (event) => {
    if (event.target.closest('input, textarea, [contenteditable="true"]') || event.shiftKey) return; // Shift+right-click = native menu
    event.preventDefault();
    const anchor = document.createElement('span');
    anchor.className = 'context-anchor';
    anchor.tabIndex = -1;
    anchor.style.left = `${event.clientX}px`;
    anchor.style.top = `${event.clientY}px`;
    document.body.appendChild(anchor);
    const items = itemsFor(event.target);
    if (!items.length) { anchor.remove(); return; }
    Portal.menu.open(anchor, items);
    const cleanup = new MutationObserver(() => { if (!document.querySelector('.menu')) { anchor.remove(); cleanup.disconnect(); } });
    cleanup.observe(document.body, { childList: true });
  });
})();
