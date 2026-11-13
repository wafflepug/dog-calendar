const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fs = require('node:fs');
const path = require('node:path');
const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');

const booking = {
  timestamp: '2026-10-01', dogName: 'Milo Longtail', breed: 'Border Collie',
  startDate: '2026-10-02', endDate: '2026-10-06', ownerName: 'Alex Owner', phone: '+61 400 111 222',
  notes: 'First line of handover\n'.concat('Important detail '.repeat(30)), bookingType: 'Boarding',
  dogId: '11111111-1111-4111-8111-111111111111', stayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  dogNumber: '#00017', stayKey: 'milo longtail|2026-10-02|2026-10-06', operationalStatus: 'checked_out', checkoutDate: '2026-10-05'
};

async function fixture(page) {
  const reads = [];
  await page.route('**/*', async route => {
    const req = route.request(), url = req.url();
    if (!['GET', 'HEAD'].includes(req.method())) return route.fulfill({ status: 405, body: 'Read-only fixture' });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      // The current-booking CSV is empty; this historical stay exists only in the Past response.
      // Mirroring it here races the startup current-to-past migration with the opened fixture card.
      return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n' });
    }
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendar });
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: req.method(), url });
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: 'Read-only fixture' });
      const query = new URL(url).searchParams, callback = query.get('callback'), payload = JSON.parse(query.get('payload') || '{}');
      reads.push(resolved.action);
      let response = { result: 'success', bookings: [], records: [], summaries: [] };
      if (resolved.action === 'get_guest_directory') response = { result: 'success', bookings: [], summaries: [] };
      if (resolved.action === 'get_past_guest_directory') response = { result: 'success', bookings: [booking], totalPastStays: 1 };
      if (resolved.action === 'get_guest_profile') response = { result: 'success', record: { stayKey: payload.stayKey || booking.stayKey, identity: { stayKey: payload.stayKey || booking.stayKey, stayId: booking.stayId, dogId: booking.dogId }, resolution: { status: 'resolved', method: 'fixture' }, intakeAttributes: {} } };
      if (resolved.action === 'get_guest_belongings') response = { result: 'success', record: { stayKey: payload.stayKey || booking.stayKey, identityResolution: { status: 'resolved', identity: { stayKey: payload.stayKey || booking.stayKey, stayId: booking.stayId, dogId: booking.dogId } }, dogPhotoGallery: [], stayPhotos: [], photos: [] } };
      const body = callback ? `${callback}(${JSON.stringify(response)});` : JSON.stringify(response);
      return route.fulfill({ status: 200, contentType: 'application/javascript', body });
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') return route.fulfill({ status: 200, contentType: req.resourceType() === 'script' ? 'application/javascript' : 'text/css', body: '' });
    return route.continue();
  });
  return reads;
}

test.describe('compact past contact and records', () => {
  for (const width of [320, 390, 1440]) test(`keeps owner contact and handover clear at ${width}px`, async ({ page, baseURL }) => {
    test.skip(!baseURL, 'Requires the local read-only directory fixture server.');
    const reads = await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${baseURL}/directory.html?careCompactPastFixture=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    // Asset readiness precedes the initial roster response, which can restore selection.
    await page.waitForFunction(() => directoryConsolidatedLastFetch > 0 && !directoryConsolidatedLoadInProgress);
    await page.locator('[data-v1082-stay-tab="past"]').click();
    await page.waitForFunction(() => v1082PastLoaded && !v1082PastLoadPromise);
    const tile = page.locator('#past-directory-grid [data-v1082-past-stay="true"] [data-open-directory-profile]');
    await expect(tile).toBeVisible();
    await tile.click();
    const card = page.locator('#directoryTabPanel .directory-card[data-v1082-past-stay="true"].is-profile-active');
    await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true');
    const pastReads = reads.filter(action => action === 'get_past_guest_directory').length;
    await card.evaluate(el => {
      window.compactPastOpenedCard = el;
      // Exercise the delayed count task after the user's manual load has completed.
      v1086BackgroundPastRequested = false;
      v1086BackgroundLoadPastStays();
    });
    const sections = card.locator('[data-care-profile-segments]');
    await expect(sections.getByRole('button')).toHaveText(['Overview', 'Activity', 'Records', 'Tools']);
    await expect(card.locator('[data-care-brief-owner-name]')).toHaveText('Alex Owner');
    await expect(card.locator('a[href="tel:+61400111222"]').first()).toBeVisible();
    await expect(card.locator('[data-care-brief-handover-note]')).toContainText('First line of handover');
    await expect(card.locator('.v1082-past-status')).toHaveText('Checked out');
    await expect(card.locator('.v1082-past-checkout-date')).toHaveText('Checked out 5 Oct');
    await expect(card.locator('[data-care-photo-options] > summary')).toBeVisible();
    await expect(card.locator('[data-v110-operation-bar]')).toHaveCount(0);
    await expect(card.locator('.v11160-desktop-tabs')).toBeHidden();
    await expect(card.locator('[data-care-brief-action="edit-routine"]')).toBeHidden();

    if (process.env.PALZ_PAST_SCREENSHOTS) {
      await page.screenshot({ path: path.join(process.env.PALZ_PAST_SCREENSHOTS, `after-${width}.png`) });
    }
    await sections.getByRole('button', { name: 'Records' }).click();
    const records = card.locator('[data-v1082-past-records]');
    await expect(records).toBeVisible();
    await expect(records).toHaveAttribute('open', '');
    await expect(records.locator('[data-directory-intake]')).toBeVisible();
    await expect(records.locator('[data-directory-legacy]')).toBeVisible();
    await expect(records.locator('[data-create-intake-link]')).toBeHidden();

    await sections.getByRole('button', { name: 'Tools' }).click();
    await expect(card.locator('[data-v11160-tab="history"]')).toBeVisible();
    await expect(card.locator('[data-directory-detail="profile"]')).toBeVisible();
    await expect(card.locator('[data-save-belongings]').first()).toBeHidden();
    await sections.getByRole('button', { name: 'Activity' }).click();
    await expect(card.locator('[data-care-routine-log]')).toBeVisible();
    await expect(card.locator('[data-care-routine-form]')).toBeHidden();
    expect(reads.filter(action => action === 'get_past_guest_directory')).toHaveLength(pastReads);
    expect(await card.evaluate(el => el === window.compactPastOpenedCard)).toBe(true);
  });

  test('does not invent an owner or phone when fields are absent', async ({ page, baseURL }) => {
    await page.setContent('<div id="host"></div>');
    await page.evaluate(() => {
      window.escapeDashboardHtml = value => String(value);
      window.formatStayDateShort = () => '1 Jan';
      window.getLocalTodayDateString = () => '2026-10-10';
      window.directoryProfileAccessibleLabel = () => 'Open Guest profile';
      window.formatWaffleContactPhone = value => value;
    });
    const app = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
    await page.addScriptTag({ content: app.slice(app.indexOf('    function renderDirectoryStayCardMarkup('), app.indexOf('    function parseCSVToEvents(')) });
    await page.addScriptTag({ url: `${baseURL}/waffle-v10.8.2.js` });
    await page.evaluate(() => { document.querySelector('#host').innerHTML = v1082PastCardHtml({ stayKey: 'unknown', dogName: 'Guest', phone: 'unknown' }); });
    await expect(page.locator('[data-care-brief-owner-name]')).toHaveText('Not provided');
    await expect(page.locator('[data-care-brief-call-owner] a')).toHaveCount(0);
    await page.evaluate(() => {
      const card = document.querySelector('.v1082-past-card');
      card.querySelector('[data-directory-care]').textContent = '2 saved safety alerts';
      card.querySelector('[data-directory-intake]').textContent = 'Digital Intake complete';
      card.querySelector('[data-directory-legacy]').textContent = 'Legacy record retry unavailable';
      v1082ApplyPastReadOnly(card);
    });
    await expect(page.locator('[data-v1082-records-status]')).toContainText('Digital intake saved');
    await expect(page.locator('[data-v1082-records-status]')).toContainText('Legacy record unavailable');
    await expect(page.locator('[data-directory-care]')).toContainText('2 saved safety alerts');
    await expect(page.locator('[data-directory-detail="profile"]')).toBeVisible();
    await expect(page.locator('[data-v1082-past-records]')).not.toHaveAttribute('open', '');
    await page.evaluate(() => {
      const card = document.querySelector('.v1082-past-card');
      card.querySelector('[data-directory-legacy]').classList.remove('has-document');
      card.querySelector('[data-directory-legacy]').textContent = 'No legacy PDF on file';
      v1082ApplyPastReadOnly(card);
    });
    await expect(page.locator('[data-v1082-records-status]')).toContainText('No legacy record');
    await page.evaluate(() => {
      const card = document.querySelector('.v1082-past-card');
      card.querySelector('[data-directory-legacy]').textContent = 'Status could not be determined';
      card.querySelector('[data-directory-intake]').textContent = 'Status could not be determined';
      v1082ApplyPastReadOnly(card);
    });
    await expect(page.locator('[data-v1082-records-status]')).toContainText('Legacy status unknown');
    await expect(page.locator('[data-v1082-records-status]')).toContainText('Digital intake status unknown');
    await page.evaluate(() => {
      const card = document.querySelector('.v1082-past-card');
      const strip = card.querySelector('[data-directory-legacy]');
      strip.classList.add('has-document'); strip.textContent = 'PDF available. OCR failed; retry processing.';
      v1082ApplyPastReadOnly(card);
    });
    await expect(page.locator('[data-v1082-records-status]')).toContainText('Legacy PDF saved · details unavailable');
    await page.evaluate(() => {
      const card = document.querySelector('.v1082-past-card');
      card.querySelector('[data-directory-legacy]').textContent = 'PDF available. Processing pending.';
      v1082ApplyPastReadOnly(card);
    });
    await expect(page.locator('[data-v1082-records-status]')).toContainText('Legacy PDF saved · processing pending');
    const mutations = await page.evaluate(async () => {
      const card = document.querySelector('.v1082-past-card');
      let count = 0;
      const observer = new MutationObserver(rows => { count += rows.length; });
      observer.observe(card.querySelector('[data-v1082-records-status]'), { childList: true, subtree: true });
      v1082ApplyPastReadOnly(card); v1082ApplyPastReadOnly(card);
      await Promise.resolve(); observer.disconnect(); return count;
    });
    expect(mutations).toBe(0);
  });

  test('reapplying the same past record identity cannot reopen a native close before toggle sync', async ({ page }) => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'waffle-v10.8.2.js'), 'utf8');
    const start = source.indexOf('function v1082ApplyPastReadOnly(card)');
    const end = source.indexOf('function v1082ApplyPastResponse(', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    await page.setContent('<article class="directory-card" data-v1082-past-stay="true" data-directory-stay-key="stay"><details data-v1082-past-records><summary>Records &amp; forms</summary><div data-v1082-records-status></div><div data-directory-intake></div><div data-directory-legacy></div></details></article>');
    await page.addScriptTag({ content: `const v1082PastRecordsDisclosure = new Map();\n${source.slice(start, end)}\nwindow.__pastDisclosureMap = () => v1082PastRecordsDisclosure;` });
    await page.evaluate(() => {
      const card = document.querySelector('.directory-card');
      const details = card.querySelector('[data-v1082-past-records]');
      v1082ApplyPastReadOnly(card);
      window.__pastDisclosureMap().set(details.dataset.recordsIdentity, true);
      details.open = true;
    });
    await page.waitForFunction(() => window.__pastDisclosureMap().get('::::stay') === true);

    const remainedClosed = await page.evaluate(() => {
      const card = document.querySelector('.directory-card');
      const details = card.querySelector('[data-v1082-past-records]');
      details.open = false;
      v1082ApplyPastReadOnly(card);
      return !details.open;
    });
    expect(remainedClosed).toBe(true);
    await page.waitForFunction(() => window.__pastDisclosureMap().get('::::stay') === false);

    const identityStates = await page.evaluate(() => {
      const card = document.querySelector('.directory-card');
      const details = card.querySelector('[data-v1082-past-records]');
      card.dataset.directoryStayKey = 'new';
      v1082ApplyPastReadOnly(card);
      const unseenIdentityClosed = !details.open;
      card.dataset.directoryStayKey = 'saved';
      window.__pastDisclosureMap().set('::::saved', true);
      v1082ApplyPastReadOnly(card);
      return { unseenIdentityClosed, savedIdentityRestored: details.open };
    });
    expect(identityStates).toEqual({ unseenIdentityClosed: true, savedIdentityRestored: true });
  });
});
