const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'waffle-app.css'), 'utf8');
const sourceBadgeCss = fs.readFileSync(path.join(root, 'waffle-v11.1.7.css'), 'utf8');
const carePolishCss = fs.readFileSync(path.join(root, 'waffle-v11.1.8.css'), 'utf8');
const carePolishJs = fs.readFileSync(path.join(root, 'waffle-v11.1.8.js'), 'utf8');
const runtimeCss = fs.readFileSync(path.join(root, 'waffle-runtime.css'), 'utf8');
const careRuntimeStart = runtimeCss.indexOf('/* Care roster refinement:');
const careRuntimeEnd = runtimeCss.indexOf('/* Keep mobile scrolling', careRuntimeStart);
if (careRuntimeStart < 0 || careRuntimeEnd < 0) throw new Error('Could not locate the responsive Care refinements.');
const careRuntimeStyles = runtimeCss.slice(careRuntimeStart, careRuntimeEnd);
const start = app.indexOf('function filterGuestDirectoryCards()');
const end = app.indexOf('function intakeAttributeControlHtml(', start);
if (start < 0 || end < 0) throw new Error('Could not locate the Care roster filter functions.');
const rosterFilters = app.slice(app.indexOf('function setupDirectorySearchControls('), end);
const cssStart = css.lastIndexOf('/* Care roster: compact, accessible guest rows; details remain in the profile. */');
if (cssStart < 0) throw new Error('Could not locate the Care roster styles.');
const rosterStyles = css.slice(cssStart);

test('Care roster filters keep staying, arriving, past, search, and profile mode aligned', async ({ page }) => {
  await page.setContent(`<!doctype html><html><head><style>${rosterStyles}</style></head><body data-waffle-page="directory">
    <div class="directory-dashboard-fused">
      <button data-v1082-stay-tab="current" class="is-active">Staying <strong id="v1082CurrentStayCount">1</strong></button>
      <button data-v1082-stay-tab="future">Arriving <strong id="v1082FutureStayCount">1</strong></button>
      <button data-v1082-stay-tab="past">Past <strong id="v1082PastStayCount">1</strong></button>
      <div class="directory-roster-heading"><div><h1>Guests</h1><p id="directory-roster-summary"></p></div>
        <div class="guest-directory-toolbar"><input id="guestDirectorySearch" class="guest-directory-search"></div></div>
      <div id="directory-grid">
        <div class="directory-card" data-directory-stay-key="maple" data-directory-dog-name="Maple" data-v1088-owner-name="Ada" data-directory-dog-number="0001" data-directory-start-date="2026-09-20"><button>Maple</button><div class="directory-profile-content"><span data-directory-edit-field="ownerName" data-directory-current-value="Ada">owner: Ada</span><div>private profile note</div></div></div>
        <div class="directory-card" data-directory-stay-key="ravioli" data-directory-dog-name="Ravioli" data-v1088-owner-name="Bea" data-directory-start-date="2026-10-10"><button>Ravioli</button></div>
      </div>
      <div id="past-directory-grid">
        <div class="directory-card" data-directory-stay-key="juniper" data-directory-dog-name="Juniper" data-v1088-owner-name="Cam" data-directory-dog-number="0003" data-v1082-past-stay="true" data-directory-start-date="2026-08-10"><button>Juniper</button></div>
      </div>
    </div>
  </body></html>`);
  await page.evaluate(rosterFilters => {
    window.getLocalTodayDateString = () => '2026-09-23';
    window.eval(rosterFilters);
    setupDirectorySearchControls(document.querySelector('#guestDirectorySearch'));
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
  await expect(page.locator('[data-directory-search-feedback]')).toHaveText('1 matching stay');
  await expect(page.locator('#directory-roster-summary')).toHaveText('1 staying · 1 arriving soon');
  await expect(page.locator('[data-directory-search-clear]')).toBeVisible();
  await expect(page.locator('[data-directory-search-clear]')).toHaveCSS('min-height', '44px');
  await page.locator('[data-directory-edit-field="ownerName"]').evaluate(node => { node.dataset.directoryCurrentValue = 'Updated Ada'; });
  await page.locator('#guestDirectorySearch').fill('Updated Ada');
  await page.evaluate(() => filterGuestDirectoryCards());
  await expect.poll(visibleNames).toEqual(['Maple']);
  await page.locator('[data-directory-edit-field="ownerName"]').evaluate(node => { node.dataset.directoryCurrentValue = 'Ada'; });
  await page.locator('#guestDirectorySearch').fill('Ada');
  await page.evaluate(() => filterGuestDirectoryCards());
  await page.locator('[data-directory-search-clear]').click();
  await expect(page.locator('#guestDirectorySearch')).toBeFocused();
  await expect(page.locator('[data-directory-search-feedback]')).toBeHidden();

  await page.locator('#guestDirectorySearch').fill('private profile note');
  await page.evaluate(() => filterGuestDirectoryCards());
  await expect.poll(visibleNames).toEqual([]);
  await expect(page.locator('[data-directory-search-feedback]')).toContainText('No stays match');
  await expect(page.locator('#directory-roster-summary')).toHaveText('1 staying · 1 arriving soon');

  await page.locator('#guestDirectorySearch').fill('0001');
  await page.evaluate(() => filterGuestDirectoryCards());
  await expect.poll(visibleNames).toEqual(['Maple']);
  await page.locator('[data-v1082-stay-tab="future"]').evaluate(node => {
    document.querySelectorAll('[data-v1082-stay-tab]').forEach(tab => tab.classList.remove('is-active'));
    node.classList.add('is-active');
    filterGuestDirectoryCards();
  });
  await expect.poll(visibleNames).toEqual([]);
  await expect(page.locator('[data-directory-search-feedback]')).toContainText('No currently loaded arriving stays match');
  await expect(page.locator('[data-v1082-stay-tab="future"] strong')).toHaveText('1');

  await page.locator('#guestDirectorySearch').fill('Maple');
  await page.locator('[data-v1082-stay-tab="current"]').evaluate(node => {
    document.querySelectorAll('[data-v1082-stay-tab]').forEach(tab => tab.classList.remove('is-active'));
    node.classList.add('is-active');
    filterGuestDirectoryCards();
  });
  for (const theme of ['', 'dark-theme']) {
    await page.locator('body').evaluate((body, value) => body.className = value, theme);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      const button = page.locator('[data-directory-search-clear]');
      const bounds = await button.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      await page.locator('#guestDirectorySearch').focus();
      await page.keyboard.press('Tab');
      await expect(button).toBeFocused();
      await expect(button).toHaveCSS('outline-style', 'solid');
    }
  }

  await page.locator('#guestDirectorySearch').fill('no match');
  await page.evaluate(() => filterGuestDirectoryCards());
  await page.locator('.directory-dashboard-fused').evaluate(node => node.classList.add('is-profile-mode'));
  await page.locator('.directory-card').first().evaluate(node => node.classList.add('is-profile-active'));
  await page.evaluate(() => filterGuestDirectoryCards());
  await expect.poll(visibleNames).toEqual(['Maple']);
});

test('Care roster stays compact and fits a narrow mobile viewport', async ({ page }) => {
  await page.setContent(`<!doctype html><html><head><style>${rosterStyles}\n${sourceBadgeCss}\n${carePolishCss}\n${careRuntimeStyles}</style></head>
    <body data-waffle-page="directory">
      <main id="directoryTabPanel" class="app-tab-panel active">
        <div class="directory-dashboard directory-dashboard-fused">
          <div class="directory-roster-heading"><div><h1>Guests</h1><p>2 staying · 1 arriving soon</p></div><div class="guest-directory-toolbar"><input class="guest-directory-search" placeholder="Find dog or owner" aria-label="Find a dog or owner"></div></div>
          <nav class="v1082-stay-tabs directory-roster-filters"><button class="v1086-stay-tab is-active">Staying</button><button class="v1086-stay-tab">Arriving</button><button class="v1086-stay-tab">Past</button></nav>
          <div class="directory-grid directory-grid-fused"><div class="directory-card directory-card-fused has-request-source has-v1118-care-signals"><button class="directory-guest-tile-open directory-roster-row" aria-label="Open Maple care profile"><span class="directory-roster-avatar" aria-hidden="true">M</span><span class="directory-roster-copy"><span class="directory-guest-tile-name">Maple with a long name</span><span class="directory-roster-context">Cavoodle · leaves today</span></span><span class="directory-roster-status is-alert">Medication</span><span class="v1117-care-source-badge"><span class="v1117-care-source-label">MadPaws</span></span><span class="v1118-status-chip v1118-care-status is-checked-out">CHECKED OUT</span><span class="v1118-care-signals"><span class="v1118-care-signal"><span aria-hidden="true">💊</span><span>Medication</span></span><span class="v1118-care-signal"><span aria-hidden="true">📋</span><span>Intake missing</span></span></span></button></div></div>
        </div>
      </main>
    </body></html>`);

  const row = page.getByRole('button', { name: 'Open Maple care profile' });
  await expect(page.locator('.directory-roster-heading h1')).toHaveText('Guests');
  await expect(page.getByLabel('Find a dog or owner')).toBeVisible();
  await expect(page.locator('.directory-roster-filters')).toBeVisible();
  const dimensions = async () => row.evaluate(node => {
    const box = node.getBoundingClientRect();
    return { width: box.width, height: box.height, scrollWidth: document.documentElement.scrollWidth };
  });

  await expect.poll(async () => (await dimensions()).height).toBeLessThan(180);
  await page.setViewportSize({ width: 375, height: 760 });
  await expect.poll(async () => (await dimensions()).width).toBeLessThanOrEqual(375);
  const mobile = await dimensions();
  expect(mobile.scrollWidth).toBeLessThanOrEqual(375);
  const careControlsFit = await page.evaluate(() => {
    const controls = [
      document.querySelector('.directory-roster-heading'),
      document.querySelector('.directory-roster-filters'),
      document.querySelector('.guest-directory-search')
    ].filter(Boolean);
    return controls.every(node => node.getBoundingClientRect().right <= innerWidth + 1);
  });
  expect(careControlsFit).toBe(true);

  await expect(row.locator('.v1118-care-status')).toHaveText('CHECKED OUT');
  await expect(row.locator('.v1118-care-signal', { hasText: 'Medication' })).toBeVisible();
  await expect(row.locator('.v1118-care-signal', { hasText: 'Intake missing' })).toBeVisible();
  await expect(row.locator('.v1117-care-source-label')).toHaveText('MadPaws');

  const boxes = await row.evaluate(node => {
    const selectors = ['.directory-roster-copy', '.v1117-care-source-badge', '.v1118-care-status', '.v1118-care-signals'];
    return selectors.map(selector => {
      const box = node.querySelector(selector).getBoundingClientRect();
      return { selector, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    });
  });
  const [copy, source, status, signals] = boxes;
  expect(copy.right).toBeLessThanOrEqual(source.left);
  expect(status.bottom).toBeLessThanOrEqual(signals.top);
});

test('Care stay-link controls and profile actions remain usable on desktop and mobile', async ({ page }) => {
  await page.setContent(`<!doctype html><html><head><style>${rosterStyles}\n${careRuntimeStyles}</style></head>
    <body data-waffle-page="directory"><main id="directoryTabPanel" class="app-tab-panel active">
      <div class="directory-dashboard-fused">
        <div class="directory-roster-heading"><div><h1>Guests</h1><p>2 staying · 1 arriving soon</p></div>
          <div class="guest-directory-toolbar"><input class="guest-directory-search" aria-label="Find a dog or owner"><button class="care-stay-link-trigger">Link older stay</button></div></div>
        <section class="care-stay-link"><header class="care-stay-link-header"><div><small>CARE RECORDS</small><h2>Link a past stay</h2><p>Choose the exact stay and numbered dog it belongs to.</p></div><button class="care-stay-link-close" aria-label="Close stay linking">×</button></header>
          <div class="care-stay-link-body"><div class="care-stay-link-form"><label>Past stay<select><option>Maple · 1–4 Sep · Ada · no Dog ID</option></select></label><label>Link to numbered dog<select><option>#00001 · Maple</option></select></label><button class="care-stay-link-review">Review link</button></div>
            <div class="care-stay-link-review-card"><strong>Stay to link</strong><span>Maple · 1–4 Sep</span><strong>Numbered dog</strong><span>#00001 · Maple</span><label class="care-stay-link-explicit-check"><input type="checkbox">I confirm this exact stay belongs to #00001.</label><div class="care-stay-link-actions"><button>Back</button><button>Link this stay</button></div></div></div></section>
        <div class="directory-profile-back-bar"><button class="directory-profile-back-btn">← Guests</button><div class="directory-profile-breadcrumb"><strong>Maple</strong></div><div class="directory-profile-tools"><span class="directory-care-summary">1 alert · 1 dog</span><button class="directory-legacy-global-btn">Upload PDF</button><button class="belongings-refresh-btn">Refresh</button></div></div>
      </div></main></body></html>`);

  const form = page.locator('.care-stay-link-form');
  await expect(page.locator('.care-stay-link-trigger')).toBeVisible();
  await expect(page.locator('.directory-profile-tools button')).toHaveCount(2);
  const desktopColumns = await form.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
  expect(desktopColumns).toBe(3);

  await page.setViewportSize({ width: 360, height: 760 });
  const mobile = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    columns: getComputedStyle(document.querySelector('.care-stay-link-form')).gridTemplateColumns.split(' ').length,
    controlsRight: Math.max(
      document.querySelector('.directory-profile-back-bar').getBoundingClientRect().right,
      document.querySelector('.care-stay-link').getBoundingClientRect().right,
      document.querySelector('.directory-roster-heading').getBoundingClientRect().right
    )
  }));
  expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.viewport);
  expect(mobile.controlsRight).toBeLessThanOrEqual(mobile.viewport + 1);
  expect(mobile.columns).toBe(1);
  await expect(page.locator('.care-stay-link-explicit-check input')).toBeVisible();
  await expect(page.locator('.directory-profile-tools button').first()).toBeVisible();
  await expect(page.locator('.directory-profile-tools button').last()).toBeVisible();
});

test('legacy Care sort controls are retired', async () => {
  expect(carePolishJs).not.toContain('Today’s priority');
  expect(carePolishJs).not.toContain('data-v1118-sort');
  expect(carePolishJs).toContain('removeCareSort');
});
