const fs = require('fs');

const input = 'ui-regression-report.json';
const output = 'ui-regression-summary.md';

if (!fs.existsSync(input)) {
  fs.writeFileSync(output, '# Cross-device UI Regression\n\nNo Playwright JSON report was produced.\n');
  console.log(fs.readFileSync(output, 'utf8'));
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(input, 'utf8'));
const rows = [];

function cleanMessage(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\n\s*at\s+[\s\S]*/m, '')
    .replace(/\n+/g, ' · ')
    .replace(/\|/g, '\\|')
    .trim();
}

function walkSuite(suite) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const results = test.results || [];
      const last = results[results.length - 1] || {};
      const status = last.status || test.status || (spec.ok ? 'passed' : 'failed');
      const explanation = status === 'passed'
        ? 'All placement assertions passed.'
        : status === 'skipped'
          ? cleanMessage(test.annotations?.map(x => x.description).filter(Boolean).join('; ')) || 'Skipped by test conditions.'
          : cleanMessage(last.error?.message || last.errors?.map(x => x.message).join('; ') || 'See Playwright trace/log for failure details.');

      rows.push({
        project: test.projectName || 'unknown-project',
        test: spec.title,
        status,
        explanation
      });
    }
  }
  for (const child of suite.suites || []) walkSuite(child);
}

for (const suite of report.suites || []) walkSuite(suite);

const grouped = new Map();
for (const row of rows) {
  if (!grouped.has(row.project)) grouped.set(row.project, []);
  grouped.get(row.project).push(row);
}

const lines = ['# Cross-device UI Regression', ''];
let passedProjects = 0;
let failedProjects = 0;
let skippedProjects = 0;

for (const [project, tests] of grouped) {
  const failed = tests.filter(x => !['passed', 'skipped'].includes(x.status));
  const passed = tests.filter(x => x.status === 'passed');
  const skipped = tests.filter(x => x.status === 'skipped');
  let projectStatus = 'PASS';
  if (failed.length) projectStatus = 'FAIL';
  else if (!passed.length && skipped.length) projectStatus = 'SKIPPED';

  if (projectStatus === 'PASS') passedProjects += 1;
  else if (projectStatus === 'FAIL') failedProjects += 1;
  else skippedProjects += 1;

  lines.push(`## ${project} — ${projectStatus}`, '');
  lines.push('| Test | Result | Explanation |');
  lines.push('| --- | --- | --- |');
  for (const test of tests) {
    const result = test.status === 'passed' ? 'PASS' : test.status === 'skipped' ? 'SKIPPED' : 'FAIL';
    lines.push(`| ${test.test.replace(/\|/g, '\\|')} | ${result} | ${test.explanation || '—'} |`);
  }
  lines.push('');
}

lines.splice(2, 0,
  `**Device profiles:** ${grouped.size}  `,
  `**Passed:** ${passedProjects}  `,
  `**Failed:** ${failedProjects}  `,
  `**Skipped:** ${skippedProjects}`,
  ''
);

if (!rows.length) lines.push('No test cases were recorded.');

fs.writeFileSync(output, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
