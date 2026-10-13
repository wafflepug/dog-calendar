const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

test.setTimeout(120_000);

const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const bookings = [
  { timestamp: '2026-09-18', dogName: 'Milo', breed: 'Border Collie', startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Alex Owner', phone: '0400000001', notes: 'Saved Milo care note', bookingType: 'Boarding' },
  { timestamp: '2026-09-18', dogName: 'Nala', breed: 'Labrador', startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Bea Owner', phone: '0400000002', notes: 'Saved Nala care note', bookingType: 'Boarding' }
];
const stayKey = booking => `${booking.dogName.toLowerCase()}|${booking.startDate}|${booking.endDate}`;
const csv = () => ['Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type', ...bookings.map(b => [b.timestamp, b.dogName, b.breed, '17/09/2026', '22/09/2026', b.ownerName, b.phone, '', '', b.notes, '', b.bookingType].join(','))].join('\n');

function installFixture(page) {
  const calls = new Map();
  const requests = new Map();
  const fixtureItems = {
    waterBowls: { present: true, description: 'Blue enamel pair' },
    medication: { present: false, description: 'Evening tablet in a sealed pouch' }
  };
  const photo = { id: 'fixture-bag-photo', label: 'Packed bag', previewUrl: 'https://images.test/bag.svg', driveUrl: 'https://images.test/bag.svg' };
  const handler = async route => {
    const request = route.request();
    const url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Synthetic fixture only' });
    if (new URL(url).hostname === '127.0.0.1') return route.continue();
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) return route.fulfill({ status: 200, contentType: 'text/csv', body: csv() });
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendar });
    if (url.includes('script.google.com')) {
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {};
      try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      const action = String(resolved.action || payload.action || params.get('action') || '');
      if (action === 'save_belongings') {
        if (String(payload.stayKey || '') !== stayKey(bookings[0])) return route.fulfill({ status: 409, body: 'Synthetic save identity mismatch' });
        calls.set(action, (calls.get(action) || 0) + 1);
        requests.set(action, [...(requests.get(action) || []), payload]);
        Object.assign(fixtureItems, payload.items || {});
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify({ result: 'success' })});` });
      }
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: `Unapproved fixture action blocked: ${resolved.policy.reason}` });
      calls.set(action, (calls.get(action) || 0) + 1);
      requests.set(action, [...(requests.get(action) || []), payload]);
      let response = { result: 'success', records: [], enabled: false };
      if (action === 'get_guest_directory') response = {
        result: 'success', bookings,
        summaries: bookings.map(b => ({ stayKey: stayKey(b), riskFlags: b.dogName === 'Milo' ? { foodAllergy: true } : {} })),
        digitalIntakes: [], legacyIntakes: []
      };
      if (action === 'get_guest_profile') {
        const key = String(payload.stayKey || params.get('stayKey') || '');
        response = { result: 'success', record: { stayKey: key, identity: { stayKey: key, stayId: '', dogId: '' }, resolution: { status: 'resolved', method: 'legacy-key-unique' }, intakeAttributes: {}, dogPhoto: null, dogPhotoGallery: [], stayPhotos: [] } };
      }
      if (action === 'get_belongings' || action === 'get_guest_belongings') {
        const key = String(payload.stayKey || params.get('stayKey') || stayKey(bookings[0]));
        response = { result: 'success', record: {
          stayKey: key,
          identity: { stayKey: key, stayId: '', dogId: '' },
          identityResolution: { status: 'resolved', identity: { stayKey: key, stayId: '', dogId: '' } },
          items: JSON.parse(JSON.stringify(fixtureItems)), photos: [photo], riskFlags: {}, dogPhoto: null
        } };
      }
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
    }
    if (/^https?:/.test(url)) return route.fulfill({ status: 200, contentType: url.match(/\.css(?:\?|$)/) ? 'text/css' : 'image/svg+xml', body: url.match(/\.css(?:\?|$)/) ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#ddd"/></svg>' });
    return route.continue();
  };
  page.on('request', request => {
    if (request.url().includes('script.google.com') && !['GET', 'HEAD'].includes(request.method())) throw new Error(`Unexpected external write: ${request.method()}`);
  });
  return { calls, requests, handler };
}

async function openBelongings(page, baseURL, fixture, width = 390, theme = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixedNow = NativeDate.UTC(2026, 8, 18, 12, 0, 0);
    function FixedDate(...args) { if (!new.target) return new NativeDate(fixedNow).toString(); return Reflect.construct(NativeDate, args.length ? args : [fixedNow], new.target); }
    FixedDate.prototype = NativeDate.prototype;
    Object.setPrototypeOf(FixedDate, NativeDate);
    FixedDate.now = () => fixedNow;
    globalThis.Date = FixedDate;
  });
  await page.addInitScript(mode => localStorage.setItem('theme', mode), theme);
  await page.route('**/*', fixture.handler);
  await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  const card = page.locator('.directory-card[data-directory-dog-name="Milo"]');
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  const belongingsTab = card.locator('[data-v11160-tab="belongings"]');
  if (await belongingsTab.count()) await belongingsTab.click();
  else await card.locator('[data-directory-main-tab="belongings"]').click();
  await expect(card.locator('[data-directory-detail="belongings"]')).toHaveAttribute('data-detail-loaded', 'true');
  await expect(card.locator('[data-belongings-summary]')).toBeVisible();
  return { card, host: card.locator('[data-directory-belongings]') };
}

test('belongings summary and collapsed edit/photo details stay compact, truthful, and keyboard usable', async ({ page, baseURL }) => {
  const fixture = installFixture(page);
  const { card, host } = await openBelongings(page, baseURL, fixture);
  const evidenceDir = process.env.CARE_ITEMS_EVIDENCE_DIR;
  if (evidenceDir) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    await host.screenshot({ path: path.join(evidenceDir, 'care-items-390-light.png'), animations: 'disabled' });
  }
  await expect(host.locator('[data-belongings-summary-count]')).toHaveText('1 marked present · 9 checklist items');
  await expect(host.locator('[data-belongings-summary]')).toContainText('Water Bowls');
  await expect(host.locator('[data-belongings-summary]')).toContainText('Blue enamel pair');
  await expect(host.locator('[data-belongings-summary]')).toContainText('Medication');
  await expect(host.locator('[data-belongings-summary]')).toContainText('Not marked present');
  await expect(host.locator('[data-belongings-summary]')).toContainText('Evening tablet in a sealed pouch');
  await expect(host.locator('[data-belongings-checklist-details]')).not.toHaveAttribute('open', '');
  await expect(host.locator('[data-belongings-photo-tools-details]')).not.toHaveAttribute('open', '');
  await expect(host.locator('.belongings-photo-gallery')).toContainText('Packed bag');
  await host.locator('.belongings-photo-caption').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 110));
  const photoReachability = await host.locator('.belongings-photo-caption').evaluate(node => {
    const footer = document.getElementById('wh75MobileBottomNav');
    const box = footer?.getBoundingClientRect();
    return { bottom: node.getBoundingClientRect().bottom, footerTop: box?.height ? box.top : innerHeight };
  });
  expect(photoReachability.bottom).toBeLessThanOrEqual(photoReachability.footerTop);
  await expect(host.locator('[data-upload-belongings-photo]')).toBeHidden();
  await expect(host.locator('[data-take-belongings-photo]')).toBeHidden();
  expect(fixture.calls.get('get_guest_belongings')).toBe(1);

  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate(mode => {
      localStorage.setItem('theme', mode);
      document.body.classList.toggle('dark-theme', mode === 'dark');
    }, theme);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const metrics = await host.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth, pageWidth: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth }));
      expect(metrics.scroll, `${theme} ${width}px`).toBeLessThanOrEqual(metrics.width);
      expect(metrics.pageScroll, `${theme} ${width}px document`).toBeLessThanOrEqual(metrics.pageWidth);
      if (evidenceDir && theme === 'dark' && width === 1440) await host.screenshot({ path: path.join(evidenceDir, 'care-items-1440-dark.png'), animations: 'disabled' });
    }
  }

  const editSummary = host.locator('[data-belongings-checklist-summary]');
  await editSummary.focus();
  await page.keyboard.press('Enter');
  await expect(host.locator('[data-belongings-checklist-details]')).toHaveAttribute('open', '');
  const bounds = await editSummary.boundingBox();
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  await expect(host.locator('[data-save-belongings]')).toBeVisible();
  const photoSummary = host.locator('[data-belongings-photo-tools-details] > summary');
  await photoSummary.focus();
  await page.keyboard.press('Enter');
  await expect(host.locator('[data-belongings-photo-tools-details]')).toHaveAttribute('open', '');
  await page.setViewportSize({ width: 320, height: 900 });
  const expandedMetrics = await host.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth, pageWidth: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth }));
  expect(expandedMetrics.scroll).toBeLessThanOrEqual(expandedMetrics.width);
  expect(expandedMetrics.pageScroll).toBeLessThanOrEqual(expandedMetrics.pageWidth);
  const photoSummaryBounds = await photoSummary.boundingBox();
  expect(photoSummaryBounds.height).toBeGreaterThanOrEqual(44);
  await expect(host.locator('[data-belongings-photo-status]')).toBeVisible();
});

test('checklist drafts and save payload survive a data refresh while disclosures preserve their state', async ({ page, baseURL }) => {
  const fixture = installFixture(page);
  const { card, host } = await openBelongings(page, baseURL, fixture);
  const disclosure = host.locator('[data-belongings-checklist-details]');
  await disclosure.locator('summary').click();
  const toys = host.locator('[data-belongings-item-present="toys"]');
  const description = host.locator('[data-belongings-item-description="toys"]');
  await toys.check();
  await description.fill('Green rope and tennis ball');
  await description.dispatchEvent('input');
  await expect(card.locator('[data-belongings-edit-status]')).toContainText('Unsaved');
  await expect(host.locator('[data-save-belongings]')).toBeEnabled();

  await page.evaluate(async key => {
    const card = document.querySelector(`.directory-card[data-directory-stay-key="${CSS.escape(key)}"]`);
    await loadDirectoryBelongingsDetail(card, card.querySelector('[data-directory-detail="belongings"]'), { force: true });
  }, await card.getAttribute('data-directory-stay-key'));
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(host.locator('[data-belongings-item-present="toys"]')).toBeChecked();
  await expect(host.locator('[data-belongings-item-description="toys"]')).toHaveValue('Green rope and tennis ball');
  await expect(card.locator('[data-belongings-edit-status]')).toContainText('Unsaved');
  await expect(host.locator('[data-save-belongings]')).toBeEnabled();

  await host.locator('[data-save-belongings]').click();
  await expect.poll(() => fixture.calls.get('save_belongings') || 0).toBe(1);
  const saved = fixture.requests.get('save_belongings')[0];
  expect(saved.action).toBe('save_belongings');
  expect(saved.items.toys).toEqual({ present: true, description: 'Green rope and tennis ball' });
  expect(saved.items.waterBowls).toEqual({ present: true, description: 'Blue enamel pair' });
  await expect(host.locator('[data-belongings-summary]')).toContainText('Green rope and tennis ball');
  await expect(host.locator('[data-belongings-edit-status]')).toContainText('No unsaved');
});
