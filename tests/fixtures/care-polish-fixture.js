const fs = require('node:fs');
const path = require('node:path');
const { resolveLocalBackendAction } = require('../../scripts/local-network-policy');
const root = path.resolve(__dirname, '../..');
const calendar = fs.readFileSync(path.join(__dirname, 'fullcalendar.global.min.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'waffle-app.js'), 'utf8');
const booking = {timestamp:'2026-10-16',dogName:'Milo',breed:'Collie',startDate:'2026-10-17',endDate:'2026-10-20',ownerName:'Casey',phone:'0400000000',bookingType:'Boarding',dogId:'11111111-1111-4111-8111-111111111111',stayId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',dogNumber:'#00017',stayKey:'milo|2026-10-17|2026-10-20'};
async function installCarePolishFixture(page) {
  const state = {reads:[],writes:[],rejectSave:false,failRead:false,record:{stayKey:booking.stayKey,identity:{stayKey:booking.stayKey,stayId:booking.stayId,dogId:booking.dogId},resolution:{status:'resolved',method:'fixture'},intakeAttributesSource:'Saved profile',intakeAttributes:{foodAmount:'1 cup',feedingTimes:'8am',medicationInstructions:'Give with dinner.'},riskFlags:{foodAllergy:true}}};
  await page.addInitScript(() => {
    const NativeDate=Date,now=NativeDate.UTC(2026,9,17,12);
    function FixedDate(...args){if(!new.target)return new NativeDate(now).toString();return Reflect.construct(NativeDate,args.length?args:[now],new.target);}
    FixedDate.prototype=NativeDate.prototype;Object.setPrototypeOf(FixedDate,NativeDate);FixedDate.now=()=>now;globalThis.Date=FixedDate;
  });
  await page.route('**/*',async route=>{
    const request=route.request(),url=request.url();
    if(!['GET','HEAD'].includes(request.method()))return route.fulfill({status:405,body:'Fixture blocks external writes'});
    if(url.includes('/waffle-app.js'))return route.fulfill({contentType:'application/javascript',body:app
      .replace('async function invalidateWaffleClientCaches(scopes) {','async function invalidateWaffleClientCaches(scopes) { if (window.__failAfterSaveRefresh) throw new Error("Synthetic post-save cache failure");')
      .replace('async function refreshSavedCareViewsReadOnly(card, payload, profileEdit, stayKey, identity) {','async function refreshSavedCareViewsReadOnly(card, payload, profileEdit, stayKey, identity) { window.__recoveryRefreshAttempts = (window.__recoveryRefreshAttempts || 0) + 1;')
      .replace('    function directoryCareProfileReadMatches(card, record) {','    window.__polishPendingProfileReads = () => directoryProfileSharedReads.size;\n    function directoryCareProfileReadMatches(card, record) {')
      .replace('    function setDirectoryDogPhoto(stayKey, record) {','    window.__setPolishPhoto = setDirectoryDogPhoto;\n    function setDirectoryDogPhoto(stayKey, record) {')});
    if(url.includes('cdn.jsdelivr.net')&&url.includes('fullcalendar'))return route.fulfill({contentType:'application/javascript',body:calendar});
    if(url.includes('docs.google.com/spreadsheets')&&url.includes('output=csv'))return route.fulfill({contentType:'text/csv',body:'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n'+[booking.timestamp,booking.dogName,booking.breed,'17/10/2026','20/10/2026',booking.ownerName,booking.phone,'','','','','Boarding','Other',booking.dogId,booking.stayId,booking.dogNumber].join(',')});
    if(url.includes('script.google')){
      const params=new URL(url).searchParams,callback=params.get('callback');
      let payload={};try{payload=JSON.parse(params.get('payload')||'{}');}catch{}
      let response={result:'success',records:[],bookings:[],summaries:[]};
      // Local fixture receipt only: this route always fulfills, never continues a mutation.
      if(payload.action==='save_belongings'){
        state.writes.push(payload);
        if(state.rejectSave)response={result:'error',error:'Synthetic save rejected'};
        else state.record={...state.record,intakeAttributes:{...state.record.intakeAttributes,...payload.intakeAttributes},riskFlags:payload.riskFlags};
      }else{
        const resolved=resolveLocalBackendAction({method:request.method(),url});
        if(!resolved.policy.allowed)return route.fulfill({status:403,body:'Unapproved fixture request'});
        state.reads.push(resolved.action);
        if(resolved.action==='get_guest_directory')response={result:'success',bookings:[booking],summaries:[{stayKey:booking.stayKey,riskFlags:state.record.riskFlags}],digitalIntakes:[],legacyIntakes:[]};
        if(resolved.action==='get_guest_profile')response=state.failRead?{result:'error',error:'Synthetic profile unavailable'}:{result:'success',record:state.record};
        if(resolved.action==='get_guest_belongings')response={result:'success',record:{stayKey:booking.stayKey,identity:state.record.identity,identityResolution:{status:'resolved',identity:state.record.identity},items:{},photos:[]}};
        if(resolved.action==='maintenance_status')response={result:'success',enabled:false};
      }
      return route.fulfill({contentType:callback?'application/javascript':'application/json',body:callback?`${callback}(${JSON.stringify(response)});`:JSON.stringify(response)});
    }
    if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){
      const type=request.resourceType();return route.fulfill({contentType:type==='script'?'application/javascript':type==='stylesheet'?'text/css':'image/svg+xml',body:type==='script'||type==='stylesheet'?'':'<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>'});
    }
    return route.continue();
  });
  return state;
}
module.exports={installCarePolishFixture,booking};
