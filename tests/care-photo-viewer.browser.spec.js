const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const runtime = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.css'), 'utf8');
const start = runtime.indexOf('function v110EnsurePhotoViewer(');
const end = runtime.indexOf('function v110OpenCustomPanel(', start);
const viewer = runtime.slice(start, end);

async function setup(page) {
  await page.setContent('<div style="height:1200px"></div><button id="trigger"><img alt="Mabel at the park"></button><footer style="position:fixed;z-index:2147482000;bottom:0;height:80px">Footer</footer>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: `${viewer}\nwindow.openViewer=v110OpenPhotoViewer;` });
}

test('viewer is named, focus trapped, closes by Escape/backdrop and restores focus and scroll styles', async ({ page }) => {
  await setup(page);
  await page.route('https://images.test/**', () => new Promise(() => {}));
  await page.evaluate(() => { document.documentElement.style.overflow='auto'; document.body.style.overflow='clip'; document.querySelector('#trigger').focus(); window.scrollTo(0,180); openViewer('https://images.test/a.jpg',document.querySelector('#trigger'),'Mabel at the park'); });
  const dialog = page.getByRole('dialog', { name: 'Mabel at the park' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close photo' })).toHaveCSS('width','48px');
  await expect(dialog).toHaveCSS('z-index','2147482500');
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Close photo' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close photo' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => [document.documentElement.style.overflow,document.body.style.overflow,window.scrollY])).toEqual(['auto','clip',180]);
  await expect(page.locator('#trigger')).toBeFocused();
  await page.evaluate(() => openViewer('https://images.test/a.jpg',document.querySelector('#trigger'),'Mabel at the park'));
  await page.locator('.v110-photo-viewer img').click({ position: { x: 1,y: 1 }, force: true }).catch(()=>{});
  await expect(dialog).toBeVisible();
  await page.locator('#v110PhotoViewer').click({ position: { x: 4,y: 4 } });
  await expect(dialog).toBeHidden();
});

test('responsive safe image bounds and dark theme remain legible', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => openViewer('https://images.test/a.jpg',null,'Portrait'));
  for (const width of [320,390,1440]) {
    await page.setViewportSize({ width,height:800 });
    const bounds=await page.locator('.v110-photo-viewer').evaluate(v=>{const img=v.querySelector('img'),r=img.getBoundingClientRect(),c=v.querySelector('.v110-photo-viewer-close').getBoundingClientRect();return {right:r.right,bottom:r.bottom,closeRight:c.right,closeTop:c.top,viewportWidth:innerWidth,viewportHeight:innerHeight};});
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);
    expect(bounds.closeRight).toBeLessThanOrEqual(bounds.viewportWidth);
  }
  await page.locator('body').evaluate(b=>b.classList.add('dark-theme'));
  await expect(page.getByRole('button',{name:'Close photo'})).toHaveCSS('background-color','rgb(17, 17, 17)');
});

test('late A error cannot replace B; failure retry requests same image once without app calls', async ({ page }) => {
  await setup(page);
  const requests=[];
  await page.route('https://images.test/**', route=>{requests.push(route.request().url());return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>'});});
  await page.evaluate(() => { window.appCalls=0; openViewer('https://images.test/a.jpg',null,'A'); window.oldImage=document.querySelector('#v110PhotoViewer img'); });
  await page.evaluate(() => openViewer('https://images.test/b.jpg',null,'B'));
  await page.evaluate(() => window.oldImage.dispatchEvent(new Event('error')));
  await expect(page.getByRole('status').filter({hasText:'Photo unavailable'})).toBeHidden();
  await page.locator('#v110PhotoViewer img').dispatchEvent('error');
  await expect(page.getByRole('status').filter({hasText:'Photo unavailable'})).toBeVisible();
  const before=requests.length;
  await page.getByRole('button',{name:'Retry'}).click();
  await expect.poll(()=>requests.length).toBeGreaterThan(before);
  expect(requests.slice(before).every(url=>new URL(url).origin==='https://images.test'&&new URL(url).pathname==='/b.jpg'&&new URL(url).searchParams.has('_waffleRetry'))).toBeTruthy();
  expect(await page.evaluate(()=>window.appCalls)).toBe(0);
  await expect(page.locator('#v110PhotoViewer img')).toHaveAttribute('src',/https:\/\/images\.test\/b\.jpg\?_waffleRetry=1/);
});
