const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fs = require('node:fs');
const path = require('node:path');

const careSource = fs.readFileSync(path.join(__dirname, '..', 'care.js'), 'utf8');
const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const evidenceDir = path.join(__dirname, '..', 'output', 'releases', '2026.10.14.03', 'evidence');
const pastBooking = {
  timestamp: '2026-10-01', dogName: 'Milo Longtail', breed: 'Border Collie',
  startDate: '2026-10-02', endDate: '2026-10-06', ownerName: 'Alex Owner', phone: '0400111222',
  notes: '', bookingType: 'Boarding', dogId: '11111111-1111-4111-8111-111111111111',
  stayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', dogNumber: '#00017', stayKey: 'milo longtail|2026-10-02|2026-10-06', operationalStatus: 'checked_out',
  checkoutDate: '2026-10-04', actualCheckoutDate: '2026-10-04'
};

async function installPastReadOnlyFixture(page) {
  const actionReads = [];
  // Fix the business date without replacing native input timestamps, timers or paint scheduling.
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixedNow = NativeDate.UTC(2026, 9, 14, 12, 0, 0);
    function FixedDate(...args) {
      if (!new.target) return new NativeDate(fixedNow).toString();
      return Reflect.construct(NativeDate, args.length ? args : [fixedNow], new.target);
    }
    FixedDate.prototype = NativeDate.prototype;
    Object.setPrototypeOf(FixedDate, NativeDate);
    FixedDate.now = () => fixedNow;
    globalThis.Date = FixedDate;
  });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Read-only fixture blocked mutation' });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      const csv = 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n' +
        [pastBooking.timestamp, pastBooking.dogName, pastBooking.breed, '02/10/2026', '06/10/2026', pastBooking.ownerName, pastBooking.phone, '', '', pastBooking.notes, '', pastBooking.bookingType, 'Other', pastBooking.dogId, pastBooking.stayId, pastBooking.dogNumber].join(',');
      return route.fulfill({ status: 200, contentType: 'text/csv', body: csv });
    }
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendar });
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: 'Read-only fixture blocked backend action' });
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {};
      try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      actionReads.push({ action: resolved.action, payload });
      const stayKey = `${pastBooking.dogName.toLowerCase()}|${pastBooking.startDate}|${pastBooking.endDate}`;
      let response = { result: 'success', bookings: [pastBooking], records: [], summaries: [{ stayKey }] };
      if (resolved.action === 'get_guest_directory') response = { result: 'success', bookings: [pastBooking], summaries: [{ stayKey }] };
      if (resolved.action === 'get_past_guest_directory') response = { result: 'success', bookings: [pastBooking], totalPastStays: 1 };
      if (resolved.action === 'get_guest_profile') response = { result: 'success', record: { stayKey: payload.stayKey || stayKey, identity: { stayKey: payload.stayKey || stayKey, stayId: pastBooking.stayId, dogId: pastBooking.dogId }, resolution: { status: 'resolved', method: 'fixture' }, intakeAttributes: {} } };
      if (resolved.action === 'get_guest_belongings') response = { result: 'success', record: { stayKey: payload.stayKey || stayKey, identityResolution: { status: 'resolved', identity: { stayKey: payload.stayKey || stayKey, stayId: pastBooking.stayId, dogId: pastBooking.dogId } }, dogPhotoGallery: [], stayPhotos: [], photos: [] } };
      const body = callback ? `${callback}(${JSON.stringify(response)});` : JSON.stringify(response);
      return route.fulfill({ status: 200, contentType: callback ? 'application/javascript' : 'application/json', body });
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') {
      const type = request.resourceType();
      return route.fulfill({ status: 200, contentType: type === 'stylesheet' ? 'text/css' : type === 'script' ? 'application/javascript' : 'image/svg+xml', body: type === 'stylesheet' || type === 'script' ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' });
    }
    return route.continue();
  });
  return actionReads;
}

async function mount(page, width) {
  await page.setViewportSize({ width, height: 860 });
  await page.setContent(`<!doctype html><html><head></head><body data-waffle-page="directory">
    <main class="directory-card is-profile-active" data-directory-dog-id="dog-1" data-directory-dog-name="Milo" data-directory-stay-key="milo|2026-10-01|2026-10-04">
      <div class="directory-profile-content">
        <nav class="directory-main-profile-tabs"><button class="directory-main-profile-tab is-active" data-directory-main-tab="profile">Overview</button></nav>
        <section data-directory-main-panel="profile"><textarea aria-label="Care draft">Keep this draft</textarea></section>
        <section data-directory-main-panel="belongings">Saved items</section>
      </div>
    </main>
  </body></html>`);
  await page.evaluate(() => {
    window.WAFFLE_PAGE = 'directory';
    window.careReads = [];
    window.switchDirectoryProfileMainTab = (_card, key) => window.careReads.push(key);
    window.queryAppsScript = async request => { window.careReads.push(request.action); return {}; };
  });
  await page.addScriptTag({ content: careSource });
  await expect(page.locator('.v11160-desktop-tab')).toHaveCount(5);
}

test.describe('Care mobile spatial tab navigation', () => {
  for (const width of [320, 390]) test(`moves vertically by visible grid column at ${width}px without loading until activation`, async ({ page }) => {
    await mount(page, width);
    const nav = page.locator('[role="tablist"]');
    const tab = key => nav.locator(`[data-v11160-tab="${key}"]`);
    const readsBefore = await page.evaluate(() => [...window.careReads]);

    await tab('profile').focus();
    await page.keyboard.press('ArrowDown');
    await expect(tab('history')).toBeFocused();
    await expect(tab('history')).toHaveAttribute('aria-selected', 'false');
    await expect(tab('history')).toHaveAttribute('tabindex', '0');
    expect(await page.evaluate(() => [...window.careReads])).toEqual(readsBefore);
    await page.keyboard.press('ArrowUp');
    await expect(tab('profile')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await expect(tab('master')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(tab('master')).toBeFocused(); // no wrap past the last row
    await page.keyboard.press('ArrowUp');
    await expect(tab('belongings')).toBeFocused();
    await expect(tab('belongings')).toHaveAttribute('aria-selected', 'false');
    expect(await page.evaluate(() => [...window.careReads])).toEqual(readsBefore);

    await page.keyboard.press('Enter');
    await expect(tab('belongings')).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => [...window.careReads])).toContain('belongings');
    expect(await page.locator('textarea').inputValue()).toBe('Keep this draft');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await tab('media').focus();
    await page.keyboard.press('ArrowDown');
    await expect(tab('master')).toBeFocused();
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.keyboard.press('ArrowDown');
    await expect(tab('master')).toBeFocused();
  });

  test('preserves desktop horizontal navigation and ignores vertical arrows', async ({ page }) => {
    await mount(page, 1280);
    const nav = page.locator('[role="tablist"]');
    const overview = nav.locator('[data-v11160-tab="profile"]');
    const items = nav.locator('[data-v11160-tab="belongings"]');
    await overview.focus();
    const readsBefore = await page.evaluate(() => [...window.careReads]);
    await page.keyboard.press('ArrowDown');
    await expect(overview).toBeFocused();
    await expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => [...window.careReads])).toEqual(readsBefore);
    await page.keyboard.press('ArrowRight');
    await expect(items).toBeFocused();
    await expect(items).toHaveAttribute('aria-selected', 'false');
  });

  test('keeps aggregate history contacts once and attributes changed contacts to their visit', async ({ page }) => {
    await mount(page, 390);
    const profile = page.locator('.directory-card');
    await page.evaluate(() => {
      window.queryAppsScript = async request => request.action === 'get_dog_history' ? ({ history: {
        dogNumber: '#00017', owners: [{ ownerName: ' Alex Owner ', phone: '0400 111 222' }],
        previousStays: [
          { startDate: '2025-01-02', endDate: '2025-01-04', ownerName: 'Alex Owner', phone: '0400 111 222' },
          { startDate: '2024-01-02', endDate: '2024-01-04', ownerName: 'Alex Owner', phone: '0400 999 888' }
        ]
      } }) : ({});
    });
    await profile.locator('[data-v11160-tab="history"]').click();
    const history = profile.locator('[data-v108-history]');
    await expect(history.locator('.v108-history-year-group')).toHaveCount(2);
    await expect(history.locator('.v108-history-contacts summary')).toContainText('Owner contacts (1)');
    await expect(history.locator('.v108-history-year-group[data-history-year="2025"] a[href="tel:0400 111 222"]')).toHaveCount(1);
    await expect(history.locator('.v108-history-year-group[data-history-year="2024"] a[href="tel:0400 999 888"]')).toHaveCount(1);
    await expect(history).toContainText('Dog ID #00017');
  });

  test('full runtime past profile shows one identity, preserves checkout dates, and restores tile focus', async ({ page, baseURL, browserName }) => {
    test.skip(!baseURL, 'Requires the local read-only directory fixture server.');
    if (process.env.WAFFLE_CAPTURE_UI_EVIDENCE === '1') fs.mkdirSync(evidenceDir, { recursive: true });
    const actionReads = await installPastReadOnlyFixture(page);

    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${baseURL}/directory.html?careClarityPastFixture=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
      await page.locator('[data-v1082-stay-tab="past"]').click();
      const tile = page.locator('#past-directory-grid .directory-card[data-v1082-past-stay="true"] [data-open-directory-profile]');
      await expect(tile).toBeVisible();
      await expect.poll(() => actionReads.filter(item => item.action === 'get_past_guest_directory').length).toBeGreaterThan(0);
      await tile.click();
      const card = page.locator('#directoryTabPanel .directory-card[data-v1082-past-stay="true"].is-profile-active');
      await expect(card).toHaveCount(1);
      const activeTile = card.locator(':scope > .directory-guest-tile-open');
      const identity = card.locator('.directory-card-identity');
      await expect(activeTile).toBeHidden();
      const cardMarkup = await card.evaluate(element => element.innerHTML.slice(0, 2400));
      expect(await identity.count(), `Active past card markup: ${cardMarkup}`).toBe(1);
      await expect(identity).toBeVisible();
      await expect(card.locator('.v1082-past-dog-id')).toHaveText('Dog ID #00017');
      await expect(card.locator('.directory-card-identity')).toContainText('2 Oct – 6 Oct');
      await expect(card.locator('.v1082-past-checkout-date')).toContainText('Checked out 4 Oct');
      await expect(card.locator('.v1082-past-status')).toHaveText('Checked out');
      await expect(card.locator('.directory-card-identity .directory-dog-name-btn')).toHaveText('Milo Longtail');

      const nav = card.locator('.v11160-desktop-tabs');
      const overview = nav.locator('[data-v11160-tab="profile"]');
      const history = nav.locator('[data-v11160-tab="history"]');
      // Startup diagnostics can settle during focus changes. Count the lazy
      // destination panel reads; the isolated navigation fixture above also
      // verifies every read and draft while exercising activation.
      const panelReads = () => actionReads.filter(item => ['get_dog_history', 'get_guest_belongings', 'get_dog_master_profile'].includes(item.action));
      const readsBefore = panelReads().length;
      await overview.focus();
      await page.keyboard.press('ArrowDown');
      if (width <= 768) {
        await expect(history).toBeFocused();
        await expect(history).toHaveAttribute('aria-selected', 'false');
        await page.keyboard.press('ArrowUp');
        await expect(overview).toBeFocused();
      } else {
        await expect(overview).toBeFocused();
      }
      expect(panelReads()).toHaveLength(readsBefore);
      await expect(overview).toHaveAttribute('aria-selected', 'true');

      if (browserName === 'chromium' && process.env.WAFFLE_CAPTURE_UI_EVIDENCE === '1' && width === 390) {
        await card.screenshot({ path: path.join(evidenceDir, 'care-past-identity-phone-390.png') });
      }
      if (browserName === 'chromium' && process.env.WAFFLE_CAPTURE_UI_EVIDENCE === '1' && width === 1440) {
        await card.screenshot({ path: path.join(evidenceDir, 'care-past-identity-desktop-1440.png') });
      }

      await nav.locator('[data-v11160-tab="belongings"]').click();
      await expect(card.locator('.belongings-summary-empty')).toHaveText('No items were saved for this visit.');
      await expect(card.locator('.belongings-photo-empty')).toContainText('No belongings photos were saved for this visit.');
      await expect(card.locator('[data-save-belongings]')).toBeHidden();
      expect(await card.locator('[data-belongings-item-description]').evaluateAll(inputs => inputs.every(input => input.disabled))).toBeTruthy();

      await page.locator('#directoryBackToGuestsBtn').click();
      await expect(card).toHaveCount(0);
      const restoredTile = page.locator('#past-directory-grid .directory-card[data-v1082-past-stay="true"] [data-open-directory-profile]');
      await expect(restoredTile).toBeVisible();
      await expect(restoredTile).toBeFocused();
    }
  });
});
