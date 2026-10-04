const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');

function extractFunction(name) {
  let start = source.indexOf(`async function ${name}(`);
  if (start < 0) start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function harness() {
  const present = { checked: false };
  const description = { value: '' };
  const status = { textContent: '', className: '' };
  const save = { disabled: true };
  const discard = { hidden: true, disabled: false };
  const photoLabel = { value: '' };
  const card = {
    dataset: { stayKey: 'stay-a', directoryStayKey: 'stay-a', dogName: 'Milo' },
    querySelector(selector) {
      if (selector === '[data-belongings-item-present="blankets"]') return present;
      if (selector === '[data-belongings-item-description="blankets"]') return description;
      if (selector === '[data-belongings-edit-status]') return status;
      if (selector === '[data-save-belongings]') return save;
      if (selector === '[data-discard-belongings-draft]') return discard;
      if (selector === '[data-belongings-photo-label]') return photoLabel;
      return null;
    },
    querySelectorAll: () => [present, description]
  };
  const context = {
    BELONGINGS_ITEMS: [{ key: 'blankets' }],
    belongingsItemDrafts: new Map(),
    document: { querySelectorAll: () => [card] },
    directoryProfileEditKey: c => c.dataset.directoryStayKey,
    getDirectoryProfileEditIdentity: () => ({ breed: 'mutt', ownerName: 'owner', phone: '123' }),
    directoryProfileEditIdentityConflicts: (a, b) => ['breed', 'ownerName', 'phone'].some(key => a?.[key] && b?.[key] && a[key] !== b[key]),
    collectBelongingsItems: () => ({ blankets: { present: present.checked, description: description.value } })
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunction('belongingsItemsEqual'),
    extractFunction('updateBelongingsItemDraftFeedback'),
    extractFunction('restoreBelongingsItemDraft'),
    extractFunction('handleBelongingsItemDraftInput')
  ].join('\n'), context);
  return { context, card, present, description, photoLabel, status, save, discard };
}

test('same-stay refresh restores dirty belongings and keeps switch-away work keyed to its stay', () => {
  const h = harness();
  h.context.restoreBelongingsItemDraft(h.card, { blankets: { present: false, description: '' } });
  h.present.checked = true;
  h.description.value = 'Blue fleece';
  h.context.belongingsItemDrafts.get('stay-a').values = { blankets: { present: true, description: 'Blue fleece' } };
  h.card.dataset.stayKey = 'stay-b';
  h.card.dataset.directoryStayKey = 'stay-b';
  h.context.restoreBelongingsItemDraft(h.card, { blankets: { present: false, description: 'Stored for B' } });
  assert.equal(h.present.checked, false);
  assert.equal(h.description.value, 'Stored for B');
  h.card.dataset.stayKey = 'stay-a';
  h.card.dataset.directoryStayKey = 'stay-a';
  h.context.restoreBelongingsItemDraft(h.card, { blankets: { present: false, description: '' } });
  assert.equal(h.present.checked, true);
  assert.equal(h.description.value, 'Blue fleece');
  assert.match(h.status.textContent, /Unsaved belongings changes/);
  assert.equal(h.save.disabled, false);
});

test('duplicate stay retains visible draft and blocks save with clear conflict feedback', () => {
  const h = harness();
  h.context.restoreBelongingsItemDraft(h.card, { blankets: { present: false, description: '' } });
  const state = h.context.belongingsItemDrafts.get('stay-a');
  state.values = { blankets: { present: true, description: 'Blue fleece' } };
  h.context.document.querySelectorAll = () => [h.card, { dataset: { directoryStayKey: 'stay-a' } }];
  h.context.restoreBelongingsItemDraft(h.card, { blankets: { present: false, description: '' } });
  assert.equal(h.present.checked, true);
  assert.equal(h.description.value, 'Blue fleece');
  assert.equal(h.save.disabled, true);
  assert.match(h.status.textContent, /ambiguous/);
  assert.equal(h.discard.hidden, false);
});

test('photo note is restored in memory across refresh without enabling the checklist Save action', () => {
  const h = harness();
  h.context.restoreBelongingsItemDraft(h.card, { blankets: { present: false, description: '' } });
  h.photoLabel.closest = () => h.card;
  h.photoLabel.value = 'Winter kit';
  h.context.handleBelongingsItemDraftInput({ target: { closest: () => h.photoLabel } });
  h.photoLabel.value = '';
  h.context.restoreBelongingsItemDraft(h.card, { blankets: { present: false, description: '' } });
  assert.equal(h.photoLabel.value, 'Winter kit');
  assert.match(h.status.textContent, /Photo note ready for your next upload/);
  assert.equal(h.save.disabled, true);
  assert.equal(h.discard.hidden, false);
});

function saveHarness(send) {
  const control = { disabled: false };
  const status = { textContent: '', className: '' };
  const save = { disabled: false };
  const discard = { hidden: false, disabled: false };
  const card = {
    dataset: { stayKey: 'stay-a', directoryStayKey: 'stay-a' },
    classList: { contains: () => false },
    querySelector(selector) {
      if (selector === '[data-belongings-edit-status]') return status;
      if (selector === '[data-save-belongings]') return save;
      if (selector === '[data-discard-belongings-draft]') return discard;
      return null;
    },
    querySelectorAll: () => [control]
  };
  const state = { initial: { blankets: { present: false, description: '' } }, values: { blankets: { present: true, description: 'Blue fleece' } }, photoLabel: '', initialPhotoLabel: '', identity: { breed: 'mutt', ownerName: 'owner', phone: '123' }, conflict: false, failed: false, saving: false };
  const calls = [];
  const context = {
    belongingsItemDrafts: new Map([['stay-a', state]]),
    directoryProfileEditDrafts: new Map(),
    directoryProfileEditKey: c => c.dataset.directoryStayKey,
    directoryProfileEditIdentityConflicts: () => false,
    getDirectoryProfileEditIdentity: () => ({ breed: 'mutt', ownerName: 'owner', phone: '123' }),
    directoryProfileEditIsDirty: () => false,
    document: { querySelectorAll: () => [card] },
    collectBelongingsItems: () => ({ blankets: { present: true, description: 'Blue fleece' } }),
    belongingsItemsEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    updateBelongingsItemDraftFeedback(target, message) {
      const dirty = !context.belongingsItemsEqual(context.collectBelongingsItems(target), state.initial);
      control.disabled = state.saving || state.conflict;
      save.disabled = state.saving || state.conflict || !dirty;
      status.textContent = message || (state.failed ? state.failureMessage : state.saving ? 'Saving belongings…' : dirty ? 'Unsaved belongings changes.' : 'No unsaved belongings changes.');
    },
    getBelongingsCardPayload: () => ({ stayKey: 'stay-a', dogName: 'Milo', startDate: '2026-10-01', endDate: '2026-10-04', items: context.collectBelongingsItems(card), riskFlags: {} }),
    sendPayloadToAppsScript: async payload => { calls.push(payload); return send(); },
    belongingsRecordsCache: {}, careRiskRecordsCache: {}, directoryBelongingsDetailCache: {}, directoryProfileDetailCache: {},
    renderDirectoryCareBrief() {}, renderCareRiskDashboard() {}, getCurrentBoardingStays: () => [],
    localStorage: { getItem: () => '' }, invalidateWaffleClientCaches: async () => {}, setDirectoryProfileEditMode() {}, setTimeout() {}, console: { error() {} }
  };
  const button = { disabled: false, innerText: 'Save Belongings', closest: () => null };
  vm.createContext(context);
  vm.runInContext(`${extractFunction('saveBelongingsCard')}\nthis.save = saveBelongingsCard;`, context);
  return { context, state, card, control, status, button, calls };
}

test('failed belongings save locks checklist during request and retains an editable draft', async () => {
  let rejectSave;
  const h = saveHarness(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
  const saving = h.context.save(h.card, h.button);
  await Promise.resolve();
  assert.equal(h.control.disabled, true);
  assert.equal(h.state.saving, true);
  rejectSave(new Error('fixture rejection'));
  await saving;
  assert.equal(h.control.disabled, false);
  assert.equal(h.state.failed, true);
  assert.equal(h.state.initial.blankets.description, '');
  assert.match(h.status.textContent, /Your draft is still here/);
});

test('successful belongings save advances baseline and keeps later edits saveable with unchanged payload keys', async () => {
  const h = saveHarness(async () => ({}));
  await h.context.save(h.card, h.button);
  assert.deepEqual(Object.keys(h.calls[0]).sort(), ['action', 'dogName', 'endDate', 'items', 'riskFlags', 'startDate', 'stayKey']);
  assert.equal(h.state.initial.blankets.description, 'Blue fleece');
  h.context.collectBelongingsItems = () => ({ blankets: { present: true, description: 'Red blanket' } });
  await h.context.save(h.card, h.button);
  assert.equal(h.calls.length, 2);
  assert.equal(h.state.initial.blankets.description, 'Red blanket');
});

function hostedCheckHarness(responses) {
  const status = { textContent: '' };
  const button = { hidden: false, disabled: false };
  const card = {
    dataset: { stayKey: 'stay-a', directoryStayKey: 'stay-a' },
    querySelector: selector => selector === '[data-belongings-photo-status]' ? status : selector === '[data-confirm-hosted-photo]' ? button : null
  };
  const requests = [];
  let closed = false;
  const context = {
    hostedPendingPhotoConfirmations: new Map([['stay-a', {
      stayKey: 'stay-a', photoType: 'belongings', identity: { breed: 'mutt', ownerName: 'owner', phone: '123' },
      previousPhotoIds: ['old-photo'], previousPhotoCount: 1, expectedCount: 1, expectedPhotoIds: ['new-photo']
    }]]),
    hostedBelongingsPhotoContext: null,
    directoryProfileEditKey: candidate => candidate.dataset.directoryStayKey,
    directoryProfileEditIdentityConflicts: () => false,
    getDirectoryProfileEditIdentity: () => ({ breed: 'mutt', ownerName: 'owner', phone: '123' }),
    document: { querySelectorAll: () => [card] },
    async queryAppsScript(payload) { requests.push(payload); return { records: [responses.shift()] }; },
    belongingsRecordsCache: {}, careRiskRecordsCache: {}, directoryPhotoRecordsCache: {},
    directoryBelongingsDetailCache: {}, directoryProfileDetailCache: {}, directorySummaryRecordsCache: {},
    setDirectoryDogPhoto() {}, setDirectoryCareFlags() {}, renderDirectoryOperationalSections() {},
    closeHostedBelongingsPhotoUploader() { closed = true; }, console: { error() {} }
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunction('checkHostedBelongingsPhotoConfirmation')}\nthis.check = checkHostedBelongingsPhotoConfirmation;`, context);
  return { context, card, status, button, requests, closed: () => closed };
}

test('hosted uncertain upload survives modal close, ignores old and unrelated photos, and checks read-only until exact new evidence appears', async () => {
  const h = hostedCheckHarness([
    { stayKey: 'stay-a', photos: [{ id: 'old-photo' }] },
    { stayKey: 'stay-a', photos: [{ id: 'old-photo' }, { id: 'other-new-photo' }] },
    { stayKey: 'stay-a', photos: [{ id: 'old-photo' }, { id: 'new-photo' }] }
  ]);
  for (let i = 0; i < 2; i++) {
    await h.context.check(h.card);
    assert.equal(h.context.hostedPendingPhotoConfirmations.has('stay-a'), true);
    assert.equal(h.closed(), false);
  }
  assert.match(h.status.textContent, /does not show the newly uploaded photo yet/);
  await h.context.check(h.card);
  assert.equal(h.context.hostedPendingPhotoConfirmations.has('stay-a'), false);
  assert.equal(h.context.belongingsRecordsCache['stay-a'].photos.at(-1).id, 'new-photo');
  assert.equal(h.context.directoryBelongingsDetailCache['stay-a'].photos.at(-1).id, 'new-photo');
  assert.equal(h.closed(), false);
  assert.match(h.status.textContent, /Newly uploaded photo confirmed/);
  assert.equal(h.requests.length, 3);
  assert.deepEqual(h.requests.map(request => request.action), ['get_belongings', 'get_belongings', 'get_belongings']);
});
