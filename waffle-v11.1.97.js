/* ============================================================
   WAFFLE HOUSE V11.1.97 — FUTURE CARE DEEP-LINK ROUTING
   ------------------------------------------------------------
   The legacy V10.8.2 Care deep-link fallback assumes that any stay that is not
   present in the short-range current grid must be historical. Six-month Future
   Stays invalidates that assumption. This layer keeps genuine current/past
   behaviour intact while routing a future stayKey to Future Stays and waiting
   for the long-range Calendar-backed Care card before opening its profile.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_V11197_FUTURE_DEEPLINK) return;

  const VERSION = '11.1.97';
  const WAIT_TIMEOUT_MS = 10000;
  const POLL_MS = 180;
  const inFlight = new Map();
  const completed = new Set();
  const originalTryPastDeepLink =
    typeof window.v1082TryPastDeepLink === 'function'
      ? window.v1082TryPastDeepLink
      : null;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  }

  function todayKey() {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');
  }

  function requestedStayKey() {
    if (pageName() !== 'directory') return '';
    return String(new URLSearchParams(window.location.search).get('stayKey') || '').trim();
  }

  function stayStartDate(stayKey) {
    const text = String(stayKey || '');
    const match = text.match(/(?:^|\|)(\d{4}-\d{2}-\d{2})(?=\||$)/);
    return match ? match[1] : '';
  }

  function isFutureStayKey(stayKey) {
    const start = stayStartDate(stayKey);
    return !!start && start > todayKey();
  }

  function currentGridCard(stayKey) {
    return Array.from(document.querySelectorAll(
      '#directory-grid .directory-card[data-directory-stay-key]'
    )).find(card => String(card.dataset.directoryStayKey || '') === String(stayKey || '')) || null;
  }

  function activateFutureView() {
    try {
      if (typeof window.v1082SwitchStayView === 'function') {
        window.v1082SwitchStayView('future', { instant: true });
        return;
      }
    } catch (_) {}

    const button = document.querySelector('[data-v1082-stay-tab="future"]');
    if (button instanceof HTMLElement) button.click();
  }

  function promptFutureReconcile() {
    try {
      window.WAFFLE_V11196_FUTURE_RANGE?.maintain?.();
    } catch (_) {}
  }

  function delay(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  async function openFutureDeepLink(stayKey) {
    activateFutureView();
    promptFutureReconcile();

    const startedAt = Date.now();
    while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
      const card = currentGridCard(stayKey);
      if (card) {
        activateFutureView();
        try {
          if (typeof window.openDirectoryGuestProfile === 'function') {
            await window.openDirectoryGuestProfile(card, { instant: true });
          } else {
            card.querySelector('[data-open-directory-profile]')?.click();
          }
        } catch (error) {
          console.error('Future Care profile deep link could not open:', error);
          return false;
        }
        return true;
      }

      promptFutureReconcile();
      await delay(POLL_MS);
    }

    /* A future booking must never be reclassified as Past merely because its
       long-range card has not hydrated yet. Leave the user in Future Stays. */
    activateFutureView();
    console.warn('Future Care profile was not available before deep-link timeout:', stayKey);
    return false;
  }

  function routeFutureDeepLink(stayKey) {
    if (completed.has(stayKey)) return Promise.resolve(true);
    if (inFlight.has(stayKey)) return inFlight.get(stayKey);

    const promise = openFutureDeepLink(stayKey)
      .then(opened => {
        if (opened) completed.add(stayKey);
        return opened;
      })
      .finally(() => inFlight.delete(stayKey));

    inFlight.set(stayKey, promise);
    return promise;
  }

  async function patchedDeepLink() {
    const stayKey = requestedStayKey();
    if (!stayKey || !isFutureStayKey(stayKey)) {
      if (originalTryPastDeepLink) {
        return originalTryPastDeepLink.apply(window, arguments);
      }
      return;
    }

    return routeFutureDeepLink(stayKey);
  }

  if (originalTryPastDeepLink) {
    window.v1082TryPastDeepLink = patchedDeepLink;
  }

  /* Also start a proactive pass. This covers restored pages or unusual script
     timing where V10.8.2 may already have queued its original function ref. */
  function proactiveFutureDeepLink() {
    const stayKey = requestedStayKey();
    if (!stayKey || !isFutureStayKey(stayKey)) return;
    routeFutureDeepLink(stayKey).catch(error =>
      console.error('Future Care proactive deep link failed:', error)
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', proactiveFutureDeepLink, { once: true });
  } else {
    proactiveFutureDeepLink();
  }

  window.addEventListener('pageshow', proactiveFutureDeepLink);

  window.WAFFLE_V11197_FUTURE_DEEPLINK = Object.freeze({
    version: VERSION,
    isFutureStayKey,
    openFutureDeepLink: routeFutureDeepLink
  });
})();
