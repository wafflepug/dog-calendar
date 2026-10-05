const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-operation-review.browser.spec.js',
  timeout: 60_000,
  workers: 1,
  webServer: { command: 'python -m http.server 4178 --bind 127.0.0.1', cwd: __dirname, port: 4178, reuseExistingServer: true, timeout: 10_000 },
  use: { baseURL: process.env.WAFFLE_BASE_URL || 'http://127.0.0.1:4178', headless: true, serviceWorkers: 'block' },
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { browserName: 'chromium', viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } }
  ]
});
