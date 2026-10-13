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
    const blocked = setup({ cached: { payload: cachedPayload, version: 'v1', variant: 'full' }, request: async () => ({ unchanged: true }) });
    const blockedResult = await blocked.sandbox.readSWR({ action: 'get_guest_profile' }, {
        cacheKey: 'directory:profile:stable-id',
        shouldCacheResponse: () => false
    });
    assert.equal(blockedResult.unchanged, true);
    assert.equal(blocked.puts.length, 0);

    const allowed = setup({ cached: { payload: cachedPayload, version: 'v1', variant: 'full' }, request: async () => ({ unchanged: true }) });
    await allowed.sandbox.readSWR({ action: 'get_guest_profile' }, {
        cacheKey: 'directory:profile:stable-id',
        shouldCacheResponse: payload => payload.record?.stayId === 'stay-a'
    });
    assert.equal(allowed.puts.length, 1);
    assert.equal(allowed.puts[0].payload, cachedPayload);
});

test('omitting the optional cache predicate keeps existing successful-write behavior', async () => {
    const h = setup({ request: async () => ({ result: 'success', record: { stayId: 'stay-a' } }) });
    await h.sandbox.readSWR({ action: 'get_guest_profile' }, { cacheKey: 'directory:profile:stable-id' });
    assert.equal(h.puts.length, 1);
});
