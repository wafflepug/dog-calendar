/* ============================================================
   WAFFLE HOUSE V11.1.45 — CALENDAR RENDER STABILITY
   ============================================================
   Calendar had two valid UI layers fighting during startup:
   V11.1.37 inserted Ask Waffle into the header as a pill, then V11.1.39 moved
   it to the final floating circular launcher. The temporary insertion changed
   header flex geometry, so the key/theme/update controls visibly jumped.

   This layer makes the final Calendar action layout authoritative:
   - Ask Waffle never participates in header layout;
   - the final floating/circular launcher is restored immediately if recreated;
   - obsolete Ask Waffle header buttons are removed;
   - connection-status width is reserved so Updating/Live text cannot move the
     rest of the header;
   - startup/focus/resize passes only normalise geometry and never rebuild the
     Operations Home content.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.45';
  let headerObserver = null;
  let bodyObserver = null;
  let scheduled = 0;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isCalendar() {
    return pageName() === 'calendar';
  }

  function normaliseLauncher() {
    if (!isCalendar()) return false;

    document.getElementById('v11133AskWaffleButton')?.remove();

    const button = document.getElementById('aw37launch');
    if (!button) return false;

    button.classList.add('float', 'aw39-round-launch', 'v11145-calendar-launch');
    button.setAttribute('aria-label', 'Ask Waffle');
    button.setAttribute('title', 'Ask Waffle');

    if (button.parentElement !== document.body) {
      document.body.appendChild(button);
    }

    return true;
  }

  function stabiliseConnectionStatus() {
    if (!isCalendar()) return;

    const status = document.getElementById('waffleConnectionStatus');
    if (!status) return;

    status.classList.add('v11145-calendar-connection-status');
  }

  function calendarHeader() {
    return document.querySelector('.calendar-header-branding');
  }

  function apply() {
    if (!isCalendar()) return;

    normaliseLauncher();
    stabiliseConnectionStatus();
  }

  function queueApply() {
    if (!isCalendar()) return;
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      apply();
    });
  }

  function wireObservers() {
    if (!isCalendar() || typeof MutationObserver !== 'function') return;

    const header = calendarHeader();
    if (header && !headerObserver) {
      headerObserver = new MutationObserver(() => queueApply());
      headerObserver.observe(header, { childList: true, subtree: false });
    }

    if (document.body && !bodyObserver) {
      bodyObserver = new MutationObserver(mutations => {
        const relevant = mutations.some(mutation =>
          Array.from(mutation.addedNodes || []).some(node => {
            if (!(node instanceof Element)) return false;
            return node.id === 'aw37launch' ||
              node.id === 'v11133AskWaffleButton' ||
              node.id === 'waffleConnectionStatus' ||
              !!node.querySelector?.('#aw37launch,#v11133AskWaffleButton,#waffleConnectionStatus');
          })
        );
        if (relevant) queueApply();
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function start() {
    if (!isCalendar()) return;

    apply();
    wireObservers();

    // Bounded passes cover the older delayed assistant/header enhancement
    // passes without continuously rebuilding Calendar content.
    [40, 100, 220, 500, 1000, 2200, 5000].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('resize', () => setTimeout(apply, 60));

    window.v11145CalendarStabilityVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
