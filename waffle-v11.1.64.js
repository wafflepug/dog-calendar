/* ============================================================
   WAFFLE HOUSE V11.1.64 — UNLIMITED CALENDAR LANES
   ============================================================
   Follow-up authority for the V11.1.63 stay timeline.

   Guarantees:
   - month rows expand vertically to show EVERY visible activity;
   - FullCalendar may never collapse activities into a "+N more" link;
   - confirmed boarding stays retain deterministic, non-overlapping lane order;
   - a boarding lane is reused only after the previous stay has departed;
   - Meet & Greets and Potential Stays render after boarding lanes and are never
     hidden merely because a day is busy.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.64';
  const UNLIMITED_OPTIONS = new Map([
    ['dayMaxEvents', false],
    ['dayMaxEventRows', false],
    ['eventMaxStack', null],
    ['eventOrderStrict', true],
    ['height', 'auto'],
    ['contentHeight', 'auto'],
    ['expandRows', false]
  ]);

  let calendar = null;
  let laneByKey = new Map();
  let setOptionBeforeV11164 = null;
  let observer = null;
  let scheduled = 0;
  let enforcing = false;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function getCalendar() {
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar) return globalCalendar;
    } catch (_) {}
    return window.globalCalendar || null;
  }

  function isoDate(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function shiftDay(iso, amount) {
    const parts = String(iso || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + Number(amount || 0));
    return isoDate(date);
  }

  function eventType(event) {
    const props = event?.extendedProps || {};
    if (props.isMeetGreet === true) return 'meet';
    if (props.isPotential === true) return 'potential';
    return 'boarding';
  }

  function dogName(event) {
    const props = event?.extendedProps || {};
    return String(props.dogName || event?.title || 'Guest')
      .replace(/^.*Meet\s*&\s*Greet:\s*/i, '')
      .replace(/^.*Potential(?:\s+Stay)?:\s*/i, '')
      .replace(/^⏰\s*[^-]+-\s*/i, '')
      .trim() || 'Guest';
  }

  function eventDates(event) {
    const props = event?.extendedProps || {};
    const start = isoDate(props.rawStartDate || props.startDate || event?.startStr || event?.start);
    let end = isoDate(props.rawEndDate || props.endDate || '');
    if (!end && event?.end) {
      const rawEnd = isoDate(event.endStr || event.end);
      end = event.allDay === false ? rawEnd : shiftDay(rawEnd, -1);
    }
    return { start, end: end || start };
  }

  function eventTime(event) {
    const direct = String(event?.extendedProps?.time || '').trim();
    if (direct) return direct;
    if (!event?.start || event?.allDay !== false) return '';
    try {
      return event.start.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (_) {
      return '';
    }
  }

  function eventKey(event) {
    const dates = eventDates(event);
    return [eventType(event), String(event?.id || ''), dogName(event).toLowerCase(), dates.start, dates.end, eventTime(event)].join('|');
  }

  function rebuildLanes() {
    if (!calendar) return;

    const stays = calendar.getEvents()
      .filter(event => eventType(event) === 'boarding')
      .map(event => ({ event, dates: eventDates(event) }))
      .filter(item => item.dates.start)
      .sort((a, b) =>
        a.dates.start.localeCompare(b.dates.start) ||
        a.dates.end.localeCompare(b.dates.end) ||
        dogName(a.event).localeCompare(dogName(b.event))
      );

    const laneEnds = [];
    const next = new Map();

    stays.forEach(item => {
      // End dates are inclusive in Waffle House data. A lane is therefore only
      // reusable when its previous checkout date is strictly before the next
      // dog's arrival date.
      let lane = laneEnds.findIndex(previousEnd => previousEnd < item.dates.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = item.dates.end;
      next.set(eventKey(item.event), lane);
    });

    laneByKey = next;
  }

  function compareEvents(a, b) {
    const typeRank = { boarding: 0, meet: 1, potential: 2 };
    const typeA = eventType(a);
    const typeB = eventType(b);

    if (typeRank[typeA] !== typeRank[typeB]) return typeRank[typeA] - typeRank[typeB];

    if (typeA === 'boarding') {
      const laneA = laneByKey.get(eventKey(a)) ?? Number.MAX_SAFE_INTEGER;
      const laneB = laneByKey.get(eventKey(b)) ?? Number.MAX_SAFE_INTEGER;
      if (laneA !== laneB) return laneA - laneB;

      const datesA = eventDates(a);
      const datesB = eventDates(b);
      const startOrder = datesA.start.localeCompare(datesB.start);
      if (startOrder) return startOrder;
    }

    if (typeA === 'meet') {
      const timeOrder = eventTime(a).localeCompare(eventTime(b));
      if (timeOrder) return timeOrder;
    }

    return dogName(a).localeCompare(dogName(b));
  }

  function ensureStyles() {
    if (document.getElementById('v11164UnlimitedCalendarStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11164UnlimitedCalendarStyle';
    style.textContent = `
      /* Never visually collapse a busy day. FullCalendar is also configured
         with unlimited rows below; these rules make the expanded layout clear. */
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-frame {
        min-height: 0 !important;
        height: auto !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-events {
        min-height: 0 !important;
        overflow: visible !important;
        padding-bottom: 7px !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-event-harness {
        margin-top: 5px !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-event {
        position: relative !important;
        z-index: 1 !important;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        box-shadow: 0 0 0 1px rgba(255,255,255,.08) !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-event-harness:hover .fc-daygrid-event {
        z-index: 3 !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-more-link,
      body[data-waffle-page="calendar"] #calendar .fc-more-link {
        display: none !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-body,
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-body table,
      body[data-waffle-page="calendar"] #calendar .fc-scrollgrid-sync-table {
        height: auto !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-bottom {
        display: none !important;
      }

      /* A small gap between lanes makes separate stays visually unmistakable. */
      body[data-waffle-page="calendar"] #calendar .wh63-event--boarding {
        outline: 1px solid color-mix(in srgb, var(--wh63-event-colour) 68%, white 32%);
        outline-offset: -1px;
      }
      body[data-waffle-page="calendar"] #calendar .wh63-event--meet {
        margin-block: 1px !important;
      }
      body[data-waffle-page="calendar"] #calendar .wh63-event--potential {
        margin-block: 1px !important;
      }

      @media (max-width: 700px) {
        body[data-waffle-page="calendar"] #calendar .fc-daygrid-event-harness {
          margin-top: 3px !important;
        }
        body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-events {
          padding-bottom: 4px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function installOptionGuard() {
    if (!calendar || calendar._v11164UnlimitedGuard) return;

    setOptionBeforeV11164 = calendar.setOption.bind(calendar);
    calendar._v11164UnlimitedGuard = true;
    calendar._v11164SetOptionBeforeGuard = setOptionBeforeV11164;

    calendar.setOption = function(name, value) {
      if (UNLIMITED_OPTIONS.has(name)) {
        return setOptionBeforeV11164(name, UNLIMITED_OPTIONS.get(name));
      }
      if (name === 'eventOrder') {
        return setOptionBeforeV11164(name, compareEvents);
      }
      return setOptionBeforeV11164(name, value);
    };
  }

  function setAuthorityOption(name, value) {
    const setter = calendar?._v11164SetOptionBeforeGuard || setOptionBeforeV11164 || calendar?.setOption?.bind(calendar);
    if (!setter) return;
    setter(name, value);
  }

  function enforceUnlimitedRows() {
    if (!calendar || enforcing) return;
    enforcing = true;

    try {
      rebuildLanes();
      UNLIMITED_OPTIONS.forEach((value, name) => setAuthorityOption(name, value));
      setAuthorityOption('eventOrder', compareEvents);

      // FullCalendar's public option changes trigger a re-render. updateSize
      // then lets each week adopt the natural height required by all rows.
      try { calendar.updateSize(); } catch (_) {}
    } finally {
      enforcing = false;
    }

    removeAnyMoreLinks();
  }

  function removeAnyMoreLinks() {
    document.querySelectorAll('#calendar .fc-daygrid-more-link,#calendar .fc-more-link').forEach(link => link.remove());
  }

  function scheduleEnforce() {
    if (scheduled) window.clearTimeout(scheduled);
    scheduled = window.setTimeout(() => {
      scheduled = 0;
      enforceUnlimitedRows();
    }, 45);
  }

  function bindCalendarEvents() {
    if (!calendar || calendar._v11164EventsBound || typeof calendar.on !== 'function') return;
    calendar._v11164EventsBound = true;

    ['eventsSet', 'datesSet', 'eventAdd', 'eventChange', 'eventRemove'].forEach(name => {
      try { calendar.on(name, scheduleEnforce); } catch (_) {}
    });
  }

  function bindObserver() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;

    observer = new MutationObserver(mutations => {
      const collapsed = mutations.some(mutation =>
        Array.from(mutation.addedNodes || []).some(node => {
          if (!(node instanceof Element)) return false;
          return node.matches?.('.fc-daygrid-more-link,.fc-more-link') ||
            !!node.querySelector?.('.fc-daygrid-more-link,.fc-more-link');
        })
      );

      if (collapsed) scheduleEnforce();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function attach() {
    const ref = getCalendar();
    if (!ref || typeof ref.setOption !== 'function' || typeof ref.getEvents !== 'function') return false;

    calendar = ref;
    ensureStyles();
    rebuildLanes();
    installOptionGuard();
    bindCalendarEvents();
    bindObserver();
    enforceUnlimitedRows();

    // Reassert after historical delayed Calendar layers. This is deliberately
    // bounded; ongoing eventsSet/datesSet hooks handle normal operation.
    [80, 220, 500, 900, 1500, 2600, 4200, 6500].forEach(delay =>
      window.setTimeout(enforceUnlimitedRows, delay)
    );

    window.addEventListener('resize', scheduleEnforce, { passive: true });
    window.addEventListener('pageshow', enforceUnlimitedRows);
    window.addEventListener('focus', enforceUnlimitedRows);

    window.v11164UnlimitedCalendarVersion = VERSION;
    return true;
  }

  function start() {
    if (pageName() !== 'calendar') return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attach() || attempts > 120) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
