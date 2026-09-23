const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'waffle-app.css'), 'utf8');
const start = app.indexOf('function filterGuestDirectoryCards()');
const end = app.indexOf('function intakeAttributeControlHtml(', start);
if (start < 0 || end < 0) throw new Error('Could not locate the Care roster filter functions.');
const rosterFilters = app.slice(start, end);
const cssStart = css.lastIndexOf('/* Care roster: compact, accessible guest rows; details remain in the profile. */');
if (cssStart < 0) throw new Error('Could not locate the Care roster styles.');
const rosterStyles = css.slice(cssStart);

test('Care roster filters keep staying, arriving, past, search, and profile mode aligned', async ({ page }) => {
  await page.setContent(`<!doctype html><html><body>
    <div class="directory-dashboard-fused">
      <button data-v1082-stay-tab="current" class="is-active">Staying <strong id="v1082CurrentStayCount">1</strong></button>
      <button data-v1082-stay-tab="future">Arriving <strong id="v1082FutureStayCount">1</strong></button>
      <button data-v1082-stay-tab="past">Past <strong id="v1082PastStayCount">1</strong></button>
      <p id="directory-roster-summary"></p>
      <div id="directory-grid">
        <div class="directory-card" data-directory-start-date="2026-09-20"><button>Maple</button><div class="directory-profile-content">owner: Ada</div></div>
        <div class="directory-card" data-directory-start-date="2026-10-10"><button>Ravioli</button></div>
      </div>
      <div id="past-directory-grid">
        <div class="directory-card" data-v1082-past-stay="true" data-directory-start-date="2026-08-10"><button>Juniper</button></div>
      </div>
      <input id="guestDirectorySearch">
    </div>
  </body></html>`);
  await page.evaluate(rosterFilters => {
    window.getLocalTodayDateString = () => '2026-09-23';
    window.eval(rosterFilters);
    filterGuestDirectoryCards();
  }, rosterFilters);

  const visibleNames = () => page.locator('.directory-card:visible button').allTextContents();
  await expect.poll(visibleNames).toEqual(['Maple']);
  await expect(page.locator('#directory-roster-summary')).toHaveText('1 staying · 1 arriving soon');

  for (const [view, expected] of [['future', 'Ravioli'], ['past', 'Juniper'], ['current', 'Maple']]) {
    await page.locator(`[data-v1082-stay-tab="${view}"]`).evaluate(node => {
      document.querySelectorAll('[data-v1082-stay-tab]').forEach(tab => tab.classList.remove('is-active'));
      node.classList.add('is-active');
      filterGuestDirectoryCards();
    });
    await expect.poll(visibleNames).toEqual([expected]);
  }

  await page.locator('#guestDirectorySearch').fill('Ada');
  await page.evaluate(() => filterGuestDirectoryCards());
  await expect.poll(visibleNames).toEqual(['Maple']);

  await page.locator('.directory-dashboard-fused').evaluate(node => node.classList.add('is-profile-mode'));
  await page.locator('.directory-card').first().evaluate(node => node.classList.add('is-profile-active'));
  await page.locator('#guestDirectorySearch').fill('no match');
  await page.evaluate(() => filterGuestDirectoryCards());
  await expect.poll(visibleNames).toEqual(['Maple']);
});

test('Care roster stays compact and fits a narrow mobile viewport', async ({ page }) => {
  await page.setContent(`<!doctype html><html><head><style>${rosterStyles}</style></head>
    <body data-waffle-page="directory">
      <main id="directoryTabPanel" class="app-tab-panel active">
        <div class="directory-dashboard directory-dashboard-fused">
          <div class="directory-roster-heading"><div><h1>Guests</h1><p>2 staying · 1 arriving soon</p></div><div class="guest-directory-toolbar"><input class="guest-directory-search" placeholder="Find dog or owner" aria-label="Find a dog or owner"></div></div>
          <nav class="v1082-stay-tabs directory-roster-filters"><button class="v1086-stay-tab is-active">Staying</button><button class="v1086-stay-tab">Arriving</button><button class="v1086-stay-tab">Past</button></nav>
          <div class="directory-grid directory-grid-fused"><div class="directory-card directory-card-fused"><button class="directory-guest-tile-open directory-roster-row" aria-label="Open Maple care profile"><span class="directory-roster-avatar" aria-hidden="true">M</span><span class="directory-roster-copy"><span class="directory-guest-tile-name">Maple</span><span class="directory-roster-context">Cavoodle · leaves today</span></span><span class="directory-roster-status is-alert">Medication</span></button></div></div>
        </div>
      </main>
    </body></html>`);

  const row = page.getByRole('button', { name: 'Open Maple care profile' });
  const dimensions = async () => row.evaluate(node => {
    const box = node.getBoundingClientRect();
    return { width: box.width, height: box.height, scrollWidth: document.documentElement.scrollWidth };
  });

  await expect.poll(async () => (await dimensions()).height).toBeLessThan(90);
  await page.setViewportSize({ width: 375, height: 760 });
  await expect.poll(async () => (await dimensions()).width).toBeLessThanOrEqual(375);
  const mobile = await dimensions();
  expect(mobile.scrollWidth).toBeLessThanOrEqual(375);
});
