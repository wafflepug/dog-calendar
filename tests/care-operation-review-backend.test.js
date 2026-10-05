const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const reviewSource = fs.readFileSync(path.join(root, 'apps-script/V11217EarlyCheckout.js'), 'utf8');
const identitySource = fs.readFileSync(path.join(root, 'apps-script/StableStayIdentity.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(root, 'apps-script/Code.js'), 'utf8');
const idHelperStart = coreSource.indexOf('function v108DogIdentityAt_(rows, rowIndex) {');
const idHelperEnd = coreSource.indexOf('\nfunction formatV108DogNumber_', idHelperStart);
assert.ok(idHelperStart >= 0 && idHelperEnd > idHelperStart, 'the persisted Dog ID validator is available');

const bookingHeaders = ['Timestamp','Dog Name','Breed','Start Date','End Date','Owner','Phone','Likes','Dislikes','Notes','Edit Link','Booking Type','Stay ID','Dog ID','Dog Number'];
const opHeaders = ['Updated At','Stay Key','Dog Name','Start Date','End Date','Status','Checked In At','Checked Out At','Operational Note','Checkout Type','Checkout Reason Code','Checkout Reason','Original End Date','Actual Checkout Date','Checkout Requested By','Stay ID'];
const ID_A = '00000000-0000-4000-8000-0000000000a1';
const ID_B = '00000000-0000-4000-8000-0000000000b2';
const DOG_A = '11111111-1111-4111-8111-111111111111';
const KEY = 'milo|2026-10-04|2026-10-09';

function memorySheet(initial, parent, maxColumns = 30) {
  const rows = initial.map(row => row.slice());
  return {
    rows,
    getParent() { return parent; }, getName() { return 'Bookings'; },
    getLastRow() { return rows.length; }, getLastColumn() { return Math.max(0, ...rows.map(row => row.length)); },
    getMaxColumns() { return maxColumns; },
    getDataRange() { const width = this.getLastColumn(); return { getValues: () => rows.map(row => Array.from({length: width}, (_, i) => row[i] ?? '')) }; },
    getRange(r, c, nr = 1, nc = 1) {
      const cell = (rr, cc) => rows[rr - 1]?.[cc - 1] ?? '';
      return {
        getValues: () => Array.from({length:nr}, (_, y) => Array.from({length:nc}, (_, x) => cell(r+y,c+x))),
        getValue: () => cell(r,c), getDisplayValues() { return this.getValues().map(row => row.map(String)); },
        setValue() { throw new Error('review attempted to write a cell'); }, setValues() { throw new Error('review attempted to write cells'); }
      };
    },
    insertColumnsAfter() { throw new Error('review attempted to insert columns'); },
    appendRow() { throw new Error('review attempted to append a row'); }, deleteRow() { throw new Error('review attempted to delete a row'); }
  };
}

function booking(name, owner, id, dogId = '', start = '2026-10-04', end = '2026-10-09', type = 'Confirmed Boarding') {
  return ['2026-10-01',name,'Spaniel',start,end,owner,'','','','','',type,id,dogId,'#00001'];
}
function operation(name, key, id, reason = 'ambiguous_legacy_stay', status = 'checked_out') {
  return [new Date('2026-10-05T00:00:00Z'),key,name,'2026-10-04','2026-10-09',status,'','','','early','owner_request','Owner requested early checkout','2026-10-09','2026-10-05','Ada',id,reason];
}

function makeHarness(bookings, operations, opsHeaders = opHeaders, maxBookingColumns = 30, missingOps = false) {
  const bookSheet = memorySheet(bookings, null, maxBookingColumns);
  const opSheet = missingOps ? null : memorySheet([opsHeaders, ...operations], null, 30);
  let insertAttempts = 0;
  const spreadsheet = { getSheetByName(name) { return name === 'Stay_Operations' ? opSheet : null; }, insertSheet() { insertAttempts++; throw new Error('review attempted to create a sheet'); } };
  bookSheet.getParent = () => spreadsheet; if (opSheet) opSheet.getParent = () => spreadsheet;
  const sandbox = {
    processSheetAction_() {},
    getTargetSheet_() { return bookSheet; }, getStayOperationsSheet_() { if (!opSheet) return spreadsheet.insertSheet('Stay_Operations'); return opSheet; },
    PropertiesService: { getScriptProperties() { return { getProperty() { return 'Stay_Operations'; } }; } },
    normalizeDateValue_(value) { if (value instanceof Date) return value.toISOString().slice(0,10); return String(value || '').slice(0,10); },
    makeGuestStayKey_(name, start, end) { return `${String(name).trim().toLowerCase()}|${start}|${end}`; },
    normalizeV108Identity_(value) { return String(value || '').trim().toLowerCase(); },
    Utilities: { formatDate() { return '2026-10-06'; }, getUuid() { return ID_B; } },
    Session: { getScriptTimeZone() { return 'Australia/Sydney'; } },
    _bookings: bookSheet, _ops: opSheet, _insertAttempts() { return insertAttempts; }
  };
  vm.createContext(sandbox);
  vm.runInContext(identitySource, sandbox);
  vm.runInContext(coreSource.slice(idHelperStart, idHelperEnd), sandbox);
  vm.runInContext(reviewSource, sandbox);
  return sandbox;
}

const shared = makeHarness(
  [bookingHeaders, booking('Milo','Sam',ID_A,DOG_A), booking('Milo','Sam',ID_B,'', '2026-10-04','2026-10-09')],
  [operation('Milo',KEY,'')]
);
let review = shared.getStayOperationReviewV11217_({stayKey:KEY});
assert.equal(review.hasConflict, true);
assert.equal(review.reasonCode, 'ambiguous_legacy_stay');
assert.equal(review.operations.length, 1);
assert.equal(review.candidateBookings.length, 2, 'same name, owner and dates remain separate candidates');
assert.deepEqual(Array.from(review.candidateBookings, item => item.stayId), [ID_A,ID_B]);
assert.equal(review.candidateBookings[0].dogId, DOG_A, 'validated persisted Dog ID is shown');
assert.equal(review.candidateBookings[1].dogId, '', 'missing Dog ID remains unknown');
assert.equal(review.candidateBookings[1].ownerName, 'Sam', 'homonym fixture shares owner and dates');
assert.equal(review.candidateBookings.every(item => item.sourceOperationStayKey === KEY), true);
assert.throws(() => shared.getStayOperationReviewV11217_({}), /required/i);
assert.throws(() => shared.getStayOperationReviewV11217_({stayId:'not-a-uuid',stayKey:KEY}), /malformed/i, 'malformed explicit UUID never falls back to key');

const invalidPhysical = makeHarness(
  [bookingHeaders, booking('Milo','Sam','bad-physical-id',DOG_A)],
  [operation('Milo',KEY,'bad-physical-id','invalid_stay_id')]
);
review = invalidPhysical.getStayOperationReviewV11217_({stayKey:KEY});
assert.equal(review.operations[0].identityStayId, 'bad-physical-id', 'physical malformed ID attribution is retained');
assert.equal(review.candidateBookings[0].stayId, 'bad-physical-id');
assert.throws(() => invalidPhysical.getStayOperationReviewV11217_({stayId:'bad-physical-id',stayKey:KEY}), /malformed/i);

const duplicateAcrossTypes = makeHarness(
  [bookingHeaders, booking('Milo','Sam',ID_A,DOG_A), booking('Potential Milo','Sam',ID_A,'','2026-11-01','2026-11-02','Potential Stay')],
  [operation('Milo',KEY,ID_A,'duplicate_stay_id')]
);
review = duplicateAcrossTypes.getStayOperationReviewV11217_({stayId:ID_A,stayKey:'unrelated|2026-11-01|2026-11-02'});
assert.equal(review.candidateBookings.length, 2, 'UUID scope includes raw duplicate ID evidence across booking types');
assert.equal(review.candidateBookings[1].bookingType, 'Potential Stay');
assert.equal(review.candidateBookings[1].eligibleOperationOwner, false);
assert.equal(review.target.stayKey, 'unrelated|2026-11-01|2026-11-02');
assert.equal(review.candidateBookings.every(item => item.sourceOperationStayKey === KEY), true, 'a contradictory supplied key does not broaden canonical UUID scope');

const missingBooking = makeHarness([bookingHeaders], [operation('Milo',KEY,ID_A,'missing_booking')]);
review = missingBooking.getStayOperationReviewV11217_({stayId:ID_A});
assert.equal(review.reasonCode, 'missing_booking');
assert.equal(review.candidateBookings.length, 0);
const noConflict = makeHarness([bookingHeaders, booking('Milo','Sam',ID_A,DOG_A)], []);
review = noConflict.getStayOperationReviewV11217_({stayId:ID_A});
assert.equal(review.hasConflict, false);
assert.equal(review.operations.length, 0);
const noOperationSheet = makeHarness([bookingHeaders, booking('Milo','Sam',ID_A,DOG_A)], [], opHeaders, 30, true);
review = noOperationSheet.getStayOperationReviewV11217_({stayId:ID_A});
assert.equal(review.hasConflict, false, 'a missing operations sheet is an empty read result');
assert.equal(noOperationSheet._insertAttempts(), 0, 'review never creates a missing Stay_Operations sheet');
const duplicateBookingOnly = makeHarness(
  [bookingHeaders, booking('Milo','Sam',ID_A,DOG_A), booking('Milo','Lee',ID_A)], [], opHeaders, 30, true
);
review = duplicateBookingOnly.getStayOperationReviewV11217_({stayId:ID_A});
assert.equal(review.hasConflict, true, 'duplicate booking IDs are reviewable without operation rows');
assert.equal(review.reasonCode, 'duplicate_booking_stay_id');
assert.equal(review.operations.length, 0, 'booking-only evidence does not invent an operation');
assert.equal(review.candidateBookings.length, 2);
assert.equal(review.candidateBookings[0].sourceOperationStayId, '', 'booking-only evidence does not claim an operation owner');
assert.equal(duplicateBookingOnly._insertAttempts(), 0, 'booking-only review still cannot create Stay_Operations');
const ambiguousBookingOnly = makeHarness(
  [bookingHeaders, booking('Milo','Sam',ID_A,DOG_A), booking('Milo','Lee',ID_B)], [], opHeaders, 30, true
);
review = ambiguousBookingOnly.getStayOperationReviewV11217_({stayKey:KEY});
assert.equal(review.hasConflict, true, 'an ID-less same-key booking selection exposes ambiguity without operation rows');
assert.equal(review.reasonCode, 'ambiguous_legacy_stay');
assert.equal(review.operations.length, 0);
assert.equal(review.candidateBookings.length, 2);
const healthyUuidScope = ambiguousBookingOnly.getStayOperationReviewV11217_({stayId:ID_A});
assert.equal(healthyUuidScope.hasConflict, false, 'a unique UUID stays healthy even when another booking shares its legacy key');

const unrelatedFilter = makeHarness(
  [bookingHeaders, booking('Milo','',ID_A,DOG_A), booking('Milo','Sam',ID_B), booking('Other Dog','Taylor','00000000-0000-4000-8000-0000000000c3')],
  [operation('Milo',KEY,'','ambiguous_legacy_stay'), operation('Other Dog','other dog|2026-10-04|2026-10-09','')]
);
review = unrelatedFilter.getStayOperationReviewV11217_({stayKey:KEY});
assert.equal(review.operations.length, 1, 'a scoped key read omits unrelated quarantine records');
assert.equal(review.candidateBookings.length, 2);
assert.equal(review.candidateBookings[0].ownerName, '', 'unknown owner remains empty');

const movedDate = makeHarness(
  [bookingHeaders, booking('Milo','Sam',ID_A,DOG_A,'2026-10-06','2026-10-12'), booking('Milo','Sam',ID_A,'','2026-10-06','2026-10-12')],
  [operation('Milo',KEY,ID_A,'duplicate_stay_id')]
);
review = movedDate.getStayOperationReviewV11217_({stayId:ID_A});
assert.equal(review.candidateBookings[0].startDate, '2026-10-06', 'review resolves current dates from the complete booking rows');

const many = Array.from({length:25}, (_, i) => booking(`Milo ${i}`,'Sam',ID_A));
const bounded = makeHarness([bookingHeaders, ...many], [operation('Milo',KEY,ID_A,'duplicate_stay_id')]);
review = bounded.getStayOperationReviewV11217_({stayId:ID_A});
assert.equal(review.candidateBookings.length, 20);
assert.equal(review.truncated.candidateBookings, true);
const manyOperations = makeHarness(
  [bookingHeaders, booking('Milo','Sam',ID_A,DOG_A), booking('Milo','Sam',ID_B)],
  Array.from({length:25}, () => operation('Milo',KEY,''))
);
review = manyOperations.getStayOperationReviewV11217_({stayKey:KEY});
assert.equal(review.operations.length, 20);
assert.equal(review.truncated.operations, true);
assert.equal(review.truncated.candidateBookings, true);

const narrowHeaders = ['Timestamp','Dog Name','Breed','Start Date','End Date','Owner','Phone','Likes'];
const oldOps = makeHarness([narrowHeaders, ['2026-10-01','Milo','Spaniel','2026-10-04','2026-10-09','Sam','','']], [operation('Milo',KEY,'')], ['Updated At','Stay Key','Dog Name'], 8);
assert.equal(oldOps._bookings.getLastColumn(), 8);
assert.equal(oldOps._ops.rows[0].length, 3);
oldOps.getStayOperationReviewV11217_({stayKey:KEY});
assert.equal(oldOps._bookings.getLastColumn(), 8, 'read preserves booking header width');
assert.deepEqual(oldOps._ops.rows[0], ['Updated At','Stay Key','Dog Name'], 'read preserves operation headers');

const code = fs.readFileSync(path.join(root, 'apps-script/Code.js'), 'utf8');
assert.match(code, /get_stay_operation_review:\s*true/, 'review action is registered as read-only');
assert.match(code, /stayOperationReviewVersion:\s*typeof STAY_OPERATION_REVIEW_VERSION_V11217_/, 'live version capability is advertised');
assert.match(code, /getStayOperationReviewV11217_\(data\)/, 'read-only router dispatches the selected review');
console.log('Care operation review backend tests passed');
