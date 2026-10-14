const assert = require('node:assert/strict');
const test = require('node:test');
const { createPlan, savePlan, validatePlan, weeklyVisits } = require('../booking-plan');

const idA = '123e4567-e89b-42d3-a456-426614174000';
const idB = '223e4567-e89b-42d3-a456-426614174000';
let serial = 0;
function uuid() { serial += 1; return `323e4567-e89b-42d3-a456-${String(serial).padStart(12, '0')}`; }
function input(overrides = {}) {
  return {
    dogs: [{ key: 'dog-a', dogName: 'Milo', breed: 'Kelpie' }],
    visits: [{ startDate: '2026-12-01', endDate: '2026-12-02' }, { startDate: '2026-12-08', endDate: '2026-12-08' }],
    ownerName: 'Alex Owner', phone: '0400000000', source: 'Referral', visitMode: 'stay',
    ...overrides
  };
}

test('weeklyVisits uses strict calendar dates, includes start, and stays on seven-day intervals', () => {
  assert.deepEqual(weeklyVisits('2026-01-01', '2026-01-15'), [
    { startDate: '2026-01-01', endDate: '2026-01-01' },
    { startDate: '2026-01-08', endDate: '2026-01-08' },
    { startDate: '2026-01-15', endDate: '2026-01-15' }
  ]);
  assert.deepEqual(weeklyVisits('2024-02-29', '2024-02-29'), [{ startDate: '2024-02-29', endDate: '2024-02-29' }]);
  assert.throws(() => weeklyVisits('2025-02-29', '2025-03-01'), /valid dates/);
  assert.throws(() => weeklyVisits('2026-02-30', '2026-03-01'), /valid dates/);
  assert.throws(() => weeklyVisits('2026-01-01', '2026-04-02'), /90 days/);
  assert.throws(() => weeklyVisits('2026-01-01', '2026-04-01'), /12 visits/);
});

test('validation catches required fields, date errors, limits, and within-plan overlapping visits', () => {
  const invalid = input({ ownerName: '', phone: '', visitMode: 'same-day', dogs: [{ key: '', dogName: '', breed: '' }], visits: [
    { startDate: '2026-02-30', endDate: '2026-02-31' },
    { startDate: '2026-12-01', endDate: '2026-12-03' },
    { startDate: '2026-12-03', endDate: '2026-12-03' }
  ] });
  const result = validatePlan(invalid);
  assert.ok(result.issues.some(issue => issue.includes('Owner name')));
  assert.ok(result.issues.some(issue => issue.includes('Phone')));
  assert.ok(result.issues.some(issue => issue.includes('explicit key')));
  assert.ok(result.issues.some(issue => issue.includes('real YYYY-MM-DD')));
  assert.ok(result.issues.some(issue => issue.includes('overlap')));
  assert.ok(result.issues.some(issue => issue.includes('Same-day')));
  const tooLarge = validatePlan(input({ dogs: Array.from({ length: 5 }, (_, n) => ({ key: `d${n}`, dogName: `Dog ${n}`, breed: 'Mix' })), visits: Array.from({ length: 7 }, (_, n) => ({ startDate: `2026-12-${String(n * 7 + 1).padStart(2, '0')}`, endDate: `2026-12-${String(n * 7 + 1).padStart(2, '0')}` })) }));
  assert.ok(tooLarge.issues.some(issue => issue.includes('30 dog visits')));
});

test('same-day mode requires same dates, and identity duplicates are explicit', () => {
  const dup = validatePlan(input({
    dogs: [
      { key: 'a', dogName: 'Milo', breed: 'Kelpie' },
      { key: 'b', dogName: ' mIlO ', breed: 'Kelpie' },
      { key: 'c', dogId: idA, dogName: 'Milo Two', breed: 'Kelpie' },
      { key: 'd', dogId: idA, dogName: 'Milo Three', breed: 'Kelpie' }
    ], visitMode: 'same-day'
  }));
  assert.ok(dup.issues.some(issue => issue.includes('Duplicate dog name')));
  assert.ok(dup.issues.some(issue => issue.includes('Duplicate Dog ID')));
  assert.ok(dup.issues.some(issue => issue.includes('Same-day')));
  assert.ok(validatePlan(input({ dogs: [{ key: 'a', dogId: 'bad-id', dogName: 'Milo', breed: 'Kelpie' }] })).issues.some(issue => issue.includes('must be a UUID')));
  const sameLegacyTarget = validatePlan(input({ dogs: [
    { key: 'a', dogId: idA, dogName: 'Milo', breed: 'Kelpie' },
    { key: 'b', dogId: idB, dogName: 'milo', breed: 'Kelpie' }
  ] }));
  assert.ok(sameLegacyTarget.issues.some(issue => issue.includes('Duplicate dog name')));
});

test('confirmed rows enforce backend name/date collision and exact-ID overlap while legacy overlap warns', () => {
  const rows = [
    { dogId: idA, dogName: 'Milo', startDate: '2026-12-01', endDate: '2026-12-04', bookingType: 'Boarding' },
    { dogId: '', dogName: 'Milo', startDate: '2026-12-08', endDate: '2026-12-10', bookingType: 'Confirmed Boarding' },
    { dogId: idB, dogName: 'Other', startDate: '2026-12-01', endDate: '2026-12-30', bookingType: 'Potential Stay' }
  ];
  const exact = validatePlan(input({ dogs: [{ key: 'a', dogId: idA, dogName: 'Milo', breed: 'Kelpie' }], visits: [{ startDate: '2026-12-01', endDate: '2026-12-04' }] }), rows);
  assert.ok(exact.issues.some(issue => issue.includes('already exists')));
  assert.ok(exact.issues.some(issue => issue.includes('overlap')));
  const legacy = validatePlan(input({ dogs: [{ key: 'a', dogName: 'Milo', breed: 'Kelpie' }] }), rows);
  assert.ok(legacy.warnings.some(warning => warning.includes('identity cannot be verified')));
  assert.equal(legacy.issues.some(issue => issue.includes('already exists')), false);
});

test('capacity aggregates all dogs and inclusive confirmed booking days as advisory warnings', () => {
  const plan = input({
    dogs: [{ key: 'a', dogName: 'Milo', breed: 'Kelpie' }, { key: 'b', dogName: 'Pip', breed: 'Terrier' }],
    visits: [{ startDate: '2026-12-02', endDate: '2026-12-03' }]
  });
  const rows = [{ dogName: 'Old & New', startDate: '2026-12-01', endDate: '2026-12-02', bookingType: 'Boarding' }];
  const result = validatePlan(plan, rows, { preferred: 2, absolute: 3 });
  assert.equal(result.peak, 4);
  assert.ok(result.warnings.some(warning => warning.includes('above the absolute setting')));
  assert.equal(result.issues.length, 0);
});

test('capacity counts a long confirmed stay on requested dates and ignores unrelated busy dates', () => {
  const plan = input({ visits: [{ startDate: '2027-06-15', endDate: '2027-06-15' }] });
  const rows = [
    { dogName: 'Long stay', startDate: '2026-01-01', endDate: '2027-12-31', bookingType: 'Boarding' },
    ...Array.from({ length: 7 }, (_, n) => ({ dogName: `Busy ${n}`, startDate: '2027-01-10', endDate: '2027-01-10', bookingType: 'Boarding' }))
  ];
  const result = validatePlan(plan, rows, { preferred: 2, absolute: 3 });
  assert.equal(result.peak, 2);
  assert.deepEqual(result.warnings, []);
});

test('planned legacy combined profiles retain the existing daily dog-count convention', () => {
  const plan = input({
    dogs: [{ key: 'a', dogId: idA, dogName: 'One & Two', breed: 'Pugs' }, { key: 'b', dogName: 'Pip', breed: 'Terrier' }],
    visits: [{ startDate: '2026-12-02', endDate: '2026-12-02' }]
  });
  const result = validatePlan(plan, [], { preferred: 2, absolute: 3 });
  assert.equal(result.peak, 3);
  assert.ok(result.warnings.some(warning => warning.includes('above the preferred')));
});

test('invalid long ranges and oversized plans never enter capacity expansion', () => {
  const long = validatePlan(input({ visits: [{ startDate: '2026-01-01', endDate: '2041-01-01' }] }));
  assert.ok(long.issues.some(issue => issue.includes('90-day limit')));
  assert.equal(long.peak, 0);
  const oversized = validatePlan(input({ visits: Array.from({ length: 13 }, () => ({ startDate: '2026-01-01', endDate: '2026-01-01' })) }));
  assert.ok(oversized.issues.some(issue => issue.includes('12 visits')));
  assert.equal(oversized.peak, 0);
});

test('createPlan builds stable create_boarding payloads and reviewed inheritance only for earlier completed care', () => {
  const reviewed = { sourceDogId: idA, sourceStayId: 'stay-1', sourceStayKey: 'stay-key-1', sourceEndDate: '2026-11-30', sourceCompletedDate: '2026-11-30', confirmed: true, profile: { medicalConditions: 'None' }, riskFlags: { medicated: false } };
  const plan = createPlan(input({ dogs: [{ key: 'a', dogId: idA, dogName: 'Milo', breed: 'Kelpie', notes: 'Quiet at night', inheritCareReview: reviewed }] }), uuid);
  assert.equal(plan.rows.length, 2);
  const first = plan.rows[0].payload;
  assert.equal(first.action, 'create_boarding');
  assert.equal(first.stayIdentityVersion, 1);
  assert.match(first.stayId, /^[0-9a-f-]{36}$/i);
  assert.match(first.clientMutationId, /^[0-9a-f-]{36}$/i);
  assert.equal(first.ownerName, 'Alex Owner');
  assert.equal(first.phone, '0400000000');
  assert.match(first.notes, /Source: Referral/);
  assert.deepEqual(first.inheritCareReview, reviewed);
  reviewed.profile.medicalConditions = 'mutated';
  assert.equal(first.inheritCareReview.profile.medicalConditions, 'None');
  const staleInput = input({ dogs: [{ key: 'a', dogId: idA, dogName: 'Milo', breed: 'Kelpie', inheritCareReview: { ...reviewed, sourceEndDate: '2026-12-01', sourceCompletedDate: '2026-12-01' } }] });
  assert.ok(validatePlan(staleInput).issues.some(issue => issue.includes('before every planned visit')));
  assert.throws(() => createPlan(staleInput, uuid), /before every planned visit/);
  const existing = createPlan(input({ dogs: [{ key: 'a', dogId: idA, dogName: 'Milo', breed: 'Kelpie' }], visitMode: 'same-day', visits: [{ startDate: '2026-12-01', endDate: '2026-12-01' }] }), uuid).rows[0].payload;
  assert.equal(existing.dogId, idA);
  assert.equal(existing.inheritDogPhoto, true);
  assert.match(existing.notes, /Same-day care visit/);
  assert.doesNotMatch(existing.notes, /daycare/i);
});

test('savePlan retries partial failure with stable IDs, skips saved rows, and reuses new identity', async () => {
  const plan = createPlan(input(), uuid);
  const ids = plan.rows.map(row => [row.payload.stayId, row.payload.clientMutationId]);
  const calls = [];
  let firstTry = true;
  const write = async payload => {
    calls.push(payload);
    if (calls.length === 2 && firstTry) { firstTry = false; throw new Error('network timeout'); }
    return { result: 'success', dogId: idB, stayId: payload.stayId, dogNumber: '12', intake: { link: 'https://waffle.example/care' } };
  };
  let result = await savePlan(plan, { write });
  assert.equal(result.status, 'pending');
  assert.equal(plan.rows[0].status, 'saved');
  assert.equal(plan.rows[1].status, 'pending');
  assert.equal(plan.dogs[0].dogId, idB);
  assert.equal(plan.dogs[0].dogNumber, '12');
  assert.equal(plan.rows[1].payload.dogId, idB);
  assert.equal(plan.rows[1].payload.inheritDogPhoto, true);
  assert.equal(plan.rows[1].payload.stayId, ids[1][0]);
  assert.equal(plan.rows[1].payload.clientMutationId, ids[1][1]);
  result = await savePlan(plan, { write });
  assert.equal(result.status, 'saved');
  assert.equal(calls.length, 3);
  assert.equal(calls[2].stayId, ids[1][0]);
  assert.equal(calls[2].clientMutationId, ids[1][1]);
  assert.equal(plan.rows[1].status, 'saved');
  assert.equal(plan.rows[0].intakeLink, 'https://waffle.example/care');
});

test('queued writes pause the batch and unsafe intake links are discarded', async () => {
  const plan = createPlan(input(), uuid);
  let calls = 0;
  const result = await savePlan(plan, { write: async () => { calls++; return { result: 'success', queued: true }; } });
  assert.equal(result.status, 'queued');
  assert.equal(calls, 1);
  assert.equal(plan.rows[0].status, 'queued');
  assert.equal(plan.rows[1].status, 'pending');
  assert.match(plan.rows[0].error, /queued/);
  assert.equal(plan.rows[0].intakeLink, '');
});

test('savePlan rejects stale identity responses and rejects concurrent clicks', async () => {
  const plan = createPlan(input(), uuid);
  let release;
  const pending = savePlan(plan, { write: () => new Promise(resolve => { release = resolve; }) });
  assert.equal(plan.locked, true);
  assert.deepEqual(await savePlan(plan, { write: async () => ({}) }), { status: 'locked' });
  release({ result: 'success', dogId: idA, stayId: '423e4567-e89b-42d3-a456-426614174000' });
  const result = await pending;
  assert.equal(result.status, 'pending');
  assert.match(plan.rows[0].error, /stay identity/);
  assert.equal(plan.rows[0].status, 'pending');
  assert.equal(plan.locked, false);
});

test('createPlan rejects invalid explicit care reviews, while save isolates adapter and callback mutation', async () => {
  const badReview = input({ dogs: [{ key: 'a', dogId: idB, dogName: 'Milo', breed: 'Kelpie', inheritCareReview: {
    sourceDogId: idA, sourceStayKey: 'key', sourceEndDate: '2026-11-30', confirmed: false, profile: {}, riskFlags: {}
  } }] });
  assert.throws(() => createPlan(badReview, uuid), error => error.issues.some(issue => issue.includes('exact Dog ID')) && error.issues.some(issue => issue.includes('confirmation')) && error.issues.some(issue => issue.includes('no saved profile')));

  const plan = createPlan(input(), uuid);
  const originalName = plan.rows[0].payload.dogName;
  const response = await savePlan(plan, {
    write: async payload => {
      payload.dogName = 'Adapter mutation';
      payload.startDate = '1900-01-01';
      return { result: 'success', dogId: idA, stayId: payload.stayId };
    },
    onChange() { throw new Error('render failed'); }
  });
  assert.equal(response.status, 'saved');
  assert.equal(plan.rows[0].payload.dogName, originalName);
  assert.equal(plan.rows[0].payload.startDate, '2026-12-01');
  assert.equal(plan.rows[0].attempted, true);
  assert.equal(plan.rows[0].status, 'saved');
  assert.equal(plan.locked, false);
});
