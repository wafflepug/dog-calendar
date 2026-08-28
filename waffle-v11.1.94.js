/* ============================================================
   WAFFLE HOUSE V11.1.94 — UI MICRO-POLISH BEHAVIOR
   ------------------------------------------------------------
   Additive interaction/readability improvements only. No operational data
   rendering is rebuilt here; canonical feature modules remain authoritative.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_V11194_POLISH) return;

  const VERSION = '11.1.94';
  const LAST_SYNC_KEY = 'waffleLastCalendarSyncAt';
  let observedLegacySyncButton = null;
  let legacySyncObserver = null;
  let refreshFailureAt = 0;
  let refreshInProgress = false;
  let refreshTimer = 0;
  let maintenanceScheduled = false;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  }

  function formatRelativeTime(timestamp) {
    const value = Number(timestamp || 0);
    if (!value) return 'Ready';

    const ageMs = Math.max(0, Date.now() - value);
    const minutes = Math.floor(ageMs / 60000);
    if (minutes < 1) return 'Updated just now';
    if (minutes < 60) return `Updated ${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 6) return `Updated ${hours}h ago`;

    try {
      return `Updated ${new Date(value).toLocaleTimeString('en-AU', {
        hour: 'numeric',
        minute: '2-digit'
      })}`;
    } catch (_) {
      return 'Updated';
    }
  }

  function readLastSync() {
    try {
      return Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
    } catch (_) {
      return 0;
    }
  }

  function writeLastSync(timestamp) {
    try {
      localStorage.setItem(LAST_SYNC_KEY, String(timestamp));
    } catch (_) {}
  }

  function refreshStatusElement() {
    return document.getElementById('wh94LastUpdated');
  }

  function setRefreshStatus(state, text) {
    const status = refreshStatusElement();
    if (!status) return;
    status.dataset.state = state || 'idle';
    status.textContent = text || '';
  }

  function renderStoredRefreshStatus() {
    const status = refreshStatusElement();
    if (!status || refreshInProgress) return;
    if (refreshFailureAt && Date.now() - refreshFailureAt < 120000) return;

    const lastSync = readLastSync();
    status.dataset.state = lastSync ? 'ok' : 'idle';
    status.textContent = formatRelativeTime(lastSync);
  }

  function ensureCalendarRefreshUi() {
    if (pageName() !== 'calendar') return;

    const toolbar = document.querySelector('#wh65Calendar .wh65-toolbar-right');
    const button = toolbar?.querySelector('[data-wh69-sync]');
    if (!toolbar || !button) return;

    if (button.textContent.trim() !== '↻ Refresh') {
      button.textContent = '↻ Refresh';
    }
    button.setAttribute('aria-label', 'Refresh calendar data');
    button.title = 'Refresh calendar data';

    let status = toolbar.querySelector('#wh94LastUpdated');
    if (!status) {
      status = document.createElement('span');
      status.id = 'wh94LastUpdated';
      status.className = 'wh94-last-updated';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      toolbar.appendChild(status);
    }

    if (refreshInProgress) {
      setRefreshStatus('refreshing', 'Refreshing…');
    } else {
      renderStoredRefreshStatus();
    }
  }

  function watchLegacySyncButton() {
    if (pageName() !== 'calendar') return;

    const button = document.getElementById('manualRefreshBtn');
    if (!button || button === observedLegacySyncButton) return;

    legacySyncObserver?.disconnect();
    observedLegacySyncButton = button;

    const updateFromLegacyState = () => {
      const text = String(button.textContent || button.innerText || '').trim();

      if (/syncing/i.test(text)) {
        refreshInProgress = true;
        setRefreshStatus('refreshing', 'Refreshing…');
        return;
      }

      if (/synced/i.test(text)) {
        const now = Date.now();
        refreshInProgress = false;
        refreshFailureAt = 0;
        writeLastSync(now);
        setRefreshStatus('ok', 'Updated just now');
        return;
      }

      if (/failed/i.test(text)) {
        refreshInProgress = false;
        refreshFailureAt = Date.now();
        setRefreshStatus('error', 'Refresh failed');
      }
    };

    legacySyncObserver = new MutationObserver(updateFromLegacyState);
    legacySyncObserver.observe(button, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled']
    });
    updateFromLegacyState();
  }

  function polishSearchInputs() {
    const selectors = [
      '#calendarSearch',
      '#guestDirectorySearch',
      '#auditSearch',
      '.guest-directory-search',
      '.audit-search'
    ];

    document.querySelectorAll(selectors.join(',')).forEach(input => {
      try {
        if (input.tagName === 'INPUT' && input.type !== 'search') input.type = 'search';
      } catch (_) {}

      input.setAttribute('enterkeyhint', 'search');
      input.setAttribute('inputmode', 'search');
      if (!input.getAttribute('aria-label')) {
        const placeholder = String(input.getAttribute('placeholder') || 'Search')
          .replace(/^\s*🔍\s*/, '')
          .replace(/\.\.\.$/, '')
          .trim();
        input.setAttribute('aria-label', placeholder || 'Search');
      }
    });
  }

  function polishEmptyStates() {
    const selector = '.no-dogs, .v10-empty, .reminders-empty, .audit-empty, .belongings-empty';
    document.querySelectorAll(selector).forEach(node => {
      node.classList.add('wh94-empty-polished');
      if (node.dataset.wh94CopyPolished === 'true') return;

      const text = String(node.textContent || '').trim();
      if (!text || /loading|sync|open this/i.test(text) || /^[✓✅🟢⚠️ℹ️🐾📌🧾]/u.test(text)) {
        node.dataset.wh94CopyPolished = 'true';
        return;
      }

      if (/^no\b/i.test(text)) {
        node.textContent = `✓ ${text}`;
      }
      node.dataset.wh94CopyPolished = 'true';
    });
  }

  function polishControlLanguage() {
    const legacyCalendarRefresh = document.getElementById('manualRefreshBtn');
    if (legacyCalendarRefresh) {
      legacyCalendarRefresh.setAttribute('aria-label', 'Refresh calendar data');
      legacyCalendarRefresh.title = 'Refresh calendar data';
    }

    const refreshButtons = [
      document.getElementById('refreshGuestDirectoryBtn'),
      document.getElementById('refreshRemindersBtn')
    ].filter(Boolean);

    refreshButtons.forEach(button => {
      if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', 'Refresh');
    });
  }

  function maintainPolish() {
    maintenanceScheduled = false;
    polishSearchInputs();
    polishEmptyStates();
    polishControlLanguage();
    ensureCalendarRefreshUi();
    watchLegacySyncButton();
  }

  function scheduleMaintenance() {
    if (maintenanceScheduled) return;
    maintenanceScheduled = true;
    requestAnimationFrame(maintainPolish);
  }

  function start() {
    maintainPolish();

    document.addEventListener('click', event => {
      const sync = event.target?.closest?.('[data-wh69-sync]');
      if (!sync) return;
      refreshInProgress = true;
      setRefreshStatus('refreshing', 'Refreshing…');
    }, true);

    const observer = new MutationObserver(scheduleMaintenance);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => {
      ensureCalendarRefreshUi();
      renderStoredRefreshStatus();
    }, 60000);

    window.addEventListener('pageshow', scheduleMaintenance);
  }

  window.WAFFLE_V11194_POLISH = Object.freeze({ version: VERSION });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
