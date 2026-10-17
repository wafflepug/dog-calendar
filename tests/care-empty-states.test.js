const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('waffle-app.js', 'utf8');
const stateStart = source.indexOf('    function getDirectoryRosterResponseState(');
const stateEnd = source.indexOf('    function directoryRosterCount(', stateStart);
const loadStart = source.indexOf('    async function loadGuestDirectoryConsolidated(');
const loadEnd = source.indexOf('    function getDirectoryProfileCard(', loadStart);
assert.ok(stateStart > 0 && stateEnd > stateStart && loadStart > 0 && loadEnd > loadStart);

function harness(response, cached) {
  const dashboard = { dataset: {} }, applied = [], states = [];
  const context = {
    WAFFLE_PAGE: 'directory', directoryConsolidatedLoadInProgress: false, directoryConsolidatedLastFetch: 0,
    document: { querySelector: () => dashboard, querySelectorAll: () => [], getElementById: () => null },
    window: { WAFFLE_CARE_STARTUP: { settled() {} } }, console: { error() {} },
    updateDirectoryEmptyState: () => states.push(dashboard.dataset.directoryRosterLoadState),
    applyGuestDirectoryResponse(data, options) { applied.push(data); dashboard.dataset.directoryRosterLoadState = options.fromCache ? 'cached' : 'success'; },
    async queryAppsScriptSWR(payload, options) {
      if (cached) await options.onCached(cached);
      if (response instanceof Error) throw response;
      return response;
    }
  };
  vm.runInNewContext(`${source.slice(stateStart, stateEnd)}\n${source.slice(loadStart, loadEnd)}\nthis.load = loadGuestDirectoryConsolidated;`, context);
  return { context, dashboard, applied, states };
}

test('unchanged online response confirms cached empty roster only after revalidation completes', async () => {
  const data = { result: 'success', bookings: [] };
  const h = harness({ data, unchanged: true }, data);
  await h.context.load({ quiet: true });
  assert.equal(h.applied.length, 1);
  assert.equal(h.dashboard.dataset.directoryRosterLoadState, 'success');
  assert.deepEqual(h.states, ['success']);
});

test('offline and failed cached responses stay qualified instead of claiming a fresh empty list', async () => {
  const data = { result: 'success', bookings: [] };
  for (const [flags, expected] of [[{ offlineFallback: true }, 'cached-offline'], [{ offlineFallback: true, error: new Error('failed') }, 'cached-failure']]) {
    const h = harness({ data, unchanged: true, ...flags }, data);
    await h.context.load({ quiet: true });
    assert.equal(h.dashboard.dataset.directoryRosterLoadState, expected);
  }
});

test('malformed, unsuccessful and failed reads never replace the roster with confirmed empty data', async () => {
  for (const response of [{ data: { result: 'error', bookings: [] } }, { data: { result: 'success' } }, new Error('offline')]) {
    const h = harness(response);
    await assert.rejects(() => h.context.load({ quiet: true }));
    assert.equal(h.applied.length, 0);
    assert.equal(h.dashboard.dataset.directoryRosterLoadState, 'failure');
  }
});
