const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-overview-refinement.browser.spec.js',
  timeout: 30000,
  workers: 2,
  reporter: 'list',
  use: { browserName: 'chromium', timezoneId: 'Australia/Sydney', serviceWorkers: 'block' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, colorScheme: 'light' } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, colorScheme: 'light' } },
    { name: 'iphone-webkit', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, colorScheme: 'light' } }
  ]
});
