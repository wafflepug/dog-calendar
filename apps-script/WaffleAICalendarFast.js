/* ============================================================
   WAFFLE HOUSE V11.1.49 — COMPLETE + FAST CALENDAR INTELLIGENCE
   ============================================================
   Common month/date roster and capacity questions are answered directly from
   the authoritative booking sheet before an AI-provider round trip is needed.

   Benefits:
   - complete dog lists: no 42k generic tool-output truncation;
   - faster common Calendar questions: zero Gemini/OpenAI round trips;
   - lower AI spend for deterministic operational questions;
   - free-form wording remains supported: users do not need commands.
   ============================================================ */

var WAFFLE_AI_CALENDAR_FAST_VERSION_ = '11.1.49';
var WAFFLE_AI_CALENDAR_CACHE_KEY_ = 'waffle-ai-calendar-v11149';
var WAFFLE_AI_CALENDAR_CACHE_SECONDS_ = 90;
var WAFFLE_AI_BOARDING_CAPACITY_V11149_ = 4;

function waffleAiTryFastCalendarAnswerV11149_(data) {
  data = data || {};
  var question = String(data.question || data.query || '').trim();
  if (!question) return null;

  var monthRange = waffleAiMonthRangeFromQuestionV11149_(question);
  if (!monthRange) return null;

  var q = question.toLowerCase();
  var calendarIntent = /\b(how many|which|who|list|dogs?|stays?|booked|booking|boarding|taking care|care of|capacity|available|availability|free|room|space|fit|busy|occupancy)\b/i.test(q);
  var careDetailIntent = /\b(feed|feeding|food|walk|walking|medication|medicine|meds|allerg|belongings?|profile|intake)\b/i.test(q);

  if (!calendarIntent || careDetailIntent) return null;

  var records = waffleAiCalendarRecordsCachedV11149_();
  var matching = records
    .filter(function (record) {
      return waffleAiIsConfirmedBoardingV11149_(record) &&
        waffleAiRecordOverlapsRangeV11149_(record, monthRange.start, monthRange.end);
    })
    .sort(function (a, b) {
      return waffleAiDateValueV11149_(a.startDate) - waffleAiDateValueV11149_(b.startDate);
    });

  var roster = waffleAiBuildMonthRosterV11149_(matching);
  var asksCapacity = /\b(capacity|available|availability|free|room|space|fit|occupancy|full|busy)\b/i.test(q);

  var answer = asksCapacity
    ? waffleAiCapacityAnswerV11149_(monthRange, roster, matching)
    : waffleAiRosterAnswerV11149_(monthRange, roster, matching);

  return {
    result: 'success',
    aiConfigured: true,
    version: WAFFLE_AI_CALENDAR_FAST_VERSION_,
    answer: answer,
    toolsUsed: ['get_booking_calendar'],
    source: 'calendar-fast-path',
    fastPath: true,
    complete: true,
    calendarMonth: monthRange.label,
    uniqueDogs: roster.length,
    stays: matching.length
  };
}

function waffleAiCalendarRecordsCachedV11149_() {
  var cache = CacheService.getScriptCache();
  var cached = '';

  try { cached = cache.get(WAFFLE_AI_CALENDAR_CACHE_KEY_) || ''; } catch (_) {}
  if (cached) {
    try {
      var parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }

  var source = waffleAiCalendarRecords_();
  var records = (Array.isArray(source) ? source : [])
    .map(function (record) {
      record = record || {};
      return {
        dogName: String(record.dogName || '').trim(),
        bookingType: String(record.bookingType || '').trim(),
        startDate: String(record.startDate || '').trim(),
        endDate: String(record.endDate || record.startDate || '').trim(),
        breed: String(record.breed || '').trim()
      };
    })
    .filter(function (record) {
      return !!(record.dogName && record.startDate);
    });

  try {
    var text = JSON.stringify(records);
    /* Apps Script cache values are limited; skip caching oversized histories. */
    if (text.length < 90000) {
      cache.put(WAFFLE_AI_CALENDAR_CACHE_KEY_, text, WAFFLE_AI_CALENDAR_CACHE_SECONDS_);
    }
  } catch (_) {}

  return records;
}

function waffleAiMonthRangeFromQuestionV11149_(question) {
  var q = String(question || '').toLowerCase();
  var months = [
    ['january', 'jan'], ['february', 'feb'], ['march', 'mar'],
    ['april', 'apr'], ['may'], ['june', 'jun'], ['july', 'jul'],
    ['august', 'aug'], ['september', 'sep', 'sept'], ['october', 'oct'],
    ['november', 'nov'], ['december', 'dec']
  ];

  var monthIndex = -1;
  for (var i = 0; i < months.length; i += 1) {
    for (var j = 0; j < months[i].length; j += 1) {
      var token = months[i][j];
      var re = new RegExp('\\b' + token + '\\b', 'i');
      if (re.test(q)) {
        monthIndex = i;
        break;
      }
    }
    if (monthIndex >= 0) break;
  }

  if (monthIndex < 0) return null;

  var timezone = 'Australia/Sydney';
  try { timezone = Session.getScriptTimeZone() || timezone; } catch (_) {}
  var now = new Date();
  var currentYear = Number(Utilities.formatDate(now, timezone, 'yyyy'));
  var currentMonth = Number(Utilities.formatDate(now, timezone, 'M')) - 1;

  var yearMatch = q.match(/\b(20\d{2})\b/);
  var year = yearMatch ? Number(yearMatch[1]) : currentYear;
  if (!yearMatch && monthIndex < currentMonth) year += 1;

  var start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  var end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  var label = Utilities.formatDate(start, timezone, 'MMMM yyyy');

  return {
    start: start,
    end: end,
    year: year,
    monthIndex: monthIndex,
    label: label,
    timezone: timezone
  };
}

function waffleAiIsConfirmedBoardingV11149_(record) {
  var type = String(record && record.bookingType || '').toLowerCase();
  if (/meet\s*&?\s*greet|meetgreet|potential/.test(type)) return false;
  return true;
}

function waffleAiRecordOverlapsRangeV11149_(record, rangeStart, rangeEnd) {
  var start = waffleAiDateValueV11149_(record && record.startDate);
  var end = waffleAiDateValueV11149_(record && (record.endDate || record.startDate));
  if (!isFinite(start) || !isFinite(end)) return false;
  return start <= rangeEnd.getTime() && end >= rangeStart.getTime();
}

function waffleAiDateValueV11149_(value) {
  var date = waffleAiParseDateV11149_(value);
  return date ? date.getTime() : NaN;
}

function waffleAiParseDateV11149_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  var text = String(value || '').trim();
  if (!text) return null;

  var iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0, 0);

  var au = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (au) return new Date(Number(au[3]), Number(au[2]) - 1, Number(au[1]), 12, 0, 0, 0);

  var nativeDate = new Date(text);
  return isNaN(nativeDate.getTime()) ? null : nativeDate;
}

function waffleAiBuildMonthRosterV11149_(records) {
  var byDog = {};

  (records || []).forEach(function (record) {
    var name = String(record.dogName || '').trim();
    if (!name) return;
    var key = name.toLowerCase();
    if (!byDog[key]) {
      byDog[key] = {
        dogName: name,
        breed: String(record.breed || '').trim(),
        stays: []
      };
    }
    if (!byDog[key].breed && record.breed) byDog[key].breed = String(record.breed).trim();
    byDog[key].stays.push({
      startDate: String(record.startDate || ''),
      endDate: String(record.endDate || record.startDate || '')
    });
  });

  return Object.keys(byDog)
    .map(function (key) { return byDog[key]; })
    .sort(function (a, b) {
      var aDate = a.stays.length ? waffleAiDateValueV11149_(a.stays[0].startDate) : 0;
      var bDate = b.stays.length ? waffleAiDateValueV11149_(b.stays[0].startDate) : 0;
      return aDate - bDate || a.dogName.localeCompare(b.dogName);
    });
}

function waffleAiRosterAnswerV11149_(range, roster, matching) {
  if (!roster.length) {
    return 'There are no confirmed boarding dogs recorded for ' + range.label + '.';
  }

  var lines = [
    'In ' + range.label + ', there are ' + roster.length + ' unique dog' + (roster.length === 1 ? '' : 's') +
      ' booked for boarding across ' + matching.length + ' stay' + (matching.length === 1 ? '' : 's') + ': '
  ];

  roster.forEach(function (dog) {
    var breed = dog.breed ? ' (' + dog.breed + ')' : '';
    var stays = dog.stays.map(function (stay) {
      return waffleAiFormatStayRangeV11149_(stay.startDate, stay.endDate, range.timezone);
    }).join('; ');
    lines.push('• ' + dog.dogName + breed + ' — ' + stays);
  });

  return lines.join('\n');
}

function waffleAiCapacityAnswerV11149_(range, roster, matching) {
  var daily = {};
  var cursor = new Date(range.start.getTime());
  while (cursor <= range.end) {
    var key = Utilities.formatDate(cursor, range.timezone, 'yyyy-MM-dd');
    daily[key] = {};
    cursor.setDate(cursor.getDate() + 1);
  }

  matching.forEach(function (record) {
    var start = waffleAiParseDateV11149_(record.startDate);
    var end = waffleAiParseDateV11149_(record.endDate || record.startDate);
    if (!start || !end) return;
    if (start < range.start) start = new Date(range.start.getTime());
    if (end > range.end) end = new Date(range.end.getTime());

    var day = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0);
    var endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0, 0);
    while (day <= endDay) {
      var key = Utilities.formatDate(day, range.timezone, 'yyyy-MM-dd');
      if (daily[key]) daily[key][String(record.dogName || '').toLowerCase()] = String(record.dogName || '');
      day.setDate(day.getDate() + 1);
    }
  });

  var keys = Object.keys(daily).sort();
  var peak = 0;
  var fullDays = [];
  var availableDays = 0;
  var completelyFreeDays = 0;

  keys.forEach(function (key) {
    var count = Object.keys(daily[key]).length;
    if (count > peak) peak = count;
    if (count >= WAFFLE_AI_BOARDING_CAPACITY_V11149_) fullDays.push(key);
    if (count < WAFFLE_AI_BOARDING_CAPACITY_V11149_) availableDays += 1;
    if (count === 0) completelyFreeDays += 1;
  });

  var lines = [
    range.label + ' has confirmed boarding capacity available on ' + availableDays + ' of ' + keys.length + ' days.',
    'Peak confirmed occupancy is ' + peak + '/' + WAFFLE_AI_BOARDING_CAPACITY_V11149_ + ' dogs.'
  ];

  if (fullDays.length) {
    lines.push('Fully booked (' + WAFFLE_AI_BOARDING_CAPACITY_V11149_ + '/' + WAFFLE_AI_BOARDING_CAPACITY_V11149_ + ') on: ' +
      fullDays.map(function (key) { return waffleAiFormatIsoDateV11149_(key, range.timezone); }).join(', ') + '.');
  } else {
    lines.push('There are no days currently at the ' + WAFFLE_AI_BOARDING_CAPACITY_V11149_ + '-dog confirmed capacity limit.');
  }

  if (completelyFreeDays) {
    lines.push(completelyFreeDays + ' day' + (completelyFreeDays === 1 ? ' is' : 's are') + ' currently completely free of confirmed boarding stays.');
  }

  if (roster.length) {
    lines.push('Dogs booked during the month (' + roster.length + '):');
    roster.forEach(function (dog) {
      var breed = dog.breed ? ' (' + dog.breed + ')' : '';
      var stays = dog.stays.map(function (stay) {
        return waffleAiFormatStayRangeV11149_(stay.startDate, stay.endDate, range.timezone);
      }).join('; ');
      lines.push('• ' + dog.dogName + breed + ' — ' + stays);
    });
  }

  return lines.join('\n');
}

function waffleAiFormatStayRangeV11149_(startValue, endValue, timezone) {
  var start = waffleAiParseDateV11149_(startValue);
  var end = waffleAiParseDateV11149_(endValue || startValue);
  if (!start && !end) return 'dates unavailable';
  if (!end) end = start;
  if (!start) start = end;

  var startText = Utilities.formatDate(start, timezone || 'Australia/Sydney', 'd MMM');
  var endText = Utilities.formatDate(end, timezone || 'Australia/Sydney', 'd MMM');
  return startText === endText ? startText : (startText + '–' + endText);
}

function waffleAiFormatIsoDateV11149_(value, timezone) {
  var date = waffleAiParseDateV11149_(value);
  return date
    ? Utilities.formatDate(date, timezone || 'Australia/Sydney', 'd MMM')
    : String(value || '');
}
/* ============================================================
   WAFFLE HOUSE V11.1.50 — TARGETED CALENDAR FAST PATH
   ============================================================
   V11.1.49 removed the AI-provider round trip for common month roster/capacity
   questions, but its cold path still read the entire Form Responses data range.
   On a mature form-backed sheet that can include many unrelated columns and
   historical rows and may exceed the browser's request timeout.

   V11.1.50 reads only B:L (dog, breed, dates, booking type), filters to the
   requested month immediately, and caches only that compact month result.
   ============================================================ */

var WAFFLE_AI_CALENDAR_FAST_VERSION_V11150_ = '11.1.50';
var WAFFLE_AI_CALENDAR_MONTH_CACHE_SECONDS_V11150_ = 45;

function waffleAiTryFastCalendarAnswerV11150_(data) {
  data = data || {};
  var question = String(data.question || data.query || '').trim();
  if (!question) return null;

  var monthRange = waffleAiMonthRangeFromQuestionV11149_(question);
  if (!monthRange) return null;

  var q = question.toLowerCase();
  var calendarIntent = /\b(how many|which|who|list|dogs?|stays?|booked|booking|boarding|taking care|care of|capacity|available|availability|free|room|space|fit|busy|occupancy)\b/i.test(q);
  var careDetailIntent = /\b(feed|feeding|food|walk|walking|medication|medicine|meds|allerg|belongings?|profile|intake)\b/i.test(q);

  if (!calendarIntent || careDetailIntent) return null;

  var matching = waffleAiCalendarMonthRecordsV11150_(monthRange);
  var roster = waffleAiBuildMonthRosterV11149_(matching);
  var asksCapacity = /\b(capacity|available|availability|free|room|space|fit|occupancy|full|busy)\b/i.test(q);

  var answer = asksCapacity
    ? waffleAiCapacityAnswerV11149_(monthRange, roster, matching)
    : waffleAiRosterAnswerV11149_(monthRange, roster, matching);

  return {
    result: 'success',
    aiConfigured: true,
    version: WAFFLE_AI_CALENDAR_FAST_VERSION_V11150_,
    answer: answer,
    toolsUsed: ['get_booking_calendar'],
    source: 'calendar-targeted-fast-path',
    fastPath: true,
    complete: true,
    noAiRoundTrip: true,
    calendarMonth: monthRange.label,
    uniqueDogs: roster.length,
    stays: matching.length
  };
}

function waffleAiCalendarMonthRecordsV11150_(monthRange) {
  var monthKey = monthRange.year + '-' + String(monthRange.monthIndex + 1).padStart(2, '0');
  var cacheKey = 'waffle-ai-calendar-month-v11150-' + monthKey;
  var cache = CacheService.getScriptCache();
  var cached = '';

  try { cached = cache.get(cacheKey) || ''; } catch (_) {}
  if (cached) {
    try {
      var parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }

  var sheet = getTargetSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  /*
   * Read only B:L rather than getDataRange(). Relative indexes are:
   *   0 B  dog name
   *   1 C  breed
   *   2 D  start date
   *   3 E  end date
   *  10 L  booking type
   *
   * This intentionally ignores owner/contact/form metadata because Calendar
   * roster/capacity questions do not need it.
   */
  var values = sheet.getRange(2, 2, lastRow - 1, 11).getValues();
  var records = [];
  var rangeStartMs = monthRange.start.getTime();
  var rangeEndMs = monthRange.end.getTime();

  for (var index = 0; index < values.length; index += 1) {
    var row = values[index] || [];
    var dogName = String(row[0] || '').trim();
    if (!dogName) continue;

    var bookingType = String(row[10] || 'Boarding').trim();
    var lowerType = bookingType.toLowerCase();
    if (/meet\s*&?\s*greet|meetgreet|potential/.test(lowerType)) continue;

    var start = waffleAiParseDateV11149_(row[2]);
    if (!start) continue;
    var end = waffleAiParseDateV11149_(row[3] || row[2]);
    if (!end) end = start;

    if (start.getTime() > rangeEndMs || end.getTime() < rangeStartMs) continue;

    records.push({
      dogName: dogName,
      breed: String(row[1] || '').trim(),
      bookingType: bookingType || 'Boarding',
      startDate: waffleAiCompactDateV11150_(start, monthRange.timezone),
      endDate: waffleAiCompactDateV11150_(end, monthRange.timezone)
    });
  }

  records.sort(function (a, b) {
    return waffleAiDateValueV11149_(a.startDate) - waffleAiDateValueV11149_(b.startDate) ||
      String(a.dogName || '').localeCompare(String(b.dogName || ''));
  });

  try {
    var text = JSON.stringify(records);
    if (text.length < 90000) {
      cache.put(cacheKey, text, WAFFLE_AI_CALENDAR_MONTH_CACHE_SECONDS_V11150_);
    }
  } catch (_) {}

  return records;
}

function waffleAiCompactDateV11150_(date, timezone) {
  return Utilities.formatDate(
    date,
    timezone || 'Australia/Sydney',
    'yyyy-MM-dd'
  );
}
