import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createStore} from '../src/database.js';

test('dedicated CI PostgreSQL checks the production connection role, concurrent tenant contexts and booking capacity',async()=>{
 const adminUrl=process.env.PLATFORM_TEST_DATABASE_URL;
 if(!adminUrl)throw Error('Use the dedicated local CI PostgreSQL service');
 const url=new URL(adminUrl);
 if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/palz_ci')throw Error('Only loopback palz_ci is permitted');
 const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
 let store:Awaited<ReturnType<typeof createStore>>|undefined;
 try {
  await admin.query(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
  await admin.query("ALTER ROLE palz_app LOGIN PASSWORD 'local-ci-only-password'");
  await assert.rejects(createStore({databaseUrl:adminUrl}),/non-owner palz_app/);
  url.username='palz_app';url.password='local-ci-only-password';
  store=await createStore({databaseUrl:url.toString()});
  const a=await store.createBusiness('alice',{name:'Alpha',slug:'alpha',timezone:'UTC',capacity:1});
  const b=await store.createBusiness('bob',{name:'Beta',slug:'beta',timezone:'UTC',capacity:1});
  const da=await store.createDog('alice',a.id,{name:'Coco',breed:''});
  const db=await store.createDog('bob',b.id,{name:'Coco',breed:''});
  assert.equal(da.number,1);assert.equal(db.number,1);
  const results=await Promise.all(Array.from({length:20},(_,i)=>i%2?store!.getWorkspace('bob',b.id):store!.getWorkspace('alice',a.id)));
  assert(results.every((w,i)=>w.dogs.length===1&&w.dogs[0].id===(i%2?db.id:da.id)));
  await assert.rejects(store.getWorkspace('alice',b.id),{code:'business_not_found'});
  const second=await store.createDog('alice',a.id,{name:'Other dog',breed:''});
  const booking={dogIds:[da.id],startDate:'2026-12-08',endDate:'2026-12-10',mutationId:randomUUID()};
  const outcomes=await Promise.allSettled([store.createBooking('alice',a.id,booking),store.createBooking('alice',a.id,{...booking,dogIds:[second.id],mutationId:randomUUID()})]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(outcomes.filter(r=>r.status==='rejected'&&r.reason.code==='capacity_exceeded').length,1);
  const workspace=await store.getWorkspace('alice',a.id);assert.equal(workspace.bookings.length,1);
  const winner=outcomes.find(r=>r.status==='fulfilled')! as PromiseFulfilledResult<any>;
  const same={...booking,dogIds:winner.value.dogIds,mutationId:winner.value.dogIds[0]===da.id?booking.mutationId:''};
  if(same.mutationId)assert.equal((await store.createBooking('alice',a.id,same)).id,winner.value.id);
  const invite=await store.createInvite('alice',a.id,{email:'staff@example.test'});
  await store.acceptInvite('staff','staff@example.test',invite.token);
  assert.deepEqual((await store.listBusinesses('staff')).map(x=>x.id),[a.id]);
  await store.disableMember('alice',a.id,'staff');
  await assert.rejects(store.getWorkspace('staff',a.id),{code:'business_not_found'});
 } finally {await store?.close();await admin.end();}
});
