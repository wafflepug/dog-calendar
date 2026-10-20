const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const coordinatorSource = fs.readFileSync('care-startup-priority.js', 'utf8');
const careSource = fs.readFileSync('care.js', 'utf8');
const aiSource = fs.readFileSync('waffle-ai.js', 'utf8');
const operationsSource = fs.readFileSync('phase4-operations.js', 'utf8');

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

test('coalesced Care compatibility passes preserve unique delays and collapse a startup burst', () => {
  const start = careSource.indexOf('  function schedulePrepare(');
  const end = careSource.indexOf('\n  function wrapFunction(', start);
  assert(start >= 0 && end > start);
  const schedulerSource = careSource.slice(start, end);

  function createHarness(schedule) {
    let now = 0;
    let nextId = 0;
    const prepareTimes = [];
    const timers = new Map();
    const window = {
      setTimeout(callback, delay) {
        const id = ++nextId;
        timers.set(id, { callback, at: now + delay, cancelled: false });
        return id;
      },
      clearTimeout(id) { if (timers.has(id)) timers.get(id).cancelled = true; }
    };
    function prepare() { prepareTimes.push(now); }
    const schedulePrepare = schedule({ window, prepare, Map, Set });
    function advanceTo(target) {
      while (true) {
        const due = [...timers.entries()].filter(([, timer]) => !timer.cancelled && timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        now = timer.at;
        timer.callback();
      }
      now = target;
    }
    function drain() {
      while (true) {
        const due = [...timers.entries()].filter(([, timer]) => !timer.cancelled).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        now = timer.at;
        timer.callback();
      }
    }
    return { schedulePrepare, prepareTimes, advanceTo, drain };
  }

  const previous = createHarness(({ window, prepare }) => {
    let prepareTimer = 0;
    return function schedulePrepare(delays = [0, 60, 180, 420, 900]) {
      window.clearTimeout(prepareTimer);
      prepareTimer = window.setTimeout(prepare, 0);
      delays.filter(delay => delay > 0).forEach(delay => window.setTimeout(prepare, delay));
    };
  });
  [0, 1, 2].forEach(() => previous.schedulePrepare([0, 80, 240, 650]));
  previous.drain();

  const extracted = createHarness(({ window, prepare, Map, Set }) => Function('window', 'prepare', 'Map', 'Set', `const prepareTimers = new Map(); ${schedulerSource}; return schedulePrepare;`)(window, prepare, Map, Set));
  [0, 1, 2].forEach(() => extracted.schedulePrepare([0, 80, 240, 650]));
  extracted.advanceTo(0);
  extracted.advanceTo(80);
  // A new control arrives after the first compatibility pass. A new burst
  // must still schedule a fresh immediate pass and its 80 ms late pass, while
  // sharing the still-pending 240/650 ms passes from the earlier burst.
  extracted.advanceTo(100);
  [0, 1].forEach(() => extracted.schedulePrepare([0, 80, 100, 500]));
  extracted.advanceTo(100);
  extracted.drain();
  const afterOverlappingBurst = [...extracted.prepareTimes];

  // Once all timers finish, an entirely new guest/control burst can schedule
  // the same compatibility delays again.
  [0, 1, 2].forEach(() => extracted.schedulePrepare([0, 80, 240, 650]));
  extracted.drain();

  assert.equal(previous.prepareTimes.length, 10);
  assert.deepEqual(afterOverlappingBurst, [0, 80, 100, 180, 200, 240, 600, 650]);
  assert.deepEqual(extracted.prepareTimes.slice(8), [650, 730, 890, 1300]);
  assert.equal(afterOverlappingBurst.length, 8);
  assert.equal(extracted.prepareTimes.length, 12);
});

function makeOperations(page, source = operationsSource) {
  const events = new Map(), timers = [], reads = [];
  const hosts = { p4Reminders: { innerHTML: '', querySelectorAll: () => [] }, p4Insights: { innerHTML: '' } };
  const panels = { reminders: { innerHTML: '', hidden: true }, insights: { innerHTML: '', hidden: true } };
  const refresh = {};
  const modal = { hidden: true, querySelector(selector) { return selector.includes('reminders') ? panels.reminders : panels.insights; } };
  const today = '2026-10-17';
  const row = { dogName: 'Milo', normalizedDog: 'milo', startDate: today, endDate: '2026-10-20', ownerName: 'Casey', bookingType: 'Boarding', notes: '' };
  const document = {
    readyState: 'complete', body: { dataset: { wafflePage: page } },
    getElementById(id) { return hosts[id] || (id === 'p4RefreshReminders' ? refresh : null); },
  };
  const core = {
    page: () => String(document.body?.dataset?.wafflePage || 'calendar'), modal: () => modal, home: () => null,
    rows: () => [row], confirmed: () => true, meet: () => false,
    norm: value => String(value || '').toLowerCase(), today: () => today,
    addDays: (date, amount) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + amount); return d.toISOString().slice(0, 10); },
    fmt: value => value, esc: value => String(value), countDogs: () => 1,
    read: async payload => { reads.push(payload.action); return payload.action === 'get_intake_statuses' ? { records: [] } : { records: [] }; },
  };
  const window = {
    WAFFLE_PHASE4_CORE: core,
    addEventListener(name, callback) { events.set(name, callback); },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
  };
  vm.runInNewContext(source, { window, document, Date, Map, Set, Promise, String, Math, Number, Object, setTimeout: window.setTimeout });
  return { events, timers, reads, hosts, panels, refresh, modal, pageKey: document.body.dataset.wafflePage };
}

async function settleOperations() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

test('Care operations defer unused startup work but render reminders and insights on intent', async () => {
  const previousSource = operationsSource.replace("if(C().page()==='directory')return;", 'if(false)return;');
  const previous = makeOperations('directory', previousSource);
  assert.deepEqual(previous.timers.map(timer => timer.delay), [1200]);
  previous.timers[0].callback();
  await settleOperations();
  assert.deepEqual(previous.reads, ['get_intake_statuses', 'get_belongings']);

  const care = makeOperations('directory');
  assert.equal(care.pageKey, 'directory');
  assert.deepEqual(care.reads, []);
  assert.deepEqual(care.timers.map(timer => timer.delay), []);
  care.modal.hidden = false;
  care.panels.reminders.hidden = false;
  care.events.get('waffle:phase4-tab')({ detail: { tab: 'reminders' } });
  await settleOperations();
  assert.deepEqual(care.reads, ['get_intake_statuses', 'get_belongings']);
  assert.match(care.hosts.p4Reminders.innerHTML, /Intake needs attention/);

  care.reads.length = 0;
  care.refresh.onclick();
  await settleOperations();
  assert.deepEqual(care.reads, ['get_intake_statuses', 'get_belongings']);
  care.panels.reminders.hidden = true;
  care.panels.insights.hidden = false;
  care.events.get('waffle:phase4-tab')({ detail: { tab: 'insights' } });
  assert.match(care.hosts.p4Insights.innerHTML, /stays touching this month/);

  care.reads.length = 0;
  care.modal.hidden = true;
  care.events.get('waffle:phase4-data-changed')();
  assert.equal(care.timers.at(-1).delay, 900);
  care.timers.at(-1).callback();
  await settleOperations();
  assert.deepEqual(care.reads, []);

  care.hosts.p4Insights.innerHTML = 'stale insights sentinel';
  care.modal.hidden = false;
  care.panels.reminders.hidden = true;
  care.panels.insights.hidden = false;
  care.events.get('waffle:phase4-data-changed')();
  care.timers.at(-1).callback();
  await settleOperations();
  assert.match(care.hosts.p4Insights.innerHTML, /stays touching this month/);
  assert.doesNotMatch(care.hosts.p4Insights.innerHTML, /stale insights sentinel/);
  assert.deepEqual(care.reads, []);

  care.panels.reminders.hidden = false;
  care.panels.insights.hidden = true;
  care.events.get('waffle:phase4-data-changed')();
  care.timers.at(-1).callback();
  await settleOperations();
  assert.deepEqual(care.reads, ['get_intake_statuses', 'get_belongings']);
});

test('non-Care operations retain eager insights and delayed reminder startup', async () => {
  const calendar = makeOperations('calendar');
  assert.match(calendar.hosts.p4Insights.innerHTML, /stays touching this month/);
  assert.deepEqual(calendar.timers.map(timer => timer.delay), [1200]);
  calendar.timers[0].callback();
  await settleOperations();
  assert.deepEqual(calendar.reads, ['get_intake_statuses', 'get_belongings']);
});
