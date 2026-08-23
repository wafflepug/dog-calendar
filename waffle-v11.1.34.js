/* ============================================================
   WAFFLE HOUSE V11.1.34 — ASK WAFFLE V2
   Natural date ranges, capacity requests and conversational context.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '11.1.34';
  const MAX_LIST = 12;
  const FULL_CAPACITY = 4;
  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const MONTH_MAP = {
    jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,
    jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,
    oct:9,october:9,nov:10,november:10,dec:11,december:11
  };
  const WEEKDAYS = { sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6 };

  const context = {
    lastDog: '',
    lastRange: null,
    pending: ''
  };

  function pageName() {
    return String(window.WAFFLE_PAGE || document.body?.dataset?.wafflePage || 'calendar');
  }

  function esc(value) {
    try {
      if (typeof window.escapeDashboardHtml === 'function') return window.escapeDashboardHtml(value == null ? '' : String(value));
    } catch (_) {}
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function clean(value) {
    return String(value || '').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9\s/&.-]/g,' ').replace(/\s+/g,' ').trim();
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
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }

  function dateFromKey(key) {
    const parts = String(key || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const d = new Date(parts[0],parts[1]-1,parts[2]);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function addDays(date, amount) {
    const d = new Date(date.getFullYear(),date.getMonth(),date.getDate());
    d.setDate(d.getDate()+Number(amount || 0));
    return d;
  }

  function validDate(year, month, day) {
    const d = new Date(year,month,day);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? d : null;
  }

  function monthIndex(value) {
    const key = String(value || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(MONTH_MAP,key) ? MONTH_MAP[key] : -1;
  }

  function defaultYear(month) {
    const now = todayDate();
    return month < now.getMonth() ? now.getFullYear()+1 : now.getFullYear();
  }

  function parseYear(value, fallback) {
    if (!value) return fallback;
    let year = Number(value);
    if (year < 100) year += 2000;
    return year;
  }

  function formatDate(key, weekday = true, year = false) {
    const d = dateFromKey(key);
    if (!d) return String(key || '');
    return d.toLocaleDateString('en-AU', {
      ...(weekday ? { weekday:'short' } : {}), day:'numeric', month:'short', ...(year ? { year:'numeric' } : {})
    });
  }

  function formatRange(range) {
    if (!range?.start || !range?.end) return '';
    if (range.start === range.end) return formatDate(range.start,true,true);
    return `${formatDate(range.start)} – ${formatDate(range.end,true,true)}`;
  }

  function rangeKeys(start, end) {
    const first = dateFromKey(start), last = dateFromKey(end);
    if (!first || !last || last < first) return [];
    const keys = [];
    for (let d = first; d <= last; d = addDays(d,1)) {
      keys.push(dateKey(d));
      if (keys.length > 400) break;
    }
    return keys;
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
    const start = String(event?.startStr || '').slice(0,10) || dateKey(event?.start);
    let end = start;
    if (event?.end) {
      const d = new Date(event.end);
      if (!Number.isNaN(d.getTime())) {
        if (event.allDay !== false) d.setDate(d.getDate()-1);
        end = dateKey(d) || start;
      }
    }
    return { start,end };
  }

  function props(event) { return event?.extendedProps || {}; }
  function isMeet(event) { return props(event).isMeetGreet === true || /meet\s*&?\s*greet/i.test(String(event?.title || '')); }
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
    let title = String(event?.title || 'Guest').trim().replace(/^.*?Meet\s*&?\s*Greet:\s*/i,'').trim();
    if (/\s[-–—]\s/.test(title)) title = title.split(/\s[-–—]\s/)[0].trim();
    return title || 'Guest';
  }

  function meetTime(event) {
    const direct = String(props(event).time || '').trim();
    if (direct) return direct;
    const match = String(event?.title || '').match(/\b(\d{1,2}:\d{2})\b/);
    return match ? match[1] : '';
  }

  function occursOn(event,key) {
    const dates = rawDates(event);
    return !!dates.start && !!dates.end && key >= dates.start && key <= dates.end;
  }

  function overlaps(event,range) {
    const dates = rawDates(event);
    return !!dates.start && !!dates.end && dates.start <= range.end && dates.end >= range.start;
  }

  function liveEvents() {
    const calendar = calendarInstance();
    return calendar ? calendar.getEvents().slice() : [];
  }

  function uniqueNames(items) {
    return Array.from(new Set(items.map(dogName).filter(Boolean))).sort((a,b) => a.localeCompare(b));
  }

  function weekendRange(next) {
    const base = todayDate();
    let saturday;
    if (base.getDay() === 6) saturday = base;
    else if (base.getDay() === 0) saturday = addDays(base,-1);
    else saturday = addDays(base,6-base.getDay());
    if (next) saturday = addDays(saturday,7);
    return { start:dateKey(saturday),end:dateKey(addDays(saturday,1)),label:next ? 'next weekend' : 'this weekend' };
  }

  function weekRange(next) {
    const base = todayDate();
    const day = base.getDay() || 7;
    let monday = addDays(base,1-day);
    if (next) monday = addDays(monday,7);
    return { start:dateKey(monday),end:dateKey(addDays(monday,6)),label:next ? 'next week' : 'this week' };
  }

  function weekdayRange(text) {
    const lower = clean(text);
    for (const [name,target] of Object.entries(WEEKDAYS)) {
      const found = lower.match(new RegExp(`\\b(next|this)?\\s*${name}\\b`));
      if (!found) continue;
      const base = todayDate();
      let delta = (target-base.getDay()+7)%7;
      if (found[1] === 'next') delta = delta === 0 ? 7 : delta+7;
      const d = addDays(base,delta), key = dateKey(d);
      return { start:key,end:key,label:formatDate(key,true,true) };
    }
    return null;
  }

  function parseRange(text) {
    const lower = clean(text);
    const today = todayDate();
    let match;

    if (/\bday after tomorrow\b/.test(lower)) {
      const key = dateKey(addDays(today,2)); return { start:key,end:key,label:'the day after tomorrow' };
    }
    if (/\btomorrow\b/.test(lower)) {
      const key = dateKey(addDays(today,1)); return { start:key,end:key,label:'tomorrow' };
    }
    if (/\btoday\b/.test(lower)) {
      const key = dateKey(today); return { start:key,end:key,label:'today' };
    }
    if (/\bnext weekend\b/.test(lower)) return weekendRange(true);
    if (/\b(this )?weekend\b/.test(lower)) return weekendRange(false);
    if (/\bnext week\b/.test(lower)) return weekRange(true);
    if (/\bthis week\b/.test(lower)) return weekRange(false);

    match = lower.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\s*(?:to|until|through|-|–|—)\s*(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
    if (match) {
      const sm = Number(match[2])-1, em = Number(match[5])-1;
      const sy = parseYear(match[3],defaultYear(sm));
      let ey = parseYear(match[6],sy);
      if (!match[6] && em < sm) ey += 1;
      const start = validDate(sy,sm,Number(match[1])), end = validDate(ey,em,Number(match[4]));
      if (start && end && end >= start) return { start:dateKey(start),end:dateKey(end),label:'requested range' };
    }

    match = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|until|through|-|–|—|and)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/);
    if (match) {
      const month = monthIndex(match[3]), year = parseYear(match[4],defaultYear(month));
      const start = validDate(year,month,Number(match[1])), end = validDate(year,month,Number(match[2]));
      if (start && end && end >= start) return { start:dateKey(start),end:dateKey(end),label:'requested range' };
    }

    match = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\s*(?:to|until|through|-|–|—)\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))?(?:\s+(\d{4}))?\b/);
    if (match) {
      const sm = monthIndex(match[2]), sy = parseYear(match[3],defaultYear(sm));
      const em = match[5] ? monthIndex(match[5]) : sm;
      let ey = parseYear(match[6],sy);
      if (!match[6] && em < sm) ey += 1;
      const start = validDate(sy,sm,Number(match[1])), end = validDate(ey,em,Number(match[4]));
      if (start && end && end >= start) return { start:dateKey(start),end:dateKey(end),label:'requested range' };
    }

    match = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/);
    if (match) {
      const month = monthIndex(match[2]), year = parseYear(match[3],defaultYear(month));
      const d = validDate(year,month,Number(match[1]));
      if (d) { const key = dateKey(d); return { start:key,end:key,label:formatDate(key,true,true) }; }
    }

    const weekday = weekdayRange(lower);
    if (weekday) return weekday;

    for (const alias of Object.keys(MONTH_MAP).sort((a,b) => b.length-a.length)) {
      const found = lower.match(new RegExp(`\\b${alias}\\b(?:\\s+(20\\d{2}))?`));
      if (!found) continue;
      const month = monthIndex(alias), year = parseYear(found[1],defaultYear(month));
      const start = new Date(year,month,1), end = new Date(year,month+1,0);
      const label = `${MONTHS[month].charAt(0).toUpperCase()+MONTHS[month].slice(1)} ${year}`;
      return { start:dateKey(start),end:dateKey(end),label,isMonth:true };
    }

    return null;
  }

  function boardingCount(items,key) {
    return items.filter(isBoarding).filter(event => occursOn(event,key)).length;
  }

  function rangeStats(items,range) {
    const days = rangeKeys(range.start,range.end).map(key => {
      const count = boardingCount(items,key);
      return { key,count,spaces:Math.max(0,FULL_CAPACITY-count),tone:count >= 4 ? 'full' : count === 3 ? 'busy' : 'available' };
    });
    const stays = items.filter(isBoarding).filter(event => overlaps(event,range));
    return {
      days,stays,unique:uniqueNames(stays),
      peak:days.reduce((max,day) => Math.max(max,day.count),0),
      full:days.filter(day => day.tone === 'full'),
      busy:days.filter(day => day.tone === 'busy'),
      available:days.filter(day => day.tone === 'available')
    };
  }

  function requestDogCount(question) {
    const lower = clean(question);
    const numeric = lower.match(/\b(\d+)\s+dogs?\b/);
    if (numeric) return Math.max(1,Number(numeric[1]));
    const words = { one:1,two:2,three:3,four:4 };
    for (const [word,count] of Object.entries(words)) {
      if (new RegExp(`\\b${word}\\s+dogs?\\b`).test(lower)) return count;
    }
    return 1;
  }

  function capacityRequest(items,range,question) {
    const requested = requestDogCount(question), stats = rangeStats(items,range);
    context.lastRange = range; context.pending = '';
    const blocked = stats.days.filter(day => day.count + requested > FULL_CAPACITY);
    const tight = stats.days.filter(day => day.count + requested === FULL_CAPACITY);
    if (blocked.length) {
      const list = blocked.slice(0,MAX_LIST).map(day => `${formatDate(day.key)} — ${day.count}/${FULL_CAPACITY} already booked`);
      return {
        text:`No — ${formatRange(range)} cannot fit ${requested} additional dog${requested === 1 ? '' : 's'} for the full stay. ${blocked.length} date${blocked.length === 1 ? '' : 's'} would exceed the ${FULL_CAPACITY}-dog limit.`,
        list,overflow:Math.max(0,blocked.length-list.length),tone:'full'
      };
    }
    const minimumSpace = stats.days.length ? Math.min(...stats.days.map(day => FULL_CAPACITY-day.count)) : FULL_CAPACITY;
    const list = tight.slice(0,MAX_LIST).map(day => `${formatDate(day.key)} — would reach ${FULL_CAPACITY}/${FULL_CAPACITY}`);
    return {
      text:`Yes — ${formatRange(range)} currently fits ${requested} additional dog${requested === 1 ? '' : 's'}. Peak existing occupancy is ${stats.peak}/${FULL_CAPACITY}; the lowest current remaining capacity is ${minimumSpace} space${minimumSpace === 1 ? '' : 's'}.${tight.length ? ' The dates below would become full if accepted.' : ''}`,
      list,overflow:Math.max(0,tight.length-list.length),tone:tight.length ? 'busy' : 'available'
    };
  }

  function periodSummary(items,range) {
    const stats = rangeStats(items,range);
    context.lastRange = range; context.pending = '';
    const list = [
      `${stats.unique.length} unique boarding dog${stats.unique.length === 1 ? '' : 's'}`,
      `${stats.stays.length} stay${stats.stays.length === 1 ? '' : 's'}`,
      `Peak occupancy: ${stats.peak}/${FULL_CAPACITY}`,
      `${stats.available.length} available day${stats.available.length === 1 ? '' : 's'} (0–2 dogs)`,
      `${stats.busy.length} busy day${stats.busy.length === 1 ? '' : 's'} (3 dogs)`,
      `${stats.full.length} full day${stats.full.length === 1 ? '' : 's'} (4+ dogs)`
    ];
    if (stats.full.length) list.push(`Full dates: ${stats.full.slice(0,7).map(day => formatDate(day.key)).join(', ')}${stats.full.length > 7 ? ` +${stats.full.length-7} more` : ''}`);
    const text = stats.full.length
      ? `${range.label || formatRange(range)} has capacity on ${stats.days.length-stats.full.length} of ${stats.days.length} days, but ${stats.full.length} day${stats.full.length === 1 ? ' is' : 's are'} already full.`
      : `${range.label || formatRange(range)} currently has capacity throughout the period; there are no full-capacity dates.`;
    return { text,list,tone:stats.full.length ? 'busy' : 'available' };
  }

  function knownDogs(items) {
    return uniqueNames(items.filter(isBoarding)).sort((a,b) => b.length-a.length || a.localeCompare(b));
  }

  function dogMatches(question,items) {
    const lower = clean(question), names = knownDogs(items);
    const exact = names.filter(name => lower.includes(clean(name)));
    if (exact.length) {
      const length = clean(exact[0]).length;
      return exact.filter(name => clean(name).length === length);
    }
    return [];
  }

  function resolveDog(question,items) {
    const matches = dogMatches(question,items);
    if (matches.length === 1) return { dog:matches[0] };
    if (matches.length > 1) return { ambiguous:matches };
    if (/\b(they|them|their|he|she|that dog)\b/.test(clean(question)) && context.lastDog) return { dog:context.lastDog };
    return { dog:'' };
  }

  function dogSchedule(question,items,intent) {
    const resolved = resolveDog(question,items);
    if (resolved.ambiguous) return { text:`I found more than one possible dog: ${resolved.ambiguous.join(', ')}. Which one do you mean?`,tone:'clarify' };
    if (!resolved.dog) return { text:'I could not match a dog name in the current Calendar. Try the dog’s exact name.',tone:'muted' };
    const name = resolved.dog, today = dateKey(todayDate());
    context.lastDog = name;
    const stays = items.filter(isBoarding).filter(event => clean(dogName(event)) === clean(name))
      .map(event => ({ ...rawDates(event),event })).filter(stay => stay.end >= today).sort((a,b) => a.start.localeCompare(b.start));
    if (!stays.length) return { text:`I cannot see an upcoming stay for ${name}.`,tone:'muted' };
    let stay = stays[0];
    if (intent === 'departure') {
      const current = stays.find(item => item.start <= today && item.end >= today);
      if (current) stay = current;
    }
    if (intent === 'arrival') return { text:`${name} is arriving ${formatDate(stay.start,true,true)} and is booked through ${formatDate(stay.end,false,true)}.` };
    if (intent === 'departure') return { text:`${name} is leaving ${formatDate(stay.end,true,true)}. This stay starts ${formatDate(stay.start,false,true)}.` };
    return { text:`${name}’s next stay is ${formatDate(stay.start,true,true)} to ${formatDate(stay.end,false,true)}.${stays.length > 1 ? ` I can also see ${stays.length-1} later upcoming stay${stays.length === 2 ? '' : 's'}.` : ''}` };
  }

  function staying(items,range) {
    context.lastRange = range;
    const names = uniqueNames(items.filter(isBoarding).filter(event => overlaps(event,range)));
    if (!names.length) return { text:`No boarding dogs are scheduled for ${range.label || formatRange(range)}.`,tone:'muted' };
    return { text:`${names.length} dog${names.length === 1 ? '' : 's'} ${names.length === 1 ? 'is' : 'are'} scheduled during ${range.label || formatRange(range)}:`,list:names.slice(0,MAX_LIST),overflow:Math.max(0,names.length-MAX_LIST) };
  }

  function movement(items,range,type) {
    context.lastRange = range;
    const rows = items.filter(isBoarding).filter(event => {
      const dates = rawDates(event), key = type === 'arrival' ? dates.start : dates.end;
      return key >= range.start && key <= range.end;
    }).sort((a,b) => {
      const ad = rawDates(a), bd = rawDates(b), ak = type === 'arrival' ? ad.start : ad.end, bk = type === 'arrival' ? bd.start : bd.end;
      return ak.localeCompare(bk) || dogName(a).localeCompare(dogName(b));
    });
    const word = type === 'arrival' ? 'arriving' : 'leaving';
    if (!rows.length) return { text:`No dogs are ${word} ${range.label || formatRange(range)}.`,tone:'muted' };
    const list = rows.slice(0,MAX_LIST).map(event => {
      const dates = rawDates(event), key = type === 'arrival' ? dates.start : dates.end;
      return `${dogName(event)} — ${formatDate(key)}`;
    });
    return { text:`${rows.length} dog${rows.length === 1 ? ' is' : 's are'} ${word} ${range.label || formatRange(range)}.`,list,overflow:Math.max(0,rows.length-list.length) };
  }

  function meetGreets(items,range) {
    context.lastRange = range;
    const rows = items.filter(isMeet).filter(event => overlaps(event,range)).sort((a,b) => rawDates(a).start.localeCompare(rawDates(b).start));
    if (!rows.length) return { text:`No Meet & Greets are scheduled for ${range.label || formatRange(range)}.`,tone:'muted' };
    const list = rows.slice(0,MAX_LIST).map(event => `${dogName(event)} — ${formatDate(rawDates(event).start)}${meetTime(event) ? ` at ${meetTime(event)}` : ''}`);
    return { text:`${rows.length} Meet & Greet${rows.length === 1 ? ' is' : 's are'} scheduled for ${range.label || formatRange(range)}.`,list,overflow:Math.max(0,rows.length-list.length) };
  }

  function weekendSummary(items,next) {
    const range = weekendRange(next), stats = rangeStats(items,range);
    context.lastRange = range;
    const arrivals = items.filter(isBoarding).filter(event => rawDates(event).start >= range.start && rawDates(event).start <= range.end).length;
    const departures = items.filter(isBoarding).filter(event => rawDates(event).end >= range.start && rawDates(event).end <= range.end).length;
    const meets = items.filter(isMeet).filter(event => overlaps(event,range)).length;
    return {
      text:`${range.label.charAt(0).toUpperCase()+range.label.slice(1)} at Waffle House:`,
      list:[`${stats.unique.length} boarding dog${stats.unique.length === 1 ? '' : 's'}`,`${arrivals} arrival${arrivals === 1 ? '' : 's'}`,`${departures} departure${departures === 1 ? '' : 's'}`,`${meets} Meet & Greet${meets === 1 ? '' : 's'}`,`Peak occupancy: ${stats.peak}/${FULL_CAPACITY}`,stats.full.length ? `${stats.full.length} full-capacity day${stats.full.length === 1 ? '' : 's'}` : 'Capacity available throughout'],
      tone:stats.full.length ? 'busy' : 'available'
    };
  }

  function helpAnswer() {
    return {
      text:'I answer from the live Waffle Calendar and can now understand date ranges and month-level capacity. Try:',
      list:['When is Bailey arriving?','I have a request for 10–15 December. Do we have capacity?','How many dogs do we have in December, and is there capacity?','Who is staying then?','Any Meet & Greets next week?','Give me a weekend summary.']
    };
  }

  function interpret(question,items) {
    const q = String(question || '').trim(), lower = clean(q);
    if (!q) return helpAnswer();
    if (!items.length) return { text:'The Calendar data is not loaded yet. Wait for the Calendar to finish syncing, then ask again.',tone:'muted' };
    if (/^(hi|hello|hey)\b/.test(lower) || /\b(help|what can you do|examples?)\b/.test(lower)) return helpAnswer();

    let range = parseRange(q);
    if (!range && context.lastRange && /\b(then|that time|that period|those dates|during that|there)\b/.test(lower)) range = context.lastRange;

    const dog = resolveDog(q,items);
    if (dog.ambiguous) return { text:`I found more than one possible dog: ${dog.ambiguous.join(', ')}. Which one do you mean?`,tone:'clarify' };
    if ((dog.dog || context.lastDog) && /\b(arriv|arrival|check in|check-in)\w*/.test(lower)) return dogSchedule(q,items,'arrival');
    if ((dog.dog || context.lastDog) && /\b(leav|leaving|depart|departure|checkout|check out|check-out)\w*/.test(lower)) return dogSchedule(q,items,'departure');
    if (dog.dog && /\b(next stay|next booking|booked|staying|stay|when)\b/.test(lower)) return dogSchedule(q,items,'stay');

    const capacityIntent = /\b(capacity|available|availability|space|fit|accept|full)\b/.test(lower) || context.pending === 'capacity';
    const requestIntent = /\b(request|booking request|can we fit|can i fit|can we accept|can i accept|space for)\b/.test(lower) || context.pending === 'capacity';

    if (capacityIntent && requestIntent) {
      if (!range) {
        context.pending = 'capacity';
        return { text:'Give me the requested stay dates and I’ll check every day of the range. For example: “10–15 December” or “2/1/2027 to 8/1/2027”.',tone:'clarify' };
      }
      return capacityRequest(items,range,q);
    }

    if (/\bhow many dogs\b/.test(lower) || (capacityIntent && range?.isMonth) || /\b(month|during that time|across that time)\b/.test(lower) && capacityIntent) {
      if (!range) range = context.lastRange;
      if (!range) return { text:'Which month or date range would you like me to check?',tone:'clarify' };
      return periodSummary(items,range);
    }

    if (/\b(full capacity|fully booked|full days?)\b/.test(lower) && !range) {
      const start = dateKey(todayDate()), end = dateKey(addDays(todayDate(),34));
      return periodSummary(items,{ start,end,label:'the next 35 days' });
    }

    if (/\b(weekend briefing|weekend look|weekend summary|what.*weekend|give me.*weekend)\b/.test(lower)) return weekendSummary(items,/\bnext weekend\b/.test(lower));
    if (/\b(meet\s*&?\s*greet|meet and greet|meet greets?|m&g)\b/.test(lower)) return meetGreets(items,range || context.lastRange || { start:dateKey(todayDate()),end:dateKey(todayDate()),label:'today' });
    if (/\b(arriv|arrival|check in|check-in)\b/.test(lower)) return movement(items,range || context.lastRange || { start:dateKey(todayDate()),end:dateKey(todayDate()),label:'today' },'arrival');
    if (/\b(leav|depart|checkout|check out|check-out)\b/.test(lower)) return movement(items,range || context.lastRange || { start:dateKey(todayDate()),end:dateKey(todayDate()),label:'today' },'departure');
    if (/\b(who|which dogs?|staying|at home|here|boarding)\b/.test(lower)) return staying(items,range || context.lastRange || { start:dateKey(todayDate()),end:dateKey(todayDate()),label:'today' });
    if (capacityIntent && range) return periodSummary(items,range);
    if (dog.dog) return dogSchedule(q,items,'stay');
    if (range) return periodSummary(items,range);
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
    button.setAttribute('aria-label','Ask Waffle'); button.setAttribute('title','Ask Waffle about bookings and capacity');
    button.innerHTML = '<span aria-hidden="true">💬</span><span>Ask Waffle</span>';
    const theme = document.getElementById('themeToggle'); header.insertBefore(button,theme || null);
    return button;
  }

  function ensureModal() {
    let modal = document.getElementById('v11133AskWaffleModal');
    if (modal) return modal;
    modal = document.createElement('div'); modal.id = 'v11133AskWaffleModal'; modal.className = 'v11133-assistant-modal'; modal.hidden = true;
    modal.innerHTML = `
      <section class="v11133-assistant-card" role="dialog" aria-modal="true" aria-labelledby="v11133AssistantTitle">
        <header class="v11133-assistant-head">
          <div class="v11133-assistant-brand"><span class="v11133-assistant-avatar" aria-hidden="true">🐾</span><div><small>WAFFLE OPERATIONS ASSISTANT</small><h3 id="v11133AssistantTitle">Ask Waffle</h3><p>Bookings, date ranges and capacity</p></div></div>
          <button type="button" class="v11133-assistant-close" data-v11133-close aria-label="Close">×</button>
        </header>
        <div class="v11133-suggestions" aria-label="Suggested questions">
          <button type="button" data-v11133-prompt="I have a request for 10–15 December. Do we have capacity?">Check a stay request</button>
          <button type="button" data-v11133-prompt="How many dogs do we have in December, and is there capacity?">December capacity</button>
          <button type="button" data-v11133-prompt="Who is staying this weekend?">This weekend</button>
          <button type="button" data-v11133-prompt="Any Meet & Greets next week?">Next week M&Gs</button>
        </div>
        <div class="v11133-thread" data-v11133-thread aria-live="polite"><div class="v11133-message is-assistant"><div class="v11133-message-bubble"><strong>Ask me naturally about bookings and capacity.</strong><span>For example: “I have a request for 10–15 December. Can we fit one more dog?”</span></div></div></div>
        <form class="v11133-composer" data-v11133-form><input type="text" data-v11133-input autocomplete="off" placeholder="Ask about a dog, month or date range…" aria-label="Ask Waffle a question"><button type="submit" aria-label="Send question">Send</button></form>
        <footer class="v11133-assistant-foot"><span class="v11133-live-dot" aria-hidden="true"></span>Live Calendar data · read-only operational assistant</footer>
      </section>`;
    document.body.appendChild(modal);
    return modal;
  }

  function appendUser(thread,text) {
    const row = document.createElement('div'); row.className = 'v11133-message is-user';
    row.innerHTML = `<div class="v11133-message-bubble">${esc(text)}</div>`; thread.appendChild(row);
  }

  function appendAssistant(thread,answer) {
    const row = document.createElement('div'); row.className = `v11133-message is-assistant${answer?.tone ? ` is-${answer.tone}` : ''}`;
    const list = Array.isArray(answer?.list) && answer.list.length ? `<ul>${answer.list.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '';
    const overflow = Number(answer?.overflow || 0) > 0 ? `<small class="v11133-overflow">+${Number(answer.overflow)} more</small>` : '';
    row.innerHTML = `<div class="v11133-message-bubble"><span>${esc(answer?.text || '')}</span>${list}${overflow}</div>`;
    thread.appendChild(row);
  }

  function ask(question) {
    const modal = ensureModal(), thread = modal.querySelector('[data-v11133-thread]');
    const input = modal.querySelector('[data-v11133-input]');
    const text = String(question || input?.value || '').trim();
    if (!text || !thread) return;
    if (input) input.value = '';
    appendUser(thread,text);
    const answer = interpret(text,liveEvents());
    window.setTimeout(() => {
      appendAssistant(thread,answer); thread.scrollTop = thread.scrollHeight;
    },60);
  }

  function openAssistant() {
    const modal = ensureModal(); modal.hidden = false;
    window.setTimeout(() => modal.querySelector('[data-v11133-input]')?.focus(),40);
  }

  function bind() {
    if (pageName() !== 'calendar') return;
    const button = ensureButton(), modal = ensureModal();
    if (button && button.dataset.v11134Bound !== 'true') {
      button.dataset.v11134Bound = 'true'; button.addEventListener('click',openAssistant);
    }
    if (modal.dataset.v11134Bound !== 'true') {
      modal.dataset.v11134Bound = 'true';
      modal.addEventListener('click',event => {
        if (event.target === modal || event.target.closest('[data-v11133-close]')) { modal.hidden = true; return; }
        const prompt = event.target.closest('[data-v11133-prompt]');
        if (prompt) ask(prompt.getAttribute('data-v11133-prompt') || prompt.textContent || '');
      });
      modal.querySelector('[data-v11133-form]')?.addEventListener('submit',event => { event.preventDefault(); ask(); });
    }
  }

  function start() {
    if (pageName() !== 'calendar') return;
    bind();
    [120,420,1000,2200].forEach(delay => setTimeout(bind,delay));
    document.addEventListener('keydown',event => {
      if (event.key !== 'Escape') return;
      const modal = document.getElementById('v11133AskWaffleModal');
      if (modal && !modal.hidden) modal.hidden = true;
    });
    window.askWaffle = question => interpret(String(question || ''),liveEvents());
    window.openAskWaffle = openAssistant;
    window.v11134AskWaffleVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{ once:true });
  else start();
})();
