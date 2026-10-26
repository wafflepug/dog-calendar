(function careSitterSummaryModule() {
    'use strict';

    if (typeof document === 'undefined' || !document.body || document.body.dataset.wafflePage !== 'directory') return;
    if (document.__waffleCareSitterSummaryInstalled) return;
    Object.defineProperty(document, '__waffleCareSitterSummaryInstalled', { value: true });

    const locks = new WeakSet();
    const cardStates = new WeakMap();

    function cardState(card) {
        let state = cardStates.get(card);
        if (!state) {
            state = { epoch: 0, pending: false, pendingSnapshot: null, displayedSnapshot: null };
            cardStates.set(card, state);
        }
        return state;
    }

    function clean(value) {
        return String(value ?? '').replace(/\r\n?/g, '\n').trim();
    }

    function notRecordedWhenExplicitlyMissing(value) {
        const text = clean(value);
        return /^No saved .* instructions$|^No .* instructions saved$/i.test(text) ? 'Not recorded' : (text || 'Not recorded');
    }

    function selectedCardMatches(card) {
        if (!card?.isConnected || !card.classList.contains('is-profile-active') || card.classList.contains('is-profile-editing') || card.dataset.profileEditing === 'true') return false;
        const stayKey = clean(card.dataset.directoryStayKey || card.dataset.stayKey);
        const stayId = clean(card.dataset.directoryStayId);
        const dogId = clean(card.dataset.directoryDogId);
        const blockedForIdentity = clean(card.dataset.profileIdentityBlocked) && card.dataset.profileIdentityBlockedReason !== 'missing';
        if (!stayKey || !stayId || !dogId || blockedForIdentity) return false;
        const exactCards = Array.from(document.querySelectorAll('.directory-card.is-profile-active')).filter(candidate =>
            clean(candidate.dataset.directoryStayKey || candidate.dataset.stayKey) === stayKey &&
            clean(candidate.dataset.directoryStayId).toLowerCase() === stayId.toLowerCase() &&
            clean(candidate.dataset.directoryDogId).toLowerCase() === dogId.toLowerCase()
        );
        return exactCards.length === 1 && exactCards[0] === card;
    }

    function valueAt(card, selector) {
        return clean(card.querySelector(selector)?.textContent);
    }

    function careRows(card, selector) {
        const host = card.querySelector(selector);
        if (!host) return 'Not recorded';
        const rows = Array.from(host.querySelectorAll('[data-care-brief-row]')).map(row => clean(row.textContent));
        if (rows.length) return rows.join('\n');
        const text = clean(host.textContent);
        return notRecordedWhenExplicitlyMissing(text);
    }

    function formatIsoDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(value));
        if (!match) return '';
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return '';
        return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
    }

    function formatPermanentDogNumber(value) {
        const match = /^#?(\d+)$/.exec(clean(value));
        if (!match || !/[1-9]/.test(match[1])) return '';
        return `#${match[1].replace(/^0+(?=\d)/, '').padStart(5, '0')}`;
    }

    function snapshot(card) {
        if (!selectedCardMatches(card)) return null;
        const profile = card.querySelector('[data-directory-detail="profile"]');
        const readState = clean(profile?.dataset.profileReadState).toLowerCase();
        if (!['fresh', 'saved', 'not-found'].includes(readState)) return null;
        const freshness = card.querySelector('[data-care-brief-freshness]');
        const freshnessState = clean(freshness?.dataset.state).toLowerCase();
        if (['loading', 'refreshing', 'unresolved', 'identity-conflict'].includes(freshnessState)) return null;
        const name = clean(card.dataset.directoryDogName || card.dataset.dogName || card.querySelector('.directory-card-identity [data-directory-edit-field="dogName"]')?.textContent);
        const number = formatPermanentDogNumber(card.dataset.directoryDogNumber);
        const stayKey = clean(card.dataset.directoryStayKey || card.dataset.stayKey);
        const start = clean(card.dataset.directoryStartDate || card.dataset.startDate);
        const end = clean(card.dataset.directoryEndDate || card.dataset.endDate);
        if (!name || !stayKey) return null;

        const startLabel = formatIsoDate(start);
        const endLabel = formatIsoDate(end);
        const dateText = startLabel && endLabel ? `${startLabel} to ${endLabel}` : startLabel || endLabel || 'Not recorded';
        const freshnessSummary = valueAt(card, '[data-care-brief-freshness-summary]') || 'Saved care status unavailable';
        const freshnessDetail = valueAt(card, '[data-care-brief-freshness-detail]') || freshnessSummary;
        const safety = valueAt(card, '[data-care-brief-safety]') || 'Not recorded';
        const medication = notRecordedWhenExplicitlyMissing(valueAt(card, '[data-care-brief-medication]'));
        const feeding = careRows(card, '[data-care-brief-feeding]');
        const walking = careRows(card, '[data-care-brief-walks]');
        const noteHost = card.querySelector('[data-care-brief-handover-note]');
        const note = noteHost?.dataset.careBriefNoteRendered === 'true'
            ? clean(noteHost.dataset.careBriefHandoverNote)
            : clean(noteHost?.querySelector('[data-care-brief-handover-full]')?.textContent || noteHost?.textContent);
        const identity = [stayKey, clean(card.dataset.directoryStayId), clean(card.dataset.directoryDogId), number, name, dateText].join('\u001f');
        const text = [
            `Sitter summary — ${name}${number ? ` · Permanent dog number ${number}` : (clean(card.dataset.directoryDogId) ? ` · Dog ID ${clean(card.dataset.directoryDogId)}` : '')}`,
            `Stay: ${dateText}`,
            `Stay ID: ${clean(card.dataset.directoryStayId)}`,
            `Saved care: ${freshnessSummary.replace(/\s*·\s*Details\s*$/, '')}`,
            `Freshness: ${freshnessDetail}`,
            `Safety: ${safety}`,
            `Medication: ${medication || 'Not recorded'}`,
            `Feeding: ${feeding}`,
            `Walks: ${walking}`,
            `Handover: ${note || 'Not recorded'}`
        ].join('\n\n');
        return { identity, text };
    }

    function controlsFor(button) {
        const card = button.closest('.directory-card');
        const brief = button.closest('[data-directory-care-brief]');
        const output = brief?.querySelector('[data-care-sitter-summary-output]');
        const status = output?.querySelector('[data-care-sitter-summary-status]');
        const manual = output?.querySelector('[data-care-sitter-summary-manual]');
        return { card, brief, output, status, manual };
    }

    function showStatus({ output, status, manual }, message, text, fallback) {
        if (!output?.isConnected || !status?.isConnected) return;
        output.hidden = false;
        status.textContent = message;
        if (manual) {
            manual.value = fallback ? text : '';
            manual.hidden = !fallback;
            if (fallback) {
                manual.focus();
                manual.select();
            }
        }
    }

    function syncCard(card) {
        const state = cardStates.get(card);
        if (!state || (!state.pending && !state.displayedSnapshot)) return;
        const brief = card?.querySelector('[data-directory-care-brief]');
        const output = brief?.querySelector('[data-care-sitter-summary-output]');
        if (!output || (output.hidden && !state.pending)) return;
        const current = snapshot(card);
        const expected = state.pendingSnapshot || state.displayedSnapshot;
        if (current && expected && current.identity === expected.identity && current.text === expected.text) return;
        state.epoch += 1;
        state.pendingSnapshot = null;
        state.displayedSnapshot = null;
        output.hidden = true;
        const status = output.querySelector('[data-care-sitter-summary-status]');
        if (status) status.textContent = '';
        const manual = output.querySelector('[data-care-sitter-summary-manual]');
        if (manual) { manual.value = ''; manual.hidden = true; }
    }

    Object.defineProperty(window, 'WAFFLE_CARE_SITTER_SUMMARY', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze({ syncCard })
    });

    document.addEventListener('click', async event => {
        const button = event.target?.closest?.('[data-care-sitter-summary="copy"]');
        if (!button || !document.body || document.body.dataset.wafflePage !== 'directory') return;
        const controls = controlsFor(button);
        if (!controls.card || !controls.brief || !controls.output || !controls.status) return;
        if (locks.has(button)) return;
        const initial = snapshot(controls.card);
        if (!initial) {
            showStatus(controls, 'Sitter summary unavailable. Finish editing and confirm this saved care record first.', '', false);
            return;
        }
        const state = cardState(controls.card);
        locks.add(button);
        const requestEpoch = ++state.epoch;
        state.pending = true;
        state.pendingSnapshot = initial;
        try {
            const writeText = navigator.clipboard?.writeText;
            if (typeof writeText !== 'function') throw new Error('Clipboard unavailable');
            await writeText.call(navigator.clipboard, initial.text);
            const current = snapshot(controls.card);
            if (!controls.card.isConnected || state.epoch !== requestEpoch || current?.identity !== initial.identity || current?.text !== initial.text) return;
            state.displayedSnapshot = initial;
            showStatus(controls, 'Sitter summary copied.', initial.text, false);
        } catch (_) {
            const current = snapshot(controls.card);
            if (!controls.card.isConnected || state.epoch !== requestEpoch || current?.identity !== initial.identity || current?.text !== initial.text) return;
            state.displayedSnapshot = initial;
            showStatus(controls, 'Copy unavailable. Select the summary below and copy it manually.', initial.text, true);
        } finally {
            state.pending = false;
            state.pendingSnapshot = null;
            locks.delete(button);
        }
    });
}());
