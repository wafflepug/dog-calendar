const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const calendar = fs.readFileSync(path.join(__dirname, 'fixtures/fullcalendar.global.min.js'), 'utf8');

async function installReadOnlyRuntime(page, writes) {
  await page.route('**/*', async route => {
    const req = route.request(), url = req.url();
    if (!['GET', 'HEAD'].includes(req.method())) {
      writes.push(req.method());
      return route.fulfill({ status: 405, body: 'Read-only fixture' });
    }
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      return route.fulfill({ contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n' });
    }
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) {
      return route.fulfill({ contentType: 'application/javascript', body: calendar });
    }
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: req.method(), url });
      if (!resolved.policy.allowed) {
        writes.push(resolved.action);
        return route.fulfill({ status: 403, body: 'Read-only fixture' });
      }
      const callback = new URL(url).searchParams.get('callback');
      const response = { result: 'success', bookings: [], records: [], summaries: [], identities: [], totalPastStays: 0 };
      return route.fulfill({ contentType: 'application/javascript', body: callback ? `${callback}(${JSON.stringify(response)});` : JSON.stringify(response) });
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') {
      return route.fulfill({ body: '', contentType: req.resourceType() === 'script' ? 'application/javascript' : 'text/css' });
    }
    return route.continue();
  });
}

test('the shipped loader opens Multiple visits from Add and restores a reusable menu', async ({ page, baseURL }, testInfo) => {
  const writes = [];
  await installReadOnlyRuntime(page, writes);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${baseURL}/directory.html?bookingPlanRuntime=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && window.WAFFLE_PHASE4_BOOKING?.openPlan && window.WAFFLE_BOOKING_PLAN?.createPlan);
    const add = width < 768 ? page.locator('#wh75MobileBottomNav [data-wh78-quick-add]') : page.locator('#v10QuickAddButton');
    await add.click();
    const sheet = page.locator('#v10QuickAddSheet');
    await expect(sheet).toBeVisible();
    await page.locator('[data-v10-quick-action="visit-plan"]').click();
    await expect(sheet).toBeHidden();
    const modal = page.locator('#p4Modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#p4PlanDisclosure')).toHaveAttribute('open', '');
    await page.locator('#p4PlanOwner').fill('Fixture owner');
    const captureRuntime = process.env.WAFFLE_CAPTURE_UI_EVIDENCE === '1' && ['chromium', 'chromium-390'].includes(testInfo.project.name);
    const evidenceDir = path.resolve(__dirname, '..', 'output', 'releases', '2026.10.22.01', 'evidence');
    if (captureRuntime) {
      fs.mkdirSync(evidenceDir, { recursive: true });
      const darkOwner = width === 1440;
      await page.evaluate(dark => document.body.classList.toggle('dark-theme', dark), darkOwner);
      await page.screenshot({ path: path.join(evidenceDir, `runtime-owner-${width}-${darkOwner ? 'dark' : 'light'}.png`), fullPage: true });
    }
    await page.locator('#p4PlanNext').click();
    await expect(page.locator('#p4PlanStepLabel')).toContainText('Dogs');
    await page.locator('#p4Dog').fill('Unsaved fixture guest');
    if (captureRuntime) {
      const darkDogs = width === 390;
      await page.evaluate(dark => document.body.classList.toggle('dark-theme', dark), darkDogs);
      await page.screenshot({ path: path.join(evidenceDir, `runtime-dogs-${width}-${darkDogs ? 'dark' : 'light'}.png`), fullPage: true });
      await page.evaluate(() => document.body.classList.remove('dark-theme'));
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await modal.locator('[data-p4-close]').click();
    await expect(modal).toBeHidden();
    await expect(add).toBeFocused();
    await add.click();
    await expect(sheet).toBeVisible();
    await expect(sheet).not.toHaveAttribute('aria-hidden', 'true');
    await page.locator('[data-v10-quick-action="visit-plan"]').click();
    await expect(page.locator('#p4PlanStepLabel')).toContainText('Dogs');
    await expect(page.locator('#p4Dog')).toHaveValue('Unsaved fixture guest');
    await expect(page.locator('#p4PlanOwner')).toHaveValue('Fixture owner');
    await page.locator('[data-p4-plan-step="0"]').click();
    await page.locator('#p4PlanPhone').fill('0400000000');
    await page.locator('#p4PlanNext').click();
    await page.locator('#p4DogIdentity').selectOption('');
    await page.locator('#p4Breed').fill('Pug');
    await page.locator('#p4PlanAddDog').click();
    await page.locator('#p4PlanNext').click();
    await page.locator('#p4PlanMode').selectOption('same-day');
    await page.locator('#p4PlanStart').fill('2026-11-02');
    await page.locator('#p4PlanUntil').fill('2026-11-16');
    await page.locator('#p4PlanWeekly').click();
    await page.locator('#p4PlanNext').click();
    await expect(page.locator('[data-p4-review-count]')).toHaveText('1 dog · 3 dates · 3 total stays');
    await expect(page.locator('[data-p4-review-visit]')).toHaveCount(3);
    await expect(page.locator('#p4PlanRows')).toBeHidden();
    await expect(page.locator('.p4-plan-review-contact')).toHaveCount(1);
    if (captureRuntime) {
      await page.evaluate(dark => document.body.classList.toggle('dark-theme', dark), width === 390);
      await page.screenshot({ path: path.join(evidenceDir, `runtime-review-${width}.png`), fullPage: true });
    }
    expect(await page.locator('.p4-plan-review').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await modal.locator('[data-p4-close]').click();
  }
  expect(writes).toEqual([]);
});


test('the shipped booking modal keeps returning Care compact, editable and reachable', async ({ page, baseURL }, testInfo) => {
  const writes = [];
  await installReadOnlyRuntime(page, writes);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(baseURL + '/directory.html?returningCareRuntime=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && window.WAFFLE_PHASE4_BOOKING?.openPlan);
    await page.evaluate(() => {
      const query = window.queryAppsScript, dogId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      window.returningRuntimeReads = [];
      const readFixture = async (payload, options) => {
        if (!['list_dog_identities', 'get_dog_history'].includes(payload.action)) return query(payload, options);
        window.returningRuntimeReads.push(payload.action);
        if (payload.action === 'list_dog_identities') return { result: 'success', identities: [{ dogId, dogNumber: '00017', dogName: 'Fixture Luna', breed: 'Pug', ownerName: 'Alex Example' }] };
        return { result: 'success', history: {
          previousStays: [{ stayId: 'fixture-prior', stayKey: 'Fixture Luna|2026-10-01|2026-10-06', startDate: '2026-10-01', endDate: '2026-10-06' }],
          latestCompletedProfile: { sourceDogId: dogId, sourceStayId: 'fixture-prior', sourceStayKey: 'Fixture Luna|2026-10-01|2026-10-06', sourceStartDate: '2026-10-01', sourceEndDate: '2026-10-06', intakeAttributes: { feedingTimes: '7 am and 5 pm', foodAllergies: 'Chicken', sleepLocation: 'Own bed' }, riskFlags: { foodAllergy: true, escapeRisk: false } }
        } };
      };
      window.queryAppsScript = readFixture;
      if (window.queryAppsScript !== readFixture) throw new Error('Read-only fixture hook unavailable');
    });
    const add = width < 768 ? page.locator('#wh75MobileBottomNav [data-wh78-quick-add]') : page.locator('#v10QuickAddButton');
    await add.click();
    await page.locator('[data-v10-quick-action="visit-plan"]').click();
    const modal = page.locator('#p4Modal');
    await expect(modal).toBeVisible();
    await page.locator('#p4PlanOwner').fill('Alex Example');
    await page.locator('#p4PlanNext').click();
    await page.locator('#p4LoadDogIdentities').click();
    await expect(page.locator('#p4DogIdentity option[value="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]')).toHaveCount(1);
    await page.locator('#p4DogIdentity').selectOption('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const source = page.locator('.p4-care-source'), summary = page.locator('.p4-care-disclosure summary');
    await expect(source).toContainText('Dog ID #00017');
    await expect(source).toContainText('From stay ending 6 Oct 2026');
    await expect(page.locator('#p4CareConfirm')).toBeHidden();
    await source.scrollIntoViewIfNeeded();
    if (testInfo.project.name === 'chromium') {
      const dir = path.resolve(__dirname, '..', 'output', 'releases', '2026.10.22.03', 'evidence');
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, 'runtime-returning-care-' + width + '.png') });
    }
    const readsBefore = await page.evaluate(() => window.returningRuntimeReads.length);
    await summary.click();
    const feeding = page.locator('[data-p4-care-profile="feedingTimes"]');
    await feeding.fill('6:30 am and 5 pm');
    await page.locator('#p4CareConfirm').check();
    await summary.click();
    await expect(page.locator('[data-p4-care-decision]')).toHaveText('Reviewed care selected for copying.');
    await summary.click();
    await expect(feeding).toHaveValue('6:30 am and 5 pm');
    await expect(page.locator('#p4CareConfirm')).toBeChecked();
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.body.classList.toggle('dark-theme', dark), dark);
      await page.locator('#p4CareConfirm').scrollIntoViewIfNeeded();
      const layout = await modal.evaluate(node => {
        const confirm = node.querySelector('#p4CareConfirm').closest('label'), box = confirm.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        const body = node.querySelector('.p4-body').getBoundingClientRect();
        return { width: innerWidth, docWidth: document.documentElement.scrollWidth, height: box.height, hit: hit === confirm || confirm.contains(hit), inBody: box.top >= body.top - 1 && box.bottom <= body.bottom + 1 };
      });
      expect(layout.docWidth).toBeLessThanOrEqual(layout.width);
      expect(layout.height).toBeGreaterThanOrEqual(44);
      expect(layout.hit && layout.inBody, JSON.stringify(layout)).toBe(true);
    }
    await page.locator('#p4PlanAddDog').click();
    await page.locator('#p4PlanNext').click();
    await expect(page.locator('#p4PlanStepLabel')).toContainText('Dates');
    await expect(page.locator('#p4ReturningMini')).toBeHidden();
    await expect(page.locator('#p4PlanVisits [data-p4-dates-dog]')).toContainText('Fixture Luna');
    await expect(page.locator('#p4PlanVisits [data-p4-dates-dog]')).toContainText('Saved care selected');
    await page.locator('#p4PlanDisclosure > summary').click();
    await expect(source).toBeVisible();
    await expect(page.locator('#p4CareConfirm')).toBeChecked();
    expect(await page.evaluate(() => window.returningRuntimeReads.length)).toBe(readsBefore);
    await modal.locator('[data-p4-close]').click();
    await expect(modal).toBeHidden();
  }
  expect(writes).toEqual([]);
});
