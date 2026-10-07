const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const start = source.indexOf('function getDirectoryCareBriefFreshness(');
const end = source.indexOf('\n    function renderDirectoryCareBrief(', start);
assert.ok(start >= 0 && end > start, 'freshness formatter exists in the live Care renderer');
const freshnessFor = new Function(`${source.slice(start, end)}; return getDirectoryCareBriefFreshness;`)();

test('Care overview freshness uses only a valid record update timestamp', () => {
  const fresh = freshnessFor({ updatedAt: '2026-09-17T08:30:00.000Z', retrievedAt: '2026-09-18T12:00:00.000Z' }, 'saved', 'resolved');
  assert.equal(fresh.state, 'fresh');
  assert.equal(fresh.text, `Record updated ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date('2026-09-17T08:30:00.000Z'))}`);
  assert.deepEqual(fresh, freshnessFor({ updatedAt: '2026-09-17T08:30:00.000Z', retrievedAt: '2034-05-06T07:08:09.000Z' }, 'saved', 'resolved'));

  const missingTimestamp = freshnessFor({ retrievedAt: '2026-09-18T12:00:00.000Z' }, 'saved', 'resolved');
  assert.deepEqual(missingTimestamp, { text: 'Saved care record · update time not recorded', state: 'saved' });

  const invalidTimestamp = freshnessFor({ updatedAt: 'not a timestamp' }, 'saved', 'resolved');
  assert.deepEqual(invalidTimestamp, { text: 'Saved care record · update time not recorded', state: 'saved' });
});

test('Care overview keeps loading, refresh failure, missing, and unresolved states distinct', () => {
  assert.deepEqual(freshnessFor(null, 'loading', 'resolved'), { text: 'Loading care record…', state: 'loading' });
  assert.equal(freshnessFor({ updatedAt: '2026-09-17T08:30:00.000Z' }, 'refreshing', 'resolved').state, 'refreshing');
  assert.deepEqual(freshnessFor(null, 'error', 'resolved'), { text: 'Care record could not be loaded', state: 'error' });
  assert.deepEqual(freshnessFor(null, 'not-found', 'missing'), { text: 'No saved care record', state: 'missing' });
  assert.deepEqual(freshnessFor(null, 'identity-conflict', 'unresolved'), { text: 'Care record identity needs review', state: 'unresolved' });
});

test('optimistic saves clear stale timestamps unless the server supplies an updatedAt value', () => {
  const start = source.indexOf('function mergeDirectoryCareRecordWithServerTimestamp(');
  const end = source.indexOf('\n    function renderDirectoryCareBrief(', start);
  assert.ok(start >= 0 && end > start, 'timestamp merge helper exists in the live Care renderer');
  const mergeWithTimestamp = new Function(`${source.slice(start, end)}; return mergeDirectoryCareRecordWithServerTimestamp;`)();

  const localSave = mergeWithTimestamp({ stayKey: 'stay-a', updatedAt: '2026-09-17T08:30:00.000Z' }, '');
  assert.equal(localSave.stayKey, 'stay-a');
  assert.equal(Object.hasOwn(localSave, 'updatedAt'), false);

  const serverConfirmed = mergeWithTimestamp(localSave, '2026-09-18T10:15:00.000Z');
  assert.equal(serverConfirmed.updatedAt, '2026-09-18T10:15:00.000Z');
});

test('freshness excludes mismatched or identity-blocked profile records', () => {
  const identityStart = source.indexOf('function getDirectoryProfileReadIdentity(card)');
  const identityEnd = source.indexOf('\n    function directoryProfileIdentityIsAmbiguous(', identityStart);
  const recordStart = source.indexOf('function getDirectoryValidatedCareProfileRecord(card)');
  const recordEnd = source.indexOf('\n    function normalizeDirectoryPhoneForTel(', recordStart);
  assert.ok(identityStart >= 0 && identityEnd > identityStart && recordStart >= 0 && recordEnd > recordStart);
  const actualIdentityHelpers = source.slice(identityStart, identityEnd);
  const validatedRecordHelper = source.slice(recordStart, recordEnd);
  const stayKey = 'milo|2026-09-17|2026-09-22';
  const card = { dataset: { directoryStayKey: stayKey, directoryStayId: '22222222-2222-4222-8222-222222222222', directoryDogId: '11111111-1111-4111-8111-111111111111' } };
  const matching = {
    stayKey,
    identity: { stayKey, stayId: card.dataset.directoryStayId, dogId: card.dataset.directoryDogId },
    resolution: { status: 'resolved' },
    updatedAt: '2026-09-17T08:30:00.000Z'
  };
  const cacheKey = `stable:${card.dataset.directoryStayId}::${card.dataset.directoryDogId}::${stayKey}`;
  const cache = { [cacheKey]: matching };
  const actual = new Function(
    'directoryProfileDetailCache',
    'directoryProfileIdentityIsAmbiguous',
    `${actualIdentityHelpers}\n${validatedRecordHelper}\nreturn getDirectoryValidatedCareProfileRecord;`
  )(cache, () => false);
  assert.equal(actual(card), matching);
  cache[cacheKey] = { ...matching, identity: { ...matching.identity, dogId: '33333333-3333-4333-8333-333333333333' } };
  assert.equal(actual(card), null);
  cache[cacheKey] = matching;
  card.dataset.profileIdentityBlocked = cacheKey;
  assert.equal(actual(card), null);
});
