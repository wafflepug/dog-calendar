const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const appCss = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.css'), 'utf8');
const runtimeCss = fs.readFileSync(path.join(__dirname, '..', 'waffle-runtime.css'), 'utf8').replace(/@import url\("([^"?]+)[^" ]*"\);/g, (_, file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
const start = app.indexOf('function ensureDirectorySearchStatus()');
const end = app.indexOf('function intakeAttributeControlHtml(', start);
if (start < 0 || end < 0) throw new Error('Could not locate the Care roster empty-state and search functions.');
const rosterRuntime = app.slice(start, end);

async function mount(page, { current = 0, arriving = 0, past = 0, rosterState = 'success', pastState = 'success', dark = false } = {}) {
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0;padding:12px;font:16px Arial,sans-serif}.directory-dashboard-fused{max-width:900px;margin:auto}
    .directory-roster-heading{display:flex;justify-content:space-between;gap:12px;align-items:center}.guest-directory-toolbar{min-width:0}
    #guestDirectorySearch{max-width:100%;min-height:44px}.directory-roster-filters{display:flex;gap:8px}.directory-roster-filters button{min-height:44px;flex:1}
    .v1082-stay-panels section[hidden]{display:none}.directory-card[hidden]{display:none}
    ${appCss}
    ${runtimeCss}
  </style></head><body class="${dark ? 'dark-theme' : ''}"><button type="button" id="manualRefreshBtn">Refresh</button><button type="button" id="v10QuickAddButton" aria-label="Add booking, Potential Stay, Meet & Greet or Reminder"></button><main class="directory-dashboard-fused" data-directory-roster-load-state="${rosterState}">
    <header class="directory-roster-heading"><h1>Guests</h1><div class="guest-directory-toolbar"><input id="guestDirectorySearch" type="search" aria-label="Find dog, owner or Dog ID"></div></header>
    <nav class="directory-roster-filters" role="tablist" aria-label="Filter guests by stay status">
      <button type="button" role="tab" aria-selected="true" class="is-active" data-v1082-stay-tab="current">Staying <strong id="v1082CurrentStayCount">${current}</strong></button>
      <button type="button" role="tab" aria-selected="false" data-v1082-stay-tab="future">Arriving <strong id="v1082FutureStayCount">${arriving}</strong></button>
      <button type="button" role="tab" aria-selected="false" data-v1082-stay-tab="past">Past <strong id="v1082PastStayCount">${past}</strong></button>
    </nav>
    <div id="directory-empty-state" class="directory-empty-state" role="status" aria-live="polite" hidden>
      <strong data-directory-empty-title></strong><p data-directory-empty-copy></p><button type="button" data-directory-empty-action></button>
    </div>
    <div class="v1082-stay-panels">
      <section id="v1082CurrentStayPanel" data-v1082-stay-panel="current" class="is-active"><div id="directory-grid">
        <div class="no-dogs">Old empty placeholder</div>
        ${current ? '<article class="directory-card" data-directory-dog-name="Maple" data-directory-start-date="2026-10-18"><button>Maple</button></article>' : ''}

        <button type="button" data-v11196-expand-later data-v11196-action="expand" aria-expanded="false" ${arriving ? '' : 'hidden'}>View 2 later arrivals · First arrives 18 Nov</button>
      </div></section>
      <section id="v1082FutureStayPanel" data-v1082-stay-panel="future" hidden>        ${arriving ? '<article class="directory-card" data-directory-dog-name="Ravioli" data-directory-start-date="2026-10-29" data-v1082-stay-kind="future"><button>Ravioli</button></article>' : ''}</section>
      <section id="v1082PastStayPanel" data-v1082-stay-panel="past" hidden><div id="past-directory-grid">
        ${pastState === 'loading' ? '<div class="v101-skeleton-list" aria-label="Loading past stays"></div>' : ''}
        ${pastState === 'failure' ? '<div class="v1082-past-empty is-error">Past stays could not be loaded</div>' : ''}
        ${past ? '<article class="directory-card" data-v1082-past-stay="true" data-directory-dog-name="Juniper"><button>Juniper</button></article>' : ''}
      </div></section>
    </div>
  </main></body></html>`);
  await page.evaluate(runtime => {
    window.getLocalTodayDateString = () => '2026-10-17';
    window.eval(runtime);
    document.getElementById('guestDirectorySearch').addEventListener('input', filterGuestDirectoryCards);
    document.querySelectorAll('[data-v1082-stay-tab]').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('[data-v1082-stay-tab]').forEach(item => {
        const active = item === tab;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('[data-v1082-stay-panel]').forEach(panel => { panel.hidden = panel.dataset.v1082StayPanel !== tab.dataset.v1082StayTab; });
      filterGuestDirectoryCards();
    }));
    filterGuestDirectoryCards();
  }, rosterRuntime);
}

test('empty Staying offers a keyboard accessible Arriving action only after loaded success', async ({ page }) => {
  await mount(page, { arriving: 1 });
  const prompt = page.locator('#directory-empty-state');
  await expect(prompt).toBeVisible();
  await expect(page.locator('#directory-grid .no-dogs')).toBeHidden();
  await expect(prompt.locator('p')).toHaveText('Guests with upcoming stays are listed under Arriving.');
  const action = prompt.locator('button');
  await action.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-v1082-stay-tab="future"]')).toHaveAttribute('aria-selected', 'true');
  await expect(prompt).toBeHidden();
});

test('only Past records are preserved as Past and can be opened explicitly from empty Staying', async ({ page }) => {
  await mount(page, { past: 1 });
  const prompt = page.locator('#directory-empty-state');
  await expect(prompt).toBeVisible();
  await expect(prompt.locator('p')).toContainText('completed visits under Past');
  await expect(prompt.locator('button')).toHaveText('View Past');
  await expect(prompt.locator('button')).not.toHaveText('View Arriving');
  await prompt.locator('button').click();
  await expect(page.locator('[data-v1082-stay-tab="past"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#past-directory-grid .directory-card:visible button')).toHaveText('Juniper');
  await expect(page.locator('#directory-grid .directory-card:visible')).toHaveCount(0);
});

test('loading, unknown and failure states never become empty states, including Past', async ({ page }) => {
  for (const rosterState of ['unknown', 'loading', 'cached', 'failure']) {
    await mount(page, { rosterState });
    await expect(page.locator('#directory-empty-state')).toBeHidden();
  }
  await mount(page, { pastState: 'loading' });
  await page.locator('[data-v1082-stay-tab="past"]').click();
  await expect(page.locator('#directory-empty-state')).toBeHidden();
  await mount(page, { pastState: 'failure' });
  await page.locator('[data-v1082-stay-tab="past"]').click();
  await expect(page.locator('#directory-empty-state')).toBeHidden();
  await mount(page, { rosterState: 'cached-failure' });
  await expect(page.locator('#directory-empty-state')).toBeVisible();
  await expect(page.locator('#directory-empty-state')).toContainText('saved roster');
  await expect(page.locator('#directory-empty-state')).toContainText('last refresh failed');
  await expect(page.locator('#directory-empty-state button')).toHaveText('Refresh guest list');
  await page.locator('#manualRefreshBtn').evaluate(button => button.addEventListener('click', () => { window.refreshed = true; }));
  await page.locator('#directory-empty-state button').click();
  expect(await page.evaluate(() => window.refreshed)).toBe(true);
  await mount(page, { rosterState: 'cached-offline' });
  await expect(page.locator('#directory-empty-state')).toContainText('You are offline');
  await expect(page.locator('#directory-empty-state')).not.toContainText('last refresh failed');
});

test('a genuinely empty roster offers the existing Quick Add action', async ({ page }) => {
  await mount(page);
  await expect(page.locator('#directory-empty-state')).toBeVisible();
  await expect(page.locator('#directory-empty-state')).toContainText('There are no stays in this category yet.');
  let opened = false;
  await page.locator('#v10QuickAddButton').evaluate(button => button.addEventListener('click', () => { window.quickAddOpened = true; }));
  await page.locator('#directory-empty-state button').click();
  opened = await page.evaluate(() => window.quickAddOpened === true);
  expect(opened).toBe(true);
});

test('search clear retains the active category, restores focus, and deferred arrivals stay explicitly bounded', async ({ page }) => {
  await mount(page, { arriving: 1 });
  await page.locator('[data-v1082-stay-tab="future"]').click();
  await page.evaluate(() => {
    window.WAFFLE_V11196_FUTURE_RANGE = { isExpanded: () => false, deferredCount: () => 2 };
  });
  await page.locator('#guestDirectorySearch').fill('no such dog');
  await expect(page.locator('#directory-search-status')).toContainText('Later arrivals are not included until opened.');
  await expect(page.locator('#directory-empty-state')).toBeVisible();
  await expect(page.locator('#directory-empty-state [data-directory-empty-action]')).toHaveText('Clear search');
  await expect(page.locator('#directory-search-status')).toBeHidden();
  await page.locator('[data-directory-search-clear]').click();
  await expect(page.locator('#guestDirectorySearch')).toBeFocused();
  await expect(page.locator('[data-v1082-stay-tab="future"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#directory-empty-state')).toBeHidden();
});

test('empty-state content stays readable in light and dark themes at mobile and desktop widths', async ({ page }) => {
  await mount(page, { arriving: 1 });
  for (const dark of [false, true]) {
    if (dark) await page.locator('body').evaluate(node => node.classList.add('dark-theme'));
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 820 });
      const dimensions = await page.locator('#directory-empty-state').evaluate(node => ({
        right: node.getBoundingClientRect().right,
        actionWidth: node.querySelector('button').getBoundingClientRect().width,
        scrollWidth: document.documentElement.scrollWidth,
        background: getComputedStyle(node).backgroundColor,
        text: getComputedStyle(node).color,
        copy: getComputedStyle(node.querySelector('p')).color
      }));
      expect(dimensions.right).toBeLessThanOrEqual(width + 1);
      expect(dimensions.actionWidth).toBeGreaterThanOrEqual(44);
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(width);
      expect(dimensions.background).not.toBe(dimensions.text);
      expect(dimensions.copy).not.toBe(dimensions.background);
      if (width === 320 && dark) {
        const dir = path.resolve(__dirname, '..', 'output', 'care-status-visuals');
        await fs.promises.mkdir(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, 'empty-staying-320-dark.png'), fullPage: true });
      }
      if (width === 1440 && !dark) {
        const dir = path.resolve(__dirname, '..', 'output', 'care-status-visuals');
        await fs.promises.mkdir(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, 'empty-staying-1440-light.png'), fullPage: true });
      }
    }
  }
});

test('unchanged empty roster keeps its prompt and focused action without DOM mutations', async ({ page }) => {
  await mount(page, { arriving: 1 });
  const action = page.locator('#directory-empty-state button');
  await action.focus();
  const result = await page.evaluate(() => {
    const prompt = document.getElementById('directory-empty-state');
    const button = prompt.querySelector('button');
    const observer = new MutationObserver(() => {});
    observer.observe(prompt, { subtree: true, attributes: true, childList: true, characterData: true });
    observer.observe(document.querySelector('.directory-dashboard-fused'), { attributes: true, attributeFilter: ['data-contextual-empty-visible'] });
    updateDirectoryEmptyState(); updateDirectoryEmptyState();
    const result = { mutations: observer.takeRecords().length, retained: prompt.querySelector('button') === button, focused: document.activeElement === button };
    observer.disconnect(); return result;
  });
  expect(result).toEqual({ mutations: 0, retained: true, focused: true });
});
