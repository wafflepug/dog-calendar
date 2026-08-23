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
    document.querySelectorAll('[data-v1115-recovery-panel]').forEach(panel => panel.remove());
  }

  function apply() {
    retireLegacyCalendarPanels();
    retireLegacyInlineRecovery();
  }

  function start() {
    apply();
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
   responsive navigation surface. V11.1.35 prevents stale assistant intent;
   V11.1.36 applies requested-date capacity decisions. V11.1.37 is loaded last
   as the canonical global Ask Waffle UI and routing layer. */
(function () {
  'use strict';

  function loadAskWaffleGlobal() {
    if (document.querySelector('script[data-waffle-v11137-assistant]')) return;

    function loadCore() {
      if (document.querySelector('script[data-waffle-v11137-assistant]')) return;
      const core = document.createElement('script');
      core.src = 'waffle-v11.1.37.js?v=11.1.37';
      core.async = false;
      core.setAttribute('data-waffle-v11137-assistant', 'js');
      document.body.appendChild(core);
    }

    const existingAssets = document.querySelector('script[data-waffle-v11137-assets]');
    if (existingAssets) {
      if (window.WAFFLE_AI_ASSETS) loadCore();
      else existingAssets.addEventListener('load', loadCore, { once: true });
      setTimeout(loadCore, 350);
      return;
    }

    const assets = document.createElement('script');
    assets.src = 'waffle-v11.1.37-assets.js?v=11.1.37';
    assets.async = false;
    assets.setAttribute('data-waffle-v11137-assets', 'js');
    assets.addEventListener('load', loadCore, { once: true });
    assets.addEventListener('error', loadCore, { once: true });
    document.body.appendChild(assets);
  }

  function loadAskWaffleRangeDecision() {
    const existing = document.querySelector('script[data-waffle-v11136-assistant]');
    if (existing) {
      existing.addEventListener('load', () => setTimeout(loadAskWaffleGlobal, 40), { once: true });
      setTimeout(loadAskWaffleGlobal, 180);
      return;
    }

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.36.js?v=11.1.36';
    script.async = false;
    script.setAttribute('data-waffle-v11136-assistant', 'js');
    script.addEventListener('load', () => setTimeout(loadAskWaffleGlobal, 40), { once: true });
    script.addEventListener('error', loadAskWaffleGlobal, { once: true });
    document.body.appendChild(script);
  }

  function loadAskWaffleFreshIntent() {
    const existing = document.querySelector('script[data-waffle-v11135-assistant]');
    if (existing) {
      existing.addEventListener('load', () => setTimeout(loadAskWaffleRangeDecision, 60), { once: true });
      setTimeout(loadAskWaffleRangeDecision, 220);
      return;
    }

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.35.js?v=11.1.35';
    script.async = false;
    script.setAttribute('data-waffle-v11135-assistant', 'js');
    script.addEventListener('load', () => setTimeout(loadAskWaffleRangeDecision, 60), { once: true });
    script.addEventListener('error', loadAskWaffleRangeDecision, { once: true });
    document.body.appendChild(script);
  }

  function loadV11122NavigationCleanup() {
    if (!document.querySelector('link[data-waffle-v11122-cleanup]')) {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'waffle-v11.1.22.css?v=11.1.38';
      stylesheet.setAttribute('data-waffle-v11122-cleanup', 'css');
      document.head.appendChild(stylesheet);
    }

    const existing = document.querySelector('script[data-waffle-v11122-cleanup]');
    if (existing) {
      existing.addEventListener('load', () => setTimeout(loadAskWaffleFreshIntent, 180), { once: true });
      setTimeout(loadAskWaffleFreshIntent, 700);
      setTimeout(loadAskWaffleGlobal, 1200);
      return;
    }

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.22.js?v=11.1.38';
    script.async = false;
    script.setAttribute('data-waffle-v11122-cleanup', 'js');
    script.addEventListener('load', () => setTimeout(loadAskWaffleFreshIntent, 180), { once: true });
    script.addEventListener('error', loadAskWaffleFreshIntent, { once: true });
    document.body.appendChild(script);

    setTimeout(loadAskWaffleFreshIntent, 900);
    setTimeout(loadAskWaffleGlobal, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadV11122NavigationCleanup, { once: true });
  } else {
    loadV11122NavigationCleanup();
  }
})();

/* V11.1.38 enhances the already-global Waffle assistant with Dog Profile care
   intelligence. It waits for V11.1.37 so the existing Calendar routing remains
   authoritative for bookings, capacity, movements and Meet & Greets. */
(function () {
  'use strict';

  let attempts = 0;

  function loadWaffleAiProfiles() {
    if (document.querySelector('script[data-waffle-v11138-assistant]')) return;

    if (!window.v11137AskWaffleVersion && attempts < 40) {
      attempts += 1;
      setTimeout(loadWaffleAiProfiles, 120);
      return;
    }

    const script = document.createElement('script');
    script.src = 'waffle-v11.1.38.js?v=11.1.38';
    script.async = false;
    script.setAttribute('data-waffle-v11138-assistant', 'js');
    document.body.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(loadWaffleAiProfiles, 250), { once: true });
  } else {
    setTimeout(loadWaffleAiProfiles, 250);
  }

  window.addEventListener('pageshow', loadWaffleAiProfiles);
})();
