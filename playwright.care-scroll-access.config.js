const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-scroll-access.browser.spec.js',
  timeout: 60_000,
  workers: 2,
  webServer: {
    command: 'python -m http.server 47511 --bind 127.0.0.1',
    cwd: __dirname,
    port: 47511,
    reuseExistingServer: false,
    timeout: 10_000,
    stdout: 'ignore',
    stderr: 'ignore'
  },
  use: {
    baseURL: 'http://127.0.0.1:47511',
    serviceWorkers: 'block',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
});