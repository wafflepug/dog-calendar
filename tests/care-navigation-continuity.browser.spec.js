const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

const booking = {
  timestamp: '2026-09-18', dogName: 'Continuity Dog', breed: 'Border Collie',
  startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Casey', phone: '0400000000',
  notes: 'Long list fixture', bookingType: 'Boarding'
};

test.describe.configure({ mode: 'serial' });

test('Back restores the filtered list and opener focus', async ({ page, baseURL }) => {
  let profileReadCount = 0;
  await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
  await page.route('**/*', async route => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'fixture' });
    const url = request.url();
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type\n' + [booking.timestamp, booking.dogName, booking.breed, '17/09/2026', '22/09/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', booking.bookingType].join(',') });
    }
    if (url.includes('script.google')) {
      const policy = resolveLocalBackendAction({ method: request.method(), url });
      if (!policy.policy.allowed) return route.fulfill({ status: 403, body: 'fixture' });
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {}; try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      const stayKey = 'continuity dog|2026-09-17|2026-09-22';
      if (policy.action === 'get_guest_profile') profileReadCount += 1;
      const response = policy.action === 'get_guest_directory'
        ? { result: 'success', bookings: [booking], summaries: [{ stayKey }] }
        : { result: 'success', record: { stayKey: payload.stayKey || stayKey, intakeAttributes: {} } };
      if (callback) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    }
    return route.continue();
  });
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  await expect(page.locator('[data-open-directory-profile]')).toHaveCount(1);
  await page.locator('#guestDirectorySearch').fill('continuity');
  await page.evaluate(() => {
    document.body.style.minHeight = '2600px';
    const grid = document.getElementById('directory-grid');
    if (grid) grid.style.marginTop = '700px';
    const opener = document.querySelector('[data-open-directory-profile]');
    const documentY = opener ? opener.getBoundingClientRect().top + window.scrollY : 520;
    window.scrollTo(0, Math.max(0, documentY - 160));
  });
  const openerBefore = await page.locator('[data-open-directory-profile]').boundingBox();
  expect(openerBefore?.y).toBeGreaterThanOrEqual(0);
  expect((openerBefore?.y || 0) + (openerBefore?.height || 0)).toBeLessThanOrEqual(page.viewportSize()?.height || 0);
  await page.locator('[data-open-directory-profile]').focus();
  await page.locator('[data-open-directory-profile]').dispatchEvent('click');
  const tabMetrics = await page.evaluate(() => {
    const measure = element => {
      const style = element ? getComputedStyle(element) : null;
      return element && style ? {
        height: element.getBoundingClientRect().height,
        selected: element.getAttribute('aria-selected'),
        color: style.color,
        background: style.backgroundColor
      } : null;
    };
    const selected = Array.from(
      document.querySelectorAll('.directory-card.is-profile-active [role="tab"][aria-selected="true"]')
    ).filter(element => element.getBoundingClientRect().height > 0);
    return {
      main: measure(selected[0]),
      secondary: measure(selected[1])
    };
  });
  expect(tabMetrics.main?.height).toBeGreaterThanOrEqual(43.5);
  expect(tabMetrics.main?.selected).toBe('true');
  if (tabMetrics.secondary) {
    expect(tabMetrics.secondary?.height).toBeGreaterThanOrEqual(43.5);
    expect(tabMetrics.secondary?.selected).toBe('true');
    expect(tabMetrics.secondary?.color).not.toBe(tabMetrics.secondary?.background);
  }
  // Let compatibility layers finish their selected-profile work, then prove
  // the Back path itself does not initiate another profile read.
  await page.waitForTimeout(750);
  const readsBeforeBack = profileReadCount;
  await page.locator('#directoryBackToGuestsBtn').evaluate(button => button.click());
  await expect(page.locator('.directory-dashboard-fused.is-profile-mode')).toHaveCount(0);
  await expect(page.locator('#guestDirectorySearch')).toHaveValue('continuity');
  await expect.poll(() => page.evaluate(() => ({
    isOpener: document.activeElement?.matches?.('[data-open-directory-profile]') === true,
    active: document.activeElement?.outerHTML?.slice(0, 220) || ''
  }))).toMatchObject({ isOpener: true });
  await page.waitForTimeout(200);
  expect(profileReadCount).toBe(readsBeforeBack);

  // If a refresh removes the original stay while its profile is open, Back
  // clamps the scroll position and moves focus to the retained list controls.
  await page.locator('[data-open-directory-profile]').click();
  await page.locator('.directory-card.is-profile-active').evaluate(element => element.remove());
  await page.locator('#directoryBackToGuestsBtn').evaluate(button => button.click());
  await expect(page.locator('#guestDirectorySearch')).toBeFocused();
  const removedOriginScroll = await page.evaluate(() => ({
    y: window.scrollY,
    max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  }));
  expect(removedOriginScroll.y).toBeLessThanOrEqual(removedOriginScroll.max + 2);
});
