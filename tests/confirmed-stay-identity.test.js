const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync('waffle-v11.0.5-core.js', 'utf8');
const start = source.indexOf('function v1105ConfirmedStayIdentity');
const end = source.indexOf('v1104ComposeCalendarEvents =', start);
assert(start >= 0 && end > start, 'confirmed stay identity functions must remain in the v11.0.5 core');
const composeEnd = source.indexOf('v1104LoadSharedPotentialStays =', end);
assert(composeEnd > end, 'calendar composition must remain available to fixtures');
const appSource = fs.readFileSync('waffle-app.js', 'utf8');
const capacityStart = appSource.indexOf('    function countDogsInName(');
const capacityEnd = appSource.indexOf('    function parseCsvDate(', capacityStart);
assert(capacityStart >= 0 && capacityEnd > capacityStart, 'capacity helpers must remain available to fixtures');
const sandbox = {
    v1104SharedPotentialLoaded: true,
    v1104SharedPotentialEvents: [],
    getPendingPotentialRemovals: () => [],
    dailyCapacityCounts: {}
};
vm.runInNewContext(`${appSource.slice(capacityStart, capacityEnd)}\n${source.slice(start, composeEnd)}\nthis.identity = v1105ConfirmedStayIdentity;\nthis.sameIdentity = v1105SameConfirmedStayIdentity;\nthis.dedupe = v1105DedupeConfirmedStays;`, sandbox);

function stay(overrides = {}) {
    return {
        title: 'Milo',
        start: '2026-09-20',
        end: '2026-09-23',
        extendedProps: {
            dogName: 'Milo',
            breed: 'Labrador',
            ownerName: 'Alex Smith',
            phone: '0400 123 456',
            rawStartDate: '2026-09-20',
            rawEndDate: '2026-09-22',
            bookingType: 'Confirmed Boarding',
            editLink: '',
            ...overrides
        }
    };
}

test('identical sheet and local copies collapse and retain the sheet event/edit link', () => {
    const sheet = stay({ editLink: 'https://sheet/row/7' });
    const local = stay({ editLink: '' });
    const result = sandbox.dedupe([sheet, local]);
    assert.equal(result.length, 1);
    assert.equal(result[0], sheet);
    assert.equal(result[0].extendedProps.editLink, 'https://sheet/row/7');
});

test('a later local edit link backfills an otherwise linkless authoritative copy', () => {
    const sheet = stay({ editLink: '' });
    const local = stay({ editLink: 'https://sheet/row/8' });
    const result = sandbox.dedupe([sheet, local]);
    assert.equal(result.length, 1);
    assert.equal(result[0].extendedProps.editLink, 'https://sheet/row/8');
});

test('different owner/contact identities remain separate, including conflicting owners with the same phone', () => {
    const ownerA = stay({});
    const ownerB = stay({ ownerName: 'Jordan Smith' });
    const samePhoneDifferentOwner = stay({ ownerName: 'Taylor Smith' });
    assert.equal(sandbox.dedupe([ownerA, ownerB]).length, 2);
    assert.equal(sandbox.dedupe([ownerA, samePhoneDifferentOwner]).length, 2);
});

test('phone-only records remain separate even when households share contact details', () => {
    const phoneA = stay({ ownerName: '', phone: '0400 123 456' });
    const phoneB = stay({ ownerName: '', phone: '0400 123 456' });
    const phoneC = stay({ ownerName: '', phone: '0400 654 321' });
    assert.equal(sandbox.dedupe([phoneA, phoneB]).length, 2);
    assert.equal(sandbox.dedupe([phoneA, phoneC]).length, 2);
});

test('owner matching is case and whitespace tolerant', () => {
    const copy = stay({ ownerName: '  alex   SMITH  ', phone: '0400 123 456' });
    assert.equal(sandbox.dedupe([stay(), copy]).length, 1);
});

test('missing or sentinel identity is ambiguous and is preserved', () => {
    const missing = stay({ ownerName: '', phone: '' });
    const sentinel = stay({ ownerName: 'N/A', phone: 'Unknown' });
    assert.equal(sandbox.identity(missing), '');
    assert.equal(sandbox.identity(sentinel), '');
    assert.equal(sandbox.dedupe([missing, sentinel]).length, 2);
});

test('different dates and conflicting breeds remain separate', () => {
    const later = stay({ rawStartDate: '2026-09-21', rawEndDate: '2026-09-23' });
    const differentBreed = stay({ breed: 'Border Collie' });
    assert.equal(sandbox.dedupe([stay(), later]).length, 2);
    assert.equal(sandbox.dedupe([stay(), differentBreed]).length, 2);
});

test('Meet & Greet and Potential events are never swallowed by confirmed dedupe', () => {
    const meet = stay({ isMeetGreet: true });
    const potential = stay({ isPotential: true });
    assert.equal(sandbox.identity(meet), '');
    assert.equal(sandbox.identity(potential), '');
    assert.equal(sandbox.dedupe([meet, potential]).length, 2);
});

test('raw dates remain unchanged for early checkout and capacity consumers', () => {
    const event = stay();
    const before = [event.extendedProps.rawStartDate, event.extendedProps.rawEndDate];
    sandbox.dedupe([event, stay()]);
    assert.deepEqual([event.extendedProps.rawStartDate, event.extendedProps.rawEndDate], before);
});

test('deduped confirmed events count capacity once per dog and twice for two owners', () => {
    const oneOwner = sandbox.v1104ComposeCalendarEvents([stay()], [], [], [stay()]);
    assert.equal(oneOwner.length, 1);
    assert.equal(sandbox.dailyCapacityCounts['2026-09-20'], 1);
    assert.equal(sandbox.dailyCapacityCounts['2026-09-22'], 1);
    assert.equal(sandbox.dailyCapacityCounts['2026-09-23'], undefined);
    const twoOwners = sandbox.v1104ComposeCalendarEvents([stay()], [], [], [stay({ ownerName: 'Jordan Smith' })]);
    assert.equal(twoOwners.length, 2);
    assert.equal(sandbox.dailyCapacityCounts['2026-09-20'], 2);
    assert.equal(sandbox.dailyCapacityCounts['2026-09-22'], 2);
});

test('a partial identity is retained separately from a more complete booking', () => {
    assert.equal(sandbox.dedupe([stay(), stay({ phone: '' })]).length, 2);
    assert.equal(sandbox.dedupe([stay({ phone: '' }), stay({ phone: '' })]).length, 2);
});

test('conflicting aliases and different partial source identities are preserved in composition', () => {
    for (const partial of [{ owner: 'Another owner' }, { contact: '0400 000 000' }, { ownerPhone: '0400 000 000' }]) {
        const conflicted = stay(partial);
        assert.equal(sandbox.identity(conflicted), '');
        assert.equal(sandbox.v1104ComposeCalendarEvents([stay()], [], [], [conflicted]).length, 2);
    }
    const ownerOnly = stay({ phone: '' });
    const phoneOnly = stay({ ownerName: '' });
    assert.equal(sandbox.v1104ComposeCalendarEvents([ownerOnly], [], [], [phoneOnly]).length, 2);
});

test('stable stay IDs reconcile same-date copies when CSV phone formatting changes', () => {
    const stayId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const dogId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const csv = stay({ stayId, dogId, phone: '(02) 9123-4567' });
    const overlay = stay({ stayId, dogId, phone: '02 9123 4567' });
    assert.equal(sandbox.dedupe([csv, overlay]).length, 1);
});

test('stable stay ID bucket still preserves conflicts and different stay IDs', () => {
    const stayId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const first = stay({ stayId, dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    const conflictingDog = stay({ stayId, dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    const differentDate = stay({ stayId, rawStartDate: '2026-09-21', rawEndDate: '2026-09-23' });
    const differentStay = stay({ stayId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' });
    assert.equal(sandbox.dedupe([first, conflictingDog]).length, 2);
    assert.equal(sandbox.dedupe([first, differentDate]).length, 2);
    assert.equal(sandbox.dedupe([first, differentStay]).length, 2);
});

test('a legacy CSV row already showing the pending edited dates is replaced by its strong-ID overlay', () => {
    const dogId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const legacy = stay({ dogId, rawStartDate: '2026-09-25', rawEndDate: '2026-10-13' });
    const overlay = stay({
        dogId,
        stayId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        rawStartDate: '2026-09-25',
        rawEndDate: '2026-10-13',
        pendingOriginalStartDate: '2026-09-25',
        pendingOriginalEndDate: '2026-10-11',
        dateUpdatePending: true
    });
    const result = sandbox.v1104ComposeCalendarEvents([legacy], [], [], [overlay]);
    assert.deepEqual(result, [overlay]);
});
test('delimiters in identity fields cannot produce a false collision', () => {
    assert.notEqual(sandbox.identity(stay({ breed: 'a|b', ownerName: 'c' })), sandbox.identity(stay({ breed: 'a', ownerName: 'b|c' })));
});

test('different persisted dog IDs preserve same-name/date dogs with otherwise matching identity', () => {
    const first = stay({ dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    const second = stay({ dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    assert.equal(sandbox.dedupe([first, second]).length, 2);
    assert.equal(sandbox.sameIdentity(first, second), false);
});

test('same or missing dog ID copies still reconcile only when the existing identity is complete', () => {
    const withId = stay({ dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    const sameId = stay({ dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    const noId = stay({});
    assert.equal(sandbox.dedupe([withId, sameId]).length, 1);
    assert.equal(sandbox.dedupe([noId, withId]).length, 1);
    assert.equal(sandbox.dedupe([stay({ ownerName: '', phone: '' }), stay({ dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ownerName: '', phone: '' })]).length, 2);
});

test('an ID-less copy cannot bridge two distinct persisted Dog IDs in any source order', () => {
    const noId = stay({});
    const first = stay({ dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    const second = stay({ dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    for (const events of [[noId, first, second], [first, noId, second], [first, second, noId]]) {
        const deduped = sandbox.dedupe(events);
        assert.equal(deduped.length, 3);
        assert.equal(deduped.includes(noId), true);
        assert.equal(deduped.includes(first), true);
        assert.equal(deduped.includes(second), true);
    }
});


test('stable ID buckets never absorb potential or meet events into boarding', () => {
    const props = { stayId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', dogId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' };
    const confirmed = stay(props);
    const potential = stay({ ...props, isPotential: true });
    const meet = stay({ ...props, isMeetGreet: true });
    assert.equal(sandbox.dedupe([confirmed, potential, meet]).length, 3);
});

test('edited-date legacy bridge preserves ambiguity and conflicting identity', () => {
    const props = { dogId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', rawStartDate: '2026-09-25', rawEndDate: '2026-10-13' };
    const overlay = stay({ ...props, stayId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', dateUpdatePending: true, pendingOriginalStartDate: '2026-09-25', pendingOriginalEndDate: '2026-10-11' });
    const ambiguous = sandbox.v1104ComposeCalendarEvents([stay(props), stay(props)], [], [], [overlay]);
    assert.equal(ambiguous.length, 2, 'existing legacy duplicate reconciliation remains separate from the unresolved overlay');
    assert.equal(ambiguous.includes(overlay), true);
    for (const conflict of [{ ownerName: 'Other owner' }, { phone: '0499999999' }, { dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }]) {
        assert.equal(sandbox.v1104ComposeCalendarEvents([stay({ ...props, ...conflict })], [], [], [overlay]).length, 2);
    }
});
