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

  const VERSION = '1.3.0';
  const STYLE_ID = 'waffleQuickAddTouchScrollStyle';
  const QUICK_ADD_SELECTOR = [
    '#customBookingModal',
    '#potentialStayModal',
    '#v108BoardingModal',
    '[data-quick-add-modal]'
  ].join(',');
  // These overlays are created by separate runtime modules, often after this
  // script has started. Keep the selector explicit so ordinary role=dialog
  // content inside a page is not accidentally promoted to a fixed overlay.
  const GENERAL_MODAL_SELECTOR = [
    '.v108-modal',
    '.v11217-modal',
    '.belongings-camera-modal',
    '.hosted-photo-uploader-modal',
    '.guest-detail-edit-modal',
    '.waffle-notification-modal',
    '.v10-modal',
    '.v10-quick-add-sheet',
    '.waffle-install-guide',
    '.p4-modal',
    '.v11115-modal',
    '#v11133AskWaffleModal'
  ].join(',');
  const MODAL_SELECTOR = `${QUICK_ADD_SELECTOR},${GENERAL_MODAL_SELECTOR}`;
  const PANEL_SELECTOR = ':scope > .modal-content-panel, :scope > .v108-modal-card';
  const SPACER_ATTR = 'data-quick-add-scroll-spacer';
  const MIN_CLEARANCE = 180;
  let observer = null;
  let frame = 0;

  function isMobile() {
    try {
      return !!window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
    } catch (_) {
      return false;
    }
  }

  function visualViewportBottomGap() {
    const vv = window.visualViewport;
    if (!vv) return 0;
    return Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  }

  function navClearance() {
    const nav = document.getElementById('wh75MobileBottomNav');
    const navHeight = nav ? Math.ceil(nav.getBoundingClientRect().height || 0) : 0;
    const browserGap = Math.ceil(visualViewportBottomGap());
    return Math.max(MIN_CLEARANCE, navHeight + browserGap + 64);
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

        /* Every runtime-owned dialog must stay in the visual viewport. The
           fixed bottom nav remains mounted underneath the scrim; its z-index
           is deliberately lower than the dialog so it cannot cover controls. */
        html body .v108-modal,
        html body .v11217-modal,
        html body .belongings-camera-modal,
        html body .hosted-photo-uploader-modal,
        html body .guest-detail-edit-modal,
        html body .waffle-notification-modal,
        html body .v10-modal,
        html body .v10-quick-add-sheet,
        html body .waffle-install-guide,
        html body .p4-modal,
        html body .v11115-modal,
        html body #v11133AskWaffleModal {
          z-index: 2147482500 !important;
          box-sizing: border-box !important;
          max-height: var(--waffle-mobile-visual-height, 100dvh) !important;
          height: var(--waffle-mobile-visual-height, 100dvh) !important;
          top: var(--waffle-mobile-visual-top, 0px) !important;
          bottom: auto !important;
          padding-top: max(8px, env(safe-area-inset-top)) !important;
          padding-right: max(8px, env(safe-area-inset-right)) !important;
          padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
          padding-left: max(8px, env(safe-area-inset-left)) !important;
          overflow: hidden !important;
          overscroll-behavior: contain !important;
        }

        html body .v108-modal > .v108-modal-card,
        html body .v11217-modal > .v11217-modal-card,
        html body .belongings-camera-modal > *,
        html body .hosted-photo-uploader-modal > *,
        html body .guest-detail-edit-modal > *,
        html body .waffle-notification-modal > *,
        html body .v10-modal > *,
        html body .v10-quick-add-sheet > *,
        html body .waffle-install-guide > *,
        html body .p4-modal > .p4-card,
        html body .v11115-modal > .v11115-modal-card,
        html body #v11133AskWaffleModal > .aw37-card {
          max-height: calc(var(--waffle-mobile-visual-height, 100dvh) - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)) !important;
          min-height: 0 !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior-y: contain !important;
          scroll-padding-bottom: max(20px, env(safe-area-inset-bottom)) !important;
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
    if (modal.getAttribute('data-quick-add-modal') !== 'true') {
      modal.setAttribute('data-quick-add-modal', 'true');
    }

    const clearance = `${navClearance()}px`;
    if (modal.style.getPropertyValue('--waffle-quick-add-scroll-clearance') !== clearance) {
      modal.style.setProperty('--waffle-quick-add-scroll-clearance', clearance);
    }
    ensureSpacer(modal);
  }

  function visualViewportHeight() {
    const vv = window.visualViewport;
    return Math.max(1, Math.round(Number(vv?.height || window.innerHeight || document.documentElement?.clientHeight || 0)));
  }

  function visualViewportTop() {
    return Math.max(0, Math.round(Number(window.visualViewport?.offsetTop || 0)));
  }

  function prepareGeneralModal(modal) {
    if (!(modal instanceof HTMLElement) || !isMobile()) return;
    modal.setAttribute('data-waffle-mobile-modal-clearance', 'true');
  }

  function prepareAll() {
    frame = 0;
    if (!isMobile()) return;
    document.documentElement.style.setProperty('--waffle-mobile-visual-height', `${visualViewportHeight()}px`);
    document.documentElement.style.setProperty('--waffle-mobile-visual-top', `${visualViewportTop()}px`);
    document.querySelectorAll(QUICK_ADD_SELECTOR).forEach(prepareModal);
    document.querySelectorAll(GENERAL_MODAL_SELECTOR).forEach(prepareGeneralModal);
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
    window.addEventListener('orientationchange', schedulePrepare, { passive: true });
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
