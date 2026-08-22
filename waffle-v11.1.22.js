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

  function canonicalQuickAddButton() {
    let button = document.getElementById('v10QuickAddButton');
    if (!button) return null;

    if (button.dataset.v11122CanonicalAdd !== 'true') {
      const replacement = button.cloneNode(true);
      replacement.dataset.v11122CanonicalAdd = 'true';
      replacement.setAttribute('data-v1118-open-quick-add', '');
      button.replaceWith(replacement);
      button = replacement;
    }

    return button;
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

    const button = canonicalQuickAddButton();
    if (!button) return;

    const organiser = nav.querySelector('[data-page-link="reminders"], a[href$="reminders.html"]');
    if (button.parentElement !== nav) nav.insertBefore(button, organiser || null);

    button.classList.add('v1088-nav-quick-add', 'v11122-nav-add');
    button.setAttribute('aria-label', 'Add booking, potential stay, Meet and Greet or Organiser item');
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
    removeGeneratedMobileNav();
    prepareCanonicalNav();
    removeGeneratedMobileNav();
  }

  function start() {
    apply();
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

/* Phase 3 continues the cleanup chain. The inline branding patch loads only
   after Phase 3 so it is the final authority for the header logo. */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function loadInlineBrand() {
    if (document.querySelector('script[data-waffle-v11127-brand]')) return;
    const brand = document.createElement('script');
    brand.src = 'waffle-v11.1.27-brand.js?v=11.1.27';
    brand.async = false;
    brand.setAttribute('data-waffle-v11127-brand', 'js');
    document.body.appendChild(brand);
  }

  function loadV11123Cleanup() {
    if (document.querySelector('script[data-waffle-v11123-cleanup]')) {
      loadInlineBrand();
      return;
    }

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.23.js?v=11.1.27';
    script.async = false;
    script.setAttribute('data-waffle-v11123-cleanup', 'js');
    script.addEventListener('load', loadInlineBrand, { once: true });
    script.addEventListener('error', loadInlineBrand, { once: true });
    document.body.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadV11123Cleanup, { once: true });
  } else {
    loadV11123Cleanup();
  }
})();
