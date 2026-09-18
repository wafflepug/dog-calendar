const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-loading-feedback.browser.spec.js',
  timeout: 30_000,
  workers: 1,
  webServer: {
    command: 'python -m http.server 44972 --bind 127.0.0.1',
    cwd: __dirname,
    port: 44972,
    reuseExistingServer: false,
    timeout: 10_000
  },
  use: {
    baseURL: 'http://127.0.0.1:44972',
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'block'
  }
});
