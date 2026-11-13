(() => {
  'use strict';
  const storageKey = 'palz-stay:sales:v1';
  const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
  const dates = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const validId = value => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value || '');
  const money = cents => currency.format(cents / 100);
  const paid = record => record?.payments.reduce((sum, item) => sum + item.cents, 0) || 0;
  const stayNights = stay => Math.max(1, Math.round((Date.parse(stay.endDate) - Date.parse(stay.startDate)) / 86400000));
  const stayDates = stay => dates.format(new Date(stay.startDate)) + ' – ' + dates.format(new Date(stay.endDate));
  const cents = value => /^\d{1,6}(?:\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : 0;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
  const recent = new Map();
  let dialog, opener, chosenId = '', month = today().slice(0, 7), mode = 'price';
  let showing = 'due', calendarMonth = '', isMaster = false, masterCsv;

  function read() {
    const records = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (!records || typeof records !== 'object' || Array.isArray(records)) throw Error('Sales records could not be read.');
    return records;
  }

  function confirmedRows() {
    const core = window.WAFFLE_PHASE4_CORE;
    return (core?.rows(isMaster ? masterCsv : undefined) || []).filter(row => {
      // Older confirmed boarding rows predate the Booking Type field.
      const boarding = !row.bookingType || core.confirmed(row);
      return boarding && Number.isFinite(Date.parse(row.startDate)) && Number.isFinite(Date.parse(row.endDate));
    });
  }

  function stays() {
    const rows = confirmedRows().filter(row => validId(row.stayId));
    const counts = new Map();
    rows.forEach(row => {
      const id = row.stayId.toLowerCase();
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    const result = new Map(recent);
    rows.forEach(row => {
      const id = row.stayId.toLowerCase();
      if (counts.get(id) !== 1) { result.delete(id); return; }
      result.set(id, {...row, stayId: id});
    });
    return result;
  }

  function mount() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'palz-sales';
    dialog.setAttribute('aria-labelledby', 'palz-sales-title');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = '<header><h1 id="palz-sales-title">Sales</h1><button type="button" data-sales-close aria-label="Close Sales">×</button></header>' +
      '<div class="palz-sales-body"><p class="palz-sales-local">Sales records are saved in this browser.</p>' +
      '<label class="palz-sales-month">Reporting month <input type="month" aria-label="Reporting month"></label>' +
      '<div data-sales-totals class="palz-sales-totals"></div>' +
      '<div class="palz-sales-list-head"><h2>Stays</h2><button type="button" data-sales-filter>Sales history</button></div>' +
      '<div data-sales-master-filters class="palz-sales-fields" hidden><label>Find a stay<input type="search" data-sales-master-search placeholder="Pet, owner or Pet ID"></label><label>Stay period<select data-sales-master-period><option value="">All stays</option><option>Past</option><option>Current</option><option>Future</option></select></label></div>' +
      '<p data-sales-master-status role="status" hidden></p><div data-sales-list></div>' +
      '<form data-sales-form><h2>Manage a stay</h2><label>Confirmed stay<select name="stay"></select></label>' +
      '<details data-sales-calendar hidden><summary>Stay calendar</summary><div data-sales-calendar-content></div></details><div data-sales-editor></div><p data-sales-status role="status"></p></form></div>';
    document.body.append(dialog);
    dialog.querySelector('[data-sales-close]').onclick = () => dialog.close();
    dialog.addEventListener('close', () => opener?.focus());
    dialog.querySelector('input[type=month]').addEventListener('change', event => { month = event.target.value || today().slice(0, 7); render(); });
    dialog.querySelector('[data-sales-master-search]').oninput = () => renderMaster(read());
    dialog.querySelector('[data-sales-master-period]').onchange = () => renderMaster(read());
    dialog.querySelector('[data-sales-filter]').onclick = () => { showing = showing === 'due' ? 'all' : 'due'; render(); };
    dialog.querySelector('[name=stay]').onchange = event => {
      chosenId = event.target.value;
      calendarMonth = '';
      mode = 'price';
      renderEditor();
    };
    dialog.addEventListener('click', event => {
      const step = event.target.closest('[data-sales-calendar-step]');
      if (step) {
        const [year, currentMonth] = calendarMonth.split('-').map(Number);
        calendarMonth = new Date(Date.UTC(year, currentMonth - 1 + Number(step.dataset.salesCalendarStep), 1)).toISOString().slice(0, 7);
        renderStayCalendar(stays().get(chosenId) || read()[chosenId]);
        const sameDirection = dialog.querySelector('[data-sales-calendar-step="' + step.dataset.salesCalendarStep + '"]');
        (sameDirection.disabled ? dialog.querySelector('[data-sales-calendar-step]:enabled') : sameDirection)?.focus();
        return;
      }
      const action = event.target.closest('[data-sales-select], [data-sales-mode], [data-sales-reminder]');
      if (!action) return;
      if (action.hasAttribute('data-sales-reminder')) { void copyReminder(action.dataset.salesReminder); return; }
      if (action.dataset.salesSelect) {
        if (chosenId !== action.dataset.salesSelect) calendarMonth = '';
        chosenId = action.dataset.salesSelect;
        dialog.querySelector('[name=stay]').value = chosenId;
      }
      mode = action.dataset.salesMode || 'payment';
      renderEditor();
      if (action.hasAttribute('data-sales-show-calendar')) {
        const calendar = dialog.querySelector('[data-sales-calendar]');
        calendar.open = true;
        calendar.querySelector('summary').focus();
      } else {
        dialog.querySelector('[data-sales-editor] input')?.focus();
      }
    });
    dialog.querySelector('form').addEventListener('submit', save);
  }

  function renderHistory(entries, bookings) {
    if (!entries.length) return '<p class="palz-sales-empty">No priced stays yet.</p>';
    const rows = entries.map(([id, record]) => ({id, record, stay: bookings.get(id) || record}))
      .sort((a, b) => b.stay.startDate.localeCompare(a.stay.startDate) || a.stay.dogName.localeCompare(b.stay.dogName));
    return '<div class="palz-sales-table" role="region" aria-label="Sales history table" tabindex="0"><table>' +
      '<thead><tr><th scope="col">Stay</th><th scope="col">Total</th><th scope="col">Received</th><th scope="col">Balance</th><th scope="col">Actions</th></tr></thead><tbody>' +
      rows.map(({id, record, stay}) => {
        const received = paid(record);
        return '<tr><th scope="row">'+esc(stay.dogName)+'<small>'+esc(stayDates(stay))+'</small></th>' +
          '<td>'+money(record.total)+'</td><td>'+money(received)+'</td><td>'+money(record.total - received)+'</td><td>' +
          '<button type="button" data-sales-select="'+esc(id)+'" data-sales-mode="price" aria-label="Edit sale for '+esc(stay.dogName)+'">Edit</button> ' +
          '<button type="button" data-sales-select="'+esc(id)+'" data-sales-show-calendar aria-label="View stay calendar for '+esc(stay.dogName)+'">Calendar</button></td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  function renderStayCalendar(stay) {
    const host = dialog.querySelector('[data-sales-calendar]');
    host.hidden = !stay;
    if (!stay) { host.open = false; return; }
    const first = stay.startDate.slice(0, 7), last = stay.endDate.slice(0, 7);
    if (!calendarMonth || calendarMonth < first || calendarMonth > last) calendarMonth = first;
    const [year, monthNumber] = calendarMonth.split('-').map(Number);
    const date = new Date(Date.UTC(year, monthNumber - 1, 1));
    const caption = new Intl.DateTimeFormat('en-AU', {month:'long', year:'numeric', timeZone:'UTC'}).format(date);
    const leading = (date.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const cells = Array.from({length: leading + days}, (_, index) => {
      const day = index - leading + 1;
      if (day < 1) return '<span aria-hidden="true"></span>';
      const key = calendarMonth + '-' + String(day).padStart(2, '0');
      const start = key === stay.startDate, end = key === stay.endDate;
      const label = start && end ? 'Check-in and check-out' : start ? 'Check-in' : end ? 'Check-out' : '';
      const inStay = key >= stay.startDate && key <= stay.endDate;
      return '<time datetime="'+key+'"'+(inStay ? ' class="is-stay'+(label ? ' is-endpoint' : '')+'"' : '')+
        (label ? ' aria-label="'+label+' '+dates.format(new Date(key))+'"' : '')+'>'+day+'</time>';
    }).join('');
    host.querySelector('[data-sales-calendar-content]').innerHTML =
      '<div class="palz-sales-calendar-nav"><button type="button" data-sales-calendar-step="-1" aria-label="Previous stay month"'+(calendarMonth === first ? ' disabled' : '')+'>‹</button>' +
      '<strong aria-live="polite">'+caption+'</strong><button type="button" data-sales-calendar-step="1" aria-label="Next stay month"'+(calendarMonth === last ? ' disabled' : '')+'>›</button></div>' +
      '<div class="palz-sales-calendar-days" aria-label="'+caption+'">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>'<span class="palz-sales-weekday">'+day+'</span>').join('')+cells+'</div>' +
      '<small>Check-in '+dates.format(new Date(stay.startDate))+' · Check-out '+dates.format(new Date(stay.endDate))+'</small>';
  }

  function renderMaster(records) {
    const query = dialog.querySelector('[data-sales-master-search]').value.trim().toLowerCase();
    const filter = dialog.querySelector('[data-sales-master-period]').value;
    const now = today();
    const rows = confirmedRows().map(stay => {
      const id = String(stay.stayId || '').toLowerCase();
      const period = stay.endDate < now ? 'Past' : stay.startDate > now ? 'Future' : 'Current';
      return {stay, id, period, record: records[id]};
    }).filter(({stay, period}) => (!filter || period === filter) &&
      [stay.dogName, stay.ownerName, stay.dogNumber].some(value => String(value || '').toLowerCase().includes(query)));
    const editable = stays();
    const output = dialog.querySelector('[data-sales-list]');
    if (!rows.length) {
      output.innerHTML = '<p class="palz-sales-empty">No matching confirmed stays.</p>';
      return;
    }
    rows.sort((a, b) => b.stay.startDate.localeCompare(a.stay.startDate));
    output.innerHTML = '<div class="palz-sales-table" role="region" aria-label="Sales Master Table" tabindex="0"><table>' +
      '<thead><tr><th scope="col">Stay</th><th scope="col">Action</th><th scope="col">Period</th><th scope="col">Price</th><th scope="col">Expenses</th><th scope="col">Received</th><th scope="col">Balance</th></tr></thead><tbody>' +
      rows.map(({stay, id, period, record}) => {
        const received = paid(record);
        return '<tr><th scope="row">'+esc(stay.dogName)+'<small>'+esc(stayDates(stay))+(stay.ownerName ? ' · '+esc(stay.ownerName) : '')+'</small></th>' +
          '<td>'+(editable.has(id) ? '<button type="button" data-sales-select="'+esc(id)+'" data-sales-mode="price" aria-label="'+(record ? 'Edit costs for ' : 'Set costs for ')+esc(stay.dogName)+'">'+(record ? 'Edit costs' : 'Set costs')+'</button>' : '<small>Stay ID required</small>')+'</td>' +
          '<td>'+period+'</td><td>'+(record?.total ? money(record.total) : 'Unpriced')+'</td><td>'+(record ? money(record.expenses || 0) : '—')+'</td><td>'+(record ? money(received) : '—')+'</td><td>'+(record ? money(record.total - received) : '—')+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  async function refreshMaster() {
    const notice = dialog.querySelector('[data-sales-master-status]');
    notice.textContent = 'Refreshing confirmed stays…';
    try {
      masterCsv = await fetchSpreadsheetCsv();
      if (isMaster && dialog.open) {
        if (chosenId) renderMaster(read());
        else render();
      }
      notice.textContent = '';
    } catch (_) {
      notice.textContent = 'Could not refresh stays. Showing the saved booking list.';
    }
  }

  function render() {
    const records = read();
    const bookings = stays();
    const entries = Object.entries(records);
    const booked = entries.filter(([id, record]) => (bookings.get(id)?.startDate || record.startDate).startsWith(month)).reduce((sum, [, record]) => sum + record.total, 0);
    const received = entries.flatMap(([, record]) => record.payments).filter(item => item.date.startsWith(month)).reduce((sum, item) => sum + item.cents, 0);
    const outstanding = entries.reduce((sum, [, record]) => sum + record.total - paid(record), 0);
    dialog.querySelector('input[type=month]').value = month;
    dialog.querySelector('[data-sales-totals]').innerHTML = [
      ['Confirmed sales', booked], ['Payments received', received], ['Outstanding · all stays', outstanding]
    ].map(([label, amount]) => '<div><span>'+label+'</span><strong>'+money(amount)+'</strong></div>').join('');
    dialog.querySelector('[data-sales-filter]').textContent = showing === 'due' ? 'Sales history' : 'Back to balances';
    dialog.querySelector('.palz-sales-list-head h2').textContent = showing === 'due' ? 'Balances due' : 'Sales history';
    if (isMaster) renderMaster(records);
    const list = entries.filter(([, record]) => record.total > paid(record))
      .sort(([, a], [, b]) => a.dueDate.localeCompare(b.dueDate));
    if (!isMaster) dialog.querySelector('[data-sales-list]').innerHTML = showing === 'all' ? renderHistory(entries.filter(([, record]) => record.total > 0), bookings) : list.length ? list.map(([id, record]) => {
      const stay = bookings.get(id) || record;
      const balance = record.total - paid(record);
      const status = !balance ? 'Paid' : record.channel === 'marketplace' ? 'Payout pending' : record.dueDate < today() ? 'Overdue' : paid(record) ? 'Part paid' : 'Payment due';
      return '<article class="palz-sales-row"><div><strong>'+esc(stay.dogName)+'</strong><small>'+esc(stayDates(stay))+'</small></div><div><strong>'+money(balance)+'</strong><small>'+status+'</small></div><div class="palz-sales-row-actions"><button type="button" data-sales-select="'+esc(id)+'" data-sales-mode="'+(balance ? 'payment' : 'price')+'">'+(balance ? record.channel === 'marketplace' ? 'Record payout' : 'Record payment' : 'View')+'</button>' +
        (balance && record.channel === 'direct' ? '<button type="button" data-sales-reminder="'+esc(id)+'">Copy reminder</button>' : '')+'</div></article>';
    }).join('') : '<p class="palz-sales-empty">No outstanding balances.</p>';
    const choices = new Map([...entries.map(([id, record]) => [id, record]), ...bookings]);
    dialog.querySelector('[name=stay]').innerHTML = '<option value="">Choose a stay</option>' +
      [...choices].sort(([, a], [, b]) => b.startDate.localeCompare(a.startDate)).map(([id, stay]) =>
        '<option value="'+esc(id)+'">'+esc(stay.dogName)+' · '+esc(stayDates(stay))+'</option>').join('');
    dialog.querySelector('[name=stay]').value = chosenId;
    renderEditor();
  }

  function renderEditor() {
    const host = dialog.querySelector('[data-sales-editor]');
    host.oninput = null;
    const record = read()[chosenId];
    const stay = stays().get(chosenId) || record;
    dialog.querySelector('[data-sales-status]').textContent = '';
    renderStayCalendar(stay);
    if (!stay) { host.innerHTML = ''; return; }
    const summary = record ? '<p><strong>'+money(record.total - paid(record))+' outstanding</strong> · '+money(paid(record))+' received</p>' : '';
    const history = record?.payments.length ? '<details><summary>Payment history</summary><ul>'+record.payments.map(item => '<li>'+money(item.cents)+' · '+esc(item.method)+' · '+esc(item.date)+'</li>').join('')+'</ul></details>' : '';
    if (mode === 'payment' && record && record.total > paid(record)) {
      host.innerHTML = summary + '<div class="palz-sales-fields"><label>Amount (AUD)<input name="amount" inputmode="decimal" required value="'+((record.total-paid(record))/100).toFixed(2)+'"></label><label>Payment date<input name="date" type="date" required max="'+today()+'" value="'+today()+'"></label><label>Method<select name="method">'+(record.channel === 'marketplace' ? '<option>Marketplace payout</option>' : '<option>Bank transfer</option><option>Cash</option><option>Other</option>')+'</select></label></div><div class="palz-sales-actions"><button type="submit" class="palz-sales-primary">Save '+(record.channel === 'marketplace' ? 'payout' : 'payment')+'</button><button type="button" data-sales-mode="price">Edit price</button></div>'+history;
      return;
    }
    mode = 'price';
    host.innerHTML = summary + '<div class="palz-sales-fields"><label>Payment source<select name="channel"><option value="direct">Direct from owner</option><option value="marketplace"'+(record?.channel === 'marketplace' ? ' selected' : '')+'>Marketplace payout</option></select></label><label>Price type<select name="priceType"><option value="fixed">Fixed total</option><option value="nightly"'+(record?.priceType === 'nightly' ? ' selected' : '')+'>Nightly rate</option></select></label><label>Price (AUD)<input name="amount" inputmode="decimal" required value="'+(record?.rate ? (record.rate/100).toFixed(2) : '')+'"></label><label>Due date<input name="date" type="date" required value="'+esc(record?.dueDate || stay.endDate)+'"></label></div><p data-sales-preview></p><div data-sales-expenses></div><div class="palz-sales-actions"><button type="submit" class="palz-sales-primary">Save price</button>'+(record && record.total > paid(record) ? '<button type="button" data-sales-mode="payment">Record '+(record.channel === 'marketplace' ? 'payout' : 'payment')+'</button>' : '')+'</div>'+history;
    if (isMaster) {
      host.querySelector('[name=amount]').required = false;
      host.querySelector('[data-sales-expenses]').innerHTML = '<div class="palz-sales-fields"><label>Stay expenses (AUD)<input name="expenses" inputmode="decimal" value="'+(record?.expenses ? (record.expenses/100).toFixed(2) : '')+'"></label><label>Bookkeeping note<input name="bookkeepingNote" maxlength="240" value="'+esc(record?.bookkeepingNote || '')+'"></label></div>';
    }
    const form = dialog.querySelector('form');
    const preview = () => {
      const count = form.elements.priceType.value === 'nightly' ? stayNights(stay) : 1;
      host.querySelector('[data-sales-preview]').textContent = 'Total '+money(cents(form.elements.amount.value.trim()) * count)+(count > 1 ? ' · '+count+' nights' : '');
    };
    host.oninput = preview;
    preview();
  }

  function status(message) { dialog.querySelector('[data-sales-status]').textContent = message; }

  async function save(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const id = chosenId, action = mode, amount = cents(String(values.get('amount') || '').trim()), date = String(values.get('date') || '');
    const submit = event.submitter;
    const expenseInput = values.get('expenses');
    const expenseText = String(expenseInput || '').trim();
    if (expenseText && !/^\d{1,6}(?:\.\d{1,2})?$/.test(expenseText)) { status('Enter a valid expense amount in AUD.'); return; }
    const priceText = String(values.get('amount') || '').trim();
    const expensesOnly = isMaster && action === 'price' && !priceText && cents(expenseText) > 0;
    if (!validId(id) || (!amount && !expensesOnly) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { status('Enter a valid amount and date.'); return; }
    if (submit) submit.disabled = true;
    const write = () => {
      const records = read();
      const previous = records[id];
      const stay = stays().get(id) || previous;
      if (!stay) throw Error('This confirmed stay could not be found.');
      if (action === 'payment') {
        if (!previous || date > today() || amount > previous.total - paid(previous)) throw Error('Check the payment date and outstanding balance.');
        previous.payments.push({cents: amount, date, method: String(values.get('method'))});
      } else {
        const priceType = values.get('priceType') === 'nightly' ? 'nightly' : 'fixed';
        const total = amount * (priceType === 'nightly' ? stayNights(stay) : 1);
        if (total < paid(previous)) throw Error('The total cannot be below payments already recorded.');
        records[id] = {dogName: stay.dogName, startDate: stay.startDate, endDate: stay.endDate,
          channel: values.get('channel') === 'marketplace' ? 'marketplace' : 'direct',
          priceType, rate: amount, total, dueDate: date, payments: previous?.payments || [],
          expenses: expenseInput === null ? previous?.expenses || 0 : cents(expenseText),
          bookkeepingNote: values.has('bookkeepingNote') ? String(values.get('bookkeepingNote')).trim().slice(0, 240) : previous?.bookkeepingNote || ''};
      }
      localStorage.setItem(storageKey, JSON.stringify(records));
    };
    try {
      if (navigator.locks) await navigator.locks.request(storageKey, write);
      else write();
      render();
      status(action === 'payment' ? 'Payment recorded.' : expensesOnly ? 'Expenses saved.' : 'Price saved.');
      updateLinks();
    } catch (error) { status(error.message || 'Sales record could not be saved.'); }
    finally { if (submit) submit.disabled = false; }
  }

  async function copyReminder(id) {
    const record = read()[id];
    if (!record) return;
    const stay = stays().get(id) || record;
    const text = 'Hi, a quick reminder that '+money(record.total-paid(record))+' is outstanding for '+stay.dogName+'’s stay ('+stayDates(stay)+'). Thank you!';
    try { await navigator.clipboard.writeText(text); status('Reminder copied.'); }
    catch (_) { status(text); }
  }

  function open(stay, trigger, master = false) {
    mount();
    isMaster = master;
    dialog.dataset.salesView = master ? 'master' : 'standard';
    dialog.querySelector('#palz-sales-title').textContent = master ? 'Sales Master Table' : 'Sales';
    dialog.querySelector('[data-sales-master-filters]').hidden = !master;
    dialog.querySelector('[data-sales-master-status]').hidden = !master;
    opener = trigger;
    if (stay && validId(stay.stayId) && stay.dogName && stay.startDate && stay.endDate) {
      recent.set(stay.stayId.toLowerCase(), {...stay, stayId: stay.stayId.toLowerCase()});
    }
    chosenId = String(stay?.stayId || '').toLowerCase();
    calendarMonth = '';
    dialog.querySelector('[data-sales-calendar]').open = false;
    mode = 'payment';
    try { render(); } catch (_) { status('Sales records could not be read in this browser.'); }
    if (!dialog.open) dialog.showModal();
    if (master) void refreshMaster();
  }

  function updateLinks() {
    let records;
    try { records = read(); } catch (_) { return; }
    document.querySelectorAll('.directory-card.is-profile-active[data-directory-stay-id] [data-v110-operation-bar], .v10-agenda-checkout-controls').forEach(host => {
      const card = host.closest('.directory-card');
      const checkout = host.querySelector('[data-today-action="checkout"]');
      const id = String(card?.dataset.directoryStayId || checkout?.dataset.todayStayId || '').toLowerCase();
      if (!validId(id)) return;
      const record = records[id];
      if (checkout && !record?.total) {
        host.querySelector('[data-sales-stay]')?.remove();
        return;
      }
      const label = record?.total ? record.total === paid(record) ? 'Paid' : money(record.total-paid(record))+(record.channel === 'marketplace' ? ' payout pending' : ' due') : 'Set price';
      let button = host.querySelector('[data-sales-stay]');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'palz-sales-link';
        button.dataset.salesStay = id;
        host.append(button);
      }
      if (button.dataset.salesStay !== id) button.dataset.salesStay = id;
      if (button.textContent !== label) button.textContent = label;
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('a[href="#sales"], [data-sales-stay], [data-sales-master-open]');
    if (!button) return;
    event.preventDefault();
    const id = button.dataset.salesStay;
    if (!id) { open(null, button, button.hasAttribute('data-sales-master-open')); return; }
    const card = button.closest('.directory-card');
    open(stays().get(id) || (card ? { stayId:id, dogName:card.dataset.directoryDogName, startDate:card.dataset.directoryStartDate, endDate:card.dataset.directoryEndDate } : { stayId:id }), button);
  });
  let scheduled = false;
  new MutationObserver(records => {
    const relevant = '.directory-card, #v10TodayAgenda';
    if (scheduled || !records.some(record =>
      !record.target.closest?.('[data-sales-stay]') && (
        record.target.closest?.(relevant) ||
        Array.from(record.addedNodes).some(node => node.matches?.(relevant) || node.querySelector?.(relevant))
      )
    )) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; updateLinks(); });
  }).observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});
  window.addEventListener('storage', event => { if (event.key === storageKey) { updateLinks(); if (dialog?.open) status('Sales changed in another tab. Reopen Sales to refresh.'); } });
  function attachPrice(host, booking, result) {
    const id = result?.stayId || result?.booking?.stayId;
    if (!host || result?.queued || result?.result !== 'success' || !validId(id)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'palz-sales-link';
    button.textContent = 'Set stay price';
    button.onclick = () => open({stayId:id, dogName:booking.dogName, startDate:booking.startDate, endDate:booking.endDate}, button);
    host.append(button);
  }

  window.PALZ_SALES = Object.freeze({attachPrice});
  updateLinks();
})();
