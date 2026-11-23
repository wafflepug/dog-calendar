const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');

const stayId = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const dogId = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001';
const booking = {dogName:'Maple',stayId,dogId,stayKey:'maple|2026-11-24|2026-11-26',startDate:'2026-11-24',endDate:'2026-11-26'};
const sale = {channel:'direct',priceType:'fixed',rate:15000,total:15000,dueDate:'2026-11-26',expenses:500,payments:[],bookkeepingNote:'Food'};
const source = file => fs.readFileSync('apps-script/'+file,'utf8');
const digest = (_, value) => Array.from(crypto.createHash('sha256').update(value).digest(), byte => byte > 127 ? byte-256 : byte);

function fixture() {
  const tabs = new Map();
  function makeSheet() {
    const rows = [];
    return {getLastRow:()=>rows.length,getMaxRows:()=>100,getDataRange:()=>({getValues:()=>rows}),
      appendRow:row=>rows.push(row),
      getRange:(start,column,height,width)=>({
        getValues:()=>rows.slice(start-1,start-1+height).map(row=>row.slice(column-1,column-1+width)),
        clearContent:()=>rows.slice(start-1,start-1+height).forEach(row=>row.fill('',column-1,column-1+width)),
        setValues:batch=>batch.forEach((row,index)=>{rows[start-1+index]=row;})
      })};
  }
  const spreadsheet = {getSheetByName:name=>tabs.get(name),insertSheet:name=>{const sheet=makeSheet();tabs.set(name,sheet);return sheet;}};
  const key = 'owner-access-key-with-32-characters-or-more';
  const utilities = {DigestAlgorithm:{SHA_256:'sha256'},computeDigest:digest,getUuid:()=>crypto.randomUUID(),
    base64EncodeWebSafe:value=>Buffer.from(value).toString('base64url'),
    formatDate:(_,__,format)=>format==='HH:mm'?'11:00':'2026-11-24'};
  const ctx = vm.createContext({
    PropertiesService:{getScriptProperties:()=>({getProperty:name=>({PALZ_SALES_ACCESS_KEY:key,PALZ_SALES_SPREADSHEET_ID:'private'})[name]})},
    Utilities:utilities, DriveApp:{Access:{PRIVATE:'private'},getFileById:()=>({getSharingAccess:()=> 'private'})},
    SpreadsheetApp:{openById:()=>spreadsheet,flush(){}}, Session:{getScriptTimeZone:()=> 'Australia/Sydney'},
    getTargetSheet_:()=>({getParent:()=>({...spreadsheet,getId:()=> 'booking'})}),
    stayOperationBookingIndexV11226_:()=>({byId:{[stayId]:booking},byKey:{[booking.stayKey]:[booking]},idCounts:{[stayId]:1}}),
    readStayOperationsV11226_:()=>[{stayId,status:'checked_in'}],
    careRoutineLogUuidValid_:value=>/^[a-f0-9-]{36}$/i.test(value),
    careRoutineLogResolveStay_:()=>({...booking,booking}),
    careRoutineLogSheetReadOnly_:()=>null,
    recordCareRoutineEvent_:event=>({result:'success',event}),
    sitterHandoverRead_:()=>({times:{dropoffTime:'09:00',pickupTime:'16:00'},revision:'r1'}),
    sitterDate_:value=>value,sitterTime_:value=>value,makeIntakeToken_:()=> 'a'.repeat(64)
  });
  vm.runInContext(['PrivateSales.js','CareSchedule.js','PalzOwnerStay.js'].map(source).join('\n'),ctx);
  return {ctx,tabs,key};
}

test('Sales ledger requires access, prevents stale writes and retains one immutable revision per change', () => {
  const {ctx,tabs,key} = fixture();
  assert.throws(()=>ctx.privateSalesAuthorize_('wrong'),/access denied/);
  assert.doesNotThrow(()=>ctx.privateSalesAuthorize_(key));
  ctx.privateSalesLedger_({operation:'read'});
  assert.equal(tabs.size,0);
  const request = {operation:'commit',changeId:crypto.randomUUID(),entries:[{stayId,expectedRevision:'',record:sale}]};
  const first = ctx.privateSalesLedger_(request).records[stayId];
  assert.equal(first.total,15000);
  ctx.privateSalesLedger_(request);
  assert.equal(tabs.get('Palz_Private_Sales').getLastRow(),2);
  assert.throws(()=>ctx.privateSalesLedger_({...request,changeId:crypto.randomUUID()}),/changed on another device/);
  const updated = {operation:'commit',changeId:crypto.randomUUID(),entries:[{stayId,expectedRevision:first.revision,record:{...sale,payments:[{method:'Cash',date:'2026-11-24',cents:10000}]}}]};
  assert.equal(ctx.privateSalesLedger_(updated).records[stayId].payments[0].cents,10000);
  assert.equal(tabs.get('Palz_Private_Sales').getLastRow(),3);
});

test('scheduled medication requires sitter confirmation and retry uses the same routine-log event', () => {
  const {ctx} = fixture();
  const data = {slots:[{type:'medication',time:'09:00'},{type:'walk',time:'16:00'}]};
  assert.throws(()=>ctx.careScheduleSave_(data),/Confirm the medication/);
  ctx.careScheduleSave_({...data,medicationConfirmed:true});
  const {tasks} = ctx.careScheduleToday_();
  assert.equal(tasks.length,2);
  assert.equal(tasks[0].overdue,true);
  assert.equal(tasks[1].overdue,false);
  assert.equal(ctx.careScheduleComplete_(tasks[0]).event.eventId,tasks[0].eventId);
  assert.throws(()=>ctx.careScheduleComplete_({...tasks[0],stayId:'wrong'}),/no longer on today/);
});

test('private owner link exposes only approved stay data and stops serving it after revocation', () => {
  const {ctx} = fixture();
  const id = {...booking,booking};
  const {token} = ctx.palzOwnerStayIssue_({operation:'issue',update:'Maple settled in.',intake:''},id);
  const view = ctx.palzOwnerStayRead_({operation:'read',token});
  assert.equal(view.update,'Maple settled in.');
  assert.equal(view.canEditDropoff,false);
  assert.equal(view.times.pickupTime,'16:00');
  assert.equal('dogId' in view,false);
  ctx.palzOwnerStayIssue_({operation:'revoke'},id);
  assert.throws(()=>ctx.palzOwnerStayRead_({operation:'read',token}),/revoked/);
});

test('Care recovery rejects different dog IDs and an occupied destination', () => {
  const {ctx} = fixture();
  const oldKey = 'old name|2026-11-24|2026-11-26';
  const oldValues = ['',oldKey,'Old name',booking.startDate,booking.endDate];
  const entry = {rowNumber:2,stayId,dogId,stayKey:oldKey,valid:true};
  const state = {ok:true,rows:[entry],byKey:{[oldKey]:[entry]},values:[[],oldValues]};
  ctx.getBelongingsSheetReadOnly_ = () => ({});
  ctx.getTargetSheet_ = () => ({getParent:()=>({}),getDataRange:()=>({getValues:()=>[]})});
  ctx.readCareRecordIdentityState_ = () => state;
  ctx.normalizeDateValue_ = date => date;
  ctx.resolveCareBookingIdentity_ = () => ({reason:'no-booking-proves-stay-key'});
  let writes = 0;
  ctx.migrateBelongingsIdentityForGuest_ = () => { writes++; return true; };
  ctx.migrateIntakeIdentitiesForGuest_ = () => ({digital:1,legacy:0});
  ctx.touchWaffleDataVersion_ = () => {};
  const id = {...booking,booking};
  assert.equal(ctx.palzCareRecovery_({},id).candidates[0].key,oldKey);
  state.byKey[booking.stayKey] = [entry];
  assert.throws(()=>ctx.palzCareRecovery_({previousKey:oldKey},id),/safely relinked/);
  delete state.byKey[booking.stayKey];
  assert.throws(()=>ctx.palzCareRecovery_({previousKey:oldKey},{...id,dogId:'wrong'}),/safely relinked/);
  assert.equal(writes,0);
  assert.equal(ctx.palzCareRecovery_({previousKey:oldKey},id).intake.digital,1);
  assert.equal(writes,1);

  entry.stayId = '';
  entry.dogId = '';
  ctx.INTAKE_HEADERS_ = Array(20);
  const intakeSheet = {getMaxColumns:()=>20};
  ctx.getTargetSheet_ = () => ({getParent:()=>({getSheetByName:()=>intakeSheet}),getDataRange:()=>({getValues:()=>[]})});
  const intake = {stayKey:'unrelated',dogName:'Old name',startDate:booking.startDate,endDate:booking.endDate};
  ctx.findIntakeRecordByStableStayId_ = (sheet, requestedStay, requestedDog) => {
    assert.equal(sheet,intakeSheet);
    assert.equal(requestedStay,stayId);
    assert.equal(requestedDog,dogId);
    return intake;
  };
  assert.equal(ctx.palzCareRecovery_({},id).candidates.length,0);
  assert.throws(()=>ctx.palzCareRecovery_({previousKey:oldKey},id),/safely relinked/);
  intake.stayKey = oldKey;
  assert.equal(ctx.palzCareRecovery_({},id).candidates[0].key,oldKey);
  assert.equal(ctx.palzCareRecovery_({previousKey:oldKey},id).recovered,true);
  assert.equal(writes,2);
});
