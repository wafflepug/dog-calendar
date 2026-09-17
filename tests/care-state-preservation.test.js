const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const captureStart = source.indexOf('function captureDirectoryProfileUiState');
const captureEnd = source.indexOf('    function restoreDirectoryGuestDetailDraft', captureStart);
const restoreStart = source.indexOf('function restoreDirectoryGuestDetailDraft');
const restoreEnd = source.indexOf('    function applyGuestDirectoryResponse', restoreStart);
const saveStart = source.indexOf('async function saveGuestDetailFromEditor');
const saveEnd = source.indexOf('    function routeToDatabaseCell', saveStart);
const identityStart = source.indexOf('    function getDirectoryEditorIdentity');
const identityEnd = source.indexOf('    function restoreDirectoryGuestDetailDraft', identityStart);
const openStart = source.indexOf('    async function openDirectoryGuestProfile');
const closeStart = source.indexOf('    function closeDirectoryGuestProfile', openStart);
assert(captureStart >= 0 && captureEnd > captureStart && restoreStart > captureEnd && restoreEnd > restoreStart && saveStart > 0 && saveEnd > saveStart && identityStart > 0 && identityEnd > identityStart && openStart > 0 && closeStart > openStart);

function makeCard(stayKey, { mainTab = 'profile', secondaryTab = 'overview', desktopTab = 'profile', editing = false } = {}) {
  const card = {
    isConnected: true,
    classList: {
      contains(name) { return name === 'is-profile-editing' && editing; }
    },
    dataset: {
      directoryStayKey: stayKey,
      mainProfileTab: mainTab,
      profileSubTab: secondaryTab,
      v11160ActiveTab: desktopTab,
      profileEditing: editing ? 'true' : 'false'
    },
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector.includes('directory-stay-key')) return [card];
      return [];
    }
  };
  return card;
}

function harness(card, editor = null) {
  const modal = { classList: { contains: () => !!editor, add() {} }, setAttribute() {} };
  const status = { textContent: '', className: '' };
  const save = { disabled: false };
  const sandbox = {
    directorySelectedProfileStayKey: card?.dataset?.directoryStayKey || '',
    activeDirectoryEditContext: editor,
    document: {
      getElementById(id) {
        return id === 'guestDetailEditModal' ? modal : id === 'guestDetailEditStatus' ? status : id === 'saveGuestDetailEdit' ? save : null;
      },
      querySelector(selector) { return selector === '.directory-card.is-profile-active' ? card : null; },
      querySelectorAll(selector) { return selector.includes('directory-stay-key') ? [card] : []; }
    },
    getDirectoryProfileCard: key => card?.dataset?.directoryStayKey === key ? card : null
  };
  vm.runInNewContext(`${source.slice(captureStart, captureEnd)}\n${source.slice(restoreStart, restoreEnd)}\nthis.capture = captureDirectoryProfileUiState; this.restore = restoreDirectoryGuestDetailDraft;`, sandbox);
  return { sandbox, modal, status, save };
}

function saveHarness({ unmatched = false, identityConflict = false, failing = false } = {}) {
  const card = makeCard('milo|2026-09-20|2026-09-22');
  const trigger = {
    isConnected: true,
    dataset: { directoryEditField: 'ownerName', directoryCurrentValue: 'Owner' },
    closest() { return card; }
  };
  card.querySelector = selector => selector.includes('directory-edit-field') ? trigger : null;
  const input = { value: 'Draft owner' };
  const textarea = { value: '', style: {}, placeholder: '' };
  const status = { textContent: '', className: '' };
  const saveButton = { disabled: false, textContent: '' };
  let sends = 0;
  const sandbox = {
    activeDirectoryEditContext: {
      card, trigger, fieldKey: 'ownerName', stayKey: card.dataset.directoryStayKey,
      oldStayKey: card.dataset.directoryStayKey, identity: identityConflict ? { ownerName: 'different owner' } : { ownerName: 'owner' }, unmatched
    },
    DIRECTORY_EDIT_FIELD_CONFIG: { ownerName: { label: 'Owner', multiline: false } },
    directoryIdentityConflicts: (expected, actual) => identityConflict || (expected?.ownerName && actual?.ownerName && expected.ownerName !== actual.ownerName),
    getDirectoryEditorIdentity: () => ({ ownerName: 'owner', breed: '', phone: '' }),
    document: { getElementById(id) { return id === 'guestDetailEditInput' ? input : id === 'guestDetailEditTextarea' ? textarea : id === 'saveGuestDetailEdit' ? saveButton : id === 'cancelGuestDetailEdit' || id === 'closeGuestDetailEditModal' ? { disabled: false } : id === 'guestDetailEditStatus' ? status : null; } },
    sendPayloadToAppsScript: async payload => { sends++; if (failing) throw new Error('fixture save failed'); return { record: { dogName: 'Milo', startDate: '2026-09-20', endDate: '2026-09-22', ownerName: input.value }, fieldLabel: 'Owner' }; },
    patchGuestRecordInCachedCsv() {}, migrateDirectoryClientStayKey() {}, refreshCalendarData() {}, loadCareRiskDashboard: async () => {}, makePotentialKey: () => card.dataset.directoryStayKey,
    localStorage: { getItem: () => '' }, getLocalArray: () => [], setLocalArray() {}, console: { error() {} }, setTimeout: fn => { fn(); return 1; }
  };
  vm.runInNewContext(`${source.slice(identityStart, identityEnd)}\n${source.slice(saveStart, saveEnd)}\nthis.save = saveGuestDetailFromEditor;`, sandbox);
  return { sandbox, input, status, saveButton, get sends() { return sends; } };
}

function openHarness({ active = false } = {}) {
  const calls = [];
  const card = makeCard('milo|2026-09-20|2026-09-22', { mainTab: active ? 'belongings' : 'profile', editing: active });
  let profileActive = active;
  card.classList.contains = name => name === 'is-profile-active' ? profileActive : name === 'is-profile-editing' && active;
  card.classList.add = name => { if (name === 'is-profile-active') profileActive = true; };
  card.classList.remove = name => { if (name === 'is-profile-active') profileActive = false; };
  const dashboard = { classList: { add() {}, remove() {} }, scrollIntoView() {} };
  const sandbox = {
    directorySelectedProfileStayKey: '',
    document: {
      querySelectorAll() { return []; },
      querySelector() { return dashboard; },
      getElementById(id) { return id === 'directoryProfileBackBar' ? { hidden: true } : id === 'directoryProfileBreadcrumbName' ? { textContent: '' } : null; }
    },
    setDirectoryProfileEditMode: (_card, editing) => calls.push(['edit', editing]),
    switchDirectoryProfileMainTab: (_card, tab) => calls.push(['main', tab]),
    switchDirectoryProfileSubTab: (_card, tab) => calls.push(['secondary', tab]),
    loadDirectoryProfileDetail: async () => {},
    restoreDirectoryGuestDetailDraft() {},
    globalCalendar: null
  };
  vm.runInNewContext(`${source.slice(openStart, closeStart)}\nthis.open = openDirectoryGuestProfile;`, sandbox);
  return { sandbox, card, calls };
}

test('captures exact selected stay and all Care tab/edit state', () => {
  const card = makeCard('milo|2026-09-20|2026-09-22', { mainTab: 'belongings', secondaryTab: 'healthHome', desktopTab: 'media', editing: true });
  const h = harness(card, { fieldKey: 'ownerName', oldStayKey: card.dataset.directoryStayKey });
  assert.deepEqual(JSON.parse(JSON.stringify(h.sandbox.capture())), {
    stayKey: card.dataset.directoryStayKey,
    mainTab: 'belongings',
    secondaryTab: 'healthHome',
    desktopTab: 'media',
    editing: true,
    editor: {
      stayKey: card.dataset.directoryStayKey,
      fieldKey: 'ownerName',
      originalDogName: '',
      startDate: '',
      endDate: '',
      oldStayKey: card.dataset.directoryStayKey,
      identity: { breed: '', ownerName: '', phone: '' }
    }
  });
});

test('unmatched edited stay disables save and keeps an explicit cancel path', () => {
  const oldCard = makeCard('milo|2026-09-20|2026-09-22');
  const h = harness(oldCard, { fieldKey: 'ownerName', stayKey: oldCard.dataset.directoryStayKey, oldStayKey: oldCard.dataset.directoryStayKey });
  const state = { stayKey: oldCard.dataset.directoryStayKey, editor: { fieldKey: 'ownerName', stayKey: oldCard.dataset.directoryStayKey, oldStayKey: oldCard.dataset.directoryStayKey } };
  h.sandbox.restore(state, makeCard('other|2026-09-20|2026-09-22'));
  assert.equal(h.sandbox.activeDirectoryEditContext.unmatched, true);
  assert.equal(h.save.disabled, true);
  assert.match(h.status.textContent, /Cancel this draft/);
});

test('state policy uses exact stay keys and does not match duplicate names', () => {
  const first = makeCard('same-name|2026-09-20|2026-09-22');
  const h = harness(first);
  h.sandbox.directorySelectedProfileStayKey = 'same-name|2026-09-20|2026-09-23';
  assert.equal(h.sandbox.capture().stayKey, 'same-name|2026-09-20|2026-09-23');
});

test('duplicate legacy stay keys retain the draft but block rebinding', () => {
  const card = makeCard('same-name|2026-09-20|2026-09-22');
  const h = harness(card, { fieldKey: 'ownerName', stayKey: card.dataset.directoryStayKey, oldStayKey: card.dataset.directoryStayKey, identity: { ownerName: 'first owner' } });
  const duplicate = makeCard(card.dataset.directoryStayKey);
  h.sandbox.document.querySelectorAll = selector => selector.includes('directory-stay-key') ? [card, duplicate] : [];
  const state = h.sandbox.capture();
  assert.equal(state.ambiguous, true);
  assert.ok(state.editor);
  h.sandbox.restore(state, duplicate);
  assert.equal(h.sandbox.activeDirectoryEditContext.unmatched, true);
  assert.equal(h.save.disabled, true);
});

test('production open path defaults new dogs and preserves an already visited card', async () => {
  const fresh = openHarness();
  await fresh.sandbox.open(fresh.card, { instant: true });
  assert.deepEqual(fresh.calls.slice(0, 3), [['edit', false], ['main', 'profile'], ['secondary', 'overview']]);

  const reopened = openHarness({ active: true });
  await reopened.sandbox.open(reopened.card, { instant: true });
  assert.deepEqual(reopened.calls.slice(0, 3), [['edit', true], ['main', 'belongings'], ['secondary', 'overview']]);
});

test('pre-save guard blocks an unmatched draft before any mutation', async () => {
  const h = saveHarness({ unmatched: true });
  await h.sandbox.save();
  assert.equal(h.sends, 0);
  assert.match(h.status.textContent, /Cancel this draft/);
  assert.equal(h.input.value, 'Draft owner');
});

test('successful save uses the existing mutation once and keeps the draft on failure', async () => {
  const success = saveHarness();
  await success.sandbox.save();
  assert.equal(success.sends, 1);

  const failed = saveHarness({ failing: true });
  await failed.sandbox.save();
  assert.equal(failed.sends, 1);
  assert.equal(failed.input.value, 'Draft owner');
  assert.match(failed.status.textContent, /fixture save failed/);
});
