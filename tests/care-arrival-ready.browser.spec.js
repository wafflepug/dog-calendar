const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const addon = fs.readFileSync(path.join(__dirname, '..', 'care-arrival-ready.js'), 'utf8');
const runtimeCss = fs.readFileSync(path.join(__dirname, '..', 'waffle-runtime.css'), 'utf8');
const arrivalCss = runtimeCss.split(/\r?\n/).filter(line =>
  line.includes('[data-waffle-arrival-ready]') || line.includes('[data-arrival-copy]') ||
  line.includes('[data-arrival-detail]') || line.includes('[data-arrival-action]')
).join('\n');

async function setup(page) {
  await page.setContent('<body><main id="directory-grid"></main></body>');
  await page.addStyleTag({ content: arrivalCss });
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
  await addCard(page, { stayId: 's1', dogId: 'd1', key: 'milo|today', intake: 'link_ready' });
  await addCard(page, { stayId: 's2', dogId: 'd2', name: 'Milo', key: 'milo|today', end: '2026-10-18', intake: 'not_prepared' });
  await addCard(page, { stayId: 's3', dogId: 'd3', key: 'checked-out', past: true });
  await addCard(page, { stayId: 's4', dogId: 'd4', key: 'future', start: '2026-10-19' });
  await addCard(page, { stayId: 's5', dogId: 'd5', key: 'collision', intake: 'unknown' });
  await addCard(page, { stayId: 's6', dogId: 'd6', key: 'collision', intake: 'unknown' });
  await expect(page.locator('#directory-grid [data-waffle-arrival-ready]')).toHaveCount(4);
  await expect(page.locator('[data-waffle-arrival-ready]').first()).toContainText('Link ready');
  await expect(page.locator('[data-waffle-arrival-ready]').first().locator('[data-arrival-label]')).toHaveText('Link ready');
  await expect(page.locator('[data-waffle-arrival-ready]').first().locator('[data-arrival-detail]')).toHaveText('Refresh Care after owner submits.');
  await expect(page.locator('[data-waffle-arrival-ready]').first().locator('[data-arrival-action]')).toHaveText('Review care');
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

test('same-name household arrivals keep separate review targets and never imply care is verified', async ({ page }) => {
  await setup(page);
  await addCard(page, { stayId: 's1', dogId: 'd1', key: 'milo-a', intake: 'complete' });
  await addCard(page, { stayId: 's2', dogId: 'd2', key: 'milo-b', intake: 'unknown' });
  await page.evaluate(() => {
    document.querySelectorAll('.directory-card').forEach((card, i) => {
      card.dataset.directoryDogNumber = i ? '00018' : '00017';
      card.dataset.v1088OwnerName = 'Alex';
    });
    window.WAFFLE_ARRIVAL_READY.refresh();
  });
  const reviews = page.locator('[data-waffle-arrival-ready]');
  await expect(reviews).toHaveCount(1);
  await expect(reviews.nth(0)).toHaveAccessibleName(/Dog Number 00018.*Status unknown/);
  await expect(page.locator('[data-waffle-arrival-next]')).toHaveText('Next arrival · 2');
  await reviews.nth(0).click();
  await expect(page.locator('[data-directory-stay-id="s2"]')).toHaveAttribute('data-opened', 'true');
  await expect(page.locator('[data-directory-stay-id="s1"]')).not.toHaveAttribute('data-opened', 'true');
  await page.locator('[data-waffle-arrival-next]').click();
  await expect(page.locator('[data-directory-stay-id="s1"] [data-v11217-roster-checkin]')).toBeFocused();
  await page.locator('[data-waffle-arrival-next]').click();
  await expect(page.locator('[data-directory-stay-id="s2"] [data-v11217-roster-checkin]')).toBeFocused();
  await page.evaluate(() => {
    window.v110OperationDisplayState = card => ({ code: card.dataset.directoryStayId === 's2' ? 'checked_in' : 'date_active' });
    window.WAFFLE_ARRIVAL_READY.refresh();
  });
  await expect(reviews).toHaveCount(0);
  await expect(page.locator('[data-waffle-arrival-next]')).toHaveText('Next arrival · 1');
  expect(await page.evaluate(() => window.reads)).toBe(0);
});

test('arrival exceptions retain distinct truthful status and remove completed operations', async ({ page }) => {
  await setup(page);
  const cases = [
    { stayId: 'complete', dogId: 'd1', key: 'complete', intake: 'complete', label: 'Form received', detail: '' },
    { stayId: 'missing', dogId: 'd2', key: 'missing', intake: 'not_prepared', label: 'Not prepared', detail: 'No digital intake link is recorded.' },
    { stayId: 'link', dogId: 'd3', key: 'link', intake: 'link_ready', label: 'Link ready', detail: 'Refresh Care after owner submits.' },
    { stayId: 'unknown', dogId: 'd4', key: 'unknown', intake: 'unknown', label: 'Status unknown', detail: 'Current form completion is not verified.' }
  ];
  for (const item of cases) await addCard(page, item);
  const buttons = page.locator('[data-waffle-arrival-ready]');
  await expect(buttons).toHaveCount(3);
  await expect(page.locator('[data-directory-stay-id="complete"] [data-waffle-arrival-ready]')).toHaveCount(0);
  for (let i = 1; i < cases.length; i++) {
    await expect(buttons.nth(i - 1).locator('[data-arrival-label]')).toHaveText(cases[i].label);
    await expect(buttons.nth(i - 1).locator('[data-arrival-detail]')).toHaveText(cases[i].detail);
    await expect(buttons.nth(i - 1).locator('[data-arrival-action]')).toHaveText('Review care');
  }
  await expect(buttons.nth(2)).not.toContainText(/missing|not prepared|no digital intake/i);
  await expect(page.locator('[data-waffle-arrival-next]')).toHaveText('Next arrival · 4');
  await page.evaluate(() => {
    window.v110OperationForStay = ({ stayId }) => ({ status: stayId === 'complete' ? 'checked_in' : stayId === 'missing' ? 'checked_out' : 'date_active' });
    window.WAFFLE_ARRIVAL_READY.refresh();
  });
  await expect(page.locator('[data-waffle-arrival-ready]')).toHaveCount(2);
  await expect(page.locator('[data-directory-stay-id="link"] [data-waffle-arrival-ready]')).toBeAttached();
  await expect(page.locator('[data-directory-stay-id="unknown"] [data-waffle-arrival-ready]')).toBeAttached();
});

test('arrival action fits narrow and wide rosters in both themes', async ({ page }) => {
  await setup(page);
  await addCard(page, { stayId: 's1', dogId: 'd1', key: 'k1', intake: 'unknown' });
  const button = page.locator('[data-waffle-arrival-ready]');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['', 'dark-theme']) {
      await page.locator('body').evaluate((body, className) => { body.className = className; }, theme);
      await expect(button).toBeVisible();
      const dimensions = await button.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      });
      expect(dimensions.left).toBeGreaterThanOrEqual(0);
      expect(dimensions.right).toBeLessThanOrEqual(width + 1);
      expect(dimensions.width).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThanOrEqual(44);
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    }
  }
});
