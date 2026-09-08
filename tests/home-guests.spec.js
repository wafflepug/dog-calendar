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
const html = read('index.html').match(/<section class="wh-home-guests"[\s\S]*?<\/section>/)[0];
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
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><style>body{font-family:system-ui;margin:20px;--v10-card:#fff;--v10-border:#ddd;--wh75-text:#172033;--wh75-muted:#526174;}@media(prefers-color-scheme:dark){body{background:#111827;--v10-card:#192236;--v10-border:#38435a;--wh75-text:#edf2ff;--wh75-muted:#b9c5db;--wh75-accent-ink:#d9c9ff;--wh75-accent-soft:#36254e;}}/* Sitter Home:${css}</style></head><body>${html}</body></html>` });
  });
  await page.goto('http://home.test/');
  await page.evaluate(({ events, loaded, failure }) => {
    window.fixtureEvents = events;
    window.fixtureFailure = failure;
    window.fixtureCalls = [];
    window.globalCalendar = { getEvents: () => window.fixtureEvents };
    window.v110LatestCalendarEvents = [];
    window.v110OperationsMap = {};
    window.getLocalTodayDateString = () => '2026-09-08';
    window.v10EventRawDates = e => ({ start: e.extendedProps.rawStartDate, end: e.extendedProps.rawEndDate });
    window.queryAppsScript = async payload => {
      window.fixtureCalls.push(payload);
      if (window.fixtureFailure) throw new Error('fixture unavailable');
      return { records: payload.stayKeys.map((stayKey, i) => ({ stayKey, dogPhoto: i === 0 ? { previewUrl: 'http://home.test/photo.svg' } : i === 2 ? { previewUrl: 'http://home.test/broken.jpg' } : null })) };
    };
    if (loaded) localStorage.setItem('boardingDataCache', 'fixture');
  }, { events: options.events || guests, loaded: options.loaded !== false, failure: !!options.failure });
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
  expect(await page.evaluate(() => fixtureCalls.every(call => call.action === 'get_belongings'))).toBeTruthy();
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
