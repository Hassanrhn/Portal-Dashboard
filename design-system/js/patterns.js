/*
 * Interaction patterns for dashboard pages. Requires theme.js, icons.js, components.js, dom.js.
 *
 *   Portal.drawer.open({ title, subtitle, leading, body, footer, footNote }) → { el, close, setBody, setFooter }  (leading: e.g. an avatar before the title)
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
    open({ title, subtitle, leading, body = [], footer = [], footNote, onClose, labelledBy } = {}) {
      const titleId = `drawer-title-${Math.random().toString(36).slice(2, 8)}`;
      const bodyEl = el('div', { className: 'drawer__body' });
      const footEl = el('div', { className: 'drawer__foot' });
      const subtitleEl = subtitle ? el('p', { className: 'drawer__subtitle' }, [subtitle]) : null;
      const dialog = el('dialog', { className: 'drawer', attrs: { 'aria-labelledby': labelledBy || titleId } }, [
        el('div', { className: 'drawer__head' }, [
          leading || null,
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

  /* Column filters ------------------------------------------------------------------- */
  const TODAY = '2026-11-27'; // The prototype's fixed "today" (UTC), see docs/HANDOFF.md.
  const DAY_MS = 86400000;
  const DATE_PRESETS = [['Today', 0], ['Last 7 days', 6], ['Last 30 days', 29]];
  const NUMBER_PATTERN = /^-?\d{1,12}(\.\d{1,8})?$/;
  const dayStart = (iso) => Date.parse(`${iso}T00:00:00Z`);
  const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
  const toTime = (raw) => (raw === null || raw === undefined || raw === '' ? NaN : raw instanceof Date ? raw.getTime() : typeof raw === 'number' ? raw : Date.parse(raw));
  const shortDay = (iso) => new Date(dayStart(iso)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: iso.slice(0, 4) === TODAY.slice(0, 4) ? undefined : 'numeric', timeZone: 'UTC' });
  const shortNumber = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 8 });
  const optionLabel = (filter, value) => (filter.label ? filter.label(value) : Portal.fmt.humanize(value));

  /** Per type: does a row value pass, and how the active filter reads on its chip. A filter value of null means "off". */
  const FILTER_TYPES = {
    text: {
      test: (text, raw) => String(raw ?? '').toLowerCase().includes(text.toLowerCase()),
      summary: (text) => `contains “${text}”`,
    },
    number: {
      test: ({ min, max }, raw) => {
        const n = Number(raw);
        return raw !== null && raw !== '' && Number.isFinite(n) && (min === null || n >= min) && (max === null || n <= max);
      },
      summary: ({ min, max }) => {
        if (min !== null && max !== null) return `${shortNumber(min)} – ${shortNumber(max)}`;
        return min !== null ? `≥ ${shortNumber(min)}` : `≤ ${shortNumber(max)}`;
      },
    },
    date: {
      test: ({ from, to }, raw) => {
        const t = toTime(raw);
        return Number.isFinite(t) && (!from || t >= dayStart(from)) && (!to || t < dayStart(to) + DAY_MS);
      },
      summary: ({ from, to }) => {
        if (from && to) return from === to ? shortDay(from) : `${shortDay(from)} – ${shortDay(to)}`;
        return from ? `from ${shortDay(from)}` : `until ${shortDay(to)}`;
      },
    },
    options: {
      test: (selected, raw) => selected.includes(raw),
      summary: (selected, filter) => {
        const labels = selected.map((v) => optionLabel(filter, v));
        return labels.length > 2 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2}` : labels.join(', ');
      },
    },
  };

  const filterField = (label, input, extra) => el('div', { className: 'field' }, [el('label', { className: 'field__label', text: label, attrs: { for: input.id } }), input, extra]);

  /**
   * Builds the inputs for one column filter.
   * Returns { nodes, read() → { value } | { error: true } }; read() shows inline errors itself.
   */
  function filterFields(column, current, sourceRows, allRows, idBase) {
    const { filter } = column;
    const name = column.label.toLowerCase();

    if (filter.type === 'text') {
      const sample = sourceRows.map(filter.value).find((v) => v);
      const input = el('input', { className: 'input', attrs: {
        id: `${idBase}-q`, type: 'text', maxlength: '80', autocomplete: 'off', spellcheck: 'false', value: current || '',
        placeholder: filter.placeholder || (sample ? `e.g. ${String(sample).slice(0, 24)}` : `Part of the ${name}`),
      } });
      return { nodes: [filterField('Contains', input)], read: () => ({ value: input.value.trim() || null }) };
    }

    if (filter.type === 'number') {
      const make = (key, label) => el('input', { className: 'input u-num', attrs: {
        id: `${idBase}-${key}`, type: 'text', inputmode: 'decimal', maxlength: '16', autocomplete: 'off', placeholder: label,
        value: current?.[key] ?? '',
      } });
      const min = make('min', 'Min');
      const max = make('max', 'Max');
      /** Number, null when blank, or undefined when invalid (with an inline error). */
      const parse = (input) => {
        const text = input.value.trim().replace(/,/g, '');
        const valid = !text || NUMBER_PATTERN.test(text);
        Portal.fieldError(input, valid ? '' : 'Enter a number, like 250.50.');
        if (!valid) return undefined;
        return text ? Number(text) : null;
      };
      return {
        nodes: [el('div', { className: 'form-grid form-grid--2' }, [filterField('Min', min), filterField('Max', max)])],
        read() {
          const low = parse(min);
          const high = parse(max);
          if (low === undefined || high === undefined) return { error: true };
          if (low !== null && high !== null && low > high) { Portal.fieldError(max, 'Max must be at least the min.'); return { error: true }; }
          return { value: low === null && high === null ? null : { min: low, max: high } };
        },
      };
    }

    if (filter.type === 'date') {
      const make = (key) => el('input', { className: 'input u-num', attrs: { id: `${idBase}-${key}`, type: 'date', max: TODAY, value: current?.[key] || '' } });
      const from = make('from');
      const to = make('to');
      const presets = el('div', { className: 'column-filter__presets', attrs: { role: 'group', 'aria-label': `${column.label} presets` } }, DATE_PRESETS.map(([label, days]) => {
        const preset = btn(label, { size: 'sm', attrs: { 'aria-pressed': 'false' } });
        preset.addEventListener('click', () => {
          from.value = isoDay(dayStart(TODAY) - days * DAY_MS);
          to.value = TODAY;
          sync();
        });
        preset.dataset.from = isoDay(dayStart(TODAY) - days * DAY_MS);
        return preset;
      }));
      const sync = () => presets.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(from.value === b.dataset.from && to.value === TODAY)));
      from.addEventListener('input', sync);
      to.addEventListener('input', sync);
      sync();
      return {
        nodes: [presets, el('div', { className: 'form-grid' }, [filterField('From', from), filterField('To', to)])],
        read() {
          Portal.fieldError(from, '');
          if (from.value && to.value && from.value > to.value) { Portal.fieldError(to, 'Pick a date on or after the start date.'); return { error: true }; }
          Portal.fieldError(to, '');
          return { value: from.value || to.value ? { from: from.value || null, to: to.value || null } : null };
        },
      };
    }

    // options: checkboxes with counts from the rows the other filters leave.
    const counts = new Map();
    sourceRows.forEach((row) => { const v = filter.value(row); counts.set(v, (counts.get(v) || 0) + 1); });
    const seen = [...new Set(allRows.map(filter.value))];
    const values = [...new Set([...(filter.options || seen.sort((a, b) => optionLabel(filter, a).localeCompare(optionLabel(filter, b)))), ...(current || [])])]
      .filter((v) => v !== null && v !== undefined && v !== '');
    const boxes = values.map((value) => el('input', { attrs: { type: 'checkbox', value: String(value), checked: Boolean(current?.includes(value)) } }));
    const list = el('fieldset', { className: 'column-filter__options' }, [
      el('legend', { className: 'u-sr-only', text: column.label }),
      ...values.map((value, i) => el('label', { className: 'check' }, [
        boxes[i],
        el('span', { className: 'check__text', text: optionLabel(filter, value) }),
        el('span', { className: 'column-filter__count', text: Portal.fmt.count(counts.get(value) || 0), attrs: { 'aria-label': `${counts.get(value) || 0} rows` } }),
      ])),
    ]);
    return {
      nodes: [values.length ? list : el('p', { className: 'field__help', text: 'No values to filter yet.' })],
      read() {
        const selected = values.filter((_, i) => boxes[i].checked);
        return { value: selected.length ? selected : null };
      },
    };
  }

  /* Column filter popover: one at a time, a .menu-styled form anchored to its header button. */
  let openPopover = null;
  function closeFilterPopover({ restoreFocus = true } = {}) {
    if (!openPopover) return;
    const { node, anchor } = openPopover;
    openPopover = null;
    node.remove();
    anchor.setAttribute('aria-expanded', 'false');
    if (restoreFocus && anchor.isConnected) anchor.focus();
  }
  function showFilterPopover(anchor, node) {
    closeMenu({ restoreFocus: false });
    closeFilterPopover({ restoreFocus: false });
    document.body.appendChild(node);
    placePopover(node, anchor);
    anchor.setAttribute('aria-expanded', 'true');
    openPopover = { node, anchor };
    node.addEventListener('focusout', (event) => { if (event.relatedTarget && !node.contains(event.relatedTarget)) closeFilterPopover({ restoreFocus: false }); });
    node.querySelector('input:not([type="checkbox"]), input')?.focus();
  }
  document.addEventListener('click', (event) => { if (openPopover && !openPopover.node.contains(event.target) && !openPopover.anchor.contains(event.target)) closeFilterPopover({ restoreFocus: false }); });
  document.addEventListener('keydown', (event) => { if (openPopover && event.key === 'Escape') { event.preventDefault(); closeFilterPopover(); } });
  window.addEventListener('resize', () => { if (!window.matchMedia('(max-width: 600px)').matches) closeFilterPopover({ restoreFocus: false }); });
  document.addEventListener('scroll', (event) => { if (openPopover && !openPopover.node.contains(event.target)) closeFilterPopover({ restoreFocus: false }); }, true);

  /* Data table ----------------------------------------------------------------------- */
  Portal.dataTable = function dataTable(host, { columns, pageSize = 10, empty = {}, onRowClick, rowLabel = (row) => row.id }) {
    const uid = Math.random().toString(36).slice(2, 8);
    const filterable = columns.map((c, i) => (c.filter ? i : -1)).filter((i) => i >= 0);
    const active = new Map(); // column index → filter value
    const triggers = new Map();

    const cellClass = (c) => [c.num && 'is-num', c.className].filter(Boolean).join(' ');
    function headCell(c, i) {
      if (!c.filter) return el('th', { className: cellClass(c), text: c.label, attrs: { scope: 'col' } });
      const trigger = el('button', {
        className: 'column-filter__trigger',
        attrs: { type: 'button', 'aria-label': `Filter ${c.label}`, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
        on: { click: (event) => { event.stopPropagation(); toggleFilterPopover(i, trigger); } },
      }, [iconEl('filter')]);
      triggers.set(i, trigger);
      return el('th', { className: cellClass(c), attrs: { scope: 'col' } }, [el('span', { className: 'column-filter__head' }, [el('span', { text: c.label }), trigger])]);
    }

    const thead = el('thead', {}, [el('tr', {}, columns.map(headCell))]);
    const tbody = el('tbody');
    const wrap = el('div', { className: 'table-wrap' }, [el('table', { className: 'table' }, [thead, tbody])]);
    const pageLabel = el('span', { className: 'pagination__page' });
    const range = el('span');
    const prev = btn('Previous page', { size: 'sm', iconName: 'chevron-left', iconOnly: true, onClick: () => go(page - 1) });
    const next = btn('Next page', { size: 'sm', iconName: 'chevron-right', iconOnly: true, onClick: () => go(page + 1) });
    const pager = el('div', { className: 'pagination' }, [range, el('div', { className: 'pagination__controls' }, [pageLabel, prev, next])]);
    const emptyBox = el('div', { className: 'empty', attrs: { hidden: true } });
    const chips = el('div', { className: 'chips column-filter__chips', attrs: { role: 'group', 'aria-label': 'Column filters' } });
    const sheetCount = el('span', { className: 'btn__dot', attrs: { hidden: true } });
    const sheetButton = btn('Filter columns', { size: 'sm', iconName: 'filter', onClick: openFilterSheet, attrs: { 'aria-haspopup': 'dialog' } });
    sheetButton.classList.add('column-filter__sheet-btn');
    sheetButton.appendChild(sheetCount);
    const bar = filterable.length ? el('div', { className: 'column-filter__bar' }, [sheetButton, chips]) : null;
    host.append(...[bar, wrap, emptyBox, pager].filter(Boolean));

    let rows = []; // rows from the page (already page-filtered)
    let view = []; // rows after column filters
    let page = 1;

    /* Filtering ------------------------------------------------------------------ */
    const passes = (row, skip) => [...active].every(([i, value]) => i === skip || FILTER_TYPES[columns[i].filter.type].test(value, columns[i].filter.value(row)));
    const rowsFor = (index) => rows.filter((row) => passes(row, index));

    function setFilter(index, value) {
      if (value === null) active.delete(index); else active.set(index, value);
      update();
    }
    function clearFilters() { active.clear(); update(); }

    function update() {
      view = active.size ? rows.filter((row) => passes(row)) : rows;
      renderFilterState();
      go(1);
    }

    function renderFilterState() {
      if (!bar) return;
      triggers.forEach((trigger, i) => trigger.classList.toggle('is-active', active.has(i)));
      chips.replaceChildren(...[...active].map(([i, value]) => {
        const c = columns[i];
        return el('span', { className: 'chip chip--filter' }, [
          el('span', { className: 'chip__text', text: `${c.label}: ${FILTER_TYPES[c.filter.type].summary(value, c.filter)}` }),
          el('button', { className: 'chip__remove', attrs: { type: 'button', 'aria-label': `Remove ${c.label} filter` }, on: { click: () => setFilter(i, null) } }, [iconEl('x')]),
        ]);
      }), ...(active.size > 1 ? [btn('Clear all', { variant: 'ghost', size: 'sm', onClick: clearFilters })] : []));
      sheetCount.textContent = String(active.size);
      sheetCount.hidden = !active.size;
      bar.classList.toggle('is-empty', !active.size);
      bar.classList.toggle('has-rows', rows.length > 0 || active.size > 0);
    }

    /* Popover (desktop header button) -------------------------------------------------- */
    function toggleFilterPopover(index, trigger) {
      if (openPopover?.anchor === trigger) { closeFilterPopover(); return; }
      const c = columns[index];
      const fields = filterFields(c, active.get(index), rowsFor(index), rows, `cf-${uid}-${index}`);
      const form = el('form', { className: 'menu column-filter', attrs: { role: 'dialog', 'aria-label': `Filter ${c.label}`, novalidate: true } }, [
        el('p', { className: 'column-filter__title', text: `Filter by ${c.label.toLowerCase()}` }),
        ...fields.nodes,
        el('div', { className: 'column-filter__foot' }, [
          btn('Clear', { variant: 'ghost', size: 'sm', onClick: () => { closeFilterPopover(); setFilter(index, null); } }),
          btn('Apply', { variant: 'primary', size: 'sm', attrs: { type: 'submit' } }),
        ]),
      ]);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const result = fields.read();
        if (result.error) return;
        closeFilterPopover();
        setFilter(index, result.value);
      });
      form.addEventListener('click', (event) => event.stopPropagation());
      showFilterPopover(trigger, form);
    }

    /* Bottom sheet (phones, where the header row is hidden) ------------------------------- */
    function openFilterSheet() {
      const sets = filterable.map((i) => ({ i, fields: filterFields(columns[i], active.get(i), rowsFor(i), rows, `cfs-${uid}-${i}`) }));
      const drawer = Portal.drawer.open({
        title: 'Filter columns',
        subtitle: `${Portal.fmt.count(view.length)} of ${Portal.fmt.count(rows.length)} rows shown`,
        body: sets.map(({ i, fields }) => el('section', { className: 'drawer__section' }, [el('h3', { className: 'drawer__section-title', text: columns[i].label }), ...fields.nodes])),
        footer: [
          btn('Clear all', { onClick: () => { drawer.close(); clearFilters(); } }),
          btn('Apply', { variant: 'primary', onClick: () => {
            const results = sets.map(({ fields }) => fields.read());
            if (results.some((r) => r.error)) return;
            sets.forEach(({ i }, k) => { if (results[k].value === null) active.delete(i); else active.set(i, results[k].value); });
            drawer.close();
            update();
          } }),
        ],
      });
    }

    /* Rendering ------------------------------------------------------------------- */
    function renderEmpty() {
      const byColumns = rows.length > 0 && active.size > 0;
      const state = byColumns
        ? { icon: 'filter', title: 'No rows match the column filters', text: 'Remove a filter to see more rows.', action: btn('Clear column filters', { onClick: clearFilters }) }
        : empty;
      emptyBox.replaceChildren(
        el('span', { className: 'empty__icon' }, [iconEl(state.icon || 'search')]),
        el('p', { className: 'empty__title', text: state.title || 'Nothing here yet' }),
        state.text ? el('p', { className: 'empty__text', text: state.text }) : null,
        state.action || null,
      );
    }

    function go(target) {
      const pages = Math.max(1, Math.ceil(view.length / pageSize));
      page = Math.min(Math.max(1, target), pages);
      const start = (page - 1) * pageSize;
      const slice = view.slice(start, start + pageSize);
      tbody.replaceChildren(...slice.map((row, i) => {
        const tr = el('tr', { className: `is-entering${onRowClick ? ' is-clickable' : ''}` }, columns.map((c) => el('td', { className: cellClass(c) }, [c.render(row)])));
        tr.style.animationDelay = `${i * 20}ms`;
        if (onRowClick) {
          tr.tabIndex = 0;
          tr.setAttribute('aria-label', `Open ${rowLabel(row)}`);
          tr.addEventListener('click', (event) => { if (!event.target.closest('button, a, input, select')) onRowClick(row); });
          tr.addEventListener('keydown', (event) => { if (event.key === 'Enter' && event.target === tr) onRowClick(row); });
        }
        return tr;
      }));
      const isEmpty = view.length === 0;
      wrap.hidden = isEmpty;
      emptyBox.hidden = !isEmpty;
      pager.hidden = isEmpty;
      if (isEmpty) renderEmpty();
      range.textContent = `${start + 1}–${Math.min(start + pageSize, view.length)} of ${Portal.fmt.count(view.length)}`;
      pageLabel.textContent = `Page ${page} of ${pages}`;
      prev.disabled = page <= 1;
      next.disabled = page >= pages;
    }

    return {
      /** Rows after the page's own filters; column filters are applied on top, before pagination. */
      setRows(nextRows) { rows = nextRows; update(); },
      /** Change the empty state, e.g. "no results" vs "needs setup"; re-renders if currently empty. */
      setEmpty(next) { empty = next; if (!view.length) renderEmpty(); },
      refresh() { const current = page; view = active.size ? rows.filter((row) => passes(row)) : rows; renderFilterState(); go(current); },
      clearColumnFilters: clearFilters,
      /** The rows currently shown across all pages (page filters and column filters applied), e.g. for CSV export. */
      get rows() { return view; },
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
