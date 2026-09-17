const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fs = require('fs');
const path = require('path');

const fullCalendarBundle = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');

const booking = {
  timestamp: '2026-09-18',
  dogName: 'A very long dog name that must wrap without clipping',
  breed: 'Border Collie',
  startDate: '2026-09-17',
  endDate: '2026-09-22',
  ownerName: 'Alexandria Peterson-Smith with a very long family name',
  phone: '0400123456',
  notes: 'Long care notes wrap here and remain discoverable.',
  bookingType: 'Boarding'
};

function csvFixture() {
  return [
    'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type',
    [booking.timestamp, booking.dogName, booking.breed, '17/09/2026', '22/09/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', booking.bookingType].join(',')
  ].join('\n');
}

async function installReadOnlyFixtures(page) {
  const writes = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    if (request.method() !== 'GET' && request.method() !== 'HEAD') {
      writes.push({ method: request.method(), url });
      return route.fulfill({ status: 405, body: 'Read-only review blocked mutation' });
    }
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      return route.fulfill({ status: 200, contentType: 'text/csv', body: csvFixture() });
    }
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      if (!resolved.policy.allowed) {
        writes.push({ method: request.method(), url, action: resolved.action, reason: resolved.policy.reason });
        return route.fulfill({ status: 403, contentType: 'text/plain', body: `Read-only review blocked backend action: ${resolved.policy.reason}` });
      }
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {};
      try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      let response = { result: 'success', records: [] };
      const action = resolved.action;
      if (action === 'maintenance_status') response = { result: 'success', enabled: false };
      if (action === 'get_guest_directory') response = { result: 'success', bookings: [booking] };
      if (action === 'get_guest_profile') response = { result: 'success', record: { stayKey: 'a very long dog name that must wrap without clipping|2026-09-17|2026-09-22', intakeAttributes: { medicationInstructions: 'Give after dinner; call owner if appetite changes.' }, intakeAttributesSource: 'Synthetic saved profile', riskFlags: { foodAllergy: true } } };
      if (action === 'get_data_versions') response = { result: 'success', versions: { bookings: 'runtime-review', belongings: 'runtime-review' } };
      if (callback) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    }
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendarBundle });
    if (/^https?:/.test(url) && !url.includes('127.0.0.1:4175')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#ddd"/></svg>' });
    return route.continue();
  });
  return writes;
}

for (const [name, viewport, colorScheme] of [['390-light', { width: 390, height: 844 }, 'light'], ['390-dark', { width: 390, height: 844 }, 'dark'], ['1440-light', { width: 1440, height: 900 }, 'light']]) {
  test(`actual directory runtime ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme });
    await page.addInitScript(mode => localStorage.setItem('theme', mode), colorScheme);
    const writes = await installReadOnlyFixtures(page);
    await page.goto('http://127.0.0.1:4175/directory.html?runtimeReview=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true', null, { timeout: 30000 });
    await expect.poll(() => page.locator('.directory-card[data-directory-stay-key]').count(), { timeout: 30000 }).toBe(1);
    const profileButton = page.locator('[data-open-directory-profile]');
    await profileButton.evaluate(button => button.click());
    await expect.poll(() => page.locator('.directory-card.is-profile-active').count()).toBe(1);
    await page.waitForTimeout(1200);
    const evidence = await page.evaluate(() => {
      const card = document.querySelector('.directory-card.is-profile-active');
      const text = selector => { const el = card.querySelector(selector); const style = getComputedStyle(el); return { text: el.textContent, width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight, fontSize: style.fontSize, whiteSpace: style.whiteSpace, textOverflow: style.textOverflow }; };
      const cardStyle = getComputedStyle(card);
      return { heading: text('.directory-profile-section-heading h4'), value: text('.directory-field-value'), name: text('.directory-dog-name-btn'), breed: text('.directory-primary-breed'), dates: text('.directory-stay-dates'), pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, darkTheme: document.body.classList.contains('dark-theme'), cardParent: card.parentElement?.id || '', dashboardClasses: card.closest('.directory-dashboard-fused')?.className || '', cardDisplay: cardStyle.display, cardHidden: card.hidden, cardClass: card.className, body: document.body.innerText.slice(0, 500) };
    });
    console.log(`RUNTIME_EVIDENCE ${name} ${JSON.stringify(evidence)}`);
    await page.screenshot({ path: `test-results/care-runtime-${name}.png`, fullPage: true });
    expect(writes.every(item => item.reason === 'unapproved action' || item.reason === 'non-read method')).toBe(true);
    expect(evidence.darkTheme).toBe(colorScheme === 'dark');
    expect(evidence.pageWidth).toBeLessThanOrEqual(evidence.viewport);
    expect(evidence.heading.fontSize).toBe('16px');
    expect(evidence.value.fontSize).toBe('14px');
    expect(evidence.name.fontSize).toBe('22px');
    expect(evidence.breed.fontSize).toBe('14px');
    expect(evidence.dates.fontSize).toBe('14px');
    await expect(page.locator('.directory-card.is-profile-active .directory-field-label').first()).toHaveCSS('font-size', '12px');
    await expect(page.locator('.directory-card.is-profile-active .intake-profile-field label').first()).toHaveCSS('font-size', '12px');
    await expect(page.locator('.directory-card.is-profile-active .intake-profile-control').first()).toHaveCSS('font-size', '14px');
    for (const item of [evidence.name, evidence.breed, evidence.dates]) {
      expect(item.textOverflow).not.toBe('ellipsis');
      expect(item.whiteSpace).not.toBe('nowrap');
      expect(item.scrollWidth).toBeLessThanOrEqual(item.width + 1);
      expect(item.scrollHeight).toBeLessThanOrEqual(item.height + 2);
    }
  });
}

