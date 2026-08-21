/* ============================================================
   WAFFLE HOUSE V11.1.9 — PAST STAYS ARE CHECKED OUT
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.9';

  function localToday() {
    if (typeof window.getLocalTodayDateString === 'function') {
      try { return window.getLocalTodayDateString(); } catch (_) {}
    }
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function normaliseDate(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : text.slice(0, 10);
  }

  function isPastDate(endDate) {
    const end = normaliseDate(endDate);
    return Boolean(end && end < localToday());
  }

  function eventIsPast(event) {
    if (!event) return false;
    try {
      if (typeof window.v10EventRawDates === 'function') {
        const dates = window.v10EventRawDates(event);
        return isPastDate(dates?.end || dates?.start || '');
      }
    } catch (_) {}
    return isPastDate(event.endStr || event.startStr || '');
  }

  function isPastCareCard(card) {
    if (!card) return false;
    if (card.dataset?.v1082PastStay === 'true') return true;
    return isPastDate(card.dataset?.directoryEndDate || card.dataset?.endDate || '');
  }

  function markCardCheckedOut(card) {
    if (!isPastCareCard(card)) return;

    card.dataset.v1119EffectiveStatus = 'checked_out';
    card.dataset.v1118PriorityScore = '0';

    const chip = card.querySelector('[data-v1118-status-chip]');
    if (chip) {
      chip.textContent = 'CHECKED OUT';
      chip.classList.remove('is-past-stay');
      chip.classList.add('is-checked-out');
    }

    const signals = card.querySelector('[data-v1118-care-signals]');
    if (signals) {
      signals.innerHTML = '';
      signals.hidden = true;
    }
  }

  function reconcileCareCards() {
    document.querySelectorAll('.directory-card[data-directory-stay-key]').forEach(markCardCheckedOut);
  }

  function reconcileSearchResults() {
    document.querySelectorAll('.v1118-search-result .v1118-status-chip').forEach(chip => {
      if (String(chip.textContent || '').trim().toUpperCase() !== 'PAST STAY') return;
      chip.textContent = 'CHECKED OUT';
      chip.classList.remove('is-past-stay');
      chip.classList.add('is-checked-out');
      chip.closest('.v1118-search-result')?.setAttribute('data-v1119-effective-status', 'checked_out');
    });
  }

  function reconcileAll() {
    reconcileCareCards();
    reconcileSearchResults();
  }

  function wrapOperationalStatus() {
    const baseCheckedOut = window.v110IsCheckedOutEvent;
    if (typeof baseCheckedOut === 'function' && !baseCheckedOut.v1119PastCheckoutWrapped) {
      const wrappedCheckedOut = function (event) {
        return eventIsPast(event) || baseCheckedOut.call(this, event);
      };
      wrappedCheckedOut.v1119PastCheckoutWrapped = true;
      window.v110IsCheckedOutEvent = wrappedCheckedOut;
    }

    const baseDisplayState = window.v110OperationDisplayState;
    if (typeof baseDisplayState === 'function' && !baseDisplayState.v1119PastCheckoutWrapped) {
      const wrappedDisplayState = function (card) {
        const end = card?.dataset?.directoryEndDate || card?.dataset?.endDate || '';
        if (isPastDate(end) || card?.dataset?.v1082PastStay === 'true') {
          return {
            code: 'checked_out',
            label: 'Checked Out',
            icon: '✅',
            meta: 'Stay completed automatically by date'
          };
        }
        return baseDisplayState.call(this, card);
      };
      wrappedDisplayState.v1119PastCheckoutWrapped = true;
      window.v110OperationDisplayState = wrappedDisplayState;
    }
  }

  function wrapDirectoryRenderer() {
    const base = window.applyGuestDirectoryResponse;
    if (typeof base !== 'function' || base.v1119PastCheckoutWrapped) return;

    const wrapped = function () {
      const result = base.apply(this, arguments);
      queueMicrotask(reconcileCareCards);
      setTimeout(reconcileCareCards, 80);
      return result;
    };

    wrapped.v1119PastCheckoutWrapped = true;
    wrapped.v1118Wrapped = base.v1118Wrapped;
    window.applyGuestDirectoryResponse = wrapped;
  }

  function wrapQueryRefreshes() {
    const base = window.queryAppsScript;
    if (typeof base !== 'function' || base.v1119PastCheckoutWrapped) return;

    const wrapped = async function () {
      const result = await base.apply(this, arguments);
      setTimeout(reconcileAll, 0);
      return result;
    };

    wrapped.v1119PastCheckoutWrapped = true;
    window.queryAppsScript = wrapped;
  }

  function wireStatusRefreshes() {
    if (window.v1119PastCheckoutWired) return;
    window.v1119PastCheckoutWired = true;

    document.addEventListener('click', event => {
      if (event.target.closest('[data-v1118-search-open], [data-v1118-search-stay], button, a')) {
        setTimeout(reconcileAll, 40);
        setTimeout(reconcileAll, 180);
      }
    }, true);

    document.addEventListener('input', event => {
      if (!event.target.matches('[data-v1118-search-input]')) return;
      setTimeout(reconcileSearchResults, 120);
    }, true);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) setTimeout(reconcileAll, 40);
    });
  }

  function init() {
    wrapOperationalStatus();
    wrapDirectoryRenderer();
    wrapQueryRefreshes();
    wireStatusRefreshes();
    reconcileAll();
    setTimeout(reconcileAll, 150);
    setTimeout(reconcileAll, 600);
    window.v1119PastStayCheckoutVersion = VERSION;
    window.v1119IsEffectiveCheckedOut = function (eventOrCard) {
      if (eventOrCard instanceof Element) return isPastCareCard(eventOrCard);
      return eventIsPast(eventOrCard);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
