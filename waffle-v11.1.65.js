/* ============================================================
   WAFFLE HOUSE V11.1.65 — SINGLE UNLIMITED MONTH TIMELINE
   ============================================================
   FullCalendar is no longer a visible UI. It remains hidden only as the
   existing data/editing adapter so spreadsheet sync and event editors continue
   to work. This file owns the one visible Calendar experience.

   One view, no filters, no row caps:
   - Confirmed Stays: stable dog colour, arrival → departure timeline bars.
   - Potential Stays: dashed amber timeline bars.
   - Meet & Greets: large teal badges, "Time - Dog Name".
   - Every activity is rendered. Week sections grow vertically without limit.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.65';
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const DOG_PALETTE = [
    '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#0f766e', '#15803d',
    '#4f46e5', '#9333ea', '#be123c', '#0369a1', '#047857', '#6d28d9',
    '#1d4ed8', '#a21caf', '#b91c1c', '#0e7490', '#c2410c', '#4338ca'
  ];

  let adapter = null;
  let visibleMonth = monthStart(new Date());
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

  function monthStart(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addMonths(value, count) {
    return new Date(value.getFullYear(), value.getMonth() + count, 1);
  }

  function isoDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function parseIso(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function shiftIso(value, amount) {
    const date = parseIso(value);
    if (!date) return String(value || '');
    date.setDate(date.getDate() + amount);
    return isoDate(date);
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

  function formatTime(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return text || 'TBC';
    const hour24 = Number(match[1]);
    const suffix = hour24 >= 12 ? 'pm' : 'am';
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${match[2]}${suffix}`;
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

  function monthBounds(month) {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const gridEnd = new Date(last);
    gridEnd.setDate(last.getDate() + (6 - last.getDay()));
    return { gridStart, gridEnd };
  }

  function dateRange(start, end) {
    const dates = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  function intersects(event, startIso, endIso) {
    const dates = eventDates(event);
    if (!dates.start) return false;
    return dates.start <= endIso && dates.end >= startIso;
  }

  function ensureStyles() {
    if (document.getElementById('v11165CalendarStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11165CalendarStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] {
        --wh65-surface:#fff;
        --wh65-soft:#f8fafc;
        --wh65-soft2:#eef2f7;
        --wh65-line:#dbe3ed;
        --wh65-text:#172033;
        --wh65-muted:#64748b;
        --wh65-accent:#0f79a9;
        --wh65-meet:#0f766e;
        --wh65-potential:#d97706;
      }
      body[data-waffle-page="calendar"].dark-theme {
        --wh65-surface:#152137;
        --wh65-soft:#1a2941;
        --wh65-soft2:#22314c;
        --wh65-line:#334155;
        --wh65-text:#f8fafc;
        --wh65-muted:#a9b6c9;
        --wh65-accent:#38bdf8;
        --wh65-meet:#14b8a6;
        --wh65-potential:#f59e0b;
      }

      /* No historical Calendar may be visible or interactive. */
      body[data-waffle-page="calendar"] #calendar {
        position:absolute!important;
        left:-100000px!important;
        top:0!important;
        width:1px!important;
        height:1px!important;
        min-width:0!important;
        min-height:0!important;
        overflow:hidden!important;
        opacity:0!important;
        visibility:hidden!important;
        pointer-events:none!important;
        clip-path:inset(100%)!important;
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
      body[data-waffle-page="calendar"] .search-container:has(#calendarSearch) {
        display:none!important;
      }

      .wh65-calendar {
        width:100%;
        overflow:hidden;
        border:1px solid var(--wh65-line);
        border-radius:18px;
        background:var(--wh65-surface);
        color:var(--wh65-text);
      }
      .wh65-toolbar {
        display:grid;
        grid-template-columns:auto minmax(0,1fr) auto;
        align-items:center;
        gap:12px;
        padding:14px 16px;
        border-bottom:1px solid var(--wh65-line);
      }
      .wh65-toolbar-left,.wh65-toolbar-right { display:flex;align-items:center;gap:7px; }
      .wh65-title { text-align:center;font-size:clamp(18px,2vw,24px);font-weight:950;letter-spacing:-.02em; }
      .wh65-btn {
        min-width:38px;height:38px;padding:0 11px;
        display:inline-flex;align-items:center;justify-content:center;
        border:1px solid var(--wh65-line);border-radius:10px;
        background:var(--wh65-soft2);color:var(--wh65-text);
        cursor:pointer;font:inherit;font-size:10px;font-weight:900;
      }
      .wh65-btn:hover { border-color:color-mix(in srgb,var(--wh65-accent) 55%,var(--wh65-line)); }
      .wh65-sync { background:color-mix(in srgb,var(--wh65-accent) 14%,var(--wh65-soft2)); }
      .wh65-legend {
        display:flex;align-items:center;gap:12px;flex-wrap:wrap;
        padding:9px 16px;border-bottom:1px solid var(--wh65-line);
        background:var(--wh65-soft);color:var(--wh65-muted);font-size:9px;font-weight:800;
      }
      .wh65-legend-item { display:inline-flex;align-items:center;gap:6px; }
      .wh65-legend-swatch { width:18px;height:7px;border-radius:999px;background:linear-gradient(90deg,#2563eb,#7c3aed,#db2777); }
      .wh65-legend-potential { width:18px;height:7px;border:1.5px dashed var(--wh65-potential);border-radius:999px;background:color-mix(in srgb,var(--wh65-potential) 10%,transparent); }
      .wh65-legend-meet { width:18px;height:12px;border-radius:4px;background:var(--wh65-meet); }
      .wh65-weekdays { display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-bottom:1px solid var(--wh65-line);background:var(--wh65-soft); }
      .wh65-weekdays span { padding:10px 5px;text-align:center;color:var(--wh65-muted);font-size:9px;font-weight:950;letter-spacing:.06em; }
      .wh65-week { position:relative;border-bottom:1px solid var(--wh65-line); }
      .wh65-week:last-child { border-bottom:0; }
      .wh65-dates { display:grid;grid-template-columns:repeat(7,minmax(0,1fr)); }
      .wh65-date {
        min-height:34px;display:flex;align-items:center;justify-content:space-between;gap:4px;
        padding:6px 8px;border-right:1px solid var(--wh65-line);background:var(--wh65-surface);
      }
      .wh65-date:last-child { border-right:0; }
      .wh65-date.is-other { background:var(--wh65-soft);color:var(--wh65-muted); }
      .wh65-date.is-today { box-shadow:inset 0 -2px 0 var(--wh65-accent); }
      .wh65-date-number { font-size:10px;font-weight:950; }
      .wh65-count { min-width:20px;height:18px;display:inline-grid;place-items:center;padding:0 5px;border:1px solid var(--wh65-line);border-radius:999px;background:var(--wh65-soft);color:var(--wh65-muted);font-size:7px;font-weight:900; }

      .wh65-timeline {
        position:relative;
        display:grid;
        grid-template-columns:repeat(7,minmax(0,1fr));
        grid-auto-rows:28px;
        gap:4px 0;
        padding:6px 0 7px;
        background-image:linear-gradient(to right,transparent calc(100% - 1px),var(--wh65-line) calc(100% - 1px));
        background-size:calc(100% / 7) 100%;
      }
      .wh65-empty-timeline { min-height:4px;padding:0!important; }
      .wh65-bar {
        align-self:center;min-width:0;height:24px;
        display:flex;align-items:center;gap:5px;
        padding:0 7px;border-radius:7px;color:#fff;
        font-size:9px;font-weight:950;line-height:1;
        overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
        cursor:pointer;box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 2px 6px rgba(15,23,42,.13);
        z-index:1;
      }
      .wh65-bar:hover { z-index:3;filter:brightness(1.06); }
      .wh65-bar.confirmed { background:var(--wh65-dog-colour);border:1px solid color-mix(in srgb,var(--wh65-dog-colour) 72%,white 28%); }
      .wh65-bar.potential {
        color:var(--wh65-potential);background:color-mix(in srgb,var(--wh65-potential) 10%,var(--wh65-surface));
        border:1.5px dashed var(--wh65-potential);box-shadow:none;
      }
      .wh65-bar-label { min-width:0;overflow:hidden;text-overflow:ellipsis; }
      .wh65-marker { flex:0 0 auto;width:15px;height:15px;display:inline-grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.18);font-size:8px; }
      .wh65-bar.potential .wh65-marker { background:color-mix(in srgb,var(--wh65-potential) 16%,transparent); }
      .wh65-end { margin-left:auto; }

      .wh65-meets {
        display:grid;grid-template-columns:repeat(7,minmax(0,1fr));
        border-top:1px dashed color-mix(in srgb,var(--wh65-line) 75%,transparent);
        background:color-mix(in srgb,var(--wh65-meet) 2%,var(--wh65-surface));
      }
      .wh65-meet-day { min-width:0;display:grid;align-content:start;gap:5px;padding:6px;border-right:1px solid var(--wh65-line); }
      .wh65-meet-day:last-child { border-right:0; }
      .wh65-meet-day:empty { padding:0;min-height:0; }
      .wh65-meet {
        width:100%;min-height:32px;display:flex;align-items:center;gap:6px;padding:6px 7px;
        border:1px solid color-mix(in srgb,var(--wh65-meet) 78%,white 22%);border-radius:9px;
        background:var(--wh65-meet);color:#fff;cursor:pointer;
        font-size:8px;font-weight:950;line-height:1.25;text-align:left;
        box-shadow:0 3px 10px rgba(15,118,110,.16);
      }
      .wh65-meet-icon { flex:0 0 auto;width:18px;height:18px;display:inline-grid;place-items:center;border-radius:5px;background:rgba(255,255,255,.16); }
      .wh65-meet-copy { min-width:0;overflow:hidden;text-overflow:ellipsis; }
      .wh65-empty {
        padding:32px 16px;text-align:center;color:var(--wh65-muted);font-size:11px;font-weight:800;
      }

      @media(max-width:700px) {
        .wh65-calendar { border-radius:13px; }
        .wh65-toolbar { grid-template-columns:auto minmax(0,1fr) auto;padding:10px 8px;gap:6px; }
        .wh65-toolbar-left { gap:4px; }
        .wh65-btn { min-width:32px;height:32px;padding:0 8px;font-size:8px; }
        .wh65-title { font-size:15px; }
        .wh65-legend { padding:7px 9px;gap:8px;font-size:7px; }
        .wh65-weekdays span { padding:8px 2px;font-size:7px; }
        .wh65-date { min-height:27px;padding:4px; }
        .wh65-date-number { font-size:8px; }
        .wh65-count { min-width:16px;height:15px;padding:0 3px;font-size:6px; }
        .wh65-timeline { grid-auto-rows:23px;gap:3px 0;padding:4px 0 5px; }
        .wh65-bar { height:20px;padding:0 4px;gap:3px;border-radius:5px;font-size:7px; }
        .wh65-marker { width:11px;height:11px;font-size:6px; }
        .wh65-meet-day { gap:3px;padding:3px; }
        .wh65-meet { min-height:25px;padding:4px;border-radius:6px;font-size:6.5px;gap:3px; }
        .wh65-meet-icon { width:14px;height:14px;font-size:8px; }
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
    host.setAttribute('aria-label', 'Waffle House month calendar');
    old.insertAdjacentElement('beforebegin', host);
    return host;
  }

  function syncButtonHtml() {
    return '<button type="button" class="wh65-btn wh65-sync" data-wh65-sync>↻ Sync</button>';
  }

  function renderToolbar(host) {
    const monthTitle = visibleMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    host.innerHTML = `
      <header class="wh65-toolbar">
        <div class="wh65-toolbar-left">
          <button type="button" class="wh65-btn" data-wh65-prev aria-label="Previous month">‹</button>
          <button type="button" class="wh65-btn" data-wh65-next aria-label="Next month">›</button>
          <button type="button" class="wh65-btn" data-wh65-today>Today</button>
        </div>
        <div class="wh65-title">${escapeHtml(monthTitle)}</div>
        <div class="wh65-toolbar-right">${syncButtonHtml()}</div>
      </header>
      <div class="wh65-legend" aria-label="Calendar key">
        <span class="wh65-legend-item"><i class="wh65-legend-swatch"></i>Confirmed Stay</span>
        <span class="wh65-legend-item"><i class="wh65-legend-potential"></i>Potential Stay</span>
        <span class="wh65-legend-item"><i class="wh65-legend-meet"></i>Meet &amp; Greet</span>
      </div>
      <div class="wh65-weekdays">${DAYS.map(day => `<span>${day}</span>`).join('')}</div>
      <div data-wh65-weeks></div>
    `;
  }

  function getEvents() {
    return adapter?.getEvents?.() || [];
  }

  function weekChunks() {
    const { gridStart, gridEnd } = monthBounds(visibleMonth);
    const all = dateRange(gridStart, gridEnd);
    const weeks = [];
    for (let index = 0; index < all.length; index += 7) weeks.push(all.slice(index, index + 7));
    return weeks;
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

  function dayCount(events, dateIso) {
    return events.filter(event => {
      const dates = eventDates(event);
      return eventType(event) === 'meet'
        ? dates.start === dateIso
        : dates.start <= dateIso && dateIso <= dates.end;
    }).length;
  }

  function renderWeek(week, events) {
    const weekStartIso = isoDate(week[0]);
    const weekEndIso = isoDate(week[6]);
    const { spans, laneCount } = allocateWeekLanes(events, weekStartIso, weekEndIso);
    const todayIso = isoDate(new Date());

    const datesHtml = week.map(date => {
      const dateIso = isoDate(date);
      const other = date.getMonth() !== visibleMonth.getMonth();
      const count = dayCount(events, dateIso);
      return `<div class="wh65-date${other ? ' is-other' : ''}${dateIso === todayIso ? ' is-today' : ''}"><span class="wh65-date-number">${date.getDate()}</span>${count ? `<span class="wh65-count">${count}</span>` : ''}</div>`;
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
      return `<div class="wh65-meet-day">${meets.map(event => `<button type="button" class="wh65-meet" data-wh65-event="${escapeHtml(eventKey(event))}"><span class="wh65-meet-icon">🤝</span><span class="wh65-meet-copy">${escapeHtml(eventTime(event))} - ${escapeHtml(dogName(event))}</span></button>`).join('')}</div>`;
    }).join('');

    const hasMeets = meetColumns.includes('data-wh65-event');

    return `<section class="wh65-week"><div class="wh65-dates">${datesHtml}</div><div class="wh65-timeline${laneCount ? '' : ' wh65-empty-timeline'}" style="grid-template-rows:repeat(${Math.max(1, laneCount)},28px)">${timelineItems}</div>${hasMeets ? `<div class="wh65-meets">${meetColumns}</div>` : ''}</section>`;
  }

  function render() {
    renderTimer = 0;
    if (!adapter) return;

    hideLegacyCalendarUi();
    const host = ensureHost();
    if (!host) return;

    renderToolbar(host);
    const events = getEvents();
    const weeks = weekChunks();
    const weeksHost = host.querySelector('[data-wh65-weeks]');
    weeksHost.innerHTML = weeks.map(week => renderWeek(week, events)).join('') || '<div class="wh65-empty">No calendar activity.</div>';
    wireHost(host);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => requestAnimationFrame(render), 40);
  }

  function navigateMonth(delta) {
    visibleMonth = addMonths(visibleMonth, delta);
    try { adapter.gotoDate?.(visibleMonth); } catch (_) {}
    scheduleRender();
  }

  function goToday() {
    visibleMonth = monthStart(new Date());
    try { adapter.today?.(); } catch (_) {}
    scheduleRender();
  }

  function invokeSync() {
    const oldSync = document.getElementById('manualRefreshBtn');
    if (oldSync) {
      oldSync.click();
      return;
    }
    try {
      if (typeof syncSpreadsheetData === 'function') syncSpreadsheetData();
    } catch (_) {}
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
    if (host.dataset.wh65Wired === VERSION) return;
    host.dataset.wh65Wired = VERSION;
    host.addEventListener('click', event => {
      if (event.target.closest('[data-wh65-prev]')) return navigateMonth(-1);
      if (event.target.closest('[data-wh65-next]')) return navigateMonth(1);
      if (event.target.closest('[data-wh65-today]')) return goToday();
      if (event.target.closest('[data-wh65-sync]')) return invokeSync();
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
    if (!adapter || adapter._wh65Bound || typeof adapter.on !== 'function') return;
    adapter._wh65Bound = true;
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
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  function attach() {
    const ref = getAdapter();
    if (!ref || typeof ref.getEvents !== 'function') return false;
    adapter = ref;
    captureAdapterHandlers();

    try {
      const current = adapter.getDate?.();
      if (current instanceof Date && !Number.isNaN(current.getTime())) visibleMonth = monthStart(current);
    } catch (_) {}

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
    window.addEventListener('resize', scheduleRender, { passive: true });
    window.v11165SingleCalendarVersion = VERSION;
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
