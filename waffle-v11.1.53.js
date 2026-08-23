/* ============================================================
   WAFFLE HOUSE V11.1.53 — UNIFIED ACTION CHROME + MODAL RETIREMENT
   Calendar, Care, Organiser and Logs share one canonical Ask Waffle +
   Quick Action layout, and retired Request From controls are removed everywhere.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.53';
  const APP_PAGES = new Set(['calendar', 'directory', 'reminders', 'audit']);
  let observer = null;
  let frame = 0;

  function pageName() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      'calendar'
    );
  }

  function isMobile() {
    return !!window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  function ensureStyle() {
    if (document.getElementById('v11153-unified-action-chrome-style')) return;

    const style = document.createElement('style');
    style.id = 'v11153-unified-action-chrome-style';
    style.textContent = `
      body[data-waffle-page="calendar"] #aw37launch,
      body[data-waffle-page="directory"] #aw37launch,
      body[data-waffle-page="reminders"] #aw37launch,
      body[data-waffle-page="audit"] #aw37launch {
        position: fixed !important;
        right: 18px !important;
        bottom: 22px !important;
        width: 52px !important;
        height: 52px !important;
        min-width: 52px !important;
        min-height: 52px !important;
        max-width: 52px !important;
        padding: 0 !important;
        gap: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 50% !important;
        z-index: 2147481000 !important;
      }

      body[data-waffle-page="calendar"] #aw37launch > span,
      body[data-waffle-page="directory"] #aw37launch > span,
      body[data-waffle-page="reminders"] #aw37launch > span,
      body[data-waffle-page="audit"] #aw37launch > span {
        display: none !important;
      }

      body[data-waffle-page="calendar"] #aw37launch > img,
      body[data-waffle-page="directory"] #aw37launch > img,
      body[data-waffle-page="reminders"] #aw37launch > img,
      body[data-waffle-page="audit"] #aw37launch > img {
        width: 40px !important;
        height: 40px !important;
        object-fit: contain !important;
      }

      body[data-waffle-page="calendar"] #v11133AskWaffleButton,
      body[data-waffle-page="directory"] #v11133AskWaffleButton,
      body[data-waffle-page="reminders"] #v11133AskWaffleButton,
      body[data-waffle-page="audit"] #v11133AskWaffleButton {
        display: none !important;
      }

      /* Retired provider/source selector. These selectors cover any structured
         version; the text-based remover below catches historical unclassed DOM. */
      #v11133AskWaffleModal .request-from,
      #v11133AskWaffleModal .request-from-block,
      #v11133AskWaffleModal .request-source,
      #v11133AskWaffleModal .request-source-block,
      #v11133AskWaffleModal [data-request-from],
      #v11133AskWaffleModal [data-request-source] {
        display: none !important;
      }

      @media (min-width: 769px) {
        body[data-waffle-page="calendar"] .v10-quick-add-button:not(.v1088-nav-quick-add),
        body[data-waffle-page="directory"] .v10-quick-add-button:not(.v1088-nav-quick-add),
        body[data-waffle-page="reminders"] .v10-quick-add-button:not(.v1088-nav-quick-add),
        body[data-waffle-page="audit"] .v10-quick-add-button:not(.v1088-nav-quick-add) {
          position: fixed !important;
          right: 18px !important;
          bottom: 96px !important;
          z-index: 2147480999 !important;
        }
      }

      @media (max-width: 768px) {
        body[data-waffle-page="calendar"] #aw37launch,
        body[data-waffle-page="directory"] #aw37launch,
        body[data-waffle-page="reminders"] #aw37launch,
        body[data-waffle-page="audit"] #aw37launch {
          right: 12px !important;
          bottom: calc(88px + env(safe-area-inset-bottom)) !important;
        }

        body .app-tabs > .v10-quick-add-button.v1088-nav-quick-add,
        body .app-tabs > .v10-quick-add-button.v11122-nav-add {
          position: relative !important;
          top: auto !important;
          right: auto !important;
          bottom: auto !important;
          left: auto !important;
          inset: auto !important;
          transform: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function cleanText(element) {
    return String(element?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function providerCount(text) {
    return ['madpaw', 'pawshake', 'facebook', 'other']
      .reduce((count, provider) => count + (text.includes(provider) ? 1 : 0), 0);
  }

  function removeRequestFromBlock() {
    const modal = document.getElementById('v11133AskWaffleModal');
    if (!modal) return false;

    modal.querySelectorAll(
      '.request-from,.request-from-block,.request-source,.request-source-block,[data-request-from],[data-request-source]'
    ).forEach(node => node.remove());

    const directCandidates = Array.from(modal.querySelectorAll('*'))
      .filter(element => {
        const text = cleanText(element);
        return text.includes('request from') && providerCount(text) >= 2;
      })
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);

    const direct = directCandidates[0];
    if (direct && direct !== modal && !direct.classList.contains('aw37-card')) {
      direct.remove();
      return true;
    }

    const heading = Array.from(
      modal.querySelectorAll('h1,h2,h3,h4,h5,h6,label,strong,p,span,div')
    ).find(element => cleanText(element) === 'request from');

    if (!heading) return false;

    let candidate = heading.parentElement;
    for (let depth = 0; candidate && depth < 6; depth += 1) {
      if (candidate === modal || candidate.classList.contains('aw37-card')) break;

      const text = cleanText(candidate);
      const controls = candidate.querySelectorAll(
        'button,label,input,[role="radio"],[role="button"]'
      ).length;

      if (providerCount(text) >= 2 || controls >= 3) {
        candidate.remove();
        return true;
      }

      candidate = candidate.parentElement;
    }

    /* Last-resort cleanup for the historical markup shown in Organiser/Logs:
       remove the heading and its immediately following provider-control group. */
    const parent = heading.parentElement;
    if (parent && parent !== modal && !parent.classList.contains('aw37-card')) {
      heading.remove();
      const next = parent.firstElementChild;
      if (next && providerCount(cleanText(next)) >= 2) next.remove();
      if (!cleanText(parent)) parent.remove();
      return true;
    }

    return false;
  }

  function normaliseAskWaffle() {
    document.getElementById('v11133AskWaffleButton')?.remove();

    const launcher = document.getElementById('aw37launch');
    if (!launcher) return;

    launcher.classList.add('float', 'aw39-round-launch', 'waffle-final-ui-launcher', 'v11153-unified-launcher');
    launcher.setAttribute('aria-label', 'Ask Waffle');
    launcher.setAttribute('title', 'Ask Waffle');

    if (launcher.parentElement !== document.body) {
      document.body.appendChild(launcher);
    }
  }

  function dockMobileQuickAdd() {
    if (!isMobile()) return;

    try {
      if (typeof window.v1088DockQuickAddButton === 'function') {
        window.v1088DockQuickAddButton();
      } else if (typeof v1088DockQuickAddButton === 'function') {
        v1088DockQuickAddButton();
      }
    } catch (_) {}

    const nav = document.querySelector('.app-tabs');
    const button = document.getElementById('v10QuickAddButton');
    if (!nav || !button) return;

    if (button.parentElement !== nav) {
      const organiser = nav.querySelector('[data-page-link="reminders"], a[href$="reminders.html"]');
      nav.insertBefore(button, organiser || null);
    }

    button.classList.add('v1088-nav-quick-add', 'v11122-nav-add');
    nav.classList.add('v1088-has-quick-add', 'v11122-unified-nav');

    ['top', 'right', 'bottom', 'left', 'inset', 'transform'].forEach(property => {
      button.style.removeProperty(property);
    });
  }

  function normaliseDesktopQuickAdd() {
    if (isMobile()) return;
    const button = document.getElementById('v10QuickAddButton');
    if (!button) return;

    button.classList.remove('v1088-nav-quick-add', 'v11122-nav-add');
    if (button.parentElement?.classList?.contains('app-tabs')) {
      document.body.appendChild(button);
    }
  }

  function apply() {
    if (!APP_PAGES.has(pageName())) return;
    ensureStyle();
    normaliseAskWaffle();
    removeRequestFromBlock();
    if (isMobile()) dockMobileQuickAdd();
    else normaliseDesktopQuickAdd();
  }

  function queueApply() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  }

  function wireObserver() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(queueApply);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  function start() {
    apply();
    wireObserver();
    [40, 100, 220, 500, 1000, 2200, 5000].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('resize', () => setTimeout(apply, 60));
    window.v11153UnifiedActionChromeVersion = VERSION;
  }

  /* Load before the historical Ask Waffle creator when possible so its CSS and
     modal-retirement observer are ready before legacy UI is inserted. */
  ensureStyle();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
