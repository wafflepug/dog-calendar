import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

const here = fileURLToPath(new URL('.', import.meta.url));
const MIGRATION = join(here, '..', 'migrations', '001_initial.sql');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const dateOnly = (value: unknown) => value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10);

export class DomainError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = 'DomainError'; }
}

type Business = { id: string; slug: string; name: string; timezone: string; capacity: number; plan: 'free'; role: 'owner' | 'staff' };
type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount?: number }> };
type Db = Queryable & { connect?: () => Promise<any>; end?: () => Promise<void>; close?: () => Promise<void> };
type StoreOptions = { dataDir?: string; databaseUrl?: string };

export interface Store {
  listBusinesses(uid: string): Promise<Business[]>;
  createBusiness(uid: string, input: { name: string; slug: string; timezone: string; capacity: number }): Promise<Business>;
  getWorkspace(uid: string, businessId: string): Promise<any>;
  createDog(uid: string, businessId: string, input: { name: string; breed: string; ownerId?: string; owner?: { name: string; email?: string; phone?: string } }): Promise<any>;
  createBooking(uid: string, businessId: string, input: { dogIds: string[]; startDate: string; endDate: string; mutationId: string }): Promise<any>;
  createInvite(uid: string, businessId: string, input: { email: string }): Promise<{ token: string; expiresAt: string }>;
  acceptInvite(uid: string, email: string, token: string): Promise<Business>;
  disableMember(uid: string, businessId: string, userId: string): Promise<{ ok: true }>;
  exportBusiness(uid: string, businessId: string): Promise<any>;
  close(): Promise<void>;
}

function domainFrom(err: any): never {
  if (err instanceof DomainError) throw err;
  const msg = String(err?.message || 'Database operation failed');
  if (err?.code === '23505') throw new DomainError(409, 'conflict', 'That value is already in use.');
  if (err?.code === '23503') throw new DomainError(400, 'invalid_reference', 'A referenced record does not belong to this business.');
  if (err?.code === '23P01' || /booking overlap/i.test(msg)) throw new DomainError(409, 'booking_overlap', 'A dog already has a booking during those dates.');
  if (/booking dog limit/i.test(msg)) throw new DomainError(400, 'booking_dog_limit', 'A booking can include up to 8 dogs.');
  if (/dog limit/i.test(msg)) throw new DomainError(409, 'dog_limit', 'This Free pilot business can have up to 50 dogs.');
  if (/member limit/i.test(msg)) throw new DomainError(409, 'member_limit', 'This Free pilot business can have up to 3 active members.');
  if (/booking capacity/i.test(msg)) throw new DomainError(409, 'capacity_exceeded', 'This business is at capacity for one or more selected dates.');
  if (/business limit/i.test(msg)) throw new DomainError(409, 'business_limit', 'This account can create up to 3 active businesses.');
  throw err;
}
function businessRow(r: any): Business { return { id: r.id, slug: r.slug, name: r.name, timezone: r.timezone, capacity: Number(r.capacity), plan: 'free', role: r.role }; }

export async function createStore(options: StoreOptions = {}): Promise<Store> {
  let db: Db;
  let local = false;
  if (options.databaseUrl) {
    const pool = new pg.Pool({ connectionString: options.databaseUrl, max: 10 });
    db = pool as unknown as Db;
    // Production migrations are deliberately external and run with separate credentials.
    const identity = await db.query(`SELECT current_user AS name, r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcreatedb, r.rolcanlogin, r.rolinherit,
      EXISTS(SELECT 1 FROM pg_class c WHERE c.relname IN ('businesses','members','dogs','bookings','invites') AND c.relowner=r.oid) AS owns_tables
      FROM pg_roles r WHERE r.rolname=current_user`);
    const role = identity.rows[0];
    if (role?.name !== 'palz_app' || role.rolsuper || role.rolbypassrls || role.rolcreaterole || role.rolcreatedb || role.rolinherit || !role.rolcanlogin || role.owns_tables) {
      await db.end?.();
      throw new Error('databaseUrl must connect as non-owner palz_app with LOGIN, NO-SUPERUSER, NO-INHERIT, NO-CREATEROLE, NO-CREATEDB, and NO-BYPASSRLS');
    }
  } else {
    local = true;
    const pglite = new PGlite(options.dataDir);
    await pglite.waitReady;
    db = pglite as unknown as Db;
    await pglite.exec('CREATE TABLE IF NOT EXISTS _platform_migrations (migration_id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied=await db.query("SELECT 1 FROM _platform_migrations WHERE migration_id='001_initial'");
    if(!applied.rows.length) {
      await pglite.exec('BEGIN');
      try {
        await pglite.exec(await readFile(MIGRATION, 'utf8'));
        await pglite.query("INSERT INTO _platform_migrations(migration_id) VALUES('001_initial')");
        await pglite.exec('COMMIT');
      } catch(e) { await pglite.exec('ROLLBACK'); await pglite.close(); throw e; }
    }
  }

  let queue: Promise<void> = Promise.resolve();
  async function runTransaction<T>(uid: string, businessId: string | null, work: (c: Queryable) => Promise<T>): Promise<T> {
    const c = db.connect ? await db.connect() : db;
    try {
      await c.query('BEGIN');
      await c.query('SET LOCAL ROLE palz_app');
      await c.query('SET LOCAL search_path TO pg_catalog, public, pg_temp');
      await c.query("SELECT set_config('app.user_id',$1,true), set_config('app.business_id',$2,true)", [uid, businessId ?? '']);
      const value = await work(c);
      await c.query('COMMIT');
      return value;
    } catch (e) {
      try { await c.query('ROLLBACK'); } catch { /* connection may already be closed */ }
      return domainFrom(e);
    } finally { if (c !== db) c.release(); }
  }
  async function transaction<T>(uid: string, businessId: string | null, work: (c: Queryable) => Promise<T>): Promise<T> {
    if (!local) return runTransaction(uid,businessId,work);
    const previous=queue;
    let release!: () => void;
    queue=new Promise<void>(resolve => { release=resolve; });
    await previous;
    try { return await runTransaction(uid,businessId,work); }
    finally { release(); }
  }
  async function member(c: Queryable, uid: string, businessId: string, owner = false) {
    const r = await c.query('SELECT app_role($1,$2) AS role', [businessId, uid]);
    if (!r.rows[0].role) throw new DomainError(404, 'business_not_found', 'Business not found.');
    if (owner && r.rows[0].role !== 'owner') throw new DomainError(403, 'owner_required', 'Only the business owner can do that.');
    return r.rows[0].role as 'owner' | 'staff';
  }
  async function getBusiness(c: Queryable, id: string, role: 'owner'|'staff'): Promise<Business> {
    const r = await c.query('SELECT id,slug,name,timezone,capacity FROM businesses WHERE id=$1', [id]);
    if (!r.rows[0]) throw new DomainError(404, 'business_not_found', 'Business not found.');
    return businessRow({ ...r.rows[0], role });
  }

  return {
    async listBusinesses(uid) {
      return transaction(uid, null, async c => {
        const r = await c.query('SELECT b.id,b.slug,b.name,b.timezone,b.capacity,m.role FROM businesses b JOIN members m ON m.business_id=b.id WHERE m.user_id=$1 AND m.status=\'active\' ORDER BY b.created_at,b.id', [uid]);
        return r.rows.map(businessRow);
      });
    },
    async createBusiness(uid, input) {
      return transaction(uid, null, async c => {
        const r = await c.query('SELECT bootstrap_create_business($1,$2,$3,$4,$5) AS id', [uid, input.name, input.slug, input.timezone, input.capacity]);
        return getBusiness(c, r.rows[0].id, 'owner');
      });
    },
    async getWorkspace(uid, businessId) {
      return transaction(uid, businessId, async c => {
        const role = await member(c, uid, businessId);
        const business = await getBusiness(c, businessId, role);
        const [dogs, owners, bookings, members] = await Promise.all([
          c.query('SELECT id,business_id,number,name,breed,owner_id FROM dogs WHERE business_id=$1 ORDER BY number', [businessId]),
          c.query('SELECT id,name,email,phone FROM owners WHERE business_id=$1 ORDER BY name,id', [businessId]),
          c.query(`SELECT b.id,b.business_id,b.start_date,b.end_date,b.status,coalesce(array_agg(bd.dog_id) FILTER (WHERE bd.dog_id IS NOT NULL),'{}') dog_ids FROM bookings b LEFT JOIN booking_dogs bd ON bd.business_id=b.business_id AND bd.booking_id=b.id WHERE b.business_id=$1 GROUP BY b.id ORDER BY b.start_date,b.id`, [businessId]),
          role === 'owner' ? c.query(`SELECT m.user_id,m.role,m.status,app_invite_email(m.business_id,m.user_id) email
            FROM members m WHERE m.business_id=$1 ORDER BY m.role,m.user_id`, [businessId]) : Promise.resolve({ rows: [] }),
        ]);
        return { business, role, dogs: dogs.rows.map((d:any) => ({id:d.id,businessId:d.business_id,number:Number(d.number),name:d.name,breed:d.breed,ownerId:d.owner_id})), owners: owners.rows,
          bookings: bookings.rows.map((b:any) => ({id:b.id,businessId:b.business_id,dogIds:b.dog_ids,startDate:dateOnly(b.start_date),endDate:dateOnly(b.end_date),status:b.status})),
          members: members.rows.map((m:any) => ({userId:m.user_id,role:m.role,status:m.status,...(m.email ? {email:m.email} : {})})), limits: { dogs: 50, members: 3 } };
      });
    },
    async createDog(uid,businessId,input) {
      return transaction(uid,businessId,async c => {
        await member(c,uid,businessId);
        let ownerId = input.ownerId ?? null;
        if (input.owner) {
          const o = await c.query('INSERT INTO owners(business_id,name,email,phone) VALUES($1,$2,$3,$4) RETURNING id',[businessId,input.owner.name,input.owner.email ?? null,input.owner.phone ?? null]); ownerId=o.rows[0].id;
        }
        const d=await c.query('INSERT INTO dogs(business_id,name,breed,owner_id) VALUES($1,$2,$3,$4) RETURNING id,business_id,number,name,breed,owner_id',[businessId,input.name,input.breed,ownerId]);
        const x=d.rows[0];
        await c.query('INSERT INTO audit_events(business_id,actor_user_id,event_type,details) VALUES($1,$2,$3,$4)',[businessId,uid,'dog.created',JSON.stringify({dogId:x.id})]);
        return {id:x.id,businessId:x.business_id,number:Number(x.number),name:x.name,breed:x.breed,ownerId:x.owner_id};
      });
    },
    async createBooking(uid,businessId,input) {
      return transaction(uid,businessId,async c => {
        await member(c,uid,businessId);
        await c.query('SELECT lock_business_for_booking($1)',[businessId]);
        const dogIds=[...new Set(input.dogIds)].sort();
        const intentHash=hash(JSON.stringify({dogIds,startDate:input.startDate,endDate:input.endDate}));
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${businessId}:${input.mutationId}`]);
        const old=await c.query('SELECT id,intent_hash,start_date,end_date FROM bookings WHERE business_id=$1 AND mutation_id=$2',[businessId,input.mutationId]);
        if(old.rows[0]) {
          if(old.rows[0].intent_hash!==intentHash) throw new DomainError(409,'mutation_conflict','This mutation ID was already used for a different booking.');
          return {id:old.rows[0].id,businessId,dogIds,startDate:dateOnly(old.rows[0].start_date),endDate:dateOnly(old.rows[0].end_date),status:'confirmed'};
        }
        const b=await c.query('INSERT INTO bookings(business_id,start_date,end_date,mutation_id,intent_hash) VALUES($1,$2,$3,$4,$5) RETURNING id',[businessId,input.startDate,input.endDate,input.mutationId,intentHash]);
        for(const dogId of dogIds) await c.query('INSERT INTO booking_dogs(business_id,booking_id,dog_id) VALUES($1,$2,$3)',[businessId,b.rows[0].id,dogId]);
        await c.query('INSERT INTO audit_events(business_id,actor_user_id,event_type,details) VALUES($1,$2,$3,$4)',[businessId,uid,'booking.created',JSON.stringify({bookingId:b.rows[0].id})]);
        return {id:b.rows[0].id,businessId,dogIds,startDate:input.startDate,endDate:input.endDate,status:'confirmed'};
      });
    },
    async createInvite(uid,businessId,input) {
      return transaction(uid,businessId,async c => {
        await member(c,uid,businessId,true);
        const token=randomBytes(32).toString('base64url');
        const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
        await c.query('INSERT INTO invites(business_id,email,token_hash,expires_at) VALUES($1,lower($2),$3,$4)',[businessId,input.email,hash(token),expiresAt]);
        await c.query('INSERT INTO audit_events(business_id,actor_user_id,event_type) VALUES($1,$2,$3)',[businessId,uid,'invite.created']);
        return {token,expiresAt};
      });
    },
    async acceptInvite(uid,email,token) {
      return transaction(uid,null,async c => {
        const r=await c.query('SELECT accept_invite($1,$2,$3) AS id',[uid,email,hash(token)]);
        if(!r.rows[0].id) throw new DomainError(400,'invite_invalid','This invitation is invalid, expired, or already used.');
        const b=await c.query('SELECT id,slug,name,timezone,capacity FROM businesses WHERE id=$1',[r.rows[0].id]);
        const joined=await c.query('SELECT role FROM members WHERE business_id=$1 AND user_id=$2',[r.rows[0].id,uid]);
        return businessRow({...b.rows[0],role:joined.rows[0]?.role ?? 'staff'});
      });
    },
    async disableMember(uid,businessId,userId) {
      return transaction(uid,businessId,async c => {
        await member(c,uid,businessId,true);
        if(userId===uid) throw new DomainError(400,'cannot_disable_self','You cannot disable your own account.');
        const r=await c.query("UPDATE members SET status='disabled' WHERE business_id=$1 AND user_id=$2 AND role='staff' AND status='active' RETURNING user_id",[businessId,userId]);
        if(!r.rows.length) throw new DomainError(404,'member_not_found','Active staff member not found.');
        await c.query('INSERT INTO audit_events(business_id,actor_user_id,event_type,details) VALUES($1,$2,$3,$4)',[businessId,uid,'member.disabled',JSON.stringify({userId})]);
        return {ok:true as const};
      });
    },
    async exportBusiness(uid,businessId) {
      return transaction(uid,businessId,async c => {
        await member(c,uid,businessId,true);
        const [business,dogs,owners,bookings,members,audit] = await Promise.all([
          c.query('SELECT id,slug,name,timezone,capacity,plan,created_at FROM businesses WHERE id=$1',[businessId]),
          c.query('SELECT id,business_id,number,name,breed,owner_id,created_at FROM dogs WHERE business_id=$1 ORDER BY number',[businessId]),
          c.query('SELECT id,name,email,phone FROM owners WHERE business_id=$1 ORDER BY name',[businessId]),
          c.query('SELECT b.id,b.start_date,b.end_date,b.status,array_agg(bd.dog_id) dog_ids FROM bookings b LEFT JOIN booking_dogs bd ON bd.business_id=b.business_id AND bd.booking_id=b.id WHERE b.business_id=$1 GROUP BY b.id ORDER BY b.start_date',[businessId]),
          c.query('SELECT user_id,role,status,created_at FROM members WHERE business_id=$1 ORDER BY user_id',[businessId]),
          c.query('SELECT actor_user_id,event_type,details,created_at FROM audit_events WHERE business_id=$1 ORDER BY created_at',[businessId]),
        ]);
        return {business:business.rows[0],dogs:dogs.rows,owners:owners.rows,bookings:bookings.rows,members:members.rows,auditEvents:audit.rows};
      });
    },
    async close() { if(local) await db.close?.(); else await db.end?.(); },
  };
}
