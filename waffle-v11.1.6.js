/* ============================================================
   WAFFLE HOUSE V11.1.6 — CALENDAR DETAIL MODALS + OTHER SOURCE
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.6';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + Number(days || 0));
    return localDateString(date);
  }

  /* ----------------------------------------------------------
     REQUEST FROM — ADD "OTHER" AS A FOURTH TILE
     ---------------------------------------------------------- */

  function requestSourcesWithOther() {
    const sources = [];

    if (typeof V1112_REQUEST_SOURCES !== 'undefined' && Array.isArray(V1112_REQUEST_SOURCES)) {
      V1112_REQUEST_SOURCES.forEach(source => {
        if (!source || String(source.value || '').toLowerCase() === 'other') return;
        sources.push(source);
      });
    }

    sources.push({ value: 'Other', label: 'Other', image: '' });
    return sources;
  }

  if (typeof v1112SourceTilesHtml === 'function') {
    v1112SourceTilesHtml = function(selected = '') {
      return requestSourcesWithOther().map(source => {
        const value = String(source.value || '');
        const label = String(source.label || value);
        const image = String(source.image || '');
        const active = value === String(selected || '');

        return `
          <button type="button"
            class="v1112-source-tile${active ? ' is-selected' : ''}${value === 'Other' ? ' v1116-source-other' : ''}"
            data-v1112-source-value="${escapeHtml(value)}"
            aria-pressed="${active ? 'true' : 'false'}">
            <span class="v1112-source-circle">
              ${image ? `<img src="${image}" alt="">` : ''}
              <span>${escapeHtml(label)}</span>
            </span>
          </button>`;
      }).join('');
    };
  }

  if (typeof v111RequestSourceOptions === 'function') {
    v111RequestSourceOptions = function(selected = '') {
      const choices = ['MadPaws', 'Pawshake', 'Facebook', 'Other'];
      return '<option value="">Select source…</option>' + choices.map(value =>
        `<option value="${value}"${value === String(selected || '') ? ' selected' : ''}>${value}</option>`
      ).join('');
    };
  }

  function ensureOtherOption(select) {
    if (!select || select.tagName !== 'SELECT') return select;

    if (!Array.from(select.options).some(option => option.value === 'Other')) {
      const option = document.createElement('option');
      option.value = 'Other';
      option.textContent = 'Other';
      select.appendChild(option);
    }

    return select;
  }

  function rebuildSourcePickerIfNeeded(select) {
    if (!select) return null;
    ensureOtherOption(select);

    const next = select.nextElementSibling;
    const hasOtherTile = next && next.classList.contains('v1112-source-picker') &&
      next.querySelector('[data-v1112-source-value="Other"]');

    if (select.dataset.v1112Enhanced === 'true' && !hasOtherTile) {
      if (next && next.classList.contains('v1112-source-picker')) next.remove();
      delete select.dataset.v1112Enhanced;
    }

    return select;
  }

  if (typeof v1112EnhanceSourceSelect === 'function' && !v1112EnhanceSourceSelect.v1116Wrapped) {
    const baseEnhanceSourceSelect = v1112EnhanceSourceSelect;
    const wrappedEnhanceSourceSelect = function(select) {
      rebuildSourcePickerIfNeeded(select);
      return baseEnhanceSourceSelect(select);
    };
    wrappedEnhanceSourceSelect.v1116Wrapped = true;
    v1112EnhanceSourceSelect = wrappedEnhanceSourceSelect;
  }

  function wrapSourceEnsureFunction(name) {
    const current = window[name];
    if (typeof current !== 'function' || current.v1116Wrapped) return;

    const wrapped = function(...args) {
      const select = current.apply(this, args);
      if (select) {
        rebuildSourcePickerIfNeeded(select);
        if (typeof v1112EnhanceSourceSelect === 'function') v1112EnhanceSourceSelect(select);
      }
      return select;
    };
    wrapped.v1116Wrapped = true;
    window[name] = wrapped;
  }

  function enhanceKnownSourceFields() {
    const selectors = [
      '#potRequestSource',
      '[data-v111-request-source="boarding"]',
      '[data-v1112-meet-source]',
      '[data-request-source]'
    ];

    document.querySelectorAll(selectors.join(',')).forEach(select => {
      rebuildSourcePickerIfNeeded(select);
      if (typeof v1112EnhanceSourceSelect === 'function') v1112EnhanceSourceSelect(select);
    });
  }

  /* ----------------------------------------------------------
     AT HOME MODAL
     ---------------------------------------------------------- */

  function currentDogEvents() {
    if (typeof v111CurrentDogEvents === 'function') {
      return v111CurrentDogEvents();
    }

    const today = typeof getLocalTodayDateString === 'function'
      ? getLocalTodayDateString()
      : localDateString(new Date());
    const source = (window.globalCalendar && typeof globalCalendar.getEvents === 'function')
      ? globalCalendar.getEvents().slice()
      : (typeof v110LatestCalendarEvents !== 'undefined' && Array.isArray(v110LatestCalendarEvents)
        ? v110LatestCalendarEvents
        : []);
    const unique = new Map();

    source.forEach(eventRecord => {
      const props = eventRecord && eventRecord.extendedProps || {};
      if (props.isPotential === true || props.isMeetGreet === true) return;
      const dates = typeof v10EventRawDates === 'function' ? v10EventRawDates(eventRecord) : {};
      if (!dates.start || !dates.end || today < dates.start || today > dates.end) return;
      const stayKey = typeof v110StayKeyForEvent === 'function' ? v110StayKeyForEvent(eventRecord) : '';
      if (!stayKey) return;
      const operation = typeof v110OperationForStay === 'function' ? v110OperationForStay(stayKey) : null;
      if (String(operation && operation.status || '') === 'checked_out') return;
      unique.set(stayKey, eventRecord);
    });

    return Array.from(unique.values());
  }

  function ensureAtHomeModal() {
    let modal = document.getElementById('v1116AtHomeModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'v1116AtHomeModal';
    modal.className = 'v108-modal v1116-calendar-detail-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v108-modal-card v1116-calendar-detail-card" role="dialog" aria-modal="true" aria-labelledby="v1116AtHomeTitle">
        <div class="v108-modal-head">
          <div>
            <small>AT HOME</small>
            <h3 id="v1116AtHomeTitle">🏡 At Home Right Now</h3>
            <p>Current Waffle House guests. Tap a dog to open their Care profile.</p>
          </div>
          <button type="button" data-v1116-at-home-close aria-label="Close">×</button>
        </div>
        <div class="v1116-at-home-grid" data-v1116-at-home-list></div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-v1116-at-home-close]')) {
        modal.hidden = true;
        return;
      }

      const dogButton = event.target.closest('[data-v1116-at-home-dog]');
      if (!dogButton) return;
      const stayKey = String(dogButton.dataset.v1116AtHomeDog || '').trim();
      if (!stayKey) return;
      window.location.href = `directory.html?stayKey=${encodeURIComponent(stayKey)}`;
    });

    return modal;
  }

  async function renderAtHomeModal() {
    const modal = ensureAtHomeModal();
    const host = modal.querySelector('[data-v1116-at-home-list]');
    const list = currentDogEvents();

    if (!list.length) {
      host.innerHTML = `
        <div class="v1116-detail-empty">
          <span>🏡</span>
          <strong>No dogs are currently at home.</strong>
          <small>Current boarding guests will appear here.</small>
        </div>`;
      return;
    }

    host.innerHTML = list.map((eventRecord, index) => {
      const props = eventRecord && eventRecord.extendedProps || {};
      const dogName = String(props.dogName || eventRecord.title || 'Guest').trim();
      const stayKey = typeof v110StayKeyForEvent === 'function' ? v110StayKeyForEvent(eventRecord) : '';

      return `
        <button type="button"
          class="directory-guest-tile-open v1116-at-home-tile"
          data-v1116-at-home-dog="${escapeHtml(stayKey)}"
          aria-label="Open ${escapeHtml(dogName)} Care profile">
          <span class="directory-guest-tile-photo v1116-at-home-photo" data-v1116-at-home-photo="${index}" aria-hidden="true">🐶</span>
          <span class="directory-guest-tile-name">${escapeHtml(dogName)}</span>
        </button>`;
    }).join('');

    list.forEach(async (eventRecord, index) => {
      if (typeof v110PhotoForStay !== 'function' || typeof v110StayKeyForEvent !== 'function') return;
      const photo = await v110PhotoForStay(v110StayKeyForEvent(eventRecord));
      if (!photo) return;
      const target = host.querySelector(`[data-v1116-at-home-photo="${index}"]`);
      if (target) target.innerHTML = `<img src="${escapeHtml(photo)}" alt="" loading="lazy">`;
    });
  }

  async function openAtHomeModal() {
    const modal = ensureAtHomeModal();
    modal.hidden = false;
    await renderAtHomeModal();
  }

  /* ----------------------------------------------------------
     MEET & GREETS — TODAY + NEXT 30 DAYS
     ---------------------------------------------------------- */

  function meetGreetTime(eventRecord) {
    const props = eventRecord && eventRecord.extendedProps || {};
    const direct = String(props.time || props.bookingTime || '').trim();
    if (direct) return direct;
    const notes = String(props.notes || '');
    const match = notes.match(/\b(\d{1,2}:\d{2})\b/);
    return match ? match[1] : '';
  }

  function meetGreetWindow() {
    const today = typeof getLocalTodayDateString === 'function'
      ? getLocalTodayDateString()
      : localDateString(new Date());
    const lastDay = addDays(today, 30);
    const source = (window.globalCalendar && typeof globalCalendar.getEvents === 'function')
      ? globalCalendar.getEvents().slice()
      : (typeof v110LatestCalendarEvents !== 'undefined' && Array.isArray(v110LatestCalendarEvents)
        ? v110LatestCalendarEvents
        : []);

    const all = source.filter(eventRecord => {
      const props = eventRecord && eventRecord.extendedProps || {};
      if (props.isMeetGreet !== true) return false;
      const dates = typeof v10EventRawDates === 'function' ? v10EventRawDates(eventRecord) : {};
      return dates.start && dates.start >= today && dates.start <= lastDay;
    }).sort((a, b) => {
      const ad = typeof v10EventRawDates === 'function' ? v10EventRawDates(a).start : '';
      const bd = typeof v10EventRawDates === 'function' ? v10EventRawDates(b).start : '';
      const dateCompare = String(ad).localeCompare(String(bd));
      if (dateCompare) return dateCompare;
      return meetGreetTime(a).localeCompare(meetGreetTime(b));
    });

    return {
      today,
      lastDay,
      todayEvents: all.filter(eventRecord => v10EventRawDates(eventRecord).start === today),
      upcomingEvents: all.filter(eventRecord => v10EventRawDates(eventRecord).start > today)
    };
  }

  function meetGreetRowHtml(eventRecord, showDate) {
    const props = eventRecord && eventRecord.extendedProps || {};
    const dates = typeof v10EventRawDates === 'function' ? v10EventRawDates(eventRecord) : {};
    const dogName = String(props.dogName || eventRecord.title || 'Meet & Greet').trim();
    const breed = String(props.breed || '').trim();
    const time = meetGreetTime(eventRecord);
    const dateText = showDate && dates.start
      ? (typeof formatStayDateShort === 'function' ? formatStayDateShort(dates.start) : dates.start)
      : '';

    return `
      <article class="v1116-meet-row">
        <div class="v1116-meet-date">
          ${dateText ? `<strong>${escapeHtml(dateText)}</strong>` : '<strong>Today</strong>'}
          <span>${escapeHtml(time || 'Time not recorded')}</span>
        </div>
        <div class="v1116-meet-copy">
          <strong>${escapeHtml(dogName)}</strong>
          ${breed ? `<span>${escapeHtml(breed)}</span>` : '<span>Breed not recorded</span>'}
        </div>
      </article>`;
  }

  function meetSectionHtml(title, events, showDate, emptyCopy) {
    return `
      <section class="v1116-meet-section">
        <div class="v1116-meet-section-head">
          <h4>${escapeHtml(title)}</h4>
          <span>${events.length}</span>
        </div>
        <div class="v1116-meet-list">
          ${events.length
            ? events.map(eventRecord => meetGreetRowHtml(eventRecord, showDate)).join('')
            : `<div class="v1116-meet-empty">${escapeHtml(emptyCopy)}</div>`}
        </div>
      </section>`;
  }

  function ensureMeetGreetListModal() {
    let modal = document.getElementById('v1116MeetGreetListModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'v1116MeetGreetListModal';
    modal.className = 'v108-modal v1116-calendar-detail-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v108-modal-card v1116-calendar-detail-card v1116-meet-card" role="dialog" aria-modal="true" aria-labelledby="v1116MeetTitle">
        <div class="v108-modal-head">
          <div>
            <small>MEET &amp; GREETS</small>
            <h3 id="v1116MeetTitle">🤝 Meet &amp; Greets</h3>
            <p>Today's appointments and the next 30 days.</p>
          </div>
          <button type="button" data-v1116-meet-close aria-label="Close">×</button>
        </div>
        <div class="v1116-meet-sections" data-v1116-meet-sections></div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-v1116-meet-close]')) {
        modal.hidden = true;
      }
    });

    return modal;
  }

  function renderMeetGreetListModal() {
    const modal = ensureMeetGreetListModal();
    const host = modal.querySelector('[data-v1116-meet-sections]');
    const windowData = meetGreetWindow();

    host.innerHTML =
      meetSectionHtml('Today', windowData.todayEvents, false, 'No Meet & Greets scheduled today.') +
      meetSectionHtml('Next 30 Days', windowData.upcomingEvents, true, 'No upcoming Meet & Greets in the next 30 days.');
  }

  function openMeetGreetListModal() {
    const modal = ensureMeetGreetListModal();
    renderMeetGreetListModal();
    modal.hidden = false;
  }

  /* Capture the stat-tile clicks before the older jump/scroll handlers. */
  function wireCalendarTiles() {
    document.addEventListener('click', event => {
      if ((document.body && document.body.dataset && document.body.dataset.wafflePage) !== 'calendar') return;

      const atHome = event.target.closest('[data-v10-jump="home"]');
      if (atHome) {
        event.preventDefault();
        event.stopPropagation();
        openAtHomeModal();
        return;
      }

      const meet = event.target.closest('[data-v10-jump="meet"]');
      if (meet) {
        event.preventDefault();
        event.stopPropagation();
        openMeetGreetListModal();
      }
    }, true);
  }

  function wireEscapeKey() {
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const atHome = document.getElementById('v1116AtHomeModal');
      const meets = document.getElementById('v1116MeetGreetListModal');
      if (atHome && !atHome.hidden) atHome.hidden = true;
      if (meets && !meets.hidden) meets.hidden = true;
    });
  }

  function installSourceHooks() {
    wrapSourceEnsureFunction('v111EnsurePotentialSourceField');
    wrapSourceEnsureFunction('v111EnsureBoardingSourceField');
    wrapSourceEnsureFunction('v1112EnsureMeetGreetSource');
    enhanceKnownSourceFields();
  }

  function start() {
    ensureAtHomeModal();
    ensureMeetGreetListModal();
    wireCalendarTiles();
    wireEscapeKey();
    installSourceHooks();

    // Bounded passes only. Modal lifecycle wrappers handle later form opens.
    [500, 1400].forEach(delay => setTimeout(installSourceHooks, delay));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
