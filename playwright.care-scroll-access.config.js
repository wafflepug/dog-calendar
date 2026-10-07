const { defineConfig } = require('@playwright/test');
const port = Number(process.env.CARE_SCROLL_ACCESS_PORT || 47511);
module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'care-scroll-access.browser.spec.js',
  timeout: 60_000,
  workers: 2,
  webServer: {
    command: `python -m http.server ${port} --bind 127.0.0.1`,
    cwd: __dirname,
    port,
    reuseExistingServer: false,
    timeout: 10_000,
    stdout: 'ignore',
    stderr: 'ignore'
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    serviceWorkers: 'block',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
});
