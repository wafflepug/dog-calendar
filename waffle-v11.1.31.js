/* ============================================================
   WAFFLE HOUSE V11.1.31 — CLEAN CALENDAR + DAY AGENDA
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.31';
  const MAX_ROWS = 3;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function esc(value) {
    try {
      if (typeof window.escapeDashboardHtml === 'function') {
        return window.escapeDashboardHtml(value == null ? '' : String(value));
      }
    } catch (_) {}

    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

  function localDateKey(value) {
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
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

    const start = String(event?.startStr || '').slice(0, 10) || localDateKey(event?.start);
    let end = start;

    if (event?.end) {
      const endDate = new Date(event.end);
      if (!Number.isNaN(endDate.getTime())) {
        if (event.allDay !== false) endDate.setDate(endDate.getDate() - 1);
        end = localDateKey(endDate) || start;
      }
    }

    return { start, end };
  }

  function eventProps(event) {
    return event?.extendedProps || {};
  }

  function isMeet(event) {
    const props = eventProps(event);
    return props.isMeetGreet === true || /meet\s*&?\s*greet/i.test(String(event?.title || ''));
  }

  function isPotential(event) {
    return eventProps(event).isPotential === true;
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

  function dogName(event) {
    const props = eventProps(event);
    const direct = String(props.dogName || '').trim();
    if (direct) return direct;

    let title = String(event?.title || 'Guest').trim();
    title = title.replace(/^.*?Meet\s*&?\s*Greet:\s*/i, '').trim();

    if (/\s[-–—]\s/.test(title)) {
      const first = title.split(/\s[-–—]\s/)[0].trim();
      if (first) return first;
    }

    return title || 'Guest';
  }

  function meetTime(event) {
    const props = eventProps(event);
    const time = String(props.time || '').trim();
    if (time) return time;

    if (event?.start && event.allDay === false) {
      try {
        return event.start.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
      } catch (_) {}
    }

    const match = String(event?.title || '').match(/\b(\d{1,2}:\d{2})\b/);
    return match ? match[1] : '';
  }

  function compactEventContent(arg) {
    const event = arg?.event;
    if (!event) return;

    if (isMeet(event)) {
      const time = meetTime(event);
      return {
        html: `<span class="v11131-event-label v11131-meet-label"><span aria-hidden="true">⏰</span><span>${esc(time || 'M&G')}</span>${time ? '<span class="v11131-meet-type">M&G</span>' : ''}</span>`
      };
    }

    if (isPotential(event)) {
      return {
        html: `<span class="v11131-event-label v11131-potential-label"><span aria-hidden="true">?</span><span>${esc(dogName(event))}</span></span>`
      };
    }

    return {
      html: `<span class="v11131-event-label v11131-boarding-label">${esc(dogName(event))}</span>`
    };
  }

  function eventOccursOn(event, date) {
    const dates = rawDates(event);
    return !!dates.start && !!dates.end && date >= dates.start && date <= dates.end;
  }

  function eventsForDate(date) {
    const calendar = calendarInstance();
    if (!calendar) return [];

    return calendar.getEvents()
      .filter(event => eventOccursOn(event, date))
      .sort((a, b) => {
        const am = isMeet(a) ? 1 : 0;
        const bm = isMeet(b) ? 1 : 0;
        if (am !== bm) return am - bm;
        return dogName(a).localeCompare(dogName(b));
      });
  }

  function capacityForDate(date, events) {
    const count = events.filter(event => isBoarding(event) && eventOccursOn(event, date)).length;
    if (count >= 4) return { count, label: 'Full capacity', tone: 'full' };
    if (count === 3) return { count, label: 'Busy', tone: 'busy' };
    return { count, label: count ? 'Available' : 'No boarders', tone: 'available' };
  }

  function formatAgendaDate(date) {
    const parts = String(date || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return String(date || '');
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function eventMeta(event) {
    const props = eventProps(event);
    const dates = rawDates(event);
    const breed = String(props.breed || '').trim();
    const range = dates.start === dates.end ? dates.start : `${dates.start} → ${dates.end}`;
    return [breed && breed !== 'N/A' ? breed : '', range].filter(Boolean).join(' · ');
  }

  function agendaRow(event, icon, badge) {
    const title = isMeet(event)
      ? `${meetTime(event) ? meetTime(event) + ' · ' : ''}${dogName(event)}`
      : dogName(event);

    return `
      <article class="v11131-agenda-row">
        <span class="v11131-agenda-icon" aria-hidden="true">${icon}</span>
        <div class="v11131-agenda-copy">
          <strong>${esc(title)}</strong>
          <span>${esc(eventMeta(event))}</span>
        </div>
        ${badge ? `<small class="v11131-agenda-badge">${esc(badge)}</small>` : ''}
      </article>`;
  }

  function agendaSection(label, items, icon, badge) {
    if (!items.length) return '';
    return `
      <section class="v11131-agenda-section">
        <div class="v11131-agenda-section-head">
          <h4>${esc(label)}</h4>
          <span>${items.length}</span>
        </div>
        <div class="v11131-agenda-list">
          ${items.map(event => agendaRow(event, icon, badge)).join('')}
        </div>
      </section>`;
  }

  function ensureAgendaModal() {
    let modal = document.getElementById('v11131DayAgendaModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'v11131DayAgendaModal';
    modal.className = 'v108-modal v11131-day-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v108-modal-card v11131-day-card" role="dialog" aria-modal="true" aria-labelledby="v11131DayAgendaTitle">
        <div class="v11131-day-head">
          <div>
            <small>DAY AGENDA</small>
            <h3 id="v11131DayAgendaTitle">Calendar day</h3>
          </div>
          <button type="button" data-v11131-day-close aria-label="Close">×</button>
        </div>
        <div class="v11131-capacity-summary" data-v11131-capacity-summary></div>
        <div class="v11131-agenda-sections" data-v11131-agenda-sections></div>
      </div>`;

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-v11131-day-close]')) {
        modal.hidden = true;
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  function openDayAgenda(date) {
    if (!date) return;

    const modal = ensureAgendaModal();
    const events = eventsForDate(date);
    const capacity = capacityForDate(date, events);
    const title = modal.querySelector('#v11131DayAgendaTitle');
    const summary = modal.querySelector('[data-v11131-capacity-summary]');
    const sections = modal.querySelector('[data-v11131-agenda-sections]');

    if (title) title.textContent = formatAgendaDate(date);

    if (summary) {
      summary.innerHTML = `
        <span class="v11131-capacity-dot is-${capacity.tone}" aria-hidden="true"></span>
        <div><small>CAPACITY</small><strong>${capacity.count} dog${capacity.count === 1 ? '' : 's'} · ${esc(capacity.label)}</strong></div>`;
    }

    const meets = events.filter(isMeet);
    const potentials = events.filter(isPotential);
    const boarding = events.filter(isBoarding);
    const arriving = boarding.filter(event => rawDates(event).start === date);
    const leaving = boarding.filter(event => rawDates(event).end === date);
    const atHome = boarding.filter(event => {
      const dates = rawDates(event);
      return dates.start < date && dates.end > date;
    });

    const html = [
      agendaSection('Arriving', arriving, '🛬', 'Arrival'),
      agendaSection('At Home', atHome, '🏡', 'Boarding'),
      agendaSection('Leaving', leaving, '👋', 'Departure'),
      agendaSection('Meet & Greets', meets, '⏰', 'Meet & Greet'),
      agendaSection('Potential Stays', potentials, '❓', 'Potential')
    ].join('');

    if (sections) {
      sections.innerHTML = html || `
        <div class="v11131-agenda-empty">
          <span aria-hidden="true">📅</span>
          <strong>No scheduled activity</strong>
          <small>Use the centre Add button when you need to create something new.</small>
        </div>`;
    }

    modal.dataset.date = date;
    modal.hidden = false;
  }

  function softenCapacityIndicators() {
    document.querySelectorAll('#calendar .capacity-indicator').forEach(indicator => {
      indicator.textContent = '';
      indicator.classList.add('v11131-capacity-indicator');
    });
  }

  function installDayInteraction() {
    const root = document.getElementById('calendar');
    if (!root || root.dataset.v11131DayInteraction === 'true') return;

    root.dataset.v11131DayInteraction = 'true';

    /* Capture before FullCalendar's historical dateClick callback. Date-cell
       taps now expand the day; creating items remains on the centre Add button. */
    root.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest('.fc-event')) return;

      const cell = target.closest('.fc-daygrid-day[data-date]');
      if (!cell) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      openDayAgenda(String(cell.getAttribute('data-date') || ''));
    }, true);
  }

  function configureCalendar() {
    if (pageName() !== 'calendar') return;

    const calendar = calendarInstance();
    if (!calendar || typeof calendar.setOption !== 'function') return;

    try { calendar.setOption('dayMaxEvents', false); } catch (_) {}
    try { calendar.setOption('dayMaxEventRows', MAX_ROWS); } catch (_) {}
    try { calendar.setOption('moreLinkClick', 'popover'); } catch (_) {}
    try { calendar.setOption('eventContent', compactEventContent); } catch (_) {}

    try { calendar.v11128DensityVersion = '11.1.28'; } catch (_) {}
    try { calendar.v11131CompactCalendar = VERSION; } catch (_) {}

    try {
      if (typeof calendar.rerenderEvents === 'function') calendar.rerenderEvents();
    } catch (_) {}

    try {
      if (typeof calendar.updateSize === 'function') calendar.updateSize();
    } catch (_) {}

    installDayInteraction();
    softenCapacityIndicators();
  }

  function apply() {
    if (pageName() !== 'calendar') return;
    configureCalendar();
    installDayInteraction();
    softenCapacityIndicators();
  }

  function start() {
    apply();

    /* Older V11.1.28/V11.1.30 layers use bounded delayed passes. These final
       passes deliberately finish after them so the compact calendar owns the
       stable final state without a permanent observer. */
    [80, 220, 520, 950, 1600, 2700, 3900, 5100, 6100].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('resize', () => setTimeout(apply, 130));
    window.v11131OpenDayAgenda = openDayAgenda;
    window.v11131CalendarVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
