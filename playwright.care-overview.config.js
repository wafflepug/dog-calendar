const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['care-booking-tools-layout.browser.spec.js', 'care-booking-tools-flow.browser.spec.js', 'care-booking-tools-focus.browser.spec.js', 'care-intake-readability.browser.spec.js', 'care-overview-refinement.browser.spec.js', 'care-photo-session.browser.spec.js', 'care-photos.browser.spec.js', 'care-photo-viewer.browser.spec.js', 'care-records-forms.browser.spec.js', 'care-contact-handover.browser.spec.js', 'system-status-sync.browser.spec.js', 'system-status-release.browser.spec.js', 'stable-stay-queue.browser.spec.js'],
  timeout: 30000,
  workers: 2,
  reporter: 'list',
  webServer: {
    command: 'python -m http.server 44972 --bind 127.0.0.1',
    cwd: __dirname,
    port: 44972,
    reuseExistingServer: !process.env.CI,
    timeout: 10000
  },
  use: { baseURL: 'http://127.0.0.1:44972', browserName: 'chromium', timezoneId: 'Australia/Sydney', serviceWorkers: 'block' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, colorScheme: 'light' } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, colorScheme: 'light' } },
    { name: 'iphone-webkit', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, colorScheme: 'light' } }
  ]
});
