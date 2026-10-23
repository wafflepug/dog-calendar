const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const helper = path.join(root, 'owner-handoff.js');
const bookingScript = fs.readFileSync(path.join(root, 'phase4-booking.js'), 'utf8');
const coreScript = fs.readFileSync(path.join(root, 'phase4-core.js'), 'utf8');
const styleStart = coreScript.indexOf('function style(){');
const styleEnd = coreScript.indexOf('\nlet active=', styleStart);

async function setupOwnerDialog(page, baseURL) {
  await page.setContent('<body data-waffle-page="booking"><div id="p4Modal" class="p4-modal"><section class="p4-card" role="dialog" aria-modal="true"><header class="p4-head"><h2>Booking</h2><button data-p4-close type="button">Close</button></header><nav class="p4-tabs"></nav><div class="p4-body"><section class="p4-panel" data-p4-panel="booking" hidden></section><section class="p4-panel" data-p4-panel="capacity" hidden></section><section class="p4-panel" data-p4-panel="owner"></section></div></section></div></body>');
  await page.evaluate(() => {
    document.documentElement.dataset.waffleUiReady = 'true';
    window.fixtureWrites = [];
    window.fixtureReads = [];
    window.fixtureIdentityRows = [{ dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', dogNumber: '00001', dogName: 'Milo', breed: 'Kelpie', ownerName: 'Alex' }];
    window.fixtureWriteHandler = async () => ({ intake: { link: 'https://care.example.test/stay/AbC123' } });
    window.fixtureReadHandler = async payload => payload.action === 'list_dog_identities' ? { identities: window.fixtureIdentityRows } : { history: { previousStays: [], stayCount: 0 } };
    window.WAFFLE_PHASE4_CORE = {
      modal: () => document.getElementById('p4Modal'), page: () => 'booking', open: () => {}, settings: () => ({ preferred: 4, absolute: 6 }),
      esc: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]),
      norm: value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), fmt: value => String(value ?? ''), today: () => '2026-10-18', rows: () => window.fixtureRows || [], visits: () => [],
      read: async payload => { window.fixtureReads.push(payload); return window.fixtureReadHandler(payload); },
      write: async payload => { window.fixtureWrites.push(structuredClone(payload)); return window.fixtureWriteHandler(payload); },
      duplicate: () => null, capacity: () => ({ band: 'green' }), renderDecision: () => {}, toast: () => {}, saveSettings: () => ({ preferred: 4, absolute: 6 }), parseBooking: () => ({})
    };
  });
  await page.addScriptTag({ path: helper });
  await page.addScriptTag({ content: coreScript.slice(styleStart, styleEnd) + '\nstyle();' });
  await page.addStyleTag({ url: `${baseURL}/waffle-runtime.css` });
  await page.addScriptTag({ content: bookingScript });
  await page.evaluate(() => { window.WAFFLE_PHASE4_BOOKING.fillOwner({ dogName: 'Milo', breed: 'Kelpie', ownerName: 'Alex', startDate: '2026-11-10', endDate: '2026-11-13', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }); document.getElementById('p4Modal').hidden = false; });
}

test('owner preparation validates fields locally and exposes associated errors', async ({ page, baseURL }) => {
  await setupOwnerDialog(page, baseURL);
  await page.evaluate(() => window.WAFFLE_PHASE4_BOOKING.fillOwner({}));
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('#p4OwnerDetails')).toHaveAttribute('open', '');
  await expect(page.locator('#p4OwnerDog')).toBeFocused();
  await expect(page.locator('#p4OwnerDog')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#p4OwnerDog')).toHaveAttribute('aria-describedby', /p4OwnerDogError/);
  await expect(page.locator('#p4OwnerDogError')).toContainText('dog');
  await expect(page.locator('#p4OwnerStartError')).toContainText('start date');
  await expect(page.locator('#p4OwnerEndError')).toContainText('end date');
  expect(await page.evaluate(() => ({ reads: window.fixtureReads.length, writes: window.fixtureWrites.length }))).toEqual({ reads: 0, writes: 0 });
  await page.locator('#p4OwnerDog').fill('Milo');
  await page.locator('#p4OwnerStart').fill('2026-11-10');
  await page.locator('#p4OwnerEnd').fill('2026-11-09');
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('#p4OwnerEndError')).toContainText('after the start date');
  expect(await page.evaluate(() => window.fixtureReads.length)).toBe(0);
  await page.locator('#p4OwnerEnd').fill('2026-11-10');
  await expect(page.locator('#p4OwnerEnd')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#p4OwnerDogError')).toBeHidden();
  await expect(page.locator('#p4OwnerStartError')).toBeHidden();
  await expect(page.locator('#p4OwnerEndError')).toBeHidden();
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('.owner-handoff')).toBeVisible();
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(1);
});

test('Enter prepares once and ignores composition, modifiers, textarea and non-owner controls', async ({ page, baseURL }) => {
  await setupOwnerDialog(page, baseURL);
  await page.locator('#p4OwnerDetails > summary').click();
  await page.evaluate(() => { window.fixtureWriteHandler = () => new Promise(resolve => { window.resolveOwnerWrite = resolve; }); });
  await page.locator('#p4OwnerDog').press('Enter');
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(1);
  await page.locator('#p4OwnerStart').press('Enter');
  await page.locator('#p4OwnerEnd').press('Control+Enter');
  await page.locator('#p4OwnerPhone').evaluate(input => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
  await page.locator('#p4OwnerPhone').evaluate(input => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })));
  await page.locator('#p4Paste').evaluate(area => area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(1);
  await page.evaluate(() => window.resolveOwnerWrite({ intake: { link: 'https://care.example.test/stay/AbC123' } }));
  await expect(page.locator('.owner-handoff')).toBeVisible();
});

test('history check shows loading, prevents repeat reads, and returns exact Dog ID history', async ({ page, baseURL }) => {
  await setupOwnerDialog(page, baseURL);
  await expect(page.locator('#p4Returning')).toBeEmpty();
  expect(await page.evaluate(() => window.fixtureReads.length)).toBe(0);
  await page.evaluate(() => { window.fixtureReadHandler = payload => payload.action === 'get_dog_history' ? new Promise(resolve => { window.resolveHistory = resolve; }) : { identities: window.fixtureIdentityRows }; });
  await page.locator('#p4OwnerOtherOptions > summary').click();
  await page.locator('#p4CheckReturn').click();
  await expect(page.locator('#p4CheckReturn')).toBeDisabled();
  await expect(page.locator('#p4Returning')).toContainText('Checking this Dog ID');
  await page.locator('#p4CheckReturn').click({ force: true });
  expect(await page.evaluate(() => window.fixtureReads.filter(item => item.action === 'get_dog_history'))).toEqual([{ action: 'get_dog_history', dogName: 'Milo', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }]);
  await page.evaluate(() => window.resolveHistory({ history: { previousStays: [], stayCount: 0 } }));
  await expect(page.locator('#p4Returning')).toContainText('0 stays');
  await expect(page.locator('#p4CheckReturn')).toBeEnabled();
});

test('history failure offers an explicit retry that can succeed', async ({ page, baseURL }) => {
  await setupOwnerDialog(page, baseURL);
  await page.evaluate(() => { let attempts = 0; window.fixtureReadHandler = async payload => { if (payload.action === 'get_dog_history' && !attempts++) throw new Error('temporary'); return payload.action === 'list_dog_identities' ? { identities: window.fixtureIdentityRows } : { history: { previousStays: [], stayCount: 1 } }; }; });
  await page.locator('#p4OwnerOtherOptions > summary').click();
  await page.locator('#p4CheckReturn').click();
  await expect(page.locator('#p4Returning')).toContainText('could not be loaded');
  await page.locator('[data-p4-history-retry]').click();
  await expect(page.locator('#p4Returning')).toContainText('1 stay');
  expect(await page.evaluate(() => window.fixtureReads.filter(item => item.action === 'get_dog_history').length)).toBe(2);
});

test('switching guests while history is pending ignores the stale result', async ({ page, baseURL }) => {
  await setupOwnerDialog(page, baseURL);
  await page.evaluate(() => { window.fixtureReadHandler = payload => payload.action === 'get_dog_history' ? new Promise(resolve => { window.resolveOldHistory = resolve; }) : { identities: window.fixtureIdentityRows }; });
  await page.locator('#p4OwnerOtherOptions > summary').click();
  await page.locator('#p4CheckReturn').click();
  await expect(page.locator('#p4Returning')).toContainText('Checking this Dog ID');
  await page.evaluate(() => window.WAFFLE_PHASE4_BOOKING.fillOwner({ dogName: 'Nova', startDate: '2026-12-01', endDate: '2026-12-03', dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }));
  await expect(page.locator('#p4CheckReturn')).toBeEnabled();
  await page.evaluate(() => window.resolveOldHistory({ history: { previousStays: [{ endDate: '2026-11-01' }], stayCount: 7 } }));
  await expect(page.locator('#p4Returning')).toBeEmpty();
  await expect(page.locator('#p4CheckReturn')).toBeEnabled();
});

test('owner validation errors remain readable across phone, desktop and theme changes', async ({ page, baseURL }, testInfo) => {
  await setupOwnerDialog(page, baseURL);
  await page.evaluate(() => window.WAFFLE_PHASE4_BOOKING.fillOwner({}));
  await page.locator('#p4OwnerLink').click();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.locator('body').evaluate((node, enabled) => node.classList.toggle('dark-theme', enabled), dark);
      await expect(page.locator('#p4OwnerDogError')).toBeVisible();
      const errors = await page.locator('.p4-owner-error').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { right: rect.right, left: rect.left, font: parseFloat(getComputedStyle(node).fontSize), scroll: node.scrollWidth, width: node.clientWidth };
      }));
      expect(errors).toHaveLength(3);
      expect(errors.every(error => error.font >= 14 && error.left >= 0 && error.right <= width + 1 && error.scroll <= error.width + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  }
  expect(await page.evaluate(() => ({ reads: window.fixtureReads.length, writes: window.fixtureWrites.length }))).toEqual({ reads: 0, writes: 0 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('owner-validation-390-dark.png') });
});
