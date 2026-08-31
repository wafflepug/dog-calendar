/* ============================================================
   WAFFLE HOUSE — ORGANISER FLOORPLAN STUDIO
   ------------------------------------------------------------
   Template-first spatial planning for sleeping, feeding, play and safe zones.
   Works as an additive Organiser module on desktop and mobile.
   ============================================================ */
(function () {
  'use strict';
  if (window.WAFFLE_ORGANISER_FLOORPLAN) return;

  const VERSION = '1.1.0';
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
    items: [],
    plans: [],
    bookings: [],
    dogPhotos: Object.create(null),
    activePlanId: '',
    selectedDogKey: '',
    selectedZoneId: '',
    viewMode: 'tonight',
    filterSize: 'All',
    loading: false,
    installing: false
  };

  function template(id, name, size, shape, rooms, zones) { return { id, name, size, shape, rooms, zones }; }
  function room(id, name, points) { return { id, name, points }; }
  function zone(id, kind, label, x, y, w, h, roomId) { return { id, kind, label, x, y, w, h, roomId }; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }
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
    if (typeof window.queryAppsScript !== 'function') {
      return Promise.reject(new Error('Waffle House data service is not ready yet.'));
    }
    return window.queryAppsScript(payload);
  }

  function toast(message, mode) {
    if (typeof window.showWaffleToast === 'function') {
      try {
        window.showWaffleToast(message, mode || 'success');
        return;
      } catch (_) {}
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
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(+match[1], +match[2]-1, +match[3]);
    match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return new Date(+match[3], +match[2]-1, +match[1]);
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function sod(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

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
    return uniqueBookings()
      .filter(booking => {
        const start = parseDate(booking.startDate);
        const end = parseDate(booking.endDate);
        return start && end && sod(start) <= today && sod(end) >= today;
      })
      .map(booking => {
        const key = String(booking.stayKey || `${booking.dogName}|${booking.startDate}|${booking.endDate}`);
        return {
          key,
          name: String(booking.dogName || 'Guest'),
          startDate: booking.startDate,
          endDate: booking.endDate,
          photoUrl: String(state.dogPhotos[key] || '')
        };
      })
      .sort((a,b) => a.name.localeCompare(b.name));
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

  function normalisePlan(item) {
    const value = item && item.value && typeof item.value === 'object' ? item.value : {};
    return {
      id: String(item.id || ''),
      title: String(item.title || value.name || 'Floorplan'),
      default: value.default === true,
      templateId: String(value.templateId || 'custom-blank'),
      rooms: Array.isArray(value.rooms) ? value.rooms : [],
      zones: Array.isArray(value.zones) ? value.zones : [],
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
        const preferred = state.plans.find(plan => plan.default) || state.plans[0];
        state.activePlanId = preferred?.id || '';
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

  function activePlan() {
    return state.plans.find(plan => plan.id === state.activePlanId) || null;
  }

  async function savePlan(plan, message) {
    const payload = {
      version: VERSION,
      name: plan.title,
      templateId: plan.templateId,
      default: plan.default === true,
      rooms: plan.rooms,
      zones: plan.zones,
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
    if (!response || response.result !== 'success' || !response.item) {
      throw new Error(response?.message || 'Floorplan could not be saved.');
    }
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
      assignments: [],
      createdAt: new Date().toISOString()
    };
    try {
      await savePlan(plan, 'Floorplan created ✓');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function deletePlan(id) {
    const plan = state.plans.find(item => item.id === id);
    if (!plan) return;
    if (!window.confirm(`Delete “${plan.title}”?`)) return;
    try {
      const response = await query({ action:'delete_organiser_item', id });
      if (!response || response.result !== 'success') {
        throw new Error(response?.message || 'Floorplan could not be deleted.');
      }
      state.plans = state.plans.filter(item => item.id !== id);
      state.activePlanId = (state.plans.find(item => item.default) || state.plans[0])?.id || '';
      toast('Floorplan removed');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function setDefault(id) {
    try {
      for (const plan of state.plans) {
        const shouldBeDefault = plan.id === id;
        if (plan.default !== shouldBeDefault) {
          plan.default = shouldBeDefault;
          await savePlan(plan, false);
        }
      }
      toast('Default floorplan updated ✓');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
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
    try {
      await savePlan(copy, 'Floorplan duplicated ✓');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function assignmentFor(plan, dogKey, kind) {
    return plan.assignments.find(item => item.dogKey === dogKey && item.kind === kind) || null;
  }

  function zoneById(plan, id) {
    return plan.zones.find(item => item.id === id) || null;
  }

  async function assignDog(plan, dogKey, zoneId) {
    const dog = currentDogs().find(item => item.key === dogKey);
    const targetZone = zoneById(plan, zoneId);
    if (!dog || !targetZone) return;

    plan.assignments = plan.assignments.filter(item => !(item.dogKey === dogKey && item.kind === targetZone.kind));
    plan.assignments.push({
      dogKey,
      dogName: dog.name,
      kind: targetZone.kind,
      zoneId: targetZone.id
    });
    state.selectedDogKey = dogKey;
    state.selectedZoneId = targetZone.id;
    renderEditor();

    try {
      await savePlan(plan, false);
      toast(`${dog.name} → ${targetZone.label} ✓`);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function unassign(plan, dogKey, kind) {
    plan.assignments = plan.assignments.filter(item => !(item.dogKey === dogKey && item.kind === kind));
    renderEditor();
    try {
      await savePlan(plan, false);
      toast('Assignment cleared');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function roomPoints(roomRecord) {
    const numbers = String(roomRecord?.points || '')
      .trim()
      .split(/[ ,]+/)
      .map(Number)
      .filter(Number.isFinite);
    const points = [];
    for (let index = 0; index < numbers.length; index += 2) {
      points.push({ x:numbers[index], y:numbers[index + 1] });
    }
    return points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
  }

  function roomBounds(roomRecord) {
    const points = roomPoints(roomRecord);
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    return {
      minX: Math.min(...xs, 100),
      maxX: Math.max(...xs, 900),
      minY: Math.min(...ys, 100),
      maxY: Math.max(...ys, 540)
    };
  }

  function pointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;
      const intersects = ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 0.000001) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function roomAtPoint(plan, x, y) {
    return plan.rooms.find(roomRecord => pointInPolygon(x, y, roomPoints(roomRecord))) || null;
  }

  function clientToPlanPoint(canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = ((clientX - rect.left) / rect.width) * 1000;
    const y = ((clientY - rect.top) / rect.height) * 640;
    if (x < 0 || x > 1000 || y < 0 || y > 640) return null;
    return { x, y };
  }

  async function addZoneAtPoint(plan, kind, x, y) {
    if (!KINDS[kind]) return;
    const targetRoom = roomAtPoint(plan, x, y);
    if (!targetRoom) {
      toast('Drop the area inside a room.', 'error');
      return;
    }

    const bounds = roomBounds(targetRoom);
    const width = Math.min(220, Math.max(150, (bounds.maxX - bounds.minX) * 0.32));
    const height = 105;
    const clampedX = Math.min(bounds.maxX - width - 18, Math.max(bounds.minX + 18, x - width / 2));
    const clampedY = Math.min(bounds.maxY - height - 18, Math.max(bounds.minY + 45, y - height / 2));
    const label = KINDS[kind].label;

    const newZone = zone(
      uid('zone'),
      kind,
      label,
      Math.round(clampedX),
      Math.round(clampedY),
      Math.round(width),
      height,
      targetRoom.id
    );

    plan.zones.push(newZone);
    state.selectedZoneId = newZone.id;
    renderEditor();

    try {
      await savePlan(plan, false);
      toast(`${KINDS[kind].icon} ${label} area added ✓`);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function deleteZone(plan, id) {
    plan.zones = plan.zones.filter(item => item.id !== id);
    plan.assignments = plan.assignments.filter(item => item.zoneId !== id);
    state.selectedZoneId = '';
    renderEditor();
    try {
      await savePlan(plan, false);
      toast('Area removed');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function renamePlan(plan, value) {
    const next = String(value || '').trim().slice(0, 90);
    if (!next || next === plan.title) return;
    plan.title = next;
    try {
      await savePlan(plan, false);
      toast('Name updated ✓');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function renameZone(plan, id, value) {
    const targetZone = zoneById(plan, id);
    const next = String(value || '').trim().slice(0, 60);
    if (!targetZone || !next || next === targetZone.label) return;
    targetZone.label = next;
    renderEditor();
    try {
      await savePlan(plan, false);
      toast('Area renamed ✓');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function templateMini(source) {
    return `<svg viewBox="0 0 1000 640" aria-hidden="true">${source.rooms.map(item => `<polygon points="${esc(item.points)}"></polygon>`).join('')}</svg>`;
  }

  function templatePickerHtml() {
    const sizes = ['All','Small','Medium','Large','Custom'];
    const filtered = TEMPLATES.filter(item => state.filterSize === 'All' || item.size === state.filterSize);
    return `<section class="floorplan-picker">
      <div class="floorplan-section-head"><div><span class="floorplan-kicker">START WITH A SHAPE</span><h2>Choose your living space</h2><p>Pick the closest layout. You can add care zones after creating it.</p></div></div>
      <div class="floorplan-filter" role="group" aria-label="Floorplan size">${sizes.map(size => `<button type="button" data-floorplan-size="${size}" class="${state.filterSize===size?'is-active':''}">${size}</button>`).join('')}</div>
      <div class="floorplan-template-grid">${filtered.map(item => `<button type="button" class="floorplan-template" data-floorplan-template="${item.id}"><span class="floorplan-template-art">${templateMini(item)}</span><span class="floorplan-template-copy"><strong>${esc(item.name)}</strong><small>${esc(item.size)} · ${esc(item.shape)}</small></span></button>`).join('')}</div>
    </section>`;
  }

  function plansRailHtml() {
    if (!state.plans.length) return '';
    return `<div class="floorplan-planrail" aria-label="Saved floorplans">${state.plans.map(plan => `<button type="button" data-floorplan-plan="${plan.id}" class="${plan.id===state.activePlanId?'is-active':''}"><span>🏠</span><span><strong>${esc(plan.title)}</strong><small>${plan.default?'Default setup':'Saved layout'}</small></span>${plan.default?'<em>★</em>':''}</button>`).join('')}<button type="button" data-floorplan-new class="floorplan-planrail-new"><span>＋</span><span><strong>New floorplan</strong><small>Choose another template</small></span></button></div>`;
  }

  function render() {
    const host = document.querySelector('[data-organiser-view="floorplan"]');
    if (!host) return;
    const plan = activePlan();
    host.innerHTML = `<div class="floorplan-shell">
      <div class="floorplan-head"><div><span class="floorplan-kicker">SPATIAL CARE PLANNING</span><h1>🏠 Floorplan</h1><p>Choose a home layout, drag care areas into place, then assign each current guest where they sleep, eat and settle.</p></div><button type="button" data-floorplan-refresh>Refresh</button></div>
      ${plansRailHtml()}
      <div id="floorplanMain">${plan ? editorHtml(plan) : templatePickerHtml()}</div>
    </div>`;
    bindRoot();
    if (plan) bindEditor();
    else bindPicker();
  }

  function editorHtml(plan) {
    const dogs = currentDogs();
    const sleepDone = dogs.filter(dog => assignmentFor(plan, dog.key, 'sleep')).length;
    const eatDone = dogs.filter(dog => assignmentFor(plan, dog.key, 'eat')).length;

    return `<section class="floorplan-studio">
      <div class="floorplan-toolbar">
        <div class="floorplan-title-edit"><label>Floorplan name<input data-floorplan-name value="${esc(plan.title)}" maxlength="90"></label>${plan.default?'<span class="floorplan-default">★ Default</span>':''}</div>
        <div class="floorplan-mode" role="group"><button type="button" data-floorplan-mode="tonight" class="${state.viewMode==='tonight'?'is-active':''}">Tonight</button><button type="button" data-floorplan-mode="layout" class="${state.viewMode==='layout'?'is-active':''}">Layout</button></div>
        <div class="floorplan-actions"><button type="button" data-floorplan-default>${plan.default?'Default':'Make default'}</button><button type="button" data-floorplan-duplicate>Duplicate</button><button type="button" data-floorplan-delete class="is-danger">Delete</button></div>
      </div>
      <div class="floorplan-progress"><span class="${dogs.length&&sleepDone===dogs.length?'is-complete':''}">🛏 ${sleepDone}/${dogs.length} sleeping</span><span class="${dogs.length&&eatDone===dogs.length?'is-complete':''}">🍲 ${eatDone}/${dogs.length} eating</span><span>🐶 ${dogs.length} current guests</span></div>
      <div class="floorplan-workspace ${state.viewMode==='layout'?'is-layout':'is-tonight'}">
        <aside class="floorplan-sidebar floorplan-dogs"><div class="floorplan-panel-title"><div><strong>Dogs today</strong><small>${dogs.length ? 'Profile photos come directly from Care. Tap a dog, then tap an area; drag also works on desktop.' : 'No current guests found.'}</small></div></div>${dogs.length ? `<div class="floorplan-doglist">${dogs.map(dog => dogCardHtml(plan,dog)).join('')}</div>` : '<div class="floorplan-empty-mini">Current guests from Care will appear here automatically.</div>'}</aside>
        <main class="floorplan-canvas-wrap"><div class="floorplan-canvas-toolbar"><span>${state.viewMode==='tonight'?'Tonight’s placements':'Drag an area onto the plan'}</span><small>${state.viewMode==='layout'?'Drop it exactly where you want it':state.selectedDogKey?'Area tap will assign selected dog':'Select a dog to assign'}</small></div>${canvasHtml(plan,dogs)}</main>
        <aside class="floorplan-sidebar floorplan-inspector">${state.viewMode==='layout' ? layoutInspectorHtml(plan) : tonightInspectorHtml(plan,dogs)}</aside>
      </div>
    </section>`;
  }

  function dogAvatarHtml(dog, className) {
    const classes = className || 'floorplan-dog-avatar';
    if (dog.photoUrl) {
      return `<span class="${classes} has-photo"><img src="${esc(dog.photoUrl)}" alt="${esc(dog.name)} profile photo" loading="lazy" data-floorplan-profile-photo><span class="floorplan-avatar-fallback">${esc(dog.name.slice(0,1).toUpperCase())}</span></span>`;
    }
    return `<span class="${classes}"><span class="floorplan-avatar-fallback">${esc(dog.name.slice(0,1).toUpperCase())}</span></span>`;
  }

  function dogCardHtml(plan, dog) {
    const sleep = assignmentFor(plan, dog.key, 'sleep');
    const eat = assignmentFor(plan, dog.key, 'eat');
    return `<button type="button" draggable="true" data-floorplan-dog="${esc(dog.key)}" class="floorplan-dog ${state.selectedDogKey===dog.key?'is-selected':''}">${dogAvatarHtml(dog)}<span class="floorplan-dog-copy"><strong>${esc(dog.name)}</strong><small>${sleep?'🛏 '+esc(zoneById(plan,sleep.zoneId)?.label||'Assigned'):'🛏 unassigned'} · ${eat?'🍲 '+esc(zoneById(plan,eat.zoneId)?.label||'Assigned'):'🍲 unassigned'}</small></span></button>`;
  }

  function canvasHtml(plan, dogs) {
    return `<div class="floorplan-canvas" data-floorplan-canvas><svg viewBox="0 0 1000 640" role="img" aria-label="${esc(plan.title)} floorplan">
      <g class="floorplan-rooms">${plan.rooms.map(item => `<polygon points="${esc(item.points)}" data-room-id="${esc(item.id)}"></polygon><text class="floorplan-room-label" x="${roomBounds(item).minX+22}" y="${roomBounds(item).minY+34}">${esc(item.name)}</text>`).join('')}</g>
      <g class="floorplan-zones">${plan.zones.map(item => zoneSvgHtml(plan,item,dogs)).join('')}</g>
    </svg>${!plan.zones.length?'<div class="floorplan-canvas-empty">No care areas yet. Switch to <strong>Layout</strong>, then drag a care area onto the room.</div>':''}</div>`;
  }

  function zoneSvgHtml(plan, targetZone, dogs) {
    const meta = KINDS[targetZone.kind] || KINDS.play;
    const assigned = dogs.filter(dog => plan.assignments.some(item => item.dogKey === dog.key && item.zoneId === targetZone.id));
    const chosen = state.selectedZoneId === targetZone.id;
    const names = assigned.slice(0,3).map(dog => dog.name).join(' · ') + (assigned.length > 3 ? ` +${assigned.length-3}` : '');
    return `<g class="floorplan-zone kind-${esc(targetZone.kind)} ${chosen?'is-selected':''}" data-floorplan-zone="${esc(targetZone.id)}" tabindex="0" role="button" aria-label="${esc(meta.label+' '+targetZone.label)}"><rect x="${targetZone.x}" y="${targetZone.y}" width="${targetZone.w}" height="${targetZone.h}" rx="22"></rect><text class="floorplan-zone-icon" x="${targetZone.x+18}" y="${targetZone.y+34}">${meta.icon}</text><text class="floorplan-zone-label" x="${targetZone.x+18}" y="${targetZone.y+61}">${esc(targetZone.label)}</text>${names?`<text class="floorplan-zone-dogs" x="${targetZone.x+18}" y="${targetZone.y+85}">${esc(names.slice(0,36))}</text>`:''}</g>`;
  }

  function tonightInspectorHtml(plan, dogs) {
    if (!dogs.length) {
      return '<div class="floorplan-panel-title"><div><strong>Tonight</strong><small>Assignments will appear when guests are current.</small></div></div>';
    }

    const rows = dogs.map(dog => {
      const entries = ['sleep','eat','safe','play'].map(kind => {
        const assignment = assignmentFor(plan,dog.key,kind);
        if (!assignment) return '';
        const targetZone = zoneById(plan,assignment.zoneId);
        return `<span>${KINDS[kind].icon} ${esc(targetZone?.label||KINDS[kind].label)} <button type="button" data-floorplan-unassign="${esc(dog.key)}|${kind}" aria-label="Clear ${kind} assignment">×</button></span>`;
      }).filter(Boolean).join('');
      return `<div class="floorplan-summary-dog"><div class="floorplan-summary-person">${dogAvatarHtml(dog,'floorplan-summary-avatar')}<strong>${esc(dog.name)}</strong></div>${entries||'<small>No areas assigned yet.</small>'}</div>`;
    }).join('');

    return `<div class="floorplan-panel-title"><div><strong>Tonight</strong><small>One area per care type, per dog.</small></div></div><div class="floorplan-summary-list">${rows}</div>`;
  }

  function layoutInspectorHtml(plan) {
    const selected = zoneById(plan,state.selectedZoneId);
    return `<div class="floorplan-panel-title"><div><strong>Layout tools</strong><small>Drag a care area onto the exact place you want it. Works with mouse, touch and pen.</small></div></div>
      <div class="floorplan-toolbox" role="list" aria-label="Draggable care areas">${Object.entries(KINDS).map(([kind,meta]) => `<button type="button" draggable="true" class="floorplan-tool kind-${kind}" data-floorplan-tool="${kind}" role="listitem" aria-label="Drag ${esc(meta.label)} area onto floorplan"><span class="floorplan-tool-icon">${meta.icon}</span><span><strong>${esc(meta.label)}</strong><small>Drag onto plan</small></span><span class="floorplan-tool-grip" aria-hidden="true">⠿</span></button>`).join('')}</div>
      ${selected ? `<div class="floorplan-zone-edit"><strong>Edit selected area</strong><label>Name<input data-floorplan-zone-name="${esc(selected.id)}" value="${esc(selected.label)}" maxlength="60"></label><button type="button" data-floorplan-zone-delete="${esc(selected.id)}" class="is-danger">Remove area</button></div>` : '<div class="floorplan-hint">Drag one of the four area types onto a room. After dropping it, tap the area to rename or remove it.</div>'}`;
  }

  function bindRoot() {
    document.querySelector('[data-floorplan-refresh]')?.addEventListener('click', () => loadData(true));
    document.querySelectorAll('[data-floorplan-plan]').forEach(button => button.addEventListener('click', () => {
      state.activePlanId = button.dataset.floorplanPlan;
      state.selectedDogKey = '';
      state.selectedZoneId = '';
      render();
    }));
    document.querySelector('[data-floorplan-new]')?.addEventListener('click', () => {
      state.activePlanId = '';
      render();
    });
  }

  function bindPicker() {
    document.querySelectorAll('[data-floorplan-size]').forEach(button => button.addEventListener('click', () => {
      state.filterSize = button.dataset.floorplanSize;
      render();
    }));
    document.querySelectorAll('[data-floorplan-template]').forEach(button => button.addEventListener('click', () => {
      createFromTemplate(button.dataset.floorplanTemplate);
    }));
  }

  function bindProfilePhotoFallbacks() {
    document.querySelectorAll('[data-floorplan-profile-photo]').forEach(image => {
      image.addEventListener('error', () => {
        const avatar = image.closest('.has-photo');
        if (avatar) avatar.classList.remove('has-photo');
        image.remove();
      }, { once:true });
    });
  }

  function createDragGhost(tool) {
    const ghost = document.createElement('div');
    ghost.className = 'floorplan-drag-ghost';
    ghost.innerHTML = `<span>${KINDS[tool.dataset.floorplanTool]?.icon || '🐾'}</span><strong>${esc(KINDS[tool.dataset.floorplanTool]?.label || 'Area')}</strong>`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function bindTouchToolDrag(plan, tool) {
    tool.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') return;
      const kind = String(tool.dataset.floorplanTool || '');
      if (!KINDS[kind]) return;
      event.preventDefault();

      const ghost = createDragGhost(tool);
      const moveGhost = (clientX, clientY) => {
        ghost.style.left = `${clientX + 12}px`;
        ghost.style.top = `${clientY + 12}px`;
        const canvas = document.querySelector('[data-floorplan-canvas]');
        canvas?.classList.toggle('is-tool-drop', !!clientToPlanPoint(canvas, clientX, clientY));
      };

      moveGhost(event.clientX,event.clientY);
      try { tool.setPointerCapture(event.pointerId); } catch (_) {}

      const move = moveEvent => {
        moveEvent.preventDefault();
        moveGhost(moveEvent.clientX,moveEvent.clientY);
      };

      const finish = upEvent => {
        tool.removeEventListener('pointermove',move);
        tool.removeEventListener('pointerup',finish);
        tool.removeEventListener('pointercancel',cancel);
        document.querySelector('[data-floorplan-canvas]')?.classList.remove('is-tool-drop');
        ghost.remove();

        const canvas = document.querySelector('[data-floorplan-canvas]');
        const point = canvas ? clientToPlanPoint(canvas,upEvent.clientX,upEvent.clientY) : null;
        if (point) addZoneAtPoint(plan,kind,point.x,point.y);
      };

      const cancel = () => {
        tool.removeEventListener('pointermove',move);
        tool.removeEventListener('pointerup',finish);
        tool.removeEventListener('pointercancel',cancel);
        document.querySelector('[data-floorplan-canvas]')?.classList.remove('is-tool-drop');
        ghost.remove();
      };

      tool.addEventListener('pointermove',move);
      tool.addEventListener('pointerup',finish);
      tool.addEventListener('pointercancel',cancel);
    });
  }

  function bindLayoutToolDrag(plan) {
    const canvas = document.querySelector('[data-floorplan-canvas]');
    if (!canvas) return;

    document.querySelectorAll('[data-floorplan-tool]').forEach(tool => {
      tool.addEventListener('dragstart', event => {
        const kind = String(tool.dataset.floorplanTool || '');
        try {
          event.dataTransfer.setData('text/waffle-floorplan-kind',kind);
          event.dataTransfer.effectAllowed = 'copy';
        } catch (_) {}
      });
      tool.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const kind = String(tool.dataset.floorplanTool || '');
        const firstRoom = plan.rooms[0];
        if (!firstRoom) return;
        const bounds = roomBounds(firstRoom);
        addZoneAtPoint(plan,kind,(bounds.minX+bounds.maxX)/2,(bounds.minY+bounds.maxY)/2);
      });
      bindTouchToolDrag(plan,tool);
    });

    canvas.addEventListener('dragover', event => {
      const kind = event.dataTransfer?.types?.includes('text/waffle-floorplan-kind');
      if (!kind) return;
      event.preventDefault();
      canvas.classList.add('is-tool-drop');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });

    canvas.addEventListener('dragleave', event => {
      if (!canvas.contains(event.relatedTarget)) canvas.classList.remove('is-tool-drop');
    });

    canvas.addEventListener('drop', event => {
      const kind = event.dataTransfer?.getData('text/waffle-floorplan-kind');
      if (!KINDS[kind]) return;
      event.preventDefault();
      canvas.classList.remove('is-tool-drop');
      const point = clientToPlanPoint(canvas,event.clientX,event.clientY);
      if (point) addZoneAtPoint(plan,kind,point.x,point.y);
    });
  }

  function bindEditor() {
    const plan = activePlan();
    if (!plan) return;

    bindProfilePhotoFallbacks();

    document.querySelector('[data-floorplan-name]')?.addEventListener('change', event => renamePlan(plan,event.target.value));
    document.querySelectorAll('[data-floorplan-mode]').forEach(button => button.addEventListener('click', () => {
      state.viewMode = button.dataset.floorplanMode;
      state.selectedZoneId = '';
      renderEditor();
    }));
    document.querySelector('[data-floorplan-default]')?.addEventListener('click', () => setDefault(plan.id));
    document.querySelector('[data-floorplan-duplicate]')?.addEventListener('click', () => duplicatePlan(plan.id));
    document.querySelector('[data-floorplan-delete]')?.addEventListener('click', () => deletePlan(plan.id));

    document.querySelectorAll('[data-floorplan-dog]').forEach(button => {
      button.addEventListener('click', () => {
        state.selectedDogKey = state.selectedDogKey === button.dataset.floorplanDog ? '' : button.dataset.floorplanDog;
        renderEditor();
      });
      button.addEventListener('dragstart', event => {
        state.selectedDogKey = button.dataset.floorplanDog;
        try {
          event.dataTransfer.setData('text/waffle-dog',button.dataset.floorplanDog);
          event.dataTransfer.effectAllowed = 'copy';
        } catch (_) {}
      });
    });

    document.querySelectorAll('[data-floorplan-zone]').forEach(group => {
      const activate = () => {
        const id = group.dataset.floorplanZone;
        state.selectedZoneId = id;
        if (state.selectedDogKey) assignDog(plan,state.selectedDogKey,id);
        else renderEditor();
      };

      group.addEventListener('click',activate);
      group.addEventListener('keydown',event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
      group.addEventListener('dragover',event => {
        if (!event.dataTransfer?.types?.includes('text/waffle-dog')) return;
        event.preventDefault();
        group.classList.add('is-drop-target');
      });
      group.addEventListener('dragleave',() => group.classList.remove('is-drop-target'));
      group.addEventListener('drop',event => {
        const dogKey = event.dataTransfer?.getData('text/waffle-dog') || state.selectedDogKey;
        if (!dogKey) return;
        event.preventDefault();
        event.stopPropagation();
        group.classList.remove('is-drop-target');
        assignDog(plan,dogKey,group.dataset.floorplanZone);
      });
    });

    document.querySelector('[data-floorplan-zone-name]')?.addEventListener('change',event => renameZone(plan,event.target.dataset.floorplanZoneName,event.target.value));
    document.querySelector('[data-floorplan-zone-delete]')?.addEventListener('click',event => deleteZone(plan,event.target.dataset.floorplanZoneDelete));
    document.querySelectorAll('[data-floorplan-unassign]').forEach(button => button.addEventListener('click',() => {
      const [dogKey,kind] = button.dataset.floorplanUnassign.split('|');
      unassign(plan,dogKey,kind);
    }));

    if (state.viewMode === 'layout') bindLayoutToolDrag(plan);
  }

  function renderEditor() {
    const main = document.getElementById('floorplanMain');
    const plan = activePlan();
    if (!main || !plan) return;
    main.innerHTML = editorHtml(plan);
    bindEditor();
  }

  function activateFloorplanTab() {
    document.querySelectorAll('[data-organiser-tab]').forEach(button => {
      const active = button.dataset.organiserTab === 'floorplan';
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-selected',active?'true':'false');
    });
    document.querySelectorAll('[data-organiser-view]').forEach(view => {
      view.hidden = view.dataset.organiserView !== 'floorplan';
    });
    loadData(true);
  }

  function install() {
    if (state.installing) return;
    state.installing = true;
    try {
      const root = document.getElementById('v11115OrganiserRoot');
      if (!root) return false;
      const tabs = root.querySelector('.v11115-organiser-tabs');
      const body = root.querySelector('.v11115-organiser-body');
      if (!tabs || !body) return false;

      if (!tabs.querySelector('[data-organiser-tab="floorplan"]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.organiserTab = 'floorplan';
        button.textContent = '🏠 Floorplan';
        button.addEventListener('click',activateFloorplanTab);
        const sleep = tabs.querySelector('[data-organiser-tab="sleep"]');
        tabs.insertBefore(button,sleep || tabs.lastElementChild);
      }

      if (!body.querySelector('[data-organiser-view="floorplan"]')) {
        const view = document.createElement('div');
        view.dataset.organiserView = 'floorplan';
        view.hidden = true;
        body.appendChild(view);
      }
      return true;
    } finally {
      state.installing = false;
    }
  }

  function start() {
    if (String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || '') !== 'reminders') return;
    loadCss();
    if (install()) return;
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(() => observer.disconnect(),15000);
  }

  window.WAFFLE_ORGANISER_FLOORPLAN = Object.freeze({
    version: VERSION,
    templates: TEMPLATES.map(item => ({id:item.id,name:item.name,size:item.size,shape:item.shape})),
    refresh: () => loadData(true)
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',start,{once:true});
  } else {
    start();
  }
})();