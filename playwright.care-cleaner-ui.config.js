const { defineConfig } = require('@playwright/test');
const python = process.env.WAFFLE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-cleaner-ui.browser.spec.js',
  timeout: 90_000,
  workers: 2,
  reporter: 'list',
  outputDir: 'test-results/care-cleaner-ui',
  webServer: { command: `"${python}" -m http.server 4189 --bind 127.0.0.1`, cwd: __dirname, port: 4189, reuseExistingServer: true, timeout: 10_000 },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', headless: true } },
    { name: 'webkit', use: { browserName: 'webkit', headless: true } }
  ],
  use: { baseURL: 'http://127.0.0.1:4189', serviceWorkers: 'block' }
});
