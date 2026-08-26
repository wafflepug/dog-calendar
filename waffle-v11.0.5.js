/* ============================================================
   WAFFLE HOUSE V11.1.91 — MAINTENANCE GATE
   ------------------------------------------------------------
   Checks the authoritative Apps Script maintenance switch before the
   shared UI hydrates. While status is pending, interaction is blocked.
   If maintenance is enabled — or the safety status cannot be confirmed
   within the timeout — users are sent to maintenance.html.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_MAINTENANCE_GATE) return;

  const VERSION = '11.1.91';
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbwn4HL49K9c3AZbXJRUjPw3UYWxJt8DmqXwMnTytyqdSstj3ZIJwWdDEC2IsBjetOf3pw/exec';
  const maintenanceUrl = new URL('maintenance.html', window.location.href);

  if (/\/maintenance\.html$/i.test(window.location.pathname)) return;

  const style = document.createElement('style');
  style.id = 'waffleMaintenanceGateStyle';
  style.textContent = 'html[data-waffle-maintenance-check="pending"] body{pointer-events:none!important;user-select:none!important;}';
  (document.head || document.documentElement).appendChild(style);
  document.documentElement.setAttribute('data-waffle-maintenance-check', 'pending');

  let settled = false;
  let timer = 0;
  const callbackName = '__waffleMaintenanceGate' + Date.now() + Math.floor(Math.random() * 10000);
  const script = document.createElement('script');

  function clean() {
    if (timer) clearTimeout(timer);
    try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
    script.remove();
  }

  function unlock() {
    if (settled) return;
    settled = true;
    clean();
    document.documentElement.removeAttribute('data-waffle-maintenance-check');
    style.remove();
    window.dispatchEvent(new CustomEvent('waffle:maintenance-clear'));
  }

  function redirect(reason) {
    if (settled) return;
    settled = true;
    clean();
    const from = window.location.pathname + window.location.search + window.location.hash;
    maintenanceUrl.searchParams.set('from', from);
    if (reason) maintenanceUrl.searchParams.set('reason', reason);
    window.location.replace(maintenanceUrl.href);
  }

  window[callbackName] = status => {
    if (status && status.enabled === true) {
      redirect('maintenance');
      return;
    }
    if (status && status.result === 'success') {
      unlock();
      return;
    }
    redirect('status-unconfirmed');
  };

  script.onerror = () => redirect('status-unavailable');
  script.src = ENDPOINT + '?action=maintenance_status&callback=' + encodeURIComponent(callbackName) + '&_=' + Date.now();
  (document.head || document.documentElement).appendChild(script);
  timer = setTimeout(() => redirect('status-timeout'), 6500);

  window.WAFFLE_MAINTENANCE_GATE = Object.freeze({
    version: VERSION,
    endpoint: ENDPOINT
  });
})();

/* ============================================================
   WAFFLE HOUSE V11.1.76 — COMPATIBILITY + SITTER MOBILE SHELL
   Keeps V11.0.5 synchronous, loads the independent-sitter mobile shell and
   authoritative mobile-footer recovery layer, clean Calendar and rebuilt Care
   UI as independent first-class components, ensures the current Ask Waffle
   stack is present, removes retired UI before hydration, and loads the
   permanent Final UI Contract last.
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

  const FLOATING_PARITY_PAGES = new Set(['calendar', 'directory']);

  function pageName() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      'calendar'
    );
  }

  function loadScript(src, ready, version = '11.1.61') {
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
      script.src = src + '?v=' + version;
      script.async = false;
      script.dataset.waffleV11161 = 'true';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error('Could not load ' + src)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureAskWaffle() {
    /* Ask Waffle is a cross-app assistant on Calendar, Care, Organiser and Logs. */
    await loadScript(
      'waffle-v11.1.37-assets.js',
      () => !!(window.WAFFLE_AI_ASSETS && window.WAFFLE_AI_ASSETS.icon),
      '11.1.47'
    );

    /* Load unified chrome + retired-modal cleanup before the historical launcher
       creator. Its CSS/observer are ready the instant legacy DOM is inserted. */
    await loadScript(
      'waffle-v11.1.53.js',
      () => !!window.v11153UnifiedActionChromeVersion,
      '11.1.53'
    );

    await loadScript(
      'waffle-v11.1.37.js',
      () => !!window.v11137AskWaffleVersion,
      '11.1.47'
    );

    await loadScript(
      'waffle-v11.1.38.js',
      () => !!window.v11138WaffleAiVersion,
      '11.1.47'
    );

    /* Historical Calendar/Care layers remain for compatibility. V11.1.53 is
       the shared authority for action chrome/modal retirement on all pages. */
    if (FLOATING_PARITY_PAGES.has(pageName())) {
      await loadScript(
        'waffle-v11.1.39.js',
        () => !!window.v11139AskWaffleLayoutVersion,
        '11.1.47'
      );

      await loadScript(
        'waffle-v11.1.40.js',
        () => !!window.v11140AskWaffleLayoutVersion,
        '11.1.47'
      );
    }

    if (pageName() === 'calendar') {
      await loadScript(
        'waffle-v11.1.45.js',
        () => !!window.v11145CalendarStabilityVersion,
        '11.1.47'
      );
    }

    await loadScript(
      'waffle-v11.1.47.js',
      () => !!window.v11147WaffleAiVersion,
      '11.1.47'
    );

    /* V11.1.48 owns submit routing, backend diagnostics, provider failover UX
       and the Thinking icon. */
    await loadScript(
      'waffle-v11.1.48.js',
      () => !!window.v11148WaffleAiVersion,
      '11.1.48'
    );

    /* V11.1.58 progressively adds browser speech recognition. Unsupported
       browsers simply keep the established text-only composer. */
    await loadScript(
      'waffle-v11.1.58.js',
      () => !!window.v11158WaffleSpeechVersion,
      '11.1.58'
    );
  }

  async function ensureCleanCalendar() {
    if (pageName() !== 'calendar') return;
    await loadScript(
      'waffle-v11.1.61.js',
      () => !!window.v11161CleanCalendarVersion,
      '11.1.61'
    );
  }

  async function ensureDesktopCareRebuild() {
    if (pageName() !== 'directory') return;
    await loadScript(
      'waffle-v11.1.60.js',
      () => !!window.v11160DesktopCareRebuildVersion,
      '11.1.60'
    );
  }

  async function ensureMobileSitterShell() {
    await loadScript(
      'waffle-v11.1.75.js',
      () => !!window.v11175MobileSitterShellVersion,
      '11.1.75'
    );

    /* V11.1.76 is the final mobile-footer authority. It suppresses late legacy
       .app-tabs/V11.1.8 footers and restores the V11.1.75 bottom bar if an old
       enhancement pass removes it after the drawer has already mounted. */
    await loadScript(
      'waffle-v11.1.76.js',
      () => !!window.v11176AuthoritativeMobileFooterVersion,
      '11.1.76'
    );
  }

  async function startFinalUi() {
    /* The sitter shell is shared app chrome and must not depend on Calendar,
       Care or AI startup. */
    try {
      await ensureMobileSitterShell();
    } catch (error) {
      console.warn('Mobile sitter shell could not load:', error);
    }

    /* Calendar and Care must not depend on AI startup. */
    try {
      await ensureCleanCalendar();
    } catch (error) {
      console.warn('Clean Calendar could not load:', error);
    }

    try {
      await ensureDesktopCareRebuild();
    } catch (error) {
      console.warn('Desktop Care rebuild could not load:', error);
    }

    try {
      await ensureAskWaffle();
    } catch (error) {
      console.warn('Waffle AI feature setup failed:', error);
    }

    try {
      await loadScript(
        'waffle-ui-contract.js',
        () => !!window.WAFFLE_UI_CONTRACT,
        '11.1.51'
      );
    } catch (error) {
      console.warn('Waffle Final UI Contract could not load:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startFinalUi, { once: true });
  } else {
    startFinalUi();
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

/* V11.1.89 — shared mobile Quick Action completion + Organiser reminder routing. */
(function () {
  'use strict';

  function loadQuickActionCompletion() {
    if (window.v11189MobileQuickActionCompletionVersion) return;
    const existing = Array.from(document.scripts).find(script =>
      String(script.src || '').includes('/waffle-v11.1.89.js')
    );
    if (existing) return;
    const script = document.createElement('script');
    script.src = 'waffle-v11.1.89.js?v=11.1.89';
    script.async = false;
    script.dataset.waffleV11189 = 'true';
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadQuickActionCompletion, { once:true });
  } else {
    loadQuickActionCompletion();
  }
})();

/* ============================================================
   V11.1.90 — CANONICAL CARE PDF OCR ACTION
   ------------------------------------------------------------
   The historical PDF uploader remains hidden compatibility plumbing. This
   layer exposes one clean Care action for typed, scanned and handwritten intake
   forms and delegates to the established Apps Script/Gemini review workflow.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.90';
  let observer = null;
  let frame = 0;

  function isCarePage() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      ''
    ) === 'directory';
  }

  function ensureStyle() {
    if (document.getElementById('wh90CarePdfOcrStyle')) return;
    const style = document.createElement('style');
    style.id = 'wh90CarePdfOcrStyle';
    style.textContent = `
      body[data-waffle-page="directory"] #v11123LegacyIntakeHistoryNote {
        display:none!important;
        visibility:hidden!important;
        pointer-events:none!important;
      }
      body[data-waffle-page="directory"] #v11190ScanIntakePdfBtn {
        min-height:40px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:9px 13px;
        border:1px solid color-mix(in srgb,var(--wh75-accent,#7c3aed) 48%,#cbd5e1);
        border-radius:10px;
        background:color-mix(in srgb,var(--wh75-accent,#7c3aed) 12%,#fff);
        color:color-mix(in srgb,var(--wh75-accent-strong,#6d28d9) 88%,#172033);
        box-shadow:0 2px 8px rgba(15,23,42,.06);
        font:inherit;
        font-size:11px;
        font-weight:900;
        line-height:1.2;
        cursor:pointer;
        white-space:nowrap;
      }
      body.dark-theme[data-waffle-page="directory"] #v11190ScanIntakePdfBtn {
        background:color-mix(in srgb,var(--wh75-accent,#c084fc) 16%,#17243a);
        color:var(--wh75-accent-ink,#f3e8ff);
        border-color:color-mix(in srgb,var(--wh75-accent,#c084fc) 46%,#334155);
      }
      body[data-waffle-page="directory"] #v11190ScanIntakePdfBtn:hover {
        border-color:var(--wh75-accent,#7c3aed);
        box-shadow:0 0 0 3px var(--wh75-ring,rgba(124,58,237,.16));
      }
      body[data-waffle-page="directory"] #v11190ScanIntakePdfBtn:focus-visible {
        outline:3px solid var(--wh75-ring,rgba(124,58,237,.22));
        outline-offset:2px;
      }
      body[data-waffle-page="directory"] #v11190PdfOcrReviewNote {
        display:inline-flex;
        align-items:center;
        min-height:30px;
        padding:5px 9px;
        border-radius:999px;
        background:color-mix(in srgb,var(--wh75-accent,#7c3aed) 8%,transparent);
        color:inherit;
        opacity:.72;
        font-size:9px;
        font-weight:800;
        white-space:nowrap;
      }
      @media(max-width:700px) {
        body[data-waffle-page="directory"] #v11190ScanIntakePdfBtn {
          min-height:44px;
          padding:10px 12px;
          font-size:11px;
        }
        body[data-waffle-page="directory"] #v11190PdfOcrReviewNote {
          white-space:normal;
          line-height:1.35;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function activeStayKey() {
    const card = document.querySelector('.directory-card.is-profile-active');
    if (!card) return '';
    return String(
      card.dataset?.directoryStayKey ||
      card.dataset?.stayKey ||
      ''
    ).trim();
  }

  function launchPdfOcr() {
    const stayKey = activeStayKey();

    if (typeof window.openLegacyIntakeUploader === 'function') {
      window.openLegacyIntakeUploader(stayKey);
      return;
    }

    /* The original control is deliberately kept in a hidden compatibility sink
       because waffle-app.js already owns its launch listener. Use it only as a
       fallback; it never becomes visible again. */
    const compatibilityButton = document.getElementById('openLegacyIntakeUploadBtn');
    if (compatibilityButton instanceof HTMLElement) {
      compatibilityButton.click();
      return;
    }

    window.alert(
      'The PDF OCR uploader is not ready yet. Refresh Care and try again.'
    );
  }

  function ensureControl() {
    if (!isCarePage() || !document.body) return;
    ensureStyle();

    const actions = document.querySelector('.directory-header-actions');
    if (!actions) return;

    let button = document.getElementById('v11190ScanIntakePdfBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'v11190ScanIntakePdfBtn';
      button.type = 'button';
      button.innerHTML = '<span aria-hidden="true">📄</span><span>Scan Intake PDF</span>';
      button.setAttribute(
        'aria-label',
        'Scan Intake PDF — read typed, scanned or handwritten intake forms and review values before profile updates'
      );
      button.title = 'Upload a typed, scanned or handwritten PDF. Waffle reads it with Gemini and lets you review profile values before conflicts are replaced.';
      button.addEventListener('click', launchPdfOcr);

      const refresh = actions.querySelector('#refreshGuestDirectoryBtn');
      actions.insertBefore(button, refresh || actions.firstChild || null);
    }

    let note = document.getElementById('v11190PdfOcrReviewNote');
    if (!note) {
      note = document.createElement('span');
      note.id = 'v11190PdfOcrReviewNote';
      note.textContent = 'Handwritten PDF OCR · review before profile update';
      note.title = 'Waffle saves the original PDF, reads handwriting/tick boxes, maps supported values to Care, and asks you to review conflicts before replacing existing profile information.';
      button.insertAdjacentElement('afterend', note);
    }
  }

  function queueEnsure() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      ensureControl();
    });
  }

  function start() {
    if (!isCarePage()) return;
    ensureControl();

    if (typeof MutationObserver === 'function' && document.body) {
      observer = new MutationObserver(mutations => {
        if (mutations.some(mutation =>
          Array.from(mutation.addedNodes || []).some(node =>
            node instanceof Element && (
              node.matches?.('.directory-header-actions,.directory-dashboard-header') ||
              node.querySelector?.('.directory-header-actions')
            )
          )
        )) queueEnsure();
      });
      observer.observe(document.body, { childList:true, subtree:true });
    }

    [80,220,520,1000,1800,3200,5200].forEach(delay => setTimeout(ensureControl, delay));
    window.addEventListener('pageshow', ensureControl);
    window.addEventListener('focus', ensureControl);
    window.addEventListener('waffle:ui-contract-ready', ensureControl);

    window.v11190CarePdfOcrVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
