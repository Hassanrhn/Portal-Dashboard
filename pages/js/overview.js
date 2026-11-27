/*
 * Overview page: KPIs, scrubbable volume chart, share bars and the recent payments table.
 * Reads Portal.data.overview (overview-data.js). All DOM is built with createElement/textContent.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const data = Portal.data.overview;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  /* Formatting ------------------------------------------------------------- */
  const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dayLabel = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const stamp = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
  const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function el(tag, { className, text, attrs } = {}, children = []) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    children.forEach((child) => child && node.appendChild(child));
    return node;
  }

  function svg(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  /** Animates a number from its current value; one quick ease-out, skipped for reduced motion. */
  function tween(node, to, format) {
    const from = Number(node.dataset.current || 0);
    node.dataset.current = String(to);
    if (reducedMotion.matches || from === to) { node.textContent = format(to); return; }
    const start = performance.now();
    const duration = 650;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = format(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function setDelta(node, value, { unit = '%', decimals = 1 } = {}) {
    const up = value >= 0;
    node.className = `delta ${up ? 'delta--up' : 'delta--down'}`;
    node.replaceChildren(Portal.icon(up ? 'arrow-up' : 'arrow-down'), document.createTextNode(`${Math.abs(value).toFixed(decimals)}${unit}`));
    node.querySelector('svg').setAttribute('width', 12);
    node.querySelector('svg').setAttribute('height', 12);
  }

  /* KPIs -------------------------------------------------------------------- */
  function renderKpis(range) {
    tween($('[data-kpi="volume"]'), Number(range.total), money);
    tween($('[data-kpi="rate"]'), range.rate, (n) => n.toFixed(1));
    tween($('[data-kpi="paid"]'), range.paid, (n) => String(Math.round(n)));
    setDelta($('[data-kpi-delta="volume"]'), range.volumeDelta);
    setDelta($('[data-kpi-delta="rate"]'), range.rateDelta, { unit: ' pts' });
    setDelta($('[data-kpi-delta="paid"]'), range.paidDelta, { unit: '', decimals: 0 });
    $('[data-kpi-period]').textContent = range.period;
    $('[data-kpi="rate-detail"]').textContent = `${range.paid} of ${range.payments} payments`;
    $('[data-kpi="paid-detail"]').textContent = `${range.payments - range.paid} failed or pending`;
    $$('[data-range-label]').forEach((node) => { node.textContent = range.label; });
  }

  /* Volume chart ------------------------------------------------------------- */
  const chart = {
    host: $('[data-chart]'),
    value: $('[data-chart-value]'),
    label: $('[data-chart-label]'),
    readout: $('.volume-readout'),
    range: null,
    points: [],
    index: -1,
  };
  const PAD = { top: 12, right: 8, bottom: 26, left: 40 };

  function niceMax(max) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / magnitude) * magnitude;
  }

  function drawChart({ animate }) {
    const { host, range } = chart;
    const width = host.clientWidth - 2 * parseFloat(getComputedStyle(host).paddingLeft || 0);
    const height = host.clientHeight;
    if (width <= 0) return;
    const values = range.series.map((d) => d.value);
    const yMax = niceMax(Math.max(...values) * 1.1);
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (i / (values.length - 1)) * innerW;
    const y = (v) => PAD.top + innerH - (v / yMax) * innerH;
    chart.points = values.map((v, i) => ({ x: x(i), y: y(v) }));

    const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
    for (let i = 0; i <= 4; i += 1) {
      const v = (yMax / 4) * i;
      root.appendChild(svg('line', { class: 'chart__grid', x1: PAD.left, x2: width - PAD.right, y1: y(v), y2: y(v) }));
      const tick = svg('text', { class: 'chart__axis', x: PAD.left - 10, y: y(v) + 4, 'text-anchor': 'end' });
      tick.textContent = String(Math.round(v));
      root.appendChild(tick);
    }
    [0, Math.floor((values.length - 1) / 2), values.length - 1].forEach((i, n) => {
      const tick = svg('text', { class: 'chart__axis', x: x(i), y: height - 6, 'text-anchor': ['start', 'middle', 'end'][n] });
      tick.textContent = dayLabel(range.series[i].date);
      root.appendChild(tick);
    });

    const line = smoothPath(chart.points);
    const baseline = PAD.top + innerH;
    const area = svg('path', { class: 'chart__area', d: `${line} L${x(values.length - 1)},${baseline} L${x(0)},${baseline} Z` });
    const path = svg('path', { class: 'chart__line', d: line });
    root.append(area, path);
    chart.cursor = svg('line', { class: 'chart__cursor', y1: PAD.top, y2: baseline });
    chart.dot = svg('circle', { class: 'chart__dot', r: 4.5 });
    root.append(chart.cursor, chart.dot);
    host.replaceChildren(root);

    if (animate && !reducedMotion.matches) {
      path.style.setProperty('--len', String(path.getTotalLength()));
      path.classList.add('is-drawing');
      area.classList.add('is-drawing');
    }
  }

  /** Monotone-ish smoothing: cubic segments with horizontal control points. */
  function smoothPath(points) {
    return points.reduce((d, p, i) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const prev = points[i - 1];
      const mid = (p.x - prev.x) / 2;
      return `${d} C${prev.x + mid},${prev.y} ${p.x - mid},${p.y} ${p.x},${p.y}`;
    }, '');
  }

  function showTotal() {
    chart.index = -1;
    chart.host.classList.remove('is-scrubbing');
    chart.readout.classList.remove('is-scrubbing');
    chart.value.textContent = money(Number(chart.range.total));
    chart.label.textContent = `USD eq. total, ${chart.range.label.toLowerCase()}`;
  }

  function scrubTo(index) {
    const i = Math.max(0, Math.min(chart.points.length - 1, index));
    const point = chart.points[i];
    const day = chart.range.series[i];
    chart.index = i;
    chart.host.classList.add('is-scrubbing');
    chart.readout.classList.add('is-scrubbing');
    chart.cursor.setAttribute('x1', point.x);
    chart.cursor.setAttribute('x2', point.x);
    chart.dot.setAttribute('cx', point.x);
    chart.dot.setAttribute('cy', point.y);
    chart.value.textContent = money(day.value);
    chart.label.textContent = `USD eq. on ${dayLabel(day.date)}`;
  }

  function nearestIndex(clientX) {
    const box = chart.host.querySelector('svg').getBoundingClientRect();
    const px = clientX - box.left;
    let best = 0;
    chart.points.forEach((p, i) => { if (Math.abs(p.x - px) < Math.abs(chart.points[best].x - px)) best = i; });
    return best;
  }

  chart.host.addEventListener('pointermove', (event) => scrubTo(nearestIndex(event.clientX)));
  chart.host.addEventListener('pointerleave', showTotal);
  chart.host.addEventListener('blur', showTotal);
  chart.host.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (event.key === 'Home') { event.preventDefault(); scrubTo(0); }
    else if (event.key === 'End') { event.preventDefault(); scrubTo(chart.points.length - 1); }
    else if (step) { event.preventDefault(); scrubTo(chart.index < 0 ? (step > 0 ? 0 : chart.points.length - 1) : chart.index + step); }
  });
  new ResizeObserver(() => chart.range && drawChart({ animate: false })).observe(chart.host);

  /* Share bars --------------------------------------------------------------- */
  function renderShare(host, rows, total) {
    const bar = el('div', { className: 'share__bar', attrs: { 'aria-hidden': 'true' } });
    const list = el('ul', { className: 'share__list' });
    rows.forEach(([name, share, color], i) => {
      const seg = el('span', { className: `share__seg ${color}` });
      seg.style.flexGrow = String(share);
      seg.style.animationDelay = `${i * 60}ms`;
      const row = el('li', { className: `share__row ${color}` }, [
        el('span', { className: 'share__swatch', attrs: { 'aria-hidden': 'true' } }),
        el('span', { text: name }),
        el('span', { className: 'share__value', text: money(total * share) }),
        el('span', { className: 'share__pct', text: `${Math.round(share * 100)}%` }),
      ]);
      const focus = (on) => {
        host.classList.toggle('is-focusing', on);
        seg.classList.toggle('is-active', on);
        row.classList.toggle('is-active', on);
      };
      [seg, row].forEach((node) => {
        node.addEventListener('pointerenter', () => focus(true));
        node.addEventListener('pointerleave', () => focus(false));
      });
      bar.appendChild(seg);
      list.appendChild(row);
    });
    host.replaceChildren(bar, list);
  }

  /* Payments table ----------------------------------------------------------- */
  const tbody = $('[data-payments]');
  const COPY_LABEL = 'Copy request ID';

  function paymentRow(p, index) {
    const copyBtn = el('button', { className: 'copy__btn', attrs: { type: 'button', 'data-copy': p.id, 'aria-label': `${COPY_LABEL} ${p.id}` } });
    const copyIcon = Portal.icon('copy'); copyIcon.classList.add('icon-copy');
    const checkIcon = Portal.icon('check'); checkIcon.classList.add('icon-check');
    copyBtn.append(copyIcon, checkIcon);
    const statusClass = { paid: 'badge--success', pending: 'badge--warning', failed: 'badge--danger', cancelled: '' }[p.status];
    const row = el('tr', { className: 'is-entering' }, [
      el('td', {}, [el('span', { className: 'copy' }, [el('span', { className: 'u-mono', text: p.id }), copyBtn])]),
      el('td', { className: 'u-muted', text: p.ref }),
      el('td', { text: p.route }),
      el('td', {}, [el('span', { className: `badge ${statusClass}`.trim(), text: titleCase(p.status) })]),
      el('td', { className: 'is-num' }, [el('span', { text: p.amount }), el('span', { className: 'amount__currency', text: p.currency })]),
      el('td', { className: 'is-num u-muted', text: stamp(p.date) }),
    ]);
    row.style.animationDelay = `${index * 30}ms`;
    return row;
  }

  function renderPayments(filter) {
    const rows = data.payments.filter((p) => filter === 'all' || p.status === filter);
    if (!rows.length) {
      const cell = el('td', { className: 'table__empty', text: `No ${filter} payments in this period.`, attrs: { colspan: '6' } });
      tbody.replaceChildren(el('tr', {}, [cell]));
      return;
    }
    tbody.replaceChildren(...rows.map(paymentRow));
  }

  /* Search index for the ⌘K palette ------------------------------------------- */
  Portal.searchIndex = data.payments.map((p) => ({
    label: p.id,
    hint: `${p.ref} · ${p.amount} ${p.currency}`,
    run: () => {
      $('[data-status-filter]').portalSelect?.('all');
      renderPayments('all');
      const cell = $$('.u-mono', tbody).find((node) => node.textContent === p.id);
      cell?.closest('tr').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
      cell?.closest('tr').classList.add('is-entering');
    },
  }));

  /* Wiring ----------------------------------------------------------------------- */
  function applyRange(key, { animate }) {
    const range = data.ranges[key];
    if (!range) return;
    chart.range = range;
    renderKpis(range);
    drawChart({ animate });
    showTotal();
    renderShare($('[data-share="route"]'), data.shares.route, Number(range.total));
    renderShare($('[data-share="currency"]'), data.shares.currency, Number(range.total));
  }

  $('[data-range-control]').addEventListener('segmented:change', (event) => applyRange(event.detail.value, { animate: true }));
  $('[data-status-filter]').addEventListener('segmented:change', (event) => renderPayments(event.detail.value));

  applyRange('30d', { animate: true });
  renderPayments('all');
})();
