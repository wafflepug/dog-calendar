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
  let showing = 'due';

  function read() {
    const records = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (!records || typeof records !== 'object' || Array.isArray(records)) throw Error('Sales records could not be read.');
    return records;
  }

  function stays() {
    const core = window.WAFFLE_PHASE4_CORE;
    const rows = (core?.rows() || []).filter(row => core.confirmed(row) && validId(row.stayId));
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
      '<div class="palz-sales-list-head"><h2>Stays</h2><button type="button" data-sales-filter>Show all priced stays</button></div>' +
      '<div data-sales-list></div>' +
      '<form data-sales-form><h2>Manage a stay</h2><label>Confirmed stay<select name="stay"></select></label>' +
      '<div data-sales-editor></div><p data-sales-status role="status"></p></form></div>';
    document.body.append(dialog);
    dialog.querySelector('[data-sales-close]').onclick = () => dialog.close();
    dialog.addEventListener('close', () => opener?.focus());
    dialog.querySelector('input[type=month]').addEventListener('change', event => { month = event.target.value || today().slice(0, 7); render(); });
    dialog.querySelector('[data-sales-filter]').onclick = () => { showing = showing === 'due' ? 'all' : 'due'; render(); };
    dialog.querySelector('[name=stay]').onchange = event => { chosenId = event.target.value; mode = 'price'; renderEditor(); };
    dialog.addEventListener('click', event => {
      const action = event.target.closest('[data-sales-select], [data-sales-mode], [data-sales-reminder]');
      if (!action) return;
      if (action.hasAttribute('data-sales-reminder')) { void copyReminder(action.dataset.salesReminder); return; }
      if (action.dataset.salesSelect) {
        chosenId = action.dataset.salesSelect;
        dialog.querySelector('[name=stay]').value = chosenId;
      }
      mode = action.dataset.salesMode || 'payment';
      renderEditor();
      dialog.querySelector('[data-sales-editor] input')?.focus();
    });
    dialog.querySelector('form').addEventListener('submit', save);
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
    dialog.querySelector('[data-sales-filter]').textContent = showing === 'due' ? 'Show all priced stays' : 'Show balances due';
    const list = entries.filter(([, record]) => showing === 'all' || record.total > paid(record))
      .sort(([, a], [, b]) => a.dueDate.localeCompare(b.dueDate));
    dialog.querySelector('[data-sales-list]').innerHTML = list.length ? list.map(([id, record]) => {
      const stay = bookings.get(id) || record;
      const balance = record.total - paid(record);
      const status = !balance ? 'Paid' : record.channel === 'marketplace' ? 'Payout pending' : record.dueDate < today() ? 'Overdue' : paid(record) ? 'Part paid' : 'Payment due';
      return '<article class="palz-sales-row"><div><strong>'+esc(stay.dogName)+'</strong><small>'+esc(stayDates(stay))+'</small></div><div><strong>'+money(balance)+'</strong><small>'+status+'</small></div><div class="palz-sales-row-actions"><button type="button" data-sales-select="'+esc(id)+'" data-sales-mode="'+(balance ? 'payment' : 'price')+'">'+(balance ? record.channel === 'marketplace' ? 'Record payout' : 'Record payment' : 'View')+'</button>' +
        (balance && record.channel === 'direct' ? '<button type="button" data-sales-reminder="'+esc(id)+'">Copy reminder</button>' : '')+'</div></article>';
    }).join('') : '<p class="palz-sales-empty">'+(showing === 'due' ? 'No outstanding balances.' : 'No priced stays yet.')+'</p>';
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
    if (!stay) { host.innerHTML = ''; return; }
    const summary = record ? '<p><strong>'+money(record.total - paid(record))+' outstanding</strong> · '+money(paid(record))+' received</p>' : '';
    const history = record?.payments.length ? '<details><summary>Payment history</summary><ul>'+record.payments.map(item => '<li>'+money(item.cents)+' · '+esc(item.method)+' · '+esc(item.date)+'</li>').join('')+'</ul></details>' : '';
    if (mode === 'payment' && record && record.total > paid(record)) {
      host.innerHTML = summary + '<div class="palz-sales-fields"><label>Amount (AUD)<input name="amount" inputmode="decimal" required value="'+((record.total-paid(record))/100).toFixed(2)+'"></label><label>Payment date<input name="date" type="date" required max="'+today()+'" value="'+today()+'"></label><label>Method<select name="method">'+(record.channel === 'marketplace' ? '<option>Marketplace payout</option>' : '<option>Bank transfer</option><option>Cash</option><option>Other</option>')+'</select></label></div><div class="palz-sales-actions"><button type="submit" class="palz-sales-primary">Save '+(record.channel === 'marketplace' ? 'payout' : 'payment')+'</button><button type="button" data-sales-mode="price">Edit price</button></div>'+history;
      return;
    }
    mode = 'price';
    host.innerHTML = summary + '<div class="palz-sales-fields"><label>Payment source<select name="channel"><option value="direct">Direct from owner</option><option value="marketplace"'+(record?.channel === 'marketplace' ? ' selected' : '')+'>Marketplace payout</option></select></label><label>Price type<select name="priceType"><option value="fixed">Fixed total</option><option value="nightly"'+(record?.priceType === 'nightly' ? ' selected' : '')+'>Nightly rate</option></select></label><label>Price (AUD)<input name="amount" inputmode="decimal" required value="'+(record ? (record.rate/100).toFixed(2) : '')+'"></label><label>Due date<input name="date" type="date" required value="'+esc(record?.dueDate || stay.endDate)+'"></label></div><p data-sales-preview></p><div class="palz-sales-actions"><button type="submit" class="palz-sales-primary">Save price</button>'+(record && record.total > paid(record) ? '<button type="button" data-sales-mode="payment">Record '+(record.channel === 'marketplace' ? 'payout' : 'payment')+'</button>' : '')+'</div>'+history;
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
    if (!validId(id) || !amount || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { status('Enter a valid amount and date.'); return; }
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
          priceType, rate: amount, total, dueDate: date, payments: previous?.payments || []};
      }
      localStorage.setItem(storageKey, JSON.stringify(records));
    };
    try {
      if (navigator.locks) await navigator.locks.request(storageKey, write);
      else write();
      render();
      status(action === 'payment' ? 'Payment recorded.' : 'Price saved.');
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

  function open(stay, trigger) {
    mount();
    opener = trigger;
    if (stay && validId(stay.stayId) && stay.dogName && stay.startDate && stay.endDate) {
      recent.set(stay.stayId.toLowerCase(), {...stay, stayId: stay.stayId.toLowerCase()});
    }
    chosenId = String(stay?.stayId || '').toLowerCase();
    mode = 'payment';
    try { render(); } catch (_) { status('Sales records could not be read in this browser.'); }
    if (!dialog.open) dialog.showModal();
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
      const label = record ? record.total === paid(record) ? 'Paid' : money(record.total-paid(record))+(record.channel === 'marketplace' ? ' payout pending' : ' due') : 'Set price';
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
    const button = event.target.closest('a[href="#sales"], [data-sales-stay]');
    if (!button) return;
    event.preventDefault();
    const id = button.dataset.salesStay;
    if (!id) { open(null, button); return; }
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
