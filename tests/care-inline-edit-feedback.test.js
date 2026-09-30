const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const helperStart = source.indexOf('function directoryProfileEditKey');
const helperEnd = source.indexOf('function setDirectoryProfileEditMode', helperStart);
const saveStart = source.indexOf('async function saveBelongingsCard');
const saveEnd = source.indexOf('    function makeHostedPhotoRequestToken', saveStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart && saveStart >= 0 && saveEnd > saveStart);

function makeProfileHarness({ count = 1, values = { 'data-intake-attribute': 'notes', value: 'Saved note' } } = {}) {
  const control = {
    dataset: values['data-intake-attribute']
      ? { intakeAttribute: values['data-intake-attribute'] }
      : { careRiskFlag: values['data-care-risk-flag'] },
    value: values.value ?? '',
    checked: !!values.checked,
    disabled: false
  };
  const status = { textContent: '', className: '' };
  const save = { disabled: true };
  const card = {
    dataset: { directoryStayKey: 'milo|2026-09-20|2026-09-22' },
    classList: { contains: name => name === 'is-profile-editing' },
    querySelectorAll: () => [control],
    querySelector(selector) {
      if (selector === '[data-directory-profile-edit-status]') return status;
      if (selector === '[data-save-belongings]') return save;
      return null;
    }
  };
  const sandbox = {
    directoryProfileEditDrafts: new Map(),
    document: { querySelectorAll: () => Array.from({ length: count }, () => card) },
    directoryProfileEditIdentityConflicts: () => false,
    getDirectoryProfileEditIdentity: () => ({ breed: 'mutt', ownerName: 'owner', phone: '123' })
  };
  vm.runInNewContext(`${source.slice(helperStart, helperEnd)}\nthis.restore = restoreDirectoryProfileEditDraft; this.feedback = updateDirectoryProfileEditFeedback;`, sandbox);
  return { sandbox, card, control, status, save };
}

test('inline Care refresh restores typed values and marks clean or dirty state clearly', () => {
  const h = makeProfileHarness();
  h.sandbox.directoryProfileEditDrafts.set(h.card.dataset.directoryStayKey, {
    initial: { 'intake:notes': 'Saved note' },
    values: { 'intake:notes': 'Typed draft' },
    identity: { breed: 'mutt', ownerName: 'owner', phone: '123' },
    initialized: true,
    conflict: false, failed: false, saving: false
  });

  h.sandbox.restore(h.card, { checkConflict: true });
  assert.equal(h.control.value, 'Typed draft');
  assert.equal(h.status.textContent, 'Unsaved changes.');
  assert.equal(h.save.disabled, false);
});

test('inline Care refresh conflict and duplicate stays retain the draft and block Save', () => {
  const changed = makeProfileHarness({ values: { 'data-intake-attribute': 'notes', value: 'Changed remotely' } });
  changed.sandbox.directoryProfileEditDrafts.set(changed.card.dataset.directoryStayKey, {
    initial: { 'intake:notes': 'Saved note' },
    values: { 'intake:notes': 'Typed draft' },
    identity: { breed: 'mutt', ownerName: 'owner', phone: '123' },
    initialized: true,
    conflict: false, failed: false, saving: false
  });
  changed.sandbox.restore(changed.card, { checkConflict: true });
  assert.equal(changed.control.value, 'Typed draft');
  assert.equal(changed.save.disabled, true);
  assert.match(changed.status.textContent, /changed while you were editing/);

  const duplicate = makeProfileHarness({ count: 2 });
  duplicate.sandbox.directoryProfileEditDrafts.set(duplicate.card.dataset.directoryStayKey, {
    initial: { 'intake:notes': 'Saved note' },
    values: { 'intake:notes': 'Typed draft' },
    identity: { breed: 'mutt', ownerName: 'owner', phone: '123' },
    initialized: true,
    conflict: false, failed: false, saving: false
  });
  duplicate.sandbox.restore(duplicate.card);
  assert.equal(duplicate.control.value, 'Typed draft');
  assert.equal(duplicate.save.disabled, true);
  assert.match(duplicate.status.textContent, /ambiguous/);
});

test('inline Care save freezes controls and preserves the draft with visible failure feedback', async () => {
  const card = {
    dataset: { directoryStayKey: 'milo|2026-09-20|2026-09-22', profileSaving: 'false' },
    querySelector: () => status
  };
  const control = { value: 'Typed draft', disabled: false };
  const status = { textContent: '', className: '' };
  const cancel = { disabled: false };
  const button = {
    disabled: false,
    innerText: '💾 Save changes',
    closest: () => ({}),
    querySelectorAll: () => [control, cancel]
  };
  let rejectSend;
  const state = { initial: { 'intake:notes': 'Saved note' }, values: { 'intake:notes': 'Typed draft' }, conflict: false, failed: false, saving: false };
  const sandbox = {
    directoryProfileEditDrafts: new Map([['milo|2026-09-20|2026-09-22', state]]),
    directoryProfileEditKey: () => 'milo|2026-09-20|2026-09-22',
    directoryProfileEditIsDirty: () => true,
    validateDirectoryProfileEditContext() {},
    updateDirectoryProfileEditFeedback: (_card, message) => { status.textContent = message || state.failureMessage || 'Saving care details…'; },
    applyDirectoryProfileEditMode: () => { control.disabled = card.dataset.profileSaving === 'true'; cancel.disabled = control.disabled; },
    getBelongingsCardPayload: () => ({ stayKey: card.dataset.directoryStayKey, dogName: 'Milo', riskFlags: {}, intakeAttributes: { notes: control.value } }),
    sendPayloadToAppsScript: () => new Promise((_resolve, reject) => { rejectSend = reject; }),
    belongingsRecordsCache: {}, careRiskRecordsCache: {}, directoryBelongingsDetailCache: {}, directoryProfileDetailCache: {},
    renderDirectoryCareBrief() {}, renderCareRiskDashboard() {}, getCurrentBoardingStays: () => [], localStorage: { getItem: () => '' },
    invalidateWaffleClientCaches: async () => {}, setDirectoryProfileEditMode() {}, setTimeout() {}, console: { error() {} }
  };
  vm.runInNewContext(`${source.slice(saveStart, saveEnd)}\nthis.save = saveBelongingsCard;`, sandbox);

  const saving = sandbox.save(card, button);
  await Promise.resolve();
  assert.equal(control.disabled, true);
  assert.equal(cancel.disabled, true);
  assert.equal(status.textContent, 'Saving care details…');
  rejectSend(new Error('fixture save failure'));
  await saving;
  assert.equal(control.disabled, false);
  assert.equal(cancel.disabled, false);
  assert.equal(control.value, 'Typed draft');
  assert.match(status.textContent, /Save failed\. Your draft is still here/);
  assert.equal(sandbox.directoryProfileEditDrafts.has(card.dataset.directoryStayKey), true);
});
