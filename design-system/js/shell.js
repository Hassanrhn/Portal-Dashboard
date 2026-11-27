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

  /* Sidebar collapse (desktop) ---------------------------------------------- */
  const collapseToggle = app.querySelector('[data-collapse-toggle]');
  const setCollapsed = (collapsed) => {
    app.classList.toggle('is-collapsed', collapsed);
    collapseToggle?.setAttribute('aria-pressed', String(collapsed));
    collapseToggle?.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    Portal.store.set('sidebar', collapsed ? 'collapsed' : 'expanded');
  };
  setCollapsed(Portal.store.get('sidebar') === 'collapsed');
  collapseToggle?.addEventListener('click', () => setCollapsed(!app.classList.contains('is-collapsed')));

  /* Drawer (mobile) ---------------------------------------------------------- */
  const menuButton = app.querySelector('[data-nav-open]');
  const sidebar = app.querySelector('.sidebar');
  const setNavOpen = (open) => {
    app.classList.toggle('is-nav-open', open);
    menuButton?.setAttribute('aria-expanded', String(open));
    if (open) sidebar.querySelector('a, button')?.focus();
    else if (document.activeElement && sidebar.contains(document.activeElement)) menuButton?.focus();
  };
  menuButton?.addEventListener('click', () => setNavOpen(true));
  app.querySelector('[data-nav-close]')?.addEventListener('click', () => setNavOpen(false));
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
