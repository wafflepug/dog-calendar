/* Optional, staff-controlled message after a verified checkout. */
(function () {
  'use strict';
  if (window.WAFFLE_DEPARTURE_MESSAGE) return;

  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  let currentContext = null;

  function validDate(value) {
    const match = DATE_RE.exec(String(value || '').trim());
    if (!match) return '';
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) &&
      date.getUTCMonth() === Number(match[2]) - 1 &&
      date.getUTCDate() === Number(match[3]) ? match[0] : '';
  }

  function localDateFromTimestamp(value) {
    const instant = new Date(String(value || ''));
    if (!value || Number.isNaN(instant.getTime())) return '';
    const local = new Date(instant.getTime() - instant.getTimezoneOffset() * 60000);
    return validDate(local.toISOString().slice(0, 10));
  }

  function cardStillMatches(card, payload) {
    if (!card?.isConnected) return false;
    const current = typeof window.v110OperationalPayloadFromCard === 'function'
      ? window.v110OperationalPayloadFromCard(card)
      : {
          stayId: card.dataset.directoryStayId || '',
          stayKey: card.dataset.directoryStayKey || card.dataset.stayKey || '',
          dogId: card.dataset.directoryDogId || '',
          dogName: card.dataset.directoryDogName || card.dataset.dogName || '',
          startDate: card.dataset.directoryStartDate || card.dataset.startDate || '',
          endDate: card.dataset.directoryEndDate || card.dataset.endDate || ''
        };
    return String(current.stayId || '') === String(payload.stayId || '') &&
      String(current.stayKey || '') === String(payload.stayKey || '') &&
      String(current.dogId || '') === String(payload.dogId || '') &&
      String(current.dogName || '').trim().toLocaleLowerCase() === String(payload.dogName || '').trim().toLocaleLowerCase() &&
      validDate(current.startDate) === validDate(payload.startDate) &&
      validDate(current.endDate) === validDate(payload.endDate);
  }

  function verify(payload, response, card) {
    const record = response?.record;
    const stayId = String(payload?.stayId || '').trim();
    const dogId = String(payload?.dogId || '').trim();
    const stayKey = String(payload?.stayKey || '').trim();
    const dogName = String(payload?.dogName || '').trim();
    const startDate = validDate(payload?.startDate);
    const endDate = validDate(payload?.endDate);
    if (response?.queued || response?.pending || response?.conflict ||
        response?.result !== 'success' || !record || record.queued === true || record.pending === true || record.identityConflict === true ||
        record.conflict === true || record.ambiguous === true ||
        record.status !== 'checked_out' || !stayId || String(record.stayId || '').trim() !== stayId ||
        !dogId || (record.dogId && String(record.dogId).trim() !== dogId) ||
        !stayKey || String(record.stayKey || '').trim() !== stayKey ||
        !dogName || String(record.dogName || '').trim().toLocaleLowerCase() !== dogName.toLocaleLowerCase() ||
        !startDate || !endDate || validDate(record.startDate) !== startDate || validDate(record.endDate) !== endDate ||
        !cardStillMatches(card, payload)) return null;
    const validStayId = typeof window.v110ValidStayId === 'function'
      ? window.v110ValidStayId(stayId)
      : /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stayId);
    if (!validStayId) return null;
    if (record.actualCheckoutDate && !validDate(record.actualCheckoutDate)) return null;
    const actualDate = record.actualCheckoutDate
      ? validDate(record.actualCheckoutDate)
      : localDateFromTimestamp(record.checkedOutAt);
    if (!actualDate || actualDate < startDate) return null;
    const today = typeof window.getLocalTodayDateString === 'function'
      ? validDate(window.getLocalTodayDateString())
      : localDateFromTimestamp(new Date().toISOString());
    if (!today || actualDate > today) return null;
    const rawDogNumber = String(card.dataset.directoryDogNumber || '').trim().replace(/^#/, '');
    const dogNumber = /^[0-9]{1,5}$/.test(rawDogNumber) && Number(rawDogNumber) > 0
      ? `#${String(Number(rawDogNumber)).padStart(5, '0')}`
      : '';
    return Object.freeze({
      stayId, dogId, stayKey, dogName, startDate, endDate, actualDate,
      dogNumber
    });
  }

  function formatDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
    });
  }

  function buildBanner(context) {
    const banner = document.createElement('section');
    banner.id = 'v11217DepartureMessageBanner';
    banner.className = 'v11217-departure-banner';
    banner.setAttribute('aria-label', 'Departure message');
    const disclosure = document.createElement('details');
    disclosure.dataset.v11217DepartureDisclosure = '';
    const summary = document.createElement('summary');
    summary.textContent = `Departure message · ${context.dogName}${context.dogNumber ? ` · ${context.dogNumber}` : ''} · Checked out ${formatDate(context.actualDate)}`;
    const label = document.createElement('label');
    label.htmlFor = 'v11217DepartureMessageText';
    label.textContent = 'Message to owner';
    const message = document.createElement('textarea');
    message.id = 'v11217DepartureMessageText';
    message.dataset.v11217DepartureText = '';
    message.readOnly = true;
    message.rows = 3;
    message.value = `Hi! ${context.dogName} checked out on ${formatDate(context.actualDate)}. Thank you for choosing Waffle House!`;
    const actions = document.createElement('div');
    actions.className = 'v11217-departure-actions';
    const copy = document.createElement('button');
    copy.type = 'button'; copy.textContent = 'Copy message'; copy.dataset.v11217DepartureCopy = '';
    const share = document.createElement('button');
    share.type = 'button'; share.textContent = 'Share'; share.dataset.v11217DepartureShare = '';
    share.hidden = typeof navigator.share !== 'function';
    const status = document.createElement('p');
    status.dataset.v11217DepartureStatus = '';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'No message has been sent. Copy it into your usual chat with the owner.';
    const dismiss = document.createElement('button');
    dismiss.type = 'button'; dismiss.textContent = 'Dismiss'; dismiss.dataset.v11217DepartureDismiss = '';
    actions.append(copy, share);
    disclosure.append(summary, label, message, actions, status);
    banner.append(disclosure, dismiss);

    copy.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(message.value);
        status.textContent = 'Message copied. Paste it into your usual chat and send it when ready.';
      } catch (_) {
        message.focus();
        message.select();
        status.textContent = 'Copy was blocked. The message is selected; copy it and paste it into your usual chat.';
      }
    });
    share.addEventListener('click', async () => {
      if (typeof navigator.share !== 'function') return;
      share.disabled = true;
      try {
        await navigator.share({ title: 'Departure update', text: message.value });
        status.textContent = 'Share sheet closed. Confirm the message in your chosen app.';
      } catch (error) {
        status.textContent = error?.name === 'AbortError'
          ? 'Sharing cancelled. The message remains ready to copy.'
          : 'Sharing is unavailable. Copy the message into your usual chat instead.';
      } finally { share.disabled = false; }
    });
    dismiss.addEventListener('click', () => {
      banner.remove();
      currentContext = null;
      const target = [...document.querySelectorAll('#guestDirectorySearch,[data-care-roster-focus] summary,[data-directory-search],#directory-search,[data-directory-filter],.directory-guest-tile-open')]
        .find(node => node.getClientRects().length && !node.closest('[hidden],[aria-hidden="true"]'));
      if (target) target.focus();
    });
    return banner;
  }

  function viewAllowsBanner() {
    const grid = document.getElementById('directory-grid');
    const dashboard = document.querySelector('.directory-dashboard-fused');
    const activeView = document.querySelector('[data-v1082-stay-tab].is-active')?.dataset.v1082StayTab || 'current';
    return !!grid && activeView === 'current' && !dashboard?.classList.contains('is-profile-mode') &&
      !dashboard?.querySelector('.directory-card.is-profile-active') && grid.getClientRects().length > 0;
  }

  function refreshVisibility() {
    const banner = document.getElementById('v11217DepartureMessageBanner');
    if (banner && currentContext) {
      const hidden = !viewAllowsBanner();
      if (banner.hidden !== hidden) banner.hidden = hidden;
    }
  }

  function publishVerified(payload, response, card) {
    const context = verify(payload, response, card);
    if (!context) return false;
    const grid = document.getElementById('directory-grid');
    if (!grid?.parentElement) return false;
    currentContext = context;
    document.getElementById('v11217DepartureMessageBanner')?.remove();
    grid.parentElement.insertBefore(buildBanner(context), grid);
    refreshVisibility();
    return true;
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-v1082-stay-tab]') || event.target.closest('.directory-guest-tile-open')) {
      window.setTimeout(refreshVisibility, 0);
    }
  });
  const dashboard = document.querySelector('.directory-dashboard-fused');
  if (dashboard && typeof MutationObserver === 'function') {
    new MutationObserver(refreshVisibility).observe(dashboard, { attributes: true, attributeFilter: ['class'], subtree: true });
  }
  window.addEventListener('waffle:directory-updated', refreshVisibility);
  window.WAFFLE_DEPARTURE_MESSAGE = Object.freeze({ publishVerified, verify, refreshVisibility });
})();
