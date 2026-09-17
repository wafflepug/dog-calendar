const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { csv } = require('./fixtures/mobile-baseline-data');
const { resolveLocalBackendAction } = require('../scripts/local-network-policy');

const PAGES = [
  { name: 'today', path: 'index.html', ready: 'calendar' },
  { name: 'calendar', path: 'index.html?view=calendar', ready: 'calendar' }
];
const FIXED_NOW = '2026-09-17T12:00:00.000Z';
const FULLCALENDAR_BUNDLE = fs.readFileSync(path.join(__dirname, 'fixtures', 'fullcalendar.global.min.js'), 'utf8');

const INSTRUMENTATION = ({ countersEnabled }) => ({ countersEnabled, fixedNow: FIXED_NOW });

function instrumentationScript() {
  return ({ countersEnabled = !location.search.includes('calibration'), fixedNow = '2026-09-17T12:00:00.000Z' } = {}) => {
    const OriginalDate = Date;
    const fixedMs = OriginalDate.parse(fixedNow);
    const dateOrigin = performance.now();
    class FixedDate extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [fixedMs + Math.floor(performance.now() - dateOrigin)])); }
      static now() { return fixedMs + Math.floor(performance.now() - dateOrigin); }
    }
    window.Date = FixedDate;
    const state = window.__mobilePerf = {
      countersEnabled, mutationRecords: 0, mutationCallbacks: 0, mutationCallbackDuration: 0,
      rafCallbacks: 0, rafCallbackDuration: 0, longTasks: [], errors: [],
      navStart: performance.now(), readyAt: null, hydrationAt: null, scroll: null
    };
    const NativeMO = window.MutationObserver;
    if (NativeMO) {
      window.MutationObserver = class extends NativeMO {
        constructor(callback) {
          super(function wrappedMutations(records, observer) {
            if (!state.countersEnabled) return callback.apply(this, arguments);
            const started = performance.now(); state.mutationRecords += records.length; state.mutationCallbacks++;
            try { return callback.apply(this, arguments); } finally { state.mutationCallbackDuration += performance.now() - started; }
          });
        }
      };
    }
    const nativeRaf = window.requestAnimationFrame;
    if (nativeRaf) window.requestAnimationFrame = function wrappedRaf(callback) {
      if (!state.countersEnabled) return nativeRaf.apply(this, arguments);
      return nativeRaf.call(this, function wrappedFrame(timestamp) {
        const started = performance.now(); state.rafCallbacks++;
        try { return callback.call(this, timestamp); } finally { state.rafCallbackDuration += performance.now() - started; }
      });
    };
    try {
      if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) { state.longTasksUnsupported = true; throw new Error('unsupported'); }
      const observer = new PerformanceObserver(list => { state.longTasks.push(...list.getEntries().map(e => e.duration)); });
      observer.observe({ type: 'longtask', buffered: true });
    } catch (_) { state.longTasksUnsupported = true; }
    window.addEventListener('error', event => state.errors.push(String(event.error?.message || event.message || 'error')));
  };
}

function percentile(values, p) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(p * ordered.length) - 1)];
}
function median(values) { return percentile(values, 0.5); }

async function installFixtures(page, writeGuard) {
  await page.route('**/*', async route => {
    const request = route.request();
    const url = request.url();
    if (/cdn\.jsdelivr\.net\/npm\/fullcalendar@6\.1\.8\/index\.global\.min\.js/i.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: FULLCALENDAR_BUNDLE });
    }
    if (/cdn\.jsdelivr\.net\/npm\/fullcalendar@6\.1\.8\/index\.global\.min\.css/i.test(url)) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    if (/docs\.google\.com\/spreadsheets/i.test(url) && /output=csv/i.test(url)) {
      writeGuard.csvRequests = (writeGuard.csvRequests || 0) + 1;
      return route.fulfill({ status: 200, contentType: 'text/csv', body: csv });
    }
    if (/script\.google(?:usercontent)?\.com/i.test(url)) {
      if (!['GET', 'HEAD'].includes(request.method())) {
        writeGuard.push({ url, method: request.method() });
        return route.fulfill({ status: 405, contentType: 'text/plain', body: 'Performance baseline write guard' });
      }
      const parsed = new URL(url);
      const callback = parsed.searchParams.get('callback');
      let payload = {};
      try { payload = JSON.parse(parsed.searchParams.get('payload') || '{}'); } catch (_) {}
      const policy = resolveLocalBackendAction({ method: request.method(), url });
      if (!policy.policy.allowed) {
        writeGuard.push({ url, method: request.method(), action: payload.action });
        return route.fulfill({ status: 405, contentType: 'text/plain', body: 'Performance baseline write guard' });
      }
      if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
        const response = payload.action === 'get_notification_centre'
          ? { result: 'success', notifications: [] }
          : payload.action === 'get_guest_directory'
            ? { result: 'success', guests: [] }
            : payload.action === 'get_data_versions'
              ? { result: 'success', versions: { bookings: 'baseline-2026-09-17', belongings: 'baseline-2026-09-17' } }
            : { result: 'success', bookings: [] };
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: `${callback}(${JSON.stringify(response)});` });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: 'success', bookings: [] }) });
    }
    if (/\.(?:png|jpe?g|webp|svg)(?:\?|$)/i.test(url) && !/^https?:\/\/127\.0\.0\.1/i.test(url)) {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#ddd"/></svg>' });
    }
    return route.continue();
  });
}

async function runPage(page, pageCase, countersEnabled, writeGuard) {
  const started = Date.now();
  const separator = pageCase.path.includes('?') ? '&' : '?';
  await page.goto(`${pageCase.path}${separator}mobileBaseline=${countersEnabled ? 'measured' : 'calibration'}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(expected => document.body?.dataset.wafflePage === expected && document.documentElement.dataset.waffleUiReady === 'true', pageCase.ready);
  const readyAt = await page.evaluate(() => { window.__mobilePerf.readyAt = performance.now(); return window.__mobilePerf.readyAt; });
  await page.waitForTimeout(6000);
  const hydrationAt = await page.evaluate(() => { window.__mobilePerf.hydrationAt = performance.now(); window.__mobilePerf.hydrationSnapshot = { mutationRecords: window.__mobilePerf.mutationRecords, rafCallbacks: window.__mobilePerf.rafCallbacks, longTasks: window.__mobilePerf.longTasks.length }; return window.__mobilePerf.hydrationAt; });
  const scrollStarted = await page.evaluate(() => ({ started: performance.now(), before: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
  const scrollSamples = await page.evaluate(async () => {
    const samples = [];
    const target = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    for (let i = 0; i < 30; i++) { window.scrollTo(0, target * ((i + 1) / 30)); await new Promise(resolve => requestAnimationFrame(resolve)); samples.push(scrollY); }
    for (let i = 0; i < 30; i++) { window.scrollTo(0, target * (1 - ((i + 1) / 30))); await new Promise(resolve => requestAnimationFrame(resolve)); samples.push(scrollY); }
    return samples;
  });
  const result = await page.evaluate(({ started, before, max, samples }) => {
    const entries = performance.getEntriesByType('paint');
    const perf = window.__mobilePerf;
    perf.scroll = { distance: Math.max(0, max), started, duration: performance.now() - started, before, achieved: scrollY, maxAfter: document.documentElement.scrollHeight - innerHeight, samples, positionsChanged: Math.max(...samples) > Math.min(...samples) };
    perf.windows = { hydration: perf.hydrationSnapshot, postHydration: { mutationRecords: perf.mutationRecords - perf.hydrationSnapshot.mutationRecords, rafCallbacks: perf.rafCallbacks - perf.hydrationSnapshot.rafCallbacks, longTasks: perf.longTasks.length - perf.hydrationSnapshot.longTasks } };
    perf.paint = Object.fromEntries(entries.map(entry => [entry.name, entry.startTime]));
    perf.layout = { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
    perf.total = performance.now();
    return perf;
  }, { ...scrollStarted, samples: scrollSamples });
  if (!result || !result.readyAt || result.errors.length || writeGuard.filter(entry => entry?.method).length) throw new Error(`Instrumentation/guard failure: ${JSON.stringify({ errors: result?.errors, writes: writeGuard })}`);
  if ((writeGuard.csvRequests || 0) < 1) throw new Error('CSV fixture was not requested');
  if (!result.scroll.positionsChanged || result.scroll.maxAfter <= 0) throw new Error(`Scroll measurement unavailable: ${JSON.stringify(result.scroll)}`);
  const viewEvidence = await page.evaluate(expected => ({ view: document.body.dataset.wh75MobileView || '', text: document.body.innerText, height: document.documentElement.scrollHeight, y: scrollY }), pageCase.name === 'calendar' ? 'calendar' : 'today');
  if (viewEvidence.view !== (pageCase.name === 'calendar' ? 'calendar' : 'today') || !/Dog,? Current|Dog Upcoming|Meet Dog/.test(viewEvidence.text)) throw new Error(`View/fixture evidence missing: ${JSON.stringify({ view: viewEvidence.view, csvRequests: writeGuard.csvRequests })}`);
  return { page: pageCase.name, measured: countersEnabled, started, readyMs: readyAt, hydrationMs: hydrationAt - readyAt, totalMs: result.total, scroll: result.scroll, windows: result.windows, mutationRecords: result.mutationRecords, mutationCallbacks: result.mutationCallbacks, mutationCallbackDurationMs: result.mutationCallbackDuration, rafCallbacks: result.rafCallbacks, rafCallbackDurationMs: result.rafCallbackDuration, longTasks: result.longTasksUnsupported ? null : result.longTasks, paint: result.paint || {}, layout: result.layout, writes: writeGuard.filter(entry => entry?.method).length };
}

function writeLocalGroupEvidence(localRuns, testInfo) {
  const measured = localRuns.filter(run => run.kind === 'measured');
  const calibrations = localRuns.filter(run => run.kind === 'calibration');
  if (measured.length !== 5 || calibrations.length !== 1) throw new Error(`Expected 5 measured and 1 calibration run for this page/project; got ${measured.length}/${calibrations.length}`);
  const group = { page: localRuns[0].page, project: localRuns[0].project, repetitions: measured.length, readyMs: { median: median(measured.map(r => r.readyMs)), p95: percentile(measured.map(r => r.readyMs), .95) }, hydrationMs: { median: median(measured.map(r => r.hydrationMs)), p95: percentile(measured.map(r => r.hydrationMs), .95) }, totalMs: { median: median(measured.map(r => r.totalMs)), p95: percentile(measured.map(r => r.totalMs), .95) }, mutationRecords: { median: median(measured.map(r => r.mutationRecords)), p95: percentile(measured.map(r => r.mutationRecords), .95) }, rafCallbacks: { median: median(measured.map(r => r.rafCallbacks)), p95: percentile(measured.map(r => r.rafCallbacks), .95) } };
  const summary = { schema: 'mobile-performance-baseline/v1', generatedAt: new Date().toISOString(), fixedApplicationDate: FIXED_NOW, measuredRuns: measured.length, calibrationRuns: calibrations.length, calibrationPurpose: 'matched counters-disabled harness runs; overhead is reported and never subtracted', unsupportedMetrics: ['longtask is unavailable in WebKit when absent', 'layout-shift is not collected'], groups: [group], calibrations: calibrations.map(run => ({ page: run.page, project: run.project, readyMs: run.readyMs, hydrationMs: run.hydrationMs, totalMs: run.totalMs, mutationRecords: run.mutationRecords, rafCallbacks: run.rafCallbacks })) };
  const out = path.resolve('evidence'); fs.mkdirSync(out, { recursive: true });
  const suffix = `${testInfo.project.name}-${localRuns[0].page}`.replace(/[^a-z0-9]+/gi, '-');
  fs.writeFileSync(path.join(out, `mobile-performance-raw-${suffix}.json`), JSON.stringify({ schema: 'mobile-performance-baseline/v1', fixture: 'tests/fixtures/mobile-baseline-data.js', runs: localRuns }, null, 2));
  fs.writeFileSync(path.join(out, `mobile-performance-summary-${suffix}.json`), JSON.stringify(summary, null, 2));
}

test.describe('actual-app mobile performance baseline', () => {
  for (const pageCase of PAGES) {
    test(`${pageCase.name}: five measured runs plus matched calibration`, { timeout: 300_000 }, async ({ browser }, testInfo) => {
      const writeGuard = [];
      const localRuns = [];
      const contextOptions = { ...testInfo.project.use };
      const calibrationContext = await browser.newContext(contextOptions);
      const calibrationPage = await calibrationContext.newPage();
      await installFixtures(calibrationPage, writeGuard);
      await calibrationPage.addInitScript(instrumentationScript());
      const calibration = await runPage(calibrationPage, pageCase, false, writeGuard);
      await calibrationContext.close();
      const calibrationRun = { project: testInfo.project.name, browser: testInfo.project.use.browserName, ...calibration, kind: 'calibration' };
      localRuns.push(calibrationRun);
      for (let repetition = 1; repetition <= 5; repetition++) {
        const coldContext = await browser.newContext(contextOptions);
        const coldPage = await coldContext.newPage();
        const coldGuard = [];
        await installFixtures(coldPage, coldGuard);
        await coldPage.addInitScript(instrumentationScript());
        const measured = await runPage(coldPage, pageCase, true, coldGuard);
        await coldContext.close();
        const measuredRun = { project: testInfo.project.name, browser: testInfo.project.use.browserName, repetition, ...measured, kind: 'measured' };
        localRuns.push(measuredRun);
      }
      expect(writeGuard.filter(entry => entry?.method)).toEqual([]);
      expect(writeGuard.csvRequests || 0).toBeGreaterThan(0);
      writeLocalGroupEvidence(localRuns, testInfo);
    });
  }
});
