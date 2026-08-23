/* ============================================================
   WAFFLE HOUSE V11.1.44 — CALENDAR + PROFILE REGRESSION RECOVERY
   ============================================================
   V11.1.30 originally also restored the legacy PDF Intake write controls.
   That behaviour now conflicts with the canonical historical/read-only Care
   experience and caused the header to alternate between old and new states.

   This recovery layer now owns only the two behaviours that are still needed:
   - native Calendar stacking recovery;
   - original Care profile-tab ordering.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.44';
  const PROFILE_ORDER = ['profile', 'belongings', 'history', 'master', 'media'];

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

    try { calendar.setOption('dayMaxEvents', false); } catch (_) {}
    try { calendar.setOption('dayMaxEventRows', false); } catch (_) {}

    /* Keep V11.1.28 from re-applying its previous density override. */
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

      /* Moving the original nodes preserves the established click listeners. */
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

      setTimeout(restoreOriginalProfileOrder, 70);
      setTimeout(restoreOriginalProfileOrder, 230);
    });
  }

  function apply() {
    restoreNativeCalendarStacking();
    restoreOriginalProfileOrder();
  }

  function start() {
    wireProfileOrderRecovery();
    apply();

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
