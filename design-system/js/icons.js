/*
 * Icon set (outline icons adapted from Lucide, ISC licence). Markup uses <i data-icon="name"></i>;
 * this script swaps each placeholder for an inline SVG built with DOM APIs (no innerHTML, CSP-safe).
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const I = {
    home: [['path', { d: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' }]],
    payments: [['rect', { x: 2.5, y: 5, width: 19, height: 14, rx: 2 }], ['path', { d: 'M2.5 10h19M6.5 15h4' }]],
    cards: [['rect', { x: 5, y: 2.5, width: 14, height: 19, rx: 2 }], ['path', { d: 'M9 6.5h6' }]],
    reports: [['path', { d: 'M3 3v18h18' }], ['path', { d: 'M7 15v2M11 11v6M15 7v10M19 12v5' }]],
    key: [['circle', { cx: 7.5, cy: 15.5, r: 4.5 }], ['path', { d: 'm10.7 12.3 9.8-9.8M16 7l3 3M13.5 9.5l2 2' }]],
    webhook: [['path', { d: 'M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2' }], ['path', { d: 'm6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06' }], ['path', { d: 'm12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8' }]],
    logs: [['path', { d: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' }]],
    docs: [['path', { d: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20' }]],
    invite: [['circle', { cx: 9, cy: 8, r: 4 }], ['path', { d: 'M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6' }]],
    settings: [['path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
    support: [['path', { d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22z' }]],
    bell: [['path', { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0' }]],
    more: [['circle', { cx: 12, cy: 5, r: 1 }], ['circle', { cx: 12, cy: 12, r: 1 }], ['circle', { cx: 12, cy: 19, r: 1 }]],
    search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'm20 20-3.5-3.5' }]],
    sidebar: [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }], ['path', { d: 'M9 3v18' }]],
    plus: [['path', { d: 'M12 5v14M5 12h14' }]],
    'chevron-down': [['path', { d: 'm6 9 6 6 6-6' }]],
    'chevron-left': [['path', { d: 'm15 18-6-6 6-6' }]],
    'chevrons-up-down': [['path', { d: 'm7 15 5 5 5-5M7 9l5-5 5 5' }]],
    copy: [['rect', { x: 9, y: 9, width: 12, height: 12, rx: 2 }], ['path', { d: 'M5 15V5a2 2 0 0 1 2-2h10' }]],
    check: [['path', { d: 'M20 6 9 17l-5-5' }]],
    'check-circle': [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'm8.5 12 2.5 2.5 4.5-5' }]],
    sun: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41' }]],
    moon: [['path', { d: 'M20.9 13.35A9 9 0 0 1 10.65 3.1 9 9 0 1 0 20.9 13.35Z' }]],
    calendar: [['rect', { x: 3, y: 4.5, width: 18, height: 16.5, rx: 2 }], ['path', { d: 'M3 9.5h18M8 2.5v4M16 2.5v4' }]],
    'arrow-up': [['path', { d: 'M12 19V5M5 12l7-7 7 7' }]],
    'arrow-down': [['path', { d: 'M12 5v14M19 12l-7 7-7-7' }]],
    'arrow-up-down': [['path', { d: 'm21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16' }]],
    'arrow-right': [['path', { d: 'M5 12h14M13 6l6 6-6 6' }]],
    alert: [['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }], ['path', { d: 'M12 9v4M12 17h.01' }]],
    menu: [['path', { d: 'M4 6h16M4 12h16M4 18h16' }]],
    x: [['path', { d: 'M18 6 6 18M6 6l12 12' }]],
    eye: [['path', { d: 'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
    'eye-off': [['path', { d: 'M10.73 5.08A10.43 10.43 0 0 1 12 5c4.97 0 8.5 3.2 9.94 6.65a1 1 0 0 1 0 .7 10.8 10.8 0 0 1-1.44 2.49M14.08 14.16a3 3 0 0 1-4.24-4.24M17.48 17.5A10.75 10.75 0 0 1 2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14M2 2l20 20' }]],
    refund: [['path', { d: 'M3 12a9 9 0 1 0 3-6.7L3 8' }], ['path', { d: 'M3 3v5h5' }]],
    payout: [['path', { d: 'M7 17 17 7M7 7h10v10' }]],
    logout: [['path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9' }]],
    download: [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' }]],
    'chevron-right': [['path', { d: 'm9 18 6-6-6-6' }]],
    filter: [['path', { d: 'M22 3H2l8 9.46V19l4 2v-8.54z' }]],
    link: [['path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }], ['path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }]],
    external: [['path', { d: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }]],
    lock: [['rect', { x: 4, y: 11, width: 16, height: 10, rx: 2 }], ['path', { d: 'M8 11V7a4 4 0 0 1 8 0v4' }]],
    rotate: [['path', { d: 'M21 12a9 9 0 1 1-3-6.7L21 8' }], ['path', { d: 'M21 3v5h-5' }]],
    trash: [['path', { d: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6' }]],
    edit: [['path', { d: 'M12 20h9' }], ['path', { d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' }]],
    send: [['path', { d: 'm22 2-7 20-4-9-9-4zM22 2 11 13' }]],
    mail: [['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }], ['path', { d: 'm22 7-10 6L2 7' }]],
    shield: [['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }]],
    user: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 21a8 8 0 0 1 16 0' }]],
    building: [['rect', { x: 4, y: 2, width: 16, height: 20, rx: 2 }], ['path', { d: 'M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01' }]],
    globe: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' }]],
    play: [['path', { d: 'M6 4l14 8-14 8z' }]],
    power: [['path', { d: 'M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10' }]],
    wallet: [['path', { d: 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1' }], ['path', { d: 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4' }]],
    truck: [['path', { d: 'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62L18.3 9.38a1 1 0 0 0-.78-.38H14' }], ['circle', { cx: 17, cy: 18, r: 2 }], ['circle', { cx: 7, cy: 18, r: 2 }]],
    file: [['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z' }], ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8' }]],
    clock: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 6v6l4 2' }]],
    zap: [['path', { d: 'M13 2 3 14h9l-1 8 10-12h-9z' }]],
    code: [['path', { d: 'm16 18 6-6-6-6M8 6l-6 6 6 6' }]],
    terminal: [['path', { d: 'm4 17 6-6-6-6M12 19h8' }]],
    upload: [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12' }]],
    info: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 16v-4M12 8h.01' }]],
    'x-circle': [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'm15 9-6 6M9 9l6 6' }]],
    snowflake: [['path', { d: 'M2 12h20M12 2v20m-8-6 16-8M4 8l16 8M9 4l3 3 3-3M9 20l3-3 3 3' }]],
    scale: [['path', { d: 'M12 3v18M7 21h10M3 7h18M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z' }]],
    usdt: { fill: true, parts: [
      ['circle', { cx: 12, cy: 12, r: 11, fill: '#26A17B' }],
      ['path', { d: 'M6.5 6.8h11v2.6h-4.1v1.3c3 .2 5.2.8 5.2 1.6s-2.2 1.4-5.2 1.6v4.8h-2.8v-4.8c-3-.2-5.2-.8-5.2-1.6s2.2-1.4 5.2-1.6V9.4H6.5zm5.5 5.6c2.8 0 4.6-.3 4.6-.5s-1.8-.5-4.6-.5-4.6.3-4.6.5 1.8.5 4.6.5z', fill: '#FFFFFF' }],
    ] },
    usdc: { fill: true, parts: [
      ['circle', { cx: 12, cy: 12, r: 11, fill: '#2775CA' }],
      ['text', { x: 12, y: 16.2, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, 'font-family': 'Arial, sans-serif', fill: '#FFFFFF', text: '$' }],
      ['path', { d: 'M8.2 6.6a7 7 0 0 0 0 10.8M15.8 6.6a7 7 0 0 1 0 10.8', fill: 'none', stroke: '#FFFFFF', 'stroke-width': 1.3 }],
    ] },
    visa: { fill: true, parts: [
      ['rect', { x: 0, y: 4, width: 24, height: 16, rx: 2.5, fill: '#1A1F71' }],
      ['text', { x: 12, y: 15.2, 'text-anchor': 'middle', 'font-size': 7.6, 'font-weight': 800, 'font-style': 'italic', 'font-family': 'Arial, sans-serif', fill: '#FFFFFF', 'letter-spacing': 0.2, text: 'VISA' }],
    ] },
    mastercard: { fill: true, parts: [
      ['rect', { x: 0, y: 4, width: 24, height: 16, rx: 2.5, fill: '#141414' }],
      ['circle', { cx: 9.5, cy: 12, r: 5, fill: '#EB001B' }],
      ['circle', { cx: 14.5, cy: 12, r: 5, fill: '#F79E1B' }],
      ['path', { d: 'M12 8.1a5 5 0 0 1 0 7.8 5 5 0 0 1 0-7.8z', fill: '#FF5F00' }],
    ] },
    google: { fill: true, parts: [
      ['path', { d: 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z', fill: '#4285F4' }],
      ['path', { d: 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z', fill: '#34A853' }],
      ['path', { d: 'M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z', fill: '#FBBC05' }],
      ['path', { d: 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z', fill: '#EA4335' }],
    ] },
    github: { fill: true, parts: [
      ['path', { d: 'M12 1.5a10.5 10.5 0 0 0-3.32 20.46c.53.1.72-.23.72-.5v-1.86c-2.92.64-3.54-1.25-3.54-1.25-.48-1.22-1.17-1.54-1.17-1.54-.95-.65.07-.64.07-.64 1.06.07 1.61 1.09 1.61 1.09.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.66-1.4-2.33-.27-4.78-1.17-4.78-5.19 0-1.15.41-2.08 1.08-2.82-.1-.27-.47-1.33.1-2.78 0 0 .88-.28 2.89 1.08a10 10 0 0 1 5.25 0c2-1.36 2.88-1.08 2.88-1.08.58 1.45.21 2.51.1 2.78.68.74 1.08 1.67 1.08 2.82 0 4.03-2.45 4.91-4.79 5.17.38.33.71.97.71 1.96v2.9c0 .28.19.61.73.5A10.5 10.5 0 0 0 12 1.5z', fill: 'currentColor' }],
    ] },
  };

  function build(name) {
    const def = I[name];
    if (!def) return null;
    const isBrand = !Array.isArray(def); // brand icons are { fill: true, parts } objects
    const parts = isBrand ? def.parts : def;
    const svg = document.createElementNS(SVG_NS, 'svg');
    const base = { viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': 'true', focusable: 'false' };
    const stroke = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.75, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    Object.entries(isBrand ? base : { ...base, ...stroke }).forEach(([k, v]) => svg.setAttribute(k, v));
    svg.classList.add(`i-${name}`); // hook for per-icon micro-animations (button.css)
    parts.forEach(([tag, attrs]) => {
      const el = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, v]) => (k === 'text' ? (el.textContent = v) : el.setAttribute(k, v)));
      svg.appendChild(el);
    });
    return svg;
  }

  function hydrate(scope = document) {
    scope.querySelectorAll('i[data-icon]').forEach((placeholder) => {
      const svg = build(placeholder.dataset.icon);
      if (!svg) return;
      placeholder.classList.forEach((c) => svg.classList.add(c));
      placeholder.replaceWith(svg);
    });
  }

  window.Portal.icon = build;
  window.Portal.hydrateIcons = hydrate;
  hydrate();
})();
