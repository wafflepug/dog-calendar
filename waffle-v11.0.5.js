/* ============================================================
   WAFFLE HOUSE V11.1.43 — COMPATIBILITY + LEGACY RETIREMENT
   Keeps V11.0.5 synchronous, ensures the current Ask Waffle stack is present
   on Calendar and Care, and removes retired user-facing DOM before hydration.
   ============================================================ */
(function () {
  'use strict';

  // Preserve the original V11.0.5 execution order. This loader itself is
  // parser-inserted at the old V11.0.5 script position.
  if (document.readyState === 'loading') {
    document.write('<script src="waffle-v11.0.5-core.js?v=11.1.40"></script>');
  } else {
    const core = document.createElement('script');
    core.src = 'waffle-v11.0.5-core.js?v=11.1.40';
    core.async = false;
    document.head.appendChild(core);
  }

  const TARGET_PAGES = new Set(['calendar', 'directory']);

  function pageName() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      'calendar'
    );
  }

  function loadScript(src, ready) {
    if (ready()) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(script =>
        String(script.src || '').includes('/' + src)
      );

      if (existing) {
        if (ready()) {
          resolve();
          return;
        }
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src + '?v=11.1.40';
      script.async = false;
      script.dataset.waffleV11140 = 'true';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error('Could not load ' + src)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureAskWaffle() {
    if (!TARGET_PAGES.has(pageName())) return;

    try {
      await loadScript(
        'waffle-v11.1.37-assets.js',
        () => !!(window.WAFFLE_AI_ASSETS && window.WAFFLE_AI_ASSETS.icon)
      );

      await loadScript(
        'waffle-v11.1.37.js',
        () => !!window.v11137AskWaffleVersion
      );

      await loadScript(
        'waffle-v11.1.38.js',
        () => !!window.v11138WaffleAiVersion
      );

      await loadScript(
        'waffle-v11.1.39.js',
        () => !!window.v11139AskWaffleLayoutVersion
      );

      await loadScript(
        'waffle-v11.1.40.js',
        () => !!window.v11140AskWaffleLayoutVersion
      );
    } catch (error) {
      console.warn('Ask Waffle launcher setup failed:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureAskWaffle, { once: true });
  } else {
    ensureAskWaffle();
  }
})();

/* ============================================================
   V11.1.43 — EARLY LEGACY DOM RETIREMENT
   ============================================================
   Older Waffle layers still write to several historical IDs. Removing those
   IDs outright can break data refreshes, so they are retained in a hidden
   compatibility sink while the retired visual wrappers are physically removed.

   Sticky Notes are intentionally excluded: Organiser V11.1.15 still reuses
   that content as its active Sticky Notes tab.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.43';

  function pageName() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      'calendar'
    );
  }

  function compatibilitySink() {
    let sink = document.getElementById('v11143LegacyCompatibilitySinks');
    if (sink) return sink;

    sink = document.createElement('div');
    sink.id = 'v11143LegacyCompatibilitySinks';
    sink.hidden = true;
    sink.setAttribute('aria-hidden', 'true');
    sink.style.setProperty('display', 'none', 'important');
    sink.style.setProperty('visibility', 'hidden', 'important');
    sink.style.setProperty('pointer-events', 'none', 'important');
    document.body.appendChild(sink);
    return sink;
  }

  function moveIdToSink(id, sink) {
    const node = document.getElementById(id);
    if (!node || node === sink || sink.contains(node)) return;
    sink.appendChild(node);
  }

  function canonicaliseNavigation() {
    document.querySelectorAll(
      'a[href$="reminders.html"] .nav-label, [data-page-link="reminders"] .nav-label'
    ).forEach(label => {
      label.textContent = 'Organiser';
    });

    document.querySelectorAll('a[href$="reminders.html"], [data-page-link="reminders"]')
      .forEach(link => {
        const aria = String(link.getAttribute('aria-label') || '');
        const title = String(link.getAttribute('title') || '');
        if (/reminder/i.test(aria)) {
          link.setAttribute('aria-label', aria.replace(/reminders?/ig, 'Organiser'));
        }
        if (/reminder/i.test(title)) {
          link.setAttribute('title', title.replace(/reminders?/ig, 'Organiser'));
        }
      });
  }

  function removeDuplicateBrandCopy() {
    document.querySelectorAll('.calendar-header-branding .calendar-brand-copy')
      .forEach(node => node.remove());
  }

  function retireCalendarLegacy() {
    if (pageName() !== 'calendar') return;

    const sink = compatibilitySink();

    [
      'at-home-list',
      'leaving-list',
      'upcoming-list',
      'full-dates-list',
      'today-meet-greet-list',
      'meet-greet-today-date'
    ].forEach(id => moveIdToSink(id, sink));

    document.querySelectorAll(
      '#calendarTabPanel > .summary-dashboard, ' +
      '#calendarTabPanel > .meet-greet-dashboard, ' +
      '[data-mobile-dashboard-section="summary"], ' +
      '[data-mobile-dashboard-section="meet"]'
    ).forEach(panel => {
      if (panel !== sink && !sink.contains(panel)) panel.remove();
    });
  }

  function retireCareLegacy() {
    if (pageName() !== 'directory') return;

    const sink = compatibilitySink();

    // The original button ID is retained invisibly because the base directory
    // layer still wires a click handler to it during startup.
    moveIdToSink('openLegacyIntakeUploadBtn', sink);

    document.querySelectorAll('[data-upload-legacy-intake], [data-reassign-legacy-intake]')
      .forEach(node => {
        if (!sink.contains(node)) sink.appendChild(node);
      });
  }

  function retireAuditLegacy() {
    if (pageName() !== 'audit') return;

    document.querySelectorAll('[data-v1115-recovery-panel]')
      .forEach(panel => panel.remove());
  }

  function retireGeneratedMobileNavigation() {
    document.querySelectorAll('#v1118MobileNav, nav.v1118-mobile-nav')
      .forEach(nav => {
        if (!nav.classList.contains('app-tabs')) nav.remove();
      });
  }

  function apply() {
    if (!document.body) return;

    canonicaliseNavigation();
    removeDuplicateBrandCopy();
    retireCalendarLegacy();
    retireCareLegacy();
    retireAuditLegacy();
    retireGeneratedMobileNavigation();
  }

  // This script is parser-inserted at the end of every app page, so the first
  // pass runs before DOMContentLoaded and before the later enhancement passes.
  apply();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  }

  [80, 250, 700, 1400, 2600].forEach(delay => setTimeout(apply, delay));
  window.addEventListener('pageshow', apply);
  window.addEventListener('focus', apply);

  window.v11143LegacyRetirementVersion = VERSION;
})();
