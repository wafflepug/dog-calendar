const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fs = require('node:fs');
const path = require('node:path');

const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const booking = {
  timestamp: '2026-09-18', dogName: 'A very long dog name that wraps cleanly', breed: 'Border Collie',
  startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Alexandria Peterson-Smith', phone: '0400123456', notes: 'Safety warning remains visible.', bookingType: 'Boarding'
};

function installReadOnlyFixture(page) {
  return page.route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Read-only fixture blocked mutation' });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type\n' + [booking.timestamp, booking.dogName, booking.breed, '17/09/2026', '22/09/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', booking.bookingType].join(',') });
    }
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendar });
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: 'Read-only fixture blocked backend action' });
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {};
      try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      const action = resolved.action;
      let response = { result: 'success', records: [] };
      const stayKey = `${booking.dogName.toLowerCase()}|2026-09-17|2026-09-22`;
      if (action === 'get_guest_directory') response = { result: 'success', bookings: [booking], summaries: [{ stayKey, riskFlags: { foodAllergy: true } }] };
      if (action === 'get_guest_profile') response = { result: 'success', record: { stayKey: payload.stayKey || stayKey, intakeAttributes: { medicationInstructions: 'Safety warning: monitor appetite.' }, riskFlags: { foodAllergy: true } } };
      if (callback) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    }
    if (/^https?:/.test(url) && !url.includes('127.0.0.1:4177')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#ddd"/></svg>' });
    return route.continue();
  });
}

for (const [name, viewport, colorScheme] of [['390-light', { width: 390, height: 844 }, 'light'], ['390-dark', { width: 390, height: 844 }, 'dark'], ['1440-light', { width: 1440, height: 900 }, 'light']]) {
  test(`selected profile hierarchy ${name}`, async ({ page, baseURL }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme });
    await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
    await page.addInitScript(mode => localStorage.setItem('theme', mode), colorScheme);
    await installReadOnlyFixture(page);
    await page.goto(`${baseURL}/directory.html?mobileHierarchy=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    await expect.poll(() => page.locator('.directory-card[data-directory-stay-key]').count()).toBe(1);
    await page.locator('[data-open-directory-profile]').evaluate(button => button.click());
    await expect.poll(() => page.locator('.directory-card.is-profile-active').count()).toBe(1);
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode .directory-dashboard-header > div:first-child')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode .v1082-stay-tabs')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode .guest-directory-toolbar')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode #v11190ScanIntakePdfBtn')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode #v11190PdfOcrReviewNote')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode #directory-care-summary')).toBeVisible();
    await expect(page.locator('#directoryProfileBackBar')).toBeVisible();
    await expect(page.locator('.directory-card.is-profile-active .directory-dog-name-btn')).toContainText('very long dog name');
    await expect(page.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true');
    await page.locator('.directory-card.is-profile-active [data-profile-subtab="care"]').click();
    await expect(page.locator('.directory-card.is-profile-active [data-intake-attribute="medicationInstructions"]')).toHaveValue('Safety warning: monitor appetite.');
    await expect(page.locator('.directory-card.is-profile-active [data-directory-profile-care]')).toBeVisible();
    await expect(page.locator('.directory-card.is-profile-active [data-care-risk-flag="foodAllergy"]')).toBeChecked();
    await page.locator('#directoryBackToGuestsBtn').focus();
    await expect(page.locator('#directoryBackToGuestsBtn')).toBeFocused();
    await page.locator('#directoryBackToGuestsBtn').click();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode')).toHaveCount(0);
    await expect(page.locator('.directory-dashboard-header')).toBeVisible();
    await expect(page.locator('#refreshGuestDirectoryBtn')).toBeVisible();
    await expect(page.getByRole('button', { name: /Scan Intake PDF/i })).toBeVisible();
    await expect(page.locator('#v11190PdfOcrReviewNote')).toBeVisible();
    await expect(page.locator('#directory-care-summary')).toBeVisible();
  });
}
