const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const backend = fs.readFileSync(path.join(root, 'apps-script', 'Code.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'waffle-v11.1.13.js'), 'utf8');
const calendar = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const future = fs.readFileSync(path.join(root, 'waffle-v11.1.96.js'), 'utf8');

const start = backend.indexOf('function findV108BoardingRowForUpdate_');
const end = backend.indexOf('function getV108DogHistory_', start);
assert.ok(start >= 0 && end > start, 'Stable boarding update lookup is present');

const sandbox = {
  normalizeV108Identity_(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  },
  normalizeDateValue_(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : String(value || '');
  }
};
vm.createContext(sandbox);
vm.runInContext(`${backend.slice(start, end)}\nthis.lookup = findV108BoardingRowForUpdate_;`, sandbox);

const rows = [
  ['Timestamp', 'Dog', 'Breed', 'Start', 'End', 'Owner', 'Phone', '', '', 'Notes', 'Edit', 'Type'],
  ['', 'Rocco', 'Cavoodle', '2026-10-21', '2026-10-29', 'Amelia', '0412 345 678', '', '', '', '', 'Confirmed Boarding'],
  ['', 'Rocco', 'Cavoodle', '2026-10-21', '2026-11-02', 'Different Owner', '0499 000 111', '', '', '', '', 'Confirmed Boarding']
];

assert.equal(sandbox.lookup(rows, {
  dogName: 'Rocco',
  originalStartDate: '2026-10-21',
  originalEndDate: '2026-10-28',
  ownerName: 'Amelia',
  phone: '0412 345 678',
  breed: 'Cavoodle'
}), 2, 'A stale original end date still resolves the unique owner-matched stay');

assert.equal(sandbox.lookup(rows, {
  dogName: 'Rocco',
  originalStartDate: '2026-10-21',
  originalEndDate: '2026-10-29'
}), 2, 'The exact original date remains the preferred match');

assert.throws(() => sandbox.lookup(rows, {
  dogName: 'Rocco',
  originalStartDate: '2026-10-21',
  originalEndDate: '2026-10-30'
}), /Multiple confirmed boardings/, 'An ambiguous relaxed match is rejected');

assert.equal(sandbox.lookup(rows, {
  sourceRow: 2,
  dogName: 'Rocco',
  originalStartDate: '2026-10-21',
  originalEndDate: '2026-10-28',
  ownerName: 'Amelia'
}), 2, 'A validated source row survives a stale displayed end date');

assert.match(client, /sourceRow: sourceRow >= 2 \? sourceRow : ''/);
assert.match(client, /originalEndDate,/);
assert.match(calendar, /sourceRow: i \+ 1/);
assert.match(calendar, /data-directory-source-row="\$\{i \+ 1\}"/);
assert.match(future, /data-directory-source-row="\$\{escapeHtml\(props\.sourceRow \|\| ''\)\}"/);

console.log('Stay date update identity tests passed.');
