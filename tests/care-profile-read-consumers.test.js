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

test('gallery ignores results and errors after switching to another dog', async () => {
  const source = fs.readFileSync('waffle-v10.8.js', 'utf8');
  const start = source.indexOf('async function v108RefreshGallery()');
  const end = source.indexOf('\nfunction v108RenderGallery', start);
  const host = { innerHTML: 'New dog gallery' };
  const painted = [];
  let finish;
  const card = { isConnected: true, dataset: { directoryStayKey: 'dog-a' } };
  const sandbox = {
    v108GalleryCard: card, v108GalleryStayKey: 'dog-a',
    v108EnsureGalleryModal: () => ({ querySelector: () => host }),
    v108RenderGallery: record => painted.push(record), escapeDashboardHtml: s => s,
    window: { WAFFLE_CARE_PROFILE_READS: { read: () => new Promise((resolve, reject) => { finish = { resolve, reject }; }), matches: () => true } }
  };
  vm.runInNewContext(source.slice(start, end), sandbox);
  for (const fail of [false, true]) {
    sandbox.v108GalleryCard = card; sandbox.v108GalleryStayKey = 'dog-a';
    const pending = sandbox.v108RefreshGallery();
    sandbox.v108GalleryCard = { isConnected: true, dataset: { directoryStayKey: 'dog-b' } };
    sandbox.v108GalleryStayKey = 'dog-b';
    if (fail) finish.reject(new Error('Old dog request failed'));
    else finish.resolve({ data: { record: { dogName: 'Dog A' } } });
    await pending;
    assert.equal(painted.length, 0);
    assert.equal(host.innerHTML, 'New dog gallery');
  }
});
