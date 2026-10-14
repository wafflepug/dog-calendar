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
  dogNumber: '#00017', stayKey: 'milo longtail|2026-10-02|2026-10-06', operationalStatus: 'checked_out'
};

async function fixture(page) {
  const reads = [];
  await page.route('**/*', async route => {
    const req = route.request(), url = req.url();
    if (!['GET', 'HEAD'].includes(req.method())) return route.fulfill({ status: 405, body: 'Read-only fixture' });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      const row = [booking.timestamp, booking.dogName, booking.breed, '02/10/2026', '06/10/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', 'Boarding', 'Other', booking.dogId, booking.stayId, booking.dogNumber];
      const csv = value => `"${String(value || '').replace(/"/g, '""')}"`;
      return route.fulfill({ status: 200, contentType: 'text/csv', body: `Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n${row.map(csv).join(',')}` });
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
    await page.locator('[data-v1082-stay-tab="past"]').click();
    const tile = page.locator('#past-directory-grid [data-v1082-past-stay="true"] [data-open-directory-profile]');
    await expect(tile).toBeVisible();
    await tile.click();
    const card = page.locator('#directoryTabPanel .directory-card[data-v1082-past-stay="true"].is-profile-active');
    await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true');
    await expect(card.locator('[data-v1082-past-owner]')).toHaveText('Alex Owner');
    const call = card.locator('[data-v1082-past-phone]');
    await expect(call).toHaveAttribute('href', 'tel:+61400111222');
    await expect(call).toContainText('+61 400 111 222');
    await expect(call).toHaveAttribute('aria-label', /Call owner Alex Owner/);
    const note = card.locator('.v1082-past-notes');
    const noteDisclosure = card.locator('.v1082-past-note-details');
    await expect(noteDisclosure).toBeVisible();
    await expect(noteDisclosure.locator('summary')).toContainText('Handover note');
    await expect(noteDisclosure).not.toHaveAttribute('open', '');
    await noteDisclosure.locator('summary').click();
    await expect(note).toContainText('First line of handover');
    expect(await note.evaluate(el => getComputedStyle(el).whiteSpace)).toMatch(/normal|pre-wrap|pre-line/);

    const records = card.locator('[data-v1082-past-records]');
    await expect(records).toBeVisible();
    await expect(records).not.toHaveAttribute('open', '');
    await expect(records.locator('summary')).toContainText('Records & forms');
    await expect(records.locator('[data-v1082-records-status]')).toHaveText(/^(No digital intake|Digital intake status unknown) · (No legacy record|Legacy status unknown)$/);
    await expect(card.locator('[data-directory-care]')).toBeVisible();
    await expect(card.locator('[data-directory-care]')).not.toBeEmpty();
    await expect(records.locator('[data-directory-care]')).toHaveCount(0);
    await expect(card.locator('[data-directory-detail="profile"]')).toBeVisible();
    await expect(card.locator('[data-directory-intake]')).toBeAttached();
    await expect(card.locator('[data-directory-legacy]')).toBeAttached();
    const detailReads = () => reads.filter(action => ['get_guest_profile', 'get_guest_belongings', 'get_dog_history', 'get_dog_master_profile'].includes(action));
    const before = detailReads().length;
    await records.locator('summary').click();
    await expect(records).toHaveAttribute('open', '');
    expect(detailReads()).toHaveLength(before);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(records.locator('summary')).toBeVisible();
    await page.emulateMedia({ colorScheme: 'light' });
    await records.locator('summary').click();
    await expect(records).not.toHaveAttribute('open', '');
  });

  test('does not invent an owner or phone when fields are absent', async ({ page, baseURL }) => {
    await page.setContent('<div id="host"></div>');
    await page.evaluate(() => { window.escapeDashboardHtml = value => String(value); window.formatStayDateShort = () => '1 Jan'; });
    await page.addScriptTag({ url: `${baseURL}/waffle-v10.8.2.js` });
    await page.evaluate(() => { document.querySelector('#host').innerHTML = v1082PastCardHtml({ stayKey: 'unknown', dogName: 'Guest', phone: 'unknown' }); });
    await expect(page.locator('[data-v1082-past-owner]')).toHaveText('Not recorded');
    await expect(page.locator('[data-v1082-past-phone]')).toHaveText('unknown');
    await expect(page.locator('[data-v1082-past-phone]')).not.toHaveAttribute('href');
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
});
