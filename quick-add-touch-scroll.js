/* ============================================================
   WAFFLE HOUSE — QUICK ADD TOUCH SCROLL
   ------------------------------------------------------------
   Mobile Quick Add dialogs use the overlay itself as the scroll viewport.
   This avoids trapping the user inside a short inner panel and lets the
   entire form move naturally with a vertical swipe while retaining enough
   bottom clearance for fixed app/browser navigation.

   New Boarding is a dynamically-created V10.8 modal (#v108BoardingModal),
   so it must be covered alongside the static Meet & Greet / Potential Stay
   dialogs. A real spacer is appended after the action row so scrollHeight
   always extends beyond the fixed Waffle nav and phone safe area.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_QUICK_ADD_TOUCH_SCROLL) return;

  const VERSION = '1.1.0';
  const STYLE_ID = 'waffleQuickAddTouchScrollStyle';
  const MODAL_SELECTOR = [
    '#customBookingModal',
    '#potentialStayModal',
    '#v108BoardingModal',
    '[data-quick-add-modal]'
  ].join(',');
  const PANEL_SELECTOR = ':scope > .modal-content-panel, :scope > .v108-modal-card';
  const SPACER_ATTR = 'data-quick-add-scroll-spacer';
  let observer = null;
  let frame = 0;

  function isMobile() {
    try {
      return !!window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
    } catch (_) {
      return false;
    }
  }

  function navClearance() {
    const nav = document.getElementById('wh75MobileBottomNav');
    const navHeight = nav ? Math.ceil(nav.getBoundingClientRect().height || 0) : 0;
    return Math.max(150, navHeight + 72);
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (max-width: 820px) {
        #customBookingModal,
        #potentialStayModal,
        #v108BoardingModal,
        [data-quick-add-modal] {
          z-index: 2147482500 !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100vh !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          box-sizing: border-box !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior-y: contain !important;
          touch-action: pan-y !important;
          align-items: flex-start !important;
          justify-content: center !important;
          padding-top: max(10px, env(safe-area-inset-top)) !important;
          padding-left: max(8px, env(safe-area-inset-left)) !important;
          padding-right: max(8px, env(safe-area-inset-right)) !important;
          padding-bottom: 0 !important;
          scroll-padding-top: max(10px, env(safe-area-inset-top));
          scroll-padding-bottom: var(--waffle-quick-add-scroll-clearance, 180px);
        }

        #customBookingModal > .modal-content-panel,
        #potentialStayModal > .modal-content-panel,
        #v108BoardingModal > .v108-modal-card,
        [data-quick-add-modal] > .modal-content-panel,
        [data-quick-add-modal] > .v108-modal-card {
          width: 100% !important;
          max-width: min(650px, 100%) !important;
          height: auto !important;
          max-height: none !important;
          min-height: 0 !important;
          flex: 0 0 auto !important;
          overflow: visible !important;
          -webkit-overflow-scrolling: auto !important;
          touch-action: pan-y !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }

        [data-quick-add-scroll-spacer] {
          display: block !important;
          width: 100% !important;
          height: var(--waffle-quick-add-scroll-clearance, 180px) !important;
          min-height: var(--waffle-quick-add-scroll-clearance, 180px) !important;
          flex: 0 0 var(--waffle-quick-add-scroll-clearance, 180px) !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function ensureSpacer(modal) {
    if (!(modal instanceof HTMLElement)) return;
    const panel = modal.querySelector(PANEL_SELECTOR) || modal.firstElementChild;
    if (!(panel instanceof HTMLElement)) return;

    let spacer = panel.querySelector(`:scope > [${SPACER_ATTR}]`);
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.setAttribute(SPACER_ATTR, 'true');
      spacer.setAttribute('aria-hidden', 'true');
      panel.appendChild(spacer);
    }
  }

  function prepareModal(modal) {
    if (!(modal instanceof HTMLElement) || !isMobile()) return;
    modal.setAttribute('data-quick-add-modal', 'true');
    modal.style.setProperty(
      '--waffle-quick-add-scroll-clearance',
      `${navClearance()}px`
    );
    ensureSpacer(modal);
  }

  function prepareAll() {
    frame = 0;
    if (!isMobile()) return;
    document.querySelectorAll(MODAL_SELECTOR).forEach(prepareModal);
  }

  function schedulePrepare() {
    if (frame) return;
    frame = requestAnimationFrame(prepareAll);
  }

  function startObserver() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(schedulePrepare);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'style', 'class']
    });
  }

  installStyle();

  const start = () => {
    prepareAll();
    startObserver();
    window.addEventListener('resize', schedulePrepare, { passive: true });
    window.visualViewport?.addEventListener('resize', schedulePrepare, { passive: true });
    window.visualViewport?.addEventListener('scroll', schedulePrepare, { passive: true });
    window.addEventListener('pageshow', schedulePrepare);
  };

  window.WAFFLE_QUICK_ADD_TOUCH_SCROLL = Object.freeze({
    version: VERSION,
    styleId: STYLE_ID,
    selector: MODAL_SELECTOR,
    prepare: schedulePrepare
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
