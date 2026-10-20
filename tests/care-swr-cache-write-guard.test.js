const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const start = source.indexOf('async function queryAppsScriptSWR(');
const end = source.indexOf('async function invalidateWaffleClientCaches(', start);
assert(start >= 0 && end > start, 'queryAppsScriptSWR source boundaries exist');
const swrCode = source.slice(start, end);

function setup({ cached = null, request } = {}) {
    const puts = [];
    const sandbox = {
        WAFFLE_CACHE_MAX_STALE_MS: 1000,
        navigator: { onLine: true },
        window: {},
        getWaffleCachedResponse: async () => cached,
        putWaffleCachedResponse: async (key, payload) => { puts.push({ key, payload }); },
        queryAppsScript: request || (async () => ({ result: 'success' })),
        setWaffleConnectionStatus: () => {},
        console: { warn: () => {} }
    };
    vm.runInNewContext(`${swrCode}\nthis.readSWR = queryAppsScriptSWR;`, sandbox);
    return { sandbox, puts };
}

test('delayed network response after invalidation is not persisted, while matching response is', async () => {
    let valid = true;
    let resolve;
    const h = setup({ request: () => new Promise(r => { resolve = r; }) });
    const pending = h.sandbox.readSWR({ action: 'get_guest_profile' }, {
        cacheKey: 'directory:profile:stable-id',
        shouldCacheResponse: payload => valid && payload.record?.stayId === 'stay-a'
    });
    await new Promise(r => setImmediate(r));
    valid = false;
    resolve({ result: 'success', record: { stayId: 'stay-a' } });
    await pending;
    assert.equal(h.puts.length, 0);

    const matching = setup({ request: async () => ({ result: 'success', record: { stayId: 'stay-a' } }) });
    await matching.sandbox.readSWR({ action: 'get_guest_profile' }, {
        cacheKey: 'directory:profile:stable-id',
        shouldCacheResponse: payload => payload.record?.stayId === 'stay-a'
    });
    assert.equal(matching.puts.length, 1);
});

test('unchanged responses apply the same write guard to the cached payload', async () => {
    const cachedPayload = { result: 'success', record: { stayId: 'stay-a' } };
    const blocked = setup({ cached: { payload: cachedPayload, version: 'v1', variant: 'full', responseTag: 'tag-1' }, request: async () => ({ unchanged: true }) });
    await assert.rejects(blocked.sandbox.readSWR({ action: 'get_guest_profile' }, {
        cacheKey: 'directory:profile:stable-id',
        shouldCacheResponse: () => false
    }), /Conditional refresh returned no retained data/);
    assert.equal(blocked.puts.length, 0);

    const allowed = setup({ cached: { payload: cachedPayload, version: 'v1', variant: 'full', responseTag: 'tag-1' }, request: async () => ({ result: 'success', unchanged: true, version: 'v1', variant: 'full', responseTag: 'tag-1' }) });
    await allowed.sandbox.readSWR({ action: 'get_guest_profile' }, {
        cacheKey: 'directory:profile:stable-id',
        shouldCacheResponse: payload => payload.record?.stayId === 'stay-a'
    });
    assert.equal(allowed.puts.length, 1);
    assert.equal(allowed.puts[0].payload, cachedPayload);
});

test('conditional refresh is sent only with eligible retained data; missing retained data retries unconditionally', async () => {
    const calls = [];
    const valid = setup({ cached: { payload: { result: 'success' }, version: 'v1', variant: 'full', responseTag: 'tag-1' }, request: async payload => { calls.push(payload); return { result: 'success', unchanged: true, version: 'v1', variant: 'full', responseTag: 'tag-1', serverElapsedMs: 4, serverCacheState: 'unchanged' }; } });
    const result = await valid.sandbox.readSWR({ action: 'get_guest_directory' }, { cacheKey: 'directory:summary' });
    assert.equal(calls[0].knownVersion, 'v1');
    assert.equal(calls[0].knownResponseTag, 'tag-1');
    assert.equal(result.data.result, 'success');
    assert.equal(result.serverMs, 4);
    assert.equal(result.serverCacheState, 'unchanged');

    const retryCalls = [];
    const noRetainedData = setup({ request: async payload => { retryCalls.push(payload); return retryCalls.length === 1 ? { unchanged: true } : { result: 'success', records: [] }; } });
    const fetched = await noRetainedData.sandbox.readSWR({ action: 'get_guest_directory' }, { cacheKey: 'directory:summary' });
    assert.equal(retryCalls.length, 2);
    assert.equal('knownVersion' in retryCalls[1], false);
    assert.equal(fetched.data.result, 'success');
});

test('invalid retained identity is not returned after unchanged; retry failure stays an error', async () => {
    const calls = [];
    const h = setup({ cached: { payload: { result: 'success', id: 'other' }, version: 'v1', variant: 'full' }, request: async payload => { calls.push(payload); if (calls.length === 1) return { unchanged: true }; throw new Error('synthetic network failure'); } });
    await assert.rejects(h.sandbox.readSWR({ action: 'get_guest_profile' }, { cacheKey: 'directory:profile:expected', shouldCacheResponse: payload => payload.id === 'expected' }), /synthetic network failure/);
    assert.equal(calls.length, 2);
});

test('cache eligibility is rechecked after the network wait when a write retires the generation', async () => {
    let generation = 1;
    const calls = [];
    const h = setup({ cached: { payload: { result: 'success', generation: 1 }, version: 'v1', variant: 'full', responseTag: 'tag-1' }, request: async payload => { calls.push(payload); generation = 2; return calls.length === 1 ? { result: 'success', unchanged: true, version: 'v1', variant: 'full', responseTag: 'tag-1' } : { result: 'success', generation: 2, version: 'v1', variant: 'full', responseTag: 'tag-2' }; } });
    const result = await h.sandbox.readSWR({ action: 'get_guest_profile' }, { cacheKey: 'directory:profile:stable-id', shouldCacheResponse: payload => payload.generation === generation });
    assert.equal(calls.length, 2);
    assert.equal(result.data.generation, 2);
    assert.equal(h.puts.length, 1);
    assert.equal(h.puts[0].payload.generation, 2, 'only the refreshed generation may replace the retired cache entry');
});

test('identity-invalid cache never renders or serves as an offline fallback', async () => {
    const calls = [];
    const online = setup({ cached: { payload: { result: 'success', id: 'wrong' }, version: 'v1', variant: 'full', responseTag: 'tag-1' }, request: async payload => { calls.push(payload); throw new Error('network down'); } });
    let rendered = false;
    await assert.rejects(online.sandbox.readSWR({ action: 'get_guest_profile' }, { cacheKey: 'directory:profile:right', shouldCacheResponse: data => data.id === 'right', onCached: () => { rendered = true; } }), /network down/);
    assert.equal(rendered, false);
    online.sandbox.navigator.onLine = false;
    await assert.rejects(online.sandbox.readSWR({ action: 'get_guest_profile' }, { cacheKey: 'directory:profile:right', shouldCacheResponse: data => data.id === 'right', onCached: () => { rendered = true; } }), /Offline and no saved data/);
    assert.equal(rendered, false);
});

test('legacy full-payload backend responses remain usable without a response tag', async () => {
    const calls = [];
    const h = setup({ cached: { payload: { result: 'success', marker: 'saved' }, version: 'v1', variant: 'full' }, request: async payload => { calls.push(payload); return { result: 'success', marker: 'fresh' }; } });
    const result = await h.sandbox.readSWR({ action: 'get_guest_directory' }, { cacheKey: 'directory:summary' });
    assert.equal('knownResponseTag' in calls[0], false);
    assert.equal(result.data.marker, 'fresh');
    assert.equal(result.unchanged, false);
});

test('synthetic full response JSON is substantially larger than the conditional acknowledgement JSON', () => {
    const records = Array.from({ length: 40 }, (_, index) => ({ stayKey: `Stay ${index} | 2026-10-01 | 2026-10-10`, stayId: `id-${index}`, dogId: `dog-${index}`, dogName: `Dog ${index}`, breed: 'Pug', ownerName: `Owner ${index}`, phone: '0400000000', notes: 'Medication and feeding instructions '.repeat(4), status: 'confirmed' }));
    const full = { result: 'success', action: 'get_guest_directory', version: 'version-token', variant: 'variant-token', responseTag: 'opaque-response-tag', cacheHit: true, records };
    const unchanged = { result: 'success', action: 'get_guest_directory', version: 'version-token', variant: 'variant-token', responseTag: 'opaque-response-tag', unchanged: true, cacheHit: true, serverCacheState: 'unchanged', serverElapsedMs: 3 };
    const fullBytes = Buffer.byteLength(JSON.stringify(full), 'utf8');
    const unchangedBytes = Buffer.byteLength(JSON.stringify(unchanged), 'utf8');
    assert.ok(unchangedBytes < fullBytes);
    assert.ok(fullBytes / unchangedBytes > 50);
});

test('a stale response tag from another client forces an unconditional payload refresh', async () => {
    const calls = [];
    const h = setup({ cached: { payload: { result: 'success', marker: 'old' }, version: 'same-version', variant: 'full', responseTag: 'tag-old' }, request: async payload => {
        calls.push(payload);
        return calls.length === 1
            ? { unchanged: true, version: 'same-version', variant: 'full', responseTag: 'tag-new' }
            : { result: 'success', marker: 'fresh', version: 'same-version', variant: 'full', responseTag: 'tag-new' };
    } });
    const result = await h.sandbox.readSWR({ action: 'get_guest_directory' }, { cacheKey: 'directory:summary' });
    assert.equal(calls.length, 2);
    assert.equal('knownResponseTag' in calls[1], false);
    assert.equal(result.data.marker, 'fresh');
});

test('omitting the optional cache predicate keeps existing successful-write behavior', async () => {
    const h = setup({ request: async () => ({ result: 'success', record: { stayId: 'stay-a' } }) });
    await h.sandbox.readSWR({ action: 'get_guest_profile' }, { cacheKey: 'directory:profile:stable-id' });
    assert.equal(h.puts.length, 1);
});
