const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const booking = fs.readFileSync('phase4-booking.js', 'utf8');
const care = fs.readFileSync('care.js', 'utf8');
const roster = fs.readFileSync('waffle-app.js', 'utf8');
const master = fs.readFileSync('waffle-v11.0.js', 'utf8');

test('confirmed booking defaults to new identity and labels exact existing choices', () => {
  assert.match(booking, /<option value="">New dog \(create a new identity\)<\/option>/);
  assert.match(booking, /action:'list_dog_identities'/);
  assert.match(booking, /String\(item\.dogId\|\|''\).*slice\(0,8\)/);
  assert.match(booking, /item\.ownerName/);
  assert.match(booking, /item\.maskedPhoneTail/);
  assert.match(booking, /if\(v\.dogId\)payload\.dogId=v\.dogId/);
  assert.match(booking, /copyPreviousProfile:!!v\.dogId/);
  assert.doesNotMatch(booking, /function updateDecision\(\)[^\n]*returning\(/);
  assert.doesNotMatch(booking, /get_returning_guest_prefill/);
  assert.match(booking, /sameName\.length>1/);
});

test('Care cards retain Dog IDs and history/master reads use the exact ID', () => {
  assert.match(roster, /booking\.dogId \|\| ''/);
  assert.match(roster, /data-directory-dog-id="\$\{escapeDashboardHtml\(dogId\)\}"/);
  assert.match(roster, /Dog ID \$\{escapeDashboardHtml\(shortDogId\)\}/);
  assert.match(care, /action: 'get_dog_history', dogName, \.\.\.\(dogId \? \{ dogId \} : \{\}\)/);
  assert.match(care, /action: 'get_dog_master_profile', dogName, \.\.\.\(dogId \? \{ dogId \} : \{\}\), breed/);
  assert.match(master, /key=dogId\?`id:\$\{dogId\}`/);
  assert.match(master, /dogName:dog,\.\.\.\(dogId\?\{dogId\}:\{\}\)/);
});

test('legacy Care ID backfill stays explicit and name-only booking paths never copy profiles', () => {
  assert.match(booking, /action:'backfill_dog_ids'/);
  assert.match(booking, /if\(!confirm\('Assign Dog IDs to legacy bookings/);

  const core = {
    parseBooking: () => ({ dogName: 'Coco', startDate: '2026-10-01', endDate: '2026-10-02' }),
    today: () => '2026-10-01',
    parseRange: () => ({ startDate: '', endDate: '' })
  };
  const sandbox = {
    window: { WAFFLE_PHASE4_CORE: core },
    document: { addEventListener() {} }
  };
  vm.runInNewContext(fs.readFileSync('phase4-ai-actions.js', 'utf8'), sandbox);
  const proposed = sandbox.window.WAFFLE_PHASE4_AI_ACTIONS.parse('book Coco again');
  assert.equal(proposed.copyPreviousProfile, undefined);
  assert.doesNotMatch(fs.readFileSync('waffle-v10.8.js', 'utf8'), /copyPreviousProfile:m\.querySelector\('\[data-v108-copy-profile\]'\)/);
  assert.doesNotMatch(fs.readFileSync('phase4-ai-actions.js', 'utf8'), /copyPreviousProfile:meta\.copyPreviousProfile/);
});

test('local stay counts separate same-name dogs when a Dog ID is supplied', () => {
  const csv = [
    'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Dog ID',
    '2026-01-01,Coco,Spoodle,2026-01-02,2026-01-03,Alice,0400000000,,,,,Boarding,dog-a',
    '2026-02-01,Coco,Spoodle,2026-02-02,2026-02-03,Alice,0400000000,,,,,Boarding,dog-a',
    '2026-03-01,Coco,Staffy,2026-03-02,2026-03-03,Bob,0411111111,,,,,Boarding,dog-b'
  ].join('\n');
  const sandbox = {
    window: {},
    document: { readyState: 'loading', body: { dataset: {} }, addEventListener() {}, getElementById() { return null; } },
    localStorage: { getItem(key) { return key === 'boardingDataCache' ? csv : null; }, setItem() {} },
    setTimeout,
    clearTimeout,
    Date
  };
  vm.runInNewContext(fs.readFileSync('phase4-core.js', 'utf8'), sandbox);
  const core = sandbox.window.WAFFLE_PHASE4_CORE;
  assert.equal(core.visits('Coco').length, 3, 'legacy name-only view remains available for non-identity workflows');
  assert.equal(core.visits('Coco', 'dog-a').length, 2);
  assert.equal(core.visits('Coco', 'dog-b').length, 1);
});
