const { test, expect } = require('@playwright/test');

const PAGES = [
  ['index.html', 'WAFFLE_CALENDAR_CANONICAL', 'Calendar / Today'],
  ['directory.html', 'WAFFLE_CARE_CANONICAL', 'Care'],
  ['reminders.html', 'WAFFLE_ORGANISER_CANONICAL', 'Organiser / Reminders'],
  ['audit.html', 'WAFFLE_LOGS_CANONICAL', 'Logs / Audit']
];

function record(failures, condition, message) {
  if (!condition) failures.push(message);
}

function cleanErrors(errors) {
  return errors.filter(Boolean).slice(0, 12);
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`${error.name || 'Error'}: ${error.message || String(error)}`));
  return errors;
}

async function gotoCanonical(page, path, marker) {
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}uiRegression=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  if (/maintenance\.html/i.test(page.url())) {
    test.skip(true, 'Production is in maintenance mode; placement assertions are intentionally skipped.');
  }
  await page.waitForFunction(name => Boolean(window[name]), marker, { timeout: 20_000 });
  await page.waitForFunction(() => Boolean(window.WAFFLE_UI_CANONICAL), null, { timeout: 20_000 });
  await page.waitForFunction(() => Boolean(window.WAFFLE_AI_CANONICAL), null, { timeout: 20_000 });
  await page.waitForTimeout(500);
}

async function box(locator) {
  if (await locator.count() === 0) return null;
  if (!(await locator.isVisible())) return null;
  return locator.boundingBox();
}

function withinHorizontalViewport(rect, viewport, tolerance = 3) {
  return !!rect && rect.x >= -tolerance && rect.x + rect.width <= viewport.width + tolerance;
}

function withinViewport(rect, viewport, tolerance = 3) {
  return withinHorizontalViewport(rect, viewport, tolerance)
    && rect.y >= -tolerance
    && rect.y + rect.height <= viewport.height + tolerance;
}

async function horizontalOverflow(page) {
  return page.evaluate(() => ({
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
    htmlWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth
  }));
}

test('canonical pages keep the primary UI inside the viewport', async ({ page }, testInfo) => {
  const failures = [];
  const errors = collectPageErrors(page);
  const viewport = page.viewportSize();
  const mobileShell = testInfo.project.metadata.mobileShell === true;

  for (const [path, marker, label] of PAGES) {
    await gotoCanonical(page, path, marker);

    const overflow = await horizontalOverflow(page);
    record(
      failures,
      overflow.html <= 4,
      `${label}: horizontal page overflow is ${overflow.html}px (document width ${overflow.htmlWidth}px vs viewport ${overflow.viewportWidth}px).`
    );

    const container = page.locator('.container').first();
    const containerBox = await box(container);
    record(failures, !!containerBox, `${label}: primary .container is not visible.`);
    if (containerBox) {
      record(
        failures,
        withinHorizontalViewport(containerBox, viewport, 4),
        `${label}: primary container is clipped horizontally (x=${containerBox.x.toFixed(1)}, width=${containerBox.width.toFixed(1)}, viewport=${viewport.width}).`
      );
    }

    const menu = page.locator('#wh75MenuButton');
    const nav = page.locator('#wh75MobileBottomNav');
    const tabs = page.locator('.app-tabs').first();

    if (mobileShell) {
      record(failures, await menu.isVisible(), `${label}: mobile menu button is not visible at ${viewport.width}x${viewport.height}.`);
      record(failures, await nav.isVisible(), `${label}: mobile bottom navigation is not visible at ${viewport.width}x${viewport.height}.`);

      const menuBox = await box(menu);
      const navBox = await box(nav);
      if (menuBox) {
        record(failures, withinViewport(menuBox, viewport), `${label}: mobile menu button extends outside the viewport.`);
      }
      if (navBox) {
        record(failures, withinViewport(navBox, viewport, 4), `${label}: mobile bottom navigation extends outside the viewport.`);
      }
    } else {
      record(failures, !(await menu.isVisible()), `${label}: mobile menu button is incorrectly visible in desktop/tablet-landscape layout.`);
      record(failures, !(await nav.isVisible()), `${label}: mobile bottom navigation is incorrectly visible in desktop/tablet-landscape layout.`);
      record(failures, await tabs.isVisible(), `${label}: desktop application tabs are not visible.`);
      const tabsBox = await box(tabs);
      if (tabsBox) {
        record(failures, withinHorizontalViewport(tabsBox, viewport, 4), `${label}: desktop application tabs are clipped horizontally.`);
      }
    }
  }

  for (const error of cleanErrors(errors)) {
    failures.push(`Uncaught browser error: ${error}`);
  }

  expect(failures, failures.join('\n')).toEqual([]);
});

test('mobile shell navigation, drawer and Add sheet are placed without clipping or overlap', async ({ page }, testInfo) => {
  const mobileShell = testInfo.project.metadata.mobileShell === true;
  test.skip(!mobileShell, 'Mobile-shell placement test only applies at widths <= 820px.');

  const failures = [];
  const errors = collectPageErrors(page);
  const viewport = page.viewportSize();
  await gotoCanonical(page, 'index.html', 'WAFFLE_CALENDAR_CANONICAL');

  const nav = page.locator('#wh75MobileBottomNav');
  const navBox = await box(nav);
  record(failures, !!navBox, 'Bottom navigation is missing or hidden.');
  if (navBox) record(failures, withinViewport(navBox, viewport, 4), 'Bottom navigation is clipped by the viewport.');

  const items = nav.locator('.wh75-bottom-item');
  const itemCount = await items.count();
  record(failures, itemCount === 5, `Bottom navigation should contain 5 items but contains ${itemCount}.`);

  const itemBoxes = [];
  for (let i = 0; i < itemCount; i += 1) {
    const item = items.nth(i);
    const itemBox = await box(item);
    if (!itemBox) {
      failures.push(`Bottom navigation item ${i + 1} is not visible.`);
      continue;
    }
    itemBoxes.push(itemBox);
    if (navBox) {
      record(
        failures,
        itemBox.x >= navBox.x - 2 && itemBox.x + itemBox.width <= navBox.x + navBox.width + 2,
        `Bottom navigation item ${i + 1} extends outside its navigation container.`
      );
    }
  }
  for (let i = 1; i < itemBoxes.length; i += 1) {
    const previous = itemBoxes[i - 1];
    const current = itemBoxes[i];
    record(
      failures,
      current.x >= previous.x + previous.width - 2,
      `Bottom navigation items ${i} and ${i + 1} overlap horizontally.`
    );
  }

  const menu = page.locator('#wh75MenuButton');
  await menu.click();
  const drawer = page.locator('#wh75MobileDrawer');
  await expect(drawer).toHaveClass(/is-open/);
  await page.waitForTimeout(300);
  const drawerBox = await box(drawer);
  record(failures, !!drawerBox, 'Mobile drawer did not become visible after tapping the menu button.');
  if (drawerBox) {
    record(failures, withinViewport(drawerBox, viewport, 4), 'Open mobile drawer extends outside the viewport.');
  }

  const closeDrawer = drawer.locator('.wh75-drawer-close');
  if (await closeDrawer.count()) await closeDrawer.click();

  const addButton = nav.locator('[data-wh78-quick-add], [data-wh75-quick-add]').first();
  record(failures, await addButton.count() > 0, 'Add button is missing from the mobile bottom navigation.');
  if (await addButton.count()) {
    await addButton.click();
    await page.waitForTimeout(200);
    const sheet = page.locator('#v10QuickAddSheet');
    record(failures, await sheet.isVisible(), 'Quick Add sheet did not become visible after tapping Add.');
    const sheetBox = await box(sheet);
    if (sheetBox) {
      record(failures, withinHorizontalViewport(sheetBox, viewport, 4), 'Quick Add sheet is clipped horizontally.');
    }
  }

  for (const error of cleanErrors(errors)) failures.push(`Uncaught browser error: ${error}`);
  expect(failures, failures.join('\n')).toEqual([]);
});

test('New Boarding action can always be scrolled fully above fixed mobile navigation', async ({ page }, testInfo) => {
  const mobileShell = testInfo.project.metadata.mobileShell === true;
  test.skip(!mobileShell, 'New Boarding mobile scroll-clearance test only applies at widths <= 820px.');

  const failures = [];
  const errors = collectPageErrors(page);
  const viewport = page.viewportSize();
  await gotoCanonical(page, 'index.html?action=boarding', 'WAFFLE_CALENDAR_CANONICAL');

  const modal = page.locator('#v108BoardingModal');
  await expect(modal).toBeVisible({ timeout: 12_000 });
  const modalBox = await box(modal);
  record(failures, !!modalBox, 'New Boarding modal is not visible.');
  if (modalBox) {
    record(failures, withinHorizontalViewport(modalBox, viewport, 4), 'New Boarding modal extends outside the viewport horizontally.');
  }

  const panel = modal.locator(':scope > .v108-modal-card');
  const panelBox = await box(panel);
  record(failures, !!panelBox, 'New Boarding modal card is not visible.');
  if (panelBox) {
    record(failures, withinHorizontalViewport(panelBox, viewport, 4), 'New Boarding modal card is clipped horizontally.');
  }

  const spacer = panel.locator(':scope > [data-quick-add-scroll-spacer]');
  record(failures, await spacer.count() === 1, 'New Boarding modal does not contain the required post-action scroll spacer.');
  if (await spacer.count()) {
    const spacerHeight = await spacer.evaluate(el => el.getBoundingClientRect().height);
    record(failures, spacerHeight >= 180, `New Boarding scroll spacer is ${spacerHeight}px; expected at least 180px.`);
  }

  const scrollMetrics = await modal.evaluate(el => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
  record(
    failures,
    scrollMetrics.scrollHeight > scrollMetrics.clientHeight,
    `New Boarding modal has no vertical scroll range (scrollHeight=${scrollMetrics.scrollHeight}, clientHeight=${scrollMetrics.clientHeight}).`
  );

  await modal.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(150);

  const submit = modal.locator('[data-v108-save-board]');
  record(failures, await submit.isVisible(), 'Create Booking button is not visible after scrolling to the bottom.');
  const submitBox = await box(submit);
  const navBox = await box(page.locator('#wh75MobileBottomNav'));

  if (submitBox) {
    record(failures, withinHorizontalViewport(submitBox, viewport, 4), 'Create Booking button is clipped horizontally.');
    record(failures, submitBox.y >= -2, 'Create Booking button is scrolled above the visible viewport.');
    record(failures, submitBox.y + submitBox.height <= viewport.height + 2, 'Create Booking button remains below the visible viewport after maximum scroll.');
  }
  if (submitBox && navBox) {
    record(
      failures,
      submitBox.y + submitBox.height <= navBox.y - 2,
      `Create Booking button overlaps fixed bottom navigation (button bottom=${(submitBox.y + submitBox.height).toFixed(1)}, nav top=${navBox.y.toFixed(1)}).`
    );
  }

  for (const error of cleanErrors(errors)) failures.push(`Uncaught browser error: ${error}`);
  expect(failures, failures.join('\n')).toEqual([]);
});
