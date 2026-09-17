const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

const FULLCALENDAR = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const BOOKING = { timestamp: '2026-09-18', dogName: 'Fixture Guest', breed: 'Mixed breed', startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Fixture Owner', phone: '0000000000', notes: 'Fixture notes', bookingType: 'Boarding' };
const CSV = `Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type\n${BOOKING.timestamp},${BOOKING.dogName},${BOOKING.breed},17/09/2026,22/09/2026,${BOOKING.ownerName},${BOOKING.phone},,,,${BOOKING.bookingType}`;

async function installFixtures(page, ledger) {
  await page.route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    if (url.includes('fullcalendar@6.1.8/index.global.min.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: FULLCALENDAR });
    if (url.includes('fullcalendar@6.1.8/index.global.min.css')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) return route.fulfill({ status: 200, contentType: 'text/csv', body: CSV });
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      const action = resolved.action || 'unknown';
      const entry = { action, method: request.method(), start: performance.now() };
      ledger.push(entry);
      if (!resolved.policy.allowed || request.method() !== 'GET') return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ result: 'error' }) });
      let body = { result: 'success', records: [] };
      if (action === 'get_guest_directory') body = { result: 'success', bookings: [BOOKING] };
      if (action === 'get_guest_profile') body = { result: 'success', record: { stayKey: 'fixture|2026-09-17|2026-09-22', intakeAttributes: { medicationInstructions: 'Fixture instruction' }, intakeAttributesSource: 'Fixture' } };
      if (action === 'get_data_versions') body = { result: 'success', versions: { bookings: 'fixture', belongings: 'fixture' } };
      const callback = new URL(url).searchParams.get('callback');
      const payload = callback ? `${callback}(${JSON.stringify(body)});` : JSON.stringify(body);
      entry.end = performance.now();
      return route.fulfill({ status: 200, contentType: callback ? 'application/javascript' : 'application/json', body: payload });
    }
    return route.continue();
  });
}

async function runProfile(page, ledger, mode, testInfo) {
  const navStart = await page.evaluate(() => performance.now());
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true', null, { timeout: 30000 });
  await expect.poll(() => page.locator('.directory-card[data-directory-stay-key]').count(), { timeout: 30000 }).toBe(1);
  const card = page.locator('.directory-card[data-directory-stay-key]').first();
  const clickStart = await page.evaluate(() => performance.now());
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  const shellActiveAt = await page.evaluate(() => performance.now());
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true', { timeout: 30000 });
  const detailLoadedAt = await page.evaluate(() => performance.now());
  const backVisibleAt = await page.locator('#directoryBackToGuestsBtn').isVisible()
    ? await page.evaluate(() => performance.now())
    : null;
  const evidence = await page.evaluate(({ mode, navStart, clickStart, ledger }) => ({
    mode, navStart, uiReadyAt: performance.now(), clickStart,
    actionAttempts: ledger.reduce((out, item) => { out[item.action] = (out[item.action] || 0) + 1; return out; }, {}),
    fixtureResponses: ledger.map(item => ({ action: item.action, durationMs: item.end == null ? null : item.end - item.start })),
    cacheStatus: 'unavailable', callbackApplicationTiming: null
  }), { mode, navStart, clickStart, ledger });
  evidence.shellActiveAt = shellActiveAt;
  evidence.detailLoadedAt = detailLoadedAt;
  evidence.backVisibleAt = backVisibleAt;
  await testInfo.attach(`profile-read-${mode}.json`, { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  console.log(`PROFILE_READ_TIMING ${JSON.stringify(evidence)}`);
  return evidence;
}

test('directory profile read cold timing', async ({ page }, testInfo) => {
  const ledger = [];
  await installFixtures(page, ledger);
  await page.goto('http://127.0.0.1:4175/directory.html?timing=cold', { waitUntil: 'domcontentloaded' });
  const evidence = await runProfile(page, ledger, 'cold', testInfo);
  expect(evidence.cacheStatus).toBe('unavailable');
  expect(evidence.actionAttempts.get_guest_directory).toBeGreaterThan(0);
  expect(evidence.actionAttempts.get_guest_profile).toBeGreaterThan(0);
});

test('directory profile read warm reopen timing', async ({ page }, testInfo) => {
  const ledger = [];
  await installFixtures(page, ledger);
  await page.goto('http://127.0.0.1:4175/directory.html?timing=warm', { waitUntil: 'domcontentloaded' });
  await runProfile(page, ledger, 'warm-first', testInfo);
  await page.locator('#directoryBackToGuestsBtn').click();
  await expect(page.locator('.directory-card[data-directory-stay-key]')).toBeVisible();
  const evidence = await runProfile(page, ledger, 'warm-reopen', testInfo);
  expect(evidence.cacheStatus).toBe('unavailable');
  expect(evidence.actionAttempts.get_guest_profile).toBeGreaterThan(1);
});
