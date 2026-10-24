/* Compact, evidence-based intake status beside the owner care action. */
(function () {
  'use strict';
  if (window.WAFFLE_INTAKE_STATUS) return;

  const linked = new WeakMap();
  const lastStates = new WeakMap();
  const refreshingBrief = new WeakSet();
  let observers = new Map();
  let rootObserver = null;

  function stayKey(card) {
    return String(card?.dataset?.directoryStayKey || card?.dataset?.stayKey || '');
  }
  function identity(card) {
    return [
      stayKey(card),
      String(card?.dataset?.directoryDogId || ''),
      String(card?.dataset?.directoryStayId || ''),
      String(card?.dataset?.directoryDogName || card?.dataset?.dogName || '').trim().toLocaleLowerCase(),
      String(card?.dataset?.directoryStartDate || card?.dataset?.startDate || ''),
      String(card?.dataset?.directoryEndDate || card?.dataset?.endDate || '')
    ].join('|');
  }
  function trustedReceiptTimestamp(value) {
    const raw = String(value || '');
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(raw);
    if (!match) return '';
    const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHourText, offsetMinuteText] = match;
    const year = Number(yearText), month = Number(monthText), day = Number(dayText);
    const hour = Number(hourText), minute = Number(minuteText), second = Number(secondText);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] || hour > 23 || minute > 59 || second > 59) return '';
    if (offsetHourText !== undefined && (Number(offsetHourText) > 23 || Number(offsetMinuteText) > 59)) return '';
    return Number.isFinite(Date.parse(raw)) ? raw : '';
  }
  function formatReceiptTimestamp(value) {
    const date = new Date(value);
    return date.toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function stateFor(card) {
    const strip = card?.querySelector?.('[data-directory-intake]');
    const currentIdentity = identity(card);
    const prepared = linked.get(card);
    const hasPreparedLink = !!prepared && prepared.identity === currentIdentity;
    if (strip?.getAttribute('aria-busy') === 'true') {
      return hasPreparedLink
        ? { code: 'link_ready', label: 'Link ready', action: 'Share care link', detail: 'Preparing or copying a link does not send it to the owner. Choose Copy or Share.' }
        : { code: 'unknown', label: 'Loading', detail: 'Checking owner intake status.' };
    }
    const dot = strip?.querySelector('.directory-intake-dot');
    const text = String(strip?.textContent || '').replace(/\s+/g, ' ').trim();
    if (strip && dot?.classList.contains('is-complete') && /intake complete/i.test(text)) {
      if (strip.dataset.directoryIntake && strip.dataset.directoryIntake !== stayKey(card)) {
        return { code: 'unknown', label: 'Status unknown', action: 'Review owner form', detail: 'Status is not available. Check Records & forms for submitted answers.' };
      }
      const meta = strip.querySelector('.directory-record-meta');
      if ((meta?.dataset?.intakeReceivedAt || meta?.dataset?.intakeReceivedFor) && meta.dataset.intakeReceivedFor !== currentIdentity) {
        return { code: 'unknown', label: 'Status unknown', action: 'Review owner form', detail: 'Status is not available. Check Records & forms for submitted answers.' };
      }
      if (/stored profile/i.test(meta?.textContent || '')) {
        if (hasPreparedLink) return { code: 'link_ready', label: 'Link ready', action: 'Share care link', detail: 'Preparing or copying a link does not send it to the owner. Choose Copy or Share.' };
        return { code: 'unknown', label: card.dataset.intakeMethod === 'legacy' ? 'Care profile available' : 'Saved care available', action: 'Review owner form', detail: 'Current form completion is not verified. Check Records & forms for submitted answers.' };
      }
      const receivedAt = trustedReceiptTimestamp(meta?.dataset?.intakeReceivedAt);
      const received = receivedAt ? `Owner form received ${formatReceiptTimestamp(receivedAt)}. ` : '';
      return { code: 'complete', label: 'Form received', action: 'Review owner form', detail: `${received}Review the submitted answers in Records & forms.`, method: 'digital' };
    }
    if (hasPreparedLink) return { code: 'link_ready', label: 'Link ready', action: 'Share care link', detail: 'Preparing or copying a link does not send it to the owner. Choose Copy or Share.' };
    if (!strip) return { code: 'unknown', label: 'Status unknown', action: 'Review owner form', detail: 'Status is not available. Check Records & forms for submitted answers.' };
    if (card.dataset.intakeMethod === 'legacy') return { code: 'unknown', label: 'Care profile available', action: 'Review owner form', detail: 'Current form completion is not verified. Check Records & forms for submitted answers.' };
    if (dot?.classList.contains('is-awaiting')) return { code: 'link_ready', label: 'Awaiting owner', action: 'Share care link', detail: 'This form has not been received yet. Share or follow up using your usual chat.' };
    if (dot?.classList.contains('is-not-sent') && /no digital intake on file/i.test(text)) {
      const prepared = linked.get(card);
      if (prepared && prepared.identity === currentIdentity) return { code: 'link_ready', label: 'Link ready', action: 'Share care link', detail: 'Preparing or copying a link does not send it to the owner. Choose Copy or Share.' };
      return { code: 'not_prepared', label: 'Not prepared', action: 'Prepare owner form', detail: 'No digital intake link is recorded for this stay.' };
    }
    return { code: 'unknown', label: 'Status unknown', action: 'Review owner form', detail: 'Status is not available. Check Records & forms for submitted answers.' };
  }
  function selected(card, d) {
    if (!card?.matches?.('.is-profile-active') || !d || !d.dogName || !d.startDate || !d.endDate) return false;
    const name = String(card.dataset.directoryDogName || card.dataset.dogName || '').trim().toLocaleLowerCase();
    if (!name || name !== String(d.dogName).trim().toLocaleLowerCase()) return false;
    const dates = [card.dataset.directoryStartDate || card.dataset.startDate, card.dataset.directoryEndDate || card.dataset.endDate];
    if (dates[0] !== String(d.startDate) || dates[1] !== String(d.endDate)) return false;
    if (d.dogId && card.dataset.directoryDogId !== String(d.dogId)) return false;
    if (d.stayId && card.dataset.directoryStayId !== String(d.stayId)) return false;
    if (!d.dogId || !d.stayId) {
      const candidates = Array.from(document.querySelectorAll('.directory-card')).filter(candidate => {
        const n = String(candidate.dataset.directoryDogName || candidate.dataset.dogName || '').trim().toLocaleLowerCase();
        return n === String(d.dogName).trim().toLocaleLowerCase()
          && (candidate.dataset.directoryStartDate || candidate.dataset.startDate) === String(d.startDate)
          && (candidate.dataset.directoryEndDate || candidate.dataset.endDate) === String(d.endDate);
      });
      if (candidates.length !== 1 || candidates[0] !== card) return false;
    }
    return true;
  }
  function render(card) {
    const actions = card.querySelector('.directory-care-brief-actions');
    const owner = actions?.querySelector('[data-p4-dir="owner"], [data-firstlevel-owner-care-link], #firstlevelOwnerCareLink, .firstlevelOwnerCareLink');
    if (!actions || !owner) return null;
    let group = actions.querySelector(':scope > .directory-owner-care-action-group');
    if (!group) {
      group = document.createElement('div');
      group.className = 'directory-owner-care-action-group';
      group.dataset.careOwnerLinkGroup = '';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Owner Care link and form status');
      actions.insertBefore(group, owner);
    }
    if (owner.parentElement !== group) group.appendChild(owner);
    let node = actions.querySelector('[data-compact-intake-status]');
    if (!node) {
      node = document.createElement('span');
      node.dataset.compactIntakeStatus = '';
      node.className = 'directory-compact-intake-status';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      group.appendChild(node);
    }
    if (node.parentElement !== group) group.appendChild(node);
    const state = stateFor(card);
    const signature = JSON.stringify(state);
    if (node.dataset.stateSignature !== signature) {
      node.dataset.stateSignature = signature;
      node.dataset.state = state.code;
      node.textContent = state.label;
      if (state.detail) {
        node.title = state.detail;
        node.setAttribute('aria-description', state.detail);
      } else {
        node.removeAttribute('title');
        node.removeAttribute('aria-description');
      }
    }
    const actionLabel = state.action || 'Owner Care Link';
    const dogName = String(card.dataset.directoryDogName || card.dataset.dogName || '').trim();
    const accessibleName = `${actionLabel}${dogName ? ` for ${dogName}` : ''}`;
    const actionButtonLabel = owner.querySelector('span');
    const actionHint = owner.querySelector('small');
    if (actionButtonLabel && actionButtonLabel.textContent !== actionLabel) actionButtonLabel.textContent = actionLabel;
    if (owner.getAttribute('aria-label') !== accessibleName) owner.setAttribute('aria-label', accessibleName);
    if (actionHint && state.detail && actionHint.textContent !== state.detail) actionHint.textContent = state.detail;
    if (owner.getAttribute('aria-description') !== state.detail) {
      if (state.detail) owner.setAttribute('aria-description', state.detail);
      else owner.removeAttribute('aria-description');
    }
    const readiness = card.querySelector('[data-care-readiness-item="intake"]');
    if (readiness && readiness.dataset.compactStatusAvailable !== 'true') readiness.dataset.compactStatusAvailable = 'true';
    const previous = lastStates.get(card);
    if (previous !== signature) {
      lastStates.set(card, signature);
      const refreshCareSetup = window.WAFFLE_REFRESH_CARE_SETUP;
      if (card.isConnected && card.classList.contains('is-profile-active') && typeof refreshCareSetup === 'function' && !refreshingBrief.has(card)) {
        refreshingBrief.add(card);
        try { refreshCareSetup(card); }
        finally { refreshingBrief.delete(card); }
      }
      window.dispatchEvent(new CustomEvent('waffle:intake-status-updated', { detail: { code: state.code, stayKey: stayKey(card) } }));
    }
    return state;
  }
  function refresh(scope) {
    const root = scope || document;
    const cards = [];
    if (root.matches?.('.directory-card')) cards.push(root);
    root.querySelectorAll?.('.directory-card').forEach(card => cards.push(card));
    cards.forEach(render);
    return cards.length;
  }
  window.addEventListener('waffle:owner-care-link-ready', event => {
    const d = event.detail;
    document.querySelectorAll('.directory-card.is-profile-active').forEach(card => {
      if (selected(card, d)) {
        linked.set(card, { identity: identity(card) });
        render(card);
      }
    });
  });
  function observeGrid(grid) {
    if (!grid || observers.has(grid) || typeof MutationObserver !== 'function') return;
    refresh(grid);
    const observer = new MutationObserver(rows => {
      const affected = new Set();
      rows.forEach(row => {
        if (row.target?.closest?.('[data-compact-intake-status]')) return;
        const card = row.target?.closest?.('.directory-card');
        if (card) {
          affected.add(card);
          const isIdentityChange = row.type === 'attributes' && ['data-directory-stay-key', 'data-stay-key', 'data-directory-dog-id', 'data-directory-stay-id', 'data-directory-dog-name', 'data-directory-start-date', 'data-directory-end-date'].includes(row.attributeName);
          const isLoading = row.type === 'attributes' && row.target.matches?.('[data-directory-intake]') && row.target.getAttribute('aria-busy') === 'true';
          if (isIdentityChange || isLoading) {
            const intakeStrip = isLoading ? row.target : card.querySelector('[data-directory-intake]');
            intakeStrip?.querySelectorAll('[data-intake-received-at]').forEach(meta => {
              if (isLoading || meta.dataset.intakeReceivedFor !== identity(card)) meta.removeAttribute('data-intake-received-at');
            });
          }
        }
        row.addedNodes?.forEach(node => {
          if (node.nodeType !== 1 || node.matches?.('[data-compact-intake-status]')) return;
          if (node.matches?.('.directory-card')) affected.add(node);
          node.querySelectorAll?.('.directory-card').forEach(item => affected.add(item));
        });
      });
      affected.forEach(render);
    });
    observer.observe(grid, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-busy', 'class', 'data-intake-method', 'data-intake-received-at', 'data-intake-received-for', 'data-directory-stay-key', 'data-stay-key', 'data-directory-dog-id', 'data-directory-stay-id', 'data-directory-dog-name', 'data-directory-start-date', 'data-directory-end-date'] });
    observers.set(grid, observer);
  }
  function findGrids(root) {
    if (root.matches?.('#directory-grid, #past-directory-grid')) observeGrid(root);
    root.querySelectorAll?.('#directory-grid, #past-directory-grid').forEach(observeGrid);
  }
  function start() {
    findGrids(document);
    if (rootObserver || !document.body || typeof MutationObserver !== 'function') return;
    rootObserver = new MutationObserver(rows => rows.forEach(row => row.addedNodes?.forEach(node => {
      if (node.nodeType === 1) findGrids(node);
    })));
    rootObserver.observe(document.body, { childList: true, subtree: true });
  }
  window.WAFFLE_INTAKE_STATUS = Object.freeze({
    getState(card) { return stateFor(card); },
    refresh
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
