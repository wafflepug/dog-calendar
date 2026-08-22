/* ============================================================
   WAFFLE HOUSE V11.1.32 — CAPACITY DOTS + FIVE EVENT ROWS
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.32';
  const MIN_VISIBLE_ROWS = 5;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function calendarInstance() {
    try {
      if (window.globalCalendar && typeof window.globalCalendar.getEvents === 'function') {
        return window.globalCalendar;
      }
    } catch (_) {}

    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar && typeof globalCalendar.getEvents === 'function') {
        return globalCalendar;
      }
    } catch (_) {}

    return null;
  }

  function dateKey(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  function rawDates(event) {
    try {
      if (typeof window.v10EventRawDates === 'function') {
        const dates = window.v10EventRawDates(event);
        if (dates?.start && dates?.end) return dates;
      }
    } catch (_) {}

    try {
      if (typeof v10EventRawDates === 'function') {
        const dates = v10EventRawDates(event);
        if (dates?.start && dates?.end) return dates;
      }
    } catch (_) {}

    const start = String(event?.startStr || '').slice(0, 10) || dateKey(event?.start);
    let end = start;

    if (event?.end) {
      const rawEnd = new Date(event.end);
      if (!Number.isNaN(rawEnd.getTime())) {
        if (event.allDay !== false) rawEnd.setDate(rawEnd.getDate() - 1);
        end = dateKey(rawEnd) || start;
      }
    }

    return { start, end };
  }

  function isMeet(event) {
    const props = event?.extendedProps || {};
    return props.isMeetGreet === true || /meet\s*&?\s*greet/i.test(String(event?.title || ''));
  }

  function isPotential(event) {
    return event?.extendedProps?.isPotential === true;
  }

  function isCheckedOut(event) {
    try {
      if (typeof window.v110IsCheckedOutEvent === 'function') {
        return window.v110IsCheckedOutEvent(event) === true;
      }
    } catch (_) {}

    try {
      if (typeof v110IsCheckedOutEvent === 'function') {
        return v110IsCheckedOutEvent(event) === true;
      }
    } catch (_) {}

    return false;
  }

  function isBoarding(event) {
    return !isMeet(event) && !isPotential(event) && !isCheckedOut(event);
  }

  function occursOn(event, date) {
    const dates = rawDates(event);
    return !!dates.start && !!dates.end && date >= dates.start && date <= dates.end;
  }

  function capacityForDate(calendar, date) {
    if (!calendar || !date) return 0;
    return calendar.getEvents().filter(event => isBoarding(event) && occursOn(event, date)).length;
  }

  function capacityTone(count) {
    if (count >= 4) return 'full';
    if (count === 3) return 'busy';
    return 'available';
  }

  function capacityTitle(count, tone) {
    if (tone === 'full') return `${count} Dogs - Full Capacity`;
    if (tone === 'busy') return '3 Dogs - Busy';
    return `${count} Dog${count === 1 ? '' : 's'} - Available`;
  }

  function enforceFiveRows(calendar) {
    if (!calendar || typeof calendar.setOption !== 'function') return;

    /* V11.1.28/V11.1.30/V11.1.31 all have delayed Calendar passes. Wrap the
       option setter once so any later attempt to lower/remove the row limit is
       normalised back to the requested five visible rows. The guard avoids a
       second FullCalendar render when the effective option is already five. */
    if (!calendar.v11132SetOptionWrapped) {
      const originalSetOption = calendar.setOption.bind(calendar);
      calendar.setOption = function (name, value) {
        if (name === 'dayMaxEventRows') {
          value = MIN_VISIBLE_ROWS;
          try {
            if (typeof calendar.getOption === 'function' && calendar.getOption(name) === value) return;
          } catch (_) {}
        }
        return originalSetOption(name, value);
      };
      calendar.v11132SetOptionWrapped = true;
    }

    let changed = false;

    try {
      if (typeof calendar.getOption !== 'function' || calendar.getOption('dayMaxEvents') !== false) {
        calendar.setOption('dayMaxEvents', false);
        changed = true;
      }
    } catch (_) {}

    try {
      if (typeof calendar.getOption !== 'function' || calendar.getOption('dayMaxEventRows') !== MIN_VISIBLE_ROWS) {
        calendar.setOption('dayMaxEventRows', MIN_VISIBLE_ROWS);
        changed = true;
      }
    } catch (_) {}

    if (changed) {
      try {
        if (typeof calendar.updateSize === 'function') calendar.updateSize();
      } catch (_) {}
    }
  }

  function renderCapacityDots(calendar) {
    if (!calendar) return;

    document.querySelectorAll('#calendar .fc-daygrid-day[data-date]').forEach(cell => {
      const date = String(cell.getAttribute('data-date') || '');
      const top = cell.querySelector('.fc-daygrid-day-top');
      if (!date || !top) return;

      const count = capacityForDate(calendar, date);
      const tone = capacityTone(count);

      let indicator = top.querySelector('.capacity-indicator');
      if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'capacity-indicator v11131-capacity-indicator v11132-capacity-indicator';
        top.insertBefore(indicator, top.firstChild || null);
      }

      indicator.classList.add('v11131-capacity-indicator', 'v11132-capacity-indicator');
      indicator.dataset.capacityTone = tone;
      indicator.dataset.capacityCount = String(count);
      indicator.title = capacityTitle(count, tone);
      indicator.textContent = '';
      indicator.setAttribute('aria-label', indicator.title);
    });
  }

  let refreshTimer = 0;
  function scheduleRefresh(delay = 30) {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(apply, delay);
  }

  function installCalendarObserver() {
    const root = document.getElementById('calendar');
    if (!root || root.dataset.v11132CapacityObserver === 'true') return;

    root.dataset.v11132CapacityObserver = 'true';
    const observer = new MutationObserver(() => scheduleRefresh(40));
    observer.observe(root, { childList: true, subtree: true });
    window.v11132CapacityObserver = observer;
  }

  function apply() {
    if (pageName() !== 'calendar') return;

    const calendar = calendarInstance();
    if (!calendar) return;

    enforceFiveRows(calendar);
    renderCapacityDots(calendar);
    installCalendarObserver();
    calendar.v11132CalendarVersion = VERSION;
  }

  function start() {
    apply();
    [80, 240, 600, 1200, 2200, 4200, 6400].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('resize', () => scheduleRefresh(100));
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('#calendar .fc-prev-button, #calendar .fc-next-button, #calendar .fc-today-button')) {
        scheduleRefresh(80);
      }
    });

    window.v11132CalendarVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
