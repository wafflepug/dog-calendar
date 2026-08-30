(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const config = window.WAFFLE_RND_CONFIG || {};
  let client = null;
  let currentUser = null;
  let memberships = [];
  let businesses = new Map();
  let settings = new Map();
  let activeBusinessId = '';

  const views = ['setupState', 'authState', 'onboardingState', 'workspaceState'];

  function showView(id) {
    views.forEach(viewId => {
      const node = $(viewId);
      if (node) node.hidden = viewId !== id;
    });
  }

  function setMessage(id, text, isError = false) {
    const node = $(id);
    if (!node) return;
    node.textContent = text || '';
    node.dataset.kind = isError ? 'error' : 'ok';
  }

  function safeText(value) {
    return String(value == null ? '' : value);
  }

  function slugify(value) {
    return safeText(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  function requireRndConfig() {
    return config.environment === 'rnd' &&
      /^https:\/\/.+\.supabase\.co$/i.test(config.supabaseUrl || '') &&
      safeText(config.supabaseAnonKey).length > 20;
  }

  async function initialise() {
    if (!requireRndConfig() || !window.supabase?.createClient) {
      showView('setupState');
      return;
    }

    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    client.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => handleSession(session), 0);
    });

    const { data, error } = await client.auth.getSession();
    if (error) {
      setMessage('authMessage', error.message, true);
      showView('authState');
      return;
    }
    await handleSession(data.session);
  }

  async function handleSession(session) {
    currentUser = session?.user || null;
    $('signOutButton').hidden = !currentUser;

    if (!currentUser) {
      memberships = [];
      businesses.clear();
      settings.clear();
      activeBusinessId = '';
      showView('authState');
      return;
    }

    await loadMemberships();
  }

  async function loadMemberships() {
    const { data, error } = await client
      .from('business_members')
      .select('business_id, role, status')
      .eq('user_id', currentUser.id)
      .eq('status', 'active');

    if (error) throw error;
    memberships = data || [];

    if (!memberships.length) {
      showView('onboardingState');
      return;
    }

    const ids = memberships.map(row => row.business_id);
    const [{ data: businessRows, error: businessError }, { data: settingRows, error: settingsError }] = await Promise.all([
      client.from('businesses').select('*').in('id', ids),
      client.from('business_settings').select('*').in('business_id', ids)
    ]);

    if (businessError) throw businessError;
    if (settingsError) throw settingsError;

    businesses = new Map((businessRows || []).map(row => [row.id, row]));
    settings = new Map((settingRows || []).map(row => [row.business_id, row]));

    const remembered = sessionStorage.getItem('waffleRndBusinessId') || '';
    activeBusinessId = ids.includes(remembered) ? remembered : ids[0];
    buildBusinessPicker();
    showView('workspaceState');
    await renderWorkspace();
  }

  function buildBusinessPicker() {
    const picker = $('businessPicker');
    picker.replaceChildren();
    memberships.forEach(member => {
      const business = businesses.get(member.business_id);
      if (!business) return;
      const option = document.createElement('option');
      option.value = member.business_id;
      option.textContent = business.name;
      option.selected = member.business_id === activeBusinessId;
      picker.appendChild(option);
    });
  }

  function activeMembership() {
    return memberships.find(row => row.business_id === activeBusinessId) || null;
  }

  async function renderWorkspace() {
    const business = businesses.get(activeBusinessId);
    const businessSettings = settings.get(activeBusinessId) || {};
    const membership = activeMembership();
    if (!business || !membership) return;

    sessionStorage.setItem('waffleRndBusinessId', activeBusinessId);
    $('workspaceTitle').textContent = business.name;
    $('workspaceSubtitle').textContent = `${business.timezone} · tenant ${business.id.slice(0, 8)}…`;
    $('planBadge').textContent = safeText(business.plan).toUpperCase();
    $('roleBadge').textContent = safeText(membership.role).toUpperCase();
    $('capacityCount').textContent = safeText(business.normal_capacity);

    $('settingsName').value = business.name || '';
    $('settingsTimezone').value = business.timezone || 'Australia/Sydney';
    $('settingsCapacity').value = business.normal_capacity || 4;
    $('settingsContactName').value = businessSettings.contact_name || '';
    $('settingsContactEmail').value = businessSettings.contact_email || '';
    $('settingsContactPhone').value = businessSettings.contact_phone || '';
    $('settingsAddress').value = businessSettings.address_text || '';

    const ownerOnly = membership.role !== 'owner';
    $('settingsForm').querySelectorAll('input, textarea, button').forEach(node => {
      node.disabled = ownerOnly;
    });

    await Promise.all([loadDogs(), loadStays()]);
  }

  async function loadDogs() {
    const { data, error } = await client
      .from('dogs')
      .select('id, dog_name, breed, owner_name, active, created_at')
      .eq('business_id', activeBusinessId)
      .eq('active', true)
      .order('dog_name');
    if (error) throw error;

    const rows = data || [];
    $('dogCount').textContent = safeText(rows.length);
    $('dogsEmpty').hidden = rows.length > 0;
    const list = $('dogList');
    list.replaceChildren();
    rows.forEach(row => {
      const item = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = row.dog_name;
      const meta = document.createElement('span');
      meta.textContent = row.breed || 'Breed not added';
      item.append(strong, meta);
      list.appendChild(item);
    });
  }

  async function loadStays() {
    const { data, error } = await client
      .from('stays')
      .select('id, start_date, end_date, status')
      .eq('business_id', activeBusinessId)
      .order('start_date', { ascending: true });
    if (error) throw error;

    const rows = data || [];
    $('stayCount').textContent = safeText(rows.length);
    $('staysEmpty').hidden = rows.length > 0;
    const list = $('stayList');
    list.replaceChildren();
    rows.forEach(row => {
      const item = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = row.status.replace('_', ' ');
      const meta = document.createElement('span');
      meta.textContent = `${row.start_date} → ${row.end_date}`;
      item.append(strong, meta);
      list.appendChild(item);
    });
  }

  $('authForm').addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('authMessage', 'Signing in…');
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const { error } = await client.auth.signInWithPassword({ email, password });
    setMessage('authMessage', error ? error.message : 'Signed in.', Boolean(error));
  });

  $('signUpButton').addEventListener('click', async () => {
    setMessage('authMessage', 'Creating account…');
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    if (!email || password.length < 8) {
      setMessage('authMessage', 'Enter an email and a password of at least 8 characters.', true);
      return;
    }
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) {
      setMessage('authMessage', error.message, true);
      return;
    }
    setMessage('authMessage', data.session ? 'Account created.' : 'Account created. Check your email if confirmation is enabled.');
  });

  $('signOutButton').addEventListener('click', async () => {
    if (client) await client.auth.signOut();
  });

  $('businessName').addEventListener('input', () => {
    if ($('businessSlug').dataset.edited === 'true') return;
    $('businessSlug').value = slugify($('businessName').value) || 'waffle-rnd';
  });

  $('businessSlug').addEventListener('input', () => {
    $('businessSlug').dataset.edited = 'true';
  });

  $('onboardingForm').addEventListener('submit', async event => {
    event.preventDefault();
    setMessage('onboardingMessage', 'Creating isolated workspace…');

    const payload = {
      p_name: $('businessName').value.trim(),
      p_slug: $('businessSlug').value.trim().toLowerCase(),
      p_timezone: $('businessTimezone').value.trim(),
      p_capacity: Number($('businessCapacity').value || 4)
    };

    const { data: businessId, error } = await client.rpc('create_business', payload);
    if (error) {
      setMessage('onboardingMessage', error.message, true);
      return;
    }

    const settingsUpdate = {
      contact_name: $('contactName').value.trim() || null,
      contact_phone: $('contactPhone').value.trim() || null,
      onboarding_step: 10,
      updated_at: new Date().toISOString()
    };

    const [{ error: settingsError }, { error: businessError }] = await Promise.all([
      client.from('business_settings').update(settingsUpdate).eq('business_id', businessId),
      client.from('businesses').update({
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', businessId)
    ]);

    if (settingsError || businessError) {
      setMessage('onboardingMessage', (settingsError || businessError).message, true);
      return;
    }

    setMessage('onboardingMessage', 'Workspace created.');
    await loadMemberships();
  });

  $('businessPicker').addEventListener('change', async event => {
    activeBusinessId = event.target.value;
    await renderWorkspace();
  });

  $('dogForm').addEventListener('submit', async event => {
    event.preventDefault();
    const dogName = $('dogName').value.trim();
    if (!dogName) return;
    setMessage('dogMessage', 'Adding dog…');
    const { error } = await client.from('dogs').insert({
      business_id: activeBusinessId,
      dog_name: dogName,
      breed: $('dogBreed').value.trim() || null
    });
    if (error) {
      setMessage('dogMessage', error.message, true);
      return;
    }
    $('dogForm').reset();
    setMessage('dogMessage', `${dogName} added.`);
    await loadDogs();
  });

  $('settingsForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (activeMembership()?.role !== 'owner') return;
    setMessage('settingsMessage', 'Saving…');

    const businessUpdate = {
      name: $('settingsName').value.trim(),
      timezone: $('settingsTimezone').value.trim(),
      normal_capacity: Number($('settingsCapacity').value || 4),
      updated_at: new Date().toISOString()
    };
    const settingsUpdate = {
      contact_name: $('settingsContactName').value.trim() || null,
      contact_email: $('settingsContactEmail').value.trim() || null,
      contact_phone: $('settingsContactPhone').value.trim() || null,
      address_text: $('settingsAddress').value.trim() || null,
      updated_at: new Date().toISOString()
    };

    const [{ data: businessRow, error: businessError }, { data: settingRow, error: settingsError }] = await Promise.all([
      client.from('businesses').update(businessUpdate).eq('id', activeBusinessId).select().single(),
      client.from('business_settings').update(settingsUpdate).eq('business_id', activeBusinessId).select().single()
    ]);

    if (businessError || settingsError) {
      setMessage('settingsMessage', (businessError || settingsError).message, true);
      return;
    }

    businesses.set(activeBusinessId, businessRow);
    settings.set(activeBusinessId, settingRow);
    setMessage('settingsMessage', 'Business settings saved.');
    buildBusinessPicker();
    await renderWorkspace();
  });

  initialise().catch(error => {
    console.error('Release A R&D initialisation failed', error);
    if (currentUser) {
      setMessage('settingsMessage', error.message || String(error), true);
    } else {
      setMessage('authMessage', error.message || String(error), true);
      showView('authState');
    }
  });
})();
