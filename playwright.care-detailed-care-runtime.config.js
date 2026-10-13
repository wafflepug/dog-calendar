const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-detailed-care-runtime.browser.spec.js',
  timeout: 90000,
  workers: 1,
  reporter: 'list',
  webServer: {
    command: `${process.platform === 'win32' ? 'python' : 'python3'} -m http.server 4176 --bind 127.0.0.1`,
    url: 'http://127.0.0.1:4176/directory.html',
    cwd: __dirname,
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
    stdout: 'ignore',
    stderr: 'ignore'
  },
  use: { browserName: 'chromium', headless: true, serviceWorkers: 'block' }
});
