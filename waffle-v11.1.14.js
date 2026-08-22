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

/* V11.1.15 organiser planner + later frontend patch loader. Kept here so the
 * recovery service worker and the main Firebase loader do not need another
 * cache-sensitive change. */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function loadV11117Assets() {
    if (!document.querySelector('link[data-waffle-v11117]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'waffle-v11.1.17.css?v=11.1.17.2';
      stylesheet.setAttribute('data-waffle-v11117', 'css');
      document.head.appendChild(stylesheet);
    }

    if (!document.querySelector('script[data-waffle-v11117]')) {
      const script = document.createElement('script');
      script.src = 'waffle-v11.1.17.js?v=11.1.17.3';
      script.async = false;
      script.setAttribute('data-waffle-v11117', 'js');
      document.body.appendChild(script);
    }
  }

  function loadV11116Assets() {
    if (!document.querySelector('link[data-waffle-v11116]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'waffle-v11.1.16.css?v=11.1.16';
      stylesheet.setAttribute('data-waffle-v11116', 'css');
      document.head.appendChild(stylesheet);
    }

    const existing = document.querySelector('script[data-waffle-v11116]');
    if (existing) {
      existing.addEventListener('load', loadV11117Assets, { once: true });
      setTimeout(loadV11117Assets, 350);
      return;
    }

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.16.js?v=11.1.16.1';
    script.async = false;
    script.setAttribute('data-waffle-v11116', 'js');
    script.addEventListener('load', loadV11117Assets, { once: true });
    document.body.appendChild(script);
  }

  function loadOrganiserAssets() {
    if (!document.querySelector('link[data-waffle-v11115]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'waffle-v11.1.15.css?v=11.1.15';
      stylesheet.setAttribute('data-waffle-v11115', 'css');
      document.head.appendChild(stylesheet);
    }

    const existing = document.querySelector('script[data-waffle-v11115]');
    if (existing) {
      existing.addEventListener('load', loadV11116Assets, { once: true });
      setTimeout(loadV11116Assets, 500);
      return;
    }

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.15.js?v=11.1.15';
    script.async = false;
    script.setAttribute('data-waffle-v11115', 'js');
    script.addEventListener('load', loadV11116Assets, { once: true });
    document.body.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadOrganiserAssets, { once: true });
  } else {
    loadOrganiserAssets();
  }
})();
