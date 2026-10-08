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
const pastBookings = [
  { dogId: '11111111-1111-4111-8111-111111111111', dogNumber: '17', ownerName: 'Owner A' },
  { dogId: '22222222-2222-4222-8222-222222222222', dogNumber: '#00018', ownerName: 'Owner B' }
].map((identity, index) => ({
  ...identity, row: index + 2, stayKey: 'twin pup|2026-08-01|2026-08-03',
  dogName: 'Twin Pup', breed: 'Cavoodle', startDate: '2026-08-01', endDate: '2026-08-03', phone: '0400000000'
}));

test.describe.configure({ mode: 'serial' });

async function installContinuityFixture(page) {
  let profileReadCount = 0;
  await page.clock.setFixedTime(new Date('2026-09-18T12:00:00Z'));
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
        : policy.action === 'get_past_guest_directory'
        ? { result: 'success', bookings: pastBookings, summaries: [] }
        : { result: 'success', record: { stayKey: payload.stayKey || stayKey, intakeAttributes: {} } };
      if (callback) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') {
      const type = request.resourceType();
      return route.fulfill({ status: 200, contentType: type === 'stylesheet' ? 'text/css' : type === 'script' ? 'application/javascript' : 'image/svg+xml', body: type === 'stylesheet' || type === 'script' ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' });
    }
    return route.continue();
  });
  return () => profileReadCount;
}

test('Back restores the filtered list and opener focus', async ({ page, baseURL }) => {
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 740 });
  const readProfileCount = await installContinuityFixture(page);
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  await expect(page.locator('#directory-grid [data-open-directory-profile]')).toHaveCount(1);
  expect(readProfileCount()).toBe(0);
  await page.locator('#guestDirectorySearch').fill('continuity');
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
  const openerLabel = await page.locator('#directory-grid [data-open-directory-profile]').getAttribute('aria-label');
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
  const openerLocator = page.locator('#directory-grid [data-open-directory-profile]');
  // CSS scroll behavior may animate this fixture scroll; wait for the target to enter the viewport before measuring it.
  await expect.poll(async () => {
    const box = await openerLocator.boundingBox();
    const viewportHeight = page.viewportSize()?.height || 0;
    return Boolean(box && box.y >= 0 && box.y + box.height <= viewportHeight);
  }).toBe(true);
  const openerBefore = await openerLocator.boundingBox();
  expect(openerBefore?.y).toBeGreaterThanOrEqual(0);
  expect((openerBefore?.y || 0) + (openerBefore?.height || 0)).toBeLessThanOrEqual(page.viewportSize()?.height || 0);
  // Clear search was activated with a pointer above. Establish keyboard
  // modality before checking the opener's keyboard-only focus indication.
  await page.keyboard.press('Tab');
  await page.locator('#directory-grid [data-open-directory-profile]').focus();
  await expect.poll(() => page.locator('#directory-grid [data-open-directory-profile]').evaluate(element => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== 'none' && style.outlineColor !== style.backgroundColor;
  })).toBe(true);
  await page.keyboard.press('Enter');
  const selectedProfile = page.locator('.directory-card.is-profile-active');
  await expect(selectedProfile.locator('[data-toggle-profile-edit]')).toHaveAttribute('aria-label', 'Edit detailed care for Continuity Dog');
  await expect(selectedProfile.locator('[data-cancel-profile-edit]')).toHaveAttribute('aria-label', 'Discard detailed care changes for Continuity Dog');
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
  const refreshedOpenerLabel = await page.locator('#directory-grid [data-open-directory-profile]').getAttribute('aria-label');
  expect(refreshedOpenerLabel).toContain('00001');
  expect(refreshedOpenerLabel).toContain('Casey');
  const readsBeforeBack = readProfileCount();
  await page.locator('#directoryBackToGuestsBtn').evaluate(button => button.click());
  await expect(page.locator('.directory-dashboard-fused.is-profile-mode')).toHaveCount(0);
  await expect(page.locator('#guestDirectorySearch')).toHaveValue('continuity');
  await expect.poll(() => page.evaluate(() => ({
    isOpener: document.activeElement?.matches?.('[data-open-directory-profile]') === true,
    active: document.activeElement?.outerHTML?.slice(0, 220) || ''
  }))).toMatchObject({ isOpener: true });
  await page.waitForTimeout(200);
  expect(readProfileCount()).toBe(readsBeforeBack);

  // Replacing the opener while the profile is open must restore the matching
  // identity when another card with the same stay key appears first.
  await page.locator('#directory-grid .directory-card').evaluate(card => {
    card.dataset.directoryDogId = 'f5f57ca3-fb50-4e19-8590-10dab77398b1';
    card.dataset.directoryStayId = 'bb942e2d-2c4c-4be5-a943-f7a9e0ae402c';
  });
  await page.locator('#directory-grid [data-open-directory-profile]').focus();
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
  await page.locator('#directory-grid [data-open-directory-profile]').click();
  await page.locator('.directory-card.is-profile-active').evaluate(element => element.remove());
  await page.locator('#directoryBackToGuestsBtn').evaluate(button => button.click());
  await expect(page.locator('#guestDirectorySearch')).toBeFocused();
  const removedOriginScroll = await page.evaluate(() => ({
    y: window.scrollY,
    max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  }));
  expect(removedOriginScroll.y).toBeLessThanOrEqual(removedOriginScroll.max + 2);

});

test('Loaded search uses identity fields and clears without profile reads', async ({ page, baseURL }) => {
  const readProfileCount = await installContinuityFixture(page);
  await page.goto(baseURL + '/directory.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  await page.locator('#guestDirectorySearch').fill('#00001');
  await expect(page.locator('#directory-search-status')).toContainText('1 match in Staying');
  await expect(page.locator('#directory-grid [data-open-directory-profile]')).toBeVisible();
  await page.locator('#directory-grid .directory-card').evaluate(card => {
    const note = document.createElement('div');
    note.className = 'directory-profile-content';
    note.textContent = 'Private note canary detail';
    card.appendChild(note);
  });
  await page.locator('#guestDirectorySearch').fill('canary detail');
  await expect(page.locator('#directory-search-status')).toContainText('No guests match');
  await expect(page.locator('#directory-grid [data-open-directory-profile]')).toBeHidden();
  await page.locator('[data-directory-search-clear]').click();
  await expect(page.locator('#guestDirectorySearch')).toBeFocused();
  await expect(page.locator('#directory-grid [data-open-directory-profile]')).toBeVisible();
  await page.locator('#guestDirectorySearch').fill('casey');
  await expect(page.locator('#directory-search-status')).toContainText('1 match in Staying');
  await page.locator('#guestDirectorySearch').fill('continuity');
  expect(readProfileCount()).toBe(0);
});

test('Past search keeps same-name dogs distinct through the production loader', async ({ page, baseURL }) => {
  const readProfileCount = await installContinuityFixture(page);
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  // Use the production Past loader and compatibility renderer, not manually
  // inserted cards, to prove same-name/breed dogs keep their saved identities.
  await page.locator('[data-v1082-stay-tab="past"]').click();
  await page.locator('#guestDirectorySearch').fill('Twin Pup');
  await expect(page.locator('#past-directory-grid .directory-card:visible')).toHaveCount(2);
  await expect(page.locator('#directory-search-status')).toContainText('2 matches in Past');
  const readsBeforePastSearch = readProfileCount();
  for (const [query, expectedId] of [
    ['#00017', pastBookings[0].dogId],
    ['00018', pastBookings[1].dogId],
    ['Owner A', pastBookings[0].dogId],
    [pastBookings[1].dogId, pastBookings[1].dogId]
  ]) {
    await page.locator('#guestDirectorySearch').fill(query);
    const result = page.locator('#past-directory-grid .directory-card:visible');
    await expect(result).toHaveCount(1);
    await expect(result).toHaveAttribute('data-directory-dog-id', expectedId);
    await expect(page.locator('#directory-search-status')).toContainText('1 match in Past');
  }
  await page.locator('[data-directory-search-clear]').click();
  await expect(page.locator('#guestDirectorySearch')).toBeFocused();
  await expect(page.locator('[data-v1082-stay-tab="past"]')).toHaveClass(/is-active/);
  await expect(page.locator('#past-directory-grid .directory-card:visible')).toHaveCount(2);
  expect(readProfileCount()).toBe(readsBeforePastSearch);
});
