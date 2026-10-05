/* ========================================================================
 * WAFFLE HOUSE V11.1.98 — CONFIRMED STAY DELETE
 * ------------------------------------------------------------------------
 * Deletes one confirmed boarding row by exact dog/start/end identity while
 * preserving the dog's reusable master profile, photos and other stay records.
 * The deletion is audited and Calendar/Care data versions are invalidated.
 * ======================================================================== */

var v11198ConfirmedStayDeleteBaseProcessSheetAction_ = processSheetAction_;

function deleteConfirmedStayV11198Unlocked_(data) {
  data = data && typeof data === "object" ? data : {};

  var dogName = String(data.dogName || data.originalDogName || "").trim();
  var startDate = String(data.startDate || data.originalStartDate || "").trim();
  var endDate = String(data.endDate || data.originalEndDate || startDate || "").trim();

  var sheet = getTargetSheet_();
  var rows = sheet.getDataRange().getValues();
  // Never let the legacy first-name/date finder choose the deletion target.
  var row = String(data.stayId || "").trim()
    ? findStayRowByIdV11225_(sheet, data.stayId)
    : safeLegacyStayRowV11225_(rows, "delete_confirmed_stay", data);

  if (!row || row < 2) {
    throw new Error(
      "Confirmed stay could not be uniquely identified for " + dogName + " (" + startDate + " to " + endDate + ")."
    );
  }

  assertStayRowActionCompatibleV11225_(sheet, row, "delete_confirmed_stay", data);
  var stayId = ensureStableStayIdV11225_(sheet, row);
  dogName = dogName || String(rows[row - 1][1] || "").trim();
  startDate = startDate || normalizeDateValue_(rows[row - 1][3]);
  endDate = endDate || normalizeDateValue_(rows[row - 1][4] || rows[row - 1][3]);

  var rawType = String(sheet.getRange(row, 12).getDisplayValue() || "").trim();
  var type = rawType.toLowerCase();
  if (type === "meet & greet" || type === "potential stay") {
    throw new Error("Only confirmed boarding stays can be deleted with this action.");
  }

  var before = auditBookingSnapshotFromSheetRow_(sheet, row);
  before.stayId = stayId;
  var reference = sheet.getName() + "!A" + row;

  if (typeof bindLegacyStayOperationToIdV11226_ === "function") {
    bindLegacyStayOperationToIdV11226_(sheet, makeGuestStayKey_(before.dogName, before.startDate, before.endDate), row, stayId);
  }

  sheet.deleteRow(row);

  if (typeof touchWaffleDataVersion_ === "function") {
    ["calendar", "directory", "audit", "operations"].forEach(function(scope) {
      try { touchWaffleDataVersion_(scope); } catch (_) {}
    });
  }

  logAuditEvent_({
    category: "Boarding",
    action: "Confirmed Stay Deleted",
    dogName: dogName,
    bookingType: "Confirmed Boarding",
    reference: reference,
    summary: "Confirmed boarding stay deleted from Calendar and Care.",
    changedFields: ["Confirmed Stay"],
    before: before,
    after: {
      status: "Deleted",
      startDate: startDate,
      endDate: endDate,
      masterProfileRetained: true
    },
    source: "Web App"
  });

  return {
    result: "success",
    action: "delete_confirmed_stay",
    row: row,
    dogName: dogName,
    startDate: startDate,
    endDate: endDate,
    stayKey: String(data.stayKey || ""),
    stayId: stayId,
    deletedBooking: before,
    masterProfileRetained: true
  };
}

function deleteConfirmedStayV11198_(data) {
  if (WAFFLE_V11225_RECEIPT_LOCK_HELD_) return deleteConfirmedStayV11198Unlocked_(data);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("Another Waffle House update is currently being saved. Please try this update again in a few seconds.");
  try {
    return deleteConfirmedStayV11198Unlocked_(data);
  } finally {
    lock.releaseLock();
  }
}

processSheetAction_ = function(data) {
  data = data && typeof data === "object" ? data : {};

  if (String(data.action || "") === "delete_confirmed_stay") {
    return deleteConfirmedStayV11198_(data);
  }

  return v11198ConfirmedStayDeleteBaseProcessSheetAction_(data);
};
