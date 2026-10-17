const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const calendar = fs.readFileSync(path.join(__dirname, 'fixtures/fullcalendar.global.min.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const booking = { timestamp: '2026-10-16', dogName: 'Milo', breed: 'Collie', startDate: '2026-10-17', endDate: '2026-10-20', ownerName: 'Casey', phone: '0400000000', notes: 'Call before pickup.', bookingType: 'Boarding', dogId: '11111111-1111-4111-8111-111111111111', stayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', dogNumber: '#00017', stayKey: 'milo|2026-10-17|2026-10-20' };
const record = { stayKey: booking.stayKey, identity: { stayKey: booking.stayKey, stayId: booking.stayId, dogId: booking.dogId }, resolution: { status: 'resolved', method: 'fixture' }, updatedAt: '2026-10-16T08:00:00Z', intakeAttributesSource: 'Saved profile', intakeAttributes: { feedingTimes: '8am and 6pm', foodAmount: '1 cup', foodBrandType: 'Sensitive formula', walksPerDay: '2 walks', walkDuration: '20 minutes', medicationInstructions: 'Give the saved medication with dinner. Call the owner if appetite changes.' }, riskFlags: { foodAllergy: true } };

async function fixture(page) {
  const reads = [];
  await page.addInitScript(() => {
    const NativeDate = Date, now = NativeDate.UTC(2026, 9, 17, 12);
    function FixedDate(...args) { if (!new.target) return new NativeDate(now).toString(); return Reflect.construct(NativeDate, args.length ? args : [now], new.target); }
    FixedDate.prototype = NativeDate.prototype; Object.setPrototypeOf(FixedDate, NativeDate); FixedDate.now = () => now; globalThis.Date = FixedDate;
  });
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Synthetic fixture blocks all writes' });
    if (url.includes('/waffle-app.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: app.replace('function renderDirectoryIntakeAttributes(', 'window.__renderCondensedIntake = renderDirectoryIntakeAttributes;\n    function renderDirectoryIntakeAttributes(') });
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: calendar });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n' + [booking.timestamp, booking.dogName, booking.breed, '17/10/2026', '20/10/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', 'Boarding', 'Other', booking.dogId, booking.stayId, booking.dogNumber].join(',') });
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: 'Unapproved backend request' });
      const params = new URL(url).searchParams, callback = params.get('callback');
      reads.push(resolved.action);
      let response = { result: 'success', records: [], bookings: [], summaries: [] };
      if (resolved.action === 'get_guest_directory') response = { result: 'success', bookings: [booking], summaries: [{ stayKey: booking.stayKey, riskFlags: record.riskFlags }], digitalIntakes: [], legacyIntakes: [] };
      if (resolved.action === 'get_guest_profile') response = { result: 'success', record };
      if (resolved.action === 'get_guest_belongings') response = { result: 'success', record: { stayKey: booking.stayKey, items: {}, photos: [] } };
      if (resolved.action === 'maintenance_status') response = { result: 'success', enabled: false };
      return route.fulfill({ status: 200, contentType: callback ? 'application/javascript' : 'application/json', body: callback ? `${callback}(${JSON.stringify(response)});` : JSON.stringify(response) });
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') {
      const type = request.resourceType();
      return route.fulfill({ status: 200, contentType: type === 'script' ? 'application/javascript' : type === 'stylesheet' ? 'text/css' : 'image/svg+xml', body: type === 'script' || type === 'stylesheet' ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' });
    }
    return route.continue();
  });
  return reads;
}

test('actual Care profile stays compact, keeps exceptions visible and preserves editable fields without extra reads', async ({ page, baseURL }, testInfo) => {
  const reads = await fixture(page);
  for (const [width, theme] of [[320, 'light'], [390, 'dark'], [1440, 'light']]) {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(mode => localStorage.setItem('theme', mode), theme);
    await page.goto(`${baseURL}/directory.html?condensedCareFixture=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const opener = page.locator('#directory-grid [data-open-directory-profile]');
    await expect(opener).toHaveCount(1);
    const before = reads.filter(x => x === 'get_guest_profile').length;
    await opener.click();
    const card = page.locator('.directory-card.is-profile-active');
    await expect(card).toHaveCount(1);
    await expect(card.locator('[data-care-brief-medication]')).toHaveText(record.intakeAttributes.medicationInstructions);
    await expect(card.locator('[data-care-brief-safety]')).toContainText('Food Allergy');
    await expect(card.locator('.directory-card-header')).toHaveCount(1);
    await expect(card.locator('.directory-card-header .directory-photo-shell')).toHaveCount(1);
    await expect(card.locator('[data-v110-checkin]')).toBeVisible();
    await expect(page.locator('#wh75SettingsPanel')).not.toHaveClass(/is-open/);
    const early = card.locator('[data-v110-operation-bar] [data-v11217-early-checkout]');
    await expect(early).toBeHidden();
    await card.locator('.v11217-profile-more-actions > summary').click();
    await expect(page.locator('#wh75SettingsPanel')).not.toHaveClass(/is-open/);
    await expect(early).toBeVisible();
    await card.locator('.v11217-profile-more-actions > summary').click();
    await expect(page.locator('#wh75SettingsPanel')).not.toHaveClass(/is-open/);
    const afterOpen = reads.filter(x => x === 'get_guest_profile').length;
    expect(afterOpen - before).toBeLessThanOrEqual(1);
    await expect(card.locator('[data-care-brief-feeding]')).toContainText('1 cup');
    await expect(card.locator('[data-care-brief-walks]')).toContainText('2 walks');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`care-opening-${width}-${theme}.png`) });

    await card.locator('[data-care-brief-action="full-profile"]').click();
    const toggle = card.locator('[data-profile-subtab="foodWalks"]');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await expect(card.locator('[data-intake-read-attribute="foodAmount"]')).toContainText('1 cup');
    await expect(card.locator('[data-intake-attribute="foodAmount"]')).toBeHidden();
    await card.locator('.directory-care-more-actions > summary').click();
    await card.locator('[data-care-brief-action="edit"]').click();
    await expect(card).toHaveClass(/is-profile-editing/);
    const amount = card.locator('[data-intake-attribute="foodAmount"]');
    await expect(amount).toBeVisible();
    await amount.fill('2 cups draft');
    await amount.focus();
    await page.evaluate(data => window.__renderCondensedIntake(document.querySelector('.directory-card.is-profile-active'), data), record);
    await expect(amount).toHaveValue('2 cups draft');
    await expect(amount).toBeFocused();
    expect(reads.filter(x => x === 'get_guest_profile')).toHaveLength(afterOpen);
  }
});
