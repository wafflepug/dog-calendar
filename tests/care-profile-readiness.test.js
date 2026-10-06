const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const helperStart = source.indexOf('function setDirectoryProfileReadStatus');
const loadStart = source.indexOf('async function loadDirectoryProfileDetail');
const loadEnd = source.indexOf('async function loadDirectoryBelongingsDetail', loadStart);
assert(helperStart >= 0 && loadStart > helperStart && loadEnd > loadStart);
const code = source.slice(helperStart, loadStart) + source.slice(loadStart, loadEnd);

function harness({ cache = {}, response, swrError = null, offlineFallback = false, online = true, delayMs = 0 } = {}) {
    const calls = [];
    const rendered = [];
    const host = { parentNode: { insertBefore() {} }, setAttribute(name, value) { this[name] = value; } };
    const retry = { addEventListener(type, handler) { this.handler = handler; } };
    const status = {
        dataset: {},
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name]; },
        querySelector(selector) { return selector.includes('retry') ? retry : null; },
        addEventListener() {}
    };
    const details = {
        dataset: {},
        querySelector(selector) {
            if (selector.includes('read-status')) return this.status || null;
            if (selector.includes('intake-attributes')) return host;
            return null;
        },
        prepend() {}
    };
    const sandbox = {
        console: { error() {}, warn() {}, log() {} },
        navigator: { onLine: online },
        document: { createElement() { details.status = status; return status; } },
        directoryProfileDetailCache: cache,
        escapeDashboardHtml: value => String(value || ''),
        renderDirectoryIntakeAttributes: (card, record) => rendered.push(record),
        reconcileDirectoryDigitalIntakeFromProfile() {},
        setDirectoryDetailLoading() {},
        setDirectoryDetailError: (...args) => { calls.push({ type: 'generic-error', options: args[3] }); },
        queryAppsScriptSWR: async (payload, options) => {
            calls.push({ payload, options });
            if (options.onCached && cache.cachedResponse) options.onCached(cache.cachedResponse);
            if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
            if (swrError) throw swrError;
            return { unchanged: Boolean(cache.cachedResponse), offlineFallback, data: response };
        }
    };
    vm.runInNewContext(`${code}\nthis.load = loadDirectoryProfileDetail;`, sandbox);
    return { sandbox, details, status, calls, rendered, card: { dataset: { stayKey: 'milo|2026-09-20|2026-09-22' } } };
}

test('cached profile remains visible when refresh fails and exposes scoped retry', async () => {
    const cached = { stayKey: 'milo|2026-09-20|2026-09-22', intakeAttributes: { allergy: 'Chicken' } };
    const h = harness({ cache: { cachedResponse: { record: cached } }, swrError: new Error('timeout'), delayMs: 25 });
    await h.sandbox.load(h.card, h.details, { force: true });
    assert.equal(h.rendered.at(-1), cached);
    assert.equal(h.details.dataset.profileReadState, 'error');
    assert.equal(h.status.dataset.state, 'error');
    assert.equal(h.status.getAttribute?.('role') || 'status', 'status');
    assert.equal(h.calls[0].options.maxAttempts, 1);
    assert.equal(h.calls[0].options.timeoutMs, 15000);
    assert.equal(h.calls[0].options.lateCallbackGraceMs, 5 * 60 * 1000);
    assert.equal(h.calls.filter(call => call.type === 'generic-error').length, 0);
});

test('cached profile is visible while the refresh is still pending', async () => {
    const cached = { stayKey: 'milo|2026-09-20|2026-09-22', intakeAttributes: { allergy: 'Chicken' } };
    const h = harness({ cache: { cachedResponse: { record: cached } }, swrError: new Error('timeout'), delayMs: 25 });
    const pending = h.sandbox.load(h.card, h.details, { force: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.rendered.at(-1), cached);
    assert.equal(h.status.dataset.state, 'refreshing');
    assert.equal(h.details.querySelector('intake-attributes')?.['aria-busy'], 'true');
    await pending;
    assert.equal(h.status.dataset.state, 'error');
});

test('offline cached profile is labelled as saved while refresh is unavailable', async () => {
    const cached = { stayKey: 'milo|2026-09-20|2026-09-22', intakeAttributes: { allergy: 'Chicken' } };
    const h = harness({ cache: { cachedResponse: { record: cached } }, offlineFallback: true, online: false });
    await h.sandbox.load(h.card, h.details, {});
    assert.equal(h.rendered.at(-1), cached);
    assert.equal(h.status.dataset.state, 'error');
    assert.match(h.status.innerHTML, /offline refresh unavailable/);
});

test('cold successful profile read reports fresh details', async () => {
    const fresh = { stayKey: 'milo|2026-09-20|2026-09-22', intakeAttributes: { allergy: 'None' } };
    const h = harness({ response: { record: fresh } });
    await h.sandbox.load(h.card, h.details, {});
    assert.equal(h.rendered.at(-1), fresh);
    assert.equal(h.status.dataset.state, 'fresh');
    assert.equal(h.details.querySelector('intake-attributes')?.['aria-busy'], 'false');
});

test('offline fallback without saved details is never labelled fresh', async () => {
    const h = harness({
        response: { record: { stayKey: 'milo|2026-09-20|2026-09-22', intakeAttributes: {} } },
        offlineFallback: true
    });
    await h.sandbox.load(h.card, h.details, {});
    assert.equal(h.status.dataset.state, 'error');
    assert.notEqual(h.status.dataset.state, 'fresh');
});

test('cold failed profile read exposes a scoped retry state', async () => {
    const h = harness({ swrError: new Error('timeout') });
    await h.sandbox.load(h.card, h.details, {});
    assert.equal(h.status.dataset.state, 'error');
    assert.match(h.status.innerHTML, /Unable to load care details/);
    assert.equal(h.calls.filter(call => call.type === 'generic-error').length, 1);
    assert.equal(h.calls.find(call => call.type === 'generic-error').options.includeRetry, false);
});

test('cached early return does not overwrite a settled fresh or error state', async () => {
    const cached = { stayKey: 'milo|2026-09-20|2026-09-22', intakeAttributes: { allergy: 'Chicken' } };
    const h = harness({ cache: { [cached.stayKey]: cached } });
    h.details.status = h.status;
    h.details.dataset.profileReadState = 'fresh';
    h.sandbox.directoryProfileDetailCache[cached.stayKey] = cached;
    await h.sandbox.load(h.card, h.details, {});
    assert.equal(h.details.dataset.profileReadState, 'fresh');
});

test('late response for a replaced selected profile does not render into the old card', async () => {
    const fresh = { stayKey: 'milo|2026-09-20|2026-09-22', intakeAttributes: { allergy: 'Chicken' } };
    const h = harness({ response: { record: fresh }, delayMs: 25 });
    h.sandbox.directorySelectedProfileStayKey = h.card.dataset.stayKey;
    const pending = h.sandbox.load(h.card, h.details, { force: true });
    h.sandbox.directorySelectedProfileStayKey = 'other|2026-09-21|2026-09-23';
    await pending;
    assert.equal(h.rendered.length, 0);
    assert.equal(h.details.dataset.profileReadState, 'loading');
});

test('late response does not render after the card is rebound to another stay key', async () => {
    const fresh = { stayKey: 'milo|2026-09-20|2026-09-22', intakeAttributes: { allergy: 'Chicken' } };
    const h = harness({ response: { record: fresh }, delayMs: 25 });
    h.card.dataset.directoryStayKey = h.card.dataset.stayKey;
    const pending = h.sandbox.load(h.card, h.details, { force: true });
    h.card.dataset.directoryStayKey = 'other|2026-09-21|2026-09-23';
    await pending;
    assert.equal(h.rendered.length, 0);
});

test('stable-ID collision never consumes a legacy cache or metadata-free backend response', async () => {
    const cached = { intakeAttributes: { medicationInstructions: 'Must not cross between dogs' } };
    const key = 'milo|2026-09-20|2026-09-22';
    const h = harness({ cache: { [key]: cached, cachedResponse: { record: cached } }, response: { record: { stayKey: key, intakeAttributes: { allergy: 'Legacy backend response' } } } });
    const strip = { innerHTML: 'No active care alerts', classList: { remove() {} } };
    h.card.querySelector = selector => selector === '.directory-care-strip' ? strip : null;
    h.card.dataset.directoryStayKey = h.card.dataset.stayKey;
    h.card.dataset.directoryStayId = '00000000-0000-4000-8000-000000000001';
    const other = { dataset: { directoryStayKey: h.card.dataset.stayKey, directoryStayId: '00000000-0000-4000-8000-000000000002' } };
    h.sandbox.document.querySelectorAll = () => [h.card, other];
    await h.sandbox.load(h.card, h.details, {});
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].payload.stayId, h.card.dataset.directoryStayId);
    assert.equal(h.rendered.length, 0);
    assert.equal(h.details.dataset.profileReadState, 'identity-conflict');
    assert.match(h.status.innerHTML, /review the care record identity/);
    assert.doesNotMatch(h.status.innerHTML, /data-retry-directory-profile-read/);
    assert.match(strip.innerHTML, /identity needs review/);
    assert.doesNotMatch(strip.innerHTML, /No active care alerts/);
    assert.equal(h.details.querySelector('intake-attributes').hidden, true);
    assert.equal(h.sandbox.directoryProfileDetailCache[h.card.dataset.stayKey], cached);
});

test('resolved stable response uses its identity cache and never populates legacy safety cache', async () => {
    const key = 'milo|2026-09-20|2026-09-22';
    const stayId = '00000000-0000-4000-8000-000000000001';
    const fresh = { stayKey: key, identity: { stayKey: key, stayId, dogId: '' }, resolution: { status: 'resolved', method: 'stay-id-unique-legacy-key' }, intakeAttributes: { allergy: 'Chicken' }, riskFlags: { foodAllergy: true } };
    const h = harness({ response: { record: fresh } });
    h.card.dataset.directoryStayId = stayId;
    await h.sandbox.load(h.card, h.details, {});
    const stableKey = `stable:${stayId}::::${key}`;
    assert.equal(h.calls[0].payload.stayId, stayId);
    assert.equal(h.calls[0].options.cacheKey, `directory:profile:${stableKey}`);
    assert.equal(h.sandbox.directoryProfileDetailCache[stableKey], fresh);
    assert.equal(h.sandbox.directoryProfileDetailCache[key], undefined);
    assert.equal(h.sandbox.careRiskRecordsCache?.[key], undefined);
    assert.equal(h.rendered.at(-1), fresh);
});

test('missing profile is explicit, clears old sensitive details, and leaves empty fields editable', async () => {
    const key = 'milo|2026-09-20|2026-09-22';
    const missing = { stayKey: key, identity: { stayKey: key, stayId: '', dogId: '' }, resolution: { status: 'not_found', method: 'missing-record' }, intakeAttributes: {} };
    const h = harness({ response: { record: missing }, cache: { [key]: { stayKey: key, intakeAttributes: { allergy: 'Old value' } } } });
    await h.sandbox.load(h.card, h.details, { force: true });
    assert.equal(h.details.dataset.profileReadState, 'not-found');
    assert.equal(h.details.querySelector('intake-attributes').hidden, false);
    assert.equal(h.sandbox.directoryProfileDetailCache[key], undefined);
    assert.equal(Object.keys(h.rendered.at(-1).intakeAttributes).length, 0);
    assert.equal(h.card.dataset.profileIdentityBlockedReason, 'missing');
    assert.doesNotMatch(h.status.innerHTML, /review the care record identity/);
});

test('late stable response cannot render after switching to another dog with the same stay key', async () => {
    const key = 'milo|2026-09-20|2026-09-22';
    const originalStayId = '00000000-0000-4000-8000-000000000001';
    const nextStayId = '00000000-0000-4000-8000-000000000002';
    const fresh = { stayKey: key, identity: { stayKey: key, stayId: originalStayId, dogId: '' }, resolution: { status: 'resolved', method: 'stay-id-unique-legacy-key' }, intakeAttributes: { allergy: 'Old dog only' } };
    const h = harness({ response: { record: fresh }, delayMs: 25 });
    h.card.dataset.directoryStayId = originalStayId;
    h.sandbox.directorySelectedProfileStayKey = key;
    const pending = h.sandbox.load(h.card, h.details, { force: true });
    h.card.dataset.directoryStayId = nextStayId;
    await pending;
    assert.equal(h.rendered.length, 0);
    assert.equal(h.details.dataset.profileReadState, 'loading');
    assert.equal(h.sandbox.directoryProfileDetailCache[`stable:${originalStayId}::::${key}`], fresh);
});

test('resolved scoped response remains bound to its dog when a same-key card appears during the read', async () => {
    const key = 'milo|2026-09-20|2026-09-22';
    const stayId = '00000000-0000-4000-8000-000000000001';
    const fresh = { stayKey: key, identity: { stayKey: key, stayId, dogId: '' }, resolution: { status: 'resolved', method: 'stay-id-unique-legacy-key' }, intakeAttributes: { allergy: 'Chicken' } };
    const h = harness({ response: { record: fresh }, delayMs: 25 });
    h.card.dataset.directoryStayKey = key;
    h.card.dataset.directoryStayId = stayId;
    let cards = [h.card];
    h.sandbox.document.querySelectorAll = () => cards;
    const pending = h.sandbox.load(h.card, h.details, { force: true });
    cards = [h.card, { dataset: { directoryStayKey: key, directoryStayId: '00000000-0000-4000-8000-000000000002' } }];
    await pending;
    assert.equal(h.rendered.at(-1), fresh);
    assert.equal(h.sandbox.directoryProfileDetailCache[`stable:${stayId}::::${key}`], fresh);
    assert.equal(h.details.dataset.profileReadState, 'fresh');
});


test('switching identity starts a new read and an old unresolved response cannot change its loading state', async () => {
    const h = harness();
    const a = '00000000-0000-4000-8000-000000000001';
    const b = '00000000-0000-4000-8000-000000000002';
    const responses = [];
    h.sandbox.queryAppsScriptSWR = () => new Promise(resolve => responses.push(resolve));
    h.card.dataset.directoryStayId = a;
    const first = h.sandbox.load(h.card, h.details, { force: true });
    h.card.dataset.directoryStayId = b;
    const second = h.sandbox.load(h.card, h.details, { force: true });
    assert.equal(responses.length, 2);
    responses[0]({ data: { record: { resolution: { status: 'unresolved' } } } });
    await first;
    assert.equal(h.details.dataset.detailLoading, 'true');
    assert.equal(h.details.dataset.profileReadState, 'loading');
    assert.equal(h.card.dataset.profileIdentityBlocked, undefined);
    const record = { stayKey: h.card.dataset.stayKey, identity: { stayKey: h.card.dataset.stayKey, stayId: b, dogId: '' }, resolution: { status: 'resolved', method: 'stay-id-unique-legacy-key' }, intakeAttributes: { allergy: 'Second dog only' } };
    responses[1]({ data: { record } });
    await second;
    assert.equal(h.rendered.at(-1), record);
    assert.equal(h.details.dataset.detailLoading, 'false');
});

test('an older read cannot replace the newest cache when returning to the same identity', async () => {
    const h = harness();
    const a = '00000000-0000-4000-8000-000000000001';
    const b = '00000000-0000-4000-8000-000000000002';
    const responses = [];
    h.sandbox.queryAppsScriptSWR = () => new Promise(resolve => responses.push(resolve));
    const makeRecord = (id, value) => ({ stayKey: h.card.dataset.stayKey, identity: { stayKey: h.card.dataset.stayKey, stayId: id, dogId: '' }, resolution: { status: 'resolved', method: 'stay-id-unique-legacy-key' }, intakeAttributes: { allergy: value } });
    h.card.dataset.directoryStayId = a;
    const first = h.sandbox.load(h.card, h.details, { force: true });
    h.card.dataset.directoryStayId = b;
    const middle = h.sandbox.load(h.card, h.details, { force: true });
    h.card.dataset.directoryStayId = a;
    const latest = h.sandbox.load(h.card, h.details, { force: true });
    assert.equal(responses.length, 3);
    const newest = makeRecord(a, 'Newest value');
    responses[2]({ data: { record: newest } });
    await latest;
    responses[0]({ data: { record: makeRecord(a, 'Outdated value') } });
    responses[1]({ data: { record: makeRecord(b, 'Other dog') } });
    await Promise.all([first, middle]);
    assert.equal(h.rendered.at(-1), newest);
    assert.equal(h.sandbox.directoryProfileDetailCache[`stable:${a}::::${h.card.dataset.stayKey}`], newest);
});
