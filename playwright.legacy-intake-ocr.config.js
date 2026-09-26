const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'legacy-intake-ocr.browser.spec.js',
  timeout: 30_000,
  workers: 1,
  reporter: 'line',
  use: { browserName: 'chromium', serviceWorkers: 'block' }
});
