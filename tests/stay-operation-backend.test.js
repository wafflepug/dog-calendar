const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'V11217EarlyCheckout.js'), 'utf8');
const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.js'), 'utf8');
const stayIdentity = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'StableStayIdentity.js'), 'utf8');
const deleteSource = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'V11198ConfirmedStayDelete.js'), 'utf8');
const coreStart = code.indexOf('function processSheetAction_(data) {');
const coreEnd = code.indexOf('var WAFFLE_SPREADSHEET_CACHE_', coreStart);
assert.ok(coreStart >= 0 && coreEnd > coreStart, 'actual core operation router is present');
const dateStart = code.indexOf('function updateV108BoardingDates_(data) {');
const dateEnd = code.indexOf('function updateV108MeetGreetSchedule_(data)', dateStart);
assert.ok(dateStart >= 0 && dateEnd > dateStart, 'actual date update handler is present');
const ID_A = '00000000-0000-4000-8000-0000000000a1';
const ID_B = '00000000-0000-4000-8000-0000000000b2';
const headers = ['Timestamp','Dog Name','Breed','Start Date','End Date','Owner','Phone','Likes','Dislikes','Notes','Edit Link','Booking Type','Stay ID','Last Stay Mutation ID'];

function sheet(rows, parent, maxColumns = 30) {
  const data = rows.map(row => row.slice());
  const api = {
    rows: data,
    getParent() { return parent; }, getName() { return 'Bookings'; }, getLastRow() { return data.length; },
    getLastColumn() { return Math.max(0, ...data.map(row => row.length)); }, getMaxColumns() { return maxColumns; },
    getDataRange() { const w = this.getLastColumn(); return { getValues: () => data.map(r => Array.from({ length: w }, (_, i) => r[i] ?? '')) }; },
    getRange(r, c, nr = 1, nc = 1) {
      const cell = (rr, cc) => { while (data.length < rr) data.push([]); while (data[rr - 1].length < cc) data[rr - 1].push(''); return data[rr - 1][cc - 1] ?? ''; };
      return {
        getValues: () => Array.from({ length: nr }, (_, y) => Array.from({ length: nc }, (_, x) => cell(r + y, c + x))),
        getDisplayValues() { return this.getValues().map(row => row.map(String)); }, getValue: () => cell(r, c), getDisplayValue: () => String(cell(r, c)),
        setValue(v) { cell(r, c); data[r - 1][c - 1] = v; },
        setValues(values) { values.forEach((line, y) => line.forEach((v, x) => { cell(r + y, c + x); data[r + y - 1][c + x - 1] = v; })); }
      };
    },
    appendRow(row) { data.push(row.slice()); }, deleteRow(row) { data.splice(row - 1, 1); }, insertColumnsAfter(after, count) { maxColumns += count; data.forEach(r => { for (let i = 0; i < count; i++) r.splice(after, 0, ''); }); },
    setFrozenRows() {}
  };
  return api;
}

function harness(bookings, operations) {
  const ss = { getSheetByName(name) { return name === 'Stay_Operations' ? ops : null; }, insertSheet() { return ops; } };
  const bookingSheet = sheet(bookings, ss), ops = sheet(operations, ss);
  let held = false, tries = 0;
  const sandbox = {
    console, processSheetAction_() {}, WAFFLE_V11225_RECEIPT_LOCK_HELD_: false, isReadOnlySheetAction_() { return false; }, getStayOperationsHeaders_() { return headers.slice(0, 15); },
    SpreadsheetApp: { flush() {} },
    getStayOperationsSheet_() { return ops; }, getTargetSheet_() { return bookingSheet; },
    PropertiesService: { getScriptProperties() { return { getProperty() { return 'Stay_Operations'; } }; } },
    LockService: { getScriptLock() { return { tryLock() { tries++; if (held) return false; held = true; return true; }, releaseLock() { held = false; } }; } },
    Utilities: { formatDate() { return '2026-10-05'; }, getUuid() { return '00000000-0000-4000-8000-0000000000c3'; } }, Session: { getScriptTimeZone() { return 'Australia/Sydney'; } },
    normalizeDateValue_(v) { if (v instanceof Date) return v.toISOString().slice(0, 10); return String(v || '').slice(0, 10); },
    makeGuestStayKey_(name, start, end) { return [String(name).toLowerCase(), start, end].join('|'); },
    normalizeV108Identity_(v) { return String(v || '').toLowerCase().trim(); },
    v108DogIdentityAt_() { return { dogId: '' }; },
    findV108BoardingRowForUpdate_() { return 2; },
    auditBookingSnapshotFromSheetRow_(sh, row) { const r = sh.getRange(row, 1, 1, 14).getValues()[0]; return { dogName: r[1], startDate: String(r[3]), endDate: String(r[4]), bookingType: r[11], stayId: r[12] }; },
    updateStableStayRowV11225_(sh, row, changes) { Object.keys(changes).forEach(k => sh.getRange(row, Number(k)).setValue(changes[k])); },
    migrateBelongingsIdentityForGuest_() {}, migrateIntakeIdentitiesForGuest_() {},
    touchWaffleDataVersion_() {}, logAuditEvent_() {}, syncDogMasterProfileFromStay_() {},
    normalizeDateValue: null,
    _held(value) { held = value; }, _tries() { return tries; }, _bookings: bookingSheet, _ops: ops
  };
  vm.createContext(sandbox);
  vm.runInContext(stayIdentity, sandbox);
  vm.runInContext(code.slice(coreStart, coreEnd), sandbox);
  vm.runInContext(code.slice(dateStart, dateEnd), sandbox);
  vm.runInContext(deleteSource, sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

function booking(id, owner, start = '2026-10-04', end = '2026-10-09') {
  return ['2026-10-01','Ralph','Staffy',start,end,owner,'','','','','','Confirmed Boarding',id,''];
}
const opHeaders = ['Updated At','Stay Key','Dog Name','Start Date','End Date','Status','Checked In At','Checked Out At','Operational Note','Checkout Type','Checkout Reason Code','Checkout Reason','Original End Date','Actual Checkout Date','Checkout Requested By'];
function op(id, key, status = 'expected') { return [new Date('2026-10-04T00:00:00Z'),key,'Ralph','2026-10-04','2026-10-09',status,'','','','','','','','','',id]; }

const key = 'ralph|2026-10-04|2026-10-09';
const api = harness([headers, booking(ID_A, 'Ada'), booking(ID_B, 'Lee')], [opHeaders.concat(['Stay ID','Unknown']), op(ID_A, key, 'checked_in').concat(['keep-a']), op(ID_B, key, 'checked_out').concat(['keep-b'])]);
let records = api.readStayOperations_({ stayKeys: [key], stayIds: [ID_A, ID_B] });
assert.equal(records[0].stayId, ID_A);
assert.equal(records[1].stayId, ID_B);
assert.equal(records[0].identityConflict, undefined);
assert.equal(api._ops.rows[0][15], 'Stay ID', 'read must not alter the Stay ID header');

api.setStayOperationalStatus_({ stayId: ID_A, stayKey: key, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09' }, 'checked_out');
records = api.readStayOperations_({ stayIds: [ID_A] });
assert.equal(records.length, 1);
assert.equal(records[0].stayId, ID_A);
assert.equal(records[0].status, 'checked_out');
assert.equal(api._ops.rows[1][16], 'keep-a', 'unknown extra data remains intact');
assert.throws(() => api.setStayOperationalStatus_({ stayId: 'bad-id', stayKey: key, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09' }, 'checked_in'), /malformed/i);
assert.throws(() => api.setStayOperationalStatus_({ stayId: ID_A, stayKey: key, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09', ownerName: 'Lee' }, 'checked_in'), /owner/i);
assert.throws(() => api.setStayOperationalStatus_({ stayId: '00000000-0000-4000-8000-000000000099', stayKey: key, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09' }, 'checked_in'), /does not identify/i);

const malformed = harness([headers, booking(ID_A, 'Ada')], [opHeaders.concat(['Stay ID']), op('not-a-uuid', key)]);
assert.equal(malformed.readStayOperations_()[0].identityConflictReason, 'invalid_stay_id');
const malformedBooking = harness([headers, booking('not-a-uuid', 'Ada')], [opHeaders, [new Date(), key, 'Ralph','2026-10-04','2026-10-09','checked_out']]);
assert.equal(malformedBooking.readStayOperations_()[0].identityConflictReason, 'invalid_stay_id');
const duplicate = harness([headers, booking(ID_A, 'Ada'), booking(ID_A, 'Lee')], [opHeaders.concat(['Stay ID']), op(ID_A, key)]);
assert.equal(duplicate.readStayOperations_()[0].identityConflictReason, 'duplicate_stay_id');
assert.equal(duplicate.readStayOperations_({ stayIds: [ID_A] })[0].identityConflictReason, 'duplicate_stay_id', 'filtered UUID reads retain relevant quarantine evidence');
const duplicateOtherType = booking(ID_A, 'Lee'); duplicateOtherType[11] = 'Potential Stay';
assert.equal(harness([headers, booking(ID_A, 'Ada'), duplicateOtherType], [opHeaders.concat(['Stay ID']), op(ID_A, key)]).readStayOperations_()[0].identityConflictReason, 'duplicate_stay_id', 'duplicate IDs on potential rows also quarantine an operation');
const ambiguous = harness([headers, booking(ID_A, 'Ada'), booking(ID_B, 'Lee')], [opHeaders, [new Date(), key, 'Ralph','2026-10-04','2026-10-09','checked_out']]);
assert.equal(ambiguous.readStayOperations_()[0].identityConflictReason, 'ambiguous_legacy_stay');
assert.throws(() => ambiguous.updateV108BoardingDates_({ stayId: ID_A, startDate: '2026-10-04', endDate: '2026-10-12' }), /ambiguous ownership/i);
assert.equal(ambiguous._bookings.rows[1][4], '2026-10-09', 'a date move cannot make ambiguous status look uniquely owned by the remaining dog');
assert.throws(() => ambiguous.deleteConfirmedStayV11198_({ stayId: ID_A, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09' }), /ambiguous ownership/i);
assert.equal(ambiguous._bookings.rows.length, 3);
assert.equal(ambiguous._ops.rows[0].includes('Stay ID'), false, 'failed ambiguous mutations do not assign an operation UUID');

const legacy = harness([headers, booking(ID_A, 'Ada')], [opHeaders, [new Date(), key, 'Ralph','2026-10-04','2026-10-09','checked_out','','2026-10-05T01:00:00Z','','early','owner_request','Owner requested early checkout','2026-10-09','2026-10-05','Ada']]);
legacy.updateV108BoardingDates_({ stayId: ID_A, startDate: '2026-10-06', endDate: '2026-10-12' });
records = legacy.readStayOperations_({ stayIds: [ID_A], stayKeys: ['ralph|2026-10-06|2026-10-12'] });
assert.equal(records[0].stayId, ID_A);
assert.equal(records[0].originalEndDate, '2026-10-09');
assert.equal(records[0].actualCheckoutDate, '2026-10-05');
assert.equal(records[0].isEarlyCheckout, true);
legacy.setStayOperationalStatus_({ stayId: ID_A, stayKey: 'ralph|2026-10-06|2026-10-12', dogName: 'Ralph', startDate: '2026-10-06', endDate: '2026-10-12' }, 'checked_out');
records = legacy.readStayOperations_({ stayIds: [ID_A] });
assert.equal(records[0].originalEndDate, '2026-10-09', 'standard checkout keeps prior early-checkout schedule');
assert.equal(records[0].actualCheckoutDate, '2026-10-05', 'checkout retry preserves the actual checkout date');

const dateMoveWithoutId = harness([headers, booking('', 'Ada')], [opHeaders, [new Date(), key, 'Ralph','2026-10-04','2026-10-09','checked_out','','2026-10-05T01:00:00Z','','early','owner_request','Owner requested early checkout','2026-10-09','2026-10-05','Ada']]);
dateMoveWithoutId.updateV108BoardingDates_({ dogName: 'Ralph', originalStartDate: '2026-10-04', originalEndDate: '2026-10-09', startDate: '2026-10-06', endDate: '2026-10-12' });
const generatedStayId = String(dateMoveWithoutId._bookings.getRange(2, 13).getValue());
assert.equal(generatedStayId, '00000000-0000-4000-8000-0000000000c3', 'actual date edit path assigns a Stay ID when needed');
records = dateMoveWithoutId.readStayOperations_({ stayIds: [generatedStayId], stayKeys: ['ralph|2026-10-06|2026-10-12'] });
assert.equal(records[0].stayId, generatedStayId, 'date edit binds a unique legacy operation to the assigned ID');
assert.equal(records[0].actualCheckoutDate, '2026-10-05');

const shortLegacy = harness([headers, booking(ID_A, 'Ada')], [opHeaders.slice(0, 9).concat(['Unrecognized Extra']), [new Date(), key, 'Ralph','2026-10-04','2026-10-09','checked_in','','','', 'preserve-me']]);
assert.equal(shortLegacy.readStayOperations_()[0].checkoutType, '', 'unknown extra headers do not become checkout metadata');
shortLegacy.setStayOperationalStatus_({ stayId: ID_A, stayKey: key, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09' }, 'checked_out');
assert.equal(shortLegacy._ops.rows[1][9], 'preserve-me', 'appending missing fields preserves unknown columns');

const oneOperation = harness([headers, booking(ID_A, 'Ada'), booking(ID_B, 'Lee')], [opHeaders.concat(['Stay ID']), op(ID_A, key, 'checked_in')]);
oneOperation.setStayOperationalStatus_({ stayId: ID_B, stayKey: key, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09' }, 'checked_out');
records = oneOperation.readStayOperations_({ stayIds: [ID_A, ID_B] });
assert.equal(records.length, 2, 'a second UUID-owned homonym can receive its own operation');
assert.equal(records.find(r => r.stayId === ID_A).status, 'checked_in');
assert.equal(records.find(r => r.stayId === ID_B).status, 'checked_out');

const lockTest = harness([headers, booking(ID_A, 'Ada')], [opHeaders]);
lockTest._held(true);
assert.throws(() => lockTest.setStayOperationalStatus_({ stayId: ID_A, stayKey: key, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09' }, 'checked_in'), /another/i);
lockTest._held(false);
lockTest.WAFFLE_STAY_OPERATIONS_LOCK_HELD_V11226_ = true;
const beforeTries = lockTest._tries();
lockTest.setStayOperationalStatus_({ stayId: ID_A, stayKey: key, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09' }, 'checked_in');
assert.equal(lockTest._tries(), beforeTries, 'nested core operation reuses its outer lock');
lockTest.WAFFLE_STAY_OPERATIONS_LOCK_HELD_V11226_ = false;
const routedBefore = lockTest._tries();
lockTest.processSheetAction_({ action: 'checkin_stay', stayId: ID_A, stayKey: key, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09' });
assert.equal(lockTest._tries(), routedBefore + 1, 'the actual core router acquires one lock and the writer reuses it');

const deletedLegacy = harness([headers, booking(ID_A, 'Ada')], [opHeaders, [new Date(), key, 'Ralph','2026-10-04','2026-10-09','checked_out']]);
deletedLegacy.deleteConfirmedStayV11198_({ stayId: ID_A, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09' });
assert.equal(deletedLegacy._bookings.rows.length, 1);
assert.equal(deletedLegacy.readStayOperations_({ stayIds: [ID_A] })[0].identityConflictReason, 'missing_booking', 'deletion retains the old operation owner instead of recycling its key');
const earlyRoute = harness([headers, booking(ID_A, 'Ada')], [opHeaders]);
earlyRoute.processSheetAction_({ action: 'early_checkout_stay', stayId: ID_A, stayKey: key, dogName: 'Ralph', startDate: '2026-10-04', endDate: '2026-10-09', actualCheckoutDate: '2026-10-05' });
assert.equal(earlyRoute._tries(), 1, 'the early-checkout override acquires its own lock once');
assert.equal(earlyRoute.readStayOperations_({ stayIds: [ID_A] })[0].checkoutType, 'early');
earlyRoute.waffleCacheFingerprint_ = value => value;
const variantStart = code.indexOf('function waffleReadVariant_(action, data)');
const variantEnd = code.indexOf('function waffleReadCacheKey_', variantStart);
vm.runInContext(code.slice(variantStart, variantEnd), earlyRoute);
assert.notEqual(earlyRoute.waffleReadVariant_('get_stay_operations', { stayIds: [ID_A] }), earlyRoute.waffleReadVariant_('get_stay_operations', { stayIds: [ID_B] }), 'server cache variants separate UUID-scoped operations');
assert.equal(JSON.parse(earlyRoute.waffleReadVariant_('get_guest_directory', {})).stayOperationIdentityVersion, 1, 'legacy directory caches cannot validate as current operation-schema reads');

console.log('Stay operation identity backend tests passed');
