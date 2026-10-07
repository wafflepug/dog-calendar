const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-mobile-hierarchy.browser.spec.js',
  timeout: 60000,
  workers: 1,
  reporter: 'list',
  webServer: {
    command: 'python -m http.server 4192 --bind 127.0.0.1',
    cwd: __dirname,
    port: 4192,
    reuseExistingServer: false,
    timeout: 10000
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  use: { serviceWorkers: 'block', baseURL: 'http://127.0.0.1:4192' }
});
