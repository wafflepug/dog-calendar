(function (global) {
  'use strict';

  const CACHE_DB = 'waffle-house-v83';
  const CACHE_STORE = 'responses';
  const QUEUE_DB = 'waffle-house-v108-writes';
  const QUEUE_STORE = 'mutations';
  const METADATA_KEY = 'waffleSyncMetadataV1';
  const SCOPES = new Set(['boarding', 'operations']);

  const unavailable = reason => ({ available: false, reason });

  async function existingDatabaseNames() {
    if (!global.indexedDB || typeof global.indexedDB.databases !== 'function') {
      throw new Error('This browser cannot safely inspect existing local databases.');
    }
    const entries = await global.indexedDB.databases();
    if (!Array.isArray(entries)) throw new Error('Local database information is unavailable.');
    return new Set(entries.map(item => item.name).filter(Boolean));
  }

  function openExisting(name) {
    return new Promise((resolve, reject) => {
      let request;
      try { request = global.indexedDB.open(name); } catch (error) { reject(error); return; }
      request.onupgradeneeded = () => {
        request.transaction?.abort();
        reject(new Error('Expected local storage is unavailable.'));
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Local storage could not be opened.'));
      request.onblocked = () => reject(new Error('Local storage is blocked by another tab.'));
    });
  }

  async function readResponses(names) {
    if (!names.has(CACHE_DB)) return { available: true, entries: {} };
    const db = await openExisting(CACHE_DB);
    try {
      if (!db.objectStoreNames.contains(CACHE_STORE)) throw new Error('Saved response storage is unavailable.');
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, 'readonly');
        const store = tx.objectStore(CACHE_STORE);
        const entries = {};
        let pending = 2;
        for (const [scope, key] of [['boarding', 'directory:summary'], ['operations', 'directory:stay-operations']]) {
          const request = store.get(key);
          request.onsuccess = () => { entries[scope] = request.result || null; if (--pending === 0) resolve({ available: true, entries }); };
          request.onerror = () => reject(request.error || new Error('Saved responses could not be read.'));
        }
        tx.onerror = () => reject(tx.error || new Error('Saved responses could not be read.'));
        tx.onabort = () => reject(tx.error || new Error('Saved response read was aborted.'));
      });
    } finally { db.close(); }
  }

  async function readQueue(names) {
    if (!names.has(QUEUE_DB)) return unavailable('The local mutation queue has not been initialized.');
    const db = await openExisting(QUEUE_DB);
    try {
      if (!db.objectStoreNames.contains(QUEUE_STORE)) return unavailable('The local mutation queue is unavailable.');
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(QUEUE_STORE, 'readonly');
        const request = tx.objectStore(QUEUE_STORE).count();
        request.onsuccess = () => resolve({ available: true, count: Number(request.result || 0) });
        request.onerror = () => reject(request.error || new Error('The local mutation queue could not be counted.'));
        tx.onabort = () => reject(tx.error || new Error('The local queue read was aborted.'));
      });
    } finally { db.close(); }
  }

  function readMetadata() {
    try {
      const value = JSON.parse(global.localStorage.getItem(METADATA_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return null; }
  }

  function recordAttempt(scope, succeeded, details = {}) {
    if (!SCOPES.has(scope)) return false;
    try {
      const metadata = readMetadata();
      if (!metadata) return false;
      const previous = metadata[scope] && typeof metadata[scope] === 'object' ? metadata[scope] : {};
      const next = {
        ...previous,
        lastAttemptAt: Date.now(),
        lastAttemptResult: succeeded ? 'success' : 'failed',
        source: String(details.source || previous.source || '').slice(0, 32)
      };
      if (succeeded) {
        next.lastSuccessAt = next.lastAttemptAt;
        if (details.version) next.version = String(details.version).slice(0, 96);
      }
      metadata[scope] = next;
      global.localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
      return true;
    } catch (_) { return false; }
  }

  function timestamp(value) {
    const time = Number(value);
    if (!Number.isFinite(time) || time <= 0) return '';
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time)); }
    catch (_) { return new Date(time).toISOString(); }
  }

  function hasSuccessfulResponse(entry) {
    return !!entry && Number.isFinite(Number(entry.savedAt)) && Number(entry.savedAt) > 0 && entry.payload?.result === 'success';
  }

  function status(state, label, detail, time = '') { return { state, label, detail, timestamp: time || '' }; }

  function boardingStatus(metadata, online) {
    const item = metadata?.boarding;
    const successfulAt = Number(item?.lastSuccessAt || 0);
    if (!Number.isFinite(successfulAt)) return status('unknown', 'Unknown', 'No valid successful spreadsheet read time is recorded on this device.');
    const lastTime = timestamp(successfulAt);
    if (item?.source !== 'spreadsheet' || !successfulAt) {
      if (item?.source === 'spreadsheet' && item.lastAttemptResult === 'failed') return status('failed', 'Failed', 'The latest spreadsheet read failed; no successful read time is recorded.');
      return status('unknown', 'Unknown', 'No successful spreadsheet read time is recorded on this device.');
    }
    if (item.lastAttemptResult === 'failed') return status('failed', 'Failed', 'The latest spreadsheet read failed. The earlier successful read time is retained.', lastTime);
    if (!online) return status('cached-offline', 'Cached · offline', 'Spreadsheet data was last read successfully; the device is currently offline.', lastTime);
    if (item.lastAttemptResult === 'success') return status('synced', 'Synced', 'Last successful spreadsheet read; this status page did not trigger a spreadsheet read.', lastTime);
    return status('cached', 'Cached', 'Last successful spreadsheet read time is saved; no newer successful read is recorded.', lastTime);
  }

  function operationsStatus(entry, remoteVersion, versionCheckFailed, online, metadata) {
    if (!hasSuccessfulResponse(entry)) {
      if (metadata?.operations?.lastAttemptResult === 'failed') return status('failed', 'Failed', 'The latest stay-operations read failed and no successful response is saved.');
      return status('unknown', 'Unknown', 'No successful stay-operations response is saved on this device.');
    }
    const savedTime = timestamp(entry.savedAt);
    if (metadata?.operations?.lastAttemptResult === 'failed') return status('failed', 'Failed', 'The latest stay-operations read failed; the last successful response remains saved.', savedTime);
    if (!online) return status('cached-offline', 'Cached · offline', 'Using the locally saved stay-operations response.', savedTime);
    if (versionCheckFailed || !remoteVersion) return status('failed', 'Failed to verify', 'The saved response could not be checked against the current server version.', savedTime);
    if (!entry.version) return status('unknown', 'Unknown', 'A saved stay-operations response exists, but its server version is unavailable.', savedTime);
    if (String(entry.version) === String(remoteVersion)) return status('synced', 'Synced', 'The saved stay-operations response matches the current directory version.', savedTime);
    return status('cached', 'Cached', 'The server directory version differs from the locally saved operations response.', savedTime);
  }

  async function inspect(options = {}) {
    const online = options.online !== false;
    const metadata = readMetadata();
    let names;
    try {
      names = await existingDatabaseNames();
    } catch (error) {
      const reason = error?.message || 'Local browser storage is unavailable.';
      const failure = unavailable(reason);
      return {
        storage: failure,
        boarding: metadata === null ? status('storage-unavailable', 'Unavailable', 'Local sync metadata could not be read.') : boardingStatus(metadata, online),
        operations: status('storage-unavailable', 'Unavailable', reason),
        queue: failure
      };
    }

    let responses = { available: false, entries: {} };
    let queue = unavailable('The local mutation queue could not be inspected.');
    let responseFailure = '';
    let queueFailure = '';
    try { responses = await readResponses(names); }
    catch (error) { responseFailure = error?.message || 'Saved responses could not be read.'; }
    try { queue = await readQueue(names); }
    catch (error) { queueFailure = error?.message || 'The local mutation queue could not be counted.'; }

    let remoteVersion = null;
    let versionCheckFailed = false;
    if (online && typeof options.readVersions === 'function') {
      try {
        const result = await options.readVersions();
        if (result?.result === 'success' && result.versions && result.versions.directory) remoteVersion = result.versions.directory;
        else versionCheckFailed = true;
      } catch (_) { versionCheckFailed = true; }
    }
    if (queueFailure) queue = unavailable(queueFailure);
    return {
      storage: { available: true, metadataAvailable: metadata !== null, responseAvailable: !responseFailure },
      boarding: metadata === null
        ? status('storage-unavailable', 'Unavailable', 'Local sync metadata could not be read.')
        : boardingStatus(metadata, online),
      operations: responseFailure
        ? status('storage-unavailable', 'Unavailable', responseFailure)
        : operationsStatus(responses.entries.operations, remoteVersion, versionCheckFailed, online, metadata),
      queue
    };
  }

  global.WaffleStatusSync = Object.freeze({ inspect, recordAttempt });
})(window);
