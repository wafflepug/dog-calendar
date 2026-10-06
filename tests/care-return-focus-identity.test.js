const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '../waffle-app.js'), 'utf8');
const helpers = source.slice(source.indexOf('    function captureDirectoryProfileNavigationOrigin('), source.indexOf('    function switchDirectoryProfileMainTab('));

function harness() {
  const cards = [];
  const search = { value: 'Coco', focus() { document.activeElement = this; } };
  const document = {
    activeElement: null, body: {}, documentElement: { scrollHeight: 2000 },
    getElementById(id) { return id === 'guestDirectorySearch' ? search : null; },
    querySelectorAll(selector) { return selector.includes('data-open-directory-profile') ? cards.map(c => c.opener) : cards; },
    querySelector() { return null; }
  };
  const window = {
    innerHeight: 800, scrollTo() {}, getComputedStyle() { return { display: 'block', visibility: 'visible' }; },
    requestAnimationFrame(callback) { callback(); }, setTimeout() {}
  };
  const context = vm.createContext({ window, document, directoryProfileNavigationOrigin: null, getDirectoryWindowScrollTop: () => 100, filterGuestDirectoryCards() {} });
  vm.runInContext(helpers, context);
  function card(dataset) {
    const c = { dataset: { directoryStayKey: 'coco|2026-11-15|2026-11-23', directoryDogName: 'Coco', directoryStartDate: '2026-11-15', directoryEndDate: '2026-11-23', ...dataset }, hidden: false, getClientRects: () => [1] };
    c.opener = { isConnected: true, closest: () => c, focus() { document.activeElement = this; } };
    c.querySelector = () => c.opener;
    cards.push(c);
    return c;
  }
  function replace(original, replacements) {
    original.opener.isConnected = false;
    cards.splice(cards.indexOf(original), 1);
    replacements.forEach(card);
  }
  return { card, replace, cards, search, document, capture: c => context.captureDirectoryProfileNavigationOrigin(c), restore: () => context.restoreDirectoryProfileNavigationOrigin() };
}

test('Back uses exact Stay ID after dates and source row change, despite a same-key decoy', () => {
  const h = harness();
  const original = h.card({ directoryStayId: 'stay-a', directoryDogId: 'dog-a', directorySourceRow: '3' });
  h.capture(original);
  h.replace(original, [
    { directoryStayId: 'stay-b', directoryDogId: 'dog-b' },
    { directoryStayId: 'stay-a', directoryDogId: 'dog-a', directorySourceRow: '20', directoryStayKey: 'coco|2026-11-16|2026-11-24', directoryStartDate: '2026-11-16', directoryEndDate: '2026-11-24' }
  ]);
  h.restore();
  assert.equal(h.document.activeElement, h.cards[1].opener);
  assert.equal(h.search.value, 'Coco');
});

test('a removed Stay ID cannot transfer focus to another booking of the same dog and dates', () => {
  const h = harness();
  const original = h.card({ directoryStayId: 'stay-a', directoryDogId: 'dog-a' });
  h.capture(original);
  h.replace(original, [{ directoryStayId: 'stay-b', directoryDogId: 'dog-a' }]);
  h.restore();
  assert.equal(h.document.activeElement, h.search);
});

test('duplicate legacy identity falls back to search rather than selecting the first result', () => {
  const h = harness();
  const original = h.card({ v1088OwnerName: 'Alex' });
  h.capture(original);
  h.replace(original, [{ v1088OwnerName: 'Alex' }, { v1088OwnerName: 'Alex' }]);
  h.restore();
  assert.equal(h.document.activeElement, h.search);
});

test('a Dog ID without Stay ID restores only the uniquely matching dated booking', () => {
  const h = harness();
  const original = h.card({ directoryDogId: 'dog-a' });
  h.capture(original);
  h.replace(original, [
    { directoryDogId: 'dog-b' },
    { directoryDogId: 'dog-a' }
  ]);
  h.restore();
  assert.equal(h.document.activeElement, h.cards[1].opener);
});

test('a missing Dog ID does not fall back to another dog with the same name and dates', () => {
  const h = harness();
  const original = h.card({ directoryDogId: 'dog-a' });
  h.capture(original);
  h.replace(original, [{ directoryDogId: 'dog-b' }]);
  h.restore();
  assert.equal(h.document.activeElement, h.search);
});

test('a connected opener reused for another Stay ID is not treated as the original booking', () => {
  const h = harness();
  const original = h.card({ directoryStayId: 'stay-a', directoryDogId: 'dog-a' });
  h.capture(original);
  original.dataset.directoryStayId = 'stay-b';
  h.restore();
  assert.equal(h.document.activeElement, h.search);
});

test('refreshed roster labels distinguish equal-name guests and retain their existing IDs', () => {
  const start = source.indexOf('    function directoryProfileAccessibleLabel(');
  const end = source.indexOf('    function updateDirectoryRosterStatus(', start);
  const context = vm.createContext({ formatStayDateShort: value => value });
  vm.runInContext(source.slice(start, end), context);
  const card = (number, statusLabel = 'Ready') => ({
    dogName: 'Coco', dogNumber: number, dogId: 'dog-' + number, owner: 'Alex', stayDates: '15 Nov – 23 Nov', context: 'Poodle · arrives 15 Nov', statusLabel
  });
  const first = context.directoryProfileAccessibleLabel(card('#00001', 'Intake missing'));
  const second = context.directoryProfileAccessibleLabel(card('#00002'));
  assert.match(first, /Coco/);
  assert.match(first, /#00001/);
  assert.match(first, /Alex/);
  assert.match(first, /15 Nov – 23 Nov/);
  assert.match(second, /#00002/);
  assert.notEqual(first, second);
  assert.doesNotMatch(context.directoryProfileAccessibleLabel(card('Other')), /Dog Number Other/);
});
