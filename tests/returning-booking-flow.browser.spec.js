const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dogA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dogB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const newDog = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const bookingUi = fs.readFileSync(path.join(root, 'phase4-booking.js'), 'utf8');
const planEngine = fs.readFileSync(path.join(root, 'booking-plan.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'phase4-core.js'), 'utf8');
const styleStart = core.indexOf('function style(){');
const styleEnd = core.indexOf('\nlet active=', styleStart);

async function setup(page) {
  await page.goto('about:blank');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent('<div id="p4Modal" class="p4-modal"><section class="p4-card" role="dialog"><header><button data-p4-close type="button">Close</button></header><div class="p4-body"><section data-p4-panel="booking"></section><section data-p4-panel="capacity" hidden></section><section data-p4-panel="owner" hidden></section></div></section></div>');
  await page.evaluate(({ dogA, dogB }) => {
    window.fixtureReads = []; window.fixtureWrites = []; window.identityRows = [
      { dogId: dogA, dogNumber: '00001', dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' },
      { dogId: dogB, dogNumber: '00002', dogName: 'Milo', breed: 'Terrier', ownerName: 'Alex' }
    ];
    window.historyHandler = async payload => ({ history: {
      previousStays: [{ stayId: `stay-${payload.dogId}`, stayKey: `${payload.dogName}|2026-10-01|2026-10-05`, startDate: '2026-10-01', endDate: '2026-10-05' }],
      latestCompletedProfile: { sourceDogId: payload.dogId, sourceStayId: `stay-${payload.dogId}`, sourceStayKey: `${payload.dogName}|2026-10-01|2026-10-05`, sourceEndDate: '2026-10-05', intakeAttributes: { feedingTimes: `${payload.dogName} meals` }, riskFlags: {} }
    } });
    window.WAFFLE_PHASE4_CORE = {
      modal: () => document.getElementById('p4Modal'), page: () => 'booking', open: () => {}, settings: () => ({ preferred: 4, absolute: 6 }),
      esc: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]),
      norm: value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), fmt: value => String(value ?? ''), today: () => '2026-10-24',
      rows: () => [], visits: () => [], duplicate: () => null, capacity: () => ({ band: 'green' }), renderDecision: () => {},
      read: async payload => { window.fixtureReads.push(payload); if (payload.action === 'list_dog_identities') return { identities: window.identityRows }; return window.historyHandler(payload); },
      write: async payload => { window.fixtureWrites.push(structuredClone(payload)); return { result: 'success', dogId: payload.dogId || 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', stayId: payload.stayId, dogNumber: '00003' }; },
      toast: message => { window.lastToast = message; }, saveSettings: () => ({ preferred: 4, absolute: 6 }), parseBooking: () => ({})
    };
  }, { dogA, dogB });
  await page.addScriptTag({ content: core.slice(styleStart, styleEnd) + '\nstyle();' });
  await page.addScriptTag({ content: planEngine });
  await page.addScriptTag({ content: bookingUi });
  await page.locator('#p4LoadDogIdentities').click();
}

async function selectDog(page, id) {
  await page.locator('#p4DogIdentity').selectOption(id);
  await expect(page.locator('#p4DogIdentity')).toHaveValue(id);
}

test('identity selection stays fast and explicit care review coalesces, opens review, and uses the exact Dog ID', async ({ page }) => {
  await setup(page);
  await selectDog(page, dogA);
  expect(await page.evaluate(() => window.fixtureReads.filter(x => x.action === 'get_dog_history'))).toHaveLength(0);
  await page.evaluate(() => {
    window.historyGate = new Promise(resolve => { window.releaseHistory = resolve; });
    window.historyHandler = async payload => { await window.historyGate; return { history: { previousStays: [], latestCompletedProfile: null, dogId: payload.dogId } }; };
  });
  const button = page.locator('[data-p4-load-saved-care]');
  await button.click();
  await expect(button).toBeDisabled();
  await page.locator('[data-p4-load-saved-care]').evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.locator('#p4DogIdentity').selectOption(dogA);
  await expect(button).toBeDisabled();
  await page.locator('#p4Phone').fill('0412345678');
  await page.locator('#p4Phone').focus();
  expect(await page.evaluate(() => window.fixtureReads.filter(x => x.action === 'get_dog_history'))).toHaveLength(1);
  await page.evaluate(() => window.releaseHistory());
  await expect(page.locator('#p4ReturningMini')).toContainText('Dog ID #00001');
  await expect(page.locator('#p4Phone')).toBeFocused();
  await expect(page.locator('#p4Phone')).toHaveValue('0412345678');
  const reads = await page.evaluate(() => window.fixtureReads.filter(x => x.action === 'get_dog_history'));
  expect(reads).toHaveLength(1);
  expect(reads[0].dogId).toBe(dogA);
});

test('history failure offers a scoped retry and stale replies cannot replace a newly selected Dog ID', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.failHistory = true; window.historyHandler = async payload => { if (window.failHistory) throw Error('offline'); return { history: { dogId: payload.dogId, previousStays: [] } }; }; });
  await selectDog(page, dogA);
  await page.locator('[data-p4-load-saved-care]').click();
  await expect(page.locator('[data-p4-load-saved-care]')).toHaveText('Retry saved care review');
  await page.evaluate(() => { window.failHistory = false; });
  await page.locator('[data-p4-load-saved-care]').click();
  await expect(page.locator('#p4ReturningMini')).toContainText('Dog ID #00001');

  await selectDog(page, dogB);
  await page.evaluate(() => {
    window.historyGate = new Promise(resolve => { window.releaseHistory = resolve; });
    window.historyHandler = async payload => { await window.historyGate; return { history: { dogId: payload.dogId, previousStays: [] } }; };
  });
  await page.locator('[data-p4-load-saved-care]').click();
  await selectDog(page, dogA);
  await page.evaluate(() => window.releaseHistory());
  await expect(page.locator('#p4ReturningMini')).toContainText('Dog ID #00001');
  await expect(page.locator('#p4ReturningMini')).toContainText('Review saved care');
});

test('no-care confirmed save stays exact and never inherits care; approved care keeps its exact source', async ({ page }) => {
  await setup(page);
  await selectDog(page, dogA);
  await page.locator('#p4Dog').fill('Luna');
  await page.locator('#p4Start').fill('2026-11-10');
  await page.locator('#p4End').fill('2026-11-11');
  await page.locator('#p4SaveConfirmed').click();
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(1);
  const noCare = await page.evaluate(() => window.fixtureWrites[0]);
  expect(noCare.dogId).toBe(dogA);
  expect(noCare).not.toHaveProperty('inheritCareReview');

  await setup(page);
  await selectDog(page, dogA);
  await page.locator('[data-p4-load-saved-care]').click();
  const disclosure = page.locator('.p4-care-disclosure');
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(page.locator('#p4CareConfirm')).not.toBeChecked();
  await page.locator('#p4CareConfirm').check();
  await page.locator('[data-p4-care-profile="feedingTimes"]').fill('edited meals');
  await page.locator('#p4CareConfirm').check();
  await page.evaluate(() => { window.reviewInputNode = document.querySelector('[data-p4-care-profile="feedingTimes"]'); document.querySelector('#p4DogIdentity').dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('edited meals');
  await expect(page.locator('#p4CareConfirm')).toBeChecked();
  expect(await page.evaluate(() => document.querySelector('[data-p4-care-profile="feedingTimes"]') === window.reviewInputNode)).toBe(true);
  await page.locator('#p4Start').fill('2026-11-10');
  await page.locator('#p4End').fill('2026-11-11');
  await page.locator('#p4SaveConfirmed').click();
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(1);
  const approved = await page.evaluate(() => window.fixtureWrites[0]);
  expect(approved.dogId).toBe(dogA);
  expect(approved.inheritCareReview).toMatchObject({ sourceDogId: dogA, sourceStayId: `stay-${dogA}`, confirmed: true, profile: { feedingTimes: 'edited meals' } });
});

test('identity choice focuses only a missing date while preserving date and phone edits; loaded plan care survives dog edit', async ({ page }) => {
  await setup(page);
  await page.locator('#p4Start').fill('2026-11-10');
  await page.locator('#p4DogIdentity').focus();
  await page.locator('#p4DogIdentity').selectOption(dogA);
  await expect(page.locator('#p4End')).toBeFocused();
  await page.locator('#p4Phone').focus();
  await page.locator('#p4DogIdentity').focus();
  await page.locator('#p4DogIdentity').selectOption(dogB);
  expect(await page.evaluate(() => window.fixtureReads.filter(x => x.action === 'get_dog_history'))).toHaveLength(0);
  await page.locator('#p4Phone').fill('0400000000');
  await page.locator('#p4Phone').focus();
  await page.locator('#p4PlanDisclosure > summary').click();
  await page.locator('#p4PlanOwner').fill('Alex');
  await page.locator('#p4PlanPhone').fill('0400000000');
  await page.locator('#p4PlanNext').click();
  await selectDog(page, dogA);
  await page.locator('[data-p4-load-saved-care]').click();
  await page.locator('#p4PlanAddDog').click();
  await selectDog(page, dogB);
  await expect(page.locator('#p4ReturningMini')).not.toHaveAttribute('data-source-dog-id', dogA);
  await expect(page.locator('#p4ReturningMini')).not.toHaveAttribute('data-profile-available', 'true');
  await page.evaluate(() => { window.normalPlanHistory = window.historyHandler; window.historyHandler = () => new Promise(resolve => { window.resolveOldPlanHistory = resolve; }); });
  await page.locator('[data-p4-load-saved-care]').click();
  await expect(page.locator('[data-p4-load-saved-care]')).toBeDisabled();
  await page.getByRole('button', { name: 'Edit Luna · Dog ID #00001' }).click();
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('Luna meals');
  const count = await page.evaluate(() => window.fixtureReads.filter(x => x.action === 'get_dog_history').length);
  await page.locator('#p4PlanDogCancel').click();
  expect(await page.evaluate(() => window.fixtureReads.filter(x => x.action === 'get_dog_history').length)).toBe(count);
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogB);
  await expect(page.locator('[data-p4-load-saved-care]')).toBeEnabled();
  await page.evaluate(() => { window.historyHandler = window.normalPlanHistory; });
  await page.locator('[data-p4-load-saved-care]').click();
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('Milo meals');
  await page.evaluate(() => window.resolveOldPlanHistory({ history: { previousStays: [], latestCompletedProfile: null } }));
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('Milo meals');
  expect(await page.evaluate(() => window.fixtureReads.filter(x => x.action === 'get_dog_history').length)).toBe(count + 1);
});
