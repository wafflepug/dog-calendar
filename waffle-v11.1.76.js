/* ============================================================
   WAFFLE HOUSE V11.1.76 — AUTHORITATIVE MOBILE FOOTER
   ------------------------------------------------------------
   V11.1.75 introduced the independent sitter shell. Historical mobile
   enhancement layers can still recreate/show the old .app-tabs / V11.1.8
   footer after the new shell has mounted. V11.1.75 also treats the drawer as
   the shell-ready marker, so a removed bottom bar is not rebuilt by itself.

   This layer makes the mobile footer authoritative:
   - legacy four/five-item mobile footers cannot become visible;
   - the V11.1.75 bottom bar is restored if a late layer removes it;
   - the canonical bar is forced visible on mobile and remains hidden on desktop;
   - restored Add / Ask Waffle actions keep using the existing canonical flows.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.76';
  const MOBILE_QUERY = '(max-width: 820px)';
  const LEGACY_SELECTOR = [
    'nav.app-tabs',
    '#v1118MobileNav',
    'nav.v1118-mobile-nav',
    '.v1118-mobile-nav'
  ].join(',');

  let mutationObserver = null;
  let bodyObserver = null;
  let frame = 0;

  function isMobile() {
    return !!window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
  }

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function calendarView() {
    if (pageName() !== 'calendar') return '';
    const bodyView = String(document.body?.dataset?.wh75MobileView || '');
    if (bodyView === 'calendar' || bodyView === 'today') return bodyView;
    try {
      return new URLSearchParams(window.location.search).get('view') === 'calendar'
        ? 'calendar'
        : 'today';
    } catch (_) {
      return 'today';
    }
  }

  function activeRoute() {
    const page = pageName();
    if (page === 'calendar') return calendarView() === 'calendar' ? 'calendar' : 'today';
    if (page === 'directory' || page === 'reminders' || page === 'audit') return page;
    return '';
  }

  function suppressLegacyFooter(node) {
    if (!(node instanceof HTMLElement)) return;
    if (node.id === 'wh75MobileBottomNav' || node.closest?.('#wh75MobileDrawer')) return;

    const generated = node.id === 'v1118MobileNav' || node.classList.contains('v1118-mobile-nav');
    if (generated) {
      node.remove();
      return;
    }

    if (!node.classList.contains('app-tabs')) return;

    if (isMobile()) {
      node.dataset.wh76RetiredMobileFooter = 'true';
      node.setAttribute('aria-hidden', 'true');
      node.inert = true;
      node.style.setProperty('display', 'none', 'important');
      node.style.setProperty('visibility', 'hidden', 'important');
      node.style.setProperty('pointer-events', 'none', 'important');
      return;
    }

    if (node.dataset.wh76RetiredMobileFooter === 'true') {
      delete node.dataset.wh76RetiredMobileFooter;
      node.removeAttribute('aria-hidden');
      node.inert = false;
      node.style.display = '';
      node.style.visibility = '';
      node.style.pointerEvents = '';
    }
  }

  function suppressAllLegacyFooters() {
    document.querySelectorAll(LEGACY_SELECTOR).forEach(suppressLegacyFooter);
  }

  function bottomMarkup() {
    return [
      '<a class="wh75-bottom-item" href="index.html?view=today" data-wh75-route="today"><span class="wh75-bottom-icon" aria-hidden="true">⌂</span><span>Today</span></a>',
      '<a class="wh75-bottom-item" href="index.html?view=calendar" data-wh75-route="calendar"><span class="wh75-bottom-icon" aria-hidden="true">▦</span><span>Calendar</span></a>',
      '<a class="wh75-bottom-item" href="directory.html" data-wh75-route="directory"><span class="wh75-bottom-icon" aria-hidden="true">🐾</span><span>Care</span></a>',
      '<button class="wh75-bottom-item wh75-bottom-add" type="button" data-wh76-quick-add><span class="wh75-bottom-icon" aria-hidden="true">＋</span><span>Add</span></button>',
      '<button class="wh75-bottom-item" type="button" data-wh76-ask><span class="wh75-bottom-icon" aria-hidden="true">🐶</span><span>Ask Waffle</span></button>'
    ].join('');
  }

  function triggerQuickAdd() {
    const button = document.getElementById('v10QuickAddButton');
    if (button) {
      button.click();
      return;
    }
    if (pageName() !== 'calendar') {
      window.location.href = 'index.html?view=today&add=1';
      return;
    }
    document.getElementById('openPotentialBtn')?.click();
  }

  function triggerAskWaffle() {
    const launcher = document.getElementById('aw37launch') || document.getElementById('v11133AskWaffleButton');
    if (launcher) {
      launcher.click();
      return;
    }
    window.dispatchEvent(new CustomEvent('waffle:ask-open-request'));
  }

  function wireRestoredBottom(nav) {
    if (!nav || nav.dataset.wh76Wired === 'true') return;
    nav.dataset.wh76Wired = 'true';
    nav.querySelector('[data-wh76-quick-add]')?.addEventListener('click', triggerQuickAdd);
    nav.querySelector('[data-wh76-ask]')?.addEventListener('click', triggerAskWaffle);
  }

  function syncActiveNavigation(nav) {
    const route = activeRoute();
    (nav || document).querySelectorAll?.('#wh75MobileBottomNav [data-wh75-route]')?.forEach(item => {
      const active = item.dataset.wh75Route === route;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function ensureBottomNav() {
    if (!document.body) return null;

    let nav = document.getElementById('wh75MobileBottomNav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'wh75MobileBottomNav';
      nav.setAttribute('aria-label', 'Primary mobile navigation');
      nav.dataset.wh76Restored = 'true';
      nav.innerHTML = bottomMarkup();
      document.body.appendChild(nav);
      wireRestoredBottom(nav);
    }

    if (nav.parentElement !== document.body) document.body.appendChild(nav);

    if (isMobile()) {
      nav.hidden = false;
      nav.removeAttribute('aria-hidden');
      nav.inert = false;
      nav.style.setProperty('display', 'grid', 'important');
      nav.style.setProperty('visibility', 'visible', 'important');
      nav.style.setProperty('pointer-events', 'auto', 'important');
      nav.style.setProperty('position', 'fixed', 'important');
      nav.style.setProperty('left', '0', 'important');
      nav.style.setProperty('right', '0', 'important');
      nav.style.setProperty('bottom', '0', 'important');
      nav.style.setProperty('z-index', '2147481795', 'important');
    } else if (nav.dataset.wh76Restored === 'true') {
      nav.hidden = true;
      nav.setAttribute('aria-hidden', 'true');
      nav.inert = true;
      nav.style.display = '';
      nav.style.visibility = '';
      nav.style.pointerEvents = '';
      nav.style.position = '';
      nav.style.left = '';
      nav.style.right = '';
      nav.style.bottom = '';
      nav.style.zIndex = '';
    }

    syncActiveNavigation(nav);
    return nav;
  }

  function reconcile() {
    if (!document.body) return;
    suppressAllLegacyFooters();
    ensureBottomNav();
  }

  function queueReconcile() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      reconcile();
    });
  }

  function wireMutationProtection() {
    if (!document.body || typeof MutationObserver !== 'function') return;

    if (!mutationObserver) {
      mutationObserver = new MutationObserver(mutations => {
        const relevant = mutations.some(mutation =>
          Array.from(mutation.addedNodes || []).some(node => {
            if (!(node instanceof Element)) return false;
            return node.matches?.(LEGACY_SELECTOR + ',#wh75MobileBottomNav') ||
              !!node.querySelector?.(LEGACY_SELECTOR + ',#wh75MobileBottomNav');
          }) ||
          Array.from(mutation.removedNodes || []).some(node =>
            node instanceof Element &&
            (node.id === 'wh75MobileBottomNav' || !!node.querySelector?.('#wh75MobileBottomNav'))
          )
        );
        if (relevant) queueReconcile();
      });
      mutationObserver.observe(document.body, { childList:true, subtree:true });
    }

    if (!bodyObserver) {
      bodyObserver = new MutationObserver(queueReconcile);
      bodyObserver.observe(document.body, {
        attributes:true,
        attributeFilter:['data-wh75-mobile-view', 'data-waffle-page']
      });
    }
  }

  function start() {
    reconcile();
    wireMutationProtection();

    [40, 120, 300, 700, 1400, 2600, 4800, 8000].forEach(delay => setTimeout(reconcile, delay));

    window.addEventListener('pageshow', reconcile);
    window.addEventListener('focus', reconcile);
    window.addEventListener('resize', queueReconcile);
    window.addEventListener('orientationchange', () => setTimeout(reconcile, 80));

    window.v11176AuthoritativeMobileFooterVersion = VERSION;
    window.WAFFLE_MOBILE_FOOTER = Object.freeze({ version:VERSION, reconcile });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
