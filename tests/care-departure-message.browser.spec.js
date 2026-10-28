const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const moduleSource = fs.readFileSync(path.join(__dirname, '..', 'care-departure-message.js'), 'utf8');
async function loadDepartureModule(page) {
  await page.addScriptTag({ content: moduleSource });
  await page.evaluate(() => {
    // Fixture identifiers are stable synthetic values; production receives the canonical validator.
    window.v110ValidStayId = value => !!String(value || '').trim();
    window.writeCalls = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.writeCalls.push(text); } }
    });
  });
}

async function setupEvidence(page, options = {}) {
  const second = options.secondCheckout
    ? '<article class="directory-card" data-directory-stay-id="stay-c" data-directory-stay-key="solo|2026-10-18|2026-10-18|c" data-directory-dog-id="dog-c" data-directory-dog-name="Solo" data-directory-start-date="2026-10-18" data-directory-end-date="2026-10-18"><button class="directory-guest-tile-open">Solo</button></article>'
    : '';
  await page.setContent(`<!doctype html><main class="directory-dashboard-fused"><div id="directory-grid" class="directory-grid directory-grid-fused">
    <article class="directory-card" data-testid="selected-card" data-directory-stay-id="stay-a" data-directory-stay-key="twin|2026-10-18|2026-10-18|a" data-directory-dog-id="dog-a" data-directory-dog-number="#0017" data-directory-dog-name="Twin" data-directory-start-date="2026-10-18" data-directory-end-date="2026-10-18"><button class="directory-guest-tile-open">Twin</button><section data-belongings-summary><ul class="belongings-summary-list"><li>Blue lead</li><li>Food tub</li></ul></section><span data-care-brief-medication>Return blue inhaler</span></article>
    <article class="directory-card" data-directory-stay-id="stay-b" data-directory-stay-key="twin|2026-10-18|2026-10-20|b" data-directory-dog-id="dog-b" data-directory-dog-name="Twin" data-directory-start-date="2026-10-18" data-directory-end-date="2026-10-20"><button class="directory-guest-tile-open">Twin</button></article>${second}
  </div></main>`);
  await page.evaluate(() => { window.getLocalTodayDateString = () => '2026-10-18'; });
}

async function publishSelected(page) {
  await page.evaluate(() => {
    const card = document.querySelector('[data-testid="selected-card"]');
    const payload = {
      stayId: card.dataset.directoryStayId, stayKey: card.dataset.directoryStayKey,
      dogId: card.dataset.directoryDogId, dogName: card.dataset.directoryDogName,
      startDate: card.dataset.directoryStartDate, endDate: card.dataset.directoryEndDate
    };
    window.WAFFLE_DEPARTURE_MESSAGE.publishVerified(payload, {
      result: 'success', record: { ...payload, status: 'checked_out', checkedOutAt: '2026-10-18T03:00:00.000Z' }
    }, card);
  });
}

test('verified same-day checkout publishes one collapsed message for the selected dog and date', async ({ page }) => {
  await setupEvidence(page);
  await loadDepartureModule(page);
  const grid = page.locator('#directory-grid');
  await expect(page.locator('#v11217DepartureMessageBanner')).toHaveCount(0);
  await publishSelected(page);
  const banner = page.locator('#v11217DepartureMessageBanner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Departure message · Twin · #00017 · Checked out 18 Oct 2026');
  await expect(banner).toBeAttached();
  await expect(page.locator('#v11217GuidedCheckout')).toBeHidden();
  const disclosure = banner.locator('[data-v11217-departure-disclosure]');
  await expect(disclosure).toHaveJSProperty('open', false);
  expect(await page.evaluate(() => window.writeCalls.length)).toBe(0);
  expect(await banner.evaluate(node => node.compareDocumentPosition(document.querySelector('#directory-grid')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await disclosure.locator('summary').click();
  await expect(banner.locator('[data-v11217-departure-text]')).toHaveValue(
    'Hi! Twin checked out on 18 Oct 2026. Thank you for choosing Waffle House!'
  );
  await expect(banner).not.toContainText('Return blue inhaler');
  await expect(banner).not.toContainText('Blue lead');
  await banner.locator('[data-v11217-departure-copy]').click();
  await expect(banner.locator('[data-v11217-departure-status]')).toContainText('Message copied');
  expect(await page.evaluate(() => window.writeCalls)).toEqual([
    'Hi! Twin checked out on 18 Oct 2026. Thank you for choosing Waffle House!'
  ]);
  await banner.locator('[data-v11217-departure-dismiss]').click();
  await expect(banner).toHaveCount(0);
  await expect(grid).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.classList.contains('directory-guest-tile-open'))).toBe(true);
});

test('queued, conflicting, mismatched, invalid-date and reused-card responses do not publish a banner', async ({ page }) => {
  await setupEvidence(page);
  await loadDepartureModule(page);
  const queued = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="selected-card"]');
    const payload = { stayId: card.dataset.directoryStayId, stayKey: card.dataset.directoryStayKey, dogId: card.dataset.directoryDogId, dogName: card.dataset.directoryDogName, startDate: card.dataset.directoryStartDate, endDate: card.dataset.directoryEndDate };
    return window.WAFFLE_DEPARTURE_MESSAGE.publishVerified(payload, { result: 'success', queued: true, record: { ...payload, status: 'checked_out', checkedOutAt: '2026-10-18T03:00:00.000Z' } }, card);
  });
  expect(queued).toBe(false);
  await expect(page.locator('#v11217DepartureMessageBanner')).toHaveCount(0);
});

test('operation verification rejects malformed or conflicting records and never uses scheduled end as actual date', async ({ page }) => {
  await setupEvidence(page);
  await loadDepartureModule(page);
  const selected = page.getByTestId('selected-card');
  const invalid = await page.evaluate(card => {
    const payload = {
      stayId: card.dataset.directoryStayId, stayKey: card.dataset.directoryStayKey,
      dogId: card.dataset.directoryDogId, dogName: card.dataset.directoryDogName,
      startDate: card.dataset.directoryStartDate, endDate: card.dataset.directoryEndDate
    };
    const base = { result: 'success', record: { ...payload, status: 'checked_out', checkedOutAt: '2026-10-18T03:00:00.000Z' } };
    const variants = [
      [{ ...base, pending: true }],
      [{ ...base, conflict: true }],
      [{ ...base, record: { ...base.record, identityConflict: true } }],
      [{ ...base, record: { ...base.record, status: 'checked_in' } }],
      [{ ...base, record: { ...base.record, stayId: '22222222-2222-4222-8222-222222222222' } }],
      [{ ...base, record: { ...base.record, dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } }],
      [{ ...base, record: { ...base.record, dogName: 'Another dog' } }],
      [{ ...base, record: { ...base.record, startDate: '2026-10-17' } }],
      [{ ...base, record: { ...base.record, endDate: '2026-10-19' } }],
      [{ ...base, record: { ...base.record, checkedOutAt: 'invalid timestamp', actualCheckoutDate: '' } }],
      [{ ...base, record: { ...base.record, checkedOutAt: '2026-10-22T03:00:00.000Z', actualCheckoutDate: '' } }],
      [{ ...base, record: { ...base.record, actualCheckoutDate: 'not-a-date' } }]
    ];
    const results = variants.map(([response]) => window.WAFFLE_DEPARTURE_MESSAGE.publishVerified(payload, response, card));
    const withoutRecordDogId = { ...base, record: { ...base.record } };
    delete withoutRecordDogId.record.dogId;
    results.push(window.WAFFLE_DEPARTURE_MESSAGE.verify(payload, withoutRecordDogId, card) !== null);
    return results;
  }, await selected.elementHandle());
  expect(invalid).toEqual([...Array(12).fill(false), true]);
  await expect(page.locator('#v11217DepartureMessageBanner')).toHaveCount(0);
});

test('fallback UUID validation accepts a late checkout actual date after booked end and rejects future dates', async ({ page }) => {
  await setupEvidence(page);
  await loadDepartureModule(page);
  const results = await page.evaluate(() => {
    window.v110ValidStayId = undefined;
    const card = document.querySelector('[data-testid="selected-card"]');
    Object.assign(card.dataset, {
      directoryStayId: '11111111-1111-4111-8111-111111111111',
      directoryStayKey: 'twin|2026-10-16|2026-10-17|late',
      directoryStartDate: '2026-10-16', directoryEndDate: '2026-10-17'
    });
    const payload = {
      stayId: card.dataset.directoryStayId, stayKey: card.dataset.directoryStayKey,
      dogId: card.dataset.directoryDogId, dogName: card.dataset.directoryDogName,
      startDate: card.dataset.directoryStartDate, endDate: card.dataset.directoryEndDate
    };
    const record = { ...payload, status: 'checked_out', actualCheckoutDate: '2026-10-18' };
    const lateSameDay = window.WAFFLE_DEPARTURE_MESSAGE.verify(payload, { result: 'success', record }, card) !== null;
    const futureDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const future = window.WAFFLE_DEPARTURE_MESSAGE.verify(payload, {
      result: 'success', record: { ...record, actualCheckoutDate: futureDate }
    }, card) !== null;
    return { lateSameDay, future };
  });
  expect(results).toEqual({ lateSameDay: true, future: false });
});

test('copy denial selects the message for manual copy; sharing cancellation sends nothing', async ({ page }) => {
  await setupEvidence(page);
  await loadDepartureModule(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
    window.shareCalls = 0;
    Object.defineProperty(navigator, 'share', {
      configurable: true, value: async () => {
        window.shareCalls += 1;
        const error = new Error('cancelled'); error.name = 'AbortError'; throw error;
      }
    });
  });
  await publishSelected(page);
  const banner = page.locator('#v11217DepartureMessageBanner');
  const disclosure = banner.locator('[data-v11217-departure-disclosure]');
  await disclosure.locator('summary').click();
  await banner.locator('[data-v11217-departure-copy]').click();
  await expect(banner.locator('[data-v11217-departure-status]')).toContainText('message is selected');
  const selection = await banner.locator('[data-v11217-departure-text]').evaluate(field => [field.selectionStart, field.selectionEnd, field.value.length]);
  expect(selection[1]).toBe(selection[2]);
  await banner.locator('[data-v11217-departure-share]').click();
  await expect(banner.locator('[data-v11217-departure-status]')).toContainText('Sharing cancelled');
  expect(await page.evaluate(() => window.shareCalls)).toBe(1);
});

test('message composition excludes private operational notes', async ({ page }) => {
  await setupEvidence(page);
  await loadDepartureModule(page);
  await page.evaluate(() => {
    const card = document.createElement('article');
    card.className = 'directory-card';
    Object.assign(card.dataset, {
      directoryStayId: '33333333-3333-4333-8333-333333333333',
      directoryStayKey: 'early|2026-10-16|2026-10-21|early',
      directoryDogId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      directoryDogName: 'Early Pup',
      directoryStartDate: '2026-10-16',
      directoryEndDate: '2026-10-21'
    });
    card.innerHTML = '<button class="directory-guest-tile-open">Early Pup</button><div class="directory-profile-content"></div>';
    document.querySelector('#directory-grid').appendChild(card);
    window.privateNote = 'PRIVATE medication note';
  });
  await page.evaluate(() => {
    const card = document.querySelector('[data-directory-stay-id="33333333-3333-4333-8333-333333333333"]');
    const payload = { stayId: card.dataset.directoryStayId, stayKey: card.dataset.directoryStayKey, dogId: card.dataset.directoryDogId, dogName: card.dataset.directoryDogName, startDate: card.dataset.directoryStartDate, endDate: card.dataset.directoryEndDate };
    window.WAFFLE_DEPARTURE_MESSAGE.publishVerified(payload, { result: 'success', record: { ...payload, status: 'checked_out', checkedOutAt: '2026-10-18T03:00:00.000Z' } }, card);
  });
  const banner = page.locator('#v11217DepartureMessageBanner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Departure message · Early Pup');
  await expect(banner).not.toContainText('PRIVATE medication note');
  await expect(banner.locator('[data-v11217-departure-disclosure]')).toHaveJSProperty('open', false);
  await expect(banner.locator('[data-v11217-departure-text]')).toHaveValue('Hi! Early Pup checked out on 18 Oct 2026. Thank you for choosing Waffle House!');
});

test('banner hides outside the current roster and a later verified checkout replaces it', async ({ page }) => {
  await setupEvidence(page, { secondCheckout: true });
  await loadDepartureModule(page);
  await publishSelected(page);
  const banner = page.locator('#v11217DepartureMessageBanner');
  const tabs = await page.evaluate(() => {
    const dashboard = document.querySelector('.directory-dashboard-fused');
    const nav = document.createElement('nav');
    nav.innerHTML = '<button data-v1082-stay-tab="current" class="is-active">Staying</button><button data-v1082-stay-tab="past">Past</button>';
    dashboard.prepend(nav);
    document.querySelector('[data-v1082-stay-tab="current"]').classList.remove('is-active');
    document.querySelector('[data-v1082-stay-tab="past"]').classList.add('is-active');
    window.WAFFLE_DEPARTURE_MESSAGE.refreshVisibility();
    return true;
  });
  expect(tabs).toBe(true);
  await expect(banner).toBeHidden();
  await page.locator('[data-v1082-stay-tab="past"]').click();
  await page.locator('[data-v1082-stay-tab="current"]').evaluate(button => button.classList.add('is-active'));
  await page.locator('[data-v1082-stay-tab="past"]').evaluate(button => button.classList.remove('is-active'));
  await page.evaluate(() => window.WAFFLE_DEPARTURE_MESSAGE.refreshVisibility());
  await expect(banner).toBeVisible();
  await page.locator('[data-directory-stay-id="stay-c"]').evaluate(card => {
    const payload = { stayId: card.dataset.directoryStayId, stayKey: card.dataset.directoryStayKey, dogId: card.dataset.directoryDogId, dogName: card.dataset.directoryDogName, startDate: card.dataset.directoryStartDate, endDate: card.dataset.directoryEndDate };
    window.WAFFLE_DEPARTURE_MESSAGE.publishVerified(payload, { result: 'success', record: { ...payload, status: 'checked_out', checkedOutAt: '2026-10-18T03:00:00.000Z' } }, card);
  });
  await expect(page.locator('#v11217DepartureMessageBanner')).toHaveCount(1);
  await expect(banner).toContainText('Departure message · Solo · Checked out 18 Oct 2026');
  await expect(banner).not.toContainText('Departure message · Twin');
});

test('departure summary omits unassigned or internal identifiers and normalizes existing numbers',async({page})=>{
  await setupEvidence(page); await loadDepartureModule(page);
  const card=page.getByTestId('selected-card');
  for(const raw of ['Other','0','#00000','123456','11111111-1111-4111-8111-111111111111','']){
    await card.evaluate((node,value)=>{node.dataset.directoryDogNumber=value;},raw);
    await publishSelected(page);
    await expect(page.locator('#v11217DepartureMessageBanner summary')).toHaveText('Departure message · Twin · Checked out 18 Oct 2026');
  }
  await card.evaluate(node=>{node.dataset.directoryDogNumber='17';});
  await publishSelected(page);
  await expect(page.locator('#v11217DepartureMessageBanner summary')).toHaveText('Departure message · Twin · #00017 · Checked out 18 Oct 2026');
  expect(await page.evaluate(()=>window.writeCalls.length)).toBe(0);
});


test('departure copying locks repeated actions and never updates a replacement banner',async({page})=>{
 await setupEvidence(page);await loadDepartureModule(page);
 await page.evaluate(()=>{
  window.pendingCopies=[];
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:text=>new Promise(resolve=>window.pendingCopies.push({text,resolve}))}});
  Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{window.shareAttempts=(window.shareAttempts||0)+1;}});
 });
 await publishSelected(page);
 const banner=page.locator('#v11217DepartureMessageBanner');
 await banner.locator('summary').click();
 const copy=banner.locator('[data-v11217-departure-copy]'),share=banner.locator('[data-v11217-departure-share]');
 await copy.click();
 await expect(copy).toBeDisabled();await expect(share).toBeDisabled();
 await expect(banner.locator('[data-v11217-departure-status]')).toContainText('Nothing has been sent');
 await copy.evaluate(node=>node.click());await share.evaluate(node=>node.click());
 expect(await page.evaluate(()=>window.pendingCopies.length)).toBe(1);
 expect(await page.evaluate(()=>window.shareAttempts||0)).toBe(0);
 await publishSelected(page);
 await page.evaluate(()=>window.pendingCopies[0].resolve());
 await expect(banner.locator('[data-v11217-departure-copy]')).toBeEnabled();
 await expect(banner.locator('[data-v11217-departure-status]')).toContainText('No message has been sent');
});

test('blocked copying retains manual recovery without stealing focus after the message closes',async({page})=>{
 await setupEvidence(page);await loadDepartureModule(page);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise((resolve,reject)=>{window.rejectDepartureCopy=reject;})}}));
 await publishSelected(page);
 const banner=page.locator('#v11217DepartureMessageBanner');
 await banner.locator('summary').click();
 await banner.locator('[data-v11217-departure-copy]').click();
 await banner.locator('summary').click();
 await page.locator('#directory-grid .directory-guest-tile-open').first().focus();
 await page.evaluate(()=>window.rejectDepartureCopy(new Error('Clipboard blocked')));
 await expect(banner.locator('[data-v11217-departure-status]')).toHaveText('Copy was blocked. Open the message to copy it manually.');
 await expect(page.locator('#directory-grid .directory-guest-tile-open').first()).toBeFocused();
 await expect(banner.locator('[data-v11217-departure-copy]')).toBeEnabled();
 await banner.locator('summary').click();
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Blocked');}}}));
 await banner.locator('[data-v11217-departure-copy]').click();
 await expect(banner.locator('[data-v11217-departure-text]')).toBeFocused();
 await expect(banner.locator('[data-v11217-departure-status]')).toContainText('message is selected');
});
