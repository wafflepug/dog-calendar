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
  v110OperationForStay(key) {
    return sandbox.v110OperationsMap[key] || null;
  }
};

vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.__carePastApi = { v1086ExcludeCheckedOutCurrent, v1086PastBookingsFromCsv, v1086MoveCheckedOutStayToPast };`, sandbox);

const checkedOutToday = {
  stayKey: 'jed|2026-09-20|2026-09-30',
  dogName: 'Jed',
  startDate: '2026-09-20',
  endDate: '2026-09-30'
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
  '2026-09-20,Jed,Staffy,2026-09-20,2026-09-30,Ada,,,,,,Boarding',
  '2026-09-21,Coco,Poodle,2026-09-21,2026-09-25,Lee,,,,,,Boarding',
  '2026-08-01,Waffle,Pug,2026-08-01,2026-08-05,Ray,,,,,,Boarding'
].join('\n');
const pastBookings = sandbox.__carePastApi.v1086PastBookingsFromCsv(csv);
assert.deepEqual(
  Array.from(pastBookings, booking => booking.stayKey),
  [checkedOutToday.stayKey, completed.stayKey]
);

const backendSource = fs.readFileSync(path.join(root, 'apps-script', 'Code.js'), 'utf8');
const backendStart = backendSource.indexOf('function getPastGuestDirectoryPayload_');
const backendEnd = backendSource.indexOf('var WAFFLE_CACHE_NAMESPACE_', backendStart);
assert.ok(backendStart >= 0 && backendEnd > backendStart, 'Past directory backend function is present');
const backendRows = [
  ['Timestamp', 'Dog', 'Breed', 'Start', 'End', 'Owner', 'Phone', '', '', 'Notes', 'Edit', 'Type'],
  ['2026-09-20', 'Jed', 'Staffy', '2026-09-20', '2026-09-30', 'Ada', '', '', '', '', '', 'Boarding'],
  ['2026-09-21', 'Coco', 'Poodle', '2026-09-21', '2026-09-25', 'Lee', '', '', '', '', '', 'Boarding'],
  ['2026-08-01', 'Waffle', 'Pug', '2026-08-01', '2026-08-05', 'Ray', '', '', '', '', '', 'Boarding']
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
  Utilities: { formatDate: () => '2026-09-23' },
  normalizeDateValue_: value => String(value || ''),
  makeGuestStayKey_: (name, start, end) => [String(name).toLowerCase(), start, end].join('|'),
  readStayOperations_(keys) {
    return keys.includes(checkedOutToday.stayKey)
      ? [{ stayKey: checkedOutToday.stayKey, status: 'checked_out' }]
      : [];
  },
  readBelongingsSummaryRecords_: () => [],
  getBelongingsSheet_: () => ({}),
  getIntakeStatusRecords_: () => [],
  getLegacyIntakeStatusRecords_: () => []
};
vm.createContext(backendSandbox);
vm.runInContext(`${backendSource.slice(backendStart, backendEnd)}\nthis.result = getPastGuestDirectoryPayload_({ limit: 250 });`, backendSandbox);
assert.deepEqual(
  Array.from(backendSandbox.result.bookings, booking => booking.stayKey),
  [checkedOutToday.stayKey, completed.stayKey]
);
assert.equal(backendSandbox.result.diagnostics.checkedOutIncluded, 1);

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
