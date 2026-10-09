'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { localBackendRequestPolicy, resolveLocalBackendAction } = require('../scripts/local-network-policy');

test('allows established read actions', () => {
  assert.equal(localBackendRequestPolicy({ method: 'GET', action: 'maintenance_status' }).allowed, true);
  assert.equal(localBackendRequestPolicy({ method: 'HEAD', action: 'maintenance_status' }).allowed, true);
  assert.equal(localBackendRequestPolicy({ method: 'GET', action: 'get_guest_directory' }).allowed, true);
  for (const action of ['list_dog_identities', 'list_dog_stays_for_linking']) {
    assert.equal(localBackendRequestPolicy({ method: 'GET', action }).allowed, true);
    assert.equal(localBackendRequestPolicy({ method: 'POST', action }).allowed, false);
  }
});

test('blocks writes and unknown GET actions in local UI runs', () => {
  assert.equal(localBackendRequestPolicy({ method: 'POST', action: 'maintenance_status' }).allowed, false);
  assert.equal(localBackendRequestPolicy({ method: 'GET', action: 'save_dog_master_profile' }).allowed, false);
  assert.equal(localBackendRequestPolicy({ method: 'GET', action: 'create_boarding' }).allowed, false);
  for (const action of ['backfill_dog_ids', 'link_dog_stay']) {
    assert.equal(localBackendRequestPolicy({ method: 'GET', action }).allowed, false);
  }
});

test('decodes payload actions and fails closed on conflicts or malformed writes', () => {
  const base = 'https://script.googleusercontent.com/?callback=x&';
  assert.equal(resolveLocalBackendAction({ method: 'GET', url: `${base}payload=${encodeURIComponent(JSON.stringify({ action: 'get_guest_directory' }))}` }).policy.allowed, true);
  for (const action of ['checkin_stay', 'checkout_stay', 'early_checkout_stay']) {
    assert.equal(resolveLocalBackendAction({ method: 'GET', url: `${base}payload=${encodeURIComponent(JSON.stringify({ action }))}` }).policy.allowed, false);
  }
  assert.equal(resolveLocalBackendAction({ method: 'GET', url: `${base}action=get_guest_directory&payload=${encodeURIComponent(JSON.stringify({ action: 'checkout_stay' }))}` }).policy.allowed, false);
  assert.equal(resolveLocalBackendAction({ method: 'GET', url: `${base}payload=%7Bbad` }).policy.allowed, false);
});
