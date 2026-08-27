/* ============================================================
   WAFFLE HOUSE — CANONICAL CALENDAR MODULE
   Build 2026.08.27.03 · Canonical Source Consolidation Phase 2
   ------------------------------------------------------------
   This is the only active Calendar feature module. It contains the proven
   Calendar behavior formerly executed through nine separate V11.1.x files.

   The historical source files remain in the repository for rollback during
   Phase 2, but the active runtime must not request them individually.
   ============================================================ */
(function () {
  'use strict';
  window.WAFFLE_CALENDAR_CANONICAL_SOURCES = Object.freeze(["waffle-v11.1.69.js", "waffle-v11.1.66.js", "waffle-v11.1.67.js", "waffle-v11.1.68.js", "waffle-v11.1.70.js", "waffle-v11.1.71.js", "waffle-v11.1.72.js", "waffle-v11.1.73.js", "waffle-v11.1.84.js"]);
})();


/* ============================================================
   CANONICAL CALENDAR SOURCE · waffle-v11.1.69.js
   Preserved in proven historical execution order.
   ============================================================ */
/* ============================================================
   WAFFLE HOUSE V11.1.69 — CALENDAR RANGE VIEWS
   ============================================================
   One visible Calendar with three range choices:
     Month (default) · Fortnight · Week

   FullCalendar is no longer a visible UI. It remains hidden only as the
   existing data/editing adapter. Every Confirmed Stay, Potential Stay and
   Meet & Greet remains visible with unlimited vertical lanes in every view.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.69';
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const DOG_PALETTE = [
    '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#0f766e', '#15803d',
    '#4f46e5', '#9333ea', '#be123c', '#0369a1', '#047857', '#6d28d9',
    '#1d4ed8', '#a21caf', '#b91c1c', '#0e7490', '#c2410c', '#4338ca'
  ];

  let adapter = null;
  let viewMode = 'month';
  let anchorDate = new Date();
  let renderTimer = 0;
  let mutationObserver = null;
  let lastAdapterEventClick = null;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isCalendarPage() {
    return pageName() === 'calendar';
  }

  function getAdapter() {
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar) return globalCalendar;
    } catch (_) {}
    return window.globalCalendar || null;
  }

  function cloneDate(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function monthStart(value) {
    const date = cloneDate(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function startOfWeek(value) {
    const date = cloneDate(value);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return date;
  }

  function addDays(value, count) {
    const date = cloneDate(value);
    date.setDate(date.getDate() + Number(count || 0));
    return date;
  }

  function addMonths(value, count) {
    const date = cloneDate(value);
    return new Date(date.getFullYear(), date.getMonth() + Number(count || 0), 1);
  }

  function isoDate(value) {
    const date = cloneDate(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function parseIso(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function shiftIso(value, amount) {
    const date = parseIso(value);
    return date ? isoDate(addDays(date, amount)) : String(value || '');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function eventType(event) {
    const props = event?.extendedProps || {};
    if (props.isMeetGreet === true) return 'meet';
    if (props.isPotential === true) return 'potential';
    return 'confirmed';
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
    const start = String(props.rawStartDate || props.startDate || event?.startStr || '').slice(0, 10) || isoDate(event?.start);
    let end = String(props.rawEndDate || props.endDate || '').slice(0, 10);
    if (!end && event?.end) {
      const raw = String(event.endStr || '').slice(0, 10) || isoDate(event.end);
      end = event.allDay === false ? raw : shiftIso(raw, -1);
    }
    return { start, end: end || start };
  }

  function formatTime(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return text || 'TBC';
    const hour24 = Number(match[1]);
    const suffix = hour24 >= 12 ? 'pm' : 'am';
    return `${hour24 % 12 || 12}:${match[2]}${suffix}`;
  }

  function eventTime(event) {
    const direct = String(event?.extendedProps?.time || '').trim();
    if (direct) return formatTime(direct);
    if (event?.start && event.allDay === false) {
      try {
        return event.start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '');
      } catch (_) {}
    }
    return 'TBC';
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

  function eventKey(event) {
    const dates = eventDates(event);
    return [eventType(event), String(event?.id || ''), dogName(event), dates.start, dates.end, eventTime(event)].join('|');
  }

  function intersects(event, startIso, endIso) {
    const dates = eventDates(event);
    return !!dates.start && dates.start <= endIso && dates.end >= startIso;
  }

  function monthBounds(value) {
    const first = monthStart(value);
    const gridStart = startOfWeek(first);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const gridEnd = addDays(last, 6 - last.getDay());
    return { start: gridStart, end: gridEnd };
  }

  function viewBounds() {
    if (viewMode === 'week') {
      const start = startOfWeek(anchorDate);
      return { start, end: addDays(start, 6) };
    }
    if (viewMode === 'fortnight') {
      const start = startOfWeek(anchorDate);
      return { start, end: addDays(start, 13) };
    }
    return monthBounds(anchorDate);
  }

  function datesBetween(start, end) {
    const dates = [];
    for (let cursor = cloneDate(start); cursor <= end; cursor = addDays(cursor, 1)) {
      dates.push(cursor);
    }
    return dates;
  }

  function weekChunks() {
    const bounds = viewBounds();
    const dates = datesBetween(bounds.start, bounds.end);
    const weeks = [];
    for (let index = 0; index < dates.length; index += 7) weeks.push(dates.slice(index, index + 7));
    return weeks;
  }

  function rangeTitle() {
    if (viewMode === 'month') {
      return anchorDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    }
    const { start, end } = viewBounds();
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}`;
    }
    if (sameYear) {
      return `${start.getDate()} ${start.toLocaleDateString('en-AU', { month: 'short' })} – ${end.getDate()} ${end.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}`;
    }
    return `${start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  function ensureStyles() {
    if (document.getElementById('v11169CalendarStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11169CalendarStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] {
        --wh65-surface:#fff;--wh65-soft:#f8fafc;--wh65-soft2:#eef2f7;--wh65-line:#dbe3ed;
        --wh65-text:#172033;--wh65-muted:#64748b;--wh65-accent:#0f79a9;--wh65-meet:#0f766e;--wh65-potential:#d97706;
      }
      body[data-waffle-page="calendar"].dark-theme {
        --wh65-surface:#152137;--wh65-soft:#1a2941;--wh65-soft2:#22314c;--wh65-line:#334155;
        --wh65-text:#f8fafc;--wh65-muted:#a9b6c9;--wh65-accent:#38bdf8;--wh65-meet:#14b8a6;--wh65-potential:#f59e0b;
      }
      body[data-waffle-page="calendar"] #calendar {
        position:absolute!important;left:-100000px!important;top:0!important;width:1px!important;height:1px!important;
        min-width:0!important;min-height:0!important;overflow:hidden!important;opacity:0!important;visibility:hidden!important;
        pointer-events:none!important;clip-path:inset(100%)!important;
      }
      body[data-waffle-page="calendar"] #v11161CalendarLegend,
      body[data-waffle-page="calendar"] #calendarEventLegend,
      body[data-waffle-page="calendar"] #v11161DayModal,
      body[data-waffle-page="calendar"] #wh63CalendarFilters,
      body[data-waffle-page="calendar"] #wh63DayModal,
      body[data-waffle-page="calendar"] #v1088DateChoiceModal,
      body[data-waffle-page="calendar"] .calendar-filter-bar,
      body[data-waffle-page="calendar"] .calendar-filter-chips,
      body[data-waffle-page="calendar"] .calendar-filters,
      body[data-waffle-page="calendar"] .v10-calendar-filters,
      body[data-waffle-page="calendar"] .v108-calendar-filters,
      body[data-waffle-page="calendar"] .v110-calendar-filters,
      body[data-waffle-page="calendar"] [data-calendar-filters],
      body[data-waffle-page="calendar"] .search-container:has(#calendarSearch) { display:none!important; }

      .wh65-calendar { width:100%;overflow:hidden;border:1px solid var(--wh65-line);border-radius:18px;background:var(--wh65-surface);color:var(--wh65-text); }
      .wh65-toolbar { display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--wh65-line); }
      .wh65-toolbar-left,.wh65-toolbar-right { display:flex;align-items:center;gap:7px; }
      .wh69-title-wrap { min-width:0;display:grid;justify-items:center;gap:7px; }
      .wh65-title { text-align:center;font-size:clamp(18px,2vw,24px);font-weight:950;letter-spacing:-.02em; }
      .wh65-btn { min-width:38px;height:38px;padding:0 11px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--wh65-line);border-radius:10px;background:var(--wh65-soft2);color:var(--wh65-text);cursor:pointer;font:inherit;font-size:10px;font-weight:900; }
      .wh65-btn:hover { border-color:color-mix(in srgb,var(--wh65-accent) 55%,var(--wh65-line)); }
      .wh65-sync { background:color-mix(in srgb,var(--wh65-accent) 14%,var(--wh65-soft2)); }
      .wh69-view-switch { display:inline-flex;align-items:center;padding:2px;border:1px solid var(--wh65-line);border-radius:999px;background:var(--wh65-soft); }
      .wh69-view-btn { min-height:27px;padding:0 10px;border:0;border-radius:999px;background:transparent;color:var(--wh65-muted);cursor:pointer;font:inherit;font-size:8px;font-weight:900; }
      .wh69-view-btn.is-active { background:var(--wh65-surface);color:var(--wh65-text);box-shadow:0 1px 4px rgba(15,23,42,.12); }
      .wh65-legend { display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:9px 16px;border-bottom:1px solid var(--wh65-line);background:var(--wh65-soft);color:var(--wh65-muted);font-size:9px;font-weight:800; }
      .wh65-legend-item { display:inline-flex;align-items:center;gap:6px; }
      .wh65-legend-swatch { width:18px;height:7px;border-radius:999px;background:linear-gradient(90deg,#2563eb,#7c3aed,#db2777); }
      .wh65-legend-potential { width:18px;height:7px;border:1.5px dashed var(--wh65-potential);border-radius:999px;background:color-mix(in srgb,var(--wh65-potential) 10%,transparent); }
      .wh65-legend-meet { width:18px;height:12px;border-radius:4px;background:var(--wh65-meet); }
      .wh65-weekdays { display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-bottom:1px solid var(--wh65-line);background:var(--wh65-soft); }
      .wh65-weekdays span { padding:10px 5px;text-align:center;color:var(--wh65-muted);font-size:9px;font-weight:950;letter-spacing:.06em; }
      .wh65-week { position:relative;border-bottom:1px solid var(--wh65-line); }
      .wh65-week:last-child { border-bottom:0; }
      .wh65-dates { display:grid;grid-template-columns:repeat(7,minmax(0,1fr)); }
      .wh65-date { min-height:34px;display:flex;align-items:center;justify-content:flex-start;gap:6px;padding:6px 8px;border-right:1px solid var(--wh65-line);background:var(--wh65-surface); }
      .wh65-date:last-child { border-right:0; }
      .wh65-date.is-other { background:var(--wh65-soft);color:var(--wh65-muted); }
      .wh65-date.is-today { box-shadow:inset 0 -2px 0 var(--wh65-accent); }
      .wh65-date-number { font-size:10px;font-weight:950; }
      .wh65-timeline { position:relative;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:28px;gap:4px 0;padding:6px 0 7px;background-image:linear-gradient(to right,transparent calc(100% - 1px),var(--wh65-line) calc(100% - 1px));background-size:calc(100% / 7) 100%; }
      .wh65-empty-timeline { min-height:4px;padding:0!important; }
      .wh65-bar { align-self:center;min-width:0;height:24px;display:flex;align-items:center;gap:5px;padding:0 7px;border-radius:7px;color:#fff;font-size:9px;font-weight:950;line-height:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer;box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 2px 6px rgba(15,23,42,.13);z-index:1; }
      .wh65-bar:hover { z-index:3;filter:brightness(1.06); }
      .wh65-bar.confirmed { background:var(--wh65-dog-colour);border:1px solid color-mix(in srgb,var(--wh65-dog-colour) 72%,white 28%); }
      .wh65-bar.potential { color:var(--wh65-potential);background:color-mix(in srgb,var(--wh65-potential) 10%,var(--wh65-surface));border:1.5px dashed var(--wh65-potential);box-shadow:none; }
      .wh65-bar-label { min-width:0;overflow:hidden;text-overflow:ellipsis; }
      .wh65-marker { flex:0 0 auto;width:15px;height:15px;display:inline-grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.18);font-size:8px; }
      .wh65-bar.potential .wh65-marker { background:color-mix(in srgb,var(--wh65-potential) 16%,transparent); }
      .wh65-end { margin-left:auto; }
      .wh65-meets { display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px dashed color-mix(in srgb,var(--wh65-line) 75%,transparent);background:color-mix(in srgb,var(--wh65-meet) 2%,var(--wh65-surface)); }
      .wh65-meet-day { min-width:0;display:grid;align-content:start;gap:5px;padding:6px;border-right:1px solid var(--wh65-line); }
      .wh65-meet-day:last-child { border-right:0; }
      .wh65-meet-day:empty { padding:0;min-height:0; }
      .wh65-meet { width:100%;min-height:32px;display:flex;align-items:center;gap:6px;padding:6px 7px;border:1px solid color-mix(in srgb,var(--wh65-meet) 78%,white 22%);border-radius:9px;background:var(--wh65-meet);color:#fff;cursor:pointer;font-size:8px;font-weight:950;line-height:1.25;text-align:left;box-shadow:0 3px 10px rgba(15,118,110,.16); }
      .wh65-meet-icon { flex:0 0 auto;width:18px;height:18px;display:inline-grid;place-items:center;border-radius:5px;background:rgba(255,255,255,.16); }
      .wh65-meet-copy { min-width:0;overflow:hidden;text-overflow:ellipsis; }
      .wh65-empty { padding:32px 16px;text-align:center;color:var(--wh65-muted);font-size:11px;font-weight:800; }

      @media(max-width:700px) {
        .wh65-calendar { border-radius:13px; }
        .wh65-toolbar { grid-template-columns:auto minmax(0,1fr) auto;padding:9px 7px;gap:5px; }
        .wh65-toolbar-left { gap:3px; }
        .wh65-btn { min-width:31px;height:31px;padding:0 7px;font-size:8px; }
        .wh69-title-wrap { gap:5px; }
        .wh65-title { font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px; }
        .wh69-view-switch { padding:1px; }
        .wh69-view-btn { min-height:23px;padding:0 7px;font-size:7px; }
        .wh65-legend { padding:7px 9px;gap:8px;font-size:7px; }
        .wh65-weekdays span { padding:8px 2px;font-size:7px; }
        .wh65-date { min-height:27px;padding:4px;gap:4px; }
        .wh65-date-number { font-size:8px; }
        .wh65-timeline { grid-auto-rows:23px;gap:3px 0;padding:4px 0 5px; }
        .wh65-bar { height:20px;padding:0 4px;gap:3px;border-radius:5px;font-size:7px; }
        .wh65-marker { width:11px;height:11px;font-size:6px; }
        .wh65-meet-day { gap:3px;padding:3px; }
        .wh65-meet { min-height:25px;padding:4px;border-radius:6px;font-size:6.5px;gap:3px; }
        .wh65-meet-icon { width:14px;height:14px;font-size:8px; }
      }
      @media(max-width:460px) {
        .wh65-toolbar { grid-template-columns:auto 1fr auto; }
        .wh65-toolbar-left [data-wh69-today] { display:none; }
        .wh65-title { max-width:135px;font-size:12px; }
        .wh69-view-btn { padding:0 6px;font-size:6.5px; }
        .wh65-sync { padding:0 6px; }
      }
    `;
    document.head.appendChild(style);
  }

  function hideLegacyCalendarUi() {
    const old = document.getElementById('calendar');
    if (old) {
      old.setAttribute('aria-hidden', 'true');
      old.setAttribute('inert', '');
      old.tabIndex = -1;
    }
    ['v11161CalendarLegend', 'calendarEventLegend', 'v11161DayModal', 'wh63CalendarFilters', 'wh63DayModal', 'v1088DateChoiceModal']
      .forEach(id => document.getElementById(id)?.remove());
    document.querySelectorAll([
      '.calendar-filter-bar', '.calendar-filter-chips', '.calendar-filters', '.v10-calendar-filters',
      '.v108-calendar-filters', '.v110-calendar-filters', '[data-calendar-filters]'
    ].join(',')).forEach(node => node.remove());
    const search = document.getElementById('calendarSearch')?.closest('.search-container');
    if (search) search.remove();
  }

  function ensureHost() {
    let host = document.getElementById('wh65Calendar');
    if (host) return host;
    const old = document.getElementById('calendar');
    if (!old) return null;
    host = document.createElement('section');
    host.id = 'wh65Calendar';
    host.className = 'wh65-calendar';
    host.setAttribute('aria-label', 'Waffle House calendar');
    old.insertAdjacentElement('beforebegin', host);
    return host;
  }

  function viewButton(mode, label) {
    const active = mode === viewMode;
    return `<button type="button" class="wh69-view-btn${active ? ' is-active' : ''}" data-wh69-view="${mode}" aria-pressed="${active ? 'true' : 'false'}">${label}</button>`;
  }

  function renderToolbar(host) {
    host.innerHTML = `
      <header class="wh65-toolbar">
        <div class="wh65-toolbar-left">
          <button type="button" class="wh65-btn" data-wh69-prev aria-label="Previous ${viewMode}">‹</button>
          <button type="button" class="wh65-btn" data-wh69-next aria-label="Next ${viewMode}">›</button>
          <button type="button" class="wh65-btn" data-wh69-today>Today</button>
        </div>
        <div class="wh69-title-wrap">
          <div class="wh65-title">${escapeHtml(rangeTitle())}</div>
          <div class="wh69-view-switch" role="group" aria-label="Calendar view">
            ${viewButton('month', 'Month')}${viewButton('fortnight', 'Fortnight')}${viewButton('week', 'Week')}
          </div>
        </div>
        <div class="wh65-toolbar-right"><button type="button" class="wh65-btn wh65-sync" data-wh69-sync>↻ Sync</button></div>
      </header>
      <div class="wh65-legend" aria-label="Calendar key">
        <span class="wh65-legend-item"><i class="wh65-legend-swatch"></i>Confirmed Stay</span>
        <span class="wh65-legend-item"><i class="wh65-legend-potential"></i>Potential Stay</span>
        <span class="wh65-legend-item"><i class="wh65-legend-meet"></i>Meet &amp; Greet</span>
      </div>
      <div class="wh65-weekdays">${DAYS.map(day => `<span>${day}</span>`).join('')}</div>
      <div data-wh69-weeks></div>
    `;
  }

  function getEvents() {
    return adapter?.getEvents?.() || [];
  }

  function allocateWeekLanes(events, weekStartIso, weekEndIso) {
    const spans = events
      .filter(event => eventType(event) !== 'meet' && intersects(event, weekStartIso, weekEndIso))
      .map(event => {
        const dates = eventDates(event);
        const clippedStart = dates.start < weekStartIso ? weekStartIso : dates.start;
        const clippedEnd = dates.end > weekEndIso ? weekEndIso : dates.end;
        return { event, dates, clippedStart, clippedEnd };
      })
      .sort((a, b) =>
        a.clippedStart.localeCompare(b.clippedStart) ||
        a.clippedEnd.localeCompare(b.clippedEnd) ||
        (eventType(a.event) === 'confirmed' ? -1 : 1) ||
        dogName(a.event).localeCompare(dogName(b.event))
      );

    const laneEnds = [];
    spans.forEach(item => {
      let lane = laneEnds.findIndex(end => end < item.clippedStart);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = item.clippedEnd;
      item.lane = lane;
    });
    return { spans, laneCount: laneEnds.length };
  }

  function renderWeek(week, events) {
    const weekStartIso = isoDate(week[0]);
    const weekEndIso = isoDate(week[6]);
    const { spans, laneCount } = allocateWeekLanes(events, weekStartIso, weekEndIso);
    const todayIso = isoDate(new Date());
    const anchorMonth = anchorDate.getMonth();

    const datesHtml = week.map(date => {
      const dateIso = isoDate(date);
      const other = viewMode === 'month' && date.getMonth() !== anchorMonth;
      return `<div class="wh65-date${other ? ' is-other' : ''}${dateIso === todayIso ? ' is-today' : ''}" data-date="${dateIso}"><span class="wh65-date-number">${date.getDate()}</span></div>`;
    }).join('');

    const timelineItems = spans.map(item => {
      const startDate = parseIso(item.clippedStart);
      const endDate = parseIso(item.clippedEnd);
      if (!startDate || !endDate) return '';
      const startCol = startDate.getDay() + 1;
      const span = Math.round((endDate - startDate) / 86400000) + 1;
      const type = eventType(item.event);
      const name = dogName(item.event);
      const actualStart = item.dates.start === item.clippedStart;
      const actualEnd = item.dates.end === item.clippedEnd;
      const style = type === 'confirmed' ? `--wh65-dog-colour:${dogColour(name)};` : '';
      const lead = actualStart ? '<span class="wh65-marker" aria-label="Arrival">↓</span>' : '<span class="wh65-marker" aria-hidden="true">•</span>';
      const tail = actualEnd ? '<span class="wh65-marker wh65-end" aria-label="Departure">↑</span>' : '';
      const prefix = type === 'potential' ? 'Potential · ' : '';
      return `<button type="button" class="wh65-bar ${type}" data-wh65-event="${escapeHtml(eventKey(item.event))}" style="grid-column:${startCol}/span ${span};grid-row:${item.lane + 1};${style}" title="${escapeHtml(prefix + name)}">${lead}<span class="wh65-bar-label">${escapeHtml(prefix + name)}</span>${tail}</button>`;
    }).join('');

    const meetColumns = week.map(date => {
      const dateIso = isoDate(date);
      const meets = events
        .filter(event => eventType(event) === 'meet' && eventDates(event).start === dateIso)
        .sort((a, b) => eventTime(a).localeCompare(eventTime(b)) || dogName(a).localeCompare(dogName(b)));
      return `<div class="wh65-meet-day">${meets.map(event => {
        const label = `${eventTime(event)} - ${dogName(event)}`;
        return `<button type="button" class="wh65-meet" data-wh65-event="${escapeHtml(eventKey(event))}" title="Meet & Greet · ${escapeHtml(label)}" aria-label="Meet & Greet · ${escapeHtml(label)}"><span class="wh65-meet-icon">🤝</span><span class="wh65-meet-copy">${escapeHtml(label)}</span></button>`;
      }).join('')}</div>`;
    }).join('');

    const hasMeets = meetColumns.includes('data-wh65-event');
    return `<section class="wh65-week" data-wh69-week-start="${weekStartIso}"><div class="wh65-dates">${datesHtml}</div><div class="wh65-timeline${laneCount ? '' : ' wh65-empty-timeline'}" style="grid-template-rows:repeat(${Math.max(1, laneCount)},28px)">${timelineItems}</div>${hasMeets ? `<div class="wh65-meets">${meetColumns}</div>` : ''}</section>`;
  }

  function render() {
    renderTimer = 0;
    if (!adapter) return;
    hideLegacyCalendarUi();
    const host = ensureHost();
    if (!host) return;
    renderToolbar(host);
    const weeksHost = host.querySelector('[data-wh69-weeks]');
    const events = getEvents();
    weeksHost.innerHTML = weekChunks().map(week => renderWeek(week, events)).join('') || '<div class="wh65-empty">No calendar activity.</div>';
    wireHost(host);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => requestAnimationFrame(render), 40);
  }

  function syncAdapterDate() {
    try { adapter?.gotoDate?.(anchorDate); } catch (_) {}
  }

  function navigate(direction) {
    if (viewMode === 'month') anchorDate = addMonths(anchorDate, direction);
    else anchorDate = addDays(anchorDate, direction * (viewMode === 'fortnight' ? 14 : 7));
    syncAdapterDate();
    scheduleRender();
  }

  function goToday() {
    anchorDate = new Date();
    syncAdapterDate();
    scheduleRender();
  }

  function switchView(nextView) {
    if (!['month', 'fortnight', 'week'].includes(nextView) || nextView === viewMode) return;
    if (viewMode === 'month') {
      const today = new Date();
      if (today.getFullYear() === anchorDate.getFullYear() && today.getMonth() === anchorDate.getMonth()) anchorDate = today;
    }
    viewMode = nextView;
    syncAdapterDate();
    scheduleRender();
  }

  function invokeSync() {
    const oldSync = document.getElementById('manualRefreshBtn');
    if (oldSync) return oldSync.click();
    try { if (typeof syncSpreadsheetData === 'function') syncSpreadsheetData(); } catch (_) {}
  }

  function invokeEvent(eventKeyValue, sourceElement, jsEvent) {
    const eventRecord = getEvents().find(event => eventKey(event) === eventKeyValue);
    if (!eventRecord) return;
    const handler = lastAdapterEventClick || adapter?.getOption?.('eventClick');
    if (typeof handler !== 'function') return;
    try {
      handler({ event: eventRecord, el: sourceElement, jsEvent, view: adapter.view });
    } catch (error) {
      console.warn('Calendar event action could not open:', error);
    }
  }

  function wireHost(host) {
    if (host.dataset.wh69Wired === VERSION) return;
    host.dataset.wh69Wired = VERSION;
    host.addEventListener('click', event => {
      if (event.target.closest('[data-wh69-prev]')) return navigate(-1);
      if (event.target.closest('[data-wh69-next]')) return navigate(1);
      if (event.target.closest('[data-wh69-today]')) return goToday();
      if (event.target.closest('[data-wh69-sync]')) return invokeSync();
      const viewButton = event.target.closest('[data-wh69-view]');
      if (viewButton) return switchView(String(viewButton.dataset.wh69View || 'month'));
      const eventButton = event.target.closest('[data-wh65-event]');
      if (eventButton) invokeEvent(eventButton.dataset.wh65Event, eventButton, event);
    });
  }

  function captureAdapterHandlers() {
    try {
      const eventClick = adapter?.getOption?.('eventClick');
      if (typeof eventClick === 'function') lastAdapterEventClick = eventClick;
    } catch (_) {}
  }

  function bindAdapter() {
    if (!adapter || adapter._wh69Bound || typeof adapter.on !== 'function') return;
    adapter._wh69Bound = true;
    ['eventsSet', 'eventAdd', 'eventChange', 'eventRemove', 'datesSet'].forEach(name => {
      try { adapter.on(name, () => { captureAdapterHandlers(); scheduleRender(); }); } catch (_) {}
    });
  }

  function observeLegacyRecreation() {
    if (mutationObserver || !document.body || typeof MutationObserver !== 'function') return;
    mutationObserver = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => Array.from(mutation.addedNodes || []).some(node => {
        if (!(node instanceof Element)) return false;
        return node.id === 'calendar' || node.id === 'wh63CalendarFilters' || node.id === 'v11161CalendarLegend' ||
          !!node.querySelector?.('#calendar,#wh63CalendarFilters,#v11161CalendarLegend,#v1088DateChoiceModal');
      }));
      if (relevant) {
        hideLegacyCalendarUi();
        scheduleRender();
      }
    });
    mutationObserver.observe(document.body, { childList:true, subtree:true });
  }

  function attach() {
    const ref = getAdapter();
    if (!ref || typeof ref.getEvents !== 'function') return false;
    adapter = ref;
    captureAdapterHandlers();
    try {
      const current = adapter.getDate?.();
      if (current instanceof Date && !Number.isNaN(current.getTime())) anchorDate = current;
    } catch (_) {}

    viewMode = 'month'; // Month is deliberately the default on every fresh Calendar load.
    ensureStyles();
    hideLegacyCalendarUi();
    ensureHost();
    bindAdapter();
    observeLegacyRecreation();
    render();

    [100, 300, 700, 1400, 2600, 5000].forEach(delay => setTimeout(() => {
      captureAdapterHandlers();
      hideLegacyCalendarUi();
      scheduleRender();
    }, delay));

    window.addEventListener('pageshow', scheduleRender);
    window.addEventListener('focus', scheduleRender);
    window.addEventListener('resize', scheduleRender, { passive:true });
    window.v11165SingleCalendarVersion = '11.1.69-compat';
    window.v11169CalendarViewsVersion = VERSION;
    return true;
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyles();
    hideLegacyCalendarUi();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attach() || attempts > 120) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();


/* ============================================================
   CANONICAL CALENDAR SOURCE · waffle-v11.1.66.js
   Preserved in proven historical execution order.
   ============================================================ */
/* ============================================================
   WAFFLE HOUSE V11.1.66 — MOBILE MEET & GREET COMPACTION
   ============================================================
   The single V11.1.65 Calendar remains authoritative.

   Desktop keeps the descriptive Meet & Greet syntax:
     Time - Dog Name

   Mobile keeps each Meet & Greet inside exactly one day column and shows only
   the time as its visible title. The full label remains on title/aria-label and
   the existing tap action still opens the underlying Meet & Greet record.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.66';
  const MOBILE_QUERY = '(max-width: 700px)';
  let observer = null;
  let scheduled = 0;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isCalendarPage() {
    return pageName() === 'calendar';
  }

  function isMobile() {
    return window.matchMedia?.(MOBILE_QUERY)?.matches ?? window.innerWidth <= 700;
  }

  function ensureStyle() {
    if (document.getElementById('v11166MobileMeetStyle')) return;

    const style = document.createElement('style');
    style.id = 'v11166MobileMeetStyle';
    style.textContent = `
      @media (max-width:700px) {
        /* The Meet & Greet section keeps the exact same seven-column geometry
           as the date row. No badge may extend beyond its own day. */
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-meets {
          grid-template-columns:repeat(7,minmax(0,1fr)) !important;
          width:100% !important;
        }
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-meet-day {
          min-width:0 !important;
          width:auto !important;
          padding:3px 0 !important;
          gap:3px !important;
          overflow:hidden !important;
          box-sizing:border-box !important;
        }
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-meet {
          width:100% !important;
          min-width:0 !important;
          max-width:100% !important;
          height:22px !important;
          min-height:22px !important;
          margin:0 !important;
          padding:0 2px !important;
          display:flex !important;
          align-items:center !important;
          justify-content:center !important;
          gap:0 !important;
          border-radius:4px !important;
          box-sizing:border-box !important;
          overflow:hidden !important;
          white-space:nowrap !important;
          text-align:center !important;
          box-shadow:none !important;
        }
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-meet-icon {
          display:none !important;
        }
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-meet-copy {
          display:block !important;
          width:100% !important;
          min-width:0 !important;
          overflow:hidden !important;
          text-overflow:ellipsis !important;
          white-space:nowrap !important;
          text-align:center !important;
          font-size:7px !important;
          font-weight:950 !important;
          line-height:1 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function splitLabel(label) {
    const full = String(label || '').replace(/\s+/g, ' ').trim();
    const separator = full.indexOf(' - ');
    return {
      full,
      time: separator >= 0 ? full.slice(0, separator).trim() : full
    };
  }

  function normaliseButton(button, mobile) {
    if (!(button instanceof Element)) return;
    const copy = button.querySelector('.wh65-meet-copy');
    if (!copy) return;

    const currentText = String(copy.textContent || '').replace(/\s+/g, ' ').trim();
    if (!button.dataset.wh66FullLabel) {
      button.dataset.wh66FullLabel = currentText;
    }

    const labels = splitLabel(button.dataset.wh66FullLabel || currentText);
    if (!labels.full) return;

    button.title = `Meet & Greet · ${labels.full}`;
    button.setAttribute('aria-label', `Meet & Greet · ${labels.full}`);
    button.classList.toggle('wh66-mobile-meet', mobile);
    copy.textContent = mobile ? labels.time : labels.full;
  }

  function apply() {
    scheduled = 0;
    if (!isCalendarPage()) return;

    ensureStyle();
    const mobile = isMobile();
    document.querySelectorAll('#wh65Calendar .wh65-meet').forEach(button =>
      normaliseButton(button, mobile)
    );
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
            node.matches?.('.wh65-meet,.wh65-meets,.wh65-week') ||
            !!node.querySelector?.('.wh65-meet');
        })
      );
      if (relevant) scheduleApply();
    });

    observer.observe(document.body, { childList:true, subtree:true });
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyle();
    observe();
    apply();

    [100, 300, 700, 1400, 2600, 5000].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('resize', scheduleApply, { passive:true });
    window.addEventListener('orientationchange', scheduleApply);
    window.addEventListener('pageshow', scheduleApply);
    window.v11166MobileMeetVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();


/* ============================================================
   CANONICAL CALENDAR SOURCE · waffle-v11.1.67.js
   Preserved in proven historical execution order.
   ============================================================ */
/* ============================================================
   WAFFLE HOUSE V11.1.67 — REMOVE CALENDAR CAPACITY COUNTS
   ============================================================
   The single V11.1.65 Calendar remains authoritative.
   Date headers show the date only; numeric activity/capacity pills are retired.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.67';
  let observer = null;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function ensureStyle() {
    if (document.getElementById('v11167NoCapacityCountStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11167NoCapacityCountStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] #wh65Calendar .wh65-count {
        display:none !important;
      }
      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date {
        justify-content:flex-start !important;
      }
    `;
    document.head.appendChild(style);
  }

  function removeCounts() {
    if (!isCalendarPage()) return;
    ensureStyle();
    document.querySelectorAll('#wh65Calendar .wh65-count').forEach(node => node.remove());
  }

  function observe() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation =>
        Array.from(mutation.addedNodes || []).some(node => {
          if (!(node instanceof Element)) return false;
          return node.classList?.contains('wh65-count') ||
            node.id === 'wh65Calendar' ||
            !!node.querySelector?.('.wh65-count');
        })
      );
      if (relevant) removeCounts();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyle();
    removeCounts();
    observe();
    [100, 300, 700, 1400, 2600, 5000].forEach(delay => setTimeout(removeCounts, delay));
    window.addEventListener('pageshow', removeCounts);
    window.v11167NoCapacityCountVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();


/* ============================================================
   CANONICAL CALENDAR SOURCE · waffle-v11.1.68.js
   Preserved in proven historical execution order.
   ============================================================ */
/* ============================================================
   WAFFLE HOUSE V11.1.68 — CALENDAR CAPACITY HEALTH
   ============================================================
   Adds a non-numeric health marker to every date in the single Calendar.
   Capacity is based ONLY on confirmed boarding stays:

   GREEN  = 0–2 confirmed dogs
   AMBER  = 3 confirmed dogs
   RED    = 4+ confirmed dogs

   Meet & Greets and Potential Stays do not affect capacity health.
   V11.1.69 date cells expose data-date so Week/Fortnight markers are exact.
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
      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date { justify-content:flex-start !important; }
      body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health {
        width:9px;height:9px;flex:0 0 9px;margin-left:auto;border-radius:50%;
        border:1px solid rgba(255,255,255,.7);box-shadow:0 0 0 2px rgba(15,23,42,.07);
      }
      body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health[data-tone="green"] { background:#22c55e; }
      body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health[data-tone="amber"] { background:#f59e0b; }
      body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health[data-tone="red"] { background:#ef4444; }
      body.dark-theme[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health {
        border-color:rgba(255,255,255,.22);box-shadow:0 0 0 2px rgba(255,255,255,.04);
      }
      @media(max-width:700px) {
        body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health { width:8px;height:8px;flex-basis:8px; }
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
    const fallbackGridStart = currentGridStart();

    cells.forEach((cell, index) => {
      let dateIso = String(cell.dataset.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
        const date = new Date(fallbackGridStart);
        date.setDate(fallbackGridStart.getDate() + index);
        dateIso = isoDate(date);
      }

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
          return node.id === 'wh65Calendar' || node.classList?.contains('wh65-date') ||
            node.classList?.contains('wh65-week') || !!node.querySelector?.('.wh65-date');
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


/* ============================================================
   CANONICAL CALENDAR SOURCE · waffle-v11.1.70.js
   Preserved in proven historical execution order.
   ============================================================ */
/* ============================================================
   WAFFLE HOUSE V11.1.70 — POTENTIAL STAY LABEL COMPACTION
   ============================================================
   Potential Stay bars show only the pet's name in the visible Calendar.
   The booking type remains available through title/aria-label and the existing
   click action still opens the underlying Potential Stay record.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.70';
  let observer = null;
  let scheduled = 0;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function petNameFromLabel(value) {
    return String(value || '')
      .replace(/^Potential\s*[·:\-]\s*/i, '')
      .replace(/^Potential\s+Stay\s*[·:\-]?\s*/i, '')
      .trim();
  }

  function compactBar(bar) {
    if (!(bar instanceof Element)) return;
    const label = bar.querySelector('.wh65-bar-label');
    if (!label) return;

    const petName = petNameFromLabel(label.textContent);
    if (!petName) return;

    label.textContent = petName;
    bar.title = `Potential Stay · ${petName}`;
    bar.setAttribute('aria-label', `Potential Stay · ${petName}`);
  }

  function apply() {
    scheduled = 0;
    if (!isCalendarPage()) return;
    document.querySelectorAll('#wh65Calendar .wh65-bar.potential').forEach(compactBar);
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
          return node.classList?.contains('potential') ||
            node.id === 'wh65Calendar' ||
            !!node.querySelector?.('.wh65-bar.potential');
        })
      );
      if (relevant) scheduleApply();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function start() {
    if (!isCalendarPage()) return;
    observe();
    apply();
    [100, 300, 700, 1400, 2600, 5000].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', scheduleApply);
    window.v11170PotentialLabelVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();


/* ============================================================
   CANONICAL CALENDAR SOURCE · waffle-v11.1.71.js
   Preserved in proven historical execution order.
   ============================================================ */
/* ============================================================
   WAFFLE HOUSE V11.1.71 — RETIRE LEGACY CALENDAR FILTER STRIP
   ============================================================
   The V11.1.69 Calendar has its own Month / Fortnight / Week controls and no
   event-type filters. Older layers can still recreate a separate strip with:
     All · Confirmed · Meet & Greet · Potential
   plus the historical "Desktop: drag a booking to move dates" instruction.

   This layer permanently retires that whole legacy control block without
   touching the current Calendar toolbar or navigation.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.71';
  let observer = null;
  let scheduled = 0;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function normalise(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function isCurrentCalendarUi(node) {
    if (!(node instanceof Element)) return false;
    return !!node.closest('#wh65Calendar, .wh69-toolbar, .wh69-view-switcher, .app-tabs');
  }

  function buttonLabels(node) {
    if (!(node instanceof Element)) return [];
    return Array.from(node.querySelectorAll('button,[role="button"]'))
      .map(button => normalise(button.textContent))
      .filter(Boolean);
  }

  function hasLegacyFilterSet(node) {
    const labels = buttonLabels(node);
    if (!labels.length) return false;

    const hasAll = labels.some(label => label === 'all' || label.startsWith('all '));
    const hasConfirmed = labels.some(label => label.includes('confirmed'));
    const hasMeet = labels.some(label => label.includes('meet & greet') || label.includes('meet and greet'));
    const hasPotential = labels.some(label => label.includes('potential'));

    return hasAll && hasConfirmed && hasMeet && hasPotential;
  }

  function hasLegacyDragInstruction(node) {
    const text = normalise(node?.textContent);
    return text.includes('drag a booking to move dates') ||
      text.includes('desktop: drag a booking') ||
      text.includes('desktop drag a booking');
  }

  function looksLikeLegacyStrip(node) {
    if (!(node instanceof Element) || isCurrentCalendarUi(node)) return false;
    if (node.id === 'calendarTabPanel' || node.id === 'calendar') return false;

    const text = normalise(node.textContent);
    if (text.length > 500) return false;

    return hasLegacyFilterSet(node) || hasLegacyDragInstruction(node);
  }

  function smallestLegacyContainer(seed) {
    if (!(seed instanceof Element)) return null;

    let candidate = seed;
    let best = null;
    for (let depth = 0; candidate && depth < 6; depth += 1, candidate = candidate.parentElement) {
      if (candidate.id === 'calendarTabPanel' || candidate === document.body) break;
      if (isCurrentCalendarUi(candidate)) break;
      if (looksLikeLegacyStrip(candidate)) best = candidate;
    }

    if (!best) return null;

    // Prefer the smallest qualifying ancestor so unrelated Calendar content is
    // never removed with the retired filter strip.
    let smallest = best;
    let child = seed;
    while (child && child !== best) {
      if (looksLikeLegacyStrip(child)) smallest = child;
      child = child.parentElement;
    }
    return smallest;
  }

  function retireNode(node) {
    if (!(node instanceof Element) || isCurrentCalendarUi(node)) return false;
    node.setAttribute('data-wh71-retired-calendar-filter', 'true');
    node.setAttribute('aria-hidden', 'true');
    node.remove();
    return true;
  }

  function retireLegacyFilters() {
    scheduled = 0;
    if (!isCalendarPage()) return;

    const panel = document.getElementById('calendarTabPanel') || document.body;
    if (!panel) return;

    const candidates = new Set();

    panel.querySelectorAll('button,[role="button"],span,small,p,div,section,nav').forEach(node => {
      const text = normalise(node.textContent);
      if (
        text === 'all' ||
        text.includes('confirmed') ||
        text.includes('meet & greet') ||
        text.includes('meet and greet') ||
        text.includes('potential') ||
        text.includes('drag a booking to move dates')
      ) {
        const container = smallestLegacyContainer(node);
        if (container) candidates.add(container);
      }
    });

    // Remove inner containers before outer ones. In normal operation there is
    // only one result, but this keeps the cleanup deterministic if duplicate
    // legacy layers were injected.
    Array.from(candidates)
      .sort((a, b) => {
        if (a.contains(b)) return 1;
        if (b.contains(a)) return -1;
        return 0;
      })
      .forEach(retireNode);
  }

  function scheduleRetirement() {
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(retireLegacyFilters);
  }

  function observe() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;

    observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation =>
        Array.from(mutation.addedNodes || []).some(node => {
          if (!(node instanceof Element)) return false;
          const text = normalise(node.textContent);
          return text.includes('confirmed') ||
            text.includes('meet & greet') ||
            text.includes('potential') ||
            text.includes('drag a booking to move dates');
        })
      );
      if (relevant) scheduleRetirement();
    });

    observer.observe(document.body, { childList:true, subtree:true });
  }

  function start() {
    if (!isCalendarPage()) return;
    retireLegacyFilters();
    observe();
    [60, 180, 420, 900, 1800, 3200, 5200].forEach(delay => setTimeout(retireLegacyFilters, delay));
    window.addEventListener('pageshow', scheduleRetirement);
    window.addEventListener('focus', scheduleRetirement);
    window.v11171LegacyCalendarFilterRetirementVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();


/* ============================================================
   CANONICAL CALENDAR SOURCE · waffle-v11.1.72.js
   Preserved in proven historical execution order.
   ============================================================ */
/* ============================================================
   WAFFLE HOUSE V11.1.72 — MEET & GREET OUTLOOK ALIGNMENT
   ============================================================
   Aligns the Meet & Greet 7-day outlook with Capacity Outlook:
   weekday at the top, activity centred, date anchored at the bottom.
   The data and existing render pipeline remain unchanged.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.72';
  let observer = null;
  let scheduled = 0;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function ensureStyle() {
    if (document.getElementById('v11172MeetOutlookStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11172MeetOutlookStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] .v108-outlook-wrap {
        align-items:stretch !important;
      }
      body[data-waffle-page="calendar"] .v108-outlook-wrap > .v10-ops-card {
        height:100%;
      }
      body[data-waffle-page="calendar"] .v108-meet-card .v10-card-heading {
        min-height:42px;
        align-items:flex-start !important;
      }
      body[data-waffle-page="calendar"] .v108-meet-strip {
        align-items:stretch !important;
      }
      body[data-waffle-page="calendar"] .v108-meet-day {
        display:grid !important;
        grid-template-rows:16px minmax(42px,1fr) 14px !important;
        align-content:stretch !important;
        align-items:center !important;
        justify-items:center !important;
        min-height:82px !important;
        box-sizing:border-box;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > small {
        grid-row:1;
        align-self:start;
        margin:0 !important;
        line-height:1.1;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > .wh72-meet-main {
        grid-row:2;
        width:100%;
        min-width:0;
        min-height:0;
        display:flex !important;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:3px;
        margin:0 !important;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > .wh72-meet-main > strong {
        margin:0 !important;
        line-height:1;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > .wh72-meet-main > .wh72-meet-events {
        width:100%;
        min-width:0;
        display:grid !important;
        gap:2px;
        margin:0 !important;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > .wh72-meet-main > .wh72-meet-events span {
        display:block;
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        line-height:1.15;
      }
      body[data-waffle-page="calendar"] .v108-meet-day > i {
        grid-row:3;
        align-self:end;
        margin:0 !important;
        line-height:1.1;
      }
      @media (max-width:768px) {
        body[data-waffle-page="calendar"] .v108-meet-day {
          grid-template-rows:14px minmax(40px,1fr) 13px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function alignDay(day) {
    if (!(day instanceof Element)) return;

    const weekday = Array.from(day.children).find(node => node.tagName === 'SMALL');
    const date = Array.from(day.children).find(node => node.tagName === 'I');
    let main = Array.from(day.children).find(node => node.classList?.contains('wh72-meet-main'));

    if (!main) {
      const count = Array.from(day.children).find(node => node.tagName === 'STRONG');
      const events = Array.from(day.children).find(node =>
        node.tagName === 'DIV' && !node.classList.contains('wh72-meet-main')
      );

      main = document.createElement('div');
      main.className = 'wh72-meet-main';
      if (date) day.insertBefore(main, date);
      else day.appendChild(main);

      if (count) main.appendChild(count);
      if (events) {
        events.classList.add('wh72-meet-events');
        main.appendChild(events);
      }
    } else {
      const events = Array.from(main.children).find(node => node.tagName === 'DIV');
      if (events) events.classList.add('wh72-meet-events');
    }

    if (weekday) weekday.classList.add('wh72-meet-weekday');
    if (date) date.classList.add('wh72-meet-date');
    day.dataset.wh72Aligned = VERSION;
  }

  function apply() {
    scheduled = 0;
    if (!isCalendarPage()) return;
    ensureStyle();
    document.querySelectorAll('.v108-meet-day').forEach(alignDay);
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
          return node.classList?.contains('v108-meet-day') ||
            node.id === 'v108MeetOutlook' ||
            !!node.querySelector?.('.v108-meet-day');
        })
      );
      if (relevant) scheduleApply();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyle();
    apply();
    observe();
    [80, 220, 520, 1000, 1800, 3200, 5200].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', scheduleApply);
    window.addEventListener('focus', scheduleApply);
    window.v11172MeetOutlookAlignmentVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();


/* ============================================================
   CANONICAL CALENDAR SOURCE · waffle-v11.1.73.js
   Preserved in proven historical execution order.
   ============================================================ */
/* ============================================================
   WAFFLE HOUSE V11.1.73 — OPERATIONS PUG AVATARS
   ============================================================
   Replaces the four Operations emoji icons with the matching pug avatar
   artwork supplied for At Home, Arriving, Departing and Meet & Greet.
   Counts, labels, card actions and layout remain unchanged.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.73';
  const ICONS = {
    home: { src: 'ops-at-home.webp?v=11.1.73', alt: 'At Home pug avatar' },
    arriving: { src: 'ops-arriving.webp?v=11.1.73', alt: 'Arriving pug avatar' },
    departing: { src: 'ops-departing.webp?v=11.1.73', alt: 'Departing pug avatar' },
    meet: { src: 'ops-meet-greet.webp?v=11.1.73', alt: 'Meet and Greet pug avatar' }
  };

  let observer = null;
  let scheduled = 0;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function ensureStyle() {
    if (document.getElementById('v11173OperationsAvatarStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11173OperationsAvatarStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] .v10-stat-icon.wh73-operations-avatar {
        padding:0 !important;
        overflow:hidden !important;
        background:transparent !important;
        box-shadow:none !important;
      }
      body[data-waffle-page="calendar"] .v10-stat-icon.wh73-operations-avatar > img {
        display:block !important;
        width:100% !important;
        height:100% !important;
        object-fit:cover !important;
        object-position:center !important;
        border-radius:inherit !important;
      }
    `;
    document.head.appendChild(style);
  }

  function cardIconKey(card) {
    const text = String(card?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (text.includes('at home')) return 'home';
    if (text.includes('arriving')) return 'arriving';
    if (text.includes('leaving') || text.includes('departing')) return 'departing';
    if (text.includes('meet & greet') || text.includes('meet and greet')) return 'meet';
    return '';
  }

  function applyCard(card) {
    if (!(card instanceof Element)) return;
    const key = cardIconKey(card);
    const asset = ICONS[key];
    if (!asset) return;

    const icon = card.querySelector('.v10-stat-icon');
    if (!icon) return;

    const existing = icon.querySelector('img[data-wh73-operations-avatar]');
    if (existing && existing.dataset.wh73OperationsAvatar === key) return;

    icon.classList.add('wh73-operations-avatar');
    icon.textContent = '';

    const image = document.createElement('img');
    image.src = asset.src;
    image.alt = asset.alt;
    image.decoding = 'async';
    image.loading = 'eager';
    image.draggable = false;
    image.dataset.wh73OperationsAvatar = key;
    icon.appendChild(image);
    card.dataset.wh73OperationsAvatar = key;
  }

  function apply() {
    scheduled = 0;
    if (!isCalendarPage()) return;
    ensureStyle();
    document.querySelectorAll('.v10-stat-card').forEach(applyCard);
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
          return node.classList?.contains('v10-stat-card') || !!node.querySelector?.('.v10-stat-card');
        })
      );
      if (relevant) scheduleApply();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyle();
    apply();
    observe();
    [80, 220, 520, 1000, 1800, 3200, 5200].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', scheduleApply);
    window.addEventListener('focus', scheduleApply);
    window.v11173OperationsAvatarVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();


/* ============================================================
   CANONICAL CALENDAR SOURCE · waffle-v11.1.84.js
   Preserved in proven historical execution order.
   ============================================================ */
/* ============================================================
   WAFFLE HOUSE V11.1.84 — READABLE CALENDAR DAY NUMBERS
   ============================================================
   Makes the single Calendar's date numbers easier to scan on desktop and
   mobile without changing stay lanes, Meet & Greets or capacity health.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.84';

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function ensureStyle() {
    if (document.getElementById('v11184ReadableCalendarDayStyle')) return;

    const style = document.createElement('style');
    style.id = 'v11184ReadableCalendarDayStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date {
        min-height:42px !important;
        gap:7px !important;
        padding:7px 9px !important;
      }

      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date-number {
        display:inline-flex !important;
        align-items:center !important;
        justify-content:center !important;
        min-width:25px !important;
        height:25px !important;
        padding:0 3px !important;
        box-sizing:border-box !important;
        border-radius:8px !important;
        color:var(--wh65-text) !important;
        font-size:15px !important;
        line-height:1 !important;
        font-weight:950 !important;
        letter-spacing:-0.02em !important;
        font-variant-numeric:tabular-nums !important;
        text-align:center !important;
      }

      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date.is-today .wh65-date-number {
        background:var(--wh65-accent) !important;
        color:#fff !important;
        box-shadow:0 2px 7px color-mix(in srgb,var(--wh65-accent) 28%,transparent) !important;
      }

      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date.is-other .wh65-date-number {
        color:var(--wh65-muted) !important;
        opacity:.72 !important;
        font-weight:850 !important;
      }

      body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health {
        margin-left:auto !important;
        margin-right:1px !important;
      }

      @media (max-width:700px) {
        body[data-waffle-page="calendar"] #wh65Calendar .wh65-date {
          min-height:38px !important;
          gap:4px !important;
          padding:6px 5px !important;
        }

        body[data-waffle-page="calendar"] #wh65Calendar .wh65-date-number {
          min-width:23px !important;
          height:23px !important;
          padding:0 2px !important;
          border-radius:7px !important;
          font-size:14px !important;
        }

        body[data-waffle-page="calendar"] #wh65Calendar .wh68-capacity-health {
          width:7px !important;
          height:7px !important;
          flex-basis:7px !important;
          margin-right:0 !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyle();
    window.v11184ReadableCalendarDayVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();


/* ============================================================
   CANONICAL CALENDAR READY
   ============================================================ */
(function () {
  'use strict';
  const manifest = Object.freeze({
    build: '2026.08.27.03',
    version: 'calendar-phase2-1',
    sourceCount: 9,
    sources: window.WAFFLE_CALENDAR_CANONICAL_SOURCES
  });

  window.WAFFLE_CALENDAR_CANONICAL = manifest;
  // Backward-compatible readiness marker retained for older diagnostics only.
  // 11.1.72-outlook-alignment-bridge
  window.v11161CleanCalendarVersion = '11.1.84-readable-calendar-day-bridge';

  try {
    window.dispatchEvent(new CustomEvent('waffle:calendar-canonical-ready', { detail: manifest }));
  } catch (_) {}
})();
