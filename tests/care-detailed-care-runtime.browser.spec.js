const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fs = require('node:fs');
const path = require('node:path');

const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const dogId = 'af89ec16-4eef-4af6-8b1f-03e75daef101';
const stayId = 'bd83c231-521b-48f6-ae88-bce2d1c1c83d';
const booking = {
  timestamp: '2026-10-12', dogName: 'Detailed Care Fixture', breed: 'Border Collie',
  startDate: '2026-10-12', endDate: '2026-10-16', ownerName: 'Synthetic Owner', phone: '0400000000',
  bookingType: 'Boarding', dogId, stayId, dogNumber: '#00991'
};
const longProfile = {
  feedingTimes: '06:30 before the morning walk, 12:15 after the medication check, and 18:00 after the evening walk every day',
  foodAmount: 'One measured cup of the salmon and brown rice food at each meal; add two tablespoons of warm water',
  medicationInstructions: 'Give the small white tablet with dinner; if appetite changes, skip the next dose and call Synthetic Owner immediately on 0400 000 000',
  medicalConditions: 'Seasonal allergies and a sensitive stomach; monitor for itching, redness, loose stools, or unusual tiredness after each meal',
  triggersFears: 'Thunder, vacuum cleaners, and unfamiliar delivery workers; give space and approach calmly from the front',
  sleepLocation: 'On the padded mat beside the bedroom door, with the blue blanket folded over the left side',
  friendlyDogs: 'Calm dogs after a slow introduction; keep meal bowls separate and supervise shared play'
};

function assertNoUnexpectedBackendRequests(fixture) {
  const backendBlocks = fixture.blocked.filter(item => item.action || item.url?.includes('script.google'));
  expect(backendBlocks, JSON.stringify(backendBlocks)).toEqual([]);
  expect(backendBlocks.every(item => item.method === 'GET')).toBe(true);
}

async function installReadOnlyFixture(page, { allowManualPhotoSync = false, photoSyncResponses = ['success'], directoryGate = null, profileAttributes = longProfile } = {}) {
  const actions = [];
  const blocked = [];
  const photoSyncRequests = [];
  const stayKey = 'detailed care fixture|2026-10-12|2026-10-16';
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) {
      blocked.push({ method: request.method(), url });
      return route.fulfill({ status: 405, body: 'Read-only fixture blocked mutation' });
    }
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      return route.fulfill({ status: 200, contentType: 'text/csv', body: [
        'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Dog ID,Dog Number,Stay ID',
        [booking.timestamp, booking.dogName, booking.breed, booking.startDate, booking.endDate, booking.ownerName, booking.phone, '', '', '', '', booking.bookingType, dogId, booking.dogNumber, stayId].join(',')
      ].join('\n') });
    }
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendar });
    }
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {};
      try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      if (resolved.action === 'sync_dog_master_photos_to_upcoming_stays' && callback) {
        photoSyncRequests.push({ action: resolved.action, payload });
        if (allowManualPhotoSync && payload.source === 'settings-manual-resync') {
          const mode = photoSyncResponses.shift() || 'success';
          if (mode === 'transport') return route.abort('failed');
          if (mode === 'identity-error') {
            const response = { result: 'error', error: 'Dog identity is ambiguous.' };
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
          }
          if (mode === 'missing-result') {
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}({});` });
          }
          if (mode === 'queued') {
            const response = { result: 'queued', queued: true, updatedCount: 0, skippedExistingCount: 0, missingMasterPhotoCount: 0, eligibleStayCount: 3 };
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
          }
          if (mode === 'invalid-count') {
            const response = { result: 'success', updatedCount: 1, skippedExistingCount: 0, missingMasterPhotoCount: 0 };
            return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
          }
          const response = { result: 'success', updatedCount: 1, skippedExistingCount: 2, missingMasterPhotoCount: 0, eligibleStayCount: 3, updatedStayKeys: [stayKey] };
          return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
        }
        blocked.push({ method: request.method(), action: resolved.action, reason: 'unapproved action' });
        return route.fulfill({ status: 403, body: 'Read-only fixture blocked action' });
      }
      if (!resolved.policy.allowed) {
        blocked.push({ method: request.method(), action: resolved.action, reason: resolved.policy.reason });
        return route.fulfill({ status: 403, body: 'Read-only fixture blocked action' });
      }
      actions.push({ action: resolved.action, payload });
      if (resolved.action === 'get_guest_directory' && directoryGate) await directoryGate;
      let response = { result: 'success', records: [] };
      if (resolved.action === 'maintenance_status') response = { result: 'success', enabled: false };
      if (resolved.action === 'get_guest_directory') response = { result: 'success', bookings: [booking], summaries: [{ stayKey }] };
      if (resolved.action === 'get_guest_profile') response = { result: 'success', record: {
        stayKey, identity: { stayKey, dogId, stayId }, resolution: { status: 'resolved' },
        intakeAttributes: profileAttributes, intakeAttributesSource: 'Synthetic saved profile', riskFlags: {}
      } };
      if (resolved.action === 'get_guest_belongings') response = { result: 'success', record: {
        stayKey, stayId, dogId, items: {}, photos: [], riskFlags: {},
        identityResolution: { status: 'resolved', identity: { stayKey, stayId, dogId } }
      } };
      if (resolved.action === 'get_data_versions') response = { result: 'success', versions: { belongings: 'fixture' } };
      const contentType = callback ? 'application/javascript' : 'application/json';
      const body = callback ? `${callback}(${JSON.stringify(response)});` : JSON.stringify(response);
      return route.fulfill({ status: 200, contentType, body });
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>' });
    }
    return route.continue();
  });
  return { actions, blocked, photoSyncRequests, stayKey };
}

async function openFixtureProfile(page, fixture, viewport = { width: 390, height: 844 }, theme = 'light') {
  const syncAttemptsBeforeLoad = fixture.photoSyncRequests.length;
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date('2026-10-13T12:00:00.000Z'));
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript(mode => localStorage.setItem('theme', mode), theme);
  await page.goto('http://127.0.0.1:4176/directory.html?detailedCareRuntime=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true', null, { timeout: 45000 });
  const card = page.locator('.directory-card[data-directory-stay-key]').first();
  await expect(card).toHaveCount(1, { timeout: 30000 });
  await card.locator('[data-open-directory-profile]').evaluate(button => button.click());
  await expect(card).toHaveClass(/is-profile-active/);
  await expect(card.locator('.directory-profile-intake-section')).toBeVisible();
  await expect.poll(() => fixture.actions.some(item => item.action === 'get_guest_profile')).toBe(true);
  // Startup background reads may finish after the profile render. Take the
  // ledger baseline only after they settle, and require zero startup writes.
  let previous = '';
  let stableSamples = 0;
  for (let sample = 0; sample < 40 && stableSamples < 4; sample += 1) {
    await page.waitForTimeout(250);
    const current = JSON.stringify([fixture.actions, fixture.blocked]);
    stableSamples = current === previous ? stableSamples + 1 : 0;
    previous = current;
  }
  expect(stableSamples, 'fixture action ledger did not settle').toBeGreaterThanOrEqual(4);
  expect(fixture.photoSyncRequests).toHaveLength(syncAttemptsBeforeLoad);
  return card;
}

test('Detailed Care toggles stay local and preserve drafts across Profile and Belongings', async ({ page }) => {
  const fixture = await installReadOnlyFixture(page);
  for (const width of [390, 1440]) {
    const card = await openFixtureProfile(page, fixture, { width, height: width === 390 ? 844 : 900 });
    await card.locator('[data-toggle-profile-edit]').click();
    const category = key => card.locator(`[data-profile-subtab="${key}"]`);
    const panel = key => card.locator(`[data-profile-subpanel="${key}"]`);
    const beforeFirstExpand = fixture.actions.map(item => item.action);
    const blockedAtSettle = JSON.stringify(fixture.blocked);
    await category('foodWalks').click();
    const afterFirstExpand = fixture.actions.map(item => item.action);
    expect(afterFirstExpand).toEqual(beforeFirstExpand);
    expect(JSON.stringify(fixture.blocked)).toBe(blockedAtSettle);
    const feeding = card.locator('[data-intake-attribute="feedingTimes"]');
    await expect(feeding).toBeVisible();
    await feeding.fill('Synthetic draft: breakfast at 06:45 with a full bowl of water.');
    const settledActions = fixture.actions.map(item => item.action);

    await category('healthHome').focus();
    await page.keyboard.press('Enter');
    const afterExpand = fixture.actions.map(item => item.action);
    const blockedAfterExpand = JSON.stringify(fixture.blocked);
    await category('healthHome').click();
    const afterCollapse = fixture.actions.map(item => item.action);
    expect(afterExpand).toEqual(settledActions);
    expect(afterCollapse).toEqual(settledActions);
    expect(blockedAfterExpand).toBe(blockedAtSettle);
    expect(JSON.stringify(fixture.blocked)).toBe(blockedAtSettle);
    await expect(category('foodWalks')).toHaveAttribute('aria-expanded', 'true');
    await expect(panel('foodWalks')).toBeVisible();
    await expect(category('healthHome')).toHaveAttribute('aria-expanded', 'false');
    await expect(panel('healthHome')).toBeHidden();

    await card.locator('[data-v11160-tab="belongings"]').click();
    await expect(card.locator('[data-v11160-tab="belongings"]')).toHaveAttribute('aria-selected', 'true');
    await card.locator('[data-v11160-tab="profile"]').click();
    await expect(card.locator('[data-v11160-tab="profile"]')).toHaveAttribute('aria-selected', 'true');
    const beforeKeyboardReopen = fixture.actions.map(item => item.action);
    await category('healthHome').focus();
    await page.keyboard.press('Space');
    await expect(category('healthHome')).toHaveAttribute('aria-expanded', 'true', `space key did not open: ${await category('healthHome').getAttribute('aria-expanded')}`);
    expect(fixture.actions.map(item => item.action)).toEqual(beforeKeyboardReopen);
    expect(JSON.stringify(fixture.blocked)).toBe(blockedAtSettle);
    await expect(category('foodWalks')).toHaveAttribute('aria-expanded', 'true');
    await expect(category('healthHome')).toHaveAttribute('aria-expanded', 'true');
    await expect(panel('foodWalks')).toBeVisible();
    await expect(panel('healthHome')).toBeVisible();
    await expect(feeding).toHaveValue('Synthetic draft: breakfast at 06:45 with a full bowl of water.');
  }
  console.log('DETAILED_CARE_LEDGER', JSON.stringify({ actions: fixture.actions.map(item => item.action), blocked: fixture.blocked }));
  assertNoUnexpectedBackendRequests(fixture);
  expect(fixture.blocked.filter(item => !['GET', 'HEAD'].includes(item.method))).toEqual([]);
});

test('Detailed Care enlarged text wraps at phone, tablet, and desktop widths in both themes', async ({ page }, testInfo) => {
  const fixture = await installReadOnlyFixture(page);
  for (const theme of ['light', 'dark']) {
    const card = await openFixtureProfile(page, fixture, { width: 390, height: 844 }, theme);
    for (const key of ['foodWalks', 'healthHome', 'behaviour', 'safety']) await card.locator(`[data-profile-subtab="${key}"]`).click();
    await card.locator('[data-toggle-profile-edit]').click();
    const baseline = await card.evaluate(root => ({
      title: parseFloat(getComputedStyle(root.querySelector('.care-category-title')).fontSize),
      summary: parseFloat(getComputedStyle(root.querySelector('.care-category-summary')).fontSize),
      label: parseFloat(getComputedStyle(root.querySelector('.intake-profile-field label')).fontSize),
      control: parseFloat(getComputedStyle(root.querySelector('.intake-profile-control')).fontSize)
    }));
    const fontScale = await page.addStyleTag({ content: `
      body[data-waffle-page="directory"] .directory-card.is-profile-active .care-category-title { font-size: ${baseline.title * 2}px !important; }
      body[data-waffle-page="directory"] .directory-card.is-profile-active .care-category-summary { font-size: ${baseline.summary * 2}px !important; }
      body[data-waffle-page="directory"] .directory-card.is-profile-active.is-profile-editing .directory-profile-intake-section .intake-profile-field label { font-size: ${baseline.label * 2}px !important; }
      body[data-waffle-page="directory"] .directory-card.is-profile-active.is-profile-editing .directory-profile-intake-section .intake-profile-control { font-size: ${baseline.control * 2}px !important; }
      .directory-card.is-profile-active .intake-profile-control { min-height: 44px !important; }
    ` });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 320 ? 380 : 844 });
      for (const accent of [
        '--wh75-accent:#7562db;--wh75-accent-ink:#4338ca;--wh75-accent-soft:#ede9fe',
        '--wh75-accent:#0f766e;--wh75-accent-ink:#115e59;--wh75-accent-soft:#ccfbf1',
        '--wh75-accent:#b45309;--wh75-accent-ink:#78350f;--wh75-accent-soft:#fef3c7'
      ]) {
        await page.evaluate(value => { document.documentElement.style.cssText += `;${value}`; }, accent);
        const metrics = await card.evaluate(root => {
          const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height, width: r.width }; };
          const lum = color => { const rgb = color.match(/[\d.]+/g).slice(0,3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
          const ratio = (fg, bg) => { const a = lum(fg), b = lum(bg); return (Math.max(a,b) + .05) / (Math.min(a,b) + .05); };
          const categories = [...root.querySelectorAll('.care-category-toggle')].map(button => {
            const title = button.querySelector('.care-category-title'), summary = button.querySelector('.care-category-summary'), chevron = button.querySelector('.care-category-chevron');
            const summaryStyle = getComputedStyle(summary), buttonStyle = getComputedStyle(button), rootStyle = getComputedStyle(root);
            const buttonBackground = buttonStyle.backgroundColor === 'rgba(0, 0, 0, 0)' ? rootStyle.backgroundColor : buttonStyle.backgroundColor;
            return { button: rect(button), title: rect(title), summary: rect(summary), chevron: rect(chevron), titleFont: parseFloat(getComputedStyle(title).fontSize), summaryFont: parseFloat(summaryStyle.fontSize), summaryColor: summaryStyle.color, buttonBackground, summaryContrast: ratio(summaryStyle.color, buttonBackground), expanded: button.getAttribute('aria-expanded'), panel: root.querySelector(`#${CSS.escape(button.getAttribute('aria-controls'))}`)?.hidden };
          });
          const controls = [...root.querySelectorAll('.intake-profile-control')].filter(el => el.getBoundingClientRect().width > 0);
          const labels = [...root.querySelectorAll('.intake-profile-field label')].filter(el => el.getBoundingClientRect().width > 0);
          return { categories, controls: controls.map(el => ({ font: parseFloat(getComputedStyle(el).fontSize), rect: rect(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight })), labels: labels.map(el => ({ font: parseFloat(getComputedStyle(el).fontSize), rect: rect(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })), pageWidth: document.documentElement.scrollWidth, viewport: innerWidth };
        });
        const context = `${theme} ${width}px ${accent} ${JSON.stringify(metrics)}`;
        expect(metrics.pageWidth, context).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.categories.every(item => item.button.height >= 44 && item.titleFont >= baseline.title * 2 - .1 && item.summaryFont >= baseline.summary * 2 - .1), context).toBe(true);
        expect(metrics.categories.every(item => item.title.right <= item.chevron.left + 1 && item.summary.right <= item.chevron.left + 1 && item.title.top >= item.button.top && item.summary.bottom <= item.button.bottom), context).toBe(true);
        expect(metrics.categories.every(item => item.expanded === 'true' && item.panel === false), context).toBe(true);
        expect(metrics.controls.every(item => item.font >= baseline.control * 2 - .1 && item.font >= 16 && item.rect.right <= width && item.scrollWidth <= item.clientWidth + 1), context).toBe(true);
        expect(metrics.labels.every(item => item.font >= baseline.label * 2 - .1 && item.rect.right <= width && item.scrollWidth <= item.clientWidth + 1), context).toBe(true);
        expect(metrics.categories.every(item => item.summaryContrast >= 4.5), context).toBe(true);
        if (width === 320 && accent.includes('#7562db')) {
          const save = card.locator('.directory-profile-save-bar');
          await save.scrollIntoViewIfNeeded();
          const box = await save.boundingBox();
          const navigation = page.locator('nav[aria-label="Primary mobile navigation"]');
          const navBox = await navigation.boundingBox();
          expect(navBox, 'fixed mobile navigation should be visible at the short viewport').not.toBeNull();
          const reachableActions = [save.locator('button').first(), card.locator('[data-cancel-profile-edit]')];
          for (const button of reachableActions) {
            await expect(button).toBeVisible();
            const buttonBox = await button.boundingBox();
            expect(buttonBox.y, `save action starts above visible navigation: ${JSON.stringify({ buttonBox, navBox })}`).toBeLessThan(navBox.y);
            expect(buttonBox.y + buttonBox.height, `save action clears visible navigation: ${JSON.stringify({ buttonBox, navBox })}`).toBeLessThanOrEqual(navBox.y);
          }
          expect(box.y + box.height).toBeLessThanOrEqual(navBox.y);
        }
      }
    }
    await fontScale.evaluate(style => style.remove());
    await card.locator('[data-cancel-profile-edit]').click();
  }
  assertNoUnexpectedBackendRequests(fixture);
  expect(fixture.blocked.filter(item => !['GET', 'HEAD'].includes(item.method))).toEqual([]);
  await page.waitForTimeout(1200);
  const settingsPanel = page.locator('#wh75SettingsPanel');
  await expect(settingsPanel).not.toHaveClass(/is-open/);
  expect(await settingsPanel.evaluate(el => getComputedStyle(el).opacity)).toBe('0');
  expect(await settingsPanel.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  await page.screenshot({ path: testInfo.outputPath('detailed-care-enlarged-text.png'), fullPage: true, animations: 'disabled' });
});

test('Belongings and Photos reuse one verified stay read in the full Care runtime', async ({ page }) => {
  const fixture = await installReadOnlyFixture(page);
  const card = await openFixtureProfile(page, fixture);
  await card.locator('[data-v11160-tab="belongings"]').click();
  await expect(card.locator('[data-directory-detail="belongings"]')).toHaveAttribute('data-detail-loaded', 'true');
  await card.locator('[data-v11160-tab="media"]').click();
  await expect(card.locator('[data-v110-media-host]')).toContainText('Photos for this dog and stay');
  expect(fixture.actions.filter(item => item.action === 'get_guest_belongings')).toHaveLength(1);
  await card.locator('[data-v11160-tab="belongings"]').click();
  await card.locator('[data-v11160-tab="media"]').click();
  expect(fixture.actions.filter(item => item.action === 'get_guest_belongings')).toHaveLength(1);
  assertNoUnexpectedBackendRequests(fixture);
});

test('focus revalidation applies newer Care data and preserves an unsaved feeding draft', async ({ page }) => {
  const profileAttributes = { ...longProfile };
  const fixture = await installReadOnlyFixture(page, { profileAttributes });
  const card = await openFixtureProfile(page, fixture);
  const count = () => fixture.actions.filter(item => item.action === 'get_guest_profile').length;
  const advanceFreshness = () => page.evaluate(() => {
    if (!window.__careFreshnessClock) {
      const original = performance.now.bind(performance);
      window.__careFreshnessClock = { offset: 0 };
      Object.defineProperty(performance, 'now', { configurable: true, value: () => original() + window.__careFreshnessClock.offset });
    }
    window.__careFreshnessClock.offset += 46000;
    window.dispatchEvent(new Event('focus'));
  });
  const before = count();
  profileAttributes.feedingTimes = 'Updated on another device: dinner at 19:15';
  await advanceFreshness();
  await expect.poll(count).toBe(before + 1);
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state', 'fresh');
  await card.locator('[data-toggle-profile-edit]').click();
  await card.locator('[data-profile-subtab="foodWalks"]').click();
  const feeding = card.locator('[data-intake-attribute="feedingTimes"]');
  await expect(feeding).toHaveValue(profileAttributes.feedingTimes);
  await feeding.fill('Unsaved local draft: breakfast at 07:15');
  const beforeDraftRefresh = count();
  profileAttributes.feedingTimes = 'Second remote change: dinner at 20:00';
  await advanceFreshness();
  await expect.poll(count).toBe(beforeDraftRefresh + 1);
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-profile-read-state', 'fresh');
  await expect(feeding).toHaveValue('Unsaved local draft: breakfast at 07:15');
  assertNoUnexpectedBackendRequests(fixture);
});

test('Care startup defers quiet notifications and AI health until the directory settles', async ({ page }) => {
  let releaseDirectory;
  const directoryGate = new Promise(resolve => { releaseDirectory = resolve; });
  const fixture = await installReadOnlyFixture(page, { directoryGate });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4176/directory.html?startupPriority=1', { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => !!window.WAFFLE_CARE_STARTUP && typeof window.v11148WaffleAiHealth === 'function');
    await expect.poll(() => fixture.actions.some(item => item.action === 'get_guest_directory')).toBe(true);
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow')); });
    // The former quiet notification timer fired at 1400 ms regardless of roster readiness.
    await page.waitForTimeout(1800);
    expect(fixture.actions.filter(item => ['get_notification_centre', 'waffle_ai_health'].includes(item.action))).toEqual([]);
    releaseDirectory();
    await expect.poll(() => fixture.actions.some(item => item.action === 'get_notification_centre')).toBe(true);
    await expect.poll(() => fixture.actions.some(item => item.action === 'waffle_ai_health')).toBe(true);
    expect(fixture.actions.filter(item => item.action === 'waffle_ai_health')).toHaveLength(1);
    expect(fixture.photoSyncRequests).toHaveLength(0);
    assertNoUnexpectedBackendRequests(fixture);
  } finally { releaseDirectory(); }
});

test('explicit notification opening bypasses the pending Care startup queue', async ({ page }) => {
  let releaseDirectory;
  const directoryGate = new Promise(resolve => { releaseDirectory = resolve; });
  const fixture = await installReadOnlyFixture(page, { directoryGate });
  await page.goto('http://127.0.0.1:4176/directory.html?startupExplicit=1', { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => !!window.WAFFLE_CARE_STARTUP && typeof window.openWaffleNotificationCentre === 'function');
    await expect.poll(() => fixture.actions.some(item => item.action === 'get_guest_directory')).toBe(true);
    await page.evaluate(() => window.openWaffleNotificationCentre());
    await expect.poll(() => fixture.actions.some(item => item.action === 'get_notification_centre')).toBe(true);
    await expect(page.locator('#waffleNotificationModal')).toBeVisible();
    expect(fixture.actions.some(item => item.action === 'waffle_ai_health')).toBe(false);
    assertNoUnexpectedBackendRequests(fixture);
  } finally { releaseDirectory(); }
});

test('Settings photo resync runs only after a deliberate user action', async ({ page }) => {
  const fixture = await installReadOnlyFixture(page, { allowManualPhotoSync: true });
  const card = await openFixtureProfile(page, fixture);
  expect(fixture.photoSyncRequests).toHaveLength(0);
  await page.locator('[data-wh75-settings]').first().evaluate(button => button.click());
  const button = page.locator('[data-v11216-master-photo-resync]');
  await expect(button).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await button.click();
  await expect.poll(() => fixture.photoSyncRequests.length, 'explicit Settings click should issue one synthetic sync request').toBe(1);
  await expect(page.locator('[data-v11216-master-photo-resync-status]')).toContainText('1 updated');
  expect(fixture.photoSyncRequests).toHaveLength(1);
  expect(fixture.photoSyncRequests[0].payload.source).toBe('settings-manual-resync');
  expect(fixture.blocked).toEqual([]);
  await expect(card.locator('.directory-profile-intake-section')).toBeVisible();
});

test('Settings resync stays offline-safe and identity errors never offer blind retry', async ({ page }) => {
  const fixture = await installReadOnlyFixture(page, { allowManualPhotoSync: true, photoSyncResponses: ['identity-error', 'missing-result', 'queued', 'invalid-count'] });
  await openFixtureProfile(page, fixture);
  await page.locator('[data-wh75-settings]').first().evaluate(button => button.click());
  const button = page.locator('[data-v11216-master-photo-resync]');
  await expect(button).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }));
  page.on('dialog', dialog => dialog.accept());
  await button.click();
  await expect(page.locator('[data-v11216-master-photo-resync-status]')).toContainText('while offline');
  expect(fixture.photoSyncRequests).toHaveLength(0);
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }));
  await button.click();
  const status = page.locator('[data-v11216-master-photo-resync-status]');
  await expect(status).toContainText('Dog identity is ambiguous');
  await expect(status).toHaveAttribute('role', 'alert');
  await expect(page.locator('[data-v11216-master-photo-resync-retry]')).toHaveCount(0);
  await button.click();
  await expect(status).toContainText('unknown error');
  await expect(page.locator('[data-v11216-master-photo-resync-retry]')).toHaveCount(0);
  await button.click();
  await expect(status).toContainText('unknown error');
  await expect(page.locator('[data-v11216-master-photo-resync-retry]')).toHaveCount(0);
  await button.click();
  await expect(status).toContainText('Resync stopped');
  await expect(page.locator('[data-v11216-master-photo-resync-retry]')).toHaveCount(0);
  expect(fixture.photoSyncRequests).toHaveLength(4);
});

test('Settings offers a focused deliberate Retry for transport failures and locks duplicate attempts', async ({ page }) => {
  const fixture = await installReadOnlyFixture(page);
  await openFixtureProfile(page, fixture);
  await page.locator('[data-wh75-settings]').first().evaluate(button => button.click());
  const button = page.locator('[data-v11216-master-photo-resync]');
  await expect(button).toBeVisible();
  await page.evaluate(() => {
    window.__manualPhotoSyncCalls = 0;
    window.sendPayloadToAppsScript = async payload => {
      if (payload?.action !== 'sync_dog_master_photos_to_upcoming_stays' || payload?.source !== 'settings-manual-resync') throw new Error('Unexpected synthetic request');
      window.__manualPhotoSyncCalls += 1;
      if (window.__manualPhotoSyncCalls === 1) {
        const error = new TypeError('Network request failed');
        error.code = 'NETWORK_ERROR';
        throw error;
      }
      return { result: 'success', updatedCount: 1, skippedExistingCount: 2, missingMasterPhotoCount: 0, eligibleStayCount: 3, updatedStayKeys: [] };
    };
  });
  page.on('dialog', dialog => dialog.accept());
  await button.click();
  const retry = page.locator('[data-v11216-master-photo-resync-retry]');
  await expect(retry).toBeFocused();
  await retry.evaluate(el => { el.click(); el.click(); });
  await expect(page.locator('[data-v11216-master-photo-resync-status]')).toContainText('1 updated');
  expect(await page.evaluate(() => window.__manualPhotoSyncCalls)).toBe(2);
  expect(fixture.photoSyncRequests).toHaveLength(0);
});
