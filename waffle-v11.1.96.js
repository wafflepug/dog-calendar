/* ============================================================
   WAFFLE HOUSE V11.1.96 — CARE FUTURE RANGE + MONTH GROUPING
   ------------------------------------------------------------
   Extends Future Stays beyond the historical seven-day Care render window.
   Confirmed Calendar events are used as the authoritative source, while the
   existing Care profile loaders remain authoritative for profile detail.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_V11196_FUTURE_RANGE) return;

  const VERSION = '11.1.96';
  const FULL_MONTHS_AHEAD = 6;
  const SYNTHETIC_CLASS = 'v11196-synthetic-future';
  const MONTH_HEADING_CLASS = 'v11196-month-heading';

  let gridObserver = null;
  let scheduled = false;
  let mutating = false;
  let cachedFutureEvents = [];
  let cacheReady = false;
  let expanded = false;
  let laterSearchRevision = 0;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  }

  function isCarePage() {
    return pageName() === 'directory';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function localDateKey(date) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) return '';
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  }

  function parseDateKey(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    return localDateKey(text);
  }

  function todayKey() {
    return localDateKey(new Date());
  }

  function horizonKey() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    /* End of the sixth full calendar month after the current month. */
    const end = new Date(
      today.getFullYear(),
      today.getMonth() + FULL_MONTHS_AHEAD + 1,
      0
    );
    return localDateKey(end);
  }

  function sevenDayKey() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() + 7);
    return localDateKey(today);
  }

  function getCalendarAdapter() {
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar) {
        return globalCalendar;
      }
    } catch (_) {}
    return window.globalCalendar || null;
  }

  function eventDates(event) {
    const props = event?.extendedProps || {};
    const start = parseDateKey(
      props.rawStartDate ||
      props.startDate ||
      event?.startStr ||
      event?.start ||
      ''
    );

    let end = parseDateKey(
      props.rawEndDate ||
      props.endDate ||
      ''
    );

    if (!end && event?.end) {
      const exclusive = new Date(event.end);
      if (!Number.isNaN(exclusive.getTime())) {
        if (event.allDay !== false) exclusive.setDate(exclusive.getDate() - 1);
        end = localDateKey(exclusive);
      }
    }

    return { start, end: end || start };
  }

  function eventDogName(event) {
    const props = event?.extendedProps || {};
    return String(props.dogName || event?.title || 'Guest').trim() || 'Guest';
  }

  function stayKeyFor(event) {
    const dates = eventDates(event);
    const name = eventDogName(event);
    try {
      if (typeof makePotentialKey === 'function') {
        return String(makePotentialKey(name, dates.start, dates.end));
      }
    } catch (_) {}
    return [name.toLowerCase(), dates.start, dates.end].join('|');
  }

  function eventIdentityFor(event) {
    const props = event?.extendedProps || {};
    const stayId = String(props.stayId || '').trim().toLowerCase();
    const dogId = String(props.dogId || '').trim().toLowerCase();
    const dates = eventDates(event);
    if (stayId) return `stay:${stayId}`;
    if (dogId) return `dog:${dogId}|${dates.start}|${dates.end}`;
    return `key:${stayKeyFor(event)}`;
  }

  function cardIdentityFor(card) {
    const stayId = String(card?.dataset?.directoryStayId || '').trim().toLowerCase();
    const dogId = String(card?.dataset?.directoryDogId || '').trim().toLowerCase();
    const start = parseDateKey(card?.dataset?.directoryStartDate || card?.dataset?.startDate || '');
    const end = parseDateKey(card?.dataset?.directoryEndDate || card?.dataset?.endDate || '');
    if (stayId) return `stay:${stayId}`;
    if (dogId) return `dog:${dogId}|${start}|${end}`;
    return `key:${String(card?.dataset?.directoryStayKey || '')}`;
  }

  function findEventCard(event, events) {
    const identity = eventIdentityFor(event);
    const cards = allCareCards();
    const exact = cards.find(card => cardIdentityFor(card) === identity);
    if (exact) return exact;

    /* Legacy cards may not yet have IDs attached. Reuse one only where the
       old name/date key is unambiguous on both sides. */
    const legacyKey = stayKeyFor(event);
    const sameEventKey = events.filter(candidate => stayKeyFor(candidate) === legacyKey);
    if (sameEventKey.length !== 1) return null;
    const eventProps = event?.extendedProps || {};
    const eventDog = String(eventProps.dogId || '').trim().toLowerCase();
    const eventStay = String(eventProps.stayId || '').trim().toLowerCase();
    const eventOwner = String(eventProps.ownerName || eventProps.owner || '').trim().toLowerCase();
    const compatibleCards = cards.filter(card => {
      if (String(card.dataset.directoryStayKey || '') !== legacyKey) return false;
      const cardDog = String(card.dataset.directoryDogId || '').trim().toLowerCase();
      const cardStay = String(card.dataset.directoryStayId || '').trim().toLowerCase();
      const cardOwner = String(card.dataset.v1088OwnerName || '').trim().toLowerCase();
      if (eventDog && cardDog && eventDog !== cardDog) return false;
      if (eventStay && cardStay && eventStay !== cardStay) return false;
      if (eventOwner && cardOwner && eventOwner !== cardOwner) return false;
      return true;
    });
    return compatibleCards.length === 1 ? compatibleCards[0] : null;
  }

  function isConfirmedFutureEvent(event) {
    const props = event?.extendedProps || {};
    if (props.isMeetGreet === true || props.isPotential === true) return false;

    const dates = eventDates(event);
    if (!dates.start) return false;
    return dates.start > todayKey() && dates.start <= horizonKey();
  }

  function futureEvents() {
    const adapter = getCalendarAdapter();
    if (!adapter || typeof adapter.getEvents !== 'function') return [];

    let events = [];
    try {
      events = adapter.getEvents() || [];
    } catch (_) {
      return [];
    }

    const seen = new Set();
    return events
      .filter(isConfirmedFutureEvent)
      .filter(event => {
        const key = eventIdentityFor(event);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const left = eventDates(a).start;
        const right = eventDates(b).start;
        if (left !== right) return left.localeCompare(right);
        return eventDogName(a).localeCompare(eventDogName(b));
      });
  }

  function cacheEvents(events) {
    const seen = new Set();
    cachedFutureEvents = (Array.isArray(events) ? events : [])
      .filter(isConfirmedFutureEvent)
      .filter(event => {
        const key = eventIdentityFor(event);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const left = eventDates(a).start;
        const right = eventDates(b).start;
        if (left !== right) return left.localeCompare(right);
        return eventDogName(a).localeCompare(eventDogName(b));
      });
    cacheReady = true;
  }

  function grid() {
    return document.getElementById('directory-grid');
  }

  function allCareCards() {
    const host = grid();
    if (!host) return [];
    return Array.from(host.querySelectorAll(':scope > .directory-card[data-directory-stay-key]'));
  }

  function laterEvents() {
    return cachedFutureEvents.filter(event => {
      const start = eventDates(event).start;
      return start > sevenDayKey() && !findEventCard(event, cachedFutureEvents);
    });
  }

  function totalFutureCount() {
    if (!cacheReady) return null;
    const keys = new Set(cachedFutureEvents.map(eventIdentityFor));
    allCareCards().forEach(card => {
      const start = parseDateKey(card.dataset.directoryStartDate || card.dataset.startDate || '');
      if (start <= todayKey()) return;
      if (keys.has(cardIdentityFor(card))) return;
      if (cachedFutureEvents.some(event => findEventCard(event, cachedFutureEvents) === card)) return;
      keys.add(cardIdentityFor(card));
    });
    return keys.size;
  }

  function formatStayDate(value) {
    try {
      if (typeof formatStayDateShort === 'function') return formatStayDateShort(value);
    } catch (_) {}

    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return String(value || '');
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }

  function futureCardMarkup(event) {
    const props = event?.extendedProps || {};
    const dates = eventDates(event);
    const stayKey = stayKeyFor(event);
    const dogName = eventDogName(event);
    const breed = String(props.breed || 'Unknown').trim() || 'Unknown';
    const owner = String(props.ownerName || props.owner || 'N/A').trim() || 'N/A';
    const phone = String(props.phone || 'N/A').trim() || 'N/A';
    const notes = String(props.notes || 'None').trim() || 'None';
    const dateLabel = `${formatStayDate(dates.start)} – ${formatStayDate(dates.end)}`;

    return `
      <div
        class="directory-card directory-card-fused belongings-pet-card ${SYNTHETIC_CLASS} v11195-future-stay"
        data-directory-stay-key="${escapeHtml(stayKey)}"
        data-directory-dog-name="${escapeHtml(dogName)}"
        data-directory-start-date="${escapeHtml(dates.start)}"
        data-directory-end-date="${escapeHtml(dates.end)}"
        data-directory-source-row="${escapeHtml(props.sourceRow || '')}"
        data-directory-dog-id="${escapeHtml(props.dogId || '')}"
        data-directory-stay-id="${escapeHtml(props.stayId || '')}"
        data-v1088-breed="${escapeHtml(breed)}"
        data-v1088-owner-name="${escapeHtml(owner)}"
        data-v1088-phone="${escapeHtml(phone)}"
        data-stay-key="${escapeHtml(stayKey)}"
        data-dog-name="${escapeHtml(dogName)}"
        data-start-date="${escapeHtml(dates.start)}"
        data-end-date="${escapeHtml(dates.end)}"
        data-v1082-stay-kind="future"
        data-v11196-synthetic-future="true">

        <button
          type="button"
          class="directory-guest-tile-open v11196-future-tile"
          data-open-directory-profile
          aria-label="Open ${escapeHtml(dogName)} future care profile">
          <span
            class="directory-guest-tile-photo"
            data-directory-tile-photo="${escapeHtml(stayKey)}"
            aria-hidden="true"></span>
          <span class="directory-guest-tile-name">${escapeHtml(dogName)}</span>
          <span class="v11196-future-tile-date">${escapeHtml(dateLabel)}</span>
        </button>

        <div class="directory-profile-content">
          <div class="directory-card-header">
            <div class="directory-photo-shell" data-directory-photo="${escapeHtml(stayKey)}">
              <div class="directory-photo-media">
                <div class="directory-photo-placeholder" aria-label="No dog profile photo">🐶</div>
              </div>
              <button
                type="button"
                class="directory-photo-edit-button"
                data-upload-dog-photo
                title="Add or change dog profile photo"
                aria-label="Add or change ${escapeHtml(dogName)} profile photo">✎</button>
            </div>

            <div class="directory-card-identity">
              <div class="directory-name-row">
                <span class="directory-dog-name-btn">${escapeHtml(dogName)}</span>
                <span class="directory-status-tag tag-upcoming">Upcoming</span>
              </div>
              <span class="directory-primary-breed">${escapeHtml(breed)}</span>
              <div class="directory-stay-dates">📅 ${escapeHtml(dateLabel)}</div>
            </div>
          </div>

          <nav class="directory-main-profile-tabs" role="tablist" aria-label="${escapeHtml(dogName)} future stay profile sections">
            <button type="button" class="directory-main-profile-tab is-active" role="tab" aria-selected="true" data-directory-main-tab="profile">
              <span aria-hidden="true">🐶</span><span>Profile</span>
            </button>
            <button type="button" class="directory-main-profile-tab" role="tab" aria-selected="false" data-directory-main-tab="belongings">
              <span aria-hidden="true">🧳</span><span>Belongings</span>
            </button>
          </nav>

          <section class="directory-main-profile-panel is-active" role="tabpanel" data-directory-main-panel="profile">
            <div class="directory-care-strip" data-directory-care="${escapeHtml(stayKey)}">
              <span class="directory-care-unset">🛡️ No saved care alerts</span>
            </div>

            <div class="directory-intake-strip" data-directory-intake="${escapeHtml(stayKey)}">
              <div class="directory-intake-state">
                <span class="directory-intake-dot is-not-sent"></span>
                <span>Intake not sent</span>
              </div>
            </div>

            <div class="directory-legacy-strip" data-directory-legacy="${escapeHtml(stayKey)}">
              <div class="directory-legacy-state"><span>📚 Legacy Intake not uploaded</span></div>
            </div>

            <div class="directory-attributes-grid directory-core-attributes">
              <div class="directory-attribute">
                <span class="directory-field-label">Owner</span>
                <span class="directory-field-value">${escapeHtml(owner)}</span>
              </div>
              <div class="directory-attribute">
                <span class="directory-field-label">Contact</span>
                <span class="directory-field-value">${escapeHtml(phone)}</span>
              </div>
              <div class="directory-attribute directory-attribute-wide">
                <span class="directory-field-label">Notes</span>
                <span class="directory-field-value">${escapeHtml(notes)}</span>
              </div>
            </div>

            <section class="directory-profile-section directory-profile-intake-section" data-directory-detail="profile" data-detail-loaded="false">
              <div class="directory-profile-section-heading">
                <div>
                  <span class="directory-profile-section-kicker">Future stay profile</span>
                  <h4>📋 Profile &amp; Care</h4>
                </div>
                <div class="directory-profile-section-tools">
                  <span class="intake-profile-source" data-intake-profile-summary>Open profile to load care details</span>
                </div>
              </div>
              <div class="directory-fused-details-body" data-directory-intake-attributes>
                <div class="intake-profile-empty">Open this profile to load saved intake attributes.</div>
              </div>
            </section>
          </section>

          <section class="directory-main-profile-panel" role="tabpanel" data-directory-main-panel="belongings" hidden>
            <section class="directory-profile-section directory-belongings-only-section" data-directory-detail="belongings" data-detail-loaded="false">
              <div class="directory-profile-section-heading">
                <div>
                  <span class="directory-profile-section-kicker">Future stay belongings</span>
                  <h4>🧳 Items &amp; Photos</h4>
                </div>
              </div>
              <div class="directory-fused-details-body" data-directory-belongings>
                <div class="intake-profile-empty">Open Belongings to prepare the stay record.</div>
              </div>
            </section>
          </section>
        </div>
      </div>`;
  }

  function createFutureCard(event) {
    const template = document.createElement('template');
    template.innerHTML = futureCardMarkup(event).trim();
    const card = template.content.firstElementChild;
    if (!card) return null;

    try {
      if (typeof v108EnhanceCard === 'function') v108EnhanceCard(card);
    } catch (_) {}
    try {
      if (typeof v110EnhanceCareCard === 'function') v110EnhanceCareCard(card);
    } catch (_) {}
    return card;
  }

  function monthKeyForCard(card) {
    return parseDateKey(
      card?.dataset?.directoryStartDate ||
      card?.dataset?.startDate ||
      ''
    ).slice(0, 7);
  }

  function monthLabel(monthKey) {
    const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return String(monthKey || 'Upcoming');
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  }

  function futureCardsWithinHorizon() {
    return allCareCards()
      .filter(card => {
        const start = parseDateKey(card.dataset.directoryStartDate || card.dataset.startDate || '');
        return start > todayKey() && start <= horizonKey();
      })
      .sort((a, b) => {
        const startA = parseDateKey(a.dataset.directoryStartDate || a.dataset.startDate || '');
        const startB = parseDateKey(b.dataset.directoryStartDate || b.dataset.startDate || '');
        if (startA !== startB) return startA.localeCompare(startB);
        return String(a.dataset.directoryDogName || '').localeCompare(String(b.dataset.directoryDogName || ''));
      });
  }

  function removeStaleSyntheticCards(validKeys) {
    allCareCards()
      .filter(card => card.dataset.v11196SyntheticFuture === 'true')
      .forEach(card => {
        const key = cardIdentityFor(card);
        if (!validKeys.has(key)) card.remove();
      });
  }

  function reconcileFutureCards(events) {
    const host = grid();
    if (!host) return;

    const validKeys = new Set(events.map(eventIdentityFor));
    removeStaleSyntheticCards(validKeys);

    const cardsByKey = new Map();
    allCareCards().forEach(card => {
      const key = cardIdentityFor(card);
      if (!key) return;
      if (!cardsByKey.has(key)) cardsByKey.set(key, []);
      cardsByKey.get(key).push(card);
    });

    cardsByKey.forEach(cards => {
      const canonical = cards.find(card => card.dataset.v11196SyntheticFuture !== 'true');
      if (!canonical) return;
      cards
        .filter(card => card !== canonical && card.dataset.v11196SyntheticFuture === 'true')
        .forEach(card => card.remove());
    });

    events.forEach(event => {
      const existing = findEventCard(event, events);
      if (existing) return;
      const card = createFutureCard(event);
      if (card) host.appendChild(card);
    });
  }

  function ensureRangeControl() {
    const panel = document.getElementById('v1082CurrentStayPanel');
    const host = grid();
    if (!panel || !host) return null;
    let control = document.getElementById('v11196FutureRangeControl');
    if (!control) {
      control = document.createElement('div');
      control.id = 'v11196FutureRangeControl';
      control.className = 'v11196-future-range-control';
      control.setAttribute('aria-live', 'polite');
      control.innerHTML = '<button type="button" class="v11196-future-range-button" data-v11196-expand-later></button>';
      panel.insertBefore(control, host);
    }
    return control;
  }

  function updateRangeControl() {
    const control = ensureRangeControl();
    if (!control) return;
    const button = control.querySelector('[data-v11196-expand-later]');
    const later = laterEvents();
    const deferredCount = later.length;
    control.hidden = !document.querySelector('.directory-dashboard-fused')?.dataset?.v11195StayView
      || document.querySelector('.directory-dashboard-fused')?.dataset?.v11195StayView !== 'future'
      || (!deferredCount && !expanded);
    if (!button) return;
    if (expanded) {
      button.textContent = 'Show next 7 days only';
      button.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-controls', 'directory-grid');
      button.dataset.v11196Action = 'collapse';
      return;
    }
    if (!deferredCount) {
      button.hidden = true;
      return;
    }
    const earliest = formatStayDate(eventDates(later[0]).start);
    button.textContent = `View ${deferredCount} later arrivals · First arrives ${earliest}`;
    button.hidden = false;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'directory-grid');
    button.dataset.v11196Action = 'expand';
  }

  function updateLaterSearchControl() {
    const search = document.getElementById('guestDirectorySearch');
    const feedback = document.querySelector('[data-directory-search-feedback]');
    const toolbar = search?.closest('.guest-directory-toolbar');
    if (!toolbar || !search || !feedback) return;
    let button = toolbar.querySelector('[data-v11196-search-later]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'v11196-search-later-button';
      button.dataset.v11196SearchLater = '';
      button.textContent = 'Search later arrivals';
      button.hidden = true;
      feedback.insertAdjacentElement('afterend', button);
      button.addEventListener('click', () => {
        const revision = ++laterSearchRevision;
        const query = String(search.value || '').trim();
        const activeTab = document.querySelector('[data-v1082-stay-tab].is-active')?.dataset.v1082StayTab || 'current';
        if (!query || activeTab !== 'future' || (!laterEvents().length && button.dataset.v11196Retry !== 'true')) return;
        button.disabled = true;
        button.textContent = 'Searching later arrivals…';
        button.setAttribute('aria-busy', 'true');
        requestAnimationFrame(() => {
          if (revision !== laterSearchRevision || search.value.trim() !== query ||
              (document.querySelector('[data-v1082-stay-tab].is-active')?.dataset.v1082StayTab || 'current') !== activeTab) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            button.textContent = 'Search later arrivals';
            updateLaterSearchControl();
            return;
          }
          const cardsBeforeSearch = new Set(allCareCards());
          const wasExpanded = expanded;
          try {
            activateLaterArrivals();
            if (typeof filterGuestDirectoryCards === 'function') filterGuestDirectoryCards();
            button.textContent = 'Search later arrivals';
            button.removeAttribute('aria-busy');
            button.disabled = false;
            delete button.dataset.v11196Retry;
            updateLaterSearchControl();
          } catch (_) {
            expanded = wasExpanded;
            allCareCards().forEach(card => {
              if (!cardsBeforeSearch.has(card) && card.dataset.v11196SyntheticFuture === 'true') card.remove();
            });
            try {
              groupFutureCardsByMonth();
              refreshExistingCareHooks();
              updateMonthHeadingVisibility();
            } catch (_) {}
            button.removeAttribute('aria-busy');
            button.disabled = false;
            button.dataset.v11196Retry = 'true';
            feedback.textContent = 'Later arrivals could not be shown.';
            updateLaterSearchControl();
          }
        });
      });
    }
    const query = String(search.value || '').trim();
    const activeTab = document.querySelector('[data-v1082-stay-tab].is-active')?.dataset.v1082StayTab || 'current';
    const queryChanged = button.dataset.v11196Query !== query || button.dataset.v11196Tab !== activeTab;
    if (queryChanged) {
      delete button.dataset.v11196Retry;
    }
    if (button.disabled && queryChanged) {
      laterSearchRevision++;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = 'Search later arrivals';
    }
    button.dataset.v11196Query = query;
    button.dataset.v11196Tab = activeTab;
    if (button.dataset.v11196Retry === 'true' && query && activeTab === 'future') {
      feedback.textContent = 'Later arrivals could not be shown.';
    }
    button.hidden = !(query && activeTab === 'future' && (laterEvents().length > 0 || button.dataset.v11196Retry === 'true'));
    if (!button.disabled) button.textContent = button.dataset.v11196Retry === 'true' ? 'Retry later arrivals search' : 'Search later arrivals';
  }

  function removeDeferredSyntheticCards() {
    allCareCards().forEach(card => {
      if (card.dataset.v11196SyntheticFuture !== 'true') return;
      const start = parseDateKey(card.dataset.directoryStartDate || card.dataset.startDate || '');
      if (start > sevenDayKey()) card.remove();
    });
  }

  function activateLaterArrivals() {
    if (!cacheReady) {
      cacheEvents(futureEvents());
    }
    expanded = true;
    mutating = true;
    try {
      reconcileFutureCards(cachedFutureEvents);
      groupFutureCardsByMonth();
      updateFutureRangeCopy();
      refreshExistingCareHooks();
      updateMonthHeadingVisibility();
    } finally {
      mutating = false;
    }
    updateRangeControl();
    updateLaterSearchControl();
    window.WAFFLE_V11201_CARE_COUNT_CONSISTENCY?.reconcileCounts?.();
  }

  function showNextSevenDaysOnly() {
    expanded = false;
    mutating = true;
    try {
      removeMonthHeadings();
      removeDeferredSyntheticCards();
      groupFutureCardsByMonth();
      updateFutureRangeCopy();
      refreshExistingCareHooks();
      updateMonthHeadingVisibility();
    } finally {
      mutating = false;
    }
    updateRangeControl();
    updateLaterSearchControl();
    window.WAFFLE_V11201_CARE_COUNT_CONSISTENCY?.reconcileCounts?.();
  }

  function requestedDeepLinkKey() {
    try {
      return String(new URLSearchParams(window.location.search).get('stayKey') || '').trim();
    } catch (_) {
      return '';
    }
  }

  function removeMonthHeadings() {
    grid()?.querySelectorAll(`:scope > .${MONTH_HEADING_CLASS}`).forEach(node => node.remove());
  }

  function groupFutureCardsByMonth() {
    const host = grid();
    if (!host) return;

    removeMonthHeadings();
    const cards = futureCardsWithinHorizon();
    const groups = new Map();

    cards.forEach(card => {
      card.dataset.v1082StayKind = 'future';
      card.classList.add('v11195-future-stay');
      const key = monthKeyForCard(card);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    });

    const fragment = document.createDocumentFragment();
    groups.forEach((monthCards, key) => {
      const heading = document.createElement('div');
      heading.className = MONTH_HEADING_CLASS;
      heading.dataset.v11196Month = key;
      heading.innerHTML = `
        <div>
          <span class="v11196-month-kicker">Upcoming month</span>
          <strong>${escapeHtml(monthLabel(key))}</strong>
        </div>
        <span class="v11196-month-count">${monthCards.length} ${monthCards.length === 1 ? 'stay' : 'stays'}</span>`;
      fragment.appendChild(heading);
      monthCards.forEach(card => fragment.appendChild(card));
    });

    host.appendChild(fragment);
  }

  function updateMonthHeadingVisibility() {
    const host = grid();
    if (!host) return;
    const futureView = document.querySelector('.directory-dashboard-fused')?.dataset?.v11195StayView === 'future';

    host.querySelectorAll(`:scope > .${MONTH_HEADING_CLASS}`).forEach(heading => {
      if (!futureView) {
        heading.hidden = false;
        return;
      }
      const month = heading.dataset.v11196Month || '';
      const hasVisibleCard = futureCardsWithinHorizon().some(card => {
        return monthKeyForCard(card) === month && card.style.display !== 'none' && !card.hidden;
      });
      heading.hidden = !hasVisibleCard;
    });
  }

  function updateFutureRangeCopy() {
    const copy = expanded
      ? 'Next 6+ months · grouped by month'
      : 'Next 7 days · more arrivals on demand';
    const heading = document.getElementById('v11195FutureStayHeading');
    if (heading) {
      const right = heading.querySelector(':scope > span');
      if (right) right.textContent = copy;
    }

    const note = document.querySelector('.guest-directory-toolbar-note');
    const dashboard = document.querySelector('.directory-dashboard-fused');
    if (dashboard) {
      dashboard.dataset.v11196FutureRangeMonths = String(FULL_MONTHS_AHEAD);
      dashboard.dataset.v11196FutureHorizon = horizonKey();
    }

    if (dashboard?.dataset?.v11195StayView === 'future' && note) {
      note.textContent = expanded
        ? 'Showing confirmed arrivals for the next six months, grouped by month. Open any dog for its full Care profile.'
        : 'Showing arrivals for the next seven days. Open later arrivals only when you need the longer view.';
    }
  }

  function refreshExistingCareHooks() {
    try {
      window.WAFFLE_V11195_FUTURE_STAYS?.classifyAndCount?.();
    } catch (_) {}
    try {
      if (typeof filterGuestDirectoryCards === 'function') filterGuestDirectoryCards();
    } catch (_) {}
  }

  function maintain() {
    scheduled = false;
    if (!isCarePage() || mutating) return;
    const host = grid();
    if (!host) return;

    if (!cacheReady) {
      const events = futureEvents();
      if (events.length || getCalendarAdapter()) cacheEvents(events);
    }
    if (!cacheReady) return;

    const deepLinkKey = requestedDeepLinkKey();
    if (deepLinkKey && cachedFutureEvents.some(event => {
      return stayKeyFor(event) === deepLinkKey && eventDates(event).start > sevenDayKey();
    })) {
      expanded = true;
    }

    mutating = true;
    try {
      const initialEvents = cachedFutureEvents.filter(event => eventDates(event).start <= sevenDayKey());
      reconcileFutureCards(expanded ? cachedFutureEvents : initialEvents);
      groupFutureCardsByMonth();
      updateFutureRangeCopy();
      refreshExistingCareHooks();
      updateMonthHeadingVisibility();
      gridObserver?.takeRecords?.();
    } finally {
      mutating = false;
    }
    updateRangeControl();
    updateLaterSearchControl();
    window.WAFFLE_V11201_CARE_COUNT_CONSISTENCY?.reconcileCounts?.();
  }

  function scheduleMaintain() {
    if (scheduled || mutating) return;
    scheduled = true;
    requestAnimationFrame(maintain);
  }

  function startObserver() {
    const host = grid();
    if (!host || gridObserver) return;
    gridObserver = new MutationObserver(() => {
      if (!mutating) scheduleMaintain();
    });
    gridObserver.observe(host, { childList: true, subtree: false });
  }

  function start() {
    if (!isCarePage()) return;
    startObserver();
    ensureRangeControl();

    document.addEventListener('click', event => {
      if (event.target?.closest?.('[data-v1082-stay-tab="future"]')) {
        laterSearchRevision++;
        setTimeout(() => {
          updateFutureRangeCopy();
          updateMonthHeadingVisibility();
          updateRangeControl();
          updateLaterSearchControl();
        }, 0);
      }
      const otherTab = event.target?.closest?.('[data-v1082-stay-tab]:not([data-v1082-stay-tab="future"])');
      if (otherTab) {
        laterSearchRevision++;
        setTimeout(updateLaterSearchControl, 0);
      }
      if (event.target?.closest?.('[data-directory-search-clear]')) setTimeout(updateLaterSearchControl, 0);
      const rangeButton = event.target?.closest?.('[data-v11196-expand-later]');
      if (rangeButton) {
        if (rangeButton.dataset.v11196Action === 'collapse') showNextSevenDaysOnly();
        else activateLaterArrivals();
      }
    }, true);

    document.getElementById('guestDirectorySearch')?.addEventListener('input', event => {
      laterSearchRevision++;
      requestAnimationFrame(updateMonthHeadingVisibility);
      requestAnimationFrame(updateRangeControl);
      requestAnimationFrame(updateLaterSearchControl);
    });

    window.addEventListener('pageshow', scheduleMaintain);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleMaintain();
    });
  }

  window.WAFFLE_V11196_FUTURE_RANGE = Object.freeze({
    version: VERSION,
    monthsAhead: FULL_MONTHS_AHEAD,
    horizonKey,
    updateEvents(events) {
      cacheEvents(events);
      maintain();
    },
    activateLaterArrivals,
    showNextSevenDaysOnly,
    isExpanded: () => expanded,
    totalFutureCount,
    deferredCount: () => laterEvents().length,
    maintain
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
