const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const moduleSource = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'DogCareInheritance.js'), 'utf8');
const photoSource = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'V11208MasterProfilePhotoSync.js'), 'utf8');

test('care inheritance requires explicit review and exact source identity', () => {
  const context = { sourceDogId: 'dog-uuid', sourceStayId: '', sourceStayKey: 'coco|2026-01-01|2026-01-02', sourceEndDate: '2026-01-02' };
  const sandbox = {};
  vm.runInNewContext(moduleSource, sandbox);
  const accepted = sandbox.validateDogCareInheritanceReviewV1_({
    confirmed: true,
    sourceDogId: 'dog-uuid', sourceStayId: '', sourceStayKey: context.sourceStayKey, sourceEndDate: context.sourceEndDate,
    profile: { feedingTimes: '7 am', empty: '', missing: null, vaccinated: false },
    riskFlags: { foodAllergy: true }
  }, context);
  assert.deepEqual(JSON.parse(JSON.stringify(accepted)), {
    profile: { feedingTimes: '7 am', vaccinated: false }, riskFlags: { foodAllergy: true }
  });
  assert.throws(() => sandbox.validateDogCareInheritanceReviewV1_({ confirmed: false }, context), /explicit review/);
  assert.throws(() => sandbox.validateDogCareInheritanceReviewV1_({
    confirmed: true, sourceDogId: 'another-dog', sourceStayKey: context.sourceStayKey, sourceEndDate: context.sourceEndDate,
    profile: {}, riskFlags: {}
  }, context), /does not match/);
});

test('review merge preserves destination values when prior care fields are missing or blank', () => {
  const sandbox = {};
  vm.runInNewContext(moduleSource, sandbox);
  const result = sandbox.mergeReviewedDogCareFieldsV1_(
    { feedingTimes: 'current stay schedule', medicalConditions: 'current note', foodAllergy: false },
    { feedingTimes: '7 am', medicalConditions: '', foodAllergy: true, unanswered: null }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    feedingTimes: '7 am', medicalConditions: 'current note', foodAllergy: true
  });
});

test('photo source uses UUID ownership and refuses a shared legacy stay key', () => {
  const dogA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const dogB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const targetRows = [
    [],
    ['', 'Luna', 'Pug', '2025-01-01', '2025-01-03', 'Owner', '0400000001', '', '', '', '', 'Boarding'],
    ['', 'Luna', 'Pug', '2025-01-01', '2025-01-03', 'Other', '0400000002', '', '', '', '', 'Boarding']
  ];
  const stayKey = 'luna|2025-01-01|2025-01-03';
  const records = [
    { stayKey, dogName: 'Luna', startDate: '2025-01-01', endDate: '2025-01-03', dogPhoto: { id: 'photo-a', url: 'https://image.test/a' } },
    { stayKey, dogName: 'Luna', startDate: '2025-01-01', endDate: '2025-01-03', dogPhoto: { id: 'photo-b', url: 'https://image.test/b' } }
  ];
  const sandbox = {
    saveDogMasterProfile_: function() {},
    getBelongingsSheet_: function() {},
    getTargetSheet_: () => ({ getDataRange: () => ({ getValues: () => targetRows }) }),
    readBelongingsRecords_: () => records,
    v108DogIdentityAt_: (_rows, index) => ({ dogId: index === 1 ? dogA : dogB }),
    normalizeDogMasterIdentity_: value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    normalizeDateValue_: value => String(value || '').slice(0, 10),
    phoneTailV108_: value => String(value || '').replace(/\D/g, '').slice(-4),
    makeGuestStayKey_: (name, start, end) => `${String(name).toLowerCase()}|${start}|${end}`,
    parseDogPhotoJson_: value => value,
    parseV108DogPhotoGalleryJson_: value => value || [],
    Utilities: { formatDate: () => '2026-01-01' },
    Session: { getScriptTimeZone: () => 'Australia/Sydney' }
  };
  vm.runInNewContext(photoSource, sandbox);
  const selected = sandbox.resolveDogMasterPhotoSourceV11208_({ dogId: dogA, stayKey, dogName: 'Luna' });
  assert.equal(selected, null, 'a colliding key owned by two different UUIDs is rejected');
  const noIdentity = sandbox.resolveDogMasterPhotoSourceV11208_({ stayKey, dogName: 'Luna', breed: 'Pug', ownerName: 'Owner', phone: '0400000001' });
  assert.equal(noIdentity, null, 'legacy lookup cannot bypass an ambiguous shared key');
});

test('confirmed UUID photo seed preserves stay photos, inherits the exact master reference, and retries through receipts', () => {
  const dogId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const stayKey = 'Luna|2026-11-01|2026-11-04';
  let currentPhoto = { id: 'stay-upload', url: 'https://image.test/stay-upload' };
  const writes = [];
  const sheet = { getRange: (_row, col) => ({
    getValue: () => col === 30 ? currentPhoto : [],
    setValue: value => { writes.push([col, value]); if (col === 30) currentPhoto = JSON.parse(value); }
  }) };
  const sandbox = {
    saveDogMasterProfile_: function() {}, getBelongingsSheet_: () => sheet,
    getTargetSheet_: () => ({ getDataRange: () => ({ getValues: () => [[], ['', 'Luna', 'Pug', '2026-11-01', '2026-11-04', 'Alex', '0400001234', '', '', '', '', 'Confirmed Boarding']] }) }),
    readBelongingsRecords_: () => [], findBelongingsRow_: () => 2, upsertBelongingsRecord_: () => 2,
    v108DogIdentityAt_: () => ({ dogId }), getDogMasterProfile_: input => { assert.equal(input.dogId, dogId); return { primaryPhoto: { id: 'master-photo', url: 'https://image.test/master' } }; },
    normalizeDogMasterIdentity_: value => String(value || '').toLowerCase(), normalizeDateValue_: value => String(value || '').slice(0, 10),
    phoneTailV108_: value => String(value || '').replace(/\D/g, '').slice(-4), makeGuestStayKey_: (_name, start, end) => `Luna|${start}|${end}`,
    parseDogPhotoJson_: value => value, parseV108DogPhotoGalleryJson_: value => value || [],
    touchWaffleDataVersion_: () => {}, normalizeV108DogPhotoGallery_: (gallery, primary) => gallery.concat(primary ? [primary] : []),
    Session: { getScriptTimeZone: () => 'Australia/Sydney' }
  };
  vm.runInNewContext(photoSource, sandbox);
  const preserved = sandbox.seedDogStayPhotoForConfirmedBookingV11208_({ dogId, stayKey, dogName: 'Luna', breed: 'Pug' });
  assert.equal(preserved.reason, 'stay-photo-present');
  assert.equal(currentPhoto.id, 'stay-upload');
  currentPhoto = null;
  const inherited = sandbox.seedDogStayPhotoForConfirmedBookingV11208_({ dogId, stayKey, dogName: 'Luna', breed: 'Pug' });
  assert.equal(inherited.applied, true);
  assert.equal(currentPhoto.id, 'master-photo');
  assert.equal(writes.some(([col]) => col === 30), true);

  const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.js'), 'utf8');
  const receipts = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'StableStayIdentity.js'), 'utf8');
  assert.match(code, /seedDogStayPhotoForConfirmedBookingV11208_\(\{dogId:dogId/);
  assert.match(code, /if \(photoRequested && !selectedDogId\)/);
  assert.match(receipts, /if \(data\.inheritDogPhoto === true\) expectedCreate\.inheritDogPhoto = true/);
  assert.match(receipts, /seedDogStayPhotoForConfirmedBookingV11208_\(\{/);
});

test('booking UI exposes opt-in inheritance, dated care and stable retry identity', () => {
  const booking = fs.readFileSync(path.join(__dirname, '..', 'phase4-booking.js'), 'utf8');
  assert.match(booking, /latestCompletedProfile/);
  assert.match(booking, /I reviewed these dated care details/);
  assert.match(booking, /sourceDogId:review\.dataset\.sourceDogId/);
  assert.match(booking, /stayIdentityVersion:1/);
  assert.match(booking, /clientMutationId:uuid\(\)/);
  assert.doesNotMatch(booking, /copyPreviousProfile:!!v\.dogId/);
  assert.match(booking, /if\(care\)payload\.inheritCareReview=care/);
  assert.match(booking, /payload\.inheritDogPhoto=true/);
});
