'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workflow = readFileSync(path.join(__dirname, '../.github/workflows/ui-regression.yml'), 'utf8').replace(/\r\n/g, '\n');
const homeGuestsWorkflow = readFileSync(path.join(__dirname, '../.github/workflows/home-guests.yml'), 'utf8').replace(/\r\n/g, '\n');
const jobs = Object.fromEntries([...workflow.matchAll(/^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:|$(?![\s\S]))/gm)]
  .filter(([text]) => /runs-on:/.test(text)).map(([, name, body]) => [name, body]));
const expectedConfigs = [
  'playwright.phone-clearance.config.js',
  'playwright.care-photo-save.config.js',
  'playwright.care-daily-workflows.config.js',
  'playwright.arrival-checkout.config.js',
  'playwright.owner-handoff.config.js',
  'playwright.care-profile-tools.config.js',
  'playwright.care-profile-condensed.config.js',
  'playwright.booking-owner-share.config.js',
  'playwright.care-status-empty-navigation.config.js', 'playwright.care-summary-card-clarity.config.js', 'playwright.care-render-performance.config.js',
  'playwright.care-profile.config.js', 'playwright.care-ui-polish.config.js',
  'playwright.care-roster.config.js', 'playwright.care-ui-refinements.config.js',
  'playwright.care-navigation-accessibility.config.js', 'playwright.care-scroll-access.config.js',
  'playwright.care-loading-feedback.config.js', 'playwright.care-navigation-continuity.config.js', 'playwright.owner-workflows.config.js',
  'tests/mvp-records-notifications.config.js', 'tests/notification-device-settings.config.js', 'playwright.mvp-observer.config.js',
  'playwright.care-overview.config.js', 'playwright.returning-dogs.config.js',
  'playwright.runtime-review.config.js', 'playwright.care-cleaner-ui.config.js',
  'playwright.care-detailed-care-runtime.config.js', 'playwright.care-mobile-hierarchy.config.js',
  'playwright.care-photos.config.js', 'playwright.care-ui-five.config.js', 'playwright.care-ui-clarity.config.js', 'playwright.care-compact-controls.config.js', 'playwright.booking-plan.config.js', 'playwright.care-master-compact.config.js'
];

test('parallel fixture matrix retains every existing configuration exactly once', () => {
  assert.deepEqual(Object.keys(jobs).sort(), ['contracts', 'fixtures', 'placement', 'ui-regression']);
  const configs = [...jobs.fixtures.matchAll(/^\s+configs: (.+)$/gm)].flatMap(([, line]) => line.trim().split(/\s+/));
  assert.equal(new Set(configs).size, configs.length, 'fixture configs must not be duplicated');
  for (const config of expectedConfigs) assert.equal(configs.filter(value => value === config).length, 1, `${config} must remain in exactly one fixture group`);
  for (const changedPath of ['playwright.booking-owner-share.config.js', 'tests/booking-owner-share.browser.spec.js', 'tests/notification-device-settings.config.js', 'tests/notification-device-settings.browser.spec.js', 'tests/care-roster-efficiency.browser.spec.js']) {
    assert.equal(workflow.split('\n').filter(line => line.trim() === `- '${changedPath}'`).length, 2, `${changedPath} must trigger both PR and push workflows`);
  }
  for (const name of ['contracts', 'fixtures', 'placement']) assert.doesNotMatch(jobs[name], /\bneeds:/);
  assert.match(jobs.fixtures, /fail-fast: false/);
  assert.match(jobs.fixtures, /--config="\$config" --output="test-results\/\$FIXTURE_GROUP-\$name"/);
  assert.match(jobs.fixtures, /install-deps chromium firefox webkit/);
  assert.match(jobs.fixtures, /install chromium firefox webkit/);
});

test('contract job preserves existing Node checks', () => {
  const expected = ['care-freshness-clarity', 'care-empty-states', 'care-profile-navigation', 'care-document-return', 'care-summary-updates', 'care-directory-refresh-rendering', 'care-decorator-observer', 'care-media-render-cache', 'local-ui-runner', 'local-network-policy', 'waffle-bootstrap-lifecycle', 'care-startup-priority', 'care-past-background-load', 'booking-plan', 'dog-record-cache-age',
    'care-profile-performance', 'care-profile-shared-reads', 'care-swr-cache-write-guard', 'care-profile-readiness', 'care-overview-freshness', 'care-record-update-contract',
    'care-state-preservation', 'care-past-classification', 'stay-operation-frontend', 'care-csv-integrity', 'care-confirmed-reconciliation',
    'confirmed-stay-identity', 'potential-confirm-dog-id', 'checkout-collision-safety',
    'system-status-sync', 'system-status-release', 'care-navigation-continuity',
    'care-return-focus-identity', 'care-editor-simple', 'care-photo-delivery', 'ui-workflow-parallel'].map(name => `tests/${name}.test.js`);
  const actual = [...jobs.contracts.matchAll(/tests\/[\w-]+\.test\.js/g)].map(([file]) => file);
  assert.deepEqual(actual.sort(), expected.sort());
});

test('profile suites can fail and rerun independently without losing coverage', () => {
  const groups = [...jobs.fixtures.matchAll(/- group: (profiles-[^\r\n]+)\r?\n\s+configs: ([^\r\n]+)/g)];
  assert.equal(groups.length, 6);
  assert.equal(new Set(groups.map(([, name]) => name)).size, 6);
  assert.deepEqual(groups.map(([, , config]) => config.trim()).sort(), [
    'playwright.care-cleaner-ui.config.js', 'playwright.care-detailed-care-runtime.config.js',
    'playwright.care-mobile-hierarchy.config.js', 'playwright.care-photos.config.js',
    'playwright.care-ui-five.config.js', 'playwright.care-ui-clarity.config.js'
  ].sort());
});

test('placement runs all three shards with the existing runner and real exit code', () => {
  assert.match(jobs.placement, /shard: \[1, 2, 3\]/);
  assert.match(jobs.placement, /fail-fast: false/);
  assert.match(jobs.placement, /npm run test:ui:local -- --shard=\$\{\{ matrix.shard \}\}\/3/);
  assert.match(jobs.placement, /install-deps chromium firefox webkit/);
  assert.match(jobs.placement, /install chromium firefox webkit/);
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

test('browser setup is cached, bounded, complete, and reported separately from tests', () => {
  for (const name of ['fixtures', 'placement']) {
    assert.match(jobs[name], /- name: Cache Playwright browsers\n\s+id: browser_cache\n\s+uses: actions\/cache@v4\n\s+timeout-minutes: 3\n\s+with:\n\s+path: ~\/\.cache\/ms-playwright\n\s+key: playwright-chromium-firefox-webkit-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}/);
    assert.match(jobs[name], /- name: Install (fixture|placement) dependencies\n\s+id: install_dependencies\n\s+timeout-minutes: 5\n\s+run: npm ci --no-audit --no-fund/);
    assert.match(jobs[name], /- name: Install (fixture|placement) browser system dependencies and browsers\n\s+id: install_browsers\n\s+timeout-minutes: 8\n\s+run: \|/);
    assert.match(jobs[name], /npm ci --no-audit --no-fund/);
    assert.match(jobs[name], /install-deps chromium firefox webkit\n\s+node node_modules\/@playwright\/test\/cli\.js install chromium firefox webkit/);
    assert.match(jobs[name], /- name: Report (fixture|placement) setup failure\n\s+if: failure\(\) && \(steps\.browser_cache\.outcome == 'failure' \|\| steps\.browser_cache\.outcome == 'cancelled'[\s\S]*steps\.install_dependencies\.outcome == 'failure'[\s\S]*steps\.install_browsers\.outcome == 'failure' \|\| steps\.install_browsers\.outcome == 'cancelled'\)/);
    assert.match(jobs[name], /Browser cache restoration, npm dependency installation, or browser\/system dependency setup failed or timed out/);
    assert.match(jobs[name], /- name: Run (fixture configurations|cross-device UI placement regression)/);
  }
  const homeCacheKey = homeGuestsWorkflow.match(/^\s+key: (.+)$/m)?.[1];
  const uiCacheKey = jobs.fixtures.match(/^\s+key: (.+)$/m)?.[1];
  assert.match(homeCacheKey ?? '', /^playwright-chromium-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}$/);
  assert.match(uiCacheKey ?? '', /^playwright-chromium-firefox-webkit-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}$/);
  assert.notEqual(homeCacheKey, uiCacheKey, 'Chromium-only and three-browser jobs need distinct immutable cache keys');
  assert.match(homeGuestsWorkflow, /timeout-minutes: 5\n\s+run: npm ci --no-audit --no-fund/);
  assert.match(homeGuestsWorkflow, /timeout-minutes: 8[\s\S]*?install-deps chromium\n[\s\S]*?install chromium/);
  assert.match(homeGuestsWorkflow, /Cache Playwright browsers\n\s+id: browser_cache/);
  assert.match(homeGuestsWorkflow, /Report browser test setup failure\n\s+if: failure\(\) && \(steps\.browser_cache\.outcome == 'failure' \|\| steps\.browser_cache\.outcome == 'cancelled'[\s\S]*steps\.install_dependencies\.outcome == 'failure'[\s\S]*steps\.install_browsers\.outcome == 'failure' \|\| steps\.install_browsers\.outcome == 'cancelled'\)/);
  assert.match(homeGuestsWorkflow, /Browser cache restoration, npm dependency installation, or Chromium\/system dependency setup failed or timed out[\s\S]*Run Home Guest browser tests/);
  assert.doesNotMatch(`${workflow}\n${homeGuestsWorkflow}`, /^\s*continue-on-error:/m);
});

test('browser setup avoids the Azure Ubuntu mirror without changing package signatures', () => {
  for (const name of ['fixtures', 'placement']) {
    assert.ok(jobs[name].includes('/etc/apt/sources.list.d/*.sources'));
    assert.ok(jobs[name].includes('/etc/apt/apt-mirrors*.txt'));
    assert.ok(jobs[name].includes('s|azure.archive.ubuntu.com|archive.ubuntu.com|g'));
    assert.doesNotMatch(jobs[name], /--allow-unauthenticated|trusted=yes|Check-Valid-Until=false/);
  }
});

test('reruns upload separate artifacts for each attempt', () => {
  for (const name of ['fixtures', 'placement']) assert.ok(jobs[name].includes('${{ github.run_attempt }}'));
});

test('Care timing setup preserves a required bounded test step after dependency installation', () => {
  const timing = readFileSync(path.join(__dirname, '..', '.github/workflows/care-profile-read-timing.yml'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(timing, /timeout-minutes: 30/);
  assert.match(timing, /key: playwright-chromium-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}/);
  assert.match(timing, /timeout-minutes: 8[\s\S]*install-deps chromium[\s\S]*install chromium/);
  assert.match(timing, /Report browser test setup failure[\s\S]*if: failure\(\)/);
  assert.match(timing, /Run bounded cold and warm checks\n\s+timeout-minutes: 10\n\s+run: node node_modules\/@playwright\/test\/cli.js test --config=playwright.care-profile-timing.config.js/);
  assert.ok(timing.includes('s|azure.archive.ubuntu.com|archive.ubuntu.com|g'));
  assert.doesNotMatch(timing, /continue-on-error|--allow-unauthenticated|trusted=yes/);
});
