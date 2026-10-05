const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

const script = path.resolve(__dirname, '../care-operation-review.js');
const stayId = '00000000-0000-4000-8000-000000000001';
const dogId = '00000000-0000-4000-8000-000000000099';
const key = 'milo|2026-10-07|2026-10-12';
const baseReview = {
  hasConflict: true, reasonCode: 'ambiguous_legacy_stay',
  operations: [{ identityStayId: 'bad-id', stayKey: key, identityConflictReason: 'ambiguous_legacy_stay', status: 'checked_out', startDate: '2026-10-07', endDate: '2026-10-12', checkoutType: 'Early checkout', originalEndDate: '2026-10-12', actualCheckoutDate: '2026-10-09' }],
  candidateBookings: [
    { stayId, dogName: 'Milo with a very long name that should wrap cleanly on a narrow screen', dogId, ownerName: 'Alexandria Peterson-Smith with a very long family name', startDate: '2026-10-07', endDate: '2026-10-12', bookingType: 'Confirmed Boarding', sourceOperationStayId: 'bad-id', eligibleOperationOwner: true },
    { stayId: '00000000-0000-4000-8000-000000000002', dogName: 'Milo', dogId: 'Other', ownerName: 'Alexandria Peterson-Smith with a very long family name', startDate: '2026-10-07', endDate: '2026-10-12', bookingType: 'Confirmed Boarding', sourceOperationStayKey: key, eligibleOperationOwner: false }
  ], truncated: { operations: false, candidateBookings: false }, target: { stayId, stayKey: key }
};

async function setup(page, response = { result: 'success', review: baseReview }) {
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <main><article class="directory-card" data-directory-stay-key="${key}" data-directory-stay-id="${stayId}"><section class="v110-operation-bar" data-v110-operation-bar data-state="collision"><div class="v110-operation-state"><strong>Stay changes paused</strong><span>Conflicting stay records need review.</span></div><div class="v110-operation-actions"></div></section><p>Saved profile and belongings stay visible.</p></article><button id="outside">Outside action</button></main>`);
  await page.addStyleTag({ content: fs.readFileSync(path.resolve(__dirname, '../waffle-app.css'), 'utf8') });
  await page.addStyleTag({ content: fs.readFileSync(path.resolve(__dirname, '../waffle-v10.8.css'), 'utf8') });
  await page.addStyleTag({ content: fs.readFileSync(path.resolve(__dirname, '../care-operation-review.css'), 'utf8') });
  await page.evaluate(({ responseValue, stayIdValue, keyValue }) => {
    let next = responseValue, pendingResolve = null;
    window.fixtureStayId = stayIdValue; window.fixtureStayKey = keyValue;
    window.v110ReviewEvidenceForStay = card => card?.dataset?.directoryStayId ? { stayId: card.dataset.directoryStayId, stayKey: card.dataset.directoryStayKey, reasonCode: 'ambiguous_legacy_stay' } : null;
    window.v110EnsureCareOperationBar = () => {};
    window.reviewFixture = {
      calls: [], setResponse(value) { next = value; },
      request() { return next; },
      pending() { next = new Promise(resolve => { pendingResolve = resolve; }); },
      resolve(value) { pendingResolve?.(value); }
    };
    window.queryAppsScript = (payload, options) => { window.reviewFixture.calls.push({ payload, options }); return window.reviewFixture.request(payload); };
  }, { responseValue: response, stayIdValue: stayId, keyValue: key });
  await page.addScriptTag({ path: script });
  await page.locator('[data-care-operation-review]').waitFor();
}

test('healthy card has no review filler; conflicted stay loads candidates only on request and closes to focus', async ({ page }, testInfo) => {
  await setup(page);
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    window.WAFFLE_CARE_OPERATION_REVIEW.updateCard(card);
    card.dataset.directoryStayId = '';
    card.dataset.healthy = 'true';
    window.v110ReviewEvidenceForStay = card => card.dataset.healthy ? null : { stayId: window.fixtureStayId, stayKey: card.dataset.directoryStayKey, reasonCode: 'ambiguous_legacy_stay' };
    window.WAFFLE_CARE_OPERATION_REVIEW.updateCard(card);
    card.dataset.healthy = '';
    card.dataset.directoryStayId = window.fixtureStayId;
    window.WAFFLE_CARE_OPERATION_REVIEW.updateCard(card);
  });
  const trigger = page.locator('[data-care-operation-review]');
  await expect(trigger).toHaveCount(1);
  expect(await page.evaluate(() => window.reviewFixture.calls.length)).toBe(0);
  await trigger.focus(); await trigger.click();
  const modal = page.locator('#careOperationReviewModal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('An older operation record matches more than one stay.');
  await expect(modal).toContainText('Checked out');
  await expect(modal).not.toContainText('checked_out');
  await expect(modal).toContainText('Original end: 2026-10-12');
  await expect(modal).toContainText('Actual checkout: 2026-10-09');
  await expect(modal).toContainText('Confirmed Boarding');
  await expect(modal).toContainText('Eligible operation owner: No');
  await expect(modal).toContainText(dogId);
  await expect(modal).not.toContainText('Dog ID Other');
  expect(await page.evaluate(() => window.reviewFixture.calls.length)).toBe(1);
  expect(await page.evaluate(() => window.reviewFixture.calls[0].payload)).toEqual({ action: 'get_stay_operation_review', stayKey: key, stayId });
  const metrics = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, footerBottom: document.querySelector('.care-operation-review-footer').getBoundingClientRect().bottom, height: innerHeight }));
  console.log(`CARE_OPERATION_REVIEW_LAYOUT ${JSON.stringify(metrics)}`);
  if (metrics.viewport <= 320) {
    await page.screenshot({ path: testInfo.outputPath('care-operation-review-320-light.png'), fullPage: false });
    await page.evaluate(() => document.body.classList.add('dark-theme'));
    await page.screenshot({ path: testInfo.outputPath('care-operation-review-320-dark.png'), fullPage: false });
  }
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.footerBottom).toBeLessThanOrEqual(metrics.height);
  expect(await page.locator('.directory-card').innerText()).toContain('Saved profile and belongings');
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('offline, request failure, retry and explicit no-conflict states do not claim resolution', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }));
  await page.locator('[data-care-operation-review]').click();
  const modal = page.locator('#careOperationReviewModal');
  await expect(modal).toContainText('You’re offline');
  expect(await modal.locator('.care-operation-review-card').evaluate(card => card.getBoundingClientRect().height)).toBeLessThan(450);
  expect(await page.evaluate(() => window.reviewFixture.calls.length)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    window.reviewFixture.setResponse(Promise.reject(new Error('network failed')));
  });
  await page.locator('[data-care-review-retry]').click();
  await expect(modal).toContainText('Stay records could not be loaded');
  await page.evaluate(() => window.reviewFixture.setResponse({ result: 'success', review: { hasConflict: false, reasonCode: null, operations: [], candidateBookings: [], truncated: {}, target: { stayId: window.fixtureStayId, stayKey: window.fixtureStayKey } } }));
  await page.locator('[data-care-review-retry]').click();
  await expect(modal).toContainText('No matching conflict found');
  await expect(modal).toContainText('The stay remains paused');
  expect(await modal.locator('.care-operation-review-card').evaluate(card => card.getBoundingClientRect().height)).toBeLessThan(450);
  expect(await modal.innerText()).not.toMatch(/resolved|fixed|cleared/i);
});

test('rejects a mismatched response selection and ignores a late read after close', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.reviewFixture.setResponse({ result: 'success', review: { hasConflict: true, reasonCode: 'missing_booking', operations: [], candidateBookings: [], truncated: {}, target: { stayId: window.fixtureStayId, stayKey: 'another-dog|2026-09-17|2026-09-22' } } }));
  await page.locator('[data-care-operation-review]').click();
  const modal = page.locator('#careOperationReviewModal');
  await expect(modal).toContainText('Stay selection changed');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.reviewFixture.pending(); });
  await page.locator('[data-care-operation-review]').click();
  await expect(modal).toContainText('Loading stay records');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.reviewFixture.resolve({ result: 'success', review: { hasConflict: true, reasonCode: 'missing_booking', operations: [], candidateBookings: [], truncated: {}, target: { stayId: window.fixtureStayId, stayKey: window.fixtureStayKey } } }));
  await expect(modal).toBeHidden();
  await page.locator('#outside').focus();
  expect(await modal.innerText()).toContain('Loading stay records');
});

test('marks an explicitly cached response as possibly out of date', async ({ page }) => {
  await setup(page, { result: 'success', offlineFallback: true, review: baseReview });
  await page.locator('[data-care-operation-review]').click();
  await expect(page.locator('#careOperationReviewModal')).toContainText('Showing saved review data; it may be out of date.');
});

test('cached no-conflict result is stale and cannot imply the stay was cleared', async ({ page }) => {
  await setup(page, { result: 'success', offlineFallback: true, review: { hasConflict: false, reasonCode: null, operations: [], candidateBookings: [], truncated: {}, target: { stayId, stayKey: key } } });
  await page.locator('[data-care-operation-review]').click();
  const modal = page.locator('#careOperationReviewModal');
  await expect(modal).toContainText('Saved review found no matching conflict');
  await expect(modal).toContainText('This saved result may be out of date. The stay remains paused');
  await expect(modal).not.toContainText('live review found no matching conflict');
  expect(await modal.innerText()).not.toMatch(/resolved|fixed|cleared/i);
});

test('malformed Stay ID is omitted and the exact selected stay key scopes the read', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const card = document.querySelector('.directory-card');
    card.dataset.directoryStayId = 'malformed';
    window.v110ReviewEvidenceForStay = selected => ({ stayId: selected.dataset.directoryStayId, stayKey: selected.dataset.directoryStayKey, reasonCode: 'invalid_stay_id' });
    window.WAFFLE_CARE_OPERATION_REVIEW.updateCard(card);
  });
  await page.locator('[data-care-operation-review]').click();
  await expect(page.locator('#careOperationReviewModal')).toContainText('An operation record has a malformed Stay ID.');
  expect(await page.evaluate(() => window.reviewFixture.calls[0].payload)).toEqual({ action: 'get_stay_operation_review', stayKey: key });
});

test('real Care directory boot surfaces quarantine evidence but calls bounded review only after activation', async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Full application boot is covered in desktop Chromium; interaction edge cases run on all three browser targets.');
  await page.clock.install({ time: new Date('2026-10-08T12:00:00Z') });
  const calls = [];
  const booking = { timestamp: '2026-10-07', dogName: 'Milo', breed: 'Border Collie', startDate: '2026-10-07', endDate: '2026-10-12', ownerName: 'Alexandria Peterson-Smith', phone: '0400000000', notes: 'Preserve the existing profile.', bookingType: 'Boarding' };
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Read-only review blocked mutation' });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      const csv = 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type\n' + [booking.timestamp, booking.dogName, booking.breed, '07/10/2026', '12/10/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', booking.bookingType].join(',');
      return route.fulfill({ status: 200, contentType: 'text/csv', body: csv });
    }
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: 'Unapproved fixture action' });
      const params = new URL(url).searchParams;
      let payload = {}; try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      const action = resolved.action; calls.push(action);
      const callback = params.get('callback');
      let response = { result: 'success', records: [] };
      if (action === 'get_guest_directory') response = { result: 'success', bookings: [booking] };
      if (action === 'get_stay_operations') response = { result: 'success', records: [{ stayKey: key, identityStayId: 'bad-id', identityConflict: true, identityConflictReason: 'ambiguous_legacy_stay' }] };
      if (action === 'get_guest_profile') response = { result: 'success', record: { stayKey: key, intakeAttributes: { notes: booking.notes }, notes: booking.notes } };
      if (action === 'get_stay_operation_review') response = { result: 'success', review: { ...baseReview, target: { stayId: '', stayKey: key } } };
      const body = callback ? `${callback}(${JSON.stringify(response)});` : JSON.stringify(response);
      return route.fulfill({ status: 200, contentType: callback ? 'application/javascript' : 'application/json', body });
    }
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.resolve(__dirname, 'fixtures/fullcalendar.global.min.js'), 'utf8') });
    if (/^https?:/.test(url) && !url.includes('127.0.0.1')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>' });
    return route.continue();
  });
  await page.goto(`${baseURL}/directory.html?careOperationReview=boot`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true', null, { timeout: 45000 });
  await expect(page.locator('[data-open-directory-profile]')).toHaveCount(1, { timeout: 45000 });
  await expect.poll(() => calls.includes('get_stay_operations'), { timeout: 30000 }).toBeTruthy();
  expect(calls).not.toContain('get_stay_operation_review');
  await page.locator('[data-open-directory-profile]').click();
  await expect(page.locator('.directory-card.is-profile-active [data-care-operation-review]')).toHaveCount(1, { timeout: 15000 });
  expect(calls).not.toContain('get_stay_operation_review');
  await page.locator('.directory-card.is-profile-active [data-care-operation-review]').click();
  await expect(page.locator('#careOperationReviewModal')).toContainText('Candidate bookings');
  expect(calls.filter(action => action === 'get_stay_operation_review')).toHaveLength(1);
  expect(calls.every(action => !/^(checkin_stay|checkout_stay|early_checkout_stay|save_guest_profile)$/.test(String(action || '')))).toBeTruthy();
});
