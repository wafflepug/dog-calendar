/* ============================================================
   WAFFLE HOUSE V11.1.99 — CARE FUTURE STAY DATA BRIDGE
   ------------------------------------------------------------
   The native Care directory intentionally renders only the current + next
   seven-day working set. V11.1.96 can extend Future Stays to six months, but
   on the Care page there is no FullCalendar adapter to supply the remaining
   confirmed bookings. This bridge reads the full cached booking CSV without
   mutating the directory and hands the event snapshot to V11.1.96. That module
   only materializes arrivals beyond seven days after the user asks to see them.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_V11199_FUTURE_DATA_BRIDGE) return;

  const VERSION = '11.1.99';
  const REFRESH_MS = 15000;
  let refreshTimer = 0;
  let originalSyncSpreadsheetData = null;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  }

  function isCarePage() {
    return pageName() === 'directory';
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
    const parsed = window.WaffleCsv?.parse(String(csvText || ''));
    const events = [];
    if (parsed?.ok && parsed.records.length) {
      const headerKey = value => String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const header = parsed.records[0].cells || [];
      const columns = new Map(header.map((name, index) => [headerKey(name), index]));
      const indexFor = (...names) => {
        for (const name of names) if (columns.has(headerKey(name))) return columns.get(headerKey(name));
        return -1;
      };
      const valueFor = (cells, index, fallback) => String(cells[index >= 0 ? index : fallback] || '').trim();
      const dogNameIndex = indexFor('Dog Name');
      const startIndex = indexFor('Start Date');
      const endIndex = indexFor('End Date');
      for (let i = 1; i < parsed.records.length; i += 1) {
        const row = parsed.records[i];
        if (!row.raw.trim()) continue;
        const cells = row.cells || [];
        const dogName = valueFor(cells, dogNameIndex, 1);
        const breed = valueFor(cells, indexFor('Breed'), 2);
        const startDate = dateKey(valueFor(cells, startIndex, 3));
        const endDate = dateKey(valueFor(cells, endIndex, 4)) || startDate;
        const ownerName = valueFor(cells, indexFor("Owner's Name", 'Owner Name'), 5);
        const phone = valueFor(cells, indexFor('Contact Number', 'Phone'), 6);
        const notes = valueFor(cells, indexFor('Notes'), 9);
        const editLink = valueFor(cells, indexFor('Edit Link'), 10);
        const bookingType = valueFor(cells, indexFor('Booking Type'), 11) || 'Boarding';
        const dogId = valueFor(cells, indexFor('Dog ID', 'Dog UUID', 'Directory Dog ID'), -1);
        const dogNumber = valueFor(cells, indexFor('Dog Number', 'Dog No', 'Dog #'), -1);
        const stayId = valueFor(cells, indexFor('Stay ID', 'Stay UUID', 'Directory Stay ID'), -1);
        const bookingId = valueFor(cells, indexFor('Booking ID', 'Booking UUID', 'Source Booking ID'), -1);
        const requestSource = valueFor(cells, indexFor('Request Source'), -1);
        const lowerType = bookingType.toLowerCase();
        if (!dogName || !startDate || lowerType === 'meet & greet' || lowerType === 'potential stay') continue;
        const sourceRow = i + 1;
        events.push({
          id: 'care_cache_' + sourceRow + '_' + dogName + '_' + startDate,
          title: dogName,
          start: startDate,
          end: endDate,
          allDay: true,
          extendedProps: {
            isMeetGreet: false, isPotential: false, dogName, breed,
            owner: ownerName, ownerName, phone, notes: notes || 'None',
            rawStartDate: startDate, rawEndDate: endDate, sourceRow,
            dogId, dogNumber, stayId, bookingId, requestSource,
            bookingType, editLink
          }
        });
      }
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
    if (!isCarePage()) return;
    const range = window.WAFFLE_V11196_FUTURE_RANGE;
    if (!range || typeof range.updateEvents !== 'function') return;

    const events = fullConfirmedEvents();
    try {
      range.updateEvents(events);
    } catch (error) {
      console.warn('Future Care full-range refresh could not run:', error);
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
