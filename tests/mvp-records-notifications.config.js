const { defineConfig } = require('@playwright/test');
const path = require('node:path');
const python = process.env.WAFFLE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const port = 44972;
const baseURL = process.env.WAFFLE_BASE_URL || `http://127.0.0.1:${port}`;
const config = {
  testDir: '..',
  testMatch: ['tests/mvp-records-notifications.browser.spec.js', 'tests/care-records-forms.browser.spec.js'],
  outputDir: '../test-results/mvp-records-notifications',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', headless: true, serviceWorkers: 'block' } },
    { name: 'webkit', use: { browserName: 'webkit', headless: true, serviceWorkers: 'block' } }
  ],
  use: { baseURL, serviceWorkers: 'block' }
};
if (!process.env.WAFFLE_BASE_URL) {
  config.webServer = {
    command: `"${python}" -m http.server ${port} --bind 127.0.0.1`,
    cwd: path.resolve(__dirname, '..'),
    port,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 10_000
  };
}
module.exports = defineConfig(config);
