const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('apps-script/Code.js', 'utf8');
const start = source.indexOf('function buildBelongingsPhotoUploaderHtml_(');
const end = source.indexOf('/** Read the selected Care row\'s own profile photo', start);
const appScript = source.slice(start, end);
const output = { addMetaTag() { return this; }, setXFrameOptionsMode() { return this; } };
let generatedHtml = '';
const context = vm.createContext({ HtmlService: { createHtmlOutput(value) { generatedHtml = value; return output; }, XFrameOptionsMode: { ALLOWALL: 1 } } });
vm.runInContext(appScript, context);

const storedSvg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#b45309"/><circle cx="160" cy="100" r="65" fill="#fde68a"/></svg>').toString('base64')}`;
const browserMock = `
  window.__photoMock = { loads: [], uploads: [], loadMode: 'success', receiptMode: 'success', delayedResolve: null, receiptResolve: null };
  window.google = { script: { run: {
    withSuccessHandler(fn) { this.success = fn; return this; },
    withFailureHandler(fn) { this.failure = fn; return this; },
    getStoredDogProfilePhotoForEdit(payload) {
      const mock = window.__photoMock, success = this.success, failure = this.failure; mock.loads.push(payload);
      if (mock.loadMode === 'failure') { setTimeout(() => failure(new Error('read failed')), 0); return; }
      if (mock.loadMode === 'delayed') { mock.delayedResolve = value => success(value); return; }
      setTimeout(() => success(mock.response), 0);
    },
    uploadBelongingsPhotoFromHtml(payload) { const success = this.success; window.__photoMock.uploads.push(payload); setTimeout(() => success({ photo: { id: 'new-crop-' + window.__photoMock.uploads.length } }), 0); },
    getBelongingsPhotoUploadReceipt() { const success = this.success; if (window.__photoMock.receiptMode === 'delayed') { window.__photoMock.receiptResolve = value => success(value); return; } setTimeout(() => success({ state: 'unknown' }), 0); }
  } } };
`;

async function openEditor(page, { response = { available: true, photoId: 'stored-photo', sourceAvailable: true, crop: { zoom: 1.25, panX: 8, panY: -4 }, dataUrl: storedSvg }, edit = true, loadMode = 'success' } = {}) {
  await page.goto('about:blank');
  const html = context.buildBelongingsPhotoUploaderHtml_({ stayKey: 'milo|2026-09-01|2026-09-05', dogName: 'Milo', startDate: '2026-09-01', endDate: '2026-09-05', photoType: 'dogProfile', editProfilePhoto: edit, dogId: 'dog-id', stayId: 'stay-id' });
  await page.setContent(generatedHtml.replace('<script>', `<script>${browserMock} window.__photoMock.response=${JSON.stringify(response)}; window.__photoMock.loadMode=${JSON.stringify(loadMode)};`));
}

for (const width of [320, 390, 1440]) {
  test(`saved profile photo preloads and remains usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    await openEditor(page);
    await expect(page.locator('#cropWrap')).toBeVisible();
    await expect(page.locator('#status')).toContainText('Saved original loaded');
    await expect(page.locator('#replacePhotoButton')).toBeVisible();
    await expect(page.locator('#photoChoices')).toBeHidden();
    const canvas = await page.locator('#cropCanvas').boundingBox();
    expect(canvas.width).toBeLessThanOrEqual(width - 24);
    await expect(page.locator('#uploadBtn')).toBeVisible();
    await expect.poll(() => page.locator('#uploadBtn').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await expect.poll(() => page.locator('#replacePhotoButton').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`saved-photo-editor-${width}.png`) });
  });
}

test('saving a repositioned photo carries expected identity and crop while reusing the private original', async ({ page }) => {
  await openEditor(page);
  await expect(page.locator('#cropWrap')).toBeVisible();
  await page.locator('#zoomRange').evaluate(input => { input.value = '1.6'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#uploadBtn').click();
  await expect.poll(() => page.evaluate(() => window.__photoMock.uploads.length)).toBe(1);
  const payload = await page.evaluate(() => window.__photoMock.uploads[0]);
  expect(payload.reposition).toBe(true);
  expect(payload.expectedCurrentPhotoId).toBe('stored-photo');
  expect(payload.sourcePhotoData).toBe('');
  expect(payload.crop.zoom).toBe(1.6);
  expect(payload.stayId).toBe('stay-id');
  expect(payload.dogId).toBe('dog-id');
  await page.locator('#uploadBtn').click();
  await expect(page.locator('#status')).toContainText('No photo changes to save');
  expect(await page.evaluate(() => window.__photoMock.uploads.length)).toBe(1);
  await page.locator('#zoomRange').evaluate(input => { input.value = '1.8'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#uploadBtn').click();
  await expect.poll(() => page.evaluate(() => window.__photoMock.uploads.length)).toBe(2);
  const second = await page.evaluate(() => window.__photoMock.uploads[1]);
  expect(second.clientUploadId).not.toBe(payload.clientUploadId);
  expect(second.expectedCurrentPhotoId).toBe('new-crop-1');
});

test('crop controls stay frozen while upload receipt is pending', async ({ page }) => {
  await openEditor(page);
  await page.locator('#zoomRange').evaluate(input => { input.value = '1.6'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.evaluate(() => { window.__photoMock.receiptMode = 'delayed'; });
  await page.locator('#uploadBtn').click();
  await expect.poll(() => page.locator('#zoomRange').isDisabled()).toBe(true);
  await expect(page.locator('#replacePhotoButton')).toBeDisabled();
  await expect(page.locator('#retryPhotoButton')).toBeDisabled();
  await page.evaluate(() => window.__photoMock.receiptResolve({ state: 'unknown' }));
  await expect.poll(() => page.evaluate(() => window.__photoMock.uploads.length)).toBe(1);
  await expect(page.locator('#zoomRange')).toBeEnabled();
});

test('legacy cropped photo explains its limit and retains a replacement choice', async ({ page }) => {
  await openEditor(page, { response: { available: true, photoId: 'legacy-crop', sourceAvailable: false, crop: null, dataUrl: storedSvg } });
  await expect(page.locator('#cropWrap')).toBeVisible();
  await expect(page.locator('#status')).toContainText('limited to this saved crop');
  await expect(page.locator('#replacePhotoButton')).toBeVisible();
  const loadsBeforeCancel = await page.evaluate(() => window.__photoMock.loads.length);
  await page.locator('#libraryInput').evaluate(input => { input.files = new DataTransfer().files; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(page.locator('#status')).toContainText('limited to this saved crop');
  expect(await page.evaluate(() => window.__photoMock.loads.length)).toBe(loadsBeforeCancel);
  await expect(page.locator('#cropWrap')).toBeVisible();
  await expect(page.locator('#uploadBtn')).toBeVisible();
});

test('a slower first replacement decode cannot overwrite the later replacement', async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    window.__nativeImageSrc = descriptor;
    window.__holdNextImage = true;
    Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, get() { return descriptor.get.call(this); }, set(value) {
      if (window.__holdNextImage && String(value).startsWith('data:image/')) { window.__holdNextImage = false; window.__heldReplacement = { image: this, value }; return; }
      descriptor.set.call(this, value);
    } });
  });
  const choose = async color => {
    if (!await page.locator('#photoChoices').isVisible()) await page.locator('#replacePhotoButton').click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#libraryInput').click();
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: `${color}.svg`, mimeType: 'image/svg+xml', buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${color}"/></svg>`) });
  };
  await choose('red');
  await expect.poll(() => page.evaluate(() => Boolean(window.__heldReplacement))).toBe(true);
  await choose('blue');
  await expect(page.locator('#status')).toContainText('Drag the photo to reposition it');
  const currentPreview = await page.locator('#cropCanvas').evaluate(canvas => canvas.toDataURL());
  await page.evaluate(() => window.__nativeImageSrc.set.call(window.__heldReplacement.image, window.__heldReplacement.value));
  await expect(page.locator('#status')).toContainText('Drag the photo to reposition it');
  expect(await page.locator('#cropCanvas').evaluate(canvas => canvas.toDataURL())).toBe(currentPreview);
});

test('load failure can retry, and a late preload cannot overwrite a chosen replacement', async ({ page }) => {
  await openEditor(page, { loadMode: 'failure' });
  await expect(page.locator('#retryPhotoButton')).toBeVisible();
  await page.evaluate(() => { window.__photoMock.loadMode = 'success'; });
  await page.locator('#retryPhotoButton').click();
  await expect(page.locator('#status')).toContainText('Saved original loaded');

  await openEditor(page, { loadMode: 'delayed' });
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('#libraryInput').evaluate(input => input.click());
  const chooser = await fileChooserPromise;
  await chooser.setFiles({ name: 'replacement.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="blue"/></svg>') });
  await expect(page.locator('#status')).toContainText('Drag the photo to reposition it');
  await page.evaluate(() => window.__photoMock.delayedResolve({ available: true, photoId: 'old-photo', sourceAvailable: true, dataUrl: window.__photoMock.response.dataUrl }));
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 30)));
  await expect(page.locator('#status')).toContainText('Drag the photo to reposition it');
});
