const { test, expect } = require('@playwright/test');

async function seedStatusStorage(page) {
  await page.route('http://127.0.0.1:44972/__status-seed.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Fixture seed</title>' }));
  await page.goto('/__status-seed.html');
  await page.evaluate(async () => {
    const open = (name, storeName, keyPath) => new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const responses = await open('waffle-house-v83', 'responses', 'key');
    await new Promise((resolve, reject) => {
      const tx = responses.transaction('responses', 'readwrite');
      tx.objectStore('responses').put({ key: 'directory:summary', savedAt: Date.now(), version: 'directory-v1', payload: { result: 'success', records: [] } });
      tx.objectStore('responses').put({ key: 'directory:stay-operations', savedAt: Date.now(), version: 'directory-v1', payload: { result: 'success', records: [] } });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    responses.close();
    const queue = await open('waffle-house-v108-writes', 'mutations', 'id');
    await new Promise((resolve, reject) => {
      const tx = queue.transaction('mutations', 'readwrite');
      tx.objectStore('mutations').put({ id: 'pending-1', status: 'queued', payload: { ownerName: 'SENTINEL_PRIVATE_GUEST' } });
      tx.objectStore('mutations').put({ id: 'pending-2', status: 'conflict', payload: { phone: 'SENTINEL_PRIVATE_PHONE' } });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    queue.close();
    localStorage.setItem('waffleSyncMetadataV1', JSON.stringify({
      boarding: { source: 'spreadsheet', lastAttemptAt: Date.now(), lastAttemptResult: 'success', lastSuccessAt: Date.now() - 60000 },
      operations: { source: 'stay-operations', lastAttemptAt: Date.now(), lastAttemptResult: 'success', lastSuccessAt: Date.now() - 60000 }
    }));
  });
}

test('System Status shows truthful local sync states and refresh stays read-only', async ({ page }) => {
  await seedStatusStorage(page);
  const actions = [];
  let remoteVersion = 'directory-v1';
  let failVersionCheck = false;
  await page.route('https://script.google.com/**', async route => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || (() => {
      try { return JSON.parse(url.searchParams.get('payload') || '{}').action || ''; } catch (_) { return ''; }
    })();
    actions.push(action);
    if (route.request().method() !== 'GET') return route.fulfill({ status: 405, body: 'Read-only status fixture' });
    const callback = url.searchParams.get('callback');
    if (!callback) return route.fulfill({ status: 400, body: 'Expected JSONP callback' });
    if (!['maintenance_status', 'health', 'waffle_ai_health', 'get_data_versions'].includes(action)) {
      return route.fulfill({ status: 403, body: 'Unexpected or mutating request' });
    }
    const data = action === 'get_data_versions'
      ? (failVersionCheck ? { result: 'error' } : { result: 'success', versions: { directory: remoteVersion } })
      : action === 'waffle_ai_health' ? { result: 'success', routeReady: true } : { result: 'success', enabled: false };
    return route.fulfill({ contentType: 'application/javascript', body: `${callback}(${JSON.stringify(data)});` });
  });

  await page.goto('/system-status.html');
  const boarding = page.locator('#boardingSyncCard');
  const operations = page.locator('#operationsSyncCard');
  const pending = page.locator('#pendingSyncCard');
  await expect(boarding).toHaveAttribute('data-sync-state', 'synced');
  await expect(operations).toHaveAttribute('data-sync-state', 'synced');
  await expect(pending.locator('[data-value]')).toHaveText('2 pending');
  await expect(page.locator('body')).not.toContainText('SENTINEL_PRIVATE_GUEST');
  await expect(page.locator('body')).not.toContainText('SENTINEL_PRIVATE_PHONE');

  const themeBackgrounds = [];
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    themeBackgrounds.push(await page.locator('html').evaluate(element => getComputedStyle(element).backgroundColor));
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(dimensions.scroll, `${colorScheme} at ${width}px should not overflow horizontally`).toBeLessThanOrEqual(dimensions.client);
      const buttonHeight = await page.getByRole('button', { name: 'Refresh checks' }).evaluate(element => element.getBoundingClientRect().height);
      expect(buttonHeight).toBeGreaterThanOrEqual(44);
    }
  }
  expect(themeBackgrounds[0]).not.toBe(themeBackgrounds[1]);

  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }));
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(boarding).toHaveAttribute('data-sync-state', 'cached-offline');
  await expect(operations).toHaveAttribute('data-sync-state', 'cached-offline');

  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }));
  failVersionCheck = true;
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(operations).toHaveAttribute('data-sync-state', 'failed');
  await expect(operations.locator('[data-value]')).toHaveText('Failed to verify');
  await expect(operations.locator('[data-detail]')).toContainText('Last successful stay-operations response');

  const metadata = await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('waffleSyncMetadataV1'));
    value.boarding.lastAttemptResult = 'failed';
    localStorage.setItem('waffleSyncMetadataV1', JSON.stringify(value));
    return true;
  });
  expect(metadata).toBe(true);
  failVersionCheck = false;
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(boarding).toHaveAttribute('data-sync-state', 'failed');
  await expect(boarding.locator('[data-detail]')).toContainText('Spreadsheet last successful read');
  expect(actions.every(action => ['maintenance_status', 'health', 'waffle_ai_health', 'get_data_versions'].includes(action))).toBe(true);
});

test('System Status reports unknown without a recorded spreadsheet read and isolates storage failure', async ({ page }) => {
  await seedStatusStorage(page);
  await page.route('https://script.google.com/**', async route => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const callback = url.searchParams.get('callback');
    const result = action === 'get_data_versions' ? { result: 'success', versions: { directory: 'directory-v1' } } : { result: 'success', enabled: false };
    return route.fulfill({ contentType: 'application/javascript', body: `${callback}(${JSON.stringify(result)});` });
  });
  await page.goto('/system-status.html');
  await page.evaluate(() => localStorage.removeItem('waffleSyncMetadataV1'));
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(page.locator('#boardingSyncCard')).toHaveAttribute('data-sync-state', 'unknown');
  await expect(page.locator('#operationsSyncCard')).toHaveAttribute('data-sync-state', 'synced');

  await page.evaluate(() => Object.defineProperty(indexedDB, 'databases', { configurable: true, value: () => Promise.reject(new Error('Simulated local database failure')) }));
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(page.locator('#boardingSyncCard')).toHaveAttribute('data-sync-state', 'unknown');
  await expect(page.locator('#operationsSyncCard')).toHaveAttribute('data-sync-state', 'storage-unavailable');
  await expect(page.locator('#pendingSyncCard')).toHaveAttribute('data-sync-state', 'unavailable');
});

test('spreadsheet metadata and queue count remain available when the response store fails', async ({ page }) => {
  await seedStatusStorage(page);
  await page.route('https://script.google.com/**', async route => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || '';
    const callback = url.searchParams.get('callback');
    const result = action === 'get_data_versions' ? { result: 'success', versions: { directory: 'directory-v1' } } : { result: 'success', enabled: false };
    return route.fulfill({ contentType: 'application/javascript', body: `${callback}(${JSON.stringify(result)});` });
  });
  await page.goto('/system-status.html');
  await expect(page.locator('#boardingSyncCard')).toHaveAttribute('data-sync-state', 'synced');
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('waffle-house-v83', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains('responses')) db.deleteObjectStore('responses');
      db.createObjectStore('unexpected-store', { keyPath: 'key' });
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  }));
  await page.getByRole('button', { name: 'Refresh checks' }).click();
  await expect(page.locator('#boardingSyncCard')).toHaveAttribute('data-sync-state', 'synced');
  await expect(page.locator('#operationsSyncCard')).toHaveAttribute('data-sync-state', 'storage-unavailable');
  await expect(page.locator('#pendingSyncCard').locator('[data-value]')).toHaveText('2 pending');
});
