const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.js'), 'utf8');

function extractFunction(name) {
  const start = code.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing source function ${name}`);
  const nextFunction = code.indexOf('\nfunction ', start + 1);
  const nextAsyncFunction = code.indexOf('\nasync function ', start + 1);
  const ends = [nextFunction, nextAsyncFunction].filter(index => index >= 0);
  const end = ends.length ? Math.min(...ends) : code.length;
  return code.slice(start, end);
}

function load(functionNames, stubs = {}) {
  const sandbox = { ...stubs };
  vm.runInNewContext(`${functionNames.map(extractFunction).join('\n')}\nthis.contractFns = { ${functionNames.join(', ')} };`, sandbox);
  return sandbox;
}

function sheetWithRow(row) {
  const writes = [];
  const sheet = {
    getLastRow: () => 2,
    getLastColumn: () => row.length,
    getRange(startRow, startColumn, rowCount, columnCount) {
      return {
        getValues: () => startRow === 1 ? [row.headers] : [row.values],
        setValue(value) { writes.push({ startRow, startColumn, value }); }
      };
    }
  };
  return { sheet, writes };
}

test('intake import save refreshes the existing shared-row timestamp', () => {
  const writes = [];
  const sheet = { getRange(row, column) { return { setValue(value) { writes.push({ row, column, value }); } }; } };
  const sandbox = load(['saveIntakeAttributesForStay_'], {
    getBelongingsSheet_: () => sheet,
    findBelongingsRow_: () => 4,
    normalizeGuestIntakeAttributes_: value => value,
    normalizeDateValue_: value => value,
    touchWaffleDataVersion_: () => {},
    Date
  });

  const before = Date.now();
  sandbox.contractFns.saveIntakeAttributesForStay_('Milo', '2026-10-01', '2026-10-03', 'milo|2026-10-01|2026-10-03', { medicationInstructions: 'With dinner' }, 'Legacy Intake · Confirmed');
  const after = Date.now();

  const timestampWrite = writes.find(write => write.row === 4 && write.column === 1);
  assert.ok(timestampWrite?.value instanceof Date);
  assert.ok(timestampWrite.value.getTime() >= before && timestampWrite.value.getTime() <= after);
  assert.ok(writes.some(write => write.column === 31));
});

test('core booking sync refreshes the shared-row timestamp', () => {
  const writes = [];
  const sheet = { getRange(row, column) { return { setValue(value) { writes.push({ row, column, value }); } }; } };
  const sandbox = load(['syncCoreBookingFieldsToIntakeAttributes_'], {
    getBelongingsSheet_: () => sheet,
    findBelongingsRow_: () => 7,
    Date
  });

  assert.equal(sandbox.contractFns.syncCoreBookingFieldsToIntakeAttributes_('milo|2026-10-01|2026-10-03', {}), true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].column, 1);
  assert.ok(writes[0].value instanceof Date);
});

test('core booking sync leaves a missing care row untouched', () => {
  const writes = [];
  const sheet = { getRange(row, column) { return { setValue(value) { writes.push({ row, column, value }); } }; } };
  const sandbox = load(['syncCoreBookingFieldsToIntakeAttributes_'], {
    getBelongingsSheet_: () => sheet,
    findBelongingsRow_: () => -1,
    Date
  });

  assert.equal(sandbox.contractFns.syncCoreBookingFieldsToIntakeAttributes_('missing-stay', {}), false);
  assert.deepEqual(writes, []);
});

test('profile reads preserve the stored timestamp and perform no sheet writes', () => {
  const storedAt = new Date('2026-10-06T23:14:00.000Z');
  const headers = Array.from({ length: 34 }, (_, index) => `Column ${index + 1}`);
  headers[0] = 'Updated At';
  headers[1] = 'Stay Key';
  headers[2] = 'Dog Name';
  const values = Array(34).fill('');
  values[0] = storedAt;
  values[1] = 'milo|2026-10-01|2026-10-03';
  values[2] = 'Milo';
  values[30] = '{}';
  values[32] = '[]';
  values[33] = '[]';
  const { sheet, writes } = sheetWithRow({ headers, values });
  const sandbox = load(['readGuestProfileRowsReadOnly_'], {
    getBelongingsHeaders_: () => headers,
    parseDogPhotoJson_: () => null,
    parseIntakeAttributesJson_: () => ({}),
    parseV108DogPhotoGalleryJson_: () => [],
    parseStayPhotosJson_: () => [],
    Date
  });

  const result = sandbox.contractFns.readGuestProfileRowsReadOnly_(sheet, values[1]);
  assert.equal(result[0].updatedAt, storedAt.toISOString());
  assert.deepEqual(writes, []);
});

test('guest detail returns the stored shared-row timestamp unchanged', () => {
  const storedAt = new Date('2026-10-06T23:14:00.000Z');
  const stayKey = 'milo|2026-10-01|2026-10-03';
  const stayId = 'f5f57ca3-fb50-4e19-8590-10dab77398b1';
  const dogId = 'bb942e2d-2c4c-4be5-a943-f7a9e0ae402c';
  const headers = Array.from({ length: 34 }, (_, index) => `Column ${index + 1}`);
  headers[0] = 'Updated At'; headers[1] = 'Stay Key'; headers[2] = 'Dog Name';
  const careValues = Array(34).fill('');
  careValues[0] = storedAt; careValues[1] = stayKey; careValues[2] = 'Milo';
  careValues[30] = '{}'; careValues[32] = '[]'; careValues[33] = '[]';
  const { sheet: careSheet, writes } = sheetWithRow({ headers, values: careValues });
  const bookingSheet = {
    getDataRange: () => ({ getValues: () => [
      ['Timestamp', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Stay ID', 'Dog ID'],
      [new Date(), 'Milo', '', '2026-10-01', '2026-10-03', stayId, dogId]
    ] }),
    getParent: () => ({ getSheetByName: () => careSheet })
  };
  const sandbox = load(['readGuestProfileRowsReadOnly_', 'getGuestProfileDetail_'], {
    getBelongingsHeaders_: () => headers,
    parseDogPhotoJson_: () => null,
    parseIntakeAttributesJson_: () => ({}),
    parseV108DogPhotoGalleryJson_: () => [],
    parseStayPhotosJson_: () => [],
    validStayIdV11225_: value => value === stayId,
    makeGuestStayKey_: () => stayKey,
    getTargetSheet_: () => bookingSheet,
    Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'Care' }) }
  });

  const result = sandbox.contractFns.getGuestProfileDetail_({ stayKey, stayId, dogId });
  assert.equal(result.resolution.status, 'resolved');
  assert.equal(result.updatedAt, storedAt.toISOString());
  assert.deepEqual(writes, []);
});

test('reviewed inheritance writes a fresh destination timestamp without touching the source', () => {
  const sourceKey = 'milo|2026-09-01|2026-09-03';
  const destinationKey = 'milo|2026-10-01|2026-10-03';
  const sourceUpdatedAt = '2026-09-02T12:00:00.000Z';
  const dogId = 'bb942e2d-2c4c-4be5-a943-f7a9e0ae402c';
  const sourceReads = [];
  const destinationRow = [];
  const destinationSheet = {
    getLastRow: () => destinationRow.length ? 2 : 1,
    appendRow(row) { destinationRow.push(row); },
    getRange() { return { getValue: () => '' }; }
  };
  const bookingRows = Array.from({ length: 9 }, () => []);
  bookingRows[8] = [dogId];
  const bookingSheet = { getDataRange: () => ({ getValues: () => bookingRows }) };
  const sandbox = load(['applyReviewedCareInheritanceV11225_', 'upsertBelongingsRecord_'], {
    validateReviewedCareInheritanceV11225_: () => ({
      sourceId: 'source-stay-id', sourceKey,
      sourceUpdatedAt,
      review: { profile: { medicationInstructions: 'With dinner' }, riskFlags: { foodAllergy: true } }
    }),
    getTargetSheet_: () => bookingSheet,
    confirmedBookingRowsForStayKeyV11225_: (_sheet, key) => key === destinationKey ? [9] : [],
    validStayIdV11225_: id => id === 'destination-stay-id',
    findStayRowByIdV11225_: () => 9,
    auditBookingSnapshotFromSheetRow_: (sheet, row) => {
      assert.equal(sheet, bookingSheet);
      assert.equal(row, 9);
      return { dogName: 'Milo', startDate: '2026-10-01', endDate: '2026-10-03' };
    },
    v108DogIdentityAt_: (rows, rowIndex) => {
      assert.equal(rowIndex, 8);
      return { dogId: rows[rowIndex][0] };
    },
    makeGuestStayKey_: (name, start, end) => `${String(name).toLowerCase()}|${start}|${end}`,
    getBelongingsSheet_: () => destinationSheet,
    readBelongingsRecords_: (_sheet, keys) => { sourceReads.push(keys); return []; },
    mergeReviewedDogCareFieldsV1_: (_existing, incoming) => incoming,
    findBelongingsRow_: () => -1,
    normalizeBelongingsItems_: () => ({ blanket: { present: false, description: '' } }),
    normalizeBelongingsRiskFlags_: incoming => incoming || {},
    normalizeGuestIntakeAttributes_: incoming => incoming,
    normalizeDateValue_: value => value,
    BELONGINGS_ITEM_CONFIG_: [{ key: 'blanket' }],
    BELONGINGS_RISK_CONFIG_: [{ key: 'foodAllergy' }],
    parseDogPhotoJson_: () => null,
    normalizeV108DogPhotoGallery_: () => [],
    touchWaffleDataVersion_: () => {},
    Date
  });

  const result = sandbox.contractFns.applyReviewedCareInheritanceV11225_(
    {}, dogId, 'Milo', destinationKey, '2026-10-01', '2026-10-03', 'destination-stay-id'
  );

  assert.equal(result.copied, true);
  assert.equal(sourceReads.length, 1);
  assert.equal(sourceReads[0][0], destinationKey);
  assert.equal(destinationRow.length, 1);
  assert.equal(destinationRow[0][1], destinationKey);
  assert.ok(destinationRow[0][0] instanceof Date);
  assert.notEqual(destinationRow[0][0].toISOString(), sourceUpdatedAt);
  assert.equal(destinationRow[0][11], 'Reviewed from previous stay');
});

test('profile reads preserve timestamp strings and return empty for absent timestamps', () => {
  const headers = Array.from({ length: 34 }, (_, index) => `Column ${index + 1}`);
  headers[0] = 'Updated At'; headers[1] = 'Stay Key'; headers[2] = 'Dog Name';
  const storedString = 'legacy-time-value';
  const values = Array(34).fill('');
  values[0] = storedString; values[1] = 'milo|2026-10-01|2026-10-03'; values[2] = 'Milo';
  values[30] = '{}'; values[32] = '[]'; values[33] = '[]';
  const sandbox = load(['readGuestProfileRowsReadOnly_'], {
    getBelongingsHeaders_: () => headers,
    parseDogPhotoJson_: () => null,
    parseIntakeAttributesJson_: () => ({}),
    parseV108DogPhotoGalleryJson_: () => [],
    parseStayPhotosJson_: () => []
  });
  const sheet = { getLastRow: () => 2, getLastColumn: () => 34, getRange: row => ({ getValues: () => [row === 1 ? headers : values] }) };

  assert.equal(sandbox.contractFns.readGuestProfileRowsReadOnly_(sheet, values[1])[0].updatedAt, storedString);
  values[0] = '';
  assert.equal(sandbox.contractFns.readGuestProfileRowsReadOnly_(sheet, values[1])[0].updatedAt, '');
});
