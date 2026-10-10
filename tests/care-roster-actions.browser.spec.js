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
    window.v110OperationForStay = payload => window.operations.get(payload.stayId) || null;
    window.v110OperationDisplayState = card => {
      if (card.dataset.identityCollision === 'true') return { code: 'collision' };
      const operation = window.operations.get(card.dataset.directoryStayId);
      return operation ? { code: operation.status } : { code: 'date_active' };
    };
    window.v110EnsureCareOperationBar = () => {};
    window.v110EnhanceCareCard = () => {};
    window.v110SaveOperationalStatus = async (payload, status) => {
      window.savedPayloads.push({ ...payload, status });
      if (window.failNextSave) { window.failNextSave = false; throw new Error('Synthetic network failure'); }
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

test('roster actions are separate from profile open, isolate same-name dogs, recover failures, and move checkout to Past', async ({ page }) => {
  await setup(page);
  const staying = page.locator('[data-directory-stay-id="stay-a"]');
  const checkin = staying.locator('[data-v11217-roster-checkin]');
  await expect(checkin).toHaveAccessibleName('Check in Twin Pup');
  await expect(staying.locator('[data-v11217-roster-checkout]')).toHaveAccessibleName('Check out Twin Pup');
  expect(await checkin.evaluate(button => button.closest('.directory-guest-tile-open'))).toBeNull();

  await page.evaluate(() => { window.failNextSave = true; });
  await checkin.click();
  await expect(checkin).toHaveText(/Check In/);
  await expect(checkin).toBeEnabled();
  await expect.poll(() => page.evaluate(() => window.alertMessages.length)).toBe(1);
  await checkin.click();
  await expect(staying.locator('[data-v11217-roster-checkin]')).toHaveCount(0);
  expect(await page.evaluate(() => window.savedPayloads.map(item => [item.stayId, item.dogId, item.status]))).toEqual([
    ['stay-a', '11111111-1111-4111-8111-111111111111', 'checked_in'],
    ['stay-a', '11111111-1111-4111-8111-111111111111', 'checked_in']
  ]);
  await staying.locator('[data-v11217-roster-checkout]').click();
  await expect(staying).toHaveAttribute('data-moved-to-past', 'true');
  await expect(staying.locator('[data-v11217-roster-actions]')).toHaveCount(0);
  expect(await page.evaluate(() => window.profileOpenCount)).toBe(0);
  expect(await page.evaluate(() => window.profileReadCount)).toBe(0);
});

test('early checkout uses its review modal and controls fit on a narrow mobile viewport', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 360, height: 780 });
  const early = page.locator('[data-directory-stay-id="stay-b"]');
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
  await dialog.locator('[data-v11217-confirm]').click();
  await expect(dialog).toBeHidden();
  await expect(early).toHaveAttribute('data-moved-to-past', 'true');
  expect(await page.evaluate(() => window.savedPayloads.at(-1))).toMatchObject({
    stayId: 'stay-b', dogId: '22222222-2222-4222-8222-222222222222', status: 'checked_out'
  });
  expect(await page.locator('[data-directory-stay-id="stay-future"] [data-v11217-roster-actions]').count()).toBe(0);
  expect(await page.locator('[data-directory-stay-id="stay-past"] [data-v11217-roster-actions]').count()).toBe(0);
  expect(await page.evaluate(() => window.profileOpenCount)).toBe(0);
});
