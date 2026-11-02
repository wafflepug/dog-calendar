/* Append-only event log for feeding, walk, and medication care notes. */
var CARE_ROUTINE_LOG_SHEET_NAME_ = 'Care_Routine_Log';
var CARE_ROUTINE_LOG_HEADERS_ = ['Event ID', 'Stay ID', 'Dog ID', 'Stay Key', 'Type', 'Note JSON', 'Recorded At'];
var CARE_ROUTINE_LOG_VERSION_ = 1;

function careRoutineLogSheetReadOnly_() {
  return getTargetSheet_().getParent().getSheetByName(CARE_ROUTINE_LOG_SHEET_NAME_);
}

function careRoutineLogSheetForWrite_() {
  var spreadsheet = getTargetSheet_().getParent();
  var sheet = spreadsheet.getSheetByName(CARE_ROUTINE_LOG_SHEET_NAME_);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CARE_ROUTINE_LOG_SHEET_NAME_);
    sheet.getRange(1, 1, 1, CARE_ROUTINE_LOG_HEADERS_.length).setValues([CARE_ROUTINE_LOG_HEADERS_]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CARE_ROUTINE_LOG_HEADERS_.length).setValues([CARE_ROUTINE_LOG_HEADERS_]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  var headers = sheet.getRange(1, 1, 1, CARE_ROUTINE_LOG_HEADERS_.length).getValues()[0];
  for (var i = 0; i < CARE_ROUTINE_LOG_HEADERS_.length; i++) {
    if (String(headers[i] || '') !== CARE_ROUTINE_LOG_HEADERS_[i]) throw new Error('Care routine log schema is invalid; no event was saved.');
  }
  return sheet;
}

function careRoutineLogUuidValid_(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function careRoutineLogResolveStay_(data, requireActive) {
  var stayId = String(data.stayId || '').trim().toLowerCase();
  var dogId = String(data.dogId || '').trim().toLowerCase();
  var stayKey = String(data.stayKey || '').trim();
  if (!careRoutineLogUuidValid_(stayId) || !careRoutineLogUuidValid_(dogId) || !stayKey) {
    throw new Error('A valid Stay ID, Dog ID, and Stay Key are required. Refresh the current stay and try again.');
  }

  var inventory = stayOperationBookingIndexV11226_();
  var candidates = inventory.byKey[stayKey] || [];
  var matches = candidates.filter(function(booking) {
    return String(booking.stayId || '').toLowerCase() === stayId && String(booking.dogId || '').toLowerCase() === dogId;
  });
  if (candidates.length !== 1 || matches.length !== 1 || inventory.idCounts[stayId] !== 1) {
    throw new Error('This stay could not be uniquely matched to a confirmed booking. Refresh the stay list and try again.');
  }
  var booking = matches[0];
  if (requireActive) {
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (!booking.startDate || !booking.endDate || booking.startDate > today || booking.endDate < today) {
      throw new Error('Care routine events can only be recorded for a stay in progress.');
    }
    var operations = readStayOperationsV11226_({stayKeys:[stayKey], stayIds:[stayId]});
    var sameStay = operations.filter(function(record) {
      return record.stayKey === stayKey && String(record.stayId || '').toLowerCase() === stayId;
    });
    if (sameStay.length > 1 || (sameStay.length && (sameStay[0].identityConflict || sameStay[0].status === 'checked_out'))) {
      throw new Error('This stay is checked out or its operational identity is ambiguous.');
    }
  }
  return {stayId:stayId, dogId:dogId, stayKey:stayKey, booking:booking};
}

function careRoutineLogRecordFromRow_(row) {
  var note;
  try {
    note = JSON.parse(String(row[5] || '""'));
  } catch (_) {
    throw new Error('Care routine log note data is invalid.');
  }
  if (typeof note !== 'string') throw new Error('Care routine log note data is invalid.');
  return {eventId:String(row[0] || '').toLowerCase(), stayId:String(row[1] || '').toLowerCase(), dogId:String(row[2] || '').toLowerCase(), stayKey:String(row[3] || ''), type:String(row[4] || ''), note:note, recordedAt:row[6] instanceof Date ? row[6].toISOString() : String(row[6] || '')};
}

function getCareRoutineLog_(data) {
  var identity = careRoutineLogResolveStay_(data || {}, false);
  var sheet = careRoutineLogSheetReadOnly_();
  var events = [];
  if (sheet && sheet.getLastRow() > 1) {
    var headers = sheet.getRange(1, 1, 1, CARE_ROUTINE_LOG_HEADERS_.length).getValues()[0];
    if (CARE_ROUTINE_LOG_HEADERS_.some(function(header, index) { return String(headers[index] || '') !== header; })) throw new Error('Care routine log schema is invalid.');
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, CARE_ROUTINE_LOG_HEADERS_.length).getValues();
    rows.forEach(function(row) {
      if (String(row[1] || '').toLowerCase() === identity.stayId && String(row[2] || '').toLowerCase() === identity.dogId && String(row[3] || '') === identity.stayKey) events.push(careRoutineLogRecordFromRow_(row));
    });
  }
  events.sort(function(a, b) { return String(b.recordedAt).localeCompare(String(a.recordedAt)); });
  return {result:'success', events:events.slice(0, 50), careRoutineLogVersion:CARE_ROUTINE_LOG_VERSION_};
}

function recordCareRoutineEvent_(data) {
  data = data && typeof data === 'object' ? data : {};
  var eventId = String(data.eventId || '').trim().toLowerCase();
  var type = String(data.type || '').trim().toLowerCase();
  if (!careRoutineLogUuidValid_(eventId)) throw new Error('A valid event ID is required.');
  if (['feeding', 'walk', 'medication'].indexOf(type) < 0) throw new Error('Care event type must be feeding, walk, or medication.');
  if (data.note !== undefined && data.note !== null && typeof data.note !== 'string') throw new Error('Care event note must be text.');
  var note = String(data.note || '');
  if (note.length > 500) throw new Error('Care event notes must be 500 characters or fewer.');

  var identity = careRoutineLogResolveStay_(data, false);
  var existingSheet = careRoutineLogSheetReadOnly_();
  if (existingSheet && existingSheet.getLastRow() > 1) {
    var headers = existingSheet.getRange(1, 1, 1, CARE_ROUTINE_LOG_HEADERS_.length).getValues()[0];
    if (CARE_ROUTINE_LOG_HEADERS_.some(function(header, index) { return String(headers[index] || '') !== header; })) throw new Error('Care routine log schema is invalid; no event was saved.');
    var existingRows = existingSheet.getRange(2, 1, existingSheet.getLastRow() - 1, CARE_ROUTINE_LOG_HEADERS_.length).getValues();
    for (var i = 0; i < existingRows.length; i++) {
      if (String(existingRows[i][0] || '').toLowerCase() !== eventId) continue;
      var existing = careRoutineLogRecordFromRow_(existingRows[i]);
      if (existing.stayId !== identity.stayId || existing.dogId !== identity.dogId || existing.stayKey !== identity.stayKey || existing.type !== type || existing.note !== note) {
        throw new Error('This event ID was already used with different care details.');
      }
      return {result:'success', event:existing, duplicate:true};
    }
  }

  identity = careRoutineLogResolveStay_(data, true);
  var sheet = careRoutineLogSheetForWrite_();
  var recordedAt = new Date().toISOString();
  sheet.appendRow([eventId, identity.stayId, identity.dogId, identity.stayKey, type, JSON.stringify(note), recordedAt]);
  touchWaffleDataVersion_('careRoutineLog');
  try {
    logAuditEvent_({category:'Care', action:'Care Routine Event Recorded', dogName:'', bookingType:'Boarding', reference:'', summary:'A care routine event was recorded.', changedFields:['Care routine log'], before:null, after:null, source:'Web App'});
  } catch (auditError) {}
  return {result:'success', event:{eventId:eventId, stayId:identity.stayId, dogId:identity.dogId, stayKey:identity.stayKey, type:type, note:note, recordedAt:recordedAt}};
}
