const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir:'./tests',testMatch:'home-first-open.spec.js',workers:1,timeout:30000,
  use:{browserName:'chromium',serviceWorkers:'allow'},reporter:'list'
});
