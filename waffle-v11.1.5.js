/* ============================================================
   WAFFLE HOUSE V11.1.5 — PROFILE PURGE + AUDIT RECOVERY UI
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.5';
  let pendingDelete = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normaliseName(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sourceDefinition(value) {
    const source = String(value || '').trim();
    if (!source) return null;

    if (typeof V1112_REQUEST_SOURCES !== 'undefined') {
      const match = V1112_REQUEST_SOURCES.find(item =>
        item && String(item.value || '').toLowerCase() === source.toLowerCase()
      );
      if (match) return match;
    }

    return { value: source, label: source, image: '' };
  }

  function sourceBadgeHtml(requestSource) {
    const source = sourceDefinition(requestSource);
    if (!source) {
      return `
        <div class="v1115-profile-source-card is-empty">
          <span class="v1115-profile-source-title">Request From</span>
          <div class="v1115-profile-source-empty">Not recorded</div>
        </div>`;
    }

    return `
      <div class="v1115-profile-source-card" data-v1115-profile-source="${escapeHtml(source.value)}">
        <span class="v1115-profile-source-title">Request From</span>
        <div class="v1115-profile-source-value">
          <span class="v1115-profile-source-logo">
            ${source.image ? `<img src="${escapeHtml(source.image)}" alt="">` : '<span>↗</span>'}
          </span>
          <strong>${escapeHtml(source.label || source.value)}</strong>
        </div>
      </div>`;
  }

  async function loadProfileRecord(card) {
    if (!card) return null;
    const stayKey = String(card.dataset.directoryStayKey || card.dataset.stayKey || '').trim();
    if (!stayKey) return null;

    try {
      if (typeof directoryProfileDetailCache !== 'undefined') {
        const cached = directoryProfileDetailCache[stayKey];
        if (cached && cached.requestSource !== undefined) return cached;
      }
    } catch (_) {}

    if (typeof queryAppsScript !== 'function') return null;
    const response = await queryAppsScript({ action: 'get_guest_profile', stayKey });
    return response && response.record ? response.record : null;
  }

  function renderProfileEnhancements(card, record) {
    if (!card || !record) return;

    const tabs = card.querySelector('.directory-main-profile-tabs');
    const panel = card.querySelector('[data-directory-main-panel="profile"]');
    if (!panel) return;

    let sourceHost = card.querySelector('[data-v1115-profile-source-host]');
    if (!sourceHost) {
      sourceHost = document.createElement('div');
      sourceHost.setAttribute('data-v1115-profile-source-host', 'true');
      sourceHost.className = 'v1115-profile-source-host';
      if (tabs && tabs.parentElement) tabs.parentElement.insertBefore(sourceHost, tabs);
      else panel.insertBefore(sourceHost, panel.firstChild);
    }
    sourceHost.innerHTML = sourceBadgeHtml(record.requestSource);

    let danger = panel.querySelector('[data-v1115-profile-danger]');
    if (!danger) {
      danger = document.createElement('section');
      danger.className = 'v1115-profile-danger';
      danger.setAttribute('data-v1115-profile-danger', 'true');
      panel.appendChild(danger);
    }

    const dogName = String(record.dogName || card.dataset.directoryDogName || card.dataset.dogName || 'Dog').trim();
    danger.innerHTML = `
      <div>
        <span class="v1115-danger-kicker">Profile management</span>
        <strong>Delete ${escapeHtml(dogName)}'s profile</strong>
        <small>Removes this dog and linked owner data from active Waffle House records. The deletion is audited and can be recovered from Logs.</small>
      </div>
      <button type="button" class="v1115-delete-profile-button" data-v1115-delete-profile>Delete Dog Profile</button>
    `;

    danger.querySelector('[data-v1115-delete-profile]')._v1115Record = record;
  }

  function scheduleProfileEnhancement(card) {
    if (!card) return;
    [80, 320, 900].forEach(delay => {
      setTimeout(async () => {
        if (!card.isConnected || !card.classList.contains('is-profile-active')) return;
        try {
          const record = await loadProfileRecord(card);
          if (record) renderProfileEnhancements(card, record);
        } catch (error) {
          console.warn('Profile enhancement could not load:', error);
        }
      }, delay);
    });
  }

  function ensureDeleteModal() {
    let modal = document.getElementById('v1115DeleteDogModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'v1115DeleteDogModal';
    modal.className = 'v1115-confirm-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v1115-confirm-card" role="dialog" aria-modal="true" aria-labelledby="v1115DeleteTitle">
        <button type="button" class="v1115-confirm-close" data-v1115-delete-cancel aria-label="Close">×</button>
        <span class="v1115-confirm-icon" aria-hidden="true">⚠️</span>
        <h3 id="v1115DeleteTitle">Delete Dog Profile</h3>
        <p data-v1115-delete-copy></p>
        <div class="v1115-confirm-warning">
          This removes the dog profile, linked owner details, stay/care records and linked photos from active Waffle House data. A recovery snapshot is kept only for Audit Log recovery.
        </div>
        <label class="v1115-confirm-label">
          Type <strong data-v1115-delete-name></strong> to confirm
          <input type="text" autocomplete="off" spellcheck="false" data-v1115-delete-input>
        </label>
        <div class="v1115-confirm-actions">
          <button type="button" data-v1115-delete-cancel>Cancel</button>
          <button type="button" class="v1115-confirm-delete" data-v1115-delete-confirm disabled>Delete Profile</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('[data-v1115-delete-input]');
    const confirmButton = modal.querySelector('[data-v1115-delete-confirm]');

    input.addEventListener('input', () => {
      const expected = normaliseName(pendingDelete && pendingDelete.dogName);
      confirmButton.disabled = !expected || normaliseName(input.value) !== expected;
    });

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-v1115-delete-cancel]')) {
        closeDeleteModal();
      }
    });

    confirmButton.addEventListener('click', executeProfileDelete);
    return modal;
  }

  function openDeleteModal(record, card) {
    const modal = ensureDeleteModal();
    const dogName = String(record && record.dogName || card && (card.dataset.directoryDogName || card.dataset.dogName) || '').trim();
    if (!dogName) return;

    pendingDelete = { record: record || {}, card, dogName };
    modal.querySelector('[data-v1115-delete-name]').textContent = dogName;
    modal.querySelector('[data-v1115-delete-copy]').textContent = `You are about to remove ${dogName} and the linked owner profile from active Waffle House records.`;
    const input = modal.querySelector('[data-v1115-delete-input]');
    input.value = '';
    modal.querySelector('[data-v1115-delete-confirm]').disabled = true;
    modal.hidden = false;
    setTimeout(() => input.focus(), 40);
  }

  function closeDeleteModal() {
    const modal = document.getElementById('v1115DeleteDogModal');
    if (modal) modal.hidden = true;
    pendingDelete = null;
  }

  async function executeProfileDelete() {
    if (!pendingDelete || typeof sendPayloadToAppsScript !== 'function') return;
    const modal = ensureDeleteModal();
    const input = modal.querySelector('[data-v1115-delete-input]');
    const button = modal.querySelector('[data-v1115-delete-confirm]');
    const record = pendingDelete.record || {};
    const card = pendingDelete.card;

    button.disabled = true;
    button.textContent = 'Deleting…';

    try {
      const result = await sendPayloadToAppsScript({
        action: 'purge_dog_profile',
        confirmationName: input.value,
        dogName: pendingDelete.dogName,
        breed: String(record.breed || ''),
        ownerName: String(record.ownerName || ''),
        phone: String(record.phone || ''),
        masterKey: String(record.masterKey || ''),
        stayKey: String(record.stayKey || card?.dataset?.directoryStayKey || card?.dataset?.stayKey || '')
      });

      if (!result || result.result !== 'success') {
        throw new Error(result && result.error || 'Dog profile could not be deleted.');
      }

      if (typeof invalidateWaffleClientCaches === 'function') {
        await invalidateWaffleClientCaches(['directory', 'audit', 'reminders']);
      }

      closeDeleteModal();
      alert(`${pendingDelete?.dogName || record.dogName || 'Dog'} has been removed from active records.\n\nThe profile can be recovered from Logs → Deleted Dog Profiles.`);
      window.location.reload();
    } catch (error) {
      alert('Dog profile could not be deleted.\n\n' + (error?.message || String(error)));
      button.disabled = false;
      button.textContent = 'Delete Profile';
    }
  }

  function formatRecoveryDate(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function recoveryPanelHtml(records) {
    if (!records.length) return '';
    return `
      <section class="v1115-recovery-panel" data-v1115-recovery-panel>
        <div class="v1115-recovery-heading">
          <div>
            <span>Recovery</span>
            <h3>🗑️ Deleted Dog Profiles</h3>
            <p>Deleted profiles remain recoverable here. Recovering also creates a new Audit Log entry.</p>
          </div>
          <strong>${records.length}</strong>
        </div>
        <div class="v1115-recovery-list">
          ${records.map(record => `
            <article class="v1115-recovery-item">
              <div>
                <strong>🐾 ${escapeHtml(record.dogName || 'Deleted dog')}</strong>
                <span>${escapeHtml(record.deletedBreed || '')}${record.deletedOwnerName ? `${record.deletedBreed ? ' · ' : ''}Owner: ${escapeHtml(record.deletedOwnerName)}` : ''}</span>
                <small>Deleted ${escapeHtml(formatRecoveryDate(record.deletedAt || record.timestamp))}</small>
              </div>
              <button type="button" data-v1115-recover-profile="${escapeHtml(record.deletionId || record.reference || '')}" data-v1115-recover-dog="${escapeHtml(record.dogName || '')}">↩ Recover</button>
            </article>`).join('')}
        </div>
      </section>`;
  }

  async function renderAuditRecoveryPanel() {
    if ((document.body?.dataset?.wafflePage || '') !== 'audit') return;
    const auditContainer = document.getElementById('auditLogContainer');
    if (!auditContainer || typeof queryAppsScript !== 'function') return;

    try {
      const response = await queryAppsScript({ action: 'get_audit_log', limit: 500 });
      const deleted = Array.isArray(response?.records)
        ? response.records.filter(record => record && record.recoverable === true && (record.deletionId || record.reference))
        : [];

      const existing = document.querySelector('[data-v1115-recovery-panel]');
      if (!deleted.length) {
        existing?.remove();
        return;
      }

      const holder = document.createElement('div');
      holder.innerHTML = recoveryPanelHtml(deleted);
      const panel = holder.firstElementChild;
      if (existing) existing.replaceWith(panel);
      else auditContainer.parentElement.insertBefore(panel, auditContainer);
    } catch (error) {
      console.warn('Deleted profile recovery list could not load:', error);
    }
  }

  async function recoverDeletedProfile(button) {
    if (!button || typeof sendPayloadToAppsScript !== 'function') return;
    const deletionId = String(button.dataset.v1115RecoverProfile || '').trim();
    const dogName = String(button.dataset.v1115RecoverDog || 'this dog').trim();
    if (!deletionId) return;

    if (!window.confirm(`Recover ${dogName}'s deleted profile and linked owner data?`)) return;

    button.disabled = true;
    button.textContent = 'Recovering…';
    try {
      const result = await sendPayloadToAppsScript({
        action: 'restore_dog_profile',
        deletionId,
        actor: 'Web App User'
      });
      if (!result || result.result !== 'success') throw new Error(result?.error || 'Recovery failed.');

      if (typeof invalidateWaffleClientCaches === 'function') {
        await invalidateWaffleClientCaches(['directory', 'audit', 'reminders']);
      }
      alert(`${result.dogName || dogName} has been recovered.`);
      window.location.reload();
    } catch (error) {
      alert('Dog profile could not be recovered.\n\n' + (error?.message || String(error)));
      button.disabled = false;
      button.textContent = '↩ Recover';
    }
  }

  function wireEvents() {
    document.addEventListener('click', event => {
      const openProfile = event.target.closest('[data-open-directory-profile]');
      if (openProfile) {
        scheduleProfileEnhancement(openProfile.closest('.directory-card'));
      }

      const deleteButton = event.target.closest('[data-v1115-delete-profile]');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        const card = deleteButton.closest('.directory-card');
        const record = deleteButton._v1115Record || {};
        openDeleteModal(record, card);
        return;
      }

      const recoverButton = event.target.closest('[data-v1115-recover-profile]');
      if (recoverButton) {
        event.preventDefault();
        recoverDeletedProfile(recoverButton);
      }

      const activeCard = event.target.closest('.directory-card.is-profile-active');
      if (activeCard) scheduleProfileEnhancement(activeCard);
    });
  }

  function start() {
    wireEvents();
    ensureDeleteModal();

    // Bounded checks only; no persistent DOM observer.
    [400, 1200].forEach(delay => setTimeout(() => {
      const active = document.querySelector('.directory-card.is-profile-active');
      if (active) scheduleProfileEnhancement(active);
    }, delay));

    [350, 1100].forEach(delay => setTimeout(renderAuditRecoveryPanel, delay));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
