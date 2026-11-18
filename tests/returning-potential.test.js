const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const code = fs.readFileSync('apps-script/ReturningPotential.js', 'utf8');
const sourceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stayId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const dogId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const expectedStayKey = 'darwin dog owner|2026-11-26|2026-11-26';
const request = { stayId, sourceStayId: sourceId, dogId, expectedStayKey };

function fixture({ targetOwner = 'Darwin', conflictingDestination = false } = {}) {
  const rows = [
    ['Timestamp', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Owner', 'Phone', '', '', 'Notes', '', 'Booking Type', 'Dog ID', 'Dog Number', 'Species'],
    ['', 'Biscoff', 'Golden Retriever', '2026-11-19', '2026-11-19', 'Darwin', '0400 000 000', '', '', 'Gentle handling', '', 'Confirmed Boarding', dogId, '#00066', 'Dog'],
    ['', 'Darwin Dog Owner', 'Golden Retriever', '2026-11-26', '2026-11-26', targetOwner, '*****', '', '', 'Keep the stay note', '', 'Potential Stay', '', '', 'Dog']
  ];
  const profilePhoto = { id: 'profile-portrait' };
  let care;
  const careWrites = new Map();
  let bookingWrites = 0;
  const stayKey = (name, start, end) => `${name.toLowerCase()}|${start}|${end}`;
  const careSheet = { getRange: (_, column) => ({ setValue: value => careWrites.set(column, JSON.parse(value)) }) };
  const sheet = {
    getParent: () => ({ getSheetByName: () => null }),
    getLastColumn: () => rows[0].length,
    getRange: () => ({ getValues: () => [rows[0]] })
  };
  const globals = {
    validStayIdV11225_: id => /^[a-f0-9-]{36}$/.test(id),
    findStayRowByIdV11225_: (_, id) => id === sourceId ? 2 : id === stayId ? 3 : -1,
    auditBookingSnapshotFromSheetRow_: (_, row) => {
      const [,dogName,breed,startDate,endDate,ownerName,phone,,,notes,,bookingType] = rows[row - 1];
      return {dogName,breed,startDate,endDate,ownerName,phone,notes,bookingType};
    },
    v108DogIdentityAt_: (_, index) => ({dogId:rows[index][12],dogNumber:rows[index][13],species:'dog'}),
    isConfirmedStayBookingTypeV11225_: type => type === 'Confirmed Boarding',
    normalizeV108Identity_: value => value.trim().toLowerCase(),
    makeGuestStayKey_: stayKey,
    resolveCareBookingIdentity_: (key, id) => id || !conflictingDestination ? { ok: !!id, reason: 'no-booking-proves-stay-key' } : {ok:true},
    getBelongingsSheetReadOnly_: () => careSheet,
    getBelongingsSheet_: () => careSheet,
    readCareRecordIdentityState_: () => ({ok:true,byKey:{}}),
    getGuestProfileDetail_: () => ({resolution:{status:'resolved'},intakeAttributes:{feedingTimes:'5 pm'},dogPhoto:profilePhoto,dogPhotoGallery:[profilePhoto]}),
    readBelongingsRecords_: (_, [key]) => key.startsWith('biscoff|2026-11-19') ? [{riskFlags:{escapeRisk:true}}] : care ? [{ ...care, dogPhoto: careWrites.get(30), dogPhotoGallery: careWrites.get(33) }] : [],
    hasStoredIntakeAttributes_: attributes => Object.keys(attributes).length > 0,
    ensureV108DogIdColumn_: () => ({id:12,number:13}),
    setBookingPetSpecies_() {},
    updateStableStayRowV11225_: (_, row, changes) => {
      bookingWrites++;
      Object.entries(changes).forEach(([col,value]) => { rows[row - 1][Number(col)-1] = value; });
    },
    upsertBelongingsRecord_: (_, data) => { care = data; return 2; },
    logAuditEvent_() {},
    PropertiesService: {getScriptProperties: () => ({getProperty: () => null})}
  };
  vm.runInNewContext(code, globals);
  return { rows, careWrites, run: () => globals.linkReturningPotential_(sheet, rows, request), care: () => care, bookingWrites: () => bookingWrites };
}

test('reuses the exact Dog ID and copies reusable care and portrait without confirming the request', () => {
  const f = fixture();
  const result = f.run();
  assert.equal(result.dogNumber, '#00066');
  assert.equal(result.stayKey, 'biscoff|2026-11-26|2026-11-26');
  assert.deepEqual(f.rows[2].slice(11, 14), ['Potential Stay', dogId, '#00066']);
  assert.equal(f.rows[2][9], 'Keep the stay note');
  assert.equal(f.rows[2][6], '*****', 'the potential booking keeps its saved contact value');
  assert.equal(f.rows[1][1], 'Biscoff');
  assert.equal(f.care().intakeAttributes.feedingTimes, '5 pm');
  assert.equal(f.care().riskFlags.escapeRisk, true);
  assert.equal(f.care().items, undefined);
  assert.equal(f.care().stayPhotos, undefined);
  assert.equal(f.careWrites.get(30).id, 'profile-portrait');
  f.run();
  assert.equal(f.bookingWrites(), 1, 'retry keeps the same potential stay');
});

test('owner mismatch and duplicate destination stop before touching the booking', () => {
  for (const options of [{targetOwner:'Different owner'}, {conflictingDestination:true}]) {
    const f = fixture(options);
    assert.throws(f.run, /owner must match|Another booking/);
    assert.equal(f.bookingWrites(), 0);
    assert.equal(f.care(), undefined);
  }
});
