const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const WaffleCsv = require('../waffle-csv');

const app = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const core = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.5-core.js'), 'utf8');
const reconcileStart = app.indexOf('    function getCsvBookingRecords(');
const reconcileEnd = app.indexOf('    function fetchSpreadsheetCsv()', reconcileStart);
const identityStart = core.indexOf('function v1105ConfirmedStayIdentity(');
const identityEnd = core.indexOf('function v1105DedupeConfirmedStays(', identityStart);
assert(reconcileStart >= 0 && reconcileEnd > reconcileStart, 'booking reconciliation helpers are available');
assert(identityStart >= 0 && identityEnd > identityStart, 'shared confirmed identity policy is available');

function harness(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  const sandbox = {
    window: { WaffleCsv },
    getLocalArray(key) { try { return JSON.parse(sandbox.localStorage.getItem(key) || '[]'); } catch (_) { return []; } },
    setLocalArray(key, value) { sandbox.localStorage.setItem(key, JSON.stringify(value)); },
    getPendingPotentialRemovals() { return sandbox.getLocalArray('pendingPotentialRemovals'); },
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); }
    },
    parseCsvDate(value) {
      const text = String(value || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
    },
    makePotentialKey: (name, start, end) => `${String(name || '').trim().toLowerCase()}|${start}|${end || start}`,
    String, Array, Set, Map, JSON
  };
  vm.runInNewContext(`${core.slice(identityStart, identityEnd)}\n${app.slice(reconcileStart, reconcileEnd)}\nthis.reconcile=reconcileTemporaryEvents;`, sandbox);
  return {
    reconcile: sandbox.reconcile,
    read(key) { return JSON.parse(values.get(key) || '[]'); },
    raw(key) { return values.get(key); }
  };
}

const header = 'Timestamp,Dog Name,Breed,Check-In Date,Check-Out Date,Owner Name,Phone,Email,Like,Notes,Edit Link,Booking Type,Dog ID,Dog Number';
function csvBooking({ dog='Milo', breed='Labrador', start='2026-10-05', end='2026-10-09', owner='Alex Owner', phone='0400 111 222', type='Confirmed Boarding', dogId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } = {}) {
  return ['2026-10-01', dog, breed, start, end, owner, phone, 'alex@example.test', '', '', '', type, dogId, '#00001'].join(',');
}
function localStay({ dog='Milo', breed='Labrador', start='2026-10-05', end='2026-10-09', owner='Alex Owner', phone='0400 111 222', dogId='' } = {}) {
  const next = new Date(`${end}T00:00:00`);
  next.setDate(next.getDate()+1);
  return {
    id: 'confirmed_123', title: dog, start,
    end: `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`,
    extendedProps: { dogName:dog, breed, owner, ownerName:owner, phone, dogId, rawStartDate:start, rawEndDate:end, bookingType:'Confirmed Boarding' }
  };
}

test('authoritative same-name/date row removes only its proven same-owner optimistic copy', () => {
  const localA = localStay({dogId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
  const localB = localStay({ owner:'Jordan Owner', phone:'0400 333 444' });
  const state = harness({ temporaryConfirmedStays:[localA, localB], temporaryPotentialStays:[], temporaryMeetGreets:[], pendingPotentialRemovals:[] });
  assert.equal(state.reconcile(`${header}\n${csvBooking()}`), true);
  assert.deepEqual(state.read('temporaryConfirmedStays').map(item => item.extendedProps.ownerName), ['Jordan Owner']);
});

test('different date, different breed/contact, and incomplete identities remain optimistic', () => {
  const stays = [
    localStay({ start:'2026-10-05', end:'2026-10-10' }),
    localStay({ breed:'Pug' }),
    localStay({ phone:'0400 999 888' }),
    localStay({ owner:'' }),
    localStay({ phone:'' })
  ];
  const state = harness({ temporaryConfirmedStays:stays, temporaryPotentialStays:[], temporaryMeetGreets:[], pendingPotentialRemovals:[] });
  state.reconcile(`${header}\n${csvBooking()}`);
  assert.equal(state.read('temporaryConfirmedStays').length, stays.length);
});

test('a different persisted Dog ID prevents reconciliation of an otherwise matching local stay', () => {
  const local = localStay({dogId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});
  const state = harness({ temporaryConfirmedStays:[local], temporaryPotentialStays:[], temporaryMeetGreets:[], pendingPotentialRemovals:[] });
  state.reconcile(`${header}\n${csvBooking({dogId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})}`);
  assert.deepEqual(state.read('temporaryConfirmedStays').map(item => item.extendedProps.dogId), ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
});

test('an ID-less optimistic stay cannot bridge two conflicting authoritative Dog IDs', () => {
  const local = localStay();
  const state = harness({ temporaryConfirmedStays:[local], temporaryPotentialStays:[], temporaryMeetGreets:[], pendingPotentialRemovals:[] });
  state.reconcile(`${header}\n${csvBooking({dogId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})}\n${csvBooking({dogId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'})}`);
  assert.equal(state.read('temporaryConfirmedStays').length, 1);
});

test('an ID-less source row cannot reconcile a local Dog ID when another source ID conflicts', () => {
  const local = localStay({dogId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
  const state = harness({ temporaryConfirmedStays:[local], temporaryPotentialStays:[], temporaryMeetGreets:[], pendingPotentialRemovals:[] });
  state.reconcile(`${header}\n${csvBooking({dogId:''})}\n${csvBooking({dogId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'})}`);
  assert.equal(state.read('temporaryConfirmedStays').length, 1);
});

test('malformed, unavailable, or semantically incomplete CSV cannot clear optimistic stays or pending removals', () => {
  for (const csv of ['', `${header}\n"broken`, header, `${header}\n${csvBooking({start:''})}`]) {
    const stays = [localStay()];
    const pending = ['milo|2026-10-05|2026-10-09'];
    const state = harness({ temporaryConfirmedStays:stays, temporaryPotentialStays:[], temporaryMeetGreets:[], pendingPotentialRemovals:pending });
    const before = ['temporaryConfirmedStays','temporaryPotentialStays','temporaryMeetGreets','pendingPotentialRemovals'].map(key => state.raw(key));
    assert.equal(state.reconcile(csv), false);
    assert.deepEqual(['temporaryConfirmedStays','temporaryPotentialStays','temporaryMeetGreets','pendingPotentialRemovals'].map(key => state.raw(key)), before);
  }
});
