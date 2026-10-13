const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const harness = fs.readFileSync('scripts/test-apps-script/CareRecordIdentitySyntheticHarness.js', 'utf8');
const rollout = fs.readFileSync('docs/care-record-identity-synthetic-google-rollout.md', 'utf8');
const backendSource = fs.readFileSync('apps-script/Code.js', 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing function ${name}`);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next < 0 ? source.length : next).replace(/\r\n/g, '\n').trim();
}

test('Google identity harness gates all fixture access on explicit synthetic targets', () => {
  const guardStart = harness.indexOf('function careIdentityTestAssertSafeTarget_');
  const guardEnd = harness.indexOf('\nfunction careIdentityTestPrepareSheets_', guardStart);
  assert.ok(guardStart >= 0 && guardEnd > guardStart);
  const guard = harness.slice(guardStart, guardEnd);
  assert.match(guard, /spreadsheetId/);
  assert.match(guard, /scriptId/);
  assert.match(guard, /productionSpreadsheetIds/);
  assert.match(guard, /markerValue/);
  assert.match(guard, /Pet_Belongings/);
  assert.match(harness, /careIdentitySyntheticRun/);
  assert.match(harness, /careIdentitySyntheticCleanup/);
  assert.match(harness, /indexOf\(CARE_ID_TEST_PREFIX_\) === 0/);
});

test('Google identity harness covers the rollout schema and identity risk cases', () => {
  for (const contract of [
    'default-off write keeps 34 columns',
    'opt-in appends exactly Stay ID and Dog ID',
    'turning enrollment off preserves the 36-column schema',
    'proven write persists both IDs and preserves other Care values',
    'disabled writes preserve existing persisted IDs',
    'one Dog ID may own multiple distinct stays',
    'duplicate booking keys and duplicate Care keys fail closed',
    'unknown extra columns are rejected',
    'stored identity conflicts are rejected',
    'name/date carry-forward follows the proven synthetic Stay ID',
    'reads leave headers and values unchanged'
  ]) assert.ok(harness.includes(contract), `Missing harness case: ${contract}`);
  assert.match(rollout, /Do not copy the production spreadsheet or any production data/);
  assert.match(rollout, /does not establish a production deployment/);
  assert.equal(extractFunction(harness, 'migrateBelongingsIdentityForGuest_'), extractFunction(backendSource, 'migrateBelongingsIdentityForGuest_'));
});

class MockSheet {
  constructor(name, parent, maxColumns = 26) { this.name = name; this.parent = parent; this.maxColumns = maxColumns; this.rows = []; }
  getName() { return this.name; }
  getParent() { return this.parent; }
  getMaxColumns() { return this.maxColumns; }
  getLastRow() { for (let i = this.rows.length - 1; i >= 0; i--) if (this.rows[i].some(v => v !== '' && v !== null && v !== undefined)) return i + 1; return 0; }
  getLastColumn() { let max = 0; for (const row of this.rows) for (let i = row.length - 1; i >= 0; i--) if (row[i] !== '' && row[i] !== null && row[i] !== undefined) { max = Math.max(max, i + 1); break; } return max; }
  getRange(r, c, n = 1, w = 1) {
    if (typeof r === 'string') {
      const match = r.match(/^([A-Z]+)(\d+)$/i);
      assert.ok(match, `Unsupported mock A1 range ${r}`);
      c = 0; for (const ch of match[1].toUpperCase()) c = c * 26 + ch.charCodeAt(0) - 64;
      r = Number(match[2]); n = 1; w = 1;
    }
    return new MockRange(this, r, c, n, w);
  }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  clear() { this.rows = []; return this; }
  insertColumnsAfter(_after, count = 1) { this.maxColumns += count; }
  insertColumnAfter(_after) { this.maxColumns += 1; }
  appendRow(row) { this.getRange(this.getLastRow() + 1, 1, 1, row.length).setValues([row]); }
}

class MockRange {
  constructor(sheet, row, col, height, width) { Object.assign(this, { sheet, row, col, height, width }); }
  getValues() { return Array.from({ length: this.height }, (_, ri) => Array.from({ length: this.width }, (_, ci) => this.sheet.rows[this.row - 1 + ri]?.[this.col - 1 + ci] ?? '')); }
  getFormulas() { return Array.from({ length: this.height }, () => Array(this.width).fill('')); }
  setValues(values) { values.forEach((vals, ri) => vals.forEach((v, ci) => this.setCell(this.row - 1 + ri, this.col - 1 + ci, v))); }
  setValue(value) { this.setCell(this.row - 1, this.col - 1, value); }
  getValue() { return this.getValues()[0][0]; }
  getDisplayValue() { return String(this.getValue()); }
  setCell(r, c, value) {
    if (this.sheet.name === '__CARE_ID_TEST_BOOKINGS__' && (c === 3 || c === 4) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      value = new Date(Date.UTC(year, month - 1, day));
    }
    while (this.sheet.rows.length <= r) this.sheet.rows.push([]);
    while (this.sheet.rows[r].length <= c) this.sheet.rows[r].push('');
    this.sheet.rows[r][c] = value;
  }
}

function runHarness({ projectId = 'synthetic-script-id', spreadsheetId = 'synthetic-sheet-id', initialProperties = {} } = {}) {
  const spreadsheet = {
    id: spreadsheetId,
    sheets: [],
    getId() { return this.id; },
    getSheets() { return this.sheets.slice(); },
    getSheetByName(name) { return this.sheets.find(s => s.name === name) || null; },
    insertSheet(name) { const s = new MockSheet(name, this); this.sheets.push(s); return s; },
    deleteSheet(sheet) { this.sheets = this.sheets.filter(s => s !== sheet); }
  };
  const marker = spreadsheet.insertSheet('__CARE_ID_TEST_CONTROL__');
  marker.getRange(1, 1).setValue('CARE_IDENTITY_TEST_ONLY:v1');
  const properties = new Map(Object.entries(initialProperties));
  const scriptProperties = {
    getProperty: key => properties.get(key) || null,
    setProperty: (key, value) => { properties.set(key, String(value)); },
    deleteProperty: key => { properties.delete(key); },
    getProperties: () => Object.fromEntries(properties)
  };
  const sandbox = {
    SpreadsheetApp: { openById: id => { assert.equal(id, spreadsheetId); return spreadsheet; } },
    ScriptApp: { getScriptId: () => projectId },
    PropertiesService: { getScriptProperties: () => scriptProperties },
    Logger: { log() {} },
    Utilities: { formatDate(date, zone) {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
      const part = type => parts.find(p => p.type === type).value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    } },
    Session: { getScriptTimeZone: () => 'Australia/Sydney' },
    Date, console
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('apps-script/CareRecordIdentity.js', 'utf8') + '\n' + harness, sandbox);
  sandbox.CARE_ID_TEST_CONFIG_ = {
    spreadsheetId, scriptId: 'synthetic-script-id',
    productionSpreadsheetIds: ['known-production-spreadsheet-id'],
    markerSheet: '__CARE_ID_TEST_CONTROL__', markerCell: 'A1', markerValue: 'CARE_IDENTITY_TEST_ONLY:v1',
    bookingSheet: '__CARE_ID_TEST_BOOKINGS__', careSheet: '__CARE_ID_TEST_CARE__'
  };
  return { sandbox, spreadsheet, properties };
}

test('full Apps Script harness runs against bounded mock Sheets and leaves enrollment disabled', () => {
  const { sandbox, spreadsheet, properties } = runHarness({ initialProperties: { BELONGINGS_SHEET_NAME: 'preexisting-test-adapter-tab' } });
  assert.equal(spreadsheet.getSheetByName('__CARE_ID_TEST_CONTROL__').getRange(1, 1).getDisplayValue(), 'CARE_IDENTITY_TEST_ONLY:v1');
  assert.equal(sandbox.CARE_ID_TEST_CONFIG_.markerValue, 'CARE_IDENTITY_TEST_ONLY:v1');
  const report = sandbox.careIdentitySyntheticRun();
  assert.equal(report.result, 'PASS', JSON.stringify(report.cases.filter(c => !c.ok)));
  assert.equal(report.enrollmentHeaders.join('/'), '34/36/36');
  assert.ok(report.cases.every(c => c.ok), JSON.stringify(report.cases));
  assert.ok(spreadsheet.getSheetByName('__CARE_ID_TEST_BOOKINGS__').getRange(2, 4).getValue() instanceof Date, 'Mock Sheets should return coerced date values');
  assert.equal(properties.get('CARE_RECORD_IDENTITY_WRITES_ENABLED'), 'false');
  assert.equal(properties.get('BELONGINGS_SHEET_NAME'), 'preexisting-test-adapter-tab');
  assert.deepEqual(spreadsheet.sheets.map(s => s.name).sort(), ['__CARE_ID_TEST_BOOKINGS__', '__CARE_ID_TEST_CARE__', '__CARE_ID_TEST_CONTROL__'].sort());
  sandbox.careIdentitySyntheticCleanup();
  assert.deepEqual(spreadsheet.sheets.map(s => s.name), ['__CARE_ID_TEST_CONTROL__']);
});

test('Apps Script harness restores or deletes the sheet-name property after a failed fixture run', () => {
  const { sandbox, properties } = runHarness({ initialProperties: { BELONGINGS_SHEET_NAME: 'preexisting-test-adapter-tab' } });
  sandbox.migrateBelongingsIdentityForGuest_ = () => { throw new Error('simulated fixture failure'); };
  assert.throws(() => sandbox.careIdentitySyntheticRun(), /One or more harness cases failed/);
  assert.equal(properties.get('BELONGINGS_SHEET_NAME'), 'preexisting-test-adapter-tab');
  assert.equal(properties.get('CARE_RECORD_IDENTITY_WRITES_ENABLED'), 'false');

  const unset = runHarness();
  unset.sandbox.migrateBelongingsIdentityForGuest_ = () => { throw new Error('simulated fixture failure'); };
  assert.throws(() => unset.sandbox.careIdentitySyntheticRun(), /One or more harness cases failed/);
  assert.equal(unset.properties.has('BELONGINGS_SHEET_NAME'), false);
  assert.equal(unset.properties.get('CARE_RECORD_IDENTITY_WRITES_ENABLED'), 'false');
});

test('Apps Script harness rejects a wrong project before it creates fixture tabs', () => {
  const { sandbox, spreadsheet, properties } = runHarness({ projectId: 'other-test-project', initialProperties: { CARE_RECORD_IDENTITY_WRITES_ENABLED: 'sentinel' } });
  assert.throws(() => sandbox.careIdentitySyntheticRun(), /Expected synthetic-script-id, got other-test-project/);
  assert.deepEqual(spreadsheet.sheets.map(s => s.name), ['__CARE_ID_TEST_CONTROL__']);
  assert.equal(properties.get('CARE_RECORD_IDENTITY_WRITES_ENABLED'), 'sentinel');
});

test('Apps Script harness refuses a denylisted spreadsheet without property or tab writes', () => {
  const { sandbox, spreadsheet, properties } = runHarness({ spreadsheetId: 'known-production-spreadsheet-id', initialProperties: { CARE_RECORD_IDENTITY_WRITES_ENABLED: 'sentinel' } });
  assert.throws(() => sandbox.careIdentitySyntheticRun(), /production denylist/);
  assert.deepEqual(spreadsheet.sheets.map(s => s.name), ['__CARE_ID_TEST_CONTROL__']);
  assert.equal(properties.get('CARE_RECORD_IDENTITY_WRITES_ENABLED'), 'sentinel');
});

test('Apps Script harness refuses a missing marker without property or tab writes', () => {
  const { sandbox, spreadsheet, properties } = runHarness({ initialProperties: { CARE_RECORD_IDENTITY_WRITES_ENABLED: 'sentinel' } });
  spreadsheet.getSheetByName('__CARE_ID_TEST_CONTROL__').getRange(1, 1).setValue('wrong-marker');
  assert.throws(() => sandbox.careIdentitySyntheticRun(), /marker missing or incorrect/);
  assert.deepEqual(spreadsheet.sheets.map(s => s.name), ['__CARE_ID_TEST_CONTROL__']);
  assert.equal(properties.get('CARE_RECORD_IDENTITY_WRITES_ENABLED'), 'sentinel');
});
