const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const v108Source = fs.readFileSync(path.join(__dirname, '..', 'waffle-v10.8.js'), 'utf8');
const v110Source = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.js'), 'utf8');
const renderHistory = v108Source.match(/function v108RenderHistory\(host,h\)\{[\s\S]*?\n\}/)?.[0];
const renderPhotoGrid = v110Source.match(/function v110PhotoGrid\(photos,opt=\{\}\)\{[\s\S]*?\n\}/)?.[0];
const renderMedia = v110Source.match(/function v110RenderMedia\(card,r\)\{[^\n]*\}/)?.[0];

test('Care history compacts repeated contacts and keeps changed contacts with their stay', async ({ page }) => {
  expect(renderHistory).toBeTruthy();
  await page.setContent('<div data-history></div>');
  await page.addScriptTag({ content: `
    function escapeDashboardHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function v10FormatDateLabel(value) { return value; }
  ` });
  await page.evaluate(source => { window.v108RenderHistory = (0, eval)(`(${source})`); }, renderHistory);
  const history = {
    dogId: 'dog-a', stayCount: 3,
    owners: [
      { ownerName: 'Alex Smith', phone: '0400 111 222' },
      { ownerName: ' Alex Smith ', phone: '0400 111 222 ' },
      { ownerName: 'Alex Smith', phone: '0400 999 888' },
      { ownerName: 'Morgan Lee', phone: '0400 333 444' }
    ],
    previousStays: [
      { startDate: '2026-05-01', ownerName: 'Alex Smith', phone: '0400 111 222', breed: 'Kelpie' },
      { startDate: '2025-05-01', ownerName: 'Alex Smith', phone: '0400 999 888', breed: 'Kelpie' },
      { startDate: '2024-05-01', ownerName: 'Morgan Lee', phone: '0400 333 444', breed: 'Kelpie' }
    ]
  };
  await page.evaluate(data => window.v108RenderHistory(document.querySelector('[data-history]'), data), history);
  const host = page.locator('[data-history]');
  await expect(host.locator('.v108-owner')).toHaveCount(3);
  await expect(host.locator('.v108-owner a')).toHaveCount(3);
  const stays = host.locator('.v108-stay-history');
  await expect(stays).toHaveCount(3);
  await expect(stays.nth(0)).toContainText('Alex Smith');
  await expect(stays.nth(0).locator('a[href^="tel:"]')).toHaveCount(1);
  await expect(stays.nth(1)).toContainText('Alex Smith');
  await expect(stays.nth(1).locator('a[href^="tel:"]')).toHaveCount(1);
  await expect(stays.nth(2)).toContainText('Morgan Lee');
  await expect(stays.nth(2).locator('a[href^="tel:"]')).toHaveCount(1);
  await page.evaluate(() => window.v108RenderHistory(document.querySelector('[data-history]'), {
    stayCount: 1, owners: [], previousStays: [{ startDate: '2023-05-01', ownerName: 'Solo Visit Owner', phone: '0400 777 666' }]
  }));
  const soleVisit = host.locator('.v108-stay-history').first();
  await expect(soleVisit).toContainText('Solo Visit Owner');
  await expect(soleVisit.locator('a[href^="tel:"]')).toHaveCount(1);
  await page.evaluate(() => window.v108RenderHistory(document.querySelector('[data-history]'), { stayCount: 0, previousStays: [], owners: [] }));
  await expect(host).toContainText('No past stays are recorded.');
});

test('Care Photos empty groups explain where photos belong and preserve the add action', async ({ page }) => {
  expect(renderMedia).toBeTruthy();
  await page.setContent('<article class="directory-card"><div data-v110-media-host data-v110-stay-key="stay-a"></div></article>');
  await page.addScriptTag({ content: `
    function v110Escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function v110PhotoUrl(photo) { return photo?.previewUrl || photo?.url || ''; }
    function v110PhotoThumbnailUrl(photo) { return v110PhotoUrl(photo); }
    function v110RememberMediaDisclosures() {}
    function v110BindPhotoPreviewStates() {}
    ${renderPhotoGrid}
    ${renderMedia}
    window.v110RenderMedia = v110RenderMedia;
  ` });
  await page.evaluate(() => window.v110RenderMedia(document.querySelector('.directory-card'), { dogPhotoGallery: [], stayPhotos: [], photos: [] }));
  const host = page.locator('[data-v110-media-host]');
  await expect(host.locator('.v110-media-empty')).toHaveText([
    'No profile photos saved. Add one from the dog’s profile.',
    'No photos saved for this visit yet.',
    'No belongings photos saved for this visit.'
  ]);
  await expect(host.getByRole('button', { name: '＋ Add Stay Photos' })).toBeVisible();
  await expect(host.locator('.v110-media-count')).toHaveText(['0', '0', '0']);
});