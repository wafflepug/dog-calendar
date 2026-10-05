const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const runtime = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.js'), 'utf8');
const careRuntime = fs.readFileSync(path.join(__dirname, '..', 'care.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.css'), 'utf8');
const carouselRuntime = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.2.18.js'), 'utf8');
const mediaStart = runtime.indexOf('function v110PhotoUrl(');
const mediaEnd = runtime.indexOf('function v110EnsurePhotoViewer(', mediaStart);
const viewerStart = mediaEnd;
const viewerEnd = runtime.indexOf('function v110OpenCustomPanel(', viewerStart);
const photoFunctions = runtime.slice(mediaStart, mediaEnd) + runtime.slice(viewerStart, viewerEnd);

async function setup(page, queryBody) {
  await page.setContent('<article class="directory-card" data-directory-stay-key="stay-a"><div data-v110-media-host></div></article>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: `
    window.v110MediaCache = Object.create(null);
    window.v110Escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    window.queryAppsScript = ${queryBody};
    ${photoFunctions}
  ` });
  await page.addScriptTag({ content: carouselRuntime });
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

test('Care gallery uses bounded Drive previews, wraps captions, loads originals on open, and retries one image locally', async ({ page }) => {
  await setup(page, `async payload => {window.mediaQueryCount=(window.mediaQueryCount||0)+1;return {record:{stayPhotos:[{id:'p1',label:'A very long caption that should wrap across several readable lines instead of being cut off or reduced to tiny text',previewUrl:'https://drive.google.com/thumbnail?id=photo_123&sz=w1600',url:'https://drive.google.com/file/d/photo_123/view',driveUrl:'https://drive.google.com/file/d/photo_123/view'},{id:'p2',label:'Failed preview',previewUrl:'https://images.test/broken.jpg',url:'https://images.test/original.jpg'}]}};}`);
  const requestedImages = [];
  await page.route('https://drive.google.com/thumbnail**', route => { requestedImages.push(route.request().url()); return route.fulfill({ status:200, contentType:'image/svg+xml', body:'<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"2\" height=\"2\"></svg>' }); });
  const retryRequests = [];
  await page.route('https://images.test/**', route => { retryRequests.push(route.request().url()); return route.abort(); });
  await page.evaluate(() => v110LoadMedia(document.querySelector('.directory-card')));
  const images = page.locator('.v110-media-view img');
  await expect(images).toHaveCount(2);
  await expect(images.nth(0)).toHaveAttribute('src', /thumbnail\?id=photo_123&sz=w480/);
  await expect(images.nth(0)).toHaveAttribute('loading', 'lazy');
  await expect(page.locator('.v11218-carousel-track')).toHaveCount(1);
  await expect(page.locator('.v11218-carousel-thumb')).toHaveCount(2);
  await expect(page.locator('.v11218-carousel-thumb').first()).toHaveCSS('height', '44px');
  await expect(page.locator('.v11218-carousel-counter')).toHaveCSS('font-size', '12px');
  expect(requestedImages.every(url => new URL(url).searchParams.get('sz') === 'w480')).toBeTruthy();
  await expect(page.locator('.v110-media-photo-meta span').first()).toHaveCSS('font-size', '14px');
  await expect(page.locator('.v110-media-image-error').nth(1)).toBeVisible();
  await expect(page.getByRole('button', {name:'Retry preview for Failed preview'})).toBeVisible();
  await page.getByRole('button', {name:'Retry preview for Failed preview'}).scrollIntoViewIfNeeded();
  const appQueryCountBeforeRetry = await page.evaluate(() => window.mediaQueryCount || 0);
  await page.getByRole('button', {name:'Retry preview for Failed preview'}).click();
  await expect(page.locator('.v110-media-image-error').nth(1)).toBeVisible();
  await expect.poll(() => retryRequests.length).toBeGreaterThan(1);
  expect(retryRequests.filter(url => new URL(url).searchParams.has('_waffleRetry'))).toHaveLength(1);
  expect(await page.evaluate(() => window.mediaQueryCount || 0)).toBe(appQueryCountBeforeRetry);
  await expect(page.locator('[data-v110-media-host]')).toContainText('A very long caption');
  await expect(page.locator('.v110-photo-viewer')).toHaveCount(0);
  await page.evaluate(() => v110OpenPhotoViewer(document.querySelector('[data-v110-view-photo]').dataset.v110ViewPhoto));
  await expect(page.locator('#v110PhotoViewer img')).toHaveAttribute('src', 'https://drive.google.com/thumbnail?id=photo_123&sz=w1600');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.v110-media-photo-meta span').first()).toHaveCSS('font-size', '14px');
    const noPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(noPageOverflow).toBeTruthy();
  }
  await page.locator('body').evaluate(body => body.classList.add('dark-theme'));
  await page.evaluate(() => v110ClosePhotoViewer());
  await page.locator('.v110-media-view').first().focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.v110-media-view').first()).toHaveCSS('outline-style', 'solid');
  await expect.poll(() => requestedImages.some(url => new URL(url).searchParams.get('sz') === 'w1600')).toBeTruthy();
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
