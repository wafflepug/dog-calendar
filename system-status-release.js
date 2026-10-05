(function (global) {
  'use strict';

  const CACHE_KEY = 'waffleDeploymentManifestV1';
  const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const SHA_RE = /^[a-f0-9]{40}$/i;

  function safeLocalStorage() {
    try { return global.localStorage; } catch (_) { return null; }
  }

  function normalizeManifest(value) {
    if (!value || value.schemaVersion !== 1 || !value.artifact) return null;
    const commitSha = String(value.artifact.commitSha || '').trim();
    const generatedAt = String(value.artifact.generatedAt || '').trim();
    const generatedTime = Date.parse(generatedAt);
    if (!SHA_RE.test(commitSha) || !Number.isFinite(generatedTime)) return null;
    const release = value.release && typeof value.release === 'object' ? value.release : {};
    return {
      schemaVersion: 1,
      artifact: { commitSha: commitSha.toLowerCase(), generatedAt, generatedTime },
      release: { name: String(release.name || '').trim(), revision: String(release.revision || '').trim() }
    };
  }

  function readCache(storage) {
    try {
      const entry = JSON.parse(storage.getItem(CACHE_KEY) || 'null');
      const manifest = normalizeManifest(entry && entry.manifest);
      const savedAt = Number(entry && entry.savedAt);
      return manifest && Number.isFinite(savedAt) && savedAt > 0 ? { manifest, build: entry.build || {}, releaseMetadata: entry.releaseMetadata || {}, savedAt } : null;
    } catch (_) { return null; }
  }

  function writeCache(storage, entry, now) {
    try { storage.setItem(CACHE_KEY, JSON.stringify({ ...entry, savedAt: now })); } catch (_) {}
  }

  function displayState(entry, source, now, online) {
    if (!entry) return { state: online ? 'failed' : 'offline-unknown', manifest: null, build: {}, releaseMetadata: {} };
    if (source === 'live') return { state: 'current', ...entry };
    const age = Math.max(0, now - Number(entry.savedAt || 0));
    const stale = age > CACHE_MAX_AGE_MS;
    const manifest = { ...entry.manifest, _savedAt: entry.savedAt };
    return {
      state: !online ? (stale ? 'cached-stale-offline' : 'cached-offline') : stale ? 'cached-stale' : 'cached-read-failed',
      manifest,
      build: entry.build || {},
      releaseMetadata: entry.releaseMetadata || {}
    };
  }

  async function load(options = {}) {
    const fetchJson = options.fetchJson;
    const storage = options.storage || safeLocalStorage();
    const now = Number(options.now || Date.now());
    const online = options.online !== false;
    if (!online) {
      const cached = readCache(storage);
      return displayState(cached, 'cache', now, false);
    }
    try {
      const values = await Promise.all(['waffle-deployment.json', 'waffle-build.json', 'waffle-release.json'].map(path => fetchJson(path)));
      if (typeof options.isCurrent === 'function' && !options.isCurrent()) return displayState(null, 'failed', now, true);
      const manifest = normalizeManifest(values[0]);
      if (!manifest) throw new Error('invalid deployment manifest');
      const entry = { manifest, build: values[1] && typeof values[1] === 'object' ? values[1] : {}, releaseMetadata: values[2] && typeof values[2] === 'object' ? values[2] : {}, savedAt: now };
      writeCache(storage, entry, now);
      return displayState(entry, 'live', now, online);
    } catch (_) {
      const cached = readCache(storage);
      return displayState(cached, 'cache', now, online);
    }
  }

  function describe(state, manifest, build = {}, releaseMetadata = {}) {
    if (!manifest) {
      const label = state === 'offline-unknown' ? 'Unknown · offline' : 'Unavailable';
      const detail = state === 'offline-unknown' ? 'No current or cached deployed artifact manifest is available while offline.' : 'The deployed artifact manifest could not be read and no valid cache is available. Legacy labels are historical.';
      return { label, detail };
    }
    const name = String(build.releaseName || releaseMetadata.currentReleaseName || 'Release metadata unavailable');
    const revision = String(build.assetRevision || releaseMetadata.currentRelease || 'unknown');
    const disagreement = build.assetRevision && releaseMetadata.currentRelease && build.assetRevision !== releaseMetadata.currentRelease;
    const stateLabel = disagreement && state === 'current' ? 'Metadata mismatch' : state;
    const shortSha = manifest.artifact.commitSha;
    const prefix = stateLabel === 'current' ? 'Deployed' : stateLabel === 'cached-offline' ? 'Cached · offline' : stateLabel === 'cached-stale-offline' ? 'Stale cache · offline' : stateLabel === 'cached-stale' ? 'Stale cache' : stateLabel === 'cached-read-failed' ? 'Cached · manifest read failed' : 'Metadata mismatch';
    return {
      label: prefix,
      detail: `${name} · revision ${revision} · ${shortSha} · generated ${manifest.artifact.generatedAt}${disagreement ? ' · build and release revisions disagree' : ''}`
    };
  }

  global.WaffleReleaseAttribution = { normalizeManifest, load, describe };
})(window);
