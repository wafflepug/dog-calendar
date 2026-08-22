/* ============================================================
   WAFFLE HOUSE V11.1.14 — REMOVE PRIORITY FROM NOTIFICATIONS
   ============================================================ */

(function () {
  'use strict';

  function removePriorityPanel() {
    const panel = document.getElementById('v1118AttentionPanel');
    if (panel) panel.remove();
  }

  function copyFunctionFlags(source, target) {
    try {
      Object.keys(source || {}).forEach(key => {
        try { target[key] = source[key]; } catch (_) {}
      });
    } catch (_) {}
  }

  function wrapAndSuppress(name, marker) {
    const base = window[name];
    if (typeof base !== 'function' || base[marker]) return;

    const wrapped = function () {
      const result = base.apply(this, arguments);
      [0, 25, 80, 180, 320].forEach(delay => setTimeout(removePriorityPanel, delay));
      return result;
    };

    copyFunctionFlags(base, wrapped);
    wrapped[marker] = true;
    window[name] = wrapped;
  }

  function start() {
    // V11.1.13 previously moved Today's Priority into Notifications.
    // V11.1.14 removes that block entirely while leaving the normal
    // notification feed and notification settings untouched.
    removePriorityPanel();
    wrapAndSuppress('renderV10OperationsHome', 'v11114PriorityRemoved');
    wrapAndSuppress('openWaffleNotificationCentre', 'v11114PriorityRemoved');

    // Bounded follow-up passes cover late initialisation without introducing
    // another persistent MutationObserver.
    [80, 250, 700, 1400].forEach(delay => setTimeout(removePriorityPanel, delay));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
