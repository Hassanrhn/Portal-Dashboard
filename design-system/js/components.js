/*
 * Behaviour for design-system components. Each initialiser is idempotent and driven by data attributes:
 *   [data-segmented]          segmented control (emits "segmented:change" with detail.value)
 *   [data-disclosure]         button toggling the element named by aria-controls
 *   [data-switch]             generic role="switch" button
 *   [data-copy="text"]        copies text, swaps icon to a check
 *   [data-dialog-open="id"]   opens <dialog id>; [data-dialog-close] closes the nearest dialog
 *   [data-progress="0-100"]   progress fill width
 *   Portal.toast(message)     transient confirmation
 * DOM is only ever built with createElement/textContent.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Toast ---------------------------------------------------------------- */
  let toastRegion;
  Portal.toast = function toast(message, { icon = 'check-circle', duration = 2400 } = {}) {
    if (!toastRegion) {
      toastRegion = document.createElement('div');
      toastRegion.className = 'toast-region';
      toastRegion.setAttribute('role', 'status');
      toastRegion.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastRegion);
    }
    const toastEl = document.createElement('div');
    toastEl.className = 'toast';
    const svg = Portal.icon(icon);
    if (svg) toastEl.appendChild(svg);
    const text = document.createElement('span');
    text.textContent = String(message);
    toastEl.appendChild(text);
    toastRegion.appendChild(toastEl);
    while (toastRegion.children.length > 3) toastRegion.firstElementChild.remove();
    window.setTimeout(() => {
      toastEl.classList.add('is-leaving');
      toastEl.addEventListener('animationend', () => toastEl.remove(), { once: true });
    }, duration);
  };

  /* Segmented control ------------------------------------------------------ */
  function initSegmented(group) {
    if (group.dataset.ready) return;
    group.dataset.ready = 'true';
    const options = $$('.segmented__option', group);
    const indicator = document.createElement('span');
    indicator.className = 'segmented__indicator';
    indicator.setAttribute('aria-hidden', 'true');
    group.prepend(indicator);

    const place = () => {
      const active = options.find((o) => o.getAttribute('aria-checked') === 'true') || options[0];
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    };

    const select = (option, { emit = true } = {}) => {
      options.forEach((o) => {
        const on = o === option;
        o.setAttribute('aria-checked', String(on));
        o.tabIndex = on ? 0 : -1;
      });
      place();
      if (emit) group.dispatchEvent(new CustomEvent('segmented:change', { bubbles: true, detail: { value: option.dataset.value } }));
    };

    options.forEach((option, index) => {
      option.addEventListener('click', () => select(option));
      option.addEventListener('keydown', (event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = options[(index + step + options.length) % options.length];
        next.focus();
        select(next);
      });
    });

    const initial = options.find((o) => o.getAttribute('aria-checked') === 'true') || options[0];
    select(initial, { emit: false });
    new ResizeObserver(place).observe(group);
    document.fonts?.ready.then(place);
    requestAnimationFrame(() => group.classList.add('is-ready'));
    group.portalSelect = (value) => {
      const option = options.find((o) => o.dataset.value === value);
      if (option) select(option, { emit: false });
    };
  }

  /* Disclosure (nav groups, expandable rows) ------------------------------ */
  function initDisclosure(button) {
    if (button.dataset.ready) return;
    button.dataset.ready = 'true';
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel) return;
    const sync = () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      panel.classList.toggle('is-open', open);
      panel.inert = !open;
    };
    button.addEventListener('click', () => {
      button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true'));
      sync();
    });
    sync();
  }

  /* Generic switch --------------------------------------------------------- */
  function initSwitch(button) {
    if (button.dataset.ready) return;
    button.dataset.ready = 'true';
    button.addEventListener('click', () => {
      const on = button.getAttribute('aria-checked') !== 'true';
      button.setAttribute('aria-checked', String(on));
      button.dispatchEvent(new CustomEvent('switch:change', { bubbles: true, detail: { checked: on } }));
    });
  }

  /* Copy to clipboard ------------------------------------------------------ */
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    const value = button.dataset.copy;
    try {
      await navigator.clipboard.writeText(value);
      // Never echo long values (secrets, URLs) on screen; data-copy-toast overrides the message.
      Portal.toast(button.dataset.copyToast || (value.length <= 40 ? `Copied ${value}` : 'Copied to clipboard'));
    } catch {
      Portal.toast('Copy is blocked in this browser. Select the text instead.', { icon: 'alert' });
      return;
    }
    button.classList.add('is-copied');
    window.setTimeout(() => button.classList.remove('is-copied'), 1600);
  });

  /* Dialog ------------------------------------------------------------------ */
  Portal.dialog = {
    open(dialog) {
      if (!dialog || dialog.open) return;
      dialog.showModal();
    },
    close(dialog) {
      if (!dialog || !dialog.open || dialog.classList.contains('is-closing')) return;
      if (reducedMotion()) { dialog.close(); return; }
      dialog.classList.add('is-closing');
      dialog.addEventListener('animationend', () => {
        dialog.classList.remove('is-closing');
        dialog.close();
      }, { once: true });
    },
  };
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-dialog-open]');
    if (opener) Portal.dialog.open(document.getElementById(opener.dataset.dialogOpen));
    const closer = event.target.closest('[data-dialog-close]');
    if (closer) Portal.dialog.close(closer.closest('dialog'));
    // Click on the backdrop (the dialog element itself, outside its content) closes it.
    if (event.target instanceof HTMLDialogElement && event.target.open) Portal.dialog.close(event.target);
  });
  document.addEventListener('cancel', (event) => {
    if (event.target instanceof HTMLDialogElement) { event.preventDefault(); Portal.dialog.close(event.target); }
  }, true);

  /* Boot -------------------------------------------------------------------- */
  Portal.initComponents = function initComponents(scope = document) {
    $$('[data-segmented]', scope).forEach(initSegmented);
    $$('[data-disclosure]', scope).forEach(initDisclosure);
    $$('[data-switch]', scope).forEach(initSwitch);
    $$('[data-progress]', scope).forEach((bar) => {
      const pct = Math.max(0, Math.min(100, Number(bar.dataset.progress) || 0));
      bar.style.setProperty('--value', `${pct}%`);
    });
  };
  Portal.initComponents();

  /* Table labels: copy each column header onto its cells (data-label) so rows can stack on phones. */
  function labelTables(scope = document) {
    scope.querySelectorAll('table.table').forEach((table) => {
      const heads = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
      if (!heads.length) return;
      table.querySelectorAll('tbody tr').forEach((tr) => {
        Array.from(tr.children).forEach((td, i) => { if (heads[i] && !td.hasAttribute('colspan')) td.dataset.label = heads[i]; });
      });
    });
  }
  let labelQueued = false;
  new MutationObserver(() => {
    if (labelQueued) return;
    labelQueued = true;
    requestAnimationFrame(() => { labelQueued = false; labelTables(); });
  }).observe(document.body, { childList: true, subtree: true });
  labelTables();
})();
