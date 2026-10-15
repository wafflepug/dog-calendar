const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const calendar = fs.readFileSync(path.join(__dirname, 'fixtures/fullcalendar.global.min.js'), 'utf8');

test('the shipped loader opens Multiple visits from Add and restores a reusable menu', async ({ page, baseURL }, testInfo) => {
  const writes = [];
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
    const captureRuntime = process.env.WAFFLE_CAPTURE_UI_EVIDENCE === '1' && testInfo.project.name === 'chromium';
    const evidenceDir = path.resolve(__dirname, '..', 'output', 'releases', '2026.10.16.01', 'evidence');
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
    await modal.locator('[data-p4-close]').click();
  }
  expect(writes).toEqual([]);
});
