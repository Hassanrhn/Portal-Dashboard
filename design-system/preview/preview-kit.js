/*
 * Design system docs: page registry and building blocks shared by every docs page.
 *   PV.page({ id, group, title, desc, tokens: ['--button-'], render(h) → nodes })
 * Pages render only when opened (see preview.js). The helpers in `h` build examples with a "Code"
 * toggle, static state grids, live token tables and the token tuning panel.
 * DOM is built with Portal.el only; snippets are read from outerHTML-like serialisation, never written as HTML.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el } = Portal;
  const root = document.documentElement;

  const PV = (window.PV = { pages: [], groups: ['Foundations', 'Components', 'Patterns'] });
  PV.page = (def) => { PV.pages.push(def); };

  /** Icon placeholder: becomes an SVG on mount, and stays readable as <i data-icon> in code snippets. */
  const ic = (name, className) => el('i', { className, attrs: { 'data-icon': name } });
  PV.ic = ic;

  /* Snippet serialiser --------------------------------------------------------------- */
  const VOID = new Set(['input', 'img', 'br', 'hr', 'source', 'col']);
  const SKIP_ATTRS = new Set(['data-ready', 'data-enhanced', 'style', 'inert']);
  const escAttr = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const escText = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function attrs(node) {
    return Array.from(node.attributes)
      .filter((a) => !SKIP_ATTRS.has(a.name))
      .map((a) => (a.value === '' ? ` ${a.name}` : ` ${a.name}="${escAttr(a.value)}"`))
      .join('');
  }

  function serialise(node, depth = 0) {
    const pad = '  '.repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      return text ? pad + escText(text) : '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (tag === 'svg') {
      const classes = Array.from(node.classList);
      const name = (classes.find((c) => c.startsWith('i-')) || 'i-icon').slice(2);
      const extra = classes.filter((c) => !c.startsWith('i-'));
      return `${pad}<i data-icon="${name}"${extra.length ? ` class="${extra.join(' ')}"` : ''}></i>`;
    }
    const open = `<${tag}${attrs(node)}>`;
    if (VOID.has(tag)) return pad + open;
    const close = `</${tag}>`;
    const inline = Array.from(node.childNodes).map((c) => serialise(c, 0)).filter(Boolean);
    const oneLine = `${pad}${open}${inline.join('')}${close}`;
    if (!inline.some((s) => s.includes('\n')) && oneLine.length <= 110) return oneLine;
    const kids = Array.from(node.childNodes).map((c) => serialise(c, depth + 1)).filter(Boolean);
    return `${pad}${open}\n${kids.join('\n')}\n${pad}${close}`;
  }
  PV.snippet = (nodes) => [].concat(nodes).filter(Boolean).map((n) => serialise(n)).join('\n');

  /* Live token values ------------------------------------------------------------------ */
  const probe = el('span', { className: 'pv-probe', attrs: { 'aria-hidden': 'true' } });
  const isColor = (value) => value && !/^-?\d/.test(value) && window.CSS?.supports?.('color', value);

  function toHex(value) {
    if (!probe.isConnected) document.body.appendChild(probe);
    probe.style.setProperty('color', value);
    const parts = (getComputedStyle(probe).color.match(/[\d.]+/g) || []).map(Number);
    const [r = 0, g = 0, b = 0, a] = parts;
    const hex = `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    return a !== undefined && a < 1 ? `${hex} · ${Math.round(a * 100)}%` : hex;
  }

  const readToken = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  PV.formatToken = (name) => {
    const value = readToken(name);
    return isColor(value) ? toHex(value) : value.replace(/\s+/g, ' ');
  };
  PV.isColorToken = (name) => isColor(readToken(name));

  /** Every custom property on :root whose name starts with one of the prefixes, sorted. */
  PV.tokenNames = (prefixes) => {
    const styles = getComputedStyle(root);
    const names = new Set();
    for (let i = 0; i < styles.length; i += 1) {
      const name = styles[i];
      if (name.startsWith('--') && prefixes.some((p) => name === p || name.startsWith(p))) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  };

  /** Refresh every [data-token-value] and swatch in scope (after a theme or token change). */
  PV.refreshTokens = (scope = document) => {
    scope.querySelectorAll('[data-token-value]').forEach((node) => { node.textContent = PV.formatToken(node.dataset.tokenValue); });
  };

  /* Helpers handed to page renderers ----------------------------------------------------- */
  function helpers(mounts) {
    const h = {
      ic,
      el,
      onMount: (fn) => mounts.push(fn),

      section(title, intro, children = []) {
        return el('section', { className: 'pv-section' }, [
          el('h2', { className: 'pv-h2', text: title }),
          intro ? el('p', { className: 'pv-lead', text: intro }) : null,
          ...[].concat(children),
        ]);
      },

      row: (...children) => el('div', { className: 'pv-row' }, children.flat()),
      stack: (...children) => el('div', { className: 'pv-stack' }, children.flat()),
      label: (text) => el('span', { className: 'pv-label', text }),
      p: (text, className = 'pv-lead') => el('p', { className, text }),
      list: (items) => el('ul', { className: 'pv-list' }, items.map((t) => el('li', { text: t }))),

      /**
       * A live example in a bordered canvas with a "Code" toggle.
       * The HTML snippet is captured from the nodes before they are mounted (icons stay as <i data-icon>).
       * options.code adds a JS usage snippet; options.html: false hides the HTML one.
       */
      example(title, nodes, { code, html = true, note, canvasClass = '', lang = 'HTML' } = {}) {
        const list = [].concat(nodes).filter(Boolean);
        const snippet = html ? PV.snippet(list) : '';
        const canvas = el('div', { className: `pv-example__canvas ${canvasClass}`.trim() }, list);
        const panelHost = el('div', { className: 'pv-example__code', attrs: { hidden: true, id: `pv-code-${Math.random().toString(36).slice(2, 8)}` } });
        const toggle = el('button', {
          className: 'btn btn--ghost btn--sm',
          attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': panelHost.id },
        }, [ic('code'), 'Code']);
        toggle.addEventListener('click', () => {
          const open = toggle.getAttribute('aria-expanded') !== 'true';
          if (open && !panelHost.childElementCount) {
            if (code) panelHost.appendChild(Portal.codePanel('JavaScript', code));
            if (snippet) panelHost.appendChild(Portal.codePanel(lang, snippet));
          }
          toggle.setAttribute('aria-expanded', String(open));
          panelHost.hidden = !open;
        });
        return el('div', { className: 'pv-example' }, [
          el('div', { className: 'pv-example__head' }, [
            el('h3', { className: 'pv-example__title', text: title }),
            (snippet || code) ? toggle : null,
          ]),
          note ? el('p', { className: 'pv-example__note', text: note }) : null,
          canvas,
          panelHost,
        ]);
      },

      /**
       * States grid, rendered statically (inert: no hover, no focus, no clicks).
       * columns: ['Default', 'Hover', …]; rows: [{ label, cells: [node, …] }]
       */
      states(columns, rows, { title = 'States', note } = {}) {
        const grid = el('div', { className: 'pv-states', attrs: { role: 'table', 'aria-label': title, inert: '' } });
        grid.style.setProperty('--pv-cols', String(columns.length));
        grid.appendChild(el('div', { className: 'pv-states__row pv-states__row--head', attrs: { role: 'row' } }, [
          el('span', { className: 'pv-states__corner', attrs: { role: 'columnheader' } }),
          ...columns.map((c) => el('span', { className: 'pv-states__col', text: c, attrs: { role: 'columnheader' } })),
        ]));
        rows.forEach((row) => {
          grid.appendChild(el('div', { className: 'pv-states__row', attrs: { role: 'row' } }, [
            el('span', { className: 'pv-states__rowhead', text: row.label || '', attrs: { role: 'rowheader' } }),
            ...row.cells.map((cell) => el('div', { className: 'pv-states__cell', attrs: { role: 'cell' } }, [].concat(cell).filter(Boolean))),
          ]));
        });
        const wrap = el('div', { className: 'pv-states-wrap', attrs: { tabindex: '0', 'aria-label': `${title}, scrollable` } }, [grid]);
        return el('div', { className: 'pv-example' }, [
          el('div', { className: 'pv-example__head' }, [el('h3', { className: 'pv-example__title', text: title })]),
          note ? el('p', { className: 'pv-example__note', text: note }) : null,
          wrap,
        ]);
      },

      /** Table of tokens (by prefix) with live computed values. */
      tokens(prefixes, { title = 'Tokens', intro } = {}) {
        const names = PV.tokenNames(prefixes);
        if (!names.length) return null;
        const rows = names.map((name) => {
          const color = PV.isColorToken(name);
          const swatch = color ? el('span', { className: 'pv-token__swatch', attrs: { 'aria-hidden': 'true' } }) : null;
          if (swatch) swatch.style.setProperty('--pv-chip', `var(${name})`);
          return el('li', { className: 'pv-token' }, [
            el('span', { className: 'pv-token__name' }, [Portal.copyable(name, { label: 'Copy token' })]),
            el('span', { className: 'pv-token__value' }, [swatch, el('span', { className: 'u-mono', dataset: { tokenValue: name } })]),
          ]);
        });
        return h.section(title, intro || `${names.length} tokens. Values are computed live from the current theme and any token change you try.`, [
          el('ul', { className: 'pv-tokens card' }, rows),
        ]);
      },

      /** "Try a token change" panel: writes overrides on <html>, every component bound to the token follows. */
      tune() {
        const swatches = [['Orange', ''], ['Blue', 'var(--color-blue-500)'], ['Pink', 'var(--color-pink-500)'], ['Green', 'var(--color-green-500)']];
        const currentAccent = root.style.getPropertyValue('--accent-solid').trim();
        const accent = el('span', { className: 'pv-swatches', attrs: { role: 'radiogroup', 'aria-label': 'Accent colour' } }, swatches.map(([name, value]) => {
          const swatch = el('button', { className: `pv-swatch pv-swatch--${name.toLowerCase()}`, attrs: { type: 'button', role: 'radio', 'aria-checked': String(value === currentAccent), 'aria-label': name } });
          swatch.addEventListener('click', () => {
            accent.querySelectorAll('[role="radio"]').forEach((s) => s.setAttribute('aria-checked', String(s === swatch)));
            if (value) root.style.setProperty('--accent-solid', value); else root.style.removeProperty('--accent-solid');
          });
          return swatch;
        }));
        const range = (label, token, min, max, fallback) => {
          const current = parseInt(root.style.getPropertyValue(token), 10) || fallback;
          const out = el('output', { className: 't-meta', text: `${current}px` });
          const input = el('input', { className: 'pv-range', attrs: { type: 'range', min, max, value: current, 'aria-label': label } });
          input.addEventListener('input', () => { root.style.setProperty(token, `${input.value}px`); out.textContent = `${input.value}px`; });
          input.dataset.fallback = String(fallback);
          input.dataset.token = token;
          return { node: el('label', { className: 'field' }, [el('span', { className: 'field__label' }, [`${label} · `, el('code', { className: 'u-mono', text: token.slice(2).replace('-', '.') }), ' ', out]), input]), input, out };
        };
        const radius = range('Control radius', '--control-radius', 0, 18, 8);
        const height = range('Button height', '--button-height', 24, 44, 32);
        const reset = el('button', { className: 'btn btn--sm btn--ghost', text: 'Reset', attrs: { type: 'button' } });
        reset.addEventListener('click', () => {
          ['--accent-solid', '--control-radius', '--button-height'].forEach((t) => root.style.removeProperty(t));
          [radius, height].forEach(({ input, out }) => { input.value = input.dataset.fallback; out.textContent = `${input.dataset.fallback}px`; });
          accent.querySelectorAll('[role="radio"]').forEach((s, i) => s.setAttribute('aria-checked', String(i === 0)));
        });
        const preview = el('div', { className: 'pv-row' }, [
          el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [ic('plus'), 'Create payment']),
          el('button', { className: 'btn', text: 'Export', attrs: { type: 'button' } }),
          el('input', { className: 'input pv-tune__input', attrs: { placeholder: 'Input follows the radius', 'aria-label': 'Example input' } }),
          el('button', { className: 'switch', attrs: { type: 'button', role: 'switch', 'aria-checked': 'true', 'aria-label': 'Example switch', 'data-switch': '' } }),
          el('div', { className: 'progress pv-grow' }, [el('div', { className: 'progress__fill', attrs: { 'data-progress': '66' } })]),
        ]);
        return el('section', { className: 'card pv-tune', attrs: { 'aria-label': 'Try a token change' } }, [
          el('div', { className: 'card__head' }, [el('h2', { className: 'card__title', text: 'Try a token change' }), reset]),
          el('div', { className: 'card__body pv-tune__body' }, [
            el('p', { className: 'pv-lead', text: 'Overrides are written on <html> for this page only. Every component bound to the token follows, and the token tables update.' }),
            el('div', { className: 'pv-tune__grid' }, [
              el('div', { className: 'field' }, [el('span', { className: 'field__label' }, ['Accent · ', el('code', { className: 'u-mono', text: 'accent.solid' })]), accent]),
              radius.node,
              height.node,
            ]),
            preview,
          ]),
        ]);
      },
    };
    return h;
  }
  PV.helpers = helpers;

  /* Small shared builders for pages ------------------------------------------------------- */
  PV.button = (label, { variant, size, icon, iconOnly, cls = [], attrs = {} } = {}) => el('button', {
    className: ['btn', variant && `btn--${variant}`, size && `btn--${size}`, iconOnly && 'btn--icon', ...[].concat(cls)].filter(Boolean).join(' '),
    attrs: { type: 'button', ...(iconOnly ? { 'aria-label': label } : {}), ...attrs },
  }, [icon && ic(icon), !iconOnly && label].filter(Boolean));

  PV.field = (label, control, { help, error, id } = {}) => {
    if (id && control.tagName !== 'DIV') control.id = id;
    const errorId = id ? `${id}-error` : undefined;
    if (error && control.tagName !== 'DIV') { control.setAttribute('aria-invalid', 'true'); control.setAttribute('aria-describedby', errorId); }
    return el('div', { className: 'field' }, [
      el('label', { className: 'field__label', text: label, attrs: { for: id } }),
      control,
      help ? el('p', { className: 'field__help', text: help }) : null,
      error ? el('p', { className: 'field__error', text: error, attrs: { id: errorId } }) : null,
    ]);
  };

  PV.sampleKv = () => el('dl', { className: 'kv' }, [['Request ID', Portal.copyable('req_8f3a91c2e7')], ['Route', 'Crossmint'], ['Amount', '25.00 USD'], ['Created', 'Nov 27, 10:42 UTC']]
    .flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, [v])]));
})();
