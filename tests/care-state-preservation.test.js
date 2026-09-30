const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');
for (const page of ['index.html', 'directory.html']) {
  const html = fs.readFileSync(page, 'utf8');
  test(`${page} exposes the Care editor status and Discard action`, () => {
    assert.match(html, /id="guestDetailEditStatus"[^>]*role="status"[^>]*aria-live="polite"/);
    assert.match(html, /id="cancelGuestDetailEdit"[^>]*>Discard<\/button>/);
  });
}
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
const editorStart = source.indexOf('    function openGuestDetailEditor');
const editorEnd = source.indexOf('    function decodeDirectoryCsvCell', editorStart);
const closeEditorStart = source.indexOf('    function closeGuestDetailEditor');
assert(captureStart >= 0 && captureEnd > captureStart && restoreStart > captureEnd && restoreEnd > restoreStart && saveStart > 0 && saveEnd > saveStart && identityStart > 0 && identityEnd > identityStart && openStart > 0 && closeStart > openStart && closeEditorStart > 0 && editorStart > closeEditorStart && editorEnd > editorStart);

function makeCard(stayKey, { mainTab = 'profile', secondaryTab = 'overview', secondaryTabs = '', desktopTab = 'profile', editing = false } = {}) {
  const card = {
    isConnected: true,
    classList: {
      contains(name) { return name === 'is-profile-editing' && editing; }
    },
    dataset: {
      directoryStayKey: stayKey,
      mainProfileTab: mainTab,
      profileSubTab: secondaryTab,
      ...(secondaryTabs ? { profileSubTabs: secondaryTabs } : {}),
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
  const input = { value: '' };
  const textarea = { value: '' };
  const sandbox = {
    directorySelectedProfileStayKey: card?.dataset?.directoryStayKey || '',
    activeDirectoryEditContext: editor,
    DIRECTORY_EDIT_FIELD_CONFIG: { ownerName: { label: 'Owner', multiline: false } },
    getGuestDetailEditorValue: () => input.value,
    document: {
      getElementById(id) {
        return id === 'guestDetailEditModal' ? modal : id === 'guestDetailEditStatus' ? status : id === 'saveGuestDetailEdit' ? save : id === 'guestDetailEditInput' ? input : id === 'guestDetailEditTextarea' ? textarea : null;
      },
      querySelector(selector) { return selector === '.directory-card.is-profile-active' ? card : null; },
      querySelectorAll(selector) { return selector.includes('directory-stay-key') ? [card] : []; }
    },
    getDirectoryProfileCard: key => card?.dataset?.directoryStayKey === key ? card : null
  };
  vm.runInNewContext(`${source.slice(captureStart, captureEnd)}\n${source.slice(restoreStart, restoreEnd)}\nthis.capture = captureDirectoryProfileUiState; this.restore = restoreDirectoryGuestDetailDraft;`, sandbox);
  return { sandbox, modal, status, save, input, textarea };
}

function saveHarness({ unmatched = false, identityConflict = false, failing = false, deferred = false } = {}) {
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
  let finishSend;
  let lastPayload;
  const sandbox = {
    activeDirectoryEditContext: {
      card, trigger, fieldKey: 'ownerName', stayKey: card.dataset.directoryStayKey,
      originalDogName: 'Milo', startDate: '2026-09-20', endDate: '2026-09-22',
      oldStayKey: card.dataset.directoryStayKey, identity: identityConflict ? { ownerName: 'different owner' } : { ownerName: 'owner' }, unmatched
    },
    DIRECTORY_EDIT_FIELD_CONFIG: { ownerName: { label: 'Owner', multiline: false } },
    directoryIdentityConflicts: (expected, actual) => identityConflict || (expected?.ownerName && actual?.ownerName && expected.ownerName !== actual.ownerName),
    getDirectoryEditorIdentity: () => ({ ownerName: 'owner', breed: '', phone: '' }),
    document: { getElementById(id) { return id === 'guestDetailEditInput' ? input : id === 'guestDetailEditTextarea' ? textarea : id === 'saveGuestDetailEdit' ? saveButton : id === 'cancelGuestDetailEdit' || id === 'closeGuestDetailEditModal' ? { disabled: false } : id === 'guestDetailEditStatus' ? status : null; }, querySelectorAll(selector) { return selector.includes('directory-stay-key') ? [card] : []; } },
    sendPayloadToAppsScript: async payload => { sends++; lastPayload = payload; if (deferred) await new Promise(resolve => { finishSend = resolve; }); if (failing) throw new Error('fixture save failed'); return { record: { dogName: 'Milo', startDate: '2026-09-20', endDate: '2026-09-22', ownerName: payload.value }, fieldLabel: 'Owner' }; },
    patchGuestRecordInCachedCsv() {}, migrateDirectoryClientStayKey() {}, refreshCalendarData() {}, loadCareRiskDashboard: async () => {}, makePotentialKey: () => card.dataset.directoryStayKey,
    localStorage: { getItem: () => '' }, getLocalArray: () => [], setLocalArray() {}, console: { error() {} }, setTimeout: () => 1
  };
  vm.runInNewContext(`${source.slice(identityStart, identityEnd)}\n${source.slice(saveStart, saveEnd)}\nthis.save = saveGuestDetailFromEditor;`, sandbox);
  return { sandbox, input, status, saveButton, finishSend: value => finishSend(value), get lastPayload() { return lastPayload; }, get sends() { return sends; } };
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

function editorHarness() {
  const key = 'same-name|2026-09-20|2026-09-22';
  const card = makeCard(key);
  const duplicate = makeCard(key);
  const trigger = { dataset: { directoryEditField: 'ownerName', directoryCurrentValue: 'Draft owner' }, closest: () => card };
  let modalOpen = false;
  const modal = { classList: { add() { modalOpen = true; }, remove() { modalOpen = false; }, contains(name) { return name === 'open' && modalOpen; } }, setAttribute() {} };
  const elements = {
    guestDetailEditTitle: { textContent: '' }, guestDetailEditDog: { textContent: '' }, guestDetailEditLabel: { textContent: '' },
    guestDetailEditInput: { style: {}, focus() {}, select() {} }, guestDetailEditTextarea: { style: {}, focus() {} },
    guestDetailEditStatus: { textContent: '', className: '' }, guestDetailEditModal: modal, saveGuestDetailEdit: { disabled: false },
    cancelGuestDetailEdit: { disabled: false }, closeGuestDetailEditModal: { disabled: false }
  };
  const sandbox = {
    activeDirectoryEditContext: null,
    DIRECTORY_EDIT_FIELD_CONFIG: { ownerName: { label: 'Owner', placeholder: 'Owner name', multiline: false } },
    directoryCardsForStayKey: () => [card, duplicate],
    getDirectoryEditorIdentity: () => ({ breed: '', ownerName: 'owner', phone: '' }),
    formatStayDateShort: value => value,
    document: { getElementById: id => elements[id] || null, querySelectorAll: selector => selector.includes('directory-stay-key') ? [card, duplicate] : [] },
    confirm: () => true,
    setTimeout: () => 1
  };
  vm.runInNewContext(`${source.slice(identityStart, identityEnd)}\n${source.slice(closeEditorStart, editorStart)}\n${source.slice(editorStart, editorEnd)}\nthis.openEditor = openGuestDetailEditor; this.closeEditor = closeGuestDetailEditor;`, sandbox);
  return { sandbox, trigger, save: elements.saveGuestDetailEdit, status: elements.guestDetailEditStatus, input: elements.guestDetailEditInput, modal };
}

test('captures exact selected stay and all Care tab/edit state', () => {
  const card = makeCard('milo|2026-09-20|2026-09-22', { mainTab: 'belongings', secondaryTab: 'healthHome', secondaryTabs: 'foodWalks,healthHome', desktopTab: 'media', editing: true });
  const h = harness(card, { fieldKey: 'ownerName', oldStayKey: card.dataset.directoryStayKey, initialValue: 'Original owner', failed: true });
  assert.deepEqual(JSON.parse(JSON.stringify(h.sandbox.capture())), {
    stayKey: card.dataset.directoryStayKey,
    mainTab: 'belongings',
    secondaryTab: 'healthHome',
    secondaryTabs: ['foodWalks', 'healthHome'],
    desktopTab: 'media',
    editing: true,
    editor: {
      stayKey: card.dataset.directoryStayKey,
      fieldKey: 'ownerName',
      draftValue: '',
      initialValue: 'Original owner',
      failed: true,
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
  assert.match(h.status.textContent, /Discard this draft/);
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

test('restored guest editor keeps Save disabled when clean and enables it for a dirty draft', () => {
  const key = 'milo|2026-09-20|2026-09-22';
  const card = makeCard(key);
  const trigger = { dataset: { directoryEditField: 'ownerName', directoryCurrentValue: 'Owner' } };
  card.querySelectorAll = selector => selector.includes('directory-edit-field') ? [trigger] : [];
  const h = harness(card);
  h.sandbox.DIRECTORY_EDIT_FIELD_CONFIG = { ownerName: { label: 'Owner', multiline: false } };
  h.sandbox.getDirectoryEditorIdentity = () => ({ breed: '', ownerName: 'owner', phone: '' });
  const state = { editor: {
    stayKey: key, oldStayKey: key, fieldKey: 'ownerName', initialValue: 'Owner',
    identity: { breed: '', ownerName: 'owner', phone: '' }
  } };

  h.input.value = 'Owner';
  h.sandbox.restore(state, card);
  assert.equal(h.save.disabled, true);
  assert.equal(h.status.textContent, 'No unsaved changes.');

  h.input.value = 'Draft owner';
  h.sandbox.restore(state, card);
  assert.equal(h.save.disabled, false);
  assert.equal(h.status.textContent, 'Unsaved changes.');
  assert.equal(h.input.value, 'Draft owner');
});

test('refresh restoration restores the typed value and gives failed and saved drafts explicit status', () => {
  const key = 'milo|2026-09-20|2026-09-22';
  const card = makeCard(key);
  const trigger = { dataset: { directoryEditField: 'ownerName', directoryCurrentValue: 'Owner' } };
  card.querySelectorAll = selector => selector.includes('directory-edit-field') ? [trigger] : [];
  const h = harness(card);
  h.sandbox.DIRECTORY_EDIT_FIELD_CONFIG = { ownerName: { label: 'Owner', multiline: false } };
  h.sandbox.getDirectoryEditorIdentity = () => ({ breed: '', ownerName: 'owner', phone: '' });

  h.input.value = 'Typed draft';
  h.sandbox.activeDirectoryEditContext = {
    fieldKey: 'ownerName', stayKey: key, oldStayKey: key, initialValue: 'Owner',
    identity: { breed: '', ownerName: 'owner', phone: '' }, failed: true
  };
  const failedState = { editor: { ...h.sandbox.activeDirectoryEditContext, draftValue: 'Typed draft' } };
  h.input.value = 'stale control value';
  h.sandbox.restore(failedState, card);
  assert.equal(h.input.value, 'Typed draft');
  assert.equal(h.status.textContent, 'Save failed. Your draft is still here. Try saving again or discard it.');
  assert.equal(h.save.disabled, false);

  h.sandbox.restore({ editor: { ...failedState.editor, failed: false, saved: true, draftValue: 'Saved value' } }, card);
  assert.equal(h.input.value, 'Saved value');
  assert.equal(h.status.textContent, 'Your changes were saved and synced.');
  assert.equal(h.save.disabled, true);
});

test('production open path defaults new dogs and preserves an already visited card', async () => {
  const fresh = openHarness();
  await fresh.sandbox.open(fresh.card, { instant: true });
  assert.deepEqual(fresh.calls.slice(0, 3), [['edit', false], ['main', 'profile'], ['secondary', 'overview']]);

  const reopened = openHarness({ active: true });
  await reopened.sandbox.open(reopened.card, { instant: true });
  assert.deepEqual(reopened.calls.slice(0, 3), [['edit', true], ['main', 'belongings'], ['secondary', 'overview']]);

  const visited = openHarness();
  visited.card.dataset.profileVisited = 'true';
  visited.card.dataset.mainProfileTab = 'belongings';
  visited.card.dataset.profileEditing = 'true';
  await visited.sandbox.open(visited.card, { instant: true });
  assert.deepEqual(visited.calls.slice(0, 3), [['edit', true], ['main', 'belongings'], ['secondary', 'overview']]);
});

test('restored desktop lazy panel load flag is consumed once', () => {
  const care = fs.readFileSync('care.js', 'utf8');
  const start = care.indexOf('function consumeRestoredDesktopTabLoad');
  const end = care.indexOf('\n  function ', start + 10);
  const sandbox = { card: { dataset: { v11160RestoreLoad: 'true' } } };
  vm.runInNewContext(`${care.slice(start, end)}\nthis.consume = consumeRestoredDesktopTabLoad;`, sandbox);
  assert.equal(sandbox.consume(sandbox.card), true);
  assert.equal(sandbox.card.dataset.v11160RestoreLoad, undefined);
  assert.equal(sandbox.consume(sandbox.card), false);
});

test('desktop preparation loads the restored selected panel once and no other panel', () => {
  const care = fs.readFileSync('care.js', 'utf8');
  const consumeStart = care.indexOf('function consumeRestoredDesktopTabLoad');
  const consumeEnd = care.indexOf('\n  function ', consumeStart + 10);
  const prepareStart = care.indexOf('function prepareCard');
  const prepareEnd = care.indexOf('function teardownCard', prepareStart);
  const calls = [];
  const card = { dataset: { v11160ActiveTab: 'media', v11160RestoreLoad: 'true' }, classList: { add() {} } };
  const sandbox = {
    TAB_KEYS: new Set(['profile', 'belongings', 'history', 'media', 'master']),
    isDesktopCare: () => true, contentHost: () => ({}), ensurePanels: () => true,
    oldTabs: () => null, buildNav() {}, selectedFromLegacy: () => 'profile',
    select: (_card, key, options) => calls.push({ key, load: options.load })
  };
  vm.runInNewContext(`${care.slice(consumeStart, consumeEnd)}\n${care.slice(prepareStart, prepareEnd)}\nthis.prepare = prepareCard;`, sandbox);
  sandbox.prepare(card);
  sandbox.prepare(card);
  assert.deepEqual(calls, [{ key: 'media', load: true }, { key: 'media', load: false }]);
});

test('direct editor opening on duplicate legacy keys disables Save', () => {
  const h = editorHarness();
  h.sandbox.openEditor(h.trigger);
  assert.equal(h.sandbox.activeDirectoryEditContext.unmatched, true);
  assert.equal(h.save.disabled, true);
  assert.match(h.status.textContent, /ambiguous/);
});

test('opening a valid editor after a blocked draft starts clean and enables Save after edits', () => {
  const h = editorHarness();
  h.sandbox.openEditor(h.trigger);
  assert.equal(h.save.disabled, true);
  const card = h.trigger.closest('.directory-card');
  h.sandbox.document.querySelectorAll = () => [card];
  h.sandbox.openEditor(h.trigger);
  assert.equal(h.sandbox.activeDirectoryEditContext.unmatched, false);
  assert.equal(h.save.disabled, true);
  assert.equal(h.status.textContent, 'No unsaved changes.');
  h.input.value = 'Updated owner';
  h.input.oninput();
  assert.equal(h.save.disabled, false);
  assert.equal(h.status.textContent, 'Unsaved changes.');
});

test('clean editor becomes unsaved on input and asks before discarding only a dirty draft', () => {
  const h = editorHarness();
  h.sandbox.document.querySelectorAll = () => [h.trigger.closest('.directory-card')];
  h.sandbox.openEditor(h.trigger);
  assert.equal(h.save.disabled, true);
  assert.equal(h.status.className, 'guest-detail-edit-status is-clean');
  let confirmations = 0;
  h.sandbox.confirm = () => { confirmations++; return false; };
  h.sandbox.closeEditor();
  assert.equal(confirmations, 0);
  assert.equal(h.modal.classList.contains('open'), false);
  const dirty = editorHarness();
  dirty.sandbox.document.querySelectorAll = () => [dirty.trigger.closest('.directory-card')];
  dirty.sandbox.openEditor(dirty.trigger);
  dirty.input.value = 'Changed owner';
  dirty.input.oninput();
  assert.equal(dirty.status.textContent, 'Unsaved changes.');
  assert.equal(dirty.save.disabled, false);
  dirty.sandbox.confirm = () => { confirmations++; return false; };
  dirty.sandbox.closeEditor();
  assert.equal(confirmations, 1);
  assert.equal(dirty.sandbox.activeDirectoryEditContext !== null, true);
});

test('repeated refresh cannot rebind a draft to conflicting owner evidence', () => {
  const key = 'milo|2026-09-20|2026-09-22';
  const original = makeCard(key);
  original.querySelector = selector => selector.includes('directory-edit-field="ownerName"')
    ? { dataset: { directoryCurrentValue: 'Alice' } }
    : null;
  const h = harness(original, { fieldKey: 'ownerName', stayKey: key, oldStayKey: key, identity: { breed: '', ownerName: 'alice', phone: '' } });
  const replacement = makeCard(key);
  replacement.querySelector = selector => selector.includes('directory-edit-field')
    ? { dataset: { directoryEditField: 'ownerName', directoryCurrentValue: 'Bob' } }
    : null;
  replacement.querySelectorAll = selector => selector.includes('directory-edit-field')
    ? [{ dataset: { directoryEditField: 'ownerName', directoryCurrentValue: 'Bob' } }]
    : [];
  h.sandbox.document.querySelectorAll = selector => selector.includes('directory-stay-key') ? [replacement] : [];
  const state = { stayKey: key, editor: { fieldKey: 'ownerName', stayKey: key, oldStayKey: key, identity: { breed: '', ownerName: 'alice', phone: '' } } };
  h.sandbox.restore(state, replacement);
  assert.equal(h.sandbox.activeDirectoryEditContext.unmatched, true);
  assert.equal(h.save.disabled, true);
  assert.match(h.status.textContent, /different owner/);
});

test('pre-save guard blocks an unmatched draft before any mutation', async () => {
  const h = saveHarness({ unmatched: true });
  await h.sandbox.save();
  assert.equal(h.sends, 0);
  assert.match(h.status.textContent, /Discard this draft/);
  assert.equal(h.input.value, 'Draft owner');
});

test('identity conflict keeps the exact draft and blocks a write', async () => {
  const h = saveHarness({ identityConflict: true });
  await h.sandbox.save();
  assert.equal(h.sends, 0);
  assert.equal(h.input.value, 'Draft owner');
  assert.equal(h.saveButton.disabled, true);
  assert.match(h.status.textContent, /different owner/);
});

test('in-flight save disables draft controls and success keeps saved feedback', async () => {
  const h = saveHarness({ deferred: true });
  const saving = h.sandbox.save();
  await Promise.resolve();
  assert.equal(h.input.disabled, true);
  assert.equal(h.status.textContent, 'Saving to the shared Google Sheet...');
  h.finishSend({});
  await saving;
  assert.equal(h.status.className, 'guest-detail-edit-status is-success');
  assert.match(h.status.textContent, /saved and synced/);
});

test('successful save uses the existing mutation once and keeps the draft on failure', async () => {
  const success = saveHarness();
  await success.sandbox.save();
  assert.equal(success.sends, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(success.lastPayload)), {
    action: 'update_guest_detail', fieldKey: 'ownerName', value: 'Draft owner',
    originalDogName: 'Milo', startDate: '2026-09-20', endDate: '2026-09-22'
  });

  const failed = saveHarness({ failing: true });
  await failed.sandbox.save();
  assert.equal(failed.sends, 1);
  assert.equal(failed.input.value, 'Draft owner');
  assert.match(failed.status.textContent, /Save failed.*fixture save failed/);
  assert.equal(failed.saveButton.disabled, false);
});
