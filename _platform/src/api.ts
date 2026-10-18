import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Store } from './database.js';

type Identity = { uid: string; email?: string; email_verified: boolean };
type Config = { mode?: string; origin?: string; [key: string]: unknown };
type HandlerOptions = { store: Store; verifyToken: (token: string) => Promise<Identity>; publicConfig: Config };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESERVED = new Set(['uid', 'userId', 'role', 'plan', 'businessId', 'business_id', 'owner_id']);
const SAFE_ERRORS: Record<string, string> = {
  invalid_request: 'The request is invalid.', invalid_json: 'Request body must be valid JSON.', unsupported_media_type: 'Content-Type must be application/json.',
  payload_too_large: 'Request body is too large.', unauthorized: 'Authentication required.', email_unverified: 'A verified email is required.',
  email_required: 'A verified email is required.', origin_denied: 'Origin is not allowed.', rate_limited: 'Too many requests.', not_found: 'Route not found.',
  conflict: 'That value is already in use.', invalid_reference: 'A referenced record does not belong to this business.', booking_overlap: 'A dog already has a booking during those dates.',
  dog_limit: 'This Free pilot business can have up to 50 dogs.', member_limit: 'This Free pilot business can have up to 3 active members.',
  booking_dog_limit: 'This booking exceeds the number of dogs allowed for the business.',
  business_limit: 'This account can create up to 3 active businesses.', business_not_found: 'Business not found.', owner_required: 'Only the business owner can do that.',
  capacity_exceeded: 'The requested booking exceeds business capacity.',
  mutation_conflict: 'This mutation ID was already used for a different booking.', invite_invalid: 'This invitation is invalid, expired, or already used.',
  cannot_disable_self: 'You cannot disable your own account.', member_not_found: 'Active staff member not found.',
};

export function createHandler({ store, verifyToken, publicConfig }: HandlerOptions) {
  // Fixed-size, opportunistically cleaned buckets. The key is the socket peer only;
  // forwarded headers are controlled by clients and are intentionally ignored.
  const limits = new Map<string, { start: number; count: number }>();
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status: number, body: unknown, protectedResponse = false) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (protectedResponse) res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname === '/health' && req.method === 'GET') return send(200, { ok: true });
      if (url.pathname === '/api/config' && req.method === 'GET') return send(200, publicConfiguration(publicConfig));
      if (url.search) throw httpError(400, 'invalid_request', 'Query parameters are not accepted');
      if (!url.pathname.startsWith('/api/')) throw httpError(404, 'not_found', 'Route not found');
      const origin = req.headers.origin;
      if (origin && (!publicConfig.origin || origin !== publicConfig.origin)) throw httpError(403, 'origin_denied', 'Origin is not allowed');

      const remoteAddress = req.socket.remoteAddress ?? 'unknown';
      const now = Date.now();
      if (limits.size >= 4096) for (const [key, entry] of limits) if (now - entry.start >= 60_000) limits.delete(key);
      const ip = limits.has(remoteAddress) || limits.size < 4096 ? remoteAddress : '__overflow__';
      let bucket = limits.get(ip);
      if (!bucket || now - bucket.start >= 60_000) { bucket = { start: now, count: 0 }; limits.set(ip, bucket); }
      if (++bucket.count > 120) throw httpError(429, 'rate_limited', 'Too many requests');

      const authorization = req.headers.authorization;
      if (!authorization || !/^Bearer [^\s]+$/.test(authorization)) throw httpError(401, 'unauthorized', 'Authentication required');
      let identity: Identity;
      try { identity = await verifyToken(authorization.slice(7)); }
      catch { throw httpError(401, 'unauthorized', 'Authentication required'); }
      if (!identity?.uid || identity.email_verified !== true) throw httpError(403, 'email_unverified', 'A verified email is required');

      const parts = url.pathname.split('/').filter(Boolean).map((part) => {
        try { return decodeURIComponent(part); } catch { throw httpError(400, 'invalid_request', 'Invalid path'); }
      });
      const method = req.method ?? 'GET';
      if (parts[0] !== 'api') throw httpError(404, 'not_found', 'Route not found');
      if (parts.length === 2 && parts[1] === 'businesses' && method === 'GET') return send(200, await store.listBusinesses(identity.uid), true);
      if (parts.length === 2 && parts[1] === 'businesses' && method === 'POST') {
        const body = await readBody(req);
        exactKeys(body, ['name', 'slug', 'timezone', 'capacity']);
        const name = str(body.name, 'name', 1, 120); const slug = str(body.slug, 'slug', 3, 40);
        if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug) || ['app', 'auth', 'www', 'admin', 'support', 'api', 'status'].includes(slug)) throw invalid('slug');
        const timezone = str(body.timezone, 'timezone', 1, 80); validTimezone(timezone);
        const capacity = integer(body.capacity, 'capacity', 1, 200);
        return send(201, await store.createBusiness(identity.uid, { name, slug, timezone, capacity }), true);
      }
      if (parts.length >= 3 && parts[1] === 'businesses') {
        const businessId = uuid(parts[2], 'businessId');
        if (parts.length === 4 && parts[3] === 'workspace' && method === 'GET') return send(200, await store.getWorkspace(identity.uid, businessId), true);
        if (parts.length === 4 && parts[3] === 'dogs' && method === 'POST') {
          const body = await readBody(req); exactKeys(body, ['name', 'breed', 'ownerId', 'owner']);
          if (body.ownerId !== undefined && body.owner !== undefined) throw invalid('owner');
          const input: { name: string; breed: string; ownerId?: string; owner?: { name: string; email?: string; phone?: string } } = { name: str(body.name, 'name', 1, 120), breed: str(body.breed, 'breed', 0, 120) };
          if (body.ownerId !== undefined) input.ownerId = uuid(body.ownerId, 'ownerId');
          if (body.owner !== undefined) {
            const owner = object(body.owner, 'owner'); exactKeys(owner, ['name', 'email', 'phone']);
            input.owner = { name: str(owner.name, 'owner.name', 1, 120), ...(owner.email === undefined ? {} : { email: email(owner.email) }), ...(owner.phone === undefined ? {} : { phone: str(owner.phone, 'owner.phone', 3, 32) }) };
          }
          return send(201, await store.createDog(identity.uid, businessId, input), true);
        }
        if (parts.length === 4 && parts[3] === 'bookings' && method === 'POST') {
          const body = await readBody(req); exactKeys(body, ['dogIds', 'startDate', 'endDate', 'mutationId']);
          if (!Array.isArray(body.dogIds) || body.dogIds.length < 1 || body.dogIds.length > 8) throw invalid('dogIds');
          const dogIds = body.dogIds.map((id: unknown) => uuid(id, 'dogIds'));
          if (new Set(dogIds).size !== dogIds.length) throw invalid('dogIds');
          const startDate = date(body.startDate, 'startDate'); const endDate = date(body.endDate, 'endDate');
          if (endDate < startDate) throw invalid('endDate');
          if (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`) >= 366 * 86400000) throw invalid('endDate');
          return send(201, await store.createBooking(identity.uid, businessId, { dogIds, startDate, endDate, mutationId: uuid(body.mutationId, 'mutationId') }), true);
        }
        if (parts.length === 4 && parts[3] === 'invites' && method === 'POST') {
          const body = await readBody(req); exactKeys(body, ['email']);
          return send(201, await store.createInvite(identity.uid, businessId, { email: email(body.email) }), true);
        }
        if (parts.length === 4 && parts[3] === 'export' && method === 'GET') return send(200, await store.exportBusiness(identity.uid, businessId), true);
        if (parts.length === 6 && parts[3] === 'members' && parts[5] === 'disable' && method === 'POST') {
          const targetUid = str(parts[4], 'uid', 1, 128); if (targetUid === identity.uid) throw httpError(400, 'invalid_request', 'Cannot disable yourself');
          await emptyBodyIfPresent(req);
          return send(200, await store.disableMember(identity.uid, businessId, targetUid), true);
        }
      }
      if (parts.length === 3 && parts[1] === 'invites' && parts[2] === 'accept' && method === 'POST') {
        if (!identity.email) throw httpError(403, 'email_required', 'A verified email is required');
        const body = await readBody(req); exactKeys(body, ['token']);
        const result = await store.acceptInvite(identity.uid, identity.email, str(body.token, 'token', 32, 512));
        return send(200, result, true);
      }
      throw httpError(404, 'not_found', 'Route not found');
    } catch (error: any) {
      const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
      const message = status < 500 && typeof error?.code === 'string' ? SAFE_ERRORS[error.code] : undefined;
      const code = message ? error.code : 'internal_error';
      send(status, { error: { code, message: message ?? 'An unexpected error occurred' }, requestId }, true);
    }
  };
}

function httpError(status: number, code: string, message: string) { return Object.assign(new Error(message), { status, code }); }
function publicConfiguration(config: Config) {
  const firebase = object(config.firebase, 'public configuration');
  const keys = ['apiKey', 'authDomain', 'projectId', 'appId', 'messagingSenderId', 'storageBucket', 'measurementId'];
  const safeFirebase = Object.fromEntries(keys.filter((key) => typeof firebase[key] === 'string' && firebase[key].length <= 256).map((key) => [key, firebase[key]]));
  const result: Record<string, unknown> = { mode: config.mode === 'production' ? 'production' : 'local', firebase: safeFirebase };
  if (result.mode === 'local' && typeof config.emulatorUrl === 'string') {
    try {
      const emulator = new URL(config.emulatorUrl);
      if (['localhost', '127.0.0.1'].includes(emulator.hostname) && emulator.protocol === 'http:') result.emulatorUrl = emulator.toString().replace(/\/$/, '');
    } catch { /* malformed optional development setting is omitted */ }
  }
  return result;
}
function invalid(field: string): Error { return httpError(400, 'invalid_request', `Invalid ${field}`); }
function object(value: any, field: string): Record<string, any> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(field); return value; }
function exactKeys(value: any, allowed: string[]) { object(value, 'body'); if (Object.keys(value).some((key) => RESERVED.has(key) || !allowed.includes(key))) throw httpError(400, 'invalid_request', 'Unexpected field'); }
function str(value: any, field: string, min: number, max: number): string { if (typeof value !== 'string' || value.trim() !== value || value.length < min || value.length > max) throw invalid(field); return value; }
function integer(value: any, field: string, min: number, max: number): number { if (!Number.isInteger(value) || value < min || value > max) throw invalid(field); return value; }
function uuid(value: any, field: string): string { if (typeof value !== 'string' || !UUID.test(value)) throw invalid(field); return value; }
function email(value: any): string { const s = str(value, 'email', 3, 254); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw invalid('email'); return s.toLowerCase(); }
function date(value: any, field: string): string { const s = str(value, field, 10, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw invalid(field); const year = Number(s.slice(0, 4)); const parsed = new Date(`${s}T00:00:00.000Z`); if (year < 2000 || year > 2100 || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== s) throw invalid(field); return s; }
function validTimezone(value: string) { try { new Intl.DateTimeFormat('en', { timeZone: value }); } catch { throw invalid('timezone'); } }
async function readBody(req: IncomingMessage): Promise<Record<string, any>> {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw httpError(415, 'unsupported_media_type', 'Content-Type must be application/json');
  const declared = Number(req.headers['content-length'] ?? 0);
  if (Number.isFinite(declared) && declared > 32768) throw httpError(413, 'payload_too_large', 'Request body is too large');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += data.length; if (size > 32768) throw httpError(413, 'payload_too_large', 'Request body is too large'); chunks.push(data); }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw httpError(400, 'invalid_json', 'Request body must be valid JSON'); }
  return object(parsed, 'body');
}
async function emptyBodyIfPresent(req: IncomingMessage) { if (Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding']) { const body = await readBody(req); exactKeys(body, []); } }
