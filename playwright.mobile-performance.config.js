const { defineConfig } = require('@playwright/test');

const baseURL = process.env.WAFFLE_BASE_URL || 'http://127.0.0.1:4173';
const mobile = (browserName, width, height, userAgent) => ({
  browserName, viewport: { width, height }, screen: { width, height }, isMobile: true,
  hasTouch: true, deviceScaleFactor: 2, userAgent
});

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'mobile-performance-baseline.spec.js',
  timeout: 300_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line'], ['json', { outputFile: 'evidence/mobile-performance-playwright.json' }]],
  use: { baseURL, ignoreHTTPSErrors: true, serviceWorkers: 'block', actionTimeout: 15_000, navigationTimeout: 30_000 },
  projects: [
    { name: 'iphone-pro-390x844', metadata: { browser: 'webkit', viewport: '390x844' }, use: mobile('webkit', 390, 844, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1') },
    { name: 'android-large-412x915', metadata: { browser: 'chromium', viewport: '412x915' }, use: mobile('chromium', 412, 915, 'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36') }
  ]
});
