const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'mobile-navigation-observer.spec.js',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  outputDir: './test-results/mvp-mobile-observer/playwright-output',
  use: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    serviceWorkers: 'block'
  },
  projects: [
    { name: 'chromium-mobile', use: { browserName: 'chromium' } },
    { name: 'webkit-mobile', use: { browserName: 'webkit' } }
  ]
});
