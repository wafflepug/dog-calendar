/* ============================================================
   WAFFLE HOUSE V11.2.14 — AUTOMATIC MASTER PHOTO PROPAGATION
   ------------------------------------------------------------
   On the Care directory, ask Apps Script once per page load to propagate
   usable Master Profile photos into matching photo-empty upcoming stays.
   Updated cards are refreshed immediately so the inherited photo is visible
   without pressing the manual Master sync button.
   ============================================================ */
(function () {
  'use strict';

  if (window.__WAFFLE_MASTER_UPCOMING_PHOTO_SYNC_V11214__) return;
  window.__WAFFLE_MASTER_UPCOMING_PHOTO_SYNC_V11214__ = true;

  const VERSION = '11.2.14';
  let autoSyncStarted = false;
  let autoSyncPromise = null;

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
    if (!key || typeof window.queryAppsScript !== 'function') return;

    try {
      const response = await window.queryAppsScript(
        { action: 'get_guest_profile', stayKey: key, syncRefresh: VERSION, _: Date.now() },
        { maxAttempts: 1, timeoutMs: 20000 }
      );
      const record = response?.record || response?.data?.record || null;
      if (!record) return;

      cardsForStay(key).forEach(card => {
        try {
          if (typeof window.renderDirectoryCareProfile === 'function') {
            window.renderDirectoryCareProfile(card, record);
          } else {
            applyPhotoFallback(card, record);
          }
          if (typeof window.v110EnhanceCareCard === 'function') {
            window.v110EnhanceCareCard(card);
          }
        } catch (error) {
          console.warn('V11.2.14 could not refresh a synced stay card:', error);
          applyPhotoFallback(card, record);
        }
      });
    } catch (error) {
      console.warn('V11.2.14 could not reload synced stay', key, error);
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

  async function runAutomaticMasterPhotoSync() {
    if (autoSyncPromise) return autoSyncPromise;
    if (!isCareDirectoryPage()) return null;
    if (typeof window.sendPayloadToAppsScript !== 'function') return null;

    autoSyncStarted = true;
    autoSyncPromise = (async () => {
      try {
        const result = await window.sendPayloadToAppsScript({
          action: 'sync_dog_master_photos_to_upcoming_stays',
          source: 'care-directory-auto-sync',
          clientVersion: VERSION
        });

        const stayKeys = Array.isArray(result?.updatedStayKeys)
          ? result.updatedStayKeys
          : Array.isArray(result?.updates)
            ? result.updates.map(update => update?.stayKey)
            : [];

        if (stayKeys.length) {
          try {
            if (typeof window.invalidateWaffleClientCaches === 'function') {
              await window.invalidateWaffleClientCaches(['directory']);
            }
          } catch (_) {}
          await refreshStayKeys(stayKeys);
        }

        try {
          window.dispatchEvent(new CustomEvent('waffle:master-upcoming-photo-sync', {
            detail: {
              version: VERSION,
              updatedCount: Number(result?.updatedCount || 0),
              updatedStayKeys: stayKeys
            }
          }));
        } catch (_) {}

        return result;
      } catch (error) {
        console.warn('Automatic Master Profile photo sync was unavailable:', error);
        return null;
      }
    })();

    return autoSyncPromise;
  }

  async function refreshMatchingUpcomingCards(dogName, breed) {
    const dogKey = normalizeText(dogName);
    const breedKey = normalizeText(breed);
    const stayKeys = allStayCards()
      .filter(card => isUpcomingCard(card))
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
      const result = await base.call(this, card, button);
      await refreshMatchingUpcomingCards(dogName, breed);
      return result;
    };
    wrapped.__v11214Wrapped = true;
    wrapped.__v11214Base = base;
    window.v110SaveMasterFromCard = wrapped;
  }

  function scheduleAutoSync() {
    wrapMasterSaveForImmediateRefresh();
    if (autoSyncStarted) return;
    window.setTimeout(() => {
      if (!autoSyncStarted) runAutomaticMasterPhotoSync();
    }, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleAutoSync, { once: true });
  } else {
    scheduleAutoSync();
  }

  window.addEventListener('waffle:maintenance-clear', scheduleAutoSync);
  window.addEventListener('pageshow', () => {
    wrapMasterSaveForImmediateRefresh();
  });

  window.WAFFLE_MASTER_UPCOMING_PHOTO_SYNC_V11214 = Object.freeze({
    version: VERSION,
    sync: runAutomaticMasterPhotoSync,
    refreshStay
  });
})();
