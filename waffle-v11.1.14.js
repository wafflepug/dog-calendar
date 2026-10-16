/* ============================================================
   WAFFLE HOUSE V11.1.14 — NOTIFICATION ATTENTION CONSOLIDATION
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

  function installNotificationRenderFilter() {
    const base = window.renderWaffleNotificationCentre;
    if (typeof base !== 'function' || base.v11114AttentionFiltered) return;

    const wrapped = function () {
      let originalItems = null;
      let filtered = false;

      try {
        if (
          typeof waffleNotificationCentreItems !== 'undefined' &&
          Array.isArray(waffleNotificationCentreItems)
        ) {
          originalItems = waffleNotificationCentreItems;
          waffleNotificationCentreItems = originalItems.filter(item =>
            item && item.kind !== 'attention'
          );
          filtered = true;
        }
      } catch (_) {}

      try {
        return base.apply(this, arguments);
      } finally {
        if (filtered) {
          try { waffleNotificationCentreItems = originalItems; } catch (_) {}
        }
      }
    };

    copyFunctionFlags(base, wrapped);
    wrapped.v11114AttentionFiltered = true;
    window.renderWaffleNotificationCentre = wrapped;
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

  function install() {
    // Today's Priority (#v1118AttentionPanel) remains the single canonical
    // attention surface inside Notifications. Legacy kind=attention items are
    // filtered before the old notification renderer can create a second block.
    installUnreadFilter();
    installNotificationRenderFilter();
    refreshNotificationCounts();
  }

  function start() {
    install();
    [80, 250, 700, 1400].forEach(delay => setTimeout(install, delay));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
