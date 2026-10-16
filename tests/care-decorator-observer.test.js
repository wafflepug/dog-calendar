const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'waffle-v10.8.6.js'), 'utf8');
const start = source.indexOf('function v1086ObserveCareDirectory()');
const end = source.indexOf('function v1086PolishCareTabs()', start);
assert.ok(start >= 0 && end > start);

function fixture(page = 'directory') {
  const observed = [];
  const calls = { observerInstances: 0, counts: 0 };
  class FakeObserver {
    constructor(callback) {
      calls.observerInstances++;
      this.callback = callback;
    }
    observe(root, options) { observed.push({ root, options }); }
  }
  const context = vm.createContext({
    WAFFLE_PAGE: page,
    window: {},
    document: { body: { tag: 'body' } },
    MutationObserver: FakeObserver,
    v1086UpdateCareStayCounts: () => { calls.counts++; }
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, calls, observed, run: () => context.v1086ObserveCareDirectory() };
}

test('care count decoration uses one idempotent observer and covers late grids', () => {
  const f = fixture();
  f.run();
  f.run();
  assert.equal(f.calls.observerInstances, 1);
  assert.equal(f.observed.length, 1);
  assert.equal(f.observed[0].root, f.context.document.body);
  assert.deepEqual({ ...f.observed[0].options }, { childList: true, subtree: true });

  const observer = f.context.window.v1086CareDirectoryObserver;
  const grid = { nodeType: 1, matches: selector => selector.includes('#directory-grid'), querySelector: () => null };
  observer.callback([{ target: f.context.document.body, addedNodes: [grid], removedNodes: [] }]);
  assert.equal(f.calls.counts, 1);
  observer.callback([{ target: f.context.document.body, addedNodes: [], removedNodes: [] }]);
  assert.equal(f.calls.counts, 1);
});

test('care count observer is not installed outside the directory page', () => {
  const f = fixture('calendar');
  f.run();
  assert.equal(f.calls.observerInstances, 0);
  assert.equal(f.observed.length, 0);
});

test('initial care decoration is not called twice in the same V11.1.8 init pass', () => {
  const v1118 = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.1.8.js'), 'utf8');
  const init = v1118.slice(v1118.indexOf('  function init()'));
  const directoryBlock = init.slice(init.indexOf("if (pageName() === 'directory')"), init.indexOf("if (pageName() === 'calendar')"));
  assert.doesNotMatch(directoryBlock, /decorateAllCareCards\(\)/);
  assert.match(init, /oneShotPolish\(\);/);
});
