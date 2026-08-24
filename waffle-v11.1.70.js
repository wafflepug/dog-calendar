/* ============================================================
   WAFFLE HOUSE V11.1.70 — POTENTIAL STAY LABEL COMPACTION
   ============================================================
   Potential Stay bars show only the pet's name in the visible Calendar.
   The booking type remains available through title/aria-label and the existing
   click action still opens the underlying Potential Stay record.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.70';
  let observer = null;
  let scheduled = 0;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function petNameFromLabel(value) {
    return String(value || '')
      .replace(/^Potential\s*[·:\-]\s*/i, '')
      .replace(/^Potential\s+Stay\s*[·:\-]?\s*/i, '')
      .trim();
  }

  function compactBar(bar) {
    if (!(bar instanceof Element)) return;
    const label = bar.querySelector('.wh65-bar-label');
    if (!label) return;

    const petName = petNameFromLabel(label.textContent);
    if (!petName) return;

    label.textContent = petName;
    bar.title = `Potential Stay · ${petName}`;
    bar.setAttribute('aria-label', `Potential Stay · ${petName}`);
  }

  function apply() {
    scheduled = 0;
    if (!isCalendarPage()) return;
    document.querySelectorAll('#wh65Calendar .wh65-bar.potential').forEach(compactBar);
  }

  function scheduleApply() {
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(apply);
  }

  function observe() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation =>
        Array.from(mutation.addedNodes || []).some(node => {
          if (!(node instanceof Element)) return false;
          return node.classList?.contains('potential') ||
            node.id === 'wh65Calendar' ||
            !!node.querySelector?.('.wh65-bar.potential');
        })
      );
      if (relevant) scheduleApply();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function start() {
    if (!isCalendarPage()) return;
    observe();
    apply();
    [100, 300, 700, 1400, 2600, 5000].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', scheduleApply);
    window.v11170PotentialLabelVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
