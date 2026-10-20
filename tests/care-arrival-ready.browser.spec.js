const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const addon = fs.readFileSync(path.join(__dirname, '..', 'care-arrival-ready.js'), 'utf8');

async function setup(page) {
  await page.setContent('<main id="directory-grid"></main>');
  await page.evaluate(() => {
    window.getLocalTodayDateString = () => '2026-10-18';
    window.reads = 0;
    window.v110OperationForStay = () => null;
    window.WAFFLE_INTAKE_STATUS = { getState: card => ({ code: card.dataset.intake || 'unknown', label: card.dataset.label || '', detail: card.dataset.detail || '' }) };
  });
  await page.addScriptTag({ content: addon });
}

async function addCard(page, { stayId, dogId, name = 'Milo', key, start = '2026-10-18', end = '2026-10-20', intake = 'complete', past = false } = {}) {
  await page.evaluate(input => {
    const card = document.createElement('article');
    card.className = 'directory-card';
    Object.assign(card.dataset, {
      directoryStayId: input.stayId, directoryDogId: input.dogId, directoryDogName: input.name,
      directoryStayKey: input.key, directoryStartDate: input.start, directoryEndDate: input.end,
      intake: input.intake, ...(input.past ? { v1082PastStay: 'true' } : {})
    });
    card.innerHTML = '<button class="directory-guest-tile-open">Open profile</button><button data-v11217-roster-checkin>Check In</button>';
    card.querySelector('.directory-guest-tile-open').addEventListener('click', () => { card.dataset.opened = 'true'; });
    document.querySelector('#directory-grid').appendChild(card);
  }, { stayId, dogId, name, key, start, end, intake, past });
}

test('only unique, current arrivals receive one compact indicator and retain Check In', async ({ page }) => {
  await setup(page);
  await addCard(page, { stayId: 's1', dogId: 'd1', key: 'milo|today' });
  await addCard(page, { stayId: 's2', dogId: 'd2', name: 'Milo', key: 'milo|today', end: '2026-10-18' });
  await addCard(page, { stayId: 's3', dogId: 'd3', key: 'checked-out', past: true });
  await addCard(page, { stayId: 's4', dogId: 'd4', key: 'future', start: '2026-10-19' });
  await addCard(page, { stayId: 's5', dogId: 'd5', key: 'collision' });
  await addCard(page, { stayId: 's6', dogId: 'd6', key: 'collision' });
  await expect(page.locator('#directory-grid [data-waffle-arrival-ready]')).toHaveCount(4);
  await expect(page.locator('[data-waffle-arrival-ready]').first()).toContainText('Intake complete');
  await expect(page.locator('[data-v11217-roster-checkin]')).toHaveCount(6);
  await expect(page.locator('[data-waffle-arrival-ready]')).toHaveCount(4);
  await expect(page.locator('[data-waffle-arrival-next]')).toHaveText('Next arrival · 4');
  await page.locator('[data-waffle-arrival-next]').click();
  await expect(page.locator('[data-v11217-roster-checkin]').nth(0)).toBeFocused();
  await page.locator('[data-waffle-arrival-next]').click();
  await expect(page.locator('[data-v11217-roster-checkin]').nth(1)).toBeFocused();
});

test('arrival status keeps its truthful label and opens Care in one activation', async ({ page }) => {
  await setup(page);
  await addCard(page, { stayId: 's1', dogId: 'd1', key: 'unknown', intake: 'unknown' });
  await page.locator('.directory-card').evaluate(card => {
    card.dataset.label = 'Care profile available';
    card.dataset.detail = 'Current form completion not verified.';
    card.dataset.directoryDogNumber = '0017';
    card.dataset.v1088OwnerName = 'Jamie Lee';
  });
  await page.evaluate(() => window.WAFFLE_ARRIVAL_READY.refresh());
  const indicator = page.locator('[data-waffle-arrival-ready]');
  await expect(indicator).toContainText('Care profile available');
  await expect(indicator).toContainText('Current form completion not verified.');
  await expect(indicator).toContainText('Review care');
  await expect(indicator).toHaveAccessibleName(/Review care for Milo, Dog Number 0017, owner Jamie Lee, 2026-10-18 to 2026-10-20: Care profile available.*Current form completion not verified/i);
  await expect(indicator.locator('details')).toHaveCount(0);
  await indicator.focus();
  await page.evaluate(() => { window.savedArrivalNode = document.querySelector('[data-waffle-arrival-ready]'); });
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    card.dataset.intake = 'link_ready'; card.dataset.label = 'Link ready'; card.dataset.detail = 'Refresh Care after owner submits.';
    window.WAFFLE_ARRIVAL_READY.refresh();
  });
  await expect(indicator).toContainText('Link ready');
  await expect(indicator).toContainText('Refresh Care after owner submits.');
  expect(await page.evaluate(() => window.savedArrivalNode === document.querySelector('[data-waffle-arrival-ready]'))).toBe(true);
  await expect(indicator).toBeFocused();
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    card.dataset.directoryDogName = 'Milo Two';
    card.dataset.directoryDogNumber = '0018';
    card.dataset.v1088OwnerName = 'Jordan Lee';
    window.WAFFLE_ARRIVAL_READY.refresh();
  });
  await expect(indicator).toHaveAccessibleName(/Review care for Milo Two, Dog Number 0018, owner Jordan Lee, 2026-10-18 to 2026-10-20: Link ready/i);
  expect(await page.evaluate(() => window.reads)).toBe(0);
  await indicator.click();
  await expect(page.locator('.directory-card')).toHaveAttribute('data-opened', 'true');
  expect(await page.evaluate(() => window.reads)).toBe(0);
});

test('check-in click remains outside profile and rendering is idempotent with no added reads', async ({ page }) => {
  await setup(page);
  await addCard(page, { stayId: 's1', dogId: 'd1', key: 'stable', intake: 'not_prepared' });
  const checkin = page.locator('[data-v11217-roster-checkin]');
  await checkin.click();
  await expect(page.locator('.directory-card')).not.toHaveAttribute('data-opened', 'true');
  const before = await page.locator('[data-waffle-arrival-ready]').evaluate(el => el);
  const mutationCount = await page.evaluate(() => {
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.WAFFLE_ARRIVAL_READY.refresh(); window.WAFFLE_ARRIVAL_READY.refresh();
    const count = observer.takeRecords().length;
    observer.disconnect();
    return count;
  });
  expect(mutationCount).toBe(0);
  const after = await page.locator('[data-waffle-arrival-ready]').evaluate(el => el);
  expect(after).toBe(before);
  await expect(page.locator('#directory-grid [data-waffle-arrival-ready]')).toHaveCount(1);
  expect(await page.evaluate(() => window.reads)).toBe(0);
});

test('authoritative operation collision excludes a card; quick-focus control hides with no arrivals', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.v110OperationDisplayState = card => card.dataset.directoryStayId === 'collision' ? { code: 'collision' } : { code: 'date_active' }; });
  await addCard(page, { stayId: 'collision', dogId: 'd1', key: 'k1' });
  await addCard(page, { stayId: 'clear', dogId: 'd2', key: 'k2', past: true });
  await expect(page.locator('[data-waffle-arrival-ready]')).toHaveCount(0);
  await expect(page.locator('[data-waffle-arrival-next]')).toBeHidden();
});
