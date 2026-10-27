const { defineConfig } = require('@playwright/test');
const python = process.env.WAFFLE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
module.exports = defineConfig({
  testDir: './tests', testMatch: 'desktop-home-layout.browser.spec.js',
  timeout: 60000, workers: 1, reporter: 'list',
  use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:14475', timezoneId: 'Australia/Sydney', serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } },
  webServer: { command: `"${python}" -m http.server 14475 --bind 127.0.0.1`, url: 'http://127.0.0.1:14475/index.html', cwd: __dirname, reuseExistingServer: false, timeout: 10000, stdout: 'ignore', stderr: 'ignore' }
});
