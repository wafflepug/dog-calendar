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
