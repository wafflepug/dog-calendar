/* ============================================================
   WAFFLE HOUSE V11.1.77 — AUTHORITATIVE MOBILE FOOTER AVATARS
   ------------------------------------------------------------
   Canonical mobile footer:
   Today · Calendar · Add · Care · Ask Waffle

   - keeps legacy mobile footers retired;
   - uses the supplied Waffle Add artwork for the centre Add action;
   - reuses the canonical Ask Waffle smile avatar used by the assistant launcher;
   - removes the separate floating Ask Waffle launcher from mobile presentation;
   - self-heals if a historical enhancement pass removes or recreates footer UI.

   Compatibility note: this authority remains in waffle-v11.1.76.js because the
   shared loader already treats that file as the final footer authority.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.77';
  const MOBILE_QUERY = '(max-width: 820px)';
  const LAYOUT = 'today-calendar-add-care-ask';
  const ADD_AVATAR = 'waffle-add-avatar-v1177.svg?v=11.1.77';
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
    if (page === 'directory') return 'directory';
    return '';
  }

  function ensureStyle() {
    if (document.getElementById('wh77MobileFooterStyle')) return;
    const style = document.createElement('style');
    style.id = 'wh77MobileFooterStyle';
    style.textContent = `
      @media (max-width:820px) {
        body #aw37launch,
        body #v11133AskWaffleButton {
          display:none!important;
          visibility:hidden!important;
          pointer-events:none!important;
        }
        #wh75MobileBottomNav {
          grid-template-columns:repeat(5,minmax(0,1fr))!important;
        }
        #wh75MobileBottomNav .wh77-bottom-add .wh75-bottom-icon {
          width:48px!important;
          height:48px!important;
          min-width:48px!important;
          margin-top:-21px!important;
          padding:0!important;
          border-radius:15px!important;
          overflow:hidden!important;
          background:transparent!important;
          box-shadow:0 8px 22px var(--wh75-ring)!important;
        }
        #wh75MobileBottomNav .wh77-add-avatar {
          display:block!important;
          width:48px!important;
          height:48px!important;
          object-fit:cover!important;
          border-radius:15px!important;
        }
        #wh75MobileBottomNav .wh77-ask-avatar {
          display:block;
          width:34px;
          height:34px;
          object-fit:cover;
          border-radius:50%;
          box-shadow:0 0 0 2px var(--wh75-ring);
        }
        #wh75MobileBottomNav .wh77-ask-avatar[hidden] {
          display:none!important;
        }
        #wh75MobileBottomNav .wh77-bottom-ask .wh75-bottom-icon {
          height:36px;
          min-width:36px;
        }
      }
    `;
    document.head.appendChild(style);
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

  function suppressFloatingAskLauncher() {
    document.querySelectorAll('#aw37launch,#v11133AskWaffleButton').forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      if (isMobile()) {
        node.dataset.wh77MobileLauncherRetired = 'true';
        node.setAttribute('aria-hidden', 'true');
        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
      } else if (node.dataset.wh77MobileLauncherRetired === 'true') {
        delete node.dataset.wh77MobileLauncherRetired;
        node.removeAttribute('aria-hidden');
        node.style.display = '';
        node.style.visibility = '';
        node.style.pointerEvents = '';
      }
    });
  }

  function bottomMarkup() {
    return [
      '<a class="wh75-bottom-item" href="index.html?view=today" data-wh75-route="today"><span class="wh75-bottom-icon" aria-hidden="true">⌂</span><span>Today</span></a>',
      '<a class="wh75-bottom-item" href="index.html?view=calendar" data-wh75-route="calendar"><span class="wh75-bottom-icon" aria-hidden="true">▦</span><span>Calendar</span></a>',
      `<button class="wh75-bottom-item wh75-bottom-add wh77-bottom-add" type="button" data-wh77-quick-add aria-label="Add"><span class="wh75-bottom-icon"><img class="wh77-add-avatar" src="${ADD_AVATAR}" alt=""></span><span>Add</span></button>`,
      '<a class="wh75-bottom-item" href="directory.html" data-wh75-route="directory"><span class="wh75-bottom-icon" aria-hidden="true">🐾</span><span>Care</span></a>',
      '<button class="wh75-bottom-item wh77-bottom-ask" type="button" data-wh77-ask aria-label="Ask Waffle"><span class="wh75-bottom-icon"><img class="wh77-ask-avatar" data-wh77-ask-avatar alt="Waffle" hidden></span><span>Ask Waffle</span></button>'
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
    const modal = document.getElementById('v11133AskWaffleModal');
    if (modal) {
      modal.hidden = false;
      modal.querySelector('input')?.focus();
      return;
    }
    const launcher = document.getElementById('aw37launch') || document.getElementById('v11133AskWaffleButton');
    if (launcher) {
      launcher.click();
      return;
    }
    window.dispatchEvent(new CustomEvent('waffle:ask-open-request'));
  }

  function wireBottom(nav) {
    if (!nav || nav.dataset.wh77Wired === 'true') return;
    nav.dataset.wh77Wired = 'true';
    nav.querySelector('[data-wh77-quick-add]')?.addEventListener('click', triggerQuickAdd);
    nav.querySelector('[data-wh77-ask]')?.addEventListener('click', triggerAskWaffle);
  }

  function askAvatarSource() {
    const asset = String(window.WAFFLE_AI_ASSETS?.icon || '').trim();
    if (asset) return asset;
    const launcherImage = document.querySelector('#aw37launch img,#v11133AskWaffleButton img');
    return String(launcherImage?.src || '').trim();
  }

  function syncAskAvatar(nav) {
    const image = (nav || document).querySelector?.('[data-wh77-ask-avatar]');
    if (!image) return;
    const source = askAvatarSource();
    if (!source) {
      image.hidden = true;
      return;
    }
    if (image.src !== source) image.src = source;
    image.hidden = false;
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

  function ensureCanonicalMarkup(nav) {
    if (!nav) return;
    if (nav.dataset.wh77Layout === LAYOUT && nav.querySelector('[data-wh77-quick-add]') && nav.querySelector('[data-wh77-ask]')) return;
    nav.innerHTML = bottomMarkup();
    nav.dataset.wh77Layout = LAYOUT;
    delete nav.dataset.wh77Wired;
    wireBottom(nav);
  }

  function ensureBottomNav() {
    if (!document.body) return null;

    let nav = document.getElementById('wh75MobileBottomNav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'wh75MobileBottomNav';
      nav.setAttribute('aria-label', 'Primary mobile navigation');
      nav.dataset.wh76Restored = 'true';
      document.body.appendChild(nav);
    }

    if (nav.parentElement !== document.body) document.body.appendChild(nav);
    ensureCanonicalMarkup(nav);
    wireBottom(nav);

    if (isMobile()) {
      nav.hidden = false;
      nav.removeAttribute('aria-hidden');
      nav.inert = false;
      nav.dataset.wh77ForcedMobile = 'true';
      nav.style.setProperty('display', 'grid', 'important');
      nav.style.setProperty('visibility', 'visible', 'important');
      nav.style.setProperty('pointer-events', 'auto', 'important');
      nav.style.setProperty('position', 'fixed', 'important');
      nav.style.setProperty('left', '0', 'important');
      nav.style.setProperty('right', '0', 'important');
      nav.style.setProperty('bottom', '0', 'important');
      nav.style.setProperty('z-index', '2147481795', 'important');
    } else if (nav.dataset.wh77ForcedMobile === 'true') {
      delete nav.dataset.wh77ForcedMobile;
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
    syncAskAvatar(nav);
    return nav;
  }

  function reconcile() {
    if (!document.body) return;
    ensureStyle();
    suppressAllLegacyFooters();
    suppressFloatingAskLauncher();
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
            return node.matches?.(LEGACY_SELECTOR + ',#wh75MobileBottomNav,#aw37launch,#v11133AskWaffleButton') ||
              !!node.querySelector?.(LEGACY_SELECTOR + ',#wh75MobileBottomNav,#aw37launch,#v11133AskWaffleButton');
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
    window.v11177MobileFooterAvatarVersion = VERSION;
    window.WAFFLE_MOBILE_FOOTER = Object.freeze({ version:VERSION, reconcile, layout:LAYOUT });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
