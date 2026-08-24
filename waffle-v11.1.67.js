/* ============================================================
   WAFFLE HOUSE V11.1.67 — REMOVE CALENDAR CAPACITY COUNTS
   ============================================================
   The single V11.1.65 Calendar remains authoritative.
   Date headers show the date only; numeric activity/capacity pills are retired.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.67';
  let observer = null;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function ensureStyle() {
    if (document.getElementById('v11167NoCapacityCountStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11167NoCapacityCountStyle';
    style.textContent = `
      body[data-waffle-page="calendar"] #wh65Calendar .wh65-count {
        display:none !important;
      }
      body[data-waffle-page="calendar"] #wh65Calendar .wh65-date {
        justify-content:flex-start !important;
      }
    `;
    document.head.appendChild(style);
  }

  function removeCounts() {
    if (!isCalendarPage()) return;
    ensureStyle();
    document.querySelectorAll('#wh65Calendar .wh65-count').forEach(node => node.remove());
  }

  function observe() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation =>
        Array.from(mutation.addedNodes || []).some(node => {
          if (!(node instanceof Element)) return false;
          return node.classList?.contains('wh65-count') ||
            node.id === 'wh65Calendar' ||
            !!node.querySelector?.('.wh65-count');
        })
      );
      if (relevant) removeCounts();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function start() {
    if (!isCalendarPage()) return;
    ensureStyle();
    removeCounts();
    observe();
    [100, 300, 700, 1400, 2600, 5000].forEach(delay => setTimeout(removeCounts, delay));
    window.addEventListener('pageshow', removeCounts);
    window.v11167NoCapacityCountVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
