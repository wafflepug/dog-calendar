const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fs = require('node:fs');
const path = require('node:path');

const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const careRuntime = fs.readFileSync(path.join(__dirname, '..', 'care.js'), 'utf8');
const fallbackMedia = careRuntime.match(/async function fallbackMedia\(card\) \{[\s\S]*?\n  \}/)?.[0];
const fallbackToggle = careRuntime.match(/function toggleMediaGroup\(button\) \{[\s\S]*?\n  \}/)?.[0];
const evidenceDir = path.join(__dirname, '..', 'output', 'releases', '2026.10.14.02', 'evidence');
fs.mkdirSync(evidenceDir, { recursive: true });

const dogId = '11111111-1111-4111-8111-111111111111';
const stayId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const booking = {
  timestamp: '2026-10-01', dogName: 'Milo Longtail', breed: 'Border Collie',
  startDate: '2026-10-02', endDate: '2026-10-06', ownerName: 'Alexandria Peterson-Smith',
  phone: '0400123456', notes: 'Please keep the full stay handover available.', bookingType: 'Boarding',
  dogId, stayId, dogNumber: '#00017'
};
const longNote = 'Keep the measured meal portions and report any appetite change. '.repeat(4);
const history = {
  dogId, dogNumber: '#00017', stayCount: 4,
  owners: [{ ownerName: 'Alexandria Peterson-Smith', phone: '0400123456' }],
  previousStays: [
    { startDate: '2026-03-10', endDate: '2026-03-14', bookingType: 'Boarding', breed: 'Border Collie', ownerName: 'Alexandria Peterson-Smith', phone: '0400123456', notes: 'Most recent year note.', careChanges: [{ date: '2026-03-11', source: 'sitter review' }] },
    { startDate: '2025-10-08', endDate: '2025-10-13', actualCheckoutDate: '2025-10-11', bookingType: 'Boarding', breed: 'Border Collie', ownerName: 'Alexandria Peterson-Smith', phone: '0400123456', notes: longNote },
    { startDate: '2024-02-02', endDate: '2024-02-04', bookingType: 'Day stay', breed: 'Border Collie', ownerName: 'Alexandria Peterson-Smith', phone: '0400123456' },
    { startDate: '', endDate: '2010-01-04', actualCheckoutDate: '2009-12-30', bookingType: 'Legacy stay', breed: 'Border Collie', ownerName: 'Alexandria Peterson-Smith', phone: '0400123456', notes: 'Undated visit remains available.' }
  ]
};

async function installReadOnlyFixture(page) {
  const actionReads = [];
  await page.clock.install({ time: new Date('2026-10-14T12:00:00Z') });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Read-only fixture blocked mutation' });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      const csv = 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n' +
        [booking.timestamp, booking.dogName, booking.breed, '02/10/2026', '06/10/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', booking.bookingType, 'Other', dogId, stayId, '#00017'].join(',');
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
      const action = resolved.action;
      actionReads.push({ action, payload });
      const stayKey = `${booking.dogName.toLowerCase()}|2026-10-02|2026-10-06`;
      let response = { result: 'success', records: [] };
      if (action === 'get_guest_directory') response = { result: 'success', bookings: [booking], summaries: [{ stayKey }] };
      if (action === 'get_guest_profile') response = { result: 'success', record: { stayKey: payload.stayKey || stayKey, identity: { stayKey: payload.stayKey || stayKey, stayId, dogId }, resolution: { status: 'resolved', method: 'fixture' }, intakeAttributes: {} } };
      if (action === 'get_guest_belongings') response = { result: 'success', record: {
        stayKey: payload.stayKey || stayKey,
        identityResolution: { status: 'resolved', identity: { stayKey: payload.stayKey || stayKey, stayId, dogId } },
        dogPhotoGallery: [{ id: 'profile-1', label: 'Profile portrait', previewUrl: 'https://photos.test/profile.jpg' }],
        stayPhotos: [{ id: 'stay-1', label: 'Playtime', previewUrl: 'https://photos.test/stay.jpg' }], photos: []
      } };
      if (action === 'get_dog_history') response = { result: 'success', history };
      if (callback) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') {
      const type = request.resourceType();
      return route.fulfill({ status: 200, contentType: type === 'stylesheet' ? 'text/css' : type === 'script' ? 'application/javascript' : 'image/svg+xml', body: type === 'stylesheet' || type === 'script' ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' });
    }
    return route.continue();
  });
  return actionReads;
}

test('selected Care keeps gallery group state and organizes history by visit start year', async ({ page, baseURL, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'light' });
  const actionReads = await installReadOnlyFixture(page);
  await page.goto(`${baseURL}/directory.html?galleryHistoryPolish=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  await page.locator('[data-v1082-stay-tab="past"]').click();
  const card = page.locator('.directory-card[data-directory-stay-key]');
  await expect(card).toHaveCount(1);
  await expect.poll(() => actionReads.filter(item => ['get_guest_belongings', 'get_dog_history'].includes(item.action)).length).toBe(0);
  await card.locator('[data-open-directory-profile]').click();
  const profile = page.locator('.directory-card.is-profile-active');
  const nav = profile.locator('.v11160-desktop-tabs');
  const mediaTab = nav.locator('[data-v11160-tab="media"]');
  await mediaTab.click();
  const media = profile.locator('[data-v110-media-host]');
  await expect(media.locator('.v110-media-section')).toHaveCount(3);
  await expect(media.locator('.v110-media-heading h4')).toHaveText('Photos');
  await expect(media.locator('.v110-media-heading p')).toHaveText('Profile photos follow the dog; stay and belongings photos belong to this visit.');
  await expect(media.getByRole('button', { name: '＋ Add Stay Photos' })).toBeVisible();
  const groupButtons = media.locator('[data-v110-media-toggle]');
  await expect(groupButtons).toHaveCount(3);
  await expect.poll(() => groupButtons.first().locator('strong').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(14);
  await expect.poll(() => groupButtons.first().locator('small').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12);
  if (browserName === 'chromium') fs.writeFileSync(path.join(evidenceDir, 'gallery-layout.json'), JSON.stringify(await media.evaluate(host => ({
    headingFont: getComputedStyle(host.querySelector('h4')).fontSize,
    titleFont: getComputedStyle(host.querySelector('.v110-media-section-title strong')).fontSize,
    copyFont: getComputedStyle(host.querySelector('.v110-media-section-title small')).fontSize,
    buttonHeight: host.querySelector('.v110-media-section-title').getBoundingClientRect().height,
    stylesheets: [...document.styleSheets].map(sheet => sheet.href)
  })), null, 2));
  const controls = await groupButtons.evaluateAll(buttons => buttons.map(button => ({
    tag: button.tagName,
    controls: button.getAttribute('aria-controls'),
    expanded: button.getAttribute('aria-expanded'),
    hidden: document.getElementById(button.getAttribute('aria-controls'))?.hidden,
    count: button.querySelector('.v110-media-count')?.textContent
  })));
  expect(controls.map(item => item.tag)).toEqual(['BUTTON', 'BUTTON', 'BUTTON']);
  expect(controls.every(item => item.controls && item.hidden === (item.expanded !== 'true'))).toBeTruthy();
  expect(controls.map(item => item.count)).toEqual(['1', '1', '0']);
  const beforeDisclosureReads = actionReads.filter(item => item.action === 'get_guest_belongings').length;
  await groupButtons.nth(0).focus();
  await page.keyboard.press('Enter');
  await expect(groupButtons.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await groupButtons.nth(2).click();
  await expect(groupButtons.nth(2)).toHaveAttribute('aria-expanded', 'true');
  expect(actionReads.filter(item => item.action === 'get_guest_belongings')).toHaveLength(beforeDisclosureReads);

  if (browserName === 'chromium' && process.env.WAFFLE_CAPTURE_UI_EVIDENCE === '1') await media.screenshot({ path: path.join(evidenceDir, 'care-gallery-phone-390.png'), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });
  if (browserName === 'chromium' && process.env.WAFFLE_CAPTURE_UI_EVIDENCE === '1') await media.screenshot({ path: path.join(evidenceDir, 'care-gallery-desktop-1440.png'), fullPage: false });

  const beforeRefresh = actionReads.filter(item => item.action === 'get_guest_belongings').length;
  await groupButtons.nth(0).focus();
  await page.evaluate(() => window.v110LoadMedia(document.querySelector('.directory-card.is-profile-active'), { force: true }));
  await expect.poll(() => actionReads.filter(item => item.action === 'get_guest_belongings').length).toBeGreaterThan(beforeRefresh);
  await expect(groupButtons.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(groupButtons.nth(0)).toBeFocused();
  await expect(groupButtons.nth(2)).toHaveAttribute('aria-expanded', 'true');
  await expect(media.locator('.v110-media-count')).toHaveText(['1', '1', '0']);
  const historyTab = nav.locator('[data-v11160-tab="history"]');
  await historyTab.focus();
  await page.evaluate(() => window.v110RenderMedia(document.querySelector('.directory-card.is-profile-active'), { dogPhotoGallery: [{ id: 'profile-1', label: 'Profile portrait', previewUrl: 'https://photos.test/profile.jpg' }], stayPhotos: [{ id: 'stay-1', label: 'Playtime', previewUrl: 'https://photos.test/stay.jpg' }], photos: [] }));
  await expect(historyTab).toBeFocused();

  await page.evaluate(([nextDogId, nextStayId]) => {
    const card = document.querySelector('.directory-card.is-profile-active');
    const host = card.querySelector('[data-v110-media-host]');
    card.dataset.directoryDogId = nextDogId;
    host.dataset.v110StayKey = `${nextStayId}::${nextDogId}::${card.dataset.directoryStayKey}`;
    window.v110RenderMedia(card, { dogPhotoGallery: [{ id: 'profile-1', label: 'Profile portrait', previewUrl: 'https://photos.test/profile.jpg' }], stayPhotos: [{ id: 'stay-1', label: 'Playtime', previewUrl: 'https://photos.test/stay.jpg' }], photos: [] });
  }, ['22222222-2222-4222-8222-222222222222', stayId]);
  await expect(groupButtons.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(groupButtons.nth(2)).toHaveAttribute('aria-expanded', 'false');
  await page.evaluate(([originalDogId, originalStayId]) => {
    const card = document.querySelector('.directory-card.is-profile-active');
    const host = card.querySelector('[data-v110-media-host]');
    card.dataset.directoryDogId = originalDogId;
    host.dataset.v110StayKey = `${originalStayId}::${originalDogId}::${card.dataset.directoryStayKey}`;
    window.v110RenderMedia(card, { dogPhotoGallery: [{ id: 'profile-1', label: 'Profile portrait', previewUrl: 'https://photos.test/profile.jpg' }], stayPhotos: [{ id: 'stay-1', label: 'Playtime', previewUrl: 'https://photos.test/stay.jpg' }], photos: [] });
  }, [dogId, stayId]);

  const beforeHistory = actionReads.filter(item => item.action === 'get_dog_history').length;
  await historyTab.click();
  const historyHost = profile.locator('[data-v108-history]');
  await expect(historyHost.locator('.v108-history-year-group')).toHaveCount(4);
  await expect.poll(() => actionReads.filter(item => item.action === 'get_dog_history').length).toBeGreaterThan(beforeHistory);
  const yearGroups = historyHost.locator('.v108-history-year-group');
  await expect(yearGroups.nth(0)).toHaveAttribute('data-history-year', '2026');
  await expect(yearGroups.nth(0)).toHaveAttribute('open', '');
  await expect(yearGroups.nth(1)).toHaveAttribute('data-history-year', '2025');
  await expect(yearGroups.nth(1)).not.toHaveAttribute('open', '');
  await expect(yearGroups.nth(2)).toHaveAttribute('data-history-year', '2024');
  await expect(yearGroups.nth(2)).not.toHaveAttribute('open', '');
  await expect(yearGroups.nth(3).locator(':scope > summary')).toContainText('Undated stays');
  await expect(yearGroups.nth(3)).toHaveAttribute('open', '');
  await expect(historyHost).toContainText('Alexandria Peterson-Smith');
  await expect(historyHost.locator('a[href="tel:0400123456"]')).toHaveCount(5);
  await expect(yearGroups.nth(1).locator('.v108-stay-history')).toContainText('Checked out');
  await expect(yearGroups.nth(1).locator('.v108-stay-history')).toContainText('Originally scheduled');
  await expect(yearGroups.nth(1).locator('.v108-stay-history')).toContainText(longNote.trim());
  await expect(yearGroups.nth(1).locator('.v108-stay-history>details')).not.toHaveAttribute('open', '');
  await page.keyboard.press('Tab');
  await yearGroups.nth(1).locator(':scope > summary').focus();
  await expect(yearGroups.nth(1).locator(':scope > summary')).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(yearGroups.nth(1)).toHaveAttribute('open', '');
  await page.evaluate(fixtureHistory => window.v108RenderHistory(document.querySelector('.directory-card.is-profile-active [data-v108-history]'), fixtureHistory), history);
  await expect(historyHost.locator('.v108-history-year-group').nth(1)).toHaveAttribute('open', '');
  await page.evaluate(fixtureHistory => window.v108RenderHistory(document.querySelector('.directory-card.is-profile-active [data-v108-history]'), { ...fixtureHistory, dogId: '22222222-2222-4222-8222-222222222222' }), history);
  await expect(historyHost.locator('.v108-history-year-group').nth(0)).toHaveAttribute('open', '');
  await expect(historyHost.locator('.v108-history-year-group').nth(1)).not.toHaveAttribute('open', '');
  await expect(yearGroups.nth(3).locator('.v108-stay-history')).toContainText('Stay date unavailable');
  await expect(yearGroups.nth(3).locator('.v108-stay-history')).toContainText('Undated visit remains available.');
  await expect(yearGroups.nth(3)).not.toHaveAttribute('data-history-year', '2010');
  expect(actionReads.filter(item => item.action === 'get_dog_history')).toHaveLength(beforeHistory + 1);

  await page.setViewportSize({ width: 390, height: 844 });
  if (browserName === 'chromium' && process.env.WAFFLE_CAPTURE_UI_EVIDENCE === '1') await page.screenshot({ path: path.join(evidenceDir, 'care-history-phone-390.png'), fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(historyHost.locator('.v108-history-year-group')).toHaveCount(4);
  await expect(historyHost.locator('.v108-history-year-group').first()).toBeVisible();
  if (browserName === 'chromium' && process.env.WAFFLE_CAPTURE_UI_EVIDENCE === '1') await historyHost.locator('.v108-history-year-group').first().screenshot({ path: path.join(evidenceDir, 'care-history-desktop-1440.png') });
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    await page.locator('body').evaluate((body, dark) => body.classList.toggle('dark-theme', dark), colorScheme === 'dark');
    const bounds = await historyHost.evaluate(element => ({ width: element.scrollWidth, client: element.clientWidth }));
    expect(bounds.width).toBeLessThanOrEqual(bounds.client + 1);
  }
});

test('fallback Photos renderer preserves disclosure state only for the same full stay and dog identity', async ({ page }) => {
  expect(fallbackMedia).toBeTruthy();
  expect(fallbackToggle).toBeTruthy();
  await page.setContent('<article class="directory-card" data-directory-stay-id="stay-a" data-directory-dog-id="dog-a" data-directory-stay-key="shared-legacy-key"><div data-v110-media-host></div></article>');
  await page.addScriptTag({ content: `
    function panel(card) { return card.querySelector('[data-v110-media-host]'); }
    function html(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
    window.WAFFLE_CARE_BELONGINGS_READS = { read: async (_card, options) => { const record = { dogPhotoGallery:[{id:'p1',label:'Profile',url:'https://photos.test/p.jpg'}], stayPhotos:[{id:'s1',label:'Stay',url:'https://photos.test/s.jpg'}], photos:[] }; options.onFresh({record}); return {data:{record}}; } };
    ${fallbackMedia}
    ${fallbackToggle}
    document.addEventListener('click', event => { const button = event.target.closest('[data-v110-media-toggle]'); if (button) toggleMediaGroup(button); });
  ` });
  await page.evaluate(() => fallbackMedia(document.querySelector('.directory-card')));
  const host = page.locator('[data-v110-media-host]');
  const groups = host.locator('[data-v110-media-toggle]');
  await expect(groups).toHaveCount(3);
  await groups.nth(0).click();
  await groups.nth(2).click();
  await expect(groups.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(groups.nth(2)).toHaveAttribute('aria-expanded', 'true');
  const controls = await groups.evaluateAll(buttons => buttons.map(button => ({ controls: button.getAttribute('aria-controls'), hidden: document.getElementById(button.getAttribute('aria-controls'))?.hidden })));
  expect(controls.every(item => item.controls && item.hidden !== undefined)).toBeTruthy();
  await groups.nth(0).focus();
  await page.evaluate(() => fallbackMedia(document.querySelector('.directory-card')));
  await expect(groups.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(groups.nth(0)).toBeFocused();
  await expect(groups.nth(2)).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.directory-card').evaluate(card => { card.dataset.directoryDogId = 'dog-b'; });
  await page.evaluate(() => fallbackMedia(document.querySelector('.directory-card')));
  await expect(groups.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(groups.nth(2)).toHaveAttribute('aria-expanded', 'false');
});
