/* ============================================================
   WAFFLE HOUSE V11.1.61 — CALENDAR COMPATIBILITY BRIDGE
   ============================================================
   Historical shared loaders still request this filename. The former V11.1.61
   per-day occupancy renderer has been retired in favour of:
   - V11.1.63 native FullCalendar stay timeline; and
   - V11.1.64 unlimited, non-collapsing lane authority.

   This bridge deliberately contains no Calendar presentation of its own, so
   installed PWAs and old HTML entry points still converge on one Calendar UI.
   ============================================================ */
(function () {
  'use strict';

  const SCRIPTS = [
    ['waffle-v11.1.63.js', '11.1.63', () => !!window.v11163CalendarTimelineVersion],
    ['waffle-v11.1.64.js', '11.1.64', () => !!window.v11164UnlimitedCalendarVersion]
  ];

  function markBridgeReady() {
    window.v11161CleanCalendarVersion = '11.1.64-compatibility-bridge';
  }

  function loadOne(file, version, ready) {
    if (ready()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(script =>
        String(script.src || '').includes('/' + file)
      );

      if (existing) {
        if (ready()) {
          resolve();
          return;
        }
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = file + '?v=' + version;
      script.async = false;
      script.dataset.waffleCalendarAuthority = version;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error('Could not load ' + file)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function start() {
    try {
      for (const [file, version, ready] of SCRIPTS) {
        await loadOne(file, version, ready);
      }
    } catch (error) {
      console.warn('Waffle Calendar authority could not fully load:', error);
    } finally {
      markBridgeReady();
    }
  }

  start();
})();
