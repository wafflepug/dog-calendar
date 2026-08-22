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
   BRAND REFRESH — TRANSPARENT LIGHT / DARK HEADER LOGOS
   ============================================================ */
(function () {
  'use strict';

  const BRAND_VERSION = '11.1.26';
  const REPO_RAW_BASE = 'https://raw.githubusercontent.com/wafflepug/dog-calendar/main/';
  const LOGO_STYLE_ID = 'waffleThemeLogoTransparentStyle';

  function ensureTransparentLogoStyle() {
    if (document.getElementById(LOGO_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = LOGO_STYLE_ID;
    style.textContent = `
      img.calendar-brand-img,
      img.calendar-brand-logo,
      body.dark-theme img.calendar-brand-logo {
        background: transparent !important;
        background-color: transparent !important;
        box-shadow: none !important;
        border: 0 !important;
        padding: 0 !important;
        border-radius: 0 !important;
        object-fit: contain !important;
      }
    `;
    document.head.appendChild(style);
  }

  function logoCandidates(dark) {
    const file = dark ? 'waffle-logo-dark.png' : 'waffle-logo.png';
    return [
      `${file}?v=${BRAND_VERSION}`,
      `${REPO_RAW_BASE}${file}?v=${BRAND_VERSION}`
    ];
  }

  function setHeaderLogo(img, dark) {
    if (!img) return;

    const mode = dark ? 'dark' : 'light';
    const sources = logoCandidates(dark);
    const currentMode = String(img.dataset.waffleBrandMode || '');
    const currentVersion = String(img.dataset.waffleBrandVersion || '');

    img.style.setProperty('background', 'transparent', 'important');
    img.style.setProperty('background-color', 'transparent', 'important');
    img.style.setProperty('box-shadow', 'none', 'important');
    img.style.setProperty('border', '0', 'important');
    img.style.setProperty('padding', '0', 'important');
    img.style.setProperty('object-fit', 'contain', 'important');

    if (currentMode === mode && currentVersion === BRAND_VERSION && img.complete && img.naturalWidth > 0) {
      img.style.visibility = 'visible';
      return;
    }

    img.dataset.waffleBrandMode = mode;
    img.dataset.waffleBrandVersion = BRAND_VERSION;
    img.dataset.waffleBrandFallbackIndex = '0';
    img.style.visibility = 'hidden';

    img.onload = function () {
      this.style.visibility = 'visible';
    };

    img.onerror = function () {
      const nextIndex = Number(this.dataset.waffleBrandFallbackIndex || '0') + 1;
      this.dataset.waffleBrandFallbackIndex = String(nextIndex);

      if (nextIndex < sources.length) {
        this.src = sources[nextIndex];
        return;
      }

      /* Never fall back to the opposite-theme PWA icon. If both copies of the
         requested theme logo fail, hide the image rather than showing the
         wrong badge or exposing broken-image alt text. */
      this.onerror = null;
      this.style.visibility = 'hidden';
    };

    img.src = sources[0];
  }

  function syncHeaderBranding() {
    ensureTransparentLogoStyle();
    const dark = document.body?.classList.contains('dark-theme');

    document.querySelectorAll('img.calendar-brand-img, img.calendar-brand-logo').forEach(img => {
      setHeaderLogo(img, dark);
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

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        requestAnimationFrame(syncHeaderBranding);
        setTimeout(syncHeaderBranding, 40);
      });
    }

    window.addEventListener('pageshow', applyBranding);
    window.addEventListener('online', applyBranding);
    window.waffleBrandingVersion = BRAND_VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBranding, { once: true });
  } else {
    startBranding();
  }
})();
