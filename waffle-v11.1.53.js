/* ============================================================
   WAFFLE HOUSE V11.1.56 — CARE DESKTOP NATIVE ROUTING RECOVERY
   - Keeps unified Ask Waffle / Quick Action chrome.
   - Retires historical Request From controls in Waffle AI.
   - Restores desktop Care tab parity without suppressing native listeners.
   - Keeps one canonical Organiser navigation label.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.56';
  const APP_PAGES = new Set(['calendar', 'directory', 'reminders', 'audit']);
  const CARE_KEYS = ['profile', 'belongings', 'media', 'history', 'master'];
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
    if (document.getElementById('v11156-final-ui-style')) return;

    const style = document.createElement('style');
    style.id = 'v11156-final-ui-style';
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

      #v11133AskWaffleModal .request-from,
      #v11133AskWaffleModal .request-from-block,
      #v11133AskWaffleModal .request-source,
      #v11133AskWaffleModal .request-source-block,
      #v11133AskWaffleModal [data-request-from],
      #v11133AskWaffleModal [data-request-source],
      #v11133AskWaffleModal .aw37-foot ~ * {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      .app-tabs [data-page-link="reminders"] .nav-label,
      .app-tabs a[href$="reminders.html"] .nav-label {
        font-size: inherit !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      .app-tabs [data-page-link="reminders"] .nav-label::after,
      .app-tabs a[href$="reminders.html"] .nav-label::after {
        content: none !important;
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

        body[data-waffle-page="directory"] .directory-card.is-profile-active {
          position: relative !important;
          isolation: isolate !important;
        }

        body[data-waffle-page="directory"] .directory-main-profile-tabs {
          position: relative !important;
          z-index: 1000 !important;
          isolation: isolate !important;
          pointer-events: auto !important;
        }

        body[data-waffle-page="directory"] .directory-main-profile-tabs::before,
        body[data-waffle-page="directory"] .directory-main-profile-tabs::after {
          pointer-events: none !important;
        }

        body[data-waffle-page="directory"] .directory-main-profile-tab {
          position: relative !important;
          z-index: 1001 !important;
          pointer-events: auto !important;
          cursor: pointer !important;
          touch-action: manipulation !important;
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

  function removeEverythingAfterFooter() {
    const modal = document.getElementById('v11133AskWaffleModal');
    if (!modal) return false;

    const foot = modal.querySelector('.aw37-foot');
    if (!foot || !foot.parentElement) return false;

    let changed = false;
    let sibling = foot.nextElementSibling;
    while (sibling) {
      const next = sibling.nextElementSibling;
      sibling.remove();
      changed = true;
      sibling = next;
    }
    return changed;
  }

  function removeRequestFromBlock() {
    const modal = document.getElementById('v11133AskWaffleModal');
    if (!modal) return false;

    let changed = removeEverythingAfterFooter();

    modal.querySelectorAll(
      '.request-from,.request-from-block,.request-source,.request-source-block,[data-request-from],[data-request-source]'
    ).forEach(node => {
      node.remove();
      changed = true;
    });

    const candidates = Array.from(modal.querySelectorAll('*'))
      .filter(element => {
        const text = cleanText(element);
        return text.includes('request from') && providerCount(text) >= 2;
      })
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);

    const direct = candidates[0];
    if (direct && direct !== modal && !direct.classList.contains('aw37-card')) {
      direct.remove();
      return true;
    }

    const heading = Array.from(
      modal.querySelectorAll('h1,h2,h3,h4,h5,h6,label,strong,p,span,div')
    ).find(element => cleanText(element) === 'request from');

    if (!heading) return changed;

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

    heading.remove();
    return true;
  }

  function normaliseAskWaffle() {
    document.getElementById('v11133AskWaffleButton')?.remove();

    const launcher = document.getElementById('aw37launch');
    if (!launcher) return;

    launcher.classList.add(
      'float',
      'aw39-round-launch',
      'waffle-final-ui-launcher',
      'v11156-unified-launcher'
    );
    launcher.setAttribute('aria-label', 'Ask Waffle');
    launcher.setAttribute('title', 'Ask Waffle');

    if (launcher.parentElement !== document.body) {
      document.body.appendChild(launcher);
    }
  }

  function normaliseOrganiserLabels() {
    document.querySelectorAll(
      '.app-tabs [data-page-link="reminders"] .nav-label, ' +
      '.app-tabs a[href$="reminders.html"] .nav-label'
    ).forEach(label => {
      if (String(label.textContent || '').trim() !== 'Organiser') {
        label.textContent = 'Organiser';
      }
    });

    document.querySelectorAll(
      '.v1118-mobile-nav a[href$="reminders.html"] small, ' +
      '#v1118MobileNav a[href$="reminders.html"] small'
    ).forEach(label => {
      if (String(label.textContent || '').trim() !== 'Organiser') {
        label.textContent = 'Organiser';
      }
    });
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

  function normaliseCareKey(value) {
    const text = String(value || '').trim().toLowerCase();
    if (text.includes('belong')) return 'belongings';
    if (text.includes('media')) return 'media';
    if (text.includes('history')) return 'history';
    if (text.includes('master')) return 'master';
    if (text.includes('profile')) return 'profile';
    return '';
  }

  function careTabKey(button) {
    if (!button) return '';
    return normaliseCareKey(
      button.dataset?.directoryMainTab ||
      button.dataset?.v110Tab ||
      button.dataset?.profileTab ||
      button.dataset?.tab ||
      [
        button.id,
        button.className,
        button.getAttribute?.('aria-controls'),
        button.getAttribute?.('title'),
        button.textContent
      ].join(' ')
    );
  }

  function carePanelKey(panel) {
    if (!panel) return '';
    return normaliseCareKey(
      panel.dataset?.directoryMainPanel ||
      panel.dataset?.v110Panel ||
      panel.dataset?.profilePanel ||
      panel.dataset?.panel ||
      [
        panel.id,
        panel.className,
        panel.getAttribute?.('aria-labelledby')
      ].join(' ')
    );
  }

  function activeCareCard(button) {
    return button?.closest('.directory-card') ||
      document.querySelector('.directory-card.is-profile-active');
  }

  function syncCarePanels(card, key) {
    if (!card || !CARE_KEYS.includes(key)) return false;

    const panels = Array.from(card.querySelectorAll('.directory-main-profile-panel'));
    const target = panels.find(panel => carePanelKey(panel) === key);
    if (!target) return false;

    card.querySelectorAll('.directory-main-profile-tab').forEach(button => {
      const active = careTabKey(button) === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.setAttribute('tabindex', active ? '0' : '-1');
    });

    panels.forEach(panel => {
      const active = panel === target;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    return true;
  }

  function callCareNativeFallback(card, key) {
    if (!card) return false;

    if (key === 'profile' || key === 'belongings') {
      try {
        if (typeof window.switchDirectoryProfileMainTab === 'function') {
          window.switchDirectoryProfileMainTab(card, key);
          return true;
        }
      } catch (_) {}
      try {
        if (typeof switchDirectoryProfileMainTab === 'function') {
          switchDirectoryProfileMainTab(card, key);
          return true;
        }
      } catch (_) {}
    }

    if (key === 'media' || key === 'master') {
      try {
        if (typeof window.v110OpenCustomPanel === 'function') {
          window.v110OpenCustomPanel(card, key);
          return true;
        }
      } catch (_) {}
      try {
        if (typeof v110OpenCustomPanel === 'function') {
          v110OpenCustomPanel(card, key);
          return true;
        }
      } catch (_) {}
    }

    return false;
  }

  function reconcileDesktopCareTab(button, key) {
    const card = activeCareCard(button);
    if (!card || !CARE_KEYS.includes(key)) return;

    /* Native listeners are allowed to run first. Profile/Belongings and
       Media/Master then get their established router as an idempotent fallback.
       History keeps its specialised native loader and we only reconcile the
       final visible tab/panel state. */
    if (key !== 'history') callCareNativeFallback(card, key);
    syncCarePanels(card, key);
  }

  function handleDesktopCareTab(event) {
    if (pageName() !== 'directory' || isMobile()) return;
    if (!(event.target instanceof Element)) return;

    const button = event.target.closest('.directory-main-profile-tab');
    if (!button) return;

    const key = careTabKey(button);
    if (!CARE_KEYS.includes(key)) return;

    /* Do not preventDefault/stopPropagation here. Several historical layers
       own legitimate specialised loaders. Reconcile after all native listeners
       have had their turn instead of racing or suppressing them. */
    [0, 60, 180, 360].forEach(delay => {
      window.setTimeout(() => reconcileDesktopCareTab(button, key), delay);
    });
  }

  function wireDesktopCareTabs() {
    if (window.v11156DesktopCareTabsWired === true) return;
    window.v11156DesktopCareTabsWired = true;
    document.addEventListener('click', handleDesktopCareTab, false);
  }

  function apply() {
    if (!APP_PAGES.has(pageName())) return;
    ensureStyle();
    normaliseAskWaffle();
    removeRequestFromBlock();
    normaliseOrganiserLabels();
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
    wireDesktopCareTabs();
    wireObserver();
    [40, 100, 220, 500, 1000, 2200, 5000].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('resize', () => setTimeout(apply, 60));
    window.v11153UnifiedActionChromeVersion = VERSION;
    window.v11155CareTabParityVersion = VERSION;
    window.v11156CareTabParityVersion = VERSION;
  }

  ensureStyle();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
