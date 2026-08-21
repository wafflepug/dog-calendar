/* ========================================================================
 * WAFFLE HOUSE V11.1.5 — DELETED PROFILE RECOVERY READ MODEL
 * ======================================================================== */

function v1115DeletedProfileRecords_() {
  var map = v1115DeletedProfileMap_();
  return Object.keys(map)
    .map(function(key) {
      var record = map[key];
      record.recoverable = !record.restoredAt;
      return record;
    })
    .sort(function(a, b) {
      return String(b.deletedAt || "").localeCompare(String(a.deletedAt || ""));
    });
}

var v1115RecoveryBaseIsReadOnlySheetAction_ = isReadOnlySheetAction_;
isReadOnlySheetAction_ = function(action) {
  if (String(action || "") === "get_deleted_dog_profiles") return true;
  return v1115RecoveryBaseIsReadOnlySheetAction_(action);
};

var v1115RecoveryBaseProcessSheetAction_ = processSheetAction_;
processSheetAction_ = function(data) {
  data = data && typeof data === "object" ? data : {};
  var action = String(data.action || "");

  if (action === "get_deleted_dog_profiles") {
    return {
      result: "success",
      action: action,
      records: v1115DeletedProfileRecords_()
    };
  }

  return v1115RecoveryBaseProcessSheetAction_(data);
};
