/* ============================================================
   WAFFLE HOUSE V11.1.98 — CONFIRMED STAY PROFILE + DELETE
   ------------------------------------------------------------
   Makes confirmed Calendar bars first-class Care links, including grouped
   multi-dog labels, and exposes a stay-scoped delete action in Current/Future
   Care profiles. Deleting a stay removes the booking only; reusable dog/master
   profile data remains intact.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_V11198_CONFIRMED_STAY_ACTIONS) return;

  const VERSION = '11.1.98';
  const WAIT_TIMEOUT_MS = 10000;
  const POLL_MS = 160;
  let enhanceScheduled = false;
  let deepLinkPromise = null;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  }

  function localDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  function todayKey() {
    return localDateKey(new Date());
  }

  function normalizeIdentity(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stableStayKey(dogName, startDate, endDate) {
    return [
      String(dogName || '').trim().toLowerCase(),
      String(startDate || '').trim(),
      String(endDate || startDate || '').trim()
    ].join('|');
  }

  function parseCalendarEventKey(value) {
    const parts = String(value || '').split('|');
    if (parts.length < 6) return null;

    const type = String(parts[0] || '');
    const time = String(parts[parts.length - 1] || '');
    const endDate = String(parts[parts.length - 2] || '');
    const startDate = String(parts[parts.length - 3] || '');
    const dogName = parts.slice(2, parts.length - 3).join('|').trim();

    if (type !== 'confirmed' || !dogName || !startDate) return null;
    return {
      type,
      id: String(parts[1] || ''),
      dogName,
      startDate,
      endDate: endDate || startDate,
      time
    };
  }

  function stayViewFor(startDate, endDate) {
    const today = todayKey();
    if (String(startDate || '') > today) return 'future';
    if (String(endDate || startDate || '') < today) return 'past';
    return 'current';
  }

  function routeConfirmedCalendarBar(record) {
    const url = new URL('directory.html', window.location.href);
    const stayKey = stableStayKey(record.dogName, record.startDate, record.endDate);
    url.searchParams.set('stayKey', stayKey);
    url.searchParams.set('dogName', record.dogName);
    url.searchParams.set('startDate', record.startDate);
    url.searchParams.set('endDate', record.endDate);
    url.searchParams.set('stayView', stayViewFor(record.startDate, record.endDate));
    window.location.href = url.href;
  }

  function calendarClickCapture(event) {
    if (pageName() !== 'calendar') return;
    const target = event.target instanceof Element
      ? event.target.closest('.wh65-bar.confirmed[data-wh65-event]')
      : null;
    if (!target) return;

    const record = parseCalendarEventKey(target.dataset.wh65Event);
    if (!record) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    routeConfirmedCalendarBar(record);
  }

  function requestedIdentity() {
    if (pageName() !== 'directory') return null;
    const params = new URLSearchParams(window.location.search);
    const stayKey = String(params.get('stayKey') || '').trim();
    const dogName = String(params.get('dogName') || '').trim();
    const startDate = String(params.get('startDate') || '').trim();
    const endDate = String(params.get('endDate') || startDate || '').trim();
    const requestedView = String(params.get('stayView') || '').trim();

    if (!stayKey && !(dogName && startDate)) return null;
    return {
      stayKey,
      dogName,
      startDate,
      endDate,
      stayView: ['current', 'future', 'past'].includes(requestedView)
        ? requestedView
        : stayViewFor(startDate, endDate)
    };
  }

  function cardStayIdentity(card) {
    return {
      stayKey: String(card?.dataset?.directoryStayKey || card?.dataset?.stayKey || '').trim(),
      dogName: String(card?.dataset?.directoryDogName || card?.dataset?.dogName || '').trim(),
      startDate: String(card?.dataset?.directoryStartDate || card?.dataset?.startDate || '').slice(0, 10),
      endDate: String(card?.dataset?.directoryEndDate || card?.dataset?.endDate || '').slice(0, 10)
    };
  }

  function candidateCards(view) {
    const selector = view === 'past'
      ? '#past-directory-grid .directory-card[data-directory-stay-key]'
      : '#directory-grid .directory-card[data-directory-stay-key]';
    return Array.from(document.querySelectorAll(selector));
  }

  function findRequestedCard(identity) {
    const cards = candidateCards(identity.stayView);
    if (identity.stayKey) {
      const exact = cards.find(card =>
        String(card.dataset.directoryStayKey || card.dataset.stayKey || '') === identity.stayKey
      );
      if (exact) return exact;
    }

    const wantedDog = normalizeIdentity(identity.dogName);
    return cards.find(card => {
      const item = cardStayIdentity(card);
      if (wantedDog && normalizeIdentity(item.dogName) !== wantedDog) return false;
      if (identity.startDate && item.startDate !== identity.startDate) return false;
      if (identity.endDate && item.endDate !== identity.endDate) return false;
      return true;
    }) || null;
  }

  function activateStayView(view) {
    try {
      if (typeof window.v1082SwitchStayView === 'function') {
        window.v1082SwitchStayView(view, { instant: true });
        return;
      }
    } catch (_) {}

    const button = document.querySelector(`[data-v1082-stay-tab="${view}"]`);
    if (button instanceof HTMLElement) button.click();
  }

  function promptFutureRange() {
    try {
      window.WAFFLE_V11196_FUTURE_RANGE?.maintain?.();
    } catch (_) {}
  }

  function delay(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  async function openRequestedProfile() {
    const identity = requestedIdentity();
    if (!identity || identity.stayView === 'past') return false;

    activateStayView(identity.stayView);
    if (identity.stayView === 'future') promptFutureRange();

    const startedAt = Date.now();
    while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
      const card = findRequestedCard(identity);
      if (card) {
        activateStayView(identity.stayView);
        try {
          if (typeof window.openDirectoryGuestProfile === 'function') {
            await window.openDirectoryGuestProfile(card, { instant: true });
          } else {
            card.querySelector('[data-open-directory-profile]')?.click();
          }
          return true;
        } catch (error) {
          console.error('Confirmed stay Care profile could not open:', error);
          return false;
        }
      }

      if (identity.stayView === 'future') promptFutureRange();
      await delay(POLL_MS);
    }

    console.warn('Confirmed stay profile was not available before deep-link timeout:', identity);
    return false;
  }

  function ensureStyles() {
    if (document.getElementById('v11198ConfirmedStayStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11198ConfirmedStayStyle';
    style.textContent = `
      body[data-waffle-page="directory"] .v11198-confirmed-actions {
        display:flex;align-items:center;justify-content:flex-end;gap:8px;
        margin:0 0 12px;padding:8px 0 0;
      }
      body[data-waffle-page="directory"] .v11198-delete-stay {
        min-height:36px;padding:8px 11px;border:1px solid color-mix(in srgb,#dc2626 60%,#cbd5e1);
        border-radius:10px;background:color-mix(in srgb,#dc2626 9%,transparent);color:#b91c1c;
        font:inherit;font-size:10px;font-weight:900;cursor:pointer;
      }
      body.dark-theme[data-waffle-page="directory"] .v11198-delete-stay {
        color:#fecaca;border-color:color-mix(in srgb,#ef4444 60%,#475569);
        background:color-mix(in srgb,#ef4444 12%,#17243a);
      }
      body[data-waffle-page="directory"] .v11198-delete-stay:hover:not(:disabled) {
        border-color:#dc2626;box-shadow:0 0 0 3px rgba(220,38,38,.12);
      }
      body[data-waffle-page="directory"] .v11198-delete-stay:focus-visible {
        outline:3px solid rgba(220,38,38,.22);outline-offset:2px;
      }
      body[data-waffle-page="directory"] .v11198-delete-stay:disabled { opacity:.6;cursor:wait; }
    `;
    document.head.appendChild(style);
  }

  function isDeletableConfirmedCard(card) {
    if (!card) return false;
    if (card.dataset.v1082PastStay === 'true') return false;
    if (card.closest('#past-directory-grid')) return false;
    const identity = cardStayIdentity(card);
    return !!identity.dogName && !!identity.startDate;
  }

  function enhanceDeleteAction(card) {
    if (!isDeletableConfirmedCard(card)) return;
    const content = card.querySelector('.directory-profile-content');
    const header = content?.querySelector('.directory-card-header');
    if (!content || !header || content.querySelector(':scope > .v11198-confirmed-actions')) return;

    const actions = document.createElement('div');
    actions.className = 'v11198-confirmed-actions';
    actions.innerHTML = '<button type="button" class="v11198-delete-stay" data-v11198-delete-confirmed>🗑 Delete Confirmed Stay</button>';
    header.insertAdjacentElement('afterend', actions);
  }

  function enhanceAllCards() {
    enhanceScheduled = false;
    if (pageName() !== 'directory') return;
    ensureStyles();
    document.querySelectorAll('#directory-grid .directory-card[data-directory-stay-key]')
      .forEach(enhanceDeleteAction);
  }

  function scheduleEnhance() {
    if (enhanceScheduled) return;
    enhanceScheduled = true;
    requestAnimationFrame(enhanceAllCards);
  }

  function notify(message, kind) {
    try {
      if (window.WAFFLE_PHASE4_CORE?.toast) {
        window.WAFFLE_PHASE4_CORE.toast(message, kind || 'info');
        return;
      }
    } catch (_) {}
    try {
      if (typeof window.showToast === 'function') {
        window.showToast(message, kind || 'info');
        return;
      }
    } catch (_) {}
    console.log(message);
  }

  function adapterEvents() {
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar?.getEvents) {
        return globalCalendar.getEvents() || [];
      }
    } catch (_) {}
    try {
      return window.globalCalendar?.getEvents?.() || [];
    } catch (_) {
      return [];
    }
  }

  function eventIdentity(event) {
    const props = event?.extendedProps || {};
    let endDate = String(props.rawEndDate || props.endDate || '').slice(0, 10);
    if (!endDate && event?.end) {
      const date = new Date(event.end);
      if (!Number.isNaN(date.getTime())) {
        if (event.allDay !== false) date.setDate(date.getDate() - 1);
        endDate = localDateKey(date);
      }
    }
    return {
      dogName: String(props.dogName || event?.title || '').trim(),
      startDate: String(props.rawStartDate || props.startDate || event?.startStr || '').slice(0, 10) || localDateKey(event?.start),
      endDate
    };
  }

  function removeMatchingAdapterEvents(identity) {
    const wantedDog = normalizeIdentity(identity.dogName);
    adapterEvents().forEach(event => {
      const props = event?.extendedProps || {};
      if (props.isPotential === true || props.isMeetGreet === true) return;
      const item = eventIdentity(event);
      if (normalizeIdentity(item.dogName) !== wantedDog) return;
      if (item.startDate !== identity.startDate) return;
      if ((item.endDate || item.startDate) !== (identity.endDate || identity.startDate)) return;
      try { event.remove?.(); } catch (_) {}
    });
  }

  function removeTemporaryConfirmed(identity) {
    try {
      const rows = JSON.parse(localStorage.getItem('temporaryConfirmedStays') || '[]');
      if (!Array.isArray(rows)) return;
      const wantedDog = normalizeIdentity(identity.dogName);
      const filtered = rows.filter(row => {
        const props = row?.extendedProps || row || {};
        const dogName = String(props.dogName || row?.title || '').trim();
        const startDate = String(props.rawStartDate || props.startDate || row?.start || '').slice(0, 10);
        const endDate = String(props.rawEndDate || props.endDate || row?.end || startDate || '').slice(0, 10);
        return !(
          normalizeIdentity(dogName) === wantedDog &&
          startDate === identity.startDate &&
          (endDate || startDate) === (identity.endDate || identity.startDate)
        );
      });
      localStorage.setItem('temporaryConfirmedStays', JSON.stringify(filtered));
    } catch (_) {}
  }

  async function refreshAfterDelete(identity) {
    removeMatchingAdapterEvents(identity);
    removeTemporaryConfirmed(identity);

    try { localStorage.removeItem('boardingDataCache'); } catch (_) {}

    try {
      if (typeof window.invalidateWaffleClientCaches === 'function') {
        await window.invalidateWaffleClientCaches(['directory']);
      }
    } catch (_) {}

    try {
      if (typeof window.syncSpreadsheetData === 'function') {
        await window.syncSpreadsheetData({});
      }
    } catch (error) {
      console.warn('Confirmed stay deleted, but immediate spreadsheet refresh failed:', error);
    }

    try {
      window.dispatchEvent(new CustomEvent('waffle:phase4-data-changed'));
    } catch (_) {}
  }

  function formatStay(identity) {
    return `${identity.startDate} → ${identity.endDate || identity.startDate}`;
  }

  async function deleteConfirmedStay(card, button) {
    const identity = cardStayIdentity(card);
    if (!identity.dogName || !identity.startDate) return;

    const confirmed = window.confirm(
      `Delete the confirmed stay for ${identity.dogName}?\n\n` +
      `${formatStay(identity)}\n\n` +
      `This removes the booking from Calendar and Care. The reusable dog/master profile and photos are kept.`
    );
    if (!confirmed) return;

    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ Deleting…';

    try {
      if (typeof window.queryAppsScript !== 'function') {
        throw new Error('The Waffle backend is not available.');
      }

      const response = await window.queryAppsScript({
        action: 'delete_confirmed_stay',
        stayKey: identity.stayKey,
        dogName: identity.dogName,
        startDate: identity.startDate,
        endDate: identity.endDate || identity.startDate
      }, {
        maxAttempts: 2,
        timeoutMs: 30000
      });

      if (!response || response.result !== 'success') {
        throw new Error(response?.error || 'The confirmed stay could not be deleted.');
      }

      try {
        if (typeof window.closeDirectoryGuestProfile === 'function') {
          window.closeDirectoryGuestProfile({ preserveScroll: true, instant: true });
        }
      } catch (_) {}

      card.remove();
      try { window.WAFFLE_V11195_FUTURE_STAYS?.classifyAndCount?.(); } catch (_) {}
      notify(`✅ Confirmed stay deleted for ${identity.dogName}.`, 'success');
      await refreshAfterDelete(identity);
      scheduleEnhance();
    } catch (error) {
      console.error('Confirmed stay deletion failed:', error);
      button.disabled = false;
      button.textContent = oldText;
      window.alert(`Could not delete this confirmed stay.\n\n${error?.message || String(error)}`);
    }
  }

  function careClickCapture(event) {
    if (pageName() !== 'directory') return;
    const button = event.target instanceof Element
      ? event.target.closest('[data-v11198-delete-confirmed]')
      : null;
    if (!button) return;
    const card = button.closest('.directory-card[data-directory-stay-key]');
    if (!card || !isDeletableConfirmedCard(card)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    deleteConfirmedStay(card, button);
  }

  function startCare() {
    if (pageName() !== 'directory') return;
    ensureStyles();
    enhanceAllCards();

    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    const runDeepLink = () => {
      if (!requestedIdentity()) return;
      if (!deepLinkPromise) {
        deepLinkPromise = openRequestedProfile().finally(() => {
          window.setTimeout(() => { deepLinkPromise = null; }, 500);
        });
      }
    };

    runDeepLink();
    window.addEventListener('pageshow', runDeepLink);
  }

  document.addEventListener('click', calendarClickCapture, true);
  document.addEventListener('click', careClickCapture, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startCare, { once: true });
  } else {
    startCare();
  }

  window.WAFFLE_V11198_CONFIRMED_STAY_ACTIONS = Object.freeze({
    version: VERSION,
    parseCalendarEventKey,
    stableStayKey,
    openRequestedProfile
  });
})();
