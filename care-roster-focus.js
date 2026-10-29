/* Optional, loaded-data-only filters for today's Care roster work. */
(function () {
  'use strict';
  if (window.WAFFLE_CARE_ROSTER_FOCUS) return;

  const MODES = Object.freeze({ all: 'All stays', arriving: 'Arriving today', leaving: 'Leaving today' });
  let mode = 'all';
  let stateCache = new WeakMap();
  let rootObserver = null;
  const checkInCaptures = new WeakMap();

  function today() {
    if (typeof window.getLocalTodayDateString === 'function') return String(window.getLocalTodayDateString() || '').slice(0, 10);
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function validDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.toISOString().slice(0, 10) === value;
  }

  function stayState(card) {
    const cached = stateCache.get(card);
    if (cached) return cached;
    const d = card?.dataset || {};
    const start = String(d.directoryStartDate || d.startDate || '').slice(0, 10);
    const end = String(d.directoryEndDate || d.endDate || '').slice(0, 10);
    const hasIdentity = !!(d.directoryStayId && d.directoryDogId && (d.directoryStayKey || d.stayKey));
    let operation = null;
    try {
      if (typeof window.v110OperationDisplayState === 'function') operation = window.v110OperationDisplayState(card);
    } catch (_) {}
    const code = String(operation?.code || '').toLowerCase();
    let result;
    if (card?.dataset?.v1082PastStay === 'true' || card?.closest?.('#past-directory-grid') || !validDate(start) || !validDate(end) || end < start) {
      result = { kind: 'out', start, end, code };
    } else if (code === 'checked_out') {
      result = { kind: 'out', start, end, code };
    } else if (!hasIdentity || !operation || code === 'collision' || /identity|mismatch|ambiguous/.test(code)) {
      result = { kind: 'unknown', start, end, code };
    } else if (code === 'date_active' || code === 'checked_in') {
      result = { kind: 'known', start, end, code };
    } else {
      result = { kind: 'unknown', start, end, code };
    }
    stateCache.set(card, result);
    return result;
  }

  function matchesMode(card, requested = mode) {
    if (requested === 'all') return true;
    const state = stayState(card);
    if (state.kind !== 'known') return false;
    const key = today();
    if (requested === 'arriving') return state.start === key && state.end >= key && state.code === 'date_active';
    if (requested === 'leaving') return state.end === key && ['date_active', 'checked_in'].includes(state.code);
    return true;
  }

  function counts() {
    const cards = Array.from(document.querySelectorAll('#directory-grid .directory-card'));
    let arriving = 0, leaving = 0, unknown = 0;
    const key = today();
    cards.forEach(card => {
      const state = stayState(card);
      if (state.start !== key && state.end !== key) return;
      if (state.kind !== 'known') { if (state.kind === 'unknown') unknown++; return; }
      if (state.start === key && state.end >= key && state.code === 'date_active') arriving++;
      if (state.end === key && ['date_active', 'checked_in'].includes(state.code)) leaving++;
    });
    return { arriving, leaving, unknown, loaded: cards.length };
  }

  function getState() {
    return { mode, label: MODES[mode], ...counts() };
  }

  function applyCanonicalFilter() {
    if (typeof window.WAFFLE_REAPPLY_DIRECTORY_FILTER === 'function') window.WAFFLE_REAPPLY_DIRECTORY_FILTER();
  }

  function ensureDisclosure() {
    const toolbar = document.querySelector('.guest-directory-toolbar');
    if (!toolbar) return null;
    let details = toolbar.querySelector('[data-care-roster-focus]');
    if (details) return details;
    details = document.createElement('details');
    details.dataset.careRosterFocus = '';
    details.className = 'care-roster-focus';
    details.innerHTML = `<summary data-focus-summary>Today's work</summary>
      <div data-focus-options role="group" aria-label="Today's operational roster filter">
        <button type="button" data-focus-mode="all" aria-pressed="true">All stays</button>
        <button type="button" data-focus-mode="arriving" aria-pressed="false">Arriving today <span data-focus-count="arriving">0</span></button>
        <button type="button" data-focus-mode="leaving" aria-pressed="false">Leaving today <span data-focus-count="leaving">0</span></button>
        <button type="button" data-focus-clear disabled>Clear filter</button>
      </div>
      <p data-focus-status role="status" aria-live="polite"></p>`;
    const summary = details.querySelector('summary');
    summary.style.minHeight = '44px';
    details.querySelectorAll('button').forEach(button => {
      button.style.minHeight = '44px';
      button.addEventListener('click', () => {
        if (!button.dataset.focusMode) return;
        mode = button.dataset.focusMode || 'all';
        renderControls();
        applyCanonicalFilter();
        details.open = false;
        summary.focus({ preventScroll: true });
      });
    });
    details.querySelector('[data-focus-clear]').addEventListener('click', () => {
      mode = 'all';
      renderControls();
      applyCanonicalFilter();
      summary.focus();
    });
    toolbar.appendChild(details);
    const clear = toolbar.querySelector('[data-focus-clear]');
    toolbar.insertBefore(clear, details.nextSibling);
    clear.classList.add('care-roster-focus-clear');
    return details;
  }

  function renderControls(context) {
    const details = ensureDisclosure();
    if (!details) return;
    const data = counts();
    const arrivingCount = details.querySelector('[data-focus-count="arriving"]');
    const leavingCount = details.querySelector('[data-focus-count="leaving"]');
    if (arrivingCount.textContent !== String(data.arriving)) arrivingCount.textContent = String(data.arriving);
    if (leavingCount.textContent !== String(data.leaving)) leavingCount.textContent = String(data.leaving);
    details.querySelectorAll('[data-focus-mode]').forEach(button => {
      const selected = button.dataset.focusMode === mode;
      if (button.getAttribute('aria-pressed') !== String(selected)) button.setAttribute('aria-pressed', String(selected));
    });
    const clear = details.closest('.guest-directory-toolbar')?.querySelector('[data-focus-clear]');
    if (!clear) return;
    const clearUnavailable = context
      ? context.profileMode || context.activeView !== 'current'
      : document.querySelector('.directory-dashboard-fused')?.classList.contains('is-profile-mode') ||
        document.querySelector('[data-v1082-stay-tab].is-active')?.dataset.v1082StayTab !== 'current';
    const hideClear = mode === 'all' || clearUnavailable;
    if (clear.hidden !== hideClear) clear.hidden = hideClear;
    if (clear.disabled) clear.disabled = false;
    const summary = details.querySelector('[data-focus-summary]');
    const visible = context && context.activeView === 'current' && !context.profileMode && Number.isFinite(Number(context.visibleMatches))
      ? Math.max(0, Number(context.visibleMatches)) : data[mode];
    const narrowed = mode !== 'all' && context?.activeView === 'current' && !context.profileMode && !!context.search && visible < data[mode];
    const nextSummary = mode === 'all' ? "Today's work" : `${MODES[mode]} · ${narrowed ? `${visible} of ${data[mode]}` : data[mode]}`;
    if (summary.textContent !== nextSummary) summary.textContent = nextSummary;
    const summaryLabel = mode === 'all' ? "Today's work filters" : narrowed
      ? `${MODES[mode]} filter · ${visible} visible of ${data[mode]} loaded stays`
      : `${MODES[mode]} filter · ${data[mode]} loaded stays`;
    if (summary.getAttribute('aria-label') !== summaryLabel) summary.setAttribute('aria-label', summaryLabel);
    const clearLabel = mode === 'all' ? 'Clear filter' : `Clear ${MODES[mode]} filter`;
    if (clear.getAttribute('aria-label') !== clearLabel) clear.setAttribute('aria-label', clearLabel);
    const status = details.querySelector('[data-focus-status]');
    const unknownText = data.unknown ? ` ${data.unknown} loaded stay${data.unknown === 1 ? '' : 's'} ${data.unknown === 1 ? 'has' : 'have'} unknown or conflicting operational status and ${data.unknown === 1 ? 'is' : 'are'} omitted from today's counts${mode === 'all' ? '' : ' and this filter'}.` : '';
    const nextStatus = mode === 'all'
      ? `${data.arriving} pending arrival${data.arriving === 1 ? '' : 's'} · ${data.leaving} departure${data.leaving === 1 ? '' : 's'} today in the loaded roster.${unknownText}`
      : `${MODES[mode]} · ${context?.activeView ? `combined with ${context.activeView === 'current' ? 'Staying' : context.activeView === 'future' ? 'Arriving' : 'Past'}` : 'combined with the selected stay tab'} and search.${unknownText}`;
    if (status.textContent !== nextStatus) status.textContent = nextStatus;
    if (context) {
      const hidden = !!(context.profileMode || context.activeView !== 'current');
      if (details.hidden !== hidden) details.hidden = hidden;
    }
  }

  function afterCanonicalFilter(context) { renderControls(context); }

  function cardIdentity(card) {
    const d = card?.dataset || {};
    const identity = { stayId: String(d.directoryStayId || ''), dogId: String(d.directoryDogId || ''), stayKey: String(d.directoryStayKey || d.stayKey || '') };
    return identity.stayId && identity.dogId && identity.stayKey ? identity : null;
  }

  function sameIdentity(a, b) {
    return !!a && !!b && a.stayId === b.stayId && a.dogId === b.dogId && a.stayKey === b.stayKey;
  }

  function visibleControl(node) {
    if (!node?.isConnected || !node.getClientRects().length || node.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
      if (parent.tagName === 'DETAILS' && !parent.open && !parent.querySelector(':scope > summary')?.contains(node)) return false;
    }
    return true;
  }

  function pendingCheckIn(card) {
    const identity = cardIdentity(card);
    const button = card?.querySelector('[data-v11217-roster-checkin]');
    return identity && card.isConnected && card.closest('#directory-grid') && card.style.display !== 'none' &&
      matchesMode(card, 'arriving') && stayState(card).code === 'date_active' && button && !button.disabled && button.getAttribute('aria-disabled') !== 'true' && visibleControl(button)
      ? { card, button, identity } : null;
  }

  function arrivalCandidates() {
    return Array.from(document.querySelectorAll('#directory-grid .directory-card'))
      .map(pendingCheckIn).filter(Boolean);
  }

  function currentContext() {
    const query = String(document.getElementById('guestDirectorySearch')?.value || '');
    const activeTab = document.querySelector('[data-v1082-stay-tab].is-active')?.dataset.v1082StayTab || 'current';
    return { mode, query, activeTab, profileMode: !!document.querySelector('.directory-dashboard-fused.is-profile-mode') };
  }

  function captureCheckIn(card, button) {
    const current = currentContext();
    const eligible = pendingCheckIn(card);
    if (mode !== 'arriving' || current.activeTab !== 'current' || current.profileMode || !eligible || eligible.button !== button || document.activeElement !== button) return null;
    const candidates = arrivalCandidates();
    const index = candidates.findIndex(item => item.card === card && sameIdentity(item.identity, eligible.identity));
    if (index < 0) return null;
    const token = Object.freeze({});
    const capture = {
      identity: eligible.identity,
      card,
      button,
      previous: index > 0 ? candidates[index - 1].identity : null,
      next: index + 1 < candidates.length ? candidates[index + 1].identity : null,
      query: current.query,
      mode: current.mode,
      activeTab: current.activeTab,
      profileMode: current.profileMode,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      focusMoved: false,
      focusListener: null
    };
    capture.focusListener = event => { if (![button, document.body, document.documentElement].includes(event.target)) capture.focusMoved = true; };
    document.addEventListener('focusin', capture.focusListener, true);
    checkInCaptures.set(token, capture);
    return token;
  }

  function takeCheckIn(token) {
    const capture = token && checkInCaptures.get(token);
    if (!capture) return null;
    checkInCaptures.delete(token);
    document.removeEventListener('focusin', capture.focusListener, true);
    return capture;
  }

  function cancelCheckIn(token) { return !!takeCheckIn(token); }

  function completeCheckIn(token, card, payload) {
    const capture = takeCheckIn(token);
    if (!capture) return false;
    const success = payload === true || payload?.verified === true || payload?.success === true || payload?.status === 'success' || payload?.status === 'verified';
    stateCache.delete(card);
    if (!success || card !== capture.card || !sameIdentity(capture.identity, cardIdentity(card)) || stayState(card).code !== 'checked_in') return false;
    const context = currentContext();
    if (context.mode !== capture.mode || context.query !== capture.query || context.activeTab !== capture.activeTab || context.profileMode !== capture.profileMode || window.scrollX !== capture.scrollX || window.scrollY !== capture.scrollY) return false;
    const focusStillOwned = !capture.focusMoved && (document.activeElement === capture.button || document.activeElement === document.body);
    if (!focusStillOwned) return false;

    applyCanonicalFilter();
    window.scrollTo(capture.scrollX, capture.scrollY);
    const originalFocus = capture.button;
    const expectedContext = { ...context };
    const expectedScrollX = window.scrollX, expectedScrollY = window.scrollY;
    window.requestAnimationFrame(() => {
      const now = currentContext();
      if (now.mode !== expectedContext.mode || now.query !== expectedContext.query || now.activeTab !== expectedContext.activeTab || now.profileMode !== expectedContext.profileMode || window.scrollX !== expectedScrollX || window.scrollY !== expectedScrollY) return;
      stateCache.delete(card);
      if (!card.isConnected || !sameIdentity(capture.identity, cardIdentity(card)) || stayState(card).code !== 'checked_in') return;
      if (document.activeElement !== originalFocus && document.activeElement !== document.body && document.activeElement !== document.documentElement) return;
      const candidates = arrivalCandidates();
      const targetIdentity = capture.next || capture.previous;
      let target = candidates.find(item => sameIdentity(item.identity, targetIdentity));
      if (capture.next && !target) target = candidates.find(item => sameIdentity(item.identity, capture.previous));
      if (target) {
        target.button.focus({ preventScroll: true });
      } else {
        const summary = document.querySelector('[data-care-roster-focus] [data-focus-summary]');
        const search = document.getElementById('guestDirectorySearch');
        (visibleControl(summary) ? summary : visibleControl(search) ? search : null)?.focus?.({ preventScroll: true });
      }
      window.scrollTo(expectedScrollX, expectedScrollY);
    });
    return true;
  }

  function refresh() {
    stateCache = new WeakMap();
    if (typeof window.WAFFLE_REAPPLY_DIRECTORY_FILTER === 'function') applyCanonicalFilter();
    else renderControls();
  }

  function observe() {
    const grid = document.getElementById('directory-grid');
    if (!grid || rootObserver || typeof MutationObserver !== 'function') return;
    rootObserver = new MutationObserver(records => {
      const changed = records.some(record => {
        if (record.type !== 'childList') return true;
        const nodes = [...record.addedNodes, ...record.removedNodes];
        return nodes.some(node => !(node.nodeType === 1 && (node.matches?.('[data-waffle-arrival-ready]') || node.closest?.('[data-waffle-arrival-ready]'))));
      });
      if (changed) refresh();
    });
    rootObserver.observe(grid, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-directory-stay-id', 'data-directory-dog-id', 'data-directory-stay-key', 'data-directory-start-date', 'data-directory-end-date', 'data-v1082-past-stay', 'data-operation-state', 'class'] });
    ['waffle:stay-operation-updated', 'waffle:early-checkout-recorded', 'waffle:roster-updated'].forEach(name => window.addEventListener(name, refresh));
  }

  const api = Object.freeze({
    beginFilterPass() { stateCache = new WeakMap(); },
    matches(card) {
      if (mode === 'all' || document.querySelector('[data-v1082-stay-tab].is-active')?.dataset.v1082StayTab !== 'current') return true;
      return matchesMode(card);
    },
    getState,
    labelForMode(modeName) { return MODES[modeName] || ''; },
    afterCanonicalFilter,
    captureCheckIn,
    completeCheckIn,
    cancelCheckIn,
    refresh,
    clear() { mode = 'all'; refresh(); }
  });
  window.WAFFLE_CARE_ROSTER_FOCUS = api;

  function start() {
    ensureDisclosure();
    observe();
    renderControls();
    applyCanonicalFilter();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
