'use strict';

// Local fixtures and source contracts only: this command never calls the live service.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const python = process.env.WAFFLE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const unitFiles = fs.readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.js')).sort();
const checks = [
  { name: 'Booking, identity, Care, save recovery and checkout fixtures', command: process.execPath, args: ['--test', ...unitFiles.map(name => `tests/${name}`)] },
  ...['check-care-future-stays.py', 'check-early-checkout.py', 'check-sitter-navigation.py', 'check-quick-add-mobile-modal.py', 'check-ui-stability.py'].map(name => ({ name, command: python, args: [`scripts/${name}`] }))
];
const report = { schema: 'boarding-mvp-verification/v1', generatedAt: new Date().toISOString(), productionWrites: false, scope: 'Local fixture and source-contract verification; browser and physical-device checks are separate.', checks: [] };
for (const check of checks) {
  console.log(`\nMVP check: ${check.name}`);
  const start = Date.now();
  const result = spawnSync(check.command, check.args, { cwd: root, stdio: 'inherit', shell: false });
  const passed = !result.error && result.status === 0;
  report.checks.push({ name: check.name, passed, exitCode: result.status, durationMs: Date.now() - start, ...(result.error ? { error: result.error.message } : {}) });
  if (!passed) {
    console.error(`MVP check failed: ${check.name}${result.error ? ` (${result.error.message})` : ''}`);
    break;
  }
}
report.passed = report.checks.length === checks.length && report.checks.every(check => check.passed);
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(root, 'test-results', 'mvp-readiness.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`\nMVP fixture/contract checks ${report.passed ? 'passed' : 'failed'}. Report: test-results/mvp-readiness.json`);
process.exitCode = report.passed ? 0 : 1;
