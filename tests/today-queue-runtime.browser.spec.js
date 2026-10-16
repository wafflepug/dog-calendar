const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const {resolveLocalBackendAction} = require('../scripts/local-network-policy');
const calendar = fs.readFileSync(path.join(__dirname, 'fixtures/fullcalendar.global.min.js'), 'utf8');

test('the shipped Today page opens its exact Meet & Greet and exposes identity-specific Care links', async ({page, baseURL}, info) => {
  const writes = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({time: new Date('2026-10-16T02:00:00Z')});
  const rows = [
    ['Milo','Poodle','16/10/2026','20/10/2026','Boarding','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','#00001',''],
    ['Coco','Poodle','12/10/2026','16/10/2026','Boarding','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','#00002',''],
    ['Scout','Collie','16/10/2026','16/10/2026','Meet & Greet','','','','Meet at 10:30']
  ];
  const csv = 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n' + rows.map(([dog,breed,start,end,type,dogId,stayId,number,notes]) => ['2026-10-01',dog,breed,start,end,'Fixture owner','0400123456','','',notes,'',type,'Direct',dogId,stayId,number].join(',')).join('\n');
  await page.route('**/*', async route => {
    const req = route.request(), url = req.url();
    if (!['GET','HEAD'].includes(req.method())) { writes.push(req.method()); return route.fulfill({status:405,body:'Read-only fixture'}); }
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) return route.fulfill({contentType:'text/csv',body:csv});
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({contentType:'application/javascript',body:calendar});
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({method:req.method(),url});
      if (!resolved.policy.allowed) { writes.push(resolved.action); return route.fulfill({status:403,body:'Read-only fixture'}); }
      const callback = new URL(url).searchParams.get('callback');
      const response = {result:'success',bookings:[],records:[],summaries:[],identities:[],totalPastStays:0};
      return route.fulfill({contentType:'application/javascript',body:callback?`${callback}(${JSON.stringify(response)});`:JSON.stringify(response)});
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') return route.fulfill({body:'',contentType:req.resourceType()==='script'?'application/javascript':'text/css'});
    return route.continue();
  });
  for (const width of [390,1440]) {
    await page.setViewportSize({width,height:900});
    await page.goto(`${baseURL}/index.html?view=today&ownerWorkflowFixture=1`, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const queue = page.locator('#v10TodayAgenda');
    await expect(queue.locator('.v10-agenda-item')).toHaveCount(3);
    await expect(queue).toBeVisible();
    const headingFonts = await page.evaluate(() => ['#today-actions-title','#whHomeGuestsTitle'].map(selector => getComputedStyle(document.querySelector(selector)).fontSize));
    expect(headingFonts[0]).toBe(headingFonts[1]);
    await expect(queue.getByRole('link', {name:/Open Milo care profile/})).toHaveAttribute('href', /stayId=11111111-1111-4111-8111-111111111111.*dogId=aaaaaaaa/);
    await page.evaluate(dark => document.body.classList.toggle('dark-theme', dark), width === 1440);
    const actionContrast = await queue.locator('.v10-agenda-action').first().evaluate(element => {
      const rgb = value => value.match(/[\d.]+/g).slice(0,3).map(Number).map(value => value/255);
      const lum = values => values.map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0);
      const foreground = lum(rgb(getComputedStyle(element).color));
      const background = lum(rgb(getComputedStyle(element.closest('.v10-agenda-item')).backgroundColor));
      return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
    });
    expect(actionContrast).toBeGreaterThanOrEqual(4.5);
    await queue.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    await info.attach(`today-${width}`, {body:await page.screenshot({path:info.outputPath(`today-${width}.png`)}),contentType:'image/png'});
    await queue.getByRole('button', {name:/Scout Meet & Greet/}).click();
    await expect(page.locator('#customBookingModal')).toBeVisible();
    await expect(page.locator('#modalTitle')).toHaveText('✏️ Edit Meet & Greet');
    await expect(page.locator('#modalDogName')).toHaveValue('Scout');
    await expect(page.locator('#modalBookingTime')).toHaveValue('10:30');
  }
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
