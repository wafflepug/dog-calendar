/* Compact, on-demand read-only review for quarantined stay operations. */
(function () {
  'use strict';
  if (window.WAFFLE_CARE_OPERATION_REVIEW) return;

  const escapeHtml = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const validUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
  const reasonText = code => ({
    invalid_stay_id: 'An operation record has a malformed Stay ID.',
    duplicate_stay_id: 'More than one record uses this Stay ID.',
    duplicate_booking_stay_id: 'More than one booking uses this Stay ID.',
    missing_booking: 'An operation record no longer matches a confirmed booking.',
    ambiguous_legacy_stay: 'An older operation record matches more than one stay.',
    conflicting_operation_rows: 'More than one operation record matches this stay.',
    multiple_conflicts: 'Several different record conflicts affect this stay.'
  })[String(code || '')] || 'The stay records could not be matched unambiguously.';

  function ensureModal() {
    let modal = document.getElementById('careOperationReviewModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'careOperationReviewModal';
    modal.className = 'v108-modal care-operation-review-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'careOperationReviewTitle');
    modal.innerHTML = `<section class="v108-modal-card care-operation-review-card">
      <header class="care-operation-review-head"><div><small>STAY RECORDS</small><h2 id="careOperationReviewTitle">Review stay records</h2><p data-care-review-subtitle></p></div>
      <button type="button" class="care-operation-review-close" data-care-review-close aria-label="Close review">×</button></header>
      <div class="care-operation-review-body" data-care-review-body tabindex="-1"></div>
      <footer class="care-operation-review-footer"><button type="button" data-care-review-close>Close</button></footer>
    </section>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-care-review-close]')) closeModal(modal);
      if (event.target.closest('[data-care-review-retry]')) loadReview(modal, true);
    });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeModal(modal); return; }
      if (event.key !== 'Tab') return;
      const items = [...modal.querySelectorAll('button:not([disabled])')].filter(item => item.getClientRects().length);
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    });
    return modal;
  }

  function closeModal(modal) {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal._careReviewGeneration = (modal._careReviewGeneration || 0) + 1;
    const lock = modal._careReviewLock;
    if (lock) {
      document.documentElement.style.setProperty('overflow', lock.html.value, lock.html.priority);
      document.body.style.setProperty('overflow', lock.body.value, lock.body.priority);
      window.scrollTo(lock.x, lock.y);
      modal._careReviewLock = null;
    }
    const trigger = modal._careReviewTrigger;
    modal._careReviewTrigger = null;
    if (trigger?.isConnected) { trigger.focus({ preventScroll: true }); if (lock) window.scrollTo(lock.x, lock.y); }
  }

  function showStatus(modal, title, message, kind = 'info', retry = false) {
    const body = modal.querySelector('[data-care-review-body]');
    body.innerHTML = `<section class="care-review-message is-${kind}" role="${kind === 'error' ? 'alert' : 'status'}"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>${retry ? '<button type="button" data-care-review-retry>Retry this stay</button>' : ''}</section>`;
  }

  function formatDates(start, end) {
    const from = String(start || '').trim(), to = String(end || '').trim();
    if (from && to) return from === to ? from : `${from} – ${to}`;
    return from || to || 'Dates not recorded';
  }

  function renderReview(modal, review, stale) {
    if (!review || review.hasConflict !== true) {
      showStatus(modal, stale ? 'Saved review found no matching conflict' : 'No matching conflict found', stale ? 'This saved result may be out of date. The stay remains paused until its records are checked.' : 'The live review found no matching conflict. The stay remains paused until its records are checked.', 'info');
      return;
    }
    const operations = Array.isArray(review.operations) ? review.operations : [];
    const candidates = Array.isArray(review.candidateBookings) ? review.candidateBookings : [];
    const operationItems = operations.map(item => {
      const status = ({ checked_out: 'Checked out', checked_in: 'Checked in', expected: 'Expected' })[item.status] || String(item.status || 'Status not recorded').replace(/_/g, ' ');
      const rawId = String(item.identityStayId || '').trim();
      const identity = rawId ? `${validUuid(rawId) ? 'Stay ID' : 'Unverified Stay ID'} <code>${escapeHtml(rawId)}</code>` : 'Stay ID not recorded';
      const reason = item.identityConflictReason ? reasonText(item.identityConflictReason) : '';
      return `<li><strong>${escapeHtml(status)}</strong><span>${escapeHtml(formatDates(item.startDate, item.endDate))}</span><span>${identity}</span>${reason ? `<span>${escapeHtml(reason)}</span>` : ''}${item.checkoutType ? `<span>${escapeHtml(item.checkoutType)}</span>` : ''}${item.originalEndDate ? `<span>Original end: ${escapeHtml(item.originalEndDate)}</span>` : ''}${item.actualCheckoutDate ? `<span>Actual checkout: ${escapeHtml(item.actualCheckoutDate)}</span>` : ''}</li>`;
    }).join('');
    const candidateItems = candidates.map(item => {
      const dogId = validUuid(item.dogId) ? `<span>Dog ID <code>${escapeHtml(item.dogId)}</code></span>` : '';
      const stayId = String(item.stayId || '').trim();
      const stayIdText = stayId ? `${validUuid(stayId) ? 'Stay ID' : 'Unverified Stay ID'} <code>${escapeHtml(stayId)}</code>` : 'Stay ID not recorded';
      const eligibility = typeof item.eligibleOperationOwner === 'boolean' ? `<span>Eligible operation owner: ${item.eligibleOperationOwner ? 'Yes' : 'No'}</span>` : '';
      const sourceOperationId = String(item.sourceOperationStayId || '').trim();
      const source = sourceOperationId ? `<span>Matched from ${validUuid(sourceOperationId) ? 'operation Stay ID' : 'unverified operation Stay ID'} <code>${escapeHtml(sourceOperationId)}</code></span>` : item.sourceOperationStayKey ? '<span>Matched from an operation with this legacy stay key</span>' : '';
      const bookingType = item.bookingType ? `<span>${escapeHtml(item.bookingType)}</span>` : '';
      return `<li><strong>${escapeHtml(item.dogName || 'Dog name not recorded')}</strong>${dogId}<span>${escapeHtml(item.ownerName || 'Owner not recorded')}</span><span>${escapeHtml(formatDates(item.startDate, item.endDate))}</span>${bookingType}<span>${stayIdText}</span>${source}${eligibility}</li>`;
    }).join('');
    const opContent = operationItems ? `<section class="care-review-section"><h3>Operation records</h3><ul>${operationItems}</ul></section>` : '';
    const candidateContent = candidateItems ? `<section class="care-review-section"><h3>Candidate bookings</h3><ul>${candidateItems}</ul></section>` : '<p class="care-review-empty">No matching booking details were returned.</p>';
    const truncation = review.truncated?.operations || review.truncated?.candidateBookings
      ? '<p class="care-review-truncated">Some matching records were omitted from this bounded review.</p>' : '';
    const body = modal.querySelector('[data-care-review-body]');
    body.innerHTML = `<section class="care-review-message is-warning" role="status"><strong>${escapeHtml(reasonText(review.reasonCode))}</strong><p>${stale ? 'Showing saved review data; it may be out of date.' : 'Live read completed. Opening this review did not change the stay records.'}</p></section>${opContent}${candidateContent}${truncation}`;
  }

  async function loadReview(modal, retry = false) {
    if (!modal || modal.hidden) return;
    const selection = modal._careReviewSelection;
    if (!selection) return;
    const generation = (modal._careReviewGeneration || 0) + 1;
    modal._careReviewGeneration = generation;
    if (navigator.onLine === false) { showStatus(modal, 'You’re offline', 'Connect to the internet to review this stay’s records.', 'offline', true); return; }
    showStatus(modal, retry ? 'Refreshing this review…' : 'Loading stay records…', 'Reading the current records for this stay. This does not change them.');
    try {
      if (typeof window.queryAppsScript !== 'function') throw new Error('The read service is unavailable.');
      const payload = { action: 'get_stay_operation_review', stayKey: selection.stayKey };
      if (validUuid(selection.stayId)) payload.stayId = selection.stayId;
      const response = await window.queryAppsScript(payload, { maxAttempts: 1, timeoutMs: 20000 });
      if (modal.hidden || generation !== modal._careReviewGeneration) return;
      if (response?.result !== 'success' || !response.review) throw new Error('The stay review could not be verified.');
      const target = response.review.target;
      if (!target || String(target.stayKey || '') !== selection.stayKey || (payload.stayId && String(target.stayId || '').toLowerCase() !== payload.stayId.toLowerCase())) {
        showStatus(modal, 'Stay selection changed', 'The response did not identify the selected stay. Close this panel and reopen the review from the current stay card.', 'error');
        return;
      }
      renderReview(modal, response.review, !!(response.offlineFallback || response.cached));
    } catch (error) {
      if (modal.hidden || generation !== modal._careReviewGeneration) return;
      const offline = navigator.onLine === false;
      showStatus(modal, offline ? 'You’re offline' : 'Stay records could not be loaded', offline ? 'Connect to the internet to review this stay’s records.' : 'The current review could not be verified. No record was changed.', offline ? 'offline' : 'error', true);
    }
  }

  function openReview(trigger) {
    const card = trigger.closest('.directory-card');
    const evidence = typeof window.v110ReviewEvidenceForStay === 'function' ? window.v110ReviewEvidenceForStay(card) : null;
    if (!card || !evidence) return;
    const modal = ensureModal();
    modal._careReviewTrigger = trigger;
    modal._careReviewSelection = { stayId: String(evidence.stayId || ''), stayKey: String(evidence.stayKey || '') };
    modal._careReviewLock = {
      html: { value: document.documentElement.style.getPropertyValue('overflow'), priority: document.documentElement.style.getPropertyPriority('overflow') },
      body: { value: document.body.style.getPropertyValue('overflow'), priority: document.body.style.getPropertyPriority('overflow') },
      x: window.scrollX, y: window.scrollY
    };
    document.documentElement.style.setProperty('overflow', 'hidden');
    document.body.style.setProperty('overflow', 'hidden');
    modal.hidden = false;
    modal.querySelector('[data-care-review-subtitle]').textContent = reasonText(evidence.reasonCode);
    modal.querySelector('[data-care-review-close]').focus();
    loadReview(modal);
  }

  function updateCard(card) {
    if (!card || card.dataset.v1082PastStay === 'true') return;
    const bar = card.querySelector('[data-v110-operation-bar]');
    if (!bar) return;
    const evidence = typeof window.v110ReviewEvidenceForStay === 'function' ? window.v110ReviewEvidenceForStay(card) : null;
    const actions = bar.querySelector('.v110-operation-actions');
    if (!actions) return;
    const old = actions.querySelector('[data-care-operation-review]');
    if (!evidence) { old?.remove(); return; }
    if (old) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'care-operation-review-trigger'; button.dataset.careOperationReview = '';
    button.textContent = 'Review records'; button.setAttribute('aria-haspopup', 'dialog');
    actions.appendChild(button);
  }

  if (typeof window.v110EnsureCareOperationBar === 'function') {
    const ensureBase = window.v110EnsureCareOperationBar;
    window.v110EnsureCareOperationBar = function (card) { ensureBase(card); updateCard(card); };
  }
  document.querySelectorAll('.directory-card[data-directory-stay-key]').forEach(updateCard);
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-care-operation-review]');
    if (trigger) { event.preventDefault(); openReview(trigger); }
  }, true);
  window.WAFFLE_CARE_OPERATION_REVIEW = Object.freeze({ updateCard, openReview });
})();
