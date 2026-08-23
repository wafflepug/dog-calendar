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

/* ============================================================
   WAFFLE HOUSE V11.1.62 — RETIRE LEGACY CALENDAR DATE CHOOSER
   ============================================================
   V10.8.8 still attaches its historical "Add to this date" chooser to
   FullCalendar dateClick. The clean V11.1.61 calendar owns date inspection now.

   This layer permanently removes the old chooser and routes raw date clicks to
   the clean day summary when it is available. Booking creation remains in the
   canonical Quick Add control instead of being duplicated on every date cell.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.62';
  let chooserObserver = null;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isCalendar() {
    return pageName() === 'calendar';
  }

  function getCalendar() {
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar) return globalCalendar;
    } catch (_) {}
    return window.globalCalendar || null;
  }

  function ensureRetirementStyle() {
    if (document.getElementById('v11162RetiredDateChooserStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11162RetiredDateChooserStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] #v1088DateChoiceModal {
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function retireLegacyDateChooser() {
    if (!isCalendar()) return;
    ensureRetirementStyle();
    document.getElementById('v1088DateChoiceModal')?.remove();
  }

  function cleanDayButton(dateStr, info) {
    const fromInfo = info?.dayEl?.querySelector?.('.v11161-day-button');
    if (fromInfo) return fromInfo;

    const wanted = String(dateStr || '');
    if (!wanted) return null;
    const cell = Array.from(document.querySelectorAll('.fc-daygrid-day[data-date]'))
      .find(node => node.dataset.date === wanted);
    return cell?.querySelector('.v11161-day-button') || null;
  }

  function installDateClickAuthority() {
    if (!isCalendar()) return false;

    retireLegacyDateChooser();
    const calendar = getCalendar();
    if (!calendar || typeof calendar.setOption !== 'function') return false;

    calendar.setOption('dateClick', info => {
      info?.jsEvent?.preventDefault?.();
      retireLegacyDateChooser();

      // V11.1.61's summary button already owns its own click. Raw clicks on the
      // day number/background are forwarded to that same day-view interaction.
      const originalTarget = info?.jsEvent?.target instanceof Element
        ? info.jsEvent.target
        : null;
      if (originalTarget?.closest('.v11161-day-button')) return;

      const button = cleanDayButton(info?.dateStr || '', info);
      if (button) button.click();
    });

    return true;
  }

  function wireChooserObserver() {
    if (!isCalendar() || chooserObserver || typeof MutationObserver !== 'function' || !document.body) return;

    chooserObserver = new MutationObserver(mutations => {
      const recreated = mutations.some(mutation =>
        Array.from(mutation.addedNodes || []).some(node => {
          if (!(node instanceof Element)) return false;
          return node.id === 'v1088DateChoiceModal' ||
            !!node.querySelector?.('#v1088DateChoiceModal');
        })
      );
      if (recreated) retireLegacyDateChooser();
    });

    chooserObserver.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    if (!isCalendar()) return;

    retireLegacyDateChooser();
    wireChooserObserver();

    // Historical Calendar enhancements assign dateClick after startup, so the
    // final authority is reasserted across those bounded enhancement passes.
    [0, 80, 180, 400, 800, 1500, 2800, 5000].forEach(delay =>
      setTimeout(installDateClickAuthority, delay)
    );

    window.addEventListener('pageshow', installDateClickAuthority);
    window.addEventListener('focus', installDateClickAuthority);
    window.v11162CalendarDateClickVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
