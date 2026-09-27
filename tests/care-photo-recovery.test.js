const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');

function extractFunction(name) {
  const asyncStart = source.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `found production function ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function makeHarness() {
  let waitCalls = 0;
  const button = {
    disabled: false,
    hidden: false,
    dataset: {},
    setAttribute() {},
    insertAdjacentElement() {}
  };
  const status = {
    textContent: '',
    parentNode: { querySelector: () => button },
    insertAdjacentElement() {}
  };
  const label = { value: 'Bag' };
  const card = {
    querySelector(selector) {
      return selector.includes('photo-label') ? label : status;
    }
  };
  const context = {
    Map,
    document: { createElement: () => ({ ...button }) },
    uncertainBelongingsPhotoUploads: new Map([
      ['stay-1', {
        uploadToken: 'token-1', photoData: 'private-data', photoLabel: 'Bag',
        stayKey: 'stay-1', previousCount: 2
      }]
    ]),
    getBelongingsCardPayload: () => ({ stayKey: 'stay-1' }),
    queryAppsScript: async () => ({ uploadStatus: { state: 'success' } }),
    async waitForBelongingsPhotoRecord() {
      waitCalls++;
      if (waitCalls === 1) throw new Error('not visible yet');
      return { stayKey: 'stay-1', photos: [{ id: 'new' }] };
    },
    belongingsRecordsCache: {},
    directoryPhotoRecordsCache: {},
    careRiskRecordsCache: {},
    setDirectoryDogPhoto() {},
    setDirectoryCareFlags() {},
    renderDirectoryOperationalSections() {},
    refreshCount: 0
  };
  context.refreshBelongingsPhotoRecord = function(stayKey, record) {
    context.refreshCount++;
    context.belongingsRecordsCache[stayKey] = record;
    context.directoryPhotoRecordsCache[stayKey] = record;
    context.careRiskRecordsCache[stayKey] = record;
  };
  vm.createContext(context);
  vm.runInContext(`
    ${extractFunction('setBelongingsUploadCheckVisible')}
    ${extractFunction('isCurrentBelongingsPhotoUploadCheck')}
    ${extractFunction('checkUncertainBelongingsPhotoUpload')}
  `, context);
  return { context, card, status, button };
}

test('successful upload status with delayed record visibility stays pending and never resubmits', async () => {
  const { context, card, status, button } = makeHarness();
  await context.checkUncertainBelongingsPhotoUpload(card);

  assert.match(status.textContent, /record is still updating/);
  assert.equal(button.hidden, false);
  assert.equal(context.uncertainBelongingsPhotoUploads.has('stay-1'), true);
  assert.equal(context.uncertainBelongingsPhotoUploads.get('stay-1').photoData, 'private-data');
  assert.equal(context.refreshCount, 0);

  await context.checkUncertainBelongingsPhotoUpload(card);
  assert.equal(context.uncertainBelongingsPhotoUploads.has('stay-1'), false);
  assert.equal(context.refreshCount, 1);
  assert.equal(context.belongingsRecordsCache['stay-1'].photos.length, 1);
  assert.equal(button.hidden, true);
});

test('uncertain upload is checked with the original token and form is submitted exactly once', async () => {
  const { context, card, status } = makeHarness();
  context.uncertainBelongingsPhotoUploads.clear();
  context.belongingsUploadInProgress = false;
  context.belongingsRecordsCache = {};
  context.directoryPhotoRecordsCache = {};
  context.careRiskRecordsCache = {};
  context.getBelongingsCardPayload = () => ({ stayKey: 'stay-1', dogName: 'Milo' });
  context.sendPayloadToAppsScript = async () => ({});
  let statusReads = 0;
  context.queryAppsScript = async request => {
    if (request.action === 'begin_belongings_photo_upload') return {};
    statusReads++;
    return { uploadStatus: { state: 'success' } };
  };
  let formSubmissions = 0;
  context.submitBelongingsPhotoViaForm = async () => { formSubmissions++; };
  context.makeBelongingsPhotoUploadToken = () => 'new-token';
  context.waitForBelongingsPhotoUploadStatus = async () => ({ state: 'success' });
  vm.runInContext(extractFunction('isCurrentBelongingsPhotoUploadCheck'), context);
  let recordChecks = 0;
  context.waitForBelongingsPhotoRecord = async () => {
    recordChecks++;
    if (recordChecks === 1) throw new Error('not visible yet');
    return { stayKey: 'stay-1', photos: [{ id: 'new' }] };
  };
  context.setDirectoryDogPhoto = () => {};
  context.setDirectoryCareFlags = () => {};
  context.renderDirectoryOperationalSections = () => {};
  context.console = { error() {} };
  vm.runInContext(extractFunction('uploadBelongingsPhotoData'), context);

  await assert.rejects(
    context.uploadBelongingsPhotoData(card, 'new-private-photo', null),
    /not visible yet/
  );
  assert.equal(formSubmissions, 1);
  assert.equal(context.uncertainBelongingsPhotoUploads.get('stay-1').uploadToken, 'new-token');
  assert.match(status.textContent, /record is still updating/);

  await context.checkUncertainBelongingsPhotoUpload(card);
  assert.equal(statusReads, 1);
  assert.equal(formSubmissions, 1);
  assert.equal(context.uncertainBelongingsPhotoUploads.has('stay-1'), false);
});

test('late status response is ignored after the card switches to another stay', async () => {
  const { context, card, status } = makeHarness();
  let currentStay = 'stay-1';
  context.getBelongingsCardPayload = () => ({ stayKey: currentStay });
  let resolveStatus;
  context.queryAppsScript = () => new Promise(resolve => { resolveStatus = resolve; });
  let recordReads = 0;
  context.waitForBelongingsPhotoRecord = async () => {
    recordReads++;
    return { stayKey: 'stay-1', photos: [{ id: 'late' }] };
  };

  const check = context.checkUncertainBelongingsPhotoUpload(card);
  currentStay = 'stay-2';
  resolveStatus({ uploadStatus: { state: 'success' } });
  await check;

  assert.equal(recordReads, 0);
  assert.equal(context.uncertainBelongingsPhotoUploads.has('stay-1'), true);
  assert.equal(context.refreshCount, 0);
  assert.doesNotMatch(status.textContent, /saved to Google Drive/);
});
