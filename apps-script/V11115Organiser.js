/* ========================================================================
 * WAFFLE HOUSE V11.1.15 — SHARED ORGANISER PLANNER STORAGE
 * ======================================================================== */

var V11115_ORGANISER_SHEET_ = "Waffle_Organiser";
var V11115_ORGANISER_HEADERS_ = [
  "ID",
  "Type",
  "Title",
  "Stay Key",
  "Dog Name",
  "Value JSON",
  "Updated At"
];

function v11115OrganiserSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(V11115_ORGANISER_SHEET_);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(V11115_ORGANISER_SHEET_);
  }

  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, V11115_ORGANISER_HEADERS_.length)
      .setValues([V11115_ORGANISER_HEADERS_]);
    sheet.setFrozenRows(1);
  } else {
    var headers = sheet
      .getRange(1, 1, 1, V11115_ORGANISER_HEADERS_.length)
      .getDisplayValues()[0];

    var mismatch = V11115_ORGANISER_HEADERS_.some(function(header, index) {
      return String(headers[index] || "").trim() !== header;
    });

    if (mismatch) {
      sheet.getRange(1, 1, 1, V11115_ORGANISER_HEADERS_.length)
        .setValues([V11115_ORGANISER_HEADERS_]);
    }
  }

  return sheet;
}

function v11115OrganiserAllowedType_(value) {
  var type = String(value || "").trim().toLowerCase();
  var allowed = {
    shelf: true,
    shelf_assignment: true,
    sleep_area: true,
    sleep_assignment: true,
    arrival_checklist: true,
    checkout_checklist: true,
    task: true
  };

  return allowed[type] ? type : "";
}

function v11115SafeJsonParse_(value) {
  if (!value) return {};
  try {
    var parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function v11115OrganiserItemFromRow_(row) {
  var updated = row[6];
  var updatedAt = "";

  if (updated instanceof Date && !isNaN(updated.getTime())) {
    updatedAt = updated.toISOString();
  } else {
    updatedAt = String(updated || "");
  }

  return {
    id: String(row[0] || "").trim(),
    type: String(row[1] || "").trim(),
    title: String(row[2] || "").trim(),
    stayKey: String(row[3] || "").trim(),
    dogName: String(row[4] || "").trim(),
    value: v11115SafeJsonParse_(row[5]),
    updatedAt: updatedAt
  };
}

function getOrganiserV11115_() {
  var sheet = v11115OrganiserSheet_();
  var items = [];

  if (sheet.getLastRow() >= 2) {
    var values = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, V11115_ORGANISER_HEADERS_.length)
      .getValues();

    values.forEach(function(row) {
      var item = v11115OrganiserItemFromRow_(row);
      if (item.id && v11115OrganiserAllowedType_(item.type)) {
        items.push(item);
      }
    });
  }

  return {
    result: "success",
    action: "get_organiser",
    items: items
  };
}

function v11115MakeOrganiserId_(type) {
  return [
    String(type || "item"),
    new Date().getTime(),
    Math.floor(Math.random() * 1000000)
  ].join("-");
}

function saveOrganiserItemV11115_(data) {
  data = data && typeof data === "object" ? data : {};

  var type = v11115OrganiserAllowedType_(data.type);
  if (!type) throw new Error("A valid organiser item type is required.");

  var id = String(data.id || "").trim() || v11115MakeOrganiserId_(type);
  var title = String(data.title || "").trim().slice(0, 180);
  var stayKey = String(data.stayKey || "").trim().slice(0, 260);
  var dogName = String(data.dogName || "").trim().slice(0, 140);
  var value = data.value && typeof data.value === "object" ? data.value : {};
  var valueJson = JSON.stringify(value);

  if (valueJson.length > 40000) {
    throw new Error("This organiser item is too large to save.");
  }

  var lock = LockService.getDocumentLock();
  lock.waitLock(10000);

  try {
    var sheet = v11115OrganiserSheet_();
    var rowNumber = 0;

    if (sheet.getLastRow() >= 2) {
      var ids = sheet
        .getRange(2, 1, sheet.getLastRow() - 1, 1)
        .getDisplayValues();

      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0] || "").trim() === id) {
          rowNumber = i + 2;
          break;
        }
      }
    }

    var now = new Date();
    var row = [id, type, title, stayKey, dogName, valueJson, now];

    if (rowNumber) {
      sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      rowNumber = sheet.getLastRow();
    }

    return {
      result: "success",
      action: "save_organiser_item",
      item: {
        id: id,
        type: type,
        title: title,
        stayKey: stayKey,
        dogName: dogName,
        value: value,
        updatedAt: now.toISOString()
      },
      row: rowNumber
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteOrganiserItemV11115_(data) {
  data = data && typeof data === "object" ? data : {};
  var id = String(data.id || "").trim();
  if (!id) throw new Error("Organiser item ID is required.");

  var lock = LockService.getDocumentLock();
  lock.waitLock(10000);

  try {
    var sheet = v11115OrganiserSheet_();
    if (sheet.getLastRow() < 2) {
      return { result: "success", action: "delete_organiser_item", id: id, deleted: false };
    }

    var ids = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 1)
      .getDisplayValues();

    for (var i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0] || "").trim() === id) {
        sheet.deleteRow(i + 2);
        return { result: "success", action: "delete_organiser_item", id: id, deleted: true };
      }
    }

    return { result: "success", action: "delete_organiser_item", id: id, deleted: false };
  } finally {
    lock.releaseLock();
  }
}

var v11115BaseProcessSheetAction_ = processSheetAction_;
processSheetAction_ = function(data) {
  data = data && typeof data === "object" ? data : {};
  var action = String(data.action || "");

  if (action === "get_organiser") {
    return getOrganiserV11115_();
  }

  if (action === "save_organiser_item") {
    return saveOrganiserItemV11115_(data);
  }

  if (action === "delete_organiser_item") {
    return deleteOrganiserItemV11115_(data);
  }

  return v11115BaseProcessSheetAction_(data);
};
