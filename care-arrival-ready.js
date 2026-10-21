/* Compact arrival indicators for the already-loaded Care roster. */
(function () {
  'use strict';

  if (window.WAFFLE_ARRIVAL_READY) return;

  const CARD = '.directory-card';
  const OWN = '[data-waffle-arrival-ready]';
  let observer = null;
  let refreshQueued = false;
  let focusAnchorCard = null;
  let focusNextStayId = '';

  function today() {
    if (typeof window.getLocalTodayDateString === 'function') {
      return String(window.getLocalTodayDateString() || '').slice(0, 10);
    }
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function identity(card) {
    const d = card.dataset || {};
    return {
      stayId: String(d.directoryStayId || ''),
      dogId: String(d.directoryDogId || ''),
      stayKey: String(d.directoryStayKey || d.stayKey || ''),
      name: String(d.directoryDogName || d.dogName || ''),
      dogNumber: String(d.directoryDogNumber || d.dogNumber || ''),
      owner: String(d.v1088OwnerName || d.directoryOwnerName || d.ownerName || ''),
      start: String(d.directoryStartDate || d.startDate || '').slice(0, 10),
      end: String(d.directoryEndDate || d.endDate || '').slice(0, 10)
    };
  }

  function intake(card) {
    if (window.WAFFLE_INTAKE_STATUS && typeof window.WAFFLE_INTAKE_STATUS.getState === 'function') {
      try { return window.WAFFLE_INTAKE_STATUS.getState(card) || { code: 'unknown' }; }
      catch (_) { return { code: 'unknown' }; }
    }
    const strip = card.querySelector('[data-directory-intake]');
    if (!strip || strip.getAttribute('aria-busy') !== 'false') return { code: 'unknown' };
    const text = (strip.textContent || '').toLowerCase();
    if (/\bintake complete\b|\bcomplete\b/.test(text)) return { code: 'complete', label: 'Intake complete' };
    if (/awaiting owner|create link|no digital intake/.test(text)) return { code: 'not_prepared', label: 'Review intake' };
    return { code: 'unknown' };
  }

  function evidence(card, status) {
    const d = identity(card);
    const op = typeof window.v110OperationForStay === 'function'
      ? window.v110OperationForStay({ stayId: d.stayId, dogId: d.dogId, stayKey: d.stayKey, dogName: d.name, startDate: d.start, endDate: d.end })
      : null;
    const display = typeof window.v110OperationDisplayState === 'function' ? window.v110OperationDisplayState(card) : null;
    if (card.dataset.v1082PastStay === 'true' || card.closest('#past-directory-grid') || op?.status === 'checked_out' || op?.status === 'checked_in') return null;
    if (!d.stayId || !d.dogId || !d.stayKey || !d.name || !/^\d{4}-\d{2}-\d{2}$/.test(d.start) || !/^\d{4}-\d{2}-\d{2}$/.test(d.end)) return null;
    if (d.start !== today() || d.end < today()) return null;
    const displayCode = String(display?.code || '').toLowerCase();
    if (['collision', 'checked_out', 'checked_in'].includes(displayCode) || /identity|mismatch|ambiguous/.test(displayCode)) return null;
    if (op?.identityConflict || op?.collision || op?.mismatchedIdentity || op?.status === 'identity_conflict') return null;
    if (status?.identityConflict || status?.collision || status?.mismatchedIdentity) return null;
    return { d, op };
  }

  function signature(card, state) {
    return JSON.stringify({ state: state || {}, displayIdentity: identity(card) });
  }

  function updateIndicator(card, root, state) {
    const code = String(state?.code || 'unknown');
    const fallbackLabels = {
      complete: 'Intake complete',
      link_ready: 'Link ready',
      not_prepared: 'Not prepared',
      unknown: 'Status unknown'
    };
    const label = String(state?.label || fallbackLabels[code] || 'Status unknown');
    const detail = String(state?.detail || (code === 'unknown' ? 'Care details have not loaded.' : 'Check the care profile for any outstanding items.'));
    if (!root) {
      root = document.createElement('button');
      root.type = 'button';
      root.dataset.waffleArrivalReady = '';
      root.innerHTML = `<span data-arrival-copy><span data-arrival-checklist-row><span data-arrival-step>Intake</span><strong data-arrival-label></strong></span><small data-arrival-detail></small><span data-arrival-checklist-row><span data-arrival-step>Care</span><span data-arrival-care>Review instructions</span></span></span><span data-arrival-action aria-hidden="true">Review care</span>`;
      root.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        card.querySelector('.directory-guest-tile-open')?.click();
      });
    }
    root.querySelector('[data-arrival-label]').textContent = label;
    const detailNode = root.querySelector('[data-arrival-detail]');
    const detailText = code === 'complete' ? '' : detail;
    detailNode.textContent = detailText;
    detailNode.hidden = !detailText;
    const d = identity(card);
    root.dataset.stateSignature = signature(card, state);
    const dogIdentity = [d.name, d.dogNumber ? `Dog Number ${d.dogNumber}` : '', d.owner ? `owner ${d.owner}` : '', d.start && d.end ? `${d.start} to ${d.end}` : ''].filter(Boolean).join(', ');
    root.setAttribute('aria-label', `Review care for ${dogIdentity || 'this dog'}: ${label}${detailText ? `. ${detailText}` : ''}. Review feeding, medication and safety before check-in.`);
    root.title = `${detail} Review feeding, medication and safety before check-in.`;
    return root;
  }

  function ensureQuickFocus(grid, count) {
    let button = document.querySelector('[data-waffle-arrival-next]');
    const host = grid;
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.waffleArrivalNext = '';
      button.addEventListener('click', () => {
        const cards = visibleCheckins(grid);
        if (!cards.length) return;
        let next = focusNextStayId ? cards.find(item => identity(item.closest(CARD)).stayId === focusNextStayId) : null;
        if (!next && focusAnchorCard?.isConnected) {
          const ordered = Array.from(grid.querySelectorAll(CARD));
          const anchorIndex = ordered.indexOf(focusAnchorCard);
          next = cards.find(item => ordered.indexOf(item.closest(CARD)) > anchorIndex);
        }
        next ||= cards[0];
        const card = next.closest(CARD);
        card?.querySelector('[data-v11217-roster-checkin]')?.focus({ preventScroll: false });
        focusAnchorCard = card || null;
        const currentIndex = cards.indexOf(next);
        const following = cards[(currentIndex + 1) % cards.length];
        focusNextStayId = following ? identity(following.closest(CARD)).stayId : '';
      });
      host.parentNode?.insertBefore(button, host);
    }
    const currentView = document.querySelector('[data-v1082-stay-tab].is-active')?.dataset.v1082StayTab || 'current';
    const profileMode = !!grid.closest('.directory-dashboard-fused')?.classList.contains('is-profile-mode') || !!grid.querySelector('.directory-card.is-profile-active');
    const hiddenPanel = grid.closest('[hidden]') || document.querySelector('#v1082CurrentStayPanel[hidden]');
    const shownCount = currentView === 'current' && !profileMode && !hiddenPanel ? visibleCheckins(grid).length : 0;
    const nextText = `Next arrival · ${shownCount}`;
    if (button.textContent !== nextText) button.textContent = nextText;
    const shouldHide = shownCount === 0;
    if (button.hidden !== shouldHide) button.hidden = shouldHide;
  }

  function visibleCheckins(grid) {
    if (!grid || grid.closest('[hidden]') || grid.closest('.directory-dashboard-fused')?.classList.contains('is-profile-mode')) return [];
    return Array.from(grid.querySelectorAll('.directory-card'))
      .filter(card => card.querySelector(OWN) && !card.hidden && card.style.display !== 'none' && getComputedStyle(card).display !== 'none' && !card.closest('[hidden]'))
      .map(card => card.querySelector('[data-v11217-roster-checkin]'))
      .filter(control => control && !control.disabled);
  }

  function refresh() {
    const grid = document.getElementById('directory-grid');
    if (!grid) return { count: 0 };
    const activeView = document.querySelector('[data-v1082-stay-tab].is-active')?.dataset.v1082StayTab || 'current';
    const cards = Array.from(grid.querySelectorAll(CARD));
    const seen = new Set();
    let count = 0;
    cards.forEach(card => {
      const id = identity(card);
      const status = intake(card);
      const valid = evidence(card, status);
      const dup = id.stayId && seen.has(id.stayId);
      if (id.stayId) seen.add(id.stayId);
      let node = card.querySelector(OWN);
      const visible = activeView === 'current' && card.style.display !== 'none' && getComputedStyle(card).display !== 'none' && !card.closest('[hidden]');
      if (!valid || dup || !visible) { if (node) node.remove(); return; }
      const sig = signature(card, status);
      if (!node) node = updateIndicator(card, null, status);
      else if (node.dataset.stateSignature !== sig) updateIndicator(card, node, status);
      if (!node.isConnected) (card.querySelector('.directory-guest-tile-open') || card).insertAdjacentElement('afterend', node);
      count++;
    });
    ensureQuickFocus(grid, count);
    return { count };
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    Promise.resolve().then(() => { refreshQueued = false; refresh(); });
  }

  function observe() {
    const grid = document.getElementById('directory-grid');
    if (!grid || observer) return;
    observer = new MutationObserver(records => {
      const meaningful = records.some(record => {
        if (record.type === 'childList') {
          const changed = [...record.addedNodes, ...record.removedNodes];
          return changed.some(node => !(node.nodeType === 1 && (node.matches?.(OWN) || node.matches?.('[data-waffle-arrival-next]'))));
        }
        return true;
      });
      if (meaningful) scheduleRefresh();
    });
    const scope = grid.closest('.directory-dashboard-fused') || document.querySelector('.v1082-stay-panels') || grid.parentElement;
    observer.observe(scope, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-directory-stay-id', 'data-directory-dog-id', 'data-directory-dog-number', 'data-directory-stay-key', 'data-directory-start-date', 'data-directory-end-date', 'data-directory-owner-name', 'data-v1088-owner-name', 'data-v1082-past-stay', 'style', 'class', 'hidden'] });
    document.querySelectorAll('[data-v1082-stay-tab]').forEach(tab => tab.addEventListener('click', () => setTimeout(scheduleRefresh, 0)));
    document.getElementById('guestDirectorySearch')?.addEventListener('input', scheduleRefresh);
  }

  const api = { refresh, getState: () => ({ count: document.querySelectorAll(`#directory-grid ${OWN}`).length }) };
  window.WAFFLE_ARRIVAL_READY = api;
  window.addEventListener('waffle:intake-status-updated', scheduleRefresh);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { observe(); refresh(); }, { once: true });
  else { observe(); refresh(); }
})();
