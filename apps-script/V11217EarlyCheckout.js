/* ============================================================
 * WAFFLE HOUSE V11.2.17 — OWNER-REQUESTED EARLY CHECKOUT
 * ------------------------------------------------------------
 * Records an early checkout as an operational event without changing the
 * original booking dates. The original scheduled checkout remains available
 * for history/audit while the actual checkout date/time is recorded separately.
 * ============================================================ */

var EARLY_CHECKOUT_VERSION_V11217_ = '11.2.17';
var STAY_OPERATION_IDENTITY_VERSION_V11226_ = 1;
var STAY_OPERATION_STAY_ID_HEADER_V11226_ = 'Stay ID';
var STAY_OPERATION_HEADERS_V11226_ = [
  'Updated At', 'Stay Key', 'Dog Name', 'Start Date', 'End Date', 'Status',
  'Checked In At', 'Checked Out At', 'Operational Note', 'Checkout Type',
  'Checkout Reason Code', 'Checkout Reason', 'Original End Date',
  'Actual Checkout Date', 'Checkout Requested By'
];
var EARLY_CHECKOUT_REASON_CODE_V11217_ = 'owner_request';
var EARLY_CHECKOUT_REASON_V11217_ = 'Owner requested early checkout';
var waffleProcessSheetActionBaseV11217_ = processSheetAction_;

function getStayOperationsHeadersV11217_() {
  return STAY_OPERATION_HEADERS_V11226_.slice();
}

/* Extend the existing Stay_Operations schema by appending structured checkout
 * fields. Existing columns 1-9 remain unchanged and therefore backwards safe. */
getStayOperationsHeaders_ = function() {
  return getStayOperationsHeadersV11217_();
};

function stayOperationIsoV11217_(value) {
  if (value instanceof Date) return value.toISOString();
  return String(value || '');
}

function todayKeyV11217_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}

function isEarlyCheckoutRecordV11217_(record) {
  record = record && typeof record === 'object' ? record : {};
  return (
    String(record.checkoutType || '').trim().toLowerCase() === 'early' ||
    String(record.checkoutReasonCode || '').trim().toLowerCase() === EARLY_CHECKOUT_REASON_CODE_V11217_
  );
}

/* Return the new fields on every operation read so current and historical Care
 * profiles can render the early-checkout context from one canonical record. */
readStayOperations_ = function(stayKeys) {
  var sh = getStayOperationsSheet_();
  if (sh.getLastRow() < 2) return [];

  var requested = {};
  if (Array.isArray(stayKeys) && stayKeys.length) {
    stayKeys.forEach(function(key) {
      key = String(key || '').trim();
      if (key) requested[key] = true;
    });
  }

  var headers = getStayOperationsHeadersV11217_();
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();

  return rows.map(function(row) {
    var stayKey = String(row[1] || '').trim();
    if (!stayKey) return null;
    if (Object.keys(requested).length && !requested[stayKey]) return null;

    var record = {
      updatedAt: stayOperationIsoV11217_(row[0]),
      stayKey: stayKey,
      dogName: String(row[2] || '').trim(),
      startDate: normalizeDateValue_(row[3]),
      endDate: normalizeDateValue_(row[4]),
      status: String(row[5] || 'expected').trim().toLowerCase(),
      checkedInAt: stayOperationIsoV11217_(row[6]),
      checkedOutAt: stayOperationIsoV11217_(row[7]),
      note: String(row[8] || '').trim(),
      checkoutType: String(row[9] || '').trim().toLowerCase(),
      checkoutReasonCode: String(row[10] || '').trim().toLowerCase(),
      checkoutReason: String(row[11] || '').trim(),
      originalEndDate: normalizeDateValue_(row[12]),
      actualCheckoutDate: normalizeDateValue_(row[13]),
      checkoutRequestedBy: String(row[14] || '').trim()
    };
    record.isEarlyCheckout = isEarlyCheckoutRecordV11217_(record);
    return record;
  }).filter(Boolean);
};

/* Replace the operation writer so both the legacy check-in/out actions and the
 * new early-checkout action write the same expanded row shape. */
setStayOperationalStatus_ = function(data, status) {
  data = data && typeof data === 'object' ? data : {};

  var stayKey = String(data.stayKey || '').trim();
  var dogName = String(data.dogName || '').trim();
  var startDate = normalizeDateValue_(data.startDate);
  var endDate = normalizeDateValue_(data.endDate || data.startDate);
  if (!stayKey || !dogName || !startDate || !endDate) {
    throw new Error('Stay Key, Dog Name, Start Date and End Date are required.');
  }

  status = String(status || '').trim().toLowerCase();
  if (status !== 'checked_in' && status !== 'checked_out') {
    throw new Error('Unsupported stay operational status.');
  }

  var sh = getStayOperationsSheet_();
  var row = findStayOperationRow_(sh, stayKey);
  var existing = row === -1 ? null : (readStayOperations_([stayKey])[0] || null);
  var now = new Date();
  var checkedInAt = existing && existing.checkedInAt ? existing.checkedInAt : '';
  var checkedOutAt = existing && existing.checkedOutAt ? existing.checkedOutAt : '';
  var note = String(data.note || '').trim();

  var checkoutType = '';
  var checkoutReasonCode = '';
  var checkoutReason = '';
  var originalEndDate = '';
  var actualCheckoutDate = '';
  var checkoutRequestedBy = '';
  var earlyCheckout = false;

  if (status === 'checked_in') {
    checkedInAt = now;
    checkedOutAt = '';
  } else {
    checkedOutAt = now;
    earlyCheckout = (
      String(data.checkoutType || '').trim().toLowerCase() === 'early' ||
      data.earlyCheckout === true ||
      String(data.checkoutReasonCode || '').trim().toLowerCase() === EARLY_CHECKOUT_REASON_CODE_V11217_ ||
      String(data.action || '').trim() === 'early_checkout_stay'
    );

    originalEndDate = normalizeDateValue_(data.originalEndDate || endDate) || endDate;
    actualCheckoutDate = normalizeDateValue_(data.actualCheckoutDate || todayKeyV11217_()) || todayKeyV11217_();

    if (earlyCheckout) {
      if (actualCheckoutDate < startDate) {
        throw new Error('Early checkout cannot be recorded before the stay start date.');
      }
      if (actualCheckoutDate > originalEndDate) {
        throw new Error('Early checkout must be on or before the originally scheduled checkout date.');
      }
      checkoutType = 'early';
      checkoutReasonCode = EARLY_CHECKOUT_REASON_CODE_V11217_;
      checkoutReason = EARLY_CHECKOUT_REASON_V11217_;
      checkoutRequestedBy = String(
        data.checkoutRequestedBy || data.ownerName || 'Owner'
      ).trim() || 'Owner';
    } else {
      checkoutType = 'standard';
    }
  }

  var rowData = [
    now,
    stayKey,
    dogName,
    startDate,
    endDate,
    status,
    checkedInAt,
    checkedOutAt,
    note,
    checkoutType,
    checkoutReasonCode,
    checkoutReason,
    originalEndDate,
    actualCheckoutDate,
    checkoutRequestedBy
  ];

  if (row === -1) {
    sh.appendRow(rowData);
    row = sh.getLastRow();
  } else {
    sh.getRange(row, 1, 1, rowData.length).setValues([rowData]);
  }

  touchWaffleDataVersion_('directory');

  var auditAction = status === 'checked_in'
    ? 'Dog Checked In'
    : earlyCheckout
      ? 'Dog Checked Out Early'
      : 'Dog Checked Out';
  var auditSummary = status === 'checked_in'
    ? dogName + ' checked in.'
    : earlyCheckout
      ? dogName + ' checked out early — ' + EARLY_CHECKOUT_REASON_V11217_ + '.'
      : dogName + ' checked out.';
  var changedFields = ['Operational Status'];
  if (earlyCheckout) {
    changedFields = changedFields.concat([
      'Checkout Type',
      'Checkout Reason',
      'Original End Date',
      'Actual Checkout Date',
      'Checkout Requested By'
    ]);
  }

  var after = {
    status: status,
    checkedInAt: stayOperationIsoV11217_(checkedInAt),
    checkedOutAt: stayOperationIsoV11217_(checkedOutAt),
    checkoutType: checkoutType,
    checkoutReasonCode: checkoutReasonCode,
    checkoutReason: checkoutReason,
    originalEndDate: originalEndDate,
    actualCheckoutDate: actualCheckoutDate,
    checkoutRequestedBy: checkoutRequestedBy,
    isEarlyCheckout: earlyCheckout
  };

  logAuditEvent_({
    category: 'Boarding',
    action: auditAction,
    dogName: dogName,
    bookingType: 'Boarding',
    reference: stayKey,
    summary: auditSummary,
    changedFields: changedFields,
    before: existing,
    after: after,
    source: String(data.source || 'Web App')
  });

  if (status === 'checked_in') {
    try {
      syncDogMasterProfileFromStay_(data);
    } catch (error) {
      console.warn('Master sync skipped', error);
    }
  }

  return {
    updatedAt: now.toISOString(),
    stayKey: stayKey,
    dogName: dogName,
    startDate: startDate,
    endDate: endDate,
    status: status,
    checkedInAt: stayOperationIsoV11217_(checkedInAt),
    checkedOutAt: stayOperationIsoV11217_(checkedOutAt),
    note: note,
    checkoutType: checkoutType,
    checkoutReasonCode: checkoutReasonCode,
    checkoutReason: checkoutReason,
    originalEndDate: originalEndDate,
    actualCheckoutDate: actualCheckoutDate,
    checkoutRequestedBy: checkoutRequestedBy,
    isEarlyCheckout: earlyCheckout,
    earlyCheckoutVersion: earlyCheckout ? EARLY_CHECKOUT_VERSION_V11217_ : ''
  };
};

/* Explicit mutation route keeps analytics/audit semantics clear while the
 * original checkout_stay action remains backwards compatible. */
processSheetAction_ = function(data) {
  var action = String(data && data.action || '').trim();
  if (action === 'early_checkout_stay') {
    data = data && typeof data === 'object' ? data : {};
    data.checkoutType = 'early';
    data.checkoutReasonCode = EARLY_CHECKOUT_REASON_CODE_V11217_;
    data.checkoutReason = EARLY_CHECKOUT_REASON_V11217_;
    return {
      result: 'success',
      action: action,
      record: setStayOperationalStatus_(data, 'checked_out')
    };
  }
  return waffleProcessSheetActionBaseV11217_(data);
};

function getEarlyCheckoutHealthV11217() {
  return {
    result: 'success',
    version: EARLY_CHECKOUT_VERSION_V11217_,
    action: 'early_checkout_stay',
    reasonCode: EARLY_CHECKOUT_REASON_CODE_V11217_,
    reason: EARLY_CHECKOUT_REASON_V11217_,
    preservesOriginalBookingDates: true,
    storesOriginalEndDate: true,
    storesActualCheckoutDate: true,
    storesRequestedBy: true,
    profileVisible: true,
    auditAction: 'Dog Checked Out Early'
  };
}

/* Stay ID operations layer. It only extends the operations sheet at its right
 * edge and resolves legacy ownership against the complete booking inventory. */
function stayOperationHeaderMapV11226_(sheet, addStayId) {
  var last = Math.max(0, Number(sheet.getLastColumn ? sheet.getLastColumn() : 0));
  if (!last && addStayId) {
    sheet.getRange(1, 1, 1, STAY_OPERATION_HEADERS_V11226_.length)
      .setValues([STAY_OPERATION_HEADERS_V11226_]);
    sheet.setFrozenRows(1);
    last = STAY_OPERATION_HEADERS_V11226_.length;
  }
  if (!last) return { map: {}, width: 0, stayId: 0 };
  var headers = sheet.getRange(1, 1, 1, last).getValues()[0] || [];
  var map = {}, duplicate = {};
  headers.forEach(function(value, index) {
    var key = String(value || '').trim().toLowerCase();
    if (!key) return;
    if (map[key]) duplicate[key] = true;
    else map[key] = index + 1;
  });
  if (duplicate['stay id']) throw new Error('Duplicate Stay ID headers in Stay_Operations; operation changes are blocked.');
  STAY_OPERATION_HEADERS_V11226_.forEach(function(name) {
    if (duplicate[name.toLowerCase()]) throw new Error('Duplicate ' + name + ' headers in Stay_Operations; operation changes are blocked.');
  });
  var idCol = map['stay id'] || 0;
  if (addStayId) {
    STAY_OPERATION_HEADERS_V11226_.concat([STAY_OPERATION_STAY_ID_HEADER_V11226_]).forEach(function(name) {
      var key = name.toLowerCase();
      if (map[key]) return;
      last += 1;
      if (sheet.getMaxColumns && sheet.getMaxColumns() < last) sheet.insertColumnsAfter(sheet.getMaxColumns(), last - sheet.getMaxColumns());
      sheet.getRange(1, last).setValue(name);
      map[key] = last;
    });
    idCol = map['stay id'] || 0;
  }
  return { map: map, width: last, stayId: idCol, duplicate: duplicate };
}

function stayOperationBookingIndexV11226_() {
  var sheet = getTargetSheet_(), rows = sheet.getDataRange().getValues();
  var cols = stableStayHeadersV11225_(sheet, false);
  var index = { byId: {}, idCounts: {}, byKey: {}, rows: rows };
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i] || [];
    var rawId = cols.stayId ? String(row[cols.stayId - 1] || '').trim() : '';
    if (rawId) index.idCounts[rawId.toLowerCase()] = (index.idCounts[rawId.toLowerCase()] || 0) + 1;
    var type = String(row[11] || 'Boarding').trim().toLowerCase();
    if (type !== 'confirmed boarding' && type !== 'boarding') continue;
    var dog = String(row[1] || '').trim(), start = normalizeDateValue_(row[3]), end = normalizeDateValue_(row[4] || row[3]);
    if (!dog || !start || !end) continue;
    var key = makeGuestStayKey_(dog, start, end);
    var booking = { row: i + 1, stayId: rawId, stayKey: key, dogName: dog, startDate: start, endDate: end,
      ownerName: String(row[5] || '').trim(), phone: String(row[6] || '').trim(), dogId: String(v108DogIdentityAt_(rows, i).dogId || '').trim() };
    (index.byKey[key] || (index.byKey[key] = [])).push(booking);
    if (rawId) {
      var normalized = rawId.toLowerCase();
      if (!index.byId[normalized]) index.byId[normalized] = booking;
    }
  }
  return index;
}

function stayOperationValueV11226_(row, headers, name, fallbackIndex) {
  var col = headers.map[name.toLowerCase()];
  if (col) return row[col - 1];
  return headers.width ? '' : row[fallbackIndex];
}

function getExistingStayOperationsSheetV11217_() {
  var ss = getTargetSheet_().getParent();
  var props = PropertiesService.getScriptProperties();
  var name = String(props.getProperty('STAY_OPERATIONS_SHEET_NAME') || 'Stay_Operations').trim();
  return ss.getSheetByName(name) || null;
}

function readStayOperationsV11226_(filters, readOnlyMissingSafe) {
  var sh = readOnlyMissingSafe ? getExistingStayOperationsSheetV11217_() : getStayOperationsSheet_();
  if (!sh || sh.getLastRow() < 2) return [];
  var schema = stayOperationHeaderMapV11226_(sh, false);
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(schema.width, 15)).getValues();
  var inventory = stayOperationBookingIndexV11226_(), raw = [];
  rows.forEach(function(row, offset) {
    var stayKey = String(stayOperationValueV11226_(row, schema, 'Stay Key', 1) || '').trim();
    if (!stayKey) return;
    var record = {
      row: offset + 2,
      updatedAt: stayOperationIsoV11217_(stayOperationValueV11226_(row, schema, 'Updated At', 0)),
      stayKey: stayKey,
      dogName: String(stayOperationValueV11226_(row, schema, 'Dog Name', 2) || '').trim(),
      startDate: normalizeDateValue_(stayOperationValueV11226_(row, schema, 'Start Date', 3)),
      endDate: normalizeDateValue_(stayOperationValueV11226_(row, schema, 'End Date', 4)),
      status: String(stayOperationValueV11226_(row, schema, 'Status', 5) || 'expected').trim().toLowerCase(),
      checkedInAt: stayOperationIsoV11217_(stayOperationValueV11226_(row, schema, 'Checked In At', 6)),
      checkedOutAt: stayOperationIsoV11217_(stayOperationValueV11226_(row, schema, 'Checked Out At', 7)),
      note: String(stayOperationValueV11226_(row, schema, 'Operational Note', 8) || '').trim(),
      checkoutType: String(stayOperationValueV11226_(row, schema, 'Checkout Type', 9) || '').trim().toLowerCase(),
      checkoutReasonCode: String(stayOperationValueV11226_(row, schema, 'Checkout Reason Code', 10) || '').trim().toLowerCase(),
      checkoutReason: String(stayOperationValueV11226_(row, schema, 'Checkout Reason', 11) || '').trim(),
      originalEndDate: normalizeDateValue_(stayOperationValueV11226_(row, schema, 'Original End Date', 12)),
      actualCheckoutDate: normalizeDateValue_(stayOperationValueV11226_(row, schema, 'Actual Checkout Date', 13)),
      checkoutRequestedBy: String(stayOperationValueV11226_(row, schema, 'Checkout Requested By', 14) || '').trim(),
      stayId: String(schema.stayId ? row[schema.stayId - 1] || '' : '').trim()
    };
    record._filterStayId = record.stayId;
    record.isEarlyCheckout = isEarlyCheckoutRecordV11217_(record);
    raw.push(record);
  });
  var opIdCounts = {}, opKeyCounts = {};
  raw.forEach(function(record) {
    if (record.stayId) opIdCounts[record.stayId.toLowerCase()] = (opIdCounts[record.stayId.toLowerCase()] || 0) + 1;
    opKeyCounts[record.stayKey] = (opKeyCounts[record.stayKey] || 0) + 1;
  });
  raw.forEach(function(record) {
    var id = record.stayId, booking = null, reason = '';
    if (id) {
      var normalized = id.toLowerCase();
      if (!validStayIdV11225_(id)) reason = 'invalid_stay_id';
      else if (opIdCounts[normalized] !== 1 || inventory.idCounts[normalized] > 1) reason = 'duplicate_stay_id';
      else if (!inventory.byId[normalized]) reason = 'missing_booking';
      else booking = inventory.byId[normalized];
    } else {
      var candidates = inventory.byKey[record.stayKey] || [];
      if (candidates.length !== 1 || opKeyCounts[record.stayKey] !== 1) reason = candidates.length > 1 || opKeyCounts[record.stayKey] > 1 ? 'ambiguous_legacy_stay' : 'missing_booking';
      else booking = candidates[0];
    }
    if (booking && !reason && !id && booking.stayId && inventory.idCounts[booking.stayId.toLowerCase()] > 1) reason = 'duplicate_stay_id';
    if (booking && !reason && !id && booking.stayId && !validStayIdV11225_(booking.stayId)) reason = 'invalid_stay_id';
    if (booking && !reason && id && record.dogName && normalizeV108Identity_(record.dogName) !== normalizeV108Identity_(booking.dogName)) reason = 'missing_booking';
    if (booking && !reason) record.stayId = booking.stayId || '';
    else {
      record.identityConflict = true;
      record.identityConflictReason = reason || 'missing_booking';
      var conflictedId = id || booking && booking.stayId || '';
      if (conflictedId) record.identityStayId = conflictedId;
      record.stayId = '';
    }
  });
  var f = filters && !Array.isArray(filters) && typeof filters === 'object' ? filters : { stayKeys: filters };
  var keys = {}, ids = {};
  (Array.isArray(f.stayKeys) ? f.stayKeys : Array.isArray(filters) ? filters : []).forEach(function(v) { if (String(v || '').trim()) keys[String(v).trim()] = true; });
  (Array.isArray(f.stayIds) ? f.stayIds : []).forEach(function(v) { if (String(v || '').trim()) ids[String(v).trim().toLowerCase()] = true; });
  var filtered = !Object.keys(keys).length && !Object.keys(ids).length
    ? raw
    : raw.filter(function(record) { return keys[record.stayKey] || (record._filterStayId && ids[record._filterStayId.toLowerCase()]) || (record.identityStayId && ids[record.identityStayId.toLowerCase()]) || (record.stayId && ids[record.stayId.toLowerCase()]); });
  filtered.forEach(function(record) { delete record._filterStayId; });
  return filtered;
}

var STAY_OPERATION_REVIEW_VERSION_V11217_ = 1;
var STAY_OPERATION_REVIEW_LIMIT_V11217_ = 20;

/* Pure read projection for a user-opened conflict review. Keep this separate
 * from the mutation-oriented booking index: a review must never create headers
 * or columns, and it must inspect every booking row before applying scope. */
function stayOperationReviewBookingRowsV11217_() {
  var rows = getTargetSheet_().getDataRange().getValues() || [];
  var header = rows[0] || [], stayIdColumn = -1;
  for (var h = 0; h < header.length; h++) {
    if (String(header[h] || '').trim().toLowerCase() === 'stay id') { stayIdColumn = h; break; }
  }
  return { rows: rows, stayIdColumn: stayIdColumn };
}

function stayOperationReviewCandidateV11217_(rows, rowIndex, stayIdColumn) {
  var row = rows[rowIndex] || [], type = String(row[11] || 'Boarding').trim();
  var identity = v108DogIdentityAt_(rows, rowIndex);
  var stayId = stayIdColumn < 0 ? '' : String(row[stayIdColumn] || '').trim();
  return {
    _inventoryRowIndex: rowIndex,
    stayId: stayId,
    dogName: String(row[1] || '').trim(),
    dogId: identity.dogId || '',
    ownerName: String(row[5] || '').trim(),
    startDate: normalizeDateValue_(row[3]),
    endDate: normalizeDateValue_(row[4] || row[3]),
    bookingType: type,
    eligibleOperationOwner: /^(confirmed boarding|boarding)$/i.test(type)
  };
}

function stayOperationReviewInventoryV11217_(inventory) {
  var rows = inventory.rows, byStayId = Object.create(null), byStayKey = Object.create(null);
  for (var i = 1; i < rows.length; i++) {
    var candidate = stayOperationReviewCandidateV11217_(rows, i, inventory.stayIdColumn);
    if (candidate.stayId) (byStayId[candidate.stayId.toLowerCase()] || (byStayId[candidate.stayId.toLowerCase()] = [])).push(candidate);
    if (candidate.eligibleOperationOwner && candidate.dogName && candidate.startDate && candidate.endDate) {
      var key = makeGuestStayKey_(candidate.dogName, candidate.startDate, candidate.endDate);
      (byStayKey[key] || (byStayKey[key] = [])).push(candidate);
    }
  }
  return { byStayId: byStayId, byStayKey: byStayKey };
}

function getStayOperationReviewV11217_(request) {
  request = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
  if (request.stayId != null && typeof request.stayId !== 'string') throw new Error('Stay ID is invalid for this review.');
  if (request.stayKey != null && typeof request.stayKey !== 'string') throw new Error('Stay Key is invalid for this review.');
  var rawId = request.stayId == null ? '' : String(request.stayId).trim();
  var key = request.stayKey == null ? '' : String(request.stayKey).trim();
  if (rawId.length > 128 || key.length > 512) throw new Error('Stay operation review request is invalid.');
  if (rawId && !validStayIdV11225_(rawId)) throw new Error('Stay ID is malformed; no review was loaded.');
  if (!rawId && !key) throw new Error('Stay ID or Stay Key is required for this review.');

  // An explicit UUID is the canonical scope. A stale/contradictory key can
  // never broaden the response to other same-key stays.
  var selected = rawId ? readStayOperations_({ stayIds: [rawId] }, true) : readStayOperations_({ stayKeys: [key] }, true);
  var conflicts = (selected || []).filter(function(record) { return record && record.identityConflict === true; });
  var limit = STAY_OPERATION_REVIEW_LIMIT_V11217_, bookingInventory = stayOperationReviewBookingRowsV11217_();
  var inventoryIndex = stayOperationReviewInventoryV11217_(bookingInventory);
  var operations = [], allCandidates = [], candidateSeen = Object.create(null), candidateCount = 0;
  function addReviewCandidate(candidate, sourceStayId, sourceStayKey) {
    var rowKey = String(candidate._inventoryRowIndex);
    if (candidateSeen[rowKey]) return;
    candidateSeen[rowKey] = true;
    candidateCount++;
    if (allCandidates.length < limit) allCandidates.push({
      sourceOperationStayId: sourceStayId || '',
      sourceOperationStayKey: sourceStayKey || '',
      stayId: candidate.stayId,
      dogName: candidate.dogName,
      dogId: candidate.dogId,
      ownerName: candidate.ownerName,
      startDate: candidate.startDate,
      endDate: candidate.endDate,
      bookingType: candidate.bookingType,
      eligibleOperationOwner: candidate.eligibleOperationOwner
    });
  }
  conflicts.slice(0, limit).forEach(function(record) {
    var id = String(record.identityStayId || record.stayId || '').trim();
    var operation = {
      identityStayId: id,
      stayKey: String(record.stayKey || '').trim(),
      identityConflictReason: String(record.identityConflictReason || 'unknown_conflict'),
      updatedAt: record.updatedAt || '',
      status: String(record.status || ''),
      startDate: record.startDate || '',
      endDate: record.endDate || '',
      checkoutType: record.checkoutType || '',
      originalEndDate: record.originalEndDate || '',
      actualCheckoutDate: record.actualCheckoutDate || ''
    };
    if (operations.length < limit) operations.push(operation);

    var keyCandidates = [];
    var isLegacy = !String(record.stayId || '').trim() && !id;
    if (isLegacy) {
      keyCandidates = inventoryIndex.byStayKey[operation.stayKey] || [];
    } else {
      keyCandidates = inventoryIndex.byStayId[id.toLowerCase()] || [];
    }
    keyCandidates.forEach(function(candidate) { addReviewCandidate(candidate, operation.identityStayId, operation.stayKey); });
  });

  var bookingOnlyReason = '';
  if (rawId) {
    var idCandidates = inventoryIndex.byStayId[rawId.toLowerCase()] || [];
    if (idCandidates.length > 1 && !conflicts.length) bookingOnlyReason = 'duplicate_booking_stay_id';
    if (idCandidates.length > 1) idCandidates.forEach(function(candidate) { addReviewCandidate(candidate, '', ''); });
  } else {
    var keyCandidates = inventoryIndex.byStayKey[key] || [];
    if (keyCandidates.length > 1 && !conflicts.length) bookingOnlyReason = 'ambiguous_legacy_stay';
    if (keyCandidates.length > 1) keyCandidates.forEach(function(candidate) { addReviewCandidate(candidate, '', ''); });
  }

  var reasons = Object.create(null);
  conflicts.forEach(function(record) { reasons[String(record.identityConflictReason || 'unknown_conflict')] = true; });
  if (bookingOnlyReason) reasons[bookingOnlyReason] = true;
  var reasonCodes = Object.keys(reasons);
  return {
    hasConflict: conflicts.length > 0 || !!bookingOnlyReason,
    reasonCode: reasonCodes.length === 1 ? reasonCodes[0] : reasonCodes.length ? 'multiple_conflicts' : null,
    reasonCodes: reasonCodes,
    target: { stayId: rawId || '', stayKey: key || '' },
    operations: operations,
    candidateBookings: allCandidates,
    truncated: {
      operations: conflicts.length > operations.length,
      candidateBookings: candidateCount > allCandidates.length || conflicts.length > operations.length
    }
  };
}

function resolveStayOperationTargetV11226_(data) {
  var sheet = getTargetSheet_(), inventory = stayOperationBookingIndexV11226_(), id = String(data.stayId || '').trim(), booking = null;
  if (id) {
    if (!validStayIdV11225_(id)) throw new Error('Stay ID is malformed. Refresh the stay and try again.');
    var normalized = id.toLowerCase();
    if (inventory.idCounts[normalized] > 1) throw new Error('Stay ID is duplicated; no operation was changed.');
    booking = inventory.byId[normalized];
    if (!booking) throw new Error('Stay ID does not identify a confirmed booking.');
    if (String(data.dogName || '').trim() && normalizeV108Identity_(booking.dogName) !== normalizeV108Identity_(data.dogName)) throw new Error('Stay ID and dog name do not match.');
    if (normalizeDateValue_(data.startDate) !== booking.startDate || normalizeDateValue_(data.endDate || data.startDate) !== booking.endDate) throw new Error('Stay ID and stay dates do not match. Refresh the stay and try again.');
    if (data.dogId && booking.dogId && String(data.dogId).trim() !== booking.dogId) throw new Error('Stay ID and Dog ID do not match.');
    if (data.stayKey && String(data.stayKey).trim() !== booking.stayKey) throw new Error('Stay ID and Stay Key do not match.');
  } else {
    var key = String(data.stayKey || '').trim(), candidates = inventory.byKey[key] || [];
    if (!key || candidates.length !== 1) throw new Error('This operation needs a unique confirmed booking. Refresh the stay list; no operation was changed.');
    booking = candidates[0];
    if (normalizeV108Identity_(String(data.dogName || '')) !== normalizeV108Identity_(booking.dogName) || normalizeDateValue_(data.startDate) !== booking.startDate || normalizeDateValue_(data.endDate || data.startDate) !== booking.endDate) throw new Error('The legacy stay details do not match the confirmed booking.');
    id = booking.stayId;
    if (id && !validStayIdV11225_(id)) throw new Error('The confirmed booking has a malformed Stay ID; no operation was changed.');
  }
  if (String(data.ownerName || '').trim() && normalizeV108Identity_(data.ownerName) !== normalizeV108Identity_(booking.ownerName)) throw new Error('The supplied owner does not match the confirmed booking. Refresh the stay and try again.');
  if (String(data.phone || '').trim() && normalizeV108Identity_(data.phone) !== normalizeV108Identity_(booking.phone)) throw new Error('The supplied contact does not match the confirmed booking. Refresh the stay and try again.');
  if (!id) {
    id = ensureStableStayIdV11225_(sheet, booking.row);
    booking.stayId = id;
  }
  return { sheet: sheet, booking: booking, stayId: id || '', stayKey: booking.stayKey, inventory: inventory };
}

function setStayOperationalStatusV11226_(data, status) {
  data = data && typeof data === 'object' ? data : {};
  var lockOwned = typeof WAFFLE_STAY_OPERATIONS_LOCK_HELD_V11226_ === 'undefined' || !WAFFLE_STAY_OPERATIONS_LOCK_HELD_V11226_;
  var lock = lockOwned ? LockService.getScriptLock() : null;
  if (lockOwned && !lock.tryLock(5000)) throw new Error('Another Waffle House update is currently being saved. Please try again in a few seconds.');
  try {
    var target = resolveStayOperationTargetV11226_(data), sh = getStayOperationsSheet_(), schema = stayOperationHeaderMapV11226_(sh, true);
    var records = readStayOperations_({ stayKeys: [target.stayKey], stayIds: target.stayId ? [target.stayId] : [] });
    var matches = records.filter(function(r) { return r.stayId && target.stayId && r.stayId.toLowerCase() === target.stayId.toLowerCase(); });
    var keyRows = records.filter(function(r) { return r.stayKey === target.stayKey; });
    if (!matches.length && keyRows.length === 1 && !keyRows[0].identityConflict && !keyRows[0].stayId) matches = keyRows;
    if (!matches.length && keyRows.some(function(r) { return r.identityConflict || !r.stayId; })) throw new Error('An operation row for this stay is quarantined or has unresolved ownership; no operation was changed.');
    if (matches.length > 1) throw new Error('Several operation rows match this stay; no operation was changed.');
    var prior = matches.length ? matches[0] : null;
    if (prior && prior.identityConflict) throw new Error('This operation row has unresolved identity; no operation was changed.');
    var rowNumber = prior ? prior.row : -1, existing = prior, now = new Date();
    status = String(status || '').trim().toLowerCase();
    if (status !== 'checked_in' && status !== 'checked_out') throw new Error('Unsupported stay operational status.');
    var earlyIntent = status === 'checked_out' && (String(data.checkoutType || '').toLowerCase() === 'early' || data.earlyCheckout === true || String(data.action || '') === 'early_checkout_stay');
    var early = earlyIntent || status === 'checked_out' && !!(existing && existing.isEarlyCheckout);
    var checkedInAt = existing && existing.checkedInAt || '', checkedOutAt = existing && existing.checkedOutAt || '';
    if (status === 'checked_in') { checkedInAt = now; checkedOutAt = ''; }
    else if (!checkedOutAt) checkedOutAt = now;
    var originalEndDate = early ? (existing && existing.originalEndDate || target.booking.endDate) : (existing && existing.originalEndDate || '');
    var actualCheckoutDate = early ? (existing && existing.actualCheckoutDate || normalizeDateValue_(data.actualCheckoutDate || todayKeyV11217_())) : (existing && existing.actualCheckoutDate || '');
    var requestedBy = early ? (existing && existing.checkoutRequestedBy || data.checkoutRequestedBy || data.ownerName || 'Owner') : '';
    if (earlyIntent && (actualCheckoutDate < target.booking.startDate || actualCheckoutDate > originalEndDate)) throw new Error('Early checkout date is outside the originally scheduled stay.');
    var values = [now, target.stayKey, target.booking.dogName, target.booking.startDate, target.booking.endDate, status, checkedInAt, checkedOutAt, String(data.note || '').trim(),
      early ? 'early' : (status === 'checked_out' ? 'standard' : ''), early ? EARLY_CHECKOUT_REASON_CODE_V11217_ : '', early ? EARLY_CHECKOUT_REASON_V11217_ : '', originalEndDate, actualCheckoutDate,
      String(requestedBy || '').trim()];
    var valueNames = STAY_OPERATION_HEADERS_V11226_;
    var width = Math.max(schema.width, values.length), row = new Array(width);
    for (var i = 0; i < width; i++) row[i] = '';
    if (rowNumber > 0) {
      var old = sh.getRange(rowNumber, 1, 1, width).getValues()[0] || [];
      for (var j = 0; j < width; j++) row[j] = old[j] === undefined ? '' : old[j];
    }
    values.forEach(function(value, index) { row[schema.map[valueNames[index].toLowerCase()] - 1] = value; });
    row[schema.stayId - 1] = target.stayId;
    if (rowNumber > 0) sh.getRange(rowNumber, 1, 1, width).setValues([row]);
    else { sh.appendRow(row); rowNumber = sh.getLastRow(); }
    var followUpErrors = [];
    try { touchWaffleDataVersion_('directory'); } catch (versionError) { followUpErrors.push('Data version refresh failed: ' + String(versionError && versionError.message || versionError)); }
    var record = { updatedAt: now.toISOString(), stayId: target.stayId, stayKey: target.stayKey, dogName: target.booking.dogName,
      startDate: target.booking.startDate, endDate: target.booking.endDate, status: status, checkedInAt: stayOperationIsoV11217_(checkedInAt),
      checkedOutAt: stayOperationIsoV11217_(checkedOutAt), note: String(data.note || '').trim(), checkoutType: early ? 'early' : (status === 'checked_out' ? 'standard' : ''),
      checkoutReasonCode: early ? EARLY_CHECKOUT_REASON_CODE_V11217_ : '', checkoutReason: early ? EARLY_CHECKOUT_REASON_V11217_ : '', originalEndDate: originalEndDate,
      actualCheckoutDate: actualCheckoutDate, checkoutRequestedBy: String(requestedBy || '').trim(),
      isEarlyCheckout: early };
    try {
      logAuditEvent_({ category: 'Boarding', action: status === 'checked_in' ? 'Dog Checked In' : early ? 'Dog Checked Out Early' : 'Dog Checked Out',
        dogName: target.booking.dogName, bookingType: 'Boarding', reference: target.stayKey, summary: target.booking.dogName + (early ? ' checked out early.' : status === 'checked_in' ? ' checked in.' : ' checked out.'),
        changedFields: ['Operational Status'].concat(early ? ['Checkout Type','Checkout Reason','Original End Date','Actual Checkout Date','Checkout Requested By'] : []), before: existing, after: record, source: String(data.source || 'Web App') });
    } catch (error) { followUpErrors.push('Audit follow-up failed: ' + String(error && error.message || error)); }
    if (status === 'checked_in') try { syncDogMasterProfileFromStay_(Object.assign({}, data, { stayKey: target.stayKey, stayId: target.stayId, dogName: target.booking.dogName })); } catch (syncError) { followUpErrors.push('Profile sync failed: ' + String(syncError && syncError.message || syncError)); }
    if (followUpErrors.length) { record.followUpNeeded = true; record.warning = 'Operation saved. ' + followUpErrors.join(' '); }
    return record;
  } finally { if (lockOwned) lock.releaseLock(); }
}

function bindLegacyStayOperationToIdV11226_(sheet, oldStayKey, bookingRow, stayId) {
  if (!validStayIdV11225_(stayId)) return false;
  var ops = getStayOperationsSheet_(), schema = stayOperationHeaderMapV11226_(ops, false);
  if (ops.getLastRow() < 2 || !schema.map['stay key']) return false;
  var inventory = stayOperationBookingIndexV11226_(), candidates = inventory.byKey[oldStayKey] || [];
  var values = ops.getRange(2, 1, ops.getLastRow() - 1, schema.width).getValues(), matching = [];
  values.forEach(function(row, offset) {
    if (String(row[schema.map['stay key'] - 1] || '').trim() === oldStayKey) matching.push({ row: offset + 2, stayId: String(schema.stayId ? row[schema.stayId - 1] || '' : '').trim() });
  });
  if (!matching.some(function(record) { return !record.stayId; })) return false;
  // Moving or removing a shared-key booking must not make an ambiguous old
  // operation appear uniquely owned by the remaining dog on the next read.
  if (candidates.length !== 1 || candidates[0].row !== bookingRow || matching.length !== 1) {
    throw new Error('Legacy stay operations have ambiguous ownership. Review those records before changing or deleting this booking.');
  }
  schema = stayOperationHeaderMapV11226_(ops, true);
  ops.getRange(matching[0].row, schema.stayId).setValue(stayId);
  return true;
}

/* These assignments intentionally follow the legacy V11.2.17 assignments. */
readStayOperations_ = function(filters, readOnlyMissingSafe) { return readStayOperationsV11226_(filters, readOnlyMissingSafe); };
setStayOperationalStatus_ = function(data, status) { return setStayOperationalStatusV11226_(data, status); };
