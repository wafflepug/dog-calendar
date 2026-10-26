const {test,expect}=require('@playwright/test');
const {install,bookings}=require('./fixtures/care-daily-workflows');

const pastStay={...bookings[0],startDate:'2026-09-12',endDate:'2026-09-15',stayKey:'milo|2026-09-12|2026-09-15',stayId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};

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

async function load(page,baseURL){
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${baseURL}/directory.html?stayKey=${encodeURIComponent(pastStay.stayKey)}&stayId=${pastStay.stayId}&dogId=${pastStay.dogId}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
}

test('a late same-dog past deeplink cannot replace the current roster card selected by the sitter',async({page,baseURL})=>{
  await install(page);
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
  await install(page);
  const pastRequest=await addDelayedPastStay(page);
  await load(page,baseURL);
  await pastRequest.requestStarted;
  pastRequest.release();
  const historical=page.locator(`#past-directory-grid [data-directory-stay-id="${pastStay.stayId}"]`);
  await expect(historical).toBeAttached({timeout:8000});
  await expect(historical).toHaveClass(/is-profile-active/,{timeout:8000});
  await expect(page.locator('[data-v1082-stay-tab="past"]')).toHaveClass(/is-active/);
});
