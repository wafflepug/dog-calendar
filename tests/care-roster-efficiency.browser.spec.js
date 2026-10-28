const { test, expect } = require('@playwright/test');
const { install } = require('./fixtures/care-daily-workflows');
const fs = require('node:fs');
const path = require('node:path');

test('roster search clear, Today filter reset and stay tabs stay efficient and keyboard operable', async ({ page, baseURL }) => {
  const fixture = await install(page);
  // Hold only the scheduled count task while proving that cold Arriving
  // navigation does not fetch Past. Release the real task after loading Past.
  await page.route('**/waffle-v10.8.6.js*', async route => {
    const runtime = fs.readFileSync(path.join(__dirname, '..', 'waffle-v10.8.6.js'), 'utf8');
    const gate = `;(function(){const background=window.v1086BackgroundLoadPastStays,schedule=window.setTimeout;let released=false,pending=null;window.__rosterPastCountRan=false;window.setTimeout=function(callback,delay,...args){if(callback===background&&delay===1600)return schedule.call(window,()=>{const task=()=>{callback(...args);window.__rosterPastCountRan=true;};if(released)task();else pending=task;},delay);return schedule.call(window,callback,delay,...args);};window.__releaseRosterPastCount=()=>{released=true;if(pending){const task=pending;pending=null;task();}};})();`;
    await route.fulfill({status:200,contentType:'application/javascript',body:runtime+gate});
  });
  await page.goto(`${baseURL}/directory.html?dailyCareFixture=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && window.WAFFLE_CARE_ROSTER_FOCUS);

  const toolbar = page.locator('.guest-directory-toolbar');
  const search = toolbar.locator('#guestDirectorySearch');
  const clearSearch = toolbar.locator('[data-directory-search-clear]');
  const status = toolbar.locator('#directory-search-status');
  await expect(clearSearch).toBeHidden();
  await search.fill('Milo');
  await expect(clearSearch).toBeVisible();
  await expect(status.locator('[data-directory-search-message]')).toContainText('match');
  await clearSearch.click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(status).toBeHidden();

  const disclosure = toolbar.locator('[data-care-roster-focus]');
  await disclosure.locator('summary').click();
  await disclosure.locator('[data-focus-mode="arriving"]').click();
  const reset = toolbar.locator('[data-focus-clear]');
  await expect(reset).toBeVisible();
  await expect(disclosure).not.toHaveAttribute('open', '');
  await expect(disclosure.locator('[data-focus-summary]')).toContainText('Arriving today');
  await expect(status.locator('[data-directory-search-message]')).toContainText('Arriving today');
  await reset.click();
  await expect(disclosure.locator('summary')).toBeFocused();
  await expect(reset).toBeHidden();
  await expect(disclosure.locator('[data-focus-summary]')).toHaveText("Today's work");

  const tabs = page.locator('[data-v1082-stay-tab]');
  await expect(page.locator('[data-v1082-stay-tab][aria-selected="true"]')).toHaveCount(1);
  await expect(page.locator('[data-v1082-stay-tab][aria-selected="true"]')).toHaveAttribute('tabindex', '0');
  await expect(page.locator('[data-v1082-stay-tab][aria-selected="false"][tabindex="0"]')).toHaveCount(0);
  await page.locator('[data-v1082-stay-tab="current"]').focus();
  const pastReadsBeforeFuture = fixture.reads.filter(action => action === 'get_past_guest_directory').length;
  expect(pastReadsBeforeFuture).toBe(0);
  const selectionBeforeKey = await page.evaluate(() => window.WAFFLE_DIRECTORY_PROFILE_NAV.selectionVersion);
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => window.WAFFLE_DIRECTORY_PROFILE_NAV.selectionVersion)).toBe(selectionBeforeKey + 1);
  await expect(page.locator('[data-v1082-stay-tab="future"]')).toBeFocused();
  await expect(page.locator('[data-v1082-stay-tab="future"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-v1082-stay-tab="future"]')).toHaveAttribute('tabindex', '0');
  expect(fixture.reads.filter(action => action === 'get_past_guest_directory')).toHaveLength(pastReadsBeforeFuture);
  await page.keyboard.press('End');
  await expect(page.locator('[data-v1082-stay-tab="past"]')).toBeFocused();
  await expect(page.locator('[data-v1082-stay-tab="past"]')).toHaveAttribute('aria-selected', 'true');
  await page.waitForFunction(() => typeof v1082PastLoaded !== 'undefined' && v1082PastLoaded === true);
  await page.evaluate(() => window.__releaseRosterPastCount());
  const pastReads = fixture.reads.filter(action => action === 'get_past_guest_directory').length;
  expect(pastReads).toBeGreaterThan(0);
  await page.keyboard.press('End');
  expect(fixture.reads.filter(action => action === 'get_past_guest_directory')).toHaveLength(pastReads);
  await page.keyboard.press('Home');
  await expect(page.locator('[data-v1082-stay-tab="current"]')).toHaveAttribute('aria-selected', 'true');
  await page.locator(`#directory-grid [data-directory-stay-id="${fixture.bookings[0].stayId}"] [data-open-directory-profile]`).click();
  await expect(page.locator('.directory-dashboard-fused')).toHaveClass(/is-profile-mode/);
  await expect(disclosure).toBeHidden();
  await expect(reset).toBeHidden();
  await page.waitForFunction(() => window.__rosterPastCountRan === true);
  expect(fixture.reads.filter(action => action === 'get_past_guest_directory')).toHaveLength(pastReads);
});

test('Enter opens only one visible loaded Care search result without guessing a same-name guest', async ({ page, baseURL }) => {
  const fixture = await install(page);
  await page.goto(`${baseURL}/directory.html?careSearchShortcutFixture=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && window.WAFFLE_CARE_ROSTER_FOCUS);
  const search = page.locator('#guestDirectorySearch');
  const dashboard = page.locator('.directory-dashboard-fused');
  const profileReads = () => fixture.reads.filter(action => action === 'get_guest_profile').length;
  for (const query of ['', 'Milo', 'not-a-loaded-guest']) {
    await search.fill(query);
    await search.press('Enter');
    await expect(dashboard).not.toHaveClass(/is-profile-mode/);
  }
  expect(profileReads()).toBe(0);
  await search.fill('#00018');
  await expect(page.locator('#directory-grid .directory-card:visible')).toHaveCount(1);
  for (const key of ['Control+Enter', 'Meta+Enter', 'Alt+Enter', 'Shift+Enter']) {
    await search.press(key);
    await expect(dashboard).not.toHaveClass(/is-profile-mode/);
  }
  for (const values of [{ isComposing: true }, { repeat: true }, { keyCode: 229 }]) {
    await search.evaluate((input, values) => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...values })), values);
    await expect(dashboard).not.toHaveClass(/is-profile-mode/);
  }
  await search.evaluate(input => {
    input.addEventListener('keydown', event => event.preventDefault(), { once: true, capture: true });
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  });
  await expect(dashboard).not.toHaveClass(/is-profile-mode/);
  expect(profileReads()).toBe(0);
  await search.press('Enter');
  const selected = page.locator(`#directory-grid [data-directory-stay-id="${fixture.bookings[1].stayId}"]`);
  await expect(selected).toHaveClass(/is-profile-active/);
  await expect(selected.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state', 'fresh');
  await expect(page.locator(`#directory-grid [data-directory-stay-id="${fixture.bookings[0].stayId}"]`)).not.toHaveClass(/is-profile-active/);
  expect(profileReads()).toBe(1);
  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(search).toHaveValue('#00018');
  await expect(selected.locator('[data-open-directory-profile]')).toBeVisible();
});

test('search Enter respects filters and due checkout stays direct without opening a profile behind review', async ({ page, baseURL }, testInfo) => {
  const fixture = await install(page);
  await page.goto(`${baseURL}/directory.html?careSearchShortcutFixture=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && window.WAFFLE_CARE_ROSTER_FOCUS);
  const search = page.locator('#guestDirectorySearch');
  const dashboard = page.locator('.directory-dashboard-fused');
  const focus = page.locator('[data-care-roster-focus]');
  await focus.locator('summary').click();
  await focus.locator('[data-focus-mode="leaving"]').click();
  await search.fill('Milo');
  await expect(page.locator('#directory-grid .directory-card:visible')).toHaveCount(1);
  const result = page.locator(`#directory-grid [data-directory-stay-id="${fixture.bookings[1].stayId}"] > [data-open-directory-profile]`);
  await result.evaluate(button => button.disabled = true);
  await search.press('Enter');
  await expect(dashboard).not.toHaveClass(/is-profile-mode/);
  await result.evaluate(button => button.disabled = false);
  const card = result.locator('..');
  const actions = card.locator('[data-v11217-roster-actions] > button');
  await expect(actions).toHaveCount(2);
  const boxes = await actions.evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().toJSON()));
  for (const box of boxes) { expect(box.height).toBeGreaterThanOrEqual(44); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(testInfo.project.use.viewport.width + 1); }
  expect(boxes[0].right <= boxes[1].left + 1 || boxes[0].bottom <= boxes[1].top + 1).toBe(true);
  await card.locator('[data-v11217-roster-checkout]').click();
  const review = page.locator('#v11217GuidedCheckout');
  await expect(review).toBeVisible();
  await expect(review.locator('[data-v11217-guided-dogid]')).toContainText('#00018');
  await search.press('Enter');
  await expect(dashboard).not.toHaveClass(/is-profile-mode/);
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(fixture.reads.filter(action => action === 'get_guest_profile')).toHaveLength(0);
  await search.press('Enter');
  await expect(result.locator('..')).toHaveClass(/is-profile-active/);
  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(search).toHaveValue('Milo');
  await expect(focus.locator('[data-focus-mode="leaving"]')).toHaveAttribute('aria-pressed', 'true');
});
