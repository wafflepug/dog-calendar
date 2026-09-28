const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const backend = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.js'), 'utf8');
const helperStart = backend.indexOf('// Identity fields are discovered by header');
const helperEnd = backend.indexOf('function findV108BoardingRowForUpdate_', helperStart);
const copyStart = backend.indexOf('function validateV108DogProfileCopy_', helperEnd);
const copyEnd = backend.indexOf('function createV108Boarding_', copyStart);
const createStart = copyEnd;
const createEnd = backend.indexOf('function updateV108BoardingDates_', createStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart && copyStart > helperEnd && createEnd > createStart);

function makeHarness(initialRows, priorProfiles = []) {
  const rows = initialRows.map(row => row.slice());
  const writes = [];
  const versionTouches = [];
  const cells = new Map();
  const sheet = {
    getName() { return 'Bookings'; },
    getDataRange() { return { getValues: () => rows }; },
    getRange(row, col, numRows, numCols) {
      return {
        getValue() { return cells.get(`${row}:${col}`) || (rows[row - 1] || [])[col - 1] || ''; },
        getDisplayValues() { return [(rows[row - 1] || []).slice(col - 1, col - 1 + (numCols || 1)).map(value => String(value || ''))]; },
        setValue(value) {
          cells.set(`${row}:${col}`, value);
          while (rows.length < row) rows.push([]);
          rows[row - 1][col - 1] = value;
          writes.push({ row, col, value });
        }
      };
    },
    appendRow(row) { rows.push(row.slice()); },
    getLastRow() { return rows.length; },
    getLastColumn() { return Math.max(0, ...rows.map(row => row.length)); }
  };
  const belongings = {
    getRange(row, col) {
      return { setValue(value) { writes.push({ belongings: true, row, col, value }); } };
    }
  };
  let uuidCounter = 0;
  const sandbox = {
    Utilities: { getUuid: () => `uuid-${++uuidCounter}` },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    getTargetSheet_: () => sheet,
    getBelongingsSheet_: () => belongings,
    normalizeV108Identity_: value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(),
    phoneTailV108_: value => String(value || '').replace(/\D/g, '').slice(-4),
    normalizeDateValue_: value => String(value || '').slice(0, 10),
    makeGuestStayKey_: (name, start, end) => `${String(name).toLowerCase()}|${start}|${end}`,
    readBelongingsRecords_: () => priorProfiles,
    upsertBelongingsRecord_: (_sheet, record) => { writes.push({ profile: record }); return 2; },
    normalizeV108DogPhotoGallery_: gallery => gallery || [],
    touchWaffleDataVersion_: scope => versionTouches.push(scope),
    createIntakeLinkForBooking_: () => null,
    auditBookingSnapshotFromSheetRow_: (_sheet, row) => ({ dogName: rows[row - 1][1], dogId: rows[row - 1][12] || '' }),
    logAuditEvent_: () => {},
    console
  };
  vm.createContext(sandbox);
  const prefillStart = backend.indexOf('function getV108ReturningGuestPrefill_');
  vm.runInContext(`${backend.slice(helperStart, helperEnd)}\n${backend.slice(prefillStart, copyEnd)}\n${backend.slice(createStart, createEnd)}\nthis.api = { resolve: resolveV108DogRows_, create: createV108Boarding_, createIntake: createV108IntakeBooking_, prefill: getV108ReturningGuestPrefill_, backfill: backfillV108DogIds_ };`, sandbox);
  return { api: sandbox.api, rows, writes, versionTouches };
}

const header = ['Timestamp', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Owner', 'Phone', '', '', 'Notes', 'Edit', 'Booking Type', 'Dog ID'];
const booking = (name, owner, id = '') => ['', name, 'Cavoodle', '2026-10-01', '2026-10-02', owner, '0400000000', '', '', '', '', 'Confirmed Boarding', id];

// Same-name dogs remain separate; a client with no selection gets a fresh ID.
{
  const h = makeHarness([header, booking('Coco', 'A', 'existing-a'), booking('Coco', 'B', 'existing-b')]);
  const result = h.api.create({ dogName: 'Coco', breed: 'Cavoodle', ownerName: 'C', phone: '0400000000', startDate: '2026-10-03', endDate: '2026-10-04' });
  assert.equal(result.dogId, 'uuid-1');
  assert.equal(h.rows[3][12], 'uuid-1');
  assert.equal(h.rows[3].length, 14, 'Dog ID and Dog Number are appended after the unchanged A:L booking fields');
  const oldClient = h.api.create({ dogName: 'Coco', breed: 'Cavoodle', ownerName: 'D', phone: '0400000000', startDate: '2026-10-05', endDate: '2026-10-06', copyPreviousProfile: true });
  assert.ok(oldClient.dogId);
  assert.equal(oldClient.copiedPreviousProfile.copied, false);
  assert.match(oldClient.copySkippedReason, /Select an existing dog record/);
}

// Existing IDs cannot be reused for another name without the explicit rename flow.
{
  const h = makeHarness([header, booking('Coco', 'A', 'existing-a'), booking('Coco', 'B', 'existing-b')]);
  const result = h.api.create({ dogName: 'Coco', dogId: 'existing-b', breed: 'Cavoodle', ownerName: 'B', phone: '0400000000', startDate: '2026-10-03', endDate: '2026-10-04' });
  assert.equal(result.dogId, 'existing-b');
  assert.throws(() => h.api.create({ dogName: 'Cocoa', dogId: 'existing-b', breed: 'Cavoodle', ownerName: 'B', phone: '0400000000', startDate: '2026-10-05', endDate: '2026-10-06' }), error => error.code === 'DOG_ID_NAME_MISMATCH');
}

// Old clients can follow one persisted identity by name, while mixed or multiple identities stay ambiguous.
{
  const single = makeHarness([header, booking('Rex', 'A')]);
  assert.equal(single.api.resolve(single.rows, { dogName: 'Rex' }, 'viewing history').rows.length, 1);
  const uniqueIdRows = [header, booking('Rex', 'A', 'rex-1'), booking('Rex', 'A', 'rex-1'), booking('Rex Old Name', 'A', 'rex-1')];
  const uniqueId = makeHarness(uniqueIdRows);
  const resolved = uniqueId.api.resolve(uniqueId.rows, { dogName: 'Rex' }, 'viewing history');
  assert.equal(resolved.dogId, 'rex-1');
  assert.equal(resolved.rows.length, 3, 'Name-only resolution follows all stays for the unique persisted Dog ID');
  assert.equal(uniqueId.api.prefill({ dogName: 'Rex' }).suggested.dogId, 'rex-1');
  const multipleIds = makeHarness([header, booking('Rex', 'A', 'rex-1'), booking('Rex', 'B', 'rex-2')]);
  assert.throws(() => multipleIds.api.resolve(multipleIds.rows, { dogName: 'Rex' }, 'viewing history'), error => error.code === 'DOG_ID_AMBIGUOUS_LEGACY');
  assert.equal(multipleIds.api.prefill({ dogName: 'Rex' }).ambiguous, true);
  assert.equal(multipleIds.api.prefill({ dogName: 'Rex', dogId: 'rex-2' }).suggested.ownerName, 'B');
  const mixed = makeHarness([header, booking('Rex', 'A', 'rex-1'), booking('Rex', 'B')]);
  assert.throws(() => mixed.api.resolve(mixed.rows, { dogName: 'Rex' }, 'viewing history'), error => error.code === 'DOG_ID_AMBIGUOUS_LEGACY');
}

// The normal intake writer also creates an ID and validates explicit reuse.
{
  const h = makeHarness([header, booking('Nell', 'A', 'nell-1')]);
  const created = h.api.createIntake({ dogName: 'New Dog', breed: 'Pug', startDate: '2026-10-10', endDate: '2026-10-11' });
  assert.equal(created.dogId, 'uuid-1');
  assert.equal(h.rows[2][12], 'uuid-1');
  const reused = h.api.createIntake({ dogName: 'Nell', dogId: 'nell-1', breed: 'Pug', startDate: '2026-10-12', endDate: '2026-10-13' });
  assert.equal(reused.dogId, 'nell-1');
  assert.throws(() => h.api.createIntake({ dogName: 'Other', dogId: 'nell-1', breed: 'Pug', startDate: '2026-10-14' }), error => error.code === 'DOG_ID_NAME_MISMATCH');
}

// Profile copy follows the selected dog's ID and refuses a colliding old stay key.
{
  const profiles = [
    { stayKey: 'coco|2026-10-01|2026-10-02', dogName: 'Coco', endDate: '2026-10-02', intakeAttributes: { food: 'A' } },
    { stayKey: 'coco|2026-10-05|2026-10-06', dogName: 'Coco', endDate: '2026-10-06', intakeAttributes: { food: 'B' } }
  ];
  const dogA = booking('Coco', 'A', 'dog-a');
  const dogB = booking('Coco', 'B', 'dog-b');
  dogB[3] = '2026-10-05'; dogB[4] = '2026-10-06';
  const h = makeHarness([header, dogA, dogB], profiles);
  h.api.create({ dogName: 'Coco', dogId: 'dog-b', breed: 'Cavoodle', ownerName: 'B', phone: '0400000000', startDate: '2026-10-07', endDate: '2026-10-08', copyPreviousProfile: true });
  const copied = h.writes.find(item => item.profile);
  assert.equal(copied.profile.intakeAttributes.food, 'B', 'Only the selected dog record supplies the copied profile');
  const legacyB = booking('Coco', 'B'); legacyB[3] = '2026-10-01'; legacyB[4] = '2026-10-02';
  const legacyCollision = makeHarness([header, booking('Coco', 'A', 'dog-a'), legacyB], profiles);
  assert.throws(() => legacyCollision.api.create({ dogName: 'Coco', dogId: 'dog-a', breed: 'Cavoodle', ownerName: 'A', phone: '0400000000', startDate: '2026-10-07', endDate: '2026-10-08', copyPreviousProfile: true }), error => error.code === 'DOG_ID_AMBIGUOUS_LEGACY');
}

// Explicit backfill assigns one UUID per blank confirmed row, including same-name rows, and is idempotent.
{
  const h = makeHarness([header, booking('Coco', 'A'), booking('Coco', 'B'), booking('Scout', 'C', 'keep-me')]);
  const first = h.api.backfill();
  assert.equal(first.assigned, 2);
  assert.equal(h.rows[1][12], 'uuid-1');
  assert.equal(h.rows[2][12], 'uuid-2');
  assert.notEqual(h.rows[1][12], h.rows[2][12]);
  assert.equal(h.rows[3][12], 'keep-me');
  assert.deepEqual(h.versionTouches, ['directory']);
  const second = h.api.backfill();
  assert.equal(second.assigned, 0);
  assert.equal(second.alreadyAssigned, 3);
  assert.deepEqual(h.versionTouches, ['directory', 'directory']);
}

console.log('Dog ID backend identity tests passed.');

// A pre-existing source column in M is untouched; identity fields move to headers
// appended after it and receive unique, stable display numbers.
{
  const occupiedHeader = header.slice(0, 12).concat(['Source']);
  const first = booking('Waffle', 'A'); first[12] = 'Other';
  const second = booking('Waffle', 'A'); second[12] = 'Other';
  const third = booking('Coco', 'B'); third[12] = 'Other';
  const h = makeHarness([occupiedHeader, first, second, third]);
  const result = h.api.backfill();
  assert.equal(result.assigned, 3);
  assert.equal(h.rows[0][12], 'Source');
  assert.equal(h.rows[1][12], 'Other');
  assert.notEqual(h.rows[1][13], 'Other');
  assert.equal(h.rows[1][14], '#00001');
  assert.equal(h.rows[2][14], '#00002', 'separate legacy booking rows become distinct dog records');
  assert.equal(h.rows[3][14], '#00003');
  const idsBefore = h.rows.slice(1).map(row => row[13]);
  h.api.backfill();
  assert.deepEqual(h.rows.slice(1).map(row => row[13]), idsBefore);
  assert.deepEqual(h.rows.slice(1).map(row => row[14]), ['#00001', '#00002', '#00003']);
}

// Repeated stays for a known UUID share its dog number and do not allocate a new one.
{
  const h = makeHarness([header.concat(['Dog Number']), booking('Pip', 'A', 'pip-uuid'), booking('Pip', 'A', 'pip-uuid')]);
  h.rows[1][13] = '#00017';
  const result = h.api.backfill();
  assert.equal(result.assigned, 0);
  assert.equal(h.rows[1][13], '#00017');
  assert.equal(h.rows[2][13], '#00017');
}

// Conflicting numbers are resolved in sheet order; the later dog gets a fresh
// number above the current maximum and subsequent backfills leave it stable.
{
  const a = booking('Milo', 'A', 'milo-uuid');
  const b = booking('Coco', 'B', 'coco-uuid');
  const c = booking('Pip', 'C', 'pip-uuid');
  a[13] = '#00001'; b[13] = '#00001'; c[13] = '#00009';
  const h = makeHarness([header.concat(['Dog Number']), a, b, c]);
  assert.equal(h.api.backfill().repairedNumbers, 1);
  assert.deepEqual(h.rows.slice(1).map(row => row[13]), ['#00001', '#00010', '#00009']);
  assert.equal(h.api.backfill().repairedNumbers, 0);
  assert.deepEqual(h.rows.slice(1).map(row => row[13]), ['#00001', '#00010', '#00009']);
}

// Master-profile derivation follows Dog ID and never joins same-name profiles.
{
  const masterStart = backend.indexOf('function dogMasterKeyForIdentity_');
  const masterEnd = backend.indexOf('function parseStayPhotosJson_', masterStart);
  const historyStart = backend.indexOf('function getV108DogHistory_');
  const historyEnd = backend.indexOf('function getV108ReturningGuestPrefill_', historyStart);
  assert.ok(masterStart >= 0 && masterEnd > masterStart);
  const dogA = booking('Coco', 'A', 'dog-a');
  const dogB = booking('Coco', 'B', 'dog-b');
  dogB[3] = '2026-10-05'; dogB[4] = '2026-10-06';
  const rows = [header, dogA, dogB];
  const profiles = [
    { stayKey: 'coco|2026-10-01|2026-10-02', endDate: '2026-10-02', intakeAttributes: { marker: 'A' } },
    { stayKey: 'coco|2026-10-05|2026-10-06', endDate: '2026-10-06', intakeAttributes: { marker: 'B' } }
  ];
  const sandbox = {
    getTargetSheet_: () => ({ getDataRange: () => ({ getValues: () => rows }) }),
    getBelongingsSheet_: () => ({}),
    readBelongingsRecords_: () => profiles,
    phoneTailV108_: value => String(value || '').replace(/\D/g, '').slice(-4),
    normalizeV108Identity_: value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(),
    normalizeDateValue_: value => String(value || '').slice(0, 10),
    makeGuestStayKey_: (name, start, end) => `${String(name).toLowerCase()}|${start}|${end}`
  };
  vm.createContext(sandbox);
  vm.runInContext(`${backend.slice(helperStart, helperEnd)}\n${backend.slice(historyStart, historyEnd)}\n${backend.slice(masterStart, masterEnd)}\nthis.derive = deriveDogMasterProfile_; this.get = getDogMasterProfile_; this.history = getV108DogHistory_;`, sandbox);
  const selected = sandbox.derive('Coco', 'Cavoodle', 'dog-b');
  assert.equal(selected.profile.marker, 'B');
  assert.equal(selected.dogId, 'dog-b');
  const history = sandbox.history({ dogId: 'dog-b', dogName: 'Coco' });
  assert.equal(history.previousStays.length, 1);
  assert.equal(history.previousStays[0].ownerName, 'B');
  assert.equal(history.latestProfile.intakeAttributes.marker, 'B');
  assert.equal(sandbox.history({ dogId: 'dog-b' }).dogName, 'Coco', 'Dog ID alone is sufficient for history lookup');
  assert.throws(() => sandbox.derive('Coco', 'Cavoodle', ''), error => error.code === 'DOG_ID_AMBIGUOUS_LEGACY');
  let persistedKey = '';
  sandbox.readPersistedDogMaster_ = key => { persistedKey = key; return null; };
  sandbox.get({ dogId: 'dog-b', dogName: 'Coco', breed: 'Cavoodle', masterKey: 'coco|cavoodle' });
  assert.equal(persistedKey, 'dog|dog-b', 'An ID request cannot read an older name-keyed master profile');
  dogB[3] = '2026-10-01'; dogB[4] = '2026-10-02';
  const collisionHistory = sandbox.history({ dogId: 'dog-b', dogName: 'Coco' });
  assert.equal(collisionHistory.previousStays.length, 1);
  assert.equal(collisionHistory.latestProfile, null, 'Colliding name/date stay keys cannot leak another dog profile');
  rows.splice(1, rows.length - 1, booking('Coco', 'A', 'dog-a'));
  sandbox.get({ dogName: 'Coco', breed: 'Cavoodle', masterKey: 'coco|cavoodle' });
  assert.equal(persistedKey, 'dog|dog-a', 'A uniquely resolvable old name-only profile request uses the ID-keyed master');
}

console.log('Dog master profile identity tests passed.');

// Directory identity lists share the directory version and mutations invalidate that version.
{
  const invalidationStart = backend.indexOf('function invalidateWaffleForAction_');
  const invalidationEnd = backend.indexOf('var READ_ONLY_SHEET_ACTIONS_', invalidationStart);
  const cacheActionStart = backend.indexOf('if (action === "list_dog_identities")');
  assert.ok(invalidationStart >= 0 && invalidationEnd > invalidationStart && cacheActionStart >= 0);
  assert.match(backend.slice(cacheActionStart, cacheActionStart + 180), /getVersionedWaffleRead_\("directory", action/);
  assert.match(backend.slice(backend.indexOf('var result = processSheetActionWithV108Receipt_(data)'), backend.indexOf('if (\n      data.action === "upload_belongings_photo"')), /invalidateWaffleForAction_\(/);
  const touches = [];
  const sandbox = { touchWaffleDataVersion_: scope => touches.push(scope) };
  vm.createContext(sandbox);
  vm.runInContext(`${backend.slice(invalidationStart, invalidationEnd)}\nthis.invalidate = invalidateWaffleForAction_;`, sandbox);
  sandbox.invalidate('create_boarding');
  assert.deepEqual(touches, ['directory']);
}

console.log('Dog identity cache invalidation tests passed.');
