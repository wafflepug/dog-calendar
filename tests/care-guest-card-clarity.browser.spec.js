const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fullCalendar = fs.readFileSync('tests/fixtures/fullcalendar.global.min.js', 'utf8');
const dogId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stayId = '11111111-1111-4111-8111-111111111111';
const sameDayDogId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sameDayStayId = '22222222-2222-4222-8222-222222222222';
const bookings = [
  { dogName: 'Maple with a very long registered name', breed: 'Cavoodle', startDate: '2026-10-16', endDate: '2026-10-18', dogId, dogNumber: '#00052', stayId, ownerName: 'Ada Owner with a long booking source', bookingType: 'Boarding', requestSource: 'MadPaws', stayKey: 'maple with a very long registered name|2026-10-16|2026-10-18' },
  { dogName: 'Same Day Guest', breed: 'Spaniel', startDate: '2026-10-17', endDate: '2026-10-17', dogId: sameDayDogId, dogNumber: '#00053', stayId: sameDayStayId, ownerName: 'Sam Owner', bookingType: 'Boarding', requestSource: 'Other', stayKey: 'same day guest|2026-10-17|2026-10-17' }
];
const csv = `Timestamp,Dog Name,Breed,Start Date,End Date,Owner's Name,Contact Number,Likes,Dislikes,Notes,Edit Link,Booking Type,Request Source,Dog ID,Dog Number,Stay ID\n${bookings.map(b => `2026-10-01,${b.dogName},${b.breed},${b.startDate},${b.endDate},${b.ownerName},0400000000,,,,,${b.bookingType},${b.requestSource},${b.dogId},${b.dogNumber},${b.stayId}`).join('\n')}`;

test('Care guest cards show identity, dates, status and urgent flags without overlap or profile reads', async ({ page, baseURL }, testInfo) => {
  const screenshotDirectory = path.resolve(__dirname, '..', 'output', 'care-guest-card-clarity');
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  const now = Date.UTC(2026, 9, 17, 1);
  await page.addInitScript(({ theme, csv, now }) => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('boardingDataCache', csv);
    const NativeDate = Date;
    function FixedDate(...args) { if (!new.target) return new NativeDate(now).toString(); return Reflect.construct(NativeDate, args.length ? args : [now], new.target); }
    FixedDate.prototype = NativeDate.prototype;
    Object.setPrototypeOf(FixedDate, NativeDate);
    FixedDate.now = () => now;
    globalThis.Date = FixedDate;
  }, { theme: testInfo.project.use.colorScheme || 'light', csv, now });

  const reads = [];
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) throw new Error('Fixture blocked mutation');
    if (new URL(url).hostname === '127.0.0.1') return route.continue();
    if (url.includes('output=csv')) return route.fulfill({ status: 200, contentType: 'text/csv', body: csv });
    if (url.includes('fullcalendar.global')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendar });
    if (url.includes('script.google')) {
      const params = new URL(url).searchParams, callback = params.get('callback');
      const payload = JSON.parse(params.get('payload') || '{}');
      const action = resolveLocalBackendAction({ method: request.method(), url });
      if (!action.policy.allowed) return route.fulfill({ status: 403, body: 'Read-only fixture blocked action' });
      reads.push(payload);
      let data = { result: 'success', records: [] };
      if (action.action === 'get_guest_directory') data = { result: 'success', bookings, summaries: [{ stayKey: bookings[0].stayKey, requestSource: 'MadPaws', riskFlags: { medicated: true, foodAllergy: true, escapeRisk: true }, intakeFieldCount: 0 }] };
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(data)});` });
    }
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
  });

  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  const card = page.locator('#directory-grid > .directory-card').first();
  const tile = card.locator(':scope > .directory-guest-tile-open');
  await expect(tile.locator('.directory-guest-tile-name')).toHaveText(bookings[0].dogName);
  await expect(tile.locator('.directory-dog-id')).toHaveText('Dog ID #00052');
  await expect(tile.locator('.directory-roster-context')).toContainText('Check-in 16 Oct · Check-out 18 Oct');
  await expect(tile.locator('[data-v1118-status-chip]')).toHaveText('AT HOME');
  await expect(tile.locator('.directory-roster-status')).toBeHidden();
  await expect(tile.locator('.v1117-care-source-label')).toHaveText('MadPaws');

  for (const width of [360, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(tile).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(mode => document.body.classList.toggle('dark-theme', mode === 'dark'), theme);
      const report = await tile.evaluate(node => {
        const rect = el => el.getBoundingClientRect().toJSON();
        const selectors = ['.directory-roster-copy', '[data-v1118-status-chip]', '.v1118-care-signals', '.v1117-care-source-badge'];
        const boxes = selectors.map(selector => ({ selector, box: rect(node.querySelector(selector)) }));
        const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].box, b = boxes[j].box;
          if (a.width && b.width && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps.push([boxes[i].selector, boxes[j].selector]);
        }
        return { overflow, overlaps, boxes };
      });
      expect(report.overflow, `${theme} ${width}px ${JSON.stringify(report)}`).toBe(false);
      expect(report.overlaps, `${theme} ${width}px ${JSON.stringify(report)}`).toEqual([]);
      for (const item of report.boxes) {
        expect(item.box.left, `${theme} ${width}px ${item.selector}`).toBeGreaterThanOrEqual(0);
        expect(item.box.right, `${theme} ${width}px ${item.selector}`).toBeLessThanOrEqual(width + 1);
      }
      for (const label of ['Medication', 'Food allergy', 'Escape risk', 'Intake missing']) await expect(tile.locator('.v1118-care-signal', { hasText: label })).toBeVisible();
      const primary = card.locator('[data-v11217-roster-checkin]');
      await expect(primary).toBeVisible();
      await expect(card.locator('[data-v11217-roster-actions] > button')).toHaveCount(1);
      const more = card.locator('.v11217-roster-more-actions');
      await expect(more.locator('summary')).toHaveText('More actions');
      await expect(more.locator('[data-v11217-early-checkout]')).toBeHidden();
      const actionBounds = await primary.boundingBox();
      expect(actionBounds.height).toBeGreaterThanOrEqual(44);
      expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(width + 1);
      await card.screenshot({ path: path.join(screenshotDirectory, `${testInfo.project.name}-${theme}-care-card-${width}.png`), style: '#wh75SettingsBackdrop,#wh75SettingsPanel,#wh75MobileBottomNav{display:none!important}' });
    }
  }

  const profileReadsBeforeActions = reads.filter(payload => payload.action === 'get_guest_profile').length;
  await tile.focus();
  await expect(tile).toHaveCSS('outline-style', 'solid');
  const moreSummary = card.locator('.v11217-roster-more-actions > summary');
  await moreSummary.focus();
  await expect(moreSummary).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(card.locator('[data-v11217-roster-actions] [data-v11217-early-checkout]')).toBeVisible();
  const sameDay = page.locator('#directory-grid > .directory-card[data-directory-dog-id="' + sameDayDogId + '"]');
  await expect(sameDay.locator(':scope > .directory-guest-tile-open .directory-roster-context')).toHaveText('Same-day care · 17 Oct');
  await expect(sameDay.locator(':scope > .directory-guest-tile-open .directory-roster-owner')).toHaveText('Owner: Sam Owner');
  await expect(sameDay.locator('[data-v11217-roster-actions] > button')).toHaveCount(1);
  await expect(sameDay.locator('[data-v11217-roster-checkin]')).toBeVisible();
  await sameDay.locator('.v11217-roster-more-actions > summary').click();
  await expect(sameDay.locator('[data-v11217-roster-checkout]')).toBeVisible();
  expect(reads.filter(payload => payload.action === 'get_guest_profile')).toHaveLength(profileReadsBeforeActions);
});
