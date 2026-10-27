const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'apps-script/Code.js'), 'utf8');

test('both existing scheduled handlers invoke advance delivery independently before digest state', () => {
  for (const name of ['checkWaffleHousePushNotifications', 'sendMorningWafflePushNotifications']) {
    const start = code.indexOf(`function ${name}() {`);
    const end = code.indexOf('  var sheet =', start);
    const prefix = code.slice(start, end) + '\nreturn "existing_handler_continues";\n}';
    let attempts = 0;
    const context = vm.createContext({
      sendStayAdvancePushNotifications_() { attempts++; throw new Error('PRIVATE_SENTINEL'); },
      console: { error(message) { assert.ok(!message.includes('PRIVATE_SENTINEL')); } }
    });
    vm.runInContext(prefix, context);
    assert.equal(context[name](), 'existing_handler_continues');
    assert.equal(attempts, 1);
  }
});

test('advance reminders retry even when the same-day digest has already completed', () => {
  const start = code.indexOf('function sendMorningWafflePushNotifications() {');
  const end = code.indexOf('  var summary =', start);
  let attempts = 0;
  const context = vm.createContext({
    Date, String,
    sendStayAdvancePushNotifications_() { attempts++; },
    getTargetSheet_() { return { getParent: () => ({ getSpreadsheetTimeZone: () => 'Australia/Sydney' }) }; },
    Utilities: { formatDate: () => '2026-10-27' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '2026-10-27' }) }
  });
  vm.runInContext(code.slice(start, end) + '\n}', context);
  assert.equal(context.sendMorningWafflePushNotifications().reason, 'morning_push_already_sent');
  assert.equal(context.sendMorningWafflePushNotifications().reason, 'morning_push_already_sent');
  assert.equal(attempts, 2);
});

test('public status route only reports aggregate scheduler status and cannot send or install triggers', () => {
  assert.match(code, /get_stay_advance_push_status: true/);
  const start = code.indexOf('  if (action === "get_stay_advance_push_status") {');
  const end = code.indexOf('  if (action === "get_data_versions")', start);
  const context = vm.createContext({ getStayAdvancePushStatus_: () => ({ result: 'success', schemaVersion: 1 }) });
  vm.runInContext('function read(action) {\n' + code.slice(start, end) + '\n}', context);
  assert.equal(context.read('get_stay_advance_push_status').schemaVersion, 1);
  assert.doesNotMatch(code.slice(start, end), /sendStay|setup|newTrigger/);
});

test('existing preferences explain the today, one-day and two-day schedule without adding opt-ins', () => {
  const source = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
  assert.ok(source.includes('At 7 am: today, 1 and 2 days before arrival'));
  assert.ok(source.includes('At 7 am: today, 1 and 2 days before departure'));
  assert.ok(source.includes('data-push-pref="arrivals"'));
  assert.ok(source.includes('data-push-pref="departures"'));
});

test('existing subscription reader honors category opt-out, disabled devices and missing registrations', () => {
  const start = code.indexOf('function readActivePushSubscriptions_(');
  const end = code.indexOf('function sendPushToCategory_(', start);
  const rows = [
    [true, 'fid-a', true, false],
    [true, 'fid-b', false, true],
    [false, 'fid-c', true, true],
    [true, '', true, true]
  ];
  const context = vm.createContext({
    PUSH_CATEGORY_COLUMN_: { arrivals: 3, departures: 4 }, PUSH_SUBSCRIPTIONS_HEADERS_: ['Enabled', 'FID', 'Arrivals', 'Departures'],
    getPushSubscriptionsSheet_: () => ({ getLastRow: () => rows.length + 1, getRange: () => ({ getValues: () => rows }) }),
    pushRowToObject_: (row, index) => ({ subscriptionId: 'device-' + index, enabled: row[0], fid: row[1] })
  });
  vm.runInContext(code.slice(start, end), context);
  assert.deepEqual(Array.from(context.readActivePushSubscriptions_('arrivals'), r => r.fid), ['fid-a']);
  assert.deepEqual(Array.from(context.readActivePushSubscriptions_('departures'), r => r.fid), ['fid-b']);
});
