/* ============================================================
   WAFFLE HOUSE V11.1.36 — ASK WAFFLE RANGE CAPACITY DECISION
   Exact requested-date capacity questions answer Yes/No from the
   Green / Amber / Red calendar capacity state for every requested day.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.36';
  const FULL_CAPACITY = 4;
  const MONTH_MAP = {
    jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,
    jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,
    oct:9,october:9,nov:10,november:10,dec:11,december:11
  };
  const MONTH_PATTERN = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
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
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function validDate(year, month, day) {
    const d = new Date(year, month, day);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null;
  }

  function addDays(date, amount) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + Number(amount || 0));
    return d;
  }

  function monthIndex(value) {
    const key = String(value || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(MONTH_MAP, key) ? MONTH_MAP[key] : -1;
  }

  function defaultYear(month) {
    const now = todayDate();
    return month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
  }

  function parseYear(value, fallback) {
    if (!value) return fallback;
    let year = Number(value);
    if (year < 100) year += 2000;
    return year;
  }

  function makeRange(start, end) {
    if (!start || !end || end < start) return null;
    return { start: dateKey(start), end: dateKey(end) };
  }

  function parseRequestedRange(question) {
    const lower = String(question || '').toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    let match;

    // December 2 - 9, 2-9 December, Dec 2 to 9 2026.
    match = lower.match(new RegExp(`\\b${MONTH_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|until|through|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{2,4}))?\\b`));
    if (match) {
      const month = monthIndex(match[1]);
      const year = parseYear(match[4], defaultYear(month));
      return makeRange(validDate(year, month, Number(match[2])), validDate(year, month, Number(match[3])));
    }

    match = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|until|through|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_PATTERN}(?:\\s+(\\d{2,4}))?\\b`));
    if (match) {
      const month = monthIndex(match[3]);
      const year = parseYear(match[4], defaultYear(month));
      return makeRange(validDate(year, month, Number(match[1])), validDate(year, month, Number(match[2])));
    }

    // 2 December - 9 December, including cross-month ranges.
    match = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_PATTERN}(?:\\s+(\\d{2,4}))?\\s*(?:to|until|through|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_PATTERN}(?:\\s+(\\d{2,4}))?\\b`));
    if (match) {
      const sm = monthIndex(match[2]);
      const sy = parseYear(match[3], defaultYear(sm));
      const em = monthIndex(match[5]);
      let ey = parseYear(match[6], sy);
      if (!match[6] && em < sm) ey += 1;
      return makeRange(validDate(sy, sm, Number(match[1])), validDate(ey, em, Number(match[4])));
    }

    // 2/12 - 9/12/2026.
    match = lower.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\s*(?:to|until|through|-)\s*(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
    if (match) {
      const sm = Number(match[2]) - 1;
      const sy = parseYear(match[3], defaultYear(sm));
      const em = Number(match[5]) - 1;
      let ey = parseYear(match[6], sy);
      if (!match[6] && em < sm) ey += 1;
      return makeRange(validDate(sy, sm, Number(match[1])), validDate(ey, em, Number(match[4])));
    }

    // Single explicit date requests also receive a direct decision.
    match = lower.match(new RegExp(`\\b${MONTH_PATTERN}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{2,4}))?\\b`));
    if (match) {
      const month = monthIndex(match[1]);
      const year = parseYear(match[3], defaultYear(month));
      const d = validDate(year, month, Number(match[2]));
      return d ? makeRange(d, d) : null;
    }

    match = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_PATTERN}(?:\\s+(\\d{2,4}))?\\b`));
    if (match) {
      const month = monthIndex(match[2]);
      const year = parseYear(match[3], defaultYear(month));
      const d = validDate(year, month, Number(match[1]));
      return d ? makeRange(d, d) : null;
    }

    return null;
  }

  function isCapacityQuestion(question) {
    return /\b(capacity|available|availability|room|space|fit|book|booking|request)\b/i.test(String(question || ''));
  }

  function rawDates(event) {
    try {
      if (typeof window.v10EventRawDates === 'function') {
        const dates = window.v10EventRawDates(event);
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
  function isMeet(event) { return props(event).isMeetGreet === true || /meet\s*&?\s*greet/i.test(String(event?.title || '')); }
  function isPotential(event) { return props(event).isPotential === true; }
  function isCheckedOut(event) {
    try { if (typeof window.v110IsCheckedOutEvent === 'function') return window.v110IsCheckedOutEvent(event) === true; } catch (_) {}
    return false;
  }
  function isBoarding(event) { return !isMeet(event) && !isPotential(event) && !isCheckedOut(event); }
  function occursOn(event, key) {
    const dates = rawDates(event);
    return !!dates.start && !!dates.end && key >= dates.start && key <= dates.end;
  }

  function rangeKeys(range) {
    const first = dateFromKey(range?.start), last = dateFromKey(range?.end);
    if (!first || !last || last < first) return [];
    const keys = [];
    for (let d = first; d <= last; d = addDays(d, 1)) {
      keys.push(dateKey(d));
      if (keys.length > 180) break;
    }
    return keys;
  }

  function countForDate(events, key) {
    return events.filter(isBoarding).filter(event => occursOn(event, key)).length;
  }

  function formatShort(key) {
    const d = dateFromKey(key);
    return d ? d.toLocaleDateString('en-AU', { weekday:'short', day:'numeric', month:'short' }) : key;
  }

  function formatRange(range) {
    if (!range?.start || !range?.end) return '';
    if (range.start === range.end) return formatShort(range.start);
    const start = dateFromKey(range.start), end = dateFromKey(range.end);
    if (!start || !end) return `${range.start} – ${range.end}`;
    const sameYear = start.getFullYear() === end.getFullYear();
    const startText = start.toLocaleDateString('en-AU', { day:'numeric', month:'short', ...(sameYear ? {} : { year:'numeric' }) });
    const endText = end.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
    return `${startText} – ${endText}`;
  }

  function decisionForRange(question) {
    if (!isCapacityQuestion(question)) return null;
    const range = parseRequestedRange(question);
    if (!range) return null;
    const calendar = calendarInstance();
    if (!calendar) return { text:'I cannot read the live Calendar yet. Try again once the Calendar has finished loading.', tone:'muted' };

    const events = calendar.getEvents().slice();
    const days = rangeKeys(range).map(key => ({ key, count:countForDate(events, key) }));
    if (!days.length) return null;

    const red = days.filter(day => day.count >= FULL_CAPACITY);
    const amber = days.filter(day => day.count === 3);
    const green = days.filter(day => day.count <= 2);
    const label = formatRange(range);

    if (red.length) {
      const availableCount = amber.length + green.length;
      return {
        text:`No — ${label} is not fully available. ${red.length} of ${days.length} requested day${days.length === 1 ? '' : 's'} ${red.length === 1 ? 'is' : 'are'} already at Red/full capacity.${availableCount ? ` The other ${availableCount} requested day${availableCount === 1 ? ' is' : 's are'} Green or Amber.` : ''}`,
        list:red.map(day => `${formatShort(day.key)} — ${day.count}/4 dogs · Red · Full capacity`),
        tone:'full'
      };
    }

    return {
      text:`Yes — ${label} is available. All ${days.length} requested day${days.length === 1 ? ' is' : 's are'} Green or Amber. Peak occupancy is ${Math.max(...days.map(day => day.count))}/4 dogs.`,
      list:amber.length ? amber.map(day => `${formatShort(day.key)} — ${day.count}/4 dogs · Amber · Busy`) : [`All requested dates are Green (0–2 dogs).`],
      tone:'available'
    };
  }

  function esc(value) {
    try { if (typeof window.escapeDashboardHtml === 'function') return window.escapeDashboardHtml(String(value ?? '')); } catch (_) {}
    return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function appendUser(thread, text) {
    const row = document.createElement('div');
    row.className = 'v11133-message is-user';
    row.innerHTML = `<div class="v11133-message-bubble"><span>${esc(text)}</span></div>`;
    thread.appendChild(row);
  }

  function appendAssistant(thread, answer) {
    const row = document.createElement('div');
    row.className = 'v11133-message is-assistant';
    if (answer?.tone) row.dataset.tone = answer.tone;
    const list = Array.isArray(answer?.list) && answer.list.length
      ? `<ul>${answer.list.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '';
    row.innerHTML = `<div class="v11133-message-bubble"><span>${esc(answer?.text || '')}</span>${list}</div>`;
    thread.appendChild(row);
  }

  function handleQuestion(text) {
    const answer = decisionForRange(text);
    if (!answer) return false;
    const modal = document.getElementById('v11133AssistantModal');
    const thread = modal?.querySelector('[data-v11133-thread]');
    const input = modal?.querySelector('[data-v11133-input]');
    if (!thread) return false;
    if (input) input.value = '';
    appendUser(thread, text);
    window.setTimeout(() => {
      appendAssistant(thread, answer);
      thread.scrollTop = thread.scrollHeight;
    }, 50);
    return true;
  }

  function onSubmit(event) {
    const target = event.target instanceof Element ? event.target : null;
    const form = target?.closest('[data-v11133-form]');
    if (!form) return;
    const modal = form.closest('#v11133AssistantModal');
    const input = modal?.querySelector('[data-v11133-input]');
    const text = String(input?.value || '').trim();
    if (!text || !handleQuestion(text)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onPromptClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const prompt = target?.closest('[data-v11133-prompt]');
    if (!prompt) return;
    const text = String(prompt.getAttribute('data-v11133-prompt') || prompt.textContent || '').trim();
    if (!text || !handleQuestion(text)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function start() {
    if (pageName() !== 'calendar') return;
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('click', onPromptClick, true);
    window.v11136AskWaffleCapacityVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
