/* ============================================================
   WAFFLE HOUSE V11.1.61 — CALENDAR COMPATIBILITY BRIDGE
   ============================================================
   Historical entry points still request this filename. All former visible
   Calendar renderers (V11.1.61, V11.1.63 and V11.1.64) are retired.

   V11.1.65 is now the only visible Calendar. FullCalendar remains hidden only
   as the existing data/editing adapter.
   ============================================================ */
(function () {
  'use strict';

  const FILE = 'waffle-v11.1.65.js';
  const VERSION = '11.1.65';

  function markReady() {
    window.v11161CleanCalendarVersion = '11.1.65-single-calendar-bridge';
  }

  function load() {
    if (window.v11165SingleCalendarVersion) {
      markReady();
      return;
    }

    const existing = Array.from(document.scripts).find(script =>
      String(script.src || '').includes('/' + FILE)
    );

    if (existing) {
      existing.addEventListener('load', markReady, { once:true });
      existing.addEventListener('error', markReady, { once:true });
      markReady();
      return;
    }

    const script = document.createElement('script');
    script.src = FILE + '?v=' + VERSION;
    script.async = false;
    script.dataset.waffleSingleCalendar = VERSION;
    script.addEventListener('load', markReady, { once:true });
    script.addEventListener('error', () => {
      console.warn('Waffle single Calendar could not load.');
      markReady();
    }, { once:true });
    document.head.appendChild(script);
    markReady();
  }

  load();
})();
