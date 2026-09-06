const { defineConfig } = require('@playwright/test');

const BASE_URL = process.env.WAFFLE_BASE_URL || 'https://wafflepug.github.io/dog-calendar';

function mobileUse(browserName, viewport, userAgent) {
  return {
    browserName,
    viewport,
    screen: viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent
  };
}

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'ui-regression.spec.js',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['line'],
    ['json', { outputFile: 'ui-regression-report.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    actionTimeout: 12_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'desktop-chrome-1920x1080',
      metadata: { formFactor: 'desktop', mobileShell: false, coverage: 'Chrome-class desktop, wide' },
      use: { browserName: 'chromium', viewport: { width: 1920, height: 1080 } }
    },
    {
      name: 'laptop-chrome-1366x768',
      metadata: { formFactor: 'desktop', mobileShell: false, coverage: 'Common Windows laptop' },
      use: { browserName: 'chromium', viewport: { width: 1366, height: 768 } }
    },
    {
      name: 'desktop-firefox-1440x900',
      metadata: { formFactor: 'desktop', mobileShell: false, coverage: 'Firefox desktop' },
      use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'desktop-safari-1440x900',
      metadata: { formFactor: 'desktop', mobileShell: false, coverage: 'Safari/WebKit desktop' },
      use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'ipad-landscape-1180x820',
      metadata: { formFactor: 'tablet', mobileShell: false, coverage: 'Tablet landscape above mobile breakpoint' },
      use: mobileUse('webkit', { width: 1180, height: 820 }, 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
    },
    {
      name: 'ipad-portrait-820x1180',
      metadata: { formFactor: 'tablet', mobileShell: true, coverage: 'Tablet portrait at 820px breakpoint' },
      use: mobileUse('webkit', { width: 820, height: 1180 }, 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
    },
    {
      name: 'android-tablet-800x1280',
      metadata: { formFactor: 'tablet', mobileShell: true, coverage: 'Android tablet portrait' },
      use: mobileUse('chromium', { width: 800, height: 1280 }, 'Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36')
    },
    {
      name: 'iphone-se-375x667',
      metadata: { formFactor: 'mobile', mobileShell: true, coverage: 'Small iPhone/WebKit height constraint' },
      use: mobileUse('webkit', { width: 375, height: 667 }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
    },
    {
      name: 'iphone-pro-390x844',
      metadata: { formFactor: 'mobile', mobileShell: true, coverage: 'Modern iPhone/WebKit' },
      use: mobileUse('webkit', { width: 390, height: 844 }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
    },
    {
      name: 'android-small-360x800',
      metadata: { formFactor: 'mobile', mobileShell: true, coverage: 'Small Android/Chromium' },
      use: mobileUse('chromium', { width: 360, height: 800 }, 'Mozilla/5.0 (Linux; Android 15; Pixel) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36')
    },
    {
      name: 'android-large-412x915',
      metadata: { formFactor: 'mobile', mobileShell: true, coverage: 'Large Android/Chromium' },
      use: mobileUse('chromium', { width: 412, height: 915 }, 'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36')
    },
    {
      name: 'mobile-edge-320x568',
      metadata: { formFactor: 'mobile', mobileShell: true, coverage: 'Minimum supported narrow/short viewport edge case' },
      use: mobileUse('chromium', { width: 320, height: 568 }, 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36')
    }
  ]
});
