/* ============================================================
   WAFFLE HOUSE V11.1.22 — LEGACY CLEANUP PHASE 2
   ONE RESPONSIVE NAVIGATION SYSTEM
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.22';

  function isMobile() {
    return !!window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function removeGeneratedMobileNav() {
    document.querySelectorAll('#v1118MobileNav, nav.v1118-mobile-nav').forEach(nav => {
      if (nav.classList.contains('app-tabs')) return;
      nav.remove();
    });
  }

  function renameOrganiser(nav) {
    if (!nav) return;

    nav.querySelectorAll('a[href$="reminders.html"] .nav-label, a[href$="reminders.html"] small')
      .forEach(label => { label.textContent = 'Organiser'; });

    nav.querySelectorAll('a[href$="reminders.html"]').forEach(link => {
      const aria = String(link.getAttribute('aria-label') || '');
      const title = String(link.getAttribute('title') || '');
      if (/reminder/i.test(aria)) link.setAttribute('aria-label', aria.replace(/reminders?/ig, 'Organiser'));
      if (/reminder/i.test(title)) link.setAttribute('title', title.replace(/reminders?/ig, 'Organiser'));
    });
  }

  function canonicalNav() {
    return document.querySelector('.app-tabs');
  }

  function prepareQuickAdd(nav) {
    if (!nav || !isMobile()) return;

    try {
      if (typeof window.v1088DockQuickAddButton === 'function') {
        window.v1088DockQuickAddButton();
      } else if (typeof v1088DockQuickAddButton === 'function') {
        v1088DockQuickAddButton();
      }
    } catch (_) {}

    const button = document.getElementById('v10QuickAddButton');
    if (!button) return;

    const organiser = nav.querySelector('[data-page-link="reminders"], a[href$="reminders.html"]');
    if (button.parentElement !== nav) nav.insertBefore(button, organiser || null);

    button.classList.add('v1088-nav-quick-add', 'v11122-nav-add');
    button.setAttribute('data-v1118-open-quick-add', '');
    button.setAttribute('aria-label', 'Add booking, potential stay, Meet and Greet or reminder');
    nav.classList.add('v1088-has-quick-add');
  }

  function restoreDesktopQuickAdd(nav) {
    if (!nav || isMobile()) return;

    try {
      if (typeof window.v1088DockQuickAddButton === 'function') {
        window.v1088DockQuickAddButton();
      } else if (typeof v1088DockQuickAddButton === 'function') {
        v1088DockQuickAddButton();
      }
    } catch (_) {}

    nav.classList.remove('v1088-has-quick-add');
  }

  function markActive(nav) {
    if (!nav) return;
    const page = pageName();
    nav.querySelectorAll('[data-page-link]').forEach(link => {
      const active = String(link.dataset.pageLink || '') === page;
      link.classList.toggle('is-active', active);
    });
  }

  function prepareCanonicalNav() {
    const nav = canonicalNav();
    if (!nav) return;

    nav.classList.add('v11122-unified-nav');
    nav.setAttribute('aria-label', 'Waffle House navigation');

    renameOrganiser(nav);
    markActive(nav);

    if (isMobile()) prepareQuickAdd(nav);
    else restoreDesktopQuickAdd(nav);
  }

  function apply() {
    /* V11.1.8 historically generated a second five-button mobile footer.
       Remove that duplicate and promote the original .app-tabs navigation as
       the one canonical navigation surface at every viewport width. */
    removeGeneratedMobileNav();
    prepareCanonicalNav();
    removeGeneratedMobileNav();
  }

  function start() {
    apply();

    /* Bounded startup passes cover the older quick-add/nav startup order.
       No MutationObserver or open-ended polling is used. */
    [40, 120, 300, 700, 1400, 2400].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('orientationchange', () => setTimeout(apply, 80));
    window.addEventListener('resize', () => setTimeout(apply, 60));

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => setTimeout(apply, 40));
    }

    window.v11122CleanupVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
