const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', testMatch: 'care-future-arrivals-lazy.browser.spec.js', workers: 1,
  reporter: 'list', projects: [
    { name: 'chromium', use: { browserName: 'chromium', headless: true, viewport: { width: 320, height: 800 } } },
    { name: 'webkit', use: { browserName: 'webkit', headless: true, viewport: { width: 320, height: 800 } } }
  ]
});