/* ========================================================================
 * WAFFLE HOUSE V11.1.7 — REQUEST SOURCE PROFILE EDITING + DIRECTORY BADGES
 * ======================================================================== */

function v1117RequestSourceMap_() {
  var sheet = getTargetSheet_();
  var map = {};

  if (!sheet || sheet.getLastRow() < 2) return map;

  var sourceColumn = getWaffleRequestSourceColumn_(sheet, false);
  if (!sourceColumn) return map;

  var lastColumn = Math.max(Number(sheet.getLastColumn() || 0), sourceColumn, 12);
  var values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, lastColumn)
    .getValues();

  values.forEach(function(row) {
    var dogName = String(row[1] || "").trim();
    var startDate = row[3];
    var endDate = row[4] || startDate;

    if (!dogName || !startDate) return;

    var stayKey = makeGuestStayKey_(dogName, startDate, endDate);
    var source = String(row[sourceColumn - 1] || "").trim();

    if (stayKey && source) {
      map[stayKey] = source;
    }
  });

  return map;
}

function v1117EnrichDirectoryRequestSources_(payload) {
  payload = payload && typeof payload === "object" ? payload : {};
  var sourceMap = v1117RequestSourceMap_();

  (payload.bookings || []).forEach(function(booking) {
    if (!booking || !booking.stayKey) return;
    booking.requestSource =
      sourceMap[String(booking.stayKey)] ||
      String(booking.requestSource || "");
  });

  (payload.summaries || []).forEach(function(summary) {
    if (!summary || !summary.stayKey) return;
    summary.requestSource =
      sourceMap[String(summary.stayKey)] ||
      String(summary.requestSource || "");
  });

  return payload;
}

/* Current Care directory: include Request From in the lightweight payload so
 * tile badges can render without opening every profile individually. */
var v1117BaseGetGuestDirectoryPayload_ = getGuestDirectoryPayload_;
getGuestDirectoryPayload_ = function() {
  return v1117EnrichDirectoryRequestSources_(
    v1117BaseGetGuestDirectoryPayload_()
  );
};

/* Past Care directory uses the same enrichment when available. */
if (typeof getPastGuestDirectoryPayload_ === "function") {
  var v1117BaseGetPastGuestDirectoryPayload_ = getPastGuestDirectoryPayload_;
  getPastGuestDirectoryPayload_ = function(data) {
    return v1117EnrichDirectoryRequestSources_(
      v1117BaseGetPastGuestDirectoryPayload_(data)
    );
  };
}

function updateRequestSourceV1117_(data) {
  data = data && typeof data === "object" ? data : {};

  var stayKey = String(data.stayKey || "").trim();
  if (!stayKey) {
    throw new Error("Stay Key is required to update Request From.");
  }

  var requestSource = normalizeWaffleRequestSource_(data.requestSource);
  if (!requestSource) {
    throw new Error("Choose a Request From option before saving.");
  }

  var sheet = getTargetSheet_();
  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error("The boarding record could not be found.");
  }

  var lastColumn = Math.max(Number(sheet.getLastColumn() || 0), 12);
  var values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, lastColumn)
    .getValues();

  var targetRow = 0;
  var matchedDogName = "";
  var matchedBookingType = "";

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var dogName = String(row[1] || "").trim();
    var startDate = row[3];
    var endDate = row[4] || startDate;

    if (!dogName || !startDate) continue;

    if (makeGuestStayKey_(dogName, startDate, endDate) === stayKey) {
      targetRow = i + 2;
      matchedDogName = dogName;
      matchedBookingType = String(row[11] || "Boarding").trim() || "Boarding";
      break;
    }
  }

  if (!targetRow) {
    throw new Error("The selected dog stay could not be matched in the boarding sheet.");
  }

  var sourceColumn = getWaffleRequestSourceColumn_(sheet, true);
  var beforeSource = String(
    sheet.getRange(targetRow, sourceColumn).getDisplayValue() || ""
  ).trim();

  if (beforeSource === requestSource) {
    return {
      result: "success",
      action: "update_request_source",
      row: targetRow,
      stayKey: stayKey,
      dogName: matchedDogName,
      requestSource: requestSource,
      unchanged: true
    };
  }

  sheet.getRange(targetRow, sourceColumn).setValue(requestSource);

  touchWaffleDataVersion_("directory");

  logAuditEvent_({
    category: "Profile",
    action: "Request Source Updated",
    dogName: matchedDogName || String(data.dogName || ""),
    bookingType: matchedBookingType,
    reference: stayKey,
    summary:
      "Request From changed" +
      (beforeSource ? " from " + beforeSource : "") +
      " to " + requestSource + ".",
    changedFields: ["Request Source"],
    before: {
      requestSource: beforeSource
    },
    after: {
      requestSource: requestSource
    },
    source: "Web App"
  });

  return {
    result: "success",
    action: "update_request_source",
    row: targetRow,
    stayKey: stayKey,
    dogName: matchedDogName,
    requestSource: requestSource
  };
}

var v1117BaseProcessSheetAction_ = processSheetAction_;
processSheetAction_ = function(data) {
  data = data && typeof data === "object" ? data : {};

  if (String(data.action || "") === "update_request_source") {
    return updateRequestSourceV1117_(data);
  }

  return v1117BaseProcessSheetAction_(data);
};
