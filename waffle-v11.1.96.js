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
  let refreshTimer = 0;

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
        const key = stayKeyFor(event);
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

  function grid() {
    return document.getElementById('directory-grid');
  }

  function allCareCards() {
    const host = grid();
    if (!host) return [];
    return Array.from(host.querySelectorAll(':scope > .directory-card[data-directory-stay-key]'));
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
        const key = String(card.dataset.directoryStayKey || '');
        if (!validKeys.has(key)) card.remove();
      });
  }

  function reconcileFutureCards(events) {
    const host = grid();
    if (!host) return;

    const validKeys = new Set(events.map(stayKeyFor));
    removeStaleSyntheticCards(validKeys);

    const cardsByKey = new Map();
    allCareCards().forEach(card => {
      const key = String(card.dataset.directoryStayKey || '');
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
      const key = stayKeyFor(event);
      const existing = allCareCards().find(card => String(card.dataset.directoryStayKey || '') === key);
      if (existing) return;
      const card = createFutureCard(event);
      if (card) host.appendChild(card);
    });
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
    const heading = document.getElementById('v11195FutureStayHeading');
    if (heading) {
      const right = heading.querySelector(':scope > span');
      if (right) right.textContent = 'Next 6+ months · grouped by month';
    }

    const note = document.querySelector('.guest-directory-toolbar-note');
    const dashboard = document.querySelector('.directory-dashboard-fused');
    if (dashboard) {
      dashboard.dataset.v11196FutureRangeMonths = String(FULL_MONTHS_AHEAD);
      dashboard.dataset.v11196FutureHorizon = horizonKey();
    }

    if (dashboard?.dataset?.v11195StayView === 'future' && note) {
      note.textContent = 'Future stays cover at least six months and are grouped by arrival month. Open any dog for the same full Care profile.';
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

    const events = futureEvents();
    if (!events.length && !getCalendarAdapter()) return;

    mutating = true;
    try {
      reconcileFutureCards(events);
      groupFutureCardsByMonth();
      updateFutureRangeCopy();
      refreshExistingCareHooks();
      updateMonthHeadingVisibility();
      gridObserver?.takeRecords?.();
    } finally {
      mutating = false;
    }
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
    scheduleMaintain();

    document.addEventListener('click', event => {
      if (event.target?.closest?.('[data-v1082-stay-tab="future"]')) {
        setTimeout(() => {
          updateFutureRangeCopy();
          updateMonthHeadingVisibility();
        }, 0);
      }
    }, true);

    document.getElementById('guestDirectorySearch')?.addEventListener('input', () => {
      requestAnimationFrame(updateMonthHeadingVisibility);
    });

    window.addEventListener('pageshow', scheduleMaintain);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleMaintain();
    });

    clearInterval(refreshTimer);
    refreshTimer = window.setInterval(scheduleMaintain, 15000);
  }

  window.WAFFLE_V11196_FUTURE_RANGE = Object.freeze({
    version: VERSION,
    monthsAhead: FULL_MONTHS_AHEAD,
    horizonKey,
    maintain
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
