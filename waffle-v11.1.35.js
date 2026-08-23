/* ============================================================
   WAFFLE HOUSE V11.1.35 — ASK WAFFLE FRESH INTENT ROUTING
   Prevent a pending capacity clarification from hijacking a new explicit
   operational question. Explicit Meet & Greet / movement / stay-summary
   questions are answered from the live Calendar with their own short context.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.35';
  const MAX_LIST = 12;
  const freshContext = { intent: '', range: null };

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function clean(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[–—]/g, '-')
      .replace(/[^a-z0-9\s/&.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function esc(value) {
    try {
      if (typeof window.escapeDashboardHtml === 'function') {
        return window.escapeDashboardHtml(value == null ? '' : String(value));
      }
    } catch (_) {}
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function calendarInstance() {
    try {
      if (window.globalCalendar && typeof window.globalCalendar.getEvents === 'function') {
        return window.globalCalendar;
      }
    } catch (_) {}
    try {
      if (typeof globalCalendar !== 'undefined' && globalCalendar && typeof globalCalendar.getEvents === 'function') {
        return globalCalendar;
      }
    } catch (_) {}
    return null;
  }

  function liveEvents() {
    const calendar = calendarInstance();
    return calendar ? calendar.getEvents().slice() : [];
  }

  function todayDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function addDays(date, amount) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + Number(amount || 0));
    return d;
  }

  function dateKey(value) {
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function dateFromKey(key) {
    const parts = String(key || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDate(key, includeYear = false) {
    const d = dateFromKey(key);
    if (!d) return String(key || '');
    return d.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(includeYear ? { year: 'numeric' } : {})
    });
  }

  function formatRange(range) {
    if (!range?.start || !range?.end) return '';
    if (range.start === range.end) return formatDate(range.start, true);
    return `${formatDate(range.start)} – ${formatDate(range.end, true)}`;
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

  function props(event) {
    return event?.extendedProps || {};
  }

  function isMeet(event) {
    return props(event).isMeetGreet === true || /meet\s*&?\s*greet/i.test(String(event?.title || ''));
  }

  function isPotential(event) {
    return props(event).isPotential === true;
  }

  function isCheckedOut(event) {
    try {
      if (typeof window.v110IsCheckedOutEvent === 'function') return window.v110IsCheckedOutEvent(event) === true;
    } catch (_) {}
    try {
      if (typeof v110IsCheckedOutEvent === 'function') return v110IsCheckedOutEvent(event) === true;
    } catch (_) {}
    return false;
  }

  function isBoarding(event) {
    return !isMeet(event) && !isPotential(event) && !isCheckedOut(event);
  }

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

  function overlaps(event, range) {
    const dates = rawDates(event);
    return !!dates.start && !!dates.end && dates.start <= range.end && dates.end >= range.start;
  }

  function weekRange(next) {
    const base = todayDate();
    const weekday = base.getDay() || 7;
    let monday = addDays(base, 1 - weekday);
    if (next) monday = addDays(monday, 7);
    return {
      start: dateKey(monday),
      end: dateKey(addDays(monday, 6)),
      label: next ? 'next week' : 'this week'
    };
  }

  function weekendRange(next) {
    const base = todayDate();
    let saturday;
    if (base.getDay() === 6) saturday = base;
    else if (base.getDay() === 0) saturday = addDays(base, -1);
    else saturday = addDays(base, 6 - base.getDay());
    if (next) saturday = addDays(saturday, 7);
    return {
      start: dateKey(saturday),
      end: dateKey(addDays(saturday, 1)),
      label: next ? 'next weekend' : 'this weekend'
    };
  }

  function parseFreshRange(question) {
    const lower = clean(question);
    const today = todayDate();

    if (/\bday after tomorrow\b/.test(lower)) {
      const key = dateKey(addDays(today, 2));
      return { start: key, end: key, label: 'the day after tomorrow' };
    }
    if (/\btomorrow\b/.test(lower)) {
      const key = dateKey(addDays(today, 1));
      return { start: key, end: key, label: 'tomorrow' };
    }
    if (/\btoday\b/.test(lower)) {
      const key = dateKey(today);
      return { start: key, end: key, label: 'today' };
    }
    if (/\bnext weekend\b/.test(lower)) return weekendRange(true);
    if (/\b(this )?weekend\b/.test(lower)) return weekendRange(false);
    if (/\bnext week\b/.test(lower)) return weekRange(true);
    if (/\bthis week\b/.test(lower)) return weekRange(false);

    const weekdays = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6
    };
    for (const [name, target] of Object.entries(weekdays)) {
      const match = lower.match(new RegExp(`\\b(next|this)?\\s*${name}\\b`));
      if (!match) continue;
      let delta = (target - today.getDay() + 7) % 7;
      if (match[1] === 'next') delta = delta === 0 ? 7 : delta + 7;
      const d = addDays(today, delta);
      const key = dateKey(d);
      return { start: key, end: key, label: formatDate(key, true) };
    }

    const numeric = lower.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
    if (numeric) {
      const day = Number(numeric[1]);
      const month = Number(numeric[2]) - 1;
      let year = numeric[3] ? Number(numeric[3]) : today.getFullYear();
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        const key = dateKey(d);
        return { start: key, end: key, label: formatDate(key, true) };
      }
    }

    return null;
  }

  function knownBoardingNames(items) {
    return Array.from(new Set(items.filter(isBoarding).map(dogName).filter(Boolean)));
  }

  function containsKnownDog(question, items) {
    const lower = clean(question);
    return knownBoardingNames(items).some(name => lower.includes(clean(name)));
  }

  function explicitIntent(question, items) {
    const lower = clean(question);

    if (/\b(meet\s*&?\s*greet|meet and greet|meet greets?|m&g)\b/.test(lower)) return 'meet';
    if (/\b(weekend briefing|weekend look|weekend summary|what.*weekend|give me.*weekend)\b/.test(lower)) return 'weekend';

    const hasDog = containsKnownDog(question, items);
    if (!hasDog && /\b(arriv|arrival|check in|check-in)\w*/.test(lower)) return 'arrival';
    if (!hasDog && /\b(leav|leaving|depart|departure|checkout|check out|check-out)\w*/.test(lower)) return 'departure';
    if (/\b(who(?: is|'s)? (?:staying|here|at home)|dogs? staying|staying dogs?|who do we have)\b/.test(lower)) return 'staying';

    return '';
  }

  function defaultRange() {
    const key = dateKey(todayDate());
    return { start: key, end: key, label: 'today' };
  }

  function meetAnswer(items, range) {
    const rows = items
      .filter(isMeet)
      .filter(event => overlaps(event, range))
      .sort((a, b) => rawDates(a).start.localeCompare(rawDates(b).start));

    if (!rows.length) {
      return { text: `No Meet & Greets are scheduled for ${range.label || formatRange(range)}.`, tone: 'muted' };
    }

    const list = rows.slice(0, MAX_LIST).map(event => {
      const time = meetTime(event);
      return `${dogName(event)} — ${formatDate(rawDates(event).start)}${time ? ` at ${time}` : ''}`;
    });

    return {
      text: `${rows.length} Meet & Greet${rows.length === 1 ? ' is' : 's are'} scheduled for ${range.label || formatRange(range)}.`,
      list,
      overflow: Math.max(0, rows.length - list.length)
    };
  }

  function movementAnswer(items, range, type) {
    const rows = items
      .filter(isBoarding)
      .filter(event => {
        const dates = rawDates(event);
        const key = type === 'arrival' ? dates.start : dates.end;
        return key >= range.start && key <= range.end;
      })
      .sort((a, b) => {
        const ad = rawDates(a);
        const bd = rawDates(b);
        const ak = type === 'arrival' ? ad.start : ad.end;
        const bk = type === 'arrival' ? bd.start : bd.end;
        return ak.localeCompare(bk) || dogName(a).localeCompare(dogName(b));
      });

    const word = type === 'arrival' ? 'arriving' : 'leaving';
    if (!rows.length) return { text: `No dogs are ${word} ${range.label || formatRange(range)}.`, tone: 'muted' };

    const list = rows.slice(0, MAX_LIST).map(event => {
      const dates = rawDates(event);
      const key = type === 'arrival' ? dates.start : dates.end;
      return `${dogName(event)} — ${formatDate(key)}`;
    });

    return {
      text: `${rows.length} dog${rows.length === 1 ? ' is' : 's are'} ${word} ${range.label || formatRange(range)}.`,
      list,
      overflow: Math.max(0, rows.length - list.length)
    };
  }

  function stayingAnswer(items, range) {
    const names = Array.from(new Set(
      items.filter(isBoarding).filter(event => overlaps(event, range)).map(dogName).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));

    if (!names.length) return { text: `No boarding dogs are scheduled for ${range.label || formatRange(range)}.`, tone: 'muted' };
    return {
      text: `${names.length} dog${names.length === 1 ? ' is' : 's are'} scheduled during ${range.label || formatRange(range)}:`,
      list: names.slice(0, MAX_LIST),
      overflow: Math.max(0, names.length - MAX_LIST)
    };
  }

  function weekendAnswer(items, range) {
    const boarding = items.filter(isBoarding).filter(event => overlaps(event, range));
    const names = Array.from(new Set(boarding.map(dogName).filter(Boolean)));
    const arrivals = items.filter(isBoarding).filter(event => {
      const key = rawDates(event).start;
      return key >= range.start && key <= range.end;
    }).length;
    const departures = items.filter(isBoarding).filter(event => {
      const key = rawDates(event).end;
      return key >= range.start && key <= range.end;
    }).length;
    const meets = items.filter(isMeet).filter(event => overlaps(event, range)).length;

    return {
      text: `${(range.label || 'Weekend').charAt(0).toUpperCase() + (range.label || 'Weekend').slice(1)} at Waffle House:`,
      list: [
        `${names.length} boarding dog${names.length === 1 ? '' : 's'}`,
        `${arrivals} arrival${arrivals === 1 ? '' : 's'}`,
        `${departures} departure${departures === 1 ? '' : 's'}`,
        `${meets} Meet & Greet${meets === 1 ? '' : 's'}`
      ]
    };
  }

  function freshInterpret(question) {
    const text = String(question || '').trim();
    if (!text) return null;

    const items = liveEvents();
    if (!items.length) return null;

    let intent = explicitIntent(text, items);
    let range = parseFreshRange(text);
    const lower = clean(text);

    if (!intent && freshContext.intent && /\b(what about|how about|and|then|same for)\b/.test(lower)) {
      intent = freshContext.intent;
      range = range || freshContext.range;
    }

    if (!intent) return null;

    if (intent === 'weekend') {
      range = /\bnext weekend\b/.test(lower) ? weekendRange(true) : weekendRange(false);
    } else {
      range = range || defaultRange();
    }

    freshContext.intent = intent;
    freshContext.range = range;

    if (intent === 'meet') return meetAnswer(items, range);
    if (intent === 'arrival') return movementAnswer(items, range, 'arrival');
    if (intent === 'departure') return movementAnswer(items, range, 'departure');
    if (intent === 'staying') return stayingAnswer(items, range);
    if (intent === 'weekend') return weekendAnswer(items, range);
    return null;
  }

  function appendUser(thread, text) {
    const row = document.createElement('div');
    row.className = 'v11133-message is-user';
    row.innerHTML = `<div class="v11133-message-bubble">${esc(text)}</div>`;
    thread.appendChild(row);
  }

  function appendAssistant(thread, answer) {
    const row = document.createElement('div');
    row.className = `v11133-message is-assistant${answer?.tone ? ` is-${answer.tone}` : ''}`;
    const list = Array.isArray(answer?.list) && answer.list.length
      ? `<ul>${answer.list.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
      : '';
    const overflow = Number(answer?.overflow || 0) > 0
      ? `<small class="v11133-overflow">+${Number(answer.overflow)} more</small>`
      : '';
    row.innerHTML = `<div class="v11133-message-bubble"><span>${esc(answer?.text || '')}</span>${list}${overflow}</div>`;
    thread.appendChild(row);
  }

  function renderFreshQuestion(modal, text, answer) {
    const thread = modal?.querySelector('[data-v11133-thread]');
    const input = modal?.querySelector('[data-v11133-input]');
    if (!thread || !answer) return false;
    if (input) input.value = '';
    appendUser(thread, text);
    window.setTimeout(() => {
      appendAssistant(thread, answer);
      thread.scrollTop = thread.scrollHeight;
    }, 40);
    return true;
  }

  function bindFreshRouting() {
    if (pageName() !== 'calendar') return;
    const modal = document.getElementById('v11133AskWaffleModal');
    if (!modal || modal.dataset.v11135FreshIntent === 'true') return;

    modal.dataset.v11135FreshIntent = 'true';

    modal.addEventListener('submit', event => {
      const form = event.target instanceof Element ? event.target.closest('[data-v11133-form]') : null;
      if (!form) return;
      const input = modal.querySelector('[data-v11133-input]');
      const text = String(input?.value || '').trim();
      const answer = freshInterpret(text);
      if (!answer) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      renderFreshQuestion(modal, text, answer);
    }, true);

    modal.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const prompt = target?.closest('[data-v11133-prompt]');
      if (!prompt) return;
      const text = String(prompt.getAttribute('data-v11133-prompt') || prompt.textContent || '').trim();
      const answer = freshInterpret(text);
      if (!answer) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      renderFreshQuestion(modal, text, answer);
    }, true);
  }

  function wrapProgrammaticApi() {
    if (window.v11135AskWaffleOriginal || typeof window.askWaffle !== 'function') return;
    const original = window.askWaffle;
    window.v11135AskWaffleOriginal = original;
    window.askWaffle = question => freshInterpret(String(question || '')) || original(question);
  }

  function apply() {
    bindFreshRouting();
    wrapProgrammaticApi();
  }

  function start() {
    if (pageName() !== 'calendar') return;
    apply();
    [80, 220, 520, 1100, 2200].forEach(delay => setTimeout(apply, delay));
    window.addEventListener('pageshow', apply);
    window.v11135AskWaffleVersion = VERSION;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
