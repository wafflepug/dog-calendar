'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SCOPES, selectChecks, runFocused, main } = require('../scripts/check-focused-readiness');

test('focused scopes are explicit and exclude browser suites', () => {
  for (const scope of ['intake', 'booking', 'care']) {
    const checks = selectChecks(scope);
    assert.ok(checks.length > 0);
    assert.ok(checks.every(check => check.file.endsWith('.test.js') || check.file.endsWith('.py')));
    assert.ok(checks.every(check => !check.file.endsWith('.browser.spec.js')));
  }
  assert.deepEqual(Object.keys(SCOPES), ['intake', 'booking', 'care']);
});

test('unknown and missing scopes fail selection and CLI parsing', () => {
  assert.throws(() => selectChecks('everything'), /Unknown or missing scope/);
  assert.throws(() => selectChecks(), /Unknown or missing scope/);
  assert.equal(main([]), 2);
  assert.equal(main(['--scope']), 2);
  assert.equal(main(['--scope', 'all']), 2);
});

test('focused runner records actual checks and stops on the first spawn failure', () => {
  const calls = [];
  let time = 0;
  const report = runFocused({
    scope: 'intake',
    root: process.cwd(),
    writeReport: false,
    now: () => (time += 7),
    spawn: (command, args, options) => {
      calls.push({ command, args, options });
      return calls.length === 2
        ? { status: null, error: new Error('synthetic spawn failure') }
        : { status: 0 };
    }
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.shell, false);
  assert.equal(report.scope, 'intake');
  assert.equal(report.productionWrites, false);
  assert.equal(report.checks.length, 2);
  assert.deepEqual(report.checks.map(check => check.passed), [true, false]);
  assert.equal(report.checks[0].durationMs, 7);
  assert.match(report.checks[1].error, /synthetic spawn failure/);
  assert.equal(report.passed, false);
});
