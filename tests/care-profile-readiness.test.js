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
    const host = { parentNode: { insertBefore() {} } };
    const retry = { addEventListener(type, handler) { this.handler = handler; } };
    const status = {
        dataset: {},
        setAttribute() {},
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
        setDirectoryDetailError: () => { calls.push('generic-error'); },
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
    assert.equal(h.calls[0].options.maxAttempts, 1);
    assert.equal(h.calls[0].options.timeoutMs, 15000);
    assert.equal(h.calls[0].options.lateCallbackGraceMs, 5 * 60 * 1000);
    assert.equal(h.calls.filter(call => call === 'generic-error').length, 0);
});

test('cached profile is visible while the refresh is still pending', async () => {
    const cached = { stayKey: 'milo|2026-09-20|2026-09-22', intakeAttributes: { allergy: 'Chicken' } };
    const h = harness({ cache: { cachedResponse: { record: cached } }, swrError: new Error('timeout'), delayMs: 25 });
    const pending = h.sandbox.load(h.card, h.details, { force: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.rendered.at(-1), cached);
    assert.equal(h.status.dataset.state, 'refreshing');
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
});

test('cold failed profile read exposes a scoped retry state', async () => {
    const h = harness({ swrError: new Error('timeout') });
    await h.sandbox.load(h.card, h.details, {});
    assert.equal(h.status.dataset.state, 'error');
    assert.match(h.status.innerHTML, /Unable to load care details/);
    assert.equal(h.calls.filter(call => call === 'generic-error').length, 1);
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
