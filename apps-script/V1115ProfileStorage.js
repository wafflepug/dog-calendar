/* ========================================================================
 * WAFFLE HOUSE V11.1.5 — RECOVERY SNAPSHOT STORAGE
 * Avoid the Google Sheets single-cell text limit by chunking large archives.
 * ======================================================================== */

var WAFFLE_DELETED_PROFILE_DATA_SHEET_ = "Deleted_Dog_Profile_Data";
var WAFFLE_DELETED_PROFILE_INLINE_LIMIT_ = 40000;
var WAFFLE_DELETED_PROFILE_CHUNK_SIZE_ = 30000;

function v1115GetDeletedProfileDataSheet_() {
  var spreadsheet = getTargetSheet_().getParent();
  var sheet = spreadsheet.getSheetByName(WAFFLE_DELETED_PROFILE_DATA_SHEET_);
  if (!sheet) sheet = spreadsheet.insertSheet(WAFFLE_DELETED_PROFILE_DATA_SHEET_);

  var headers = ["Deletion ID", "Chunk Index", "Snapshot Chunk"];
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  var current = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0]
    : [];
  var needs = current.length !== headers.length;
  if (!needs) {
    for (var i = 0; i < headers.length; i++) {
      if (String(current[i] || "") !== headers[i]) { needs = true; break; }
    }
  }
  if (needs) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* Never let purge collection archive its own chunk-storage sheet. */
var v1115StorageBaseShouldSkipPurgeSheet_ = v1115ShouldSkipPurgeSheet_;
v1115ShouldSkipPurgeSheet_ = function(sheetName) {
  if (String(sheetName || "").trim().toLowerCase() === WAFFLE_DELETED_PROFILE_DATA_SHEET_.toLowerCase()) {
    return true;
  }
  return v1115StorageBaseShouldSkipPurgeSheet_(sheetName);
};

function v1115StoreSnapshotJson_(deletionId, snapshot) {
  var json = JSON.stringify(snapshot || {});
  if (json.length <= WAFFLE_DELETED_PROFILE_INLINE_LIMIT_) return "inline:" + json;

  var dataSheet = v1115GetDeletedProfileDataSheet_();
  var chunks = [];
  for (var offset = 0; offset < json.length; offset += WAFFLE_DELETED_PROFILE_CHUNK_SIZE_) {
    chunks.push(json.substring(offset, offset + WAFFLE_DELETED_PROFILE_CHUNK_SIZE_));
  }

  if (chunks.length) {
    var values = chunks.map(function(chunk, index) {
      return [deletionId, index, chunk];
    });
    dataSheet.getRange(dataSheet.getLastRow() + 1, 1, values.length, 3).setValues(values);
  }

  return "chunked:" + chunks.length;
}

function v1115ReadSnapshotJson_(deletionId, storedValue) {
  var raw = String(storedValue || "");
  if (raw.indexOf("inline:") === 0) return JSON.parse(raw.substring(7));

  /* Backward-compatible with an early inline archive format. */
  if (raw && raw.indexOf("chunked:") !== 0) return JSON.parse(raw);

  var sheet = v1115GetDeletedProfileDataSheet_();
  if (sheet.getLastRow() < 2) throw new Error("Recovery snapshot data is missing.");

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  var chunks = rows
    .filter(function(row) { return String(row[0] || "") === String(deletionId || ""); })
    .sort(function(a, b) { return Number(a[1] || 0) - Number(b[1] || 0); })
    .map(function(row) { return String(row[2] || ""); });

  if (!chunks.length) throw new Error("Recovery snapshot chunks could not be found.");
  return JSON.parse(chunks.join(""));
}

/* Replace the V11.1.5 purge implementation with chunk-safe archive storage. */
purgeDogProfileV1115_ = function(data) {
  var identity = v1115IdentityFromPurgeData_(data);
  var snapshot = v1115CollectDogSnapshot_(identity);

  if (!snapshot.rows.length) {
    throw new Error("No active Waffle House records were found for " + identity.dogName + ".");
  }

  var deletionId = Utilities.getUuid();
  var storedSnapshot = v1115StoreSnapshotJson_(deletionId, snapshot);
  var recycleSheet = v1115GetDeletedProfileSheet_();
  var archiveRow = recycleSheet.getLastRow() + 1;

  recycleSheet.getRange(archiveRow, 1, 1, WAFFLE_DELETED_PROFILE_HEADERS_.length).setValues([[
    new Date(), deletionId, identity.dogName, identity.breedName,
    identity.ownerName, identity.phoneRaw, identity.masterKey, identity.stayKey,
    storedSnapshot, "", ""
  ]]);

  var photoResult = v1115SetDriveFilesTrashed_(snapshot.driveFileIds, true);
  v1115DeleteSnapshotRows_(snapshot);

  if (typeof touchWaffleDataVersion_ === "function") {
    ["directory", "audit", "reminders", "calendar"].forEach(function(scope) {
      try { touchWaffleDataVersion_(scope); } catch (_) {}
    });
  }

  logAuditEvent_({
    category: "Profile",
    action: "Dog Profile Purged",
    dogName: identity.dogName,
    bookingType: "Dog Profile",
    reference: deletionId,
    summary: "Dog profile and linked owner data were removed from active Waffle House records. Recovery is available from Audit Log.",
    changedFields: ["Dog Profile", "Owner Details", "Stay History", "Care Data", "Photos"],
    before: {
      ownerName: identity.ownerName,
      breed: identity.breedName,
      archivedRows: snapshot.rows.length,
      archivedPhotos: snapshot.driveFileIds.length
    },
    after: {
      status: "Deleted",
      deletionId: deletionId,
      photoFilesTrashed: photoResult.changed,
      photoFileErrors: photoResult.failed
    },
    source: "Web App"
  });

  return {
    result: "success",
    action: "purge_dog_profile",
    deletionId: deletionId,
    dogName: identity.dogName,
    archivedRows: snapshot.rows.length,
    archivedPhotos: snapshot.driveFileIds.length,
    recoverable: true
  };
};

/* Replace recovery so it understands inline and chunked snapshots. */
restoreDogProfileV1115_ = function(data) {
  data = data && typeof data === "object" ? data : {};
  var deletionId = String(data.deletionId || "").trim();
  var archive = v1115FindDeletionArchive_(deletionId);
  if (!archive) throw new Error("Deleted dog profile could not be found.");
  if (archive.values[9]) throw new Error("This dog profile has already been recovered.");

  var snapshot;
  try {
    snapshot = v1115ReadSnapshotJson_(deletionId, archive.values[8]);
  } catch (error) {
    throw new Error("The archived dog profile snapshot could not be read: " + String(error && error.message || error));
  }

  var restoredRows = v1115RestoreSnapshotRows_(snapshot);
  var photoResult = v1115SetDriveFilesTrashed_(snapshot.driveFileIds || [], false);
  var actor = String(data.actor || "Web App User").trim();

  archive.sheet.getRange(archive.row, 10).setValue(new Date());
  archive.sheet.getRange(archive.row, 11).setValue(actor);

  if (typeof touchWaffleDataVersion_ === "function") {
    ["directory", "audit", "reminders", "calendar"].forEach(function(scope) {
      try { touchWaffleDataVersion_(scope); } catch (_) {}
    });
  }

  logAuditEvent_({
    category: "Profile",
    action: "Dog Profile Recovered",
    dogName: String(snapshot.dogName || archive.values[2] || ""),
    bookingType: "Dog Profile",
    reference: deletionId,
    summary: "Deleted dog profile and linked owner data were recovered from Audit Log.",
    changedFields: ["Dog Profile", "Owner Details", "Stay History", "Care Data", "Photos"],
    before: { status: "Deleted", deletionId: deletionId },
    after: {
      status: "Active",
      restoredRows: restoredRows,
      photoFilesRestored: photoResult.changed,
      photoFileErrors: photoResult.failed
    },
    source: "Audit Log",
    actor: actor
  });

  return {
    result: "success",
    action: "restore_dog_profile",
    deletionId: deletionId,
    dogName: String(snapshot.dogName || archive.values[2] || ""),
    restoredRows: restoredRows,
    restoredPhotos: photoResult.changed
  };
};
