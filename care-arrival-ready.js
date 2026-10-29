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
  let focusNextIdentity = '';
  let pass = null;

  function beginPass() { pass = { cards: new WeakMap(), today: null }; }

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

  function snapshot(card) {
    if (!pass) beginPass();
    let value = pass.cards.get(card);
    if (value) return value;
    const d = identity(card);
    let status;
    try { status = window.WAFFLE_INTAKE_STATUS && typeof window.WAFFLE_INTAKE_STATUS.getState === 'function' ? (window.WAFFLE_INTAKE_STATUS.getState(card) || { code: 'unknown' }) : intake(card); }
    catch (_) { status = { code: 'unknown' }; }
    const op = typeof window.v110OperationForStay === 'function'
      ? window.v110OperationForStay({ stayId: d.stayId, dogId: d.dogId, stayKey: d.stayKey, dogName: d.name, startDate: d.start, endDate: d.end })
      : null;
    const display = typeof window.v110OperationDisplayState === 'function' ? window.v110OperationDisplayState(card) : null;
    value = { d, status, op, display, found: null };
    pass.cards.set(card, value);
    return value;
  }

  function evidence(card, supplied) {
    const snap = supplied || snapshot(card);
    const { d, op, display, status } = snap;
    if (card.dataset.v1082PastStay === 'true' || card.closest('#past-directory-grid') || op?.status === 'checked_out' || op?.status === 'checked_in') return null;
    if (!d.stayId || !d.dogId || !d.stayKey || !d.name || !/^\d{4}-\d{2}-\d{2}$/.test(d.start) || !/^\d{4}-\d{2}-\d{2}$/.test(d.end)) return null;
    const currentDay = pass.today || (pass.today = today());
    if (d.start !== currentDay || d.end < currentDay) return null;
    const displayCode = String(display?.code || '').toLowerCase();
    if (['collision', 'checked_out', 'checked_in'].includes(displayCode) || /identity|mismatch|ambiguous/.test(displayCode)) return null;
    if (op?.identityConflict || op?.collision || op?.mismatchedIdentity || op?.status === 'identity_conflict') return null;
    if (status?.identityConflict || status?.collision || status?.mismatchedIdentity) return null;
    return snap.found = { d, op };
  }

  function signature(card, state) {
    return JSON.stringify({ state: state || {}, displayIdentity: identity(card) });
  }

  function arrivalTasks(card) {
    const tasks = [];
    const profile = card.querySelector('[data-directory-detail="profile"]');
    const profileFresh = profile?.dataset.profileReadState === 'fresh';

    const medication = card.querySelector('[data-care-brief-medication]');
    const medicationText = String(medication?.textContent || '').replace(/\s+/g, ' ').trim();
    const medicationKnown = profileFresh && !!medicationText && !!medication && !medication.matches('[aria-busy="true"]') &&
      !/^(loading|checking|not loaded|pending|unavailable|not available|needs identity review)/i.test(medicationText);
    const medicationSaved = medicationKnown && !/no medication instructions saved/i.test(medicationText);
    const medicationSummary = medicationKnown ? (medicationSaved ? 'Medication saved' : 'No medication saved') : 'Medication unknown';
    tasks.push({
      key: 'medication',
      title: 'Medication',
      detail: medicationSaved ? 'Read saved instructions before check-in.' : medicationKnown
        ? 'No saved medication instructions are recorded.'
        : 'Medication instructions are unknown and not verified.',
      action: 'medication',
      actionLabel: 'Review'
    });

    const belongings = card.querySelector('[data-belongings-summary]');
    const itemCount = belongings?.querySelectorAll('.belongings-summary-list > li').length || 0;
    const belongingsKnown = profileFresh && !!belongings && (itemCount > 0 || !!belongings.querySelector('.belongings-summary-empty')) && !/loading|not loaded|pending|unavailable|not available|identity review/i.test(belongings.textContent || '');
    const hasKnownItems = belongingsKnown && itemCount > 0;
    const belongingsSummary = belongingsKnown ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : 'unknown';
    tasks.push({
      key: 'belongings',
      title: 'Belongings',
      detail: hasKnownItems ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} listed; review what is arriving.` : belongingsKnown
        ? '0 items recorded; check what is arriving with this guest.'
        : 'Item count is unknown and not verified.',
      action: 'belongings',
      actionLabel: 'Review'
    });
    tasks.summary = `Care checks · ${medicationSummary} · Belongings: ${belongingsSummary}`;
    return tasks;
  }

  function updateArrivalTasks(card, status) {
    const tasks = arrivalTasks(card);
    let list = card.querySelector('[data-arrival-task-list]');
    if (!tasks.length) { list?.remove(); return; }
    if (!list) {
      list = document.createElement('details');
      list.dataset.arrivalTaskList = '';
      list.className = 'directory-arrival-checklist';
      list.setAttribute('aria-label', 'Arrival checklist');
      const summary = document.createElement('summary');
      summary.dataset.arrivalTaskHeading = '';
      list.appendChild(summary);
      const items = document.createElement('div');
      items.dataset.arrivalTaskItems = '';
      list.appendChild(items);
    }
    const signature = JSON.stringify({ tasks, identity: identity(card) });
    if (list.dataset.tasksSignature !== signature) {
      list.dataset.tasksSignature = signature;
      const summary = list.querySelector('[data-arrival-task-heading]');
      const items = list.querySelector('[data-arrival-task-items]');
      summary.textContent = tasks.summary;
      const previous = new Map(Array.from(items.querySelectorAll('[data-arrival-task]')).map(button => [button.dataset.arrivalTask, button]));
      const oldIdentity = list.dataset.identitySignature || '';
      const identitySignature = JSON.stringify(identity(card));
      if (oldIdentity && oldIdentity !== identitySignature) {
        if (items.contains(document.activeElement)) document.activeElement.blur();
        items.replaceChildren(); previous.clear();
      }
      list.dataset.identitySignature = identitySignature;
      tasks.forEach(task => {
        const button = previous.get(task.key) || document.createElement('button');
        previous.delete(task.key);
        button.type = 'button';
        button.dataset.arrivalTask = task.key;
        button.dataset.careReadinessAction = task.action;
        const d = identity(card);
        const capturedIdentity = JSON.stringify(d);
        if (!button.dataset.identityGuard) {
          button.dataset.identityGuard = 'true';
          button.addEventListener('click', event => {
            if (button.dataset.identityAtRender !== JSON.stringify(identity(card))) { event.preventDefault(); event.stopImmediatePropagation(); }
          }, true);
        }
        button.dataset.identityAtRender = capturedIdentity;
        const number = /^#?\d{1,5}$/.test(d.dogNumber.trim()) ? Number(d.dogNumber.trim().replace(/^#/, '')) : 0;
        const humanNumber = number > 0 ? `Dog Number #${String(number).padStart(5, '0')}` : '';
        const dogContext = [d.name, humanNumber, d.owner ? `owner ${d.owner}` : '', d.start && d.end ? `stay ${d.start} to ${d.end}` : ''].filter(Boolean).join(', ');
        button.setAttribute('aria-label', `${task.title} for ${dogContext || 'this dog'}. ${task.detail} ${task.actionLabel} in Care.`);
        const title = button.querySelector('strong') || document.createElement('strong');
        title.textContent = task.title;
        const detail = button.querySelector('small') || document.createElement('small');
        detail.textContent = task.detail;
        const action = button.querySelector('span') || document.createElement('span');
        action.textContent = task.actionLabel;
        if (title.parentElement !== button) button.appendChild(title);
        if (detail.parentElement !== button) button.appendChild(detail);
        if (action.parentElement !== button) button.appendChild(action);
        if (!items.contains(button)) items.appendChild(button);
      });
      previous.forEach(button => button.remove());
      const desired = tasks.map(task => items.querySelector(`[data-arrival-task="${task.key}"]`));
      if (desired.some((button, index) => items.children[index] !== button)) items.append(...desired);
    }
    const anchor = card.querySelector('[data-v11217-roster-actions]') ||
      card.querySelector(OWN) || card.querySelector('.directory-guest-tile-open');
    if (anchor) {
      if (anchor.nextElementSibling !== list) anchor.insertAdjacentElement('afterend', list);
    } else if (list.parentElement !== card) card.append(list);
  }

  function updateIndicator(card, root, state) {
    const code = String(state?.code || 'unknown');
    const fallbackLabels = {
      complete: 'Form received',
      link_ready: 'Link ready',
      not_prepared: 'Not prepared',
      unknown: 'Status unknown'
    };
    const label = String(state?.label || fallbackLabels[code] || 'Status unknown');
    const fallbackDetails = {
      link_ready: 'Refresh Care after owner submits.',
      not_prepared: 'No digital intake link is recorded.',
      unknown: 'Current form completion is not verified.'
    };
    const detail = String(state?.detail || fallbackDetails[code] || '');
    if (!root) {
      root = document.createElement('button');
      root.type = 'button';
      root.dataset.waffleArrivalReady = '';
      root.innerHTML = `<span data-arrival-copy><strong data-arrival-label></strong><small data-arrival-detail></small></span><span data-arrival-action aria-hidden="true">Review care</span>`;
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
    root.dataset.state = code;
    root.dataset.stateSignature = signature(card, state);
    const dogIdentity = [d.name, d.dogNumber ? `Dog Number ${d.dogNumber}` : '', d.owner ? `owner ${d.owner}` : '', d.start && d.end ? `${d.start} to ${d.end}` : ''].filter(Boolean).join(', ');
    root.setAttribute('aria-label', `Review care for ${dogIdentity || 'this dog'}: ${label}${detailText ? `. ${detailText}` : ''}.`);
    if (detailText) root.title = detailText;
    else root.removeAttribute('title');
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
        beginPass();
        const target = nextTarget(grid);
        if (!target) return;
        if (!eligibleTarget(target.card) || JSON.stringify(identity(target.card)) !== target.signature) return;
        target.control.scrollIntoView({ block: 'center', inline: 'nearest' });
        target.control.focus({ preventScroll: true });
        focusAnchorCard = target.card;
        const candidates = eligibleTargets(grid);
        const index = candidates.findIndex(item => item.card === target.card);
        const following = candidates.length ? candidates[(index + 1) % candidates.length] : null;
        focusNextStayId = following?.stayId || '';
        focusNextIdentity = following?.signature || '';
        refresh();
      });
      host.parentNode?.insertBefore(button, host);
    }
    const currentView = document.querySelector('[data-v1082-stay-tab].is-active')?.dataset.v1082StayTab || 'current';
    const profileMode = !!grid.closest('.directory-dashboard-fused')?.classList.contains('is-profile-mode') || !!grid.querySelector('.directory-card.is-profile-active');
    const hiddenPanel = grid.closest('[hidden]') || document.querySelector('#v1082CurrentStayPanel[hidden]');
    const candidates = currentView === 'current' && !profileMode && !hiddenPanel ? eligibleTargets(grid) : [];
    const target = chooseTarget(candidates);
    const shownCount = candidates.length;
    const nextText = target ? `${targetLabel(target.card)} · ${shownCount} remaining` : '';
    if (button.textContent !== nextText) button.textContent = nextText;
    const accessibleLabel = target ? `${targetLabel(target.card)}. ${targetContext(target.card)}. ${shownCount} eligible arrivals remaining.` : '';
    if (accessibleLabel && button.getAttribute('aria-label') !== accessibleLabel) button.setAttribute('aria-label', accessibleLabel);
    else if (!accessibleLabel && button.hasAttribute('aria-label')) button.removeAttribute('aria-label');
    const shouldHide = shownCount < 2;
    const shortcutHadFocus = document.activeElement === button;
    if (button.hidden !== shouldHide) button.hidden = shouldHide;
    if (shouldHide && shownCount === 1 && shortcutHadFocus) {
      const remaining = candidates[0];
      remaining.control.scrollIntoView({ block: 'center', inline: 'nearest' });
      remaining.control.focus({ preventScroll: true });
    }
  }

  function eligibleTargets(grid) {
    if (!grid || grid.closest('[hidden]') || grid.closest('.directory-dashboard-fused')?.classList.contains('is-profile-mode')) return [];
    const seen = new Set();
    return Array.from(grid.querySelectorAll('.directory-card')).flatMap(card => {
      const snap = snapshot(card);
      const found = evidence(card, snap);
      if (!found || seen.has(found.d.stayId)) return [];
      seen.add(found.d.stayId);
      const control = card.querySelector('[data-v11217-roster-checkin]');
      return eligibleControl(card, control) ? [{ card, control, stayId: found.d.stayId, signature: JSON.stringify(found.d) }] : [];
    });
  }

  function eligibleControl(card, control) {
    if (!control || control.disabled || control.matches('[aria-disabled="true"], [aria-hidden="true"], [inert], :disabled') || control.closest('[hidden], [inert], [aria-hidden="true"], details:not([open])')) return false;
    for (let node = control; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    return !!card.isConnected && control.getClientRects().length > 0;
  }

  function eligibleTarget(card) {
    if (!card?.isConnected || !evidence(card, snapshot(card))) return false;
    return eligibleControl(card, card.querySelector('[data-v11217-roster-checkin]'));
  }

  function chooseTarget(candidates) {
    if (!candidates.length) return null;
    let target = focusNextStayId ? candidates.find(item => item.stayId === focusNextStayId && item.signature === focusNextIdentity) : null;
    if (!target && focusAnchorCard?.isConnected) {
      const ordered = Array.from(focusAnchorCard.closest('#directory-grid')?.querySelectorAll(CARD) || []);
      const anchorIndex = ordered.indexOf(focusAnchorCard);
      target = candidates.find(item => ordered.indexOf(item.card) > anchorIndex);
    }
    return target || candidates[0];
  }

  function nextTarget(grid) { return chooseTarget(eligibleTargets(grid)); }

  function targetLabel(card) {
    const d = identity(card);
    const raw = d.dogNumber.trim();
    const parsed = /^#?\d{1,5}$/.test(raw) ? Number(raw.replace(/^#/, '')) : 0;
    const humanNumber = Number.isSafeInteger(parsed) && parsed > 0 ? ` #${String(parsed).padStart(5, '0')}` : '';
    return `Next: ${d.name}${humanNumber}`;
  }

  function targetContext(card) {
    const d = identity(card);
    const raw = d.dogNumber.trim();
    const parsed = /^#?\d{1,5}$/.test(raw) ? Number(raw.replace(/^#/, '')) : 0;
    const dogId = Number.isSafeInteger(parsed) && parsed > 0 ? `Dog Number ${String(parsed).padStart(5, '0')}` : '';
    return [dogId, d.owner ? `owner ${d.owner}` : '', d.start && d.end ? `Stay ${d.start} to ${d.end}` : ''].filter(Boolean).join(', ');
  }

  function refresh() {
    beginPass();
    const grid = document.getElementById('directory-grid');
    if (!grid) return { count: 0 };
    const activeView = document.querySelector('[data-v1082-stay-tab].is-active')?.dataset.v1082StayTab || 'current';
    const cards = Array.from(grid.querySelectorAll(CARD));
    const seen = new Set();
    let count = 0;
    cards.forEach(card => {
      const snap = snapshot(card), id = snap.d, status = snap.status;
      const valid = evidence(card, snap);
      const dup = id.stayId && seen.has(id.stayId);
      if (id.stayId) seen.add(id.stayId);
      let node = card.querySelector(OWN);
      const visible = activeView === 'current' && card.style.display !== 'none' && getComputedStyle(card).display !== 'none' && !card.closest('[hidden]');
      const hasException = !['complete'].includes(String(status?.code || 'unknown'));
      if (!valid || dup || !visible || !hasException) { if (node) node.remove(); return; }
      const sig = signature(card, status);
      if (!node) node = updateIndicator(card, null, status);
      else if (node.dataset.stateSignature !== sig) updateIndicator(card, node, status);
      if (!node.isConnected) (card.querySelector('.directory-guest-tile-open') || card).insertAdjacentElement('afterend', node);
      count++;
    });
    const taskSeen = new Set();
    cards.forEach(card => {
      const snap = snapshot(card), id = snap.d, status = snap.status;
      const valid = evidence(card, snap);
      const duplicate = id.stayId && taskSeen.has(id.stayId);
      if (id.stayId) taskSeen.add(id.stayId);
      const visible = activeView === 'current' && card.style.display !== 'none' && getComputedStyle(card).display !== 'none' && !card.closest('[hidden]');
      if (valid && !duplicate && visible) updateArrivalTasks(card, status);
      else card.querySelector('[data-arrival-task-list]')?.remove();
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
    function meaningfulAttributeTarget(target, card, scope) {
      if (target === scope || target?.contains?.(grid)) return true;
      const checkin = card?.querySelector('[data-v11217-roster-checkin]');
      return !!card && (target === card || !!target?.closest?.('[data-v11217-roster-checkin]') || !!target?.closest?.('[data-directory-intake]') || !!target?.closest?.('[data-belongings-summary]') || !!checkin && !!target?.contains?.(checkin));
    }
    function relevantAddedNode(node) {
      return node?.nodeType === 1 && (node.matches?.(`${CARD},${OWN},[data-waffle-arrival-next],[data-directory-detail="profile"],[data-care-brief-medication],[data-belongings-summary],[data-v11217-roster-checkin],[data-directory-intake],[data-v1082-stay-tab]`) || node.querySelector?.(`${CARD},[data-directory-detail="profile"],[data-care-brief-medication],[data-belongings-summary],[data-v11217-roster-checkin],[data-directory-intake]`));
    }
    observer = new MutationObserver(records => {
      const meaningful = records.some(record => {
        if (record.type === 'childList') {
          const changed = [...record.addedNodes, ...record.removedNodes];
          const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
          const card = target?.closest?.(CARD);
          return changed.some(node => relevantAddedNode(node) && !(node.nodeType === 1 && (node.matches?.(OWN) || node.matches?.('[data-waffle-arrival-next]')))) || !!target?.closest?.('[data-directory-intake]') || !!card && (card.contains(target) && (!!target.closest?.('[data-belongings-summary]') || !!target.closest?.('[data-care-brief-medication]')));
        }
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        const card = target?.closest?.(CARD);
        if (record.type === 'characterData') return !!target?.closest?.('[data-care-brief-medication],[data-belongings-summary],[data-directory-intake]');
        const name = record.attributeName;
        if (['data-directory-stay-id','data-directory-dog-name','data-dog-name','data-directory-dog-id','data-directory-dog-number','data-directory-stay-key','data-directory-start-date','data-directory-end-date','data-directory-owner-name','data-v1088-owner-name','data-v1082-past-stay'].includes(name)) return !!card;
        if (name === 'data-profile-read-state' || name === 'aria-busy') return !!target?.closest?.('[data-directory-detail="profile"],[data-care-brief-medication],[data-belongings-summary]');
        if (['disabled','aria-disabled','aria-hidden','inert','hidden','open','style','class'].includes(name)) return meaningfulAttributeTarget(target, card, scope);
        return false;
      });
      if (meaningful) scheduleRefresh();
    });
    const scope = grid.closest('.directory-dashboard-fused') || document.querySelector('.v1082-stay-panels') || grid.parentElement;
    observer.observe(scope, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-directory-stay-id', 'data-directory-dog-name', 'data-dog-name', 'data-directory-dog-id', 'data-directory-dog-number', 'data-directory-stay-key', 'data-directory-start-date', 'data-directory-end-date', 'data-directory-owner-name', 'data-v1088-owner-name', 'data-v1082-past-stay', 'data-profile-read-state', 'aria-busy', 'style', 'class', 'hidden', 'open', 'disabled', 'aria-disabled', 'aria-hidden', 'inert'] });
    document.querySelectorAll('[data-v1082-stay-tab]').forEach(tab => tab.addEventListener('click', () => setTimeout(scheduleRefresh, 0)));
    document.getElementById('guestDirectorySearch')?.addEventListener('input', scheduleRefresh);
  }

  const api = { refresh, getState: () => ({ count: document.querySelectorAll(`#directory-grid ${OWN}`).length }) };
  window.WAFFLE_ARRIVAL_READY = api;
  window.addEventListener('waffle:intake-status-updated', scheduleRefresh);
  window.addEventListener('waffle:stay-operation-updated', scheduleRefresh);
  window.addEventListener('waffle:first-paint-ready', scheduleRefresh);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { observe(); refresh(); }, { once: true });
  else { observe(); refresh(); }
})();
