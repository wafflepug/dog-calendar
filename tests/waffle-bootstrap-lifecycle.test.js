const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-bootstrap.js', 'utf8');
const start = source.indexOf('  let buildCheckPromise = null;');
const endMarker = '  }, 5 * 60 * 1000);';
const end = source.indexOf(endMarker, start) + endMarker.length;
assert(start >= 0 && end > start);
const lifecycleSource = source.slice(start, end);

function harness({ fetchImpl, initialVisibility = 'visible', source = lifecycleSource } = {}) {
  const documentListeners = new Map();
  const windowListeners = new Map();
  let intervalCallback = null;
  let intervalDelay = null;
  const document = {
    readyState: 'loading',
    visibilityState: initialVisibility,
    addEventListener(type, callback) { documentListeners.set(type, [...(documentListeners.get(type) || []), callback]); },
  };
  const window = {
    addEventListener(type, callback) { windowListeners.set(type, [...(windowListeners.get(type) || []), callback]); },
  };
  const sandbox = {
    BUILD: '2026.08.28.01',
    buildBanner: null,
    document,
    window,
    fetch: fetchImpl || (async () => ({ ok: true, async json() { return { build: '' }; } })),
    showBuildUpdate() {},
    checkFirstPaintReady() {},
    setInterval(callback, delay) { intervalCallback = callback; intervalDelay = delay; return 1; },
    setTimeout,
    clearTimeout,
    console,
  };
  vm.runInNewContext(`const BUILD = '2026.08.28.01';\nfunction startMaintenanceGate() {}\nfunction startFirstPaintGate() {}\nfunction parserLoadRuntime() {}\n${source}`, sandbox);
  return {
    document,
    window,
    triggerDOMContentLoaded() { for (const callback of documentListeners.get('DOMContentLoaded') || []) callback(); },
    triggerVisibility(state) {
      document.visibilityState = state;
      for (const callback of documentListeners.get('visibilitychange') || []) callback();
    },
    triggerPageShow(persisted = false) { for (const callback of windowListeners.get('pageshow') || []) callback({ persisted }); },
    triggerInterval() { intervalCallback?.(); },
    intervalDelay() { return intervalDelay; },
  };
}

function controlledFetch() {
  const calls = [];
  const fetchImpl = () => new Promise((resolve, reject) => calls.push({ resolve, reject }));
  return { calls, fetchImpl };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
}

test('initial DOMContentLoaded and pageshow share one build probe', async () => {
  const controlled = controlledFetch();
  const page = harness({ fetchImpl: controlled.fetchImpl });
  page.triggerDOMContentLoaded();
  assert.equal(controlled.calls.length, 1);
  controlled.calls[0].resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();
  page.triggerPageShow();
  page.triggerVisibility('visible');
  assert.equal(controlled.calls.length, 1);
});

test('concurrent lifecycle triggers coalesce and rejected probes can retry', async () => {
  const controlled = controlledFetch();
  const page = harness({ fetchImpl: controlled.fetchImpl });
  page.triggerDOMContentLoaded();
  page.triggerPageShow(true);
  assert.equal(controlled.calls.length, 1);
  controlled.calls[0].reject(new Error('offline'));
  await settle();
  page.triggerPageShow(true);
  assert.equal(controlled.calls.length, 2);
  controlled.calls[1].resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();
});

test('persisted pageshow, hidden-visible, and interval each request a fresh probe', async () => {
  const controlled = controlledFetch();
  const page = harness({ fetchImpl: controlled.fetchImpl });
  page.triggerDOMContentLoaded();
  controlled.calls[0].resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();
  page.triggerPageShow(true);
  assert.equal(controlled.calls.length, 2);
  controlled.calls[1].resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();
  page.triggerVisibility('hidden');
  page.triggerVisibility('visible');
  assert.equal(controlled.calls.length, 3);
  controlled.calls[2].resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();
  page.triggerInterval();
  assert.equal(controlled.calls.length, 4);
  controlled.calls[3].resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();
});

test('hidden idle interval skips build fetch while visible interval and return probe remain fresh', async () => {
  const legacySource = lifecycleSource.replace(
    /  setInterval\(\(\) => \{\r?\n    if \(document\.visibilityState !== 'hidden'\) checkBuild\(\);\r?\n  \}, 5 \* 60 \* 1000\);/,
    '  setInterval(checkBuild, 5 * 60 * 1000);'
  );
  assert.notEqual(legacySource, lifecycleSource);
  const baseline = controlledFetch();
  const baselinePage = harness({ fetchImpl: baseline.fetchImpl, source: legacySource });
  baselinePage.triggerDOMContentLoaded();
  baseline.calls[0].resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();
  baselinePage.triggerVisibility('hidden');
  const baselineBefore = baseline.calls.length;
  baselinePage.triggerInterval();
  await settle();
  const beforeHiddenIntervalReads = baseline.calls.length - baselineBefore;

  const controlled = controlledFetch();
  const page = harness({ fetchImpl: controlled.fetchImpl });
  assert.equal(page.intervalDelay(), 5 * 60 * 1000);
  page.triggerDOMContentLoaded();
  controlled.calls[0].resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();

  page.triggerVisibility('hidden');
  const beforeHiddenInterval = controlled.calls.length;
  page.triggerInterval();
  await settle();
  const hiddenIntervalReads = controlled.calls.length - beforeHiddenInterval;
  assert.equal(beforeHiddenIntervalReads, 1);
  assert.equal(hiddenIntervalReads, 0);

  page.triggerVisibility('visible');
  assert.equal(controlled.calls.length, beforeHiddenInterval + 1);
  controlled.calls.at(-1).resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();
  page.triggerInterval();
  assert.equal(controlled.calls.length, beforeHiddenInterval + 2);
  controlled.calls.at(-1).resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();
});

test('initial mount still probes while hidden, then returning to foreground revalidates', async () => {
  const controlled = controlledFetch();
  const page = harness({ fetchImpl: controlled.fetchImpl, initialVisibility: 'hidden' });
  page.triggerDOMContentLoaded();
  assert.equal(controlled.calls.length, 1);
  controlled.calls[0].resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();
  page.triggerVisibility('visible');
  assert.equal(controlled.calls.length, 2);
  controlled.calls[1].resolve({ ok: true, async json() { return { build: '' }; } });
  await settle();
});
