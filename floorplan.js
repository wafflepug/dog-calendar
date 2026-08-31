/* ============================================================
   WAFFLE HOUSE — ORGANISER FLOORPLAN STUDIO
   ------------------------------------------------------------
   Visual home planning for care zones, room sections and POIs.
   Works as an additive Organiser module on desktop and mobile.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_ORGANISER_FLOORPLAN) return;

  const VERSION = '1.2.0';
  const PAGE = String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '');
  if (PAGE && PAGE !== 'reminders') return;

  const KINDS = Object.freeze({
    sleep: { label: 'Sleeping', icon: '🛏' },
    eat: { label: 'Eating', icon: '🍲' },
    play: { label: 'Play / General', icon: '🐾' },
    safe: { label: 'Safe / Separation', icon: '🛡️' }
  });

  const SECTION_PRESETS = Object.freeze({
    living: { label: 'Living', icon: '🛋️' },
    dining: { label: 'Dining', icon: '🍽️' },
    kitchen: { label: 'Kitchen', icon: '🍳' },
    overflow: { label: 'Overflow', icon: '↔️' },
    quiet: { label: 'Quiet Area', icon: '🤫' },
    entry: { label: 'Entry', icon: '🚪' }
  });

  const ARTEFACTS = Object.freeze({
    couch: { label: 'Couch', icon: '🛋️', w: 210, h: 90, category: 'Furniture' },
    table: { label: 'Dining Table', icon: '🍽️', w: 210, h: 120, category: 'Furniture' },
    chair: { label: 'Seat', icon: '🪑', w: 80, h: 80, category: 'Furniture' },
    crate: { label: 'Crate', icon: '▦', w: 120, h: 90, category: 'Dog setup' },
    dogbed: { label: 'Dog Bed', icon: '🛏️', w: 130, h: 85, category: 'Dog setup' },
    food: { label: 'Food Bowl', icon: '🥣', w: 78, h: 68, category: 'Dog setup' },
    water: { label: 'Water Bowl', icon: '💧', w: 78, h: 68, category: 'Dog setup' },
    gate: { label: 'Gate / Divider', icon: '🚧', w: 165, h: 52, category: 'Structure / POI' },
    door: { label: 'Door', icon: '🚪', w: 80, h: 64, category: 'Structure / POI' }
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
    items: [],
    plans: [],
    bookings: [],
    dogPhotos: Object.create(null),
    activePlanId: '',
    selectedDogKey: '',
    selectedItemType: '',
    selectedItemId: '',
    viewMode: 'tonight',
    filterSize: 'All',
    loading: false,
    installing: false
  };

  function template(id, name, size, shape, rooms, zones) { return { id, name, size, shape, rooms, zones }; }
  function room(id, name, points) { return { id, name, points }; }
  function zone(id, kind, label, x, y, w, h, roomId) { return { id, kind, label, x, y, w, h, roomId }; }
  function section(id, preset, label, x, y, w, h, roomId) { return { id, preset, label, x, y, w, h, roomId }; }
  function artefact(id, kind, label, x, y, w, h, roomId) { return { id, kind, label, x, y, w, h, roomId }; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random()*1e6).toString(36)}`; }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

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
    if (!node) {
      node = document.createElement('div');
      node.id = 'floorplanToast';
      node.className = 'floorplan-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.dataset.mode = mode || 'success';
    node.classList.add('is-visible');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('is-visible'), 2400);
  }

  function parseDate(value) {
    if (!value) return null;
    const raw = String(value).trim();
    let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2]-1, +m[3]);
    m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2]-1, +m[1]);
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function sod(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }

  function uniqueBookings() {
    const seen = new Set();
    return (state.bookings || []).filter(booking => {
      const key = String(booking.stayKey || `${booking.dogName}|${booking.startDate}|${booking.endDate}`);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function currentDogs() {
    const today = sod(new Date());
    return uniqueBookings().filter(booking => {
      const start = parseDate(booking.startDate);
      const end = parseDate(booking.endDate);
      return start && end && sod(start) <= today && sod(end) >= today;
    }).map(booking => {
      const key = String(booking.stayKey || `${booking.dogName}|${booking.startDate}|${booking.endDate}`);
      return {
        key,
        name: String(booking.dogName || 'Guest'),
        startDate: booking.startDate,
        endDate: booking.endDate,
        photoUrl: String(state.dogPhotos[key] || '')
      };
    }).sort((a,b) => a.name.localeCompare(b.name));
  }

  function profilePhotoUrl(record) {
    if (!record || typeof record !== 'object') return '';
    const candidates = [];
    if (record.dogPhoto) candidates.push(record.dogPhoto);
    if (Array.isArray(record.dogPhotoGallery)) candidates.push(...record.dogPhotoGallery);
    for (const photo of candidates) {
      if (!photo || typeof photo !== 'object') continue;
      const url = String(photo.previewUrl || photo.url || photo.driveUrl || '').trim();
      if (url) return url;
    }
    return '';
  }

  async function hydrateDogPhotos(dogs) {
    const missing = (dogs || []).filter(dog => !(dog.key in state.dogPhotos));
    if (!missing.length) return false;
    let changed = false;
    await Promise.all(missing.map(async dog => {
      try {
        const response = await query({ action:'get_guest_belongings', stayKey:dog.key });
        const url = profilePhotoUrl(response?.record || {});
        state.dogPhotos[dog.key] = url;
        if (url) changed = true;
      } catch (_) {
        state.dogPhotos[dog.key] = '';
      }
    }));
    return changed;
  }

  function normaliseBox(item, fallbackRoom) {
    return {
      ...item,
      id: String(item?.id || uid('item')),
      label: String(item?.label || 'Item'),
      x: Number.isFinite(Number(item?.x)) ? Number(item.x) : 120,
      y: Number.isFinite(Number(item?.y)) ? Number(item.y) : 120,
      w: Math.max(30, Number(item?.w) || 160),
      h: Math.max(30, Number(item?.h) || 90),
      roomId: String(item?.roomId || fallbackRoom || '')
    };
  }

  function normalisePlan(item) {
    const value = item && item.value && typeof item.value === 'object' ? item.value : {};
    const rooms = Array.isArray(value.rooms) ? value.rooms : [];
    const fallbackRoom = rooms[0]?.id || '';
    return {
      id: String(item.id || ''),
      title: String(item.title || value.name || 'Floorplan'),
      default: value.default === true,
      templateId: String(value.templateId || 'custom-blank'),
      rooms,
      zones: Array.isArray(value.zones) ? value.zones.map(z => normaliseBox(z,fallbackRoom)) : [],
      sections: Array.isArray(value.sections) ? value.sections.map(s => normaliseBox(s,fallbackRoom)) : [],
      artefacts: Array.isArray(value.artefacts) ? value.artefacts.map(a => normaliseBox(a,fallbackRoom)) : [],
      assignments: Array.isArray(value.assignments) ? value.assignments : [],
      createdAt: value.createdAt || item.updatedAt || '',
      updatedAt: value.updatedAt || item.updatedAt || ''
    };
  }

  async function loadData() {
    if (state.loading) return;
    state.loading = true;
    setBusy(true);
    try {
      const [organiser, directory] = await Promise.all([
        query({ action:'get_organiser' }),
        query({ action:'get_guest_directory' })
      ]);
      state.items = Array.isArray(organiser?.items) ? organiser.items : [];
      state.plans = state.items.filter(item => item?.type === 'floorplan').map(normalisePlan);
      state.bookings = Array.isArray(directory?.bookings) ? directory.bookings : [];
      if (!state.activePlanId || !state.plans.some(plan => plan.id === state.activePlanId)) {
        state.activePlanId = (state.plans.find(plan => plan.default) || state.plans[0])?.id || '';
      }
      render();
      const changed = await hydrateDogPhotos(currentDogs());
      if (changed && activePlan()) renderEditor();
    } catch (error) {
      toast(error.message || 'Could not load Floorplan.', 'error');
    } finally {
      state.loading = false;
      setBusy(false);
    }
  }

  function setBusy(on) {
    document.querySelectorAll('[data-floorplan-refresh]').forEach(button => {
      button.disabled = !!on;
      button.textContent = on ? 'Updating…' : 'Refresh';
    });
  }

  function activePlan() { return state.plans.find(plan => plan.id === state.activePlanId) || null; }

  async function savePlan(plan, message) {
    const payload = {
      version: VERSION,
      name: plan.title,
      templateId: plan.templateId,
      default: plan.default === true,
      rooms: plan.rooms,
      zones: plan.zones,
      sections: plan.sections || [],
      artefacts: plan.artefacts || [],
      assignments: plan.assignments,
      createdAt: plan.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const response = await query({
      action:'save_organiser_item',
      id:plan.id || '',
      type:'floorplan',
      title:plan.title || 'Floorplan',
      value:payload
    });
    if (!response || response.result !== 'success' || !response.item) throw new Error(response?.message || 'Floorplan could not be saved.');
    const saved = normalisePlan(response.item);
    const index = state.plans.findIndex(item => item.id === saved.id);
    if (index >= 0) state.plans[index] = saved;
    else state.plans.push(saved);
    state.activePlanId = saved.id;
    if (message !== false) toast(typeof message === 'string' ? message : 'Floorplan saved ✓');
    return saved;
  }

  async function createFromTemplate(templateId) {
    const source = TEMPLATES.find(item => item.id === templateId);
    if (!source) return;
    const count = state.plans.length + 1;
    const plan = {
      id: '',
      title: state.plans.length ? `${source.name} ${count}` : source.name,
      default: state.plans.length === 0,
      templateId: source.id,
      rooms: clone(source.rooms),
      zones: clone(source.zones),
      sections: [],
      artefacts: [],
      assignments: [],
      createdAt: new Date().toISOString()
    };
    try { await savePlan(plan, 'Floorplan created ✓'); render(); }
    catch (error) { toast(error.message, 'error'); }
  }

  async function deletePlan(id) {
    const plan = state.plans.find(item => item.id === id);
    if (!plan || !window.confirm(`Delete “${plan.title}”?`)) return;
    try {
      const response = await query({ action:'delete_organiser_item', id });
      if (!response || response.result !== 'success') throw new Error(response?.message || 'Floorplan could not be deleted.');
      state.plans = state.plans.filter(item => item.id !== id);
      state.activePlanId = (state.plans.find(item => item.default) || state.plans[0])?.id || '';
      clearSelection();
      toast('Floorplan removed');
      render();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function setDefault(id) {
    try {
      for (const plan of state.plans) {
        const should = plan.id === id;
        if (plan.default !== should) {
          plan.default = should;
          await savePlan(plan, false);
        }
      }
      toast('Default floorplan updated ✓');
      render();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function duplicatePlan(id) {
    const source = state.plans.find(item => item.id === id);
    if (!source) return;
    const copy = clone(source);
    copy.id = '';
    copy.title = `${source.title} Copy`;
    copy.default = false;
    copy.assignments = [];
    copy.createdAt = new Date().toISOString();
    try { await savePlan(copy, 'Floorplan duplicated ✓'); render(); }
    catch (error) { toast(error.message, 'error'); }
  }

  function clearSelection() {
    state.selectedItemType = '';
    state.selectedItemId = '';
  }

  function selectItem(type, id) {
    state.selectedItemType = type;
    state.selectedItemId = id;
  }

  function assignmentFor(plan, dogKey, kind) {
    return plan.assignments.find(item => item.dogKey === dogKey && item.kind === kind) || null;
  }

  function zoneById(plan, id) { return plan.zones.find(item => item.id === id) || null; }
  function sectionById(plan, id) { return (plan.sections || []).find(item => item.id === id) || null; }
  function artefactById(plan, id) { return (plan.artefacts || []).find(item => item.id === id) || null; }

  function selectedItem(plan) {
    if (state.selectedItemType === 'zone') return zoneById(plan,state.selectedItemId);
    if (state.selectedItemType === 'section') return sectionById(plan,state.selectedItemId);
    if (state.selectedItemType === 'artefact') return artefactById(plan,state.selectedItemId);
    return null;
  }

  function itemCollection(plan, type) {
    if (type === 'zone') return plan.zones;
    if (type === 'section') return plan.sections || (plan.sections = []);
    if (type === 'artefact') return plan.artefacts || (plan.artefacts = []);
    return [];
  }

  async function assignDog(plan, dogKey, zoneId) {
    const dog = currentDogs().find(item => item.key === dogKey);
    const targetZone = zoneById(plan, zoneId);
    if (!dog || !targetZone) return;
    plan.assignments = plan.assignments.filter(item => !(item.dogKey === dogKey && item.kind === targetZone.kind));
    plan.assignments.push({ dogKey, dogName:dog.name, kind:targetZone.kind, zoneId:targetZone.id });
    state.selectedDogKey = dogKey;
    selectItem('zone',targetZone.id);
    renderEditor();
    try { await savePlan(plan, false); toast(`${dog.name} → ${targetZone.label} ✓`); }
    catch (error) { toast(error.message, 'error'); }
  }

  async function unassign(plan, dogKey, kind) {
    plan.assignments = plan.assignments.filter(item => !(item.dogKey === dogKey && item.kind === kind));
    renderEditor();
    try { await savePlan(plan, false); toast('Assignment cleared'); }
    catch (error) { toast(error.message, 'error'); }
  }

  function roomPoints(roomRecord) {
    const numbers = String(roomRecord?.points || '').trim().split(/[ ,]+/).map(Number).filter(Number.isFinite);
    const points = [];
    for (let i=0;i<numbers.length;i+=2) points.push({x:numbers[i],y:numbers[i+1]});
    return points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  }

  function roomBounds(roomRecord) {
    const points = roomPoints(roomRecord);
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
      minX: Math.min(...xs,100), maxX: Math.max(...xs,900),
      minY: Math.min(...ys,100), maxY: Math.max(...ys,540)
    };
  }

  function pointInPolygon(x, y, points) {
    let inside = false;
    for (let i=0,j=points.length-1;i<points.length;j=i++) {
      const a=points[i], b=points[j];
      const intersects=((a.y>y)!==(b.y>y)) && (x < ((b.x-a.x)*(y-a.y))/((b.y-a.y)||0.000001)+a.x);
      if (intersects) inside=!inside;
    }
    return inside;
  }

  function roomAtPoint(plan, x, y) {
    return plan.rooms.find(r => pointInPolygon(x,y,roomPoints(r))) || null;
  }

  function boxFitsRoom(roomRecord, box) {
    if (!roomRecord) return false;
    const points = roomPoints(roomRecord);
    const inset = 3;
    const checks = [
      [box.x+inset,box.y+inset],
      [box.x+box.w-inset,box.y+inset],
      [box.x+inset,box.y+box.h-inset],
      [box.x+box.w-inset,box.y+box.h-inset],
      [box.x+box.w/2,box.y+box.h/2]
    ];
    return checks.every(([x,y]) => pointInPolygon(x,y,points));
  }

  function clientToPlanPoint(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = ((clientX-rect.left)/rect.width)*1000;
    const y = ((clientY-rect.top)/rect.height)*640;
    if (x<0 || x>1000 || y<0 || y>640) return null;
    return {x,y};
  }

  function sizeForTool(type, key) {
    if (type === 'zone') return {w:190,h:105};
    if (type === 'section') return {w:280,h:180};
    if (type === 'artefact') {
      const meta = ARTEFACTS[key] || {};
      return {w:meta.w || 110,h:meta.h || 80};
    }
    return {w:140,h:90};
  }

  function placeBoxInRoom(roomRecord, x, y, width, height) {
    const b = roomBounds(roomRecord);
    const maxW = Math.max(60,b.maxX-b.minX-34);
    const maxH = Math.max(50,b.maxY-b.minY-60);
    const w = Math.min(width,maxW);
    const h = Math.min(height,maxH);
    let box = {
      x: Math.min(b.maxX-w-17,Math.max(b.minX+17,x-w/2)),
      y: Math.min(b.maxY-h-17,Math.max(b.minY+42,y-h/2)),
      w,h
    };
    if (!boxFitsRoom(roomRecord,box)) {
      box = {x:b.minX+20,y:b.minY+50,w:Math.min(w,maxW-5),h:Math.min(h,maxH-5)};
    }
    return box;
  }

  async function addToolAtPoint(plan, type, key, x, y) {
    const targetRoom = roomAtPoint(plan,x,y);
    if (!targetRoom) { toast('Drop the item inside a room.','error'); return; }
    const size = sizeForTool(type,key);
    const box = placeBoxInRoom(targetRoom,x,y,size.w,size.h);
    let item = null;
    if (type === 'zone' && KINDS[key]) {
      item = zone(uid('zone'),key,KINDS[key].label,Math.round(box.x),Math.round(box.y),Math.round(box.w),Math.round(box.h),targetRoom.id);
    } else if (type === 'section' && SECTION_PRESETS[key]) {
      item = section(uid('section'),key,SECTION_PRESETS[key].label,Math.round(box.x),Math.round(box.y),Math.round(box.w),Math.round(box.h),targetRoom.id);
    } else if (type === 'artefact' && ARTEFACTS[key]) {
      item = artefact(uid('artefact'),key,ARTEFACTS[key].label,Math.round(box.x),Math.round(box.y),Math.round(box.w),Math.round(box.h),targetRoom.id);
    }
    if (!item) return;
    itemCollection(plan,type).push(item);
    selectItem(type,item.id);
    renderEditor();
    try {
      await savePlan(plan,false);
      const meta = type === 'zone' ? KINDS[key] : type === 'section' ? SECTION_PRESETS[key] : ARTEFACTS[key];
      toast(`${meta?.icon || '＋'} ${meta?.label || 'Item'} added ✓`);
    } catch (error) { toast(error.message,'error'); }
  }

  async function deleteItem(plan, type, id) {
    if (type === 'zone') {
      plan.zones = plan.zones.filter(item => item.id !== id);
      plan.assignments = plan.assignments.filter(item => item.zoneId !== id);
    } else if (type === 'section') {
      plan.sections = (plan.sections || []).filter(item => item.id !== id);
    } else if (type === 'artefact') {
      plan.artefacts = (plan.artefacts || []).filter(item => item.id !== id);
    }
    clearSelection();
    renderEditor();
    try { await savePlan(plan,false); toast(type === 'zone' ? 'Area removed' : 'Layout item removed'); }
    catch (error) { toast(error.message,'error'); }
  }

  async function renamePlan(plan, value) {
    const next = String(value || '').trim().slice(0,90);
    if (!next || next === plan.title) return;
    plan.title = next;
    try { await savePlan(plan,false); toast('Name updated ✓'); render(); }
    catch (error) { toast(error.message,'error'); }
  }

  async function renameItem(plan, type, id, value) {
    const item = itemCollection(plan,type).find(x => x.id === id);
    const next = String(value || '').trim().slice(0,60);
    if (!item || !next || next === item.label) return;
    item.label = next;
    renderEditor();
    try { await savePlan(plan,false); toast('Label updated ✓'); }
    catch (error) { toast(error.message,'error'); }
  }

  function templateMini(source) {
    return `<svg viewBox="0 0 1000 640" aria-hidden="true">${source.rooms.map(item => `<polygon points="${esc(item.points)}"></polygon>`).join('')}</svg>`;
  }

  function templatePickerHtml() {
    const sizes=['All','Small','Medium','Large','Custom'];
    const filtered=TEMPLATES.filter(item => state.filterSize==='All'||item.size===state.filterSize);
    return `<section class="floorplan-picker">
      <div class="floorplan-section-head"><div><span class="floorplan-kicker">START WITH A SHAPE</span><h2>Choose your living space</h2><p>Pick the closest layout. You can divide open rooms into labelled sections and place furniture after creating it.</p></div></div>
      <div class="floorplan-filter" role="group" aria-label="Floorplan size">${sizes.map(size=>`<button type="button" data-floorplan-size="${size}" class="${state.filterSize===size?'is-active':''}">${size}</button>`).join('')}</div>
      <div class="floorplan-template-grid">${filtered.map(item=>`<button type="button" class="floorplan-template" data-floorplan-template="${item.id}"><span class="floorplan-template-art">${templateMini(item)}</span><span class="floorplan-template-copy"><strong>${esc(item.name)}</strong><small>${esc(item.size)} · ${esc(item.shape)}</small></span></button>`).join('')}</div>
    </section>`;
  }

  function plansRailHtml() {
    if (!state.plans.length) return '';
    return `<div class="floorplan-planrail" aria-label="Saved floorplans">${state.plans.map(plan=>`<button type="button" data-floorplan-plan="${plan.id}" class="${plan.id===state.activePlanId?'is-active':''}"><span>🏠</span><span><strong>${esc(plan.title)}</strong><small>${plan.default?'Default setup':'Saved layout'}</small></span>${plan.default?'<em>★</em>':''}</button>`).join('')}<button type="button" data-floorplan-new class="floorplan-planrail-new"><span>＋</span><span><strong>New floorplan</strong><small>Choose another template</small></span></button></div>`;
  }

  function render() {
    const host=document.querySelector('[data-organiser-view="floorplan"]');
    if (!host) return;
    const plan=activePlan();
    host.innerHTML=`<div class="floorplan-shell">
      <div class="floorplan-head"><div><span class="floorplan-kicker">SPATIAL CARE PLANNING</span><h1>🏠 Floorplan</h1><p>Build the room, divide open-plan spaces, place furniture and POIs, then arrange dog sleeping, eating and safe areas around the home.</p></div><button type="button" data-floorplan-refresh>Refresh</button></div>
      ${plansRailHtml()}
      <div id="floorplanMain">${plan?editorHtml(plan):templatePickerHtml()}</div>
    </div>`;
    bindRoot();
    if (plan) bindEditor(); else bindPicker();
  }

  function editorHtml(plan) {
    const dogs=currentDogs();
    const sleepDone=dogs.filter(d=>assignmentFor(plan,d.key,'sleep')).length;
    const eatDone=dogs.filter(d=>assignmentFor(plan,d.key,'eat')).length;
    return `<section class="floorplan-studio">
      <div class="floorplan-toolbar">
        <div class="floorplan-title-edit"><label>Floorplan name<input data-floorplan-name value="${esc(plan.title)}" maxlength="90"></label>${plan.default?'<span class="floorplan-default">★ Default</span>':''}</div>
        <div class="floorplan-mode" role="group"><button type="button" data-floorplan-mode="tonight" class="${state.viewMode==='tonight'?'is-active':''}">Tonight</button><button type="button" data-floorplan-mode="layout" class="${state.viewMode==='layout'?'is-active':''}">Layout</button></div>
        <div class="floorplan-actions"><button type="button" data-floorplan-default>${plan.default?'Default':'Make default'}</button><button type="button" data-floorplan-duplicate>Duplicate</button><button type="button" data-floorplan-delete class="is-danger">Delete</button></div>
      </div>
      <div class="floorplan-progress"><span class="${dogs.length&&sleepDone===dogs.length?'is-complete':''}">🛏 ${sleepDone}/${dogs.length} sleeping</span><span class="${dogs.length&&eatDone===dogs.length?'is-complete':''}">🍲 ${eatDone}/${dogs.length} eating</span><span>🐶 ${dogs.length} current guests</span><span>▧ ${(plan.sections||[]).length} sections</span><span>🛋️ ${(plan.artefacts||[]).length} POIs</span></div>
      <div class="floorplan-workspace ${state.viewMode==='layout'?'is-layout':'is-tonight'}">
        <aside class="floorplan-sidebar floorplan-dogs"><div class="floorplan-panel-title"><div><strong>Dogs today</strong><small>${dogs.length?'Profile photos come from Care. Tap a dog, then tap a care area.':'No current guests found.'}</small></div></div>${dogs.length?`<div class="floorplan-doglist">${dogs.map(d=>dogCardHtml(plan,d)).join('')}</div>`:'<div class="floorplan-empty-mini">Current guests from Care will appear here automatically.</div>'}</aside>
        <main class="floorplan-canvas-wrap"><div class="floorplan-canvas-toolbar"><span>${state.viewMode==='tonight'?'Tonight’s placements':'Build and arrange your space'}</span><small>${state.viewMode==='layout'?'Drag items in, then move or resize them':state.selectedDogKey?'Area tap will assign selected dog':'Select a dog to assign'}</small></div>${canvasHtml(plan,dogs)}</main>
        <aside class="floorplan-sidebar floorplan-inspector">${state.viewMode==='layout'?layoutInspectorHtml(plan):tonightInspectorHtml(plan,dogs)}</aside>
      </div>
    </section>`;
  }

  function dogAvatarHtml(dog, className) {
    const classes=className||'floorplan-dog-avatar';
    if (dog.photoUrl) return `<span class="${classes} has-photo"><img src="${esc(dog.photoUrl)}" alt="${esc(dog.name)} profile photo" loading="lazy" data-floorplan-profile-photo><span class="floorplan-avatar-fallback">${esc(dog.name.slice(0,1).toUpperCase())}</span></span>`;
    return `<span class="${classes}"><span class="floorplan-avatar-fallback">${esc(dog.name.slice(0,1).toUpperCase())}</span></span>`;
  }

  function dogCardHtml(plan,dog) {
    const sleep=assignmentFor(plan,dog.key,'sleep');
    const eat=assignmentFor(plan,dog.key,'eat');
    return `<button type="button" draggable="true" data-floorplan-dog="${esc(dog.key)}" class="floorplan-dog ${state.selectedDogKey===dog.key?'is-selected':''}">${dogAvatarHtml(dog)}<span class="floorplan-dog-copy"><strong>${esc(dog.name)}</strong><small>${sleep?'🛏 '+esc(zoneById(plan,sleep.zoneId)?.label||'Assigned'):'🛏 unassigned'} · ${eat?'🍲 '+esc(zoneById(plan,eat.zoneId)?.label||'Assigned'):'🍲 unassigned'}</small></span></button>`;
  }

  function canvasHtml(plan,dogs) {
    const hasObjects=plan.zones.length+(plan.sections||[]).length+(plan.artefacts||[]).length;
    return `<div class="floorplan-canvas ${state.viewMode==='layout'?'is-editing':''}" data-floorplan-canvas><svg viewBox="0 0 1000 640" role="img" aria-label="${esc(plan.title)} floorplan">
      <g class="floorplan-rooms">${plan.rooms.map(r=>`<polygon points="${esc(r.points)}" data-room-id="${esc(r.id)}"></polygon><text class="floorplan-room-label" x="${roomBounds(r).minX+22}" y="${roomBounds(r).minY+34}">${esc(r.name)}</text>`).join('')}</g>
      <g class="floorplan-sections">${(plan.sections||[]).map(s=>sectionSvgHtml(s)).join('')}</g>
      <g class="floorplan-artefacts">${(plan.artefacts||[]).map(a=>artefactSvgHtml(a)).join('')}</g>
      <g class="floorplan-zones">${plan.zones.map(z=>zoneSvgHtml(plan,z,dogs)).join('')}</g>
      <g class="floorplan-selection">${state.viewMode==='layout'?selectionHandlesHtml(plan):''}</g>
    </svg>${!hasObjects?'<div class="floorplan-canvas-empty">Switch to <strong>Layout</strong> and drag in a section, furniture item, POI or dog-care area.</div>':''}</div>`;
  }

  function itemClass(type,id) {
    return state.selectedItemType===type&&state.selectedItemId===id?'is-selected':'';
  }

  function sectionSvgHtml(item) {
    const meta=SECTION_PRESETS[item.preset]||{icon:'▧'};
    return `<g class="floorplan-section ${itemClass('section',item.id)}" data-floorplan-item-type="section" data-floorplan-item-id="${esc(item.id)}"><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="18"></rect><text class="floorplan-section-icon" x="${item.x+16}" y="${item.y+29}">${meta.icon}</text><text class="floorplan-section-label" x="${item.x+45}" y="${item.y+29}">${esc(item.label)}</text></g>`;
  }

  function artefactSvgHtml(item) {
    const meta=ARTEFACTS[item.kind]||{icon:'•',label:'POI'};
    return `<g class="floorplan-artefact kind-${esc(item.kind)} ${itemClass('artefact',item.id)}" data-floorplan-item-type="artefact" data-floorplan-item-id="${esc(item.id)}"><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="14"></rect><text class="floorplan-artefact-icon" x="${item.x+item.w/2}" y="${item.y+Math.min(item.h*.48,42)}" text-anchor="middle">${meta.icon}</text><text class="floorplan-artefact-label" x="${item.x+item.w/2}" y="${item.y+item.h-12}" text-anchor="middle">${esc(item.label).slice(0,22)}</text></g>`;
  }

  function zoneSvgHtml(plan,item,dogs) {
    const meta=KINDS[item.kind]||KINDS.play;
    const assigned=dogs.filter(d=>plan.assignments.some(a=>a.dogKey===d.key&&a.zoneId===item.id));
    const names=assigned.slice(0,3).map(d=>d.name).join(' · ')+(assigned.length>3?` +${assigned.length-3}`:'');
    return `<g class="floorplan-zone kind-${esc(item.kind)} ${itemClass('zone',item.id)}" data-floorplan-item-type="zone" data-floorplan-item-id="${esc(item.id)}" data-floorplan-zone="${esc(item.id)}" tabindex="0" role="button" aria-label="${esc(meta.label+' '+item.label)}"><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="22"></rect><text class="floorplan-zone-icon" x="${item.x+18}" y="${item.y+34}">${meta.icon}</text><text class="floorplan-zone-label" x="${item.x+18}" y="${item.y+61}">${esc(item.label)}</text>${names?`<text class="floorplan-zone-dogs" x="${item.x+18}" y="${item.y+85}">${esc(names.slice(0,36))}</text>`:''}</g>`;
  }

  function selectionHandlesHtml(plan) {
    const item=selectedItem(plan);
    if (!item) return '';
    const type=state.selectedItemType,id=esc(item.id);
    const handles=[
      ['nw',item.x,item.y],['ne',item.x+item.w,item.y],
      ['sw',item.x,item.y+item.h],['se',item.x+item.w,item.y+item.h]
    ];
    return `<g class="floorplan-resize-handles" data-floorplan-selected-type="${type}" data-floorplan-selected-id="${id}">${handles.map(([dir,x,y])=>`<circle cx="${x}" cy="${y}" r="11" data-floorplan-resize="${dir}" data-floorplan-item-type="${type}" data-floorplan-item-id="${id}"></circle>`).join('')}</g>`;
  }

  function tonightInspectorHtml(plan,dogs) {
    if (!dogs.length) return '<div class="floorplan-panel-title"><div><strong>Tonight</strong><small>Assignments will appear when guests are current.</small></div></div>';
    const rows=dogs.map(dog=>{
      const entries=['sleep','eat','safe','play'].map(kind=>{
        const a=assignmentFor(plan,dog.key,kind);
        if(!a)return'';
        const z=zoneById(plan,a.zoneId);
        return `<span>${KINDS[kind].icon} ${esc(z?.label||KINDS[kind].label)} <button type="button" data-floorplan-unassign="${esc(dog.key)}|${kind}" aria-label="Clear ${kind} assignment">×</button></span>`;
      }).filter(Boolean).join('');
      return `<div class="floorplan-summary-dog"><div class="floorplan-summary-person">${dogAvatarHtml(dog,'floorplan-summary-avatar')}<strong>${esc(dog.name)}</strong></div>${entries||'<small>No areas assigned yet.</small>'}</div>`;
    }).join('');
    return `<div class="floorplan-panel-title"><div><strong>Tonight</strong><small>One area per care type, per dog.</small></div></div><div class="floorplan-summary-list">${rows}</div>`;
  }

  function toolboxGroup(title,subtitle,html) {
    return `<section class="floorplan-toolgroup"><div class="floorplan-toolgroup-head"><strong>${title}</strong><small>${subtitle}</small></div><div class="floorplan-toolbox">${html}</div></section>`;
  }

  function toolButton(type,key,meta) {
    return `<button type="button" draggable="true" class="floorplan-tool tool-${type} kind-${esc(key)}" data-floorplan-tool="${type}:${esc(key)}" aria-label="Drag ${esc(meta.label)} onto floorplan"><span class="floorplan-tool-icon">${meta.icon}</span><span><strong>${esc(meta.label)}</strong><small>Drag onto plan</small></span><span class="floorplan-tool-grip" aria-hidden="true">⠿</span></button>`;
  }

  function layoutInspectorHtml(plan) {
    const selected=selectedItem(plan);
    const selectedType=state.selectedItemType;
    const selectedMeta=selectedType==='zone'?(KINDS[selected?.kind]||{}):selectedType==='section'?(SECTION_PRESETS[selected?.preset]||{}):(ARTEFACTS[selected?.kind]||{});
    return `<div class="floorplan-panel-title"><div><strong>Layout tools</strong><small>Drag items onto the plan. Once placed, drag them to move and use the corner handles to resize.</small></div></div>
      ${toolboxGroup('Room sections','Break one open room into labelled areas.',Object.entries(SECTION_PRESETS).map(([key,meta])=>toolButton('section',key,meta)).join(''))}
      ${toolboxGroup('Furniture & POIs','Physical reference points in the home.',Object.entries(ARTEFACTS).map(([key,meta])=>toolButton('artefact',key,meta)).join(''))}
      ${toolboxGroup('Dog care areas','Areas that dogs can be assigned to.',Object.entries(KINDS).map(([key,meta])=>toolButton('zone',key,meta)).join(''))}
      ${selected?`<div class="floorplan-item-edit"><div class="floorplan-item-edit-title"><span>${selectedMeta.icon||'▧'}</span><strong>Edit ${selectedType==='zone'?'care area':selectedType==='section'?'section':'POI'}</strong></div><label>Label<input data-floorplan-item-name="${esc(selectedType)}|${esc(selected.id)}" value="${esc(selected.label)}" maxlength="60"></label><small>Drag the item itself to move it. Drag a blue corner handle to resize it.</small><button type="button" data-floorplan-item-delete="${esc(selectedType)}|${esc(selected.id)}" class="is-danger">Remove item</button></div>`:'<div class="floorplan-hint">Start with a section such as Living, Dining or Kitchen, then place furniture and dog-care areas inside it.</div>'}`;
  }

  function bindRoot() {
    document.querySelector('[data-floorplan-refresh]')?.addEventListener('click',()=>loadData(true));
    document.querySelectorAll('[data-floorplan-plan]').forEach(button=>button.addEventListener('click',()=>{
      state.activePlanId=button.dataset.floorplanPlan;
      state.selectedDogKey='';
      clearSelection();
      render();
    }));
    document.querySelector('[data-floorplan-new]')?.addEventListener('click',()=>{state.activePlanId='';clearSelection();render();});
  }

  function bindPicker() {
    document.querySelectorAll('[data-floorplan-size]').forEach(button=>button.addEventListener('click',()=>{state.filterSize=button.dataset.floorplanSize;render();}));
    document.querySelectorAll('[data-floorplan-template]').forEach(button=>button.addEventListener('click',()=>createFromTemplate(button.dataset.floorplanTemplate)));
  }

  function bindProfilePhotoFallbacks() {
    document.querySelectorAll('[data-floorplan-profile-photo]').forEach(image=>{
      image.addEventListener('error',()=>{
        const avatar=image.closest('.has-photo');
        if(avatar)avatar.classList.remove('has-photo');
        image.remove();
      },{once:true});
    });
  }

  function parseToolPayload(raw) {
    const [type,key]=String(raw||'').split(':');
    if (type==='zone'&&KINDS[key]) return {type,key,meta:KINDS[key]};
    if (type==='section'&&SECTION_PRESETS[key]) return {type,key,meta:SECTION_PRESETS[key]};
    if (type==='artefact'&&ARTEFACTS[key]) return {type,key,meta:ARTEFACTS[key]};
    return null;
  }

  function createDragGhost(tool) {
    const payload=parseToolPayload(tool.dataset.floorplanTool);
    const ghost=document.createElement('div');
    ghost.className='floorplan-drag-ghost';
    ghost.innerHTML=`<span>${payload?.meta?.icon||'＋'}</span><strong>${esc(payload?.meta?.label||'Item')}</strong>`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function bindTouchToolDrag(plan,tool) {
    tool.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse')return;
      const payload=parseToolPayload(tool.dataset.floorplanTool);
      if(!payload)return;
      event.preventDefault();
      const ghost=createDragGhost(tool);
      const moveGhost=(x,y)=>{
        ghost.style.left=`${x+12}px`;ghost.style.top=`${y+12}px`;
        const canvas=document.querySelector('[data-floorplan-canvas]');
        canvas?.classList.toggle('is-tool-drop',!!clientToPlanPoint(canvas,x,y));
      };
      moveGhost(event.clientX,event.clientY);
      try{tool.setPointerCapture(event.pointerId);}catch(_){}
      const move=e=>{e.preventDefault();moveGhost(e.clientX,e.clientY);};
      const cleanup=()=>{tool.removeEventListener('pointermove',move);tool.removeEventListener('pointerup',finish);tool.removeEventListener('pointercancel',cancel);document.querySelector('[data-floorplan-canvas]')?.classList.remove('is-tool-drop');ghost.remove();};
      const finish=e=>{cleanup();const canvas=document.querySelector('[data-floorplan-canvas]');const point=canvas?clientToPlanPoint(canvas,e.clientX,e.clientY):null;if(point)addToolAtPoint(plan,payload.type,payload.key,point.x,point.y);};
      const cancel=()=>cleanup();
      tool.addEventListener('pointermove',move);tool.addEventListener('pointerup',finish);tool.addEventListener('pointercancel',cancel);
    });
  }

  function bindLayoutToolDrag(plan) {
    const canvas=document.querySelector('[data-floorplan-canvas]');
    if(!canvas)return;
    document.querySelectorAll('[data-floorplan-tool]').forEach(tool=>{
      tool.addEventListener('dragstart',event=>{
        try{event.dataTransfer.setData('text/waffle-floorplan-tool',tool.dataset.floorplanTool);event.dataTransfer.effectAllowed='copy';}catch(_){}
      });
      tool.addEventListener('keydown',event=>{
        if(event.key!=='Enter'&&event.key!==' ')return;
        event.preventDefault();
        const payload=parseToolPayload(tool.dataset.floorplanTool);
        const firstRoom=plan.rooms[0];
        if(!payload||!firstRoom)return;
        const b=roomBounds(firstRoom);
        addToolAtPoint(plan,payload.type,payload.key,(b.minX+b.maxX)/2,(b.minY+b.maxY)/2);
      });
      bindTouchToolDrag(plan,tool);
    });
    canvas.addEventListener('dragover',event=>{
      if(!event.dataTransfer?.types?.includes('text/waffle-floorplan-tool'))return;
      event.preventDefault();canvas.classList.add('is-tool-drop');if(event.dataTransfer)event.dataTransfer.dropEffect='copy';
    });
    canvas.addEventListener('dragleave',event=>{if(!canvas.contains(event.relatedTarget))canvas.classList.remove('is-tool-drop');});
    canvas.addEventListener('drop',event=>{
      const payload=parseToolPayload(event.dataTransfer?.getData('text/waffle-floorplan-tool'));
      if(!payload)return;
      event.preventDefault();canvas.classList.remove('is-tool-drop');
      const point=clientToPlanPoint(canvas,event.clientX,event.clientY);
      if(point)addToolAtPoint(plan,payload.type,payload.key,point.x,point.y);
    });
  }

  function updateItemDom(group,item) {
    if(!group)return;
    const type=group.dataset.floorplanItemType;
    const rect=group.querySelector('rect');
    if(rect){rect.setAttribute('x',item.x);rect.setAttribute('y',item.y);rect.setAttribute('width',item.w);rect.setAttribute('height',item.h);}
    const texts=group.querySelectorAll('text');
    if(type==='zone'){
      if(texts[0]){texts[0].setAttribute('x',item.x+18);texts[0].setAttribute('y',item.y+34);}
      if(texts[1]){texts[1].setAttribute('x',item.x+18);texts[1].setAttribute('y',item.y+61);}
      if(texts[2]){texts[2].setAttribute('x',item.x+18);texts[2].setAttribute('y',item.y+85);}
    } else if(type==='section'){
      if(texts[0]){texts[0].setAttribute('x',item.x+16);texts[0].setAttribute('y',item.y+29);}
      if(texts[1]){texts[1].setAttribute('x',item.x+45);texts[1].setAttribute('y',item.y+29);}
    } else if(type==='artefact'){
      const cx=item.x+item.w/2;
      if(texts[0]){texts[0].setAttribute('x',cx);texts[0].setAttribute('y',item.y+Math.min(item.h*.48,42));}
      if(texts[1]){texts[1].setAttribute('x',cx);texts[1].setAttribute('y',item.y+item.h-12);}
    }
    updateHandleDom(item);
  }

  function updateHandleDom(item) {
    const group=document.querySelector('.floorplan-resize-handles');
    if(!group)return;
    const coords={nw:[item.x,item.y],ne:[item.x+item.w,item.y],sw:[item.x,item.y+item.h],se:[item.x+item.w,item.y+item.h]};
    group.querySelectorAll('[data-floorplan-resize]').forEach(circle=>{
      const c=coords[circle.dataset.floorplanResize];if(!c)return;circle.setAttribute('cx',c[0]);circle.setAttribute('cy',c[1]);
    });
  }

  function minSizeFor(type) {
    if(type==='zone')return{w:120,h:72};
    if(type==='section')return{w:120,h:85};
    return{w:58,h:48};
  }

  function resizedBox(start,dir,dx,dy,min) {
    let {x,y,w,h}=start;
    if(dir.includes('e'))w=Math.max(min.w,start.w+dx);
    if(dir.includes('s'))h=Math.max(min.h,start.h+dy);
    if(dir.includes('w')){const nextW=Math.max(min.w,start.w-dx);x=start.x+(start.w-nextW);w=nextW;}
    if(dir.includes('n')){const nextH=Math.max(min.h,start.h-dy);y=start.y+(start.h-nextH);h=nextH;}
    return{x,y,w,h};
  }

  function bindItemMoveResize(plan) {
    const canvas=document.querySelector('[data-floorplan-canvas]');
    if(!canvas)return;

    document.querySelectorAll('[data-floorplan-item-type][data-floorplan-item-id]').forEach(group=>{
      group.addEventListener('pointerdown',event=>{
        if(state.viewMode!=='layout'||event.button>0)return;
        if(event.target.closest?.('[data-floorplan-resize]'))return;
        const type=group.dataset.floorplanItemType,id=group.dataset.floorplanItemId;
        const item=itemCollection(plan,type).find(x=>x.id===id);
        if(!item)return;
        event.preventDefault();event.stopPropagation();
        selectItem(type,id);
        const startPoint=clientToPlanPoint(canvas,event.clientX,event.clientY);
        if(!startPoint)return;
        const start=clone(item);
        try{group.setPointerCapture(event.pointerId);}catch(_){}
        group.classList.add('is-moving');
        const move=e=>{
          e.preventDefault();
          const p=clientToPlanPoint(canvas,e.clientX,e.clientY);if(!p)return;
          const candidate={...item,x:start.x+(p.x-startPoint.x),y:start.y+(p.y-startPoint.y)};
          const targetRoom=roomAtPoint(plan,candidate.x+candidate.w/2,candidate.y+candidate.h/2);
          if(targetRoom&&boxFitsRoom(targetRoom,candidate)){
            item.x=Math.round(candidate.x);item.y=Math.round(candidate.y);item.roomId=targetRoom.id;updateItemDom(group,item);
          }
        };
        const finish=async()=>{
          group.removeEventListener('pointermove',move);group.removeEventListener('pointerup',finish);group.removeEventListener('pointercancel',cancel);group.classList.remove('is-moving');
          renderEditor();
          try{await savePlan(plan,false);}catch(error){toast(error.message,'error');}
        };
        const cancel=()=>{Object.assign(item,start);group.removeEventListener('pointermove',move);group.removeEventListener('pointerup',finish);group.removeEventListener('pointercancel',cancel);renderEditor();};
        group.addEventListener('pointermove',move);group.addEventListener('pointerup',finish);group.addEventListener('pointercancel',cancel);
      });
      group.addEventListener('click',event=>{
        if(state.viewMode!=='layout')return;
        event.stopPropagation();
        selectItem(group.dataset.floorplanItemType,group.dataset.floorplanItemId);
        renderEditor();
      });
    });

    document.querySelectorAll('[data-floorplan-resize]').forEach(handle=>{
      handle.addEventListener('pointerdown',event=>{
        if(state.viewMode!=='layout'||event.button>0)return;
        event.preventDefault();event.stopPropagation();
        const type=handle.dataset.floorplanItemType,id=handle.dataset.floorplanItemId,dir=handle.dataset.floorplanResize;
        const item=itemCollection(plan,type).find(x=>x.id===id);
        if(!item)return;
        selectItem(type,id);
        const startPoint=clientToPlanPoint(canvas,event.clientX,event.clientY);if(!startPoint)return;
        const start=clone(item),roomRecord=plan.rooms.find(r=>r.id===item.roomId);
        const min=minSizeFor(type);
        try{handle.setPointerCapture(event.pointerId);}catch(_){}
        const move=e=>{
          e.preventDefault();
          const p=clientToPlanPoint(canvas,e.clientX,e.clientY);if(!p)return;
          const candidate=resizedBox(start,dir,p.x-startPoint.x,p.y-startPoint.y,min);
          if(roomRecord&&boxFitsRoom(roomRecord,candidate)){
            Object.assign(item,{x:Math.round(candidate.x),y:Math.round(candidate.y),w:Math.round(candidate.w),h:Math.round(candidate.h)});
            const group=document.querySelector(`[data-floorplan-item-type="${type}"][data-floorplan-item-id="${CSS.escape(id)}"]`);
            updateItemDom(group,item);
          }
        };
        const finish=async()=>{
          handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);
          renderEditor();
          try{await savePlan(plan,false);}catch(error){toast(error.message,'error');}
        };
        const cancel=()=>{Object.assign(item,start);handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);renderEditor();};
        handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);
      });
    });

    canvas.addEventListener('pointerdown',event=>{
      if(state.viewMode!=='layout')return;
      if(event.target===canvas||event.target.tagName==='svg'||event.target.closest?.('.floorplan-rooms')){
        if(state.selectedItemId){clearSelection();renderEditor();}
      }
    });
  }

  function bindEditor() {
    const plan=activePlan();if(!plan)return;
    bindProfilePhotoFallbacks();

    document.querySelector('[data-floorplan-name]')?.addEventListener('change',e=>renamePlan(plan,e.target.value));
    document.querySelectorAll('[data-floorplan-mode]').forEach(button=>button.addEventListener('click',()=>{
      state.viewMode=button.dataset.floorplanMode;clearSelection();renderEditor();
    }));
    document.querySelector('[data-floorplan-default]')?.addEventListener('click',()=>setDefault(plan.id));
    document.querySelector('[data-floorplan-duplicate]')?.addEventListener('click',()=>duplicatePlan(plan.id));
    document.querySelector('[data-floorplan-delete]')?.addEventListener('click',()=>deletePlan(plan.id));

    document.querySelectorAll('[data-floorplan-dog]').forEach(button=>{
      button.addEventListener('click',()=>{state.selectedDogKey=state.selectedDogKey===button.dataset.floorplanDog?'':button.dataset.floorplanDog;renderEditor();});
      button.addEventListener('dragstart',event=>{state.selectedDogKey=button.dataset.floorplanDog;try{event.dataTransfer.setData('text/waffle-dog',button.dataset.floorplanDog);event.dataTransfer.effectAllowed='copy';}catch(_){}});
    });

    document.querySelectorAll('[data-floorplan-zone]').forEach(group=>{
      if(state.viewMode==='tonight'){
        const activate=()=>{const id=group.dataset.floorplanZone;selectItem('zone',id);if(state.selectedDogKey)assignDog(plan,state.selectedDogKey,id);else renderEditor();};
        group.addEventListener('click',activate);
        group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}});
        group.addEventListener('dragover',event=>{if(!event.dataTransfer?.types?.includes('text/waffle-dog'))return;event.preventDefault();group.classList.add('is-drop-target');});
        group.addEventListener('dragleave',()=>group.classList.remove('is-drop-target'));
        group.addEventListener('drop',event=>{const dogKey=event.dataTransfer?.getData('text/waffle-dog')||state.selectedDogKey;if(!dogKey)return;event.preventDefault();event.stopPropagation();group.classList.remove('is-drop-target');assignDog(plan,dogKey,group.dataset.floorplanZone);});
      }
    });

    document.querySelector('[data-floorplan-item-name]')?.addEventListener('change',event=>{const [type,id]=event.target.dataset.floorplanItemName.split('|');renameItem(plan,type,id,event.target.value);});
    document.querySelector('[data-floorplan-item-delete]')?.addEventListener('click',event=>{const [type,id]=event.target.dataset.floorplanItemDelete.split('|');deleteItem(plan,type,id);});
    document.querySelectorAll('[data-floorplan-unassign]').forEach(button=>button.addEventListener('click',()=>{const [dogKey,kind]=button.dataset.floorplanUnassign.split('|');unassign(plan,dogKey,kind);}));

    if(state.viewMode==='layout'){
      bindLayoutToolDrag(plan);
      bindItemMoveResize(plan);
    }
  }

  function renderEditor() {
    const main=document.getElementById('floorplanMain'),plan=activePlan();
    if(!main||!plan)return;
    main.innerHTML=editorHtml(plan);
    bindEditor();
  }

  function activateFloorplanTab() {
    document.querySelectorAll('[data-organiser-tab]').forEach(button=>{const active=button.dataset.organiserTab==='floorplan';button.classList.toggle('is-active',active);button.setAttribute('aria-selected',active?'true':'false');});
    document.querySelectorAll('[data-organiser-view]').forEach(view=>{view.hidden=view.dataset.organiserView!=='floorplan';});
    loadData(true);
  }

  function install() {
    if(state.installing)return;
    state.installing=true;
    try{
      const root=document.getElementById('v11115OrganiserRoot');if(!root)return false;
      const tabs=root.querySelector('.v11115-organiser-tabs'),body=root.querySelector('.v11115-organiser-body');if(!tabs||!body)return false;
      if(!tabs.querySelector('[data-organiser-tab="floorplan"]')){
        const button=document.createElement('button');button.type='button';button.dataset.organiserTab='floorplan';button.textContent='🏠 Floorplan';button.addEventListener('click',activateFloorplanTab);
        const sleep=tabs.querySelector('[data-organiser-tab="sleep"]');tabs.insertBefore(button,sleep||tabs.lastElementChild);
      }
      if(!body.querySelector('[data-organiser-view="floorplan"]')){const view=document.createElement('div');view.dataset.organiserView='floorplan';view.hidden=true;body.appendChild(view);}
      return true;
    }finally{state.installing=false;}
  }

  function start() {
    if(String(window.WAFFLE_PAGE||document.body?.dataset?.wafflePage||'')!=='reminders')return;
    loadCss();
    if(install())return;
    const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  window.WAFFLE_ORGANISER_FLOORPLAN=Object.freeze({
    version:VERSION,
    templates:TEMPLATES.map(item=>({id:item.id,name:item.name,size:item.size,shape:item.shape})),
    refresh:()=>loadData(true)
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();