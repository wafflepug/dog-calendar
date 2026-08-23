/* ============================================================
   WAFFLE HOUSE V11.1.61 — CALENDAR COMPATIBILITY BRIDGE
   ============================================================
   Historical shared loaders still request this filename. The former V11.1.61
   per-day occupancy renderer has been retired in favour of V11.1.63's native
   FullCalendar stay timeline.

   Keep this tiny bridge until all historical entry points have aged out of
   installed PWA caches. It deliberately contains no Calendar presentation of
   its own, so there is only one Calendar authority.
   ============================================================ */
(function () {
  'use strict';

  const TARGET = 'waffle-v11.1.63.js';
  const VERSION = '11.1.63';

  function markBridgeReady() {
    window.v11161CleanCalendarVersion = '11.1.63-compatibility-bridge';
  }

  if (window.v11163CalendarTimelineVersion) {
    markBridgeReady();
    return;
  }

  const existing = Array.from(document.scripts).find(script =>
    String(script.src || '').includes('/' + TARGET)
  );

  if (existing) {
    existing.addEventListener('load', markBridgeReady, { once: true });
    markBridgeReady();
    return;
  }

  const script = document.createElement('script');
  script.src = TARGET + '?v=' + VERSION;
  script.async = false;
  script.dataset.waffleCalendarTimeline = VERSION;
  script.addEventListener('load', markBridgeReady, { once: true });
  script.addEventListener('error', () => {
    console.warn('Waffle stay timeline could not load.');
    markBridgeReady();
  }, { once: true });
  document.head.appendChild(script);

  // The compatibility filename itself has loaded successfully. The timeline
  // script continues synchronously behind it and owns Calendar presentation.
  markBridgeReady();
})();
