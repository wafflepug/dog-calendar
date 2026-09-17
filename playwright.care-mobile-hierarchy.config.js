const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-mobile-hierarchy.browser.spec.js',
  timeout: 45_000,
  workers: 1,
  webServer: { command: 'python -m http.server 4177 --bind 127.0.0.1', cwd: __dirname, port: 4177, reuseExistingServer: false, timeout: 10_000 },
  use: { baseURL: process.env.WAFFLE_BASE_URL || 'http://127.0.0.1:4177', browserName: 'chromium', headless: true, serviceWorkers: 'block' }
});
