const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-profile-readiness.browser.spec.js',
  timeout: 30_000,
  use: { browserName: 'chromium', headless: true }
});
