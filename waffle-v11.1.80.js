/* ============================================================
   WAFFLE HOUSE V11.1.82 — CLEAN MOBILE TODAY HEADER
   ------------------------------------------------------------
   Final mobile Calendar / Today header authority:
   - keeps the Waffle House branding logo retired on mobile;
   - keeps Notifications, Search and Live/Updating in the right rail;
   - uses Waffle artwork for Notifications and Search;
   - keeps Install in a safe left-side slot below the date;
   - removes All clear, Operations Home and Today at Waffle House;
   - promotes the live date to the exact font metrics of the retired title;
   - preserves original action listeners by moving live DOM nodes.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.82';
  const MOBILE_QUERY = '(max-width: 820px)';
  const NOTIFICATION_AVATAR = 'waffle-notification-avatar-v1181.svg?v=11.1.82';
  const SEARCH_AVATAR = 'waffle-search-avatar-v1181.svg?v=11.1.82';
  const TODAY_AVATAR = 'waffle-today-avatar-v1178.svg?v=11.1.82';

  const moved = new Map();
  let frame = 0;
  let observer = null;

  function isCalendarPage() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar') === 'calendar';
  }

  function isMobile() {
    return !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
  }

  function ensureStyle() {
    let style = document.getElementById('wh80MobileHeaderStyle');
    if (!style) {
      style = document.createElement('style');
      style.id = 'wh80MobileHeaderStyle';
      document.head.appendChild(style);
    }

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

        body[data-waffle-page="calendar"] .v10-ops-heading .v10-eyebrow,
        body[data-waffle-page="calendar"] #v10OperationsTitle,
        body[data-waffle-page="calendar"] #v10TodayStatus,
        body[data-waffle-page="calendar"] .v10-today-status {
          display:none!important;
          visibility:hidden!important;
          pointer-events:none!important;
        }

        body[data-waffle-page="calendar"] #v10TodayDateLabel {
          margin:0!important;
          padding:0!important;
          font-family:var(--wh82-title-font-family,inherit)!important;
          font-size:var(--wh82-title-font-size,28px)!important;
          font-weight:var(--wh82-title-font-weight,800)!important;
          font-style:var(--wh82-title-font-style,normal)!important;
          line-height:var(--wh82-title-line-height,1.05)!important;
          letter-spacing:var(--wh82-title-letter-spacing,-0.02em)!important;
          color:var(--wh82-title-color,inherit)!important;
        }

        body[data-waffle-page="calendar"] .v10-ops-heading {
          align-items:flex-start!important;
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
          position:relative!important;
          width:46px!important;
          height:46px!important;
          min-width:46px!important;
          min-height:46px!important;
          padding:0!important;
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
          overflow:hidden!important;
          border-radius:50%!important;
          font-size:0!important;
          line-height:0!important;
          color:transparent!important;
        }

        #wh80MobileHeaderRail [data-wh80-role="notification"] > :not(.wh81-header-avatar),
        #wh80MobileHeaderRail [data-wh80-role="search"] > :not(.wh81-header-avatar) {
          display:none!important;
        }

        #wh80MobileHeaderRail .wh81-header-avatar {
          display:block!important;
          width:100%!important;
          height:100%!important;
          max-width:none!important;
          object-fit:cover!important;
          object-position:center!important;
          border-radius:50%!important;
          pointer-events:none!important;
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

        #wh81MobileInstallSlot {
          display:flex!important;
          align-items:center!important;
          justify-content:flex-start!important;
          width:min(180px,calc(100% - 112px))!important;
          min-height:0!important;
          margin:12px 0 14px!important;
          padding:0!important;
          box-sizing:border-box!important;
        }

        #wh81MobileInstallSlot > * {
          width:auto!important;
          max-width:180px!important;
          min-height:38px!important;
          margin:0!important;
          flex:none!important;
          white-space:nowrap!important;
        }
      }

      @media (min-width:821px) {
        #wh80MobileHeaderRail,
        #wh81MobileInstallSlot { display:none!important; }
      }
    `;
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
      !!node.closest('#wh75MobileDrawer,#wh75MobileBottomNav,#wh75SettingsPanel,#wh80MobileHeaderRail,#wh81MobileInstallSlot');
  }

  function visible(node) {
    if (!(node instanceof HTMLElement)) return false;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function visibleNearTop(node) {
    return visible(node) && node.getBoundingClientRect().top < 220;
  }

  function promoteTodayDate() {
    const title = document.getElementById('v10OperationsTitle');
    const date = document.getElementById('v10TodayDateLabel');
    if (!(title instanceof HTMLElement) || !(date instanceof HTMLElement)) return;

    const titleStyle = getComputedStyle(title);
    date.style.setProperty('--wh82-title-font-family', titleStyle.fontFamily || 'inherit');
    date.style.setProperty('--wh82-title-font-size', titleStyle.fontSize || '28px');
    date.style.setProperty('--wh82-title-font-weight', titleStyle.fontWeight || '800');
    date.style.setProperty('--wh82-title-font-style', titleStyle.fontStyle || 'normal');
    date.style.setProperty('--wh82-title-line-height', titleStyle.lineHeight || '1.05');
    date.style.setProperty('--wh82-title-letter-spacing', titleStyle.letterSpacing || '-0.02em');
    date.style.setProperty('--wh82-title-color', titleStyle.color || 'inherit');
    date.setAttribute('aria-label', `Today: ${String(date.textContent || '').trim()}`);
  }

  function findAction(kind, rail) {
    const existing = rail?.querySelector(`[data-wh80-role="${kind}"]`);
    if (existing) return existing;

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

  function findStatus(rail) {
    const existing = rail?.querySelector('[data-wh80-role="status"]');
    if (existing) return existing;

    const direct = document.querySelector('#waffleConnectionStatus,.waffle-connection-status,[data-waffle-connection-status],[data-connection-status]');
    if (direct && !excluded(direct)) return direct;

    return Array.from(document.querySelectorAll('button,span,div'))
      .filter(node => !excluded(node) && visibleNearTop(node))
      .find(node => /^(↻\s*)?(updating|syncing|live|offline|online|synced)(\b|…|\.\.\.)/.test(String(node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase())) || null;
  }

  function findInstall(slot) {
    const existing = slot?.querySelector('[data-wh81-role="install"]');
    if (existing) return existing;

    const preferred = document.querySelector('#installAppBtn,#pwaInstallButton,#installPwaButton,#installButton,[data-install-app],[data-pwa-install]');
    if (preferred && !excluded(preferred) && visible(preferred)) return preferred;

    return Array.from(document.querySelectorAll('button,a,[role="button"]'))
      .filter(node => !excluded(node) && visible(node))
      .find(node => /(^|\s)install(\s|$)|install app|add to home/.test(signature(node))) || null;
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

  function ensureInstallSlot() {
    const operations = document.querySelector('.v10-operations-home');
    if (!operations) return null;

    let slot = document.getElementById('wh81MobileInstallSlot');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'wh81MobileInstallSlot';
      slot.setAttribute('aria-label', 'Install Waffle House');
    }

    const heading = operations.querySelector('.v10-ops-heading');
    if (heading?.parentNode === operations) {
      if (heading.nextSibling !== slot) operations.insertBefore(slot, heading.nextSibling);
    } else if (slot.parentNode !== operations) {
      operations.insertBefore(slot, operations.firstChild);
    }
    return slot;
  }

  function remember(node) {
    if (!node || moved.has(node)) return;
    moved.set(node, { parent:node.parentNode, next:node.nextSibling });
  }

  function moveIntoRail(node, role, rail) {
    if (!(node instanceof HTMLElement) || !rail) return;
    remember(node);
    node.dataset.wh80Role = role;
    if (node.parentNode !== rail) rail.appendChild(node);
  }

  function moveInstall(node, slot) {
    if (!(node instanceof HTMLElement) || !slot) return;
    remember(node);
    node.dataset.wh81Role = 'install';
    if (node.parentNode !== slot) slot.appendChild(node);
  }

  function ensureAvatar(node, role, src, label) {
    if (!(node instanceof HTMLElement)) return;
    let image = node.querySelector(`.wh81-header-avatar[data-wh81-avatar="${role}"]`);
    if (!image) {
      image = document.createElement('img');
      image.className = 'wh81-header-avatar';
      image.dataset.wh81Avatar = role;
      image.alt = '';
      image.decoding = 'async';
      image.draggable = false;
      node.appendChild(image);
    }
    const desired = new URL(src, document.baseURI).href;
    if (image.src !== desired) image.src = src;
    node.setAttribute('aria-label', label);
    node.setAttribute('title', label);
  }

  function syncTodayFooterAvatar() {
    const image = document.querySelector('#wh75MobileBottomNav [data-wh75-route="today"] .wh78-nav-avatar,#wh75MobileBottomNav [data-wh75-route="today"] img');
    if (!image) return;
    const desired = new URL(TODAY_AVATAR, document.baseURI).href;
    if (image.src !== desired) image.src = TODAY_AVATAR;
  }

  function restoreAll() {
    document.querySelectorAll('.wh81-header-avatar').forEach(image => image.remove());
    moved.forEach((location, node) => {
      if (!(node instanceof HTMLElement)) return;
      delete node.dataset.wh80Role;
      delete node.dataset.wh81Role;
      const parent = location.parent;
      if (!(parent instanceof Node) || !parent.isConnected) return;
      if (location.next && location.next.parentNode === parent) parent.insertBefore(node, location.next);
      else parent.appendChild(node);
    });
    moved.clear();
    document.getElementById('wh80MobileHeaderRail')?.remove();
    document.getElementById('wh81MobileInstallSlot')?.remove();
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

    promoteTodayDate();

    const rail = ensureRail();
    const installSlot = ensureInstallSlot();
    const notification = findAction('notification', rail);
    const search = findAction('search', rail);
    const status = findStatus(rail);
    const install = findInstall(installSlot);

    moveIntoRail(notification, 'notification', rail);
    moveIntoRail(search, 'search', rail);
    moveIntoRail(status, 'status', rail);
    moveInstall(install, installSlot);

    if (notification) ensureAvatar(notification, 'notification', NOTIFICATION_AVATAR, 'Notifications');
    if (search) ensureAvatar(search, 'search', SEARCH_AVATAR, 'Search');

    ['notification', 'search', 'status'].forEach(role => {
      const node = rail.querySelector(`[data-wh80-role="${role}"]`);
      if (node) rail.appendChild(node);
    });

    syncTodayFooterAvatar();
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
    [40,120,260,520,900,1500,2600,4400,7200].forEach(delay => setTimeout(reconcile, delay));
    window.addEventListener('pageshow', reconcile);
    window.addEventListener('focus', reconcile);
    window.addEventListener('resize', queue);
    window.addEventListener('orientationchange', () => setTimeout(reconcile, 80));

    window.v11180MobileHeaderRailVersion = VERSION;
    window.v11181MobileHeaderAvatarsVersion = VERSION;
    window.v11182CleanMobileTodayHeaderVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
