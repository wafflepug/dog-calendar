const fs = require('node:fs');
const { test, expect } = require('@playwright/test');

test('sidebar queue review is hidden when empty and opens conflict review on phone and desktop', async ({ page }) => {
  const source = fs.readFileSync('waffle-v10.8.js', 'utf8');
  const start = source.indexOf('async function v108RefreshQueueBadge()');
  const end = source.indexOf('function v108EnsureQueueModal()', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  await page.setContent('<body data-waffle-page="directory"><div class="calendar-header-branding"></div><div id="wh75MobileDrawer"><div class="wh75-nav-section"><div class="wh75-nav-heading">Account</div></div></div></body>');
  await page.evaluate(() => {
    window.reviewOpened = 0;
    window.v108OpenQueueModal = () => { window.reviewOpened++; };
    window.v108RefreshQueueBadge = async () => {};
  });
  await page.addScriptTag({ path: 'waffle-sitter-navigation.js' });
  await page.evaluate(() => {
    window.v108EnsureQueueUi = () => document.createElement('button');
    window.entries = [];
    window.v108QueueAll = async () => window.entries;
  });
  await page.addScriptTag({ content: source.slice(start, end) });
  const desktop = page.viewportSize().width >= 1024;
  const review = page.locator(desktop
    ? '#whSitterDesktopTools [data-wh-sitter-sync-review]'
    : '#whSitterMobileHeaderTools [data-wh-sitter-sync-review]');
  await page.evaluate(() => v108RefreshQueueBadge());
  await expect(review).toBeHidden();
  await page.evaluate(async () => {
    window.entries = [{ status: 'conflict' }];
    await v108RefreshQueueBadge();
  });
  await expect(review).toBeVisible();
  await expect(review).toHaveAttribute('aria-label', 'Review 1 queued updates needing attention');
  await review.click();
  await expect.poll(() => page.evaluate(() => window.reviewOpened)).toBe(1);
  await page.evaluate(async () => { window.entries = []; await v108RefreshQueueBadge(); });
  await expect(review).toBeHidden();
});
