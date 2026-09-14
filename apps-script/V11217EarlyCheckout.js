/* ============================================================
 * WAFFLE HOUSE V11.2.17 — OWNER-REQUESTED EARLY CHECKOUT
 * ------------------------------------------------------------
 * Records an early checkout as an operational event without changing the
 * original booking dates. The original scheduled checkout remains available
 * for history/audit while the actual checkout date/time is recorded separately.
 * ============================================================ */

var EARLY_CHECKOUT_VERSION_V11217_ = '11.2.17';
var EARLY_CHECKOUT_REASON_CODE_V11217_ = 'owner_request';
var EARLY_CHECKOUT_REASON_V11217_ = 'Owner requested early checkout';
var waffleProcessSheetActionBaseV11217_ = processSheetAction_;

function getStayOperationsHeadersV11217_() {
  return [
    'Updated At',
    'Stay Key',
    'Dog Name',
    'Start Date',
    'End Date',
    'Status',
    'Checked In At',
    'Checked Out At',
    'Operational Note',
    'Checkout Type',
    'Checkout Reason Code',
    'Checkout Reason',
    'Original End Date',
    'Actual Checkout Date',
    'Checkout Requested By'
  ];
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
