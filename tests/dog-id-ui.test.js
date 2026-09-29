const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const booking = fs.readFileSync('phase4-booking.js', 'utf8');
const care = fs.readFileSync('care.js', 'utf8');
const roster = fs.readFileSync('waffle-app.js', 'utf8');
const master = fs.readFileSync('waffle-v11.0.js', 'utf8');

test('confirmed booking defaults to new identity and labels exact existing choices', () => {
  assert.match(booking, /<option value="">New dog \(create a new identity\)<\/option>/);
  assert.match(booking, /action:'list_dog_identities'/);
  assert.match(booking, /Dog ID \$\{number\}/);
  assert.match(booking, /item\.ownerName/);
  assert.match(booking, /item\.maskedPhoneTail/);
  assert.match(booking, /if\(v\.dogId\)payload\.dogId=v\.dogId/);
  assert.match(booking, /copyPreviousProfile:!!v\.dogId/);
  assert.doesNotMatch(booking, /function updateDecision\(\)[^\n]*returning\(/);
  assert.doesNotMatch(booking, /get_returning_guest_prefill/);
  assert.match(booking, /sameName\.length>1/);
});

test('Care cards retain Dog IDs and history/master reads use the exact ID', () => {
  assert.match(roster, /booking\.dogId \|\| ''/);
  assert.match(roster, /data-directory-dog-id="\$\{escapeDashboardHtml\(dogId\)\}"/);
  assert.match(roster, /Dog ID \$\{escapeDashboardHtml\(dogNumber\)\}/);
  assert.match(care, /action: 'get_dog_history', dogName, \.\.\.\(dogId \? \{ dogId \} : \{\}\)/);
  assert.match(care, /action: 'get_dog_master_profile', dogName, \.\.\.\(dogId \? \{ dogId \} : \{\}\), breed/);
  assert.match(master, /key=dogId\?`id:\$\{dogId\}`/);
  assert.match(master, /dogName:dog,\.\.\.\(dogId\?\{dogId\}:\{\}\)/);
});

test('legacy Care ID backfill stays explicit and name-only booking paths never copy profiles', () => {
  assert.match(booking, /action:'backfill_dog_ids'/);
  assert.match(booking, /if\(!confirm\('Assign missing Dog IDs and numbers to older bookings/);

  const core = {
    parseBooking: () => ({ dogName: 'Coco', startDate: '2026-10-01', endDate: '2026-10-02' }),
    today: () => '2026-10-01',
    parseRange: () => ({ startDate: '', endDate: '' })
  };
  const sandbox = {
    window: { WAFFLE_PHASE4_CORE: core },
    document: { addEventListener() {} }
  };
  vm.runInNewContext(fs.readFileSync('phase4-ai-actions.js', 'utf8'), sandbox);
  const proposed = sandbox.window.WAFFLE_PHASE4_AI_ACTIONS.parse('book Coco again');
  assert.equal(proposed.copyPreviousProfile, undefined);
  assert.doesNotMatch(fs.readFileSync('waffle-v10.8.js', 'utf8'), /copyPreviousProfile:m\.querySelector\('\[data-v108-copy-profile\]'\)/);
  assert.doesNotMatch(fs.readFileSync('phase4-ai-actions.js', 'utf8'), /copyPreviousProfile:meta\.copyPreviousProfile/);
});

test('local stay counts separate same-name dogs when a Dog ID is supplied', () => {
  const firstId = '11111111-1111-4111-8111-111111111111';
  const secondId = '22222222-2222-4222-8222-222222222222';
  const csv = [
    'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Dog Number',
    `2026-01-01,Coco,Spoodle,2026-01-02,2026-01-03,Alice,0400000000,,,,,Boarding,Other,${firstId},#00001`,
    `2026-02-01,Coco,Spoodle,2026-02-02,2026-02-03,Alice,0400000000,,,,,Boarding,Other,${firstId},#00001`,
    `2026-03-01,Coco,Staffy,2026-03-02,2026-03-03,Bob,0411111111,,,,,Boarding,Other,${secondId},#00002`,
    '2026-04-01,Waffle,Pug,2026-04-02,2026-04-03,Owner,0422222222,,,,,Boarding,Other,Other,#00003'
  ].join('\n');
  const sandbox = {
    window: {},
    document: { readyState: 'loading', body: { dataset: {} }, addEventListener() {}, getElementById() { return null; } },
    localStorage: { getItem(key) { return key === 'boardingDataCache' ? csv : null; }, setItem() {} },
    setTimeout,
    clearTimeout,
    Date
  };
  vm.runInNewContext(fs.readFileSync('phase4-core.js', 'utf8'), sandbox);
  const core = sandbox.window.WAFFLE_PHASE4_CORE;
  assert.equal(core.visits('Coco').length, 3, 'legacy name-only view remains available for non-identity workflows');
  assert.equal(core.visits('Coco', firstId).length, 2);
  assert.equal(core.visits('Coco', secondId).length, 1);
  assert.equal(core.rows()[0].dogNumber, '#00001');
  assert.equal(core.rows()[0].dogId, firstId);
  assert.equal(core.visits('Coco', 'Other').length, 0);
  assert.equal(core.rows()[3].dogId, '');
  assert.equal(core.rows()[3].dogNumber, '', 'A display number cannot survive an invalid internal ID');
});

test('Dog record renders the exact Dog ID and makes saved, derived, contact and unknown safety state clear', () => {
  const risk = master.match(/function v110MasterRiskBadges\(flags\)\{[^\n]+/)[0];
  const render = master.match(/function v110RenderMasterProfile\(card,r,opt=\{\}\)\{[^\n]+/)[0];
  const sandbox = {
    escapeDashboardHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    card: null
  };
  vm.runInNewContext(`function v110Escape(v){return escapeDashboardHtml(v==null?'':String(v));}\n${risk}\n${render}`, sandbox);
  const host = { innerHTML: '' };
  sandbox.card = { dataset:{ directoryDogName:'Milo', directoryDogNumber:'#00007' }, querySelector(){ return host; } };
  sandbox.v110RenderMasterProfile(sandbox.card, { dogName:'Milo', breed:'Pug', ownerName:'Sam Owner', phone:'0400 123 456', dogNumber:'#00007', persisted:true, riskFlags:{ foodAllergy:true }, notes:'No chicken' });
  assert.match(host.innerHTML, /Dog ID #00007/);
  assert.match(host.innerHTML, /Milo/);
  assert.match(host.innerHTML, /Sam Owner/);
  assert.match(host.innerHTML, /tel:0400 123 456/);
  assert.match(host.innerHTML, /Saved master profile/);
  assert.match(host.innerHTML, /Food allergy/);
  assert.doesNotMatch(host.innerHTML, /No care alerts recorded/);
  assert.match(host.innerHTML, /<details class="v110-master-note">/);

  sandbox.v110RenderMasterProfile(sandbox.card, { dogName:'Milo', dogNumber:'#00007', persisted:false, riskFlags:{} });
  assert.match(host.innerHTML, /Derived from stay history/);
  assert.match(host.innerHTML, /Safety status incomplete/);
  assert.doesNotMatch(host.innerHTML, /No care alerts recorded/);
});

test('Dog record reads remain tab-triggered and failed loads expose a forced retry', () => {
  assert.match(master, /if\(name==='master'\)v110LoadMasterProfile\(card\)/);
  assert.match(master, /data-v110-master-retry/);
  assert.match(master, /v110LoadMasterProfile\(retryMaster\.closest\('\.directory-card'\),\{force:true\}\)/);
  assert.match(care, /data-v11160-master-retry/);
  assert.match(care, /const retry = event\.target\.closest\('\[data-v11160-master-retry\]'\);[\s\S]*?callNamed\('v110LoadMasterProfile', \[card, \{ force:true \}\]\)/);
  assert.doesNotMatch(care, /data-v11160-master-save|save_dog_master_profile/);
});

test('failed Dog record read displays an error and Retry recovers on a forced second read', async () => {
  const render = master.match(/function v110RenderMasterProfile\(card,r,opt=\{\}\)\{[^\n]+/)[0];
  const risk = master.match(/function v110MasterRiskBadges\(flags\)\{[^\n]+/)[0];
  const load = master.match(/async function v110LoadMasterProfile\(card,opt=\{\}\)\{[^\n]+/)[0];
  let calls = 0;
  const host = { innerHTML: '' };
  const breedNode = { textContent:'Pug' };
  const sandbox = {
    escapeDashboardHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    v110MasterCache: {},
    queryAppsScriptSWR: async () => {
      calls += 1;
      if (calls === 1) throw new Error('temporary network failure');
      return { data:{ record:{ dogName:'Milo', dogNumber:'#00007', persisted:false, riskFlags:{} } } };
    }
  };
  vm.runInNewContext(`function v110Escape(v){return escapeDashboardHtml(v==null?'':String(v));}\n${risk}\n${render}\n${load}`, sandbox);
  const card = { dataset:{ directoryDogName:'Milo', directoryDogId:'dog-7', directoryDogNumber:'#00007' }, querySelector(selector){ return selector === '[data-v110-master-host]' ? host : selector === '.directory-primary-breed' ? breedNode : null; } };
  await sandbox.v110LoadMasterProfile(card);
  assert.match(host.innerHTML, /role="alert"/);
  assert.match(host.innerHTML, /temporary network failure/);
  assert.match(host.innerHTML, /data-v110-master-retry/);
  await sandbox.v110LoadMasterProfile(card, { force:true });
  assert.equal(calls, 2);
  assert.match(host.innerHTML, /Dog ID #00007/);
  assert.match(host.innerHTML, /Safety status incomplete/);
});

test('offline cached dog record is labelled saved, while a validated unchanged response is fresh', async () => {
  const render = master.match(/function v110RenderMasterProfile\(card,r,opt=\{\}\)\{[^\n]+/)[0];
  const risk = master.match(/function v110MasterRiskBadges\(flags\)\{[^\n]+/)[0];
  const load = master.match(/async function v110LoadMasterProfile\(card,opt=\{\}\)\{[^\n]+/)[0];
  let calls = 0;
  const host = { innerHTML: '' };
  const sandbox = {
    escapeDashboardHtml: value => String(value),
    v110MasterCache: {},
    queryAppsScriptSWR: async () => {
      calls += 1;
      const data = { record:{ dogName:'Milo', dogNumber:'#00007', persisted:true, riskFlags:{} } };
      return calls === 1
        ? { ...data, data, cacheApplied:true, unchanged:true, offlineFallback:true }
        : { ...data, data, cacheApplied:true, unchanged:true, offlineFallback:false };
    }
  };
  vm.runInNewContext(`function v110Escape(v){return escapeDashboardHtml(v==null?'':String(v));}\n${risk}\n${render}\n${load}`, sandbox);
  const card = { dataset:{ directoryDogName:'Milo', directoryDogId:'dog-7' }, querySelector(selector){ return selector === '[data-v110-master-host]' ? host : null; } };
  await sandbox.v110LoadMasterProfile(card);
  assert.match(host.innerHTML, /Showing saved profile data offline/);
  await sandbox.v110LoadMasterProfile(card, { force:true });
  assert.match(host.innerHTML, /Profile refreshed just now/);
});
