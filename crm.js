(() => {
  'use strict';

  // Uses the same read actions as Care. CRM keeps records in memory only.
  const endpoint = 'https://script.google.com/macros/s/AKfycbwn4HL49K9c3AZbXJRUjPw3UYWxJt8DmqXwMnTytyqdSstj3ZIJwWdDEC2IsBjetOf3pw/exec';
  const $ = id => document.getElementById(id);
  const names = {current:'Staying', upcoming:'Upcoming', potential:'Potential', past:'Past'};
  const rank = ['current', 'upcoming', 'potential', 'past'];
  const text = value => String(value ?? '').trim();
  const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  const formatDate = new Intl.DateTimeFormat('en-AU', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
  const format = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? formatDate.format(new Date(value)) : value;
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Australia/Sydney', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
  let groups = [];
  let notice = '';
  let loading = false;

  try { document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light'; } catch (_) {}

  function read(action, options = {}) {
    return new Promise((resolve, reject) => {
      const callback = '__palzCrm_' + crypto.randomUUID().replaceAll('-', '');
      const script = document.createElement('script');
      const url = new URL(endpoint);
      url.searchParams.set('callback', callback);
      url.searchParams.set('payload', JSON.stringify({action, ...options}));
      const cleanup = () => {
        clearTimeout(timeout);
        script.remove();
        delete window[callback];
      };
      const timeout = setTimeout(() => { cleanup(); reject(Error('Request timed out')); }, 30000);
      window[callback] = result => {
        cleanup();
        if (result?.result === 'success') resolve(result);
        else reject(Error('Records unavailable'));
      };
      script.onerror = () => { cleanup(); reject(Error('Records unavailable')); };
      script.src = url.href;
      document.head.append(script);
    });
  }

  function buildGroups(current, past, potential) {
    const records = new Map();
    const operations = new Map((current.operations || []).filter(op => op.stayId && !op.identityConflict)
      .map(op => [text(op.stayId).toLowerCase(), op.status]));
    function add(row, status) {
      const stayId = text(row.stayId).toLowerCase();
      const dogId = text(row.dogId).toLowerCase();
      const dogName = text(row.dogName);
      if (!dogName) return;
      const startDate = text(row.startDate);
      const endDate = text(row.endDate);
      const stayKey = text(row.stayKey) || [dogName.toLowerCase(),startDate,endDate].join('|');
      const stayIdentity = uuid.test(stayId) ? stayId : [stayKey,row.row || row.id || ''].join('|');
      const key = uuid.test(dogId) ? dogId : stayIdentity;
      if (!records.has(key)) records.set(key,new Map());
      const stays = records.get(key);
      if (stays.has(stayIdentity)) return;
      stays.set(stayIdentity, {
        stayId, stayKey, dogId, dogName, startDate, endDate, status,
        dogNumber:text(row.dogNumber), owner:text(row.ownerName), phone:text(row.phone),
        breed:text(row.breed), species:row.species === 'cat' ? 'cat' : 'dog'
      });
    }
    for (const stay of past.bookings || []) add(stay,'past');
    for (const stay of current.bookings || []) {
      const checkedOut = operations.get(text(stay.stayId).toLowerCase()) === 'checked_out';
      add(stay, checkedOut || stay.endDate < today ? 'past' : stay.startDate > today ? 'upcoming' : 'current');
    }
    for (const stay of potential.records || []) add(stay,'potential');
    return [...records.values()].map(stays => [...stays.values()].sort((a,b) =>
      rank.indexOf(a.status) - rank.indexOf(b.status) || b.startDate.localeCompare(a.startDate)));
  }

  function careUrl(stay) {
    if (stay.status === 'potential') return 'index.html?view=today#whHomePotentials';
    const params = new URLSearchParams({stayKey:stay.stayKey});
    if (uuid.test(stay.stayId)) params.set('stayId',stay.stayId);
    if (uuid.test(stay.dogId)) params.set('dogId',stay.dogId);
    return 'directory.html?' + params;
  }

  function addLink(host, href, label) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    host.append(link);
  }

  function render() {
    const query = $('search').value.trim().toLowerCase();
    const filter = $('stay-status').value;
    const species = $('species').value;
    const digits = query.replace(/[^\d]/g, '');
    const results = groups.flatMap(stays => {
      const match = stays.find(stay => {
        if (filter !== 'all' && stay.status !== filter) return false;
        if (species !== 'all' && stay.species !== species) return false;
        return !query || [stay.dogName,stay.owner,stay.phone,stay.dogNumber].some(value => value.toLowerCase().includes(query))
          || (digits.length >= 3 && /^[\d+ ().-]+$/.test(query) && stay.phone.replace(/\D/g,'').includes(digits));
      });
      return match ? [{stays, match}] : [];
    }).sort((a,b) => rank.indexOf(a.match.status) - rank.indexOf(b.match.status) || a.match.dogName.localeCompare(b.match.dogName));
    const fragment = document.createDocumentFragment();
    for (const {stays,match} of results) {
      const card = $('record-template').content.cloneNode(true);
      card.querySelector('h2').textContent = match.dogName;
      card.querySelector('.crm-badge').textContent = names[match.status];
      card.querySelector('.crm-pet-meta').textContent = [match.species === 'cat' ? 'Cat' : 'Dog', match.breed, match.dogNumber && 'Pet ID ' + match.dogNumber].filter(Boolean).join(' · ');
      const phone = match.phone.replace(/[\s().-]/g,'');
      const dial = /^4\d{8}$/.test(phone) ? '0' + phone : phone;
      const callable = /^\+?\d{6,15}$/.test(dial);
      card.querySelector('.crm-owner').textContent = [match.owner || 'Owner not recorded', callable && dial].filter(Boolean).join(' · ');
      const actions = card.querySelector('.crm-actions');
      if (callable) addLink(actions,'tel:' + dial,'Call owner');
      addLink(actions,careUrl(match),match.status === 'potential' ? 'View potential stays' : 'Open Care profile');
      card.querySelector('summary').textContent = stays.length + (stays.length === 1 ? ' stay record' : ' stay records');
      const list = card.querySelector('ul');
      for (const stay of stays) {
        const item = document.createElement('li');
        addLink(item,careUrl(stay),[format(stay.startDate),format(stay.endDate)].filter(Boolean).join(' – ') || 'Dates unavailable');
        item.append(' · ' + names[stay.status]);
        list.append(item);
      }
      fragment.append(card);
    }
    $('records').replaceChildren(fragment);
    if (!loading) $('status').textContent = [results.length ? results.length + (results.length === 1 ? ' record' : ' records') : 'No matching records.', notice].filter(Boolean).join(' ');
  }

  async function load() {
    if (loading) return;
    loading = true;
    $('refresh').disabled = true;
    $('records').setAttribute('aria-busy','true');
    $('status').textContent = 'Loading CRM records…';
    const empty = {};
    const reads = await Promise.allSettled([read('get_guest_directory'), read('get_past_guest_directory',{limit:500}), read('get_potential_stays')]);
    const [current,past,potential] = reads.map(result => result.status === 'fulfilled' ? result.value : empty);
    const failed = reads.filter(result => result.status === 'rejected').length;
    notice = failed ? (failed === reads.length ? 'CRM records could not load. Try Refresh.' : 'Some sources could not load. Try Refresh.')
      : Number(past.totalPastStays) > (past.bookings || []).length ? 'Showing the latest 500 past stays.' : '';
    if (failed < reads.length) groups = buildGroups(current,past,potential);
    loading = false;
    $('refresh').disabled = false;
    $('records').setAttribute('aria-busy','false');
    render();
  }

  $('refresh').addEventListener('click',load);
  $('search').addEventListener('input',render);
  $('stay-status').addEventListener('change',render);
  $('species').addEventListener('change',render);
  void load();
})();
