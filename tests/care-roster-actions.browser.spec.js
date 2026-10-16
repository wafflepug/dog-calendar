const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const earlyCheckoutRuntime = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.2.17.js'), 'utf8');

async function setup(page) {
  await page.setContent(`<!doctype html><html><head></head><body data-waffle-page="directory">
    <main class="directory-dashboard-fused"><div class="directory-grid directory-grid-fused">
      ${card('a', '2026-10-11', '2026-10-11', '11111111-1111-4111-8111-111111111111')}
      ${card('b', '2026-10-11', '2026-10-14', '22222222-2222-4222-8222-222222222222')}
      ${card('future', '2026-10-12', '2026-10-14', '33333333-3333-4333-8333-333333333333')}
      ${card('past', '2026-10-08', '2026-10-10', '44444444-4444-4444-8444-444444444444')}
    </div></main></body></html>`);
  await page.evaluate(() => {
    window.getLocalTodayDateString = () => '2026-10-11';
    window.operations = new Map();
    window.savedPayloads = [];
    window.profileOpenCount = 0;
    window.profileReadCount = 0;
    window.alertMessages = [];
    window.failNextSave = false;
    window.failMessage = 'Synthetic network failure';
    window.saveGate = null;
    window.releaseSave = null;
    window.v110OperationForStay = payload => window.operations.get(payload.stayId) || null;
    window.v110OperationDisplayState = card => {
      if (card.dataset.identityCollision === 'true') return { code: 'collision' };
      const operation = window.operations.get(card.dataset.directoryStayId);
      return operation ? { code: operation.status } : { code: 'date_active' };
    };
    window.v110EnsureCareOperationBar = () => {};
    window.v110EnhanceCareCard = () => {};
    window.v110ShowActionFeedback = (host, message, retry) => {
      let region = host.querySelector(':scope > .v110-action-feedback');
      if (!region) { region = document.createElement('div'); region.className = 'v110-action-feedback'; host.appendChild(region); }
      region.setAttribute('role', 'alert'); region.setAttribute('aria-live', 'assertive'); region.replaceChildren(document.createTextNode(message));
      if (retry) { const button = document.createElement('button'); button.textContent = 'Retry'; button.addEventListener('click', retry, { once: true }); region.appendChild(button); }
    };
    window.v110ClearActionFeedback = (host, message) => window.v110ShowActionFeedback(host, message, null);
    window.v110SaveOperationalStatus = async (payload, status) => {
      window.savedPayloads.push({ ...payload, status });
      if (window.saveGate) await window.saveGate;
      if (window.failNextSave) { window.failNextSave = false; throw new Error(window.failMessage); }
      const record = { ...payload, status, stayId: payload.stayId, stayKey: payload.stayKey };
      window.operations.set(payload.stayId, record);
      return { result: 'success', record };
    };
    window.v1086MoveCheckedOutStayToPast = card => { card.dataset.v1082PastStay = 'true'; card.dataset.movedToPast = 'true'; };
    window.confirm = () => true;
    window.alert = message => window.alertMessages.push(message);
    document.querySelectorAll('.directory-guest-tile-open').forEach(tile => tile.addEventListener('click', () => { window.profileOpenCount += 1; }));
  });
  await page.addScriptTag({ content: earlyCheckoutRuntime });
  await expect(page.locator('[data-v11217-roster-actions]')).toHaveCount(2);
}

function card(key, startDate, endDate, dogId) {
  return `<article class="directory-card directory-card-fused" data-directory-stay-id="stay-${key}" data-directory-stay-key="same-name|${startDate}|${endDate}|${key}" data-directory-dog-id="${dogId}" data-directory-dog-name="Twin Pup" data-directory-start-date="${startDate}" data-directory-end-date="${endDate}" data-v1088-breed="Cavoodle" data-v1088-owner-name="Owner ${key}">
    <button type="button" class="directory-guest-tile-open directory-roster-row" data-open-directory-profile><span class="directory-guest-tile-name">Twin Pup</span></button>
    <section class="directory-profile-content"></section>
  </article>`;
}

test('roster actions are separate from profile open, isolate same-name dogs, retry transport failures inline, and move checkout to Past', async ({ page }) => {
  await setup(page);
  const staying = page.locator('[data-directory-stay-id="stay-a"]');
  const checkin = staying.locator('[data-v11217-roster-checkin]');
  await expect(checkin).toHaveAccessibleName('Check in Twin Pup');
  const moreActions = staying.locator('.v11217-roster-more-actions');
  await expect(moreActions.locator('summary')).toHaveText('More actions');
  await moreActions.locator('summary').click();
  await expect(moreActions.locator('[data-v11217-roster-checkout]')).toHaveAccessibleName('Check out Twin Pup');
  await expect(staying.locator('[data-v11217-roster-actions] > button')).toHaveCount(1);
  expect(await checkin.evaluate(button => button.closest('.directory-guest-tile-open'))).toBeNull();

  await page.evaluate(() => { window.failNextSave = true; });
  await checkin.click();
  await expect(checkin).toHaveText(/Check In/);
  await expect(checkin).toBeEnabled();
  const feedback = staying.locator(':scope > .v110-action-feedback');
  await expect(feedback).toContainText('Check In could not be saved');
  await feedback.getByRole('button', { name: 'Retry' }).click();
  await expect(staying.locator('[data-v11217-roster-checkin]')).toHaveCount(0);
  await expect(staying.locator(':scope > .v110-action-feedback')).toContainText('Twin Pup checked in successfully');
  expect(await page.evaluate(() => window.savedPayloads.map(item => [item.stayId, item.dogId, item.status]))).toEqual([
    ['stay-a', '11111111-1111-4111-8111-111111111111', 'checked_in'],
    ['stay-a', '11111111-1111-4111-8111-111111111111', 'checked_in']
  ]);
  await staying.locator('[data-v11217-roster-checkout]').click();
  await expect(staying).toHaveAttribute('data-moved-to-past', 'true');
  await expect(staying.locator('[data-v11217-roster-actions]')).toHaveCount(0);
  expect(await page.evaluate(() => window.profileOpenCount)).toBe(0);
  expect(await page.evaluate(() => window.profileReadCount)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.alertMessages.length)).toBe(0);
});

test('identity ambiguity and offline failures offer review guidance without a retry', async ({ page }) => {
  await setup(page);
  const card = page.locator('[data-directory-stay-id="stay-a"]');
  await page.evaluate(() => { window.failNextSave = true; window.failMessage = 'Several operation rows match this booking. Review duplicate bookings and reload.'; });
  await card.locator('[data-v11217-roster-checkin]').click();
  const conflict = card.locator('.v110-action-feedback');
  await expect(conflict).toHaveAttribute('role', 'alert');
  await expect(conflict).toContainText('Review the booking identity and refresh Care');
  await expect(conflict.getByRole('button', { name: 'Retry' })).toHaveCount(0);

  await page.evaluate(() => { window.failNextSave = true; window.failMessage = 'Check-in requires a live connection. Nothing was queued.'; });
  await card.locator('[data-v11217-roster-checkin]').click();
  const offline = card.locator('.v110-action-feedback');
  await expect(offline).toHaveAttribute('role', 'alert');
  await expect(offline).toContainText('live connection');
  await expect(offline.getByRole('button', { name: 'Retry' })).toHaveCount(0);
});

test('a checked-in guest keeps Early Checkout as the sole direct action when no primary check-in or checkout is due', async ({ page }) => {
  await setup(page);
  const early = page.locator('[data-directory-stay-id="stay-b"]');
  await page.evaluate(() => {
    window.operations.set('stay-b', { stayId: 'stay-b', stayKey: 'same-name|2026-10-11|2026-10-14|b', dogId: '22222222-2222-4222-8222-222222222222', status: 'checked_in' });
    window.v110EnsureCareOperationBar(document.querySelector('[data-directory-stay-id="stay-b"]'));
  });
  await expect(early.locator('[data-v11217-roster-checkin]')).toHaveCount(0);
  await expect(early.locator('[data-v11217-roster-checkout]')).toHaveCount(0);
  await expect(early.locator('[data-v11217-early-checkout]')).toBeVisible();
  await expect(early.locator('.v11217-roster-more-actions')).toHaveCount(0);
});

test('a late save response cannot apply to a card reused for a different same-name stay', async ({ page }) => {
  await setup(page);
  const card = page.locator('.directory-card').nth(0);
  await page.evaluate(() => {
    window.saveGate = new Promise(resolve => { window.releaseSave = resolve; });
  });
  await card.locator('[data-v11217-roster-checkin]').click();
  await expect.poll(() => page.evaluate(() => window.savedPayloads.length)).toBe(1);
  await card.evaluate(node => {
    node.dataset.directoryStayId = 'stay-reused';
    node.dataset.directoryStayKey = 'another-stay|2026-10-11|2026-10-11';
    node.dataset.directoryDogId = '99999999-9999-4999-8999-999999999999';
  });
  await page.evaluate(() => window.releaseSave());
  await expect(card).toHaveAttribute('data-directory-stay-id', 'stay-reused');
  await expect(card.locator('[data-v11217-roster-checkin]')).toBeEnabled();
  await expect(card).not.toHaveAttribute('data-moved-to-past', 'true');
  await expect(card.locator('.v110-action-feedback')).toHaveCount(0);
  expect(await page.evaluate(() => window.operations.has('stay-reused'))).toBe(false);
});

test('early checkout uses its review modal and controls fit on a narrow mobile viewport', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 360, height: 780 });
  const early = page.locator('[data-directory-stay-id="stay-b"]');
  const moreActions = early.locator('.v11217-roster-more-actions');
  await moreActions.locator('summary').click();
  const button = early.locator('[data-v11217-early-checkout]');
  await expect(button).toHaveAccessibleName('Record early checkout for Twin Pup');
  const bounds = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    right: document.querySelector('[data-v11217-roster-actions]').getBoundingClientRect().right,
    height: document.querySelector('[data-v11217-roster-actions] button').getBoundingClientRect().height
  }));
  expect(bounds.width).toBeLessThanOrEqual(bounds.viewport);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.height).toBeGreaterThanOrEqual(44);

  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Early Checkout' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-v11217-dog]')).toHaveText('Twin Pup');
  await dialog.locator('[data-v11217-note]').fill('Owner collected early');
  await page.evaluate(() => { window.failNextSave = true; });
  await dialog.locator('[data-v11217-confirm]').click();
  await expect(dialog.locator('[data-v11217-feedback]')).toContainText('Early checkout could not be saved');
  const earlyRetry = dialog.getByRole('button', { name: 'Retry Early Checkout' });
  await expect(earlyRetry).toBeVisible();
  const retrySize = await earlyRetry.evaluate(button => ({ height: button.getBoundingClientRect().height, fontSize: parseFloat(getComputedStyle(button).fontSize) }));
  expect(retrySize.height).toBeGreaterThanOrEqual(44);
  expect(retrySize.fontSize).toBe(13);
  await expect(dialog.locator('[data-v11217-note]')).toHaveValue('Owner collected early');
  await dialog.getByRole('button', { name: 'Retry Early Checkout' }).click();
  await expect(dialog).toBeHidden();
  await expect(early).toHaveAttribute('data-moved-to-past', 'true');
  await expect(early.locator(':scope > .v110-action-feedback')).toContainText('checked out early successfully');
  expect(await page.evaluate(() => window.savedPayloads.at(-1))).toMatchObject({
    stayId: 'stay-b', dogId: '22222222-2222-4222-8222-222222222222', status: 'checked_out'
  });
  expect(await page.locator('[data-directory-stay-id="stay-future"] [data-v11217-roster-actions]').count()).toBe(0);
  expect(await page.locator('[data-directory-stay-id="stay-past"] [data-v11217-roster-actions]').count()).toBe(0);
  expect(await page.evaluate(() => window.profileOpenCount)).toBe(0);
});
