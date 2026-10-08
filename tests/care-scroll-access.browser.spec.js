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

async function settlePointerTargetAfterScroll(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const selector = await locator.evaluate(element =>
    `.directory-card.is-profile-active [data-profile-subtab="${element.dataset.profileSubtab}"]`
  );
  await page.evaluate(targetSelector => {
    window.__carePointerTargetReadiness ||= Object.create(null);
    window.__carePointerTargetReadiness[targetSelector] = null;
  }, selector);
  try {
    await page.waitForFunction(targetSelector => {
      const target = document.querySelector(targetSelector);
      if (!target?.isConnected) return false;
      const rect = target.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      const hitReady = hit === target || target.contains(hit);
      const visible = rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
      const previous = window.__carePointerTargetReadiness[targetSelector];
      const unchanged = previous &&
        Math.abs(previous.left - rect.left) <= 0.25 &&
        Math.abs(previous.top - rect.top) <= 0.25 &&
        Math.abs(previous.width - rect.width) <= 0.25 &&
        Math.abs(previous.height - rect.height) <= 0.25;
      const stableFrames = visible && hitReady ? (unchanged ? previous.stableFrames + 1 : 1) : 0;
      const sample = { left: rect.left, top: rect.top, width: rect.width, height: rect.height, centerX: x, centerY: y, hitTag: hit?.tagName?.toLowerCase() || null, hitReady, visible, stableFrames };
      window.__carePointerTargetReadiness[targetSelector] = sample;
      if (stableFrames < 3) return false;
      (window.__carePointerTargetReadinessLog ||= []).push({ selector: targetSelector, ...sample });
      return true;
    }, selector, { polling: 'raf', timeout: 10_000 });
  } catch (error) {
    const lastSample = await page.evaluate(targetSelector => window.__carePointerTargetReadiness?.[targetSelector] || null, selector).catch(() => null);
    throw new Error(`Care pointer target did not reach stable, hit-ready geometry: ${JSON.stringify({ selector, lastSample })}. ${error.message}`);
  }
}

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
    if (new URL(url).pathname.endsWith('/waffle-app.js')) {
      const response = await route.fetch();
      const source = await response.text();
      const marker = 'function renderDirectoryIntakeAttributes(card, record) {';
      if (!source.includes(marker)) throw new Error('Could not instrument renderDirectoryIntakeAttributes in fixture source');
      const instrumented = source.replace(marker, `${marker}\n        window.__careCategoryRenderCalls?.push({ time: performance.now(), stack: new Error().stack });`);
      return route.fulfill({ response, body: instrumented });
    }
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
    await page.addInitScript(() => {
      const NativeDate = Date;
      const fixedNow = NativeDate.UTC(2026, 8, 18, 12, 0, 0);
      function FixedDate(...args) {
        if (!new.target) return new NativeDate(fixedNow).toString();
        return Reflect.construct(NativeDate, args.length ? args : [fixedNow], new.target);
      }
      FixedDate.prototype = NativeDate.prototype;
      Object.setPrototypeOf(FixedDate, NativeDate);
      FixedDate.now = () => fixedNow;
      globalThis.Date = FixedDate;
    });
    await page.addInitScript(mode => {
      localStorage.setItem('theme', mode);
      window.__careActionScrollBehaviors = [];
      window.__careSafetyPointerEvents = [];
      window.__careCategoryRenderCalls = [];
      window.__careCategoryMutations = [];
      window.__careSafetyPointerTarget = null;
      window.__carePointerTargetReadiness = Object.create(null);
      window.__carePointerTargetReadinessLog = [];
      const scrollables = element => {
        const result = [];
        for (let node = element?.parentElement; node && node !== document.documentElement; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (/(auto|scroll|overlay)/.test(`${style.overflowY} ${style.overflow}`) && node.scrollHeight > node.clientHeight + 1) {
            result.push({ tag: node.tagName.toLowerCase(), id: node.id, className: String(node.className || '').slice(0, 100), top: node.scrollTop, height: node.clientHeight, scrollHeight: node.scrollHeight });
          }
        }
        return result;
      };
      new MutationObserver(records => {
        for (const record of records) {
          const removedSafety = [...record.removedNodes].some(node => node instanceof Element && (node.matches('[data-profile-subtab="safety"]') || node.querySelector('[data-profile-subtab="safety"]')));
          const addedSafety = [...record.addedNodes].some(node => node instanceof Element && (node.matches('[data-profile-subtab="safety"]') || node.querySelector('[data-profile-subtab="safety"]')));
          if (removedSafety || addedSafety) window.__careCategoryMutations.push({ time: performance.now(), removedSafety, addedSafety, host: record.target?.className || record.target?.id || record.target?.tagName });
        }
      }).observe(document, { subtree: true, childList: true });
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
          const footer = document.getElementById('wh75MobileBottomNav');
          const footerBox = footer?.getBoundingClientRect();
          const footerStyle = footer ? getComputedStyle(footer) : null;
          const buttonBox = safetyTarget?.getBoundingClientRect();
          if (type === 'pointerdown' && safetyTarget) window.__careSafetyPointerTarget = safetyTarget;
          const originalButton = window.__careSafetyPointerTarget;
          const originalBox = originalButton?.isConnected ? originalButton.getBoundingClientRect() : null;
          const visualViewport = window.visualViewport;
          const profile = document.querySelector('.directory-card.is-profile-active');
          const transform = profile ? getComputedStyle(profile).transform : 'none';
          const matrix = transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(transform);
          window.__careSafetyPointerEvents.push({
            type,
            time: performance.now(),
            clientX: event.clientX,
            clientY: event.clientY,
            target: safetyTarget ? 'safety' : target?.tagName.toLowerCase(),
            hit: safetyHit ? 'safety' : hit?.tagName.toLowerCase(),
            hitTag: hit?.tagName.toLowerCase(),
            hitText: hit?.textContent?.trim().slice(0, 80),
            activeElement: document.activeElement?.tagName.toLowerCase(),
            activeElementText: document.activeElement?.textContent?.trim().slice(0, 80),
            documentScroll: { x: window.scrollX, y: window.scrollY },
            visualViewport: visualViewport ? { offsetTop: visualViewport.offsetTop, offsetLeft: visualViewport.offsetLeft, pageTop: visualViewport.pageTop, height: visualViewport.height, scale: visualViewport.scale } : null,
            scrollables: scrollables(originalButton?.isConnected ? originalButton : target),
            originalButtonConnected: Boolean(originalButton?.isConnected),
            originalButtonRect: originalBox ? { x: originalBox.x, y: originalBox.y, top: originalBox.top, right: originalBox.right, bottom: originalBox.bottom, left: originalBox.left } : null,
            profileTransform: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d },
            buttonBottom: buttonBox?.bottom ?? null,
            footerTop: footerBox?.top ?? null,
            footerVisible: Boolean(footerBox?.height && footerStyle?.display !== 'none' && footerStyle?.visibility !== 'hidden')
          });
        }, true);
      }
    }, colorScheme);
    const actionReads = await installReadOnlyFixture(page);
    await page.goto(`${baseURL}/directory.html?mobileHierarchy=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const clockSanity = await page.evaluate(async () => {
      const before = performance.now();
      await new Promise(requestAnimationFrame);
      return {
        now: Date.now(),
        callableDateIsString: typeof Date() === 'string',
        parsedDate: new Date('2026-09-18T12:00:00.000Z').getTime(),
        dateInstance: new Date() instanceof Date,
        performanceAdvanced: performance.now() > before,
        playwrightClockInstalled: Boolean(window.__pwClock)
      };
    });
    expect(clockSanity).toEqual({ now: Date.UTC(2026, 8, 18, 12, 0, 0), callableDateIsString: true, parsedDate: Date.UTC(2026, 8, 18, 12, 0, 0), dateInstance: true, performanceAdvanced: true, playwrightClockInstalled: false });
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
    await settlePointerTargetAfterScroll(page, healthHome);
    await healthHome.click();
    await expect(healthHome).toHaveAttribute('aria-expanded', 'true');
    const safety = profile.locator('[data-profile-subtab="safety"]');
    await page.evaluate(() => { window.__careSafetyPointerEvents.length = 0; window.__careCategoryRenderCalls.length = 0; window.__careCategoryMutations.length = 0; });
    // Locator click remains a real pointer action and checks actionability at press time.
    await settlePointerTargetAfterScroll(page, safety);
    await safety.click();
    const safetyPointerEvents = await page.evaluate(() => window.__careSafetyPointerEvents);
    expect(safetyPointerEvents.map(event => event.type)).toEqual(['pointerdown', 'pointerup', 'click']);
    expect(safetyPointerEvents.every(event => event.target === 'safety' && event.hit === 'safety'), JSON.stringify({ safetyPointerEvents, pointerTargetReadiness: await page.evaluate(() => window.__carePointerTargetReadinessLog), categoryRenderCalls: await page.evaluate(() => window.__careCategoryRenderCalls), categoryMutations: await page.evaluate(() => window.__careCategoryMutations) }, null, 2)).toBe(true);
    for (const event of safetyPointerEvents) {
      expect(event.profileTransform.a).toBeCloseTo(1, 5);
      expect(event.profileTransform.b).toBeCloseTo(0, 5);
      expect(event.profileTransform.c).toBeCloseTo(0, 5);
      expect(event.profileTransform.d).toBeCloseTo(1, 5);
      if (event.footerVisible) expect(event.buttonBottom).toBeLessThan(event.footerTop);
    }
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
