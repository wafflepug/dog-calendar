const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync('waffle-v11.0.js', 'utf8');
const cut = source.indexOf("document.addEventListener('click'");
const sandbox = {
  WAFFLE_PAGE: 'calendar',
  renderV10OperationsHome() {},
  applyGuestDirectoryResponse() {},
  v10EventRawDates(event) {
    const p = event.extendedProps || {};
    return { start: p.rawStartDate || event.start, end: p.rawEndDate || event.end };
  },
  getLocalTodayDateString: () => '2026-09-22',
  formatStayDateShort: value => value,
  escapeDashboardHtml: value => String(value),
  queryAppsScriptSWR: async () => ({}),
  sendCalls: 0,
  sendPayloadToAppsScript: async function (payload) { this.sendCalls += 1; return { record: payload }; },
  invalidateWaffleClientCaches: async () => {},
  showWaffleForegroundPush() {},
  globalCalendar: null
};
vm.runInNewContext(`${source.slice(0, cut)}
this.api = { key: v110MakeStayKey, eventKey: v110StayKeyForEvent, evidence: v110IndexCheckoutEvidence, guard: v110CheckoutGuard, checkedOut: v110IsCheckedOutEvent, apply: v110ApplyEffectiveCheckoutDates, index: v110IndexOperations, save: v110SaveOperationalStatus, captureCare: v110CollectCareCheckoutEvidence };`, sandbox);

function event(ownerName, phone, overrides = {}) {
  return {
    start: '2026-09-20',
    end: '2026-09-23',
    extendedProps: {
      dogName: 'Milo', ownerName, phone,
      rawStartDate: '2026-09-20', rawEndDate: '2026-09-22',
      bookingType: 'Confirmed Boarding', ...overrides
    }
  };
}

test('same-name/date bookings with different confirmed identities are a collision', () => {
  const first = event('Alex Smith', '0400 111 111');
  const second = event('Jordan Smith', '0400 222 222');
  sandbox.api.evidence([first, second], { replace: true });
  const key = sandbox.api.eventKey(first);
  assert.throws(() => sandbox.api.guard({ stayKey: key }), /Checkout is paused/);
  assert.equal(sandbox.api.checkedOut(first), false);
});

test('the shared write path rejects a collision before Apps Script is called', async () => {
  const first = event('Alex Smith', '0400 111 111');
  const second = event('Jordan Smith', '0400 222 222');
  sandbox.api.evidence([first, second], { replace: true });
  const before = sandbox.sendCalls;
  await assert.rejects(() => sandbox.api.save({ stayKey: sandbox.api.eventKey(first) }, 'checked_out'), /Checkout is paused/);
  assert.equal(sandbox.sendCalls, before);
});

test('exact source copies remain unambiguous and preserve Ralph legacy checkout', async () => {
  const first = event('Alex Smith', '0400 111 111');
  const copy = event('  alex   smith ', '0400 111 111');
  sandbox.api.evidence([first, copy], { replace: true });
  const key = sandbox.api.eventKey(first);
  assert.doesNotThrow(() => sandbox.api.guard({ stayKey: key }));
  sandbox.api.index([{ stayKey: key, status: 'checked_out', actualCheckoutDate: '2026-09-21' }]);
  sandbox.api.apply([first]);
  assert.equal(first.end, '2026-09-22');
  assert.equal(first.extendedProps.rawEndDate, '2026-09-22');
  await sandbox.api.save({ stayKey: key, dogName: 'Milo' }, 'checked_out');
});

test('missing identity is recorded as incomplete without freezing a unique historical stay', () => {
  const legacy = event('', '');
  sandbox.api.evidence([legacy], { replace: true });
  assert.doesNotThrow(() => sandbox.api.guard({ stayKey: sandbox.api.eventKey(legacy) }));
});

test('conflicting owner aliases are incomplete evidence, never a proven identity', () => {
  const conflicted = event('Alex Smith', '0400 111 111', { owner: 'Jordan Smith' });
  sandbox.api.evidence([conflicted], { replace: true });
  assert.doesNotThrow(() => sandbox.api.guard({ stayKey: sandbox.api.eventKey(conflicted) }));
});

test('a collision restores a previously truncated display end', () => {
  const first = event('Alex Smith', '0400 111 111');
  first.end = '2026-09-22';
  first.extendedProps.effectiveCheckoutDate = '2026-09-21';
  let endCalls = 0;
  let lastEnd = '';
  let propCalls = 0;
  first.end = new Date('2026-09-22T00:00:00');
  first.endStr = '2026-09-22';
  first.setEnd = value => { endCalls += 1; lastEnd = value; first.end = new Date(`${value}T00:00:00`); first.endStr = value; sandbox.api.apply([first]); };
  first.setExtendedProp = (key, value) => { propCalls += 1; first.extendedProps[key] = value; };
  const second = event('Jordan Smith', '0400 222 222');
  const key = sandbox.api.eventKey(first);
  sandbox.api.index([{ stayKey: key, status: 'checked_out', actualCheckoutDate: '2026-09-21' }]);
  sandbox.api.evidence([first, second], { replace: true });
  sandbox.api.apply([first]);
  sandbox.api.apply([first]);
  assert.equal(lastEnd, '2026-09-23');
  assert.equal(first.extendedProps.effectiveCheckoutDate, null);
  assert.equal(endCalls, 1);
  assert.equal(propCalls, 2);
});

test('Care cards provide collision evidence without a calendar instance', async () => {
  const card = (ownerName, phone) => ({
    dataset: { directoryStayKey: 'milo|2026-09-20|2026-09-22', directoryDogName: 'Milo', directoryStartDate: '2026-09-20', directoryEndDate: '2026-09-22', v1088OwnerName: ownerName, v1088Phone: phone },
    querySelector: () => null
  });
  sandbox.api.evidence([event('Only Owner', '0400 999 999')], { replace: true });
  sandbox.document = { querySelectorAll: () => [card('Alex Smith', '0400 111 111'), card('Jordan Smith', '0400 222 222')] };
  sandbox.api.captureCare();
  assert.throws(() => sandbox.api.guard({ stayKey: 'milo|2026-09-20|2026-09-22' }), /Checkout is paused/);
  const before = sandbox.sendCalls;
  await assert.rejects(sandbox.api.save({ stayKey: 'milo|2026-09-20|2026-09-22' }, 'checked_out'), /Checkout is paused/);
  assert.equal(sandbox.sendCalls, before);
  delete sandbox.document;
});

test('a later incomplete Care snapshot cannot erase a known collision', () => {
  const complete = event('Alex Smith', '0400 111 111');
  const other = event('Jordan Smith', '0400 222 222');
  sandbox.api.evidence([complete, other], { replace: true });
  sandbox.api.evidence([complete, event('', '')]);
  assert.throws(() => sandbox.api.guard({ stayKey: sandbox.api.eventKey(complete) }), /Checkout is paused/);
});
