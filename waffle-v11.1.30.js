/* ============================================================
   WAFFLE HOUSE V11.1.30 — CALENDAR + PROFILE REGRESSION RECOVERY
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.30';
  const PROFILE_ORDER = ['profile', 'belongings', 'history', 'master', 'media'];
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

  function restoreNativeCalendarStacking() {
    if (pageName() !== 'calendar') return;

    const calendar = calendarInstance();
    if (!calendar) return;

    /* PR #36 introduced a seven-item density override after FullCalendar had
       already calculated its month lanes. PR #37 changed the cap strategy but
       still left the calendar in a non-native sizing mode. Restore the default
       unlimited day-grid stacking and let FullCalendar calculate every lane. */
    try { calendar.setOption('dayMaxEvents', false); } catch (_) {}
    try { calendar.setOption('dayMaxEventRows', false); } catch (_) {}

    /* V11.1.28's bounded apply passes should not re-apply its density option. */
    try { calendar.v11128DensityVersion = '11.1.28'; } catch (_) {}

    try {
      if (typeof calendar.rerenderEvents === 'function') calendar.rerenderEvents();
    } catch (_) {}

    try {
      if (typeof calendar.updateSize === 'function') calendar.updateSize();
    } catch (_) {}

    calendar.v11130NativeStacking = VERSION;
  }

  function normaliseTabKey(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return '';
    if (text.includes('belong')) return 'belongings';
    if (text.includes('history')) return 'history';
    if (text.includes('master')) return 'master';
    if (text.includes('media')) return 'media';
    if (text.includes('profile')) return 'profile';
    return '';
  }

  function tabKey(button) {
    if (!button) return '';

    const direct =
      button.dataset?.directoryMainTab ||
      button.dataset?.v110Tab ||
      button.dataset?.profileTab ||
      '';

    if (direct) return normaliseTabKey(direct);

    return normaliseTabKey([
      button.id,
      button.className,
      button.getAttribute?.('title'),
      button.textContent
    ].join(' '));
  }

  function restoreOriginalProfileOrder(root = document) {
    if (pageName() !== 'directory') return;

    const hosts = root?.matches?.('.directory-main-profile-tabs')
      ? [root]
      : Array.from(root?.querySelectorAll?.('.directory-main-profile-tabs') || []);

    hosts.forEach(tabs => {
      const buttons = Array.from(tabs.children).filter(child => child instanceof HTMLElement);
      const ordered = PROFILE_ORDER
        .map(key => buttons.find(button => tabKey(button) === key))
        .filter(Boolean);

      const current = ordered.map(button => Array.from(tabs.children).indexOf(button));
      const alreadyOrdered = current.every((position, index) => index === 0 || position > current[index - 1]);

      /* Moving the original nodes preserves every existing listener. No new
         profile router is added here: the pre-PR36 handlers remain authoritative. */
      if (!alreadyOrdered) ordered.forEach(button => tabs.appendChild(button));

      tabs.dataset.v11130Order = PROFILE_ORDER.join('-');
    });
  }

  function wireProfileOrderRecovery() {
    if (window.v11130ProfileOrderWired) return;
    window.v11130ProfileOrderWired = true;

    document.addEventListener('click', event => {
      if (pageName() !== 'directory') return;
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('.directory-main-profile-tab')) return;

      /* V11.1.28 schedules its requested-order DOM move at 30/180ms. Run
         afterwards, purely to restore the previous visual order. */
      setTimeout(restoreOriginalProfileOrder, 70);
      setTimeout(restoreOriginalProfileOrder, 230);
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
    if (window.v11130LegacyIntakeWired) return;
    window.v11130LegacyIntakeWired = true;

    /* Phase 3 still contains its historical document-capture guard. Window
       capture executes first and routes the restored controls to the existing
       uploader without changing any Drive/Gemini/backend implementation. */
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
    restoreNativeCalendarStacking();
    restoreOriginalProfileOrder();
    restoreLegacyIntakeControls();
  }

  function start() {
    wireProfileOrderRecovery();
    wireLegacyIntakeOverride();
    apply();

    /* Beat the older bounded render/order passes without a permanent observer. */
    [70, 240, 560, 980, 1700, 2700, 3800, 4600, 5400].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.addEventListener('resize', () => setTimeout(restoreNativeCalendarStacking, 70));
    window.v11130RecoveryVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
