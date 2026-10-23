const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dogA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dogB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const core = fs.readFileSync(path.join(root, 'phase4-core.js'), 'utf8');
const styleStart = core.indexOf('function style(){');
const styleEnd = core.indexOf('\nlet active=', styleStart);

async function setup(page, baseURL, options = {}) {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 200, body: '' }));
  await page.setViewportSize({ width: options.width || 390, height: 844 });
  await page.goto(`${baseURL}/waffle-runtime.css`, { waitUntil: 'domcontentloaded' });
  await page.setContent('<body><div id="p4Modal" class="p4-modal"><section class="p4-card" role="dialog" aria-modal="true"><header class="p4-head"><h2>Booking</h2><button data-p4-close type="button">Close</button></header><nav class="p4-tabs"></nav><div class="p4-body"><section class="p4-panel" data-p4-panel="booking"></section><section data-p4-panel="capacity" hidden></section><section data-p4-panel="owner" hidden></section></div></section></div></body>');
  await page.evaluate(({ dogA, dogB, options }) => {
    window.fixtureWrites = []; window.fixtureReads = []; window.fixtureCopies = [];
    window.fixtureOutcomes = options.outcomes || [];
    window.fixtureCopyFails = !!options.copyFails;
    window.fixtureHoldWriteAt = options.holdWriteAt || 0;
    window.fixtureHoldCopy = false;
    window.fixtureNames = [options.longName || 'Luna', 'Milo'];
    window.identityRows = [
      { dogId: dogA, dogNumber: options.noDogNumber ? '' : '00001', dogName: window.fixtureNames[0], breed: 'Pug', ownerName: 'Synthetic Owner' },
      { dogId: dogB, dogNumber: '00002', dogName: 'Milo', breed: 'Terrier', ownerName: 'Synthetic Owner' }
    ];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => {
      window.fixtureCopies.push(value);
      if (window.fixtureHoldCopy) await new Promise(resolve => { window.resolveFixtureCopy = resolve; });
      if (window.fixtureCopyFails) throw Error('Synthetic clipboard denial');
    } } });
    window.WAFFLE_PHASE4_CORE = {
      modal: () => document.getElementById('p4Modal'), page: () => 'booking', open: () => {},
      settings: () => ({ preferred: 4, absolute: 6 }),
      esc: value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]),
      norm: value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
      fmt: value => String(value ?? ''), today: () => '2026-10-23', rows: () => [], visits: () => [],
      read: async payload => { window.fixtureReads.push(payload); return payload.action === 'list_dog_identities' ? { identities: window.identityRows } : { history: { previousStays: [], stayCount: 0 } }; },
      write: async payload => {
        window.fixtureWrites.push(structuredClone(payload));
        if (window.fixtureWrites.length === window.fixtureHoldWriteAt) await new Promise(resolve => { window.resolveFixtureWrite = resolve; });
        const outcome = window.fixtureOutcomes.shift() || 'saved';
        if (outcome === 'queued') return { result: 'success', queued: true };
        if (outcome === 'error') throw Error('Synthetic save failure');
        return { result: 'success', dogId: payload.dogId, dogNumber: options.noDogNumber ? '' : payload.dogId === dogA ? '00001' : '00002', stayId: payload.stayId,
          intakeLink: outcome === 'missing' ? '' : outcome === 'unsafe' ? 'javascript:alert(1)' : `https://example.test/care/${payload.stayId}` };
      },
      duplicate: () => null, capacity: () => ({ band: 'green' }), renderDecision: () => {}, toast: () => {},
      saveSettings: () => ({ preferred: 4, absolute: 6 }), parseBooking: () => ({})
    };
  }, { dogA, dogB, options });
  await page.addScriptTag({ content: core.slice(styleStart, styleEnd) + '\nstyle();' });
  await page.addStyleTag({ url: `${baseURL}/waffle-runtime.css` });
  await page.addScriptTag({ path: path.join(root, 'booking-plan.js') });
  await page.addScriptTag({ path: path.join(root, 'phase4-booking.js') });
  await page.locator('#p4PlanDisclosure').evaluate(el => { el.open = true; el.dispatchEvent(new Event('toggle')); });
  await page.locator('#p4PlanOwner').fill('Synthetic Owner');
  await page.locator('#p4PlanPhone').fill('0400000000');
  await page.locator('#p4PlanNext').click();
  await page.locator('#p4LoadDogIdentities').click();
  for (const id of (options.newDog ? [''] : options.twoDogs ? [dogA, dogB] : [dogA])) {
    await page.locator('#p4DogIdentity').selectOption(id);
    if (!id) { await page.locator('#p4Dog').fill('Luna'); await page.locator('#p4Breed').fill('Pug'); }
    await page.locator('#p4PlanAddDog').click();
  }
  await page.locator('#p4PlanNext').click();
  for (const [start, end] of [['2026-12-08', '2026-12-10'], ['2026-12-15', '2026-12-20']]) {
    await page.locator('#p4PlanStart').fill(start); await page.locator('#p4PlanEnd').fill(end);
    await page.locator('#p4PlanAddVisit').click();
  }
  await page.locator('#p4PlanNext').click();
  await page.locator('#p4PlanReview').click();
}

async function save(page) {
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('All visits saved');
}
async function choose(page, index = 0) {
  const disclosure = page.locator('#p4PlanShare');
  if (await disclosure.getAttribute('open') === null) await disclosure.locator('summary').click();
  const select = page.locator('#p4PlanShareStay');
  const value = await select.locator('option').nth(index + 1).getAttribute('value');
  await select.focus(); await select.selectOption(value);
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(select).toBeFocused();
  return value;
}
async function expectedLinks(page) { return page.evaluate(() => window.fixtureWrites.map(x => `https://example.test/care/${x.stayId}`)); }

test('one dog two dates: explicit selection copies only the chosen saved stay', async ({ page, baseURL }) => {
  await setup(page, baseURL); await save(page);
  await expect(page.locator('.p4-plan-next-action')).toContainText('All planned visits are saved');
  await expect(page.locator('#p4PlanShare')).not.toHaveAttribute('open', '');
  await expect(page.locator('#p4PlanRows a')).toHaveCount(0);
  expect(await page.evaluate(() => window.fixtureCopies)).toEqual([]);
  const reads = await page.evaluate(() => window.fixtureReads.length);
  await choose(page, 1);
  await expect(page.locator('#p4PlanShareCard')).toContainText('Luna · Dog ID #00001');
  await expect(page.locator('#p4PlanShareCard')).toContainText('15 Dec 2026');
  await page.locator('[data-p4-plan-copy]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.p4-plan-share-status')).toContainText('copied');
  expect(await page.evaluate(() => window.fixtureCopies)).toEqual([(await expectedLinks(page))[1]]);
  expect(await page.evaluate(() => window.fixtureReads.length)).toBe(reads);
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(2);
});

test('two dogs two dates retain four distinct original link permissions', async ({ page, baseURL }) => {
  await setup(page, baseURL, { twoDogs: true }); await save(page);
  await expect(page.locator('#p4PlanShareStay option')).toHaveCount(5);
  for (let index = 0; index < 4; index++) {
    await choose(page, index);
    await expect(page.locator('#p4PlanShareCard')).toContainText(index < 2 ? 'Dog ID #00001' : 'Dog ID #00002');
    await page.locator('[data-p4-plan-copy]').click();
  }
  expect(await page.evaluate(() => window.fixtureCopies)).toEqual(await expectedLinks(page));
  expect(await page.evaluate(() => window.fixtureWrites.map(x => x.action))).toEqual(Array(4).fill('create_boarding'));
});

test('queued rows are held while Resume saves only other frozen intents', async ({ page, baseURL }) => {
  await setup(page, baseURL, { twoDogs: true, outcomes: ['saved', 'queued', 'saved', 'error'] });
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('Resume other visits');
  await expect(page.locator('#p4PlanRows > [role="status"]')).toContainText('Saved 1 · Queued 1');
  await expect(page.locator('.p4-plan-next-action')).not.toContainText('All');
  await expect(page.locator('#p4PlanShareStay option')).toHaveCount(2);
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('Resume other visits');
  await expect(page.locator('#p4PlanRows > [role="status"]')).toContainText('Saved 2 · Queued 1 · Needs attention 1');
  await expect(page.locator('.p4-plan-next-action')).toContainText('attention');
  await expect(page.locator('#p4PlanShareStay option')).toHaveCount(3);
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('Check saved visits');
  await expect(page.locator('#p4PlanRows > [role="status"]')).toContainText('Saved 3 · Queued 1 · Needs attention 0');
  const writes = await page.evaluate(() => window.fixtureWrites);
  expect(writes).toHaveLength(5);
  expect(writes.filter(x => x.stayId === writes[0].stayId)).toHaveLength(1);
  expect(writes[3]).toEqual(writes[4]);
  expect(writes[1].stayId).not.toBe(writes[0].stayId);
  await expect(page.locator('#p4PlanShareStay option')).toHaveCount(4);
  await expect(page.locator('[data-p4-result-status="queued"]')).toHaveCount(1);
});

test('Check saved visits reconciles only an exact server stay and keeps its unavailable care link honest', async ({ page, baseURL }) => {
  await setup(page, baseURL, { outcomes: ['queued'] });
  await page.locator('#p4PlanSave').click();
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('Check saved visits');
  const queuedIntent = await page.evaluate(() => structuredClone(window.fixtureWrites[0]));
  await page.evaluate(queued => {
    window.fixtureReads = [];
    window.WAFFLE_PHASE4_CORE.read = async payload => {
      window.fixtureReads.push(payload);
      if (payload.action === 'get_dog_history') return { result: 'success', history: {
        dogId: payload.dogId, dogNumber: '00001', previousStays: [{
          dogId: payload.dogId, stayId: queued.stayId, startDate: queued.startDate,
          endDate: queued.endDate, bookingType: 'Boarding'
        }]
      } };
      return { result: 'success', identities: [] };
    };
  }, queuedIntent);
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanRows > [role="status"]')).toContainText('Saved 2 · Queued 0');
  await expect(page.locator('[data-p4-result-status="saved"]')).toHaveCount(2);
  await expect(page.locator('.p4-plan-next-action')).toContainText('Owner Care Link in Care');
  await expect(page.locator('#p4PlanShareStay option')).toHaveCount(2);
  expect(await page.evaluate(() => window.fixtureReads)).toEqual([{
    action: 'get_dog_history', dogName: 'Luna', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  }]);
  const writes = await page.evaluate(() => window.fixtureWrites);
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(queuedIntent);
});

test('a queued new-dog stay holds same-dog rows until its exact Dog ID is confirmed', async ({ page, baseURL }) => {
  await setup(page, baseURL, { newDog: true, outcomes: ['queued'] });
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('Check saved visits');
  await expect(page.locator('#p4PlanRows > [role="status"]')).toContainText('Saved 0 · Queued 1');
  expect(await page.evaluate(() => window.fixtureWrites)).toHaveLength(1);
  const queuedIntent = await page.evaluate(() => structuredClone(window.fixtureWrites[0]));
  await page.evaluate(queued => {
    window.fixtureReads = [];
    window.WAFFLE_PHASE4_CORE.read = async payload => {
      window.fixtureReads.push(payload);
      if (payload.action === 'list_dog_identities') return { result: 'success', identities: [{
        dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', dogName: 'Luna', dogNumber: '00002'
      }] };
      return { result: 'success', history: {
        dogId: payload.dogId, dogNumber: '00002', previousStays: [{
          dogId: payload.dogId, stayId: queued.stayId, startDate: queued.startDate,
          endDate: queued.endDate, bookingType: 'Boarding'
        }]
      } };
    };
  }, queuedIntent);
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('[data-p4-result-status="saved"]')).toHaveCount(1);
  await expect(page.locator('#p4PlanSave')).toHaveText('Resume planned visits');
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('All visits saved');
  const writes = await page.evaluate(() => window.fixtureWrites);
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(queuedIntent);
  expect(writes[1].dogId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  expect(writes[1].inheritDogPhoto).toBe(true);
  expect(writes[1].stayId).not.toBe(writes[0].stayId);
  expect(writes[1].clientMutationId).not.toBe(writes[0].clientMutationId);
});

test('a saved-visits check locks competing actions, ignores a repeated click and restores focus', async ({ page, baseURL }) => {
  await setup(page, baseURL, { newDog: true, outcomes: ['queued'] });
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('Check saved visits');
  await page.evaluate(() => {
    window.fixtureReads = [];
    window.historyReadStarted = false;
    window.resolveHistoryRead = null;
    window.WAFFLE_PHASE4_CORE.read = payload => {
      window.fixtureReads.push(payload);
      if (payload.action === 'list_dog_identities') return Promise.resolve({ result: 'success', identities: [
        { dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', dogName: 'Luna', dogNumber: '00002' }
      ] });
      window.historyReadStarted = true;
      return new Promise(resolve => { window.resolveHistoryRead = () => resolve({ result: 'success', history: {
        dogId: payload.dogId, previousStays: [{ dogId: payload.dogId,
          stayId: window.fixtureWrites[0].stayId, startDate: window.fixtureWrites[0].startDate,
          endDate: window.fixtureWrites[0].endDate, bookingType: 'Boarding' }]
      } }); });
    };
  });
  const check = page.locator('#p4PlanSave');
  await check.focus();
  await check.click();
  await expect.poll(() => page.evaluate(() => window.historyReadStarted)).toBe(true);
  await expect(check).toBeDisabled();
  await page.evaluate(() => document.querySelector('[data-p4-plan-check-saved]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(await page.evaluate(() => window.fixtureReads.filter(row => row.action === 'get_dog_history'))).toHaveLength(1);
  await page.evaluate(() => window.resolveHistoryRead());
  await expect(page.locator('[data-p4-result-status="saved"]')).toHaveCount(1);
  await expect(page.locator('#p4PlanSave')).toBeFocused();
  expect(await page.evaluate(() => window.fixtureReads.map(row => row.action))).toEqual(['list_dog_identities', 'get_dog_history']);
  expect(await page.evaluate(() => window.fixtureWrites)).toHaveLength(1);
});

test('a saved-visits check leaves focus alone after the user moves outside the dialog', async ({ page, baseURL }) => {
  await setup(page, baseURL, { newDog: true, outcomes: ['queued'] });
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('Check saved visits');
  await page.evaluate(() => {
    window.historyReadStarted = false;
    window.resolveHistoryRead = null;
    window.WAFFLE_PHASE4_CORE.read = payload => {
      if (payload.action === 'list_dog_identities') return Promise.resolve({ result: 'success', identities: [
        { dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', dogName: 'Luna', dogNumber: '00002' }
      ] });
      window.historyReadStarted = true;
      return new Promise(resolve => { window.resolveHistoryRead = () => resolve({ result: 'success', history: {
        dogId: payload.dogId, previousStays: [{ dogId: payload.dogId,
          stayId: window.fixtureWrites[0].stayId, startDate: window.fixtureWrites[0].startDate,
          endDate: window.fixtureWrites[0].endDate, bookingType: 'Boarding' }]
      } }); });
    };
    const outside = document.createElement('button');
    outside.type = 'button'; outside.id = 'outsideRecoveryFocus'; outside.textContent = 'Outside dialog';
    document.body.append(outside);
  });
  await page.locator('#p4PlanSave').click();
  await expect.poll(() => page.evaluate(() => window.historyReadStarted)).toBe(true);
  await page.locator('#outsideRecoveryFocus').focus();
  await page.evaluate(() => window.resolveHistoryRead());
  await expect(page.locator('[data-p4-result-status="saved"]')).toHaveCount(1);
  await expect(page.locator('#outsideRecoveryFocus')).toBeFocused();
});

test('failed, mismatched and duplicate history reads keep a queued row unconfirmed and block repeated checks', async ({ page, baseURL }) => {
  await setup(page, baseURL, { outcomes: ['queued', 'saved'] });
  await page.locator('#p4PlanSave').click();
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('Check saved visits');
  const queued = await page.evaluate(() => structuredClone(window.fixtureWrites[0]));
  await page.evaluate(() => {
    window.fixtureReads = [];
    window.historyFixture = { mode: 'failure' };
    window.WAFFLE_PHASE4_CORE.read = async payload => {
      window.fixtureReads.push(payload);
      if (window.historyFixture.mode === 'failure') throw Error('Synthetic read outage');
      const stay = { dogId: payload.dogId, stayId: window.queuedStayId, startDate: window.queuedStart, endDate: window.queuedEnd, bookingType: 'Boarding' };
      if (window.historyFixture.mode === 'mismatch') stay.endDate = '2027-01-01';
      return { result: 'success', history: { dogId: payload.dogId, previousStays: window.historyFixture.mode === 'duplicate' ? [stay, { ...stay }] : [stay] } };
    };
    window.queuedStayId = window.fixtureWrites[0].stayId;
    window.queuedStart = window.fixtureWrites[0].startDate;
    window.queuedEnd = window.fixtureWrites[0].endDate;
  });
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanStatus')).toContainText('could not confirm');
  await expect(page.locator('[data-p4-result-status="queued"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.fixtureReads)).toHaveLength(1);
  await page.evaluate(() => { window.historyFixture.mode = 'mismatch'; });
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('[data-p4-result-status="queued"]')).toHaveCount(1);
  await page.evaluate(() => { window.historyFixture.mode = 'duplicate'; });
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('[data-p4-result-status="queued"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.fixtureReads)).toHaveLength(3);
  expect(await page.evaluate(() => window.fixtureWrites[0])).toEqual(queued);
  expect(await page.evaluate(() => window.fixtureWrites)).toHaveLength(2);
});

test('an ambiguous new-dog name does not guess which Dog ID owns a queued stay', async ({ page, baseURL }) => {
  await setup(page, baseURL, { newDog: true, outcomes: ['queued'] });
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('Check saved visits');
  await page.evaluate(() => {
    window.fixtureReads = [];
    window.WAFFLE_PHASE4_CORE.read = async payload => {
      window.fixtureReads.push(payload);
      return { result: 'success', identities: [
        { dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', dogName: 'Luna' },
        { dogId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', dogName: 'Luna' }
      ] };
    };
  });
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('[data-p4-result-status="queued"]')).toHaveCount(1);
  await expect(page.locator('#p4PlanSave')).toHaveText('Check saved visits');
  expect(await page.evaluate(() => window.fixtureReads.map(row => row.action))).toEqual(['list_dog_identities']);
  expect(await page.evaluate(() => window.fixtureWrites)).toHaveLength(1);
});

test('one authoritative history read checks multiple queued visits for the same Dog ID', async ({ page, baseURL }) => {
  await setup(page, baseURL, { outcomes: ['queued', 'queued'] });
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanRows > [role="status"]')).toContainText('Saved 0 · Queued 1');
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanSave')).toHaveText('Check saved visits');
  await page.evaluate(() => {
    window.fixtureReads = [];
    window.WAFFLE_PHASE4_CORE.read = async payload => {
      window.fixtureReads.push(payload);
      const visits = window.fixtureWrites.map(write => ({ dogId: payload.dogId, stayId: write.stayId, startDate: write.startDate, endDate: write.endDate, bookingType: 'Boarding' }));
      return { result: 'success', history: { dogId: payload.dogId, previousStays: visits } };
    };
  });
  await page.locator('#p4PlanSave').click();
  await expect(page.locator('#p4PlanRows > [role="status"]')).toContainText('Saved 2 · Queued 0');
  expect(await page.evaluate(() => window.fixtureReads)).toEqual([{
    action: 'get_dog_history', dogName: 'Luna', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  }]);
  expect(await page.evaluate(() => window.fixtureWrites)).toHaveLength(2);
});

for (const width of [320, 390, 1440]) for (const dark of [false, true]) {
  test(`queued result opens existing Pending Sync review at ${width}px ${dark ? 'dark' : 'light'}`, async ({ page, baseURL }) => {
    await setup(page, baseURL, { width, outcomes: ['saved', 'queued'] });
    await page.evaluate(dark => {
      document.body.classList.toggle('dark-theme', dark);
      const review = document.createElement('button');
      review.type = 'button'; review.dataset.whSitterSyncReview = '';
      review.setAttribute('aria-label', 'Review queued updates');
      review.addEventListener('click', () => { window.pendingSyncOpened = true; });
      document.body.append(review);
    }, dark);
    await page.locator('#p4PlanSave').click();
    const writesBeforeReview = await page.evaluate(() => structuredClone(window.fixtureWrites));
    await expect(page.locator('#p4PlanRows > [role="status"]')).toContainText('Saved 1 · Queued 1');
    await expect(page.locator('[data-p4-result-status="queued"]')).toContainText('queued');
    await expect(page.locator('.p4-plan-next-action')).toContainText('not confirmed saved');
    const resume = page.locator('#p4PlanSave');
    await expect(resume).toHaveText('Check saved visits');
    const review = page.locator('[data-p4-plan-queue-review]');
    await expect(review).toHaveText('Open Pending Sync');
    await expect(review).toBeVisible();
    expect(await review.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await review.focus();
    await expect(review).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.pendingSyncOpened)).toBe(true);
    expect(await page.evaluate(() => window.fixtureWrites)).toEqual(writesBeforeReview);
    await expect(page.locator('#p4PlanRows > [role="status"]')).toContainText('Saved 1 · Queued 1');
    await expect(page.locator('[data-p4-result-status="queued"]')).toContainText('queued');
    await expect(page.locator('#p4PlanShareStay option')).toHaveCount(2);
    const payloads = await page.evaluate(() => window.fixtureWrites);
    expect(payloads.map(row => row.stayId)).toEqual(writesBeforeReview.map(row => row.stayId));
    expect(payloads.map(row => row.clientMutationId)).toEqual(writesBeforeReview.map(row => row.clientMutationId));
    expect(payloads.every(row => row.dogId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(true);
  });
}

test('missing and unsafe returned links never offer a copy action or create a token', async ({ page, baseURL }) => {
  await setup(page, baseURL, { outcomes: ['missing', 'unsafe'] }); await save(page);
  await expect(page.locator('.p4-plan-next-action')).toContainText('Owner Care Link in Care');
  await expect(page.locator('#p4PlanShare')).toHaveCount(0);
  await expect(page.locator('[data-p4-plan-copy]')).toHaveCount(0);
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(2);
});

test('clipboard denial exposes only the exact selected readonly link with manual guidance', async ({ page, baseURL }) => {
  await setup(page, baseURL, { copyFails: true }); await save(page); await choose(page, 1);
  await page.locator('[data-p4-plan-copy]').click();
  const field = page.locator('#p4PlanShareCard textarea');
  await expect(field).toBeVisible(); await expect(field).toBeFocused(); await expect(field).toHaveAttribute('readonly', '');
  await expect(field).toHaveValue((await expectedLinks(page))[1]);
  await expect(page.locator('.p4-plan-share-status')).toContainText('blocked');
  expect(await field.evaluate(el => el.selectionEnd - el.selectionStart)).toBe((await field.inputValue()).length);
  await choose(page, 0); await expect(field).toBeHidden();
  expect(await page.evaluate(() => window.fixtureWrites.length)).toBe(2);
});

test('a partially saved plan cannot announce all saved while its next write is pending', async ({ page, baseURL }) => {
  await setup(page, baseURL, { holdWriteAt: 2 });
  await page.locator('#p4PlanSave').click();
  await expect.poll(() => page.evaluate(() => typeof window.resolveFixtureWrite)).toBe('function');
  await expect(page.locator('.p4-plan-next-action')).not.toContainText('All');
  await expect(page.locator('#p4PlanShareStay option')).toHaveCount(2);
  await page.evaluate(() => window.resolveFixtureWrite());
  await expect(page.locator('#p4PlanSave')).toHaveText('All visits saved');
});

test('late clipboard completion cannot display success on another selected stay', async ({ page, baseURL }) => {
  await setup(page, baseURL); await save(page); await choose(page, 0);
  await page.evaluate(() => { window.fixtureHoldCopy = true; });
  await page.locator('[data-p4-plan-copy]').click();
  await expect.poll(() => page.evaluate(() => typeof window.resolveFixtureCopy)).toBe('function');
  await choose(page, 1); await page.evaluate(() => { window.fixtureHoldCopy = false; window.resolveFixtureCopy(); });
  await expect(page.locator('.p4-plan-share-status')).not.toContainText('copied');
  await page.locator('[data-p4-plan-copy]').click();
  await expect(page.locator('.p4-plan-share-status')).toContainText('copied');
  expect(await page.evaluate(() => window.fixtureCopies)).toEqual(await expectedLinks(page));
});

test('missing readable dog number disables copying without exposing an internal UUID', async ({ page, baseURL }) => {
  await setup(page, baseURL, { noDogNumber: true }); await save(page); await choose(page, 0);
  await expect(page.locator('[data-p4-plan-copy]')).toBeDisabled();
  await expect(page.locator('#p4PlanShareCard')).toContainText('not returned');
  await expect(page.locator('#p4PlanShareCard')).not.toContainText(dogA);
  expect(await page.evaluate(() => window.fixtureCopies)).toEqual([]);
});

test('manual-copy field remains selected when another visit completes saving', async ({ page, baseURL }) => {
  await setup(page, baseURL, { copyFails: true, holdWriteAt: 2 });
  await page.locator('#p4PlanSave').click();
  await expect.poll(() => page.evaluate(() => typeof window.resolveFixtureWrite)).toBe('function');
  await choose(page, 0); await page.locator('[data-p4-plan-copy]').click();
  const field = page.locator('#p4PlanShareCard textarea');
  await expect(field).toBeFocused();
  await page.evaluate(() => window.resolveFixtureWrite());
  await expect(page.locator('#p4PlanSave')).toHaveText('All visits saved');
  await expect(page.locator('#p4PlanShare')).toHaveAttribute('open', '');
  await expect(field).toBeVisible(); await expect(field).toBeFocused();
  await expect(field).toHaveValue((await expectedLinks(page))[0]);
  expect(await field.evaluate(el => el.selectionEnd - el.selectionStart)).toBe((await field.inputValue()).length);
});

for (const width of [320, 390, 1440]) for (const dark of [false, true]) {
  test(`completion sharing wraps long identity at ${width} ${dark ? 'dark' : 'light'}`, async ({ page, baseURL }, info) => {
    await setup(page, baseURL, { width, longName: 'Alexandria Peterson-Smith-Wellington and Family' });
    await page.evaluate(dark => document.body.classList.toggle('dark-theme', dark), dark);
    await save(page); await choose(page, 1);
    const card = page.locator('#p4PlanShareCard');
    await expect(card).toContainText('Alexandria Peterson-Smith-Wellington and Family');
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect((await page.locator('[data-p4-plan-copy]').boundingBox()).height).toBeGreaterThanOrEqual(44);
    if (process.env.WAFFLE_CAPTURE_UI_EVIDENCE === '1' && info.project.name === 'chromium' && width !== 390) {
      const folder = path.join(root, 'output/releases/2026.10.23.02/evidence'); fs.mkdirSync(folder, { recursive: true });
      await page.locator('#p4PlanShare').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(folder, `completion-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
