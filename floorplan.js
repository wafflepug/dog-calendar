/* ============================================================
   WAFFLE HOUSE — ORGANISER FLOORPLAN STUDIO
   ------------------------------------------------------------
   Template-first spatial planning for sleeping, feeding, play and safe zones.
   Works as an additive Organiser module on desktop and mobile.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_ORGANISER_FLOORPLAN) return;

  const VERSION = '1.0.0';
  const PAGE = String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  if (PAGE && PAGE !== 'reminders') return;

  const KINDS = Object.freeze({
    sleep: { label: 'Sleeping', icon: '🛏' },
    eat: { label: 'Eating', icon: '🍲' },
    play: { label: 'Play / General', icon: '🐾' },
    safe: { label: 'Safe / Separation', icon: '🛡️' }
  });

  const TEMPLATES = Object.freeze([
    template('small-square', 'Cosy Square', 'Small', 'Square',
      [room('living', 'Living Room', '70,70 930,70 930,570 70,570')],
      [zone('sleep-a','sleep','Bed A',180,175,230,120,'living'), zone('eat-a','eat','Feeding',650,370,190,110,'living')]),
    template('small-rectangle', 'Compact Rectangle', 'Small', 'Rectangle',
      [room('living','Living Room','50,120 950,120 950,520 50,520')],
      [zone('sleep-a','sleep','Sleep',150,210,250,120,'living'), zone('eat-a','eat','Meals',650,345,200,105,'living')]),
    template('small-long', 'Long Lounge', 'Small', 'Long / narrow',
      [room('living','Long Lounge','35,185 965,185 965,455 35,455')],
      [zone('sleep-a','sleep','Quiet End',105,245,230,115,'living'), zone('eat-a','eat','Meal End',665,245,220,115,'living')]),
    template('medium-square', 'Classic Living Room', 'Medium', 'Square',
      [room('living','Living Room','80,65 920,65 920,575 80,575')],
      [zone('sleep-a','sleep','Bed A',155,160,215,115,'living'), zone('sleep-b','sleep','Bed B',610,160,215,115,'living'), zone('eat-a','eat','Meals',390,390,220,110,'living')]),
    template('medium-rectangle', 'Living + Dining', 'Medium', 'Rectangle',
      [room('living','Living Room','45,75 610,75 610,565 45,565'), room('dining','Dining','610,75 955,75 955,565 610,565')],
      [zone('sleep-a','sleep','Lounge Bed',140,190,235,120,'living'), zone('play-a','play','Shared Play',160,390,330,105,'living'), zone('eat-a','eat','Dining Station',690,245,185,110,'dining')]),
    template('medium-l', 'L-Shaped Living', 'Medium', 'L shape',
      [room('living','Living Room','60,70 940,70 940,300 600,300 600,570 60,570')],
      [zone('sleep-a','sleep','Sleep Nook',125,375,220,115,'living'), zone('play-a','play','Play',365,150,270,105,'living'), zone('eat-a','eat','Meals',690,150,180,105,'living')]),
    template('medium-open', 'Open Living / Kitchen', 'Medium', 'Open plan',
      [room('living','Living','50,70 650,70 650,570 50,570'), room('kitchen','Kitchen','650,70 950,70 950,570 650,570')],
      [zone('sleep-a','sleep','Living Bed',145,185,225,115,'living'), zone('play-a','play','Shared Area',160,405,335,100,'living'), zone('eat-a','eat','Meal Station',710,255,180,110,'kitchen')]),
    template('large-open', 'Large Open Plan', 'Large', 'Open plan',
      [room('living','Living','35,55 965,55 965,585 35,585')],
      [zone('sleep-a','sleep','Bed A',105,145,210,110,'living'), zone('sleep-b','sleep','Bed B',395,145,210,110,'living'), zone('safe-a','safe','Quiet Zone',685,145,205,110,'living'), zone('eat-a','eat','Meals',655,390,220,110,'living'), zone('play-a','play','Play',175,390,330,110,'living')]),
    template('large-l', 'Large L Shape', 'Large', 'L shape',
      [room('living','Living','35,55 965,55 965,330 635,330 635,585 35,585')],
      [zone('sleep-a','sleep','Bed A',110,395,210,110,'living'), zone('sleep-b','sleep','Bed B',370,395,210,110,'living'), zone('play-a','play','Play',240,165,325,105,'living'), zone('eat-a','eat','Meals',690,160,200,110,'living')]),
    template('large-u', 'U-Shaped Living', 'Large', 'U shape',
      [room('living','Living','35,55 965,55 965,585 700,585 700,300 300,300 300,585 35,585')],
      [zone('sleep-a','sleep','Left Bed',80,395,170,105,'living'), zone('sleep-b','sleep','Right Bed',750,395,170,105,'living'), zone('play-a','play','Shared Play',350,120,300,105,'living')]),
    template('large-multi', 'Living + Dining + Kitchen', 'Large', 'Multi-room',
      [room('living','Living','35,55 560,55 560,585 35,585'), room('dining','Dining','560,55 965,55 965,320 560,320'), room('kitchen','Kitchen','560,320 965,320 965,585 560,585')],
      [zone('sleep-a','sleep','Living Bed',125,175,220,115,'living'), zone('play-a','play','Play',135,405,330,105,'living'), zone('eat-a','eat','Dining Meals',655,145,210,105,'dining'), zone('safe-a','safe','Kitchen Quiet',655,405,210,105,'kitchen')]),
    template('multi-room', 'Multi-Room Retreat', 'Large', 'Multi-room',
      [room('living','Living','35,55 620,55 620,400 35,400'), room('office','Quiet Room','35,400 350,400 350,585 35,585'), room('bedroom','Bedroom','350,400 620,400 620,585 350,585'), room('kitchen','Kitchen','620,55 965,55 965,585 620,585')],
      [zone('play-a','play','Living Play',145,195,330,105,'living'), zone('safe-a','safe','Quiet Room',90,445,200,95,'office'), zone('sleep-a','sleep','Bedroom',390,445,190,95,'bedroom'), zone('eat-a','eat','Meals',700,245,190,105,'kitchen')]),
    template('custom-blank', 'Blank Custom', 'Custom', 'Build your own',
      [room('main','Main Space','70,70 930,70 930,570 70,570')], [])
  ]);

  const state = {
    items: [], plans: [], bookings: [], activePlanId: '', selectedDogKey: '', selectedZoneId: '',
    viewMode: 'tonight', filterSize: 'All', loading: false, installing: false
  };

  function template(id, name, size, shape, rooms, zones) { return { id, name, size, shape, rooms, zones }; }
  function room(id, name, points) { return { id, name, points }; }
  function zone(id, kind, label, x, y, w, h, roomId) { return { id, kind, label, x, y, w, h, roomId }; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function esc(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random()*1e6).toString(36)}`; }

  function loadCss() {
    if (document.querySelector('link[data-waffle-floorplan-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `floorplan.css?build=${encodeURIComponent(window.WAFFLE_BUILD || VERSION)}`;
    link.dataset.waffleFloorplanStyle = VERSION;
    document.head.appendChild(link);
  }

  function query(payload) {
    if (typeof window.queryAppsScript !== 'function') return Promise.reject(new Error('Waffle House data service is not ready yet.'));
    return window.queryAppsScript(payload);
  }

  function toast(message, mode) {
    if (typeof window.showWaffleToast === 'function') {
      try { window.showWaffleToast(message, mode || 'success'); return; } catch (_) {}
    }
    let node = document.getElementById('floorplanToast');
    if (!node) { node = document.createElement('div'); node.id = 'floorplanToast'; node.className = 'floorplan-toast'; document.body.appendChild(node); }
    node.textContent = message; node.dataset.mode = mode || 'success'; node.classList.add('is-visible');
    clearTimeout(node._timer); node._timer = setTimeout(() => node.classList.remove('is-visible'), 2400);
  }

  function parseDate(value) {
    if (!value) return null;
    const raw = String(value).trim();
    let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2]-1, +m[3]);
    m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2]-1, +m[1]);
    const d = new Date(raw); return Number.isNaN(d.getTime()) ? null : d;
  }
  function sod(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function uniqueBookings() {
    const seen = new Set();
    return (state.bookings || []).filter(b => {
      const key = String(b.stayKey || `${b.dogName}|${b.startDate}|${b.endDate}`);
      if (!key || seen.has(key)) return false; seen.add(key); return true;
    });
  }

  function currentDogs() {
    const today = sod(new Date());
    return uniqueBookings().filter(b => {
      const start = parseDate(b.startDate), end = parseDate(b.endDate);
      return start && end && sod(start) <= today && sod(end) >= today;
    }).map(b => ({ key: String(b.stayKey || `${b.dogName}|${b.startDate}|${b.endDate}`), name: String(b.dogName || 'Guest'), startDate:b.startDate, endDate:b.endDate }))
      .sort((a,b) => a.name.localeCompare(b.name));
  }

  function normalisePlan(item) {
    const value = item && item.value && typeof item.value === 'object' ? item.value : {};
    return {
      id: String(item.id || ''), title: String(item.title || value.name || 'Floorplan'), default: value.default === true,
      templateId: String(value.templateId || 'custom-blank'), rooms: Array.isArray(value.rooms) ? value.rooms : [],
      zones: Array.isArray(value.zones) ? value.zones : [], assignments: Array.isArray(value.assignments) ? value.assignments : [],
      createdAt: value.createdAt || item.updatedAt || '', updatedAt: value.updatedAt || item.updatedAt || ''
    };
  }

  async function loadData() {
    if (state.loading) return;
    state.loading = true; setBusy(true);
    try {
      const [org, directory] = await Promise.all([query({ action:'get_organiser' }), query({ action:'get_guest_directory' })]);
      state.items = Array.isArray(org?.items) ? org.items : [];
      state.plans = state.items.filter(item => item?.type === 'floorplan').map(normalisePlan);
      state.bookings = Array.isArray(directory?.bookings) ? directory.bookings : [];
      if (!state.activePlanId || !state.plans.some(p => p.id === state.activePlanId)) {
        const preferred = state.plans.find(p => p.default) || state.plans[0];
        state.activePlanId = preferred?.id || '';
      }
      render();
    } catch (error) { toast(error.message || 'Could not load Floorplan.', 'error'); }
    finally { state.loading = false; setBusy(false); }
  }

  function setBusy(on) {
    document.querySelectorAll('[data-floorplan-refresh]').forEach(b => { b.disabled = !!on; b.textContent = on ? 'Updating…' : 'Refresh'; });
  }

  function activePlan() { return state.plans.find(p => p.id === state.activePlanId) || null; }

  async function savePlan(plan, message) {
    const payload = { version:VERSION, name:plan.title, templateId:plan.templateId, default:plan.default === true, rooms:plan.rooms, zones:plan.zones, assignments:plan.assignments, createdAt:plan.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString() };
    const response = await query({ action:'save_organiser_item', id:plan.id || '', type:'floorplan', title:plan.title || 'Floorplan', value:payload });
    if (!response || response.result !== 'success' || !response.item) throw new Error(response?.message || 'Floorplan could not be saved.');
    const saved = normalisePlan(response.item);
    const index = state.plans.findIndex(p => p.id === saved.id);
    if (index >= 0) state.plans[index] = saved; else state.plans.push(saved);
    state.activePlanId = saved.id;
    if (message !== false) toast(typeof message === 'string' ? message : 'Floorplan saved ✓');
    return saved;
  }

  async function createFromTemplate(templateId) {
    const t = TEMPLATES.find(x => x.id === templateId); if (!t) return;
    const count = state.plans.length + 1;
    const plan = { id:'', title: state.plans.length ? `${t.name} ${count}` : t.name, default: state.plans.length === 0, templateId:t.id, rooms:clone(t.rooms), zones:clone(t.zones), assignments:[], createdAt:new Date().toISOString() };
    try { await savePlan(plan, 'Floorplan created ✓'); render(); } catch (error) { toast(error.message, 'error'); }
  }

  async function deletePlan(id) {
    const plan = state.plans.find(p => p.id === id); if (!plan) return;
    if (!window.confirm(`Delete “${plan.title}”?`)) return;
    try {
      const response = await query({ action:'delete_organiser_item', id });
      if (!response || response.result !== 'success') throw new Error(response?.message || 'Floorplan could not be deleted.');
      state.plans = state.plans.filter(p => p.id !== id);
      state.activePlanId = (state.plans.find(p => p.default) || state.plans[0])?.id || '';
      toast('Floorplan removed'); render();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function setDefault(id) {
    try {
      for (const plan of state.plans) {
        const should = plan.id === id;
        if (plan.default !== should) { plan.default = should; await savePlan(plan, false); }
      }
      toast('Default floorplan updated ✓'); render();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function duplicatePlan(id) {
    const source = state.plans.find(p => p.id === id); if (!source) return;
    const copy = clone(source); copy.id=''; copy.title=`${source.title} Copy`; copy.default=false; copy.assignments=[]; copy.createdAt=new Date().toISOString();
    try { await savePlan(copy, 'Floorplan duplicated ✓'); render(); } catch(error) { toast(error.message,'error'); }
  }

  function assignmentFor(plan, dogKey, kind) { return plan.assignments.find(a => a.dogKey === dogKey && a.kind === kind) || null; }
  function zoneById(plan,id) { return plan.zones.find(z => z.id === id) || null; }

  async function assignDog(plan, dogKey, zoneId) {
    const dog = currentDogs().find(d => d.key === dogKey); const z = zoneById(plan, zoneId);
    if (!dog || !z) return;
    plan.assignments = plan.assignments.filter(a => !(a.dogKey === dogKey && a.kind === z.kind));
    plan.assignments.push({ dogKey, dogName:dog.name, kind:z.kind, zoneId:z.id });
    state.selectedDogKey = dogKey; state.selectedZoneId = z.id;
    renderEditor();
    try { await savePlan(plan, false); toast(`${dog.name} → ${z.label} ✓`); } catch(error) { toast(error.message,'error'); }
  }

  async function unassign(plan, dogKey, kind) {
    plan.assignments = plan.assignments.filter(a => !(a.dogKey === dogKey && a.kind === kind));
    renderEditor();
    try { await savePlan(plan, false); toast('Assignment cleared'); } catch(error) { toast(error.message,'error'); }
  }

  function roomBounds(r) {
    const nums = String(r.points || '').trim().split(/[ ,]+/).map(Number).filter(Number.isFinite);
    const xs=[], ys=[]; for(let i=0;i<nums.length;i+=2){xs.push(nums[i]);ys.push(nums[i+1]);}
    return { minX:Math.min(...xs,100), maxX:Math.max(...xs,900), minY:Math.min(...ys,100), maxY:Math.max(...ys,540) };
  }

  async function addZoneFromForm(plan) {
    const form = document.getElementById('floorplanAddZoneForm'); if (!form) return;
    const fd = new FormData(form), kind=String(fd.get('kind')||'sleep'), roomId=String(fd.get('roomId')||plan.rooms[0]?.id||'');
    const r = plan.rooms.find(x=>x.id===roomId) || plan.rooms[0]; if (!r) return;
    const b=roomBounds(r), existing=plan.zones.filter(z=>z.roomId===r.id).length;
    const w=Math.min(220, Math.max(150,(b.maxX-b.minX)*0.32)), h=100;
    const x=Math.min(b.maxX-w-20,b.minX+35+(existing%2)*(w+35));
    const y=Math.min(b.maxY-h-20,b.minY+55+Math.floor(existing/2)*(h+35));
    plan.zones.push(zone(uid('zone'),kind,String(fd.get('label')||KINDS[kind]?.label||'Area').slice(0,60),Math.round(x),Math.round(y),Math.round(w),h,r.id));
    renderEditor();
    try { await savePlan(plan,false); toast('Area added ✓'); } catch(error){toast(error.message,'error');}
  }

  async function deleteZone(plan,id) {
    plan.zones=plan.zones.filter(z=>z.id!==id); plan.assignments=plan.assignments.filter(a=>a.zoneId!==id); state.selectedZoneId=''; renderEditor();
    try { await savePlan(plan,false); toast('Area removed'); } catch(error){toast(error.message,'error');}
  }

  async function renamePlan(plan,value) { const next=String(value||'').trim().slice(0,90); if(!next||next===plan.title)return; plan.title=next; try{await savePlan(plan,false);toast('Name updated ✓');render();}catch(error){toast(error.message,'error');} }
  async function renameZone(plan,id,value) { const z=zoneById(plan,id),next=String(value||'').trim().slice(0,60); if(!z||!next||next===z.label)return; z.label=next; renderEditor(); try{await savePlan(plan,false);toast('Area renamed ✓');}catch(error){toast(error.message,'error');} }

  function templateMini(t) {
    return `<svg viewBox="0 0 1000 640" aria-hidden="true">${t.rooms.map(r=>`<polygon points="${esc(r.points)}"></polygon>`).join('')}</svg>`;
  }

  function templatePickerHtml() {
    const sizes=['All','Small','Medium','Large','Custom'];
    const filtered=TEMPLATES.filter(t=>state.filterSize==='All'||t.size===state.filterSize);
    return `<section class="floorplan-picker">
      <div class="floorplan-section-head"><div><span class="floorplan-kicker">START WITH A SHAPE</span><h2>Choose your living space</h2><p>Pick the closest layout. You can add care zones after creating it.</p></div></div>
      <div class="floorplan-filter" role="group" aria-label="Floorplan size">${sizes.map(s=>`<button type="button" data-floorplan-size="${s}" class="${state.filterSize===s?'is-active':''}">${s}</button>`).join('')}</div>
      <div class="floorplan-template-grid">${filtered.map(t=>`<button type="button" class="floorplan-template" data-floorplan-template="${t.id}"><span class="floorplan-template-art">${templateMini(t)}</span><span class="floorplan-template-copy"><strong>${esc(t.name)}</strong><small>${esc(t.size)} · ${esc(t.shape)}</small></span></button>`).join('')}</div>
    </section>`;
  }

  function plansRailHtml() {
    if (!state.plans.length) return '';
    return `<div class="floorplan-planrail" aria-label="Saved floorplans">${state.plans.map(p=>`<button type="button" data-floorplan-plan="${p.id}" class="${p.id===state.activePlanId?'is-active':''}"><span>🏠</span><span><strong>${esc(p.title)}</strong><small>${p.default?'Default setup':'Saved layout'}</small></span>${p.default?'<em>★</em>':''}</button>`).join('')}<button type="button" data-floorplan-new class="floorplan-planrail-new"><span>＋</span><span><strong>New floorplan</strong><small>Choose another template</small></span></button></div>`;
  }

  function render() {
    const host=document.querySelector('[data-organiser-view="floorplan"]'); if(!host)return;
    const plan=activePlan();
    host.innerHTML=`<div class="floorplan-shell">
      <div class="floorplan-head"><div><span class="floorplan-kicker">SPATIAL CARE PLANNING</span><h1>🏠 Floorplan</h1><p>Choose a home layout, create care areas, then place each current guest where they sleep, eat and settle.</p></div><button type="button" data-floorplan-refresh>Refresh</button></div>
      ${plansRailHtml()}
      <div id="floorplanMain">${plan?editorHtml(plan):templatePickerHtml()}</div>
    </div>`;
    bindRoot(); if(plan) bindEditor(); else bindPicker();
  }

  function editorHtml(plan) {
    const dogs=currentDogs(); const sleepDone=dogs.filter(d=>assignmentFor(plan,d.key,'sleep')).length, eatDone=dogs.filter(d=>assignmentFor(plan,d.key,'eat')).length;
    return `<section class="floorplan-studio">
      <div class="floorplan-toolbar">
        <div class="floorplan-title-edit"><label>Floorplan name<input data-floorplan-name value="${esc(plan.title)}" maxlength="90"></label>${plan.default?'<span class="floorplan-default">★ Default</span>':''}</div>
        <div class="floorplan-mode" role="group"><button type="button" data-floorplan-mode="tonight" class="${state.viewMode==='tonight'?'is-active':''}">Tonight</button><button type="button" data-floorplan-mode="layout" class="${state.viewMode==='layout'?'is-active':''}">Layout</button></div>
        <div class="floorplan-actions"><button type="button" data-floorplan-default>${plan.default?'Default':'Make default'}</button><button type="button" data-floorplan-duplicate>Duplicate</button><button type="button" data-floorplan-delete class="is-danger">Delete</button></div>
      </div>
      <div class="floorplan-progress"><span class="${dogs.length&&sleepDone===dogs.length?'is-complete':''}">🛏 ${sleepDone}/${dogs.length} sleeping</span><span class="${dogs.length&&eatDone===dogs.length?'is-complete':''}">🍲 ${eatDone}/${dogs.length} eating</span><span>🐶 ${dogs.length} current guests</span></div>
      <div class="floorplan-workspace ${state.viewMode==='layout'?'is-layout':'is-tonight'}">
        <aside class="floorplan-sidebar floorplan-dogs"><div class="floorplan-panel-title"><div><strong>Dogs today</strong><small>${dogs.length ? 'Tap a dog, then tap an area. Drag works on desktop.' : 'No current guests found.'}</small></div></div>${dogs.length?`<div class="floorplan-doglist">${dogs.map(d=>dogCardHtml(plan,d)).join('')}</div>`:'<div class="floorplan-empty-mini">Current guests from Care will appear here automatically.</div>'}</aside>
        <main class="floorplan-canvas-wrap"><div class="floorplan-canvas-toolbar"><span>${state.viewMode==='tonight'?'Tonight’s placements':'Edit care areas'}</span><small>${state.selectedDogKey?'Area tap will assign selected dog':'Select a dog to assign'}</small></div>${canvasHtml(plan,dogs)}</main>
        <aside class="floorplan-sidebar floorplan-inspector">${state.viewMode==='layout'?layoutInspectorHtml(plan):tonightInspectorHtml(plan,dogs)}</aside>
      </div>
    </section>`;
  }

  function dogCardHtml(plan,d) {
    const sleep=assignmentFor(plan,d.key,'sleep'), eat=assignmentFor(plan,d.key,'eat');
    return `<button type="button" draggable="true" data-floorplan-dog="${esc(d.key)}" class="floorplan-dog ${state.selectedDogKey===d.key?'is-selected':''}"><span class="floorplan-dog-avatar">${esc(d.name.slice(0,1).toUpperCase())}</span><span class="floorplan-dog-copy"><strong>${esc(d.name)}</strong><small>${sleep?'🛏 '+esc(zoneById(plan,sleep.zoneId)?.label||'Assigned'):'🛏 unassigned'} · ${eat?'🍲 '+esc(zoneById(plan,eat.zoneId)?.label||'Assigned'):'🍲 unassigned'}</small></span></button>`;
  }

  function canvasHtml(plan,dogs) {
    return `<div class="floorplan-canvas" data-floorplan-canvas><svg viewBox="0 0 1000 640" role="img" aria-label="${esc(plan.title)} floorplan">
      <g class="floorplan-rooms">${plan.rooms.map(r=>`<polygon points="${esc(r.points)}" data-room-id="${esc(r.id)}"></polygon><text class="floorplan-room-label" x="${roomBounds(r).minX+22}" y="${roomBounds(r).minY+34}">${esc(r.name)}</text>`).join('')}</g>
      <g class="floorplan-zones">${plan.zones.map(z=>zoneSvgHtml(plan,z,dogs)).join('')}</g>
    </svg>${!plan.zones.length?'<div class="floorplan-canvas-empty">No care areas yet. Switch to <strong>Layout</strong> and add a sleeping or eating area.</div>':''}</div>`;
  }

  function zoneSvgHtml(plan,z,dogs) {
    const meta=KINDS[z.kind]||KINDS.play;
    const assigned=dogs.filter(d=>plan.assignments.some(a=>a.dogKey===d.key&&a.zoneId===z.id));
    const chosen=state.selectedZoneId===z.id;
    const names=assigned.slice(0,3).map(d=>d.name).join(' · ')+(assigned.length>3?` +${assigned.length-3}`:'');
    return `<g class="floorplan-zone kind-${esc(z.kind)} ${chosen?'is-selected':''}" data-floorplan-zone="${esc(z.id)}" tabindex="0" role="button" aria-label="${esc(meta.label+' '+z.label)}"><rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="22"></rect><text class="floorplan-zone-icon" x="${z.x+18}" y="${z.y+34}">${meta.icon}</text><text class="floorplan-zone-label" x="${z.x+18}" y="${z.y+61}">${esc(z.label)}</text>${names?`<text class="floorplan-zone-dogs" x="${z.x+18}" y="${z.y+85}">${esc(names.slice(0,36))}</text>`:''}</g>`;
  }

  function tonightInspectorHtml(plan,dogs) {
    if(!dogs.length)return '<div class="floorplan-panel-title"><div><strong>Tonight</strong><small>Assignments will appear when guests are current.</small></div></div>';
    const rows=dogs.map(d=>{
      const entries=['sleep','eat','safe','play'].map(kind=>{const a=assignmentFor(plan,d.key,kind);if(!a)return'';const z=zoneById(plan,a.zoneId);return `<span>${KINDS[kind].icon} ${esc(z?.label||KINDS[kind].label)} <button type="button" data-floorplan-unassign="${esc(d.key)}|${kind}" aria-label="Clear ${kind} assignment">×</button></span>`;}).filter(Boolean).join('');
      return `<div class="floorplan-summary-dog"><strong>${esc(d.name)}</strong>${entries||'<small>No areas assigned yet.</small>'}</div>`;
    }).join('');
    return `<div class="floorplan-panel-title"><div><strong>Tonight</strong><small>One area per care type, per dog.</small></div></div><div class="floorplan-summary-list">${rows}</div>`;
  }

  function layoutInspectorHtml(plan) {
    const selected=zoneById(plan,state.selectedZoneId);
    return `<div class="floorplan-panel-title"><div><strong>Layout tools</strong><small>Add reusable care areas to this home layout.</small></div></div>
      <form id="floorplanAddZoneForm" class="floorplan-add-form"><label>Area type<select name="kind">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select></label><label>Area name<input name="label" maxlength="60" placeholder="e.g. Window bed"></label><label>Room<select name="roomId">${plan.rooms.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select></label><button type="submit">＋ Add area</button></form>
      ${selected?`<div class="floorplan-zone-edit"><strong>Edit selected area</strong><label>Name<input data-floorplan-zone-name="${esc(selected.id)}" value="${esc(selected.label)}" maxlength="60"></label><button type="button" data-floorplan-zone-delete="${esc(selected.id)}" class="is-danger">Remove area</button></div>`:'<div class="floorplan-hint">Tip: tap an area in the plan to edit it.</div>'}
      <div class="floorplan-legend">${Object.entries(KINDS).map(([k,v])=>`<span class="kind-${k}">${v.icon} ${v.label}</span>`).join('')}</div>`;
  }

  function bindRoot() {
    document.querySelector('[data-floorplan-refresh]')?.addEventListener('click',()=>loadData(true));
    document.querySelectorAll('[data-floorplan-plan]').forEach(b=>b.addEventListener('click',()=>{state.activePlanId=b.dataset.floorplanPlan;state.selectedDogKey='';state.selectedZoneId='';render();}));
    document.querySelector('[data-floorplan-new]')?.addEventListener('click',()=>{state.activePlanId='';render();});
  }

  function bindPicker() {
    document.querySelectorAll('[data-floorplan-size]').forEach(b=>b.addEventListener('click',()=>{state.filterSize=b.dataset.floorplanSize;render();}));
    document.querySelectorAll('[data-floorplan-template]').forEach(b=>b.addEventListener('click',()=>createFromTemplate(b.dataset.floorplanTemplate)));
  }

  function bindEditor() {
    const plan=activePlan(); if(!plan)return;
    document.querySelector('[data-floorplan-name]')?.addEventListener('change',e=>renamePlan(plan,e.target.value));
    document.querySelectorAll('[data-floorplan-mode]').forEach(b=>b.addEventListener('click',()=>{state.viewMode=b.dataset.floorplanMode;state.selectedZoneId='';renderEditor();}));
    document.querySelector('[data-floorplan-default]')?.addEventListener('click',()=>setDefault(plan.id));
    document.querySelector('[data-floorplan-duplicate]')?.addEventListener('click',()=>duplicatePlan(plan.id));
    document.querySelector('[data-floorplan-delete]')?.addEventListener('click',()=>deletePlan(plan.id));
    document.querySelectorAll('[data-floorplan-dog]').forEach(b=>{
      b.addEventListener('click',()=>{state.selectedDogKey=state.selectedDogKey===b.dataset.floorplanDog?'':b.dataset.floorplanDog;renderEditor();});
      b.addEventListener('dragstart',e=>{state.selectedDogKey=b.dataset.floorplanDog;try{e.dataTransfer.setData('text/waffle-dog',b.dataset.floorplanDog);e.dataTransfer.effectAllowed='copy';}catch(_){}});
    });
    document.querySelectorAll('[data-floorplan-zone]').forEach(g=>{
      const activate=()=>{const id=g.dataset.floorplanZone;state.selectedZoneId=id;if(state.selectedDogKey)assignDog(plan,state.selectedDogKey,id);else renderEditor();};
      g.addEventListener('click',activate); g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
      g.addEventListener('dragover',e=>{e.preventDefault();g.classList.add('is-drop-target');}); g.addEventListener('dragleave',()=>g.classList.remove('is-drop-target'));
      g.addEventListener('drop',e=>{e.preventDefault();g.classList.remove('is-drop-target');const dogKey=e.dataTransfer?.getData('text/waffle-dog')||state.selectedDogKey;if(dogKey)assignDog(plan,dogKey,g.dataset.floorplanZone);});
    });
    document.getElementById('floorplanAddZoneForm')?.addEventListener('submit',e=>{e.preventDefault();addZoneFromForm(plan);});
    document.querySelector('[data-floorplan-zone-name]')?.addEventListener('change',e=>renameZone(plan,e.target.dataset.floorplanZoneName,e.target.value));
    document.querySelector('[data-floorplan-zone-delete]')?.addEventListener('click',e=>deleteZone(plan,e.target.dataset.floorplanZoneDelete));
    document.querySelectorAll('[data-floorplan-unassign]').forEach(b=>b.addEventListener('click',()=>{const [dogKey,kind]=b.dataset.floorplanUnassign.split('|');unassign(plan,dogKey,kind);}));
  }

  function renderEditor() {
    const main=document.getElementById('floorplanMain'), plan=activePlan(); if(!main||!plan)return; main.innerHTML=editorHtml(plan); bindEditor();
  }

  function activateFloorplanTab() {
    document.querySelectorAll('[data-organiser-tab]').forEach(b=>{const active=b.dataset.organiserTab==='floorplan';b.classList.toggle('is-active',active);b.setAttribute('aria-selected',active?'true':'false');});
    document.querySelectorAll('[data-organiser-view]').forEach(v=>{v.hidden=v.dataset.organiserView!=='floorplan';});
    loadData(true);
  }

  function install() {
    if(state.installing)return; state.installing=true;
    try {
      const root=document.getElementById('v11115OrganiserRoot'); if(!root)return false;
      const tabs=root.querySelector('.v11115-organiser-tabs'), body=root.querySelector('.v11115-organiser-body'); if(!tabs||!body)return false;
      if(!tabs.querySelector('[data-organiser-tab="floorplan"]')) {
        const button=document.createElement('button'); button.type='button'; button.dataset.organiserTab='floorplan'; button.textContent='🏠 Floorplan'; button.addEventListener('click',activateFloorplanTab);
        const sleep=tabs.querySelector('[data-organiser-tab="sleep"]'); tabs.insertBefore(button,sleep||tabs.lastElementChild);
      }
      if(!body.querySelector('[data-organiser-view="floorplan"]')) { const view=document.createElement('div'); view.dataset.organiserView='floorplan'; view.hidden=true; body.appendChild(view); }
      return true;
    } finally { state.installing=false; }
  }

  function start() {
    if(String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '')!=='reminders')return;
    loadCss();
    if(install())return;
    const observer=new MutationObserver(()=>{if(install())observer.disconnect();}); observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  window.WAFFLE_ORGANISER_FLOORPLAN=Object.freeze({version:VERSION,templates:TEMPLATES.map(t=>({id:t.id,name:t.name,size:t.size,shape:t.shape})),refresh:()=>loadData(true)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
