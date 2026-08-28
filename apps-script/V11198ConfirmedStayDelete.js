/* ========================================================================
 * WAFFLE HOUSE V11.1.98 — CONFIRMED STAY DELETE
 * ------------------------------------------------------------------------
 * Deletes one confirmed boarding row by exact dog/start/end identity while
 * preserving the dog's reusable master profile, photos and other stay records.
 * The deletion is audited and Calendar/Care data versions are invalidated.
 * ======================================================================== */

var v11198ConfirmedStayDeleteBaseProcessSheetAction_ = processSheetAction_;

function deleteConfirmedStayV11198_(data) {
  data = data && typeof data === "object" ? data : {};

  var dogName = String(data.dogName || "").trim();
  var startDate = String(data.startDate || "").trim();
  var endDate = String(data.endDate || startDate || "").trim();

  if (!dogName) throw new Error("Dog Name is required.");
  if (!startDate) throw new Error("Stay start date is required.");
  if (!endDate) throw new Error("Stay end date is required.");

  var sheet = getTargetSheet_();
  var rows = sheet.getDataRange().getValues();
  var row = findV108BoardingRow_(rows, dogName, startDate, endDate);

  if (!row || row < 2) {
    throw new Error(
      "Confirmed stay not found for " + dogName + " (" + startDate + " to " + endDate + ")."
    );
  }

  var rawType = String(sheet.getRange(row, 12).getDisplayValue() || "").trim();
  var type = rawType.toLowerCase();
  if (type === "meet & greet" || type === "potential stay") {
    throw new Error("Only confirmed boarding stays can be deleted with this action.");
  }

  var before = auditBookingSnapshotFromSheetRow_(sheet, row);
  var reference = sheet.getName() + "!A" + row;

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
    deletedBooking: before,
    masterProfileRetained: true
  };
}

processSheetAction_ = function(data) {
  data = data && typeof data === "object" ? data : {};

  if (String(data.action || "") === "delete_confirmed_stay") {
    return deleteConfirmedStayV11198_(data);
  }

  return v11198ConfirmedStayDeleteBaseProcessSheetAction_(data);
};
