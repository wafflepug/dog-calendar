const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('waffle-app.js', 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `found ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function harness() {
  const frame = { src: 'https://uploader/session' };
  const modal = { style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  let unique = true;
  const identity = { dogName: 'Milo', startDate: '2026-10-01', endDate: '2026-10-05' };
  const card = { dataset: { stayKey: 'stay-1' }, querySelector: () => ({ textContent: '' }) };
  const context = {
    hostedPhotoSessions: new Map(), hostedBelongingsPhotoContext: null,
    hostedPendingPhotoConfirmations: new Map(), belongingsUploadInProgress: true,
    document: {
      getElementById(id) { return id.includes('Frame') ? frame : modal; },
      querySelectorAll() { return unique ? [card] : [card, {}]; },
      createElement() { return { dataset: {}, className: '', appendChild() {}, set innerHTML(v) { this.html = v; } }; }
    },
    directoryProfileEditKey: () => 'stay-1',
    getDirectoryProfileEditIdentity: () => identity,
    directoryProfileEditIdentityConflicts: (a, b) => a.dogName !== b.dogName,
    escapeDashboardHtml: s => String(s),
    confirm: () => true,
    card, frame, modal,
    setUnique(value) { unique = value; }
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunction('closeHostedBelongingsPhotoUploader'),
    extractFunction('hostedPhotoSessionKey'),
    extractFunction('findUniqueHostedPhotoCard'),
    extractFunction('syncHostedPhotoSessionControls'),
    extractFunction('resumeHostedPhotoSession'),
    extractFunction('discardHostedPhotoSession'),
    extractFunction('releaseHostedPhotoSession')
  ].join('\n'), context);
  return context;
}

function addSession(c) {
  const session = { stayKey: 'stay-1', photoType: 'belongings', identity: { dogName: 'Milo' }, card: c.card, sessionKey: 'stay-1::belongings', sessionState: 'prepared' };
  c.hostedPhotoSessions.set(session.sessionKey, session);
  c.hostedBelongingsPhotoContext = session;
  return session;
}

test('closing hides the modal while preserving the prepared iframe and session', () => {
  const c = harness();
  const session = addSession(c);
  c.closeHostedBelongingsPhotoUploader();
  assert.equal(c.frame.src, 'https://uploader/session');
  assert.equal(c.hostedBelongingsPhotoContext, session);
  assert.equal(c.hostedPhotoSessions.get(session.sessionKey), session);
  assert.equal(c.modal.style.display, 'none');
});

test('resume requires the same unique stay identity and restores the modal', () => {
  const c = harness();
  const session = addSession(c);
  c.closeHostedBelongingsPhotoUploader();
  c.resumeHostedPhotoSession(session.sessionKey);
  assert.equal(c.modal.style.display, 'flex');
  c.setUnique(false);
  c.modal.style.display = 'none';
  c.resumeHostedPhotoSession(session.sessionKey);
  assert.equal(c.modal.style.display, 'none');
  assert.equal(c.hostedPhotoSessions.has(session.sessionKey), true);
});

test('a different stay key does not resolve to the prepared session', () => {
  const c = harness();
  addSession(c);
  assert.equal(c.hostedPhotoSessionKey('stay-2', 'belongings'), 'stay-2::belongings');
  assert.equal(c.hostedPhotoSessions.has(c.hostedPhotoSessionKey('stay-2', 'belongings')), false);
});

test('discard releases a prepared iframe and its in-memory context', () => {
  const c = harness();
  const session = addSession(c);
  c.discardHostedPhotoSession(session.sessionKey);
  assert.equal(c.frame.src, 'about:blank');
  assert.equal(c.hostedBelongingsPhotoContext, null);
  assert.equal(c.hostedPhotoSessions.size, 0);
});

test('confirmed completion releases iframe and context', () => {
  const c = harness();
  const session = addSession(c);
  c.releaseHostedPhotoSession(session);
  assert.equal(c.frame.src, 'about:blank');
  assert.equal(c.modal.style.display, 'none');
  assert.equal(c.hostedBelongingsPhotoContext, null);
  assert.equal(c.hostedPhotoSessions.size, 0);
  assert.equal(c.belongingsUploadInProgress, false);
});
