const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const WaffleCsv = require('../waffle-csv');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const deleteSource = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.2.00.js'), 'utf8');
const futureBridgeSource = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.1.99.js'), 'utf8');
const meetGreetSource = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.1.11.js'), 'utf8');
const phase4Source = fs.readFileSync(path.join(__dirname, '..', 'phase4-core.js'), 'utf8');

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert(start >= 0 && end > start, `expected source section ${startMarker}`);
  return source.slice(start, end);
}

function dateParser(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}

function storageWith(value) {
  const values = new Map([['boardingDataCache', value]]);
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, next) { values.set(key, String(next)); }
  };
}

function appCachePatcher(storage) {
  const sandbox = {
    window: { WaffleCsv },
    localStorage: storage,
    parseCsvDate: dateParser
  };
  const source = section(appSource, '    function patchGuestRecordInCachedCsv(', '    function migrateDirectoryClientStayKey(');
  vm.runInNewContext(`${source}\nthis.patchGuestRecordInCachedCsv = patchGuestRecordInCachedCsv;`, sandbox);
  return sandbox.patchGuestRecordInCachedCsv;
}

function cachedCsvRemover(storage) {
  const sandbox = {
    window: { WaffleCsv },
    localStorage: storage,
    parseCsvDate: dateParser,
    Date,
    String,
    Number,
    Array,
    Math
  };
  const source = section(deleteSource, '  function normalizeIdentity(', '  function cardIdentity(');
  vm.runInNewContext(`${source}\nthis.removeFromCachedCsv = removeFromCachedCsv;`, sandbox);
  return sandbox.removeFromCachedCsv;
}

function futureConfirmedReader(storage) {
  const sandbox = {
    window: { WaffleCsv },
    localStorage: storage,
    dateKey: dateParser,
    String,
    Array
  };
  const source = section(futureBridgeSource, '  function confirmedEventsFromCsv(', '  function fullConfirmedEvents(');
  vm.runInNewContext(`${source}\nthis.confirmedEventsFromCsv = confirmedEventsFromCsv;`, sandbox);
  return sandbox.confirmedEventsFromCsv;
}

function extractedAppReader(startMarker, endMarker, storage = storageWith('')) {
  const sandbox = {
    window: { WaffleCsv },
    localStorage: storage,
    parseCsvDate: dateParser,
    getLocalTodayDateString: () => '2026-10-05',
    getLocalArray: () => [],
    makePotentialKey: (dog, start, end) => `${dog.toLowerCase()}|${start}|${end}`,
    String,
    Array,
    Date,
    Math,
    isNaN
  };
  const source = section(appSource, startMarker, endMarker);
  const functionName = startMarker.trim().match(/function\s+(\w+)/)[1];
  vm.runInNewContext(`${source}\nthis.reader = ${functionName};`, sandbox);
  return sandbox.reader;
}

function phase4BookingRows(storage) {
  const sandbox = {
    window: { WaffleCsv },
    localStorage: storage,
    csvDate: dateParser,
    norm: value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    String,
    Array
  };
  const source = section(phase4Source, 'function rows(){', '\nfunction confirmed(');
  vm.runInNewContext(`${source}\nthis.rows = rows;`, sandbox);
  return sandbox.rows;
}

function meetGreetCacheReader(storage) {
  const sandbox = {
    window: { WaffleCsv },
    localStorage: storage,
    normaliseDate: dateParser,
    String,
    Array
  };
  const source = section(meetGreetSource, '  function cachedSpreadsheetMeetEvents(', '  function temporaryMeetEvents(');
  vm.runInNewContext(`${source}\nthis.reader = cachedSpreadsheetMeetEvents;`, sandbox);
  return sandbox.reader;
}

const header = 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Dog ID,Dog Number';
function booking({ dogName = 'Milo', start, end, owner, phone, notes, id = '', number = '' }) {
  return [
    '2026-10-05', dogName, 'Pug', start, end, owner, phone, '', '', notes, '', 'Boarding', id, number
  ].map(WaffleCsv.encodeField).join(',');
}

test('reader decodes multiline and escaped fields while retaining record terminators', () => {
  const note = 'First paragraph, with comma\r\nOwner said "bring the blanket"\nFinal paragraph';
  const source = `\uFEFF${header}\r\n${booking({ start: '2026-10-05', end: '2026-10-09', owner: 'Zoë O’Connor', phone: '0400 123 456', notes: note })}\r\n${booking({ start: '2026-10-07', end: '2026-10-11', owner: 'Second Owner', phone: '0400 654 321', notes: '"literal quotes"' })}`;
  const parsed = WaffleCsv.parse(source);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.length, 3);
  assert.equal(parsed.records[0].cells[0], 'Timestamp');
  assert.equal(parsed.records[1].cells[5], 'Zoë O’Connor');
  assert.equal(parsed.records[1].cells[9], note);
  assert.equal(parsed.records[2].cells[9], '"literal quotes"');
  assert.equal(parsed.records[1].lineEnding, '\r\n');
  assert.equal(parsed.records[2].lineEnding, '');
  assert.equal(WaffleCsv.serialize(parsed.records), source);
});

test('reader handles empty cells, BOM and trailing newline without inventing a row', () => {
  const source = `\uFEFF${header}\n${booking({ start: '2026-10-05', end: '2026-10-05', owner: '', phone: '', notes: '' })}\n`;
  const parsed = WaffleCsv.parse(source);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.length, 2);
  assert.deepEqual(parsed.records[1].cells.slice(5, 7), ['', '']);
  assert.equal(WaffleCsv.serialize(parsed.records), source);
});

test('malformed quoted exports fail closed without yielding partial rows', () => {
  for (const source of [`${header}\n"Milo, a`, `${header}\nM"ilo,breed`, `${header}\n"Milo"x,breed`]) {
    const parsed = WaffleCsv.parse(source);
    assert.equal(parsed.ok, false);
    assert.deepEqual(parsed.records, []);
    assert.match(parsed.error, /quote/i);
  }
});

test('actual Care cache patcher updates only the exact stay and preserves neighboring records', () => {
  const first = booking({ start: '2026-10-05', end: '2026-10-09', owner: 'Owner One', phone: '0400 000 001', notes: 'Original\nparagraph' });
  const second = booking({ start: '2026-10-12', end: '2026-10-15', owner: 'Owner Two', phone: '0400 000 002', notes: 'Other stay, unchanged', id: '9f043abe-07ae-4c18-b1d6-853ea4fe4e64', number: '#00008' });
  const originalCsv = `${header}\r\n${first}\r\n${second}`;
  const storage = storageWith(originalCsv);
  const patch = appCachePatcher(storage);
  assert.equal(patch({ originalDogName: 'Milo', startDate: '2026-10-12', endDate: '2026-10-15' }, {
    dogName: 'Milo', breed: 'Pug', startDate: '2026-10-12', endDate: '2026-10-15',
    ownerName: 'Updated Owner', phone: '0400 000 009', notes: 'First line, "quoted"\nSecond line', bookingType: 'Boarding'
  }), true);
  const updated = storage.getItem('boardingDataCache');
  const parsed = WaffleCsv.parse(updated);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.length, 3);
  assert.equal(parsed.records[1].raw, first);
  assert.equal(parsed.records[2].cells[5], 'Updated Owner');
  assert.equal(parsed.records[2].cells[9], 'First line, "quoted"\nSecond line');
  assert.equal(parsed.records[2].cells[12], '9f043abe-07ae-4c18-b1d6-853ea4fe4e64');
  assert.equal(parsed.records[2].lineEnding, '');
});

test('Care reconciliation, current-stay and capacity readers retain multiline note and same-name stay identity', () => {
  const note = 'Paragraph one, with commas\nParagraph two says "hello"';
  const source = `${header}\r\n${booking({ start: '2026-10-05', end: '2026-10-09', owner: 'Owner One', phone: '0400 000 001', notes: note, id: '9f043abe-07ae-4c18-b1d6-853ea4fe4e64', number: '#00008' })}\r\n${booking({ start: '2026-10-12', end: '2026-10-15', owner: 'Owner Two', phone: '0400 000 002', notes: 'Different stay' })}`;
  const storage = storageWith(source);
  const bookingReader = extractedAppReader('    function getCsvBookingRecords(', '    function reconcileTemporaryEvents(');
  const staysReader = extractedAppReader('    function getCurrentBoardingStays(', '    function queryAppsScriptRaw(', storage);
  const bookings = bookingReader(source);
  const current = staysReader(source);
  const capacityRows = phase4BookingRows(storage)();
  assert.equal(bookings.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(bookings.map(row => [row.dogName, row.startDate, row.endDate]))), [
    ['Milo', '2026-10-05', '2026-10-09'],
    ['Milo', '2026-10-12', '2026-10-15']
  ]);
  assert.equal(current.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify([current[0].dogName, current[0].ownerName, current[0].phone, current[0].startDate, current[0].endDate])), [
    'Milo', 'Owner One', '0400 000 001', '2026-10-05', '2026-10-09'
  ]);
  assert.equal(capacityRows.length, 2);
  assert.equal(capacityRows[0].notes, note);
  assert.equal(capacityRows[0].dogId, '9f043abe-07ae-4c18-b1d6-853ea4fe4e64');
  assert.equal(capacityRows[0].dogNumber, '#00008');
});

test('actual meet-and-greet cache reader keeps quoted multiline notes within one event', () => {
  const note = 'Owner said "come inside"\nMeet by the gate at 14:30';
  const storage = storageWith(`${header}\n${booking({ dogName: 'Waffle', start: '2026-10-05', end: '2026-10-05', owner: 'Zoë Owner', phone: '0400 222 333', notes: note }).replace(',Boarding,', ',Meet & Greet,')}`);
  const events = meetGreetCacheReader(storage)();
  assert.equal(events.length, 1);
  assert.deepEqual([events[0].extendedProps.dogName, events[0].extendedProps.ownerName, events[0].extendedProps.notes, events[0].extendedProps.time], [
    'Waffle', 'Zoë Owner', note, '14:30'
  ]);
});

test('actual confirmed-stay cache deleter preserves other same-name stays and refuses malformed cache writes', () => {
  const first = booking({ start: '2026-10-05', end: '2026-10-09', owner: 'Owner One', phone: '0400 000 001', notes: 'Saved paragraph\nwith a comma, and quote "yes"' });
  const second = booking({ start: '2026-10-12', end: '2026-10-15', owner: 'Owner Two', phone: '0400 000 002', notes: 'Keep this stay' });
  const storage = storageWith(`${header}\r\n${first}\r\n${second}`);
  cachedCsvRemover(storage)({ dogName: 'Milo', startDate: '2026-10-05', endDate: '2026-10-09' });
  const afterDelete = storage.getItem('boardingDataCache');
  const remaining = WaffleCsv.parse(afterDelete);
  assert.equal(remaining.ok, true);
  assert.equal(remaining.records.length, 2);
  assert.equal(remaining.records[1].cells[5], 'Owner Two');
  assert.equal(remaining.records[1].cells[9], 'Keep this stay');

  const malformed = `${header}\n"Milo,broken`;
  const malformedStorage = storageWith(malformed);
  cachedCsvRemover(malformedStorage)({ dogName: 'Milo', startDate: '2026-10-05', endDate: '2026-10-09' });
  assert.equal(malformedStorage.getItem('boardingDataCache'), malformed);
  assert.equal(appCachePatcher(malformedStorage)({ originalDogName: 'Milo', startDate: '2026-10-05', endDate: '2026-10-09' }, { dogName: 'Milo' }), false);
  assert.equal(malformedStorage.getItem('boardingDataCache'), malformed);
});

test('future-stay bridge keeps optimistic local confirmed stays with empty or malformed cached CSV', () => {
  const optimistic = [{ title: 'Milo', start: '2026-10-12', extendedProps: { dogName: 'Milo' } }];
  const multiline = 'Paragraph one\nParagraph two, "quoted"';
  const validStorage = storageWith(`${header}\n${booking({ start: '2026-10-12', end: '2026-10-15', owner: 'Zoë Owner', phone: '0400 222 333', notes: multiline })}`);
  validStorage.setItem('temporaryConfirmedStays', JSON.stringify(optimistic));
  const validEvents = futureConfirmedReader(validStorage)(validStorage.getItem('boardingDataCache'));
  assert.equal(validEvents.length, 2);
  assert.equal(validEvents[0].extendedProps.notes, multiline);
  for (const csv of ['', header, `${header}\n"corrupt`]) {
    const storage = storageWith(csv);
    storage.setItem('temporaryConfirmedStays', JSON.stringify(optimistic));
    assert.deepEqual(JSON.parse(JSON.stringify(futureConfirmedReader(storage)(csv))), optimistic);
  }
});
