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
    lastLoadedAt: 0
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
    let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

    match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, amount) {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + amount);
    return next;
  }

  function dayKey(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatShortDate(value) {
    const date = value instanceof Date ? value : parseDate(value);
    if (!date) return '';
    return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
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
    const response = await query({
      action: 'save_organiser_item',
      id: item.id || '',
      type: item.type,
      title: item.title || '',
      stayKey: item.stayKey || '',
      dogName: item.dogName || '',
      value: item.value || {}
    });

    if (!response || response.result !== 'success' || !response.item) {
      throw new Error((response && response.message) || 'The organiser item could not be saved.');
    }

    upsertLocal(response.item);
    if (!options || options.render !== false) renderActiveTab();
    if (!options || options.toast !== false) toast('Saved ✓');
    return response.item;
  }

  async function deleteItem(id, options) {
    const response = await query({ action: 'delete_organiser_item', id });
    if (!response || response.result !== 'success') {
      throw new Error((response && response.message) || 'The organiser item could not be removed.');
    }
    removeLocal(id);
    if (!options || options.render !== false) renderActiveTab();
    if (!options || options.toast !== false) toast('Removed');
  }

  function uniqueBookings() {
    const seen = new Set();
    return state.bookings.filter(booking => {
      const key = String(booking.stayKey || `${booking.dogName}|${booking.startDate}|${booking.endDate}`);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function planningDogs() {
    const today = startOfDay(new Date());
    const horizon = addDays(today, 7);

    return uniqueBookings()
      .filter(booking => {
        const start = startOfDay(parseDate(booking.startDate) || today);
        const end = startOfDay(parseDate(booking.endDate) || start);
        return end >= today && start <= horizon;
      })
      .sort((a, b) => String(a.dogName || '').localeCompare(String(b.dogName || '')));
  }

  function currentDogs() {
    const today = startOfDay(new Date());
    return uniqueBookings()
      .filter(booking => {
        const start = parseDate(booking.startDate);
        const end = parseDate(booking.endDate);
        if (!start || !end) return false;
        return startOfDay(start) <= today && startOfDay(end) >= today;
      })
      .sort((a, b) => String(a.dogName || '').localeCompare(String(b.dogName || '')));
  }

  function upcomingArrivals() {
    const today = startOfDay(new Date());
    const horizon = addDays(today, 7);
    return uniqueBookings()
      .filter(booking => {
        const start = parseDate(booking.startDate);
        if (!start) return false;
        const day = startOfDay(start);
        return day >= today && day <= horizon;
      })
      .sort((a, b) => parseDate(a.startDate) - parseDate(b.startDate));
  }

  function upcomingCheckouts() {
    const today = startOfDay(new Date());
    const horizon = addDays(today, 7);
    return uniqueBookings()
      .filter(booking => {
        const end = parseDate(booking.endDate);
        if (!end) return false;
        const day = startOfDay(end);
        return day >= today && day <= horizon;
      })
      .sort((a, b) => parseDate(a.endDate) - parseDate(b.endDate));
  }

  function assignmentFor(type, stayKey) {
    return itemsOf(type).find(item => String(item.stayKey || '') === String(stayKey || '')) || null;
  }

  function targetTitle(type, targetId) {
    const target = itemsOf(type).find(item => item.id === targetId);
    return target ? target.title : '';
  }

  function shellHtml() {
    return `
      <section class="v11115-organiser" id="v11115OrganiserRoot">
        <div class="v11115-organiser-hero">
          <div>
            <span class="v11115-eyebrow">HOUSE OPERATIONS</span>
            <h1>🗂 Waffle House Organiser</h1>
            <p>Plan where everything goes, prepare arrivals and checkouts, and keep the day organised in one shared workspace.</p>
          </div>
          <button type="button" class="v11115-refresh" data-organiser-refresh>↻ Refresh</button>
        </div>

        <nav class="v11115-organiser-tabs" aria-label="Organiser sections">
          <button type="button" data-organiser-tab="overview" class="is-active">Overview</button>
          <button type="button" data-organiser-tab="shelves">Shelves</button>
          <button type="button" data-organiser-tab="arrivals">Arrival Prep</button>
          <button type="button" data-organiser-tab="checkouts">Checkout Prep</button>
          <button type="button" data-organiser-tab="sleep">Sleeping Areas</button>
          <button type="button" data-organiser-tab="tasks">Daily Tasks</button>
          <button type="button" data-organiser-tab="notes">Sticky Notes</button>
        </nav>

        <div class="v11115-organiser-body">
          <div data-organiser-view="overview"></div>
          <div data-organiser-view="shelves" hidden></div>
          <div data-organiser-view="arrivals" hidden></div>
          <div data-organiser-view="checkouts" hidden></div>
          <div data-organiser-view="sleep" hidden></div>
          <div data-organiser-view="tasks" hidden></div>
          <div data-organiser-view="notes" hidden>
            <div id="v11115StickyNotesHost"></div>
          </div>
        </div>
      </section>
    `;
  }

  function buildShell() {
    const panel = document.getElementById('remindersTabPanel');
    if (!panel || document.getElementById('v11115OrganiserRoot')) return;

    const existing = Array.from(panel.childNodes);
    panel.insertAdjacentHTML('afterbegin', shellHtml());
    const stickyHost = document.getElementById('v11115StickyNotesHost');

    existing.forEach(node => {
      if (node && node.parentNode === panel) stickyHost.appendChild(node);
    });

    const legacyHeader = stickyHost.querySelector('.reminders-header');
    if (legacyHeader) {
      const heading = legacyHeader.querySelector('h3');
      const copy = legacyHeader.querySelector('p');
      if (heading) heading.textContent = '📌 Sticky Notes';
      if (copy) copy.textContent = 'Shared sticky notes for quick reminders, ideas and one-off follow-ups.';
    }

    document.title = 'Waffle House — Organiser';

    panel.querySelectorAll('[data-organiser-tab]').forEach(button => {
      button.addEventListener('click', () => switchTab(button.dataset.organiserTab));
    });

    const refresh = panel.querySelector('[data-organiser-refresh]');
    if (refresh) refresh.addEventListener('click', () => loadOrganiser({ force: true, button: refresh }));
  }

  function switchTab(tab) {
    state.activeTab = tab || 'overview';
    document.querySelectorAll('[data-organiser-tab]').forEach(button => {
      const active = button.dataset.organiserTab === state.activeTab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-organiser-view]').forEach(view => {
      view.hidden = view.dataset.organiserView !== state.activeTab;
    });
    renderActiveTab();
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
    const host = document.querySelector('[data-organiser-view="overview"]');
    if (!host) return;

    const arrivals = upcomingArrivals();
    const checkouts = upcomingCheckouts();
    const dogs = currentDogs();
    const openTasks = itemsOf('task').filter(item => !(item.value && item.value.done));
    const shelves = itemsOf('shelf');
    const areas = itemsOf('sleep_area');

    host.innerHTML = `
      <div class="v11115-summary-grid">
        <button type="button" data-organiser-jump="shelves"><span>🧳</span><strong>${shelves.length}</strong><small>Shelves</small></button>
        <button type="button" data-organiser-jump="arrivals"><span>🛬</span><strong>${arrivals.length}</strong><small>Arrivals next 7 days</small></button>
        <button type="button" data-organiser-jump="checkouts"><span>👋</span><strong>${checkouts.length}</strong><small>Checkouts next 7 days</small></button>
        <button type="button" data-organiser-jump="tasks"><span>✅</span><strong>${openTasks.length}</strong><small>Open tasks</small></button>
      </div>

      <div class="v11115-overview-grid">
        <article class="v11115-panel">
          <div class="v11115-panel-heading"><div><span>RIGHT NOW</span><h2>House setup</h2></div></div>
          <div class="v11115-house-status">
            <div><strong>${dogs.length}</strong><span>Dogs at home</span></div>
            <div><strong>${itemsOf('shelf_assignment').length}</strong><span>Shelf assignments</span></div>
            <div><strong>${itemsOf('sleep_assignment').length}</strong><span>Sleeping assignments</span></div>
            <div><strong>${areas.length}</strong><span>Sleeping areas</span></div>
          </div>
        </article>

        <article class="v11115-panel">
          <div class="v11115-panel-heading"><div><span>QUICK ORGANISER</span><h2>What do you want to plan?</h2></div></div>
          <div class="v11115-quick-grid">
            <button type="button" data-organiser-jump="shelves">🧳 <b>Shelves & belongings</b><small>Know where each dog's things live.</small></button>
            <button type="button" data-organiser-jump="sleep">🛏️ <b>Sleeping areas</b><small>Assign each dog a bed or zone.</small></button>
            <button type="button" data-organiser-jump="arrivals">🛬 <b>Arrival prep</b><small>Get upcoming dogs ready.</small></button>
            <button type="button" data-organiser-jump="checkouts">👋 <b>Checkout prep</b><small>Make sure everything goes home.</small></button>
          </div>
        </article>
      </div>
    `;

    host.querySelectorAll('[data-organiser-jump]').forEach(button => {
      button.addEventListener('click', () => switchTab(button.dataset.organiserJump));
    });
  }

  function renderAssignmentModule(kind) {
    const isShelf = kind === 'shelf';
    const host = document.querySelector(`[data-organiser-view="${isShelf ? 'shelves' : 'sleep'}"]`);
    if (!host) return;

    const itemType = isShelf ? 'shelf' : 'sleep_area';
    const assignmentType = isShelf ? 'shelf_assignment' : 'sleep_assignment';
    const targets = itemsOf(itemType).sort((a, b) => String(a.title).localeCompare(String(b.title), undefined, { numeric: true }));
    const assignments = itemsOf(assignmentType);
    const dogs = planningDogs();
    const assignedKeys = new Set(assignments.map(item => String(item.stayKey || '')));
    const unassigned = dogs.filter(dog => !assignedKeys.has(String(dog.stayKey || '')));

    host.innerHTML = `
      <div class="v11115-section-heading">
        <div>
          <span>${isShelf ? 'BELONGINGS ORGANISER' : 'HOUSE SETUP'}</span>
          <h2>${isShelf ? '🧳 Shelves & Belongings' : '🛏️ Sleeping Areas'}</h2>
          <p>${isShelf ? 'Assign each current or soon-arriving dog to the shelf where their belongings are stored.' : 'Plan where each dog will sleep so the house setup is clear at a glance.'}</p>
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

  function renderPrep(kind) {
    const arrival = kind === 'arrival';
    const tab = arrival ? 'arrivals' : 'checkouts';
    const type = arrival ? 'arrival_checklist' : 'checkout_checklist';
    const host = document.querySelector(`[data-organiser-view="${tab}"]`);
    if (!host) return;

    const bookings = arrival ? upcomingArrivals() : upcomingCheckouts();
    const labels = arrival ? ARRIVAL_CHECKS : CHECKOUT_CHECKS;

    host.innerHTML = `
      <div class="v11115-section-heading">
        <div>
          <span>${arrival ? 'BEFORE THEY ARRIVE' : 'BEFORE THEY GO HOME'}</span>
          <h2>${arrival ? '🛬 Arrival Preparation' : '👋 Checkout Preparation'}</h2>
          <p>${arrival ? 'A seven-day preparation board for incoming dogs. Shelf and sleeping assignments update automatically.' : 'A seven-day handover board so belongings, food, medication and owner updates are ready.'}</p>
        </div>
      </div>

      <div class="v11115-prep-list">
        ${bookings.length ? bookings.map(booking => {
          const item = checklistItem(type, booking);
          const checks = (item.value && item.value.checks) || {};
          const shelfAuto = arrival && Boolean(assignmentFor('shelf_assignment', booking.stayKey));
          const bedAuto = arrival && Boolean(assignmentFor('sleep_assignment', booking.stayKey));
          const manualDone = labels.filter(entry => Boolean(checks[entry[0]])).length;
          const done = manualDone + (arrival && shelfAuto ? 1 : 0) + (arrival && bedAuto ? 1 : 0);
          const total = labels.length + (arrival ? 2 : 0);
          const percent = progressPercent(done, total);

          return `
            <article class="v11115-prep-card" data-prep-stay="${esc(booking.stayKey)}">
              <div class="v11115-prep-head">
                <div>
                  <span>${arrival ? `ARRIVING ${esc(formatShortDate(booking.startDate))}` : `LEAVING ${esc(formatShortDate(booking.endDate))}`}</span>
                  <h3>🐶 ${esc(booking.dogName)}</h3>
                  <small>${esc(booking.breed || '')}${booking.ownerName ? ` · Owner ${esc(booking.ownerName)}` : ''}</small>
                </div>
                <strong>${percent}%</strong>
              </div>
              <div class="v11115-progress"><i style="width:${percent}%"></i></div>
              <div class="v11115-check-grid">
                ${arrival ? `
                  <label class="is-auto ${shelfAuto ? 'is-done' : ''}"><input type="checkbox" ${shelfAuto ? 'checked' : ''} disabled><span>🧳 Shelf allocated</span></label>
                  <label class="is-auto ${bedAuto ? 'is-done' : ''}"><input type="checkbox" ${bedAuto ? 'checked' : ''} disabled><span>🛏️ Sleeping area allocated</span></label>
                ` : ''}
                ${labels.map(entry => `
                  <label class="${checks[entry[0]] ? 'is-done' : ''}"><input type="checkbox" data-prep-check="${esc(entry[0])}" ${checks[entry[0]] ? 'checked' : ''}><span>${esc(entry[1])}</span></label>
                `).join('')}
              </div>
            </article>
          `;
        }).join('') : emptyHtml(arrival ? '🛬' : '👋', arrival ? 'No arrivals in the next 7 days' : 'No checkouts in the next 7 days', arrival ? 'This board will populate automatically as new stays enter the seven-day window.' : 'Checkout preparation will appear here automatically when a stay is due to finish.', '', '')}
      </div>
    `;

    host.querySelectorAll('[data-prep-check]').forEach(input => {
      input.addEventListener('change', async () => {
        const card = input.closest('[data-prep-stay]');
        const stayKey = card ? card.dataset.prepStay : '';
        const booking = bookings.find(entry => String(entry.stayKey) === String(stayKey));
        if (!booking) return;

        const item = checklistItem(type, booking);
        const checks = Object.assign({}, (item.value && item.value.checks) || {});
        checks[input.dataset.prepCheck] = input.checked;
        item.value = Object.assign({}, item.value || {}, { checks });

        input.disabled = true;
        try {
          await saveItem(item, { render: false, toast: false });
          renderPrep(kind);
          toast('Checklist saved ✓');
        } catch (error) {
          input.checked = !input.checked;
          input.disabled = false;
          toast(error.message, 'error');
        }
      });
    });
  }

  function renderTasks() {
    const host = document.querySelector('[data-organiser-view="tasks"]');
    if (!host) return;

    const tasks = itemsOf('task').slice().sort((a, b) => {
      const aDone = Boolean(a.value && a.value.done);
      const bDone = Boolean(b.value && b.value.done);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return String((a.value && a.value.dueDate) || '').localeCompare(String((b.value && b.value.dueDate) || ''));
    });

    const today = dayKey(new Date());

    host.innerHTML = `
      <div class="v11115-section-heading">
        <div>
          <span>SELF ORGANISER</span>
          <h2>✅ Daily Tasks</h2>
          <p>Shared operational tasks for today and the days ahead. Link a task to a dog when useful.</p>
        </div>
        <button type="button" data-organiser-add-task>＋ Add Task</button>
      </div>

      <div class="v11115-task-list">
        ${tasks.length ? tasks.map(task => {
          const done = Boolean(task.value && task.value.done);
          const dueDate = String((task.value && task.value.dueDate) || '');
          return `
            <article class="v11115-task ${done ? 'is-done' : ''}">
              <label>
                <input type="checkbox" data-task-toggle="${esc(task.id)}" ${done ? 'checked' : ''}>
                <span><strong>${esc(task.title)}</strong><small>${task.dogName ? `🐶 ${esc(task.dogName)} · ` : ''}${dueDate ? (dueDate === today ? 'Today' : esc(formatShortDate(dueDate))) : 'No due date'}</small></span>
              </label>
              <button type="button" data-task-delete="${esc(task.id)}" aria-label="Delete ${esc(task.title)}">×</button>
            </article>
          `;
        }).join('') : emptyHtml('✅', 'No tasks yet', 'Add a shared task for something that needs to be done around the house.', '＋ Add Task', 'add-task')}
      </div>
    `;

    host.querySelectorAll('[data-organiser-add-task], [data-organiser-action="add-task"]').forEach(button => button.addEventListener('click', openTaskModal));
    host.querySelectorAll('[data-task-toggle]').forEach(input => input.addEventListener('change', async () => {
      const item = findItem(input.dataset.taskToggle);
      if (!item) return;
      item.value = Object.assign({}, item.value || {}, { done: input.checked });
      input.disabled = true;
      try { await saveItem(item); } catch (error) { input.checked = !input.checked; input.disabled = false; toast(error.message, 'error'); }
    }));
    host.querySelectorAll('[data-task-delete]').forEach(button => button.addEventListener('click', async () => {
      if (!window.confirm('Delete this task?')) return;
      button.disabled = true;
      try { await deleteItem(button.dataset.taskDelete); } catch (error) { button.disabled = false; toast(error.message, 'error'); }
    }));
  }

  function renderActiveTab() {
    if (state.activeTab === 'overview') renderOverview();
    if (state.activeTab === 'shelves') renderAssignmentModule('shelf');
    if (state.activeTab === 'arrivals') renderPrep('arrival');
    if (state.activeTab === 'checkouts') renderPrep('checkout');
    if (state.activeTab === 'sleep') renderAssignmentModule('sleep_area');
    if (state.activeTab === 'tasks') renderTasks();
    updateTabCounts();
  }

  function updateTabCounts() {
    const counts = {
      shelves: itemsOf('shelf').length,
      arrivals: upcomingArrivals().length,
      checkouts: upcomingCheckouts().length,
      sleep: itemsOf('sleep_area').length,
      tasks: itemsOf('task').filter(item => !(item.value && item.value.done)).length
    };

    document.querySelectorAll('[data-organiser-tab]').forEach(button => {
      const tab = button.dataset.organiserTab;
      const base = button.dataset.baseLabel || button.textContent.replace(/\s+\d+$/, '');
      button.dataset.baseLabel = base;
      if (Object.prototype.hasOwnProperty.call(counts, tab) && counts[tab]) {
        button.innerHTML = `${esc(base)} <span>${counts[tab]}</span>`;
      } else {
        button.textContent = base;
      }
    });
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
    modal.querySelectorAll('[data-organiser-modal-close]').forEach(button => button.addEventListener('click', closeModal));
    return modal;
  }

  function openModal(html, onSubmit) {
    const modal = ensureModal();
    const content = modal.querySelector('#v11115ModalContent');
    content.innerHTML = html;
    modal.hidden = false;
    document.body.classList.add('v11115-modal-open');

    const form = content.querySelector('form');
    if (form && typeof onSubmit === 'function') {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]');
        if (submit) submit.disabled = true;
        try {
          await onSubmit(new FormData(form), form);
          closeModal();
        } catch (error) {
          if (submit) submit.disabled = false;
          const errorBox = form.querySelector('[data-modal-error]');
          if (errorBox) errorBox.textContent = error.message || 'Could not save.';
          else toast(error.message || 'Could not save.', 'error');
        }
      });
    }
  }

  function closeModal() {
    const modal = document.getElementById('v11115OrganiserModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('v11115-modal-open');
  }

  function openTargetModal(type, existing) {
    const isShelf = type === 'shelf';
    const item = existing || null;
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
        id: item ? item.id : '',
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
    const assignedCount = itemsOf(assignmentType).filter(assignment => assignment.value && assignment.value.targetId === id).length;

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
    const dogs = planningDogs();

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

  function openTaskModal() {
    const dogs = planningDogs();
    openModal(`
      <form class="v11115-modal-form">
        <span class="v11115-eyebrow">DAILY TASK</span>
        <h2 id="v11115ModalTitle">Add Task</h2>
        <label>What needs to be done?<input name="title" required maxlength="160" placeholder="e.g. Pack Waffle's medication"></label>
        <label>Dog <span>(optional)</span><select name="stayKey"><option value="">General house task</option>${dogs.map(dog => `<option value="${esc(dog.stayKey)}">${esc(dog.dogName)}</option>`).join('')}</select></label>
        <label>Due date <span>(optional)</span><input name="dueDate" type="date"></label>
        <div class="v11115-modal-error" data-modal-error></div>
        <div class="v11115-modal-actions"><button type="button" data-organiser-modal-close>Cancel</button><button type="submit">Add Task</button></div>
      </form>
    `, async data => {
      const stayKey = String(data.get('stayKey') || '');
      const dog = dogs.find(entry => String(entry.stayKey) === stayKey);
      await saveItem({
        type: 'task',
        title: String(data.get('title') || '').trim(),
        stayKey,
        dogName: dog ? dog.dogName || '' : '',
        value: { dueDate: String(data.get('dueDate') || ''), done: false }
      });
    });

    document.querySelectorAll('#v11115OrganiserModal [data-organiser-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  }

  function setLoading(loading) {
    state.loading = loading;
    const root = document.getElementById('v11115OrganiserRoot');
    if (root) root.classList.toggle('is-loading', loading);
    const refresh = document.querySelector('[data-organiser-refresh]');
    if (refresh) {
      refresh.disabled = loading;
      refresh.textContent = loading ? '↻ Updating…' : '↻ Refresh';
    }
  }

  async function loadOrganiser(options) {
    if (state.loading) return;
    const now = Date.now();
    if (!options || !options.force) {
      if (state.lastLoadedAt && now - state.lastLoadedAt < 60000) return;
    }

    setLoading(true);
    try {
      const responses = await Promise.all([
        query({ action: 'get_organiser' }),
        query({ action: 'get_guest_directory' })
      ]);

      const organiser = responses[0] || {};
      const directory = responses[1] || {};
      state.items = Array.isArray(organiser.items) ? organiser.items : [];
      state.bookings = Array.isArray(directory.bookings) ? directory.bookings : [];
      state.lastLoadedAt = Date.now();
      renderActiveTab();
    } catch (error) {
      toast(error.message || 'Could not load the organiser.', 'error');
      const host = document.querySelector(`[data-organiser-view="${state.activeTab}"]`);
      if (host && state.activeTab !== 'notes') {
        host.innerHTML = emptyHtml('⚠️', 'Organiser could not be refreshed', 'Check the connection and try Refresh again.', '', '');
      }
    } finally {
      setLoading(false);
    }
  }

  function wireResumeRefresh() {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
