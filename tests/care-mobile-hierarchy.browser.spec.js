const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fs = require('node:fs');
const path = require('node:path');

const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const exactDogId = '11111111-1111-4111-8111-111111111111';
const longCareInstruction = 'Keep the portion measured, offer fresh water, and note appetite or behaviour changes for the handover. '.repeat(3).slice(0, 240);
const clarityEvidenceDir = path.join(__dirname, '..', 'evidence', 'care-profile-clarity');
fs.mkdirSync(clarityEvidenceDir, { recursive: true });
const booking = {
  timestamp: '2026-09-18', dogName: 'A very long dog name that wraps cleanly', breed: 'Border Collie',
  startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Alexandria Peterson-Smith', phone: '0400123456', notes: 'Safety warning remains visible.', bookingType: 'Boarding', dogId: exactDogId, dogNumber: '#00017'
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
      if (action === 'get_guest_belongings') response = { result: 'success', record: {
        stayKey: payload.stayKey || stayKey,
        identityResolution: { status: 'resolved', identity: { stayKey: payload.stayKey || stayKey, stayId: '', dogId: fixtureBooking.dogId } },
        dogPhotoGallery: [{ id: 'profile-1', label: 'Profile portrait', previewUrl: 'https://photos.test/profile.jpg' }],
        stayPhotos: [{ id: 'stay-1', label: 'Playtime', previewUrl: 'https://photos.test/stay.jpg' }], photos: []
      } };
      if (action === 'get_guest_directory') response = { result: 'success', bookings: [fixtureBooking], summaries: [{ stayKey, riskFlags: { foodAllergy: true } }] };
      if (action === 'get_guest_profile') response = { result: 'success', record: { stayKey: payload.stayKey || stayKey, identity: { stayKey: payload.stayKey || stayKey, stayId: '', dogId: fixtureBooking.dogId }, resolution: { status: 'resolved', method: 'legacy-key-unique' }, intakeAttributes: { feedingTimes: `07:00 and 18:00 · ${longCareInstruction}`, foodAmount: '1 cup', medicationInstructions: options.longCareText ? longCareInstruction : 'Safety warning: monitor appetite.', emergencyContact: 'Jordan Emergency', emergencyPhone: '0400111222' }, updatedAt: options.updatedAt === undefined ? '2026-09-17T08:30:00.000Z' : options.updatedAt, riskFlags: { foodAllergy: true } } };
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

for (const [width, colorScheme] of [[320, 'light'], [320, 'dark'], [390, 'light'], [390, 'dark'], [1440, 'light'], [1440, 'dark']]) {
  test(`selected profile glance and action geometry ${width}px ${colorScheme}`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.clock.install({ time: new Date('2026-09-18T12:00:00Z') });
    await page.addInitScript(mode => localStorage.setItem('theme', mode), colorScheme);
    const actionReads = await installReadOnlyFixture(page, { longCareText: true });
    await page.goto(`${baseURL}/directory.html?mobileHierarchy=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const card = page.locator('.directory-card[data-directory-stay-key]');
    await expect(card).toHaveCount(1);
    await card.locator('[data-open-directory-profile]').evaluate(button => button.click());
    const profile = page.locator('.directory-card.is-profile-active');
    await expect(profile).toHaveCount(1);
    await expect(profile.locator('.directory-photo-shell')).toBeVisible();
    await expect(profile.locator('.directory-guest-tile-photo')).toBeHidden();
    await expect(profile.locator('.directory-dog-name-btn')).toContainText('A very long dog name');
    await expect(profile.locator('.directory-name-row .directory-dog-id')).toHaveText('Dog ID #00017');
    await expect(profile.locator('.directory-name-row .directory-status-tag')).toBeVisible();
    await expect(profile.locator('.directory-profile-stay-dates')).toContainText('Check-in');
    await expect(profile.locator('.directory-profile-stay-dates')).toContainText('Check-out');
    await expect(profile.locator('[data-v110-operation-bar]')).toBeVisible();
    const operationBar = profile.locator('[data-v110-operation-bar]');
    await expect(operationBar).toContainText('No check-in recorded');
    await expect(operationBar).not.toContainText(/STAY STATUS|Date-based/i);
    const brief = profile.locator('[data-directory-care-brief]');
    await expect(brief.getByRole('heading', { name: 'Care essentials' })).toBeVisible();
    await expect(brief.locator('[data-care-brief-safety]')).toBeVisible();
    await expect(brief.locator('[data-care-brief-feeding]')).toContainText(longCareInstruction.slice(0, 28));
    await expect(brief.locator('[data-care-brief-medication]')).toContainText(longCareInstruction.slice(0, 28));
    await expect(brief.locator('.directory-care-readiness')).not.toHaveAttribute('open', '');
    await expect(brief.locator('.directory-care-more-actions')).not.toHaveAttribute('open', '');
    const supporting = brief.locator('[data-care-brief-supporting-details]');
    await expect(supporting).not.toHaveAttribute('open', '');
    await expect(brief.locator('[data-care-brief-feeding]')).toBeHidden();
    await expect(brief.locator('[data-care-brief-medication]')).toBeVisible();
    const supportingSummary = supporting.locator(':scope > summary');
    await supportingSummary.focus();
    await supportingSummary.press('Enter');
    await expect(brief.locator('[data-care-brief-feeding]')).toBeVisible();
    const geometry = await profile.evaluate(node => {
      const selectors = ['.directory-photo-shell', '.directory-dog-name-btn', '.directory-name-row .directory-dog-id', '.directory-name-row .directory-status-tag', '.directory-profile-stay-dates', '[data-v110-operation-bar]', '[data-care-brief-feeding]', '[data-care-brief-medication]'];
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        items: selectors.map(selector => {
          const element = node.querySelector(selector);
          const box = element?.getBoundingClientRect();
          const style = element ? getComputedStyle(element) : null;
          return { selector, present: Boolean(element), left: box?.left, right: box?.right, height: box?.height, scrollHeight: element?.scrollHeight, clientHeight: element?.clientHeight, overflowY: style?.overflowY, lineClamp: style?.webkitLineClamp };
        })
      };
    });
    expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1);
    expect(geometry.items.every(item => item.present && item.left >= -1 && item.right <= width + 1 && item.height > 0), JSON.stringify(geometry)).toBeTruthy();
    expect(geometry.items.filter(item => item.selector.includes('care-brief-')).every(item => item.overflowY !== 'hidden' && item.lineClamp === 'none'), JSON.stringify(geometry)).toBeTruthy();
    if ((width === 320 && colorScheme === 'light') || (width === 390 && colorScheme === 'dark') || (width === 1440 && colorScheme === 'light')) {
      await page.screenshot({ fullPage: false, animations: 'disabled', path: path.join(clarityEvidenceDir, `selected-profile-${width}-${colorScheme}.png`) });
    }
    const tools = brief.locator('.directory-care-more-actions > summary');
    await tools.focus();
    await expect(tools).toHaveCSS('outline-style', 'solid');
    await tools.press('Enter');
    await expect(brief.locator('.directory-care-more-actions')).toHaveAttribute('open', '');
    await expect(profile.locator('[data-v11160-tab="belongings"]')).toBeVisible();
    await expect(brief.locator('[data-care-brief-action="belongings"]')).toHaveCount(0);
    await expect(brief.getByRole('button', { name: 'Edit care details' })).toBeVisible();
    await expect(brief.getByRole('button', { name: 'Delete this confirmed stay' })).toBeVisible();
    const bookingTools = profile.locator('.p4-directory-actions');
    await expect(bookingTools).toBeHidden();
    await expect(profile.locator('.directory-care-brief-actions > [data-care-owner-link-group] > [data-p4-dir="owner"]')).toBeVisible();
    await expect(bookingTools.locator('[data-p4-dir="owner"]')).toHaveCount(0);
    await expect(profile.locator('.directory-care-more-actions-list > [data-p4-dir="again"]')).toBeVisible();
    expect(actionReads).not.toContain('get_guest_belongings');
    expect(actionReads).not.toContain('get_dog_history');
    expect(actionReads).not.toContain('get_dog_master_profile');
  });
}

for (const [width, colorScheme] of [[320, 'dark'], [1440, 'dark']]) {
  test(`selected profile blocked check-in feedback ${width}px ${colorScheme}`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme });
    await page.clock.install({ time: new Date('2026-09-18T12:00:00.000Z') });
    await page.addInitScript(mode => localStorage.setItem('theme', mode), colorScheme);
    await installReadOnlyFixture(page, { longCareText: true });
    let dialogCount = 0;
    page.on('dialog', async dialog => { dialogCount++; await dialog.dismiss(); });
    await page.goto(`${baseURL}/directory.html?mobileHierarchy=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const card = page.locator('.directory-card[data-directory-stay-key]');
    await card.locator('[data-open-directory-profile]').evaluate(button => button.click());
    const profile = page.locator('.directory-card.is-profile-active');
    const bar = profile.locator('[data-v110-operation-bar]');
    await expect(bar).toContainText('No check-in recorded');
    await page.context().setOffline(true);
    await card.locator('[data-v110-checkin]').click();
    const feedback = bar.locator(':scope > .v110-action-feedback');
    await expect(feedback).toHaveAttribute('role', 'alert');
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText('require a live connection');
    await expect(feedback.getByRole('button', {name:'Retry'})).toHaveCount(0);
    const placement = await feedback.evaluate(node => {
      const box = node.getBoundingClientRect();
      const cardBox = node.closest('.directory-card').getBoundingClientRect();
      return { left: box.left, right: box.right, cardLeft: cardBox.left, cardRight: cardBox.right, width: box.width };
    });
    expect(placement.left).toBeGreaterThanOrEqual(placement.cardLeft - 1);
    expect(placement.right).toBeLessThanOrEqual(placement.cardRight + 1);
    expect(placement.width).toBeGreaterThan(0);
    await expect(card.locator('[data-v110-checkin]')).toBeEnabled();
    expect(dialogCount).toBe(0);
    await expect(card.locator('[data-v110-operation-bar]')).toContainText('No check-in recorded');
  });
}

for (const [name, viewport, colorScheme] of [['320-light', { width: 320, height: 844 }, 'light'], ['360-light', { width: 360, height: 844 }, 'light'], ['390-light', { width: 390, height: 844 }, 'light'], ['390-dark', { width: 390, height: 844 }, 'dark'], ['1440-light', { width: 1440, height: 900 }, 'light']]) {
  test(`selected profile hierarchy ${name}`, async ({ page, baseURL }, testInfo) => {
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
    const actionReads = await installReadOnlyFixture(page, { historyFailureCount: name === '390-light' ? 1 : 0, longCareText: true });
    await page.goto(`${baseURL}/directory.html?mobileHierarchy=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    await expect.poll(() => page.locator('.directory-card[data-directory-stay-key]').count()).toBe(1);
    await page.locator('[data-open-directory-profile]').evaluate(button => button.click());
    await expect.poll(() => page.locator('.directory-card.is-profile-active').count()).toBe(1);
    if (name.startsWith('390')) {
      await expect.poll(() => page.evaluate(() => window.__directoryProfileScrollBehaviors)).toContain('auto');
    }
    const selectedProfile = page.locator('.directory-card.is-profile-active');
    await expect(selectedProfile.locator('[data-care-brief-freshness]')).toHaveAttribute('data-state', 'fresh');
    await expect(selectedProfile.locator('[data-care-brief-freshness]')).toContainText('Saved record · updated');
    await expect(selectedProfile.locator('[data-care-brief-freshness]')).toHaveAttribute('aria-description', /shared saved record.*does not confirm care instructions were reviewed/);
    await expect(selectedProfile.locator('.directory-care-brief-grid')).not.toContainText('0400123456');
    await expect(selectedProfile.locator('[data-care-brief-owner-name]')).toHaveText('Alexandria Peterson-Smith');
    await expect(selectedProfile.locator('[data-care-brief-call-owner] a')).toHaveAttribute('href', 'tel:0400123456');
    await expect(selectedProfile.locator('.directory-guest-tile-photo')).toBeHidden();
    await expect(selectedProfile.locator('.directory-photo-shell')).toBeVisible();
    await expect(selectedProfile.locator('[data-directory-care-brief] > .directory-care-brief-heading h3')).toHaveText('Care essentials');
    await expect(selectedProfile.locator('[data-directory-care-brief]')).not.toContainText('Selected guest');
    await expect(selectedProfile.locator('[data-care-brief-feeding]')).toContainText('Keep the portion measured');
    await expect(selectedProfile.locator('[data-care-brief-medication]')).toContainText('Keep the portion measured');
    await expect(selectedProfile.locator('.directory-profile-stay-dates')).toContainText('Check-in');
    await expect(selectedProfile.locator('.directory-profile-stay-dates')).toContainText('Check-out');
    await expect(selectedProfile.locator('[data-v110-operation-bar]')).toBeVisible();
    await expect.poll(() => selectedProfile.locator('.directory-profile-content').evaluate(profile => {
      const header = profile.querySelector('.directory-card-header');
      const operations = profile.querySelector('[data-v110-operation-bar]');
      const overview = profile.querySelector('.directory-care-brief');
      return Boolean(header && operations && overview && header.nextElementSibling === operations && (operations.compareDocumentPosition(overview) & Node.DOCUMENT_POSITION_FOLLOWING));
    })).toBe(true);
    const identityGeometry = await selectedProfile.evaluate(profile => {
      const selectors = ['.directory-photo-shell', '.directory-dog-name-btn', '.directory-name-row .directory-dog-id', '.directory-name-row .directory-status-tag', '.directory-profile-stay-dates', '[data-v110-operation-bar]'];
      const items = selectors.map(selector => {
        const node = profile.querySelector(selector);
        if (!node) return { selector, missing: true };
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return { selector, left: rect.left, right: rect.right, width: rect.width, height: rect.height, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace };
      });
      return { documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, items };
    });
    expect(identityGeometry.documentWidth).toBeLessThanOrEqual(identityGeometry.viewportWidth + 1);
    expect(identityGeometry.items.every(item => !item.missing && item.left >= -1 && item.right <= identityGeometry.viewportWidth + 1 && item.width > 0 && item.height > 0 && item.textOverflow !== 'ellipsis' && item.whiteSpace !== 'nowrap'), JSON.stringify(identityGeometry)).toBeTruthy();
    expect(identityGeometry.items.find(item => item.selector === '.directory-profile-stay-dates').scrollWidth).toBeLessThanOrEqual(identityGeometry.items.find(item => item.selector === '.directory-profile-stay-dates').clientWidth + 1);
    const bookingTools = selectedProfile.locator('.p4-directory-actions');
    await revealSecondaryTools(page);
    await expect(bookingTools).toBeHidden();
    await expect(selectedProfile.locator('.directory-care-brief-actions > [data-care-owner-link-group] > [data-p4-dir="owner"]')).toBeVisible();
    await expect(bookingTools.locator('[data-p4-dir="owner"]')).toHaveCount(0);
    await expect(selectedProfile.locator('.directory-care-more-actions-list > [data-p4-dir="again"]')).toBeVisible();
    const sectionNav = page.locator('.directory-card.is-profile-active .v11160-desktop-tabs');
    await expect(sectionNav).toBeVisible();
    await expect(sectionNav.locator('[role="tab"]')).toHaveCount(5);
    for (const label of ['Overview', 'Items', 'Photos', 'Stay history', 'Dog record']) {
      await expect(sectionNav.getByRole('tab', { name: new RegExp(label, 'i') })).toBeVisible();
    }
    await expect(page.locator('.directory-card.is-profile-active .directory-main-profile-tabs')).toBeHidden();
    await expect(sectionNav.locator('[data-v11160-tab="profile"]')).toHaveAttribute('aria-selected', 'true');
    const readsAfterProfileOpen = [...actionReads];
    expect(actionReads).not.toContain('get_dog_history');
    expect(actionReads).not.toContain('get_guest_belongings');
    expect(actionReads).not.toContain('get_dog_master_profile');
    const sectionTabBoxes = await sectionNav.locator('[role="tab"]').evaluateAll(tabs => tabs.map(tab => {
      const box = tab.getBoundingClientRect();
      return { right: box.right, bottom: box.bottom, width: box.width, height: box.height, fontSize: parseFloat(getComputedStyle(tab).fontSize), label: tab.querySelector('span:last-child')?.textContent.trim() || '' };
    }));
    expect(sectionTabBoxes.every(tab => tab.width >= 40 && tab.height >= 44 && tab.fontSize >= 13 && tab.right <= viewport.width + 1)).toBeTruthy();
    expect(sectionTabBoxes.map(tab => tab.label)).toEqual(['Overview', 'Items', 'Photos', 'Stay history', 'Dog record']);
    expect(await sectionNav.evaluate(nav => nav.scrollWidth <= nav.clientWidth + 1)).toBeTruthy();
    await expect(page.locator('.directory-card.is-profile-active [data-directory-main-panel="profile"]')).toBeVisible();
    const careBrief = page.locator('.directory-card.is-profile-active [data-directory-care-brief]');
    const records = page.locator('.directory-card.is-profile-active .directory-care-records-disclosure');
    const contactDisclosure = page.locator('.directory-card.is-profile-active [data-directory-stay-contact]');
    const readsBeforeHandoverEdit = [...actionReads];
    await revealSecondaryTools(page);
    await careBrief.getByRole('button', { name: 'Update handover' }).click();
    await expect(contactDisclosure).toHaveAttribute('open', '');
    await expect(page.locator('#guestDetailEditModal')).toHaveClass(/open/);
    await expect(page.locator('#guestDetailEditTitle')).toContainText('Edit Handover note');
    await expect(page.locator('#guestDetailEditTextarea')).toHaveValue(booking.notes);
    await expect(records).not.toHaveAttribute('open', '');
    const detailReads = actions => actions.filter(action => ['get_guest_profile', 'get_guest_belongings', 'get_dog_history', 'get_dog_master_profile'].includes(action));
    expect(detailReads(actionReads)).toEqual(detailReads(readsBeforeHandoverEdit));
    await page.locator('#cancelGuestDetailEdit').click();
    await contactDisclosure.locator('summary').click();
    await expect(contactDisclosure).not.toHaveAttribute('open', '');
    await selectedProfile.locator('.directory-care-more-actions > summary').click();
    await page.keyboard.press('Tab');
    const profileTab = sectionNav.locator('[data-v11160-tab="profile"]');
    const belongingsTab = sectionNav.locator('[data-v11160-tab="belongings"]');
    const profilePanel = selectedProfile.locator('[data-directory-main-panel="profile"]');
    const belongingsPanel = selectedProfile.locator('[data-directory-main-panel="belongings"]');
    await profileTab.focus();
    await expect(profileTab).toHaveCSS('outline-style', 'solid');
    const readsBeforeArrowRight = [...actionReads];
    await profileTab.press('ArrowRight');
    await expect(belongingsTab).toBeFocused();
    await expect(belongingsTab).toHaveAttribute('aria-selected', 'false');
    await expect(profileTab).toHaveAttribute('aria-selected', 'true');
    await expect(profilePanel).toBeVisible();
    expect(detailReads(actionReads)).toEqual(detailReads(readsBeforeArrowRight));
    await belongingsTab.press('Enter');
    await expect(belongingsTab).toHaveAttribute('aria-selected', 'true');
    await expect(belongingsPanel).toBeVisible();
    await expect(profilePanel).toBeHidden();
    await expect.poll(() => actionReads.filter(action => action === 'get_guest_belongings').length).toBe(1);

    const readsBeforeArrowLeft = [...actionReads];
    await belongingsTab.press('ArrowLeft');
    await expect(profileTab).toBeFocused();
    await expect(profileTab).toHaveAttribute('aria-selected', 'false');
    await expect(belongingsTab).toHaveAttribute('aria-selected', 'true');
    await expect(belongingsPanel).toBeVisible();
    expect(detailReads(actionReads)).toEqual(detailReads(readsBeforeArrowLeft));
    await profileTab.press('Space');
    await expect(profileTab).toHaveAttribute('aria-selected', 'true');
    await expect(profilePanel).toBeVisible();
    await expect(belongingsPanel).toBeHidden();
    await sectionNav.locator('[data-v11160-tab="belongings"]').click();
    await expect(sectionNav.locator('[data-v11160-tab="belongings"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.directory-card.is-profile-active [data-directory-main-panel="belongings"]')).toBeVisible();
    await sectionNav.locator('[data-v11160-tab="profile"]').click();
    await expect(sectionNav.locator('[data-v11160-tab="profile"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.directory-card.is-profile-active [data-directory-main-panel="profile"]')).toBeVisible();
    await selectedProfile.locator('[data-profile-subtab="foodWalks"]').click();
    await expect(selectedProfile.locator('[data-profile-subtab="foodWalks"]')).toHaveAttribute('aria-expanded', 'true');
    await revealSecondaryTools(page);
    await selectedProfile.locator('[data-care-brief-action="emergency-contact"]').click();
    await expect(selectedProfile.locator('[data-profile-subtab="healthHome"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(selectedProfile.locator('[data-profile-subtab="foodWalks"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(selectedProfile.locator('[data-intake-attribute="emergencyContact"]')).toHaveValue('Jordan Emergency');
    await expect(selectedProfile.locator('[data-intake-attribute="emergencyPhone"]')).toHaveValue('0400111222');
    expect(actionReads).not.toContain('get_dog_history');
    expect(actionReads).not.toContain('get_dog_master_profile');
    expect(actionReads.filter(action => action === 'get_guest_belongings').length).toBeLessThanOrEqual(1);
    expect(actionReads.filter(action => action === 'get_dog_history').length).toBe(readsAfterProfileOpen.filter(action => action === 'get_dog_history').length);
    expect(actionReads.filter(action => action === 'get_dog_master_profile').length).toBe(readsAfterProfileOpen.filter(action => action === 'get_dog_master_profile').length);
    await sectionNav.locator('[data-v11160-tab="media"]').click();
    const mediaHost = page.locator('.directory-card.is-profile-active [data-v110-media-host]');
    await expect(mediaHost.locator('.v110-media-section')).toHaveCount(3);
    await expect(mediaHost.locator('.v110-media-count')).toHaveText(['1', '1', '0']);
    const profilePhotos = mediaHost.locator('[data-v110-media-toggle="profile"]');
    await expect(profilePhotos).toHaveAttribute('aria-expanded', 'false');
    await profilePhotos.focus();
    await page.keyboard.press('Enter');
    await expect(profilePhotos).toHaveAttribute('aria-expanded', 'true');
    await profilePhotos.click();
    await expect(profilePhotos).toHaveAttribute('aria-expanded', 'false');
    await profilePhotos.click();
    await expect(profilePhotos).toHaveAttribute('aria-expanded', 'true');
    await expect(mediaHost.locator('[data-v110-media-toggle="belongings"]')).toHaveAttribute('aria-expanded', 'false');
    await expect(mediaHost.getByRole('button', { name: '＋ Add Stay Photos' })).toHaveCount(1);
    await mediaHost.locator('[data-v110-media-toggle="belongings"]').click();
    await expect(mediaHost.locator('[data-v110-media-toggle="belongings"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(mediaHost.getByText('No belongings photos saved for this visit.')).toBeVisible();
    expect(await mediaHost.locator('.v110-add-stay-photo').evaluate(button => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await expect(mediaHost.locator('.v110-media-view img').first()).toHaveAttribute('alt', 'Profile portrait');
    await sectionNav.locator('[data-v11160-tab="profile"]').click();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode .directory-roster-heading')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode .v1082-stay-tabs')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode .guest-directory-toolbar')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode #v11190ScanIntakePdfBtn')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode #v11190PdfOcrReviewNote')).toBeHidden();
    await expect(page.locator('.directory-dashboard-fused.is-profile-mode #directory-care-summary')).toBeHidden();
    await expect(careBrief.getByRole('heading', { name: 'Care essentials' })).toBeVisible();
    await expect(careBrief.locator('.directory-care-more-actions > summary')).toHaveText('More tools');
    await page.keyboard.press('Tab');
    await careBrief.locator('.directory-care-more-actions > summary').focus();
    await expect(careBrief.locator('.directory-care-more-actions > summary')).toHaveCSS('outline-style', 'solid');
    const readiness = careBrief.locator('.directory-care-readiness');
    await expect(careBrief.locator('.directory-care-more-actions .directory-care-readiness')).toHaveCount(1);
    await expect(careBrief.locator('.directory-care-owner-line [data-care-brief-call-owner]')).toHaveCount(1);
    await expect(careBrief.locator('[data-care-brief-call-owner]')).toHaveCount(1);
    await expect(readiness).toBeVisible();
    await expect(readiness).not.toHaveAttribute('open', '');
    await expect(careBrief.locator('[data-care-readiness-summary]')).toHaveText(/Needs identity review|Add handover|Details/);
    await expect(careBrief.locator('[data-care-brief-safety]')).toBeVisible();
    const supportingDetails = careBrief.locator('[data-care-brief-supporting-details]');
    await expect(supportingDetails).not.toHaveAttribute('open', '');
    await expect(careBrief.locator('[data-care-brief-safety]')).toBeVisible();
    await expect(careBrief.locator('[data-care-brief-medication]')).toBeVisible();
    await expect(careBrief.locator('[data-care-brief-feeding]')).toBeHidden();
    const supportingSummary = supportingDetails.locator(':scope > summary');
    const supportingToggleHeight = await supportingSummary.evaluate(node => node.getBoundingClientRect().height);
    expect(supportingToggleHeight).toBeGreaterThanOrEqual(44);
    await supportingSummary.click();
    await expect(careBrief.locator('[data-care-brief-feeding]')).toBeVisible();
    await expect(careBrief.locator('.directory-care-owner-label')).toBeVisible();
    await expect(careBrief.getByRole('heading', { name: 'Handover note', exact: true })).toBeVisible();
    await supportingSummary.click();
    await expect(supportingDetails).not.toHaveAttribute('open', '');
    await readiness.locator('summary').click();
    await expect(readiness).toHaveAttribute('open', '');
    await revealSecondaryTools(page);
    await expect(records).toBeVisible();
    await expect(records).not.toHaveAttribute('open', '');
    await expect(contactDisclosure).toBeVisible();
    await expect(contactDisclosure).not.toHaveAttribute('open', '');
    await expect(contactDisclosure.locator('[data-directory-edit-field]')).toHaveCount(3);
    await contactDisclosure.locator('summary').click();
    await expect(contactDisclosure.locator('[data-directory-edit-field="ownerName"]')).toBeVisible();
    await expect(contactDisclosure.locator('[data-directory-edit-field="phone"]')).toBeVisible();
    await contactDisclosure.locator('summary').click();
    await expect(careBrief.getByRole('link', { name: 'Call owner' })).toBeHidden();
    await supportingSummary.click();
    await expect(careBrief.getByRole('link', { name: 'Call owner' })).toHaveAttribute('href', 'tel:0400123456');
    await supportingSummary.click();
    expect(await careBrief.locator('.directory-care-brief-action:visible').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44))).toBeTruthy();
    const moreActions = careBrief.locator('.directory-care-more-actions');
    await revealSecondaryTools(page);
    await expect(sectionNav.locator('[data-v11160-tab="belongings"]')).toBeVisible();
    await expect(moreActions.locator('[data-care-brief-action="belongings"]')).toHaveCount(0);
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
    await expect(historyHost).toContainText('Dog ID #00017');
    await expect(historyHost.locator('.v108-stay-history details')).not.toHaveAttribute('open', '');
    expect(actionReads.filter(action => action === 'get_dog_history')).toHaveLength(name === '390-light' ? 2 : 1);
    expect(actionReads.payloads.filter(entry => entry.action === 'get_dog_history')[0]?.payload.dogId).toBe(exactDogId);
    await expect(historyHost.locator('.v108-owner-list a')).toHaveAttribute('href', 'tel:0400123456');
    await sectionNav.locator('[data-v11160-tab="profile"]').click();
    await expect(page.locator('.directory-card.is-profile-active [data-profile-subtab="healthHome"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.directory-card.is-profile-active [data-intake-attribute="medicationInstructions"]')).toHaveValue(longCareInstruction);
    const selectedCard = page.locator('.directory-card.is-profile-active');
    const editCare = selectedCard.locator('[data-toggle-profile-edit]');
    await expect(editCare).toBeVisible();
    expect(await editCare.evaluate(button => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await editCare.evaluate(button => parseFloat(getComputedStyle(button).fontSize))).toBeGreaterThanOrEqual(14);
    await editCare.click();
    const medicationInput = selectedCard.locator('[data-intake-attribute="medicationInstructions"]');
    await expect(medicationInput).toBeEnabled();
    expect(await medicationInput.evaluate(input => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
    const discardCare = selectedCard.locator('[data-cancel-profile-edit]');
    await expect(discardCare).toBeVisible();
    expect(await discardCare.evaluate(button => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    const profileSave = selectedCard.locator('[data-directory-main-panel="profile"] [data-save-belongings]');
    await expect(profileSave).toBeVisible();
    expect(await profileSave.evaluate(button => {
      const luminance = color => {
        const values = color.match(/[\d.]+/g).slice(0, 3).map(Number);
        const channels = color.startsWith('color(srgb') ? values : values.map(value => value / 255);
        const linear = channels.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
      };
      const style = getComputedStyle(button);
      const [lighter, darker] = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
      return (lighter + .05) / (darker + .05);
    })).toBeGreaterThanOrEqual(4.5);
    expect(await profileSave.evaluate(button => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await discardCare.click();
    await expect(discardCare).toBeHidden();
    await expect(profileSave).toBeHidden();
    await expect(medicationInput).toHaveValue(longCareInstruction);
    await page.locator('.directory-card.is-profile-active [data-profile-subtab="safety"]').scrollIntoViewIfNeeded();
    await page.locator('.directory-card.is-profile-active [data-profile-subtab="safety"]').evaluate(button => button.click());
    await expect(page.locator('.directory-card.is-profile-active [data-profile-subtab="safety"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.directory-card.is-profile-active [data-care-risk-flag="foodAllergy"]')).toBeChecked();
    if (name === '320-light' || name === '1440-light') {
      await sectionNav.scrollIntoViewIfNeeded();
      await expect(page.locator('#wh75SettingsPanel')).not.toHaveClass(/is-open/);
      const screenshotPath = testInfo.outputPath('care-overview-and-tabs.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`CARE_REFINEMENT_SCREENSHOT ${screenshotPath}`);
    }
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
  await revealSecondaryTools(page);
  await card.locator('.directory-care-readiness > summary').click();
  const careBrief = card.locator('[data-directory-care-brief]');
  await expect(careBrief.locator('.directory-owner-contact-missing')).toHaveText('Phone unavailable');
  await expect(careBrief.locator('.directory-owner-contact-missing')).not.toHaveAttribute('aria-disabled', 'true');
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
  await revealSecondaryTools(page);
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
  // Profile selection can rebuild the card while the shared profile read is
  // still settling. Wait for the rendered profile detail before opening its
  // readiness disclosure so the test exercises the disclosure, not that race.
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true');
  await revealSecondaryTools(page);
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

async function revealSecondaryTools(page) {
  const tools = page.locator('.directory-card.is-profile-active .directory-care-more-actions');
  if (await tools.count() && await tools.getAttribute('open') === null) {
    await tools.locator(':scope > summary').click();
  }
}
