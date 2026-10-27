const { test, expect } = require('@playwright/test');
const { install } = require('./fixtures/care-daily-workflows');

for (const theme of ['light', 'dark']) {
  test(`desktop Home stays compact beside the canonical calendar and survives mobile resizing (${theme})`, async ({ page }) => {
    const fixture = await install(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(mode => localStorage.setItem('theme', mode), theme);
    await page.goto('/index.html?view=today', { waitUntil: 'networkidle' });
    await expect(page.locator('#wh65Calendar')).toBeVisible();
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const geometry = () => page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, right:r.right, bottom:r.bottom }; };
      return { left:rect('.wh-desktop-home-column'), right:rect('.wh-desktop-calendar-column'), host:rect('#wh65Calendar'), width:document.documentElement.scrollWidth };
    });
    for (const width of [1440, 1920]) {
      await page.setViewportSize({ width, height:1000 });
      await expect.poll(async () => (await geometry()).right.width).toBeGreaterThanOrEqual(600);
      const g = await geometry();
      expect(g.left.width).toBeGreaterThanOrEqual(360);
      expect(g.left.width).toBeLessThanOrEqual(400);
      expect(g.right.x).toBeGreaterThanOrEqual(g.left.right);
      expect(Math.abs(g.left.y - g.host.y)).toBeLessThan(2);
      expect(g.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path:`output/desktop-home-layout-${width}-${theme}.png`, fullPage:true, animations:'disabled' });
    }
    const title = page.locator('#wh65Calendar .wh65-title');
    const originalTitle = await title.textContent();
    await page.locator('[data-wh69-next]').click();
    await expect(title).not.toHaveText(originalTitle);
    const nextTitle = await title.textContent();
    await page.locator('[data-wh69-view="week"]').click();
    await expect(page.locator('[data-wh69-view="week"]')).toHaveAttribute('aria-pressed','true');
    await page.locator('[data-wh69-view="month"]').click();
    await page.locator('#wh65Calendar').evaluate(node => { window.__layoutHost = node; });
    const profilesBefore = fixture.reads.filter(action => action === 'get_guest_profile').length;
    await page.setViewportSize({width:1024,height:900});
    const stacked = await geometry();
    expect(stacked.right.y).toBeGreaterThanOrEqual(stacked.left.bottom);
    expect(stacked.width).toBeLessThanOrEqual(1024);
    for (const width of [820,390]) {
      await page.setViewportSize({width,height:844});
      await expect(page.locator('.wh-desktop-home-layout')).toHaveCount(0);
      await expect(page.locator('#calendarTabPanel > .v10-operations-home')).toBeVisible();
      await expect(page.locator('#calendarTabPanel > #wh65Calendar')).toBeHidden();
      await expect(page.locator('#calendarSearch')).toHaveCount(0);
      await expect(page.locator('#calendarTabPanel > .summary-dashboard')).toHaveCount(0);
      expect(await page.locator('#wh65Calendar').evaluate(node => node === window.__layoutHost)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({width:1440,height:1000});
    await expect(page.locator('.wh-desktop-calendar-column > #wh65Calendar')).toBeVisible();
    expect(await page.locator('#wh65Calendar').evaluate(node => node === window.__layoutHost)).toBe(true);
    await expect(title).toHaveText(nextTitle);
    expect(fixture.reads.filter(action => action === 'get_guest_profile').length).toBe(profilesBefore);
    for (const id of ['calendar','wh65Calendar','whHomeGuests','whHomeArrivals','whHomePotentials']) await expect(page.locator(`#${id}`)).toHaveCount(1);
    await page.locator('[data-v1118-search-open]').click();
    await expect(page.locator('#v1118SearchModal')).toBeVisible();
    await page.locator('[data-v1118-search-input]').fill('Milo');
    await expect(page.locator('[data-v1118-search-input]')).toHaveValue('Milo');
    await page.locator('[data-v1118-search-close]').click();
    await expect(page.locator('#v1118SearchModal')).toBeHidden();
    for (const route of ['/index.html?view=calendar','/index.html']) {
      await page.goto(route,{waitUntil:'networkidle'});
      await expect(page.locator('.wh-desktop-calendar-column > #wh65Calendar')).toBeVisible();
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto('/index.html?view=calendar',{waitUntil:'networkidle'});
    await expect(page.locator('#calendarTabPanel > #wh65Calendar')).toBeVisible();
    await expect(page.locator('.v10-operations-home')).toBeHidden();
    expect(errors).toEqual([]);
  });
}
