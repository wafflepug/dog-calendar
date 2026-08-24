/* ============================================================
   WAFFLE HOUSE V11.1.61 — CALENDAR COMPATIBILITY BRIDGE
   ============================================================
   Historical entry points still request this filename. All former visible
   Calendar renderers (V11.1.61, V11.1.63, V11.1.64 and V11.1.65) are retired.

   V11.1.69 is the only visible Calendar and adds Month (default), Fortnight and
   Week views. V11.1.66 compacts Meet & Greet badges on mobile. V11.1.67 removes
   numeric capacity/activity pills. V11.1.68 adds red/amber/green capacity
   health markers based only on confirmed boarding. V11.1.70 keeps Potential
   Stay bars compact by showing only the pet name.
   FullCalendar remains hidden only as the existing data/editing adapter.
   ============================================================ */
(function () {
  'use strict';

  const SCRIPTS = [
    ['waffle-v11.1.69.js', '11.1.69', () => !!window.v11169CalendarViewsVersion],
    ['waffle-v11.1.66.js', '11.1.66', () => !!window.v11166MobileMeetVersion],
    ['waffle-v11.1.67.js', '11.1.67', () => !!window.v11167NoCapacityCountVersion],
    ['waffle-v11.1.68.js', '11.1.68', () => !!window.v11168CapacityHealthVersion],
    ['waffle-v11.1.70.js', '11.1.70', () => !!window.v11170PotentialLabelVersion]
  ];

  function markReady() {
    window.v11161CleanCalendarVersion = '11.1.70-calendar-labels-bridge';
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
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }

      const script = document.createElement('script');
      script.src = file + '?v=' + version;
      script.async = false;
      script.dataset.waffleSingleCalendar = version;
      script.addEventListener('load', resolve, { once:true });
      script.addEventListener('error', () => reject(new Error('Could not load ' + file)), { once:true });
      document.head.appendChild(script);
    });
  }

  async function start() {
    try {
      for (const [file, version, ready] of SCRIPTS) {
        await loadOne(file, version, ready);
      }
    } catch (error) {
      console.warn('Waffle single Calendar could not fully load:', error);
    } finally {
      markReady();
    }
  }

  start();
})();
