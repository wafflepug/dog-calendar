const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.js'), 'utf8');
const start = source.indexOf('function sendBookingLifecycleEmailSafely_(data, result) {');
const end = source.indexOf('function buildTodayBoardingNotificationSummary_(', start);
assert.ok(start >= 0 && end > start, 'booking lifecycle email helper is present');

function createHarness(options = {}) {
  const sent = [];
  const cached = new Map();
  const sandbox = {
    String, Object, Array, RegExp,
    readPalzBusinessBrand_: () => options.brand || { name: 'Waffle House' },
    intakeLogoBlob_: () => ({ type: 'image/png' }),
    Utilities: { base64Decode: value => value, newBlob: (bytes, type) => ({ bytes, type }) },
    console: { error() {} },
    CacheService: { getScriptCache: () => ({
      get(key) { return cached.get(key) || null; },
      put(key, value) { cached.set(key, value); }
    }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty(name) { return name === 'DAILY_NOTIFICATION_EMAIL' ? (options.recipient === undefined ? 'internal@example.test' : options.recipient) : null; }
    }) },
    MailApp: {
      getRemainingDailyQuota: () => options.quota === undefined ? 10 : options.quota,
      sendEmail(message) { if (options.failSend) throw new Error('simulated mail failure'); sent.push(message); }
    },
    escapeHtmlEmail_(value) { return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(start, end) + '\n' + source.slice(source.indexOf('function sendWaffleNotificationEmail_('), source.indexOf('function buildTodayBoardingNotificationSummary_(')), sandbox);
  return { sandbox, sent, cached };
}

{
  const { sandbox, sent } = createHarness({ brand: { name: 'Test & Co', icon: 'data:image/jpeg;base64,YQ==' } });
  sandbox.sendWaffleNotificationEmail_('internal@example.test', { subject: 'Preview', textBody: 'Example', htmlBody: 'Example' });
  assert.match(sent[0].htmlBody, /align="right" valign="top"[^>]*><img src="cid:businessLogo" alt="Test &amp; Co" width="52"/);
  assert.match(sent[0].htmlBody, /width:52px;max-width:100%;height:auto/);
  assert.equal(sent[0].inlineImages.businessLogo.type, 'image/jpeg');
}

const lifecycleEvents = [
  ['create_potential', 'Potential stay submitted'],
  ['create_boarding', 'Confirmed stay submitted'],
  ['confirm_potential', 'Potential stay confirmed'],
  ['create', 'Meet & Greet scheduled'],
  ['delete_potential', 'Potential stay cancelled'],
  ['delete_confirmed_stay', 'Confirmed stay cancelled']
];

for (const [action, expectedSubject] of lifecycleEvents) {
  const { sandbox, sent } = createHarness();
  sandbox.sendBookingLifecycleEmailSafely_(
    { action, clientMutationId: `mutation_${action}`, dogName: 'Coco', startDate: '2026-11-01', endDate: '2026-11-03', phone: '0400000000' },
    { result: 'success', stayId: 'stay_00001', row: 2 }
  );
  assert.equal(sent.length, 1, `${action} sends one internal email`);
  assert.match(sent[0].subject, new RegExp(expectedSubject));
  assert.equal(sent[0].to, 'internal@example.test');
  assert.match(sent[0].body, /Coco/);
  assert.doesNotMatch(sent[0].body, /0400000000/, 'owner contact details are excluded');
}

{
  const { sandbox, sent } = createHarness();
  const payload = { action: 'confirm_potential', clientMutationId: 'mutation_confirm_once', dogName: 'Coco' };
  const success = { result: 'success', stayId: 'stay_00001' };
  sandbox.sendBookingLifecycleEmailSafely_(payload, success);
  sandbox.sendBookingLifecycleEmailSafely_(payload, success);
  sandbox.sendBookingLifecycleEmailSafely_(payload, { ...success, duplicate: true });
  assert.equal(sent.length, 1, 'cache and durable retry duplicate suppress repeated conversion emails');
  assert.match(sent[0].subject, /Potential stay confirmed/);
}

{
  const { sandbox, sent } = createHarness({ failSend: true });
  assert.doesNotThrow(() => sandbox.sendBookingLifecycleEmailSafely_(
    { action: 'create_potential', clientMutationId: 'mutation_mail_failure', dogName: 'Coco' },
    { result: 'success', stayId: 'stay_00001' }
  ));
  assert.equal(sent.length, 0, 'mail failure does not throw into the successful booking response');
}

{
  const { sandbox, sent } = createHarness({ recipient: '' });
  sandbox.sendBookingLifecycleEmailSafely_(
    { action: 'create_potential', clientMutationId: 'mutation_no_recipient', dogName: 'Coco' },
    { result: 'success', stayId: 'stay_00001' }
  );
  assert.equal(sent.length, 0, 'email does not fall back to the anonymous requester');
}

{
  const { sandbox, sent } = createHarness();
  sandbox.sendBookingLifecycleEmailSafely_({ action: 'update_potential', dogName: 'Coco' }, { result: 'success' });
  sandbox.sendBookingLifecycleEmailSafely_({ action: 'create_potential', dogName: 'Coco' }, { result: 'error' });
  assert.equal(sent.length, 0, 'updates and failed writes do not send lifecycle emails');
}

{
  const { sandbox, sent } = createHarness();
  const payload = { action: 'update_boarding_dates', source: 'Extend stay', clientMutationId: 'extend_1' };
  const result = { result: 'success', previousEndDate: '2026-12-31',
    booking: { dogName: 'Maple', startDate: '2026-12-25', endDate: '2027-01-02' } };
  sandbox.sendBookingLifecycleEmailSafely_(payload, result);
  sandbox.sendBookingLifecycleEmailSafely_(payload, { ...result, duplicate: true });
  sandbox.sendBookingLifecycleEmailSafely_({ ...payload, source: 'Calendar Drag' }, result);
  sandbox.sendBookingLifecycleEmailSafely_({ ...payload, clientMutationId: 'unchanged' }, {
    ...result, previousEndDate: result.booking.endDate
  });
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Palz Stay.*Stay extended.*Maple/);
  assert.match(sent[0].body, /Previous checkout: 2026-12-31/);
  assert.match(sent[0].htmlBody, /New checkout: 2027-01-02/);
}

// Guard the integration boundary: handlers invoke email delivery only after
// the receipt wrapper has returned and after mutation cache invalidation.
for (const handlerStart of [source.indexOf('function doPost(e)'), source.indexOf('function doGet(e)')]) {
  const handlerEnd = source.indexOf('\n}', handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);
  const receipt = handler.indexOf('processSheetActionWithV108Receipt_(data)');
  const notify = handler.indexOf('sendBookingLifecycleEmailSafely_(data, result)');
  assert.ok(receipt >= 0 && notify > receipt, 'notification follows persisted mutation receipt');
  if (handler.includes('invalidateWaffleForAction_')) {
    assert.ok(handler.indexOf('invalidateWaffleForAction_') < notify, 'notification follows cache invalidation');
  }
}

console.log('Booking lifecycle email tests passed.');
