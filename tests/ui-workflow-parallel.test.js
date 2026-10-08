'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workflow = readFileSync(path.join(__dirname, '../.github/workflows/ui-regression.yml'), 'utf8').replace(/\r\n/g, '\n');
const jobs = Object.fromEntries([...workflow.matchAll(/^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:|$(?![\s\S]))/gm)]
  .filter(([text]) => /runs-on:/.test(text)).map(([, name, body]) => [name, body]));
const expectedConfigs = [
  'playwright.care-profile.config.js', 'playwright.care-ui-polish.config.js',
  'playwright.care-roster.config.js', 'playwright.care-ui-refinements.config.js',
  'playwright.care-navigation-accessibility.config.js', 'playwright.care-scroll-access.config.js',
  'playwright.care-loading-feedback.config.js', 'playwright.care-navigation-continuity.config.js',
  'tests/mvp-records-notifications.config.js', 'playwright.mvp-observer.config.js',
  'playwright.care-overview.config.js', 'playwright.returning-dogs.config.js',
  'playwright.runtime-review.config.js'
];

test('parallel fixture matrix retains every existing configuration exactly once', () => {
  assert.deepEqual(Object.keys(jobs).sort(), ['contracts', 'fixtures', 'placement', 'ui-regression']);
  const configs = [...jobs.fixtures.matchAll(/^\s+configs: (.+)$/gm)].flatMap(([, line]) => line.trim().split(/\s+/));
  assert.deepEqual(configs.sort(), expectedConfigs.slice().sort());
  for (const name of ['contracts', 'fixtures', 'placement']) assert.doesNotMatch(jobs[name], /\bneeds:/);
  assert.match(jobs.fixtures, /fail-fast: false/);
  assert.match(jobs.fixtures, /--config="\$config" --output="test-results\/\$FIXTURE_GROUP-\$name"/);
  assert.match(jobs.fixtures, /install --with-deps chromium webkit/);
});

test('contract job preserves existing Node checks', () => {
  const expected = ['local-ui-runner', 'local-network-policy', 'waffle-bootstrap-lifecycle',
    'care-profile-readiness', 'care-overview-freshness', 'care-record-update-contract',
    'care-state-preservation', 'care-csv-integrity', 'care-confirmed-reconciliation',
    'confirmed-stay-identity', 'potential-confirm-dog-id', 'checkout-collision-safety',
    'system-status-sync', 'system-status-release', 'care-navigation-continuity',
    'care-return-focus-identity', 'ui-workflow-parallel'].map(name => `tests/${name}.test.js`);
  const actual = [...jobs.contracts.matchAll(/tests\/[\w-]+\.test\.js/g)].map(([file]) => file);
  assert.deepEqual(actual.sort(), expected.sort());
});

test('placement runs all three shards with the existing runner and real exit code', () => {
  assert.match(jobs.placement, /shard: \[1, 2, 3\]/);
  assert.match(jobs.placement, /fail-fast: false/);
  assert.match(jobs.placement, /npm run test:ui:local -- --shard=\$\{\{ matrix.shard \}\}\/3/);
  assert.match(jobs.placement, /install --with-deps chromium firefox webkit/);
  assert.match(jobs.placement, /test_exit=\$\?[\s\S]*node scripts\/summarize-ui-regression.js[\s\S]*exit "\$test_exit"/);
  assert.doesNotMatch(workflow, /continue-on-error: true|--pass-with-no-tests|--retries|--fully-parallel/);
});

test('required ui-regression gate runs on failures and accepts only complete success', () => {
  assert.match(jobs['ui-regression'], /name: ui-regression/);
  assert.match(jobs['ui-regression'], /if: always\(\)/);
  assert.match(jobs['ui-regression'], /needs: \[contracts, fixtures, placement\]/);
  for (const name of ['contracts', 'fixtures', 'placement']) {
    assert.ok(jobs['ui-regression'].includes(`${name.toUpperCase()}_RESULT: \${{ needs.${name}.result }}`));
    assert.ok(jobs['ui-regression'].includes(`"$${name.toUpperCase()}_RESULT" != success`));
  }
  assert.match(jobs['ui-regression'], /then[\s\S]*exit 1/);
  for (const name of ['fixtures', 'placement']) {
    assert.match(jobs[name], /if: always\(\)[\s\S]*actions\/upload-artifact@v4/);
    assert.match(jobs[name], /name: .*\$\{\{ matrix\.(group|shard) \}\}.*\$\{\{ github.run_id \}\}/);
  }
});

test('browser installation stalls fail within five minutes', () => {
  for (const name of ['fixtures', 'placement']) {
    assert.match(jobs[name], /- name: Install dependencies and [^\n]+\n\s+timeout-minutes: 5\n\s+run: \|/);
    assert.match(jobs[name], /npm ci --no-audit --no-fund/);
  }
});

test('browser setup avoids the Azure Ubuntu mirror without changing package signatures', () => {
  for (const name of ['fixtures', 'placement']) {
    assert.ok(jobs[name].includes('/etc/apt/sources.list.d/ubuntu.sources'));
    assert.ok(jobs[name].includes('s|azure.archive.ubuntu.com|archive.ubuntu.com|g'));
    assert.doesNotMatch(jobs[name], /--allow-unauthenticated|trusted=yes|Check-Valid-Until=false/);
  }
});
