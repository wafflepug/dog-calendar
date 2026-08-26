/* ============================================================
   WAFFLE HOUSE V11.1.89 — MOBILE QUICK ACTION COMPLETION
   ------------------------------------------------------------
   - keeps Quick Action sheets/forms fully reachable on mobile;
   - lifts Quick Action modals above the fixed mobile footer;
   - makes Potential and Meet & Greet forms viewport-scrollable;
   - routes Reminder into Organiser > Sticky Notes instead of the
     retired standalone Reminder destination;
   - ensures Organiser assets exist before opening Reminder;
   - validates/labels the four canonical Quick Actions.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.89';
  const MOBILE_QUERY = '(max-width: 820px)';
  let observer = null;
  let queued = false;
  let organiserOpenAttempted = false;
  let organiserScriptRequested = false;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isMobile() {
    return !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
  }

  function ensureStyle() {
    let style = document.getElementById('wh89QuickActionMobileStyle');
    if (!style) {
      style = document.createElement('style');
      style.id = 'wh89QuickActionMobileStyle';
      document.head.appendChild(style);
    }

    style.textContent = `
      @media (max-width:820px) {
        /* Quick Action chooser must sit above the fixed mobile footer and
           remain fully reachable on short screens / Fold-style viewports. */
        #v10QuickAddSheet {
          z-index:2147483100!important;
          box-sizing:border-box!important;
          max-height:100vh!important;
          max-height:100dvh!important;
          overflow-y:auto!important;
          overscroll-behavior:contain!important;
          padding-bottom:calc(20px + env(safe-area-inset-bottom))!important;
        }

        #v10QuickAddSheet > * {
          max-height:calc(100vh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;
          max-height:calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;
          overflow-y:auto!important;
          overscroll-behavior:contain!important;
          -webkit-overflow-scrolling:touch;
        }

        /* These are the two form modals launched directly by Quick Actions. */
        #potentialStayModal,
        #customBookingModal {
          z-index:2147483200!important;
          box-sizing:border-box!important;
          align-items:flex-start!important;
          justify-content:center!important;
          overflow-y:auto!important;
          overscroll-behavior:contain!important;
          -webkit-overflow-scrolling:touch;
          padding:
            calc(10px + env(safe-area-inset-top))
            10px
            calc(92px + env(safe-area-inset-bottom))!important;
        }

        #potentialStayModal > .modal-content-panel,
        #customBookingModal > .modal-content-panel {
          width:min(100%,520px)!important;
          max-width:520px!important;
          max-height:calc(100vh - 28px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;
          max-height:calc(100dvh - 28px - env(safe-area-inset-top) - env(safe-area-inset-bottom))!important;
          margin:auto 0!important;
          padding:18px!important;
          box-sizing:border-box!important;
          overflow-y:auto!important;
          overscroll-behavior:contain!important;
          -webkit-overflow-scrolling:touch;
          border-radius:16px!important;
          scroll-padding-bottom:96px;
        }

        #potentialStayModal input,
        #potentialStayModal select,
        #potentialStayModal textarea,
        #customBookingModal input,
        #customBookingModal select,
        #customBookingModal textarea {
          max-width:100%!important;
          box-sizing:border-box!important;
        }

        /* Keep the final form actions comfortably above browser/PWA chrome. */
        #potentialStayModal .modal-content-panel > :last-child,
        #customBookingModal .modal-content-panel > :last-child {
          margin-bottom:calc(8px + env(safe-area-inset-bottom))!important;
        }

        /* Organiser Sticky Note composer is the Reminder sub-function now. */
        body[data-waffle-page="reminders"] #reminderComposer:not([hidden]) {
          scroll-margin-top:16px;
          scroll-margin-bottom:110px;
        }
      }
    `;
  }

  function ensureOrganiserAssets() {
    if (pageName() !== 'reminders') return;

    if (!document.querySelector('link[data-wh89-organiser-css]')) {
      const existingCss = Array.from(document.styleSheets || []).some(sheet =>
        String(sheet.href || '').includes('/waffle-v11.1.15.css')
      );
      if (!existingCss) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'waffle-v11.1.15.css?v=11.1.89';
        link.dataset.wh89OrganiserCss = 'true';
        document.head.appendChild(link);
      }
    }

    if (document.getElementById('v11115OrganiserRoot') || organiserScriptRequested) return;
    const existingScript = Array.from(document.scripts).find(script =>
      String(script.src || '').includes('/waffle-v11.1.15.js')
    );
    if (existingScript) {
      organiserScriptRequested = true;
      return;
    }

    organiserScriptRequested = true;
    const script = document.createElement('script');
    script.src = 'waffle-v11.1.15.js?v=11.1.89';
    script.async = false;
    script.dataset.wh89Organiser = 'true';
    script.addEventListener('load', () => {
      organiserOpenAttempted = false;
      setTimeout(reconcile, 0);
    }, { once:true });
    document.head.appendChild(script);
  }

  function closeQuickAddSheet() {
    const sheet = document.getElementById('v10QuickAddSheet');
    if (sheet) sheet.hidden = true;
    document.body?.classList.remove('v10-quick-add-open');
  }

  function organiserReminderUrl() {
    const url = new URL('reminders.html', document.baseURI);
    url.searchParams.set('organiser', 'notes');
    url.searchParams.set('compose', '1');
    return url.href;
  }

  function routeReminderToOrganiser(event) {
    const trigger = event.target instanceof Element
      ? event.target.closest('[data-v10-quick-action="reminder"]')
      : null;
    if (!trigger) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    closeQuickAddSheet();

    if (pageName() === 'reminders') {
      ensureOrganiserAssets();
      openOrganiserReminderSubflow(true);
      return;
    }

    window.location.href = organiserReminderUrl();
  }

  function labelCanonicalActions() {
    const sheet = document.getElementById('v10QuickAddSheet');
    if (!sheet) return;

    const definitions = {
      boarding: ['Boarding', 'Confirmed booking form'],
      potential: ['Potential', 'Pending stay request'],
      meet: ['Meet & Greet', 'Schedule a visit'],
      reminder: ['Reminder', 'Organiser · Sticky Notes']
    };

    Object.entries(definitions).forEach(([kind, copy]) => {
      const button = sheet.querySelector(`[data-v10-quick-action="${kind}"]`);
      if (!button) return;
      button.dataset.wh89Validated = 'true';
      const strong = button.querySelector('strong');
      const small = button.querySelector('small');
      if (strong) strong.textContent = copy[0];
      if (small) small.textContent = copy[1];
      button.setAttribute('aria-label', `${copy[0]} — ${copy[1]}`);
    });
  }

  function revealNotesTab() {
    const tab = document.querySelector('[data-organiser-tab="notes"]');
    if (!(tab instanceof HTMLElement)) return false;
    if (!tab.classList.contains('is-active')) tab.click();
    return true;
  }

  function openStickyNoteComposer() {
    const composer = document.getElementById('reminderComposer');
    const addButton = document.getElementById('addReminderNoteBtn');

    if (typeof window.openReminderComposer === 'function') {
      try { window.openReminderComposer(); } catch (_) {}
    } else if (addButton instanceof HTMLElement) {
      addButton.click();
    }

    const target = document.getElementById('reminderComposer');
    if (target && !target.hidden) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
        const first = target.querySelector('input:not([type="hidden"]),textarea,select');
        if (first instanceof HTMLElement) first.focus({ preventScroll: true });
      });
      return true;
    }

    return !!composer && !composer.hidden;
  }

  function cleanReminderQuery() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('compose');
      url.searchParams.delete('organiser');
      url.searchParams.delete('quickAction');
      history.replaceState(history.state, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch (_) {}
  }

  function openOrganiserReminderSubflow(force) {
    if (pageName() !== 'reminders') return false;

    const params = new URLSearchParams(window.location.search);
    const requested = force ||
      params.get('compose') === '1' ||
      params.get('quickAction') === 'reminder';
    if (!requested || organiserOpenAttempted) return false;

    ensureOrganiserAssets();
    if (!revealNotesTab()) return false;
    if (!openStickyNoteComposer()) return false;

    organiserOpenAttempted = true;
    cleanReminderQuery();
    return true;
  }

  function validateQuickActionFunctions() {
    const sheet = document.getElementById('v10QuickAddSheet');
    const hasAction = kind => !!sheet?.querySelector(`[data-v10-quick-action="${kind}"]`);
    const report = {
      boarding: hasAction('boarding'),
      potential: hasAction('potential') && (
        typeof window.openNewPotentialModal === 'function' ||
        !!document.getElementById('potentialStayModal')
      ),
      meet: hasAction('meet') && (
        typeof window.openV10MeetGreetModal === 'function' ||
        !!document.getElementById('customBookingModal')
      ),
      reminder: hasAction('reminder')
    };
    report.allValid = Object.values(report).every(Boolean);
    window.WAFFLE_QUICK_ACTION_STATUS = report;
    return report;
  }

  function reconcile() {
    queued = false;
    ensureStyle();
    if (pageName() === 'reminders') ensureOrganiserAssets();
    labelCanonicalActions();
    validateQuickActionFunctions();
    if (isMobile()) openOrganiserReminderSubflow(false);
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(reconcile);
  }

  function start() {
    ensureStyle();
    ensureOrganiserAssets();
    document.addEventListener('click', routeReminderToOrganiser, true);
    reconcile();

    if (typeof MutationObserver === 'function' && document.body) {
      observer = new MutationObserver(queue);
      observer.observe(document.body, { childList:true, subtree:true });
    }

    [80,180,360,700,1200,2200,4200].forEach(delay => setTimeout(reconcile, delay));
    window.addEventListener('pageshow', reconcile);
    window.addEventListener('resize', queue);
    window.addEventListener('orientationchange', () => setTimeout(reconcile, 80));

    window.v11189MobileQuickActionCompletionVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
