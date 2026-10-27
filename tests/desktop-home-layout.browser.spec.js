const { test, expect } = require('@playwright/test');
const { install } = require('./fixtures/care-daily-workflows');

for (const theme of ['light', 'dark']) {
  test(`desktop Home stays compact beside the canonical calendar and survives mobile resizing (${theme})`, async ({ page }) => {
    const fixture = await install(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(mode => localStorage.setItem('theme', mode), theme);
    await page.goto('/index.html?view=today', { waitUntil: 'networkidle' });
    await expect(page.locator('#wh65Calendar')).toBeVisible();
    await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
    const geometry = () => page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, right:r.right, bottom:r.bottom }; };
      return { left:rect('.wh-desktop-home-column'), right:rect('.wh-desktop-calendar-column'), host:rect('#wh65Calendar'), width:document.documentElement.scrollWidth };
    });
    for (const width of [1440, 1920]) {
      await page.setViewportSize({ width, height:1000 });
      await expect.poll(async () => (await geometry()).right.width).toBeGreaterThanOrEqual(600);
      const g = await geometry();
      expect(g.left.width).toBeGreaterThanOrEqual(360);
      expect(g.left.width).toBeLessThanOrEqual(400);
      expect(g.right.x).toBeGreaterThanOrEqual(g.left.right);
      expect(Math.abs(g.left.y - g.host.y)).toBeLessThan(2);
      const headingTop = await page.locator('.v10-ops-heading h1').evaluate(node => node.getBoundingClientRect().top);
      expect(headingTop - g.left.y).toBeLessThan(32);
      expect(g.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path:`output/desktop-home-layout-${width}-${theme}.png`, fullPage:true, animations:'disabled' });
    }
    const column = page.locator('.wh-desktop-calendar-column');
    await page.locator('.wh-desktop-home-column').evaluate(node => { node.style.minHeight = '1800px'; });
    await expect(column).toHaveClass(/is-calendar-pinned/);
    await page.evaluate(() => window.scrollTo(0,200));
    await expect.poll(() => column.evaluate(node => Math.round(node.getBoundingClientRect().top))).toBe(16);
    await page.locator('#wh65Calendar').evaluate(node => { node.style.minHeight = '1200px'; });
    await expect(column).not.toHaveClass(/is-calendar-pinned/);
    await page.locator('#wh65Calendar').evaluate(node => { node.style.minHeight = ''; });
    await page.setViewportSize({width:1440,height:520});
    await expect(column).not.toHaveClass(/is-calendar-pinned/);
    await page.setViewportSize({width:1920,height:1000});
    await expect(column).toHaveClass(/is-calendar-pinned/);
    await page.locator('.wh-desktop-home-column').evaluate(node => { node.style.minHeight = ''; });
    await page.evaluate(() => window.scrollTo(0,0));
    const brand = page.locator('#whSitterDesktopSidebar .wh-palz-stay-brand');
    await expect(brand).toBeVisible();
    await expect(brand).toHaveAccessibleName('Palz Stay');
    const masks = await brand.locator('span').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).maskImage || getComputedStyle(node).webkitMaskImage));
    expect(masks[0]).toContain('assets/palz-word-mask.png');
    expect(masks[1]).toContain('assets/stay-word-mask.png');
    const title = page.locator('#wh65Calendar .wh65-title');
    const originalTitle = await title.textContent();
    await page.locator('[data-wh69-next]').click();
    await expect(title).not.toHaveText(originalTitle);
    const nextTitle = await title.textContent();
    await page.locator('[data-wh69-view="week"]').click();
    await expect(page.locator('[data-wh69-view="week"]')).toHaveAttribute('aria-pressed','true');
    await page.locator('[data-wh69-view="month"]').click();
    await page.locator('#wh65Calendar').evaluate(node => { window.__layoutHost = node; });
    const profilesBefore = fixture.reads.filter(action => action === 'get_guest_profile').length;
    await page.setViewportSize({width:1024,height:900});
    const stacked = await geometry();
    expect(stacked.right.y).toBeGreaterThanOrEqual(stacked.left.bottom);
    expect(stacked.width).toBeLessThanOrEqual(1024);
    for (const width of [820,390]) {
      await page.setViewportSize({width,height:844});
      await expect(page.locator('.wh-desktop-home-layout')).toHaveCount(0);
      await expect(page.locator('#calendarTabPanel > .v10-operations-home')).toBeVisible();
      await expect(page.locator('#calendarTabPanel > #wh65Calendar')).toBeHidden();
      await expect(page.locator('#calendarSearch')).toHaveCount(0);
      await expect(page.locator('#calendarTabPanel > .summary-dashboard')).toHaveCount(0);
      expect(await page.locator('#wh65Calendar').evaluate(node => node === window.__layoutHost)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({width:1440,height:1000});
    await expect(page.locator('.wh-desktop-calendar-column > #wh65Calendar')).toBeVisible();
    expect(await page.locator('#wh65Calendar').evaluate(node => node === window.__layoutHost)).toBe(true);
    await expect(title).toHaveText(nextTitle);
    expect(fixture.reads.filter(action => action === 'get_guest_profile').length).toBe(profilesBefore);
    for (const id of ['calendar','wh65Calendar','whHomeGuests','whHomeArrivals','whHomePotentials']) await expect(page.locator(`#${id}`)).toHaveCount(1);
    await page.locator('[data-v1118-search-open]').click();
    await expect(page.locator('#v1118SearchModal')).toBeVisible();
    await page.locator('[data-v1118-search-input]').fill('Milo');
    await expect(page.locator('[data-v1118-search-input]')).toHaveValue('Milo');
    await page.locator('[data-v1118-search-close]').click();
    await expect(page.locator('#v1118SearchModal')).toBeHidden();
    for (const route of ['/index.html?view=calendar','/index.html']) {
      await page.goto(route,{waitUntil:'networkidle'});
      await expect(page.locator('.wh-desktop-calendar-column > #wh65Calendar')).toBeVisible();
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto('/index.html?view=calendar',{waitUntil:'networkidle'});
    await expect(page.locator('#calendarTabPanel > #wh65Calendar')).toBeVisible();
    await expect(page.locator('.v10-operations-home')).toBeHidden();
    expect(errors).toEqual([]);
  });
}


test('confirmed empty Home tiles are compact while waiting and failed reads stay explicit', async ({ page }) => {
  await install(page);
  await page.goto('/index.html?view=today',{waitUntil:'networkidle'});
  const potential = page.locator('#whHomePotentials');
  const section = potential.locator('..');
  const status = page.locator('#whHomePotentialsStatus');
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await expect(potential).toHaveAttribute('data-home-state','empty');
    await expect(status).toBeVisible();
    await expect(status).toHaveText('No requests to review.');
    expect((await section.boundingBox()).height).toBeLessThan(125);
  }
  await page.evaluate(() => {
    document.querySelector('#whHomePotentials').setAttribute('aria-busy','true');
    WAFFLE_HOME_GUESTS.refresh();
  });
  await expect(potential).toHaveAttribute('data-home-state','loading');
  await expect(status).toHaveText('Loading requests…');
  await expect(potential.locator('.v10-all-clear')).toBeHidden();
  await page.evaluate(() => {
    document.querySelector('#whHomePotentials').setAttribute('aria-busy','false');
    localStorage.removeItem('boardingDataCache');
    window.__savedHomeSelector = v111CurrentDogEvents;
    window.__savedHomeEvents = globalCalendar.getEvents;
    globalCalendar.getEvents = () => [];
    v111CurrentDogEvents = () => [];
    WAFFLE_HOME_GUESTS.refresh();
  });
  await expect(potential).toHaveAttribute('data-home-state','loading');
  await expect(status).toContainText('Waiting for requests');
  await page.evaluate(() => {
    localStorage.setItem('boardingDataCache','fixture');
    v111CurrentDogEvents = () => [];
    WAFFLE_HOME_GUESTS.refresh();
  });
  await expect(page.locator('#whHomeGuests')).toHaveAttribute('data-home-state','empty');
  await expect(page.locator('#whHomeGuestsStatus')).toBeVisible();
  await expect(page.locator('#whHomeGuestsStatus')).toHaveText('No guests staying right now.');
  await page.evaluate(() => {
    v111CurrentDogEvents = () => { throw new Error('Synthetic Home read failure'); };
    WAFFLE_HOME_GUESTS.refresh();
  });
  await expect(page.locator('#whHomeGuests')).toHaveAttribute('data-home-state','error');
  await expect(page.locator('#whHomeGuestsStatus')).toContainText('Guest data could not load');
  await expect(page.locator('#whHomeGuestsStatus')).toBeVisible();
  await page.evaluate(() => { globalCalendar.getEvents = window.__savedHomeEvents; v111CurrentDogEvents = window.__savedHomeSelector; WAFFLE_HOME_GUESTS.refresh(); });
  await expect(page.locator('#whHomeGuests')).toHaveAttribute('data-home-state','populated');
});

test('stored readable Dog IDs survive the real CSV-to-Home path on desktop and phones', async ({page}) => {
  const fixture=await install(page);
  await page.goto('/index.html?view=today',{waitUntil:'networkidle'});
  const arrivals=page.locator('#whHomeArrivals');
  await expect(arrivals.locator('.wh-home-guest-name')).toHaveText(['Milo','Milo']);
  await expect(arrivals.locator('.wh-home-guest-identity')).toHaveText(['Dog ID #00018','Dog ID #00017']);
  await expect.poll(()=>fixture.reads.filter(action=>action==='get_dog_master_profile').length).toBe(3);
  const profileReads=()=>fixture.reads.filter(action=>['get_guest_profile','get_dog_master_profile'].includes(action)).length;
  const reads=profileReads();
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:900});
    await expect(arrivals.locator('.wh-home-guest-identity').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path:`output/home-busy-day-runtime-${width}.png`,fullPage:true,animations:'disabled'});
  }
  await expect(arrivals.locator('.wh-home-guest').filter({hasText:'Dog ID #00017'})).toHaveAttribute('href',new RegExp('stayId='+fixture.bookings[0].stayId));
  expect(profileReads()).toBe(reads);
});

test('Home photo warnings override the real mobile quiet-status stylesheet',async({page})=>{
  const fixture=await install(page);
  await page.goto('/index.html?view=today',{waitUntil:'networkidle'});
  await expect(page.locator('#whHomeGuests')).toHaveAttribute('data-home-state','populated');
  for(const width of [390,320,1440]){
    await page.setViewportSize({width,height:900});
    for(const dark of [false,true]){
      await page.evaluate(dark=>document.body.classList.toggle('dark-theme',dark),dark);
      const states=await page.evaluate(()=>{
        const row=document.querySelector('#whHomeGuests'),status=document.querySelector('#whHomeGuestsStatus'),before=row.getAttribute('data-home-photo-error');
        delete row.dataset.homePhotoError;
        const quiet=getComputedStyle(status).display;
        row.dataset.homePhotoError='true';
        const warning=getComputedStyle(status).display,visibility=getComputedStyle(status).visibility;
        if(before===null)delete row.dataset.homePhotoError;else row.setAttribute('data-home-photo-error',before);
        return{quiet,warning,visibility};
      });
      expect(states.quiet).toBe('none');expect(states.warning).toBe('block');expect(states.visibility).toBe('visible');
    }
  }
});
