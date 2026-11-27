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

  /** Clipboard write with a fallback for sandboxed frames where the async Clipboard API is blocked. */
  Portal.copyText = async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.setAttribute('aria-hidden', 'true');
      area.style.setProperty('position', 'fixed');
      area.style.setProperty('opacity', '0');
      (document.querySelector('dialog[open]') || document.body).appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.parentNode.removeChild(area);
      return ok;
    }
  };

  /* Copy to clipboard: icon swaps to a green check (and a text button reads "Copied") for 1.6 s */
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    const value = button.dataset.copy;
    if (!(await Portal.copyText(value))) {
      Portal.toast('Copy is blocked in this browser. Select the text instead.', { icon: 'alert' });
      return;
    }
    // Never echo long values (secrets, URLs) on screen; data-copy-toast overrides the message.
    Portal.toast(button.dataset.copyToast || (value.length <= 40 ? `Copied ${value}` : 'Copied to clipboard'));
    if (button.classList.contains('is-copied')) return;
    const restore = [];
    if (!button.querySelector('.icon-check')) {
      const icon = button.querySelector('svg');
      const check = Portal.icon('check');
      check.classList.add('icon-check-inline');
      if (icon) { icon.replaceWith(check); restore.push(() => check.replaceWith(icon)); }
      const label = Array.from(button.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      if (label) { const text = label.textContent; label.textContent = 'Copied'; restore.push(() => { label.textContent = text; }); }
    }
    button.classList.add('is-copied');
    window.setTimeout(() => { button.classList.remove('is-copied'); restore.forEach((fn) => fn()); }, 1600);
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
      const level = pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'ok';
      bar.dataset.level = level;
      bar.closest('.meter')?.classList.toggle('is-danger', level === 'danger');
      bar.closest('.meter')?.classList.toggle('is-warning', level === 'warning');
    });
  };
  Portal.initComponents();

  /** Smoothly reveals content that was just replaced in place (drawer steps, explorer responses, filtered views). */
  Portal.animateSwap = function animateSwap(node) {
    if (!node) return;
    node.classList.remove('is-swapping');
    void node.offsetWidth; // restart the animation
    node.classList.add('is-swapping');
    node.addEventListener('animationend', () => node.classList.remove('is-swapping'), { once: true });
  };

  /** Puts a floating layer (menu, listbox, popover) in the browser top layer so it shows above open dialogs. */
  Portal.showOnTop = function showOnTop(node) {
    document.body.appendChild(node);
    if (typeof node.showPopover === 'function') {
      node.popover = 'manual';
      node.showPopover();
    }
  };

  /* Option icons: currencies get their mark or flag, issuers their card network, and known
     routes, methods, topics and roles a matching icon. Override with <option data-icon> or data-flag. */
  const CURRENCY_FLAGS = { USD: 'US', AED: 'AE', EUR: 'EU', GBP: 'GB', SAR: 'SA' };
  const OPTION_ICONS = {
    usdt: 'usdt', usdc: 'usdc', axys: 'visa', hypercard: 'mastercard', interlace: 'visa', visa: 'visa', mastercard: 'mastercard',
    crossmint: 'payments', forumpay: 'wallet', 'blockchain rail': 'link', card: 'payments', fiat_card: 'payments', crypto: 'wallet',
    trc20: 'link', erc20: 'link', polygon: 'link', virtual: 'zap', physical: 'cards',
    payments: 'payments', payouts: 'payout', refunds: 'refund', cards: 'cards', webhooks: 'webhook', 'api and keys': 'key', account: 'user', reports: 'reports',
    admin: 'shield', developer: 'code', finance: 'reports', viewer: 'eye',
    transactions: 'payments', fees: 'scale', 'card orders': 'truck', csv: 'file', json: 'code',
  };
  function optionIcon(option) {
    if (option.dataset.flag) return Portal.flag?.(option.dataset.flag);
    if (option.dataset.icon) return Portal.icon(option.dataset.icon);
    const key = option.textContent.trim().toLowerCase();
    const code = (option.value || key).toUpperCase();
    if (CURRENCY_FLAGS[code]) return Portal.flag?.(CURRENCY_FLAGS[code]);
    const name = OPTION_ICONS[key] || OPTION_ICONS[String(option.value).toLowerCase()];
    if (!name) return null;
    const svg = Portal.icon(name);
    if (svg && ['visa', 'mastercard'].includes(name)) svg.classList.add('network-mark');
    return svg;
  }
  Portal.optionIcon = optionIcon;

  /* Custom select: replaces the OS dropdown with a listbox styled like our menus while the native
     <select> stays in the DOM (hidden) as the source of truth, so forms, validation and page code keep working.
     Opt out with data-native. */
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() { return nativeValue.get.call(this); },
    set(v) { nativeValue.set.call(this, v); this.dispatchEvent(new Event('portal:sync')); },
  });
  let openList = null;
  function closeList(focusButton = true) {
    if (!openList) return;
    const { list, button } = openList;
    list.remove();
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus();
    openList = null;
  }
  function enhanceSelect(select) {
    if (select.dataset.enhanced || select.multiple || select.hasAttribute('data-native')) return;
    select.dataset.enhanced = 'true';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${select.className} cselect`;
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const label = document.createElement('span');
    label.className = 'cselect__label';
    button.appendChild(label);
    const sync = () => {
      const option = select.options[select.selectedIndex];
      label.replaceChildren();
      const icon = option && optionIcon(option);
      if (icon) { icon.classList.add('cselect__icon'); label.appendChild(icon); }
      label.appendChild(document.createTextNode(option ? option.textContent : ''));
      button.disabled = select.disabled;
      button.setAttribute('aria-label', `${select.getAttribute('aria-label') || select.labels?.[0]?.textContent || 'Select'}: ${label.textContent}`);
      button.setAttribute('aria-invalid', select.getAttribute('aria-invalid') || 'false');
    };
    select.classList.add('cselect__native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.after(button);
    select.labels?.forEach((l) => l.addEventListener('click', (e) => { e.preventDefault(); button.focus(); }));
    ['change', 'portal:sync'].forEach((type) => select.addEventListener(type, sync));
    new MutationObserver(sync).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-invalid'] });
    sync();

    const choose = (option) => {
      if (option.disabled) return;
      nativeValue.set.call(select, option.value);
      sync();
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      closeList();
    };
    const open = () => {
      if (openList?.button === button) { closeList(); return; }
      closeList(false);
      const list = document.createElement('div');
      list.className = 'menu cselect__list';
      list.setAttribute('role', 'listbox');
      Array.from(select.options).forEach((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'menu__item cselect__option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(option.selected));
        item.disabled = option.disabled;
        const text = document.createElement('span');
        text.className = 'cselect__text';
        const icon = optionIcon(option);
        if (icon) { icon.classList.add('cselect__icon'); text.appendChild(icon); }
        text.appendChild(document.createTextNode(option.textContent));
        item.append(text, Portal.icon('check'));
        item.addEventListener('click', () => choose(option));
        list.appendChild(item);
      });
      Portal.showOnTop(list);
      const box = button.getBoundingClientRect();
      list.style.minWidth = `${box.width}px`;
      const below = box.bottom + 4 + list.offsetHeight <= window.innerHeight;
      list.style.top = `${Math.max(8, below ? box.bottom + 4 : box.top - list.offsetHeight - 4)}px`;
      list.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - list.offsetWidth - 8))}px`;
      button.setAttribute('aria-expanded', 'true');
      openList = { list, button };
      (list.querySelector('[aria-selected="true"]') || list.querySelector('.menu__item:not(:disabled)'))?.focus();
    };
    button.addEventListener('click', open);
    button.addEventListener('keydown', (event) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); open(); }
    });
  }
  document.addEventListener('keydown', (event) => {
    if (!openList) return;
    const items = Array.from(openList.list.querySelectorAll('.menu__item:not(:disabled)'));
    const index = items.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); closeList(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); items[Math.min(items.length - 1, index + 1)]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); items[Math.max(0, index - 1)]?.focus(); }
    else if (event.key === 'Tab') closeList(false);
    else if (event.key.length === 1) items.find((i) => i.textContent.trim().toLowerCase().startsWith(event.key.toLowerCase()))?.focus();
  });
  document.addEventListener('click', (event) => {
    if (openList && !openList.list.contains(event.target) && !openList.button.contains(event.target)) closeList(false);
  });
  document.addEventListener('scroll', (event) => { if (openList && !openList.list.contains(event.target)) closeList(false); }, true);
  window.addEventListener('resize', () => closeList(false));
  const enhanceAll = (scope = document) => scope.querySelectorAll('select.select').forEach(enhanceSelect);
  Portal.enhanceSelects = enhanceAll;
  enhanceAll();

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
    requestAnimationFrame(() => { labelQueued = false; labelTables(); enhanceAll(); });
  }).observe(document.body, { childList: true, subtree: true });
  labelTables();
})();
