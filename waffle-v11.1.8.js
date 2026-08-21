/* ============================================================
   WAFFLE HOUSE V11.1.8 — OPERATIONS UX POLISH
   ============================================================ */

(function () {
  'use strict';

  const VERSION = '11.1.8';
  const state = {
    sortMode: localStorage.getItem('waffleCareSortMode') || 'priority',
    reminders: [],
    directory: null,
    searchData: null,
    searchLoading: null,
    pendingDelete: null,
    toastTimer: null
  };

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function today() {
    return typeof getLocalTodayDateString === 'function'
      ? getLocalTodayDateString()
      : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function esc(value) {
    if (typeof escapeDashboardHtml === 'function') return escapeDashboardHtml(value == null ? '' : String(value));
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function dateText(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (typeof formatStayDateShort === 'function') {
      try { return formatStayDateShort(text); } catch (_) {}
    }
    const date = new Date(text + (text.length <= 10 ? 'T00:00:00' : ''));
    return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }

  function stayKeyForBooking(booking) {
    if (booking?.stayKey) return String(booking.stayKey);
    if (typeof v110MakeStayKey === 'function') {
      return v110MakeStayKey(booking?.dogName || '', booking?.startDate || '', booking?.endDate || booking?.startDate || '');
    }
    return [String(booking?.dogName || '').trim().toLowerCase(), String(booking?.startDate || ''), String(booking?.endDate || booking?.startDate || '')].join('|');
  }

  function statusClass(status) {
    return 'is-' + String(status || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function skeletonRows(count = 3) {
    return `<div class="v1118-skeleton-list" aria-label="Loading">${Array.from({ length: count }, () => '<div class="v1118-skeleton-row"><span></span><div><i></i><i></i></div></div>').join('')}</div>`;
  }

  /* Toasts and save-state feedback */
  function ensureToast() {
    let toast = document.getElementById('v1118Toast');
    if (toast) return toast;
    toast = document.createElement('div');
    toast.id = 'v1118Toast';
    toast.className = 'v1118-toast';
    toast.hidden = true;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = '<div class="v1118-toast-copy"><strong data-v1118-toast-title></strong><span data-v1118-toast-body></span></div><div class="v1118-toast-actions" data-v1118-toast-actions></div>';
    document.body.appendChild(toast);
    return toast;
  }

  function hideToast() {
    const toast = document.getElementById('v1118Toast');
    if (toast) toast.hidden = true;
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = null;
  }

  function showToast(title, body = '', options = {}) {
    const toast = ensureToast();
    if (state.toastTimer) clearTimeout(state.toastTimer);
    toast.className = 'v1118-toast' + (options.kind ? ' is-' + options.kind : '');
    toast.querySelector('[data-v1118-toast-title]').textContent = title || '';
    toast.querySelector('[data-v1118-toast-body]').textContent = body || '';
    const actions = toast.querySelector('[data-v1118-toast-actions]');
    actions.innerHTML = '';
    (Array.isArray(options.actions) ? options.actions : []).forEach(action => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      if (action.primary) button.className = 'is-primary';
      button.addEventListener('click', () => {
        action.onClick?.();
        if (action.keepOpen !== true) hideToast();
      }, { once: true });
      actions.appendChild(button);
    });
    toast.hidden = false;
    const duration = Number(options.duration ?? 3200);
    if (duration > 0) state.toastTimer = setTimeout(hideToast, duration);
    return toast;
  }

  function wireSaveFeedback() {
    if (typeof window.sendPayloadToAppsScript !== 'function' || window.sendPayloadToAppsScript.v1118FeedbackWrapped) return;
    const base = window.sendPayloadToAppsScript;
    const friendly = {
      update_request_source: 'Request source saved',
      save_reminder_note: 'Reminder saved',
      set_reminder_note_done: 'Reminder updated',
      create_boarding: 'Boarding created',
      create_potential: 'Potential stay saved',
      update_potential: 'Potential stay updated',
      confirm_potential: 'Stay confirmed',
      checkin_stay: 'Dog checked in',
      checkout_stay: 'Dog checked out',
      save_belongings: 'Care profile saved',
      save_dog_master_profile: 'Dog profile saved',
      create_meet_greet: 'Meet & Greet saved',
      update_meet_greet: 'Meet & Greet updated'
    };
    const wrapped = async function(payload) {
      const action = String(payload?.action || '');
      try {
        const result = await base(payload);
        if (friendly[action]) showToast('Saved ✓', friendly[action], { kind: 'success', duration: 2200 });
        return result;
      } catch (error) {
        if (friendly[action]) {
          const retryPayload = { ...(payload || {}) };
          showToast('Couldn’t save', error?.message || 'Please try again.', {
            kind: 'error', duration: 6500,
            actions: [{ label: 'Retry', primary: true, onClick: () => wrapped(retryPayload).catch(() => {}) }]
          });
        }
        throw error;
      }
    };
    wrapped.v1118FeedbackWrapped = true;
    wrapped.v111Wrapped = base.v111Wrapped;
    window.sendPayloadToAppsScript = wrapped;
  }

  /* True Undo by deferring non-profile deletion for five seconds. */
  const undoDeleteSelector = [
    '[data-delete-reminder-note]', '[data-delete-reminder]', '[data-reminder-delete]',
    '[data-delete-meet-greet]', '[data-delete-meet]', '[data-delete-belongings-photo]',
    '[data-delete-stay-photo]', '[data-delete-potential]', '.belongings-photo-delete'
  ].join(',');

  function describeDelete(button) {
    if (button.matches('[data-delete-reminder-note],[data-delete-reminder],[data-reminder-delete]')) return 'Reminder';
    if (button.matches('[data-delete-meet-greet],[data-delete-meet]')) return 'Meet & Greet';
    if (button.matches('[data-delete-belongings-photo],[data-delete-stay-photo],.belongings-photo-delete')) return 'Photo';
    if (button.matches('[data-delete-potential]')) return 'Potential stay';
    return 'Item';
  }

  function wireDeleteUndo() {
    if (window.v1118DeleteUndoWired) return;
    window.v1118DeleteUndoWired = true;
    document.addEventListener('click', event => {
      const button = event.target.closest(undoDeleteSelector);
      if (!button || button.closest('.v1115-profile-danger,.v1115-confirm-modal')) return;
      if (button.dataset.v1118DeleteCommitted === 'true') {
        delete button.dataset.v1118DeleteCommitted;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (state.pendingDelete?.timer) clearTimeout(state.pendingDelete.timer);
      const label = describeDelete(button);
      button.classList.add('v1118-delete-pending');
      button.setAttribute('aria-busy', 'true');
      const pending = {
        button,
        label,
        timer: setTimeout(() => {
          if (state.pendingDelete !== pending) return;
          state.pendingDelete = null;
          button.classList.remove('v1118-delete-pending');
          button.removeAttribute('aria-busy');
          button.dataset.v1118DeleteCommitted = 'true';
          button.click();
          showToast(label + ' deleted', 'The deletion is recorded in Logs.', { duration: 2600 });
        }, 5000)
      };
      state.pendingDelete = pending;
      showToast(label + ' will be deleted', 'You have 5 seconds to cancel.', {
        kind: 'warning', duration: 0,
        actions: [{
          label: 'Undo', primary: true,
          onClick: () => {
            if (state.pendingDelete !== pending) return;
            clearTimeout(pending.timer);
            state.pendingDelete = null;
            button.classList.remove('v1118-delete-pending');
            button.removeAttribute('aria-busy');
            showToast('Deletion cancelled ✓', label + ' was not removed.', { kind: 'success', duration: 2200 });
          }
        }]
      });
    }, true);
  }

  /* Quick Action + mobile navigation */
  function openQuickAction(kind = '') {
    if (pageName() !== 'calendar') {
      const suffix = kind ? '&quickAction=' + encodeURIComponent(kind) : '';
      window.location.href = 'index.html?quickAdd=1' + suffix;
      return;
    }
    const sheet = document.getElementById('v10QuickAddSheet');
    if (!sheet) {
      showToast('Quick Action', 'The quick-action panel is still loading. Try again in a moment.', { kind: 'warning' });
      return;
    }
    sheet.hidden = false;
    document.body.classList.add('v10-quick-add-open');
    if (kind) setTimeout(() => sheet.querySelector(`[data-v10-quick-action="${CSS.escape(kind)}"]`)?.focus(), 60);
  }

  function openProfile(stayKey) {
    if (stayKey) window.location.href = 'directory.html?stayKey=' + encodeURIComponent(stayKey);
  }

  function ensureMobileNav() {
    if (document.getElementById('v1118MobileNav')) return;
    const page = pageName();
    const nav = document.createElement('nav');
    nav.id = 'v1118MobileNav';
    nav.className = 'v1118-mobile-nav';
    nav.setAttribute('aria-label', 'Mobile Waffle House navigation');
    nav.innerHTML = `
      <a href="index.html" class="${page === 'calendar' ? 'is-active' : ''}"><span>📅</span><small>Calendar</small></a>
      <a href="directory.html" class="${page === 'directory' ? 'is-active' : ''}"><span>🐾</span><small>Care</small></a>
      <button type="button" class="v1118-mobile-add" data-v1118-open-quick-add aria-label="Add"><span>＋</span><small>Add</small></button>
      <a href="reminders.html" class="${page === 'reminders' ? 'is-active' : ''}"><span>📌</span><small>Reminder</small></a>
      <a href="audit.html" class="${page === 'audit' ? 'is-active' : ''}"><span>🧾</span><small>Logs</small></a>`;
    document.body.appendChild(nav);
  }

  /* Universal search */
  function ensureSearchModal() {
    let modal = document.getElementById('v1118SearchModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v1118SearchModal';
    modal.className = 'v108-modal v1118-search-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v108-modal-card v1118-search-card">
        <div class="v108-modal-head v1118-sticky-head"><div><small>FIND A DOG</small><h3>🔎 Waffle Search</h3><p>Current, upcoming, past stays, Potential Stays and Meet & Greets.</p></div><button type="button" data-v1118-search-close aria-label="Close">×</button></div>
        <div class="v1118-search-input-wrap"><input type="search" data-v1118-search-input placeholder="Search dog, breed or owner…" autocomplete="off"></div>
        <div class="v1118-search-results" data-v1118-search-results>${skeletonRows(4)}</div>
      </div>`;
    document.body.appendChild(modal);
    const input = modal.querySelector('[data-v1118-search-input]');
    let debounce = null;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => renderSearchResults(input.value), 90);
    });
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-v1118-search-close]')) {
        modal.hidden = true;
        return;
      }
      const stay = event.target.closest('[data-v1118-search-stay]');
      if (stay) openProfile(stay.dataset.v1118SearchStay);
      if (event.target.closest('[data-v1118-search-calendar]')) window.location.href = 'index.html';
    });
    return modal;
  }

  function ensureSearchButton() {
    if (document.querySelector('[data-v1118-search-open]')) return;
    const header = document.querySelector('.calendar-header-branding');
    if (!header) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'v1118-global-search-button';
    button.dataset.v1118SearchOpen = '';
    button.setAttribute('aria-label', 'Search all dogs');
    button.title = 'Search all dogs';
    button.innerHTML = '<span aria-hidden="true">🔎</span><span class="v1118-search-button-label">Search</span>';
    const theme = header.querySelector('#themeToggle,.theme-toggle-header');
    header.insertBefore(button, theme || null);
  }

  async function loadSearchData(force = false) {
    if (state.searchData && !force) return state.searchData;
    if (state.searchLoading) return state.searchLoading;
    state.searchLoading = (async () => {
      let current = {}, past = {};
      if (typeof queryAppsScript === 'function') {
        [current, past] = await Promise.all([
          queryAppsScript({ action: 'get_guest_directory' }, { maxAttempts: 2, timeoutMs: 35000 }).catch(() => ({ bookings: [], summaries: [] })),
          queryAppsScript({ action: 'get_past_guest_directory', limit: 200 }, { maxAttempts: 2, timeoutMs: 35000 }).catch(() => ({ bookings: [], summaries: [] }))
        ]);
      }
      const summaryMap = new Map();
      [...(current.summaries || []), ...(past.summaries || [])].forEach(summary => { if (summary?.stayKey) summaryMap.set(String(summary.stayKey), summary); });
      const rows = [];
      const seen = new Set();
      const addBooking = (booking, status) => {
        const stayKey = stayKeyForBooking(booking);
        const key = status + '|' + stayKey;
        if (!stayKey || seen.has(key)) return;
        seen.add(key);
        const summary = summaryMap.get(stayKey) || {};
        rows.push({ type: 'stay', stayKey, dogName: String(booking.dogName || 'Guest'), breed: String(booking.breed || ''), ownerName: String(booking.ownerName || booking.owner || ''), startDate: String(booking.startDate || ''), endDate: String(booking.endDate || booking.startDate || ''), status, photo: String(summary?.dogPhoto?.previewUrl || summary?.dogPhoto?.url || '') });
      };
      (current.bookings || []).forEach(b => addBooking(b, String(b.startDate || '') > today() ? 'UPCOMING' : 'AT HOME'));
      (past.bookings || []).forEach(b => addBooking(b, 'PAST STAY'));
      const events = typeof globalCalendar !== 'undefined' && globalCalendar?.getEvents
        ? globalCalendar.getEvents().slice()
        : (typeof v110LatestCalendarEvents !== 'undefined' && Array.isArray(v110LatestCalendarEvents) ? v110LatestCalendarEvents : []);
      events.forEach(event => {
        const props = event?.extendedProps || {};
        if (props.isMeetGreet !== true && props.isPotential !== true) return;
        const dogName = String(props.dogName || event.title || 'Guest').replace(/^.*Meet & Greet:\s*/i, '').trim();
        const raw = typeof v10EventRawDates === 'function' ? v10EventRawDates(event) : { start: event.startStr || '', end: event.endStr || '' };
        rows.push({ type: 'calendar', stayKey: '', dogName, breed: String(props.breed || ''), ownerName: String(props.ownerName || props.owner || ''), startDate: String(raw.start || ''), endDate: String(raw.end || raw.start || ''), status: props.isMeetGreet === true ? 'MEET & GREET' : 'POTENTIAL', photo: '' });
      });
      state.directory = current;
      state.searchData = rows;
      state.searchLoading = null;
      return rows;
    })();
    return state.searchLoading;
  }

  function renderSearchResults(query) {
    const host = document.querySelector('[data-v1118-search-results]');
    if (!host) return;
    const text = String(query || '').trim().toLowerCase();
    const rows = (state.searchData || [])
      .filter(row => !text || [row.dogName, row.breed, row.ownerName, row.status].join(' ').toLowerCase().includes(text))
      .sort((a, b) => {
        const w = status => ['AT HOME', 'UPCOMING', 'MEET & GREET', 'POTENTIAL'].includes(status) ? 0 : 1;
        return w(a.status) - w(b.status) || a.dogName.localeCompare(b.dogName);
      }).slice(0, 60);
    if (!rows.length) {
      host.innerHTML = `<div class="v1118-empty"><span>🔎</span><strong>No dogs match “${esc(query)}”.</strong><small>Try the dog’s name, breed or owner.</small></div>`;
      return;
    }
    host.innerHTML = rows.map(row => `
      <button type="button" class="v1118-search-result" ${row.type === 'stay' ? `data-v1118-search-stay="${esc(row.stayKey)}"` : 'data-v1118-search-calendar'}>
        <span class="v1118-search-photo">${row.photo ? `<img src="${esc(row.photo)}" alt="" loading="lazy">` : '🐶'}</span>
        <span class="v1118-search-copy"><strong>${esc(row.dogName)}</strong><span>${esc(row.breed || 'Breed not recorded')}${row.ownerName ? ` · ${esc(row.ownerName)}` : ''}</span><small>${row.startDate ? `${esc(dateText(row.startDate))}${row.endDate && row.endDate !== row.startDate ? ` → ${esc(dateText(row.endDate))}` : ''}` : ''}</small></span>
        <span class="v1118-status-chip ${statusClass(row.status)}">${esc(row.status)}</span>
      </button>`).join('');
  }

  async function openSearch() {
    const modal = ensureSearchModal();
    modal.hidden = false;
    const input = modal.querySelector('[data-v1118-search-input]');
    modal.querySelector('[data-v1118-search-results]').innerHTML = skeletonRows(5);
    setTimeout(() => input.focus(), 30);
    await loadSearchData();
    renderSearchResults(input.value);
  }

  /* Care status, priority indicators and sorting */
  function careCardStatus(card) {
    const currentDate = today();
    const start = String(card?.dataset?.directoryStartDate || card?.dataset?.startDate || '');
    const end = String(card?.dataset?.directoryEndDate || card?.dataset?.endDate || '');
    const stayKey = String(card?.dataset?.directoryStayKey || '');
    let op = null;
    try { if (typeof v110OperationForStay === 'function') op = v110OperationForStay(stayKey); } catch (_) {}
    if (String(op?.status || '') === 'checked_out') return 'CHECKED OUT';
    if (card?.dataset?.v1082PastStay === 'true' || (end && end < currentDate)) return 'PAST STAY';
    if (start === currentDate && String(op?.status || '') !== 'checked_in') return 'ARRIVING TODAY';
    if (end === currentDate) return 'LEAVING TODAY';
    if (start && start > currentDate) return 'UPCOMING';
    return 'AT HOME';
  }

  function reminderMatchesDog(dogName) {
    const currentDate = today();
    return state.reminders.some(note => {
      if (String(note?.status || '').toLowerCase() === 'done') return false;
      if (String(note?.dogName || '').trim().toLowerCase() !== String(dogName || '').trim().toLowerCase()) return false;
      const due = String(note?.reminderDate || '').slice(0, 10);
      return due && due <= currentDate;
    });
  }

  function careSignals(card) {
    const stayKey = String(card?.dataset?.directoryStayKey || '');
    const dogName = String(card?.dataset?.directoryDogName || card?.dataset?.dogName || '');
    const summary = (typeof directorySummaryRecordsCache !== 'undefined' ? directorySummaryRecordsCache?.[stayKey] : null) || {};
    const risk = (typeof careRiskRecordsCache !== 'undefined' ? careRiskRecordsCache?.[stayKey]?.riskFlags : null) || summary.riskFlags || {};
    const status = careCardStatus(card);
    const phone = String(card?.dataset?.v1088Phone || card?.dataset?.phone || '').trim();
    const signals = [];
    if (risk.medicated === true) signals.push({ icon: '💊', label: 'Medication', weight: 90 });
    if (risk.foodAllergy === true) signals.push({ icon: '⚠️', label: 'Food allergy', weight: 95 });
    if (risk.escapeRisk === true) signals.push({ icon: '🚪', label: 'Escape risk', weight: 92 });
    if (status === 'LEAVING TODAY') signals.push({ icon: '👋', label: 'Checkout today', weight: 100 });
    if (status === 'ARRIVING TODAY') signals.push({ icon: '🛬', label: 'Arrival today', weight: 75 });
    if (reminderMatchesDog(dogName)) signals.push({ icon: '📌', label: 'Reminder due', weight: 98 });
    if (!Number(summary.intakeFieldCount || 0)) signals.push({ icon: '📋', label: 'Intake missing', weight: 45 });
    if (!phone || phone === 'N/A') signals.push({ icon: '☎️', label: 'Phone missing', weight: 55 });
    return signals;
  }

  function decorateCareCard(card) {
    const button = card?.querySelector('.directory-guest-tile-open');
    if (!button) return;
    const status = careCardStatus(card);
    let chip = button.querySelector('[data-v1118-status-chip]');
    if (!chip) {
      chip = document.createElement('span');
      chip.dataset.v1118StatusChip = '';
      button.appendChild(chip);
    }
    chip.className = 'v1118-status-chip v1118-care-status ' + statusClass(status);
    chip.textContent = status;
    const signals = careSignals(card);
    let host = button.querySelector('[data-v1118-care-signals]');
    if (!host) {
      host = document.createElement('span');
      host.dataset.v1118CareSignals = '';
      host.className = 'v1118-care-signals';
      button.appendChild(host);
    }
    host.innerHTML = signals.slice(0, 3).map(signal => `<span title="${esc(signal.label)}" aria-label="${esc(signal.label)}">${esc(signal.icon)}</span>`).join('');
    host.hidden = signals.length === 0;
    card.dataset.v1118PriorityScore = String(signals.reduce((sum, signal) => sum + signal.weight, 0));
  }

  function decorateAllCareCards() {
    if (pageName() !== 'directory') return;
    document.querySelectorAll('.directory-card[data-directory-stay-key]').forEach(decorateCareCard);
    enhanceProfileDisclosure();
    sortCareCards();
  }

  function ensureCareSort() {
    if (pageName() !== 'directory' || document.querySelector('[data-v1118-care-sort]')) return;
    const toolbar = document.querySelector('.guest-directory-toolbar');
    if (!toolbar) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'v1118-care-sort';
    wrapper.dataset.v1118CareSort = '';
    wrapper.innerHTML = '<span>Sort</span><div role="group" aria-label="Care guest sort"><button type="button" data-v1118-sort="priority">Today’s priority</button><button type="button" data-v1118-sort="alpha">A–Z</button></div>';
    toolbar.appendChild(wrapper);
    updateSortButtons();
  }

  function updateSortButtons() {
    document.querySelectorAll('[data-v1118-sort]').forEach(button => {
      const active = button.dataset.v1118Sort === state.sortMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function sortCareCards() {
    const grid = document.getElementById('directory-grid');
    if (!grid || document.querySelector('.directory-dashboard-fused.is-profile-mode')) return;
    const cards = Array.from(grid.querySelectorAll('.directory-card[data-directory-stay-key]'));
    cards.sort((a, b) => {
      const an = String(a.dataset.directoryDogName || '').toLowerCase();
      const bn = String(b.dataset.directoryDogName || '').toLowerCase();
      if (state.sortMode === 'alpha') return an.localeCompare(bn);
      return Number(b.dataset.v1118PriorityScore || 0) - Number(a.dataset.v1118PriorityScore || 0) || an.localeCompare(bn);
    });
    cards.forEach(card => grid.appendChild(card));
  }

  async function loadCareReminders() {
    if (typeof queryAppsScript !== 'function') return;
    try {
      const response = await queryAppsScript({ action: 'get_reminders_notes' }, { maxAttempts: 1, timeoutMs: 25000 });
      state.reminders = Array.isArray(response?.records) ? response.records : [];
    } catch (_) { state.reminders = []; }
    decorateAllCareCards();
  }

  function wrapDirectoryRender() {
    if (typeof window.applyGuestDirectoryResponse !== 'function' || window.applyGuestDirectoryResponse.v1118Wrapped) return;
    const base = window.applyGuestDirectoryResponse;
    const wrapped = function(response, options = {}) {
      state.directory = response || state.directory;
      const result = base(response, options);
      setTimeout(() => { ensureCareSort(); decorateAllCareCards(); }, 40);
      return result;
    };
    wrapped.v1118Wrapped = true;
    window.applyGuestDirectoryResponse = wrapped;
  }

  /* Calendar Needs Attention */
  function ensureAttentionPanel() {
    if (pageName() !== 'calendar') return null;
    let panel = document.getElementById('v1118AttentionPanel');
    if (panel) return panel;
    const grid = document.querySelector('.v10-stat-grid');
    if (!grid) return null;
    panel = document.createElement('section');
    panel.id = 'v1118AttentionPanel';
    panel.className = 'v1118-attention-panel';
    panel.innerHTML = `<div class="v1118-attention-heading"><div><small>TODAY’S PRIORITY</small><h2>Needs attention</h2></div><span data-v1118-attention-count>0</span></div><div class="v1118-attention-list" data-v1118-attention-list>${skeletonRows(3)}</div>`;
    grid.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function calendarEvents() {
    if (typeof globalCalendar !== 'undefined' && globalCalendar?.getEvents) return globalCalendar.getEvents().slice();
    if (typeof v110LatestCalendarEvents !== 'undefined' && Array.isArray(v110LatestCalendarEvents)) return v110LatestCalendarEvents;
    return [];
  }

  function buildAttentionItems(events, directoryResponse) {
    const currentDate = today();
    const items = [];
    (Array.isArray(events) ? events : []).forEach(event => {
      const props = event?.extendedProps || {};
      const dates = typeof v10EventRawDates === 'function' ? v10EventRawDates(event) : { start: event.startStr || '', end: event.endStr || '' };
      const dog = String(props.dogName || event.title || 'Guest').replace(/^.*Meet & Greet:\s*/i, '').trim();
      if (props.isPotential === true && String(dates.start || '') >= currentDate) {
        items.push({ icon: '❓', title: dog, meta: 'Potential stay waiting for a decision', weight: 70, action: 'potential' });
        return;
      }
      if (props.isMeetGreet === true && String(dates.start || '') === currentDate) {
        items.push({ icon: '🤝', title: dog, meta: `Meet & Greet today${typeof getMeetGreetTime === 'function' ? ' · ' + getMeetGreetTime(event) : ''}`, weight: 75, action: 'meet' });
        return;
      }
      if (props.isMeetGreet === true || props.isPotential === true) return;
      let checkedOut = false;
      try { if (typeof v110IsCheckedOutEvent === 'function') checkedOut = v110IsCheckedOutEvent(event); } catch (_) {}
      if (dates.end && dates.end < currentDate && !checkedOut) {
        items.push({ icon: '⚠️', title: dog, meta: `Checkout overdue · ended ${dateText(dates.end)}`, weight: 110, stayKey: typeof v110StayKeyForEvent === 'function' ? v110StayKeyForEvent(event) : '' });
      }
    });
    const bookings = directoryResponse?.bookings || [];
    const summaryMap = new Map((directoryResponse?.summaries || []).map(summary => [String(summary.stayKey || ''), summary]));
    bookings.forEach(booking => {
      const key = stayKeyForBooking(booking);
      const start = String(booking.startDate || '');
      const end = String(booking.endDate || start);
      if (currentDate < start || currentDate > end) return;
      if (!String(booking.phone || '').trim() || String(booking.phone || '').trim() === 'N/A') items.push({ icon: '☎️', title: booking.dogName || 'Guest', meta: 'Owner contact number missing', weight: 85, stayKey: key });
      if (!Number((summaryMap.get(key) || {}).intakeFieldCount || 0)) items.push({ icon: '📋', title: booking.dogName || 'Guest', meta: 'Intake profile needs completion', weight: 60, stayKey: key });
    });
    const dedupe = new Map();
    items.forEach(item => { const key = [item.icon, item.title, item.meta].join('|'); if (!dedupe.has(key)) dedupe.set(key, item); });
    return Array.from(dedupe.values()).sort((a, b) => b.weight - a.weight).slice(0, 8);
  }

  async function renderAttention(events = calendarEvents()) {
    const panel = ensureAttentionPanel();
    if (!panel) return;
    const host = panel.querySelector('[data-v1118-attention-list]');
    const count = panel.querySelector('[data-v1118-attention-count]');
    let directoryResponse = state.directory;
    if (!directoryResponse && typeof queryAppsScript === 'function') {
      try { directoryResponse = await queryAppsScript({ action: 'get_guest_directory' }, { maxAttempts: 1, timeoutMs: 30000 }); } catch (_) { directoryResponse = {}; }
      state.directory = directoryResponse;
    }
    const items = buildAttentionItems(events, directoryResponse || {});
    count.textContent = String(items.length);
    panel.classList.toggle('is-clear', items.length === 0);
    if (!items.length) {
      host.innerHTML = '<div class="v1118-attention-clear"><span>✓</span><div><strong>Everything looks covered.</strong><small>No overdue stays or missing essentials detected for today.</small></div></div>';
      return;
    }
    host.innerHTML = items.map((item, index) => `<button type="button" class="v1118-attention-item" data-v1118-attention-index="${index}"><span class="v1118-attention-icon">${esc(item.icon)}</span><span><strong>${esc(item.title)}</strong><small>${esc(item.meta)}</small></span><span aria-hidden="true">›</span></button>`).join('');
    host.querySelectorAll('[data-v1118-attention-index]').forEach(button => {
      button.addEventListener('click', () => {
        const item = items[Number(button.dataset.v1118AttentionIndex)];
        if (item?.stayKey) openProfile(item.stayKey);
        else if (item?.action) openQuickAction(item.action);
      });
    });
  }

  function wrapOperationsRender() {
    if (typeof window.renderV10OperationsHome !== 'function' || window.renderV10OperationsHome.v1118Wrapped) return;
    const base = window.renderV10OperationsHome;
    const wrapped = function(events) {
      const result = base(events);
      if (pageName() === 'calendar') setTimeout(() => renderAttention(events).catch(() => {}), 20);
      return result;
    };
    wrapped.v1118Wrapped = true;
    window.renderV10OperationsHome = wrapped;
  }

  /* Better empty states */
  function improveEmptyStates() {
    const mappings = [
      ['.v1116-meet-empty', 'Schedule Meet & Greet', 'meet'],
      ['.v1116-at-home-empty', 'Add Boarding', 'boarding'],
      ['.v110-leaving-empty', 'Open Care', 'care']
    ];
    mappings.forEach(([selector, label, action]) => {
      document.querySelectorAll(selector).forEach(host => {
        if (host.querySelector('[data-v1118-empty-action]')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.v1118EmptyAction = action;
        button.className = 'v1118-empty-action';
        button.textContent = '+ ' + label;
        host.appendChild(button);
      });
    });
    const potential = document.getElementById('v10PotentialCards');
    if (potential && /No Potential|No pending|No potential/i.test(potential.textContent || '') && !potential.querySelector('[data-v1118-empty-action]')) {
      potential.insertAdjacentHTML('beforeend', '<button type="button" class="v1118-empty-action" data-v1118-empty-action="potential">+ Add Potential Stay</button>');
    }
  }

  /* Progressive disclosure uses existing Profile/Belongings/sub-tabs, polished as sticky segmented navigation. */
  function enhanceProfileDisclosure() {
    if (pageName() !== 'directory') return;
    document.querySelectorAll('.directory-card.is-profile-active').forEach(card => {
      card.querySelector('.directory-main-profile-tabs')?.classList.add('v1118-profile-segments');
      card.querySelector('.directory-profile-content')?.classList.add('v1118-progressive-profile');
    });
  }

  /* Modal loading skeletons */
  function wrapModalOpen(name, id, listSelector) {
    const fn = window[name];
    if (typeof fn !== 'function' || fn.v1118Wrapped) return;
    const wrapped = async function(...args) {
      const host = document.getElementById(id)?.querySelector(listSelector);
      if (host) host.innerHTML = skeletonRows(3);
      const result = await fn.apply(this, args);
      setTimeout(improveEmptyStates, 20);
      return result;
    };
    wrapped.v1118Wrapped = true;
    window[name] = wrapped;
  }

  function wireModalSkeletons() {
    wrapModalOpen('v111OpenArrivalModal', 'v111ArrivalModal', '[data-v111-arrival-list]');
    wrapModalOpen('v110OpenLeavingModal', 'v110LeavingModal', '[data-v110-leaving-list]');
    wrapModalOpen('v1116OpenAtHomeModal', 'v1116AtHomeModal', '[data-v1116-at-home-list]');
    wrapModalOpen('v1116OpenMeetGreetModal', 'v1116MeetGreetModal', '[data-v1116-meet-list]');
  }

  function wireClicks() {
    if (window.v1118ClicksWired) return;
    window.v1118ClicksWired = true;
    document.addEventListener('click', event => {
      if (event.target.closest('[data-v1118-open-quick-add]')) { event.preventDefault(); openQuickAction(); return; }
      if (event.target.closest('[data-v1118-search-open]')) { event.preventDefault(); openSearch().catch(error => showToast('Search unavailable', error?.message || String(error), { kind: 'error' })); return; }
      const sort = event.target.closest('[data-v1118-sort]');
      if (sort) {
        state.sortMode = sort.dataset.v1118Sort === 'alpha' ? 'alpha' : 'priority';
        localStorage.setItem('waffleCareSortMode', state.sortMode);
        updateSortButtons();
        sortCareCards();
        return;
      }
      const empty = event.target.closest('[data-v1118-empty-action]');
      if (empty) {
        const action = String(empty.dataset.v1118EmptyAction || '');
        if (action === 'care') window.location.href = 'directory.html';
        else openQuickAction(action);
      }
    });
  }

  function openQuickAddFromUrl() {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('quickAdd') === '1') setTimeout(() => openQuickAction(params.get('quickAction') || ''), 650);
  }

  function oneShotPolish() {
    ensureSearchButton();
    ensureCareSort();
    decorateAllCareCards();
    improveEmptyStates();
    enhanceProfileDisclosure();
  }

  function init() {
    if (window.v1118Initialised) return;
    window.v1118Initialised = true;
    ensureToast();
    ensureMobileNav();
    ensureSearchButton();
    wireClicks();
    wireDeleteUndo();
    wireSaveFeedback();
    wrapDirectoryRender();
    wrapOperationsRender();
    wireModalSkeletons();
    openQuickAddFromUrl();
    if (pageName() === 'directory') {
      ensureCareSort();
      decorateAllCareCards();
      loadCareReminders().catch(() => {});
    }
    if (pageName() === 'calendar') {
      ensureAttentionPanel();
      renderAttention().catch(() => {});
    }
    oneShotPolish();
    setTimeout(oneShotPolish, 300);
    setTimeout(oneShotPolish, 1000);
    window.WAFFLE_V1118 = { version: VERSION, showToast, openSearch, openQuickAction, decorateAllCareCards, renderAttention };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
