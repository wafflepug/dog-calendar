const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const {resolveLocalBackendAction} = require('../scripts/local-network-policy');
const calendar = fs.readFileSync(path.join(__dirname, 'fixtures/fullcalendar.global.min.js'), 'utf8');

test('the shipped Today page keeps profile links, exposes direct confirmed-stay actions and opens its exact Meet & Greet', async ({page, baseURL}, info) => {
  const writes = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeDate = Date;
    // Freeze only business time; keep native timers and input timestamps.
    const fixedNow = NativeDate.UTC(2026, 9, 16, 2, 0, 0);
    function FixedDate(...args) {
      if (!new.target) return new NativeDate(fixedNow).toString();
      return Reflect.construct(NativeDate, args.length ? args : [fixedNow], new.target);
    }
    FixedDate.prototype = NativeDate.prototype;
    Object.setPrototypeOf(FixedDate, NativeDate);
    FixedDate.now = () => fixedNow;
    globalThis.Date = FixedDate;
  });
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
    if (url.endsWith('/fixture-coco.svg')) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="teal"/></svg>'});
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({method:req.method(),url});
      if (!resolved.policy.allowed && !['get_business_name','get_sitter_day_handovers'].includes(resolved.action)) { writes.push(resolved.action); return route.fulfill({status:403,body:'Read-only fixture'}); }
      const callback = new URL(url).searchParams.get('callback');
      const response = {result:'success',bookings:[],records:[],summaries:[],identities:[],totalPastStays:0};
      if (resolved.action === 'get_belongings') response.records.push({stayKey:'coco|2026-10-12|2026-10-16',dogPhoto:{previewUrl:new URL('/fixture-coco.svg',baseURL).href}});
      return route.fulfill({contentType:'application/javascript',body:callback?`${callback}(${JSON.stringify(response)});`:JSON.stringify(response)});
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') return route.fulfill({body:'',contentType:req.resourceType()==='script'?'application/javascript':'text/css'});
    return route.continue();
  });
  for (const width of [320,390,1440]) {
    await page.setViewportSize({width,height:900});
    await page.goto(`${baseURL}/index.html?view=today&ownerWorkflowFixture=1`, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const queue = page.locator('#v10TodayAgenda');
    await expect(queue.locator('.v10-agenda-item')).toHaveCount(3);
    await expect(queue).toBeVisible();
    await expect(queue.getByRole('button', {name:'Check-in Milo'})).toBeVisible();
    await expect(queue.getByRole('button', {name:'Check-out Coco'})).toBeVisible();
    const portrait = queue.getByRole('link', {name:/Open Coco care profile/}).locator('.wh-home-portrait img');
    await expect(queue.getByRole('button', {name:'Set price'})).toHaveCount(0);
    await expect(portrait).toHaveAttribute('src', /fixture-coco\.svg$/);
    await expect.poll(() => portrait.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    const checkin = queue.getByRole('button', {name:'Check-in Milo'});
    await expect.poll(() => checkin.evaluate(button => button.isConnected ? button.getBoundingClientRect().height : 0)).toBeGreaterThanOrEqual(44);
    await expect.poll(() => checkin.evaluate(button => button.isConnected ? parseFloat(getComputedStyle(button).fontSize) : 0)).toBeGreaterThanOrEqual(13);
    const headingFonts = await page.evaluate(() => ['#today-actions-title','#whHomeGuestsTitle'].map(selector => getComputedStyle(document.querySelector(selector)).fontSize));
    expect(headingFonts[0]).toBe(headingFonts[1]);
    await expect(queue.getByRole('link', {name:/Open Milo care profile/})).toHaveAttribute('href', /stayId=11111111-1111-4111-8111-111111111111.*dogId=aaaaaaaa/);
    await page.evaluate(dark => document.body.classList.toggle('dark-theme', dark), width === 1440);
    await expect.poll(() => queue.locator('.v10-agenda-action:visible').first().evaluate(element => {
      // A scheduled render can replace a row between locator resolution and
      // evaluation. Unknown/detached colours remain below the threshold.
      const rgb = value => {
        const channels = value.match(/[\d.]+/g);
        return channels?.length >= 3 ? channels.slice(0,3).map(Number).map(value => value/255) : null;
      };
      const lum = values => values.map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0);
      const row = element.closest('.v10-agenda-item');
      if (!element.isConnected || !row) return 0;
      const foregroundRgb = rgb(getComputedStyle(element).color);
      const backgroundRgb = rgb(getComputedStyle(row).backgroundColor);
      if (!foregroundRgb || !backgroundRgb) return 0;
      const foreground = lum(foregroundRgb);
      const background = lum(backgroundRgb);
      return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
    }), {message:'Action text retains 4.5:1 contrast after the theme transition settles'}).toBeGreaterThanOrEqual(4.5);
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
