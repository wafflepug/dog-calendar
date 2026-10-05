const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'waffle-v11.0.js'), 'utf8');
const pastSource = fs.readFileSync(path.join(root, 'waffle-v10.8.6.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const requestKeyStart = appSource.indexOf('function waffleReadRequestKey(payload)');
const requestKeyEnd = appSource.indexOf('async function queryAppsScriptSWR(', requestKeyStart);
assert.ok(requestKeyStart >= 0 && requestKeyEnd > requestKeyStart);
const cut = source.indexOf("document.addEventListener('click'");
assert.ok(cut > 0);
const idA = '00000000-0000-4000-8000-000000000001';
const idB = '00000000-0000-4000-8000-000000000002';
const idC = '00000000-0000-4000-8000-000000000003';
const key = 'milo|2026-10-01|2026-10-10';
const savedAt = '2026-10-06T09:00:00Z';
function payload(stayId = idA) {
  return { stayId, stayKey: key, dogName: 'Milo', startDate: '2026-10-01', endDate: '2026-10-10' };
}
function event(stayId = idA) {
  return { title: 'Milo', start: '2026-10-01', end: '2026-10-11', extendedProps: {
    stayId, dogName: 'Milo', rawStartDate: '2026-10-01', rawEndDate: '2026-10-10', bookingType: 'Confirmed Boarding'
  } };
}
function harness() {
  const h = {
    WAFFLE_PAGE: 'calendar', renderV10OperationsHome() {}, applyGuestDirectoryResponse() {},
    v10EventRawDates(e) { const p = e.extendedProps || {}; return { start: p.rawStartDate || e.start, end: p.rawEndDate || e.end }; },
    getLocalTodayDateString: () => '2026-10-06', formatStayDateShort: v => v,
    escapeDashboardHtml: v => String(v), navigator: { onLine: true },
    queryAppsScript: async () => ({ result: 'success', versions: { stayOperationIdentityVersion: 1 } }),
    sendCalls: [], invalidateWaffleClientCaches: async () => {}, showWaffleForegroundPush() {}, globalCalendar: null
  };
  h.sendPayloadToAppsScript = async p => {
    h.sendCalls.push(p);
    return { result: 'success', record: { ...p, stayId: p.stayId || idA, updatedAt: savedAt,
      status: p.action === 'checkin_stay' ? 'checked_in' : 'checked_out', actualCheckoutDate: '2026-10-06' } };
  };
  vm.createContext(h);
  vm.runInContext(appSource.slice(requestKeyStart, requestKeyEnd), h);
  vm.runInContext(`${source.slice(0, cut)}\n${pastSource.slice(0, pastSource.indexOf('function v1086IsoDate('))}
    this.api={resolve:v110OperationForStay,index:v110IndexOperations,merge:v110MergeOperationRead,
      evidence:v110IndexCheckoutEvidence,apply:v110ApplyEffectiveCheckoutDates,save:v110SaveOperationalStatus,
      guard:v110CheckoutGuard,payload:v110OperationalPayloadFromCard,checked:v110IsCheckedOutEvent,
      load:v110LoadOperations,unique:v110EventUniqueKey,past:v1086IsCheckedOutBooking,current:v1086ExcludeCheckedOutCurrent,
      reviewEvidence:v110ReviewEvidenceForStay};`, h);
  return h;
}
test('homonymous stays keep separate status and effective Calendar end dates', async () => {
  const h = harness(), a = event(idA), b = event(idB);
  h.api.index([{ stayId: idA, stayKey: key, status: 'checked_out', actualCheckoutDate: '2026-10-06' },
    { stayId: idB, stayKey: key, status: 'checked_in' }]);
  assert.equal(h.api.checked(a), true); assert.equal(h.api.checked(b), false);
  h.api.apply([a, b]);
  assert.equal(a.end, '2026-10-07'); assert.equal(a.extendedProps.bookedEndDate, '2026-10-10');
  assert.equal(b.end, '2026-10-11');
  await h.api.save(payload(idB), 'checked_out', b);
  assert.equal(h.sendCalls.at(-1).stayId, idB);
  assert.equal(h.api.resolve(a).status, 'checked_out');
});
test('duplicate, malformed and quarantined UUIDs fail closed without a key fallback', () => {
  const h = harness();
  h.api.index([{ stayId: idA, stayKey: key, status: 'checked_in' }, { stayId: idA.toUpperCase(), stayKey: key, status: 'checked_out' }]);
  assert.equal(h.api.resolve(event()), null); assert.throws(() => h.api.guard(payload()), /conflicting/);
  h.api.index([{ stayId: 'malformed', stayKey: key, status: 'checked_out' }, { stayKey: key, status: 'checked_in' }]);
  assert.equal(h.api.resolve(event('malformed')), null); assert.equal(h.api.resolve(event(idC)), null);
  h.api.index([{ identityStayId: idA, stayKey: key, identityConflict: true, identityConflictReason: 'duplicate_stay_id' }]);
  assert.equal(h.api.resolve(event()), null);
  h.api.index([{ ...payload(), dogName: 'Another dog', status: 'checked_in' }]);
  assert.equal(h.api.resolve(event()), null, 'a corrupt cached ID cannot apply another dog\'s status');
});
test('selected-stay review evidence keeps identity scoped and does not expose healthy stays', () => {
  const h = harness();
  const reviewCard = stayId => ({ dataset: { directoryStayId: stayId, directoryStayKey: key, directoryDogName: 'Milo', directoryStartDate: '2026-10-01', directoryEndDate: '2026-10-10' }, querySelector: () => null });
  h.api.index([{ identityStayId: idA, stayKey: key, identityConflict: true, identityConflictReason: 'duplicate_stay_id' }]);
  assert.equal(JSON.stringify(h.api.reviewEvidence(reviewCard(idA))), JSON.stringify({ stayId: idA, stayKey: key, reasonCode: 'duplicate_stay_id' }));
  assert.equal(h.api.reviewEvidence(reviewCard(idB)), null, 'same legacy key does not make another valid Stay ID conflicted');
  h.api.index([{ stayId: 'malformed', stayKey: key, identityConflict: true, identityConflictReason: 'invalid_stay_id' }]);
  assert.equal(JSON.stringify(h.api.reviewEvidence(reviewCard('malformed'))), JSON.stringify({ stayId: 'malformed', stayKey: key, reasonCode: 'invalid_stay_id' }));
  h.api.index([{ stayId: idA, stayKey: key, status: 'checked_in' }]);
  assert.equal(h.api.reviewEvidence(reviewCard(idA)), null);
});
test('a first legacy write propagates the proven returned ID to the selected Care card', async () => {
  const h = harness();
  h.api.index([{ stayId: idA, stayKey: key, status: 'checked_in' }]);
  const card = { dataset: { directoryStayKey: key, directoryDogName: 'Milo', directoryStartDate: '2026-10-01', directoryEndDate: '2026-10-10' }, querySelector: () => null };
  const selected = h.api.payload(card);
  await h.api.save(selected, 'checked_out', card);
  assert.equal(selected.stayId, idA); assert.equal(card.dataset.directoryStayId, idA);
  assert.equal(h.api.resolve(card).status, 'checked_out'); assert.equal(h.api.past(selected), true);
});
test('cached directory and Calendar reads cannot undo a confirmed actual checkout', async () => {
  const h = harness(), a = event();
  await h.api.save(payload(), 'checked_out', a);
  const stale = { ...payload(), status: 'checked_in', updatedAt: '2026-10-06T08:00:00Z' };
  h.api.index([stale]); h.api.apply([a]); assert.equal(a.end, '2026-10-07');
  h.api.merge([stale]);
  assert.equal(h.api.current({ bookings: [payload()], operations: [stale] }).bookings.length, 0);
  h.api.index([stale], { authoritative: true });
  assert.equal(h.api.resolve(a).status, 'checked_out', 'an older in-flight network read cannot override a later write');
});
test('a later verified check-in clears the checkout overlay and restores booked Calendar dates', async () => {
  const h = harness(), a = event(); h.globalCalendar = { getEvents: () => [a] };
  await h.api.save(payload(), 'checked_out', a); assert.equal(a.end, '2026-10-07');
  await h.api.save(payload(), 'checked_in', a);
  assert.equal(h.api.resolve(a).status, 'checked_in'); assert.equal(a.end, '2026-10-11');
  assert.equal(a.extendedProps.effectiveCheckoutDate, undefined);
  await h.api.save(payload(), 'checked_out', a);
  h.api.index([{ ...payload(), status: 'checked_in', updatedAt: '2026-10-06T10:00:00Z' }], { authoritative: true });
  assert.equal(h.api.resolve(a).status, 'checked_in'); assert.equal(a.end, '2026-10-11');
});
test('cached checkout evidence survives another cached directory snapshot until a verified newer status arrives', () => {
  const h = harness();
  h.api.index([{ ...payload(), status: 'checked_out', actualCheckoutDate: '2026-10-06', updatedAt: savedAt }]);
  h.api.merge([{ ...payload(), status: 'expected', updatedAt: '2026-10-05T09:00:00Z' }]);
  assert.equal(h.api.resolve(event()).status, 'checked_out');
  assert.equal(h.api.past(payload(), { operations: [{ ...payload(), status: 'expected' }] }), true);
  h.api.index([{ ...payload(), status: 'checked_in', updatedAt: '2026-10-06T10:00:00Z' }], { authoritative: true });
  assert.equal(h.api.resolve(event()).status, 'checked_in');
});
test('scoped reads preserve other UUID-owned homonyms and quarantine evidence without duplicating records', async () => {
  const h = harness(), a = { ...payload(), status: 'checked_in' }, b = { ...payload(idB), status: 'checked_in' };
  h.api.index([a, b, { ...payload(idC), identityConflict: true, identityConflictReason: 'duplicate_stay_id' }]);
  h.api.merge([{ ...a, status: 'checked_out' }]);
  assert.equal(h.api.resolve(event(idB)).status, 'checked_in'); assert.equal(h.api.resolve(event(idC)), null);
  await h.api.save(payload(), 'checked_out'); await h.api.save(payload(), 'checked_out');
  assert.equal(h.api.resolve(event(idB)).status, 'checked_in');
  assert.throws(() => h.api.guard(payload(idC)), /conflicting/);
});
test('distinct UUIDs count as a legacy collision even when the same dog and owner match', () => {
  const h = harness(), a = event(idA), b = event(idB);
  for (const e of [a, b]) Object.assign(e.extendedProps, { dogId: '#00001', ownerName: 'Ada', phone: '0400000000' });
  h.api.evidence([a, b], { replace: true }); h.api.guard(payload());
  assert.throws(() => h.api.guard(payload('')), /Review duplicate bookings/);
  const corrupt = event(idA); corrupt.extendedProps.ownerName = 'Lee'; corrupt.extendedProps.phone = '0411111111';
  h.api.evidence([a, corrupt]); assert.throws(() => h.api.guard(payload()), /conflicting/);
  assert.notEqual(h.api.unique(a, key), h.api.unique(corrupt, key));
});
test('offline, unsupported capability, queued or incomplete responses never report a saved operation', async () => {
  const h = harness(); h.navigator.onLine = false;
  await assert.rejects(() => h.api.save(payload(), 'checked_in'), /live connection/); assert.equal(h.sendCalls.length, 0);
  h.navigator.onLine = true; h.queryAppsScript = async () => ({ result: 'success', versions: {} });
  await assert.rejects(() => h.api.save(payload(), 'checked_in'), /does not support/); assert.equal(h.sendCalls.length, 0);
  h.queryAppsScript = async () => ({ result: 'success', versions: { stayOperationIdentityVersion: 1 } });
  for (const response of [{ queued: true }, { result: 'success' }, { result: 'error', record: { ...payload(), status: 'checked_in' } },
    { result: 'success', record: { ...payload(idB), status: 'checked_in' } },
    { result: 'success', record: { ...payload(), dogName: 'Other Dog', status: 'checked_in' } }]) {
    h.sendPayloadToAppsScript = async () => response;
    await assert.rejects(() => h.api.save(payload(), 'checked_in')); assert.equal(h.api.resolve(event()), null);
  }
});
test('refresh only trusts successful network data and keeps offline fallbacks separate', async () => {
  const h = harness(); await h.api.save(payload(), 'checked_out');
  const current = { ...payload(), status: 'checked_in', updatedAt: '2026-10-06T10:00:00Z' };
  h.queryAppsScriptSWR = async () => ({ data: { result: 'success', records: [current] }, offlineFallback: true });
  await h.api.load({ noRender: true }); assert.equal(h.api.resolve(event()).status, 'checked_out');
  h.queryAppsScriptSWR = async () => ({ data: { result: 'error', records: [] }, offlineFallback: false });
  await h.api.load({ noRender: true }); assert.equal(h.api.resolve(event()).status, 'checked_out');
  h.queryAppsScriptSWR = async () => ({ data: { result: 'success', records: [current] }, offlineFallback: false });
  await h.api.load({ noRender: true }); assert.equal(h.api.resolve(event()).status, 'checked_in');
});
test('early checkout uses its dedicated action and selected booking ID', async () => {
  const h = harness();
  await h.api.save({ ...payload(), action: 'early_checkout_stay', checkoutType: 'early', actualCheckoutDate: '2026-10-06' }, 'checked_out');
  assert.equal(h.sendCalls[0].action, 'early_checkout_stay'); assert.equal(h.sendCalls[0].stayId, idA);
});
test('actual client read keys separate UUID-scoped operation requests', () => {
  const h = harness();
  assert.notEqual(h.waffleReadRequestKey({ action: 'get_stay_operations', stayIds: [idA] }), h.waffleReadRequestKey({ action: 'get_stay_operations', stayIds: [idB] }));
  assert.equal(h.waffleReadRequestKey({ action: 'get_stay_operations', stayIds: [idA, idB] }), h.waffleReadRequestKey({ action: 'get_stay_operations', stayIds: [idB, idA] }));
});
