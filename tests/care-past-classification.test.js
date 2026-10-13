const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'waffle-v10.8.6.js'), 'utf8');
const appendedPastCards = [];
const countNodes = {
  v1082CurrentStayCount: { textContent: '' },
  v1082PastStayCount: { textContent: '' },
  'past-directory-grid': { appendChild(card) { appendedPastCards.push(card); } }
};

const sandbox = {
  console,
  applyGuestDirectoryResponse(response) { sandbox.renderedCurrent = response; },
  v1082ApplyPastResponse(response) { sandbox.renderedPast = response; },
  v1082ApplyPastReadOnly(card) { card.readOnly = true; },
  filterGuestDirectoryCards() { sandbox.filtered = true; },
  getLocalTodayDateString() { return '2026-09-23'; },
  document: {
    addEventListener() {},
    getElementById(id) { return countNodes[id] || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  },
  WAFFLE_PAGE: 'directory',
  V1082_PAST_LIMIT: 250,
  v1082PastResponse: null,
  v110OperationsMap: {},
  v110MakeStayKey(name, start, end) {
    return [String(name).toLowerCase(), start, end].join('|');
  },
  v110OperationForStay(booking) {
    const key = typeof booking === 'object' ? booking.stayKey : booking;
    return sandbox.v110OperationsMap[key] || null;
  }
};

vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.__carePastApi = { v1086ExcludeCheckedOutCurrent, v1086PastBookingsFromCsv, v1086MoveCheckedOutStayToPast };`, sandbox);

const checkedOutToday = {
  stayKey: 'jed|2026-09-20|2026-10-30',
  dogName: 'Jed',
  startDate: '2026-09-20',
  endDate: '2026-10-30'
};
const active = {
  stayKey: 'coco|2026-09-21|2026-09-25',
  dogName: 'Coco',
  startDate: '2026-09-21',
  endDate: '2026-09-25'
};
const completed = {
  stayKey: 'waffle|2026-08-01|2026-08-05',
  dogName: 'Waffle',
  startDate: '2026-08-01',
  endDate: '2026-08-05'
};

const response = {
  bookings: [checkedOutToday, active],
  operations: [
    { stayKey: checkedOutToday.stayKey, status: 'checked_out' },
    { stayKey: active.stayKey, status: 'checked_in' }
  ]
};

const current = sandbox.__carePastApi.v1086ExcludeCheckedOutCurrent(response);
assert.deepEqual(Array.from(current.bookings, booking => booking.stayKey), [active.stayKey]);

sandbox.v110OperationsMap[checkedOutToday.stayKey] = {
  stayKey: checkedOutToday.stayKey,
  status: 'checked_out'
};
const csv = [
  'Timestamp,Dog,Breed,Start,End,Owner,Phone,,,Notes,Edit,Type',
  '2026-09-20,Jed,Staffy,2026-09-20,2026-10-30,Ada,,,,,,Boarding',
  '2026-09-21,Coco,Poodle,2026-09-21,2026-09-25,Lee,,,,,,Boarding',
  '2026-08-01,Waffle,Pug,2026-08-01,2026-08-05,Ray,,,,,,Boarding'
].join('\n');
const pastBookings = sandbox.__carePastApi.v1086PastBookingsFromCsv(csv);
assert.deepEqual(
  Array.from(pastBookings, booking => booking.stayKey),
  [checkedOutToday.stayKey, completed.stayKey]
);

const backendSource = fs.readFileSync(path.join(root, 'apps-script', 'Code.js'), 'utf8');
const stayIdentitySource = fs.readFileSync(path.join(root, 'apps-script', 'StableStayIdentity.js'), 'utf8');
const backendStart = backendSource.indexOf('function getPastGuestDirectoryPayload_');
const backendEnd = backendSource.indexOf('var WAFFLE_CACHE_NAMESPACE_', backendStart);
const dogIdentityStart = backendSource.indexOf('function v108DogIdentityAt_');
const dogIdentityEnd = backendSource.indexOf('\nfunction formatV108DogNumber_', dogIdentityStart);
assert.ok(backendStart >= 0 && backendEnd > backendStart, 'Past directory backend function is present');
assert.ok(dogIdentityStart >= 0 && dogIdentityEnd > dogIdentityStart, 'Dog identity reader is present');
const backendRows = [
  ['Timestamp', 'Dog', 'Breed', 'Start', 'End', 'Owner', 'Phone', '', '', 'Notes', 'Edit', 'Type', 'Stay ID', 'Last Stay Mutation ID', 'Dog ID', 'Dog Number'],
  ['2026-09-20', 'Jed', 'Staffy', '2026-09-20', '2026-10-30', 'Ada', '', '', '', '', '', 'Boarding', '00000000-0000-4000-8000-000000000001', '', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '#00001'],
  ['2026-09-21', 'Coco', 'Poodle', '2026-09-21', '2026-09-25', 'Lee', '', '', '', '', '', 'Boarding', '00000000-0000-4000-8000-000000000002', '', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '#00002'],
  ['2026-08-01', 'Waffle', 'Pug', '2026-08-01', '2026-08-05', 'Ray', '', '', '', '', '', 'Boarding', '00000000-0000-4000-8000-000000000003', '', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '#00003'],
  ['2026-07-01', 'Coco', 'Poodle', '2026-07-01', '2026-07-05', 'Lee', '', '', '', '', '', 'Boarding', '00000000-0000-4000-8000-000000000004', '', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '#00002'],
  ['2026-07-01', 'Coco', 'Poodle', '2026-07-01', '2026-07-05', 'Sam', '', '', '', '', '', 'Boarding', '00000000-0000-4000-8000-000000000005', '', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '#00004'],
  ['2026-06-01', 'Coco', 'Poodle', '2026-06-01', '2026-06-05', 'Lee', '', '', '', '', '', 'Boarding', '00000000-0000-4000-8000-000000000006', '', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '#00002']
];
let operationRecords = [
  { stayKey: checkedOutToday.stayKey, stayId: '00000000-0000-4000-8000-000000000001', status: 'checked_out', checkedOutAt: '2026-10-12T14:30:00.000Z' }
];
const backendSandbox = {
  getTargetSheet_() {
    return {
      getDataRange() {
        return { getValues: () => backendRows, getDisplayValues: () => backendRows };
      },
      getParent() { return { getSpreadsheetTimeZone: () => 'Australia/Sydney' }; }
    };
  },
  Session: { getScriptTimeZone: () => 'Australia/Sydney' },
  Utilities: {
    formatDate(value, timezone) {
      if (Object.prototype.toString.call(value) !== '[object Date]' || value.toISOString() !== '2026-10-12T14:30:00.000Z') return '2026-09-23';
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value).map(part => [part.type, part.value]));
      return `${parts.year}-${parts.month}-${parts.day}`;
    }
  },
  normalizeDateValue_: value => String(value || '').slice(0, 10),
  makeGuestStayKey_: (name, start, end) => [String(name).toLowerCase(), start, end].join('|'),
  readStayOperations_(query) {
    const keys = Array.isArray(query) ? query : (query?.stayKeys || []);
    const ids = Array.isArray(query) ? [] : (query?.stayIds || []);
    return operationRecords.filter(operation => keys.includes(operation.stayKey) || ids.includes(operation.stayId));
  },
  readBelongingsSummaryRecords_: () => [],
  getBelongingsSheet_: () => ({}),
  getBelongingsSheetReadOnly_: () => ({}),
  getIntakeStatusRecords_: () => [],
  getLegacyIntakeStatusRecords_: () => []
};
vm.createContext(backendSandbox);
vm.runInContext(`${stayIdentitySource}\n${backendSource.slice(dogIdentityStart, dogIdentityEnd)}\n${backendSource.slice(backendStart, backendEnd)}\nthis.result = getPastGuestDirectoryPayload_({ limit: 250 });`, backendSandbox);
assert.deepEqual(
  Array.from(backendSandbox.result.bookings, booking => booking.stayId),
  [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000006'
  ]
);
assert.equal(backendSandbox.result.diagnostics.checkedOutIncluded, 1);
const checkedOutBooking = backendSandbox.result.bookings.find(booking => booking.dogName === 'Jed');
assert.equal(checkedOutBooking.checkoutDate, '2026-10-13', 'UTC checkout timestamp is rendered as the local Sydney date across midnight');
assert.equal(checkedOutBooking.endDate, '2026-10-30', 'the scheduled end remains unchanged when actual checkout is earlier');
assert.equal(checkedOutBooking.operationalStatus, 'checked_out');
assert.equal(backendSandbox.result.bookings.find(booking => booking.dogName === 'Waffle').stayId, '00000000-0000-4000-8000-000000000003');
const pastCocos = backendSandbox.result.bookings.filter(booking => booking.dogName === 'Coco');
assert.equal(pastCocos.length, 3, 'same-name dogs with different Dog IDs and separate stays remain separate');
assert.deepEqual(Array.from(pastCocos, booking => booking.dogId), ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
assert.equal(pastCocos[0].dogNumber, '#00002');
assert.equal(pastCocos[0].checkoutDate, '2026-07-05');
assert.equal(pastCocos[0].checkoutDateLabel, 'Scheduled checkout');
assert.equal(pastCocos[0].operationalStatus, '', 'elapsed booking end date is not mislabeled as verified operational checkout');

operationRecords = [{
  stayKey: checkedOutToday.stayKey,
  stayId: '00000000-0000-4000-8000-000000000001',
  status: 'checked_out',
  actualCheckoutDate: '2026-10-12',
  checkedOutAt: '2026-10-12T14:30:00.000Z'
}];
vm.runInContext('this.result = getPastGuestDirectoryPayload_({ limit: 250 });', backendSandbox);
assert.equal(backendSandbox.result.bookings.find(booking => booking.dogName === 'Jed').checkoutDate, '2026-10-12', 'the persisted actual checkout date remains authoritative');

backendRows.push([
  '2026-08-01', 'Prior Dog', 'Pug', '2026-08-01', '2026-08-05', 'Ray', '', '', '', '', '', 'Boarding',
  '00000000-0000-4000-8000-000000000001', '', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '#00005'
]);
operationRecords = [{
  stayKey: checkedOutToday.stayKey,
  stayId: '00000000-0000-4000-8000-000000000001',
  status: 'checked_out',
  checkedOutAt: '2026-10-12T14:30:00.000Z'
}];
vm.runInContext('this.result = getPastGuestDirectoryPayload_({ limit: 250 });', backendSandbox);
assert.equal(backendSandbox.result.bookings.some(booking => booking.dogName === 'Jed'), false, 'a duplicated booking Stay ID cannot attach by stable-ID or legacy-key fallback');
const duplicateBookingIdentity = backendSandbox.result.bookings.find(booking => booking.dogName === 'Prior Dog');
assert.ok(duplicateBookingIdentity, 'the completed stay remains in Past');
assert.equal(duplicateBookingIdentity.operationalStatus, '', 'the shared operation is not attached to the historical row either');
backendRows.pop();

operationRecords = [
  { stayKey: checkedOutToday.stayKey, stayId: '00000000-0000-4000-8000-000000000099', status: 'checked_out', checkedOutAt: '2026-09-23T14:30:00.000Z' }
];
vm.runInContext('this.result = getPastGuestDirectoryPayload_({ limit: 250 });', backendSandbox);
assert.equal(backendSandbox.result.bookings.some(booking => booking.stayId === '00000000-0000-4000-8000-000000000001'), false, 'a mismatched operation Stay ID cannot check out a booking through the legacy key');

operationRecords = [1, 2].map(() => ({
  stayKey: checkedOutToday.stayKey,
  stayId: '00000000-0000-4000-8000-000000000001',
  status: 'checked_out',
  checkedOutAt: '2026-09-23T14:30:00.000Z'
}));
operationRecords[1].stayKey = 'waffle|2026-08-01|2026-08-05';
vm.runInContext('this.result = getPastGuestDirectoryPayload_({ limit: 250 });', backendSandbox);
assert.equal(backendSandbox.result.bookings.some(booking => booking.stayId === '00000000-0000-4000-8000-000000000001'), false, 'duplicate stable operation IDs cannot check out the future stay');
assert.equal(backendSandbox.result.bookings.find(booking => booking.stayId === '00000000-0000-4000-8000-000000000003').operationalStatus, '', 'duplicate stable operation IDs stay quarantined despite a unique legacy key');
operationRecords = [
  { stayKey: checkedOutToday.stayKey, stayId: '00000000-0000-4000-8000-000000000001', status: 'checked_out', checkedOutAt: '2026-10-12T14:30:00.000Z' },
  { stayKey: 'waffle|2026-08-01|2026-08-05', stayId: '00000000-0000-4000-8000-000000000001', status: 'checked_out', checkedOutAt: '2026-10-12T14:30:00.000Z', identityConflict: true }
];
vm.runInContext('this.result = getPastGuestDirectoryPayload_({ limit: 250 });', backendSandbox);
assert.equal(backendSandbox.result.bookings.some(booking => booking.stayId === '00000000-0000-4000-8000-000000000001'), false, 'a conflicted operation with the same stable ID quarantines its otherwise valid duplicate');

sandbox.v1082PastResponse = {
  bookings: [completed],
  totalPastStays: 1,
  returned: 1
};
const classNames = new Set(['directory-card']);
const card = {
  dataset: {
    directoryStayKey: checkedOutToday.stayKey,
    directoryStartDate: checkedOutToday.startDate,
    directoryEndDate: checkedOutToday.endDate
  },
  classList: {
    contains(name) { return classNames.has(name); },
    remove(name) { classNames.delete(name); }
  }
};
sandbox.__carePastApi.v1086MoveCheckedOutStayToPast(card, checkedOutToday);
assert.equal(card.dataset.v1082PastStay, 'true');
assert.equal(card.dataset.v1082StayKind, 'past');
assert.equal(card.readOnly, true);
assert.deepEqual(appendedPastCards, [card]);
assert.equal(sandbox.v1082PastResponse.totalPastStays, 2);
assert.equal(countNodes.v1082PastStayCount.textContent, '2');
assert.equal(sandbox.filtered, true);

console.log('Care checked-out-to-past classification tests passed.');
