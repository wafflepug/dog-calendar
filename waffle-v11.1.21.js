/* ============================================================
   WAFFLE HOUSE V11.1.21 — LEGACY CLEANUP PHASE 1
   ============================================================
   Retires user-facing UI that has already been superseded while preserving
   temporary compatibility sinks for older base renderers that still write to
   the historical element IDs. The sinks are intentionally non-rendering and
   can be deleted when waffle-app.js is consolidated in the next cleanup phase.
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.21';

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function ensureCompatibilitySink() {
    let sink = document.getElementById('v11121LegacyCompatibilitySinks');
    if (sink) return sink;

    sink = document.createElement('div');
    sink.id = 'v11121LegacyCompatibilitySinks';
    sink.hidden = true;
    sink.setAttribute('aria-hidden', 'true');
    sink.style.setProperty('display', 'none', 'important');
    document.body.appendChild(sink);
    return sink;
  }

  function moveToSink(id, sink) {
    const node = document.getElementById(id);
    if (!node || node === sink || sink.contains(node)) return;
    sink.appendChild(node);
  }

  function retireLegacyCalendarPanels() {
    if (pageName() !== 'calendar') return;

    const sink = ensureCompatibilitySink();

    // waffle-app.js still writes to these historical IDs during spreadsheet
    // refreshes. Keep only the data targets, not their retired visual panels.
    [
      'at-home-list',
      'leaving-list',
      'upcoming-list',
      'full-dates-list',
      'today-meet-greet-list',
      'meet-greet-today-date'
    ].forEach(id => moveToSink(id, sink));

    document.querySelectorAll(
      '#calendarTabPanel > .summary-dashboard, ' +
      '#calendarTabPanel > .meet-greet-dashboard, ' +
      '[data-mobile-dashboard-section="summary"], ' +
      '[data-mobile-dashboard-section="meet"]'
    ).forEach(panel => {
      if (panel !== sink && !sink.contains(panel)) panel.remove();
    });
  }

  function retireLegacyInlineRecovery() {
    if (pageName() !== 'audit') return;

    // Recovery is now owned by #v11113RecoveryButton / #v11113RecoveryModal.
    // Delete the older inline V11.1.5 panel if its historical renderer inserts
    // one during startup.
    document.querySelectorAll('[data-v1115-recovery-panel]').forEach(panel => panel.remove());
  }

  function apply() {
    retireLegacyCalendarPanels();
    retireLegacyInlineRecovery();
  }

  function start() {
    apply();

    // Bounded passes cover older startup renderers without introducing another
    // persistent observer or polling loop.
    [80, 250, 700, 1200, 1800, 2800].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.v11121CleanupVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

/* Phase 2 is intentionally loaded after the Phase 1 compatibility cleanup so
   the original page navigation is available before it becomes the canonical
   responsive navigation surface. V11.1.35 is loaded independently as a final
   Ask Waffle routing hotfix so explicit questions cannot inherit a stale
   capacity clarification context. */
(function () {
  'use strict';

  function loadAskWaffleFreshIntent() {
    if (document.querySelector('script[data-waffle-v11135-assistant]')) return;

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.35.js?v=11.1.35';
    script.async = false;
    script.setAttribute('data-waffle-v11135-assistant', 'js');
    document.body.appendChild(script);
  }

  function loadV11122NavigationCleanup() {
    if (!document.querySelector('link[data-waffle-v11122-cleanup]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'waffle-v11.1.22.css?v=11.1.35';
      stylesheet.setAttribute('data-waffle-v11122-cleanup', 'css');
      document.head.appendChild(stylesheet);
    }

    const existing = document.querySelector('script[data-waffle-v11122-cleanup]');
    if (existing) {
      existing.addEventListener('load', () => setTimeout(loadAskWaffleFreshIntent, 180), { once: true });
      setTimeout(loadAskWaffleFreshIntent, 700);
      return;
    }

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.22.js?v=11.1.35';
    script.async = false;
    script.setAttribute('data-waffle-v11122-cleanup', 'js');
    script.addEventListener('load', () => setTimeout(loadAskWaffleFreshIntent, 180), { once: true });
    script.addEventListener('error', loadAskWaffleFreshIntent, { once: true });
    document.body.appendChild(script);

    // Defensive delayed load covers the older nested loader chain without
    // relying on any single child script's timing.
    setTimeout(loadAskWaffleFreshIntent, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadV11122NavigationCleanup, { once: true });
  } else {
    loadV11122NavigationCleanup();
  }
})();
