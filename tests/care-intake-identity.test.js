const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.js'), 'utf8');
const dogIdA = 'dog-a-0001';
const dogIdB = 'dog-b-0002';
const stayIdA = 'stay-a-0001';
const stayIdB = 'stay-b-0002';

function sheet(name, rows, parent, max = null, stats = null) {
  let maxColumns = max === null ? Math.max(20, ...rows.map(row => row.length)) : max;
  const countRead = () => { if (stats) stats[name] = (stats[name] || 0) + 1; };
  return {
    name,
    rows,
    getName() { return name; },
    getParent() { return parent; },
    getLastRow() { return rows.length; },
    getMaxColumns() { return maxColumns; },
    insertColumnsAfter(after, count) { maxColumns += count; rows.forEach(row => { for (let i = 0; i < count; i++) row.splice(after + i, 0, ''); }); },
    appendRow(row) { rows.push(row.slice()); },
    setFrozenRows() {},
    setColumnWidth() {},
    getDataRange() { return { getValues: () => { countRead(); return rows.map(row => row.slice()); } }; },
    getRange(row, col, height = 1, width = 1) {
      return {
        getValues: () => { countRead(); return Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => rows[row + r - 1]?.[col + c - 1] ?? '')); },
        setValue(value) { if (!rows[row - 1]) rows[row - 1] = []; rows[row - 1][col - 1] = value; },
        setValues(values) { values.forEach((line, r) => line.forEach((value, c) => { if (!rows[row + r - 1]) rows[row + r - 1] = []; rows[row + r - 1][col + c - 1] = value; })); },
        setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; }
      };
    }
  };
}

function isoDate(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = name => parts.find(value => value.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function fixture({ end = '2026-11-11', bookingType = 'Confirmed Boarding', records = [], extraBookings = [], audit = [] } = {}) {
  let intakeSheet = null;
  const reads = {};
  const spreadsheet = {
    getSpreadsheetTimeZone: () => { reads.timezoneLookups = (reads.timezoneLookups || 0) + 1; return 'Australia/Sydney'; },
    getSheetByName(name) { return name === 'Audit_Log' ? auditSheet : name === 'Dog_Intake_Records' ? intakeSheet : null; },
    insertSheet(name) { intakeSheet = sheet(name, [], spreadsheet); return intakeSheet; }
  };
  const dateCell = value => new Date(`${value}T00:00:00+11:00`);
  const bookings = sheet('Bookings', [
    ['Created At', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Owner', 'Phone', 'Likes', 'Dislikes', 'Notes', 'Edit Link', 'Booking Type', 'Dog ID', 'Dog Number', 'Stay ID'],
    [new Date(), 'Cino', 'Jack Russell', dateCell('2026-11-01'), dateCell(end), 'Owner One', '0400000000', '', '', '', '', bookingType, dogIdA, '00062', stayIdA],
    ...extraBookings
  ], spreadsheet, null, reads);
  const auditSheet = sheet('Audit_Log', [['Timestamp', 'Event ID', 'Category', 'Action', 'Dog Name', 'Booking Type', 'Reference', 'Summary', 'Changed Fields', 'Before JSON', 'After JSON', 'Source', 'Actor'], ...audit], spreadsheet, null, reads);
  const context = {
    console,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    RegExp,
    isNaN,
    Utilities: { formatDate: (date, timezone) => isoDate(date, timezone) },
    Session: { getScriptTimeZone: () => 'UTC' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    AUDIT_LOG_HEADERS_: Array(13).fill(''),
    getTargetSheet_: () => bookings,
    normalizeDateValue_: value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10),
    makeGuestStayKey_: (name, start, until) => `${String(name || '').trim().toLowerCase()}|${start}|${until}`,
    v108DogIdentityAt_: (rows, index) => ({ dogId: String(rows[index]?.[12] || '') }),
    auditBookingSnapshotFromSheetRow_: (target, row) => {
      const value = target.rows[row - 1];
      return {
        dogName: String(value?.[1] || ''), breed: String(value?.[2] || ''),
        startDate: context.normalizeIntakeDateValue_(value?.[3]), endDate: context.normalizeIntakeDateValue_(value?.[4]),
        ownerName: String(value?.[5] || ''), phone: String(value?.[6] || ''), bookingType: String(value?.[11] || ''),
        stayId: String(value?.[14] || '')
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'Code.js' });
  const sourceAuditBookingSnapshotFromValues = context.auditBookingSnapshotFromValues_;
  context.getTargetSheet_ = () => bookings;
  context.normalizeDateValue_ = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
  context.makeGuestStayKey_ = (name, start, until) => `${String(name || '').trim().toLowerCase()}|${start}|${until}`;
  context.v108DogIdentityAt_ = (rows, index) => ({ dogId: String(rows[index]?.[12] || '') });
  context.auditBookingSnapshotFromValues_ = value => ({
    dogName: String(value?.[1] || ''), breed: String(value?.[2] || ''),
    startDate: context.normalizeIntakeDateValue_(value?.[3]), endDate: context.normalizeIntakeDateValue_(value?.[4]),
    ownerName: String(value?.[5] || ''), phone: String(value?.[6] || ''), bookingType: String(value?.[11] || '')
  });
  context.auditBookingSnapshotFromSheetRow_ = (target, row) => {
    const value = target.rows[row - 1];
    return {
      dogName: String(value?.[1] || ''), breed: String(value?.[2] || ''),
      startDate: context.normalizeIntakeDateValue_(value?.[3]), endDate: context.normalizeIntakeDateValue_(value?.[4]),
      ownerName: String(value?.[5] || ''), phone: String(value?.[6] || ''), bookingType: String(value?.[11] || ''),
      stayId: String(value?.[14] || '')
    };
  };
  return { context, bookings, auditSheet, reads, sourceAuditBookingSnapshotFromValues, setIntakeSheet(value) { intakeSheet = value; } };
}

function record({ stayKey, start = '2026-11-01', end = '2026-11-11', stayId = '', dogId = '', bookingRow = 2, dogName = 'Cino', bookingType = 'Potential Stay' } = {}) {
  return { stayKey: stayKey || `cino|${start}|${end}`, startDate: start, endDate: end, stayId, dogId, bookingRow, dogName, bookingType };
}

function movedAudit({ oldEnd = '2026-11-10', newEnd = '2026-11-11', row = 2, stayId = stayIdA, action = 'Booking Dates Moved' } = {}) {
  return [new Date(), 'event-date-move', 'Boarding', action, 'Cino', 'Confirmed Boarding', `Bookings!A${row}`, 'Cino moved dates', 'End Date',
    JSON.stringify({ dogName: 'Cino', startDate: '2026-11-01', endDate: oldEnd, stayId }),
    JSON.stringify({ dogName: 'Cino', startDate: '2026-11-01', endDate: newEnd, stayId }), 'Calendar Drag', 'Owner'];
}

test('a migrated legacy token follows a verified date extension and potential-to-confirm conversion', () => {
  const legacy = record({ end: '2026-11-10', stayKey: 'cino|2026-11-01|2026-11-11', bookingRow: 2 });
  const h = fixture({ end: '2026-11-11', bookingType: 'Confirmed Boarding', audit: [movedAudit()] });
  const resolved = h.context.resolveIntakeBookingForRecord_(h.bookings, h.bookings.getDataRange().getValues(), legacy);
  assert.equal(resolved.method, 'audited-date-change');
  assert.equal(resolved.booking.startDate, '2026-11-01');
  assert.equal(resolved.booking.endDate, '2026-11-11');
  assert.equal(resolved.booking.bookingType, 'Confirmed Boarding');
  assert.equal(resolved.booking.stayId, stayIdA);
});

test('an old-key Potential Updated audit can recover a link after the same stay is confirmed', () => {
  const legacy = record({ end: '2026-11-10', stayKey: 'cino|2026-11-01|2026-11-10', bookingRow: 2 });
  const h = fixture({ end: '2026-11-11', bookingType: 'Confirmed Boarding', audit: [movedAudit({ action: 'Potential Updated' })] });
  const resolved = h.context.resolveIntakeBookingForRecord_(h.bookings, h.bookings.getDataRange().getValues(), legacy);
  assert.equal(resolved.method, 'audited-date-change');
  assert.equal(resolved.booking.endDate, '2026-11-11');
  assert.equal(resolved.booking.bookingType, 'Confirmed Boarding');
});

test('preparing a replacement link reuses the uniquely audited old token and preserves owner answers', () => {
  const h = fixture({ end: '2026-11-11', audit: [movedAudit()] });
  const intakeRows = [
    ['Created At', 'Updated At', 'Submitted At', 'Status', 'Token', 'Stay Key', 'Booking Type', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Owner Name', 'Mobile', 'Intake JSON', 'PDF File ID', 'PDF URL', 'Signature File ID', 'Booking Row', 'Stay ID', 'Dog ID'],
    [new Date(), new Date(), '', 'Awaiting Owner', 'owner-token-123', 'cino|2026-11-01|2026-11-11', 'Potential Stay', 'Cino', 'Jack Russell', '2026-11-01', '2026-11-10', 'Owner One', '0400000000', JSON.stringify({ additionalInstructions: 'Please keep the blue harness on.' }), '', '', '', 2, '', '']
  ];
  const intake = sheet('Dog_Intake_Records', intakeRows, h.bookings.getParent());
  const existing = h.context.findIntakeRecordForBooking_(intake, h.bookings, stayIdA, dogIdA);
  assert.equal(existing.token, 'owner-token-123');
  assert.equal(existing.answers.additionalInstructions, 'Please keep the blue harness on.');
});

test('booking link lookup handles complete, partial and conflicting persisted identities safely', () => {
  const h = fixture();
  const headers = h.context.INTAKE_HEADERS_.slice();
  const saved = (stayId, dogId, name = 'Cino', end = '2026-11-11', row = 2) => [new Date(), new Date(), '', 'Awaiting Owner', `token-${stayId || 'partial'}`, `cino|2026-11-01|${end}`, 'Confirmed Boarding', name, 'Jack Russell', '2026-11-01', end, 'Owner One', '0400000000', '{}', '', '', '', row, stayId, dogId];

  let intake = sheet('Dog_Intake_Records', [headers, saved(stayIdA, dogIdA)], h.bookings.getParent());
  assert.equal(h.context.findIntakeRecordForBooking_(intake, h.bookings, stayIdA, dogIdA).dogId, dogIdA);

  intake = sheet('Dog_Intake_Records', [headers, saved(stayIdA, dogIdB)], h.bookings.getParent());
  assert.throws(() => h.context.findIntakeRecordForBooking_(intake, h.bookings, stayIdA, dogIdA), /different Dog ID/);

  intake = sheet('Dog_Intake_Records', [headers, saved(stayIdA, '')], h.bookings.getParent());
  assert.equal(h.context.findIntakeRecordForBooking_(intake, h.bookings, stayIdA, dogIdA).stayId, stayIdA);

  intake = sheet('Dog_Intake_Records', [headers, saved(stayIdA, '', 'Another Dog')], h.bookings.getParent());
  assert.equal(h.context.findIntakeRecordForBooking_(intake, h.bookings, stayIdA, dogIdA), null);
});

test('createIntakeLinkForBooking_ repairs the verified old token and keeps submitted owner answers', () => {
  const h = fixture({ end: '2026-11-11', audit: [movedAudit()] });
  const headers = h.context.INTAKE_HEADERS_.slice();
  const answers = { additionalInstructions: 'Keep the blue harness on.' };
  const old = [new Date(), new Date(), '', 'Awaiting Owner', 'cino-existing-owner-token', 'cino|2026-11-01|2026-11-10', 'Potential Stay', 'Cino', 'Jack Russell', '2026-11-01', '2026-11-10', 'Owner One', '0400000000', JSON.stringify(answers), '', '', '', 2, '', ''];
  const intake = sheet('Dog_Intake_Records', [headers, old], h.bookings.getParent());
  h.context.getIntakeSheet_ = () => intake;
  h.context.getHostedIntakeBaseUrl_ = () => 'https://script.google.com/macros/s/test/exec';
  h.context.makeIntakeToken_ = () => 'new-token-should-not-be-used';
  h.context.logAuditEvent_ = () => {};

  const result = h.context.createIntakeLinkForBooking_(h.bookings, h.bookings.getDataRange().getValues(), {
    dogName: 'Cino', startDate: '2026-11-01', endDate: '2026-11-11', stayId: stayIdA, dogId: dogIdA
  });
  assert.equal(result.token, 'cino-existing-owner-token');
  assert.equal(result.endDate, '2026-11-11');
  assert.equal(intake.rows[1][10], '2026-11-11');
  assert.equal(intake.rows[1][18], stayIdA);
  assert.equal(intake.rows[1][19], dogIdA);
  assert.deepEqual(JSON.parse(intake.rows[1][13]), answers);
});

test('prefill and local submission resolve an already-migrated token to current confirmed dates', () => {
  const h = fixture({ end: '2026-11-11', bookingType: 'Confirmed Boarding' });
  const token = 'cino-migrated-owner-token';
  const intake = sheet('Dog_Intake_Records', [h.context.INTAKE_HEADERS_.slice(), [new Date(), new Date(), '', 'Awaiting Owner', token,
    'cino|2026-11-01|2026-11-11', 'Potential Stay', 'Cino', 'Jack Russell', '2026-11-01', '2026-11-10', 'Owner One', '0400000000',
    JSON.stringify({ additionalInstructions: 'Blue harness.' }), '', '', '', 2, stayIdA, dogIdA]], h.bookings.getParent(), null, h.reads);
  h.context.getIntakeSheet_ = () => intake;

  const prefill = h.context.getIntakePrefill_(token);
  assert.equal(prefill.identityResolution, 'stable-identifiers');
  assert.equal(prefill.booking.startDate, '2026-11-01');
  assert.equal(prefill.booking.endDate, '2026-11-11');
  assert.equal(prefill.booking.bookingType, 'Confirmed Boarding');
  assert.equal(prefill.savedAnswers.additionalInstructions, 'Blue harness.');
  assert.equal(h.reads.Dog_Intake_Records, 1, 'prefill reads the intake range once');
  assert.equal(h.reads.Bookings, 1, 'stable identity lookup reuses the already-loaded booking rows');
  assert.equal(h.reads.Audit_Log || 0, 0, 'stable identity resolution does not read the audit log');
  assert.equal(h.reads.timezoneLookups, 1, 'booking dates share one spreadsheet timezone lookup');

  Object.assign(h.context, {
    ensureStableStayIdV11225_: () => stayIdA,
    SpreadsheetApp: { flush() {} },
    ensureIntakeBelongingsFlags_() {},
    saveIntakeAttributesForStay_() {},
    auditObjectChangedFields_: () => [],
    logAuditEvent_() {},
    touchWaffleDataVersion_() {},
    notifyPushIntakeCompleted_() {},
    Utilities: {
      ...h.context.Utilities,
      base64Decode: () => [1, 2, 3],
      newBlob: () => ({ synthetic: true })
    },
    buildIntakePdf_: () => ({ pdfFile: { getId: () => 'synthetic-pdf-id', getUrl: () => 'https://example.invalid/intake.pdf' }, signatureFile: { getId: () => 'synthetic-signature-id' } })
  });

  const result = h.context.processIntakeSubmission_({
    token,
    answers: { signatureName: 'Owner One', termsAccepted: true, dogName: 'Cino', breed: 'Jack Russell', ownerName: 'Owner One', mobile: '0400000000' },
    signatureData: 'data:image/png;base64,c3ludGhldGlj'
  });
  assert.equal(result.result, 'success');
  assert.equal(result.dogName, 'Cino');
  assert.equal(result.stayKey, 'cino|2026-11-01|2026-11-11');
  assert.equal(intake.rows[1][3], 'Complete');
  assert.equal(intake.rows[1][10], '2026-11-11');
  assert.equal(intake.rows[1][18], stayIdA);
  assert.equal(intake.rows[1][19], dogIdA);
});

test('request-local date formatting matches the existing booking snapshot for Date and string cells', () => {
  const h = fixture();
  h.context.auditBookingSnapshotFromValues_ = h.sourceAuditBookingSnapshotFromValues;
  const rows = h.bookings.rows.map(row => row.slice());
  const resolutionContext = { mainSheet: h.bookings };
  const legacyDateSnapshot = h.context.intakeBookingSnapshotFromValues_(rows, 1);
  const requestDateSnapshot = h.context.intakeBookingSnapshotFromValues_(rows, 1, resolutionContext);
  assert.deepEqual(JSON.parse(JSON.stringify(requestDateSnapshot)), JSON.parse(JSON.stringify(legacyDateSnapshot)));
  assert.equal(h.reads.timezoneLookups, 3, 'two existing Date normalizations and one request-local lookup produce the same values');

  rows[1][3] = '2026-11-01';
  rows[1][4] = '2026-11-11';
  const legacyStringSnapshot = h.context.intakeBookingSnapshotFromValues_(rows, 1);
  const requestStringSnapshot = h.context.intakeBookingSnapshotFromValues_(rows, 1, { mainSheet: h.bookings });
  assert.deepEqual(JSON.parse(JSON.stringify(requestStringSnapshot)), JSON.parse(JSON.stringify(legacyStringSnapshot)));
  assert.equal(h.reads.timezoneLookups, 3, 'ISO string dates do not request spreadsheet timezone data');
});

test('consecutive prefill requests reload booking rows and observe later date changes', () => {
  const h = fixture();
  const token = 'cino-request-local-owner-token';
  const intake = sheet('Dog_Intake_Records', [h.context.INTAKE_HEADERS_.slice(), [new Date(), new Date(), '', 'Awaiting Owner', token,
    'cino|2026-11-01|2026-11-11', 'Confirmed Boarding', 'Cino', 'Jack Russell', '2026-11-01', '2026-11-11', 'Owner One', '0400000000',
    '{}', '', '', '', 2, stayIdA, dogIdA]], h.bookings.getParent(), null, h.reads);
  h.context.getIntakeSheet_ = () => intake;

  assert.equal(h.context.getIntakePrefill_(token).booking.endDate, '2026-11-11');
  h.bookings.rows[1][4] = new Date('2026-11-12T00:00:00+11:00');
  assert.equal(h.context.getIntakePrefill_(token).booking.endDate, '2026-11-12');
  assert.equal(h.reads.Bookings, 2, 'each prefill uses its own booking-row snapshot');
  assert.equal(h.reads.Dog_Intake_Records, 2, 'each prefill reads the saved token afresh');
  assert.equal(h.reads.Audit_Log || 0, 0, 'stable identity remains on the audit-free path');
  assert.equal(h.reads.timezoneLookups, 2, 'each request owns its timezone lookup');
});

test('legacy date-change prefill reads audit evidence once and reuses the matched proof', () => {
  const h = fixture({ end: '2026-11-11', audit: [movedAudit()] });
  const token = 'cino-legacy-owner-token';
  const intake = sheet('Dog_Intake_Records', [h.context.INTAKE_HEADERS_.slice(), [new Date(), new Date(), '', 'Awaiting Owner', token,
    'cino|2026-11-01|2026-11-10', 'Potential Stay', 'Cino', 'Jack Russell', '2026-11-01', '2026-11-10', 'Owner One', '0400000000',
    JSON.stringify({ additionalInstructions: 'Blue harness.' }), '', '', '', 2, '', '']], h.bookings.getParent(), null, h.reads);
  h.context.getIntakeSheet_ = () => intake;

  const prefill = h.context.getIntakePrefill_(token);
  assert.equal(prefill.identityResolution, 'audited-date-change');
  assert.equal(prefill.booking.endDate, '2026-11-11');
  assert.equal(prefill.savedAnswers.additionalInstructions, 'Blue harness.');
  assert.equal(h.reads.Dog_Intake_Records, 1, 'token lookup uses one intake range read');
  assert.equal(h.reads.Bookings, 1, 'legacy resolution uses one booking range read');
  assert.equal(h.reads.Audit_Log, 1, 'date migration proof loads audit evidence once');
  assert.equal(h.reads.timezoneLookups, 1, 'repeated booking snapshots reuse the spreadsheet timezone');
});

test('legacy prefill rejects missing and duplicate migration evidence while loading audit data once', () => {
  const token = 'cino-legacy-owner-token';
  const makeLegacyPrefill = audit => {
    const h = fixture({ end: '2026-11-11', audit });
    const intake = sheet('Dog_Intake_Records', [h.context.INTAKE_HEADERS_.slice(), [new Date(), new Date(), '', 'Awaiting Owner', token,
      'cino|2026-11-01|2026-11-11', 'Potential Stay', 'Cino', 'Jack Russell', '2026-11-01', '2026-11-10', 'Owner One', '0400000000',
      '{}', '', '', '', 2, '', '']], h.bookings.getParent(), null, h.reads);
    h.context.getIntakeSheet_ = () => intake;
    return h;
  };

  const missing = makeLegacyPrefill([]);
  assert.throws(() => missing.context.getIntakePrefill_(token), /outdated/);
  assert.equal(missing.reads.Audit_Log || 0, 0, 'an empty audit sheet needs no range read');

  const collision = makeLegacyPrefill([movedAudit(), movedAudit()]);
  assert.throws(() => collision.context.getIntakePrefill_(token), /outdated|could refer/);
  assert.equal(collision.reads.Audit_Log, 1, 'duplicate audit evidence is rejected from one audit read');
});

test('legacy prefill keeps same-name different-dog ambiguity fail-closed', () => {
  const duplicateDog = [new Date(), 'Cino', 'Jack Russell', new Date('2026-11-01T00:00:00+11:00'), new Date('2026-11-10T00:00:00+11:00'), 'Owner Two', '0411111111', '', '', '', '', 'Potential Stay', dogIdB, '00063', stayIdB];
  const h = fixture({ end: '2026-11-11', extraBookings: [duplicateDog], audit: [movedAudit()] });
  const token = 'cino-ambiguous-owner-token';
  const intake = sheet('Dog_Intake_Records', [h.context.INTAKE_HEADERS_.slice(), [new Date(), new Date(), '', 'Awaiting Owner', token,
    'cino|2026-11-01|2026-11-10', 'Potential Stay', 'Cino', 'Jack Russell', '2026-11-01', '2026-11-10', 'Owner One', '0400000000',
    '{}', '', '', '', 2, '', '']], h.bookings.getParent(), null, h.reads);
  h.context.getIntakeSheet_ = () => intake;

  assert.throws(() => h.context.getIntakePrefill_(token), /could refer to more than one booking/);
  assert.equal(h.reads.Bookings, 1, 'ambiguous legacy prefill still reads booking rows once');
  assert.equal(h.reads.Audit_Log, 1, 'ambiguous legacy prefill still loads audit evidence once');
});

test('date migration updates only a uniquely proven intake record and keeps the form answers', () => {
  const h = fixture({ end: '2026-11-11' });
  const intakeRows = [
    Array(20).fill('header'),
    [new Date(), new Date(), '', 'Awaiting Owner', 'owner-token-123', 'cino|2026-11-01|2026-11-10', 'Potential Stay', 'Cino', 'Jack Russell', '2026-11-01', '2026-11-10', 'Owner One', '0400000000', JSON.stringify({ additionalInstructions: 'Blue harness.' }), '', '', '', 2, '', '']
  ];
  const intake = sheet('Dog_Intake_Records', intakeRows, h.bookings.getParent());
  h.context.getIntakeSheet_ = () => intake;
  const oldRows = h.bookings.getDataRange().getValues();
  oldRows[1][4] = new Date('2026-11-10T00:00:00+11:00');
  const before = { dogName: 'Cino', startDate: '2026-11-01', endDate: '2026-11-10', stayId: stayIdA, bookingType: 'Potential Stay' };
  const after = { dogName: 'Cino', startDate: '2026-11-01', endDate: '2026-11-11', stayId: stayIdA, bookingType: 'Confirmed Boarding' };
  const result = h.context.migrateIntakeIdentitiesForGuest_('cino|2026-11-01|2026-11-10', 'cino|2026-11-01|2026-11-11', 'Cino', {
    mainSheet: h.bookings, sourceRows: oldRows, row: 2, before, after, dogId: dogIdA
  });
  assert.equal(result.digital, 1);
  assert.equal(intakeRows[1][4], 'owner-token-123');
  assert.equal(intakeRows[1][10], '2026-11-11');
  assert.equal(intakeRows[1][6], 'Confirmed Boarding');
  assert.equal(intakeRows[1][18], stayIdA);
  assert.equal(intakeRows[1][19], dogIdA);
  assert.equal(JSON.parse(intakeRows[1][13]).additionalInstructions, 'Blue harness.');
});

test('ambiguous source bookings do not migrate an old intake record', () => {
  const duplicate = [new Date(), 'Cino', 'Jack Russell', new Date('2026-11-01T00:00:00+11:00'), new Date('2026-11-10T00:00:00+11:00'), 'Owner Two', '0411111111', '', '', '', '', 'Potential Stay', dogIdB, '00063', stayIdB];
  const h = fixture({ end: '2026-11-11', extraBookings: [duplicate] });
  const intakeRows = [Array(20).fill('header'), [new Date(), new Date(), '', 'Awaiting Owner', 'token', 'cino|2026-11-01|2026-11-10', 'Potential Stay', 'Cino', 'Jack Russell', '2026-11-01', '2026-11-10', 'Owner One', '0400000000', '{}', '', '', '', 2, '', '']];
  const intake = sheet('Dog_Intake_Records', intakeRows, h.bookings.getParent());
  h.context.getIntakeSheet_ = () => intake;
  const oldRows = h.bookings.getDataRange().getValues();
  oldRows[1][4] = new Date('2026-11-10T00:00:00+11:00');
  const before = { dogName: 'Cino', startDate: '2026-11-01', endDate: '2026-11-10', stayId: stayIdA, bookingType: 'Potential Stay' };
  const after = { dogName: 'Cino', startDate: '2026-11-01', endDate: '2026-11-11', stayId: stayIdA, bookingType: 'Confirmed Boarding' };
  const result = h.context.migrateIntakeIdentitiesForGuest_('cino|2026-11-01|2026-11-10', 'cino|2026-11-01|2026-11-11', 'Cino', {
    mainSheet: h.bookings, sourceRows: oldRows, row: 2, before, after, dogId: dogIdA
  });
  assert.equal(result.digital, 0);
  assert.equal(intakeRows[1][5], 'cino|2026-11-01|2026-11-10');
  assert.equal(intakeRows[1][10], '2026-11-10');
});

test('adding the identity columns extends an existing 18-column intake sheet without changing its records', () => {
  const h = fixture();
  const oldHeaders = h.context.INTAKE_HEADERS_.slice(0, 18);
  const existingRow = [new Date(), new Date(), '', 'Awaiting Owner', 'old-token', 'cino|2026-11-01|2026-11-11', 'Potential Stay', 'Cino', 'Jack Russell', '2026-11-01', '2026-11-11', 'Owner One', '0400000000', JSON.stringify({ additionalInstructions: 'Preserve this.' }), '', '', '', 2];
  const intake = sheet('Dog_Intake_Records', [oldHeaders, existingRow], h.bookings.getParent(), 18);
  h.setIntakeSheet(intake);
  const expected = existingRow.slice();
  const loaded = h.context.getIntakeSheet_();
  assert.equal(loaded.getMaxColumns(), 20);
  assert.equal(Array.from(intake.rows[0].slice(18, 20)).join('|'), 'Stay ID|Dog ID');
  assert.deepEqual(Array.from(intake.rows[1].slice(0, 18)), expected);
});

test('stable identity resolves the current Sydney booking dates even when the script timezone is UTC', () => {
  const h = fixture({ end: '2026-11-11' });
  const request = { dogName: 'Cino', startDate: '2026-11-01', endDate: '2026-11-11', stayId: stayIdA, dogId: dogIdA };
  assert.equal(h.context.normalizeIntakeDateValue_(h.bookings.rows[1][3]), '2026-11-01');
  assert.equal(h.context.findIntakeBookingRow_(h.bookings.getDataRange().getValues(), request.dogName, request.startDate, request.endDate, request), 2);
});

test('the same-name same-date duplicate fails closed without IDs and stable IDs isolate each dog', () => {
  const second = [new Date(), 'Cino', 'Jack Russell', new Date('2026-11-01T00:00:00+11:00'), new Date('2026-11-11T00:00:00+11:00'), 'Owner Two', '0411111111', '', '', '', '', 'Potential Stay', dogIdB, '00063', stayIdB];
  const h = fixture({ extraBookings: [second] });
  assert.throws(() => h.context.findIntakeBookingRow_(h.bookings.getDataRange().getValues(), 'Cino', '2026-11-01', '2026-11-11'), /Several bookings match/);
  assert.equal(h.context.findIntakeBookingRow_(h.bookings.getDataRange().getValues(), 'Cino', '2026-11-01', '2026-11-11', { stayId: stayIdB, dogId: dogIdB }), 3);
  assert.throws(() => h.context.intakeBookingRowByStableIds_(h.bookings, stayIdA, dogIdB), /same booking/);
});

test('stale dates without matching audit evidence and duplicate current keys are rejected', () => {
  const old = record({ end: '2026-11-10', stayKey: 'cino|2026-11-01|2026-11-11' });
  const h = fixture({ end: '2026-11-11' });
  assert.throws(() => h.context.resolveIntakeBookingForRecord_(h.bookings, h.bookings.getDataRange().getValues(), old), /outdated/);
  const second = [new Date(), 'Cino', 'Jack Russell', new Date('2026-11-01T00:00:00+11:00'), new Date('2026-11-11T00:00:00+11:00'), 'Owner Two', '0411111111', '', '', '', '', 'Potential Stay', dogIdB, '00063', stayIdB];
  const ambiguous = fixture({ extraBookings: [second] });
  const current = record({ stayKey: 'cino|2026-11-01|2026-11-11' });
  assert.throws(() => ambiguous.context.resolveIntakeBookingForRecord_(ambiguous.bookings, ambiguous.bookings.getDataRange().getValues(), current), /more than one current booking/);
  const duplicateAudit = fixture({ end: '2026-11-11', audit: [movedAudit(), movedAudit()] });
  assert.throws(() => duplicateAudit.context.resolveIntakeBookingForRecord_(duplicateAudit.bookings, duplicateAudit.bookings.getDataRange().getValues(), old), /outdated|could refer/);
  assert.throws(() => h.context.resolveIntakeBookingForRecord_(h.bookings, h.bookings.getDataRange().getValues(), { ...record(), stayId: stayIdA }), /missing part/);
});

test('owner form drafts cannot restore stale booking identity or date fields', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Intake.html'), 'utf8');
  assert.match(html, /function isBookingIdentityField\(name\)\{return name==="bookingPeriod"\|\|name==="dogName"\|\|name==="declarationDogName"\}/);
  assert.match(html, /function isIntakeDraftExcludedField\(name\)\{return name==="termsAccepted"\|\|name==="accuracyConfirmed"\|\|name==="signatureName"\|\|name==="declarationDate"\|\|isBookingIdentityField\(name\)\}/);
  assert.match(html, /applyAnswers\(saved,true\)/);
  assert.match(html, /restorable=Object\.entries\(draft\.fields\)\.filter\(\(\[name\]\)=>!isIntakeDraftExcludedField\(name\)/);
  assert.match(html, /restorable\.forEach\(\(\[name,value\]\)=>setGroup\(name,value\)\)/);
  assert.match(html, /if\(isIntakeDraftExcludedField\(el\.name\)\)continue/);
  assert.match(html, /if\(preserveBookingIdentity&&isIntakeDraftExcludedField\(k\)\)return/);
});
