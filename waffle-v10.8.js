/* Waffle House V10.8 — integrated enhancements */

const V108_QUEUE_DB = 'waffle-house-v108-writes';
const V108_QUEUE_STORE = 'mutations';
const V108_QUEUE_ACTIONS = new Set([
    'create_boarding','create_potential','update_potential','confirm_potential','delete_potential',
    'create','update','delete','update_boarding_dates','update_meet_greet_schedule',
    'save_reminder_note','set_reminder_note_done','delete_reminder_note','update_guest_detail',
    'save_belongings','set_primary_dog_photo','delete_dog_photo','reorder_dog_photos'
]);

const v108RawQueryAppsScript = queryAppsScript;
const v108RawSendPayloadToAppsScript = sendPayloadToAppsScript;
const v108BaseRenderOperationsHome = renderV10OperationsHome;
const v108BaseSwitchDirectoryProfileMainTab = switchDirectoryProfileMainTab;
let v108QueueDbPromise = null;
let v108QueueSyncing = false;
let v108CalendarFilter = 'all';
let v108GalleryStayKey = '';
let v108ReturningTimer = null;

/* ---------------- Offline write queue ---------------- */
function v108OpenQueueDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (v108QueueDbPromise) return v108QueueDbPromise;
    v108QueueDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(V108_QUEUE_DB, 1);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(V108_QUEUE_STORE)) {
                db.createObjectStore(V108_QUEUE_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    }).catch(error => {
        console.warn('Offline write queue unavailable:', error);
        return null;
    });
    return v108QueueDbPromise;
}

function v108MutationId() {
    return window.crypto?.randomUUID?.() || `v108_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function v108QueuePut(entry) {
    const db = await v108OpenQueueDb();
    if (!db) throw new Error('Offline write storage is unavailable.');
    return new Promise((resolve, reject) => {
        const tx = db.transaction(V108_QUEUE_STORE, 'readwrite');
        const req = tx.objectStore(V108_QUEUE_STORE).put(entry);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

async function v108QueueAll() {
    const db = await v108OpenQueueDb();
    if (!db) return [];
    return new Promise(resolve => {
        try {
            const tx = db.transaction(V108_QUEUE_STORE, 'readonly');
            const req = tx.objectStore(V108_QUEUE_STORE).getAll();
            req.onsuccess = () => resolve((req.result || []).sort((a,b) => Number(a.createdAt||0)-Number(b.createdAt||0)));
            req.onerror = () => resolve([]);
        } catch (_) { resolve([]); }
    });
}

async function v108QueueDelete(id) {
    const db = await v108OpenQueueDb();
    if (!db) return;
    return new Promise(resolve => {
        const tx = db.transaction(V108_QUEUE_STORE, 'readwrite');
        const req = tx.objectStore(V108_QUEUE_STORE).delete(id);
        req.onsuccess = req.onerror = () => resolve();
    });
}

function v108NetworkError(error) {
    const text = String(error?.message || error || '').toLowerCase();
    return navigator.onLine === false || /network|timeout|did not respond|could not reach|failed to fetch/.test(text);
}

async function v108QueueMutation(payload, transport) {
    const prepared = { ...payload, clientMutationId: payload.clientMutationId || v108MutationId() };
    await v108QueuePut({ id: prepared.clientMutationId, payload: prepared, transport, status: 'queued', attempts: 0, createdAt: Date.now(), lastError: '' });
    await v108RefreshQueueBadge();
    return { result: 'success', action: prepared.action, queued: true, offline: true, clientMutationId: prepared.clientMutationId };
}

async function v108MutationCall(raw, payload, options, transport) {
    const action = String(payload?.action || '');
    if (!V108_QUEUE_ACTIONS.has(action)) return raw(payload, options);
    const prepared = { ...payload, clientMutationId: payload.clientMutationId || v108MutationId() };
    if (navigator.onLine === false) return v108QueueMutation(prepared, transport);
    try { return await raw(prepared, options); }
    catch (error) {
        if (v108NetworkError(error)) return v108QueueMutation(prepared, transport);
        throw error;
    }
}

queryAppsScript = function(payload, options = {}) {
    return v108MutationCall(v108RawQueryAppsScript, payload, options, 'query');
};

sendPayloadToAppsScript = function(payload) {
    return v108MutationCall(v108RawSendPayloadToAppsScript, payload, undefined, 'send');
};

function v108QueueActionName(action) {
    return ({
        create_boarding:'New Boarding',create_potential:'New Potential Stay',update_potential:'Potential Stay Update',
        confirm_potential:'Confirm Potential Stay',delete_potential:'Delete Potential Stay',create:'New Meet & Greet',
        update:'Meet & Greet Update',delete:'Delete Meet & Greet',update_boarding_dates:'Move Boarding',
        update_meet_greet_schedule:'Move Meet & Greet',save_reminder_note:'Reminder / Note',
        set_reminder_note_done:'Reminder Status',delete_reminder_note:'Delete Reminder',update_guest_detail:'Guest Detail',
        save_belongings:'Profile / Belongings',set_primary_dog_photo:'Profile Photo',delete_dog_photo:'Delete Dog Photo',reorder_dog_photos:'Photo Order'
    })[action] || action || 'Update';
}

function v108EnsureQueueUi() {
    let badge = document.getElementById('v108SyncQueueBadge');
    if (!badge) {
        badge = document.createElement('button');
        badge.id = 'v108SyncQueueBadge';
        badge.type = 'button';
        badge.className = 'v108-sync-badge';
        badge.hidden = true;
        badge.addEventListener('click', v108OpenQueueModal);
        const header = document.querySelector('.calendar-header-branding');
        const theme = document.getElementById('themeToggle');
        if (header) theme?.parentNode === header ? header.insertBefore(badge, theme) : header.appendChild(badge);
    }
    return badge;
}

async function v108RefreshQueueBadge() {
    const badge = v108EnsureQueueUi();
    const entries = await v108QueueAll();
    const conflicts = entries.filter(x => x.status === 'conflict').length;
    badge.hidden = entries.length === 0;
    if (!entries.length) return;
    badge.dataset.mode = conflicts ? 'conflict' : (navigator.onLine === false ? 'offline' : 'queued');
    badge.textContent = conflicts ? `⚠ ${conflicts}` : `↻ ${entries.length}`;
    badge.title = conflicts ? 'Queued updates need review' : `${entries.length} update${entries.length===1?'':'s'} waiting to sync`;
}

function v108EnsureQueueModal() {
    let modal = document.getElementById('v108QueueModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v108QueueModal'; modal.className = 'v108-modal'; modal.hidden = true;
    modal.innerHTML = `<div class="v108-modal-card"><div class="v108-modal-head"><div><small>OFFLINE WRITE QUEUE</small><h3>↻ Pending Sync</h3><p>Changes made without a connection stay on this device until Apps Script confirms them.</p></div><button type="button" data-v108-close>×</button></div><div data-v108-queue-list></div><div class="v108-modal-actions"><button type="button" data-v108-sync-now class="primary">↻ Sync Now</button></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', async event => {
        if (event.target === modal || event.target.closest('[data-v108-close]')) { modal.hidden = true; return; }
        const remove = event.target.closest('[data-v108-remove-queue]');
        if (remove) { await v108QueueDelete(remove.dataset.v108RemoveQueue); await v108RenderQueueModal(); await v108RefreshQueueBadge(); }
        if (event.target.closest('[data-v108-sync-now]')) { await v108ProcessQueue(); await v108RenderQueueModal(); }
    });
    return modal;
}

async function v108RenderQueueModal() {
    const modal = v108EnsureQueueModal();
    const host = modal.querySelector('[data-v108-queue-list]');
    const entries = await v108QueueAll();
    host.innerHTML = entries.length ? entries.map(entry => `<article class="v108-queue-row ${entry.status==='conflict'?'conflict':''}"><div><strong>${escapeDashboardHtml(v108QueueActionName(entry.payload?.action))}</strong><span>${escapeDashboardHtml([entry.payload?.dogName,entry.payload?.startDate,entry.payload?.note].filter(Boolean).join(' · ').slice(0,130))}</span><small>${entry.status==='conflict'?'⚠ '+escapeDashboardHtml(entry.lastError||'Needs review'):(entry.status==='syncing'?'Syncing…':'Waiting to sync')}</small></div><button type="button" data-v108-remove-queue="${escapeDashboardHtml(entry.id)}">×</button></article>`).join('') : `<div class="v108-empty"><span>✓</span><strong>Everything is synced</strong><small>No device-only changes are waiting.</small></div>`;
}

async function v108OpenQueueModal() { const modal=v108EnsureQueueModal(); modal.hidden=false; await v108RenderQueueModal(); }

async function v108ProcessQueue() {
    if (v108QueueSyncing || navigator.onLine === false) return;
    v108QueueSyncing = true;
    try {
        const entries = await v108QueueAll();
        for (const entry of entries) {
            await v108QueuePut({...entry,status:'syncing',attempts:Number(entry.attempts||0)+1});
            try {
                const response = entry.transport === 'send'
                    ? await v108RawSendPayloadToAppsScript(entry.payload)
                    : await v108RawQueryAppsScript(entry.payload,{maxAttempts:1,timeoutMs:30000,dedupe:false});
                if (!response || response.result !== 'success') throw new Error(response?.error || 'Queued update was rejected.');
                await v108QueueDelete(entry.id);
            } catch (error) {
                if (v108NetworkError(error)) { await v108QueuePut({...entry,status:'queued',lastError:String(error?.message||error)}); break; }
                await v108QueuePut({...entry,status:'conflict',lastError:String(error?.message||error)});
            }
        }
    } finally { v108QueueSyncing=false; await v108RefreshQueueBadge(); }
}

/* ---------------- Calendar UI / V10.4 ---------------- */
function v108StayKey(event) {
    const p=event?.extendedProps||{}; const d=v10EventRawDates(event);
    return [String(p.dogName||event?.title||'').trim().toLowerCase(),d.start,d.end].join('|');
}

function v108EventClasses(arg) {
    const p=arg.event?.extendedProps||{};
    if (p.isPotential) return ['fc-event-potential','v108-calendar-potential'];
    if (p.isMeetGreet) return ['fc-event-meet','v108-calendar-meet'];
    return ['fc-event-confirmed','v108-calendar-confirmed'];
}

function v108OpenMeet(event) {
    activeEditingEvent=event; selectedClickDateStr=event.startStr;
    document.getElementById('modalTitle').innerText='✏️ Edit Meet & Greet';
    document.getElementById('modalDogName').value=event.extendedProps.dogName||'';
    document.getElementById('modalBreed').value=event.extendedProps.breed==='N/A'?'':(event.extendedProps.breed||'');
    document.getElementById('modalBookingTime').value=event.extendedProps.time||'10:00';
    const date=document.getElementById('modalBookingDate'); if(date){date.value=event.startStr;date.disabled=false;}
    document.getElementById('deleteModalBtn').style.display='inline-block';
    document.getElementById('customBookingModal').style.display='flex';
}

function v108EventDates(event) {
    const start=String(event?.startStr||'').slice(0,10); let end=start;
    if(event?.end){const d=new Date(event.end);d.setDate(d.getDate()-1);end=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
    return {start,end};
}

async function v108SaveCalendarMove(info) {
    const event=info.event, oldEvent=info.oldEvent||event, p=event.extendedProps||{}, op=oldEvent.extendedProps||p;
    const oldDates=v10EventRawDates(oldEvent), newDates=v108EventDates(event);
    if(oldDates.start===newDates.start && oldDates.end===newDates.end)return;
    const dog=String(p.dogName||event.title||'Guest');
    if(!window.confirm(`Move ${dog}?\n\n${oldDates.start} → ${oldDates.end}\nNew: ${newDates.start} → ${newDates.end}`)){info.revert();return;}
    let payload;
    if(p.isPotential){payload={action:'update_potential',originalDogName:op.dogName||dog,originalStartDate:oldDates.start,originalEndDate:oldDates.end,dogName:p.dogName||dog,breed:p.breed||'N/A',startDate:newDates.start,endDate:newDates.end,ownerName:p.owner||p.ownerName||'',phone:p.phone||'',notes:p.notes||''};}
    else if(p.isMeetGreet){payload={action:'update_meet_greet_schedule',originalDogName:op.dogName||dog,originalStartDate:oldDates.start,dogName:p.dogName||dog,startDate:newDates.start,time:p.time||'10:00'};}
    else{payload={action:'update_boarding_dates',originalDogName:op.dogName||dog,originalStartDate:oldDates.start,originalEndDate:oldDates.end,dogName:p.dogName||dog,startDate:newDates.start,endDate:newDates.end};}
    try { const response=await sendPayloadToAppsScript(payload); event.setExtendedProp('rawStartDate',newDates.start);event.setExtendedProp('rawEndDate',newDates.end); if(response?.queued) showWaffleForegroundPush({title:'↻ Saved for sync',body:`${dog} will sync when online.`}); }
    catch(error){info.revert();alert('Calendar move could not be saved.\n\n'+(error?.message||String(error)));}
}

function v108EnsureCalendarTools() {
    if(WAFFLE_PAGE!=='calendar'||document.getElementById('v108CalendarTools'))return;
    const cal=document.getElementById('calendar'); if(!cal)return;
    const tools=document.createElement('div');tools.id='v108CalendarTools';tools.className='v108-calendar-tools';
    tools.innerHTML=`<div class="v108-filter-group"><button class="active" data-v108-filter="all">All</button><button data-v108-filter="confirmed"><i class="confirmed"></i>Confirmed</button><button data-v108-filter="meet"><i class="meet"></i>Meet & Greet</button><button data-v108-filter="potential"><i class="potential"></i>Potential</button></div><small>Desktop: drag a booking to move dates</small>`;
    cal.parentNode.insertBefore(tools,cal);
    tools.addEventListener('click',event=>{const btn=event.target.closest('[data-v108-filter]');if(!btn)return;v108CalendarFilter=btn.dataset.v108Filter;cal.dataset.v108Filter=v108CalendarFilter;tools.querySelectorAll('[data-v108-filter]').forEach(x=>x.classList.toggle('active',x===btn));});
}

function v108EnhanceCalendar() {
    if(WAFFLE_PAGE!=='calendar'||!globalCalendar)return;
    v108EnsureCalendarTools();
    globalCalendar.setOption('eventClassNames',v108EventClasses);
    globalCalendar.setOption('editable',window.matchMedia('(min-width: 900px)').matches);
    globalCalendar.setOption('eventStartEditable',true);
    globalCalendar.setOption('eventDurationEditable',true);
    globalCalendar.setOption('eventClick',info=>{
        const p=info.event.extendedProps||{};
        if(p.isPotential){openEditPotentialModal(info.event);return;}
        if(p.isMeetGreet){v108OpenMeet(info.event);return;}
        window.location.href='directory.html?stayKey='+encodeURIComponent(v108StayKey(info.event));
    });
    globalCalendar.setOption('eventDrop',info=>v108SaveCalendarMove(info));
    globalCalendar.setOption('eventResize',info=>v108SaveCalendarMove(info));
    globalCalendar.refetchEvents();
}

/* ---------------- Meet & Greet 7-day outlook ---------------- */
function v108EnsureMeetOutlook() {
    if(WAFFLE_PAGE!=='calendar')return null;
    let host=document.getElementById('v108MeetOutlook'); if(host)return host;
    const capacity=document.querySelector('.v10-capacity-card'); if(!capacity)return null;
    let wrap=document.querySelector('.v108-outlook-wrap');
    if(!wrap){wrap=document.createElement('div');wrap.className='v108-outlook-wrap';capacity.parentNode.insertBefore(wrap,capacity);wrap.appendChild(capacity);}
    const card=document.createElement('article');card.className='v10-ops-card v108-meet-card';card.innerHTML=`<div class="v10-card-heading"><div><span class="v10-card-kicker">MEET & GREET</span><h2>7-day outlook</h2></div><small>teal = scheduled visit</small></div><div id="v108MeetOutlook" class="v108-meet-strip"></div>`;wrap.appendChild(card);return card.querySelector('#v108MeetOutlook');
}

function v108RenderMeetOutlook(events) {
    const host=v108EnsureMeetOutlook(); if(!host)return; const today=getLocalTodayDateString(); const cells=[];
    for(let i=0;i<7;i++){
        const d=new Date(today+'T12:00:00');d.setDate(d.getDate()+i);const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const meets=(events||[]).filter(e=>e.extendedProps?.isMeetGreet&&v10EventRawDates(e).start===ds).sort((a,b)=>meetGreetTimeToMinutes(a.extendedProps?.time||'')-meetGreetTimeToMinutes(b.extendedProps?.time||''));
        cells.push(`<div class="v108-meet-day ${meets.length?'busy':''}"><small>${escapeDashboardHtml(d.toLocaleDateString('en-AU',{weekday:'short'}))}</small><strong>${meets.length?`🤝 ${meets.length}`:'—'}</strong><i>${d.getDate()}/${d.getMonth()+1}</i>${meets.length?`<div>${meets.slice(0,2).map(e=>`<span>${escapeDashboardHtml(e.extendedProps?.time||'')} ${escapeDashboardHtml(e.extendedProps?.dogName||'')}</span>`).join('')}</div>`:''}</div>`);
    }
    host.innerHTML=cells.join('');
}

renderV10OperationsHome=function(events){v108BaseRenderOperationsHome(events);v108RenderMeetOutlook(events);};

/* ---------------- New Boarding popup / V10.7 returning guests ---------------- */
function v108EnsureBoardingModal(){
    let m=document.getElementById('v108BoardingModal');if(m)return m;
    m=document.createElement('div');m.id='v108BoardingModal';m.className='v108-modal';m.hidden=true;
    m.innerHTML=`<div class="v108-modal-card"><div class="v108-modal-head"><div><small>CONFIRMED STAY</small><h3>🏡 New Boarding</h3><p>Create the stay here. The generated Digital Intake collects the full care profile.</p></div><button type="button" data-v108-close>×</button></div><div class="v108-returning" data-v108-returning hidden></div><div class="v108-form-grid"><label>Dog Name *<input data-v108-board="dogName" autocomplete="off"></label><label>Breed *<input data-v108-board="breed" autocomplete="off"></label><label>Check-In *<input type="date" data-v108-board="startDate"></label><label>Check-Out *<input type="date" data-v108-board="endDate"></label><label>Owner *<input data-v108-board="ownerName" autocomplete="off"></label><label>Contact Number *<input type="tel" data-v108-board="phone" autocomplete="tel"></label><label class="wide">Booking note<textarea rows="2" data-v108-board="notes"></textarea></label></div><label class="v108-copy"><input type="checkbox" data-v108-copy-profile checked><span><strong>Use previous profile when available</strong><small>Reuses the dog's known profile, care flags and profile photo. The new intake can update them.</small></span></label><div class="v108-status" data-v108-board-status></div><div class="v108-intake-result" data-v108-intake-result hidden><strong>✅ Booking created</strong><span>Owner intake link is ready.</span><button type="button" data-v108-copy-intake>📋 Copy Intake Link</button></div><div class="v108-modal-actions"><button type="button" data-v108-close>Cancel</button><button type="button" class="primary" data-v108-save-board>🏡 Create Booking</button></div></div>`;
    document.body.appendChild(m);
    const schedule=()=>{clearTimeout(v108ReturningTimer);v108ReturningTimer=setTimeout(v108LookupReturning,450);};
    m.querySelector('[data-v108-board="dogName"]').addEventListener('input',schedule);m.querySelector('[data-v108-board="phone"]').addEventListener('input',schedule);
    m.addEventListener('click',async event=>{
        if(event.target===m||event.target.closest('[data-v108-close]')){m.hidden=true;return;}
        if(event.target.closest('[data-v108-save-board]'))await v108SaveBoarding();
        if(event.target.closest('[data-v108-copy-intake]')){const link=m.dataset.intakeLink||'';if(!link)return;try{await navigator.clipboard.writeText(link);m.querySelector('[data-v108-board-status]').textContent='✅ Intake link copied.';}catch(_){window.prompt('Copy intake link:',link);}}
    });return m;
}

function v108OpenBoarding(){const m=v108EnsureBoardingModal(),today=getLocalTodayDateString();m.hidden=false;['dogName','breed','ownerName','phone','notes'].forEach(k=>m.querySelector(`[data-v108-board="${k}"]`).value='');m.querySelector('[data-v108-board="startDate"]').value=today;m.querySelector('[data-v108-board="endDate"]').value=today;m.querySelector('[data-v108-returning]').hidden=true;m.querySelector('[data-v108-intake-result]').hidden=true;m.querySelector('[data-v108-board-status]').textContent='';m.dataset.intakeLink='';m.querySelector('[data-v108-board="dogName"]').focus();}

async function v108LookupReturning(){
    const m=v108EnsureBoardingModal();if(m.hidden)return;const dog=m.querySelector('[data-v108-board="dogName"]').value.trim(),phone=m.querySelector('[data-v108-board="phone"]').value.trim();if(dog.length<2&&phone.replace(/\D/g,'').length<6)return;
    try{const r=await v108RawQueryAppsScript({action:'get_returning_guest_prefill',dogName:dog,phone},{maxAttempts:1,timeoutMs:20000});const p=r.prefill||{},hint=m.querySelector('[data-v108-returning]');if(!p.matched){hint.hidden=true;return;}const s=p.suggested||{};['dogName','breed','ownerName','phone'].forEach(k=>{const i=m.querySelector(`[data-v108-board="${k}"]`);if(!i.value.trim()&&s[k])i.value=s[k];});hint.hidden=false;hint.innerHTML=`<span>↩️</span><div><strong>Returning guest found</strong><small>${Number(p.stayCount||0)} previous stay${Number(p.stayCount||0)===1?'':'s'} · known details can be reused.</small></div>`;}catch(e){console.warn(e);}
}

async function v108SaveBoarding(){
    const m=v108EnsureBoardingModal(), get=k=>m.querySelector(`[data-v108-board="${k}"]`).value.trim();const payload={action:'create_boarding',dogName:get('dogName'),breed:get('breed'),startDate:get('startDate'),endDate:get('endDate'),ownerName:get('ownerName'),phone:get('phone'),notes:get('notes'),copyPreviousProfile:m.querySelector('[data-v108-copy-profile]').checked};const status=m.querySelector('[data-v108-board-status]'),btn=m.querySelector('[data-v108-save-board]');
    if(!payload.dogName||!payload.breed||!payload.startDate||!payload.endDate||!payload.ownerName||!payload.phone){status.textContent='Complete Dog Name, Breed, dates, Owner and Contact Number.';status.dataset.mode='error';return;}if(payload.endDate<payload.startDate){status.textContent='Check-Out cannot be earlier than Check-In.';status.dataset.mode='error';return;}
    btn.disabled=true;btn.textContent='⏳ Creating…';try{const r=await sendPayloadToAppsScript(payload);if(r?.queued){status.textContent='↻ Saved on this device. It will sync automatically when online.';status.dataset.mode='queued';setTimeout(()=>m.hidden=true,900);return;}m.dataset.intakeLink=String(r?.intake?.link||'');m.querySelector('[data-v108-intake-result]').hidden=false;status.textContent=r?.copiedPreviousProfile?.copied?'✅ Booking created and previous profile copied.':'✅ Booking created.';status.dataset.mode='success';if(WAFFLE_PAGE==='calendar')await syncSpreadsheetData({silent:true});}catch(e){status.textContent=e?.message||String(e);status.dataset.mode='error';}finally{btn.disabled=false;btn.textContent='🏡 Create Booking';}
}

// Capture before V10's old Google Form handler.
document.addEventListener('click',event=>{const b=event.target.closest('[data-v10-quick-action="boarding"]');if(!b)return;event.preventDefault();event.stopPropagation();document.getElementById('v10QuickAddSheet')?.setAttribute('hidden','');document.body.classList.remove('v10-quick-add-open');WAFFLE_PAGE==='calendar'?v108OpenBoarding():window.location.href='index.html?action=boarding';},true);

/* ---------------- V10.7 Care History tab ---------------- */
function v108EnhanceCard(card){
    if(!card||card.dataset.v108Enhanced==='true')return;card.dataset.v108Enhanced='true';
    const tabs=card.querySelector('.directory-main-profile-tabs');if(tabs&&!tabs.querySelector('[data-directory-main-tab="history"]'))tabs.insertAdjacentHTML('beforeend','<button type="button" class="directory-main-profile-tab" role="tab" aria-selected="false" data-directory-main-tab="history"><span aria-hidden="true">🕘</span><span>History</span></button>');
    const bel=card.querySelector('[data-directory-main-panel="belongings"]');if(bel&&!card.querySelector('[data-directory-main-panel="history"]'))bel.insertAdjacentHTML('afterend',`<section class="directory-main-profile-panel v108-history-panel" role="tabpanel" data-directory-main-panel="history" hidden><div data-v108-history>${v101SkeletonHtml('audit',3)}</div></section>`);
    const photo=card.querySelector('.directory-photo-shell');if(photo&&!photo.querySelector('[data-v108-gallery]'))photo.insertAdjacentHTML('beforeend','<button type="button" class="v108-gallery-button" data-v108-gallery title="Photo gallery" aria-label="Open dog photo gallery">▦</button>');
}
function v108EnhanceCards(){document.querySelectorAll('.directory-card[data-directory-stay-key]').forEach(v108EnhanceCard);}

switchDirectoryProfileMainTab=function(card,tab){if(tab!=='history')return v108BaseSwitchDirectoryProfileMainTab(card,tab);if(!card)return;card.dataset.mainProfileTab='history';card.querySelectorAll('[data-directory-main-tab]').forEach(b=>{const a=b.dataset.directoryMainTab==='history';b.classList.toggle('is-active',a);b.setAttribute('aria-selected',a?'true':'false');});card.querySelectorAll('[data-directory-main-panel]').forEach(p=>{const a=p.dataset.directoryMainPanel==='history';p.classList.toggle('is-active',a);p.hidden=!a;});v108LoadHistory(card);};

async function v108LoadHistory(card){const host=card.querySelector('[data-v108-history]'),dog=String(card.dataset.directoryDogName||card.dataset.dogName||'').trim();if(!host||!dog)return;host.innerHTML=v101SkeletonHtml('audit',3);try{const r=await v108RawQueryAppsScript({action:'get_dog_history',dogName:dog},{maxAttempts:2,timeoutMs:30000});v108RenderHistory(host,r.history||{});}catch(e){host.innerHTML=`<div class="v108-empty"><strong>History could not be loaded</strong><small>${escapeDashboardHtml(e?.message||String(e))}</small></div>`;}}
function v108RenderHistory(host,h){const stays=Array.isArray(h.previousStays)?h.previousStays:[],owners=Array.isArray(h.owners)?h.owners:[];host.innerHTML=`<div class="v108-history-summary"><div><small>RETURNING GUEST</small><strong>${Number(h.stayCount||stays.length)} recorded stay${Number(h.stayCount||stays.length)===1?'':'s'}</strong></div>${h.latestProfile?'<span>✓ Previous profile available</span>':''}</div>${owners.length?`<section class="v108-history-section"><h4>Owner contacts</h4>${owners.map(o=>`<div class="v108-owner"><strong>${escapeDashboardHtml(o.ownerName||'Owner')}</strong>${o.phone?`<a href="tel:${escapeDashboardHtml(o.phone)}">${escapeDashboardHtml(o.phone)}</a>`:''}</div>`).join('')}</section>`:''}<section class="v108-history-section"><h4>Stay history</h4>${stays.length?stays.map(s=>`<article class="v108-stay-history"><strong>${escapeDashboardHtml(v10FormatDateLabel(s.startDate))} → ${escapeDashboardHtml(v10FormatDateLabel(s.endDate))}</strong><span>${escapeDashboardHtml(s.breed||'')} · ${escapeDashboardHtml(s.bookingType||'Boarding')}</span>${s.notes?`<p>${escapeDashboardHtml(s.notes)}</p>`:''}</article>`).join(''):'<div class="v108-empty">No previous stays found.</div>'}</section>`;}

/* ---------------- V10.6 profile photo gallery ---------------- */
function v108EnsureGalleryModal(){let m=document.getElementById('v108GalleryModal');if(m)return m;m=document.createElement('div');m.id='v108GalleryModal';m.className='v108-modal';m.hidden=true;m.innerHTML=`<div class="v108-modal-card v108-gallery-card"><div class="v108-modal-head"><div><small>DOG PHOTOS</small><h3 data-v108-gallery-title>🐶 Photo Gallery</h3><p>Previous profile photos are retained. Choose the primary image, reorder or delete.</p></div><button type="button" data-v108-close>×</button></div><div class="v108-gallery-grid" data-v108-gallery-grid></div></div>`;document.body.appendChild(m);m.addEventListener('click',async e=>{if(e.target===m||e.target.closest('[data-v108-close]')){m.hidden=true;return;}const view=e.target.closest('[data-v108-view-photo]');if(view){v108OpenViewer(view.dataset.v108ViewPhoto);return;}const primary=e.target.closest('[data-v108-primary-photo]');if(primary){await v108PhotoMutation('set_primary_dog_photo',primary.dataset.v108PrimaryPhoto);return;}const del=e.target.closest('[data-v108-delete-photo]');if(del&&confirm('Delete this dog photo?')){await v108PhotoMutation('delete_dog_photo',del.dataset.v108DeletePhoto);return;}const move=e.target.closest('[data-v108-move-photo]');if(move)await v108MovePhoto(move.dataset.v108MovePhoto,Number(move.dataset.v108Direction||0));});return m;}
function v108EnsureViewer(){let v=document.getElementById('v108PhotoViewer');if(v)return v;v=document.createElement('div');v.id='v108PhotoViewer';v.className='v108-viewer';v.hidden=true;v.innerHTML='<button type="button">×</button><img alt="Dog photo">';document.body.appendChild(v);v.addEventListener('click',()=>v.hidden=true);return v;}
function v108OpenViewer(url){const v=v108EnsureViewer();v.querySelector('img').src=url;v.hidden=false;}
async function v108OpenGallery(card){const key=String(card?.dataset.stayKey||card?.dataset.directoryStayKey||'');if(!key)return;v108GalleryStayKey=key;const m=v108EnsureGalleryModal();m.hidden=false;m.querySelector('[data-v108-gallery-title]').textContent=`🐶 ${card.dataset.dogName||card.dataset.directoryDogName||'Dog'} Photos`;m.querySelector('[data-v108-gallery-grid]').innerHTML=v101SkeletonHtml('directory',3);await v108RefreshGallery();}
async function v108RefreshGallery(){const m=v108EnsureGalleryModal(),host=m.querySelector('[data-v108-gallery-grid]');try{const r=await v108RawQueryAppsScript({action:'get_guest_profile',stayKey:v108GalleryStayKey},{maxAttempts:2,timeoutMs:30000});v108RenderGallery(r.record||{});}catch(e){host.innerHTML=`<div class="v108-empty">${escapeDashboardHtml(e?.message||String(e))}</div>`;}}
function v108RenderGallery(record){const host=v108EnsureGalleryModal().querySelector('[data-v108-gallery-grid]'),current=record.dogPhoto||null;let gallery=Array.isArray(record.dogPhotoGallery)?[...record.dogPhotoGallery]:[];if(current&&!gallery.some(p=>String(p.id||'')===String(current.id||'')))gallery.push(current);host.dataset.gallery=JSON.stringify(gallery);if(!gallery.length){host.innerHTML='<div class="v108-empty"><span>📷</span><strong>No saved profile photos</strong><small>Use the pencil on the dog photo to add one.</small></div>';return;}host.innerHTML=gallery.map((p,i)=>{const id=String(p.id||''),primary=current&&String(current.id||'')===id,url=String(p.previewUrl||p.url||p.driveUrl||'');return `<article class="v108-gallery-item ${primary?'primary':''}"><button type="button" class="v108-gallery-image" data-v108-view-photo="${escapeDashboardHtml(url)}"><img src="${escapeDashboardHtml(url)}" alt="${escapeDashboardHtml(p.label||'Dog photo')}" loading="lazy">${primary?'<span>Profile</span>':''}</button><strong>${escapeDashboardHtml(p.label||`Dog photo ${i+1}`)}</strong><div><button data-v108-move-photo="${escapeDashboardHtml(id)}" data-v108-direction="-1" ${i===0?'disabled':''}>↑</button><button data-v108-move-photo="${escapeDashboardHtml(id)}" data-v108-direction="1" ${i===gallery.length-1?'disabled':''}>↓</button>${primary?'':`<button class="primary" data-v108-primary-photo="${escapeDashboardHtml(id)}">Use</button>`}<button class="danger" data-v108-delete-photo="${escapeDashboardHtml(id)}">Delete</button></div></article>`;}).join('');}
async function v108PhotoMutation(action,id){try{const r=await queryAppsScript({action,stayKey:v108GalleryStayKey,photoId:id},{maxAttempts:2,timeoutMs:30000,dedupe:false});if(!r?.queued)await v108RefreshGallery();}catch(e){alert('Photo update failed.\n\n'+(e?.message||String(e)));}}
async function v108MovePhoto(id,dir){const host=v108EnsureGalleryModal().querySelector('[data-v108-gallery-grid]');let g=[];try{g=JSON.parse(host.dataset.gallery||'[]');}catch(_){}const i=g.findIndex(p=>String(p.id||'')===String(id));const t=i+dir;if(i<0||t<0||t>=g.length)return;[g[i],g[t]]=[g[t],g[i]];try{const r=await queryAppsScript({action:'reorder_dog_photos',stayKey:v108GalleryStayKey,photoIds:g.map(p=>p.id)},{maxAttempts:2,timeoutMs:30000,dedupe:false});if(!r?.queued)await v108RefreshGallery();}catch(e){alert('Photo order failed.\n\n'+(e?.message||String(e)));}}

/* ---------------- Legacy display label ---------------- */
const v108BaseLegacyStatus = setDirectoryLegacyIntakeStatus;
setDirectoryLegacyIntakeStatus=function(stayKey,group){v108BaseLegacyStatus(stayKey,group);const strip=Array.from(document.querySelectorAll('[data-directory-legacy]')).find(el=>String(el.dataset.directoryLegacy||'')===String(stayKey||''));if(!strip||!group?.latest)return;const state=strip.querySelector('.directory-legacy-state');if(!state)return;const latest=group.latest,count=Number(group.count||1),uploaded=latest.uploadedAt?formatAuditTimestamp(latest.uploadedAt):'',review=['Review Required','AI Failed'].includes(String(latest.aiStatus||''));state.innerHTML=`📚 Legacy Intake · ${count} ${count===1?'file':'files'}${uploaded?` · ${escapeDashboardHtml(uploaded)}`:''}${review?' <span class="directory-legacy-ai-status review">⚠️ Review needed</span>':''}`;};

/* ---------------- Init ---------------- */
function v108NormaliseNav(){const names={calendar:'Calendar',directory:'Care',reminders:'Reminder',audit:'Logs'};document.querySelectorAll('.app-tab-button').forEach(a=>{const name=names[a.dataset.pageLink];if(!name)return;a.querySelectorAll('.nav-label').forEach(x=>x.textContent=name);});}
function v108InitDirectory(){if(WAFFLE_PAGE!=='directory')return;v108EnhanceCards();const grid=document.getElementById('directory-grid');if(grid)new MutationObserver(v108EnhanceCards).observe(grid,{childList:true,subtree:true});document.addEventListener('click',event=>{const btn=event.target.closest('[data-v108-gallery]');if(!btn)return;event.preventDefault();event.stopPropagation();v108OpenGallery(btn.closest('.directory-card'));},true);}
function v108DeepLinks(){const q=new URLSearchParams(location.search);if(WAFFLE_PAGE==='calendar'&&q.get('action')==='boarding'){setTimeout(v108OpenBoarding,250);history.replaceState?.({},document.title,location.pathname);}}

document.addEventListener('DOMContentLoaded',()=>{v108NormaliseNav();v108EnsureQueueUi();v108InitDirectory();v108DeepLinks();if(WAFFLE_PAGE==='calendar'){setTimeout(v108EnhanceCalendar,220);setTimeout(()=>v108RenderMeetOutlook(globalCalendar?.getEvents()||[]),420);}v108RefreshQueueBadge();if(navigator.onLine!==false)setTimeout(v108ProcessQueue,1200);});
window.addEventListener('online',v108ProcessQueue);
setInterval(()=>{if(navigator.onLine!==false)v108ProcessQueue();},45000);
