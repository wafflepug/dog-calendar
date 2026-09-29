/* ============================================================
   WAFFLE HOUSE — CANONICAL CARE / GUEST DIRECTORY MODULE
   Build 2026.08.27.03 · Canonical Source Consolidation Phase 2
   ------------------------------------------------------------
   This is the only active standalone Care feature module. It contains the
   proven desktop Care / Guest Directory behavior formerly executed through
   waffle-v11.1.60.js.

   The historical source remains in the repository for rollback during Phase 2,
   but the active runtime must not request it individually.
   ============================================================ */
(function () {
  'use strict';
  window.WAFFLE_CARE_CANONICAL_SOURCES = Object.freeze(["waffle-v11.1.60.js"]);
})();


/* ============================================================
   CANONICAL CARE SOURCE · waffle-v11.1.60.js
   Preserved from the proven historical implementation.
   ============================================================ */
/* ============================================================
   WAFFLE HOUSE V11.1.60 — CARE SECTION NAVIGATION
   ============================================================
   One Care section navigator for mobile and desktop.

   This layer does NOT reuse the historical desktop tab buttons or their click
   delegates. It creates a new five-tab navigation component and directly owns
   panel selection/loading for Overview, Items, Photos, Stay history and Dog record.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.60';
  const TABS = [
    { key: 'profile', icon: '🐶', label: 'Overview' },
    { key: 'belongings', icon: '🧳', label: 'Items' },
    { key: 'media', icon: '📸', label: 'Photos' },
    { key: 'history', icon: '🕘', label: 'Stay history' },
    { key: 'master', icon: '⭐', label: 'Dog record' }
  ];
  const TAB_KEYS = new Set(TABS.map(item => item.key));
  const wrapped = new Set();
  let prepareTimer = 0;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isDesktopCare() {
    return pageName() === 'directory';
  }

  function activeCards() {
    return Array.from(document.querySelectorAll('.directory-card.is-profile-active'));
  }

  function contentHost(card) {
    return card?.querySelector('.directory-profile-content') || null;
  }

  function oldTabs(card) {
    return card?.querySelector('.directory-main-profile-tabs') || null;
  }

  function panel(card, key) {
    if (!card) return null;
    const selectors = {
      profile: '[data-directory-main-panel="profile"]',
      belongings: '[data-directory-main-panel="belongings"]',
      history: '[data-directory-main-panel="history"]',
      media: '[data-v110-panel="media"]',
      master: '[data-v110-panel="master"]'
    };
    return card.querySelector(selectors[key] || '.__waffle_missing__');
  }

  function createPanel(card, key) {
    const host = contentHost(card);
    if (!host) return null;

    const section = document.createElement('section');
    section.className = 'directory-main-profile-panel v11160-created-panel';
    section.hidden = true;
    section.setAttribute('role', 'tabpanel');

    if (key === 'history') {
      section.dataset.directoryMainPanel = 'history';
      section.innerHTML = '<div data-v108-history><div class="v11160-loading">Loading stay history…</div></div>';
    } else if (key === 'media') {
      section.dataset.v110Panel = 'media';
      section.classList.add('v110-media-panel');
      section.innerHTML = '<div data-v110-media-host><div class="v11160-loading">Loading media…</div></div>';
    } else if (key === 'master') {
      section.dataset.v110Panel = 'master';
      section.classList.add('v110-master-panel');
      section.innerHTML = '<div data-v110-master-host><div class="v11160-loading">Loading master profile…</div></div>';
    } else {
      return null;
    }

    host.appendChild(section);
    return section;
  }

  function callNamed(name, args) {
    try {
      const fn = window[name];
      if (typeof fn === 'function') {
        return { called: true, value: fn.apply(window, args || []) };
      }
    } catch (error) {
      console.warn(`Desktop Care ${name} failed:`, error);
    }
    return { called: false, value: undefined };
  }

  function ensurePanels(card) {
    if (!card || !contentHost(card)) return false;

    /* Ask the existing content layers to create their content containers only.
       Their tab buttons remain legacy and are hidden by this layer. */
    callNamed('v108EnhanceCard', [card]);
    callNamed('v110EnhanceCareCard', [card]);

    if (!panel(card, 'history')) createPanel(card, 'history');
    if (!panel(card, 'media')) createPanel(card, 'media');
    if (!panel(card, 'master')) createPanel(card, 'master');

    return !!panel(card, 'profile') && !!panel(card, 'belongings');
  }

  function managedPanels(card) {
    return TABS.map(item => panel(card, item.key)).filter(Boolean);
  }

  function selectedFromLegacy(card) {
    const selected = card?.querySelector('.directory-main-profile-tab.is-active,[aria-selected="true"].directory-main-profile-tab');
    const text = String(
      selected?.dataset?.directoryMainTab ||
      selected?.dataset?.v110Tab ||
      selected?.textContent ||
      ''
    ).toLowerCase();
    return TABS.find(item => text.includes(item.key === 'belongings' ? 'belong' : item.key))?.key || 'profile';
  }

  function consumeRestoredDesktopTabLoad(card) {
    const shouldLoad = card?.dataset?.v11160RestoreLoad === 'true';
    if (shouldLoad) delete card.dataset.v11160RestoreLoad;
    return shouldLoad;
  }

  function newNav(card) {
    return card?.querySelector(':scope .v11160-desktop-tabs') || null;
  }

  function buildNav(card) {
    const legacy = oldTabs(card);
    const host = legacy?.parentElement || contentHost(card);
    if (!host) return null;

    let nav = newNav(card);
    if (nav) return nav;

    nav = document.createElement('nav');
    nav.className = 'v11160-desktop-tabs';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Care profile sections');
    nav.innerHTML = TABS.map(item => `
      <button type="button" class="v11160-desktop-tab" role="tab"
        data-v11160-tab="${item.key}" aria-selected="false" tabindex="-1">
        <span aria-hidden="true">${item.icon}</span><span>${item.label}</span>
      </button>`).join('');

    if (legacy) legacy.insertAdjacentElement('beforebegin', nav);
    else host.insertBefore(nav, host.firstChild);

    nav.addEventListener('click', event => {
      const button = event.target instanceof Element
        ? event.target.closest('[data-v11160-tab]')
        : null;
      if (!button || !nav.contains(button)) return;
      const key = String(button.dataset.v11160Tab || '');
      if (!TAB_KEYS.has(key)) return;
      select(card, key, { load: true, focus: false });
    });

    nav.addEventListener('keydown', event => {
      const button = event.target instanceof Element
        ? event.target.closest('[data-v11160-tab]')
        : null;
      if (!button) return;
      const buttons = Array.from(nav.querySelectorAll('[data-v11160-tab]'));
      const index = buttons.indexOf(button);
      if (index < 0) return;
      let next = -1;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next < 0) return;
      event.preventDefault();
      const key = String(buttons[next].dataset.v11160Tab || 'profile');
      select(card, key, { load: true, focus: true });
    });

    return nav;
  }

  function setVisualState(card, key) {
    const nav = newNav(card);
    if (!nav) return;

    nav.querySelectorAll('[data-v11160-tab]').forEach(button => {
      const active = button.dataset.v11160Tab === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.setAttribute('tabindex', active ? '0' : '-1');
    });

    managedPanels(card).forEach(item => {
      const itemKey = item.dataset.directoryMainPanel || item.dataset.v110Panel || '';
      const active = itemKey === key;
      item.dataset.v11160ManagedPanel = 'true';
      item.hidden = !active;
      item.classList.toggle('is-v11160-active', active);
      item.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    card.dataset.v11160ActiveTab = key;
  }

  function html(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function installStayLinkReview() {
    const heading = document.querySelector('.directory-roster-heading');
    const toolbar = heading?.querySelector('.guest-directory-toolbar');
    if (!heading || !toolbar || heading.querySelector('.care-stay-link-trigger')) return;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'care-stay-link-trigger';
    trigger.textContent = 'Link older stay';
    toolbar.appendChild(trigger);

    const panel = document.createElement('section');
    panel.className = 'care-stay-link';
    panel.hidden = true;
    panel.setAttribute('aria-labelledby', 'careStayLinkTitle');
    panel.innerHTML = `
      <header class="care-stay-link-header">
        <div><small>CARE RECORDS</small><h2 id="careStayLinkTitle">Link a past stay</h2>
          <p>Choose the exact stay and the numbered dog it belongs to. Only that stay will move.</p></div>
        <button type="button" class="care-stay-link-close" aria-label="Close stay linking">✕</button>
      </header>
      <div class="care-stay-link-body">
        <div class="care-stay-link-form">
          <label>Past stay<select data-care-stay-source><option value="">Loading stays…</option></select></label>
          <label>Link to numbered dog<select data-care-stay-target><option value="">Loading dogs…</option></select></label>
          <button type="button" class="care-stay-link-review" disabled>Review link</button>
        </div>
        <div class="care-stay-link-confirm" data-care-stay-confirm hidden></div>
        <p class="care-stay-link-status" data-care-stay-status role="status" aria-live="polite"></p>
      </div>`;
    heading.insertAdjacentElement('afterend', panel);

    const sourceSelect = panel.querySelector('[data-care-stay-source]');
    const targetSelect = panel.querySelector('[data-care-stay-target]');
    const reviewButton = panel.querySelector('.care-stay-link-review');
    const confirmHost = panel.querySelector('[data-care-stay-confirm]');
    const status = panel.querySelector('[data-care-stay-status]');
    let stays = [];
    let identities = [];
    let loading = false;
    let saving = false;

    const selectedStay = () => stays.find(item => String(item.sourceRow) === sourceSelect.value) || null;
    const selectedTarget = () => identities.find(item => item.dogId === targetSelect.value) || null;
    const identityLabel = item => `${item.dogNumber} · ${item.dogName}${item.breed ? ` · ${item.breed}` : ''}`;
    const updateReviewButton = () => {
      reviewButton.disabled = loading || saving || !selectedStay() || !selectedTarget();
      confirmHost.hidden = true;
      confirmHost.innerHTML = '';
    };

    function renderStayChoices() {
      const target = selectedTarget();
      const eligible = stays.filter(item => !target || item.sourceDogId !== target.dogId);
      const priorValue = sourceSelect.value;
      sourceSelect.innerHTML = '<option value="">Choose one past stay</option>' + eligible.map(item => {
        const sourceNumber = item.sourceDogNumber ? ` · current ${html(item.sourceDogNumber)}` : ' · no Dog ID';
        const owner = item.ownerName ? ` · ${html(item.ownerName)}` : '';
        return `<option value="${Number(item.sourceRow)}">${html(item.dogName)} · ${html(item.startDate)} to ${html(item.endDate)}${owner}${sourceNumber}</option>`;
      }).join('');
      if (eligible.some(item => String(item.sourceRow) === priorValue)) sourceSelect.value = priorValue;
      reviewButton.disabled = loading || saving || !selectedStay() || !target;
    }

    async function loadData() {
      if (loading || typeof window.queryAppsScript !== 'function') return;
      loading = true;
      status.textContent = 'Loading stays and numbered dogs…';
      reviewButton.disabled = true;
      sourceSelect.innerHTML = '<option value="">Loading stays…</option>';
      targetSelect.innerHTML = '<option value="">Loading dogs…</option>';
      try {
        const [stayResponse, dogResponse] = await Promise.all([
          window.queryAppsScript({ action: 'list_dog_stays_for_linking' }, { maxAttempts: 2, timeoutMs: 30000 }),
          window.queryAppsScript({ action: 'list_dog_identities' }, { maxAttempts: 2, timeoutMs: 30000 })
        ]);
        if (stayResponse?.result === 'error' || dogResponse?.result === 'error') throw new Error(stayResponse?.error || dogResponse?.error || 'Care records could not be loaded.');
        stays = Array.isArray(stayResponse?.stays) ? stayResponse.stays.slice().sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))) : [];
        identities = Array.isArray(dogResponse?.identities)
          ? dogResponse.identities.filter(item => item.dogId && /^#?\d+$/.test(String(item.dogNumber || ''))).sort((a, b) => String(a.dogNumber).localeCompare(String(b.dogNumber)))
          : [];
        targetSelect.innerHTML = '<option value="">Choose a numbered dog</option>' + identities.map(item => `<option value="${html(item.dogId)}">${html(identityLabel(item))}</option>`).join('');
        renderStayChoices();
        status.textContent = stays.length ? 'Select a past stay and its numbered dog to review the link.' : 'No boarding stays are available to link.';
        if (!identities.length) status.textContent = 'No numbered dogs are available. Assign Dog IDs and numbers, then refresh Care.';
      } catch (error) {
        stays = [];
        identities = [];
        sourceSelect.innerHTML = '<option value="">Stays unavailable</option>';
        targetSelect.innerHTML = '<option value="">Dogs unavailable</option>';
        status.textContent = `Care records could not be loaded. ${error?.message || String(error)}`;
      } finally {
        loading = false;
        reviewButton.disabled = !selectedStay() || !selectedTarget();
      }
    }

    trigger.addEventListener('click', () => {
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      if (!stays.length && !identities.length) loadData();
    });
    panel.querySelector('.care-stay-link-close').addEventListener('click', () => {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    });
    sourceSelect.addEventListener('change', updateReviewButton);
    targetSelect.addEventListener('change', () => { renderStayChoices(); updateReviewButton(); });

    reviewButton.addEventListener('click', () => {
      const stay = selectedStay();
      const dog = selectedTarget();
      if (!stay || !dog) return;
      const mismatch = String(stay.dogName).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() !== String(dog.dogName).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      confirmHost.innerHTML = `
        <div class="care-stay-link-review-card">
          <strong>Stay to link</strong><span>${html(stay.dogName)} · ${html(stay.startDate)} to ${html(stay.endDate)}${stay.ownerName ? ` · ${html(stay.ownerName)}` : ''}</span>
          <strong>Numbered dog</strong><span>${html(identityLabel(dog))}</span>
          ${mismatch ? `<label class="care-stay-link-name-check"><input type="checkbox" data-care-stay-name-confirm> The stay uses a different name. I confirm both names refer to this same dog.</label>` : ''}
          <label class="care-stay-link-explicit-check"><input type="checkbox" data-care-stay-link-confirm> I confirm this exact stay belongs to ${html(dog.dogNumber)}.</label>
          <div class="care-stay-link-actions"><button type="button" data-care-stay-cancel>Back</button><button type="button" data-care-stay-submit disabled>Link this stay</button></div>
        </div>`;
      confirmHost.hidden = false;
      const linkCheck = confirmHost.querySelector('[data-care-stay-link-confirm]');
      const nameCheck = confirmHost.querySelector('[data-care-stay-name-confirm]');
      const submit = confirmHost.querySelector('[data-care-stay-submit]');
      const updateSubmit = () => { submit.disabled = !linkCheck.checked || !!(nameCheck && !nameCheck.checked) || saving; };
      linkCheck.addEventListener('change', updateSubmit);
      nameCheck?.addEventListener('change', updateSubmit);
      confirmHost.querySelector('[data-care-stay-cancel]').addEventListener('click', () => { confirmHost.hidden = true; confirmHost.innerHTML = ''; });
      submit.addEventListener('click', async () => {
        if (submit.disabled || saving) return;
        saving = true;
        submit.disabled = true;
        status.textContent = 'Linking the selected stay…';
        try {
          const response = await window.queryAppsScript({
            action: 'link_stay_to_dog',
            sourceRow: stay.sourceRow,
            sourceFingerprint: stay.sourceFingerprint,
            sourceStayKey: stay.sourceStayKey,
            sourceDogId: stay.sourceDogId || '',
            sourceDogNumber: stay.sourceDogNumber || '',
            targetDogId: dog.dogId,
            confirmLink: true,
            confirmTargetDogId: dog.dogId,
            confirmTargetDogNumber: dog.dogNumber,
            ...(mismatch ? { confirmNameMismatch: true } : {})
          }, { maxAttempts: 1, timeoutMs: 30000 });
          if (response?.result === 'error') throw new Error(response.error || 'The stay could not be linked.');
          if (!response || response.result !== 'success') throw new Error('The stay link did not complete. Refresh Care before trying again.');
          const remaining = Number(response.sourceIdentityStaysRemaining || 0);
          status.textContent = `Linked ${stay.dogName}'s ${stay.startDate} stay to ${dog.dogNumber}. ${remaining ? `${remaining} other stay${remaining === 1 ? '' : 's'} remain on its previous Dog ID.` : 'The previous Dog ID has no other stays.'}`;
          confirmHost.hidden = true;
          confirmHost.innerHTML = '';
          stays = [];
          identities = [];
          sourceSelect.innerHTML = '<option value="">Refresh to load stays</option>';
          targetSelect.innerHTML = '<option value="">Refresh to load dogs</option>';
          document.getElementById('refreshGuestDirectoryBtn')?.click();
        } catch (error) {
          status.textContent = `Stay not linked. ${error?.message || String(error)}`;
        } finally {
          saving = false;
          reviewButton.disabled = !selectedStay() || !selectedTarget();
        }
      });
    });
  }

  async function fallbackHistory(card) {
    const target = panel(card, 'history');
    const host = target?.querySelector('[data-v108-history]') || target;
    const dogName = String(card?.dataset?.directoryDogName || card?.dataset?.dogName || '').trim();
    const dogId = String(card?.dataset?.directoryDogId || '').trim();
    if (!host || !dogName || typeof window.queryAppsScript !== 'function') return;

    if (host.dataset.historyState === 'loading' || host.dataset.historyState === 'loaded') return;
    host.dataset.historyState = 'loading';
    host.innerHTML = '<div class="v11160-loading" role="status">Loading stay history…</div>';
    try {
      const response = await window.queryAppsScript(
        { action: 'get_dog_history', dogName, ...(dogId ? { dogId } : {}) },
        { maxAttempts: 2, timeoutMs: 30000 }
      );
      const history = response?.history || {};
      const stays = Array.isArray(history.previousStays) ? history.previousStays : [];
      host.dataset.historyState = 'loaded';
      const dateLabel = value => typeof window.v10FormatDateLabel === 'function' ? window.v10FormatDateLabel(value) : String(value || '');
      host.innerHTML = `<section class="v11160-simple-section v108-history-fallback"><div class="v11160-section-head"><div><small>STAY HISTORY</small><h4>🕘 ${html(dogName)}</h4></div><strong>${Number(history.stayCount ?? stays.length)} previous stay${Number(history.stayCount ?? stays.length) === 1 ? '' : 's'}</strong></div>${history.dogNumber ? `<p>Dog ID ${html(history.dogNumber)}</p>` : ''}${stays.length ? `<div class="v11160-list">${stays.map(stay => `<article class="v108-stay-history"><strong>${html(dateLabel(stay.startDate))}${stay.endDate && stay.endDate !== stay.startDate ? ' – ' + html(dateLabel(stay.endDate)) : ''}</strong><span>${[stay.bookingType || 'Boarding', stay.breed, stay.ownerName].filter(Boolean).map(html).join(' · ')}</span>${stay.phone ? `<a href="tel:${html(stay.phone)}">${html(stay.phone)}</a>` : ''}${stay.notes ? `<details><summary>Notes</summary><p>${html(stay.notes)}</p></details>` : ''}</article>`).join('')}</div>` : '<div class="v11160-empty">No previous stays are recorded for this dog.</div>'}</section>`;
    } catch (error) {
      host.dataset.historyState = 'error';
      host.innerHTML = `<div class="v11160-error v108-history-error" role="alert"><strong>Stay history could not be loaded</strong><br>${html(error?.message || String(error))}<br><button type="button" data-v108-history-retry>Try again</button></div>`;
    }
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('[data-v108-history-retry]')) return;
    const card = event.target.closest('.directory-card');
    const host = card?.querySelector('[data-v108-history]');
    if (host) delete host.dataset.historyState;
    const result = callNamed('v108LoadHistory', [card]);
    if (!result.called) fallbackHistory(card);
  });

  async function fallbackMedia(card) {
    const target = panel(card, 'media');
    const host = target?.querySelector('[data-v110-media-host]') || target;
    const stayKey = String(card?.dataset?.directoryStayKey || card?.dataset?.stayKey || '').trim();
    if (!host || !stayKey || typeof window.queryAppsScript !== 'function') return;

    host.innerHTML = '<div class="v11160-loading">Loading media…</div>';
    try {
      const response = await window.queryAppsScript(
        { action: 'get_guest_belongings', stayKey },
        { maxAttempts: 2, timeoutMs: 30000 }
      );
      const record = response?.record || {};
      const profile = Array.isArray(record.dogPhotoGallery) ? [...record.dogPhotoGallery] : [];
      if (record.dogPhoto && !profile.some(photo => String(photo?.id || '') === String(record.dogPhoto?.id || ''))) profile.push(record.dogPhoto);
      const stay = Array.isArray(record.stayPhotos) ? record.stayPhotos : [];
      const belongings = Array.isArray(record.photos) ? record.photos : [];
      const photos = (title, rows) => `<section class="v11160-simple-section"><div class="v11160-section-head"><h4>${title}</h4><strong>${rows.length}</strong></div>${rows.length ? `<div class="v11160-photo-grid">${rows.map(photo => { const url = String(photo?.previewUrl || photo?.url || photo?.driveUrl || ''); return url ? `<a href="${html(url)}" target="_blank" rel="noopener"><img src="${html(url)}" alt="${html(photo?.label || 'Dog photo')}" loading="lazy"><span>${html(photo?.label || 'Photo')}</span></a>` : ''; }).join('')}</div>` : '<div class="v11160-empty">No photos saved.</div>'}</section>`;
      host.innerHTML = photos('🐶 Profile Photos', profile) + photos('📸 Stay Photos', stay) + photos('🧳 Belongings Photos', belongings);
    } catch (error) {
      host.innerHTML = `<div class="v11160-error">Media could not be loaded.<br>${html(error?.message || String(error))}</div>`;
    }
  }

  async function fallbackMaster(card) {
    const target = panel(card, 'master');
    const host = target?.querySelector('[data-v110-master-host]') || target;
    const dogName = String(card?.dataset?.directoryDogName || card?.dataset?.dogName || '').trim();
    const dogId = String(card?.dataset?.directoryDogId || '').trim();
    const breed = String(card?.querySelector('.directory-primary-breed')?.textContent || card?.dataset?.v1088Breed || '').trim();
    if (!host || !dogName || typeof window.queryAppsScript !== 'function') return;

    host.innerHTML = '<div class="v11160-loading" role="status">Loading dog record…</div>';
    try {
      const response = await window.queryAppsScript(
        { action: 'get_dog_master_profile', dogName, ...(dogId ? { dogId } : {}), breed },
        { maxAttempts: 2, timeoutMs: 30000 }
      );
      const record = response?.record || {};
      const flags = record.riskFlags || {};
      const risks = [['escapeRisk','Escape risk'],['foodAllergy','Food allergy'],['medicated','Medication'],['separationAnxiety','Separation anxiety'],['weightManagement','Weight management']];
      const active = risks.filter(([key]) => flags[key] === true);
      const known = risks.filter(([key]) => typeof flags[key] === 'boolean').length;
      const safety = active.length ? active.map(([, label]) => `<span class="v11160-risk">⚠ ${html(label)}</span>`).join('') : known === risks.length ? '<span class="v11160-clear">✓ No care alerts recorded</span>' : '<span class="v11160-unknown" role="status">Safety status incomplete — check with owner</span>';
      const number = String(record.dogNumber || card?.dataset?.directoryDogNumber || '').trim();
      host.innerHTML = `<section class="v11160-simple-section v11160-master-record"><div class="v11160-section-head"><div><small>DOG RECORD</small><h4>${html(record.dogName || dogName)}</h4><span>${html(record.breed || breed || 'Breed not recorded')}</span></div><strong class="v11160-dog-id">Dog ID ${html(number || 'Not assigned')}</strong></div><div class="v11160-record-meta"><span>${record.persisted ? '✓ Saved master profile' : '↻ Derived from stay history'}</span><span>${Number(record.stayCount || 0)} recorded stays</span></div><div class="v11160-safety" aria-label="Safety alerts">${safety}</div><div class="v11160-master-grid"><div><small>OWNER</small><strong>${html(record.ownerName || 'Not recorded')}</strong></div><div><small>CONTACT</small><strong>${record.phone ? `<a href="tel:${html(record.phone)}">${html(record.phone)}</a>` : 'Not recorded'}</strong></div></div>${record.notes ? `<details class="v11160-note"><summary>Known notes</summary><p>${html(record.notes)}</p></details>` : ''}<button type="button" class="v11160-master-save" data-v11160-master-save>⭐ Sync This Stay to Master Profile</button><p class="v11160-freshness" role="status">Profile loaded just now.</p></section>`;
    } catch (error) {
      host.innerHTML = `<div class="v11160-error" role="alert"><strong>Dog record could not be loaded.</strong><span>${html(error?.message || String(error))}</span><button type="button" data-v11160-master-retry>Retry loading dog record</button></div>`;
    }
  }

  document.addEventListener('click', async event => {
    const retry = event.target.closest('[data-v11160-master-retry]');
    const save = event.target.closest('[data-v11160-master-save]');
    if (!retry && !save) return;
    const card = event.target.closest('.directory-card');
    if (!card) return;
    if (retry) {
      const result = callNamed('v110LoadMasterProfile', [card, { force:true }]);
      if (!result.called) fallbackMaster(card);
      return;
    }
    const button = save;
    button.disabled = true;
    button.textContent = '⏳ Syncing dog record…';
    try {
      const ownerName = String(card.querySelector('[data-directory-edit-field="ownerName"]')?.dataset.directoryCurrentValue || card.dataset.v1088OwnerName || '').trim();
      const phone = String(card.querySelector('[data-directory-edit-field="phone"]')?.dataset.directoryCurrentValue || card.dataset.v1088Phone || '').trim();
      const notes = String(card.querySelector('[data-directory-edit-field="notes"]')?.dataset.directoryCurrentValue || card.dataset.v1088Notes || '').trim();
      await window.queryAppsScript({ action:'save_dog_master_profile', dogName:String(card.dataset.directoryDogName || card.dataset.dogName || '').trim(), dogId:String(card.dataset.directoryDogId || '').trim(), breed:String(card.querySelector('.directory-primary-breed')?.textContent || card.dataset.v1088Breed || '').trim(), stayKey:String(card.dataset.directoryStayKey || '').trim(), ownerName, phone, notes });
      fallbackMaster(card);
    } catch (error) {
      const host = panel(card, 'master')?.querySelector('[data-v110-master-host]');
      if (host) host.insertAdjacentHTML('afterbegin', `<div class="v11160-error" role="alert">Dog record could not be synced. ${html(error?.message || String(error))}</div>`);
    } finally {
      button.disabled = false;
      button.textContent = '⭐ Sync This Stay to Master Profile';
    }
  });

  function loadTab(card, key) {
    if (key === 'profile' || key === 'belongings') {
      const result = callNamed('switchDirectoryProfileMainTab', [card, key]);
      if (!result.called) {
        const detail = card.querySelector(`[data-directory-detail="${key}"]`);
        if (detail) callNamed(key === 'profile' ? 'loadDirectoryProfileDetail' : 'loadDirectoryBelongingsDetail', [card, detail]);
      }
      return;
    }

    if (key === 'history') {
      const result = callNamed('v108LoadHistory', [card]);
      if (!result.called) fallbackHistory(card);
      return;
    }

    if (key === 'media') {
      const result = callNamed('v110LoadMedia', [card]);
      if (!result.called) fallbackMedia(card);
      return;
    }

    if (key === 'master') {
      const result = callNamed('v110LoadMasterProfile', [card]);
      if (!result.called) fallbackMaster(card);
    }
  }

  function select(card, key, options = {}) {
    if (!card || !TAB_KEYS.has(key) || !isDesktopCare()) return;
    ensurePanels(card);
    buildNav(card);

    if (options.load !== false) loadTab(card, key);
    setVisualState(card, key);

    /* Existing loaders may update legacy panel state asynchronously. The new
       component simply reasserts its own selected panel after those renders. */
    [0, 60, 180, 420].forEach(delay => {
      window.setTimeout(() => {
        if (!isDesktopCare() || !card.isConnected || card.dataset.v11160ActiveTab !== key) return;
        setVisualState(card, key);
      }, delay);
    });

    if (options.focus) {
      window.setTimeout(() => newNav(card)?.querySelector(`[data-v11160-tab="${key}"]`)?.focus(), 0);
    }
  }

  function prepareCard(card) {
    if (!card || !isDesktopCare() || !contentHost(card)) return;
    if (!ensurePanels(card)) return;

    card.classList.add('v11160-desktop-profile');
    const legacy = oldTabs(card);
    if (legacy) {
      legacy.classList.add('v11160-legacy-tabs');
      legacy.setAttribute('aria-hidden', 'true');
    }

    buildNav(card);
    const restoreLoad = consumeRestoredDesktopTabLoad(card);
    const wanted = TAB_KEYS.has(card.dataset.v11160ActiveTab)
      ? card.dataset.v11160ActiveTab
      : selectedFromLegacy(card);
    select(card, wanted, { load: restoreLoad, focus: false });
  }

  function teardownCard(card) {
    if (!card) return;
    newNav(card)?.remove();
    card.classList.remove('v11160-desktop-profile');
    delete card.dataset.v11160ActiveTab;
    const legacy = oldTabs(card);
    if (legacy) {
      legacy.classList.remove('v11160-legacy-tabs');
      legacy.removeAttribute('aria-hidden');
    }
    managedPanels(card).forEach(item => {
      delete item.dataset.v11160ManagedPanel;
      item.classList.remove('is-v11160-active');
      item.removeAttribute('aria-hidden');
    });
  }

  function prepare() {
    if (pageName() !== 'directory') return;

    activeCards().forEach(prepareCard);
  }

  function schedulePrepare(delays = [0, 60, 180, 420, 900]) {
    window.clearTimeout(prepareTimer);
    prepareTimer = window.setTimeout(prepare, 0);
    delays.filter(delay => delay > 0).forEach(delay => window.setTimeout(prepare, delay));
  }

  function wrapFunction(name) {
    if (wrapped.has(name)) return;
    const fn = window[name];
    if (typeof fn !== 'function' || fn.v11160Wrapped) return;
    const next = function () {
      const result = fn.apply(this, arguments);
      schedulePrepare([0, 80, 240, 650]);
      return result;
    };
    next.v11160Wrapped = true;
    try { Object.keys(fn).forEach(key => { next[key] = fn[key]; }); } catch (_) {}
    window[name] = next;
    wrapped.add(name);
  }

  function installHooks() {
    ['openDirectoryGuestProfile', 'applyGuestDirectoryResponse', 'v1082ApplyPastResponse'].forEach(wrapFunction);
  }

  function ensureStyle() {
    if (document.getElementById('v11160DesktopCareStyle')) return;
    const style = document.createElement('style');
    style.id = 'v11160DesktopCareStyle';
    style.textContent = `
      body[data-waffle-page="directory"] .directory-card.v11160-desktop-profile .v11160-legacy-tabs {
        display:none!important;
        pointer-events:none!important;
      }
      body[data-waffle-page="directory"] .v11160-desktop-tabs {
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:6px;
        padding:5px;
        margin:0 0 10px;
        border:1px solid var(--wh-border,#d9e2ec);
        border-radius:14px;
        background:var(--wh-surface,#fff);
        position:sticky;
        top:0;
        z-index:12;
        min-width:0;
      }
      body[data-waffle-page="directory"] .v11160-desktop-tab {
        min-width:0;
        min-height:44px;
        border:0;
        border-radius:10px;
        background:transparent;
        color:var(--wh-text-muted,#64748b);
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:8px 6px;
        font:inherit;
        font-size:clamp(9px,1vw,12px);
        font-weight:800;
        line-height:1.15;
        cursor:pointer;
        transition:background .15s ease,color .15s ease,box-shadow .15s ease;
      }
      body[data-waffle-page="directory"] .v11160-desktop-tab > span:last-child {
        min-width:0;
        overflow-wrap:anywhere;
      }
      body[data-waffle-page="directory"] .v11160-desktop-tab:hover {
        background:var(--wh-surface-soft,#eef3f8);
        color:var(--wh-text,#111827);
      }
      body[data-waffle-page="directory"] .v11160-desktop-tab.is-active {
        background:var(--wh-accent,#0f6292);
        color:var(--wh-accent-contrast,#fff);
        box-shadow:0 1px 2px rgba(15,23,42,.14);
      }
      body[data-waffle-page="directory"] .v11160-desktop-tab:focus-visible {
        outline:2px solid var(--wh-accent,#0f6292);
        outline-offset:2px;
      }
      @media (max-width:768px) {
        body[data-waffle-page="directory"] .v11160-desktop-tabs {
          display:flex;
          gap:4px;
          overflow-x:auto;
          overscroll-behavior-x:contain;
          scrollbar-width:thin;
          -webkit-overflow-scrolling:touch;
          scroll-snap-type:x proximity;
          padding:4px;
        }
        body[data-waffle-page="directory"] .v11160-desktop-tab {
          flex:0 0 auto;
          min-width:68px;
          max-width:130px;
          scroll-snap-align:start;
          padding:7px 8px;
        }
      }
      body[data-waffle-page="directory"] .directory-card.v11160-desktop-profile [data-v11160-managed-panel="true"] {
        display:none!important;
      }
      body[data-waffle-page="directory"] .directory-card.v11160-desktop-profile [data-v11160-managed-panel="true"].is-v11160-active:not([hidden]) {
        display:block!important;
      }
      body.dark-theme[data-waffle-page="directory"] .v11160-desktop-tabs {
        background:var(--wh-surface,#17243a);
        border-color:var(--wh-border,#334155);
      }
      body.dark-theme[data-waffle-page="directory"] .v11160-desktop-tab {
        color:var(--wh-text-muted,#aebbd0);
      }
      body.dark-theme[data-waffle-page="directory"] .v11160-desktop-tab:hover {
        background:var(--wh-surface-soft,#22304a);
        color:var(--wh-text,#fff);
      }
      body.dark-theme[data-waffle-page="directory"] .v11160-desktop-tab.is-active {
        background:var(--wh-accent,#0f6292);
        color:var(--wh-accent-contrast,#fff);
      }
      .v11160-loading,.v11160-error,.v11160-empty {
          padding:18px;
          border:1px dashed var(--wh-border,#d9e2ec);
          border-radius:12px;
          color:var(--wh-text-muted,#64748b);
          font-size:11px;
        }
        .v11160-error { border-style:solid;color:#b42318; }
        .v11160-simple-section { display:grid;gap:12px;padding:4px 0 14px; }
        .v11160-section-head { display:flex;align-items:flex-end;justify-content:space-between;gap:12px; }
        .v11160-section-head small { display:block;font-size:9px;font-weight:900;letter-spacing:.08em;color:var(--wh-accent,#0f6292); }
        .v11160-section-head h4 { margin:2px 0 0;font-size:16px; }
        .v11160-list { display:grid;gap:8px; }
        .v11160-list article { display:grid;gap:3px;padding:11px 13px;border:1px solid var(--wh-border,#d9e2ec);border-radius:12px;background:var(--wh-surface-soft,#f8fafc); }
        .v11160-list article span,.v11160-list article small { color:var(--wh-text-muted,#64748b);font-size:10px; }
        .v11160-photo-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px; }
        .v11160-photo-grid a { display:grid;gap:6px;text-decoration:none;color:inherit;padding:8px;border:1px solid var(--wh-border,#d9e2ec);border-radius:12px; }
        .v11160-photo-grid img { width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:9px; }
        .v11160-photo-grid span { font-size:10px;font-weight:800; }
        .v11160-master-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px; }
        .v11160-master-grid>div,.v11160-note { padding:11px 13px;border:1px solid var(--wh-border,#d9e2ec);border-radius:12px;background:var(--wh-surface-soft,#f8fafc); }
        .v11160-master-grid small,.v11160-note small { display:block;font-size:8px;font-weight:900;letter-spacing:.06em;color:var(--wh-text-muted,#64748b); }
        .v11160-note p { margin:5px 0 0; }
        .v11160-master-record { gap:10px;padding:12px;border:1px solid var(--wh-border,#d9e2ec);border-radius:14px;background:var(--wh-surface,#fff); }
        .v11160-master-record .v11160-section-head { align-items:flex-start; }
        .v11160-master-record .v11160-section-head h4 { font-size:clamp(18px,3vw,24px);line-height:1.15; }
        .v11160-master-record .v11160-section-head>div>span { color:var(--wh-text-muted,#64748b);font-size:13px; }
        .v11160-dog-id { flex:0 0 auto;padding:8px 10px;border-radius:9px;background:var(--wh-surface-soft,#f8fafc);color:var(--wh-text,#172033);font-size:13px;font-variant-numeric:tabular-nums; }
        .v11160-record-meta,.v11160-safety { display:flex;flex-wrap:wrap;gap:7px 12px; }
        .v11160-record-meta { color:var(--wh-text-muted,#64748b);font-size:11px; }
        .v11160-record-meta span:first-child { color:var(--wh-text,#172033);font-weight:800; }
        .v11160-risk,.v11160-clear,.v11160-unknown { padding:7px 10px;border:1px solid var(--wh-border,#d9e2ec);border-radius:9px;font-size:12px;font-weight:850; }
        .v11160-risk,.v11160-unknown { border-color:#b45309;background:#fffbeb;color:#78350f; }
        .v11160-clear { border-color:#15803d;background:#f0fdf4;color:#166534; }
        .v11160-master-grid>div { min-width:0; }
        .v11160-master-grid strong { display:block;margin-top:4px;font-size:13px;overflow-wrap:anywhere; }
        .v11160-master-grid a { color:var(--wh-accent,#0f6292);text-underline-offset:2px; }
        .v11160-note { padding:0; }
        .v11160-note summary { min-height:44px;padding:12px;cursor:pointer;font-size:12px;font-weight:800; }
        .v11160-note p { max-height:9em;overflow:auto;padding:0 12px 12px;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere; }
        .v11160-master-save,.v11160-master-record .v11160-error button,.v11160-error button { min-height:44px;padding:8px 12px;border:1px solid var(--wh-accent,#0f6292);border-radius:8px;background:var(--wh-accent,#0f6292);color:var(--wh-accent-contrast,#fff);font:inherit;font-weight:850;cursor:pointer; }
        .v11160-freshness { margin:0;color:var(--wh-text-muted,#64748b);font-size:10px; }
        .v11160-master-record button:focus-visible,.v11160-note summary:focus-visible { outline:3px solid #f59e0b;outline-offset:2px; }
        body.dark-theme .v11160-risk,body.dark-theme .v11160-unknown { border-color:#b45309;background:#451a03;color:#fde68a; }
        body.dark-theme .v11160-clear { border-color:#15803d;background:#052e16;color:#bbf7d0; }
        @media(max-width:600px) { .v11160-master-record .v11160-section-head { flex-direction:column;align-items:stretch; }.v11160-dog-id { align-self:flex-start; }.v11160-master-grid { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function start() {
    if (pageName() !== 'directory') return;
    ensureStyle();
    installStayLinkReview();
    installHooks();
    schedulePrepare([0, 80, 240, 650, 1400, 2600]);

    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('[data-open-directory-profile],.directory-guest-tile-open,#directoryBackToGuestsBtn,#refreshGuestDirectoryBtn')) {
        schedulePrepare([0, 80, 240, 650, 1200]);
      }
    }, false);

    window.addEventListener('pageshow', () => schedulePrepare([0, 120, 450]));
    window.addEventListener('focus', () => schedulePrepare([0, 120]));
    window.addEventListener('resize', () => schedulePrepare([0, 100, 300]));

    /* Some historical functions are assigned after DOMContentLoaded. A small
       bounded retry installs hooks without keeping an open-ended observer. */
    [150, 500, 1200].forEach(delay => window.setTimeout(() => {
      installHooks();
      prepare();
    }, delay));

    window.v11160DesktopCareRebuildVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();


/* ============================================================
   CANONICAL CARE READY
   ============================================================ */
(function () {
  'use strict';
  const manifest = Object.freeze({
    build: '2026.08.27.03',
    version: 'care-phase2-1',
    sourceCount: 1,
    sources: window.WAFFLE_CARE_CANONICAL_SOURCES,
    sharedCompatibility: Object.freeze(['intake-pdf-ocr-v11.1.90'])
  });

  window.WAFFLE_CARE_CANONICAL = manifest;
  try {
    window.dispatchEvent(new CustomEvent('waffle:care-canonical-ready', { detail: manifest }));
  } catch (_) {}
})();
