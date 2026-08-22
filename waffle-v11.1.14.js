/* ============================================================
   WAFFLE HOUSE V11.1.14 — REMOVE LEGACY NEEDS ATTENTION GROUP
   ============================================================ */

(function () {
  'use strict';

  function copyFunctionFlags(source, target) {
    try {
      Object.keys(source || {}).forEach(key => {
        try { target[key] = source[key]; } catch (_) {}
      });
    } catch (_) {}
  }

  function removeLegacyNeedsAttentionGroup() {
    const feed = document.querySelector('[data-notification-feed]');
    if (!feed) return;

    feed.querySelectorAll('.v101-notification-section').forEach(section => {
      const heading = section.querySelector('.v101-notification-section-heading strong');
      if (String(heading?.textContent || '').trim().toLowerCase() === 'needs attention') {
        section.remove();
      }
    });
  }

  function filteredUnreadCount(fallback) {
    try {
      if (
        typeof waffleNotificationCentreItems !== 'undefined' &&
        Array.isArray(waffleNotificationCentreItems) &&
        typeof window.getWaffleSeenNotificationIds === 'function'
      ) {
        const seen = window.getWaffleSeenNotificationIds();
        return waffleNotificationCentreItems.filter(item =>
          item &&
          item.kind !== 'attention' &&
          item.id &&
          !seen.has(item.id)
        ).length;
      }
    } catch (_) {}

    return typeof fallback === 'function' ? fallback() : 0;
  }

  function installUnreadFilter() {
    const base = window.getWaffleNotificationUnreadCount;
    if (typeof base !== 'function' || base.v11114AttentionFiltered) return;

    const wrapped = function () {
      return filteredUnreadCount(() => base.apply(this, arguments));
    };

    copyFunctionFlags(base, wrapped);
    wrapped.v11114AttentionFiltered = true;
    window.getWaffleNotificationUnreadCount = wrapped;
  }

  function refreshNotificationCounts() {
    try {
      const unread = typeof window.getWaffleNotificationUnreadCount === 'function'
        ? window.getWaffleNotificationUnreadCount()
        : 0;

      const count = document.querySelector('[data-notification-centre-count]');
      if (count) {
        count.textContent = unread ? `${unread} unread` : 'Up to date';
        count.dataset.mode = unread ? 'unread' : 'clear';
      }

      if (typeof window.updateWaffleNotificationUnreadBadge === 'function') {
        window.updateWaffleNotificationUnreadBadge();
      }
    } catch (_) {}
  }

  function cleanNotificationFeed() {
    removeLegacyNeedsAttentionGroup();
    refreshNotificationCounts();
  }

  function wrapAndClean(name, marker) {
    const base = window[name];
    if (typeof base !== 'function' || base[marker]) return;

    const wrapped = function () {
      const result = base.apply(this, arguments);
      [0, 25, 80, 180].forEach(delay => setTimeout(cleanNotificationFeed, delay));
      return result;
    };

    copyFunctionFlags(base, wrapped);
    wrapped[marker] = true;
    window[name] = wrapped;
  }

  function start() {
    // Keep V11.1.13 Today's Priority (#v1118AttentionPanel) in Notifications.
    // Remove only the older notification-centre group made from kind=attention
    // items, which is separately headed "Needs attention".
    installUnreadFilter();
    wrapAndClean('renderWaffleNotificationCentre', 'v11114LegacyAttentionRemoved');
    wrapAndClean('openWaffleNotificationCentre', 'v11114LegacyAttentionRemoved');

    [0, 80, 250, 700, 1400].forEach(delay => setTimeout(cleanNotificationFeed, delay));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
