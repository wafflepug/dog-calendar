const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const calendar = fs.readFileSync(path.join(__dirname, 'fixtures/fullcalendar.global.min.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');

const booking = { timestamp: '2026-10-16', dogName: 'Milo', breed: 'Collie', startDate: '2026-10-17', endDate: '2026-10-20', ownerName: 'Casey', phone: '+61400000000', notes: 'Call before pickup.', bookingType: 'Boarding', dogId: '11111111-1111-4111-8111-111111111111', stayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', dogNumber: '#00017', stayKey: 'milo|2026-10-17|2026-10-20' };
const profileRecord = { stayKey: booking.stayKey, identity: { stayKey: booking.stayKey, stayId: booking.stayId, dogId: booking.dogId }, resolution: { status: 'resolved', method: 'fixture' }, updatedAt: '2026-10-16T08:00:00Z', intakeAttributesSource: 'Saved profile', intakeAttributes: { feedingTimes: '8am and 6pm', foodAmount: '1 cup', foodBrandType: 'Sensitive formula', walksPerDay: '2 walks', walkDuration: '20 minutes', medicationInstructions: 'Give the saved medication with dinner. Call the owner if appetite changes.', notes: 'Give Milo time to settle after arrival.' }, riskFlags: { foodAllergy: true } };

async function installFixture(page) {
  const reads = [];
  await page.addInitScript(() => {
    const NativeDate = Date, now = NativeDate.UTC(2026, 9, 17, 12);
    function FixedDate(...args) { if (!new.target) return new NativeDate(now).toString(); return Reflect.construct(NativeDate, args.length ? args : [now], new.target); }
    FixedDate.prototype = NativeDate.prototype; Object.setPrototypeOf(FixedDate, NativeDate); FixedDate.now = () => now; globalThis.Date = FixedDate;
  });
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Synthetic fixture blocks all writes' });
    if (url.includes('/waffle-app.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: app.replace('function renderDirectoryCareProfile(card, record) {', 'window.__renderDirectoryCareProfile = renderDirectoryCareProfile;\n    function renderDirectoryCareProfile(card, record) {').replace('function renderDirectoryIntakeAttributes(card, record) {', 'window.__renderDirectoryIntake = renderDirectoryIntakeAttributes;\n    function renderDirectoryIntakeAttributes(card, record) {') });
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: calendar });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      const row = [booking.timestamp, booking.dogName, booking.breed, '17/10/2026', '20/10/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', 'Boarding', 'Other', booking.dogId, booking.stayId, booking.dogNumber];
      return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n' + row.join(',') });
    }
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: 'Unapproved backend request' });
      const params = new URL(url).searchParams, callback = params.get('callback');
      reads.push(resolved.action);
      let response = { result: 'success', records: [], bookings: [], summaries: [] };
      if (resolved.action === 'get_guest_directory') response = { result: 'success', bookings: [booking], summaries: [{ stayKey: booking.stayKey, riskFlags: profileRecord.riskFlags }], digitalIntakes: [], legacyIntakes: [] };
      if (resolved.action === 'get_guest_profile') response = { result: 'success', record: profileRecord };
      if (resolved.action === 'get_guest_belongings') response = { result: 'success', record: { stayKey: booking.stayKey, items: {}, photos: [] } };
      if (resolved.action === 'maintenance_status') response = { result: 'success', enabled: false };
      return route.fulfill({ status: 200, contentType: callback ? 'application/javascript' : 'application/json', body: callback ? `${callback}(${JSON.stringify(response)});` : JSON.stringify(response) });
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') {
      const type = request.resourceType();
      return route.fulfill({ status: 200, contentType: type === 'script' ? 'application/javascript' : type === 'stylesheet' ? 'text/css' : 'image/svg+xml', body: type === 'script' || type === 'stylesheet' ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' });
    }
    return route.continue();
  });
  return reads;
}

for (const [name, width, colorScheme] of [['320-light', 320, 'light'], ['320-dark', 320, 'dark'], ['390-light', 390, 'light'], ['390-dark', 390, 'dark'], ['1440-light', 1440, 'light'], ['1440-dark', 1440, 'dark']]) {
  test(`Care profile secondary tools behave correctly ${name}`, async ({ page, baseURL }, testInfo) => {
    const reads = await installFixture(page);
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.emulateMedia({ colorScheme });
    await page.addInitScript(mode => localStorage.setItem('theme', mode), colorScheme);
    await page.goto(`${baseURL}/directory.html?careProfileToolsFixture=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const opener = page.locator('#directory-grid [data-open-directory-profile]');
    await expect(opener).toHaveCount(1);
    await opener.click();
    const card = page.locator('.directory-card.is-profile-active');
    await expect(card).toHaveCount(1);

    const tools = card.locator('.directory-care-more-actions');
    const summary = tools.locator(':scope > summary');
    const list = tools.locator(':scope > .directory-care-more-actions-list');
    await expect(summary).toHaveText('More tools');
    await expect(tools).not.toHaveAttribute('open', '');
    await expect(list.locator('[data-care-brief-action="belongings"]')).toHaveCount(0);
    await expect(card.locator('[data-v11160-tab="belongings"]')).toBeVisible();
    const records = list.locator('.directory-care-records-disclosure');
    const bookingTools = list.locator('.p4-directory-actions');
    await expect(records).toHaveCount(1);
    await expect(bookingTools).toHaveCount(1);
    await expect(card.locator('[data-care-brief-action="full-profile"]')).toBeVisible();
    await expect(card.locator('[data-v110-checkin]')).toBeVisible();
    const stayMore = card.locator('.v11217-profile-more-actions');
    await expect(stayMore).toHaveCount(1);
    await expect(stayMore.locator(':scope > summary')).toBeVisible();
    const deleteGroup = tools.locator(':scope > .directory-care-danger-actions');
    await expect(deleteGroup).toHaveCount(1);
    await expect(deleteGroup).toContainText('Remove stay');
    await expect(deleteGroup.locator('[data-v11198-delete-confirmed]')).toHaveCount(1);
    await expect(deleteGroup.locator('[data-v11198-delete-confirmed]')).toBeHidden();

    // Wait for the independent startup Past-count read before measuring tools-only reads.
    await expect.poll(() => reads.filter(action => action === 'get_past_guest_directory').length).toBe(1);
    await expect(card.locator('[data-care-brief-medication]')).toHaveText(profileRecord.intakeAttributes.medicationInstructions);
    const initialReads = [...reads];
    await page.keyboard.press('Tab');
    await summary.focus();
    await expect(summary).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    await expect(tools).toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    await expect(list.locator('[data-care-brief-action="edit"]')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(tools).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    expect(reads).toEqual(initialReads);

    await summary.click();
    await expect(tools).toHaveAttribute('open', '');
    await expect(records).not.toHaveAttribute('open', '');
    await expect(bookingTools).not.toHaveAttribute('open', '');
    await records.locator(':scope > summary').click();
    await expect(records).toHaveAttribute('open', '');
    await bookingTools.locator(':scope > summary').click();
    await expect(bookingTools).toHaveAttribute('open', '');
    const bookingButtons = bookingTools.locator('.p4-directory-action-list button[data-p4-dir]');
    await expect(bookingButtons).toHaveCount(2);
    await expect(bookingButtons.nth(0)).toContainText('Owner Care Link');
    await expect(bookingButtons.nth(1)).toContainText('Book Again');
    expect(reads).toEqual(initialReads);
    await expect(page.locator('#wh75SettingsPanel')).not.toHaveClass(/is-open/);
    await testInfo.attach(`care-profile-tools-expanded-${name}`, { body: await page.screenshot({ path: testInfo.outputPath(`care-profile-tools-expanded-${name}.png`), fullPage: true }), contentType: 'image/png' });
    await bookingTools.locator(':scope > summary').click();
    await records.locator(':scope > summary').click();
    await summary.click();
    await expect(tools).not.toHaveAttribute('open', '');
    await expect(records).not.toHaveAttribute('open', '');

    const readiness = card.locator('.directory-care-readiness');
    await readiness.locator(':scope > summary').click();
    await readiness.locator('[data-care-readiness-action="intake"]').click();
    await expect(tools).toHaveAttribute('open', '');
    await expect(records).toHaveAttribute('open', '');
    const createLink = records.locator('[data-create-intake-link]');
    await expect(createLink).toBeVisible();
    await expect(createLink).toBeFocused();
    expect(reads).toEqual(initialReads);

    await list.evaluate(node => { window.__toolsListNode = node; window.__toolsButtonNodes = [...node.querySelectorAll('button')]; });
    const actionIdentity = await list.locator('button').evaluateAll(nodes => nodes.map(node => ({ node, text: node.textContent.trim(), action: node.getAttribute('data-p4-dir') || node.getAttribute('data-care-brief-action') })));
    const callOwner = card.locator('a[href^="tel:"]');
    await expect(callOwner).toHaveCount(1);
    await expect(callOwner).toBeVisible();

    const med = card.locator('[data-care-brief-medication]');
    await expect(med).toContainText(profileRecord.intakeAttributes.medicationInstructions);
    await expect(card.locator('[data-care-brief-safety]')).toContainText('Food Allergy');
    await expect(card.locator('.directory-care-brief-note .directory-care-brief-value')).toHaveText(booking.notes);

    // Re-render the profile's real safety panel and make sure the tools disclosure and
    // its existing action buttons retain their DOM identity and open state.
    await page.evaluate(record => window.__renderDirectoryCareProfile(document.querySelector('.directory-card.is-profile-active'), record), profileRecord);
    await expect(tools).toHaveAttribute('open', '');
    expect(await list.evaluate(node => node === window.__toolsListNode && [...node.querySelectorAll('button')].every((button, index) => button === window.__toolsButtonNodes[index]))).toBe(true);
    expect(await list.locator('button').evaluateAll(nodes => nodes.map(node => ({ text: node.textContent.trim(), action: node.getAttribute('data-p4-dir') || node.getAttribute('data-care-brief-action') })))).toEqual(actionIdentity.map(({ text, action }) => ({ text, action })));
    const editCare = list.locator('[data-care-brief-action="edit"]');
    await editCare.focus();
    await expect(editCare).toBeFocused();
    await page.evaluate(record => window.__renderDirectoryCareProfile(document.querySelector('.directory-card.is-profile-active'), record), profileRecord);
    await expect(editCare).toBeFocused();
    await editCare.click();
    await expect(card).toHaveClass(/is-profile-editing/);
    const foodWalksTab = card.locator('[data-profile-subtab="foodWalks"]');
    if (await foodWalksTab.getAttribute('aria-expanded') !== 'true') await foodWalksTab.click();
    const amount = card.locator('[data-intake-attribute="foodAmount"]');
    await expect(amount).toBeVisible();
    await amount.fill('2 cups draft');
    await amount.focus();
    await page.evaluate(record => window.__renderDirectoryIntake(document.querySelector('.directory-card.is-profile-active'), record), profileRecord);
    await expect(amount).toHaveValue('2 cups draft');
    await expect(amount).toBeFocused();
    await expect(tools).toHaveAttribute('open', '');
    expect(reads).toEqual(initialReads);

    const geometry = await page.evaluate(() => {
      const doc = document.documentElement, footer = document.getElementById('wh75MobileBottomNav'), footerRect = footer?.getBoundingClientRect();
      const buttons = [...document.querySelectorAll('.directory-care-more-actions-list button')].filter(button => button.getClientRects().length);
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, buttons: buttons.map(button => { const rect = button.getBoundingClientRect(); return { height: rect.height, right: rect.right, covered: !!footerRect?.height && rect.bottom > footerRect.top && rect.top < footerRect.bottom }; }) };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.buttons.every(button => button.height >= 44 && button.right <= width + 1 && !button.covered)).toBeTruthy();
    await testInfo.attach(`care-profile-tools-${name}`, { body: await page.screenshot({ path: testInfo.outputPath(`care-profile-tools-${name}.png`), fullPage: true }), contentType: 'image/png' });
  });
}
