/* Design system docs: Patterns pages (forms and validation, destructive actions, responsive). */
(function () {
  'use strict';

  const { PV, Portal } = window;
  const { el } = Portal;

  /* Forms and validation --------------------------------------------------------------------- */
  PV.page({
    id: 'forms', group: 'Patterns', title: 'Forms and validation',
    desc: 'Validate on blur and on submit, show the error under the field, and say how to fix it. Never clear what the user typed.',
    render(h) {
      const url = el('input', { className: 'input', attrs: { id: 'pv-f-url', type: 'url', placeholder: 'https://api.example.com/hooks', autocomplete: 'off', spellcheck: 'false' } });
      const amount = el('input', { className: 'input u-num', attrs: { id: 'pv-f-amount', type: 'text', inputmode: 'decimal', placeholder: '0.00', maxlength: '16' } });
      const currency = el('select', { className: 'select', attrs: { id: 'pv-f-currency', 'aria-label': 'Currency' } }, ['USD', 'USDC', 'USDT', 'AED'].map((c) => el('option', { text: c, attrs: { value: c } })));
      const email = el('input', { className: 'input', attrs: { id: 'pv-f-email', type: 'email', placeholder: 'finance@company.com', autocomplete: 'off' } });
      const rules = [
        [url, (v) => (!v ? 'Enter the endpoint URL.' : !/^https:\/\/[^\s/]+\.[^\s]+$/.test(v) ? 'Use an https:// URL, like https://api.example.com/hooks.' : '')],
        [amount, (v) => (!v ? 'Enter an amount.' : !/^\d{1,12}(\.\d{1,2})?$/.test(v.replace(/,/g, '')) ? 'Use numbers with up to 2 decimals, like 250.50.' : Number(v.replace(/,/g, '')) <= 0 ? 'Amount must be more than 0.' : '')],
        [email, (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Enter an email like name@company.com.' : '')],
      ];
      const check = (input) => { const rule = rules.find(([i]) => i === input); return rule ? Portal.fieldError(input, rule[1](input.value.trim())) : true; };
      rules.forEach(([input]) => {
        input.addEventListener('blur', () => { if (input.value.trim() || input.getAttribute('aria-invalid') === 'true') check(input); });
        input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') check(input); });
      });
      const submit = el('button', { className: 'btn btn--primary', text: 'Create payment link', attrs: { type: 'submit' } });
      const form = el('form', { className: 'card card__body form-grid form-grid--2', attrs: { novalidate: '' } }, [
        el('div', { className: 'field span-2' }, [el('label', { className: 'field__label', text: 'Webhook URL', attrs: { for: url.id } }), url, el('p', { className: 'field__help', text: 'Events for this link are sent here.' })]),
        el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Amount', attrs: { for: amount.id } }), el('div', { className: 'input-affix input-affix--suffix' }, [amount, el('span', { className: 'input-affix__addon', text: 'USD' })])]),
        el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Settle in', attrs: { for: currency.id } }), currency]),
        el('div', { className: 'field span-2' }, [el('label', { className: 'field__label', text: 'Receipt email (optional)', attrs: { for: email.id } }), email]),
        el('div', { className: 'span-2 pv-row' }, [submit, el('button', { className: 'btn btn--ghost', text: 'Reset', attrs: { type: 'reset' } })]),
      ]);
      form.addEventListener('reset', () => rules.forEach(([i]) => Portal.fieldError(i, '')));
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const invalid = rules.map(([i]) => (check(i) ? null : i)).filter(Boolean);
        if (invalid.length) { invalid[0].focus(); return; }
        submit.setAttribute('aria-busy', 'true');
        await Portal.request(null, { delay: 700 });
        submit.removeAttribute('aria-busy');
        Portal.toast('Payment link created');
      });
      return [
        h.example('Validated form', [form], { html: false, note: 'Submit empty to see every error, then fix them one by one: each error clears as soon as the value is valid.', code: "Portal.fieldError(input, 'Use an https:// URL.'); // sets aria-invalid and aria-describedby\nPortal.fieldError(input, '');                    // clears it" }),
        h.section('Rules', null, [h.list([
          'Labels above fields, sentence case. Optional fields say “(optional)”; required is the default.',
          'Validate on blur and on submit, never on every keystroke before the first error.',
          'Errors say what to do: “Use an https:// URL”, not “Invalid input”.',
          'On submit, focus the first invalid field. Keep what the user typed.',
          'The submit button shows aria-busy while saving; a toast confirms.',
          'Money inputs use inputmode="decimal", tabular figures and a currency suffix.',
        ])]),
      ];
    },
  });

  /* Destructive actions -------------------------------------------------------------------- */
  PV.page({
    id: 'destructive', group: 'Patterns', title: 'Destructive actions',
    desc: 'Revoke, delete and cancel live in the ⋯ overflow menu, styled as danger, and always go through a danger confirm.',
    render(h) {
      const keys = [['Production server', 'pk_live_…4f2a', 'active'], ['Staging', 'pk_test_…91bd', 'active'], ['Old integration', 'pk_live_…77c0', 'revoked']];
      const list = el('ul', { className: 'rows card' });
      const render = () => list.replaceChildren(...keys.map((key) => {
        const [name, id, status] = key;
        return el('li', { className: 'rows__item' }, [
          el('span', { className: 'rows__main' }, [el('span', { text: name }), el('span', { className: 'rows__sub u-mono', text: id })]),
          el('span', { className: 'rows__meta' }, [Portal.badge(status), Portal.menu.button([
            { label: 'Rename', icon: 'edit', onSelect: () => Portal.toast('Rename opens a dialog') },
            { label: 'Copy key ID', icon: 'copy', onSelect: () => Portal.toast(`Copied ${id}`) },
            'separator',
            { label: 'Revoke key', icon: 'trash', tone: 'danger', disabled: status === 'revoked', onSelect: async () => {
              const ok = await Portal.confirm({ title: `Revoke “${name}”?`, tone: 'danger', confirmLabel: 'Revoke key', message: 'Requests using this key fail straight away. This cannot be undone.', details: [['Key', id], ['Last used', '3 min ago']] });
              if (!ok) return;
              key[2] = 'revoked';
              render();
              Portal.toast(`${name} revoked`);
            } },
          ], `Actions for ${name}`)]),
        ]);
      }));
      render();
      return [
        h.example('Revoke an API key', [list], { html: false, code: "{ label: 'Revoke key', icon: 'trash', tone: 'danger', onSelect: async () => {\n  if (await Portal.confirm({ title: 'Revoke key?', tone: 'danger', confirmLabel: 'Revoke key', message, details })) revoke();\n} }" }),
        h.section('Rules', null, [h.list([
          'Never put a destructive action as a visible primary button in a row; use the ⋯ menu, last, after a separator.',
          'The confirm names the object and the consequence, and lists the key details.',
          'The confirm button repeats the verb (“Revoke key”), uses btn--danger, and Cancel has focus first.',
          'After the action, update the row in place and confirm with a toast.',
          'Disable the action when it no longer applies (already revoked) instead of hiding it.',
        ])]),
      ];
    },
  });

  /* Responsive --------------------------------------------------------------------------------- */
  PV.page({
    id: 'responsive', group: 'Patterns', title: 'Responsive (phone, tablet)',
    desc: 'One layout that adapts at three breakpoints. No page ever scrolls sideways at 390px.',
    render(h) {
      const readout = el('span', { className: 'badge badge--info', dataset: { pvViewport: '' } });
      const rows = [
        ['≤ 600px', 'Phone', 'Tables stack into label and value pairs; drawers, dialogs and menus become bottom sheets; toolbar search takes the full row; form grids go to one column; “Filter columns” replaces header filters.'],
        ['≤ 860px', 'Tablet', 'The sidebar becomes a drawer opened from the app bar; search collapses to an icon; two-column grids stack.'],
        ['861–1100px', 'Small desktop', 'Narrower page padding; KPI strips wrap to two columns; grid-2 stacks.'],
        ['> 1100px', 'Desktop', 'Full sidebar (collapsible to icons with tooltips), four KPIs in a row.'],
      ];
      const table = el('div', { className: 'card table-card' }, [el('div', { className: 'table-wrap' }, [el('table', { className: 'table pv-wrap-table' }, [
        el('thead', {}, [el('tr', {}, ['Width', 'Device', 'What changes'].map((t) => el('th', { text: t, attrs: { scope: 'col' } })))]),
        el('tbody', {}, rows.map((r) => el('tr', {}, r.map((c) => el('td', { text: c }))))),
      ])])]);
      const phone = el('div', { className: 'pv-device pv-device--phone', attrs: { 'aria-label': 'Phone layout sketch', role: 'img' } }, [
        el('span', { className: 'pv-device__bar' }), el('span', { className: 'pv-device__kpis' }, [el('span'), el('span')]), el('span', { className: 'pv-device__card' }), el('span', { className: 'pv-device__row' }), el('span', { className: 'pv-device__row' }), el('span', { className: 'pv-device__sheet' }),
      ]);
      const tablet = el('div', { className: 'pv-device pv-device--tablet', attrs: { 'aria-label': 'Tablet layout sketch', role: 'img' } }, [
        el('span', { className: 'pv-device__bar' }), el('span', { className: 'pv-device__kpis' }, [el('span'), el('span'), el('span'), el('span')]), el('span', { className: 'pv-device__card' }), el('span', { className: 'pv-device__row' }), el('span', { className: 'pv-device__drawer' }),
      ]);
      h.onMount(() => PV.updateViewport());
      return [
        h.section('Breakpoints', null, [h.row(el('span', { className: 't-meta', text: 'This window:' }), readout), table]),
        h.example('Layout sketches', [el('div', { className: 'pv-devices' }, [el('figure', {}, [phone, el('figcaption', { className: 't-meta', text: 'Phone: stacked rows, bottom sheet' })]), el('figure', {}, [tablet, el('figcaption', { className: 't-meta', text: 'Tablet: sidebar as a drawer' })])])], { html: false }),
        h.section('Checklist', 'Run tools/check-page.js with mobile before shipping a page.', [h.list([
          'No horizontal page scroll at 390px. Wide content (code, state grids) scrolls inside its own box.',
          'Touch targets are at least 32px; menu items grow to 44px rows on phones.',
          'Drawers can be dragged down to close; the grab handle shows on phones only.',
          'Money stays right-aligned with its currency, even when rows stack.',
          'Tab reaches every control; Esc closes drawers, dialogs and menus.',
        ])]),
      ];
    },
  });

  PV.updateViewport = () => {
    const node = document.querySelector('[data-pv-viewport]');
    if (!node) return;
    const w = window.innerWidth;
    node.textContent = `${w}px · ${w <= 600 ? 'Phone' : w <= 860 ? 'Tablet' : w <= 1100 ? 'Small desktop' : 'Desktop'}`;
  };
  window.addEventListener('resize', PV.updateViewport);
})();
