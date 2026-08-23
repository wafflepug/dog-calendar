/* ============================================================
   WAFFLE HOUSE V11.1.40 — ASK WAFFLE LAYOUT HARDENING
   - Stack Quick Action above Ask Waffle on desktop.
   - Preserve Quick Add inside the mobile navigation.
   - Remove the stray Request From selector from Ask Waffle.
   - Keep the assistant inside narrow Fold/mobile viewports.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.40.1';
  const TARGET_PAGES = new Set(['calendar', 'directory']);

  function pageName() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      'calendar'
    );
  }

  function isMobile() {
    return !!window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  function ensureStyle() {
    if (document.getElementById('aw40-layout-style')) return;

    const style = document.createElement('style');
    style.id = 'aw40-layout-style';
    style.textContent = `
      /* Only floating Quick Add gets desktop Ask Waffle spacing. Never move
         the copy that V10.8.8/V11.1.22 docks into the mobile navigation. */
      @media (min-width: 769px) {
        body[data-waffle-page="calendar"] .v10-quick-add-button:not(.v1088-nav-quick-add),
        body[data-waffle-page="directory"] .v10-quick-add-button:not(.v1088-nav-quick-add) {
          right: 18px !important;
          bottom: 96px !important;
        }
      }

      @media (max-width: 768px) {
        body .app-tabs > .v10-quick-add-button.v1088-nav-quick-add,
        body .app-tabs > .v10-quick-add-button.v11122-nav-add {
          top: auto !important;
          right: auto !important;
          bottom: auto !important;
          left: auto !important;
          inset: auto !important;
        }
      }

      /* Defensive selectors for any request-source block injected into Waffle. */
      #v11133AskWaffleModal .request-from,
      #v11133AskWaffleModal .request-from-block,
      #v11133AskWaffleModal .request-source,
      #v11133AskWaffleModal .request-source-block,
      #v11133AskWaffleModal [data-request-from],
      #v11133AskWaffleModal [data-request-source] {
        display: none !important;
      }

      /* Do not let 100vw + modal padding exceed the usable viewport. */
      #v11133AskWaffleModal {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 100vw !important;
        overflow: hidden !important;
      }

      #v11133AskWaffleModal .aw37-card {
        box-sizing: border-box !important;
        width: min(720px, 100%) !important;
        max-width: 100% !important;
        min-width: 0 !important;
      }

      #v11133AskWaffleModal .aw37-head,
      #v11133AskWaffleModal .aw37-brand,
      #v11133AskWaffleModal .aw37-brand > div,
      #v11133AskWaffleModal .aw37-prompts,
      #v11133AskWaffleModal .aw37-thread,
      #v11133AskWaffleModal .aw37-form,
      #v11133AskWaffleModal .aw37-foot {
        box-sizing: border-box !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }

      #v11133AskWaffleModal .aw37-brand > div {
        overflow: hidden;
      }

      #v11133AskWaffleModal .aw37-brand p,
      #v11133AskWaffleModal .aw37-brand h3 {
        overflow-wrap: anywhere;
      }

      #v11133AskWaffleModal .aw37-form {
        grid-template-columns: minmax(0, 1fr) auto !important;
      }

      #v11133AskWaffleModal .aw37-form input {
        box-sizing: border-box !important;
        width: 100% !important;
        min-width: 0 !important;
      }

      @media (max-width: 768px) {
        #v11133AskWaffleModal {
          padding: 8px !important;
        }

        #v11133AskWaffleModal .aw37-card {
          width: 100% !important;
          max-height: calc(100dvh - 16px) !important;
        }
      }

      /* Fold-class narrow cover screens, including Galaxy Z Fold portrait. */
      @media (max-width: 420px) {
        #v11133AskWaffleModal {
          padding: 6px !important;
          place-items: center !important;
        }

        #v11133AskWaffleModal .aw37-card {
          width: 100% !important;
          max-height: calc(100dvh - 12px) !important;
          border-radius: 18px !important;
        }

        #v11133AskWaffleModal .aw37-head {
          gap: 8px !important;
          padding: 12px !important;
        }

        #v11133AskWaffleModal .aw37-brand {
          gap: 8px !important;
          flex: 1 1 auto !important;
        }

        #v11133AskWaffleModal .aw37-brand > img {
          width: 44px !important;
          height: 44px !important;
          flex: 0 0 44px !important;
        }

        #v11133AskWaffleModal .aw37-brand small {
          font-size: 8px !important;
          letter-spacing: .07em !important;
        }

        #v11133AskWaffleModal .aw37-brand h3 {
          font-size: 18px !important;
          line-height: 1.1 !important;
        }

        #v11133AskWaffleModal .aw37-brand p {
          font-size: 9px !important;
          line-height: 1.3 !important;
        }

        #v11133AskWaffleModal .aw37-close {
          width: 34px !important;
          height: 34px !important;
          flex: 0 0 34px !important;
        }

        #v11133AskWaffleModal .aw37-prompts {
          gap: 6px !important;
          padding: 8px 12px !important;
          overscroll-behavior-inline: contain;
        }

        #v11133AskWaffleModal .aw37-prompts button {
          padding: 6px 9px !important;
          font-size: 8.5px !important;
        }

        #v11133AskWaffleModal .aw37-thread {
          gap: 10px !important;
          padding: 12px !important;
        }

        #v11133AskWaffleModal .aw37-msg.bot {
          gap: 6px !important;
        }

        #v11133AskWaffleModal .aw37-face {
          width: 44px !important;
          height: 44px !important;
        }

        #v11133AskWaffleModal .aw37-face.latest {
          width: 50px !important;
          height: 50px !important;
        }

        #v11133AskWaffleModal .aw37-bubble {
          max-width: calc(100% - 56px) !important;
          padding: 10px 11px !important;
          font-size: 10px !important;
        }

        #v11133AskWaffleModal .aw37-form {
          gap: 6px !important;
          padding: 10px 12px !important;
        }

        #v11133AskWaffleModal .aw37-form input {
          min-height: 44px !important;
          padding: 9px 10px !important;
        }

        #v11133AskWaffleModal .aw37-form button {
          min-width: 60px !important;
          padding: 0 12px !important;
        }

        #v11133AskWaffleModal .aw37-foot {
          padding: 0 12px 9px !important;
        }
      }

      @media (max-width: 360px) {
        #v11133AskWaffleModal {
          padding: 4px !important;
        }

        #v11133AskWaffleModal .aw37-card {
          max-height: calc(100dvh - 8px) !important;
          border-radius: 16px !important;
        }

        #v11133AskWaffleModal .aw37-head {
          padding: 10px !important;
        }

        #v11133AskWaffleModal .aw37-brand > img {
          width: 40px !important;
          height: 40px !important;
          flex-basis: 40px !important;
        }

        #v11133AskWaffleModal .aw37-brand h3 {
          font-size: 17px !important;
        }

        #v11133AskWaffleModal .aw37-brand p {
          font-size: 8.5px !important;
        }

        #v11133AskWaffleModal .aw37-prompts {
          padding-inline: 10px !important;
        }

        #v11133AskWaffleModal .aw37-thread {
          padding: 10px !important;
        }

        #v11133AskWaffleModal .aw37-face {
          width: 40px !important;
          height: 40px !important;
        }

        #v11133AskWaffleModal .aw37-face.latest {
          width: 46px !important;
          height: 46px !important;
        }

        #v11133AskWaffleModal .aw37-bubble {
          max-width: calc(100% - 50px) !important;
        }

        #v11133AskWaffleModal .aw37-form {
          padding: 8px 10px !important;
        }

        #v11133AskWaffleModal .aw37-form button {
          min-width: 58px !important;
          padding-inline: 9px !important;
        }

        #v11133AskWaffleModal .aw37-foot {
          padding-inline: 10px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function cleanText(element) {
    return String(element?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function providerCount(text) {
    return ['madpaw', 'pawshake', 'facebook', 'other']
      .reduce((count, provider) => count + (text.includes(provider) ? 1 : 0), 0);
  }

  function removeRequestFromBlock() {
    const modal = document.getElementById('v11133AskWaffleModal');
    if (!modal) return false;

    const directCandidates = Array.from(modal.querySelectorAll('*'))
      .filter(element => {
        const text = cleanText(element);
        return text.includes('request from') && providerCount(text) >= 2;
      })
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);

    const direct = directCandidates[0];
    if (direct && direct !== modal && !direct.classList.contains('aw37-card')) {
      direct.remove();
      return true;
    }

    const heading = Array.from(
      modal.querySelectorAll('h1,h2,h3,h4,h5,h6,label,strong,p,span,div')
    ).find(element => cleanText(element) === 'request from');

    if (!heading) return false;

    let candidate = heading.parentElement;
    for (let depth = 0; candidate && depth < 5; depth += 1) {
      if (candidate === modal || candidate.classList.contains('aw37-card')) break;

      const text = cleanText(candidate);
      const controls = candidate.querySelectorAll(
        'button,label,input,[role="radio"],[role="button"]'
      ).length;

      if (providerCount(text) >= 2 || controls >= 3) {
        candidate.remove();
        return true;
      }

      candidate = candidate.parentElement;
    }

    return false;
  }

  function wireModalObserver() {
    const modal = document.getElementById('v11133AskWaffleModal');
    if (!modal || modal.dataset.aw40Observed === 'true') return;

    modal.dataset.aw40Observed = 'true';
    const observer = new MutationObserver(() => removeRequestFromBlock());
    observer.observe(modal, { childList: true, subtree: true });
  }

  function restoreMobileQuickAdd() {
    if (!isMobile()) return;

    try {
      if (typeof window.v1088DockQuickAddButton === 'function') {
        window.v1088DockQuickAddButton();
      } else if (typeof v1088DockQuickAddButton === 'function') {
        v1088DockQuickAddButton();
      }
    } catch (_) {}

    const nav = document.querySelector('.app-tabs');
    const button = document.getElementById('v10QuickAddButton');
    if (!nav || !button) return;

    if (button.parentElement !== nav) {
      const organiser = nav.querySelector('[data-page-link="reminders"], a[href$="reminders.html"]');
      nav.insertBefore(button, organiser || null);
    }

    button.classList.add('v1088-nav-quick-add', 'v11122-nav-add');
    nav.classList.add('v1088-has-quick-add', 'v11122-unified-nav');
  }

  function apply() {
    if (!TARGET_PAGES.has(pageName())) return;
    ensureStyle();
    restoreMobileQuickAdd();
    removeRequestFromBlock();
    wireModalObserver();
  }

  function start() {
    apply();
    [80, 220, 500, 1000, 2200, 5000].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('resize', () => window.setTimeout(apply, 80));
    window.v11140AskWaffleLayoutVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

/* ============================================================
   WAFFLE HOUSE V11.1.44 — CARE RENDER STABILISER
   ============================================================
   The directory uses stale-while-revalidate. Previously every background or
   focus refresh re-applied the cached response with quiet:false before the
   fresh response arrived. That rebuilt the current cards and made the page
   alternate between its loaded state and its loading/empty state.

   This layer makes the already-rendered Care UI authoritative during refresh:
   - cached responses never replace visible current cards;
   - same-booking live refreshes update data without rebuilding the cards;
   - the care alert summary is scoped to Current stays only;
   - loading is shown as loading, never as a false "No active care alerts";
   - Historical PDF Intake stays a single neutral read-only indicator.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.44';
  let summaryFrame = 0;
  let headerObserver = null;
  let careObserver = null;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isDirectory() {
    return pageName() === 'directory';
  }

  function currentGrid() {
    return document.getElementById('directory-grid');
  }

  function currentCards() {
    const grid = currentGrid();
    if (!grid) return [];
    return Array.from(
      grid.querySelectorAll('.directory-card[data-directory-stay-key], .directory-card[data-stay-key]')
    );
  }

  function directoryIsVisiblyLoading() {
    const grid = currentGrid();
    if (!grid) return true;

    return !!grid.querySelector(
      '.v101-skeleton-list, .v101-skeleton-tile, .directory-page-loading'
    );
  }

  function ensureCareStyle() {
    if (document.getElementById('v11144CareStableStyle')) return;

    const style = document.createElement('style');
    style.id = 'v11144CareStableStyle';
    style.textContent = `
      body[data-waffle-page="directory"] #v11123LegacyIntakeHistoryNote,
      body[data-waffle-page="directory"] .v11144-historical-intake-note {
        border-color: #d9e2ec !important;
        background: #f8fafc !important;
        color: #475569 !important;
        box-shadow: none !important;
      }

      body.dark-theme[data-waffle-page="directory"] #v11123LegacyIntakeHistoryNote,
      body.dark-theme[data-waffle-page="directory"] .v11144-historical-intake-note {
        border-color: #475569 !important;
        background: #1e293b !important;
        color: #cbd5e1 !important;
      }

      body[data-waffle-page="directory"] #directory-care-summary.v11144-care-loading {
        border-color: #d9e2ec !important;
        background: #f8fafc !important;
        color: #475569 !important;
      }

      body.dark-theme[data-waffle-page="directory"] #directory-care-summary.v11144-care-loading {
        border-color: #475569 !important;
        background: #1e293b !important;
        color: #cbd5e1 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureHistoricalIntakeNote() {
    if (!isDirectory()) return null;

    const actions = document.querySelector('.directory-header-actions');
    if (!actions) return null;

    let note = document.getElementById('v11123LegacyIntakeHistoryNote');
    if (!note) {
      note = document.createElement('span');
      note.id = 'v11123LegacyIntakeHistoryNote';
      note.className = 'directory-care-summary v11123-legacy-intake-history-note v11144-historical-intake-note';
      note.textContent = 'Historical PDF Intake · view only';
      note.title = 'Existing historical PDF Intake records remain view-only. Use Digital Intake for new or updated intake information.';
      actions.insertBefore(note, actions.firstChild || null);
    } else {
      note.classList.add('v11144-historical-intake-note');
      note.textContent = 'Historical PDF Intake · view only';
    }

    return note;
  }

  function hideLegacyIntakeControls() {
    if (!isDirectory()) return;

    document.querySelectorAll(
      '#openLegacyIntakeUploadBtn, [data-upload-legacy-intake], [data-reassign-legacy-intake]'
    ).forEach(control => {
      control.hidden = true;
      control.setAttribute('aria-hidden', 'true');
      control.setAttribute('tabindex', '-1');
      control.style.setProperty('display', 'none', 'important');
    });
  }

  function renderCanonicalCareSummary() {
    if (!isDirectory()) return;

    const summary = document.getElementById('directory-care-summary');
    const grid = currentGrid();
    if (!summary || !grid) return;

    const cards = currentCards();
    const loading = directoryIsVisiblyLoading() || document.body?.dataset?.v11144DirectoryState === 'loading';
    const flagged = Array.from(
      grid.querySelectorAll('.directory-care-strip.has-alerts')
    );
    const totalAlerts = flagged.reduce((total, container) => {
      return total + container.querySelectorAll('[data-directory-care-alert]').length;
    }, 0);

    summary.classList.remove('v11144-care-loading');

    if (totalAlerts > 0) {
      summary.textContent =
        `${totalAlerts} ${totalAlerts === 1 ? 'alert' : 'alerts'} · ` +
        `${flagged.length} ${flagged.length === 1 ? 'dog' : 'dogs'}`;
      summary.classList.add('has-alerts', 'v11144-care-ready');
      return;
    }

    if (loading && cards.length === 0) {
      summary.textContent = 'Loading care alerts…';
      summary.classList.remove('has-alerts', 'v11144-care-ready');
      summary.classList.add('v11144-care-loading');
      return;
    }

    summary.textContent = 'No active care alerts';
    summary.classList.remove('has-alerts', 'v11144-care-loading');
    summary.classList.add('v11144-care-ready');
  }

  function queueCareSummary() {
    if (!isDirectory()) return;

    if (summaryFrame) cancelAnimationFrame(summaryFrame);
    summaryFrame = requestAnimationFrame(() => {
      summaryFrame = 0;
      renderCanonicalCareSummary();
    });
  }

  function installSummaryOverride() {
    if (!isDirectory()) return;

    const replacement = function () {
      queueCareSummary();
    };
    replacement.v11144Canonical = true;

    try {
      const current = window.refreshDirectoryCareSummary;
      if (!current || current.v11144Canonical !== true) {
        window.refreshDirectoryCareSummary = replacement;
      }
    } catch (_) {}

    try {
      if (typeof refreshDirectoryCareSummary === 'function' && refreshDirectoryCareSummary.v11144Canonical !== true) {
        refreshDirectoryCareSummary = replacement;
      }
    } catch (_) {}
  }

  function installApplyGuard() {
    if (!isDirectory()) return;

    let current = null;
    try { current = window.applyGuestDirectoryResponse; } catch (_) {}
    try {
      if (!current && typeof applyGuestDirectoryResponse === 'function') current = applyGuestDirectoryResponse;
    } catch (_) {}

    if (typeof current !== 'function' || current.v11144Guard === true) return;

    const base = current;
    const guarded = function (response, options = {}) {
      const cardsAlreadyVisible = currentCards().length > 0;
      const fromCache = options?.fromCache === true;

      if (fromCache && cardsAlreadyVisible) {
        queueCareSummary();
        return;
      }

      const nextOptions = { ...options };

      if (cardsAlreadyVisible) {
        nextOptions.quiet = true;
      }

      const result = base(response, nextOptions);
      queueCareSummary();
      return result;
    };

    guarded.v11144Guard = true;
    guarded.v11144Base = base;

    try { window.applyGuestDirectoryResponse = guarded; } catch (_) {}
    try { applyGuestDirectoryResponse = guarded; } catch (_) {}
  }

  function installLoadGuard() {
    if (!isDirectory()) return;

    let current = null;
    try { current = window.loadGuestDirectoryConsolidated; } catch (_) {}
    try {
      if (!current && typeof loadGuestDirectoryConsolidated === 'function') current = loadGuestDirectoryConsolidated;
    } catch (_) {}

    if (typeof current !== 'function' || current.v11144Guard === true) return;

    const base = current;
    const guarded = async function (options = {}) {
      const hasCards = currentCards().length > 0;
      const nextOptions = { ...options };

      if (hasCards && typeof nextOptions.quiet === 'undefined') {
        nextOptions.quiet = true;
      }

      if (document.body) {
        document.body.dataset.v11144DirectoryState = hasCards ? 'refreshing' : 'loading';
      }
      queueCareSummary();

      try {
        return await base(nextOptions);
      } finally {
        if (document.body) document.body.dataset.v11144DirectoryState = 'ready';
        queueCareSummary();
      }
    };

    guarded.v11144Guard = true;
    guarded.v11144Base = base;

    try { window.loadGuestDirectoryConsolidated = guarded; } catch (_) {}
    try { loadGuestDirectoryConsolidated = guarded; } catch (_) {}
  }

  function wireObservers() {
    if (!isDirectory() || typeof MutationObserver !== 'function') return;

    const actions = document.querySelector('.directory-header-actions');
    if (actions && !headerObserver) {
      headerObserver = new MutationObserver(() => {
        ensureHistoricalIntakeNote();
        hideLegacyIntakeControls();
      });
      headerObserver.observe(actions, { childList: true });
    }

    /* Observe only the Current-stay grid. Watching the whole Care panel would
       also see our own summary text updates and continuously schedule itself. */
    const root = currentGrid();
    if (root && !careObserver) {
      careObserver = new MutationObserver(() => queueCareSummary());
      careObserver.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden']
      });
    }
  }

  function applyCareStability() {
    if (!isDirectory()) return;
    ensureCareStyle();
    ensureHistoricalIntakeNote();
    hideLegacyIntakeControls();
    installSummaryOverride();
    installApplyGuard();
    installLoadGuard();
    wireObservers();
    queueCareSummary();
  }

  function start() {
    if (!isDirectory()) return;

    if (document.body && !document.body.dataset.v11144DirectoryState) {
      document.body.dataset.v11144DirectoryState = currentCards().length ? 'ready' : 'loading';
    }

    applyCareStability();

    [60, 180, 420, 900, 1700, 3200, 5600].forEach(delay => setTimeout(applyCareStability, delay));

    window.addEventListener('pageshow', applyCareStability);
    window.addEventListener('focus', applyCareStability);
    window.v11144CareStabilityVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
