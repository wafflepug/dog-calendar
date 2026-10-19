const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const calendar = fs.readFileSync(path.join(__dirname, 'fixtures/fullcalendar.global.min.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const booking = { timestamp: '2026-10-16', dogName: 'Milo', breed: 'Collie', startDate: '2026-10-17', endDate: '2026-10-20', ownerName: 'Casey', phone: '0400000000', notes: 'Call before pickup.', bookingType: 'Boarding', dogId: '11111111-1111-4111-8111-111111111111', stayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', dogNumber: '#00017', stayKey: 'milo|2026-10-17|2026-10-20' };
const record = { stayKey: booking.stayKey, identity: { stayKey: booking.stayKey, stayId: booking.stayId, dogId: booking.dogId }, resolution: { status: 'resolved', method: 'fixture' }, updatedAt: '2026-10-16T08:00:00Z', intakeAttributesSource: 'Saved profile', intakeAttributes: { feedingTimes: '8am and 6pm', foodAmount: '1 cup', foodBrandType: 'Sensitive formula', walksPerDay: '2 walks', walkDuration: '20 minutes', medicationInstructions: 'Give the saved medication with dinner. Call the owner if appetite changes.' }, riskFlags: { foodAllergy: true } };

async function fixture(page, { reminders = [], profileRecord = record } = {}) {
  const reads = [];
  await page.addInitScript(() => {
    const NativeDate = Date, now = NativeDate.UTC(2026, 9, 17, 12);
    function FixedDate(...args) { if (!new.target) return new NativeDate(now).toString(); return Reflect.construct(NativeDate, args.length ? args : [now], new.target); }
    FixedDate.prototype = NativeDate.prototype; Object.setPrototypeOf(FixedDate, NativeDate); FixedDate.now = () => now; globalThis.Date = FixedDate;
  });
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'Synthetic fixture blocks all writes' });
    if (url.includes('/waffle-app.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: app.replace('function renderDirectoryIntakeAttributes(', 'window.__renderCondensedIntake = renderDirectoryIntakeAttributes;\n    function renderDirectoryIntakeAttributes(').replace('function switchDirectoryProfileSubTab(', 'window.__switchSimpleSection = switchDirectoryProfileSubTab;\n    function switchDirectoryProfileSubTab(') });
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: calendar });
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n' + [booking.timestamp, booking.dogName, booking.breed, '17/10/2026', '20/10/2026', booking.ownerName, booking.phone, '', '', booking.notes, '', 'Boarding', 'Other', booking.dogId, booking.stayId, booking.dogNumber].join(',') });
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({ method: request.method(), url });
      if (!resolved.policy.allowed) return route.fulfill({ status: 403, body: 'Unapproved backend request' });
      const params = new URL(url).searchParams, callback = params.get('callback');
      reads.push(resolved.action);
      let response = { result: 'success', records: [], bookings: [], summaries: [] };
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
    await expect(card.locator('[data-v110-checkin]')).toBeVisible();
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
    await expect(brief.locator('[data-care-brief-call-owner] a')).toBeVisible();
    await expect(brief.locator('.directory-care-brief-actions > [data-p4-dir="owner"]')).toBeVisible();
    await expect(brief.locator('.directory-care-brief-note')).toContainText(booking.notes);
    await expect(page.locator('#directoryProfileBackBar .directory-profile-tools')).toBeHidden();
    await expect(card.locator('[data-directory-profile-roster-badges] [data-v1118-care-signals]')).toBeHidden();
    await expect(tools).not.toHaveAttribute('open', '');
    for (const selector of ['.directory-care-readiness', '[data-directory-stay-contact]', '.directory-care-records-disclosure']) {
      await expect(tools.locator(selector)).toHaveCount(1);
      await expect(tools.locator(`${selector} > summary`)).toBeHidden();
    }
    const readsBeforeTools = reads.filter(x => x === 'get_guest_profile').length;
    const toolsToggle = tools.locator(':scope > summary');
    await toolsToggle.focus();await page.keyboard.press('Enter');
    for (const action of ['handover','emergency-contact','refresh']) await expect(tools.locator(`[data-care-brief-action="${action}"]`)).toBeVisible();
    await page.keyboard.press('Space');await expect(tools).not.toHaveAttribute('open', '');
    expect(reads.filter(x => x === 'get_guest_profile').length).toBe(readsBeforeTools);
    const aligned = await brief.locator('.directory-care-brief-grid').evaluate(grid => {const bounds=grid.getBoundingClientRect();return [...grid.children].every(row=>Math.abs(row.getBoundingClientRect().left-bounds.left)<2 && Math.abs(row.getBoundingClientRect().right-bounds.right)<2)});
    expect(aligned).toBe(true);
    const box = await card.locator('[data-care-brief-medication]').evaluate(el => ({height:el.clientHeight,scroll:el.scrollHeight,clamp:getComputedStyle(el).webkitLineClamp}));
    expect(box.scroll).toBeLessThanOrEqual(box.height + 1);expect(['none','unset',''].includes(box.clamp)).toBe(true);
    await expect(page.locator('#wh75SettingsPanel')).not.toHaveClass(/is-open/);
    await card.locator('.directory-card-header').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`care-opening-${width}-${theme}.png`) });

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
