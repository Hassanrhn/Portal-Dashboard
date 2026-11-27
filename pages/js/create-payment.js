/*
 * Create payment drawer (opened by any [data-create-payment] button).
 * Steps: details → review → created (request ID + hosted payment link).
 * Money is validated and kept as a decimal string, as the Portal API expects.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const { el, btn, iconEl } = Portal;

  const OFFERINGS = [
    { id: 'CROSSMINT.PAYMENT_API.START_PAYMENT.PAYIN', label: 'Card payment', provider: 'Crossmint', method: 'FIAT_CARD', currencies: ['USD', 'AED'], min: '1.00', next: 'Customer pays by card on a hosted page' },
    { id: 'FORUMPAY.PAYMENT_API.START_PAYMENT.PAYIN', label: 'Crypto payment', provider: 'ForumPay', method: 'CRYPTO', currencies: ['USDT', 'USDC'], min: '5.00', next: 'Customer sends crypto to a one-time address' },
    { id: 'BLOCKCHAIN_RAIL.PAYMENT_API.TRANSFER.PAYIN', label: 'Stablecoin transfer', provider: 'Blockchain rail', method: 'CRYPTO', currencies: ['USDC', 'USDT'], min: '10.00', next: 'Customer transfers stablecoins on-chain' },
  ];
  const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;
  const REFERENCE = /^[A-Za-z0-9_-]{1,64}$/;
  const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

  function field(id, labelText, control, help) {
    return el('div', { className: 'field' }, [
      el('label', { className: 'field__label', text: labelText, attrs: { for: id } }),
      control,
      help && el('p', { className: 'field__help', text: help }),
    ]);
  }

  function open() {
    const values = { offering: OFFERINGS[0].id, amount: '', currency: 'USD', reference: '', email: '', description: '' };
    const drawer = Portal.drawer.open({ title: 'Create payment', subtitle: 'Request a pay-in through one offering.' });
    const isTest = () => document.documentElement.dataset.env === 'test';
    const offering = () => OFFERINGS.find((o) => o.id === values.offering);

    function detailsStep() {
      const offeringCards = el('div', { className: 'radio-cards', attrs: { role: 'radiogroup', 'aria-label': 'Offering' } }, OFFERINGS.map((o) => el('label', { className: 'radio-card' }, [
        el('input', { attrs: { type: 'radio', name: 'offering', value: o.id, checked: o.id === values.offering } }),
        el('span', { className: 'radio-card__body' }, [
          el('span', { className: 'radio-card__title', text: `${o.label} · ${o.provider}` }),
          el('span', { className: 'radio-card__desc', text: `${o.next}. ${o.currencies.join(', ')}, minimum ${o.min}.` }),
          el('span', { className: 'chip chip--mono', text: o.id }),
        ]),
        el('span', { className: 'radio-card__dot', attrs: { 'aria-hidden': 'true' } }),
      ])));
      const currency = el('select', { className: 'select select--block', attrs: { id: 'cp-currency', name: 'currency' } });
      const fillCurrencies = () => {
        currency.replaceChildren(...offering().currencies.map((c) => el('option', { text: c, attrs: { value: c, selected: c === values.currency } })));
        values.currency = currency.value;
      };
      fillCurrencies();
      offeringCards.addEventListener('change', (event) => { values.offering = event.target.value; fillCurrencies(); });

      const amount = el('input', { className: 'input u-num', attrs: { id: 'cp-amount', name: 'amount', inputmode: 'decimal', placeholder: '25.00', autocomplete: 'off', maxlength: '12', value: values.amount } });
      const reference = el('input', { className: 'input', attrs: { id: 'cp-reference', name: 'reference', placeholder: 'ORD-10493', maxlength: '64', autocomplete: 'off', value: values.reference } });
      const email = el('input', { className: 'input', attrs: { id: 'cp-email', name: 'email', type: 'email', placeholder: 'customer@example.com', maxlength: '254', autocomplete: 'off', value: values.email } });
      const description = el('textarea', { className: 'input textarea', attrs: { id: 'cp-description', name: 'description', maxlength: '140', placeholder: 'Shown to the customer on the payment page' } });
      description.value = values.description;

      drawer.setBody([
        isTest() ? null : el('div', { className: 'note' }, [iconEl('info'), el('span', { text: 'You are in Live mode. This creates a real payment request. Switch to Test in the sidebar to try it safely.' })]),
        el('div', { className: 'drawer__section' }, [el('p', { className: 'drawer__section-title', text: 'Offering' }), offeringCards]),
        el('div', { className: 'form-grid form-grid--2' }, [
          field('cp-amount', 'Amount', amount),
          field('cp-currency', 'Currency', currency),
          el('div', { className: 'span-2' }, [field('cp-reference', 'Your reference', reference, 'Your order or invoice number. Letters, numbers, - and _ only.')]),
          el('div', { className: 'span-2' }, [field('cp-email', 'Customer email (optional)', email)]),
          el('div', { className: 'span-2' }, [field('cp-description', 'Description (optional)', description)]),
        ]),
      ]);

      const next = btn('Review', { variant: 'primary', onClick: () => {
        Object.assign(values, { amount: amount.value.trim(), currency: currency.value, reference: reference.value.trim(), email: email.value.trim(), description: description.value.trim() });
        const okAmount = Portal.fieldError(amount, !AMOUNT.test(values.amount) ? 'Enter an amount like 25.00.' : Number(values.amount) < Number(offering().min) ? `The minimum for this offering is ${offering().min} ${values.currency}.` : '');
        const okRef = Portal.fieldError(reference, REFERENCE.test(values.reference) ? '' : 'Enter a reference using letters, numbers, - or _.');
        const okEmail = Portal.fieldError(email, !values.email || EMAIL.test(values.email) ? '' : 'Enter a valid email address or leave it empty.');
        if (okAmount && okRef && okEmail) reviewStep();
        else drawer.body.querySelector('[aria-invalid="true"]')?.focus();
      } });
      drawer.setFooter([btn('Cancel', { attrs: { 'data-dialog-close': '' } }), next]);
      amount.focus();
    }

    function reviewStep() {
      const o = offering();
      const amountText = `${Portal.fmt.money(values.amount)} ${values.currency}`;
      drawer.setBody([
        el('div', { className: 'amount-hero' }, [el('span', { className: 'amount-hero__value', text: Portal.fmt.money(values.amount) }), el('span', { className: 'amount-hero__currency', text: values.currency })]),
        el('dl', { className: 'kv' }, [
          ['Offering', o.id], ['Provider', o.provider], ['Method', o.method], ['Reference', values.reference],
          ['Customer', values.email || 'Not provided'], ['Environment', isTest() ? 'Test' : 'Live'], ['Next step', o.next],
        ].flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])),
        el('p', { className: 't-meta', text: 'The payment starts as Pending. You will get a payment.status_updated webhook when it changes.' }),
      ]);
      const create = btn(`Create ${amountText}`, { variant: 'primary', onClick: async () => {
        create.setAttribute('aria-busy', 'true');
        await Portal.request(null, { delay: 700 });
        createdStep();
      } });
      drawer.setFooter([btn('Back', { onClick: detailsStep }), create]);
      create.focus();
    }

    function createdStep() {
      const requestId = `req_${Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
      const linkUrl = `https://pay.the-block.com/p/${requestId}`;
      drawer.setTitle('Payment created');
      drawer.setBody([
        el('div', { className: 'note note--success' }, [iconEl('check-circle'), el('span', { text: `Payment request created${isTest() ? ' in Test mode' : ''}. Share the link with your customer.` })]),
        el('dl', { className: 'kv' }, [
          el('dt', { text: 'Request ID' }), el('dd', {}, [Portal.copyable(requestId)]),
          el('dt', { text: 'Status' }), el('dd', {}, [Portal.badge('pending')]),
          el('dt', { text: 'Amount' }), el('dd', { text: `${Portal.fmt.money(values.amount)} ${values.currency}` }),
          el('dt', { text: 'Reference' }), el('dd', { text: values.reference }),
          el('dt', { text: 'Payment link' }), el('dd', {}, [Portal.copyable(linkUrl, { label: 'Copy payment link' })]),
        ]),
      ]);
      drawer.setFooter([
        el('a', { className: 'btn', attrs: { href: 'transactions.html' } }, ['View transactions']),
        btn('Done', { variant: 'primary', attrs: { 'data-dialog-close': '' } }),
      ]);
      Portal.toast('Payment created');
    }

    detailsStep();
  }

  Portal.createPayment = open;
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-create-payment]')) open();
  });
})();
