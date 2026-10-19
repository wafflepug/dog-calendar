const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const start = source.indexOf('    const directoryCareSectionChoices = new Map();');
const end = source.indexOf('    async function openDirectoryGuestProfile(', start);
const tabsStart = source.indexOf('const DIRECTORY_PROFILE_SECONDARY_TABS');
const tabsEnd = source.indexOf('];', tabsStart) + 2;
const code = `${source.slice(tabsStart, tabsEnd)}\n${source.slice(start, end)}`;

function harness(cards) {
  const context = { document: { querySelectorAll: () => cards }, Array, Set, Map, String, JSON };
  vm.runInNewContext(`${code}; this.switchSections = switchDirectoryProfileSubTab;`, context);
  return context;
}

function card(stayId, dogId, stayKey) {
  const buttons = ['overview', 'foodWalks', 'behaviour', 'healthHome', 'safety'].map(key => ({ dataset: { profileSubtab: key }, getAttribute(name) { return this[name] ?? null; }, setAttribute(name, value) { this[name] = value; }, classList: { toggle() {} } }));
  const panels = buttons.map(button => ({ dataset: { profileSubpanel: button.dataset.profileSubtab }, contains: () => false, closest: () => ({ classList: { toggle() {} } }) }));
  return { dataset: { directoryStayId: stayId, directoryDogId: dogId, directoryStayKey: stayKey }, querySelectorAll(selector) { return selector === '[data-profile-subtab]' ? buttons : panels; }, buttons, panels };
}

test('independent section choices, including all-collapsed, survive reopening the same full identity', () => {
  const guest = card('STAY-1', 'DOG-1', 'key-1');
  const context = harness([guest]);
  context.switchSections(guest, 'foodWalks', true);
  context.switchSections(guest, 'behaviour', true);
  assert.equal(guest.dataset.profileSubTabs, 'foodWalks,behaviour');
  context.switchSections(guest, 'foodWalks', true);
  context.switchSections(guest, 'behaviour', true);
  assert.equal(guest.dataset.profileSubTabs, '');
  context.switchSections(guest, '', false);
  assert.equal(guest.dataset.profileCareSectionsInitialized, 'true');
});

test('changed, incomplete, and ambiguous identities do not share saved section choices', () => {
  const a = card('stay-1', 'dog-1', 'key-1');
  let context = harness([a]);
  context.switchSections(a, 'safety', true);
  const replacement = card('stay-2', 'dog-1', 'key-2');
  context.switchSections(replacement, 'foodWalks', false);
  assert.equal(replacement.dataset.profileSubTabs, 'foodWalks');
  const incomplete = card('', 'dog-1', 'key-3');
  context.switchSections(incomplete, 'safety', true);
  const duplicate = card('stay-1', 'dog-1', 'key-1');
  context = harness([a, duplicate]);
  context.switchSections(duplicate, 'foodWalks', false);
  assert.equal(duplicate.dataset.profileSubTabs, 'foodWalks');
});
