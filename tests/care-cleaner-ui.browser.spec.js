const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const root = path.resolve(__dirname, '..');
const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');
const longFoodNote = 'Sensitive stomach; avoid chicken treats. '.repeat(12);
const booking = { timestamp:'2026-09-18', dogName:'Milo', breed:'Border Collie', startDate:'2026-09-17', endDate:'2026-09-22', ownerName:'Alex Owner', phone:'0400000001', notes:'Saved care note', bookingType:'Boarding', dogId:'11111111-1111-4111-8111-111111111111', dogNumber:'00007' };
const stayKey = 'milo|2026-09-17|2026-09-22';
const csv = () => 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Dog Number\n' + [booking.timestamp,booking.dogName,booking.breed,'17/09/2026','22/09/2026',booking.ownerName,booking.phone,'','','Saved care note','','Boarding','Direct',booking.dogId,booking.dogNumber].join(',');
async function installFixture(page) {
  const calls = new Map();
  await page.route('**/*', async route => {
    const req=route.request(), url=req.url();
    if (!['GET','HEAD'].includes(req.method())) return route.fulfill({status:405,body:'Read-only fixture blocked mutation'});
    if (new URL(url).hostname === '127.0.0.1') return route.continue();
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) return route.fulfill({status:200,contentType:'text/csv',body:csv()});
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({status:200,contentType:'application/javascript',body:fullCalendar});
    if (url.includes('script.google.com')) {
      const resolved=resolveLocalBackendAction({method:req.method(),url});
      if (!resolved.policy.allowed) return route.fulfill({status:403,body:`Read-only fixture blocked backend action: ${resolved.policy.reason}`});
      const query=new URL(url).searchParams, callback=query.get('callback'), payload=JSON.parse(query.get('payload')||'{}'), action=String(resolved.action||payload.action||query.get('action')||'');
      calls.set(action,(calls.get(action)||0)+1);
      let data={result:'success',records:[],enabled:false};
      if (action==='get_guest_directory') data={result:'success',bookings:[booking],summaries:[{stayKey,riskFlags:{foodAllergy:true}}],digitalIntakes:[],legacyIntakes:[]};
      if (action==='get_guest_profile') data={result:'success',record:{stayKey,identity:{stayKey,stayId:'',dogId:booking.dogId},resolution:{status:'resolved',method:'legacy-key-unique'},intakeAttributes:{feedingTimes:'6:30 am before morning walk',foodAllergies:longFoodNote,medicationInstructions:'Give with dinner'},intakeAttributesSource:'Saved profile',dogPhoto:null,dogPhotoGallery:[],stayPhotos:[]}};
      if (action==='get_intake_statuses'||action==='get_legacy_intake_statuses'||action==='get_belongings') data={result:'success',records:[]};
      if (action==='list_dog_stays_for_linking') data={result:'success',stays:[]};
      if (action==='list_dog_identities') data={result:'success',identities:[{dogId:booking.dogId,dogNumber:'00007',dogName:'Milo',breed:'Border Collie'}]};
      return route.fulfill({status:200,contentType:'application/javascript',body:`${callback}(${JSON.stringify(data)});`});
    }
    if (/^https?:/.test(url)) return route.fulfill({status:200,contentType:url.match(/\.css(?:\?|$)/)?'text/css':'image/svg+xml',body:url.match(/\.css(?:\?|$)/)?'':'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#ddd"/></svg>'});
    return route.continue();
  });
  page.on('request', request => { if (request.url().includes('script.google.com') && request.method()!=='GET' && request.method()!=='HEAD') throw new Error(`Unexpected write request: ${request.method()} ${request.url()}`); });
  return calls;
}
async function openProfile(page, baseURL, calls, width=390, theme='light') {
  await page.setViewportSize({width,height:900});
  await page.emulateMedia({colorScheme:theme});
  await page.clock.setFixedTime(new Date('2026-09-18T12:00:00Z'));
  await page.addInitScript(mode=>localStorage.setItem('theme',mode),theme);
  await page.goto(`${baseURL}/directory.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  const card=page.locator('.directory-card[data-directory-stay-key]:visible').filter({hasText:'Milo'}).first();
  await expect(card).toBeVisible();
  await card.locator('[data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  const profileTab=card.locator('[data-v11160-tab="profile"]');
  await expect(profileTab).toBeVisible({timeout:15000});
  await profileTab.click();
  await card.locator('[data-profile-subtab="foodWalks"]').click();
  await expect(card.locator('.intake-profile-field-foodAllergies textarea:disabled')).toBeVisible({timeout:15000});
  return card;
}

test('actual Care runtime tucks record tools into a no-read disclosure and recovers its controls after toolbar replacement', async ({page,baseURL}) => {
  const calls=await installFixture(page);
  await page.setViewportSize({width:390,height:900});
  await page.clock.setFixedTime(new Date('2026-09-18T12:00:00Z'));
  await page.goto(`${baseURL}/directory.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  const details=page.locator('.care-record-maintenance');
  await expect(details).toBeVisible();
  await expect(details).not.toHaveAttribute('open','');
  await expect(details.locator('summary')).toHaveText('Manage records');
  await expect(details.locator('#p4BackfillDogIds')).toHaveCount(1);
  await expect(details.locator('.care-stay-link-trigger')).toHaveCount(1);
  const before=Object.fromEntries(calls);
  await details.locator('summary').click();
  expect(Object.fromEntries(calls)).toEqual(before);
  await page.evaluate(()=>{ window.__confirmCalls=0; window.confirm=()=>{window.__confirmCalls++;return false;}; });
  await details.locator('#p4BackfillDogIds').click();
  expect(await page.evaluate(()=>window.__confirmCalls)).toBe(1);
  expect(calls.get('backfill_dog_ids')||0).toBe(0);
  await details.locator('.care-stay-link-trigger').click();
  await expect(page.locator('.care-stay-link')).toBeVisible();
  await expect.poll(()=>calls.get('list_dog_stays_for_linking')||0).toBe(1);
  await expect.poll(()=>calls.get('list_dog_identities')||0).toBe(1);
  await page.evaluate(()=>window.__careNodesBefore={backfill:document.getElementById('p4BackfillDogIds'),link:document.querySelector('.care-stay-link-trigger')});
  await page.evaluate(()=>{
    const toolbar=document.querySelector('.directory-roster-heading .guest-directory-toolbar');
    const controls=document.createElement('div');
    controls.append(document.getElementById('p4BackfillDogIds'),document.querySelector('.care-stay-link-trigger'));
    toolbar.before(controls);
    const replacement=document.createElement('div'); replacement.className='guest-directory-toolbar'; replacement.innerHTML='<input id="guestDirectorySearch" aria-label="Search dogs">';
    toolbar.replaceWith(replacement);
    window.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('.guest-directory-toolbar .care-record-maintenance')).toHaveCount(1);
  await expect(page.locator('.care-stay-link')).toHaveCount(1);
  expect(await page.evaluate(()=>document.getElementById('p4BackfillDogIds')===window.__careNodesBefore.backfill&&document.querySelector('.care-stay-link-trigger')===window.__careNodesBefore.link)).toBe(true);
  expect(calls.get('list_dog_stays_for_linking')).toBe(1);
});

for (const theme of ['light', 'dark']) for (const width of [320,390,1440]) test(`actual selected Care profile ${width}-${theme} retains saved details and edit mode`, async ({page,baseURL},testInfo)=>{
      const calls=await installFixture(page);
      const card=await openProfile(page,baseURL,calls,width,theme);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({path:testInfo.outputPath(`care-header-${width}-${theme}.png`)});
      const food=card.locator('.intake-profile-field-foodAllergies textarea:disabled');
      const short=card.locator('.intake-profile-field-feedingTimes textarea:disabled');
      await expect(food).toHaveValue(longFoodNote);
      await expect(short).toHaveValue('6:30 am before morning walk');
      const metrics=await page.evaluate(()=>{
        const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,width:r.width,height:r.height,right:r.right,bottom:r.bottom,font:parseFloat(getComputedStyle(e).fontSize),scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}};
        const card=document.querySelector('.directory-card.is-profile-active');
        return{overflow:document.documentElement.scrollWidth>innerWidth,photo:rect(card.querySelector('.directory-photo-shell')),name:rect(card.querySelector('.directory-dog-name-btn')),breed:rect(card.querySelector('.directory-primary-breed')),dates:[...card.querySelectorAll('.directory-profile-stay-dates[role="button"],.directory-profile-stay-dates button,.directory-profile-stay-dates input')].map(rect),saved:[...card.querySelectorAll('.directory-profile-intake-section textarea:disabled')].filter(node=>node.getClientRects().length).map(rect),actions:rect(card.querySelector('.directory-care-brief-actions'))};
      });
      expect(metrics.overflow).toBe(false);
      expect(metrics.photo.width).toBeGreaterThanOrEqual(64);
      expect(metrics.name.font).toBeGreaterThanOrEqual(13);
      expect(Math.abs(metrics.name.x - metrics.breed.x)).toBeLessThanOrEqual(1);
      expect(metrics.saved.every(field=>field.font>=13&&field.width>0)).toBe(true);
      const fieldVisibility=await page.evaluate(()=>Object.fromEntries(['feedingTimes','foodAllergies'].map(key=>{const node=document.querySelector(`.intake-profile-field-${key} textarea:disabled`);return[key,node?{scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,height:node.getBoundingClientRect().height}:null]})));
      expect(fieldVisibility.feedingTimes.height).toBeLessThan(120);
      if (await page.evaluate(() => CSS.supports('field-sizing', 'content'))) {
        expect(fieldVisibility.foodAllergies.scrollHeight).toBeLessThanOrEqual(fieldVisibility.foodAllergies.clientHeight);
      } else {
        await expect(food).toHaveCSS('overflow-y', 'auto');
        expect(await food.evaluate(node => { node.scrollTop = node.scrollHeight; return node.scrollTop + node.clientHeight >= node.scrollHeight - 1; })).toBe(true);
      }
      for(const date of metrics.dates) expect(date.height).toBeGreaterThanOrEqual(44);
      const operationButtons=card.locator('.v110-operation-actions button');
      for (const button of await operationButtons.all()) {
        const box=await button.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(parseFloat(await button.evaluate(node=>getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(13);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
      const shot=await page.screenshot({path:testInfo.outputPath(`care-compact-${width}-${theme}.png`),fullPage:true});
      await testInfo.attach(`care-compact-${width}-${theme}`,{body:shot,contentType:'image/png'});
      await card.locator('[data-toggle-profile-edit]').click();
      await expect(card).toHaveClass(/is-profile-editing/);
      await expect(card.locator('.intake-profile-field-foodAllergies textarea:not(:disabled)')).toHaveValue(longFoodNote);
      await expect(card.locator('.directory-profile-save-bar')).toBeVisible();
      await expect(card.locator('.intake-profile-field-foodAllergies textarea')).toHaveValue(longFoodNote);
      await card.locator('[data-cancel-profile-edit]').click();
      await expect(card).not.toHaveClass(/is-profile-editing/);
      await page.locator('.directory-card.is-profile-active').locator('.directory-care-brief').scrollIntoViewIfNeeded();
      await page.screenshot({path:testInfo.outputPath(`care-compact-detail-${width}-${theme}.png`),fullPage:true});
});
