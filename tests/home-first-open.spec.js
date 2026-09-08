const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
let server, origin;
const home = read('index.html');
const styleHref = home.match(/href="(waffle-runtime\.css[^\"]+)"/)[1].replaceAll('&amp;', '&');
const bootstrapSrc = home.match(/src="(waffle-bootstrap\.js[^\"]+)"/)[1].replaceAll('&amp;', '&');
const guest = '<a class="wh-home-guest"><span class="wh-home-portrait"><img alt="Guest" src="photo.svg"></span><strong>Coco</strong></a>';
// This worker deliberately remains on the old caching policy throughout the
// upgrade: fresh HTML, but an existing cached response wins for each asset URL.
const oldWorker = `self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')return;
e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));});`;
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/old-worker.js') { res.setHeader('Content-Type','application/javascript'); return res.end(oldWorker); }
    if (url.pathname === '/seed') { res.setHeader('Content-Type','text/html'); return res.end('<!doctype html><title>Previous release</title>'); }
    if (url.pathname === '/index.html' || url.pathname === '/legacy.html') {
      res.setHeader('Content-Type','text/html');
      const css = url.pathname === '/legacy.html' ? 'waffle-runtime.css?v=2026.08.28.01' : styleHref;
      const js = url.pathname === '/legacy.html' ? 'waffle-bootstrap.js?v=2026.08.28.01' : bootstrapSrc;
      return res.end(`<!doctype html><link rel="stylesheet" href="${css}"><script src="${js}"></script><div id="whHomeGuests">${guest}</div>`);
    }
    if (url.pathname === '/waffle-bootstrap.js') { res.setHeader('Content-Type','application/javascript'); return res.end('window.releaseAssetLoaded=true;'); }
    if (url.pathname === '/photo.svg') { res.setHeader('Content-Type','image/svg+xml'); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="purple"/></svg>'); }
    if (url.pathname.endsWith('.css')) {
      res.setHeader('Content-Type','text/css');
      return res.end(url.pathname === '/waffle-runtime.css' ? read('waffle-runtime.css') : '');
    }
    res.statusCode=404; res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin=`http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve));});
test('first visit after upgrade stays circular while the previous worker and cache remain active', async ({page})=>{
  await page.goto(origin+'/seed');
  await page.evaluate(async()=>{
    const cache=await caches.open('waffle-house-old-release');
    await cache.put('/waffle-runtime.css?v=2026.08.28.01',new Response('/* old CSS has no guest styles */',{headers:{'Content-Type':'text/css'}}));
    await cache.put('/waffle-bootstrap.js?v=2026.08.28.01',new Response('window.releaseAssetLoaded=false;',{headers:{'Content-Type':'application/javascript'}}));
    await navigator.serviceWorker.register('/old-worker.js');
    await navigator.serviceWorker.ready;
  });
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await page.goto(origin+'/legacy.html');
  expect(await page.locator('.wh-home-portrait').evaluate(el=>getComputedStyle(el).borderRadius)).toBe('0px');
  expect(await page.evaluate(()=>window.releaseAssetLoaded)).toBe(false);
  // Only one navigation to the new Home, no reload and no cache deletion.
  await page.goto(origin+'/index.html');
  await expect(page.getByRole('img',{name:'Guest'})).toBeVisible();
  const shape=await page.locator('.wh-home-portrait').evaluate(el=>({width:el.offsetWidth,height:el.offsetHeight,radius:getComputedStyle(el).borderRadius,imageWidth:el.querySelector('img').getBoundingClientRect().width}));
  expect(shape.radius).toBe('50%');
  expect(shape.width).toBe(shape.height);
  expect(shape.width).toBeLessThanOrEqual(100);
  expect(shape.imageWidth).toBeLessThanOrEqual(shape.width);
  expect(await page.evaluate(()=>window.releaseAssetLoaded)).toBe(true);
  expect(await page.evaluate(()=>caches.has('waffle-house-old-release'))).toBe(true);
});
test('entry pages and both script loaders share the release revision',()=>{
  const revision=read('waffle-bootstrap.js').match(/const ASSET_REVISION = '([^']+)'/)[1];
  for(const name of ['index.html','directory.html','reminders.html','audit.html']){
    const content=read(name);
    expect(content).toContain(`waffle-runtime.css?v=2026.08.28.01&amp;rev=${revision}`);
    expect(content).toContain(`waffle-bootstrap.js?v=2026.08.28.01&amp;rev=${revision}`);
  }
  expect(read('waffle-bootstrap.js')).toContain("'&rev=' + encodeURIComponent(ASSET_REVISION)");
  expect(read('waffle-v11.0.5.js')).toContain("'&rev=' + encodeURIComponent(String(window.WAFFLE_ASSET_REVISION");
  expect(read('waffle-runtime.css')).toContain(`waffle-app.css?build=2026.08.27.04&rev=${revision}`);
  expect(read('service-worker.js')).toContain(`waffle-runtime.css?v=2026.08.28.01&rev=${revision}`);
});
