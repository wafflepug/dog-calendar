/* ============================================================
   WAFFLE HOUSE V11.1.60 — DESKTOP CARE TABS REBUILT FROM SCRATCH
   ============================================================
   Desktop only. Mobile keeps the existing working Care navigation.

   This layer does NOT reuse the historical desktop tab buttons or their click
   delegates. It creates a new five-tab navigation component and directly owns
   panel selection/loading for Profile, Belongings, Media, History and Master.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.60';
  const DESKTOP_QUERY = '(min-width: 769px)';
  const TABS = [
    { key: 'profile', icon: '🐶', label: 'Profile' },
    { key: 'belongings', icon: '🧳', label: 'Belongings' },
    { key: 'media', icon: '📸', label: 'Media' },
    { key: 'history', icon: '🕘', label: 'History' },
    { key: 'master', icon: '⭐', label: 'Master' }
  ];
  const TAB_KEYS = new Set(TABS.map(item => item.key));
  const wrapped = new Set();
  let prepareTimer = 0;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function isDesktopCare() {
    return pageName() === 'directory' && !!window.matchMedia && window.matchMedia(DESKTOP_QUERY).matches;
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

  async function fallbackHistory(card) {
    const target = panel(card, 'history');
    const host = target?.querySelector('[data-v108-history]') || target;
    const dogName = String(card?.dataset?.directoryDogName || card?.dataset?.dogName || '').trim();
    if (!host || !dogName || typeof window.queryAppsScript !== 'function') return;

    host.innerHTML = '<div class="v11160-loading">Loading stay history…</div>';
    try {
      const response = await window.queryAppsScript(
        { action: 'get_dog_history', dogName },
        { maxAttempts: 2, timeoutMs: 30000 }
      );
      const history = response?.history || {};
      const stays = Array.isArray(history.previousStays) ? history.previousStays : [];
      host.innerHTML = `
        <section class="v11160-simple-section">
          <div class="v11160-section-head"><div><small>STAY HISTORY</small><h4>🕘 ${html(dogName)}</h4></div><strong>${Number(history.stayCount || stays.length)}</strong></div>
          ${stays.length ? `<div class="v11160-list">${stays.map(stay => `
            <article><strong>${html(stay.startDate || '')} → ${html(stay.endDate || stay.startDate || '')}</strong><span>${html(stay.breed || '')}${stay.bookingType ? ' · ' + html(stay.bookingType) : ''}</span>${stay.notes ? `<small>${html(stay.notes)}</small>` : ''}</article>`).join('')}</div>` : '<div class="v11160-empty">No previous stays found.</div>'}
        </section>`;
    } catch (error) {
      host.innerHTML = `<div class="v11160-error">History could not be loaded.<br>${html(error?.message || String(error))}</div>`;
    }
  }

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
    const breed = String(card?.querySelector('.directory-primary-breed')?.textContent || card?.dataset?.v1088Breed || '').trim();
    if (!host || !dogName || typeof window.queryAppsScript !== 'function') return;

    host.innerHTML = '<div class="v11160-loading">Loading master profile…</div>';
    try {
      const response = await window.queryAppsScript(
        { action: 'get_dog_master_profile', dogName, breed },
        { maxAttempts: 2, timeoutMs: 30000 }
      );
      const record = response?.record || {};
      host.innerHTML = `
        <section class="v11160-simple-section">
          <div class="v11160-section-head"><div><small>PERSISTENT DOG PROFILE</small><h4>⭐ ${html(record.dogName || dogName)}</h4></div><strong>${Number(record.stayCount || 0)} stays</strong></div>
          <div class="v11160-master-grid">
            <div><small>Breed</small><strong>${html(record.breed || breed || 'Not recorded')}</strong></div>
            <div><small>Owner</small><strong>${html(record.ownerName || 'Not recorded')}</strong></div>
            <div><small>Contact</small><strong>${html(record.phone || 'Not recorded')}</strong></div>
            <div><small>Profile</small><strong>${record.persisted ? 'Saved Master' : 'Built from history'}</strong></div>
          </div>
          ${record.notes ? `<div class="v11160-note"><small>KNOWN NOTES</small><p>${html(record.notes)}</p></div>` : ''}
        </section>`;
    } catch (error) {
      host.innerHTML = `<div class="v11160-error">Master Profile could not be loaded.<br>${html(error?.message || String(error))}</div>`;
    }
  }

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
    const wanted = TAB_KEYS.has(card.dataset.v11160ActiveTab)
      ? card.dataset.v11160ActiveTab
      : selectedFromLegacy(card);
    select(card, wanted, { load: false, focus: false });
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

    if (!isDesktopCare()) {
      document.querySelectorAll('.directory-card.v11160-desktop-profile').forEach(teardownCard);
      return;
    }

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
      @media (min-width:769px) {
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
          position:relative;
          z-index:12;
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
          padding:8px 10px;
          font:inherit;
          font-size:11px;
          font-weight:800;
          cursor:pointer;
          transition:background .15s ease,color .15s ease,box-shadow .15s ease;
        }
        body[data-waffle-page="directory"] .v11160-desktop-tab:hover {
          background:var(--wh-surface-soft,#eef3f8);
          color:var(--wh-text,#111827);
        }
        body[data-waffle-page="directory"] .v11160-desktop-tab.is-active {
          background:#243958;
          color:#fff;
          box-shadow:0 1px 2px rgba(15,23,42,.14);
        }
        body[data-waffle-page="directory"] .v11160-desktop-tab:focus-visible {
          outline:2px solid var(--wh-accent,#0f6292);
          outline-offset:2px;
        }
        body[data-waffle-page="directory"] .directory-card.v11160-desktop-profile [data-v11160-managed-panel="true"] {
          display:none!important;
        }
        body[data-waffle-page="directory"] .directory-card.v11160-desktop-profile [data-v11160-managed-panel="true"].is-v11160-active:not([hidden]) {
          display:block!important;
        }
        body.dark-theme[data-waffle-page="directory"] .v11160-desktop-tabs {
          background:#17243a;
          border-color:#334155;
        }
        body.dark-theme[data-waffle-page="directory"] .v11160-desktop-tab {
          color:#aebbd0;
        }
        body.dark-theme[data-waffle-page="directory"] .v11160-desktop-tab:hover {
          background:#22304a;
          color:#fff;
        }
        body.dark-theme[data-waffle-page="directory"] .v11160-desktop-tab.is-active {
          background:#243958;
          color:#fff;
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
      }
    `;
    document.head.appendChild(style);
  }

  function start() {
    if (pageName() !== 'directory') return;
    ensureStyle();
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