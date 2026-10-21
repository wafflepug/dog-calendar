const { defineConfig } = require('@playwright/test');
const python = process.env.WAFFLE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['care-arrival-ready.browser.spec.js', 'care-arrival-checkout-layout.browser.spec.js', 'care-future-arrivals-lazy.browser.spec.js', 'care-guest-card-clarity.browser.spec.js', 'booking-plan.browser.spec.js', 'booking-plan-runtime.browser.spec.js'],
  timeout: 90000,
  expect: { timeout: 12000 },
  workers: 2,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4361', serviceWorkers: 'block', timezoneId: 'Australia/Sydney', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: ['chromium', 'webkit'].flatMap(browserName => [
    { name: `${browserName}-320`, use: { browserName, viewport: { width: 320, height: 568 } } },
    { name: `${browserName}-390`, use: { browserName, viewport: { width: 390, height: 844 } } },
    { name: `${browserName}-1440`, use: { browserName, viewport: { width: 1440, height: 900 } } }
  ]),
  webServer: { command: `"${python}" -m http.server 4361 --bind 127.0.0.1`, url: 'http://127.0.0.1:4361/directory.html', cwd: __dirname, reuseExistingServer: false, timeout: 10000, stdout: 'ignore', stderr: 'ignore' }
});
