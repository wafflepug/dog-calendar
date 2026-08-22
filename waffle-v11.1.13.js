/* ============================================================
   WAFFLE HOUSE V11.1.13 — PROFILE DATES + PRIORITY/RECOVERY POLISH
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.13';
  let pendingStayDateCard = null;
  let recoveryRecords = [];

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function esc(value) {
    if (typeof window.escapeDashboardHtml === 'function') {
      return window.escapeDashboardHtml(value == null ? '' : String(value));
    }
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showFeedback(title, body, kind) {
    if (typeof window.v1118ShowToast === 'function') {
      try {
        window.v1118ShowToast(title, body || '', { kind: kind || 'success', duration: 2600 });
        return;
      } catch (_) {}
    }
    if (body) console.info(title + ': ' + body);
  }

  function profileCardFromElement(element) {
    return element?.closest?.('.directory-card') || null;
  }

  function decorateStayDateLabels(root = document) {
    if (pageName() !== 'directory') return;
    root.querySelectorAll?.('.directory-card .directory-stay-dates').forEach(label => {
      const card = profileCardFromElement(label);
      if (!card?.dataset?.directoryStartDate || !card?.dataset?.directoryEndDate) return;
      label.classList.add('v11113-editable-stay-dates');
      label.setAttribute('role', 'button');
      label.setAttribute('tabindex', '0');
      label.setAttribute('title', 'Edit stay dates');
      label.setAttribute('aria-label', 'Edit stay dates');
    });
  }

  function ensureStayDatesModal() {
    let modal = document.getElementById('v11113StayDatesModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v11113StayDatesModal';
    modal.className = 'v108-modal v11113-stay-dates-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v108-modal-card v11113-stay-dates-card" role="dialog" aria-modal="true" aria-labelledby="v11113StayDatesTitle">
        <div class="v108-modal-head v11113-sticky-head">
          <div>
            <small>STAY DATES</small>
            <h3 id="v11113StayDatesTitle">📅 Edit Stay Dates</h3>
            <p data-v11113-stay-dates-copy>Update this boarding stay.</p>
          </div>
          <button type="button" data-v11113-stay-dates-close aria-label="Close">×</button>
        </div>
        <div class="v11113-stay-dates-fields">
          <label><span>Check-in date</span><input type="date" data-v11113-start-date></label>
          <label><span>Check-out date</span><input type="date" data-v11113-end-date></label>
        </div>
        <div class="v11113-stay-dates-status" data-v11113-stay-dates-status aria-live="polite"></div>
        <div class="v11113-stay-dates-actions">
          <button type="button" data-v11113-stay-dates-close>Cancel</button>
          <button type="button" class="is-primary" data-v11113-stay-dates-save>Save Dates</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-v11113-stay-dates-close]')) closeStayDatesModal();
    });
    modal.querySelector('[data-v11113-stay-dates-save]')?.addEventListener('click', saveStayDates);
    return modal;
  }

  function openStayDatesModal(card) {
    if (!card || !card.classList.contains('is-profile-active')) return;
    const startDate = String(card.dataset.directoryStartDate || card.dataset.startDate || '').trim();
    const endDate = String(card.dataset.directoryEndDate || card.dataset.endDate || startDate).trim();
    if (!startDate || !endDate) return;
    pendingStayDateCard = card;
    const modal = ensureStayDatesModal();
    const dogName = String(card.dataset.directoryDogName || card.dataset.dogName || 'this dog').trim();
    modal.querySelector('[data-v11113-stay-dates-copy]').textContent =
      `Update ${dogName}'s boarding dates. Linked Care and intake records will follow the new stay dates.`;
    modal.querySelector('[data-v11113-start-date]').value = startDate;
    modal.querySelector('[data-v11113-end-date]').value = endDate;
    modal.querySelector('[data-v11113-stay-dates-status]').textContent = '';
    const saveButton = modal.querySelector('[data-v11113-stay-dates-save]');
    saveButton.disabled = false;
    saveButton.textContent = 'Save Dates';
    modal.hidden = false;
    setTimeout(() => modal.querySelector('[data-v11113-start-date]')?.focus(), 40);
  }

  function closeStayDatesModal() {
    const modal = document.getElementById('v11113StayDatesModal');
    if (modal) modal.hidden = true;
    pendingStayDateCard = null;
  }

  async function saveStayDates() {
    const card = pendingStayDateCard;
    const modal = ensureStayDatesModal();
    if (!card || typeof window.sendPayloadToAppsScript !== 'function') return;
    const startDate = String(modal.querySelector('[data-v11113-start-date]')?.value || '').trim();
    const endDate = String(modal.querySelector('[data-v11113-end-date]')?.value || '').trim();
    const status = modal.querySelector('[data-v11113-stay-dates-status]');
    const saveButton = modal.querySelector('[data-v11113-stay-dates-save]');
    const dogName = String(card.dataset.directoryDogName || card.dataset.dogName || '').trim();
    const originalStartDate = String(card.dataset.directoryStartDate || card.dataset.startDate || '').trim();
    const originalEndDate = String(card.dataset.directoryEndDate || card.dataset.endDate || originalStartDate).trim();

    if (!startDate || !endDate) {
      status.textContent = 'Choose both dates.';
      status.className = 'v11113-stay-dates-status is-error';
      return;
    }
    if (endDate < startDate) {
      status.textContent = 'Check-out date cannot be before check-in date.';
      status.className = 'v11113-stay-dates-status is-error';
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';
    status.textContent = 'Updating the stay and linked Care records…';
    status.className = 'v11113-stay-dates-status is-saving';

    try {
      const response = await window.sendPayloadToAppsScript({
        action: 'update_boarding_dates',
        dogName,
        originalDogName: dogName,
        originalStartDate,
        originalEndDate,
        startDate,
        endDate,
        source: 'Dog Profile'
      });
      if (!response || response.result !== 'success') throw new Error(response?.error || 'Stay dates could not be updated.');
      if (typeof window.invalidateWaffleClientCaches === 'function') {
        await window.invalidateWaffleClientCaches(['directory', 'audit']);
      }
      status.textContent = 'Saved ✓';
      status.className = 'v11113-stay-dates-status is-success';
      showFeedback('Saved ✓', 'Stay dates updated.', 'success');

      let nextStayKey = '';
      if (response?.booking?.stayKey) nextStayKey = String(response.booking.stayKey);
      if (!nextStayKey && typeof window.v110MakeStayKey === 'function') {
        try { nextStayKey = window.v110MakeStayKey(dogName, startDate, endDate); } catch (_) {}
      }
      setTimeout(() => {
        window.location.href = nextStayKey
          ? `directory.html?stayKey=${encodeURIComponent(nextStayKey)}`
          : 'directory.html';
      }, 550);
    } catch (error) {
      status.textContent = error?.message || String(error);
      status.className = 'v11113-stay-dates-status is-error';
      saveButton.disabled = false;
      saveButton.textContent = 'Save Dates';
    }
  }

  function movePriorityIntoNotifications() {
    if (pageName() !== 'calendar') return;
    const panel = document.getElementById('v1118AttentionPanel');
    if (!panel) return;
    let modal = document.getElementById('waffleNotificationModal');
    if (!modal && typeof window.ensureWaffleNotificationModal === 'function') {
      try { modal = window.ensureWaffleNotificationModal(); } catch (_) {}
    }
    const feed = modal?.querySelector('[data-notification-feed]');
    if (!feed?.parentElement) return;
    panel.classList.add('v11113-notification-priority');
    if (panel.parentElement !== feed.parentElement || panel.nextElementSibling !== feed) {
      feed.parentElement.insertBefore(panel, feed);
    }
  }

  function wrapNotificationOpen() {
    const base = window.openWaffleNotificationCentre;
    if (typeof base !== 'function' || base.v11113Wrapped) return;
    const wrapped = function () {
      const result = base.apply(this, arguments);
      setTimeout(movePriorityIntoNotifications, 0);
      setTimeout(movePriorityIntoNotifications, 120);
      return result;
    };
    wrapped.v11113Wrapped = true;
    window.openWaffleNotificationCentre = wrapped;
  }

  function wrapOperationsRender() {
    const base = window.renderV10OperationsHome;
    if (typeof base !== 'function' || base.v11113PriorityWrapped) return;
    const wrapped = function () {
      const result = base.apply(this, arguments);
      setTimeout(movePriorityIntoNotifications, 35);
      setTimeout(movePriorityIntoNotifications, 180);
      return result;
    };
    wrapped.v11113PriorityWrapped = true;
    wrapped.v11111MeetResilienceWrapped = base.v11111MeetResilienceWrapped;
    wrapped.v11110MeetPriorityWrapped = base.v11110MeetPriorityWrapped;
    wrapped.v1118Wrapped = base.v1118Wrapped;
    window.renderV10OperationsHome = wrapped;
  }

  function moveSyncIntoCalendarToolbar() {
    if (pageName() !== 'calendar') return;
    const button = document.getElementById('manualRefreshBtn');
    if (!button) return;
    const toolbar = document.querySelector('#calendar .fc-header-toolbar');
    const slot = toolbar?.querySelector('.fc-toolbar-chunk:last-child');
    if (!slot) return;
    button.classList.add('v11113-calendar-sync-button');
    button.removeAttribute('style');
    if (button.parentElement !== slot) slot.appendChild(button);
    const legacy = document.querySelector('#calendarTabPanel > .search-container');
    if (legacy) {
      legacy.hidden = true;
      legacy.style.display = 'none';
      legacy.setAttribute('aria-hidden', 'true');
    }
  }

  function shortenArrivingBadges(root = document) {
    if (pageName() !== 'directory') return;
    root.querySelectorAll?.('.directory-card').forEach(card => {
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      const changes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (/\bArriving Today\b/i.test(String(node.nodeValue || ''))) changes.push(node);
      }
      changes.forEach(node => {
        node.nodeValue = String(node.nodeValue || '').replace(/Arriving Today/gi, 'Arriving');
      });
      card.querySelectorAll('[title],[aria-label]').forEach(el => {
        if (el.title) el.title = el.title.replace(/Arriving Today/gi, 'Arriving');
        if (el.hasAttribute('aria-label')) {
          el.setAttribute('aria-label', String(el.getAttribute('aria-label') || '').replace(/Arriving Today/gi, 'Arriving'));
        }
      });
    });
  }

  function wrapDirectoryRender() {
    const base = window.applyGuestDirectoryResponse;
    if (typeof base !== 'function' || base.v11113Wrapped) return;
    const wrapped = function () {
      const result = base.apply(this, arguments);
      setTimeout(() => {
        decorateStayDateLabels();
        shortenArrivingBadges();
      }, 35);
      return result;
    };
    wrapped.v11113Wrapped = true;
    wrapped.v11112RequestSourceWrapped = base.v11112RequestSourceWrapped;
    wrapped.v11111PhoneWrapped = base.v11111PhoneWrapped;
    wrapped.v1119PastCheckoutWrapped = base.v1119PastCheckoutWrapped;
    wrapped.v1118Wrapped = base.v1118Wrapped;
    window.applyGuestDirectoryResponse = wrapped;
  }

  function formatRecoveryDate(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  function hideLegacyRecoveryPanel() {
    if (pageName() !== 'audit') return;
    document.querySelectorAll('[data-v1115-recovery-panel]').forEach(panel => {
      panel.hidden = true;
      panel.classList.add('v11113-inline-recovery-hidden');
    });
  }

  function ensureRecoveryButton() {
    if (pageName() !== 'audit') return null;
    const refresh = document.getElementById('refreshAuditBtn');
    if (!refresh) return null;
    let actions = refresh.closest('.v11113-audit-header-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'v11113-audit-header-actions';
      refresh.parentElement.insertBefore(actions, refresh);
      actions.appendChild(refresh);
    }
    let button = document.getElementById('v11113RecoveryButton');
    if (!button) {
      button = document.createElement('button');
      button.id = 'v11113RecoveryButton';
      button.type = 'button';
      button.className = 'audit-refresh-btn v11113-recovery-button';
      button.innerHTML = '🗑️ Recovery <span data-v11113-recovery-count hidden></span>';
      button.addEventListener('click', openRecoveryModal);
      actions.appendChild(button);
    }
    return button;
  }

  function ensureRecoveryModal() {
    let modal = document.getElementById('v11113RecoveryModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v11113RecoveryModal';
    modal.className = 'v108-modal v11113-recovery-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v108-modal-card v11113-recovery-card" role="dialog" aria-modal="true" aria-labelledby="v11113RecoveryTitle">
        <div class="v108-modal-head v11113-sticky-head">
          <div>
            <small>RECOVERY</small>
            <h3 id="v11113RecoveryTitle">🗑️ Deleted Dog Profiles</h3>
            <p>Recover a deleted dog profile and its linked owner data. Recovery creates a new Audit Log entry.</p>
          </div>
          <button type="button" data-v11113-recovery-close aria-label="Close">×</button>
        </div>
        <div class="v11113-recovery-list" data-v11113-recovery-list>
          <div class="v11113-recovery-loading">Loading deleted profiles…</div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-v11113-recovery-close]')) {
        modal.hidden = true;
        return;
      }
      const recover = event.target.closest('[data-v11113-recover-profile]');
      if (recover) recoverProfile(recover).catch(error => console.error(error));
    });
    return modal;
  }

  function renderRecoveryModal() {
    const modal = ensureRecoveryModal();
    const host = modal.querySelector('[data-v11113-recovery-list]');
    const button = ensureRecoveryButton();
    const badge = button?.querySelector('[data-v11113-recovery-count]');
    if (badge) {
      badge.hidden = recoveryRecords.length === 0;
      badge.textContent = String(recoveryRecords.length);
    }
    if (!recoveryRecords.length) {
      host.innerHTML = `
        <div class="v11113-recovery-empty">
          <span>✓</span><strong>No deleted dog profiles</strong><small>Recoverable deletions will appear here.</small>
        </div>`;
      return;
    }
    host.innerHTML = recoveryRecords.map(record => `
      <article class="v11113-recovery-item">
        <div>
          <strong>🐾 ${esc(record.dogName || 'Deleted dog')}</strong>
          <span>${esc(record.deletedBreed || '')}${record.deletedOwnerName ? `${record.deletedBreed ? ' · ' : ''}Owner: ${esc(record.deletedOwnerName)}` : ''}</span>
          <small>Deleted ${esc(formatRecoveryDate(record.deletedAt || record.timestamp))}</small>
        </div>
        <button type="button" data-v11113-recover-profile="${esc(record.deletionId || record.reference || '')}" data-v11113-recover-dog="${esc(record.dogName || '')}">↩ Recover</button>
      </article>`).join('');
  }

  async function loadRecoveryRecords(force = false) {
    if (pageName() !== 'audit' || typeof window.queryAppsScript !== 'function') return;
    if (recoveryRecords.length && !force) {
      renderRecoveryModal();
      return;
    }
    try {
      const response = await window.queryAppsScript({ action: 'get_audit_log', limit: 500 }, {
        maxAttempts: 2, timeoutMs: 30000, dedupe: false
      });
      recoveryRecords = Array.isArray(response?.records)
        ? response.records.filter(record => record && record.recoverable === true && (record.deletionId || record.reference))
        : [];
      renderRecoveryModal();
    } catch (error) {
      const host = ensureRecoveryModal().querySelector('[data-v11113-recovery-list]');
      host.innerHTML = `<div class="v11113-recovery-error">${esc(error?.message || 'Recovery list could not be loaded.')}</div>`;
    }
  }

  function openRecoveryModal() {
    const modal = ensureRecoveryModal();
    modal.hidden = false;
    loadRecoveryRecords(true).catch(error => console.error(error));
  }

  async function recoverProfile(button) {
    if (!button || typeof window.sendPayloadToAppsScript !== 'function') return;
    const deletionId = String(button.dataset.v11113RecoverProfile || '').trim();
    const dogName = String(button.dataset.v11113RecoverDog || 'this dog').trim();
    if (!deletionId) return;
    if (!window.confirm(`Recover ${dogName}'s deleted profile and linked owner data?`)) return;

    button.disabled = true;
    button.textContent = 'Recovering…';
    try {
      const result = await window.sendPayloadToAppsScript({
        action: 'restore_dog_profile',
        deletionId,
        actor: 'Web App User'
      });
      if (!result || result.result !== 'success') throw new Error(result?.error || 'Recovery failed.');
      if (typeof window.invalidateWaffleClientCaches === 'function') {
        await window.invalidateWaffleClientCaches(['directory', 'audit', 'reminders']);
      }
      showFeedback('Recovered ✓', `${result.dogName || dogName} has been restored.`, 'success');
      await loadRecoveryRecords(true);
      if (typeof window.loadAuditLog === 'function') {
        try { await window.loadAuditLog({ force: true }); } catch (_) {}
      }
    } catch (error) {
      button.disabled = false;
      button.textContent = '↩ Recover';
      window.alert('Dog profile could not be recovered.\n\n' + (error?.message || String(error)));
    }
  }

  function wireAuditRefresh() {
    const refresh = document.getElementById('refreshAuditBtn');
    if (!refresh || refresh.dataset.v11113RecoveryRefresh === 'true') return;
    refresh.dataset.v11113RecoveryRefresh = 'true';
    refresh.addEventListener('click', () => {
      setTimeout(() => loadRecoveryRecords(true).catch(() => {}), 250);
      setTimeout(hideLegacyRecoveryPanel, 500);
    });
  }

  function wireClicks() {
    if (window.v11113ClicksWired) return;
    window.v11113ClicksWired = true;
    document.addEventListener('click', event => {
      const dates = event.target.closest('.v11113-editable-stay-dates');
      if (!dates) return;
      const card = profileCardFromElement(dates);
      if (!card?.classList.contains('is-profile-active')) return;
      event.preventDefault();
      event.stopPropagation();
      openStayDatesModal(card);
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const dates = event.target.closest?.('.v11113-editable-stay-dates');
      if (!dates) return;
      const card = profileCardFromElement(dates);
      if (!card?.classList.contains('is-profile-active')) return;
      event.preventDefault();
      openStayDatesModal(card);
    });
  }

  function reconcile() {
    const page = pageName();
    if (page === 'calendar') {
      wrapOperationsRender();
      wrapNotificationOpen();
      movePriorityIntoNotifications();
      moveSyncIntoCalendarToolbar();
    }
    if (page === 'directory') {
      wrapDirectoryRender();
      decorateStayDateLabels();
      shortenArrivingBadges();
    }
    if (page === 'audit') {
      hideLegacyRecoveryPanel();
      ensureRecoveryButton();
      ensureRecoveryModal();
      wireAuditRefresh();
    }
  }

  function start() {
    wireClicks();
    ensureStayDatesModal();
    reconcile();
    [250, 700, 1400, 2600].forEach(delay => setTimeout(reconcile, delay));
    if (pageName() === 'audit') {
      [450, 1250].forEach(delay => setTimeout(() => {
        hideLegacyRecoveryPanel();
        loadRecoveryRecords(false).catch(() => {});
      }, delay));
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) setTimeout(reconcile, 30);
    });
    window.addEventListener('pageshow', () => setTimeout(reconcile, 30));

    window.WAFFLE_V11113 = {
      version: VERSION,
      movePriorityIntoNotifications,
      moveSyncIntoCalendarToolbar,
      shortenArrivingBadges,
      loadRecoveryRecords
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
