const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'waffle-app.css'), 'utf8');
const operations = fs.readFileSync(path.join(root, 'waffle-v11.0.js'), 'utf8');
// Include the base selectors too: they previously forced action text to 9px.
const queueCss = appCss;
const queueSource = app.slice(
  app.indexOf('function todayQueueIdentity('),
  app.indexOf('function renderV10CapacityStrip()')
);

async function loadQueue(page) {
  await page.setContent(`<base href="https://today.test/"><body data-waffle-page="calendar">
    <span id="v10TodayDateLabel"></span><span id="v10TodayStatus"></span>
    <span id="v10AtHomeCount"></span><span id="v10ArrivalCount"></span>
    <span id="v10DepartureCount"></span><span id="v10MeetCount"></span>
    <div id="v10TodayAgenda"></div>
  </body>`);
  await page.addScriptTag({ content: `
    window.WAFFLE_PAGE = 'calendar';
    window.getLocalTodayDateString = () => '2026-10-16';
    window.v10EventRawDates = event => ({ start: event.extendedProps.start, end: event.extendedProps.end });
    window.v110StayKeyForEvent = event => event.extendedProps.stayKey;
    window.v110EventUniqueKey = (event, key) => event.extendedProps.stableId || key;
    window.v110ValidStayId = value => /^[a-z0-9-]+$/i.test(value);
    window.escapeDashboardHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    window.meetGreetTimeToMinutes = () => 0;
    window.renderV10CapacityStrip = () => {};
    window.renderV10PotentialPipeline = () => {};
    ${queueSource}
  ` });
}

test('Today queue deduplicates stable event identity and opens the exact stay profile', async ({ page }) => {
  await loadQueue(page);
  await page.evaluate(() => {
    const sameVisit = { title: 'Milo', extendedProps: { dogName: 'Milo', stayKey: 'milo|2026-10-16|2026-10-20', stayId: 'stay-1', stableId: 'visit-1', start: '2026-10-16', end: '2026-10-20' } };
    const sameNameOtherVisit = { title: 'Milo', extendedProps: { dogName: 'Milo', stayKey: 'milo|2026-10-16|2026-10-22', stayId: 'stay-2', stableId: 'visit-2', start: '2026-10-16', end: '2026-10-22' } };
    const departsToday = { title: 'Luna', extendedProps: { dogName: 'Luna', stayKey: 'luna|2026-10-12|2026-10-16', stayId: 'stay-3', stableId: 'visit-3', start: '2026-10-12', end: '2026-10-16' } };
    renderV10OperationsHome([sameVisit, sameVisit, sameNameOtherVisit, departsToday]);
  });
  const links = page.locator('#v10TodayAgenda .v10-agenda-row a.v10-agenda-item');
  await expect(links).toHaveCount(3);
  await expect(page.locator('#v10ArrivalCount')).toHaveText('2');
  await expect(page.locator('#v10DepartureCount')).toHaveText('1');
  const commaSeparators = await page.locator('#v10TodayAgenda').evaluate(host =>
    Array.from(host.childNodes).filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.includes(',')).length
  );
  expect(commaSeparators).toBe(0);
  await expect(links.nth(0)).toHaveAttribute('href', /stayKey=milo%7C2026-10-16%7C2026-10-20&stayId=stay-1/);
  await expect(links.nth(1)).toHaveAttribute('href', /stayKey=milo%7C2026-10-16%7C2026-10-22&stayId=stay-2/);
  await expect(links.nth(0)).toContainText('Open profile');
  await expect(page.locator('.v10-agenda-care-link')).toHaveText('Medication and intake checks are in Care profiles');
  await expect(page.locator('#v10TodayAgenda')).not.toContainText('Medication due');
});

test('confirmed same-day arrivals expose one direct Check-in action and transition to Check-out after confirmation', async ({ page }) => {
  await loadQueue(page);
  await page.evaluate(() => {
    const stay = { title: 'Pip', extendedProps: { dogName: 'Pip', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stayId: '11111111-1111-4111-8111-111111111111', stayKey: 'pip|2026-10-16|2026-10-16', stableId: 'pip-visit', bookingType: 'Confirmed Boarding', start: '2026-10-16', end: '2026-10-16' } };
    window.todayStay = stay;
    window.todayWrites = [];
    window.todayOperation = null;
    window.confirm = () => true;
    window.v110OperationForStay = () => window.todayOperation;
    window.queryAppsScript = async () => ({ result: 'success', records: window.todayOperation ? [{ stayId: stay.extendedProps.stayId, stayKey: stay.extendedProps.stayKey, dogName: 'Pip', status: window.todayOperation.status }] : [] });
    window.v110IndexOperations = () => {};
    window.v110SaveOperationalStatus = async (payload, status, target) => {
      window.todayWrites.push({ payload, status, target });
      window.todayOperation = { status };
      return { result: 'success' };
    };
    window.globalCalendar = { getEvents: () => [stay] };
    renderV10OperationsHome([stay]);
  });
  const action = page.getByRole('button', { name: 'Check in Pip' });
  await expect(action).toHaveCount(1);
  await expect(action).toHaveAttribute('data-today-action', 'checkin');
  await action.dblclick();
  await expect.poll(() => page.evaluate(() => window.todayWrites.length)).toBe(1);
  await expect(page.getByRole('button', { name: 'Check out Pip' })).toHaveAttribute('data-today-action', 'checkout');
  await page.getByRole('button', { name: 'Check out Pip' }).click();
  await expect.poll(() => page.evaluate(() => window.todayWrites.length)).toBe(2);
  const writes = await page.evaluate(() => window.todayWrites.map(write => ({
    status: write.status,
    dogId: write.payload.dogId,
    stayId: write.payload.stayId,
    targetIsExactVisit: write.target === window.todayStay
  })));
  expect(writes).toEqual([
    { status: 'checked_in', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stayId: '11111111-1111-4111-8111-111111111111', targetIsExactVisit: true },
    { status: 'checked_out', dogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stayId: '11111111-1111-4111-8111-111111111111', targetIsExactVisit: true }
  ]);
});

test('Today action failures stay visible and stale event identity is rejected without a write', async ({ page }) => {
  await loadQueue(page);
  await page.evaluate(() => {
    const stay = { title: 'Milo', extendedProps: { dogName: 'Milo', dogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', stayId: '22222222-2222-4222-8222-222222222222', stayKey: 'milo|2026-10-16|2026-10-20', stableId: 'milo-visit', bookingType: 'Boarding', start: '2026-10-16', end: '2026-10-20' } };
    window.todayStay = stay;
    window.todayWrites = 0;
    window.v110OperationForStay = () => null;
    window.queryAppsScript = async () => ({ result: 'success', records: [] });
    window.v110IndexOperations = () => {};
    window.v110SaveOperationalStatus = async () => { window.todayWrites++; throw new Error('Server did not confirm the stay.'); };
    window.globalCalendar = { getEvents: () => [stay] };
    renderV10OperationsHome([stay]);
  });
  await page.getByRole('button', { name: 'Check in Milo' }).click();
  await expect(page.locator('[data-today-action-status]')).toContainText('could not be confirmed');
  await expect(page.locator('[data-today-action-status]')).toContainText('Server did not confirm the stay');
  await expect(page.getByRole('button', { name: 'Check in Milo' })).toBeEnabled();
  await page.evaluate(() => {
    window.todayStay.extendedProps.start = '2026-10-18';
  });
  await page.getByRole('button', { name: 'Check in Milo' }).click();
  await expect(page.locator('[data-today-action-status]')).toContainText('changed or is not eligible');
  await expect.poll(() => page.evaluate(() => window.todayWrites)).toBe(1);
});

test('potential and unconfirmed visits never expose operational actions; completed operations remain truthful', async ({ page }) => {
  await loadQueue(page);
  await page.evaluate(() => {
    const confirmed = { title: 'Coco', extendedProps: { dogName: 'Coco', dogId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', stayId: '33333333-3333-4333-8333-333333333333', stayKey: 'coco|2026-10-16|2026-10-20', stableId: 'coco-visit', bookingType: 'Boarding', start: '2026-10-16', end: '2026-10-20' } };
    const potential = { title: 'Nori', extendedProps: { dogName: 'Nori', dogId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', stayId: '44444444-4444-4444-8444-444444444444', stayKey: 'nori|2026-10-16|2026-10-20', stableId: 'nori-visit', bookingType: 'Potential Stay', isPotential: true, start: '2026-10-16', end: '2026-10-20' } };
    const unconfirmed = { title: 'Biscuit', extendedProps: { dogName: 'Biscuit', dogId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', stayId: '55555555-5555-4555-8555-555555555555', stayKey: 'biscuit|2026-10-16|2026-10-20', stableId: 'biscuit-visit', start: '2026-10-16', end: '2026-10-20' } };
    window.v110OperationForStay = event => event.extendedProps.stayId === '33333333-3333-4333-8333-333333333333' ? { status: 'checked_in' } : null;
    renderV10OperationsHome([confirmed, potential, unconfirmed]);
  });
  await expect(page.getByRole('button', { name: 'Check in Coco' })).toHaveCount(0);
  await expect(page.locator('#v10TodayAgenda')).not.toContainText('Coco');
  await expect(page.locator('#v10TodayStatus')).toHaveText('1 item today');
  await expect(page.getByRole('button', { name: /Nori|Biscuit/ })).toHaveCount(0);
  await expect(page.locator('#v10TodayAgenda .v10-agenda-operation')).toHaveCount(0);
});

test('Today queue has a clear empty state and the Care profiles destination', async ({ page }) => {
  await loadQueue(page);
  await page.evaluate(() => renderV10OperationsHome([]));
  await expect(page.locator('.v10-all-clear')).toContainText('No arrivals, departures or Meet & Greets today');
  await expect(page.locator('.v10-agenda-care-link')).toHaveAttribute('href', 'directory.html');
  await expect(page.locator('#v10TodayAgenda > a.v10-agenda-item')).toHaveCount(0);
});

test('Today Meet & Greet action dispatches the exact calendar event to its existing editor', async ({ page }) => {
  await loadQueue(page);
  await page.evaluate(() => {
    const meet = { title: 'Milo', extendedProps: { dogName: 'Milo', isMeetGreet: true, stayKey: 'milo|2026-10-16|2026-10-16', stableId: 'meet-1', start: '2026-10-16', end: '2026-10-16' } };
    window.meetFixture = meet;
    window.meetActions = [];
    window.globalCalendar = {
      getEvents: () => [meet],
      getOption: name => name === 'eventClick' ? info => window.meetActions.push(info.event) : null
    };
    renderV10OperationsHome([meet]);
  });
  await page.locator('[data-today-open-meet]').click();
  const action = await page.evaluate(() => ({
    name: window.meetActions[0]?.extendedProps.dogName,
    exactEvent: window.meetActions[0] === window.meetFixture
  }));
  expect(action).toEqual({ name: 'Milo', exactEvent: true });
});

test('ambiguous Meet & Greet matches open the calendar without selecting an event to edit', async ({ page }) => {
  await page.route('https://today.test/index.html?view=calendar', route => route.fulfill({body:'<h1>Calendar destination</h1>'}));
  await loadQueue(page);
  await page.evaluate(() => {
    const meet = { title:'Milo', extendedProps:{dogName:'Milo',isMeetGreet:true,stayKey:'milo|2026-10-16|2026-10-16',start:'2026-10-16',end:'2026-10-16'} };
    window.name = '';
    window.globalCalendar = {
      getEvents: () => [meet, {...meet, extendedProps:{...meet.extendedProps}}],
      getOption: () => () => { window.name = 'unsafe event selection'; }
    };
    renderV10OperationsHome([meet]);
  });
  await page.locator('[data-today-open-meet]').click();
  await expect(page).toHaveURL('https://today.test/index.html?view=calendar');
  expect(await page.evaluate(() => window.name)).toBe('');
});

test('raw CSV and FullCalendar Meet & Greet shapes share the exact queue identity', async ({ page }) => {
  const dates = app.slice(app.indexOf('function v10EventRawDates(event)'), app.indexOf('function todayQueueIdentity(event)'));
  const keys = operations.slice(operations.indexOf('function v110NormaliseStayDate(value)'), operations.indexOf('function v110ValidStayId(value)'));
  const queue = app.slice(app.indexOf('function todayQueueIdentity(event)'), app.indexOf('function renderV10CapacityStrip()'));
  const renderer = app.slice(app.indexOf('function renderV10OperationsHome(events) {'), app.indexOf('function renderV10CapacityStrip()'));
  await page.setContent(`<body data-waffle-page="calendar">
    <span id="v10TodayDateLabel"></span><span id="v10TodayStatus"></span>
    <span id="v10AtHomeCount"></span><span id="v10ArrivalCount"></span>
    <span id="v10DepartureCount"></span><span id="v10MeetCount"></span>
    <div id="v10TodayAgenda"></div>
  </body>`);
  await page.addScriptTag({ content: `
    window.WAFFLE_PAGE = 'calendar';
    window.getLocalTodayDateString = () => '2026-10-16';
    window.escapeDashboardHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    window.meetGreetTimeToMinutes = () => 630;
    window.renderV10CapacityStrip = () => {};
    window.renderV10PotentialPipeline = () => {};
    ${dates}
    ${keys}
    ${queue}
    ${renderer}
  ` });
  const result = await page.evaluate(() => {
    const props = { isMeetGreet: true, dogName: 'Milo', time: '10:30', owner: 'Owner', phone: '555' };
    const rawEvent = { title: '⏰ 10:30 - Meet & Greet: Milo', start: '2026-10-16', end: '2026-10-16', extendedProps: props };
    const calendarEvent = { title: rawEvent.title, startStr: '2026-10-16', start: new Date(2026, 9, 16), end: null, extendedProps: props };
    window.calendarEvent = calendarEvent;
    window.openedEvents = [];
    window.globalCalendar = { getEvents: () => [calendarEvent], getOption: () => info => window.openedEvents.push(info.event) };
    renderV10OperationsHome([rawEvent]);
    const rows = document.querySelectorAll('[data-today-open-meet]');
    rows[0]?.click();
    return { rows: rows.length, sameIdentity: todayQueueIdentity(rawEvent) === todayQueueIdentity(calendarEvent), openedExactCalendarEvent: window.openedEvents[0] === calendarEvent };
  });
  expect(result).toEqual({ rows: 1, sameIdentity: true, openedExactCalendarEvent: true });
});

test('directory deep links require stable IDs to match and refuse ambiguous legacy keys', async ({ page }) => {
  await page.route('https://today.test/**', route => route.fulfill({ body: '<body></body>' }));
  await page.goto('https://today.test/directory.html?stayKey=shared');
  const selector = app.slice(app.indexOf('function getDirectoryProfileCard(stayKey'), app.indexOf('function getDirectoryWindowScrollTop()'));
  const deepLink = app.slice(app.indexOf('window.WAFFLE_DIRECTORY_PROFILE_NAV ='), app.indexOf('let waffleDeferredInstallPrompt'));
  await page.addScriptTag({ content: `
    window.WAFFLE_PAGE = 'directory';
    ${selector}
    ${deepLink}
    window.openedCards = [];
    window.openDirectoryGuestProfile = card => { window.openedCards.push(card.dataset.directoryDogId); return Promise.resolve(); };
    window.setInterval = callback => { window.retryTimer = callback; return 1; };
    window.clearInterval = () => {};
    document.body.innerHTML = '<p id="directory-roster-summary">2 guests</p><article class="directory-card" data-directory-stay-key="shared" data-directory-stay-id="stay-a" data-directory-dog-id="dog-a"></article><article class="directory-card" data-directory-stay-key="shared" data-directory-stay-id="stay-b" data-directory-dog-id="dog-b"></article>';
    window.legacyLookup = getDirectoryProfileCard('shared')?.dataset.directoryDogId || '';
    window.strictLegacyLookup = getDirectoryProfileCard('shared', '', '', true);
    maybeOpenDirectoryPushDeepLink();
  ` });
  await expect.poll(() => page.evaluate(() => window.openedCards)).toEqual([]);
  await page.evaluate(() => { for (let attempt = 0; attempt < 20; attempt++) window.retryTimer(); });
  await expect(page.locator('#directory-roster-summary [data-directory-push-link-status]')).toHaveText('The linked stay could not be opened. Find the guest by Dog ID or refresh the list.');
  await expect(page.evaluate(() => window.legacyLookup)).resolves.toBe('dog-a');
  await expect(page.evaluate(() => window.strictLegacyLookup)).resolves.toBeNull();
  await page.goto('https://today.test/directory.html?stayKey=shared&stayId=missing&dogId=dog-b');
  await page.addScriptTag({ content: `
    window.WAFFLE_PAGE = 'directory';
    ${selector}
    ${deepLink}
    window.openedCards = [];
    window.openDirectoryGuestProfile = card => { window.openedCards.push(card.dataset.directoryDogId); return Promise.resolve(); };
    window.setInterval = callback => { window.retryTimer = callback; return 1; };
    window.clearInterval = () => {};
    document.body.innerHTML = '<p id="directory-roster-summary">2 guests</p><article class="directory-card" data-directory-stay-key="shared" data-directory-stay-id="stay-a" data-directory-dog-id="dog-a"></article><article class="directory-card" data-directory-stay-key="shared" data-directory-stay-id="stay-b" data-directory-dog-id="dog-b"></article>';
    maybeOpenDirectoryPushDeepLink();
  ` });
  await expect.poll(() => page.evaluate(() => window.openedCards)).toEqual([]);
  await page.goto('https://today.test/directory.html?stayKey=shared&stayId=stay-b&dogId=dog-b');
  await page.addScriptTag({ content: `
    window.WAFFLE_PAGE = 'directory';
    ${selector}
    ${deepLink}
    window.openedCards = [];
    window.openDirectoryGuestProfile = card => { window.openedCards.push(card.dataset.directoryDogId); return Promise.resolve(); };
    window.setInterval = callback => { window.retryTimer = callback; return 1; };
    window.clearInterval = () => {};
    document.body.innerHTML = '<p id="directory-roster-summary">2 guests <span data-directory-push-link-status role="status">The linked stay could not be opened. Find the guest by Dog ID or refresh the list.</span></p><article class="directory-card" data-directory-stay-key="shared" data-directory-stay-id="stay-a" data-directory-dog-id="dog-a"></article><article class="directory-card" data-directory-stay-key="shared" data-directory-stay-id="stay-b" data-directory-dog-id="dog-b"></article>';
    maybeOpenDirectoryPushDeepLink();
  ` });
  await expect.poll(() => page.evaluate(() => window.openedCards)).toEqual(['dog-b']);
  await expect(page.locator('#directory-roster-summary [data-directory-push-link-status]')).toHaveCount(0);
});

test('Today queue stays readable, touchable, and within the viewport in light and dark layouts', async ({ page }) => {
  await loadQueue(page);
  await page.addStyleTag({ content: queueCss });
  await page.evaluate(() => {
    const event = { title: 'A very long guest name that should wrap without pushing the page sideways', extendedProps: { dogName: 'A very long guest name that should wrap without pushing the page sideways', dogId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', stayKey: 'guest|2026-10-16|2026-10-20', stayId: '66666666-6666-4666-8666-666666666666', stableId: 'visit-1', bookingType: 'Boarding', start: '2026-10-16', end: '2026-10-20' } };
    renderV10OperationsHome([event]);
  });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['', 'dark-theme']) {
      await page.locator('body').evaluate((body, className) => { body.className = className; }, theme);
      const layout = await page.evaluate(() => {
      const link = document.querySelector('.v10-agenda-row .v10-agenda-item');
        const action = document.querySelector('.v10-agenda-action');
        const operation = document.querySelector('.v10-agenda-operation');
        return {
          bodyWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
          linkHeight: link.getBoundingClientRect().height,
          actionHeight: action.getBoundingClientRect().height,
          operationHeight: operation?.getBoundingClientRect().height || 0,
          operationFont: operation ? parseFloat(getComputedStyle(operation).fontSize) : 0,
          actionFont: parseFloat(getComputedStyle(action).fontSize),
          guestFont: parseFloat(getComputedStyle(document.querySelector('.v10-agenda-copy strong')).fontSize),
          queueWidth: document.querySelector('#v10TodayAgenda').getBoundingClientRect().width
        };
      });
      expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.linkHeight).toBeGreaterThanOrEqual(44);
      if (width <= 420) expect(layout.actionHeight).toBe(0);
      else expect(layout.actionHeight).toBeGreaterThanOrEqual(44);
      expect(layout.operationHeight).toBeGreaterThanOrEqual(44);
      expect(layout.operationFont).toBeGreaterThanOrEqual(13);
      expect(layout.actionFont).toBeGreaterThanOrEqual(13);
      expect(layout.guestFont).toBeGreaterThanOrEqual(14);
      expect(layout.queueWidth).toBeLessThanOrEqual(layout.viewportWidth);
    }
  }
});
