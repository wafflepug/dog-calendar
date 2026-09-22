const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-navigation-continuity.browser.spec.js',
  timeout: 45_000,
  workers: 1,
  webServer: { command: 'python -m http.server 4178 --bind 127.0.0.1', cwd: __dirname, port: 4178, reuseExistingServer: true, timeout: 10_000 },
  use: { baseURL: process.env.WAFFLE_BASE_URL || 'http://127.0.0.1:4178', headless: true, serviceWorkers: 'block' },
  projects: [
    { name: 'phone-light', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, colorScheme: 'light' } },
    { name: 'phone-dark-webkit', use: { browserName: 'webkit', viewport: { width: 375, height: 667 }, colorScheme: 'dark' } },
    { name: 'desktop-light', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, colorScheme: 'light' } }
  ]
});
