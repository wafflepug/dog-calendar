const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const source = fs.readFileSync(path.join(__dirname, '..', 'waffle-v10.8.6.js'), 'utf8');
const carePolish = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.1.8.js'), 'utf8');
const countsStart = source.indexOf('function v1086UpdateCareStayCounts()');
const observeStart = source.indexOf('function v1086ObserveCareDirectory()');
const observeEnd = source.indexOf('function v1086PolishCareTabs()', observeStart);
if (countsStart < 0 || observeStart < 0 || observeEnd < 0) throw new Error('Could not locate Care count decorators.');
const decorators = `${source.slice(countsStart, source.indexOf('function v1086MoveCheckedOutStayToPast(', countsStart))}\n${source.slice(observeStart, observeEnd)}`;

test('Care count observer updates for late current and Past grids without duplicate observers', async ({ page }) => {
  await page.setContent('<body data-waffle-page="directory"><strong id="v1082CurrentStayCount">…</strong><strong id="v1082PastStayCount">…</strong></body>');
  await page.evaluate(decorators => {
    window.WAFFLE_PAGE = 'directory';
    window.v1082PastResponse = { totalPastStays: 4, bookings: [] };
    window.eval(decorators);
    v1086ObserveCareDirectory();
    const observer = window.v1086CareDirectoryObserver;
    v1086ObserveCareDirectory();
    if (observer !== window.v1086CareDirectoryObserver) throw new Error('Observer was replaced');
    const grid = document.createElement('div');
    grid.id = 'directory-grid';
    grid.innerHTML = '<button class="directory-guest-tile-open">Maple</button><button class="directory-guest-tile-open">Ravioli</button>';
    document.body.appendChild(grid);
    const past = document.createElement('div');
    past.id = 'past-directory-grid';
    past.innerHTML = '<button class="directory-guest-tile-open">Juniper</button>';
    document.body.appendChild(past);
  }, decorators);
  await expect(page.locator('#v1082CurrentStayCount')).toHaveText('2');
  await expect(page.locator('#v1082PastStayCount')).toHaveText('4');
});

test('repeated care-card decoration leaves unchanged DOM untouched and updates changed signals', async ({ page }) => {
  const decorateStart = carePolish.indexOf('  function renderCareSignals(card) {');
  const decorateEnd = carePolish.indexOf('\n  function decorateAllCareCards()', decorateStart);
  if (decorateStart < 0 || decorateEnd < 0) throw new Error('Could not locate the care-signal and care-card decorators.');
  const decorator = carePolish.slice(decorateStart, decorateEnd);
  await page.setContent('<body><article id="current" class="directory-card is-profile-active" data-directory-stay-key="stay-1"><header class="directory-card-header"><span class="directory-status-tag tag-at-home">At Home</span></header><div data-directory-profile-roster-badges><button class="directory-guest-tile-open"></button></div></article><article id="past" class="directory-card is-profile-active" data-directory-stay-key="stay-2" data-v1082-past-stay="true"><header class="directory-card-header"><span class="directory-status-tag tag-checked-out">Checked Out</span></header><div data-directory-profile-roster-badges><button class="directory-guest-tile-open"></button></div></article></body>');
  const result = await page.evaluate(decorator => {
    window.careCardStatus = card => card.dataset.v1082PastStay === 'true' ? 'PAST STAY' : 'AT HOME';
    window.statusClass = () => 'is-at-home';
    window.careSignals = () => window.testSignals;
    window.esc = value => String(value);
    window.testSignals = [{ icon: '💊', label: 'Medication', weight: 90 }];
    window.eval(`${decorator}; window.decorateTestCard = decorateCareCard;`);
    const current = document.querySelector('#current');
    const past = document.querySelector('#past');
    window.decorateTestCard(current);
    window.decorateTestCard(past);
    let mutationCount = 0;
    const observer = new MutationObserver(records => { mutationCount += records.length; });
    observer.observe(current, { attributes: true, childList: true, characterData: true, subtree: true });
    observer.observe(past, { attributes: true, childList: true, characterData: true, subtree: true });
    window.decorateTestCard(current);
    window.decorateTestCard(past);
    return new Promise(resolve => setTimeout(() => {
      const unchangedMutations = mutationCount;
      window.testSignals = [{ icon: '🚪', label: 'Escape risk', weight: 92 }];
      window.decorateTestCard(current);
      setTimeout(() => {
        observer.disconnect();
        resolve({ unchangedMutations, changedMutations: mutationCount - unchangedMutations, currentText: current.textContent, pastTag: past.querySelector('.directory-status-tag').textContent, pastClass: past.querySelector('.directory-status-tag').className });
      }, 0);
    }, 0));
  }, decorator);
  expect(result.unchangedMutations).toBe(0);
  expect(result.changedMutations).toBeGreaterThan(0);
  expect(result.currentText).toContain('Escape risk');
  expect(result.pastTag).toBe('Checked Out');
  expect(result.pastClass).toBe('directory-status-tag tag-checked-out');
});
