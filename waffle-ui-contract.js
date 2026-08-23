/* ============================================================
   WAFFLE HOUSE — FINAL UI CONTRACT
   Version 11.1.51

   Purpose
   -------
   Waffle House historically evolved through additive UI patches. Some older
   layers still create DOM that newer layers replace. This contract is the last
   authority for visible application chrome and retired UI.

   Rules
   -----
   1. Retired UI may remain only as hidden compatibility DOM when old code still
      requires an element ID.
   2. A newer visual component must never be preceded by a visible legacy one.
   3. Ask Waffle is floating on Calendar/Care and never participates in header
      layout.
   4. Organiser is the only visible Reminders page shell; Sticky Notes remain a
      feature inside Organiser, not a startup page.
   5. Historical PDF Intake is read-only UI. Legacy upload controls cannot be
      reintroduced by delayed/focus recovery passes.
   6. Waffle AI is free-form conversation; legacy quick-prompt chips are retired.
   7. Ask Waffle composer geometry is canonical after prompt-strip retirement.
   8. This file performs geometry/visibility normalisation only. It does not
      rebuild operational data views.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.51';
  const CONTRACT_ATTR = 'data-waffle-ui-contract';
  const PROTECTED_SELECTOR = [
    '#aw37launch',
    '#v11133AskWaffleButton',
    '#v11133AskWaffleModal .aw37-prompts',
    '#v11133AskWaffleModal .aw37-card',
    '#v11133AskWaffleModal .aw37-form',
    '#openLegacyIntakeUploadBtn',
    '#v11123LegacyIntakeHistoryNote',
    '[data-upload-legacy-intake]',
    '[data-reassign-legacy-intake]',
    '[data-v1115-recovery-panel]',
    '#v1118MobileNav',
    'nav.v1118-mobile-nav',
    '.calendar-brand-copy',
    '.summary-dashboard',
    '.meet-greet-dashboard',
    '.directory-header-actions',
    '.calendar-header-branding',
    '.app-tabs'
  ].join(', ');

  let observer = null;
  let frame = 0;

  function pageName() {
    return String(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      'calendar'
    );
  }

  function compatibilitySink() {
    let sink = document.getElementById('waffleFinalUiCompatibilitySink');
    if (sink) return sink;

    sink = document.createElement('div');
    sink.id = 'waffleFinalUiCompatibilitySink';
    sink.hidden = true;
    sink.setAttribute('aria-hidden', 'true');
    sink.style.setProperty('display', 'none', 'important');
    sink.style.setProperty('visibility', 'hidden', 'important');
    sink.style.setProperty('pointer-events', 'none', 'important');
    document.body.appendChild(sink);
    return sink;
  }

  function moveToSink(node) {
    if (!node || !document.body) return;
    const sink = compatibilitySink();
    if (node !== sink && !sink.contains(node)) sink.appendChild(node);
  }

  function canonicalNavigation() {
    document.querySelectorAll(
      'a[href$="reminders.html"] .nav-label, [data-page-link="reminders"] .nav-label'
    ).forEach(label => {
      if (String(label.textContent || '').trim() !== 'Organiser') {
        label.textContent = 'Organiser';
      }
    });

    document.querySelectorAll('a[href$="reminders.html"], [data-page-link="reminders"]')
      .forEach(link => {
        ['aria-label', 'title'].forEach(attribute => {
          const value = String(link.getAttribute(attribute) || '');
          if (/reminder/i.test(value)) {
            link.setAttribute(attribute, value.replace(/reminders?/ig, 'Organiser'));
          }
        });
      });

    document.querySelectorAll('#v1118MobileNav, nav.v1118-mobile-nav')
      .forEach(nav => {
        if (!nav.classList.contains('app-tabs')) nav.remove();
      });
  }

  function canonicalBranding() {
    document.querySelectorAll('.calendar-header-branding .calendar-brand-copy')
      .forEach(node => node.remove());
  }

  function ensureAskWaffleComposerStyle() {
    if (document.getElementById('waffleFinalUiAskComposerStyle')) return;

    const style = document.createElement('style');
    style.id = 'waffleFinalUiAskComposerStyle';
    style.textContent = `
      /* The prompt strip was retired in V11.1.49. The original Ask Waffle card
         still declared five grid rows (header, prompts, thread, form, footer),
         which caused the form to occupy the old flexible thread row once the
         prompts node was removed. Four canonical rows restore the intended
         conversation/composer geometry. */
      #v11133AskWaffleModal .aw37-card {
        grid-template-rows: auto minmax(220px, 1fr) auto auto !important;
      }

      #v11133AskWaffleModal .aw37-form {
        min-height: 0 !important;
        height: auto !important;
        padding: 10px 14px !important;
        gap: 9px !important;
        align-items: center !important;
      }

      #v11133AskWaffleModal .aw37-form input {
        height: 44px !important;
        min-height: 44px !important;
        max-height: 44px !important;
        padding: 0 13px !important;
        line-height: 44px !important;
        align-self: center !important;
      }

      #v11133AskWaffleModal .aw37-form button {
        height: 44px !important;
        min-height: 44px !important;
        max-height: 44px !important;
        padding: 0 16px !important;
        align-self: center !important;
      }

      @media (max-width: 520px) {
        #v11133AskWaffleModal .aw37-card {
          grid-template-rows: auto minmax(180px, 1fr) auto auto !important;
        }

        #v11133AskWaffleModal .aw37-form {
          padding: 8px 10px !important;
          gap: 8px !important;
        }

        #v11133AskWaffleModal .aw37-form input,
        #v11133AskWaffleModal .aw37-form button {
          height: 42px !important;
          min-height: 42px !important;
          max-height: 42px !important;
        }

        #v11133AskWaffleModal .aw37-form input {
          padding: 0 12px !important;
          line-height: 42px !important;
        }

        #v11133AskWaffleModal .aw37-form button {
          padding: 0 13px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function canonicalAskWaffle() {
    const page = pageName();
    if (page !== 'calendar' && page !== 'directory') return;

    document.getElementById('v11133AskWaffleButton')?.remove();

    const launcher = document.getElementById('aw37launch');
    if (!launcher) return;

    launcher.classList.add('float', 'aw39-round-launch', 'waffle-final-ui-launcher');
    launcher.setAttribute('aria-label', 'Ask Waffle');
    launcher.setAttribute('title', 'Ask Waffle');

    if (launcher.parentElement !== document.body) {
      document.body.appendChild(launcher);
    }
  }

  function canonicalAskWaffleConversation() {
    /* Free-form Waffle AI no longer needs predefined prompt chips. Remove the
       entire strip rather than merely hiding it, so it cannot reserve height or
       flash during delayed legacy enhancement passes. */
    document.querySelectorAll('#v11133AskWaffleModal .aw37-prompts')
      .forEach(prompts => prompts.remove());

    ensureAskWaffleComposerStyle();
  }

  function canonicalCalendar() {
    if (pageName() !== 'calendar') return;

    const sink = compatibilitySink();
    [
      'at-home-list',
      'leaving-list',
      'upcoming-list',
      'full-dates-list',
      'today-meet-greet-list',
      'meet-greet-today-date'
    ].forEach(id => {
      const node = document.getElementById(id);
      if (node && !sink.contains(node)) sink.appendChild(node);
    });

    document.querySelectorAll(
      '#calendarTabPanel > .summary-dashboard, ' +
      '#calendarTabPanel > .meet-greet-dashboard, ' +
      '[data-mobile-dashboard-section="summary"], ' +
      '[data-mobile-dashboard-section="meet"]'
    ).forEach(panel => {
      if (!sink.contains(panel)) panel.remove();
    });
  }

  function ensureHistoricalIntakeNote() {
    if (pageName() !== 'directory') return;

    const actions = document.querySelector('.directory-header-actions');
    if (!actions) return;

    const canonicalText = 'Historical PDF Intake · view only';
    const canonicalTitle = 'Existing historical PDF Intake records remain view-only. Use Digital Intake for new or updated intake information.';

    let note = document.getElementById('v11123LegacyIntakeHistoryNote');
    if (!note) {
      note = document.createElement('span');
      note.id = 'v11123LegacyIntakeHistoryNote';
      note.className = 'directory-care-summary v11123-legacy-intake-history-note v11144-historical-intake-note';
      note.textContent = canonicalText;
      note.title = canonicalTitle;
      actions.insertBefore(note, actions.firstChild || null);
      return;
    }

    if (String(note.textContent || '').trim() !== canonicalText) {
      note.textContent = canonicalText;
    }
    if (note.title !== canonicalTitle) {
      note.title = canonicalTitle;
    }
  }

  function canonicalCare() {
    if (pageName() !== 'directory') return;

    const legacyGlobal = document.getElementById('openLegacyIntakeUploadBtn');
    if (legacyGlobal) moveToSink(legacyGlobal);

    document.querySelectorAll('[data-upload-legacy-intake], [data-reassign-legacy-intake]')
      .forEach(moveToSink);

    ensureHistoricalIntakeNote();
  }

  function canonicalOrganiser() {
    if (pageName() !== 'reminders') return;

    /* Do not place inline display rules on Sticky Notes. They remain an active
       Organiser feature. The shared first-paint CSS alone suppresses the old
       top-level Reminders DOM until #v11115OrganiserRoot mounts, after which
       Organiser owns visibility of its own tabs and panels. */
    const panel = document.getElementById('remindersTabPanel');
    if (!panel) return;

    if (panel.dataset.waffleFinalUiOwner !== 'organiser') {
      panel.dataset.waffleFinalUiOwner = 'organiser';
    }
  }

  function canonicalAudit() {
    if (pageName() !== 'audit') return;
    document.querySelectorAll('[data-v1115-recovery-panel]')
      .forEach(panel => panel.remove());
  }

  function apply() {
    if (!document.body) return;

    if (document.documentElement.getAttribute(CONTRACT_ATTR) !== VERSION) {
      document.documentElement.setAttribute(CONTRACT_ATTR, VERSION);
    }
    if (document.body.getAttribute(CONTRACT_ATTR) !== VERSION) {
      document.body.setAttribute(CONTRACT_ATTR, VERSION);
    }

    canonicalNavigation();
    canonicalBranding();
    canonicalAskWaffle();
    canonicalAskWaffleConversation();
    canonicalCalendar();
    canonicalCare();
    canonicalOrganiser();
    canonicalAudit();
  }

  function queueApply() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  }

  function nodeMayAffectContract(node) {
    if (!(node instanceof Element)) return false;
    return !!(node.matches?.(PROTECTED_SELECTOR) || node.querySelector?.(PROTECTED_SELECTOR));
  }

  function mutationMayAffectContract(mutation) {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;

    if (target && (target.matches?.(PROTECTED_SELECTOR) || target.closest?.(PROTECTED_SELECTOR))) {
      return true;
    }

    if (Array.from(mutation.addedNodes || []).some(nodeMayAffectContract)) return true;
    if (Array.from(mutation.removedNodes || []).some(nodeMayAffectContract)) return true;

    return false;
  }

  function wireObserver() {
    if (observer || !document.body || typeof MutationObserver !== 'function') return;

    observer = new MutationObserver(mutations => {
      if (mutations.some(mutationMayAffectContract)) queueApply();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });
  }

  function start() {
    apply();
    wireObserver();

    /* These bounded passes cover delayed historical enhancement scripts. New
       code should not depend on them; the mutation observer is the backstop. */
    [50, 150, 350, 800, 1600, 3200, 5600].forEach(delay => setTimeout(apply, delay));

    window.addEventListener('pageshow', apply);
    window.addEventListener('focus', apply);

    window.WAFFLE_UI_CONTRACT = Object.freeze({
      version: VERSION,
      apply,
      page: pageName
    });

    window.dispatchEvent(new CustomEvent('waffle:ui-contract-ready', {
      detail: { version: VERSION, page: pageName() }
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
