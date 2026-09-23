const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-roster.spec.js',
  timeout: 30000,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 }
  }
});
