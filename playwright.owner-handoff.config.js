const { defineConfig } = require('@playwright/test');

const python = process.env.WAFFLE_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const widths = [
  ['320', 320, 568],
  ['390', 390, 844],
  ['1440', 1440, 900]
];

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['owner-handoff.browser.spec.js', 'boarding-owner-handoff.browser.spec.js'],
  timeout: 30000,
  workers: 2,
  reporter: 'list',
  webServer: {
    command: `"${python}" -m http.server 4327 --bind 127.0.0.1`,
    cwd: __dirname,
    port: 4327,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'ignore',
    timeout: 10000
  },
  use: { baseURL: 'http://127.0.0.1:4327', timezoneId: 'Australia/Sydney', serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    ...widths.map(([name, width, height]) => ({ name: `chromium-${name}`, use: { browserName: 'chromium', viewport: { width, height } } })),
    ...widths.map(([name, width, height]) => ({ name: `webkit-${name}`, use: { browserName: 'webkit', viewport: { width, height } } }))
  ]
});
