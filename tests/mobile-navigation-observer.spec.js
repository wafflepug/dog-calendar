const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const FIXTURE = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body data-waffle-page="calendar" data-wh75-mobile-view="today"><main><div id="calendar"></div></main></body></html>`;

function navigationInstrumentation() {
  const state = window.__navigationObserverMeasurement = {
    active: false, observerCallbacks: 0, observerCallbackDurationMs: 0,
    maintainCalls: 0, maintainDurationMs: 0
  };
  const NativeMutationObserver = window.MutationObserver;
  window.MutationObserver = class extends NativeMutationObserver {
    constructor(callback) {
      super(function measuredObserverCallback(records, observer) {
        if (!state.active) return callback.apply(this, arguments);
        const started = performance.now();
        state.observerCallbacks++;
        try { return callback.apply(this, arguments); }
        finally { state.observerCallbackDurationMs += performance.now() - started; }
      });
    }
  };
  const nativeRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = function measuredRaf(callback) {
    if (callback?.name !== 'maintain') return nativeRaf.apply(this, arguments);
    return nativeRaf.call(this, timestamp => {
      if (!state.active) return callback.call(this, timestamp);
      const started = performance.now();
      state.maintainCalls++;
      try { return callback.call(this, timestamp); }
      finally { state.maintainDurationMs += performance.now() - started; }
    });
  };
}

async function flushFrames(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function snapshot(page) {
  return page.evaluate(() => ({
    observerCallbacks: window.__navigationObserverMeasurement.observerCallbacks,
    observerCallbackDurationMs: window.__navigationObserverMeasurement.observerCallbackDurationMs,
    maintainCalls: window.__navigationObserverMeasurement.maintainCalls,
    maintainDurationMs: window.__navigationObserverMeasurement.maintainDurationMs
  }));
}

async function runWorkload(browser, name, source) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.setContent(FIXTURE);
  await page.evaluate(navigationInstrumentation);
  await page.addScriptTag({ content: source });
  // Let navigation's normal startup and bounded startup schedules settle first.
  await page.waitForTimeout(3400);
  await page.evaluate(() => {
    const measurement = window.__navigationObserverMeasurement;
    measurement.active = true;
    measurement.observerCallbacks = 0;
    measurement.observerCallbackDurationMs = 0;
    measurement.maintainCalls = 0;
    measurement.maintainDurationMs = 0;
  });

  for (let batch = 0; batch < 12; batch++) {
    await page.evaluate(batchNumber => {
      const fragment = document.createDocumentFragment();
      for (let cell = 0; cell < 40; cell++) {
        const day = document.createElement('div');
        day.className = 'fc-daygrid-day';
        day.dataset.syntheticCalendarBatch = String(batchNumber);
        const cellBody = document.createElement('div');
        cellBody.className = 'fc-daygrid-day-frame';
        day.appendChild(cellBody);
        fragment.appendChild(day);
      }
      document.getElementById('calendar').appendChild(fragment);
    }, batch);
    await flushFrames(page);
  }
  const irrelevantCalendarMutations = await snapshot(page);

  await page.evaluate(() => {
    const header = document.createElement('header');
    header.className = 'calendar-header-branding';
    document.body.appendChild(header);
  });
  await flushFrames(page);
  const headerBrandHydrated = await page.locator('#whPalzStayMobileShellBrand').count() === 1;
  await page.evaluate(() => {
    const heading = document.createElement('div');
    heading.className = 'v10-ops-heading';
    document.body.appendChild(heading);
  });
  await flushFrames(page);
  const homeBrandHydrated = await page.locator('#whPalzStayMobileBrand').count() === 1;
  await page.evaluate(() => {
    const drawer = document.createElement('aside');
    drawer.id = 'wh75MobileDrawer';
    drawer.innerHTML = '<section class="wh75-nav-section"><div class="wh75-nav-heading">Account</div></section>';
    document.body.appendChild(drawer);
  });
  await flushFrames(page);
  const drawerToolsHydrated = await page.locator('#whSitterMobileHeaderTools [data-wh-sitter-mobile-action="search"]').count() === 1;
  await page.evaluate(() => {
    const panel = document.createElement('section');
    panel.id = 'wh75SettingsPanel';
    panel.innerHTML = '<div><h2 id="wh75SettingsTitle">Settings</h2><p>Settings introduction</p></div>';
    document.body.appendChild(panel);
  });
  await flushFrames(page);
  const settingsToolsHydrated = await page.locator('#whSitterToolsSettingsSection [data-wh-sitter-tools-settings]').count() === 1;
  await page.evaluate(() => {
    const wrapper = document.createElement('div');
    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.textContent = 'Open Sitter Tools';
    wrapper.appendChild(launcher);
    document.body.appendChild(wrapper);
  });
  await flushFrames(page);
  const lateLauncherSuppressed = await page.locator('button.wh-sitter-tools-relocated[hidden][aria-hidden="true"]').count() === 1;

  // Removing and replacing a relevant header must hydrate its replacement too.
  await page.evaluate(() => {
    document.querySelector('.calendar-header-branding')?.remove();
    const replacement = document.createElement('header');
    replacement.className = 'calendar-header-branding';
    document.body.appendChild(replacement);
  });
  await flushFrames(page);
  const replacementHeaderHydrated = await page.locator('.calendar-header-branding #whPalzStayMobileShellBrand').count() === 1;
  const relevantControls = await snapshot(page);
  await page.close();

  return {
    name,
    workload: { calendarBatches: 12, cellsPerBatch: 40, relevantLateControls: 6, replacements: 1 },
    irrelevantCalendarMutations,
    afterRelevantControls: relevantControls,
    hydration: { headerBrandHydrated, homeBrandHydrated, drawerToolsHydrated, settingsToolsHydrated, lateLauncherSuppressed, replacementHeaderHydrated }
  };
}

test('navigation observer ignores unrelated Calendar churn and hydrates late controls', async ({ browser }, testInfo) => {
  const baselineSource = fs.readFileSync(path.join(__dirname, 'fixtures', 'mobile-navigation-observer-baseline.js'), 'utf8');
  const candidateSource = fs.readFileSync(path.resolve(__dirname, '..', 'waffle-sitter-navigation.js'), 'utf8');
  const baseline = await runWorkload(browser, 'saved-HEAD', baselineSource);
  const candidate = await runWorkload(browser, 'working-tree', candidateSource);

  expect(baseline.irrelevantCalendarMutations.observerCallbacks).toBe(12);
  expect(baseline.irrelevantCalendarMutations.maintainCalls).toBe(12);
  expect(candidate.irrelevantCalendarMutations.observerCallbacks).toBe(12);
  expect(candidate.irrelevantCalendarMutations.maintainCalls).toBe(0);
  for (const run of [baseline, candidate]) for (const [control, hydrated] of Object.entries(run.hydration)) {
    expect(hydrated, `${run.name} did not hydrate ${control}`).toBe(true);
  }

  const evidenceDir = path.resolve('test-results/mvp-mobile-observer');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const engine = testInfo.project.name.replace(/[^a-z0-9-]/gi, '-');
  fs.writeFileSync(path.join(evidenceDir, `mutation-workload-comparison-${engine}.json`), JSON.stringify({
    schema: 'mobile-navigation-observer-workload/v1',
    fixture: 'minimal mobile DOM; 12 childList batches × 40 FullCalendar-like day cells, then late/replaced navigation controls',
    baselineRevision: '35f0b79e9e7dcb989f6689a8532a02cdcf9faa69 (saved original navigation source)',
    browserProject: testInfo.project.name,
    testRun: testInfo.title,
    instrumentation: 'MutationObserver callback and requestAnimationFrame(maintain) wrappers; timings are diagnostic in this emulated browser only.',
    baseline,
    candidate
  }, null, 2));
});
