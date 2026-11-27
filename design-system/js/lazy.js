/*
 * Lazy sections for dashboard pages.
 *
 *   Portal.lazy.register('chart', { fetch: () => Promise<data>, render: (data, el) => void })
 *   <section data-lazy="chart" aria-busy="true"> <div data-skeleton>…</div> <div data-lazy-content>…</div> </section>
 *
 * A section fetches only when it nears the viewport (sections below the fold wait until scrolled to).
 * While busy, its skeleton shows. On success the content fades in and render() runs (after it is visible,
 * so charts can measure). On failure an inline retry replaces the skeleton.
 * Portal.lazy.reload(name) re-runs a section, e.g. after a filter change.
 */
(function () {
  'use strict';

  const Portal = window.Portal;
  const sections = new Map(); // name → { fetch, render }
  const loaded = new WeakSet();

  function setBusy(el, busy) {
    el.setAttribute('aria-busy', String(busy));
    el.classList.toggle('is-revealed', !busy);
  }

  function showError(el, name) {
    el.querySelector('.lazy-error')?.remove();
    const box = document.createElement('div');
    box.className = 'lazy-error';
    box.setAttribute('role', 'alert');
    const text = document.createElement('span');
    text.textContent = "This section didn't load.";
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn--sm';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => { box.remove(); load(el, name); });
    box.append(text, retry);
    el.querySelector('[data-skeleton]')?.after(box);
    el.setAttribute('aria-busy', 'false');
    el.querySelector('[data-skeleton]')?.setAttribute('hidden', '');
  }

  async function load(el, name = el.dataset.lazy) {
    const section = sections.get(name);
    if (!section) return;
    el.querySelector('[data-skeleton]')?.removeAttribute('hidden');
    el.querySelector('[data-lazy-content]')?.removeAttribute('hidden');
    setBusy(el, true);
    try {
      const data = await section.fetch();
      setBusy(el, false);
      section.render(data, el);
      loaded.add(el);
    } catch (error) {
      el.querySelector('[data-lazy-content]')?.setAttribute('hidden', '');
      showError(el, name);
    }
  }

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        load(entry.target);
      });
    }, { rootMargin: '120px 0px' })
    : null;

  Portal.lazy = {
    register(name, { fetch, render }) {
      sections.set(name, { fetch, render });
      document.querySelectorAll(`[data-lazy="${name}"]`).forEach((el) => {
        if (observer) observer.observe(el);
        else load(el);
      });
    },
    /** Re-fetch a section that has already loaded; untouched ones load when scrolled to. */
    reload(name) {
      document.querySelectorAll(`[data-lazy="${name}"]`).forEach((el) => { if (loaded.has(el)) load(el, name); });
    },
  };
})();
