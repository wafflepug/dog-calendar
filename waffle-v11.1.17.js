/* ============================================================
   WAFFLE HOUSE V11.1.17 — MOBILE MODAL FIT + FOLDABLE HEADER
   ============================================================ */

(function () {
  'use strict';

  function isFoldNarrow() {
    return !!window.matchMedia && window.matchMedia('(max-width: 480px)').matches;
  }

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function fitSummaryModal() {
    const modal = document.getElementById('v11116CalendarSummaryModal');
    if (!modal) return;

    modal.classList.add('v11117-mobile-fit');
    const card = modal.querySelector('.v11116-calendar-summary-card');
    const list = modal.querySelector('.v11116-calendar-summary-list');
    if (card) card.classList.add('v11117-mobile-fit-card');
    if (list) list.classList.add('v11117-mobile-fit-list');
  }

  function unwrapFoldHeader(header) {
    const actions = header?.querySelector(':scope > .v11120-fold-actions');
    if (!actions) {
      header?.classList.remove('v11120-fold-header');
      return;
    }

    while (actions.firstChild) header.insertBefore(actions.firstChild, actions);
    actions.remove();
    header.classList.remove('v11120-fold-header');
  }

  function prepareFoldHeader() {
    if (pageName() !== 'calendar') return;

    const header = document.querySelector('.calendar-header-branding');
    if (!header) return;

    if (!isFoldNarrow()) {
      unwrapFoldHeader(header);
      return;
    }

    header.classList.add('v11120-fold-header');

    const brandHome = header.querySelector(':scope > .v11116-brand-home-link') || header.querySelector(':scope > .calendar-brand-img')?.parentElement;
    const brandCopy = header.querySelector(':scope > .calendar-brand-copy');

    let actions = header.querySelector(':scope > .v11120-fold-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'v11120-fold-actions';
      actions.setAttribute('aria-label', 'Calendar actions');
      header.appendChild(actions);
    }

    Array.from(header.children).forEach(child => {
      if (child === brandHome || child === brandCopy || child === actions) return;
      actions.appendChild(child);
    });

    Array.from(actions.children).forEach(control => {
      const identity = [control.id, control.className, control.textContent].join(' ').toLowerCase();
      if (/sync|refresh|updat/.test(identity)) {
        control.classList.add('v11120-fold-sync');
        if (!control.getAttribute('aria-label')) control.setAttribute('aria-label', 'Sync Spreadsheet');
        if (!control.getAttribute('title')) control.setAttribute('title', 'Sync Spreadsheet');
      }
    });
  }

  function apply() {
    fitSummaryModal();
    prepareFoldHeader();
  }

  function start() {
    apply();

    /* Bounded passes cover mobile UI inserted by earlier layers without an
       open-ended observer or polling loop. */
    [40, 120, 300, 700, 1400, 2400].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('orientationchange', () => setTimeout(apply, 80));
    window.addEventListener('resize', () => setTimeout(apply, 40));

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', apply);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

/* V11.1.18 centered mobile modal follow-up + V11.1.19 foldable layout,
   V11.1.20 modern visual system and V11.1.21+ legacy cleanup. Load from the
   final mobile patch layer so the recovery service worker and main Firebase
   loader stay untouched. */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function loadV11121Cleanup() {
    if (document.querySelector('script[data-waffle-v11121-cleanup]')) return;

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.21.js?v=11.1.21.1';
    script.async = false;
    script.setAttribute('data-waffle-v11121-cleanup', 'js');
    document.body.appendChild(script);
  }

  function loadV11118Assets() {
    if (!document.querySelector('link[data-waffle-v11118]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'waffle-v11.1.18.css?v=11.1.18';
      stylesheet.setAttribute('data-waffle-v11118', 'css');
      document.head.appendChild(stylesheet);
    }

    if (!document.querySelector('link[data-waffle-v11119]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'waffle-v11.1.19.css?v=11.1.19.1';
      stylesheet.setAttribute('data-waffle-v11119', 'css');
      document.head.appendChild(stylesheet);
    }

    if (!document.querySelector('link[data-waffle-v11120-modern]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'waffle-v11.1.20.css?v=11.1.20';
      stylesheet.setAttribute('data-waffle-v11120-modern', 'css');
      document.head.appendChild(stylesheet);
    }

    const existingV11118 = document.querySelector('script[data-waffle-v11118]');
    if (existingV11118) {
      existingV11118.addEventListener('load', loadV11121Cleanup, { once: true });
      setTimeout(loadV11121Cleanup, 350);
      return;
    }

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.18.js?v=11.1.18';
    script.async = false;
    script.setAttribute('data-waffle-v11118', 'js');
    script.addEventListener('load', loadV11121Cleanup, { once: true });
    document.body.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadV11118Assets, { once: true });
  } else {
    loadV11118Assets();
  }
})();
