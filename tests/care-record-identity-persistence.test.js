const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const backend = fs.readFileSync('apps-script/Code.js', 'utf8');

const headers = Array.from({ length: 34 }, (_, i) => `Column ${i + 1}`);
headers[0] = 'Updated At'; headers[1] = 'Stay Key'; headers[2] = 'Dog Name';
const stayId = '00000000-0000-4000-8000-000000000001';
const dogId = '10000000-0000-4000-8000-000000000001';
const key = 'milo|2026-10-01|2026-10-03';

function fixture({ bookingRows = [], careKeys = [key], identityHeaders = false, persisted = {}, identityWritesEnabled = false } = {}) {
  const writes = [];
  const values = [headers.slice()];
  if (identityHeaders) values[0].push('Stay ID', 'Dog ID');
  careKeys.forEach(k => {
    const row = Array(values[0].length).fill(''); row[1] = k;
    if (identityHeaders) { row[34] = persisted.stayId || ''; row[35] = persisted.dogId || ''; }
    values.push(row);
  });
  const sheet = {
    getLastRow: () => values.length,
    getLastColumn: () => values[0].length,
    getMaxColumns: () => 40,
    insertColumnsAfter: () => writes.push('insertColumns'),
    getRange(r, c, n = 1, w = 1) {
      return {
        getValues: () => values.slice(r - 1, r - 1 + n).map(row => row.slice(c - 1, c - 1 + w)),
        setValues: v => { writes.push(['setValues', r, c, v]); values[r - 1].splice(c - 1, v[0].length, ...v[0]); },
        setValue: v => { writes.push(['setValue', r, c, v]); values[r - 1][c - 1] = v; }
      };
    }
  };
  const sandbox = {
    getBelongingsHeaders_: () => headers,
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => name === 'CARE_RECORD_IDENTITY_WRITES_ENABLED' && identityWritesEnabled ? 'true' : '' }) },
    validStayIdV11225_: value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')),
    makeGuestStayKey_: (name, start, end) => `${String(name).toLowerCase()}|${start}|${end}`,
    getTargetSheet_: () => ({ getDataRange: () => ({ getValues: () => bookingRows }) }),
    findBelongingsRow_: (sh, k) => { const matches = values.map((r, i) => r[1] === k ? i + 1 : -1).filter(i => i > 1); return matches[0] || -1; }
  };
  vm.runInNewContext(fs.readFileSync('apps-script/CareRecordIdentity.js', 'utf8') + '\nthis.state=readCareRecordIdentityState_;this.resolve=resolveCareRecordIdentityForWrite_;this.assertWrite=assertCareRecordWriteIdentity_;', sandbox);
  return { ...sandbox, sheet, values, writes };
}

const bookingHeaders = ['Timestamp','Dog Name','Breed','Start Date','End Date','Owner','Phone','x','x','Notes','x','Type','Dog ID','Stay ID'];
const uniqueBookingRows = [bookingHeaders, ['', 'Milo', '', '2026-10-01', '2026-10-03', '', '', '', '', '', '', '', dogId, stayId]];

test('read-only validator accepts the untouched 34-column legacy schema without writes', () => {
  const f = fixture({ bookingRows: uniqueBookingRows });
  assert.equal(f.state(f.sheet).ok, true);
  assert.equal(f.state(f.sheet).legacy, true);
  assert.deepEqual(f.writes, []);
});

test('unknown extension headers are rejected and never overwritten', () => {
  const f = fixture();
  f.values[0].push('Customer Field');
  assert.equal(f.state(f.sheet).ok, false);
  assert.throws(() => f.resolve(f.sheet, { stayKey: key }), /invalid-care-identity-schema/);
  assert.deepEqual(f.writes, []);
});

test('two unknown extension headers are rejected as an invalid enrollment schema', () => {
  const f = fixture();
  f.values[0].push('Customer Field A', 'Customer Field B');
  assert.equal(f.state(f.sheet).ok, false);
  assert.deepEqual(f.writes, []);
});

test('shared legacy keys, duplicate Care rows, malformed IDs, and duplicate identity headers fail closed', () => {
  const duplicateRows = fixture({ careKeys: [key, key] });
  assert.throws(() => duplicateRows.resolve(duplicateRows.sheet, { stayKey: key }), /multiple Care rows/);
  const malformed = fixture({ identityHeaders: true, persisted: { stayId: 'bad' } });
  assert.equal(malformed.state(malformed.sheet).byKey[key][0].valid, false);
  const duplicateHeader = fixture({ identityHeaders: true });
  duplicateHeader.values[0].push('Stay ID');
  assert.equal(duplicateHeader.state(duplicateHeader.sheet).ok, false);
  const shared = fixture({ bookingRows: [bookingHeaders, ...uniqueBookingRows.slice(1), ...uniqueBookingRows.slice(1)] });
  assert.throws(() => shared.resolve(shared.sheet, { stayKey: key }), /multiple-bookings-share-stay-key/);
});

test('explicit write proof appends identity headers and stores both IDs only after unique booking proof', () => {
  const f = fixture({ bookingRows: uniqueBookingRows, identityWritesEnabled: true });
  const resolved = f.resolve(f.sheet, { stayKey: key });
  assert.deepEqual(JSON.parse(JSON.stringify(resolved.identity)), { stayKey: key, stayId, dogId });
  f.assertWrite(f.sheet, { stayKey: key });
  assert.deepEqual(f.values[0].slice(34), ['Stay ID', 'Dog ID']);
  assert.deepEqual(f.values[1].slice(34), [stayId, dogId]);
});

test('default-off identity enrollment keeps new legacy writes within 34 columns', () => {
  const f = fixture({ bookingRows: uniqueBookingRows });
  const proof = f.resolve(f.sheet, { stayKey: key });
  assert.deepEqual(JSON.parse(JSON.stringify(proof.identity)), { stayKey: key, stayId, dogId });
  f.assertWrite(f.sheet, { stayKey: key });
  assert.equal(f.values[0].length, 34);
  assert.deepEqual(f.writes, []);
});

test('existing persisted identity conflict blocks a write without touching the row', () => {
  const f = fixture({ bookingRows: uniqueBookingRows, identityHeaders: true, persisted: { stayId, dogId: '10000000-0000-4000-8000-000000000002' } });
  assert.throws(() => f.resolve(f.sheet, { stayKey: key }), /stored Care IDs conflict/);
  assert.deepEqual(f.writes, []);
});

test('reused persisted Stay IDs mark every affected Care row invalid while a Dog ID may repeat', () => {
  const secondKey = 'milo|2026-10-05|2026-10-07';
  const f = fixture({ identityHeaders: true, careKeys: [key, secondKey], persisted: { stayId, dogId } });
  f.values[2][34] = stayId;
  f.values[2][35] = dogId;
  const state = f.state(f.sheet);
  assert.equal(state.ok, true);
  assert.equal(state.byKey[key][0].valid, false);
  assert.equal(state.byKey[secondKey][0].valid, false);
});

test('new booking identity resolves independently and preserves an already appended schema', () => {
  const secondStayId = '00000000-0000-4000-8000-000000000002';
  const secondKey = 'milo|2026-10-05|2026-10-07';
  const secondBooking = ['', 'Milo', '', '2026-10-05', '2026-10-07', '', '', '', '', '', '', '', dogId, secondStayId];
  const f = fixture({ bookingRows: [bookingHeaders, ...uniqueBookingRows.slice(1), secondBooking], identityHeaders: true, careKeys: [key], persisted: { stayId, dogId } });
  const proof = f.resolve(f.sheet, { stayKey: secondKey });
  assert.deepEqual(JSON.parse(JSON.stringify(proof.identity)), { stayKey: secondKey, stayId: secondStayId, dogId });
  f.assertWrite(f.sheet, { stayKey: key });
  assert.deepEqual(f.values[0].slice(34), ['Stay ID', 'Dog ID']);
});

test('date-key carry-forward uses pre-mutation Stay proof for legacy and enrolled rows', () => {
  const oldKey = key, newKey = 'milo|2026-10-05|2026-10-07';
  const careHeaders = [...headers, 'Stay ID', 'Dog ID'];
  const careRow = Array(36).fill(''); careRow[0] = 'before'; careRow[1] = oldKey; careRow[2] = 'Milo'; careRow[34] = stayId; careRow[35] = dogId;
  const writes = [];
  const careValues = [careHeaders, careRow];
  const careSheet = {
    getLastRow: () => 2, getLastColumn: () => 36,
    getRange(r, c, n = 1, w = 1) { return {
      getValues: () => careValues.slice(r - 1, r - 1 + n).map(row => row.slice(c - 1, c - 1 + w)),
      setValue(value) { writes.push([r, c, value]); careRow[c - 1] = value; }
    }; }
  };
  const bookingRows = [bookingHeaders, ['', 'Milo', '', '2026-10-05', '2026-10-07', '', '', '', '', '', '', '', dogId, stayId]];
  const sandbox = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'Pet_Belongings' }) },
    getBelongingsHeaders_: () => headers,
    getTargetSheet_: () => ({ getDataRange: () => ({ getValues: () => bookingRows }) }),
    makeGuestStayKey_: (name, start, end) => `${String(name).toLowerCase()}|${start}|${end}`,
    validStayIdV11225_: value => /^[0-9a-f-]{36}$/i.test(String(value || '')),
    findBelongingsRow_: () => 2,
    Date
  };
  vm.runInNewContext(`${fs.readFileSync('apps-script/CareRecordIdentity.js', 'utf8')}\n${backend.slice(backend.indexOf('function migrateBelongingsIdentityForGuest_('), backend.indexOf('\nfunction findBookingRow_(', backend.indexOf('function migrateBelongingsIdentityForGuest_(')))}\nthis.migrate=migrateBelongingsIdentityForGuest_;`, sandbox);
  const spreadsheet = { getSheetByName: () => careSheet };
  assert.equal(sandbox.migrate(spreadsheet, oldKey, newKey, 'Milo', stayId), true);
  assert.equal(careRow[1], newKey);
  assert.deepEqual(careRow.slice(34), [stayId, dogId]);
  assert.equal(writes.length, 3);
  const legacyRow = Array(34).fill(''); legacyRow[1] = oldKey; legacyRow[2] = 'Milo';
  const legacyValues = [headers, legacyRow];
  const legacyWrites = [];
  const legacySheet = { getLastRow: () => 2, getLastColumn: () => 34, getRange(r, c, n = 1, w = 1) { return { getValues: () => legacyValues.slice(r - 1, r - 1 + n).map(row => row.slice(c - 1, c - 1 + w)), setValue(value) { legacyWrites.push([r, c, value]); legacyRow[c - 1] = value; } }; } };
  assert.equal(sandbox.migrate({ getSheetByName: () => legacySheet }, oldKey, newKey, 'Milo', stayId), true);
  assert.equal(legacyRow[1], newKey);
  assert.equal(legacyWrites.length, 3);
});
