import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTokenVerifier } from '../src/auth.js';

test('production refuses emulator configuration before creating an Admin app', () => {
  assert.throws(() => createTokenVerifier({ projectId: 'demo-waffle-care', emulatorHost: '127.0.0.1:9099', mode: 'production' }), /forbidden in production/);
});

test('production also refuses ambient Firebase emulator configuration', () => {
  const previous = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  try { assert.throws(() => createTokenVerifier({ projectId: 'demo-waffle-care', mode: 'production' }), /forbidden in production/); }
  finally { if (previous === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST; else process.env.FIREBASE_AUTH_EMULATOR_HOST = previous; }
});

test('emulator host is restricted to localhost and valid project identifiers', () => {
  assert.throws(() => createTokenVerifier({ projectId: 'bad', mode: 'local' }), /projectId/);
  assert.throws(() => createTokenVerifier({ projectId: 'demo-waffle-care', emulatorHost: 'emulator.example:9099', mode: 'local' }), /local development endpoint/);
  assert.throws(() => createTokenVerifier({ projectId: 'waffle-care-demo', emulatorHost: '127.0.0.1:9099', mode: 'local' }), /local development endpoint/);
  assert.throws(() => createTokenVerifier({ projectId: 'demo-waffle-care', emulatorHost: 'localhost:99999', mode: 'local' }), /valid port/);
});
