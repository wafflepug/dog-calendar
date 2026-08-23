/* ============================================================
   WAFFLE HOUSE V11.1.63 — STAY TIMELINE CALENDAR
   ============================================================
   Rebuilds Calendar month view around the stay itself:
   - every confirmed dog is a continuous, colour-coded arrival → departure bar;
   - FullCalendar rows act as reusable stay lanes;
   - Meet & Greets are prominent timed badges: "Time - Dog Name";
   - Potential Stays remain visible as dashed amber timelines;
   - filters, search, capacity cues and Calendar modals share one UI language;
   - clicking a date opens a read-only operational day sheet, never the retired
     "Add to this date" chooser.

   Existing event sources, eventClick editing, drag/drop persistence and Google
   Sheet sync remain authoritative. This layer changes presentation only.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.63';
  const FULL_CAPACITY = 4;
  const FILTER_STORAGE_KEY = 'waffle-calendar-filter-v11163';
  const DOG_PALETTE = [
    '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#0f766e', '#15803d',
    '#4f46e5', '#9333ea', '#be123c', '#0369a1', '#047857', '#6d28d9',
    '#1d4ed8', '#a21caf', '#b91c1c', '#0e7490'
  ];

  let calendar = null;
  let activeFilter = readSavedFilter();
  let searchTerm = '';
  let laneByEventKey = new Map();
  let applyingVisibility = false;
  let renderTimer = 0;
  let observer = null;
  let authoritativeDateClick = null;
  let priorEventDidMount = null;
  let priorEventClassNames = null;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isCalendarPage() {
    return pageName() === 'calendar';
  }

  function getCalendar() {
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar) return globalCalendar;
    } catch (_) {}
    return window.globalCalendar || null;
  }

  function readSavedFilter() {
    try {
      const value = localStorage.getItem(FILTER_STORAGE_KEY);
      return ['all', 'boarding', 'meet', 'potential'].includes(value) ? value : 'all';
    } catch (_) {
      return 'all';
    }
  }

  function saveFilter(value) {
    try { localStorage.setItem(FILTER_STORAGE_KEY, value); } catch (_) {}
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

  function dogName(event) {
    const props = event?.extendedProps || {};
    return String(props.dogName || event?.title || 'Guest')
      .replace(/^.*Meet\s*&\s*Greet:\s*/i, '')
      .replace(/^.*Potential(?:\s+Stay)?:\s*/i, '')
      .replace(/^⏰\s*[^-]+-\s*/i, '')
      .trim() || 'Guest';
  }

  function eventTime(event) {
    const direct = String(event?.extendedProps?.time || '').trim();
    if (direct) return formatClock(direct);
    if (event?.start && event.allDay === false) {
      try {
        return event.start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
      } catch (_) {}
    }
    return 'TBC';
  }

  function formatClock(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return text || 'TBC';
    const hours = Number(match[1]);
    const minutes = match[2];
    if (!Number.isFinite(hours)) return text;
    const suffix = hours >= 12 ? 'pm' : 'am';
    const hour = hours % 12 || 12;
    return `${hour}:${minutes}${suffix}`;
  }

  function eventKey(event) {
    const dates = eventDates(event);
    return [
      eventType(event),
      String(event?.id || ''),
      dogName(event).toLowerCase(),
      dates.start,
      dates.end,
      eventTime(event)
    ].join('|');
  }

  function activeOn(event, date) {
    const dates = eventDates(event);
    if (!dates.start) return false;
    if (eventType(event) === 'meet') return dates.start === date;
    return dates.start <= date && date <= dates.end;
  }

  function intersectsRange(event, start, endInclusive) {
    const dates = eventDates(event);
    if (!dates.start) return false;
    const end = dates.end || dates.start;
    return dates.start <= endInclusive && end >= start;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function dateLabel(iso) {
    const parts = String(iso || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function shortDate(iso) {
    const parts = String(iso || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short'
    });
  }

  function dogColour(name) {
    const text = String(name || 'Guest').toLowerCase();
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return DOG_PALETTE[Math.abs(hash >>> 0) % DOG_PALETTE.length];
  }

  function ensureStyles() {
    if (document.getElementById('v11163CalendarStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11163CalendarStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] {
        --wh63-surface: #ffffff;
        --wh63-surface-2: #f8fafc;
        --wh63-surface-3: #eef2f7;
        --wh63-line: #dbe3ed;
        --wh63-text: #172033;
        --wh63-muted: #64748b;
        --wh63-accent: #0f79a9;
        --wh63-meet: #0f766e;
        --wh63-meet-soft: #ccfbf1;
        --wh63-potential: #d97706;
        --wh63-potential-soft: #fff7ed;
      }
      body[data-waffle-page="calendar"].dark-theme {
        --wh63-surface: #172033;
        --wh63-surface-2: #1b2940;
        --wh63-surface-3: #22304a;
        --wh63-line: #334155;
        --wh63-text: #f8fafc;
        --wh63-muted: #a9b6c9;
        --wh63-accent: #38bdf8;
        --wh63-meet: #14b8a6;
        --wh63-meet-soft: rgba(20,184,166,.14);
        --wh63-potential: #f59e0b;
        --wh63-potential-soft: rgba(245,158,11,.12);
      }

      body[data-waffle-page="calendar"] #v11161CalendarLegend,
      body[data-waffle-page="calendar"] #calendarEventLegend,
      body[data-waffle-page="calendar"] #v11161DayModal,
      body[data-waffle-page="calendar"] #v1088DateChoiceModal,
      body[data-waffle-page="calendar"] .v11161-day-summary,
      body[data-waffle-page="calendar"] .wh63-retired-filter,
      body[data-waffle-page="calendar"] .search-container.wh63-retired-search {
        display: none !important;
      }

      body[data-waffle-page="calendar"] #calendar {
        overflow: hidden;
        border: 1px solid var(--wh63-line);
        border-radius: 18px;
        background: var(--wh63-surface);
        color: var(--wh63-text);
      }
      body[data-waffle-page="calendar"] #calendar .fc-theme-standard td,
      body[data-waffle-page="calendar"] #calendar .fc-theme-standard th,
      body[data-waffle-page="calendar"] #calendar .fc-scrollgrid {
        border-color: var(--wh63-line) !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-toolbar.fc-header-toolbar {
        margin: 0 !important;
        padding: 16px 18px;
        border-bottom: 1px solid var(--wh63-line);
        background: var(--wh63-surface);
      }
      body[data-waffle-page="calendar"] #calendar .fc-toolbar-title {
        color: var(--wh63-text);
        font-size: clamp(18px, 2vw, 24px) !important;
        font-weight: 900;
        letter-spacing: -.02em;
      }
      body[data-waffle-page="calendar"] #calendar .fc-button-primary {
        border: 1px solid var(--wh63-line) !important;
        border-radius: 9px !important;
        background: var(--wh63-surface-3) !important;
        color: var(--wh63-text) !important;
        box-shadow: none !important;
        font-weight: 800 !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-button-primary:hover,
      body[data-waffle-page="calendar"] #calendar .fc-button-primary:focus {
        border-color: color-mix(in srgb, var(--wh63-accent) 55%, var(--wh63-line)) !important;
        background: color-mix(in srgb, var(--wh63-accent) 11%, var(--wh63-surface-3)) !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-col-header-cell {
        background: var(--wh63-surface-2);
      }
      body[data-waffle-page="calendar"] #calendar .fc-col-header-cell-cushion {
        padding: 11px 6px !important;
        color: var(--wh63-muted);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .06em;
        text-transform: uppercase;
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-frame {
        min-height: 136px;
        padding-bottom: 7px;
      }
      body[data-waffle-page="calendar"] #calendar .fc-day-other {
        background: color-mix(in srgb, var(--wh63-surface-2) 62%, transparent);
      }
      body[data-waffle-page="calendar"] #calendar .fc-day-today {
        background: color-mix(in srgb, var(--wh63-accent) 7%, var(--wh63-surface)) !important;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--wh63-accent) 42%, transparent);
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-top {
        min-height: 34px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 7px 3px;
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-number {
        padding: 0 !important;
        color: var(--wh63-text);
        font-size: 11px;
        font-weight: 900;
      }
      body[data-waffle-page="calendar"] #calendar .fc-day-other .fc-daygrid-day-number {
        color: var(--wh63-muted);
      }
      body[data-waffle-page="calendar"] #calendar .capacity-indicator {
        display: none !important;
      }
      .wh63-capacity {
        margin-left: auto;
        min-width: 22px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 0 6px;
        border: 1px solid var(--wh63-line);
        border-radius: 999px;
        background: var(--wh63-surface-2);
        color: var(--wh63-muted);
        font-size: 8px;
        font-weight: 900;
        line-height: 1;
      }
      .wh63-capacity[data-tone="busy"] { border-color: #f59e0b; color: #b45309; background: #fffbeb; }
      .wh63-capacity[data-tone="full"] { border-color: #ef4444; color: #b91c1c; background: #fef2f2; }
      body.dark-theme .wh63-capacity[data-tone="busy"] { color: #fbbf24; background: rgba(245,158,11,.1); }
      body.dark-theme .wh63-capacity[data-tone="full"] { color: #f87171; background: rgba(239,68,68,.1); }

      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-events {
        display: block !important;
        min-height: 1px;
        margin: 0 !important;
        padding: 0 3px 1px;
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-event-harness {
        margin-top: 4px !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-event {
        min-height: 24px;
        margin: 0 !important;
        border-radius: 7px !important;
        overflow: hidden;
        box-shadow: none !important;
      }
      body[data-waffle-page="calendar"] #calendar .fc-event-main {
        min-width: 0;
      }
      body[data-waffle-page="calendar"] #calendar .wh63-event--boarding {
        background: var(--wh63-event-colour) !important;
        border: 1px solid color-mix(in srgb, var(--wh63-event-colour) 80%, #ffffff 20%) !important;
        color: #fff !important;
      }
      body[data-waffle-page="calendar"] #calendar .wh63-event--boarding.wh63-cont-left {
        border-top-left-radius: 2px !important;
        border-bottom-left-radius: 2px !important;
      }
      body[data-waffle-page="calendar"] #calendar .wh63-event--boarding.wh63-cont-right {
        border-top-right-radius: 2px !important;
        border-bottom-right-radius: 2px !important;
      }
      .wh63-stay-content {
        height: 22px;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 0 7px;
        color: #fff;
        font-size: 9px;
        font-weight: 900;
        line-height: 1;
      }
      .wh63-stay-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wh63-arrival,
      .wh63-departure {
        flex: 0 0 auto;
        width: 14px;
        height: 14px;
        display: inline-grid;
        place-items: center;
        border-radius: 50%;
        background: rgba(255,255,255,.18);
        font-size: 8px;
      }
      .wh63-departure { margin-left: auto; }
      .wh63-continuation {
        flex: 0 0 auto;
        opacity: .55;
        font-size: 8px;
      }

      body[data-waffle-page="calendar"] #calendar .wh63-event--meet {
        min-height: 31px;
        border: 1px solid color-mix(in srgb, var(--wh63-meet) 80%, #ffffff 20%) !important;
        border-radius: 9px !important;
        background: var(--wh63-meet) !important;
        color: #fff !important;
        box-shadow: 0 4px 12px rgba(15,118,110,.18) !important;
      }
      .wh63-meet-content {
        min-height: 29px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 8px;
        color: #fff;
        font-size: 9px;
        font-weight: 950;
        white-space: nowrap;
        overflow: hidden;
      }
      .wh63-meet-content span:last-child {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .wh63-meet-icon {
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
        display: inline-grid;
        place-items: center;
        border-radius: 6px;
        background: rgba(255,255,255,.18);
        font-size: 10px;
      }

      body[data-waffle-page="calendar"] #calendar .wh63-event--potential {
        min-height: 24px;
        border: 1.5px dashed var(--wh63-potential) !important;
        border-radius: 7px !important;
        background: var(--wh63-potential-soft) !important;
        color: var(--wh63-potential) !important;
      }
      .wh63-potential-content {
        height: 21px;
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 0 7px;
        color: inherit;
        font-size: 9px;
        font-weight: 900;
        white-space: nowrap;
        overflow: hidden;
      }
      .wh63-potential-content span:last-child {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .wh63-filterbar {
        margin: 0 0 12px;
        display: grid;
        grid-template-columns: minmax(0,1fr) auto;
        gap: 12px 16px;
        align-items: center;
        padding: 12px;
        border: 1px solid var(--wh63-line);
        border-radius: 14px;
        background: var(--wh63-surface);
        color: var(--wh63-text);
      }
      .wh63-filter-main {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .wh63-filter-title {
        display: grid;
        gap: 1px;
        padding: 0 4px;
      }
      .wh63-filter-title small {
        color: var(--wh63-accent);
        font-size: 8px;
        font-weight: 950;
        letter-spacing: .08em;
      }
      .wh63-filter-title strong {
        font-size: 12px;
        font-weight: 950;
      }
      .wh63-filter-group {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .wh63-filter {
        min-height: 34px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px;
        border: 1px solid var(--wh63-line);
        border-radius: 999px;
        background: var(--wh63-surface-2);
        color: var(--wh63-text);
        cursor: pointer;
        font-size: 9px;
        font-weight: 900;
        transition: border-color .16s ease, background .16s ease, transform .16s ease;
      }
      .wh63-filter:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--wh63-accent) 55%, var(--wh63-line)); }
      .wh63-filter.is-active {
        border-color: color-mix(in srgb, var(--wh63-accent) 55%, var(--wh63-line));
        background: color-mix(in srgb, var(--wh63-accent) 12%, var(--wh63-surface-2));
        color: var(--wh63-text);
      }
      .wh63-filter-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--wh63-muted); }
      .wh63-filter[data-wh63-filter="boarding"] .wh63-filter-dot { background: #4f46e5; }
      .wh63-filter[data-wh63-filter="meet"] .wh63-filter-dot { background: var(--wh63-meet); }
      .wh63-filter[data-wh63-filter="potential"] .wh63-filter-dot { background: var(--wh63-potential); }
      .wh63-filter-count {
        min-width: 18px;
        height: 18px;
        display: inline-grid;
        place-items: center;
        padding: 0 5px;
        border-radius: 999px;
        background: var(--wh63-surface-3);
        color: var(--wh63-muted);
        font-size: 8px;
      }
      .wh63-filter-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }
      .wh63-search-wrap {
        min-width: 190px;
        display: flex;
        align-items: center;
        gap: 7px;
        height: 36px;
        padding: 0 10px;
        border: 1px solid var(--wh63-line);
        border-radius: 10px;
        background: var(--wh63-surface-2);
      }
      .wh63-search-wrap input {
        width: 150px;
        min-width: 0;
        border: 0 !important;
        outline: 0 !important;
        background: transparent !important;
        color: var(--wh63-text) !important;
        font: inherit;
        font-size: 10px;
      }
      .wh63-search-wrap input::placeholder { color: var(--wh63-muted); }
      #manualRefreshBtn.wh63-sync-button {
        min-height: 36px !important;
        margin: 0 !important;
        padding: 0 12px !important;
        border: 1px solid color-mix(in srgb, var(--wh63-accent) 55%, var(--wh63-line)) !important;
        border-radius: 10px !important;
        background: color-mix(in srgb, var(--wh63-accent) 14%, var(--wh63-surface-2)) !important;
        color: var(--wh63-text) !important;
        box-shadow: none !important;
        font-size: 9px !important;
        font-weight: 900 !important;
      }
      .wh63-filter-help {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 4px;
        color: var(--wh63-muted);
        font-size: 8px;
        font-weight: 700;
      }
      .wh63-filter-help i {
        width: 18px;
        height: 5px;
        border-radius: 999px;
        background: linear-gradient(90deg, #2563eb, #7c3aed, #db2777);
      }

      .wh63-day-modal {
        position: fixed;
        inset: 0;
        z-index: 2147482600;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(2,6,23,.7);
        backdrop-filter: blur(7px);
      }
      .wh63-day-modal[hidden] { display: none !important; }
      .wh63-day-panel {
        width: min(620px, 100%);
        max-height: min(760px, 88vh);
        overflow: auto;
        border: 1px solid var(--wh63-line);
        border-radius: 20px;
        background: var(--wh63-surface);
        color: var(--wh63-text);
        box-shadow: 0 28px 80px rgba(0,0,0,.36);
      }
      .wh63-day-head {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        padding: 18px 20px 15px;
        border-bottom: 1px solid var(--wh63-line);
        background: color-mix(in srgb, var(--wh63-surface) 94%, transparent);
        backdrop-filter: blur(12px);
      }
      .wh63-day-head small {
        display: block;
        color: var(--wh63-accent);
        font-size: 8px;
        font-weight: 950;
        letter-spacing: .09em;
      }
      .wh63-day-head h3 { margin: 3px 0 3px; font-size: 19px; font-weight: 950; }
      .wh63-day-head p { margin: 0; color: var(--wh63-muted); font-size: 10px; }
      .wh63-close {
        width: 38px;
        height: 38px;
        flex: 0 0 auto;
        border: 1px solid var(--wh63-line);
        border-radius: 50%;
        background: var(--wh63-surface-2);
        color: var(--wh63-text);
        cursor: pointer;
        font-size: 18px;
      }
      .wh63-day-body { display: grid; gap: 16px; padding: 16px 20px 20px; }
      .wh63-day-section { display: grid; gap: 8px; }
      .wh63-day-section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: var(--wh63-muted);
        font-size: 9px;
        font-weight: 950;
        letter-spacing: .04em;
        text-transform: uppercase;
      }
      .wh63-day-section-head span {
        min-width: 24px;
        height: 22px;
        display: inline-grid;
        place-items: center;
        padding: 0 6px;
        border-radius: 999px;
        background: var(--wh63-surface-3);
        color: var(--wh63-text);
        font-size: 8px;
      }
      .wh63-day-list { display: grid; gap: 7px; }
      .wh63-day-row {
        width: 100%;
        display: grid;
        grid-template-columns: 9px minmax(0,1fr) auto;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--wh63-line);
        border-radius: 12px;
        background: var(--wh63-surface-2);
        color: var(--wh63-text);
        text-align: left;
      }
      button.wh63-day-row { cursor: pointer; }
      .wh63-day-colour { width: 9px; height: 34px; border-radius: 999px; background: var(--wh63-row-colour, var(--wh63-accent)); }
      .wh63-day-copy strong { display: block; font-size: 11px; }
      .wh63-day-copy small { display: block; margin-top: 3px; color: var(--wh63-muted); font-size: 8px; }
      .wh63-day-open { color: var(--wh63-accent); font-size: 9px; font-weight: 900; }
      .wh63-day-row.meet { border-color: color-mix(in srgb, var(--wh63-meet) 42%, var(--wh63-line)); background: var(--wh63-meet-soft); }
      .wh63-day-row.potential { border-style: dashed; border-color: color-mix(in srgb, var(--wh63-potential) 55%, var(--wh63-line)); background: var(--wh63-potential-soft); }
      .wh63-day-empty {
        padding: 18px;
        border: 1px dashed var(--wh63-line);
        border-radius: 12px;
        color: var(--wh63-muted);
        text-align: center;
        font-size: 10px;
      }

      body[data-waffle-page="calendar"] #customBookingModal.wh63-legacy-modal,
      body[data-waffle-page="calendar"] #potentialStayModal.wh63-legacy-modal,
      body[data-waffle-page="calendar"] #v108BoardingModal {
        background: rgba(2,6,23,.7) !important;
        backdrop-filter: blur(7px);
      }
      body[data-waffle-page="calendar"] #customBookingModal .modal-content-panel,
      body[data-waffle-page="calendar"] #potentialStayModal .modal-content-panel,
      body[data-waffle-page="calendar"] #v108BoardingModal .v108-modal-card {
        position: relative;
        max-height: 88vh;
        overflow: auto;
        border: 1px solid var(--wh63-line) !important;
        border-radius: 18px !important;
        background: var(--wh63-surface) !important;
        color: var(--wh63-text) !important;
        box-shadow: 0 28px 80px rgba(0,0,0,.36) !important;
      }
      body[data-waffle-page="calendar"] #customBookingModal .modal-content-panel { max-width: 460px !important; padding: 24px !important; }
      body[data-waffle-page="calendar"] #potentialStayModal .modal-content-panel { max-width: 560px !important; padding: 24px !important; }
      body[data-waffle-page="calendar"] #customBookingModal h3,
      body[data-waffle-page="calendar"] #potentialStayModal h3,
      body[data-waffle-page="calendar"] #v108BoardingModal h3 {
        color: var(--wh63-text) !important;
        font-weight: 950 !important;
        letter-spacing: -.01em;
      }
      body[data-waffle-page="calendar"] #customBookingModal label,
      body[data-waffle-page="calendar"] #potentialStayModal label,
      body[data-waffle-page="calendar"] #v108BoardingModal label {
        color: var(--wh63-muted) !important;
        font-size: 9px !important;
        font-weight: 900 !important;
        letter-spacing: .02em;
      }
      body[data-waffle-page="calendar"] #customBookingModal input,
      body[data-waffle-page="calendar"] #potentialStayModal input,
      body[data-waffle-page="calendar"] #potentialStayModal textarea,
      body[data-waffle-page="calendar"] #v108BoardingModal input,
      body[data-waffle-page="calendar"] #v108BoardingModal textarea,
      body[data-waffle-page="calendar"] #v108BoardingModal select {
        border: 1px solid var(--wh63-line) !important;
        border-radius: 10px !important;
        background: var(--wh63-surface-2) !important;
        color: var(--wh63-text) !important;
        box-shadow: none !important;
      }
      body[data-waffle-page="calendar"] #customBookingModal input:focus,
      body[data-waffle-page="calendar"] #potentialStayModal input:focus,
      body[data-waffle-page="calendar"] #potentialStayModal textarea:focus,
      body[data-waffle-page="calendar"] #v108BoardingModal input:focus,
      body[data-waffle-page="calendar"] #v108BoardingModal textarea:focus,
      body[data-waffle-page="calendar"] #v108BoardingModal select:focus {
        outline: 2px solid color-mix(in srgb, var(--wh63-accent) 35%, transparent) !important;
        border-color: var(--wh63-accent) !important;
      }
      body[data-waffle-page="calendar"] .v1088-modal-kicker,
      body[data-waffle-page="calendar"] .wh63-modal-kicker {
        display: inline-block;
        margin-bottom: 5px;
        color: var(--wh63-accent) !important;
        font-size: 8px !important;
        font-weight: 950 !important;
        letter-spacing: .09em;
      }
      body[data-waffle-page="calendar"] .v1088-modal-x {
        top: 14px !important;
        right: 14px !important;
        width: 34px !important;
        height: 34px !important;
        border: 1px solid var(--wh63-line) !important;
        border-radius: 50% !important;
        background: var(--wh63-surface-2) !important;
        color: var(--wh63-text) !important;
      }
      body[data-waffle-page="calendar"] #customBookingModal button,
      body[data-waffle-page="calendar"] #potentialStayModal button,
      body[data-waffle-page="calendar"] #v108BoardingModal button {
        border-radius: 10px !important;
        font-weight: 900 !important;
      }

      @media (max-width: 900px) {
        .wh63-filterbar { grid-template-columns: 1fr; }
        .wh63-filter-actions { justify-content: stretch; }
        .wh63-search-wrap { flex: 1 1 auto; min-width: 0; }
        .wh63-search-wrap input { width: 100%; }
      }
      @media (max-width: 700px) {
        .wh63-filterbar { padding: 10px; border-radius: 12px; }
        .wh63-filter-title { display: none; }
        .wh63-filter-main { gap: 7px; }
        .wh63-filter-group { flex-wrap: nowrap; width: 100%; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
        .wh63-filter-group::-webkit-scrollbar { display: none; }
        .wh63-filter { flex: 0 0 auto; min-height: 32px; padding: 0 9px; }
        .wh63-filter-actions { display: grid; grid-template-columns: minmax(0,1fr) auto; }
        .wh63-filter-help { display: none; }
        body[data-waffle-page="calendar"] #calendar { border-radius: 14px; }
        body[data-waffle-page="calendar"] #calendar .fc-toolbar.fc-header-toolbar { padding: 12px 10px; gap: 8px; flex-wrap: wrap; }
        body[data-waffle-page="calendar"] #calendar .fc-toolbar-title { font-size: 16px !important; }
        body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-frame { min-height: 96px; }
        body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-top { min-height: 28px; padding: 4px 4px 2px; }
        body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-number { font-size: 9px; }
        .wh63-capacity { min-width: 18px; height: 17px; padding: 0 4px; font-size: 7px; }
        body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-events { padding: 0 1px 1px; }
        body[data-waffle-page="calendar"] #calendar .fc-daygrid-event-harness { margin-top: 2px !important; }
        body[data-waffle-page="calendar"] #calendar .fc-daygrid-event { min-height: 19px; border-radius: 5px !important; }
        .wh63-stay-content, .wh63-potential-content { height: 17px; padding: 0 4px; gap: 3px; font-size: 7px; }
        .wh63-arrival, .wh63-departure { width: 11px; height: 11px; font-size: 6px; }
        body[data-waffle-page="calendar"] #calendar .wh63-event--meet { min-height: 23px; border-radius: 6px !important; }
        .wh63-meet-content { min-height: 21px; padding: 0 4px; gap: 3px; font-size: 7px; }
        .wh63-meet-icon { width: 14px; height: 14px; border-radius: 4px; font-size: 8px; }
        .wh63-day-modal { align-items: end; padding: 0; }
        .wh63-day-panel { width: 100%; max-height: 84vh; border-radius: 20px 20px 0 0; border-left: 0; border-right: 0; border-bottom: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function retireOldCalendarUi() {
    document.getElementById('v11161CalendarStyle')?.remove();
    document.getElementById('v11161CalendarLegend')?.remove();
    document.getElementById('v11161DayModal')?.remove();
    document.getElementById('v1088DateChoiceModal')?.remove();
    document.querySelectorAll('#calendar .v11161-day-summary').forEach(node => node.remove());
    document.querySelectorAll('#calendar .fc-daygrid-day').forEach(cell => {
      cell.classList.remove('v11161-tone-clear', 'v11161-tone-open', 'v11161-tone-busy', 'v11161-tone-full');
      cell.style.removeProperty('background-color');
      cell.querySelectorAll('.capacity-indicator').forEach(node => node.remove());
    });
    document.getElementById('calendarEventLegend')?.setAttribute('aria-hidden', 'true');
    retireLegacyFilterBars();
  }

  function retireLegacyFilterBars() {
    document.querySelectorAll([
      '.calendar-filter-bar', '.calendar-filter-chips', '.calendar-filters',
      '.v10-calendar-filters', '.v108-calendar-filters', '.v110-calendar-filters',
      '[data-calendar-filters]'
    ].join(',')).forEach(node => {
      if (!node.classList.contains('wh63-filterbar')) node.classList.add('wh63-retired-filter');
    });

    const panel = document.getElementById('calendarTabPanel');
    if (!panel) return;
    const allButtons = Array.from(panel.querySelectorAll('button'));
    const allButton = allButtons.find(button => /^all(?:\s|$)/i.test(String(button.textContent || '').trim()));
    if (!allButton) return;

    let candidate = allButton.parentElement;
    for (let depth = 0; candidate && candidate !== panel && depth < 4; depth += 1, candidate = candidate.parentElement) {
      if (candidate.classList.contains('wh63-filterbar')) return;
      const labels = Array.from(candidate.querySelectorAll('button')).map(button => String(button.textContent || '').toLowerCase());
      const hasAll = labels.some(label => /^all(?:\s|$)/.test(label.trim()));
      const hasConfirmed = labels.some(label => /confirmed|boarding/.test(label));
      const hasMeet = labels.some(label => /meet\s*&\s*greet/.test(label));
      const hasPotential = labels.some(label => /potential/.test(label));
      if (hasAll && hasConfirmed && hasMeet && hasPotential && labels.length <= 8) {
        candidate.classList.add('wh63-retired-filter');
        return;
      }
    }
  }

  function ensureFilterBar() {
    let bar = document.getElementById('wh63CalendarFilters');
    if (bar) return bar;
    const host = document.getElementById('calendar');
    if (!host) return null;

    bar = document.createElement('section');
    bar.id = 'wh63CalendarFilters';
    bar.className = 'wh63-filterbar';
    bar.setAttribute('aria-label', 'Calendar filters');
    bar.innerHTML = `
      <div class="wh63-filter-main">
        <div class="wh63-filter-title"><small>CALENDAR VIEW</small><strong>Stay timeline</strong></div>
        <div class="wh63-filter-group" role="tablist" aria-label="Filter calendar events">
          ${filterButton('all', 'All')}
          ${filterButton('boarding', 'Boarding')}
          ${filterButton('meet', 'Meet & Greet')}
          ${filterButton('potential', 'Potential')}
        </div>
      </div>
      <div class="wh63-filter-actions">
        <label class="wh63-search-wrap" aria-label="Search calendar dogs"><span aria-hidden="true">⌕</span><input type="search" data-wh63-search placeholder="Search dog" autocomplete="off"></label>
        <span data-wh63-sync-slot></span>
      </div>
      <div class="wh63-filter-help"><i aria-hidden="true"></i><span>Each colour follows one dog from arrival to departure. Empty lanes are reused by the next stay.</span></div>
    `;
    host.insertAdjacentElement('beforebegin', bar);

    bar.addEventListener('click', event => {
      const button = event.target.closest('[data-wh63-filter]');
      if (!button) return;
      activeFilter = String(button.dataset.wh63Filter || 'all');
      saveFilter(activeFilter);
      syncFilterUi();
      applyVisibility();
    });

    bar.querySelector('[data-wh63-search]')?.addEventListener('input', event => {
      searchTerm = String(event.target.value || '').trim().toLowerCase();
      applyVisibility();
    });

    const syncButton = document.getElementById('manualRefreshBtn');
    const syncSlot = bar.querySelector('[data-wh63-sync-slot]');
    if (syncButton && syncSlot) {
      syncButton.removeAttribute('style');
      syncButton.classList.add('wh63-sync-button');
      syncButton.textContent = '↻ Sync';
      syncSlot.replaceWith(syncButton);
    }

    const legacySearchContainer = document.getElementById('calendarSearch')?.closest('.search-container');
    if (legacySearchContainer) legacySearchContainer.classList.add('wh63-retired-search');

    syncFilterUi();
    return bar;
  }

  function filterButton(value, label) {
    return `<button type="button" class="wh63-filter" data-wh63-filter="${value}" role="tab" aria-selected="false"><i class="wh63-filter-dot" aria-hidden="true"></i><span>${label}</span><b class="wh63-filter-count" data-wh63-count="${value}">0</b></button>`;
  }

  function syncFilterUi() {
    document.querySelectorAll('[data-wh63-filter]').forEach(button => {
      const active = button.dataset.wh63Filter === activeFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function enhanceLegacyModal(id, kicker) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('wh63-legacy-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const panel = modal.querySelector('.modal-content-panel');
    const heading = panel?.querySelector('h3');
    if (panel && heading && !panel.querySelector('.v1088-modal-kicker,.wh63-modal-kicker')) {
      const element = document.createElement('span');
      element.className = 'wh63-modal-kicker';
      element.textContent = kicker;
      panel.insertBefore(element, heading);
    }
  }

  function enhanceCalendarModals() {
    enhanceLegacyModal('customBookingModal', 'MEET & GREET');
    enhanceLegacyModal('potentialStayModal', 'POTENTIAL STAY');
    document.getElementById('v108BoardingModal')?.classList.add('wh63-boarding-modal');
  }

  function ensureDayModal() {
    let modal = document.getElementById('wh63DayModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'wh63DayModal';
    modal.className = 'wh63-day-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <section class="wh63-day-panel" role="dialog" aria-modal="true" aria-labelledby="wh63DayTitle">
        <header class="wh63-day-head">
          <div><small>DAY AT WAFFLE HOUSE</small><h3 id="wh63DayTitle">Day details</h3><p data-wh63-day-summary></p></div>
          <button type="button" class="wh63-close" data-wh63-close aria-label="Close">×</button>
        </header>
        <div class="wh63-day-body" data-wh63-day-body></div>
      </section>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-wh63-close]')) {
        modal.hidden = true;
        return;
      }
      const row = event.target.closest('[data-wh63-event-key]');
      if (!row || !calendar) return;
      const key = row.dataset.wh63EventKey;
      const eventRecord = calendar.getEvents().find(item => eventKey(item) === key);
      if (!eventRecord) return;
      const handler = calendar.getOption('eventClick');
      if (typeof handler !== 'function') return;
      modal.hidden = true;
      try {
        handler({ event: eventRecord, el: row, jsEvent: event, view: calendar.view });
      } catch (error) {
        console.warn('Calendar event action could not be opened:', error);
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.hidden) modal.hidden = true;
    });

    return modal;
  }

  function dayEvents(date) {
    const rows = calendar ? calendar.getEvents().filter(event => activeOn(event, date)) : [];
    return {
      boarding: rows.filter(event => eventType(event) === 'boarding').sort((a, b) => (laneByEventKey.get(eventKey(a)) || 0) - (laneByEventKey.get(eventKey(b)) || 0)),
      meet: rows.filter(event => eventType(event) === 'meet').sort((a, b) => eventTime(a).localeCompare(eventTime(b))),
      potential: rows.filter(event => eventType(event) === 'potential').sort((a, b) => dogName(a).localeCompare(dogName(b)))
    };
  }

  function openDay(date) {
    const modal = ensureDayModal();
    const data = dayEvents(date);
    const boardingCount = data.boarding.length;
    modal.querySelector('#wh63DayTitle').textContent = dateLabel(date);
    modal.querySelector('[data-wh63-day-summary]').textContent = boardingCount >= FULL_CAPACITY
      ? `${boardingCount} boarded · at or above capacity`
      : `${boardingCount} boarded · ${Math.max(0, FULL_CAPACITY - boardingCount)} space${FULL_CAPACITY - boardingCount === 1 ? '' : 's'} remaining`;

    const sections = [
      daySection('Boarding', data.boarding, 'boarding'),
      daySection('Meet & Greet', data.meet, 'meet'),
      daySection('Potential', data.potential, 'potential')
    ].filter(Boolean).join('');

    modal.querySelector('[data-wh63-day-body]').innerHTML = sections || '<div class="wh63-day-empty">Nothing is scheduled for this day.</div>';
    modal.hidden = false;
    modal.querySelector('[data-wh63-close]')?.focus();
  }

  function daySection(label, rows, type) {
    if (!rows.length) return '';
    return `<section class="wh63-day-section"><div class="wh63-day-section-head"><strong>${escapeHtml(label)}</strong><span>${rows.length}</span></div><div class="wh63-day-list">${rows.map(event => dayRow(event, type)).join('')}</div></section>`;
  }

  function dayRow(event, type) {
    const dates = eventDates(event);
    const clickable = calendar && typeof calendar.getOption('eventClick') === 'function';
    const tag = clickable ? 'button' : 'div';
    const action = clickable ? ` type="button" data-wh63-event-key="${escapeHtml(eventKey(event))}"` : '';
    const colour = type === 'boarding' ? dogColour(dogName(event)) : type === 'meet' ? 'var(--wh63-meet)' : 'var(--wh63-potential)';
    const detail = type === 'meet'
      ? `${eventTime(event)} - ${dogName(event)}`
      : type === 'potential'
        ? `Potential · ${shortDate(dates.start)} → ${shortDate(dates.end)}`
        : `Arrives ${shortDate(dates.start)} · Departs ${shortDate(dates.end)}`;
    const rowClass = type === 'meet' ? ' meet' : type === 'potential' ? ' potential' : '';
    return `<${tag} class="wh63-day-row${rowClass}"${action} style="--wh63-row-colour:${colour}"><i class="wh63-day-colour" aria-hidden="true"></i><div class="wh63-day-copy"><strong>${escapeHtml(dogName(event))}</strong><small>${escapeHtml(detail)}</small></div><span class="wh63-day-open">${clickable ? 'Open ›' : ''}</span></${tag}>`;
  }

  function rebuildLanes() {
    if (!calendar) return;
    const events = calendar.getEvents()
      .filter(event => eventType(event) === 'boarding')
      .map(event => ({ event, dates: eventDates(event) }))
      .filter(item => item.dates.start)
      .sort((a, b) => a.dates.start.localeCompare(b.dates.start) || a.dates.end.localeCompare(b.dates.end) || dogName(a.event).localeCompare(dogName(b.event)));

    const laneEnds = [];
    const nextMap = new Map();
    events.forEach(item => {
      let lane = laneEnds.findIndex(end => end < item.dates.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = item.dates.end;
      nextMap.set(eventKey(item.event), lane);
    });
    laneByEventKey = nextMap;
  }

  function compareEvents(a, b) {
    const typeA = eventType(a);
    const typeB = eventType(b);
    const rank = { boarding: 0, meet: 1, potential: 2 };
    if (rank[typeA] !== rank[typeB]) return rank[typeA] - rank[typeB];
    if (typeA === 'boarding') {
      const laneA = laneByEventKey.get(eventKey(a)) ?? 999;
      const laneB = laneByEventKey.get(eventKey(b)) ?? 999;
      if (laneA !== laneB) return laneA - laneB;
    }
    if (typeA === 'meet') {
      const timeOrder = eventTime(a).localeCompare(eventTime(b));
      if (timeOrder) return timeOrder;
    }
    return dogName(a).localeCompare(dogName(b));
  }

  function legacyClassNames(arg) {
    if (typeof priorEventClassNames !== 'function') return [];
    try {
      const value = priorEventClassNames(arg);
      return Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    } catch (_) {
      return [];
    }
  }

  function classNames(arg) {
    const type = eventType(arg.event);
    return [
      ...legacyClassNames(arg),
      'wh63-event',
      `wh63-event--${type}`,
      arg.isStart ? 'wh63-seg-start' : 'wh63-cont-left',
      arg.isEnd ? 'wh63-seg-end' : 'wh63-cont-right'
    ];
  }

  function eventContent(arg) {
    const type = eventType(arg.event);
    const name = escapeHtml(dogName(arg.event));
    if (type === 'meet') {
      return { html: `<span class="wh63-meet-content"><i class="wh63-meet-icon" aria-hidden="true">🤝</i><span>${escapeHtml(eventTime(arg.event))} - ${name}</span></span>` };
    }
    if (type === 'potential') {
      return { html: `<span class="wh63-potential-content"><b aria-hidden="true">?</b><span>${name}</span></span>` };
    }
    const arrival = arg.isStart ? '<i class="wh63-arrival" aria-label="Arrival">↓</i>' : '<i class="wh63-continuation" aria-hidden="true">•</i>';
    const departure = arg.isEnd ? '<i class="wh63-departure" aria-label="Departure">↑</i>' : '';
    return { html: `<span class="wh63-stay-content">${arrival}<span class="wh63-stay-name">${name}</span>${departure}</span>` };
  }

  function eventDidMount(arg) {
    try { if (typeof priorEventDidMount === 'function') priorEventDidMount(arg); } catch (_) {}
    const type = eventType(arg.event);
    if (type === 'boarding') arg.el.style.setProperty('--wh63-event-colour', dogColour(dogName(arg.event)));
    const dates = eventDates(arg.event);
    const title = type === 'meet'
      ? `${eventTime(arg.event)} - ${dogName(arg.event)}`
      : type === 'potential'
        ? `Potential · ${dogName(arg.event)} · ${shortDate(dates.start)} → ${shortDate(dates.end)}`
        : `${dogName(arg.event)} · arrives ${shortDate(dates.start)} · departs ${shortDate(dates.end)}`;
    arg.el.setAttribute('title', title);
    arg.el.setAttribute('aria-label', title);
  }

  function installDateClickGuard() {
    if (!calendar || calendar._wh63DateClickGuarded) return;
    const originalSetOption = calendar.setOption.bind(calendar);
    calendar._wh63DateClickGuarded = true;
    calendar._wh63OriginalSetOption = originalSetOption;
    calendar.setOption = function(name, value) {
      if (name === 'dateClick' && window.v11163CalendarTimelineVersion && value !== authoritativeDateClick) {
        return undefined;
      }
      return originalSetOption(name, value);
    };
  }

  function setCalendarOption(name, value) {
    if (!calendar) return;
    if (name === 'dateClick' && calendar._wh63OriginalSetOption) {
      calendar._wh63OriginalSetOption(name, value);
      return;
    }
    calendar.setOption(name, value);
  }

  function installCalendarOptions() {
    priorEventClassNames = calendar.getOption('eventClassNames');
    priorEventDidMount = calendar.getOption('eventDidMount');
    authoritativeDateClick = info => {
      info?.jsEvent?.preventDefault?.();
      document.getElementById('v1088DateChoiceModal')?.remove();
      openDay(String(info?.dateStr || isoDate(info?.date)));
    };

    installDateClickGuard();
    setCalendarOption('displayEventTime', false);
    setCalendarOption('dayMaxEvents', false);
    setCalendarOption('dayMaxEventRows', false);
    setCalendarOption('eventOrderStrict', true);
    setCalendarOption('eventOrder', compareEvents);
    setCalendarOption('eventClassNames', classNames);
    setCalendarOption('eventContent', eventContent);
    setCalendarOption('eventDidMount', eventDidMount);
    setCalendarOption('dateClick', authoritativeDateClick);
  }

  function eventMatches(event) {
    const type = eventType(event);
    if (activeFilter !== 'all' && activeFilter !== type) return false;
    if (!searchTerm) return true;
    const props = event?.extendedProps || {};
    const haystack = [dogName(event), props.breed, props.ownerName].join(' ').toLowerCase();
    return haystack.includes(searchTerm);
  }

  function applyVisibility() {
    if (!calendar || applyingVisibility) return;
    applyingVisibility = true;
    try {
      const events = calendar.getEvents();
      const action = () => {
        events.forEach(event => {
          const desired = eventMatches(event) ? 'block' : 'none';
          if (String(event.display || '') !== desired) event.setProp('display', desired);
        });
      };
      if (typeof calendar.batchRendering === 'function') calendar.batchRendering(action);
      else action();
    } finally {
      applyingVisibility = false;
    }
    scheduleDecorations();
  }

  function updateFilterCounts() {
    if (!calendar?.view) return;
    const start = isoDate(calendar.view.activeStart);
    const end = shiftDay(isoDate(calendar.view.activeEnd), -1);
    const visibleRangeEvents = calendar.getEvents().filter(event => intersectsRange(event, start, end));
    const counts = {
      all: visibleRangeEvents.length,
      boarding: visibleRangeEvents.filter(event => eventType(event) === 'boarding').length,
      meet: visibleRangeEvents.filter(event => eventType(event) === 'meet').length,
      potential: visibleRangeEvents.filter(event => eventType(event) === 'potential').length
    };
    Object.entries(counts).forEach(([key, value]) => {
      const node = document.querySelector(`[data-wh63-count="${key}"]`);
      if (node) node.textContent = String(value);
    });
  }

  function renderCapacityBadges() {
    if (!calendar) return;
    document.querySelectorAll('#calendar .fc-daygrid-day[data-date]').forEach(cell => {
      const date = String(cell.dataset.date || '');
      if (!date) return;
      cell.style.removeProperty('background-color');
      cell.querySelectorAll('.capacity-indicator,.wh63-capacity').forEach(node => node.remove());
      const count = calendar.getEvents().filter(event => eventType(event) === 'boarding' && activeOn(event, date)).length;
      if (!count) return;
      const top = cell.querySelector('.fc-daygrid-day-top');
      if (!top) return;
      const badge = document.createElement('span');
      badge.className = 'wh63-capacity';
      badge.dataset.tone = count >= FULL_CAPACITY ? 'full' : count === FULL_CAPACITY - 1 ? 'busy' : 'open';
      badge.textContent = `🐾 ${count}`;
      badge.title = `${count} boarded dog${count === 1 ? '' : 's'} on ${dateLabel(date)}`;
      top.appendChild(badge);
    });
  }

  function decorate() {
    renderTimer = 0;
    if (!calendar) return;
    retireOldCalendarUi();
    ensureFilterBar();
    enhanceCalendarModals();
    rebuildLanes();
    updateFilterCounts();
    renderCapacityBadges();
    syncFilterUi();
  }

  function scheduleDecorations() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => requestAnimationFrame(decorate), 30);
  }

  function bindCalendarEvents() {
    if (!calendar || calendar._wh63Bound || typeof calendar.on !== 'function') return;
    calendar._wh63Bound = true;
    ['eventsSet', 'datesSet', 'eventAdd', 'eventChange', 'eventRemove'].forEach(name => {
      try {
        calendar.on(name, () => {
          if (name === 'eventsSet' && applyingVisibility) return;
          rebuildLanes();
          if (!applyingVisibility) applyVisibility();
          scheduleDecorations();
        });
      } catch (_) {}
    });
  }

  function bindObserver() {
    if (observer || typeof MutationObserver !== 'function' || !document.body) return;
    observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => Array.from(mutation.addedNodes || []).some(node => {
        if (!(node instanceof Element)) return false;
        return node.id === 'v1088DateChoiceModal' ||
          node.id === 'customBookingModal' ||
          node.id === 'potentialStayModal' ||
          node.matches?.('.fc-daygrid-day,.fc-event') ||
          !!node.querySelector?.('#v1088DateChoiceModal,#customBookingModal,#potentialStayModal,.fc-daygrid-day,.fc-event');
      }));
      if (relevant) scheduleDecorations();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function attach() {
    const ref = getCalendar();
    if (!ref || typeof ref.getEvents !== 'function' || typeof ref.setOption !== 'function') return false;
    calendar = ref;
    window.v11163CalendarTimelineVersion = VERSION;
    ensureStyles();
    retireOldCalendarUi();
    ensureFilterBar();
    ensureDayModal();
    enhanceCalendarModals();
    rebuildLanes();
    installCalendarOptions();
    bindCalendarEvents();
    bindObserver();
    applyVisibility();
    scheduleDecorations();

    [80, 220, 520, 1000, 1800, 3200, 5200].forEach(delay => setTimeout(() => {
      if (!calendar) return;
      setCalendarOption('dateClick', authoritativeDateClick);
      retireOldCalendarUi();
      scheduleDecorations();
    }, delay));

    window.addEventListener('resize', scheduleDecorations, { passive: true });
    window.addEventListener('pageshow', scheduleDecorations);
    window.addEventListener('focus', scheduleDecorations);
    return true;
  }

  function start() {
    if (!isCalendarPage()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attach() || attempts > 100) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
