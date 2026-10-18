const { defineConfig } = require('@playwright/test');
const python = process.env.WAFFLE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const sizes = [['320', 320, 568], ['390', 390, 844], ['1440', 1440, 900]];
module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['care-arrival-ready.browser.spec.js', 'care-intake-status.browser.spec.js', 'guided-checkout.browser.spec.js', 'care-arrival-checkout-layout.browser.spec.js'],
  timeout: 45000, expect: { timeout: 10000 }, workers: 2, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4342', serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: ['chromium', 'webkit'].flatMap(browserName => sizes.map(([name, width, height]) => ({ name: `${browserName}-${name}`, use: { browserName, viewport: { width, height } } }))),
  webServer: { command: `"${python}" -m http.server 4342 --bind 127.0.0.1`, url: 'http://127.0.0.1:4342/directory.html', cwd: __dirname, reuseExistingServer: false, timeout: 10000, stdout: 'ignore', stderr: 'ignore' }
});
