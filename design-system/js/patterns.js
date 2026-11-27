/*
 * Interaction patterns for dashboard pages. Requires theme.js, icons.js, components.js, dom.js.
 *
 *   Portal.drawer.open({ title, subtitle, body, footer, footNote }) → { el, close, setBody, setFooter }
 *   Portal.confirm({ title, message, details, confirmLabel, tone }) → Promise<boolean>
 *   Portal.menu.button(items, label) → ⋯ button that opens a menu of { label, icon, description, tone, onSelect }
 *   Portal.dataTable(host, { columns, pageSize, empty, onRowClick, rowLabel }) → { setRows(rows) }
 *     A column may add filter: { type: 'text'|'number'|'date'|'options', value: (row) => primitive, options?, label?, placeholder? }
 *   Portal.downloadCsv(filename, columns, rows)
 *   Portal.fieldError(input, message)
 *   Portal.trackDirty(form, saveBar, { onSave }) → { reset() }
 *   [data-tabs] underline tabs (auto-initialised; Portal.initTabs(scope) for new markup)
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, iconEl, btn } = Portal;

  /* Drawer ---------------------------------------------------------------------- */
  Portal.drawer = {
    open({ title, subtitle, body = [], footer = [], footNote, onClose, labelledBy } = {}) {
      const titleId = `drawer-title-${Math.random().toString(36).slice(2, 8)}`;
      const bodyEl = el('div', { className: 'drawer__body' });
      const footEl = el('div', { className: 'drawer__foot' });
      const subtitleEl = subtitle ? el('p', { className: 'drawer__subtitle' }, [subtitle]) : null;
      const dialog = el('dialog', { className: 'drawer', attrs: { 'aria-labelledby': labelledBy || titleId } }, [
        el('div', { className: 'drawer__head' }, [
          el('div', { className: 'drawer__titles' }, [el('h2', { className: 'drawer__title', text: title, attrs: { id: titleId } }), subtitleEl]),
          btn('Close', { variant: 'ghost', size: 'sm', iconName: 'x', iconOnly: true, attrs: { 'data-dialog-close': '' } }),
        ]),
        bodyEl,
        footEl,
      ]);
      const api = {
        el: dialog,
        body: bodyEl,
        setBody(nodes) { bodyEl.replaceChildren(...[].concat(nodes).filter(Boolean)); bodyEl.scrollTop = 0; },
        setFooter(nodes, note) {
          footEl.replaceChildren(...[note && el('span', { className: 'drawer__foot-note', text: note }), ...[].concat(nodes)].filter(Boolean));
          footEl.hidden = !footEl.childElementCount;
        },
        setTitle(text) { dialog.querySelector('.drawer__title').textContent = text; },
        close() { Portal.dialog.close(dialog); },
      };
      api.setBody(body);
      api.setFooter(footer, footNote);
      dialog.addEventListener('close', () => { dialog.remove(); onClose?.(); });
      document.body.appendChild(dialog);
      Portal.dialog.open(dialog);
      enableSheetDrag(dialog);
      return api;
    },
  };

  /** On phones the drawer is a bottom sheet: dragging its header down more than 90px closes it. */
  function enableSheetDrag(dialog) {
    const head = dialog.querySelector('.drawer__head');
    let startY = null;
    head.addEventListener('pointerdown', (event) => {
      if (!window.matchMedia('(max-width: 600px)').matches || event.target.closest('button')) return;
      startY = event.clientY;
      head.setPointerCapture(event.pointerId);
    });
    head.addEventListener('pointermove', (event) => {
      if (startY === null) return;
      dialog.style.transform = `translateY(${Math.max(0, event.clientY - startY)}px)`;
    });
    head.addEventListener('pointerup', (event) => {
      if (startY === null) return;
      const dragged = event.clientY - startY;
      startY = null;
      dialog.style.removeProperty('transform');
      if (dragged > 90) Portal.dialog.close(dialog);
    });
  }

  /* Confirm ------------------------------------------------------------------------ */
  Portal.confirm = function confirm({ title, message, details = [], confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary' }) {
    return new Promise((resolve) => {
      let result = false;
      const titleId = `confirm-${Math.random().toString(36).slice(2, 8)}`;
      const confirmBtn = btn(confirmLabel, { variant: tone === 'danger' ? 'danger' : 'primary', onClick: () => { result = true; Portal.dialog.close(dialog); } });
      const dialog = el('dialog', { className: 'dialog', attrs: { 'aria-labelledby': titleId, role: 'alertdialog' } }, [
        el('div', { className: 'dialog__head' }, [el('h2', { className: 'dialog__title', text: title, attrs: { id: titleId } })]),
        el('div', { className: 'dialog__body' }, [
          el('p', { text: message }),
          details.length ? el('dl', { className: 'confirm__details' }, details.map(([k, v]) => el('div', {}, [el('dt', { text: k }), el('dd', { text: v })]))) : null,
        ]),
        el('div', { className: 'dialog__foot' }, [btn(cancelLabel, { attrs: { 'data-dialog-close': '' } }), confirmBtn]),
      ]);
      dialog.addEventListener('close', () => { dialog.remove(); resolve(result); });
      document.body.appendChild(dialog);
      Portal.dialog.open(dialog);
      (tone === 'danger' ? dialog.querySelector('[data-dialog-close]') : confirmBtn).focus();
    });
  };

  /* Menu ----------------------------------------------------------------------------- */
  /** Places a fixed popover under its anchor (or above it when there is no room), right-aligned and kept on screen. */
  function placePopover(node, anchor) {
    const box = anchor.getBoundingClientRect();
    const popBox = node.getBoundingClientRect();
    const top = box.bottom + 4 + popBox.height > window.innerHeight ? box.top - popBox.height - 4 : box.bottom + 4;
    node.style.top = `${Math.max(8, top)}px`;
    node.style.left = `${Math.max(8, Math.min(box.right - popBox.width, window.innerWidth - popBox.width - 8))}px`;
  }

  let openMenu = null;
  function closeMenu({ restoreFocus = true } = {}) {
    if (!openMenu) return;
    const { node, anchor } = openMenu;
    node.remove();
    anchor.setAttribute('aria-expanded', 'false');
    if (restoreFocus) anchor.focus();
    openMenu = null;
  }
  function showMenu(anchor, items) {
    if (openMenu?.anchor === anchor) { closeMenu(); return; }
    closeMenu({ restoreFocus: false });
    const node = el('div', { className: 'menu', attrs: { role: 'menu' } });
    items.forEach((item) => {
      if (item === 'separator') { node.appendChild(el('div', { className: 'menu__sep', attrs: { role: 'separator' } })); return; }
      node.appendChild(el('button', {
        className: `menu__item${item.tone === 'danger' ? ' menu__item--danger' : ''}`,
        attrs: { type: 'button', role: 'menuitem', disabled: item.disabled },
        on: { click: (event) => { event.stopPropagation(); closeMenu(); item.onSelect?.(); } },
      }, [
        item.icon && iconEl(item.icon),
        el('span', { className: 'menu__text' }, [el('span', { text: item.label }), item.description && el('span', { className: 'menu__desc', text: item.description })]),
      ]));
    });
    document.body.appendChild(node);
    placePopover(node, anchor);
    anchor.setAttribute('aria-expanded', 'true');
    openMenu = { node, anchor };
    node.querySelector('.menu__item:not(:disabled)')?.focus();
  }
  document.addEventListener('click', (event) => { if (openMenu && !openMenu.node.contains(event.target) && !openMenu.anchor.contains(event.target)) closeMenu({ restoreFocus: false }); });
  document.addEventListener('keydown', (event) => {
    if (!openMenu) return;
    const items = Array.from(openMenu.node.querySelectorAll('.menu__item:not(:disabled)'));
    const index = items.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
    else if (event.key === 'Tab') closeMenu({ restoreFocus: false });
  });
  window.addEventListener('resize', () => closeMenu({ restoreFocus: false }));
  document.addEventListener('scroll', () => closeMenu({ restoreFocus: false }), true);

  Portal.menu = {
    open: showMenu,
    close: closeMenu,
    button(items, label = 'More actions') {
      const trigger = btn(label, { variant: 'ghost', size: 'sm', iconName: 'more', iconOnly: true, attrs: { 'aria-haspopup': 'menu', 'aria-expanded': 'false' } });
      trigger.addEventListener('click', (event) => { event.stopPropagation(); showMenu(trigger, typeof items === 'function' ? items() : items); });
      return trigger;
    },
  };

  /* Tabs ----------------------------------------------------------------------------- */
  function initTabs(list) {
    if (list.dataset.ready) return;
    list.dataset.ready = 'true';
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
    const indicator = el('span', { className: 'tabs__indicator', attrs: { 'aria-hidden': 'true' } });
    list.appendChild(indicator);
    const place = () => {
      const active = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.transform = `translateX(${active.offsetLeft - list.scrollLeft}px)`;
    };
    const select = (tab, { focus = false, emit = true } = {}) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      place();
      if (emit) list.dispatchEvent(new CustomEvent('tabs:change', { bubbles: true, detail: { value: tab.dataset.value || tab.id } }));
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (event) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (step) { event.preventDefault(); select(tabs[(i + step + tabs.length) % tabs.length], { focus: true }); }
      });
    });
    select(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0], { emit: false });
    new ResizeObserver(place).observe(list);
    document.fonts?.ready.then(place);
    list.addEventListener('scroll', place);
    requestAnimationFrame(() => list.classList.add('is-ready'));
    list.portalSelect = (value) => { const tab = tabs.find((t) => t.dataset.value === value); if (tab) select(tab); };
  }
  Portal.initTabs = (scope = document) => scope.querySelectorAll('[data-tabs]').forEach(initTabs);
  Portal.initTabs();

  /* Data table ----------------------------------------------------------------------- */
  Portal.dataTable = function dataTable(host, { columns, pageSize = 10, empty = {}, onRowClick, rowLabel = (row) => row.id }) {
    const thead = el('thead', {}, [el('tr', {}, columns.map((c) => el('th', { className: [c.num && 'is-num', c.className].filter(Boolean).join(' '), text: c.label, attrs: { scope: 'col' } })))]);
    const tbody = el('tbody');
    const wrap = el('div', { className: 'table-wrap' }, [el('table', { className: 'table' }, [thead, tbody])]);
    const pageLabel = el('span', { className: 'pagination__page' });
    const range = el('span');
    const prev = btn('Previous page', { size: 'sm', iconName: 'chevron-left', iconOnly: true, onClick: () => go(page - 1) });
    const next = btn('Next page', { size: 'sm', iconName: 'chevron-right', iconOnly: true, onClick: () => go(page + 1) });
    const pager = el('div', { className: 'pagination' }, [range, el('div', { className: 'pagination__controls' }, [pageLabel, prev, next])]);
    const emptyBox = el('div', { className: 'empty', attrs: { hidden: true } });
    host.append(wrap, emptyBox, pager);

    let rows = [];
    let page = 1;

    function renderEmpty() {
      emptyBox.replaceChildren(
        el('span', { className: 'empty__icon' }, [iconEl(empty.icon || 'search')]),
        el('p', { className: 'empty__title', text: empty.title || 'Nothing here yet' }),
        empty.text ? el('p', { className: 'empty__text', text: empty.text }) : null,
        empty.action || null,
      );
    }

    function go(target) {
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      page = Math.min(Math.max(1, target), pages);
      const start = (page - 1) * pageSize;
      const slice = rows.slice(start, start + pageSize);
      tbody.replaceChildren(...slice.map((row, i) => {
        const tr = el('tr', { className: `is-entering${onRowClick ? ' is-clickable' : ''}` }, columns.map((c) => {
          const value = c.render(row);
          return el('td', { className: [c.num && 'is-num', c.className].filter(Boolean).join(' ') }, [value]);
        }));
        tr.style.animationDelay = `${i * 20}ms`;
        if (onRowClick) {
          tr.tabIndex = 0;
          tr.setAttribute('aria-label', `Open ${rowLabel(row)}`);
          tr.addEventListener('click', (event) => { if (!event.target.closest('button, a, input, select')) onRowClick(row); });
          tr.addEventListener('keydown', (event) => { if (event.key === 'Enter' && event.target === tr) onRowClick(row); });
        }
        return tr;
      }));
      const isEmpty = rows.length === 0;
      wrap.hidden = isEmpty;
      emptyBox.hidden = !isEmpty;
      pager.hidden = isEmpty;
      if (isEmpty) renderEmpty();
      range.textContent = `${start + 1}–${Math.min(start + pageSize, rows.length)} of ${Portal.fmt.count(rows.length)}`;
      pageLabel.textContent = `Page ${page} of ${pages}`;
      prev.disabled = page <= 1;
      next.disabled = page >= pages;
    }

    return {
      setRows(next) { rows = next; go(1); },
      /** Change the empty state, e.g. "no results" vs "needs setup"; re-renders if currently empty. */
      setEmpty(next) { empty = next; if (!rows.length) renderEmpty(); },
      refresh() { go(page); },
      get rows() { return rows; },
    };
  };

  /* CSV export -------------------------------------------------------------------------- */
  Portal.downloadCsv = function downloadCsv(filename, columns, rows) {
    // Neutralise spreadsheet formula injection: prefix cells that start with = + - @ or a control char.
    const safe = (value) => {
      let text = value === null || value === undefined ? '' : String(value);
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const lines = [columns.map((c) => safe(c.label)).join(','), ...rows.map((r) => columns.map((c) => safe(c.value(r))).join(','))];
    const blob = new Blob([`${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = el('a', { attrs: { href: url, download: filename } });
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    Portal.toast(`Exported ${Portal.fmt.count(rows.length)} rows to ${filename}`);
  };

  /* Forms ---------------------------------------------------------------------------------- */
  Portal.fieldError = function fieldError(input, message) {
    const field = input.closest('.field');
    let error = field?.querySelector('.field__error');
    if (!error && field) {
      error = el('p', { className: 'field__error', attrs: { id: `${input.id || 'f'}-error`, 'aria-live': 'polite' } });
      field.appendChild(error);
    }
    if (error) {
      error.textContent = message || '';
      const ids = new Set((input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
      ids.add(error.id);
      input.setAttribute('aria-describedby', [...ids].join(' '));
    }
    input.setAttribute('aria-invalid', String(Boolean(message)));
    return !message;
  };

  /** Shows the save bar while a form differs from its saved state. */
  Portal.trackDirty = function trackDirty(form, bar, { onSave } = {}) {
    const snapshot = () => JSON.stringify(Array.from(form.elements).filter((f) => f.name).map((f) => [f.name, f.type === 'checkbox' || f.type === 'radio' ? f.checked : f.value, f.getAttribute('aria-checked')]));
    const switches = () => Array.from(form.querySelectorAll('[role="switch"][data-name]'));
    const state = () => snapshot() + JSON.stringify(switches().map((s) => s.getAttribute('aria-checked')));
    let saved = state();
    let savedValues = Array.from(form.elements).map((f) => [f, f.type === 'checkbox' || f.type === 'radio' ? f.checked : f.value]);
    let savedSwitches = switches().map((s) => [s, s.getAttribute('aria-checked')]);
    const sync = () => bar.classList.toggle('is-visible', state() !== saved);
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);
    form.addEventListener('switch:change', sync);
    const commit = () => {
      saved = state();
      savedValues = Array.from(form.elements).map((f) => [f, f.type === 'checkbox' || f.type === 'radio' ? f.checked : f.value]);
      savedSwitches = switches().map((s) => [s, s.getAttribute('aria-checked')]);
      sync();
    };
    bar.querySelector('[data-discard]')?.addEventListener('click', () => {
      savedValues.forEach(([f, v]) => { if (f.type === 'checkbox' || f.type === 'radio') f.checked = v; else f.value = v; Portal.fieldError(f, ''); });
      savedSwitches.forEach(([s, v]) => s.setAttribute('aria-checked', v));
      sync();
      Portal.toast('Changes discarded', { icon: 'refund' });
    });
    bar.querySelector('[data-save]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      if (onSave && (await onSave()) === false) return;
      button.setAttribute('aria-busy', 'true');
      await Portal.request(null, { delay: 600 });
      button.removeAttribute('aria-busy');
      commit();
      Portal.toast('Changes saved');
    });
    return { reset: commit, sync };
  };
})();
