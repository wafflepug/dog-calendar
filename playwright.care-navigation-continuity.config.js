const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['care-navigation-continuity.browser.spec.js', 'care-future-arrivals-lazy.browser.spec.js'],
  timeout: 45_000,
  workers: 1,
  webServer: { command: 'python -m http.server 4182 --bind 127.0.0.1', cwd: __dirname, port: 4182, reuseExistingServer: false, timeout: 10_000, stdout: 'ignore', stderr: 'ignore' },
  use: { baseURL: 'http://127.0.0.1:4182', headless: true, serviceWorkers: 'block' },
  projects: [
    { name: 'phone-light', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, colorScheme: 'light' } },
    { name: 'phone-dark-webkit', use: { browserName: 'webkit', viewport: { width: 375, height: 667 }, colorScheme: 'dark' } },
    { name: 'desktop-light', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, colorScheme: 'light' } }
  ]
});
