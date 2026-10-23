const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const calendar = fs.readFileSync(path.join(__dirname, 'fixtures/fullcalendar.global.min.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const care = fs.readFileSync(path.join(__dirname, '..', 'care.js'), 'utf8');
const careStartup = fs.readFileSync(path.join(__dirname, '..', 'care-startup-priority.js'), 'utf8');

const booking = { timestamp: '2026-10-16', dogName: 'Milo', breed: 'Collie', startDate: '2026-10-17', endDate: '2026-10-20', ownerName: 'Casey', phone: '+61400000000', notes: 'Call before pickup.', bookingType: 'Boarding', dogId: '11111111-1111-4111-8111-111111111111', stayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', dogNumber: '#00017', stayKey: 'milo|2026-10-17|2026-10-20' };
const profileRecord = { stayKey: booking.stayKey, identity: { stayKey: booking.stayKey, stayId: booking.stayId, dogId: booking.dogId }, resolution: { status: 'resolved', method: 'fixture' }, updatedAt: '2026-10-16T08:00:00Z', intakeAttributesSource: 'Saved profile', intakeAttributes: { feedingTimes: '8am and 6pm', foodAmount: '1 cup', foodBrandType: 'Sensitive formula', walksPerDay: '2 walks', walkDuration: '20 minutes', medicationInstructions: 'Give the saved medication with dinner. Call the owner if appetite changes.', notes: 'Give Milo time to settle after arrival.' }, riskFlags: { foodAllergy: true } };

async function installFixture(page, { seedOperationsRows = false } = {}) {
  const reads = [];
  const pendingReads = new Set();
  const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const fixtureCsv = [
    ['Timestamp', 'Dog Name', 'Breed', 'Start Date', 'End Date', 'Owner', 'Phone', 'Likes', 'Dislikes', 'Notes', 'Edit Link', 'Booking Type', 'Source', 'Dog ID', 'Stay ID', 'Dog Number'],
    [booking.timestamp, booking.dogName, booking.breed, '17/10/2026', '20/10/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', 'Boarding', 'Other', booking.dogId, booking.stayId, booking.dogNumber],
  ].map(row => row.map(csvCell).join(',')).join('\n');
  await page.addInitScript(({ csv, seedOperationsRows: seed }) => {
    const NativeDate = Date, now = NativeDate.UTC(2026, 9, 17, 12);
    function FixedDate(...args) { if (!new.target) return new NativeDate(now).toString(); return Reflect.construct(NativeDate, args.length ? args : [now], new.target); }
    FixedDate.prototype = NativeDate.prototype; Object.setPrototypeOf(FixedDate, NativeDate); FixedDate.now = () => now; globalThis.Date = FixedDate;
    if (seed) localStorage.setItem('boardingDataCache', csv);
  }, { csv: fixtureCsv, seedOperationsRows });
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Synthetic fixture blocks all writes' });
    if (url.includes('/waffle-app.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: app.replace('function renderDirectoryCareProfile(card, record) {', 'window.__renderDirectoryCareProfile = renderDirectoryCareProfile;\n    function renderDirectoryCareProfile(card, record) {').replace('function renderDirectoryIntakeAttributes(card, record) {', 'window.__renderDirectoryIntake = renderDirectoryIntakeAttributes;\n    function renderDirectoryIntakeAttributes(card, record) {') });
    if (url.includes('/care-startup-priority.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${careStartup}\n;(() => { const startup = window.WAFFLE_CARE_STARTUP; if (!startup) return; const schedule = startup.schedule.bind(startup); startup.schedule = (key, callback) => { const promise = schedule(key, callback); if (String(key) === 'ai-health') window.__careAiHealthStartupPromise = promise; return promise; }; })();` });
    if (url.includes('/care.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: care.replace('  function prepare() {', '  function prepare() {\n    window.__carePreparePasses = (window.__carePreparePasses || 0) + 1;').replace('  function wrapFunction(name) {', '  window.__carePrepareCard = prepareCard;\n  window.__careSchedulePrepare = schedulePrepare;\n  window.__carePendingPrepareDelays = () => [...prepareTimers.keys()];\n  window.__carePendingPanelReassertions = () => [...panelReassertionTimers.values()].reduce((sum, timers) => sum + timers.size, 0);\n  function wrapFunction(name) {') });
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: calendar });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      return route.fulfill({ status: 200, contentType: 'text/csv', body: fixtureCsv });
    }
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: 'Unapproved backend request' });
      const params = new URL(url).searchParams, callback = params.get('callback');
      reads.push(resolved.action);
      pendingReads.add(request);
      let response = { result: 'success', records: [], bookings: [], summaries: [] };
      if (resolved.action === 'get_guest_directory') response = { result: 'success', bookings: [booking], summaries: [{ stayKey: booking.stayKey, riskFlags: profileRecord.riskFlags }], digitalIntakes: [], legacyIntakes: [] };
      if (resolved.action === 'get_guest_profile') response = { result: 'success', record: profileRecord };
      if (resolved.action === 'get_guest_belongings') response = { result: 'success', record: { stayKey: booking.stayKey, items: {}, photos: [] } };
      if (resolved.action === 'maintenance_status') response = { result: 'success', enabled: false };
      try {
        return await route.fulfill({ status: 200, contentType: callback ? 'application/javascript' : 'application/json', body: callback ? `${callback}(${JSON.stringify(response)});` : JSON.stringify(response) });
      } finally {
        pendingReads.delete(request);
      }
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') {
      const type = request.resourceType();
      return route.fulfill({ status: 200, contentType: type === 'script' ? 'application/javascript' : type === 'stylesheet' ? 'text/css' : 'image/svg+xml', body: type === 'script' || type === 'stylesheet' ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' });
    }
    return route.continue();
  });
  Object.defineProperty(reads, 'pending', { value: pendingReads });
  return reads;
}

test('coalesced late Care preparation still adopts controls added after startup', async ({ page, baseURL }) => {
  const reads = await installFixture(page, { seedOperationsRows: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/directory.html?carePrepareFixture=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  const opener = page.locator('#directory-grid [data-open-directory-profile]');
  await expect(opener).toHaveCount(1);
  await opener.click();
  const card = page.locator('.directory-card.is-profile-active');
  await expect(card.locator('[data-v11160-tab="profile"]')).toBeVisible();
  // Wait for the actual bounded startup/wrapper timer queue to drain before
  // creating a new late-control burst; this is a lifecycle condition, not a
  // fixed sleep or guessed hydration delay.
  await page.waitForFunction(() => typeof window.__careSchedulePrepare === 'function'
    && window.__carePendingPrepareDelays().length === 0);
  await expect.poll(() => reads.pending.size).toBe(0);
  const before = await page.evaluate(() => window.__carePreparePasses || 0);
  const initialReads = [...reads];
  const backfill = page.locator('#p4BackfillDogIds');
  await expect(backfill).toHaveCount(1);
  await page.evaluate(() => {
    const toolbar = document.querySelector('.directory-roster-heading .guest-directory-toolbar');
    const control = document.getElementById('p4BackfillDogIds');
    if (!toolbar || !control) throw new Error('Expected the live Dog ID backfill control');
    window.__lateCareBackfill = control;
    control.remove();
    toolbar.append(control);
    const schedule = window.__careSchedulePrepare;
    schedule([0, 80, 240, 650]);
    schedule([0, 80, 240, 650]);
    schedule([0, 80, 240, 650]);
  });
  await expect.poll(() => backfill.evaluate(node => node.parentElement?.classList.contains('care-record-maintenance-content') && node === window.__lateCareBackfill)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__carePreparePasses || 0)).toBe(before + 4);
  await page.waitForFunction(() => window.__carePendingPrepareDelays().length === 0);
  expect(reads).toEqual(initialReads);
  await page.locator('#directoryBackToGuestsBtn').click();
  await page.locator('.care-record-maintenance > summary').click();
  await expect(backfill).toBeVisible();
  await backfill.focus();
  await expect(backfill).toBeFocused();

  const profileOpener = page.locator('#directory-grid [data-open-directory-profile]');
  await profileOpener.click();
  const reopenedCard = page.locator('.directory-card.is-profile-active');
  const ownerLink = reopenedCard.locator('.directory-care-brief-actions > [data-care-owner-link-group] > [data-p4-dir="owner"]');
  await expect(ownerLink).toBeVisible();
  const intentBaseline = [...reads];
  await ownerLink.click();
  await expect(page.locator('#p4Modal')).toBeVisible();
  await page.locator('#p4TabReminders').click();
  await expect(page.locator('#p4Reminders')).not.toContainText('Checking today and the next 7 days…');
  const intentReads = reads.slice(intentBaseline.length);
  expect(intentReads).toEqual(['get_intake_statuses', 'get_belongings']);
  await page.locator('#p4TabInsights').click();
  await expect(page.locator('#p4Insights')).toContainText('stays touching this month');
  expect(reads.slice(intentBaseline.length)).toEqual(intentReads);
});

test('a repeated Care preparation preserves the profile and produces no repeated DOM writes or profile reads', async ({ page, baseURL }) => {
  const reads = await installFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseURL}/directory.html?carePreparationPerfFixture=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true'
    && typeof window.__carePrepareCard === 'function');
  const opener = page.locator('#directory-grid [data-open-directory-profile]');
  await expect(opener).toHaveCount(1);
  await opener.click();
  const card = page.locator('.directory-card.is-profile-active');
  const details = card.locator('[data-directory-detail="profile"]');
  await expect(details).toHaveAttribute('data-detail-loaded', 'true');
  await expect(details).toContainText('Give the saved medication with dinner. Call the owner if appetite changes.');
  await expect.poll(() => reads.pending.size).toBe(0);
  await page.waitForFunction(() => window.__carePendingPanelReassertions() === 0);
  const beforeReadCount = reads.filter(action => action === 'get_guest_profile').length;

  await card.evaluate(node => {
    window.__careTabPanelMutationCount = 0;
    const observer = new MutationObserver(records => { window.__careTabPanelMutationCount += records.length; });
    const options = { attributes: true, attributeFilter: ['aria-controls', 'aria-hidden', 'aria-labelledby', 'aria-selected', 'class', 'hidden', 'id', 'role', 'tabindex'] };
    observer.observe(node.querySelector('.v11160-desktop-tabs'), options);
    node.querySelectorAll('[data-v11160-managed-panel="true"]').forEach(panel => observer.observe(panel, options));
    window.__careTabPanelObserver = observer;
    window.__carePrepareCard(node);
    window.__carePrepareCard(node);
    window.__carePrepareCard(node);
  });
  await page.waitForFunction(() => window.__carePendingPanelReassertions() === 0);
  const mutations = await page.evaluate(() => {
    window.__careTabPanelObserver.disconnect();
    return window.__careTabPanelMutationCount;
  });

  expect(mutations).toBe(0);
  expect(reads.filter(action => action === 'get_guest_profile')).toHaveLength(beforeReadCount);
  expect(reads).not.toContain('save_guest_profile');
  await expect(details).toContainText('Give the saved medication with dinner. Call the owner if appetite changes.');

  const repairedControls = await card.evaluate(node => {
    const photo = node.querySelector('.directory-photo-shell');
    const tools = node.querySelector('.directory-care-photo-tools > div');
    const gallery = node.querySelector('[data-v108-gallery]');
    const operationBar = node.querySelector('[data-v110-operation-bar]');
    if (!photo || !tools || !gallery || !operationBar) throw new Error('Expected initialized photo and operation controls');
    photo.append(gallery);
    operationBar.remove();
    window.__carePrepareCard(node);
    return { galleryReturned: gallery.parentElement === tools, operationBarRestored: !!node.querySelector('[data-v110-operation-bar]') };
  });
  expect(repairedControls).toEqual({ galleryReturned: true, operationBarRestored: true });
});

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
    const ownerLink = card.locator('.directory-care-brief-actions > [data-care-owner-link-group] > [data-p4-dir="owner"]');
    await expect(ownerLink).toBeVisible();
    await expect(ownerLink).toHaveAccessibleName('Owner Care Link for Milo');
    await expect(card.locator('[data-p4-dir="owner"]')).toHaveCount(1);
    await expect(tools.locator('[data-p4-dir="owner"]')).toHaveCount(0);
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
    // The Apps Script health check is a separately scheduled Care startup job.
    // Await the scheduler's real returned promise so a late health read cannot
    // race the interaction baseline; do not use an elapsed-time delay here.
    await page.waitForFunction(() => window.__careAiHealthStartupPromise instanceof Promise);
    await page.evaluate(() => window.__careAiHealthStartupPromise);
    await expect(card.locator('[data-care-brief-medication]')).toHaveText(profileRecord.intakeAttributes.medicationInstructions);
    // Wait for all currently dispatched route responses before capturing the
    // tools-only baseline; Care intentionally leaves unused secondary data lazy.
    await expect.poll(() => reads.pending.size).toBe(0);
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
    await expect(bookingButtons).toHaveCount(1);
    await expect(bookingButtons.nth(0)).toContainText('Book Again');
    expect(reads).toEqual(initialReads);
    await expect(page.locator('#wh75SettingsPanel')).not.toHaveClass(/is-open/);
    await testInfo.attach(`care-profile-tools-expanded-${name}`, { body: await page.screenshot({ path: testInfo.outputPath(`care-profile-tools-expanded-${name}.png`), fullPage: true }), contentType: 'image/png' });
    await bookingTools.locator(':scope > summary').click();
    await records.locator(':scope > summary').click();
    await summary.click();
    await expect(tools).not.toHaveAttribute('open', '');
    await expect(records).not.toHaveAttribute('open', '');

    await summary.click();
    const readiness = tools.locator('.directory-care-readiness');
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
    // The share action is direct even with every secondary group closed.
    await summary.click();
    await expect(tools).not.toHaveAttribute('open', '');
    await expect(ownerLink).toBeVisible();
    await ownerLink.focus();
    const unchangedTools = await ownerLink.evaluate(button => {
      const card = button.closest('.directory-card');
      const observer = new MutationObserver(() => {});
      observer.observe(card, { childList: true, subtree: true, attributes: true });
      window.WAFFLE_PHASE4_BOOKING.enhanceDirectory();
      window.WAFFLE_PHASE4_BOOKING.enhanceDirectory();
      const mutations = observer.takeRecords().length;
      observer.disconnect();
      return { mutations, sameButton: card.querySelector('[data-p4-dir="owner"]') === button, focused: document.activeElement === button };
    });
    expect(unchangedTools).toEqual({ mutations: 0, sameButton: true, focused: true });
    const profileReadsBeforeShare = reads.filter(action => action === 'get_guest_profile').length;
    const historyReadsBeforeShare = reads.filter(action => action === 'get_dog_history').length;
    await ownerLink.click();
    await expect(page.locator('#p4OwnerLink')).toBeFocused();
    await expect(page.locator('#p4OwnerBookingContext')).toContainText('Dog ID #00017');
    await expect(page.locator('#p4OwnerDog')).toHaveValue(booking.dogName);
    await expect(page.locator('#p4OwnerStart')).toHaveValue(booking.startDate);
    await expect(page.locator('#p4OwnerEnd')).toHaveValue(booking.endDate);
    await expect.poll(() => reads.filter(action => action === 'get_dog_history').length).toBe(historyReadsBeforeShare);
    await page.locator('#p4Modal [data-p4-close]').click();
    await expect(ownerLink).toBeFocused();
    await expect(amount).toHaveValue('2 cups draft');
    expect(reads.filter(action => action === 'get_guest_profile')).toHaveLength(profileReadsBeforeShare);
    await testInfo.attach(`care-profile-tools-${name}`, { body: await page.screenshot({ path: testInfo.outputPath(`care-profile-tools-${name}.png`), fullPage: true }), contentType: 'image/png' });
  });
}
