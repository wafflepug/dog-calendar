const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const calendar = fs.readFileSync(path.join(__dirname, 'fixtures/fullcalendar.global.min.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const booking = { timestamp: '2026-10-16', dogName: 'Milo', breed: 'Collie', startDate: '2026-10-17', endDate: '2026-10-20', ownerName: 'Casey', phone: '0400000000', notes: 'Call before pickup.', bookingType: 'Boarding', dogId: '11111111-1111-4111-8111-111111111111', stayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', dogNumber: '#00017', stayKey: 'milo|2026-10-17|2026-10-20' };
const record = { stayKey: booking.stayKey, identity: { stayKey: booking.stayKey, stayId: booking.stayId, dogId: booking.dogId }, resolution: { status: 'resolved', method: 'fixture' }, updatedAt: '2026-10-16T08:00:00Z', intakeAttributesSource: 'Saved profile', intakeAttributes: { feedingTimes: '8am and 6pm', foodAmount: '1 cup', foodBrandType: 'Sensitive formula', walksPerDay: '2 walks', walkDuration: '20 minutes', medicationInstructions: 'Give the saved medication with dinner. Call the owner if appetite changes.' }, riskFlags: { foodAllergy: true } };

async function fixture(page, { reminders = [], profileRecord = record, checkinMode = 'blocked' } = {}) {
  const reads = [];
  reads.writes = [];
  let checkinAttempts = 0;
  await page.addInitScript(() => {
    const NativeDate = Date, now = NativeDate.UTC(2026, 9, 17, 12);
    function FixedDate(...args) { if (!new.target) return new NativeDate(now).toString(); return Reflect.construct(NativeDate, args.length ? args : [now], new.target); }
    FixedDate.prototype = NativeDate.prototype; Object.setPrototypeOf(FixedDate, NativeDate); FixedDate.now = () => now; globalThis.Date = FixedDate;
  });
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) { reads.writes.push({ method: request.method(), url }); return route.fulfill({ status: 405, body: 'Synthetic fixture blocks all writes' }); }
    if (url.includes('/waffle-app.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: app.replace('function renderDirectoryIntakeAttributes(', 'window.__renderCondensedIntake = renderDirectoryIntakeAttributes;\n    function renderDirectoryIntakeAttributes(').replace('function switchDirectoryProfileSubTab(', 'window.__switchSimpleSection = switchDirectoryProfileSubTab;\n    function switchDirectoryProfileSubTab(').replace('function updateDirectoryProfileEditFeedback(', 'window.__setCareEditTestState = changes => { const card=document.querySelector(".directory-card.is-profile-active"); Object.assign(directoryProfileEditDrafts.get(directoryProfileEditKey(card)),changes); updateDirectoryProfileEditFeedback(card); applyDirectoryProfileEditMode(card); };\nfunction updateDirectoryProfileEditFeedback(') });
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: calendar });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n' + [booking.timestamp, booking.dogName, booking.breed, '17/10/2026', '20/10/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', 'Boarding', 'Other', booking.dogId, booking.stayId, booking.dogNumber].join(',') });
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      const params = new URL(url).searchParams, callback = params.get('callback');
      if (resolved.action === 'checkin_stay' && checkinMode !== 'blocked') {
        checkinAttempts += 1;
        reads.writes.push({ method: request.method(), url });
        const failed = checkinMode === 'fail-first' && checkinAttempts === 1;
        const outcome = failed
          ? { result: 'error', error: 'HTTP 503 server error in check-in fixture' }
          : { result: 'success', record: { stayId: booking.stayId, stayKey: booking.stayKey, status: 'checked_in', startDate: booking.startDate, endDate: booking.endDate, dogName: booking.dogName } };
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(outcome)});` });
      }
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: 'Unapproved backend request' });
      reads.push(resolved.action);
      let response = { result: 'success', records: [], bookings: [], summaries: [] };
      if (resolved.action === 'get_data_versions') response = { result: 'success', versions: { stayOperationIdentityVersion: 1 } };
      if (resolved.action === 'get_guest_directory') response = { result: 'success', bookings: [booking], summaries: [{ stayKey: booking.stayKey, riskFlags: record.riskFlags }], digitalIntakes: [], legacyIntakes: [] };
      if (resolved.action === 'get_reminders_notes') response = { result:'success', records:reminders };
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

test('actual Care profile stays compact, keeps exceptions visible and preserves editable fields without extra reads', async ({ page, baseURL }, testInfo) => {
  const reads = await fixture(page);
  for (const [width, theme] of [[320, 'light'], [320, 'dark'], [390, 'light'], [390, 'dark'], [1440, 'light'], [1440, 'dark']]) {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(mode => localStorage.setItem('theme', mode), theme);
    await page.goto(`${baseURL}/directory.html?condensedCareFixture=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const opener = page.locator('#directory-grid [data-open-directory-profile]');
    await expect(opener).toHaveCount(1);
    const before = reads.filter(x => x === 'get_guest_profile').length;
    await opener.click();
    const card = page.locator('.directory-card.is-profile-active');
    await expect(card).toHaveCount(1);
    await expect(card.locator('[data-care-brief-medication]')).toHaveText(record.intakeAttributes.medicationInstructions);
    await expect(card.locator('[data-care-brief-safety]')).toContainText('Food Allergy');
    await expect(card.locator('.directory-card-header')).toHaveCount(1);
    await expect(card.locator('.directory-card-header .directory-photo-shell')).toHaveCount(1);
    await expect(card.locator('.directory-card-header .directory-dog-name-btn')).toBeVisible();
    await expect(card.locator('.directory-card-header .directory-dog-id')).toContainText('Dog ID');
    await expect(card.locator('.directory-profile-stay-dates')).toContainText('Check-in');
    await expect(card.locator('.directory-profile-stay-dates')).toContainText('Check-out');
    await expect(card.locator('[data-v110-checkin]')).toBeVisible();
    await expect(card.locator('[data-v110-operation-bar]')).toBeVisible();
    await expect(card.locator('[data-v110-checkin]')).toHaveCount(1);
    await expect(card.locator('[data-care-brief-feeding]')).toBeVisible();
    await expect(card.locator('[data-care-brief-walks]')).toBeVisible();
    await expect(card.locator('.directory-care-owner-line')).toBeVisible();
    await expect(card.locator('[data-care-brief-handover-note]')).toBeVisible();
    await expect(card.locator('[data-care-brief-safety]')).toBeVisible();
    await expect(card.locator('[data-care-brief-medication]')).toBeVisible();
    await expect(page.locator('#wh75SettingsPanel')).not.toHaveClass(/is-open/);
    const early = card.locator('[data-v110-operation-bar] [data-v11217-early-checkout]');
    await expect(early).toBeHidden();
    await card.locator('.v11217-profile-more-actions > summary').click();
    await expect(page.locator('#wh75SettingsPanel')).not.toHaveClass(/is-open/);
    await expect(early).toBeVisible();
    await card.locator('.v11217-profile-more-actions > summary').click();
    await expect(page.locator('#wh75SettingsPanel')).not.toHaveClass(/is-open/);
    const afterOpen = reads.filter(x => x === 'get_guest_profile').length;
    expect(afterOpen - before).toBeLessThanOrEqual(1);
    await expect(card.locator('[data-care-brief-feeding]')).toContainText('1 cup');
    await expect(card.locator('[data-care-brief-walks]')).toContainText('2 walks');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    const brief = card.locator('[data-directory-care-brief]');
    const tools = brief.locator('.directory-care-more-actions');
    await expect(brief.locator('[data-care-readiness-action="safety"], [data-care-readiness-action="feeding"], [data-care-readiness-action="medication"]')).toHaveCount(0);
    await expect(brief.locator('.directory-care-brief-actions > [data-care-owner-link-group] > [data-p4-dir="owner"]')).toBeVisible();
    await expect(brief.locator('[data-care-brief-call-owner] a')).toBeVisible();
    await expect(brief.locator('.directory-care-brief-note')).toContainText(booking.notes);
    await expect(page.locator('#directoryProfileBackBar .directory-profile-tools')).toBeHidden();
    await expect(card.locator('[data-directory-profile-roster-badges] [data-v1118-care-signals]')).toBeHidden();
    await expect(tools).not.toHaveAttribute('open', '');
    for (const selector of ['.directory-care-readiness', '[data-directory-stay-contact]', '.directory-care-records-disclosure']) {
      await expect(tools.locator(selector)).toHaveCount(1);
      await expect(tools.locator(`${selector} > summary`)).toBeHidden();
    }
    const readsBeforeTools = reads.filter(x => x === 'get_guest_profile').length;
    const handoverAction = brief.locator('.directory-care-brief-note [data-care-brief-action="handover"]');
    const emergencyAction = brief.locator('.directory-care-brief-safety [data-care-brief-action="emergency-contact"]');
    await expect(handoverAction).toHaveCount(1);
    await expect(handoverAction).toBeVisible();
    await expect(emergencyAction).toHaveCount(1);
    await expect(emergencyAction).toHaveText('Emergency details');
    await expect(emergencyAction).toBeVisible();
    await expect(brief.locator('.directory-care-brief-actions [data-care-brief-action="handover"], .directory-care-brief-actions [data-care-brief-action="emergency-contact"]')).toHaveCount(0);
    const toolsToggle = tools.locator(':scope > summary');
    await toolsToggle.focus();await page.keyboard.press('Enter');
    await expect(tools.locator('[data-care-brief-action="refresh"]')).toBeVisible();
    await expect(tools.locator('[data-care-brief-action="handover"], [data-care-brief-action="emergency-contact"]')).toHaveCount(0);
    await page.keyboard.press('Space');await expect(tools).not.toHaveAttribute('open', '');
    expect(reads.filter(x => x === 'get_guest_profile').length).toBe(readsBeforeTools);
    const aligned = await brief.locator('.directory-care-brief-grid').evaluate(grid => {const bounds=grid.getBoundingClientRect();return [...grid.children].every(row=>Math.abs(row.getBoundingClientRect().left-bounds.left)<2 && Math.abs(row.getBoundingClientRect().right-bounds.right)<2)});
    expect(aligned).toBe(true);
    const box = await card.locator('[data-care-brief-medication]').evaluate(el => ({height:el.clientHeight,scroll:el.scrollHeight,clamp:getComputedStyle(el).webkitLineClamp}));
    expect(box.scroll).toBeLessThanOrEqual(box.height + 1);expect(['none','unset',''].includes(box.clamp)).toBe(true);
    await expect(page.locator('#wh75SettingsPanel')).not.toHaveClass(/is-open/);
    await card.locator('.directory-card-header').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`care-opening-${width}-${theme}.png`) });
    const evidencePath = path.join(__dirname, '..', 'output', 'care-daily-simplicity');
    fs.mkdirSync(evidencePath, { recursive: true });
    await page.screenshot({ path: path.join(evidencePath, `profile-${width}-${theme}.png`) });

    await card.locator('[data-care-brief-action="full-profile"]').click();
    const toggle = card.locator('[data-profile-subtab="foodWalks"]');
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await expect(card.locator('[data-intake-read-attribute="foodAmount"]')).toContainText('1 cup');
    await expect(card.locator('[data-intake-attribute="foodAmount"]')).toBeHidden();
    for (const group of await card.locator('.care-category-panel > .intake-profile-group').all()) await expect(group).toBeHidden();
    await card.locator('[data-profile-subpanel="foodWalks"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`care-details-${width}-${theme}.png`) });
    await card.locator('.directory-care-more-actions > summary').click();
    await card.locator('[data-care-brief-action="edit"]').click();
    await expect(card).toHaveClass(/is-profile-editing/);
    const amount = card.locator('[data-intake-attribute="foodAmount"]');
    await expect(amount).toBeVisible();
    await amount.fill('2 cups draft');
    await amount.focus();
    await page.evaluate(data => window.__renderCondensedIntake(document.querySelector('.directory-card.is-profile-active'), data), record);
    await expect(amount).toHaveValue('2 cups draft');
    await expect(amount).toBeFocused();
    expect(reads.filter(x => x === 'get_guest_profile')).toHaveLength(afterOpen);
    await page.locator('#directoryBackToGuestsBtn').click();
    await expect(page.locator('.directory-card.is-profile-active')).toHaveCount(0);
    await expect(opener.locator('[data-v1118-signal-label="Food allergy"]')).toBeVisible();
  }
});

for (const [task, expectedAction, destination] of [
  ['medication', 'get_guest_profile', 'healthHome'],
  ['belongings', 'get_guest_belongings', 'belongings']
]) {
  test(`roster ${task} task opens the same selected Care profile and its read-only destination`, async ({ page, baseURL }) => {
    const reads = await fixture(page, { checkinMode: task === 'medication' ? 'success' : 'blocked' });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`${baseURL}/directory.html?arrivalTaskFixture=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const card = page.locator(`.directory-card[data-directory-stay-id="${booking.stayId}"]`);
    const taskButton = card.locator(`[data-arrival-task="${task}"]`);
    await card.locator('[data-arrival-task-list] > summary').click();
    await expect(taskButton).toBeVisible();
    const profileReadsBefore = reads.filter(action => action === 'get_guest_profile').length;
    await taskButton.click();
    await expect(card).toHaveClass(/is-profile-active/);
    await expect(page.locator('.directory-card.is-profile-active')).toHaveCount(1);
    expect(await card.getAttribute('data-directory-stay-id')).toBe(booking.stayId);
    expect(await card.getAttribute('data-directory-dog-id')).toBe(booking.dogId);
    expect(await card.getAttribute('data-directory-stay-key')).toBe(booking.stayKey);
    await expect(card).not.toHaveClass(/is-profile-editing/);
    if (destination === 'healthHome') {
      await expect(card.locator('[data-profile-subtab="healthHome"]')).toHaveAttribute('aria-expanded', 'true');
      await expect(card.locator('[data-profile-subtab="healthHome"]')).toBeFocused();
      await expect(card.locator('[data-intake-read-attribute="medicationInstructions"]')).toContainText(record.intakeAttributes.medicationInstructions);
      await expect(card.locator('[data-intake-attribute="medicationInstructions"]')).toBeHidden();
      const contextualCheckIn = card.locator('[data-care-category="healthHome"] [data-arrival-review-checkin]');
      await expect(contextualCheckIn).toHaveCount(1);
      await expect(contextualCheckIn).toBeVisible();
      await expect(card.locator('[data-v110-operation-bar] [data-v110-checkin]')).toHaveCount(0);
      await expect(card.locator('[data-v110-checkin]')).toHaveCount(1);
      expect(reads.writes).toEqual([]);
      expect(reads.filter(action => action === 'get_guest_profile').length - profileReadsBefore).toBe(1);
      expect(reads).toContain(expectedAction);
      await contextualCheckIn.click();
      await expect.poll(() => reads.writes.length).toBe(1);
      expect(reads.writes[0].url).toContain('checkin_stay');
      await expect(card.locator('[data-arrival-review-checkin]')).toHaveCount(0);
      await expect(card.locator('[data-v110-operation-bar] [data-v110-checkin]')).toHaveCount(0);
    } else {
      await expect(card.locator('[data-v11160-tab="belongings"]')).toHaveAttribute('aria-selected', 'true');
      await expect(card.locator('[data-v11160-tab="belongings"]')).toBeFocused();
      await expect(card.locator('[data-directory-main-panel="belongings"]')).toBeVisible();
      await expect(card.locator('[data-directory-detail="belongings"] [data-detail-loading]')).toHaveCount(0);
      await expect.poll(() => reads.filter(action => action === expectedAction).length).toBe(1);
      expect(reads.filter(action => action === 'get_guest_profile').length - profileReadsBefore).toBeLessThanOrEqual(1);
      await expect(card.locator('[data-arrival-review-checkin]')).toBeVisible();
      await page.locator('#directoryBackToGuestsBtn').click();
      await expect(card.locator('[data-arrival-review-checkin]')).toHaveCount(0);
      await expect(card.locator('[data-v110-operation-bar] [data-v110-checkin]')).toHaveCount(1);
    }
    expect(reads.writes).toHaveLength(task === 'medication' ? 1 : 0);
  });
}

test('arrival review keyboard Check In stays available after a failed save and is removed after the confirmed retry', async ({ page, baseURL }) => {
  const reads = await fixture(page, { checkinMode: 'fail-first' });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${baseURL}/directory.html?arrivalTaskFixture=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  const card = page.locator(`.directory-card[data-directory-stay-id="${booking.stayId}"]`);
  await card.locator('[data-arrival-task-list] > summary').click();
  await card.locator('[data-arrival-task="medication"]').click();
  const contextualCheckIn = card.locator('[data-arrival-review-checkin]');
  await expect(contextualCheckIn).toBeVisible();
  // Exercise keyboard activation here; pointer placement has its own layout checks.
  // WebKit can otherwise complete a coordinate click while this destination is moving.
  await contextualCheckIn.focus();
  await contextualCheckIn.press('Enter');
  await expect(card.locator('[data-v110-operation-bar] .v110-action-feedback')).toContainText('HTTP 503');
  await expect(contextualCheckIn).toBeVisible();
  await expect(contextualCheckIn).toBeEnabled();
  await card.locator('[data-v110-operation-bar] .v110-action-feedback button').click();
  await expect.poll(() => reads.writes.length).toBe(2);
  await expect(card.locator('[data-arrival-review-checkin]')).toHaveCount(0);
  await expect(card.locator('[data-v110-operation-bar] [data-v110-checkin]')).toHaveCount(0);
});


test('profile keeps due reminders and falls back to roster warnings while safety is unavailable', async ({page,baseURL}) => {
  const reads=await fixture(page,{reminders:[{dogName:'Milo',reminderDate:'2026-10-17',status:'open'}]});
  await page.goto(`${baseURL}/directory.html?glanceReminderFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  await page.locator('#directory-grid [data-open-directory-profile]').click();
  const card=page.locator('.directory-card.is-profile-active');
  await expect(card.locator('[data-care-brief-safety]')).toContainText('Food Allergy');
  const header=card.locator('[data-directory-profile-roster-badges]');
  await expect(header.locator('[data-v1118-signal-label="Reminder due"]')).toBeVisible();
  await expect(header.locator('[data-v1118-signal-label="Food allergy"]')).toBeHidden();
  const before=reads.filter(x=>x==='get_guest_profile').length;
  await card.locator('[data-care-brief-safety]').evaluate(el=>el.dataset.state='pending');
  await expect(header.locator('[data-v1118-signal-label="Food allergy"]')).toBeVisible();
  await expect(header.locator('[data-v1118-signal-label="Reminder due"]')).toBeVisible();
  expect(reads.filter(x=>x==='get_guest_profile').length).toBe(before);
});

test('simple Care editor preserves optional drafts and category focus without additional reads', async ({page,baseURL},testInfo) => {
  await page.setViewportSize({width:320,height:900});
  const saved = {...record, intakeAttributes:{...record.intakeAttributes,weight:'12 kg',friendlyCats:'No'}};
  const reads = await fixture(page,{profileRecord:saved});
  await page.goto(`${baseURL}/directory.html?simpleEditorFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  await page.locator('#directory-grid [data-open-directory-profile]').click();
  const card=page.locator('.directory-card.is-profile-active');
  await expect(card.locator('[data-care-brief-medication]')).toHaveText(saved.intakeAttributes.medicationInstructions);
  await card.locator('[data-care-brief-action="full-profile"]').click();
  const health=card.locator('[data-profile-subtab="healthHome"]');
  if(await health.getAttribute('aria-expanded')!=='true') await health.click();
  for(const disclosure of await card.locator('.intake-profile-optional').all()) await expect(disclosure).toBeHidden();
  await card.locator('.directory-care-more-actions > summary').click();
  await card.locator('[data-care-brief-action="edit"]').click();
  const controlCount=await card.locator('[data-intake-attribute]').count();
  const age=card.locator('[data-intake-attribute="age"]');
  const optional=age.locator('xpath=ancestor::details[1]');
  await expect(optional).toHaveClass(/intake-profile-optional/);
  await expect(age).toBeHidden();
  for(const key of ['weight','medicationInstructions','medicalConditions','emergencyContact','vetPhone']) await expect(card.locator(`[data-intake-attribute="${key}"]`)).toBeVisible();
  const before=reads.filter(x=>x==='get_guest_profile').length;
  await optional.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await age.fill('4 years draft');
  await page.evaluate(data=>window.__renderCondensedIntake(document.querySelector('.directory-card.is-profile-active'),data),saved);
  await expect(age).toHaveValue('4 years draft');
  await expect(age).toBeFocused();
  await expect(optional).toHaveAttribute('open','');
  await page.evaluate(()=>window.__switchSimpleSection(document.querySelector('.directory-card.is-profile-active'),'healthHome',true));
  await expect(health).toBeFocused();
  await expect(health).toHaveAttribute('aria-expanded','false');
  expect(await page.evaluate(()=>collectDirectoryProfileEditValues(document.querySelector('.directory-card.is-profile-active'))['intake:age'])).toBe('4 years draft');
  await page.keyboard.press('Enter');
  await expect(age).toHaveValue('4 years draft');
  await expect(optional).toHaveAttribute('open','');
  expect(await card.locator('[data-intake-attribute]').count()).toBe(controlCount);
  expect(reads.filter(x=>x==='get_guest_profile').length).toBe(before);
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:900});
    await optional.scrollIntoViewIfNeeded();
    await page.screenshot({path:testInfo.outputPath(`care-optional-editor-${width}.png`)});
  }
  // A newer saved record must win over the original draft baseline on discard.
  await page.evaluate(data=>{
    const card=document.querySelector('.directory-card.is-profile-active');
    directoryProfileDetailCache[directoryProfileIdentityCacheKey(card)]=data;
    window.__renderCondensedIntake(card,data);
  },{...saved,intakeAttributes:{...saved.intakeAttributes,weight:'13 kg'}});
  await card.locator('[data-cancel-profile-edit]').click();
  await expect(card).not.toHaveClass(/is-profile-editing/);
  await expect(age).toHaveValue('');
  await expect(card.locator('[data-intake-attribute="weight"]')).toHaveValue('13 kg');
  expect(reads.filter(x=>x==='get_guest_profile').length).toBe(before);
});

test('Care text enlargement keeps daily information and editor actions readable',async({page,baseURL},testInfo)=>{
  await fixture(page);
  await page.goto(`${baseURL}/directory.html?careLargeTextFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  await page.locator('#directory-grid [data-open-directory-profile]').click();
  const card=page.locator('.directory-card.is-profile-active');
  await expect(card.locator('[data-care-brief-medication]')).toHaveText(record.intakeAttributes.medicationInstructions);
  // Deterministic text-only enlargement. This does not claim physical-device zoom coverage.
  await page.addStyleTag({content:`body[data-waffle-page="directory"] .directory-card.is-profile-active :is(button,summary,label,input,select,textarea,h4,h5,.directory-care-brief-value,.directory-care-owner-line,.care-category-title,.care-category-summary,.directory-profile-edit-status){font-size:24px!important;line-height:1.5!important}`});
  for(const [width,theme] of [[320,'light'],[390,'dark'],[1440,'light']]){
    await page.setViewportSize({width,height:900});
    await page.locator('body').evaluate((el,dark)=>el.classList.toggle('dark-theme',dark),theme==='dark');
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const medication=card.locator('[data-care-brief-medication]');
    expect(await medication.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
    await card.locator('[data-care-brief-action="full-profile"]').click();
    const health=card.locator('[data-profile-subtab="healthHome"]');
    if(await health.getAttribute('aria-expanded')!=='true')await health.click();
    const edit=card.locator('[data-toggle-profile-edit]');
    if(!await card.evaluate(el=>el.classList.contains('is-profile-editing')))await edit.click();
    await expect(card.locator('[data-intake-attribute="medicationInstructions"]')).toBeVisible();
    for(const selector of ['.directory-profile-section-tools button:not([hidden])','.directory-profile-save-bar button','.care-category-toggle','.intake-profile-optional > summary']){
      for(const el of await card.locator(selector).all()){
        if(!await el.isVisible())continue;
        const geometry=await el.evaluate(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,scroll:node.scrollWidth,width:node.clientWidth}});
        expect(geometry.left).toBeGreaterThanOrEqual(-1);expect(geometry.right).toBeLessThanOrEqual(width+1);
        expect(geometry.height).toBeGreaterThanOrEqual(44);expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);
      }
    }
    await card.locator('[data-directory-detail="profile"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:testInfo.outputPath(`care-large-text-${width}-${theme}.png`)});
  }
});

async function openChangeReviewEditor(page,baseURL){
  await page.goto(`${baseURL}/directory.html?careChangeReviewFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  await page.locator('#directory-grid [data-open-directory-profile]').click();
  const card=page.locator('.directory-card.is-profile-active');
  await expect(card.locator('[data-care-brief-medication]')).toHaveText(record.intakeAttributes.medicationInstructions);
  await expect(card.locator('[data-care-change-review]')).toBeHidden();
  await card.locator('.directory-care-more-actions > summary').click();
  await card.locator('[data-care-brief-action="edit"]').click();
  return card;
}

async function openCareCategory(card,key){
  const toggle=card.locator(`[data-profile-subtab="${key}"]`);
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
}

test('Care change review jumps to hidden fields and undoes only the chosen change',async({page,baseURL})=>{
  await page.setViewportSize({width:390,height:900});
  const reads=await fixture(page);
  const card=await openChangeReviewEditor(page,baseURL);
  const review=card.locator('[data-care-change-review]');
  await expect(review).toBeHidden();
  const readCount=reads.filter(x=>x==='get_guest_profile').length;
  await openCareCategory(card,'foodWalks');
  const amount=card.locator('[data-intake-attribute="foodAmount"]');
  await amount.fill('2 cups');
  await expect(amount).toBeFocused();
  await expect(review).toBeVisible();
  await expect(review).not.toHaveAttribute('open','');
  await review.locator(':scope > summary').focus();await page.keyboard.press('Enter');
  const row=key=>review.locator(`[data-care-change-key="${key}"]`);
  await expect(row('intake:foodAmount').locator('[data-care-change-before]')).toHaveText('1 cup');
  await expect(row('intake:foodAmount').locator('[data-care-change-after]')).toHaveText('2 cups');
  await expect(row('intake:foodAmount').locator('[data-care-change-undo]')).toHaveAccessibleName('Undo change to Food Amount');
  await openCareCategory(card,'healthHome');
  const medication=card.locator('[data-intake-attribute="medicationInstructions"]');
  const draftMedication='Give with food.\nCall <owner> before changing the dose.';
  await medication.fill(draftMedication);
  await expect(medication).toBeFocused();
  await page.evaluate(data=>window.__renderCondensedIntake(document.querySelector('.directory-card.is-profile-active'),data),record);
  await expect(medication).toBeFocused();
  await expect(review).toHaveAttribute('open','');
  await expect(row('intake:medicationInstructions').locator('[data-care-change-after]')).toHaveText(draftMedication);
  const age=card.locator('[data-intake-attribute="age"]');
  const optional=age.locator('xpath=ancestor::details[1]');
  await optional.locator(':scope > summary').click();await age.fill('4 years');
  await expect(row('intake:age').locator('[data-care-change-before]')).toHaveText('Not provided');
  await optional.locator(':scope > summary').click();
  await card.locator('[data-profile-subtab="healthHome"]').click();
  await row('intake:age').locator('[data-care-change-jump]').click();
  await expect(age).toBeFocused();await expect(optional).toHaveAttribute('open','');
  await expect(card.locator('[data-profile-subtab="healthHome"]')).toHaveAttribute('aria-expanded','true');
  await page.evaluate(()=>window.__setCareEditTestState({saving:true}));
  await expect(row('intake:age').locator('[data-care-change-undo]')).toBeDisabled();
  await row('intake:age').locator('[data-care-change-undo]').evaluate(button=>button.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await expect(age).toHaveValue('4 years');
  await page.evaluate(()=>window.__setCareEditTestState({saving:false,failed:true}));
  await expect(row('intake:age').locator('[data-care-change-jump]')).toBeEnabled();
  await expect(row('intake:age').locator('[data-care-change-undo]')).toBeEnabled();
  await page.evaluate(()=>window.__setCareEditTestState({saving:false,conflict:true}));
  await expect(row('intake:age').locator('[data-care-change-undo]')).toBeDisabled();
  await page.evaluate(()=>window.__setCareEditTestState({conflict:false}));
  await row('intake:foodAmount').locator('[data-care-change-undo]').click();
  await expect(amount).toHaveValue('1 cup');await expect(age).toHaveValue('4 years');
  await expect(medication).toHaveValue(draftMedication);
  await expect(row('intake:foodAmount')).toHaveCount(0);
  expect(await review.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await row('intake:age').locator('[data-care-change-undo]').click();
  await expect(age).toHaveValue('');await expect(medication).toHaveValue(draftMedication);
  await row('intake:medicationInstructions').locator('[data-care-change-undo]').click();
  await expect(review).toBeHidden();await expect(card.locator('[data-cancel-profile-edit]')).toBeFocused();
  await expect(card.locator('.directory-profile-save-bar [data-save-belongings]')).toBeDisabled();
  await openCareCategory(card,'safety');
  const allergy=card.locator('[data-care-risk-flag="foodAllergy"]');
  await allergy.uncheck();
  if(!await review.evaluate(el=>el.open))await review.locator(':scope > summary').click();
  await expect(row('risk:foodAllergy').locator('[data-care-change-before]')).toHaveText('Flagged');
  await expect(row('risk:foodAllergy').locator('[data-care-change-after]')).toHaveText('Not flagged');
  await row('risk:foodAllergy').locator('[data-care-change-undo]').click();
  await expect(allergy).toBeChecked();await expect(review).toBeHidden();
  await openCareCategory(card,'foodWalks');
  await card.locator('[data-intake-attribute="feedingTimes"]').fill('');
  if(!await review.evaluate(el=>el.open))await review.locator(':scope > summary').click();
  await expect(row('intake:feedingTimes').locator('[data-care-change-after]')).toHaveText('Removed');
  await card.locator('[data-cancel-profile-edit]').click();
  await expect(review).toBeHidden();
  await expect(card.locator('[data-intake-attribute="feedingTimes"]')).toHaveValue(record.intakeAttributes.feedingTimes);
  expect(reads.filter(x=>x==='get_guest_profile').length).toBe(readCount);
  await expect(page.locator('#guestDetailEditModal')).not.toHaveClass(/open/);
});

test('Care changed values remain complete and readable at enlarged phone and desktop text',async({page,baseURL},testInfo)=>{
  await fixture(page);
  const card=await openChangeReviewEditor(page,baseURL);
  await openCareCategory(card,'healthHome');
  const draft='Give with dinner.\nIf appetite changes, call the owner before the next meal. Never repeat a dose without checking.';
  await card.locator('[data-intake-attribute="medicationInstructions"]').fill(draft);
  const review=card.locator('[data-care-change-review]');
  const summary=review.locator(':scope > summary');
  await expect(review.locator('[data-care-change-undo]')).toBeHidden();
  await summary.focus();await page.keyboard.press('Enter');
  await page.addStyleTag({content:'.care-change-review :is(button,summary,.care-change-before,.care-change-after){font-size:24px!important;line-height:1.5!important}'});
  for(const [width,dark] of [[320,false],[390,true],[1440,false]]){
    await page.setViewportSize({width,height:900});await page.locator('body').evaluate((el,on)=>el.classList.toggle('dark-theme',on),dark);
    await expect(review.locator('[data-care-change-after]')).toHaveText(draft);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    for(const button of await review.locator('button,summary').all()){
      const metrics=await button.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,scroll:el.scrollWidth,width:el.clientWidth}});
      expect(metrics.height).toBeGreaterThanOrEqual(44);expect(metrics.left).toBeGreaterThanOrEqual(-1);expect(metrics.right).toBeLessThanOrEqual(width+1);expect(metrics.scroll).toBeLessThanOrEqual(metrics.width+1);
    }
    const after=review.locator('[data-care-change-after]');
    expect(await after.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
    await review.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath(`care-review-${width}-${dark?'dark':'light'}.png`)});
  }
});


test('saved Care contact actions are readable and Emergency details focuses the contact without extra profile reads',async({page,baseURL},testInfo)=>{
 const saved={...record,intakeAttributes:{...record.intakeAttributes,emergencyContact:'Sam & Jo',emergencyPhone:'+61 (400) 123-456',regularVetClinic:'Local veterinary clinic',vetPhone:'02 9000 1234'}};
 const reads=await fixture(page,{profileRecord:saved});
 await page.setViewportSize({width:390,height:844});
 await page.goto(`${baseURL}/directory.html?contactAccessFixture=1`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
 await page.locator('#directory-grid [data-open-directory-profile]').click();
 const card=page.locator('.directory-card.is-profile-active');
 await expect(card.locator('[data-care-brief-freshness]')).toHaveAttribute('data-state','fresh');
 const before=reads.filter(action=>action==='get_guest_profile').length;
 const owner=card.locator('[data-care-brief-call-owner]');
 await expect(owner.locator('.directory-care-owner-phone')).toHaveText(booking.phone);
 await expect(owner.getByRole('link',{name:'Call owner',exact:true})).toHaveAttribute('href',`tel:${booking.phone}`);
 await card.locator('[data-care-brief-action="emergency-contact"]').click();
 const contact=card.locator('[data-intake-read-attribute="emergencyContact"]');
 await expect(contact).toBeFocused();
 await expect(card).not.toHaveClass(/is-profile-editing/);
 await expect(card.locator('[data-intake-read-attribute="emergencyPhone"] a')).toHaveAttribute('href','tel:+61400123456');
 await expect(card.locator('[data-intake-read-attribute="vetPhone"] a')).toHaveAttribute('href','tel:0290001234');
 for(const width of [320,390,1440])for(const dark of [false,true]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(dark=>document.body.classList.toggle('dark-theme',dark),dark);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  for(const target of [owner,card.locator('[data-intake-read-attribute="emergencyPhone"]'),card.locator('[data-intake-read-attribute="vetPhone"]')]){
   expect(await target.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
   expect(await target.locator('a').evaluate(node=>node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
 }
 await page.setViewportSize({width:390,height:844});
 await card.locator('.directory-care-owner-line').screenshot({path:testInfo.outputPath('owner-contact-phone.png')});
 await card.locator('[data-care-brief-action="edit-routine"]').click();
 const draft=card.locator('[data-intake-attribute="foodAmount"]');
 await draft.fill('Draft kept during emergency lookup');
 await card.locator('[data-care-brief-action="emergency-contact"]').click();
 await expect(card.locator('[data-profile-subtab="healthHome"]')).toBeFocused();
 await expect(draft).toHaveValue('Draft kept during emergency lookup');
 expect(reads.filter(action=>action==='get_guest_profile').length).toBe(before);
 expect(reads.writes).toHaveLength(0);
});

test('missing owner number opens only the selected phone editor and preserves cancellation',async({page,baseURL})=>{
 const reads=await fixture(page);
 await page.goto(`${baseURL}/directory.html?missingContactFixture=1`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
 await page.locator('#directory-grid [data-open-directory-profile]').click();
 const card=page.locator('.directory-card.is-profile-active');
 await expect(card.locator('[data-care-brief-freshness]')).toHaveAttribute('data-state','fresh');
 const before=reads.filter(action=>action==='get_guest_profile').length;
 await card.evaluate(card=>{card.querySelector('[data-directory-edit-field="phone"]').dataset.directoryCurrentValue='';card.dataset.v1088Phone='';window.WAFFLE_REFRESH_CARE_SETUP(card);});
 const add=card.getByRole('button',{name:'Add number',exact:true});
 await expect(card.locator('[data-care-brief-call-owner]')).toContainText('Phone unavailable');
 await expect(card.locator('[data-care-brief-call-owner] a')).toHaveCount(0);
 await add.click();
 await expect(page.locator('#guestDetailEditTitle')).toHaveText('Edit Contact Number');
 await expect(page.locator('#guestDetailEditDog')).toContainText('#00017');
 const input=page.locator('#guestDetailEditInput');
 await expect(input).toHaveAttribute('type','tel');
 await input.fill('+61 400 000 999');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.locator('#cancelGuestDetailEdit').click();
 await expect(input).toHaveValue('+61 400 000 999');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#cancelGuestDetailEdit').click();
 await expect(add).toBeFocused();
 expect(reads.filter(action=>action==='get_guest_profile').length).toBe(before);
 expect(reads.writes).toHaveLength(0);
});
