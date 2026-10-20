const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const calendar = fs.readFileSync('tests/fixtures/fullcalendar.global.min.js', 'utf8');
const app = fs.readFileSync('waffle-app.js', 'utf8');
const booking = { timestamp:'2026-10-16', dogName:'Milo', breed:'Collie', startDate:'2026-10-17', endDate:'2026-10-20', ownerName:'Casey', phone:'0400000000', bookingType:'Boarding', dogId:'11111111-1111-4111-8111-111111111111', stayId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', dogNumber:'#00017', stayKey:'milo|2026-10-17|2026-10-20' };
const record = { stayKey:booking.stayKey, identity:{stayKey:booking.stayKey,stayId:booking.stayId,dogId:booking.dogId}, resolution:{status:'resolved',method:'fixture'}, intakeAttributesSource:'Saved profile', intakeAttributes:{feedingTimes:'8am and 6pm',foodAmount:'1 cup',foodBrandType:'Sensitive formula',medicationInstructions:'Give with dinner.'}, riskFlags:{foodAllergy:true} };

async function fixture(page) {
  const reads=[];
  await page.addInitScript(() => {
    const NativeDate=Date,now=NativeDate.UTC(2026,9,17,12);
    function FixedDate(...args){if(!new.target)return new NativeDate(now).toString();return Reflect.construct(NativeDate,args.length?args:[now],new.target);}
    FixedDate.prototype=NativeDate.prototype;Object.setPrototypeOf(FixedDate,NativeDate);FixedDate.now=()=>now;globalThis.Date=FixedDate;
  });
  await page.route('**/*', async route => {
    const request=route.request(), url=request.url();
    if(!['GET','HEAD'].includes(request.method())) return route.fulfill({status:405,body:'Synthetic fixture blocks writes'});
    if(url.includes('/waffle-app.js')) return route.fulfill({status:200,contentType:'application/javascript',body:app.replace('function renderDirectoryIntakeAttributes(','window.__renderCategoryFixture=renderDirectoryIntakeAttributes;\nfunction renderDirectoryIntakeAttributes(')});
    if(url.includes('cdn.jsdelivr.net')&&url.includes('fullcalendar')) return route.fulfill({status:200,contentType:'application/javascript',body:calendar});
    if(url.includes('docs.google.com/spreadsheets')&&url.includes('output=csv')) return route.fulfill({status:200,contentType:'text/csv',body:'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n'+[booking.timestamp,booking.dogName,booking.breed,'17/10/2026','20/10/2026',booking.ownerName,booking.phone,'','','','','Boarding','Other',booking.dogId,booking.stayId,booking.dogNumber].join(',')});
    if(url.includes('script.google')) {
      const resolved=resolveLocalBackendAction({method:request.method(),url});
      if(!resolved.policy.allowed) return route.fulfill({status:403,body:'Unapproved fixture request'});
      const params=new URL(url).searchParams, callback=params.get('callback'); reads.push(resolved.action);
      let response={result:'success',records:[],bookings:[],summaries:[]};
      if(resolved.action==='get_guest_directory') response={result:'success',bookings:[booking],summaries:[{stayKey:booking.stayKey,riskFlags:record.riskFlags}],digitalIntakes:[],legacyIntakes:[]};
      if(resolved.action==='get_guest_profile') response={result:'success',record};
      if(resolved.action==='maintenance_status') response={result:'success',enabled:false};
      return route.fulfill({status:200,contentType:callback?'application/javascript':'application/json',body:callback?`${callback}(${JSON.stringify(response)});`:JSON.stringify(response)});
    }
    if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1') {
      const type=request.resourceType(); return route.fulfill({status:200,contentType:type==='stylesheet'?'text/css':type==='script'?'application/javascript':'image/svg+xml',body:type==='stylesheet'||type==='script'?'':'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'});
    }
    return route.continue();
  });
  return reads;
}

test('changed fields identify only their categories and survive collapse, refresh, undo and discard', async ({page,baseURL})=>{
  const reads=await fixture(page);
  await page.goto(`${baseURL}/directory.html?categoryChangeFixture=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  await page.locator('#directory-grid [data-open-directory-profile]').click();
  const card=page.locator('.directory-card.is-profile-active');
  await expect(card.locator('[data-care-brief-medication]')).toHaveText(record.intakeAttributes.medicationInstructions);
  await card.locator('.directory-care-more-actions > summary').click();
  await card.locator('[data-care-brief-action="edit"]').click();
  const profileReadsBefore=reads.filter(action=>action==='get_guest_profile').length;
  const badge=category=>card.locator(`[data-care-change-category-count="${category}"]`);
  const toggle=category=>card.locator(`[data-profile-subtab="${category}"]`);
  await toggle('foodWalks').click();
  const review=card.locator('[data-care-change-review]');
  const amount=card.locator('[data-intake-attribute="foodAmount"]');
  await amount.fill('2 cups');
  await card.locator('[data-intake-attribute="feedingTimes"]').fill('7am and 7pm');
  await expect(badge('foodWalks')).toHaveText('2 changed fields');
  await expect(badge('foodWalks')).toBeVisible();
  await expect(badge('behaviour')).toBeHidden();
  await expect(toggle('foodWalks')).toHaveAccessibleName(/Food & Walks.*2 changed fields/);
  await page.setViewportSize({width:320,height:900});
  await page.locator('body').evaluate(el=>el.classList.remove('dark-theme'));
  await card.locator('.care-category-list').screenshot({path:'output/care-category-change-count-320.png'});

  for(const [width,dark] of [[320,false],[320,true],[390,false],[390,true],[1440,false],[1440,true]]) {
    await page.setViewportSize({width,height:900});
    await page.locator('body').evaluate((el,on)=>el.classList.toggle('dark-theme',on),dark);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    const metrics=await badge('foodWalks').evaluate(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,scroll:el.scrollWidth,height:r.height}});
    expect(metrics.left).toBeGreaterThanOrEqual(-1);expect(metrics.right).toBeLessThanOrEqual(width+1);
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width+1);expect(metrics.height).toBeGreaterThanOrEqual(24);
  }

  await toggle('foodWalks').click();
  await expect(card.locator('[data-profile-subpanel="foodWalks"]')).toBeHidden();
  await expect(badge('foodWalks')).toHaveText('2 changed fields');
  await toggle('foodWalks').click();
  await expect(amount).toHaveValue('2 cups');
  const beforeProfileReads=reads.filter(action=>action==='get_guest_profile').length;
  await page.evaluate(data=>window.__renderCategoryFixture(document.querySelector('.directory-card.is-profile-active'),data),record);
  await expect(badge('foodWalks')).toHaveText('2 changed fields');
  await expect(amount).toHaveValue('2 cups');

  await toggle('safety').click();
  const allergy=card.locator('[data-care-risk-flag="foodAllergy"]');
  await allergy.uncheck();
  await expect(badge('safety')).toHaveText('1 changed field');
  await expect(badge('foodWalks')).toHaveText('2 changed fields');
  await allergy.check();
  await expect(badge('safety')).toBeHidden();

  await toggle('healthHome').click();
  const medication=card.locator('[data-intake-attribute="medicationInstructions"]');
  await medication.fill('Draft medication instruction');
  await expect(badge('healthHome')).toHaveText('1 changed field');
  await expect(badge('foodWalks')).toHaveText('2 changed fields');
  await expect(badge('safety')).toBeHidden();
  await page.setViewportSize({width:320,height:900});
  await page.locator('body').evaluate(el=>el.classList.add('dark-theme'));
  await card.locator('.care-category-list').screenshot({path:'output/care-category-change-health-home-320-dark.png'});
  const medicationRow=review.locator('[data-care-change-key="intake:medicationInstructions"]');
  await review.locator(':scope > summary').focus();await page.keyboard.press('Enter');
  await expect(medicationRow.locator('[data-care-change-undo]')).toHaveAccessibleName('Undo change to Medication Instructions');
  await medicationRow.locator('[data-care-change-undo]').click();
  await expect(badge('healthHome')).toBeHidden();
  await expect(review.locator(':scope > summary')).toBeFocused();
  await expect(badge('foodWalks')).toHaveText('2 changed fields');
  await amount.fill('3 cups');
  await expect(badge('foodWalks')).toHaveText('2 changed fields');
  await expect(review).toHaveAttribute('open','');
  await review.locator('[data-care-change-undo="intake:foodAmount"]').click();
  await expect(badge('foodWalks')).toHaveText('1 changed field');
  await expect(review.locator('[data-care-change-jump="intake:feedingTimes"]')).toBeFocused();
  await review.locator('[data-care-change-undo="intake:feedingTimes"]').click();
  await expect(badge('foodWalks')).toBeHidden();
  await expect(review).toBeHidden();
  await expect(card.locator('[data-cancel-profile-edit]')).toBeFocused();
  await expect(badge('behaviour')).toBeHidden();await expect(badge('healthHome')).toBeHidden();await expect(badge('safety')).toBeHidden();

  await amount.fill('4 cups');
  await expect(badge('foodWalks')).toHaveText('1 changed field');
  await card.locator('[data-cancel-profile-edit]').click();
  await expect(badge('foodWalks')).toBeHidden();
  await expect(amount).toHaveValue('1 cup');

  expect(reads.filter(action=>action==='get_guest_profile').length).toBe(profileReadsBefore);
  expect(reads.filter(action=>action==='get_guest_profile').length).toBe(beforeProfileReads);
});
