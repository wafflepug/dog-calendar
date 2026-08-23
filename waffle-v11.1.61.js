/* ============================================================
   WAFFLE HOUSE V11.1.61 — CLEAN MONTH CALENDAR
   ============================================================
   Replaces stacked multi-day bars with a daily occupancy summary.
   Desktop: capacity + up to 3 dog chips + compact M&G/Potential counts.
   Mobile: capacity/count only; tap a day for the complete roster.
   Existing FullCalendar data and event/date handlers remain authoritative.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.61';
  const FULL_CAPACITY = 4;
  const DESKTOP_DOG_LIMIT = 3;
  let calendar = null;
  let renderQueued = false;
  let lastSignature = '';
  let fallbackTimer = 0;

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

  function eventDates(event) {
    const props = event?.extendedProps || {};
    const start = isoDate(props.rawStartDate || props.startDate || event?.startStr || event?.start);
    let end = isoDate(props.rawEndDate || props.endDate || '');
    if (!end && event?.end) {
      const rawEnd = isoDate(event.endStr || event.end);
      end = event.allDay ? shiftDay(rawEnd, -1) : rawEnd;
    }
    return { start, end: end || start };
  }

  function dogName(event) {
    const props = event?.extendedProps || {};
    return String(props.dogName || event?.title || 'Guest')
      .replace(/^.*Meet\s*&\s*Greet:\s*/i, '')
      .replace(/^.*Potential(?:\s+Stay)?:\s*/i, '')
      .trim() || 'Guest';
  }

  function eventTime(event) {
    const direct = String(event?.extendedProps?.time || '').trim();
    if (direct) return direct;
    if (!event?.start || event?.allDay) return '';
    try {
      return event.start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function activeOn(event, date) {
    const dates = eventDates(event);
    if (!dates.start) return false;
    if (eventType(event) === 'meet') return dates.start === date;
    return dates.start <= date && date <= dates.end;
  }

  function dedupe(events) {
    const seen = new Set();
    return events.filter(event => {
      const dates = eventDates(event);
      const key = [eventType(event), dogName(event).toLowerCase(), dates.start, dates.end, eventTime(event)].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function eventsForDate(date) {
    const rows = calendar ? dedupe(calendar.getEvents().filter(event => activeOn(event, date))) : [];
    return {
      boarding: rows.filter(event => eventType(event) === 'boarding').sort((a, b) => dogName(a).localeCompare(dogName(b))),
      meet: rows.filter(event => eventType(event) === 'meet').sort((a, b) => eventTime(a).localeCompare(eventTime(b))),
      potential: rows.filter(event => eventType(event) === 'potential').sort((a, b) => dogName(a).localeCompare(dogName(b)))
    };
  }

  function tone(count) {
    if (count >= FULL_CAPACITY) return 'full';
    if (count === FULL_CAPACITY - 1) return 'busy';
    if (count > 0) return 'open';
    return 'clear';
  }

  function occupancyLabel(count) {
    if (count >= FULL_CAPACITY) return `${count} dogs · full`;
    if (count === 1) return '1 dog';
    return `${count} dogs`;
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
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }

  function shortRange(event) {
    const dates = eventDates(event);
    return dates.start === dates.end ? shortDate(dates.start) : `${shortDate(dates.start)} – ${shortDate(dates.end)}`;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureStyle() {
    if (document.getElementById('v11161CalendarStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11161CalendarStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-events,
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-more-link,
      body[data-waffle-page="calendar"] #calendar .capacity-indicator { display:none!important; }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-frame { min-height:128px; }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day.v11161-tone-clear { background:transparent!important; }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day.v11161-tone-open { background:color-mix(in srgb,#3b8260 3%,transparent)!important; }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day.v11161-tone-busy { background:color-mix(in srgb,#f59e0b 8%,transparent)!important; }
      body[data-waffle-page="calendar"] #calendar .fc-daygrid-day.v11161-tone-full { background:color-mix(in srgb,#ef4444 8%,transparent)!important; }
      .v11161-day-summary { padding:2px 5px 6px; }
      .v11161-day-button { width:100%;min-width:0;display:grid;gap:5px;padding:4px;border:0;border-radius:9px;background:transparent;color:inherit;text-align:left;cursor:pointer; }
      .v11161-day-button:hover { background:color-mix(in srgb,currentColor 5%,transparent); }
      .v11161-day-button:focus-visible { outline:2px solid #0ea5e9;outline-offset:1px; }
      .v11161-occupancy { display:flex;align-items:center;gap:5px;font-size:10px;font-weight:900;white-space:nowrap; }
      .v11161-dot { width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:#3b8260; }
      .v11161-tone-busy .v11161-dot { background:#f59e0b; }.v11161-tone-full .v11161-dot { background:#ef4444; }.v11161-tone-clear .v11161-dot { opacity:.4; }
      .v11161-dogs { display:grid;gap:3px; }.v11161-dog { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 6px;border-radius:6px;background:color-mix(in srgb,#2563eb 13%,transparent);border:1px solid color-mix(in srgb,#2563eb 24%,transparent);font-size:9px;font-weight:800;line-height:1.2; }
      .v11161-view-all { font-size:8px;font-weight:900;opacity:.72; }.v11161-meta { display:flex;flex-wrap:wrap;gap:4px;min-height:14px; }
      .v11161-pill { padding:2px 5px;border-radius:999px;font-size:8px;font-weight:900;line-height:1.15; }.v11161-pill.meet { background:color-mix(in srgb,#0f8c80 16%,transparent); }.v11161-pill.potential { background:color-mix(in srgb,#f59e0b 18%,transparent); }
      .v11161-mobile-count { display:none; }
      #calendarEventLegend { display:none!important; }
      .v11161-legend { display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin:10px 0 0;padding:9px 12px;border:1px solid #334155;border-radius:10px;font-size:10px;font-weight:800; }
      .v11161-legend span { display:inline-flex;align-items:center;gap:5px; }.v11161-legend i { width:8px;height:8px;border-radius:50%;display:inline-block; }
      .v11161-legend .available i { background:#3b8260; }.v11161-legend .busy i { background:#f59e0b; }.v11161-legend .full i { background:#ef4444; }
      .v11161-day-modal { position:fixed;inset:0;z-index:2147482500;display:grid;place-items:center;padding:20px;background:rgba(5,12,24,.68);backdrop-filter:blur(3px); }.v11161-day-modal[hidden] { display:none!important; }
      .v11161-day-panel { width:min(560px,100%);max-height:min(720px,88vh);overflow:auto;border:1px solid #334155;border-radius:18px;background:#172033;color:#f8fafc;box-shadow:0 24px 70px rgba(0,0,0,.35); }
      .v11161-day-head { position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:14px;padding:16px 18px;background:#172033;border-bottom:1px solid #334155; }.v11161-day-head small { display:block;font-size:9px;font-weight:900;letter-spacing:.08em;color:#38bdf8; }.v11161-day-head h3 { margin:3px 0 2px;font-size:18px; }.v11161-day-head p { margin:0;font-size:11px;color:#a9b6c9; }
      .v11161-close { width:38px;height:38px;border:0;border-radius:50%;background:#22304a;color:#fff;font-size:18px;cursor:pointer; }.v11161-day-body { display:grid;gap:14px;padding:16px 18px 18px; }
      .v11161-section { display:grid;gap:7px; }.v11161-section-title { display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;font-weight:900; }.v11161-section-title span { min-width:24px;height:24px;display:grid;place-items:center;border-radius:999px;background:#22304a;font-size:9px; }
      .v11161-roster { display:grid;gap:7px; }.v11161-row { width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:10px 12px;border:1px solid #334155;border-radius:12px;background:#1b2940;color:#f8fafc;text-align:left; }.v11161-row.is-button { cursor:pointer; }
      .v11161-row strong,.v11161-row span,.v11161-row small { display:block; }.v11161-row strong { font-size:12px; }.v11161-row span { margin-top:2px;font-size:9px;color:#a9b6c9; }.v11161-row small { font-size:9px;font-weight:900;color:#7dd3fc; }
      .v11161-empty { padding:12px;border:1px dashed #334155;border-radius:11px;color:#93a4ba;font-size:10px; }.v11161-day-actions { display:flex;justify-content:flex-end; }.v11161-add { min-height:40px;padding:0 14px;border:0;border-radius:10px;background:#0f79a9;color:#fff;font-weight:900;cursor:pointer; }
      @media(max-width:700px) {
        body[data-waffle-page="calendar"] #calendar .fc-toolbar { gap:8px;flex-wrap:wrap; }
        body[data-waffle-page="calendar"] #calendar .fc-toolbar-title { font-size:16px!important; }
        body[data-waffle-page="calendar"] #calendar .fc-daygrid-day-frame { min-height:74px; }
        .v11161-day-summary { padding:1px 2px 3px; }.v11161-day-button { gap:3px;padding:2px;place-items:center; }.v11161-occupancy { justify-content:center;font-size:9px; }.v11161-label { display:none; }.v11161-mobile-count { display:inline;font-size:9px;font-weight:900; }.v11161-dot { width:7px;height:7px; }
        .v11161-dogs,.v11161-view-all { display:none; }.v11161-meta { justify-content:center;gap:2px; }.v11161-pill { padding:2px 3px;font-size:0; }.v11161-pill b { font-size:8px; }
        .v11161-legend { gap:8px;padding:8px 7px;font-size:8px; }.v11161-day-modal { align-items:end;padding:0; }.v11161-day-panel { width:100%;max-height:82vh;border-radius:18px 18px 0 0;border-left:0;border-right:0;border-bottom:0; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureLegend() {
    if (document.getElementById('v11161CalendarLegend')) return;
    const host = document.getElementById('calendar');
    if (!host) return;
    const legend = document.createElement('div');
    legend.id = 'v11161CalendarLegend';
    legend.className = 'v11161-legend';
    legend.setAttribute('aria-label', 'Calendar key');
    legend.innerHTML = '<span class="available"><i></i>Available</span><span class="busy"><i></i>Busy</span><span class="full"><i></i>4+ dogs</span><span>🤝 Meet & Greet</span><span>❓ Potential</span>';
    host.insertAdjacentElement('afterend', legend);
  }

  function ensureModal() {
    let modal = document.getElementById('v11161DayModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v11161DayModal';
    modal.className = 'v11161-day-modal';
    modal.hidden = true;
    modal.innerHTML = '<section class="v11161-day-panel" role="dialog" aria-modal="true" aria-labelledby="v11161DayTitle"><header class="v11161-day-head"><div><small>DAY AT WAFFLE HOUSE</small><h3 id="v11161DayTitle">Day details</h3><p data-v11161-day-summary></p></div><button type="button" class="v11161-close" aria-label="Close day details">×</button></header><div class="v11161-day-body" data-v11161-day-body></div></section>';
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.v11161-close')) {
        modal.hidden = true;
        return;
      }
      const row = event.target.closest('[data-v11161-event-index]');
      if (row) {
        const record = (modal._waffleEvents || [])[Number(row.dataset.v11161EventIndex)];
        if (record) openEvent(record, row, event);
        return;
      }
      const add = event.target.closest('[data-v11161-add-date]');
      if (add) openDate(add.dataset.v11161AddDate, event);
    });
    return modal;
  }

  function rowDetail(event, type) {
    if (type === 'meet') return [eventTime(event), 'Meet & Greet'].filter(Boolean).join(' · ');
    if (type === 'potential') return `Potential · ${shortRange(event)}`;
    return `Boarding · ${shortRange(event)}`;
  }

  function rowHtml(event, index, type) {
    const clickable = calendar && typeof calendar.getOption('eventClick') === 'function';
    const tag = clickable ? 'button' : 'div';
    const attr = clickable ? ` type="button" data-v11161-event-index="${index}"` : '';
    return `<${tag} class="v11161-row${clickable ? ' is-button' : ''}"${attr}><div><strong>${escapeHtml(dogName(event))}</strong><span>${escapeHtml(rowDetail(event, type))}</span></div><small>${clickable ? 'Open ›' : ''}</small></${tag}>`;
  }

  function sectionHtml(label, icon, rows, allRows, type) {
    if (!rows.length) return '';
    return `<section class="v11161-section"><div class="v11161-section-title"><strong>${icon} ${label}</strong><span>${rows.length}</span></div><div class="v11161-roster">${rows.map(event => rowHtml(event, allRows.indexOf(event), type)).join('')}</div></section>`;
  }

  function openDay(date) {
    const modal = ensureModal();
    const data = eventsForDate(date);
    const all = [...data.boarding, ...data.meet, ...data.potential];
    modal._waffleEvents = all;
    modal.querySelector('#v11161DayTitle').textContent = dateLabel(date);
    modal.querySelector('[data-v11161-day-summary]').textContent = occupancyLabel(data.boarding.length);
    modal.querySelector('[data-v11161-day-body]').innerHTML = [
      sectionHtml('Boarding', '🐶', data.boarding, all, 'boarding'),
      sectionHtml('Meet & Greet', '🤝', data.meet, all, 'meet'),
      sectionHtml('Potential', '❓', data.potential, all, 'potential'),
      !all.length ? '<div class="v11161-empty">Nothing is scheduled for this day.</div>' : '',
      calendar && typeof calendar.getOption('dateClick') === 'function' ? `<div class="v11161-day-actions"><button type="button" class="v11161-add" data-v11161-add-date="${date}">＋ Add to this day</button></div>` : ''
    ].join('');
    modal.hidden = false;
    modal.querySelector('.v11161-close')?.focus();
  }

  function openEvent(eventRecord, element, jsEvent) {
    const handler = calendar?.getOption?.('eventClick');
    if (typeof handler !== 'function') return;
    try {
      handler({ event: eventRecord, el: element, jsEvent, view: calendar.view });
      ensureModal().hidden = true;
    } catch (error) {
      console.warn('Calendar event could not be opened:', error);
    }
  }

  function openDate(dateStr, jsEvent) {
    const handler = calendar?.getOption?.('dateClick');
    if (typeof handler !== 'function') return;
    const parts = dateStr.split('-').map(Number);
    try {
      handler({ date: new Date(parts[0], parts[1] - 1, parts[2]), dateStr, allDay: true, dayEl: null, jsEvent, view: calendar.view });
      ensureModal().hidden = true;
    } catch (error) {
      console.warn('Calendar date action could not be opened:', error);
    }
  }

  function renderCell(cell) {
    const date = String(cell.dataset.date || '');
    const frame = cell.querySelector('.fc-daygrid-day-frame');
    if (!date || !frame) return;
    const data = eventsForDate(date);
    const count = data.boarding.length;
    const state = tone(count);
    cell.classList.remove('v11161-tone-clear', 'v11161-tone-open', 'v11161-tone-busy', 'v11161-tone-full');
    cell.classList.add(`v11161-tone-${state}`);

    let host = frame.querySelector(':scope > .v11161-day-summary');
    if (!host) {
      host = document.createElement('div');
      host.className = 'v11161-day-summary';
      const top = frame.querySelector(':scope > .fc-daygrid-day-top');
      if (top?.nextSibling) frame.insertBefore(host, top.nextSibling);
      else frame.appendChild(host);
    }

    const visible = data.boarding.slice(0, DESKTOP_DOG_LIMIT);
    host.innerHTML = `<button type="button" class="v11161-day-button" aria-label="${escapeHtml(dateLabel(date))}: ${escapeHtml(occupancyLabel(count))}. Open full day details."><span class="v11161-occupancy"><i class="v11161-dot"></i><span class="v11161-label">${escapeHtml(occupancyLabel(count))}</span><span class="v11161-mobile-count">🐶 ${count}</span></span>${visible.length ? `<span class="v11161-dogs">${visible.map(event => `<span class="v11161-dog">${escapeHtml(dogName(event))}</span>`).join('')}</span>` : ''}${data.boarding.length > DESKTOP_DOG_LIMIT ? `<span class="v11161-view-all">View all ${data.boarding.length} dogs</span>` : ''}<span class="v11161-meta">${data.meet.length ? `<span class="v11161-pill meet">🤝 <b>${data.meet.length}</b></span>` : ''}${data.potential.length ? `<span class="v11161-pill potential">❓ <b>${data.potential.length}</b></span>` : ''}</span></button>`;
    host.querySelector('button')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openDay(date);
    });
  }

  function signature() {
    if (!calendar) return '';
    return calendar.getEvents().map(event => {
      const dates = eventDates(event);
      return [event.id, eventType(event), dogName(event), dates.start, dates.end, eventTime(event)].join('|');
    }).sort().join('~');
  }

  function render() {
    renderQueued = false;
    if (!calendar || !document.getElementById('calendar')) return;
    lastSignature = signature();
    document.querySelectorAll('#calendar .fc-daygrid-day[data-date]').forEach(renderCell);
    ensureLegend();
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => requestAnimationFrame(render));
  }

  function hasMissingSummaries() {
    return Array.from(document.querySelectorAll('#calendar .fc-daygrid-day[data-date]')).some(cell => !cell.querySelector('.v11161-day-summary'));
  }

  function attach() {
    const ref = getCalendar();
    if (!ref || typeof ref.getEvents !== 'function') return false;
    calendar = ref;
    ensureStyle();
    ensureModal();
    ensureLegend();

    if (typeof calendar.on === 'function' && !calendar._v11161Bound) {
      calendar._v11161Bound = true;
      ['eventsSet', 'datesSet', 'eventAdd', 'eventChange', 'eventRemove'].forEach(name => {
        try { calendar.on(name, scheduleRender); } catch (_) {}
      });
    }

    if (!fallbackTimer) {
      fallbackTimer = window.setInterval(() => {
        if (!calendar || document.hidden) return;
        if (signature() !== lastSignature || hasMissingSummaries()) scheduleRender();
      }, 1800);
    }

    window.addEventListener('resize', scheduleRender, { passive: true });
    scheduleRender();
    window.v11161CleanCalendarVersion = VERSION;
    return true;
  }

  function start() {
    if (pageName() !== 'calendar') return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attach() || attempts > 80) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();