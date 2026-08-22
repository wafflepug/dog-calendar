/* ============================================================
   WAFFLE HOUSE V11.1.17 — MOBILE NAV + CAPACITY MODAL FIT
   ============================================================ */

(function () {
  'use strict';

  function isMobile() {
    return !!window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  function isFoldNarrow() {
    return !!window.matchMedia && window.matchMedia('(max-width: 480px)').matches;
  }

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function pinMobileNav() {
    if (!isMobile()) return;

    const nav = document.getElementById('v1118MobileNav') || document.querySelector('.v1118-mobile-nav');
    if (!nav) return;

    /* Keep the fixed bar outside any page/container layout context. */
    if (nav.parentElement !== document.body) document.body.appendChild(nav);
    nav.classList.add('v11117-mobile-nav-fixed');

    /* The Reminder page is now Organiser. Keep the mobile footer label aligned
       with the current primary navigation naming. */
    const organiserLabel = nav.querySelector('a[href$="reminders.html"] small');
    if (organiserLabel) organiserLabel.textContent = 'Organiser';

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

  function hideLegacyMobileMeetGreetBanner() {
    if (!isMobile() || pageName() !== 'calendar') return;

    const hide = element => {
      if (!element) return;
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
      element.style.setProperty('display', 'none', 'important');
    };

    document.querySelectorAll('.meet-greet-dashboard, [data-mobile-dashboard-section="meet"]').forEach(hide);

    /* Fallback for any clone/re-render that loses the original class names. */
    document.querySelectorAll('h1,h2,h3,h4,strong').forEach(heading => {
      const text = String(heading.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (text !== "🤝 today's meet & greets" && text !== "today's meet & greets" && text !== '🤝 today’s meet & greets' && text !== 'today’s meet & greets') return;
      hide(heading.closest('[data-mobile-dashboard-section="meet"], .meet-greet-dashboard, article, section'));
    });
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
    pinMobileNav();
    fitSummaryModal();
    hideLegacyMobileMeetGreetBanner();
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

/* V11.1.18 centered mobile modal follow-up + V11.1.19 mobile Calendar cleanup
   + V11.1.20 modern visual system. Load from the final mobile patch layer so
   the recovery service worker and main Firebase loader stay untouched. */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

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

    if (!document.querySelector('script[data-waffle-v11118]')) {
      const script = document.createElement('script');
      script.src = 'waffle-v11.1.18.js?v=11.1.18';
      script.async = false;
      script.setAttribute('data-waffle-v11118', 'js');
      document.body.appendChild(script);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadV11118Assets, { once: true });
  } else {
    loadV11118Assets();
  }
})();
