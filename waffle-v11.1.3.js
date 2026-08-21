/* ============================================================
   WAFFLE HOUSE V11.1.3 — REQUEST SOURCE PLACEMENT + THEME FIX
   ============================================================ */

const V1113_VERSION = '11.1.3';
const V1113_FACEBOOK_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzE4NzdGMiIvPjx0ZXh0IHg9IjUwIiB5PSI3OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsLEhlbHZldGljYSxzYW5zLXNlcmlmIiBmb250LXNpemU9IjgyIiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSJ3aGl0ZSI+ZjwvdGV4dD48L3N2Zz4=';

function v1113PatchFacebookArtwork() {
  if (typeof V1112_REQUEST_SOURCES === 'undefined') return;
  const facebook = V1112_REQUEST_SOURCES.find(source => source?.value === 'Facebook');
  if (facebook) facebook.image = V1113_FACEBOOK_IMAGE;

  document.querySelectorAll('[data-v1112-source-value="Facebook"] img')
    .forEach(img => { if (img.src !== V1113_FACEBOOK_IMAGE) img.src = V1113_FACEBOOK_IMAGE; });
}

function v1113SourceOptions() {
  const sources = typeof V1112_REQUEST_SOURCES !== 'undefined'
    ? V1112_REQUEST_SOURCES
    : [
        { value: 'MadPaws', label: 'MadPaws' },
        { value: 'Pawshake', label: 'Pawshake' },
        { value: 'Facebook', label: 'Facebook' }
      ];

  return '<option value="">Select source...</option>' +
    sources.map(source => `<option value="${source.value}">${source.label}</option>`).join('');
}

function v1113PolishPicker(picker) {
  if (!picker) return;
  const title = picker.querySelector('.v1112-source-title');
  if (title && title.textContent !== 'Request From *') title.textContent = 'Request From *';
  v1113PatchFacebookArtwork();
}

function v1113RemoveQuickActionSource() {
  const quick = document.getElementById('v10QuickAddSheet');
  if (!quick) return;

  quick.querySelectorAll('.v1112-meet-source-field').forEach(node => node.remove());
  quick.querySelectorAll('[data-v1112-meet-source]').forEach(select => {
    const picker = select.nextElementSibling;
    if (picker?.classList?.contains('v1112-source-picker')) picker.remove();
    select.remove();
  });
  quick.querySelectorAll('.v1112-source-picker').forEach(node => node.remove());
}

function v1113EnsurePotentialSourceField() {
  const modal = document.getElementById('potentialStayModal');
  const panel = modal?.querySelector('.modal-content-panel');
  const phone = document.getElementById('potPhone');
  if (!panel || !phone) return null;

  let select = document.getElementById('potRequestSource');
  if (!select) {
    select = document.createElement('select');
    select.id = 'potRequestSource';
    select.required = true;
    select.setAttribute('aria-label', 'Request From');
    select.innerHTML = v1113SourceOptions();
  }

  const oldHost = select.closest('.v111-request-source-field');
  let picker = select.nextElementSibling?.classList?.contains('v1112-source-picker')
    ? select.nextElementSibling
    : oldHost?.querySelector('.v1112-source-picker');

  let field = panel.querySelector('.v1113-potential-source-field');
  if (!field) {
    field = document.createElement('div');
    field.className = 'v1113-source-field v1113-potential-source-field';
    phone.insertAdjacentElement('afterend', field);
  }

  field.appendChild(select);
  if (picker) field.appendChild(picker);

  if (oldHost && oldHost !== field && !oldHost.contains(field)) {
    oldHost.remove();
  }

  if (!picker && typeof v1112EnhanceSourceSelect === 'function') {
    v1112EnhanceSourceSelect(select);
    picker = select.nextElementSibling;
  }

  v1113PolishPicker(picker);
  return select;
}

function v1113EnsureBoardingSourceField() {
  const modal = document.getElementById('v108BoardingModal');
  if (!modal) return null;

  let select = modal.querySelector('[data-v111-request-source="boarding"]');
  if (!select && typeof v111EnsureBoardingSourceField === 'function') {
    select = v111EnsureBoardingSourceField(modal);
  }
  if (!select) return null;

  const host = select.closest('.v111-request-source-field') || select.parentElement;
  host?.classList?.add('v1113-source-field', 'v1113-boarding-source-field');

  let picker = select.nextElementSibling?.classList?.contains('v1112-source-picker')
    ? select.nextElementSibling
    : host?.querySelector('.v1112-source-picker');

  if (!picker && typeof v1112EnhanceSourceSelect === 'function') {
    v1112EnhanceSourceSelect(select);
    picker = select.nextElementSibling;
  }

  v1113PolishPicker(picker);
  return select;
}

function v1113EnsureMeetGreetSource() {
  const modal = document.getElementById('customBookingModal');
  const panel = modal?.querySelector('.modal-content-panel');
  const breed = document.getElementById('modalBreed');
  if (!panel || !breed) return null;

  document.querySelectorAll('[data-v1112-meet-source]').forEach(other => {
    if (!modal.contains(other)) {
      const host = other.closest('.v1112-meet-source-field') || other.parentElement;
      host?.remove();
    }
  });

  let field = panel.querySelector('.v1113-meet-source-field');
  let select = field?.querySelector('[data-v1112-meet-source]');

  if (!field) {
    field = document.createElement('div');
    field.className = 'v1113-source-field v1113-meet-source-field';
    breed.insertAdjacentElement('afterend', field);
  }

  if (!select) {
    select = document.createElement('select');
    select.required = true;
    select.setAttribute('data-v1112-meet-source', 'true');
    select.setAttribute('data-request-source', 'meet-greet');
    select.setAttribute('aria-label', 'Request From');
    select.innerHTML = v1113SourceOptions();
    field.appendChild(select);
  }

  let picker = select.nextElementSibling?.classList?.contains('v1112-source-picker')
    ? select.nextElementSibling
    : field.querySelector('.v1112-source-picker');

  if (!picker && typeof v1112EnhanceSourceSelect === 'function') {
    v1112EnhanceSourceSelect(select);
    picker = select.nextElementSibling;
  }

  v1113PolishPicker(picker);
  return select;
}

function v1113ModalIsVisible(modal) {
  if (!modal || modal.hidden) return false;
  const style = getComputedStyle(modal);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function v1113VisibleRequestSource() {
  const contexts = [
    {
      modal: document.getElementById('v108BoardingModal'),
      select: document.querySelector('#v108BoardingModal [data-v111-request-source="boarding"]')
    },
    {
      modal: document.getElementById('potentialStayModal'),
      select: document.getElementById('potRequestSource')
    },
    {
      modal: document.getElementById('customBookingModal'),
      select: document.querySelector('#customBookingModal [data-v1112-meet-source]')
    }
  ];

  for (const context of contexts) {
    if (v1113ModalIsVisible(context.modal) && context.select?.value) {
      return String(context.select.value);
    }
  }
  return '';
}

function v1113WireFunctionOverrides() {
  if (typeof v111EnsurePotentialSourceField === 'function') {
    v111EnsurePotentialSourceField = v1113EnsurePotentialSourceField;
  }

  if (typeof v1112EnsureMeetGreetSource === 'function') {
    v1112EnsureMeetGreetSource = function() {
      return v1113EnsureMeetGreetSource();
    };
  }

  if (typeof v1112ActiveRequestSource === 'function') {
    v1112ActiveRequestSource = v1113VisibleRequestSource;
  }

  if (typeof openV10MeetGreetModal === 'function' && !openV10MeetGreetModal.v1113Wrapped) {
    const baseOpenMeet = openV10MeetGreetModal;
    const wrappedOpenMeet = function(dateString = '') {
      const result = baseOpenMeet(dateString);
      const source = v1113EnsureMeetGreetSource();
      if (source) {
        source.value = '';
        source.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return result;
    };
    wrappedOpenMeet.v1113Wrapped = true;
    openV10MeetGreetModal = wrappedOpenMeet;
  }

  if (typeof v108OpenMeet === 'function' && !v108OpenMeet.v1113Wrapped) {
    const baseEditMeet = v108OpenMeet;
    const wrappedEditMeet = function(eventRecord) {
      const result = baseEditMeet(eventRecord);
      const source = v1113EnsureMeetGreetSource();
      if (source) {
        source.value = String(eventRecord?.extendedProps?.requestSource || '');
        source.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return result;
    };
    wrappedEditMeet.v1113Wrapped = true;
    v108OpenMeet = wrappedEditMeet;
  }

  if (typeof sendPayloadToAppsScript === 'function' && !sendPayloadToAppsScript.v1113Wrapped) {
    const baseSend = sendPayloadToAppsScript;
    const wrappedSend = function(payload) {
      const prepared = { ...(payload || {}) };
      const action = String(prepared.action || '');

      if (action === 'create' || action === 'update') {
        const meetModal = document.getElementById('customBookingModal');
        if (v1113ModalIsVisible(meetModal)) {
          const source = v1113EnsureMeetGreetSource();
          if (source?.value) prepared.requestSource = String(source.value);
          if (action === 'create' && !String(prepared.requestSource || '').trim()) {
            throw new Error('Choose where the Meet & Greet request came from.');
          }
        }
      }

      return baseSend(prepared);
    };
    wrappedSend.v1113Wrapped = true;
    sendPayloadToAppsScript = wrappedSend;
  }
}

function v1113NormaliseUi() {
  v1113PatchFacebookArtwork();
  v1113RemoveQuickActionSource();
  v1113EnsurePotentialSourceField();
  v1113EnsureBoardingSourceField();
  v1113EnsureMeetGreetSource();
  v1113WireFunctionOverrides();
}

function v1113Start() {
  v1113WireFunctionOverrides();
  v1113NormaliseUi();

  const observer = new MutationObserver(() => {
    v1113NormaliseUi();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(v1113NormaliseUi, 350);
  setTimeout(v1113NormaliseUi, 1200);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', v1113Start, { once: true });
} else {
  v1113Start();
}
