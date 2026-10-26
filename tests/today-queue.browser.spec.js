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
  const links = page.locator('#v10TodayAgenda > a.v10-agenda-item');
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
    const event = { title: 'A very long guest name that should wrap without pushing the page sideways', extendedProps: { dogName: 'A very long guest name that should wrap without pushing the page sideways', stayKey: 'guest|2026-10-16|2026-10-20', stayId: 'stay-1', stableId: 'visit-1', start: '2026-10-16', end: '2026-10-20' } };
    renderV10OperationsHome([event]);
  });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['', 'dark-theme']) {
      await page.locator('body').evaluate((body, className) => { body.className = className; }, theme);
      const layout = await page.evaluate(() => {
        const link = document.querySelector('.v10-agenda-item');
        const action = document.querySelector('.v10-agenda-action');
        return {
          bodyWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
          linkHeight: link.getBoundingClientRect().height,
          actionHeight: action.getBoundingClientRect().height,
          actionFont: parseFloat(getComputedStyle(action).fontSize),
          guestFont: parseFloat(getComputedStyle(document.querySelector('.v10-agenda-copy strong')).fontSize),
          queueWidth: document.querySelector('#v10TodayAgenda').getBoundingClientRect().width
        };
      });
      expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.linkHeight).toBeGreaterThanOrEqual(44);
      expect(layout.actionHeight).toBeGreaterThanOrEqual(44);
      expect(layout.actionFont).toBeGreaterThanOrEqual(13);
      expect(layout.guestFont).toBeGreaterThanOrEqual(14);
      expect(layout.queueWidth).toBeLessThanOrEqual(layout.viewportWidth);
    }
  }
});
