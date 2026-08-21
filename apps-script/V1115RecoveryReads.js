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

/*
 * Keep every currently recoverable dog visible in get_audit_log even if its
 * original deletion event is older than the requested activity limit.
 */
var v1115RecoveryBaseReadAuditLogRecords_ = readAuditLogRecords_;
readAuditLogRecords_ = function(limit) {
  var records = v1115RecoveryBaseReadAuditLogRecords_(limit) || [];
  var seen = {};

  records.forEach(function(record) {
    if (record && record.action === "Dog Profile Purged" && record.reference) {
      seen[String(record.reference)] = true;
    }
  });

  v1115DeletedProfileRecords_().forEach(function(deleted) {
    if (!deleted.recoverable || seen[deleted.deletionId]) return;
    records.push({
      timestamp: deleted.deletedAt,
      eventId: "recovery-" + deleted.deletionId,
      category: "Profile",
      action: "Dog Profile Purged",
      dogName: deleted.dogName,
      bookingType: "Dog Profile",
      reference: deleted.deletionId,
      summary: "Deleted dog profile is still available for recovery from Audit Log.",
      changedFields: "Dog Profile, Owner Details",
      beforeJson: "",
      afterJson: "",
      source: "Audit Log",
      actor: "",
      deletionId: deleted.deletionId,
      deletedAt: deleted.deletedAt,
      deletedOwnerName: deleted.ownerName,
      deletedBreed: deleted.breed,
      recoverable: true,
      restoredAt: "",
      restoredBy: "",
      syntheticRecovery: true
    });
  });

  records.sort(function(a, b) {
    return String(b.timestamp || "").localeCompare(String(a.timestamp || ""));
  });
  return records;
};

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
