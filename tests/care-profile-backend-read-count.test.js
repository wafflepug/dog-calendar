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

test('profile reads stay read-only and report measured cold/warm server cache states', () => {
  const cacheStart = source.indexOf('function getVersionedWaffleRead_(');
  const cacheEnd = source.indexOf('function getWaffleDataVersions_(', cacheStart);
  const cacheBox = {};
  let version = 'v1';
  let builds = 0;
  const cacheSandbox = {
    Date,
    Utilities: { getUuid: (() => { let id = 0; return () => `server-snapshot-${++id}`; })() },
    getWaffleDataVersion_: () => version,
    waffleReadVariant_: (_action, data) => data.stayKey || 'all',
    waffleReadCacheKey_: (scope, action, v, variant) => [scope, action, v, variant].join(':'),
    CacheService: { getScriptCache: () => ({
      get: key => cacheBox[key] || null,
      put: (key, value) => { cacheBox[key] = value; },
      remove: key => { delete cacheBox[key]; }
    }) },
    safePutWaffleCache_: (key, value) => { cacheBox[key] = JSON.stringify(value); }
  };
  vm.runInNewContext(`${source.slice(cacheStart, cacheEnd)}\nthis.read=getVersionedWaffleRead_;`, cacheSandbox);
  const request = { stayKey };
  const cold = cacheSandbox.read('directory', 'get_guest_profile', request, 90, () => {
    builds++;
    return { record: { stayKey, intakeAttributes: { medicationInstructions: 'fixture' } } };
  });
  const warm = cacheSandbox.read('directory', 'get_guest_profile', request, 90, () => {
    builds++;
    return { record: {} };
  });
  const unchanged = cacheSandbox.read('directory', 'get_guest_profile', {
    ...request, knownVersion: cold.version, knownVariant: cold.variant,
    knownResponseTag: cold.responseTag
  }, 90, () => {
    builds++;
    return { record: {} };
  });
  assert.equal(builds, 1);
  assert.equal(cold.serverCacheState, 'miss');
  assert.equal(warm.serverCacheState, 'hit');
  assert.equal(unchanged.serverCacheState, 'unchanged');
  assert.equal(unchanged.unchanged, true);
  assert.equal(unchanged.responseTag, cold.responseTag);
  for (const response of [cold, warm, unchanged]) {
    assert.equal(Number.isInteger(response.serverElapsedMs), true);
    assert.equal(response.serverElapsedMs >= 0, true);
    assert.equal(Object.keys(response).some(key => /dog|owner|stayKey|identity/i.test(key) && key !== 'record'), false);
  }
  delete cacheBox['directory:get_guest_profile:v1:' + stayKey];
  const afterExpiry = cacheSandbox.read('directory', 'get_guest_profile', request, 90, () => {
    builds++;
    return { record: { stayKey, intakeAttributes: { medicationInstructions: 'new fixture' } } };
  });
  const otherClientOldSnapshot = cacheSandbox.read('directory', 'get_guest_profile', {
    ...request, knownVersion: cold.version, knownVariant: cold.variant,
    knownResponseTag: cold.responseTag
  }, 90, () => { builds++; return { record: {} }; });
  assert.equal(afterExpiry.serverCacheState, 'miss');
  assert.equal(otherClientOldSnapshot.serverCacheState, 'hit');
  assert.equal(otherClientOldSnapshot.unchanged, undefined);
  assert.notEqual(otherClientOldSnapshot.responseTag, cold.responseTag);
  assert.equal(otherClientOldSnapshot.record.intakeAttributes.medicationInstructions, 'new fixture');
  assert.equal(builds, 2);

  delete cacheBox['directory:get_guest_profile:v1:' + stayKey];
  const directExpiry = cacheSandbox.read('directory', 'get_guest_profile', {
    ...request, knownVersion: afterExpiry.version,
    knownVariant: afterExpiry.variant,
    knownResponseTag: afterExpiry.responseTag
  }, 90, () => { builds++; return { record: { stayKey, fresh: true } }; });
  assert.equal(directExpiry.serverCacheState, 'miss');
  assert.equal(directExpiry.unchanged, undefined);
  assert.equal(directExpiry.record.fresh, true);

  cacheBox['directory:get_guest_profile:v1:' + stayKey] = '{broken';
  const corrupt = cacheSandbox.read('directory', 'get_guest_profile', request, 90, () => {
    builds++; return { record: { recovered: true } };
  });
  assert.equal(corrupt.serverCacheState, 'miss');
  assert.equal(corrupt.record.recovered, true);
  cacheBox['directory:get_guest_profile:v1:' + stayKey] = JSON.stringify({ record: { legacy: true } });
  const legacy = cacheSandbox.read('directory', 'get_guest_profile', request, 90, () => {
    builds++; return { record: { upgraded: true } };
  });
  assert.equal(legacy.serverCacheState, 'miss');
  assert.equal(legacy.record.upgraded, true);
  version = 'v2';
  const bumpedVersion = cacheSandbox.read('directory', 'get_guest_profile', {
    ...request, knownVersion: legacy.version, knownVariant: legacy.variant,
    knownResponseTag: legacy.responseTag
  }, 90, () => { builds++; return { record: { newVersion: true } }; });
  assert.equal(bumpedVersion.version, 'v2');
  assert.equal(bumpedVersion.serverCacheState, 'miss');
  assert.equal(bumpedVersion.unchanged, undefined);
});

function directoryRuntimeFixture(kind, reuseSnapshot) {
  const nextTopLevelFunction = from => {
    const match = /\nfunction\s+\w/.exec(source.slice(from + 1));
    return match ? from + 1 + match.index + 1 : source.length;
  };
  const activeStart = source.indexOf('function getGuestDirectoryPayload_(');
  const activeEnd = nextTopLevelFunction(activeStart);
  const pastStart = source.indexOf('function getPastGuestDirectoryPayload_(');
  const pastEnd = nextTopLevelFunction(pastStart);
  const intakeStart = source.indexOf('function getIntakeStatusRecords_(');
  const intakeEnd = nextTopLevelFunction(intakeStart);
  const start = kind === 'active' ? activeStart : pastStart;
  const end = kind === 'active' ? activeEnd : pastEnd;
  assert(start >= 0 && end > start && intakeStart >= 0 && intakeEnd > intakeStart);

  const today = new Date();
  const iso = date => date.toISOString().slice(0, 10);
  const offset = days => { const date = new Date(today); date.setDate(date.getDate() + days); return iso(date); };
  const headings = ['Timestamp','Dog Name','Breed','Start Date','End Date','Owner','Contact','x','x','Notes','x','Booking Type','Dog ID','Stay ID'];
  const row = (name, startDate, endDate, dogSuffix) => [
    '2026-01-01', name, 'Lab', startDate, endDate, `Owner ${dogSuffix}`, `55500000${dogSuffix}`,
    '', '', '', '', 'Boarding', `10000000-0000-4000-8000-00000000000${dogSuffix}`,
    `00000000-0000-4000-8000-00000000000${dogSuffix}`
  ];
  const rows = [headings, row('Today Dog', offset(0), offset(2), 1), row('Past Dog', offset(-5), offset(-2), 2)];
  const intakeRecords = [
    { stayKey: `today dog|${offset(0)}|${offset(2)}`, status: 'Complete', token: 'synthetic-today', dogName: 'Today Dog' },
    { stayKey: `past dog|${offset(-5)}|${offset(-2)}`, status: 'Awaiting Owner', token: 'synthetic-past', dogName: 'Past Dog' }
  ];
  const calls = { bookingDataRange: 0 };
  const sheet = {
    getDataRange() {
      calls.bookingDataRange++;
      return { getValues: () => rows, getDisplayValues: () => rows };
    },
    getParent: () => ({ getSpreadsheetTimeZone: () => 'UTC' })
  };
  const sandbox = {
    Date, calls, INTAKE_HEADERS_: [],
    Session: { getScriptTimeZone: () => 'UTC' },
    Utilities: { formatDate: date => iso(date) },
    getTargetSheet_: () => sheet,
    getBelongingsSheetReadOnly_: () => ({}),
    readBelongingsSummaryRecords_: () => [],
    getLegacyIntakeStatusRecords_: () => [],
    readStayOperations_: () => [],
    stableStayIdAtV11225_: (allRows, index) => allRows[index][13],
    v108DogIdentityAt_: (allRows, index) => ({ dogId: allRows[index][12], dogNumber: '' }),
    makeGuestStayKey_: (name, startDate, endDate) => `${String(name).trim().toLowerCase()}|${startDate}|${endDate}`,
    normalizeDateValue_: value => value instanceof Date ? iso(value) : String(value || '').slice(0, 10),
    getIntakeSheet_: () => ({
      getLastRow: () => 3,
      getRange: () => ({ getValues: () => [['today'], ['past']] })
    }),
    intakeRowToObject_: (_row, sheetRow) => intakeRecords[sheetRow - 2]
  };
  const dispatch = `function getIntakeStatusRecords_(keys, summaries, passedRows) { return actualIntake(keys, summaries, ${reuseSnapshot ? 'passedRows' : 'undefined'}); }`;
  const selectedBuilder = source.slice(start, end);
  const actualIntakeSource = source.slice(intakeStart, intakeEnd).replace('function getIntakeStatusRecords_(', 'function actualIntake(');
  vm.runInNewContext(`${actualIntakeSource}\n${dispatch}\n${selectedBuilder}\nthis.result=${kind === 'active' ? 'getGuestDirectoryPayload_()' : 'getPastGuestDirectoryPayload_({limit:50})'};`, sandbox);
  return { result: sandbox.result, calls };
}

test('active and past directory builders reuse the live booking snapshot for digital intake status', () => {
  for (const kind of ['active', 'past']) {
    const optimized = directoryRuntimeFixture(kind, true);
    const legacyFallback = directoryRuntimeFixture(kind, false);
    assert.deepEqual(JSON.parse(JSON.stringify(optimized.result.bookings)), JSON.parse(JSON.stringify(legacyFallback.result.bookings)));
    assert.deepEqual(JSON.parse(JSON.stringify(optimized.result.digitalIntakes)), JSON.parse(JSON.stringify(legacyFallback.result.digitalIntakes)));
    assert.equal(optimized.calls.bookingDataRange, kind === 'active' ? 1 : 2);
    assert.equal(legacyFallback.calls.bookingDataRange, kind === 'active' ? 2 : 3);
  }
});
