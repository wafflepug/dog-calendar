const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const signatureStart = source.indexOf('    function getDirectoryBookingSignature(');
const signatureEnd = source.indexOf('    function findDirectoryCardByStayKey', signatureStart);
const csvStart = source.indexOf('    function guestDirectoryBookingsToCsv(');
const reuseStart = source.indexOf('    function directoryCardReuseKey(');
const reconcileStart = source.indexOf('    function reconcileDirectoryGridCards(', reuseStart);
const applyStart = source.indexOf('    function applyGuestDirectoryResponse(');
const applyEnd = source.indexOf('    async function loadGuestDirectoryConsolidated(', applyStart);
assert.ok(signatureStart >= 0 && signatureEnd > signatureStart && applyStart > 0 && applyEnd > applyStart);
assert.ok(reuseStart > 0 && reconcileStart > reuseStart);

function harness(existingCard, signature = 'already-rendered', DateConstructor = Date) {
    const effects = { parsed: [], summaries: [], flags: [], intake: [], legacy: [], restored: 0 };
    const sandbox = {
        directoryBookingStateSignature: signature,
        directorySummaryRecordsCache: {}, directoryPhotoRecordsCache: {}, careRiskRecordsCache: {},
        directoryIntakeStatusCache: {}, directoryLegacyIntakeCache: {},
        directoryProfileDetailCache: {}, directoryBelongingsDetailCache: {}, belongingsRecordsCache: {},
        document: {
            querySelector: () => existingCard,
            querySelectorAll: () => existingCard ? [existingCard] : []
        },
        captureDirectoryProfileUiState: () => ({ stayKey: 'target-stay', mainTab: 'belongings' }),
        parseCSVToEvents: csv => effects.parsed.push(csv),
        guestDirectoryBookingsToCsv: bookings => JSON.stringify(bookings),
        setDirectoryDogPhoto() {}, setDirectoryCareFlags: (key, record) => effects.flags.push([key, record]),
        renderDirectoryLazySummary: (key, record) => effects.summaries.push([key, record]),
        reconcileDirectoryDigitalIntakeFromProfile() {},
        setDirectoryIntakeStatus: (key, record) => effects.intake.push([key, record]),
        setDirectoryLegacyIntakeStatus: (key, record) => effects.legacy.push([key, record]),
        refreshDirectoryCareSummary() {}, filterGuestDirectoryCards() {},
        restoreSelectedDirectoryProfile: ({ state }) => { assert.equal(state.stayKey, 'target-stay'); effects.restored++; },
        window: { WAFFLE_CARE_STARTUP: { ready() {} } }, Date: DateConstructor
    };
    vm.runInNewContext(`${source.slice(signatureStart, signatureEnd)}\n${source.slice(applyStart, applyEnd)}\nthis.apply = applyGuestDirectoryResponse; this.signature = getDirectoryBookingSignature;`, sandbox);
    return { sandbox, effects };
}

const booking = (overrides = {}) => ({ stayKey: 'target-stay', stayId: 'stay-1', dogName: 'Milo', breed: 'Collie', startDate: '2026-10-10', endDate: '2026-10-12', ownerName: 'Alex', phone: '555', notes: '', dogId: 'dog-1', dogNumber: '1', ...overrides });

test('same-roster refresh retains the existing active profile node and applies fresh summary data', () => {
    const activeCard = { dataset: { directoryStayKey: 'target-stay' }, isConnected: true };
    const h = harness(activeCard);
    h.sandbox.directoryBookingStateSignature = h.sandbox.signature([booking()]);
    const freshSummary = { stayKey: 'target-stay', riskFlags: { allergy: true } };
    h.sandbox.apply({ bookings: [booking()], summaries: [freshSummary], digitalIntakes: [], legacyIntakes: [] });
    assert.equal(h.effects.parsed.length, 0);
    assert.equal(activeCard.isConnected, true);
    assert.equal(h.effects.summaries[0][1], freshSummary);
    assert.equal(h.effects.restored, 1);
});

test('forced refresh still invalidates profile caches and applies current same-roster summaries', () => {
    const h = harness({ dataset: { directoryStayKey: 'target-stay' } });
    const current = [booking()];
    h.sandbox.directoryBookingStateSignature = h.sandbox.signature(current);
    h.sandbox.directoryProfileDetailCache = { profile: { value: 'stale' } };
    const freshSummary = { stayKey: 'target-stay', riskFlags: { allergy: true } };
    h.sandbox.apply({ bookings: current, summaries: [freshSummary], digitalIntakes: [], legacyIntakes: [] }, { force: true });
    assert.deepEqual(Object.keys(h.sandbox.directoryProfileDetailCache), []);
    assert.equal(h.effects.parsed.length, 0);
    assert.equal(h.effects.summaries[0][1], freshSummary);
});

test('a changed booking updates the roster, including fields represented in the directory CSV', () => {
    for (const changed of [booking({ dogName: 'Milo Jr' }), booking({ stayId: 'stay-2' }), booking({ timestamp: '2026-10-01T10:00:00Z' }), booking({ bookingType: 'Daycare' }), booking({ editLink: 'https://example.test/edit' })]) {
        const h = harness({ dataset: { directoryStayKey: 'target-stay' } });
        h.sandbox.directoryBookingStateSignature = h.sandbox.signature([booking()]);
        h.sandbox.apply({ bookings: [changed], summaries: [], digitalIntakes: [], legacyIntakes: [] });
        assert.equal(h.effects.parsed.length, 1);
        assert.equal(h.sandbox.directoryBookingStateSignature, h.sandbox.signature([changed]));
    }
});

test('booking signatures preserve roster order and encode delimiter-containing fields without collisions', () => {
    const h = harness({ dataset: { directoryStayKey: 'target-stay' } });
    const left = [booking({ ownerName: 'a|b', phone: 'c' })];
    const right = [booking({ ownerName: 'a', phone: 'b|c' })];
    assert.notEqual(h.sandbox.signature(left), h.sandbox.signature(right));
    assert.notEqual(h.sandbox.signature([booking(), booking({ stayKey: 'other-stay', stayId: 'stay-2', dogId: 'dog-2' })]), h.sandbox.signature([booking({ stayKey: 'other-stay', stayId: 'stay-2', dogId: 'dog-2' }), booking()]));
});

test('local date rollover changes the signature so date-dependent roster status is regenerated', () => {
    let today = new Date(2026, 9, 16, 23, 59).getTime();
    class FrozenDate extends Date { constructor(...args) { super(...(args.length ? args : [today])); } }
    const h = harness({ dataset: { directoryStayKey: 'target-stay' } }, undefined, FrozenDate);
    const before = h.sandbox.signature([booking()]);
    today = new Date(2026, 9, 17, 0, 1).getTime();
    const after = h.sandbox.signature([booking()]);
    assert.notEqual(before, after);
    assert.equal(JSON.parse(before)[0], '2026-10-16');
    assert.equal(JSON.parse(after)[0], '2026-10-17');
});

test('directory CSV carries stable stay IDs through to the card renderer', () => {
    const escape = source.slice(source.indexOf('    function directoryBookingCsvEscape('), csvStart);
    const sandbox = {};
    vm.runInNewContext(`${escape}\n${source.slice(csvStart, signatureStart)}\nthis.toCsv = guestDirectoryBookingsToCsv;`, sandbox);
    const records = sandbox.toCsv([booking()]).split('\n').map(line => line.split(','));
    const stayIdColumn = records[0].indexOf('Stay ID');
    assert.ok(stayIdColumn >= 0);
    assert.equal(records[1][stayIdColumn], 'stay-1');
});

test('card reuse requires the full stable identity, unique old/new matches, and unchanged generated markup', () => {
    const sandbox = { WeakMap };
    vm.runInNewContext(`const directoryCardGeneratedMarkup = new WeakMap();\n${source.slice(reuseStart, reconcileStart)}\nthis.key = directoryCardReuseKey; this.canReuse = directoryCardCanReuse; this.baseline = directoryCardGeneratedMarkup;`, sandbox);
    const card = (stayKey, stayId, dogId) => ({ dataset: { directoryStayKey: stayKey, directoryStayId: stayId, directoryDogId: dogId } });
    const a = card('same-name|2026-10-10|2026-10-12', 'Stay-A', 'Dog-A');
    const b = card('same-name|2026-10-10|2026-10-12', 'Stay-B', 'Dog-B');
    const key = sandbox.key(a);
    sandbox.baseline.set(a, '<article>same guest</article>');
    assert.equal(sandbox.key(a), key);
    assert.notEqual(sandbox.key(a), sandbox.key(b));
    assert.equal(sandbox.key(card(a.dataset.directoryStayKey, '', 'Dog-A')), '');
    assert.equal(sandbox.canReuse({ count: 1, card: a }, { count: 1 }, a, '<article>same guest</article>'), true);
    assert.equal(sandbox.canReuse({ count: 2, card: a }, { count: 1 }, a, '<article>same guest</article>'), false);
    assert.equal(sandbox.canReuse({ count: 1, card: a }, { count: 2 }, a, '<article>same guest</article>'), false);
    assert.equal(sandbox.canReuse({ count: 1, card: a }, { count: 1 }, a, '<article>changed guest</article>'), false);
});
