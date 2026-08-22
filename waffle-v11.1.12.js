/* ============================================================
   WAFFLE HOUSE V11.1.12 — CARE REQUEST FROM PLACEMENT + IDLE RESILIENCE
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.12';

  function isDirectoryPage() {
    return String(document.body?.dataset?.wafflePage || '') === 'directory';
  }

  function escapeHtml(value) {
    if (typeof escapeDashboardHtml === 'function') {
      return escapeDashboardHtml(value == null ? '' : String(value));
    }

    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sourceDefinitions() {
    const items = [];

    try {
      if (typeof V1112_REQUEST_SOURCES !== 'undefined' && Array.isArray(V1112_REQUEST_SOURCES)) {
        V1112_REQUEST_SOURCES.forEach(source => {
          if (!source?.value) return;
          items.push({
            value: String(source.value),
            label: String(source.label || source.value),
            image: String(source.image || '')
          });
        });
      }
    } catch (_) {}

    if (!items.some(item => item.value.toLowerCase() === 'other')) {
      items.push({ value: 'Other', label: 'Other', image: '' });
    }

    return items.filter((item, index, list) =>
      list.findIndex(candidate => candidate.value.toLowerCase() === item.value.toLowerCase()) === index
    );
  }

  function profileStayKey(card) {
    return String(card?.dataset?.directoryStayKey || card?.dataset?.stayKey || '').trim();
  }

  function activeProfileCard() {
    return document.querySelector('.directory-card.is-profile-active') || null;
  }

  function notesRow(card) {
    return card?.querySelector('[data-directory-edit-field="notes"]') || null;
  }

  function ensureStableSourceHost(card) {
    if (!card) return null;

    let host = card.querySelector('[data-v1115-profile-source-host]');

    if (!host) {
      host = document.createElement('div');
      host.className = 'v1115-profile-source-host';
      host.setAttribute('data-v1115-profile-source-host', 'true');
    }

    host.classList.add('v11112-care-source-host');
    host.setAttribute('data-v11112-care-source-host', 'true');

    const notes = notesRow(card);
    if (notes?.parentElement) {
      if (host.parentElement !== notes.parentElement || notes.nextElementSibling !== host) {
        notes.insertAdjacentElement('afterend', host);
      }
      return host;
    }

    /* Fallback only for historical/legacy card markup. Current Care cards
       always have the Notes row, but keep the editor reachable if that
       markup changes again. */
    const tabs = card.querySelector('.directory-main-profile-tabs');
    const panel = card.querySelector('[data-directory-main-panel="profile"]');

    if (tabs?.parentElement) {
      tabs.parentElement.insertBefore(host, tabs);
    } else if (panel && host.parentElement !== panel) {
      panel.insertBefore(host, panel.firstChild);
    }

    return host;
  }

  function hasOwnRequestSource(record) {
    return !!record &&
      typeof record === 'object' &&
      Object.prototype.hasOwnProperty.call(record, 'requestSource');
  }

  function cachedProfileRecord(card) {
    const stayKey = profileStayKey(card);
    if (!stayKey) return null;

    let detail = null;
    let summary = null;

    try {
      if (typeof directoryProfileDetailCache !== 'undefined') {
        detail = directoryProfileDetailCache?.[stayKey] || null;
      }
    } catch (_) {}

    try {
      if (typeof directorySummaryRecordsCache !== 'undefined') {
        summary = directorySummaryRecordsCache?.[stayKey] || null;
      }
    } catch (_) {}

    if (hasOwnRequestSource(detail)) {
      return {
        ...(summary || {}),
        ...detail,
        stayKey
      };
    }

    if (hasOwnRequestSource(summary)) {
      return {
        ...(detail || {}),
        ...summary,
        stayKey
      };
    }

    const cardSource = String(card.dataset.v11112RequestSource || '').trim();
    if (card.dataset.v11112RequestSourceKnown === 'true') {
      return {
        ...(summary || {}),
        ...(detail || {}),
        stayKey,
        requestSource: cardSource
      };
    }

    return detail || summary || null;
  }

  function rememberRecord(card, record) {
    if (!card || !record) return record;

    const stayKey = profileStayKey(card);
    if (!stayKey) return record;

    const requestSource = String(record.requestSource || '').trim();
    card.dataset.v11112RequestSource = requestSource;
    card.dataset.v11112RequestSourceKnown = 'true';

    try {
      if (typeof directoryProfileDetailCache !== 'undefined') {
        directoryProfileDetailCache[stayKey] = {
          ...(directoryProfileDetailCache[stayKey] || {}),
          ...record,
          stayKey,
          requestSource
        };
      }
    } catch (_) {}

    try {
      if (typeof directorySummaryRecordsCache !== 'undefined') {
        directorySummaryRecordsCache[stayKey] = {
          ...(directorySummaryRecordsCache[stayKey] || {}),
          stayKey,
          requestSource
        };
      }
    } catch (_) {}

    return record;
  }

  async function resolveProfileRecord(card, options = {}) {
    const stayKey = profileStayKey(card);
    if (!stayKey) return null;

    const cached = cachedProfileRecord(card);

    if (!options.forceRemote && hasOwnRequestSource(cached)) {
      return cached;
    }

    if (typeof queryAppsScript !== 'function') {
      return cached;
    }

    try {
      const response = await queryAppsScript({
        action: 'get_guest_profile',
        stayKey
      }, {
        maxAttempts: 2,
        timeoutMs: 30000,
        dedupe: false
      });

      const remote = response?.record || null;
      if (!remote) return cached;

      /* A summary produced by the directory endpoint can still contain the
         Request From value if an older profile response does not. Prefer the
         explicit remote value when present, otherwise retain the known one. */
      const merged = {
        ...(cached || {}),
        ...remote,
        stayKey,
        requestSource: hasOwnRequestSource(remote)
          ? String(remote.requestSource || '').trim()
          : String(cached?.requestSource || '').trim()
      };

      rememberRecord(card, merged);
      return merged;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  }

  function sourceTileHtml(source, selected) {
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

  function renderStableSourceEditor(card, record, statusText = '') {
    if (!card) return;

    const stayKey = profileStayKey(card);
    const host = ensureStableSourceHost(card);
    if (!host || !stayKey) return;

    const selected = String(record?.requestSource || '').trim();
    rememberRecord(card, {
      ...(record || {}),
      stayKey,
      requestSource: selected
    });

    host.dataset.v1117SourceRender = `${stayKey}|${selected}`;
    host.innerHTML = `
      <section class="v1117-profile-source-picker v11112-care-source-picker"
        data-v1117-profile-source-picker
        data-v1117-stay-key="${escapeHtml(stayKey)}">
        <div class="v1117-profile-source-heading v11112-care-source-heading">
          <div>
            <span>REQUEST FROM</span>
            <small>Tap another option at any time if the original source was entered incorrectly.</small>
          </div>
          <strong data-v1117-profile-source-status>
            ${escapeHtml(statusText || (selected ? `Selected: ${selected}` : 'Not recorded · Tap to choose'))}
          </strong>
        </div>
        <div class="v1117-profile-source-grid v11112-care-source-grid"
          role="group"
          aria-label="Request From">
          ${sourceDefinitions().map(source => sourceTileHtml(source, selected)).join('')}
        </div>
      </section>`;
  }

  async function hydrateCard(card, options = {}) {
    if (!card || !card.isConnected || !card.classList.contains('is-profile-active')) return;

    const host = ensureStableSourceHost(card);
    if (!host) return;

    if (!host.querySelector('[data-v1117-profile-source-picker]')) {
      host.innerHTML = `
        <section class="v1117-profile-source-picker v11112-care-source-picker is-loading">
          <div class="v1117-profile-source-heading v11112-care-source-heading">
            <div>
              <span>REQUEST FROM</span>
              <small>Loading saved request source…</small>
            </div>
          </div>
        </section>`;
    }

    try {
      const record = await resolveProfileRecord(card, options);
      if (!card.isConnected || !card.classList.contains('is-profile-active')) return;
      renderStableSourceEditor(card, record || { requestSource: '' });
    } catch (error) {
      console.warn('Care Request From could not be restored:', error);
      if (!card.isConnected) return;
      const fallback = cachedProfileRecord(card);
      renderStableSourceEditor(card, fallback || { requestSource: '' }, 'Could not refresh · tap to retry');
    }
  }

  function scheduleActiveHydrate(options = {}) {
    [40, 180, 520].forEach((delay, index) => {
      setTimeout(() => {
        const card = activeProfileCard();
        if (!card) return;
        hydrateCard(card, {
          forceRemote: options.forceRemote === true && index === 0
        }).catch(() => {});
      }, delay);
    });
  }

  function wrapDirectoryResponse() {
    const base = window.applyGuestDirectoryResponse;
    if (typeof base !== 'function' || base.v11112SourceWrapped) return;

    const wrapped = function () {
      const result = base.apply(this, arguments);
      scheduleActiveHydrate();
      return result;
    };

    wrapped.v11112SourceWrapped = true;
    wrapped.v11111PhoneWrapped = base.v11111PhoneWrapped;
    wrapped.v1119PastCheckoutWrapped = base.v1119PastCheckoutWrapped;
    wrapped.v1118Wrapped = base.v1118Wrapped;
    wrapped.v1117Wrapped = base.v1117Wrapped;
    window.applyGuestDirectoryResponse = wrapped;
  }

  function wrapProfileOpen() {
    const base = window.openDirectoryGuestProfile;
    if (typeof base !== 'function' || base.v11112SourceWrapped) return;

    const wrapped = function () {
      const result = base.apply(this, arguments);
      Promise.resolve(result).then(
        () => scheduleActiveHydrate(),
        () => scheduleActiveHydrate()
      );
      return result;
    };

    wrapped.v11112SourceWrapped = true;
    window.openDirectoryGuestProfile = wrapped;
  }

  function wrapProfileRenderer() {
    const base = window.renderDirectoryIntakeAttributes;
    if (typeof base !== 'function' || base.v11112SourceWrapped) return;

    const wrapped = function (card) {
      const result = base.apply(this, arguments);
      if (card?.classList?.contains('is-profile-active')) {
        setTimeout(() => hydrateCard(card).catch(() => {}), 30);
      }
      return result;
    };

    wrapped.v11112SourceWrapped = true;
    wrapped.v11111PhoneWrapped = base.v11111PhoneWrapped;
    window.renderDirectoryIntakeAttributes = wrapped;
  }

  function wireLifecycle() {
    if (window.v11112SourceLifecycleWired) return;
    window.v11112SourceLifecycleWired = true;

    document.addEventListener('click', event => {
      const sourceChoice = event.target.closest('[data-v11112-care-source-host] [data-v1117-profile-source-value]');
      if (sourceChoice) {
        /* V11.1.7 owns the save itself. Reconcile afterward so the stable
           placement and cached value remain correct after its success/error UI. */
        setTimeout(() => scheduleActiveHydrate(), 900);
        setTimeout(() => scheduleActiveHydrate({ forceRemote: true }), 1800);
        return;
      }

      const profileOpen = event.target.closest('[data-open-directory-profile], [data-directory-main-tab="profile"], [data-v110-tab="master"]');
      if (profileOpen) {
        scheduleActiveHydrate();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && isDirectoryPage()) {
        scheduleActiveHydrate({ forceRemote: true });
      }
    });

    window.addEventListener('focus', () => {
      if (isDirectoryPage()) scheduleActiveHydrate({ forceRemote: true });
    });

    window.addEventListener('pageshow', () => {
      if (isDirectoryPage()) scheduleActiveHydrate({ forceRemote: true });
    });
  }

  function init() {
    if (!isDirectoryPage()) return;

    wrapDirectoryResponse();
    wrapProfileOpen();
    wrapProfileRenderer();
    wireLifecycle();
    scheduleActiveHydrate();

    /* Bounded second pass covers late loader initialisation without a
       persistent MutationObserver. */
    setTimeout(() => {
      wrapDirectoryResponse();
      wrapProfileOpen();
      wrapProfileRenderer();
      scheduleActiveHydrate();
    }, 800);

    window.WAFFLE_V11112 = {
      version: VERSION,
      hydrateCard,
      renderStableSourceEditor,
      ensureStableSourceHost
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
