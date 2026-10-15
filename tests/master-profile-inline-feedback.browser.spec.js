const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const runtime = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.js'), 'utf8').replace(/\r\n/g, '\n');
const styles = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.css'), 'utf8');
const helpersStart = runtime.indexOf('const v110ActiveMasterSaves=new Set();');
const helpersEnd = runtime.indexOf('function v110Escape(', helpersStart);
const saveStart = runtime.indexOf('async function v110SaveMasterFromCard(');
const saveEnd = runtime.indexOf('\n\n/* Media */', saveStart);
if (helpersStart < 0 || helpersEnd <= helpersStart || saveStart < 0 || saveEnd <= saveStart) throw new Error('Master Profile runtime section was not found');

test('Master Profile transport failures show a retry and preserve the selected stay payload', async ({ page }) => {
  await page.setContent(`<style>${styles}</style><article class="directory-card" data-payload='{"stayId":"stay-a","stayKey":"twin|2026-10-11|2026-10-14","dogId":"dog-a","dogName":"Twin Pup","breed":"Cavoodle","startDate":"2026-10-11","endDate":"2026-10-14"}'><section class="v110-master-actions"><button data-v110-save-master>⭐ Sync This Stay to Master Profile</button></section></article>`);
  await page.evaluate(() => {
    window.savedPayloads = [];
    window.failCount = 2;
    window.v110MasterCache = {};
    window.v110OperationalPayloadFromCard = card => JSON.parse(card.dataset.payload);
    window.sendPayloadToAppsScript = async payload => {
      window.savedPayloads.push({ ...payload });
      if (window.failCount > 0) { window.failCount -= 1; throw new TypeError('Failed to fetch'); }
      return { record: { dogName: payload.dogName, persisted: true } };
    };
    window.v110RenderMasterProfile = (card, record) => { card.dataset.savedRecord = record.dogName; };
  });
  await page.addScriptTag({ content: `${runtime.slice(helpersStart, helpersEnd)}\n${runtime.slice(saveStart, saveEnd)}` });
  await page.evaluate(() => v110SaveMasterFromCard(document.querySelector('.directory-card'), document.querySelector('[data-v110-save-master]')));
  const card = page.locator('.directory-card');
  const feedback = card.locator('.v110-master-actions > .v110-action-feedback');
  await expect(feedback).toContainText('Master Profile could not be saved');
  const firstRetry = feedback.getByRole('button', { name: 'Retry' });
  await expect(firstRetry).toBeVisible();
  const retrySize = await firstRetry.evaluate(button => ({ height: button.getBoundingClientRect().height, fontSize: parseFloat(getComputedStyle(button).fontSize) }));
  expect(retrySize.height).toBeGreaterThanOrEqual(44);
  expect(retrySize.fontSize).toBe(13);
  expect(await page.evaluate(() => window.savedPayloads.length)).toBe(1);
  await feedback.getByRole('button', { name: 'Retry' }).focus();
  await page.keyboard.press('Enter');
  const secondRetry = feedback.getByRole('button', { name: 'Retry' });
  await expect(secondRetry).toBeFocused();
  await secondRetry.click();
  await expect(card).toHaveAttribute('data-saved-record', 'Twin Pup');
  await expect(feedback).toContainText('Master Profile saved');
  expect(await page.evaluate(() => window.savedPayloads.map(payload => [payload.stayId, payload.dogId, payload.notes]))).toEqual([
    ['stay-a', 'dog-a', ''], ['stay-a', 'dog-a', ''], ['stay-a', 'dog-a', '']
  ]);
});
