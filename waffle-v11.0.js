/* ============================================================
   WAFFLE HOUSE V11.0 — OPERATIONS + MASTER PROFILES + MEDIA
   ============================================================ */

const V110_VERSION='11.0';
const v110BaseRenderOperationsHome=renderV10OperationsHome;
const v110BaseApplyDirectoryResponse=applyGuestDirectoryResponse;
let v110OperationsMap={};
let v110LatestCalendarEvents=[];
let v110MediaCache={};
let v110MasterCache={};

function v110Escape(v){return escapeDashboardHtml(v==null?'':String(v));}
function v110NormaliseStayDate(value){
  const text=String(value||'').trim();
  if(!text)return'';
  const iso=text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso)return`${iso[1]}-${iso[2]}-${iso[3]}`;
  const au=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(au)return`${au[3]}-${String(au[2]).padStart(2,'0')}-${String(au[1]).padStart(2,'0')}`;
  const parsed=new Date(text);
  if(Number.isNaN(parsed.getTime()))return text.slice(0,10);
  const local=new Date(parsed.getTime()-parsed.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
}

function v110MakeStayKey(dogName,startDate,endDate){
  const start=v110NormaliseStayDate(startDate);
  const end=v110NormaliseStayDate(endDate||startDate);
  return[
    String(dogName||'').trim().toLowerCase(),
    start,
    end
  ].join('|');
}

function v110StayKeyForEvent(event){
  const p=event?.extendedProps||{};
  const d=v10EventRawDates(event);
  const dogName=String(p.dogName||event?.title||'')
    .replace(/^.*Meet & Greet:\s*/i,'')
    .trim();
  return v110MakeStayKey(dogName,d.start,d.end);
}
function v110OperationForStay(k){return v110OperationsMap[String(k||'')]||null;}
function v110IndexOperations(records){v110OperationsMap={};(Array.isArray(records)?records:[]).forEach(r=>{if(r?.stayKey)v110OperationsMap[String(r.stayKey)]=r;});}
function v110IsCheckedOutEvent(event){return v110OperationForStay(v110StayKeyForEvent(event))?.status==='checked_out';}
function v110FormatTime(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'});}

async function v110LoadOperations(options={}){
  try{
    const r=await queryAppsScriptSWR({action:'get_stay_operations'},{cacheKey:'directory:stay-operations',maxStaleMs:2*60*60*1000,maxAttempts:2,timeoutMs:30000,onCached:c=>v110IndexOperations(c.records)});
    if(r?.data)v110IndexOperations(r.data.records);
    if(WAFFLE_PAGE==='calendar'&&!options.noRender)renderV10OperationsHome(globalCalendar?.getEvents()?.slice()||v110LatestCalendarEvents);
    if(WAFFLE_PAGE==='directory')v110EnhanceAllCareCards();
  }catch(e){console.warn('Stay Operations unavailable:',e);}
}

async function v110SaveOperationalStatus(payload,status){
  const action=status==='checked_out'?'checkout_stay':'checkin_stay';
  const r=await sendPayloadToAppsScript({action,...payload,source:'V11 Operations'});
  if(r?.queued){showWaffleForegroundPush({title:'↻ Saved for sync',body:`${payload.dogName} ${status==='checked_out'?'checkout':'check-in'} will sync when online.`});return r;}
  if(r?.record?.stayKey)v110OperationsMap[r.record.stayKey]=r.record;
  try{await invalidateWaffleClientCaches(['directory','audit']);}catch(_){ }
  return r;
}

function v110OperationalPayloadFromCard(card){
  return {stayKey:String(card?.dataset?.directoryStayKey||card?.dataset?.stayKey||''),dogName:String(card?.dataset?.directoryDogName||card?.dataset?.dogName||''),startDate:String(card?.dataset?.directoryStartDate||card?.dataset?.startDate||''),endDate:String(card?.dataset?.directoryEndDate||card?.dataset?.endDate||''),breed:String(card?.querySelector('.directory-primary-breed')?.textContent||card?.dataset?.v1088Breed||'').trim(),ownerName:String(card?.querySelector('[data-directory-edit-field="ownerName"]')?.dataset?.directoryCurrentValue||card?.dataset?.v1088OwnerName||''),phone:String(card?.querySelector('[data-directory-edit-field="phone"]')?.dataset?.directoryCurrentValue||card?.dataset?.v1088Phone||'')};
}

function v110OperationDisplayState(card){
  const p=v110OperationalPayloadFromCard(card),op=v110OperationForStay(p.stayKey),today=getLocalTodayDateString();
  if(op?.status==='checked_out')return{code:'checked_out',label:'Checked Out',icon:'✅',meta:op.checkedOutAt?`Completed ${v110FormatTime(op.checkedOutAt)}`:'Stay completed'};
  if(op?.status==='checked_in')return{code:'checked_in',label:'Checked In',icon:'🏡',meta:op.checkedInAt?`Arrived ${v110FormatTime(op.checkedInAt)}`:'Currently at home'};
  if(p.startDate>today)return{code:'expected',label:'Expected',icon:'🛬',meta:`Arriving ${formatStayDateShort(p.startDate)}`};
  if(p.endDate<today)return{code:'completed',label:'Completed',icon:'🕘',meta:'Historical stay'};
  return{code:'date_active',label:'At Home',icon:'🏡',meta:'Date-based · use Check In to start operational tracking'};
}

function v110EnsureCareOperationBar(card){
  if(!card||card.dataset.v1082PastStay==='true')return;
  const profile=card.querySelector('.directory-profile-content');if(!profile)return;

  let bar=card.querySelector('[data-v110-operation-bar]');

  if(!bar){
    bar=document.createElement('section');
    bar.className='v110-operation-bar';
    bar.dataset.v110OperationBar='';
    const tabs=profile.querySelector('.directory-main-profile-tabs');
    if(tabs)tabs.parentNode.insertBefore(bar,tabs);
  }

  const state=v110OperationDisplayState(card);
  const p=v110OperationalPayloadFromCard(card);
  const today=getLocalTodayDateString();
  const canCheckout=
    state.code==='checked_in'||
    (state.code==='date_active'&&p.endDate<=today);
  const canCheckIn=
    !['checked_in','checked_out','completed'].includes(state.code);

  /*
   * V11.0.2 Care crash fix:
   * the Care grids have a subtree MutationObserver. In V11.0 the observer
   * called v110EnhanceAllCareCards(), which called this function, which
   * unconditionally replaced bar.innerHTML. That replacement triggered the
   * same MutationObserver again, producing an endless DOM mutation loop.
   *
   * Make the operation bar idempotent. If its meaningful render state has not
   * changed, do not touch the DOM.
   */
  const signature=JSON.stringify([
    p.stayKey,
    state.code,
    state.label,
    state.meta,
    canCheckIn,
    canCheckout
  ]);

  if(bar.dataset.v110RenderSignature===signature){
    return;
  }

  /*
   * Set the signature before changing innerHTML. MutationObserver callbacks
   * run after the current DOM task, so the observer's next enhancement pass
   * immediately sees this signature and becomes a no-op.
   */
  bar.dataset.v110RenderSignature=signature;
  bar.dataset.state=state.code;

  bar.innerHTML=`<div class="v110-operation-state"><span class="v110-operation-icon">${state.icon}</span><div><small>STAY STATUS</small><strong>${v110Escape(state.label)}</strong><span>${v110Escape(state.meta)}</span></div></div><div class="v110-operation-actions">${canCheckIn?'<button type="button" class="v110-checkin-button" data-v110-checkin>🛬 Check In</button>':''}${canCheckout?'<button type="button" class="v110-checkout-button" data-v110-checkout>👋 Check Out</button>':''}</div>`;
}

function v110LeavingEvents(){const today=getLocalTodayDateString();return(Array.isArray(v110LatestCalendarEvents)?v110LatestCalendarEvents:[]).filter(e=>{const p=e?.extendedProps||{};if(p.isPotential===true||p.isMeetGreet===true)return false;return v10EventRawDates(e).end===today&&!v110IsCheckedOutEvent(e);});}
function v110EnsureLeavingModal(){let m=document.getElementById('v110LeavingModal');if(m)return m;m=document.createElement('div');m.id='v110LeavingModal';m.className='v108-modal v110-leaving-modal';m.hidden=true;m.innerHTML=`<div class="v108-modal-card v110-leaving-card"><div class="v108-modal-head"><div><small>DEPARTURES</small><h3>👋 Leaving Today</h3><p>Review each pet and check them out when collected.</p></div><button type="button" data-v110-leaving-close aria-label="Close">×</button></div><div class="v110-leaving-list" data-v110-leaving-list></div></div>`;document.body.appendChild(m);m.addEventListener('click',async e=>{if(e.target===m||e.target.closest('[data-v110-leaving-close]')){m.hidden=true;return;}const b=e.target.closest('[data-v110-leaving-checkout]');if(!b)return;const ev=v110LeavingEvents()[Number(b.dataset.v110LeavingCheckout)];if(!ev)return;const p=ev.extendedProps||{},d=v10EventRawDates(ev),dog=String(p.dogName||ev.title||'Guest');b.disabled=true;b.textContent='⏳ Checking out…';try{await v110SaveOperationalStatus({stayKey:v110StayKeyForEvent(ev),dogName:dog,breed:p.breed||'',startDate:d.start,endDate:d.end,ownerName:p.ownerName||p.owner||'',phone:p.phone||''},'checked_out');await v110RenderLeavingModal();renderV10OperationsHome(globalCalendar?.getEvents()?.slice()||v110LatestCalendarEvents);}catch(err){alert('Checkout could not be saved.\n\n'+(err?.message||String(err)));b.disabled=false;b.textContent='👋 Check Out';}});return m;}
async function v110PhotoForStay(stayKey){try{const r=await queryAppsScript({action:'get_guest_profile',stayKey},{maxAttempts:1,timeoutMs:20000}),photo=r?.record?.dogPhoto||(Array.isArray(r?.record?.dogPhotoGallery)?r.record.dogPhotoGallery[r.record.dogPhotoGallery.length-1]:null);return String(photo?.previewUrl||photo?.url||photo?.driveUrl||'');}catch(_){return'';}}
async function v110RenderLeavingModal(){const m=v110EnsureLeavingModal(),h=m.querySelector('[data-v110-leaving-list]'),list=v110LeavingEvents();if(!list.length){h.innerHTML='<div class="v110-leaving-empty"><span>✅</span><strong>No pets are waiting to check out.</strong><small>Completed checkouts disappear from the Leaving count.</small></div>';return;}h.innerHTML=list.map((ev,i)=>{const p=ev.extendedProps||{},d=v10EventRawDates(ev),dog=String(p.dogName||ev.title||'Guest');return`<article class="v110-leaving-pet"><div class="v110-leaving-photo" data-v110-leaving-photo="${i}"><span>🐶</span></div><div class="v110-leaving-copy"><strong>${v110Escape(dog)}</strong><span>${v110Escape(p.breed||'Breed not recorded')}</span><small>${v110Escape(formatStayDateShort(d.start))} → ${v110Escape(formatStayDateShort(d.end))}</small></div><button type="button" class="v110-checkout-button" data-v110-leaving-checkout="${i}">👋 Check Out</button></article>`;}).join('');list.forEach(async(ev,i)=>{const u=await v110PhotoForStay(v110StayKeyForEvent(ev));if(!u)return;const el=h.querySelector(`[data-v110-leaving-photo="${i}"]`);if(el)el.innerHTML=`<img src="${v110Escape(u)}" alt="" loading="lazy">`;});}
async function v110OpenLeavingModal(){const m=v110EnsureLeavingModal();m.hidden=false;await v110RenderLeavingModal();}

renderV10OperationsHome=function(events){v110LatestCalendarEvents=Array.isArray(events)?events:[];const filtered=v110LatestCalendarEvents.filter(e=>{const p=e?.extendedProps||{};return p.isMeetGreet===true||p.isPotential===true||!v110IsCheckedOutEvent(e);});v110BaseRenderOperationsHome(filtered);};

/* Master profile */
function v110EnsureTab(card,name,icon,label){const tabs=card?.querySelector('.directory-main-profile-tabs');if(!tabs||tabs.querySelector(`[data-v110-tab="${name}"]`))return;const b=document.createElement('button');b.type='button';b.className='directory-main-profile-tab v110-profile-tab';b.role='tab';b.setAttribute('aria-selected','false');b.dataset.v110Tab=name;b.innerHTML=`<span aria-hidden="true">${icon}</span><span>${label}</span>`;tabs.appendChild(b);const panel=document.createElement('section');panel.className=`directory-main-profile-panel v110-${name}-panel`;panel.hidden=true;panel.role='tabpanel';panel.dataset.v110Panel=name;panel.innerHTML=`<div class="v110-panel-loading" data-v110-${name}-host><span class="v110-panel-spinner"></span><strong>Loading ${label.toLowerCase()}…</strong></div>`;card.querySelector('.directory-profile-content')?.appendChild(panel);}
function v110MasterRiskBadges(flags){const cfg=[['escapeRisk','🚪','Escape Risk'],['foodAllergy','⚠️','Food Allergy'],['medicated','💊','Medicated'],['separationAnxiety','😟','Separation Anxiety'],['weightManagement','⚖️','Weight Management']],active=cfg.filter(([k])=>flags?.[k]===true);return active.length?active.map(([,i,l])=>`<span class="v110-master-risk">${i} ${v110Escape(l)}</span>`).join(''):'<span class="v110-master-clear">✓ No persistent care alerts</span>';}
function v110MasterPhotoHtml(r){const p=r?.primaryPhoto||(Array.isArray(r?.photoGallery)&&r.photoGallery.length?r.photoGallery[r.photoGallery.length-1]:null),u=String(p?.previewUrl||p?.url||p?.driveUrl||'');return u?`<img src="${v110Escape(u)}" alt="${v110Escape(r?.dogName||'Dog')} master profile photo">`:'<span>🐶</span>';}
function v110RenderMasterProfile(card,r){const h=card.querySelector('[data-v110-master-host]');if(!h)return;const fields=Object.values(r?.profile||{}).filter(v=>String(v??'').trim()).length;h.innerHTML=`<div class="v110-master-hero"><div class="v110-master-photo">${v110MasterPhotoHtml(r)}</div><div class="v110-master-identity"><small>PERSISTENT DOG PROFILE</small><h4>${v110Escape(r?.dogName||card.dataset.directoryDogName||'Dog')}</h4><span>${v110Escape(r?.breed||'Breed not recorded')}</span><div class="v110-master-pills"><span>🕘 ${Number(r?.stayCount||0)} stay${Number(r?.stayCount||0)===1?'':'s'}</span><span class="${r?.persisted?'is-saved':'is-derived'}">${r?.persisted?'✓ Saved Master':'↻ Built from stay history'}</span></div></div></div><div class="v110-master-care">${v110MasterRiskBadges(r?.riskFlags||{})}</div><div class="v110-master-fields"><div><small>OWNER</small><strong>${v110Escape(r?.ownerName||'Not recorded')}</strong></div><div><small>CONTACT</small><strong>${v110Escape(r?.phone||'Not recorded')}</strong></div><div><small>PROFILE DATA</small><strong>${fields} saved fields</strong></div><div><small>PROFILE PHOTOS</small><strong>${Array.isArray(r?.photoGallery)?r.photoGallery.length:0}</strong></div></div>${r?.notes?`<div class="v110-master-note"><small>KNOWN NOTES</small><p>${v110Escape(r.notes)}</p></div>`:''}<div class="v110-master-actions"><button type="button" class="v110-master-save" data-v110-save-master>⭐ Sync This Stay to Master Profile</button><span>Future stays can reuse the same persistent profile instead of treating the dog as a new identity.</span></div>`;}
async function v110LoadMasterProfile(card,opt={}){const dog=String(card?.dataset?.directoryDogName||card?.dataset?.dogName||''),breed=String(card?.querySelector('.directory-primary-breed')?.textContent||card?.dataset?.v1088Breed||'').trim(),key=`${dog.toLowerCase()}|${breed.toLowerCase()}`;if(v110MasterCache[key]&&!opt.force){v110RenderMasterProfile(card,v110MasterCache[key]);return;}try{const r=await queryAppsScriptSWR({action:'get_dog_master_profile',dogName:dog,breed},{cacheKey:'directory:master:'+key,maxStaleMs:6*60*60*1000,maxAttempts:2,timeoutMs:30000,onCached:c=>{if(c?.record){v110MasterCache[key]=c.record;v110RenderMasterProfile(card,c.record);}}});if(r?.data?.record){v110MasterCache[key]=r.data.record;v110RenderMasterProfile(card,r.data.record);}}catch(e){const h=card.querySelector('[data-v110-master-host]');if(h)h.innerHTML=`<div class="v110-panel-error">Master Profile could not be loaded.<br>${v110Escape(e?.message||String(e))}</div>`;}}
async function v110SaveMasterFromCard(card,b){const p=v110OperationalPayloadFromCard(card);p.action='save_dog_master_profile';p.notes=String(card.querySelector('[data-directory-edit-field="notes"]')?.dataset?.directoryCurrentValue||card.dataset.v1088Notes||'');b.disabled=true;b.textContent='⏳ Saving Master Profile…';try{const r=await sendPayloadToAppsScript(p);if(r?.record){const k=`${p.dogName.toLowerCase()}|${p.breed.toLowerCase()}`;v110MasterCache[k]=r.record;v110RenderMasterProfile(card,r.record);}}catch(e){alert('Master Profile could not be saved.\n\n'+(e?.message||String(e)));}finally{b.disabled=false;b.textContent='⭐ Sync This Stay to Master Profile';}}

/* Media */
function v110PhotoUrl(p){return String(p?.previewUrl||p?.url||p?.driveUrl||'');}
function v110PhotoGrid(photos,opt={}){photos=Array.isArray(photos)?photos:[];if(!photos.length)return`<div class="v110-media-empty">${opt.empty||'No photos yet.'}</div>`;return`<div class="v110-media-grid">${photos.map(p=>{const u=v110PhotoUrl(p);return`<article class="v110-media-photo"><button type="button" class="v110-media-view" data-v110-view-photo="${v110Escape(u)}"><img src="${v110Escape(u)}" alt="${v110Escape(p?.label||opt.label||'Dog photo')}" loading="lazy"></button><div class="v110-media-photo-meta"><span>${v110Escape(p?.label||opt.label||'Photo')}</span>${opt.deletable?`<button type="button" data-v110-delete-stay-photo="${v110Escape(p?.id||'')}" title="Delete stay photo">×</button>`:''}</div></article>`;}).join('')}</div>`;}
function v110RenderMedia(card,r){const h=card.querySelector('[data-v110-media-host]');if(!h)return;const gallery=Array.isArray(r?.dogPhotoGallery)?[...r.dogPhotoGallery]:[];if(r?.dogPhoto&&!gallery.some(p=>String(p?.id||'')===String(r.dogPhoto?.id||'')))gallery.push(r.dogPhoto);const stay=Array.isArray(r?.stayPhotos)?r.stayPhotos:[],bel=Array.isArray(r?.photos)?r.photos:[];h.innerHTML=`<div class="v110-media-heading"><div><small>MEDIA LIBRARY</small><h4>📸 Photos for this dog and stay</h4><p>Profile images are persistent; Stay Photos document this visit; Belongings remain separate.</p></div><button type="button" class="v110-add-stay-photo" data-v110-add-stay-photo>＋ Add Stay Photos</button></div><section class="v110-media-section"><div class="v110-media-section-title"><div><strong>🐶 Profile Photos</strong><span>${gallery.length}</span></div><small>Persistent identity photos</small></div>${v110PhotoGrid(gallery,{empty:'No profile photos have been saved yet.',label:'Profile photo'})}</section><section class="v110-media-section"><div class="v110-media-section-title"><div><strong>📸 Stay Photos</strong><span>${stay.length}</span></div><small>Photos captured during this boarding stay</small></div>${v110PhotoGrid(stay,{empty:'No stay photos yet. Add photos from this visit here.',label:'Stay photo',deletable:true})}</section><section class="v110-media-section"><div class="v110-media-section-title"><div><strong>🧳 Belongings Photos</strong><span>${bel.length}</span></div><small>Arrival belongings and item records</small></div>${v110PhotoGrid(bel,{empty:'No belongings photos are saved for this stay.',label:'Belongings photo'})}</section>`;}
async function v110LoadMedia(card,opt={}){const stayKey=String(card?.dataset?.directoryStayKey||'');if(!stayKey)return;if(v110MediaCache[stayKey]&&!opt.force){v110RenderMedia(card,v110MediaCache[stayKey]);return;}try{const r=await queryAppsScript({action:'get_guest_belongings',stayKey},{maxAttempts:2,timeoutMs:30000});v110MediaCache[stayKey]=r?.record||{};v110RenderMedia(card,v110MediaCache[stayKey]);}catch(e){const h=card.querySelector('[data-v110-media-host]');if(h)h.innerHTML=`<div class="v110-panel-error">Media could not be loaded.<br>${v110Escape(e?.message||String(e))}</div>`;}}
function v110EnsurePhotoViewer(){let v=document.getElementById('v110PhotoViewer');if(v)return v;v=document.createElement('div');v.id='v110PhotoViewer';v.className='v110-photo-viewer';v.hidden=true;v.innerHTML='<button type="button" aria-label="Close photo">×</button><img alt="Dog media">';document.body.appendChild(v);v.addEventListener('click',()=>v.hidden=true);return v;}
function v110OpenPhotoViewer(url){if(!url)return;const v=v110EnsurePhotoViewer();v.querySelector('img').src=url;v.hidden=false;}

function v110OpenCustomPanel(card,name){if(!card)return;card.querySelectorAll('.directory-main-profile-tab').forEach(b=>{const a=b.dataset.v110Tab===name;b.classList.toggle('is-active',a);b.setAttribute('aria-selected',a?'true':'false');});card.querySelectorAll('.directory-main-profile-panel').forEach(p=>{const a=p.dataset.v110Panel===name;p.hidden=!a;p.classList.toggle('is-active',a);});if(name==='master')v110LoadMasterProfile(card);if(name==='media')v110LoadMedia(card);}
function v110EnhanceCareCard(card){if(!card)return;v110EnsureTab(card,'master','⭐','Master');v110EnsureTab(card,'media','📸','Media');v110EnsureCareOperationBar(card);}
let v110CareEnhanceQueued=false;

function v110EnhanceAllCareCards(){
  if(WAFFLE_PAGE!=='directory')return;
  document
    .querySelectorAll('.directory-card[data-directory-stay-key]')
    .forEach(v110EnhanceCareCard);
}

function v110ScheduleCareEnhancement(){
  if(WAFFLE_PAGE!=='directory'||v110CareEnhanceQueued)return;
  v110CareEnhanceQueued=true;

  const run=()=>{
    v110CareEnhanceQueued=false;
    v110EnhanceAllCareCards();
  };

  if(typeof requestAnimationFrame==='function'){
    requestAnimationFrame(run);
  }else{
    setTimeout(run,0);
  }
}

applyGuestDirectoryResponse=function(response,options={}){
  if(Array.isArray(response?.operations))v110IndexOperations(response.operations);
  const r=v110BaseApplyDirectoryResponse(response,options);
  setTimeout(v110ScheduleCareEnhancement,20);
  return r;
};

document.addEventListener('click',async e=>{
  /*
   * V11.0.3 mobile/profile-tab fix:
   * The original Profile/Belongings tab controller only knows about
   * data-directory-main-panel, while V11 Master/Media use data-v110-panel.
   * When returning from Master/Media to a built-in tab, the custom panel could
   * remain visible underneath the built-in panel. On narrow screens that
   * produced stacked/wide content and severe horizontal overflow.
   */
  const builtInTab=e.target.closest('[data-directory-main-tab]');
  if(builtInTab){
    const card=builtInTab.closest('.directory-card');
    if(card){
      card.querySelectorAll('[data-v110-panel]').forEach(panel=>{
        panel.hidden=true;
        panel.classList.remove('is-active');
      });
      card.querySelectorAll('[data-v110-tab]').forEach(button=>{
        button.classList.remove('is-active');
        button.setAttribute('aria-selected','false');
      });
    }
    /* Do not preventDefault: the existing Care handler now switches the
       requested Profile/Belongings panel normally. */
  }

  const dep=e.target.closest('[data-v10-jump="departures"]');if(dep&&WAFFLE_PAGE==='calendar'){e.preventDefault();e.stopPropagation();await v110OpenLeavingModal();return;}
  const tab=e.target.closest('[data-v110-tab]');if(tab){e.preventDefault();e.stopPropagation();v110OpenCustomPanel(tab.closest('.directory-card'),tab.dataset.v110Tab);return;}
  const ci=e.target.closest('[data-v110-checkin]');if(ci){const card=ci.closest('.directory-card'),p=v110OperationalPayloadFromCard(card);ci.disabled=true;ci.textContent='⏳ Checking in…';try{await v110SaveOperationalStatus(p,'checked_in');v110EnsureCareOperationBar(card);showWaffleForegroundPush({title:`🏡 ${p.dogName} checked in`,body:'Operational stay tracking is now active.'});}catch(err){alert('Check In could not be saved.\n\n'+(err?.message||String(err)));}finally{ci.disabled=false;}return;}
  const co=e.target.closest('[data-v110-checkout]');if(co){const card=co.closest('.directory-card'),p=v110OperationalPayloadFromCard(card);if(!confirm(`Check out ${p.dogName}?`))return;co.disabled=true;co.textContent='⏳ Checking out…';try{await v110SaveOperationalStatus(p,'checked_out');v110EnsureCareOperationBar(card);showWaffleForegroundPush({title:`👋 ${p.dogName} checked out`,body:'The stay has been marked as completed.'});}catch(err){alert('Check Out could not be saved.\n\n'+(err?.message||String(err)));}finally{co.disabled=false;}return;}
  const sm=e.target.closest('[data-v110-save-master]');if(sm){await v110SaveMasterFromCard(sm.closest('.directory-card'),sm);return;}
  const add=e.target.closest('[data-v110-add-stay-photo]');if(add){const card=add.closest('.directory-card');if(card)openHostedBelongingsPhotoUploader(card,'library','stayPhoto');return;}
  const view=e.target.closest('[data-v110-view-photo]');if(view){v110OpenPhotoViewer(view.dataset.v110ViewPhoto);return;}
  const del=e.target.closest('[data-v110-delete-stay-photo]');if(del){const card=del.closest('.directory-card'),stayKey=card?.dataset?.directoryStayKey||'',photoId=del.dataset.v110DeleteStayPhoto;if(!confirm('Delete this stay photo?'))return;del.disabled=true;try{await sendPayloadToAppsScript({action:'delete_stay_photo',stayKey,photoId});delete v110MediaCache[stayKey];await v110LoadMedia(card,{force:true});}catch(err){alert('Stay photo could not be deleted.\n\n'+(err?.message||String(err)));del.disabled=false;}return;}
},true);

window.addEventListener('message',e=>{const d=e?.data;if(d?.type!=='waffleBelongingsPhotoSaved'||d?.photoType!=='stayPhoto')return;const key=String(d.stayKey||'');delete v110MediaCache[key];setTimeout(()=>{const card=Array.from(document.querySelectorAll('.directory-card[data-directory-stay-key]')).find(x=>String(x.dataset.directoryStayKey||'')===key);if(card)v110LoadMedia(card,{force:true});},900);});

document.addEventListener('DOMContentLoaded',()=>{
  v110EnsureLeavingModal();v110EnsurePhotoViewer();
  if(WAFFLE_PAGE==='calendar'){setTimeout(()=>v110LoadOperations(),500);setInterval(()=>v110LoadOperations(),60000);}
  if(WAFFLE_PAGE==='directory'){
    setTimeout(v110ScheduleCareEnhancement,250);
    setTimeout(()=>v110LoadOperations({noRender:true}),500);

    ['directory-grid','past-directory-grid']
      .map(id=>document.getElementById(id))
      .filter(Boolean)
      .forEach(host=>
        new MutationObserver(mutations=>{
          /*
           * Coalesce a burst of card/profile DOM mutations into one pass.
           * Combined with the operation-bar render signature above, V11
           * enhancements can no longer recursively trigger themselves.
           */
          if(mutations.some(m=>m.type==='childList')){
            v110ScheduleCareEnhancement();
          }
        }).observe(host,{childList:true,subtree:true})
      );
  }
});
