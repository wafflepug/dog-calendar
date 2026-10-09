const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const careConsumers = [
  'waffle-v10.8.js',
  'waffle-v11.1.5.js',
  'waffle-v11.1.7.js',
  'waffle-v11.1.11.js',
  'waffle-v11.1.12.js',
  'waffle-v11.2.14.js'
];

test('active Care profile enrichers use the shared identity-checked reader', () => {
  for (const file of careConsumers) {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    assert.ok(source.includes('WAFFLE_CARE_PROFILE_READS.read') || source.includes('reads.read'), `${file} should use the shared reader`);
    assert.doesNotMatch(source, /action\s*:\s*['"]get_guest_profile['"]/, `${file} must not issue an unscoped profile read`);
  }
  const operations = fs.readFileSync(path.join(process.cwd(), 'waffle-v11.0.js'), 'utf8');
  const photoReader = operations.slice(operations.indexOf('async function v110PhotoForStay('), operations.indexOf('\nasync function v110RenderLeavingModal'));
  assert.match(photoReader, /WAFFLE_CARE_PROFILE_READS\.read/);
  assert.match(photoReader, /carePage/);
  assert.match(photoReader, /queryAppsScript\(\{action:'get_guest_profile'/, 'non-Care home/calendar fallback stays intact');
});

test('leaving photo consumer resolves conflicting same-name/date stays by stable IDs', async () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'waffle-v11.0.js'), 'utf8');
  const start = source.indexOf('async function v110PhotoForStay(');
  const end = source.indexOf('\nasync function v110RenderLeavingModal', start);
  assert.ok(start >= 0 && end > start);
  const calls = [];
  const cards = [
    { dataset: { directoryStayKey: 'milo|2026-10-12|2026-10-13', directoryStayId: 'stay-a', directoryDogId: 'dog-a', directoryDogName: 'Milo' } },
    { dataset: { directoryStayKey: 'milo|2026-10-12|2026-10-13', directoryStayId: 'stay-b', directoryDogId: 'dog-b', directoryDogName: 'Milo' } }
  ];
  const api = {
    read: async card => {
      calls.push(card);
      const id = card.dataset.directoryStayId;
      return { data: { record: { identity: { stayKey: card.dataset.directoryStayKey, stayId: id, dogId: card.dataset.directoryDogId }, resolution: { status: 'resolved' }, dogPhoto: { url: `https://photos.test/${id}.jpg` } } } };
    },
    matches: (card, record) => record.identity.stayId === card.dataset.directoryStayId && record.identity.dogId === card.dataset.directoryDogId && record.identity.stayKey === card.dataset.directoryStayKey
  };
  const sandbox = {
    window: { WAFFLE_PAGE: 'directory', WAFFLE_CARE_PROFILE_READS: api },
    document: { body: { dataset: { wafflePage: 'directory' } }, querySelectorAll: () => cards },
    v110StayKeyForEvent: event => `${event.extendedProps.dogName.toLowerCase()}|2026-10-12|2026-10-13`
  };
  vm.runInNewContext(`${source.slice(start, end)}\nthis.readPhoto = v110PhotoForStay;`, sandbox);
  const event = { title: 'Milo', extendedProps: { dogName: 'Milo', stayId: 'stay-b', dogId: 'dog-b' } };
  assert.equal(await sandbox.readPhoto('milo|2026-10-12|2026-10-13', event), 'https://photos.test/stay-b.jpg');
  assert.deepEqual(calls, [cards[1]]);

  calls.length = 0;
  const ambiguous = { title: 'Milo', extendedProps: { dogName: 'Milo' } };
  assert.equal(await sandbox.readPhoto('milo|2026-10-12|2026-10-13', ambiguous), '');
  assert.equal(calls.length, 0);
});