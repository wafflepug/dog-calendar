const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const futureRange = fs.readFileSync('waffle-v11.1.96.js', 'utf8');
const app = fs.readFileSync('waffle-app.js', 'utf8');
const filterStart = app.indexOf('function ensureDirectorySearchStatus()');
const filterEnd = app.indexOf('function intakeAttributeControlHtml(', filterStart);
const rosterFilters = app.slice(filterStart, filterEnd);
if (filterStart < 0 || filterEnd < 0) throw new Error('Could not locate Care search runtime functions.');

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

async function mountCareRange(page) {
  const today = new Date();
  const nearStart = addDays(today, 2);
  const nearEnd = addDays(today, 4);
  const distantStart = addDays(today, 35);
  const distantEnd = addDays(today, 39);
  await page.setContent(`<!doctype html><html><body data-waffle-page="directory">
    <main class="directory-dashboard-fused" data-v11195-stay-view="future">
      <section id="v1082CurrentStayPanel">
        <div id="v11195FutureStayHeading"><span></span></div>
        <div id="directory-grid">
          <article class="directory-card" data-directory-stay-key="near pup|${nearStart}|${nearEnd}"
            data-directory-dog-name="Near Pup" data-directory-start-date="${nearStart}"
            data-directory-end-date="${nearEnd}" data-start-date="${nearStart}"
            data-end-date="${nearEnd}" data-stay-key="near pup|${nearStart}|${nearEnd}"
            data-directory-dog-id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            data-directory-stay-id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab">
            <button type="button" data-open-directory-profile>Near Pup</button>
          </article>
        </div>
      </section>
      <nav><button type="button" data-v1082-stay-tab="current" class="is-active">Staying</button><button type="button" data-v1082-stay-tab="future">Arriving</button></nav>
      <div class="guest-directory-toolbar"><input id="guestDirectorySearch" aria-label="Find dog or owner"></div>
      <p class="guest-directory-toolbar-note"></p>
    </main>
  </body></html>`);

  await page.evaluate(({ nearStart, nearEnd, distantStart, distantEnd }) => {
    window.WAFFLE_PAGE = 'directory';
    // The isolated range fixture must wire the base app's search input handler
    // as well as the later-arrival controller; otherwise observer timing can
    // accidentally substitute for the filtering event being tested.
    document.getElementById('guestDirectorySearch').addEventListener('input', () => {
      if (typeof filterGuestDirectoryCards === 'function') filterGuestDirectoryCards();
    });
    document.querySelectorAll('[data-v1082-stay-tab]').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('[data-v1082-stay-tab]').forEach(item => item.classList.toggle('is-active', item === tab));
      document.querySelector('.directory-dashboard-fused').dataset.v11195StayView = tab.dataset.v1082StayTab;
      if (typeof filterGuestDirectoryCards === 'function') filterGuestDirectoryCards();
    }));
    window.fixtureEvents = [
      { title: 'Near Pup', start: nearStart, end: nearEnd, allDay: true, extendedProps: { dogName: 'Near Pup', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', rawStartDate: nearStart, rawEndDate: nearEnd } },
      { title: 'Distant Pup', start: distantStart, end: distantEnd, allDay: true, extendedProps: { dogName: 'Distant Pup', ownerName: 'Ada Owner', dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', dogNumber: '17', rawStartDate: distantStart, rawEndDate: distantEnd } },
      { title: 'Possible Visit', start: distantStart, end: distantEnd, allDay: true, extendedProps: { dogName: 'Possible Visit', isPotential: true, rawStartDate: distantStart, rawEndDate: distantEnd } }
    ];
  }, { nearStart, nearEnd, distantStart, distantEnd });
  await page.addScriptTag({ content: futureRange });
  await page.evaluate(() => window.WAFFLE_V11196_FUTURE_RANGE.updateEvents(window.fixtureEvents));
}

test('Care defers later arrivals until requested, keeps total count, and leaves details lazy', async ({ page }) => {
  await mountCareRange(page);

  await expect(page.locator('#directory-grid .directory-card')).toHaveCount(1);
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(0);
  await expect(page.locator('#v11196FutureRangeControl')).toBeVisible();
  await expect(page.getByRole('button', { name: /View 1 later arrivals.*First arrives/ })).toBeVisible();
  await expect(page.locator('#v11195FutureStayHeading')).toContainText('Next 7 days');
  expect(await page.evaluate(() => window.WAFFLE_V11196_FUTURE_RANGE.totalFutureCount())).toBe(2);

  await page.getByRole('button', { name: /View 1 later arrivals/ }).click();
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Show next 7 days only' })).toBeVisible();
  await expect(page.locator('#v11195FutureStayHeading')).toContainText('Next 6+ months');
  await expect(page.locator('[data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'false');

  await page.getByRole('button', { name: 'Show next 7 days only' }).click();
  await expect(page.locator('#directory-grid .directory-card')).toHaveCount(1);
  await expect(page.locator('#v11195FutureStayHeading')).toContainText('Next 7 days');
  expect(await page.evaluate(() => window.WAFFLE_V11196_FUTURE_RANGE.totalFutureCount())).toBe(2);

  await page.evaluate(() => {
    const near = window.fixtureEvents[0];
    const distant = window.fixtureEvents[1];
    const addFromDistant = days => {
      const value = new Date(`${distant.start}T00:00:00Z`);
      value.setUTCDate(value.getUTCDate() + days);
      return value.toISOString().slice(0, 10);
    };
    const twinFirstStart = addFromDistant(10);
    const twinFirstEnd = addFromDistant(12);
    const twinSecondStart = addFromDistant(20);
    const twinSecondEnd = addFromDistant(22);
    const invalidNumberStart = addFromDistant(30);
    const invalidNumberEnd = addFromDistant(32);
    window.WAFFLE_V11196_FUTURE_RANGE.updateEvents([near, distant, {
      ...distant,
      id: 'distant-2',
      title: 'Another Distant Pup',
      extendedProps: { ...distant.extendedProps, dogName: 'Another Distant Pup' }
    }, {
      ...distant,
      id: 'twin-first',
      title: 'Twin Pup',
      start: twinFirstStart,
      end: twinFirstEnd,
      extendedProps: { ...distant.extendedProps, dogName: 'Twin Pup', ownerName: 'Ada Owner', dogId: '11111111-1111-4111-8111-111111111111', dogNumber: '#00007', rawStartDate: twinFirstStart, rawEndDate: twinFirstEnd }
    }, {
      ...distant,
      id: 'twin-second',
      title: 'Twin Pup',
      start: twinSecondStart,
      end: twinSecondEnd,
      extendedProps: { ...distant.extendedProps, dogName: 'Twin Pup', ownerName: 'Ada Owner', dogId: '22222222-2222-4222-8222-222222222222', dogNumber: '#00008', rawStartDate: twinSecondStart, rawEndDate: twinSecondEnd }
    }, {
      ...distant,
      id: 'invalid-number',
      title: 'Invalid Number Pup',
      start: invalidNumberStart,
      end: invalidNumberEnd,
      extendedProps: { ...distant.extendedProps, dogName: 'Invalid Number Pup', ownerName: 'Ada Owner', dogNumber: 'Other', rawStartDate: invalidNumberStart, rawEndDate: invalidNumberEnd }
    }]);
  });
  await expect(page.getByRole('button', { name: /View 5 later arrivals/ })).toBeVisible();
  expect(await page.evaluate(() => window.WAFFLE_V11196_FUTURE_RANGE.totalFutureCount())).toBe(6);
  await page.getByRole('button', { name: /View 5 later arrivals/ }).click();
  const twinButtons = page.locator('[data-v11196-synthetic-future="true"] [data-open-directory-profile][aria-label^="Open Twin Pup"]');
  await expect(twinButtons).toHaveCount(2);
  const twinLabels = await twinButtons.evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
  expect(twinLabels[0]).toContain('Ada Owner');
  expect(twinLabels[1]).toContain('Ada Owner');
  expect(twinLabels[0]).not.toBe(twinLabels[1]);
  expect(twinLabels[0]).toContain('Dog Number 00007');
  expect(twinLabels[1]).toContain('Dog Number 00008');
  const invalidNumberLabel = await page.locator('[data-open-directory-profile][aria-label^="Open Invalid Number Pup"]').getAttribute('aria-label');
  expect(invalidNumberLabel).not.toContain('Dog Number Other');
  const lazyDetails = await page.locator('[data-v11196-synthetic-future="true"] [data-directory-detail="profile"]').evaluateAll(details => details.every(detail => detail.dataset.detailLoaded === 'false'));
  expect(lazyDetails).toBe(true);
});

test('Care search stays lazy until requested and reports identity matches across expanded arrivals', async ({ page }) => {
  await mountCareRange(page);
  await page.locator('.directory-dashboard-fused').evaluate(node => { node.dataset.v11195StayView = 'current'; });
  await page.evaluate(filters => {
    window.getLocalTodayDateString = () => new Date().toISOString().slice(0, 10);
    window.eval(filters);
    filterGuestDirectoryCards();
  }, rosterFilters);
  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(0);
  await expect(page.locator('.directory-dashboard-fused')).toHaveAttribute('data-v11195-stay-view', 'current');

  await page.locator('[data-v1082-stay-tab="future"]').click();
  await expect(page.getByRole('button', { name: /View 1 later arrivals/ })).toBeVisible();
  await expect(page.locator('#directory-search-status')).toContainText('No loaded arrivals match');
  await page.getByLabel('Find dog or owner').fill('Near Pup');
  await expect(page.locator('#directory-search-status')).toContainText('1 match in Arriving · next 7 days');
  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await page.getByRole('button', { name: /View 1 later arrivals/ }).click();
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(1);
  await page.getByLabel('Find dog or owner').fill('Ada Owner');
  await expect(page.locator('#directory-search-status')).toContainText('1 match in Arriving');
  await page.getByLabel('Find dog or owner').fill('#00017');
  await expect(page.locator('#directory-search-status')).toContainText('1 match in Arriving');
  await expect(page.locator('.v11196-month-heading:visible')).toHaveCount(1);
  await page.locator('[data-directory-search-clear]').click();
  await expect(page.getByLabel('Find dog or owner')).toBeFocused();
  await expect(page.locator('#directory-grid .directory-card:visible')).toHaveCount(2);
  await expect(page.locator('.v11196-month-heading:visible')).toHaveCount(2);
  await page.getByRole('button', { name: 'Show next 7 days only' }).click();
  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await expect(page.locator('#directory-search-status')).toContainText('Later arrivals are not included');
});

test('later arrivals keep stable identity conflicts separate and collapse matching copies', async ({ page }) => {
  await mountCareRange(page);
  await page.evaluate(() => {
    const start = window.fixtureEvents[1].start;
    const end = window.fixtureEvents[1].end;
    const base = { dogName: 'Milo', rawStartDate: start, rawEndDate: end, ownerName: 'Owner One', breed: 'Cavoodle' };
    const dogA = '11111111-1111-4111-8111-111111111111';
    const dogB = '22222222-2222-4222-8222-222222222222';
    const stayA = { title: 'Milo', start, end, allDay: true, extendedProps: { ...base, dogId: dogA, stayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab' } };
    window.identityFixtures = [
      stayA,
      { ...stayA, id: 'copy-a' },
      { ...stayA, id: 'conflicting-dog', extendedProps: { ...base, dogId: dogB, stayId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab' } },
      { ...stayA, id: 'conflicting-stay', extendedProps: { ...base, dogId: dogA, stayId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
      { ...stayA, id: 'different-owner', extendedProps: { ...base, ownerName: 'Owner Two', dogId: dogB, stayId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } },
      { title: 'Legacy Pup', start, end, allDay: true, extendedProps: { dogName: 'Legacy Pup', rawStartDate: start, rawEndDate: end, ownerName: 'Owner Three', phone: '0400 111 111' } },
      { title: 'Legacy Pup', start, end, allDay: true, extendedProps: { dogName: 'Legacy Pup', rawStartDate: start, rawEndDate: end, ownerName: 'Owner Three', phone: '0400 111 111' } },
      { title: 'Legacy Pup', start, end, allDay: true, extendedProps: { dogName: 'Legacy Pup', rawStartDate: start, rawEndDate: end, ownerName: 'Owner Three', phone: '0400 222 222' } },
      { title: 'Row Pup', start, end, allDay: true, extendedProps: { dogName: 'Row Pup', rawStartDate: start, rawEndDate: end, ownerName: 'N/A', sourceRow: '88' } },
      { title: 'Row Pup', start, end, allDay: true, extendedProps: { dogName: 'Row Pup', rawStartDate: start, rawEndDate: end, ownerName: 'N/A', sourceRow: '88' } },
      { title: 'Row Pup', start, end, allDay: true, extendedProps: { dogName: 'Row Pup', rawStartDate: start, rawEndDate: end, ownerName: 'N/A', sourceRow: '89' } },
      { title: 'Unowned Pup', start, end, allDay: true, extendedProps: { dogName: 'Unowned Pup', rawStartDate: start, rawEndDate: end } }
    ];
    const anonymous = window.identityFixtures[window.identityFixtures.length - 1];
    window.identityFixtures.push(anonymous);
    window.WAFFLE_V11196_FUTURE_RANGE.updateEvents(window.identityFixtures);
    window.WAFFLE_V11196_FUTURE_RANGE.activateLaterArrivals();
  });

  const miloCards = page.locator('[data-v11196-synthetic-future="true"][data-directory-dog-name="Milo"]');
  await expect(miloCards).toHaveCount(4);
  const identities = await miloCards.evaluateAll(cards => cards.map(card => ({
    dogId: card.dataset.directoryDogId,
    stayId: card.dataset.directoryStayId,
    legacyKey: card.dataset.directoryStayKey,
    owner: card.dataset.v1088OwnerName
  })));
  expect(new Set(identities.map(item => item.legacyKey)).size).toBe(1);
  expect(identities.map(item => item.dogId)).toContain('11111111-1111-4111-8111-111111111111');
  expect(identities.map(item => item.dogId)).toContain('22222222-2222-4222-8222-222222222222');
  expect(identities.map(item => item.stayId)).toContain('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab');
  expect(identities.map(item => item.stayId)).toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  expect(identities.map(item => item.stayId)).toContain('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  const openerIdentity = await miloCards.locator('[data-open-directory-profile]').evaluateAll(buttons => buttons.map(button => {
    const card = button.closest('.directory-card');
    return { dogId: card.dataset.directoryDogId, stayId: card.dataset.directoryStayId };
  }));
  expect(openerIdentity).toEqual(identities.map(({ dogId, stayId }) => ({ dogId, stayId })));
  await expect(page.locator('[data-v11196-synthetic-future="true"][data-directory-dog-name="Legacy Pup"]')).toHaveCount(2);
  await expect(page.locator('[data-v11196-synthetic-future="true"][data-directory-dog-name="Row Pup"]')).toHaveCount(2);
  await expect(page.locator('[data-v11196-synthetic-future="true"][data-directory-dog-name="Unowned Pup"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.WAFFLE_V11196_FUTURE_RANGE.totalFutureCount())).toBe(10);
  await expect(page.locator('[data-v11196-synthetic-future="true"] [data-directory-detail="profile"]')).toHaveCount(9);
  await expect(page.locator('[data-v11196-synthetic-future="true"] [data-directory-detail="profile"][data-detail-loaded="true"]')).toHaveCount(0);
  await page.evaluate(() => {
    window.unownedCardBeforeRefresh = document.querySelector('[data-v11196-synthetic-future="true"][data-directory-dog-name="Unowned Pup"]');
    window.WAFFLE_V11196_FUTURE_RANGE.updateEvents(window.identityFixtures);
  });
  await expect(page.locator('[data-v11196-synthetic-future="true"][data-directory-dog-name="Unowned Pup"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.querySelector('[data-v11196-synthetic-future="true"][data-directory-dog-name="Unowned Pup"]') === window.unownedCardBeforeRefresh)).toBe(true);
});


test('full Arriving page consolidates loaded and later cards with dates and stable identities', async ({ page, baseURL }, testInfo) => {
  const { resolveLocalBackendAction } = require('../scripts/local-network-policy');
  const fullCalendar = fs.readFileSync('tests/fixtures/fullcalendar.global.min.js', 'utf8');
  const bennyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const scoobyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const bookings = [
    { dogName: 'Benny', breed: 'Moodle', startDate: '2026-10-14', endDate: '2026-10-20', dogId: bennyId, dogNumber: '#00052', stayId: '11111111-1111-4111-8111-111111111111' },
    { dogName: 'Scooby', breed: 'Pugalier', startDate: '2026-10-16', endDate: '2026-10-18', dogId: scoobyId, dogNumber: '#00041', stayId: '22222222-2222-4222-8222-222222222222' },
    { dogName: 'Luna', breed: 'Pug', startDate: '2026-10-18', endDate: '2026-10-21', dogId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', dogNumber: '#00053', stayId: '33333333-3333-4333-8333-333333333333' },
    { dogName: 'Scooby', breed: 'Pugalier', startDate: '2026-10-20', endDate: '2026-10-25', dogId: scoobyId, dogNumber: '#00041', stayId: '44444444-4444-4444-8444-444444444444' }
  ].map(b => ({ ...b, timestamp: '2026-10-01', ownerName: 'Fixture Owner', phone: '0400000000', bookingType: 'Boarding' }));
  const csv = 'Timestamp,Dog Name,Breed,Start Date,End Date,Owner\'s Name,Contact Number,Likes,Dislikes,Notes,Edit Link,Booking Type,Request Source,Dog ID,Dog Number,Stay ID\n' + bookings.map(b => [b.timestamp,b.dogName,b.breed,b.startDate,b.endDate,b.ownerName,b.phone,'','','','',b.bookingType,'Other',b.dogId,b.dogNumber,b.stayId].join(',')).join('\n');
  const reads = [];
  await page.addInitScript(() => {
    const NativeDate = Date, now = NativeDate.UTC(2026,9,9,1);
    function FixedDate(...args) { if (!new.target) return new NativeDate(now).toString(); return Reflect.construct(NativeDate,args.length ? args : [now],new.target); }
    FixedDate.prototype = NativeDate.prototype; Object.setPrototypeOf(FixedDate,NativeDate); FixedDate.now = () => now; globalThis.Date = FixedDate;
  });
  await page.addInitScript(({ theme, csv }) => { localStorage.setItem('theme',theme); localStorage.setItem('boardingDataCache',csv); }, { theme: testInfo.project.use.colorScheme, csv });
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (!['GET','HEAD'].includes(request.method())) throw new Error('Fixture blocked mutation');
    if (new URL(url).hostname === '127.0.0.1') return route.continue();
    if (url.includes('docs.google.com') && url.includes('output=csv')) return route.fulfill({status:200,contentType:'text/csv',body:csv});
    if (url.includes('cdn.jsdelivr.net') && url.includes('fullcalendar')) return route.fulfill({status:200,contentType:'application/javascript',body:fullCalendar});
    if (url.includes('script.google')) {
      const params = new URL(url).searchParams, callback = params.get('callback');
      const payload = JSON.parse(params.get('payload') || '{}');
      const action = resolveLocalBackendAction({method:request.method(),url});
      if (!action.policy.allowed) return route.fulfill({status:403,body:'Read-only fixture blocked action'});
      reads.push(payload);
      let data = {result:'success',records:[]};
      if (action.action === 'get_guest_directory') data = {result:'success',bookings:bookings.slice(0,2),summaries:[]};
      if (action.action === 'get_guest_profile') data = {result:'success',record:{stayKey:payload.stayKey,identity:{stayKey:payload.stayKey,dogId:payload.dogId,stayId:payload.stayId},resolution:{status:'resolved',method:'stay-id-unique-legacy-key'},requestSource:'Other',intakeAttributes:{}}};
      return route.fulfill({status:200,contentType:'application/javascript',body:`${callback}(${JSON.stringify(data)});`});
    }
    return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'});
  });
  await page.goto(`${baseURL}/directory.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.documentElement.dataset.waffleUiReady === 'true');
  await page.locator('[data-v1082-stay-tab="future"]').click();
  const benny = page.locator('#directory-grid > .directory-card[data-directory-dog-name="Benny"]');
  await expect(benny).toHaveCount(1);
  await expect(benny.locator(':scope > [data-open-directory-profile]')).toContainText(/14 Oct.*20 Oct/);
  await expect(page.getByRole('button',{name:/View 2 later arrivals/})).toBeVisible();
  expect(reads.filter(p => p.action === 'get_guest_profile')).toHaveLength(0);
  await page.getByRole('button',{name:/View 2 later arrivals/}).click();
  await expect(page.locator('#directory-grid > .directory-card[data-directory-dog-name="Benny"]')).toHaveCount(1);
  await expect(page.locator('#directory-grid > .directory-card[data-directory-dog-name="Scooby"]')).toHaveCount(2);
  await expect(page.locator('#directory-grid > .directory-card[data-directory-dog-name="Luna"]')).toHaveCount(1);
  await expect(page.locator('#directory-grid .v11196-month-count')).toHaveText('4 stays');
  const tiles = page.locator('#directory-grid > .directory-card > [data-open-directory-profile]');
  await expect(tiles).toHaveCount(4);
  for (const tile of await tiles.all()) {
    await expect(tile.locator('.directory-roster-copy')).toHaveCount(1);
    await expect(tile.locator('.directory-roster-avatar')).toHaveCount(1);
    await expect(tile.locator('.v11196-future-tile-date')).toHaveCount(0);
    expect(await tile.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  expect(reads.filter(p => p.action === 'get_guest_profile')).toHaveLength(0);
  await expect.poll(() => page.evaluate(() => { const s = getComputedStyle(document.body, '::before'); return s.content === '"Waffle House"' && s.visibility !== 'hidden' && Number(s.opacity) > 0; }), {timeout:10000}).toBe(false);
  await page.screenshot({path:testInfo.outputPath('arrivals-consolidated.png'),fullPage:true});
  await benny.locator(':scope > [data-open-directory-profile]').click();
  await expect(benny).toHaveClass(/is-profile-active/);
  await expect.poll(() => reads.filter(p => p.action === 'get_guest_profile').length).toBeGreaterThan(0);
  const profileReads = reads.filter(p => p.action === 'get_guest_profile');
  // Canonical profile access must retain identity; legacy source-badge reads may use the same stay key.
  expect(profileReads).toEqual(expect.arrayContaining([expect.objectContaining({dogId:bennyId,stayKey:'benny|2026-10-14|2026-10-20'})]));
  expect(profileReads.every(p => p.stayKey === 'benny|2026-10-14|2026-10-20' && (!p.dogId || p.dogId === bennyId) && (!p.stayId || p.stayId === bookings[0].stayId)), JSON.stringify(profileReads)).toBe(true);
});
