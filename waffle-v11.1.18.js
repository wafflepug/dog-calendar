/* ============================================================
   WAFFLE HOUSE V11.1.18 — CENTERED MOBILE MODALS + SINGLE CAPACITY DETAIL
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.18';

  function isMobile() {
    return !!window.matchMedia?.('(max-width: 768px)').matches;
  }

  function looksLikeOverlay(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.classList.contains('v108-modal')) return true;
    if (element.classList.contains('belongings-camera-modal')) return true;
    if (element.classList.contains('hosted-photo-uploader-modal')) return true;

    const identity = `${element.id || ''} ${element.className || ''}`.toLowerCase();
    if (!identity.includes('modal')) return false;

    try {
      return getComputedStyle(element).position === 'fixed';
    } catch (_) {
      return false;
    }
  }

  function isVisible(element) {
    if (!element || element.hidden) return false;
    try {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (Number(style.opacity || 1) === 0) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  function modalOverlays() {
    const found = new Set();

    document.querySelectorAll('.v108-modal, .belongings-camera-modal, .hosted-photo-uploader-modal')
      .forEach(element => found.add(element));

    document.querySelectorAll('body > div, body > section')
      .forEach(element => {
        if (looksLikeOverlay(element)) found.add(element);
      });

    return Array.from(found);
  }

  function visibleOverlays() {
    return modalOverlays().filter(isVisible);
  }

  function cardFor(overlay) {
    if (!overlay) return null;
    return overlay.querySelector(
      ':scope > .v108-modal-card, :scope > [role="dialog"], :scope > .modal-card, :scope > .modal-content, :scope > [class*="modal-card"], :scope > [class*="modal-panel"]'
    ) || overlay.firstElementChild;
  }

  function decorateMobileModals() {
    if (!isMobile()) {
      document.body.classList.remove('v11118-mobile-modal-open');
      return;
    }

    const open = visibleOverlays();

    modalOverlays().forEach(overlay => {
      overlay.classList.toggle('v11118-mobile-centered-overlay', open.includes(overlay));
      const card = cardFor(overlay);
      if (card) card.classList.toggle('v11118-mobile-centered-card', open.includes(overlay));
    });

    document.body.classList.toggle('v11118-mobile-modal-open', open.length > 0);
  }

  function hideSummaryModal() {
    const summary = document.getElementById('v11116CalendarSummaryModal');
    if (!summary) return;
    summary.hidden = true;
  }

  function reconcileCapacityStack(before, capacityInteraction) {
    const summary = document.getElementById('v11116CalendarSummaryModal');
    if (!summary || !isVisible(summary)) return;

    const after = visibleOverlays();
    const newlyOpened = after.filter(overlay => !before.has(overlay));
    const otherNewModal = newlyOpened.find(overlay => overlay !== summary);

    /* A Capacity-day drill-down used to leave the broader Capacity modal open
       underneath it. Keep the detailed day dialog and close the range dialog,
       so the user sees one scrollable popup only. */
    if (otherNewModal && (capacityInteraction || before.has(summary))) {
      hideSummaryModal();
    }
  }

  function scheduleRefresh(before, capacityInteraction) {
    [0, 35, 120].forEach(delay => {
      setTimeout(() => {
        reconcileCapacityStack(before, capacityInteraction);
        decorateMobileModals();
      }, delay);
    });
  }

  function wireSingleModalPolicy() {
    if (window.v11118SingleModalWired) return;
    window.v11118SingleModalWired = true;

    document.addEventListener('click', event => {
      if (!isMobile()) return;

      const before = new Set(visibleOverlays());
      const target = event.target instanceof Element ? event.target : null;
      const capacityInteraction = !!target?.closest(
        '.v10-capacity-day, #v11116CalendarSummaryModal .v11116-capacity-list li, #v11116CalendarSummaryModal [class*="capacity"]'
      );

      scheduleRefresh(before, capacityInteraction);
    }, true);
  }

  function start() {
    wireSingleModalPolicy();
    decorateMobileModals();

    [60, 180, 500, 1200, 2200].forEach(delay => setTimeout(decorateMobileModals, delay));

    window.addEventListener('pageshow', decorateMobileModals);
    window.addEventListener('focus', decorateMobileModals);
    window.addEventListener('orientationchange', () => setTimeout(decorateMobileModals, 80));

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', decorateMobileModals);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
