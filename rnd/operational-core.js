(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const config = window.WAFFLE_RND_CONFIG || {};
  const state = window.WaffleRndOps = {
    client: null,
    user: null,
    memberships: [],
    businesses: new Map(),
    settings: new Map(),
    businessId: '',
    dogs: [],
    stays: [],
    view: 'today',
    careTab: 'current',
    calendarCursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    editingStayId: ''
  };

  const safeText = value => String(value == null ? '' : value);
  const isoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const localDateFromIso = value => {
    const [y, m, d] = safeText(value).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const humanDate = (value, withYear = false) => value ? new Intl.DateTimeFormat('en-AU', {
    day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined
  }).format(localDateFromIso(value)) : '';
  const humanTime = value => {
    if (!value) return '';
    const [h, m] = value.split(':').map(Number);
    return new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, h || 0, m || 0));
  };
  const statusLabel = status => ({
    confirmed: 'Confirmed', potential: 'Potential', meet_greet: 'Meet & Greet', completed: 'Completed', cancelled: 'Cancelled'
  })[status] || status;
  const activeBusiness = () => state.businesses.get(state.businessId) || null;
  const activeSettings = () => state.settings.get(state.businessId) || {};
  const activeMembership = () => state.memberships.find(row => row.business_id === state.businessId) || null;
  const dogById = id => state.dogs.find(row => row.id === id) || null;
  const stayById = id => state.stays.find(row => row.id === id) || null;

  Object.assign(state, { $, safeText, isoToday, localDateFromIso, humanDate, humanTime, statusLabel, activeBusiness, activeSettings, activeMembership, dogById, stayById });

  function setMessage(id, text, isError = false) {
    const node = $(id);
    if (!node) return;
    node.textContent = text || '';
    node.dataset.kind = isError ? 'error' : 'ok';
  }
  state.setMessage = setMessage;

  function buildShell() {
    let shell = $('rndOperationalShell');
    if (shell) return shell;
    shell = document.createElement('section');
    shell.id = 'rndOperationalShell';
    shell.hidden = true;
    shell.innerHTML = `
      <div class="ops-toolbar panel compact">
        <div><p class="eyebrow">Active business</p><select id="opsBusinessPicker" aria-label="Active business"></select></div>
        <div class="toolbar-meta"><span id="opsPlanBadge" class="pill"></span><span id="opsRoleBadge" class="pill soft"></span></div>
      </div>
      <nav class="ops-nav panel compact" aria-label="Workspace">
        <button type="button" data-ops-view="today" class="is-active">Today</button>
        <button type="button" data-ops-view="calendar">Calendar</button>
        <button type="button" data-ops-view="add" class="ops-add">+ Add</button>
        <button type="button" data-ops-view="care">Care</button>
        <button type="button" data-ops-view="settings">Settings</button>
      </nav>
      <div id="opsViewHost"></div>`;
    const legacy = $('workspaceState');
    legacy.parentNode.insertBefore(shell, legacy.nextSibling);
    return shell;
  }

  function buildPicker() {
    const picker = $('opsBusinessPicker');
    if (!picker) return;
    picker.replaceChildren();
    state.memberships.forEach(member => {
      const business = state.businesses.get(member.business_id);
      if (!business) return;
      const option = document.createElement('option');
      option.value = member.business_id;
      option.textContent = business.name;
      option.selected = member.business_id === state.businessId;
      picker.appendChild(option);
    });
  }

  async function loadMemberships() {
    const { data, error } = await state.client.from('business_members').select('business_id,role,status').eq('user_id', state.user.id).eq('status', 'active');
    if (error) throw error;
    state.memberships = data || [];
    if (!state.memberships.length) return false;
    const ids = state.memberships.map(row => row.business_id);
    const [{ data: businessRows, error: bError }, { data: settingRows, error: sError }] = await Promise.all([
      state.client.from('businesses').select('*').in('id', ids),
      state.client.from('business_settings').select('*').in('business_id', ids)
    ]);
    if (bError) throw bError;
    if (sError) throw sError;
    state.businesses = new Map((businessRows || []).map(row => [row.id, row]));
    state.settings = new Map((settingRows || []).map(row => [row.business_id, row]));
    const remembered = sessionStorage.getItem('waffleRndBusinessId') || '';
    state.businessId = ids.includes(remembered) ? remembered : ids[0];
    return true;
  }

  async function loadData() {
    const [{ data: dogs, error: dogError }, { data: stays, error: stayError }] = await Promise.all([
      state.client.from('dogs').select('id,business_id,dog_name,breed,owner_name,owner_phone,notes,active,created_at,updated_at').eq('business_id', state.businessId).eq('active', true).order('dog_name'),
      state.client.from('stays').select('id,business_id,dog_id,start_date,end_date,arrival_time,departure_time,status,notes,created_at,updated_at').eq('business_id', state.businessId).order('start_date', { ascending: true })
    ]);
    if (dogError) throw dogError;
    if (stayError) throw stayError;
    state.dogs = dogs || [];
    state.stays = stays || [];
  }
  state.loadData = loadData;

  async function activate() {
    buildShell();
    document.body.dataset.rndOpsActive = 'true';
    const legacy = $('workspaceState');
    if (legacy) legacy.hidden = true;
    $('rndOperationalShell').hidden = false;
    sessionStorage.setItem('waffleRndBusinessId', state.businessId);
    buildPicker();
    $('opsPlanBadge').textContent = safeText(activeBusiness()?.plan).toUpperCase();
    $('opsRoleBadge').textContent = safeText(activeMembership()?.role).toUpperCase();
    await loadData();
    window.WaffleRndOpsRender.renderView(state.view);
  }
  state.activate = activate;

  async function handleSession(session) {
    state.user = session?.user || null;
    if (!state.user) {
      delete document.body.dataset.rndOpsActive;
      const shell = $('rndOperationalShell');
      if (shell) shell.hidden = true;
      return;
    }
    const hasBusiness = await loadMemberships();
    if (!hasBusiness) return;
    await activate();
  }

  async function init() {
    if (state.client) return;
    if (config.environment !== 'rnd' || !window.supabase?.createClient) return;
    state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    state.client.auth.onAuthStateChange((_event, session) => setTimeout(() => handleSession(session).catch(console.error), 0));
    const { data, error } = await state.client.auth.getSession();
    if (error) throw error;
    await handleSession(data.session);
  }

  state.start = () => init().catch(error => console.error('R&D operational core failed', error));
})();
