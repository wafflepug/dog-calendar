const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'apps-script', 'Code.js'), 'utf8');
const stable = fs.readFileSync(path.join(root, 'apps-script', 'StableStayIdentity.js'), 'utf8');
const care = fs.readFileSync(path.join(root, 'apps-script', 'DogCareInheritance.js'), 'utf8');
const helperStart = code.indexOf('// Identity fields are discovered by header');
const helperEnd = code.indexOf('function findV108BoardingRowForUpdate_', helperStart);
const historyStart = code.indexOf('function getV108DogHistory_');
const historyEnd = code.indexOf('function getV108ReturningGuestPrefill_', historyStart);
const inheritanceStart = code.indexOf('function validateReviewedCareInheritanceV11225_');
const createStart = code.indexOf('function createV108Boarding_(data) {');
const dogId = '00000000-0000-4000-8000-000000000101';
const stayId = '00000000-0000-4000-8000-000000000201';
const futureStayId = '00000000-0000-4000-8000-000000000202';
const blankStayId = '00000000-0000-4000-8000-000000000203';
const destinationStayId = '00000000-0000-4000-8000-000000000204';
const headers = ['Timestamp','Dog Name','Breed','Start Date','End Date','Owner','Phone','Likes','Dislikes','Notes','Edit Link','Booking Type','Dog ID','Dog Number','Stay ID','Last Stay Mutation ID'];
const key = (name, start, end) => `${String(name).toLowerCase()}|${start}|${end}`;

function build(rows, careRecords, operationRecords) {
  const data = rows.map(row => row.slice());
  let maxColumns = 30;
  const writes = [];
  const sheet = {
    rows: data,
    getName: () => 'Bookings', getLastRow: () => data.length,
    getLastColumn: () => Math.max(0, ...data.map(row => row.length)),
    getMaxColumns: () => maxColumns,
    getDataRange() { const width = this.getLastColumn(); return { getValues: () => data.map(row => Array.from({length:width},(_,i)=>row[i] ?? '')) }; },
    getRange(r,c,nr=1,nc=1) {
      const cell = (rr,cc) => { while(data.length<rr) data.push([]); while(data[rr-1].length<cc) data[rr-1].push(''); return data[rr-1][cc-1] ?? ''; };
      return {
        getValues: () => Array.from({length:nr},(_,y)=>Array.from({length:nc},(_,x)=>cell(r+y,c+x))),
        getDisplayValues() { return this.getValues().map(line=>line.map(String)); },
        getValue: () => cell(r,c),
        setValue(value) { cell(r,c); data[r-1][c-1]=value; writes.push({r,c,value}); },
        setValues(values) { values.forEach((line,y)=>line.forEach((value,x)=>{cell(r+y,c+x);data[r+y-1][c+x-1]=value;})); }
      };
    },
    insertColumnsAfter(after,count) { maxColumns += count; data.forEach(row=>{for(let i=0;i<count;i++)row.splice(after,0,'');}); }
  };
  const belongings = {};
  const sandbox = {
    Date, JSON, Object, Array, String, Number, RegExp, isNaN, console,
    Utilities: { formatDate: () => '2026-10-06', getUuid: () => stayId, DigestAlgorithm:{SHA_256:'SHA-256'}, Charset:{UTF_8:'UTF-8'}, computeDigest(_a,v){return [...crypto.createHash('sha256').update(String(v)).digest()]}, base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url') },
    Session: {getScriptTimeZone:()=> 'Australia/Sydney'},
    normalizeDateValue_: value => value instanceof Date ? value.toISOString().slice(0,10) : String(value || '').slice(0,10),
    normalizeV108Identity_: value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(),
    phoneTailV108_: value => String(value || '').replace(/\D/g,'').slice(-4),
    makeGuestStayKey_: key,
    getTargetSheet_: () => sheet,
    getBelongingsSheet_: () => belongings,
    readBelongingsRecords_(_sheet, stayKeys) { return !Array.isArray(stayKeys) || !stayKeys.length ? careRecords.slice() : careRecords.filter(record=>stayKeys.includes(record.stayKey)); },
    readStayOperations_(filters) {
      const ids = filters && filters.stayIds || [], keys = filters && filters.stayKeys || [];
      return operationRecords.filter(record => ids.includes(record.stayId) || keys.includes(record.stayKey)).map(record=>({...record}));
    },
    auditBookingSnapshotFromSheetRow_(_sheet,row) {
      const r=data[row-1]||[]; return {dogName:r[1],breed:r[2],startDate:String(r[3]||'').slice(0,10),endDate:String(r[4]||r[3]||'').slice(0,10),ownerName:r[5],phone:r[6],bookingType:r[11],dogId:r[12],stayId:r[14]};
    },
    upsertBelongingsRecord_(_sheet,record) { writes.push({profile:record}); const idx=careRecords.findIndex(item=>item.stayKey===record.stayKey); if(idx<0) careRecords.push(record); else careRecords[idx]=record; return idx<0?careRecords.length+1:idx+2; },
    mergeReviewedDogCareFieldsV1_: (current, reviewed) => Object.assign({},current||{},reviewed||{}),
    touchWaffleDataVersion_() {},
    v108DogIdentityAt_: null
  };
  vm.createContext(sandbox);
  vm.runInContext(`${stable}\n${care}\n${code.slice(helperStart,helperEnd)}\n${code.slice(historyStart,historyEnd)}\n${code.slice(inheritanceStart,createStart)}\nthis.history=getV108DogHistory_;this.validate=validateReviewedCareInheritanceV11225_;this.apply=applyReviewedCareInheritanceV11225_;`,sandbox);
  return {sandbox, rows:data, writes};
}

function booking(name, start, end, id, bookingDogId=dogId, owner='Ada') {
  return ['2026-01-01',name,'Cavoodle',start,end,owner,'0400000000','','','','','Confirmed Boarding',bookingDogId,'#00001',id,''];
}

// The history response keeps ordinary latestProfile compatibility while a
// distinct latestCompletedProfile points only at verified completed care.
{
  const early = booking('Milo','2026-10-01','2026-10-10',stayId);
  const future = booking('Milo','2026-12-01','2026-12-03',futureStayId);
  const blankCheckedOut = booking('Milo','2026-10-03','2026-10-12',blankStayId);
  const pastKey = key('Milo','2026-10-01','2026-10-10');
  const futureKey = key('Milo','2026-12-01','2026-12-03');
  const blankKey = key('Milo','2026-10-03','2026-10-12');
  const records = [
    {stayKey:pastKey,startDate:'2026-10-01',endDate:'2026-10-10',updatedAt:'2026-10-06T00:00:00.000Z',intakeAttributes:{food:'Reviewed'},riskFlags:{needsMedication:false},intakeAttributesSource:'Reviewed from previous stay'},
    {stayKey:futureKey,startDate:'2026-12-01',endDate:'2026-12-03',updatedAt:'2026-10-05T00:00:00.000Z',intakeAttributes:{food:'Future'},riskFlags:{},intakeAttributesSource:'Web App'},
    {stayKey:blankKey,startDate:'2026-10-03',endDate:'2026-10-12',updatedAt:'2026-10-05T00:00:00.000Z',intakeAttributes:Object.fromEntries(Array.from({length:37},(_,i)=>[`field${i+1}`,''])),riskFlags:{needsMedication:false,behaviorConcern:false},intakeAttributesSource:''}
  ];
  const operations = [
    {stayId,stayKey:pastKey,status:'checked_out',checkedOutAt:'2026-10-06T12:00:00+11:00',actualCheckoutDate:'2026-10-06'},
    {stayId:futureStayId,stayKey:futureKey,status:'expected',checkedOutAt:'',actualCheckoutDate:''},
    {stayId:blankStayId,stayKey:blankKey,status:'checked_out',checkedOutAt:'2026-10-04T12:00:00+11:00',actualCheckoutDate:'2026-10-04'}
  ];
  const h=build([headers,early,future,blankCheckedOut],records,operations);
  const result=h.sandbox.history({dogId,dogName:'Milo'});
  assert.equal(result.previousStays[0].stayId,futureStayId);
  const earlyHistory=result.previousStays.find(stay=>stay.stayId===stayId);
  assert.equal(earlyHistory.status,'checked_out');
  assert.equal(earlyHistory.actualCheckoutDate,'2026-10-06');
  assert.deepEqual(JSON.parse(JSON.stringify(earlyHistory.careChanges)),[{updatedAt:'2026-10-06T00:00:00.000Z',source:'Reviewed from previous stay'}]);
  assert.equal(result.latestProfile.intakeAttributes.food,'Future','legacy latestProfile remains compatible');
  assert.equal(result.latestCompletedProfile.sourceStayId,stayId,'same-day early checkout counts as completed only from verified operations');
  assert.equal(result.latestCompletedProfile.sourceDogId,dogId);
  assert.equal(result.latestCompletedProfile.sourceStayKey,pastKey);
  assert.equal(result.latestCompletedProfile.sourceEndDate,'2026-10-10');
  assert.equal(result.latestCompletedProfile.intakeAttributes.food,'Reviewed');
  assert.equal(result.latestCompletedProfile.updatedAt,'2026-10-06T00:00:00.000Z');
  assert.equal(result.previousStays.find(stay=>stay.stayId===blankStayId).careChanges,undefined,'default false risk flags and blank intake fields are not reported as saved care');
}

// A verified same-day early checkout can seed reviewed fields, preserving
// destination-only care values; wrong source dog or a shared legacy key fails.
{
  const source=booking('Milo','2026-10-01','2026-10-10',stayId);
  const destination=booking('Milo','2026-10-20','2026-10-21',destinationStayId);
  const sourceKey=key('Milo','2026-10-01','2026-10-10');
  const records=[
    {stayKey:sourceKey,startDate:'2026-10-01',endDate:'2026-10-10',intakeAttributes:{food:'Old',destinationOnly:'Keep'},riskFlags:{needsMedication:false}},
    {stayKey:key('Milo','2026-10-20','2026-10-21'),startDate:'2026-10-20',endDate:'2026-10-21',intakeAttributes:{destinationCare:'Stay specific'},riskFlags:{}}
  ];
  const operations=[{stayId,stayKey:sourceKey,status:'checked_out',checkedOutAt:'2026-10-06T12:00:00+11:00',actualCheckoutDate:'2026-10-06'}];
  const h=build([headers,source,destination],records,operations);
  const review={confirmed:true,sourceStayId:stayId,sourceDogId:dogId,sourceStayKey:sourceKey,sourceEndDate:'2026-10-10',profile:{food:'Edited'},riskFlags:{needsMedication:true}};
  const applied=h.sandbox.apply(review,dogId,'Milo',key('Milo','2026-10-20','2026-10-21'),'2026-10-20','2026-10-21',destinationStayId);
  assert.equal(applied.copied,true);
  const written=h.writes.find(item=>item.profile).profile;
  assert.equal(written.intakeAttributes.food,'Edited');
  assert.equal(written.intakeAttributes.destinationCare,'Stay specific');
  assert.equal(written.riskFlags.needsMedication,true);
  const replayed=h.sandbox.apply(review,dogId,'Milo',key('Milo','2026-10-20','2026-10-21'),'2026-10-20','2026-10-21',destinationStayId);
  assert.equal(replayed.copied,true,'receipt recovery may safely replay against its exact destination UUID');
  assert.equal(records.filter(record=>record.stayKey===key('Milo','2026-10-20','2026-10-21')).length,1,'recovery updates one uniquely owned care row');

  assert.throws(()=>h.sandbox.validate({...review,sourceDogId:'00000000-0000-4000-8000-000000000999'},dogId),/source/i);
  const other=booking('Milo','2026-10-01','2026-10-10','', '00000000-0000-4000-8000-000000000303','Lee');
  const collision=build([headers,source,other],records,operations);
  assert.throws(()=>collision.sandbox.validate({...review,sourceStayId:'',sourceDogId:dogId},dogId),/ambiguous/i,'same legacy name/date key owned by another dog is rejected');
}

console.log('Care history and inheritance backend fixtures passed.');
