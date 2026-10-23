const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const helper = path.join(root, 'owner-handoff.js');
const bookingScript = fs.readFileSync(path.join(root, 'phase4-booking.js'), 'utf8');
const coreScript = fs.readFileSync(path.join(root, 'phase4-core.js'), 'utf8');
const styleStart = coreScript.indexOf('function style(){');
const styleEnd = coreScript.indexOf('\nlet active=', styleStart);
test.beforeEach(async ({ page }) => { await page.route('**/*', route => { const url = new URL(route.request().url()); return ['127.0.0.1','localhost'].includes(url.hostname) ? route.continue() : route.abort(); }); });

async function setup(page, baseURL, { share = false, clipboardFails = false } = {}) {
  await page.goto(`${baseURL}/waffle-runtime.css`, { waitUntil: 'domcontentloaded' });
  await page.setContent(`<link rel="stylesheet" href="${baseURL}/waffle-runtime.css"><main><div id="handoff"></div></main>`);
  await page.evaluate(() => {
    window.__clipboardWrites = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async value => { window.__clipboardWrites.push(value); if (window.__clipboardFails) throw new Error('blocked'); }
    } });
    window.__shareCalls = [];
  });
  await page.evaluate(fails => { window.__clipboardFails = fails; }, clipboardFails);
  if (share) await page.evaluate(() => { navigator.share = async data => { window.__shareCalls.push(data); }; });
  await page.addScriptTag({ path: helper });
}

const valid = { link: 'https://care.example.test/stay/AbC123', dogName: 'Milo', startDate: '2026-11-10', endDate: '2026-11-13' };

async function setupOwnerDialog(page, baseURL = 'http://127.0.0.1:4327') {
  await page.setContent('<body data-waffle-page="booking"><div id="p4Modal" class="p4-modal"><section class="p4-card" role="dialog" aria-modal="true"><header class="p4-head"><h2>Booking</h2><button data-p4-close type="button">Close</button></header><nav class="p4-tabs"></nav><div class="p4-body"><section class="p4-panel" data-p4-panel="booking" hidden></section><section class="p4-panel" data-p4-panel="capacity" hidden></section><section class="p4-panel" data-p4-panel="owner"></section></div></section></div></body>');
  await page.evaluate(() => {
    document.documentElement.dataset.waffleUiReady = 'true';
    window.fixtureWrites = [];
    window.fixtureReads = [];
    window.fixtureIdentityRows = [{ dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', dogNumber: '00001', dogName: 'Milo', breed: 'Kelpie', ownerName: 'Alex' }];
    window.fixtureWriteHandler = async payload => ({ intake: { link: 'https://care.example.test/stay/AbC123' } });
    window.WAFFLE_PHASE4_CORE = {
      modal: () => document.getElementById('p4Modal'), page: () => 'booking', open: () => {},
      settings: () => ({ preferred: 4, absolute: 6 }),
      esc: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]),
      norm: value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      fmt: value => String(value ?? ''), today: () => '2026-10-18', rows: () => window.fixtureRows || [], visits: () => [],
      read: async payload => { window.fixtureReads.push(payload); return payload.action === 'list_dog_identities' ? { identities: window.fixtureIdentityRows } : { history: { previousStays: [], stayCount: 0 } }; },
      write: async payload => { window.fixtureWrites.push(structuredClone(payload)); return window.fixtureWriteHandler(payload); },
      duplicate: () => null, capacity: () => ({ band: 'green' }), renderDecision: () => {}, toast: message => { window.lastToast = message; },
      saveSettings: () => ({ preferred: 4, absolute: 6 }), parseBooking: () => ({})
    };
  });
  await page.addScriptTag({ path: helper });
  await page.addScriptTag({ content: coreScript.slice(styleStart, styleEnd) + '\nstyle();' });
  await page.addStyleTag({ url: `${baseURL}/waffle-runtime.css` });
  await page.addScriptTag({ content: bookingScript });
  await page.evaluate(() => { window.WAFFLE_PHASE4_BOOKING.fillOwner({ dogName: 'Milo', breed: 'Kelpie', ownerName: 'Alex', startDate: '2026-11-10', endDate: '2026-11-13' }); document.getElementById('p4Modal').hidden = false; });
}

test('owner handoff renders readable owner message and adapts without horizontal overflow', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  await page.evaluate(data => window.WAFFLE_OWNER_HANDOFF.render(document.querySelector('#handoff'), data), valid);
  const card = page.locator('.owner-handoff');
  await expect(card).toBeVisible();
  await expect(card.getByLabel('Message to owner')).toHaveAttribute('readonly', '');
  const message = await card.getByLabel('Message to owner').inputValue();
  expect(message).toContain('Milo');
  expect(message).toContain('10 Nov 2026');
  expect(message).toContain('13 Nov 2026');
  expect(message).toContain(valid.link);
  await expect(card.getByRole('button', { name: 'Copy message' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0);
  const metrics = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    controls: [...document.querySelectorAll('.owner-handoff button')].map(el => el.getBoundingClientRect().height),
    textarea: document.querySelector('.owner-handoff textarea').getBoundingClientRect().width
  }));
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.client);
  expect(metrics.controls.every(height => height >= 44)).toBeTruthy();
  expect(metrics.textarea).toBeGreaterThan(0);
});

test('very long guest names and URLs wrap inside the card', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  const data = { ...valid, dogName: 'Milo '.repeat(14), link: `https://care.example.test/${'very-long-owner-token-'.repeat(10)}` };
  await page.evaluate(value => window.WAFFLE_OWNER_HANDOFF.render(document.querySelector('#handoff'), value), data);
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    card: document.querySelector('.owner-handoff').getBoundingClientRect().width
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
  expect(sizes.card).toBeGreaterThan(0);
  expect(await page.getByLabel('Message to owner').inputValue()).toContain(data.dogName.trim());
});

test('copy failure selects the message and gives manual copy guidance without a prompt', async ({ page, baseURL }) => {
  await setup(page, baseURL, { clipboardFails: true });
  await page.evaluate(data => window.WAFFLE_OWNER_HANDOFF.render(document.querySelector('#handoff'), data), valid);
  await page.getByRole('button', { name: 'Copy message' }).click();
  const textarea = page.getByLabel('Message to owner');
  await expect(textarea).toBeFocused();
  await expect(page.getByRole('status')).toContainText(/select|copy|manually/i);
  expect(await page.evaluate(() => window.__clipboardWrites.length)).toBe(1);
  expect(await page.evaluate(() => typeof window.prompt)).toBe('function');
});

test('native share starts only after a click and cancellation does not claim delivery', async ({ page, baseURL }) => {
  await setup(page, baseURL, { share: true });
  await page.evaluate(data => window.WAFFLE_OWNER_HANDOFF.render(document.querySelector('#handoff'), data), valid);
  const share = page.getByRole('button', { name: 'Share', exact: true });
  await expect(share).toBeVisible();
  expect(await page.evaluate(() => window.__shareCalls.length)).toBe(0);
  await page.evaluate(() => { navigator.share = async data => { window.__shareCalls.push(data); const error = new Error('cancelled'); error.name = 'AbortError'; throw error; }; });
  await share.click();
  await expect.poll(() => page.evaluate(() => window.__shareCalls.length)).toBe(1);
  const status = await page.getByRole('status').innerText();
  expect(status).not.toMatch(/sent|delivered|shared successfully/i);
});

test('invalid and non-HTTP links produce no actionable card', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  for (const link of ['javascript:alert(1)', 'data:text/html,hello', 'not a URL']) {
    await page.evaluate(({ link, data }) => { const host = document.querySelector('#handoff'); host.replaceChildren(); window.WAFFLE_OWNER_HANDOFF.render(host, { ...data, link }); }, { link, data: valid });
    await expect(page.locator('.owner-handoff button')).toHaveCount(0);
  }
});

test('compact boarding mode leads with one copy action and keeps secondary sharing closed', async ({ page, baseURL, browserName }, testInfo) => {
  await setup(page, baseURL, { share: true });
  await page.evaluate(data => window.WAFFLE_OWNER_HANDOFF.render(document.querySelector('#handoff'), data, { compact: true }), valid);
  const card = page.locator('.owner-handoff-compact');
  await expect(card.getByRole('button', { name: 'Copy owner care link', exact: true })).toBeVisible();
  await expect(card.locator('button:visible')).toHaveCount(1);
  await expect(card.getByLabel('Owner care link')).toBeHidden();
  await expect(card.locator('[data-secondary-options]')).not.toHaveAttribute('open', '');
  await expect(card).toContainText('Milo');
  expect(await page.evaluate(() => ({ copies: window.__clipboardWrites, shares: window.__shareCalls }))).toEqual({ copies: [], shares: [] });

  const width = page.viewportSize()?.width;
  if (browserName === 'chromium' && (width === 320 || width === 1440)) {
    for (const dark of [false, true]) {
      await page.locator('body').evaluate((body, value) => body.classList.toggle('dark-theme', value), dark);
      const metrics = await card.evaluate(node => {
        const button = node.querySelector('button.primary').getBoundingClientRect();
        return { scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, height: button.height, left: button.left, right: button.right };
      });
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.client);
      expect(metrics.height).toBeGreaterThanOrEqual(44);
      expect(metrics.left).toBeGreaterThanOrEqual(0);
      expect(metrics.right).toBeLessThanOrEqual(metrics.client + 1);
      const screenshotPath = testInfo.outputPath(`owner-handoff-compact-${width}-${dark ? 'dark' : 'light'}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await testInfo.attach(`owner-handoff-compact-${width}-${dark ? 'dark' : 'light'}`, { path: screenshotPath, contentType: 'image/png' });
    }
    await page.locator('body').evaluate(body => body.classList.remove('dark-theme'));
  }

  await card.getByRole('button', { name: 'Copy owner care link' }).click();
  expect(await page.evaluate(() => window.__clipboardWrites)).toEqual([valid.link]);
  await card.locator('[data-secondary-options] > summary').click();
  await expect(card.getByLabel('Owner care link')).toBeHidden();
  await expect(card.getByRole('button', { name: 'Copy message', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Copy link', exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__shareCalls.length)).toBe(0);
  await card.getByRole('button', { name: 'Share', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__shareCalls.length)).toBe(1);
});

test('compact copy failure reveals and selects only the owner care link', async ({ page, baseURL }) => {
  await setup(page, baseURL, { clipboardFails: true });
  await page.evaluate(data => window.WAFFLE_OWNER_HANDOFF.render(document.querySelector('#handoff'), data, { compact: true }), valid);
  const card = page.locator('.owner-handoff-compact');
  await expect(card.getByLabel('Owner care link')).toBeHidden();
  await card.getByRole('button', { name: 'Copy owner care link' }).click();
  const field = card.getByLabel('Owner care link');
  await expect(field).toBeVisible();
  await expect(field).toBeFocused();
  expect(await field.evaluate(element => ({ value: element.value, start: element.selectionStart, end: element.selectionEnd }))).toEqual({ value: valid.link, start: 0, end: valid.link.length });
  await expect(card.getByRole('status')).toContainText(/selected|press and hold/i);
  await expect(card.locator('button:visible')).toHaveCount(1);
});

test('phase-4 owner dialog reuses an unchanged prepare, shows the owner card, and reads no guest history', async ({ page, browserName }, testInfo) => {
  await setupOwnerDialog(page);
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('.owner-handoff')).toBeVisible();
  await expect(page.locator('#p4OwnerPrepare')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Copy owner care link', exact: true })).toBeVisible();
  expect(await page.getByLabel('Message to owner').inputValue()).toContain('Milo');
  await page.evaluate(() => window.WAFFLE_PHASE4_BOOKING.createOwnerCareLink());
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(1);
  expect(await page.evaluate(() => window.fixtureReads.map(item => item.action))).not.toContain('get_dog_history');
  if (browserName === 'chromium' && ['chromium-390', 'chromium-1440'].includes(testInfo.project.name)) {
    const out = path.join(root, 'output', 'releases', '2026.10.18.01');
    fs.mkdirSync(out, { recursive: true });
    await page.screenshot({ path: path.join(out, `owner-handoff-${testInfo.project.name}.png`), fullPage: true });
  }
});

test('editing stay dates invalidates and removes a previously prepared message', async ({ page }) => {
  await setupOwnerDialog(page);
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('.owner-handoff')).toBeVisible();
  await page.locator('#p4OwnerDetails > summary').click();
  await page.locator('#p4OwnerEnd').fill('2026-11-14');
  await expect(page.locator('.owner-handoff')).toHaveCount(0);
  await expect(page.locator('#p4OwnerPrepare')).toBeVisible();
});

test('owner dialog has one primary step and restores preparation after dates change', async ({ page }) => {
  await setupOwnerDialog(page);
  const primaries = page.locator('[data-p4-panel="owner"] button.primary:visible');
  await expect(primaries).toHaveCount(1);
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('#p4OwnerPrepare')).toBeHidden();
  await expect(primaries).toHaveCount(1);
  await expect(primaries).toHaveText('Copy owner care link');
  await expect(page.getByLabel('Message to owner')).toBeHidden();
  await page.locator('#p4OwnerDetails > summary').click();
  await page.locator('#p4OwnerEnd').fill('2026-11-14');
  await expect(page.locator('#p4LinkResult')).toBeEmpty();
  await expect(page.locator('#p4OwnerPrepare')).toBeVisible();
  await expect(primaries).toHaveCount(1);
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(1);
  expect(await page.evaluate(() => window.fixtureReads.map(item => item.action))).not.toContain('get_dog_history');
});

test('an unusable returned link keeps preparation available for explicit retry', async ({ page }) => {
  await setupOwnerDialog(page);
  await page.evaluate(() => { window.fixtureWriteHandler = async () => ({ intake: { link: 'https://name:secret@care.example.test/form' } }); });
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('#p4OwnerStatus')).toContainText('The owner care link was not returned.');
  await expect(page.locator('#p4OwnerPrepare')).toBeVisible();
  await expect(page.locator('#p4OwnerLink')).toBeEnabled();
  await expect(page.locator('.owner-handoff')).toHaveCount(0);
  await page.evaluate(() => { window.fixtureWriteHandler = async () => ({ intake: { link: 'https://care.example.test/retry' } }); });
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('#p4OwnerPrepare')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Copy owner care link', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(2);
});

test('switching the guest while a link write is pending never renders the stale result and restores Prepare', async ({ page }) => {
  await setupOwnerDialog(page);
  await page.evaluate(() => { window.fixtureWriteHandler = () => new Promise(resolve => { window.resolveOwnerWrite = resolve; }); });
  await page.locator('#p4OwnerLink').click();
  await expect.poll(() => page.evaluate(() => window.fixtureWrites.length)).toBe(1);
  await page.evaluate(() => window.WAFFLE_PHASE4_BOOKING.fillOwner({ dogName: 'Nova', startDate: '2026-12-01', endDate: '2026-12-03' }));
  await page.evaluate(() => window.resolveOwnerWrite({ intake: { link: 'https://care.example.test/stale' } }));
  await expect(page.locator('.owner-handoff')).toHaveCount(0);
  await expect(page.locator('#p4OwnerLink')).toBeEnabled();
  await expect(page.locator('#p4OwnerLink')).toHaveText('Prepare owner message');
});

test('failed owner link writes show an inline error and allow retry', async ({ page }) => {
  await setupOwnerDialog(page);
  await page.evaluate(() => { let tries = 0; window.fixtureWriteHandler = async () => { if (!tries++) throw new Error('Synthetic write failure'); return { intake: { link: 'https://care.example.test/retry' } }; }; });
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('#p4OwnerStatus')).toContainText('Synthetic write failure');
  await expect(page.locator('#p4OwnerLink')).toBeEnabled();
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('.owner-handoff')).toBeVisible();
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(2);
});

test('same-name identities block owner-link generation before any write', async ({ page }) => {
  await setupOwnerDialog(page);
  await page.evaluate(() => {
    window.fixtureIdentityRows = [
      { dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', dogNumber: '00001', dogName: 'Milo', breed: 'Kelpie' },
      { dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', dogNumber: '00002', dogName: 'Milo', breed: 'Kelpie' }
    ];
  });
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('#p4OwnerStatus')).toContainText(/more than one Dog ID/i);
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(0);
  expect(await page.evaluate(() => window.fixtureReads.map(item => item.action))).not.toContain('get_dog_history');
});

test('owner phone and stay date labels stay clear of their fields on phone viewports', async ({ page, baseURL }, testInfo) => {
  await setupOwnerDialog(page, baseURL);
  const sizes = [
    { width: 320, height: 700 }, { width: 360, height: 740 },
    { width: 375, height: 780 }, { width: 390, height: 844 },
    { width: 412, height: 850 }, { width: 430, height: 900 },
    { width: 667, height: 320 }, { width: 667, height: 360 }
  ];
  await page.locator('#p4OwnerDetails > summary').click();
  await page.locator('#p4OwnerPhone').fill('0400 111 222 · owner phone contact details');
  await page.locator('#p4OwnerDog').fill('Milo, the very long named family dog of Alexandria Peterson-Smith');
  for (const viewport of sizes) {
    await page.setViewportSize(viewport);
    for (const textScale of [1, 2]) {
      await page.locator('#p4Modal').evaluate((modal, scale) => {
        for (const element of modal.querySelectorAll('[data-p4-panel="owner"] .p4-field span, [data-p4-panel="owner"] .p4-field input, [data-p4-panel="owner"] button')) {
          if (!element.dataset.auditBaseFont) element.dataset.auditBaseFont = getComputedStyle(element).fontSize;
          element.style.fontSize = `${parseFloat(element.dataset.auditBaseFont) * scale}px`;
        }
      }, textScale);
      for (const dark of [false, true]) {
        await page.locator('body').evaluate((node, value) => node.classList.toggle('dark-theme', value), dark);
        const layout = await page.locator('#p4Modal [data-p4-panel="owner"] .p4-field').evaluateAll(fields => fields.map(field => {
          const label = field.querySelector('span').getBoundingClientRect();
          const input = field.querySelector('input').getBoundingClientRect();
          return { labelBottom: label.bottom, inputTop: input.top, inputBottom: input.bottom, right: input.right, left: input.left,
            fieldRight: field.getBoundingClientRect().right, labelFont: parseFloat(getComputedStyle(field.querySelector('span')).fontSize),
            baseLabelFont: parseFloat(field.querySelector('span').dataset.auditBaseFont), inputFont: parseFloat(getComputedStyle(field.querySelector('input')).fontSize),
            baseInputFont: parseFloat(field.querySelector('input').dataset.auditBaseFont) };
        }));
        expect(layout.length).toBe(4);
        expect(layout.every(item => item.labelBottom <= item.inputTop + 1), JSON.stringify({ viewport, textScale, dark, layout })).toBeTruthy();
        expect(layout.every(item => item.inputBottom - item.inputTop >= 44 && item.right <= item.fieldRight + 1 && item.left >= 0), JSON.stringify({ viewport, textScale, dark, layout })).toBeTruthy();
        expect(layout.every(item => item.labelFont >= 13 * textScale && item.inputFont >= 16 * textScale), JSON.stringify({ viewport, textScale, dark, layout })).toBeTruthy();
        expect(layout.every(item => item.labelFont >= item.baseLabelFont * textScale && item.inputFont >= item.baseInputFont * textScale), JSON.stringify({ viewport, textScale, dark, layout })).toBeTruthy();
        if (textScale === 2 && dark && [320, 390, 667].includes(viewport.width)) {
          const screenshotPath = testInfo.outputPath(`owner-handoff-${viewport.width}x${viewport.height}-200-percent-dark.png`);
          await page.screenshot({ path: screenshotPath });
          await testInfo.attach(`owner-handoff-${viewport.width}x${viewport.height}-200-percent-dark.png`, { path: screenshotPath, contentType: 'image/png' });
          await page.locator('#p4OwnerEnd').scrollIntoViewIfNeeded();
          const datePath = testInfo.outputPath(`owner-dates-${viewport.width}x${viewport.height}-200-percent-dark.png`);
          await page.screenshot({ path: datePath });
          await testInfo.attach(`owner-dates-${viewport.width}x${viewport.height}-200-percent-dark.png`, { path: datePath, contentType: 'image/png' });
        }
      }
    }
  }
  await page.locator('body').evaluate(node => node.classList.remove('dark-theme'));
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('.owner-handoff')).toBeVisible();
  const ownerButtons = page.locator('#p4Modal [data-p4-panel="owner"] button:visible');
  for (const button of await ownerButtons.all()) {
    await button.scrollIntoViewIfNeeded();
    const reachable = await button.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return rect.height >= 44 && rect.top >= 0 && rect.bottom <= innerHeight && (hit === element || element.contains(hit));
    });
    expect(reachable).toBeTruthy();
  }
});


test('validation errors release the prepare lock and corrected dates can be retried', async ({ page }) => {
  await setupOwnerDialog(page);
  await page.evaluate(() => window.WAFFLE_PHASE4_BOOKING.fillOwner({ dogName: 'Milo' }));
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('#p4OwnerStatus')).not.toHaveText('');
  await expect(page.locator('#p4OwnerLink')).toBeEnabled();
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(0);
  await page.locator('#p4OwnerDetails > summary').click();
  await page.locator('#p4OwnerStart').fill('2026-11-10');
  await page.locator('#p4OwnerEnd').fill('2026-11-13');
  await page.locator('#p4OwnerLink').click();
  await expect(page.locator('.owner-handoff')).toBeVisible();
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(1);
});

test('copy actions use the complete message or just the link as labelled', async ({ page, baseURL }) => {
  await setup(page, baseURL);
  await page.evaluate(data => window.WAFFLE_OWNER_HANDOFF.render(document.querySelector('#handoff'), data), valid);
  const message = await page.getByLabel('Message to owner').inputValue();
  await page.getByRole('button', { name: 'Copy message', exact: true }).click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  expect(await page.evaluate(() => window.__clipboardWrites)).toEqual([message, valid.link]);
});
