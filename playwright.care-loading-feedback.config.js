const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-loading-feedback.browser.spec.js',
  timeout: 30_000,
  workers: 1,
  webServer: {
    command: 'python -m http.server 14474 --bind 127.0.0.1',
    cwd: __dirname,
    port: 14474,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000
  },
  use: {
    baseURL: 'http://127.0.0.1:14474',
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'block'
  }
});
