/* ============================================================
   WAFFLE HOUSE V11.2.17 — EXPLICIT SETTINGS MASTER PHOTO SYNC
   ----------------------------------------------------------------
   Care reads never propagate master profile photos into upcoming stays.
   Settings exposes an explicit "Resync Master Profile Photos" maintenance
   action for a safe bulk backfill.
   ============================================================ */
(function () {
  'use strict';

  if (window.__WAFFLE_MASTER_UPCOMING_PHOTO_SYNC_V11214__) return;
  window.__WAFFLE_MASTER_UPCOMING_PHOTO_SYNC_V11214__ = true;

  const VERSION = '11.2.17';
  let settingsResyncRunning = false;

  function normalizeText(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function localToday() {
    if (typeof window.getLocalTodayDateString === 'function') {
      return String(window.getLocalTodayDateString() || '').slice(0, 10);
    }
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function cardStayKey(card) {
    return String(card?.dataset?.directoryStayKey || card?.dataset?.stayKey || '').trim();
  }

  function cardDogName(card) {
    return String(card?.dataset?.directoryDogName || card?.dataset?.dogName || '').trim();
  }

  function cardBreed(card) {
    return String(
      card?.querySelector?.('.directory-primary-breed')?.textContent ||
      card?.dataset?.v1088Breed ||
      ''
    ).trim();
  }

  function cardStartDate(card) {
    return String(card?.dataset?.directoryStartDate || card?.dataset?.startDate || '').slice(0, 10);
  }

  function isUpcomingCard(card) {
    if (!card) return false;
    if (card.dataset?.v1082PastStay === 'true') return false;
    const start = cardStartDate(card);
    return !start || start >= localToday();
  }

  function allStayCards() {
    return Array.from(document.querySelectorAll('[data-directory-stay-key], [data-stay-key]'))
      .filter(card => !!cardStayKey(card));
  }

  function cardsForStay(stayKey) {
    const key = String(stayKey || '').trim();
    if (!key) return [];
    return allStayCards().filter(card => cardStayKey(card) === key);
  }

  function photoUrl(record) {
    const gallery = Array.isArray(record?.dogPhotoGallery) ? record.dogPhotoGallery : [];
    const photo = record?.dogPhoto || (gallery.length ? gallery[gallery.length - 1] : null);
    return String(photo?.previewUrl || photo?.url || photo?.driveUrl || '').trim();
  }

  function applyPhotoFallback(card, record) {
    const url = photoUrl(record);
    if (!card || !url) return;
    const host = card.querySelector('[data-directory-tile-photo]');
    if (!host) return;

    const img = document.createElement('img');
    img.src = url;
    img.alt = `${cardDogName(card) || 'Dog'} profile photo`;
    img.loading = 'lazy';
    host.replaceChildren(img);
  }

  async function refreshStay(stayKey) {
    const key = String(stayKey || '').trim();
    if (!key || !window.WAFFLE_CARE_PROFILE_READS?.read) return;
    const cards = cardsForStay(key);
    // The sync result names only a legacy key; never fan one response out to
    // cards that may carry conflicting stable identities.
    if (cards.length !== 1) return;
    const card = cards[0];
    try {
      // This sync changes photos only. Keep an open Care profile draft intact.
      const response = await window.WAFFLE_CARE_PROFILE_READS.read(card, { force: true });
      const record = response?.data?.record;
      if (!card.isConnected || !record || !window.WAFFLE_CARE_PROFILE_READS.matches(card, record)) return;
      applyPhotoFallback(card, record);
    } catch (error) {
      console.warn('V11.2.16 could not reload synced stay', key, error);
    }
  }
  async function refreshStayKeys(stayKeys) {
    const unique = Array.from(new Set((Array.isArray(stayKeys) ? stayKeys : [])
      .map(value => String(value || '').trim())
      .filter(Boolean)));
    for (const stayKey of unique) {
      await refreshStay(stayKey);
    }
  }

  function isCareDirectoryPage() {
    const page = normalizeText(
      window.WAFFLE_PAGE ||
      document.body?.dataset?.wafflePage ||
      ''
    );
    if (page === 'directory' || page === 'care') return true;
    if (/\/(care|directory)(?:\.html)?$/i.test(location.pathname)) return true;
    return allStayCards().length > 0;
  }

  async function refreshMatchingUpcomingCards(dogName, breed, dogId) {
    const dogKey = normalizeText(dogName);
    const breedKey = normalizeText(breed);
    const stableDogId = String(dogId || '').trim();
    const stayKeys = allStayCards()
      .filter(card => isUpcomingCard(card))
      .filter(card => !stableDogId || String(card.dataset?.directoryDogId || '').trim() === stableDogId)
      .filter(card => normalizeText(cardDogName(card)) === dogKey)
      .filter(card => !breedKey || normalizeText(cardBreed(card)) === breedKey)
      .map(cardStayKey);

    await refreshStayKeys(stayKeys);
  }

  function wrapMasterSaveForImmediateRefresh() {
    const base = window.v110SaveMasterFromCard;
    if (typeof base !== 'function' || base.__v11214Wrapped) return;

    const wrapped = async function (card, button) {
      const dogName = cardDogName(card);
      const breed = cardBreed(card);
      const dogId = String(card?.dataset?.directoryDogId || '').trim();
      const result = await base.call(this, card, button);
      await refreshMatchingUpcomingCards(dogName, breed, dogId);
      return result;
    };
    wrapped.__v11214Wrapped = true;
    wrapped.__v11214Base = base;
    window.v110SaveMasterFromCard = wrapped;
  }

  function ensureSettingsResyncStyles() {
    if (document.getElementById('v11216SettingsPhotoResyncStyles')) return;
    const style = document.createElement('style');
    style.id = 'v11216SettingsPhotoResyncStyles';
    style.textContent = `
      #wh75SettingsPanel .v11216-settings-resync-section {
        border-top:1px solid var(--wh75-line,#e2e8f0);
      }
      #wh75SettingsPanel .v11216-settings-resync-button {
        width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;
        border:1px solid var(--wh75-accent,#7c3aed);border-radius:14px;padding:10px 14px;
        background:var(--wh75-accent,#7c3aed);color:#fff;font:inherit;font-size:12px;font-weight:900;cursor:pointer;
        box-shadow:0 6px 18px var(--wh75-ring,rgba(124,58,237,.18));
      }
      #wh75SettingsPanel .v11216-settings-resync-button:hover:not(:disabled) {
        background:var(--wh75-accent-strong,var(--wh75-accent,#7c3aed));
      }
      #wh75SettingsPanel .v11216-settings-resync-button:disabled {
        opacity:.65;cursor:wait;
      }
      #wh75SettingsPanel .v11216-settings-resync-note {
        margin:8px 0 0;color:var(--wh75-muted,#64748b);font-size:12px;line-height:1.5;font-weight:700;
      }
      #wh75SettingsPanel .v11216-settings-resync-status {
        min-height:0;margin-top:10px;padding:0;color:var(--wh75-muted,#64748b);font-size:12px;line-height:1.5;font-weight:750;
      }
      #wh75SettingsPanel .v11216-settings-resync-section .wh75-settings-help {
        font-size:12px;line-height:1.5;
      }
      #wh75SettingsPanel .v11216-settings-resync-status:not(:empty) {
        min-height:18px;padding:9px 10px;border-radius:10px;background:var(--wh75-shell-2,#f8fafc);
      }
      #wh75SettingsPanel .v11216-settings-resync-status[data-state="success"] {
        color:#166534;
      }
      body.dark-theme #wh75SettingsPanel .v11216-settings-resync-status[data-state="success"] {
        color:#86efac;
      }
      #wh75SettingsPanel .v11216-settings-resync-status[data-state="error"] {
        color:#b91c1c;
      }
      #wh75SettingsPanel [data-v11216-master-photo-resync-retry] { margin-top:8px; }
      body.dark-theme #wh75SettingsPanel .v11216-settings-resync-status[data-state="error"] {
        color:#fca5a5;
      }
    `;
    document.head.appendChild(style);
  }

  function installSettingsPhotoResyncControl() {
    const panel = document.getElementById('wh75SettingsPanel');
    if (!panel) return false;
    if (panel.querySelector('[data-v11216-master-photo-resync]')) return true;

    ensureSettingsResyncStyles();
    const section = document.createElement('div');
    section.className = 'wh75-settings-section v11216-settings-resync-section';
    section.dataset.v11216SettingsPhotoResync = '';
    section.innerHTML = `
      <h3 class="wh75-settings-title">Profile Data</h3>
      <p class="wh75-settings-help">Copy saved Master Profile photos to matching upcoming bookings that do not have a usable booking-specific photo. Opening Care and viewing profile categories never runs this maintenance action.</p>
      <button class="v11216-settings-resync-button" type="button" data-v11216-master-photo-resync>
        <span aria-hidden="true">↻</span><span>Resync Master Profile Photos</span>
      </button>
      <p class="v11216-settings-resync-note">Existing booking-specific photos are preserved. Matching uses the same Dog ID; unmatched or ambiguous identities are skipped. This changes saved booking data.</p>
        <div class="v11216-settings-resync-status" data-v11216-master-photo-resync-status role="status" aria-live="polite"></div>
    `;
    panel.appendChild(section);
    return true;
  }

  function syncResultObject(response) {
    if (response?.data && typeof response.data === 'object') return response.data;
    return response && typeof response === 'object' ? response : {};
  }

  function setSettingsResyncStatus(section, message, state) {
    const status = section?.querySelector('[data-v11216-master-photo-resync-status]');
    if (!status) return;
    status.textContent = String(message || '');
    status.setAttribute('role', state === 'error' ? 'alert' : 'status');
    status.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  }

  function isTransportFailure(error) {
    return error?.name === 'TypeError' || error?.code === 'NETWORK_ERROR' || error?.transport === true;
  }

  async function runSettingsMasterPhotoResync(button) {
    if (settingsResyncRunning) return null;
    const section = button?.closest('[data-v11216-settings-photo-resync]');
    if (!button?.matches?.('[data-v11216-master-photo-resync]') || !button.isConnected || !section) return null;
    section?.querySelector('[data-v11216-master-photo-resync-retry]')?.remove();
    if (typeof window.sendPayloadToAppsScript !== 'function') {
      setSettingsResyncStatus(section, 'Resync unavailable — the Waffle data service is not available.', 'error');
      return null;
    }
    if (navigator.onLine === false) {
      setSettingsResyncStatus(section, 'Resync unavailable while offline. Reconnect before starting this data change.', 'error');
      return null;
    }

    const confirmed = window.confirm(
      'Resync Master Profile photos to matching upcoming stays?\n\n' +
      'Stays that already have a usable booking-specific photo will not be changed.'
    );
    if (!confirmed) return null;

    const label = button?.querySelector('span:last-child');
    settingsResyncRunning = true;
    if (button) button.disabled = true;
    if (label) label.textContent = 'Resyncing photos…';
    setSettingsResyncStatus(section, 'Scanning Master Profiles and upcoming stays…', 'running');

    try {
      const response = await window.sendPayloadToAppsScript({
        action: 'sync_dog_master_photos_to_upcoming_stays',
        source: 'settings-manual-resync',
        clientVersion: VERSION
      });
      const result = syncResultObject(response);
      const counts = ['updatedCount', 'skippedExistingCount', 'missingMasterPhotoCount', 'eligibleStayCount'];
      const validCounts = counts.every(key => typeof result[key] === 'number' && Number.isInteger(result[key]) && result[key] >= 0);
      if (result.result !== 'success' || result.error || result.queued === true || !validCounts) {
        const message = String(result.error || result.message || 'The server could not confirm the resync.');
        setSettingsResyncStatus(section, `Resync stopped — ${message}`, 'error');
        return null;
      }
      const updated = Number(result.updatedCount || 0);
      const skipped = Number(result.skippedExistingCount || 0);
      const missing = Number(result.missingMasterPhotoCount || 0);
      const eligible = Number(result.eligibleStayCount || 0);
      const stayKeys = Array.isArray(result.updatedStayKeys)
        ? result.updatedStayKeys
        : Array.isArray(result.updates)
          ? result.updates.map(update => update?.stayKey)
          : [];

      if (stayKeys.length) {
        try {
          if (typeof window.invalidateWaffleClientCaches === 'function') {
            await window.invalidateWaffleClientCaches(['directory']);
          }
        } catch (_) {}
        if (isCareDirectoryPage()) await refreshStayKeys(stayKeys);
      }

      setSettingsResyncStatus(
        section,
        `Complete — ${updated} updated, ${skipped} already had photos, ${missing} missing a Master photo (${eligible} eligible stays).`,
        'success'
      );

      try {
        window.dispatchEvent(new CustomEvent('waffle:master-upcoming-photo-sync', {
          detail: {
            version: VERSION,
            source: 'settings-manual-resync',
            updatedCount: updated,
            updatedStayKeys: stayKeys
          }
        }));
      } catch (_) {}

      return result;
    } catch (error) {
      const message = error?.message || String(error);
      setSettingsResyncStatus(section, `Resync failed — ${message}${isTransportFailure(error) ? ' You can retry when the connection is stable.' : ' Check the reported identity or server error before trying again.'}`, 'error');
      const retry = section?.querySelector('[data-v11216-master-photo-resync-retry]');
      if (retry) retry.remove();
      if (isTransportFailure(error) && navigator.onLine !== false && section) {
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.dataset.v11216MasterPhotoResyncRetry = '';
        retryButton.className = 'v11216-settings-resync-button';
        retryButton.textContent = 'Retry resync';
        section.appendChild(retryButton);
        retryButton.focus();
      }
      return null;
    } finally {
      settingsResyncRunning = false;
      if (button) button.disabled = false;
      if (label) label.textContent = 'Resync Master Profile Photos';
    }
  }

  function scheduleSettingsControlInstall() {
    window.setTimeout(installSettingsPhotoResyncControl, 0);
    window.setTimeout(installSettingsPhotoResyncControl, 150);
  }

  function scheduleSettingsControl() {
    wrapMasterSaveForImmediateRefresh();
    scheduleSettingsControlInstall();
  }

  document.addEventListener('click', event => {
    const settingsTrigger = event.target?.closest?.('[data-wh75-settings],#wh75SettingsButton');
    if (settingsTrigger) {
      scheduleSettingsControlInstall();
      return;
    }

    const retryButton = event.target?.closest?.('[data-v11216-master-photo-resync-retry]');
    const resyncButton = retryButton || event.target?.closest?.('[data-v11216-master-photo-resync]');
    if (!resyncButton) return;
    event.preventDefault();
    event.stopPropagation();
    const section = resyncButton.closest('[data-v11216-settings-photo-resync]');
    const primary = section?.querySelector('[data-v11216-master-photo-resync]');
    if (retryButton) retryButton.remove();
    if (retryButton) primary?.focus();
    runSettingsMasterPhotoResync(primary || resyncButton).catch(error => {
      console.warn('Settings Master Profile photo resync failed:', error);
    });
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleSettingsControl, { once: true });
  } else {
    scheduleSettingsControl();
  }

  window.addEventListener('waffle:maintenance-clear', () => {
    wrapMasterSaveForImmediateRefresh();
    scheduleSettingsControlInstall();
  });
  window.addEventListener('pageshow', () => {
    wrapMasterSaveForImmediateRefresh();
    scheduleSettingsControlInstall();
  });

  window.WAFFLE_MASTER_UPCOMING_PHOTO_SYNC_V11214 = Object.freeze({
    version: VERSION,
    sync: async () => null,
    resync: runSettingsMasterPhotoResync,
    refreshStay,
    installSettingsControl: installSettingsPhotoResyncControl
  });
})();
