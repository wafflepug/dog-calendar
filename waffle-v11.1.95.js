/* ============================================================
   WAFFLE HOUSE V11.1.95 — CARE FUTURE STAYS
   ------------------------------------------------------------
   Extends the existing Current / Past Care stay selector with a Future Stays
   view. Future stays reuse the exact current-stay cards and profile machinery
   so Profile, Belongings, Media, History and Master stay fully consistent.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_V11195_FUTURE_STAYS) return;

  const VERSION = '11.1.95';
  const FUTURE_VIEW = 'future';
  let originalSwitchStayView = null;
  let originalUpdateCurrentCount = null;
  let midnightTimer = 0;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  }

  function isCarePage() {
    return pageName() === 'directory';
  }

  function todayKey() {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');
  }

  function dateKey(value) {
    const text = String(value || '').trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return '';
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, '0'),
      String(parsed.getDate()).padStart(2, '0')
    ].join('-');
  }

  function dashboard() {
    return document.querySelector('.directory-dashboard-fused');
  }

  function currentGrid() {
    return document.getElementById('directory-grid');
  }

  function currentCards() {
    const grid = currentGrid();
    if (!grid) return [];
    return Array.from(grid.children).filter(node =>
      node instanceof HTMLElement &&
      node.matches('.directory-card[data-directory-stay-key]')
    );
  }

  function isFutureCard(card) {
    const start = dateKey(
      card?.dataset?.directoryStartDate ||
      card?.dataset?.startDate ||
      ''
    );
    return !!start && start > todayKey();
  }

  function ensureFutureTab() {
    if (!isCarePage()) return null;

    const nav = document.querySelector('.v1082-stay-tabs');
    if (!nav) return null;

    let button = nav.querySelector('[data-v1082-stay-tab="future"]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'v1082-stay-tab v11195-future-tab';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', 'false');
      button.dataset.v1082StayTab = FUTURE_VIEW;
      button.innerHTML = '<span>📅 Future Stays</span><strong id="v1082FutureStayCount">…</strong>';

      const past = nav.querySelector('[data-v1082-stay-tab="past"]');
      if (past) past.insertAdjacentElement('beforebegin', button);
      else nav.appendChild(button);
    }

    nav.dataset.v11195FutureReady = 'true';
    return button;
  }

  function ensureFutureHeading() {
    const grid = currentGrid();
    const panel = document.getElementById('v1082CurrentStayPanel');
    if (!grid || !panel) return null;

    let heading = document.getElementById('v11195FutureStayHeading');
    if (!heading) {
      heading = document.createElement('div');
      heading.id = 'v11195FutureStayHeading';
      heading.className = 'v1082-past-heading v11195-future-heading';
      heading.innerHTML = [
        '<div>',
        '<span>Confirmed upcoming boarding stays</span>',
        '<strong>Future Care Profiles</strong>',
        '</div>',
        '<span>Soonest arrivals first</span>'
      ].join('');
      panel.insertBefore(heading, grid);
    }
    return heading;
  }

  function ensureEmptyState(kind) {
    const grid = currentGrid();
    if (!grid) return null;

    const className = kind === FUTURE_VIEW
      ? 'v11195-future-empty'
      : 'v11195-current-empty';

    let node = grid.querySelector(`.${className}`);
    if (!node) {
      node = document.createElement('div');
      node.className = `v1082-past-empty v11195-stay-empty ${className}`;
      node.dataset.v11195StayEmpty = kind;
      node.innerHTML = kind === FUTURE_VIEW
        ? '<span>📅</span><strong>No future stays booked</strong><small>Confirmed upcoming dogs will appear here automatically.</small>'
        : '<span>🏡</span><strong>No dogs staying right now</strong><small>Future bookings are available under Future Stays.</small>';
      grid.appendChild(node);
    }
    return node;
  }

  function classifyAndCount() {
    if (!isCarePage()) return { current: 0, future: 0, total: 0 };

    ensureFutureTab();
    ensureFutureHeading();

    const cards = currentCards();
    let futureCount = 0;
    let currentCount = 0;

    cards.forEach(card => {
      const future = isFutureCard(card);
      card.dataset.v1082StayKind = future ? FUTURE_VIEW : 'current';
      card.classList.toggle('v11195-future-stay', future);
      if (future) futureCount += 1;
      else currentCount += 1;
    });

    const currentCounter = document.getElementById('v1082CurrentStayCount');
    const futureCounter = document.getElementById('v1082FutureStayCount');
    if (currentCounter) currentCounter.textContent = String(currentCount);
    if (futureCounter) futureCounter.textContent = String(futureCount);

    const futureEmpty = ensureEmptyState(FUTURE_VIEW);
    const currentEmpty = ensureEmptyState('current');

    if (futureEmpty) futureEmpty.hidden = futureCount > 0;
    if (currentEmpty) {
      currentEmpty.hidden = !(cards.length > 0 && currentCount === 0);
    }

    return {
      current: currentCount,
      future: futureCount,
      total: cards.length
    };
  }

  function setDashboardView(view) {
    const host = dashboard();
    if (host) host.dataset.v11195StayView = view;
  }

  function setFutureToolbarCopy() {
    const search = document.getElementById('guestDirectorySearch');
    const note = document.querySelector('.guest-directory-toolbar-note');
    const careSummary = document.getElementById('directory-care-summary');
    const legacyUpload = document.getElementById('openLegacyIntakeUploadBtn');

    if (search) {
      search.placeholder = '🔍 Search future dog, breed, owner, care, intake or belongings...';
    }
    if (note) {
      note.textContent = 'Future stays use the same full Care profile. Prepare intake, care details, belongings and photos before arrival.';
    }
    if (careSummary) careSummary.hidden = true;
    if (legacyUpload) legacyUpload.hidden = false;
  }

  function switchFutureStayView(options = {}) {
    classifyAndCount();

    try {
      v1082ActiveStayView = FUTURE_VIEW;
    } catch (_) {}

    try {
      closeDirectoryGuestProfile({
        preserveScroll: true,
        instant: options.instant === true
      });
    } catch (_) {}

    document.querySelectorAll('[data-v1082-stay-tab]').forEach(button => {
      const active = button.dataset.v1082StayTab === FUTURE_VIEW;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    document.querySelectorAll('[data-v1082-stay-panel]').forEach(panel => {
      const active = panel.dataset.v1082StayPanel === 'current';
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });

    setDashboardView(FUTURE_VIEW);
    setFutureToolbarCopy();

    try {
      if (typeof filterGuestDirectoryCards === 'function') {
        filterGuestDirectoryCards();
      }
    } catch (_) {}
  }

  function installFunctionExtensions() {
    try {
      if (typeof v1082SwitchStayView === 'function') {
        originalSwitchStayView = v1082SwitchStayView;
        v1082SwitchStayView = function(view, options = {}) {
          if (view === FUTURE_VIEW) {
            switchFutureStayView(options);
            return;
          }

          const normalized = view === 'past' ? 'past' : 'current';
          const result = originalSwitchStayView.call(this, normalized, options);
          setDashboardView(normalized);
          classifyAndCount();
          return result;
        };
      }
    } catch (error) {
      console.warn('Future Stays could not extend stay switching:', error);
    }

    try {
      if (typeof v1082UpdateCurrentCount === 'function') {
        originalUpdateCurrentCount = v1082UpdateCurrentCount;
        v1082UpdateCurrentCount = function() {
          classifyAndCount();
        };
      }
    } catch (error) {
      console.warn('Future Stays could not extend Care counts:', error);
    }
  }

  function maintainFutureStays() {
    if (!isCarePage()) return;
    ensureFutureTab();
    ensureFutureHeading();
    classifyAndCount();

    let active = 'current';
    try {
      active = String(v1082ActiveStayView || 'current');
    } catch (_) {}
    setDashboardView(active === FUTURE_VIEW ? FUTURE_VIEW : active === 'past' ? 'past' : 'current');
  }

  function start() {
    if (!isCarePage()) return;

    ensureFutureTab();
    ensureFutureHeading();
    setDashboardView('current');
    installFunctionExtensions();

    document.addEventListener('DOMContentLoaded', maintainFutureStays, { once: true });

    window.addEventListener('pageshow', maintainFutureStays);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') maintainFutureStays();
    });

    clearInterval(midnightTimer);
    midnightTimer = window.setInterval(maintainFutureStays, 60 * 1000);
  }

  window.WAFFLE_V11195_FUTURE_STAYS = Object.freeze({
    version: VERSION,
    classifyAndCount,
    switchFutureStayView
  });

  start();
})();
