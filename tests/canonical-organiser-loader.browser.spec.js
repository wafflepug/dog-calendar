const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(process.cwd());
const loaderSource = fs.readFileSync(path.join(root, 'waffle-v11.1.14.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

let server;
let origin;

function contentType(file) {
  const extension = path.extname(file).toLowerCase();
  return ({
    '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
  })[extension] || 'application/octet-stream';
}

test.beforeAll(async () => {
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch (_) { response.writeHead(400).end(); return; }
    if (pathname === '/') pathname = '/index.html';
    if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }

    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test('V11.1.14 no longer contains a legacy organiser or downstream loader tail', async ({ page }) => {
  expect(loaderSource).not.toMatch(/waffle-v11\.1\.15\.(?:js|css)/);
  expect(loaderSource).not.toContain('waffle-v11.1.16.js');
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ content: loaderSource });
  expect(await page.evaluate(() => window.__WAFFLE_V1114_TAIL_STARTED)).toBeUndefined();
});

test('all four full pages settle with only successful local asset requests and one canonical Reminders organiser', async ({ browser }) => {
  test.setTimeout(45000);
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const results = await Promise.all(['index.html', 'directory.html', 'reminders.html', 'audit.html'].map(async file => {
    const page = await context.newPage();
    const localResponses = [];
    const localRequests = [];
    const externalActions = [];
    const pageOrigin = origin;
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === pageOrigin) {
        localRequests.push(url.href);
        return route.continue();
      }

      // The Apps Script maintenance/data endpoints are synthetic in this
      // smoke test. No request leaves the local test browser.
      const callback = url.searchParams.get('callback');
      const payload = url.searchParams.get('payload');
      if (payload) {
        try { externalActions.push(JSON.parse(payload).action || ''); } catch (_) {}
      }
      const body = callback ? `${callback}({"result":"success","data":{}});` : '{}';
      return route.fulfill({ status: 200, contentType: callback ? 'application/javascript' : 'application/json', body });
    });
    page.on('response', response => {
      if (new URL(response.url()).origin === pageOrigin) {
        localResponses.push({ url: response.url(), status: response.status() });
      }
    });
    await page.goto(`${origin}/${file}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6500);

    const pageName = await page.locator('body').getAttribute('data-waffle-page');
    const organiserCount = await page.locator('script[src*="organiser.js"]').count();
    const organiserCssCount = await page.locator('link[data-waffle-organiser-canonical-style]').count();
    const organiserCssLinkCount = await page.locator('link[href*="organiser.css"]').count();
    const organiserScriptUrl = organiserCount ? await page.locator('script[src*="organiser.js"]').evaluate(element => element.src) : null;
    const organiserCssUrl = organiserCssCount ? await page.locator('link[data-waffle-organiser-canonical-style]').evaluate(element => element.href) : null;
    const rootCount = await page.locator('#v11115OrganiserRoot').count();
    const hasManifest = await page.evaluate(() => window.WAFFLE_ORGANISER_CANONICAL?.module === 'organiser.js');
    await page.close();
    return { file, pageName, localRequests, localResponses, externalActions, organiserCount, organiserCssCount, organiserCssLinkCount, organiserScriptUrl, organiserCssUrl, rootCount, hasManifest };
  }));
  await context.close();

  const failures = results.flatMap(result => result.localResponses
    .filter(response => response.status < 200 || response.status >= 400)
    .map(response => `${result.file}: ${response.status} ${response.url}`));
  const legacyRequests = results.flatMap(result => result.localRequests
    .filter(url => /waffle-v11\.1\.15\.(?:js|css)(?:\?|$)/.test(new URL(url).pathname + new URL(url).search))
    .map(url => `${result.file}: ${url}`));
  const retiredTailRequests = results.flatMap(result => result.localRequests
    .filter(url => /waffle-v11\.1\.(?:16|17|18|19|20|21)\.(?:js|css)(?:\?|$)/.test(new URL(url).pathname + new URL(url).search))
    .map(url => `${result.file}: ${url}`));
  expect(failures).toEqual([]);
  expect(legacyRequests).toEqual([]);
  expect(retiredTailRequests).toEqual([]);

  const reminders = results.find(result => result.file === 'reminders.html');
  expect(reminders.organiserCount).toBe(1);
  expect(reminders.organiserCssCount).toBe(1);
  expect(reminders.organiserCssLinkCount).toBe(1);
  expect(reminders.rootCount).toBe(1);
  expect(reminders.hasManifest).toBe(true);
  const cssUrl = new URL(reminders.organiserCssUrl, origin);
  expect(cssUrl.search).toBe('?build=2026.08.28.01');
  expect(workerSource).toContain("'./organiser.css?build=2026.08.28.01'");
  const scriptUrl = new URL(reminders.organiserScriptUrl, origin);
  expect(scriptUrl.pathname).toBe('/organiser.js');
  expect(scriptUrl.search).toBe('?build=2026.08.28.01');
  expect(workerSource).toContain("'./organiser.js?build=2026.08.28.01'");
  expect(reminders.externalActions.filter(action => action === 'get_organiser')).toHaveLength(1);
  expect(reminders.externalActions.filter(action => action === 'get_guest_directory')).toHaveLength(1);
  for (const page of results.filter(result => result.file !== 'reminders.html')) {
    expect(page.organiserCount, page.file).toBe(0);
    expect(page.organiserCssCount, page.file).toBe(0);
    expect(page.organiserCssLinkCount, page.file).toBe(0);
    expect(page.rootCount, page.file).toBe(0);
    expect(page.hasManifest, page.file).toBe(false);
  }
});
