'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { localBackendRequestPolicy } = require('../scripts/local-network-policy');

test('allows established read actions', () => {
  assert.equal(localBackendRequestPolicy({ method: 'GET', action: 'maintenance_status' }).allowed, true);
  assert.equal(localBackendRequestPolicy({ method: 'HEAD', action: 'maintenance_status' }).allowed, true);
  assert.equal(localBackendRequestPolicy({ method: 'GET', action: 'get_guest_directory' }).allowed, true);
});

test('blocks writes and unknown GET actions in local UI runs', () => {
  assert.equal(localBackendRequestPolicy({ method: 'POST', action: 'maintenance_status' }).allowed, false);
  assert.equal(localBackendRequestPolicy({ method: 'GET', action: 'save_dog_master_profile' }).allowed, false);
  assert.equal(localBackendRequestPolicy({ method: 'GET', action: 'create_boarding' }).allowed, false);
});
