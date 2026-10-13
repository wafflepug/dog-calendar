const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('apps-script/Code.js', 'utf8');
const readStart = source.indexOf('function readGuestProfileRowsReadOnly_(');
const readEnd = source.indexOf('function getGuestProfileDetail_(', readStart);
const detailEnd = source.indexOf('function getGuestBelongingsDetail_(', readEnd);
const headersStart = source.indexOf('function getBelongingsHeaders_(');
const headersEnd = source.indexOf('function getBelongingsSheet_(', headersStart);
assert(readStart >= 0 && readEnd > readStart && detailEnd > readEnd && headersStart >= 0 && headersEnd > headersStart);

const stayKey = 'milo|2026-10-01|2026-10-03';
const stayId = '00000000-0000-4000-8000-000000000001';
const dogId = '10000000-0000-4000-8000-000000000001';
const bookingHeaders = ['Timestamp','Dog Name','Breed','Start Date','End Date','Owner','Contact','x','x','Notes','x','Booking Type','Dog ID','Stay ID'];

function fixture({ duplicateCareHeader = false, duplicateId = false, conflictingLegacyKey = false } = {}) {
  const calls = { bookingDataRange: 0, careGetRange: 0, careGetLastRow: 0, careGetLastColumn: 0, writes: 0 };
  const sandbox = {
    BELONGINGS_ITEM_CONFIG_: [], BELONGINGS_RISK_CONFIG_: [],
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'Pet_Belongings' }) },
    makeGuestStayKey_: (name, start, end) => `${String(name).trim().toLowerCase()}|${start}|${end}`,
    validStayIdV11225_: value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim()),
    parseDogPhotoJson_: () => null,
    parseIntakeAttributesJson_: value => JSON.parse(value || '{}'),
    parseV108DogPhotoGalleryJson_: () => [], parseStayPhotosJson_: () => []
  };
  vm.runInNewContext(`${source.slice(headersStart, headersEnd)}\nthis.headers=getBelongingsHeaders_;`, sandbox);
  const careHeaders = sandbox.headers();
  if (duplicateCareHeader) careHeaders[0] = 'Wrong Updated Header';
  const careRow = Array(careHeaders.length).fill('');
  careRow[1] = stayKey; careRow[2] = 'Milo'; careRow[30] = '{"medicationInstructions":"fixture"}';
  const careSheet = {
    getLastRow() { calls.careGetLastRow++; return 2; },
    getLastColumn() { calls.careGetLastColumn++; return careHeaders.length; },
    getRange(row, col, rows, width) {
      calls.careGetRange++;
      return { getValues: () => [careHeaders, careRow].slice(row - 1, row - 1 + rows).map(values => values.slice(col - 1, col - 1 + width)), setValue() { calls.writes++; }, setValues() { calls.writes++; } };
    }
  };
  const booking = ['2026-09-01','Milo','Lab','2026-10-01','2026-10-03','Owner','555','','','','','Boarding',dogId,stayId];
  const bookings = [booking];
  if (duplicateId) bookings.push([...booking]);
  if (conflictingLegacyKey) bookings.push([...booking, '']);
  const bookingSheet = {
    getDataRange() { calls.bookingDataRange++; return { getValues: () => [bookingHeaders, ...bookings] }; },
    getParent: () => ({ getSheetByName: () => careSheet })
  };
  sandbox.getTargetSheet_ = () => bookingSheet;
  vm.runInNewContext(`${source.slice(readStart, detailEnd)}\nthis.readProfile=getGuestProfileDetail_;`, sandbox);
  return { calls, read: sandbox.readProfile };
}

test('uncached detail path reduces spreadsheet data reads from three to two', () => {
  const f = fixture();
  const result = f.read({ stayKey, stayId, dogId });
  assert.equal(result.resolution.status, 'resolved');
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), {
    bookingDataRange: 1, careGetRange: 1, careGetLastRow: 2, careGetLastColumn: 1, writes: 0
  });
  // Before: one booking DataRange + one Care header range + one Care body range.
  // After: one booking DataRange + one bounded Care snapshot range.
});

test('single-snapshot read preserves malformed Care headers and duplicate identity rejection', () => {
  const malformed = fixture({ duplicateCareHeader: true }).read({ stayKey, stayId, dogId });
  assert.equal(malformed.resolution.status, 'unresolved');
  assert.equal(malformed.resolution.reason, 'invalid-care-sheet-schema');
  const duplicate = fixture({ duplicateId: true }).read({ stayKey, stayId, dogId });
  assert.equal(duplicate.resolution.status, 'unresolved');
  assert.deepEqual(JSON.parse(JSON.stringify(duplicate.intakeAttributes)), {});
  const conflict = fixture({ conflictingLegacyKey: true }).read({ stayKey, stayId, dogId });
  assert.equal(conflict.resolution.status, 'unresolved');
  assert.deepEqual(JSON.parse(JSON.stringify(conflict.intakeAttributes)), {});
});
