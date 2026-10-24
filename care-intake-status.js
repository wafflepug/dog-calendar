/* Compact, evidence-based intake status beside the owner care action. */
(function () {
  'use strict';
  if (window.WAFFLE_INTAKE_STATUS) return;

  const linked = new WeakMap();
  const lastStates = new WeakMap();
  const renderedLinks = new WeakMap();
  const refreshingBrief = new WeakSet();
  const ownerOptionsDispatch = new WeakSet();
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
    const hasPreparedLink = !!prepared && prepared.identity === currentIdentity && !!prepared.link;
    const directCopy = hasPreparedLink && prepared.canDirectCopy === true;
    if (strip?.getAttribute('aria-busy') === 'true') {
      return directCopy
        ? { code: 'link_ready', label: 'Link ready', action: 'Copy care link', detail: 'Copy the current care link, then paste it into the owner’s usual chat.' }
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
        if (directCopy) return { code: 'link_ready', label: 'Link ready', action: 'Copy care link', detail: 'Copy the current care link, then paste it into the owner’s usual chat.' };
        return { code: 'unknown', label: card.dataset.intakeMethod === 'legacy' ? 'Care profile available' : 'Saved care available', action: 'Review owner form', detail: 'Current form completion is not verified. Check Records & forms for submitted answers.' };
      }
      const receivedAt = trustedReceiptTimestamp(meta?.dataset?.intakeReceivedAt);
      const received = receivedAt ? `Owner form received ${formatReceiptTimestamp(receivedAt)}. ` : '';
      return { code: 'complete', label: 'Form received', action: 'Review owner form', detail: `${received}Review the submitted answers in Records & forms.`, method: 'digital' };
    }
    if (directCopy) return { code: 'link_ready', label: 'Link ready', action: 'Copy care link', detail: 'Copy the current care link, then paste it into the owner’s usual chat.' };
    if (hasPreparedLink) return { code: 'link_ready', label: 'Link ready', action: 'Share care link', detail: 'Review owner sharing options for this prepared care link.' };
    if (!strip) return { code: 'unknown', label: 'Status unknown', action: 'Review owner form', detail: 'Status is not available. Check Records & forms for submitted answers.' };
    if (card.dataset.intakeMethod === 'legacy') return { code: 'unknown', label: 'Care profile available', action: 'Review owner form', detail: 'Current form completion is not verified. Check Records & forms for submitted answers.' };
    if (dot?.classList.contains('is-awaiting')) return { code: 'awaiting', label: 'Awaiting owner', action: 'Review owner form', detail: 'This form has not been received. Review the current owner form status.' };
    if (dot?.classList.contains('is-not-sent') && /no digital intake on file/i.test(text)) {
      const prepared = linked.get(card);
      if (prepared?.link && prepared.identity === currentIdentity) return { code: 'link_ready', label: 'Link ready', action: 'Share care link', detail: 'Review owner sharing options for this prepared care link.' };
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
  function strictSelected(card, d) {
    const key = String(d?.stayKey || stayKey(card));
    if (!selected(card, d) || !d?.dogId || !d?.stayId || !key || stayKey(card) !== key) return false;
    const stayCandidates = Array.from(document.querySelectorAll('.directory-card')).filter(candidate => stayKey(candidate) === key);
    return stayCandidates.length === 1 && stayCandidates[0] === card
      && card.dataset.directoryDogId === String(d.dogId)
      && card.dataset.directoryStayId === String(d.stayId);
  }
  function rememberLink(card, link, d, canDirectCopy, source) {
    const nextIdentity = identity(card);
    const resolvedStayKey = String(d.stayKey || stayKey(card));
    const existing = linked.get(card);
    if (existing && existing.identity === nextIdentity && existing.link === link
      && existing.dogId === String(d.dogId || '') && existing.stayId === String(d.stayId || '')
      && existing.stayKey === resolvedStayKey && existing.canDirectCopy === canDirectCopy && existing.source === source) return existing;
    const prepared = { identity: nextIdentity, link, dogId: String(d.dogId || ''), stayId: String(d.stayId || ''), stayKey: resolvedStayKey, canDirectCopy, source };
    linked.set(card, prepared);
    return prepared;
  }
  function ensureOwnerSharingOptions(card, owner, group) {
    const more = card.querySelector('.directory-care-more-actions-list');
    if (!more || !owner || !group) return;
    let button = more.querySelector(':scope > [data-owner-care-sharing-options]');
    if (button) return;
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.ownerCareSharingOptions = '';
    button.dataset.ownerCareOpenOptions = '';
    button.className = 'directory-owner-care-sharing-options';
    button.textContent = 'Owner sharing options';
    button.addEventListener('click', () => {
      if (!owner.isConnected || owner.disabled) return;
      ownerOptionsDispatch.add(owner);
      owner.click();
    });
    more.appendChild(button);
  }
  function render(card) {
    const actions = card.querySelector('.directory-care-brief-actions');
    const owner = actions?.querySelector('[data-p4-dir="owner"], [data-firstlevel-owner-care-link], #firstlevelOwnerCareLink, .firstlevelOwnerCareLink');
    if (!actions || !owner) return null;
    const priorPrepared = linked.get(card);
    if (priorPrepared && priorPrepared.identity !== identity(card)) linked.delete(card);
    const currentReader = window.WAFFLE_CARE_LINKS?.getCurrent;
    const currentLink = typeof currentReader === 'function' ? currentReader.call(window.WAFFLE_CARE_LINKS, card) : null;
    if (currentLink && selected(card, currentLink)) {
      rememberLink(card, validLink(currentLink.link), currentLink, strictSelected(card, currentLink), 'canonical');
    } else if (typeof currentReader === 'function' && linked.get(card)?.source === 'canonical') {
      linked.delete(card);
    }
    const key = stayKey(card);
    if (key && Array.from(document.querySelectorAll('.directory-card')).filter(candidate => stayKey(candidate) === key).length > 1
      && linked.get(card)?.stayKey === key) linked.delete(card);
    const remembered = linked.get(card);
    if (remembered?.canDirectCopy && !strictSelected(card, {
      dogName: card.dataset.directoryDogName || card.dataset.dogName,
      dogId: remembered.dogId, stayId: remembered.stayId, stayKey: remembered.stayKey,
      startDate: card.dataset.directoryStartDate || card.dataset.startDate,
      endDate: card.dataset.directoryEndDate || card.dataset.endDate
    })) {
      rememberLink(card, remembered.link, { ...remembered, stayKey: remembered.stayKey }, false, remembered.source);
    }
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
    ensureOwnerSharingOptions(card, owner, group);
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
    const prepared = linked.get(card);
    const renderedLink = state.code === 'link_ready' && prepared?.identity === identity(card) ? `${prepared.identity}\n${prepared.link}` : '';
    const priorLink = renderedLinks.get(card) || '';
    if (priorLink !== renderedLink) {
      group.querySelector('[data-owner-care-link-fallback]')?.remove();
      renderedLinks.set(card, renderedLink);
      node.dataset.stateSignature = '';
    }
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
    document.querySelectorAll('.directory-card').forEach(card => {
      if (selected(card, d)) {
        const link = validLink(d.link);
        if (!link) { linked.delete(card); render(card); return; }
        const normalized = { ...d, stayKey: String(d.stayKey || stayKey(card)) };
        const canDirectCopy = strictSelected(card, normalized);
        if ((d.dogId || d.stayId) && !canDirectCopy) { linked.delete(card); render(card); return; }
        rememberLink(card, link, normalized, canDirectCopy, 'event');
        if (card.classList.contains('is-profile-active')) render(card);
      }
    });
  });
  window.addEventListener('waffle:owner-care-link-unavailable', event => {
    const d = event.detail;
    document.querySelectorAll('.directory-card').forEach(card => {
      const prepared = linked.get(card);
      if (prepared && (prepared.stayId === String(d?.stayId || '') && prepared.dogId === String(d?.dogId || '')
        || prepared.stayKey === String(d?.stayKey || ''))
        && prepared.identity === identity(card)) {
        linked.delete(card);
        render(card);
      }
    });
  });
  function observeGrid(grid) {
    if (!grid || observers.has(grid) || typeof MutationObserver !== 'function') return;
    refresh(grid);
    const observer = new MutationObserver(rows => {
      const affected = new Set();
      const changedStayKeys = new Set();
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
          if (node.matches?.('.directory-card')) { affected.add(node); if (stayKey(node)) changedStayKeys.add(stayKey(node)); }
          node.querySelectorAll?.('.directory-card').forEach(item => { affected.add(item); if (stayKey(item)) changedStayKeys.add(stayKey(item)); });
        });
        row.removedNodes?.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches?.('.directory-card') && stayKey(node)) changedStayKeys.add(stayKey(node));
          node.querySelectorAll?.('.directory-card').forEach(item => { if (stayKey(item)) changedStayKeys.add(stayKey(item)); });
        });
      });
      if (changedStayKeys.size) document.querySelectorAll('.directory-card').forEach(card => {
        if (changedStayKeys.has(stayKey(card))) affected.add(card);
      });
      affected.forEach(render);
    });
    observer.observe(grid, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-busy', 'class', 'data-intake-method', 'data-intake-received-at', 'data-intake-received-for', 'data-directory-stay-key', 'data-stay-key', 'data-directory-dog-id', 'data-directory-stay-id', 'data-directory-dog-name', 'data-directory-start-date', 'data-directory-end-date'] });
    observers.set(grid, observer);
  }
  function validLink(value) {
    try {
      const url = new URL(String(value || ''));
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch (_) { return ''; }
  }
  document.addEventListener('click', event => {
    const owner = event.target?.closest?.('[data-p4-dir="owner"], [data-firstlevel-owner-care-link], #firstlevelOwnerCareLink, .firstlevelOwnerCareLink');
    if (!owner) return;
    if (ownerOptionsDispatch.has(owner)) {
      ownerOptionsDispatch.delete(owner);
      return;
    }
    const card = owner.closest('.directory-card');
    const prepared = linked.get(card);
    const currentIdentity = identity(card);
    const d = prepared && { dogName: card?.dataset.directoryDogName || card?.dataset.dogName, dogId: prepared.dogId, stayId: prepared.stayId, stayKey: prepared.stayKey, startDate: card?.dataset.directoryStartDate || card?.dataset.startDate, endDate: card?.dataset.directoryEndDate || card?.dataset.endDate };
    if (!card?.classList.contains('is-profile-active') || !prepared || !prepared.canDirectCopy || !prepared.link || prepared.identity !== currentIdentity || !strictSelected(card, d) || stateFor(card).action !== 'Copy care link') return;
    const api = window.WAFFLE_OWNER_HANDOFF;
    if (typeof api?.copyLink !== 'function') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    let status = card.querySelector('[data-compact-intake-status]');
    if (!status) {
      status = document.createElement('span');
      status.dataset.compactIntakeStatus = '';
      status.className = 'directory-compact-intake-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      owner.parentElement?.appendChild(status);
    }
    const host = owner.parentElement || card;
    void api.copyLink(prepared.link, {
      button: owner,
      status,
      host,
      isCurrent: () => card.isConnected && owner.isConnected && card.classList.contains('is-profile-active')
        && linked.get(card) === prepared && identity(card) === currentIdentity
        && prepared.identity === identity(card) && prepared.link === validLink(prepared.link)
        && prepared.canDirectCopy && strictSelected(card, d) && stateFor(card).action === 'Copy care link'
    });
  }, true);
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
