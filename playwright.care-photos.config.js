const { defineConfig } = require('@playwright/test');
const base = require('./playwright.ui.config');

module.exports = defineConfig({
  ...base,
  testMatch: 'care-photos.browser.spec.js',
  workers: 1,
  reporter: 'line',
  projects: [base.projects.find(project => project.name === 'desktop-chrome-1920x1080')]
});
