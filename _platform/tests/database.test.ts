import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createStore, DomainError } from '../src/database.js';

const business = (name: string, slug: string) => ({name,slug,timezone:'Australia/Sydney',capacity:20});

test('restricted PostgreSQL role enforces tenant RLS, scoped foreign keys, and transaction context reset', async () => {
  const db = new PGlite() as any; await db.waitReady;
  await db.exec(await readFile(new URL('../migrations/001_initial.sql', import.meta.url),'utf8'));
  const a=await db.query("INSERT INTO businesses(name,slug,timezone,capacity,created_by) VALUES('A','tenant-a','UTC',10,'alice') RETURNING id");
  const b=await db.query("INSERT INTO businesses(name,slug,timezone,capacity,created_by) VALUES('B','tenant-b','UTC',10,'bob') RETURNING id");
  const aid=a.rows[0].id as string, bid=b.rows[0].id as string;
  await db.query("INSERT INTO members(business_id,user_id,role) VALUES($1,'alice','owner'),($1,'bob','staff'),($2,'bob','owner')",[aid,bid]);
  const dog=await db.query("INSERT INTO dogs(business_id,name,breed) VALUES($1,'A dog','mix') RETURNING id",[aid]);
  const otherDog=await db.query("INSERT INTO dogs(business_id,name,breed) VALUES($1,'B dog','mix') RETURNING id",[bid]);
  // Grant a narrow test-only update permission so this assertion measures RLS filtering.
  await db.query('GRANT UPDATE(name) ON dogs TO palz_app');
  const role=await db.query("SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit,rolcanlogin FROM pg_roles WHERE rolname='palz_app'");
  assert.deepEqual(role.rows[0],{rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolinherit:false,rolcanlogin:false});
  await db.query('BEGIN'); await db.query("SELECT set_config('app.user_id','alice',true)"); await db.query("SELECT set_config('app.business_id',$1,true)",[aid]);
  await db.query("INSERT INTO audit_events(business_id,actor_user_id,event_type) VALUES($1,'alice','test')",[aid]);
  await db.query('SET LOCAL ROLE palz_app'); await db.query('SET LOCAL search_path TO pg_catalog, public, pg_temp');
  await db.query("SELECT set_config('app.user_id','bob',true)");
  await db.query('CREATE TEMP TABLE dogs(business_id uuid,id uuid,name text)');
  await db.query("INSERT INTO pg_temp.dogs(business_id,id,name) VALUES($1,gen_random_uuid(),'shadow')",[bid]);
  await db.query('CREATE TEMP TABLE businesses AS SELECT * FROM public.businesses WHERE false');
  await db.query('CREATE TEMP TABLE members AS SELECT * FROM public.members WHERE false');
  await db.query('CREATE TEMP TABLE audit_events AS SELECT * FROM public.audit_events WHERE false');
  const bootstrapped=await db.query("SELECT bootstrap_create_business('bob','Shadow check','shadow-check','UTC',10) id");
  assert(bootstrapped.rows[0].id);
  assert.equal((await db.query('SELECT app_role($1,$2) role',[bootstrapped.rows[0].id,'bob'])).rows[0].role,'owner');
  await db.query("SELECT set_config('app.business_id',$1,true)",[aid]);
  assert.equal((await db.query('SELECT count(*)::int n FROM dogs')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM dogs WHERE business_id=$1',[bid])).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*)::int n FROM members WHERE user_id='alice'")).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*)::int n FROM audit_events WHERE actor_user_id='alice'")).rows[0].n,0);
  const update=await db.query("UPDATE dogs SET name='stolen' WHERE id=$1 RETURNING id",[otherDog.rows[0].id]); assert.equal(update.rows.length,0);
  await db.query('SAVEPOINT cross_context_write');
  await assert.rejects(db.query("INSERT INTO dogs(business_id,name,breed) VALUES($1,'cross-context','mix')",[bid]));
  await db.query('ROLLBACK TO SAVEPOINT cross_context_write');
  await db.query('SAVEPOINT forged_audit_actor');
  await assert.rejects(db.query("INSERT INTO audit_events(business_id,actor_user_id,event_type) VALUES($1,'alice','forged')",[aid]));
  await db.query('ROLLBACK TO SAVEPOINT forged_audit_actor');
  await assert.rejects(db.query('INSERT INTO bookings(business_id,start_date,end_date,mutation_id,intent_hash) VALUES($1,current_date,current_date,\'x\',\'x\')',[bid]).then(async (r:any)=>db.query('INSERT INTO booking_dogs(business_id,booking_id,dog_id) VALUES($1,$2,$3)',[bid,r.rows[0].id,dog.rows[0].id])));
  await db.query('ROLLBACK');
  // Even an owner-context write cannot use a dog UUID from another tenant because
  // booking_dogs carries a tenant-scoped composite foreign key.
  const foreignBooking=await db.query("INSERT INTO bookings(business_id,start_date,end_date,mutation_id,intent_hash) VALUES($1,current_date,current_date,'fk-test','fk-test') RETURNING id",[bid]);
  await assert.rejects(db.query('INSERT INTO booking_dogs(business_id,booking_id,dog_id) VALUES($1,$2,$3)',[bid,foreignBooking.rows[0].id,dog.rows[0].id]));
  // The same connection has no user context after commit/rollback; it cannot see either tenant.
  await db.query('BEGIN'); await db.query('SET LOCAL ROLE palz_app'); await db.query('SET LOCAL search_path TO pg_catalog, public, pg_temp');
  assert.equal((await db.query('SELECT count(*)::int n FROM dogs')).rows[0].n,0);
  await db.query('ROLLBACK');
  await assert.rejects(db.query("UPDATE businesses SET created_by='forged' WHERE id=$1",[aid]));
  await assert.rejects(db.query("UPDATE members SET user_id='forged' WHERE business_id=$1 AND user_id='alice'",[aid]));
  await assert.rejects(db.query("DELETE FROM members WHERE business_id=$1 AND user_id='alice'",[aid]));
  await db.close();
});

test('store handles idempotent bookings, atomic overlap rejection, owner revocation, and invite constraints', async () => {
  const store=await createStore();
  try {
    const a=await store.createBusiness('owner-a',business('A','test-a'));
    const b=await store.createBusiness('owner-b',business('B','test-b'));
    const dog=await store.createDog('owner-a',a.id,{name:'Nori',breed:'mix'});
    const other=await store.createDog('owner-b',b.id,{name:'Pip',breed:'poodle'});
    assert.equal(dog.number,1); assert.equal(other.number,1);
    const simultaneous=await Promise.all([store.getWorkspace('owner-a',a.id),store.getWorkspace('owner-b',b.id),store.getWorkspace('owner-a',a.id)]);
    assert.deepEqual(simultaneous.map(w=>w.business.id),[a.id,b.id,a.id]);
    await assert.rejects(store.getWorkspace('owner-a',b.id), (e:any)=>e instanceof DomainError && e.status===404);
    const input={dogIds:[dog.id],startDate:'2026-10-20',endDate:'2026-10-21',mutationId:'mutation-1'};
    const first=await store.createBooking('owner-a',a.id,input);
    assert.deepEqual(await store.createBooking('owner-a',a.id,input),first);
    await assert.rejects(store.createBooking('owner-a',a.id,{...input,endDate:'2026-10-22'}),(e:any)=>e.code==='mutation_conflict');
    await assert.rejects(store.createBooking('owner-a',a.id,{dogIds:[dog.id],startDate:'2026-10-21',endDate:'2026-10-23',mutationId:'mutation-2'}),(e:any)=>e.code==='booking_overlap');
    // A failed multi-dog booking leaves no header or partial dog links.
    const secondDog=await store.createDog('owner-a',a.id,{name:'Milo',breed:'mix'});
    await assert.rejects(store.createBooking('owner-a',a.id,{dogIds:[secondDog.id,dog.id],startDate:'2026-10-21',endDate:'2026-10-22',mutationId:'mutation-3'}));
    const ws=await store.getWorkspace('owner-a',a.id); assert.equal(ws.bookings.length,1);
    await assert.rejects(store.createDog('owner-a',a.id,{name:'bad link',breed:'mix',ownerId:other.ownerId ?? other.id}));

    const invite=await store.createInvite('owner-a',a.id,{email:'staff@example.test'});
    await assert.rejects(store.acceptInvite('staff-1','wrong@example.test',invite.token),(e:any)=>e.code==='invite_invalid');
    const joined=await store.acceptInvite('staff-1','staff@example.test',invite.token); assert.equal(joined.id,a.id);
    assert.deepEqual((await store.listBusinesses('staff-1')).map(x=>x.id),[a.id]);
    assert.deepEqual((await store.getWorkspace('staff-1',a.id)).members,[]);
    const ownerMembers=(await store.getWorkspace('owner-a',a.id)).members;
    assert.equal(ownerMembers.find((m:any)=>m.userId==='staff-1')?.email,'staff@example.test');
    await assert.rejects(store.acceptInvite('staff-2','staff@example.test',invite.token),(e:any)=>e.code==='invite_invalid');
    await store.disableMember('owner-a',a.id,'staff-1');
    await assert.rejects(store.getWorkspace('staff-1',a.id),(e:any)=>e.status===404);
    const exported=await store.exportBusiness('owner-a',a.id);
    assert(exported.auditEvents.some((e:any)=>e.event_type==='dog.created' && e.actor_user_id==='owner-a'));
    assert(exported.auditEvents.some((e:any)=>e.event_type==='booking.created' && e.actor_user_id==='owner-a'));
    assert(exported.auditEvents.some((e:any)=>e.event_type==='invite.created' && e.actor_user_id==='owner-a'));
  } finally { await store.close(); }
});

test('database constraints enforce dog and active member pilot quotas', async () => {
  const store=await createStore();
  try {
    const b=await store.createBusiness('quota-owner',business('Quota','quota-business'));
    for(let n=0;n<50;n++) await store.createDog('quota-owner',b.id,{name:`Dog ${n}`,breed:'mix'});
    await assert.rejects(store.createDog('quota-owner',b.id,{name:'Dog 51',breed:'mix'}),(e:any)=>e.code==='dog_limit');
    const i1=await store.createInvite('quota-owner',b.id,{email:'one@example.test'});
    await store.acceptInvite('staff-one','one@example.test',i1.token);
    const i2=await store.createInvite('quota-owner',b.id,{email:'two@example.test'});
    await store.acceptInvite('staff-two','two@example.test',i2.token);
    const i3=await store.createInvite('quota-owner',b.id,{email:'three@example.test'});
    await assert.rejects(store.acceptInvite('staff-three','three@example.test',i3.token),(e:any)=>e.code==='member_limit');
  } finally { await store.close(); }
});

test('business capacity serializes concurrent stays and rejects an over-capacity multi-dog booking atomically', async () => {
  const store=await createStore();
  try {
    const b=await store.createBusiness('capacity-owner',{...business('Capacity','capacity-test'),capacity:1});
    const d1=await store.createDog('capacity-owner',b.id,{name:'One',breed:'mix'});
    const d2=await store.createDog('capacity-owner',b.id,{name:'Two',breed:'mix'});
    const results=await Promise.allSettled([
      store.createBooking('capacity-owner',b.id,{dogIds:[d1.id],startDate:'2026-11-01',endDate:'2026-11-02',mutationId:'capacity-1'}),
      store.createBooking('capacity-owner',b.id,{dogIds:[d2.id],startDate:'2026-11-01',endDate:'2026-11-02',mutationId:'capacity-2'}),
    ]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.filter((r:any)=>r.status==='rejected' && r.reason.code==='capacity_exceeded').length,1);

    const atomic=await store.createBusiness('atomic-owner',{...business('Atomic','atomic-capacity'),capacity:1});
    const dogs=[];
    for(let n=0;n<2;n++) dogs.push(await store.createDog('atomic-owner',atomic.id,{name:`Atomic ${n}`,breed:'mix'}));
    await assert.rejects(store.createBooking('atomic-owner',atomic.id,{dogIds:dogs.map(d=>d.id),startDate:'2026-11-03',endDate:'2026-11-03',mutationId:'atomic-capacity'}),(e:any)=>e.code==='capacity_exceeded');
    assert.equal((await store.getWorkspace('atomic-owner',atomic.id)).bookings.length,0);

    await assert.rejects(store.createBooking('capacity-owner',b.id,{dogIds:[d1.id],startDate:'2026-11-01',endDate:'2027-11-02',mutationId:'too-long'}));
    await assert.rejects(store.createBooking('capacity-owner',b.id,{dogIds:[d1.id],startDate:'1999-12-31',endDate:'1999-12-31',mutationId:'too-early'}));
    await assert.rejects(store.createBooking('capacity-owner',b.id,{dogIds:[d1.id],startDate:'2101-01-01',endDate:'2101-01-01',mutationId:'too-late'}));

    const group=await store.createBusiness('group-owner',business('Group','group-booking'));
    const groupDogs=[];
    for(let n=0;n<9;n++) groupDogs.push(await store.createDog('group-owner',group.id,{name:`Group ${n}`,breed:''}));
    await assert.rejects(store.createBooking('group-owner',group.id,{dogIds:groupDogs.map(d=>d.id),startDate:'2026-12-01',endDate:'2026-12-01',mutationId:'too-many-dogs'}),(e:any)=>e.code==='booking_dog_limit');
    assert.equal((await store.getWorkspace('group-owner',group.id)).dogs[0].breed,'');
  } finally { await store.close(); }
});

test('invite hashes are single use, email bound, and expire in the database', async () => {
  const db=new PGlite() as any; await db.waitReady;
  await db.exec(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
  await db.query("SELECT set_config('app.user_id','owner',false)");
  const b=await db.query("SELECT bootstrap_create_business('owner','Invite','invite-business','UTC',10) id");
  const id=b.rows[0].id as string;
  const token='a-random-secret'; const digest=createHash('sha256').update(token).digest('hex');
  await db.query("INSERT INTO invites(business_id,email,token_hash,expires_at) VALUES($1,'person@example.test',$2,now()+interval '1 hour')",[id,digest]);
  await db.query("INSERT INTO invites(business_id,email,token_hash,expires_at) VALUES($1,'late@example.test',$2,now()-interval '1 second')",[id,createHash('sha256').update('expired').digest('hex')]);
  assert.notEqual(digest,token);
  await db.query('BEGIN'); await db.query('SET LOCAL ROLE palz_app'); await db.query("SELECT set_config('app.user_id','staff',true)");
  assert.equal((await db.query('SELECT accept_invite($1,$2,$3) id',['staff','wrong@example.test',digest])).rows[0].id,null);
  const accepted=await db.query('SELECT accept_invite($1,$2,$3) id',['staff','person@example.test',digest]); assert.equal(accepted.rows[0].id,id);
  await db.query("SELECT set_config('app.user_id','another',true)");
  assert.equal((await db.query('SELECT accept_invite($1,$2,$3) id',['another','person@example.test',digest])).rows[0].id,null);
  await db.query("SELECT set_config('app.user_id','late',true)");
  assert.equal((await db.query('SELECT accept_invite($1,$2,$3) id',['late','late@example.test',createHash('sha256').update('expired').digest('hex')])).rows[0].id,null);
  await db.query('COMMIT');
  assert.equal((await db.query("SELECT count(*)::int n FROM members WHERE business_id=$1 AND role='staff'",[id])).rows[0].n,1);
  await db.close();
});
