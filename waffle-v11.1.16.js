/* ============================================================
   WAFFLE HOUSE V11.1.16 — CALENDAR NAV + BRAND HEADER POLISH
   ============================================================ */

(function () {
  'use strict';

  function pageName() {
    return String(document.body?.dataset?.wafflePage || 'calendar');
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureOrganiserLabel() {
    document.querySelectorAll('a[href$="reminders.html"] .nav-label, [data-page-link="reminders"] .nav-label')
      .forEach(label => { label.textContent = 'Organiser'; });
  }

  function ensureCalendarNavState() {
    if (pageName() !== 'calendar') return;

    const nav = document.querySelector('.app-tabs');
    if (!nav) return;

    nav.classList.add('v11116-calendar-nav');

    nav.querySelectorAll('[data-page-link]').forEach(link => {
      const active = link.dataset.pageLink === 'calendar';
      link.classList.toggle('active', active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  function makeLogoClickable() {
    document.querySelectorAll('.calendar-header-branding').forEach(header => {
      const logo = header.querySelector('.calendar-brand-logo');
      if (!logo) return;

      const existing = logo.closest('a.v11116-brand-home-link');
      if (existing) return;

      const link = document.createElement('a');
      link.href = 'index.html';
      link.className = 'v11116-brand-home-link';
      link.setAttribute('aria-label', 'Return to Calendar');
      link.title = 'Return to Calendar';

      logo.parentNode.insertBefore(link, logo);
      link.appendChild(logo);
    });
  }

  function polishBrandHeader() {
    document.querySelectorAll('.calendar-header-branding').forEach(header => {
      header.classList.add('v11116-branding');

      const copy = header.querySelector('.calendar-brand-copy');
      if (copy) copy.classList.add('v11116-brand-copy');

      const subtitle = header.querySelector('.calendar-brand-subtitle');
      if (subtitle && /premium dog boarding/i.test(subtitle.textContent || '')) {
        subtitle.textContent = 'Premium Dog Boarding';
      }
    });
  }

  function dateKey(date) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) return '';
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  }

  function todayKey() {
    try {
      if (typeof window.getLocalTodayDateString === 'function') return window.getLocalTodayDateString();
    } catch (_) {}
    return dateKey(new Date());
  }

  function addDaysKey(key, days) {
    const parts = String(key || '').split('-').map(Number);
    const date = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date();
    date.setDate(date.getDate() + Number(days || 0));
    return dateKey(date);
  }

  function eventDates(event) {
    try {
      if (typeof window.v10EventRawDates === 'function') return window.v10EventRawDates(event);
    } catch (_) {}

    const start = String(event?.startStr || '').slice(0, 10) || dateKey(event?.start);
    let end = start;
    if (event?.end) {
      const date = new Date(event.end);
      date.setDate(date.getDate() - 1);
      end = dateKey(date);
    }
    return { start, end };
  }

  function calendarEvents() {
    try {
      if (window.globalCalendar && typeof window.globalCalendar.getEvents === 'function') return window.globalCalendar.getEvents().slice();
    } catch (_) {}
    try {
      if (typeof v110LatestCalendarEvents !== 'undefined' && Array.isArray(v110LatestCalendarEvents)) return v110LatestCalendarEvents.slice();
    } catch (_) {}
    return [];
  }

  function isBoardingEvent(event) {
    const props = event?.extendedProps || {};
    if (props.isPotential === true || props.isMeetGreet === true) return false;
    try {
      if (typeof window.v110IsCheckedOutEvent === 'function' && window.v110IsCheckedOutEvent(event)) return false;
    } catch (_) {}
    return true;
  }

  function dogName(event) {
    const props = event?.extendedProps || {};
    return String(props.dogName || event?.title || 'Guest').trim() || 'Guest';
  }

  function formatDate(value) {
    try {
      if (typeof window.formatStayDateShort === 'function') return window.formatStayDateShort(value);
    } catch (_) {}
    const parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3) return String(value || '');
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function arrivingEvents() {
    const today = todayKey();
    const horizon = addDaysKey(today, 30);
    return calendarEvents()
      .filter(isBoardingEvent)
      .filter(event => {
        const start = eventDates(event).start;
        return start && start >= today && start <= horizon;
      })
      .sort((a, b) => eventDates(a).start.localeCompare(eventDates(b).start) || dogName(a).localeCompare(dogName(b)));
  }

  function leavingEvents() {
    const today = todayKey();
    const horizon = addDaysKey(today, 7);
    return calendarEvents()
      .filter(isBoardingEvent)
      .filter(event => {
        const end = eventDates(event).end;
        return end && end >= today && end <= horizon;
      })
      .sort((a, b) => eventDates(a).end.localeCompare(eventDates(b).end) || dogName(a).localeCompare(dogName(b)));
  }

  function ensureSummaryModal() {
    let modal = document.getElementById('v11116CalendarSummaryModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'v11116CalendarSummaryModal';
    modal.className = 'v108-modal v11116-calendar-summary-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v108-modal-card v11116-calendar-summary-card">
        <div class="v108-modal-head v11116-calendar-summary-head">
          <div>
            <small data-v11116-modal-kicker>CALENDAR</small>
            <h3 data-v11116-modal-title></h3>
            <p data-v11116-modal-copy></p>
          </div>
          <button type="button" data-v11116-modal-close aria-label="Close">×</button>
        </div>
        <div class="v11116-calendar-summary-list" data-v11116-modal-list></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-v11116-modal-close]')) modal.hidden = true;
    });
    return modal;
  }

  function petRows(events, dateField) {
    if (!events.length) {
      return '<div class="v11116-calendar-empty"><span>✓</span><strong>Nothing scheduled</strong><small>No pets match this period.</small></div>';
    }

    return events.map(event => {
      const props = event?.extendedProps || {};
      const dates = eventDates(event);
      const date = dateField === 'end' ? dates.end : dates.start;
      return `
        <article class="v11116-calendar-pet-row">
          <span class="v11116-calendar-pet-icon">🐾</span>
          <div>
            <strong>${esc(dogName(event))}</strong>
            <span>${esc(props.breed && props.breed !== 'N/A' ? props.breed : 'Breed not recorded')}</span>
          </div>
          <time>${esc(formatDate(date))}</time>
        </article>`;
    }).join('');
  }

  function openPetModal(kind) {
    const modal = ensureSummaryModal();
    const arrivals = kind === 'arrivals';
    const events = arrivals ? arrivingEvents() : leavingEvents();
    modal.querySelector('[data-v11116-modal-kicker]').textContent = arrivals ? 'NEXT 30 DAYS' : 'NEXT 7 DAYS';
    modal.querySelector('[data-v11116-modal-title]').textContent = arrivals ? '🛬 Arriving' : '👋 Leaving';
    modal.querySelector('[data-v11116-modal-copy]').textContent = arrivals
      ? 'Confirmed boarding pets arriving from today through the next 30 days.'
      : 'Confirmed boarding pets scheduled to leave from today through the next 7 days.';
    modal.querySelector('[data-v11116-modal-list]').innerHTML = petRows(events, arrivals ? 'start' : 'end');
    modal.hidden = false;
  }

  function wireCalendarSummaryTiles() {
    if (pageName() !== 'calendar' || window.v11116CalendarSummaryWired) return;
    window.v11116CalendarSummaryWired = true;

    document.addEventListener('click', event => {
      const arrival = event.target.closest('[data-v10-jump="arrivals"]');
      if (arrival) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPetModal('arrivals');
        return;
      }

      const leaving = event.target.closest('[data-v10-jump="departures"]');
      if (leaving) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPetModal('leaving');
      }
    }, true);
  }

  function prepareCapacityCard() {
    if (pageName() !== 'calendar') return;
    const card = document.querySelector('.v10-capacity-card');
    if (!card) return;

    /* Capacity stays as the native 7-day Outlook. Do not turn the whole card
       into a second feature window; individual day interactions remain owned
       by the underlying Calendar capacity behaviour. */
    card.classList.remove('v11116-capacity-clickable');
    card.removeAttribute('role');
    card.removeAttribute('tabindex');
    if (card.getAttribute('aria-label') === 'Open Capacity details') card.removeAttribute('aria-label');
    delete card.dataset.v11116Keyboard;
  }

  function apply() {
    ensureOrganiserLabel();
    ensureCalendarNavState();
    makeLogoClickable();
    polishBrandHeader();
    prepareCapacityCard();
  }

  function start() {
    apply();
    wireCalendarSummaryTiles();

    // Bounded follow-up passes cover late-loaded header/actions and Calendar
    // rendering without introducing a persistent MutationObserver.
    [80, 250, 700, 1400].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
