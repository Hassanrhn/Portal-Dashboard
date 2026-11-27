/* Design system docs: Foundations pages (colours, type, spacing and radius, motion, icons, brand). */
(function () {
  'use strict';

  const { PV, Portal } = window;
  const { el } = Portal;
  const { ic } = PV;

  /* Colours ------------------------------------------------------------------------------ */
  const COLOUR_GROUPS = [
    ['Backgrounds', '--bg-', 'Page, sidebar, surfaces and overlays. Surfaces step in brightness instead of casting shadows.'],
    ['Borders', '--border-', 'Hairlines that separate surfaces.'],
    ['Text', '--text-', 'Primary for content, secondary for labels, tertiary for hints.'],
    ['Actions', '--action-', 'Button fills. Components read these through --button-* tokens.'],
    ['Accent', '--accent-', 'The orange brand accent: switch, progress, focus ring, active nav icon.'],
    ['Status', '--status-', 'Success, warning, danger, info and neutral. Always paired with text.'],
    ['Charts', '--chart-', 'Series colours and the dashed grid.'],
    ['Code', '--code-', 'Code panel background and JSON highlighting.'],
  ];

  PV.page({
    id: 'colours', group: 'Foundations', title: 'Colours',
    desc: 'Semantic colour tokens with their live value in the current theme. Switch Light and Dark in the top bar to compare.',
    render(h) {
      const groups = COLOUR_GROUPS.map(([title, prefix, intro]) => {
        const names = PV.tokenNames([prefix]).filter((n) => PV.isColorToken(n) || n.includes('overlay'));
        return h.section(title, intro, [el('div', { className: 'pv-colors' }, names.map((name) => {
          const chip = el('span', { className: 'pv-color__chip', attrs: { 'aria-hidden': 'true' } });
          chip.style.setProperty('--pv-chip', `var(${name})`);
          return el('div', { className: 'pv-color' }, [
            chip,
            el('span', { className: 'pv-color__name', text: name.slice(2) }),
            el('span', { className: 'pv-color__value', dataset: { tokenValue: name } }),
          ]);
        }))]);
      });
      return [
        h.tune(),
        h.section('How colour tokens connect', 'Three tiers. Each tier references the one above it, so a change cascades at runtime.', [
          Portal.codePanel('Token chain', [
            'primitives.json   color.neutral.790   = #2B2B2B',
            'semantic.json     action.primary-bg   = {color.neutral.790}   (dark: #F3F3F3)',
            'components.json   button.primary-bg   = {action.primary-bg}',
            'button.css        .btn--primary { background: var(--button-primary-bg) }',
          ].join('\n')),
        ]),
        ...groups,
      ];
    },
  });

  /* Typography ------------------------------------------------------------------------------ */
  PV.page({
    id: 'typography', group: 'Foundations', title: 'Typography',
    desc: 'Inter for the interface, JetBrains Mono for identifiers and code. Sentence case everywhere; labels are never all caps.',
    tokens: ['--type-', '--font-'],
    render(h) {
      const roles = [
        ['t-title', 'Title', 'Payments overview'],
        ['t-heading', 'Heading', 'Recent payments'],
        ['t-figure', 'Figure', '299.28'],
        ['t-body', 'Body', 'Payments route through one API to Crossmint, ForumPay or a blockchain rail.'],
        ['t-label', 'Label', 'Endpoint URL'],
        ['t-meta', 'Meta', 'Updated 3 min ago'],
        ['u-mono', 'Mono', 'req_8f3a91c2e7'],
      ];
      const sizes = PV.tokenNames(['--font-size-']);
      return [
        h.section('Type roles', 'Use a role class, never a raw size.', [
          el('div', { className: 'card pv-type' }, roles.map(([cls, name, sample]) => el('div', { className: 'pv-type__row' }, [
            el('span', { className: 'pv-type__meta' }, [el('code', { className: 'u-mono', text: `.${cls}` }), el('span', { className: 't-meta', text: name })]),
            el('p', { className: cls, text: sample }),
          ]))),
        ]),
        h.example('Figure with unit', [el('p', { className: 't-figure' }, ['299.28', el('span', { className: 'kpi__unit', text: 'USD eq.' })])]),
        h.section('Size scale', 'Primitive sizes used by the roles above.', [
          el('div', { className: 'card pv-type' }, sizes.map((name) => {
            const sample = el('span', { className: 'pv-type__sample', text: 'Settle in seconds' });
            sample.style.setProperty('--pv-fs', `var(${name})`);
            return el('div', { className: 'pv-type__row' }, [
              el('span', { className: 'pv-type__meta' }, [el('code', { className: 'u-mono', text: name.slice(2) }), el('span', { className: 't-meta', dataset: { tokenValue: name } })]),
              sample,
            ]);
          })),
        ]),
      ];
    },
  });

  /* Spacing and radius -------------------------------------------------------------------------- */
  PV.page({
    id: 'spacing', group: 'Foundations', title: 'Spacing and radius',
    desc: 'A 2px-based spacing scale, fixed sizes for controls and icons, and a small set of corner radii.',
    tokens: ['--space-', '--size-', '--radius-', '--control-'],
    render(h) {
      const bars = (prefix, cls) => PV.tokenNames([prefix]).map((name) => {
        const bar = el('span', { className: cls, attrs: { 'aria-hidden': 'true' } });
        bar.style.setProperty('--pv-w', `var(${name})`);
        return el('div', { className: 'pv-scale__row' }, [el('code', { className: 'u-mono', text: name.slice(2) }), el('span', { className: 't-meta u-num', dataset: { tokenValue: name } }), bar]);
      });
      const radii = PV.tokenNames(['--radius-', '--control-radius']).map((name) => {
        const box = el('span', { className: 'pv-radius__box', attrs: { 'aria-hidden': 'true' } });
        box.style.setProperty('--pv-r', `var(${name})`);
        return el('div', { className: 'pv-radius' }, [box, el('code', { className: 'u-mono', text: name.slice(2) }), el('span', { className: 't-meta', dataset: { tokenValue: name } })]);
      });
      const heights = ['sm', 'md', 'lg', 'xl'].map((s) => el('div', { className: 'pv-radius' }, [
        PV.button(`Height ${s}`, { variant: 'primary', size: s === 'md' ? undefined : s }),
        el('code', { className: 'u-mono', text: `control.height-${s}` }),
        el('span', { className: 't-meta', dataset: { tokenValue: `--control-height-${s}` } }),
      ]));
      return [
        h.section('Spacing', 'Gaps and padding. Pages use 12px between cards, 16–24px inside them.', [el('div', { className: 'card card__body pv-scale' }, bars('--space-', 'pv-scale__bar'))]),
        h.section('Fixed sizes', 'Icons, avatars, tiles and control heights.', [el('div', { className: 'card card__body pv-scale' }, bars('--size-', 'pv-scale__bar pv-scale__bar--size'))]),
        h.section('Radius', 'Controls use control.radius (8px); cards and overlays use 10–12px.', [el('div', { className: 'pv-radii' }, radii)]),
        h.section('Control heights', 'Buttons, inputs and selects share these heights so rows line up.', [el('div', { className: 'pv-radii' }, heights)]),
      ];
    },
  });

  /* Motion ---------------------------------------------------------------------------------- */
  PV.page({
    id: 'motion', group: 'Foundations', title: 'Motion',
    desc: 'Motion answers a user action. One orchestrated moment on load (KPI count-up, chart draw). prefers-reduced-motion turns it all off.',
    tokens: ['--motion-'],
    render(h) {
      const easings = [['motion.ease', '--motion-ease'], ['motion.spring', '--motion-spring'], ['motion.sheet', '--motion-sheet']];
      const durations = [['motion.fast', '--motion-fast'], ['motion.base', '--motion-base'], ['motion.slow', '--motion-slow']];
      const track = (label, ease, duration) => {
        const dot = el('span', { className: 'pv-motion__dot', attrs: { 'aria-hidden': 'true' } });
        dot.style.setProperty('--pv-ease', `var(${ease})`);
        dot.style.setProperty('--pv-dur', `var(${duration})`);
        return el('div', { className: 'pv-motion__row' }, [el('span', { className: 'pv-motion__label' }, [el('code', { className: 'u-mono', text: label })]), el('span', { className: 'pv-motion__track' }, [dot])]);
      };
      const box = el('div', { className: 'pv-motion' }, [
        ...easings.map(([label, token]) => track(label, token, '--motion-slow')),
        ...durations.map(([label, token]) => track(label, '--motion-ease', token)),
      ]);
      const play = PV.button('Play', { variant: 'primary', icon: 'play', size: 'sm' });
      play.addEventListener('click', () => box.classList.toggle('is-moved'));
      return [
        h.section('Easing and duration', 'Press Play to move each dot with its token. Top three: easings at motion.slow. Bottom three: durations with motion.ease.', [
          el('div', { className: 'card card__body pv-stack' }, [play, box]),
        ]),
        h.section('Where motion is used', null, [h.list([
          'Segmented indicator and tab underline slide with motion.spring.',
          'Switch knob springs; the copy button pops a check.',
          'Drawers and bottom sheets enter with motion.sheet; menus fade in with motion.fast.',
          'Charts draw once on first load and morph on range changes.',
          'Theme changes cross-fade surface colours for motion.base.',
        ])]),
      ];
    },
  });

  /* Icons ---------------------------------------------------------------------------------- */
  const ICONS = ['home', 'payments', 'cards', 'reports', 'key', 'webhook', 'logs', 'docs', 'invite', 'settings', 'support', 'bell', 'more', 'search', 'sidebar', 'plus', 'chevron-down', 'chevron-left', 'chevron-right', 'chevrons-up-down', 'copy', 'check', 'check-circle', 'sun', 'moon', 'calendar', 'arrow-up', 'arrow-down', 'arrow-right', 'alert', 'menu', 'x', 'x-circle', 'eye', 'eye-off', 'refund', 'payout', 'logout', 'download', 'upload', 'filter', 'link', 'external', 'lock', 'rotate', 'trash', 'edit', 'send', 'mail', 'shield', 'user', 'building', 'globe', 'play', 'power', 'wallet', 'truck', 'file', 'clock', 'zap', 'code', 'terminal', 'info', 'snowflake', 'scale', 'visa', 'mastercard', 'google', 'github'];

  PV.page({
    id: 'icons', group: 'Foundations', title: 'Icons',
    desc: 'Outline icons adapted from Lucide (ISC), drawn as inline SVG at 16px with a 1.75 stroke. Click an icon to copy its name.',
    render(h) {
      return [
        h.example('Usage', [el('button', { className: 'btn', attrs: { type: 'button' } }, [ic('download'), 'Export'])], {
          code: "// Markup placeholder, hydrated by icons.js\n<i data-icon=\"download\"></i>\n\n// From JS\nPortal.iconEl('download');",
          note: 'Icons inherit currentColor. Inside buttons they animate in the direction of their meaning on hover.',
        }),
        h.section(`All icons (${ICONS.length})`, null, [el('div', { className: 'pv-icons' }, ICONS.map((name) => el('button', {
          className: 'pv-icon', attrs: { type: 'button', 'data-copy': name, 'data-copy-toast': `Copied icon name “${name}”`, 'aria-label': `Copy icon name ${name}` },
        }, [ic(name), el('span', { text: name })])))]),
      ];
    },
  });

  /* Brand --------------------------------------------------------------------------------- */
  PV.page({
    id: 'brand', group: 'Foundations', title: 'Brand',
    desc: 'The Orange Card wordmark (Archivo at 125% width), its compact mark for the collapsed sidebar, and the orange accent.',
    tokens: ['--accent-', '--bg-mark'],
    render(h) {
      const logo = (size) => {
        const node = el('span', { className: 'logo', attrs: { role: 'img', 'aria-label': 'The Orange Card' } }, [
          el('span', { className: 'logo__the', text: 'THE', attrs: { 'aria-hidden': 'true' } }),
          el('span', { className: 'logo__word', attrs: { 'aria-hidden': 'true' } }, [el('span', { className: 'logo__orange', text: 'ORANGE' }), el('span', { className: 'logo__card', text: 'CARD' })]),
        ]);
        if (size) node.classList.add(`pv-logo--${size}`);
        return node;
      };
      return [
        h.example('Wordmark', [logo()], { note: 'Colour follows the text colour, so it works in both themes. Size it with --logo-size.' }),
        h.example('Sizes', [h.row(logo(), logo('md'), logo('lg'))], { html: false }),
        h.example('Compact mark and brand mark', [h.row(el('span', { className: 'logo-mark', text: 'O', attrs: { 'aria-hidden': 'true' } }), el('span', { className: 'brand-mark', attrs: { 'aria-hidden': 'true' } }))]),
        h.example('Accent in use', [h.row(
          PV.button('Primary action', { variant: 'primary' }),
          el('button', { className: 'switch', attrs: { type: 'button', role: 'switch', 'aria-checked': 'true', 'aria-label': 'Accent switch', 'data-switch': '' } }),
          el('span', { className: 'workspace' }, [el('span', { className: 'workspace__avatar', text: 'TO' }), 'The Orange Card']),
        )], { html: false, note: 'The orange accent drives the primary button, switch, progress, focus ring, active nav icon and the theme knob.' }),
      ];
    },
  });
})();
