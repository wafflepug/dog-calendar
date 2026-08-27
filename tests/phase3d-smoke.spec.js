const fs = require('fs');
const { test, expect } = require('@playwright/test');

const BASE = process.env.WAFFLE_BASE_URL || 'https://wafflepug.github.io/dog-calendar';
const APPS = process.env.WAFFLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwn4HL49K9c3AZbXJRUjPw3UYWxJt8DmqXwMnTytyqdSstj3ZIJwWdDEC2IsBjetOf3pw/exec';

async function maintenanceStatus(request) {
  const response = await request.get(`${APPS}?action=maintenance_status&_=${Date.now()}`, { timeout: 20000 });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

function committedMaintenanceState() {
  const source = fs.readFileSync('apps-script/MaintenanceMode.js', 'utf8');
  const match = source.match(/WAFFLE_MAINTENANCE_DEFAULT_\s*=\s*(true|false)\s*;/);
  if (!match) throw new Error('Could not determine committed maintenance default.');
  return match[1] === 'true';
}

async function waitForMaintenanceState(request) {
  const expected = committedMaintenanceState();
  let last = null;
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    last = await maintenanceStatus(request);
    if (last && last.result === 'success' && last.enabled === expected) return last;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error(`Live maintenance did not converge to committed state ${expected}; last=${last && last.enabled}`);
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`${error.name || 'Error'}:${error.message || ''}`));
  return errors;
}

async function expectCanonical(page, marker) {
  await page.waitForFunction(name => Boolean(window[name]), marker, { timeout: 15000 });
  await page.waitForFunction(() => Boolean(window.WAFFLE_UI_CANONICAL), null, { timeout: 15000 });
  await page.waitForFunction(() => Boolean(window.WAFFLE_AI_CANONICAL), null, { timeout: 15000 });
}

test('release metadata and system status assets are deployed', async ({ request }) => {
  const [build, release, status] = await Promise.all([
    request.get(`${BASE}/waffle-build.json?_=${Date.now()}`),
    request.get(`${BASE}/waffle-release.json?_=${Date.now()}`),
    request.get(`${BASE}/system-status.html?_=${Date.now()}`)
  ]);
  expect(build.ok()).toBeTruthy();
  expect(release.ok()).toBeTruthy();
  expect(status.ok()).toBeTruthy();
  const releaseJson = await release.json();
  expect(releaseJson.phase).toBe('phase-3d-release-regression-observability');
  expect(releaseJson.productionWritesInSmokeTests).toBe(false);
});

test('maintenance gate or live canonical pages behave safely', async ({ browser, request }) => {
  const maintenance = await waitForMaintenanceState(request);

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = collectPageErrors(page);

  if (maintenance.enabled === true) {
    await page.goto(`${BASE}/index.html?phase3dSmoke=${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/maintenance\.html/, { timeout: 12000 });
    await expect(page.getByText(/temporarily down for maintenance/i)).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
    return;
  }

  const pages = [
    ['index.html', 'WAFFLE_CALENDAR_CANONICAL'],
    ['directory.html', 'WAFFLE_CARE_CANONICAL'],
    ['reminders.html', 'WAFFLE_ORGANISER_CANONICAL'],
    ['audit.html', 'WAFFLE_LOGS_CANONICAL']
  ];

  for (const [path, marker] of pages) {
    await page.goto(`${BASE}/${path}?phase3dSmoke=${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await expectCanonical(page, marker);
    await expect(page.locator('#aw37launch')).toHaveCount(1);
    await expect(page.locator('#themeToggle')).toHaveCount(1);
  }

  expect(errors).toEqual([]);
  await context.close();
});

test('Care profile tabs when available and mobile sitter shell are interactive when maintenance is off', async ({ browser, request }) => {
  const maintenance = await waitForMaintenanceState(request);
  test.skip(maintenance.enabled === true, 'Full interaction smoke is intentionally skipped while maintenance is enabled.');

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const care = await desktop.newPage();
  const desktopErrors = collectPageErrors(care);
  await care.goto(`${BASE}/directory.html?phase3dCare=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await expectCanonical(care, 'WAFFLE_CARE_CANONICAL');
  await care.waitForTimeout(750);

  const activeCard = care.locator('.directory-card.is-profile-active').first();
  if (await activeCard.count()) {
    const tabs = activeCard.locator('.v11160-desktop-tab');
    await expect(tabs).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
      await tabs.nth(i).click();
    }
  } else {
    await expect(care.locator('body')).toBeVisible();
    console.log('No active Care guest profile in current production data; canonical Care page loaded and profile-tab interaction was skipped.');
  }

  expect(desktopErrors).toEqual([]);
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await mobile.newPage();
  const mobileErrors = collectPageErrors(page);
  await page.goto(`${BASE}/index.html?phase3dMobile=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await expectCanonical(page, 'WAFFLE_CALENDAR_CANONICAL');
  await expect(page.locator('#wh75MenuButton')).toBeVisible();
  await expect(page.locator('#wh75MobileBottomNav')).toBeVisible();
  await page.locator('#wh75MenuButton').click();
  await expect(page.locator('#wh75MobileDrawer')).toHaveClass(/is-open/);
  expect(mobileErrors).toEqual([]);
  await mobile.close();
});
