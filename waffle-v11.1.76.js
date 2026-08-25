/* ============================================================
   WAFFLE HOUSE V11.1.78 — UNIFORM MOBILE FOOTER AVATARS
   ------------------------------------------------------------
   Canonical mobile footer:
   Today · Calendar · Add · Care · Waffle AI

   - all five footer icons use the same circular avatar treatment;
   - Today / Calendar / Care use the sitter-supplied artwork;
   - Add keeps the supplied Waffle Add artwork in a circular shell;
   - Ask Waffle is renamed Waffle AI and reuses the canonical smile avatar;
   - the separate floating Ask Waffle launcher stays retired on mobile;
   - legacy mobile footers stay suppressed and the canonical footer self-heals.

   Compatibility note: this authority remains in waffle-v11.1.76.js because the
   shared loader already treats that file as the final mobile-footer authority.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.78';
  const MOBILE_QUERY = '(max-width: 820px)';
  const LAYOUT = 'today-calendar-add-care-waffle-ai';
  const TODAY_AVATAR = 'waffle-today-avatar-v1178.svg?v=11.1.78';
  const CALENDAR_AVATAR = 'waffle-calendar-avatar-v1178.svg?v=11.1.78';
  const ADD_AVATAR = 'waffle-add-avatar-v1177.svg?v=11.1.78';
  const CARE_AVATAR = 'waffle-care-avatar-v1178.svg?v=11.1.78';
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
    if (document.getElementById('wh78MobileFooterStyle')) return;
    document.getElementById('wh77MobileFooterStyle')?.remove();
    const style = document.createElement('style');
    style.id = 'wh78MobileFooterStyle';
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
        #wh75MobileBottomNav .wh75-bottom-item {
          min-width:0!important;
        }
        #wh75MobileBottomNav .wh75-bottom-icon.wh78-avatar-shell {
          display:grid!important;
          place-items:center!important;
          width:42px!important;
          height:42px!important;
          min-width:42px!important;
          min-height:42px!important;
          padding:0!important;
          margin:0 auto 4px!important;
          border-radius:50%!important;
          overflow:hidden!important;
          background:color-mix(in srgb,var(--wh75-panel,#132139) 88%,#fff 12%)!important;
          box-shadow:0 0 0 2px var(--wh75-ring),0 6px 16px rgba(0,0,0,.18)!important;
        }
        #wh75MobileBottomNav .wh78-nav-avatar {
          display:block!important;
          width:100%!important;
          height:100%!important;
          max-width:none!important;
          object-fit:cover!important;
          border-radius:50%!important;
        }
        #wh75MobileBottomNav .wh78-nav-avatar[hidden] {
          display:none!important;
        }
        #wh75MobileBottomNav .wh75-bottom-add .wh75-bottom-icon.wh78-avatar-shell {
          width:44px!important;
          height:44px!important;
          min-width:44px!important;
          min-height:44px!important;
        }
        #wh75MobileBottomNav .wh75-bottom-item.is-active .wh78-avatar-shell {
          box-shadow:0 0 0 3px var(--wh75-accent,#b86cff),0 7px 18px var(--wh75-ring)!important;
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
        node.dataset.wh78MobileLauncherRetired = 'true';
        node.setAttribute('aria-hidden', 'true');
        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
      } else if (node.dataset.wh78MobileLauncherRetired === 'true') {
        delete node.dataset.wh78MobileLauncherRetired;
        node.removeAttribute('aria-hidden');
        node.style.display = '';
        node.style.visibility = '';
        node.style.pointerEvents = '';
      }
    });
  }

  function avatarMarkup(src, alt, extra) {
    return `<span class="wh75-bottom-icon wh78-avatar-shell" aria-hidden="true"><img class="wh78-nav-avatar ${extra || ''}" src="${src}" alt="${alt || ''}"></span>`;
  }

  function bottomMarkup() {
    return [
      `<a class="wh75-bottom-item" href="index.html?view=today" data-wh75-route="today">${avatarMarkup(TODAY_AVATAR, '')}<span>Today</span></a>`,
      `<a class="wh75-bottom-item" href="index.html?view=calendar" data-wh75-route="calendar">${avatarMarkup(CALENDAR_AVATAR, '')}<span>Calendar</span></a>`,
      `<button class="wh75-bottom-item wh75-bottom-add" type="button" data-wh78-quick-add aria-label="Add">${avatarMarkup(ADD_AVATAR, '')}<span>Add</span></button>`,
      `<a class="wh75-bottom-item" href="directory.html" data-wh75-route="directory">${avatarMarkup(CARE_AVATAR, '')}<span>Care</span></a>`,
      '<button class="wh75-bottom-item wh78-bottom-ai" type="button" data-wh78-ai aria-label="Waffle AI"><span class="wh75-bottom-icon wh78-avatar-shell" aria-hidden="true"><img class="wh78-nav-avatar" data-wh78-ai-avatar alt="" hidden></span><span>Waffle AI</span></button>'
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

  function triggerWaffleAI() {
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
    if (!nav || nav.dataset.wh78Wired === 'true') return;
    nav.dataset.wh78Wired = 'true';
    nav.querySelector('[data-wh78-quick-add]')?.addEventListener('click', triggerQuickAdd);
    nav.querySelector('[data-wh78-ai]')?.addEventListener('click', triggerWaffleAI);
  }

  function aiAvatarSource() {
    const asset = String(window.WAFFLE_AI_ASSETS?.icon || '').trim();
    if (asset) return asset;
    const launcherImage = document.querySelector('#aw37launch img,#v11133AskWaffleButton img');
    return String(launcherImage?.src || '').trim();
  }

  function syncAIAvatar(nav) {
    const image = (nav || document).querySelector?.('[data-wh78-ai-avatar]');
    if (!image) return;
    const source = aiAvatarSource();
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
    if (nav.dataset.wh78Layout === LAYOUT && nav.querySelector('[data-wh78-quick-add]') && nav.querySelector('[data-wh78-ai]')) return;
    nav.innerHTML = bottomMarkup();
    nav.dataset.wh78Layout = LAYOUT;
    delete nav.dataset.wh78Wired;
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
      nav.dataset.wh78ForcedMobile = 'true';
      nav.style.setProperty('display', 'grid', 'important');
      nav.style.setProperty('visibility', 'visible', 'important');
      nav.style.setProperty('pointer-events', 'auto', 'important');
      nav.style.setProperty('position', 'fixed', 'important');
      nav.style.setProperty('left', '0', 'important');
      nav.style.setProperty('right', '0', 'important');
      nav.style.setProperty('bottom', '0', 'important');
      nav.style.setProperty('z-index', '2147481795', 'important');
    } else if (nav.dataset.wh78ForcedMobile === 'true') {
      delete nav.dataset.wh78ForcedMobile;
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
    syncAIAvatar(nav);
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
    window.v11178UniformMobileFooterVersion = VERSION;
    window.WAFFLE_MOBILE_FOOTER = Object.freeze({ version:VERSION, reconcile, layout:LAYOUT });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();

/* V11.1.80 — load the final mobile Calendar header authority after the footer. */
(function () {
  'use strict';
  if (window.v11180MobileHeaderRailVersion) return;
  const existing = Array.from(document.scripts).find(script => String(script.src || '').includes('/waffle-v11.1.80.js'));
  if (existing) return;
  const script = document.createElement('script');
  script.src = 'waffle-v11.1.80.js?v=11.1.80';
  script.async = false;
  script.dataset.waffleV11180 = 'true';
  document.head.appendChild(script);
})();
