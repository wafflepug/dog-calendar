const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {resolveLocalBackendAction}=require('../scripts/local-network-policy');
const fullCalendar=fs.readFileSync('tests/fixtures/fullcalendar.global.min.js','utf8');
const dogId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',stayId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const booking={timestamp:'2026-10-01',dogName:'Performance Guest',breed:'Pug',startDate:'2026-10-08',endDate:'2026-10-12',ownerName:'Private Owner',phone:'0400123456',bookingType:'Boarding',dogId,stayId,dogNumber:'#00052'};
async function fixture(page,{hold=false,fail=false}={}) {
  const reads=[];let release,blocked=new Promise(r=>release=r),failure=fail;
  await page.addInitScript(()=>{
    const NativeDate=Date,now=NativeDate.UTC(2026,9,10,1);
    function FixedDate(...args){if(!new.target)return new NativeDate(now).toString();return Reflect.construct(NativeDate,args.length?args:[now],new.target);}
    FixedDate.prototype=NativeDate.prototype;Object.setPrototypeOf(FixedDate,NativeDate);FixedDate.now=()=>now;globalThis.Date=FixedDate;
  });
  await page.route('**/*',async route=>{
    const request=route.request(),url=request.url();
    if(!['GET','HEAD'].includes(request.method()))throw new Error('Mutation blocked');
    if(new URL(url).hostname==='127.0.0.1')return route.continue();
    if(url.includes('cdn.jsdelivr.net')&&url.includes('fullcalendar'))return route.fulfill({status:200,contentType:'application/javascript',body:fullCalendar});
    if(url.includes('docs.google.com')&&url.includes('output=csv'))return route.fulfill({status:200,contentType:'text/csv',body:"Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Dog ID,Stay ID,Dog Number\n2026-10-01,Performance Guest,Pug,2026-10-08,2026-10-12,Private Owner,0400123456,,,,,Boarding,"+dogId+','+stayId+',#00052'});
    if(url.includes('script.google')){
      const policy=resolveLocalBackendAction({method:request.method(),url});
      if(!policy.policy.allowed)return route.fulfill({status:403,body:'Read-only fixture'});
      const params=new URL(url).searchParams,payload=JSON.parse(params.get('payload')||'{}'),callback=params.get('callback');
      let body={result:'success',records:[]};
      if(policy.action==='get_guest_directory')body={result:'success',bookings:[booking],summaries:[]};
      if(policy.action==='get_guest_profile'){
        reads.push(payload);
        if(failure)return route.abort('failed');
        if(hold)await blocked;
        body={result:'success',record:{stayKey:payload.stayKey,identity:{stayKey:payload.stayKey,dogId:payload.dogId,stayId:payload.stayId},resolution:{status:'resolved',method:'stay-id-unique-legacy-key'},requestSource:'Other',intakeAttributes:{medicationInstructions:'Verified evening dose'},intakeAttributesSource:'fixture'}};
      }
      return route.fulfill({status:200,contentType:callback?'application/javascript':'application/json',body:callback?`${callback}(${JSON.stringify(body)});`:JSON.stringify(body)});
    }
    const type=request.resourceType();return route.fulfill({status:200,contentType:type==='stylesheet'?'text/css':type==='script'?'application/javascript':'image/svg+xml',body:type==='stylesheet'||type==='script'?'':'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'});
  });
  return {reads,release:()=>release(),recover:()=>failure=false};
}
async function ready(page,baseURL){
  await page.goto(`${baseURL}/directory.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true'&&window.WAFFLE_CARE_PROFILE_READS&&window.WAFFLE_CARE_PERFORMANCE);
  const card=page.locator('#directory-grid > .directory-card').first();await expect(card).toBeVisible();return card;
}
test('saved essentials paint while one shared fresh read waits, and anonymous timings report real cache boundary',async({page,baseURL},testInfo)=>{
  const f=await fixture(page,{hold:true});const card=await ready(page,baseURL);
  await card.evaluate(async card=>{
    const d=card.dataset,key=d.directoryStayKey;
    const cacheKey=`stable:${(d.directoryStayId||'').toLowerCase()}::${(d.directoryDogId||'').toLowerCase()}::${key}`;
    await putWaffleCachedResponse('directory:profile:'+cacheKey,{result:'success',record:{stayKey:key,identity:{stayKey:key,stayId:d.directoryStayId,dogId:d.directoryDogId},resolution:{status:'resolved'},requestSource:'Other',intakeAttributes:{medicationInstructions:'Saved evening dose'},intakeAttributesSource:'fixture'}});
    window.WAFFLE_CARE_PERFORMANCE.clear();
  });
  await card.locator(':scope > [data-open-directory-profile]').click();
  await expect(card).toHaveClass(/is-profile-active/);
  const detail=card.locator('[data-directory-detail="profile"]');
  await expect(detail).toHaveAttribute('data-detail-loaded','true');
  await expect(detail).toContainText('Saved evening dose');
  await expect.poll(()=>f.reads.length).toBe(1);
  await card.evaluate(card=>{window.__joinedProfileReads=Promise.all([window.WAFFLE_CARE_PROFILE_READS.read(card),window.WAFFLE_CARE_PROFILE_READS.read(card)]);});
  expect(f.reads).toHaveLength(1);f.release();
  await page.evaluate(()=>window.__joinedProfileReads);
  await expect(detail).toContainText('Verified evening dose');
  const samples=await page.evaluate(()=>window.WAFFLE_CARE_PERFORMANCE.snapshot());
  expect(samples.some(s=>s.phase==='cache-applied'&&s.cacheStatus==='saved')).toBe(true);
  expect(samples.some(s=>s.phase==='joined')).toBe(true);
  expect(samples.some(s=>s.phase==='request-end'&&Number.isFinite(s.readDurationMs))).toBe(true);
  expect(samples.every(s=>s.backendMs===null)).toBe(true);
  expect(JSON.stringify(samples)).not.toMatch(/Performance Guest|Private Owner|0400123456|stayKey|dogId|payload|https/);
  await testInfo.attach('anonymous-live-read-boundary.json',{body:JSON.stringify(samples,null,2),contentType:'application/json'});
});
test('failed read has one explicit Retry; recovering makes one new request and retains identity',async({page,baseURL})=>{
  const f=await fixture(page,{fail:true});const card=await ready(page,baseURL);
  await card.locator(':scope > [data-open-directory-profile]').click();
  const retry=card.locator('[data-retry-directory-profile-read]');await expect(retry).toHaveCount(1);
  await expect(retry).toBeVisible();expect(f.reads).toHaveLength(1);
  f.recover();await retry.click();
  await expect(card.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded','true');
  await expect(retry).toHaveCount(0);expect(f.reads).toHaveLength(2);
  expect(f.reads.every(p=>p.dogId===dogId&&p.stayKey==='performance guest|2026-10-08|2026-10-12')).toBe(true);
});
