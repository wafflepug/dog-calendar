const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-profile-read-timing.browser.spec.js',
  timeout: 60000,
  workers: 1,
  reporter: 'list',
  webServer: {
    command: `${process.platform === 'win32' ? 'python' : 'python3'} -m http.server 4176 --bind 127.0.0.1`,
    url: 'http://127.0.0.1:4176/directory.html',
    cwd: __dirname,
    reuseExistingServer: false
  },
  use: { browserName: 'chromium', serviceWorkers: 'block' }
});



