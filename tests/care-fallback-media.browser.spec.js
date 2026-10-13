const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const source = fs.readFileSync('care.js', 'utf8');
const start = source.indexOf('  async function fallbackMedia(card) {');
const end = source.indexOf('\n  async function fallbackMaster(card)', start);
const fallback = source.slice(start, end).replace(/^  /gm, '');

async function setup(page, api) {
  await page.setContent('<article class="directory-card" data-directory-stay-key="milo|2026-10-10|2026-10-12" data-directory-stay-id="stay-a" data-directory-dog-id="dog-a"><section data-directory-detail="media"><div data-v110-media-host></div></section></article>');
  await page.addScriptTag({ content: `
    window.html = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    window.panel = (card, key) => card.querySelector('[data-directory-detail="' + key + '"]');
    window.queryAppsScript = async () => { throw new Error('fallback query must not be used'); };
    window.WAFFLE_CARE_BELONGINGS_READS = ${api};
    ${fallback}
    window.runFallbackMedia = fallbackMedia;
  ` });
}

test('legacy Photos fallback uses the shared identity-safe reader when available', async ({ page }) => {
  await setup(page, `{ read: async (card, options) => { window.sharedReadCount = (window.sharedReadCount || 0) + 1; window.sharedIdentity = [card.dataset.directoryStayId, card.dataset.directoryDogId]; return { data: { record: { stayPhotos: [{id:'photo-1', label:'Playtime', url:'https://photos.test/stay.jpg'}] } } }; } }`);
  await page.evaluate(() => { void runFallbackMedia(document.querySelector('.directory-card')); });
  await expect(page.locator('[data-v110-media-host]')).toContainText('Playtime');
  expect(await page.evaluate(() => window.sharedReadCount)).toBe(1);
  expect(await page.evaluate(() => window.sharedIdentity)).toEqual(['stay-a', 'dog-a']);
});

test('legacy Photos fallback ignores a shared read after the card changes identity', async ({ page }) => {
  await setup(page, `{ read: (card, options) => new Promise(resolve => { window.finishSharedRead = result => resolve({ data: { record: result } }); }) }`);
  await page.evaluate(() => { void runFallbackMedia(document.querySelector('.directory-card')); });
  await page.evaluate(() => { document.querySelector('.directory-card').dataset.directoryDogId = 'dog-b'; window.finishSharedRead({ stayPhotos: [{id:'old', label:'Old dog photo', url:'https://photos.test/old.jpg'}] }); });
  await expect(page.locator('[data-v110-media-host]')).toContainText('Loading photos');
  await expect(page.locator('[data-v110-media-host]')).not.toContainText('Old dog photo');
});

test('legacy Photos fallback retains current UI when its shared read is superseded', async ({ page }) => {
  await setup(page, `{ read: () => new Promise(resolve => { window.finishSharedRead = () => resolve({ superseded: true, data: { record: null } }); }) }`);
  await page.evaluate(() => { void runFallbackMedia(document.querySelector('.directory-card')); });
  await page.locator('[data-v110-media-host]').evaluate(host => { host.innerHTML = '<p>Newer saved photos</p>'; });
  await page.evaluate(() => window.finishSharedRead());
  await expect(page.locator('[data-v110-media-host]')).toContainText('Newer saved photos');
});
