const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const coordinatorSource = fs.readFileSync('care-startup-priority.js', 'utf8');
const aiSource = fs.readFileSync('waffle-ai.js', 'utf8');

function setup(page = 'directory') {
  const idle = [];
  const window = {
    WAFFLE_PAGE: undefined,
    setTimeout(callback) { callback(); return 1; },
    requestIdleCallback(callback) { idle.push(callback); },
    console: { warn() {} },
  };
  const document = { body: { dataset: { wafflePage: page } } };
  vm.runInNewContext(coordinatorSource, { window, document, Promise, String });
  return {
    startup: window.WAFFLE_CARE_STARTUP,
    flushIdle() { while (idle.length) idle.shift()(); },
  };
}

function makeHealth({ online = true, cache = null, jsonp } = {}) {
  const start = aiSource.indexOf('  async function getHealth(force = false) {');
  const end = aiSource.indexOf('\n  function footerText()', start);
  assert(start >= 0 && end > start);
  const healthFn = aiSource.slice(start, end);
  const context = {
    navigator: { onLine: online },
    healthCache: cache,
    healthFetchedAt: cache ? 1 : 0,
    healthRequest: null,
    HEALTH_MAX_AGE: 60_000,
    Date,
    jsonp,
    updateCopy() {},
  };
  const api = vm.runInNewContext(`
    let { healthCache, healthFetchedAt, healthRequest } = injected;
    const { navigator, HEALTH_MAX_AGE, Date, jsonp, updateCopy } = injected;
    ${healthFn}
    ({ getHealth, getCache: () => healthCache, getFetchedAt: () => healthFetchedAt,
       hasRequest: () => !!healthRequest });
  `, { injected: context, Promise, String });
  return { ...api, setOnline(value) { context.navigator.onLine = value; } };
}

test('directory startup work waits for ready or settled and coalesces queued duplicates', async () => {
  const h = setup();
  let runs = 0;
  const first = h.startup.schedule('quiet', () => { runs++; });
  const joined = h.startup.schedule('quiet', () => { runs += 100; });
  assert.equal(first, joined);
  h.flushIdle();
  assert.equal(runs, 0);
  h.startup.ready();
  h.startup.ready();
  h.flushIdle();
  await first;
  assert.equal(runs, 1);
  await Promise.resolve();
  const later = h.startup.schedule('quiet', () => { runs++; });
  h.flushIdle();
  await later;
  assert.equal(runs, 2);
});

test('settled releases queued work after initial load failure or valid empty roster', async () => {
  for (const finish of ['failed-request-finally', 'empty-roster']) {
    const h = setup();
    let runs = 0;
    h.startup.schedule(finish, () => { runs++; });
    h.startup.settled();
    h.flushIdle();
    await Promise.resolve();
    assert.equal(runs, 1);
  }
});

test('scheduled callbacks serialize, join while running, and recover after failure', async () => {
  const h = setup();
  const order = [];
  let release;
  const first = h.startup.schedule('first', async () => {
    order.push('first-start');
    await new Promise(resolve => { release = resolve; });
    order.push('first-end');
  });
  const joined = h.startup.schedule('first', () => order.push('duplicate'));
  const second = h.startup.schedule('second', () => order.push('second'));
  assert.equal(first, joined);
  h.startup.settled();
  h.flushIdle();
  await Promise.resolve();
  assert.deepEqual(order, ['first-start']);
  release();
  await first;
  await Promise.resolve();
  h.flushIdle();
  await second;
  assert.deepEqual(order, ['first-start', 'first-end', 'second']);

  const retry = h.startup.schedule('retry', () => { throw new Error('expected'); });
  h.flushIdle();
  await retry;
  await Promise.resolve();
  const recovered = h.startup.schedule('retry', () => order.push('retry-ok'));
  h.flushIdle();
  await recovered;
  assert.equal(order.at(-1), 'retry-ok');
});

test('non-directory pages schedule immediately without lifecycle hooks', async () => {
  const h = setup('calendar');
  let runs = 0;
  const job = h.startup.schedule('calendar-job', () => { runs++; });
  h.flushIdle();
  await job;
  assert.equal(runs, 1);
});

test('AI health requests share one flight, preserve cached status offline, and retry after failure', async () => {
  let count = 0;
  let finish;
  const health = makeHealth({ jsonp: () => {
    count++;
    return new Promise(resolve => { finish = resolve; });
  } });
  const direct = health.getHealth();
  const queued = health.getHealth();
  assert.equal(count, 1);
  assert.equal(health.hasRequest(), true);
  finish({ result: 'success', action: 'waffle_ai_health', configured: true });
  const [a, b] = await Promise.all([direct, queued]);
  assert.equal(a, b);
  assert.equal(count, 1);
  assert.equal(health.hasRequest(), false);

  const cached = health.getCache();
  health.setOnline(false);
  assert.equal(await health.getHealth(true), cached);
  assert.equal(health.getCache(), cached);
  assert.equal(count, 1);

  let attempts = 0;
  const retry = makeHealth({ jsonp: async () => {
    attempts++;
    if (attempts === 1) throw new Error('temporary failure');
    return { result: 'success', action: 'waffle_ai_health', configured: true };
  } });
  assert.equal((await retry.getHealth()).routeReady, false);
  assert.equal(retry.hasRequest(), false);
  assert.equal((await retry.getHealth(true)).configured, true);
  assert.equal(attempts, 2);
});
