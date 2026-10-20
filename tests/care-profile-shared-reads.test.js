const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const identityStart = source.indexOf('function getDirectoryProfileReadIdentity(card)');
const coordinatorStart = source.indexOf('// One canonical read per validated dog/stay identity.');
const coordinatorEnd = source.indexOf('function directoryProfileIdentityIsAmbiguous(card)', coordinatorStart);
const belongingsStart = source.indexOf('const directoryBelongingsReads = new Map()', coordinatorStart);
const belongingsEnd = source.indexOf('function directoryProfileIdentityIsAmbiguous(card)', belongingsStart);
assert(identityStart >= 0 && coordinatorStart > identityStart && coordinatorEnd > coordinatorStart);
const identityCode = source.slice(identityStart, coordinatorStart);
const coordinatorCode = source.slice(coordinatorStart, coordinatorEnd);
const belongingsCode = source.slice(belongingsStart, belongingsEnd);

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

function setupBelongings({ read } = {}) {
    const calls = [], cache = {};
    let clock = 0;
    const sandbox = {
        directoryBelongingsDetailCache: cache,
        DIRECTORY_PROFILE_FRESH_MS: 45000,
        DIRECTORY_PROFILE_READ_FAILURE_COOLDOWN_MS: 15000,
        directoryProfileReadNow: () => ++clock,
        getDirectoryProfileReadIdentity: card => ({ valid: true, stayKey: card.dataset.directoryStayKey, stayId: card.dataset.directoryStayId || '', dogId: card.dataset.directoryDogId || '', cacheKey: `${card.dataset.directoryStayId || ''}::${card.dataset.directoryDogId || ''}::${card.dataset.directoryStayKey}`, hasStableIds: !!card.dataset.directoryStayId }),
        directoryProfileIdentityIsAmbiguous: () => false,
        queryAppsScriptSWR: (payload, options) => {
            calls.push({ payload, options });
            const [stayId, dogId] = String(options.cacheKey).replace('directory:belongings:', '').split('::');
            return read(payload, options).then(result => {
                const record = result?.data?.record;
                if (record && !record.identity && !record.identityResolution) { record.identity = { stayKey: record.stayKey, stayId, dogId }; record.identityResolution = { status: 'resolved', identity: record.identity }; }
                return result;
            });
        },
        window: {}, navigator: { onLine: true }
    };
    sandbox.advance = amount => { clock += amount; };
    vm.runInNewContext(belongingsCode + '\nthis.api = window.WAFFLE_CARE_BELONGINGS_READS;', sandbox);
    const card = (stayId, dogId) => ({ dataset: { directoryStayKey: 'same-name|2026-10-10|2026-10-12', directoryStayId: stayId, directoryDogId: dogId } });
    return { sandbox, cache, calls, card, api: sandbox.api };
}

test('shared belongings reader coalesces cold consumers and separates full identities', async () => {
    let resolve;
    const h = setupBelongings({ read: payload => new Promise(r => { resolve = () => r({ data: { record: { stayKey: payload.stayKey, items: { blanket: true } } } }); }) });
    const seenA = [], seenB = [];
    const a = h.api.read(h.card('stay-a', 'dog-a'), { onFresh: ({ record }) => seenA.push(record) });
    const b = h.api.read(h.card('stay-a', 'dog-a'), { onFresh: ({ record }) => seenB.push(record) });
    await new Promise(r => setImmediate(r));
    assert.equal(h.calls.length, 1);
    resolve(); await Promise.all([a, b]);
    assert.equal(seenA.length, 1); assert.equal(seenB.length, 1);
    assert.deepEqual(Object.keys(h.calls[0].payload).sort(), ['action', 'stayKey']);
    const other = h.api.read(h.card('stay-b', 'dog-b'));
    await new Promise(r => setImmediate(r));
    assert.equal(h.calls.length, 2);
    resolve(); await other;
    assert.equal(h.calls[0].options.cacheKey, 'directory:belongings:stay-a::dog-a::same-name|2026-10-10|2026-10-12');
});

test('belongings rejects a stable-ID response that only matches the colliding legacy stay key', async () => {
    const h = setupBelongings({ read: payload => Promise.resolve({ data: { record: {
        stayKey: payload.stayKey,
        identityResolution: { status: 'resolved', identity: { stayKey: payload.stayKey, stayId: 'other-stay', dogId: 'other-dog' } }
    } } }) });
    await assert.rejects(h.api.read(h.card('stay-a', 'dog-a')), /identity could not be verified/);
    assert.equal(Object.keys(h.cache).length, 0);
});

test('belongings cache refresh is immediate, bounded, offline-safe, and invalidation defeats an old response', async () => {
    let resolve;
    const h = setupBelongings({ read: payload => new Promise(r => { resolve = value => r({ data: { record: { stayKey: payload.stayKey, items: { version: value } } } }); }) });
    const card = h.card('stay-a', 'dog-a'), key = 'stay-a::dog-a::same-name|2026-10-10|2026-10-12';
    const first = h.api.read(card); await new Promise(r => setImmediate(r)); resolve('old'); await first;
    h.sandbox.advance(50000);
    const warm = await h.api.read(card); assert.equal(warm.cachedOnly, true); assert.equal(warm.data.record.items.version, 'old');
    await new Promise(r => setImmediate(r)); assert.equal(h.calls.length, 2);
    h.api.invalidate(card); resolve('stale'); await new Promise(r => setImmediate(r));
    assert.equal(h.cache[key], undefined);
    const savedIdentity = { stayKey: card.dataset.directoryStayKey, stayId: 'stay-a', dogId: 'dog-a' };
    h.cache[key] = { stayKey: card.dataset.directoryStayKey, identity: savedIdentity, identityResolution: { status: 'resolved', identity: savedIdentity }, items: { version: 'saved' } };
    h.sandbox.navigator.onLine = false;
    const offline = await h.api.read(card); assert.equal(offline.offlineFallback, true); assert.equal(h.calls.length, 2);
});

test('a forced belongings read after mutation waits for the older request then fetches the saved version', async () => {
    const resolvers = [];
    const h = setupBelongings({ read: payload => new Promise(resolve => resolvers.push(value => resolve({ data: { record: { stayKey: payload.stayKey, items: { version: value } } } }))) });
    const card = h.card('stay-a', 'dog-a');
    const oldRead = h.api.read(card);
    await new Promise(resolve => setImmediate(resolve));
    h.api.invalidate(card);
    const forced = h.api.read(card, { force: true });
    resolvers[0]('before save'); await oldRead;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.calls.length, 2);
    resolvers[1]('after save');
    const result = await forced;
    assert.equal(result.data.record.items.version, 'after save');
    assert.equal(h.cache['stay-a::dog-a::same-name|2026-10-10|2026-10-12'].items.version, 'after save');
});

test('superseded belongings response does not reach consumers or replace the newer saved cache', async () => {
    let resolve;
    const h = setupBelongings({ read: payload => new Promise(r => { resolve = () => r({ data: { record: { stayKey: payload.stayKey, items: { version: 'late old response' } } } }); }) });
    const card = h.card('stay-a', 'dog-a'), seen = [];
    const pending = h.api.read(card, { onFresh: value => seen.push(value.record) });
    await new Promise(r => setImmediate(r));
    h.api.invalidate(card);
    resolve();
    const result = await pending;
    assert.equal(result.superseded, true);
    assert.equal(result.data.record, null);
    assert.equal(seen.length, 0);
    assert.equal(h.cache['stay-a::dog-a::same-name|2026-10-10|2026-10-12'], undefined);
});

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
    const warmResult = await h.sandbox.read(h.card(ids[0]), { onCached: response => firstSeen.push(response.record) });
    assert.equal(firstSeen[0], cached);
    assert.equal(warmResult.refreshing, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.calls.length, 1);
    rejectRead = true;
    await assert.rejects(h.sandbox.read(h.card(ids[0]), { force: true }), /timeout/);
    assert.equal(h.calls[1].options.maxAttempts, 1);
    assert.equal(h.calls[1].options.timeoutMs, 15000);
    rejectRead = false;
    await h.sandbox.read(h.card(ids[0]), { force: true });
    assert.equal(h.calls.length, 3);
});

test('warm profile refresh renders verified fresh response after the immediate cache', async () => {
    const cached = fresh({ stayKey: 'same-name|2026-10-10|2026-10-12', stayId: ids[0] });
    const h = setup({ cache: { [`stable:${ids[0]}::::same-name|2026-10-10|2026-10-12`]: cached }, read: payload => new Promise(resolve => {
        h.resolve = () => resolve({ data: { record: { ...fresh(payload), intakeAttributes: { allergy: 'From server' } } }, offlineFallback: false, unchanged: false });
    }) });
    const seen = [], immediate = await h.sandbox.read(h.card(ids[0]), { onCached: (response, meta) => seen.push({ record: response.record, fresh: meta?.fresh === true }) });
    assert.equal(immediate.refreshing, true); assert.equal(seen[0].record, cached); assert.equal(seen[0].fresh, false);
    await new Promise(resolve => setImmediate(resolve)); assert.equal(h.calls.length, 1);
    h.resolve(); await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
    assert.equal(seen.at(-1).record.intakeAttributes.allergy, 'From server');
    assert.equal(seen.at(-1).fresh, true);
    assert.equal(h.sandbox.directoryProfileDetailCache[`stable:${ids[0]}::::same-name|2026-10-10|2026-10-12`].intakeAttributes.allergy, 'From server');
});

test('warm cache refresh failure keeps its cooldown across consecutive warm reads', async () => {
    const cached = fresh({ stayKey: 'same-name|2026-10-10|2026-10-12', stayId: ids[0] });
    const h = setup({ cache: { [`stable:${ids[0]}::::same-name|2026-10-10|2026-10-12`]: cached }, read: async () => { throw new Error('timeout'); } });
    const first = await h.sandbox.read(h.card(ids[0]));
    assert.equal(first.refreshing, true);
    await new Promise(resolve => setImmediate(resolve));
    const second = await h.sandbox.read(h.card(ids[0]));
    const third = await h.sandbox.read(h.card(ids[0]));
    assert.equal(second.refreshFailed, true);
    assert.equal(third.refreshFailed, true);
    assert.equal(h.calls.length, 1);
});

test('stale-while-revalidate failure is reported without treating the fallback as fresh', async () => {
    const cached = fresh({ stayKey: 'same-name|2026-10-10|2026-10-12', stayId: ids[0] });
    const h = setup({ cache: { [`stable:${ids[0]}::::same-name|2026-10-10|2026-10-12`]: cached }, read: async () => ({ data: { record: cached }, offlineFallback: true, error: new Error('network unavailable') }) });
    const errors = [];
    const warm = await h.sandbox.read(h.card(ids[0]), { onRefreshError: error => errors.push(error.message) });
    assert.equal(warm.refreshing, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(errors, ['network unavailable']);
    assert.equal((await h.sandbox.read(h.card(ids[0]))).refreshFailed, true);
    assert.equal(h.calls.length, 1);
});

test('a profile response started before save invalidation cannot update cache or consumers', async () => {
    let resolve;
    const h = setup({ read: payload => new Promise(r => { resolve = () => r({ data: { record: fresh(payload) }, offlineFallback: false, unchanged: false }); }) });
    const card = h.card(ids[0]), seen = [];
    const pending = h.sandbox.read(card, { force: true, onCached: response => seen.push(response.record) });
    await new Promise(r => setImmediate(r));
    h.sandbox.window.WAFFLE_CARE_PROFILE_INVALIDATE(card);
    resolve(); const result = await pending;
    assert.equal(result.superseded, true); assert.equal(result.data.record, null);
    assert.equal(seen.length, 0); assert.equal(Object.keys(h.sandbox.directoryProfileDetailCache).length, 0);
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

test('timing events expose only opaque IDs, fixed timing fields, cache status, and outcome', async () => {
    const h = setup({ read: async payload => ({ data: { record: fresh(payload) }, offlineFallback: false, unchanged: false }) });
    await h.sandbox.read(h.card(ids[0]));
    for (const event of h.events) {
        assert.equal(event.type, 'waffle:care-profile-read');
        assert.deepEqual(Object.keys(event.detail).sort(), ['cacheStatus', 'elapsedMs', 'outcome', 'phase', 'requestId', 'serverCacheState', 'serverMs', 'transportMs'].sort());
        assert.equal(typeof event.detail.requestId, 'string');
        assert.equal(event.detail.serverMs, null);
        assert.equal(event.detail.serverCacheState, null);
        assert.ok(!JSON.stringify(event.detail).includes('same-name'));
    }
});
