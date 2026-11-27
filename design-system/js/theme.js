/*
 * Portal namespace, safe storage and theme bootstrap.
 * Load this one WITHOUT defer in <head> so the stored theme applies before first paint.
 */
(function () {
  'use strict';

  const Portal = (window.Portal = window.Portal || {});

  /** localStorage wrapper that never throws (private mode, blocked storage). Only stores UI preferences. */
  Portal.store = {
    get(key) { try { return window.localStorage.getItem(`portal:${key}`); } catch { return null; } },
    set(key, value) { try { window.localStorage.setItem(`portal:${key}`, value); } catch { /* preference only */ } },
  };

  const THEMES = ['light', 'dark'];
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function initialTheme() {
    const saved = Portal.store.get('theme');
    if (THEMES.includes(saved)) return saved;
    return systemDark.matches ? 'dark' : 'light';
  }

  function syncSwitches(theme) {
    document.querySelectorAll('[data-theme-toggle]').forEach((el) => {
      el.setAttribute('aria-checked', String(theme === 'dark'));
    });
    document.querySelectorAll('[data-theme-label]').forEach((el) => {
      el.textContent = theme === 'dark' ? 'Dark mode' : 'Light mode';
    });
  }

  function setTheme(theme, { animate = true, persist = true } = {}) {
    if (!THEMES.includes(theme)) return;
    if (animate) {
      root.classList.add('is-theming');
      window.setTimeout(() => root.classList.remove('is-theming'), 260);
    }
    root.dataset.theme = theme;
    if (persist) Portal.store.set('theme', theme); // preview-only changes (design system tabs) must not change the app
    syncSwitches(theme);
  }

  Portal.theme = {
    get: () => root.dataset.theme,
    set: setTheme,
    toggle: () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'),
  };

  root.dataset.theme = initialTheme();

  document.addEventListener('DOMContentLoaded', () => {
    syncSwitches(root.dataset.theme);
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-theme-toggle]')) Portal.theme.toggle();
    });
  });
})();
