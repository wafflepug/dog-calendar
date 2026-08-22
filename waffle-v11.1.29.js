/* ============================================================
   WAFFLE HOUSE V11.1.29 — PR36 REGRESSION HOTFIX
   CALENDAR LAYOUT + PROFILE TAB ACTIONS + LEGACY PDF INTAKE
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.29';
  const PROFILE_ORDER = ['profile', 'belongings', 'media', 'history', 'master'];
  const LEGACY_INTAKE_SELECTOR =
    '#openLegacyIntakeUploadBtn, [data-upload-legacy-intake], [data-reassign-legacy-intake]';

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function calendarInstance() {
    try {
      if (window.globalCalendar && typeof window.globalCalendar.setOption === 'function') {
        return window.globalCalendar;
      }
    } catch (_) {}

    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar && typeof globalCalendar.setOption === 'function') {
        return globalCalendar;
      }
    } catch (_) {}

    return null;
  }

  function repairCalendarDensity() {
    if (pageName() !== 'calendar') return;

    const calendar = calendarInstance();
    if (!calendar) return;

    /* V11.1.28 used dayMaxEvents=7 and also added margin directly to
       FullCalendar's event harness. Multi-day rows use those harnesses for
       positioning, so the combination could visually collide. Keep the
       requested seven-row density limit, but let FullCalendar own all lane
       positioning and use its row-aware overflow algorithm. */
    try { calendar.setOption('dayMaxEvents', false); } catch (_) {}
    try { calendar.setOption('dayMaxEventRows', 7); } catch (_) {}
    try { calendar.setOption('moreLinkClick', 'popover'); } catch (_) {}

    try {
      if (typeof calendar.updateSize === 'function') calendar.updateSize();
    } catch (_) {}

    calendar.v11129DensityVersion = VERSION;
  }

  function normaliseKey(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return '';
    if (text.includes('belong')) return 'belongings';
    if (text.includes('media')) return 'media';
    if (text.includes('history')) return 'history';
    if (text.includes('master')) return 'master';
    if (text.includes('profile')) return 'profile';
    return text.replace(/[^a-z0-9_-]+/g, '-');
  }

  function tabKey(button) {
    if (!button) return '';

    const direct =
      button.dataset?.directoryMainTab ||
      button.dataset?.v110Tab ||
      button.dataset?.profileTab ||
      button.dataset?.tab ||
      '';

    if (direct) return normaliseKey(direct);

    const identity = [
      button.id,
      button.className,
      button.getAttribute?.('aria-controls'),
      button.getAttribute?.('title'),
      button.textContent
    ].join(' ');

    return normaliseKey(identity);
  }

  function panelKey(panel) {
    if (!panel) return '';

    const direct =
      panel.dataset?.directoryMainPanel ||
      panel.dataset?.v110Panel ||
      panel.dataset?.profilePanel ||
      panel.dataset?.panel ||
      '';

    if (direct) return normaliseKey(direct);

    const identity = [
      panel.id,
      panel.className,
      panel.getAttribute?.('aria-labelledby')
    ].join(' ');

    return normaliseKey(identity);
  }

  function reorderProfileTabs(root = document) {
    if (pageName() !== 'directory') return;

    const hosts = root?.matches?.('.directory-main-profile-tabs')
      ? [root]
      : Array.from(root?.querySelectorAll?.('.directory-main-profile-tabs') || []);

    hosts.forEach(tabs => {
      const buttons = Array.from(tabs.children).filter(child => child instanceof HTMLElement);
      const desired = PROFILE_ORDER
        .map(key => buttons.find(button => tabKey(button) === key))
        .filter(Boolean);

      /* Only move nodes when the order is actually wrong. This preserves any
         per-button listeners added by older profile layers and avoids repeated
         detach/append work after every click. */
      const current = desired.map(button => Array.from(tabs.children).indexOf(button));
      const alreadyOrdered = current.every((position, index) => index === 0 || position > current[index - 1]);
      if (!alreadyOrdered) desired.forEach(button => tabs.appendChild(button));

      tabs.dataset.v11129Order = PROFILE_ORDER.join('-');
    });
  }

  function syncPanelVisibility(card, key) {
    if (!card || !key) return;

    const buttons = Array.from(card.querySelectorAll('.directory-main-profile-tab'));
    const panels = Array.from(card.querySelectorAll('.directory-main-profile-panel'));
    const targetPanel = panels.find(panel => panelKey(panel) === key);

    if (!targetPanel) return;

    buttons.forEach(button => {
      const active = tabKey(button) === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) button.setAttribute('tabindex', '0');
      else button.setAttribute('tabindex', '-1');
    });

    panels.forEach(panel => {
      const active = panel === targetPanel;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
  }

  function callNativeProfileRouter(card, key) {
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

  function routeProfileTab(button) {
    if (!button || pageName() !== 'directory') return;

    const card = button.closest('.directory-card');
    const key = tabKey(button);
    if (!card || !PROFILE_ORDER.includes(key)) return;

    /* Let the historical delegated/direct listeners run first. Then call the
       known canonical routers as a fallback and finally reconcile the visible
       panel. This repairs Profile/Belongings/Media/Master while preserving any
       specialised History handler already attached to its original node. */
    setTimeout(() => {
      callNativeProfileRouter(card, key);
      syncPanelVisibility(card, key);
      reorderProfileTabs(card);
    }, 0);

    setTimeout(() => {
      syncPanelVisibility(card, key);
      reorderProfileTabs(card);
    }, 90);
  }

  function wireProfileTabs() {
    if (window.v11129ProfileTabsWired) return;
    window.v11129ProfileTabsWired = true;

    document.addEventListener('click', event => {
      const button = event.target instanceof Element
        ? event.target.closest('.directory-main-profile-tab')
        : null;
      if (!button) return;
      routeProfileTab(button);
    });
  }

  function restoreLegacyIntakeControls() {
    if (pageName() !== 'directory') return;

    document.getElementById('v11123LegacyIntakeHistoryNote')?.remove();

    document.querySelectorAll(LEGACY_INTAKE_SELECTOR).forEach(control => {
      control.hidden = false;
      control.removeAttribute('aria-hidden');
      control.removeAttribute('tabindex');
      control.style.removeProperty('display');
    });

    if (document.body) document.body.dataset.legacyIntakeMode = 'active';
  }

  function legacyIntakeUploader() {
    try {
      if (typeof window.openLegacyIntakeUploader === 'function') return window.openLegacyIntakeUploader;
    } catch (_) {}

    try {
      if (typeof openLegacyIntakeUploader === 'function') return openLegacyIntakeUploader;
    } catch (_) {}

    return null;
  }

  function wireLegacyIntakeOverride() {
    if (window.v11129LegacyIntakeWired) return;
    window.v11129LegacyIntakeWired = true;

    /* PR #31 installed a document-capture read-only guard. Window capture runs
       before that guard, so the restored controls can call the original
       uploader directly without duplicating any upload/backend behaviour. */
    window.addEventListener('click', event => {
      if (pageName() !== 'directory') return;

      const target = event.target instanceof Element
        ? event.target.closest(LEGACY_INTAKE_SELECTOR)
        : null;
      if (!target) return;

      const uploader = legacyIntakeUploader();
      if (!uploader) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const card = target.closest('.directory-card');
      const stayKey = String(card?.dataset?.directoryStayKey || '');
      const documentId = target.matches('[data-reassign-legacy-intake]')
        ? String(target.dataset?.legacyDocumentId || '')
        : '';

      try {
        if (target.id === 'openLegacyIntakeUploadBtn') uploader();
        else uploader(stayKey, documentId);
      } catch (error) {
        console.error('Legacy PDF Intake could not be opened:', error);
      }
    }, true);
  }

  function apply() {
    repairCalendarDensity();
    reorderProfileTabs();
    restoreLegacyIntakeControls();
  }

  function start() {
    wireProfileTabs();
    wireLegacyIntakeOverride();
    apply();

    /* The earlier Phase 3 layer has bounded passes through 2.6s. Keep later
       final passes so its old read-only styling cannot win after V11.1.29. */
    [60, 180, 420, 850, 1500, 2800, 4200, 5200].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('resize', () => setTimeout(repairCalendarDensity, 60));
    window.v11129HotfixVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
