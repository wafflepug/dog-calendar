const { test, expect } = require('@playwright/test');
const { install, bookings } = require('./fixtures/care-daily-workflows');

async function openCare(page, baseURL) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const fixture = await install(page);
  await page.goto(`${baseURL}/directory.html?onboardingFixture=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true' && window.WAFFLE_PHASE4_BOOKING);
  await expect(page.locator('#directory-grid .directory-card')).toHaveCount(3);
  await expect(page.locator('.directory-dashboard-fused')).toHaveAttribute('data-directory-roster-load-state', 'success');
  return { ...fixture, errors };
}

async function openBoarding(page) {
  const width = page.viewportSize().width;
  const add = width < 768 ? page.locator('#wh75MobileBottomNav [data-wh78-quick-add]') : page.locator('#v10QuickAddButton');
  await add.click();
  const sheet = page.locator('#v10QuickAddSheet');
  await expect(sheet.locator('[data-v10-quick-action="boarding"]')).toHaveAttribute('data-wh89-validated', 'true');
  const redundantMutations = await page.evaluate(async () => {
    const sheet = document.getElementById('v10QuickAddSheet');
    const mutations = [];
    const observer = new MutationObserver(records => { mutations.push(...records.map(record => ({ type: record.type, target: record.target.id || record.target.nodeName, attribute: record.attributeName, oldValue: record.oldValue }))); });
    observer.observe(sheet.querySelector('.v10-quick-actions'), { subtree: true, childList: true });
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    observer.disconnect();
    return mutations;
  });
  expect(redundantMutations, 'quick-action reconciliation should not rebuild unchanged labels').toEqual([]);
  await sheet.locator('[data-v10-quick-action="boarding"]').click();
  await expect(page.locator('#v108BoardingModal')).toBeVisible();
  return page.locator('#v108BoardingModal');
}

test('Care opens Boarding without navigation or speculative name reads and retains an unfinished draft', async ({ page, baseURL }, testInfo) => {
  test.setTimeout(60000);
  const fixture = await openCare(page, baseURL);
  const url = page.url();
  let documents = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  const modal = await openBoarding(page);
  await modal.locator('[data-v108-board="dogName"]').fill('Long new dog name for onboarding');
  await modal.locator('[data-v108-board="phone"]').fill('0412345678');
  await modal.locator('[data-v108-board="notes"]').fill('Unsaved arrival note');
  await modal.locator('[data-v108-close]').first().click();
  await openBoarding(page);
  await expect(modal.locator('[data-v108-board="dogName"]')).toHaveValue('Long new dog name for onboarding');
  await expect(modal.locator('[data-v108-board="phone"]')).toHaveValue('0412345678');
  await expect(modal.locator('[data-v108-board="notes"]')).toHaveValue('Unsaved arrival note');
  expect(page.url()).toBe(url);
  expect(documents).toBe(0);
  // Drain the old 450ms debounce deterministically: any former eager lookup
  // would execute by this point. Full runtime retains all real input handlers.
  await page.waitForTimeout(550);
  expect(fixture.reads.filter(action => action === 'get_returning_guest_prefill')).toHaveLength(0);
  expect(fixture.reads.filter(action => action === 'get_dog_history')).toHaveLength(0);
  for (const dark of [false, true]) {
    await page.evaluate(value => document.body.classList.toggle('dark-theme', value), dark);
    const save = modal.locator('[data-v108-save-board]');
    await save.scrollIntoViewIfNeeded();
    const bounds = await save.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    const hit = await save.evaluate(node => {
      const r = node.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return top === node || node.contains(top);
    });
    expect(hit).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`boarding-draft-${dark ? 'dark' : 'light'}.png`) });
  }
  expect(fixture.errors).toEqual([]);
});

test('a confirmed stay refreshes Care in place and keeps the selected guest', async ({ page, baseURL }, testInfo) => {
  test.setTimeout(60000);
  const fixture = await openCare(page, baseURL);
  const selected = page.locator(`.directory-card[data-directory-stay-id="${bookings[0].stayId}"]`);
  await selected.locator('[data-open-directory-profile]').click();
  await expect(selected).toHaveClass(/is-profile-active/);
  const url = page.url();
  let writes = 0;
  await page.exposeFunction('__onboardingSave', payload => {
    writes++;
    fixture.bookings.push({ ...payload, timestamp: '2026-10-18', bookingType: 'Boarding', dogId: '22222222-2222-4222-8222-222222222222', stayId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', dogNumber: '#00020', stayKey: `${payload.dogName.toLowerCase()}|${payload.startDate}|${payload.endDate}` });
    return { result: 'success', stayId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', dogId: '22222222-2222-4222-8222-222222222222', intake: { link: 'https://example.test/owner-intake?token=synthetic' } };
  });
  await page.evaluate(() => { window.sendPayloadToAppsScript = payload => window.__onboardingSave(payload); });
  const modal = await openBoarding(page);
  for (const [field, value] of Object.entries({ dogName: 'Hazel', breed: 'Kelpie', ownerName: 'Alex', phone: '0412345678', startDate: '2026-10-18', endDate: '2026-10-22' })) {
    await modal.locator(`[data-v108-board="${field}"]`).fill(value);
  }
  const before = fixture.reads.filter(action => action === 'get_guest_directory').length;
  await modal.locator('[data-v108-save-board]').click();
  await expect(modal.locator('[data-v108-board-status]')).toHaveAttribute('data-mode', 'success');
  await expect.poll(() => fixture.reads.filter(action => action === 'get_guest_directory').length).toBe(before + 1);
  await expect(page.locator('.directory-card[data-directory-dog-name="Hazel"]')).toHaveCount(1);
  await expect(modal.locator('[data-v108-save-board]')).toBeHidden();
  for (const selector of ['.v108-modal-actions [data-v108-close]', '[data-v108-add-same-owner]', '[data-v108-add-another]']) {
    const action = modal.locator(selector);
    await action.scrollIntoViewIfNeeded();
    const reachable = await action.evaluate(node => {
      const r = node.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return r.height >= 44 && r.left >= 0 && r.right <= innerWidth && (hit === node || node.contains(hit));
    });
    expect(reachable, `${selector} should be reachable without footer overlap`).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('boarding-success-actions.png') });
  await modal.locator('[data-v108-close]').first().click();
  await expect(selected).toHaveClass(/is-profile-active/);
  expect(page.url()).toBe(url);
  expect(writes).toBe(1);
  expect(fixture.errors).toEqual([]);
});
