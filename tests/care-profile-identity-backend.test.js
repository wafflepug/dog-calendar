const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('apps-script/Code.js', 'utf8');
const start = source.indexOf('function readGuestProfileRowsReadOnly_(');
const end = source.indexOf('function getGuestBelongingsDetail_(', start);
const getterStart = source.indexOf('function getBelongingsHeaders_(');
const getterEnd = source.indexOf('function getBelongingsSheet_(', getterStart);
assert(start >= 0 && end > start && getterStart >= 0 && getterEnd > getterStart);
const backendCode = source.slice(start, end);
const headerCode = source.slice(getterStart, getterEnd);
const ids = {
  a: '00000000-0000-4000-8000-000000000001',
  b: '00000000-0000-4000-8000-000000000002',
  dogA: '10000000-0000-4000-8000-000000000001'
};
const key = 'milo|2026-10-01|2026-10-03';
const defaultBookingHeaders = ['Timestamp','Dog Name','Breed','Start Date','End Date','Owner','Contact','x','x','Notes','x','Booking Type','Dog ID','Stay ID'];
const itemConfig = ['Water Bowls','Food Bowls','Blankets','Beds','Pet Crates','Toys','Leads / Harnesses','Medication','Other'].map(label => ({ label }));
const riskConfig = ['Escape Risk','Food Allergy','Medicated','Separation Anxiety','Weight Management'].map(label => ({ label }));

function harness({ bookings = [], care = [{ stayKey: key, dogName: 'Milo', intakeAttributes: { medicationInstructions: 'Fixture care detail' } }], bookingHeaders = defaultBookingHeaders, careHeaderEdit = null, transportFailure = null } = {}) {
  const writes = [];
  const sandbox = {
    BELONGINGS_ITEM_CONFIG_: itemConfig,
    BELONGINGS_RISK_CONFIG_: riskConfig,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'Pet_Belongings' }) },
    makeGuestStayKey_: (name, start, end) => `${String(name).trim().toLowerCase()}|${start}|${end}`,
    validStayIdV11225_: value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim()),
    parseDogPhotoJson_: () => null,
    parseIntakeAttributesJson_: value => JSON.parse(value || '{}'),
    parseV108DogPhotoGalleryJson_: () => [],
    parseStayPhotosJson_: () => [],
  };
  vm.runInNewContext(`${headerCode}\nthis.getHeaders=getBelongingsHeaders_;`, sandbox);
  const careHeaders = sandbox.getHeaders();
  if (careHeaderEdit) careHeaderEdit(careHeaders);
  const careRows = care.map(record => {
    const row = Array(careHeaders.length).fill('');
    row[1] = record.stayKey;
    row[2] = record.dogName || 'Milo';
    row[30] = JSON.stringify(record.intakeAttributes || {});
    return row;
  });
  const careSheet = care.length ? {
    getLastRow: () => careRows.length + 1,
    getLastColumn: () => careHeaders.length,
    getRange: (r, c, n, w) => ({
      getValues: () => (r === 1 ? [careHeaders] : careRows.slice(r - 2, r - 2 + n)).map(row => row.slice(c - 1, c - 1 + w)),
      setValue: () => writes.push('setValue'),
      setValues: () => writes.push('setValues')
    })
  } : null;
  const bookingSheet = {
    getDataRange: () => {
      if (transportFailure) throw transportFailure;
      return { getValues: () => [bookingHeaders, ...bookings] };
    },
    getParent: () => ({ getSheetByName: name => name === 'Pet_Belongings' ? careSheet : null })
  };
  sandbox.getTargetSheet_ = () => bookingSheet;
  vm.runInNewContext(`${backendCode}\nthis.readProfile=getGuestProfileDetail_;`, sandbox);
  return { read: sandbox.readProfile, writes };
}
function booking(stayId, dogId = ids.dogA, name = 'Milo', start = '2026-10-01', end = '2026-10-03') {
  return ['2026-09-01',name,'Lab',start,end,'Owner','555','','','','','Boarding',dogId,stayId];
}

test('stable ID resolves a unique legacy row and echoes normalized identity without writes', () => {
  const h = harness({ bookings: [booking(ids.a, ids.dogA.toUpperCase())] });
  const record = h.read({ stayKey: key, stayId: ids.a, dogId: ids.dogA.toUpperCase() });
  assert.equal(record.resolution.status, 'resolved');
  assert.equal(record.resolution.method, 'stay-id-unique-legacy-key');
  assert.deepEqual(JSON.parse(JSON.stringify(record.identity)), { stayKey: key, stayId: ids.a, dogId: ids.dogA });
  assert.equal(record.intakeAttributes.medicationInstructions, 'Fixture care detail');
  assert.deepEqual(h.writes, []);
});

test('same-key stays with different IDs never disclose the shared legacy profile', () => {
  const h = harness({ bookings: [booking(ids.a), booking(ids.b)] });
  for (const id of [ids.a, ids.b]) {
    const record = h.read({ stayKey: key, stayId: id });
    assert.equal(record.resolution.status, 'unresolved');
    assert.deepEqual(JSON.parse(JSON.stringify(record.intakeAttributes)), {});
  }
  assert.equal(h.read({ stayKey: key }).resolution.reason, 'multiple-bookings-share-stay-key');
});

test('duplicate identity headers, malformed persisted IDs, and reused IDs fail closed', () => {
  const duplicateHeaders = [...defaultBookingHeaders, 'Stay ID'];
  assert.equal(harness({ bookings: [booking(ids.a)], bookingHeaders: duplicateHeaders }).read({ stayKey: key, stayId: ids.a }).resolution.reason, 'duplicate-identity-headers');
  const duplicateDogHeaders = [...defaultBookingHeaders, 'Dog ID'];
  assert.equal(harness({ bookings: [booking(ids.a)], bookingHeaders: duplicateDogHeaders }).read({ stayKey: key, stayId: ids.a }).resolution.reason, 'duplicate-identity-headers');
  assert.equal(harness({ bookings: [booking('broken')] }).read({ stayKey: key }).resolution.reason, 'invalid-persisted-id');
  const otherKey = 'milo|2026-10-05|2026-10-07';
  const reused = harness({ bookings: [booking(ids.a), booking(ids.a, ids.dogA, 'Milo', '2026-10-05', '2026-10-07')] });
  assert.equal(reused.read({ stayKey: key, stayId: ids.a }).resolution.status, 'unresolved');
  assert.equal(reused.read({ stayKey: key }).resolution.reason, 'invalid-persisted-id');
  assert.deepEqual(JSON.parse(JSON.stringify(reused.read({ stayKey: otherKey, stayId: ids.a }).intakeAttributes)), {});
});

test('invalid and conflicting request IDs fail closed', () => {
  const h = harness({ bookings: [booking(ids.a)] });
  assert.equal(h.read({ stayKey: key, stayId: 'not-a-uuid' }).resolution.reason, 'invalid-id');
  assert.equal(h.read({ stayKey: key, stayId: ids.a, dogId: ids.b }).resolution.status, 'unresolved');
  assert.equal(h.read({ stayKey: key, stayId: ids.a, dogId: 'not-a-uuid' }).resolution.reason, 'invalid-id');
});

test('unique no-ID legacy booking remains readable without migration', () => {
  const record = harness({ bookings: [booking('')] }).read({ stayKey: key });
  assert.equal(record.resolution.status, 'resolved');
  assert.equal(record.resolution.method, 'legacy-key-unique');
  assert.equal(record.identity.stayId, '');
  assert.equal(record.intakeAttributes.medicationInstructions, 'Fixture care detail');
});

test('Dog ID proves a unique legacy booking when its persisted Stay ID is absent', () => {
  const h = harness({ bookings: [booking('', ids.dogA.toUpperCase())] });
  const record = h.read({ stayKey: key, dogId: ids.dogA });
  assert.equal(record.resolution.status, 'resolved');
  assert.equal(record.resolution.method, 'legacy-key-unique');
  assert.deepEqual(JSON.parse(JSON.stringify(record.identity)), { stayKey: key, stayId: '', dogId: ids.dogA });
  assert.equal(record.intakeAttributes.medicationInstructions, 'Fixture care detail');
  assert.deepEqual(h.writes, []);
});

test('Dog ID cannot resolve a legacy row with a missing or different persisted Dog ID', () => {
  const missing = harness({ bookings: [booking('', '')] }).read({ stayKey: key, dogId: ids.dogA });
  assert.equal(missing.resolution.status, 'unresolved');
  assert.equal(missing.resolution.reason, 'dog-id-key-or-persisted-id-conflict');
  assert.deepEqual(JSON.parse(JSON.stringify(missing.intakeAttributes)), {});
  const different = harness({ bookings: [booking('', ids.b)] }).read({ stayKey: key, dogId: ids.dogA });
  assert.equal(different.resolution.status, 'unresolved');
  assert.equal(different.resolution.reason, 'dog-id-key-or-persisted-id-conflict');
  assert.deepEqual(JSON.parse(JSON.stringify(different.intakeAttributes)), {});
});

test('same dog across different stays still requires the exact unique Stay ID', () => {
  const otherKey = 'milo|2026-10-05|2026-10-07';
  const h = harness({ bookings: [
    booking(ids.a, ids.dogA),
    booking(ids.b, ids.dogA, 'Milo', '2026-10-05', '2026-10-07')
  ], care: [
    { stayKey: key, dogName: 'Milo' },
    { stayKey: otherKey, dogName: 'Milo' }
  ] });
  const record = h.read({ stayKey: otherKey, stayId: ids.b, dogId: ids.dogA });
  assert.equal(record.resolution.status, 'resolved');
  assert.equal(record.resolution.method, 'stay-id-unique-legacy-key');
  assert.equal(record.identity.stayId, ids.b);
  assert.equal(h.read({ stayKey: otherKey, stayId: ids.a, dogId: ids.dogA }).resolution.status, 'unresolved');
  assert.equal(h.read({ stayKey: otherKey, dogId: ids.dogA }).resolution.status, 'resolved');
});

test('Dog ID does not disambiguate duplicate legacy stay keys', () => {
  const h = harness({ bookings: [booking('', ids.dogA), booking('', ids.dogA)] });
  const record = h.read({ stayKey: key, dogId: ids.dogA });
  assert.equal(record.resolution.status, 'unresolved');
  assert.equal(record.resolution.reason, 'multiple-bookings-share-stay-key');
  assert.deepEqual(JSON.parse(JSON.stringify(record.intakeAttributes)), {});
});

test('missing, duplicate, or altered Care rows never return shared details', () => {
  const missing = harness({ bookings: [booking(ids.a)], care: [] }).read({ stayKey: key, stayId: ids.a });
  assert.equal(missing.resolution.status, 'not_found');
  assert.deepEqual(JSON.parse(JSON.stringify(missing.intakeAttributes)), {});
  const duplicateCare = harness({ bookings: [booking(ids.a)], care: [{ stayKey: key }, { stayKey: key }] }).read({ stayKey: key, stayId: ids.a });
  assert.equal(duplicateCare.resolution.reason, 'multiple-care-records-share-stay-key');
  const alteredHeader = harness({ bookings: [booking(ids.a)], careHeaderEdit: headers => { headers[30] = 'Unexpected Profile Field'; } }).read({ stayKey: key, stayId: ids.a });
  assert.equal(alteredHeader.resolution.reason, 'invalid-care-sheet-schema');
  assert.deepEqual(JSON.parse(JSON.stringify(alteredHeader.intakeAttributes)), {});
});

test('booking sheet transport failures remain exceptions', () => {
  const failure = new Error('synthetic read transport failure');
  assert.throws(() => harness({ transportFailure: failure }).read({ stayKey: key, stayId: ids.a }), /synthetic read transport failure/);
});

test('get_guest_profile dispatcher forwards the full identity request', () => {
  assert.match(source, /getGuestProfileDetail_\(\s*data\s*\)/);
});

test('client identity cache variants differ for equal keys and distinct stable IDs', () => {
  const app = fs.readFileSync('waffle-app.js', 'utf8');
  const start = app.indexOf('function getDirectoryProfileReadIdentity(');
  const end = app.indexOf('function directoryProfileRecordMatchesIdentity(', start);
  assert(start >= 0 && end > start);
  const browser = {};
  vm.runInNewContext(`${app.slice(start, end)}\nthis.identity=getDirectoryProfileReadIdentity;`, browser);
  const first = browser.identity({ dataset: { directoryStayKey: key, directoryStayId: ids.a } });
  const second = browser.identity({ dataset: { directoryStayKey: key, directoryStayId: ids.b } });
  assert.notEqual(first.cacheKey, second.cacheKey);
});
