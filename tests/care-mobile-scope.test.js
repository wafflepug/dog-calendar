const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Care clarity stylesheet cannot apply to Calendar or Today', () => {
  const css = read('care-mobile-clarity.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const groups = [...css.matchAll(/([^{}]+)\{/g)].map(match => match[1].trim()).filter(selector => !selector.startsWith('@'));
  assert.ok(groups.length > 20);
  for (const group of groups) for (const selector of group.split(/,(?![^()]*\))/)) {
    assert.ok(/^body(?:\.dark-theme)?\[data-waffle-page="directory"\]/.test(selector.trim()), selector);
  }
  assert.ok(!/@import|https?:|url\(/.test(css), 'No new remote assets or imports');
});

test('Only Care loads the clarity stylesheet', () => {
  assert.match(read('directory.html'), /href="care-mobile-clarity\.css\?rev=/);
  for (const page of ['index.html', 'audit.html', 'reminders.html']) assert.ok(!read(page).includes('care-mobile-clarity.css'), page);
  assert.ok(read('service-worker.js').includes('./care-mobile-clarity.css?rev='));
});
