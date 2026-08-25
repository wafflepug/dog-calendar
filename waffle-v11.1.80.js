/* ============================================================
   WAFFLE HOUSE V11.1.80 — MOBILE HEADER ACTION RAIL
   ------------------------------------------------------------
   Mobile Calendar header authority:
   - removes the branding logo from behind the hamburger menu;
   - stacks Notifications, Search and connection/update status on the right;
   - preserves the original controls/listeners by moving the live DOM nodes;
   - restores nodes when leaving the mobile breakpoint.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.80';
  const MOBILE_QUERY = '(max-width: 820px)';
  const moved = new Map();
  let observer = null;
  let frame = 0;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function isMobile() {
    return !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
  }

  function ensureStyle() {
    if (document.getElementById('wh80MobileHeaderStyle')) return;
    const style = document.createElement('style');
    style.id = 'wh80MobileHeaderStyle';
    style.textContent = `
      @media (max-width:820px) {
        body[data-waffle-page="calendar"] .calendar-header-branding .calendar-brand-img,
        body[data-waffle-page="calendar"] .calendar-header-branding .calendar-brand-logo {
          display:none!important;
          visibility:hidden!important;
          pointer-events:none!important;
        }

        body[data-waffle-page="calendar"] .calendar-header-branding {
          min-height:0!important;
        }

        #wh80MobileHeaderRail {
          position:fixed;
          top:calc(12px + env(safe-area-inset-top));
          right:12px;
          z-index:2147481801;
          display:flex;
          flex-direction:column;
          align-items:flex-end;
          gap:8px;
          width:max-content;
          pointer-events:none;
        }

        #wh80MobileHeaderRail > * {
          pointer-events:auto;
          margin:0!important;
          flex:none!important;
        }

        #wh80MobileHeaderRail > button,
        #wh80MobileHeaderRail > a,
        #wh80MobileHeaderRail > [role="button"] {
          box-sizing:border-box!important;
          max-width:92px;
        }

        #wh80MobileHeaderRail [data-wh80-role="notification"],
        #wh80MobileHeaderRail [data-wh80-role="search"] {
          width:44px!important;
          height:44px!important;
          min-width:44px!important;
          min-height:44px!important;
          padding:0!important;
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
          border-radius:14px!important;
        }

        #wh80MobileHeaderRail [data-wh80-role="status"] {
          min-height:34px!important;
          max-width:92px!important;
          padding-left:10px!important;
          padding-right:10px!important;
          white-space:nowrap!important;
          justify-content:center!important;
          text-align:center!important;
        }
      }

      @media (min-width:821px) {
        #wh80MobileHeaderRail { display:none!important; }
      }
    `;
    document.head.appendChild(style);
  }

  function signature(node) {
    if (!(node instanceof Element)) return '';
    return [
      node.id,
      node.className,
      node.getAttribute('aria-label'),
      node.getAttribute('title'),
      node.getAttribute('data-action'),
      node.getAttribute('data-testid'),
      node.textContent
    ].join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function excluded(node) {
    return !node ||
      node.id === 'wh75MenuButton' ||
      !!node.closest('#wh75MobileDrawer,#wh75MobileBottomNav,#wh75SettingsPanel,#wh80MobileHeaderRail');
  }

  function visibleNearTop(node) {
    if (!(node instanceof HTMLElement)) return false;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.top < 190;
  }

  function findAction(kind) {
    const candidates = Array.from(document.querySelectorAll('button,a,[role="button"]'))
      .filter(node => !excluded(node) && visibleNearTop(node));

    if (kind === 'notification') {
      return candidates.find(node => /notif|notification|bell|🔔|🔕/.test(signature(node))) || null;
    }

    if (kind === 'search') {
      return candidates.find(node => /search|magnif|🔍|🔎/.test(signature(node))) || null;
    }

    return null;
  }

  function findStatus() {
    const direct = document.querySelector(
      '#waffleConnectionStatus,.waffle-connection-status,[data-waffle-connection-status],[data-connection-status]'
    );
    if (direct && !excluded(direct)) return direct;

    const candidates = Array.from(document.querySelectorAll('button,span,div'))
      .filter(node => !excluded(node) && visibleNearTop(node));

    return candidates.find(node => {
      const text = String(node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return /^(↻\s*)?(updating|syncing|live|offline|online|synced)(\b|…|\.\.\.)/.test(text);
    }) || null;
  }

  function ensureRail() {
    let rail = document.getElementById('wh80MobileHeaderRail');
    if (!rail) {
      rail = document.createElement('div');
      rail.id = 'wh80MobileHeaderRail';
      rail.setAttribute('aria-label', 'Mobile header actions');
      document.body.appendChild(rail);
    }
    return rail;
  }

  function remember(node) {
    if (!node || moved.has(node)) return;
    moved.set(node, {
      parent: node.parentNode,
      next: node.nextSibling
    });
  }

  function moveIntoRail(node, role, rail) {
    if (!(node instanceof HTMLElement) || !rail) return;
    remember(node);
    node.dataset.wh80Role = role;
    if (node.parentNode !== rail) rail.appendChild(node);
  }

  function restoreAll() {
    moved.forEach((location, node) => {
      if (!(node instanceof HTMLElement)) return;
      delete node.dataset.wh80Role;
      const parent = location.parent;
      if (!(parent instanceof Node) || !parent.isConnected) return;
      if (location.next && location.next.parentNode === parent) parent.insertBefore(node, location.next);
      else parent.appendChild(node);
    });
    moved.clear();
    document.getElementById('wh80MobileHeaderRail')?.remove();
  }

  function reconcile() {
    frame = 0;
    if (!document.body || !isCalendarPage()) {
      restoreAll();
      return;
    }

    ensureStyle();

    if (!isMobile()) {
      restoreAll();
      return;
    }

    const rail = ensureRail();
    const notification = findAction('notification');
    const search = findAction('search');
    const status = findStatus();

    moveIntoRail(notification, 'notification', rail);
    moveIntoRail(search, 'search', rail);
    moveIntoRail(status, 'status', rail);

    ['notification', 'search', 'status'].forEach(role => {
      const node = rail.querySelector(`[data-wh80-role="${role}"]`);
      if (node) rail.appendChild(node);
    });
  }

  function queue() {
    if (frame) return;
    frame = requestAnimationFrame(reconcile);
  }

  function start() {
    reconcile();

    if (typeof MutationObserver === 'function' && document.body) {
      observer = new MutationObserver(queue);
      observer.observe(document.body, { childList:true, subtree:true });
    }

    [60, 160, 360, 700, 1200, 2200, 4200, 7000].forEach(delay => setTimeout(reconcile, delay));
    window.addEventListener('pageshow', reconcile);
    window.addEventListener('focus', reconcile);
    window.addEventListener('resize', queue);
    window.addEventListener('orientationchange', () => setTimeout(reconcile, 80));

    window.v11180MobileHeaderRailVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
