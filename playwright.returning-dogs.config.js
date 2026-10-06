const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'returning-dog-inheritance.spec.js',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: { browserName: 'chromium', headless: true, viewport: { width: 1280, height: 900 } }
});