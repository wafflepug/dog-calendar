const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');
function extract(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `could not extract ${start}`);
  return source.slice(a, b);
}
const hydratorSource = extract('async function hydrateDirectoryLegacyIntakes(', 'function setDirectoryDogPhoto(');
const popupSource = extract('function isExpectedLegacyIntakeUpdate(', 'function setDirectoryLegacyIntakeStatus(');
const urlAndOpenSource = extract('function buildLegacyIntakeUrl(', 'function renderLegacyIntakeUploaderFeedback(');

function makeHarness({ cache = {}, queryAppsScript, cards = ['stay-a', 'stay-b'] } = {}) {
  const rendered = [];
  const appended = [];
  const hosts = cards.map(key => ({
    dataset: { directoryLegacy: key },
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    querySelector(selector) { return selector.includes('retry') ? null : null; },
    appendChild(node) { appended.push({ key, node }); }
  }));
  const sandbox = {
    directoryLegacyIntakeCache: cache,
    directoryLegacyIntakeCacheLastFetch: 1,
    directoryLegacyIntakeRequestVersions: new Map(),
    getDirectoryProfileEditIdentity() { return {}; },
    directoryProfileEditIdentityConflicts() { return false; },
    document: {
      querySelectorAll(selector) {
        if (selector === '.directory-card[data-directory-stay-key]') return cards.map(key => ({ dataset: { directoryStayKey: key } }));
        if (selector === '[data-directory-legacy]') return hosts;
        return [];
      },
      createElement() { return { dataset: {}, setAttribute(name, value) { this[name] = value; } }; }
    },
    setDirectoryLegacyIntakeStatus: (key, group) => rendered.push({ key, group }),
    renderDirectoryRecordReadFailure: (host, key, kind, label) => rendered.push({ failure: key, kind, label }),
    queryAppsScript,
    console: { error() {} },
    Date,
    Map,
    String,
    Array,
    Object,
    Number
  };
  vm.runInNewContext(`${hydratorSource}\nthis.hydrate = hydrateDirectoryLegacyIntakes;`, sandbox);
  return { sandbox, rendered, appended, hosts };
}

test('uploader return message requires the expected popup, origin, stay, and document identity', () => {
  const sandbox = {};
  vm.runInNewContext(`${popupSource}\nthis.validate = isExpectedLegacyIntakeUpdate;`, sandbox);
  const popup = {};
  const context = { popup, stayKey: 'stay-a', documentId: 'doc-1' };
  const event = { source: popup, origin: 'https://script.google.com' };
  assert.equal(sandbox.validate(event, { stayKey: 'stay-a', documentId: 'doc-1' }, context, event.origin), true);
  assert.equal(sandbox.validate({ ...event, source: {} }, { stayKey: 'stay-a', documentId: 'doc-1' }, context, event.origin), false);
  assert.equal(sandbox.validate(event, { stayKey: 'stay-b', documentId: 'doc-1' }, context, event.origin), false);
  assert.equal(sandbox.validate(event, { stayKey: 'stay-a', documentId: 'doc-2' }, context, event.origin), false);
  assert.equal(sandbox.validate({ ...event, origin: 'https://evil.example' }, { stayKey: 'stay-a', documentId: 'doc-1' }, context, event.origin), false);
});

test('close return requests only the uploader stay key', async () => {
  const calls = [];
  const sandbox = {
    APPS_SCRIPT_WEBAPP_URL: 'https://script.google.com/macros/s/test/exec',
    URLSearchParams,
    window: { open: () => ({ closed: false }) },
    setInterval(fn) { sandbox.closeWatch = fn; return 4; },
    clearInterval() {},
    directoryLegacyIntakePopupContexts: new Map(),
    directoryLegacyIntakeReturnUntil: 0,
    document: { querySelectorAll() { return []; } },
    getDirectoryProfileEditIdentity() { return {}; },
    renderLegacyIntakeUploaderFeedback() {},
    hydrateDirectoryLegacyIntakes(options) { calls.push(options); return Promise.resolve(); },
    console: { error() {} }
  };
  vm.runInNewContext(`${urlAndOpenSource}\nthis.open = openLegacyIntakeUploader;`, sandbox);
  sandbox.open('stay-b', 'doc-2');
  const popup = [...sandbox.directoryLegacyIntakePopupContexts.keys()][0];
  popup.closed = true;
  sandbox.closeWatch();
  await Promise.resolve();
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { force: true, stayKeys: ['stay-b'], expectedIdentity: null });
});

test('blocked popup shows an accessible inline link for the selected guest', () => {
  let feedbackArgs;
  const sandbox = {
    APPS_SCRIPT_WEBAPP_URL: 'https://script.google.com/macros/s/test/exec?old=1',
    URLSearchParams,
    window: { open: () => null },
    renderLegacyIntakeUploaderFeedback: (...args) => { feedbackArgs = args; }
  };
  vm.runInNewContext(`${urlAndOpenSource}\nthis.open = openLegacyIntakeUploader;`, sandbox);
  sandbox.open('stay-b');
  assert.equal(feedbackArgs[0], 'stay-b');
  assert.match(feedbackArgs[1], /action=legacy_intake/);
  assert.doesNotMatch(feedbackArgs[1], /old=1/);
});

test('legacy status read sends a scoped request and ignores an older response', async () => {
  const deferred = [];
  const h = makeHarness({ queryAppsScript(payload) {
    assert.deepEqual(Array.from(payload.stayKeys), ['stay-a']);
    return new Promise(resolve => deferred.push(resolve));
  } });
  const first = h.sandbox.hydrate({ force: true, stayKeys: ['stay-a'] });
  const second = h.sandbox.hydrate({ force: true, stayKeys: ['stay-a'] });
  deferred[1]({ records: [{ stayKey: 'stay-a', latest: { documentId: 'new' }, count: 1 }, { stayKey: 'stay-b', latest: { documentId: 'stray' }, count: 1 }] });
  await second;
  deferred[0]({ records: [{ stayKey: 'stay-a', latest: { documentId: 'old' }, count: 1 }] });
  await first;
  assert.equal(h.sandbox.directoryLegacyIntakeCache['stay-a'].latest.documentId, 'new');
  assert.equal(h.sandbox.directoryLegacyIntakeCache['stay-b'], undefined, 'response records outside the requested stay scope are ignored');
  assert.deepEqual(h.rendered.filter(item => item.key === 'stay-a').map(item => item.group?.latest?.documentId), ['new']);
});

test('failed scoped refresh retains the current PDF and adds a retry for that stay', async () => {
  const cached = { stayKey: 'stay-a', latest: { documentId: 'existing' }, count: 1 };
  const h = makeHarness({ cache: { 'stay-a': cached }, queryAppsScript: async () => { throw new Error('offline'); } });
  await h.sandbox.hydrate({ force: true, stayKeys: ['stay-a'] });
  assert.equal(h.sandbox.directoryLegacyIntakeCache['stay-a'], cached);
  assert.equal(h.appended.length, 2);
  assert.deepEqual(h.appended.map(item => item.node.dataset.legacyRefreshFailure !== undefined || item.node.dataset.careRecordRetry !== undefined), [true, true]);
  const retry = h.appended.find(item => item.node.dataset.careRecordRetry === 'legacy');
  const failure = h.appended.find(item => item.node.dataset.legacyRefreshFailure !== undefined);
  assert.equal(retry.key, 'stay-a');
  assert.equal(retry.node.dataset.stayKey, 'stay-a');
  assert.equal(retry.node['aria-label'], 'Retry legacy PDF status for this guest');
  assert.equal(failure.node.textContent, 'Could not refresh. Showing previously available document.');
  assert.equal(h.rendered.some(item => item.failure), false);
});


test('identity mismatch after a guest switch prevents a scoped read', async () => {
  const h = makeHarness({ cards: ['stay-a'], queryAppsScript: async () => { throw new Error('must not read a different guest'); } });
  h.sandbox.getDirectoryProfileEditIdentity = () => ({ breed: 'labrador', ownerName: 'new owner', phone: '0400000002' });
  h.sandbox.directoryProfileEditIdentityConflicts = (expected, actual) => expected?.ownerName && expected.ownerName !== actual.ownerName;
  await h.sandbox.hydrate({ force: true, stayKeys: ['stay-a'], expectedIdentity: { stayId: '', dogId: '', dogNumber: '', editIdentity: { ownerName: 'old owner' } } });
  assert.equal(h.rendered.length, 0);
});


test('same-key guest replacement during a read cannot receive the previous document', async () => {
  let resolveRead;
  let owner = 'original';
  const h = makeHarness({ cards: ['stay-a'], queryAppsScript: () => new Promise(resolve => { resolveRead = resolve; }) });
  h.sandbox.getDirectoryProfileEditIdentity = () => ({ ownerName: owner });
  h.sandbox.directoryProfileEditIdentityConflicts = (a, b) => a.ownerName !== b.ownerName;
  const pending = h.sandbox.hydrate({ force: true, stayKeys: ['stay-a'] });
  owner = 'replacement';
  resolveRead({ records: [{ stayKey: 'stay-a', latest: { documentId: 'wrong-guest' } }] });
  await pending;
  assert.equal(h.sandbox.directoryLegacyIntakeCache['stay-a'], undefined);
  assert.equal(h.rendered.length, 0);
});
