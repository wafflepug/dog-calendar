/* ============================================================
   WAFFLE HOUSE V11.1.4 — SAFE REQUEST SOURCE + THEME FOLLOW-UP
   No open-ended DOM observer. Uses existing form lifecycle hooks.
   ============================================================ */

(function () {
  'use strict';

  const FACEBOOK_IMAGE = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<circle cx="50" cy="50" r="50" fill="#1877F2"/>' +
      '<path fill="#fff" d="M56.5 100V55.1h15.1l2.3-17.5H56.5V26.4c0-5.1 1.4-8.5 8.8-8.5h9.4V2.2C73.1 2 67.5 1.5 61 1.5c-12.8 0-21.6 7.8-21.6 22.1v14H24.9v17.5h14.5V100h17.1z"/>' +
    '</svg>'
  );

  const basePotentialEnsure = typeof v111EnsurePotentialSourceField === 'function'
    ? v111EnsurePotentialSourceField
    : null;
  const baseBoardingEnsure = typeof v111EnsureBoardingSourceField === 'function'
    ? v111EnsureBoardingSourceField
    : null;

  function patchFacebookArtwork() {
    if (typeof V1112_REQUEST_SOURCES !== 'undefined') {
      const source = V1112_REQUEST_SOURCES.find(item => item && item.value === 'Facebook');
      if (source) source.image = FACEBOOK_IMAGE;
    }

    document.querySelectorAll('[data-v1112-source-value="Facebook"] img').forEach(img => {
      if (img.src !== FACEBOOK_IMAGE) img.src = FACEBOOK_IMAGE;
    });
  }

  function polishPicker(select) {
    if (!select) return null;
    if (typeof v1112EnhanceSourceSelect === 'function') v1112EnhanceSourceSelect(select);

    const host = select.closest('.v111-request-source-field, .v1112-meet-source-field, .v1114-source-field') || select.parentElement;
    const picker = host && host.querySelector('.v1112-source-picker');
    const title = picker && picker.querySelector('.v1112-source-title');
    if (title) title.textContent = 'Request From *';

    patchFacebookArtwork();
    return picker;
  }

  function removeQuickActionRequestSource() {
    const quick = document.getElementById('v10QuickAddSheet');
    if (!quick) return;

    quick.querySelectorAll('.v1112-meet-source-field, .v1112-source-picker, [data-v1112-meet-source]').forEach(node => {
      const host = node.closest('.v1112-meet-source-field');
      (host || node).remove();
    });
  }

  function ensurePotentialSourceFieldSafe() {
    let select = document.getElementById('potRequestSource');
    if (!select && basePotentialEnsure) select = basePotentialEnsure();
    if (!select) return null;

    const phone = document.getElementById('potPhone');
    const host = select.closest('.v111-request-source-field') || select.parentElement;
    if (host) {
      host.classList.add('v1114-source-field', 'v1114-potential-source-field');
      if (phone && phone.nextElementSibling !== host) phone.insertAdjacentElement('afterend', host);
    }

    polishPicker(select);
    return select;
  }

  function ensureBoardingSourceFieldSafe(modal) {
    modal = modal || document.getElementById('v108BoardingModal');
    let select = modal && modal.querySelector('[data-v111-request-source="boarding"]');
    if (!select && baseBoardingEnsure) select = baseBoardingEnsure(modal);
    if (!select) return null;

    const host = select.closest('.v111-request-source-field') || select.parentElement;
    if (host) host.classList.add('v1114-source-field', 'v1114-boarding-source-field');
    polishPicker(select);
    return select;
  }

  function sourceOptions() {
    return '<option value="">Select source…</option>' +
      ['MadPaws', 'Pawshake', 'Facebook'].map(value => `<option value="${value}">${value}</option>`).join('');
  }

  function ensureMeetGreetSourceSafe() {
    const modal = document.getElementById('customBookingModal');
    const breed = document.getElementById('modalBreed');
    if (!modal || !breed) return null;

    let select = modal.querySelector('[data-v1112-meet-source]');
    let host = select && (select.closest('.v1112-meet-source-field') || select.parentElement);

    if (!select) {
      host = document.createElement('div');
      host.className = 'v1112-meet-source-field v1114-source-field v1114-meet-source-field';

      select = document.createElement('select');
      select.required = true;
      select.setAttribute('data-v1112-meet-source', 'true');
      select.setAttribute('data-request-source', 'meet-greet');
      select.setAttribute('aria-label', 'Request From');
      select.innerHTML = sourceOptions();
      host.appendChild(select);
    }

    host.classList.add('v1114-source-field', 'v1114-meet-source-field');
    if (breed.nextElementSibling !== host) breed.insertAdjacentElement('afterend', host);

    polishPicker(select);
    return select;
  }

  function modalVisible(modal) {
    if (!modal || modal.hidden) return false;
    const style = getComputedStyle(modal);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function activeRequestSourceSafe() {
    const contexts = [
      [document.getElementById('v108BoardingModal'), document.querySelector('#v108BoardingModal [data-v111-request-source="boarding"]')],
      [document.getElementById('potentialStayModal'), document.getElementById('potRequestSource')],
      [document.getElementById('customBookingModal'), document.querySelector('#customBookingModal [data-v1112-meet-source]')]
    ];

    for (const [modal, select] of contexts) {
      if (modalVisible(modal) && select && select.value) return String(select.value);
    }
    return '';
  }

  function wireMeetGreetLifecycle() {
    if (typeof openV10MeetGreetModal === 'function' && !openV10MeetGreetModal.v1114Wrapped) {
      const base = openV10MeetGreetModal;
      const wrapped = function (dateString = '') {
        const result = base(dateString);
        const source = ensureMeetGreetSourceSafe();
        if (source) {
          source.value = '';
          source.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return result;
      };
      wrapped.v1114Wrapped = true;
      openV10MeetGreetModal = wrapped;
    }

    if (typeof v108OpenMeet === 'function' && !v108OpenMeet.v1114Wrapped) {
      const base = v108OpenMeet;
      const wrapped = function (eventRecord) {
        const result = base(eventRecord);
        const source = ensureMeetGreetSourceSafe();
        if (source) {
          source.value = String(eventRecord?.extendedProps?.requestSource || '');
          source.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return result;
      };
      wrapped.v1114Wrapped = true;
      v108OpenMeet = wrapped;
    }
  }

  function wireMeetGreetPayload() {
    if (typeof sendPayloadToAppsScript !== 'function' || sendPayloadToAppsScript.v1114Wrapped) return;

    const base = sendPayloadToAppsScript;
    const wrapped = function (payload) {
      const prepared = { ...(payload || {}) };
      const action = String(prepared.action || '');
      const modal = document.getElementById('customBookingModal');

      if (modalVisible(modal) && (action === 'create' || action === 'update')) {
        const source = ensureMeetGreetSourceSafe();
        prepared.requestSource = source ? String(source.value || '') : '';
        if (action === 'create' && !prepared.requestSource) {
          throw new Error('Choose where the Meet & Greet request came from.');
        }
      }

      return base(prepared);
    };
    wrapped.v1114Wrapped = true;
    sendPayloadToAppsScript = wrapped;
  }

  function installSafeOverrides() {
    if (basePotentialEnsure) v111EnsurePotentialSourceField = ensurePotentialSourceFieldSafe;
    if (baseBoardingEnsure) v111EnsureBoardingSourceField = ensureBoardingSourceFieldSafe;

    if (typeof v1112EnsureMeetGreetSource === 'function') {
      v1112EnsureMeetGreetSource = function () {
        removeQuickActionRequestSource();
        return ensureMeetGreetSourceSafe();
      };
    }

    if (typeof v1112ActiveRequestSource === 'function') {
      v1112ActiveRequestSource = activeRequestSourceSafe;
    }

    wireMeetGreetLifecycle();
    wireMeetGreetPayload();
  }

  function start() {
    installSafeOverrides();
    removeQuickActionRequestSource();
    patchFacebookArtwork();
    ensurePotentialSourceFieldSafe();
    ensureBoardingSourceFieldSafe();
    ensureMeetGreetSourceSafe();

    // One bounded follow-up pass covers late script initialisation without
    // creating a persistent observer/render loop.
    setTimeout(() => {
      installSafeOverrides();
      removeQuickActionRequestSource();
      patchFacebookArtwork();
      ensurePotentialSourceFieldSafe();
      ensureBoardingSourceFieldSafe();
      ensureMeetGreetSourceSafe();
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
