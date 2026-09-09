/* Isolated browser contract: executes the actual canonical selector and Home
   component against explicit fixtures. Never contacts production or writes stays. */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const ui = read('waffle-ui.js').split('/* ---- source: waffle-v11.1.75.js ---- */')[0];
const source = read('waffle-v11.1.js');
const selector = source.slice(source.indexOf('function v111CurrentDogEvents()'), source.indexOf('function v111EnsureQuickPhotoModal()'));
const operations = read('waffle-v11.0.js');
const identity = operations.slice(operations.indexOf('function v110NormaliseStayDate'), operations.indexOf('function v110FormatTime'));
const sections = read('index.html').match(/<section class="wh-home-guests"[\s\S]*?<\/section>/g);
const html = sections[0];
const css = read('waffle-runtime.css').split('/* Sitter Home:')[1];
const today = '2026-09-08';
function event(name, start = '2026-09-01', end = '2026-09-10', props = {}) {
  return { title: name, extendedProps: { dogName: name, rawStartDate: start, rawEndDate: end, ...props } };
}
const guests = [event('Coco'), event('Leo - Maltese Cross'), event('Ralph', '2026-09-01', today), event('Waffle')];
async function setup(page, options = {}) {
  await page.route('http://home.test/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/photo.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#987"/></svg>' });
    if (url.pathname === '/broken.jpg') return route.fulfill({ status: 404, body: '' });
    if (url.pathname === '/directory.html') return route.fulfill({ body: '<h1>Care destination</h1>' });
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><style>body{font-family:system-ui;margin:20px;--v10-card:#fff;--v10-border:#ddd;--wh75-text:#172033;--wh75-muted:#526174;}@media(prefers-color-scheme:dark){body{background:#111827;--v10-card:#192236;--v10-border:#38435a;--wh75-text:#edf2ff;--wh75-muted:#b9c5db;--wh75-accent-ink:#d9c9ff;--wh75-accent-soft:#36254e;}}/* Sitter Home:${css}</style></head><body>${options.includeArrivals ? sections.join('') : html}</body></html>` });
  });
  await page.goto('http://home.test/');
  await page.evaluate(({ events, loaded, failure, localToday, operations, fallback }) => {
    window.fixtureEvents = events;
    window.fixtureFailure = failure;
    window.fixtureCalls = [];
    window.globalCalendar = { getEvents: () => window.fixtureEvents };
    window.v110LatestCalendarEvents = [];
    window.v110OperationsMap = operations || {};
    window.getLocalTodayDateString = () => localToday;
    window.v10EventRawDates = e => ({ start: e.extendedProps.rawStartDate, end: e.extendedProps.rawEndDate });
    window.queryAppsScript = async payload => {
      window.fixtureCalls.push(payload);
      if (window.fixtureFailure) throw new Error('fixture unavailable');
      if (payload.action === 'get_guest_profile') return { record: fallback && payload.stayKey.startsWith('gallery|') ? { dogPhotoGallery: [{url:'http://home.test/photo.svg'}] } : {} };
      if (payload.action === 'get_dog_master_profile') return { record: fallback && ['Master','Broken'].includes(payload.dogName) ? { primaryPhoto:{url:payload.dogName === 'Broken' ? 'http://home.test/broken.jpg' : 'http://home.test/photo.svg'} } : {} };
      return { records: payload.stayKeys.map((stayKey, i) => ({ stayKey, dogPhoto: fallback ? null : i === 0 ? { previewUrl: 'http://home.test/photo.svg' } : i === 2 ? { previewUrl: 'http://home.test/broken.jpg' } : null })) };
    };
    if (loaded) localStorage.setItem('boardingDataCache', 'fixture');
  }, { events: options.events || guests, loaded: options.loaded !== false, failure: !!options.failure, localToday: options.today || today, operations: options.operations, fallback: !!options.fallback });
  await page.addScriptTag({ content: identity + '\n' + selector });
  if (options.checkedOut) await page.evaluate(key => { v110OperationsMap[key] = { status: 'checked_out' }; }, options.checkedOut);
  await page.addScriptTag({ content: ui });
}

test('current guests only, canonical identities, labels, photos and keyboard destination', async ({ page }) => {
  await setup(page, { events: [...guests, guests[0], event('Future', '2026-09-09'), event('Past', '2026-08-01', '2026-08-31'), event('Meet', undefined, undefined, { isMeetGreet: true }), event('Potential', undefined, undefined, { isPotential: true }), event('Departed')], checkedOut: 'departed|2026-09-01|2026-09-10' });
  await expect(page.locator('[data-home-stay]')).toHaveCount(4);
  await expect(page.getByRole('link', { name: 'Open Ralph stay and care details, leaving today' })).toBeVisible();
  await expect(page.locator('.wh-home-initials').nth(1)).toHaveText('LM');
  await expect(page.locator('.wh-home-portrait img')).toHaveCount(1);
  expect(await page.locator('.wh-home-portrait img').evaluate(img => img.complete && img.naturalWidth > 0)).toBeTruthy();
  const first = page.locator('[data-home-stay]').first();
  await expect(first).toHaveAttribute('href', 'directory.html?stayKey=coco%7C2026-09-01%7C2026-09-10');
  await first.focus();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('waffle:operations-rendered')));
  await expect(first).toBeFocused();
  expect(await page.evaluate(() => fixtureCalls.every(call => ['get_belongings','get_guest_profile','get_dog_master_profile'].includes(call.action)))).toBeTruthy();
  await first.press('Enter');
  await expect(page).toHaveURL(/directory\.html\?stayKey=coco%7C2026-09-01%7C2026-09-10/);
});

test('empty, pending data, photo error and refreshed checkout remain truthful', async ({ page }) => {
  await setup(page, { events: [], loaded: false });
  await expect(page.getByRole('status')).toContainText('Waiting for guest data');
  await page.evaluate(() => { localStorage.setItem('boardingDataCache', 'fixture'); WAFFLE_HOME_GUESTS.refresh(); });
  await expect(page.getByRole('status')).toContainText('No guests are staying');
  await page.evaluate(events => { fixtureEvents = events; fixtureFailure = true; WAFFLE_HOME_GUESTS.refresh(); }, guests);
  await expect(page.locator('[data-home-stay]')).toHaveCount(4);
  await expect(page.getByRole('status')).toContainText('Profile photos could not load');
  await page.evaluate(() => { v110OperationsMap['coco|2026-09-01|2026-09-10'] = { status: 'checked_out' }; WAFFLE_HOME_GUESTS.refresh(); });
  await expect(page.locator('[data-home-stay]')).toHaveCount(3);
  await expect(page.getByRole('link', { name: /Open Coco/ })).toHaveCount(0);
});

test('portraits stay circular and the row scrolls without page overflow', async ({ page }, testInfo) => {
  await setup(page);
  await expect(page.locator('[data-home-stay]')).toHaveCount(4);
  const shape = await page.locator('.wh-home-portrait').first().evaluate(el => ({ width: el.offsetWidth, height: el.offsetHeight, radius: getComputedStyle(el).borderRadius }));
  expect(shape.width).toBe(shape.height);
  expect(shape.radius).toBe('50%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  if (testInfo.project.name.startsWith('mobile')) expect(await page.locator('#whHomeGuests').evaluate(el => el.scrollWidth > el.clientWidth)).toBeTruthy();
});

test('30-day arrivals are ordered, stay-specific and exclude non-arrivals', async ({ page }) => {
  const todayExpected = event('Today Expected', today, '2026-09-12');
  const current = event('Repeat', '2026-09-01', '2026-09-12');
  const first = event('Repeat', '2026-09-10', '2026-09-13');
  const second = event('Repeat', '2026-09-20', '2026-09-23');
  await setup(page, { includeArrivals:true, events:[
    event('Outside', '2026-10-08', '2026-10-10'), second, current,
    event('Last Day', '2026-10-07', '2026-10-09'), first, first, todayExpected,
    event('Checked In', today, '2026-09-12'),
    event('Checked Out', '2026-09-11', '2026-09-12'),
    event('Cancelled', '2026-09-11', '2026-09-12', {status:'cancelled'}),
    event('Tentative', '2026-09-11', '2026-09-12', {bookingType:'Potential Stay'}),
    event('Reminder', '2026-09-11', '2026-09-12', {bookingType:'Reminder'}),
    event('Potential', '2026-09-11', '2026-09-12', {isPotential:true}),
    event('Meet', '2026-09-11', '2026-09-11', {isMeetGreet:true}),
    event('Past', '2026-09-01', '2026-09-02')
  ], operations:{'checked in|2026-09-08|2026-09-12':{status:'checked_in'},'checked out|2026-09-11|2026-09-12':{status:'checked_out'}} });
  const arrivals=page.locator('#whHomeArrivals');
  await expect(arrivals.locator('.wh-home-guest-name')).toHaveText(['Today Expected','Repeat','Repeat','Last Day']);
  await expect(arrivals.locator('.wh-home-guest-label').first()).toHaveText('Arriving today');
  await expect(page.locator('#whHomeArrivalsStatus')).toContainText('Today through 7 Oct');
  await expect(page.locator('#whHomeGuests .wh-home-guest-name')).toHaveText(['Checked In','Repeat']);
  const repeat=arrivals.locator('[data-home-stay="repeat|2026-09-10|2026-09-13"]');
  await expect(repeat).toHaveAttribute('href','directory.html?stayKey=repeat%7C2026-09-10%7C2026-09-13');
  await repeat.focus();
  await page.evaluate(()=>{v110OperationsMap['today expected|2026-09-08|2026-09-12']={status:'checked_in'};WAFFLE_HOME_GUESTS.refresh();});
  await expect(repeat).toBeFocused();
  await expect(arrivals.locator('.wh-home-guest-name')).toHaveText(['Repeat','Repeat','Last Day']);
  await expect(page.locator('#whHomeGuests .wh-home-guest-name')).toHaveText(['Checked In','Repeat','Today Expected']);
  await repeat.press('Enter');
  await expect(page).toHaveURL(/directory\.html\?stayKey=repeat%7C2026-09-10%7C2026-09-13/);
});

test('inclusive local calendar boundary handles DST, leap day and year rollover', async ({ page }) => {
  for (const [start,last,outside] of [['2026-09-08','2026-10-07','2026-10-08'],['2026-12-20','2027-01-18','2027-01-19'],['2028-02-01','2028-03-01','2028-03-02']]) {
    await setup(page,{includeArrivals:true,today:start,events:[event('Outside',outside,outside),event('Last',last,last),event('First',start,start)]});
    await expect(page.locator('#whHomeArrivals .wh-home-guest-name')).toHaveText(['First','Last']);
  }
});

test('upcoming photos use Care gallery and master fallbacks with safe initials', async ({ page }) => {
  await setup(page,{includeArrivals:true,fallback:true,events:['Gallery','Master','Missing','Broken'].map(name=>event(name,'2026-09-10','2026-09-12'))});
  const arrivals=page.locator('#whHomeArrivals');
  await expect(arrivals.locator('.wh-home-guest-name')).toHaveText(['Broken','Gallery','Master','Missing']);
  await expect(arrivals.locator('img')).toHaveCount(2);
  await expect(arrivals.locator('[data-home-stay^="missing|"] .wh-home-initials')).toHaveText('M');
  await expect(arrivals.locator('[data-home-stay^="broken|"] img')).toHaveCount(0);
  expect(await page.evaluate(()=>fixtureCalls.every(call=>['get_belongings','get_guest_profile','get_dog_master_profile'].includes(call.action)))).toBeTruthy();
});

test('upcoming loading, empty and photo failure states remain usable', async ({ page }) => {
  await setup(page,{includeArrivals:true,loaded:false,events:[]});
  await expect(page.locator('#whHomeArrivalsStatus')).toContainText('Waiting for guest data');
  await expect(page.locator('#whHomeArrivals')).toHaveAttribute('aria-busy','true');
  await page.evaluate(()=>{localStorage.setItem('boardingDataCache','fixture');WAFFLE_HOME_GUESTS.refresh();});
  await expect(page.locator('#whHomeArrivalsStatus')).toHaveText('No boarding arrivals in the next 30 days.');
  await page.evaluate(events=>{fixtureEvents=events;fixtureFailure=true;WAFFLE_HOME_GUESTS.refresh();},[event('Expected','2026-09-10','2026-09-12')]);
  await expect(page.locator('#whHomeArrivalsStatus')).toContainText('Profile photos could not load');
  await expect(page.locator('#whHomeArrivals [data-home-stay]')).toHaveCount(1);
  await expect(page.locator('#whHomeArrivals')).toHaveAttribute('aria-busy','false');
});

test('both portrait modules match and arrival scrolling stays inside the page', async ({ page }, testInfo) => {
  await setup(page,{includeArrivals:true,events:[...guests,...Array.from({length:8},(_,i)=>event('Arrival '+i,'2026-09-10','2026-09-12'))]});
  await expect(page.locator('#whHomeArrivals [data-home-stay]')).toHaveCount(8);
  const geometry=await page.evaluate(()=>{
    const current=document.querySelector('#whHomeGuests').closest('section');
    const arrivals=document.querySelector('#whHomeArrivals').closest('section');
    const portrait=arrivals.querySelector('.wh-home-portrait');
    const row=arrivals.querySelector('.wh-home-guest-row');
    return {adjacent:current.nextElementSibling===arrivals,circular:getComputedStyle(portrait).borderRadius,width:portrait.offsetWidth,height:portrait.offsetHeight,overflow:document.documentElement.scrollWidth>innerWidth,scrolls:row.scrollWidth>row.clientWidth};
  });
  expect(geometry.adjacent).toBe(true);
  expect(geometry.circular).toBe('50%');
  expect(geometry.width).toBe(geometry.height);
  expect(geometry.overflow).toBe(false);
  if(testInfo.project.name.startsWith('mobile'))expect(geometry.scrolls).toBe(true);
});
