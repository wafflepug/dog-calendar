/* ============================================================
   WAFFLE HOUSE V11.2.01 — CARE STAY COUNT CONSISTENCY
   ------------------------------------------------------------
   Keeps the Care status counters scoped to their own stay type. Older Care
   code counts every card in #directory-grid as Current; Future Stays now share
   that grid, so the legacy total can overwrite the split Current/Future counts.
   This final runtime guard reconciles counts after renders and stale writes.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_V11201_CARE_COUNT_CONSISTENCY) return;

  const VERSION = '11.2.01';
  let scheduled = false;
  let observer = null;
  let legacyOverrideInstalled = false;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  }

  function isCarePage() {
    return pageName() === 'directory';
  }

  function todayKey() {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');
  }

  function dateKey(value) {
    const text = String(value || '').trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return '';
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, '0'),
      String(parsed.getDate()).padStart(2, '0')
    ].join('-');
  }

  function careCards() {
    const grid = document.getElementById('directory-grid');
    if (!grid) return [];
    return Array.from(grid.children).filter(node =>
      node instanceof HTMLElement &&
      node.matches('.directory-card[data-directory-stay-key]')
    );
  }

  function isFutureCard(card) {
    if (card?.dataset?.v1082StayKind === 'future') return true;
    const start = dateKey(
      card?.dataset?.directoryStartDate ||
      card?.dataset?.startDate ||
      ''
    );
    return !!start && start > todayKey();
  }

  function writeCounter(id, value) {
    const node = document.getElementById(id);
    if (!node) return;
    const next = String(value);
    if (node.textContent !== next) node.textContent = next;
  }

  function reconcileCounts() {
    scheduled = false;
    if (!isCarePage()) return { current: 0, future: 0, total: 0 };

    /* Let the Future Stays owner classify cards first when available. The
       independent calculation below is still authoritative for these badges,
       so a later legacy cards.length write cannot collapse the split again. */
    try {
      window.WAFFLE_V11195_FUTURE_STAYS?.classifyAndCount?.();
    } catch (_) {}

    const cards = careCards();
    let current = 0;
    let future = 0;

    cards.forEach(card => {
      if (isFutureCard(card)) future += 1;
      else current += 1;
    });

    writeCounter('v1082CurrentStayCount', current);
    writeCounter('v1082FutureStayCount', future);

    return { current, future, total: cards.length };
  }

  function scheduleReconcile() {
    if (scheduled || !isCarePage()) return;
    scheduled = true;
    requestAnimationFrame(reconcileCounts);
  }

  function installLegacyCountOverride() {
    if (legacyOverrideInstalled || !isCarePage()) return;
    try {
      if (typeof v1082UpdateCurrentCount !== 'function') return;
      const replacement = function () {
        scheduleReconcile();
      };
      replacement.v11201StayCountAware = true;
      v1082UpdateCurrentCount = replacement;
      legacyOverrideInstalled = true;
    } catch (error) {
      console.warn('Care split-count legacy override could not be installed:', error);
    }
  }

  function startObserver() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(mutations => {
      if (!isCarePage()) return;
      const relevant = mutations.some(mutation => {
        const target = mutation.target instanceof Element
          ? mutation.target
          : mutation.target?.parentElement;
        if (!target) return false;
        return !!target.closest(
          '#directory-grid, #v1082CurrentStayCount, #v1082FutureStayCount'
        );
      });
      if (relevant) scheduleReconcile();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'data-directory-start-date',
        'data-start-date',
        'data-v1082-stay-kind'
      ]
    });
  }

  function start() {
    if (!isCarePage()) return;
    installLegacyCountOverride();
    startObserver();
    scheduleReconcile();

    window.addEventListener('pageshow', scheduleReconcile);
    window.addEventListener('waffle:phase4-data-changed', scheduleReconcile);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleReconcile();
    });

    /* Directory/Future modules can complete work asynchronously after startup. */
    [80, 250, 700, 1600, 3500].forEach(delay => {
      window.setTimeout(() => {
        installLegacyCountOverride();
        scheduleReconcile();
      }, delay);
    });
  }

  window.WAFFLE_V11201_CARE_COUNT_CONSISTENCY = Object.freeze({
    version: VERSION,
    reconcileCounts,
    scheduleReconcile
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
