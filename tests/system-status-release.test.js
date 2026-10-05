const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadModule() {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) };
  const window = { localStorage: storage };
  vm.runInNewContext(fs.readFileSync(require.resolve('../system-status-release.js'), 'utf8'), { window, Date, Number, String, JSON, Promise });
  return { api: window.WaffleReleaseAttribution, storage, values };
}

const current = require('./fixtures/deployment-manifest-current.json');
const old = require('./fixtures/deployment-manifest-old.json');

test('accepts a current deployment identity with a full SHA and timestamp', async () => {
  const { api } = loadModule();
  const result = await api.load({ fetchJson: async () => current, now: Date.parse('2026-10-06T02:00:00Z') });
  assert.equal(result.state, 'current');
  assert.equal(result.manifest.artifact.commitSha.length, 40);
  const display = api.describe(result.state, result.manifest, { releaseName: 'Release Attribution', assetRevision: '2026.10.06.02' }, { currentRelease: '2026.10.06.02' });
  assert.equal(display.label, 'Deployed');
  assert.match(display.detail, /Release Attribution · revision 2026\.10\.06\.02/);
});

test('accepts an older well-formed artifact identity without calling it current release health', async () => {
  const { api } = loadModule();
  const result = await api.load({ fetchJson: async () => old, now: Date.parse('2026-10-06T02:00:00Z') });
  assert.equal(result.state, 'current');
  assert.equal(result.manifest.artifact.commitSha, old.artifact.commitSha);
});

test('rejects invalid or missing manifests instead of falling back to historical SHA fields', async () => {
  const { api } = loadModule();
  for (const value of [null, { ...current, artifact: { ...current.artifact, commitSha: '41c7d27' } }, { ...current, artifact: { ...current.artifact, generatedAt: 'unknown' } }]) {
    const result = await api.load({ fetchJson: async () => value, now: Date.parse('2026-10-06T02:00:00Z') });
    assert.equal(result.state, 'failed');
    assert.equal(result.manifest, null);
  }
  const unknown = api.describe('unknown', null);
  assert.equal(unknown.label, 'Unavailable');
  assert.match(unknown.detail, /historical/);
});

test('failed online reads and offline reads distinguish fresh and stale cached revisions', async () => {
  const { api, storage } = loadModule();
  const now = Date.parse('2026-10-06T02:00:00Z');
  await api.load({ fetchJson: async () => current, storage, now: now - 60_000 });
  const failed = await api.load({ fetchJson: async () => { throw new Error('offline'); }, storage, now, online: true });
  assert.equal(failed.state, 'cached-read-failed');
  const offline = await api.load({ fetchJson: async () => { throw new Error('offline'); }, storage, now, online: false });
  assert.equal(offline.state, 'cached-offline');
  const stale = await api.load({ fetchJson: async () => { throw new Error('offline'); }, storage, now: now + 25 * 60 * 60 * 1000, online: false });
  assert.equal(stale.state, 'cached-stale-offline');
  assert.equal(stale.manifest.artifact.commitSha, current.artifact.commitSha);
});

test('offline checks do not fetch and blocked local storage does not hide a live deployment identity', async () => {
  const { api, storage } = loadModule();
  let fetches = 0;
  const fetchJson = async path => { fetches++; return path === 'waffle-deployment.json' ? current : {}; };
  const offline = await api.load({ fetchJson, storage, now: Date.parse('2026-10-06T02:00:00Z'), online: false });
  assert.equal(offline.state, 'offline-unknown');
  assert.equal(fetches, 0);

  const window = {};
  Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } });
  vm.runInNewContext(fs.readFileSync(require.resolve('../system-status-release.js'), 'utf8'), { window, Date, Number, String, JSON, Promise });
  const live = await window.WaffleReleaseAttribution.load({ fetchJson, now: Date.parse('2026-10-06T02:00:00Z'), online: true });
  assert.equal(live.state, 'current');
});

test('build and release revision disagreement is visible', () => {
  const { api } = loadModule();
  const manifest = api.normalizeManifest(current);
  const result = api.describe('current', manifest, { releaseName: 'Release Attribution', assetRevision: 'new-revision' }, { currentRelease: 'old-revision' });
  assert.equal(result.label, 'Metadata mismatch');
  assert.match(result.detail, /revisions disagree/);
});

test('an older refresh cannot overwrite the newer paired identity cache', async () => {
  const { api, storage } = loadModule();
  let resolveOld;
  let oldIsCurrent = true;
  const pending = api.load({
    storage,
    fetchJson: async path => path === 'waffle-deployment.json'
      ? new Promise(resolve => { resolveOld = resolve; })
      : { releaseName: 'Old release', assetRevision: 'old', currentRelease: 'old' },
    isCurrent: () => oldIsCurrent
  });
  oldIsCurrent = false;
  await api.load({ storage, fetchJson: async path => path === 'waffle-deployment.json' ? current : { releaseName: 'New release', assetRevision: 'new', currentRelease: 'new' } });
  resolveOld(old);
  await pending;
  const offline = await api.load({ storage, online: false, fetchJson: async () => { throw new Error('Must not fetch offline'); } });
  assert.equal(offline.manifest.artifact.commitSha, current.artifact.commitSha);
  assert.equal(offline.build.releaseName, 'New release');
  assert.equal(offline.releaseMetadata.currentRelease, 'new');
});
