const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../apps-script/StayAdvancePush.js'), 'utf8');
function format(date, zone, pattern) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return pattern === 'H' ? String(Number(p.hour)) : `${p.year}-${p.month}-${p.day}`;
}
function makeContext(extra = {}) {
  const ctx = { Date, JSON, Math, String, Number, Object, Array, isNaN,
    Utilities: { getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, text) => [...crypto.createHash('sha256').update(text).digest()].map(n => n > 127 ? n - 256 : n),
      formatDate: format },
    Session: { getScriptTimeZone: () => 'Australia/Sydney' }, ...extra };
  vm.createContext(ctx); vm.runInContext(source, ctx); return ctx;
}
const ctx = makeContext();
const stay = (identity, startDate, endDate, fields = {}) => ({ identity, dogName: 'Luna', startDate, endDate, ...fields });

test('plans distinct one-day and two-day reminders using calendar dates', () => {
  const planned = ctx.stayAdvancePlanV1_([stay('a', '2026-03-10', '2026-03-11')], '2026-03-08', 7);
  assert.deepEqual(JSON.parse(JSON.stringify(planned)), [
    { identity: 'a', dogName: 'Luna', kind: 'arrival', date: '2026-03-10', daysAhead: 2, category: 'arrivals' },
    { identity: 'a', dogName: 'Luna', kind: 'departure', date: '2026-03-11', daysAhead: 3, category: 'departures' }
  ].filter(event => event.daysAhead <= 2));
  assert.equal(planned[0].dogName, 'Luna');
  const tomorrow = ctx.stayAdvancePlanV1_([stay('a', '2026-03-09', '2026-03-10')], '2026-03-08', 7);
  assert.deepEqual(JSON.parse(JSON.stringify(tomorrow.map(x => [x.kind, x.daysAhead]))), [['arrival', 1], ['departure', 2]]);
});

test('calendar arithmetic crosses DST, month, year and leap-day boundaries', () => {
  assert.equal(ctx.stayAdvanceAddDaysV1_('2026-10-03', 1), '2026-10-04'); // Sydney DST starts here.
  assert.equal(ctx.stayAdvanceAddDaysV1_('2026-12-31', 1), '2027-01-01');
  assert.equal(ctx.stayAdvanceAddDaysV1_('2024-02-28', 1), '2024-02-29');
  assert.equal(format(new Date('2026-10-26T19:30:00Z'), 'Australia/Sydney', 'yyyy-MM-dd'), '2026-10-27');
  assert.equal(format(new Date('2026-10-26T19:30:00Z'), 'Australia/Sydney', 'H'), '6');
  assert.equal(format(new Date('2026-10-26T20:00:00Z'), 'Australia/Sydney', 'H'), '7');
});

test('same-name stays retain separate identities and ambiguous duplicate rows are quarantined', () => {
  const result = ctx.stayAdvancePlanV1_([stay('dog-owner-a', '2026-10-28', '2026-10-28'), stay('dog-owner-b', '2026-10-28', '2026-10-28')], '2026-10-26', 7);
  assert.equal(result.length, 4);
  const headers = ['Created', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Owner', 'Phone', '', '', '', '', 'Booking Type', 'StayID'];
  const rows = [headers,
    ['', 'Luna', 'Pug', '2026-10-28', '2026-10-30', 'A', '111', '', '', '', '', 'Confirmed Boarding', '11111111-1111-4111-8111-111111111111'],
    ['', 'Luna', 'Pug', '2026-10-28', '2026-10-30', 'A', '111', '', '', '', '', 'Confirmed Boarding', '11111111-1111-4111-8111-111111111111'],
    ['', 'Luna', 'Pug', '2026-10-28', '2026-10-30', 'B', '222', '', '', '', '', 'Confirmed Boarding', '22222222-2222-4222-8222-222222222222']];
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.stayAdvanceRowsV1_(rows).map(x => x.stableId))), ['22222222-2222-4222-8222-222222222222']);
  assert.throws(() => ctx.stayAdvanceRowsV1_([headers.concat('Stay ID'), rows[1]]), /Duplicate stay identity headers/);
});

test('invalid dates, invalid UUIDs and reversed stays never produce reminders', () => {
  assert.equal(ctx.stayAdvancePlanV1_([stay('x', '2026-02-30', '2026-03-01')], '2026-02-28', 7).length, 0);
  assert.equal(ctx.stayAdvancePlanV1_([stay('x', '2026-03-02', '2026-03-01')], '2026-02-28', 7).length, 0);
  const rows = [['Created', 'Dog', 'Breed', 'Start', 'End', '', '', '', '', '', '', 'Booking Type', 'Stay ID'], ['', 'Luna', '', '2026-10-28', '2026-10-29', '', '', '', '', '', '', 'Boarding', 'not-a-uuid']];
  assert.equal(ctx.stayAdvanceRowsV1_(rows).length, 0);
});

test('checked-in arrivals and checked-out stays are skipped and threshold is 7am', () => {
  assert.equal(ctx.stayAdvancePlanV1_([stay('a', '2026-10-28', '2026-10-28', { status: 'checked_in' })], '2026-10-26', 7).some(e => e.kind === 'arrival'), false);
  assert.equal(ctx.stayAdvancePlanV1_([stay('a', '2026-10-28', '2026-10-28', { status: 'checked_out' })], '2026-10-26', 7).length, 0);
  assert.equal(ctx.stayAdvancePlanV1_([stay('a', '2026-10-28', '2026-10-28')], '2026-10-26', 6).length, 0);
  assert.equal(ctx.stayAdvancePlanV1_([stay('a', '2026-10-28', '2026-10-28')], '2026-10-26', 7).length, 2);
});

test('receipt keys hash stay identity and distinguish reminder lead times and devices', () => {
  const event = { identity: 'legacy:luna|2026-10-28|owner-secret', kind: 'arrival', date: '2026-10-28', daysAhead: 2 };
  const twoDay = ctx.stayAdvanceReceiptKeyV1_(event, 'device-a');
  assert.equal(twoDay.indexOf('owner-secret'), -1);
  assert.notEqual(twoDay, ctx.stayAdvanceReceiptKeyV1_({ ...event, daysAhead: 1 }, 'device-a'));
  assert.notEqual(twoDay, ctx.stayAdvanceReceiptKeyV1_(event, 'device-b'));
});

function runtimeHarness(options = {}) {
  const stored = {}, attempts = [], metadata = [], lockState = { locked: false };
  const props = { getProperty: k => stored[k] || null, setProperty: (k, v) => { if (options.failReceiptSave && k.startsWith('stay_advance_push_receipt_v1_')) throw Error('property write failed'); stored[k] = v; },
    getProperties: () => ({ ...stored }), deleteProperty: k => { delete stored[k]; } };
  const devices = [{ subscriptionId: 'device-ok', fid: 'fid-a' }, { subscriptionId: 'device-retry', fid: 'fid-b' }];
  const bookingRows = [['Created', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Owner', 'Phone', '', '', '', '', 'Booking Type', 'StayID'],
    ['', 'Luna', 'Pug', '2026-10-29', '2026-10-29', 'Owner', '123', '', '', '', '', 'Confirmed Boarding', '11111111-1111-4111-8111-111111111111']];
  const sheet = { getDataRange: () => ({ getValues: () => bookingRows }), getParent: () => ({ getSpreadsheetTimeZone: () => 'Australia/Sydney' }) };
  const runtime = makeContext({
    LockService: { getScriptLock: () => ({ tryLock: () => { if (lockState.locked) return false; lockState.locked = true; return true; }, releaseLock: () => { lockState.locked = false; } }) },
    PropertiesService: { getScriptProperties: () => props }, getTargetSheet_: () => sheet, readStayOperations_: () => [],
    makeGuestStayKey_: (d, s, e) => `${d.toLowerCase()}|${s}|${e}`, readActivePushSubscriptions_: () => devices, getPushSubscriptionsSheet_: () => ({}),
    sendFirebaseMessageToFid_: (record, notification) => { attempts.push({ id: record.subscriptionId, notification }); if (record.subscriptionId === 'device-retry' && attempts.filter(a => a.id === 'device-retry').length === 1) return { ok: false, error: 'temporary' }; return { ok: true, messageId: 'message' }; },
    updatePushDeliveryRecord_: (_sheet, record, success) => { metadata.push([record.subscriptionId, success, Object.keys(stored).filter(k => k.startsWith('stay_advance_push_receipt_v1_')).length]); },
    ScriptApp: { getProjectTriggers: () => [] }, getFirebaseMessagingConfig_: () => { if (options.noCredentials) throw Error('not configured'); return {}; }
  });
  return { runtime, stored, attempts, metadata, lockState, props };
}

test('partial failure retries only failed devices and next day delivers a separate one-day reminder', () => {
  const h = runtimeHarness();
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:00:00Z')).sent, 3); // 7am Sydney
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:08:00Z')).sent, 1);
  assert.deepEqual(h.attempts.map(a => a.id), ['device-ok', 'device-retry', 'device-ok', 'device-retry', 'device-retry']);
  assert.ok(h.attempts.every(a => a.notification.title.includes('Luna')));
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-27T20:00:00Z')).sent, 4);
  assert.ok(h.attempts.slice(5).every(a => a.notification.data.daysAhead === 1));
  assert.ok(h.metadata.every(m => m[2] > 0), 'receipt is persisted before push delivery metadata is updated');
});

test('lock contention skips execution and receipt-capacity exhaustion prevents sends', () => {
  const h = runtimeHarness(); h.lockState.locked = true;
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:00:00Z')).reason, 'locked');
  h.lockState.locked = false;
  for (let i = 0; i < 1500; i++) h.stored[`stay_advance_push_receipt_v1_${i}`] = JSON.stringify({ expiresOn: '2026-11-05' });
  const result = h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:00:00Z'));
  assert.equal(result.sent, 0);
  assert.equal(h.attempts.length, 0);
});

test('failed receipt persistence does not report successful delivery metadata', () => {
  const h = runtimeHarness({ failReceiptSave: true });
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:00:00Z')).sent, 0);
  assert.equal(h.metadata.filter(m => m[1] === true).length, 0);
  assert.equal(h.attempts.length, 0, 'storage must be reserved before any push is attempted');
});

test('ambiguous legacy operations cannot mark two same-name stays checked out', () => {
  const h = runtimeHarness();
  h.runtime.getTargetSheet_ = () => ({
    getDataRange: () => ({ getValues: () => [
      ['Created', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Owner', 'Phone', '', '', '', '', 'Booking Type'],
      ['', 'Luna', 'Pug', '2026-10-29', '2026-10-29', 'Owner A', '111', '', '', '', '', 'Confirmed Boarding'],
      ['', 'Luna', 'Pug', '2026-10-29', '2026-10-29', 'Owner B', '222', '', '', '', '', 'Confirmed Boarding']
    ] }), getParent: () => ({ getSpreadsheetTimeZone: () => 'Australia/Sydney' })
  });
  h.runtime.readStayOperations_ = () => [{ stayKey: 'luna|2026-10-29|2026-10-29', status: 'checked_out' }];
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:00:00Z')).planned, 0);
  assert.equal(h.attempts.length, 0);
});

test('status returns the stable readonly schema and validates credentials without OAuth', () => {
  const h = runtimeHarness({ noCredentials: true });
  const status = h.runtime.getStayAdvancePushStatus_();
  assert.deepEqual(JSON.parse(JSON.stringify(status)), { result: 'success', schemaVersion: 1, version: 1, timezone: 'Australia/Sydney', morningHour: 7, credentialsConfigured: false, checkerTriggerPresent: false, morningTriggerPresent: false, activeArrivalDevices: null, activeDepartureDevices: null });
});

test('editing a date replaces the old planned event while keeping a new two-day receipt distinct', () => {
  const h = runtimeHarness();
  h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:00:00Z'));
  const before = h.attempts.length;
  const rows = h.runtime.getTargetSheet_().getDataRange().getValues();
  rows[1][3] = rows[1][4] = '2026-10-30';
  h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-27T20:00:00Z'));
  const fresh = h.attempts.slice(before);
  assert.equal(fresh.length, 4);
  assert.ok(fresh.every(item => item.notification.data.stayDate === '2026-10-30' && item.notification.data.daysAhead === 2));
});

test('receipt survives delivery metadata failure and only expired receipts are pruned', () => {
  const h = runtimeHarness();
  h.stored.stay_advance_push_receipt_v1_old = JSON.stringify({ expiresOn: '2026-10-26', delivered: true });
  h.stored.stay_advance_push_receipt_v1_current = JSON.stringify({ expiresOn: '2026-11-01', delivered: true });
  h.runtime.updatePushDeliveryRecord_ = () => { throw Error('Synthetic metadata failure'); };
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:00:00Z')).sent, 3);
  assert.equal(h.stored.stay_advance_push_receipt_v1_old, undefined);
  assert.ok(h.stored.stay_advance_push_receipt_v1_current);
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:05:00Z')).sent, 1);
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:10:00Z')).sent, 0);
});

test('runtime suppresses checked-out and conflicted operations and retains only checked-in departures', () => {
  for (const op of [
    { status: 'checked_out', stayId: '11111111-1111-4111-8111-111111111111' },
    { status: 'checked_out', identityConflict: true, identityStayId: '11111111-1111-4111-8111-111111111111' }
  ]) {
    const h = runtimeHarness(); h.runtime.readStayOperations_ = () => [op];
    assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:00:00Z')).planned, 0);
    assert.equal(h.attempts.length, 0);
  }
  const h = runtimeHarness();
  h.runtime.readStayOperations_ = () => [{ status: 'checked_in', stayId: '11111111-1111-4111-8111-111111111111' }];
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:00:00Z')).planned, 1);
  assert.ok(h.attempts.every(item => item.notification.category === 'departures'));
});

test('network delivery holds a notification lease but leaves the shared booking mutation lock available', () => {
  const h = runtimeHarness();
  const originalSend = h.runtime.sendFirebaseMessageToFid_;
  h.runtime.sendFirebaseMessageToFid_ = (record, notification) => {
    const mutationLock = h.runtime.LockService.getScriptLock();
    assert.equal(mutationLock.tryLock(1000), true, 'a sitter can still save/check out during push network delivery');
    mutationLock.releaseLock();
    assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:00:00Z')).reason, 'leased');
    return originalSend(record, notification);
  };
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:00:00Z')).sent, 3);
  assert.equal(h.stored.stay_advance_push_lease_v1, undefined, 'normal completion releases the lease');
  h.stored.stay_advance_push_lease_v1 = JSON.stringify({ id: 'terminated-run', expiresAt: Date.now() - 1000 });
  assert.equal(h.runtime.sendStayAdvancePushNotifications_(new Date('2026-10-26T20:05:00Z')).sent, 1, 'expired lease recovers without resetting receipts');
});
