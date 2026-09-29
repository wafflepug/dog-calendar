const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const runtime = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.js'), 'utf8');
const careRuntime = fs.readFileSync(path.join(__dirname, '..', 'care.js'), 'utf8');
const photoFunctions = runtime.split(/\r?\n/).filter(line =>
  line.startsWith('function v110PhotoUrl(') ||
  line.startsWith('function v110PhotoGrid(') ||
  line.startsWith('function v110RenderMedia(') ||
  line.startsWith('async function v110LoadMedia(')
).join('\n');

async function setup(page, queryBody) {
  await page.setContent('<article class="directory-card" data-directory-stay-key="stay-a"><div data-v110-media-host></div></article>');
  await page.addScriptTag({ content: `
    window.v110MediaCache = Object.create(null);
    window.v110Escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    window.queryAppsScript = ${queryBody};
    ${photoFunctions}
  ` });
}

test('Care Photos render counts, disclosures, accessible actions, and empty groups', async ({ page }) => {
  await setup(page, `async payload => ({ record: { dogPhotoGallery: [{id:'p1',label:'Profile portrait',url:'https://photos.test/profile.jpg'}, {id:'p2',label:'Broken image'}], stayPhotos: [{id:'s1',label:'Playtime',url:'https://photos.test/stay.jpg'}], photos: [] } })`);
  await page.evaluate(() => v110LoadMedia(document.querySelector('.directory-card')));
  const host = page.locator('[data-v110-media-host]');
  await expect(host.locator('.v110-media-section')).toHaveCount(3);
  await expect(host.locator('.v110-media-count')).toHaveText(['1', '1', '0']);
  await expect(host.locator('[data-v110-media-toggle="profile"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(host.locator('[data-v110-media-toggle="belongings"]')).toHaveAttribute('aria-expanded', 'false');
  await expect(host.getByRole('button', { name: '＋ Add Stay Photos' })).toHaveCount(1);
  await expect(host.locator('img[alt="Profile portrait"]')).toHaveCount(1);
  await expect(host.getByRole('button', { name: 'View Profile portrait' })).toHaveCount(1);
  await expect(host.getByRole('button', { name: 'Delete Playtime' })).toHaveCount(1);
});

test('fallback photo disclosures toggle and the fallback exposes no unsupported upload action', async ({ page }) => {
  const helper = careRuntime.match(/function toggleMediaGroup\(button\) \{[\s\S]*?\n  \}/)?.[0];
  expect(helper).toBeTruthy();
  const fallback = careRuntime.match(/async function fallbackMedia\(card\) \{[\s\S]*?\n  \}/)?.[0];
  expect(fallback).toBeTruthy();
  expect(fallback).not.toContain('data-v110-add-stay-photo');
  expect(careRuntime).toContain('toggleMediaGroup(mediaToggle)');
  await page.setContent('<section class="v110-media-section"><button type="button" data-v110-media-toggle aria-expanded="true">Photos</button><div class="v110-media-group-content">Visible</div></section>');
  await page.addScriptTag({ content: `${helper}\ndocument.addEventListener('click', event => { const button = event.target.closest('[data-v110-media-toggle]'); if (button) toggleMediaGroup(button); });` });
  await page.getByRole('button', { name: 'Photos' }).click();
  await expect(page.getByRole('button', { name: 'Photos' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Visible')).toBeHidden();
  await page.getByRole('button', { name: 'Photos' }).click();
  await expect(page.getByText('Visible')).toBeVisible();
});

test('late media responses cannot replace the selected stay and errors remain retryable', async ({ page }) => {
  await setup(page, `payload => new Promise((resolve, reject) => { window.mediaRequests.push({stayKey:payload.stayKey, resolve, reject}); })`);
  await page.evaluate(() => { window.mediaRequests = []; });
  await page.evaluate(() => { void v110LoadMedia(document.querySelector('.directory-card')); });
  await expect(page.locator('[data-v110-media-host]')).toContainText('Loading photos');
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    card.dataset.directoryStayKey = 'stay-b';
    void v110LoadMedia(card, {force:true});
  });
  await page.evaluate(() => window.mediaRequests[1].resolve({record:{stayPhotos:[{id:'b',label:'Stay B photo',url:'https://photos.test/b.jpg'}]}}));
  await expect(page.locator('[data-v110-media-host]')).toContainText('Stay B photo');
  await page.evaluate(() => window.mediaRequests[0].resolve({record:{stayPhotos:[{id:'a',label:'Stale Stay A photo',url:'https://photos.test/a.jpg'}]}}));
  await expect(page.locator('[data-v110-media-host]')).toContainText('Stay B photo');
  await expect(page.locator('[data-v110-media-host]')).not.toContainText('Stale Stay A photo');

  await page.evaluate(() => {
    window.queryAppsScript = async () => { throw new Error('temporary outage'); };
    delete v110MediaCache['stay-b'];
    void v110LoadMedia(document.querySelector('.directory-card'), {force:true});
  });
  await expect(page.getByRole('alert')).toContainText('temporary outage');
  await expect(page.getByRole('button', {name:'Retry loading photos'})).toBeVisible();
});
