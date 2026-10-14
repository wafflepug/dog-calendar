const { defineConfig } = require('@playwright/test');
const python = process.env.WAFFLE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['care-source-compact.browser.spec.js', 'care-past-records-compact.browser.spec.js', 'care-record-dialog-readability.browser.spec.js'],
  timeout: 90000,
  expect: { timeout: 12000 },
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4187', headless: true, serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  webServer: {
    command: `"${python}" -m http.server 4187 --bind 127.0.0.1`,
    url: 'http://127.0.0.1:4187/directory.html',
    cwd: __dirname,
    reuseExistingServer: false,
    timeout: 10000,
    stdout: 'ignore',
    stderr: 'ignore'
  }
});
