const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const manifest = JSON.parse(fs.readFileSync(require.resolve('./fixtures/deployment-manifest-current.json'), 'utf8'));
const frontendSha = manifest.artifact.commitSha;
const backendSha = 'fedcba9876543210fedcba9876543210fedcba98';

test('System Status separates deployed frontend identity, backend protocol and backend deployment identity', async ({ page }) => {
  let failManifest = false;
  let includeBackendIdentity = true;
  let malformedBackendRunId = false;
  let missingProtocol = false;
  let failBackendVersion = false;
  let releaseMismatch = false;
  let raceHealthRequests = false;
  let healthCalls = 0;
  const backendActions = [];
  await page.route('**/waffle-deployment.json*', route => failManifest ? route.abort() : route.fulfill({ contentType: 'application/json', body: JSON.stringify(manifest) }));
  await page.route('**/waffle-build.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ build: '2026.08.28.01', assetRevision: releaseMismatch ? '2026.10.06.99' : '2026.10.06.02', releaseName: 'Release Attribution' }) }));
  await page.route('**/waffle-release.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ currentRelease: '2026.10.06.02', currentReleaseName: 'Release Attribution', latestMergedSha: '41c7d27', runtimeBuild: '2026.08.28.01' }) }));
  await page.route('https://script.google.com/**', async route => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || (() => { try { return JSON.parse(url.searchParams.get('payload') || '{}').action; } catch (_) { return ''; } })();
    backendActions.push(action);
    const callback = url.searchParams.get('callback');
    if (action === 'get_data_versions' && failBackendVersion) return route.abort();
    if (action === 'health' && raceHealthRequests && ++healthCalls === 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return route.fulfill({ contentType: 'application/javascript', body: `${callback}({"result":"error"});` });
    }
    const data = action === 'get_data_versions'
      ? { result: 'success', ...(missingProtocol ? {} : { versions: { stableStayIdentityVersion: 1, stayOperationIdentityVersion: 1 } }), ...(includeBackendIdentity ? { deployment: { schemaVersion: 1, commitSha: backendSha, generatedAt: '2026-10-06T01:30:00.000Z', workflowRunId: malformedBackendRunId ? 'not-a-run' : 12345 } } : {}) }
      : action === 'waffle_ai_health' ? { result: 'success', routeReady: true } : { result: 'success', enabled: false };
    return route.fulfill({ contentType: 'application/javascript', body: `${callback}(${JSON.stringify(data)});` });
  });

  await page.goto('/system-status.html');
  const frontend = page.locator('#frontendCard');
  const backend = page.locator('#backendCard');
  await expect(frontend.locator('[data-value]')).toHaveText('Deployed');
  await expect(frontend.locator('[data-detail]')).toContainText('Release Attribution · revision 2026.10.06.02');
  await expect(frontend.locator('[data-detail]')).toContainText(frontendSha);
  await expect(backend.locator('[data-detail]')).toContainText('Protocol · stable stay 1, stay operations 1');
  await expect(backend.locator('[data-detail]')).toContainText(backendSha);
  await expect(backend.locator('[data-detail]')).toContainText('observed live by this browser');
  await expect(page.locator('#releaseCard [data-detail]')).toContainText('historical SHA 41c7d27');
  await page.setViewportSize({ width: 320, height: 800 });
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);

  releaseMismatch = true;
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(frontend.locator('[data-value]')).toHaveText('Metadata mismatch');
  await expect(frontend.locator('[data-detail]')).toContainText('revisions disagree');
  releaseMismatch = false;

  raceHealthRequests = true;
  healthCalls = 0;
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(backend.locator('[data-value]')).toHaveText('Healthy');
  await page.waitForTimeout(350);
  await expect(backend.locator('[data-value]')).toHaveText('Healthy');
  raceHealthRequests = false;

  includeBackendIdentity = false;
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(backend.locator('[data-detail]')).toContainText('current identity is unverified');

  includeBackendIdentity = true;
  malformedBackendRunId = true;
  missingProtocol = true;
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(backend.locator('[data-detail]')).toContainText('Protocol · stable stay unknown, stay operations unknown');
  await expect(backend.locator('[data-detail]')).toContainText('current identity is unverified');
  malformedBackendRunId = false;
  missingProtocol = false;

  failBackendVersion = true;
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(backend.locator('[data-value]')).toHaveText('Health reachable · version check failed');
  await expect(backend.locator('[data-detail]')).toContainText('Cached prior observation');
  failBackendVersion = false;

  failManifest = true;
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(frontend.locator('[data-value]')).toHaveText('Cached · manifest read failed');
  // Finish the prior online refresh before measuring offline requests. Its
  // already-started read probes must not be mistaken for a new offline probe.
  await expect(page.locator('#aiCard [data-value]')).toHaveText('Healthy');
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }));
  const requestsBeforeOfflineRefresh = backendActions.length;
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(frontend.locator('[data-value]')).toHaveText('Cached · offline');
  await expect(backend.locator('[data-value]')).toHaveText('Cached · offline');
  expect(backendActions).toHaveLength(requestsBeforeOfflineRefresh);

  await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('waffleDeploymentManifestV1'));
    value.savedAt = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem('waffleDeploymentManifestV1', JSON.stringify(value));
  });
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(frontend.locator('[data-value]')).toHaveText('Stale cache · offline');
  await expect(frontend.locator('[data-detail]')).toContainText(frontendSha);
});

test('missing deployment metadata is unknown offline and unavailable after a failed online read', async ({ page }) => {
  await page.route('**/waffle-deployment.json*', route => route.fulfill({ status: 404, body: 'not found' }));
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }));
  await page.goto('/system-status.html');
  const frontend = page.locator('#frontendCard');
  await expect(frontend.locator('[data-value]')).toHaveText('Unknown · offline');
  expect(await page.evaluate(() => localStorage.getItem('waffleDeploymentManifestV1'))).toBeNull();
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }));
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(frontend.locator('[data-value]')).toHaveText('Unavailable');
});
