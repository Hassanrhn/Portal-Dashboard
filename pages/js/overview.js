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
  }

  /* Volume chart ------------------------------------------------------------- *
   * Soft area/line chart. The SVG is built once per size; range changes morph the existing paths:
   * both series are resampled onto the same x grid and their y values interpolated with rAF. */
  const chart = {
    host: $('[data-chart]'),
    value: $('[data-chart-value]'),
    label: $('[data-chart-label]'),
    readout: $('.volume-readout'),
    range: null,
    geo: null,
    points: [],
    index: -1,
    size: '',
    frame: 0,
    uid: `chart-fill-${Math.random().toString(36).slice(2, 8)}`,
  };
  const PAD = { top: 12, right: 4, bottom: 24, left: 30 };
  const TIP_GAP = 12;
  const AREA_OPACITY = 0.18;

  /** Duration of a motion token in ms (e.g. "360ms"); JS timings follow the same tokens as CSS. */
  function tokenMs(name) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(raw);
    return raw.endsWith('ms') ? n : n * 1000;
  }
  const morphMs = () => tokenMs('--motion-duration-slow') * 5 / 3; // matches --chart-morph in chart.css
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /** Step from {1, 2, 2.5, 5} × 10^k so four steps cover max. */
  function niceStep(max) {
    const raw = max / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw) * magnitude;
    return step;
  }
  const tickText = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  function geometry(range) {
    const { host } = chart;
    const width = host.clientWidth - 2 * parseFloat(getComputedStyle(host).paddingLeft || 0);
    const height = host.clientHeight;
    const values = range.series.map((d) => d.value);
    const step = niceStep(Math.max(...values) * 1.08);
    const yMax = step * 4;
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (i / (values.length - 1)) * innerW;
    const y = (v) => PAD.top + innerH - (v / yMax) * innerH;
    // Date labels on an even day stride counted back from today; one too close to the left edge is dropped.
    const last = values.length - 1;
    const stride = Math.max(1, Math.ceil(last / Math.max(1, Math.floor(innerW / 80))));
    const xTicks = [];
    for (let i = last; i >= 0; i -= stride) if (i === 0 || x(i) - PAD.left >= 40) xTicks.unshift(i);
    return {
      width, height, baseline: PAD.top + innerH, left: PAD.left, right: width - PAD.right,
      points: values.map((v, i) => ({ x: x(i), y: y(v) })),
      yTicks: [0, 1, 2, 3, 4].map((k) => ({ y: y(step * k), text: tickText(step * k) })),
      xTicks: xTicks.map((i) => ({ x: x(i), text: dayLabel(range.series[i].date), anchor: i === 0 ? 'start' : i === last ? 'end' : 'middle' })),
    };
  }

  function buildAxes(geo) {
    const group = svg('g', { class: 'chart__axes' });
    geo.yTicks.forEach((t) => {
      const label = svg('text', { class: 'chart__axis', x: 0, y: t.y + 4 });
      label.textContent = t.text;
      group.appendChild(label);
    });
    geo.xTicks.forEach((t) => {
      const label = svg('text', { class: 'chart__axis', x: t.x, y: geo.height - 4, 'text-anchor': t.anchor });
      label.textContent = t.text;
      group.appendChild(label);
    });
    return group;
  }

  /** Cubic segments with horizontal control points (smooth, never overshoots between days). */
  function smoothPath(points) {
    return points.reduce((d, p, i) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const prev = points[i - 1];
      const mid = (p.x - prev.x) / 2;
      return `${d} C${prev.x + mid},${prev.y} ${p.x - mid},${p.y} ${p.x},${p.y}`;
    }, '');
  }
  const polyPath = (points) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const areaPath = (line, points, baseline) => `${line} L${points[points.length - 1].x},${baseline} L${points[0].x},${baseline} Z`;

  /** Samples the smoothPath curve at n evenly spaced x positions, so two series of any length line up. */
  function resample(points, n) {
    const x0 = points[0].x;
    const x1 = points[points.length - 1].x;
    let k = 0;
    return Array.from({ length: n }, (_, j) => {
      const X = x0 + ((x1 - x0) * j) / (n - 1);
      while (k < points.length - 2 && points[k + 1].x < X) k += 1;
      const a = points[k];
      const b = points[k + 1];
      const u = (X - a.x) / (b.x - a.x || 1);
      let lo = 0; let hi = 1; let t = u; // x(t) = 1.5t(1−t) + t³ is monotone: bisect for t
      for (let it = 0; it < 18; it += 1) {
        t = (lo + hi) / 2;
        if (1.5 * t * (1 - t) + t * t * t < u) lo = t; else hi = t;
      }
      return { x: X, y: a.y + (b.y - a.y) * (3 * t * t - 2 * t * t * t) };
    });
  }

  /** Gradient stops read the live --chart-1 value, so they follow the theme. */
  function paintGradient() {
    if (!chart.stops) return;
    const color = getComputedStyle(chart.host).getPropertyValue('--chart-1').trim();
    chart.stops.forEach((stop, i) => {
      stop.setAttribute('stop-color', color);
      stop.setAttribute('stop-opacity', i === 0 ? String(AREA_OPACITY) : '0');
    });
  }

  function buildChart({ animate }) {
    const { host, range } = chart;
    cancelAnimationFrame(chart.frame);
    const geo = geometry(range);
    if (geo.width <= 0 || geo.height <= 0) return;
    chart.geo = geo;
    chart.points = geo.points;
    chart.size = `${host.clientWidth}x${host.clientHeight}`;

    const root = svg('svg', { viewBox: `0 0 ${geo.width} ${geo.height}`, 'aria-hidden': 'true' });
    const gradient = svg('linearGradient', { id: chart.uid, x1: 0, y1: 0, x2: 0, y2: 1 });
    chart.stops = [svg('stop', { offset: '0' }), svg('stop', { offset: '1' })];
    gradient.append(...chart.stops);
    const defs = svg('defs');
    defs.appendChild(gradient);

    const grid = svg('g');
    geo.yTicks.forEach((t) => grid.appendChild(svg('line', { class: 'chart__grid', x1: geo.left, x2: geo.right, y1: t.y, y2: t.y })));
    chart.axes = buildAxes(geo);

    const line = smoothPath(geo.points);
    chart.area = svg('path', { class: 'chart__area', d: areaPath(line, geo.points, geo.baseline), fill: `url(#${chart.uid})` });
    chart.line = svg('path', { class: 'chart__line', d: line });

    chart.guide = svg('line', { class: 'chart__guide', x1: 0, x2: 0, y1: PAD.top, y2: geo.baseline });
    chart.marker = svg('g', { class: 'chart__marker' });
    chart.marker.append(svg('circle', { class: 'chart__ring', r: 9 }), svg('circle', { class: 'chart__dot', r: 4 }));

    root.append(defs, grid, chart.axes, chart.area, chart.line, chart.guide, chart.marker);
    chart.tipDate = el('span', { className: 'chart__tooltip-date' });
    chart.tipValue = el('span', { className: 'chart__tooltip-value' });
    chart.tooltip = el('div', { className: 'chart__tooltip', attrs: { 'aria-hidden': 'true' } }, [chart.tipDate, chart.tipValue]);
    host.replaceChildren(root, chart.tooltip);
    paintGradient();

    if (animate && !reducedMotion.matches) {
      chart.line.style.setProperty('--len', String(chart.line.getTotalLength()));
      chart.line.classList.add('is-drawing');
      chart.area.classList.add('is-drawing');
      chart.line.addEventListener('animationend', () => chart.line.classList.remove('is-drawing'), { once: true });
      chart.area.addEventListener('animationend', () => chart.area.classList.remove('is-drawing'), { once: true });
    }
    if (chart.index >= 0) scrubTo(chart.index, { snap: true });
  }

  /** Range change: morph line + area from the old series to the new one, cross-fade the axis labels. */
  function morphChart(range) {
    const from = chart.points;
    chart.range = range;
    if (!chart.line || !from.length || reducedMotion.matches) { buildChart({ animate: false }); return; }
    cancelAnimationFrame(chart.frame);
    const geo = geometry(range);
    if (geo.width <= 0) return;
    chart.geo = geo;
    chart.points = geo.points;
    [chart.line, chart.area].forEach((node) => node.classList.remove('is-drawing'));

    const duration = morphMs();
    const oldAxes = chart.axes;
    chart.axes = buildAxes(geo);
    chart.axes.classList.add('is-entering');
    oldAxes.classList.remove('is-entering');
    oldAxes.classList.add('is-leaving');
    oldAxes.after(chart.axes);
    window.setTimeout(() => oldAxes.remove(), duration);

    const n = Math.max(48, Math.ceil(geo.width / 3));
    const a = resample(from, n);
    const b = resample(geo.points, n);
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1) {
        const line = smoothPath(geo.points);
        chart.line.setAttribute('d', line);
        chart.area.setAttribute('d', areaPath(line, geo.points, geo.baseline));
        return;
      }
      const e = easeInOut(t);
      const pts = a.map((p, i) => ({ x: p.x, y: p.y + (b[i].y - p.y) * e }));
      const line = polyPath(pts);
      chart.line.setAttribute('d', line);
      chart.area.setAttribute('d', areaPath(line, pts, geo.baseline));
      chart.frame = requestAnimationFrame(frame);
    };
    chart.frame = requestAnimationFrame(frame);
    if (chart.index >= 0) scrubTo(chart.index);
  }

  function showTotal() {
    chart.index = -1;
    chart.host.classList.remove('is-scrubbing');
    chart.readout.classList.remove('is-scrubbing');
    chart.value.textContent = money(Number(chart.range.total));
    chart.label.textContent = `USD eq. total, ${chart.range.label.toLowerCase()}`;
  }

  function scrubTo(index, { snap = false } = {}) {
    if (!chart.points.length || !chart.tooltip) return;
    const i = Math.max(0, Math.min(chart.points.length - 1, index));
    const point = chart.points[i];
    const day = chart.range.series[i];
    const { host, tooltip } = chart;
    const wasHidden = !host.classList.contains('is-scrubbing');
    chart.index = i;
    chart.tipDate.textContent = day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
    chart.tipValue.replaceChildren(document.createTextNode(money(day.value)), el('span', { className: 'chart__tooltip-unit', text: 'USD eq.' }));

    // Tooltip sits up and to the right of the point; it flips left and clamps so it never leaves the card.
    const pad = parseFloat(getComputedStyle(host).paddingLeft || 0);
    const px = pad + point.x;
    const tipW = tooltip.offsetWidth;
    const tipH = tooltip.offsetHeight;
    const maxLeft = host.clientWidth - pad - tipW;
    let left = px + TIP_GAP;
    if (left > maxLeft) left = px - TIP_GAP - tipW;
    left = Math.max(pad, Math.min(maxLeft, left));
    const top = Math.max(0, Math.min(chart.geo.baseline - tipH, point.y - tipH - TIP_GAP));

    if (wasHidden || snap) host.classList.add('is-snapping');
    chart.guide.style.setProperty('transform', `translate(${point.x}px, 0)`);
    chart.marker.style.setProperty('transform', `translate(${point.x}px, ${point.y}px)`);
    tooltip.style.setProperty('transform', `translate(${left}px, ${top}px)`);
    if (wasHidden || snap) {
      void host.offsetWidth; // commit the snapped position before easing resumes
      host.classList.remove('is-snapping');
    }
    host.classList.add('is-scrubbing');
    chart.readout.classList.add('is-scrubbing');
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

  const onPointer = (event) => { if (chart.points.length) scrubTo(nearestIndex(event.clientX)); };
  chart.host.addEventListener('pointermove', onPointer);
  chart.host.addEventListener('pointerdown', onPointer);
  chart.host.addEventListener('pointerleave', () => chart.range && showTotal());
  chart.host.addEventListener('blur', () => chart.range && showTotal());
  chart.host.addEventListener('keydown', (event) => {
    if (!chart.points.length) return;
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (event.key === 'Home') { event.preventDefault(); scrubTo(0); }
    else if (event.key === 'End') { event.preventDefault(); scrubTo(chart.points.length - 1); }
    else if (event.key === 'Escape') showTotal();
    else if (step) { event.preventDefault(); scrubTo(chart.index < 0 ? (step > 0 ? 0 : chart.points.length - 1) : chart.index + step); }
  });
  // Rebuild only when the box really changes size (the initial observe callback must not cancel the draw-in).
  new ResizeObserver(() => {
    if (chart.range && chart.size !== `${chart.host.clientWidth}x${chart.host.clientHeight}`) buildChart({ animate: false });
  }).observe(chart.host);
  // Theme switch: gradient stop colours are attributes, so repaint them from the new tokens.
  new MutationObserver(paintGradient).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* Share bars ---------------------------------------------------------------- *
   * Built once; later renders update widths (flex-grow transitions) and tween the values in place. */
  /** Currency logos (USDT/USDC marks, flags for fiat) and route icons in the share lists. */
  function shareLogo(name) {
    const option = document.createElement('option');
    option.textContent = name;
    option.value = name;
    const logo = Portal.optionIcon?.(option);
    if (logo) logo.classList.add('share__logo');
    return logo;
  }

  function renderShare(host, rows, total) {
    if (host.shareRows?.length === rows.length) {
      rows.forEach(([, share], i) => {
        const r = host.shareRows[i];
        r.seg.style.setProperty('flex-grow', String(share));
        tween(r.value, total * share, money);
        tween(r.pct, share * 100, (n) => `${Math.round(n)}%`);
      });
      return;
    }
    const bar = el('div', { className: 'share__bar', attrs: { 'aria-hidden': 'true' } });
    const list = el('ul', { className: 'share__list' });
    host.shareRows = rows.map(([name, share, color], i) => {
      const seg = el('span', { className: `share__seg ${color}` });
      seg.style.setProperty('--i', String(i));
      const value = el('span', { className: 'share__value', text: money(total * share) });
      const pct = el('span', { className: 'share__pct', text: `${Math.round(share * 100)}%` });
      value.dataset.current = String(total * share);
      pct.dataset.current = String(share * 100);
      const row = el('li', { className: `share__row ${color}` }, [
        el('span', { className: 'share__swatch', attrs: { 'aria-hidden': 'true' } }),
        el('span', { className: 'share__name' }, [shareLogo(name) || null, document.createTextNode(name)]),
        value,
        pct,
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
      return { seg, value, pct, share };
    });
    host.replaceChildren(bar, list);
    // Grow in from zero on first render (one frame at 0, then the real shares).
    if (reducedMotion.matches) host.shareRows.forEach((r) => r.seg.style.setProperty('flex-grow', String(r.share)));
    else requestAnimationFrame(() => requestAnimationFrame(() => host.shareRows.forEach((r) => r.seg.style.setProperty('flex-grow', String(r.share)))));
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
      state.status = 'all';
      renderPayments('all');
      const cell = $$('.u-mono', tbody).find((node) => node.textContent === p.id);
      cell?.closest('tr').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
      cell?.closest('tr').classList.add('is-entering');
    },
  }));

  /* Lazy sections ------------------------------------------------------------------
   * Each section fetches when it nears the viewport and shows a skeleton until then.
   * `request` stands in for the API; swap it for fetch() (and allow the API host in connect-src). */
  const state = { range: '30d', status: 'all' };
  const request = (value) => new Promise((resolve) => window.setTimeout(() => resolve(value), 300 + Math.random() * 500));
  const currentRange = () => data.ranges[state.range];

  /* Range changes: KPIs reload as usual. Chart and share bars that are already on screen refetch in place
   * (no skeleton) so they can morph from the old data; sections not loaded yet load lazily with the new range. */
  let rangeRequest = 0;
  function refreshRange() {
    const token = (rangeRequest += 1);
    const range = currentRange();
    Portal.lazy.reload('kpis');
    if (chart.line) {
      chart.host.classList.add('is-updating');
      request(range).then((r) => {
        if (token !== rangeRequest) return;
        chart.host.classList.remove('is-updating');
        morphChart(r);
        if (chart.index < 0) showTotal(); else scrubTo(chart.index);
      });
    } else Portal.lazy.reload('volume');
    ['route', 'currency'].forEach((kind) => {
      const host = $(`[data-share="${kind}"]`);
      if (!host.shareRows) { Portal.lazy.reload(`share-${kind}`); return; }
      request(Number(range.total)).then((total) => { if (token === rangeRequest) renderShare(host, (currentRange().shares || data.shares)[kind], total); });
    });
  }

  Portal.lazy.register('kpis', { fetch: () => request(currentRange()), render: renderKpis });
  Portal.lazy.register('volume', {
    fetch: () => request(currentRange()),
    render: (range) => {
      chart.range = range;
      chart.host.classList.remove('is-updating');
      if (chart.line && chart.host.isConnected) morphChart(range); else buildChart({ animate: true });
      if (chart.index < 0) showTotal();
    },
  });
  ['route', 'currency'].forEach((kind) => Portal.lazy.register(`share-${kind}`, {
    fetch: () => request(Number(currentRange().total)),
    render: (total) => renderShare($(`[data-share="${kind}"]`), (currentRange().shares || data.shares)[kind], total),
  }));
  Portal.lazy.register('payments', { fetch: () => request(data.payments), render: () => renderPayments(state.status) });

  /* Wiring ----------------------------------------------------------------------- */
  function setRangeLabels() {
    $$('[data-range-label]').forEach((node) => { node.textContent = currentRange().label; });
  }

  $('[data-range-control]').addEventListener('segmented:change', (event) => {
    if (!data.ranges[event.detail.value]) return;
    state.range = event.detail.value;
    setRangeLabels();
    refreshRange();
  });
  $('[data-status-filter]').addEventListener('segmented:change', (event) => {
    state.status = event.detail.value;
    renderPayments(state.status);
  });

  setRangeLabels();
})();
