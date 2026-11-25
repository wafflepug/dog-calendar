const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const {resolveLocalBackendAction} = require('../scripts/local-network-policy');
const calendar = fs.readFileSync(path.join(__dirname, 'fixtures/fullcalendar.global.min.js'), 'utf8');

test('the shipped Today page keeps profile links, exposes direct confirmed-stay actions and opens its exact Meet & Greet', async ({page, baseURL}, info) => {
  test.setTimeout(90000);
  const writes = [];
  const errors = [];
  let arrivalReads = 0, bookingReads = 0;
  let deferredStartup, deferredReviews;
  const arrival = {
    dogName:'Nigel with a long registered name', breed:'Poodle', bookingType:'Boarding',
    stayKey:'nigel with a long registered name|2026-10-17|2026-10-20',
    stayId:'44444444-4444-4444-8444-444444444444', dogId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    startDate:'2026-10-17', endDate:'2026-10-20',
    needs:['Review intake','Confirm handover times','Review vaccination record']
  };
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
    ['Biscoff','Golden Retriever','16/10/2026','16/10/2026','Boarding','cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333','#00003',''],
    ['Scout','Collie','16/10/2026','16/10/2026','Meet & Greet','','','','Meet at 10:30'],
    [arrival.dogName,arrival.breed,'17/10/2026','20/10/2026','Boarding',arrival.dogId,arrival.stayId,'#00004','']
  ];
  const csv = 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n' + rows.map(([dog,breed,start,end,type,dogId,stayId,number,notes]) => ['2026-10-01',dog,breed,start,end,'Fixture owner','0400123456','','',notes,'',type,'Direct',dogId,stayId,number].join(',')).join('\n');
  await page.route('**/*', async route => {
    const req = route.request(), url = req.url();
    if (!['GET','HEAD'].includes(req.method())) { writes.push(req.method()); return route.fulfill({status:405,body:'Read-only fixture'}); }
    if (url.includes('docs.google.com/spreadsheets') && url.includes('output=csv')) {
      bookingReads++;
      return route.fulfill({contentType:'text/csv',body:csv});
    }
    if (new URL(url).pathname.endsWith('/palz-owner-tools.js') && deferredStartup) await deferredStartup;
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({contentType:'application/javascript',body:calendar});
    if (url.endsWith('/fixture-coco.svg')) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="teal"/></svg>'});
    if (url.includes('script.google')) {
      const resolved = resolveLocalBackendAction({method:req.method(),url});
      if (!resolved.policy.allowed && !['get_business_name','get_sitter_day_handovers','get_sitter_handover','get_dog_host_again'].includes(resolved.action)) { writes.push(resolved.action); return route.fulfill({status:403,body:'Read-only fixture'}); }
      const callback = new URL(url).searchParams.get('callback');
      const response = {result:'success',bookings:[],records:[],summaries:[],identities:[],totalPastStays:0};
      if (resolved.action === 'get_belongings') response.records.push({stayKey:'coco|2026-10-12|2026-10-16',dogPhoto:{previewUrl:new URL('/fixture-coco.svg',baseURL).href}});
      const [dogName, , , , , dogId, stayId] = rows[2];
      if (resolved.action === 'get_stay_operations') response.records.push({dogName, dogId, stayId, stayKey:'biscoff|2026-10-16|2026-10-16', status:'checked_in'});
      if (resolved.action === 'get_sitter_day_handovers') {
        response.date = '2026-10-16';
        response.entries = [{dogId, stayId, type:'Pickup', time:'17:30'}];
      }
      if (resolved.action === 'get_prearrival_checks') {
        arrivalReads++;
        if (deferredReviews) await deferredReviews;
        response.checks = [arrival];
      }
      if (resolved.action === 'get_guest_directory') response.bookings.push(arrival);
      if (resolved.action === 'get_guest_profile') response.record = {
        stayKey:arrival.stayKey, identity:{stayKey:arrival.stayKey,stayId:arrival.stayId,dogId:arrival.dogId},
        resolution:{status:'resolved'}, intakeAttributes:{vaccinated:'Yes',vaccinationDetails:'Fixture clinic'}
      };
      if (resolved.action === 'get_sitter_handover') response.record = {
        stayId:arrival.stayId,dogId:arrival.dogId,stayKey:arrival.stayKey,times:{dropoffTime:'',pickupTime:'16:00'},revision:'fixture'
      };
      return route.fulfill({contentType:'application/javascript',body:callback?`${callback}(${JSON.stringify(response)});`:JSON.stringify(response)});
    }
    if (/^https?:/.test(url) && new URL(url).hostname !== '127.0.0.1') return route.fulfill({body:'',contentType:req.resourceType()==='script'?'application/javascript':'text/css'});
    return route.continue();
  });
  for (const width of [320,390,1440]) {
    await page.setViewportSize({width,height:900});
    const url = `${baseURL}/index.html?view=today&ownerWorkflowFixture=1`;
    if (width === 320) {
      let release;
      deferredStartup = new Promise(resolve => { release = resolve; });
      try {
        await page.goto(url, {waitUntil:'commit'});
        await expect.poll(() => [bookingReads, arrivalReads]).toEqual([1, 1]);
        expect(await page.evaluate(() => document.readyState)).toBe('loading');
      } finally {
        release();
        deferredStartup = null;
      }
    } else if (width === 390) {
      let release;
      deferredReviews = new Promise(resolve => { release = resolve; });
      try {
        await page.goto(url, {waitUntil:'domcontentloaded'});
        await expect(page.locator('.palz-before-arrival')).toBeVisible();
        await expect(page.locator('.palz-before-arrival-count')).toHaveText('1 to review');
      } finally {
        release();
        deferredReviews = null;
      }
    } else {
      await page.goto(url, {waitUntil:'domcontentloaded'});
    }
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const queue = page.locator('#v10TodayAgenda');
    await expect(queue.locator('.v10-agenda-item')).toHaveCount(4);
    const alert = page.getByRole('img', {name:'5 actions today'});
    await expect(alert.locator('svg')).toBeVisible();
    await expect(alert).toHaveText('');
    await expect(queue.getByRole('link', {name:/Open Biscoff care profile, Same Day Care · Checked in · Check-out 05:30pm/})).toBeVisible();
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

    const beforeArrival = page.locator('.palz-before-arrival');
    const review = beforeArrival.getByRole('link', {name:/Review Nigel/});
    await expect(review).toBeHidden();
    await beforeArrival.getByText('Before arrival', {exact:true}).click();
    await expect(beforeArrival.getByText('1 to review')).toBeVisible();
    await expect(beforeArrival.locator('time')).toHaveText(/Arrives Sat,? 17 Oct/);
    await expect(beforeArrival.locator('.palz-before-arrival-checks li')).toHaveText(['Review intake','Confirm handover times','Review vaccination record']);
    await expect(review).toHaveAttribute('href', /stayId=44444444-4444-4444-8444-444444444444.*dogId=dddddddd-dddd-4ddd-8ddd-dddddddddddd.*prearrival=intake$/);
    await expect(beforeArrival.getByRole('link', {name:'Confirm handover times'})).toHaveAttribute('href', /prearrival=handover-times$/);
    await expect(beforeArrival.getByRole('link', {name:'Review vaccination record'})).toHaveAttribute('href', /prearrival=vaccination$/);
    expect((await review.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(review).toHaveCSS('border-top-left-radius', '999px');
    if (width === 320) {
      await review.focus();
      const previousReads = arrivalReads;
      await page.evaluate(() => window.dispatchEvent(new Event('waffle:phase4-data-changed')));
      await expect.poll(() => arrivalReads).toBeGreaterThan(previousReads);
      await expect(review).toBeFocused();
      await expect.poll(() => page.evaluate(async () => (await getWaffleCachedResponse('today:prearrival-checks'))?.payload.checks.length)).toBe(1);
    }
    await info.attach(`before-arrival-${width}`, {
      body:await beforeArrival.screenshot({path:info.outputPath(`before-arrival-${width}.png`)}), contentType:'image/png'
    });
    await beforeArrival.getByText('Before arrival', {exact:true}).click();

    await expect.poll(() => queue.locator('[data-today-meet-done]:visible').first().evaluate(element => {
      // A scheduled render can replace a row between locator resolution and
      // evaluation. Unknown/detached colours remain below the threshold.
      const rgb = value => {
        const channels = value.match(/[\d.]+/g);
        return channels?.length >= 3 ? channels.slice(0,3).map(Number).map(value => value/255) : null;
      };
      const lum = values => values.map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0);
      const row = element;
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
    await queue.getByRole('button', {name:/^Open Scout Meet & Greet/}).click();
    await expect(page.locator('#customBookingModal')).toBeVisible();
    await expect(page.locator('#modalTitle')).toHaveText(/Edit Meet & Greet/);
    await expect(page.locator('#modalDogName')).toHaveValue('Scout');
    await expect(page.locator('#modalBookingTime')).toHaveValue('10:30');
    await expect(page.locator('#customBookingModal').getByLabel('Pet name')).toHaveValue('Scout');
    await expect(page.locator('#customBookingModal .v1112-source-picker')).toHaveCount(1);
    await info.attach(`meet-greet-${width}`, {body:await page.locator('#customBookingModal .modal-content-panel').screenshot({path:info.outputPath(`meet-greet-${width}.png`)}),contentType:'image/png'});
  }
  await page.locator('#closeModalBtn').click();
  const done = page.getByRole('button', { name: 'Mark Scout Meet & Greet done' });
  await expect(done).toBeVisible();
  await info.attach('meet-greet-done', { body: await done.locator('..').screenshot(), contentType: 'image/png' });
  await done.click();
  await expect(page.locator('#v10TodayActionFeedback')).toHaveText('Meet & Greet marked done.');
  await expect(page.locator('[data-today-open-meet]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#v10TodayAgenda .v10-agenda-item')).toHaveCount(3);
  await expect(page.locator('[data-today-meet-done]')).toHaveCount(0);

  await page.setViewportSize({width:360,height:440});
  const beforeArrival = page.locator('.palz-before-arrival');
  await beforeArrival.getByText('Before arrival',{exact:true}).click();
  const reviewLinks = await beforeArrival.locator('.palz-before-arrival-checks a').evaluateAll(links => links.map(link => link.href));
  const profile = page.locator('.directory-card.is-profile-active');
  await page.goto(reviewLinks[0]);
  await expect(profile).toHaveAttribute('data-directory-stay-id',arrival.stayId);
  await expect(profile.locator('[data-care-profile-segment-button="records"]')).toHaveAttribute('aria-pressed','true');
  await expect(profile.locator('.directory-care-records-disclosure [data-create-intake-link]')).toBeInViewport();
  await page.goto(reviewLinks[1]);
  const handover = profile.locator('[data-sitter-handover]');
  await expect(handover).toBeInViewport();
  await expect(handover.getByLabel('Drop-off', {exact:true})).toBeEnabled();
  await page.setViewportSize({width:720,height:800});
  await page.goto(reviewLinks[2]);
  await expect(profile.locator('[data-profile-subtab="healthHome"]')).toHaveAttribute('aria-expanded','true');
  await expect(profile.locator('[data-intake-read-attribute="vaccinationDetails"]')).toBeInViewport();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
