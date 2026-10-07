const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-navigation-accessibility.browser.spec.js',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
  use: { browserName: 'chromium', headless: true }
});
