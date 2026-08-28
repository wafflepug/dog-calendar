/* ============================================================
   WAFFLE HOUSE V11.2.00 — CONFIRMED DELETE CONSISTENCY
   ------------------------------------------------------------
   Prevents a successfully deleted confirmed stay from being resurrected by
   a briefly stale published CSV. Deletion is idempotent: a backend "not found"
   response is treated as already deleted, then the stale local Calendar/Care
   representation is purged.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_V11200_DELETE_CONSISTENCY) return;

  const VERSION = '11.2.00';
  const STORAGE_KEY = 'waffleDeletedConfirmedStays';
  const TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000;
  let originalParseCSVToEvents = null;
  let purgeScheduled = false;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  }

  function normalizeIdentity(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function fallbackDateKey(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const iso = text.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const au = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (au) return `${au[3]}-${String(au[2]).padStart(2, '0')}-${String(au[1]).padStart(2, '0')}`;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return '';
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  function dateKey(value) {
    try {
      if (typeof parseCsvDate === 'function') {
        const parsed = String(parseCsvDate(value) || '').trim();
        if (parsed) return parsed;
      }
    } catch (_) {}
    return fallbackDateKey(value);
  }

  function identityKey(identity) {
    return [
      normalizeIdentity(identity?.dogName),
      String(identity?.startDate || '').slice(0, 10),
      String(identity?.endDate || identity?.startDate || '').slice(0, 10)
    ].join('|');
  }

  function readTombstones() {
    let rows = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(parsed)) rows = parsed;
    } catch (_) {}

    const cutoff = Date.now() - TOMBSTONE_TTL_MS;
    const active = rows.filter(row => Number(row?.deletedAt || 0) >= cutoff && row?.key);
    if (active.length !== rows.length) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(active)); } catch (_) {}
    }
    return active;
  }

  function isDeleted(identity) {
    const key = identityKey(identity);
    if (!key || key.startsWith('|')) return false;
    return readTombstones().some(row => row.key === key);
  }

  function recordDeletion(identity) {
    const key = identityKey(identity);
    if (!key || key.startsWith('|')) return;
    const rows = readTombstones().filter(row => row.key !== key);
    rows.push({
      key,
      dogName: String(identity.dogName || ''),
      startDate: String(identity.startDate || '').slice(0, 10),
      endDate: String(identity.endDate || identity.startDate || '').slice(0, 10),
      deletedAt: Date.now()
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-80))); } catch (_) {}
  }

  function decodeCsvCell(value) {
    let text = String(value == null ? '' : value);
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1).replace(/""/g, '"');
    }
    return text.trim();
  }

  function csvRowIdentity(line) {
    const cells = String(line || '')
      .split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/)
      .map(decodeCsvCell);
    while (cells.length < 12) cells.push('');
    const bookingType = String(cells[11] || '').trim().toLowerCase();
    if (bookingType === 'meet & greet' || bookingType === 'potential stay') return null;
    const startDate = dateKey(cells[3]);
    return {
      dogName: String(cells[1] || '').trim(),
      startDate,
      endDate: dateKey(cells[4]) || startDate
    };
  }

  function removeFromCachedCsv(identity) {
    try {
      const csv = localStorage.getItem('boardingDataCache') || '';
      if (!csv) return;
      const lines = csv.split(/\r?\n/);
      if (lines.length < 2) return;
      const wanted = identityKey(identity);
      const kept = [lines[0]];
      for (let i = 1; i < lines.length; i += 1) {
        if (!lines[i].trim()) continue;
        const rowIdentity = csvRowIdentity(lines[i]);
        if (rowIdentity && identityKey(rowIdentity) === wanted) continue;
        kept.push(lines[i]);
      }
      localStorage.setItem('boardingDataCache', kept.join('\n'));
    } catch (_) {}
  }

  function cardIdentity(card) {
    return {
      dogName: String(card?.dataset?.directoryDogName || card?.dataset?.dogName || '').trim(),
      startDate: String(card?.dataset?.directoryStartDate || card?.dataset?.startDate || '').slice(0, 10),
      endDate: String(card?.dataset?.directoryEndDate || card?.dataset?.endDate || '').slice(0, 10)
    };
  }

  function eventIdentity(event) {
    const props = event?.extendedProps || {};
    let endDate = String(props.rawEndDate || props.endDate || '').slice(0, 10);
    if (!endDate && event?.end) {
      const end = new Date(event.end);
      if (!Number.isNaN(end.getTime())) {
        if (event.allDay !== false) end.setDate(end.getDate() - 1);
        endDate = fallbackDateKey(end);
      }
    }
    const startDate = String(props.rawStartDate || props.startDate || event?.startStr || '').slice(0, 10) || fallbackDateKey(event?.start);
    return {
      dogName: String(props.dogName || event?.title || '').trim(),
      startDate,
      endDate: endDate || startDate
    };
  }

  function confirmedEventIsDeleted(event) {
    const props = event?.extendedProps || {};
    if (props.isPotential === true || props.isMeetGreet === true) return false;
    return isDeleted(eventIdentity(event));
  }

  function filterCalendarEvents(events) {
    return Array.isArray(events) ? events.filter(event => !confirmedEventIsDeleted(event)) : events;
  }

  function calendarEvents() {
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar?.getEvents) return globalCalendar.getEvents() || [];
    } catch (_) {}
    try { return window.globalCalendar?.getEvents?.() || []; } catch (_) { return []; }
  }

  function purgeDeletedUi() {
    let removedCard = false;
    document.querySelectorAll('#directory-grid .directory-card[data-directory-stay-key]').forEach(card => {
      if (!isDeleted(cardIdentity(card))) return;
      card.remove();
      removedCard = true;
    });

    calendarEvents().forEach(event => {
      if (!confirmedEventIsDeleted(event)) return;
      try { event.remove?.(); } catch (_) {}
    });

    if (removedCard) {
      try { window.WAFFLE_V11195_FUTURE_STAYS?.classifyAndCount?.(); } catch (_) {}
    }
  }

  function schedulePurge() {
    if (purgeScheduled) return;
    purgeScheduled = true;
    requestAnimationFrame(() => {
      purgeScheduled = false;
      purgeDeletedUi();
    });
  }

  function installCsvFilter() {
    try {
      if (originalParseCSVToEvents || typeof parseCSVToEvents !== 'function') return;
      originalParseCSVToEvents = parseCSVToEvents;
      parseCSVToEvents = function(...args) {
        const events = originalParseCSVToEvents.apply(this, args);
        purgeDeletedUi();
        return filterCalendarEvents(events);
      };
    } catch (error) {
      console.warn('Deleted-stay Calendar filter could not be installed:', error);
    }
  }

  function removeTemporaryConfirmed(identity) {
    try {
      const rows = JSON.parse(localStorage.getItem('temporaryConfirmedStays') || '[]');
      if (!Array.isArray(rows)) return;
      const wanted = identityKey(identity);
      const filtered = rows.filter(row => {
        const props = row?.extendedProps || row || {};
        const item = {
          dogName: String(props.dogName || row?.title || '').trim(),
          startDate: String(props.rawStartDate || props.startDate || row?.start || '').slice(0, 10),
          endDate: String(props.rawEndDate || props.endDate || row?.end || props.rawStartDate || props.startDate || row?.start || '').slice(0, 10)
        };
        return identityKey(item) !== wanted;
      });
      localStorage.setItem('temporaryConfirmedStays', JSON.stringify(filtered));
    } catch (_) {}
  }

  function notify(message, kind) {
    try {
      if (window.WAFFLE_PHASE4_CORE?.toast) return window.WAFFLE_PHASE4_CORE.toast(message, kind || 'info');
    } catch (_) {}
    try {
      if (typeof window.showToast === 'function') return window.showToast(message, kind || 'info');
    } catch (_) {}
    console.log(message);
  }

  function alreadyDeletedResponse(response) {
    const message = String(response?.error || response?.message || '');
    return /confirmed stay not found/i.test(message);
  }

  async function settleDeletedStay(identity, card, alreadyDeleted) {
    recordDeletion(identity);
    removeFromCachedCsv(identity);
    removeTemporaryConfirmed(identity);

    try {
      if (typeof window.closeDirectoryGuestProfile === 'function') {
        window.closeDirectoryGuestProfile({ preserveScroll: true, instant: true });
      }
    } catch (_) {}

    try { card?.remove?.(); } catch (_) {}
    purgeDeletedUi();
    try { window.WAFFLE_V11195_FUTURE_STAYS?.classifyAndCount?.(); } catch (_) {}

    notify(
      alreadyDeleted
        ? `✅ ${identity.dogName} was already deleted. Stale Calendar data has been cleared.`
        : `✅ Confirmed stay deleted for ${identity.dogName}.`,
      'success'
    );

    try {
      if (typeof window.invalidateWaffleClientCaches === 'function') {
        await window.invalidateWaffleClientCaches(['directory']);
      }
    } catch (_) {}

    try {
      if (typeof window.syncSpreadsheetData === 'function') await window.syncSpreadsheetData({});
    } catch (error) {
      console.warn('Confirmed stay deleted, but immediate spreadsheet refresh failed:', error);
    }

    purgeDeletedUi();
    [250, 1000, 3000, 8000].forEach(ms => window.setTimeout(purgeDeletedUi, ms));
    try { window.dispatchEvent(new CustomEvent('waffle:phase4-data-changed')); } catch (_) {}
  }

  async function deleteConfirmedStay(card, button) {
    const identity = cardIdentity(card);
    identity.endDate = identity.endDate || identity.startDate;
    if (!identity.dogName || !identity.startDate) return;

    const confirmed = window.confirm(
      `Delete the confirmed stay for ${identity.dogName}?\n\n` +
      `${identity.startDate} → ${identity.endDate}\n\n` +
      'This removes the booking from Calendar and Care. The reusable dog/master profile and photos are kept.'
    );
    if (!confirmed) return;

    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ Deleting…';

    try {
      if (typeof window.queryAppsScript !== 'function') throw new Error('The Waffle backend is not available.');
      const response = await window.queryAppsScript({
        action: 'delete_confirmed_stay',
        stayKey: String(card.dataset.directoryStayKey || card.dataset.stayKey || ''),
        dogName: identity.dogName,
        startDate: identity.startDate,
        endDate: identity.endDate
      }, { maxAttempts: 2, timeoutMs: 30000 });

      const alreadyDeleted = response?.result !== 'success' && alreadyDeletedResponse(response);
      if (!response || (response.result !== 'success' && !alreadyDeleted)) {
        throw new Error(response?.error || 'The confirmed stay could not be deleted.');
      }

      await settleDeletedStay(identity, card, alreadyDeleted);
    } catch (error) {
      console.error('Confirmed stay deletion failed:', error);
      button.disabled = false;
      button.textContent = oldText;
      window.alert(`Could not delete this confirmed stay.\n\n${error?.message || String(error)}`);
    }
  }

  function careDeleteCapture(event) {
    if (pageName() !== 'directory') return;
    const button = event.target instanceof Element
      ? event.target.closest('[data-v11198-delete-confirmed]')
      : null;
    if (!button) return;
    const card = button.closest('.directory-card[data-directory-stay-key]');
    if (!card) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    deleteConfirmedStay(card, button);
  }

  function startObserver() {
    if (!document.documentElement) return;
    const observer = new MutationObserver(schedulePurge);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  installCsvFilter();
  document.addEventListener('click', careDeleteCapture, true);

  const start = () => {
    installCsvFilter();
    startObserver();
    schedulePurge();
    window.addEventListener('pageshow', schedulePurge);
    window.addEventListener('storage', event => {
      if ([STORAGE_KEY, 'boardingDataCache', 'temporaryConfirmedStays'].includes(event.key)) schedulePurge();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') schedulePurge();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.WAFFLE_V11200_DELETE_CONSISTENCY = Object.freeze({
    version: VERSION,
    storageKey: STORAGE_KEY,
    isDeleted,
    recordDeletion,
    purge: purgeDeletedUi,
    filterEvents: filterCalendarEvents
  });
})();
