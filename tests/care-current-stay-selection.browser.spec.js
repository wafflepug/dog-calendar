const {test,expect}=require('@playwright/test');
const {install,bookings}=require('./fixtures/care-daily-workflows');

// Synthetic Jed stays reproduce the separate IDs observed in the returning booking.
const currentStay={...bookings[0],dogName:'Jed',stayKey:'jed|2026-10-18|2026-10-20'};
const pastStay={...currentStay,dogId:bookings[1].dogId,startDate:'2026-09-22',endDate:'2026-09-23',stayKey:'jed|2026-09-22|2026-09-23',stayId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};

async function addDelayedPastStay(page){
  let announceRequest,releaseRequest;
  const requestStarted=new Promise(resolve=>{announceRequest=resolve;});
  const responseGate=new Promise(resolve=>{releaseRequest=resolve;});
  await page.route('**/script.google.com/**',async route=>{
    const request=route.request();
    if(!['GET','HEAD'].includes(request.method()))return route.fallback();
    let params;try{params=new URL(request.url()).searchParams;}catch{return route.fallback();}
    let payload={};try{payload=JSON.parse(params.get('payload')||'{}');}catch{}
    if((params.get('action')||payload.action)!=='get_past_guest_directory')return route.fallback();
    announceRequest();
    await responseGate;
    const callback=params.get('callback');
    const result={result:'success',bookings:[pastStay],summaries:[],digitalIntakes:[],legacyIntakes:[],totalPastStays:1};
    return route.fulfill({status:200,contentType:callback?'application/javascript':'application/json',body:callback?`${callback}(${JSON.stringify(result)});`:JSON.stringify(result)});
  });
  return {requestStarted,release:releaseRequest};
}

async function load(page,baseURL,target=pastStay){
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${baseURL}/directory.html?stayKey=${encodeURIComponent(target.stayKey)}&stayId=${target.stayId}&dogId=${target.dogId}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
}

test('a late returning-Jed past deeplink cannot replace the current roster card selected by the sitter',async({page,baseURL})=>{
  await install(page,{bookingOverrides:[currentStay]});
  const pastRequest=await addDelayedPastStay(page);
  await load(page,baseURL);
  const current=page.locator(`#directory-grid [data-directory-stay-id="${bookings[0].stayId}"]`);
  await expect(current).toBeAttached();
  await pastRequest.requestStarted;
  await page.locator('[data-v1082-stay-tab="current"]').click();
  await expect(current).toBeVisible();
  await current.locator('[data-open-directory-profile]').click();
  await expect(current).toHaveClass(/is-profile-active/);
  await expect(page.locator('[data-v1082-stay-tab="current"]')).toHaveClass(/is-active/);
  pastRequest.release();
  const historical=page.locator(`#past-directory-grid [data-directory-stay-id="${pastStay.stayId}"]`);
  await expect(historical).toBeAttached({timeout:8000});
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow')));
  await expect.poll(async()=>page.locator('[data-v1082-stay-tab].is-active').getAttribute('data-v1082-stay-tab'),{timeout:2000}).toBe('current');
  await expect(current).toHaveClass(/is-profile-active/);
  await expect(historical).not.toHaveClass(/is-profile-active/);
  await expect(current.locator('.directory-profile-stay-dates')).toContainText('18 Oct');
  await expect(current.locator('.directory-profile-stay-dates')).toContainText('20 Oct');
  await expect(page.locator('[data-v1082-stay-tab="current"]')).toHaveClass(/is-active/);
});

test('an explicit historical URL still opens that exact stay when the sitter does not navigate',async({page,baseURL})=>{
  await install(page,{bookingOverrides:[currentStay]});
  const pastRequest=await addDelayedPastStay(page);
  await load(page,baseURL);
  await pastRequest.requestStarted;
  pastRequest.release();
  const historical=page.locator(`#past-directory-grid [data-directory-stay-id="${pastStay.stayId}"]`);
  await expect(historical).toBeAttached({timeout:8000});
  await expect(historical).toHaveClass(/is-profile-active/,{timeout:8000});
  await expect(page.locator('[data-v1082-stay-tab="past"]')).toHaveClass(/is-active/);
});


test('a cold current-Jed link stays in Staying while the current roster is still loading',async({page,baseURL})=>{
  await install(page,{bookingOverrides:[currentStay]});
  const pastRequest=await addDelayedPastStay(page);
  let releaseCurrent;
  const currentGate=new Promise(resolve=>{releaseCurrent=resolve;});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    let payload={};try{payload=JSON.parse(url.searchParams.get('payload')||'{}');}catch{}
    const isCurrentDirectory=url.hostname==='script.google.com'&&(url.searchParams.get('action')||payload.action)==='get_guest_directory';
    const isCsv=url.hostname==='docs.google.com'&&url.searchParams.get('output')==='csv';
    if(isCurrentDirectory||isCsv)await currentGate;
    return route.fallback();
  });
  try{
    await load(page,baseURL,currentStay);
    await pastRequest.requestStarted;
    pastRequest.release();
    await expect(page.locator(`#past-directory-grid [data-directory-stay-id="${pastStay.stayId}"]`)).toBeAttached();
    await expect(page.locator('[data-v1082-stay-tab="current"]')).toHaveClass(/is-active/);
    releaseCurrent();
    const current=page.locator(`#directory-grid [data-directory-stay-id="${currentStay.stayId}"]`);
    await expect(current).toHaveClass(/is-profile-active/);
    await expect(current.locator('.directory-profile-stay-dates')).toContainText('18 Oct');
    await expect(current.locator('.directory-profile-stay-dates')).toContainText('20 Oct');
    await expect(page.locator('[data-v1082-stay-tab="current"]')).toHaveClass(/is-active/);
  }finally{releaseCurrent();pastRequest.release();}
});
