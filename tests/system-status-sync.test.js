const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadAdapter(options = {}) {
  const values = new Map();
  const localStorage = options.localStorage || {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value))
  };
  const window = {
    localStorage,
    indexedDB: options.indexedDB || { databases: async () => [] }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../system-status-sync.js'), 'utf8'), { window, Intl, Date, Number, Set, String, JSON, Promise });
  return { api: window.WaffleStatusSync, values };
}

test('records metadata-only sync outcomes and rejects unknown scopes', () => {
  const { api, values } = loadAdapter();
  assert.equal(api.recordAttempt('boarding', true, { source: 'spreadsheet', version: 'v2', payload: 'PRIVATE_GUEST_VALUE' }), true);
  const first = JSON.parse(values.get('waffleSyncMetadataV1'));
  assert.equal(first.boarding.source, 'spreadsheet');
  assert.equal(first.boarding.version, 'v2');
  assert.equal(first.boarding.lastAttemptResult, 'success');
  assert.equal(first.boarding.lastSuccessAt, first.boarding.lastAttemptAt);
  assert.equal(JSON.stringify(first).includes('PRIVATE_GUEST_VALUE'), false);

  api.recordAttempt('boarding', false, { source: 'spreadsheet' });
  const afterFailure = JSON.parse(values.get('waffleSyncMetadataV1'));
  assert.equal(afterFailure.boarding.lastAttemptResult, 'failed');
  assert.equal(afterFailure.boarding.lastSuccessAt, first.boarding.lastSuccessAt);
  assert.equal(api.recordAttempt('arbitrary', true, { source: 'test' }), false);
  assert.deepEqual(Object.keys(JSON.parse(values.get('waffleSyncMetadataV1'))), ['boarding']);
});

test('metadata storage write errors do not escape into application reads', () => {
  const { api } = loadAdapter({ localStorage: { getItem: () => '{}', setItem: () => { throw new Error('quota'); } } });
  assert.doesNotThrow(() => assert.equal(api.recordAttempt('boarding', true, { source: 'spreadsheet' }), false));
});

test('unavailable local metadata is reported without throwing', async () => {
  const { api } = loadAdapter({ localStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } });
  const result = await api.inspect({ online: false });
  assert.equal(result.boarding.state, 'storage-unavailable');
  assert.equal(result.operations.state, 'unknown');
  assert.equal(result.queue.available, false);
});

test('invalid successful timestamps remain unknown instead of implying a recent read', async () => {
  const stored = JSON.parse(JSON.stringify({ boarding: { source: 'spreadsheet', lastAttemptResult: 'success', lastSuccessAt: 'Infinity' } }));
  const rawStorage = loadAdapter({ localStorage: {
    getItem: () => JSON.stringify(stored),
    setItem: () => {}
  } });
  const result = await rawStorage.api.inspect({ online: false });
  assert.equal(result.boarding.state, 'unknown');
});
