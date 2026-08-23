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
