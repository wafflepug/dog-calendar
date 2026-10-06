const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const backend = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.js'), 'utf8');
const stayIdentity = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'StableStayIdentity.js'), 'utf8');
const careInheritance = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'DogCareInheritance.js'), 'utf8');
const careUi = fs.readFileSync(path.join(__dirname, '..', 'care.js'), 'utf8');
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
    getParent() { return { getSheetByName: () => ({
      getLastRow: () => 1,
      getMaxColumns: () => 8,
      getRange: () => ({ getValues: () => [['Client Mutation ID', 'Action', 'Payload Digest', 'State', 'Stay ID', 'Response JSON', 'Created At', 'Updated At']] })
    }) }; },
    getDataRange() { return { getValues: () => rows }; },
    getRange(row, col, numRows, numCols) {
      return {
        getValue() { return cells.get(`${row}:${col}`) || (rows[row - 1] || [])[col - 1] || ''; },
        getValues() { return Array.from({ length: numRows || 1 }, (_, r) => Array.from({ length: numCols || 1 }, (_, c) => cells.get(`${row + r}:${col + c}`) ?? ((rows[row + r - 1] || [])[col + c - 1] || ''))); },
        getDisplayValues() { return Array.from({length:numRows||1},(_,r)=>(rows[row+r-1]||[]).slice(col-1,col-1+(numCols||1)).map(value=>String(value||''))); },
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
  let sandboxLockHeld = false;
  const scriptProperties = new Map();
  const sandbox = {
    Utilities: {
      getUuid: () => uuid(++uuidCounter),
      DigestAlgorithm: { SHA_256: 'SHA-256' },
      Charset: { UTF_8: 'UTF-8' },
      formatDate: () => '2026-09-28',
      computeDigest: (_algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()],
      base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url')
    },
    LockService: { getScriptLock: () => ({ waitLock() { if (sandboxLockHeld) throw new Error('nested script lock'); sandboxLockHeld = true; }, releaseLock() { sandboxLockHeld = false; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => scriptProperties.get(key) || null, setProperty: (key, value) => scriptProperties.set(key, String(value)) }) },
    Session: { getScriptTimeZone: () => 'Australia/Sydney' },
    getTargetSheet_: () => sheet,
    getBelongingsSheet_: () => belongings,
    normalizeV108Identity_: value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(),
    phoneTailV108_: value => String(value || '').replace(/\D/g, '').slice(-4),
    normalizeDateValue_: value => String(value || '').slice(0, 10),
    makeGuestStayKey_: (name, start, end) => `${String(name).toLowerCase()}|${start}|${end}`,
    readBelongingsRecords_: () => priorProfiles,
    readStayOperations_: () => [],
    upsertBelongingsRecord_: (_sheet, record) => { writes.push({ profile: record }); return 2; },
    normalizeV108DogPhotoGallery_: gallery => gallery || [],
    touchWaffleDataVersion_: scope => versionTouches.push(scope),
    createIntakeLinkForBooking_: () => null,
    auditBookingSnapshotFromSheetRow_: (_sheet, row) => ({ dogName: rows[row - 1][1], dogId: rows[row - 1][12] || '',
      startDate: rows[row - 1][3], endDate: rows[row - 1][4], bookingType: rows[row - 1][11], stayId: rows[row - 1][14] || '' }),
    logAuditEvent_: () => {},
    console
  };
  vm.createContext(sandbox);
  const prefillStart = backend.indexOf('function getV108ReturningGuestPrefill_');
  vm.runInContext(`${stayIdentity}\n${careInheritance}\n${backend.slice(helperStart, helperEnd)}\n${backend.slice(prefillStart, copyEnd)}\n${backend.slice(createStart, createEnd)}\nthis.api = { resolve: resolveV108DogRows_, identityAt: v108DogIdentityAt_, create: createV108Boarding_, createIntake: createV108IntakeBooking_, prefill: getV108ReturningGuestPrefill_, backfill: backfillV108DogIds_, link: linkV108StayToDog_, linkable: listV108DogStaysForLinking_ };`, sandbox);
  return { api: sandbox.api, rows, writes, versionTouches, underActionLock(fn) { if (sandboxLockHeld) throw new Error('test action lock already held'); sandboxLockHeld=true; try { return fn(); } finally { sandboxLockHeld=false; } } };
}

const header = ['Timestamp', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Owner', 'Phone', '', '', 'Notes', 'Edit', 'Booking Type', 'Dog ID'];
const booking = (name, owner, id = '') => ['', name, 'Cavoodle', '2026-10-01', '2026-10-02', owner, '0400000000', '', '', '', '', 'Confirmed Boarding', id];

// Same-name dogs remain separate; a client with no selection gets a fresh ID.
{
  const h = makeHarness([header, booking('Coco', 'A', uuid(101)), booking('Coco', 'B', uuid(102))]);
  const result = h.underActionLock(() => h.api.create({ dogName: 'Coco', breed: 'Cavoodle', ownerName: 'C', phone: '0400000000', startDate: '2026-10-03', endDate: '2026-10-04' }));
  assert.equal(result.dogId, uuid(1));
  assert.equal(h.rows[3][12], uuid(1));
  assert.equal(h.rows[3].length, 16, 'Dog ID and Dog Number remain in their existing columns; Stay ID and marker append after them');
  const oldClient = h.api.create({ dogName: 'Coco', breed: 'Cavoodle', ownerName: 'D', phone: '0400000000', startDate: '2026-10-05', endDate: '2026-10-06', copyPreviousProfile: true });
  assert.ok(oldClient.dogId);
  assert.equal(oldClient.copiedPreviousProfile.copied, false);
  assert.equal(oldClient.copySkippedReason, 'review-required', 'legacy automatic profile-copy requests require the explicit review flow');
}

// Existing IDs cannot be reused for another name without the explicit rename flow.
{
  const h = makeHarness([header, booking('Coco', 'A', uuid(101)), booking('Coco', 'B', uuid(102))]);
  const result = h.api.create({ dogName: 'Coco', dogId: uuid(102), breed: 'Cavoodle', ownerName: 'B', phone: '0400000000', startDate: '2026-10-03', endDate: '2026-10-04' });
  assert.equal(result.dogId, uuid(102));
  assert.throws(() => h.api.create({ dogName: 'Cocoa', dogId: uuid(102), breed: 'Cavoodle', ownerName: 'B', phone: '0400000000', startDate: '2026-10-05', endDate: '2026-10-06' }), error => error.code === 'DOG_ID_NAME_MISMATCH');
}

// Old clients can follow one persisted identity by name, while mixed or multiple identities stay ambiguous.
{
  const single = makeHarness([header, booking('Rex', 'A')]);
  assert.equal(single.api.resolve(single.rows, { dogName: 'Rex' }, 'viewing history').rows.length, 1);
  const uniqueIdRows = [header, booking('Rex', 'A', uuid(103)), booking('Rex', 'A', uuid(103)), booking('Rex Old Name', 'A', uuid(103))];
  const uniqueId = makeHarness(uniqueIdRows);
  const resolved = uniqueId.api.resolve(uniqueId.rows, { dogName: 'Rex' }, 'viewing history');
  assert.equal(resolved.dogId, uuid(103));
  assert.equal(resolved.rows.length, 3, 'Name-only resolution follows all stays for the unique persisted Dog ID');
  assert.equal(uniqueId.api.prefill({ dogName: 'Rex' }).suggested.dogId, uuid(103));
  const multipleIds = makeHarness([header, booking('Rex', 'A', uuid(103)), booking('Rex', 'B', uuid(104))]);
  assert.throws(() => multipleIds.api.resolve(multipleIds.rows, { dogName: 'Rex' }, 'viewing history'), error => error.code === 'DOG_ID_AMBIGUOUS_LEGACY');
  assert.equal(multipleIds.api.prefill({ dogName: 'Rex' }).ambiguous, true);
  assert.equal(multipleIds.api.prefill({ dogName: 'Rex', dogId: uuid(104) }).suggested.ownerName, 'B');
  const mixed = makeHarness([header, booking('Rex', 'A', uuid(103)), booking('Rex', 'B')]);
  assert.throws(() => mixed.api.resolve(mixed.rows, { dogName: 'Rex' }, 'viewing history'), error => error.code === 'DOG_ID_AMBIGUOUS_LEGACY');
}

// The normal intake writer also creates an ID and validates explicit reuse.
{
  const h = makeHarness([header, booking('Nell', 'A', uuid(105))]);
  const created = h.underActionLock(() => h.api.createIntake({ dogName: 'New Dog', breed: 'Pug', startDate: '2026-10-10', endDate: '2026-10-11' }));
  assert.equal(created.dogId, uuid(1));
  assert.equal(h.rows[2][12], uuid(1));
  assert.equal(h.rows[2][14], uuid(2), 'the direct intake writer also assigns a distinct Stay ID');
  assert.equal(created.stayId, uuid(2));
  const reused = h.api.createIntake({ dogName: 'Nell', dogId: uuid(105), breed: 'Pug', startDate: '2026-10-12', endDate: '2026-10-13' });
  assert.equal(reused.dogId, uuid(105));
  assert.throws(() => h.api.createIntake({ dogName: 'Other', dogId: uuid(105), breed: 'Pug', startDate: '2026-10-14' }), error => error.code === 'DOG_ID_NAME_MISMATCH');
}

// Legacy automatic copy is disabled; an explicit review must name one completed source.
{
  const profiles = [
    { stayKey: 'coco|2025-10-01|2025-10-02', dogName: 'Coco', endDate: '2025-10-02', intakeAttributes: { food: 'B' }, riskFlags: {} }
  ];
  const dogA = booking('Coco', 'A', uuid(106));
  const dogB = booking('Coco', 'B', uuid(107));
  dogB[3] = '2025-10-01'; dogB[4] = '2025-10-02';
  const h = makeHarness([header, dogA, dogB], profiles);
  const legacy = h.api.create({ dogName: 'Coco', dogId: uuid(107), breed: 'Cavoodle', ownerName: 'B', phone: '0400000000', startDate: '2026-10-07', endDate: '2026-10-08', copyPreviousProfile: true });
  assert.equal(legacy.copySkippedReason, 'review-required');
  assert.equal(h.writes.some(item => item.profile), false, 'legacy copy flag cannot silently copy care values');
  const review = { confirmed:true, sourceStayId:'', sourceDogId:uuid(107), sourceStayKey:'coco|2025-10-01|2025-10-02', sourceEndDate:'2025-10-02', profile:{food:'Edited B'}, riskFlags:{} };
  const reviewed = makeHarness([header, dogA, dogB], profiles);
  reviewed.api.create({ dogName: 'Coco', dogId: uuid(107), breed: 'Cavoodle', ownerName: 'B', phone: '0400000000', startDate: '2026-10-07', endDate: '2026-10-08', inheritCareReview:review });
  const copied = reviewed.writes.find(item => item.profile);
  assert.equal(copied.profile.intakeAttributes.food, 'Edited B', 'the explicit review value is applied to the selected dog');
  const legacyB = booking('Coco', 'B'); legacyB[3] = '2025-10-01'; legacyB[4] = '2025-10-02';
  const legacyCollision = makeHarness([header, booking('Coco', 'A', uuid(106)), legacyB], profiles);
  const beforeAmbiguousReview = legacyCollision.rows.length;
  assert.throws(() => legacyCollision.api.create({ dogName: 'Coco', dogId: uuid(106), breed: 'Cavoodle', ownerName: 'A', phone: '0400000000', startDate: '2026-10-07', endDate: '2026-10-08', inheritCareReview:{...review,sourceDogId:uuid(106)} }), /ambiguous|source stay/i);
  assert.equal(legacyCollision.rows.length, beforeAmbiguousReview, 'ambiguous cross-Dog legacy keys fail before booking append');
}

// A reviewed new stay cannot claim care from an existing same-name/date stay
// or an orphan belongings key whose owner cannot be proven.
{
  const source = booking('Coco','A',uuid(106)); source[3]='2025-10-01'; source[4]='2025-10-02';
  const target = booking('Coco','B',uuid(107)); target[3]='2026-10-07'; target[4]='2026-10-08';
  const sourceKey='coco|2025-10-01|2025-10-02', targetKey='coco|2026-10-07|2026-10-08';
  const review={confirmed:true,sourceStayId:'',sourceDogId:uuid(106),sourceStayKey:sourceKey,sourceEndDate:'2025-10-02',profile:{food:'Reviewed'},riskFlags:{}};
  const records=[{stayKey:sourceKey,dogName:'Coco',endDate:'2025-10-02',intakeAttributes:{food:'Source'},riskFlags:{}},
    {stayKey:targetKey,dogName:'Coco',endDate:'2026-10-08',intakeAttributes:{food:'Dog B private'},riskFlags:{}}];
  const occupied=makeHarness([header,source,target],records), occupiedBefore=occupied.rows.length;
  assert.throws(()=>occupied.api.create({dogName:'Coco',dogId:uuid(106),breed:'Cavoodle',ownerName:'A',phone:'0400000000',startDate:'2026-10-07',endDate:'2026-10-08',inheritCareReview:review}),/already uses this stay key/i);
  assert.equal(occupied.rows.length,occupiedBefore,'existing Dog B booking is not duplicated');
  assert.equal(occupied.writes.some(item=>item.profile),false,'Dog B care profile is not overwritten');

  const legacyBlankTypeTarget=target.slice(); legacyBlankTypeTarget[11]='';
  const blankType=makeHarness([header,source,legacyBlankTypeTarget],[records[0]]), blankTypeBefore=blankType.rows.length;
  assert.throws(()=>blankType.api.create({dogName:'Coco',dogId:uuid(106),breed:'Cavoodle',ownerName:'A',phone:'0400000000',startDate:'2026-10-07',endDate:'2026-10-08',inheritCareReview:review}),/already uses this stay key/i);
  assert.equal(blankType.rows.length,blankTypeBefore,'legacy blank booking type defaults to Boarding for collision checks');
  assert.equal(blankType.writes.some(item=>item.profile),false,'blank-type Dog B care is not overwritten');

  const orphan=makeHarness([header,source],records), orphanBefore=orphan.rows.length;
  assert.throws(()=>orphan.api.create({dogName:'Coco',dogId:uuid(106),breed:'Cavoodle',ownerName:'A',phone:'0400000000',startDate:'2026-10-07',endDate:'2026-10-08',inheritCareReview:review}),/unassigned details/i);
  assert.equal(orphan.rows.length,orphanBefore,'orphan destination care key is not adopted by a new booking');
  assert.equal(orphan.writes.some(item=>item.profile),false,'orphan care details remain untouched');

  const photoOrphan=makeHarness([header,source],records), photoOrphanBefore=photoOrphan.rows.length;
  assert.throws(()=>photoOrphan.api.create({dogName:'Coco',dogId:uuid(106),breed:'Cavoodle',ownerName:'A',phone:'0400000000',startDate:'2026-10-07',endDate:'2026-10-08',inheritDogPhoto:true}),/unassigned details/i);
  assert.equal(photoOrphan.rows.length,photoOrphanBefore,'photo seeding cannot claim an orphan belongings key');
}

// Explicit backfill assigns one UUID per blank confirmed row, including same-name rows, and is idempotent.
{
  const h = makeHarness([header, booking('Coco', 'A'), booking('Coco', 'B'), booking('Scout', 'C', uuid(111))]);
  const first = h.underActionLock(() => h.api.backfill());
  assert.equal(first.assigned, 2);
  assert.equal(h.rows[1][12], uuid(1));
  assert.equal(h.rows[2][12], uuid(2));
  assert.notEqual(h.rows[1][12], h.rows[2][12]);
  assert.equal(h.rows[3][12], uuid(111));
  assert.deepEqual(h.versionTouches, ['directory']);
  const second = h.api.backfill();
  assert.equal(second.assigned, 0);
  assert.equal(second.alreadyAssigned, 3);
  assert.deepEqual(h.versionTouches, ['directory', 'directory']);
}

console.log('Dog ID backend identity tests passed.');

// Manual stay linking requires the exact reviewed row, current source identity,
// numbered target identity, row fingerprint, and explicit confirmation.
{
  const target = booking('Coco', 'A', uuid(201)); target[13] = '#00017';
  const source = booking('Coco', 'A', uuid(202)); source[3] = '2024-10-01'; source[4] = '2024-10-02'; source[13] = '#00018';
  const secondSourceStay = booking('Coco', 'A', uuid(202)); secondSourceStay[3] = '2023-10-01'; secondSourceStay[4] = '2023-10-02'; secondSourceStay[13] = '#00018';
  const h = makeHarness([header.concat(['Dog Number']), target, source, secondSourceStay]);
  const candidates = h.api.linkable();
  const selected = candidates.find(item => item.sourceRow === 3);
  assert.equal(candidates.length, 2, 'only completed past stays are offered for linking');
  assert.ok(selected.sourceFingerprint);
  assert.equal(selected.sourceDogId, uuid(202));
  const baseRequest = { sourceRow: 3, sourceFingerprint: selected.sourceFingerprint, sourceStayKey: selected.sourceStayKey, sourceDogId: uuid(202), sourceDogNumber: '#00018', targetDogId: uuid(201), confirmLink: true, confirmTargetDogId: uuid(201), confirmTargetDogNumber: '#00017' };
  assert.throws(() => h.api.link({ ...baseRequest, confirmLink: false }), error => error.code === 'DOG_ID_LINK_CONFIRMATION_REQUIRED');
  assert.throws(() => h.api.link({ ...baseRequest, confirmTargetDogId: uuid(202) }), error => error.code === 'DOG_ID_LINK_CONFIRMATION_REQUIRED');
  assert.throws(() => h.api.link({ ...baseRequest, confirmTargetDogNumber: '#00018' }), error => error.code === 'DOG_ID_LINK_TARGET_STALE');
  assert.throws(() => h.api.link({ ...baseRequest, sourceRow: 4 }), error => error.code === 'DOG_ID_LINK_SOURCE_STALE');
  const linked = h.underActionLock(() => h.api.link(baseRequest));
  assert.equal(linked.dogId, uuid(201));
  assert.equal(linked.dogNumber, '#00017');
  assert.equal(linked.sourceIdentityStaysBefore, 2);
  assert.equal(linked.sourceIdentityStaysRemaining, 1, 'linking one stay does not merge or rewrite its source identity group');
  assert.equal(linked.targetStaysBefore, 1);
  assert.equal(linked.targetStaysAfter, 2);
  assert.equal(h.rows[2][12], uuid(201));
  assert.equal(h.rows[2][13], '#00017');
  assert.equal(h.rows[3][12], uuid(202), 'other source stays remain on their original Dog ID');
}

// Header-based identity columns keep a pre-existing Source field untouched during linking.
{
  const sourceHeader = header.slice(0, 12).concat(['Source', 'Dog ID', 'Dog Number']);
  const target = booking('Milo', 'A').slice(0, 12).concat(['Other', uuid(208), '#00031']);
  const source = booking('Milo', 'A').slice(0, 12).concat(['Other', uuid(209), '#00032']);
  source[3] = '2023-09-01'; source[4] = '2023-09-02';
  const h = makeHarness([sourceHeader, target, source]);
  const selected = h.api.linkable()[0];
  h.api.link({ sourceRow: 3, sourceFingerprint: selected.sourceFingerprint, sourceStayKey: selected.sourceStayKey, sourceDogId: uuid(209), sourceDogNumber: '#00032', targetDogId: uuid(208), confirmLink: true, confirmTargetDogId: uuid(208), confirmTargetDogNumber: '#00031' });
  assert.equal(h.rows[2][12], 'Other');
  assert.equal(h.rows[2][13], uuid(208));
  assert.equal(h.rows[2][14], '#00031');
  const created = h.api.create({ dogName: 'New Dog', breed: 'Pug', ownerName: 'C', phone: '0400000000', startDate: '2026-10-10', endDate: '2026-10-11' });
  assert.equal(created.dogNumber, '#00033', 'a retired highest number remains reserved after its only stay is linked away');
}

// Different historical names require a second, explicit acknowledgement; identical
// name/date stay keys are blocked even when one exact row was selected.
{
  const target = booking('Coco', 'A', uuid(203)); target[13] = '#00021';
  const source = booking('Cocoa', 'A', uuid(204)); source[3] = '2023-10-01'; source[4] = '2023-10-02'; source[13] = '#00022';
  const h = makeHarness([header.concat(['Dog Number']), target, source]);
  const selected = h.api.linkable()[0];
  const request = { sourceRow: 3, sourceFingerprint: selected.sourceFingerprint, sourceStayKey: selected.sourceStayKey, sourceDogId: uuid(204), sourceDogNumber: '#00022', targetDogId: uuid(203), confirmLink: true, confirmTargetDogId: uuid(203), confirmTargetDogNumber: '#00021' };
  assert.throws(() => h.api.link(request), error => error.code === 'DOG_ID_LINK_NAME_CONFIRMATION_REQUIRED');
  assert.equal(h.api.link({ ...request, confirmNameMismatch: true }).dogId, uuid(203));
}
{
  const target = booking('Coco', 'A', uuid(205)); target[13] = '#00023';
  const source = booking('Coco', 'A', uuid(206)); source[3] = '2023-10-01'; source[4] = '2023-10-02'; source[13] = '#00024';
  const duplicate = booking('Coco', 'B', uuid(207)); duplicate[3] = '2023-10-01'; duplicate[4] = '2023-10-02'; duplicate[13] = '#00025';
  const h = makeHarness([header.concat(['Dog Number']), target, source, duplicate]);
  const selected = h.api.linkable().find(item => item.sourceRow === 3);
  assert.throws(() => h.api.link({ sourceRow: 3, sourceFingerprint: selected.sourceFingerprint, sourceStayKey: selected.sourceStayKey, sourceDogId: uuid(206), sourceDogNumber: '#00024', targetDogId: uuid(205), confirmLink: true, confirmTargetDogId: uuid(205), confirmTargetDogNumber: '#00023' }), error => error.code === 'DOG_ID_LINK_AMBIGUOUS_STAY');
}

console.log('Dog stay link review tests passed.');

// The public mutation route remains under the shared script lock, and the Care
// UI uses explicit stay/target review controls before calling it.
{
  const actionStart = backend.indexOf('function processSheetAction_(data)');
  const actionLock = backend.indexOf('.tryLock(5000)', actionStart);
  const linkRoute = backend.indexOf('if (data.action === "link_stay_to_dog")', actionStart);
  assert.ok(actionStart >= 0 && actionLock > actionStart && linkRoute > actionLock, 'link mutation route runs after acquiring the mutation lock');
  assert.match(backend.slice(0, backend.indexOf('function processSheetAction_(data)')), /list_dog_stays_for_linking:\s*true/);
  assert.match(careUi, /action: 'list_dog_stays_for_linking'/);
  assert.match(careUi, /action: 'list_dog_identities'/);
  assert.match(careUi, /action: 'link_stay_to_dog'/);
  assert.match(careUi, /data-care-stay-link-confirm/);
  assert.match(careUi, /confirmTargetDogNumber: dog\.dogNumber/);
  assert.match(careUi, /confirmNameMismatch: true/);
}

console.log('Dog stay link UI and route contract tests passed.');

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
  assert.equal(h.api.identityAt(h.rows, 1).dogId, uuid(1), 'the value Other in column M is not mistaken for the Dog ID');
}

// Sentinels and arbitrary strings in the Dog ID column are not identities.
{
  const h = makeHarness([header, booking('Waffle', 'A', 'Other')]);
  assert.equal(h.api.identityAt(h.rows, 1).dogId, '');
  assert.throws(() => h.api.resolve(h.rows, { dogId: 'Other' }, 'loading a profile'), error => error.code === 'DOG_ID_NOT_FOUND');
  h.underActionLock(() => h.api.backfill());
  assert.equal(h.rows[1][12], uuid(1));
}

// Repeated stays for a known UUID share its dog number and do not allocate a new one.
{
  const h = makeHarness([header.concat(['Dog Number']), booking('Pip', 'A', uuid(108)), booking('Pip', 'A', uuid(108))]);
  h.rows[1][13] = '#00017';
  const result = h.api.backfill();
  assert.equal(result.assigned, 0);
  assert.equal(h.rows[1][13], '#00017');
  assert.equal(h.rows[2][13], '#00017');
}

// Conflicting numbers are resolved in sheet order; the later dog gets a fresh
// number above the current maximum and subsequent backfills leave it stable.
{
  const a = booking('Milo', 'A', uuid(109));
  const b = booking('Coco', 'B', uuid(110));
  const c = booking('Pip', 'C', uuid(108));
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
  const dogA = booking('Coco', 'A', uuid(106));
  const dogB = booking('Coco', 'B', uuid(107));
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
    readStayOperations_: () => [],
    phoneTailV108_: value => String(value || '').replace(/\D/g, '').slice(-4),
    normalizeV108Identity_: value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(),
    normalizeDateValue_: value => String(value || '').slice(0, 10),
    makeGuestStayKey_: (name, start, end) => `${String(name).toLowerCase()}|${start}|${end}`,
    Utilities: { formatDate: () => '2026-09-28' }, Session: { getScriptTimeZone: () => 'Australia/Sydney' }
  };
  vm.createContext(sandbox);
  vm.runInContext(`${stayIdentity}\n${backend.slice(helperStart, helperEnd)}\n${backend.slice(historyStart, historyEnd)}\n${backend.slice(masterStart, masterEnd)}\nthis.derive = deriveDogMasterProfile_; this.get = getDogMasterProfile_; this.history = getV108DogHistory_;`, sandbox);
  const selected = sandbox.derive('Coco', 'Cavoodle', uuid(107));
  assert.equal(selected.profile.marker, 'B');
  assert.equal(selected.dogId, uuid(107));
  const history = sandbox.history({ dogId: uuid(107), dogName: 'Coco' });
  assert.equal(history.previousStays.length, 1);
  assert.equal(history.previousStays[0].ownerName, 'B');
  assert.equal(history.latestProfile.intakeAttributes.marker, 'B');
  assert.equal(sandbox.history({ dogId: uuid(107) }).dogName, 'Coco', 'Dog ID alone is sufficient for history lookup');
  assert.throws(() => sandbox.derive('Coco', 'Cavoodle', ''), error => error.code === 'DOG_ID_AMBIGUOUS_LEGACY');
  let persistedKey = '';
  sandbox.readPersistedDogMaster_ = key => { persistedKey = key; return null; };
  sandbox.get({ dogId: uuid(107), dogName: 'Coco', breed: 'Cavoodle', masterKey: 'coco|cavoodle' });
  assert.equal(persistedKey, `dog|${uuid(107)}`, 'An ID request cannot read an older name-keyed master profile');
  dogB[3] = '2026-10-01'; dogB[4] = '2026-10-02';
  const collisionHistory = sandbox.history({ dogId: uuid(107), dogName: 'Coco' });
  assert.equal(collisionHistory.previousStays.length, 1);
  assert.equal(collisionHistory.latestProfile, null, 'Colliding name/date stay keys cannot leak another dog profile');
  rows.splice(1, rows.length - 1, booking('Coco', 'A', uuid(106)));
  sandbox.get({ dogName: 'Coco', breed: 'Cavoodle', masterKey: 'coco|cavoodle' });
  assert.equal(persistedKey, `dog|${uuid(106)}`, 'A uniquely resolvable old name-only profile request uses the ID-keyed master');
}

console.log('Dog master profile identity tests passed.');

// Directory identity lists share the directory version and mutations invalidate that version.
{
  const invalidationStart = backend.indexOf('function invalidateWaffleForAction_');
  const invalidationEnd = backend.indexOf('var READ_ONLY_SHEET_ACTIONS_', invalidationStart);
  const cacheActionStart = backend.indexOf('if (action === "list_dog_identities")');
  assert.ok(invalidationStart >= 0 && invalidationEnd > invalidationStart && cacheActionStart >= 0);
  assert.match(backend.slice(cacheActionStart, cacheActionStart + 180), /getVersionedWaffleRead_\("directory", action/);
  const mutationStart = backend.indexOf('var result = processSheetActionWithV108Receipt_(data)');
  const mutationEnd = backend.indexOf('return jsonResponse_(result)', mutationStart);
  assert.ok(mutationStart >= 0 && mutationEnd > mutationStart);
  assert.match(backend.slice(mutationStart, mutationEnd), /invalidateWaffleForAction_\(/);
  const touches = [];
  const sandbox = { touchWaffleDataVersion_: scope => touches.push(scope) };
  vm.createContext(sandbox);
  vm.runInContext(`${backend.slice(invalidationStart, invalidationEnd)}\nthis.invalidate = invalidateWaffleForAction_;`, sandbox);
  sandbox.invalidate('create_boarding');
  assert.deepEqual(touches, ['directory']);
}

console.log('Dog identity cache invalidation tests passed.');

// Versioned identity reads must keep dog and stay request identity in their
// service-cache key, even when names and stay keys collide.
{
  const variantStart = backend.indexOf('function waffleReadVariant_');
  const variantEnd = backend.indexOf('function waffleReadCacheKey_', variantStart);
  assert.ok(variantStart >= 0 && variantEnd > variantStart);
  const cache = new Map();
  const sandbox = {
    Utilities: { formatDate: () => '2026-10-06' },
    Session: { getScriptTimeZone: () => 'UTC' },
    waffleCacheFingerprint_: value => value,
    STAY_OPERATION_IDENTITY_VERSION_V11226_: 1,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${backend.slice(variantStart, variantEnd)}\nthis.variant = waffleReadVariant_;`, sandbox);
  const base = { action: 'get_dog_master_profile', dogName: 'Coco', stayKey: 'coco|2026-10-14|2026-10-20', stayId: 'stay-a' };
  const first = sandbox.variant('get_dog_master_profile', { ...base, dogId: 'dog-a' });
  const second = sandbox.variant('get_dog_master_profile', { ...base, dogId: 'dog-b' });
  assert.notEqual(first, second, 'different dog IDs must not share a cached profile');
  const third = sandbox.variant('get_dog_master_profile', { ...base, dogId: 'dog-a', stayId: 'stay-b' });
  assert.notEqual(first, third, 'different stay IDs must not share a cached profile');
  const same = sandbox.variant('get_dog_master_profile', { ...base, dogId: 'dog-a' });
  cache.set(first, 'dog-a');
  assert.equal(cache.get(same), 'dog-a', 'identical identity context should hit the same cache key');
}

console.log('Dog identity cache variant isolation tests passed.');
