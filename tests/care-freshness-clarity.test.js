const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const start = source.indexOf('function getDirectoryCareBriefFreshness(');
const end = source.indexOf('\n    function mergeDirectoryCareRecordWithServerTimestamp(', start);
assert.ok(start >= 0 && end > start);
const freshness = new Function(`${source.slice(start, end)}; return getDirectoryCareBriefFreshness;`)();
const record = { updatedAt: '2026-10-15T08:30:00.000Z', retrievedAt: '2026-10-17T12:00:00.000Z' };
const updated = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.updatedAt));

test('one Care indicator describes loading, refreshing, saved, offline and failed states truthfully', () => {
  assert.equal(freshness(null, 'loading', 'resolved').state, 'loading');
  assert.equal(freshness(record, 'refreshing', 'resolved').text, `Refreshing · saved record · updated ${updated}`);
  assert.equal(freshness(record, 'saved', 'resolved').text, `Saved record · updated ${updated}`);
  assert.equal(freshness(record, 'error', 'resolved', { offline: true, refreshFailed: true }).text, `Offline · refresh unavailable · saved record · updated ${updated}`);
  assert.equal(freshness(record, 'saved', 'resolved', { offline: true }).text, `Offline · saved record · updated ${updated}`);
});

test('read and cache ages never stand in for an unknown shared-record update time', () => {
  for (const unknown of [{ retrievedAt: '2026-10-17T12:00:00Z' }, { updatedAt: 'invalid date' }]) {
    assert.equal(freshness(unknown, 'saved', 'resolved').text, 'Saved record · update time unknown');
    assert.equal(freshness(unknown, 'refreshing', 'resolved').text, 'Refreshing · saved record · update time unknown');
    assert.equal(freshness(unknown, 'error', 'resolved').text, 'Refresh failed · saved record · update time unknown');
  }
});

test('not-found and identity-conflict remain distinct from saved or fresh records', () => {
  assert.deepEqual(freshness(null, 'not-found', 'missing'), { text: 'No saved care record', state: 'missing' });
  assert.deepEqual(freshness(record, 'identity-conflict', 'unresolved'), { text: 'Care record identity needs review', state: 'unresolved' });
});
