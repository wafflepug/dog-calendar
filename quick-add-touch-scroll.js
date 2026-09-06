/* ============================================================
   WAFFLE HOUSE — QUICK ADD TOUCH SCROLL
   ------------------------------------------------------------
   Makes every mobile Quick Add surface genuinely scrollable, including the
   canonical #v10QuickAddSheet used by New Boarding and dynamically generated
   Quick Add dialogs. The outer sheet owns the scroll range so final action
   buttons can always be pulled above Waffle's fixed bottom navigation and the
   device safe area.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_QUICK_ADD_TOUCH_SCROLL) return;

  const VERSION = '1.1.0';
  const STYLE_ID = 'waffleQuickAddTouchScrollStyle';
  const MOBILE_QUERY = '(max-width: 820px)';
  let observer = null;
  let scheduled = false;

  function isMobile() {
    try { return !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches; }
    catch (_) { return false; }
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (max-width: 820px) {
        #v10QuickAddSheet,
        #customBookingModal,
        #potentialStayModal,
        [data-quick-add-modal],
        .waffle-quick-add-scroll-host {
          overflow-x: hidden !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior-y: contain !important;
          touch-action: pan-y !important;
          align-items: flex-start !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          max-height: 100vh !important;
          max-height: 100dvh !important;
          height: 100vh !important;
          height: 100dvh !important;
          padding-top: max(10px, env(safe-area-inset-top)) !important;
          padding-left: max(0px, env(safe-area-inset-left)) !important;
          padding-right: max(0px, env(safe-area-inset-right)) !important;
          padding-bottom: calc(170px + env(safe-area-inset-bottom)) !important;
          scroll-padding-top: max(10px, env(safe-area-inset-top)) !important;
          scroll-padding-bottom: calc(170px + env(safe-area-inset-bottom)) !important;
        }

        #v10QuickAddSheet > *,
        #customBookingModal .modal-content-panel,
        #potentialStayModal .modal-content-panel,
        [data-quick-add-modal] .modal-content-panel,
        .waffle-quick-add-scroll-panel {
          flex: 0 0 auto !important;
          max-height: none !important;
          height: auto !important;
          overflow: visible !important;
          -webkit-overflow-scrolling: auto !important;
          touch-action: pan-y !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          padding-bottom: max(28px, env(safe-area-inset-bottom)) !important;
        }

        #v10QuickAddSheet .waffle-quick-add-action-row,
        .waffle-quick-add-scroll-host .waffle-quick-add-action-row {
          position: relative !important;
          inset: auto !important;
          bottom: auto !important;
          transform: none !important;
          margin-bottom: 20px !important;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function looksLikeQuickAdd(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (node.id === 'v10QuickAddSheet' || node.id === 'customBookingModal' || node.id === 'potentialStayModal') return true;
    if (node.hasAttribute('data-quick-add-modal')) return true;

    const text = String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
    if (!/(New Boarding|Add Potential Stay|Meet\s*&\s*Greet|Quick Add|Confirmed Stay|Pending Stay)/i.test(text)) return false;

    let style;
    try { style = getComputedStyle(node); } catch (_) { return false; }
    return style.position === 'fixed' || style.position === 'absolute' || node.getAttribute('role') === 'dialog';
  }

  function findHost(start) {
    let node = start instanceof HTMLElement ? start : null;
    while (node && node !== document.body) {
      if (looksLikeQuickAdd(node)) return node;
      let style;
      try { style = getComputedStyle(node); } catch (_) { style = null; }
      if (style && style.position === 'fixed' && /(Boarding|Potential|Meet|Quick Add|Stay)/i.test(node.textContent || '')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function markActionRow(host) {
    if (!(host instanceof HTMLElement)) return;
    const buttons = Array.from(host.querySelectorAll('button,input[type="submit"],input[type="button"]'));
    const submit = buttons.find(button => /(?:submit|save|create|confirm|add|book)/i.test(String(button.textContent || button.value || button.getAttribute('aria-label') || '')));
    if (!submit) return;
    const row = submit.closest('.actions,.modal-actions,.form-actions,.button-row,.footer,[class*="action"],[class*="footer"]') || submit.parentElement;
    if (row instanceof HTMLElement) row.classList.add('waffle-quick-add-action-row');
  }

  function enhanceHost(host) {
    if (!(host instanceof HTMLElement)) return;
    host.classList.add('waffle-quick-add-scroll-host');

    let panel = null;
    if (host.id === 'v10QuickAddSheet') panel = host.firstElementChild;
    if (!panel) panel = host.querySelector('.modal-content-panel,[role="document"],form,[class*="panel"],[class*="sheet"]');
    if (!panel) panel = host.firstElementChild;
    if (panel instanceof HTMLElement) panel.classList.add('waffle-quick-add-scroll-panel');

    markActionRow(host);
  }

  function scan() {
    scheduled = false;
    if (!isMobile() || !document.body) return;

    ['v10QuickAddSheet', 'customBookingModal', 'potentialStayModal'].forEach(id => {
      const node = document.getElementById(id);
      if (node) enhanceHost(node);
    });

    document.querySelectorAll('[data-quick-add-modal],[role="dialog"],button,input[type="submit"]').forEach(node => {
      const host = findHost(node);
      if (host) enhanceHost(host);
    });
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scan);
  }

  function startObserver() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'style', 'class', 'aria-hidden']
    });
  }

  installStyle();
  startObserver();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleScan, { once: true });
  else scheduleScan();
  window.addEventListener('pageshow', scheduleScan);
  window.addEventListener('resize', scheduleScan);

  window.WAFFLE_QUICK_ADD_TOUCH_SCROLL = Object.freeze({
    version: VERSION,
    styleId: STYLE_ID,
    scan: scheduleScan
  });
})();
