/* ============================================================
   WAFFLE HOUSE V11.1.23 — ORGANISER NAMING + ACTIVE LEGACY INTAKE
   ============================================================
   Phase 3 originally retired Legacy PDF Intake writes. That workflow remains
   valid and is restored here. The later V11.1.27 branding layer is now the
   sole authority for header logos, so the superseded branding code that used
   to live in this file is intentionally removed.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.23-active-intake';

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function canonicaliseOrganiserNaming() {
    document.querySelectorAll('a[href$="reminders.html"] .nav-label, a[href$="reminders.html"] small')
      .forEach(label => { label.textContent = 'Organiser'; });

    if (pageName() !== 'reminders') return;

    document.body.dataset.waffleSection = 'organiser';
    document.title = 'Waffle House — Organiser';

    const legacyHeading = document.querySelector('#remindersTabPanel .reminders-header h3');
    if (legacyHeading && /reminders?\s*&?\s*notes?/i.test(String(legacyHeading.textContent || ''))) {
      legacyHeading.textContent = '📌 Organiser';
    }

    const legacyIntro = document.querySelector('#remindersTabPanel .reminders-header p');
    if (legacyIntro && /sticky notes|reminder date/i.test(String(legacyIntro.textContent || ''))) {
      legacyIntro.textContent = 'Shared Waffle House workspace for notes, tasks and day-to-day organisation.';
    }
  }

  function restoreLegacyWriteControl(control) {
    if (!control) return;
    control.hidden = false;
    control.removeAttribute('aria-hidden');
    control.removeAttribute('tabindex');
    control.style.removeProperty('display');
  }

  function restoreLegacyIntakeWrites() {
    if (pageName() !== 'directory') return;

    /* Remove the Phase 3 view-only banner and restore the exact controls owned
       by the existing Legacy PDF Intake workflow. No uploader/backend logic is
       duplicated here; the original handlers remain authoritative. */
    document.getElementById('v11123LegacyIntakeHistoryNote')?.remove();

    document.querySelectorAll(
      '#openLegacyIntakeUploadBtn, [data-upload-legacy-intake], [data-reassign-legacy-intake]'
    ).forEach(restoreLegacyWriteControl);

    document.body.dataset.legacyIntakeMode = 'active';
  }

  function apply() {
    canonicaliseOrganiserNaming();
    restoreLegacyIntakeWrites();
  }

  function start() {
    apply();

    /* Older directory/profile layers insert their controls asynchronously.
       Bounded passes restore those controls without adding a permanent DOM
       observer or replacing any existing Legacy Intake handlers. */
    [80, 220, 500, 900, 1500, 2600, 4200].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.v11123CleanupVersion = VERSION;
    window.v11123RestoreLegacyIntake = restoreLegacyIntakeWrites;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
