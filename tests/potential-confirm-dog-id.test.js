const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const core = fs.readFileSync(path.join(__dirname, '..', 'waffle-v11.0.5-core.js'), 'utf8');

const app = fs.readFileSync(path.join(__dirname, '..', 'waffle-app.js'), 'utf8');
const editStart = app.indexOf('    function openEditPotentialModal(');
const editEnd = app.indexOf('    function getLocalArray(', editStart);
const buildStart = app.indexOf('    function buildConfirmedEvent(');
const buildEnd = app.indexOf('    function countDogsInName(', buildStart);
const clickStart = app.indexOf("document.getElementById('confirmStayBtn').addEventListener('click'");
const clickEnd = app.indexOf("document.getElementById('deletePotentialBtn').addEventListener('click'", clickStart);
const identityStart = core.indexOf('function v1105ConfirmedStayIdentity(');
const identityEnd = core.indexOf('v1104ComposeCalendarEvents =', identityStart);
assert(editStart >= 0 && editEnd > editStart && buildStart >= 0 && buildEnd > buildStart);
assert(clickStart >= 0 && clickEnd > clickStart && identityStart >= 0 && identityEnd > identityStart);

function harness() {
  const fields = new Map();
  let script = '';
  const document = {
    getElementById(id) {
      if (!fields.has(id)) fields.set(id, { value:'', innerText:'', style:{} });
      return fields.get(id);
    }
  };
  const context = {
    document,
    stringToColor: () => '#123456',
    buildDisplayEndDate: date => date,
    Date, String, Number, Math, Array, Object
  };
  script = `${app.slice(editStart, editEnd)}\n${app.slice(buildStart, buildEnd)}\nthis.open=openEditPotentialModal;this.build=buildConfirmedEvent;this.editing=()=>activeEditingPotential;`;
  vm.runInNewContext(script, context);
  return context;
}

test('editing a potential booking retains Dog ID through local confirmation event creation', () => {
  const api = harness();
  const dogId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  api.open({
    id:'potential-row', startStr:'2026-10-05',
    extendedProps:{dogName:'Milo',breed:'Labrador',rawStartDate:'2026-10-05',rawEndDate:'2026-10-09',owner:'Alex Owner',phone:'0400 111 222',dogId}
  });
  assert.equal(api.editing().dogId, dogId);
  const confirmed = api.build('confirmed_123','Milo','Labrador','2026-10-05','2026-10-09','Alex Owner','0400 111 222','',api.editing().dogId);
  assert.equal(confirmed.extendedProps.dogId, dogId);
});

function confirmationHarness(existing = []) {
  const values = new Map([
    ['temporaryConfirmedStays', JSON.stringify(existing)],
    ['temporaryPotentialStays', JSON.stringify([{id:'potential-row'}])],
    ['pendingPotentialRemovals', '[]']
  ]);
  const fields = new Map();
  let submit;
  const confirmButton = { disabled:false, innerText:'Confirm Stay', style:{}, addEventListener(type, listener) { if (type === 'click') submit = listener; } };
  const document = {
    getElementById(id) {
      if (id === 'confirmStayBtn') return confirmButton;
      if (!fields.has(id)) fields.set(id, { value:'', innerText:'', style:{} });
      return fields.get(id);
    }
  };
  Object.assign(fields.get('potDogName') || {}, {value:'Milo'});
  const fieldValues = {potDogName:'Milo',potBreed:'Labrador',potStartDate:'2026-10-05',potEndDate:'2026-10-09',potOwnerName:'Alex Owner',potPhone:'0400 111 222',potNotes:'Confirmed'};
  for (const [id, value] of Object.entries(fieldValues)) document.getElementById(id).value = value;
  const sandbox = {
    document, localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))},
    getLocalArray(key){try{return JSON.parse(values.get(key)||'[]');}catch(_){return[];}},
    setLocalArray(key,value){values.set(key,JSON.stringify(value));},
    makePotentialKey:(dog,start,end)=>`${String(dog||'').trim().toLowerCase()}|${start}|${end||start}`,
    addPendingPotentialRemoval(key){const pending=JSON.parse(values.get('pendingPotentialRemovals')||'[]');if(!pending.includes(key))pending.push(key);values.set('pendingPotentialRemovals',JSON.stringify(pending));},
    refreshCalendarData(){}, confirm:()=>true, alert(message){throw new Error(message);},
    sendPayloadToAppsScript:async payload=>({result:'success',payload}),
    stringToColor:()=>'#123456',buildDisplayEndDate:date=>date,
    Date,String,Number,Math,Array,Object,Set,Map,JSON,console
  };
  vm.runInNewContext(`${core.slice(identityStart, identityEnd)}\n${app.slice(editStart, editEnd)}\n${app.slice(buildStart, buildEnd)}\n${app.slice(clickStart, clickEnd)}\nthis.open=openEditPotentialModal;`, sandbox);
  return {sandbox, open:sandbox.open, submit:()=>submit.call(confirmButton), read:key=>JSON.parse(values.get(key)||'[]')};
}

function potential(dogId='') {
  return {id:'potential-row',startStr:'2026-10-05',extendedProps:{dogName:'Milo',breed:'Labrador',rawStartDate:'2026-10-05',rawEndDate:'2026-10-09',owner:'Alex Owner',phone:'0400 111 222',dogId}};
}

function localConfirmed(dogId='', owner='Alex Owner', phone='0400 111 222') {
  return {
    id:`confirmed-${dogId||'legacy'}-${owner}`,title:'Milo',start:'2026-10-05',end:'2026-10-10',
    extendedProps:{dogName:'Milo',breed:'Labrador',owner,ownerName:owner,phone,dogId,rawStartDate:'2026-10-05',rawEndDate:'2026-10-09',bookingType:'Confirmed Boarding'}
  };
}

test('actual confirm button preserves another owner and conflicting Dog IDs when the new confirmation has no Dog ID', async () => {
  const existing = [localConfirmed('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),localConfirmed('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),localConfirmed('', 'Jordan Owner','0400 333 444')];
  const api = confirmationHarness(existing);
  api.open(potential(''));
  await api.submit();
  const owners = api.read('temporaryConfirmedStays').map(event=>event.extendedProps.ownerName);
  assert.deepEqual(owners,['Alex Owner','Alex Owner','Jordan Owner','Alex Owner']);
});

test('actual confirm retries collapse only after shared identity proves the same persisted Dog ID', async () => {
  const dogId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const api=confirmationHarness([localConfirmed(dogId)]);
  api.open(potential(dogId));
  await api.submit();
  assert.equal(api.read('temporaryConfirmedStays').length,1);
  assert.equal(api.read('temporaryConfirmedStays')[0].extendedProps.dogId,dogId);
});


test('actual confirmation click carries the selected Dog ID into a newly created local stay', async () => {
  const dogId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const api = confirmationHarness();
  api.open(potential(dogId));
  await api.submit();
  const stays = api.read('temporaryConfirmedStays');
  assert.equal(stays.length, 1);
  assert.equal(stays[0].extendedProps.dogId, dogId);
  assert.equal(stays[0].extendedProps.rawStartDate, '2026-10-05');
  assert.equal(stays[0].extendedProps.rawEndDate, '2026-10-09');
});
