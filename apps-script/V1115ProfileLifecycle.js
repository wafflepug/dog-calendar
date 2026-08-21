/* ========================================================================
 * WAFFLE HOUSE V11.1.5 — DOG PROFILE PURGE + AUDIT RECOVERY
 * ========================================================================
 * A "purge" removes the dog's active Waffle House rows and linked owner data,
 * while keeping one recoverable archive snapshot. Audit_Log is never purged.
 */

var WAFFLE_DELETED_PROFILE_SHEET_ = "Deleted_Dog_Profiles";
var WAFFLE_DELETED_PROFILE_HEADERS_ = [
  "Deleted At",
  "Deletion ID",
  "Dog Name",
  "Breed",
  "Owner Name",
  "Phone",
  "Master Key",
  "Last Stay Key",
  "Snapshot JSON",
  "Restored At",
  "Restored By"
];

function v1115NormalizeIdentity_(value) {
  if (typeof normalizeDogMasterIdentity_ === "function") {
    return normalizeDogMasterIdentity_(value);
  }
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function v1115HeaderKey_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function v1115FindHeaderIndex_(headers, candidates) {
  var wanted = (candidates || []).map(v1115HeaderKey_);
  for (var i = 0; i < headers.length; i++) {
    var key = v1115HeaderKey_(headers[i]);
    if (wanted.indexOf(key) !== -1) return i;
  }
  return -1;
}

function v1115GetDeletedProfileSheet_() {
  var spreadsheet = getTargetSheet_().getParent();
  var sheet = spreadsheet.getSheetByName(WAFFLE_DELETED_PROFILE_SHEET_);

  if (!sheet) sheet = spreadsheet.insertSheet(WAFFLE_DELETED_PROFILE_SHEET_);

  if (sheet.getMaxColumns() < WAFFLE_DELETED_PROFILE_HEADERS_.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      WAFFLE_DELETED_PROFILE_HEADERS_.length - sheet.getMaxColumns()
    );
  }

  var current = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, WAFFLE_DELETED_PROFILE_HEADERS_.length).getDisplayValues()[0]
    : [];
  var needsHeaders = current.length !== WAFFLE_DELETED_PROFILE_HEADERS_.length;

  if (!needsHeaders) {
    for (var i = 0; i < WAFFLE_DELETED_PROFILE_HEADERS_.length; i++) {
      if (String(current[i] || "") !== WAFFLE_DELETED_PROFILE_HEADERS_[i]) {
        needsHeaders = true;
        break;
      }
    }
  }

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, WAFFLE_DELETED_PROFILE_HEADERS_.length)
      .setValues([WAFFLE_DELETED_PROFILE_HEADERS_]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, WAFFLE_DELETED_PROFILE_HEADERS_.length)
      .setFontWeight("bold")
      .setBackground("#7f1d1d")
      .setFontColor("#ffffff");
  }

  return sheet;
}

function v1115EncodeCell_(value) {
  if (value instanceof Date) {
    return { type: "date", value: value.toISOString() };
  }
  return { type: "value", value: value };
}

function v1115DecodeCell_(cell) {
  cell = cell && typeof cell === "object" ? cell : { type: "value", value: cell };
  if (cell.type === "date" && cell.value) {
    var parsed = new Date(cell.value);
    return isNaN(parsed.getTime()) ? String(cell.value) : parsed;
  }
  return cell.value === undefined ? "" : cell.value;
}

function v1115ExtractDriveIdsFromValue_(value, ids) {
  if (value === null || value === undefined || value === "") return;

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      value.forEach(function(item) { v1115ExtractDriveIdsFromValue_(item, ids); });
      return;
    }

    Object.keys(value).forEach(function(key) {
      var keyText = v1115HeaderKey_(key);
      var item = value[key];
      if (/file id|fileid|drive file|drivefile/.test(keyText) && item) {
        ids[String(item)] = true;
      }
      if (/url|photo|image|file/.test(keyText)) {
        v1115ExtractDriveIdsFromValue_(item, ids);
      }
    });
    return;
  }

  var text = String(value || "").trim();
  if (!text) return;

  if ((text.charAt(0) === "{" && text.charAt(text.length - 1) === "}") ||
      (text.charAt(0) === "[" && text.charAt(text.length - 1) === "]")) {
    try {
      v1115ExtractDriveIdsFromValue_(JSON.parse(text), ids);
    } catch (_) {}
  }

  var patterns = [
    /\/d\/([A-Za-z0-9_-]{20,})/g,
    /[?&]id=([A-Za-z0-9_-]{20,})/g,
    /\/file\/d\/([A-Za-z0-9_-]{20,})/g
  ];
  patterns.forEach(function(pattern) {
    var match;
    while ((match = pattern.exec(text))) ids[match[1]] = true;
  });
}

function v1115ShouldSkipPurgeSheet_(sheetName) {
  var name = String(sheetName || "").trim().toLowerCase();
  var auditName = String(
    PropertiesService.getScriptProperties().getProperty("AUDIT_SHEET_NAME") || "Audit_Log"
  ).trim().toLowerCase();

  return name === auditName || name === WAFFLE_DELETED_PROFILE_SHEET_.toLowerCase();
}

function v1115RowMatchesDog_(headers, row, identity) {
  var dogIndex = v1115FindHeaderIndex_(headers, ["Dog Name", "Pet Name", "Dog's Name", "Dogs Name"]);
  if (dogIndex < 0) return false;

  var rowDog = v1115NormalizeIdentity_(row[dogIndex]);
  if (!rowDog || rowDog !== identity.dog) return false;

  var breedIndex = v1115FindHeaderIndex_(headers, ["Breed", "Dog Breed", "Pet Breed"]);
  if (identity.breed && breedIndex >= 0) {
    var rowBreed = v1115NormalizeIdentity_(row[breedIndex]);
    if (rowBreed && rowBreed !== identity.breed) return false;
  }

  var ownerIndex = v1115FindHeaderIndex_(headers, ["Owner Name", "Owner", "Parent Name", "Pet Owner"]);
  if (identity.owner && ownerIndex >= 0) {
    var rowOwner = v1115NormalizeIdentity_(row[ownerIndex]);
    if (rowOwner && rowOwner !== identity.owner) return false;
  }

  var phoneIndex = v1115FindHeaderIndex_(headers, ["Phone", "Phone Number", "Contact Number", "Owner Phone"]);
  if (!identity.owner && identity.phone && phoneIndex >= 0) {
    var rowPhone = String(row[phoneIndex] || "").replace(/\D+/g, "");
    if (rowPhone && rowPhone !== identity.phone) return false;
  }

  return true;
}

function v1115CollectDogSnapshot_(identity) {
  var spreadsheet = getTargetSheet_().getParent();
  var sheets = spreadsheet.getSheets();
  var snapshotRows = [];
  var driveIds = {};

  sheets.forEach(function(sheet) {
    var sheetName = sheet.getName();
    if (v1115ShouldSkipPurgeSheet_(sheetName) || sheet.getLastRow() < 2) return;

    var lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) return;

    var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    var dogIndex = v1115FindHeaderIndex_(headers, ["Dog Name", "Pet Name", "Dog's Name", "Dogs Name"]);
    if (dogIndex < 0) return;

    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getValues();
    values.forEach(function(row, index) {
      if (!v1115RowMatchesDog_(headers, row, identity)) return;

      snapshotRows.push({
        sheetName: sheetName,
        originalRow: index + 2,
        headers: headers.slice(),
        cells: row.map(v1115EncodeCell_)
      });

      headers.forEach(function(header, cellIndex) {
        var headerKey = v1115HeaderKey_(header);
        if (/photo|image|drive|file/.test(headerKey)) {
          v1115ExtractDriveIdsFromValue_(row[cellIndex], driveIds);
        }
      });
    });
  });

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    dogName: identity.dogName,
    breed: identity.breedName,
    ownerName: identity.ownerName,
    phone: identity.phoneRaw,
    masterKey: identity.masterKey,
    lastStayKey: identity.stayKey,
    rows: snapshotRows,
    driveFileIds: Object.keys(driveIds)
  };
}

function v1115DeleteSnapshotRows_(snapshot) {
  var spreadsheet = getTargetSheet_().getParent();
  var grouped = {};

  (snapshot.rows || []).forEach(function(item) {
    if (!grouped[item.sheetName]) grouped[item.sheetName] = [];
    grouped[item.sheetName].push(Number(item.originalRow));
  });

  Object.keys(grouped).forEach(function(sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;

    grouped[sheetName]
      .filter(function(row) { return row >= 2; })
      .sort(function(a, b) { return b - a; })
      .forEach(function(row) {
        if (row <= sheet.getLastRow()) sheet.deleteRow(row);
      });
  });
}

function v1115SetDriveFilesTrashed_(ids, trashed) {
  var results = { changed: 0, failed: 0 };
  (ids || []).forEach(function(id) {
    try {
      DriveApp.getFileById(String(id)).setTrashed(Boolean(trashed));
      results.changed++;
    } catch (_) {
      results.failed++;
    }
  });
  return results;
}

function v1115IdentityFromPurgeData_(data) {
  data = data && typeof data === "object" ? data : {};
  var dogName = String(data.dogName || "").trim();
  if (!dogName) throw new Error("Dog Name is required.");

  var confirmation = String(data.confirmationName || "").trim();
  if (v1115NormalizeIdentity_(confirmation) !== v1115NormalizeIdentity_(dogName)) {
    throw new Error("Type the dog's name exactly to confirm deletion.");
  }

  var master = {};
  try {
    master = getDogMasterProfile_({
      dogName: dogName,
      breed: String(data.breed || ""),
      masterKey: String(data.masterKey || "")
    }) || {};
  } catch (_) {}

  var breedName = String(data.breed || master.breed || "").trim();
  var ownerName = String(data.ownerName || master.ownerName || "").trim();
  var phoneRaw = String(data.phone || master.phone || "").trim();

  return {
    dogName: dogName,
    breedName: breedName,
    ownerName: ownerName,
    phoneRaw: phoneRaw,
    dog: v1115NormalizeIdentity_(dogName),
    breed: v1115NormalizeIdentity_(breedName),
    owner: v1115NormalizeIdentity_(ownerName),
    phone: phoneRaw.replace(/\D+/g, ""),
    masterKey: String(data.masterKey || master.masterKey || "").trim(),
    stayKey: String(data.stayKey || master.lastStayKey || "").trim()
  };
}

function purgeDogProfileV1115_(data) {
  var identity = v1115IdentityFromPurgeData_(data);
  var snapshot = v1115CollectDogSnapshot_(identity);

  if (!snapshot.rows.length) {
    throw new Error("No active Waffle House records were found for " + identity.dogName + ".");
  }

  var deletionId = Utilities.getUuid();
  var recycleSheet = v1115GetDeletedProfileSheet_();
  var archiveRow = recycleSheet.getLastRow() + 1;

  recycleSheet.getRange(archiveRow, 1, 1, WAFFLE_DELETED_PROFILE_HEADERS_.length).setValues([[
    new Date(),
    deletionId,
    identity.dogName,
    identity.breedName,
    identity.ownerName,
    identity.phoneRaw,
    identity.masterKey,
    identity.stayKey,
    JSON.stringify(snapshot),
    "",
    ""
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
}

function v1115FindDeletionArchive_(deletionId) {
  deletionId = String(deletionId || "").trim();
  if (!deletionId) throw new Error("Deletion ID is required.");

  var sheet = v1115GetDeletedProfileSheet_();
  if (sheet.getLastRow() < 2) return null;

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, WAFFLE_DELETED_PROFILE_HEADERS_.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][1] || "").trim() === deletionId) {
      return { sheet: sheet, row: i + 2, values: rows[i] };
    }
  }
  return null;
}

function v1115EnsureRestoreHeaders_(sheet, snapshotHeaders) {
  var currentLastColumn = Math.max(sheet.getLastColumn(), 1);
  var currentHeaders = sheet.getRange(1, 1, 1, currentLastColumn).getDisplayValues()[0];
  var map = {};

  currentHeaders.forEach(function(header, index) {
    var key = v1115HeaderKey_(header);
    if (key) map[key] = index;
  });

  (snapshotHeaders || []).forEach(function(header) {
    var key = v1115HeaderKey_(header);
    if (!key || map[key] !== undefined) return;
    currentHeaders.push(header);
    map[key] = currentHeaders.length - 1;
  });

  if (sheet.getMaxColumns() < currentHeaders.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), currentHeaders.length - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, currentHeaders.length).setValues([currentHeaders]);
  return { headers: currentHeaders, map: map };
}

function v1115RestoreSnapshotRows_(snapshot) {
  var spreadsheet = getTargetSheet_().getParent();
  var restored = 0;

  (snapshot.rows || []).forEach(function(item) {
    var sheet = spreadsheet.getSheetByName(item.sheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(item.sheetName);

    var headerState = v1115EnsureRestoreHeaders_(sheet, item.headers || []);
    var output = new Array(headerState.headers.length).fill("");

    (item.headers || []).forEach(function(header, index) {
      var currentIndex = headerState.map[v1115HeaderKey_(header)];
      if (currentIndex === undefined) return;
      output[currentIndex] = v1115DecodeCell_((item.cells || [])[index]);
    });

    sheet.appendRow(output);
    restored++;
  });

  return restored;
}

function restoreDogProfileV1115_(data) {
  data = data && typeof data === "object" ? data : {};
  var deletionId = String(data.deletionId || "").trim();
  var archive = v1115FindDeletionArchive_(deletionId);
  if (!archive) throw new Error("Deleted dog profile could not be found.");

  if (archive.values[9]) {
    throw new Error("This dog profile has already been recovered.");
  }

  var snapshot;
  try {
    snapshot = JSON.parse(String(archive.values[8] || "{}"));
  } catch (_) {
    throw new Error("The archived dog profile snapshot could not be read.");
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
}

function v1115DeletedProfileMap_() {
  var sheet = v1115GetDeletedProfileSheet_();
  var map = {};
  if (sheet.getLastRow() < 2) return map;

  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, WAFFLE_DELETED_PROFILE_HEADERS_.length).getValues();
  rows.forEach(function(row) {
    var id = String(row[1] || "").trim();
    if (!id) return;
    map[id] = {
      deletionId: id,
      deletedAt: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || ""),
      dogName: String(row[2] || ""),
      breed: String(row[3] || ""),
      ownerName: String(row[4] || ""),
      restoredAt: row[9] instanceof Date ? row[9].toISOString() : String(row[9] || ""),
      restoredBy: String(row[10] || "")
    };
  });
  return map;
}

function v1115RequestSourceForProfile_(record) {
  record = record && typeof record === "object" ? record : {};
  var sheet = getTargetSheet_();
  var sourceColumn = typeof getWaffleRequestSourceColumn_ === "function"
    ? getWaffleRequestSourceColumn_(sheet, false)
    : 0;
  if (!sourceColumn || sheet.getLastRow() < 2) return "";

  var rowNumber = Number(record.row || 0);
  if (rowNumber >= 2 && rowNumber <= sheet.getLastRow()) {
    return String(sheet.getRange(rowNumber, sourceColumn).getDisplayValue() || "").trim();
  }

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), sourceColumn)).getDisplayValues();
  var dog = v1115NormalizeIdentity_(record.dogName || "");
  var breed = v1115NormalizeIdentity_(record.breed || "");
  var owner = v1115NormalizeIdentity_(record.ownerName || "");

  for (var i = values.length - 1; i >= 0; i--) {
    var row = values[i];
    if (v1115NormalizeIdentity_(row[1]) !== dog) continue;
    if (breed && row[2] && v1115NormalizeIdentity_(row[2]) !== breed) continue;
    if (owner && row[5] && v1115NormalizeIdentity_(row[5]) !== owner) continue;
    var source = String(row[sourceColumn - 1] || "").trim();
    if (source) return source;
  }
  return "";
}

/* Add request source to the existing dog profile response. */
var v1115BaseGetGuestProfileDetail_ = getGuestProfileDetail_;
getGuestProfileDetail_ = function(stayKey) {
  var record = v1115BaseGetGuestProfileDetail_(stayKey);
  if (record && typeof record === "object") {
    record.requestSource = v1115RequestSourceForProfile_(record);
  }
  return record;
};

/* Mark purge audit entries as recoverable for the Audit Log UI. */
var v1115BaseReadAuditLogRecords_ = readAuditLogRecords_;
readAuditLogRecords_ = function(limit) {
  var records = v1115BaseReadAuditLogRecords_(limit) || [];
  var deletedMap = v1115DeletedProfileMap_();

  return records.map(function(record) {
    if (!record || record.action !== "Dog Profile Purged") return record;
    var archive = deletedMap[String(record.reference || "")];
    if (!archive) return record;

    record.deletionId = archive.deletionId;
    record.deletedAt = archive.deletedAt;
    record.deletedOwnerName = archive.ownerName;
    record.deletedBreed = archive.breed;
    record.recoverable = !archive.restoredAt;
    record.restoredAt = archive.restoredAt;
    record.restoredBy = archive.restoredBy;
    return record;
  });
};

/* Route V11.1.5 actions before the established V11.1 wrapper handles others. */
var v1115BaseProcessSheetAction_ = processSheetAction_;
processSheetAction_ = function(data) {
  data = data && typeof data === "object" ? data : {};
  var action = String(data.action || "");

  if (action === "purge_dog_profile") return purgeDogProfileV1115_(data);
  if (action === "restore_dog_profile") return restoreDogProfileV1115_(data);

  return v1115BaseProcessSheetAction_(data);
};
