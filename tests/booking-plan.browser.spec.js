const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dogA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dogB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const dogC = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const newDogA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const bookingUi = fs.readFileSync(path.join(root, 'phase4-booking.js'), 'utf8');
const planEngine = fs.readFileSync(path.join(root, 'booking-plan.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'phase4-core.js'), 'utf8');
const styleStart = core.indexOf('function style(){');
const styleEnd = core.indexOf('\nlet active=', styleStart);

async function setup(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent('<div id="p4Modal" class="p4-modal"><section class="p4-card" role="dialog"><header class="p4-head"><h2>Booking</h2><button data-p4-close type="button">Close</button></header><nav class="p4-tabs"></nav><div class="p4-body"><section class="p4-panel" data-p4-panel="booking"></section><section data-p4-panel="capacity" hidden></section><section data-p4-panel="owner" hidden></section></div></section></div>');
  await page.evaluate(({ dogA, dogB, newDogA }) => {
    window.fixtureWrites = [];
    window.fixtureReads = [];
    window.WAFFLE_PHASE4_CORE = {
      modal: () => document.getElementById('p4Modal'), page: () => 'booking', open: () => {},
      settings: () => ({ preferred: 4, absolute: 6 }),
      esc: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]),
      norm: value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      fmt: value => String(value ?? ''), today: () => '2026-10-06', rows: () => [], visits: () => [],
      read: async payload => {
        window.fixtureReads.push(payload);
        if (payload.action === 'list_dog_identities') return { identities: window.identityRows };
        return { history: { dogId: payload.dogId, previousStays: [], stayCount: 0 } };
      },
      write: async payload => {
        window.fixtureWrites.push(structuredClone(payload));
        if (window.writeGate) await window.writeGate;
        const dogId = payload.dogId || (payload.dogName === 'Milo' ? dogB : newDogA);
        return { result: 'success', dogId, stayId: payload.stayId, dogNumber: dogId === dogA ? '00001' : dogId === dogB ? '00002' : '00003' };
      },
      duplicate: () => null, capacity: () => ({ band: 'green' }), renderDecision: () => {}, toast: message => { window.lastToast = message; },
      saveSettings: () => ({ preferred: 4, absolute: 6 }), parseBooking: () => ({})
    };
    window.identityRows = [
      { dogId: dogA, dogNumber: '00001', dogName: 'Luna', breed: 'Pug', ownerName: 'Alex' },
      { dogId: dogB, dogNumber: '00002', dogName: 'Milo', breed: 'Terrier', ownerName: 'Alex' }
    ];
  }, { dogA, dogB, newDogA });
  await page.addScriptTag({ content: core.slice(styleStart, styleEnd) + '\nstyle();' });
  await page.addScriptTag({ content: planEngine });
  await page.addScriptTag({ content: bookingUi });
  await page.locator('#p4PlanDisclosure').evaluate(el => { el.open = true; el.dispatchEvent(new Event('toggle')); });
  await page.locator('#p4PlanOwner').fill('Alex');
  await page.locator('#p4PlanPhone').fill('0400000000');
  await page.locator('#p4PlanNext').click();
}

async function addDog(page, name, identity) {
  if ((await page.locator('#p4PlanStepLabel').textContent()).includes('Owner')) await page.locator('#p4PlanNext').click();
  await page.locator('#p4Dog').fill(name);
  if (identity) {
    await page.locator('#p4LoadDogIdentities').click();
    await expect(page.locator(`#p4DogIdentity option[value="${identity}"]`)).toHaveCount(1);
    await page.locator('#p4DogIdentity').selectOption(identity);
    await expect(page.locator('[data-p4-load-saved-care]')).toBeVisible();
  } else {
    await page.locator('#p4DogIdentity').selectOption('');
  }
  const breed = { Luna: 'Pug', Milo: 'Terrier', Poppy: 'Spaniel' }[name] || 'Mixed breed';
  await page.locator('#p4Breed').fill(breed);
  await page.locator('#p4PlanAddDog').click();
}

async function addVisit(page, start, end) {
  if ((await page.locator('#p4PlanStepLabel').textContent()).includes('Dogs')) await page.locator('#p4PlanNext').click();
  await page.locator('#p4PlanMode').selectOption('stay');
  await page.locator('#p4PlanStart').fill(start);
  await page.locator('#p4PlanEnd').fill(end);
  await page.locator('#p4PlanAddVisit').click();
}

async function openReview(page) {
  for (let step = 0; step < 4 && !(await page.locator('#p4PlanStepLabel').textContent()).includes('Review'); step++) {
    const before = await page.locator('#p4PlanStepLabel').textContent();
    await page.locator('#p4PlanNext').click();
    await expect(page.locator('#p4PlanStepLabel')).not.toHaveText(before);
  }
  await expect(page.locator('#p4PlanStepLabel')).toContainText('Review');
  if (!(await page.locator('#p4PlanSave').isEnabled())) await page.locator('#p4PlanReview').click();
}

async function reviewAndSave(page) {
  await openReview(page);
  await expect(page.locator('#p4PlanSave')).toBeEnabled();
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanStatus')).toContainText('confirmed saved');
}

async function openSavedCare(page) {
  const load = page.locator('[data-p4-load-saved-care]');
  if (await load.count()) await load.click();
  const disclosure = page.locator('#p4ReturningMini .p4-care-disclosure');
  if (await disclosure.getAttribute('open') === null) await disclosure.locator('summary').click();
  await expect(disclosure).toHaveAttribute('open', '');
}

async function captureCarePlanStage(page, stage, testInfo) {
  if (process.env.WAFFLE_CAPTURE_UI_EVIDENCE !== '1' || testInfo.project.name !== 'chromium') return;
  const dir = path.join(root, 'output', 'releases', '2026.10.23.01', 'evidence');
  fs.mkdirSync(dir, { recursive: true });
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.body.classList.toggle('dark-theme', dark), dark);
      await expect(page.locator('#p4PlanStageHeading')).toBeVisible();
      expect(await page.locator('#p4PlanDisclosure').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await page.screenshot({ path: path.join(dir, `plan-${stage}-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.body.classList.remove('dark-theme'));
}

async function capturePlanEvidence(page, name, width, dark) {
  const evidenceDir = path.join(root, 'output', 'releases', '2026.10.22.01', 'evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
  await page.evaluate(isDark => document.body.classList.toggle('dark-theme', isDark), dark);
  await page.screenshot({ path: path.join(evidenceDir, name), fullPage: true });
}

test('two dogs and two date ranges save four distinct confirmed stay intents', async ({ page }) => {
  await setup(page);
  await addDog(page, 'Luna', dogA);
  await addDog(page, 'Milo', dogB);
  await addVisit(page, '2026-11-10', '2026-11-12');
  await addVisit(page, '2026-11-20', '2026-11-22');
  await openReview(page);
  await expect(page.locator('[data-p4-review-count]')).toHaveText('2 dogs · 2 dates · 4 total stays');
  await expect(page.locator('[data-p4-review-dog]')).toHaveCount(2);
  await expect(page.locator('[data-p4-review-dog]').nth(0).locator('strong')).toContainText('Luna · Dog #00001 · Pug');
  await expect(page.locator('[data-p4-review-dog]').nth(1).locator('strong')).toContainText('Milo · Dog #00002 · Terrier');
  await expect(page.locator('[data-p4-review-visit]').first()).toHaveText('Overnight stay · Tue, 10 Nov 2026 – Thu, 12 Nov 2026');
  await expect(page.locator('[data-p4-review-visit]').nth(1)).toHaveText('Overnight stay · Fri, 20 Nov 2026 – Sun, 22 Nov 2026');
  await expect(page.locator('[data-p4-review-visit]')).toHaveCount(4);
  await expect(page.locator('#p4PlanRows')).toBeHidden();
  await expect(page.locator('.p4-plan-review-contact')).toHaveCount(1);
  await reviewAndSave(page);
  const writes = await page.evaluate(() => window.fixtureWrites);
  expect(writes).toHaveLength(4);
  expect(new Set(writes.map(row => row.stayId)).size).toBe(4);
  expect(new Set(writes.map(row => row.dogId))).toEqual(new Set([dogA, dogB]));
  expect(writes.every(row => row.action === 'create_boarding' && row.ownerName === 'Alex' && row.phone === '0400000000')).toBe(true);
  await expect(page.locator('#p4PlanRows [data-p4-result-dog]')).toHaveCount(2);
  await expect(page.locator('#p4PlanRows [data-p4-result-status="saved"]')).toHaveCount(4);
  await expect(page.locator('.p4-plan-review-count')).toBeVisible();
  await expect(page.locator('.p4-plan-review-contact')).toBeVisible();
  await expect(page.locator('.p4-plan-review-dogs')).toBeHidden();
  await expect(page.locator('#p4PlanRows')).toBeVisible();
});

test('each added dog keeps its own reviewed-care snapshot and Dates context', async ({ page }, testInfo) => {
  await setup(page);
  await page.evaluate(({ dogA }) => {
    const core = window.WAFFLE_PHASE4_CORE, original = core.read;
    window.WAFFLE_PHASE4_CORE.read = async payload => {
      if (payload.action === 'get_dog_history') return { history: {
        previousStays: [{ stayId: 'stay-exact', stayKey: 'Luna|2026-10-01|2026-10-06', startDate: '2026-10-01', endDate: '2026-10-06', status: 'checked_out', actualCheckoutDate: '2026-10-05' }],
        latestCompletedProfile: { sourceDogId: dogA, sourceStayId: 'stay-exact', sourceStayKey: 'Luna|2026-10-01|2026-10-06', sourceEndDate: '2026-10-06', sourceCompletedDate: '2026-10-05', intakeAttributes: { feedingTimes: '7 am', foodAllergies: 'Chicken' }, riskFlags: { foodAllergy: true, escapeRisk: false } }
      } };
      return original(payload);
    };
  }, { dogA });
  await page.locator('#p4Dog').fill('Luna');
  await page.locator('#p4LoadDogIdentities').click();
  await page.locator('#p4DogIdentity').selectOption(dogA);
  await openSavedCare(page);
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('7 am');
  await openSavedCare(page);
  await page.locator('[data-p4-care-profile="feedingTimes"]').fill('6:30 am');
  await page.locator('#p4CareConfirm').check();
  const readCount = await page.evaluate(() => window.fixtureReads.length);
  await page.locator('#p4PlanAddDog').click();
  const dogRow = page.locator('#p4PlanDogs [data-p4-plan-dog]').first();
  await expect(dogRow).toContainText('Dog ID #00001');
  await expect(dogRow).toHaveAttribute('data-p4-dog-id', dogA);
  await expect(dogRow).toContainText('Saved care selected');
  await expect(dogRow).toContainText('Source completed 2026-10-05');
  await captureCarePlanStage(page, 'dogs', testInfo);
  await page.locator('#p4Dog').fill('Changed current form');
  await page.locator('#p4Breed').fill('Changed breed');
  await page.locator('#p4PlanNext').click();
  await expect(page.locator('#p4PlanStepLabel')).toContainText('Dates');
  const dateContext = page.locator('#p4PlanVisits [data-p4-dates-dog]');
  await expect(dateContext).toContainText('Dog ID #00001');
  await expect(dateContext).toHaveAttribute('data-p4-dog-id', dogA);
  await expect(dateContext).toContainText('Saved care selected');
  await expect(dateContext).toContainText('Source completed 2026-10-05');
  await captureCarePlanStage(page, 'dates', testInfo);
  await page.locator('#p4PlanMode').selectOption('same-day');
  await page.locator('#p4PlanStart').fill('2026-11-10');
  await page.locator('#p4PlanAddVisit').click();
  await page.locator('#p4PlanNext').click();
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanStatus')).toContainText('confirmed saved');
  const write = (await page.evaluate(() => window.fixtureWrites))[0];
  expect(write.dogName).toBe('Luna');
  expect(write.breed).toBe('Pug');
  expect(write.dogId).toBe(dogA);
  expect(write.inheritCareReview).toEqual({
    sourceDogId: dogA, sourceStayId: 'stay-exact', sourceStayKey: 'Luna|2026-10-01|2026-10-06',
    sourceEndDate: '2026-10-06', sourceCompletedDate: '2026-10-05', confirmed: true,
    profile: { feedingTimes: '6:30 am', foodAllergies: 'Chicken' }, riskFlags: { foodAllergy: true, escapeRisk: false }
  });
  expect(write).not.toHaveProperty('careDraft');
  expect(write).not.toHaveProperty('careSource');
  expect(await page.evaluate(() => window.fixtureReads.length)).toBe(readCount);
  if (process.env.WAFFLE_CAPTURE_UI_EVIDENCE === '1' && ['chromium', 'chromium-390'].includes(testInfo.project.name)) {
    const dir = path.join(root, 'output', 'releases', '2026.10.23.01', 'evidence');
    fs.mkdirSync(dir, { recursive: true });
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const dark = width === 320;
      await page.evaluate(value => document.body.classList.toggle('dark-theme', value), dark);
      await page.screenshot({ path: path.join(dir, `plan-care-context-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    }
  }
});

test('dog edits are targeted, cancelable, care changes require reconfirmation, and remove names the exact dog', async ({ page }) => {
  await setup(page);
  await page.evaluate(({ dogA }) => {
    const core = window.WAFFLE_PHASE4_CORE, original = core.read;
    core.read = async payload => {
      if (payload.action !== 'get_dog_history') return original(payload);
      window.fixtureReads.push(payload);
      if (payload.dogId === dogA) return { history: {
        previousStays: [{ stayId: 'stay-exact', stayKey: 'Luna|2026-10-01|2026-10-06', startDate: '2026-10-01', endDate: '2026-10-06', status: 'checked_out' }],
        latestCompletedProfile: { sourceDogId: dogA, sourceStayId: 'stay-exact', sourceStayKey: 'Luna|2026-10-01|2026-10-06', sourceEndDate: '2026-10-06', sourceCompletedDate: '2026-10-06', intakeAttributes: { feedingTimes: '7 am' }, riskFlags: { foodAllergy: true } }
      } };
      return new Promise(resolve => { window.resolveDogBHistory = () => resolve({ history: { previousStays: [], stayCount: 0 } }); });
    };
  }, { dogA });
  await page.locator('#p4Dog').fill('Luna');
  await page.locator('#p4LoadDogIdentities').click();
  await page.locator('#p4DogIdentity').selectOption(dogA);
  await openSavedCare(page);
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('7 am');
  await page.locator('#p4PlanAddDog').click();
  const originalLuna = page.locator('#p4PlanDogs [data-p4-plan-dog]').first();
  await expect(originalLuna).toContainText('No care copied');
  await expect(originalLuna).toContainText('Source completed 2026-10-06');
  await addDog(page, 'Milo', dogB);
  const readCount = await page.evaluate(() => window.fixtureReads.length);
  const luna = page.getByRole('button', { name: 'Edit Luna · Dog ID #00001' });
  await luna.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#p4Dog')).toHaveValue('Luna');
  await page.locator('#p4PlanDogCancel').click();
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogB);
  await expect(page.locator('#p4ReturningMini')).not.toContainText('Loading this Dog ID');
  await expect(page.locator('[data-p4-load-saved-care]')).toBeEnabled();
  await luna.click();
  await page.locator('#p4PlanNext').click();
  await expect(page.locator('#p4PlanStatus')).toContainText('Update or cancel the current dog edit');
  await page.locator('#p4PlanBack').click();
  await expect(page.locator('#p4PlanStepLabel')).toContainText('Dogs');
  await page.locator('#p4PlanDisclosure > summary').click();
  await expect(page.locator('#p4PlanDisclosure')).toHaveAttribute('open', '');
  await expect(page.locator('#p4DogIdentity')).toBeDisabled();
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogA);
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('7 am');
  const readsBeforeIdentityAttempt = await page.evaluate(() => window.fixtureReads.length);
  await page.evaluate(dogB => { const select = document.querySelector('#p4DogIdentity'); select.value = dogB; select.dispatchEvent(new Event('change', { bubbles: true })); }, dogB);
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogA);
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('7 am');
  expect(await page.evaluate(() => window.fixtureReads.length)).toBe(readsBeforeIdentityAttempt);
  await openSavedCare(page);
  await page.locator('[data-p4-care-profile="feedingTimes"]').fill('6 am');
  await page.locator('#p4Breed').fill('Edited Pug');
  await expect(page.locator('#p4CareConfirm')).not.toBeChecked();
  await page.locator('#p4PlanDogUpdate').click();
  await expect(page.locator('#p4PlanStatus')).toContainText('Review and confirm care');
  await expect(page.locator('#p4PlanDogs [data-p4-plan-dog]')).toHaveCount(2);
  await page.locator('#p4CareConfirm').check();
  await page.locator('#p4PlanDogUpdate').click();
  await expect(page.getByRole('button', { name: 'Edit Luna · Dog ID #00001' })).toBeFocused();
  const updatedLuna = page.locator(`#p4PlanDogs [data-p4-dog-id="${dogA}"]`);
  await expect(updatedLuna).toContainText('Saved care selected');
  const editUpdated = page.getByRole('button', { name: 'Edit Luna · Dog ID #00001' });
  await editUpdated.click();
  await expect(page.locator('#p4Breed')).toHaveValue('Edited Pug');
  await openSavedCare(page);
  await page.evaluate(() => window.resolveDogBHistory?.());
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('6 am');
  await expect(page.locator('#p4ReturningMini')).toHaveAttribute('data-source-dog-id', dogA);
  await page.locator('[data-p4-care-profile="feedingTimes"]').fill('');
  await page.locator('[data-p4-care-risk="foodAllergy"]').selectOption('');
  await expect(page.locator('#p4CareConfirm')).toBeDisabled();
  await expect(page.locator('#p4PlanDogOmitCare')).toBeVisible();
  await page.locator('#p4PlanDogOmitCare').click();
  await expect(updatedLuna).toContainText('No care copied');
  await page.getByRole('button', { name: 'Edit Luna · Dog ID #00001' }).click();
  await openSavedCare(page);
  await expect(page.locator('#p4Dog')).toHaveJSProperty('readOnly', true);
  await page.locator('#p4Breed').fill('Temporary breed');
  await page.locator('#p4PlanDogCancel').click();
  await expect(page.getByRole('button', { name: 'Edit Luna · Dog ID #00001' })).toBeFocused();
  await expect(updatedLuna).toContainText('Luna');
  await expect(updatedLuna).not.toContainText('Temporary breed');
  await expect(page.locator('#p4Dog')).toHaveValue('Luna');
  await expect(page.getByRole('button', { name: 'Remove Milo · Dog ID #00002' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove Milo · Dog ID #00002' }).click();
  await expect(page.getByRole('button', { name: 'Edit Luna · Dog ID #00001' })).toBeFocused();
  await expect(page.locator('#p4PlanDogs [data-p4-plan-dog]')).toHaveCount(1);
  await expect(page.locator('#p4PlanDogs')).not.toContainText('Milo');
  expect(await page.evaluate(() => window.fixtureReads.length)).toBe(readCount);
  await page.locator('#p4PlanDisclosure > summary').click();
  await expect(page.locator('#p4DogIdentity')).toBeEnabled();
  expect(await page.evaluate(() => window.fixtureWrites)).toEqual([]);
});

test('an omitted unchanged saved-care source can be explicitly approved while editing', async ({ page }) => {
  await setup(page);
  await page.evaluate(dogId => {
    const original = window.WAFFLE_PHASE4_CORE.read;
    window.WAFFLE_PHASE4_CORE.read = async payload => {
      if (payload.action !== 'get_dog_history') return original(payload);
      window.fixtureReads.push(payload);
      return { history: {
        previousStays: [{ stayId: 'completed-source', stayKey: 'Luna|2026-10-01|2026-10-05', startDate: '2026-10-01', endDate: '2026-10-05' }],
        latestCompletedProfile: { sourceDogId: dogId, sourceStayId: 'completed-source', sourceStayKey: 'Luna|2026-10-01|2026-10-05', sourceEndDate: '2026-10-05', intakeAttributes: { feedingTimes: '7 am' }, riskFlags: { escapeRisk: false } }
      } };
    };
  }, dogA);
  await page.locator('#p4LoadDogIdentities').click();
  await page.locator('#p4DogIdentity').selectOption(dogA);
  await openSavedCare(page);
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('7 am');
  await page.locator('#p4PlanAddDog').click();
  await expect(page.locator('#p4PlanDogs')).toContainText('No care copied');
  const readCount = await page.evaluate(() => window.fixtureReads.length);
  await page.getByRole('button', { name: 'Edit Luna · Dog ID #00001' }).click();
  await openSavedCare(page);
  await page.locator('#p4CareConfirm').check();
  await page.locator('#p4PlanDogUpdate').click();
  await expect(page.locator('#p4PlanDogs')).toContainText('Saved care selected');
  await page.getByRole('button', { name: 'Edit Luna · Dog ID #00001' }).click();
  await openSavedCare(page);
  await page.locator('#p4CareConfirm').uncheck();
  await page.locator('#p4PlanDogUpdate').click();
  await expect(page.locator('#p4PlanDogs')).toContainText('No care copied');
  await page.getByRole('button', { name: 'Edit Luna · Dog ID #00001' }).click();
  await openSavedCare(page);
  await page.locator('#p4CareConfirm').check();
  await page.locator('#p4PlanDogUpdate').click();
  await expect(page.locator('#p4PlanDogs')).toContainText('Saved care selected');
  expect(await page.evaluate(() => window.fixtureReads.length)).toBe(readCount);
  await addVisit(page, '2026-11-10', '2026-11-11');
  await reviewAndSave(page);
  const [write] = await page.evaluate(() => window.fixtureWrites);
  expect(write.inheritCareReview).toMatchObject({ sourceDogId: dogA, sourceStayId: 'completed-source', confirmed: true, profile: { feedingTimes: '7 am' }, riskFlags: { escapeRisk: false } });
  expect(write).not.toHaveProperty('careReviewHtml');
  expect(write).not.toHaveProperty('careDraft');
});

test('guided steps announce progress and require each section before advancing', async ({ page }, testInfo) => {
  await setup(page);
  await expect(page.locator('#p4Paste')).toBeHidden();
  await expect(page.locator('#p4SaveConfirmed')).toBeHidden();
  const nav = page.getByRole('group', { name: 'Visit plan progress' });
  await expect(nav.getByRole('button')).toHaveCount(4);
  await nav.locator('[data-p4-plan-step="0"]').click();
  await expect(nav.locator('[aria-current="step"]')).toContainText('Owner');
  if (['chromium', 'chromium-390'].includes(testInfo.project.name)) await capturePlanEvidence(page, 'owner-320-light.png', 320, false);
  await page.locator('#p4PlanNext').click();
  await expect(page.locator('#p4PlanStepLabel')).toHaveText('Step 2 of 4 · Dogs');
  await expect(page.locator('#p4PlanNext')).toBeVisible();
  await page.locator('#p4PlanNext').click();
  await expect(page.locator('#p4PlanStepLabel')).toContainText('Dogs');
  await expect(page.locator('#p4PlanStatus')).toContainText('Add at least one dog');
  if (['chromium', 'chromium-390'].includes(testInfo.project.name)) await capturePlanEvidence(page, 'dogs-390-dark.png', 390, true);
  await addDog(page, 'Luna', dogA);
  await page.locator('#p4PlanNext').click();
  await expect(page.locator('#p4PlanStepLabel')).toContainText('Dates');
  await addVisit(page, '2026-11-10', '2026-11-11');
  await page.locator('#p4PlanNext').click();
  await expect(page.locator('#p4PlanStepLabel')).toContainText('Review');
  await expect(nav.locator('[aria-current="step"]')).toContainText('Review');
  await expect(page.locator('#p4PlanSave')).toBeEnabled();
  if (['chromium', 'chromium-390'].includes(testInfo.project.name)) {
    await capturePlanEvidence(page, 'review-1440-light.png', 1440, false);
    await capturePlanEvidence(page, 'review-390-dark.png', 390, true);
  }
});

test('weekly same-day visits expand into three independent occurrences', async ({ page }) => {
  await setup(page);
  await addDog(page, 'Luna', dogA);
  await page.locator('#p4PlanNext').click();
  await page.locator('#p4PlanMode').selectOption('same-day');
  await page.locator('#p4PlanStart').fill('2026-11-02');
  await page.locator('#p4PlanUntil').fill('2026-11-16');
  await page.locator('#p4PlanWeekly').click();
  await expect(page.locator('#p4PlanVisits .p4-plan-item')).toHaveCount(3);
  await expect(page.locator('#p4PlanVisits .p4-plan-item').first()).toContainText('Same-day visit · Mon, 2 Nov 2026');
  await expect(page.locator('#p4PlanVisits [data-p4-plan-remove-visit]').first()).toHaveAccessibleName('Remove Same-day visit · Mon, 2 Nov 2026');
  await openReview(page);
  await expect(page.locator('[data-p4-review-count]')).toHaveText('1 dog · 3 dates · 3 total stays');
  const review = page.locator('#p4PlanPreview');
  await expect(review.locator('[data-p4-review-dog]')).toHaveCount(1);
  await expect(review.locator('[data-p4-review-dog] strong')).toContainText('Luna · Dog #00001 · Pug');
  await expect(review.locator('[data-p4-review-visit]')).toHaveText([
    'Same-day visit · Mon, 2 Nov 2026', 'Same-day visit · Mon, 9 Nov 2026', 'Same-day visit · Mon, 16 Nov 2026'
  ]);
  await expect(review.locator('.p4-plan-review-contact')).toHaveCount(1);
  await expect(review.locator('.p4-plan-review-contact')).toContainText('Shared owner: Alex · Phone: 0400000000');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(dark => document.body.classList.toggle('dark-theme', dark), width === 390);
    const layout = await page.evaluate(() => {
      const host = document.querySelector('#p4PlanPreview');
      const card = host.querySelector('[data-p4-review-dog]');
      return { host: host.scrollWidth <= host.clientWidth, card: card.scrollWidth <= card.clientWidth };
    });
    expect(layout, `review should wrap without overflow at ${width}px`).toEqual({ host: true, card: true });
    if (width === 390) {
      const contrast = await review.locator('[data-p4-review-dog]').evaluate(card => {
        const style = getComputedStyle(card);
        const luminance = color => {
          const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
            const normalized = value / 255;
            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        const foreground = luminance(style.color), background = luminance(style.backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
      expect(contrast, 'review dates remain readable in dark mode').toBeGreaterThanOrEqual(4.5);
    }
  }
  await reviewAndSave(page);
  const writes = await page.evaluate(() => window.fixtureWrites);
  expect(writes.map(row => [row.startDate, row.endDate])).toEqual([
    ['2026-11-02', '2026-11-02'], ['2026-11-09', '2026-11-09'], ['2026-11-16', '2026-11-16']
  ]);
});

test('changing the input mode cannot relabel an existing overnight range as a single day', async ({ page }) => {
  await setup(page);
  await addDog(page, 'Luna', dogA);
  await addVisit(page, '2026-11-10', '2026-11-12');
  await page.locator('#p4PlanMode').selectOption('same-day');
  await page.locator('#p4PlanStart').fill('2026-11-20');
  await page.locator('#p4PlanAddVisit').click();
  await expect(page.locator('#p4PlanVisits .p4-plan-item > span')).toHaveText([
    'Overnight stay · Tue, 10 Nov 2026 – Thu, 12 Nov 2026',
    'Same-day visit · Fri, 20 Nov 2026'
  ]);
  await page.locator('#p4PlanNext').click();
  await expect(page.locator('#p4PlanSave')).toBeDisabled();
  expect(await page.evaluate(() => window.fixtureWrites)).toEqual([]);
});

test('a newly created Dog ID is reused by later visits for that dog', async ({ page }) => {
  await setup(page);
  await addDog(page, 'Poppy', '');
  await addVisit(page, '2026-11-10', '2026-11-11');
  await addVisit(page, '2026-11-20', '2026-11-21');
  await reviewAndSave(page);
  const writes = await page.evaluate(() => window.fixtureWrites);
  expect(writes).toHaveLength(2);
  expect(writes[0].dogId).toBeUndefined();
  expect(writes[1].dogId).toBe(newDogA);
  expect(writes[1].inheritDogPhoto).toBe(true);
  expect(writes[0].stayId).not.toBe(writes[1].stayId);
});

test('resume retries only the failed visit with its original stable intent', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    let calls = 0;
    const original = window.WAFFLE_PHASE4_CORE.write;
    window.WAFFLE_PHASE4_CORE.write = async payload => {
      calls++;
      if (calls === 2) {
        window.fixtureWrites.push(structuredClone(payload));
        return { result: 'error', error: 'temporary outage' };
      }
      return original(payload);
    };
  });
  await addDog(page, 'Luna', dogA);
  await addVisit(page, '2026-11-10', '2026-11-11');
  await addVisit(page, '2026-11-20', '2026-11-21');
  await expect(page.locator('#p4PlanVisits .p4-plan-item')).toHaveCount(2);
  await openReview(page);
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('.p4-plan-review-dogs')).toBeHidden();
  await expect(page.locator('#p4PlanRows')).toBeVisible();
  await expect(page.locator('#p4PlanRows')).toContainText('saved');
  await expect(page.locator('#p4PlanRows')).toContainText('temporary outage');
  await page.locator('#p4PlanDisclosure summary').click();
  await expect(page.locator('#p4PlanDisclosure')).not.toHaveAttribute('open', '');
  await expect(page.locator('#p4Dog')).toBeEnabled();
  await page.locator('#p4DogIdentity').selectOption('');
  await page.locator('#p4Dog').fill('Scout');
  await page.locator('#p4Breed').fill('Kelpie');
  await page.locator('#p4Owner').fill('Jordan');
  await page.locator('#p4Phone').fill('0422222222');
  await page.locator('#p4Start').fill('2026-12-01');
  await page.locator('#p4End').fill('2026-12-03');
  await expect(page.locator('#p4SaveConfirmed')).toBeEnabled();
  await page.locator('#p4SaveConfirmed').click();
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(3);
  const singleWrite = await page.evaluate(() => window.fixtureWrites[2]);
  expect(singleWrite.action).toBe('create_boarding');
  expect(singleWrite.dogName).toBe('Scout');
  expect(singleWrite.startDate).toBe('2026-12-01');
  await page.locator('#p4PlanDisclosure summary').click();
  await expect(page.locator('#p4PlanDisclosure')).toHaveAttribute('open', '');
  await openReview(page);
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanStatus')).toContainText('confirmed saved');
  const after = await page.evaluate(() => window.fixtureWrites);
  expect(after).toHaveLength(4);
  expect(after[0].stayId).not.toBe(after[3].stayId);
  expect(after[1].stayId).toBe(after[3].stayId);
  expect(after[1]).toEqual(after[3]);
  await expect(page.locator('#p4PlanClear')).toBeEnabled();
  await page.locator('#p4PlanClear').click();
  await expect(page.locator('#p4PlanDogs')).toContainText('No dogs added yet');
});

test('queued result freezes plan controls and is not reported as saved', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.WAFFLE_PHASE4_CORE.write = async () => ({ result: 'success', queued: true }); });
  await addDog(page, 'Luna', dogA);
  await addVisit(page, '2026-11-10', '2026-11-11');
  await openReview(page);
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanRows')).toContainText('queued');
  await expect(page.locator('[data-p4-result-status="queued"]')).toHaveCount(1);
  await expect(page.locator('#p4PlanOwner')).toBeDisabled();
  await expect(page.locator('#p4PlanAddVisit')).toBeDisabled();
  await page.locator('[data-p4-plan-step="1"]').click();
  await expect(page.getByRole('button', { name: 'Edit Luna · Dog ID #00001' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Remove Luna · Dog ID #00001' })).toBeDisabled();
  await expect(page.locator('#p4PlanSave')).toBeEnabled();
  await expect(page.locator('#p4PlanStatus')).toHaveText('Waiting for sync confirmation');
  await expect(page.locator('#p4PlanStatus')).not.toContainText('saved');
});

test('same-name identity collision is blocked before any plan write', async ({ page }) => {
  await setup(page);
  await addDog(page, 'Luna', dogA);
  await page.evaluate(({ dogC }) => { window.identityRows.push({ dogId: dogC, dogNumber: '00004', dogName: 'Luna', breed: 'Pug', ownerName: 'Blair' }); }, { dogC });
  await page.locator('#p4LoadDogIdentities').click();
  await addDog(page, 'Luna', dogC);
  await expect(page.locator('#p4PlanStatus')).toContainText('Dogs with the same name cannot be distinguished safely');
  expect(await page.evaluate(() => window.fixtureWrites)).toHaveLength(0);
});

test('same-name dogs remain unselected until the exact identity card is chosen', async ({ page }) => {
  await setup(page);
  await page.evaluate(({ dogC }) => {
    window.identityRows.push({ dogId: dogC, dogNumber: '00004', dogName: 'Luna', breed: 'Pug', ownerName: 'Blair' });
  }, { dogC });
  await page.locator('#p4Dog').fill('Luna');
  await page.locator('#p4LoadDogIdentities').click();
  await expect(page.locator('#p4IdentitySearch')).toHaveAttribute('aria-label', /Search existing dogs/);
  await page.locator('#p4IdentitySearch').fill('Luna');
  const matchingCards = page.locator('#p4IdentityCards [data-p4-identity]');
  await expect(matchingCards).toHaveCount(2);
  await expect(page.locator('#p4DogIdentity')).toHaveValue('');
  await expect(matchingCards.nth(0)).toContainText('00001');
  await expect(matchingCards.nth(1)).toContainText('00004');
  await matchingCards.nth(1).click();
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogC);
  await expect(page.locator(`#p4IdentityCards [data-p4-identity="${dogC}"]`)).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.fixtureReads.filter(x => x.action === 'get_dog_history'))).toHaveLength(0);
  await page.locator('[data-p4-load-saved-care]').click();
  await expect.poll(() => page.evaluate(() => window.fixtureReads.some(x => x.action === 'get_dog_history' && x.dogId === 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'))).toBeTruthy();
  expect(await page.evaluate(() => window.fixtureWrites)).toHaveLength(0);
});

test('aggregate preferred-capacity warning requires acknowledgement before saving', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.WAFFLE_PHASE4_CORE.settings = () => ({ preferred: 1, absolute: 3 }); });
  await addDog(page, 'Luna', dogA);
  await addDog(page, 'Milo', dogB);
  await addVisit(page, '2026-11-10', '2026-11-11');
  await openReview(page);
  await expect(page.locator('#p4PlanPreview')).toContainText('above the preferred setting');
  await expect(page.locator('#p4PlanAckLabel')).toBeVisible();
  await expect(page.locator('#p4PlanSave')).toBeDisabled();
  await page.locator('#p4PlanCapacityAck').check();
  await expect(page.locator('#p4PlanSave')).toBeEnabled();
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanStatus')).toContainText('confirmed saved');
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(2);
});

test('review invalidates after edits, and the layout fits narrow, wide, dark, and enlarged text viewports', async ({ page }) => {
  await setup(page);
  await addDog(page, 'Luna', dogA);
  await addVisit(page, '2026-11-10', '2026-11-11');
  await openReview(page);
  await expect(page.locator('#p4PlanSave')).toBeEnabled();
  await page.locator('[data-p4-plan-step="0"]').click();
  await page.locator('#p4PlanPhone').fill('0411111111');
  await expect(page.locator('#p4PlanSave')).toBeDisabled();
  await expect(page.locator('#p4PlanPreview')).toBeEmpty();
  await openReview(page);
  await expect(page.locator('#p4PlanPreview')).toContainText('0411111111');
  await expect(page.locator('#p4PlanSave')).toBeEnabled();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme: width === 390 ? 'dark' : 'light' });
    await page.evaluate(dark => {
      document.body.classList.toggle('dark-theme', dark);
      document.documentElement.style.fontSize = '200%';
    }, width === 390);
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth > document.documentElement.clientWidth,
      panel: document.querySelector('.p4-plan').scrollWidth > document.querySelector('.p4-plan').clientWidth
    }));
    expect(overflow, `horizontal overflow at ${width}px`).toEqual({ body: false, panel: false });
    await expect(page.locator('#p4PlanReview')).toHaveCSS('min-height', /.+/);
    expect(await page.locator('#p4PlanReview').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
});

test('editing reviewed plan content requires a fresh review before the new values can be saved', async ({ page }) => {
  await setup(page);
  await addDog(page, 'Luna', dogA);
  await addVisit(page, '2026-11-10', '2026-11-11');
  await openReview(page);
  await expect(page.locator('#p4PlanSave')).toBeEnabled();
  await page.locator('[data-p4-plan-step="0"]').click();
  await page.locator('#p4PlanOwner').fill('Blair');
  await expect(page.locator('#p4PlanSave')).toBeDisabled();
  await expect(page.locator('#p4PlanPreview')).toBeEmpty();
  expect(await page.evaluate(() => window.fixtureWrites)).toHaveLength(0);
  await openReview(page);
  await expect(page.locator('#p4PlanPreview')).toContainText('Blair');
  await expect(page.locator('#p4PlanSave')).toBeEnabled();
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanStatus')).toContainText('confirmed saved');
  expect((await page.evaluate(() => window.fixtureWrites))[0].ownerName).toBe('Blair');
});

test('rapid double confirmation sends one concurrent write per planned stay', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.writeGate = new Promise(resolve => { window.releaseWrites = resolve; }); });
  await addDog(page, 'Luna', dogA);
  await addVisit(page, '2026-11-10', '2026-11-11');
  await openReview(page);
  await page.locator('#p4PlanSave').click();
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(1);
  await page.evaluate(() => {
    const save = document.querySelector('#p4PlanSave').onclick;
    save();
    save();
  });
  await page.evaluate(() => window.releaseWrites());
  await expect(page.locator('#p4PlanStatus')).toContainText('confirmed saved');
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(1);
});
