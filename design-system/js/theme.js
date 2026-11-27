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

  /* Preference is "light", "dark" or "system" (default). "system" follows the OS and updates live. */
  const PREFERENCES = ['light', 'dark', 'system'];
  const preference = () => (PREFERENCES.includes(Portal.store.get('theme')) ? Portal.store.get('theme') : 'system');
  const resolve = (pref) => (pref === 'system' ? (systemDark.matches ? 'dark' : 'light') : pref);

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
    preference,
    /** Settings → Appearance: 'light' | 'dark' | 'system' */
    setPreference(pref) {
      if (!PREFERENCES.includes(pref)) return;
      Portal.store.set('theme', pref);
      setTheme(resolve(pref), { persist: false });
    },
  };

  root.dataset.theme = resolve(preference());
  systemDark.addEventListener('change', () => { if (preference() === 'system') setTheme(resolve('system'), { persist: false }); });

  document.addEventListener('DOMContentLoaded', () => {
    syncSwitches(root.dataset.theme);
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-theme-toggle]')) Portal.theme.toggle();
    });
  });
})();
