import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configuration} from '../src/server.js';
test('startup fails closed without an isolated identity and production database',()=>{
 assert.throws(()=>configuration({PLATFORM_MODE:'production'}));
 assert.throws(()=>configuration({PLATFORM_MODE:'local',FIREBASE_PROJECT_ID:'waffle-house-real',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9199'}));
 assert.throws(()=>configuration({PLATFORM_MODE:'local',FIREBASE_AUTH_EMULATOR_HOST:'external.test:9199'}));
 const c=configuration({PLATFORM_MODE:'local',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9199'});
 assert.equal(c.host,'127.0.0.1');assert.equal(c.projectId,'demo-palz-stay');assert.equal(c.databaseUrl,undefined);
 assert.throws(()=>configuration({PLATFORM_MODE:'production',FIREBASE_PROJECT_ID:'demo-palz-stay',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9199',DATABASE_URL:'postgres://admin@localhost/palz'}));
});

test('hosted pilot requires a dedicated project, an invite list and verified database TLS', () => {
 const env = {
  PLATFORM_MODE:'production', PLATFORM_ORIGIN:'https://palz-pilot.example.com',
  FIREBASE_PROJECT_ID:'palz-stay-pilot', FIREBASE_WEB_API_KEY:'public-key',
  FIREBASE_APP_ID:'public-app-id', PLATFORM_PILOT_EMAILS:' Boarder@example.com ',
  DATABASE_URL:'postgresql://palz_app@db.example.com/palz?sslmode=verify-full'
 };
 assert.deepEqual([...configuration(env).pilotEmails!], ['boarder@example.com']);
 assert.throws(() => configuration({...env, PLATFORM_PILOT_EMAILS:''}), /allowlist/);
 assert.throws(() => configuration({...env, FIREBASE_PROJECT_ID:'wafflehouse-86739'}), /separate Firebase/);
 assert.throws(() => configuration({...env, DATABASE_URL:env.DATABASE_URL.replace('verify-full','disable')}), /verify-full/);
});
