const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const app = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const start = app.indexOf('function ensureDirectorySearchStatus()');
const end = app.indexOf('function intakeAttributeControlHtml(', start);
if (start < 0 || end < 0) throw new Error('Could not locate the canonical directory filter.');
const rosterRuntime = app.slice(start, end);
const workflow = fs.readFileSync(path.join(__dirname, '..', 'care-roster-focus.js'), 'utf8');
const arrival = fs.readFileSync(path.join(__dirname, '..', 'care-arrival-ready.js'), 'utf8');

async function setup(page) {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0;font:16px Arial}.guest-directory-toolbar{max-width:100%;display:flex;flex-wrap:wrap;gap:4px}.care-roster-focus{max-width:100%}
    #directory-grid{max-width:100%}.directory-card{padding:8px}.v1082-stay-panels section[hidden]{display:none}
  </style></head><body><main class="directory-dashboard-fused" data-directory-roster-load-state="success">
    <header><div class="guest-directory-toolbar"><input id="guestDirectorySearch" type="search" aria-label="Search"></div></header>
    <nav><button class="is-active" data-v1082-stay-tab="current">Staying</button><button data-v1082-stay-tab="future">Arriving</button><button data-v1082-stay-tab="past">Past</button></nav>
    <div id="directory-empty-state" hidden><strong data-directory-empty-title></strong><p data-directory-empty-copy></p><button data-directory-empty-action></button></div>
    <div class="v1082-stay-panels"><section data-v1082-stay-panel="current"><div id="directory-grid"></div></section><section data-v1082-stay-panel="future" hidden><div id="future-directory-grid"></div></section><section data-v1082-stay-panel="past" hidden><div id="past-directory-grid"></div></section></div>
    <span id="v1082CurrentStayCount">3</span><span id="v1082FutureStayCount">1</span><span id="v1082PastStayCount">0</span>
  </main></body></html>`);
  await page.evaluate(({ rosterRuntime, workflow, arrival }) => {
    window.getLocalTodayDateString = () => '2026-10-18';
    window.v110OperationDisplayState = card => ({ code: card.dataset.operationState || 'unknown' });
    window.eval(rosterRuntime);
    document.querySelectorAll('[data-v1082-stay-tab]').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('[data-v1082-stay-tab]').forEach(item => item.classList.toggle('is-active', item === tab));
      document.querySelectorAll('[data-v1082-stay-panel]').forEach(panel => { panel.hidden = panel.dataset.v1082StayPanel !== tab.dataset.v1082StayTab; });
      filterGuestDirectoryCards();
    }));
    document.getElementById('guestDirectorySearch').addEventListener('input', filterGuestDirectoryCards);
    window.eval(workflow);
    window.eval(arrival);
    window.WAFFLE_REAPPLY_DIRECTORY_FILTER();
  }, { rosterRuntime, workflow, arrival });
}

async function addStay(page, { stay, dog, name = 'Milo', key = stay, start = '2026-10-18', end = '2026-10-20', op = 'date_active', currentGrid = false }) {
  await page.evaluate(input => {
    const card = document.createElement('article');
    card.className = 'directory-card';
    Object.assign(card.dataset, {
      directoryStayId: input.stay, directoryDogId: input.dog, directoryStayKey: input.key,
      directoryDogName: input.name, directoryStartDate: input.start, directoryEndDate: input.end,
      operationState: input.op
    });
    card.innerHTML = '<button class="directory-guest-tile-open">Open profile</button><span data-directory-intake aria-busy="false">Intake complete</span><button data-v11217-roster-checkin>Check In</button>';
    const host = input.start > '2026-10-18' && !input.currentGrid ? document.getElementById('future-directory-grid') : document.getElementById('directory-grid');
    host.appendChild(card);
    window.WAFFLE_REAPPLY_DIRECTORY_FILTER();
  }, { stay, dog, name, key, start, end, op, currentGrid });
}

test('operational filters combine with canonical search and stay tabs; unknown and collisions stay excluded', async ({ page }) => {
  await setup(page);
  await addStay(page, { stay: 'stay-a', dog: 'dog-a', name: 'Milo', key: 'same-legacy-key' });
  await addStay(page, { stay: 'stay-b', dog: 'dog-b', name: 'Milo', key: 'same-legacy-key' });
  await addStay(page, { stay: 'stay-a-visit-two', dog: 'dog-a', name: 'Milo', key: 'same-legacy-key' });
  await addStay(page, { stay: 'stay-daycare', dog: 'dog-c', name: 'Pip', start: '2026-10-18', end: '2026-10-18' });
  await addStay(page, { stay: 'stay-leaving', dog: 'dog-d', name: 'Fern', start: '2026-10-16', end: '2026-10-18', op: 'checked_in' });
  await addStay(page, { stay: 'stay-unknown', dog: 'dog-e', name: 'Unknown', op: 'unknown' });
  await addStay(page, { stay: 'stay-out', dog: 'dog-f', name: 'Checked Out', op: 'checked_out' });
  await addStay(page, { stay: 'stay-collision', dog: 'dog-g', name: 'Collision', op: 'collision' });
  await addStay(page, { stay: 'stay-future', dog: 'dog-h', name: 'Tomorrow', start: '2026-10-19', end: '2026-10-20' });

  const filters = page.locator('[data-care-roster-focus]');
  await expect(filters).toContainText('Arriving today 4');
  await expect(filters).toContainText('Leaving today 2');
  await expect(filters).toContainText("2 loaded stays have unknown or conflicting operational status and are omitted from today's counts");
  await filters.locator('summary').click();
  await filters.locator('[data-focus-mode="arriving"]').click();
  await expect(page.locator('#directory-grid .directory-card:visible')).toHaveCount(4);
  await page.locator('#guestDirectorySearch').fill('milo');
  await expect(page.locator('#directory-grid .directory-card:visible')).toHaveCount(3);
  await page.locator('#guestDirectorySearch').fill('nobody');
  await expect(page.locator('#directory-search-status')).toContainText('Arriving today');
  await expect(page.locator('#directory-search-status')).toContainText('No loaded guests match');
  await page.locator('[data-focus-clear]').click();
  await expect(page.locator('#guestDirectorySearch')).toHaveValue('nobody');
  await expect(page.locator('[data-focus-mode="all"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#guestDirectorySearch').fill('');
  await filters.locator('[data-focus-mode="leaving"]').click();
  await expect(page.locator('#directory-grid .directory-card:visible')).toHaveCount(2);
  await page.locator('[data-v1082-stay-tab="future"]').click();
  await expect(page.locator('[data-v1082-stay-panel="future"] .directory-card:visible')).toHaveCount(1);
  await expect(filters).toBeHidden();
  await page.locator('[data-v1082-stay-tab="current"]').click();
  await expect(filters).toBeVisible();
  await expect(page.locator('#directory-grid .directory-card:visible')).toHaveCount(2);
  await page.evaluate(() => {
    const dashboard = document.querySelector('.directory-dashboard-fused');
    dashboard.classList.add('is-profile-mode');
    dashboard.querySelector('.directory-card').classList.add('is-profile-active');
    filterGuestDirectoryCards();
  });
  await expect(filters).toBeHidden();
  await page.evaluate(() => {
    const dashboard = document.querySelector('.directory-dashboard-fused');
    dashboard.classList.remove('is-profile-mode');
    dashboard.querySelector('.directory-card').classList.remove('is-profile-active');
    filterGuestDirectoryCards();
  });
  await expect(filters).toBeVisible();
  await expect(page.locator('#directory-grid .directory-card:visible')).toHaveCount(2);
  await filters.locator('summary').click();
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {});
    observer.observe(document.querySelector('[data-care-roster-focus]'), { subtree: true, attributes: true, childList: true, characterData: true });
    window.WAFFLE_CARE_ROSTER_FOCUS.refresh();
    window.WAFFLE_CARE_ROSTER_FOCUS.refresh();
    window.testRefreshMutations = observer.takeRecords().map(record => ({ type: record.type, target: record.target.outerHTML?.slice(0, 160) || record.target.textContent?.slice(0, 80), attribute: record.attributeName }));
    observer.disconnect();
  });
  await expect(filters).not.toHaveAttribute('open', '');
  expect(await page.evaluate(() => window.testRefreshMutations)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const button of await page.locator('[data-focus-mode], [data-focus-clear]').all()) {
    expect(await button.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
});

test('a verified check-in drops out of Next arrival without skipping the next pending stay', async ({ page }) => {
  await setup(page);
  await addStay(page, { stay: 'stay-a', dog: 'dog-a', name: 'A' });
  await addStay(page, { stay: 'stay-b', dog: 'dog-b', name: 'B' });
  await addStay(page, { stay: 'stay-c', dog: 'dog-c', name: 'C' });
  const next = page.locator('[data-waffle-arrival-next]');
  await expect(next).toHaveText('Next arrival · 3');
  await next.click();
  await expect(page.locator('.directory-card').nth(0).locator('[data-v11217-roster-checkin]')).toBeFocused();
  await page.locator('.directory-card').nth(0).evaluate(card => {
    card.dataset.operationState = 'checked_in';
    card.querySelector('[data-v11217-roster-checkin]').remove();
  });
  await page.evaluate(() => window.WAFFLE_ARRIVAL_READY.refresh());
  await expect(next).toHaveText('Next arrival · 2');
  await next.click();
  await expect(page.locator('.directory-card').nth(1).locator('[data-v11217-roster-checkin]')).toBeFocused();
});

test('arrival dates follow the local stay-day boundary and include same-day daycare', async ({ page }) => {
  await setup(page);
  await addStay(page, { stay: 'tomorrow', dog: 'dog-tomorrow', name: 'Pip', start: '2026-10-19', end: '2026-10-19', currentGrid: true });
  const filters = page.locator('[data-care-roster-focus]');
  await expect(filters.locator('[data-focus-count="arriving"]')).toHaveText('0');
  await page.evaluate(() => {
    window.getLocalTodayDateString = () => '2026-10-19';
    window.WAFFLE_CARE_ROSTER_FOCUS.refresh();
  });
  await expect(filters.locator('[data-focus-count="arriving"]')).toHaveText('1');
  await filters.locator('summary').click();
  await filters.locator('[data-focus-mode="arriving"]').click();
  await expect(page.locator('#directory-grid .directory-card:visible')).toHaveCount(1);
});
