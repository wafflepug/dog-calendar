const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fs = require('node:fs');
const path = require('node:path');
const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');

const booking = {
  timestamp: '2026-09-18', dogName: 'Continuity Dog', breed: 'Border Collie',
  startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Casey', phone: '0400000000',
  notes: 'Long list fixture', bookingType: 'Boarding', dogId: 'f5f57ca3-fb50-4e19-8590-10dab77398b1',
  stayId: 'bb942e2d-2c4c-4be5-a943-f7a9e0ae402c', dogNumber: '#00001'
};
const dogId = 'f5f57ca3-fb50-4e19-8590-10dab77398b1';
const stayId = 'bb942e2d-2c4c-4be5-a943-f7a9e0ae402c';

test.describe.configure({ mode: 'serial' });

test('Back restores the filtered list and opener focus', async ({ page, baseURL }) => {
  let profileReadCount = 0;
  await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.route('**/*', async route => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'fixture' });
    const url = request.url();
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendar });
    }
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Dog ID,Stay ID,Dog Number\n' + [booking.timestamp, booking.dogName, booking.breed, '17/09/2026', '22/09/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', booking.bookingType, dogId, stayId, '#00001'].join(',') });
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
  expect(profileReadCount).toBe(0);
  await page.locator('#guestDirectorySearch').fill('continuity');
  expect(profileReadCount).toBe(0);
  for (const dark of [false, true]) {
    const pageWidths = await page.evaluate(isDark => {
      document.body.classList.toggle('dark-theme', isDark);
      return {
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        card: document.querySelector('.directory-card')?.getBoundingClientRect().width
      };
    }, dark);
    expect(pageWidths.content).toBeLessThanOrEqual(pageWidths.viewport);
    expect(pageWidths.card).toBeLessThanOrEqual(pageWidths.viewport);
  }
  await page.setViewportSize(originalViewport);
  const openerLabel = await page.locator('[data-open-directory-profile]').getAttribute('aria-label');
  expect(openerLabel).toContain('00001');
  expect(openerLabel).toContain('Casey');
  expect(openerLabel).toContain('17 Sept');
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
  await expect.poll(() => page.locator('[data-open-directory-profile]').evaluate(element => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== 'none' && style.outlineColor !== style.backgroundColor;
  })).toBe(true);
  await page.keyboard.press('Enter');
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
  const refreshedOpenerLabel = await page.locator('[data-open-directory-profile]').getAttribute('aria-label');
  expect(refreshedOpenerLabel).toContain('00001');
  expect(refreshedOpenerLabel).toContain('Casey');
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

  // Replacing the opener while the profile is open must restore the matching
  // identity when another card with the same stay key appears first.
  await page.locator('.directory-card').evaluate(card => {
    card.dataset.directoryDogId = 'f5f57ca3-fb50-4e19-8590-10dab77398b1';
    card.dataset.directoryStayId = 'bb942e2d-2c4c-4be5-a943-f7a9e0ae402c';
  });
  await page.locator('[data-open-directory-profile]').focus();
  await page.keyboard.press('Enter');
  await page.locator('.directory-card.is-profile-active').evaluate(card => {
    const opener = card.querySelector('[data-open-directory-profile]');
    opener.replaceWith(opener.cloneNode(true));
    const decoy = card.cloneNode(true);
    decoy.classList.remove('is-profile-active');
    decoy.dataset.directoryDogId = 'different-dog-id';
    decoy.dataset.directoryStayId = 'different-stay-id';
    card.parentElement.insertBefore(decoy, card);
  });
  await page.locator('#directoryBackToGuestsBtn').evaluate(button => button.click());
  await expect.poll(() => page.evaluate(() => ({
    dogId: document.activeElement?.closest('.directory-card')?.dataset.directoryDogId,
    stayId: document.activeElement?.closest('.directory-card')?.dataset.directoryStayId
  }))).toMatchObject({ dogId, stayId });
  const restoredIdentity = await page.evaluate(() => ({
    dogId: document.activeElement?.closest('.directory-card')?.dataset.directoryDogId,
    stayId: document.activeElement?.closest('.directory-card')?.dataset.directoryStayId
  }));
  expect(restoredIdentity.dogId).toBe(dogId);
  expect(restoredIdentity.stayId).toBe(stayId);
  await page.evaluate(() => {
    document.querySelector('[data-directory-dog-id="different-dog-id"]')?.remove();
  });

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
