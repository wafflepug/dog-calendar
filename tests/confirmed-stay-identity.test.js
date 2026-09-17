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
vm.runInNewContext(`${appSource.slice(capacityStart, capacityEnd)}\n${source.slice(start, composeEnd)}\nthis.identity = v1105ConfirmedStayIdentity;\nthis.dedupe = v1105DedupeConfirmedStays;`, sandbox);

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

test('phone-only identities dedupe only when the contact is identical', () => {
    const phoneA = stay({ ownerName: '', phone: '0400 123 456' });
    const phoneB = stay({ ownerName: '', phone: '0400 123 456' });
    const phoneC = stay({ ownerName: '', phone: '0400 654 321' });
    assert.equal(sandbox.dedupe([phoneA, phoneB]).length, 1);
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
});

test('delimiters in identity fields cannot produce a false collision', () => {
    assert.notEqual(sandbox.identity(stay({ breed: 'a|b', ownerName: 'c' })), sandbox.identity(stay({ breed: 'a', ownerName: 'b|c' })));
});
