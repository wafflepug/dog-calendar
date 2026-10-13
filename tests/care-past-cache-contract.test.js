const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('apps-script/Code.js', 'utf8');
const variantStart = source.indexOf('function waffleReadVariant_(action, data)');
const cacheKeyStart = source.indexOf('function waffleReadCacheKey_(', variantStart);
const readStart = source.indexOf('function getVersionedWaffleRead_(', cacheKeyStart);
const versionsStart = source.indexOf('function getWaffleDataVersions_(', readStart);
assert.ok(variantStart >= 0 && cacheKeyStart > variantStart && readStart > cacheKeyStart && versionsStart > readStart);

const cacheEntries = new Map();
const sandbox = {
  Utilities: { formatDate: () => '2026-10-13' },
  Session: { getScriptTimeZone: () => 'Australia/Sydney' },
  STAY_OPERATION_IDENTITY_VERSION_V11226_: 1,
  WAFFLE_CACHE_NAMESPACE_: 'test',
  getWaffleDataVersion_: () => 'directory-v1',
  waffleCacheFingerprint_: value => value,
  CacheService: { getScriptCache: () => ({ get: key => cacheEntries.get(key) || null, remove: key => cacheEntries.delete(key) }) },
  safePutWaffleCache_: (key, value) => cacheEntries.set(key, JSON.stringify(value))
};
vm.createContext(sandbox);
vm.runInContext(source.slice(variantStart, cacheKeyStart) + source.slice(cacheKeyStart, readStart) + source.slice(readStart, versionsStart), sandbox);

function legacyVariant(action) {
  const parsed = JSON.parse(sandbox.waffleReadVariant_(action, {}));
  delete parsed.pastDirectorySchemaVersion;
  return JSON.stringify(parsed);
}

const pastVariant = sandbox.waffleReadVariant_('get_past_guest_directory', {});
assert.equal(JSON.parse(pastVariant).pastDirectorySchemaVersion, 2);
assert.notEqual(pastVariant, legacyVariant('get_past_guest_directory'), 'Past schema changes invalidate old variants even while data version is unchanged');

let pastBuilds = 0;
const refreshed = sandbox.getVersionedWaffleRead_('directory', 'get_past_guest_directory', {
  knownVersion: 'directory-v1',
  knownVariant: legacyVariant('get_past_guest_directory')
}, 20, () => { pastBuilds += 1; return { bookings: [{ dogId: 'test-dog-id', dogNumber: '#00012', checkoutDate: '2026-10-13' }] }; });
assert.equal(refreshed.unchanged, undefined, 'legacy Past metadata cannot receive an unchanged response');
assert.equal(refreshed.cacheHit, false);
assert.equal(pastBuilds, 1, 'legacy Past metadata causes a fresh payload build');
assert.equal(refreshed.bookings[0].dogNumber, '#00012');
const unchangedPast = sandbox.getVersionedWaffleRead_('directory', 'get_past_guest_directory', {knownVersion: 'directory-v1', knownVariant: pastVariant}, 20, () => { throw new Error('Current Past metadata should keep its unchanged fast path'); });
assert.equal(unchangedPast.unchanged, true);

for (const action of ['get_guest_directory', 'get_stay_operations']) {
  const variant = sandbox.waffleReadVariant_(action, {});
  assert.equal(variant, legacyVariant(action), `${action} variant remains unchanged`);
}

let otherBuilds = 0;
const other = sandbox.getVersionedWaffleRead_('directory', 'get_guest_directory', {
  knownVersion: 'directory-v1',
  knownVariant: sandbox.waffleReadVariant_('get_guest_directory', {})
}, 20, () => { otherBuilds += 1; return {}; });
assert.equal(other.unchanged, true, 'matching non-Past metadata retains the unchanged fast path');
assert.equal(otherBuilds, 0);

console.log('Past directory cache contract tests passed');
