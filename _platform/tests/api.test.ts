import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { createHandler } from '../src/api.js';

const servers: Server[] = [];
async function setup(overrides: any = {}) {
  const calls: any[] = [];
  const store = Object.fromEntries(['listBusinesses', 'createBusiness', 'getWorkspace', 'createDog', 'createBooking', 'createInvite', 'acceptInvite', 'disableMember', 'exportBusiness'].map((key) => [key, async (...args: any[]) => { calls.push([key, ...args]); return { ok: true }; }]));
  const server = createServer(createHandler({ verifyToken: async (token) => {
    if (token !== 'valid') throw new Error('invalid token');
    return { uid: 'firebase-user', email: 'owner@example.com', email_verified: true };
  }, publicConfig: { mode: 'local', origin: 'http://127.0.0.1', firebase: { apiKey: 'public-key', projectId: 'demo-waffle-care' }, emulatorUrl: 'http://127.0.0.1:9199', secret: 'must-not-escape' }, ...overrides, store: (overrides.store ?? store) as any }));
  servers.push(server); await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('server did not bind');
  return { url: `http://127.0.0.1:${address.port}`, calls };
}
afterEach(async () => { await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve())))); });
const authHeaders = { Authorization: 'Bearer valid', 'Content-Type': 'application/json', Origin: 'http://127.0.0.1' };

test('health and public config are anonymous; protected routes require verified Firebase identity', async () => {
  const { url } = await setup();
  assert.equal((await fetch(`${url}/health`)).status, 200);
  const configResponse = await fetch(`${url}/api/config`);
  assert.equal(configResponse.status, 200);
  const config = await configResponse.json() as any;
  assert.equal(config.secret, undefined); assert.equal(config.firebase.apiKey, 'public-key');
  const denied = await fetch(`${url}/api/businesses`);
  assert.equal(denied.status, 401); assert.equal(denied.headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(`${url}/api/businesses`, { headers: { Authorization: 'Bearer valid' } })).status, 200);
});

test('business creation forwards only validated user input and derives uid from verifier', async () => {
  const { url, calls } = await setup();
  const response = await fetch(`${url}/api/businesses`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'Waffle Care', slug: 'waffle-care', timezone: 'Australia/Sydney', capacity: 12 }) });
  assert.equal(response.status, 201);
  assert.deepEqual(calls[0], ['createBusiness', 'firebase-user', { name: 'Waffle Care', slug: 'waffle-care', timezone: 'Australia/Sydney', capacity: 12 }]);
});

test('dog creation permits a tenant-scoped owner ID and rejects an ambiguous owner input', async () => {
  const { url, calls } = await setup();
  const businessId = '00000000-0000-4000-8000-000000000001';
  const ownerId = '00000000-0000-4000-8000-000000000002';
  const accepted = await fetch(`${url}/api/businesses/${businessId}/dogs`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'Milo', breed: '', ownerId }) });
  assert.equal(accepted.status, 201);
  assert.deepEqual(calls[0], ['createDog', 'firebase-user', businessId, { name: 'Milo', breed: '', ownerId }]);
  const ambiguous = await fetch(`${url}/api/businesses/${businessId}/dogs`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'Milo', breed: 'Collie', ownerId, owner: { name: 'Owner' } }) });
  assert.equal(ambiguous.status, 400);
});

test('booking input bounds dog count and date window', async () => {
  const { url, calls } = await setup();
  const businessId = '00000000-0000-4000-8000-000000000001';
  const dogIds = Array.from({ length: 9 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
  const tooMany = await fetch(`${url}/api/businesses/${businessId}/bookings`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ dogIds, startDate: '2026-01-01', endDate: '2026-01-02', mutationId: '00000000-0000-4000-8000-000000000099' }) });
  assert.equal(tooMany.status, 400);
  const tooLong = await fetch(`${url}/api/businesses/${businessId}/bookings`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ dogIds: [dogIds[0]], startDate: '2026-01-01', endDate: '2027-01-03', mutationId: '00000000-0000-4000-8000-000000000099' }) });
  assert.equal(tooLong.status, 400); assert.equal(calls.length, 0);
  const maxLength = await fetch(`${url}/api/businesses/${businessId}/bookings`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ dogIds: [dogIds[0]], startDate: '2026-01-01', endDate: '2027-01-01', mutationId: '00000000-0000-4000-8000-000000000098' }) });
  assert.equal(maxLength.status, 201); assert.equal(calls.length, 1);
  const outOfRange = await fetch(`${url}/api/businesses/${businessId}/bookings`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ dogIds: [dogIds[0]], startDate: '1999-12-31', endDate: '2000-01-01', mutationId: '00000000-0000-4000-8000-000000000099' }) });
  assert.equal(outOfRange.status, 400); assert.equal(calls.length, 1);
});

test('rejects client role, plan, tenant identity, malformed values, and oversized body', async () => {
  const { url, calls } = await setup();
  const malicious = await fetch(`${url}/api/businesses`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'X', slug: 'x', timezone: 'UTC', capacity: 3, role: 'owner' }) });
  assert.equal(malicious.status, 400);
  const plan = await fetch(`${url}/api/businesses`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'X', slug: 'xxy', timezone: 'UTC', capacity: 3, plan: 'pro' }) });
  assert.equal(plan.status, 400);
  const reserved = await fetch(`${url}/api/businesses`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'X', slug: 'admin', timezone: 'UTC', capacity: 201 }) });
  assert.equal(reserved.status, 400);
  const bad = await fetch(`${url}/api/businesses`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'X', slug: 'x', timezone: 'Mars/Olympus', capacity: 3 }) });
  assert.equal(bad.status, 400);
  const oversized = await fetch(`${url}/api/invites/accept`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ token: 'x'.repeat(33000) }) });
  assert.equal(oversized.status, 413);
  assert.equal(calls.length, 0);
});

test('maps known database permission errors safely without leaking details', async () => {
  const error = Object.assign(new Error('Only the business owner can do that.'), { status: 403, code: 'owner_required' });
  const { url } = await setup({ store: { exportBusiness: async () => { throw error; } } });
  const response = await fetch(`${url}/api/businesses/00000000-0000-4000-8000-000000000001/export`, { headers: authHeaders });
  const body = await response.json() as any;
  assert.equal(response.status, 403); assert.equal(body.error.code, 'owner_required'); assert.equal(body.error.message, 'Only the business owner can do that.');
  const capacity = Object.assign(new Error('capacity internals'), { status: 409, code: 'capacity_exceeded' });
  const capacitySetup = await setup({ store: { createBooking: async () => { throw capacity; } } });
  const booking = await fetch(`${capacitySetup.url}/api/businesses/00000000-0000-4000-8000-000000000001/bookings`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ dogIds: ['00000000-0000-4000-8000-000000000002'], startDate: '2026-01-01', endDate: '2026-01-01', mutationId: '00000000-0000-4000-8000-000000000003' }) });
  const bookingBody = await booking.json() as any;
  assert.equal(booking.status, 409); assert.equal(bookingBody.error.code, 'capacity_exceeded');
  assert.equal(bookingBody.error.message, 'The requested booking exceeds business capacity.');
});

test('tenant route requires UUID and never trusts forwarding headers for its identity', async () => {
  const { url, calls } = await setup();
  const response = await fetch(`${url}/api/businesses/nope/workspace`, { headers: { ...authHeaders, 'X-Forwarded-For': '198.51.100.2' } });
  assert.equal(response.status, 400); assert.equal(calls.length, 0);
});

test('unverified accounts and URL query parameters cannot reach tenant actions', async () => {
  const { url } = await setup({ verifyToken: async () => ({ uid: 'firebase-user', email: 'x@example.com', email_verified: false }) });
  const unverified = await fetch(`${url}/api/businesses`, { headers: authHeaders });
  assert.equal(unverified.status, 403);
  const query = await fetch(`${url}/api/businesses?access_token=secret`, { headers: authHeaders });
  assert.equal(query.status, 400);
  assert.equal((await query.text()).includes('secret'), false);
});

test('rejects cross-origin requests and does not expose internal errors', async () => {
  const { url } = await setup({ store: { listBusinesses: async () => { throw new Error('secret database detail'); } } });
  assert.equal((await fetch(`${url}/api/businesses`, { headers: { ...authHeaders, Origin: 'https://attacker.invalid' } })).status, 403);
  const response = await fetch(`${url}/api/businesses`, { headers: authHeaders });
  const body = await response.json() as any;
  assert.equal(response.status, 500); assert.equal(body.error.message, 'An unexpected error occurred');
  assert.ok(body.requestId); assert.equal(response.headers.get('cache-control'), 'no-store');
});
