const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
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
  const card = {
    dataset: { stayKey: 'stay-a', directoryStayKey: 'stay-a', dogName: 'Milo' },
    querySelector(selector) {
      if (selector === '[data-belongings-item-present="blankets"]') return present;
      if (selector === '[data-belongings-item-description="blankets"]') return description;
      if (selector === '[data-belongings-edit-status]') return status;
      if (selector === '[data-save-belongings]') return save;
      if (selector === '[data-discard-belongings-draft]') return discard;
      return null;
    }
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
    extractFunction('restoreBelongingsItemDraft')
  ].join('\n'), context);
  return { context, card, present, description, status, save, discard };
}

test('same-stay refresh restores dirty belongings and keeps switch-away work keyed to its stay', () => {
  const h = harness();
  h.context.restoreBelongingsItemDraft(h.card, { blankets: { present: false, description: '' } });
  h.present.checked = true;
  h.description.value = 'Blue fleece';
  h.context.belongingsItemDrafts.get('stay-a').values = { blankets: { present: true, description: 'Blue fleece' } };
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
