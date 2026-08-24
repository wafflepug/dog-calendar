/* ============================================================
   WAFFLE HOUSE V11.1.71 — RETIRE LEGACY CALENDAR FILTER STRIP
   ============================================================
   The V11.1.69 Calendar has its own Month / Fortnight / Week controls and no
   event-type filters. Older layers can still recreate a separate strip with:
     All · Confirmed · Meet & Greet · Potential
   plus the historical "Desktop: drag a booking to move dates" instruction.

   This layer permanently retires that whole legacy control block without
   touching the current Calendar toolbar or navigation.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.71';
  let observer = null;
  let scheduled = 0;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function normalise(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function isCurrentCalendarUi(node) {
    if (!(node instanceof Element)) return false;
    return !!node.closest('#wh65Calendar, .wh69-toolbar, .wh69-view-switcher, .app-tabs');
  }

  function buttonLabels(node) {
    if (!(node instanceof Element)) return [];
    return Array.from(node.querySelectorAll('button,[role="button"]'))
      .map(button => normalise(button.textContent))
      .filter(Boolean);
  }

  function hasLegacyFilterSet(node) {
    const labels = buttonLabels(node);
    if (!labels.length) return false;

    const hasAll = labels.some(label => label === 'all' || label.startsWith('all '));
    const hasConfirmed = labels.some(label => label.includes('confirmed'));
    const hasMeet = labels.some(label => label.includes('meet & greet') || label.includes('meet and greet'));
    const hasPotential = labels.some(label => label.includes('potential'));

    return hasAll && hasConfirmed && hasMeet && hasPotential;
  }

  function hasLegacyDragInstruction(node) {
    const text = normalise(node?.textContent);
    return text.includes('drag a booking to move dates') ||
      text.includes('desktop: drag a booking') ||
      text.includes('desktop drag a booking');
  }

  function looksLikeLegacyStrip(node) {
    if (!(node instanceof Element) || isCurrentCalendarUi(node)) return false;
    if (node.id === 'calendarTabPanel' || node.id === 'calendar') return false;

    const text = normalise(node.textContent);
    if (text.length > 500) return false;

    return hasLegacyFilterSet(node) || hasLegacyDragInstruction(node);
  }

  function smallestLegacyContainer(seed) {
    if (!(seed instanceof Element)) return null;

    let candidate = seed;
    let best = null;
    for (let depth = 0; candidate && depth < 6; depth += 1, candidate = candidate.parentElement) {
      if (candidate.id === 'calendarTabPanel' || candidate === document.body) break;
      if (isCurrentCalendarUi(candidate)) break;
      if (looksLikeLegacyStrip(candidate)) best = candidate;
    }

    if (!best) return null;

    // Prefer the smallest qualifying ancestor so unrelated Calendar content is
    // never removed with the retired filter strip.
    let smallest = best;
    let child = seed;
    while (child && child !== best) {
      if (looksLikeLegacyStrip(child)) smallest = child;
      child = child.parentElement;
    }
    return smallest;
  }

  function retireNode(node) {
    if (!(node instanceof Element) || isCurrentCalendarUi(node)) return false;
    node.setAttribute('data-wh71-retired-calendar-filter', 'true');
    node.setAttribute('aria-hidden', 'true');
    node.remove();
    return true;
  }

  function retireLegacyFilters() {
    scheduled = 0;
    if (!isCalendarPage()) return;

    const panel = document.getElementById('calendarTabPanel') || document.body;
    if (!panel) return;

    const candidates = new Set();

    panel.querySelectorAll('button,[role="button"],span,small,p,div,section,nav').forEach(node => {
      const text = normalise(node.textContent);
      if (
        text === 'all' ||
        text.includes('confirmed') ||
        text.includes('meet & greet') ||
        text.includes('meet and greet') ||
        text.includes('potential') ||
        text.includes('drag a booking to move dates')
      ) {
        const container = smallestLegacyContainer(node);
        if (container) candidates.add(container);
      }
    });

    // Remove inner containers before outer ones. In normal operation there is
    // only one result, but this keeps the cleanup deterministic if duplicate
    // legacy layers were injected.
    Array.from(candidates)
      .sort((a, b) => {
        if (a.contains(b)) return 1;
        if (b.contains(a)) return -1;
        return 0;
      })
      .forEach(retireNode);
  }

  function scheduleRetirement() {
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(retireLegacyFilters);
  }

  function observe() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;

    observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation =>
        Array.from(mutation.addedNodes || []).some(node => {
          if (!(node instanceof Element)) return false;
          const text = normalise(node.textContent);
          return text.includes('confirmed') ||
            text.includes('meet & greet') ||
            text.includes('potential') ||
            text.includes('drag a booking to move dates');
        })
      );
      if (relevant) scheduleRetirement();
    });

    observer.observe(document.body, { childList:true, subtree:true });
  }

  function start() {
    if (!isCalendarPage()) return;
    retireLegacyFilters();
    observe();
    [60, 180, 420, 900, 1800, 3200, 5200].forEach(delay => setTimeout(retireLegacyFilters, delay));
    window.addEventListener('pageshow', scheduleRetirement);
    window.addEventListener('focus', scheduleRetirement);
    window.v11171LegacyCalendarFilterRetirementVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
