'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { BASE_URL, runLocalUi } = require('../scripts/run-local-ui');

class FakeChild extends EventEmitter {
  constructor({ autoExit = null } = {}) {
    super();
    this.exitCode = null;
    this.exited = false;
    this.killed = [];
    if (autoExit) queueMicrotask(() => this.finish(autoExit.code, autoExit.signal));
  }

  finish(code = 0, signal = null) {
    if (this.exitCode !== null) return;
    this.exitCode = code;
    this.exited = true;
    this.emit('exit', code, signal);
  }

  kill(signal) {
    this.killed.push(signal);
    this.finish(143, signal);
  }
}

function harness({ probes, spawnPlan, onRegister, onProbe, portFree = true } = {}) {
  const calls = [];
  let probeIndex = 0;
  let registerHandlers = null;
  const children = [];
  return {
    calls,
    children,
    registerSignals(handlers) {
      registerHandlers = handlers;
      onRegister?.(handlers);
      return () => { registerHandlers = null; };
    },
    signal(name) { registerHandlers?.[name](); },
    probeImpl: async () => {
      const index = probeIndex++;
      onProbe?.(index);
      return Boolean(probes[index]);
    },
    portFreeImpl: async () => portFree,
    spawnImpl(command, args, options) {
      calls.push({ command, args, options });
      const plan = spawnPlan?.[children.length] || {};
      const child = new FakeChild(plan);
      children.push(child);
      if (plan.error) queueMicrotask(() => child.emit('error', plan.error));
      return child;
    },
    sleepImpl: async () => {}
  };
}

test('runs direct CLI, forces loopback URL, forwards args, and preserves failing exit', async () => {
  const h = harness({ probes: [false, true], spawnPlan: [{}, { autoExit: { code: 7 } }] });
  const code = await runLocalUi({
    ...h,
    resolveCli: () => '/fake/playwright-cli.js',
    args: ['--project=iphone-pro-390x844']
  });
  assert.equal(code, 7);
  assert.equal(h.calls.length, 2);
  assert.match(h.calls[1].options.env.WAFFLE_BASE_URL, /^http:\/\/127\.0\.0\.1:4173$/);
  assert.deepEqual(h.calls[1].args.slice(0, 3), ['/fake/playwright-cli.js', 'test', '--config=playwright.ui.config.js']);
  assert.equal(h.calls[1].args[3], '--project=iphone-pro-390x844');
  assert.equal(BASE_URL, 'http://127.0.0.1:4173');
});

test('returns zero for a successful Playwright child', async () => {
  const h = harness({ probes: [false, true], spawnPlan: [{}, { autoExit: { code: 0 } }] });
  assert.equal(await runLocalUi({ ...h, resolveCli: () => '/fake/cli.js' }), 0);
});

test('returns 143 for SIGTERM after launch', async () => {
  let h;
  h = harness({ probes: [false, true], spawnPlan: [{}, {}], onRegister: handlers => {
    const timer = setInterval(() => {
      if (h.children.length < 2) return;
      clearInterval(timer);
      handlers.SIGTERM();
    }, 0);
  }});
  assert.equal(await runLocalUi({ ...h, resolveCli: () => '/fake/cli.js' }), 143);
});

test('resolves the pinned CLI before starting a server', async () => {
  const h = harness({ probes: [false] });
  await assert.rejects(
    () => runLocalUi({ ...h, resolveCli: () => { throw new Error('Playwright is not installed'); } }),
    /Playwright is not installed/
  );
  assert.equal(h.calls.length, 0);
});

test('refuses an occupied port before spawning anything', async () => {
  const h = harness({ probes: [true], portFree: false });
  await assert.rejects(() => runLocalUi({ ...h, resolveCli: () => '/fake/cli.js' }), /already in use/);
  assert.equal(h.calls.length, 0);
});

test('fails cleanly when Python cannot spawn', async () => {
  const h = harness({ probes: [false], spawnPlan: [{ error: new Error('python missing') }] });
  await assert.rejects(() => runLocalUi({ ...h, resolveCli: () => '/fake/cli.js' }), /python missing/);
});

test('interrupt before readiness returns 130, cleans server, and never launches tests', async () => {
  let h;
  h = harness({ probes: [false, false], onRegister: () => queueMicrotask(() => h.signal('SIGINT')) });
  const code = await runLocalUi({ ...h, resolveCli: () => '/fake/cli.js' });
  assert.equal(code, 130);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.children[0].killed, ['SIGTERM']);
});

test('interrupt after launch returns 130 and cleans both children', async () => {
  let h;
  h = harness({ probes: [false, true], spawnPlan: [{}, {}], onRegister: handlers => {
    const timer = setInterval(() => {
      if (h.children.length < 2) return;
      clearInterval(timer);
      handlers.SIGINT();
    }, 0);
  }});
  const code = await runLocalUi({ ...h, resolveCli: () => '/fake/cli.js' });
  assert.equal(code, 130);
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.children.map(child => child.killed), [['SIGTERM'], ['SIGTERM']]);
});

test('rejects when the server exits while a successful probe is in flight', async () => {
  let h;
  h = harness({
    probes: [false, true],
    onProbe: index => { if (index === 1) h.children[0].finish(9); }
  });
  await assert.rejects(() => runLocalUi({ ...h, resolveCli: () => '/fake/cli.js' }), /exited with code 9/);
  assert.equal(h.calls.length, 1);
});
