/* ============================================================
   WAFFLE HOUSE V11.1.99 — CARE FUTURE STAY DATA BRIDGE
   ------------------------------------------------------------
   The native Care directory intentionally renders only the current + next
   seven-day working set. V11.1.96 can extend Future Stays to six months, but
   on the Care page there is no FullCalendar adapter to supply the remaining
   confirmed bookings. This bridge reads the full cached booking CSV without
   mutating the directory, temporarily exposes those bookings through the
   Calendar adapter contract, then lets V11.1.96 create/group the extra cards.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_V11199_FUTURE_DATA_BRIDGE) return;

  const VERSION = '11.1.99';
  const REFRESH_MS = 15000;
  let refreshTimer = 0;
  let running = false;
  let originalSyncSpreadsheetData = null;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  }

  function isCarePage() {
    return pageName() === 'directory';
  }

  function decodeCsvCell(value) {
    let text = String(value == null ? '' : value);
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1).replace(/""/g, '"');
    }
    return text.trim();
  }

  function splitCsvRow(line) {
    return String(line || '')
      .split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/)
      .map(decodeCsvCell);
  }

  function fallbackDateKey(value) {
    const text = String(value || '').trim();
    if (!text) return '';

    const iso = text.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const au = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (au) {
      return `${au[3]}-${String(au[2]).padStart(2, '0')}-${String(au[1]).padStart(2, '0')}`;
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return '';
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, '0'),
      String(parsed.getDate()).padStart(2, '0')
    ].join('-');
  }

  function dateKey(value) {
    try {
      if (typeof parseCsvDate === 'function') {
        const parsed = String(parseCsvDate(value) || '').trim();
        if (parsed) return parsed;
      }
    } catch (_) {}
    return fallbackDateKey(value);
  }

  function confirmedEventsFromCsv(csvText) {
    const lines = String(csvText || '').split(/\r?\n/);
    const events = [];

    for (let i = 1; i < lines.length; i += 1) {
      if (!lines[i].trim()) continue;
      const cells = splitCsvRow(lines[i]);
      while (cells.length < 12) cells.push('');

      const dogName = String(cells[1] || '').trim();
      const breed = String(cells[2] || '').trim();
      const startDate = dateKey(cells[3]);
      const endDate = dateKey(cells[4]) || startDate;
      const ownerName = String(cells[5] || '').trim();
      const phone = String(cells[6] || '').trim();
      const notes = String(cells[9] || '').trim();
      const editLink = String(cells[10] || '').trim();
      const bookingType = String(cells[11] || 'Boarding').trim();
      const lowerType = bookingType.toLowerCase();

      if (!dogName || !startDate) continue;
      if (lowerType === 'meet & greet' || lowerType === 'potential stay') continue;

      events.push({
        id: `care_cache_${i}_${dogName}_${startDate}`,
        title: dogName,
        start: startDate,
        end: endDate,
        allDay: true,
        extendedProps: {
          isMeetGreet: false,
          isPotential: false,
          dogName,
          breed,
          owner: ownerName,
          ownerName,
          phone,
          notes: notes || 'None',
          rawStartDate: startDate,
          rawEndDate: endDate,
          bookingType: bookingType || 'Boarding',
          editLink
        }
      });
    }

    try {
      const localConfirmed = JSON.parse(localStorage.getItem('temporaryConfirmedStays') || '[]');
      if (Array.isArray(localConfirmed)) events.push(...localConfirmed);
    } catch (_) {}

    return events;
  }

  function fullConfirmedEvents() {
    try {
      return confirmedEventsFromCsv(localStorage.getItem('boardingDataCache') || '');
    } catch (error) {
      console.warn('Future Care full-range cache could not be read:', error);
      return [];
    }
  }

  function runRangeMaintain() {
    if (!isCarePage() || running) return;
    const range = window.WAFFLE_V11196_FUTURE_RANGE;
    if (!range || typeof range.maintain !== 'function') return;

    const events = fullConfirmedEvents();
    if (!events.length) {
      try { range.maintain(); } catch (_) {}
      return;
    }

    const bridge = {
      getEvents() { return events; }
    };

    running = true;
    let lexicalReplaced = false;
    let previousLexical = null;
    const hadWindowAdapter = Object.prototype.hasOwnProperty.call(window, 'globalCalendar');
    const previousWindowAdapter = window.globalCalendar;

    try {
      /* waffle-app.js owns a shared global lexical `let globalCalendar`.
         On Care it is normally null because FullCalendar is not instantiated. */
      try {
        previousLexical = globalCalendar;
        globalCalendar = bridge;
        lexicalReplaced = true;
      } catch (_) {
        window.globalCalendar = bridge;
      }

      range.maintain();
    } catch (error) {
      console.warn('Future Care full-range refresh could not run:', error);
    } finally {
      try {
        if (lexicalReplaced) globalCalendar = previousLexical;
      } catch (_) {}

      if (!lexicalReplaced) {
        try {
          if (hadWindowAdapter) window.globalCalendar = previousWindowAdapter;
          else delete window.globalCalendar;
        } catch (_) {}
      }
      running = false;
    }
  }

  function scheduleRefresh(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      requestAnimationFrame(runRangeMaintain);
    }, Math.max(0, Number(delay || 0)));
  }

  function installSyncHook() {
    try {
      if (typeof syncSpreadsheetData !== 'function' || originalSyncSpreadsheetData) return;
      originalSyncSpreadsheetData = syncSpreadsheetData;
      syncSpreadsheetData = function(...args) {
        const result = originalSyncSpreadsheetData.apply(this, args);
        Promise.resolve(result).finally(() => scheduleRefresh(0));
        return result;
      };
    } catch (error) {
      console.warn('Future Care sync hook could not be installed:', error);
    }
  }

  function start() {
    if (!isCarePage()) return;
    installSyncHook();
    scheduleRefresh(0);
    window.setInterval(runRangeMaintain, REFRESH_MS);

    window.addEventListener('pageshow', () => scheduleRefresh(0));
    window.addEventListener('storage', event => {
      if (event.key === 'boardingDataCache' || event.key === 'temporaryConfirmedStays') {
        scheduleRefresh(0);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleRefresh(0);
    });
  }

  window.WAFFLE_V11199_FUTURE_DATA_BRIDGE = Object.freeze({
    version: VERSION,
    refresh: runRangeMaintain,
    readConfirmedEvents: fullConfirmedEvents
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
