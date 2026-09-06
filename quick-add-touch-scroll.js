/* ============================================================
   WAFFLE HOUSE — QUICK ADD TOUCH SCROLL
   ------------------------------------------------------------
   Mobile Quick Add dialogs use the overlay itself as the scroll viewport.
   This avoids trapping the user inside a short inner panel and lets the
   entire form move naturally with a vertical swipe while retaining enough
   bottom clearance for fixed app/browser navigation.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_QUICK_ADD_TOUCH_SCROLL) return;

  const STYLE_ID = 'waffleQuickAddTouchScrollStyle';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (max-width: 820px) {
        #customBookingModal,
        #potentialStayModal,
        [data-quick-add-modal] {
          overflow-x: hidden !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior-y: contain !important;
          touch-action: pan-y !important;
          align-items: flex-start !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          padding-top: max(10px, env(safe-area-inset-top)) !important;
          padding-left: max(0px, env(safe-area-inset-left)) !important;
          padding-right: max(0px, env(safe-area-inset-right)) !important;
          padding-bottom: calc(104px + env(safe-area-inset-bottom)) !important;
          scroll-padding-top: max(10px, env(safe-area-inset-top));
          scroll-padding-bottom: calc(104px + env(safe-area-inset-bottom));
        }

        #customBookingModal .modal-content-panel,
        #potentialStayModal .modal-content-panel,
        [data-quick-add-modal] .modal-content-panel {
          flex: 0 0 auto !important;
          max-height: none !important;
          overflow: visible !important;
          -webkit-overflow-scrolling: auto !important;
          touch-action: pan-y !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  installStyle();

  window.WAFFLE_QUICK_ADD_TOUCH_SCROLL = Object.freeze({
    version: '1.0.0',
    styleId: STYLE_ID
  });
})();
