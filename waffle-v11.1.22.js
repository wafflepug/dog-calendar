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

/* Phase 3 naming/intake compatibility, final branding and V11.1.28 visual
   refinements remain in place. V11.1.29 is intentionally retired because its
   profile router continued to conflict with the original Care handlers.
   V11.1.30 restores native Calendar stacking and the pre-reorder Profile nav. */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function loadV11130Recovery() {
    if (!document.querySelector('link[data-waffle-v11130-recovery]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'waffle-v11.1.30.css?v=11.1.30';
      stylesheet.setAttribute('data-waffle-v11130-recovery', 'css');
      document.head.appendChild(stylesheet);
    }

    if (!document.querySelector('script[data-waffle-v11130-recovery]')) {
      const script = document.createElement('script');
      script.src = 'waffle-v11.1.30.js?v=11.1.30';
      script.async = false;
      script.setAttribute('data-waffle-v11130-recovery', 'js');
      document.body.appendChild(script);
    }
  }

  function loadV11128Refinement() {
    if (!document.querySelector('link[data-waffle-v11128-ui]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'waffle-v11.1.28.css?v=11.1.30';
      stylesheet.setAttribute('data-waffle-v11128-ui', 'css');
      document.head.appendChild(stylesheet);
    }

    const existing = document.querySelector('script[data-waffle-v11128-ui]');
    if (existing) {
      existing.addEventListener('load', loadV11130Recovery, { once: true });
      setTimeout(loadV11130Recovery, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.28.js?v=11.1.30';
    script.async = false;
    script.setAttribute('data-waffle-v11128-ui', 'js');
    script.addEventListener('load', loadV11130Recovery, { once: true });
    script.addEventListener('error', loadV11130Recovery, { once: true });
    document.body.appendChild(script);
  }

  function loadInlineBrand() {
    const existing = document.querySelector('script[data-waffle-v11127-brand]');
    if (existing) {
      existing.addEventListener('load', loadV11128Refinement, { once: true });
      setTimeout(loadV11128Refinement, 80);
      return;
    }

    const brand = document.createElement('script');
    brand.src = 'waffle-v11.1.27-brand.js?v=11.1.30';
    brand.async = false;
    brand.setAttribute('data-waffle-v11127-brand', 'js');
    brand.addEventListener('load', loadV11128Refinement, { once: true });
    brand.addEventListener('error', loadV11128Refinement, { once: true });
    document.body.appendChild(brand);
  }

  function loadV11123Cleanup() {
    const existing = document.querySelector('script[data-waffle-v11123-cleanup]');
    if (existing) {
      loadInlineBrand();
      return;
    }

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.23.js?v=11.1.30';
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
