/*
 * Safe DOM building and formatting helpers shared by dashboard pages.
 * Never uses innerHTML: text always goes through textContent.
 */
(function () {
  'use strict';

  const Portal = window.Portal;

  /**
   * el('div', { className, text, attrs, on, dataset }, [children])
   * Children may be Nodes, strings (become text nodes), or falsy (skipped).
   */
  function el(tag, options = {}, children = []) {
    const node = document.createElement(tag);
    const { className, text, attrs, on, dataset } = options;
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => { if (v !== false && v !== undefined && v !== null) node.setAttribute(k, v === true ? '' : String(v)); });
    if (dataset) Object.entries(dataset).forEach(([k, v]) => { node.dataset[k] = String(v); });
    if (on) Object.entries(on).forEach(([type, handler]) => node.addEventListener(type, handler));
    children.forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
    });
    return node;
  }

  /** Icon element with optional extra class. */
  function icon(name, className) {
    const svg = Portal.icon(name);
    if (svg && className) svg.classList.add(className);
    return svg;
  }

  /** Button helper: btn('Export', { variant: 'primary', size: 'sm', icon: 'download', onClick }) */
  function btn(label, { variant, size, iconName, onClick, attrs = {}, iconOnly = false } = {}) {
    const classes = ['btn', variant && `btn--${variant}`, size && `btn--${size}`, iconOnly && 'btn--icon'].filter(Boolean).join(' ');
    const children = [iconName && icon(iconName), !iconOnly && label].filter(Boolean);
    return el('button', { className: classes, attrs: { type: 'button', ...(iconOnly ? { 'aria-label': label } : {}), ...attrs }, on: onClick ? { click: onClick } : undefined }, children);
  }

  /** Status badge: badge('paid') → <span class="badge badge--success">Paid</span> */
  const STATUS_TONE = {
    paid: 'success', active: 'success', connected: 'success', delivered: 'success', succeeded: 'success', approved: 'success', verified: 'success', completed: 'success', shipped: 'success', ready: 'success', open: 'info',
    pending: 'warning', awaiting_approval: 'warning', mismatch: 'danger', matched: 'success', resolved: 'success', processing: 'warning', review: 'warning', retrying: 'warning', invited: 'warning', awaiting: 'warning', in_transit: 'warning', needs_scope: 'warning', generating: 'warning',
    failed: 'danger', revoked: 'danger', rejected: 'danger', dead: 'danger', disconnected: 'danger', frozen: 'info', refunded: 'info', partially_refunded: 'info', expired: 'danger', blocked: 'danger',
    cancelled: '', disabled: '', closed: '', draft: '',
  };
  const humanize = (s) => String(s).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  function badge(status, label) {
    const tone = STATUS_TONE[status];
    return el('span', { className: `badge${tone ? ` badge--${tone}` : ''}`, text: label || humanize(status) });
  }

  /** Copyable monospace identifier (same markup as Overview). */
  function copyable(value, { mono = true, label = 'Copy' } = {}) {
    const button = el('button', { className: 'copy__btn', attrs: { type: 'button', 'data-copy': value, 'aria-label': `${label} ${value}` } }, [icon('copy', 'icon-copy'), icon('check', 'icon-check')]);
    button.addEventListener('click', (event) => event.stopPropagation());
    return el('span', { className: 'copy' }, [el('span', { className: mono ? 'u-mono' : '', text: value }), button]);
  }

  /* Formatting ------------------------------------------------------------------ */
  const fmt = {
    money: (value) => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    count: (value) => Number(value).toLocaleString('en-US'),
    date: (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
    dateTime: (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }),
    time: (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }),
    relative(iso, now = Date.UTC(2026, 10, 27, 12)) {
      const mins = Math.round((now - new Date(iso).getTime()) / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins} min ago`;
      const hours = Math.round(mins / 60);
      if (hours < 24) return `${hours} h ago`;
      const days = Math.round(hours / 24);
      return days === 1 ? 'yesterday' : `${days} days ago`;
    },
    humanize,
  };

  /** Pretty-prints JSON into a <pre> with token colouring, using text nodes only. */
  function jsonBlock(value) {
    const pre = el('pre');
    const text = JSON.stringify(value, null, 2);
    const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(-?\d+(?:\.\d+)?)\b|\b(true|false|null)\b/g;
    let last = 0;
    text.replace(pattern, (match, str, colon, num, lit, index) => {
      if (index > last) pre.appendChild(document.createTextNode(text.slice(last, index)));
      if (str) {
        pre.appendChild(el('span', { className: colon ? 'code__key' : 'code__str', text: str }));
        if (colon) pre.appendChild(document.createTextNode(colon));
      } else {
        pre.appendChild(el('span', { className: 'code__num', text: num || lit }));
      }
      last = index + match.length;
      return match;
    });
    pre.appendChild(document.createTextNode(text.slice(last)));
    return pre;
  }

  /** Code panel with a header label and a copy button. */
  function codePanel(label, content) {
    const isString = typeof content === 'string';
    const raw = isString ? content : JSON.stringify(content, null, 2);
    const copyBtn = el('button', { className: 'btn btn--ghost btn--sm', attrs: { type: 'button', 'data-copy': raw, 'aria-label': `Copy ${label}` } }, [icon('copy'), 'Copy']);
    return el('div', { className: 'code' }, [
      el('div', { className: 'code__head' }, [el('span', { text: label }), copyBtn]),
      isString ? el('pre', { text: content }) : jsonBlock(content),
    ]);
  }

  /** Simulated API latency for prototype data. Replace with fetch() when wiring the backend. */
  const request = (value, { delay = 300 + Math.random() * 450, fail = false } = {}) =>
    new Promise((resolve, reject) => window.setTimeout(() => (fail ? reject(new Error('Request failed')) : resolve(value)), delay));

  Object.assign(Portal, { el, iconEl: icon, btn, badge, copyable, fmt, jsonBlock, codePanel, request });
})();
