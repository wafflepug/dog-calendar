/* ============================================================
   WAFFLE HOUSE V11.1.7 — CARE SOURCE + MOBILE FIT FOLLOW-UP
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.7';
  const DIRECTORY_REFRESH_MARKER = 'waffle-v1117-directory-source-refresh';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sourceDefinitions() {
    const items = [];

    if (typeof V1112_REQUEST_SOURCES !== 'undefined' && Array.isArray(V1112_REQUEST_SOURCES)) {
      V1112_REQUEST_SOURCES.forEach(source => {
        if (!source || !source.value) return;
        items.push({
          value: String(source.value),
          label: String(source.label || source.value),
          image: String(source.image || '')
        });
      });
    }

    if (!items.some(item => item.value.toLowerCase() === 'other')) {
      items.push({ value: 'Other', label: 'Other', image: '' });
    }

    return items.filter((item, index, list) =>
      list.findIndex(candidate => candidate.value.toLowerCase() === item.value.toLowerCase()) === index
    );
  }

  function sourceDefinition(value) {
    const wanted = String(value || '').trim().toLowerCase();
    if (!wanted) return null;
    return sourceDefinitions().find(item => item.value.toLowerCase() === wanted) || {
      value: String(value || '').trim(),
      label: String(value || '').trim(),
      image: ''
    };
  }

  /* ----------------------------------------------------------
     REQUEST FROM — POLISHED "OTHER" TILE
     ---------------------------------------------------------- */

  function polishOtherSourceTiles(root = document) {
    root.querySelectorAll?.('[data-v1112-source-value="Other"]').forEach(button => {
      button.classList.add('v1117-source-other');
      const circle = button.querySelector('.v1112-source-circle');
      if (!circle) return;

      let label = circle.querySelector('span');
      if (!label) {
        label = document.createElement('span');
        circle.appendChild(label);
      }
      label.textContent = 'Other';
    });
  }

  /* ----------------------------------------------------------
     AT HOME — USE THE SAME PHOTO RECORD + TILE CROP AS CARE
     ---------------------------------------------------------- */

  function currentDogEvents() {
    if (typeof v111CurrentDogEvents === 'function') {
      return v111CurrentDogEvents();
    }

    const source = typeof v110LatestCalendarEvents !== 'undefined' && Array.isArray(v110LatestCalendarEvents)
      ? v110LatestCalendarEvents
      : [];
    const today = typeof getLocalTodayDateString === 'function'
      ? getLocalTodayDateString()
      : new Date().toISOString().slice(0, 10);
    const unique = new Map();

    source.forEach(eventRecord => {
      const props = eventRecord?.extendedProps || {};
      if (props.isPotential === true || props.isMeetGreet === true) return;
      const dates = typeof v10EventRawDates === 'function' ? v10EventRawDates(eventRecord) : {};
      if (!dates.start || !dates.end || today < dates.start || today > dates.end) return;
      const stayKey = typeof v110StayKeyForEvent === 'function' ? v110StayKeyForEvent(eventRecord) : '';
      if (!stayKey) return;
      if (typeof v110OperationForStay === 'function' && v110OperationForStay(stayKey)?.status === 'checked_out') return;
      unique.set(stayKey, eventRecord);
    });

    return Array.from(unique.values()).sort((a, b) =>
      String(a?.extendedProps?.dogName || a?.title || '').localeCompare(
        String(b?.extendedProps?.dogName || b?.title || '')
      )
    );
  }

  function ensureAtHomeModal() {
    let modal = document.getElementById('v1116AtHomeModal');

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'v1116AtHomeModal';
      modal.className = 'v108-modal v1116-calendar-detail-modal';
      modal.hidden = true;
      document.body.appendChild(modal);
    }

    if (modal.dataset.v1117Prepared !== 'true') {
      modal.dataset.v1117Prepared = 'true';
      modal.innerHTML = `
        <div class="v108-modal-card v1116-calendar-detail-card v1117-at-home-card" role="dialog" aria-modal="true" aria-labelledby="v1117AtHomeTitle">
          <div class="v108-modal-head">
            <div>
              <small>AT HOME</small>
              <h3 id="v1117AtHomeTitle">🏡 At Home Right Now</h3>
              <p>Current Waffle House guests. Photos use the same positioned profile image shown in Care.</p>
            </div>
            <button type="button" data-v1117-at-home-close aria-label="Close">×</button>
          </div>
          <div class="v1117-at-home-grid" data-v1117-at-home-list></div>
        </div>`;

      modal.addEventListener('click', event => {
        if (event.target === modal || event.target.closest('[data-v1117-at-home-close]')) {
          modal.hidden = true;
          return;
        }

        const dogButton = event.target.closest('[data-v1117-at-home-dog]');
        if (!dogButton) return;
        const stayKey = String(dogButton.dataset.v1117AtHomeDog || '').trim();
        if (!stayKey) return;
        window.location.href = `directory.html?stayKey=${encodeURIComponent(stayKey)}`;
      });
    }

    return modal;
  }

  function photoUrlFromBelongings(record) {
    const photo = record?.dogPhoto || null;
    return String(photo?.previewUrl || photo?.url || photo?.driveUrl || '');
  }

  async function loadCarePhotosForStays(stayKeys) {
    const cleanKeys = Array.from(new Set((stayKeys || []).map(String).filter(Boolean)));
    if (!cleanKeys.length || typeof queryAppsScript !== 'function') return {};

    try {
      const response = await queryAppsScript({
        action: 'get_belongings',
        stayKeys: cleanKeys
      }, {
        maxAttempts: 2,
        timeoutMs: 30000
      });

      const result = {};
      (response?.records || []).forEach(record => {
        if (!record?.stayKey) return;
        const url = photoUrlFromBelongings(record);
        if (url) result[String(record.stayKey)] = url;
      });
      return result;
    } catch (error) {
      console.warn('At Home Care photos could not be loaded in one request:', error);
      return {};
    }
  }

  async function renderAtHomeModal() {
    const modal = ensureAtHomeModal();
    const host = modal.querySelector('[data-v1117-at-home-list]');
    const list = currentDogEvents();

    if (!host) return;

    if (!list.length) {
      host.innerHTML = `
        <div class="v1116-detail-empty v1117-at-home-empty">
          <span>🏡</span>
          <strong>No dogs are currently at home.</strong>
          <small>Current boarding guests will appear here.</small>
        </div>`;
      return;
    }

    const stayKeys = list.map(eventRecord =>
      typeof v110StayKeyForEvent === 'function' ? v110StayKeyForEvent(eventRecord) : ''
    );

    host.innerHTML = list.map((eventRecord, index) => {
      const props = eventRecord?.extendedProps || {};
      const dogName = String(props.dogName || eventRecord?.title || 'Guest').trim();
      const stayKey = stayKeys[index];
      return `
        <button type="button"
          class="directory-guest-tile-open v1117-at-home-tile"
          data-v1117-at-home-dog="${escapeHtml(stayKey)}"
          aria-label="Open ${escapeHtml(dogName)} Care profile">
          <span class="directory-guest-tile-photo v1117-at-home-photo" data-v1117-at-home-photo="${index}" aria-hidden="true"></span>
          <span class="directory-guest-tile-name">${escapeHtml(dogName)}</span>
        </button>`;
    }).join('');

    const photoMap = await loadCarePhotosForStays(stayKeys);

    await Promise.all(list.map(async (eventRecord, index) => {
      const stayKey = stayKeys[index];
      let url = photoMap[stayKey] || '';

      if (!url && typeof v110PhotoForStay === 'function') {
        url = await v110PhotoForStay(stayKey);
      }

      if (!url) return;
      const target = host.querySelector(`[data-v1117-at-home-photo="${index}"]`);
      const tile = target?.closest('.v1117-at-home-tile');
      if (!target || !tile) return;

      target.innerHTML = `<img src="${escapeHtml(url)}" alt="" class="directory-guest-tile-image" loading="lazy">`;
      tile.classList.add('has-profile-photo');
    }));
  }

  async function openAtHomeModal() {
    const modal = ensureAtHomeModal();
    modal.hidden = false;
    await renderAtHomeModal();
  }

  function wireAtHomeTile() {
    document.addEventListener('click', event => {
      const tile = event.target.closest('[data-v10-jump="home"]');
      if (!tile || String(document.body?.dataset?.wafflePage || '') !== 'calendar') return;

      event.preventDefault();
      event.stopImmediatePropagation();
      openAtHomeModal().catch(error => {
        console.error('At Home modal could not open:', error);
      });
    }, true);
  }

  /* ----------------------------------------------------------
     CARE TILE — REQUEST SOURCE BADGE
     ---------------------------------------------------------- */

  function directoryCardForStay(stayKey) {
    if (typeof findDirectoryCardByStayKey === 'function') {
      return findDirectoryCardByStayKey(stayKey);
    }

    return Array.from(document.querySelectorAll('.directory-card[data-directory-stay-key]'))
      .find(card => String(card.dataset.directoryStayKey || '') === String(stayKey || '')) || null;
  }

  function careSourceBadgeHtml(requestSource) {
    const source = sourceDefinition(requestSource);
    if (!source) return '';

    const isOther = source.value.toLowerCase() === 'other';
    return `
      <span class="v1117-care-source-badge${isOther ? ' is-other' : ''}"
        data-v1117-care-source-badge="${escapeHtml(source.value)}"
        title="Requested via ${escapeHtml(source.label)}"
        aria-label="Requested via ${escapeHtml(source.label)}">
        ${source.image
          ? `<img src="${escapeHtml(source.image)}" alt="">`
          : `<span>${escapeHtml(source.label)}</span>`}
      </span>`;
  }

  function renderCareSourceBadge(stayKey, requestSource) {
    const card = directoryCardForStay(stayKey);
    if (!card) return;
    const tile = card.querySelector('.directory-guest-tile-open');
    if (!tile) return;

    tile.querySelector('[data-v1117-care-source-badge]')?.remove();
    card.classList.remove('has-request-source');

    const html = careSourceBadgeHtml(requestSource);
    if (!html) return;

    tile.insertAdjacentHTML('beforeend', html);
    card.classList.add('has-request-source');
  }

  function renderCareSourceBadgesFromResponse(response) {
    (response?.bookings || []).forEach(booking => {
      if (!booking?.stayKey) return;
      renderCareSourceBadge(booking.stayKey, booking.requestSource || '');
    });
  }

  function wireDirectoryResponse() {
    if (typeof applyGuestDirectoryResponse !== 'function' || applyGuestDirectoryResponse.v1117Wrapped) return;

    const base = applyGuestDirectoryResponse;
    const wrapped = function(response, options = {}) {
      const result = base(response, options);
      setTimeout(() => renderCareSourceBadgesFromResponse(response), 35);
      return result;
    };
    wrapped.v1117Wrapped = true;
    applyGuestDirectoryResponse = wrapped;
  }

  function renderCachedCareBadges() {
    if (typeof directorySummaryRecordsCache === 'undefined') return;
    Object.entries(directorySummaryRecordsCache || {}).forEach(([stayKey, summary]) => {
      renderCareSourceBadge(stayKey, summary?.requestSource || '');
    });
  }

  /* ----------------------------------------------------------
     DOG PROFILE — EDIT REQUEST SOURCE IN PLACE
     ---------------------------------------------------------- */

  function profileStayKey(card) {
    return String(card?.dataset?.directoryStayKey || card?.dataset?.stayKey || '').trim();
  }

  function ensureProfileSourceHost(card) {
    let host = card?.querySelector('[data-v1115-profile-source-host]');
    if (host) return host;
    if (!card) return null;

    const tabs = card.querySelector('.directory-main-profile-tabs');
    const panel = card.querySelector('[data-directory-main-panel="profile"]');
    host = document.createElement('div');
    host.className = 'v1115-profile-source-host';
    host.setAttribute('data-v1115-profile-source-host', 'true');

    if (tabs?.parentElement) tabs.parentElement.insertBefore(host, tabs);
    else panel?.insertBefore(host, panel.firstChild);
    return host;
  }

  async function profileRecord(card) {
    const stayKey = profileStayKey(card);
    if (!stayKey) return null;

    try {
      if (typeof directoryProfileDetailCache !== 'undefined') {
        const cached = directoryProfileDetailCache[stayKey];
        if (cached && cached.requestSource !== undefined) return cached;
      }
    } catch (_) {}

    if (typeof queryAppsScript !== 'function') return null;
    const response = await queryAppsScript({ action: 'get_guest_profile', stayKey }, {
      maxAttempts: 2,
      timeoutMs: 30000
    });
    return response?.record || null;
  }

  function profileSourceTileHtml(source, selected) {
    const active = source.value.toLowerCase() === String(selected || '').toLowerCase();
    const isOther = source.value.toLowerCase() === 'other';
    return `
      <button type="button"
        class="v1117-profile-source-tile${active ? ' is-selected' : ''}${isOther ? ' is-other' : ''}"
        data-v1117-profile-source-value="${escapeHtml(source.value)}"
        aria-pressed="${active ? 'true' : 'false'}"
        title="Set Request From to ${escapeHtml(source.label)}">
        <span class="v1117-profile-source-circle">
          ${source.image
            ? `<img src="${escapeHtml(source.image)}" alt="">`
            : `<span class="v1117-profile-source-other-label">Other</span>`}
        </span>
        <span class="v1117-profile-source-caption">${escapeHtml(source.label)}</span>
      </button>`;
  }

  function renderProfileSourceEditor(card, record, statusText = '') {
    if (!card) return;
    const stayKey = profileStayKey(card);
    const host = ensureProfileSourceHost(card);
    if (!host || !stayKey) return;

    const selected = String(record?.requestSource || '').trim();
    const signature = `${stayKey}|${selected}`;
    if (
      host.dataset.v1117SourceRender === signature &&
      host.querySelector('.v1117-profile-source-picker') &&
      !statusText
    ) {
      return;
    }

    host.dataset.v1117SourceRender = signature;
    host.innerHTML = `
      <section class="v1117-profile-source-picker" data-v1117-profile-source-picker data-v1117-stay-key="${escapeHtml(stayKey)}">
        <div class="v1117-profile-source-heading">
          <div>
            <span>REQUEST FROM</span>
            <small>Choose where this dog originally came through.</small>
          </div>
          <strong data-v1117-profile-source-status>${escapeHtml(statusText || (selected ? `Selected: ${selected}` : 'Not recorded'))}</strong>
        </div>
        <div class="v1117-profile-source-grid" role="group" aria-label="Request From">
          ${sourceDefinitions().map(source => profileSourceTileHtml(source, selected)).join('')}
        </div>
      </section>`;
  }

  function scheduleProfileSourceEditor(card) {
    if (!card) return;
    [140, 460, 1120, 1900].forEach(delay => {
      setTimeout(async () => {
        if (!card.isConnected || !card.classList.contains('is-profile-active')) return;
        try {
          const record = await profileRecord(card);
          if (record) renderProfileSourceEditor(card, record);
        } catch (error) {
          console.warn('Request From editor could not load:', error);
        }
      }, delay);
    });
  }

  async function saveProfileRequestSource(button) {
    const picker = button.closest('[data-v1117-profile-source-picker]');
    const card = button.closest('.directory-card');
    const stayKey = String(picker?.dataset?.v1117StayKey || profileStayKey(card)).trim();
    const requestSource = String(button.dataset.v1117ProfileSourceValue || '').trim();
    if (!picker || !card || !stayKey || !requestSource || typeof sendPayloadToAppsScript !== 'function') return;

    const status = picker.querySelector('[data-v1117-profile-source-status]');
    const buttons = Array.from(picker.querySelectorAll('[data-v1117-profile-source-value]'));
    buttons.forEach(item => { item.disabled = true; });
    if (status) status.textContent = 'Saving…';

    try {
      const record = await profileRecord(card) || {};
      const response = await sendPayloadToAppsScript({
        action: 'update_request_source',
        stayKey,
        dogName: String(record.dogName || card.dataset.directoryDogName || card.dataset.dogName || ''),
        requestSource
      });

      if (!response || response.result !== 'success') {
        throw new Error(response?.error || 'Request From could not be updated.');
      }

      const updated = { ...record, requestSource: String(response.requestSource || requestSource) };

      try {
        if (typeof directoryProfileDetailCache !== 'undefined') {
          directoryProfileDetailCache[stayKey] = updated;
        }
        if (typeof directorySummaryRecordsCache !== 'undefined') {
          directorySummaryRecordsCache[stayKey] = {
            ...(directorySummaryRecordsCache[stayKey] || {}),
            stayKey,
            requestSource: updated.requestSource
          };
        }
      } catch (_) {}

      renderCareSourceBadge(stayKey, updated.requestSource);
      hostInvalidateDirectoryCache();
      renderProfileSourceEditor(card, updated, 'Saved');
    } catch (error) {
      console.error('Request From save failed:', error);
      if (status) status.textContent = error?.message || String(error);
      buttons.forEach(item => { item.disabled = false; });
    }
  }

  function hostInvalidateDirectoryCache() {
    if (typeof invalidateWaffleClientCaches !== 'function') return;
    Promise.resolve(invalidateWaffleClientCaches(['directory', 'audit'])).catch(() => {});
  }

  function wireProfileSourceEditor() {
    document.addEventListener('click', event => {
      const choice = event.target.closest('[data-v1117-profile-source-value]');
      if (choice) {
        event.preventDefault();
        event.stopPropagation();
        saveProfileRequestSource(choice);
        return;
      }

      const open = event.target.closest('[data-open-directory-profile]');
      if (open) {
        scheduleProfileSourceEditor(open.closest('.directory-card'));
        return;
      }

      const profileTab = event.target.closest('[data-directory-main-tab="profile"], [data-v110-tab="master"]');
      if (profileTab) {
        scheduleProfileSourceEditor(profileTab.closest('.directory-card'));
      }
    });
  }

  async function forceOneDirectorySourceRefresh() {
    if (String(document.body?.dataset?.wafflePage || '') !== 'directory') return;

    try {
      if (localStorage.getItem(DIRECTORY_REFRESH_MARKER) === VERSION) return;
      localStorage.setItem(DIRECTORY_REFRESH_MARKER, VERSION);
      if (typeof invalidateWaffleClientCaches === 'function') {
        await invalidateWaffleClientCaches(['directory']);
      }
      if (typeof loadGuestDirectoryConsolidated === 'function') {
        await loadGuestDirectoryConsolidated({ force: true, quiet: true });
      }
    } catch (error) {
      console.warn('V11.1.7 directory source refresh skipped:', error);
    }
  }

  function start() {
    polishOtherSourceTiles(document);
    wireAtHomeTile();
    wireDirectoryResponse();
    wireProfileSourceEditor();

    [350, 1050, 2200].forEach(delay => setTimeout(() => {
      polishOtherSourceTiles(document);
      renderCachedCareBadges();
      const active = document.querySelector('.directory-card.is-profile-active');
      if (active) scheduleProfileSourceEditor(active);
    }, delay));

    forceOneDirectorySourceRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
