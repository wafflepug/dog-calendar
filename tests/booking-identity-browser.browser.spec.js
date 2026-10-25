const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const bookingUi = fs.readFileSync(path.join(root, 'phase4-booking.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'phase4-core.js'), 'utf8');
const styleStart = core.indexOf('function style(){');
const styleEnd = core.indexOf('\nlet active=', styleStart);
const dogId = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const dogs = Object.freeze(Array.from({ length: 40 }, (_, i) => Object.freeze({
  dogId: dogId(i + 1),
  dogNumber: String(i + 1).padStart(5, '0'),
  dogName: i === 0 || i === 39 ? 'Milo' : `Dog ${String(i + 1).padStart(2, '0')}`,
  breed: i === 39 ? 'Far-end Setter' : `Breed ${String(i + 1).padStart(2, '0')}`,
  ownerName: i === 39 ? 'Zelda Farowner' : `Owner ${String(i + 1).padStart(2, '0')}`
})));

async function setup(page, { width = 390, theme = 'light' } = {}) {
  await page.goto('about:blank');
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(`<body class="${theme === 'dark' ? 'dark-theme' : ''}"><div id="p4Modal" class="p4-modal"><section class="p4-card" role="dialog"><header><button data-p4-close type="button">Close</button></header><div class="p4-body"><section data-p4-panel="booking"></section><section data-p4-panel="capacity" hidden></section><section data-p4-panel="owner" hidden></section></div></section></div></body>`);
  await page.evaluate(rows => {
    window.fixtureReads = [];
    window.fixtureWrites = [];
    window.identityRows = rows;
    window.historyHandler = async payload => ({ history: {
      dogId: payload.dogId,
      previousStays: [{ stayId: `stay-${payload.dogId}`, stayKey: `Milo|2026-09-01|2026-09-04`, startDate: '2026-09-01', endDate: '2026-09-04' }],
      latestCompletedProfile: { sourceDogId: payload.dogId, sourceStayId: `stay-${payload.dogId}`, sourceStayKey: `Milo|2026-09-01|2026-09-04`, sourceEndDate: '2026-09-04', intakeAttributes: { feedingTimes: '6am and 6pm' }, riskFlags: {} }
    } });
    window.WAFFLE_PHASE4_CORE = {
      modal: () => document.getElementById('p4Modal'), page: () => 'booking', open: () => {}, settings: () => ({ preferred: 4, absolute: 6 }),
      esc: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]),
      norm: value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), fmt: value => String(value ?? ''), today: () => '2026-09-08',
      rows: () => [], visits: () => [], duplicate: () => null, capacity: () => ({ band: 'green' }), renderDecision: () => {},
      read: async payload => {
        window.fixtureReads.push(structuredClone(payload));
        if (payload.action === 'list_dog_identities') return { identities: window.identityRows };
        return window.historyHandler(payload);
      },
      write: async payload => { window.fixtureWrites.push(structuredClone(payload)); return { result: 'success', dogId: payload.dogId || '00000000-0000-4000-8000-000000000041', stayId: payload.stayId, dogNumber: '00041' }; },
      toast: message => { window.lastToast = message; }, saveSettings: () => ({ preferred: 4, absolute: 6 }), parseBooking: () => ({})
    };
  }, dogs);
  await page.addScriptTag({ content: core.slice(styleStart, styleEnd) + '\nstyle();' });
  await page.addScriptTag({ content: bookingUi });
}

test('synchronous lookup failures recover through explicit retry without an unhandled error', async ({ page }) => {
  await setup(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => { window.WAFFLE_PHASE4_CORE.read = () => { throw Error('Transport unavailable'); }; });
  await page.locator('#p4LoadDogIdentities').click();
  await expect(page.locator('#p4IdentityResultCount')).toContainText(/unavailable|retry/i);
  await expect(page.locator('#p4LoadDogIdentities')).toBeEnabled();
  await expect(page.locator('#p4SaveConfirmed')).toBeDisabled();
  await page.evaluate(() => { window.WAFFLE_PHASE4_CORE.read = async () => ({ identities: window.identityRows }); });
  await page.locator('#p4LoadDogIdentities').click();
  await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveCount(12);
  await expect(page.locator('#p4IdentityBrowser')).toHaveAttribute('open', '');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.fixtureWrites)).toEqual([]);
});

test('duplicate UUID rows remain unresolved through the dropdown and suggested-dog actions', async ({ page }) => {
  await setup(page);
  await page.evaluate(id => {
    window.identityRows = [window.identityRows[0], { ...window.identityRows[0], ownerName: 'Another owner' }];
    window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogId: id, dogName: 'Milo', breed: 'Breed 01', ownerName: 'Owner 01' });
  }, dogId(1));
  await expect(page.locator('#p4DogIdentity')).toHaveValue('__review__');
  await expect(page.locator('#p4IdentityBrowser')).toHaveAttribute('open', '');
  await page.locator('#p4DogIdentity').selectOption(dogId(1));
  await expect(page.locator('#p4DogIdentity')).toHaveValue('__review__');
  await expect(page.locator('#p4SaveConfirmed')).toBeDisabled();
  await page.locator('[data-p4-suggest]').first().click();
  await expect(page.locator('#p4DogIdentity')).toHaveValue('__review__');
  await expect(page.locator('#p4SaveConfirmed')).toBeDisabled();
  await page.evaluate(() => window.WAFFLE_PHASE4_BOOKING.save('confirmed'));
  expect(await page.evaluate(() => window.fixtureWrites)).toEqual([]);
});

test('refreshing a focused result uses a reachable search fallback when the result disappears', async ({ page }) => {
  await setup(page);
  await loadIdentities(page);
  await page.locator(`[data-p4-identity="${dogId(1)}"]`).focus();
  await page.evaluate(() => {
    window.WAFFLE_PHASE4_CORE.read = payload => {
      window.fixtureReads.push(payload);
      return new Promise(resolve => { window.releaseRemovedDog = () => resolve({ identities: window.identityRows.slice(1) }); });
    };
  });
  await page.locator('#p4LoadDogIdentities').evaluate(button => button.click());
  await expect(page.locator('#p4IdentitySearch')).toBeFocused();
  await page.evaluate(() => window.releaseRemovedDog());
  await expect(page.locator(`[data-p4-identity="${dogId(1)}"]`)).toHaveCount(0);
  await expect(page.locator('#p4IdentitySearch')).toBeFocused();
  await expect(page.locator('#p4DogIdentity')).toHaveValue('');
  expect(await page.evaluate(() => window.fixtureWrites)).toEqual([]);
});

async function loadIdentities(page) {
  await expect(page.locator('#p4IdentityBrowser')).toBeVisible();
  if (!(await page.locator('#p4IdentityBrowser').evaluate(node => node.open))) await page.locator('#p4IdentityBrowser > summary').click();
  expect(await page.evaluate(() => window.fixtureReads.filter(x => x.action === 'list_dog_identities'))).toHaveLength(0);
  await page.locator('#p4LoadDogIdentities').click();
  await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveCount(12);
}

test('identity browser loads only on request, pages results, and searches beyond the rendered page by exact identity fields', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#p4IdentityBrowser > summary')).toHaveText('Choose a dog identity');
  await expect(page.locator('#p4IdentityBrowser')).toHaveAttribute('open', '');
  await page.locator('#p4IdentityBrowser > summary').focus();
  await page.locator('#p4IdentityBrowser > summary').press('Enter');
  await expect(page.locator('#p4IdentityBrowser')).not.toHaveAttribute('open', '');
  await page.locator('#p4IdentityBrowser > summary').press('Enter');
  await expect(page.locator('#p4IdentityBrowser')).toHaveAttribute('open', '');
  await loadIdentities(page);
  await expect(page.locator('#p4IdentityResultCount')).toContainText('40');
  await expect(page.locator('#p4IdentityResultCount')).toContainText('12');
  await expect(page.locator('#p4IdentityResultCount')).toHaveAttribute('role', 'status');
  await expect(page.locator('#p4IdentityResultCount')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#p4IdentityShowMore')).toBeVisible();
  await page.locator('#p4IdentityShowMore').click();
  await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveCount(24);
  await expect(page.locator('#p4IdentityResultCount')).toContainText('24');
  await page.locator('#p4IdentitySearch').fill('Zelda Farowner');
  await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveCount(1);
  await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveAttribute('data-p4-identity', dogId(40));
  await expect(page.locator('#p4IdentityResultCount')).toContainText('1');
  await expect(page.locator('#p4IdentityShowMore')).toBeHidden();
  await page.locator('#p4IdentitySearch').fill('Far-end Setter');
  await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveCount(1);
  await page.locator('#p4IdentitySearch').fill(dogId(40));
  await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveCount(1);
  const options = await page.locator('#p4DogIdentity option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, text: node.textContent })));
  expect(options.filter(option => option.value === dogId(1) || option.value === dogId(40))).toHaveLength(2);
  expect(options.find(option => option.value === dogId(1)).text).not.toBe(options.find(option => option.value === dogId(40)).text);
  await page.locator('#p4DogIdentity').selectOption('');
  await expect(page.locator('#p4IdentityBrowser')).toHaveAttribute('open', '');
});

test('clearing the query preserves selected Dog ID, dates and care edits without extra transport', async ({ page }) => {
  await setup(page);
  await page.locator('#p4Start').fill('2026-11-10');
  await page.locator('#p4End').fill('2026-11-12');
  await loadIdentities(page);
  await page.locator(`[data-p4-identity="${dogId(1)}"]`).click();
  await page.locator('[data-p4-load-saved-care]').click();
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('6am and 6pm');
  await page.locator('[data-p4-care-profile="feedingTimes"]').fill('edited to 7am');
  const before = await page.evaluate(() => ({ reads: window.fixtureReads.length, writes: window.fixtureWrites.length }));
  await page.locator('#p4IdentitySearch').fill('Milo');
  await expect(page.locator('#p4IdentityClearSearch')).toBeVisible();
  await page.locator('#p4IdentityClearSearch').click();
  await expect(page.locator('#p4IdentitySearch')).toHaveValue('');
  await expect(page.locator('#p4IdentitySearch')).toBeFocused();
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogId(1));
  await expect(page.locator('#p4Start')).toHaveValue('2026-11-10');
  await expect(page.locator('#p4End')).toHaveValue('2026-11-12');
  await expect(page.locator('[data-p4-care-profile="feedingTimes"]')).toHaveValue('edited to 7am');
  expect(await page.evaluate(() => ({ reads: window.fixtureReads.length, writes: window.fixtureWrites.length }))).toEqual(before);
});

test('identical refresh preserves picker nodes and search caret; changed identity invalidates old care replies', async ({ page }) => {
  await setup(page);
  await loadIdentities(page);
  await page.locator('#p4IdentitySearch').fill('Owner 01');
  await page.locator('#p4IdentitySearch').evaluate(input => { input.focus(); input.setSelectionRange(3, 3); });
  const cardIdentity = await page.locator('#p4IdentityCards [data-p4-identity]').evaluate(node => { window.identityCardNode = node; return node.dataset.p4Identity; });
  // Trigger the existing refresh without deliberately moving the sitter's focus.
  await page.locator('#p4LoadDogIdentities').evaluate(button => button.click());
  await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveCount(1);
  expect(await page.evaluate(() => document.querySelector('#p4IdentityCards [data-p4-identity]') === window.identityCardNode)).toBe(true);
  await expect(page.locator('#p4IdentitySearch')).toBeFocused();
  expect(await page.locator('#p4IdentitySearch').evaluate(input => input.selectionStart)).toBe(3);
  await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveAttribute('data-p4-identity', cardIdentity);
  const unchangedMutations = await page.evaluate(() => {
    const observer = new MutationObserver(() => {});
    observer.observe(document.querySelector('#p4IdentityBrowser'), { subtree: true, childList: true, attributes: true, characterData: true });
    document.querySelector('#p4Start').dispatchEvent(new Event('change', { bubbles: true }));
    const count = observer.takeRecords().length;
    observer.disconnect();
    return count;
  });
  expect(unchangedMutations).toBe(0);

  await page.locator('#p4IdentitySearch').fill('');
  await page.locator(`[data-p4-identity="${dogId(1)}"]`).click();
  await expect(page.locator(`[data-p4-identity="${dogId(1)}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`[data-p4-identity="${dogId(2)}"]`)).toHaveAttribute('aria-pressed', 'false');
  if (!(await page.locator('#p4IdentityBrowser').evaluate(node => node.open))) await page.locator('#p4IdentityBrowser > summary').click();
  await page.evaluate(() => {
    window.historyGate = new Promise(resolve => { window.releaseHistory = resolve; });
    window.historyHandler = async payload => { await window.historyGate; return { history: { dogId: payload.dogId, previousStays: [], latestCompletedProfile: { sourceDogId: payload.dogId, sourceStayId: `stay-${payload.dogId}`, sourceEndDate: '2026-09-12', intakeAttributes: { feedingTimes: `care-${payload.dogId}` }, riskFlags: {} } } }; };
  });
  await page.locator('[data-p4-load-saved-care]').click();
  await expect(page.locator('[data-p4-load-saved-care]')).toBeDisabled();
  await page.locator(`[data-p4-identity="${dogId(2)}"]`).click();
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogId(2));
  await page.evaluate(() => window.releaseHistory());
  await expect(page.locator('#p4ReturningMini')).not.toContainText(`care-${dogId(1)}`);
  await expect(page.locator('[data-p4-load-saved-care]')).toBeEnabled();
});

test('verified source identity collapses only untouched guest details and async replies respect user interaction', async ({ page }) => {
  await setup(page);
  await page.evaluate(id => {
    window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogId: id, dogName: 'Milo', breed: 'Breed 01', ownerName: 'Owner 01', startDate: '2026-11-10', endDate: '2026-11-12' });
  }, dogId(1));
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogId(1));
  await expect(page.locator('#p4IdentityBrowser')).not.toHaveAttribute('open', '');
  await expect(page.locator('#p4IdentityBrowser > summary')).toHaveText('Change dog');
  await expect(page.locator('#p4GuestDetails')).not.toHaveAttribute('open', '');
  await expect(page.locator('#p4Start')).toHaveValue('2026-11-10');
  await expect(page.locator('#p4End')).toHaveValue('2026-11-12');
  await expect(page.locator('#p4BookingContext')).toContainText('Milo');
  await expect(page.locator('#p4ReturningMini')).not.toContainText('Milo');
  await expect(page.locator('#p4ReturningMini')).not.toContainText('Dog ID');
  await page.locator('[data-p4-load-saved-care]').click();
  await expect(page.locator('#p4ReturningMini')).toHaveAttribute('data-source-stay-id', `stay-${dogId(1)}`);
  await expect(page.locator('#p4ReturningMini')).toHaveAttribute('data-source-end-date', '2026-09-04');
  await expect(page.locator('#p4CareConfirm')).not.toBeChecked();
  await page.locator('#p4CareConfirm').check();
  await expect(page.locator('#p4ReturningMini')).toHaveAttribute('data-source-stay-id', `stay-${dogId(1)}`);

  await setup(page);
  await page.evaluate(id => {
    window.identityGate = new Promise(resolve => { window.releaseIdentity = resolve; });
    const originalRead = window.WAFFLE_PHASE4_CORE.read;
    window.WAFFLE_PHASE4_CORE.read = async payload => {
      if (payload.action === 'list_dog_identities') { window.fixtureReads.push(structuredClone(payload)); return window.identityGate; }
      return originalRead(payload);
    };
    window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogId: id, dogName: 'Milo', breed: 'Breed 01', ownerName: 'Owner 01' });
  }, dogId(1));
  await page.locator('#p4IdentitySearch').fill('Milo');
  await page.locator('#p4Start').focus();
  await page.evaluate(() => window.releaseIdentity({ identities: window.identityRows }));
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogId(1));
  await expect(page.locator('#p4IdentityBrowser')).toHaveAttribute('open', '');
  await expect(page.locator('#p4Start')).toBeFocused();
});

test('pending list and exact-ID lookups coalesce, failures offer retry, and stale replies cannot reset a newer context', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    window.identityGate = new Promise(resolve => { window.releaseIdentity = resolve; });
    const originalRead = window.WAFFLE_PHASE4_CORE.read;
    window.WAFFLE_PHASE4_CORE.read = async payload => {
      if (payload.action === 'list_dog_identities') { window.fixtureReads.push(structuredClone(payload)); return window.identityGate; }
      return originalRead(payload);
    };
  });
  await page.locator('#p4LoadDogIdentities').click();
  await expect(page.locator('#p4LoadDogIdentities')).toBeDisabled();
  expect(await page.evaluate(() => window.fixtureReads.filter(x => x.action === 'list_dog_identities'))).toHaveLength(1);
  await expect(page.locator('#p4IdentityResultCount')).toContainText(/loading|checking|retrieving/i);
  await page.evaluate(() => window.releaseIdentity({ identities: window.identityRows }));
  await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveCount(12);

  await page.evaluate(() => {
    window.refreshGate = new Promise(resolve => { window.releaseRefresh = resolve; });
    const originalRead = window.WAFFLE_PHASE4_CORE.read;
    window.WAFFLE_PHASE4_CORE.read = async payload => {
      if (payload.action === 'list_dog_identities') { window.fixtureReads.push(structuredClone(payload)); return window.refreshGate; }
      return originalRead(payload);
    };
  });
  await page.locator('#p4LoadDogIdentities').click();
  await expect(page.locator('#p4LoadDogIdentities')).toBeDisabled();
  await expect(page.locator('#p4IdentityCards [data-p4-identity]').first()).toBeDisabled();
  await page.evaluate(() => window.releaseRefresh({ identities: window.identityRows }));
  await expect(page.locator('#p4IdentityCards [data-p4-identity]').first()).toBeEnabled();

  await page.evaluate(() => {
    window.failIdentityOnce = true;
    const originalRead = window.WAFFLE_PHASE4_CORE.read;
    window.WAFFLE_PHASE4_CORE.read = async payload => {
      if (payload.action === 'list_dog_identities' && window.failIdentityOnce) { window.fixtureReads.push(structuredClone(payload)); window.failIdentityOnce = false; throw Error('offline'); }
      return originalRead(payload);
    };
  });
  await page.locator('#p4LoadDogIdentities').click();
  await expect(page.locator('#p4IdentityResultCount')).toContainText(/unavailable|failed|retry/i);
  await expect(page.locator('#p4IdentityResultCount')).not.toContainText(/0 (dogs|results)/i);
  await expect(page.locator('#p4LoadDogIdentities')).toBeEnabled();
  await page.locator('#p4LoadDogIdentities').click();
  await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveCount(12);

  await page.evaluate(() => {
    window.lookupGates = [];
    window.WAFFLE_PHASE4_CORE.read = payload => {
      if (payload.action !== 'list_dog_identities') return window.historyHandler(payload);
      window.fixtureReads.push(structuredClone(payload));
      return new Promise(resolve => { window.lookupGates.push(resolve); });
    };
  });
  await page.evaluate(id => window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogId: id, dogName: 'Milo', breed: 'Breed 01', ownerName: 'Owner 01' }), dogId(1));
  await expect(page.locator('#p4DogIdentityStatus')).toContainText(/Checking|confirm/i);
  await page.evaluate(id => window.WAFFLE_PHASE4_BOOKING.openReturningBooking({ dogId: id, dogName: 'Dog 02', breed: 'Breed 02', ownerName: 'Owner 02' }), dogId(2));
  await expect(page.locator('#p4Dog')).toHaveValue('Dog 02');
  await page.evaluate(() => window.lookupGates[0]({ identities: window.identityRows }));
  await expect(page.locator('#p4DogIdentityStatus')).toContainText(/Checking|confirm/i);
  await expect(page.locator('#p4DogIdentity')).not.toHaveValue(dogId(1));
  await page.evaluate(() => window.lookupGates[1]({ identities: window.identityRows }));
  await expect(page.locator('#p4DogIdentity')).toHaveValue(dogId(2));
  await expect(page.locator('#p4DogIdentityStatus')).toContainText(/Exact Dog ID confirmed/i);
  expect(await page.evaluate(() => window.fixtureWrites)).toHaveLength(0);
});

test('identity controls remain usable at phone, tablet and desktop widths in light and dark themes', async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    for (const theme of ['light', 'dark']) {
      await setup(page, { width, theme });
      await loadIdentities(page);
      await page.locator('#p4IdentitySearch').fill('Zelda Farowner');
      await expect(page.locator('#p4IdentityCards [data-p4-identity]')).toHaveCount(1);
      const metrics = await page.evaluate(() => {
        const panel = document.querySelector('[data-p4-panel="booking"]');
        const controls = ['#p4IdentityBrowser > summary', '#p4IdentitySearch', '#p4IdentityClearSearch', '#p4IdentityShowMore', '#p4LoadDogIdentities']
          .map(selector => document.querySelector(selector)).filter(node => node && !node.hidden && node.getClientRects().length);
        return {
          viewport: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          panel: panel.getBoundingClientRect().width,
          countFontSize: parseFloat(getComputedStyle(document.querySelector('#p4IdentityResultCount')).fontSize),
          controls: controls.map(node => ({ height: node.getBoundingClientRect().height, right: node.getBoundingClientRect().right, left: node.getBoundingClientRect().left }))
        };
      });
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.viewport);
      expect(metrics.panel).toBeLessThanOrEqual(metrics.viewport);
      expect(metrics.countFontSize).toBeGreaterThanOrEqual(12);
      for (const control of metrics.controls) {
        expect(control.height).toBeGreaterThanOrEqual(44);
        expect(control.left).toBeGreaterThanOrEqual(0);
        expect(control.right).toBeLessThanOrEqual(metrics.viewport + 1);
      }
    }
  }
});
