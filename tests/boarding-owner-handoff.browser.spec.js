const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'waffle-v10.8.js'), 'utf8');
const start = source.indexOf('function v108EnsureBoardingModal(){');
const end = source.indexOf('// Capture before V10\'s old Google Form handler.', start);
if (start < 0 || end < 0) throw new Error('Could not extract the primary boarding modal functions.');
const boardingSource = source.slice(start, end);

async function openHarness(page, saveHandler) {
  await page.setContent('<body></body>');
  await page.evaluate(({ boardingSource, saveHandlerSource }) => {
    window.getLocalTodayDateString = () => '2026-10-18';
    window.v108ReturningTimer = 0;
    window.WAFFLE_PAGE = 'home';
    window.v108RawQueryAppsScript = async () => ({ prefill: { matched: false } });
    window.syncSpreadsheetData = async () => {};
    window.saveHandler = new Function('payload', `return (${saveHandlerSource})(payload);`);
    window.sendPayloadToAppsScript = payload => {
      window.savedPayloads.push(payload);
      return window.saveHandler(payload);
    };
    window.savedPayloads = [];
    window.WAFFLE_OWNER_HANDOFF = {
      render(host, detail) {
        const handoff = document.createElement('div');
        handoff.dataset.ownerHandoff = 'true';
        handoff.textContent = `${detail.dogName} ${detail.link}`;
        host.appendChild(handoff);
        return handoff;
      }
    };
    eval(`${boardingSource}\nwindow.boardingHarness = { open: v108OpenBoarding, save: v108SaveBoarding, lookup: v108LookupReturning };`);
    v108EnsureBoardingModal();
    const missing = ['[data-v108-board-summary]','[data-v108-form-grid]','[data-v108-identity-note]','[data-v108-intake-result]'].filter(selector => !document.querySelector(selector));
    if (missing.length) throw new Error(`Missing boarding markup: ${missing.join(', ')}`);
    window.boardingHarness.open();
  }, { boardingSource, saveHandlerSource: saveHandler.toString() });
  await page.locator('[data-v108-board="dogName"]').fill('Milo');
  await page.locator('[data-v108-board="breed"]').fill('Kelpie');
  await page.locator('[data-v108-board="startDate"]').fill('2026-10-20');
  await page.locator('[data-v108-board="endDate"]').fill('2026-10-22');
  await page.locator('[data-v108-board="ownerName"]').fill('Alex Owner');
  await page.locator('[data-v108-board="phone"]').fill('0400000000');
}

test('successful booking locks its intent, renders the owner handoff, and Add another dog resets the form', async ({ page }) => {
  await openHarness(page, async () => ({ intake: { link: 'https://care.example/form/123' } }));
  await page.getByRole('button', { name: '🏡 Create Booking' }).click();
  await expect(page.locator('[data-owner-handoff]')).toContainText('Milo https://care.example/form/123');
  await expect(page.locator('[data-v108-board="dogName"]')).toBeDisabled();
  await expect(page.locator('[data-v108-choose-returning]')).toBeDisabled();
  await expect(page.getByRole('button', { name: '＋ Add another dog' })).toBeVisible();
  await page.evaluate(() => window.boardingHarness.save());
  expect(await page.evaluate(() => window.savedPayloads)).toHaveLength(1);

  await page.getByRole('button', { name: '＋ Add another dog' }).click();
  await expect(page.locator('[data-v108-board="dogName"]')).toHaveValue('');
  await expect(page.locator('[data-v108-board="dogName"]')).toBeEnabled();
  await expect(page.locator('[data-v108-choose-returning]')).toBeEnabled();
  await expect(page.locator('[data-v108-board-status]')).not.toHaveAttribute('data-mode', 'success');
  await expect(page.getByRole('button', { name: '🏡 Create Booking' })).toBeEnabled();
});

test('queued saves remain locked across close and reopen without offering another save', async ({ page }) => {
  await openHarness(page, async () => ({ queued: true }));
  await page.getByRole('button', { name: '🏡 Create Booking' }).click();
  await expect(page.locator('[data-v108-board-status]')).toContainText('Check sync status, then find the guest in Care.');
  await expect(page.locator('[data-v108-board="dogName"]')).toBeDisabled();
  await expect(page.getByRole('button', { name: /awaiting sync/ })).toBeDisabled();
  await page.locator('[data-v108-close]').first().click();
  await page.evaluate(() => window.boardingHarness.open());
  await expect(page.locator('#v108BoardingModal')).toBeVisible();
  await expect(page.locator('[data-v108-board="dogName"]')).toHaveValue('Milo');
  await expect(page.locator('[data-v108-board="dogName"]')).toBeDisabled();
  await page.evaluate(() => window.boardingHarness.save());
  expect(await page.evaluate(() => window.savedPayloads)).toHaveLength(1);
  await page.getByRole('button', { name: '＋ Add another dog' }).click();
  await expect(page.locator('[data-v108-board="dogName"]')).toHaveValue('');
  await expect(page.locator('[data-v108-save-board]')).toBeEnabled();
  expect(await page.evaluate(() => window.savedPayloads)).toHaveLength(1);
});

test('failed booking keeps the entered values and allows retry', async ({ page }) => {
  await openHarness(page, async () => { throw new Error('Temporary connection failure'); });
  await page.getByRole('button', { name: '🏡 Create Booking' }).click();
  await expect(page.locator('[data-v108-board-status]')).toContainText('Temporary connection failure');
  await expect(page.locator('[data-v108-board="dogName"]')).toHaveValue('Milo');
  await expect(page.locator('[data-v108-board="dogName"]')).toBeEnabled();
  await page.evaluate(() => { window.saveHandler = async () => ({ intake: { link: 'https://care.example/form/again' } }); });
  await page.getByRole('button', { name: '🏡 Create Booking' }).click();
  await expect(page.locator('[data-owner-handoff]')).toContainText('https://care.example/form/again');
  expect(await page.evaluate(() => window.savedPayloads)).toHaveLength(2);
});

test('closing and reopening during an in-flight save preserves the pending intent and blocks duplicates', async ({ page }) => {
  await openHarness(page, async () => new Promise(resolve => { window.resolveSave = resolve; }));
  await page.getByRole('button', { name: '🏡 Create Booking' }).click();
  await expect(page.locator('[data-v108-board="dogName"]')).toBeDisabled();
  await page.locator('[data-v108-close]').first().click();
  await page.evaluate(() => window.boardingHarness.open());
  await expect(page.locator('#v108BoardingModal')).toBeVisible();
  await expect(page.locator('[data-v108-board="dogName"]')).toHaveValue('Milo');
  await expect(page.getByRole('button', { name: /Saving/ })).toBeDisabled();
  await page.evaluate(() => window.boardingHarness.save());
  expect(await page.evaluate(() => window.savedPayloads)).toHaveLength(1);
  await page.evaluate(() => window.resolveSave({ intake: { link: 'https://care.example/form/pending' } }));
  await expect(page.locator('[data-owner-handoff]')).toContainText('https://care.example/form/pending');
});

test('returning-dog selection passes the complete entered stay to the exact-ID handoff', async ({ page }) => {
  await openHarness(page, async () => ({ result: 'success' }));
  await page.evaluate(() => {
    window.WAFFLE_PHASE4_BOOKING = { openReturningBooking: async draft => { window.returningDraft = draft; } };
  });
  const chooser = page.locator('[data-v108-choose-returning]');
  const grid = page.locator('[data-v108-form-grid]');
  expect(await chooser.evaluate(node => node.compareDocumentPosition(document.querySelector('[data-v108-form-grid]')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await chooser.click();
  await expect(page.locator('#v108BoardingModal')).toBeHidden();
  expect(await page.evaluate(() => window.returningDraft)).toMatchObject({
    dogName: 'Milo', breed: 'Kelpie', startDate: '2026-10-20', endDate: '2026-10-22',
    ownerName: 'Alex Owner', phone: '0400000000', source: 'Direct'
  });
  await expect(grid).not.toHaveAttribute('hidden', '');
  await expect(page.locator('[data-v108-board="dogName"]')).toHaveValue('Milo');
});

test('a stale returning-dog lookup cannot replace the current name match', async ({ page }) => {
  await openHarness(page, async () => ({ result: 'success' }));
  await page.evaluate(() => {
    window.prefillResolvers = [];
    window.v108RawQueryAppsScript = () => new Promise(resolve => window.prefillResolvers.push(resolve));
  });
  const oldLookup = page.evaluate(() => window.boardingHarness.lookup());
  await page.locator('[data-v108-board="dogName"]').fill('New Dog');
  await page.evaluate(() => window.prefillResolvers[0]({ prefill: { matched: true, stayCount: 3 } }));
  await oldLookup;
  await expect(page.locator('[data-v108-returning]')).toBeHidden();
});
