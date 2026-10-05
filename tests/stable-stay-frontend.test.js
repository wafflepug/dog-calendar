const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const core = fs.readFileSync('waffle-v11.0.5-core.js', 'utf8');
const coreStart = core.indexOf('function v1105ConfirmedStayIdentity');
const coreEnd = core.indexOf('v1104LoadSharedPotentialStays =', coreStart);
const v1104 = fs.readFileSync('waffle-v11.0.4.js', 'utf8');
const keyStart = v1104.indexOf('function v1104PotentialKeyFromEvent(');
const keyEnd = v1104.indexOf('function v1104PotentialEventFromRecord(', keyStart);
const queue = fs.readFileSync('waffle-v10.8.js', 'utf8');
const queueStart = queue.indexOf('async function v108ProcessQueue()');
const queueEnd = queue.indexOf('/* ---------------- Calendar', queueStart);
assert(coreStart >= 0 && coreEnd > coreStart);
assert(keyStart >= 0 && keyEnd > keyStart);
assert(queueStart >= 0 && queueEnd > queueStart);

function createCalendarSandbox() {
  const sandbox = {
    v1104SharedPotentialLoaded: true,
    v1105IsPotentialStayTombstoned: () => false,
    v1104SharedPotentialEvents: [],
    getPendingPotentialRemovals: () => [],
    dailyCapacityCounts: {},
    addLocalEventCapacity: () => {},
    makePotentialKey: (name, start, end) => `${String(name).toLowerCase()}|${start}|${end}`,
    localStorage: { getItem: () => null, setItem: () => {} },
    v1104ComposeCalendarEvents: (sheet, meets, potentials, confirmed) => [...sheet, ...meets, ...potentials, ...confirmed]
  };
  vm.runInNewContext(`${v1104.slice(keyStart, keyEnd)}\n${core.slice(coreStart, coreEnd)}`, sandbox);
  return sandbox;
}

function event(overrides = {}) {
  return {
    title: 'Milo', start: '2026-10-15', end: '2026-10-18',
    extendedProps: {
      dogName: 'Milo', breed: 'Labrador', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      stayId: '11111111-1111-4111-8111-111111111111', ownerName: 'Alex Smith', phone: '0400 123 456',
      rawStartDate: '2026-10-15', rawEndDate: '2026-10-17', ...overrides
    }
  };
}

test('different stable IDs preserve same-name/date Potential bookings in actual calendar composition', () => {
  const sandbox = createCalendarSandbox();
  const first = event({ isPotential: true, stayId: '11111111-1111-4111-8111-111111111111' });
  const second = event({ isPotential: true, stayId: '22222222-2222-4222-8222-222222222222' });
  sandbox.v1104SharedPotentialEvents = [first, second];
  const result = sandbox.v1104ComposeCalendarEvents([], [], [], []);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(item => item.extendedProps.stayId).sort(), [first.extendedProps.stayId, second.extendedProps.stayId].sort());
});

test('same stable ID only dedupes when dates and identity agree; changed dates remain separate copies', () => {
  const sandbox = createCalendarSandbox();
  const source = event();
  const duplicate = event();
  const moved = event({ rawStartDate: '2026-10-20', rawEndDate: '2026-10-22', start: '2026-10-20', end: '2026-10-23' });
  assert.equal(sandbox.v1105DedupeConfirmedStays([source, duplicate]).length, 1);
  assert.equal(sandbox.v1105DedupeConfirmedStays([source, moved]).length, 2);
});

test('pending date edit suppresses only its compatible stale authoritative source row', () => {
  const sandbox = createCalendarSandbox();
  const stale = event();
  const edited = event({ rawStartDate: '2026-10-20', rawEndDate: '2026-10-22', start: '2026-10-20', end: '2026-10-23', dateUpdatePending: true });
  const result = sandbox.v1104ComposeCalendarEvents([stale], [], [], [edited]);
  assert.deepEqual(result, [edited]);
});

test('a corrupt shared ID with a conflicting dog identity never hides a booking', () => {
  const sandbox = createCalendarSandbox();
  const stale = event();
  const edited = event({ dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', rawStartDate: '2026-10-20', rawEndDate: '2026-10-22', start: '2026-10-20', end: '2026-10-23', dateUpdatePending: true });
  const result = sandbox.v1104ComposeCalendarEvents([stale], [], [], [edited]);
  assert.equal(result.length, 2);
  assert.ok(result.includes(stale));
  assert.ok(result.includes(edited));
});

test('raw offline replay preserves original mutation IDs and legacy creates become review conflicts', async () => {
  const entries = [
    { id: 'receipt-new', status: 'queued', payload: { action: 'create_boarding', stayId: event().extendedProps.stayId, clientMutationId: 'receipt-new', stayIdentityVersion: 1 }, transport: 'send' },
    { id: 'receipt-old', status: 'queued', payload: { action: 'create_potential', clientMutationId: 'receipt-old' }, transport: 'send' },
    { id: 'receipt-conflict', status: 'conflict', payload: { action: 'create_boarding', stayId: event().extendedProps.stayId, clientMutationId: 'receipt-conflict' }, transport: 'send' }
  ];
  const sent = [];
  const sandbox = {
    v108QueueSyncing: false, navigator: { onLine: true },
    V108_STABLE_STAY_ACTIONS: new Set(['create_boarding','create_potential','update_potential','confirm_potential','delete_potential','delete_confirmed_stay','update_boarding_dates']),
    v108QueueAll: async () => [...entries],
    v108QueuePut: async next => { const i = entries.findIndex(item => item.id === next.id); if (i >= 0) entries[i] = next; },
    v108QueueDelete: async id => { const i = entries.findIndex(item => item.id === id); if (i >= 0) entries.splice(i, 1); },
    v108RequireStableStayBackend: async () => true,
    v108RawSendPayloadToAppsScript: async payload => { sent.push(payload); return { result: 'success' }; },
    v108RawQueryAppsScript: async payload => { sent.push(payload); return { result: 'success' }; },
    v108NetworkError: () => false,
    v108RefreshQueueBadge: async () => {}
  };
  vm.runInNewContext(queue.slice(queueStart, queueEnd), sandbox);
  await sandbox.v108ProcessQueue();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].clientMutationId, 'receipt-new');
  assert.equal(sent[0].stayId, event().extendedProps.stayId);
  assert.equal(entries.find(item => item.id === 'receipt-old').status, 'conflict');
  assert.equal(entries.find(item => item.id === 'receipt-conflict').status, 'conflict');
  assert.match(entries.find(item => item.id === 'receipt-old').lastError, /needs review/i);
  assert.equal(entries.find(item => item.id === 'receipt-old').attempts || 0, 0);
});
const prepareStart = queue.indexOf('function v108MutationId()');
const prepareEnd = queue.indexOf('async function v108QueuePut(', prepareStart);
const callStart = queue.indexOf('async function v108MutationCall(', prepareEnd);
const callEnd = queue.indexOf('queryAppsScript = function', callStart);
assert(prepareStart >= 0 && prepareEnd > prepareStart && callStart >= 0 && callEnd > callStart);

test('online create prepares stable UUID and receipt before raw send; existing target never gets invented ID', async () => {
  const sent = [];
  let capabilityChecks = 0;
  const sandbox = {
    window: { crypto: { randomUUID: () => '33333333-3333-4333-8333-333333333333' } },
    navigator: { onLine: true },
    V108_QUEUE_ACTIONS: new Set(['create_boarding','confirm_potential']),
    V108_STABLE_STAY_ACTIONS: new Set(['create_boarding','confirm_potential']),
    v108RawQueryAppsScript: async payload => { if (payload.action === 'get_data_versions') capabilityChecks++; return { result: 'success', versions: { stableStayIdentityVersion: 1 } }; },
    v108NetworkError: () => false,
    v108QueueMutation: async payload => ({ result: 'success', queued: true, payload }),
    v108ShowMutationFollowUp: () => {}
  };
  vm.runInNewContext(`let v108StableStayCapabilityPromise = null;\n${queue.slice(prepareStart, prepareEnd)}\n${queue.slice(callStart, callEnd)}`, sandbox);
  await sandbox.v108MutationCall(async payload => { sent.push(payload); return { result: 'success' }; }, { action: 'create_boarding', dogName: 'Milo' }, undefined, 'send');
  await sandbox.v108MutationCall(async payload => { sent.push(payload); return { result: 'success' }; }, { action: 'confirm_potential', dogName: 'Milo' }, undefined, 'send');
  assert.equal(capabilityChecks, 1);
  assert.match(sent[0].stayId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(sent[0].clientMutationId.length > 0, true);
  assert.equal(sent[0].stayIdentityVersion, 1);
  assert.equal(Object.hasOwn(sent[1], 'stayId'), false);
  assert.equal(sent[1].clientMutationId.length > 0, true);
});

test('stable potential edits remain visible against stale reads and retire only after authoritative fields match', async () => {
  const reconcileStart = v1104.indexOf('async function v1104ReconcileLocalPotentialCache()');
  const reconcileEnd = v1104.indexOf('/*', reconcileStart);
  assert(reconcileStart >= 0 && reconcileEnd > reconcileStart);
  const local = event({ isPotential: true, rawStartDate: '2026-10-20', rawEndDate: '2026-10-22', notes: 'new note' });
  const stale = event({ isPotential: true, notes: 'old note' });
  const keyFor = eventValue => {
    const props = eventValue.extendedProps || {};
    return `stay:${String(props.stayId || '').toLowerCase()}|${String(props.dogName || eventValue.title).toLowerCase()}|${String(props.dogId || '').toLowerCase()}|${String(props.breed || '').toLowerCase()}|${String(props.ownerName || props.owner || '').toLowerCase()}|${String(props.phone || '').replace(/\D/g, '')}`;
  };
  let saved = [local];
  const sandbox = {
    v1104SharedPotentialEvents: [stale],
    v1104PotentialKeyFromEvent: keyFor,
    async v1104ServerPotentialKeys() { return new Set([keyFor(stale)]); },
    async v1104QueuedPotentialSaveKeys() { return new Set(); },
    getLocalArray: () => saved, setLocalArray(_key, value) { saved = value; }
  };
  vm.runInNewContext(v1104.slice(reconcileStart, reconcileEnd), sandbox);
  await sandbox.v1104ReconcileLocalPotentialCache();
  assert.equal(saved.length, 1);
  sandbox.v1104SharedPotentialEvents = [{ ...local, extendedProps: { ...local.extendedProps } }];
  await sandbox.v1104ReconcileLocalPotentialCache();
  assert.equal(saved.length, 0);
});

test('conflicting records sharing a stable ID remain separate potential candidates', () => {
  const sandbox = createCalendarSandbox();
  const first = event({ isPotential: true, ownerName: 'Alex Smith', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  const conflict = event({ isPotential: true, ownerName: 'Jordan Smith', dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
  sandbox.v1104SharedPotentialEvents = [first, conflict];
  const result = sandbox.v1104ComposeCalendarEvents([], [], [], []);
  assert.equal(result.length, 2);
  assert.ok(result.includes(first));
  assert.ok(result.includes(conflict));
});

test('stable deletion tombstones survive an absent CSV snapshot and a later stale row', () => {
  const helperStart = core.indexOf('function v1105PendingStableStayRemovals');
  const stableCheckStart = core.indexOf('function v1105IsStableStayTombstoned', helperStart);
  const helperEnd = core.indexOf('\n}', stableCheckStart) + 2;
  const clearStart = core.indexOf('function v1105ClearServerConfirmedTombstones(');
  const clearReturn = core.indexOf('return serverKeys;', clearStart);
  const clearEnd = core.indexOf('}', clearReturn) + 1;
  assert(helperStart >= 0 && helperEnd > helperStart && clearStart >= 0 && clearEnd > clearStart);
  const values = new Map();
  const sandbox = {
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
    getPendingPotentialRemovals: () => [], setLocalArray() {},
    makePotentialKey: () => 'legacy',
    v1105PotentialKeyFromRecord: () => 'legacy'
  };
  vm.runInNewContext(`${core.slice(helperStart, helperEnd)}\n${core.slice(clearStart, clearEnd)}`, sandbox);
  const id = '44444444-4444-4444-8444-444444444444';
  const removalIdentity = { dogName: 'Milo', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ownerName: 'Alex', phone: '0400 123 456' };
  assert.equal(sandbox.v1105AddStableStayRemoval(id, removalIdentity), true);
  sandbox.v1105ClearServerConfirmedTombstones([]);
  assert.equal(sandbox.v1105IsStableStayTombstoned(id, removalIdentity), true);
  sandbox.v1105ClearServerConfirmedTombstones([{ stayId: id, dogName: 'Milo', startDate: '2026-10-15', endDate: '2026-10-17' }]);
  assert.equal(sandbox.v1105IsStableStayTombstoned(id, removalIdentity), true);
  assert.equal(sandbox.v1105IsStableStayTombstoned(id, { dogName: 'Milo', dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }), false);
});

test('actual calendar move stores the returned stable ID and pending date overlay', async () => {
  const moveStart = queue.indexOf('async function v108SaveCalendarMove(');
  const moveEnd = queue.indexOf('function v108EnsureCalendarTools(', moveStart);
  assert(moveStart >= 0 && moveEnd > moveStart);
  const id = '55555555-5555-4555-8555-555555555555';
  const values = new Map([['temporaryConfirmedStays', JSON.stringify([{ id: 'old', extendedProps: { stayId: id } }])]]);
  let sentPayload = null;
  const event = {
    id: 'calendar-event', title: 'Milo', startStr: '2026-10-20', endStr: '2026-10-23', allDay: true,
    extendedProps: { stayId: id, dogName: 'Milo', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', breed: 'Labrador', ownerName: 'Alex', phone: '0400 123 456', rawStartDate: '2026-10-15', rawEndDate: '2026-10-17' },
    setExtendedProp(key, value) { this.extendedProps[key] = value; }
  };
  const oldEvent = { ...event, extendedProps: { ...event.extendedProps } };
  const sandbox = {
    window: { confirm: () => true },
    v10EventRawDates: target => ({ start: target.extendedProps.rawStartDate, end: target.extendedProps.rawEndDate }),
    v108EventDates: () => ({ start: '2026-10-20', end: '2026-10-22' }),
    async sendPayloadToAppsScript(payload) { sentPayload = payload; return { result: 'success', stayId: id }; },
    getLocalArray: key => JSON.parse(values.get(key) || '[]'),
    setLocalArray: (key, value) => values.set(key, JSON.stringify(value)),
    showWaffleForegroundPush() {}
  };
  vm.runInNewContext(queue.slice(moveStart, moveEnd), sandbox);
  await sandbox.v108SaveCalendarMove({ event, oldEvent });
  assert.equal(sentPayload.stayId, id);
  const stored = JSON.parse(values.get('temporaryConfirmedStays'));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].extendedProps.rawStartDate, '2026-10-20');
  assert.equal(stored[0].extendedProps.rawEndDate, '2026-10-22');
  assert.equal(stored[0].extendedProps.dateUpdatePending, true);
});

test('actual directory date save persists a stable-ID overlay before navigating back to the stay', async () => {
  const profileSource = fs.readFileSync('waffle-v11.1.13.js', 'utf8');
  const saveStart = profileSource.indexOf('async function saveStayDates()');
  const saveEnd = profileSource.indexOf('function movePriorityIntoNotifications()', saveStart);
  assert(saveStart >= 0 && saveEnd > saveStart);
  const id = '66666666-6666-4666-8666-666666666666';
  const values = new Map([['temporaryConfirmedStays', '[]']]);
  const inputs = {
    '[data-v11113-start-date]': { value: '2026-10-20' },
    '[data-v11113-end-date]': { value: '2026-10-22' },
    '[data-v11113-stay-dates-status]': { textContent: '', className: '' },
    '[data-v11113-stay-dates-save]': { disabled: false, textContent: '' }
  };
  const modal = { querySelector: selector => inputs[selector] };
  const card = { dataset: {
    directoryStayId: id, directoryDogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', directoryDogName: 'Milo',
    directoryStartDate: '2026-10-15', directoryEndDate: '2026-10-17', directorySourceRow: '4',
    v1088Breed: 'Labrador', v1088OwnerName: 'Alex Smith', v1088Phone: '0400 123 456', directoryStayKey: 'milo|old-dates'
  }, querySelector: () => null };
  let payload = null;
  const browserWindow = {
    sendPayloadToAppsScript: async value => { payload = value; return { result: 'success', stayId: id }; },
    invalidateWaffleClientCaches: async () => {}, v110MakeStayKey: () => 'milo|new-dates',
    location: { href: '' }, setTimeout: callback => callback()
  };
  const sandbox = {
    window: browserWindow, card, modal, pendingStayDateCard: card,
    ensureStayDatesModal: () => modal, showFeedback() {},
    setTimeout: callback => callback(),
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) }
  };
  vm.runInNewContext(`${profileSource.slice(saveStart, saveEnd)}\nthis.saveStayDates=saveStayDates;`, sandbox);
  await sandbox.saveStayDates();
  assert.equal(payload.stayId, id);
  assert.equal(payload.dogId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  const overlay = JSON.parse(values.get('temporaryConfirmedStays'))[0];
  assert.equal(overlay.extendedProps.rawStartDate, '2026-10-20');
  assert.equal(overlay.extendedProps.rawEndDate, '2026-10-22');
  assert.equal(overlay.extendedProps.dateUpdatePending, true);
  assert.match(browserWindow.location.href, /stayId=66666666-6666-4666-8666-666666666666/);
});

test('first edit from a header without Stay ID hides only the unique exact old row with matching proof', () => {
  const sandbox = createCalendarSandbox();
  const legacy = event({ stayId: '', rawStartDate: '2026-10-15', rawEndDate: '2026-10-17', start: '2026-10-15', end: '2026-10-18' });
  const overlay = event({ rawStartDate: '2026-10-20', rawEndDate: '2026-10-22', start: '2026-10-20', end: '2026-10-23', dateUpdatePending: true, pendingOriginalStartDate: '2026-10-15', pendingOriginalEndDate: '2026-10-17' });
  const exact = sandbox.v1104ComposeCalendarEvents([legacy], [], [], [overlay]);
  assert.deepEqual(exact, [overlay]);
  const wrongDog = { ...legacy, extendedProps: { ...legacy.extendedProps, dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } };
  const ambiguous = sandbox.v1104ComposeCalendarEvents([legacy, { ...legacy }], [], [], [overlay]);
  // Existing exact-copy dedupe may collapse the two legacy source copies,
  // but the ambiguous source must remain alongside the optimistic edit.
  assert.equal(ambiguous.length, 2);
  assert.ok(ambiguous.includes(legacy));
  assert.ok(ambiguous.includes(overlay));
  const homonym = sandbox.v1104ComposeCalendarEvents([wrongDog], [], [], [overlay]);
  assert.equal(homonym.length, 2);
});

test('custom calendar event key and deep-link parser carry stable stay ID', () => {
  const calendarSource = fs.readFileSync('calendar.js', 'utf8');
  const keyStart = calendarSource.indexOf('function eventKey(event)');
  const keyEnd = calendarSource.indexOf('function intersects(', keyStart);
  const profileSource = fs.readFileSync('waffle-v11.1.98.js', 'utf8');
  const parseStart = profileSource.indexOf('function parseCalendarEventKey(');
  const parseEnd = profileSource.indexOf('function stayViewFor(', parseStart);
  assert(keyStart >= 0 && keyEnd > keyStart && parseStart >= 0 && parseEnd > parseStart);
  const id = '77777777-7777-4777-8777-777777777777';
  const keySandbox = { eventType: () => 'confirmed', eventDates: () => ({ start: '2026-10-20', end: '2026-10-22' }), dogName: () => 'Milo', eventTime: () => 'TBC' };
  vm.runInNewContext(`${calendarSource.slice(keyStart, keyEnd)}\nthis.makeKey=eventKey;`, keySandbox);
  const key = keySandbox.makeKey({ id: 'same', title: 'Milo', extendedProps: { stayId: id } });
  const parseSandbox = {};
  vm.runInNewContext(`${profileSource.slice(parseStart, parseEnd)}\nthis.parse=parseCalendarEventKey;`, parseSandbox);
  assert.equal(parseSandbox.parse(key).stayId, id);
  assert.equal(parseSandbox.parse('confirmed|legacy|Milo|2026-10-20|2026-10-22|TBC').stayId, '');
});

test('confirmed deletion receives a retry receipt online and cannot claim offline success', async () => {
  const start = queue.indexOf('async function v108MutationCall(');
  const end = queue.indexOf('queryAppsScript = function', start);
  let queued = false;
  let checked = false;
  const sandbox = {
    V108_QUEUE_ACTIONS: new Set(), V108_STABLE_STAY_ACTIONS: new Set(['delete_confirmed_stay']),
    navigator: { onLine: false },
    v108PrepareMutation: payload => ({ ...payload, clientMutationId: 'delete-retry' }),
    v108QueueMutation: () => { queued = true; },
    v108RequireStableStayBackend: async () => { checked = true; },
    v108NetworkError: () => true, v108ShowMutationFollowUp() {}
  };
  vm.runInNewContext(queue.slice(start, end), sandbox);
  const payload = { action: 'delete_confirmed_stay', stayId: '11111111-1111-4111-8111-111111111111' };
  await assert.rejects(sandbox.v108MutationCall(async () => ({ result: 'success' }), payload), /Connect to the internet/);
  assert.equal(queued, false);
  sandbox.navigator.onLine = true;
  const response = await sandbox.v108MutationCall(async prepared => ({ result: 'success', clientMutationId: prepared.clientMutationId }), payload);
  assert.equal(checked, true);
  assert.equal(response.clientMutationId, 'delete-retry');
  await assert.rejects(sandbox.v108MutationCall(async () => { throw new Error('Network interrupted'); }, payload), /Network interrupted/);
  assert.equal(queued, false);
});

test('deleted stay removes only its stable-ID calendar and temporary copies', () => {
  const source = fs.readFileSync('waffle-v11.1.98.js', 'utf8');
  const start = source.indexOf('function removeMatchingAdapterEvents(');
  const end = source.indexOf('async function refreshAfterDelete(', start);
  assert(start >= 0 && end > start);
  const removed = [];
  const first = event();
  const peer = event({ stayId: '22222222-2222-4222-8222-222222222222' });
  const adapter = [first, peer].map((item, index) => ({ ...item, remove: () => removed.push(index) }));
  let stored = JSON.stringify([first, peer]);
  const sandbox = {
    adapterEvents: () => adapter, normalizeIdentity: value => String(value).toLowerCase(),
    localStorage: { getItem: () => stored, setItem: (_key, value) => { stored = value; } }
  };
  vm.runInNewContext(`${source.slice(start, end)}\nthis.removeTemporaryConfirmed=removeTemporaryConfirmed;`, sandbox);
  const identity = { stayId: first.extendedProps.stayId, dogName: 'Milo', startDate: '2026-10-15', endDate: '2026-10-17' };
  sandbox.removeMatchingAdapterEvents(identity);
  sandbox.removeTemporaryConfirmed(identity);
  assert.deepEqual(removed, [0]);
  assert.equal(JSON.parse(stored)[0].extendedProps.stayId, peer.extendedProps.stayId);
});
