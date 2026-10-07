const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fs = require('node:fs');
const path = require('node:path');

const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const exactDogId = '11111111-1111-4111-8111-111111111111';
const booking = {
  timestamp: '2026-09-18', dogName: 'A very long dog name that wraps cleanly', breed: 'Border Collie',
  startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Alexandria Peterson-Smith', phone: '0400123456', notes: 'Safety warning remains visible.', bookingType: 'Boarding', dogId: exactDogId
};

async function installReadOnlyFixture(page, options = {}) {
  const fixtureBooking = { ...booking, phone: options.phone ?? booking.phone };
  const actionReads = [];
  const actionPayloads = [];
  let historyCalls = 0;
  await page.route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Read-only fixture blocked mutation' });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Dog Number\n' + [fixtureBooking.timestamp, fixtureBooking.dogName, fixtureBooking.breed, '17/09/2026', '22/09/2026', fixtureBooking.ownerName, fixtureBooking.phone, '', '', fixtureBooking.notes, '', fixtureBooking.bookingType, 'Other', fixtureBooking.dogId, '#00017'].join(',') });
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
      actionReads.push(action);
      actionPayloads.push({ action, payload });
      let response = { result: 'success', records: [] };
      const stayKey = `${booking.dogName.toLowerCase()}|2026-09-17|2026-09-22`;
      if (action === 'get_guest_belongings') response = { result: 'success', record: { stayKey: payload.stayKey || stayKey, dogPhotoGallery: [{ id: 'profile-1', label: 'Profile portrait', previewUrl: 'https://photos.test/profile.jpg' }], stayPhotos: [{ id: 'stay-1', label: 'Playtime', previewUrl: 'https://photos.test/stay.jpg' }], photos: [] } };
      if (action === 'get_guest_directory') response = { result: 'success', bookings: [fixtureBooking], summaries: [{ stayKey, riskFlags: { foodAllergy: true } }] };
      if (action === 'get_guest_profile') response = { result: 'success', record: { stayKey: payload.stayKey || stayKey, identity: { stayKey: payload.stayKey || stayKey, stayId: '', dogId: fixtureBooking.dogId }, resolution: { status: 'resolved', method: 'legacy-key-unique' }, intakeAttributes: { medicationInstructions: 'Safety warning: monitor appetite.', emergencyContact: 'Jordan Emergency', emergencyPhone: '0400111222' }, updatedAt: options.updatedAt === undefined ? '2026-09-17T08:30:00.000Z' : options.updatedAt, riskFlags: { foodAllergy: true } } };
      if (action === 'get_dog_history') {
        historyCalls++;
        response = historyCalls <= Number(options.historyFailureCount || 0)
          ? { result: 'error', error: 'History temporarily unavailable.' }
          : { result: 'success', history: { dogId: payload.dogId, dogNumber: '17', stayCount: 1, owners: [{ ownerName: 'Alexandria Peterson-Smith', phone: '0400123456' }], previousStays: [{ startDate: '2026-08-01', endDate: '2026-08-05', breed: 'Border Collie', bookingType: 'Boarding', ownerName: 'Alexandria Peterson-Smith', phone: '0400123456', notes: 'Older care notes for this exact dog.' }] } };
      }
      if (callback) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#ddd"/></svg>' });
    return route.continue();
  });
  Object.defineProperty(actionReads, 'payloads', { value: actionPayloads });
  return actionReads;
}
for (const [name, viewport, colorScheme, reducedMotion] of [
  ['320-light', { width: 320, height: 844 }, 'light', 'no-preference'],
  ['360-light', { width: 360, height: 844 }, 'light', 'no-preference'],
  ['390-light', { width: 390, height: 844 }, 'light', 'no-preference'],
  ['390-dark', { width: 390, height: 844 }, 'dark', 'no-preference'],
  ['540-fold-light', { width: 540, height: 720 }, 'light', 'no-preference'],
  ['540-fold-dark', { width: 540, height: 720 }, 'dark', 'no-preference'],
  ['768-light', { width: 768, height: 1024 }, 'light', 'no-preference'],
  ['768-dark', { width: 768, height: 1024 }, 'dark', 'no-preference'],
  ['1440-light', { width: 1440, height: 900 }, 'light', 'no-preference'],
  ['1440-dark', { width: 1440, height: 900 }, 'dark', 'no-preference'],
  ['1440-light-reduced-motion', { width: 1440, height: 900 }, 'light', 'reduce']
]) {
  test(`late handover pointer access ${name}`, async ({ page, baseURL }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme, reducedMotion });
    await page.clock.setFixedTime(new Date('2026-09-18T12:00:00Z'));
    await page.addInitScript(mode => {
      localStorage.setItem('theme', mode);
      window.__careActionScrollBehaviors = [];
      window.__careSafetyPointerEvents = [];
      const scrollIntoView = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function(options) {
        if (this.matches?.('[data-directory-stay-contact], [data-directory-detail="profile"]')) {
          window.__careActionScrollBehaviors.push(options?.behavior || 'auto');
        }
        return scrollIntoView.call(this, options);
      };
      for (const type of ['pointerdown', 'pointerup', 'click']) {
        document.addEventListener(type, event => {
          const target = event.target instanceof Element ? event.target : null;
          const safetyTarget = target?.closest('[data-profile-subtab="safety"]');
          const hit = document.elementFromPoint(event.clientX, event.clientY);
          const safetyHit = hit?.closest('[data-profile-subtab="safety"]');
          window.__careSafetyPointerEvents.push({
            type,
            target: safetyTarget ? 'safety' : target?.tagName.toLowerCase(),
            hit: safetyHit ? 'safety' : hit?.tagName.toLowerCase()
          });
        }, true);
      }
    }, colorScheme);
    const actionReads = await installReadOnlyFixture(page);
    await page.goto(`${baseURL}/directory.html?mobileHierarchy=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    await expect.poll(() => page.locator('.directory-card[data-directory-stay-key]').count()).toBe(1);
    const rosterRow = page.locator('[data-open-directory-profile]');
    await rosterRow.evaluate(button => button.click());
    const profile = page.locator('.directory-card.is-profile-active');
    await expect(profile).toHaveAttribute('data-directory-stay-key', /a very long dog name that wraps cleanly\|2026-09-17\|2026-09-22/);
    await expect(profile.locator('[data-care-brief-freshness]')).toHaveAttribute('data-state', 'fresh');
    const careBrief = profile.locator('[data-directory-care-brief]');
    const sectionNav = profile.locator('.v11160-desktop-tabs');
    const handover = careBrief.getByRole('button', { name: 'Update handover' });

    await handover.click();
    const expectedScrollBehavior = viewport.width <= 768 || reducedMotion === 'reduce' ? 'auto' : 'smooth';
    await expect.poll(() => page.evaluate(() => window.__careActionScrollBehaviors)).toContain(expectedScrollBehavior);
    await expect(page.locator('#guestDetailEditTextarea')).toHaveValue(booking.notes);
    await page.locator('#cancelGuestDetailEdit').click();

    await sectionNav.locator('[data-v11160-tab="history"]').click();
    const historyHost = profile.locator('[data-v108-history]');
    await expect(historyHost.locator('.v108-stay-history')).toContainText('Aug');
    await expect(historyHost).toContainText('Dog ID #00017');
    await sectionNav.locator('[data-v11160-tab="profile"]').click();
    const healthHome = profile.locator('[data-profile-subtab="healthHome"]');
    await healthHome.click();
    await expect(healthHome).toHaveAttribute('aria-expanded', 'true');
    const safety = profile.locator('[data-profile-subtab="safety"]');
    await safety.scrollIntoViewIfNeeded();
    // Hover performs a real mouse move and waits for the target to be actionable.
    // Measure after it so the explicit press uses the target's settled geometry.
    await safety.hover();
    const safetyBox = await safety.boundingBox();
    expect(safetyBox).not.toBeNull();
    const safetyHitTest = await safety.evaluate(button => {
      const box = button.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      const footer = document.getElementById('wh75MobileBottomNav');
      const footerBox = footer?.getBoundingClientRect();
      const footerStyle = footer ? getComputedStyle(footer) : null;
      return {
        hitsSafety: hit?.closest('[data-profile-subtab="safety"]') === button,
        buttonBottom: box.bottom,
        footerTop: footerBox?.top ?? null,
        footerVisible: Boolean(footerBox?.height && footerStyle?.display !== 'none' && footerStyle?.visibility !== 'hidden')
      };
    });
    expect(safetyHitTest.hitsSafety).toBe(true);
    if (safetyHitTest.footerVisible) expect(safetyHitTest.buttonBottom).toBeLessThan(safetyHitTest.footerTop);
    await page.evaluate(() => { window.__careSafetyPointerEvents.length = 0; });
    await page.mouse.down();
    const profileTransform = await profile.evaluate(card => {
      const transform = getComputedStyle(card).transform;
      const matrix = transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(transform);
      return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d };
    });
    expect(profileTransform.a).toBeCloseTo(1, 5);
    expect(profileTransform.b).toBeCloseTo(0, 5);
    expect(profileTransform.c).toBeCloseTo(0, 5);
    expect(profileTransform.d).toBeCloseTo(1, 5);
    await page.mouse.up();
    const safetyPointerEvents = await page.evaluate(() => window.__careSafetyPointerEvents);
    expect(safetyPointerEvents.map(event => event.type)).toEqual(['pointerdown', 'pointerup', 'click']);
    expect(safetyPointerEvents.every(event => event.target === 'safety' && event.hit === 'safety')).toBe(true);
    await expect(safety).toHaveAttribute('aria-expanded', 'true');
    await expect(profile.locator('[data-care-risk-flag="foodAllergy"]')).toBeChecked();
    const detailReadActions = ['get_guest_profile', 'get_guest_belongings', 'get_dog_history', 'get_dog_master_profile'];
    const detailReadsBeforeLateHandover = actionReads.filter(action => detailReadActions.includes(action));

    await handover.click();
    await expect(page.locator('#guestDetailEditModal')).toHaveClass(/open/);
    await expect(page.locator('#guestDetailEditTitle')).toContainText('Edit Handover note');
    await expect(page.locator('#guestDetailEditTextarea')).toHaveValue(booking.notes);
    await page.locator('#cancelGuestDetailEdit').click();
    await expect(page.locator('#guestDetailEditModal')).not.toHaveClass(/open/);
    expect(actionReads.filter(action => detailReadActions.includes(action))).toEqual(detailReadsBeforeLateHandover);
    expect(actionReads.filter(action => action === 'get_dog_history')).toHaveLength(1);
    expect(actionReads.payloads.find(entry => entry.action === 'get_dog_history')?.payload.dogId).toBe(exactDogId);
  });
}
