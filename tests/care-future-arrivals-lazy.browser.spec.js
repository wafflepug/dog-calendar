const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const futureRange = fs.readFileSync('waffle-v11.1.96.js', 'utf8');
const futureBridge = fs.readFileSync('waffle-v11.1.99.js', 'utf8');

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
            data-end-date="${nearEnd}" data-stay-key="near pup|${nearStart}|${nearEnd}">
            <button type="button" data-open-directory-profile>Near Pup</button>
          </article>
        </div>
      </section>
      <nav><button type="button" data-v1082-stay-tab="current">Staying</button><button type="button" class="is-active" data-v1082-stay-tab="future">Arriving</button></nav>
      <div class="guest-directory-toolbar"><input id="guestDirectorySearch" aria-label="Find dog or owner"><button type="button" data-directory-search-clear>Clear search</button><p data-directory-search-feedback role="status"></p></div>
      <p class="guest-directory-toolbar-note"></p>
    </main>
  </body></html>`);
  await page.addStyleTag({ path: 'waffle-v11.1.96.css' });

  await page.evaluate(({ nearStart, nearEnd, distantStart, distantEnd }) => {
    window.WAFFLE_PAGE = 'directory';
    window.filterGuestDirectoryCards = function () {
      const query = document.getElementById('guestDirectorySearch').value.toLocaleLowerCase();
      const cards = Array.from(document.querySelectorAll('#directory-grid .directory-card'));
      let count = 0;
      for (const card of cards) {
        const text = [card.dataset.directoryDogName, card.dataset.v1088OwnerName, card.dataset.directoryDogId].join(' ').toLocaleLowerCase();
        const visible = text.includes(query);
        card.style.display = visible ? 'block' : 'none';
        count += Number(visible);
      }
      const feedback = document.querySelector('[data-directory-search-feedback]');
      feedback.hidden = !query;
      feedback.textContent = query ? count ? `${count} matching ${count === 1 ? 'stay' : 'stays'}` :
        window.WAFFLE_V11196_FUTURE_RANGE?.isExpanded()
          ? `No cached arrivals in the next six months match “${query}”.`
          : `No currently loaded arriving stays match “${query}”.` : '';
    };
    document.getElementById('guestDirectorySearch').addEventListener('input', window.filterGuestDirectoryCards);
    document.querySelector('[data-directory-search-clear]').addEventListener('click', () => {
      const input = document.getElementById('guestDirectorySearch');
      input.value = '';
      window.filterGuestDirectoryCards();
    });
    document.querySelector('[data-v1082-stay-tab="future"]').addEventListener('click', () => {
      document.querySelector('.directory-dashboard-fused').dataset.v11195StayView = 'future';
    });
    document.querySelectorAll('[data-v1082-stay-tab]').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('[data-v1082-stay-tab]').forEach(item => item.classList.toggle('is-active', item === tab));
      document.querySelector('.directory-dashboard-fused').dataset.v11195StayView = tab.dataset.v1082StayTab;
    }));
    window.fixtureEvents = [
      { title: 'Near Pup', start: nearStart, end: nearEnd, allDay: true, extendedProps: { dogName: 'Near Pup', rawStartDate: nearStart, rawEndDate: nearEnd } },
      { title: 'Distant Pup', start: distantStart, end: distantEnd, allDay: true, extendedProps: { dogName: 'Distant Pup', ownerName: 'Ada Owner', breed: 'Cavoodle', rawStartDate: distantStart, rawEndDate: distantEnd } },
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
    window.WAFFLE_V11196_FUTURE_RANGE.updateEvents([near, distant, {
      ...distant,
      id: 'distant-2',
      title: 'Another Distant Pup',
      extendedProps: { ...distant.extendedProps, dogName: 'Another Distant Pup' }
    }]);
  });
  await expect(page.getByRole('button', { name: /View 2 later arrivals/ })).toBeVisible();
  expect(await page.evaluate(() => window.WAFFLE_V11196_FUTURE_RANGE.totalFutureCount())).toBe(3);
});

test('later arrival search is explicit, preserves the active tab and query, and leaves details lazy', async ({ page }) => {
  await mountCareRange(page);
  await page.getByLabel('Find dog or owner').fill('Near Pup');
  await expect(page.getByRole('button', { name: 'Search later arrivals' })).toBeVisible();
  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await expect(page.getByRole('button', { name: 'Search later arrivals' })).toBeVisible();
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Search later arrivals' }).click();
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(1);
  await expect(page.locator('.directory-dashboard-fused')).toHaveAttribute('data-v11195-stay-view', 'future');
  await expect(page.locator('[data-v1082-stay-tab="future"]')).toHaveClass(/is-active/);
  await expect(page.getByLabel('Find dog or owner')).toHaveValue('Distant Pup');
  await expect(page.locator('[data-directory-search-feedback]')).toHaveText('1 matching stay');
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"] [data-directory-detail="profile"]')).toHaveAttribute('data-detail-loaded', 'false');
});

test('no cached later arrivals means no later-search action and the current feedback stays intact', async ({ page }) => {
  await mountCareRange(page);
  await page.evaluate(() => window.WAFFLE_V11196_FUTURE_RANGE.updateEvents([window.fixtureEvents[0]]));
  await page.getByLabel('Find dog or owner').fill('Missing Pup');
  await expect(page.locator('[data-directory-search-feedback]')).toContainText('No currently loaded arriving stays match');
  await expect(page.locator('[data-v11196-search-later]')).toBeHidden();
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(0);
});

test('query and tab changes during deferred materialization invalidate the pending completion', async ({ page }) => {
  await mountCareRange(page);
  await page.evaluate(() => {
    window.queuedFrames = [];
    window.requestAnimationFrame = callback => { window.queuedFrames.push(callback); return window.queuedFrames.length; };
  });
  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await page.evaluate(() => window.queuedFrames.splice(0).forEach(callback => callback()));
  const action = page.getByRole('button', { name: 'Search later arrivals' });
  await action.click();
  await page.getByLabel('Find dog or owner').fill('Different query');
  await page.evaluate(() => window.queuedFrames.splice(0).forEach(callback => callback()));
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(0);
  await expect(page.getByLabel('Find dog or owner')).toHaveValue('Different query');
  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await expect(page.getByRole('button', { name: 'Search later arrivals' })).toBeVisible();
  await page.locator('[data-v1082-stay-tab="current"]').click();
  await expect(page.locator('[data-v11196-search-later]')).toBeHidden();
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(0);
});

test('same-name same-date later dogs retain persisted Dog ID and Stay ID identities', async ({ page }) => {
  await mountCareRange(page);
  await page.evaluate(() => {
    const distant = window.fixtureEvents[1];
    distant.extendedProps.dogId = 'dog-id-1';
    distant.extendedProps.stayId = 'stay-id-1';
    const twin = { ...distant, extendedProps: { ...distant.extendedProps, dogId: 'dog-id-2', stayId: 'stay-id-2' } };
    window.WAFFLE_V11196_FUTURE_RANGE.updateEvents([window.fixtureEvents[0], distant, twin]);
  });
  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await page.getByRole('button', { name: 'Search later arrivals' }).click();
  const laterCards = page.locator('#directory-grid [data-v11196-synthetic-future="true"]');
  await expect(laterCards).toHaveCount(2);
  await expect(page.locator('[data-v11196-synthetic-future="true"][data-directory-dog-id="dog-id-1"][data-directory-stay-id="stay-id-1"]')).toHaveCount(1);
  await expect(page.locator('[data-v11196-synthetic-future="true"][data-directory-dog-id="dog-id-2"][data-directory-stay-id="stay-id-2"]')).toHaveCount(1);
  await expect(page.locator('[data-directory-search-feedback]')).toHaveText('2 matching stays');
});

test('a unique ID-bearing calendar event reuses a matching legacy card without duplicating it', async ({ page }) => {
  await mountCareRange(page);
  await page.evaluate(({ distantStart, distantEnd }) => {
    const legacy = document.createElement('article');
    legacy.className = 'directory-card';
    legacy.dataset.directoryStayKey = `distant pup|${distantStart}|${distantEnd}`;
    legacy.dataset.directoryDogName = 'Distant Pup';
    legacy.dataset.directoryStartDate = distantStart;
    legacy.dataset.directoryEndDate = distantEnd;
    legacy.dataset.v1088OwnerName = 'Ada Owner';
    document.getElementById('directory-grid').append(legacy);
    const distant = window.fixtureEvents[1];
    distant.extendedProps.dogId = 'dog-id-1';
    distant.extendedProps.stayId = 'stay-id-1';
    window.WAFFLE_V11196_FUTURE_RANGE.updateEvents([window.fixtureEvents[0], distant]);
  }, { distantStart: addDays(new Date(), 35), distantEnd: addDays(new Date(), 39) });
  await page.evaluate(() => window.WAFFLE_V11196_FUTURE_RANGE.activateLaterArrivals());
  await expect(page.locator('#directory-grid [data-directory-dog-name="Distant Pup"]')).toHaveCount(1);
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(0);
});

test('the search action fits a 320px viewport with a 44px target', async ({ page }) => {
  await mountCareRange(page);
  await page.getByLabel('Find dog or owner').fill('Missing Pup');
  const button = page.locator('[data-v11196-search-later]');
  await expect(button).toBeVisible();
  const box = await button.evaluate(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, right: node.getBoundingClientRect().right }));
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.right).toBeLessThanOrEqual(320);
  await page.locator('body').evaluate(node => node.classList.add('dark-theme'));
  await expect(button).toBeVisible();
  const darkBox = await button.evaluate(node => ({ height: node.getBoundingClientRect().height, right: node.getBoundingClientRect().right }));
  expect(darkBox.height).toBeGreaterThanOrEqual(44);
  expect(darkBox.right).toBeLessThanOrEqual(320);
});

test('settled tab switches and Clear hide the action; collapsing restores the loaded-only feedback', async ({ page }) => {
  await mountCareRange(page);
  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await expect(page.getByRole('button', { name: 'Search later arrivals' })).toBeVisible();
  await page.getByRole('button', { name: 'Search later arrivals' }).click();
  await expect(page.locator('[data-directory-search-feedback]')).toHaveText('1 matching stay');
  await page.getByRole('button', { name: 'Show next 7 days only' }).click();
  await expect(page.locator('[data-v11196-search-later]')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.locator('[data-v11196-search-later]')).toBeHidden();
  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await page.locator('[data-v1082-stay-tab="current"]').click();
  await expect(page.locator('[data-v11196-search-later]')).toBeHidden();
});

test('local cached search makes no network request and retries after a partial render failure', async ({ page }) => {
  let requests = 0;
  page.on('request', () => { requests++; });
  await mountCareRange(page);
  await page.context().setOffline(true);
  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await page.evaluate(() => {
    let fail = true;
    window.WAFFLE_V11201_CARE_COUNT_CONSISTENCY = {
      reconcileCounts() {
        if (fail) { fail = false; throw new Error('fixture render failure after cards appended'); }
      }
    };
  });
  await page.getByRole('button', { name: 'Search later arrivals' }).click();
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry later arrivals search' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry later arrivals search' }).click();
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(1);
  expect(requests).toBe(0);
});

test('expanded unmatched feedback stays scoped to the cached six-month horizon', async ({ page }) => {
  await mountCareRange(page);
  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await page.getByRole('button', { name: 'Search later arrivals' }).click();
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(1);
  await page.getByLabel('Find dog or owner').fill('No such dog');
  await expect(page.locator('[data-directory-search-feedback]')).toHaveText('No cached arrivals in the next six months match “no such dog”.');
});

test('full-range CSV cache preserves Dog ID and Stay ID from named headers', async ({ page }) => {
  await page.setContent('<!doctype html><html><body data-waffle-page="directory"></body></html>');
  await page.evaluate(() => {
    window.WAFFLE_PAGE = 'directory';
    Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: key => key === 'boardingDataCache' ? 'fixture' : '[]' } });
    const start = new Date();
    start.setDate(start.getDate() + 35);
    const end = new Date(start);
    end.setDate(end.getDate() + 2);
    window.fixtureFutureStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    window.fixtureFutureEnd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    window.WaffleCsv = { parse: () => ({ ok: true, records: [
      { cells: ['Row', 'Dog Name', 'Breed', 'Start', 'End', 'Owner', 'Phone', 'Unused 7', 'Unused 8', 'Notes', 'Edit Link', 'Booking Type', 'Dog ID', 'Stay ID'], raw: 'header' },
      { cells: ['1', 'Distant Pup', 'Cavoodle', window.fixtureFutureStart, window.fixtureFutureEnd, 'Ada Owner', '0400000000', '', '', '', '', 'Boarding', 'dog-uuid-1', 'stay-uuid-1'], raw: 'row' }
    ] }) };
  });
  await page.addScriptTag({ content: futureBridge });
  const [event] = await page.evaluate(() => window.WAFFLE_V11199_FUTURE_DATA_BRIDGE.readConfirmedEvents());
  expect(event.extendedProps.dogId).toBe('dog-uuid-1');
  expect(event.extendedProps.stayId).toBe('stay-uuid-1');
  expect(event.extendedProps.rawStartDate).toBe(await page.evaluate(() => window.fixtureFutureStart));
});

test('an ID-bearing canonical card and compatible legacy cache stay count once', async ({ page }) => {
  await mountCareRange(page);
  await page.evaluate(() => {
    const event = window.fixtureEvents[1];
    const card = document.createElement('article');
    card.className = 'directory-card';
    Object.assign(card.dataset, {directoryStayKey:`distant pup|${event.extendedProps.rawStartDate}|${event.extendedProps.rawEndDate}`,directoryDogName:'Distant Pup',directoryStartDate:event.extendedProps.rawStartDate,directoryEndDate:event.extendedProps.rawEndDate,directoryDogId:'dog-id-1',directoryStayId:'stay-id-1',v1088OwnerName:'Ada Owner'});
    document.getElementById('directory-grid').append(card);
    window.WAFFLE_V11196_FUTURE_RANGE.updateEvents([window.fixtureEvents[0],event]);
    window.WAFFLE_V11196_FUTURE_RANGE.activateLaterArrivals();
  });
  await expect(page.locator('#directory-grid [data-directory-dog-name="Distant Pup"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.WAFFLE_V11196_FUTURE_RANGE.totalFutureCount())).toBe(2);
});
