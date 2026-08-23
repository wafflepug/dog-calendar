/* ============================================================
   WAFFLE HOUSE V11.1.47 — AI DATA COMPATIBILITY ADAPTER
   ============================================================
   WaffleAI.js intentionally talks to stable response-style helper names. The
   historical Apps Script monolith exposes lower-level read helpers instead.
   These adapters bridge the two without renaming or rewriting Code.js.

   All functions here are READ ONLY.
   ============================================================ */

function getGuestDirectoryResponse_() {
  var directory = getGuestDirectoryPayload_();

  return {
    result: 'success',
    /* Keep bookings at the top level so WaffleAI.js can resolve a natural dog
       name to its stayKey without requiring the model to make an extra lookup. */
    records: directory && Array.isArray(directory.bookings)
      ? directory.bookings
      : [],
    directory: directory,
    calendarRecords: waffleAiCalendarRecords_()
  };
}

function getGuestProfileResponse_(data) {
  data = data || {};
  var stayKey = String(data.stayKey || '').trim();
  if (!stayKey) throw new Error('Stay Key is required.');

  return {
    result: 'success',
    record: getGuestProfileDetail_(stayKey)
  };
}

function getGuestBelongingsResponse_(data) {
  data = data || {};
  var stayKey = String(data.stayKey || '').trim();
  if (!stayKey) throw new Error('Stay Key is required.');

  return {
    result: 'success',
    record: getGuestBelongingsDetail_(stayKey)
  };
}

function getPotentialStaysResponse_() {
  return {
    result: 'success',
    records: readPotentialStayRecords_()
  };
}

function getRemindersNotesResponse_() {
  return {
    result: 'success',
    records: readRemindersNotesRecords_(500)
  };
}

function getStayOperationsResponse_(data) {
  data = data || {};
  var stayKey = String(data.stayKey || '').trim();
  if (!stayKey) throw new Error('Stay Key is required.');

  return {
    result: 'success',
    records: readStayOperations_([stayKey])
  };
}

function getAuditLogResponse_(data) {
  data = data || {};
  var limit = Math.max(1, Math.min(100, Number(data.limit || 40)));

  return {
    result: 'success',
    records: readAuditLogRecords_(limit)
  };
}

function getNotificationCentreResponse_() {
  var payload = buildNotificationCentrePayload_();
  if (payload && typeof payload === 'object') return payload;

  return {
    result: 'success',
    records: []
  };
}

function waffleAiCalendarRecords_() {
  var sheet = getTargetSheet_();
  var lastRow = sheet.getLastRow();
  var records = [];

  if (lastRow < 2) return records;

  for (var row = 2; row <= lastRow; row += 1) {
    try {
      var snapshot = auditBookingSnapshotFromSheetRow_(sheet, row);
      if (!snapshot || typeof snapshot !== 'object') continue;

      var dogName = String(snapshot.dogName || '').trim();
      var bookingType = String(snapshot.bookingType || snapshot.type || '').trim();
      var startDate = String(snapshot.startDate || snapshot.date || '').trim();
      var endDate = String(snapshot.endDate || snapshot.startDate || snapshot.date || '').trim();

      if (!dogName && !bookingType && !startDate) continue;

      records.push({
        row: row,
        dogName: dogName,
        bookingType: bookingType,
        startDate: startDate,
        endDate: endDate,
        time: String(snapshot.time || snapshot.bookingTime || '').trim(),
        breed: String(snapshot.breed || '').trim(),
        status: String(snapshot.status || '').trim()
      });
    } catch (_) {
      /* One malformed historical row must not make the entire AI calendar tool
         unavailable. The normal Calendar renderer follows the same principle. */
    }
  }

  return records;
}
