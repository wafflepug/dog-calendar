const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.js'), 'utf8');
const start = source.indexOf('async function v110LoadMedia(');
const end = source.indexOf('\nfunction v110EnsurePhotoViewer', start);
assert.ok(start >= 0 && end > start, 'find media loader');

function fixture(read) {
  const host = {
    dataset: {},
    innerHTML: '',
    insertAdjacentHTML(_where, html) { this.innerHTML += html; },
    contains() { return false; }
  };
  const card = {
    dataset: { directoryStayId: 'Stay-A', directoryDogId: 'Dog-1', directoryStayKey: 'exact-key-A' },
    querySelector: () => host
  };
  const renders = [];
  const context = vm.createContext({
    document: { activeElement: { closest: () => null } },
    window: { WAFFLE_CARE_BELONGINGS_READS: { read } },
    v110MediaCache: Object.create(null),
    v110RenderMedia: (_card, record) => { renders.push(record); host.dataset.v110RenderedMediaIdentity = host.dataset.v110StayKey; host.innerHTML = '<div>rendered media</div>'; },
    v110RememberMediaDisclosures() {},
    v110Escape: value => String(value)
  });
  vm.runInContext(source.slice(start, end), context);
  return { card, host, renders, context };
}

test('reopening the same stay keeps rendered media in place and still checks freshness', async () => {
  const record = { stayPhotos: [{ id: 'p1' }] };
  let reads = 0;
  const f = fixture(async (_card, options) => { reads++; options.onFresh({ record }); return { data: { record: { stayPhotos: [{ id: 'p1' }] } } }; });
  await f.context.v110LoadMedia(f.card);
  assert.equal(f.renders.length, 1, 'fresh callback and response render once');
  const originalHtml = f.host.innerHTML;
  await f.context.v110LoadMedia(f.card);
  assert.equal(reads, 2, 'each reopen keeps the shared freshness check');
  assert.equal(f.renders.length, 1, 'unchanged cached response does not rebuild the gallery');
  assert.equal(f.host.innerHTML, originalHtml);
  assert.equal(f.context.v110MediaCache['stay-a::dog-1::exact-key-A'].stayPhotos[0].id, record.stayPhotos[0].id);
});

test('cached media stays visible while refresh runs and failure retains retry access', async () => {
  let fail = false;
  const f = fixture(async (_card, options) => {
    if (fail) throw new Error('offline');
    const record = { dogPhotoGallery: [{ id: 'profile-1' }] };
    options.onFresh({ record });
    return { data: { record } };
  });
  const key = 'stay-a::dog-1::exact-key-A';
  const cached = { dogPhotoGallery: [{ id: 'profile-1' }] };
  await f.context.v110LoadMedia(f.card);
  assert.equal(f.context.v110MediaCache[key].dogPhotoGallery[0].id, cached.dogPhotoGallery[0].id);
  const rendersBeforeFailure = f.renders.length;
  fail = true;
  await f.context.v110LoadMedia(f.card);
  assert.equal(f.renders.length, rendersBeforeFailure, 'the existing cached DOM is not rebuilt');
  assert.equal(f.host.innerHTML.includes('Loading photos'), false);
  assert.match(f.host.innerHTML, /Saved photos are shown; refresh failed/);
  assert.match(f.host.innerHTML, /data-v110-media-retry/);
});

test('cache remains separated by full stay and dog identity', async () => {
  const record = { photos: [] };
  const f = fixture(async (_card, options) => { options.onFresh({ record }); return { data: { record } }; });
  await f.context.v110LoadMedia(f.card);
  f.card.dataset.directoryDogId = 'Dog-2';
  await f.context.v110LoadMedia(f.card);
  assert.equal(f.context.v110MediaCache['stay-a::dog-1::exact-key-A'], record);
  assert.equal(f.context.v110MediaCache['stay-a::dog-2::exact-key-A'], record);
  assert.equal(f.renders.length, 2);
});

test('stale media requests cannot replace the current stay gallery', async () => {
  let resolveOld;
  const f = fixture((card, options) => new Promise(resolve => {
    if (card.dataset.directoryDogId === 'Dog-1') resolveOld = () => { options.onFresh({ record: { photos: [{ id: 'old' }] } }); resolve({ data: { record: { photos: [{ id: 'old' }] } } }); };
    else { const record = { photos: [{ id: 'new' }] }; options.onFresh({ record }); resolve({ data: { record } }); }
  }));
  const oldRequest = f.context.v110LoadMedia(f.card);
  f.card.dataset.directoryDogId = 'Dog-2';
  await f.context.v110LoadMedia(f.card);
  resolveOld();
  await oldRequest;
  assert.equal(f.renders.length, 1);
  assert.equal(f.renders[0].photos[0].id, 'new');
});

test('changed fresh content replaces the cached gallery exactly once', async () => {
  let current = { stayPhotos: [{ id: 'old' }] };
  const f = fixture(async (_card, options) => { options.onFresh({ record: current }); return { data: { record: current } }; });
  await f.context.v110LoadMedia(f.card);
  current = { stayPhotos: [{ id: 'new' }] };
  await f.context.v110LoadMedia(f.card);
  assert.equal(f.renders.length, 2);
  assert.equal(f.renders.at(-1).stayPhotos[0].id, 'new');
});

test('a read that emits valid media before rejecting keeps the rendered gallery and reports refresh failure', async () => {
  const record = { stayPhotos: [{ id: 'usable' }] };
  const f = fixture(async (_card, options) => { options.onFresh({ record }); throw new Error('connection closed'); });
  await f.context.v110LoadMedia(f.card);
  assert.equal(f.renders.length, 1);
  assert.equal(f.host.dataset.v110RenderedMediaIdentity, 'stay-a::dog-1::exact-key-A');
  assert.match(f.host.innerHTML, /Saved photos are shown; refresh failed/);
  assert.match(f.host.innerHTML, /connection closed/);
  assert.match(f.host.innerHTML, /data-v110-media-retry/);
  assert.doesNotMatch(f.host.innerHTML, /Photos could not be loaded/);
});

test('cold media failure keeps the original retry panel and recovery loads the gallery', async () => {
  let unavailable = true;
  const f = fixture(async (_card, options) => {
    if (unavailable) throw new Error('temporary outage');
    const record = { stayPhotos: [{ id: 'recovered' }] };
    options.onFresh({ record });
    return { data: { record } };
  });
  await f.context.v110LoadMedia(f.card);
  assert.match(f.host.innerHTML, /Photos could not be loaded/);
  assert.match(f.host.innerHTML, /temporary outage/);
  assert.match(f.host.innerHTML, /data-v110-media-retry/);
  unavailable = false;
  await f.context.v110LoadMedia(f.card, { force: true });
  assert.equal(f.renders.length, 1);
  assert.equal(f.renders[0].stayPhotos[0].id, 'recovered');
});
