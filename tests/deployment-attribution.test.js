'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { generate } = require('../scripts/generate-backend-deployment');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps-script/DeploymentIdentity.js'), 'utf8');
const sha = 'a'.repeat(40);

function runtime(prefix = '') {
  const ctx = vm.createContext({});
  vm.runInContext(source + '\n' + prefix, ctx);
  return ctx;
}

test('manual backend source reports unknown instead of claiming a deployed SHA', () => {
  assert.equal(runtime().getWaffleDeploymentIdentity_(), null);
});

test('generated identity names exact deployed source, timestamp and run, without secrets', () => {
  const generated = generate({ GITHUB_SHA: sha, GITHUB_RUN_ID: '1234', CLASPRC_JSON: 'PRIVATE_SENTINEL', GITHUB_TOKEN: 'PRIVATE_SENTINEL' }, new Date('2026-10-06T01:02:03Z'));
  assert.ok(!generated.includes('PRIVATE_SENTINEL'));
  const ctx = runtime(generated);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.getWaffleDeploymentIdentity_())), {
    schemaVersion: 1, commitSha: sha, generatedAt: '2026-10-06T01:02:03.000Z', workflowRunId: '1234'
  });
});

test('deployment generator refuses missing or abbreviated identity', () => {
  for (const env of [{}, { GITHUB_SHA: 'abc1234', GITHUB_RUN_ID: '123' }, { GITHUB_SHA: sha, GITHUB_RUN_ID: 'bad' }]) {
    assert.throws(() => generate(env));
  }
});

test('runtime identity drops extra fields and refuses corrupt deployment data', () => {
  const valid = { schemaVersion: 1, commitSha: sha, generatedAt: '2026-10-06T01:02:03Z', workflowRunId: '1234', secret: 'PRIVATE_SENTINEL' };
  const ctx = runtime();
  ctx.WAFFLE_DEPLOYMENT_IDENTITY_ = valid;
  assert.ok(!JSON.stringify(ctx.getWaffleDeploymentIdentity_()).includes('PRIVATE_SENTINEL'));
  for (const value of [null, {}, { ...valid, commitSha: '123' }, { ...valid, generatedAt: 'bad' }, { ...valid, workflowRunId: 'bad' }]) {
    ctx.WAFFLE_DEPLOYMENT_IDENTITY_ = value;
    assert.equal(ctx.getWaffleDeploymentIdentity_(), null);
  }
});

test('actual read-only versions handler returns backend identity independently of website metadata', () => {
  const code = fs.readFileSync(path.join(root, 'apps-script/Code.js'), 'utf8');
  const start = code.indexOf('  if (action === "get_data_versions") {');
  const end = code.indexOf('  if (action === "get_audit_log")', start);
  assert.ok(start > 0 && end > start);
  const ctx = runtime(generate({ GITHUB_SHA: sha, GITHUB_RUN_ID: '1234' }));
  ctx.getWaffleDataVersions_ = () => ({ directory: 'saved-version' });
  ctx.STABLE_STAY_IDENTITY_VERSION_V11225_ = 1;
  ctx.STAY_OPERATION_IDENTITY_VERSION_V11226_ = 1;
  vm.runInContext('function versions(action) {\n' + code.slice(start, end) + '\n}', ctx);
  const response = ctx.versions('get_data_versions');
  assert.equal(response.result, 'success');
  assert.equal(response.deployment.commitSha, sha);
  assert.equal(response.versions.directory, 'saved-version');
  assert.equal(response.versions.stayOperationIdentityVersion, 1);
});

test('service worker lets deployment probes fail honestly instead of serving silent cached success', () => {
  const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const start = sw.indexOf("self.addEventListener('fetch', event => {");
  assert.ok(start > 0);
  let listener;
  const ctx = vm.createContext({
    URL,
    self: { location: { origin: 'https://wafflepug.github.io' }, addEventListener(_, handler) { listener = handler; } },
    isOperationalDataRequest() { return false; },
    isRecoveryCriticalAsset() { return false; },
    isFreshnessCriticalAsset() { return false; },
    isFirstPaintStaticAsset() { return false; },
    staleWhileRevalidate() { return 'cached'; }
  });
  vm.runInContext(sw.slice(start, sw.indexOf("self.addEventListener('message'", start) > 0 ? sw.indexOf("self.addEventListener('message'", start) : undefined), ctx);
  for (const name of ['waffle-deployment.json', 'waffle-build.json', 'waffle-release.json']) {
    let intercepted = false;
    listener({ request: { url: 'https://wafflepug.github.io/dog-calendar/' + name, method: 'GET', cache: 'no-store' }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, name);
  }
});
