const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const helperSource = fs.readFileSync(path.join(root, 'apps-script', 'StableStayIdentity.js'), 'utf8');
const code = fs.readFileSync(path.join(root, 'apps-script', 'Code.js'), 'utf8');
const deleteSource = fs.readFileSync(path.join(root, 'apps-script', 'V11198ConfirmedStayDelete.js'), 'utf8');
const wrapperStart = code.indexOf('function processSheetActionWithV108Receipt_(data) {');
const wrapperEnd = code.indexOf('function ensureBelongingsRecordForPhoto_(data)', wrapperStart);
const createStart = code.indexOf('function createV108Boarding_(data) {');
const inheritanceStart = code.indexOf('function validateReviewedCareInheritanceV11225_(review, dogId) {');
const createEnd = code.indexOf('function updateV108BoardingDates_(data)', createStart);
const updateStart = createEnd;
const updateEnd = code.indexOf('function updateV108MeetGreetSchedule_(data)', updateStart);
const deleteStart = deleteSource.indexOf('function deleteConfirmedStayV11198Unlocked_(data) {');
const deleteEnd = deleteSource.indexOf('function deleteConfirmedStayV11198_(data)', deleteStart);
const deleteWrapperStart = deleteEnd;
const deleteWrapperEnd = deleteSource.indexOf('processSheetAction_ = function(data)', deleteWrapperStart);
const coreStart = code.indexOf('function processSheetAction_(data) {');
const coreEnd = code.indexOf('var WAFFLE_SPREADSHEET_CACHE_', coreStart);
const currentReadStart = code.indexOf('function getGuestDirectoryPayload_() {');
const currentReadEnd = code.indexOf('function getPastGuestDirectoryPayload_(data)', currentReadStart);
const potentialReadStart = code.indexOf('function readPotentialStayRecords_() {');
const potentialReadEnd = code.indexOf('function verifyWaffleHousePotentialStaySync()', potentialReadStart);
assert.ok(wrapperStart >= 0 && wrapperEnd > wrapperStart);
assert.ok(createStart >= 0 && createEnd > createStart && updateEnd > updateStart);
assert.ok(deleteStart >= 0 && deleteEnd > deleteStart && deleteWrapperEnd > deleteWrapperStart);
assert.ok(coreStart >= 0 && coreEnd > coreStart);
assert.ok(currentReadStart >= 0 && currentReadEnd > currentReadStart && potentialReadStart >= 0 && potentialReadEnd > potentialReadStart);

const header = ['Timestamp', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Owner', 'Phone', 'Likes', 'Dislikes', 'Notes', 'Edit Link', 'Booking Type', 'Dog ID', 'Dog Number'];
const stayA = '00000000-0000-4000-8000-0000000000a1';
const stayB = '00000000-0000-4000-8000-0000000000b2';

function makeSheet(name, initialRows, parent, initialMaxColumns = 30) {
  const rows = initialRows.map(row => row.slice());
  const formulas = new Map();
  let maxColumns = initialMaxColumns;
  const sheet = {
    name,
    rows,
    getName() { return name; },
    getParent() { return parent; },
    getLastRow() { return rows.length; },
    getLastColumn() { return Math.max(0, ...rows.map(row => row.length)); },
    getMaxColumns() { return maxColumns; },
    getDataRange() {
      const width = this.getLastColumn();
      return {
        getValues: () => rows.map(row => Array.from({ length: width }, (_, i) => row[i] ?? '')),
        getDisplayValues: () => rows.map(row => Array.from({ length: width }, (_, i) => String(row[i] ?? '')))
      };
    },
    getRange(row, col, numRows = 1, numCols = 1) {
      function cell(r, c) { while (rows.length < r) rows.push([]); while (rows[r - 1].length < c) rows[r - 1].push(''); return rows[r - 1][c - 1]; }
      return {
        getValues() { return Array.from({ length: numRows }, (_, r) => Array.from({ length: numCols }, (_, c) => cell(row + r, col + c) ?? '')); },
        getDisplayValues() { return this.getValues().map(line => line.map(value => String(value ?? ''))); },
        getValue() { return cell(row, col) ?? ''; },
        getDisplayValue() { return String(cell(row, col) ?? ''); },
        getFormulas() { return Array.from({ length: numRows }, (_, r) => Array.from({ length: numCols }, (_, c) => formulas.get(`${row + r}:${col + c}`) || '')); },
        setValue(value) { cell(row, col); rows[row - 1][col - 1] = value; },
        setValues(values) { values.forEach((line, r) => line.forEach((value, c) => { cell(row + r, col + c); rows[row + r - 1][col + c - 1] = value; })); }
      };
    },
    appendRow(row) { rows.push(row.slice()); },
    deleteRow(row) { rows.splice(row - 1, 1); },
    insertColumnsAfter(after, count) {
      maxColumns += count;
      rows.forEach(row => { for (let i = 0; i < count; i++) row.splice(after, 0, ''); });
    },
    setFrozenRows() {},
    _formula(row, col, text) { formulas.set(`${row}:${col}`, text); }
  };
  return sheet;
}

function makeHarness(options = {}) {
  const ss = {
    sheets: new Map(),
    getSheetByName(name) { return this.sheets.get(name) || null; },
    insertSheet(name) { const sheet = makeSheet(name, [], this); this.sheets.set(name, sheet); return sheet; },
    getSpreadsheetTimeZone() { return 'Australia/Sydney'; }
  };
  const bookingRows = options.rows || [header.slice()];
  const bookings = makeSheet('Bookings', bookingRows, ss, options.maxColumns || 30);
  ss.sheets.set('Bookings', bookings);
  let uuidN = 900;
  let lockHeld = false;
  let lockAttempts = 0;
  const props = new Map(options.properties || []);
  let failIntake = Boolean(options.failIntake);
  let failMigration = Boolean(options.failMigration);
  const sandbox = {
    console,
    Date,
    JSON,
    Object,
    Math,
    Array,
    String,
    Number,
    RegExp,
    isNaN,
    Utilities: {
      getUuid() { uuidN++; return `00000000-0000-4000-8000-${String(uuidN).padStart(12, '0')}`; },
      DigestAlgorithm: { SHA_256: 'SHA-256' }, Charset: { UTF_8: 'UTF-8' },
      computeDigest(_alg, value) { return [...crypto.createHash('sha256').update(String(value)).digest()]; },
      base64EncodeWebSafe(value) { return Buffer.from(value).toString('base64url'); },
      formatDate(value) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
    },
    LockService: { getScriptLock: () => ({ tryLock() { lockAttempts++; if (lockHeld) return false; lockHeld = true; return true; }, releaseLock() { lockHeld = false; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key) || null, setProperty: (key, value) => props.set(key, String(value)) }) },
    SpreadsheetApp: { flush() {} },
    Session: { getScriptTimeZone: () => 'Australia/Sydney' },
    getTargetSheet_: () => bookings,
    normalizeV108Identity_: value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(),
    normalizeDateValue_: value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10),
    makeGuestStayKey_: (name, start, end) => `${String(name || '').toLowerCase()}|${start}|${end}`,
    isReadOnlySheetAction_: () => false,
    assertWaffleActionAllowedDuringMaintenance_() {},
    getV108MutationReceipts_() { try { return JSON.parse(props.get('WAFFLE_V108_MUTATION_RECEIPTS') || '{}'); } catch { return {}; } },
    saveV108MutationReceipt_(id) { const value = sandbox.getV108MutationReceipts_(); value[id] = Date.now(); props.set('WAFFLE_V108_MUTATION_RECEIPTS', JSON.stringify(value)); },
    v108DogIdentityAt_(rows, rowIndex) {
      const ids = rows[0].map(value => String(value || '').toLowerCase());
      return { dogId: String((rows[rowIndex] || [])[ids.indexOf('dog id')] || ''), dogNumber: String((rows[rowIndex] || [])[ids.indexOf('dog number')] || '') };
    },
    ensureV108DogIdColumn_() { return { id: 12, number: 13 }; },
    newV108DogId_() { return '00000000-0000-4000-8000-000000000123'; },
    findV108BoardingRow_() { return -1; },
    resolveV108DogRows_() { return { rows: [] }; },
    assertV108DogNameMatchesId_() {},
    validateV108DogProfileCopy_() {},
    validatePotentialPayload_(data) { if (!data.dogName || !data.startDate || !data.endDate) throw new Error('missing potential fields'); },
    assignV108DogIdentity_(sheet, row, id) {
      sheet.getRange(row, 13).setValue(id);
      sheet.getRange(row, 14).setValue('#00001');
      return { dogId: id, dogNumber: '#00001' };
    },
    copyV108PreviousProfile_() { return { copied: false }; },
    createIntakeLinkForBooking_() { if (failIntake) throw new Error('simulated intake failure after booking append'); return { url: 'https://example.test/intake' }; },
    auditBookingSnapshotFromSheetRow_(sheet, row) {
      const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
      const cols = values.map((_, i) => i);
      const headerValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const stableIndex = headerValues.map(value => String(value || '').toLowerCase()).indexOf('stay id');
      return { dogName: values[1], breed: values[2], startDate: sandbox.normalizeDateValue_(values[3]), endDate: sandbox.normalizeDateValue_(values[4]), ownerName: values[5], phone: values[6], bookingType: values[11], dogId: values[12] || '', dogNumber: values[13] || '', stayId: stableIndex < 0 ? '' : values[stableIndex] };
    },
    auditObjectChangedFields_() { return []; },
    auditBookingFieldLabels_() { return {}; },
    logAuditEvent_(event) { if (options.onAudit) options.onAudit(event); },
    touchWaffleDataVersion_() {},
    migrateBelongingsIdentityForGuest_() { if (failMigration) { failMigration = false; throw new Error('simulated media-key migration failure'); } return true; },
    migrateIntakeIdentitiesForGuest_() { return { digital: 0, legacy: 0 }; },
    getBelongingsSheet_() { return makeSheet('Belongings', [['header']], ss); },
    readBelongingsRecords_() { return []; },
    readBelongingsSummaryRecords_() { return []; },
    getIntakeStatusRecords_() { return []; },
    getLegacyIntakeStatusRecords_() { return []; },
    readStayOperations_() { return []; },
    normalizeV108DogPhotoGallery_: value => value || [],
    createIntakeLinkForBooking_: function() { if (failIntake) throw new Error('simulated intake failure after booking append'); return { url: 'https://example.test/intake' }; },
    v108DogIdentityAt: null
  };
  if (!options.actualCore) sandbox.processSheetAction_ = function(data) {
      if (data.action === 'create_boarding') return sandbox.createV108Boarding_(data);
      if (data.action === 'update_boarding_dates') return sandbox.updateV108BoardingDates_(data);
      throw new Error(`Unexpected fixture action ${data.action}`);
    };
  vm.createContext(sandbox);
  const loaded = `${helperSource}\n${code.slice(wrapperStart, wrapperEnd)}\n${code.slice(createStart, createEnd)}\n${code.slice(updateStart, updateEnd)}\n` +
    (options.actualCore ? `${code.slice(coreStart, coreEnd)}\n${deleteSource}\n` : '') +
  `${code.slice(inheritanceStart, createStart)}\n${code.slice(currentReadStart, currentReadEnd)}\n${code.slice(potentialReadStart, potentialReadEnd)}\n` +
    'this.createV108Boarding_ = createV108Boarding_; this.updateV108BoardingDates_ = updateV108BoardingDates_;';
  vm.runInContext(loaded, sandbox);
  return { sandbox, bookings, ss, props, get lockHeld() { return lockHeld; }, get lockAttempts() { return lockAttempts; } };
}

function request(id, stayId, values = {}) {
  return { action: 'create_boarding', clientMutationId: id, stayIdentityVersion: 1, stayId,
    dogName: 'Milo', breed: 'Cavoodle', ownerName: 'Ari', phone: '0412345678',
    startDate: '2026-11-04', endDate: '2026-11-06', ...values };
}

function potentialRequest(action, id, stayId, values = {}) {
  return { action, clientMutationId: id, stayIdentityVersion: 1, stayId,
    dogName: 'Nori', breed: 'Poodle', ownerName: 'Bea', phone: '0400000001',
    startDate: '2026-12-01', endDate: '2026-12-03', notes: 'quiet room', ...values };
}

// Explicit care inheritance is validated before the booking append so an
// invalid or stale review cannot leave a new booking behind.
{
  const h = makeHarness();
  assert.throws(() => h.sandbox.createV108Boarding_(request('unused', stayA, {
    inheritCareReview: { confirmed: true, sourceStayId: 'stale', sourceStayKey: 'milo|2026-10-01|2026-10-02',
      sourceEndDate: '2026-10-02', profile: {}, riskFlags: {} }
  })), /source stay identity is incomplete/i);
  assert.equal(h.bookings.getLastRow(), 1, 'failed review validation leaves no booking row');
}

// Real receipt wrapper + real create handler: a crash after atomic append is
// recovered by the row UUID/marker and does not append a second stay.
{
  const h = makeHarness({ failIntake: true });
  const payload = request('mutation-create-a', stayA);
  const recovered = h.sandbox.processSheetActionWithV108Receipt_(payload);
  assert.equal(recovered.recovered, true, 'first response after a committed create must not invite a fresh-ID duplicate');
  assert.equal(h.bookings.getLastRow(), 2);
  const firstRow = h.bookings.rows[1];
  assert.equal(firstRow[14], stayA);
  assert.equal(firstRow[15], payload.clientMutationId);
  assert.equal(firstRow[12], '00000000-0000-4000-8000-000000000123', 'Dog ID is included in the same append as the stay UUID');
  assert.equal(recovered.stayId, stayA);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.followUpNeeded, true, 'intake/audit/profile follow-up is not falsely claimed complete');
  assert.equal(h.bookings.getLastRow(), 2);
  const replay = h.sandbox.processSheetActionWithV108Receipt_(payload);
  assert.equal(replay.stayId, stayA);
  assert.equal(replay.duplicate, true);
  assert.equal(h.bookings.getLastRow(), 2);
  assert.equal(h.lockHeld, false);
  assert.throws(() => h.sandbox.processSheetActionWithV108Receipt_({ ...payload, dogName: 'Other' }), /different booking details/);
}

// A real date-update primary write and receipt marker survive a follow-up key
// migration failure; retry completes migration and keeps the booking UUID.
{
  const existing = ['', 'Pip', 'Kelpie', '2026-10-01', '2026-10-03', 'Sam', '0400000000', '', '', '', '', 'Confirmed Boarding', '00000000-0000-4000-8000-000000000888', '#00002', stayB, ''];
  const h = makeHarness({ rows: [header.concat(['Stay ID', 'Last Stay Mutation ID']), existing], failMigration: true });
  const payload = { action: 'update_boarding_dates', clientMutationId: 'mutation-date-b', stayId: stayB,
    originalDogName: 'Pip', originalStartDate: '2026-10-01', originalEndDate: '2026-10-03',
    dogName: 'Pip', startDate: '2026-10-01', endDate: '2026-10-05' };
  const recovered = h.sandbox.processSheetActionWithV108Receipt_(payload);
  assert.equal(recovered.recovered, true, 'the receipt wrapper completes a retryable key migration before returning success');
  assert.equal(h.bookings.rows[1][4], '2026-10-05');
  assert.equal(h.bookings.rows[1][14], stayB);
  assert.equal(h.bookings.rows[1][15], payload.clientMutationId);
  assert.equal(recovered.stayId, stayB);
  assert.equal(h.bookings.getLastRow(), 2);
  const exactReplay = h.sandbox.processSheetActionWithV108Receipt_(payload);
  assert.equal(exactReplay.booking.endDate, '2026-10-05');
  assert.equal(exactReplay.duplicate, true);
}

// Pending with no matching primary marker is explicitly unresolved, never
// blindly dispatched; retry payload changes and old timestamp-only IDs fail.
{
  const h = makeHarness();
  const receipt = h.sandbox.stayMutationReceiptSheetV11225_();
  const pending = { action: 'update_boarding_dates', clientMutationId: 'pending-unknown', stayId: stayB,
    originalDogName: 'Pip', originalStartDate: '2026-10-01', startDate: '2026-10-02', endDate: '2026-10-03' };
  receipt.appendRow(['pending-unknown', 'update_boarding_dates', h.sandbox.canonicalStayMutationPayloadV11225_(pending), 'pending', stayB, '', new Date(), new Date()]);
  assert.throws(() => h.sandbox.processSheetActionWithV108Receipt_(pending), /pending but cannot be verified/);
  assert.equal(h.bookings.getLastRow(), 1);
  const legacy = makeHarness({ properties: [['WAFFLE_V108_MUTATION_RECEIPTS', JSON.stringify({ 'old-receipt': Date.now() })]] });
  assert.throws(() => legacy.sandbox.processSheetActionWithV108Receipt_(request('old-receipt', stayA)), /older booking receipt/);
  assert.equal(legacy.bookings.getLastRow(), 1);
}

// Stable IDs cannot be reused even after deletion/pending receipts; duplicate
// IDs and case-fold collisions are treated as corruption, not first-match wins.
{
  const h = makeHarness();
  const receipt = h.sandbox.stayMutationReceiptSheetV11225_();
  receipt.appendRow(['old-delete', 'delete_confirmed_stay', 'digest', 'succeeded', stayA, '{}', new Date(), new Date()]);
  assert.throws(() => h.sandbox.processSheetActionWithV108Receipt_(request('new-create', stayA)), /already has a mutation receipt/);
  const rows = [header.concat(['Stay ID', 'Last Stay Mutation ID']),
    ['', 'Pip', 'Kelpie', '2026-10-01', '2026-10-03', 'Sam', '0400000000', '', '', '', '', 'Confirmed Boarding', '', '', stayA.toUpperCase(), ''],
    ['', 'Pip', 'Kelpie', '2026-10-01', '2026-10-03', 'Sam', '0400000000', '', '', '', '', 'Confirmed Boarding', '', '', stayA, '']];
  const dup = makeHarness({ rows });
  assert.throws(() => dup.sandbox.findStayRowByIdV11225_(dup.bookings, stayA), /collision detected/);
}

// Missing headers are appended after existing data; explicit backfill is
// repeatable and detects malformed/colliding IDs before assigning anything.
{
  const oldHeader = header.concat(['Existing Data Column']);
  const oldRows = [oldHeader,
    ['', 'Pip', 'Kelpie', '2026-10-01', '2026-10-03', 'Sam', '0400000000', '', '', '', '', 'Confirmed Boarding', '', '', 'keep'],
    ['', 'Pip', 'Kelpie', '2026-10-04', '2026-10-05', 'Sam', '0400000000', '', '', '', '', 'Potential Stay', '', '', 'also keep']];
  const h = makeHarness({ rows: oldRows, maxColumns: 15 });
  const beforeRead = h.bookings.rows.map(row => row.slice());
  assert.equal(h.sandbox.stableStayIdAtV11225_(h.bookings.getDataRange().getValues(), 1), '');
  h.sandbox.getGuestDirectoryPayload_();
  assert.deepEqual(h.bookings.rows, beforeRead, 'read helper does not trigger backfill');
  const result = h.sandbox.backfillStableStayIdsV11225_();
  assert.equal(result.assigned, 2);
  assert.equal(h.bookings.rows[0][14], 'Existing Data Column');
  assert.equal(h.bookings.rows[0][15], 'Stay ID');
  assert.equal(h.bookings.rows[0][16], 'Last Stay Mutation ID');
  const ids = [h.bookings.rows[1][15], h.bookings.rows[2][15]];
  assert.ok(ids.every(id => /^[0-9a-f-]{36}$/.test(id)));
  assert.equal(h.sandbox.backfillStableStayIdsV11225_().assigned, 0);
  h.bookings.rows[2][15] = ids[0].toUpperCase();
  assert.throws(() => h.sandbox.backfillStableStayIdsV11225_(), /duplicated/);
}

// The shipped current/past/potential read builders expose the same immutable
// UUID while leaving the legacy media key intact.
{
  const columns = header.concat(['Stay ID', 'Last Stay Mutation ID']);
  const current = ['', 'Milo', 'Cavoodle', '2026-10-05', '2026-10-06', 'Ari', '0412345678', '', '', '', '', 'Confirmed Boarding', '', '', stayA, ''];
  const potential = ['', 'Nori', 'Poodle', '2026-10-06', '2026-10-07', 'Bea', '0400000001', '', '', '', '', 'Potential Stay', '', '', stayB, ''];
  const h = makeHarness({ rows: [columns, current, potential] });
  const currentResult = h.sandbox.getGuestDirectoryPayload_();
  assert.equal(currentResult.bookings[0].stayId, stayA);
  assert.equal(currentResult.bookings[0].stayKey, 'milo|2026-10-05|2026-10-06');
  const potentialResult = h.sandbox.readPotentialStayRecords_();
  assert.equal(potentialResult[0].stayId, stayB);
  assert.equal(potentialResult[0].id, 'sheet_pot_3', 'legacy UI row identity remains separate');
}

// Formula cells outside the edited columns remain formulas while the explicit
// date changes and mutation marker are written in one range operation.
{
  const h = makeHarness({ rows: [header.concat(['Stay ID', 'Last Stay Mutation ID']),
    ['', 'Pip', 'Kelpie', '2026-10-01', '2026-10-03', 'Sam', '0400000000', '', '', '', '', 'Confirmed Boarding', '', '', stayB, '']] });
  h.bookings._formula(2, 11, '=HYPERLINK("url","edit")');
  h.bookings._formula(2, 4, '=DATE(2026,10,1)');
  h.sandbox.updateStableStayRowV11225_(h.bookings, 2, { 4: '2026-10-02', 5: '2026-10-05' }, 'formula-test');
  assert.equal(h.bookings.rows[1][3], '2026-10-02');
  assert.equal(h.bookings.rows[1][10], '=HYPERLINK("url","edit")');
  assert.equal(h.bookings.rows[1][15], 'formula-test');
}

// Actual core dispatcher and receipt wrapper: potential creation then
// confirmation uses one row/UUID; the core must not attempt a nested lock.
{
  const h = makeHarness({ actualCore: true });
  const before = h.lockAttempts;
  const createPayload = potentialRequest('create_potential', 'mutation-potential-c', stayA);
  const created = h.sandbox.processSheetActionWithV108Receipt_(createPayload);
  assert.equal(created.stayId, stayA);
  assert.equal(h.bookings.getLastRow(), 2);
  assert.equal(h.bookings.rows[1][11], 'Potential Stay');
  assert.equal(h.lockAttempts, before + 1, 'outer receipt lock is the only lock acquired by the nested core dispatcher');

  const confirmPayload = potentialRequest('confirm_potential', 'mutation-confirm-c', stayA, {
    originalDogName: 'Nori', originalStartDate: '2026-12-01', originalEndDate: '2026-12-03'
  });
  const confirmed = h.sandbox.processSheetActionWithV108Receipt_(confirmPayload);
  assert.equal(confirmed.stayId, stayA);
  assert.equal(h.bookings.getLastRow(), 2);
  assert.equal(h.bookings.rows[1][11], 'Confirmed Boarding');
  const retry = h.sandbox.processSheetActionWithV108Receipt_(confirmPayload);
  assert.equal(retry.stayId, stayA);
  assert.equal(retry.duplicate, true);
  assert.equal(h.bookings.getLastRow(), 2);
  const ledger = h.sandbox.stayMutationReceiptSheetV11225_();
  for (let i = 0; i < 110; i++) ledger.appendRow([`later-confirm-${i}`, 'update_potential', 'digest', 'succeeded', `00000000-0000-4000-8000-${String(i + 2000).padStart(12, '0')}`, '{}', new Date(), new Date()]);
  const afterRetentionWindow = h.sandbox.processSheetActionWithV108Receipt_(confirmPayload);
  assert.equal(afterRetentionWindow.stayId, stayA, 'the original receipt remains replayable after more than 100 later rows');
  assert.equal(afterRetentionWindow.duplicate, true);
  assert.equal(h.bookings.getLastRow(), 2);
  assert.equal(h.lockHeld, false);
}

// Deletion by stable UUID keeps a same-name/date peer and the durable receipt
// prevents delayed retries from resurrecting the deleted UUID.
{
  const first = ['', 'Nori', 'Poodle', '2026-12-01', '2026-12-03', 'Bea', '0400000001', '', '', '', '', 'Confirmed Boarding', '', '', stayA, ''];
  const second = ['', 'Nori', 'Poodle', '2026-12-01', '2026-12-03', 'Cal', '0400000002', '', '', '', '', 'Confirmed Boarding', '', '', stayB, ''];
  const h = makeHarness({ actualCore: true, rows: [header.concat(['Stay ID', 'Last Stay Mutation ID']), first, second] });
  const deleted = h.sandbox.processSheetActionWithV108Receipt_({ action: 'delete_confirmed_stay', clientMutationId: 'mutation-delete-a',
    stayIdentityVersion: 1, stayId: stayA, dogName: 'Nori', startDate: '2026-12-01', endDate: '2026-12-03' });
  assert.equal(deleted.stayId, stayA);
  assert.equal(h.bookings.getLastRow(), 2);
  assert.equal(h.bookings.rows[1][5], 'Cal');
  const delayed = h.sandbox.processSheetActionWithV108Receipt_({ action: 'delete_confirmed_stay', clientMutationId: 'mutation-delete-a',
    stayIdentityVersion: 1, stayId: stayA, dogName: 'Nori', startDate: '2026-12-01', endDate: '2026-12-03' });
  assert.equal(delayed.stayId, stayA);
  assert.equal(delayed.duplicate, true);
  assert.equal(h.bookings.getLastRow(), 2);
  assert.throws(() => h.sandbox.processSheetActionWithV108Receipt_(request('create-reuse-delete', stayA)), /already has a mutation receipt/);
}

// Delete overrides that bypass the core still acquire the ScriptLock for a
// direct legacy invocation; calls routed under the receipt lock do not nest it.
{
  const only = ['', 'Solo', 'Mix', '2026-12-01', '2026-12-03', 'Owner', '0400000000', '', '', '', '', 'Confirmed Boarding', '', '', stayA, ''];
  const h = makeHarness({ actualCore: true, rows: [header.concat(['Stay ID', 'Last Stay Mutation ID']), only] });
  const before = h.lockAttempts;
  h.sandbox.processSheetAction_({ action: 'delete_confirmed_stay', stayId: stayA, dogName: 'Solo' });
  assert.equal(h.lockAttempts, before + 1);
  assert.equal(h.bookings.getLastRow(), 1);
  h.bookings.appendRow(only);
  const beforeReceipt = h.lockAttempts;
  h.sandbox.processSheetActionWithV108Receipt_({ action: 'delete_confirmed_stay', clientMutationId: 'mutation-delete-legacy-route',
    stayIdentityVersion: 1, stayId: stayA, dogName: 'Solo', startDate: '2026-12-01', endDate: '2026-12-03' });
  assert.equal(h.lockAttempts, beforeReceipt + 1, 'delete route reuses the held outer lock');
  assert.equal(h.lockHeld, false);
}

// A second mutation entering during an outer locked handler fails tryLock and
// cannot append its row; the original mutation then completes and releases.
{
  let competingError = null;
  let submitted = false;
  let activeHarness;
  activeHarness = makeHarness({ actualCore: true, onAudit() {
    if (submitted) return;
    submitted = true;
    try {
      activeHarness.sandbox.processSheetActionWithV108Receipt_(potentialRequest('create_potential', 'mutation-concurrent-b', stayB));
    } catch (error) { competingError = error; }
  } });
  const result = activeHarness.sandbox.processSheetActionWithV108Receipt_(potentialRequest('create_potential', 'mutation-concurrent-a', stayA));
  assert.equal(result.stayId, stayA);
  assert.match(String(competingError && competingError.message), /Another Waffle House update/);
  assert.equal(activeHarness.bookings.getLastRow(), 2);
  assert.equal(activeHarness.bookings.rows[1][14], stayA);
  assert.equal(activeHarness.lockHeld, false);
}

// Durable receipts do not prune the first retry when many later mutations are
// appended (unlike the historical 100-entry ScriptProperties cache).
{
  const h = makeHarness();
  const sheet = h.sandbox.stayMutationReceiptSheetV11225_();
  sheet.appendRow(['oldest-durable', 'create_potential', 'digest', 'succeeded', stayA, JSON.stringify({ result: 'success', stayId: stayA }), new Date(), new Date()]);
  for (let i = 0; i < 110; i++) sheet.appendRow([`later-${i}`, 'update_potential', 'digest', 'succeeded', `00000000-0000-4000-8000-${String(i + 1000).padStart(12, '0')}`, '{}', new Date(), new Date()]);
  assert.notEqual(h.sandbox.findStayMutationReceiptV11225_(sheet, 'oldest-durable'), -1);
}

// A row changed by an old client cannot become a reconstructed success just
// because its UUID and old mutation marker still match a pending create.
{
  const h = makeHarness();
  const payload = request('pending-create-changed', stayA);
  const ledger = h.sandbox.stayMutationReceiptSheetV11225_();
  const receipt = { id: payload.clientMutationId, action: payload.action,
    digest: h.sandbox.canonicalStayMutationPayloadV11225_(payload), stayId: stayA };
  h.sandbox.reserveStayMutationV11225_(ledger, receipt, -1, payload);
  h.sandbox.createV108Boarding_(payload);
  h.bookings.rows[1][5] = 'Another owner';
  assert.throws(() => h.sandbox.processSheetActionWithV108Receipt_(payload), /no longer matches/);
  assert.equal(h.bookings.getLastRow(), 2);
}

// Legacy requests require their supplied original dates and a boarding type.
{
  const row = ['', 'Pip', 'Kelpie', '2026-10-01', '2026-10-03', 'Sam', '0400000000', '', '', '', '', 'Confirmed Boarding', '', '', stayB, ''];
  const h = makeHarness({ rows: [header.concat(['Stay ID', 'Last Stay Mutation ID']), row] });
  const data = { dogName: 'Pip', originalStartDate: '2026-10-01', originalEndDate: '2026-10-04' };
  assert.equal(h.sandbox.safeLegacyStayRowV11225_(h.bookings.rows, 'update_boarding_dates', data), -1);
  h.bookings.rows[1][11] = 'Unrecognised';
  assert.throws(() => h.sandbox.assertStayRowActionCompatibleV11225_(h.bookings, 2, 'delete_confirmed_stay', {}), /requested type/);
}

console.log('Stable stay backend identity and receipt tests passed.');
