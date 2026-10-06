/* Additive stable booking identity and durable mutation receipt helpers.
 * This module deliberately leaves Dog ID, legacy stayKey and media keys alone.
 */
var STABLE_STAY_IDENTITY_VERSION_V11225_ = 1;
var STAY_ID_HEADER_V11225_ = 'Stay ID';
var STAY_MUTATION_MARKER_HEADER_V11225_ = 'Last Stay Mutation ID';
var STAY_RECEIPT_SHEET_V11225_ = 'Stay_Mutation_Receipts';
var STAY_RECEIPT_HEADERS_V11225_ = [
  'Client Mutation ID', 'Action', 'Payload Digest', 'State', 'Stay ID',
  'Response JSON', 'Created At', 'Updated At'
];
var STAY_IDENTITY_ACTIONS_V11225_ = {
  create_boarding: true,
  create_potential: true,
  update_boarding_dates: true,
  update_potential: true,
  confirm_potential: true,
  delete_potential: true,
  delete_confirmed_stay: true
};
var WAFFLE_V11225_RECEIPT_LOCK_HELD_ = false;

function stableStayHeadersV11225_(sheet, create) {
  var lastColumn = Math.max(12, Number(sheet.getLastColumn ? sheet.getLastColumn() : 12));
  if (sheet.getMaxColumns && sheet.getMaxColumns() < lastColumn) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), lastColumn - sheet.getMaxColumns());
  }
  var header = sheet.getRange(1, 1, 1, lastColumn).getValues()[0] || [];
  var cols = {};
  var duplicates = {};
  header.forEach(function(value, index) {
    var name = String(value || '').trim().toLowerCase();
    if (name) {
      if (cols[name]) duplicates[name] = true;
      else cols[name] = index + 1;
    }
  });
  if (duplicates[STAY_ID_HEADER_V11225_.toLowerCase()] || duplicates[STAY_MUTATION_MARKER_HEADER_V11225_.toLowerCase()]) {
    throw new Error('Duplicate Stay ID or mutation marker headers; booking changes are blocked for safety.');
  }
  [STAY_ID_HEADER_V11225_, STAY_MUTATION_MARKER_HEADER_V11225_].forEach(function(name) {
    var key = name.toLowerCase();
    if (!cols[key] && create) {
      if (sheet.getMaxColumns && sheet.getMaxColumns() < lastColumn + 1) sheet.insertColumnsAfter(sheet.getMaxColumns(), 1);
      lastColumn += 1;
      sheet.getRange(1, lastColumn).setValue(name);
      cols[key] = lastColumn;
    }
  });
  return {
    stayId: cols[STAY_ID_HEADER_V11225_.toLowerCase()] || 0,
    mutationId: cols[STAY_MUTATION_MARKER_HEADER_V11225_.toLowerCase()] || 0,
    width: Math.max(lastColumn, sheet.getLastColumn ? sheet.getLastColumn() : lastColumn)
  };
}

function validStayIdV11225_(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function validStableStayDateV11225_(value) {
  var text = normalizeDateValue_(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  var date = new Date(text + 'T00:00:00Z');
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function stableStayIdAtV11225_(rows, zeroBasedRow) {
  if (!rows || !rows.length || zeroBasedRow < 0) return '';
  var header = rows[0] || [];
  var col = header.map(function(value) { return String(value || '').trim().toLowerCase(); })
    .indexOf(STAY_ID_HEADER_V11225_.toLowerCase());
  return col < 0 ? '' : String((rows[zeroBasedRow] || [])[col] || '').trim();
}

function ensureStableStayIdV11225_(sheet, rowNumber) {
  var cols = stableStayHeadersV11225_(sheet, true);
  var id = String(sheet.getRange(rowNumber, cols.stayId).getValue() || '').trim();
  if (!id) {
    id = Utilities.getUuid();
    sheet.getRange(rowNumber, cols.stayId).setValue(id);
  }
  if (!validStayIdV11225_(id)) throw new Error('Stored Stay ID is malformed; booking changes are blocked.');
  return id.toLowerCase();
}

function setStableStayMutationMarkerV11225_(sheet, rowNumber, mutationId) {
  var cols = stableStayHeadersV11225_(sheet, true);
  sheet.getRange(rowNumber, cols.mutationId).setValue(String(mutationId || '').trim());
}

function updateStableStayRowV11225_(sheet, rowNumber, changes, mutationId) {
  var cols = stableStayHeadersV11225_(sheet, true);
  var width = Math.max(cols.width, sheet.getLastColumn());
  var row = sheet.getRange(rowNumber, 1, 1, width).getValues()[0] || [];
  var formulas = sheet.getRange(rowNumber, 1, 1, width).getFormulas ? sheet.getRange(rowNumber, 1, 1, width).getFormulas()[0] : [];
  while (row.length < width) row.push('');
  while (formulas.length < width) formulas.push('');
  for (var i = 0; i < formulas.length; i++) if (formulas[i]) row[i] = formulas[i];
  Object.keys(changes || {}).forEach(function(column) {
    row[Number(column) - 1] = changes[column];
  });
  if (mutationId) row[cols.mutationId - 1] = String(mutationId);
  sheet.getRange(rowNumber, 1, 1, width).setValues([row]);
}

function safeLegacyStayRowV11225_(rows, action, data) {
  data = data || {};
  var wantedType = action === 'update_potential' || action === 'confirm_potential' || action === 'delete_potential'
    ? 'potential stay' : '';
  var dog = normalizeV108Identity_(data.originalDogName || data.dogName || '');
  var start = normalizeDateValue_(data.originalStartDate || data.startDate || '');
  var end = normalizeDateValue_(data.originalEndDate || data.endDate || '');
  var owner = normalizeV108Identity_(data.originalOwnerName || data.ownerName || '');
  var breed = normalizeV108Identity_(data.originalBreed || data.breed || '');
  var phone = String(data.originalPhone || data.phone || '').replace(/\D/g, '');
  var dogId = String(data.dogId || '').trim();
  if (!dog || !start) throw new Error('Dog name and original stay start date are required for a legacy booking lookup.');
  var exact = [];
  var relaxed = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i] || [];
    var type = String(row[11] || '').trim().toLowerCase();
    if (wantedType ? type !== wantedType && type !== 'potential' : type !== 'confirmed boarding' && type !== 'boarding') continue;
    if (dog && normalizeV108Identity_(row[1]) !== dog) continue;
    if (start && normalizeDateValue_(row[3]) !== start) continue;
    if (owner && normalizeV108Identity_(row[5]) !== owner) continue;
    if (breed && normalizeV108Identity_(row[2]) !== breed) continue;
    if (phone && String(row[6] || '').replace(/\D/g, '') !== phone) continue;
    if (dogId) {
      var identity = v108DogIdentityAt_(rows, i);
      if (String(identity.dogId || '').trim() !== dogId) continue;
    }
    if (!end || normalizeDateValue_(row[4] || row[3]) === end) exact.push(i + 1);
  }
  if (exact.length > 1) throw new Error('Several bookings match this request. Refresh and select the exact stay; no row was changed.');
  return exact.length ? exact[0] : -1;
}

function assertStayRowActionCompatibleV11225_(sheet, row, action, data) {
  if (row < 2) throw new Error('Booking could not be found by Stay ID.');
  var values = sheet.getRange(row, 1, 1, Math.max(12, sheet.getLastColumn())).getValues()[0] || [];
  var type = String(values[11] || '').trim().toLowerCase();
  var wantsPotential = action === 'update_potential' || action === 'confirm_potential' || action === 'delete_potential';
  if (wantsPotential ? (type !== 'potential stay' && type !== 'potential') : (type !== 'confirmed boarding' && type !== 'boarding')) {
    throw new Error('Stay ID does not identify a booking of the requested type.');
  }
  var requestedName = normalizeV108Identity_(data.originalDogName || data.dogName || '');
  if (requestedName && normalizeV108Identity_(values[1]) !== requestedName) {
    throw new Error('Stay ID and dog name do not match. Refresh the booking and try again.');
  }
  var requestedDogId = String(data.dogId || '').trim();
  if (requestedDogId) {
    var rows = sheet.getDataRange().getValues();
    if (String(v108DogIdentityAt_(rows, row - 1).dogId || '').trim() !== requestedDogId) {
      throw new Error('Stay ID and Dog ID do not match. Refresh the booking and try again.');
    }
  }
}

function resolveStayMutationRowV11225_(sheet, data) {
  var stayId = String(data.stayId || '').trim();
  if (stayId) {
    var identified = findStayRowByIdV11225_(sheet, stayId);
    if (identified >= 0) assertStayRowActionCompatibleV11225_(sheet, identified, data.action, data);
    return identified;
  }
  var rows = sheet.getDataRange().getValues();
  if (data.action === 'update_boarding_dates') {
    return safeLegacyStayRowV11225_(rows, data.action, data);
  }
  return safeLegacyStayRowV11225_(rows, data.action, data);
}

function reserveStayMutationV11225_(receiptSheet, receipt, row, data) {
  var stayId = receipt.stayId;
  var responseJson = '';
  if (receipt.action === 'delete_confirmed_stay' || receipt.action === 'delete_potential') {
    var bookingSheet = getTargetSheet_();
    var before = auditBookingSnapshotFromSheetRow_(bookingSheet, row) || {};
    before.stayId = stayId;
    responseJson = JSON.stringify({ result: 'success', action: receipt.action, stayId: stayId,
      row: row, deletedBooking: before, clientMutationId: receipt.id });
  } else if (/^create_/.test(receipt.action)) {
    var expectedCreate = {
      dogName: String(data.dogName || '').trim(), breed: String(data.breed || '').trim(),
      startDate: normalizeDateValue_(data.startDate), endDate: normalizeDateValue_(data.endDate || data.startDate),
      ownerName: String(data.ownerName || '').trim(), phone: String(data.phone || '').trim(),
      notes: String(data.notes || '').trim(),
      bookingType: receipt.action === 'create_potential' ? 'Potential Stay' : 'Confirmed Boarding'
    };
    if (String(data.dogId || '').trim()) expectedCreate.dogId = String(data.dogId).trim();
    if (data.inheritDogPhoto === true) expectedCreate.inheritDogPhoto = true;
    if (data.inheritCareReview && data.inheritCareReview.confirmed === true) {
      expectedCreate.inheritCareReview = data.inheritCareReview;
    }
    responseJson = JSON.stringify({ recoveryPlan: { expected: expectedCreate } });
  } else {
    var sourceSheet = getTargetSheet_();
    var beforeSnapshot = auditBookingSnapshotFromSheetRow_(sourceSheet, row) || {};
    beforeSnapshot.stayId = stayId;
    var plan = { before: beforeSnapshot, expected: {} };
    if (receipt.action === 'update_boarding_dates') {
      ['dogName', 'breed', 'ownerName', 'phone', 'bookingType'].forEach(function(key) {
        if (beforeSnapshot[key] !== undefined) plan.expected[key] = String(beforeSnapshot[key] || '');
      });
      plan.oldStayKey = makeGuestStayKey_(beforeSnapshot.dogName, beforeSnapshot.startDate, beforeSnapshot.endDate);
      plan.newStayKey = makeGuestStayKey_(beforeSnapshot.dogName,
        normalizeDateValue_(data.startDate), normalizeDateValue_(data.endDate || data.startDate));
      plan.dogName = beforeSnapshot.dogName;
      plan.expected.startDate = normalizeDateValue_(data.startDate);
      plan.expected.endDate = normalizeDateValue_(data.endDate || data.startDate);
    } else if (receipt.action === 'update_potential' || receipt.action === 'confirm_potential') {
      plan.expected = { dogName: String(data.dogName || ''), breed: String(data.breed || ''),
        startDate: normalizeDateValue_(data.startDate), endDate: normalizeDateValue_(data.endDate || data.startDate),
        ownerName: String(data.ownerName || ''), phone: String(data.phone || ''),
        notes: String(data.notes || ''),
        bookingType: receipt.action === 'confirm_potential' ? 'Confirmed Boarding' : 'Potential Stay' };
    }
    responseJson = JSON.stringify({ recoveryPlan: plan });
  }
  receipt.state = 'pending';
  receipt.responseJson = responseJson;
  receipt.createdAt = new Date();
  receipt.row = writeStayMutationReceiptV11225_(receiptSheet, -1, receipt);
  return receipt.row;
}

function recoverPendingStayForTargetV11225_(receiptSheet, bookingSheet, stayId) {
  if (!stayId || receiptSheet.getLastRow() < 2) return;
  var values = receiptSheet.getRange(2, 1, receiptSheet.getLastRow() - 1, STAY_RECEIPT_HEADERS_V11225_.length).getValues();
  values.forEach(function(value, index) {
    if (String(value[3] || '') !== 'pending' || String(value[4] || '').toLowerCase() !== stayId.toLowerCase()) return;
    var receipt = { row: index + 2, id: String(value[0] || ''), action: String(value[1] || ''),
      digest: String(value[2] || ''), state: 'pending', stayId: String(value[4] || ''),
      responseJson: String(value[5] || ''), createdAt: value[6] };
    if (receipt.action === 'create_boarding' || receipt.action === 'create_potential') {
      recoverCreatedStayMutationV11225_(receiptSheet, receipt, bookingSheet);
    } else recoverStayMutationV11225_(receiptSheet, receipt, bookingSheet);
  });
}

function recoverCreatedStayMutationV11225_(receiptSheet, receipt, bookingSheet) {
  var row = findStayRowByIdV11225_(bookingSheet, receipt.stayId);
  var cols = stableStayHeadersV11225_(bookingSheet, false);
  if (row < 0 || String(bookingSheet.getRange(row, cols.mutationId).getValue() || '') !== receipt.id) {
    throw new Error('This booking change is pending but cannot be verified. It was not replayed; refresh and contact support if it remains pending.');
  }
  var rows = bookingSheet.getDataRange().getValues();
  var dog = v108DogIdentityAt_(rows, row - 1);
  var expected = {};
  try { expected = JSON.parse(receipt.responseJson || '{}').recoveryPlan.expected || {}; } catch (_) {}
  if (!expected.dogName || !expected.startDate || !expected.endDate || !expected.bookingType) {
    throw new Error('The pending create has no verifiable result plan. It was not replayed.');
  }
  var actual = bookingSheet.getRange(row, 1, 1, Math.max(12, bookingSheet.getLastColumn())).getValues()[0] || [];
  if ((expected.startDate && normalizeDateValue_(actual[3]) !== expected.startDate) ||
      (expected.endDate && normalizeDateValue_(actual[4] || actual[3]) !== expected.endDate) ||
      (expected.dogName && normalizeV108Identity_(actual[1]) !== normalizeV108Identity_(expected.dogName)) ||
      (expected.breed !== undefined && normalizeV108Identity_(actual[2]) !== normalizeV108Identity_(expected.breed)) ||
      (expected.ownerName !== undefined && normalizeV108Identity_(actual[5]) !== normalizeV108Identity_(expected.ownerName)) ||
      (expected.phone !== undefined && String(actual[6] || '').replace(/\D/g, '') !== String(expected.phone || '').replace(/\D/g, '')) ||
      (expected.notes !== undefined && String(actual[9] || '') !== String(expected.notes || '')) ||
      (expected.bookingType && normalizeV108Identity_(actual[11]) !== normalizeV108Identity_(expected.bookingType)) ||
      (expected.dogId && String(dog.dogId || '').trim() !== expected.dogId)) {
    throw new Error('This pending created booking no longer matches its recorded result. It was not replayed.');
  }
  if (!dog.dogId) throw new Error('The created booking is missing its assigned Dog ID; receipt recovery stopped.');
  dog = assignV108DogIdentity_(bookingSheet, row, dog.dogId);
  if (expected.inheritCareReview && typeof applyReviewedCareInheritanceV11225_ === 'function') {
    applyReviewedCareInheritanceV11225_(expected.inheritCareReview, dog.dogId, expected.dogName,
      makeGuestStayKey_(expected.dogName, expected.startDate, expected.endDate), expected.startDate, expected.endDate);
  }
  var dogPhotoSync = { applied:false, reason:expected.inheritDogPhoto ? 'photo-sync-unavailable' : 'not-requested' };
  if (expected.inheritDogPhoto === true && typeof seedDogStayPhotoForConfirmedBookingV11208_ === 'function') {
    dogPhotoSync = seedDogStayPhotoForConfirmedBookingV11208_({
      dogId:dog.dogId, dogName:expected.dogName, breed:expected.breed,
      stayKey:makeGuestStayKey_(expected.dogName, expected.startDate, expected.endDate), stayId:receipt.stayId
    });
    if (dogPhotoSync && dogPhotoSync.reason === 'photo-source-unavailable') {
      throw new Error('The booking exists, but its selected Dog ID photo source is temporarily unavailable. Retry the same booking request to finish photo inheritance.');
    }
  }
  rows = bookingSheet.getDataRange().getValues();
  var booking = auditBookingSnapshotFromSheetRow_(bookingSheet, row) || {};
  booking.stayId = receipt.stayId;
  var response = { result: 'success', action: receipt.action, row: row, stayId: receipt.stayId,
    booking: booking, dogId: dog.dogId || '', dogNumber: dog.dogNumber || '',
    clientMutationId: receipt.id, recovered: true, followUpNeeded: true, dogPhotoSync:dogPhotoSync };
  writeStayMutationReceiptV11225_(receiptSheet, receipt.row, { id: receipt.id, action: receipt.action,
    digest: receipt.digest, state: 'succeeded', stayId: receipt.stayId,
    responseJson: JSON.stringify(response), createdAt: receipt.createdAt });
  return response;
}

function appendStableStayRowV11225_(sheet, rowData, stayId, mutationId) {
  var cols = stableStayHeadersV11225_(sheet, true);
  var data = (rowData || []).slice();
  while (data.length < cols.width) data.push('');
  if (sheet.getMaxColumns && sheet.getMaxColumns() < cols.width) sheet.insertColumnsAfter(sheet.getMaxColumns(), cols.width - sheet.getMaxColumns());
  data[cols.stayId - 1] = String(stayId || Utilities.getUuid()).trim().toLowerCase();
  if (!validStayIdV11225_(data[cols.stayId - 1])) throw new Error('Reserved Stay ID is malformed.');
  if (findStayRowByIdV11225_(sheet, data[cols.stayId - 1]) >= 2) throw new Error('Stay ID is already assigned to a booking.');
  var receiptSheet = stayMutationReceiptSheetV11225_();
  if (stayIdAlreadyReceiptedV11225_(receiptSheet, data[cols.stayId - 1], mutationId)) {
    throw new Error('Stay ID is already reserved by another mutation or a deleted booking.');
  }
  data[cols.mutationId - 1] = String(mutationId || '');
  sheet.appendRow(data);
  return { row: sheet.getLastRow(), stayId: data[cols.stayId - 1] };
}

function backfillStableStayIdsV11225_() {
  var sheet = getTargetSheet_();
  var cols = stableStayHeadersV11225_(sheet, true);
  var rows = sheet.getDataRange().getValues();
  var assigned = 0;
  var seen = {};
  for (var check = 1; check < rows.length; check++) {
    var known = String(rows[check][cols.stayId - 1] || '').trim();
    if (!known) continue;
    var knownKey = known.toLowerCase();
    if (!validStayIdV11225_(known) || seen[knownKey]) throw new Error('Existing Stay IDs are malformed or duplicated; no backfill was applied.');
    seen[knownKey] = true;
  }
  for (var validate = 1; validate < rows.length; validate++) {
    var typeToValidate = String(rows[validate][11] || '').trim().toLowerCase();
    var bookingType = typeToValidate === 'confirmed boarding' || typeToValidate === 'boarding' || typeToValidate === 'potential stay' || typeToValidate === 'potential';
    if (!bookingType) continue;
    var startToValidate = rows[validate][3];
    var endToValidate = rows[validate][4] || startToValidate;
    if (!String(rows[validate][1] || '').trim() || !validStableStayDateV11225_(startToValidate) ||
        !validStableStayDateV11225_(endToValidate) || normalizeDateValue_(endToValidate) < normalizeDateValue_(startToValidate)) {
      throw new Error('A boarding/potential row has a blank or malformed identity field/date; no backfill was applied.');
    }
  }
  for (var i = 1; i < rows.length; i++) {
    var type = String(rows[i][11] || '').trim().toLowerCase();
    if (type !== 'confirmed boarding' && type !== 'boarding' && type !== 'potential stay' && type !== 'potential') continue;
    if (!String(rows[i][cols.stayId - 1] || '').trim()) {
      var id = Utilities.getUuid();
      id = String(id).toLowerCase();
      if (!validStayIdV11225_(id) || seen[id]) throw new Error('Could not generate a unique Stay ID; backfill stopped.');
      sheet.getRange(i + 1, cols.stayId).setValue(id);
      seen[id] = true;
      assigned++;
    }
  }
  if (assigned && typeof touchWaffleDataVersion_ === 'function') {
    touchWaffleDataVersion_('directory');
    touchWaffleDataVersion_('calendar');
  }
  return { result: 'success', action: 'backfill_stay_ids', assigned: assigned,
    scannedRows: Math.max(0, rows.length - 1), version: STABLE_STAY_IDENTITY_VERSION_V11225_ };
}

function stayMutationReceiptSheetV11225_() {
  var sheet = getTargetSheet_();
  var ss = sheet.getParent();
  var receipt = ss.getSheetByName(STAY_RECEIPT_SHEET_V11225_);
  if (!receipt) receipt = ss.insertSheet(STAY_RECEIPT_SHEET_V11225_);
  if (receipt.getMaxColumns && receipt.getMaxColumns() < STAY_RECEIPT_HEADERS_V11225_.length) {
    receipt.insertColumnsAfter(receipt.getMaxColumns(), STAY_RECEIPT_HEADERS_V11225_.length - receipt.getMaxColumns());
  }
  if (!receipt.getLastRow()) {
    receipt.getRange(1, 1, 1, STAY_RECEIPT_HEADERS_V11225_.length).setValues([STAY_RECEIPT_HEADERS_V11225_]);
    receipt.setFrozenRows(1);
  }
  var current = receipt.getRange(1, 1, 1, STAY_RECEIPT_HEADERS_V11225_.length).getValues()[0];
  for (var i = 0; i < STAY_RECEIPT_HEADERS_V11225_.length; i++) {
    if (String(current[i] || '') !== STAY_RECEIPT_HEADERS_V11225_[i]) {
      throw new Error('Stay_Mutation_Receipts header mismatch; mutation is blocked for safety.');
    }
  }
  return receipt;
}

function findStayMutationReceiptV11225_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var values = sheet.getRange(2, 1, last - 1, STAY_RECEIPT_HEADERS_V11225_.length).getValues();
  var found = -1;
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() !== id) continue;
    if (found !== -1) throw new Error('Duplicate mutation receipt ID is corrupt; contact support.');
    found = i + 2;
  }
  return found;
}

function stayIdAlreadyReceiptedV11225_(sheet, stayId, allowedPendingMutationId) {
  if (!sheet || sheet.getLastRow() < 2) return false;
  var wanted = String(stayId || '').trim().toLowerCase();
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, STAY_RECEIPT_HEADERS_V11225_.length).getValues();
  return values.some(function(value) {
    if (String(value[4] || '').trim().toLowerCase() !== wanted) return false;
    return !(allowedPendingMutationId && String(value[0] || '') === String(allowedPendingMutationId) && String(value[3] || '') === 'pending');
  });
}

function canonicalStayMutationPayloadV11225_(data) {
  function sort(value) {
    if (Array.isArray(value)) return value.map(sort);
    if (!value || typeof value !== 'object') return value;
    var out = {};
    Object.keys(value).sort().forEach(function(key) {
      if (key === 'clientMutationId' || key === 'sourceRow' || key === 'row' || key === '_stayIdReserved') return;
      out[key] = sort(value[key]);
    });
    return out;
  }
  var canonical = JSON.stringify(sort(data || {}));
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonical, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest);
}

function writeStayMutationReceiptV11225_(sheet, row, receipt) {
  var values = [receipt.id, receipt.action, receipt.digest, receipt.state, receipt.stayId || '',
    receipt.responseJson || '', receipt.createdAt || new Date(), new Date()];
  if (row < 0) {
    sheet.appendRow(values);
    return sheet.getLastRow();
  }
  sheet.getRange(row, 1, 1, values.length).setValues([values]);
  return row;
}

function getStayMutationReceiptV11225_(sheet, row) {
  if (row < 2) return null;
  var value = sheet.getRange(row, 1, 1, STAY_RECEIPT_HEADERS_V11225_.length).getValues()[0];
  return { row: row, id: String(value[0] || ''), action: String(value[1] || ''), digest: String(value[2] || ''),
    state: String(value[3] || ''), stayId: String(value[4] || ''), responseJson: String(value[5] || ''), createdAt: value[6] };
}

function findStayRowByIdV11225_(sheet, stayId) {
  stayId = String(stayId || '').trim();
  if (!stayId) return -1;
  if (!validStayIdV11225_(stayId)) throw new Error('Stay ID is malformed. Refresh the booking and try again.');
  var cols = stableStayHeadersV11225_(sheet, false);
  if (!cols.stayId || sheet.getLastRow() < 2) return -1;
  var values = sheet.getRange(2, cols.stayId, sheet.getLastRow() - 1, 1).getDisplayValues();
  var found = -1;
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() !== stayId.toLowerCase()) continue;
    if (found !== -1) throw new Error('Stay ID collision detected; booking mutation is blocked.');
    found = i + 2;
  }
  return found;
}

function recoverStayMutationV11225_(receiptSheet, receipt, bookingSheet) {
  var action = receipt.action;
  var row = findStayRowByIdV11225_(bookingSheet, receipt.stayId);
  if (row < 0) {
    if ((action === 'delete_confirmed_stay' || action === 'delete_potential') && receipt.responseJson) {
      var deleted = JSON.parse(receipt.responseJson);
      deleted.duplicate = true;
      writeStayMutationReceiptV11225_(receiptSheet, receipt.row, {
        id: receipt.id, action: action, digest: receipt.digest, state: 'succeeded', stayId: receipt.stayId,
        responseJson: JSON.stringify(deleted), createdAt: receipt.createdAt
      });
      return deleted;
    }
    throw new Error('This booking change is pending but cannot be verified. It was not replayed; refresh and contact support if it remains pending.');
  }
  var cols = stableStayHeadersV11225_(bookingSheet, false);
  var marker = String(bookingSheet.getRange(row, cols.mutationId).getValue() || '').trim();
  if (marker !== receipt.id) {
    throw new Error('This booking change is pending and its write marker is no longer verifiable. It was not replayed.');
  }
  var pendingPlan = {};
  try { pendingPlan = JSON.parse(receipt.responseJson || '{}').recoveryPlan || {}; } catch (_) {}
  var expected = pendingPlan.expected || {};
  var actual = bookingSheet.getRange(row, 1, 1, Math.max(12, bookingSheet.getLastColumn())).getValues()[0] || [];
  function expectedMismatch(key, actualValue) {
    return Object.prototype.hasOwnProperty.call(expected, key) && String(actualValue || '') !== String(expected[key] || '');
  }
  if ((expected.startDate && normalizeDateValue_(actual[3]) !== expected.startDate) ||
      (expected.endDate && normalizeDateValue_(actual[4] || actual[3]) !== expected.endDate) ||
      expectedMismatch('dogName', actual[1]) || expectedMismatch('breed', actual[2]) ||
      expectedMismatch('ownerName', actual[5]) || expectedMismatch('phone', actual[6]) ||
      expectedMismatch('notes', actual[9]) || expectedMismatch('bookingType', actual[11])) {
    throw new Error('This pending booking write no longer matches its recorded result. It was not replayed.');
  }
  if (action === 'update_boarding_dates' && pendingPlan.oldStayKey && pendingPlan.newStayKey && pendingPlan.oldStayKey !== pendingPlan.newStayKey) {
    migrateBelongingsIdentityForGuest_(bookingSheet.getParent(), pendingPlan.oldStayKey, pendingPlan.newStayKey, pendingPlan.dogName);
    migrateIntakeIdentitiesForGuest_(pendingPlan.oldStayKey, pendingPlan.newStayKey, pendingPlan.dogName);
  }
  var recoveredDog = null;
  if (action === 'confirm_potential') {
    ensureV108DogIdColumn_(bookingSheet);
    var dogRows = bookingSheet.getDataRange().getValues();
    var existingDogId = v108DogIdentityAt_(dogRows, row - 1).dogId;
    recoveredDog = assignV108DogIdentity_(bookingSheet, row, existingDogId || '');
  }
  var snapshot = auditBookingSnapshotFromSheetRow_(bookingSheet, row) || {};
  snapshot.stayId = receipt.stayId;
  var response = { result: 'success', action: action, stayId: receipt.stayId, booking: snapshot,
    row: row, clientMutationId: receipt.id, recovered: true };
  if (recoveredDog) {
    response.dogId = recoveredDog.dogId;
    response.dogNumber = recoveredDog.dogNumber;
  }
  writeStayMutationReceiptV11225_(receiptSheet, receipt.row, {
    id: receipt.id, action: action, digest: receipt.digest, state: 'succeeded', stayId: receipt.stayId,
    responseJson: JSON.stringify(response), createdAt: receipt.createdAt
  });
  return response;
}

function stableStayMutationResponseV11225_(data, result, stayId) {
  result = result && typeof result === 'object' ? result : { result: 'success', action: data.action };
  result.stayId = String(stayId || result.stayId || '');
  result.clientMutationId = String(data.clientMutationId || '');
  if (result.booking && typeof result.booking === 'object') result.booking.stayId = result.stayId;
  return result;
}

