const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-ui-polish.browser.spec.js',
  timeout: 30_000,
  workers: 2,
  reporter: 'list',
  webServer: { command: 'python -m http.server 4184 --bind 127.0.0.1', cwd: __dirname, port: 4184, reuseExistingServer: false, timeout: 10_000 },
  use: { baseURL: 'http://127.0.0.1:4184', browserName: 'chromium', headless: true, serviceWorkers: 'block' }
});
