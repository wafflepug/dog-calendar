/* ============================================================
   WAFFLE HOUSE V11.1.33 — ASK WAFFLE ASSISTANT
   Deterministic operational Q&A over the live Calendar data.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.33';
  const MAX_LIST = 12;

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function esc(value) {
    try {
      if (typeof window.escapeDashboardHtml === 'function') return window.escapeDashboardHtml(value == null ? '' : String(value));
    } catch (_) {}
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function calendarInstance() {
    try {
      if (window.globalCalendar && typeof window.globalCalendar.getEvents === 'function') return window.globalCalendar;
    } catch (_) {}
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar && typeof globalCalendar.getEvents === 'function') return globalCalendar;
    } catch (_) {}
    return null;
  }

  function todayDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function dateKey(value) {
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  function dateFromKey(key) {
    const parts = String(key || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(date, amount) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + Number(amount || 0));
    return d;
  }

  function formatDate(key, weekday = true) {
    const d = dateFromKey(key);
    if (!d) return String(key || '');
    return d.toLocaleDateString('en-AU', {
      ...(weekday ? { weekday: 'long' } : {}), day: 'numeric', month: 'long'
    });
  }

  function formatShortDate(key) {
    const d = dateFromKey(key);
    if (!d) return String(key || '');
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function rawDates(event) {
    try {
      if (typeof window.v10EventRawDates === 'function') {
        const dates = window.v10EventRawDates(event);
        if (dates?.start && dates?.end) return dates;
      }
    } catch (_) {}
    try {
      if (typeof v10EventRawDates === 'function') {
        const dates = v10EventRawDates(event);
        if (dates?.start && dates?.end) return dates;
      }
    } catch (_) {}

    const start = String(event?.startStr || '').slice(0, 10) || dateKey(event?.start);
    let end = start;
    if (event?.end) {
      const d = new Date(event.end);
      if (!Number.isNaN(d.getTime())) {
        if (event.allDay !== false) d.setDate(d.getDate() - 1);
        end = dateKey(d) || start;
      }
    }
    return { start, end };
  }

  function props(event) { return event?.extendedProps || {}; }

  function isMeet(event) {
    const p = props(event);
    return p.isMeetGreet === true || /meet\s*&?\s*greet/i.test(String(event?.title || ''));
  }

  function isPotential(event) { return props(event).isPotential === true; }

  function isCheckedOut(event) {
    try { if (typeof window.v110IsCheckedOutEvent === 'function') return window.v110IsCheckedOutEvent(event) === true; } catch (_) {}
    try { if (typeof v110IsCheckedOutEvent === 'function') return v110IsCheckedOutEvent(event) === true; } catch (_) {}
    return false;
  }

  function isBoarding(event) { return !isMeet(event) && !isPotential(event) && !isCheckedOut(event); }

  function dogName(event) {
    const direct = String(props(event).dogName || '').trim();
    if (direct) return direct;
    let title = String(event?.title || 'Guest').trim().replace(/^.*?Meet\s*&?\s*Greet:\s*/i, '').trim();
    if (/\s[-–—]\s/.test(title)) title = title.split(/\s[-–—]\s/)[0].trim();
    return title || 'Guest';
  }

  function meetTime(event) {
    const direct = String(props(event).time || '').trim();
    if (direct) return direct;
    const match = String(event?.title || '').match(/\b(\d{1,2}:\d{2})\b/);
    return match ? match[1] : '';
  }

  function occursOn(event, key) {
    const dates = rawDates(event);
    return !!dates.start && !!dates.end && key >= dates.start && key <= dates.end;
  }

  function liveEvents() {
    const calendar = calendarInstance();
    return calendar ? calendar.getEvents().slice() : [];
  }

  function uniqueNames(events) {
    return Array.from(new Set(events.map(dogName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  function rangeKeys(start, end) {
    const first = dateFromKey(start);
    const last = dateFromKey(end);
    if (!first || !last || last < first) return [];
    const keys = [];
    for (let d = first; d <= last; d = addDays(d, 1)) keys.push(dateKey(d));
    return keys;
  }

  function weekendRange(next) {
    const base = todayDate();
    const daysToSaturday = (6 - base.getDay() + 7) % 7;
    let saturday = addDays(base, daysToSaturday);
    if (next) saturday = addDays(saturday, 7);
    return { start: dateKey(saturday), end: dateKey(addDays(saturday, 1)), label: next ? 'next weekend' : 'this weekend' };
  }

  function weekRange(next) {
    const base = todayDate();
    const offset = base.getDay() === 0 ? -6 : 1 - base.getDay();
    let monday = addDays(base, offset);
    if (next) monday = addDays(monday, 7);
    return { start: dateKey(monday), end: dateKey(addDays(monday, 6)), label: next ? 'next week' : 'this week' };
  }

  function resolveWeekday(text) {
    const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const lower = String(text || '').toLowerCase();
    const index = names.findIndex(name => new RegExp(`\\b${name}\\b`).test(lower));
    if (index < 0) return null;
    const base = todayDate();
    let delta = (index - base.getDay() + 7) % 7;
    if (/\bnext\s+/.test(lower) && delta === 0) delta = 7;
    const target = addDays(base, delta);
    return { start: dateKey(target), end: dateKey(target), label: names[index] };
  }

  function resolveRange(text) {
    const lower = String(text || '').toLowerCase();
    if (/\btomorrow\b/.test(lower)) {
      const key = dateKey(addDays(todayDate(), 1)); return { start: key, end: key, label: 'tomorrow' };
    }
    if (/\btoday\b/.test(lower)) {
      const key = dateKey(todayDate()); return { start: key, end: key, label: 'today' };
    }
    if (/\bnext weekend\b/.test(lower)) return weekendRange(true);
    if (/\bthis weekend\b|\bweekend\b/.test(lower)) return weekendRange(false);
    if (/\bnext week\b/.test(lower)) return weekRange(true);
    if (/\bthis week\b/.test(lower)) return weekRange(false);
    const weekday = resolveWeekday(lower);
    if (weekday) return weekday;
    const today = dateKey(todayDate());
    return { start: today, end: today, label: 'today' };
  }

  function findDogMatches(query, events) {
    const names = uniqueNames(events);
    const lower = String(query || '').toLowerCase();
    const exact = names.filter(name => lower.includes(name.toLowerCase()));
    if (exact.length) return exact;

    const stop = new Set(['when','what','which','who','does','will','next','stay','arrive','arriving','arrival','leave','leaving','departure','departing','dog','guest','booking','booked','is','are','the','a','an','for','on','at','this','that','today','tomorrow','week','weekend','home','here']);
    const tokens = lower.replace(/[?.,!]/g, ' ').split(/\s+/).filter(token => token.length >= 2 && !stop.has(token));
    return names.filter(name => {
      const n = name.toLowerCase();
      return tokens.some(token => n === token || n.startsWith(token) || token.startsWith(n));
    });
  }

  function dogSchedule(question, events, intent) {
    const boarding = events.filter(isBoarding);
    const matches = findDogMatches(question, boarding);
    if (!matches.length) return { text: 'I could not match a dog name in the current Calendar. Try the dog’s exact name.', tone: 'muted' };
    if (matches.length > 1) return { text: `I found more than one possible match: ${matches.join(', ')}. Which dog did you mean?`, tone: 'clarify' };

    const name = matches[0];
    const today = dateKey(todayDate());
    const stays = boarding
      .filter(event => dogName(event).toLowerCase() === name.toLowerCase())
      .map(event => ({ ...rawDates(event), event }))
      .filter(stay => stay.end >= today)
      .sort((a, b) => a.start.localeCompare(b.start));

    if (!stays.length) return { text: `I cannot see an upcoming stay for ${name}.`, tone: 'muted' };
    const stay = stays[0];
    if (intent === 'arrival') return { text: `${name} is arriving ${formatDate(stay.start)} and is booked through ${formatDate(stay.end, false)}.` };
    if (intent === 'departure') return { text: `${name} is leaving ${formatDate(stay.end)}. The stay starts ${formatDate(stay.start, false)}.` };
    return { text: `${name}’s next stay is ${formatDate(stay.start)} to ${formatDate(stay.end, false)}.${stays.length > 1 ? ` I can also see ${stays.length - 1} later upcoming stay${stays.length === 2 ? '' : 's'}.` : ''}` };
  }

  function movement(events, range, type) {
    const items = events.filter(isBoarding).filter(event => {
      const dates = rawDates(event); const key = type === 'arrival' ? dates.start : dates.end;
      return key >= range.start && key <= range.end;
    }).sort((a, b) => {
      const ad = rawDates(a), bd = rawDates(b);
      const ak = type === 'arrival' ? ad.start : ad.end, bk = type === 'arrival' ? bd.start : bd.end;
      return ak.localeCompare(bk) || dogName(a).localeCompare(dogName(b));
    });

    const verb = type === 'arrival' ? 'arriving' : 'leaving';
    if (!items.length) return { text: `No dogs are ${verb} ${range.label}.`, tone: 'muted' };
    const list = items.slice(0, MAX_LIST).map(event => {
      const dates = rawDates(event); const key = type === 'arrival' ? dates.start : dates.end;
      return `${dogName(event)} — ${formatShortDate(key)}`;
    });
    return { text: `${items.length} dog${items.length === 1 ? ' is' : 's are'} ${verb} ${range.label}.`, list, overflow: items.length - list.length };
  }

  function staying(events, range) {
    const keys = rangeKeys(range.start, range.end);
    const names = uniqueNames(events.filter(isBoarding).filter(event => keys.some(key => occursOn(event, key))));
    if (!names.length) return { text: `No boarding dogs are scheduled ${range.label}.`, tone: 'muted' };
    return { text: `${names.length} dog${names.length === 1 ? '' : 's'} ${names.length === 1 ? 'is' : 'are'} staying ${range.label}:`, list: names.slice(0, MAX_LIST), overflow: Math.max(0, names.length - MAX_LIST) };
  }

  function meetGreets(events, range) {
    const meets = events.filter(isMeet).filter(event => {
      const key = rawDates(event).start; return key >= range.start && key <= range.end;
    }).sort((a, b) => rawDates(a).start.localeCompare(rawDates(b).start));
    if (!meets.length) return { text: `No Meet & Greets are scheduled ${range.label}.`, tone: 'muted' };
    const list = meets.slice(0, MAX_LIST).map(event => `${dogName(event)} — ${formatShortDate(rawDates(event).start)}${meetTime(event) ? ` at ${meetTime(event)}` : ''}`);
    return { text: `${meets.length} Meet & Greet${meets.length === 1 ? ' is' : 's are'} scheduled ${range.label}.`, list, overflow: meets.length - list.length };
  }

  function countForDate(events, key) { return events.filter(isBoarding).filter(event => occursOn(event, key)).length; }
  function capacityLabel(count) { return count >= 4 ? 'Full capacity' : count === 3 ? 'Busy' : 'Available'; }

  function capacity(events, range) {
    const keys = rangeKeys(range.start, range.end);
    if (keys.length === 1) {
      const count = countForDate(events, keys[0]);
      return { text: `${formatDate(keys[0])} has ${count} boarding dog${count === 1 ? '' : 's'} — ${capacityLabel(count)}.`, tone: count >= 4 ? 'full' : count === 3 ? 'busy' : 'available' };
    }
    const list = keys.map(key => { const count = countForDate(events, key); return `${formatShortDate(key)} — ${count} dog${count === 1 ? '' : 's'} · ${capacityLabel(count)}`; });
    const peak = Math.max(...keys.map(key => countForDate(events, key)));
    return { text: `${range.label} peaks at ${peak} boarding dog${peak === 1 ? '' : 's'}.`, list };
  }

  function fullDays(events) {
    const rows = [];
    for (let i = 0; i < 35; i += 1) {
      const key = dateKey(addDays(todayDate(), i)); const count = countForDate(events, key);
      if (count >= 4) rows.push(`${formatShortDate(key)} — ${count} dogs`);
    }
    if (!rows.length) return { text: 'I cannot see any full-capacity days in the next 35 days.', tone: 'available' };
    return { text: `I found ${rows.length} full-capacity day${rows.length === 1 ? '' : 's'} in the next 35 days.`, list: rows.slice(0, MAX_LIST), overflow: Math.max(0, rows.length - MAX_LIST), tone: 'full' };
  }

  function weekendSummary(events, next) {
    const range = weekendRange(next); const keys = rangeKeys(range.start, range.end);
    const boarding = events.filter(isBoarding);
    const names = uniqueNames(boarding.filter(event => keys.some(key => occursOn(event, key))));
    const arrivals = boarding.filter(event => rawDates(event).start >= range.start && rawDates(event).start <= range.end).length;
    const departures = boarding.filter(event => rawDates(event).end >= range.start && rawDates(event).end <= range.end).length;
    const meets = events.filter(event => isMeet(event) && rawDates(event).start >= range.start && rawDates(event).start <= range.end).length;
    const peak = Math.max(...keys.map(key => countForDate(events, key)));
    const list = [`${names.length} boarding dog${names.length === 1 ? '' : 's'}`, `${arrivals} arrival${arrivals === 1 ? '' : 's'}`, `${departures} departure${departures === 1 ? '' : 's'}`, `${meets} Meet & Greet${meets === 1 ? '' : 's'}`, `Peak capacity: ${peak} dog${peak === 1 ? '' : 's'}`];
    if (names.length) list.push(`Staying: ${names.join(', ')}`);
    return { text: `${range.label.charAt(0).toUpperCase() + range.label.slice(1)} at Waffle House:`, list };
  }

  function helpAnswer() {
    return { text: 'I answer directly from the live Waffle Calendar. Try asking:', list: ['When is Bailey arriving?', 'Who is staying this weekend?', 'Who is leaving tomorrow?', 'Any Meet & Greets next week?', 'How many dogs are here Friday?', 'Which days are full capacity?'] };
  }

  function interpret(question, events) {
    const q = String(question || '').trim(); const lower = q.toLowerCase();
    if (!q) return helpAnswer();
    if (!events.length) return { text: 'The Calendar data is not loaded yet. Wait for the Calendar to finish syncing, then ask again.', tone: 'muted' };
    if (/^(hi|hello|hey)\b/.test(lower) || /\b(help|what can you do|examples?)\b/.test(lower)) return helpAnswer();
    if (/\b(full capacity|fully booked|full days?|capacity days?)\b/.test(lower) && /\b(which|what|show|days?)\b/.test(lower)) return fullDays(events);

    const dogIntent = /\b(arriv|arrival)/.test(lower) ? 'arrival' : /\b(leav|depart|checkout|check out)/.test(lower) ? 'departure' : /\b(next stay|next booking|when.*stay|booked next)/.test(lower) ? 'stay' : '';
    if (dogIntent && findDogMatches(q, events.filter(isBoarding)).length) return dogSchedule(q, events, dogIntent);
    if (/\b(weekend briefing|weekend look|weekend summary|what.*weekend|next weekend)\b/.test(lower)) return weekendSummary(events, /\bnext weekend\b/.test(lower));

    const range = resolveRange(lower);
    if (/\b(meet\s*&?\s*greet|meet and greet|meet greets?|m&g)\b/.test(lower)) return meetGreets(events, range);
    if (/\b(arriv|arrival|check in|check-in)\b/.test(lower)) return movement(events, range, 'arrival');
    if (/\b(leav|depart|checkout|check out|check-out)\b/.test(lower)) return movement(events, range, 'departure');
    if (/\b(capacity|how many dogs|dog count|how busy|busy)\b/.test(lower)) return capacity(events, range);
    if (/\b(who|which dogs?|staying|at home|here|boarding)\b/.test(lower)) return staying(events, range);
    if (findDogMatches(q, events.filter(isBoarding)).length) return dogSchedule(q, events, 'stay');
    return helpAnswer();
  }

  function ensureButton() {
    if (pageName() !== 'calendar') return null;
    let button = document.getElementById('v11133AskWaffleButton');
    if (button) return button;
    const header = document.querySelector('.calendar-header-branding');
    if (!header) return null;
    button = document.createElement('button');
    button.id = 'v11133AskWaffleButton'; button.type = 'button'; button.className = 'v11133-ask-button';
    button.setAttribute('aria-label', 'Ask Waffle'); button.setAttribute('title', 'Ask Waffle about bookings and capacity');
    button.innerHTML = '<span aria-hidden="true">💬</span><span>Ask Waffle</span>';
    const theme = document.getElementById('themeToggle'); header.insertBefore(button, theme || null);
    return button;
  }

  function ensureModal() {
    let modal = document.getElementById('v11133AskWaffleModal');
    if (modal) return modal;
    modal = document.createElement('div'); modal.id = 'v11133AskWaffleModal'; modal.className = 'v11133-assistant-modal'; modal.hidden = true;
    modal.innerHTML = `
      <section class="v11133-assistant-card" role="dialog" aria-modal="true" aria-labelledby="v11133AssistantTitle">
        <header class="v11133-assistant-head">
          <div class="v11133-assistant-brand"><span class="v11133-assistant-avatar" aria-hidden="true">🐾</span><div><small>WAFFLE OPERATIONS ASSISTANT</small><h3 id="v11133AssistantTitle">Ask Waffle</h3><p>Answers from the live Calendar</p></div></div>
          <button type="button" class="v11133-assistant-close" data-v11133-close aria-label="Close">×</button>
        </header>
        <div class="v11133-suggestions" aria-label="Suggested questions">
          <button type="button" data-v11133-prompt="Who is staying today?">Who’s here today?</button>
          <button type="button" data-v11133-prompt="Who is arriving tomorrow?">Arriving tomorrow</button>
          <button type="button" data-v11133-prompt="Who is staying this weekend?">This weekend</button>
          <button type="button" data-v11133-prompt="Which days are full capacity?">Full-capacity days</button>
        </div>
        <div class="v11133-thread" data-v11133-thread aria-live="polite"><div class="v11133-message is-assistant"><div class="v11133-message-bubble"><strong>Ask me about bookings, dogs or capacity.</strong><span>For example: “When is Bailey arriving?”</span></div></div></div>
        <form class="v11133-composer" data-v11133-form><input type="text" data-v11133-input autocomplete="off" placeholder="Ask: When is Bailey arriving?" aria-label="Ask Waffle a question"><button type="submit" aria-label="Send question">Send</button></form>
        <footer class="v11133-assistant-foot"><span class="v11133-live-dot" aria-hidden="true"></span>Live Calendar data · no external AI service</footer>
      </section>`;
    document.body.appendChild(modal); return modal;
  }

  function appendUser(thread, text) {
    const row = document.createElement('div'); row.className = 'v11133-message is-user'; row.innerHTML = `<div class="v11133-message-bubble">${esc(text)}</div>`; thread.appendChild(row);
  }

  function appendAssistant(thread, answer) {
    const row = document.createElement('div'); row.className = `v11133-message is-assistant${answer?.tone ? ` is-${answer.tone}` : ''}`;
    const list = Array.isArray(answer?.list) && answer.list.length ? `<ul>${answer.list.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '';
    const overflow = Number(answer?.overflow || 0) > 0 ? `<small class="v11133-overflow">+${Number(answer.overflow)} more</small>` : '';
    row.innerHTML = `<div class="v11133-message-bubble"><span>${esc(answer?.text || '')}</span>${list}${overflow}</div>`; thread.appendChild(row);
  }

  function ask(question) {
    const modal = ensureModal(); const thread = modal.querySelector('[data-v11133-thread]'); if (!thread) return;
    appendUser(thread, question); appendAssistant(thread, interpret(question, liveEvents())); thread.scrollTop = thread.scrollHeight;
  }

  function openAssistant() {
    const modal = ensureModal(); modal.hidden = false; window.setTimeout(() => modal.querySelector('[data-v11133-input]')?.focus(), 60);
  }

  function closeAssistant() { const modal = document.getElementById('v11133AskWaffleModal'); if (modal) modal.hidden = true; }

  function wire() {
    const button = ensureButton(); const modal = ensureModal(); if (!button || !modal) return;
    if (button.dataset.v11133Wired !== 'true') { button.dataset.v11133Wired = 'true'; button.addEventListener('click', openAssistant); }
    if (modal.dataset.v11133Wired === 'true') return;
    modal.dataset.v11133Wired = 'true';
    modal.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null; if (!target) return;
      if (target === modal || target.closest('[data-v11133-close]')) { closeAssistant(); return; }
      const prompt = target.closest('[data-v11133-prompt]'); if (prompt) { const text = String(prompt.getAttribute('data-v11133-prompt') || ''); ask(text); }
    });
    modal.querySelector('[data-v11133-form]')?.addEventListener('submit', event => {
      event.preventDefault(); const input = modal.querySelector('[data-v11133-input]'); const value = String(input?.value || '').trim(); if (!value) return; if (input) input.value = ''; ask(value);
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeAssistant(); });
  }

  function apply() { if (pageName() !== 'calendar') return; ensureButton(); wire(); }

  function start() {
    apply(); [80, 220, 520, 1100, 2200, 4200].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', apply); window.addEventListener('focus', apply);
    window.v11133AskWaffle = ask; window.v11133AskWaffleVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
