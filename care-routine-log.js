/* ============================================================
   Timestamped, stay-specific care routine activity.
   Entries and drafts are kept in memory only; the server is the source of truth.
   ============================================================ */
(function () {
  'use strict';

  const TYPES = ['feeding', 'walk', 'medication'];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const drafts = new Map();
  const formDrafts = new Map();

  const clean = value => String(value == null ? '' : value).trim();
  const lower = value => clean(value).toLowerCase();
  const esc = value => clean(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const identityFor = card => ({
    stayId: clean(card?.dataset?.directoryStayId),
    dogId: clean(card?.dataset?.directoryDogId),
    stayKey: clean(card?.dataset?.directoryStayKey || card?.dataset?.stayKey)
  });
  const validIdentity = identity => !!identity && UUID.test(identity.stayId) && UUID.test(identity.dogId) && !!identity.stayKey;
  const identityKey = identity => `${lower(identity.stayId)}\u001f${lower(identity.dogId)}\u001f${identity.stayKey}`;
  const identityStillMatches = (card, identity) => validIdentity(identity) && card.isConnected && card.classList.contains('is-profile-active') && identityKey(identityFor(card)) === identityKey(identity);
  function activityAllowed(card) {
    const startDate = clean(card?.dataset?.directoryStartDate || card?.dataset?.startDate);
    const endDate = clean(card?.dataset?.directoryEndDate || card?.dataset?.endDate);
    const status = `${clean(card?.dataset?.directoryStatus)} ${clean(card?.dataset?.status)} ${clean(card?.querySelector('.v1118-status-chip')?.textContent)}`.toLowerCase();
    const todayParts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const today = `${todayParts.find(part => part.type === 'year')?.value}-${todayParts.find(part => part.type === 'month')?.value}-${todayParts.find(part => part.type === 'day')?.value}`;
    return !/checked\s*out|completed|past stay/.test(status) &&
      (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && startDate <= today) &&
      (/^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate >= today);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Time unavailable';
    return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Sydney' }).format(date);
  }

  function validEvent(event, identity) {
    return event && typeof event === 'object' &&
      lower(event.stayId) === lower(identity.stayId) &&
      lower(event.dogId) === lower(identity.dogId) &&
      clean(event.stayKey) === identity.stayKey &&
      UUID.test(clean(event.eventId)) && TYPES.includes(clean(event.type)) &&
      (event.note === undefined || typeof event.note === 'string') &&
      Number.isFinite(new Date(event.recordedAt).getTime());
  }

  function eventLabel(type) { return ({ feeding: 'Feeding', walk: 'Walk', medication: 'Medication given' })[type] || type; }
  function renderEvents(host, events) {
    if (!events.length) {
      host.innerHTML = '<p class="care-routine-empty">No completed activities have been recorded for this stay.</p>';
      return;
    }
    host.innerHTML = `<ol class="care-routine-events">${events.map(event => `<li><div><strong>${esc(eventLabel(event.type))}</strong><time datetime="${esc(event.recordedAt)}">${esc(formatTime(event.recordedAt))}</time></div>${clean(event.note) ? `<p>${esc(event.note)}</p>` : ''}</li>`).join('')}</ol>`;
  }

  async function readEvents(identity, card, host, status) {
    if (!identityStillMatches(card, identity)) return null;
    if (typeof window.queryAppsScript !== 'function') throw new Error('Care activity service is not available yet.');
    const response = await window.queryAppsScript({ action: 'get_care_routine_log', stayId: identity.stayId, dogId: identity.dogId, stayKey: identity.stayKey }, { maxAttempts: 1, timeoutMs: 25000 });
    if (!identityStillMatches(card, identity)) return null;
    if (response?.result !== 'success' || response?.careRoutineLogVersion !== 1 || !Array.isArray(response.events)) {
      throw new Error(response?.error || 'Saved activity is not available yet. Try again later.');
    }
    if (!response.events.every(event => validEvent(event, identity))) throw new Error('Saved activity did not match this exact stay. Nothing was shown.');
    const events = response.events.sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt))).slice(0, 50);
    renderEvents(host, events);
    if (status) status.textContent = `Showing ${events.length} saved ${events.length === 1 ? 'entry' : 'entries'} for this stay.`;
    return events;
  }

  function mount(card) {
    if (!card?.classList?.contains('is-profile-active')) return;
    const brief = card.querySelector('[data-directory-care-brief]');
    const host = brief || card.querySelector('[data-directory-main-panel="profile"]');
    if (!host) return;
    const identity = identityFor(card);
    const key = identityKey(identity);
    const allowed = activityAllowed(card);
    const existing = card.querySelector('[data-care-routine-log]');
    if (existing?.dataset.careRoutineIdentity === key && existing.dataset.careRoutineAllowed === String(allowed)) {
      return;
    }
    if (existing) existing.remove();
    const section = document.createElement('section');
    section.className = 'care-routine-log';
    section.dataset.careRoutineLog = '';
    section.dataset.careRoutineIdentity = key;
    section.dataset.careRoutineAllowed = String(allowed);
    section.innerHTML = '<details><summary><span><strong>Recent care activity</strong><small>Completed feeding, walks and medication for this stay</small></span><span class="care-routine-count" data-care-routine-count>Not loaded</span></summary><div class="care-routine-body"><p class="care-routine-status" data-care-routine-status role="status" aria-live="polite">Activity loads when you open this section.</p><div data-care-routine-events></div><form data-care-routine-form><fieldset><legend>Record a completed activity</legend><div class="care-routine-types"><button type="button" data-care-routine-type="feeding" aria-pressed="false" disabled>Feeding</button><button type="button" data-care-routine-type="walk" aria-pressed="false" disabled>Walk</button><button type="button" data-care-routine-type="medication" aria-pressed="false" disabled>Medication given</button></div><label>Optional note<textarea data-care-routine-note rows="2" maxlength="500" placeholder="Add a brief note" disabled></textarea></label><button type="submit" data-care-routine-submit disabled>Record completed activity</button><p data-care-routine-unavailable hidden></p></fieldset></form></div></details>';
    const actionBar = brief?.querySelector('.directory-care-brief-actions');
    if (actionBar) actionBar.insertAdjacentElement('beforebegin', section);
    else host.appendChild(section);
    const state = { identity, key, loaded: false, capable: false, loading: false, saving: false, selected: '', events: [], allowed };
    const details = section.querySelector('details');
    const status = section.querySelector('[data-care-routine-status]');
    const eventHost = section.querySelector('[data-care-routine-events]');
    const count = section.querySelector('[data-care-routine-count]');
    const form = section.querySelector('form');
    const note = section.querySelector('[data-care-routine-note]');
    const submit = section.querySelector('[data-care-routine-submit]');
    const unavailable = section.querySelector('[data-care-routine-unavailable]');
    const remembered = formDrafts.get(key);
    if (remembered) { note.value = remembered.note; }
    if (!allowed) {
      unavailable.hidden = false;
      unavailable.textContent = 'This stay has ended. You can review saved activity, but cannot record new entries.';
      section.querySelectorAll('[data-care-routine-type], [data-care-routine-note]').forEach(control => { control.disabled = true; });
    }
    const syncControls = () => {
      section.querySelectorAll('[data-care-routine-type]').forEach(button => { button.disabled = !state.capable || !state.allowed || state.saving; });
      note.disabled = !state.capable || !state.allowed || state.saving;
      submit.disabled = !state.capable || !state.allowed || !state.selected || state.saving;
    };
    const setSelected = type => {
      if (!state.capable || !state.allowed || state.saving) return;
      state.selected = type;
      section.querySelectorAll('[data-care-routine-type]').forEach(button => button.setAttribute('aria-pressed', button.dataset.careRoutineType === type ? 'true' : 'false'));
      formDrafts.set(key, { type, note: clean(note.value) });
      syncControls();
    };
    section.addEventListener('click', event => {
      const typeButton = event.target.closest('[data-care-routine-type]');
      if (typeButton && section.contains(typeButton)) setSelected(typeButton.dataset.careRoutineType);
    });
    details.addEventListener('toggle', async () => {
      if (!details.open || state.loaded || state.loading) return;
      state.loading = true; status.textContent = 'Loading saved activity…'; count.textContent = 'Loading';
      try {
        const events = await readEvents(state.identity, card, eventHost, status);
        if (!events || !section.isConnected) return;
        state.loaded = true; state.capable = true; state.events = events; count.textContent = `${events.length} saved`;
        if (remembered?.type) setSelected(remembered.type);
        syncControls();
      } catch (error) {
        if (!section.isConnected || !identityStillMatches(card, state.identity)) return;
        state.capable = false;
        syncControls();
        status.textContent = `${error?.message || String(error)} No activity has been added locally.`;
        eventHost.innerHTML = '<button type="button" data-care-routine-retry>Retry loading activity</button>';
        count.textContent = 'Unavailable';
      } finally { state.loading = false; }
    });
    section.addEventListener('click', event => {
      if (!event.target.closest('[data-care-routine-retry]')) return;
      state.loaded = false; state.capable = false; syncControls(); details.open = false;
      window.setTimeout(() => { if (section.isConnected) details.open = true; }, 0);
    });
    note.addEventListener('input', () => { submit.disabled = !state.selected || state.saving; });
    note.addEventListener('input', () => { formDrafts.set(key, { type: state.selected, note: clean(note.value) }); syncControls(); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (state.saving || !state.capable || !state.allowed || !state.selected) return;
      const text = clean(note.value);
      if (text.length > 500) { status.textContent = 'Notes can be up to 500 characters.'; return; }
      if (!activityAllowed(card)) { state.allowed = false; unavailable.hidden = false; unavailable.textContent = 'This stay is not in progress. You can review saved activity, but cannot record new entries.'; syncControls(); status.textContent = unavailable.textContent; return; }
      if (!identityStillMatches(card, state.identity)) { status.textContent = 'This profile changed. Reopen the stay before recording activity.'; return; }
      if (navigator.onLine === false) { status.textContent = 'You are offline. Activity was not recorded; reconnect before retrying.'; return; }
      if (typeof window.sendPayloadToAppsScript !== 'function') { status.textContent = 'Care activity saving is not available yet.'; return; }
      const draftKey = `${state.key}\u001f${state.selected}\u001f${text}`;
      let draft = drafts.get(draftKey);
      if (!draft && typeof window.crypto?.randomUUID !== 'function') { status.textContent = 'This browser cannot securely identify a care entry. Use an updated browser before recording.'; return; }
      if (!draft) { draft = { eventId: window.crypto.randomUUID(), type: state.selected, note: text }; drafts.set(draftKey, draft); }
      state.saving = true; syncControls(); submit.textContent = 'Saving…';
      if (section.isConnected && identityStillMatches(card, state.identity)) status.textContent = 'Saving completed activity…';
      try {
        const payload = { action: 'record_care_routine_event', stayId: state.identity.stayId, dogId: state.identity.dogId, stayKey: state.identity.stayKey, eventId: draft.eventId, type: draft.type, ...(draft.note ? { note: draft.note } : {}) };
        const response = await window.sendPayloadToAppsScript(payload);
        const saved = response?.event;
        if (response?.result !== 'success' || response?.queued === true || !validEvent(saved, state.identity) || lower(saved.eventId) !== lower(draft.eventId) || saved.type !== draft.type || clean(saved.note) !== draft.note) {
          throw new Error(response?.error || 'The save was not confirmed. Retry to check the same entry.');
        }
        drafts.delete(draftKey); formDrafts.delete(key);
        state.events = [saved, ...state.events.filter(item => lower(item.eventId) !== lower(saved.eventId))].sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt))).slice(0, 50);
        state.loaded = true;
        if (!identityStillMatches(card, state.identity) || !section.isConnected) return;
        note.value = ''; setSelected(''); renderEvents(eventHost, state.events); count.textContent = `${state.events.length} saved`;
        status.textContent = `${eventLabel(saved.type)} recorded for this stay at ${formatTime(saved.recordedAt)}.`;
      } catch (error) {
        if (section.isConnected && identityStillMatches(card, state.identity)) status.textContent = `${error?.message || String(error)} The entry remains available in this session with the same retry ID.`;
      } finally {
        state.saving = false;
        if (section.isConnected && identityStillMatches(card, state.identity)) { submit.textContent = 'Record completed activity'; syncControls(); }
      }
    });
  }

  function isDirectory() { return window.WAFFLE_PAGE === 'directory' || document.body?.dataset?.wafflePage === 'directory'; }
  function scan() { if (isDirectory()) document.querySelectorAll('.directory-card.is-profile-active').forEach(mount); }
  if (isDirectory()) {
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-directory-stay-id', 'data-directory-dog-id', 'data-directory-stay-key', 'data-directory-start-date', 'data-directory-end-date', 'data-status'] });
    scan();
  }

  window.WAFFLE_CARE_ROUTINE_LOG = Object.freeze({
    async getSavedSummaryForIdentity(identity) {
      const requested = { stayId: clean(identity?.stayId), dogId: clean(identity?.dogId), stayKey: clean(identity?.stayKey) };
      if (!validIdentity(requested)) throw new Error('An exact Stay ID, Dog ID and stay key are required for activity lookup.');
      if (navigator.onLine === false) throw new Error('You are offline. Saved activity was not added to the owner update.');
      if (typeof window.queryAppsScript !== 'function') throw new Error('Saved care activity is not available yet.');
      const response = await window.queryAppsScript({ action: 'get_care_routine_log', stayId: requested.stayId, dogId: requested.dogId, stayKey: requested.stayKey }, { maxAttempts: 1, timeoutMs: 25000 });
      if (response?.result !== 'success' || response?.careRoutineLogVersion !== 1 || !Array.isArray(response.events)) return null;
      if (!response.events.every(event => validEvent(event, requested))) return null;
      const events = response.events.slice().sort((a, b) => String(a.recordedAt).localeCompare(String(b.recordedAt))).slice(-50);
      return { identity: requested, events, text: events.map(event => `${formatTime(event.recordedAt)} · ${eventLabel(event.type)}${clean(event.note) ? ` — ${clean(event.note)}` : ''}`).join('\n') };
    }
  });
})();
