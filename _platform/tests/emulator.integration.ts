import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {startServer} from '../src/server.js';

test('real Auth emulator and PostgreSQL enforce verified identity, tenant scope, invitations and immediate revocation',async()=>{
 assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST || '',/^(127\.0\.0\.1|localhost):9199$/);
 const directory=await mkdtemp(join(tmpdir(),'palz-local-integration-'));
 const app=await startServer({...process.env,PLATFORM_MODE:'local',FIREBASE_PROJECT_ID:'demo-palz-stay',PORT:'4382',DATA_DIR:directory});
 const auth=getAuth(getApps().find(a=>a.options.projectId==='demo-palz-stay')!);
 const created:string[]=[];
 try{
  const account=async(verified=true)=>{
   const email=`test-${randomUUID()}@example.test`,password='Local-Only-Test-Password-84!';
   const u=await auth.createUser({email,password,emailVerified:verified});created.push(u.uid);
   const signIn=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
   assert.equal(signIn.status,200);return {uid:u.uid,email,token:(await signIn.json()).idToken};
  };
  const request=async(token:string,path:string,body?:unknown)=>{
   const response=await fetch(app.config.publicConfig.origin+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
   const data=await response.json();assert.equal(response.headers.get('cache-control'),'no-store');return {response,data};
  };
  const [alice,bob,staff,unverified]=await Promise.all([account(),account(),account(),account(false)]);
  assert.equal((await request('invalid','/api/businesses')).response.status,401);
  assert.equal((await request(unverified.token,'/api/businesses')).response.status,403);
  const business=async(token:string,name:string)=>{
   const r=await request(token,'/api/businesses',{name,slug:`pilot-${randomUUID().slice(0,8)}`,timezone:'Australia/Sydney',capacity:4});assert.equal(r.response.status,201,JSON.stringify(r.data));return r.data;
  };
  const a=await business(alice.token,'Alice boarding'),b=await business(bob.token,'Bob boarding');
  assert.equal((await request(alice.token,`/api/businesses/${b.id}/workspace`)).response.status,404);
  const d=await request(alice.token,`/api/businesses/${a.id}/dogs`,{name:'Coco',breed:'Poodle',owner:{name:'Owner One',email:'owner@example.test'}});assert.equal(d.response.status,201,JSON.stringify(d.data));
  const dog=d.data;
  const second=await request(alice.token,`/api/businesses/${a.id}/dogs`,{name:'Coco',breed:'Spaniel',ownerId:dog.ownerId});assert.equal(second.response.status,201,JSON.stringify(second.data));assert.notEqual(second.data.id,dog.id);
  const foreign=await request(bob.token,`/api/businesses/${b.id}/dogs`,{name:'Foreign',breed:'Pug',ownerId:dog.ownerId});assert.equal(foreign.response.status,400);
  const intent={dogIds:[dog.id],startDate:'2026-12-08',endDate:'2026-12-10',mutationId:randomUUID()};
  const booking=await request(alice.token,`/api/businesses/${a.id}/bookings`,intent);assert.equal(booking.response.status,201);
  const retry=await request(alice.token,`/api/businesses/${a.id}/bookings`,intent);assert.equal(retry.data.id,booking.data.id);
  assert.equal((await request(alice.token,`/api/businesses/${a.id}/bookings`,{...intent,endDate:'2026-12-11'})).response.status,409);
  const invitation=await request(alice.token,`/api/businesses/${a.id}/invites`,{email:staff.email});assert.equal(invitation.response.status,201);
  assert.equal((await request(bob.token,'/api/invites/accept',{token:invitation.data.token})).response.status,400);
  assert.equal((await request(staff.token,'/api/invites/accept',{token:invitation.data.token})).response.status,200);
  assert.equal((await request(staff.token,`/api/businesses/${a.id}/workspace`)).data.role,'staff');
  assert.equal((await request(staff.token,`/api/businesses/${a.id}/export`)).response.status,403);
  assert.equal((await request(alice.token,`/api/businesses/${a.id}/members/${staff.uid}/disable`,{})).response.status,200);
  assert.equal((await request(staff.token,`/api/businesses/${a.id}/workspace`)).response.status,404);
  await auth.updateUser(bob.uid,{disabled:true});
  assert.equal((await request(bob.token,'/api/businesses')).response.status,401);
  const exported=await request(alice.token,`/api/businesses/${a.id}/export`);assert.equal(exported.response.status,200);
  assert.ok(!JSON.stringify(exported.data).includes(invitation.data.token));assert.ok(!JSON.stringify(exported.data).includes(b.id));
  assert.equal((await fetch(app.config.publicConfig.origin+'/src/database.ts')).status,404);
  assert.equal((await fetch(app.config.publicConfig.origin+'/.env')).status,404);
 }finally{await Promise.all(created.map(uid=>auth.deleteUser(uid)));await app.close();await rm(directory,{recursive:true,force:true});}
});
