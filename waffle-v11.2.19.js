/* ============================================================
   WAFFLE HOUSE V11.2.19 — MOBILE EARLY CHECKOUT REACHABILITY
   ----------------------------------------------------------------
   Keeps the owner-requested Early Checkout dialog above the fixed sitter
   navigation and gives the dialog one reliable, touch-scrollable body with a
   pinned action row. This is intentionally presentation-only: V11.2.17 remains
   authoritative for eligibility, payloads and checkout persistence.
   ============================================================ */
(function () {
  'use strict';

  if (window.__WAFFLE_EARLY_CHECKOUT_MOBILE_V11219__) return;
  window.__WAFFLE_EARLY_CHECKOUT_MOBILE_V11219__ = true;

  const VERSION = '11.2.19';
  const STYLE_ID = 'v11219EarlyCheckoutMobileStyles';
  const MODAL_ID = 'v11217EarlyCheckoutModal';
  let observer = null;
  let frame = 0;

  function isMobile() {
    try {
      return !!window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
    } catch (_) {
      return false;
    }
  }

  function visualViewportHeight() {
    const vv = window.visualViewport;
    const height = Number(vv?.height || window.innerHeight || document.documentElement?.clientHeight || 0);
    return Math.max(320, Math.round(height || 720));
  }

  function visualViewportTop() {
    const top = Number(window.visualViewport?.offsetTop || 0);
    return Math.max(0, Math.round(top || 0));
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (max-width: 820px) {
        html body .v11217-modal {
          inset: auto 0 auto 0 !important;
          top: var(--v11219-visual-top, 0px) !important;
          width: 100% !important;
          height: var(--v11219-visual-height, 100dvh) !important;
          max-height: var(--v11219-visual-height, 100dvh) !important;
          z-index: 2147482500 !important;
          box-sizing: border-box !important;
          align-items: stretch !important;
          justify-content: flex-end !important;
          overflow: hidden !important;
          overscroll-behavior: contain !important;
          touch-action: pan-y !important;
          padding-top: max(10px, env(safe-area-inset-top)) !important;
          padding-right: max(8px, env(safe-area-inset-right)) !important;
          padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
          padding-left: max(8px, env(safe-area-inset-left)) !important;
        }

        html body .v11217-modal-card {
          display: flex !important;
          flex-direction: column !important;
          width: 100% !important;
          max-width: 520px !important;
          max-height: calc(var(--v11219-visual-height, 100dvh) - 18px - env(safe-area-inset-top) - env(safe-area-inset-bottom)) !important;
          min-height: 0 !important;
          margin: 0 auto !important;
          overflow: hidden !important;
          overscroll-behavior: contain !important;
          touch-action: pan-y !important;
        }

        html body .v11217-modal-head {
          flex: 0 0 auto !important;
        }

        html body .v11217-modal-body {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior-y: contain !important;
          touch-action: pan-y !important;
          scroll-padding-bottom: 20px !important;
        }

        html body .v11217-modal-actions {
          position: sticky !important;
          bottom: 0 !important;
          z-index: 2 !important;
          flex: 0 0 auto !important;
          background: var(--v10-card, #fff) !important;
          border-top: 1px solid var(--v10-border, #e2e8f0) !important;
          padding: 12px 18px max(12px, env(safe-area-inset-bottom)) !important;
          box-shadow: 0 -10px 24px rgba(15, 23, 42, .08) !important;
        }

        body.dark-theme .v11217-modal-actions {
          background: var(--v10-card, #172033) !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function syncViewport() {
    frame = 0;
    if (!isMobile()) return;
    const root = document.documentElement;
    if (!root) return;
    root.style.setProperty('--v11219-visual-height', `${visualViewportHeight()}px`);
    root.style.setProperty('--v11219-visual-top', `${visualViewportTop()}px`);

    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.dataset.v11219MobileScrollReady = 'true';
      modal.querySelector('.v11217-modal-body')?.setAttribute('data-v11219-scroll-region', 'true');
      modal.querySelector('.v11217-modal-actions')?.setAttribute('data-v11219-sticky-actions', 'true');
    }
  }

  function scheduleSync() {
    if (frame) return;
    frame = window.requestAnimationFrame(syncViewport);
  }

  function startObserver() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(records => {
      if (!isMobile()) return;
      for (const record of records) {
        if (record.type === 'childList' || record.attributeName === 'hidden') {
          scheduleSync();
          break;
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden']
    });
  }

  installStyles();

  const start = () => {
    syncViewport();
    startObserver();
    window.addEventListener('resize', scheduleSync, { passive: true });
    window.addEventListener('orientationchange', scheduleSync, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleSync, { passive: true });
    window.visualViewport?.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('pageshow', scheduleSync);
  };

  window.WAFFLE_EARLY_CHECKOUT_MOBILE_V11219 = Object.freeze({
    version: VERSION,
    modalId: MODAL_ID,
    zIndex: 2147482500,
    sync: scheduleSync
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
