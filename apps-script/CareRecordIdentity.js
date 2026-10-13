/* Optional persisted identity for Care rows. This module never creates sheets
 * or changes headers during reads; callers append the two columns only after a
 * deliberate, identity-proven Care write. */
var CARE_RECORD_STAY_ID_HEADER_ = 'Stay ID';
var CARE_RECORD_DOG_ID_HEADER_ = 'Dog ID';
var CARE_RECORD_IDENTITY_VERSION_ = 1;

function careRecordIdentityWritesEnabled_() {
  return String(PropertiesService.getScriptProperties().getProperty('CARE_RECORD_IDENTITY_WRITES_ENABLED') || '').trim().toLowerCase() === 'true';
}

function resolveCareBookingIdentity_(stayKey, requestedStayId, requestedDogId, bookingRows) {
  var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var stayId = String(requestedStayId || '').trim(), dogId = String(requestedDogId || '').trim();
  if ((stayId && !uuid.test(stayId)) || (dogId && !uuid.test(dogId))) return { ok: false, reason: 'invalid-id' };
  var headers = bookingRows && bookingRows[0] || [], stayCol = -1, dogCol = -1, duplicateIdentityHeader = false;
  headers.forEach(function(value, index) {
    var h = String(value || '').trim().toLowerCase();
    if (h === 'stay id') { if (stayCol >= 0) duplicateIdentityHeader = true; else stayCol = index; }
    if (h === 'dog id') { if (dogCol >= 0) duplicateIdentityHeader = true; else dogCol = index; }
  });
  if (duplicateIdentityHeader) return { ok: false, reason: 'duplicate-identity-headers' };
  var byKey = [], byStayId = [], idCounts = {};
  for (var i = 1; i < (bookingRows || []).length; i++) {
    var row = bookingRows[i] || [];
    var key = makeGuestStayKey_(String(row[1] || ''), row[3], row[4] || row[3]);
    var rowStayId = stayCol < 0 ? '' : String(row[stayCol] || '').trim();
    var rowDogId = dogCol < 0 ? '' : String(row[dogCol] || '').trim();
    if (rowStayId) idCounts[rowStayId.toLowerCase()] = (idCounts[rowStayId.toLowerCase()] || 0) + 1;
    if (key === stayKey) byKey.push({ key: key, stayId: rowStayId, dogId: rowDogId });
    if (stayId && rowStayId.toLowerCase() === stayId.toLowerCase()) byStayId.push({ key: key, stayId: rowStayId, dogId: rowDogId });
  }
  var booking;
  if (stayId) {
    booking = byStayId.length === 1 ? byStayId[0] : null;
    if (!booking || booking.key !== stayKey || byKey.length !== 1 ||
        (booking.dogId && !uuid.test(booking.dogId)) ||
        (dogId && booking.dogId.toLowerCase() !== dogId.toLowerCase())) return { ok: false, reason: 'stay-id-key-or-dog-id-conflict' };
  } else {
    if (byKey.length !== 1) return { ok: false, reason: byKey.length ? 'multiple-bookings-share-stay-key' : 'no-booking-proves-stay-key' };
    booking = byKey[0];
    if ((booking.stayId && (!validStayIdV11225_(booking.stayId) || idCounts[booking.stayId.toLowerCase()] !== 1)) || (booking.dogId && !uuid.test(booking.dogId))) return { ok: false, reason: 'invalid-persisted-id' };
    if (dogId && (!booking.dogId || booking.dogId.toLowerCase() !== dogId.toLowerCase())) return { ok: false, reason: 'dog-id-key-or-persisted-id-conflict' };
  }
  return { ok: true, identity: { stayKey: stayKey, stayId: validStayIdV11225_(booking.stayId) ? booking.stayId.toLowerCase() : '', dogId: uuid.test(booking.dogId) ? booking.dogId.toLowerCase() : '' } };
}

function resolveCareBookingIdentities_(keys, bookingRows) {
  var wanted = {};
  (keys || []).forEach(function(key) { wanted[String(key || '').trim()] = true; });
  var rows = bookingRows || getTargetSheet_().getDataRange().getValues();
  var result = {};
  Object.keys(wanted).forEach(function(key) { result[key] = resolveCareBookingIdentity_(key, '', '', rows); });
  return result;
}

function describeCareRecordIdentityReads_(sheet, requestedKeys, bookingRows, identityState) {
  var state = identityState || readCareRecordIdentityState_(sheet);
  var keys = (requestedKeys || []).map(function(key) { return String(key || '').trim(); }).filter(Boolean);
  if (!keys.length && state.ok) keys = Object.keys(state.byKey);
  var bookingIdentities = state.ok ? resolveCareBookingIdentities_(keys, bookingRows) : {};
  return keys.map(function(key) {
    if (!state.ok) return { stayKey: key, status: 'unresolved', reason: state.reason };
    var rows = state.byKey[key] || [];
    if (rows.length > 1) return { stayKey: key, status: 'unresolved', reason: 'multiple-care-records-share-stay-key' };
    var booking = bookingIdentities[key];
    if (!booking || !booking.ok) return { stayKey: key, status: 'unresolved', reason: booking && booking.reason || 'no-booking-proof' };
    if (!rows.length) return { stayKey: key, status: 'not_found', identity: booking.identity };
    if (!rows[0].valid) return { stayKey: key, status: 'unresolved', reason: 'malformed-or-reused-care-id' };
    if ((rows[0].stayId && rows[0].stayId !== booking.identity.stayId) || (rows[0].dogId && rows[0].dogId !== booking.identity.dogId)) return { stayKey: key, status: 'unresolved', reason: 'care-booking-id-conflict' };
    return { stayKey: key, status: 'resolved', identity: booking.identity, method: state.legacy ? 'legacy-key-unique' : 'persisted-care-identity' };
  });
}

function readCareRecordIdentityState_(sheet) {
  var base = getBelongingsHeaders_();
  if (!sheet || !sheet.getLastRow || sheet.getLastRow() < 1) return { ok: true, legacy: true, rows: [], byKey: {}, values: [] };
  if (sheet.getMaxColumns && sheet.getMaxColumns() < base.length) return { ok: false, reason: 'invalid-care-identity-schema', rows: [], byKey: {}, values: [] };
  var lastColumn = Number(sheet.getLastColumn ? sheet.getLastColumn() : base.length);
  var width = Math.max(base.length, lastColumn);
  var values = sheet.getRange(1, 1, sheet.getLastRow(), width).getValues();
  var headers = values[0] || [];
  var stayIdCol = -1, dogIdCol = -1, bad = false;
  headers.forEach(function(value, index) {
    var normalized = String(value || '').trim().toLowerCase();
    if (normalized === CARE_RECORD_STAY_ID_HEADER_.toLowerCase()) { if (stayIdCol >= 0) bad = true; else stayIdCol = index; }
    if (normalized === CARE_RECORD_DOG_ID_HEADER_.toLowerCase()) { if (dogIdCol >= 0) bad = true; else dogIdCol = index; }
  });
  for (var i = 0; i < base.length; i++) if (String(headers[i] || '').trim() !== base[i]) bad = true;
  if (lastColumn !== base.length && lastColumn !== base.length + 2) bad = true;
  if (lastColumn === base.length + 2 && (stayIdCol !== base.length || dogIdCol !== base.length + 1)) bad = true;
  if ((stayIdCol < 0) !== (dogIdCol < 0) || (stayIdCol >= 0 && (stayIdCol !== base.length || dogIdCol !== base.length + 1))) bad = true;
  if (bad) return { ok: false, reason: 'invalid-care-identity-schema', rows: [], byKey: {} };
  var seenStay = {}, byKey = {}, rows = [], uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (var ri = 1; ri < values.length; ri++) {
    var row = values[ri] || [], key = String(row[1] || '').trim();
    if (!key) continue;
    var stayId = stayIdCol < 0 ? '' : String(row[stayIdCol] || '').trim().toLowerCase();
    var dogId = dogIdCol < 0 ? '' : String(row[dogIdCol] || '').trim().toLowerCase();
    var entry = { rowNumber: ri + 1, stayKey: key, stayId: stayId, dogId: dogId, valid: (!stayId || uuid.test(stayId)) && (!dogId || uuid.test(dogId)) };
    if (stayId) { if (seenStay[stayId]) { seenStay[stayId].valid = false; entry.valid = false; } else seenStay[stayId] = entry; }
    rows.push(entry); (byKey[key] || (byKey[key] = [])).push(entry);
  }
  return { ok: true, legacy: stayIdCol < 0, rows: rows, byKey: byKey, values: values };
}

function resolveCareRecordIdentityForWrite_(sheet, data) {
  var key = String(data && data.stayKey || '').trim();
  if (!key) throw new Error('Care write blocked: Stay Key is required.');
  var state = readCareRecordIdentityState_(sheet);
  if (!state.ok) throw new Error('Care write blocked: ' + state.reason + '.');
  var matching = state.byKey[key] || [];
  if (matching.length > 1) throw new Error('Care write blocked: multiple Care rows share this Stay Key.');
  var proof = resolveCareBookingIdentity_(key, String(data.stayId || ''), String(data.dogId || ''), getTargetSheet_().getDataRange().getValues());
  if (!proof.ok) throw new Error('Care write blocked: booking identity is unresolved (' + proof.reason + ').');
  var identity = proof.identity;
  if ((data.stayId && String(data.stayId).toLowerCase() !== String(identity.stayId || '').toLowerCase()) ||
      (data.dogId && String(data.dogId).toLowerCase() !== String(identity.dogId || '').toLowerCase())) {
    throw new Error('Care write blocked: supplied IDs conflict with the proven booking identity.');
  }
  if (matching.length) {
    var stored = matching[0];
    if (!stored.valid) throw new Error('Care write blocked: stored Care identity is malformed or reused.');
    if ((stored.stayId && stored.stayId !== String(identity.stayId || '').toLowerCase()) ||
        (stored.dogId && stored.dogId !== String(identity.dogId || '').toLowerCase())) {
      throw new Error('Care write blocked: stored Care IDs conflict with the proven booking identity.');
    }
  }
  return { identity: { stayKey: key, stayId: String(identity.stayId || '').toLowerCase(), dogId: String(identity.dogId || '').toLowerCase() }, state: state, row: matching[0] || null };
}

function ensureCareRecordIdentityHeadersForWrite_(sheet, allowEnrollment) {
  var state = readCareRecordIdentityState_(sheet);
  if (!state.ok) throw new Error('Care write blocked: ' + state.reason + '.');
  if (state.legacy) {
    if (!allowEnrollment) return false;
    if (sheet.getMaxColumns && sheet.getMaxColumns() < getBelongingsHeaders_().length + 2) sheet.insertColumnsAfter(sheet.getMaxColumns(), getBelongingsHeaders_().length + 2 - sheet.getMaxColumns());
    sheet.getRange(1, getBelongingsHeaders_().length + 1, 1, 2).setValues([[CARE_RECORD_STAY_ID_HEADER_, CARE_RECORD_DOG_ID_HEADER_]]);
    return true;
  }
  return true;
}

function assertCareRecordWriteIdentity_(sheet, data) {
  var resolved = resolveCareRecordIdentityForWrite_(sheet, data || {});
  var row = resolved.row ? resolved.row.rowNumber : findBelongingsRow_(sheet, resolved.identity.stayKey);
  if (row < 0) throw new Error('Care write blocked: the uniquely identified Care row was not found.');
  var hasIdentityColumns = ensureCareRecordIdentityHeadersForWrite_(sheet, careRecordIdentityWritesEnabled_());
  if (careRecordIdentityWritesEnabled_() && hasIdentityColumns) sheet.getRange(row, getBelongingsHeaders_().length + 1, 1, 2).setValues([[resolved.identity.stayId, resolved.identity.dogId]]);
  return { row: row, identity: resolved.identity };
}
