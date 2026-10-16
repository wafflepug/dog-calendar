const { test, expect } = require('@playwright/test');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
const fs = require('node:fs');
const path = require('node:path');
const fullCalendar = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');

const booking = {
  timestamp: '2026-09-18', dogName: 'Continuity Dog', breed: 'Border Collie',
  startDate: '2026-09-17', endDate: '2026-09-22', ownerName: 'Casey', phone: '0400000000',
  notes: 'Long list fixture', bookingType: 'Boarding', dogId: 'f5f57ca3-fb50-4e19-8590-10dab77398b1',
  stayId: 'bb942e2d-2c4c-4be5-a943-f7a9e0ae402c', dogNumber: '#00001'
};
const dogId = 'f5f57ca3-fb50-4e19-8590-10dab77398b1';
const stayId = 'bb942e2d-2c4c-4be5-a943-f7a9e0ae402c';
const pastBookings = [
  { dogId: '11111111-1111-4111-8111-111111111111', dogNumber: '17', ownerName: 'Owner A' },
  { dogId: '22222222-2222-4222-8222-222222222222', dogNumber: '#00018', ownerName: 'Owner B' }
].map((identity, index) => ({
  ...identity, row: index + 2, stayKey: 'twin pup|2026-08-01|2026-08-03',
  dogName: 'Twin Pup', breed: 'Cavoodle', startDate: '2026-08-01', endDate: '2026-08-03', phone: '0400000000'
}));



async function installContinuityFixture(page) {
  let profileReadCount = 0;
  let fixtureBookings = [booking];
  // Freeze only the business date. Keep native input timestamps, timers and paint scheduling.
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixedNow = NativeDate.UTC(2026, 8, 18, 12, 0, 0);
    function FixedDate(...args) {
      if (!new.target) return new NativeDate(fixedNow).toString();
      return Reflect.construct(NativeDate, args.length ? args : [fixedNow], new.target);
    }
    FixedDate.prototype = NativeDate.prototype;
    Object.setPrototypeOf(FixedDate, NativeDate);
    FixedDate.now = () => fixedNow;
    globalThis.Date = FixedDate;
  });
  await page.route('**/*', async route => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fulfill({ status: 405, body: 'fixture' });
    const url = request.url();
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: fullCalendar });
    }
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      return route.fulfill({ status: 200, contentType: 'text/csv', body: 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Dog ID,Stay ID,Dog Number\n' + fixtureBookings.map(record => [record.timestamp, record.dogName, record.breed, '17/09/2026', '22/09/2026', record.ownerName, record.phone, '', '', record.notes, '', record.bookingType, record.dogId, record.stayId, record.dogNumber].join(',')).join('\n') });
    }
    if (url.includes('script.google')) {
      const policy = resolveLocalBackendAction({ method: request.method(), url });
      if (!policy.policy.allowed) return route.fulfill({ status: 403, body: 'fixture' });
      const params = new URL(url).searchParams;
      const callback = params.get('callback');
      let payload = {}; try { payload = JSON.parse(params.get('payload') || '{}'); } catch (_) {}
      const stayKey = 'continuity dog|2026-09-17|2026-09-22';
      if (policy.action === 'get_guest_profile') profileReadCount += 1;
      const response = policy.action === 'get_guest_directory'
        ? { result: 'success', bookings: fixtureBookings, summaries: [{ stayKey }] }
        : policy.action === 'get_past_guest_directory'
        ? { result: 'success', bookings: pastBookings, summaries: [] }
        : policy.action === 'get_guest_profile'
        ? { result: 'success', record: {
            stayKey: payload.stayKey || stayKey,
            identity: { stayKey: payload.stayKey || stayKey, stayId: payload.stayId || stayId, dogId: payload.dogId || dogId },
            resolution: { status: 'resolved', method: 'fixture' }, intakeAttributes: {}
          } }
        : { result: 'success', record: { stayKey: payload.stayKey || stayKey, intakeAttributes: {} } };
      if (callback) return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') {
      const type = request.resourceType();
      return route.fulfill({ status: 200, contentType: type === 'stylesheet' ? 'text/css' : type === 'script' ? 'application/javascript' : 'image/svg+xml', body: type === 'stylesheet' || type === 'script' ? '' : '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' });
    }
    return route.continue();
  });
  const reads = () => profileReadCount;
  reads.setBookings = records => { fixtureBookings = records; };
  return reads;
}


for (const width of [390, 1440]) {
  test(`unchanged directory refresh keeps the open Care DOM at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const reads = await installContinuityFixture(page);
    await page.route('**/waffle-app.js*', async route => {
      const text = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
      const instrumented = text.replace('function applyGuestDirectoryResponse(', 'window.__applyCareResponse = applyGuestDirectoryResponse;\n    function applyGuestDirectoryResponse(');
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: instrumented });
    });
    await page.goto(`${baseURL}/directory.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const opener = page.locator('#directory-grid [data-open-directory-profile]');
    await expect(opener).toHaveCount(1);
    await opener.click();
    await expect(page.locator('.directory-card.is-profile-active [data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'true');
    // The unchanged refresh must preserve the actual nodes, not merely restore
    // equivalent-looking fields after tearing down the profile.
    await page.evaluate(() => {
      const card = document.querySelector('.directory-card.is-profile-active');
      window.__retainedCard = card;
      window.__retainedProfile = card.querySelector('[data-directory-detail="profile"]');
      const input = document.createElement('textarea');
      input.dataset.refreshDraftProbe = '';
      input.value = 'Unsubmitted draft';
      card.appendChild(input);
      input.focus();
    });
    const before = reads();
    await page.evaluate(record => window.__applyCareResponse({ result: 'success', bookings: [record], summaries: [{ stayKey: 'continuity dog|2026-09-17|2026-09-22' }] }, { quiet: false }), booking);
    expect(await page.evaluate(() => ({
      cardSame: document.querySelector('.directory-card.is-profile-active') === window.__retainedCard,
      profileSame: document.querySelector('.directory-card.is-profile-active [data-directory-detail="profile"]') === window.__retainedProfile,
      focused: document.activeElement?.hasAttribute('data-refresh-draft-probe'),
      draft: document.querySelector('[data-refresh-draft-probe]')?.value
    }))).toEqual({ cardSame: true, profileSame: true, focused: true, draft: 'Unsubmitted draft' });
    expect(reads()).toBe(before);
  });
}

for (const width of [390, 1440]) {
 test(`editing another booking preserves the selected guest at ${width}px`, async ({page, baseURL}) => {
  await page.setViewportSize({width,height:900});
  const reads=await installContinuityFixture(page);
  await page.route('**/waffle-app.js*',async route=>{
   const text=fs.readFileSync(path.join(__dirname,'..','waffle-app.js'),'utf8');
   await route.fulfill({status:200,contentType:'application/javascript',body:text.replace('function applyGuestDirectoryResponse(', 'window.__applyCareResponse = applyGuestDirectoryResponse;\n    function applyGuestDirectoryResponse(')});
  });
  await page.goto(`${baseURL}/directory.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.waffleUiReady==='true');
  await expect(page.locator('#directory-grid [data-open-directory-profile]')).toHaveCount(1);
  const other={...booking,dogName:'Other Guest',dogId:'33333333-3333-4333-8333-333333333333',stayId:'44444444-4444-4444-8444-444444444444',dogNumber:'#00002'};
  reads.setBookings([booking,other]);
  await page.evaluate(bookings=>window.__applyCareResponse({result:'success',bookings,summaries:[]}),[booking,other]);
  await expect(page.locator('#directory-grid .directory-card')).toHaveCount(2);
  await page.locator('#directory-grid .directory-card').filter({hasText:'Continuity Dog'}).locator('[data-open-directory-profile]').click();
  await expect(page.locator('.directory-card.is-profile-active [data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded','true');
  await page.evaluate(()=>{
   window.__selected=document.querySelector('.directory-card.is-profile-active');
   window.__other=[...document.querySelectorAll('#directory-grid .directory-card')].find(card=>card!==window.__selected);
   const probe=document.createElement('textarea');probe.dataset.refreshDraftProbe='';probe.value='Keep this draft';window.__selected.appendChild(probe);probe.focus();
  });
  const before=reads();
  reads.setBookings([booking,{...other,breed:'Updated Breed'}]);
  await page.evaluate(bookings=>window.__applyCareResponse({result:'success',bookings,summaries:[]}),[booking,{...other,breed:'Updated Breed'}]);
  expect(await page.evaluate(()=>({selectedSame:document.querySelector('.directory-card.is-profile-active')===window.__selected,otherReplaced:!window.__other.isConnected,focused:document.activeElement?.hasAttribute('data-refresh-draft-probe'),draft:document.querySelector('[data-refresh-draft-probe]')?.value}))).toEqual({selectedSame:true,otherReplaced:true,focused:true,draft:'Keep this draft'});
  await expect(page.locator('#directory-grid .directory-card').filter({hasText:'Other Guest'})).toHaveAttribute('data-v1088-breed', 'Updated Breed');
  expect(reads()).toBe(before);
 });
}

test('roster reconciliation refuses ambiguous identity and removes stale guests',async({page})=>{
 await page.setContent('<main id="roster"></main>');
 const source=fs.readFileSync(path.join(__dirname,'..','waffle-app.js'),'utf8');
 const start=source.indexOf('    const directoryCardGeneratedMarkup = new WeakMap();');
 const end=source.indexOf('    function parseCSVToEvents(',start);
 expect(start).toBeGreaterThan(0);expect(end).toBeGreaterThan(start);
 await page.addScriptTag({content:source.slice(start,end)});
 expect(await page.evaluate(()=>{
  const grid=document.getElementById('roster');
  const card=(name,stayId='stay-a',dogId='dog-a')=>`<article class="directory-card" data-directory-stay-key="same|2026-09-17|2026-09-22" data-directory-stay-id="${stayId}" data-directory-dog-id="${dogId}">${name}</article>`;
  reconcileDirectoryGridCards(grid,card('A')+card('B','stay-b','dog-b'));
  const [a,b]=grid.children;
  reconcileDirectoryGridCards(grid,card('A')+card('B','stay-b','dog-b'));
  const stable=grid.children[0]===a&&grid.children[1]===b;
  reconcileDirectoryGridCards(grid,card('A')+card('B changed','stay-b','dog-b'));
  const scoped=grid.children[0]===a&&!b.isConnected&&grid.children[1].textContent==='B changed';
  reconcileDirectoryGridCards(grid,card('A','stay-new','dog-a'));
  const identityChanged=!a.isConnected&&grid.children[0].dataset.directoryStayId==='stay-new';
  reconcileDirectoryGridCards(grid,card('Duplicate')+card('Duplicate'));
  const duplicate=grid.children[0];
  reconcileDirectoryGridCards(grid,card('Duplicate')+card('Duplicate'));
  const ambiguousNotReused=!duplicate.isConnected&&grid.children.length===2;
  reconcileDirectoryGridCards(grid,card('Legacy','',''));
  const legacy=grid.children[0];reconcileDirectoryGridCards(grid,card('Legacy','',''));
  const legacyNotReused=!legacy.isConnected;
  reconcileDirectoryGridCards(grid,'<p>No guests</p>');
  return {stable,scoped,identityChanged,ambiguousNotReused,legacyNotReused,empty:grid.textContent};
 })).toEqual({stable:true,scoped:true,identityChanged:true,ambiguousNotReused:true,legacyNotReused:true,empty:'No guests'});
});
