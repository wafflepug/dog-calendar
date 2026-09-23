const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const futureRange = fs.readFileSync('waffle-v11.1.96.js', 'utf8');

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
      <nav><button type="button" data-v1082-stay-tab="future">Arriving</button></nav>
      <input id="guestDirectorySearch" aria-label="Find dog or owner">
      <p class="guest-directory-toolbar-note"></p>
    </main>
  </body></html>`);

  await page.evaluate(({ nearStart, nearEnd, distantStart, distantEnd }) => {
    window.WAFFLE_PAGE = 'directory';
    document.querySelector('[data-v1082-stay-tab="future"]').addEventListener('click', () => {
      document.querySelector('.directory-dashboard-fused').dataset.v11195StayView = 'future';
    });
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

test('search for a deferred arrival expands it and switches to Arriving', async ({ page }) => {
  await mountCareRange(page);
  await page.locator('.directory-dashboard-fused').evaluate(node => { node.dataset.v11195StayView = 'current'; });
  await page.getByLabel('Find dog or owner').fill('Near Pup');
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(0);
  await expect(page.locator('.directory-dashboard-fused')).toHaveAttribute('data-v11195-stay-view', 'current');

  await page.getByLabel('Find dog or owner').fill('Distant Pup');
  await expect(page.locator('#directory-grid [data-v11196-synthetic-future="true"]')).toHaveCount(1);
  await expect(page.locator('.directory-dashboard-fused')).toHaveAttribute('data-v11195-stay-view', 'future');
});
