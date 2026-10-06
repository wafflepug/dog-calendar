const { test, expect } = require('@playwright/test');
const path = require('node:path');

const bookingScript = path.resolve(__dirname, '..', 'phase4-booking.js');
const coreScript = path.resolve(__dirname, '..', 'phase4-core.js');
const runtimeCss = path.resolve(__dirname, '..', 'waffle-runtime.css');
const dogA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dogB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function openBooking(page, overrides = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent('<div id="p4Modal" class="p4-modal"><section class="p4-card" role="dialog"><header class="p4-head"><h2>Booking</h2></header><nav class="p4-tabs"></nav><div class="p4-body"><section class="p4-panel" data-p4-panel="booking"></section><section data-p4-panel="capacity"></section><section data-p4-panel="owner"></section></div></section></div>');
  await page.evaluate(({ dogA, dogB, overrides }) => {
    const histories = {
      [dogA]: {
        dogName: 'Luna', dogId: dogA, stayCount: 1,
        previousStays: [{ stayId: 'stay-luna-1', stayKey: 'Luna|2026-01-01|2026-12-31', startDate: '2026-01-01', endDate: '2026-12-31', actualCheckoutDate: '2026-10-06', dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' }],
        latestCompletedProfile: { sourceDogId: dogA, sourceStayId: 'stay-luna-1', sourceStayKey: 'Luna|2026-01-01|2026-12-31', sourceStartDate: '2026-01-01', sourceEndDate: '2026-12-31', intakeAttributes: { feedingTimes: '7 am', foodAllergies: 'Chicken' }, riskFlags: { foodAllergy: true } },
        latestProfile: { intakeAttributes: { foodAllergies: 'future record must not appear' }, riskFlags: {} }
      },
      [dogB]: {
        dogName: 'Luna', dogId: dogB, stayCount: 1,
        previousStays: [{ stayId: 'stay-luna-2', stayKey: 'Luna|2025-01-01|2025-01-02', startDate: '2025-01-01', endDate: '2025-01-02', dogName: 'Luna', breed: 'Pug', ownerName: 'Other Owner' }],
        latestCompletedProfile: { sourceDogId: dogB, sourceStayId: 'stay-luna-2', sourceStayKey: 'Luna|2025-01-01|2025-01-02', sourceStartDate: '2025-01-01', sourceEndDate: '2025-01-02', intakeAttributes: { foodBrandType: 'Lamb kibble' }, riskFlags: {} }
      }
    };
    const identities = [
      { dogId: dogA, dogNumber: '00001', dogName: 'Luna', breed: 'Pug', ownerName: 'Alex', maskedPhoneTail: '•••• 1234' },
      { dogId: dogB, dogNumber: '00002', dogName: 'Luna', breed: 'Pug', ownerName: 'Other Owner', maskedPhoneTail: '•••• 5678' }
    ];
    window.fixtureWrites = [];
    window.fixtureReads = [];
    window.failFirstWrite = false;
    window.WAFFLE_PHASE4_CORE = {
      modal: () => document.getElementById('p4Modal'), page: () => 'booking', open: () => {},
      settings: () => ({ preferred: 4, absolute: 6 }),
      esc: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]),
      norm: value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      fmt: value => String(value ?? ''), today: () => '2026-10-06',
      read: async payload => {
        window.fixtureReads.push(payload);
        if (payload.action === 'list_dog_identities') return { identities };
        if (payload.action === 'get_dog_history') return { history: histories[payload.dogId] };
        throw new Error('Unexpected read');
      },
      write: async payload => {
        window.fixtureWrites.push(JSON.parse(JSON.stringify(payload)));
        if (window.failFirstWrite) { window.failFirstWrite = false; throw new Error('network timeout'); }
        return { result: 'success', dogId: payload.dogId, dogNumber: '00003' };
      },
      duplicate: () => null,
      capacity: () => ({ band: 'green' }),
      renderDecision: () => {}, toast: () => {},
      rows: () => [], visits: () => [], saveSettings: () => ({ preferred: 4, absolute: 6 }),
      parseBooking: () => ({})
    };
  }, { dogA, dogB, overrides });
  const core = require('node:fs').readFileSync(coreScript, 'utf8');
  const styleStart = core.indexOf('function style(){');
  const styleEnd = core.indexOf("\nlet active='booking';", styleStart);
  await page.addScriptTag({ content: core.slice(styleStart, styleEnd) + '\nstyle();' });
  const css = require('node:fs').readFileSync(runtimeCss, 'utf8').replace(/^\s*@import[^;]+;\s*$/gm, '');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ path: bookingScript });
}

async function fillRequiredBooking(page) {
  await page.locator('#p4Dog').fill('Luna');
  await page.locator('#p4Breed').fill('Pug');
  await page.locator('#p4Owner').fill('Alex');
  await page.locator('#p4Phone').fill('0400 000 1234');
  await page.locator('#p4Start').fill('2026-11-01');
  await page.locator('#p4End').fill('2026-11-04');
}

test('returning dog suggestion requires evidence and explicit Dog ID selection', async ({ page }) => {
  await openBooking(page);
  await page.locator('#p4Dog').fill('Luna');
  await expect.poll(() => page.evaluate(() => window.fixtureReads.some(x => x.action === 'list_dog_identities'))).toBe(true);
  await expect(page.locator('#p4ReturningMini')).toContainText('Name alone is not enough');
  await expect(page.locator('#p4DogIdentity')).toHaveValue('');
  await page.locator('#p4Breed').fill('Pug');
  await page.locator('#p4Owner').fill('Alex');
  await expect(page.locator('[data-p4-suggest]')).toHaveCount(2);
  await expect(page.locator('#p4DogIdentity')).toHaveValue('');
  await page.locator('#p4DogIdentity').selectOption(dogA);
  await expect(page.locator('#p4CareConfirm')).toBeVisible();
  await expect(page.locator('#p4ReturningMini')).toContainText('Chicken');
  await expect(page.locator('#p4ReturningMini')).not.toContainText('future record must not appear');
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('7 am');
  await expect(page.locator('[data-p4-care-profile="foodAllergies"]')).toHaveValue('Chicken');
  const sizing = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    label: getComputedStyle(document.querySelector('#p4Dog').closest('.p4-field').querySelector('span')).fontSize,
    input: getComputedStyle(document.querySelector('#p4Dog')).fontSize,
    inputHeight: document.querySelector('#p4Dog').getBoundingClientRect().height,
    checkboxHeight: document.querySelector('#p4CareConfirm').closest('label').getBoundingClientRect().height
  }));
  expect(sizing.width).toBeLessThanOrEqual(sizing.viewport);
  expect(sizing.label).toBe('12px');
  expect(sizing.input).toBe('16px');
  expect(sizing.inputHeight).toBeGreaterThanOrEqual(44);
  expect(sizing.checkboxHeight).toBeGreaterThanOrEqual(44);
});

test('reviewed fields are editable, unchecked inheritance stays off, and retries reuse identity', async ({ page }) => {
  await openBooking(page);
  await page.locator('#p4LoadDogIdentities').click();
  await fillRequiredBooking(page);
  await page.locator(`[data-p4-suggest="${dogA}"]`).click();
  await page.locator('[data-p4-care-profile="feedingTimes"]').fill('6:30 am');
  await page.locator('#p4CareConfirm').check();
  await page.evaluate(() => { window.failFirstWrite = true; });
  await page.locator('#p4SaveConfirmed').click();
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(1);
  const first = await page.evaluate(() => window.fixtureWrites[0]);
  expect(first.inheritCareReview.profile.feedingTimes).toBe('6:30 am');
  expect(first.inheritCareReview.riskFlags.foodAllergy).toBe(true);
  expect(first.inheritCareReview.sourceEndDate).toBe('2026-12-31');
  await expect(page.locator('#p4ReturningMini')).toContainText('ending 2026-10-06');
  expect(first.stayId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(first.clientMutationId).toMatch(/^[0-9a-f-]{36}$/i);
  await page.locator('#p4SaveConfirmed').click();
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(2);
  const second = await page.evaluate(() => window.fixtureWrites[1]);
  expect(second.stayId).toBe(first.stayId);
  expect(second.clientMutationId).toBe(first.clientMutationId);
  expect(second.inheritCareReview).toEqual(first.inheritCareReview);

  await page.locator('#p4DogIdentity').selectOption('');
  await page.locator('#p4Start').fill('2026-12-01');
  await page.locator('#p4End').fill('2026-12-03');
  await page.locator('#p4SaveConfirmed').click();
  const third = await page.evaluate(() => window.fixtureWrites[2]);
  expect(third.inheritCareReview).toBeUndefined();
});

test('returning booking handoff preserves entered contact and dates', async ({ page }) => {
  await openBooking(page);
  await page.evaluate(async () => window.WAFFLE_PHASE4_BOOKING.openReturningBooking({
    dogName: 'Luna', breed: 'Pug', ownerName: 'Alex', phone: '0400 111 222',
    startDate: '2026-11-10', endDate: '2026-11-12', notes: 'Asked about pickup time'
  }));
  await expect(page.locator('#p4Dog')).toHaveValue('Luna');
  await expect(page.locator('#p4Phone')).toHaveValue('0400 111 222');
  await expect(page.locator('#p4Start')).toHaveValue('2026-11-10');
  await expect(page.locator('#p4End')).toHaveValue('2026-11-12');
  await expect(page.locator('#p4Notes')).toHaveValue('Asked about pickup time');
  await expect(page.locator('#p4DogIdentity')).toBeFocused();
});

test('a slower prior Dog ID history response cannot replace the current selection', async ({ page }) => {
  await openBooking(page);
  await page.locator('#p4LoadDogIdentities').click();
  await fillRequiredBooking(page);
  await page.evaluate(() => {
    const core = window.WAFFLE_PHASE4_CORE;
    const original = core.read;
    core.read = payload => payload.action === 'get_dog_history'
      ? new Promise(resolve => { (window.pendingHistories ||= {})[payload.dogId] = resolve; })
      : original(payload);
  });
  await page.locator('#p4DogIdentity').selectOption(dogA);
  await expect.poll(() => page.evaluate(() => Boolean(window.pendingHistories?.['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']))).toBe(true);
  await page.locator('#p4DogIdentity').selectOption(dogB);
  await expect.poll(() => page.evaluate(() => Boolean(window.pendingHistories?.['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']))).toBe(true);
  await page.evaluate(id => window.pendingHistories[id]({ history: {
    previousStays: [{ stayId: 'stay-luna-2', stayKey: 'Luna|2025-01-01|2025-01-02', endDate: '2025-01-02' }],
    latestCompletedProfile: { sourceDogId: id, sourceStayId: 'stay-luna-2', sourceStayKey: 'Luna|2025-01-01|2025-01-02', sourceEndDate: '2025-01-02', intakeAttributes: { foodBrandType: 'Lamb kibble' }, riskFlags: {} }
  } }), dogB);
  await expect(page.locator('[data-p4-care-profile="foodBrandType"]')).toHaveValue('Lamb kibble');
  await page.evaluate(id => window.pendingHistories[id]({ history: {
    previousStays: [{ stayId: 'stay-luna-1', stayKey: 'Luna|2026-01-01|2026-01-03', endDate: '2026-01-03' }],
    latestCompletedProfile: { sourceDogId: id, sourceStayId: 'stay-luna-1', sourceStayKey: 'Luna|2026-01-01|2026-01-03', sourceEndDate: '2026-01-03', intakeAttributes: { foodAllergies: 'stale dog A value' }, riskFlags: {} }
  } }), dogA);
  await expect(page.locator('[data-p4-care-profile="foodBrandType"]')).toHaveValue('Lamb kibble');
  await expect(page.locator('#p4ReturningMini')).not.toContainText('stale dog A value');
});

test('Potential save reuses the same intent after a lost response and changed details start a fresh intent', async ({ page }) => {
  await openBooking(page);
  await page.locator('#p4Dog').fill('Milo');
  await page.locator('#p4Owner').fill('Sam');
  await page.locator('#p4Phone').fill('0400 111 222');
  await page.locator('#p4Start').fill('2026-11-01');
  await page.locator('#p4End').fill('2026-11-03');
  await page.evaluate(() => { window.failFirstWrite = true; });
  await page.locator('#p4SavePotential').click();
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(1);
  const first = await page.evaluate(() => window.fixtureWrites[0]);
  await page.locator('#p4SavePotential').click();
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(2);
  const retry = await page.evaluate(() => window.fixtureWrites[1]);
  expect(retry.id).toBe(first.id);
  expect(retry.stayId).toBe(first.stayId);
  expect(retry.clientMutationId).toBe(first.clientMutationId);
  await page.locator('#p4End').fill('2026-11-04');
  await page.locator('#p4SavePotential').click();
  const changed = await page.evaluate(() => window.fixtureWrites[2]);
  expect(changed.id).not.toBe(first.id);
  expect(changed.stayId).not.toBe(first.stayId);
  expect(changed.clientMutationId).not.toBe(first.clientMutationId);
});
