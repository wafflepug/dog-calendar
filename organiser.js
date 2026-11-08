/* ============================================================
   WAFFLE HOUSE — CANONICAL ORGANISER
   Build 2026.08.27.04 · Phase 3A
   ------------------------------------------------------------
   Canonicalised from: waffle-v11.1.15.js
   Historical source files remain rollback/reference only.
   ============================================================ */

(function () {
  'use strict';
  const page = String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  if (page !== 'reminders') return;
  if (document.querySelector('link[data-waffle-organiser-canonical-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  const assetRevision = String(window.WAFFLE_ASSET_REVISION || '2026.11.04.05');
  link.href = `organiser.css?rev=${encodeURIComponent(assetRevision)}`;
  link.dataset.waffleOrganiserCanonicalStyle = assetRevision;
  document.head.appendChild(link);
})();

/* ============================================================
   WAFFLE HOUSE V11.1.15 — INTERACTIVE ORGANISER PLANNER
   ============================================================ */

(function () {
  'use strict';

  const PAGE = document.body && document.body.dataset
    ? String(document.body.dataset.wafflePage || '')
    : '';

  const state = {
    items: [],
    bookings: [],
    activeTab: 'overview',
    loading: false,
    lastLoadedAt: 0, operations: [], source: { organiser: 'loading', directory: 'loading', operations: 'loading' },
    loaded: { organiser: false, directory: false, operations: false },
    organiserReady: false, taskFilter: 'open', locks: new Set(), modalBusy: false, pendingRender: false, workspaceRefreshQueued: false
  };

  const ARRIVAL_CHECKS = [
    ['intake', 'Intake reviewed'],
    ['food', 'Food instructions reviewed'],
    ['medication', 'Medication checked'],
    ['contact', 'Owner contact confirmed']
  ];

  const CHECKOUT_CHECKS = [
    ['belongings', 'Belongings gathered'],
    ['food', 'Food packed'],
    ['medication', 'Medication packed'],
    ['lead', 'Lead / collar ready'],
    ['bedding', 'Bedding ready'],
    ['update', 'Owner update prepared']
  ];

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function hash(value) {
    let result = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      result ^= text.charCodeAt(i);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function itemId(type, stayKey) {
    return `${type}-${hash(stayKey)}`;
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getTime());

    const raw = String(value).trim();
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    let parts = match && [Number(match[1]), Number(match[2]), Number(match[3])];
    if (!parts) {
      match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (match) parts = [Number(match[3]), Number(match[2]), Number(match[1])];
    }
    if (!parts) return null;
    const parsed = new Date(parts[0], parts[1] - 1, parts[2]);
    return parsed.getFullYear() === parts[0] && parsed.getMonth() === parts[1] - 1 && parsed.getDate() === parts[2] ? parsed : null;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, amount) {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + amount);
    return next;
  }

  function dayKey(date) { return date ? new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(date) : ''; }
  function formatShortDate(value) {
    const date = value instanceof Date ? value : parseDate(value);
    if (!date) return '';
    return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function query(payload) {
    if (typeof window.queryAppsScript !== 'function') {
      return Promise.reject(new Error('Waffle House data service is not ready yet.'));
    }
    return window.queryAppsScript(payload, { maxAttempts: 1, timeoutMs: 15000 });
  }

  function toast(message, mode) {
    if (typeof window.showWaffleToast === 'function') {
      try {
        window.showWaffleToast(message, mode || 'success');
        return;
      } catch (_) {}
    }

    let node = document.getElementById('v11115OrganiserToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'v11115OrganiserToast';
      node.className = 'v11115-organiser-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.dataset.mode = mode || 'success';
    node.classList.add('is-visible');
    clearTimeout(node._hideTimer);
    node._hideTimer = setTimeout(() => node.classList.remove('is-visible'), 2400);
  }

  function renameNavigation() {
    document.querySelectorAll('a[href$="reminders.html"] .nav-label, [data-page-link="reminders"] .nav-label')
      .forEach(label => { label.textContent = 'Organiser'; });

    document.querySelectorAll('a[href$="reminders.html"], [data-page-link="reminders"]')
      .forEach(link => {
        const aria = String(link.getAttribute('aria-label') || '');
        const title = String(link.getAttribute('title') || '');
        if (/reminder/i.test(aria)) link.setAttribute('aria-label', aria.replace(/reminders?/ig, 'Organiser'));
        if (/reminder/i.test(title)) link.setAttribute('title', title.replace(/reminders?/ig, 'Organiser'));
      });
  }

  function itemsOf(type) {
    return state.items.filter(item => item && item.type === type);
  }

  function findItem(id) {
    return state.items.find(item => item && item.id === id) || null;
  }

  function upsertLocal(item) {
    const index = state.items.findIndex(entry => entry && entry.id === item.id);
    if (index >= 0) state.items[index] = item;
    else state.items.push(item);
  }

  function removeLocal(id) {
    state.items = state.items.filter(item => item && item.id !== id);
  }

  async function saveItem(item, options) {
    if(!canWrite())throw new Error('Refresh tasks successfully before saving. Your draft is still here.');
    if (['shelf_assignment','sleep_assignment'].includes(item.type) && (state.source.directory!=='ready' || !workspaceDogs().some(booking => String(booking.stayKey) === String(item.stayKey || '')))) throw new Error('Only a verified pet currently checked in can receive a workspace assignment. Refresh the stay status and try again.');
    if (['arrival_checklist','checkout_checklist'].includes(item.type) && (state.source.directory!=='ready' || ambiguousStayKey(item.stayKey))) throw new Error('Review this stay in Care before saving its preparation or assignment.');
    const id=item.id||newClientId();if(state.locks.has(id))throw new Error('This item is already being saved.');state.locks.add(id);
    try {
      const response=await query({action:'save_organiser_item',id,type:item.type,title:item.title||'',stayKey:item.stayKey||'',dogName:item.dogName||'',value:item.value||{}},{maxAttempts:1,timeoutMs:15000});
      if(!response||response.result!=='success'||!response.item||response.queued||response.pending)throw new Error(response?.message||'The organiser item was not confirmed by the server.');
      const saved=response.item;
      if(saved.id!==id||saved.type!==item.type||String(saved.stayKey||'')!==String(item.stayKey||'')||
          String(saved.title||'')!==String(item.title||'')||String(saved.dogName||'')!==String(item.dogName||'')||
          JSON.stringify(saved.value||{})!==JSON.stringify(item.value||{})||!Number.isFinite(Date.parse(saved.updatedAt)))throw new Error('The saved item was not confirmed. Retry this draft to check the same item.');
      state.locks.delete(id);
      upsertLocal(saved);if(!options||options.render!==false)renderActiveTab();if(!options||options.toast!==false)toast('Saved');return saved;
    } finally {state.locks.delete(id);}
  }

  async function deleteItem(id, options) {
    if(!canWrite())throw new Error('Refresh tasks successfully before deleting.');
    if(state.locks.has(id))throw new Error('This item is already being saved.');state.locks.add(id);
    try { const response=await query({action:'delete_organiser_item',id});if(!response||response.result!=='success'||response.queued||response.pending||String(response.id)!==String(id))throw new Error(response?.message||'The organiser item was not confirmed as deleted.');state.locks.delete(id);removeLocal(id);if(!options||options.render!==false)renderActiveTab();if(!options||options.toast!==false)toast('Removed'); }
    finally {state.locks.delete(id);}
  }

  function uniqueBookings() {
    const groups = new Map();
    state.bookings.forEach(booking => {
      if (!booking?.stayKey || !parseDate(booking.startDate) || !parseDate(booking.endDate) || dateKey(booking.endDate) < dateKey(booking.startDate)) return;
      const id = String(booking.stayId || '').trim().toLowerCase();
      const key = id ? `id:${id}` : `legacy:${booking.stayKey}\u001f${booking.dogId || ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(booking);
    });
    return Array.from(groups.values(), rows => ({ ...rows[0], organiserIdentityConflict: rows.length > 1 || rows[0].identityConflict === true }));
  }

  function planningDogs() {
    const today = parseDate(dayKey(new Date()));
    const horizon = addDays(today, 7);

    return uniqueBookings()
      .filter(booking => {
        const start = parseDate(booking.startDate), end = parseDate(booking.endDate);
        return start && end && end >= today && start <= horizon && operationFor(booking).status !== 'checked_out' && !ambiguousStayKey(booking.stayKey);
      })
      .sort((a, b) => String(a.dogName || '').localeCompare(String(b.dogName || '')));
  }

  function currentDogs() {
    const today = parseDate(dayKey(new Date()));
    return uniqueBookings()
      .filter(booking => {
        const start = parseDate(booking.startDate);
        const end = parseDate(booking.endDate);
        if (!start || !end) return false;
        return startOfDay(start) <= today && startOfDay(end) >= today && operationFor(booking).status === 'checked_in';
      })
      .sort((a, b) => String(a.dogName || '').localeCompare(String(b.dogName || '')));
  }

  function workspaceDogs() {
    return uniqueBookings()
      .filter(booking => !booking.organiserIdentityConflict && !ambiguousStayKey(booking.stayKey) && operationFor(booking).status === 'checked_in')
      .sort((a, b) => String(a.dogName || '').localeCompare(String(b.dogName || '')));
  }

  function upcomingArrivals() {
    const today = parseDate(dayKey(new Date()));
    const horizon = addDays(today, 7);
    return uniqueBookings()
      .filter(booking => {
        const start = parseDate(booking.startDate);
        if (!start) return false;
        const day = startOfDay(start);
        return day >= today && day <= horizon && !['checked_in','checked_out'].includes(operationFor(booking).status);
      })
      .sort((a, b) => parseDate(a.startDate) - parseDate(b.startDate));
  }

  function upcomingCheckouts() {
    const today = parseDate(dayKey(new Date()));
    const horizon = addDays(today, 7);
    return uniqueBookings()
      .filter(booking => {
        const end = parseDate(booking.endDate);
        if (!end) return false;
        const day = startOfDay(end);
        return day >= today && day <= horizon && operationFor(booking).status !== 'checked_out';
      })
      .sort((a, b) => parseDate(a.endDate) - parseDate(b.endDate));
  }

  function dateKey(value) { const d=parseDate(value); if(!d)return ''; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function newClientId() { return `task-${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`}`; }
  function operationFor(booking) {
    const review = { status: 'review', label: 'Review stay status' };
    if (booking.organiserIdentityConflict || !state.loaded.operations) return review;
    const records = state.operations || [], stayId = String(booking.stayId || '').toLowerCase();
    const dogId = String(booking.dogId || '').toLowerCase(), key = String(booking.stayKey || '');
    const sameKey = records.filter(row => String(row.stayKey || '') === key);
    let matches = stayId ? records.filter(row => String(row.stayId || row.identityStayId || '').toLowerCase() === stayId) : sameKey;
    if (!matches.length && sameKey.length && sameKey.every(row => !row.stayId && !row.identityStayId) && state.bookings.filter(row => row.stayKey === key).length === 1) matches = sameKey;
    if (!matches.length) return sameKey.length ? review : { status: 'scheduled', label: 'Not checked in' };
    if (matches.length !== 1) return review;
    const row = matches[0];
    if (row.identityConflict || row.identityConflictReason || (row.dogId && dogId && String(row.dogId).toLowerCase() !== dogId) || (row.stayKey && row.stayKey !== key)) return review;
    const status = String(row.status || '').toLowerCase();
    return ['checked_in', 'checked_out'].includes(status) ? { status, label: status === 'checked_in' ? 'Checked in' : 'Checked out' } : review;
  }
  function todayBookings(kind) {
    const today=dayKey(new Date());
    return uniqueBookings().filter(b=>dateKey(kind==='arrival'?b.startDate:b.endDate)===today).filter(b=>{
      const op=operationFor(b);
      if(kind==='arrival')return !['checked_in','checked_out'].includes(op.status);
      return op.status!=='checked_out';
    }).sort((a,b)=>String(a.dogName||'').localeCompare(String(b.dogName||'')));
  }
  function careLink(booking) {
    if (booking.organiserIdentityConflict) return '<a class="v11115-care-link" href="directory.html">Review in Care</a>';
    const params = new URLSearchParams({ stayKey: String(booking.stayKey || '') });
    if (booking.stayId) params.set('stayId', String(booking.stayId));
    if (booking.dogId) params.set('dogId', String(booking.dogId));
    return `<a class="v11115-care-link" href="directory.html?${esc(params.toString())}" aria-label="Care profile for ${esc(booking.dogName || 'guest')}${booking.dogNumber ? ` ${esc(booking.dogNumber)}` : ''}">Care profile</a>`;
  }
  function stayCard(booking,kind,peek) {
    const op=operationFor(booking),date=kind==='arrival'?booking.startDate:booking.endDate;
    return `<article class="v11115-stay-card ${peek?'is-peek':''}"><div><span>${kind==='arrival'?'ARRIVES':'DEPARTS'} ${esc(formatShortDate(date))}</span><h3>${esc(booking.dogName||'Guest')}${booking.dogNumber ? ` <small>${esc(booking.dogNumber)}</small>` : ''}</h3><p>${esc(booking.ownerName||'Owner not listed')}${booking.breed?` · ${esc(booking.breed)}`:''}</p><small>${esc(op.label)}</small></div>${careLink(booking)}</article>`;
  }
  function stayList(bookings,kind) { return bookings.length?`<div class="v11115-stay-list">${bookings.map(b=>stayCard(b,kind,false)).join('')}</div>`:'<p class="v11115-empty-inline">None listed for today.</p>'; }
  function isTaskDone(task,today) { const value=task.value||{}; if(value.repeat==='daily')return Array.isArray(value.completedDates)&&value.completedDates.includes(today); return Boolean(value.done); }
  function canWrite() { return state.organiserReady && state.source.organiser !== 'error'; }
  function ambiguousStayKey(key) { return !key || state.bookings.filter(booking => String(booking.stayKey || '') === String(key)).length !== 1; }
  function sourceNotice(key, label) {
    if (state.source[key] === 'ready') return '';
    const failed = state.source[key] === 'error';
    const text = failed ? (state.loaded[key] ? `${label} could not refresh. Showing the last loaded information.` : `${label} are unavailable. Refresh to try again.`) : (state.loaded[key] ? `Refreshing ${label.toLowerCase()}…` : `Loading ${label.toLowerCase()}…`);
    return `<p class="v11115-data-notice" data-state="${failed ? 'stale' : 'loading'}" role="status">${esc(text)}</p>`;
  }
  function taskInstances() {
    const today=dayKey(new Date());return itemsOf('task').map(task=>{const value=task.value||{},repeat=value.repeat==='daily',date=dateKey(value.dueDate),done=isTaskDone(task,today);return {task,date:repeat?(date>today?date:today):date,done};});
  }
  function taskSort(a,b) { const ad=a.date||'9999-99-99',bd=b.date||'9999-99-99';if(ad!==bd)return ad.localeCompare(bd);return (a.task.value?.priority==='urgent'?0:1)-(b.task.value?.priority==='urgent'?0:1)||String(a.task.value?.dueTime||'99:99').localeCompare(String(b.task.value?.dueTime||'99:99'))||String(a.task.title||'').localeCompare(String(b.task.title||'')); }
  function taskCard(task,instanceDate) {
    const today = dayKey(new Date()), value = task.value || {}, done = isTaskDone(task,today);
    const futureDaily = value.repeat==='daily' && instanceDate>today;
    const nowTime = new Intl.DateTimeFormat('en-GB',{timeZone:'Australia/Sydney',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
    const overdue = !done && instanceDate && (instanceDate<today || instanceDate===today && value.dueTime && value.dueTime<nowTime);
    const dueStatus = overdue?'overdue':instanceDate===today?'today':instanceDate?'upcoming':'none';
    const due = overdue ? `Overdue · ${formatShortDate(instanceDate)}` : instanceDate===today?'Today':instanceDate?formatShortDate(instanceDate):'No due date';
    const locked = state.locks.has(task.id) || !canWrite();
    return `<article class="v11115-task ${done?'is-done':''}" data-task-card="${esc(task.id)}"><label><input type="checkbox" data-task-toggle="${esc(task.id)}" aria-label="${done?'Reopen':'Complete'} task: ${esc(task.title)}" ${done?'checked':''} ${locked||futureDaily?'disabled':''}><span><strong>${esc(task.title)}</strong><small>${task.dogName?`${esc(task.dogName)}${value.dogNumber?` ${esc(value.dogNumber)}`:''} · `:''}<span class="v11115-task-due" data-due-status="${dueStatus}">${esc(due)}${value.dueTime?` · ${esc(value.dueTime)}`:''}</span>${value.repeat==='daily'?' · Daily':''}${value.priority==='urgent'?'<span class="v11115-task-priority" data-priority="urgent">Urgent</span>':''}</small></span></label><div class="v11115-task-actions"><button type="button" data-task-edit="${esc(task.id)}" ${locked?'disabled':''}>Edit</button><button type="button" data-task-delete="${esc(task.id)}" aria-label="Delete task: ${esc(task.title)}" ${locked?'disabled':''}>Delete</button></div></article>`;
  }
  function bindTaskActions(host) {
    host.querySelectorAll('[data-task-toggle]').forEach(input=>input.addEventListener('change',async()=>{
      const item=findItem(input.dataset.taskToggle);if(!item)return;const today=dayKey(new Date()),oldValue={...(item.value||{})},value={...oldValue};
      if(value.repeat==='daily'){const dates=Array.isArray(value.completedDates)?value.completedDates.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&dateKey(d)===d).slice(-365):[];value.completedDates=input.checked?[...new Set([...dates,today])].sort().slice(-365):dates.filter(d=>d!==today);}else value.done=input.checked;
      input.disabled=true;try{await saveItem({...item,value},{render:false,toast:false});renderActiveTab();toast('Task saved');}catch(error){input.checked=!input.checked;input.disabled=false;toast(error.message,'error');}
    }));
    host.querySelectorAll('[data-task-edit]').forEach(button=>button.addEventListener('click',()=>{const item=findItem(button.dataset.taskEdit);if(item)openTaskModal(item);}));
    host.querySelectorAll('[data-task-delete]').forEach(button=>button.addEventListener('click',async()=>{if(!window.confirm('Delete this task?'))return;button.disabled=true;try{await deleteItem(button.dataset.taskDelete);}catch(error){button.disabled=false;toast(error.message,'error');}}));
  }

  function assignmentFor(type, stayKey) {
    if (ambiguousStayKey(stayKey)) return null;
    return itemsOf(type).find(item => String(item.stayKey || '') === String(stayKey || '')) || null;
  }

  function targetTitle(type, targetId) {
    const target = itemsOf(type).find(item => item.id === targetId);
    return target ? target.title : '';
  }

  function shellHtml() { return `
    <section class="v11115-organiser" id="v11115OrganiserRoot">
      <header class="v11115-organiser-header"><div><h1>Organiser</h1><p data-organiser-date>${esc(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',weekday:'long',day:'numeric',month:'long'}).format(new Date()))}</p><div class="v11115-source-status" data-source-status aria-live="polite">Loading organiser data…</div></div><div class="v11115-organiser-actions"><button type="button" data-organiser-add-task disabled>＋ Add task</button><button type="button" class="v11115-refresh" data-organiser-refresh>Refresh</button></div></header>
      <nav class="v11115-organiser-tabs" aria-label="Organiser sections" role="tablist"><button type="button" role="tab" data-organiser-tab="overview" class="is-active" aria-selected="true">Today</button><button type="button" role="tab" data-organiser-tab="arrivals" aria-selected="false">Arrivals</button><button type="button" role="tab" data-organiser-tab="checkouts" aria-selected="false">Departures</button><button type="button" role="tab" data-organiser-tab="tasks" aria-selected="false">Tasks</button><button type="button" role="tab" data-organiser-tab="workspace" aria-selected="false">Workspace</button></nav>
      <div class="v11115-organiser-body"><div data-organiser-view="overview" role="tabpanel"></div><div data-organiser-view="arrivals" role="tabpanel" hidden></div><div data-organiser-view="checkouts" role="tabpanel" hidden></div><div data-organiser-view="tasks" role="tabpanel" hidden></div>
        <div data-organiser-view="workspace" role="tabpanel" hidden><nav class="v11115-workspace-tabs" aria-label="Workspace sections" role="tablist"><button type="button" role="tab" data-organiser-tab="shelves" aria-selected="false">Shelves</button><button type="button" role="tab" data-organiser-tab="sleep" aria-selected="false">Sleep</button><button type="button" role="tab" data-organiser-tab="notes" aria-selected="false">Notes</button></nav><div class="v11115-workspace-content" data-organiser-workspace-body><div data-organiser-view="shelves" hidden></div><div data-organiser-view="sleep" hidden></div><div data-organiser-view="notes" hidden><div id="v11115StickyNotesHost"></div></div></div></div>
      </div></section>`; }
  function buildShell() {
    const panel=document.getElementById('remindersTabPanel'); if(!panel||document.getElementById('v11115OrganiserRoot'))return;
    const existing=Array.from(panel.childNodes); panel.insertAdjacentHTML('afterbegin',shellHtml()); const stickyHost=document.getElementById('v11115StickyNotesHost');
    existing.forEach(node=>{if(node&&node.parentNode===panel)stickyHost.appendChild(node);});
    const legacy=stickyHost.querySelector('.reminders-header'); if(legacy){const h=legacy.querySelector('h3'),p=legacy.querySelector('p');if(h)h.textContent='Sticky Notes';if(p)p.textContent='Shared notes and follow-ups.';}
    document.title='Palz Stay — Organiser'; panel.addEventListener('keydown',event=>{const tab=event.target.closest('[data-organiser-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=Array.from(tab.parentElement.querySelectorAll('[data-organiser-tab]'));const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;event.preventDefault();tabs[index].click();tabs[index].focus();}); panel.querySelectorAll('[data-organiser-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.organiserTab)));
    panel.querySelector('[data-organiser-refresh]')?.addEventListener('click',e=>loadOrganiser({force:true,button:e.currentTarget})); panel.querySelector('[data-organiser-add-task]')?.addEventListener('click',()=>openTaskModal());
  }
  function switchTab(tab) {
    const valid=['overview','arrivals','checkouts','tasks','workspace','shelves','sleep','notes','floorplan']; state.activeTab=tab==='workspace'?'shelves':(valid.includes(tab)?tab:'overview');
    const inWorkspace=['shelves','sleep','notes','floorplan'].includes(state.activeTab);
    document.querySelectorAll('[data-organiser-tab]').forEach(b=>{const key=b.dataset.organiserTab,active=key===state.activeTab||(key==='workspace'&&inWorkspace);b.classList.toggle('is-active',active);b.setAttribute('role','tab');b.setAttribute('aria-selected',active?'true':'false');b.tabIndex=active?0:-1;b.id=`organiser-tab-${key}`;b.setAttribute('aria-controls',`organiser-panel-${key}`);});
    document.querySelectorAll('[data-organiser-view]').forEach(v=>{const key=v.dataset.organiserView;v.id=`organiser-panel-${key}`;v.setAttribute('role','tabpanel');v.setAttribute('aria-labelledby',`organiser-tab-${key}`);v.hidden=key==='workspace'?(!inWorkspace&&state.activeTab!=='workspace'):key===state.activeTab?false:true;}); renderActiveTab();
  }
  function emptyHtml(icon, title, copy, actionLabel, action) {
    return `
      <div class="v11115-empty">
        <span>${icon}</span>
        <strong>${esc(title)}</strong>
        <p>${esc(copy)}</p>
        ${actionLabel ? `<button type="button" data-organiser-action="${esc(action)}">${esc(actionLabel)}</button>` : ''}
      </div>
    `;
  }

  function progressPercent(done, total) {
    return total ? Math.round((done / total) * 100) : 0;
  }

  function renderOverview() {
    const host=document.querySelector('[data-organiser-view="overview"]');if(!host)return;
    const today=dayKey(new Date()),due=taskInstances().filter(row=>!row.done&&(!row.date||row.date<=today)).sort(taskSort);
    const arrivals=todayBookings('arrival'),departures=todayBookings('departure');
    const nextA=upcomingArrivals().filter(booking=>dateKey(booking.startDate)!==today).slice(0,4),nextD=upcomingCheckouts().filter(booking=>dateKey(booking.endDate)!==today).slice(0,4);
    const stays=(rows,kind)=>state.loaded.directory?stayList(rows,kind):'';
    host.innerHTML=`<div class="v11115-today-layout"><section class="v11115-today-section"><h2>Tasks to do</h2>${sourceNotice('organiser','Tasks')}<div class="v11115-task-list">${state.loaded.organiser?(due.length?due.map(row=>taskCard(row.task,row.date)).join(''):'<p class="v11115-empty-inline">No tasks due today.</p>'):''}</div></section>
      <div class="v11115-today-stays">${sourceNotice('directory','Stays')}${sourceNotice('operations','Stay statuses')}<section class="v11115-today-section"><h2>Arrivals today</h2>${stays(arrivals,'arrival')}</section><section class="v11115-today-section"><h2>Departures today</h2>${stays(departures,'departure')}</section></div>
      ${state.loaded.directory&&(nextA.length||nextD.length)?`<section class="v11115-next-seven-days"><h2>Coming up · next 7 days</h2><div class="v11115-next-seven-grid">${nextA.length?`<div><h3>Arrivals</h3>${nextA.map(booking=>stayCard(booking,'arrival',true)).join('')}</div>`:''}${nextD.length?`<div><h3>Departures</h3>${nextD.map(booking=>stayCard(booking,'departure',true)).join('')}</div>`:''}</div></section>`:''}</div>`;
    bindTaskActions(host);
  }
  function renderAssignmentModule(kind) {
    const isShelf = kind === 'shelf';
    const host = document.querySelector(`[data-organiser-view="${isShelf ? 'shelves' : 'sleep'}"]`);
    if (!host) return;

    const itemType = isShelf ? 'shelf' : 'sleep_area';
    const assignmentType = isShelf ? 'shelf_assignment' : 'sleep_assignment';
    const targets = itemsOf(itemType).sort((a, b) => String(a.title).localeCompare(String(b.title), undefined, { numeric: true }));
    const dogs = workspaceDogs();
    const activeStayKeys = new Set(dogs.map(dog => String(dog.stayKey || '')));
    const assignments = itemsOf(assignmentType).filter(item => activeStayKeys.has(String(item.stayKey || '')));
    const assignedKeys = new Set(assignments.map(item => String(item.stayKey || '')));
    const unassigned = dogs.filter(dog => !assignedKeys.has(String(dog.stayKey || '')));

    host.innerHTML = `
      <div class="v11115-section-heading">
        <div>
          <span>${isShelf ? 'BELONGINGS ORGANISER' : 'HOUSE SETUP'}</span>
          <h2>${isShelf ? '🧳 Shelves & Belongings' : '🛏️ Sleeping Areas'}</h2>
          <p>${isShelf ? 'Assign each dog currently staying to the shelf where their belongings are stored.' : 'Plan where each dog will sleep so the house setup is clear at a glance.'}</p>
        </div>
        <button type="button" data-organiser-add-target>${isShelf ? '＋ Add Shelf' : '＋ Add Area'}</button>
      </div>

      ${unassigned.length ? `
        <div class="v11115-unassigned">
          <strong>Unassigned dogs</strong>
          <div>${unassigned.map(dog => `<span>🐶 ${esc(dog.dogName)}</span>`).join('')}</div>
        </div>
      ` : ''}

      <div class="v11115-target-grid">
        ${targets.length ? targets.map(target => {
          const targetAssignments = assignments.filter(item => item.value && item.value.targetId === target.id);
          return `
            <article class="v11115-target-card">
              <div class="v11115-target-head">
                <div><span>${isShelf ? 'SHELF' : 'SLEEPING AREA'}</span><h3>${esc(target.title)}</h3></div>
                <button type="button" data-organiser-target-menu="${esc(target.id)}" aria-label="Edit ${esc(target.title)}">•••</button>
              </div>
              ${target.value && target.value.note ? `<p class="v11115-target-note">${esc(target.value.note)}</p>` : ''}
              <div class="v11115-dog-chips">
                ${targetAssignments.length ? targetAssignments.map(assignment => `
                  <span class="v11115-dog-chip">🐶 ${esc(assignment.dogName)}<button type="button" data-organiser-remove-assignment="${esc(assignment.id)}" aria-label="Remove ${esc(assignment.dogName)}">×</button></span>
                `).join('') : '<span class="v11115-empty-inline">No dogs assigned yet</span>'}
              </div>
              <button type="button" class="v11115-assign-button" data-organiser-assign="${esc(target.id)}">＋ Assign dog</button>
            </article>
          `;
        }).join('') : emptyHtml(isShelf ? '🧳' : '🛏️', isShelf ? 'Create your first shelf' : 'Create your first sleeping area', isShelf ? 'Add Shelf 1, Shelf 2 or any labels that match the real setup.' : 'Add rooms, beds, crates or quiet zones.', isShelf ? '＋ Add Shelf' : '＋ Add Area', 'add-target')}
      </div>
    `;

    const add = host.querySelector('[data-organiser-add-target]');
    if (add) add.addEventListener('click', () => openTargetModal(itemType));
    host.querySelectorAll('[data-organiser-action="add-target"]').forEach(button => button.addEventListener('click', () => openTargetModal(itemType)));
    host.querySelectorAll('[data-organiser-assign]').forEach(button => button.addEventListener('click', () => openAssignmentModal(itemType, button.dataset.organiserAssign)));
    host.querySelectorAll('[data-organiser-remove-assignment]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await deleteItem(button.dataset.organiserRemoveAssignment); } catch (error) { toast(error.message, 'error'); button.disabled = false; }
    }));
    host.querySelectorAll('[data-organiser-target-menu]').forEach(button => button.addEventListener('click', () => openTargetMenu(itemType, button.dataset.organiserTargetMenu)));
  }

  function checklistItem(type, booking) {
    return findItem(itemId(type, booking.stayKey)) || {
      id: itemId(type, booking.stayKey),
      type,
      title: booking.dogName || '',
      stayKey: booking.stayKey || '',
      dogName: booking.dogName || '',
      value: { checks: {} }
    };
  }

  function prepProblem(booking, item, type) {
    if (booking.organiserIdentityConflict || ambiguousStayKey(booking.stayKey)) return 'Review this stay in Care before saving preparation.';
    if (item.type !== type || item.stayKey !== booking.stayKey) return 'The saved checklist belongs to another stay. Review it in Care.';
    if (item.value?.stayId && item.value.stayId !== booking.stayId || item.value?.dogId && item.value.dogId !== booking.dogId) return 'The saved checklist identity needs review in Care.';
    return '';
  }

  function renderPrep(kind) {
    const arrival=kind==='arrival',tab=arrival?'arrivals':'checkouts',type=arrival?'arrival_checklist':'checkout_checklist',host=document.querySelector(`[data-organiser-view="${tab}"]`);if(!host)return;
    const bookings=arrival?upcomingArrivals():upcomingCheckouts(),labels=arrival?ARRIVAL_CHECKS:CHECKOUT_CHECKS;
    host.innerHTML=`<div class="v11115-section-heading"><div><h2>${arrival?'Arrival preparation':'Departure handover'}</h2><p>Today and the next 7 days. Open Care for stay actions and owner information.</p></div></div>${sourceNotice('directory','Stays')}${sourceNotice('organiser','Checklists')}${sourceNotice('operations','Stay statuses')}<div class="v11115-prep-list">${state.loaded.directory?bookings.length?bookings.map(booking=>{
      const item=checklistItem(type,booking),problem=prepProblem(booking,item,type),checks=problem?{}:item.value?.checks||{};
      const done=labels.filter(entry=>Boolean(checks[entry[0]])).length,disabled=problem||!canWrite()||state.source.directory!=='ready';
      return `<article class="v11115-prep-card" data-prep-stay="${esc(booking.stayKey)}"><div class="v11115-prep-head"><div><span>${arrival?'ARRIVES':'DEPARTS'} ${esc(formatShortDate(arrival?booking.startDate:booking.endDate))}</span><h3>${esc(booking.dogName)}${booking.dogNumber?` <small>${esc(booking.dogNumber)}</small>`:''}</h3><small>${esc(booking.ownerName||'Owner not listed')}${booking.breed?` · ${esc(booking.breed)}`:''}</small></div>${state.loaded.organiser&&!problem?`<strong>${done} of ${labels.length} reviewed</strong>`:''}</div><div class="v11115-prep-care-link">${careLink(booking)}</div>${problem?`<p class="v11115-data-notice">${esc(problem)}</p>`:''}<div class="v11115-check-grid">${labels.map(entry=>`<label class="${checks[entry[0]]?'is-done':''}"><input type="checkbox" data-prep-check="${esc(entry[0])}" ${checks[entry[0]]?'checked':''} ${disabled?'disabled':''}><span>${esc(entry[1])}</span></label>`).join('')}</div></article>`;
    }).join(''):'<p class="v11115-empty-inline">No stays in this date window.</p>':''}</div>`;
    host.querySelectorAll('[data-prep-check]').forEach(input=>input.addEventListener('change',async()=>{
      const card=input.closest('[data-prep-stay]'),matches=bookings.filter(booking=>booking.stayKey===card?.dataset.prepStay),booking=matches.length===1?matches[0]:null;
      if(!booking){input.checked=!input.checked;return;}
      const current=checklistItem(type,booking),problem=prepProblem(booking,current,type);
      if(problem||state.source.directory!=='ready'){input.checked=!input.checked;toast(problem||'Refresh the stay list before saving.','error');return;}
      const next={...current,value:{...(current.value||{}),stayId:booking.stayId||'',dogId:booking.dogId||'',checks:{...(current.value?.checks||{}),[input.dataset.prepCheck]:input.checked}}};
      const grid=card.querySelector('.v11115-check-grid');grid.querySelectorAll('input').forEach(control=>{control.disabled=true;});
      try{await saveItem(next,{render:false,toast:false});renderPrep(kind);toast('Checklist saved');}
      catch(error){input.checked=!input.checked;grid.querySelectorAll('input').forEach(control=>{control.disabled=!canWrite();});toast(error.message,'error');}
    }));
  }
  function renderTasks() {
    const host = document.querySelector('[data-organiser-view="tasks"]'); if (!host) return;
    const today = dayKey(new Date()), filter = state.taskFilter || 'open';
    const list = taskInstances().filter(row => filter === 'completed' ? row.done : filter === 'open' ? !row.done : filter === 'today' ? !row.done && (!row.date || row.date <= today) : true).sort(taskSort);
    host.innerHTML = `<div class="v11115-section-heading"><div><h2>Tasks</h2><p>Plan follow-ups and house jobs. Record completed care in each guest’s Care profile.</p></div></div>${sourceNotice('organiser', 'Tasks')}<div class="v11115-task-filters" role="group" aria-label="Filter tasks">${['open','today','completed','all'].map(key => `<button type="button" data-task-filter="${key}" aria-pressed="${filter===key}">${key === 'today' ? 'Due today' : key[0].toUpperCase()+key.slice(1)}</button>`).join('')}</div><div class="v11115-task-list">${state.loaded.organiser ? (list.length ? list.map(row => taskCard(row.task, row.date)).join('') : '<p class="v11115-empty-inline">No tasks in this view.</p>') : ''}</div>`;
    host.querySelectorAll('[data-task-filter]').forEach(button => button.addEventListener('click', () => {state.taskFilter=button.dataset.taskFilter;renderTasks();}));
    bindTaskActions(host);
  }
  function renderActiveTab() {
    if (document.getElementById('v11115OrganiserModal')?.hidden === false) { state.pendingRender = true; return; }
    if (state.activeTab === 'overview') renderOverview();
    if (state.activeTab === 'shelves') renderAssignmentModule('shelf');
    if (state.activeTab === 'arrivals') renderPrep('arrival');
    if (state.activeTab === 'checkouts') renderPrep('checkout');
    if (state.activeTab === 'sleep') renderAssignmentModule('sleep_area');
    if (state.activeTab === 'tasks') renderTasks();
    updateTabCounts();
  }

  function updateTabCounts() {
    const counts={arrivals:todayBookings('arrival').length,checkouts:todayBookings('departure').length,tasks:itemsOf('task').filter(t=>!isTaskDone(t,dayKey(new Date()))).length};
    document.querySelectorAll('[data-organiser-tab]').forEach(button=>{const tab=button.dataset.organiserTab;if(!['arrivals','checkouts','tasks'].includes(tab))return;const base=button.dataset.baseLabel||button.textContent.replace(/\s+\d+$/,'');button.dataset.baseLabel=base;button.textContent=counts[tab]?`${base} ${counts[tab]}`:base;});
  }

  function ensureModal() {
    let modal = document.getElementById('v11115OrganiserModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'v11115OrganiserModal';
    modal.className = 'v11115-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="v11115-modal-backdrop" data-organiser-modal-close></div>
      <section class="v11115-modal-card" role="dialog" aria-modal="true" aria-labelledby="v11115ModalTitle">
        <button type="button" class="v11115-modal-close" data-organiser-modal-close aria-label="Close">×</button>
        <div id="v11115ModalContent"></div>
      </section>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('keydown', event => { if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeModal();return;} if(event.key==='Tab'){const focusable=Array.from(modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')).filter(el=>el.offsetParent!==null);if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}} });
    modal.querySelectorAll('[data-organiser-modal-close]').forEach(button => button.addEventListener('click', closeModal));
    const fitViewport = () => {
      if (modal.hidden) return;
      const viewport=window.visualViewport;
      modal.style.top=`${viewport?.offsetTop||0}px`;
      modal.style.bottom='auto';
      modal.style.height=`${viewport?.height||window.innerHeight}px`;
      modal.style.setProperty('--org-viewport-height',`${viewport?.height||window.innerHeight}px`);
    };
    window.visualViewport?.addEventListener('resize',fitViewport);
    window.visualViewport?.addEventListener('scroll',fitViewport);
    window.addEventListener('resize',fitViewport);
    modal._fitViewport=fitViewport;
    return modal;
  }

  function openModal(html, onSubmit) {
    if(state.modalBusy)return;
    const modal = ensureModal();
    const content = modal.querySelector('#v11115ModalContent');
    content.innerHTML = html;
    if(!modal.contains(document.activeElement))state.modalReturnFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('v11115-modal-open');
    modal._fitViewport?.();
    const first = content.querySelector('input,select,textarea,button'); if (first) first.focus();

    const form = content.querySelector('form');
    if (form && typeof onSubmit === 'function') {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if(state.modalBusy)return;
        const data=new FormData(form);
        state.modalBusy=true;
        form.setAttribute('aria-busy','true');
        const submit = form.querySelector('[type="submit"]');
        const controls=Array.from(modal.querySelectorAll('button,input,select,textarea')).map(control=>[control,control.disabled]);
        controls.forEach(([control])=>{control.disabled=true;});
        const submitLabel=submit?.textContent;
        if(submit)submit.textContent='Saving…';
        const errorBox=form.querySelector('[data-modal-error]');if(errorBox)errorBox.textContent='';
        try {
          await onSubmit(data, form);
          state.modalBusy=false;
          closeModal();
        } catch (error) {
          state.modalBusy=false;
          controls.forEach(([control,disabled])=>{if(control.isConnected)control.disabled=disabled;});
          if(submit)submit.textContent=submitLabel;
          if (errorBox) errorBox.textContent = error.message || 'Could not save.';
          else toast(error.message || 'Could not save.', 'error');
        } finally {
          state.modalBusy=false;form.removeAttribute('aria-busy');
        }
      });
    }
  }

  function closeModal() {
    if(state.modalBusy)return;
    const modal = document.getElementById('v11115OrganiserModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('v11115-modal-open');
    if(state.pendingRender){state.pendingRender=false;renderActiveTab();}
    const focus=state.modalReturnFocus?.isConnected?state.modalReturnFocus:document.querySelector('.v11115-organiser-tabs .is-active');
    focus?.focus({preventScroll:true});
    flushWorkspaceRefresh();
  }

  function openTargetModal(type, existing) {
    const isShelf = type === 'shelf';
    const item = existing || null;
    const draftId=item?.id||newClientId();
    openModal(`
      <form class="v11115-modal-form">
        <span class="v11115-eyebrow">${isShelf ? 'BELONGINGS ORGANISER' : 'HOUSE SETUP'}</span>
        <h2 id="v11115ModalTitle">${item ? 'Edit' : 'Add'} ${isShelf ? 'Shelf' : 'Sleeping Area'}</h2>
        <label>${isShelf ? 'Shelf name' : 'Area name'}<input name="title" required maxlength="80" value="${esc(item ? item.title : '')}" placeholder="${isShelf ? 'e.g. Shelf 1' : 'e.g. Main Bedroom'}"></label>
        <label>Optional note<textarea name="note" maxlength="240" placeholder="${isShelf ? 'e.g. Large bags on the lower shelf' : 'e.g. Quiet area, door closed'}">${esc(item && item.value ? item.value.note || '' : '')}</textarea></label>
        <div class="v11115-modal-error" data-modal-error></div>
        <div class="v11115-modal-actions"><button type="button" data-organiser-modal-close>Cancel</button><button type="submit">Save</button></div>
      </form>
    `, async data => {
      await saveItem({
        id: draftId,
        type,
        title: String(data.get('title') || '').trim(),
        value: { note: String(data.get('note') || '').trim() }
      });
    });

    document.querySelectorAll('#v11115OrganiserModal [data-organiser-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  }

  function openTargetMenu(type, id) {
    const item = findItem(id);
    if (!item) return;
    const assignmentType = type === 'shelf' ? 'shelf_assignment' : 'sleep_assignment';
    const activeStayKeys = new Set(workspaceDogs().map(dog => String(dog.stayKey || '')));
    const assignedCount = itemsOf(assignmentType).filter(assignment => activeStayKeys.has(String(assignment.stayKey || '')) && assignment.value && assignment.value.targetId === id).length;

    openModal(`
      <div class="v11115-modal-form">
        <span class="v11115-eyebrow">MANAGE</span>
        <h2 id="v11115ModalTitle">${esc(item.title)}</h2>
        <p>${assignedCount ? `${assignedCount} dog${assignedCount === 1 ? '' : 's'} currently assigned.` : 'No dogs are currently assigned.'}</p>
        <div class="v11115-modal-error" data-modal-error></div>
        <div class="v11115-modal-actions v11115-modal-actions-stack">
          <button type="button" data-target-edit>Edit details</button>
          <button type="button" class="is-danger" data-target-delete ${assignedCount ? 'disabled title="Remove dog assignments first"' : ''}>Delete</button>
        </div>
      </div>
    `);

    const modal = ensureModal();
    const edit = modal.querySelector('[data-target-edit]');
    const del = modal.querySelector('[data-target-delete]');
    if (edit) edit.addEventListener('click', () => openTargetModal(type, item));
    if (del) del.addEventListener('click', async () => {
      if (!window.confirm(`Delete ${item.title}?`)) return;
      del.disabled = true;
      try { await deleteItem(item.id); closeModal(); } catch (error) { del.disabled = false; toast(error.message, 'error'); }
    });
  }

  function openAssignmentModal(type, targetId) {
    const isShelf = type === 'shelf';
    const assignmentType = isShelf ? 'shelf_assignment' : 'sleep_assignment';
    const target = findItem(targetId);
    if (!target) return;
    const dogs = workspaceDogs();

    openModal(`
      <form class="v11115-modal-form">
        <span class="v11115-eyebrow">${isShelf ? 'SHELF ASSIGNMENT' : 'SLEEPING ASSIGNMENT'}</span>
        <h2 id="v11115ModalTitle">Assign dog to ${esc(target.title)}</h2>
        <label>Dog<select name="stayKey" required>
          <option value="">Choose a dog…</option>
          ${dogs.map(dog => `<option value="${esc(dog.stayKey)}">${esc(dog.dogName)} · ${esc(formatShortDate(dog.startDate))}–${esc(formatShortDate(dog.endDate))}</option>`).join('')}
        </select></label>
        <div class="v11115-modal-error" data-modal-error></div>
        <div class="v11115-modal-actions"><button type="button" data-organiser-modal-close>Cancel</button><button type="submit">Assign</button></div>
      </form>
    `, async data => {
      const stayKey = String(data.get('stayKey') || '');
      const dog = dogs.find(entry => String(entry.stayKey) === stayKey);
      if (!dog) throw new Error('Choose a dog to assign.');

      await saveItem({
        id: itemId(assignmentType, stayKey),
        type: assignmentType,
        title: target.title,
        stayKey,
        dogName: dog.dogName || '',
        value: { targetId: target.id }
      });
    });

    document.querySelectorAll('#v11115OrganiserModal [data-organiser-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  }

  function openTaskModal(existing,template) {
    if(!state.organiserReady)return;const dogs=planningDogs(),current=existing?.value||{},draftId=existing?.id||newClientId();
    openModal(`<form class="v11115-modal-form"><span class="v11115-eyebrow">TASK</span><h2 id="v11115ModalTitle">${existing?'Edit task':'Add task'}</h2>${!existing?`<fieldset class="v11115-task-templates"><legend>Start with a template</legend>${['Prepare arrival','Pack belongings','Owner update','Clean & reset'].map(x=>`<button type="button" data-task-template="${esc(x)}">${esc(x)}</button>`).join('')}</fieldset>`:''}<label>Task<input name="title" required maxlength="160" value="${esc(existing?.title||template||'')}" placeholder="What needs doing?"></label><label>Dog or stay <span>(optional)</span><select name="stayKey"><option value="">General house task</option>${existing?.stayKey&&!dogs.some(d=>String(d.stayKey)===String(existing.stayKey))?`<option value="${esc(existing.stayKey)}" selected>${esc(existing.dogName||'Linked stay')} · saved link</option>`:''}${dogs.map(d=>`<option value="${esc(d.stayKey)}" ${existing?.stayKey===d.stayKey?'selected':''}>${esc(d.dogName)} · ${esc(formatShortDate(d.startDate))}–${esc(formatShortDate(d.endDate))}</option>`).join('')}</select></label><div class="v11115-task-date-fields"><label>Due date <span>(optional)</span><input name="dueDate" type="date" value="${esc(current.dueDate||(existing?'':dayKey(new Date())))}"></label><label>Due time <span>(planning only)</span><input name="dueTime" type="time" value="${esc(current.dueTime||'')}"></label></div><label>Priority<select name="priority"><option value="normal" ${current.priority==='urgent'?'':'selected'}>Normal</option><option value="urgent" ${current.priority==='urgent'?'selected':''}>Urgent</option></select></label><label class="v11115-task-repeat"><input name="repeatDaily" type="checkbox" ${current.repeat==='daily'?'checked':''}> Repeat daily</label><div class="v11115-modal-error" data-modal-error></div><div class="v11115-modal-actions"><button type="button" data-organiser-modal-close>Cancel</button><button type="submit">${existing?'Save changes':'Add task'}</button></div></form>`,async data=>{const stayKey=String(data.get('stayKey')||''),dog=dogs.find(d=>String(d.stayKey)===stayKey),value={...current,dueDate:String(data.get('dueDate')||''),dueTime:String(data.get('dueTime')||''),priority:String(data.get('priority')||'normal'),repeat:data.get('repeatDaily')?'daily':'none'};const title=String(data.get('title')||'').trim();if(!title)throw new Error('Enter a task name.');if(value.dueTime&&!value.dueDate&&value.repeat!=='daily')throw new Error('Choose a due date for this time.');if(dog){value.stayId=dog.stayId||'';value.dogId=dog.dogId||'';value.dogNumber=dog.dogNumber||'';}else if(!stayKey){delete value.stayId;delete value.dogId;delete value.dogNumber;}if(!existing){value.done=false;value.completedDates=[];}await saveItem({...existing,id:draftId,type:'task',title:String(data.get('title')||'').trim(),stayKey,dogName:dog?.dogName||(existing&&stayKey===String(existing.stayKey||'')?existing.dogName||'':''),value},{expectedId:draftId});});
    ensureModal().querySelectorAll('[data-task-template]').forEach(b=>b.addEventListener('click',()=>{const input=ensureModal().querySelector('[name=title]');input.value=b.dataset.taskTemplate;input.focus()}));
  }
  function setLoading(loading) {
    state.loading = loading;
    const root = document.getElementById('v11115OrganiserRoot');
    if (root) root.classList.toggle('is-loading', loading);
    const refresh = document.querySelector('[data-organiser-refresh]');
    if (refresh) {
      refresh.disabled = loading;
      refresh.textContent = loading ? 'Refreshing…' : 'Refresh';
    }
  }

  async function loadOrganiser(options) {
    if (state.loading || (!options?.force && state.lastLoadedAt && Date.now()-state.lastLoadedAt < 60000)) return;
    if (document.getElementById('v11115OrganiserModal')?.hidden === false) return;
    setLoading(true);const dateLabel=document.querySelector('[data-organiser-date]');if(dateLabel)dateLabel.textContent=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',weekday:'long',day:'numeric',month:'long'}).format(new Date());
    Object.keys(state.source).forEach(key => {state.source[key]='loading';});
    const sync = () => {
      const status = document.querySelector('[data-source-status]');
      const failed = Object.keys(state.source).filter(key => state.source[key] === 'error');
      if (status) {
        status.textContent = failed.length ? `${failed.map(key=>({organiser:'Tasks',directory:'Stays',operations:'Stay status'})[key]).join(' and ')} unavailable · Refresh to retry` : Object.values(state.source).includes('loading') ? 'Refreshing shared information…' : 'Shared information up to date';
        status.dataset.state = failed.length ? 'stale' : 'ready';
      }
      const add = document.querySelector('[data-organiser-add-task]'); if(add) add.disabled = !canWrite();
      renderActiveTab();
    };
    const bounded = promise => new Promise((resolve,reject) => {
      const timer = setTimeout(()=>reject(new Error('This refresh timed out.')),18000);
      Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
    });
    const track = (key, promise, field, apply) => bounded(promise).then(response => {
      if(response?.result!=='success'||!Array.isArray(response[field]))throw new Error('Unrecognised data response.');
      apply(response); state.source[key]='ready'; state.loaded[key]=true; sync(); return response;
    }).catch(error=>{state.source[key]='error';sync();throw error;});
    sync();
    const organiser = track('organiser',query({action:'get_organiser'}),'items',response=>{state.items=response.items;state.organiserReady=true;});
    const directory = track('directory',query({action:'get_guest_directory'}),'bookings',response=>{state.bookings=response.bookings;});
    // Current directory responses already contain verified operations. Older
    // deployments get one fallback read; task rendering never waits for stays.
    const operations = track('operations',directory.then(response => Array.isArray(response.operations) ? {result:'success',records:response.operations} : query({action:'get_stay_operations'})),'records',response=>{state.operations=response.records;});
    try { await Promise.allSettled([organiser,directory,operations]); state.lastLoadedAt=Date.now(); }
    finally {setLoading(false);sync();flushWorkspaceRefresh();}
  }
  function flushWorkspaceRefresh() {
    if (!state.workspaceRefreshQueued || state.loading || document.getElementById('v11115OrganiserModal')?.hidden === false) return;
    state.workspaceRefreshQueued = false;
    void loadOrganiser({ force: true });
  }

  function wireResumeRefresh() {
    const refreshWorkspace = () => { state.workspaceRefreshQueued = true; flushWorkspaceRefresh(); };
    window.addEventListener('waffle:stay-operation-updated', refreshWorkspace);
    window.addEventListener('storage', event => { if (event.key === 'waffle:stay-operation-updated') refreshWorkspace(); });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && PAGE === 'reminders' && Date.now() - state.lastLoadedAt > 120000) {
        loadOrganiser({ force: true }).catch(() => {});
      }
    });
    window.addEventListener('pageshow', event => {
      if (PAGE === 'reminders' && event.persisted) loadOrganiser({ force: true }).catch(() => {});
    });
  }

  function start() {
    renameNavigation();
    if (PAGE !== 'reminders') return;
    buildShell();
    switchTab('overview');
    wireResumeRefresh();
    setTimeout(() => loadOrganiser({ force: true }), 80);
  }

  window.WAFFLE_ORGANISER_UI = Object.freeze({ openTab: switchTab });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

(function () {
  'use strict';
  window.WAFFLE_ORGANISER_CANONICAL = Object.freeze({
    build: '2026.11.04.05',
    module: 'organiser.js',
    rollbackSources: ['waffle-v11.1.15.js', 'waffle-v11.1.15.css']
  });
})();
