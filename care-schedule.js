(() => {
  'use strict';
  const labels = {feeding:'Feeding',walk:'Walk',medication:'Medication'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const identity = card => ({stayId:card.dataset.directoryStayId,dogId:card.dataset.directoryDogId,stayKey:card.dataset.directoryStayKey});
  async function request(action, values = {}, write = false) {
    const response = await (write ? window.sendPayloadToAppsScript : window.queryAppsScript)({action,...values});
    if (response?.result !== 'success' || response.queued) throw Error(response?.error || 'Could not confirm this change. Reopen to check.');
    return response;
  }

  function mountPlan(card, log) {
    const id = identity(card);
    if (!id.stayId || !id.dogId || card.dataset.v1082PastStay === 'true' || log.querySelector('[data-care-schedule-plan]')) return;
    const details = document.createElement('details');
    details.dataset.careSchedulePlan = '';
    details.className = 'palz-care-schedule';
    details.innerHTML = '<summary>Care schedule</summary><form hidden><div data-care-slots></div><button type="button" data-care-add>Add time</button><label data-care-medication-review hidden><input type="checkbox"> Medication times reviewed by sitter</label><button type="submit">Save schedule</button></form><p role="status"></p>';
    log.append(details);
    const form = details.querySelector('form'), list = details.querySelector('[data-care-slots]');
    const review = details.querySelector('[data-care-medication-review]'), status = details.querySelector('[role=status]');
    let schedule, busy = false;
    const updateReview = () => { review.hidden = ![...list.querySelectorAll('select')].some(field => field.value === 'medication'); };
    function addSlot(slot = {}) {
      if (list.children.length >= 18) return;
      const row = document.createElement('div');
      row.className = 'palz-care-slot';
      row.innerHTML = '<select aria-label="Activity">'+Object.entries(labels).map(([key,label]) => '<option value="'+key+'">'+label+'</option>').join('')+'</select><input type="time" aria-label="Time" required><button type="button" aria-label="Remove time">×</button>';
      row.querySelector('select').value = slot.type || 'feeding';
      row.querySelector('input').value = slot.time || '';
      row.querySelector('button').onclick = () => { row.remove(); updateReview(); };
      list.append(row);
      updateReview();
    }
    details.addEventListener('toggle', async () => {
      if (!details.open || schedule || busy) return;
      busy = true;
      status.textContent = 'Loading schedule…';
      try {
        ({schedule} = await request('get_care_schedule',id));
        schedule.slots.forEach(addSlot);
        form.hidden = false;
        status.textContent = '';
      } catch (error) { status.textContent = error.message; }
      finally { busy = false; }
    });
    list.onchange = updateReview;
    form.querySelector('[data-care-add]').onclick = () => addSlot();
    form.onsubmit = async event => {
      event.preventDefault();
      if (busy || !schedule) return;
      busy = true;
      const submit = event.submitter;
      submit.disabled = true;
      const slots = [...list.children].map(row => ({type:row.querySelector('select').value,time:row.querySelector('input').value}));
      try {
        ({schedule} = await request('save_care_schedule',{...id,slots,expectedRevision:schedule.revision,
          medicationConfirmed:review.querySelector('input').checked},true));
        status.textContent = 'Schedule saved.';
      } catch (error) { status.textContent = error.message; }
      finally { busy = false; submit.disabled = false; }
    };
  }

  let scheduled = false;
  function scan() {
    scheduled = false;
    document.querySelectorAll('.directory-card.is-profile-active [data-care-routine-log]').forEach(log => mountPlan(log.closest('.directory-card'),log));
  }
  if (document.body.dataset.wafflePage === 'directory') {
    new MutationObserver(() => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(scan); }
    }).observe(document.body,{childList:true,subtree:true});
    scan();
  }

  const agenda = document.querySelector('#v10TodayAgenda');
  if (!agenda || document.body.dataset.wafflePage !== 'calendar') return;
  const todayCare = document.createElement('details');
  todayCare.className = 'palz-care-schedule';
  todayCare.dataset.palzTodayWork = '0';
  todayCare.hidden = true;
  todayCare.innerHTML = '<summary>Scheduled care</summary><div data-care-today-list></div><p role="status"></p>';
  agenda.after(todayCare);
  const list = todayCare.querySelector('[data-care-today-list]'), status = todayCare.querySelector('[role=status]');
  let tasks = [], busy = false;
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      ({tasks} = await request('get_today_care_schedule'));
      todayCare.hidden = !tasks.length;
      const remaining = tasks.filter(task => !task.completedAt).length;
      todayCare.dataset.palzTodayWork = String(remaining);
      window.updatePalzTodayActionsAlert?.();
      const title = 'Scheduled care'+(remaining ? ' · '+remaining+' remaining' : '');
      const summary = todayCare.querySelector('summary');
      if (summary.textContent !== title) summary.textContent = title;
      const markup = tasks.map(task => '<div class="palz-care-slot"><span><strong>'+esc(task.dogName)+'</strong><small>'+labels[task.type]+' · '+esc(task.time)+(task.overdue ? ' · Overdue' : '')+'</small></span>'+
        (task.completedAt ? '<small>Completed '+esc(new Date(task.completedAt).toLocaleTimeString('en-AU',{timeZone:'Australia/Sydney',hour:'numeric',minute:'2-digit'}))+'</small>' : '<button type="button" data-care-done="'+esc(task.eventId)+'" aria-label="Mark '+esc(labels[task.type])+' complete for '+esc(task.dogName)+'">Done</button>')+'</div>').join('');
      if (list.dataset.rendered !== markup) { list.dataset.rendered = markup; list.innerHTML = markup; }
    } catch (error) { if (!todayCare.hidden) status.textContent = error.message; }
    finally { busy = false; }
  }
  list.onclick = async event => {
    const button = event.target.closest('[data-care-done]');
    const task = tasks.find(row => row.eventId === button?.dataset.careDone);
    if (!task || busy) return;
    busy = true;
    button.disabled = true;
    try {
      await request('complete_scheduled_care',{stayId:task.stayId,dogId:task.dogId,eventId:task.eventId},true);
      status.textContent = 'Care activity recorded.';
    } catch (error) { status.textContent = error.message; }
    finally { busy = false; button.disabled = false; void refresh(); }
  };
  window.addEventListener('waffle:stay-operation-updated',refresh);
  document.addEventListener('visibilitychange',refresh);
  setInterval(refresh,60000);
  void refresh();

  const arrivals = document.createElement('details');
  arrivals.className = 'palz-care-schedule';
  arrivals.dataset.palzTodayWork = '0';
  arrivals.hidden = true;
  arrivals.innerHTML = '<summary>Before arrival</summary><div></div>';
  todayCare.after(arrivals);
  let arrivalsPending = false;
  async function refreshArrivals() {
    if (arrivalsPending || document.hidden) return;
    arrivalsPending = true;
    try {
      const {checks} = await request('get_prearrival_checks');
      arrivals.hidden = !checks.length;
      arrivals.dataset.palzTodayWork = String(checks.length);
      window.updatePalzTodayActionsAlert?.();
      arrivals.querySelector('summary').textContent = 'Before arrival · '+checks.length+' to review';
      arrivals.querySelector('div').innerHTML = checks.map(check => {
        const href = 'directory.html?'+new URLSearchParams({stayKey:check.stayKey,stayId:check.stayId,dogId:check.dogId,pet:'1'});
        return '<div class="palz-care-slot"><span><strong>'+esc(check.dogName)+'</strong><small>'+esc(check.startDate)+' · '+esc(check.needs.join(' · '))+'</small></span><a href="'+esc(href)+'">Review</a></div>';
      }).join('');
    } catch (_) { /* Keep the last displayed checklist if a refresh fails. */ }
    finally { arrivalsPending = false; }
  }
  window.addEventListener('waffle:stay-operation-updated',refreshArrivals);
  document.addEventListener('visibilitychange',() => { if (!document.hidden) void refreshArrivals(); });
  setInterval(refreshArrivals,300000);
  void refreshArrivals();
})();
