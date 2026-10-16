const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const runtime = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.js'), 'utf8');
const mediaStart = runtime.indexOf('function v110PhotoUrl(');
const mediaEnd = runtime.indexOf('function v110EnsurePhotoViewer(', mediaStart);
const mediaRuntime = runtime.slice(mediaStart, mediaEnd);

async function setup(page) {
  await page.setContent('<article class="directory-card" data-directory-stay-id="stay-A" data-directory-dog-id="dog-A" data-directory-stay-key="exact-key-A"><div data-v110-media-host></div></article>');
  await page.addScriptTag({ content: `
    window.v110MediaCache = Object.create(null);
    window.v110Escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    window.mediaReads = 0;
    window.mediaFail = false;
    window.WAFFLE_CARE_BELONGINGS_READS = { read: async (_card, options) => {
      window.mediaReads++;
      if (window.mediaFail) throw new Error('offline');
      const record = { dogPhotoGallery:[{id:'p1',label:'Profile',url:'https://photos.test/p.jpg'}], stayPhotos:[{id:'s1',label:'Stay',url:'https://photos.test/s.jpg'}], photos:[] };
      options.onFresh({record});
      return {data:{record}};
    }};
    ${mediaRuntime}
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-v110-media-toggle]');
      if (!button) return;
      const host = button.closest('[data-v110-media-host]');
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      const content = button.closest('.v110-media-section')?.querySelector('.v110-media-group-content');
      if (content) content.hidden = expanded;
      v110RememberMediaDisclosures(host);
    });
  ` });
}

test('cached media reopen keeps the real gallery DOM, disclosures, and actions while refreshing', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => v110LoadMedia(document.querySelector('.directory-card')));
  const host = page.locator('[data-v110-media-host]');
  const addPhoto = host.getByRole('button', { name: '＋ Add Stay Photos' });
  await addPhoto.evaluate(node => { window.addPhotoNode = node; });
  await host.locator('[data-v110-media-toggle="stay"]').click();
  await expect(host.locator('[data-v110-media-toggle="stay"]')).toHaveAttribute('aria-expanded', 'true');
  const photoButton = host.getByRole('button', { name: 'View Stay' });
  await photoButton.evaluate(node => { window.photoNode = node; });
  await page.evaluate(() => v110LoadMedia(document.querySelector('.directory-card')));
  await expect(host.locator('[data-v110-media-toggle="stay"]')).toHaveAttribute('aria-expanded', 'true');
  expect(await host.getByRole('button', { name: '＋ Add Stay Photos' }).evaluate(node => node === window.addPhotoNode)).toBe(true);
  expect(await host.getByRole('button', { name: 'View Stay' }).evaluate(node => node === window.photoNode)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.mediaReads)).toBe(2);
});

test('cached gallery survives refresh failure, exposes retry, and clears refresh warning after recovery', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => v110LoadMedia(document.querySelector('.directory-card')));
  await page.evaluate(() => { window.mediaFail = true; return v110LoadMedia(document.querySelector('.directory-card')); });
  const host = page.locator('[data-v110-media-host]');
  await expect(host.locator('.v110-media-section')).toHaveCount(3);
  await expect(host.locator('.v110-media-refresh-error')).toContainText('refresh failed');
  await expect(host.locator('[data-v110-media-retry]')).toBeVisible();
  await page.evaluate(() => { window.mediaFail = false; return v110LoadMedia(document.querySelector('.directory-card')); });
  await expect(host.locator('.v110-media-refresh-error')).toHaveCount(0);
  await expect(host.getByRole('button', { name: '＋ Add Stay Photos' })).toBeVisible();
});
