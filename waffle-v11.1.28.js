/* ============================================================
   WAFFLE HOUSE V11.1.28 — OPERATIONS + PROFILE UI REFINEMENT
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.28';
  const departureState = { today: [], future: [] };

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

  function dateKey(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  function todayKey() {
    try {
      if (typeof window.getLocalTodayDateString === 'function') return window.getLocalTodayDateString();
    } catch (_) {}
    try {
      if (typeof getLocalTodayDateString === 'function') return getLocalTodayDateString();
    } catch (_) {}
    return dateKey(new Date());
  }

  function addDaysKey(key, days) {
    const parts = String(key || '').split('-').map(Number);
    const date = parts.length === 3
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();
    date.setDate(date.getDate() + Number(days || 0));
    return dateKey(date);
  }

  function eventDates(event) {
    try {
      if (typeof window.v10EventRawDates === 'function') return window.v10EventRawDates(event);
    } catch (_) {}
    try {
      if (typeof v10EventRawDates === 'function') return v10EventRawDates(event);
    } catch (_) {}

    const start = String(event?.startStr || '').slice(0, 10) || dateKey(event?.start);
    let end = start;
    if (event?.end) {
      const raw = new Date(event.end);
      if (!Number.isNaN(raw.getTime())) {
        raw.setDate(raw.getDate() - 1);
        end = dateKey(raw);
      }
    }
    return { start, end };
  }

  function calendarEvents() {
    try {
      if (window.globalCalendar && typeof window.globalCalendar.getEvents === 'function') {
        return window.globalCalendar.getEvents().slice();
      }
    } catch (_) {}
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar && typeof globalCalendar.getEvents === 'function') {
        return globalCalendar.getEvents().slice();
      }
    } catch (_) {}
    try {
      if (typeof v110LatestCalendarEvents !== 'undefined' && Array.isArray(v110LatestCalendarEvents)) {
        return v110LatestCalendarEvents.slice();
      }
    } catch (_) {}
    return [];
  }

  function dogName(event) {
    const props = event?.extendedProps || {};
    return String(props.dogName || event?.title || 'Guest').trim() || 'Guest';
  }

  function isCheckedOut(event) {
    try {
      if (typeof window.v110IsCheckedOutEvent === 'function') return window.v110IsCheckedOutEvent(event) === true;
    } catch (_) {}
    try {
      if (typeof v110IsCheckedOutEvent === 'function') return v110IsCheckedOutEvent(event) === true;
    } catch (_) {}
    return false;
  }

  function isBoarding(event) {
    const props = event?.extendedProps || {};
    if (props.isPotential === true || props.isMeetGreet === true) return false;
    return !isCheckedOut(event);
  }

  function formatDate(value) {
    try {
      if (typeof window.formatStayDateShort === 'function') return window.formatStayDateShort(value);
    } catch (_) {}
    try {
      if (typeof formatStayDateShort === 'function') return formatStayDateShort(value);
    } catch (_) {}

    const parts = String(value || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return String(value || '');
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short'
    });
  }

  function departureSets() {
    const today = todayKey();
    const horizon = addDaysKey(today, 7);
    const eligible = calendarEvents().filter(isBoarding);

    const sorter = (a, b) => {
      const dateCompare = eventDates(a).end.localeCompare(eventDates(b).end);
      return dateCompare || dogName(a).localeCompare(dogName(b));
    };

    return {
      today: eligible
        .filter(event => eventDates(event).end === today)
        .sort(sorter),
      future: eligible
        .filter(event => {
          const end = eventDates(event).end;
          return end > today && end <= horizon;
        })
        .sort(sorter)
    };
  }

  function stayKeyForEvent(event) {
    try {
      if (typeof window.v110StayKeyForEvent === 'function') return window.v110StayKeyForEvent(event);
    } catch (_) {}
    try {
      if (typeof v110StayKeyForEvent === 'function') return v110StayKeyForEvent(event);
    } catch (_) {}
    const dates = eventDates(event);
    return [dogName(event).toLowerCase(), dates.start, dates.end].join('|');
  }

  function operationalPayload(event) {
    const props = event?.extendedProps || {};
    const dates = eventDates(event);
    return {
      stayKey: String(stayKeyForEvent(event) || ''),
      dogName: dogName(event),
      breed: String(props.breed || ''),
      startDate: dates.start,
      endDate: dates.end,
      ownerName: String(props.ownerName || props.owner || ''),
      phone: String(props.phone || '')
    };
  }

  function departureRow(event, index, today) {
    const props = event?.extendedProps || {};
    const dates = eventDates(event);
    return `
      <article class="v11128-departure-row">
        <span class="v11128-departure-icon" aria-hidden="true">🐾</span>
        <div class="v11128-departure-copy">
          <strong>${esc(dogName(event))}</strong>
          <span>${esc(props.breed && props.breed !== 'N/A' ? props.breed : 'Breed not recorded')}</span>
          ${today ? `<small>${esc(formatDate(dates.start))} → ${esc(formatDate(dates.end))}</small>` : ''}
        </div>
        ${today
          ? `<button type="button" class="v110-checkout-button" data-v11128-checkout="${index}">👋 Check Out</button>`
          : `<time class="v11128-departure-date">${esc(formatDate(dates.end))}</time>`}
      </article>`;
  }

  function emptyDeparture(message, copy) {
    return `
      <div class="v11128-departure-empty">
        <span aria-hidden="true">✅</span>
        <strong>${esc(message)}</strong>
        <small>${esc(copy)}</small>
      </div>`;
  }

  function ensureDepartureModal() {
    let modal = document.getElementById('v11128DepartureModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'v11128DepartureModal';
    modal.className = 'v108-modal v11128-departure-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v108-modal-card v11128-departure-card" role="dialog" aria-modal="true" aria-labelledby="v11128DepartureTitle">
        <div class="v108-modal-head">
          <div>
            <small>DEPARTURES</small>
            <h3 id="v11128DepartureTitle">👋 Leaving</h3>
            <p>Review today's checkouts first, then see what is coming up over the next 7 days.</p>
          </div>
          <button type="button" data-v11128-departure-close aria-label="Close">×</button>
        </div>
        <div class="v11128-departure-sections">
          <section class="v11128-departure-section" aria-labelledby="v11128LeavingTodayHeading">
            <div class="v11128-section-heading">
              <div><small>TODAY</small><h4 id="v11128LeavingTodayHeading">Leaving Today</h4></div>
              <span data-v11128-today-count>0</span>
            </div>
            <div class="v11128-departure-list" data-v11128-today-list></div>
          </section>
          <section class="v11128-departure-section" aria-labelledby="v11128LeavingNextHeading">
            <div class="v11128-section-heading">
              <div><small>NEXT 7 DAYS</small><h4 id="v11128LeavingNextHeading">Coming Up</h4></div>
              <span data-v11128-future-count>0</span>
            </div>
            <div class="v11128-departure-list" data-v11128-future-list></div>
          </section>
        </div>
      </div>`;

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-v11128-departure-close]')) {
        modal.hidden = true;
        return;
      }

      const checkout = event.target.closest('[data-v11128-checkout]');
      if (checkout) checkoutDeparture(checkout).catch(error => console.error(error));
    });

    document.body.appendChild(modal);
    return modal;
  }

  function hideLegacyDepartureModals() {
    ['v110LeavingModal', 'v11116CalendarSummaryModal'].forEach(id => {
      const modal = document.getElementById(id);
      if (modal) modal.hidden = true;
    });
  }

  function renderDepartureModal() {
    const modal = ensureDepartureModal();
    const sets = departureSets();
    departureState.today = sets.today;
    departureState.future = sets.future;

    const todayList = modal.querySelector('[data-v11128-today-list]');
    const futureList = modal.querySelector('[data-v11128-future-list]');
    const todayCount = modal.querySelector('[data-v11128-today-count]');
    const futureCount = modal.querySelector('[data-v11128-future-count]');

    if (todayCount) todayCount.textContent = String(sets.today.length);
    if (futureCount) futureCount.textContent = String(sets.future.length);

    if (todayList) {
      todayList.innerHTML = sets.today.length
        ? sets.today.map((event, index) => departureRow(event, index, true)).join('')
        : emptyDeparture('No pets are waiting to check out.', 'Completed checkouts disappear from the Leaving count.');
    }

    if (futureList) {
      futureList.innerHTML = sets.future.length
        ? sets.future.map((event, index) => departureRow(event, index, false)).join('')
        : emptyDeparture('No further departures in the next 7 days.', 'The next scheduled checkout will appear here automatically.');
    }
  }

  async function saveCheckout(payload) {
    try {
      if (typeof window.v110SaveOperationalStatus === 'function') {
        return await window.v110SaveOperationalStatus(payload, 'checked_out');
      }
    } catch (error) {
      throw error;
    }
    try {
      if (typeof v110SaveOperationalStatus === 'function') {
        return await v110SaveOperationalStatus(payload, 'checked_out');
      }
    } catch (error) {
      throw error;
    }
    if (typeof window.sendPayloadToAppsScript === 'function') {
      return window.sendPayloadToAppsScript({ action: 'checkout_stay', ...payload, source: 'V11.1.28 Departures' });
    }
    throw new Error('Checkout service is not ready yet.');
  }

  async function checkoutDeparture(button) {
    const index = Number(button?.dataset?.v11128Checkout);
    const event = departureState.today[index];
    if (!event || !button) return;

    const original = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ Checking out…';

    try {
      await saveCheckout(operationalPayload(event));
      try {
        if (typeof window.v110LoadOperations === 'function') await window.v110LoadOperations({ noRender: true });
      } catch (_) {}
      renderDepartureModal();
      try {
        if (typeof window.renderV10OperationsHome === 'function') {
          window.renderV10OperationsHome(calendarEvents());
        }
      } catch (_) {}
    } catch (error) {
      button.disabled = false;
      button.textContent = original;
      window.alert('Checkout could not be saved.\n\n' + (error?.message || String(error)));
    }
  }

  async function openDepartureModal() {
    hideLegacyDepartureModals();
    const modal = ensureDepartureModal();
    renderDepartureModal();
    modal.hidden = false;
  }

  function installDepartureRouting() {
    if (!window.v11128DepartureRoutingWired) {
      window.v11128DepartureRoutingWired = true;

      /* Window capture runs before the older document-capture departure
         handlers, making this one combined modal the canonical route. */
      window.addEventListener('click', event => {
        if (pageName() !== 'calendar') return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target?.closest('[data-v10-jump="departures"]')) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        openDepartureModal().catch(error => console.error(error));
      }, true);
    }

    window.v11128OpenDepartureModal = openDepartureModal;
    try { window.v110OpenLeavingModal = openDepartureModal; } catch (_) {}
  }

  function tuneCalendarDensity() {
    if (pageName() !== 'calendar') return;

    let calendar = null;
    try { calendar = window.globalCalendar || null; } catch (_) {}
    if (!calendar) {
      try { if (typeof globalCalendar !== 'undefined') calendar = globalCalendar; } catch (_) {}
    }
    if (!calendar || typeof calendar.setOption !== 'function') return;
    if (calendar.v11128DensityVersion === VERSION) return;

    calendar.v11128DensityVersion = VERSION;
    try { calendar.setOption('dayMaxEvents', 7); } catch (_) {}
    try { calendar.setOption('moreLinkClick', 'popover'); } catch (_) {}
  }

  function tabKey(button) {
    if (!button) return '';
    const direct = String(button.dataset?.directoryMainTab || button.dataset?.v110Tab || '').toLowerCase();
    if (direct) return direct;

    const text = String(button.textContent || '').trim().toLowerCase();
    if (text.includes('profile')) return 'profile';
    if (text.includes('belong')) return 'belongings';
    if (text.includes('media')) return 'media';
    if (text.includes('history')) return 'history';
    if (text.includes('master')) return 'master';
    return '';
  }

  function reorderProfileTabs(root = document) {
    const hosts = root?.matches?.('.directory-main-profile-tabs')
      ? [root]
      : Array.from(root?.querySelectorAll?.('.directory-main-profile-tabs') || []);
    const order = ['profile', 'belongings', 'media', 'history', 'master'];

    hosts.forEach(tabs => {
      const buttons = Array.from(tabs.children).filter(child => child instanceof HTMLElement);
      order.forEach(key => {
        const button = buttons.find(candidate => tabKey(candidate) === key);
        if (button) tabs.appendChild(button);
      });
      tabs.dataset.v11128Order = order.join('-');
    });
  }

  function installProfileOrderHook() {
    const base = window.v110EnhanceCareCard;
    if (typeof base !== 'function' || base.v11128ProfileOrderWrapped) return;

    const wrapped = function (card) {
      const result = base.apply(this, arguments);
      queueMicrotask(() => reorderProfileTabs(card || document));
      return result;
    };

    try {
      Object.keys(base).forEach(key => { try { wrapped[key] = base[key]; } catch (_) {} });
    } catch (_) {}
    wrapped.v11128ProfileOrderWrapped = true;
    window.v110EnhanceCareCard = wrapped;
  }

  function apply() {
    installDepartureRouting();
    tuneCalendarDensity();
    installProfileOrderHook();
    reorderProfileTabs();
  }

  function start() {
    apply();

    /* Older Calendar/Profile layers render asynchronously. Bounded passes
       catch their final DOM without a permanent observer. */
    [80, 220, 500, 900, 1500, 2400, 3600].forEach(delay => setTimeout(apply, delay));

    document.addEventListener('click', event => {
      if (pageName() !== 'directory') return;
      if (event.target.closest('.directory-card, .directory-main-profile-tab')) {
        setTimeout(reorderProfileTabs, 30);
        setTimeout(reorderProfileTabs, 180);
      }
    });

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.v11128UiVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
