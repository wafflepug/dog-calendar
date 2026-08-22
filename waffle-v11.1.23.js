/* ============================================================
   WAFFLE HOUSE V11.1.23 — LEGACY CLEANUP PHASE 3
   ORGANISER NAMING + HISTORICAL PDF INTAKE
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.23';

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

  function hideLegacyWriteControl(control) {
    if (!control) return;
    control.hidden = true;
    control.setAttribute('aria-hidden', 'true');
    control.setAttribute('tabindex', '-1');
    control.style.setProperty('display', 'none', 'important');
  }

  function ensureHistoricalIntakeNote() {
    if (pageName() !== 'directory') return;
    if (document.getElementById('v11123LegacyIntakeHistoryNote')) return;

    const actions = document.querySelector('.directory-header-actions');
    if (!actions) return;

    const note = document.createElement('span');
    note.id = 'v11123LegacyIntakeHistoryNote';
    note.className = 'directory-care-summary v11123-legacy-intake-history-note';
    note.textContent = 'Historical PDF Intake · view only';
    note.title = 'Existing legacy PDF intake records remain available for history. New intake should use Digital Intake.';
    actions.insertBefore(note, actions.firstChild || null);
  }

  function retireLegacyIntakeWrites() {
    if (pageName() !== 'directory') return;

    document.querySelectorAll(
      '#openLegacyIntakeUploadBtn, [data-upload-legacy-intake], [data-reassign-legacy-intake]'
    ).forEach(hideLegacyWriteControl);

    ensureHistoricalIntakeNote();
    document.body.dataset.legacyIntakeMode = 'historical-read-only';
  }

  function showHistoricalIntakeMessage() {
    const title = 'Legacy PDF Intake is read-only';
    const body = 'Existing PDF records remain available for history. Use Digital Intake for new or updated intake information.';

    try {
      if (typeof window.showToast === 'function') {
        window.showToast(title, body, { kind: 'warning', duration: 5200 });
        return;
      }
      if (typeof showToast === 'function') {
        showToast(title, body, { kind: 'warning', duration: 5200 });
      }
    } catch (_) {}
  }

  function wireLegacyIntakeGuard() {
    if (window.v11123LegacyIntakeGuardWired) return;
    window.v11123LegacyIntakeGuardWired = true;

    document.addEventListener('click', event => {
      const blocked = event.target.closest(
        '#openLegacyIntakeUploadBtn, [data-upload-legacy-intake], [data-reassign-legacy-intake]'
      );
      if (!blocked) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      hideLegacyWriteControl(blocked);
      showHistoricalIntakeMessage();
    }, true);
  }

  function apply() {
    canonicaliseOrganiserNaming();
    retireLegacyIntakeWrites();
  }

  function start() {
    wireLegacyIntakeGuard();
    apply();

    /* Older directory/profile layers render asynchronously. Bounded passes
       remove any write controls they insert without a persistent observer. */
    [80, 220, 500, 900, 1500, 2600].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);
    window.v11123CleanupVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

/* ============================================================
   BRAND REFRESH — LIGHT / DARK HEADER LOGOS + PWA CACHE BUST
   ============================================================ */
(function () {
  'use strict';

  const BRAND_VERSION = '11.1.24';
  const LIGHT_LOGO = `waffle-logo.png?v=${BRAND_VERSION}`;
  const DARK_LOGO = `waffle-logo-dark.png?v=${BRAND_VERSION}`;

  function syncHeaderBranding() {
    const dark = document.body?.classList.contains('dark-theme');
    const source = dark ? DARK_LOGO : LIGHT_LOGO;

    document.querySelectorAll('img.calendar-brand-img, img.calendar-brand-logo').forEach(img => {
      if (img.getAttribute('src') !== source) img.setAttribute('src', source);
      img.setAttribute('data-waffle-brand-mode', dark ? 'dark' : 'light');
    });
  }

  function syncPwaMetadata() {
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.href = `manifest.webmanifest?v=${BRAND_VERSION}`;

    document.querySelectorAll('link[rel~="icon"]').forEach(link => {
      link.href = `pwa-icon-192.png?v=${BRAND_VERSION}`;
    });

    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(link => {
      link.href = `pwa-apple-touch-icon.png?v=${BRAND_VERSION}`;
    });
  }

  function applyBranding() {
    syncHeaderBranding();
    syncPwaMetadata();
  }

  function startBranding() {
    applyBranding();

    if (document.body && typeof MutationObserver === 'function') {
      const observer = new MutationObserver(mutations => {
        if (mutations.some(mutation => mutation.attributeName === 'class')) {
          syncHeaderBranding();
        }
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    window.addEventListener('pageshow', applyBranding);
    window.waffleBrandingVersion = BRAND_VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBranding, { once: true });
  } else {
    startBranding();
  }
})();
