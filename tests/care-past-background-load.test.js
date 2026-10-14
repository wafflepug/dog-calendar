const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'waffle-v10.8.6.js'), 'utf8');
const start = source.indexOf('function v1086BackgroundLoadPastStays()');
const end = source.indexOf('function v1086ObserveCareDirectory()', start);
assert.ok(start >= 0 && end > start);

function fixture({ loaded = false, page = 'directory', requested = false } = {}) {
  const calls = { reads: 0, counts: 0, warnings: 0 };
  const context = vm.createContext({
    WAFFLE_PAGE: page,
    v1086BackgroundPastRequested: requested,
    v1082PastLoaded: loaded,
    v1082LoadPastStays: () => { calls.reads++; return Promise.resolve(); },
    v1086UpdateCareStayCounts: () => { calls.counts++; },
    console: { warn: () => { calls.warnings++; } }
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, calls, run: () => context.v1086BackgroundLoadPastStays() };
}

test('delayed Past count task reuses manually loaded records without a read or rebuild', () => {
  const f = fixture({ loaded: true });
  f.run();
  assert.equal(f.calls.reads, 0);
  assert.equal(f.calls.counts, 1);
  assert.equal(f.context.v1086BackgroundPastRequested, true);
  f.run();
  assert.equal(f.calls.counts, 1);
});

test('unloaded Past count task delegates to the existing loader once', async () => {
  const f = fixture();
  f.run();
  f.run();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.reads, 1);
  assert.equal(f.calls.counts, 1);
});

test('Past count task does not load on another page or after previous scheduling', () => {
  for (const options of [{ page: 'calendar' }, { requested: true }]) {
    const f = fixture(options);
    f.run();
    assert.equal(f.calls.reads, 0);
    assert.equal(f.calls.counts, 0);
  }
});

test('unloaded Past count task keeps failures recoverable without an unhandled rejection', async () => {
  const f = fixture();
  f.context.v1082LoadPastStays = () => Promise.reject(new Error('Unavailable'));
  f.run();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.warnings, 1);
  assert.equal(f.calls.counts, 0);
  assert.equal(f.context.v1082PastLoaded, false);
});
