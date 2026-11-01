'use strict';

// Bounded local fixture/source checks. Scope definitions are static: no user-supplied
// commands are accepted, and this runner never contacts the live service.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCOPES = Object.freeze({
  intake: Object.freeze([
    { name: 'Legacy intake Groq configuration fixtures', kind: 'unit', file: 'tests/legacy-intake-groq-config.test.js' },
    { name: 'Legacy intake PDF decoding fixtures', kind: 'unit', file: 'tests/legacy-intake-pdf-decode.test.js' },
    { name: 'Care intake identity fixtures', kind: 'unit', file: 'tests/care-intake-identity.test.js' }
  ]),
  booking: Object.freeze([
    { name: 'Booking plan and save recovery fixtures', kind: 'unit', file: 'tests/booking-plan.test.js' },
    { name: 'Checkout collision safety fixtures', kind: 'unit', file: 'tests/checkout-collision-safety.test.js' },
    { name: 'Confirmed stay identity fixtures', kind: 'unit', file: 'tests/confirmed-stay-identity.test.js' },
    { name: 'Stay ID enrollment fixtures', kind: 'unit', file: 'tests/form-stay-id-enrollment.test.js' },
    { name: 'Early checkout source contract', kind: 'python', file: 'scripts/check-early-checkout.py' }
  ]),
  care: Object.freeze([
    { name: 'Care photo recovery fixtures', kind: 'unit', file: 'tests/care-photo-recovery.test.js' },
    { name: 'Care state preservation fixtures', kind: 'unit', file: 'tests/care-state-preservation.test.js' },
    { name: 'Care write guard fixtures', kind: 'unit', file: 'tests/care-swr-cache-write-guard.test.js' },
    { name: 'Care future stay source contract', kind: 'python', file: 'scripts/check-care-future-stays.py' },
    { name: 'Sitter navigation source contract', kind: 'python', file: 'scripts/check-sitter-navigation.py' }
  ])
});

function selectChecks(scope) {
  if (typeof scope !== 'string' || !Object.hasOwn(SCOPES, scope)) {
    throw new Error(`Unknown or missing scope${scope ? ` "${scope}"` : ''}. Choose: ${Object.keys(SCOPES).join(', ')}`);
  }
  return SCOPES[scope].map(check => ({ ...check }));
}

function runFocused({ scope, root = path.resolve(__dirname, '..'), python = process.env.WAFFLE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), spawn = spawnSync, now = Date.now, writeReport = true } = {}) {
  const checks = selectChecks(scope);
  const report = {
    schema: 'waffle-focused-readiness/v1',
    generatedAt: new Date().toISOString(),
    productionWrites: false,
    scope,
    checks: []
  };

  for (const check of checks) {
    const command = check.kind === 'unit' ? process.execPath : python;
    const args = check.kind === 'unit' ? ['--test', check.file] : [check.file];
    console.log(`\nFocused ${scope} check: ${check.name}`);
    const start = now();
    const result = spawn(command, args, { cwd: root, stdio: 'inherit', shell: false });
    const durationMs = Math.max(0, now() - start);
    const passed = !result.error && result.status === 0;
    report.checks.push({
      name: check.name,
      kind: check.kind,
      file: check.file,
      passed,
      exitCode: result.status,
      durationMs,
      ...(result.signal ? { signal: result.signal } : {}),
      ...(result.error ? { error: result.error.message } : {})
    });
    if (!passed) {
      console.error(`Focused ${scope} check failed: ${check.name}${result.error ? ` (${result.error.message})` : ''}`);
      break;
    }
  }

  report.passed = report.checks.length === checks.length && report.checks.every(check => check.passed);
  if (writeReport) {
    const output = path.join(root, 'test-results', 'focused-readiness.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(`\nFocused ${scope} checks ${report.passed ? 'passed' : 'failed'}.${writeReport ? ' Report: test-results/focused-readiness.json' : ''}`);
  return report;
}

function main(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === '--list') {
    for (const [scope, checks] of Object.entries(SCOPES)) {
      console.log(`${scope}: ${checks.map(check => check.file).join(', ')}`);
    }
    return 0;
  }
  if (argv.length !== 2 || argv[0] !== '--scope' || !argv[1]) {
    console.error('Usage: node scripts/check-focused-readiness.js --list | --scope <intake|booking|care>');
    return 2;
  }
  try {
    return runFocused({ scope: argv[1] }).passed ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    return 2;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = { SCOPES, selectChecks, runFocused, main };
