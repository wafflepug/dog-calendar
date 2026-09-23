const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'waffle-v10.8.6.js'), 'utf8');
let renderedResponse = null;

const sandbox = {
  console,
  applyGuestDirectoryResponse() {},
  v1082ApplyPastResponse(response) { renderedResponse = response; },
  document: {
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  },
  WAFFLE_PAGE: 'calendar',
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
vm.runInContext(`${source}\nthis.__carePastApi = { v1086ExcludeCheckedOutPast, v1082ApplyPastResponse };`, sandbox);

const checkedOut = {
  stayKey: 'jed|2026-09-01|2026-09-10',
  dogName: 'Jed',
  startDate: '2026-09-01',
  endDate: '2026-09-10'
};
const completed = {
  stayKey: 'waffle|2026-08-01|2026-08-05',
  dogName: 'Waffle',
  startDate: '2026-08-01',
  endDate: '2026-08-05'
};

const response = {
  bookings: [checkedOut, completed],
  totalPastStays: 2,
  returned: 2,
  operations: [
    { stayKey: checkedOut.stayKey, status: 'checked_out' },
    { stayKey: completed.stayKey, status: 'checked_in' }
  ]
};

const filtered = sandbox.__carePastApi.v1086ExcludeCheckedOutPast(response);
assert.deepEqual(Array.from(filtered.bookings, booking => booking.stayKey), [completed.stayKey]);
assert.equal(filtered.totalPastStays, 1);
assert.equal(filtered.returned, 1);

sandbox.__carePastApi.v1082ApplyPastResponse(response);
assert.deepEqual(Array.from(renderedResponse.bookings, booking => booking.stayKey), [completed.stayKey]);
assert.equal(renderedResponse.totalPastStays, 1);

sandbox.v110OperationsMap[checkedOut.stayKey] = { stayKey: checkedOut.stayKey, status: 'checked_out' };
const cachedResponse = sandbox.__carePastApi.v1086ExcludeCheckedOutPast({
  bookings: [checkedOut, completed],
  totalPastStays: 2,
  operations: []
});
assert.deepEqual(Array.from(cachedResponse.bookings, booking => booking.stayKey), [completed.stayKey]);

console.log('Care past classification tests passed.');
