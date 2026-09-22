const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'waffle-app.css'), 'utf8');

test('Care navigation origin is captured once and restored after Back', () => {
  assert.match(app, /let directoryProfileNavigationOrigin = null/);
  assert.match(app, /captureDirectoryProfileNavigationOrigin\(card\)/);
  assert.match(app, /if \(directoryProfileNavigationOrigin\) return/);
  assert.match(app, /restoreDirectoryProfileNavigationOrigin\(options\)/);
  assert.match(app, /focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /requestAnimationFrame\(\(\) => window\.requestAnimationFrame/);
  assert.match(app, /const targetScroll = Math\.min\(requested, maxScroll\)/);
});

test('continuity does not add persistent storage or profile reads', () => {
  const helperStart = app.indexOf('function captureDirectoryProfileNavigationOrigin');
  const helperEnd = app.indexOf('function restoreDirectoryProfileNavigationOrigin', helperStart);
  const helper = app.slice(helperStart, helperEnd);
  assert.doesNotMatch(helper, /localStorage|sessionStorage|queryAppsScript|loadDirectory/);
});

test('profile tabs meet mobile touch and focus requirements', () => {
  const main = css.slice(css.indexOf('.directory-main-profile-tab {'), css.indexOf('.directory-main-profile-tab.is-active'));
  const sub = css.slice(css.indexOf('.directory-profile-subtab {'), css.indexOf('.directory-profile-subtab.is-active'));
  assert.match(main, /min-height:\s*44px/);
  assert.match(sub, /min-height:\s*44px/);
  assert.match(css, /\.directory-main-profile-tab:focus-visible/);
  assert.match(css, /\.directory-profile-subtab:focus-visible/);
});
