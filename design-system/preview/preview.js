/* Gallery-only behaviour: live colour list, token tuning panel, demo triggers. */
(function () {
  'use strict';

  const Portal = window.Portal;
  const root = document.documentElement;

  /* Colour roles: read the live computed value of each semantic token. */
  const COLOR_TOKENS = [
    'bg-app', 'bg-sidebar', 'bg-surface', 'bg-raised', 'bg-hover', 'bg-muted',
    'border-default', 'border-strong', 'border-subtle',
    'text-primary', 'text-secondary', 'text-tertiary',
    'action-primary-bg', 'action-secondary-bg', 'accent-solid', 'accent-subtle',
    'status-success-fg', 'status-success-bg', 'status-warning-fg', 'status-warning-bg',
    'status-danger-fg', 'status-danger-bg', 'status-info-fg', 'status-info-bg',
    'chart-1', 'chart-2', 'chart-3', 'chart-4',
  ];
  const grid = document.querySelector('[data-color-grid]');

  function toHex(color) {
    const probe = document.createElement('span');
    probe.style.color = color;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) || [];
    probe.remove();
    const [r, g, b, a] = rgb.map(Number);
    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    return a !== undefined && a < 1 ? `${hex} · ${Math.round(a * 100)}%` : hex;
  }

  function renderColors() {
    const styles = getComputedStyle(root);
    grid.replaceChildren(...COLOR_TOKENS.map((name) => {
      const card = document.createElement('div');
      card.className = 'pv-color';
      const chip = document.createElement('span');
      chip.className = 'pv-color__chip';
      chip.style.setProperty('--chip', `var(--${name})`);
      const label = document.createElement('span');
      label.className = 'pv-color__name';
      label.textContent = name.replace('-', '.');
      const value = document.createElement('span');
      value.className = 'pv-color__value';
      value.textContent = toHex(styles.getPropertyValue(`--${name}`).trim());
      card.append(chip, label, value);
      return card;
    }));
  }
  renderColors();
  new MutationObserver(() => window.setTimeout(renderColors, 280)).observe(root, { attributes: true, attributeFilter: ['data-theme', 'style'] });

  /* Token tuning: writes overrides on <html>; every component bound to the token follows. */
  document.querySelectorAll('[data-tune] [role="radio"]').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const group = swatch.closest('[data-tune]');
      group.querySelectorAll('[role="radio"]').forEach((s) => s.setAttribute('aria-checked', String(s === swatch)));
      if (swatch.dataset.value) root.style.setProperty(group.dataset.tune, swatch.dataset.value);
      else root.style.removeProperty(group.dataset.tune);
    });
  });
  document.querySelectorAll('[data-tune-range]').forEach((range) => {
    range.addEventListener('input', () => {
      const value = `${range.value}${range.dataset.unit}`;
      root.style.setProperty(range.dataset.tuneRange, value);
      document.querySelector(`[data-out="${range.dataset.outTarget}"]`).textContent = value;
    });
  });
  document.querySelector('[data-tune-reset]').addEventListener('click', () => {
    root.removeAttribute('style');
    document.querySelectorAll('[data-tune-range]').forEach((range) => {
      range.value = range.defaultValue;
      document.querySelector(`[data-out="${range.dataset.outTarget}"]`).textContent = `${range.defaultValue}${range.dataset.unit}`;
    });
    document.querySelectorAll('[data-tune] [role="radio"]').forEach((s, i) => s.setAttribute('aria-checked', String(i === 0)));
  });

  /* Demo triggers */
  document.querySelector('[data-demo-toast]').addEventListener('click', () => Portal.toast('API key created'));
  document.querySelector('[data-demo-busy]').addEventListener('click', (event) => {
    const button = event.currentTarget;
    button.setAttribute('aria-busy', 'true');
    window.setTimeout(() => button.removeAttribute('aria-busy'), 1400);
  });
  document.querySelectorAll('.pv-nav a').forEach((link) => link.addEventListener('click', (event) => event.preventDefault()));
})();
