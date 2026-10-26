const fs = require('node:fs');
const path = require('node:path');
const {resolveLocalBackendAction} = require('../../scripts/local-network-policy');
const calendar = fs.readFileSync(path.join(__dirname, 'fullcalendar.global.min.js'), 'utf8');
const bookings = [
  {dogName:'Milo',breed:'Collie',startDate:'2026-10-18',endDate:'2026-10-20',ownerName:'Alex',notes:'Call before pickup.',dogNumber:'#00017'},
  {dogName:'Milo',breed:'Poodle',startDate:'2026-10-18',endDate:'2026-10-18',ownerName:'Bea',notes:'',dogNumber:'#00018'},
  {dogName:'Fern',breed:'Kelpie',startDate:'2026-10-17',endDate:'2026-10-18',ownerName:'Casey',notes:'Private care note should not be shared.',dogNumber:'#00019'}
].map((row,index)=>({...row,timestamp:'2026-10-17',phone:'0400000000',bookingType:'Boarding',stayKey:`${row.dogName.toLowerCase()}|${row.startDate}|${row.endDate}`,dogId:`11111111-1111-4111-8111-${String(index+1).padStart(12,'0')}`,stayId:`aaaaaaaa-aaaa-4aaa-8aaa-${String(index+1).padStart(12,'0')}`}));
const digitalIntakes=[{stayKey:bookings[0].stayKey,status:'Complete',submittedAt:'2026-10-18T00:00:00Z'}];
function profile(booking) {
  return {stayKey:booking.stayKey,identity:{stayKey:booking.stayKey,stayId:booking.stayId,dogId:booking.dogId},resolution:{status:'resolved',method:'fixture'},updatedAt:'2026-10-18T00:00:00Z',riskFlags:{},intakeAttributesSource:'Saved profile',intakeAttributes:{feedingTimes:'8am and 6pm',foodAmount:'1 cup',foodBrandType:'Sensitive formula',notes:booking.notes}};
}
async function install(page,{bookingOverrides=[],holdProfileRead=false,fernMedication=''}={}) {
  const fixtureBookings=bookings.map(booking=>({...booking,...(bookingOverrides.find(override=>override.stayId===booking.stayId)||{})}));
  const reads=[];
  // Reads must reflect acknowledged writes so a later refresh cannot resurrect the initial fixture state.
  let operations=[{...fixtureBookings[2],status:"checked_in",checkedInAt:"2026-10-17T02:00:00Z"}];
  const completed=[];
  let releaseProfileRead;
  const profileReadBlocked=new Promise(resolve=>{releaseProfileRead=resolve;});
  await page.addInitScript(()=>{
    const NativeDate=Date, now=NativeDate.UTC(2026,9,18,2);
    function FixedDate(...args){if(!new.target)return new NativeDate(now).toString();return Reflect.construct(NativeDate,args.length?args:[now],new.target);}
    FixedDate.prototype=NativeDate.prototype;Object.setPrototypeOf(FixedDate,NativeDate);FixedDate.now=()=>now;globalThis.Date=FixedDate;
    window.__copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copied.push(text)}});
  });
  await page.route('**/*',async route=>{
    const request=route.request(),url=request.url();
    if(!['GET','HEAD'].includes(request.method()))return route.fulfill({status:405,body:'Synthetic fixture blocks all live writes'});
    if(url.includes('cdn.jsdelivr.net')&&url.includes('fullcalendar'))return route.fulfill({status:200,contentType:'application/javascript',body:calendar});
    if(url.includes('docs.google.com/spreadsheets')&&url.includes('output=csv')){
      const date=value=>value.split('-').reverse().join('/');
      const rows=fixtureBookings.map(b=>[b.timestamp,b.dogName,b.breed,date(b.startDate),date(b.endDate),b.ownerName,b.phone,'','',b.notes,'','Boarding',b.source||'Other',b.dogId,b.stayId,b.dogNumber].map(value=>'"'+String(value).replaceAll('"','""')+'"').join(','));
      return route.fulfill({status:200,contentType:'text/csv',body:'Timestamp,Dog Name,Breed,Start Date,End Date,Owner,Phone,Likes,Dislikes,Notes,Edit Link,Booking Type,Source,Dog ID,Stay ID,Dog Number\n'+rows.join('\n')});
    }
    if(url.includes('script.google')){
      const resolved=resolveLocalBackendAction({method:request.method(),url});
      if(!resolved.policy.allowed)return route.fulfill({status:403,body:'Unapproved backend action'});
      const params=new URL(url).searchParams,callback=params.get('callback');let payload={};try{payload=JSON.parse(params.get('payload')||'{}');}catch(_){}
      reads.push(resolved.action);
      let result={result:'success',records:[],bookings:[],summaries:[]};
      if(resolved.action==='get_guest_directory')result={result:'success',bookings:fixtureBookings,summaries:fixtureBookings.map(b=>({stayKey:b.stayKey,riskFlags:{}})),digitalIntakes,legacyIntakes:[]};
      if(resolved.action==='get_intake_statuses')result={result:'success',records:digitalIntakes};
      if(resolved.action==='get_stay_operations')result={result:'success',records:operations};
      if(resolved.action==='get_past_guest_directory')result={result:'success',bookings:completed,totalPastStays:completed.length,returned:completed.length,summaries:[],digitalIntakes,legacyIntakes:[]};
      if(resolved.action==='get_data_versions')result={result:'success',versions:{stayOperationIdentityVersion:1,careRecordIdentityWritesEnabled:false}};
      if(resolved.action==='get_guest_profile'){
        if(holdProfileRead)await profileReadBlocked;
        const booking=fixtureBookings.find(b=>b.stayId===payload.stayId)||fixtureBookings.find(b=>b.stayKey===payload.stayKey);
        const record=booking?profile(booking):null;
        if(record&&booking.dogName==='Fern'&&fernMedication)record.intakeAttributes.medicationInstructions=fernMedication;
        result={result:'success',record};
      }
      if(resolved.action==='get_belongings')result={result:'success',records:fixtureBookings.map(profile)};
      if(resolved.action==='get_guest_belongings'){
        const booking=fixtureBookings.find(row=>row.stayKey===payload.stayKey);
        result={result:'success',record:{stayKey:payload.stayKey,identityResolution:{status:booking?'resolved':'not_found',identity:booking?{stayKey:booking.stayKey,stayId:booking.stayId,dogId:booking.dogId}:null},items:booking?{leadsHarnesses:{present:true,description:'Blue lead and fitted harness'}}:{},photos:[]}};
      }
      if(resolved.action==='maintenance_status')result={result:'success',enabled:false};
      return route.fulfill({status:200,contentType:callback?'application/javascript':'application/json',body:callback?`${callback}(${JSON.stringify(result)});`:JSON.stringify(result)});
    }
    if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){
      const type=request.resourceType();return route.fulfill({status:200,contentType:type==='script'?'application/javascript':type==='stylesheet'?'text/css':'image/svg+xml',body:['script','stylesheet'].includes(type)?'':'<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>'});
    }
    return route.continue();
  });
  function recordCheckout(payload){
    const booking=fixtureBookings.find(row=>row.stayId===payload.stayId&&row.dogId===payload.dogId);
    if(!booking)throw new Error('Synthetic checkout requires the exact fixture dog and stay');
    const record={...booking,...payload,status:'checked_out',updatedAt:'2026-10-18T02:00:00Z',checkedOutAt:'2026-10-18T02:00:00Z'};
    operations=operations.filter(row=>row.stayId!==record.stayId).concat(record);
    completed.splice(0,completed.length,...completed.filter(row=>row.stayId!==record.stayId),record);
    return {result:'success',record};
  }
  return {reads,bookings:fixtureBookings,recordCheckout,releaseProfileRead:()=>releaseProfileRead?.()};
}
module.exports={install,bookings};
