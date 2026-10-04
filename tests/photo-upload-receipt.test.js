const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('apps-script/Code.js', 'utf8');
test('generated hosted uploader script parses after HTML string assembly', () => {
  let html;
  const output = { addMetaTag() { return this; }, setXFrameOptionsMode() { return this; } };
  const context = vm.createContext({ HtmlService: {
    createHtmlOutput(value) { html = value; return output; }, XFrameOptionsMode: { ALLOWALL: 1 }
  } });
  const start = source.indexOf('function buildBelongingsPhotoUploaderHtml_(');
  const end = source.indexOf('function uploadBelongingsPhotoFromHtml(', start);
  vm.runInContext(source.slice(start, end), context);
  context.buildBelongingsPhotoUploaderHtml_({ stayKey: 'stay-a', dogName: 'Milo' });
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script, 'hosted script present');
  assert.doesNotThrow(() => new vm.Script(script[1]));
});
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed ${name}`);
}

function harness() {
  const values = {};
  const props = {
    getProperty: key => values[key] || null,
    setProperty: (key, value) => { values[key] = value; },
    getProperties: () => ({ ...values })
  };
  const context = { PropertiesService: { getScriptProperties: () => props }, Date, JSON, Object, String, Error };
  vm.createContext(context);
  vm.runInContext([
    extract('getPhotoUploadReceiptKey_'), extract('getPhotoUploadReceiptRecord_'),
    extract('setPhotoUploadReceipt_'), extract('getBelongingsPhotoUploadReceipt')
  ].join('\n'), context);
  return { context, values };
}

function uploadHarness(failFirstSheetWrite = false) {
  const receipts = {};
  const rows = { 24: '[]' };
  let created = 0;
  let writes = 0;
  const sheet = {
    getRange(row, col) {
      return {
        getValues: () => [['stay-a', 'Milo', new Date('2026-09-01T00:00:00Z'), new Date('2026-09-05T00:00:00Z')]],
        getValue: () => rows[col] || '',
        setValue: value => {
          if (failFirstSheetWrite && col === 24 && writes === 0) { writes++; throw new Error('simulated sheet write failure'); }
          rows[col] = value; writes++;
        }
      };
    }
  };
  const context = {
    Date, JSON, Object, String, Error, PropertiesService: { getScriptProperties: () => ({
      getProperty: key => receipts[key] || null,
      setProperty: (key, value) => { receipts[key] = value; },
      getProperties: () => ({ ...receipts }),
      deleteProperty: key => { delete receipts[key]; }
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    getBelongingsSheet_: () => sheet,
    findBelongingsRow_: () => 2,
    assertWaffleActionAllowedDuringMaintenance_() {},
    belongingsPhotoDateKey_: value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value),
    saveBelongingsPhoto_: data => {
      const prior = Object.values(context.driveFiles).find(file => file.name === data.uploadSuffix);
      if (prior) return prior;
      created++;
      const photo = { id: `drive-${created}`, name: data.uploadSuffix, label: data.photoLabel };
      context.driveFiles.push(photo);
      return photo;
    },
    driveFiles: [],
    parsePhotosJson_: value => JSON.parse(value || '[]'),
    SpreadsheetApp: { flush() {} },
    logAuditEvent_() {},
    touchWaffleDataVersion_() {}
  };
  vm.createContext(context);
  vm.runInContext([
    extract('getPhotoUploadReceiptKey_'), extract('getPhotoUploadReceiptRecord_'), extract('setPhotoUploadReceipt_'),
    extract('uploadBelongingsPhotoFromHtml')
  ].join('\n'), context);
  return { context, rows, get created() { return created; }, get writes() { return writes; } };
}

test('receipt lookup is read-only for unknown uploads and returns saved metadata by matching identity', () => {
  const { context, values } = harness();
  const id = `${Date.now().toString(36)}_1234567890abcdef`;
  assert.equal(context.getBelongingsPhotoUploadReceipt({ clientUploadId: id, stayKey: 'stay-a', photoType: 'belongings' }).state, 'unknown');
  assert.equal(Object.keys(values).length, 0);
  context.setPhotoUploadReceipt_(id, { state: 'saved', stayKey: 'stay-a', photoType: 'belongings', photo: { id: 'drive-1' } });
  assert.deepEqual(JSON.parse(JSON.stringify(context.getBelongingsPhotoUploadReceipt({ clientUploadId: id, stayKey: 'stay-a', photoType: 'belongings' }))), { state: 'saved', photo: { id: 'drive-1' } });
  assert.equal(context.getBelongingsPhotoUploadReceipt({ clientUploadId: id, stayKey: 'stay-b', photoType: 'belongings' }).state, 'identity_mismatch');
});

test('expired receipt is read-only and an old timestamped client ID stays expired after receipt cleanup', () => {
  const { context, values } = harness();
  const id = `${(Date.now() - 25 * 60 * 60 * 1000).toString(36)}_1234567890abcdef`;
  values[`photo_upload_receipt_${id}`] = JSON.stringify({ state: 'saved', stayKey: 'stay-a', photoType: 'belongings', photo: { id: 'drive-1' }, createdAt: Date.now() - 25 * 60 * 60 * 1000 });
  assert.equal(context.getBelongingsPhotoUploadReceipt({ clientUploadId: id, stayKey: 'stay-a', photoType: 'belongings' }).state, 'expired');
  assert.equal(JSON.parse(values[`photo_upload_receipt_${id}`]).state, 'saved');
  assert.equal(context.getPhotoUploadReceiptRecord_(id).state, 'expired');
  delete values[`photo_upload_receipt_${id}`];
  assert.equal(context.getBelongingsPhotoUploadReceipt({ clientUploadId: id, stayKey: 'stay-a', photoType: 'belongings' }).state, 'expired');
});

test('repeated and concurrent requests with one ID create one Drive photo and one sheet attachment', async () => {
  const h = uploadHarness();
  const payload = { clientUploadId: `${Date.now().toString(36)}_1234567890abcdef`, stayKey: 'stay-a', dogName: 'Milo', startDate: '2026-09-01', endDate: '2026-09-05', photoType: 'belongings', photoData: 'private-image-data' };
  const [first, concurrent] = await Promise.all([
    Promise.resolve().then(() => h.context.uploadBelongingsPhotoFromHtml(payload)),
    Promise.resolve().then(() => h.context.uploadBelongingsPhotoFromHtml(payload))
  ]);
  assert.equal(h.created, 1);
  assert.equal(JSON.parse(h.rows[24]).length, 1);
  assert.equal(first.photo.id, concurrent.photo.id);
  assert.equal(concurrent.idempotent, true);
  assert.doesNotMatch(Object.values(h.context.PropertiesService.getScriptProperties().getProperties()).join(' '), /private-image-data/);
});

test('retry reuses the deterministic Drive file after a sheet write failure', () => {
  const h = uploadHarness(true);
  const payload = { clientUploadId: `${Date.now().toString(36)}_fedcba0987654321`, stayKey: 'stay-a', dogName: 'Milo', startDate: '2026-09-01', endDate: '2026-09-05', photoType: 'belongings', photoData: 'private-image-data' };
  assert.throws(() => h.context.uploadBelongingsPhotoFromHtml(payload), /simulated sheet write failure/);
  assert.equal(h.created, 1);
  assert.equal(JSON.parse(h.rows[24]).length, 0);
  const retry = h.context.uploadBelongingsPhotoFromHtml(payload);
  assert.equal(retry.photo.id, 'drive-1');
  assert.equal(h.created, 1);
  assert.equal(JSON.parse(h.rows[24]).length, 1);
});

test('uploader has stable per-photo IDs and uses the read-only status RPC before exposing retries', () => {
  assert.match(source, /clientUploadId: makeClientUploadId\(\)/);
  assert.match(source, /function lookupUploadReceipt\(/);
  assert.match(source, /getBelongingsPhotoUploadReceipt\(payload\)/);
  assert.match(source, /prior\.state === 'saved'.*continue/);
  assert.match(source, /savedPhotoIds: batchSaved\.map/);
  assert.match(source, /uncertainClientUploadId: uncertainClientUploadId/);
  assert.match(source, /uploadSuffix\.replace\(\/\^_upload_\//);
});
