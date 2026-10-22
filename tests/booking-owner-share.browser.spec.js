const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const helper = path.join(root, 'owner-handoff.js');
const bookingScript = fs.readFileSync(path.join(root, 'phase4-booking.js'), 'utf8');
const coreScript = fs.readFileSync(path.join(root, 'phase4-core.js'), 'utf8');
const styleStart = coreScript.indexOf('function style(){');
const styleEnd = coreScript.indexOf('\nlet active=', styleStart);

async function setup(page, baseURL, { saveResponse, linkResponse, clipboardFails = false, linkFailsOnce = false, linkDeferred = false } = {}) {
  await page.goto(`${baseURL}/waffle-runtime.css`, { waitUntil: 'domcontentloaded' });
  await page.setContent('<body data-waffle-page="booking"><div id="p4Modal" class="p4-modal"><section class="p4-card" role="dialog" aria-modal="true"><header class="p4-head"><h2>Booking</h2><button data-p4-close type="button">Close</button></header><nav class="p4-tabs"></nav><div class="p4-body"><section class="p4-panel" data-p4-panel="booking"></section><section class="p4-panel" data-p4-panel="capacity" hidden></section><section class="p4-panel" data-p4-panel="owner" hidden></section></div></section></div></body>');
  await page.evaluate(({ saveResponse, linkResponse, clipboardFails, linkFailsOnce, linkDeferred }) => {
    document.documentElement.dataset.waffleUiReady = 'true';
    window.fixtureWrites = [];
    window.fixtureReads = [];
    window.fixtureIdentityRows = [];
    window.fixtureSaveResponse = saveResponse;
    window.fixtureLinkResponse = linkResponse;
    window.fixtureClipboardFails = clipboardFails;
    window.fixtureClipboardWrites = [];
    window.fixtureLinkAttempts = 0;
    window.fixtureLinkFailsOnce = linkFailsOnce;
    window.fixtureLinkDeferred = linkDeferred;
    window.fixtureShareCalls = [];
    navigator.share = async data => { window.fixtureShareCalls.push(data); };
    window.fixtureWriteHandler = async payload => {
      if (payload.action === 'create_boarding') return window.fixtureSaveResponse;
      if (payload.action === 'create_intake_link') {
        window.fixtureLinkAttempts++;
        if (window.fixtureLinkFailsOnce && window.fixtureLinkAttempts === 1) throw Error('Synthetic token failure');
        if (window.fixtureLinkDeferred) return new Promise(resolve => { window.resolveFixtureLink = resolve; });
        return window.fixtureLinkResponse;
      }
      return { result: 'success' };
    };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async value => { window.fixtureClipboardWrites.push(value); if (window.fixtureClipboardFails) throw Error('blocked'); }
    } });
    window.WAFFLE_PHASE4_CORE = {
      modal: () => document.getElementById('p4Modal'), page: () => 'booking', open: () => {},
      settings: () => ({ preferred: 4, absolute: 6 }),
      esc: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]),
      norm: value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      fmt: value => String(value ?? ''), today: () => '2026-10-23', rows: () => [], visits: () => [],
      read: async payload => { window.fixtureReads.push(payload); return payload.action === 'list_dog_identities' ? { identities: window.fixtureIdentityRows } : { history: { previousStays: [], stayCount: 0 } }; },
      write: async payload => { window.fixtureWrites.push(structuredClone(payload)); return window.fixtureWriteHandler(payload); },
      duplicate: () => null, capacity: () => ({ band: 'green' }), renderDecision: () => {}, toast: message => { window.lastToast = message; },
      saveSettings: () => ({ preferred: 4, absolute: 6 }), parseBooking: () => ({})
    };
  }, { saveResponse, linkResponse, clipboardFails, linkFailsOnce, linkDeferred });
  await page.addScriptTag({ path: helper });
  if (styleStart < 0 || styleEnd < 0) throw new Error('Could not extract phase-4 core style function.');
  await page.addScriptTag({ content: coreScript.slice(styleStart, styleEnd) + '\nstyle();' });
  await page.addStyleTag({ url: `${baseURL}/waffle-runtime.css` });
  await page.addScriptTag({ content: bookingScript });
  await page.evaluate(() => {
    window.WAFFLE_PHASE4_BOOKING.fill({ dogName: 'Test Dog', breed: 'Kelpie', ownerName: 'Synthetic Owner', phone: '0400000000', startDate: '2026-11-10', endDate: '2026-11-13' });
    document.getElementById('p4Modal').hidden = false;
  });
}

async function saveConfirmed(page) {
  await page.locator('#p4SaveConfirmed').click();
  await expect(page.locator('#p4BookingLinkResult')).toBeVisible();
}

test('returned booking link is the single primary copy action and does not trigger another write', async ({ page, baseURL }) => {
  await setup(page, baseURL, { saveResponse: { result: 'success', intake: { link: 'https://care.example.test/stay/synthetic-token' } } });
  await saveConfirmed(page);
  const host = page.locator('#p4BookingLinkResult');
  await expect(host.getByRole('button', { name: 'Copy owner care link', exact: true })).toBeVisible();
  await expect(host.locator('button:visible')).toHaveCount(1);
  const secondary = host.locator('details');
  await expect(secondary).toHaveCount(1);
  await expect(secondary).not.toHaveAttribute('open', '');
  await expect(host).toContainText(/copy.*paste|paste.*owner|usual chat/i);
  const beforeCopy = await page.evaluate(() => ({ writes: window.fixtureWrites, copies: window.fixtureClipboardWrites, shares: window.fixtureShareCalls }));
  expect(beforeCopy.writes).toHaveLength(1);
  expect(beforeCopy.writes[0]).toMatchObject({ action: 'create_boarding', dogName: 'Test Dog', breed: 'Kelpie', startDate: '2026-11-10', endDate: '2026-11-13', ownerName: 'Synthetic Owner', phone: '0400000000', stayIdentityVersion: 1 });
  expect(beforeCopy.writes[0]).toHaveProperty('stayId');
  expect(beforeCopy.writes[0]).toHaveProperty('clientMutationId');
  expect(beforeCopy.copies).toEqual([]);
  expect(beforeCopy.shares).toEqual([]);
  await host.getByRole('button', { name: 'Copy owner care link' }).click();
  await expect(host.getByRole('status')).toContainText(/copied/i);
  expect(await page.evaluate(() => window.fixtureClipboardWrites)).toEqual(['https://care.example.test/stay/synthetic-token']);
  expect(await page.evaluate(() => window.fixtureWrites.map(item => item.action))).toEqual(['create_boarding']);
});

test('missing returned link requires an explicit prepare click and reuses the prepared link', async ({ page, baseURL }) => {
  await setup(page, baseURL, {
    saveResponse: { result: 'success' },
    linkResponse: { result: 'success', intake: { link: 'https://care.example.test/stay/explicit-token' } }
  });
  await saveConfirmed(page);
  const host = page.locator('#p4BookingLinkResult');
  await expect(host.getByRole('button', { name: 'Prepare owner care link', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.fixtureWrites.map(item => item.action))).toEqual(['create_boarding']);
  await host.getByRole('button', { name: 'Prepare owner care link' }).click();
  await expect(host.getByRole('button', { name: 'Copy owner care link', exact: true })).toBeVisible();
  await expect(host.getByRole('button', { name: 'Prepare owner care link', exact: true })).toHaveCount(0);
  await host.getByRole('button', { name: 'Copy owner care link' }).click();
  await host.getByRole('button', { name: 'Copy owner care link' }).click();
  expect(await page.evaluate(() => window.fixtureWrites.map(item => item.action))).toEqual(['create_boarding', 'create_intake_link']);
  const create = await page.evaluate(() => window.fixtureWrites.find(item => item.action === 'create_intake_link'));
  expect(create).toMatchObject({ action: 'create_intake_link', dogName: 'Test Dog', startDate: '2026-11-10', endDate: '2026-11-13' });
  expect(await page.evaluate(() => window.fixtureClipboardWrites)).toEqual(['https://care.example.test/stay/explicit-token', 'https://care.example.test/stay/explicit-token']);
});

test('explicit prepare failure leaves booking saved, exposes retry, and never repeats booking write', async ({ page, baseURL }) => {
    await setup(page, baseURL, {
    saveResponse: { result: 'success' },
    linkResponse: { intake: { link: 'https://care.example.test/stay/retried-token' } }, linkFailsOnce: true
  });
  await saveConfirmed(page);
  const host = page.locator('#p4BookingLinkResult');
  await host.getByRole('button', { name: 'Prepare owner care link' }).click();
  await expect(host).toContainText('Synthetic token failure');
  await expect(host.getByRole('button', { name: 'Prepare owner care link' })).toBeEnabled();
  await host.getByRole('button', { name: 'Prepare owner care link' }).click();
  await expect(host.getByRole('button', { name: 'Copy owner care link' })).toBeVisible();
  expect(await page.evaluate(() => window.fixtureWrites.map(item => item.action))).toEqual(['create_boarding', 'create_intake_link', 'create_intake_link']);
});

test('editing the booking after a returned link clears the stale action without sending or regenerating', async ({ page, baseURL }) => {
  await setup(page, baseURL, { saveResponse: { result: 'success', intake: { link: 'https://care.example.test/stay/stale-test-link' } } });
  await saveConfirmed(page);
  const host = page.locator('#p4BookingLinkResult');
  await expect(host.getByRole('button', { name: 'Copy owner care link' })).toBeVisible();
  await page.locator('#p4Dog').fill('Changed Dog');
  await expect(host.getByRole('button')).toHaveCount(0);
  expect(await page.evaluate(() => window.fixtureWrites.map(item => item.action))).toEqual(['create_boarding']);
  expect(await page.evaluate(() => window.fixtureClipboardWrites)).toEqual([]);
});

test('late prepare result is discarded after the booking fields change', async ({ page, baseURL }) => {
  await setup(page, baseURL, { saveResponse: { result: 'success' }, linkDeferred: true });
  await saveConfirmed(page);
  const host = page.locator('#p4BookingLinkResult');
  await host.getByRole('button', { name: 'Prepare owner care link' }).click();
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(2);
  await page.locator('#p4Dog').fill('Changed Dog');
  await page.evaluate(() => window.resolveFixtureLink({ intake: { link: 'https://care.example.test/stay/stale-token' } }));
  await expect(host.getByRole('button', { name: 'Copy owner care link' })).toHaveCount(0);
  expect(await page.evaluate(() => window.fixtureClipboardWrites)).toEqual([]);
  expect(await page.evaluate(() => window.fixtureShareCalls)).toEqual([]);
});

test('copy fallback selects the link; returned action stays usable at 320 and 1440 in both themes', async ({ page, baseURL }) => {
  await setup(page, baseURL, { saveResponse: { result: 'success', intake: { link: 'https://care.example.test/stay/fallback-token' } }, clipboardFails: true });
  await saveConfirmed(page);
  const host = page.locator('#p4BookingLinkResult');
  await host.getByRole('button', { name: 'Copy owner care link' }).click();
  await expect(host.getByRole('status')).toContainText(/selected|press and hold|copy was blocked/i);
  await expect(host.getByLabel('Owner care link')).toBeFocused();
  const selection = await host.getByLabel('Owner care link').evaluate(field => ({ start: field.selectionStart, end: field.selectionEnd, length: field.value.length }));
  expect(selection).toEqual({ start: 0, end: selection.length, length: selection.length });
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 900 });
    for (const dark of [false, true]) {
      await page.locator('body').evaluate((body, value) => body.classList.toggle('dark-theme', value), dark);
      const geometry = await host.evaluate(node => {
        const button = node.querySelector('button');
        const rect = button.getBoundingClientRect();
        return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, height: rect.height, left: rect.left, right: rect.right };
      });
      expect(geometry.scrollWidth, `${width}px ${dark ? 'dark' : 'light'} overflow`).toBeLessThanOrEqual(geometry.clientWidth);
      expect(geometry.height, `${width}px ${dark ? 'dark' : 'light'} target`).toBeGreaterThanOrEqual(44);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.clientWidth + 1);
      await expect(host.getByRole('button', { name: 'Copy owner care link' })).toBeVisible();
    }
  }
  expect(await page.evaluate(() => window.fixtureClipboardWrites)).toHaveLength(1);
});









