/* ============================================================
   WAFFLE HOUSE V11.1.68 — CALENDAR CAPACITY HEALTH
   ============================================================
   Adds a non-numeric health marker to every date in the single V11.1.65
   Calendar. Capacity is based ONLY on confirmed boarding stays:

   GREEN  = 0–2 confirmed dogs
   AMBER  = 3 confirmed dogs
   RED    = 4+ confirmed dogs

   Meet & Greets and Potential Stays do not affect capacity health.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.68';
  const AMBER_AT = 3;
  const RED_AT = 4;
  let observer = null;
  let scheduled = 0;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function adapter() {
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar) return globalCalendar;
    } catch (_) {}
    return window.globalCalendar || null;
  }

  function isoDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function shiftIso(value, amount) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return String(value || '');
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    date.setDate(date.getDate() + Number(amount || 0));
    return isoDate(date);
  }

  function eventDates(event) {
    const props = event?.extendedProps || {};
    const start = String(props.rawStartDate || props.startDate || event?.startStr || '').slice(0, 10) || isoDate(event?.start);
    let end = String(props.rawEndDate || props.endDate || '').slice(0, 10);

    if (!end && event?.end) {
      const rawEnd = String(event.endStr || '').slice(0, 10) || isoDate(event.end);
      end = event.allDay === false ? rawEnd : shiftIso(rawEnd, -1);
    }

    return { start, end: end || start };
  }

  function isConfirmedBoarding(event) {
    const props = event?.extendedProps || {};
    return props.isMeetGreet !== true && props.isPotential !== true;
  }

  function confirmedCountForDate(events, dateIso) {
    return events.filter(event => {
      if (!isConfirmedBoarding(event)) return false;
      const dates = eventDates(event);
      return !!dates.start && dates.start <= dateIso && dateIso <= dates.end;
    }).length;
  }

  function healthForCount(count) {
    if (count >= RED_AT) return { tone: 'red', label: 'Full' };
    if (count >= AMBER_AT) return { tone: 'amber', label: 'Busy' };
    return { tone: 'green', label: 'Available' };
  }

  function currentGridStart() {
    const calendar = adapter();
    let current = null;
    try { current = calendar?.getDate?.(); } catch (_) {}
    if (!(current instanceof Date) || Number.isNaN(current.getTime())) current = new Date();

    const first = new Date(current.getFullYear(), current.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return gridStart;
  }

  function ensureStyle() {
    if (document.getElementById('v11168CapacityHealthStyle')) return;

    const style = document.createElement('style');
    style.id = 'v11168CapacityHealthStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date {
        justify-content:flex-start !important;
      }
      body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health {
        width:9px;
        height:9px;
        flex:0 0 9px;
        margin-left:auto;
        border-radius:50%;
        border:1px solid rgba(255,255,255,.7);
        box-shadow:0 0 0 2px rgba(15,23,42,.07);
      }
      body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health[data-tone="green"] {
        background:#22c55e;
      }
      body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health[data-tone="amber"] {
        background:#f59e0b;
      }
      body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health[data-tone="red"] {
        background:#ef4444;
      }
      body.dark-theme[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health {
        border-color:rgba(255,255,255,.22);
        box-shadow:0 0 0 2px rgba(255,255,255,.04);
      }
      @media(max-width:700px) {
        body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health {
          width:8px;
          height:8px;
          flex-basis:8px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function apply() {
    scheduled = 0;
    if (!isCalendarPage()) return;

    ensureStyle();

    const host = document.getElementById('wh65Calendar');
    const calendar = adapter();
    if (!host || !calendar?.getEvents) return;

    const cells = Array.from(host.querySelectorAll('.wh65-date'));
    if (!cells.length) return;

    const events = calendar.getEvents();
    const gridStart = currentGridStart();

    cells.forEach((cell, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const dateIso = isoDate(date);
      const count = confirmedCountForDate(events, dateIso);
      const health = healthForCount(count);

      let marker = cell.querySelector('.wh68-capacity-health');
      if (!marker) {
        marker = document.createElement('span');
        marker.className = 'wh68-capacity-health';
        cell.appendChild(marker);
      }

      marker.dataset.tone = health.tone;
      marker.dataset.confirmedCount = String(count);
      marker.title = `${health.label} capacity · ${count} confirmed boarding dog${count === 1 ? '' : 's'}`;
      marker.setAttribute('aria-label', marker.title);
      marker.setAttribute('role', 'img');
    });
  }

  function scheduleApply() {
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(apply);
  }

  function observe() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;

    observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation =>
        Array.from(mutation.addedNodes || []).some(node => {
          if (!(node instanceof Element)) return false;
          return node.id === 'wh65Calendar' ||
            node.classList?.contains('wh65-date') ||
            node.classList?.contains('wh65-week') ||
            !!node.querySelector?.('.wh65-date');
        })
      );
      if (relevant) scheduleApply();
    });

    observer.observe(document.body, { childList:true, subtree:true });
  }

  function bindAdapter() {
    const calendar = adapter();
    if (!calendar || calendar._wh68CapacityHealthBound || typeof calendar.on !== 'function') return;
    calendar._wh68CapacityHealthBound = true;

    ['eventsSet', 'eventAdd', 'eventChange', 'eventRemove', 'datesSet'].forEach(name => {
      try { calendar.on(name, scheduleApply); } catch (_) {}
    });
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyle();
    observe();

    [100, 300, 700, 1400, 2600, 5000].forEach(delay => setTimeout(() => {
      bindAdapter();
      apply();
    }, delay));

    window.addEventListener('pageshow', scheduleApply);
    window.addEventListener('focus', scheduleApply);
    window.v11168CapacityHealthVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
