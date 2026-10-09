const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const identityStart = source.indexOf('function getDirectoryProfileReadIdentity(card)');
const coordinatorStart = source.indexOf('// One canonical read per validated dog/stay identity.');
const coordinatorEnd = source.indexOf('function directoryProfileIdentityIsAmbiguous(card)', coordinatorStart);
assert(identityStart >= 0 && coordinatorStart > identityStart && coordinatorEnd > coordinatorStart);
const identityCode = source.slice(identityStart, coordinatorStart);
const coordinatorCode = source.slice(coordinatorStart, coordinatorEnd);

function setup({ cache = {}, read } = {}) {
    const calls = [];
    const events = [];
    const sandbox = {
        directoryProfileDetailCache: cache,
        directoryProfileIdentityIsAmbiguous: () => false,
        directoryProfileRecordMatchesIdentity: null,
        performance: { now: (() => { let n = 0; return () => ++n; })() },
        CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } },
        window: { dispatchEvent: event => events.push(event) },
        queryAppsScriptSWR: async (payload, options) => {
            calls.push({ payload, options });
            return read ? read(payload, options, calls) : { data: { record: {} }, offlineFallback: false, unchanged: false };
        }
    };
    vm.runInNewContext(`${identityCode}\n${coordinatorCode}\nthis.read = window.WAFFLE_CARE_PROFILE_READS.read; this.matches = directoryProfileRecordMatchesIdentity;`, sandbox);
    const card = (stayId, dogId = '', stayKey = 'same-name|2026-10-10|2026-10-12') => ({ dataset: { directoryStayKey: stayKey, ...(stayId ? { directoryStayId: stayId } : {}), ...(dogId ? { directoryDogId: dogId } : {}) } });
    return { sandbox, calls, events, card };
}

const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];

test('coalesces concurrent consumers by validated full identity and fans cached essentials to both', async () => {
    let resolveRead;
    const h = setup({ read: (payload, options) => new Promise(resolve => { resolveRead = () => resolve({ data: { record: fresh(payload) }, offlineFallback: false, unchanged: false }); }) });
    const seenA = [];
    const seenB = [];
    const a = h.sandbox.read(h.card(ids[0]), { onCached: response => seenA.push(response.record) });
    const b = h.sandbox.read(h.card(ids[0]), { onCached: response => seenB.push(response.record) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.calls.length, 1);
    const saved = fresh(h.calls[0].payload);
    h.calls[0].options.onCached({ record: saved });
    resolveRead();
    await Promise.all([a, b]);
    assert.equal(seenA[0], saved);
    assert.equal(seenB[0], saved);
    assert.ok(h.events.some(event => event.detail.phase === 'joined'));
});

test('conflicting stable identities do not share requests even with matching name and dates', async () => {
    const h = setup({ read: async payload => ({ data: { record: fresh(payload) }, offlineFallback: false, unchanged: false }) });
    await Promise.all([h.sandbox.read(h.card(ids[0])), h.sandbox.read(h.card(ids[1]))]);
    assert.equal(h.calls.length, 2);
    assert.notEqual(h.calls[0].options.cacheKey, h.calls[1].options.cacheKey);
});

test('verified memory cache is applied immediately and force bypasses it for recovery', async () => {
    const cached = fresh({ stayKey: 'same-name|2026-10-10|2026-10-12', stayId: ids[0] });
    let rejectRead = false;
    const h = setup({ cache: { [`stable:${ids[0]}::::same-name|2026-10-10|2026-10-12`]: cached }, read: async (payload, options) => {
        if (rejectRead) throw new Error('timeout');
        return { data: { record: fresh(payload) }, offlineFallback: false, unchanged: false };
    } });
    const firstSeen = [];
    await h.sandbox.read(h.card(ids[0]), { onCached: response => firstSeen.push(response.record) });
    assert.equal(firstSeen[0], cached);
    assert.equal((await h.sandbox.read(h.card(ids[0]))).cachedOnly, true);
    assert.equal(h.calls.length, 0);
    rejectRead = true;
    await assert.rejects(h.sandbox.read(h.card(ids[0]), { force: true }), /timeout/);
    assert.equal(h.calls[0].options.maxAttempts, 1);
    assert.equal(h.calls[0].options.timeoutMs, 15000);
    rejectRead = false;
    await h.sandbox.read(h.card(ids[0]), { force: true });
    assert.equal(h.calls.length, 2);
});

test('force callers queue one fresh read after a pending result settles', async () => {
    const resolvers = [];
    const h = setup({ read: payload => new Promise(resolve => resolvers.push(value => resolve({
        data: { record: { ...fresh(payload), intakeAttributes: { allergy: value } } },
        offlineFallback: false,
        unchanged: false
    }))) });
    const original = h.sandbox.read(h.card(ids[0]));
    await new Promise(resolve => setImmediate(resolve));
    const forcedA = h.sandbox.read(h.card(ids[0]), { force: true });
    const forcedB = h.sandbox.read(h.card(ids[0]), { force: true });
    assert.equal(h.calls.length, 1);
    resolvers[0]('Before mutation');
    await original;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.calls.length, 2);
    resolvers[1]('After mutation');
    const [resultA, resultB] = await Promise.all([forcedA, forcedB]);
    assert.equal(resultA.data.record.intakeAttributes.allergy, 'After mutation');
    assert.equal(resultB.data.record.intakeAttributes.allergy, 'After mutation');
    assert.equal(h.calls.length, 2);
});
test('shares a recent failure across sequential non-force reads and force retries once', async () => {
    let fail = true;
    const h = setup({ read: async payload => {
        if (fail) throw new Error('timeout');
        return { data: { record: fresh(payload) }, offlineFallback: false, unchanged: false };
    } });
    await assert.rejects(h.sandbox.read(h.card(ids[0])), /timeout/);
    await assert.rejects(h.sandbox.read(h.card(ids[0])), /timeout/);
    assert.equal(h.calls.length, 1);
    fail = false;
    const result = await h.sandbox.read(h.card(ids[0]), { force: true });
    assert.equal(result.data.record.intakeAttributes.allergy, 'Verified');
    assert.equal(h.calls.length, 2);
    await h.sandbox.read(h.card(ids[0]));
    assert.equal(h.calls.length, 2);
});
test('verified memory remains explicitly saved while offline and late joiners receive cache', async () => {
    const cached = fresh({ stayKey: 'same-name|2026-10-10|2026-10-12', stayId: ids[0] });
    const h = setup({ cache: { [`stable:${ids[0]}::::same-name|2026-10-10|2026-10-12`]: cached }, read: (payload, options) => new Promise(resolve => { h.resolve = () => resolve({ data: { record: fresh(payload) }, offlineFallback: false, unchanged: false }); }) });
    h.sandbox.navigator = { onLine: false };
    const offlineResult = await h.sandbox.read(h.card(ids[0]));
    assert.equal(offlineResult.cachedOnly, true);
    assert.equal(offlineResult.offlineFallback, true);
    assert.ok(h.events.some(event => event.detail.phase === 'request-end' && event.detail.outcome === 'offline'));
    assert.equal(h.calls.length, 0);

    const other = setup({ read: (payload, options) => new Promise(resolve => { other.resolve = () => resolve({ data: { record: fresh(payload) }, offlineFallback: false, unchanged: false }); }) });
    const firstSeen = [];
    const joinedSeen = [];
    const first = other.sandbox.read(other.card(ids[0]), { force: true, onCached: response => firstSeen.push(response.record) });
    await new Promise(resolve => setImmediate(resolve));
    const saved = fresh(other.calls[0].payload);
    other.calls[0].options.onCached({ record: saved });
    const joined = other.sandbox.read(other.card(ids[0]), { onCached: response => joinedSeen.push(response.record) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(firstSeen[0], saved);
    assert.equal(joinedSeen[0], saved);
    other.resolve();
    await Promise.all([first, joined]);
});
test('validates network results before sharing and caches only matching identity records', async () => {
    const h = setup({ read: async payload => ({ data: { record: fresh({ ...payload, stayId: ids[1] }) }, offlineFallback: false, unchanged: false }) });
    const result = await h.sandbox.read(h.card(ids[0]), { force: true });
    assert.equal(result.identityMismatch, true);
    assert.equal(result.data.record, null);
    assert.equal(Object.keys(h.sandbox.directoryProfileDetailCache).length, 0);
    assert.equal(h.sandbox.window.WAFFLE_CARE_PROFILE_READS.matches(h.card(ids[0]), fresh({ stayKey: 'same-name|2026-10-10|2026-10-12', stayId: ids[1] })), false);
});
function fresh(payload) {
    return {
        stayKey: payload.stayKey,
        identity: { stayKey: payload.stayKey, stayId: payload.stayId || '', dogId: payload.dogId || '' },
        resolution: { status: 'resolved', method: 'stay-id-unique-legacy-key' },
        intakeAttributes: { allergy: 'Verified' }
    };
}

test('timing events expose only opaque IDs, phase, duration, cache status, and outcome', async () => {
    const h = setup({ read: async payload => ({ data: { record: fresh(payload) }, offlineFallback: false, unchanged: false }) });
    await h.sandbox.read(h.card(ids[0]));
    for (const event of h.events) {
        assert.equal(event.type, 'waffle:care-profile-read');
        assert.deepEqual(Object.keys(event.detail).sort(), ['cacheStatus', 'elapsedMs', 'outcome', 'phase', 'requestId'].sort());
        assert.equal(typeof event.detail.requestId, 'string');
        assert.ok(!JSON.stringify(event.detail).includes('same-name'));
    }
});