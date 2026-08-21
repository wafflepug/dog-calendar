/* ============================================================
   WAFFLE HOUSE V11.1 — MOBILE OPS + QUICK PHOTOS
   ============================================================ */

const V111_VERSION = '11.1.0';

function v111EnsureBusyIndicator() {
    let host = document.getElementById('v111BusyIndicator');
    if (host) return host;

    host = document.createElement('div');
    host.id = 'v111BusyIndicator';
    host.className = 'v111-busy-indicator';
    host.hidden = true;
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    host.innerHTML = '<span class="v111-throbber" aria-hidden="true"></span><strong data-v111-busy-label>Updating…</strong>';
    document.body.appendChild(host);
    return host;
}

function v111SetBusy(active, label = 'Updating…') {
    const host = v111EnsureBusyIndicator();
    host.hidden = !active;
    const copy = host.querySelector('[data-v111-busy-label]');
    if (copy) copy.textContent = label || 'Updating…';
}

function v111RequestSourceOptions(selected = '') {
    const choices = ['MadPaws', 'Pawshake', 'Facebook'];
    return '<option value="">Select source…</option>' + choices.map(value =>
        `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`
    ).join('');
}

function v111EnsurePotentialSourceField() {
    let select = document.getElementById('potRequestSource');
    if (select) return select;

    const notes = document.getElementById('potNotes');
    if (!notes) return null;

    const anchor = notes.closest('label') || notes.parentElement;
    if (!anchor || !anchor.parentElement) return null;

    const label = document.createElement('label');
    label.className = 'v111-request-source-field';
    label.innerHTML = 'Request came from *<select id="potRequestSource" aria-label="Request came from" required>' + v111RequestSourceOptions() + '</select>';
    anchor.parentElement.insertBefore(label, anchor);
    return label.querySelector('select');
}

function v111EnsureBoardingSourceField(modal) {
    modal = modal || document.getElementById('v108BoardingModal');
    if (!modal) return null;

    let select = modal.querySelector('[data-v111-request-source="boarding"]');
    if (select) return select;

    const grid = modal.querySelector('.v108-form-grid');
    const notes = modal.querySelector('[data-v108-board="notes"]');
    if (!grid || !notes) return null;

    const notesLabel = notes.closest('label');
    const label = document.createElement('label');
    label.className = 'v111-request-source-field';
    label.innerHTML = 'Request came from *<select data-v111-request-source="boarding" aria-label="Request came from" required>' + v111RequestSourceOptions() + '</select>';
    grid.insertBefore(label, notesLabel || null);
    return label.querySelector('select');
}

function v111WireFormSources() {
    if (typeof v108EnsureBoardingModal === 'function' && !v108EnsureBoardingModal.v111Wrapped) {
        const baseEnsureBoarding = v108EnsureBoardingModal;
        const wrappedEnsureBoarding = function() {
            const modal = baseEnsureBoarding();
            v111EnsureBoardingSourceField(modal);
            return modal;
        };
        wrappedEnsureBoarding.v111Wrapped = true;
        v108EnsureBoardingModal = wrappedEnsureBoarding;
    }

    if (typeof v108OpenBoarding === 'function' && !v108OpenBoarding.v111Wrapped) {
        const baseOpenBoarding = v108OpenBoarding;
        const wrappedOpenBoarding = function() {
            const result = baseOpenBoarding();
            const source = v111EnsureBoardingSourceField(document.getElementById('v108BoardingModal'));
            if (source) source.value = '';
            return result;
        };
        wrappedOpenBoarding.v111Wrapped = true;
        v108OpenBoarding = wrappedOpenBoarding;
    }

    if (typeof openNewPotentialModal === 'function' && !openNewPotentialModal.v111Wrapped) {
        const baseOpenNewPotential = openNewPotentialModal;
        const wrappedOpenNewPotential = function() {
            const result = baseOpenNewPotential();
            const source = v111EnsurePotentialSourceField();
            if (source) source.value = '';
            return result;
        };
        wrappedOpenNewPotential.v111Wrapped = true;
        openNewPotentialModal = wrappedOpenNewPotential;
    }

    if (typeof openEditPotentialModal === 'function' && !openEditPotentialModal.v111Wrapped) {
        const baseOpenEditPotential = openEditPotentialModal;
        const wrappedOpenEditPotential = function(event) {
            const result = baseOpenEditPotential(event);
            const source = v111EnsurePotentialSourceField();
            if (source) source.value = String(event?.extendedProps?.requestSource || '');
            return result;
        };
        wrappedOpenEditPotential.v111Wrapped = true;
        openEditPotentialModal = wrappedOpenEditPotential;
    }

    if (typeof v1104PotentialEventFromRecord === 'function' && !v1104PotentialEventFromRecord.v111Wrapped) {
        const basePotentialFromRecord = v1104PotentialEventFromRecord;
        const wrappedPotentialFromRecord = function(record) {
            const event = basePotentialFromRecord(record);
            if (event) {
                event.extendedProps = event.extendedProps || {};
                event.extendedProps.requestSource = String(record?.requestSource || '');
            }
            return event;
        };
        wrappedPotentialFromRecord.v111Wrapped = true;
        v1104PotentialEventFromRecord = wrappedPotentialFromRecord;
    }
}

function v111WireMutationThrobber() {
    if (typeof sendPayloadToAppsScript !== 'function' || sendPayloadToAppsScript.v111Wrapped) return;

    const baseSendPayload = sendPayloadToAppsScript;
    const wrappedSendPayload = async function(payload) {
        const prepared = { ...(payload || {}) };
        const action = String(prepared.action || '');

        if (['create_potential', 'update_potential', 'confirm_potential'].includes(action)) {
            const source = v111EnsurePotentialSourceField();
            if (source?.value) prepared.requestSource = source.value;
            if (action === 'create_potential' && !String(prepared.requestSource || '').trim()) {
                throw new Error('Choose where the Potential Stay request came from.');
            }
        }

        if (action === 'create_boarding') {
            const source = v111EnsureBoardingSourceField(document.getElementById('v108BoardingModal'));
            if (source?.value) prepared.requestSource = source.value;
            if (!String(prepared.requestSource || '').trim()) {
                throw new Error('Choose where the Boarding request came from.');
            }
        }

        const labels = {
            create_boarding: 'Creating boarding…',
            create_potential: 'Saving Potential Stay…',
            update_potential: 'Updating Potential Stay…',
            confirm_potential: 'Confirming stay…',
            checkin_stay: 'Checking dog in…',
            checkout_stay: 'Checking dog out…',
            save_reminder_note: 'Saving reminder…',
            set_reminder_note_done: 'Updating reminder…',
            delete_reminder_note: 'Deleting reminder…',
            save_belongings: 'Saving care updates…',
            delete_stay_photo: 'Updating photo library…'
        };

        v111SetBusy(true, labels[action] || 'Saving update…');
        try {
            return await baseSendPayload(prepared);
        } finally {
            v111SetBusy(false);
        }
    };

    wrappedSendPayload.v111Wrapped = true;
    sendPayloadToAppsScript = wrappedSendPayload;
}

function v111ArrivalEvents() {
    const today = getLocalTodayDateString();
    const source = typeof v110LatestCalendarEvents !== 'undefined' && Array.isArray(v110LatestCalendarEvents)
        ? v110LatestCalendarEvents
        : [];

    return source.filter(event => {
        const props = event?.extendedProps || {};
        if (props.isPotential === true || props.isMeetGreet === true) return false;
        const dates = v10EventRawDates(event);
        const operation = v110OperationForStay(v110StayKeyForEvent(event));
        return dates.start === today && !['checked_in', 'checked_out'].includes(String(operation?.status || ''));
    });
}

function v111EnsureArrivalModal() {
    let modal = document.getElementById('v111ArrivalModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'v111ArrivalModal';
    modal.className = 'v108-modal v110-leaving-modal v111-arrival-modal';
    modal.hidden = true;
    modal.innerHTML = `<div class="v108-modal-card v110-leaving-card">
        <div class="v108-modal-head">
            <div><small>ARRIVALS</small><h3>🛬 Arriving Today</h3><p>Review each pet and check them in as they arrive.</p></div>
            <button type="button" data-v111-arrival-close aria-label="Close">×</button>
        </div>
        <div class="v110-leaving-list" data-v111-arrival-list></div>
    </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', async event => {
        if (event.target === modal || event.target.closest('[data-v111-arrival-close]')) {
            modal.hidden = true;
            return;
        }

        const button = event.target.closest('[data-v111-arrival-checkin]');
        if (!button) return;

        const current = v111ArrivalEvents();
        const eventRecord = current[Number(button.dataset.v111ArrivalCheckin)];
        if (!eventRecord) return;

        const props = eventRecord.extendedProps || {};
        const dates = v10EventRawDates(eventRecord);
        const dogName = String(props.dogName || eventRecord.title || 'Guest');
        button.disabled = true;
        button.textContent = '⏳ Checking in…';

        try {
            await v110SaveOperationalStatus({
                stayKey: v110StayKeyForEvent(eventRecord),
                dogName,
                breed: props.breed || '',
                startDate: dates.start,
                endDate: dates.end,
                ownerName: props.ownerName || props.owner || '',
                phone: props.phone || ''
            }, 'checked_in');

            await v111RenderArrivalModal();
            if (typeof renderV10OperationsHome === 'function') {
                renderV10OperationsHome(globalCalendar?.getEvents()?.slice() || current);
            }
        } catch (error) {
            alert('Check In could not be saved.\n\n' + (error?.message || String(error)));
            button.disabled = false;
            button.textContent = '🛬 Check In';
        }
    });

    return modal;
}

async function v111RenderArrivalModal() {
    const modal = v111EnsureArrivalModal();
    const host = modal.querySelector('[data-v111-arrival-list]');
    const list = v111ArrivalEvents();

    if (!list.length) {
        host.innerHTML = '<div class="v110-leaving-empty"><span>✅</span><strong>All arriving pets are checked in.</strong><small>Completed check-ins disappear from this list.</small></div>';
        return;
    }

    host.innerHTML = list.map((eventRecord, index) => {
        const props = eventRecord.extendedProps || {};
        const dates = v10EventRawDates(eventRecord);
        const dogName = String(props.dogName || eventRecord.title || 'Guest');
        return `<article class="v110-leaving-pet">
            <div class="v110-leaving-photo" data-v111-arrival-photo="${index}"><span>🐶</span></div>
            <div class="v110-leaving-copy">
                <strong>${v110Escape(dogName)}</strong>
                <span>${v110Escape(props.breed || 'Breed not recorded')}</span>
                <small>${v110Escape(formatStayDateShort(dates.start))} → ${v110Escape(formatStayDateShort(dates.end))}</small>
            </div>
            <button type="button" class="v110-checkin-button" data-v111-arrival-checkin="${index}">🛬 Check In</button>
        </article>`;
    }).join('');

    list.forEach(async (eventRecord, index) => {
        const url = await v110PhotoForStay(v110StayKeyForEvent(eventRecord));
        if (!url) return;
        const target = host.querySelector(`[data-v111-arrival-photo="${index}"]`);
        if (target) target.innerHTML = `<img src="${v110Escape(url)}" alt="" loading="lazy">`;
    });
}

async function v111OpenArrivalModal() {
    const modal = v111EnsureArrivalModal();
    modal.hidden = false;
    await v111RenderArrivalModal();
}

function v111WireArrivalCount() {
    if (typeof renderV10OperationsHome !== 'function' || renderV10OperationsHome.v111Wrapped) return;
    const baseRenderOperations = renderV10OperationsHome;
    const wrappedRenderOperations = function(events) {
        const result = baseRenderOperations(events);
        if (WAFFLE_PAGE === 'calendar') {
            const count = document.getElementById('v10ArrivalCount');
            if (count) count.textContent = String(v111ArrivalEvents().length);
        }
        return result;
    };
    wrappedRenderOperations.v111Wrapped = true;
    renderV10OperationsHome = wrappedRenderOperations;
}

let v111QuickPhotoState = {
    events: [],
    selectedIndex: -1,
    requestToken: ''
};

function v111CurrentDogEvents() {
    const today = getLocalTodayDateString();
    const latest = typeof v110LatestCalendarEvents !== 'undefined' && Array.isArray(v110LatestCalendarEvents)
        ? v110LatestCalendarEvents
        : [];
    const source = globalCalendar?.getEvents()?.slice() || latest;
    const unique = new Map();

    source.forEach(event => {
        const props = event?.extendedProps || {};
        if (props.isPotential === true || props.isMeetGreet === true) return;
        const dates = v10EventRawDates(event);
        if (!dates.start || !dates.end || today < dates.start || today > dates.end) return;
        const key = v110StayKeyForEvent(event);
        if (!key || v110OperationForStay(key)?.status === 'checked_out') return;
        unique.set(key, event);
    });

    return Array.from(unique.values()).sort((a, b) => {
        const ad = String(a?.extendedProps?.dogName || a?.title || '');
        const bd = String(b?.extendedProps?.dogName || b?.title || '');
        return ad.localeCompare(bd);
    });
}

function v111EnsureQuickPhotoModal() {
    let modal = document.getElementById('v111QuickPhotoModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'v111QuickPhotoModal';
    modal.className = 'v108-modal v111-photo-modal';
    modal.hidden = true;
    modal.innerHTML = `<div class="v108-modal-card v111-photo-card">
        <div class="v108-modal-head">
            <div><small>QUICK PHOTOS</small><h3>📸 Add Photos</h3><p>Select the current dog first, then take photos or choose photos from your device.</p></div>
            <button type="button" data-v111-photo-close aria-label="Close">×</button>
        </div>
        <div data-v111-photo-picker>
            <div class="v111-dog-grid" data-v111-dog-grid></div>
            <div class="v111-photo-actions" data-v111-photo-actions hidden>
                <button type="button" data-v111-photo-mode="camera">📷 Take Photo</button>
                <button type="button" class="primary" data-v111-photo-mode="library">🖼️ Add Photos</button>
            </div>
        </div>
        <div class="v111-photo-frame-wrap" data-v111-photo-frame-wrap hidden>
            <button type="button" class="v111-photo-back" data-v111-photo-back>← Choose another dog</button>
            <iframe data-v111-photo-frame title="Add stay photos" allow="camera; microphone" loading="eager"></iframe>
        </div>
        <div class="v111-photo-status" data-v111-photo-status></div>
    </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
        if (event.target === modal || event.target.closest('[data-v111-photo-close]')) {
            v111CloseQuickPhotoModal();
            return;
        }

        const dogButton = event.target.closest('[data-v111-dog-index]');
        if (dogButton) {
            v111QuickPhotoState.selectedIndex = Number(dogButton.dataset.v111DogIndex);
            modal.querySelectorAll('[data-v111-dog-index]').forEach(button => {
                button.classList.toggle('is-selected', button === dogButton);
            });
            modal.querySelector('[data-v111-photo-actions]').hidden = false;
            return;
        }

        const modeButton = event.target.closest('[data-v111-photo-mode]');
        if (modeButton) {
            v111LaunchQuickPhotoUploader(modeButton.dataset.v111PhotoMode);
            return;
        }

        if (event.target.closest('[data-v111-photo-back]')) {
            const frame = modal.querySelector('[data-v111-photo-frame]');
            frame.src = 'about:blank';
            modal.querySelector('[data-v111-photo-frame-wrap]').hidden = true;
            modal.querySelector('[data-v111-photo-picker]').hidden = false;
        }
    });

    return modal;
}

async function v111RenderQuickPhotoDogs() {
    const modal = v111EnsureQuickPhotoModal();
    const host = modal.querySelector('[data-v111-dog-grid]');
    v111QuickPhotoState.events = v111CurrentDogEvents();
    v111QuickPhotoState.selectedIndex = -1;
    modal.querySelector('[data-v111-photo-actions]').hidden = true;

    if (!v111QuickPhotoState.events.length) {
        host.innerHTML = '<div class="v111-photo-empty"><span>🐾</span><strong>No current dogs found</strong><small>Current boarding stays will appear here.</small></div>';
        return;
    }

    host.innerHTML = v111QuickPhotoState.events.map((eventRecord, index) => {
        const props = eventRecord.extendedProps || {};
        const dogName = String(props.dogName || eventRecord.title || 'Guest');
        return `<button type="button" class="v111-dog-tile" data-v111-dog-index="${index}">
            <span class="v111-dog-photo" data-v111-dog-photo="${index}">🐶</span>
            <strong>${v110Escape(dogName)}</strong>
            <small>${v110Escape(props.breed || 'Breed not recorded')}</small>
        </button>`;
    }).join('');

    v111QuickPhotoState.events.forEach(async (eventRecord, index) => {
        const url = await v110PhotoForStay(v110StayKeyForEvent(eventRecord));
        if (!url) return;
        const target = host.querySelector(`[data-v111-dog-photo="${index}"]`);
        if (target) target.innerHTML = `<img src="${v110Escape(url)}" alt="" loading="lazy">`;
    });
}

async function v111OpenQuickPhotoModal() {
    const modal = v111EnsureQuickPhotoModal();
    modal.hidden = false;
    modal.querySelector('[data-v111-photo-picker]').hidden = false;
    modal.querySelector('[data-v111-photo-frame-wrap]').hidden = true;
    modal.querySelector('[data-v111-photo-status]').textContent = '';
    await v111RenderQuickPhotoDogs();
}

function v111CloseQuickPhotoModal() {
    const modal = document.getElementById('v111QuickPhotoModal');
    if (!modal) return;
    const frame = modal.querySelector('[data-v111-photo-frame]');
    if (frame) frame.src = 'about:blank';
    modal.hidden = true;
    v111QuickPhotoState.requestToken = '';
    v111SetBusy(false);
}

function v111LaunchQuickPhotoUploader(mode) {
    const modal = v111EnsureQuickPhotoModal();
    const eventRecord = v111QuickPhotoState.events[v111QuickPhotoState.selectedIndex];
    if (!eventRecord) return;

    const props = eventRecord.extendedProps || {};
    const dates = v10EventRawDates(eventRecord);
    const dogName = String(props.dogName || eventRecord.title || 'Guest');
    const stayKey = v110StayKeyForEvent(eventRecord);
    const requestToken = makeHostedPhotoRequestToken();
    v111QuickPhotoState.requestToken = requestToken;

    const params = new URLSearchParams({
        action: 'photo_uploader',
        mode: mode || 'library',
        stayKey,
        dogName,
        startDate: dates.start || '',
        endDate: dates.end || dates.start || '',
        photoLabel: 'Stay photo',
        photoType: 'stayPhoto',
        requestToken,
        _ts: String(Date.now())
    });

    modal.querySelector('[data-v111-photo-picker]').hidden = true;
    modal.querySelector('[data-v111-photo-frame-wrap]').hidden = false;
    modal.querySelector('[data-v111-photo-status]').textContent = `Adding photos to ${dogName}…`;
    modal.querySelector('[data-v111-photo-frame]').src = APPS_SCRIPT_WEBAPP_URL + '?' + params.toString();
    v111SetBusy(true, mode === 'camera' ? 'Opening camera…' : 'Opening photo library…');
}

function v111EnhanceQuickActions() {
    const sheet = document.getElementById('v10QuickAddSheet');
    const grid = sheet?.querySelector('.v10-quick-actions');
    if (!grid || grid.querySelector('[data-v10-quick-action="photos"]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v10QuickAction = 'photos';
    button.innerHTML = '<span>📸</span><strong>Add Photos</strong><small>Choose a current dog</small>';
    grid.appendChild(button);
}

function v111WirePhotoMessages() {
    if (window.v111PhotoMessagesWired) return;
    window.v111PhotoMessagesWired = true;

    window.addEventListener('message', event => {
        const data = event?.data;
        if (!data || typeof data !== 'object' || !v111QuickPhotoState.requestToken) return;
        if (data.requestToken !== v111QuickPhotoState.requestToken || (data.photoType || '') !== 'stayPhoto') return;

        const modal = document.getElementById('v111QuickPhotoModal');
        const status = modal?.querySelector('[data-v111-photo-status]');

        if (data.type === 'waffleBelongingsPhotoUploaderReady') {
            v111SetBusy(false);
        } else if (data.type === 'waffleBelongingsPhotoProgress') {
            v111SetBusy(true, String(data.message || 'Uploading photos…'));
        } else if (data.type === 'waffleBelongingsPhotoSaved') {
            v111SetBusy(false);
            const count = Number(data.count || 1);
            if (status) status.textContent = count === 1
                ? '✅ Photo saved to this dog’s Stay Photos.'
                : `✅ ${count} photos saved to this dog’s Stay Photos.`;
        } else if (data.type === 'waffleBelongingsPhotoError') {
            v111SetBusy(false);
            if (status) status.textContent = '❌ Photo upload failed. Please try again.';
        }
    });
}

function v111WireClickActions() {
    if (window.v111ClickActionsWired) return;
    window.v111ClickActionsWired = true;

    document.addEventListener('click', async event => {
        const arriving = event.target.closest('[data-v10-jump="arrivals"]');
        if (arriving && WAFFLE_PAGE === 'calendar') {
            event.preventDefault();
            event.stopImmediatePropagation();
            await v111OpenArrivalModal();
            return;
        }

        const quickAction = event.target.closest('[data-v10-quick-action]');
        if (!quickAction) return;
        const action = String(quickAction.dataset.v10QuickAction || '');
        if (!['boarding', 'photos'].includes(action)) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        const sheet = document.getElementById('v10QuickAddSheet');
        if (sheet) sheet.hidden = true;
        document.body.classList.remove('v10-quick-add-open');

        if (action === 'boarding') {
            v108OpenBoarding();
        } else {
            await v111OpenQuickPhotoModal();
        }
    }, true);
}

function v111Init() {
    if (window.v111Initialised) return;
    window.v111Initialised = true;

    v111EnsureBusyIndicator();
    v111WireFormSources();
    v111WireMutationThrobber();
    v111WirePhotoMessages();
    v111WireClickActions();

    if (WAFFLE_PAGE === 'calendar') {
        v111EnsurePotentialSourceField();
        if (typeof v108EnsureBoardingModal === 'function') v108EnsureBoardingModal();
        v111EnsureArrivalModal();
        v111EnsureQuickPhotoModal();
        v111WireArrivalCount();
        v111EnhanceQuickActions();
        setTimeout(v111EnhanceQuickActions, 350);
        setTimeout(() => {
            if (typeof renderV10OperationsHome === 'function') {
                const events = globalCalendar?.getEvents()?.slice() || [];
                if (events.length) renderV10OperationsHome(events);
            }
        }, 450);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', v111Init, { once: true });
} else {
    v111Init();
}
