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
      if (action === 'get_guest_directory') response = { result: 'success', bookings: [fixtureBooking], summaries: [{ stayKey, riskFlags: { foodAllergy: true } }] };
      if (action === 'get_guest_profile') response = { result: 'success', record: { stayKey: payload.stayKey || stayKey, intakeAttributes: { medicationInstructions: 'Safety warning: monitor appetite.' }, riskFlags: { foodAllergy: true } } };
      if (action === 'get_dog_history') {
        historyCalls++;
        response = historyCalls <= Number(options.historyFailureCount || 0)
          ? { result: 'error', error: 'History temporarily unavailable.' }
          : { result: 'success', history: { dogId: payload.dogId, dogNumber: '17', stayCount: 1, owners: [{ ownerName: 'Alexandria Peterson-Smith', phone: '0400123456' }], previousStays: [{ startDate: '2026-08-01', endDate: '2026-08-05', breed: 'Border Collie', bookingType: 'Boarding', ownerName: 'Alexandria Peterson-Smith', phone: '0400123456', notes: 'Older care notes for this exact dog.' }] } };
      }
      if (callback) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    }
    if (/^https?:/.test(url) && !url.includes('127.0.0.1:4177')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#ddd"/></svg>' });
    return route.continue();
  });
  Object.defineProperty(actionReads, 'payloads', { value: actionPayloads });
  return actionReads;
}

for (const [name, viewport, colorScheme] of [['390-light', { width: 390, height: 844 }, 'light'], ['390-dark', { width: 390, height: 844 }, 'dark'], ['1440-light', { width: 1440, height: 900 }, 'light']]) {
  test(`selected profile hierarchy ${name}`, async ({ page, baseURL }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme });
    await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
    await page.addInitScript(mode => localStorage.setItem('theme', mode), colorScheme);
    await page.addInitScript(() => {
      const nativeScrollIntoView = Element.prototype.scrollIntoView;
      window.__directoryProfileScrollBehaviors = [];
      Element.prototype.scrollIntoView = function(options) {
        if (this.matches?.('.directory-dashboard-fused')) {
          window.__directoryProfileScrollBehaviors.push(options?.behavior || 'auto');
        }
        return nativeScrollIntoView.call(this, options);
      };
    });
    const actionReads = await installReadOnlyFixture(page, { historyFailureCount: name === '390-light' ? 1 : 0 });
    await page.goto(`${baseURL}/directory.html?mobileHierarchy=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    await expect.poll(() => page.locator('.directory-card[data-directory-stay-key]').count()).toBe(1);
    await page.locator('[data-open-directory-profile]').evaluate(button => button.click());
    await expect.poll(() => page.locator('.directory-card.is-profile-active').count()).toBe(1);
    if (name.startsWith('390')) {
      await expect.poll(() => page.evaluate(() => window.__directoryProfileScrollBehaviors)).toContain('auto');
    }
    const sectionNav = page.locator('.directory-card.is-profile-active .v11160-desktop-tabs');
    await expect(sectionNav).toBeVisible();
    await expect(sectionNav.locator('[role="tab"]')).toHaveCount(5);
    for (const label of ['Overview', 'Items', 'Photos', 'Stay history', 'Dog record']) {
      await expect(sectionNav.getByRole('tab', { name: new RegExp(label, 'i') })).toBeVisible();
    }
    await expect(page.locator('.directory-card.is-profile-active .directory-main-profile-tabs')).toBeHidden();
    await expect(sectionNav.locator('[data-v11160-tab="profile"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.directory-card.is-profile-active [data-directory-main-panel="profile"]')).toBeVisible();
    const readsAfterProfileOpen = [...actionReads];
    expect(actionReads).not.toContain('get_dog_history');
    expect(actionReads).not.toContain('get_guest_belongings');
    expect(actionReads).not.toContain('get_dog_master_profile');
    await sectionNav.locator('[data-v11160-tab="belongings"]').click();
    await expect(sectionNav.locator('[data-v11160-tab="belongings"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.directory-card.is-profile-active [data-directory-main-panel="belongings"]')).toBeVisible();
    await sectionNav.locator('[data-v11160-tab="profile"]').click();
    await expect(sectionNav.locator('[data-v11160-tab="profile"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.directory-card.is-profile-active [data-directory-main-panel="profile"]')).toBeVisible();
    expect(actionReads).not.toContain('get_dog_history');
    expect(actionReads).not.toContain('get_dog_master_profile');
    expect(actionReads.filter(action => action === 'get_guest_belongings').length).toBeLessThanOrEqual(1);
    expect(actionReads.filter(action => action === 'get_dog_history').length).toBe(readsAfterProfileOpen.filter(action => action === 'get_dog_history').length);
    expect(actionReads.filter(action => action === 'get_dog_master_profile').length).toBe(readsAfterProfileOpen.filter(action => action === 'get_dog_master_profile').length);
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode .directory-roster-heading')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode .v1082-stay-tabs')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode .guest-directory-toolbar')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode #v11190ScanIntakePdfBtn')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode #v11190PdfOcrReviewNote')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode #directory-care-summary')).toBeVisible();
    const careBrief = page.locator('.directory-card.is-profile-active [data-directory-care-brief]');
    await expect(careBrief.getByRole('heading', { name: 'Care readiness' })).toBeVisible();
    const readiness = careBrief.locator('.directory-care-readiness');
    await expect(readiness).toBeVisible();
    await expect(readiness).not.toHaveAttribute('open', '');
    await expect(careBrief.locator('[data-care-readiness-summary]')).toContainText(/review|Ready for care/);
    await expect(careBrief.locator('[data-care-brief-safety]')).toBeVisible();
    await expect(careBrief.locator('[data-care-brief-feeding]')).toBeVisible();
    await expect(careBrief.getByRole('heading', { name: 'Owner', exact: true })).toBeVisible();
    await expect(careBrief.getByRole('heading', { name: 'Handover note', exact: true })).toBeVisible();
    await readiness.locator('summary').click();
    await expect(readiness).toHaveAttribute('open', '');
    const records = page.locator('.directory-card.is-profile-active .directory-care-records-disclosure');
    await expect(records).toBeVisible();
    await expect(records).not.toHaveAttribute('open', '');
    const contactDisclosure = page.locator('.directory-card.is-profile-active [data-directory-stay-contact]');
    await expect(contactDisclosure).toBeVisible();
    await expect(contactDisclosure).not.toHaveAttribute('open', '');
    await expect(contactDisclosure.locator('[data-directory-edit-field]')).toHaveCount(3);
    await expect(careBrief.getByRole('link', { name: 'Call owner' })).toHaveAttribute('href', 'tel:0400123456');
    expect(await careBrief.locator('.directory-care-brief-action:visible').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44))).toBeTruthy();
    const moreActions = careBrief.locator('.directory-care-more-actions');
    await moreActions.locator('summary').click();
    await expect(moreActions.getByRole('button', { name: 'Items & photos' })).toBeVisible();
    await expect(moreActions.getByRole('button', { name: 'Edit care details' })).toBeVisible();
    expect(await moreActions.locator('.directory-care-brief-action:visible').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44))).toBeTruthy();
    await expect(page.locator('#directoryProfileBackBar')).toBeVisible();
    await expect(page.locator('.directory-card.is-profile-active .directory-dog-name-btn')).toContainText('very long dog name');
    await expect(page.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true');
    await sectionNav.locator('[data-v11160-tab="history"]').click();
    await expect(sectionNav.locator('[data-v11160-tab="history"]')).toHaveAttribute('aria-selected', 'true');
    const historyHost = page.locator('.directory-card.is-profile-active [data-v108-history]');
    if (name === '390-light') {
      await expect(historyHost.getByRole('alert')).toContainText('History temporarily unavailable.');
      await historyHost.getByRole('button', { name: 'Try again' }).click();
    }
    await expect(page.locator('.directory-card.is-profile-active [data-v108-history] .v108-stay-history')).toContainText('Aug');
    await expect(historyHost).toContainText('Alexandria Peterson-Smith');
    await expect(historyHost).toContainText('Dog ID 17');
    await expect(historyHost.locator('.v108-stay-history details')).not.toHaveAttribute('open', '');
    expect(actionReads.filter(action => action === 'get_dog_history')).toHaveLength(name === '390-light' ? 2 : 1);
    expect(actionReads.payloads.filter(entry => entry.action === 'get_dog_history')[0]?.payload.dogId).toBe(exactDogId);
    await expect(historyHost.locator('.v108-stay-history a')).toHaveAttribute('href', 'tel:0400123456');
    await sectionNav.locator('[data-v11160-tab="profile"]').click();
    await page.locator('.directory-card.is-profile-active [data-profile-subtab="healthHome"]').click();
    await expect(page.locator('.directory-card.is-profile-active [data-intake-attribute="medicationInstructions"]')).toHaveValue('Safety warning: monitor appetite.');
    await page.locator('.directory-card.is-profile-active [data-profile-subtab="safety"]').scrollIntoViewIfNeeded();
    await page.locator('.directory-card.is-profile-active [data-profile-subtab="safety"]').evaluate(button => button.click());
    await expect(page.locator('.directory-card.is-profile-active [data-profile-subtab="safety"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.directory-card.is-profile-active [data-care-risk-flag="foodAllergy"]')).toBeChecked();
    const readsBeforeHandoverEdit = [...actionReads];
    await careBrief.getByRole('button', { name: 'Update handover' }).click();
    await expect(contactDisclosure).toHaveAttribute('open', '');
    await expect(page.locator('#guestDetailEditModal')).toHaveClass(/open/);
    await expect(page.locator('#guestDetailEditTitle')).toContainText('Edit Notes');
    await expect(page.locator('#guestDetailEditTextarea')).toHaveValue(booking.notes);
    await expect(records).not.toHaveAttribute('open', '');
    expect(actionReads).toEqual(readsBeforeHandoverEdit);
    await page.locator('#cancelGuestDetailEdit').click();
    await page.locator('#directoryBackToGuestsBtn').focus();
    await expect(page.locator('#directoryBackToGuestsBtn')).toBeFocused();
    await page.locator('#directoryBackToGuestsBtn').click();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode')).toHaveCount(0);
    await expect(page.locator('.directory-roster-heading')).toBeVisible();
    await expect(page.locator('#refreshGuestDirectoryBtn')).toBeHidden();
    await expect(page.getByRole('button', { name: /Scan Intake PDF/i })).toBeHidden();
    await expect(page.locator('#v11190PdfOcrReviewNote')).toBeHidden();
    await expect(page.locator('#directory-care-summary')).toBeHidden();
  });
}

test('Call owner is unavailable without a valid phone number', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
  const actionReads = await installReadOnlyFixture(page, { phone: 'owner phone not provided' });
  await page.goto(`${baseURL}/directory.html?mobileHierarchy=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  await expect.poll(() => page.locator('.directory-card[data-directory-stay-key]').count()).toBe(1);
  const card = page.locator('.directory-card[data-directory-stay-key]');
  await card.locator('[data-open-directory-profile]').click();
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true');
  const directoryReadsBeforeChecklist = actionReads.filter(action => action === 'get_guest_directory').length;
  await card.locator('.directory-care-readiness > summary').click();
  const careBrief = card.locator('[data-directory-care-brief]');
  await expect(careBrief.getByText('Call owner unavailable')).toHaveAttribute('aria-disabled', 'true');
  await expect(careBrief.locator('a[href^="tel:"]')).toHaveCount(0);
  await expect(card.locator('[data-directory-stay-contact]')).not.toHaveAttribute('open', '');
  const buttons = careBrief.locator('.directory-care-brief-action');
  expect(await buttons.evaluateAll(items => items.every(item => item.getBoundingClientRect().height >= 44))).toBeTruthy();
  expect(actionReads.filter(action => action === 'get_guest_directory')).toHaveLength(directoryReadsBeforeChecklist);
});

test('Records & Forms opens legacy PDF OCR for the selected dog and stay', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
  await page.addInitScript(() => {
    window.__openedLegacyIntakeUrls = [];
    window.open = url => {
      window.__openedLegacyIntakeUrls.push(String(url));
      return { closed: true };
    };
  });
  await installReadOnlyFixture(page);
  await page.goto(`${baseURL}/directory.html?mobileHierarchy=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');

  const card = page.locator('.directory-card[data-directory-stay-key]').filter({ has: page.locator('[data-open-directory-profile]') });
  await expect(card).toHaveCount(1);
  const stayKey = await card.getAttribute('data-directory-stay-key');
  await card.locator('[data-open-directory-profile]').click();
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true');

  const records = card.locator('.directory-care-records-disclosure');
  await records.locator('summary').click();
  const upload = records.locator('[data-care-record-upload]');
  await expect(upload).toBeVisible();
  await expect(upload).toHaveAccessibleName(/Upload.*legacy intake PDF.*OCR/);
  const bounds = await upload.boundingBox();
  const stripBounds = await records.locator('.directory-legacy-strip').boundingBox();
  // The upload action fills the strip's content box inside its 10px padding.
  expect(bounds.width).toBeGreaterThanOrEqual(stripBounds.width - 24);

  await upload.evaluate(button => button.click());
  const openedUrl = await page.evaluate(() => window.__openedLegacyIntakeUrls.at(-1));
  expect(openedUrl).toBeTruthy();
  expect(new URL(openedUrl).searchParams.get('stayKey')).toBe(stayKey);
  expect(new URL(openedUrl).searchParams.get('action')).toBe('legacy_intake');
});

test('Care brief actions stay visible and keyboard focused in forced-colors mode', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
  await installReadOnlyFixture(page);
  await page.goto(`${baseURL}/directory.html?mobileHierarchy=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  await expect.poll(() => page.locator('.directory-card[data-directory-stay-key]').count()).toBe(1);
  const card = page.locator('.directory-card[data-directory-stay-key]');
  await card.locator('[data-open-directory-profile]').click();
  await card.locator('.directory-care-readiness > summary').click();
  const action = card.locator('[data-care-brief-action="handover"]');
  await action.focus();
  expect(await action.evaluate(button => ({
    height: button.getBoundingClientRect().height,
    outline: getComputedStyle(button).outlineStyle,
    border: getComputedStyle(button).borderTopStyle
  }))).toMatchObject({ height: expect.any(Number), outline: 'solid', border: 'solid' });
  expect(await action.evaluate(button => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});
