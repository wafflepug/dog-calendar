const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('waffle-bootstrap.js', 'utf8');
const start = source.indexOf('  const RUNTIME = [');
const end = source.indexOf('  const maintenanceUrl =', start);
test('sitter summary is loaded once for Care and adds no Calendar or Today runtime request', () => {
  assert.ok(start >= 0 && end > start);
  for (const page of ['directory', 'calendar', 'reminders', 'audit', undefined]) {
    const runtime = vm.runInNewContext(source.slice(start, end) + '\nRUNTIME;', {document: {body: {dataset: {wafflePage: page}}}});
    assert.equal(runtime.filter(file => file === 'care-sitter-summary.js').length, page === 'directory' ? 1 : 0);
  }
});
