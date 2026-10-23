const { test, expect } = require('@playwright/test');
const path = require('node:path');

const helper = path.resolve(__dirname, '..', 'owner-handoff.js');
const stay = { link: 'https://care.example.test/stay/AbC123', dogName: 'Milo', startDate: '2026-11-10', endDate: '2026-11-13' };

async function setup(page, baseURL, { clipboard = 'success', share = null } = {}) {
  await page.setContent(`<link rel="stylesheet" href="${baseURL}/waffle-runtime.css"><main><div id="handoff"></div><button id="elsewhere">Elsewhere</button></main>`);
  await page.evaluate(() => {
    window.__writes = [];
    window.__clipboardMode = 'success';
    window.__clipboardWrite = async value => {
      window.__writes.push(value);
      if (window.__clipboardMode === 'fail') throw new Error('blocked');
      if (window.__clipboardMode === 'pending') return new Promise((resolve, reject) => { window.resolveCopy = resolve; window.rejectCopy = reject; });
    };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: value => window.__clipboardWrite(value) } });
    window.__shareCalls = [];
    window.__share = async data => { window.__shareCalls.push(data); };
    navigator.share = data => window.__share(data);
  });
  await page.evaluate(mode => { window.__clipboardMode = mode; }, clipboard);
  if (share === 'cancel') await page.evaluate(() => { window.__share = async data => { window.__shareCalls.push(data); const error = new Error('cancelled'); error.name = 'AbortError'; throw error; }; });
  await page.addScriptTag({ path: helper });
  await page.evaluate(data => window.WAFFLE_OWNER_HANDOFF.render(document.querySelector('#handoff'), data, { compact: true }), stay);
}

test('compact handoff offers one link action and concise contextual options', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  const card = page.locator('.owner-handoff-compact');
  await expect(card.getByRole('heading', { name: 'Owner care link ready' })).toBeVisible();
  await expect(card).toContainText('Milo');
  await expect(card.getByLabel('Owner care link')).toHaveCount(1);
  await expect(card.getByLabel('Owner care link')).toBeHidden();
  await expect(card.getByRole('button', { name: 'Copy owner care link', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: /copy link/i })).toHaveCount(0);
  await card.locator('summary').click();
  await expect(card.locator('summary')).toHaveText('More options');
  await expect(card.getByRole('button', { name: 'Copy message', exact: true })).toBeVisible();
  await expect(card.getByLabel('Owner care link')).toBeHidden();
});

test('pending primary copy ignores repeated clicks and performs one clipboard write', async ({ page, baseURL }) => {
  await setup(page, baseURL, { clipboard: 'pending' });
  const button = page.getByRole('button', { name: 'Copy owner care link' });
  await button.click();
  await expect(button).toBeDisabled();
  await button.dispatchEvent('click');
  expect(await page.evaluate(() => window.__writes)).toEqual([stay.link]);
  await page.evaluate(() => window.resolveCopy());
  await expect(button).toBeEnabled();
});

test('failed primary copy reveals a selectable mobile fallback; successful retry hides it', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await setup(page, baseURL, { clipboard: 'fail' });
  const card = page.locator('.owner-handoff-compact');
  const button = card.getByRole('button', { name: 'Copy owner care link' });
  const field = card.getByLabel('Owner care link');
  await expect(field).toBeHidden();
  await button.click();
  await expect(field).toBeVisible();
  await expect(field).toBeFocused();
  expect(await field.evaluate(element => [element.selectionStart, element.selectionEnd, element.value])).toEqual([0, stay.link.length, stay.link]);
  const layout = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    buttonHeight: document.querySelector('.owner-handoff-compact button').getBoundingClientRect().height,
    fieldWidth: document.querySelector('.owner-handoff-link-label textarea').getBoundingClientRect().width,
    cardRight: document.querySelector('.owner-handoff-compact').getBoundingClientRect().right
  }));
  expect(layout.scroll).toBeLessThanOrEqual(layout.client);
  expect(layout.buttonHeight).toBeGreaterThanOrEqual(44);
  expect(layout.fieldWidth).toBeGreaterThan(0);
  expect(layout.cardRight).toBeLessThanOrEqual(layout.client + 1);

  await page.evaluate(() => { window.__clipboardMode = 'success'; });
  await button.click();
  await expect(field).toBeHidden();
  await expect(button).toBeFocused();
  expect(await page.evaluate(() => window.__writes)).toEqual([stay.link, stay.link]);
});

test('successful retry does not steal focus after the user moves elsewhere', async ({ page, baseURL }) => {
  await setup(page, baseURL, { clipboard: 'fail' });
  const card = page.locator('.owner-handoff-compact');
  const button = card.getByRole('button', { name: 'Copy owner care link' });
  const field = card.getByLabel('Owner care link');
  await button.click();
  await page.evaluate(() => { window.__clipboardMode = 'pending'; });
  await button.click();
  await page.locator('#elsewhere').focus();
  await page.evaluate(() => window.resolveCopy());
  await expect(field).toBeHidden();
  await expect(page.locator('#elsewhere')).toBeFocused();
});

test('deferred clipboard rejection reveals fallback without stealing focus', async ({ page, baseURL }) => {
  await setup(page, baseURL, { clipboard: 'pending' });
  const card = page.locator('.owner-handoff-compact');
  const button = card.getByRole('button', { name: 'Copy owner care link' });
  const field = card.getByLabel('Owner care link');
  await button.click();
  await page.locator('#elsewhere').focus();
  await page.evaluate(() => window.rejectCopy(new Error('blocked')));
  await expect(field).toBeVisible();
  await expect(field).not.toBeFocused();
  await expect(page.locator('#elsewhere')).toBeFocused();
  await expect(card.getByRole('status')).toContainText(/available.*manual copying/i);
  expect(await field.evaluate(element => [element.selectionStart, element.selectionEnd])).not.toEqual([0, stay.link.length]);
});

test('late clipboard completion after host rerender does not affect the new handoff', async ({ page, baseURL }) => {
  await setup(page, baseURL, { clipboard: 'pending' });
  await page.getByRole('button', { name: 'Copy owner care link' }).click();
  await page.evaluate(data => window.WAFFLE_OWNER_HANDOFF.render(document.querySelector('#handoff'), { ...data, dogName: 'Nova' }, { compact: true }), stay);
  const newCard = page.locator('.owner-handoff-compact');
  const newStatus = await newCard.getByRole('status').innerText();
  await page.locator('#elsewhere').focus();
  await page.evaluate(() => window.resolveCopy());
  await expect(newCard).toContainText('Nova');
  await expect(newCard.getByRole('status')).toHaveText(newStatus);
  await expect(page.locator('#elsewhere')).toBeFocused();
});

test('native share cancellation does not claim the message was sent', async ({ page, baseURL }) => {
  await setup(page, baseURL, { share: 'cancel' });
  const card = page.locator('.owner-handoff-compact');
  await card.locator('summary').click();
  await card.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(card.getByRole('status')).toContainText(/cancel/i);
  await expect(card.getByRole('status')).not.toContainText(/sent|delivered/i);
  expect(await page.evaluate(() => window.__shareCalls)).toHaveLength(1);
});

test('pending link copy blocks competing message and share actions', async ({ page, baseURL }) => {
  await setup(page, baseURL, { clipboard: 'pending' });
  const card = page.locator('.owner-handoff-compact');
  await card.locator('summary').click();
  await card.getByRole('button', { name: 'Copy owner care link', exact: true }).click();
  await expect(card.getByRole('status')).toHaveText('Copying link…');
  const message = card.getByRole('button', { name: 'Copy message', exact: true });
  const share = card.getByRole('button', { name: 'Share', exact: true });
  await expect(message).toBeDisabled();
  await expect(share).toBeDisabled();
  await message.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await share.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(await page.evaluate(() => window.__writes)).toEqual([stay.link]);
  expect(await page.evaluate(() => window.__shareCalls)).toHaveLength(0);
  await page.evaluate(() => window.resolveCopy());
  await expect(message).toBeEnabled();
  await expect(share).toBeEnabled();
});

test('pending message copy blocks a second intent and releases all actions after failure', async ({ page, baseURL }) => {
  await setup(page, baseURL, { clipboard: 'pending' });
  const card = page.locator('.owner-handoff-compact');
  await card.locator('summary').click();
  const message = card.getByRole('button', { name: 'Copy message', exact: true });
  const link = card.getByRole('button', { name: 'Copy owner care link', exact: true });
  const expected = await card.getByLabel('Message to owner').inputValue();
  await message.click();
  await expect(card.getByRole('status')).toHaveText('Copying message…');
  await expect(link).toBeDisabled();
  await link.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.locator('#elsewhere').focus();
  await page.evaluate(() => window.rejectCopy(new Error('blocked')));
  await expect(card.getByRole('status')).toContainText('available above for manual copying');
  await expect(page.locator('#elsewhere')).toBeFocused();
  await expect(link).toBeEnabled();
  await expect(message).toBeEnabled();
  expect(await page.evaluate(() => window.__writes)).toEqual([expected]);
});

test('a pending native share blocks competing actions and cancellation releases them', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  await page.evaluate(() => { window.__share = data => { window.__shareCalls.push(data); return new Promise((resolve, reject) => { window.rejectShare = reject; }); }; });
  const card = page.locator('.owner-handoff-compact');
  await card.locator('summary').click();
  const share = card.getByRole('button', { name: 'Share', exact: true });
  const copy = card.getByRole('button', { name: 'Copy owner care link', exact: true });
  await share.click();
  await expect(copy).toBeDisabled();
  await share.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await copy.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(await page.evaluate(() => window.__shareCalls)).toHaveLength(1);
  expect(await page.evaluate(() => window.__writes)).toHaveLength(0);
  await page.evaluate(() => { const error = new Error('cancelled'); error.name = 'AbortError'; window.rejectShare(error); });
  await expect(card.getByRole('status')).toContainText('cancelled');
  await expect(share).toBeEnabled();
  await expect(copy).toBeEnabled();
});
