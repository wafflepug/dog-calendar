/* ============================================================
   WAFFLE HOUSE V11.1.17 — MOBILE NAV + CAPACITY MODAL FIT
   ============================================================ */

(function () {
  'use strict';

  function pinMobileNav() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 768px)').matches) return;

    const nav = document.getElementById('v1118MobileNav') || document.querySelector('.v1118-mobile-nav');
    if (!nav) return;

    /* Keep the fixed bar outside any page/container layout context. */
    if (nav.parentElement !== document.body) document.body.appendChild(nav);
    nav.classList.add('v11117-mobile-nav-fixed');

    /* Inline important values protect the first mobile paint from older page
       rules that can briefly win before the final stylesheet settles. */
    nav.style.setProperty('position', 'fixed', 'important');
    nav.style.setProperty('top', 'auto', 'important');
    nav.style.setProperty('bottom', 'calc(7px + env(safe-area-inset-bottom))', 'important');
    nav.style.setProperty('left', 'max(6px, env(safe-area-inset-left))', 'important');
    nav.style.setProperty('right', 'max(6px, env(safe-area-inset-right))', 'important');
    nav.style.setProperty('width', 'auto', 'important');
    nav.style.setProperty('margin', '0', 'important');
    nav.style.setProperty('transform', 'none', 'important');
    nav.style.setProperty('z-index', '2147482000', 'important');
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

  function apply() {
    pinMobileNav();
    fitSummaryModal();
  }

  function start() {
    apply();

    /* Bounded passes cover the mobile nav created by the earlier operations
       layer and the summary modal created on first Capacity/Arriving/Leaving
       interaction. No MutationObserver or polling loop is introduced. */
    [40, 120, 300, 700, 1400, 2400].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('orientationchange', () => setTimeout(apply, 80));

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
