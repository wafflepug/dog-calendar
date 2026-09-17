'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { runLocalUi } = require('./run-local-ui');
function percentile(values, p) { const v = [...values].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.ceil(p * v.length) - 1)] ?? null; }
function mergeEvidence() {
  const dir = path.resolve('evidence');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => /^mobile-performance-raw-.*\.json$/.test(name)) : [];
  const runs = files.flatMap(file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')).runs);
  if (runs.length !== 24) throw new Error(`Expected 20 measured and 4 calibration runs; found ${runs.length}.`);
  const measured = runs.filter(r => r.kind === 'measured');
  const required = new Set(['today|iphone-pro-390x844', 'calendar|iphone-pro-390x844', 'today|android-large-412x915', 'calendar|android-large-412x915']);
  const actual = new Set(runs.map(r => `${r.page}|${r.project}`));
  if (actual.size !== required.size || [...required].some(key => !actual.has(key))) throw new Error(`Required baseline groups missing: ${[...required].filter(key => !actual.has(key)).join(', ')}`);
  const keys = runs.map(r => `${r.project}|${r.page}|${r.kind}|${r.repetition || 0}`);
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate baseline run identity detected.');
  for (const project of [...new Set(runs.map(r => r.project))]) for (const page of [...new Set(runs.map(r => r.page))]) {
    const group = runs.filter(r => r.project === project && r.page === page);
    if (group.filter(r => r.kind === 'calibration').length !== 1 || group.filter(r => r.kind === 'measured').length !== 5) throw new Error(`Incomplete group ${project}/${page}.`);
  }
  const groups = [...new Set(measured.map(r => `${r.page}|${r.project}`))].map(key => { const [page, project] = key.split('|'); const g = measured.filter(r => r.page === page && r.project === project); return { page, project, repetitions: g.length, readyMs: { median: percentile(g.map(r => r.readyMs), .5), p95: percentile(g.map(r => r.readyMs), .95) }, hydrationMs: { median: percentile(g.map(r => r.hydrationMs), .5), p95: percentile(g.map(r => r.hydrationMs), .95) }, totalMs: { median: percentile(g.map(r => r.totalMs), .5), p95: percentile(g.map(r => r.totalMs), .95) }, mutationRecords: { median: percentile(g.map(r => r.mutationRecords), .5), p95: percentile(g.map(r => r.mutationRecords), .95) }, rafCallbacks: { median: percentile(g.map(r => r.rafCallbacks), .5), p95: percentile(g.map(r => r.rafCallbacks), .95) } }; });
  fs.writeFileSync(path.join(dir, 'mobile-performance-raw.json'), JSON.stringify({ schema: 'mobile-performance-baseline/v1', fixture: 'tests/fixtures/mobile-baseline-data.js', runs }, null, 2));
  const calibrations = runs.filter(r => r.kind === 'calibration');
  const calibrationComparison = calibrations.map(c => { const g = measured.filter(r => r.page === c.page && r.project === c.project); return { page: c.page, project: c.project, calibration: { readyMs: c.readyMs, hydrationMs: c.hydrationMs, scrollDurationMs: c.scroll.duration }, measuredMedian: { readyMs: percentile(g.map(r => r.readyMs), .5), hydrationMs: percentile(g.map(r => r.hydrationMs), .5), scrollDurationMs: percentile(g.map(r => r.scroll.duration), .5) }, harnessOverhead: 'Displayed side-by-side; no subtraction or device-level improvement claim.' }; });
  fs.writeFileSync(path.join(dir, 'mobile-performance-summary.json'), JSON.stringify({ schema: 'mobile-performance-baseline/v1', fixedApplicationDate: '2026-09-17T12:00:00.000Z', measuredRuns: measured.length, calibrationRuns: calibrations.length, calibrationPurpose: 'matched counters-disabled harness runs; overhead is reported and never subtracted', unsupportedMetrics: ['longtask is unavailable in WebKit when absent', 'layout-shift is not collected'], groups, calibrationComparison }, null, 2));
}
if (fs.existsSync(path.resolve('evidence'))) {
  for (const name of fs.readdirSync(path.resolve('evidence'))) if (/^mobile-performance-(?:raw|summary).*\.json$/.test(name)) fs.unlinkSync(path.join(path.resolve('evidence'), name));
}
runLocalUi({ config: 'playwright.mobile-performance.config.js' })
  .then(code => { if (code === 0) mergeEvidence(); process.exitCode = code; })
  .catch(error => { console.error(`Mobile performance runner failed: ${error.message}`); process.exitCode = 1; });
