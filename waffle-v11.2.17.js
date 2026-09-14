/* ============================================================
   WAFFLE HOUSE V11.2.17 — OWNER-REQUESTED EARLY CHECKOUT
   ----------------------------------------------------------------
   Adds a dedicated Early Checkout flow for an active guest whose owner asks
   to collect them before the scheduled checkout date. The booked dates remain
   untouched; Care stores and displays the actual checkout separately.
   ============================================================ */
(function () {
  'use strict';

  if (window.__WAFFLE_EARLY_CHECKOUT_V11217__) return;
  window.__WAFFLE_EARLY_CHECKOUT_V11217__ = true;

  const VERSION = '11.2.17';
  const REASON_CODE = 'owner_request';
  const REASON = 'Owner requested early checkout';
  const baseOperationDisplayState = window.v110OperationDisplayState;
  const baseEnsureCareOperationBar = window.v110EnsureCareOperationBar;
  const baseEnhanceCareCard = window.v110EnhanceCareCard;
  let activeCard = null;
  let previousFocus = null;
  let enhanceQueued = false;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function todayKey() {
    if (typeof window.getLocalTodayDateString === 'function') {
      return String(window.getLocalTodayDateString() || '').slice(0, 10);
    }
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function payloadForCard(card) {
    if (typeof window.v110OperationalPayloadFromCard === 'function') {
      return window.v110OperationalPayloadFromCard(card);
    }
    return {
      stayKey: String(card?.dataset?.directoryStayKey || card?.dataset?.stayKey || ''),
      dogName: String(card?.dataset?.directoryDogName || card?.dataset?.dogName || ''),
      startDate: String(card?.dataset?.directoryStartDate || card?.dataset?.startDate || ''),
      endDate: String(card?.dataset?.directoryEndDate || card?.dataset?.endDate || ''),
      ownerName: '',
      breed: '',
      phone: ''
    };
  }

  function operationForCard(card) {
    const payload = payloadForCard(card);
    if (!payload.stayKey || typeof window.v110OperationForStay !== 'function') return null;
    return window.v110OperationForStay(payload.stayKey) || null;
  }

  function isEarlyOperation(operation) {
    return !!operation && (
      String(operation.checkoutType || '').toLowerCase() === 'early' ||
      String(operation.checkoutReasonCode || '').toLowerCase() === REASON_CODE ||
      operation.isEarlyCheckout === true
    );
  }

  function formatDate(value) {
    const key = String(value || '').slice(0, 10);
    if (!key) return 'Not recorded';
    if (typeof window.formatStayDateShort === 'function') {
      try { return window.formatStayDateShort(key); } catch (_) {}
    }
    const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return key;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
  }

  function formatDateTime(value, fallbackDate) {
    const text = String(value || '').trim();
    const date = text ? new Date(text) : null;
    if (date && !Number.isNaN(date.getTime())) {
      return date.toLocaleString('en-AU', {
        day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit'
      });
    }
    return formatDate(fallbackDate);
  }

  function ensureStyles() {
    if (document.getElementById('v11217EarlyCheckoutStyles')) return;
    const style = document.createElement('style');
    style.id = 'v11217EarlyCheckoutStyles';
    style.textContent = `
      .v11217-early-checkout-button{min-height:38px;padding:8px 12px;border:1px solid #f59e0b;border-radius:9px;background:#fffbeb;color:#92400e;font:inherit;font-size:10px;font-weight:900;cursor:pointer}
      .v11217-early-checkout-button:hover{background:#fef3c7}.v11217-early-checkout-button:focus-visible{outline:3px solid rgba(245,158,11,.32);outline-offset:2px}
      body.dark-theme .v11217-early-checkout-button{border-color:#d97706;background:#451a03;color:#fde68a}
      .v11217-profile-summary{margin:0 0 12px;padding:12px;border:1px solid #f59e0b;border-radius:12px;background:color-mix(in srgb,#f59e0b 8%,var(--v10-card,#fff));color:var(--v10-text,#172033)}
      .v11217-profile-summary-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.v11217-profile-summary-head small{display:block;color:#b45309;font-size:8px;font-weight:950;letter-spacing:.07em}.v11217-profile-summary-head h4{margin:3px 0 0;font-size:14px}.v11217-profile-badge{flex:0 0 auto;padding:5px 8px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:8px;font-weight:950}
      .v11217-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.v11217-profile-grid>div{padding:9px;border:1px solid color-mix(in srgb,#f59e0b 30%,var(--v10-border,#e2e8f0));border-radius:9px;background:var(--v10-card-soft,#f8fafc)}.v11217-profile-grid small{display:block;color:var(--v10-muted,#64748b);font-size:7.5px;font-weight:900;letter-spacing:.04em}.v11217-profile-grid strong{display:block;margin-top:3px;font-size:10px;line-height:1.35}.v11217-profile-note{margin:8px 0 0;padding:9px;border-radius:9px;background:var(--v10-card-soft,#f8fafc);font-size:9px;line-height:1.45}.v11217-profile-note strong{font-weight:900}
      .v11217-modal{position:fixed;inset:0;z-index:4200;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.66);backdrop-filter:blur(4px)}.v11217-modal[hidden]{display:none!important}.v11217-modal-card{width:min(100%,520px);max-height:min(88vh,720px);overflow:auto;border:1px solid var(--v10-border,#dbe3ed);border-radius:18px;background:var(--v10-card,#fff);color:var(--v10-text,#172033);box-shadow:0 28px 70px rgba(15,23,42,.35)}
      .v11217-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:17px 18px 12px;border-bottom:1px solid var(--v10-border,#e2e8f0)}.v11217-modal-head small{display:block;color:#b45309;font-size:8px;font-weight:950;letter-spacing:.08em}.v11217-modal-head h3{margin:3px 0 4px;font-size:20px}.v11217-modal-head p{margin:0;color:var(--v10-muted,#64748b);font-size:10px;line-height:1.45}.v11217-modal-close{flex:0 0 36px;width:36px;height:36px;border:0;border-radius:50%;background:var(--v10-card-soft,#f1f5f9);color:inherit;font-size:22px;cursor:pointer}
      .v11217-modal-body{display:grid;gap:11px;padding:16px 18px}.v11217-modal-dog{padding:11px 12px;border:1px solid #fde68a;border-radius:11px;background:#fffbeb}.v11217-modal-dog strong{display:block;font-size:14px}.v11217-modal-dog span{display:block;margin-top:2px;color:#92400e;font-size:9px;font-weight:800}.v11217-modal-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.v11217-modal-fact{padding:10px;border:1px solid var(--v10-border,#e2e8f0);border-radius:10px;background:var(--v10-card-soft,#f8fafc)}.v11217-modal-fact small{display:block;color:var(--v10-muted,#64748b);font-size:8px;font-weight:900}.v11217-modal-fact strong{display:block;margin-top:4px;font-size:10px;line-height:1.35}.v11217-modal-preserve{padding:10px;border-radius:10px;background:#eff6ff;color:#1e40af;font-size:9px;line-height:1.45;font-weight:750}.v11217-field label{display:block;margin-bottom:5px;font-size:9px;font-weight:900}.v11217-field textarea{width:100%;min-height:82px;box-sizing:border-box;resize:vertical;border:1px solid var(--v10-border,#cbd5e1);border-radius:10px;padding:10px;background:var(--v10-card,#fff);color:inherit;font:inherit;font-size:10px;line-height:1.45}.v11217-field textarea:focus{outline:3px solid rgba(245,158,11,.2);border-color:#f59e0b}
      .v11217-modal-actions{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px 18px}.v11217-modal-actions button{min-height:41px;padding:9px 13px;border-radius:10px;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.v11217-cancel{border:1px solid var(--v10-border,#cbd5e1);background:var(--v10-card-soft,#f8fafc);color:inherit}.v11217-confirm{border:1px solid #d97706;background:#d97706;color:#fff}.v11217-confirm:disabled{opacity:.65;cursor:wait}
      body.dark-theme .v11217-profile-badge,body.dark-theme .v11217-modal-dog{background:#451a03;color:#fde68a;border-color:#92400e}body.dark-theme .v11217-modal-dog span{color:#fde68a}body.dark-theme .v11217-modal-preserve{background:#172554;color:#bfdbfe}
      @media(max-width:768px){.v11217-profile-grid,.v11217-modal-facts{grid-template-columns:1fr}.v11217-early-checkout-button{width:100%}.v11217-modal{align-items:flex-end;padding:10px}.v11217-modal-card{width:100%;max-height:91vh;border-radius:18px 18px 12px 12px}.v11217-modal-actions{display:grid;grid-template-columns:1fr 1fr}.v11217-modal-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function earlyStateForCard(card, baseState) {
    const operation = operationForCard(card);
    if (!operation || operation.status !== 'checked_out' || !isEarlyOperation(operation)) return baseState;
    return {
      code: 'checked_out',
      label: 'Early Checkout',
      icon: '⏱️',
      meta: `${REASON} · ${formatDateTime(operation.checkedOutAt, operation.actualCheckoutDate)}`
    };
  }

  if (typeof baseOperationDisplayState === 'function') {
    window.v110OperationDisplayState = function(card) {
      return earlyStateForCard(card, baseOperationDisplayState(card));
    };
  }

  function earlyCheckoutEligible(card) {
    if (!card || card.dataset?.v1082PastStay === 'true') return false;
    const p = payloadForCard(card);
    const today = todayKey();
    if (!p.startDate || !p.endDate || p.startDate > today || p.endDate <= today) return false;
    const operation = operationForCard(card);
    if (operation?.status === 'checked_out') return false;
    if (operation?.status === 'checked_in') return true;
    const state = typeof window.v110OperationDisplayState === 'function'
      ? window.v110OperationDisplayState(card)
      : null;
    return state?.code === 'date_active';
  }

  function decorateEarlyAction(card) {
    const bar = card?.querySelector?.('[data-v110-operation-bar]');
    const actions = bar?.querySelector?.('.v110-operation-actions');
    if (!actions) return;

    const eligible = earlyCheckoutEligible(card);
    const existingEarly = actions.querySelector('[data-v11217-early-checkout]');
    if (!eligible) {
      existingEarly?.remove();
      return;
    }

    /* Before the scheduled end date, the explicit early action replaces the
       generic checkout so every departure is classified correctly. */
    actions.querySelectorAll('[data-v110-checkout]').forEach(button => button.remove());
    if (existingEarly) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'v11217-early-checkout-button';
    button.dataset.v11217EarlyCheckout = '';
    button.textContent = '⏱️ Early Checkout';
    button.setAttribute('aria-label', `Record owner-requested early checkout for ${payloadForCard(card).dogName || 'guest'}`);
    actions.appendChild(button);
  }

  function profileHost(card) {
    return card?.querySelector?.('[data-directory-main-panel="profile"]') ||
      card?.querySelector?.('.directory-profile-content') || null;
  }

  function renderEarlyProfile(card) {
    const host = profileHost(card);
    if (!host) return;
    const operation = operationForCard(card);
    const existing = host.querySelector('[data-v11217-early-profile]');
    if (!operation || operation.status !== 'checked_out' || !isEarlyOperation(operation)) {
      existing?.remove();
      return;
    }

    const p = payloadForCard(card);
    const signature = JSON.stringify([
      operation.checkedOutAt,
      operation.actualCheckoutDate,
      operation.originalEndDate,
      operation.checkoutRequestedBy,
      operation.checkoutReason,
      operation.note
    ]);
    if (existing?.dataset?.v11217Signature === signature) return;

    const section = existing || document.createElement('section');
    section.className = 'v11217-profile-summary';
    section.dataset.v11217EarlyProfile = '';
    section.dataset.v11217Signature = signature;
    section.setAttribute('aria-label', 'Early checkout details');
    section.innerHTML = `
      <div class="v11217-profile-summary-head">
        <div><small>STAY OUTCOME</small><h4>⏱️ Early Checkout</h4></div>
        <span class="v11217-profile-badge">Owner requested</span>
      </div>
      <div class="v11217-profile-grid">
        <div><small>REASON</small><strong>${esc(operation.checkoutReason || REASON)}</strong></div>
        <div><small>ACTUAL CHECKOUT</small><strong>${esc(formatDateTime(operation.checkedOutAt, operation.actualCheckoutDate))}</strong></div>
        <div><small>ORIGINALLY SCHEDULED</small><strong>${esc(formatDate(operation.originalEndDate || p.endDate))}</strong></div>
        <div><small>REQUESTED BY</small><strong>${esc(operation.checkoutRequestedBy || p.ownerName || 'Owner')}</strong></div>
      </div>
      ${operation.note ? `<p class="v11217-profile-note"><strong>Checkout note:</strong> ${esc(operation.note)}</p>` : ''}
    `;
    if (!existing) host.prepend(section);
  }

  function decorateCard(card) {
    if (!card) return;
    decorateEarlyAction(card);
    renderEarlyProfile(card);
  }

  if (typeof baseEnsureCareOperationBar === 'function') {
    window.v110EnsureCareOperationBar = function(card) {
      const result = baseEnsureCareOperationBar(card);
      decorateCard(card);
      return result;
    };
  }

  if (typeof baseEnhanceCareCard === 'function') {
    window.v110EnhanceCareCard = function(card) {
      const result = baseEnhanceCareCard(card);
      decorateCard(card);
      return result;
    };
  }

  function allCards() {
    return Array.from(document.querySelectorAll('.directory-card'));
  }

  function enhanceAll() {
    enhanceQueued = false;
    allCards().forEach(card => {
      try {
        if (typeof window.v110EnsureCareOperationBar === 'function' && card.dataset?.v1082PastStay !== 'true') {
          window.v110EnsureCareOperationBar(card);
        } else {
          decorateCard(card);
        }
      } catch (error) {
        console.warn('V11.2.17 early checkout enhancement skipped:', error);
      }
    });
  }

  function scheduleEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    window.setTimeout(enhanceAll, 25);
  }

  function ensureModal() {
    let modal = document.getElementById('v11217EarlyCheckoutModal');
    if (modal) return modal;
    ensureStyles();
    modal = document.createElement('div');
    modal.id = 'v11217EarlyCheckoutModal';
    modal.className = 'v11217-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'v11217EarlyCheckoutTitle');
    modal.innerHTML = `
      <div class="v11217-modal-card">
        <div class="v11217-modal-head">
          <div><small>OWNER REQUEST</small><h3 id="v11217EarlyCheckoutTitle">⏱️ Early Checkout</h3><p>Record an actual departure before the scheduled checkout date.</p></div>
          <button type="button" class="v11217-modal-close" data-v11217-close aria-label="Close early checkout">×</button>
        </div>
        <div class="v11217-modal-body">
          <div class="v11217-modal-dog"><strong data-v11217-dog>Guest</strong><span data-v11217-stay-dates></span></div>
          <div class="v11217-modal-facts">
            <div class="v11217-modal-fact"><small>REASON</small><strong>${esc(REASON)}</strong></div>
            <div class="v11217-modal-fact"><small>ACTUAL CHECKOUT DATE</small><strong data-v11217-actual-date></strong></div>
            <div class="v11217-modal-fact"><small>ORIGINALLY SCHEDULED</small><strong data-v11217-original-date></strong></div>
            <div class="v11217-modal-fact"><small>REQUESTED BY</small><strong data-v11217-requested-by></strong></div>
          </div>
          <div class="v11217-modal-preserve">The original booking dates will be preserved. This only updates the guest's operational status and early-checkout profile.</div>
          <div class="v11217-field"><label for="v11217EarlyCheckoutNote">Optional checkout note</label><textarea id="v11217EarlyCheckoutNote" data-v11217-note maxlength="1000" placeholder="Add collection details or other context…"></textarea></div>
        </div>
        <div class="v11217-modal-actions">
          <button type="button" class="v11217-cancel" data-v11217-close>Cancel</button>
          <button type="button" class="v11217-confirm" data-v11217-confirm>Confirm Early Checkout</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function closeModal() {
    const modal = document.getElementById('v11217EarlyCheckoutModal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    activeCard = null;
    const focus = previousFocus;
    previousFocus = null;
    try { focus?.focus?.(); } catch (_) {}
  }

  function openModal(card, trigger) {
    const p = payloadForCard(card);
    if (!earlyCheckoutEligible(card)) return;
    const modal = ensureModal();
    activeCard = card;
    previousFocus = trigger || document.activeElement;
    modal.querySelector('[data-v11217-dog]').textContent = p.dogName || 'Guest';
    modal.querySelector('[data-v11217-stay-dates]').textContent = `${formatDate(p.startDate)} → ${formatDate(p.endDate)}`;
    modal.querySelector('[data-v11217-actual-date]').textContent = formatDate(todayKey());
    modal.querySelector('[data-v11217-original-date]').textContent = formatDate(p.endDate);
    modal.querySelector('[data-v11217-requested-by]').textContent = p.ownerName || 'Owner';
    modal.querySelector('[data-v11217-note]').value = '';
    modal.hidden = false;
    window.setTimeout(() => modal.querySelector('[data-v11217-note]')?.focus(), 0);
  }

  async function confirmEarlyCheckout(button) {
    const card = activeCard;
    if (!card || !earlyCheckoutEligible(card)) {
      closeModal();
      return;
    }
    const modal = ensureModal();
    const p = payloadForCard(card);
    const note = String(modal.querySelector('[data-v11217-note]')?.value || '').trim();
    const actualDate = todayKey();
    const payload = {
      ...p,
      action: 'early_checkout_stay',
      earlyCheckout: true,
      checkoutType: 'early',
      checkoutReasonCode: REASON_CODE,
      checkoutReason: REASON,
      originalEndDate: p.endDate,
      actualCheckoutDate: actualDate,
      checkoutRequestedBy: p.ownerName || 'Owner',
      note,
      clientVersion: VERSION
    };

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ Recording early checkout…';
    try {
      if (typeof window.v110SaveOperationalStatus !== 'function') {
        throw new Error('Stay operations service is unavailable.');
      }
      const response = await window.v110SaveOperationalStatus(payload, 'checked_out');
      if (response?.queued) {
        if (typeof window.showWaffleForegroundPush === 'function') {
          window.showWaffleForegroundPush({
            title: `↻ ${p.dogName} early checkout queued`,
            body: 'The owner-requested early checkout will sync when online.'
          });
        }
        closeModal();
        return;
      }

      allCards().filter(candidate => payloadForCard(candidate).stayKey === p.stayKey).forEach(decorateCard);
      if (typeof window.renderV10OperationsHome === 'function') {
        try {
          const events = window.globalCalendar?.getEvents?.() || window.v110LatestCalendarEvents || [];
          window.renderV10OperationsHome(events.slice ? events.slice() : events);
        } catch (_) {}
      }
      if (typeof window.showWaffleForegroundPush === 'function') {
        window.showWaffleForegroundPush({
          title: `⏱️ ${p.dogName} checked out early`,
          body: 'Owner-requested early checkout recorded. Original booking dates were preserved.'
        });
      }
      try {
        window.dispatchEvent(new CustomEvent('waffle:early-checkout-recorded', {
          detail: {
            version: VERSION,
            stayKey: p.stayKey,
            dogName: p.dogName,
            actualCheckoutDate: actualDate,
            originalEndDate: p.endDate,
            reasonCode: REASON_CODE
          }
        }));
      } catch (_) {}
      closeModal();
      scheduleEnhance();
    } catch (error) {
      window.alert(`Early checkout could not be saved.\n\n${error?.message || String(error)}`);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  document.addEventListener('click', event => {
    const earlyButton = event.target?.closest?.('[data-v11217-early-checkout]');
    if (earlyButton) {
      event.preventDefault();
      event.stopPropagation();
      openModal(earlyButton.closest('.directory-card'), earlyButton);
      return;
    }
    if (event.target?.closest?.('[data-v11217-close]')) {
      event.preventDefault();
      closeModal();
      return;
    }
    const confirmButton = event.target?.closest?.('[data-v11217-confirm]');
    if (confirmButton) {
      event.preventDefault();
      confirmEarlyCheckout(confirmButton);
      return;
    }
    const modal = event.target?.closest?.('#v11217EarlyCheckoutModal');
    if (modal && event.target === modal) closeModal();
  });

  document.addEventListener('keydown', event => {
    const modal = document.getElementById('v11217EarlyCheckoutModal');
    if (!modal || modal.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }
  });

  ensureStyles();
  const observer = new MutationObserver(scheduleEnhance);
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList:true, subtree:true });
  }
  document.addEventListener('DOMContentLoaded', scheduleEnhance, { once:true });
  window.addEventListener('waffle:maintenance-clear', scheduleEnhance);
  window.addEventListener('waffle:early-checkout-recorded', scheduleEnhance);
  scheduleEnhance();

  window.WAFFLE_EARLY_CHECKOUT_V11217 = Object.freeze({
    version: VERSION,
    reasonCode: REASON_CODE,
    reason: REASON,
    preservesOriginalBookingDates: true,
    refresh: scheduleEnhance
  });
})();
