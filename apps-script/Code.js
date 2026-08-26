/**
 * Waffle House Dog Boarding - Apps Script backend
 *
 * IMPORTANT DEPLOYMENT SETTINGS
 * ---------------------------------
 * Deploy -> Manage deployments -> Web app
 * Execute as: Me
 * Who has access: Anyone
 *
 * This script is designed to be bound to the boarding spreadsheet.
 * It always writes to the sheet named "Form_Responses" by default.
 *
 * Optional Script Properties:
 *   SPREADSHEET_ID       = spreadsheet ID (recommended if this is a standalone script)
 *   BOARDING_SHEET_GID   = worksheet/grid ID (defaults to 1639615540)
 *   BOARDING_SHEET_NAME  = optional worksheet tab-name fallback
 *   BELONGINGS_SHEET_NAME = optional belongings tab name (defaults to Pet_Belongings)
 *   BELONGINGS_FOLDER_ID  = optional Google Drive folder ID for belongings photos
 *   DAILY_NOTIFICATION_EMAIL = recipient(s), comma-separated
 *
 * Pet belongings photos are stored in Google Drive. The Pet_Belongings sheet
 * stores the file IDs/URLs so every device can display the same records.
 */

function parseWaffleFormEncodedBody_(rawBody) {
  var result = {};
  var text = String(rawBody || "");

  if (!text) return result;

  text.split("&").forEach(function(pair) {
    if (!pair) return;

    var separatorIndex = pair.indexOf("=");
    var rawKey =
      separatorIndex === -1
        ? pair
        : pair.substring(0, separatorIndex);

    var rawValue =
      separatorIndex === -1
        ? ""
        : pair.substring(separatorIndex + 1);

    var key = decodeURIComponent(
      String(rawKey || "").replace(/\+/g, " ")
    );

    var value = decodeURIComponent(
      String(rawValue || "").replace(/\+/g, " ")
    );

    if (!key) return;

    result[key] = value;
  });

  return result;
}


function doPost(e) {
  var data = null;
  var earlyUploadToken = "";
  var earlyAction = "";

  try {
    if (!e) {
      return jsonResponse_({
        result: "error",
        error: "No POST request was supplied."
      });
    }

    var params = e.parameter || {};

    /*
     * Apps Script normally exposes application/x-www-form-urlencoded POST
     * fields through e.parameter. Some deployments/browsers can still surface
     * only the raw POST body, e.g.
     *
     *   action=submit_intake&token=...&payloadJson=...
     *
     * That body is NOT JSON. If e.parameter is empty, recover the form fields
     * from e.postData.contents before deciding how to route the request.
     */
    var rawIncomingBody =
      e.postData && e.postData.contents
        ? String(e.postData.contents)
        : "";

    if (
      !String(params.action || "").trim() &&
      rawIncomingBody &&
      (
        rawIncomingBody.indexOf("action=") === 0 ||
        rawIncomingBody.indexOf("&action=") !== -1
      )
    ) {
      var recoveredParams =
        parseWaffleFormEncodedBody_(rawIncomingBody);

      Object.keys(recoveredParams).forEach(function(key) {
        if (
          params[key] === undefined ||
          params[key] === null ||
          String(params[key]) === ""
        ) {
          params[key] = recoveredParams[key];
        }
      });
    }

    earlyUploadToken = String(params.uploadToken || "").trim();
    earlyAction = String(params.action || "").trim();

    // Put action/uploadToken in the URL query string as well as the POST form.
    // This lets us report a useful status even if a large form body fails to
    // parse before Apps Script can read the photoData field.
    if (earlyAction === "upload_belongings_photo" && earlyUploadToken) {
      setBelongingsPhotoUploadStatus_(earlyUploadToken, {
        state: "received",
        message: "Photo POST reached Apps Script."
      });
    }

    if (earlyAction === "submit_intake") {
      var intakePayload = {};

      if (String(params.payloadJson || "").trim()) {
        try {
          intakePayload = JSON.parse(String(params.payloadJson));
        } catch (intakePayloadError) {
          throw new Error(
            "The intake form reached Apps Script, but its answers could not be decoded: " +
            intakePayloadError.message
          );
        }
      }

      data = {
        action: "submit_intake",
        token: String(params.token || ""),
        answers: intakePayload,
        signatureData: String(params.signatureData || "")
      };

    // Preferred photo transport: ordinary HTML form fields. Keeping the large
    // base64 image OUT of one giant JSON string is more reliable on mobile.
    } else if (earlyAction === "upload_belongings_photo") {
      var items = {};

      if (String(params.itemsJson || "").trim()) {
        try {
          items = JSON.parse(String(params.itemsJson));
        } catch (itemsError) {
          throw new Error(
            "The photo POST reached Apps Script, but the belongings item data could not be decoded: " +
            itemsError.message
          );
        }
      }

      data = {
        action: "upload_belongings_photo",
        uploadToken: earlyUploadToken,
        stayKey: String(params.stayKey || ""),
        dogName: String(params.dogName || ""),
        startDate: String(params.startDate || ""),
        endDate: String(params.endDate || ""),
        photoLabel: String(params.photoLabel || ""),
        photoData: String(params.photoData || ""),
        items: items
      };
    } else {
      // Backward compatibility for existing JSON/form requests.
      var rawPostBody = "";

      if (params && String(params.payload || "").trim()) {
        rawPostBody = String(params.payload);
      } else if (e.postData && e.postData.contents) {
        rawPostBody = String(e.postData.contents);
      }

      if (!rawPostBody) {
        return jsonResponse_({
          result: "error",
          error: "No POST payload was supplied."
        });
      }

      var trimmedPostBody = String(rawPostBody).trim();

      if (
        trimmedPostBody.indexOf("action=") === 0 ||
        trimmedPostBody.indexOf("&action=") !== -1
      ) {
        var decodedForm =
          parseWaffleFormEncodedBody_(trimmedPostBody);

        if (String(decodedForm.action || "") === "submit_intake") {
          var decodedAnswers = {};

          if (String(decodedForm.payloadJson || "").trim()) {
            decodedAnswers = JSON.parse(
              String(decodedForm.payloadJson)
            );
          }

          data = {
            action: "submit_intake",
            token: String(decodedForm.token || ""),
            answers: decodedAnswers,
            signatureData: String(decodedForm.signatureData || "")
          };
        } else if (
          String(decodedForm.action || "") ===
          "upload_belongings_photo"
        ) {
          var decodedItems = {};

          if (String(decodedForm.itemsJson || "").trim()) {
            decodedItems = JSON.parse(
              String(decodedForm.itemsJson)
            );
          }

          data = {
            action: "upload_belongings_photo",
            uploadToken: String(decodedForm.uploadToken || ""),
            stayKey: String(decodedForm.stayKey || ""),
            dogName: String(decodedForm.dogName || ""),
            startDate: String(decodedForm.startDate || ""),
            endDate: String(decodedForm.endDate || ""),
            photoLabel: String(decodedForm.photoLabel || ""),
            photoData: String(decodedForm.photoData || ""),
            items: decodedItems
          };
        } else {
          data = decodedForm;
        }
      } else {
        data = JSON.parse(trimmedPostBody);
      }
    }

    assertWaffleActionAllowedDuringMaintenance_(data && data.action);

    if (
      data.action === "upload_belongings_photo" &&
      String(data.uploadToken || "").trim()
    ) {
      setBelongingsPhotoUploadStatus_(data.uploadToken, {
        state: "processing",
        message: "Apps Script decoded the photo and is saving it to Google Drive."
      });
    }

    if (data.action === "submit_intake") {
      var intakeResult = processIntakeSubmission_(data);
      return intakeSubmissionHtmlResponse_(intakeResult, "");
    }

    var result = processSheetActionWithV108Receipt_(data);

    invalidateWaffleForAction_(
      data.action
    );

    if (
      data.action === "upload_belongings_photo" &&
      String(data.uploadToken || "").trim()
    ) {
      setBelongingsPhotoUploadStatus_(data.uploadToken, {
        state: "success",
        message: "Photo saved to Google Drive and recorded in Google Sheets.",
        photo: result.photo || null,
        row: result.row || null
      });
    }

    return jsonResponse_(result);

  } catch (error) {
    var errorMessage =
      error && error.message ? error.message : String(error);

    var failureToken =
      String(
        (data && data.uploadToken) ||
        earlyUploadToken ||
        ""
      ).trim();

    if (failureToken) {
      setBelongingsPhotoUploadStatus_(failureToken, {
        state: "error",
        error: errorMessage,
        action: (data && data.action) || earlyAction || ""
      });
    }

    if (
      (data && data.action === "submit_intake") ||
      earlyAction === "submit_intake"
    ) {
      return intakeSubmissionHtmlResponse_(null, errorMessage);
    }

    return jsonResponse_({
      result: "error",
      error: errorMessage
    });
  }
}


/**
 * JSONP endpoint used by the externally hosted front end.
 * A normal cross-origin fetch to Apps Script cannot reliably read the response,
 * so the front end uses a <script> request and receives a real success/error
 * callback before it updates local UI state.
 *
 * Health test in browser:
 *   YOUR_WEB_APP_URL?action=health
 */
function doGet(e) {
  var callback = e && e.parameter ? String(e.parameter.callback || "") : "";

  try {
    var requestedAction = e && e.parameter ? String(e.parameter.action || "").trim() : "";

    if (requestedAction === "maintenance_status") {
      var maintenanceStatus = getWaffleMaintenanceStatus_();
      return callback
        ? javascriptResponse_(callback, maintenanceStatus)
        : jsonResponse_(maintenanceStatus);
    }

    if (
      isWaffleMaintenanceMode_() &&
      ["photo_uploader", "intake", "legacy_intake"].indexOf(requestedAction) !== -1
    ) {
      return buildWaffleMaintenanceRedirectHtml_();
    }

    // Serve the photo uploader itself from Apps Script. This keeps the actual
    // image upload inside the Apps Script origin, where google.script.run can
    // call server functions directly without a cross-origin POST/redirect.
    if (e && e.parameter && e.parameter.action === "photo_uploader") {
      return buildBelongingsPhotoUploaderHtml_(e.parameter);
    }

    if (e && e.parameter && e.parameter.action === "intake") {
      return buildDigitalIntakeHtml_(e.parameter);
    }

    if (e && e.parameter && e.parameter.action === "legacy_intake") {
      return buildLegacyIntakeHtml_(e.parameter);
    }

    if (e && e.parameter && e.parameter.action === "health") {
      var sheet = getTargetSheet_();
      var parentSpreadsheet = sheet.getParent();
      var health = {
        result: "success",
        action: "health",
        spreadsheetId: parentSpreadsheet.getId(),
        spreadsheetName: parentSpreadsheet.getName(),
        sheetName: sheet.getName(),
        sheetGid: sheet.getSheetId(),
        lastRow: sheet.getLastRow(),
        intakeTransport: "apps-script-hosted-google-script-run",
        intakeVersion: "hosted-intake-v11.0.5-potential-authoritative",
        dataVersions: getWaffleDataVersions_(),
        potentialStayCount: readPotentialStayRecords_().length,
        potentialSyncMode: "authoritative-direct-sheet",
        message: "Waffle House Apps Script is connected to the boarding database."
      };

      return callback ? javascriptResponse_(callback, health) : jsonResponse_(health);
    }

    if (e && e.parameter && e.parameter.action === "belongings_health") {
      var belongingsSheet = getBelongingsSheet_();
      var belongingsFolder = getBelongingsPhotoFolder_();
      var belongingsHealth = {
        result: "success",
        action: "belongings_health",
        sheetName: belongingsSheet.getName(),
        sheetGid: belongingsSheet.getSheetId(),
        folderId: belongingsFolder.getId(),
        folderName: belongingsFolder.getName(),
        folderUrl: belongingsFolder.getUrl(),
        message: "Pet belongings sheet and Google Drive folder are accessible."
      };

      return callback
        ? javascriptResponse_(callback, belongingsHealth)
        : jsonResponse_(belongingsHealth);
    }

    if (!e || !e.parameter || !e.parameter.payload) {
      var missing = {
        result: "error",
        error: "No payload was supplied. Use ?action=health to test this deployment."
      };
      return callback ? javascriptResponse_(callback, missing) : jsonResponse_(missing);
    }

    var data = JSON.parse(e.parameter.payload);

    assertWaffleActionAllowedDuringMaintenance_(data && data.action);

    if (data.action === "begin_belongings_photo_upload") {
      var beginToken = String(data.uploadToken || "").trim();
      if (!beginToken) throw new Error("Upload token is required.");

      setBelongingsPhotoUploadStatus_(beginToken, {
        state: "pending",
        message: "Waiting for photo POST request."
      });

      var beginResult = {
        result: "success",
        action: data.action,
        uploadToken: beginToken,
        uploadStatus: getBelongingsPhotoUploadStatus_(beginToken)
      };

      return callback
        ? javascriptResponse_(callback, beginResult)
        : jsonResponse_(beginResult);
    }

    if (data.action === "get_belongings_photo_upload_status") {
      var statusToken = String(data.uploadToken || "").trim();
      if (!statusToken) throw new Error("Upload token is required.");

      var statusResult = {
        result: "success",
        action: data.action,
        uploadToken: statusToken,
        uploadStatus: getBelongingsPhotoUploadStatus_(statusToken)
      };

      return callback
        ? javascriptResponse_(callback, statusResult)
        : jsonResponse_(statusResult);
    }

    var result = processSheetActionWithV108Receipt_(data);

    if (
      !isReadOnlySheetAction_(
        data.action
      )
    ) {
      invalidateWaffleForAction_(
        data.action
      );
    }

    return callback ? javascriptResponse_(callback, result) : jsonResponse_(result);

  } catch (error) {
    var failure = {
      result: "error",
      error: error && error.message ? error.message : String(error)
    };
    return callback ? javascriptResponse_(callback, failure) : jsonResponse_(failure);
  }
}




/* ============================================================
 * WAFFLE BOARDING HOUSE — SHARED REMINDERS & NOTES
 * ============================================================
 * Stored in the spreadsheet so every Web App user sees the same
 * sticky notes. No additional service or billing is required.
 */

var REMINDERS_NOTES_HEADERS_ = [
  "Created At",
  "Updated At",
  "Note ID",
  "Status",
  "Reminder Date",
  "Reminder Time",
  "Dog Name",
  "Note",
  "Author",
  "Completed At"
];


function getRemindersNotesSheet_() {
  var mainSheet = getTargetSheet_();
  var spreadsheet = mainSheet.getParent();
  var properties = PropertiesService.getScriptProperties();

  var sheetName = String(
    properties.getProperty(
      "REMINDERS_NOTES_SHEET_NAME"
    ) ||
    "Reminders_Notes"
  ).trim();

  var sheet =
    spreadsheet.getSheetByName(
      sheetName
    );

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet(
        sheetName
      );
  }

  if (
    sheet.getMaxColumns() <
    REMINDERS_NOTES_HEADERS_.length
  ) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      REMINDERS_NOTES_HEADERS_.length -
      sheet.getMaxColumns()
    );
  }

  var needsHeaders =
    sheet.getLastRow() === 0;

  if (!needsHeaders) {
    var existing =
      sheet
        .getRange(
          1,
          1,
          1,
          REMINDERS_NOTES_HEADERS_.length
        )
        .getValues()[0];

    for (
      var i = 0;
      i <
      REMINDERS_NOTES_HEADERS_.length;
      i++
    ) {
      if (
        String(existing[i] || "") !==
        REMINDERS_NOTES_HEADERS_[i]
      ) {
        needsHeaders = true;
        break;
      }
    }
  }

  if (needsHeaders) {
    sheet
      .getRange(
        1,
        1,
        1,
        REMINDERS_NOTES_HEADERS_.length
      )
      .setValues([
        REMINDERS_NOTES_HEADERS_
      ]);

    sheet.setFrozenRows(1);

    sheet
      .getRange(
        1,
        1,
        1,
        REMINDERS_NOTES_HEADERS_.length
      )
      .setFontWeight("bold")
      .setBackground("#ca8a04")
      .setFontColor("#ffffff");

    [
      155,
      155,
      250,
      90,
      120,
      105,
      150,
      420,
      140,
      155
    ].forEach(
      function(width, index) {
        sheet.setColumnWidth(
          index + 1,
          width
        );
      }
    );

    sheet
      .getRange("A:B")
      .setNumberFormat(
        "yyyy-mm-dd hh:mm:ss"
      );

    sheet
      .getRange("J:J")
      .setNumberFormat(
        "yyyy-mm-dd hh:mm:ss"
      );
  }

  return sheet;
}


function reminderNoteRowToObject_(
  row,
  rowNumber
) {
  row =
    Array.isArray(row)
      ? row
      : [];

  function dateTimeValue(value) {
    if (
      value instanceof Date &&
      !isNaN(value.getTime())
    ) {
      return value.toISOString();
    }

    return String(value || "");
  }

  return {
    row:
      rowNumber || null,
    createdAt:
      dateTimeValue(row[0]),
    updatedAt:
      dateTimeValue(row[1]),
    noteId:
      String(row[2] || ""),
    status:
      String(row[3] || "Open"),
    reminderDate:
      normalizeDateValue_(
        row[4]
      ),
    reminderTime:
      String(row[5] || "")
        .trim(),
    dogName:
      String(row[6] || "")
        .trim(),
    note:
      String(row[7] || ""),
    author:
      String(row[8] || "")
        .trim(),
    completedAt:
      dateTimeValue(row[9])
  };
}


function findReminderNoteById_(
  sheet,
  noteId
) {
  noteId =
    String(noteId || "")
      .trim();

  if (
    !noteId ||
    sheet.getLastRow() <
      2
  ) {
    return null;
  }

  var values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        REMINDERS_NOTES_HEADERS_.length
      )
      .getValues();

  for (
    var i = 0;
    i < values.length;
    i++
  ) {
    if (
      String(values[i][2] || "")
        .trim() ===
      noteId
    ) {
      return reminderNoteRowToObject_(
        values[i],
        i + 2
      );
    }
  }

  return null;
}


function normalizeReminderTime_(
  value
) {
  var text =
    String(value || "")
      .trim();

  if (!text) return "";

  var match =
    text.match(
      /^(\d{1,2}):(\d{2})$/
    );

  if (!match) {
    throw new Error(
      "Reminder time must use HH:MM format."
    );
  }

  var hours =
    Number(match[1]);

  var minutes =
    Number(match[2]);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(
      "Reminder time is invalid."
    );
  }

  return (
    String(hours).padStart(
      2,
      "0"
    ) +
    ":" +
    String(minutes).padStart(
      2,
      "0"
    )
  );
}


function reminderAuditSnapshot_(
  record
) {
  record =
    record &&
    typeof record === "object"
      ? record
      : {};

  return {
    status:
      String(
        record.status ||
        "Open"
      ),
    reminderDate:
      String(
        record.reminderDate ||
        ""
      ),
    reminderTime:
      String(
        record.reminderTime ||
        ""
      ),
    dogName:
      String(
        record.dogName ||
        ""
      ),
    note:
      String(
        record.note ||
        ""
      ),
    author:
      String(
        record.author ||
        ""
      ),
    completedAt:
      String(
        record.completedAt ||
        ""
      )
  };
}


function readRemindersNotesRecords_(
  limit
) {
  var sheet =
    getRemindersNotesSheet_();

  var lastRow =
    sheet.getLastRow();

  var requestedLimit =
    Math.min(
      Math.max(
        Number(limit || 500),
        1
      ),
      1000
    );

  if (lastRow < 2) {
    return [];
  }

  var count =
    Math.min(
      requestedLimit,
      lastRow - 1
    );

  var startRow =
    lastRow -
    count +
    1;

  var rows =
    sheet
      .getRange(
        startRow,
        1,
        count,
        REMINDERS_NOTES_HEADERS_.length
      )
      .getValues();

  var records =
    rows.map(
      function(row, index) {
        return reminderNoteRowToObject_(
          row,
          startRow + index
        );
      }
    );

  records.sort(
    function(a, b) {
      var aDone =
        String(a.status || "")
          .toLowerCase() ===
        "done";

      var bDone =
        String(b.status || "")
          .toLowerCase() ===
        "done";

      if (aDone !== bDone) {
        return aDone ? 1 : -1;
      }

      if (!aDone) {
        var aScheduled =
          a.reminderDate
            ? (
                a.reminderDate +
                "T" +
                (
                  a.reminderTime ||
                  "23:59"
                )
              )
            : "9999-12-31T23:59";

        var bScheduled =
          b.reminderDate
            ? (
                b.reminderDate +
                "T" +
                (
                  b.reminderTime ||
                  "23:59"
                )
              )
            : "9999-12-31T23:59";

        var scheduleCompare =
          aScheduled.localeCompare(
            bScheduled
          );

        if (scheduleCompare !== 0) {
          return scheduleCompare;
        }
      }

      return String(
        b.updatedAt ||
        b.createdAt ||
        ""
      ).localeCompare(
        String(
          a.updatedAt ||
          a.createdAt ||
          ""
        )
      );
    }
  );

  return records;
}


function saveReminderNote_(
  data
) {
  data =
    data &&
    typeof data === "object"
      ? data
      : {};

  var note =
    String(data.note || "")
      .trim()
      .substring(
        0,
        3000
      );

  if (!note) {
    throw new Error(
      "Reminder / note is required."
    );
  }

  var dogName =
    String(
      data.dogName || ""
    )
      .trim()
      .substring(
        0,
        100
      );

  var author =
    String(
      data.author || ""
    )
      .trim()
      .substring(
        0,
        80
      ) ||
    "Team member";

  var reminderDate =
    String(
      data.reminderDate || ""
    ).trim();

  if (reminderDate) {
    reminderDate =
      normalizeDateValue_(
        reminderDate
      );

    if (!reminderDate) {
      throw new Error(
        "Reminder date is invalid."
      );
    }
  }

  var reminderTime =
    normalizeReminderTime_(
      data.reminderTime
    );

  if (
    reminderTime &&
    !reminderDate
  ) {
    throw new Error(
      "Choose a reminder date when adding an expected time."
    );
  }

  var sheet =
    getRemindersNotesSheet_();

  var noteId =
    String(
      data.noteId || ""
    ).trim();

  var existing =
    noteId
      ? findReminderNoteById_(
          sheet,
          noteId
        )
      : null;

  var now =
    new Date();

  if (noteId && !existing) {
    throw new Error(
      "The reminder could not be found. Refresh the tab and try again."
    );
  }

  if (existing) {
    var before =
      reminderAuditSnapshot_(
        existing
      );

    sheet
      .getRange(
        existing.row,
        2
      )
      .setValue(now);

    sheet
      .getRange(
        existing.row,
        5
      )
      .setValue(
        reminderDate
      );

    sheet
      .getRange(
        existing.row,
        6
      )
      .setValue(
        reminderTime
      );

    sheet
      .getRange(
        existing.row,
        7
      )
      .setValue(
        dogName
      );

    sheet
      .getRange(
        existing.row,
        8
      )
      .setValue(
        note
      );

    sheet
      .getRange(
        existing.row,
        9
      )
      .setValue(
        author
      );

    var updated =
      findReminderNoteById_(
        sheet,
        noteId
      );

    logAuditEvent_({
      category:
        "Reminders & Notes",
      action:
        "Reminder Updated",
      dogName:
        updated.dogName,
      reference:
        noteId,
      summary:
        "Shared reminder updated" +
        (
          updated.dogName
            ? " for " +
              updated.dogName
            : ""
        ) +
        ".",
      changedFields:
        auditObjectChangedFields_(
          before,
          reminderAuditSnapshot_(
            updated
          ),
          {
            status: "Status",
            reminderDate:
              "Reminder Date",
            reminderTime:
              "Reminder Time",
            dogName: "Dog Name",
            note:
              "Reminder / Note",
            author: "Added By",
            completedAt:
              "Completed At"
          }
        ),
      before:
        before,
      after:
        reminderAuditSnapshot_(
          updated
        ),
      source:
        "Reminders & Notes"
    });

    touchWaffleDataVersion_(
      "reminders"
    );

    return updated;
  }

  noteId =
    "note_" +
    Utilities.getUuid()
      .replace(/-/g, "");

  sheet.appendRow([
    now,
    now,
    noteId,
    "Open",
    reminderDate,
    reminderTime,
    dogName,
    note,
    author,
    ""
  ]);

  var created =
    findReminderNoteById_(
      sheet,
      noteId
    );

  logAuditEvent_({
    category:
      "Reminders & Notes",
    action:
      "Reminder Added",
    dogName:
      dogName,
    reference:
      noteId,
    summary:
      "Shared reminder added" +
      (
        dogName
          ? " for " +
            dogName
          : ""
      ) +
      (
        reminderDate
          ? " for " +
            reminderDate +
            (
              reminderTime
                ? " at " +
                  reminderTime
                : ""
            )
          : ""
      ) +
      ".",
    changedFields: [
      "New reminder"
    ],
    after:
      reminderAuditSnapshot_(
        created
      ),
    source:
      "Reminders & Notes"
  });

  touchWaffleDataVersion_(
    "reminders"
  );

  return created;
}


function setReminderNoteDone_(
  data
) {
  data =
    data &&
    typeof data === "object"
      ? data
      : {};

  var noteId =
    String(
      data.noteId || ""
    ).trim();

  if (!noteId) {
    throw new Error(
      "Reminder ID is required."
    );
  }

  var sheet =
    getRemindersNotesSheet_();

  var existing =
    findReminderNoteById_(
      sheet,
      noteId
    );

  if (!existing) {
    throw new Error(
      "The reminder could not be found."
    );
  }

  var before =
    reminderAuditSnapshot_(
      existing
    );

  var isDone =
    data.isDone === true ||
    String(
      data.isDone
    ).toLowerCase() ===
      "true";

  var now =
    new Date();

  sheet
    .getRange(
      existing.row,
      2
    )
    .setValue(now);

  sheet
    .getRange(
      existing.row,
      4
    )
    .setValue(
      isDone
        ? "Done"
        : "Open"
    );

  sheet
    .getRange(
      existing.row,
      10
    )
    .setValue(
      isDone
        ? now
        : ""
    );

  var updated =
    findReminderNoteById_(
      sheet,
      noteId
    );

  logAuditEvent_({
    category:
      "Reminders & Notes",
    action:
      isDone
        ? "Reminder Completed"
        : "Reminder Reopened",
    dogName:
      updated.dogName,
    reference:
      noteId,
    summary:
      (
        isDone
          ? "Shared reminder completed"
          : "Shared reminder reopened"
      ) +
      (
        updated.dogName
          ? " for " +
            updated.dogName
          : ""
      ) +
      ".",
    changedFields: [
      "Status"
    ],
    before:
      before,
    after:
      reminderAuditSnapshot_(
        updated
      ),
    source:
      "Reminders & Notes"
  });

  touchWaffleDataVersion_(
    "reminders"
  );

  return updated;
}


function deleteReminderNote_(
  data
) {
  data =
    data &&
    typeof data === "object"
      ? data
      : {};

  var noteId =
    String(
      data.noteId || ""
    ).trim();

  if (!noteId) {
    throw new Error(
      "Reminder ID is required."
    );
  }

  var sheet =
    getRemindersNotesSheet_();

  var existing =
    findReminderNoteById_(
      sheet,
      noteId
    );

  if (!existing) {
    throw new Error(
      "The reminder could not be found."
    );
  }

  var before =
    reminderAuditSnapshot_(
      existing
    );

  sheet.deleteRow(
    existing.row
  );

  logAuditEvent_({
    category:
      "Reminders & Notes",
    action:
      "Reminder Deleted",
    dogName:
      existing.dogName,
    reference:
      noteId,
    summary:
      "Shared reminder deleted" +
      (
        existing.dogName
          ? " for " +
            existing.dogName
          : ""
      ) +
      ".",
    changedFields: [
      "Reminder deleted"
    ],
    before:
      before,
    source:
      "Reminders & Notes"
  });

  touchWaffleDataVersion_(
    "reminders"
  );

  return {
    noteId:
      noteId,
    deleted:
      true
  };
}


function setupWaffleHouseRemindersNotes() {
  var sheet =
    getRemindersNotesSheet_();

  logAuditEvent_({
    category: "System",
    action:
      "Reminders & Notes Enabled",
    summary:
      "Shared Reminders & Notes enabled.",
    source:
      "Apps Script Setup"
  });

  return {
    result: "success",
    sheetName:
      sheet.getName(),
    recordCount:
      Math.max(
        0,
        sheet.getLastRow() - 1
      )
  };
}


function verifyWaffleHouseRemindersNotes() {
  var sheet =
    getRemindersNotesSheet_();

  return {
    result: "success",
    sheetName:
      sheet.getName(),
    recordCount:
      Math.max(
        0,
        sheet.getLastRow() - 1
      ),
    headers:
      sheet
        .getRange(
          1,
          1,
          1,
          REMINDERS_NOTES_HEADERS_.length
        )
        .getValues()[0]
  };
}




function countStoredIntakeFields_(value) {
  if (!value) return 0;

  try {
    var parsed =
      typeof value === "string"
        ? JSON.parse(value)
        : value;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return 0;
    }

    return Object.keys(parsed)
      .filter(function(key) {
        return !!String(
          parsed[key] === null ||
          parsed[key] === undefined
            ? ""
            : parsed[key]
        ).trim();
      })
      .length;

  } catch (_) {
    return 0;
  }
}


function readBelongingsSummaryRecords_(
  sheet,
  stayKeys
) {
  if (
    !sheet ||
    sheet.getLastRow() < 2
  ) {
    return [];
  }

  var requested = {};

  (Array.isArray(stayKeys)
    ? stayKeys
    : []
  ).forEach(function(key) {
    key =
      String(key || "")
        .trim();

    if (key) {
      requested[key] = true;
    }
  });

  var hasFilter =
    Object.keys(requested)
      .length > 0;

  var values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        getBelongingsHeaders_()
          .length
      )
      .getValues();

  var summaries = [];

  values.forEach(function(row) {
    var stayKey =
      String(
        row[1] || ""
      ).trim();

    if (
      !stayKey ||
      (
        hasFilter &&
        !requested[stayKey]
      )
    ) {
      return;
    }

    var riskFlags = {};

    BELONGINGS_RISK_CONFIG_
      .forEach(
        function(flag, index) {
          var value =
            row[
              24 + index
            ];

          riskFlags[
            flag.key
          ] =
            value === true ||
            String(value)
              .toLowerCase() ===
              "true";
        }
      );

    var belongingsItemCount = 0;

    /*
     * Item "present" columns are 6, 8, 10 ... 22
     * in the sheet, which are indices 5, 7, 9 ... 21 here.
     */
    for (
      var col = 5;
      col <= 21;
      col += 2
    ) {
      if (
        row[col] === true ||
        String(row[col])
          .toLowerCase() ===
          "true"
      ) {
        belongingsItemCount++;
      }
    }

    var photos =
      parsePhotosJson_(
        row[23]
      );

    summaries.push({
      updatedAt:
        row[0] instanceof Date
          ? row[0].toISOString()
          : String(
              row[0] || ""
            ),
      stayKey:
        stayKey,
      dogName:
        String(
          row[2] || ""
        ),
      startDate:
        normalizeDateValue_(
          row[3]
        ),
      endDate:
        normalizeDateValue_(
          row[4]
        ),
      riskFlags:
        riskFlags,
      dogPhoto:
        parseDogPhotoJson_(
          row[29]
        ),
      intakeAttributesSource:
        String(
          row[31] || ""
        ),
      intakeFieldCount:
        countStoredIntakeFields_(
          row[30]
        ),
      belongingsItemCount:
        belongingsItemCount,
      belongingsPhotoCount:
        photos.length,
      hasBelongingsRecord:
        true
    });
  });

  return summaries;
}


function getGuestProfileDetail_(
  stayKey
) {
  stayKey =
    String(
      stayKey || ""
    ).trim();

  if (!stayKey) {
    throw new Error(
      "Stay Key is required."
    );
  }

  var records =
    readBelongingsRecords_(
      getBelongingsSheet_(),
      [
        stayKey
      ]
    );

  var record =
    records.length
      ? records[0]
      : null;

  if (!record) {
    return {
      stayKey:
        stayKey,
      intakeAttributes:
        {},
      intakeAttributesSource:
        "",
      dogPhoto:
        null,
      dogPhotoGallery:
        [],
      stayPhotos:
        [],
      updatedAt:
        ""
    };
  }

  return {
    stayKey:
      record.stayKey,
    dogName:
      record.dogName,
    updatedAt:
      record.updatedAt,
    intakeAttributes:
      record.intakeAttributes ||
      {},
    intakeAttributesSource:
      record.intakeAttributesSource ||
      "",
    dogPhoto:
      record.dogPhoto ||
      null,
    dogPhotoGallery:
      record.dogPhotoGallery ||
      [],
    stayPhotos:
      record.stayPhotos ||
      []
  };
}


function getGuestBelongingsDetail_(
  stayKey
) {
  stayKey =
    String(
      stayKey || ""
    ).trim();

  if (!stayKey) {
    throw new Error(
      "Stay Key is required."
    );
  }

  var records =
    readBelongingsRecords_(
      getBelongingsSheet_(),
      [
        stayKey
      ]
    );

  var record =
    records.length
      ? records[0]
      : null;

  if (!record) {
    var emptyItems = {};

    BELONGINGS_ITEM_CONFIG_
      .forEach(function(item) {
        emptyItems[
          item.key
        ] = {
          present: false,
          description: ""
        };
      });

    return {
      stayKey:
        stayKey,
      items:
        emptyItems,
      photos:
        [],
      riskFlags:
        normalizeBelongingsRiskFlags_(
          {},
          {}
        ),
      dogPhoto:
        null,
      dogPhotoGallery:
        [],
      stayPhotos:
        [],
      updatedAt:
        ""
    };
  }

  return {
    stayKey:
      record.stayKey,
    dogName:
      record.dogName,
    startDate:
      record.startDate,
    endDate:
      record.endDate,
    updatedAt:
      record.updatedAt,
    items:
      record.items ||
      {},
    photos:
      record.photos ||
      [],
    riskFlags:
      record.riskFlags ||
      {},
    dogPhoto:
      record.dogPhoto ||
      null,
    dogPhotoGallery:
      record.dogPhotoGallery ||
      [],
    stayPhotos:
      record.stayPhotos ||
      []
  };
}


function getGuestDirectoryPayload_() {
  var sheet =
    getTargetSheet_();

  var rows =
    sheet
      .getDataRange()
      .getValues();

  var timezone =
    sheet
      .getParent()
      .getSpreadsheetTimeZone();

  var todayStr =
    Utilities.formatDate(
      new Date(),
      timezone,
      "yyyy-MM-dd"
    );

  var today =
    new Date(
      todayStr +
      "T00:00:00"
    );

  var upcomingLimit =
    new Date(
      today.getTime()
    );

  upcomingLimit.setDate(
    upcomingLimit.getDate() +
    7
  );

  var upcomingLimitStr =
    Utilities.formatDate(
      upcomingLimit,
      timezone,
      "yyyy-MM-dd"
    );

  var bookings = [];
  var stayKeys = [];

  for (
    var i = 1;
    i < rows.length;
    i++
  ) {
    var row = rows[i];

    var dogName =
      String(
        row[1] || ""
      ).trim();

    var startDate =
      normalizeDateValue_(
        row[3]
      );

    var endDate =
      normalizeDateValue_(
        row[4] ||
        row[3]
      );

    var bookingType =
      String(
        row[11] ||
        "Boarding"
      ).trim();

    var typeLower =
      bookingType.toLowerCase();

    if (
      !dogName ||
      !startDate ||
      !endDate ||
      typeLower ===
        "meet & greet" ||
      typeLower ===
        "potential stay"
    ) {
      continue;
    }

    var isCurrent =
      startDate <= todayStr &&
      endDate >= todayStr;

    var isUpcoming =
      startDate > todayStr &&
      startDate <=
        upcomingLimitStr;

    if (
      !isCurrent &&
      !isUpcoming
    ) {
      continue;
    }

    var stayKey =
      makeGuestStayKey_(
        dogName,
        startDate,
        endDate
      );

    stayKeys.push(
      stayKey
    );

    bookings.push({
      row:
        i + 1,
      timestamp:
        row[0] instanceof Date
          ? row[0].toISOString()
          : String(
              row[0] || ""
            ),
      stayKey:
        stayKey,
      dogName:
        dogName,
      breed:
        String(
          row[2] || ""
        ).trim(),
      startDate:
        startDate,
      endDate:
        endDate,
      ownerName:
        String(
          row[5] || ""
        ).trim(),
      phone:
        String(
          row[6] || ""
        ).trim(),
      notes:
        String(
          row[9] || ""
        ).trim(),
      editLink:
        String(
          row[10] || ""
        ).trim(),
      bookingType:
        bookingType
    });
  }

  /*
   * V8.2 initial directory request returns only lightweight summaries.
   * Full intake attributes, belongings descriptions and photo galleries
   * are fetched only when the user opens that dog's section.
   */
  var summaries =
    readBelongingsSummaryRecords_(
      getBelongingsSheet_(),
      stayKeys
    );

  var digitalIntakes =
    getIntakeStatusRecords_(
      stayKeys,
      summaries
    );

  var legacyIntakes =
    getLegacyIntakeStatusRecords_(
      stayKeys
    );

  return {
    generatedAt:
      new Date()
        .toISOString(),
    bookings:
      bookings,
    summaries:
      summaries,
    digitalIntakes:
      digitalIntakes,
    legacyIntakes:
      legacyIntakes,
    operations:
      readStayOperations_(stayKeys)
  };
}



/* ============================================================
 * WAFFLE HOUSE V10.8.2 — PAST CARE DIRECTORY
 * ============================================================ */

function getPastGuestDirectoryPayload_(data) {
  data =
    data &&
    typeof data ===
      "object"
      ? data
      : {};

  var limit =
    Math.max(
      1,
      Math.min(
        Number(
          data.limit ||
          250
        ),
        500
      )
    );

  var sheet =
    getTargetSheet_();

  var rows =
    sheet
      .getDataRange()
      .getValues();

  var timezone =
    sheet
      .getParent()
      .getSpreadsheetTimeZone() ||
    Session
      .getScriptTimeZone();

  var todayStr =
    Utilities.formatDate(
      new Date(),
      timezone,
      "yyyy-MM-dd"
    );

  var bookings = [];

  var diagnostics = {
    scannedRows:
      Math.max(
        0,
        rows.length - 1
      ),
    emptyDog:
      0,
    invalidDates:
      0,
    activeOrFuture:
      0,
    meetGreets:
      0,
    potentialStays:
      0,
    historicalBoarding:
      0
  };

  var displayRows =
    sheet
      .getDataRange()
      .getDisplayValues();

  for (
    var i = 1;
    i < rows.length;
    i++
  ) {
    var row =
      rows[i];

    var dogName =
      String(
        row[1] ||
        ""
      ).trim();

    var displayRow =
      displayRows[i] ||
      [];

    var startDate =
      normalizeDateValue_(
        row[3]
      ) ||
      normalizeDateValue_(
        displayRow[3]
      );

    var endDate =
      normalizeDateValue_(
        row[4] ||
        row[3]
      ) ||
      normalizeDateValue_(
        displayRow[4] ||
        displayRow[3]
      );

    var bookingType =
      String(
        row[11] ||
        "Boarding"
      ).trim();

    var typeLower =
      bookingType
        .toLowerCase();

    if (!dogName) {
      diagnostics.emptyDog++;
      continue;
    }

    if (
      !startDate ||
      !endDate ||
      !/^\d{4}-\d{2}-\d{2}$/
        .test(
          startDate
        ) ||
      !/^\d{4}-\d{2}-\d{2}$/
        .test(
          endDate
        )
    ) {
      diagnostics.invalidDates++;
      continue;
    }

    if (
      typeLower ===
        "meet & greet"
    ) {
      diagnostics.meetGreets++;
      continue;
    }

    if (
      typeLower ===
        "potential stay"
    ) {
      diagnostics.potentialStays++;
      continue;
    }

    if (
      endDate >=
        todayStr
    ) {
      diagnostics.activeOrFuture++;
      continue;
    }

    diagnostics.historicalBoarding++;

    bookings.push({
      row:
        i + 1,
      timestamp:
        row[0] instanceof Date
          ? row[0]
              .toISOString()
          : String(
              row[0] ||
              ""
            ),
      stayKey:
        makeGuestStayKey_(
          dogName,
          startDate,
          endDate
        ),
      dogName:
        dogName,
      breed:
        String(
          row[2] ||
          ""
        ).trim(),
      startDate:
        startDate,
      endDate:
        endDate,
      ownerName:
        String(
          row[5] ||
          ""
        ).trim(),
      phone:
        String(
          row[6] ||
          ""
        ).trim(),
      notes:
        String(
          row[9] ||
          ""
        ).trim(),
      editLink:
        String(
          row[10] ||
          ""
        ).trim(),
      bookingType:
        bookingType ||
        "Boarding"
    });
  }

  bookings.sort(
    function(a, b) {
      var endCompare =
        String(
          b.endDate ||
          ""
        ).localeCompare(
          String(
            a.endDate ||
            ""
          )
        );

      if (endCompare) {
        return endCompare;
      }

      return String(
        b.startDate ||
        ""
      ).localeCompare(
        String(
          a.startDate ||
          ""
        )
      );
    }
  );

  var totalPastStays =
    bookings.length;

  bookings =
    bookings.slice(
      0,
      limit
    );

  var stayKeys =
    bookings.map(
      function(booking) {
        return booking.stayKey;
      }
    );

  var summaries =
    readBelongingsSummaryRecords_(
      getBelongingsSheet_(),
      stayKeys
    );

  var digitalIntakes =
    getIntakeStatusRecords_(
      stayKeys,
      summaries
    );

  var legacyIntakes =
    getLegacyIntakeStatusRecords_(
      stayKeys
    );

  return {
    generatedAt:
      new Date()
        .toISOString(),
    totalPastStays:
      totalPastStays,
    returned:
      bookings.length,
    limit:
      limit,
    bookings:
      bookings,
    summaries:
      summaries,
    digitalIntakes:
      digitalIntakes,
    legacyIntakes:
      legacyIntakes,
    diagnostics:
      diagnostics,
    today:
      todayStr,
    operations:
      readStayOperations_(stayKeys)
  };
}




/* ============================================================
 * WAFFLE HOUSE V8.3 — VERSIONED READ CACHE
 * ============================================================
 * Sheets / Drive remain the source of truth.
 * CacheService stores only short-lived copies of expensive reads.
 */

var WAFFLE_CACHE_NAMESPACE_ = "waffle_v83";
var WAFFLE_CACHE_MAX_CHARS_ = 95000;
var WAFFLE_DATA_VERSION_MEMORY_ = {};


function getWaffleDataVersionPropertyKey_(scope) {
  return (
    "WAFFLE_DATA_VERSION_" +
    String(scope || "general")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
  );
}


function getWaffleDataVersion_(scope) {
  scope = String(scope || "general")
    .trim()
    .toLowerCase();

  if (WAFFLE_DATA_VERSION_MEMORY_[scope]) {
    return WAFFLE_DATA_VERSION_MEMORY_[scope];
  }

  var raw = String(
    PropertiesService
      .getScriptProperties()
      .getProperty(
        getWaffleDataVersionPropertyKey_(scope)
      ) ||
    "1"
  );

  WAFFLE_DATA_VERSION_MEMORY_[scope] = raw;
  return raw;
}


function touchWaffleDataVersion_(scope) {
  scope = String(scope || "general")
    .trim()
    .toLowerCase();

  var properties =
    PropertiesService.getScriptProperties();

  var propertyKey =
    getWaffleDataVersionPropertyKey_(scope);

  var existing = Number(
    properties.getProperty(propertyKey) || 0
  );

  var next = Math.max(
    Date.now(),
    existing + 1
  );

  var value = String(next);

  properties.setProperty(
    propertyKey,
    value
  );

  WAFFLE_DATA_VERSION_MEMORY_[scope] = value;
  return value;
}


function waffleCacheFingerprint_(value) {
  var digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(value || ""),
      Utilities.Charset.UTF_8
    );

  return digest
    .slice(0, 10)
    .map(function(byteValue) {
      var normalized =
        byteValue < 0
          ? byteValue + 256
          : byteValue;

      return (
        "0" +
        normalized.toString(16)
      ).slice(-2);
    })
    .join("");
}


function waffleReadVariant_(action, data) {
  data =
    data &&
    typeof data === "object"
      ? data
      : {};

  var actionName =
    String(action || "");

  var variantPayload = {
    action:
      actionName,
    stayKey:
      String(data.stayKey || ""),
    stayKeys:
      Array.isArray(data.stayKeys)
        ? data.stayKeys
            .map(String)
            .sort()
        : [],
    limit:
      Number(data.limit || 0),
    dogName:
      String(data.dogName || ""),
    breed:
      String(data.breed || ""),
    masterKey:
      String(data.masterKey || ""),
    /*
     * Guest Directory membership/status changes when the calendar day
     * rolls over even if nobody edits the Sheet. Make the cache variant
     * date-aware so an old day's snapshot can never validate as unchanged.
     */
    dayKey:
      (
        actionName ===
          "get_guest_directory" ||
        actionName ===
          "get_past_guest_directory"
      )
        ? Utilities.formatDate(
            new Date(),
            Session.getScriptTimeZone(),
            "yyyy-MM-dd"
          )
        : ""
  };

  return waffleCacheFingerprint_(
    JSON.stringify(variantPayload)
  );
}


function waffleReadCacheKey_(
  scope,
  action,
  version,
  variant
) {
  return [
    WAFFLE_CACHE_NAMESPACE_,
    String(scope || ""),
    String(action || ""),
    String(version || ""),
    String(variant || "")
  ].join(":");
}


function safePutWaffleCache_(
  key,
  value,
  ttlSeconds
) {
  try {
    var text = JSON.stringify(value);

    if (
      text.length >
      WAFFLE_CACHE_MAX_CHARS_
    ) {
      return false;
    }

    CacheService
      .getScriptCache()
      .put(
        key,
        text,
        Math.max(
          1,
          Number(ttlSeconds || 30)
        )
      );

    return true;

  } catch (error) {
    console.warn(
      "Waffle cache write skipped:",
      error
    );

    return false;
  }
}


function getVersionedWaffleRead_(
  scope,
  action,
  data,
  ttlSeconds,
  builder
) {
  data =
    data &&
    typeof data === "object"
      ? data
      : {};

  var version =
    getWaffleDataVersion_(scope);

  var variant =
    waffleReadVariant_(
      action,
      data
    );

  var knownVersion =
    String(data.knownVersion || "");

  var knownVariant =
    String(data.knownVariant || "");

  if (
    knownVersion &&
    knownVariant &&
    knownVersion === version &&
    knownVariant === variant
  ) {
    return {
      result: "success",
      action: action,
      version: version,
      variant: variant,
      unchanged: true,
      cacheHit: true
    };
  }

  var cacheKey =
    waffleReadCacheKey_(
      scope,
      action,
      version,
      variant
    );

  var cache =
    CacheService.getScriptCache();

  var cached =
    cache.get(cacheKey);

  if (cached) {
    try {
      var parsed =
        JSON.parse(cached);

      parsed.result = "success";
      parsed.action = action;
      parsed.version = version;
      parsed.variant = variant;
      parsed.cacheHit = true;

      return parsed;

    } catch (_) {
      try {
        cache.remove(cacheKey);
      } catch (_) {}
    }
  }

  var built = builder();

  built =
    built &&
    typeof built === "object"
      ? built
      : {};

  built.result = "success";
  built.action = action;
  built.version = version;
  built.variant = variant;
  built.cacheHit = false;
  built.generatedAt =
    built.generatedAt ||
    new Date().toISOString();

  safePutWaffleCache_(
    cacheKey,
    built,
    ttlSeconds
  );

  return built;
}


function getWaffleDataVersions_() {
  return {
    directory:
      getWaffleDataVersion_("directory"),
    reminders:
      getWaffleDataVersion_("reminders"),
    audit:
      getWaffleDataVersion_("audit")
  };
}


function invalidateWaffleForAction_(action) {
  action = String(action || "").trim();

  /*
   * Only actions that do not already bump their scope inside the
   * underlying helper are listed here. This avoids duplicate
   * PropertiesService writes on a single save.
   */
  var directoryActions = {
    save_intake: true,
    create_boarding: true,
    update_boarding_dates: true,
    update_meet_greet_schedule: true,
    set_primary_dog_photo: true,
    delete_dog_photo: true,
    reorder_dog_photos: true,
    ensure_belongings_record: true,
    checkin_stay: true,
    checkout_stay: true,
    save_dog_master_profile: true,
    delete_stay_photo: true,
    create: true,
    update: true,
    delete: true,
    create_potential: true,
    update_potential: true,
    confirm_potential: true,
    delete_potential: true,
    update_guest_detail: true,
    delete_belongings_photo: true,
    create_intake_link: true
  };

  var reminderActions = {};

  if (directoryActions[action]) {
    touchWaffleDataVersion_("directory");
  }

  if (reminderActions[action]) {
    touchWaffleDataVersion_("reminders");
  }
}


var READ_ONLY_SHEET_ACTIONS_ = {
  get_data_versions: true,
  get_push_device: true,
  get_notification_centre: true,
  get_audit_log: true,
  get_guest_directory: true,
  get_potential_stays: true,
  get_past_guest_directory: true,
  get_guest_profile: true,
  get_guest_belongings: true,
  get_stay_operations: true,
  get_dog_master_profile: true,
  get_dog_history: true,
  get_returning_guest_prefill: true,
  get_reminders_notes: true,
  get_intake_statuses: true,
  get_legacy_intake_statuses: true,
  get_intake_prefill: true,
  get_belongings: true
};


function isReadOnlySheetAction_(action) {
  return (
    READ_ONLY_SHEET_ACTIONS_[
      String(action || "")
    ] === true
  );
}



/* ========================================================================
 * WAFFLE HOUSE V11.0.4 — SHARED POTENTIAL STAYS
 * Direct Apps Script source of truth for cross-device Potential Stay sync.
 * ======================================================================== */

function readPotentialStayRecords_() {
  var sheet =
    getTargetSheet_();

  var range =
    sheet.getDataRange();

  var rows =
    range.getValues();

  var displayRows =
    range.getDisplayValues();

  var records = [];

  for (
    var i = 1;
    i < rows.length;
    i++
  ) {
    var row =
      rows[i] || [];

    var displayRow =
      displayRows[i] || [];

    var bookingType =
      String(
        row[11] ||
        displayRow[11] ||
        ""
      )
        .trim()
        .toLowerCase();

    if (
      bookingType !==
        "potential stay" &&
      bookingType !==
        "potential"
    ) {
      continue;
    }

    var dogName =
      String(
        row[1] ||
        displayRow[1] ||
        ""
      ).trim();

    var startDate =
      normalizeDateValue_(
        row[3]
      ) ||
      normalizeDateValue_(
        displayRow[3]
      );

    var endDate =
      normalizeDateValue_(
        row[4] ||
        row[3]
      ) ||
      normalizeDateValue_(
        displayRow[4] ||
        displayRow[3]
      ) ||
      startDate;

    if (
      !dogName ||
      !startDate
    ) {
      continue;
    }

    var timestamp =
      row[0] instanceof Date
        ? row[0]
            .toISOString()
        : String(
            row[0] ||
            displayRow[0] ||
            ""
          );

    records.push({
      id:
        "sheet_pot_" +
        String(i + 1),
      row:
        i + 1,
      timestamp:
        timestamp,
      dogName:
        dogName,
      breed:
        String(
          row[2] ||
          displayRow[2] ||
          ""
        ).trim(),
      startDate:
        startDate,
      endDate:
        endDate,
      ownerName:
        String(
          row[5] ||
          displayRow[5] ||
          ""
        ).trim(),
      phone:
        String(
          row[6] ||
          displayRow[6] ||
          ""
        ).trim(),
      notes:
        String(
          row[9] ||
          displayRow[9] ||
          ""
        ).trim(),
      bookingType:
        "Potential Stay"
    });
  }

  records.sort(
    function(a, b) {
      var dateCompare =
        String(
          a.startDate ||
          ""
        ).localeCompare(
          String(
            b.startDate ||
            ""
          )
        );

      if (dateCompare) {
        return dateCompare;
      }

      return String(
        a.dogName ||
        ""
      ).localeCompare(
        String(
          b.dogName ||
          ""
        )
      );
    }
  );

  return records;
}



function verifyWaffleHousePotentialStaySync() {
  var sheet =
    getTargetSheet_();

  var records =
    readPotentialStayRecords_();

  var result = {
    result:
      "success",
    release:
      "v11.0.5",
    sheetName:
      sheet.getName(),
    sheetGid:
      sheet.getSheetId(),
    lastRow:
      sheet.getLastRow(),
    potentialStayCount:
      records.length,
    potentialStays:
      records.map(
        function(record) {
          return {
            row:
              record.row,
            dogName:
              record.dogName,
            startDate:
              record.startDate,
            endDate:
              record.endDate,
            bookingType:
              record.bookingType
          };
        }
      )
  };

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


function processReadOnlySheetAction_(data) {
  var action =
    String(data.action || "");

  if (
    action ===
    "get_notification_centre"
  ) {
    return getNotificationCentreResponse_(
      data
    );
  }

  if (
    action ===
    "get_push_device"
  ) {
    return {
      result:
        "success",
      action:
        action,
      device:
        getPushDevice_(
          data.subscriptionId
        )
    };
  }

  if (action === "get_data_versions") {
    return {
      result: "success",
      action: action,
      versions:
        getWaffleDataVersions_()
    };
  }

  if (action === "get_audit_log") {
    return getVersionedWaffleRead_(
      "audit",
      action,
      data,
      45,
      function() {
        var records =
          readAuditLogRecords_(
            data.limit || 300
          );

        return {
          records: records,
          totalReturned:
            records.length
        };
      }
    );
  }

  if (action === "get_guest_directory") {
    return getVersionedWaffleRead_(
      "directory",
      action,
      data,
      25,
      function() {
        return getGuestDirectoryPayload_();
      }
    );
  }


  if (action === "get_potential_stays") {
    /*
     * V11.0.5:
     * Potential Stays are a small, high-value shared dataset. Read them
     * directly from the Sheet on every network refresh so a device can never
     * validate an old empty snapshot as "unchanged".
     *
     * Browser IndexedDB still provides instant/offline fallback.
     */
    var potentialRecords =
      readPotentialStayRecords_();

    return {
      result:
        "success",
      action:
        action,
      records:
        potentialRecords,
      total:
        potentialRecords.length,
      syncMode:
        "authoritative-direct-sheet",
      sheetName:
        getTargetSheet_()
          .getName(),
      generatedAt:
        new Date()
          .toISOString()
    };
  }


  if (action === "get_past_guest_directory") {
    return getVersionedWaffleRead_(
      "directory",
      action,
      data,
      45,
      function() {
        return getPastGuestDirectoryPayload_(
          data
        );
      }
    );
  }

  if (action === "get_guest_profile") {
    return getVersionedWaffleRead_(
      "directory",
      action,
      data,
      90,
      function() {
        return {
          record:
            getGuestProfileDetail_(
              data.stayKey
            )
        };
      }
    );
  }

  if (action === "get_guest_belongings") {
    return getVersionedWaffleRead_(
      "directory",
      action,
      data,
      60,
      function() {
        return {
          record:
            getGuestBelongingsDetail_(
              data.stayKey
            )
        };
      }
    );
  }

  if (action === "get_stay_operations") {
    return getVersionedWaffleRead_("directory",action,data,20,function(){return {records:readStayOperations_(data.stayKeys)};});
  }

  if (action === "get_dog_master_profile") {
    return getVersionedWaffleRead_("directory",action,data,60,function(){return {record:getDogMasterProfile_(data)};});
  }

  if (action === "get_dog_history") {
    return { result: "success", action: action, history: getV108DogHistory_(data) };
  }

  if (action === "get_returning_guest_prefill") {
    return { result: "success", action: action, prefill: getV108ReturningGuestPrefill_(data) };
  }

  if (action === "get_reminders_notes") {
    return getVersionedWaffleRead_(
      "reminders",
      action,
      data,
      30,
      function() {
        var records =
          readRemindersNotesRecords_(
            data.limit || 500
          );

        return {
          records: records,
          totalReturned:
            records.length
        };
      }
    );
  }

  if (action === "get_intake_statuses") {
    return getVersionedWaffleRead_(
      "directory",
      action,
      data,
      20,
      function() {
        return {
          records:
            getIntakeStatusRecords_(
              data.stayKeys || []
            )
        };
      }
    );
  }

  if (action === "get_legacy_intake_statuses") {
    return getVersionedWaffleRead_(
      "directory",
      action,
      data,
      20,
      function() {
        return {
          records:
            getLegacyIntakeStatusRecords_(
              data.stayKeys || []
            )
        };
      }
    );
  }

  if (action === "get_intake_prefill") {
    return {
      result: "success",
      action: action,
      intake:
        getIntakePrefill_(
          data.token
        )
    };
  }

  if (action === "get_belongings") {
    return getVersionedWaffleRead_(
      "directory",
      action,
      data,
      45,
      function() {
        return {
          records:
            readBelongingsRecords_(
              getBelongingsSheet_(),
              data.stayKeys || []
            )
        };
      }
    );
  }

  throw new Error(
    "Unknown read action: " +
    action
  );
}



/* ========================================================================
 * WAFFLE HOUSE V10.8 — INTEGRATED ENHANCEMENTS
 * ======================================================================== */

function normalizeV108Identity_(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function phoneTailV108_(value) {
  var digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.slice(-8) : "";
}

function parseV108DogPhotoGalleryJson_(value) {
  if (!value) return [];
  try {
    var parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter(function(item) { return item && typeof item === "object"; }) : [];
  } catch (_) { return []; }
}

function normalizeV108DogPhotoGallery_(gallery, currentPhoto) {
  var seen = {};
  var out = [];
  function add(photo) {
    if (!photo || typeof photo !== "object") return;
    var id = String(photo.id || "").trim();
    if (!id || seen[id]) return;
    seen[id] = true;
    out.push(photo);
  }
  (Array.isArray(gallery) ? gallery : []).forEach(add);
  add(currentPhoto);
  return out;
}

function findV108BoardingRow_(rows, dogName, startDate, endDate) {
  var dog = normalizeV108Identity_(dogName);
  var start = normalizeDateValue_(startDate);
  var end = normalizeDateValue_(endDate || startDate);
  for (var i = 1; i < rows.length; i++) {
    var type = String(rows[i][11] || "").trim().toLowerCase();
    if (type === "meet & greet" || type === "potential stay") continue;
    if (dog && normalizeV108Identity_(rows[i][1]) !== dog) continue;
    if (start && normalizeDateValue_(rows[i][3]) !== start) continue;
    if (end && normalizeDateValue_(rows[i][4] || rows[i][3]) !== end) continue;
    return i + 1;
  }
  return -1;
}

function getV108DogHistory_(data) {
  data = data && typeof data === "object" ? data : {};
  var dogName = String(data.dogName || "").trim();
  if (!dogName) throw new Error("Dog Name is required for history.");
  var dogKey = normalizeV108Identity_(dogName);
  var rows = getTargetSheet_().getDataRange().getValues();
  var stays = [];
  var owners = {};
  for (var i = 1; i < rows.length; i++) {
    if (normalizeV108Identity_(rows[i][1]) !== dogKey) continue;
    var type = String(rows[i][11] || "").trim();
    var lower = type.toLowerCase();
    if (lower === "meet & greet" || lower === "potential stay") continue;
    var start = normalizeDateValue_(rows[i][3]);
    var end = normalizeDateValue_(rows[i][4] || rows[i][3]);
    if (!start) continue;
    var ownerName = String(rows[i][5] || "").trim();
    var phone = String(rows[i][6] || "").trim();
    owners[normalizeV108Identity_(ownerName) + "|" + phoneTailV108_(phone)] = {ownerName: ownerName, phone: phone};
    stays.push({
      stayKey: makeGuestStayKey_(String(rows[i][1] || ""), start, end),
      dogName: String(rows[i][1] || ""), breed: String(rows[i][2] || ""),
      startDate: start, endDate: end, ownerName: ownerName, phone: phone,
      notes: String(rows[i][9] || ""), bookingType: type || "Boarding"
    });
  }
  stays.sort(function(a,b){ return String(b.endDate || b.startDate).localeCompare(String(a.endDate || a.startDate)); });
  var records = readBelongingsRecords_(getBelongingsSheet_(), []).filter(function(r){ return normalizeV108Identity_(r.dogName) === dogKey; });
  records.sort(function(a,b){ return String(b.endDate || b.startDate || "").localeCompare(String(a.endDate || a.startDate || "")); });
  var latest = records.length ? records[0] : null;
  return {
    dogName: dogName,
    stayCount: stays.length,
    previousStays: stays,
    owners: Object.keys(owners).map(function(k){ return owners[k]; }).filter(function(o){ return o.ownerName || o.phone; }),
    latestProfile: latest ? {stayKey: latest.stayKey, intakeAttributes: latest.intakeAttributes || {}, intakeAttributesSource: latest.intakeAttributesSource || "", riskFlags: latest.riskFlags || {}, dogPhoto: latest.dogPhoto || null, dogPhotoGallery: latest.dogPhotoGallery || []} : null
  };
}

function getV108ReturningGuestPrefill_(data) {
  data = data && typeof data === "object" ? data : {};
  var dog = normalizeV108Identity_(data.dogName);
  var phone = phoneTailV108_(data.phone);
  if (!dog && !phone) return {matched:false,stayCount:0,suggested:{}};
  var rows = getTargetSheet_().getDataRange().getValues();
  var count = 0;
  var latest = null;
  for (var i = rows.length - 1; i >= 1; i--) {
    var type = String(rows[i][11] || "").trim().toLowerCase();
    if (type === "meet & greet" || type === "potential stay") continue;
    var dogMatch = dog && normalizeV108Identity_(rows[i][1]) === dog;
    var phoneMatch = phone && phoneTailV108_(rows[i][6]) === phone;
    if (!dogMatch && !phoneMatch) continue;
    count++;
    if (!latest) latest = {dogName:String(rows[i][1]||""),breed:String(rows[i][2]||""),ownerName:String(rows[i][5]||""),phone:String(rows[i][6]||""),notes:String(rows[i][9]||"")};
  }
  return {matched:!!latest,stayCount:count,suggested:latest||{}};
}

function copyV108PreviousProfile_(dogName, newStayKey, startDate, endDate) {
  var dog = normalizeV108Identity_(dogName);
  var sheet = getBelongingsSheet_();
  var records = readBelongingsRecords_(sheet, []).filter(function(r){ return normalizeV108Identity_(r.dogName) === dog && r.stayKey !== newStayKey; });
  records.sort(function(a,b){ return String(b.endDate || b.startDate || "").localeCompare(String(a.endDate || a.startDate || "")); });
  if (!records.length) return {copied:false};
  var previous = records[0];
  var row = upsertBelongingsRecord_(sheet,{stayKey:newStayKey,dogName:dogName,startDate:startDate,endDate:endDate,riskFlags:previous.riskFlags||{},intakeAttributes:previous.intakeAttributes||{},intakeAttributesSource:"Copied from previous stay"});
  if (previous.dogPhoto) sheet.getRange(row,30).setValue(JSON.stringify(previous.dogPhoto));
  var gallery = normalizeV108DogPhotoGallery_(previous.dogPhotoGallery || [], previous.dogPhoto || null);
  if (gallery.length) sheet.getRange(row,33).setValue(JSON.stringify(gallery));
  return {copied:true,sourceStayKey:previous.stayKey};
}

function createV108Boarding_(data) {
  var dogName=String(data.dogName||"").trim(), breed=String(data.breed||"").trim(), owner=String(data.ownerName||"").trim(), phone=String(data.phone||"").trim();
  var start=normalizeDateValue_(data.startDate), end=normalizeDateValue_(data.endDate||data.startDate);
  if (!dogName || !breed || !owner || !phone || !start || !end) throw new Error("Dog Name, Breed, dates, Owner and Contact Number are required.");
  if (end < start) throw new Error("Check-Out cannot be earlier than Check-In.");
  var sheet=getTargetSheet_();
  sheet.appendRow([new Date(),dogName,breed,start,end,owner,phone,"","",String(data.notes||"").trim(),"","Confirmed Boarding"]);
  var row=sheet.getLastRow();
  var stayKey=makeGuestStayKey_(dogName,start,end);
  var copied={copied:false};
  if (data.copyPreviousProfile === true || String(data.copyPreviousProfile).toLowerCase()==="true") copied=copyV108PreviousProfile_(dogName,stayKey,start,end);
  var intake=createIntakeLinkForBooking_(sheet,sheet.getDataRange().getValues(),{dogName:dogName,startDate:start,endDate:end});
  var after=auditBookingSnapshotFromSheetRow_(sheet,row);
  logAuditEvent_({category:"Boarding",action:"Booking Created",dogName:dogName,bookingType:"Confirmed Boarding",reference:sheet.getName()+"!A"+row,summary:"Confirmed boarding created for "+dogName+" from the Waffle House popup.",changedFields:["New record","Intake Link"],after:after,source:"Web App"});
  return {result:"success",action:"create_boarding",row:row,stayKey:stayKey,booking:after,intake:intake,copiedPreviousProfile:copied};
}

function updateV108BoardingDates_(data) {
  var sheet=getTargetSheet_(), rows=sheet.getDataRange().getValues();
  var row=findV108BoardingRow_(rows,data.originalDogName||data.dogName,data.originalStartDate||data.startDate,data.originalEndDate||data.endDate);
  if (row === -1) throw new Error("Confirmed boarding could not be found.");
  var before=auditBookingSnapshotFromSheetRow_(sheet,row), start=normalizeDateValue_(data.startDate), end=normalizeDateValue_(data.endDate||data.startDate);
  if (!start || !end || end < start) throw new Error("New boarding dates are invalid.");
  var oldStayKey = makeGuestStayKey_(before.dogName, before.startDate, before.endDate);
  sheet.getRange(row,4).setValue(start); sheet.getRange(row,5).setValue(end);
  var newStayKey = makeGuestStayKey_(before.dogName, start, end);
  if (oldStayKey !== newStayKey) {
    migrateBelongingsIdentityForGuest_(sheet.getParent(), oldStayKey, newStayKey, before.dogName);
    migrateIntakeIdentitiesForGuest_(oldStayKey, newStayKey, before.dogName);
  }
  var after=auditBookingSnapshotFromSheetRow_(sheet,row);
  logAuditEvent_({category:"Boarding",action:"Booking Dates Moved",dogName:after.dogName,bookingType:after.bookingType,reference:sheet.getName()+"!A"+row,summary:after.dogName+" moved to "+start+" – "+end+" from the calendar.",changedFields:["Start Date","End Date"],before:before,after:after,source:"Calendar Drag"});
  return {result:"success",action:"update_boarding_dates",row:row,booking:after};
}

function updateV108MeetGreetSchedule_(data) {
  var sheet=getTargetSheet_(), rows=sheet.getDataRange().getValues();
  var row=findBookingRow_(rows,"Meet & Greet",data.originalDogName||data.dogName,data.originalStartDate||data.startDate,"");
  if (row === -1) throw new Error("Meet & Greet could not be found.");
  var before=auditBookingSnapshotFromSheetRow_(sheet,row), date=normalizeDateValue_(data.startDate), time=String(data.time||"").trim();
  if (!date) throw new Error("Meet & Greet date is required.");
  sheet.getRange(row,4).setValue(date); sheet.getRange(row,5).setValue(date);
  if (time) sheet.getRange(row,10).setValue("Meet & Greet scheduled at "+time);
  var after=auditBookingSnapshotFromSheetRow_(sheet,row);
  logAuditEvent_({category:"Meet & Greet",action:"Meet & Greet Moved",dogName:after.dogName,bookingType:"Meet & Greet",reference:sheet.getName()+"!A"+row,summary:after.dogName+" Meet & Greet moved to "+date+(time?" at "+time:"")+".",changedFields:["Start Date"],before:before,after:after,source:"Calendar Drag"});
  return {result:"success",action:"update_meet_greet_schedule",row:row,booking:after};
}

function setV108PrimaryDogPhoto_(data) {
  var stayKey=String(data.stayKey||"").trim(), photoId=String(data.photoId||"").trim();
  var sheet=getBelongingsSheet_(), row=findBelongingsRow_(sheet,stayKey);
  if (row === -1) throw new Error("Dog photo record was not found.");
  var current=parseDogPhotoJson_(sheet.getRange(row,30).getValue());
  var gallery=normalizeV108DogPhotoGallery_(parseV108DogPhotoGalleryJson_(sheet.getRange(row,33).getValue()),current);
  var selected=gallery.filter(function(p){return String(p.id||"")===photoId;})[0];
  if (!selected) throw new Error("Selected dog photo was not found.");
  sheet.getRange(row,30).setValue(JSON.stringify(selected)); sheet.getRange(row,1).setValue(new Date());
  return {result:"success",action:"set_primary_dog_photo",photo:selected,gallery:gallery};
}

function deleteV108DogPhoto_(data) {
  var stayKey=String(data.stayKey||"").trim(), photoId=String(data.photoId||"").trim();
  var sheet=getBelongingsSheet_(), row=findBelongingsRow_(sheet,stayKey);
  if (row === -1) throw new Error("Dog photo record was not found.");
  var current=parseDogPhotoJson_(sheet.getRange(row,30).getValue());
  var gallery=normalizeV108DogPhotoGallery_(parseV108DogPhotoGalleryJson_(sheet.getRange(row,33).getValue()),current);
  var removed=gallery.filter(function(p){return String(p.id||"")===photoId;})[0];
  if (!removed) throw new Error("Selected dog photo was not found.");
  gallery=gallery.filter(function(p){return String(p.id||"")!==photoId;});
  var next=(current && String(current.id||"")===photoId)?(gallery.length?gallery[gallery.length-1]:null):current;
  sheet.getRange(row,30).setValue(next?JSON.stringify(next):""); sheet.getRange(row,33).setValue(JSON.stringify(gallery)); sheet.getRange(row,1).setValue(new Date());
  try { DriveApp.getFileById(photoId).setTrashed(true); } catch (_) {}
  return {result:"success",action:"delete_dog_photo",photo:next,gallery:gallery};
}

function reorderV108DogPhotos_(data) {
  var stayKey=String(data.stayKey||"").trim(), ids=Array.isArray(data.photoIds)?data.photoIds.map(String):[];
  var sheet=getBelongingsSheet_(), row=findBelongingsRow_(sheet,stayKey);
  if (row === -1) throw new Error("Dog photo record was not found.");
  var current=parseDogPhotoJson_(sheet.getRange(row,30).getValue());
  var gallery=normalizeV108DogPhotoGallery_(parseV108DogPhotoGalleryJson_(sheet.getRange(row,33).getValue()),current), byId={};
  gallery.forEach(function(p){byId[String(p.id||"")]=p;});
  var reordered=[]; ids.forEach(function(id){if(byId[id]){reordered.push(byId[id]);delete byId[id];}}); Object.keys(byId).forEach(function(id){reordered.push(byId[id]);});
  sheet.getRange(row,33).setValue(JSON.stringify(reordered)); sheet.getRange(row,1).setValue(new Date());
  return {result:"success",action:"reorder_dog_photos",gallery:reordered};
}

function getV108MutationReceipts_() {
  var raw=String(PropertiesService.getScriptProperties().getProperty("WAFFLE_V108_MUTATION_RECEIPTS")||"");
  if(!raw)return{}; try{return JSON.parse(raw)||{};}catch(_){return{};}
}
function saveV108MutationReceipt_(id) {
  id=String(id||"").trim(); if(!id)return;
  var receipts=getV108MutationReceipts_(); receipts[id]=Date.now();
  var keys=Object.keys(receipts).sort(function(a,b){return receipts[b]-receipts[a];}).slice(0,100),clean={}; keys.forEach(function(k){clean[k]=receipts[k];});
  PropertiesService.getScriptProperties().setProperty("WAFFLE_V108_MUTATION_RECEIPTS",JSON.stringify(clean));
}
function processSheetActionWithV108Receipt_(data) {
  assertWaffleActionAllowedDuringMaintenance_(data && data.action);
  data=data&&typeof data==="object"?data:{};
  var id=String(data.clientMutationId||"").trim();
  if(!id || isReadOnlySheetAction_(data.action)) return processSheetAction_(data);
  if(getV108MutationReceipts_()[id]) return {result:"success",action:data.action,duplicate:true,clientMutationId:id};
  var result=processSheetAction_(data); saveV108MutationReceipt_(id); result.clientMutationId=id; return result;
}


function ensureBelongingsRecordForPhoto_(data) {
  data =
    data &&
    typeof data ===
      "object"
      ? data
      : {};

  validateBelongingsPayload_(
    data
  );

  var sheet =
    getBelongingsSheet_();

  var stayKey =
    String(
      data.stayKey || ""
    ).trim();

  var existingRow =
    findBelongingsRow_(
      sheet,
      stayKey
    );

  if (
    existingRow !==
    -1
  ) {
    return {
      result:
        "success",
      action:
        "ensure_belongings_record",
      row:
        existingRow,
      stayKey:
        stayKey,
      created:
        false
    };
  }

  /*
   * Photo-only historical repair:
   * create the minimum Pet_Belongings record required by the hosted uploader.
   * No items, care flags, intake/profile fields or historical values are
   * supplied, so nothing from a completed stay can be overwritten.
   */
  var row =
    upsertBelongingsRecord_(
      sheet,
      {
        stayKey:
          stayKey,
        dogName:
          String(
            data.dogName || ""
          ).trim(),
        startDate:
          normalizeDateValue_(
            data.startDate
          ),
        endDate:
          normalizeDateValue_(
            data.endDate
          )
      }
    );

  logAuditEvent_({
    category:
      "Photos",
    action:
      "Historical Photo Record Created",
    dogName:
      String(
        data.dogName || ""
      ).trim(),
    bookingType:
      "Boarding",
    reference:
      stayKey,
    summary:
      "A minimal historical photo record was created for " +
      String(
        data.dogName ||
        "dog"
      ) +
      ".",
    changedFields:
      [
        "Photo Record"
      ],
    source:
      "Web App"
  });

  return {
    result:
      "success",
    action:
      "ensure_belongings_record",
    row:
      row,
    stayKey:
      stayKey,
    created:
      true
  };
}



/* ========================================================================
 * WAFFLE HOUSE V11.0 — OPERATIONS / MASTER PROFILES / MEDIA
 * ======================================================================== */

function getStayOperationsHeaders_() {
  return ["Updated At","Stay Key","Dog Name","Start Date","End Date","Status","Checked In At","Checked Out At","Operational Note"];
}
function getStayOperationsSheet_() {
  var ss=getTargetSheet_().getParent();
  var props=PropertiesService.getScriptProperties();
  var name=String(props.getProperty("STAY_OPERATIONS_SHEET_NAME")||"Stay_Operations").trim();
  var sh=ss.getSheetByName(name)||ss.insertSheet(name);
  var h=getStayOperationsHeaders_();
  if(sh.getMaxColumns()<h.length) sh.insertColumnsAfter(sh.getMaxColumns(),h.length-sh.getMaxColumns());
  var cur=sh.getLastRow()>0?sh.getRange(1,1,1,h.length).getValues()[0]:[];
  var needs=cur.length!==h.length;
  if(!needs){for(var i=0;i<h.length;i++){if(String(cur[i]||"")!==h[i]){needs=true;break;}}}
  if(needs){sh.getRange(1,1,1,h.length).setValues([h]);sh.setFrozenRows(1);}
  return sh;
}
function findStayOperationRow_(sh,stayKey){
  stayKey=String(stayKey||"").trim(); if(!stayKey||sh.getLastRow()<2)return -1;
  var v=sh.getRange(2,2,sh.getLastRow()-1,1).getDisplayValues();
  for(var i=0;i<v.length;i++) if(String(v[i][0]||"").trim()===stayKey)return i+2;
  return -1;
}
function readStayOperations_(stayKeys){
  var sh=getStayOperationsSheet_(); if(sh.getLastRow()<2)return [];
  var req={}; if(Array.isArray(stayKeys)&&stayKeys.length)stayKeys.forEach(function(k){req[String(k||"").trim()]=true;});
  var rows=sh.getRange(2,1,sh.getLastRow()-1,getStayOperationsHeaders_().length).getValues();
  return rows.map(function(r){
    var k=String(r[1]||"").trim(); if(!k)return null; if(Object.keys(req).length&&!req[k])return null;
    return {updatedAt:r[0] instanceof Date?r[0].toISOString():String(r[0]||""),stayKey:k,dogName:String(r[2]||"").trim(),startDate:normalizeDateValue_(r[3]),endDate:normalizeDateValue_(r[4]),status:String(r[5]||"expected").trim().toLowerCase(),checkedInAt:r[6] instanceof Date?r[6].toISOString():String(r[6]||""),checkedOutAt:r[7] instanceof Date?r[7].toISOString():String(r[7]||""),note:String(r[8]||"").trim()};
  }).filter(Boolean);
}
function setStayOperationalStatus_(data,status){
  data=data&&typeof data==="object"?data:{};
  var stayKey=String(data.stayKey||"").trim(), dogName=String(data.dogName||"").trim();
  var startDate=normalizeDateValue_(data.startDate), endDate=normalizeDateValue_(data.endDate||data.startDate);
  if(!stayKey||!dogName||!startDate||!endDate)throw new Error("Stay Key, Dog Name, Start Date and End Date are required.");
  status=String(status||"").trim().toLowerCase(); if(status!=="checked_in"&&status!=="checked_out")throw new Error("Unsupported stay operational status.");
  var sh=getStayOperationsSheet_(), row=findStayOperationRow_(sh,stayKey), existing=row===-1?null:(readStayOperations_([stayKey])[0]||null), now=new Date();
  var checkedInAt=existing&&existing.checkedInAt?existing.checkedInAt:"", checkedOutAt=existing&&existing.checkedOutAt?existing.checkedOutAt:"";
  if(status==="checked_in"){checkedInAt=now;checkedOutAt="";} else checkedOutAt=now;
  var rowData=[now,stayKey,dogName,startDate,endDate,status,checkedInAt,checkedOutAt,String(data.note||"").trim()];
  if(row===-1){sh.appendRow(rowData);row=sh.getLastRow();}else sh.getRange(row,1,1,rowData.length).setValues([rowData]);
  touchWaffleDataVersion_("directory");
  logAuditEvent_({category:"Boarding",action:status==="checked_in"?"Dog Checked In":"Dog Checked Out",dogName:dogName,bookingType:"Boarding",reference:stayKey,summary:dogName+(status==="checked_in"?" checked in.":" checked out."),changedFields:["Operational Status"],before:existing,after:{status:status,checkedInAt:checkedInAt,checkedOutAt:checkedOutAt},source:String(data.source||"Web App")});
  if(status==="checked_in"){try{syncDogMasterProfileFromStay_(data);}catch(e){console.warn("Master sync skipped",e);}}
  return {stayKey:stayKey,dogName:dogName,startDate:startDate,endDate:endDate,status:status,checkedInAt:checkedInAt instanceof Date?checkedInAt.toISOString():String(checkedInAt||""),checkedOutAt:checkedOutAt instanceof Date?checkedOutAt.toISOString():String(checkedOutAt||""),note:String(data.note||"").trim()};
}

function normalizeDogMasterIdentity_(v){return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
function makeDogMasterKey_(dogName,breed){return [normalizeDogMasterIdentity_(dogName),normalizeDogMasterIdentity_(breed)].join("|");}
function getDogMasterHeaders_(){return ["Updated At","Master Key","Dog Name","Breed","Owner Name","Phone","Notes","Profile JSON","Risk Flags JSON","Primary Photo JSON","Photo Gallery JSON","Last Stay Key","Stay Count"];}
function getDogMasterSheet_(){
  var ss=getTargetSheet_().getParent(), props=PropertiesService.getScriptProperties(), name=String(props.getProperty("DOG_MASTER_SHEET_NAME")||"Dog_Master_Profiles").trim();
  var sh=ss.getSheetByName(name)||ss.insertSheet(name), h=getDogMasterHeaders_();
  if(sh.getMaxColumns()<h.length)sh.insertColumnsAfter(sh.getMaxColumns(),h.length-sh.getMaxColumns());
  var cur=sh.getLastRow()>0?sh.getRange(1,1,1,h.length).getValues()[0]:[], needs=cur.length!==h.length;
  if(!needs){for(var i=0;i<h.length;i++){if(String(cur[i]||"")!==h[i]){needs=true;break;}}}
  if(needs){sh.getRange(1,1,1,h.length).setValues([h]);sh.setFrozenRows(1);} return sh;
}
function findDogMasterRow_(sh,key){key=String(key||"").trim();if(!key||sh.getLastRow()<2)return -1;var v=sh.getRange(2,2,sh.getLastRow()-1,1).getDisplayValues();for(var i=0;i<v.length;i++)if(String(v[i][0]||"").trim()===key)return i+2;return -1;}
function parseJsonObjectV11_(v,f){f=f===undefined?{}:f;if(!v)return f;try{var p=typeof v==="string"?JSON.parse(v):v;return p&&typeof p==="object"?p:f;}catch(_){return f;}}
function readPersistedDogMaster_(key){
  var sh=getDogMasterSheet_(), row=findDogMasterRow_(sh,key); if(row===-1)return null; var v=sh.getRange(row,1,1,getDogMasterHeaders_().length).getValues()[0];
  return {persisted:true,updatedAt:v[0] instanceof Date?v[0].toISOString():String(v[0]||""),masterKey:String(v[1]||""),dogName:String(v[2]||""),breed:String(v[3]||""),ownerName:String(v[4]||""),phone:String(v[5]||""),notes:String(v[6]||""),profile:parseJsonObjectV11_(v[7],{}),riskFlags:parseJsonObjectV11_(v[8],{}),primaryPhoto:parseJsonObjectV11_(v[9],null),photoGallery:parseV108DogPhotoGalleryJson_(v[10]),lastStayKey:String(v[11]||""),stayCount:Number(v[12]||0)};
}
function deriveDogMasterProfile_(dogName,breed){
  dogName=String(dogName||"").trim(); breed=String(breed||"").trim(); var key=makeDogMasterKey_(dogName,breed), rows=getTargetSheet_().getDataRange().getValues(), stays=[];
  for(var i=1;i<rows.length;i++){
    var r=rows[i], type=String(r[11]||"Boarding").trim().toLowerCase(); if(type==="meet & greet"||type==="potential stay")continue;
    var rd=String(r[1]||"").trim(), rb=String(r[2]||"").trim(); if(makeDogMasterKey_(rd,rb)!==key)continue;
    var sd=normalizeDateValue_(r[3]), ed=normalizeDateValue_(r[4]||r[3]); if(!sd||!ed)continue;
    stays.push({dogName:rd,breed:rb,startDate:sd,endDate:ed,ownerName:String(r[5]||"").trim(),phone:String(r[6]||"").trim(),notes:String(r[9]||"").trim(),stayKey:makeGuestStayKey_(rd,sd,ed)});
  }
  stays.sort(function(a,b){return String(b.endDate||b.startDate).localeCompare(String(a.endDate||a.startDate));});
  var latest=stays.length?stays[0]:{dogName:dogName,breed:breed,ownerName:"",phone:"",notes:"",stayKey:""};
  var br=readBelongingsRecords_(getBelongingsSheet_(),[]).filter(function(x){return normalizeDogMasterIdentity_(x.dogName)===normalizeDogMasterIdentity_(dogName);}).sort(function(a,b){return String(b.endDate||b.startDate||"").localeCompare(String(a.endDate||a.startDate||""));});
  var rec=br.length?br[0]:null;
  return {persisted:false,masterKey:key,dogName:latest.dogName||dogName,breed:latest.breed||breed,ownerName:latest.ownerName||"",phone:latest.phone||"",notes:latest.notes||"",profile:rec&&rec.intakeAttributes?rec.intakeAttributes:{},riskFlags:rec&&rec.riskFlags?rec.riskFlags:{},primaryPhoto:rec?rec.dogPhoto||null:null,photoGallery:rec?rec.dogPhotoGallery||[]:[],lastStayKey:rec?rec.stayKey:(latest.stayKey||""),stayCount:stays.length};
}
function getDogMasterProfile_(data){
  data=data&&typeof data==="object"?data:{}; var dogName=String(data.dogName||"").trim(), breed=String(data.breed||"").trim(), key=String(data.masterKey||"").trim()||makeDogMasterKey_(dogName,breed);
  var persisted=readPersistedDogMaster_(key), derived=deriveDogMasterProfile_(dogName||(persisted?persisted.dogName:""),breed||(persisted?persisted.breed:""));
  if(!persisted)return derived; persisted.stayCount=Math.max(Number(persisted.stayCount||0),Number(derived.stayCount||0)); return persisted;
}
function saveDogMasterProfile_(data){
  data=data&&typeof data==="object"?data:{}; var dogName=String(data.dogName||"").trim(), breed=String(data.breed||"").trim(); if(!dogName)throw new Error("Dog Name is required.");
  var key=makeDogMasterKey_(dogName,breed), derived=deriveDogMasterProfile_(dogName,breed), stayKey=String(data.stayKey||derived.lastStayKey||"").trim();
  var rec=stayKey?(readBelongingsRecords_(getBelongingsSheet_(),[stayKey])[0]||null):null;
  var profile=rec&&rec.intakeAttributes?rec.intakeAttributes:(derived.profile||{}), flags=rec&&rec.riskFlags?rec.riskFlags:(derived.riskFlags||{}), primary=rec?(rec.dogPhoto||derived.primaryPhoto||null):(derived.primaryPhoto||null), gallery=rec?(rec.dogPhotoGallery||derived.photoGallery||[]):(derived.photoGallery||[]), now=new Date();
  var dataRow=[now,key,dogName,breed,String(data.ownerName||derived.ownerName||"").trim(),String(data.phone||derived.phone||"").trim(),String(data.notes||derived.notes||"").trim(),JSON.stringify(profile),JSON.stringify(flags),primary?JSON.stringify(primary):"",JSON.stringify(gallery),stayKey,Number(derived.stayCount||0)];
  var sh=getDogMasterSheet_(), row=findDogMasterRow_(sh,key); if(row===-1){sh.appendRow(dataRow);row=sh.getLastRow();}else sh.getRange(row,1,1,dataRow.length).setValues([dataRow]);
  touchWaffleDataVersion_("directory"); logAuditEvent_({category:"Care",action:"Master Dog Profile Saved",dogName:dogName,bookingType:"Dog Master",reference:key,summary:"Persistent master profile saved for "+dogName+".",changedFields:["Dog Master Profile"],after:{masterKey:key,dogName:dogName,breed:breed,lastStayKey:stayKey},source:"Web App"});
  return getDogMasterProfile_({masterKey:key,dogName:dogName,breed:breed});
}
function syncDogMasterProfileFromStay_(data){if(!String(data&&data.dogName||"").trim())return null;return saveDogMasterProfile_(data);}

function parseStayPhotosJson_(v){return parsePhotosJson_(v);}
function deleteStayPhoto_(data){
  var stayKey=String(data.stayKey||"").trim(), photoId=String(data.photoId||"").trim(); if(!stayKey||!photoId)throw new Error("Stay Key and Photo ID are required.");
  var sh=getBelongingsSheet_(), row=findBelongingsRow_(sh,stayKey); if(row===-1)throw new Error("The stay media record was not found.");
  var photos=parseStayPhotosJson_(sh.getRange(row,34).getValue()), removed=photos.filter(function(p){return String(p.id||"")===photoId;})[0]; photos=photos.filter(function(p){return String(p.id||"")!==photoId;});
  sh.getRange(row,34).setValue(JSON.stringify(photos));sh.getRange(row,1).setValue(new Date()); if(removed){try{DriveApp.getFileById(photoId).setTrashed(true);}catch(_){}}
  touchWaffleDataVersion_("directory"); logAuditEvent_({category:"Photos",action:"Stay Photo Deleted",dogName:String(sh.getRange(row,3).getDisplayValue()||""),bookingType:"Boarding",reference:stayKey,summary:"A stay photo was deleted.",changedFields:["Stay Photos"],before:removed||null,after:{remaining:photos.length},source:"Web App"});
  return {stayKey:stayKey,photos:photos};
}

function processSheetAction_(data) {
  data =
    data &&
    typeof data === "object"
      ? data
      : {};

  if (
    isReadOnlySheetAction_(
      data.action
    )
  ) {
    return processReadOnlySheetAction_(
      data
    );
  }

  /*
   * V8.1: only mutations use the ScriptLock.
   * Reads remain lock-free so a photo upload/profile save cannot block
   * Guest Directory, Audit, Reminders or status loading.
   */
  var lock =
    LockService
      .getScriptLock();

  if (!lock.tryLock(5000)) {
    throw new Error(
      "Another Waffle House update is currently being saved. Please try this update again in a few seconds."
    );
  }

  try {
    var sheet =
      getTargetSheet_();

    var rows =
      sheet
        .getDataRange()
        .getValues();

    var result = {
      result: "success",
      action: data.action
    };

    if (data.action === "checkin_stay") { result.record=setStayOperationalStatus_(data,"checked_in"); return result; }
    if (data.action === "checkout_stay") { result.record=setStayOperationalStatus_(data,"checked_out"); return result; }
    if (data.action === "save_dog_master_profile") { result.record=saveDogMasterProfile_(data); return result; }
    if (data.action === "delete_stay_photo") { result.record=deleteStayPhoto_(data); return result; }

    if (data.action === "create_boarding") return createV108Boarding_(data);
    if (data.action === "update_boarding_dates") return updateV108BoardingDates_(data);
    if (data.action === "update_meet_greet_schedule") return updateV108MeetGreetSchedule_(data);
    if (data.action === "set_primary_dog_photo") return setV108PrimaryDogPhoto_(data);
    if (data.action === "delete_dog_photo") return deleteV108DogPhoto_(data);
    if (data.action === "reorder_dog_photos") return reorderV108DogPhotos_(data);

    if (
      data.action ===
      "register_push_device"
    ) {
      return registerPushDevice_(
        data
      );
    }

    if (
      data.action ===
      "update_push_preferences"
    ) {
      return updatePushPreferences_(
        data
      );
    }

    if (
      data.action ===
      "disable_push_device"
    ) {
      return disablePushDevice_(
        data.subscriptionId
      );
    }

    if (
      data.action ===
      "send_test_push"
    ) {
      return sendTestPushForDevice_(
        data.subscriptionId
      );
    }

    if (data.action === "save_reminder_note") {
      var isNewReminderNote = !String(data.noteId || "").trim();
      result.record = saveReminderNote_(data);

      if (isNewReminderNote) {
        safeSendPushToCategory_(
          "reminders",
          {
            title: "📌 New Waffle House Note" + (data.dogName ? " — " + String(data.dogName) : ""),
            body: String(data.note || "A new shared note was added.").slice(0, 180),
            link: "reminders.html",
            tag: "new-note-" + String(result.record && result.record.noteId ? result.record.noteId : Date.now()),
            ttlSeconds: 3600
          }
        );
      }
      return result;
    }

    if (data.action === "set_reminder_note_done") {
      result.record =
        setReminderNoteDone_(data);
      return result;
    }

    if (data.action === "delete_reminder_note") {
      result.record =
        deleteReminderNote_(data);
      return result;
    }

    if (data.action === "create_intake_link") {
      result.intake = createIntakeLinkForBooking_(
        sheet,
        rows,
        data
      );
      return result;
    }

    // ----------------------------------------------------
    // 1. SAVE NORMAL BOARDING INTAKE
    // ----------------------------------------------------
    if (data.action === "save_intake") {
      sheet.appendRow([
        new Date(),
        data.dogName || "",
        data.breed || "",
        data.startDate || "",
        data.endDate || "",
        data.ownerName || "",
        data.phone || "",
        data.likes || "",
        data.dislikes || "",
        data.notes || "",
        "",
        "Boarding"
      ]);

      result.row = sheet.getLastRow();

      var boardingAfter = auditBookingSnapshotFromSheetRow_(
        sheet,
        result.row
      );

      logAuditEvent_({
        category: "Boarding",
        action: "Booking Created",
        dogName: boardingAfter ? boardingAfter.dogName : data.dogName,
        bookingType: "Boarding",
        reference: sheet.getName() + "!A" + result.row,
        summary:
          "Boarding booking created for " +
          String(data.dogName || "dog") +
          ".",
        changedFields: ["New record"],
        after: boardingAfter,
        source: "Web App"
      });
    }

    // ----------------------------------------------------
    // 2. CREATE POTENTIAL STAY
    // ----------------------------------------------------
    else if (data.action === "create_potential") {
      validatePotentialPayload_(data);

      sheet.appendRow([
        new Date(),
        data.dogName || "",                    // B Dog Name
        data.breed || "",                      // C Breed
        data.startDate || "",                  // D Start Date
        data.endDate || data.startDate || "",  // E End Date
        data.ownerName || "",                  // F Owner
        data.phone || "",                      // G Contact Number
        "",                                    // H Likes
        "",                                    // I Dislikes
        data.notes || "",                      // J Notes
        "",                                    // K Edit Link
        "Potential Stay"                       // L Booking Type
      ]);

      result.row = sheet.getLastRow();
      result.bookingType = "Potential Stay";

      var potentialCreated = auditBookingSnapshotFromSheetRow_(
        sheet,
        result.row
      );

      logAuditEvent_({
        category: "Potential Stay",
        action: "Potential Created",
        dogName: potentialCreated ? potentialCreated.dogName : data.dogName,
        bookingType: "Potential Stay",
        reference: sheet.getName() + "!A" + result.row,
        summary:
          "Potential Stay created for " +
          String(data.dogName || "dog") +
          ".",
        changedFields: ["New record"],
        after: potentialCreated,
        source: "Web App"
      });
    }

    // ----------------------------------------------------
    // 3. UPDATE POTENTIAL STAY
    // ----------------------------------------------------
    else if (data.action === "update_potential") {
      validatePotentialPayload_(data);

      var updateRow = findBookingRow_(
        rows,
        "Potential Stay",
        data.originalDogName || data.dogName,
        data.originalStartDate || data.startDate,
        data.originalEndDate || data.endDate
      );

      if (updateRow === -1) {
        throw new Error("Potential Stay could not be found for update.");
      }

      var potentialBefore = auditBookingSnapshotFromSheetRow_(
        sheet,
        updateRow
      );

      sheet.getRange(updateRow, 2).setValue(data.dogName || "");
      sheet.getRange(updateRow, 3).setValue(data.breed || "");
      sheet.getRange(updateRow, 4).setValue(data.startDate || "");
      sheet.getRange(updateRow, 5).setValue(data.endDate || data.startDate || "");
      sheet.getRange(updateRow, 6).setValue(data.ownerName || "");
      sheet.getRange(updateRow, 7).setValue(data.phone || "");
      sheet.getRange(updateRow, 10).setValue(data.notes || "");
      sheet.getRange(updateRow, 12).setValue("Potential Stay");

      result.row = updateRow;
      result.bookingType = "Potential Stay";

      var potentialAfter = auditBookingSnapshotFromSheetRow_(
        sheet,
        updateRow
      );

      var potentialChanges = auditObjectChangedFields_(
        potentialBefore,
        potentialAfter,
        auditBookingFieldLabels_()
      );

      logAuditEvent_({
        category: "Potential Stay",
        action: "Potential Updated",
        dogName: potentialAfter ? potentialAfter.dogName : data.dogName,
        bookingType: "Potential Stay",
        reference: sheet.getName() + "!A" + updateRow,
        summary:
          "Potential Stay details updated for " +
          String(data.dogName || "dog") +
          ".",
        changedFields: potentialChanges,
        before: potentialBefore,
        after: potentialAfter,
        source: "Web App"
      });
    }

    // ----------------------------------------------------
    // 4. CONFIRM POTENTIAL -> CONFIRMED BOARDING
    // ----------------------------------------------------
    else if (data.action === "confirm_potential") {
      validatePotentialPayload_(data);

      var confirmRow = findBookingRow_(
        rows,
        "Potential Stay",
        data.originalDogName || data.dogName,
        data.originalStartDate || data.startDate,
        data.originalEndDate || data.endDate
      );

      if (confirmRow === -1) {
        throw new Error("Potential Stay could not be found for confirmation.");
      }

      var confirmBefore = auditBookingSnapshotFromSheetRow_(
        sheet,
        confirmRow
      );

      // Save any edits in the modal, then mark the SAME row confirmed.
      sheet.getRange(confirmRow, 2).setValue(data.dogName || "");
      sheet.getRange(confirmRow, 3).setValue(data.breed || "");
      sheet.getRange(confirmRow, 4).setValue(data.startDate || "");
      sheet.getRange(confirmRow, 5).setValue(data.endDate || data.startDate || "");
      sheet.getRange(confirmRow, 6).setValue(data.ownerName || "");
      sheet.getRange(confirmRow, 7).setValue(data.phone || "");
      sheet.getRange(confirmRow, 10).setValue(data.notes || "");
      sheet.getRange(confirmRow, 12).setValue("Confirmed Boarding");

      result.row = confirmRow;
      result.bookingType = "Confirmed Boarding";

      var confirmAfter = auditBookingSnapshotFromSheetRow_(
        sheet,
        confirmRow
      );

      var confirmChanges = auditObjectChangedFields_(
        confirmBefore,
        confirmAfter,
        auditBookingFieldLabels_()
      );

      logAuditEvent_({
        category: "Boarding",
        action: "Potential Confirmed",
        dogName: confirmAfter ? confirmAfter.dogName : data.dogName,
        bookingType: "Confirmed Boarding",
        reference: sheet.getName() + "!A" + confirmRow,
        summary:
          "Potential Stay confirmed as boarding for " +
          String(data.dogName || "dog") +
          ".",
        changedFields: confirmChanges,
        before: confirmBefore,
        after: confirmAfter,
        source: "Web App"
      });
    }

    // ----------------------------------------------------
    // 5. DELETE POTENTIAL STAY
    // ----------------------------------------------------
    else if (data.action === "delete_potential") {
      var deletePotentialRow = findBookingRow_(
        rows,
        "Potential Stay",
        data.originalDogName || data.dogName,
        data.originalStartDate || data.startDate,
        data.originalEndDate || data.endDate
      );

      if (deletePotentialRow === -1) {
        throw new Error("Potential Stay could not be found for deletion.");
      }

      var deletedPotential = auditBookingSnapshotFromSheetRow_(
        sheet,
        deletePotentialRow
      );

      sheet.deleteRow(deletePotentialRow);
      result.row = deletePotentialRow;

      logAuditEvent_({
        category: "Potential Stay",
        action: "Potential Deleted",
        dogName:
          deletedPotential
            ? deletedPotential.dogName
            : (data.originalDogName || data.dogName),
        bookingType: "Potential Stay",
        reference: sheet.getName() + "!A" + deletePotentialRow,
        summary:
          "Potential Stay deleted for " +
          String(
            (deletedPotential && deletedPotential.dogName) ||
            data.originalDogName ||
            data.dogName ||
            "dog"
          ) +
          ".",
        changedFields: ["Deleted record"],
        before: deletedPotential,
        source: "Web App"
      });
    }

    // ----------------------------------------------------
    // 6. CREATE MEET & GREET
    // ----------------------------------------------------
    else if (data.action === "create") {
      if (!String(data.dogName || "").trim()) {
        throw new Error("Dog Name is required.");
      }
      if (!String(data.startDate || "").trim()) {
        throw new Error("Meet & Greet date is required.");
      }

      sheet.appendRow([
        new Date(),
        data.dogName || "",
        data.breed || "",
        data.startDate || "",
        data.endDate || data.startDate || "",
        "", "", "", "",
        data.notes || "",
        "",
        "Meet & Greet"
      ]);

      result.row = sheet.getLastRow();

      var meetCreated = auditBookingSnapshotFromSheetRow_(
        sheet,
        result.row
      );

      logAuditEvent_({
        category: "Meet & Greet",
        action: "Meet & Greet Created",
        dogName: meetCreated ? meetCreated.dogName : data.dogName,
        bookingType: "Meet & Greet",
        reference: sheet.getName() + "!A" + result.row,
        summary:
          "Meet & Greet created for " +
          String(data.dogName || "dog") +
          (
            auditMeetGreetScheduleText_(
              meetCreated
            )
              ? " on " +
                auditMeetGreetScheduleText_(
                  meetCreated
                )
              : ""
          ) +
          ".",
        changedFields: ["New record"],
        after: meetCreated,
        source: "Web App"
      });
    }

    // ----------------------------------------------------
    // 7. UPDATE MEET & GREET
    // ----------------------------------------------------
    else if (data.action === "update") {
      var updateMeetRow = findBookingRow_(
        rows,
        "Meet & Greet",
        data.originalDogName || data.dogName,
        data.originalStartDate || data.startDate,
        ""
      );

      if (updateMeetRow === -1) {
        throw new Error("Meet & Greet could not be found for update.");
      }

      var meetBefore = auditBookingSnapshotFromSheetRow_(
        sheet,
        updateMeetRow
      );

      sheet.getRange(updateMeetRow, 2).setValue(data.dogName || "");
      sheet.getRange(updateMeetRow, 3).setValue(data.breed || "");
      sheet.getRange(updateMeetRow, 10).setValue(data.notes || "");
      result.row = updateMeetRow;

      var meetAfter = auditBookingSnapshotFromSheetRow_(
        sheet,
        updateMeetRow
      );

      var meetChanges = auditObjectChangedFields_(
        meetBefore,
        meetAfter,
        auditBookingFieldLabels_()
      );

      logAuditEvent_({
        category: "Meet & Greet",
        action: "Meet & Greet Updated",
        dogName: meetAfter ? meetAfter.dogName : data.dogName,
        bookingType: "Meet & Greet",
        reference: sheet.getName() + "!A" + updateMeetRow,
        summary:
          "Meet & Greet details updated for " +
          String(data.dogName || "dog") +
          (
            auditMeetGreetScheduleText_(
              meetAfter
            )
              ? " — " +
                auditMeetGreetScheduleText_(
                  meetAfter
                )
              : ""
          ) +
          ".",
        changedFields: meetChanges,
        before: meetBefore,
        after: meetAfter,
        source: "Web App"
      });
    }

    // ----------------------------------------------------
    // 8. DELETE MEET & GREET
    // ----------------------------------------------------
    else if (data.action === "delete") {
      var deleteMeetRow = findBookingRow_(
        rows,
        "Meet & Greet",
        data.originalDogName || data.dogName,
        data.originalStartDate || data.startDate,
        ""
      );

      if (deleteMeetRow === -1) {
        throw new Error("Meet & Greet could not be found for deletion.");
      }

      var deletedMeet = auditBookingSnapshotFromSheetRow_(
        sheet,
        deleteMeetRow
      );

      sheet.deleteRow(deleteMeetRow);
      result.row = deleteMeetRow;

      logAuditEvent_({
        category: "Meet & Greet",
        action: "Meet & Greet Deleted",
        dogName:
          deletedMeet
            ? deletedMeet.dogName
            : (data.originalDogName || data.dogName),
        bookingType: "Meet & Greet",
        reference: sheet.getName() + "!A" + deleteMeetRow,
        summary:
          "Meet & Greet deleted for " +
          String(
            (deletedMeet && deletedMeet.dogName) ||
            data.originalDogName ||
            data.dogName ||
            "dog"
          ) +
          (
            auditMeetGreetScheduleText_(
              deletedMeet
            )
              ? " — " +
                auditMeetGreetScheduleText_(
                  deletedMeet
                )
              : ""
          ) +
          ".",
        changedFields: ["Deleted record"],
        before: deletedMeet,
        source: "Web App"
      });
    }

    // ----------------------------------------------------
    // 9. UPDATE A BOARDING GUEST DETAIL FROM THE WEB APP DIRECTORY
    // ----------------------------------------------------
    else if (data.action === "update_guest_detail") {
      var fieldKey = String(data.fieldKey || "").trim();
      var fieldConfig = GUEST_DIRECTORY_EDIT_FIELDS_[fieldKey];

      if (!fieldConfig) {
        throw new Error("This guest field cannot be edited from the web app.");
      }

      var originalDogName = String(
        data.originalDogName || data.dogName || ""
      ).trim();

      var guestStartDate = normalizeDateValue_(data.startDate);
      var guestEndDate = normalizeDateValue_(data.endDate || data.startDate);

      if (!originalDogName) {
        throw new Error("Original Dog Name is required.");
      }
      if (!guestStartDate || !guestEndDate) {
        throw new Error("Guest stay dates are required.");
      }

      var guestRow = findGuestBookingRow_(
        rows,
        originalDogName,
        guestStartDate,
        guestEndDate
      );

      if (guestRow === -1) {
        throw new Error(
          "The boarding guest could not be found. Sync the spreadsheet and try again."
        );
      }

      var guestBefore = auditBookingSnapshotFromSheetRow_(
        sheet,
        guestRow
      );

      var newValue = String(data.value === undefined ? "" : data.value).trim();

      if (fieldKey === "dogName" && !newValue) {
        throw new Error("Dog Name cannot be blank.");
      }

      var oldStayKey = makeGuestStayKey_(
        guestBefore.dogName,
        guestBefore.startDate,
        guestBefore.endDate
      );

      sheet
        .getRange(guestRow, fieldConfig.column)
        .setValue(newValue);

      SpreadsheetApp.flush();

      var guestAfter = auditBookingSnapshotFromSheetRow_(
        sheet,
        guestRow
      );

      var newStayKey = makeGuestStayKey_(
        guestAfter.dogName,
        guestAfter.startDate,
        guestAfter.endDate
      );

      var belongingsMigrated = false;
      var intakeMigrations = {
        digital: 0,
        legacy: 0
      };

      if (oldStayKey !== newStayKey) {
        belongingsMigrated = migrateBelongingsIdentityForGuest_(
          sheet.getParent(),
          oldStayKey,
          newStayKey,
          guestAfter.dogName
        );

        intakeMigrations =
          migrateIntakeIdentitiesForGuest_(
            oldStayKey,
            newStayKey,
            guestAfter.dogName
          );
      }

      syncCoreBookingFieldsToIntakeAttributes_(
        newStayKey,
        guestAfter
      );

      var changedFields = auditObjectChangedFields_(
        guestBefore,
        guestAfter,
        auditBookingFieldLabels_()
      );

      if (changedFields.length > 0) {
        logAuditEvent_({
          category: "Boarding",
          action: "Guest Detail Updated",
          dogName: guestAfter.dogName,
          bookingType: guestAfter.bookingType || "Boarding",
          reference: sheet.getName() + "!A" + guestRow,
          summary:
            fieldConfig.label +
            " updated for " +
            guestAfter.dogName +
            " from the Guest Directory & Care screen.",
          changedFields: changedFields,
          before: guestBefore,
          after: guestAfter,
          source: "Web App"
        });
      }

      result.row = guestRow;
      result.fieldKey = fieldKey;
      result.fieldLabel = fieldConfig.label;
      result.record = guestAfter;
      result.oldStayKey = oldStayKey;
      result.newStayKey = newStayKey;
      result.belongingsMigrated =
        belongingsMigrated;
      result.digitalIntakeMigrated =
        intakeMigrations.digital;
      result.legacyIntakeMigrated =
        intakeMigrations.legacy;
    }

    // ----------------------------------------------------
    // 10. SAVE / UPDATE CURRENT PET BELONGINGS
    // ----------------------------------------------------
    else if (
      data.action ===
      "ensure_belongings_record"
    ) {
      var ensuredPhotoRecord =
        ensureBelongingsRecordForPhoto_(
          data
        );

      result.row =
        ensuredPhotoRecord.row;

      result.stayKey =
        ensuredPhotoRecord.stayKey;

      result.created =
        ensuredPhotoRecord.created;
    }

    else if (data.action === "save_belongings") {
      validateBelongingsPayload_(data);
      var belongingsSheet = getBelongingsSheet_();
      var existingBelongingsRow = findBelongingsRow_(
        belongingsSheet,
        String(data.stayKey || "")
      );

      var belongingsBefore =
        existingBelongingsRow === -1
          ? null
          : auditBelongingsSnapshotFromRow_(
              belongingsSheet,
              existingBelongingsRow
            );

      var belongingsRow = upsertBelongingsRecord_(belongingsSheet, data);
      var belongingsAfter = auditBelongingsSnapshotFromRow_(
        belongingsSheet,
        belongingsRow
      );

      var belongingsChanges = auditBelongingsChangedFields_(
        belongingsBefore,
        belongingsAfter
      );

      if (belongingsChanges.length > 0) {
        logAuditEvent_({
          category: "Belongings",
          action:
            belongingsBefore
              ? "Belongings Updated"
              : "Belongings Created",
          dogName: String(data.dogName || ""),
          bookingType: "Boarding",
          reference: String(data.stayKey || ""),
          summary:
            (belongingsBefore
              ? "Belongings/care details updated for "
              : "Belongings record created for ") +
            String(data.dogName || "dog") +
            ".",
          changedFields: belongingsChanges,
          before: belongingsBefore,
          after: belongingsAfter,
          source: "Web App"
        });
      }

      result.row = belongingsRow;
      result.stayKey = String(data.stayKey || "");
    }

    // ----------------------------------------------------
    // 12. UPLOAD A BELONGINGS PHOTO TO GOOGLE DRIVE
    //     (POST only - photo data is too large for JSONP URLs)
    // ----------------------------------------------------
    else if (data.action === "upload_belongings_photo") {
      validateBelongingsPayload_(data);

      if (!String(data.photoData || "").trim()) {
        throw new Error("No photo data was supplied.");
      }

      var photoSheet = getBelongingsSheet_();
      var photoRow = upsertBelongingsRecord_(photoSheet, data);
      var photo = saveBelongingsPhoto_(data);
      var currentPhotos = parsePhotosJson_(photoSheet.getRange(photoRow, 24).getValue());
      currentPhotos.push(photo);
      photoSheet.getRange(photoRow, 24).setValue(JSON.stringify(currentPhotos));
      photoSheet.getRange(photoRow, 1).setValue(new Date());

      result.row = photoRow;
      result.photo = photo;

      logAuditEvent_({
        category: "Photos",
        action: "Belongings Photo Added",
        dogName: String(data.dogName || ""),
        bookingType: "Boarding",
        reference: String(data.stayKey || ""),
        summary:
          "Belongings photo added for " +
          String(data.dogName || "dog") +
          ".",
        changedFields: ["Belongings Photos"],
        after: {
          id: photo.id || "",
          name: photo.name || "",
          label: photo.label || "",
          url: photo.url || ""
        },
        source: "Web App"
      });
    }

    // ----------------------------------------------------
    // 13. DELETE A BELONGINGS PHOTO
    // ----------------------------------------------------
    else if (data.action === "delete_belongings_photo") {
      var deletePhotoSheet = getBelongingsSheet_();
      var deletePhotoRow = findBelongingsRow_(deletePhotoSheet, String(data.stayKey || ""));

      if (deletePhotoRow === -1) {
        throw new Error("Belongings record could not be found.");
      }

      var deletePhotoId = String(data.photoId || "").trim();
      if (!deletePhotoId) {
        throw new Error("Photo ID is required.");
      }

      var photosBeforeDelete = parsePhotosJson_(deletePhotoSheet.getRange(deletePhotoRow, 24).getValue());
      var deletedPhotoRecord = photosBeforeDelete.filter(function(photoItem) {
        return String(photoItem.id || "") === deletePhotoId;
      })[0] || null;

      var photosAfterDelete = photosBeforeDelete.filter(function(photoItem) {
        return String(photoItem.id || "") !== deletePhotoId;
      });

      if (photosAfterDelete.length === photosBeforeDelete.length) {
        throw new Error("Photo could not be found in this belongings record.");
      }

      try {
        DriveApp.getFileById(deletePhotoId).setTrashed(true);
      } catch (driveDeleteError) {
        // Keep the database consistent even if the Drive file was already removed.
      }

      deletePhotoSheet.getRange(deletePhotoRow, 24).setValue(JSON.stringify(photosAfterDelete));
      deletePhotoSheet.getRange(deletePhotoRow, 1).setValue(new Date());
      result.row = deletePhotoRow;
      result.photoId = deletePhotoId;

      var deletePhotoDogName = String(
        deletePhotoSheet.getRange(deletePhotoRow, 3).getDisplayValue() || ""
      );

      logAuditEvent_({
        category: "Photos",
        action: "Belongings Photo Deleted",
        dogName: deletePhotoDogName,
        bookingType: "Boarding",
        reference: String(data.stayKey || ""),
        summary:
          "Belongings photo deleted for " +
          (deletePhotoDogName || "dog") +
          ".",
        changedFields: ["Belongings Photos"],
        before: deletedPhotoRecord
          ? {
              id: deletedPhotoRecord.id || "",
              name: deletedPhotoRecord.name || "",
              label: deletedPhotoRecord.label || "",
              url: deletedPhotoRecord.url || ""
            }
          : { id: deletePhotoId },
        source: "Web App"
      });
    }

    else {
      throw new Error("Unknown action: " + String(data.action || ""));
    }

    SpreadsheetApp.flush();
    return result;

  } finally {
    try {
      lock.releaseLock();
    } catch (releaseError) {
      // Ignore release errors.
    }
  }
}



var WAFFLE_SPREADSHEET_CACHE_ = null;


function getWaffleSpreadsheet_() {
  if (WAFFLE_SPREADSHEET_CACHE_) {
    return WAFFLE_SPREADSHEET_CACHE_;
  }

  var spreadsheetId =
    String(
      PropertiesService
        .getScriptProperties()
        .getProperty(
          "SPREADSHEET_ID"
        ) ||
      ""
    ).trim();

  if (!spreadsheetId) {
    throw new Error(
      "SPREADSHEET_ID is missing. Add it under Apps Script > Project Settings > Script Properties."
    );
  }

  WAFFLE_SPREADSHEET_CACHE_ =
    SpreadsheetApp.openById(
      spreadsheetId
    );

  return WAFFLE_SPREADSHEET_CACHE_;
}


/**
 * Always resolve the actual boarding database tab explicitly.
 * This avoids getActiveSheet() accidentally writing to whichever tab happened
 * to be active when the web app ran.
 */
function getTargetSheet_() {
  var properties =
    PropertiesService
      .getScriptProperties();

  // This is the exact worksheet/grid ID already used by the published CSV
  // in index.html (?gid=1639615540). Using the grid ID avoids confusing
  // a Google Sheets TABLE name with the actual worksheet/tab name.
  var configuredGid =
    String(
      properties.getProperty(
        "BOARDING_SHEET_GID"
      ) ||
      "1639615540"
    ).trim();

  var sheetNameFallback =
    String(
      properties.getProperty(
        "BOARDING_SHEET_NAME"
      ) || ""
    ).trim();

  var spreadsheet =
    getWaffleSpreadsheet_();
  var sheet = null;

  // Prefer the immutable sheet/grid ID.
  if (configuredGid && /^\d+$/.test(configuredGid)) {
    sheet = spreadsheet.getSheetById(Number(configuredGid));
  }

  // Optional fallback if you deliberately provide the actual worksheet tab name.
  if (!sheet && sheetNameFallback) {
    sheet = spreadsheet.getSheetByName(sheetNameFallback);
  }

  if (!sheet) {
    var availableSheets = spreadsheet.getSheets().map(function(s) {
      return s.getName() + " (gid=" + s.getSheetId() + ")";
    }).join(", ");

    throw new Error(
      "Could not find the boarding worksheet. Expected gid=" + configuredGid +
      (sheetNameFallback ? ' or tab name "' + sheetNameFallback + '"' : "") +
      ". Available worksheets: " + availableSheets
    );
  }

  return sheet;
}




/* ============================================================
 * WAFFLE HOUSE AUDIT LOG
 * ============================================================
 *
 * Captures:
 *   - boarding bookings created through the web app
 *   - Google Form boarding submissions (after setup trigger is installed)
 *   - Meet & Greet create/update/delete
 *   - Potential Stay create/update/confirm/delete
 *   - manual detail changes made directly in the boarding Google Sheet
 *   - belongings/checklist and care/safety flag changes
 *   - belongings photo add/delete
 *   - dog profile photo add/change
 *
 * Run setupWaffleHouseAuditLog() ONCE after deploying this Code.gs.
 */

var AUDIT_LOG_HEADERS_ = [
  "Timestamp",
  "Event ID",
  "Category",
  "Action",
  "Dog Name",
  "Booking Type",
  "Reference",
  "Summary",
  "Changed Fields",
  "Before JSON",
  "After JSON",
  "Source",
  "Actor"
];


function getAuditLogSheet_() {
  var mainSheet = getTargetSheet_();
  var spreadsheet = mainSheet.getParent();
  var properties = PropertiesService.getScriptProperties();
  var sheetName = String(
    properties.getProperty("AUDIT_SHEET_NAME") || "Audit_Log"
  ).trim();

  var sheet = spreadsheet.getSheetByName(sheetName);
  var created = false;

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    created = true;
  }

  if (sheet.getMaxColumns() < AUDIT_LOG_HEADERS_.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      AUDIT_LOG_HEADERS_.length - sheet.getMaxColumns()
    );
  }

  var needsHeaders = sheet.getLastRow() === 0;

  if (!needsHeaders) {
    var existing = sheet
      .getRange(1, 1, 1, AUDIT_LOG_HEADERS_.length)
      .getValues()[0];

    for (var i = 0; i < AUDIT_LOG_HEADERS_.length; i++) {
      if (String(existing[i] || "") !== AUDIT_LOG_HEADERS_[i]) {
        needsHeaders = true;
        break;
      }
    }
  }

  if (needsHeaders) {
    sheet
      .getRange(1, 1, 1, AUDIT_LOG_HEADERS_.length)
      .setValues([AUDIT_LOG_HEADERS_]);

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, AUDIT_LOG_HEADERS_.length)
      .setFontWeight("bold")
      .setBackground("#1f3a5f")
      .setFontColor("#ffffff");

    sheet.setColumnWidth(1, 165);
    sheet.setColumnWidth(2, 175);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 185);
    sheet.setColumnWidth(5, 140);
    sheet.setColumnWidth(6, 150);
    sheet.setColumnWidth(7, 190);
    sheet.setColumnWidth(8, 320);
    sheet.setColumnWidth(9, 230);
    sheet.setColumnWidth(10, 360);
    sheet.setColumnWidth(11, 360);
    sheet.setColumnWidth(12, 130);
    sheet.setColumnWidth(13, 190);
  }

  if (created) {
    sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm:ss");
  }

  return sheet;
}


function auditSafeJson_(value) {
  if (value === undefined || value === null || value === "") return "";

  var text = "";
  try {
    text = JSON.stringify(value);
  } catch (error) {
    text = String(value);
  }

  // Google Sheets cells have a finite character limit.
  if (text.length > 45000) {
    text = text.substring(0, 44950) + "...[trimmed]";
  }

  return text;
}


function auditActor_(eventUser) {
  var email = "";

  try {
    if (eventUser && typeof eventUser.getEmail === "function") {
      email = String(eventUser.getEmail() || "").trim();
    }
  } catch (_) {}

  if (!email) {
    try {
      email = String(Session.getActiveUser().getEmail() || "").trim();
    } catch (_) {}
  }

  return email || "Web App / Unavailable";
}


function auditEventId_() {
  return Utilities.getUuid();
}


function logAuditEvent_(entry) {
  entry = entry && typeof entry === "object" ? entry : {};

  try {
    var sheet = getAuditLogSheet_();

    sheet.appendRow([
      new Date(),
      String(entry.eventId || auditEventId_()),
      String(entry.category || "System"),
      String(entry.action || "Changed"),
      String(entry.dogName || ""),
      String(entry.bookingType || ""),
      String(entry.reference || ""),
      String(entry.summary || ""),
      Array.isArray(entry.changedFields)
        ? entry.changedFields.join(", ")
        : String(entry.changedFields || ""),
      auditSafeJson_(entry.before),
      auditSafeJson_(entry.after),
      String(entry.source || "Web App"),
      String(entry.actor || auditActor_(entry.eventUser))
    ]);

    touchWaffleDataVersion_(
      "audit"
    );

    return true;
  } catch (error) {
    // An audit failure must never block the operational action itself.
    console.error("Audit log write failed:", error);
    return false;
  }
}


function auditDateValue_(value) {
  if (!value) return "";

  if (value instanceof Date && !isNaN(value.getTime())) {
    var timezone = getTargetSheet_().getParent().getSpreadsheetTimeZone();
    return Utilities.formatDate(value, timezone, "yyyy-MM-dd");
  }

  return normalizeDateValue_(value);
}


function auditBookingSnapshotFromValues_(row) {
  row = Array.isArray(row) ? row : [];

  return {
    dogName: String(row[1] || ""),
    breed: String(row[2] || ""),
    startDate: auditDateValue_(row[3]),
    endDate: auditDateValue_(row[4]),
    ownerName: String(row[5] || ""),
    phone: String(row[6] || ""),
    likes: String(row[7] || ""),
    dislikes: String(row[8] || ""),
    notes: String(row[9] || ""),
    editLink: String(row[10] || ""),
    bookingType: String(row[11] || "Boarding")
  };
}


function auditBookingSnapshotFromSheetRow_(sheet, rowNumber) {
  if (!sheet || !rowNumber || rowNumber < 2) return null;

  return auditBookingSnapshotFromValues_(
    sheet.getRange(rowNumber, 1, 1, 12).getValues()[0]
  );
}


function auditObjectChangedFields_(before, after, fieldLabels) {
  before = before && typeof before === "object" ? before : {};
  after = after && typeof after === "object" ? after : {};
  fieldLabels = fieldLabels && typeof fieldLabels === "object"
    ? fieldLabels
    : {};

  var keys = {};
  Object.keys(before).forEach(function(key) { keys[key] = true; });
  Object.keys(after).forEach(function(key) { keys[key] = true; });

  var changes = [];

  Object.keys(keys).forEach(function(key) {
    var oldValue = auditSafeJson_(before[key]);
    var newValue = auditSafeJson_(after[key]);

    if (oldValue !== newValue) {
      changes.push(fieldLabels[key] || key);
    }
  });

  return changes;
}



function auditMeetGreetScheduleText_(snapshot) {
  snapshot =
    snapshot &&
    typeof snapshot === "object"
      ? snapshot
      : {};

  var dateValue =
    String(snapshot.startDate || "").trim();

  var notes =
    String(snapshot.notes || "");

  var timeMatch =
    notes.match(/(\d{1,2}:\d{2})/);

  var dateLabel = "";

  if (dateValue) {
    try {
      var date =
        new Date(
          dateValue + "T00:00:00"
        );

      if (!isNaN(date.getTime())) {
        dateLabel =
          Utilities.formatDate(
            date,
            getTargetSheet_()
              .getParent()
              .getSpreadsheetTimeZone(),
            "d MMM yyyy"
          );
      }
    } catch (_) {
      dateLabel = dateValue;
    }
  }

  var timeLabel =
    timeMatch
      ? timeMatch[1]
      : "";

  if (
    dateLabel &&
    timeLabel
  ) {
    return (
      dateLabel +
      " at " +
      timeLabel
    );
  }

  return dateLabel || timeLabel;
}


function auditBookingCategory_(bookingType) {
  var type = String(bookingType || "").trim().toLowerCase();

  if (type === "meet & greet") return "Meet & Greet";
  if (type === "potential stay") return "Potential Stay";
  return "Boarding";
}


function auditBookingFieldLabels_() {
  return {
    dogName: "Dog Name",
    breed: "Breed",
    startDate: "Start Date",
    endDate: "End Date",
    ownerName: "Owner",
    phone: "Contact Number",
    notes: "Notes",
    editLink: "Edit Link",
    bookingType: "Booking Type"
  };
}


function auditBelongingsSnapshotFromRow_(sheet, rowNumber) {
  if (!sheet || !rowNumber || rowNumber < 2) return null;

  var values = sheet.getRange(rowNumber, 1, 1, getBelongingsHeaders_().length).getValues()[0];
  var items = {};
  var offset = 5;

  BELONGINGS_ITEM_CONFIG_.forEach(function(item) {
    items[item.key] = {
      present:
        values[offset] === true ||
        String(values[offset]).toLowerCase() === "true",
      description: String(values[offset + 1] || "")
    };
    offset += 2;
  });

  var riskFlags = {};
  BELONGINGS_RISK_CONFIG_.forEach(function(flag, index) {
    var value = values[24 + index];
    riskFlags[flag.key] =
      value === true ||
      String(value).toLowerCase() === "true";
  });

  var photos = parsePhotosJson_(values[23]).map(function(photo) {
    return {
      id: String(photo.id || ""),
      name: String(photo.name || ""),
      label: String(photo.label || ""),
      url: String(photo.url || "")
    };
  });

  var dogPhoto = parseDogPhotoJson_(values[29]);

  return {
    stayKey: String(values[1] || ""),
    dogName: String(values[2] || ""),
    startDate: auditDateValue_(values[3]),
    endDate: auditDateValue_(values[4]),
    items: items,
    riskFlags: riskFlags,
    photoCount: photos.length,
    photoIds: photos.map(function(photo) { return photo.id; }),
    intakeAttributes:
      parseIntakeAttributesJson_(
        values[30]
      ),
    dogPhoto: dogPhoto
      ? {
          id: String(dogPhoto.id || ""),
          name: String(dogPhoto.name || ""),
          label: String(dogPhoto.label || ""),
          url: String(dogPhoto.url || "")
        }
      : null
  };
}


function auditBelongingsChangedFields_(before, after) {
  if (!before && after) return ["Belongings record created"];
  if (!before || !after) return ["Belongings"];

  var changes = [];

  BELONGINGS_ITEM_CONFIG_.forEach(function(item) {
    var oldItem = before.items && before.items[item.key]
      ? before.items[item.key]
      : { present: false, description: "" };

    var newItem = after.items && after.items[item.key]
      ? after.items[item.key]
      : { present: false, description: "" };

    if (
      oldItem.present !== newItem.present ||
      String(oldItem.description || "") !== String(newItem.description || "")
    ) {
      changes.push(item.label);
    }
  });

  BELONGINGS_RISK_CONFIG_.forEach(function(flag) {
    var oldFlag = !!(before.riskFlags && before.riskFlags[flag.key]);
    var newFlag = !!(after.riskFlags && after.riskFlags[flag.key]);

    if (oldFlag !== newFlag) {
      changes.push(flag.label);
    }
  });

  var oldProfile =
    before.intakeAttributes || {};

  var newProfile =
    after.intakeAttributes || {};

  INTAKE_ATTRIBUTE_CONFIG_
    .forEach(function(field) {
      if (
        String(
          oldProfile[
            field.key
          ] || ""
        ) !==
        String(
          newProfile[
            field.key
          ] || ""
        )
      ) {
        changes.push(
          field.label
        );
      }
    });

  return changes;
}


function readAuditLogRecords_(limit) {
  var sheet = getAuditLogSheet_();
  var lastRow = sheet.getLastRow();
  var requestedLimit = Math.min(Math.max(Number(limit || 300), 1), 1000);

  if (lastRow < 2) return [];

  var count = Math.min(requestedLimit, lastRow - 1);
  var startRow = lastRow - count + 1;
  var rows = sheet
    .getRange(startRow, 1, count, AUDIT_LOG_HEADERS_.length)
    .getValues();

  rows.reverse();

  return rows.map(function(row) {
    return {
      timestamp:
        row[0] instanceof Date
          ? row[0].toISOString()
          : String(row[0] || ""),
      eventId: String(row[1] || ""),
      category: String(row[2] || ""),
      action: String(row[3] || ""),
      dogName: String(row[4] || ""),
      bookingType: String(row[5] || ""),
      reference: String(row[6] || ""),
      summary: String(row[7] || ""),
      changedFields: String(row[8] || ""),
      beforeJson: String(row[9] || ""),
      afterJson: String(row[10] || ""),
      source: String(row[11] || ""),
      actor: String(row[12] || "")
    };
  });
}


function setupWaffleHouseAuditLog() {
  var mainSheet = getTargetSheet_();
  var spreadsheet = mainSheet.getParent();
  var auditSheet = getAuditLogSheet_();

  var handlers = {
    waffleAuditOnEdit: true,
    waffleAuditOnFormSubmit: true
  };

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers[trigger.getHandlerFunction()]) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  var editTrigger = ScriptApp
    .newTrigger("waffleAuditOnEdit")
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  var formTrigger = ScriptApp
    .newTrigger("waffleAuditOnFormSubmit")
    .forSpreadsheet(spreadsheet)
    .onFormSubmit()
    .create();

  logAuditEvent_({
    category: "System",
    action: "Audit Log Enabled",
    summary:
      "Audit logging enabled for Web App actions, direct Sheet edits and Google Form submissions.",
    source: "Apps Script Setup"
  });

  return {
    result: "success",
    auditSheet: auditSheet.getName(),
    editTriggerId: editTrigger.getUniqueId(),
    formSubmitTriggerId: formTrigger.getUniqueId(),
    message: "Audit log is enabled."
  };
}


function verifyWaffleHouseAuditLog() {
  var auditSheet = getAuditLogSheet_();

  var triggers = ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return (
        trigger.getHandlerFunction() === "waffleAuditOnEdit" ||
        trigger.getHandlerFunction() === "waffleAuditOnFormSubmit"
      );
    })
    .map(function(trigger) {
      return {
        handler: trigger.getHandlerFunction(),
        eventType: String(trigger.getEventType()),
        uniqueId: trigger.getUniqueId()
      };
    });

  return {
    result: "success",
    auditSheet: auditSheet.getName(),
    auditRows: Math.max(0, auditSheet.getLastRow() - 1),
    editTriggerInstalled: triggers.some(function(item) {
      return item.handler === "waffleAuditOnEdit";
    }),
    formSubmitTriggerInstalled: triggers.some(function(item) {
      return item.handler === "waffleAuditOnFormSubmit";
    }),
    triggers: triggers
  };
}


function waffleAuditOnFormSubmit(e) {
  try {
    if (!e || !e.range) return;

    var mainSheet = getTargetSheet_();
    var eventSheet = e.range.getSheet();

    if (eventSheet.getSheetId() !== mainSheet.getSheetId()) return;
    if (e.range.getRow() < 2) return;

    var snapshot = auditBookingSnapshotFromSheetRow_(
      mainSheet,
      e.range.getRow()
    );

    if (!snapshot) return;

    var category = auditBookingCategory_(snapshot.bookingType);

    touchWaffleDataVersion_(
      "directory"
    );

    logAuditEvent_({
      category: category,
      action:
        category === "Boarding"
          ? "Booking Created"
          : category + " Created",
      dogName: snapshot.dogName,
      bookingType: snapshot.bookingType || "Boarding",
      reference: mainSheet.getName() + "!A" + e.range.getRow(),
      summary:
        (snapshot.dogName || "Booking") +
        " submitted through Google Form.",
      changedFields: ["New record"],
      after: snapshot,
      source: "Google Form",
      eventUser: e.user
    });
  } catch (error) {
    console.error("Form-submit audit failed:", error);
  }
}


function waffleAuditOnEdit(e) {
  try {
    if (!e || !e.range) return;

    var range = e.range;
    var sheet = range.getSheet();
    var spreadsheet = sheet.getParent();
    var auditSheetName = getAuditLogSheet_().getName();

    if (sheet.getName() === auditSheetName) return;
    if (range.getRow() < 2) return;

    var mainSheet = getTargetSheet_();

    var scriptProperties =
      PropertiesService.getScriptProperties();

    var belongingsName = String(
      scriptProperties
        .getProperty("BELONGINGS_SHEET_NAME") || "Pet_Belongings"
    ).trim();

    var remindersName = String(
      scriptProperties
        .getProperty("REMINDERS_NOTES_SHEET_NAME") || "Reminders_Notes"
    ).trim();

    var intakeName = String(
      scriptProperties
        .getProperty("INTAKE_SHEET_NAME") || "Dog_Intake_Records"
    ).trim();

    var legacyIntakeName = String(
      scriptProperties
        .getProperty("LEGACY_INTAKE_SHEET_NAME") || "Legacy_Intake_Documents"
    ).trim();

    if (sheet.getName() === remindersName) {
      touchWaffleDataVersion_(
        "reminders"
      );
    }

    if (
      sheet.getName() === intakeName ||
      sheet.getName() === legacyIntakeName
    ) {
      touchWaffleDataVersion_(
        "directory"
      );
    }

    var fieldNames = sheet
      .getRange(
        1,
        range.getColumn(),
        1,
        range.getNumColumns()
      )
      .getDisplayValues()[0]
      .map(function(value) {
        return String(value || "").trim();
      })
      .filter(function(value) {
        return !!value;
      });

    var afterValue = range.getDisplayValues();
    var beforeValue =
      range.getNumRows() === 1 &&
      range.getNumColumns() === 1 &&
      Object.prototype.hasOwnProperty.call(e, "oldValue")
        ? e.oldValue
        : "";

    if (sheet.getSheetId() === mainSheet.getSheetId()) {
      var booking = auditBookingSnapshotFromSheetRow_(
        mainSheet,
        range.getRow()
      );

      if (!booking) return;

      var category = auditBookingCategory_(booking.bookingType);

      touchWaffleDataVersion_(
        "directory"
      );

      logAuditEvent_({
        category: category,
        action: "Detail Changed",
        dogName: booking.dogName,
        bookingType: booking.bookingType || "Boarding",
        reference: sheet.getName() + "!" + range.getA1Notation(),
        summary:
          (fieldNames.join(", ") || "Booking detail") +
          " changed for " +
          (booking.dogName || "booking") +
          ".",
        changedFields: fieldNames,
        before: { value: beforeValue },
        after: { value: afterValue },
        source: "Google Sheet Edit",
        eventUser: e.user
      });

      return;
    }

    if (sheet.getName() === belongingsName) {
      touchWaffleDataVersion_(
        "directory"
      );

      var dogName = String(
        sheet.getRange(range.getRow(), 3).getDisplayValue() || ""
      ).trim();

      var stayKey = String(
        sheet.getRange(range.getRow(), 2).getDisplayValue() || ""
      ).trim();

      logAuditEvent_({
        category: "Belongings",
        action: "Belongings Changed",
        dogName: dogName,
        bookingType: "Boarding",
        reference: stayKey || (sheet.getName() + "!" + range.getA1Notation()),
        summary:
          (fieldNames.join(", ") || "Belongings detail") +
          " changed directly in Google Sheets.",
        changedFields: fieldNames,
        before: { value: beforeValue },
        after: { value: afterValue },
        source: "Google Sheet Edit",
        eventUser: e.user
      });
    }
  } catch (error) {
    console.error("Sheet-edit audit failed:", error);
  }
}


var INTAKE_LOGO_BASE64_ = "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";


/* ============================================================
 * WAFFLE BOARDING HOUSE — DIGITAL INTAKE
 * ============================================================
 *
 * No paid AI/API integration is used.
 *
 * The owner receives a tokenised public intake URL. Submitted
 * structured answers are saved to Dog_Intake_Records, mapped to
 * the boarding database and Care & Safety flags, and rendered to
 * a signed PDF stored privately in Google Drive.
 *
 * Optional Script Properties:
 *   INTAKE_SHEET_NAME  = Dog_Intake_Records
 *   INTAKE_FOLDER_ID   = Google Drive folder for signed intake PDFs
 */


function buildDigitalIntakeHtml_(params) {
  params = params && typeof params === "object" ? params : {};

  var template = HtmlService.createTemplateFromFile("Intake");
  template.intakeToken = String(params.token || "").trim();

  return template
    .evaluate()
    .setTitle("Waffle Boarding House — Dog Sitting Intake")
    .addMetaTag(
      "viewport",
      "width=device-width, initial-scale=1, viewport-fit=cover"
    );
}


/**
 * Public wrapper for the Apps Script-hosted Intake.html page.
 * google.script.run cannot call private helper names ending in "_".
 */
function getIntakePrefillForHtml(token) {
  return getIntakePrefill_(String(token || "").trim());
}


/**
 * Public wrapper for the Apps Script-hosted Intake.html page.
 *
 * This intentionally bypasses doPost. The submitted JavaScript object and
 * signature image are sent through google.script.run on the same Apps Script
 * origin, which avoids the form-urlencoded/JSON parsing path entirely.
 */
function submitIntakeFromHtml(payload) {
  assertWaffleActionAllowedDuringMaintenance_("submitIntakeFromHtml");

  payload = payload && typeof payload === "object" ? payload : {};

  return processIntakeSubmission_({
    action: "submit_intake",
    token: String(payload.token || "").trim(),
    answers:
      payload.answers && typeof payload.answers === "object"
        ? payload.answers
        : {},
    signatureData: String(payload.signatureData || "")
  });
}


function getHostedIntakeBaseUrl_() {
  var serviceUrl = "";

  try {
    serviceUrl = String(
      ScriptApp.getService().getUrl() || ""
    ).trim();
  } catch (_) {}

  return serviceUrl.replace(/[?#].*$/, "");
}




/* ============================================================
 * WAFFLE BOARDING HOUSE — LEGACY INTAKE PDF LIBRARY
 * ============================================================
 *
 * No AI or separately billed service is used.
 *
 * The browser uses PDF.js to extract any selectable text from an
 * uploaded PDF. Matching is deterministic and happens locally in
 * the admin browser using Dog Name / Owner / Mobile / Breed.
 * Scanned/image-only PDFs simply fall back to manual assignment.
 *
 * The PDF itself is stored privately in the existing Intake Drive
 * folder and associated with a specific boarding stay.
 */

var LEGACY_INTAKE_HEADERS_ = [
  "Uploaded At",
  "Updated At",
  "Document ID",
  "Stay Key",
  "Dog Name",
  "Breed",
  "Start Date",
  "End Date",
  "Owner Name",
  "Mobile",
  "PDF File ID",
  "PDF URL",
  "Original Filename",
  "Match Score",
  "Match Basis",
  "Booking Row",
  "Extraction Method",
  "Extracted Text",
  "Parsed Fields JSON",
  "Applied Fields JSON",
  "Review Conflicts JSON",
  "AI Status"
];

var GEMINI_LEGACY_INTAKE_MODEL_DEFAULT_ =
  "gemini-3.6-flash";


function getLegacyIntakeSheet_() {
  var mainSheet = getTargetSheet_();
  var spreadsheet = mainSheet.getParent();
  var properties = PropertiesService.getScriptProperties();

  var sheetName = String(
    properties.getProperty("LEGACY_INTAKE_SHEET_NAME") ||
    "Legacy_Intake_Documents"
  ).trim();

  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getMaxColumns() < LEGACY_INTAKE_HEADERS_.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      LEGACY_INTAKE_HEADERS_.length - sheet.getMaxColumns()
    );
  }

  var needsHeaders = sheet.getLastRow() === 0;

  if (!needsHeaders) {
    var existing = sheet
      .getRange(1, 1, 1, LEGACY_INTAKE_HEADERS_.length)
      .getValues()[0];

    for (var i = 0; i < LEGACY_INTAKE_HEADERS_.length; i++) {
      if (
        String(existing[i] || "") !==
        LEGACY_INTAKE_HEADERS_[i]
      ) {
        needsHeaders = true;
        break;
      }
    }
  }

  if (needsHeaders) {
    sheet
      .getRange(1, 1, 1, LEGACY_INTAKE_HEADERS_.length)
      .setValues([LEGACY_INTAKE_HEADERS_]);

    sheet.setFrozenRows(1);

    sheet
      .getRange(1, 1, 1, LEGACY_INTAKE_HEADERS_.length)
      .setFontWeight("bold")
      .setBackground("#0d3550")
      .setFontColor("#ffffff");

    [
      155, 155, 250, 250, 140, 140, 110, 110,
      155, 140, 220, 300, 260, 95, 300, 95,
      165, 420, 420, 420, 420, 140
    ].forEach(function(width, index) {
      sheet.setColumnWidth(index + 1, width);
    });
  }

  return sheet;
}


function legacyIntakeRowToObject_(row, rowNumber) {
  row = Array.isArray(row) ? row : [];

  return {
    row: rowNumber || null,
    uploadedAt:
      row[0] instanceof Date
        ? row[0].toISOString()
        : String(row[0] || ""),
    updatedAt:
      row[1] instanceof Date
        ? row[1].toISOString()
        : String(row[1] || ""),
    documentId: String(row[2] || ""),
    stayKey: String(row[3] || ""),
    dogName: String(row[4] || ""),
    breed: String(row[5] || ""),
    startDate: normalizeDateValue_(row[6]),
    endDate: normalizeDateValue_(row[7]),
    ownerName: String(row[8] || ""),
    mobile: String(row[9] || ""),
    pdfFileId: String(row[10] || ""),
    pdfUrl: String(row[11] || ""),
    originalFilename: String(row[12] || ""),
    matchScore: Number(row[13] || 0) || 0,
    matchBasis: String(row[14] || ""),
    bookingRow: Number(row[15] || 0) || null,
    extractionMethod: String(row[16] || ""),
    ocrMethod: String(row[16] || ""),
    extractedText: String(row[17] || ""),
    parsedFields: parseLegacyJsonObject_(row[18]),
    appliedFields: parseLegacyJsonObject_(row[19]),
    reviewConflicts: parseLegacyJsonArray_(row[20]),
    aiStatus: String(row[21] || "")
  };
}


function parseLegacyJsonArray_(value) {
  if (!value) return [];

  try {
    var parsed =
      typeof value === "string"
        ? JSON.parse(value)
        : value;

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch (_) {
    return [];
  }
}


function parseLegacyJsonObject_(value) {
  if (!value) return {};

  try {
    var parsed =
      typeof value === "string"
        ? JSON.parse(value)
        : value;

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch (_) {
    return {};
  }
}


function findLegacyIntakeDocumentById_(sheet, documentId) {
  documentId = String(documentId || "").trim();

  if (!documentId || sheet.getLastRow() < 2) {
    return null;
  }

  var values = sheet
    .getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      LEGACY_INTAKE_HEADERS_.length
    )
    .getValues();

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][2] || "").trim() === documentId) {
      return legacyIntakeRowToObject_(
        values[i],
        i + 2
      );
    }
  }

  return null;
}


function findBookingByStayKey_(rows, stayKey) {
  stayKey = String(stayKey || "").trim();

  if (!stayKey) return null;

  for (var i = 1; i < rows.length; i++) {
    var bookingType = String(rows[i][11] || "")
      .trim()
      .toLowerCase();

    if (bookingType === "meet & greet") continue;

    var dogName = String(rows[i][1] || "").trim();
    var startDate = normalizeDateValue_(rows[i][3]);
    var endDate = normalizeDateValue_(
      rows[i][4] || rows[i][3]
    );

    if (!dogName || !startDate || !endDate) continue;

    var rowStayKey = makeGuestStayKey_(
      dogName,
      startDate,
      endDate
    );

    if (rowStayKey !== stayKey) continue;

    return {
      row: i + 1,
      record: auditBookingSnapshotFromSheetRow_(
        getTargetSheet_(),
        i + 1
      ),
      stayKey: rowStayKey
    };
  }

  return null;
}


function getLegacyBookingCandidates_() {
  var sheet = getTargetSheet_();
  var rows = sheet.getDataRange().getValues();

  if (rows.length < 2) return [];

  var todayStr = Utilities.formatDate(
    new Date(),
    sheet.getParent().getSpreadsheetTimeZone(),
    "yyyy-MM-dd"
  );

  var seen = {};
  var candidates = [];

  for (var i = 1; i < rows.length; i++) {
    var dogName = String(rows[i][1] || "").trim();
    var breed = String(rows[i][2] || "").trim();
    var startDate = normalizeDateValue_(rows[i][3]);
    var endDate = normalizeDateValue_(
      rows[i][4] || rows[i][3]
    );
    var ownerName = String(rows[i][5] || "").trim();
    var mobile = String(rows[i][6] || "").trim();
    var bookingType = String(rows[i][11] || "").trim();

    if (
      !dogName ||
      !startDate ||
      !endDate ||
      bookingType.toLowerCase() === "meet & greet"
    ) {
      continue;
    }

    var stayKey = makeGuestStayKey_(
      dogName,
      startDate,
      endDate
    );

    if (seen[stayKey]) continue;
    seen[stayKey] = true;

    candidates.push({
      stayKey: stayKey,
      bookingRow: i + 1,
      dogName: dogName,
      breed: breed,
      ownerName: ownerName,
      mobile: mobile,
      startDate: startDate,
      endDate: endDate,
      bookingType: bookingType || "Boarding",
      isCurrentOrUpcoming: endDate >= todayStr
    });
  }

  candidates.sort(function(a, b) {
    if (a.isCurrentOrUpcoming !== b.isCurrentOrUpcoming) {
      return a.isCurrentOrUpcoming ? -1 : 1;
    }

    return String(b.startDate || "")
      .localeCompare(String(a.startDate || ""));
  });

  return candidates.slice(0, 500);
}


function getLegacyIntakeStatusRecords_(stayKeys) {
  var requestedKeys =
    (Array.isArray(stayKeys)
      ? stayKeys
      : [])
      .map(function(key) {
        return String(key || "").trim();
      })
      .filter(Boolean);

  var requested = {};

  requestedKeys.forEach(function(key) {
    requested[key] = true;
  });

  var legacySheet =
    getLegacyIntakeSheet_();

  if (legacySheet.getLastRow() < 2) {
    return [];
  }

  var values =
    legacySheet
      .getRange(
        2,
        1,
        legacySheet.getLastRow() - 1,
        LEGACY_INTAKE_HEADERS_.length
      )
      .getValues();

  var mainSheet =
    getTargetSheet_();

  var mainLastRow =
    mainSheet.getLastRow();

  var mainValues =
    mainLastRow >= 2
      ? mainSheet
          .getRange(
            1,
            1,
            mainLastRow,
            12
          )
          .getValues()
      : [];

  /*
   * Build the current Guest Directory identities for the exact stay keys
   * requested by the browser. This lets old Legacy_Intake_Documents rows
   * recover even when their stored Stay Key became stale after a rename,
   * date edit, migration, or older app version.
   */
  var targets = [];

  for (
    var rowIndex = 1;
    rowIndex < mainValues.length;
    rowIndex++
  ) {
    var mainRow =
      mainValues[rowIndex];

    var bookingType =
      String(
        mainRow[11] || ""
      )
        .trim()
        .toLowerCase();

    if (
      bookingType === "meet & greet" ||
      bookingType === "potential stay"
    ) {
      continue;
    }

    var dogName =
      String(
        mainRow[1] || ""
      ).trim();

    var startDate =
      normalizeDateValue_(
        mainRow[3]
      );

    var endDate =
      normalizeDateValue_(
        mainRow[4] ||
        mainRow[3]
      );

    if (
      !dogName ||
      !startDate ||
      !endDate
    ) {
      continue;
    }

    var currentStayKey =
      makeGuestStayKey_(
        dogName,
        startDate,
        endDate
      );

    if (
      requestedKeys.length &&
      !requested[
        currentStayKey
      ]
    ) {
      continue;
    }

    targets.push({
      stayKey:
        currentStayKey,
      bookingRow:
        rowIndex + 1,
      dogName:
        dogName,
      breed:
        String(
          mainRow[2] || ""
        ).trim(),
      startDate:
        startDate,
      endDate:
        endDate,
      ownerName:
        String(
          mainRow[5] || ""
        ).trim(),
      mobile:
        String(
          mainRow[6] || ""
        ).trim()
    });
  }

  function normalizeIdentityText(value) {
    return String(
      value || ""
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function phoneTail(value) {
    var digits =
      String(
        value || ""
      ).replace(
        /\D/g,
        ""
      );

    return digits
      ? digits.slice(-8)
      : "";
  }

  function sameText(a, b) {
    var left =
      normalizeIdentityText(a);

    var right =
      normalizeIdentityText(b);

    return (
      !!left &&
      !!right &&
      left === right
    );
  }

  function samePhone(a, b) {
    var left =
      phoneTail(a);

    var right =
      phoneTail(b);

    return (
      !!left &&
      !!right &&
      left === right
    );
  }

  function dateRangesOverlap(
    aStart,
    aEnd,
    bStart,
    bEnd
  ) {
    if (
      !aStart ||
      !aEnd ||
      !bStart ||
      !bEnd
    ) {
      return false;
    }

    return (
      aStart <= bEnd &&
      bStart <= aEnd
    );
  }

  function scoreRecordAgainstTarget(
    record,
    target
  ) {
    var score = 0;
    var reasons = [];

    if (
      Number(record.bookingRow || 0) ===
      Number(target.bookingRow || 0)
    ) {
      score += 120;
      reasons.push(
        "booking row"
      );
    }

    if (
      sameText(
        record.dogName,
        target.dogName
      )
    ) {
      score += 50;
      reasons.push(
        "dog"
      );
    }

    if (
      record.startDate &&
      record.endDate &&
      record.startDate ===
        target.startDate &&
      record.endDate ===
        target.endDate
    ) {
      score += 70;
      reasons.push(
        "dates"
      );

    } else {
      if (
        record.startDate &&
        record.startDate ===
          target.startDate
      ) {
        score += 20;
        reasons.push(
          "start date"
        );
      }

      if (
        record.endDate &&
        record.endDate ===
          target.endDate
      ) {
        score += 20;
        reasons.push(
          "end date"
        );
      }

      if (
        dateRangesOverlap(
          record.startDate,
          record.endDate,
          target.startDate,
          target.endDate
        )
      ) {
        score += 10;
        reasons.push(
          "date overlap"
        );
      }
    }

    if (
      sameText(
        record.ownerName,
        target.ownerName
      )
    ) {
      score += 25;
      reasons.push(
        "owner"
      );
    }

    if (
      samePhone(
        record.mobile,
        target.mobile
      )
    ) {
      score += 25;
      reasons.push(
        "mobile"
      );
    }

    if (
      sameText(
        record.breed,
        target.breed
      )
    ) {
      score += 10;
      reasons.push(
        "breed"
      );
    }

    return {
      score:
        score,
      reasons:
        reasons
    };
  }

  function resolveCurrentStayKey(
    record
  ) {
    /*
     * Fast paths first: exact stored key, rebuilt current-looking key,
     * or the booking row that was stored with the legacy document.
     */
    var directKeys = [];

    function addDirectKey(key) {
      key =
        String(
          key || ""
        ).trim();

      if (
        key &&
        directKeys.indexOf(
          key
        ) === -1
      ) {
        directKeys.push(
          key
        );
      }
    }

    addDirectKey(
      record.stayKey
    );

    if (
      record.dogName &&
      record.startDate &&
      record.endDate
    ) {
      addDirectKey(
        makeGuestStayKey_(
          record.dogName,
          record.startDate,
          record.endDate
        )
      );
    }

    if (requestedKeys.length) {
      for (
        var directIndex = 0;
        directIndex <
          directKeys.length;
        directIndex++
      ) {
        if (
          requested[
            directKeys[
              directIndex
            ]
          ]
        ) {
          return {
            stayKey:
              directKeys[
                directIndex
              ],
            score:
              999,
            basis:
              "Exact stay key"
          };
        }
      }

      for (
        var targetIndex = 0;
        targetIndex <
          targets.length;
        targetIndex++
      ) {
        if (
          Number(
            record.bookingRow || 0
          ) ===
          Number(
            targets[
              targetIndex
            ].bookingRow || 0
          )
        ) {
          return {
            stayKey:
              targets[
                targetIndex
              ].stayKey,
            score:
              998,
            basis:
              "Booking row"
          };
        }
      }

      /*
       * Recovery path: compare the stored Legacy Intake identity with
       * the currently visible/current Guest Directory bookings.
       *
       * We only accept a unique, strong match. This prevents a recurring
       * guest with multiple stays from being silently attached to the
       * wrong booking.
       */
      var scored =
        targets
          .map(function(target) {
            var result =
              scoreRecordAgainstTarget(
                record,
                target
              );

            return {
              stayKey:
                target.stayKey,
              score:
                result.score,
              basis:
                result.reasons
                  .join(", ")
            };
          })
          .sort(function(a, b) {
            return (
              b.score -
              a.score
            );
          });

      if (!scored.length) {
        return null;
      }

      var best =
        scored[0];

      var runnerUp =
        scored.length > 1
          ? scored[1]
          : null;

      var uniqueEnough =
        !runnerUp ||
        best.score >
          runnerUp.score;

      if (
        best.score >= 70 &&
        uniqueEnough
      ) {
        return best;
      }

      return null;
    }

    return {
      stayKey:
        directKeys[0] ||
        "",
      score:
        0,
      basis:
        "Stored identity"
    };
  }

  var grouped = {};

  values.forEach(
    function(row, index) {
      var record =
        legacyIntakeRowToObject_(
          row,
          index + 2
        );

      /*
       * A Drive file ID or Drive URL is enough to count the document as
       * uploaded. AI success is NOT required for Guest Directory status.
       */
      if (
        !record.pdfFileId &&
        !record.pdfUrl
      ) {
        return;
      }

      var resolution =
        resolveCurrentStayKey(
          record
        );

      if (
        !resolution ||
        !resolution.stayKey
      ) {
        return;
      }

      var resolvedKey =
        resolution.stayKey;

      if (
        requestedKeys.length &&
        !requested[
          resolvedKey
        ]
      ) {
        return;
      }

      if (
        !grouped[
          resolvedKey
        ]
      ) {
        grouped[
          resolvedKey
        ] = [];
      }

      record.directoryMatchScore =
        resolution.score;

      record.directoryMatchBasis =
        resolution.basis;

      grouped[
        resolvedKey
      ].push(
        record
      );
    }
  );

  return Object.keys(
    grouped
  ).map(
    function(stayKey) {
      var records =
        grouped[
          stayKey
        ];

      records.sort(
        function(a, b) {
          return String(
            b.uploadedAt ||
            b.updatedAt ||
            ""
          ).localeCompare(
            String(
              a.uploadedAt ||
              a.updatedAt ||
              ""
            )
          );
        }
      );

      var latest =
        records[0];

      return {
        stayKey:
          stayKey,
        count:
          records.length,
        latest: {
          documentId:
            latest.documentId,
          uploadedAt:
            latest.uploadedAt,
          updatedAt:
            latest.updatedAt,
          dogName:
            latest.dogName,
          pdfUrl:
            latest.pdfUrl,
          originalFilename:
            latest.originalFilename,
          matchScore:
            latest.matchScore,
          matchBasis:
            latest.matchBasis,
          directoryMatchScore:
            latest.directoryMatchScore,
          directoryMatchBasis:
            latest.directoryMatchBasis,
          extractionMethod:
            latest.extractionMethod,
          aiStatus:
            latest.aiStatus,
          conflictCount:
            Array.isArray(
              latest.reviewConflicts
            )
              ? latest.reviewConflicts.length
              : 0
        }
      };
    }
  );
}



function verifyWaffleHouseLegacyDirectoryStatus() {
  var candidates =
    getLegacyBookingCandidates_();

  var stayKeys =
    candidates
      .filter(function(candidate) {
        return (
          candidate &&
          candidate.stayKey
        );
      })
      .map(function(candidate) {
        return candidate.stayKey;
      });

  var statuses =
    getLegacyIntakeStatusRecords_(
      stayKeys
    );

  var sheet =
    getLegacyIntakeSheet_();

  return {
    result:
      "success",
    legacyDocumentRows:
      Math.max(
        0,
        sheet.getLastRow() - 1
      ),
    currentBoardingCandidates:
      stayKeys.length,
    matchedCurrentStays:
      statuses.length,
    statuses:
      statuses
  };
}


function buildLegacyIntakeHtml_(params) {
  params = params && typeof params === "object"
    ? params
    : {};

  var template =
    HtmlService.createTemplateFromFile(
      "LegacyIntake"
    );

  template.initialStayKey =
    String(params.stayKey || "").trim();

  template.initialDocumentId =
    String(params.documentId || "").trim();

  return template
    .evaluate()
    .setTitle(
      "Waffle Boarding House — Legacy Intake PDF"
    )
    .addMetaTag(
      "viewport",
      "width=device-width, initial-scale=1, viewport-fit=cover"
    );
}


function getLegacyIntakeContextForHtml(params) {
  params = params && typeof params === "object"
    ? params
    : {};

  var documentId =
    String(params.documentId || "").trim();

  var legacySheet = getLegacyIntakeSheet_();

  var documentRecord = documentId
    ? findLegacyIntakeDocumentById_(
        legacySheet,
        documentId
      )
    : null;

  if (documentId && !documentRecord) {
    throw new Error(
      "The legacy intake document could not be found."
    );
  }

  return {
    candidates: getLegacyBookingCandidates_(),
    document:
      documentRecord
        ? {
            documentId:
              documentRecord.documentId,
            stayKey:
              documentRecord.stayKey,
            dogName:
              documentRecord.dogName,
            breed:
              documentRecord.breed,
            startDate:
              documentRecord.startDate,
            endDate:
              documentRecord.endDate,
            ownerName:
              documentRecord.ownerName,
            mobile:
              documentRecord.mobile,
            pdfUrl:
              documentRecord.pdfUrl,
            originalFilename:
              documentRecord.originalFilename,
            extractionMethod:
              documentRecord.extractionMethod,
            ocrMethod:
              documentRecord.ocrMethod,
            parsedFields:
              documentRecord.parsedFields,
            appliedFields:
              documentRecord.appliedFields,
            reviewConflicts:
              documentRecord.reviewConflicts,
            aiStatus:
              documentRecord.aiStatus
          }
        : null,
    initialStayKey:
      String(params.stayKey || "").trim()
  };
}


function decodeLegacyPdfData_(fileData, fileName) {
  var match = String(fileData || "").match(
    /^data:application\/pdf;base64,(.+)$/i
  );

  if (!match) {
    throw new Error(
      "Please upload a valid PDF file."
    );
  }

  var bytes = Utilities.base64Decode(match[1]);

  // Guard against unexpectedly large uploads in Apps Script.
  if (bytes.length > 8 * 1024 * 1024) {
    throw new Error(
      "The PDF is larger than 8 MB. Please reduce the file size and try again."
    );
  }

  var safeName = String(
    fileName || "Legacy Intake.pdf"
  )
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 120) ||
    "Legacy Intake.pdf";

  if (!/\.pdf$/i.test(safeName)) {
    safeName += ".pdf";
  }

  return Utilities.newBlob(
    bytes,
    MimeType.PDF,
    safeName
  );
}



function normalizeLegacyUpdateEntry_(entry) {
  entry =
    entry && typeof entry === "object"
      ? entry
      : {};

  return {
    apply:
      entry.apply === true ||
      String(entry.apply).toLowerCase() === "true",
    value:
      entry.value === null ||
      entry.value === undefined
        ? ""
        : entry.value
  };
}


function appendLegacyNotes_(existingNotes, legacyNotes) {
  var existing =
    String(existingNotes || "").trim();

  var incoming =
    String(legacyNotes || "").trim();

  if (!incoming) return existing;

  var cleaned = existing.replace(
    /\s*\|\s*Legacy Intake:.*$/i,
    ""
  ).trim();

  if (/^Legacy Intake:/i.test(cleaned)) {
    cleaned = "";
  }

  return cleaned
    ? cleaned + " | Legacy Intake: " + incoming
    : "Legacy Intake: " + incoming;
}


function applyLegacyIntakeProfileUpdates_(
  stayKey,
  updates,
  documentId
) {
  updates =
    updates && typeof updates === "object"
      ? updates
      : {};

  var directory =
    updates.directory &&
    typeof updates.directory === "object"
      ? updates.directory
      : {};

  var care =
    updates.care &&
    typeof updates.care === "object"
      ? updates.care
      : {};

  var mainSheet = getTargetSheet_();
  var rows = mainSheet.getDataRange().getValues();

  var bookingMatch =
    findBookingByStayKey_(
      rows,
      stayKey
    );

  if (!bookingMatch) {
    throw new Error(
      "The selected booking could not be found while applying extracted details."
    );
  }

  var bookingRow = bookingMatch.row;

  var before =
    auditBookingSnapshotFromSheetRow_(
      mainSheet,
      bookingRow
    );

  var oldStayKey =
    makeGuestStayKey_(
      before.dogName,
      before.startDate,
      before.endDate
    );

  var config = {
    dogName: { column: 2, label: "Dog Name" },
    breed: { column: 3, label: "Breed" },
    ownerName: { column: 6, label: "Owner" },
    phone: { column: 7, label: "Contact Number" }
  };

  var appliedDirectory = {};
  var changedLabels = [];

  Object.keys(config).forEach(function(key) {
    var entry =
      normalizeLegacyUpdateEntry_(
        directory[key]
      );

    if (!entry.apply) return;

    var value =
      String(entry.value || "").trim();

    if (
      key === "dogName" &&
      !value
    ) {
      throw new Error(
        "Dog Name cannot be blank when applying legacy intake details."
      );
    }

    mainSheet
      .getRange(
        bookingRow,
        config[key].column
      )
      .setValue(value);

    appliedDirectory[key] =
      value;

    changedLabels.push(
      config[key].label
    );
  });

  SpreadsheetApp.flush();

  var after =
    auditBookingSnapshotFromSheetRow_(
      mainSheet,
      bookingRow
    );

  var newStayKey =
    makeGuestStayKey_(
      after.dogName,
      after.startDate,
      after.endDate
    );

  if (oldStayKey !== newStayKey) {
    migrateBelongingsIdentityForGuest_(
      mainSheet.getParent(),
      oldStayKey,
      newStayKey,
      after.dogName
    );

    migrateIntakeIdentitiesForGuest_(
      oldStayKey,
      newStayKey,
      after.dogName
    );
  }

  var belongingsSheet =
    getBelongingsSheet_();

  var belongingsRow =
    findBelongingsRow_(
      belongingsSheet,
      newStayKey
    );

  var riskFlags =
    belongingsRow === -1
      ? normalizeBelongingsRiskFlags_(
          {},
          {}
        )
      : readBelongingsRiskFlagsFromRow_(
          belongingsSheet,
          belongingsRow
        );

  var appliedCare = {};

  BELONGINGS_RISK_CONFIG_.forEach(
    function(flag) {
      var entry =
        normalizeLegacyUpdateEntry_(
          care[flag.key]
        );

      if (!entry.apply) return;

      var flagValue =
        entry.value === true ||
        String(entry.value)
          .toLowerCase() === "true";

      riskFlags[flag.key] =
        flagValue;

      appliedCare[flag.key] =
        flagValue;

      changedLabels.push(
        flag.label
      );
    }
  );

  if (Object.keys(appliedCare).length) {
    upsertBelongingsRecord_(
      belongingsSheet,
      {
        stayKey: newStayKey,
        dogName: after.dogName,
        startDate: after.startDate,
        endDate: after.endDate,
        items: {},
        riskFlags: riskFlags
      }
    );
  }

  if (changedLabels.length) {
    logAuditEvent_({
      category: "Intake",
      action:
        "Legacy Intake Fields Applied",
      dogName: after.dogName,
      bookingType:
        after.bookingType ||
        "Boarding",
      reference:
        String(documentId || ""),
      summary:
        "Reviewed legacy intake details applied to Guest Directory & Care for " +
        after.dogName +
        ".",
      changedFields:
        changedLabels,
      before: before,
      after: {
        booking: after,
        directory:
          appliedDirectory,
        care:
          appliedCare
      },
      source:
        "Legacy Intake Gemini"
    });
  }

  return {
    stayKey: newStayKey,
    dogName: after.dogName,
    directory:
      appliedDirectory,
    care:
      appliedCare,
    changedFields:
      changedLabels
  };
}



function getGeminiLegacyIntakeConfig_() {
  var properties =
    PropertiesService
      .getScriptProperties();

  return {
    apiKey:
      String(
        properties.getProperty(
          "GEMINI_API_KEY"
        ) || ""
      ).trim(),
    model:
      String(
        properties.getProperty(
          "GEMINI_LEGACY_INTAKE_MODEL"
        ) ||
        GEMINI_LEGACY_INTAKE_MODEL_DEFAULT_
      ).trim()
  };
}


function getGeminiLegacyIntakeSchema_() {
  function stringField(description) {
    return {
      type: "string",
      description: description
    };
  }

  function choiceField(description) {
    return {
      type: "string",
      enum: [
        "yes",
        "no",
        "unknown"
      ],
      description: description
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      profile: {
        type: "object",
        additionalProperties: false,
        properties: {
          dogName:
            stringField(
              "Dog's name exactly as written. Empty string if not readable."
            ),
          breed:
            stringField(
              "Dog breed exactly as written. Empty string if absent."
            ),
          ownerName:
            stringField(
              "Owner/client name exactly as written. Empty string if absent."
            ),
          mobile:
            stringField(
              "Owner mobile/contact number exactly as written. Empty string if absent."
            ),
        },
        required: [
          "dogName",
          "breed",
          "ownerName",
          "mobile"
        ]
      },
      care: {
        type: "object",
        additionalProperties: false,
        properties: {
          escapeRisk:
            choiceField(
              "yes only if escape attempts/bolting/escape risk is explicitly disclosed; no only if explicitly denied; otherwise unknown."
            ),
          foodAllergy:
            choiceField(
              "yes only if a food allergy is explicitly disclosed; no only if explicitly stated none/no allergy; otherwise unknown."
            ),
          medicated:
            choiceField(
              "yes only if medication is currently required or medication instructions are provided; no only if explicitly no medication; otherwise unknown."
            ),
          separationAnxiety:
            choiceField(
              "yes/no only when separation anxiety is explicitly answered; otherwise unknown."
            ),
          weightManagement:
            choiceField(
              "yes only when weight management, weight-loss diet, calorie restriction or an explicit weight-control plan is stated. Do not infer from weight alone."
            )
        },
        required: [
          "escapeRisk",
          "foodAllergy",
          "medicated",
          "separationAnxiety",
          "weightManagement"
        ]
      },
      details: {
        type: "object",
        additionalProperties: false,
        properties: {
          emergencyContact:
            stringField(
              "Emergency contact name."
            ),
          emergencyPhone:
            stringField(
              "Emergency contact phone."
            ),
          age:
            stringField(
              "Dog age."
            ),
          weight:
            stringField(
              "Dog weight including units when present."
            ),
          sex:
            stringField(
              "Dog sex/gender."
            ),
          desexed:
            choiceField(
              "Whether the dog is desexed."
            ),
          vaccinated:
            choiceField(
              "Whether the dog is vaccinated."
            ),
          microchipped:
            choiceField(
              "Whether the dog is microchipped."
            ),
          friendlyDogs:
            choiceField(
              "Friendly with other dogs."
            ),
          friendlyCats:
            choiceField(
              "Friendly with cats."
            ),
          friendlyChildren:
            choiceField(
              "Friendly with children."
            ),
          friendlyStrangers:
            choiceField(
              "Friendly with strangers."
            ),
          aggression:
            choiceField(
              "Any aggression disclosed."
            ),
          foodAggression:
            choiceField(
              "Food aggression/resource guarding."
            ),
          indoorAccidents:
            choiceField(
              "Indoor toileting accidents."
            ),
          chewingFurniture:
            choiceField(
              "Chewing furniture/property."
            ),
          triggersFears:
            stringField(
              "Triggers, fears, sensitivities or things to avoid."
            ),
          foodBrandType:
            stringField(
              "Food brand/type."
            ),
          feedingTimes:
            stringField(
              "Feeding times/schedule."
            ),
          foodAmount:
            stringField(
              "Feeding amount/portion."
            ),
          allowedTreats:
            choiceField(
              "Whether treats are allowed."
            ),
          foodAllergies:
            stringField(
              "Food allergy details. Empty if absent."
            ),
          walksPerDay:
            stringField(
              "Number/frequency of walks."
            ),
          walkDuration:
            stringField(
              "Usual walk duration."
            ),
          offLeashAllowed:
            choiceField(
              "Whether off-leash activity is allowed."
            ),
          pullsOnLeash:
            choiceField(
              "Whether the dog pulls on leash."
            ),
          medicalConditions:
            stringField(
              "Medical conditions or health issues."
            ),
          medicationInstructions:
            stringField(
              "Medication name, dose, timing and instructions."
            ),
          regularVetClinic:
            stringField(
              "Veterinary clinic/name."
            ),
          vetPhone:
            stringField(
              "Veterinary phone number."
            ),
          sleepLocation:
            stringField(
              "Where/how the dog sleeps."
            ),
          crateTrained:
            choiceField(
              "Whether the dog is crate trained."
            ),
          canBeLeftAlone:
            choiceField(
              "Whether the dog can be left alone."
            ),
          aloneDuration:
            stringField(
              "How long the dog can be left alone."
            )
        },
        required: [
          "emergencyContact",
          "emergencyPhone",
          "age",
          "weight",
          "sex",
          "desexed",
          "vaccinated",
          "microchipped",
          "friendlyDogs",
          "friendlyCats",
          "friendlyChildren",
          "friendlyStrangers",
          "aggression",
          "foodAggression",
          "indoorAccidents",
          "chewingFurniture",
          "triggersFears",
          "foodBrandType",
          "feedingTimes",
          "foodAmount",
          "allowedTreats",
          "foodAllergies",
          "walksPerDay",
          "walkDuration",
          "offLeashAllowed",
          "pullsOnLeash",
          "medicalConditions",
          "medicationInstructions",
          "regularVetClinic",
          "vetPhone",
          "sleepLocation",
          "crateTrained",
          "canBeLeftAlone",
          "aloneDuration"
        ]
      },
      extractionConfidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description:
          "Overall confidence that the important handwritten/typed answers were read correctly."
      },
      warnings: {
        type: "array",
        maxItems: 12,
        items: {
          type: "string"
        },
        description:
          "Short warnings for illegible handwriting, ambiguous answers, conflicting marks or fields that should be manually checked."
      }
    },
    required: [
      "profile",
      "care",
      "details",
      "extractionConfidence",
      "warnings"
    ]
  };
}


function getGeminiLegacyIntakePrompt_() {
  return [
    "You are extracting a historical dog boarding intake form for Waffle Boarding House.",
    "Read the entire PDF, including scanned pages, handwriting, tick boxes and printed form labels.",
    "Return only information actually supported by the document.",
    "Do not guess missing personal, medical, behavioural or care information.",
    "Use an empty string for absent/unreadable free-text values and 'unknown' for unanswered Yes/No fields.",
    "Preserve the owner's wording where practical.",
    "For Food Allergy, Medication, Escape Risk, Separation Anxiety and Weight Management, be conservative.",
    "Weight by itself does NOT mean Weight Management.",
    "If handwriting or a tick box is unclear, use unknown/empty and add a warning.",
    "The selected booking in Waffle House remains the source of truth for stay dates; do not invent booking dates."
  ].join("\\n");
}


function extractGeminiResponseText_(responseObject) {
  var candidates =
    responseObject &&
    Array.isArray(
      responseObject.candidates
    )
      ? responseObject.candidates
      : [];

  var parts =
    candidates.length &&
    candidates[0].content &&
    Array.isArray(
      candidates[0].content.parts
    )
      ? candidates[0].content.parts
      : [];

  return parts
    .map(function(part) {
      return String(
        part && part.text
          ? part.text
          : ""
      );
    })
    .join("")
    .trim();
}


function normalizeGeminiChoice_(value) {
  var choice =
    String(value || "")
      .trim()
      .toLowerCase();

  return [
    "yes",
    "no",
    "unknown"
  ].indexOf(choice) >= 0
    ? choice
    : "unknown";
}


function normalizeGeminiLegacyIntakeExtraction_(data) {
  data =
    data &&
    typeof data === "object"
      ? data
      : {};

  function cleanText(value) {
    return String(
      value === null ||
      value === undefined
        ? ""
        : value
    )
      .replace(/\s+/g, " ")
      .trim()
      .substring(
        0,
        2500
      );
  }

  var profile =
    data.profile &&
    typeof data.profile === "object"
      ? data.profile
      : {};

  var care =
    data.care &&
    typeof data.care === "object"
      ? data.care
      : {};

  var details =
    data.details &&
    typeof data.details === "object"
      ? data.details
      : {};

  var normalizedDetails = {};

  [
    "emergencyContact",
    "emergencyPhone",
    "age",
    "weight",
    "sex",
    "triggersFears",
    "foodBrandType",
    "feedingTimes",
    "foodAmount",
    "foodAllergies",
    "walksPerDay",
    "walkDuration",
    "medicalConditions",
    "medicationInstructions",
    "regularVetClinic",
    "vetPhone",
    "sleepLocation",
    "aloneDuration"
  ].forEach(function(key) {
    normalizedDetails[key] =
      cleanText(
        details[key]
      );
  });

  [
    "desexed",
    "vaccinated",
    "microchipped",
    "friendlyDogs",
    "friendlyCats",
    "friendlyChildren",
    "friendlyStrangers",
    "aggression",
    "foodAggression",
    "indoorAccidents",
    "chewingFurniture",
    "allowedTreats",
    "offLeashAllowed",
    "pullsOnLeash",
    "crateTrained",
    "canBeLeftAlone"
  ].forEach(function(key) {
    normalizedDetails[key] =
      normalizeGeminiChoice_(
        details[key]
      );
  });

  return {
    profile: {
      dogName:
        cleanText(
          profile.dogName
        ),
      breed:
        cleanText(
          profile.breed
        ),
      ownerName:
        cleanText(
          profile.ownerName
        ),
      mobile:
        cleanText(
          profile.mobile
        ),
    },
    care: {
      escapeRisk:
        normalizeGeminiChoice_(
          care.escapeRisk
        ),
      foodAllergy:
        normalizeGeminiChoice_(
          care.foodAllergy
        ),
      medicated:
        normalizeGeminiChoice_(
          care.medicated
        ),
      separationAnxiety:
        normalizeGeminiChoice_(
          care.separationAnxiety
        ),
      weightManagement:
        normalizeGeminiChoice_(
          care.weightManagement
        )
    },
    details:
      normalizedDetails,
    extractionConfidence:
      Math.max(
        0,
        Math.min(
          1,
          Number(
            data.extractionConfidence ||
            0
          ) || 0
        )
      ),
    warnings:
      (
        Array.isArray(
          data.warnings
        )
          ? data.warnings
          : []
      )
        .map(cleanText)
        .filter(Boolean)
        .slice(0, 12)
  };
}


function callGeminiLegacyIntakeExtraction_(
  pdfBlob
) {
  var config =
    getGeminiLegacyIntakeConfig_();

  if (!config.apiKey) {
    throw new Error(
      "Gemini is not configured. Add GEMINI_API_KEY in Apps Script Project Settings → Script properties."
    );
  }

  if (
    !pdfBlob ||
    typeof pdfBlob.getBytes !==
      "function"
  ) {
    throw new Error(
      "The legacy PDF could not be prepared for Gemini."
    );
  }

  var bytes =
    pdfBlob.getBytes();

  if (
    bytes.length >
    10 * 1024 * 1024
  ) {
    throw new Error(
      "For this Waffle House workflow, keep legacy PDFs at 10 MB or less."
    );
  }

  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(
      config.model
    ) +
    ":generateContent";

  var payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType:
                "application/pdf",
              data:
                Utilities.base64Encode(
                  bytes
                )
            }
          },
          {
            text:
              getGeminiLegacyIntakePrompt_()
          }
        ]
      }
    ],
    generationConfig: {
      responseFormat: {
        text: {
          mimeType:
            "APPLICATION_JSON",
          schema:
            getGeminiLegacyIntakeSchema_()
        }
      }
    }
  };

  function fetchGemini_(requestPayload) {
    return UrlFetchApp.fetch(
      url,
      {
        method: "post",
        contentType:
          "application/json",
        headers: {
          "x-goog-api-key":
            config.apiKey
        },
        payload:
          JSON.stringify(
            requestPayload
          ),
        muteHttpExceptions:
          true
      }
    );
  }

  var response =
    fetchGemini_(payload);

  var status =
    response.getResponseCode();

  var body =
    response.getContentText();

  /*
   * Compatibility fallback:
   * Current raw REST uses responseFormat.text.mimeType as the
   * enum APPLICATION_JSON. If a v1beta rollout still expects the
   * older structured-output fields, retry only after a 400 request
   * format rejection. A 400 occurs before useful generation, so
   * this does not intentionally duplicate a successful AI read.
   */
  if (status === 400) {
    var lowerBody =
      String(body || "")
        .toLowerCase();

    var looksLikeFormatError =
      lowerBody.indexOf(
        "response_format"
      ) >= 0 ||
      lowerBody.indexOf(
        "responseformat"
      ) >= 0 ||
      lowerBody.indexOf(
        "response_json_schema"
      ) >= 0 ||
      lowerBody.indexOf(
        "responsejsonschema"
      ) >= 0 ||
      lowerBody.indexOf(
        "response_mime_type"
      ) >= 0 ||
      lowerBody.indexOf(
        "responsemimetype"
      ) >= 0 ||
      lowerBody.indexOf(
        "generation_config"
      ) >= 0;

    if (looksLikeFormatError) {
      var fallbackPayload =
        JSON.parse(
          JSON.stringify(
            payload
          )
        );

      fallbackPayload
        .generationConfig = {
          responseMimeType:
            "application/json",
          responseJsonSchema:
            getGeminiLegacyIntakeSchema_()
        };

      response =
        fetchGemini_(
          fallbackPayload
        );

      status =
        response.getResponseCode();

      body =
        response.getContentText();
    }
  }

  if (
    status < 200 ||
    status >= 300
  ) {
    var detail = "";

    try {
      var errorPayload =
        JSON.parse(body);

      detail =
        errorPayload &&
        errorPayload.error &&
        errorPayload.error.message
          ? String(
              errorPayload.error.message
            )
          : "";
    } catch (_) {}

    if (status === 429) {
      throw new Error(
        "Gemini Free Tier quota is currently unavailable or has been reached. The PDF is still saved in Drive; use Retry AI Read later."
      );
    }

    throw new Error(
      "Gemini PDF extraction failed" +
      (
        detail
          ? ": " + detail
          : " (HTTP " +
            status +
            ")"
      ) +
      " [model=" +
      config.model +
      "]"
    );
  }

  var responseObject;

  try {
    responseObject =
      JSON.parse(body);
  } catch (_) {
    throw new Error(
      "Gemini returned an unreadable response."
    );
  }

  var jsonText =
    extractGeminiResponseText_(
      responseObject
    );

  if (!jsonText) {
    throw new Error(
      "Gemini did not return extracted intake data."
    );
  }

  var parsed;

  try {
    parsed =
      JSON.parse(
        jsonText
      );
  } catch (_) {
    throw new Error(
      "Gemini returned data that could not be parsed as structured JSON."
    );
  }

  return {
    model:
      config.model,
    fields:
      normalizeGeminiLegacyIntakeExtraction_(
        parsed
      )
  };
}


function legacyComparableText_(value) {
  return String(
    value || ""
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function legacyPhoneDigits_(value) {
  return String(
    value || ""
  ).replace(/\D/g, "");
}


function legacyTextEquivalent_(
  a,
  b
) {
  var left =
    legacyComparableText_(a);

  var right =
    legacyComparableText_(b);

  if (!left || !right) {
    return left === right;
  }

  return (
    left === right ||
    left.indexOf(right) >= 0 ||
    right.indexOf(left) >= 0
  );
}


function legacyPhoneEquivalent_(
  a,
  b
) {
  var left =
    legacyPhoneDigits_(a);

  var right =
    legacyPhoneDigits_(b);

  if (!left || !right) {
    return left === right;
  }

  var left8 =
    left.slice(-8);

  var right8 =
    right.slice(-8);

  return (
    left === right ||
    (
      left8 &&
      right8 &&
      left8 === right8
    )
  );
}


function mergeLegacyAttributeText_(
  existing,
  incoming
) {
  var current =
    String(existing || "")
      .trim();

  var added =
    String(incoming || "")
      .trim();

  if (!added) return current;
  if (!current) return added;

  if (
    legacyTextEquivalent_(
      current,
      added
    )
  ) {
    return current;
  }

  return (
    current +
    ", " +
    added
  );
}


function geminiLegacyYesNoLabel_(
  value
) {
  if (value === "yes") {
    return "Yes";
  }

  if (value === "no") {
    return "No";
  }

  return "";
}


function buildGeminiLegacyNotes_(
  extraction
) {
  extraction =
    extraction &&
    typeof extraction === "object"
      ? extraction
      : {};

  var d =
    extraction.details &&
    typeof extraction.details ===
      "object"
      ? extraction.details
      : {};

  var parts = [];

  [
    [
      "Emergency Contact",
      (
        d.emergencyContact ||
        ""
      ) +
      (
        d.emergencyPhone
          ? " (" +
            d.emergencyPhone +
            ")"
          : ""
      )
    ],
    ["Age", d.age],
    ["Weight", d.weight],
    ["Sex", d.sex],
    [
      "Desexed",
      geminiLegacyYesNoLabel_(
        d.desexed
      )
    ],
    [
      "Vaccinated",
      geminiLegacyYesNoLabel_(
        d.vaccinated
      )
    ],
    [
      "Microchipped",
      geminiLegacyYesNoLabel_(
        d.microchipped
      )
    ]
  ].forEach(
    function(pair) {
      var value =
        String(
          pair[1] || ""
        ).trim();

      if (value) {
        parts.push(
          pair[0] +
          ": " +
          value
        );
      }
    }
  );

  var friendly = [
    ["Dogs", d.friendlyDogs],
    ["Cats", d.friendlyCats],
    [
      "Children",
      d.friendlyChildren
    ],
    [
      "Strangers",
      d.friendlyStrangers
    ]
  ]
    .filter(
      function(pair) {
        return (
          pair[1] === "yes" ||
          pair[1] === "no"
        );
      }
    )
    .map(
      function(pair) {
        return (
          pair[0] +
          " " +
          (
            pair[1] === "yes"
              ? "Yes"
              : "No"
          )
        );
      }
    );

  if (friendly.length) {
    parts.push(
      "Friendly: " +
      friendly.join(", ")
    );
  }

  if (d.aggression === "yes") {
    parts.push(
      "Aggression disclosed"
    );
  }

  if (
    d.foodAggression ===
    "yes"
  ) {
    parts.push(
      "Food aggression/resource guarding disclosed"
    );
  }

  if (
    d.indoorAccidents ===
    "yes"
  ) {
    parts.push(
      "Indoor accidents disclosed"
    );
  }

  if (
    d.chewingFurniture ===
    "yes"
  ) {
    parts.push(
      "Chewing/property damage disclosed"
    );
  }

  if (d.triggersFears) {
    parts.push(
      "Triggers/Fears: " +
      d.triggersFears
    );
  }

  var feeding = [
    d.foodBrandType,
    d.feedingTimes,
    d.foodAmount
  ].filter(Boolean);

  if (feeding.length) {
    parts.push(
      "Feeding: " +
      feeding.join(" · ")
    );
  }

  if (
    d.allowedTreats === "yes" ||
    d.allowedTreats === "no"
  ) {
    parts.push(
      "Treats allowed: " +
      (
        d.allowedTreats ===
        "yes"
          ? "Yes"
          : "No"
      )
    );
  }

  if (d.foodAllergies) {
    parts.push(
      "Food allergies: " +
      d.foodAllergies
    );
  }

  var walks = [
    d.walksPerDay,
    d.walkDuration
  ].filter(Boolean);

  if (walks.length) {
    parts.push(
      "Walking: " +
      walks.join(" · ")
    );
  }

  if (
    d.offLeashAllowed ===
      "yes" ||
    d.offLeashAllowed ===
      "no"
  ) {
    parts.push(
      "Off-leash allowed: " +
      (
        d.offLeashAllowed ===
        "yes"
          ? "Yes"
          : "No"
      )
    );
  }

  if (
    d.pullsOnLeash === "yes"
  ) {
    parts.push(
      "Pulls on leash"
    );
  }

  if (d.medicalConditions) {
    parts.push(
      "Medical: " +
      d.medicalConditions
    );
  }

  if (
    d.medicationInstructions
  ) {
    parts.push(
      "Medication: " +
      d.medicationInstructions
    );
  }

  if (d.regularVetClinic) {
    parts.push(
      "Vet: " +
      d.regularVetClinic +
      (
        d.vetPhone
          ? " (" +
            d.vetPhone +
            ")"
          : ""
      )
    );
  }

  if (d.sleepLocation) {
    parts.push(
      "Sleeps: " +
      d.sleepLocation
    );
  }

  if (
    d.crateTrained === "yes" ||
    d.crateTrained === "no"
  ) {
    parts.push(
      "Crate trained: " +
      (
        d.crateTrained ===
        "yes"
          ? "Yes"
          : "No"
      )
    );
  }

  if (
    d.canBeLeftAlone ===
      "yes" ||
    d.canBeLeftAlone ===
      "no"
  ) {
    parts.push(
      "Can be left alone: " +
      (
        d.canBeLeftAlone ===
        "yes"
          ? (
              d.aloneDuration
                ? "Yes · " +
                  d.aloneDuration
                : "Yes"
            )
          : "No"
      )
    );
  }

  return parts.join(" | ");
}


function getLegacyCurrentCareFlags_(
  stayKey
) {
  var sheet =
    getBelongingsSheet_();

  var row =
    findBelongingsRow_(
      sheet,
      stayKey
    );

  if (row === -1) {
    return normalizeBelongingsRiskFlags_(
      {},
      {}
    );
  }

  return readBelongingsRiskFlagsFromRow_(
    sheet,
    row
  );
}


function buildGeminiLegacyAutoApplyPlan_(
  stayKey,
  extraction
) {
  var mainSheet =
    getTargetSheet_();

  var rows =
    mainSheet
      .getDataRange()
      .getValues();

  var bookingMatch =
    findBookingByStayKey_(
      rows,
      stayKey
    );

  if (!bookingMatch) {
    throw new Error(
      "The selected booking could not be found."
    );
  }

  var before =
    auditBookingSnapshotFromSheetRow_(
      mainSheet,
      bookingMatch.row
    );

  var profile =
    extraction.profile || {};

  var conflicts = [];

  var updates = {
    directory: {},
    care: {}
  };

  var extractedDog =
    String(
      profile.dogName || ""
    ).trim();

  if (
    extractedDog &&
    !legacyTextEquivalent_(
      extractedDog,
      before.dogName
    )
  ) {
    conflicts.push({
      type:
        "identity",
      key:
        "dogName",
      label:
        "Dog Name",
      current:
        before.dogName,
      extracted:
        extractedDog,
      message:
        "The PDF appears to name a different dog. No extracted attributes were automatically applied."
    });

    return {
      blocked:
        true,
      updates:
        updates,
      conflicts:
        conflicts,
      before:
        before
    };
  }

  function directoryReplacePlan(
    key,
    label,
    current,
    incoming,
    comparator
  ) {
    incoming =
      String(
        incoming || ""
      ).trim();

    current =
      String(
        current || ""
      ).trim();

    if (!incoming) return;

    if (!current) {
      updates.directory[
        key
      ] = {
        apply: true,
        value: incoming
      };
      return;
    }

    var equal =
      comparator
        ? comparator(
            current,
            incoming
          )
        : legacyTextEquivalent_(
            current,
            incoming
          );

    if (equal) return;

    conflicts.push({
      type:
        "directory",
      key:
        key,
      label:
        label,
      current:
        current,
      extracted:
        incoming,
      message:
        "Existing Waffle House value differs from the PDF."
    });
  }

  directoryReplacePlan(
    "breed",
    "Breed",
    before.breed,
    profile.breed
  );

  directoryReplacePlan(
    "ownerName",
    "Owner",
    before.ownerName,
    profile.ownerName
  );

  directoryReplacePlan(
    "phone",
    "Contact Number",
    before.phone,
    profile.mobile,
    legacyPhoneEquivalent_
  );

  var currentCare =
    getLegacyCurrentCareFlags_(
      stayKey
    );

  var careLabels = {
    escapeRisk:
      "Escape Risk",
    foodAllergy:
      "Food Allergy",
    medicated:
      "Medicated",
    separationAnxiety:
      "Separation Anxiety",
    weightManagement:
      "Weight Management"
  };

  Object.keys(
    careLabels
  ).forEach(function(key) {
    var extracted =
      String(
        extraction.care &&
        extraction.care[key]
          ? extraction.care[key]
          : "unknown"
      );

    if (
      extracted ===
      "unknown"
    ) {
      return;
    }

    var current =
      currentCare[key] ===
      true;

    if (
      extracted === "yes"
    ) {
      if (!current) {
        updates.care[key] = {
          apply: true,
          value: true
        };
      }
      return;
    }

    if (
      extracted === "no" &&
      current
    ) {
      conflicts.push({
        type:
          "care",
        key:
          key,
        label:
          careLabels[key],
        current:
          true,
        extracted:
          false,
        message:
          "The PDF says No, but Waffle House currently has this care alert enabled. It was not cleared automatically."
      });
    }
  });

  return {
    blocked:
      false,
    updates:
      updates,
    conflicts:
      conflicts,
    before:
      before
  };
}


function mergeLegacyAppliedFields_(
  current,
  result
) {
  current =
    current &&
    typeof current === "object"
      ? current
      : {};

  result =
    result &&
    typeof result === "object"
      ? result
      : {};

  var merged = {
    directory: {},
    care: {},
    changedFields: []
  };

  [
    current.directory,
    result.directory
  ].forEach(function(source) {
    if (
      source &&
      typeof source === "object"
    ) {
      Object.keys(source)
        .forEach(function(key) {
          merged.directory[key] =
            source[key];
        });
    }
  });

  [
    current.care,
    result.care
  ].forEach(function(source) {
    if (
      source &&
      typeof source === "object"
    ) {
      Object.keys(source)
        .forEach(function(key) {
          merged.care[key] =
            source[key];
        });
    }
  });

  merged.changedFields =
    []
      .concat(
        Array.isArray(
          current.changedFields
        )
          ? current.changedFields
          : []
      )
      .concat(
        Array.isArray(
          result.changedFields
        )
          ? result.changedFields
          : []
      )
      .filter(
        function(value, index, array) {
          return (
            value &&
            array.indexOf(value) ===
              index
          );
        }
      );

  return merged;
}


function processStoredLegacyIntakeWithGemini_(
  documentId
) {
  var legacySheet =
    getLegacyIntakeSheet_();

  var record =
    findLegacyIntakeDocumentById_(
      legacySheet,
      documentId
    );

  if (!record) {
    throw new Error(
      "The legacy intake record could not be found."
    );
  }

  if (!record.pdfFileId) {
    throw new Error(
      "The legacy intake PDF file is missing from the record."
    );
  }

  var mainSheet =
    getTargetSheet_();

  var rows =
    mainSheet
      .getDataRange()
      .getValues();

  var bookingMatch =
    findBookingByStayKey_(
      rows,
      record.stayKey
    );

  if (!bookingMatch) {
    throw new Error(
      "The assigned booking could not be found. Reassign the PDF first."
    );
  }

  legacySheet
    .getRange(
      record.row,
      22
    )
    .setValue(
      "Processing"
    );

  legacySheet
    .getRange(
      record.row,
      2
    )
    .setValue(
      new Date()
    );

  var pdfFile =
    DriveApp.getFileById(
      record.pdfFileId
    );

  var extractionResult =
    callGeminiLegacyIntakeExtraction_(
      pdfFile.getBlob()
    );

  var extraction =
    extractionResult.fields;

  var plan =
    buildGeminiLegacyAutoApplyPlan_(
      record.stayKey,
      extraction
    );

  var appliedResult = {
    stayKey:
      record.stayKey,
    dogName:
      bookingMatch.record.dogName,
    directory: {},
    care: {},
    changedFields: []
  };

  if (!plan.blocked) {
    appliedResult =
      applyLegacyIntakeProfileUpdates_(
        record.stayKey,
        plan.updates,
        documentId
      );
  }

  var storedRecord =
    findLegacyIntakeDocumentById_(
      legacySheet,
      documentId
    );

  var existingApplied =
    storedRecord
      ? storedRecord.appliedFields
      : {};

  var mergedApplied =
    mergeLegacyAppliedFields_(
      existingApplied,
      appliedResult
    );

  var finalStatus =
    plan.conflicts.length
      ? "Review Required"
      : "Complete";

  var finalStayKey =
    appliedResult.stayKey ||
    record.stayKey;

  var finalDogName =
    appliedResult.dogName ||
    bookingMatch.record.dogName ||
    record.dogName;

  if (!plan.blocked) {
    saveIntakeAttributesForStay_(
      finalDogName,
      bookingMatch.record.startDate,
      bookingMatch.record.endDate,
      finalStayKey,
      legacyParsedFieldsToIntakeAttributes_(
        extraction
      ),
      "Legacy Intake · Gemini"
    );
  }

  legacySheet
    .getRange(
      record.row,
      2
    )
    .setValue(
      new Date()
    );

  legacySheet
    .getRange(
      record.row,
      4
    )
    .setValue(
      finalStayKey
    );

  legacySheet
    .getRange(
      record.row,
      5
    )
    .setValue(
      finalDogName
    );

  legacySheet
    .getRange(
      record.row,
      17
    )
    .setValue(
      "Gemini API · " +
      extractionResult.model
    );

  legacySheet
    .getRange(
      record.row,
      18
    )
    .setValue(
      ""
    );

  legacySheet
    .getRange(
      record.row,
      19
    )
    .setValue(
      JSON.stringify(
        extraction
      )
    );

  legacySheet
    .getRange(
      record.row,
      20
    )
    .setValue(
      JSON.stringify(
        mergedApplied
      )
    );

  legacySheet
    .getRange(
      record.row,
      21
    )
    .setValue(
      JSON.stringify(
        plan.conflicts
      )
    );

  legacySheet
    .getRange(
      record.row,
      22
    )
    .setValue(
      finalStatus
    );

  logAuditEvent_({
    category:
      "Intake",
    action:
      "Legacy Intake AI Processed",
    dogName:
      finalDogName,
    bookingType:
      bookingMatch.record.bookingType ||
      "Boarding",
    reference:
      documentId,
    summary:
      "Gemini read the legacy intake PDF for " +
      finalDogName +
      ". " +
      (
        appliedResult.changedFields.length
          ? appliedResult.changedFields.length +
            " attribute" +
            (
              appliedResult.changedFields.length ===
              1
                ? ""
                : "s"
            ) +
            " updated."
          : "No new attributes required updating."
      ) +
      (
        plan.conflicts.length
          ? " " +
            plan.conflicts.length +
            " item" +
            (
              plan.conflicts.length === 1
                ? ""
                : "s"
            ) +
            " require review."
          : ""
      ),
    changedFields:
      appliedResult.changedFields,
    after: {
      aiStatus:
        finalStatus,
      extractionConfidence:
        extraction.extractionConfidence,
      warnings:
        extraction.warnings,
      applied:
        mergedApplied,
      reviewConflicts:
        plan.conflicts
    },
    source:
      "Gemini Legacy Intake"
  });

  touchWaffleDataVersion_(
    "directory"
  );

  return {
    result:
      "success",
    action:
      "legacy_intake_ai_processed",
    documentId:
      documentId,
    stayKey:
      finalStayKey,
    dogName:
      finalDogName,
    pdfUrl:
      record.pdfUrl,
    extractionMethod:
      "Gemini API · " +
      extractionResult.model,
    aiStatus:
      finalStatus,
    extraction:
      extraction,
    applied:
      mergedApplied,
    changedFields:
      appliedResult.changedFields,
    conflicts:
      plan.conflicts
  };
}


function retryGeminiLegacyIntakeFromHtml(
  documentId
) {
  assertWaffleActionAllowedDuringMaintenance_("retryGeminiLegacyIntakeFromHtml");

  documentId =
    String(
      documentId || ""
    ).trim();

  if (!documentId) {
    throw new Error(
      "Legacy document ID is required."
    );
  }

  return processStoredLegacyIntakeWithGemini_(
    documentId
  );
}


function applyLegacyIntakeConflictResolutionsFromHtml(
  payload
) {
  assertWaffleActionAllowedDuringMaintenance_("applyLegacyIntakeConflictResolutionsFromHtml");

  payload =
    payload &&
    typeof payload === "object"
      ? payload
      : {};

  var documentId =
    String(
      payload.documentId || ""
    ).trim();

  var selectedKeys =
    Array.isArray(
      payload.useExtractedKeys
    )
      ? payload.useExtractedKeys
          .map(function(value) {
            return String(value || "");
          })
      : [];

  if (!documentId) {
    throw new Error(
      "Legacy document ID is required."
    );
  }

  var sheet =
    getLegacyIntakeSheet_();

  var record =
    findLegacyIntakeDocumentById_(
      sheet,
      documentId
    );

  if (!record) {
    throw new Error(
      "The legacy intake document could not be found."
    );
  }

  var conflicts =
    Array.isArray(
      record.reviewConflicts
    )
      ? record.reviewConflicts
      : [];

  var updates = {
    directory: {},
    care: {}
  };

  var resolvedKeys = [];

  conflicts.forEach(
    function(conflict) {
      var resolutionKey =
        String(
          conflict.type +
          ":" +
          conflict.key
        );

      if (
        selectedKeys.indexOf(
          resolutionKey
        ) === -1
      ) {
        return;
      }

      if (
        conflict.type ===
        "directory"
      ) {
        updates.directory[
          conflict.key
        ] = {
          apply: true,
          value:
            conflict.extracted
        };

        resolvedKeys.push(
          resolutionKey
        );
        return;
      }

      if (
        conflict.type ===
        "care"
      ) {
        updates.care[
          conflict.key
        ] = {
          apply: true,
          value:
            conflict.extracted ===
            true
        };

        resolvedKeys.push(
          resolutionKey
        );
      }
    }
  );

  var applyResult = {
    directory: {},
    care: {},
    changedFields: []
  };

  if (resolvedKeys.length) {
    applyResult =
      applyLegacyIntakeProfileUpdates_(
        record.stayKey,
        updates,
        documentId
      );
  }

  var remaining =
    conflicts.filter(
      function(conflict) {
        return (
          resolvedKeys.indexOf(
            String(
              conflict.type +
              ":" +
              conflict.key
            )
          ) === -1
        );
      }
    );

  var mergedApplied =
    mergeLegacyAppliedFields_(
      record.appliedFields,
      applyResult
    );

  sheet
    .getRange(
      record.row,
      2
    )
    .setValue(
      new Date()
    );

  sheet
    .getRange(
      record.row,
      20
    )
    .setValue(
      JSON.stringify(
        mergedApplied
      )
    );

  sheet
    .getRange(
      record.row,
      21
    )
    .setValue(
      JSON.stringify(
        remaining
      )
    );

  sheet
    .getRange(
      record.row,
      22
    )
    .setValue(
      remaining.length
        ? "Review Required"
        : "Complete"
    );

  return {
    result:
      "success",
    documentId:
      documentId,
    applied:
      mergedApplied,
    changedFields:
      applyResult.changedFields ||
      [],
    conflicts:
      remaining,
    aiStatus:
      remaining.length
        ? "Review Required"
        : "Complete"
  };
}


function verifyWaffleHouseGeminiLegacyIntake() {
  var config =
    getGeminiLegacyIntakeConfig_();

  return {
    result:
      "success",
    configured:
      !!config.apiKey,
    model:
      config.model,
    sheetName:
      getLegacyIntakeSheet_()
        .getName(),
    message:
      config.apiKey
        ? "Gemini Legacy Intake is configured."
        : "Add GEMINI_API_KEY in Script Properties."
  };
}


function testWaffleHouseGeminiLegacyIntake() {
  var config =
    getGeminiLegacyIntakeConfig_();

  if (!config.apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(
      config.model
    ) +
    ":generateContent";

  var response =
    UrlFetchApp.fetch(
      url,
      {
        method:
          "post",
        contentType:
          "application/json",
        headers: {
          "x-goog-api-key":
            config.apiKey
        },
        payload:
          JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text:
                      "Reply exactly with: Waffle Gemini OK"
                  }
                ]
              }
            ]
          }),
        muteHttpExceptions:
          true
      }
    );

  var status =
    response.getResponseCode();

  if (
    status < 200 ||
    status >= 300
  ) {
    throw new Error(
      "Gemini connection test failed (HTTP " +
      status +
      "): " +
      response.getContentText()
        .substring(
          0,
          600
        )
    );
  }

  return {
    result:
      "success",
    configured:
      true,
    model:
      config.model,
    response:
      extractGeminiResponseText_(
        JSON.parse(
          response.getContentText()
        )
      )
  };
}


function saveLegacyIntakeFromHtml(payload) {
  assertWaffleActionAllowedDuringMaintenance_("saveLegacyIntakeFromHtml");

  payload =
    payload &&
    typeof payload === "object"
      ? payload
      : {};

  var stayKey =
    String(
      payload.stayKey || ""
    ).trim();

  var fileData =
    String(
      payload.fileData || ""
    );

  var fileName =
    String(
      payload.fileName ||
      "Legacy Intake.pdf"
    );

  if (!stayKey) {
    throw new Error(
      "Choose the dog/stay this PDF belongs to."
    );
  }

  var mainSheet =
    getTargetSheet_();

  var rows =
    mainSheet
      .getDataRange()
      .getValues();

  var bookingMatch =
    findBookingByStayKey_(
      rows,
      stayKey
    );

  if (!bookingMatch) {
    throw new Error(
      "The selected booking could not be found. Refresh and try again."
    );
  }

  var booking =
    bookingMatch.record;

  var pdfBlob =
    decodeLegacyPdfData_(
      fileData,
      fileName
    );

  var dogFolder =
    getIntakeDogFolder_(
      booking.dogName
    );

  var now =
    new Date();

  var dateStamp =
    Utilities.formatDate(
      now,
      mainSheet
        .getParent()
        .getSpreadsheetTimeZone(),
      "yyyy-MM-dd"
    );

  var safeDog =
    String(
      booking.dogName ||
      "Dog"
    )
      .replace(
        /[\\/:*?"<>|]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  var storedName =
    dateStamp +
    "_" +
    safeDog
      .replace(
        /\s+/g,
        "_"
      ) +
    "_Legacy_Intake.pdf";

  /*
   * Drive save happens BEFORE the AI request.
   * If Gemini is unavailable or quota is exhausted, the source PDF
   * is still retained and can be retried later without re-uploading.
   */
  var pdfFile =
    dogFolder.createFile(
      pdfBlob
        .copyBlob()
        .setName(
          storedName
        )
    );

  var documentId =
    "legacy_" +
    Utilities.getUuid()
      .replace(
        /-/g,
        ""
      );

  var legacySheet =
    getLegacyIntakeSheet_();

  legacySheet.appendRow([
    now,
    now,
    documentId,
    stayKey,
    booking.dogName || "",
    booking.breed || "",
    booking.startDate || "",
    booking.endDate || "",
    booking.ownerName || "",
    booking.phone || "",
    pdfFile.getId(),
    pdfFile.getUrl(),
    fileName,
    100,
    "Assigned from Guest Directory / selected booking",
    bookingMatch.row,
    "",
    "",
    "{}",
    "{}",
    "[]",
    "Saved · Pending AI"
  ]);

  logAuditEvent_({
    category:
      "Intake",
    action:
      "Legacy Intake Uploaded",
    dogName:
      booking.dogName,
    bookingType:
      booking.bookingType ||
      "Boarding",
    reference:
      documentId,
    summary:
      "Legacy intake PDF saved privately in Google Drive for " +
      booking.dogName +
      ". Gemini extraction started.",
    changedFields: [
      "Legacy Intake PDF"
    ],
    after: {
      stayKey:
        stayKey,
      documentId:
        documentId,
      pdfFileId:
        pdfFile.getId(),
      originalFilename:
        fileName,
      aiStatus:
        "Saved · Pending AI"
    },
    source:
      "Gemini Legacy Intake"
  });

  touchWaffleDataVersion_(
    "directory"
  );

  try {
    var aiResult =
      processStoredLegacyIntakeWithGemini_(
        documentId
      );

    aiResult.uploadedAt =
      now.toISOString();

    return aiResult;

  } catch (error) {
    var stored =
      findLegacyIntakeDocumentById_(
        legacySheet,
        documentId
      );

    if (stored) {
      legacySheet
        .getRange(
          stored.row,
          2
        )
        .setValue(
          new Date()
        );

      legacySheet
        .getRange(
          stored.row,
          22
        )
        .setValue(
          "AI Failed"
        );
    }

    logAuditEvent_({
      category:
        "Intake",
      action:
        "Legacy Intake AI Failed",
      dogName:
        booking.dogName,
      bookingType:
        booking.bookingType ||
        "Boarding",
      reference:
        documentId,
      summary:
        "The legacy intake PDF for " +
        booking.dogName +
        " was saved in Drive, but Gemini extraction did not complete.",
      changedFields: [
        "AI Status"
      ],
      after: {
        aiStatus:
          "AI Failed",
        error:
          String(
            error &&
            error.message
              ? error.message
              : error
          )
      },
      source:
        "Gemini Legacy Intake"
    });

    return {
      result:
        "partial_success",
      action:
        "legacy_intake_saved_ai_failed",
      documentId:
        documentId,
      stayKey:
        stayKey,
      dogName:
        booking.dogName,
      pdfUrl:
        pdfFile.getUrl(),
      aiStatus:
        "AI Failed",
      errorMessage:
        String(
          error &&
          error.message
            ? error.message
            : error
        ),
      conflicts: [],
      changedFields: []
    };
  }
}


function reassignLegacyIntakeFromHtml(payload) {
  assertWaffleActionAllowedDuringMaintenance_("reassignLegacyIntakeFromHtml");

  payload = payload && typeof payload === "object"
    ? payload
    : {};

  var documentId =
    String(payload.documentId || "").trim();

  var stayKey =
    String(payload.stayKey || "").trim();

  if (!documentId || !stayKey) {
    throw new Error(
      "Document ID and destination stay are required."
    );
  }

  var legacySheet =
    getLegacyIntakeSheet_();

  var existing =
    findLegacyIntakeDocumentById_(
      legacySheet,
      documentId
    );

  if (!existing) {
    throw new Error(
      "The legacy intake document could not be found."
    );
  }

  var mainSheet = getTargetSheet_();
  var rows = mainSheet.getDataRange().getValues();
  var bookingMatch =
    findBookingByStayKey_(rows, stayKey);

  if (!bookingMatch) {
    throw new Error(
      "The selected booking could not be found."
    );
  }

  var booking = bookingMatch.record;
  var oldSnapshot = {
    stayKey: existing.stayKey,
    dogName: existing.dogName,
    startDate: existing.startDate,
    endDate: existing.endDate
  };

  var now = new Date();

  legacySheet.getRange(existing.row, 2)
    .setValue(now);

  legacySheet.getRange(existing.row, 4)
    .setValue(stayKey);

  legacySheet.getRange(existing.row, 5)
    .setValue(booking.dogName || "");

  legacySheet.getRange(existing.row, 6)
    .setValue(booking.breed || "");

  legacySheet.getRange(existing.row, 7)
    .setValue(booking.startDate || "");

  legacySheet.getRange(existing.row, 8)
    .setValue(booking.endDate || "");

  legacySheet.getRange(existing.row, 9)
    .setValue(booking.ownerName || "");

  legacySheet.getRange(existing.row, 10)
    .setValue(booking.phone || "");

  legacySheet.getRange(existing.row, 14)
    .setValue(0);

  legacySheet.getRange(existing.row, 15)
    .setValue("Manual reassignment");

  legacySheet.getRange(existing.row, 16)
    .setValue(bookingMatch.row);

  try {
    if (existing.pdfFileId) {
      DriveApp
        .getFileById(existing.pdfFileId)
        .moveTo(
          getIntakeDogFolder_(
            booking.dogName
          )
        );
    }
  } catch (_) {
    // The database reassignment remains valid even if Drive cannot move
    // an older file (for example, if it was moved manually).
  }

  logAuditEvent_({
    category: "Intake",
    action: "Legacy Intake Reassigned",
    dogName: booking.dogName,
    bookingType:
      booking.bookingType || "Boarding",
    reference: documentId,
    summary:
      "Legacy intake PDF reassigned to " +
      booking.dogName +
      ".",
    changedFields: [
      "Legacy Intake Assignment"
    ],
    before: oldSnapshot,
    after: {
      stayKey: stayKey,
      dogName: booking.dogName,
      startDate: booking.startDate,
      endDate: booking.endDate
    },
    source: "Web App"
  });

  touchWaffleDataVersion_(
    "directory"
  );

  return {
    result: "success",
    action: "legacy_intake_reassigned",
    documentId: documentId,
    stayKey: stayKey,
    dogName: booking.dogName,
    pdfUrl: existing.pdfUrl
  };
}


function migrateIntakeIdentitiesForGuest_(
  oldStayKey,
  newStayKey,
  newDogName
) {
  if (
    !oldStayKey ||
    !newStayKey ||
    oldStayKey === newStayKey
  ) {
    return {
      digital: 0,
      legacy: 0
    };
  }

  var digitalMigrated = 0;
  var legacyMigrated = 0;

  try {
    var digitalSheet = getIntakeSheet_();

    if (digitalSheet.getLastRow() >= 2) {
      var digitalValues = digitalSheet
        .getRange(
          2,
          1,
          digitalSheet.getLastRow() - 1,
          INTAKE_HEADERS_.length
        )
        .getValues();

      digitalValues.forEach(function(row, index) {
        if (
          String(row[5] || "").trim() !==
          oldStayKey
        ) {
          return;
        }

        var rowNumber = index + 2;

        digitalSheet.getRange(rowNumber, 2)
          .setValue(new Date());

        digitalSheet.getRange(rowNumber, 6)
          .setValue(newStayKey);

        digitalSheet.getRange(rowNumber, 8)
          .setValue(newDogName);

        digitalMigrated++;
      });
    }
  } catch (_) {}

  try {
    var legacySheet =
      getLegacyIntakeSheet_();

    if (legacySheet.getLastRow() >= 2) {
      var legacyValues = legacySheet
        .getRange(
          2,
          1,
          legacySheet.getLastRow() - 1,
          LEGACY_INTAKE_HEADERS_.length
        )
        .getValues();

      legacyValues.forEach(function(row, index) {
        if (
          String(row[3] || "").trim() !==
          oldStayKey
        ) {
          return;
        }

        var rowNumber = index + 2;

        legacySheet.getRange(rowNumber, 2)
          .setValue(new Date());

        legacySheet.getRange(rowNumber, 4)
          .setValue(newStayKey);

        legacySheet.getRange(rowNumber, 5)
          .setValue(newDogName);

        legacyMigrated++;
      });
    }
  } catch (_) {}

  return {
    digital: digitalMigrated,
    legacy: legacyMigrated
  };
}



var INTAKE_HEADERS_ = [
  "Created At",
  "Updated At",
  "Submitted At",
  "Status",
  "Token",
  "Stay Key",
  "Booking Type",
  "Dog Name",
  "Breed",
  "Start Date",
  "End Date",
  "Owner Name",
  "Mobile",
  "Intake JSON",
  "PDF File ID",
  "PDF URL",
  "Signature File ID",
  "Booking Row"
];


var INTAKE_TERMS_ = [
  {
    title: "1. Accuracy of Information",
    text: "The owner confirms that all information provided about the dog, including behaviour, aggression, bite history, escape tendencies, medical conditions, allergies, medication and interactions with people or animals, is complete and accurate. The owner must disclose any known risk that could reasonably affect the safety of the dog, the sitter, other people, animals or property."
  },
  {
    title: "2. Emergency Veterinary Care",
    text: "If the owner or emergency contact cannot be reached within a reasonable time, the owner authorises the sitter to obtain veterinary assessment or treatment that the sitter reasonably considers necessary for the dog’s health or safety. The owner is responsible for veterinary, medication, transport and related costs, except to the extent a cost results from the sitter’s negligence or unlawful conduct."
  },
  {
    title: "3. Behaviour, Injury and Property Damage",
    text: "The owner remains responsible for loss, injury or damage caused by the dog where it results from the dog’s behaviour, a condition or risk not disclosed to the sitter, or the owner’s inaccurate or incomplete instructions. This may include reasonable costs arising from bites, attacks, escape, property damage or injury to another person or animal, subject to applicable law."
  },
  {
    title: "4. Ordinary Pet-Care Risks and Unforeseen Events",
    text: "The owner acknowledges that dog sitting, walking and normal pet care can involve unpredictable circumstances, including illness, minor injuries, encounters with other animals, environmental conditions, behavioural changes and escape attempts. The sitter will take reasonable care and use reasonable judgment in responding to such circumstances, but outcomes may depend on factors outside the sitter’s reasonable control."
  },
  {
    title: "5. Care Arrangements and Unforeseen Circumstances",
    text: "The sitter will use reasonable care in providing the agreed services and following the owner’s instructions. The owner acknowledges that circumstances may arise that are not reasonably foreseeable or preventable. Where appropriate, the sitter may make reasonable decisions or adjustments in the interests of the dog’s safety and wellbeing. Responsibility for any incident will be determined having regard to the circumstances and applicable law."
  },
  {
    title: "6. Supplies and Special Requirements",
    text: "The owner will provide sufficient food, medication, leads, harnesses, identification and any other items reasonably required for the booking. The owner is responsible for additional reasonable expenses caused by insufficient supplies, undisclosed requirements or inaccurate instructions."
  },
  {
    title: "7. Collection and Extended Care",
    text: "The owner agrees to collect the dog at the agreed time. If the owner is delayed or cannot collect the dog, the owner is responsible for any agreed additional sitting fees and reasonable additional care expenses."
  },
  {
    title: "8. Permission to Follow Care Instructions",
    text: "The owner authorises the sitter to exercise reasonable judgment when carrying out the agreed feeding, walking, sleeping and care routine, including making minor adjustments where reasonably necessary for safety, weather, the dog’s wellbeing or circumstances outside the sitter’s control."
  },
  {
    title: "9. Indemnity",
    text: "To the extent permitted by law, the owner agrees to reimburse and indemnify the sitter for reasonable third-party claims, losses, liabilities and expenses arising from the dog’s actions or from material information the owner failed to disclose, except to the extent caused by the sitter’s negligence, wilful misconduct or other liability that cannot lawfully be excluded."
  },
  {
    title: "10. Agreement",
    text: "By signing below, the owner confirms that they have read and understood these terms and agree that they form part of the dog sitting arrangement."
  }
];


function getIntakeSheet_() {
  var mainSheet = getTargetSheet_();
  var spreadsheet = mainSheet.getParent();
  var properties = PropertiesService.getScriptProperties();
  var sheetName = String(
    properties.getProperty("INTAKE_SHEET_NAME") || "Dog_Intake_Records"
  ).trim();

  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getMaxColumns() < INTAKE_HEADERS_.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      INTAKE_HEADERS_.length - sheet.getMaxColumns()
    );
  }

  var needsHeaders = sheet.getLastRow() === 0;

  if (!needsHeaders) {
    var existing = sheet
      .getRange(1, 1, 1, INTAKE_HEADERS_.length)
      .getValues()[0];

    for (var i = 0; i < INTAKE_HEADERS_.length; i++) {
      if (String(existing[i] || "") !== INTAKE_HEADERS_[i]) {
        needsHeaders = true;
        break;
      }
    }
  }

  if (needsHeaders) {
    sheet
      .getRange(1, 1, 1, INTAKE_HEADERS_.length)
      .setValues([INTAKE_HEADERS_]);

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, INTAKE_HEADERS_.length)
      .setFontWeight("bold")
      .setBackground("#0d3550")
      .setFontColor("#ffffff");

    sheet.setColumnWidth(1, 155);
    sheet.setColumnWidth(2, 155);
    sheet.setColumnWidth(3, 155);
    sheet.setColumnWidth(4, 125);
    sheet.setColumnWidth(5, 250);
    sheet.setColumnWidth(6, 240);
    sheet.setColumnWidth(7, 145);
    sheet.setColumnWidth(8, 140);
    sheet.setColumnWidth(9, 140);
    sheet.setColumnWidth(10, 110);
    sheet.setColumnWidth(11, 110);
    sheet.setColumnWidth(12, 155);
    sheet.setColumnWidth(13, 140);
    sheet.setColumnWidth(14, 420);
    sheet.setColumnWidth(15, 220);
    sheet.setColumnWidth(16, 300);
    sheet.setColumnWidth(17, 220);
    sheet.setColumnWidth(18, 95);
  }

  return sheet;
}


function getIntakeRootFolder_() {
  var properties = PropertiesService.getScriptProperties();
  var configuredId = String(
    properties.getProperty("INTAKE_FOLDER_ID") || ""
  ).trim();

  if (configuredId) {
    try {
      return DriveApp.getFolderById(configuredId);
    } catch (_) {
      // Fall through and create a replacement folder.
    }
  }

  var folder = DriveApp.createFolder(
    "Waffle Boarding House - Dog Intake Forms"
  );

  properties.setProperty("INTAKE_FOLDER_ID", folder.getId());
  return folder;
}


function getIntakeDogFolder_(dogName) {
  var root = getIntakeRootFolder_();
  var safeName = String(dogName || "Dog")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 80) || "Dog";

  var matches = root.getFoldersByName(safeName);
  if (matches.hasNext()) return matches.next();

  return root.createFolder(safeName);
}


function makeIntakeToken_() {
  return (
    Utilities.getUuid().replace(/-/g, "") +
    Utilities.getUuid().replace(/-/g, "")
  );
}


function intakeRowToObject_(row, rowNumber) {
  row = Array.isArray(row) ? row : [];

  var intakeJson = {};
  if (String(row[13] || "").trim()) {
    try {
      intakeJson = JSON.parse(String(row[13]));
    } catch (_) {}
  }

  return {
    row: rowNumber || null,
    createdAt: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || ""),
    updatedAt: row[1] instanceof Date ? row[1].toISOString() : String(row[1] || ""),
    submittedAt: row[2] instanceof Date ? row[2].toISOString() : String(row[2] || ""),
    status: String(row[3] || ""),
    token: String(row[4] || ""),
    stayKey: String(row[5] || ""),
    bookingType: String(row[6] || ""),
    dogName: String(row[7] || ""),
    breed: String(row[8] || ""),
    startDate: normalizeDateValue_(row[9]),
    endDate: normalizeDateValue_(row[10]),
    ownerName: String(row[11] || ""),
    mobile: String(row[12] || ""),
    answers: intakeJson,
    pdfFileId: String(row[14] || ""),
    pdfUrl: String(row[15] || ""),
    signatureFileId: String(row[16] || ""),
    bookingRow: Number(row[17] || 0) || null
  };
}


function findIntakeRecordByToken_(sheet, token) {
  token = String(token || "").trim();
  if (!token || sheet.getLastRow() < 2) return null;

  var values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, INTAKE_HEADERS_.length)
    .getValues();

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][4] || "").trim() === token) {
      return intakeRowToObject_(values[i], i + 2);
    }
  }

  return null;
}


function findIntakeRecordByStayKey_(sheet, stayKey) {
  stayKey = String(stayKey || "").trim();
  if (!stayKey || sheet.getLastRow() < 2) return null;

  var values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, INTAKE_HEADERS_.length)
    .getValues();

  // Prefer the latest record if a stay ever acquired more than one token.
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][5] || "").trim() === stayKey) {
      return intakeRowToObject_(values[i], i + 2);
    }
  }

  return null;
}


function findIntakeBookingRow_(rows, dogName, startDate, endDate) {
  var targetDog = String(dogName || "").trim().toLowerCase();
  var targetStart = normalizeDateValue_(startDate);
  var targetEnd = normalizeDateValue_(endDate || startDate);

  for (var i = 1; i < rows.length; i++) {
    var rowDog = String(rows[i][1] || "").trim().toLowerCase();
    var rowType = String(rows[i][11] || "").trim().toLowerCase();
    var rowStart = normalizeDateValue_(rows[i][3]);
    var rowEnd = normalizeDateValue_(rows[i][4] || rows[i][3]);

    if (rowType === "meet & greet") continue;
    if (targetDog && rowDog !== targetDog) continue;
    if (targetStart && rowStart !== targetStart) continue;
    if (targetEnd && rowEnd !== targetEnd) continue;

    return i + 1;
  }

  return -1;
}


function createIntakeLinkForBooking_(mainSheet, rows, data) {
  var dogName = String(data.dogName || "").trim();
  var startDate = normalizeDateValue_(data.startDate);
  var endDate = normalizeDateValue_(data.endDate || data.startDate);

  if (!dogName || !startDate || !endDate) {
    throw new Error(
      "Dog Name, Start Date and End Date are required to create an intake link."
    );
  }

  var bookingRow = findIntakeBookingRow_(
    rows,
    dogName,
    startDate,
    endDate
  );

  if (bookingRow === -1) {
    throw new Error(
      "The booking could not be found. Sync the spreadsheet and try again."
    );
  }

  var booking = auditBookingSnapshotFromSheetRow_(
    mainSheet,
    bookingRow
  );

  var stayKey = makeGuestStayKey_(
    booking.dogName,
    booking.startDate,
    booking.endDate
  );

  var intakeSheet = getIntakeSheet_();
  var existing = findIntakeRecordByStayKey_(
    intakeSheet,
    stayKey
  );

  var token = existing ? existing.token : makeIntakeToken_();
  var now = new Date();

  if (existing) {
    intakeSheet.getRange(existing.row, 2).setValue(now);
    intakeSheet.getRange(existing.row, 6).setValue(stayKey);
    intakeSheet.getRange(existing.row, 7).setValue(booking.bookingType || "Boarding");
    intakeSheet.getRange(existing.row, 8).setValue(booking.dogName || "");
    intakeSheet.getRange(existing.row, 9).setValue(booking.breed || "");
    intakeSheet.getRange(existing.row, 10).setValue(booking.startDate || "");
    intakeSheet.getRange(existing.row, 11).setValue(booking.endDate || "");
    intakeSheet.getRange(existing.row, 12).setValue(booking.ownerName || "");
    intakeSheet.getRange(existing.row, 13).setValue(booking.phone || "");
    intakeSheet.getRange(existing.row, 18).setValue(bookingRow);
  } else {
    intakeSheet.appendRow([
      now,
      now,
      "",
      "Awaiting Owner",
      token,
      stayKey,
      booking.bookingType || "Boarding",
      booking.dogName || "",
      booking.breed || "",
      booking.startDate || "",
      booking.endDate || "",
      booking.ownerName || "",
      booking.phone || "",
      "",
      "",
      "",
      "",
      bookingRow
    ]);

    existing = findIntakeRecordByToken_(
      intakeSheet,
      token
    );
  }

  var baseUrl =
    getHostedIntakeBaseUrl_() ||
    String(data.intakeBaseUrl || "").trim();

  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error(
      "The deployed Apps Script Web App URL could not be determined."
    );
  }

  var record = findIntakeRecordByToken_(intakeSheet, token);

  logAuditEvent_({
    category: "Intake",
    action: existing && record.status === "Complete"
      ? "Intake Link Reopened"
      : "Intake Link Created",
    dogName: booking.dogName,
    bookingType: booking.bookingType || "Boarding",
    reference: stayKey,
    summary:
      "Electronic intake link prepared for " +
      booking.dogName +
      ".",
    changedFields: ["Intake Status"],
    after: {
      status: record.status,
      stayKey: stayKey
    },
    source: "Web App"
  });

  return {
    status: record.status || "Awaiting Owner",
    token: token,
    stayKey: stayKey,
    dogName: booking.dogName,
    startDate: booking.startDate,
    endDate: booking.endDate,
    submittedAt: record.submittedAt || "",
    pdfUrl: record.pdfUrl || "",
    link:
      baseUrl.replace(/[?#].*$/, "") +
      "?action=intake&token=" +
      encodeURIComponent(token)
  };
}


function getIntakeStatusRecords_(stayKeys, profileSummaries) {
  var requestedKeys =
    (Array.isArray(stayKeys)
      ? stayKeys
      : [])
      .map(function(key) {
        return String(key || "").trim();
      })
      .filter(Boolean);

  var requested = {};

  requestedKeys.forEach(function(key) {
    requested[key] = true;
  });

  var mainValues =
    getTargetSheet_()
      .getDataRange()
      .getValues();

  var targets = [];

  for (
    var rowIndex = 1;
    rowIndex < mainValues.length;
    rowIndex++
  ) {
    var row = mainValues[rowIndex];

    var bookingType =
      String(row[11] || "")
        .trim()
        .toLowerCase();

    if (
      bookingType === "meet & greet" ||
      bookingType === "potential stay"
    ) {
      continue;
    }

    var dogName =
      String(row[1] || "").trim();

    var startDate =
      normalizeDateValue_(row[3]);

    var endDate =
      normalizeDateValue_(
        row[4] || row[3]
      );

    if (
      !dogName ||
      !startDate ||
      !endDate
    ) {
      continue;
    }

    var stayKey =
      makeGuestStayKey_(
        dogName,
        startDate,
        endDate
      );

    if (
      requestedKeys.length &&
      !requested[stayKey]
    ) {
      continue;
    }

    targets.push({
      stayKey: stayKey,
      bookingRow: rowIndex + 1,
      dogName: dogName,
      breed:
        String(row[2] || "").trim(),
      startDate: startDate,
      endDate: endDate,
      ownerName:
        String(row[5] || "").trim(),
      mobile:
        String(row[6] || "").trim()
    });
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sameText(a, b) {
    var left = normalizeText(a);
    var right = normalizeText(b);

    return (
      !!left &&
      !!right &&
      left === right
    );
  }

  function phoneTail(value) {
    var digits =
      String(value || "")
        .replace(/\D/g, "");

    return digits
      ? digits.slice(-8)
      : "";
  }

  function samePhone(a, b) {
    var left = phoneTail(a);
    var right = phoneTail(b);

    return (
      !!left &&
      !!right &&
      left === right
    );
  }

  function scoreRecord(record, target) {
    var score = 0;

    if (
      Number(record.bookingRow || 0) ===
      Number(target.bookingRow || 0)
    ) {
      score += 120;
    }

    if (
      sameText(
        record.dogName,
        target.dogName
      )
    ) {
      score += 50;
    }

    if (
      record.startDate ===
        target.startDate &&
      record.endDate ===
        target.endDate
    ) {
      score += 70;
    } else {
      if (
        record.startDate ===
        target.startDate
      ) {
        score += 20;
      }

      if (
        record.endDate ===
        target.endDate
      ) {
        score += 20;
      }
    }

    if (
      sameText(
        record.ownerName,
        target.ownerName
      )
    ) {
      score += 25;
    }

    if (
      samePhone(
        record.mobile,
        target.mobile
      )
    ) {
      score += 25;
    }

    if (
      sameText(
        record.breed,
        target.breed
      )
    ) {
      score += 10;
    }

    return score;
  }

  function resolveCurrentStayKey(record) {
    if (
      record.stayKey &&
      (
        !requestedKeys.length ||
        requested[record.stayKey]
      )
    ) {
      return record.stayKey;
    }

    for (
      var i = 0;
      i < targets.length;
      i++
    ) {
      if (
        Number(record.bookingRow || 0) ===
        Number(targets[i].bookingRow || 0)
      ) {
        return targets[i].stayKey;
      }
    }

    var scored =
      targets
        .map(function(target) {
          return {
            stayKey: target.stayKey,
            score:
              scoreRecord(
                record,
                target
              )
          };
        })
        .sort(function(a, b) {
          return b.score - a.score;
        });

    if (!scored.length) {
      return "";
    }

    var best = scored[0];
    var runnerUp =
      scored.length > 1
        ? scored[1]
        : null;

    if (
      best.score >= 70 &&
      (
        !runnerUp ||
        best.score > runnerUp.score
      )
    ) {
      return best.stayKey;
    }

    return "";
  }

  var latestByKey = {};
  var sheet = getIntakeSheet_();

  if (sheet.getLastRow() >= 2) {
    var values =
      sheet
        .getRange(
          2,
          1,
          sheet.getLastRow() - 1,
          INTAKE_HEADERS_.length
        )
        .getValues();

    values.forEach(function(row, index) {
      var record =
        intakeRowToObject_(
          row,
          index + 2
        );

      var resolvedKey =
        resolveCurrentStayKey(
          record
        );

      if (!resolvedKey) return;

      var current =
        latestByKey[
          resolvedKey
        ];

      if (!current) {
        latestByKey[
          resolvedKey
        ] = record;
        return;
      }

      var currentComplete =
        String(
          current.status || ""
        ).toLowerCase() ===
          "complete";

      var nextComplete =
        String(
          record.status || ""
        ).toLowerCase() ===
          "complete";

      /*
       * A completed intake remains authoritative for the stay even if
       * another older Awaiting Owner row also exists.
       */
      if (
        nextComplete &&
        !currentComplete
      ) {
        latestByKey[
          resolvedKey
        ] = record;
        return;
      }

      if (
        nextComplete ===
          currentComplete &&
        String(
          record.updatedAt ||
          record.createdAt ||
          ""
        ) >
        String(
          current.updatedAt ||
          current.createdAt ||
          ""
        )
      ) {
        latestByKey[
          resolvedKey
        ] = record;
      }
    });
  }

  /*
   * The canonical profile remains authoritative evidence that a Digital
   * Intake was saved. Status reads are read-only in V8.1.
   */
  if (requestedKeys.length) {
    var profiles =
      Array.isArray(
        profileSummaries
      )
        ? profileSummaries
        : readBelongingsSummaryRecords_(
            getBelongingsSheet_(),
            requestedKeys
          );

    profiles.forEach(function(profile) {
      var source =
        String(
          profile
            .intakeAttributesSource ||
          ""
        )
          .trim()
          .toLowerCase();

      var hasStoredProfile =
        Number(
          profile.intakeFieldCount ||
          0
        ) > 0;

      if (
        source.indexOf(
          "digital intake"
        ) !== 0 ||
        !hasStoredProfile
      ) {
        return;
      }

      var existing =
        latestByKey[
          profile.stayKey
        ];

      if (
        existing &&
        String(
          existing.status || ""
        ).toLowerCase() ===
          "complete"
      ) {
        return;
      }

      latestByKey[
        profile.stayKey
      ] = {
        stayKey:
          profile.stayKey,
        status:
          "Complete",
        token:
          existing
            ? existing.token
            : "",
        dogName:
          profile.dogName,
        submittedAt:
          existing &&
          existing.submittedAt
            ? existing.submittedAt
            : profile.updatedAt,
        pdfUrl:
          existing
            ? existing.pdfUrl
            : "",
        storedProfileFallback:
          true
      };
    });
  }

  return Object.keys(
    latestByKey
  ).map(function(key) {
    var record =
      latestByKey[key];

    return {
      stayKey: key,
      status:
        record.status,
      token:
        record.token || "",
      dogName:
        record.dogName || "",
      submittedAt:
        record.submittedAt || "",
      pdfUrl:
        record.pdfUrl || "",
      storedProfileFallback:
        record.storedProfileFallback ===
          true
    };
  });
}


function verifyWaffleHouseDigitalIntakeDirectoryStatus() {
  var candidates =
    getLegacyBookingCandidates_();

  var stayKeys =
    candidates
      .map(function(candidate) {
        return candidate.stayKey;
      })
      .filter(Boolean);

  var statuses =
    getIntakeStatusRecords_(
      stayKeys
    );

  var profiles =
    readBelongingsRecords_(
      getBelongingsSheet_(),
      stayKeys
    );

  return {
    result: "success",
    currentStays:
      stayKeys.length,
    digitalStatusCount:
      statuses.length,
    digitalStatuses:
      statuses,
    storedProfiles:
      profiles.map(function(profile) {
        return {
          stayKey:
            profile.stayKey,
          dogName:
            profile.dogName,
          intakeAttributesSource:
            profile
              .intakeAttributesSource,
          intakeFieldCount:
            Object.values(
              profile
                .intakeAttributes ||
              {}
            )
              .filter(function(value) {
                return !!String(
                  value || ""
                ).trim();
              })
              .length
        };
      })
  };
}


function getIntakePrefill_(token) {
  var intakeSheet = getIntakeSheet_();
  var record = findIntakeRecordByToken_(intakeSheet, token);

  if (!record) {
    throw new Error(
      "This intake link is invalid or no longer exists."
    );
  }

  var mainSheet = getTargetSheet_();
  var rows = mainSheet.getDataRange().getValues();

  var bookingRow = findIntakeBookingRow_(
    rows,
    record.dogName,
    record.startDate,
    record.endDate
  );

  var booking = bookingRow === -1
    ? {
        dogName: record.dogName,
        breed: record.breed,
        startDate: record.startDate,
        endDate: record.endDate,
        ownerName: record.ownerName,
        phone: record.mobile,
        bookingType: record.bookingType
      }
    : auditBookingSnapshotFromSheetRow_(
        mainSheet,
        bookingRow
      );

  return {
    token: record.token,
    status: record.status,
    submittedAt: record.submittedAt,
    booking: booking,
    savedAnswers: record.answers || {}
  };
}


function normalizeIntakeYesNo_(value) {
  var text = String(value || "").trim().toLowerCase();

  if (text === "yes" || text === "true" || text === "y") {
    return true;
  }

  if (text === "no" || text === "false" || text === "n") {
    return false;
  }

  return null;
}


function hasMeaningfulIntakeText_(value) {
  var text = String(value || "").trim().toLowerCase();

  if (!text) return false;

  return ![
    "no",
    "none",
    "nil",
    "n/a",
    "na",
    "not applicable",
    "none known"
  ].includes(text);
}


function mergeIntakeNotes_(existingNotes, answers) {
  var lines = [];

  if (answers.age) lines.push("Age: " + answers.age);
  if (answers.weight) lines.push("Weight: " + answers.weight);
  if (answers.sex) lines.push("Sex: " + answers.sex);

  if (answers.medicalConditions) {
    lines.push("Medical: " + answers.medicalConditions);
  }

  if (answers.medicationInstructions) {
    lines.push("Medication: " + answers.medicationInstructions);
  }

  var feeding = [
    answers.foodBrandType,
    answers.feedingTimes,
    answers.foodAmount
  ].filter(Boolean).join(" · ");

  if (feeding) {
    lines.push("Feeding: " + feeding);
  }

  var walking = [
    answers.walksPerDay
      ? answers.walksPerDay + " walk(s)/day"
      : "",
    answers.walkDuration
  ].filter(Boolean).join(" · ");

  if (walking) {
    lines.push("Walking: " + walking);
  }

  if (answers.sleepLocation) {
    lines.push("Sleeps: " + answers.sleepLocation);
  }

  if (answers.canBeLeftAlone === "Yes" && answers.aloneDuration) {
    lines.push("Can be left alone: " + answers.aloneDuration);
  }

  if (answers.regularVetClinic) {
    var vet = answers.regularVetClinic;
    if (answers.vetPhone) vet += " (" + answers.vetPhone + ")";
    lines.push("Vet: " + vet);
  }

  if (normalizeIntakeYesNo_(answers.aggression) === true) {
    lines.push("Behaviour alert: aggression disclosed");
  }

  if (normalizeIntakeYesNo_(answers.foodAggression) === true) {
    lines.push("Behaviour alert: food aggression disclosed");
  }

  var intakeSummary = lines.length
    ? "Digital Intake: " + lines.join(" | ")
    : "";

  var existing = String(existingNotes || "").trim();

  if (!intakeSummary) return existing;
  if (!existing) return intakeSummary;

  // Replace an earlier generated Digital Intake suffix instead of duplicating it.
  var cleaned = existing.replace(
    /\s*\|\s*Digital Intake:.*$/i,
    ""
  ).trim();

  if (/^Digital Intake:/i.test(cleaned)) {
    cleaned = "";
  }

  return cleaned
    ? cleaned + " | " + intakeSummary
    : intakeSummary;
}


function ensureIntakeBelongingsFlags_(
  dogName,
  startDate,
  endDate,
  stayKey,
  riskFlags
) {
  var sheet = getBelongingsSheet_();
  var row = findBelongingsRow_(sheet, stayKey);

  if (row === -1) {
    var items = {};
    BELONGINGS_ITEM_CONFIG_.forEach(function(item) {
      items[item.key] = {
        present: false,
        description: ""
      };
    });

    row = upsertBelongingsRecord_(sheet, {
      stayKey: stayKey,
      dogName: dogName,
      startDate: startDate,
      endDate: endDate,
      items: items,
      riskFlags: riskFlags
    });
  } else {
    sheet.getRange(row, 1).setValue(new Date());
    sheet.getRange(row, 3).setValue(dogName);
    sheet.getRange(row, 4).setValue(startDate);
    sheet.getRange(row, 5).setValue(endDate);

    BELONGINGS_RISK_CONFIG_.forEach(function(flag, index) {
      sheet
        .getRange(row, 25 + index)
        .setValue(!!riskFlags[flag.key]);
    });
  }

  return row;
}


function intakeSubmissionHtmlResponse_(result, errorMessage) {
  var success = !String(errorMessage || "").trim();
  var dogName =
    result && result.dogName
      ? String(result.dogName)
      : "your dog";

  var safeDog = dogName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  var safeError = String(errorMessage || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  var logo =
    "data:image/png;base64," +
    INTAKE_LOGO_BASE64_;

  var html =
    '<!doctype html>' +
    '<html lang="en">' +
    '<head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Waffle Boarding House — Intake</title>' +
    '<style>' +
    'body{margin:0;background:#f3f6f8;color:#172033;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}' +
    '.page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;}' +
    '.card{width:min(520px,100%);box-sizing:border-box;padding:26px 22px;border:1px solid #dbe3ea;border-radius:16px;background:#fff;text-align:center;box-shadow:0 10px 35px rgba(15,23,42,.08);}' +
    '.logo{width:96px;height:96px;object-fit:contain;border-radius:50%;}' +
    'h1{margin:14px 0 8px;color:#0d3550;font-size:24px;line-height:1.12;}' +
    'p{margin:0 auto;color:#64748b;font-size:13px;line-height:1.55;max-width:430px;}' +
    '.status{display:inline-flex;align-items:center;justify-content:center;margin-top:18px;padding:8px 12px;border-radius:999px;font-size:11px;font-weight:850;}' +
    '.success{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;}' +
    '.error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}' +
    '.details{margin-top:14px;padding:11px;border-radius:9px;background:#f8fafc;color:#475569;font-size:11px;line-height:1.5;text-align:left;overflow-wrap:anywhere;}' +
    '.close{margin-top:18px;color:#64748b;font-size:10.5px;}' +
    '@media(max-width:520px){.page{align-items:flex-start;padding:12px 8px}.card{padding:22px 15px;border-radius:13px}.logo{width:78px;height:78px}h1{font-size:21px}}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<main class="page">' +
    '<section class="card">' +
    '<img class="logo" src="' + logo + '" alt="Waffle Boarding House">' +
    (
      success
        ? (
          '<h1>Intake submitted successfully</h1>' +
          '<p>Thank you. The intake for <strong>' +
          safeDog +
          '</strong> has been saved to Waffle Boarding House. The guest profile and Care &amp; Safety information have been updated and the signed PDF record has been created.</p>' +
          '<div class="status success">✓ Complete</div>' +
          '<div class="close">You can now close this page.</div>'
        )
        : (
          '<h1>Intake could not be submitted</h1>' +
          '<p>Your form reached Waffle Boarding House, but an error occurred while saving it.</p>' +
          '<div class="status error">Submission not completed</div>' +
          '<div class="details">' + safeError + '</div>' +
          '<div class="close">Please return to the intake form and try again, or contact Waffle Boarding House.</div>'
        )
    ) +
    '</section>' +
    '</main>' +
    '</body>' +
    '</html>';

  return HtmlService
    .createHtmlOutput(html)
    .setTitle("Waffle Boarding House — Intake");
}


function intakeLogoBlob_() {
  try {
    var bytes = Utilities.base64Decode(INTAKE_LOGO_BASE64_);
    return Utilities.newBlob(
      bytes,
      "image/png",
      "Waffle-Boarding-House-Logo.png"
    );
  } catch (_) {
    return null;
  }
}


function appendPdfKeyValueTable_(body, entries) {
  var rows = [];

  entries.forEach(function(entry) {
    if (!entry || !String(entry[1] || "").trim()) return;

    rows.push([
      String(entry[0] || ""),
      String(entry[1] || "")
    ]);
  });

  if (!rows.length) return;

  var table = body.appendTable(rows);

  for (var r = 0; r < table.getNumRows(); r++) {
    var row = table.getRow(r);

    row.getCell(0)
      .setBackgroundColor("#eef4f8")
      .editAsText()
      .setBold(true)
      .setForegroundColor("#0d3550");

    row.getCell(1)
      .editAsText()
      .setForegroundColor("#25364a");
  }

  body.appendParagraph("");
}


function buildIntakePdf_(
  booking,
  answers,
  signatureBlob,
  signatureName,
  submittedAt
) {
  var dogFolder = getIntakeDogFolder_(booking.dogName);

  var dateStamp = Utilities.formatDate(
    submittedAt,
    getTargetSheet_().getParent().getSpreadsheetTimeZone(),
    "yyyy-MM-dd"
  );

  var safeDog = String(booking.dogName || "Dog")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  var signatureNameSafe = safeDog + "_" + dateStamp + "_Signature.png";
  var signatureFile = dogFolder
    .createFile(signatureBlob.copyBlob())
    .setName(signatureNameSafe);

  var doc = DocumentApp.create(
    safeDog + " - Dog Intake Record - " + dateStamp
  );

  var body = doc.getBody();
  body.clear();

  var logoBlob = intakeLogoBlob_();
  if (logoBlob) {
    try {
      var logoImage = body.appendImage(logoBlob);
      logoImage.setWidth(110);
    } catch (_) {}
  }

  body.appendParagraph("WAFFLE BOARDING HOUSE")
    .setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setForegroundColor("#0d3550");

  body.appendParagraph("DOG SITTING INTAKE RECORD")
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setForegroundColor("#0d3550");

  body.appendParagraph(
    booking.dogName +
    " · " +
    (booking.breed || "Breed not provided") +
    " · " +
    booking.startDate +
    " to " +
    booking.endDate
  ).setForegroundColor("#4b6073");

  body.appendParagraph("");

  body.appendParagraph("1. Owner Details")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  appendPdfKeyValueTable_(body, [
    ["Owner Name", answers.ownerName],
    ["Mobile Number", answers.mobile],
    ["Emergency Contact", answers.emergencyContact],
    ["Emergency Phone", answers.emergencyPhone]
  ]);

  body.appendParagraph("2. Dog Information")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  appendPdfKeyValueTable_(body, [
    ["Dog’s Name", answers.dogName],
    ["Breed", answers.breed],
    ["Age", answers.age],
    ["Weight", answers.weight],
    ["Sex", answers.sex],
    ["Desexed", answers.desexed],
    ["Vaccinated", answers.vaccinated],
    ["Microchipped", answers.microchipped],
    ["Weight Management", answers.weightManagement]
  ]);

  body.appendParagraph("3. Behaviour & Personality")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  appendPdfKeyValueTable_(body, [
    ["Friendly with other dogs", answers.friendlyDogs],
    ["Friendly with cats", answers.friendlyCats],
    ["Friendly with children", answers.friendlyChildren],
    ["Friendly with strangers", answers.friendlyStrangers],
    ["Separation anxiety", answers.separationAnxiety],
    ["Aggression", answers.aggression],
    ["Food aggression", answers.foodAggression],
    ["Escape attempts", answers.escapeAttempts],
    ["Indoor accidents", answers.indoorAccidents],
    ["Chewing furniture", answers.chewingFurniture],
    ["Triggers or fears", answers.triggersFears]
  ]);

  body.appendParagraph("4. Feeding Instructions")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  appendPdfKeyValueTable_(body, [
    ["Food brand/type", answers.foodBrandType],
    ["Feeding times", answers.feedingTimes],
    ["Food amount", answers.foodAmount],
    ["Allowed treats", answers.allowedTreats],
    ["Food allergies", answers.foodAllergies]
  ]);

  body.appendParagraph("5. Walking Routine")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  appendPdfKeyValueTable_(body, [
    ["Walks per day", answers.walksPerDay],
    ["Walk duration", answers.walkDuration],
    ["Off-leash allowed", answers.offLeashAllowed],
    ["Pulls on leash", answers.pullsOnLeash]
  ]);

  body.appendParagraph("6. Medical Information")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  appendPdfKeyValueTable_(body, [
    ["Medical conditions", answers.medicalConditions],
    ["Medication instructions", answers.medicationInstructions],
    ["Regular vet clinic", answers.regularVetClinic],
    ["Vet phone number", answers.vetPhone]
  ]);

  body.appendParagraph("7. Sleeping & Home Routine")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  appendPdfKeyValueTable_(body, [
    ["Where does your dog sleep?", answers.sleepLocation],
    ["Crate trained", answers.crateTrained],
    ["Can be left alone", answers.canBeLeftAlone],
    ["If yes, for how long?", answers.aloneDuration]
  ]);

  body.appendPageBreak();

  body.appendParagraph("Agreement")
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setForegroundColor("#0d3550");

  body.appendParagraph(
    "I confirm that all information provided is accurate."
  );

  body.appendParagraph("Owner Signature:");
  var sigImage = body.appendImage(signatureBlob);
  sigImage.setWidth(230);

  appendPdfKeyValueTable_(body, [
    ["Owner Name", signatureName],
    [
      "Date",
      Utilities.formatDate(
        submittedAt,
        getTargetSheet_().getParent().getSpreadsheetTimeZone(),
        "d MMMM yyyy"
      )
    ]
  ]);

  body.appendPageBreak();

  body.appendParagraph("Dog Sitting Terms & Conditions")
    .setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setForegroundColor("#0d3550");

  body.appendParagraph(
    "These terms form part of the Dog Sitting Intake Form and clarify the responsibilities, expectations and arrangements between the owner and the dog sitter."
  );

  INTAKE_TERMS_.forEach(function(term) {
    body.appendParagraph(term.title)
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);

    body.appendParagraph(term.text);
  });

  body.appendParagraph("");
  body.appendParagraph(
    "Owner Name: " +
    signatureName +
    "    Dog’s Name: " +
    booking.dogName
  ).setBold(true);

  doc.saveAndClose();

  var tempDocFile = DriveApp.getFileById(doc.getId());

  var pdfName =
    dateStamp +
    "_" +
    safeDog.replace(/\s+/g, "_") +
    "_Intake.pdf";

  var pdfBlob = tempDocFile
    .getAs(MimeType.PDF)
    .setName(pdfName);

  var pdfFile = dogFolder.createFile(pdfBlob);

  try {
    tempDocFile.setTrashed(true);
  } catch (_) {}

  return {
    pdfFile: pdfFile,
    signatureFile: signatureFile
  };
}


function processIntakeSubmission_(data) {
  data = data && typeof data === "object" ? data : {};

  var token = String(data.token || "").trim();
  var answers =
    data.answers && typeof data.answers === "object"
      ? data.answers
      : {};

  var signatureData = String(data.signatureData || "");
  var signatureName = String(
    answers.signatureName ||
    answers.ownerName ||
    ""
  ).trim();

  if (!token) throw new Error("The intake token is missing.");
  if (!signatureName) throw new Error("Owner signature name is required.");
  if (!signatureData) throw new Error("An electronic signature is required.");

  if (
    answers.termsAccepted !== true &&
    String(answers.termsAccepted).toLowerCase() !== "true"
  ) {
    throw new Error(
      "The Terms & Conditions must be accepted before submission."
    );
  }

  var intakeSheet = getIntakeSheet_();
  var intakeRecord = findIntakeRecordByToken_(
    intakeSheet,
    token
  );

  if (!intakeRecord) {
    throw new Error(
      "This intake link is invalid or has expired."
    );
  }

  var mainSheet = getTargetSheet_();
  var rows = mainSheet.getDataRange().getValues();

  var bookingRow = findIntakeBookingRow_(
    rows,
    intakeRecord.dogName,
    intakeRecord.startDate,
    intakeRecord.endDate
  );

  if (bookingRow === -1) {
    throw new Error(
      "The matching booking could not be found. Please contact Waffle Boarding House."
    );
  }

  var bookingBefore = auditBookingSnapshotFromSheetRow_(
    mainSheet,
    bookingRow
  );

  var oldStayKey = makeGuestStayKey_(
    bookingBefore.dogName,
    bookingBefore.startDate,
    bookingBefore.endDate
  );

  var newDogName = String(
    answers.dogName || bookingBefore.dogName
  ).trim();

  var newBreed = String(
    answers.breed || bookingBefore.breed
  ).trim();

  var newOwner = String(
    answers.ownerName || bookingBefore.ownerName
  ).trim();

  var newMobile = String(
    answers.mobile || bookingBefore.phone
  ).trim();

  mainSheet.getRange(bookingRow, 2).setValue(newDogName);
  mainSheet.getRange(bookingRow, 3).setValue(newBreed);
  mainSheet.getRange(bookingRow, 6).setValue(newOwner);
  mainSheet.getRange(bookingRow, 7).setValue(newMobile);

  /*
   * Likes / Dislikes are legacy booking columns and are no longer managed
   * by the Waffle House Web App. Intake answers now live in the canonical
   * guest profile stored with Pet_Belongings.
   */

  SpreadsheetApp.flush();

  var bookingAfter = auditBookingSnapshotFromSheetRow_(
    mainSheet,
    bookingRow
  );

  var newStayKey = makeGuestStayKey_(
    bookingAfter.dogName,
    bookingAfter.startDate,
    bookingAfter.endDate
  );

  if (oldStayKey !== newStayKey) {
    migrateBelongingsIdentityForGuest_(
      mainSheet.getParent(),
      oldStayKey,
      newStayKey,
      bookingAfter.dogName
    );
  }

  var riskFlags = {
    escapeRisk:
      normalizeIntakeYesNo_(answers.escapeAttempts) === true,
    foodAllergy:
      hasMeaningfulIntakeText_(answers.foodAllergies),
    medicated:
      hasMeaningfulIntakeText_(answers.medicationInstructions),
    separationAnxiety:
      normalizeIntakeYesNo_(answers.separationAnxiety) === true,
    weightManagement:
      normalizeIntakeYesNo_(answers.weightManagement) === true
  };

  ensureIntakeBelongingsFlags_(
    bookingAfter.dogName,
    bookingAfter.startDate,
    bookingAfter.endDate,
    newStayKey,
    riskFlags
  );

  saveIntakeAttributesForStay_(
    bookingAfter.dogName,
    bookingAfter.startDate,
    bookingAfter.endDate,
    newStayKey,
    normalizeGuestIntakeAttributes_(
      answers
    ),
    "Digital Intake"
  );

  var signatureMatch = signatureData.match(
    /^data:image\/png;base64,(.+)$/i
  );

  if (!signatureMatch) {
    throw new Error(
      "The electronic signature image could not be decoded."
    );
  }

  var signatureBlob = Utilities.newBlob(
    Utilities.base64Decode(signatureMatch[1]),
    "image/png",
    "Owner-Signature.png"
  );

  var submittedAt = new Date();

  var pdfResult = buildIntakePdf_(
    bookingAfter,
    answers,
    signatureBlob,
    signatureName,
    submittedAt
  );

  var row = intakeRecord.row;

  intakeSheet.getRange(row, 2).setValue(submittedAt);
  intakeSheet.getRange(row, 3).setValue(submittedAt);
  intakeSheet.getRange(row, 4).setValue("Complete");
  intakeSheet.getRange(row, 6).setValue(newStayKey);
  intakeSheet.getRange(row, 7).setValue(bookingAfter.bookingType || "Boarding");
  intakeSheet.getRange(row, 8).setValue(bookingAfter.dogName || "");
  intakeSheet.getRange(row, 9).setValue(bookingAfter.breed || "");
  intakeSheet.getRange(row, 10).setValue(bookingAfter.startDate || "");
  intakeSheet.getRange(row, 11).setValue(bookingAfter.endDate || "");
  intakeSheet.getRange(row, 12).setValue(bookingAfter.ownerName || "");
  intakeSheet.getRange(row, 13).setValue(bookingAfter.phone || "");
  intakeSheet.getRange(row, 14).setValue(JSON.stringify(answers));
  intakeSheet.getRange(row, 15).setValue(pdfResult.pdfFile.getId());
  intakeSheet.getRange(row, 16).setValue(pdfResult.pdfFile.getUrl());
  intakeSheet.getRange(row, 17).setValue(pdfResult.signatureFile.getId());
  intakeSheet.getRange(row, 18).setValue(bookingRow);

  var changedFields = auditObjectChangedFields_(
    bookingBefore,
    bookingAfter,
    auditBookingFieldLabels_()
  );

  logAuditEvent_({
    category: "Intake",
    action: "Intake Submitted",
    dogName: bookingAfter.dogName,
    bookingType: bookingAfter.bookingType || "Boarding",
    reference: newStayKey,
    summary:
      "Signed digital intake submitted and PDF generated for " +
      bookingAfter.dogName +
      ".",
    changedFields: changedFields.concat([
      "Care & Safety",
      "Signed Intake PDF"
    ]),
    before: bookingBefore,
    after: {
      booking: bookingAfter,
      careFlags: riskFlags,
      intakeStatus: "Complete",
      pdfFileId: pdfResult.pdfFile.getId()
    },
    source: "External Intake Form"
  });

  touchWaffleDataVersion_(
    "directory"
  );

  notifyPushIntakeCompleted_(
    newStayKey,
    bookingAfter.dogName
  );

  return {
    result: "success",
    action: "submit_intake",
    status: "Complete",
    stayKey: newStayKey,
    dogName: bookingAfter.dogName,
    submittedAt: submittedAt.toISOString(),
    pdfFileId: pdfResult.pdfFile.getId(),
    pdfUrl: pdfResult.pdfFile.getUrl()
  };
}




function verifyWaffleHouseRelease() {
  var sheet = getTargetSheet_();
  var spreadsheet = sheet.getParent();
  var checks = [];

  function addCheck(name, callback) {
    try {
      var value = callback();
      checks.push({
        name: name,
        ok: true,
        value:
          value === undefined
            ? "OK"
            : value
      });
    } catch (error) {
      checks.push({
        name: name,
        ok: false,
        error:
          error &&
          error.message
            ? error.message
            : String(error)
      });
    }
  }

  addCheck(
    "Boarding database",
    function() {
      return (
        sheet.getName() +
        " · " +
        sheet.getLastRow() +
        " rows"
      );
    }
  );

  addCheck(
    "Pet_Belongings",
    function() {
      return getBelongingsSheet_().getName();
    }
  );

  addCheck(
    "Dog_Intake_Records",
    function() {
      return getIntakeSheet_().getName();
    }
  );

  addCheck(
    "Legacy_Intake_Documents",
    function() {
      return getLegacyIntakeSheet_().getName();
    }
  );

  addCheck(
    "Reminders_Notes",
    function() {
      return getRemindersNotesSheet_().getName();
    }
  );

  addCheck(
    "Audit Log",
    function() {
      return getAuditLogSheet_().getName();
    }
  );

  addCheck(
    "Intake Drive folder",
    function() {
      return getIntakeRootFolder_().getName();
    }
  );

  addCheck(
    "Belongings Drive folder",
    function() {
      return getBelongingsPhotoFolder_().getName();
    }
  );

  addCheck(
    "Gemini configuration",
    function() {
      var config =
        getGeminiLegacyIntakeConfig_();

      return config.apiKey
        ? (
            "Configured · " +
            config.model
          )
        : "Not configured";
    }
  );

  addCheck(
    "V9 Push notifications",
    function() {
      var verification =
        verifyWaffleHousePushNotifications();

      if (
        !verification.firebaseConfigured
      ) {
        return (
          "Setup required · " +
          verification.configError
        );
      }

      return (
        verification.activeDevices +
        " active device(s) · " +
        verification.triggerCount +
        " trigger(s)"
      );
    }
  );

  addCheck(
    "Script cache",
    function() {
      var cache =
        CacheService.getScriptCache();

      var key =
        "waffle_v83_release_test";

      cache.put(
        key,
        "ok",
        30
      );

      var value =
        cache.get(key);

      cache.remove(key);

      if (value !== "ok") {
        throw new Error(
          "CacheService write/read test failed."
        );
      }

      return "Available";
    }
  );

  var failed =
    checks.filter(function(check) {
      return !check.ok;
    });

  return {
    result:
      failed.length
        ? "warning"
        : "success",
    release:
      "hosted-intake-v11.0.4-shared-potential-stays",
    spreadsheetId:
      spreadsheet.getId(),
    spreadsheetName:
      spreadsheet.getName(),
    dataVersions:
      getWaffleDataVersions_(),
    checks: checks,
    passed:
      checks.length -
      failed.length,
    failed:
      failed.length
  };
}


function setupWaffleHouseIntake() {
  var sheet = getIntakeSheet_();
  var legacySheet = getLegacyIntakeSheet_();
  var folder = getIntakeRootFolder_();

  logAuditEvent_({
    category: "System",
    action: "Digital Intake Enabled",
    summary:
      "Digital intake storage and signed PDF folder are ready.",
    changedFields: ["Digital Intake"],
    source: "Apps Script Setup"
  });

  return {
    result: "success",
    sheetName: sheet.getName(),
    legacySheetName: legacySheet.getName(),
    folderName: folder.getName(),
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    message:
      "Waffle Boarding House Digital Intake is ready."
  };
}


function verifyWaffleHouseIntake() {
  var sheet = getIntakeSheet_();
  var legacySheet = getLegacyIntakeSheet_();
  var folder = getIntakeRootFolder_();

  return {
    result: "success",
    sheetName: sheet.getName(),
    recordCount: Math.max(0, sheet.getLastRow() - 1),
    legacyRecordCount:
      Math.max(
        0,
        legacySheet.getLastRow() - 1
      ),
    legacySheetName: legacySheet.getName(),
    folderName: folder.getName(),
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    paidAiEnabled: false,
    geminiLegacyIntake: {
      configured:
        !!getGeminiLegacyIntakeConfig_()
          .apiKey,
      model:
        getGeminiLegacyIntakeConfig_()
          .model,
      mode:
        "Gemini Developer API Free Tier / user-managed project"
    }
  };
}



var BELONGINGS_ITEM_CONFIG_ = [
  { key: "waterBowls", label: "Water Bowls" },
  { key: "foodBowls", label: "Food Bowls" },
  { key: "blankets", label: "Blankets" },
  { key: "beds", label: "Beds" },
  { key: "petCrates", label: "Pet Crates" },
  { key: "toys", label: "Toys" },
  { key: "leadsHarnesses", label: "Leads / Harnesses" },
  { key: "medication", label: "Medication" },
  { key: "other", label: "Other" }
];


var BELONGINGS_RISK_CONFIG_ = [
  { key: "escapeRisk", label: "Escape Risk" },
  { key: "foodAllergy", label: "Food Allergy" },
  { key: "medicated", label: "Medicated" },
  { key: "separationAnxiety", label: "Separation Anxiety" },
  { key: "weightManagement", label: "Weight Management" }
];


var INTAKE_ATTRIBUTE_CONFIG_ = [
  { key: "emergencyContact", label: "Emergency Contact" },
  { key: "emergencyPhone", label: "Emergency Phone" },
  { key: "age", label: "Age" },
  { key: "weight", label: "Weight" },
  { key: "sex", label: "Sex" },
  { key: "desexed", label: "Desexed" },
  { key: "vaccinated", label: "Vaccinated" },
  { key: "microchipped", label: "Microchipped" },
  { key: "weightManagement", label: "Weight Management" },
  { key: "friendlyDogs", label: "Friendly with Dogs" },
  { key: "friendlyCats", label: "Friendly with Cats" },
  { key: "friendlyChildren", label: "Friendly with Children" },
  { key: "friendlyStrangers", label: "Friendly with Strangers" },
  { key: "separationAnxiety", label: "Separation Anxiety" },
  { key: "aggression", label: "Aggression" },
  { key: "foodAggression", label: "Food Aggression" },
  { key: "escapeAttempts", label: "Escape Attempts" },
  { key: "indoorAccidents", label: "Indoor Accidents" },
  { key: "chewingFurniture", label: "Chewing Furniture" },
  { key: "triggersFears", label: "Triggers or Fears" },
  { key: "foodBrandType", label: "Food Brand / Type" },
  { key: "feedingTimes", label: "Feeding Times" },
  { key: "foodAmount", label: "Food Amount" },
  { key: "allowedTreats", label: "Allowed Treats" },
  { key: "foodAllergies", label: "Food Allergies" },
  { key: "walksPerDay", label: "Walks per Day" },
  { key: "walkDuration", label: "Walk Duration" },
  { key: "offLeashAllowed", label: "Off-Leash Allowed" },
  { key: "pullsOnLeash", label: "Pulls on Leash" },
  { key: "medicalConditions", label: "Medical Conditions" },
  { key: "medicationInstructions", label: "Medication Instructions" },
  { key: "regularVetClinic", label: "Regular Vet Clinic" },
  { key: "vetPhone", label: "Vet Phone" },
  { key: "sleepLocation", label: "Where Dog Sleeps" },
  { key: "crateTrained", label: "Crate Trained" },
  { key: "canBeLeftAlone", label: "Can Be Left Alone" },
  { key: "aloneDuration", label: "If Yes, How Long?" }
];


function normalizeGuestIntakeAttributes_(source) {
  source =
    source &&
    typeof source === "object"
      ? source
      : {};

  var result = {};

  INTAKE_ATTRIBUTE_CONFIG_
    .forEach(function(field) {
      var value =
        source[field.key];

      if (
        value === null ||
        value === undefined
      ) {
        value = "";
      }

      if (
        typeof value ===
        "boolean"
      ) {
        value =
          value
            ? "Yes"
            : "No";
      }

      var text =
        String(value)
          .trim()
          .substring(
            0,
            4000
          );

      result[field.key] =
        text;
    });

  return result;
}


function parseIntakeAttributesJson_(value) {
  if (!value) return {};

  try {
    return normalizeGuestIntakeAttributes_(
      typeof value === "string"
        ? JSON.parse(value)
        : value
    );
  } catch (_) {
    return {};
  }
}


function hasStoredIntakeAttributes_(attributes) {
  attributes =
    attributes &&
    typeof attributes === "object"
      ? attributes
      : {};

  return Object.keys(attributes)
    .some(function(key) {
      return !!String(
        attributes[key] || ""
      ).trim();
    });
}


function geminiChoiceToIntakeValue_(value) {
  var choice =
    String(value || "")
      .trim()
      .toLowerCase();

  if (choice === "yes") return "Yes";
  if (choice === "no") return "No";
  return "";
}


function legacyParsedFieldsToIntakeAttributes_(parsed) {
  parsed =
    parsed &&
    typeof parsed === "object"
      ? parsed
      : {};

  /*
   * Gemini extraction uses profile/care/details. Older Legacy Intake
   * parsers used a flatter object. Support both so historical PDFs can
   * be backfilled into the new Guest Directory profile automatically.
   */
  if (
    parsed.profile ||
    parsed.details ||
    parsed.care
  ) {
    var profile =
      parsed.profile &&
      typeof parsed.profile === "object"
        ? parsed.profile
        : {};

    var details =
      parsed.details &&
      typeof parsed.details === "object"
        ? parsed.details
        : {};

    var care =
      parsed.care &&
      typeof parsed.care === "object"
        ? parsed.care
        : {};

    return normalizeGuestIntakeAttributes_({
      emergencyContact:
        details.emergencyContact,
      emergencyPhone:
        details.emergencyPhone,
      age:
        details.age,
      weight:
        details.weight,
      sex:
        details.sex,
      desexed:
        geminiChoiceToIntakeValue_(
          details.desexed
        ),
      vaccinated:
        geminiChoiceToIntakeValue_(
          details.vaccinated
        ),
      microchipped:
        geminiChoiceToIntakeValue_(
          details.microchipped
        ),
      weightManagement:
        geminiChoiceToIntakeValue_(
          care.weightManagement
        ),
      friendlyDogs:
        geminiChoiceToIntakeValue_(
          details.friendlyDogs
        ),
      friendlyCats:
        geminiChoiceToIntakeValue_(
          details.friendlyCats
        ),
      friendlyChildren:
        geminiChoiceToIntakeValue_(
          details.friendlyChildren
        ),
      friendlyStrangers:
        geminiChoiceToIntakeValue_(
          details.friendlyStrangers
        ),
      separationAnxiety:
        geminiChoiceToIntakeValue_(
          care.separationAnxiety
        ),
      aggression:
        geminiChoiceToIntakeValue_(
          details.aggression
        ),
      foodAggression:
        geminiChoiceToIntakeValue_(
          details.foodAggression
        ),
      escapeAttempts:
        geminiChoiceToIntakeValue_(
          care.escapeRisk
        ),
      indoorAccidents:
        geminiChoiceToIntakeValue_(
          details.indoorAccidents
        ),
      chewingFurniture:
        geminiChoiceToIntakeValue_(
          details.chewingFurniture
        ),
      triggersFears:
        details.triggersFears,
      foodBrandType:
        details.foodBrandType,
      feedingTimes:
        details.feedingTimes,
      foodAmount:
        details.foodAmount,
      allowedTreats:
        geminiChoiceToIntakeValue_(
          details.allowedTreats
        ),
      foodAllergies:
        details.foodAllergies,
      walksPerDay:
        details.walksPerDay,
      walkDuration:
        details.walkDuration,
      offLeashAllowed:
        geminiChoiceToIntakeValue_(
          details.offLeashAllowed
        ),
      pullsOnLeash:
        geminiChoiceToIntakeValue_(
          details.pullsOnLeash
        ),
      medicalConditions:
        details.medicalConditions,
      medicationInstructions:
        details.medicationInstructions,
      regularVetClinic:
        details.regularVetClinic,
      vetPhone:
        details.vetPhone,
      sleepLocation:
        details.sleepLocation,
      crateTrained:
        geminiChoiceToIntakeValue_(
          details.crateTrained
        ),
      canBeLeftAlone:
        geminiChoiceToIntakeValue_(
          details.canBeLeftAlone
        ),
      aloneDuration:
        details.aloneDuration
    });
  }

  var flat = {};

  INTAKE_ATTRIBUTE_CONFIG_
    .forEach(function(field) {
      flat[field.key] =
        parsed[field.key];
    });

  if (!flat.escapeAttempts) {
    flat.escapeAttempts =
      parsed.escapeRisk;
  }

  if (!flat.weightManagement) {
    flat.weightManagement =
      parsed.weightManagement;
  }

  return normalizeGuestIntakeAttributes_(
    flat
  );
}


function saveIntakeAttributesForStay_(
  dogName,
  startDate,
  endDate,
  stayKey,
  attributes,
  source
) {
  var sheet =
    getBelongingsSheet_();

  var normalized =
    normalizeGuestIntakeAttributes_(
      attributes
    );

  var row =
    findBelongingsRow_(
      sheet,
      stayKey
    );

  if (row === -1) {
    var items = {};

    BELONGINGS_ITEM_CONFIG_
      .forEach(function(item) {
        items[item.key] = {
          present: false,
          description: ""
        };
      });

    row =
      upsertBelongingsRecord_(
        sheet,
        {
          stayKey:
            stayKey,
          dogName:
            dogName,
          startDate:
            startDate,
          endDate:
            endDate,
          items:
            items,
          riskFlags:
            {},
          intakeAttributes:
            normalized,
          intakeAttributesSource:
            source || ""
        }
      );
  } else {
    sheet
      .getRange(
        row,
        1
      )
      .setValue(
        new Date()
      );

    sheet
      .getRange(
        row,
        3
      )
      .setValue(
        dogName || ""
      );

    sheet
      .getRange(
        row,
        4
      )
      .setValue(
        normalizeDateValue_(
          startDate
        )
      );

    sheet
      .getRange(
        row,
        5
      )
      .setValue(
        normalizeDateValue_(
          endDate
        )
      );

    sheet
      .getRange(
        row,
        31
      )
      .setValue(
        JSON.stringify(
          normalized
        )
      );

    sheet
      .getRange(
        row,
        32
      )
      .setValue(
        String(
          source || ""
        )
      );
  }

  touchWaffleDataVersion_(
    "directory"
  );

  return row;
}


function syncCoreBookingFieldsToIntakeAttributes_(
  stayKey,
  booking
) {
  booking =
    booking &&
    typeof booking === "object"
      ? booking
      : {};

  var sheet =
    getBelongingsSheet_();

  var row =
    findBelongingsRow_(
      sheet,
      stayKey
    );

  if (row === -1) return false;

  /*
   * Owner/mobile/dog/breed remain stored in the booking sheet and are
   * shown at the top of the Guest Directory card. The profile JSON stores
   * the remaining intake attributes only, so there is no duplicate source
   * of truth to update here.
   */
  sheet
    .getRange(
      row,
      1
    )
    .setValue(
      new Date()
    );

  return true;
}


function migrateWaffleHouseHistoricalIntakeProfiles() {
  var candidates =
    getLegacyBookingCandidates_();

  var stayKeys =
    candidates
      .map(function(candidate) {
        return String(
          candidate &&
          candidate.stayKey
            ? candidate.stayKey
            : ""
        ).trim();
      })
      .filter(Boolean);

  var lock =
    LockService
      .getScriptLock();

  if (!lock.tryLock(30000)) {
    throw new Error(
      "Another update is running. Try the migration again when the Web App is quiet."
    );
  }

  try {
    ensureStoredIntakeAttributesForStayKeys_(
      stayKeys
    );

    return {
      result: "success",
      checkedStays:
        stayKeys.length,
      message:
        "Historical intake profiles migrated. Normal Guest Directory loading remains read-only."
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (_) {}
  }
}


function ensureStoredIntakeAttributesForStayKeys_(stayKeys) {
  stayKeys =
    (Array.isArray(stayKeys)
      ? stayKeys
      : [])
      .map(function(key) {
        return String(
          key || ""
        ).trim();
      })
      .filter(Boolean);

  if (!stayKeys.length) return;

  var belongingsSheet =
    getBelongingsSheet_();

  var existing = {};

  if (
    belongingsSheet.getLastRow() >= 2
  ) {
    var existingValues =
      belongingsSheet
        .getRange(
          2,
          1,
          belongingsSheet.getLastRow() - 1,
          getBelongingsHeaders_().length
        )
        .getValues();

    existingValues
      .forEach(function(row, index) {
        var key =
          String(
            row[1] || ""
          ).trim();

        if (!key) return;

        existing[key] = {
          row:
            index + 2,
          attributes:
            parseIntakeAttributesJson_(
              row[30]
            )
        };
      });
  }

  var mainSheet =
    getTargetSheet_();

  var mainRows =
    mainSheet
      .getDataRange()
      .getValues();

  var intakeSheet =
    getIntakeSheet_();

  var legacySheet =
    getLegacyIntakeSheet_();

  stayKeys.forEach(
    function(stayKey) {
      if (
        existing[stayKey] &&
        hasStoredIntakeAttributes_(
          existing[stayKey]
            .attributes
        )
      ) {
        return;
      }

      var bookingMatch =
        findBookingByStayKey_(
          mainRows,
          stayKey
        );

      if (!bookingMatch) {
        return;
      }

      var attributes = null;
      var source = "";

      var digital =
        findIntakeRecordByStayKey_(
          intakeSheet,
          stayKey
        );

      if (
        digital &&
        String(
          digital.status || ""
        ).toLowerCase() ===
          "complete" &&
        digital.answers
      ) {
        attributes =
          normalizeGuestIntakeAttributes_(
            digital.answers
          );

        source =
          "Digital Intake";
      }

      if (
        !attributes ||
        !hasStoredIntakeAttributes_(
          attributes
        )
      ) {
        var legacyStatuses =
          getLegacyIntakeStatusRecords_([
            stayKey
          ]);

        if (
          legacyStatuses.length &&
          legacyStatuses[0].latest &&
          legacyStatuses[0].latest
            .documentId
        ) {
          var legacyRecord =
            findLegacyIntakeDocumentById_(
              legacySheet,
              legacyStatuses[0]
                .latest
                .documentId
            );

          if (
            legacyRecord &&
            legacyRecord.parsedFields
          ) {
            var legacyAttributes =
              legacyParsedFieldsToIntakeAttributes_(
                legacyRecord.parsedFields
              );

            if (
              hasStoredIntakeAttributes_(
                legacyAttributes
              )
            ) {
              attributes =
                legacyAttributes;

              source =
                legacyRecord.extractionMethod
                  ? "Legacy Intake · " +
                    legacyRecord
                      .extractionMethod
                  : "Legacy Intake";
            }
          }
        }
      }

      if (
        attributes &&
        hasStoredIntakeAttributes_(
          attributes
        )
      ) {
        saveIntakeAttributesForStay_(
          bookingMatch.record
            .dogName,
          bookingMatch.record
            .startDate,
          bookingMatch.record
            .endDate,
          stayKey,
          attributes,
          source
        );
      }
    }
  );
}




function getBelongingsHeaders_() {
  var headers = ["Updated At", "Stay Key", "Dog Name", "Start Date", "End Date"];

  BELONGINGS_ITEM_CONFIG_.forEach(function(item) {
    headers.push(item.label);
    headers.push(item.label + " Description");
  });

  // Column 24 intentionally remains Photos JSON for backwards compatibility.
  headers.push("Photos JSON");

  BELONGINGS_RISK_CONFIG_.forEach(function(flag) {
    headers.push(flag.label);
  });

  // Column 30 - one profile photo for this dog/stay.
  headers.push("Dog Photo JSON");

  // Column 31 - canonical full intake/profile attributes.
  headers.push("Intake Attributes JSON");

  // Column 32 - source of the canonical profile (Digital Intake, Legacy Intake, Web App).
  headers.push("Intake Attributes Source");

  // Column 33 - historical dog profile photo gallery.
  headers.push("Dog Photo Gallery JSON");

  // Column 34 - general stay media / stay photo timeline.
  headers.push("Stay Photos JSON");

  return headers;
}


function getBelongingsSheet_() {
  var mainSheet = getTargetSheet_();
  var spreadsheet = mainSheet.getParent();
  var properties = PropertiesService.getScriptProperties();
  var sheetName = String(properties.getProperty("BELONGINGS_SHEET_NAME") || "Pet_Belongings").trim();

  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  var headers = getBelongingsHeaders_();

  // Care/safety flags, Dog Photo JSON and the canonical intake profile extend the sheet to 32 columns.
  // Existing Pet_Belongings sheets are expanded automatically.
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      headers.length - sheet.getMaxColumns()
    );
  }

  var currentHeaders = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, headers.length).getValues()[0]
    : [];

  var needsHeaders = currentHeaders.length !== headers.length;
  if (!needsHeaders) {
    for (var i = 0; i < headers.length; i++) {
      if (String(currentHeaders[i] || "") !== headers[i]) {
        needsHeaders = true;
        break;
      }
    }
  }

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}


function validateBelongingsPayload_(data) {
  if (!String(data.stayKey || "").trim()) throw new Error("Stay Key is required.");
  if (!String(data.dogName || "").trim()) throw new Error("Dog Name is required.");
  if (!String(data.startDate || "").trim()) throw new Error("Start Date is required.");
  if (!String(data.endDate || "").trim()) throw new Error("End Date is required.");
}


function findBelongingsRow_(sheet, stayKey) {
  var targetKey = String(stayKey || "").trim();
  if (!targetKey || sheet.getLastRow() < 2) return -1;

  var values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === targetKey) {
      return i + 2;
    }
  }

  return -1;
}


function normalizeBelongingsItems_(items) {
  var source = items && typeof items === "object" ? items : {};
  var normalized = {};

  BELONGINGS_ITEM_CONFIG_.forEach(function(item) {
    var input = source[item.key] && typeof source[item.key] === "object" ? source[item.key] : {};
    normalized[item.key] = {
      present: input.present === true || String(input.present).toLowerCase() === "true",
      description: String(input.description || "").trim()
    };
  });

  return normalized;
}




function readBelongingsItemsFromRow_(
  sheet,
  row
) {
  var items = {};

  if (!row || row < 2) {
    return normalizeBelongingsItems_({});
  }

  var values =
    sheet
      .getRange(
        row,
        6,
        1,
        18
      )
      .getValues()[0];

  BELONGINGS_ITEM_CONFIG_
    .forEach(function(item, index) {
      var baseIndex =
        index * 2;

      items[item.key] = {
        present:
          values[baseIndex] === true ||
          String(values[baseIndex])
            .toLowerCase() ===
            "true",
        description:
          String(
            values[
              baseIndex + 1
            ] ||
            ""
          ).trim()
      };
    });

  return normalizeBelongingsItems_(
    items
  );
}


function normalizeBelongingsRiskFlags_(riskFlags, fallbackFlags) {
  var source =
    riskFlags && typeof riskFlags === "object"
      ? riskFlags
      : null;

  var fallback =
    fallbackFlags && typeof fallbackFlags === "object"
      ? fallbackFlags
      : {};

  var normalized = {};

  BELONGINGS_RISK_CONFIG_.forEach(function(flag) {
    if (
      source &&
      Object.prototype.hasOwnProperty.call(source, flag.key)
    ) {
      normalized[flag.key] =
        source[flag.key] === true ||
        String(source[flag.key]).toLowerCase() === "true";
    } else {
      normalized[flag.key] =
        fallback[flag.key] === true ||
        String(fallback[flag.key]).toLowerCase() === "true";
    }
  });

  return normalized;
}


function readBelongingsRiskFlagsFromRow_(sheet, row) {
  var flags = {};

  if (!row || row < 2 || sheet.getMaxColumns() < 29) {
    BELONGINGS_RISK_CONFIG_.forEach(function(flag) {
      flags[flag.key] = false;
    });
    return flags;
  }

  var values = sheet.getRange(row, 25, 1, 5).getValues()[0];

  BELONGINGS_RISK_CONFIG_.forEach(function(flag, index) {
    flags[flag.key] =
      values[index] === true ||
      String(values[index]).toLowerCase() === "true";
  });

  return flags;
}


function upsertBelongingsRecord_(sheet, data) {
  var stayKey = String(data.stayKey || "").trim();
  var row = findBelongingsRow_(sheet, stayKey);
  var existingItems =
    normalizeBelongingsItems_(
      {}
    );
  var existingPhotos = [];
  var existingRiskFlags = {};
  var existingDogPhoto = "";
  var existingIntakeAttributes = {};
  var existingIntakeSource = "";
  var existingDogPhotoGallery = [];
  var existingStayPhotos = [];

  if (row !== -1) {
    existingItems =
      readBelongingsItemsFromRow_(
        sheet,
        row
      );

    existingPhotos =
      parsePhotosJson_(
        sheet
          .getRange(
            row,
            24
          )
          .getValue()
      );

    existingRiskFlags =
      readBelongingsRiskFlagsFromRow_(
        sheet,
        row
      );

    existingDogPhoto =
      String(
        sheet
          .getRange(
            row,
            30
          )
          .getValue() ||
        ""
      );

    existingIntakeAttributes =
      parseIntakeAttributesJson_(
        sheet
          .getRange(
            row,
            31
          )
          .getValue()
      );

    existingIntakeSource =
      String(
        sheet
          .getRange(
            row,
            32
          )
          .getValue() ||
        ""
      );

    if (sheet.getMaxColumns() >= 33) {
      existingDogPhotoGallery =
        parseV108DogPhotoGalleryJson_(
          sheet.getRange(row, 33).getValue()
        );
    }
    if (sheet.getMaxColumns() >= 34) {
      existingStayPhotos = parseStayPhotosJson_(sheet.getRange(row, 34).getValue());
    }
  }

  var hasIncomingItems =
    data.items &&
    typeof data.items ===
      "object";

  var items =
    hasIncomingItems
      ? normalizeBelongingsItems_(
          data.items
        )
      : existingItems;

  var riskFlags =
    normalizeBelongingsRiskFlags_(
      data.riskFlags,
      existingRiskFlags
    );

  var hasIncomingAttributes =
    data.intakeAttributes &&
    typeof data.intakeAttributes ===
      "object";

  var intakeAttributes =
    hasIncomingAttributes
      ? normalizeGuestIntakeAttributes_(
          data.intakeAttributes
        )
      : existingIntakeAttributes;

  var intakeSource =
    hasIncomingAttributes
      ? String(
          data.intakeAttributesSource ||
          "Web App"
        )
      : existingIntakeSource;

  var rowData = [
    new Date(),
    stayKey,
    String(data.dogName || "").trim(),
    normalizeDateValue_(data.startDate),
    normalizeDateValue_(data.endDate)
  ];

  BELONGINGS_ITEM_CONFIG_
    .forEach(function(item) {
      rowData.push(
        items[item.key].present
      );

      rowData.push(
        items[item.key]
          .description
      );
    });

  rowData.push(
    JSON.stringify(
      existingPhotos
    )
  );

  BELONGINGS_RISK_CONFIG_
    .forEach(function(flag) {
      rowData.push(
        riskFlags[flag.key]
      );
    });

  rowData.push(
    existingDogPhoto
  );

  rowData.push(
    JSON.stringify(
      intakeAttributes
    )
  );

  rowData.push(
    intakeSource
  );

  rowData.push(
    JSON.stringify(
      normalizeV108DogPhotoGallery_(
        existingDogPhotoGallery,
        parseDogPhotoJson_(existingDogPhoto)
      )
    )
  );
  rowData.push(JSON.stringify(existingStayPhotos));

  if (row === -1) {
    sheet.appendRow(
      rowData
    );

    row =
      sheet.getLastRow();
  } else {
    sheet
      .getRange(
        row,
        1,
        1,
        rowData.length
      )
      .setValues([
        rowData
      ]);
  }

  touchWaffleDataVersion_(
    "directory"
  );

  return row;
}


function readBelongingsRecords_(sheet, stayKeys) {
  if (
    sheet.getLastRow() <
    2
  ) {
    return [];
  }

  var requestedKeys = {};

  if (
    Array.isArray(stayKeys) &&
    stayKeys.length
  ) {
    stayKeys.forEach(
      function(key) {
        requestedKeys[
          String(
            key || ""
          ).trim()
        ] = true;
      }
    );
  }

  var columnCount =
    getBelongingsHeaders_()
      .length;

  var values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        columnCount
      )
      .getValues();

  var records = [];

  values.forEach(
    function(row) {
      var stayKey =
        String(
          row[1] || ""
        ).trim();

      if (!stayKey) return;

      if (
        Object.keys(
          requestedKeys
        ).length &&
        !requestedKeys[
          stayKey
        ]
      ) {
        return;
      }

      var items = {};
      var col = 5;

      BELONGINGS_ITEM_CONFIG_
        .forEach(function(item) {
          items[item.key] = {
            present:
              row[col] === true ||
              String(
                row[col]
              ).toLowerCase() ===
                "true",
            description:
              String(
                row[
                  col + 1
                ] || ""
              )
          };

          col += 2;
        });

      var riskFlags = {};

      BELONGINGS_RISK_CONFIG_
        .forEach(
          function(flag, index) {
            var value =
              row[
                24 + index
              ];

            riskFlags[
              flag.key
            ] =
              value === true ||
              String(value)
                .toLowerCase() ===
                "true";
          }
        );

      records.push({
        updatedAt:
          row[0] instanceof Date
            ? row[0].toISOString()
            : String(
                row[0] || ""
              ),
        stayKey:
          stayKey,
        dogName:
          String(
            row[2] || ""
          ),
        startDate:
          normalizeDateValue_(
            row[3]
          ),
        endDate:
          normalizeDateValue_(
            row[4]
          ),
        items:
          items,
        photos:
          parsePhotosJson_(
            row[23]
          ),
        riskFlags:
          riskFlags,
        dogPhoto:
          parseDogPhotoJson_(
            row[29]
          ),
        intakeAttributes:
          parseIntakeAttributesJson_(
            row[30]
          ),
        intakeAttributesSource:
          String(
            row[31] || ""
          ),
        dogPhotoGallery:
          parseV108DogPhotoGalleryJson_(
            row[32]
          ),
        stayPhotos:
          parseStayPhotosJson_(row[33])
      });
    }
  );

  return records;
}


function parsePhotosJson_(value) {
  if (!value) return [];

  try {
    var parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}


function parseDogPhotoJson_(value) {
  if (!value) return null;

  try {
    var parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch (error) {
    return null;
  }
}


/**
 * HTML-service photo uploader used inside an iframe on the GitHub web app.
 * The browser chooses/takes the image inside this Apps Script-hosted page and
 * google.script.run sends it directly to the server-side function below.
 */
function buildBelongingsPhotoUploaderHtml_(params) {
  params = params || {};

  var config = {
    stayKey: String(params.stayKey || ""),
    dogName: String(params.dogName || ""),
    startDate: String(params.startDate || ""),
    endDate: String(params.endDate || ""),
    photoLabel: String(params.photoLabel || ""),
    requestToken: String(params.requestToken || ""),
    mode: String(params.mode || "camera"),
    photoType: String(params.photoType || "belongings"),
    parentOrigin: "https://wafflepug.github.io"
  };

  var configJson =
    JSON.stringify(config)
      .replace(/</g, "\\u003c");

  var page = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    "<base target=\"_top\">",
    "<style>",
    "html,body{margin:0;padding:0;background:#111827;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;}",
    ".wrap{padding:16px;box-sizing:border-box;max-width:700px;margin:0 auto;}",
    "h2{font-size:20px;margin:0 0 5px;}",
    ".sub{font-size:13px;line-height:1.45;color:#cbd5e1;margin-bottom:14px;}",
    ".dogLine{font-size:11px;font-weight:800;color:#94a3b8;margin-bottom:14px;}",
    ".choices{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:13px;}",
    ".pick{display:flex;align-items:center;justify-content:center;text-align:center;min-height:52px;border-radius:10px;font-weight:900;cursor:pointer;padding:8px;box-sizing:border-box;}",
    ".camera{background:#7e22ce;color:white;}",
    ".library{background:#334155;color:white;}",
    ".pick input{display:none;}",
    "#cropWrap{display:none;margin:12px 0;}",
    ".cropFrame{width:min(100%,360px);margin:0 auto;border:2px solid #64748b;border-radius:14px;overflow:hidden;background:#0f172a;touch-action:none;}",
    "#cropCanvas{display:block;width:100%;aspect-ratio:1/1;cursor:grab;touch-action:none;}",
    "#cropCanvas:active{cursor:grabbing;}",
    ".cropHelp{font-size:11px;color:#cbd5e1;text-align:center;margin:8px 0 5px;}",
    ".zoomRow{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;font-size:11px;color:#cbd5e1;}",
    "#zoomRange{width:100%;}",
    "#previewGrid{display:none;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0;}",
    ".previewCard{position:relative;overflow:hidden;border:1px solid #475569;border-radius:9px;background:#0f172a;}",
    ".previewCard img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;}",
    ".previewCard span{position:absolute;right:5px;bottom:5px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(15,23,42,.82);font-size:10px;font-weight:900;}",
    ".label{display:block;font-size:12px;font-weight:800;color:#cbd5e1;margin:12px 0 5px;}",
    "#photoLabel{width:100%;box-sizing:border-box;padding:11px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:white;font-size:14px;}",
    "#status{min-height:24px;margin:12px 0;color:#cbd5e1;font-size:13px;font-weight:750;line-height:1.4;}",
    "#uploadBtn{width:100%;border:0;border-radius:10px;padding:13px;background:#16a34a;color:white;font-size:15px;font-weight:900;cursor:pointer;display:none;}",
    "#uploadBtn:disabled{opacity:.55;cursor:wait;}",
    ".small{font-size:10.5px;color:#94a3b8;margin-top:10px;line-height:1.45;}",
    "@media(max-width:520px){.wrap{padding:13px}.choices{grid-template-columns:1fr}.pick{min-height:48px}#previewGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    "</style>",
    "</head>",
    "<body>",
    "<div class=\"wrap\">",
    "<h2 id=\"uploaderTitle\">📷 Photo Manager</h2>",
    "<div class=\"sub\" id=\"uploaderSub\"></div>",
    "<div class=\"dogLine\" id=\"dogLine\"></div>",
    "<div class=\"choices\">",
    "<label class=\"pick camera\">📷 Take Photo<input id=\"cameraInput\" type=\"file\" accept=\"image/*\" capture=\"environment\"></label>",
    "<label class=\"pick library\">🖼️ Choose from Library<input id=\"libraryInput\" type=\"file\" accept=\"image/*\" multiple></label>",
    "</div>",
    "<div id=\"cropWrap\">",
    "<div class=\"cropFrame\"><canvas id=\"cropCanvas\" width=\"320\" height=\"320\" aria-label=\"Dog profile photo crop area\"></canvas></div>",
    "<div class=\"cropHelp\">Drag to reposition the dog inside the square.</div>",
    "<div class=\"zoomRow\"><span>−</span><input id=\"zoomRange\" type=\"range\" min=\"1\" max=\"2.5\" value=\"1\" step=\"0.02\" aria-label=\"Photo zoom\"><span>＋</span></div>",
    "</div>",
    "<div id=\"previewGrid\"></div>",
    "<div id=\"photoLabelWrap\">",
    "<label class=\"label\" for=\"photoLabel\">Photo note</label>",
    "<input id=\"photoLabel\" type=\"text\" placeholder=\"e.g. bowls, blanket and blue bed\">",
    "</div>",
    "<div id=\"status\">Choose or take a photo.</div>",
    "<button id=\"uploadBtn\" type=\"button\">☁️ Upload</button>",
    "<div class=\"small\">Photos are resized before upload. Dog profile photos are saved as a positioned square crop.</div>",
    "</div>",
    "<script>",
    "const CONFIG=" + configJson + ";",
    "",
    "const isDogProfile = CONFIG.photoType === \"dogProfile\";",
    "const isStayPhoto = CONFIG.photoType === \"stayPhoto\";",
    "const MAX_BELONGINGS_PHOTOS = 8;",
    "",
    "const statusEl = document.getElementById(\"status\");",
    "const uploadBtn = document.getElementById(\"uploadBtn\");",
    "const photoLabel = document.getElementById(\"photoLabel\");",
    "const photoLabelWrap = document.getElementById(\"photoLabelWrap\");",
    "const previewGrid = document.getElementById(\"previewGrid\");",
    "const cropWrap = document.getElementById(\"cropWrap\");",
    "const cropCanvas = document.getElementById(\"cropCanvas\");",
    "const cropCtx = cropCanvas.getContext(\"2d\", { alpha: false });",
    "const zoomRange = document.getElementById(\"zoomRange\");",
    "",
    "let selectedPhotos = [];",
    "let dogSourceImage = null;",
    "",
    "const cropState = {",
    "  zoom: 1,",
    "  panX: 0,",
    "  panY: 0,",
    "  dragging: false,",
    "  pointerId: null,",
    "  lastX: 0,",
    "  lastY: 0",
    "};",
    "",
    "document.getElementById(\"dogLine\").textContent =",
    "  (CONFIG.dogName || \"Current pet\") +",
    "  \" • \" +",
    "  (CONFIG.startDate || \"\") +",
    "  \" – \" +",
    "  (CONFIG.endDate || \"\");",
    "",
    "document.getElementById(\"uploaderTitle\").textContent =",
    "  isDogProfile",
    "    ? \"🐶 Position Dog Profile Photo\"",
    "    : \"📷 Add Belongings Photos\";",
    "",
    "document.getElementById(\"uploaderSub\").textContent =",
    "  isDogProfile",
    "    ? \"Choose a photo, drag it inside the square and zoom until the profile image looks right.\"",
    "    : \"Choose up to 8 photos in one selection, or take a photo with the camera.\";",
    "",
    "photoLabel.value =",
    "  CONFIG.photoLabel ||",
    "  (",
    "    isDogProfile",
    "      ? ((CONFIG.dogName || \"Dog\") + \" profile photo\")",
    "      : \"\"",
    "  );",
    "",
    "photoLabelWrap.style.display =",
    "  isDogProfile",
    "    ? \"none\"",
    "    : \"block\";",
    "",
    "uploadBtn.textContent =",
    "  isDogProfile",
    "    ? \"✅ Save Positioned Dog Photo\"",
    "    : \"☁️ Upload Photos\";",
    "",
    "function notifyParent(type, extra) {",
    "  try {",
    "    window.top.postMessage(",
    "      Object.assign(",
    "        {",
    "          type,",
    "          requestToken: CONFIG.requestToken,",
    "          stayKey: CONFIG.stayKey,",
    "          photoType: CONFIG.photoType",
    "        },",
    "        extra || {}",
    "      ),",
    "      CONFIG.parentOrigin",
    "    );",
    "  } catch (_) {}",
    "}",
    "",
    "function readAsDataUrl(file) {",
    "  return new Promise((resolve, reject) => {",
    "    const reader = new FileReader();",
    "    reader.onload = () => resolve(reader.result);",
    "    reader.onerror = () => reject(new Error(\"Unable to read the selected image.\"));",
    "    reader.readAsDataURL(file);",
    "  });",
    "}",
    "",
    "async function loadImageFromFile(file) {",
    "  if (",
    "    !file ||",
    "    !String(file.type || \"\").startsWith(\"image/\")",
    "  ) {",
    "    throw new Error(\"Please choose an image file.\");",
    "  }",
    "",
    "  const dataUrl = await readAsDataUrl(file);",
    "  const image = new Image();",
    "",
    "  await new Promise((resolve, reject) => {",
    "    image.onload = resolve;",
    "    image.onerror = () => reject(new Error(\"This image could not be opened.\"));",
    "    image.src = dataUrl;",
    "  });",
    "",
    "  return image;",
    "}",
    "",
    "function clamp(value, min, max) {",
    "  return Math.min(max, Math.max(min, value));",
    "}",
    "",
    "function getCropMetrics() {",
    "  if (!dogSourceImage) return null;",
    "",
    "  const size = cropCanvas.width;",
    "  const imageWidth = dogSourceImage.naturalWidth || dogSourceImage.width;",
    "  const imageHeight = dogSourceImage.naturalHeight || dogSourceImage.height;",
    "  const baseScale = Math.max(size / imageWidth, size / imageHeight);",
    "  const scale = baseScale * cropState.zoom;",
    "  const drawWidth = imageWidth * scale;",
    "  const drawHeight = imageHeight * scale;",
    "  const maxPanX = Math.max(0, (drawWidth - size) / 2);",
    "  const maxPanY = Math.max(0, (drawHeight - size) / 2);",
    "",
    "  cropState.panX = clamp(cropState.panX, -maxPanX, maxPanX);",
    "  cropState.panY = clamp(cropState.panY, -maxPanY, maxPanY);",
    "",
    "  return {",
    "    size,",
    "    imageWidth,",
    "    imageHeight,",
    "    scale,",
    "    drawWidth,",
    "    drawHeight",
    "  };",
    "}",
    "",
    "function drawDogCrop() {",
    "  const metrics = getCropMetrics();",
    "  if (!metrics) return;",
    "",
    "  cropCtx.fillStyle = \"#0f172a\";",
    "  cropCtx.fillRect(0, 0, metrics.size, metrics.size);",
    "",
    "  const x = (metrics.size - metrics.drawWidth) / 2 + cropState.panX;",
    "  const y = (metrics.size - metrics.drawHeight) / 2 + cropState.panY;",
    "",
    "  cropCtx.drawImage(",
    "    dogSourceImage,",
    "    x,",
    "    y,",
    "    metrics.drawWidth,",
    "    metrics.drawHeight",
    "  );",
    "}",
    "",
    "function exportDogCrop() {",
    "  const metrics = getCropMetrics();",
    "",
    "  if (!metrics) {",
    "    throw new Error(\"Choose a dog photo first.\");",
    "  }",
    "",
    "  const sourceSize = metrics.size / metrics.scale;",
    "  const sourceCenterX =",
    "    metrics.imageWidth / 2 -",
    "    cropState.panX / metrics.scale;",
    "  const sourceCenterY =",
    "    metrics.imageHeight / 2 -",
    "    cropState.panY / metrics.scale;",
    "",
    "  const sourceX = clamp(",
    "    sourceCenterX - sourceSize / 2,",
    "    0,",
    "    Math.max(0, metrics.imageWidth - sourceSize)",
    "  );",
    "",
    "  const sourceY = clamp(",
    "    sourceCenterY - sourceSize / 2,",
    "    0,",
    "    Math.max(0, metrics.imageHeight - sourceSize)",
    "  );",
    "",
    "  const output = document.createElement(\"canvas\");",
    "  output.width = 900;",
    "  output.height = 900;",
    "",
    "  const context = output.getContext(\"2d\", { alpha: false });",
    "",
    "  context.drawImage(",
    "    dogSourceImage,",
    "    sourceX,",
    "    sourceY,",
    "    sourceSize,",
    "    sourceSize,",
    "    0,",
    "    0,",
    "    900,",
    "    900",
    "  );",
    "",
    "  return output.toDataURL(\"image/jpeg\", 0.78);",
    "}",
    "",
    "async function compressBelongingsPhoto(file) {",
    "  const image = await loadImageFromFile(file);",
    "  const maxDimension = 1100;",
    "",
    "  const scale = Math.min(",
    "    1,",
    "    maxDimension /",
    "      Math.max(",
    "        image.naturalWidth,",
    "        image.naturalHeight",
    "      )",
    "  );",
    "",
    "  const width = Math.max(1, Math.round(image.naturalWidth * scale));",
    "  const height = Math.max(1, Math.round(image.naturalHeight * scale));",
    "",
    "  const canvas = document.createElement(\"canvas\");",
    "  canvas.width = width;",
    "  canvas.height = height;",
    "",
    "  const context = canvas.getContext(\"2d\", { alpha: false });",
    "  context.drawImage(image, 0, 0, width, height);",
    "",
    "  return canvas.toDataURL(\"image/jpeg\", 0.72);",
    "}",
    "",
    "function renderBelongingsPreviews() {",
    "  previewGrid.innerHTML =",
    "    selectedPhotos",
    "      .map(",
    "        (photo, index) => `",
    "          <div class=\"previewCard\">",
    "            <img src=\"${photo.data}\" alt=\"Selected photo ${index + 1}\">",
    "            <span>${index + 1}</span>",
    "          </div>",
    "        `",
    "      )",
    "      .join(\"\");",
    "",
    "  previewGrid.style.display =",
    "    selectedPhotos.length",
    "      ? \"grid\"",
    "      : \"none\";",
    "}",
    "",
    "async function prepareDogPhoto(file) {",
    "  notifyParent(",
    "    \"waffleBelongingsPhotoProgress\",",
    "    {",
    "      phase: \"preparing\",",
    "      current: 1,",
    "      total: 1,",
    "      message: \"Preparing dog profile photo…\"",
    "    }",
    "  );",
    "",
    "  statusEl.textContent = \"⏳ Preparing dog photo…\";",
    "",
    "  dogSourceImage = await loadImageFromFile(file);",
    "",
    "  cropState.zoom = 1;",
    "  cropState.panX = 0;",
    "  cropState.panY = 0;",
    "  zoomRange.value = \"1\";",
    "",
    "  cropWrap.style.display = \"block\";",
    "  previewGrid.style.display = \"none\";",
    "",
    "  drawDogCrop();",
    "",
    "  uploadBtn.style.display = \"block\";",
    "  statusEl.textContent =",
    "    \"✅ Drag the photo to reposition it. Use Zoom if needed.\";",
    "}",
    "",
    "async function prepareBelongingsPhotos(files) {",
    "  const selected =",
    "    Array.from(files || [])",
    "      .filter(",
    "        file =>",
    "          String(file.type || \"\").startsWith(\"image/\")",
    "      )",
    "      .slice(0, MAX_BELONGINGS_PHOTOS);",
    "",
    "  if (!selected.length) {",
    "    throw new Error(\"Please choose one or more image files.\");",
    "  }",
    "",
    "  selectedPhotos = [];",
    "  cropWrap.style.display = \"none\";",
    "  uploadBtn.style.display = \"none\";",
    "",
    "  for (let index = 0; index < selected.length; index++) {",
    "    statusEl.textContent =",
    "      `⏳ Preparing photo ${index + 1} of ${selected.length}…`;",
    "",
    "    notifyParent(",
    "      \"waffleBelongingsPhotoProgress\",",
    "      {",
    "        phase: \"preparing\",",
    "        current: index + 1,",
    "        total: selected.length,",
    "        message:",
    "          `Optimising photo ${index + 1} of ${selected.length}…`",
    "      }",
    "    );",
    "",
    "    const data =",
    "      await compressBelongingsPhoto(selected[index]);",
    "",
    "    selectedPhotos.push({",
    "      data,",
    "      name:",
    "        selected[index].name ||",
    "        `Photo ${index + 1}`",
    "    });",
    "",
    "    renderBelongingsPreviews();",
    "  }",
    "",
    "  uploadBtn.textContent =",
    "    selectedPhotos.length === 1",
    "      ? \"☁️ Upload 1 Photo\"",
    "      : `☁️ Upload ${selectedPhotos.length} Photos`;",
    "",
    "  uploadBtn.style.display = \"block\";",
    "",
    "  statusEl.textContent =",
    "    `✅ ${selectedPhotos.length} photo${selectedPhotos.length === 1 ? \"\" : \"s\"} ready.`;",
    "}",
    "",
    "async function handleFiles(files) {",
    "  try {",
    "    if (isDogProfile) {",
    "      const file = files && files[0];",
    "      if (!file) return;",
    "      await prepareDogPhoto(file);",
    "      return;",
    "    }",
    "",
    "    await prepareBelongingsPhotos(files);",
    "",
    "  } catch (error) {",
    "    statusEl.textContent =",
    "      \"❌ \" +",
    "      (",
    "        error && error.message",
    "          ? error.message",
    "          : String(error)",
    "      );",
    "  }",
    "}",
    "",
    "cropCanvas.addEventListener(\"pointerdown\", event => {",
    "  if (!dogSourceImage) return;",
    "",
    "  cropState.dragging = true;",
    "  cropState.pointerId = event.pointerId;",
    "  cropState.lastX = event.clientX;",
    "  cropState.lastY = event.clientY;",
    "",
    "  cropCanvas.setPointerCapture(event.pointerId);",
    "});",
    "",
    "cropCanvas.addEventListener(\"pointermove\", event => {",
    "  if (",
    "    !cropState.dragging ||",
    "    cropState.pointerId !== event.pointerId",
    "  ) {",
    "    return;",
    "  }",
    "",
    "  const rect = cropCanvas.getBoundingClientRect();",
    "  const scaleX = cropCanvas.width / rect.width;",
    "  const scaleY = cropCanvas.height / rect.height;",
    "",
    "  cropState.panX +=",
    "    (event.clientX - cropState.lastX) * scaleX;",
    "",
    "  cropState.panY +=",
    "    (event.clientY - cropState.lastY) * scaleY;",
    "",
    "  cropState.lastX = event.clientX;",
    "  cropState.lastY = event.clientY;",
    "",
    "  drawDogCrop();",
    "});",
    "",
    "function finishCropDrag(event) {",
    "  if (cropState.pointerId !== event.pointerId) return;",
    "  cropState.dragging = false;",
    "  cropState.pointerId = null;",
    "}",
    "",
    "cropCanvas.addEventListener(\"pointerup\", finishCropDrag);",
    "cropCanvas.addEventListener(\"pointercancel\", finishCropDrag);",
    "",
    "zoomRange.addEventListener(\"input\", () => {",
    "  cropState.zoom = Number(zoomRange.value || 1);",
    "  drawDogCrop();",
    "});",
    "",
    "document.getElementById(\"cameraInput\").addEventListener(",
    "  \"change\",",
    "  event => handleFiles(event.target.files)",
    ");",
    "",
    "document.getElementById(\"libraryInput\").addEventListener(",
    "  \"change\",",
    "  event => handleFiles(event.target.files)",
    ");",
    "",
    "function uploadOne(payload) {",
    "  return new Promise((resolve, reject) => {",
    "    google.script.run",
    "      .withSuccessHandler(result => resolve(result))",
    "      .withFailureHandler(error =>",
    "        reject(",
    "          new Error(",
    "            error && error.message",
    "              ? error.message",
    "              : String(error || \"Photo upload failed.\")",
    "          )",
    "        )",
    "      )",
    "      .uploadBelongingsPhotoFromHtml(payload);",
    "  });",
    "}",
    "",
    "uploadBtn.addEventListener(\"click\", async () => {",
    "  uploadBtn.disabled = true;",
    "",
    "  try {",
    "    if (isDogProfile) {",
    "      statusEl.textContent =",
    "        \"☁️ Saving positioned dog photo…\";",
    "",
    "      notifyParent(",
    "        \"waffleBelongingsPhotoProgress\",",
    "        {",
    "          phase: \"uploading\",",
    "          current: 1,",
    "          total: 1,",
    "          message: \"Saving the positioned dog photo to Google Drive…\"",
    "        }",
    "      );",
    "",
    "      const result =",
    "        await uploadOne({",
    "          stayKey: CONFIG.stayKey,",
    "          dogName: CONFIG.dogName,",
    "          startDate: CONFIG.startDate,",
    "          endDate: CONFIG.endDate,",
    "          photoType: CONFIG.photoType,",
    "          photoLabel:",
    "            (CONFIG.dogName || \"Dog\") +",
    "            \" profile photo\",",
    "          photoData: exportDogCrop()",
    "        });",
    "",
    "      statusEl.textContent =",
    "        \"✅ Dog photo positioned and saved.\";",
    "",
    "      notifyParent(",
    "        \"waffleBelongingsPhotoSaved\",",
    "        {",
    "          count: 1,",
    "          photo:",
    "            result && result.photo",
    "              ? result.photo",
    "              : null",
    "        }",
    "      );",
    "",
    "      return;",
    "    }",
    "",
    "    if (!selectedPhotos.length) {",
    "      throw new Error(\"Choose at least one photo first.\");",
    "    }",
    "",
    "    const baseLabel =",
    "      photoLabel.value.trim() ||",
    "      \"Belongings photo\";",
    "",
    "    const saved = [];",
    "",
    "    for (",
    "      let index = 0;",
    "      index < selectedPhotos.length;",
    "      index++",
    "    ) {",
    "      statusEl.textContent =",
    "        `☁️ Uploading ${index + 1} of ${selectedPhotos.length}…`;",
    "",
    "      notifyParent(",
    "        \"waffleBelongingsPhotoProgress\",",
    "        {",
    "          phase: \"uploading\",",
    "          current: index + 1,",
    "          total: selectedPhotos.length,",
    "          message:",
    "            `Saving photo ${index + 1} of ${selectedPhotos.length} to Google Drive…`",
    "        }",
    "      );",
    "",
    "      const label =",
    "        selectedPhotos.length === 1",
    "          ? baseLabel",
    "          : baseLabel + \" \" + (index + 1);",
    "",
    "      const result =",
    "        await uploadOne({",
    "          stayKey: CONFIG.stayKey,",
    "          dogName: CONFIG.dogName,",
    "          startDate: CONFIG.startDate,",
    "          endDate: CONFIG.endDate,",
    "          photoType: CONFIG.photoType,",
    "          photoLabel: label,",
    "          photoData: selectedPhotos[index].data",
    "        });",
    "",
    "      if (result && result.photo) {",
    "        saved.push(result.photo);",
    "      }",
    "    }",
    "",
    "    statusEl.textContent =",
    "      `✅ ${selectedPhotos.length} photo${selectedPhotos.length === 1 ? \"\" : \"s\"} saved to Google Drive.`;",
    "",
    "    notifyParent(",
    "      \"waffleBelongingsPhotoSaved\",",
    "      {",
    "        count: selectedPhotos.length,",
    "        photos: saved",
    "      }",
    "    );",
    "",
    "  } catch (error) {",
    "    const message =",
    "      error && error.message",
    "        ? error.message",
    "        : String(error || \"Photo upload failed.\");",
    "",
    "    statusEl.textContent =",
    "      \"❌ \" + message;",
    "",
    "    notifyParent(",
    "      \"waffleBelongingsPhotoError\",",
    "      { error: message }",
    "    );",
    "",
    "  } finally {",
    "    uploadBtn.disabled = false;",
    "  }",
    "});",
    "",
    "notifyParent(",
    "  \"waffleBelongingsPhotoUploaderReady\",",
    "  {}",
    ");",
    "</script>",
    "</body>",
    "</html>"
  ].join("\n");

  return HtmlService
    .createHtmlOutput(page)
    .addMetaTag(
      "viewport",
      "width=device-width, initial-scale=1"
    )
    .setXFrameOptionsMode(
      HtmlService
        .XFrameOptionsMode
        .ALLOWALL
    );
}


/**
 * Public function called only from the Apps Script-hosted uploader through
 * google.script.run. It adds a photo to an EXISTING Pet_Belongings record
 * without overwriting the checklist/descriptions already saved by the parent UI.
 */
function uploadBelongingsPhotoFromHtml(data) {
  assertWaffleActionAllowedDuringMaintenance_("uploadBelongingsPhotoFromHtml");

  data = data && typeof data === "object" ? data : {};

  var stayKey = String(data.stayKey || "").trim();
  var dogName = String(data.dogName || "").trim();
  var photoData = String(data.photoData || "");

  if (!stayKey) throw new Error("Stay Key is required.");
  if (!dogName) throw new Error("Dog Name is required.");
  if (!photoData) throw new Error("No photo data was supplied.");

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getBelongingsSheet_();
    var row = findBelongingsRow_(sheet, stayKey);

    if (row === -1) {
      throw new Error(
        "The belongings record was not found. Save the pet belongings details first, then try the photo again."
      );
    }

    var photoType = String(data.photoType || "belongings").trim();
    var isDogProfile = photoType === "dogProfile";
    var isStayPhoto = photoType === "stayPhoto";
    var previousDogPhoto = null;

    var photo = saveBelongingsPhoto_({
      dogName: dogName,
      photoLabel: String(
        data.photoLabel ||
        (isDogProfile ? dogName + " profile photo" : (isStayPhoto ? "Stay photo" : "Belongings photo"))
      ),
      photoData: photoData
    });

    if (isDogProfile) {
      previousDogPhoto = parseDogPhotoJson_(
        sheet.getRange(row, 30).getValue()
      );

      var dogPhotoGallery =
        normalizeV108DogPhotoGallery_(
          parseV108DogPhotoGalleryJson_(
            sheet.getRange(row, 33).getValue()
          ),
          previousDogPhoto
        );

      dogPhotoGallery = dogPhotoGallery.filter(function(item) {
        return String(item.id || "") !== String(photo.id || "");
      });
      dogPhotoGallery.push(photo);

      sheet.getRange(row, 30).setValue(JSON.stringify(photo));
      sheet.getRange(row, 33).setValue(JSON.stringify(dogPhotoGallery));
      // V10.6 deliberately retains previous dog profile images.
    } else if (isStayPhoto) {
      var stayPhotos=parseStayPhotosJson_(sheet.getRange(row,34).getValue());
      stayPhotos.push(photo);
      sheet.getRange(row,34).setValue(JSON.stringify(stayPhotos));
    } else {
      var photos = parsePhotosJson_(sheet.getRange(row, 24).getValue());
      photos.push(photo);
      sheet.getRange(row, 24).setValue(JSON.stringify(photos));
    }

    sheet.getRange(row, 1).setValue(new Date());
    SpreadsheetApp.flush();

    logAuditEvent_({
      category: "Photos",
      action: isDogProfile
        ? (previousDogPhoto ? "Dog Profile Photo Changed" : "Dog Profile Photo Added")
        : (isStayPhoto ? "Stay Photo Added" : "Belongings Photo Added"),
      dogName: dogName,
      bookingType: "Boarding",
      reference: stayKey,
      summary:
        (isDogProfile
          ? (previousDogPhoto ? "Dog profile photo changed for " : "Dog profile photo added for ")
          : (isStayPhoto ? "Stay photo added for " : "Belongings photo added for ")) +
        dogName +
        ".",
      changedFields: [
        isDogProfile ? "Dog Profile Photo" : (isStayPhoto ? "Stay Photos" : "Belongings Photos")
      ],
      before: isDogProfile && previousDogPhoto
        ? {
            id: previousDogPhoto.id || "",
            name: previousDogPhoto.name || "",
            label: previousDogPhoto.label || "",
            url: previousDogPhoto.url || ""
          }
        : null,
      after: {
        id: photo.id || "",
        name: photo.name || "",
        label: photo.label || "",
        url: photo.url || ""
      },
      source: "Web App"
    });

    touchWaffleDataVersion_(
      "directory"
    );

    return {
      result: "success",
      row: row,
      stayKey: stayKey,
      photoType: photoType,
      photo: photo
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (_) {}
  }
}


function getBelongingsPhotoUploadCacheKey_(uploadToken) {
  var cleanToken = String(uploadToken || "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .slice(0, 180);

  if (!cleanToken) {
    throw new Error("Upload token is required.");
  }

  return "belongings_photo_upload_" + cleanToken;
}


function setBelongingsPhotoUploadStatus_(uploadToken, status) {
  var payload = status && typeof status === "object" ? status : {};
  payload.updatedAt = new Date().toISOString();

  CacheService.getScriptCache().put(
    getBelongingsPhotoUploadCacheKey_(uploadToken),
    JSON.stringify(payload),
    600
  );
}


function getBelongingsPhotoUploadStatus_(uploadToken) {
  var raw = CacheService.getScriptCache().get(
    getBelongingsPhotoUploadCacheKey_(uploadToken)
  );

  if (!raw) {
    return {
      state: "missing",
      message: "No upload status has been recorded yet."
    };
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return {
      state: "error",
      error: "Upload status could not be decoded."
    };
  }
}


/**
 * Run this once manually from the Apps Script editor after installing this
 * version. It creates the Pet_Belongings worksheet and the Drive photo folder
 * and prompts for the new Google Drive authorization scope.
 */
function setupBelongingsStorage() {
  var sheet = getBelongingsSheet_();
  var folder = getBelongingsPhotoFolder_();

  var result = {
    sheetName: sheet.getName(),
    sheetGid: sheet.getSheetId(),
    folderId: folder.getId(),
    folderUrl: folder.getUrl()
  };

  console.log(JSON.stringify(result));
  return result;
}


function getBelongingsPhotoFolder_() {
  var properties = PropertiesService.getScriptProperties();
  var configuredId = String(properties.getProperty("BELONGINGS_FOLDER_ID") || "").trim();

  if (configuredId) {
    try {
      return DriveApp.getFolderById(configuredId);
    } catch (error) {
      // Fall through and create a replacement folder.
    }
  }

  var folder = DriveApp.createFolder("Waffle House Pet Belongings Photos");
  properties.setProperty("BELONGINGS_FOLDER_ID", folder.getId());
  return folder;
}


function sanitizeFileName_(value) {
  var cleaned = String(value || "photo")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "photo";
}


function saveBelongingsPhoto_(data) {
  var dataUrl = String(data.photoData || "");
  var match = dataUrl.match(/^data:(image\/[A-Za-z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Photo data is not a valid base64 image.");
  }

  var mimeType = match[1];
  var bytes = Utilities.base64Decode(match[2]);

  if (bytes.length > 5 * 1024 * 1024) {
    throw new Error("Photo is too large. Please keep each image under 5 MB after compression.");
  }

  var extension = mimeType === "image/png" ? "png" : "jpg";
  var dogPart = sanitizeFileName_(data.dogName || "pet");
  var itemPart = sanitizeFileName_(data.photoLabel || "belongings");
  var filename = dogPart + "_" + itemPart + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss") + "." + extension;

  var blob = Utilities.newBlob(bytes, mimeType, filename);
  var folder = getBelongingsPhotoFolder_();
  var file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (sharingError) {
    try { file.setTrashed(true); } catch (_) {}
    throw new Error(
      "The photo was uploaded, but Google Drive would not allow link sharing. " +
      "Your Google Workspace administrator may block 'Anyone with the link'. " +
      "This sharing permission is required for photos to display on the public GitHub web app."
    );
  }

  var fileId = file.getId();
  return {
    id: fileId,
    name: filename,
    label: String(data.photoLabel || "Belongings"),
    driveUrl: file.getUrl(),
    previewUrl: "https://drive.google.com/thumbnail?id=" + encodeURIComponent(fileId) + "&sz=w1600",
    createdAt: new Date().toISOString()
  };
}




var GUEST_DIRECTORY_EDIT_FIELDS_ = {
  dogName: { column: 2, label: "Dog Name" },
  breed: { column: 3, label: "Breed" },
  ownerName: { column: 6, label: "Owner" },
  phone: { column: 7, label: "Contact Number" },
  notes: { column: 10, label: "Notes" }
};


function makeGuestStayKey_(dogName, startDate, endDate) {
  return [
    String(dogName || "").trim().toLowerCase(),
    normalizeDateValue_(startDate),
    normalizeDateValue_(endDate || startDate)
  ].join("|");
}


function findGuestBookingRow_(rows, dogName, startDate, endDate) {
  var targetDog = String(dogName || "").trim().toLowerCase();
  var targetStart = normalizeDateValue_(startDate);
  var targetEnd = normalizeDateValue_(endDate || startDate);

  for (var i = 1; i < rows.length; i++) {
    var rowDog = String(rows[i][1] || "").trim().toLowerCase();
    var rowType = String(rows[i][11] || "").trim().toLowerCase();
    var rowStart = normalizeDateValue_(rows[i][3]);
    var rowEnd = normalizeDateValue_(rows[i][4] || rows[i][3]);

    // The Detailed Guest Directory contains boarding guests only.
    if (rowType === "meet & greet" || rowType === "potential stay") continue;
    if (targetDog && rowDog !== targetDog) continue;
    if (targetStart && rowStart !== targetStart) continue;
    if (targetEnd && rowEnd !== targetEnd) continue;

    return i + 1;
  }

  return -1;
}


function migrateBelongingsIdentityForGuest_(
  spreadsheet,
  oldStayKey,
  newStayKey,
  newDogName
) {
  if (!spreadsheet || !oldStayKey || !newStayKey) return false;

  var properties = PropertiesService.getScriptProperties();
  var belongingsSheetName = String(
    properties.getProperty("BELONGINGS_SHEET_NAME") || "Pet_Belongings"
  ).trim();

  // Do not create a belongings sheet merely because a guest name was edited.
  var belongingsSheet = spreadsheet.getSheetByName(belongingsSheetName);
  if (!belongingsSheet || belongingsSheet.getLastRow() < 2) return false;

  var row = findBelongingsRow_(belongingsSheet, oldStayKey);
  if (row === -1) return false;

  belongingsSheet.getRange(row, 1).setValue(new Date());
  belongingsSheet.getRange(row, 2).setValue(newStayKey);
  belongingsSheet.getRange(row, 3).setValue(String(newDogName || "").trim());

  return true;
}


function findBookingRow_(rows, bookingType, dogName, startDate, endDate) {
  var targetType = String(bookingType || "").trim().toLowerCase();
  var targetDog = String(dogName || "").trim().toLowerCase();
  var targetStart = normalizeDateValue_(startDate);
  var targetEnd = normalizeDateValue_(endDate);

  for (var i = 1; i < rows.length; i++) {
    var rowDog = String(rows[i][1] || "").trim().toLowerCase();
    var rowType = String(rows[i][11] || "").trim().toLowerCase();
    var rowStart = normalizeDateValue_(rows[i][3]);
    var rowEnd = normalizeDateValue_(rows[i][4]);

    if (rowType !== targetType) continue;
    if (targetDog && rowDog !== targetDog) continue;
    if (targetStart && rowStart !== targetStart) continue;
    if (targetEnd && rowEnd !== targetEnd) continue;

    return i + 1;
  }

  return -1;
}


function normalizeDateValue_(value) {
  if (value === null || value === undefined || value === "") return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  var text = String(value).trim();
  if (!text) return "";

  var isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[1] + "-" + isoMatch[2] + "-" + isoMatch[3];

  var auMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (auMatch) return auMatch[3] + "-" + pad2_(auMatch[2]) + "-" + pad2_(auMatch[1]);

  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  return text;
}


function pad2_(value) {
  return ("0" + String(value)).slice(-2);
}


function validatePotentialPayload_(data) {
  if (!String(data.dogName || "").trim()) throw new Error("Dog Name is required.");
  if (!String(data.breed || "").trim()) throw new Error("Breed is required.");
  if (!String(data.startDate || "").trim()) throw new Error("Check-In Date is required.");
  if (!String(data.endDate || "").trim()) throw new Error("Check-Out Date is required.");
  if (!String(data.ownerName || "").trim()) throw new Error("Owner Name is required.");
  if (!String(data.phone || "").trim()) throw new Error("Contact Number is required.");

  var start = normalizeDateValue_(data.startDate);
  var end = normalizeDateValue_(data.endDate);
  if (start && end && end < start) {
    throw new Error("Check-Out Date cannot be earlier than Check-In Date.");
  }
}


function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


function javascriptResponse_(callback, payload) {
  var safeCallback = String(callback || "");
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(safeCallback)) {
    throw new Error("Invalid JSONP callback name.");
  }

  return ContentService
    .createTextOutput(safeCallback + "(" + JSON.stringify(payload) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}







/* ========================================================================
 * WAFFLE HOUSE V10.1 NOTIFICATION CENTRE
 * ========================================================================
 * Combines live operational attention items with recent Audit Log activity.
 * Read/unread state remains device-local in the browser.
 */

function notificationCentreCategoryIcon_(
  category,
  action
) {
  var categoryText =
    String(category || "")
      .toLowerCase();

  var actionText =
    String(action || "")
      .toLowerCase();

  if (
    categoryText.indexOf(
      "potential"
    ) !== -1
  ) {
    return "❓";
  }

  if (
    categoryText.indexOf(
      "meet"
    ) !== -1
  ) {
    return "🤝";
  }

  if (
    categoryText.indexOf(
      "intake"
    ) !== -1
  ) {
    return "✅";
  }

  if (
    categoryText.indexOf(
      "reminder"
    ) !== -1
  ) {
    return "📌";
  }

  if (
    categoryText.indexOf(
      "photo"
    ) !== -1
  ) {
    return "📷";
  }

  if (
    categoryText.indexOf(
      "belong"
    ) !== -1 ||
    categoryText.indexOf(
      "care"
    ) !== -1
  ) {
    return "🐾";
  }

  if (
    actionText.indexOf(
      "delete"
    ) !== -1
  ) {
    return "🗑️";
  }

  if (
    categoryText.indexOf(
      "boarding"
    ) !== -1
  ) {
    return "🏡";
  }

  return "🧾";
}


function notificationCentreLink_(
  record
) {
  record =
    record &&
    typeof record ===
      "object"
      ? record
      : {};

  var category =
    String(
      record.category || ""
    )
      .toLowerCase();

  if (
    category.indexOf(
      "reminder"
    ) !== -1
  ) {
    return "reminders.html";
  }

  if (
    category.indexOf(
      "intake"
    ) !== -1 ||
    category.indexOf(
      "belong"
    ) !== -1 ||
    category.indexOf(
      "photo"
    ) !== -1 ||
    category.indexOf(
      "care"
    ) !== -1
  ) {
    return "directory.html";
  }

  return "index.html";
}


function getNotificationCentreVersion_(
  timezone
) {
  var dayKey =
    Utilities.formatDate(
      new Date(),
      timezone,
      "yyyy-MM-dd"
    );

  return [
    getWaffleDataVersion_(
      "directory"
    ),
    getWaffleDataVersion_(
      "reminders"
    ),
    getWaffleDataVersion_(
      "audit"
    ),
    dayKey
  ].join(".");
}


function buildNotificationCentrePayload_() {
  var sheet =
    getTargetSheet_();

  var timezone =
    sheet
      .getParent()
      .getSpreadsheetTimeZone() ||
    Session
      .getScriptTimeZone();

  var now =
    new Date();

  var today =
    Utilities.formatDate(
      now,
      timezone,
      "yyyy-MM-dd"
    );

  var items = [];

  function pushItem(item) {
    item =
      item &&
      typeof item ===
        "object"
        ? item
        : {};

    if (!item.id) {
      item.id =
        Utilities.getUuid();
    }

    items.push(
      item
    );
  }

  var todaySummary =
    buildTodayBoardingNotificationSummary_(
      sheet,
      today,
      timezone
    );

  todaySummary.arrivals
    .forEach(
      function(item) {
        pushItem({
          id:
            "arrival|" +
            today +
            "|" +
            String(
              item.dogName || ""
            ),
          kind:
            "attention",
          priority:
            "normal",
          icon:
            "🛬",
          category:
            "Arrivals",
          title:
            String(
              item.dogName ||
              "Guest"
            ) +
            " arriving today",
          body:
            "Boarding arrival scheduled for today.",
          timestamp:
            now.toISOString(),
          link:
            "index.html",
          dogName:
            String(
              item.dogName || ""
            )
        });
      }
    );

  todaySummary.departures
    .forEach(
      function(item) {
        pushItem({
          id:
            "departure|" +
            today +
            "|" +
            String(
              item.dogName || ""
            ),
          kind:
            "attention",
          priority:
            "normal",
          icon:
            "👋",
          category:
            "Departures",
          title:
            String(
              item.dogName ||
              "Guest"
            ) +
            " leaving today",
          body:
            "Boarding departure scheduled for today.",
          timestamp:
            now.toISOString(),
          link:
            "index.html",
          dogName:
            String(
              item.dogName || ""
            )
        });
      }
    );

  todaySummary.meetGreets
    .forEach(
      function(item) {
        pushItem({
          id:
            "meet|" +
            today +
            "|" +
            String(
              item.dogName || ""
            ) +
            "|" +
            String(
              item.time || ""
            ),
          kind:
            "attention",
          priority:
            "normal",
          icon:
            "🤝",
          category:
            "Meet & Greet",
          title:
            String(
              item.dogName ||
              "Guest"
            ) +
            " Meet & Greet",
          body:
            item.time
              ? (
                  "Expected today at " +
                  item.time +
                  "."
                )
              : "Scheduled for today.",
          timestamp:
            now.toISOString(),
          link:
            "index.html",
          dogName:
            String(
              item.dogName || ""
            )
        });
      }
    );

  readRemindersNotesRecords_(
    500
  ).forEach(
    function(reminder) {
      if (
        String(
          reminder.status || ""
        )
          .toLowerCase() ===
        "done"
      ) {
        return;
      }

      var reminderDate =
        String(
          reminder.reminderDate ||
          ""
        );

      if (
        !reminderDate ||
        reminderDate >
          today
      ) {
        return;
      }

      var overdue =
        reminderDate <
        today;

      pushItem({
        id:
          "reminder|" +
          String(
            reminder.noteId ||
            reminder.row ||
            ""
          ),
        kind:
          "attention",
        priority:
          overdue
            ? "urgent"
            : "normal",
        icon:
          overdue
            ? "⚠️"
            : "📌",
        category:
          "Reminders",
        title:
          overdue
            ? (
                "Overdue reminder" +
                (
                  reminder.dogName
                    ? (
                        " — " +
                        reminder.dogName
                      )
                    : ""
                )
              )
            : (
                "Reminder today" +
                (
                  reminder.dogName
                    ? (
                        " — " +
                        reminder.dogName
                      )
                    : ""
                )
              ),
        body:
          String(
            reminder.note ||
            "Reminder needs attention."
          ).slice(
            0,
            220
          ),
        timestamp:
          now.toISOString(),
        link:
          "reminders.html",
        dogName:
          String(
            reminder.dogName ||
            ""
          )
      });
    }
  );

  readFutureCapacityAlerts_(
    sheet,
    timezone,
    14
  )
    .slice(
      0,
      4
    )
    .forEach(
      function(item) {
        pushItem({
          id:
            "capacity|" +
            item.date +
            "|" +
            item.count,
          kind:
            "attention",
          priority:
            item.count >= 5
              ? "urgent"
              : "normal",
          icon:
            "🔴",
          category:
            "Capacity",
          title:
            item.count +
            " dogs on " +
            item.date,
          body:
            "High-capacity boarding date ahead.",
          timestamp:
            now.toISOString(),
          link:
            "index.html"
        });
      }
    );

  readAuditLogRecords_(
    50
  ).forEach(
    function(record) {
      var summary =
        String(
          record.summary ||
          record.action ||
          "Waffle House activity"
        ).trim();

      pushItem({
        id:
          "audit|" +
          String(
            record.eventId ||
            record.timestamp ||
            Utilities.getUuid()
          ),
        kind:
          "activity",
        priority:
          "info",
        icon:
          notificationCentreCategoryIcon_(
            record.category,
            record.action
          ),
        category:
          String(
            record.category ||
            "Activity"
          ),
        title:
          String(
            record.action ||
            "Activity"
          ),
        body:
          summary.slice(
            0,
            260
          ),
        timestamp:
          String(
            record.timestamp ||
            ""
          ),
        link:
          notificationCentreLink_(
            record
          ),
        dogName:
          String(
            record.dogName ||
            ""
          )
      });
    }
  );

  var unique = {};

  items.forEach(
    function(item) {
      if (
        !unique[
          item.id
        ]
      ) {
        unique[
          item.id
        ] =
          item;
      }
    }
  );

  var output =
    Object.keys(
      unique
    )
      .map(
        function(key) {
          return unique[
            key
          ];
        }
      );

  output.sort(
    function(a, b) {
      var aAttention =
        a.kind ===
        "attention";

      var bAttention =
        b.kind ===
        "attention";

      if (
        aAttention !==
        bAttention
      ) {
        return aAttention
          ? -1
          : 1;
      }

      var aUrgent =
        a.priority ===
        "urgent";

      var bUrgent =
        b.priority ===
        "urgent";

      if (
        aUrgent !==
        bUrgent
      ) {
        return aUrgent
          ? -1
          : 1;
      }

      return String(
        b.timestamp ||
        ""
      ).localeCompare(
        String(
          a.timestamp ||
          ""
        )
      );
    }
  );

  return {
    generatedAt:
      now.toISOString(),
    today:
      today,
    items:
      output.slice(
        0,
        80
      )
  };
}


function getNotificationCentreResponse_(
  data
) {
  data =
    data &&
    typeof data ===
      "object"
      ? data
      : {};

  var sheet =
    getTargetSheet_();

  var timezone =
    sheet
      .getParent()
      .getSpreadsheetTimeZone() ||
    Session
      .getScriptTimeZone();

  var version =
    getNotificationCentreVersion_(
      timezone
    );

  var variant =
    "notification-centre-v101";

  if (
    String(
      data.knownVersion ||
      ""
    ) ===
      version &&
    String(
      data.knownVariant ||
      ""
    ) ===
      variant
  ) {
    return {
      result:
        "success",
      action:
        "get_notification_centre",
      version:
        version,
      variant:
        variant,
      unchanged:
        true,
      cacheHit:
        true
    };
  }

  var cacheKey =
    "waffle_v101_notification:" +
    version;

  var cache =
    CacheService
      .getScriptCache();

  var cached =
    cache.get(
      cacheKey
    );

  var payload = null;

  if (cached) {
    try {
      payload =
        JSON.parse(
          cached
        );
    } catch (_) {}
  }

  if (!payload) {
    payload =
      buildNotificationCentrePayload_();

    safePutWaffleCache_(
      cacheKey,
      payload,
      25
    );
  }

  payload.result =
    "success";

  payload.action =
    "get_notification_centre";

  payload.version =
    version;

  payload.variant =
    variant;

  return payload;
}




/* ========================================================================
 * WAFFLE HOUSE V9 PUSH NOTIFICATIONS — FIREBASE CLOUD MESSAGING
 * ========================================================================
 *
 * Required Script Properties:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *   PUSH_ENROLLMENT_CODE
 *
 * Public Firebase Web config lives in waffle-firebase-config.js on GitHub.
 *
 * FCM target: Firebase Installation ID (FID).
 */

var PUSH_SUBSCRIPTIONS_HEADERS_ = [
  "Created At",
  "Updated At",
  "Subscription ID",
  "Firebase Installation ID",
  "Device Label",
  "Platform",
  "User Agent",
  "Enabled",
  "Arrivals",
  "Departures",
  "Meet & Greets",
  "Reminders",
  "Intake Completed",
  "Capacity",
  "Last Seen At",
  "Last Push At",
  "Last Error",
  "Last Message ID"
];


var PUSH_CATEGORY_COLUMN_ = {
  arrivals: 9,
  departures: 10,
  meetGreets: 11,
  reminders: 12,
  intakeCompleted: 13,
  capacity: 14
};


function getPushSubscriptionsSheet_() {
  var spreadsheet =
    getWaffleSpreadsheet_();

  var properties =
    PropertiesService
      .getScriptProperties();

  var sheetName =
    String(
      properties.getProperty(
        "PUSH_SUBSCRIPTIONS_SHEET_NAME"
      ) ||
      "Push_Subscriptions"
    ).trim();

  var sheet =
    spreadsheet.getSheetByName(
      sheetName
    );

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet(
        sheetName
      );
  }

  if (
    sheet.getMaxColumns() <
    PUSH_SUBSCRIPTIONS_HEADERS_.length
  ) {
    sheet.insertColumnsAfter(
      sheet.getMaxColumns(),
      PUSH_SUBSCRIPTIONS_HEADERS_.length -
      sheet.getMaxColumns()
    );
  }

  var needsHeaders =
    sheet.getLastRow() === 0;

  if (!needsHeaders) {
    var current =
      sheet
        .getRange(
          1,
          1,
          1,
          PUSH_SUBSCRIPTIONS_HEADERS_.length
        )
        .getValues()[0];

    for (
      var i = 0;
      i <
      PUSH_SUBSCRIPTIONS_HEADERS_.length;
      i++
    ) {
      if (
        String(
          current[i] || ""
        ) !==
        PUSH_SUBSCRIPTIONS_HEADERS_[i]
      ) {
        needsHeaders = true;
        break;
      }
    }
  }

  if (needsHeaders) {
    sheet
      .getRange(
        1,
        1,
        1,
        PUSH_SUBSCRIPTIONS_HEADERS_.length
      )
      .setValues([
        PUSH_SUBSCRIPTIONS_HEADERS_
      ]);

    sheet.setFrozenRows(1);

    sheet
      .getRange(
        1,
        1,
        1,
        PUSH_SUBSCRIPTIONS_HEADERS_.length
      )
      .setFontWeight("bold")
      .setBackground("#2563eb")
      .setFontColor("#ffffff");
  }

  return sheet;
}


function normalizePushPreferences_(
  value
) {
  value =
    value &&
    typeof value === "object"
      ? value
      : {};

  function bool(
    key,
    defaultValue
  ) {
    if (
      value[key] === undefined ||
      value[key] === null ||
      value[key] === ""
    ) {
      return defaultValue;
    }

    return (
      value[key] === true ||
      String(value[key])
        .toLowerCase() ===
        "true"
    );
  }

  return {
    arrivals:
      bool("arrivals", true),
    departures:
      bool("departures", true),
    meetGreets:
      bool("meetGreets", true),
    reminders:
      bool("reminders", true),
    intakeCompleted:
      bool("intakeCompleted", true),
    capacity:
      bool("capacity", true)
  };
}


function pushRowToObject_(
  row,
  rowNumber
) {
  row =
    Array.isArray(row)
      ? row
      : [];

  function boolValue(value) {
    return (
      value === true ||
      String(value)
        .toLowerCase() ===
        "true"
    );
  }

  return {
    row:
      rowNumber || null,
    createdAt:
      String(row[0] || ""),
    updatedAt:
      String(row[1] || ""),
    subscriptionId:
      String(row[2] || ""),
    fid:
      String(row[3] || ""),
    deviceLabel:
      String(row[4] || ""),
    platform:
      String(row[5] || ""),
    userAgent:
      String(row[6] || ""),
    enabled:
      boolValue(row[7]),
    preferences: {
      arrivals:
        boolValue(row[8]),
      departures:
        boolValue(row[9]),
      meetGreets:
        boolValue(row[10]),
      reminders:
        boolValue(row[11]),
      intakeCompleted:
        boolValue(row[12]),
      capacity:
        boolValue(row[13])
    },
    lastSeenAt:
      String(row[14] || ""),
    lastPushAt:
      String(row[15] || ""),
    lastError:
      String(row[16] || ""),
    lastMessageId:
      String(row[17] || "")
  };
}


function findPushSubscription_(
  sheet,
  subscriptionId,
  fid
) {
  subscriptionId =
    String(
      subscriptionId || ""
    ).trim();

  fid =
    String(
      fid || ""
    ).trim();

  if (
    sheet.getLastRow() <
    2
  ) {
    return null;
  }

  var values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        PUSH_SUBSCRIPTIONS_HEADERS_.length
      )
      .getValues();

  for (
    var i = 0;
    i < values.length;
    i++
  ) {
    var rowSubscriptionId =
      String(
        values[i][2] || ""
      ).trim();

    var rowFid =
      String(
        values[i][3] || ""
      ).trim();

    if (
      (
        subscriptionId &&
        rowSubscriptionId ===
          subscriptionId
      ) ||
      (
        fid &&
        rowFid ===
          fid
      )
    ) {
      return pushRowToObject_(
        values[i],
        i + 2
      );
    }
  }

  return null;
}


function validatePushEnrollmentCode_(
  code
) {
  var expected =
    String(
      PropertiesService
        .getScriptProperties()
        .getProperty(
          "PUSH_ENROLLMENT_CODE"
        ) ||
      ""
    ).trim();

  if (!expected) {
    throw new Error(
      "PUSH_ENROLLMENT_CODE is not configured in Apps Script."
    );
  }

  if (
    String(code || "")
      .trim() !==
    expected
  ) {
    throw new Error(
      "The notification setup code is incorrect."
    );
  }
}


function registerPushDevice_(
  data
) {
  data =
    data &&
    typeof data === "object"
      ? data
      : {};

  var fid =
    String(
      data.fid || ""
    ).trim();

  if (!fid) {
    throw new Error(
      "Firebase Installation ID is missing."
    );
  }

  var sheet =
    getPushSubscriptionsSheet_();

  var existing =
    findPushSubscription_(
      sheet,
      data.subscriptionId,
      fid
    );

  if (!existing) {
    validatePushEnrollmentCode_(
      data.enrollmentCode
    );
  }

  var now =
    new Date();

  var subscriptionId =
    existing
      ? existing.subscriptionId
      : Utilities.getUuid();

  var preferences =
    normalizePushPreferences_(
      data.preferences
    );

  var rowValues = [
    existing
      ? (
          sheet.getRange(
            existing.row,
            1
          ).getValue() ||
          now
        )
      : now,
    now,
    subscriptionId,
    fid,
    String(
      data.deviceLabel ||
      "Waffle House device"
    ).trim(),
    String(
      data.platform ||
      ""
    ).trim(),
    String(
      data.userAgent ||
      ""
    ).slice(0, 500),
    true,
    preferences.arrivals,
    preferences.departures,
    preferences.meetGreets,
    preferences.reminders,
    preferences.intakeCompleted,
    preferences.capacity,
    now,
    existing
      ? sheet.getRange(
          existing.row,
          16
        ).getValue()
      : "",
    "",
    existing
      ? sheet.getRange(
          existing.row,
          18
        ).getValue()
      : ""
  ];

  if (existing) {
    sheet
      .getRange(
        existing.row,
        1,
        1,
        PUSH_SUBSCRIPTIONS_HEADERS_.length
      )
      .setValues([
        rowValues
      ]);
  } else {
    sheet.appendRow(
      rowValues
    );
  }

  return {
    result:
      "success",
    action:
      "register_push_device",
    subscriptionId:
      subscriptionId,
    enabled:
      true,
    preferences:
      preferences
  };
}


function getPushDevice_(
  subscriptionId
) {
  subscriptionId =
    String(
      subscriptionId || ""
    ).trim();

  if (!subscriptionId) {
    return {
      registered:
        false
    };
  }

  var record =
    findPushSubscription_(
      getPushSubscriptionsSheet_(),
      subscriptionId,
      ""
    );

  if (!record) {
    return {
      registered:
        false
    };
  }

  return {
    registered:
      true,
    subscriptionId:
      record.subscriptionId,
    enabled:
      record.enabled,
    deviceLabel:
      record.deviceLabel,
    platform:
      record.platform,
    preferences:
      record.preferences,
    lastSeenAt:
      record.lastSeenAt,
    lastPushAt:
      record.lastPushAt,
    lastError:
      record.lastError
  };
}


function updatePushPreferences_(
  data
) {
  var sheet =
    getPushSubscriptionsSheet_();

  var record =
    findPushSubscription_(
      sheet,
      data.subscriptionId,
      ""
    );

  if (!record) {
    throw new Error(
      "This notification device is no longer registered. Enable notifications again."
    );
  }

  var preferences =
    normalizePushPreferences_(
      data.preferences
    );

  var now =
    new Date();

  sheet
    .getRange(
      record.row,
      2
    )
    .setValue(
      now
    );

  sheet
    .getRange(
      record.row,
      5
    )
    .setValue(
      String(
        data.deviceLabel ||
        record.deviceLabel ||
        "Waffle House device"
      ).trim()
    );

  sheet
    .getRange(
      record.row,
      8,
      1,
      7
    )
    .setValues([[
      true,
      preferences.arrivals,
      preferences.departures,
      preferences.meetGreets,
      preferences.reminders,
      preferences.intakeCompleted,
      preferences.capacity
    ]]);

  sheet
    .getRange(
      record.row,
      15
    )
    .setValue(
      now
    );

  return {
    result:
      "success",
    action:
      "update_push_preferences",
    subscriptionId:
      record.subscriptionId,
    enabled:
      true,
    preferences:
      preferences
  };
}


function disablePushDevice_(
  subscriptionId
) {
  var sheet =
    getPushSubscriptionsSheet_();

  var record =
    findPushSubscription_(
      sheet,
      subscriptionId,
      ""
    );

  if (!record) {
    return {
      result:
        "success",
      action:
        "disable_push_device",
      disabled:
        true
    };
  }

  sheet
    .getRange(
      record.row,
      2
    )
    .setValue(
      new Date()
    );

  sheet
    .getRange(
      record.row,
      8
    )
    .setValue(
      false
    );

  return {
    result:
      "success",
    action:
      "disable_push_device",
    disabled:
      true
  };
}


function parseFirebaseServiceAccountJson_(
  rawValue
) {
  var text =
    String(
      rawValue || ""
    ).trim();

  if (!text) {
    return null;
  }

  try {
    var parsed =
      JSON.parse(
        text
      );

    if (
      parsed &&
      typeof parsed ===
        "object" &&
      (
        parsed.private_key ||
        parsed.client_email ||
        parsed.project_id
      )
    ) {
      return parsed;
    }
  } catch (_) {}

  return null;
}


function normalizeFirebasePrivateKey_(
  rawValue
) {
  var text =
    String(
      rawValue || ""
    ).trim();

  if (!text) {
    return "";
  }

  /*
   * Accept a complete downloaded Firebase service-account JSON file pasted
   * into FIREBASE_PRIVATE_KEY as well as the normal private_key value.
   */
  var embeddedJson =
    parseFirebaseServiceAccountJson_(
      text
    );

  if (
    embeddedJson &&
    embeddedJson.private_key
  ) {
    text =
      String(
        embeddedJson.private_key
      );
  }

  /*
   * Accept a JSON-quoted private_key value copied directly from the JSON
   * document, including its surrounding quotation marks.
   */
  if (
    text.charAt(0) ===
      "\"" &&
    text.charAt(
      text.length - 1
    ) ===
      "\""
  ) {
    try {
      var decoded =
        JSON.parse(
          text
        );

      if (
        typeof decoded ===
        "string"
      ) {
        text =
          decoded;
      }
    } catch (_) {}
  }

  text =
    String(
      text
    )
      .replace(
        /\\r\\n/g,
        "\n"
      )
      .replace(
        /\\n/g,
        "\n"
      )
      .replace(
        /\\r/g,
        "\n"
      )
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      )
      .trim();

  var pkcs8Begin =
    "-----BEGIN PRIVATE KEY-----";

  var pkcs8End =
    "-----END PRIVATE KEY-----";

  var rsaBegin =
    "-----BEGIN RSA PRIVATE KEY-----";

  if (
    text.indexOf(
      rsaBegin
    ) !==
    -1
  ) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY is an RSA PRIVATE KEY, not the PKCS#8 service-account PRIVATE KEY expected by Apps Script. Use the private_key value from the Firebase service-account JSON generated in Project Settings → Service accounts."
    );
  }

  var beginIndex =
    text.indexOf(
      pkcs8Begin
    );

  var endIndex =
    text.indexOf(
      pkcs8End
    );

  if (
    beginIndex ===
      -1 ||
    endIndex ===
      -1 ||
    endIndex <=
      beginIndex
  ) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY is not a valid PEM service-account key. It must contain BEGIN PRIVATE KEY and END PRIVATE KEY. Copy the private_key value from the Firebase service-account JSON, or store the complete JSON in FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }

  /*
   * Strip any accidental property-name text/quotes outside the PEM markers
   * and rebuild canonical 64-character PEM lines. This fixes the common
   * Script Properties copy/paste cases that produce:
   *   Exception: Invalid argument: key
   */
  text =
    text.substring(
      beginIndex,
      endIndex +
      pkcs8End.length
    );

  var body =
    text
      .replace(
        pkcs8Begin,
        ""
      )
      .replace(
        pkcs8End,
        ""
      )
      .replace(
        /\s+/g,
        ""
      );

  if (
    !body ||
    !/^[A-Za-z0-9+/=]+$/
      .test(
        body
      )
  ) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY contains invalid PEM characters. Re-copy the private_key value from the Firebase service-account JSON."
    );
  }

  var lines = [];

  for (
    var i = 0;
    i < body.length;
    i += 64
  ) {
    lines.push(
      body.substring(
        i,
        i + 64
      )
    );
  }

  return (
    pkcs8Begin +
    "\n" +
    lines.join(
      "\n"
    ) +
    "\n" +
    pkcs8End +
    "\n"
  );
}


function getFirebaseMessagingConfig_() {
  var properties =
    PropertiesService
      .getScriptProperties();

  var serviceAccount =
    parseFirebaseServiceAccountJson_(
      properties.getProperty(
        "FIREBASE_SERVICE_ACCOUNT_JSON"
      )
    );

  var rawPrivateKey =
    String(
      properties.getProperty(
        "FIREBASE_PRIVATE_KEY"
      ) ||
      ""
    ).trim();

  /*
   * If the entire JSON file was accidentally pasted into FIREBASE_PRIVATE_KEY,
   * use its other fields as fallbacks too.
   */
  var privateKeyJson =
    parseFirebaseServiceAccountJson_(
      rawPrivateKey
    );

  if (
    !serviceAccount &&
    privateKeyJson
  ) {
    serviceAccount =
      privateKeyJson;
  }

  serviceAccount =
    serviceAccount ||
    {};

  var projectId =
    String(
      properties.getProperty(
        "FIREBASE_PROJECT_ID"
      ) ||
      serviceAccount.project_id ||
      ""
    ).trim();

  var clientEmail =
    String(
      properties.getProperty(
        "FIREBASE_CLIENT_EMAIL"
      ) ||
      serviceAccount.client_email ||
      ""
    ).trim();

  var privateKeySource =
    rawPrivateKey ||
    serviceAccount.private_key ||
    "";

  if (
    !projectId ||
    !clientEmail ||
    !privateKeySource
  ) {
    throw new Error(
      "Firebase server credentials are incomplete. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or paste the complete service-account JSON into FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }

  return {
    projectId:
      projectId,
    clientEmail:
      clientEmail,
    privateKey:
      normalizeFirebasePrivateKey_(
        privateKeySource
      )
  };
}


function base64UrlEncodeWaffle_(
  value
) {
  var bytes =
    typeof value === "string"
      ? Utilities.newBlob(
          value
        ).getBytes()
      : value;

  return Utilities
    .base64EncodeWebSafe(
      bytes
    )
    .replace(
      /=+$/g,
      ""
    );
}


function getFirebaseMessagingAccessToken_() {
  var cache =
    CacheService
      .getScriptCache();

  var cached =
    cache.get(
      "waffle_fcm_access_token"
    );

  if (cached) {
    return cached;
  }

  var config =
    getFirebaseMessagingConfig_();

  var nowSeconds =
    Math.floor(
      Date.now() /
      1000
    );

  var header =
    base64UrlEncodeWaffle_(
      JSON.stringify({
        alg: "RS256",
        typ: "JWT"
      })
    );

  var claim =
    base64UrlEncodeWaffle_(
      JSON.stringify({
        iss:
          config.clientEmail,
        scope:
          "https://www.googleapis.com/auth/firebase.messaging",
        aud:
          "https://oauth2.googleapis.com/token",
        iat:
          nowSeconds,
        exp:
          nowSeconds + 3600
      })
    );

  var unsigned =
    header +
    "." +
    claim;

  var signature = null;

  try {
    signature =
      Utilities.computeRsaSha256Signature(
        unsigned,
        config.privateKey,
        Utilities.Charset.UTF_8
      );
  } catch (error) {
    throw new Error(
      "Firebase service-account private key could not be signed by Apps Script. " +
      "The FIREBASE_PRIVATE_KEY value must be the PEM-formatted private_key from the Firebase service-account JSON. " +
      "You can alternatively paste the complete downloaded service-account JSON into FIREBASE_SERVICE_ACCOUNT_JSON. " +
      "Apps Script error: " +
      (
        error &&
        error.message
          ? error.message
          : String(error)
      )
    );
  }

  var assertion =
    unsigned +
    "." +
    base64UrlEncodeWaffle_(
      signature
    );

  var response =
    UrlFetchApp.fetch(
      "https://oauth2.googleapis.com/token",
      {
        method:
          "post",
        payload: {
          grant_type:
            "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion:
            assertion
        },
        muteHttpExceptions:
          true
      }
    );

  var code =
    response.getResponseCode();

  var text =
    response.getContentText();

  if (
    code < 200 ||
    code >= 300
  ) {
    throw new Error(
      "Firebase OAuth token request failed (" +
      code +
      "): " +
      text.slice(0, 500)
    );
  }

  var parsed =
    JSON.parse(
      text
    );

  var token =
    String(
      parsed.access_token ||
      ""
    );

  if (!token) {
    throw new Error(
      "Firebase OAuth response did not contain an access token."
    );
  }

  cache.put(
    "waffle_fcm_access_token",
    token,
    3300
  );

  return token;
}


function updatePushDeliveryRecord_(
  sheet,
  record,
  success,
  messageId,
  errorText
) {
  var now =
    new Date();

  sheet
    .getRange(
      record.row,
      2
    )
    .setValue(
      now
    );

  if (success) {
    sheet
      .getRange(
        record.row,
        16
      )
      .setValue(
        now
      );

    sheet
      .getRange(
        record.row,
        17
      )
      .setValue(
        ""
      );

    sheet
      .getRange(
        record.row,
        18
      )
      .setValue(
        messageId ||
        ""
      );
  } else {
    sheet
      .getRange(
        record.row,
        17
      )
      .setValue(
        String(
          errorText ||
          "Push send failed."
        ).slice(0, 1000)
      );
  }
}


function sendFirebaseMessageToFid_(
  record,
  notification
) {
  var config =
    getFirebaseMessagingConfig_();

  var accessToken =
    getFirebaseMessagingAccessToken_();

  notification =
    notification &&
    typeof notification ===
      "object"
      ? notification
      : {};

  var data = {
    title:
      String(
        notification.title ||
        "🐾 Waffle House"
      ),
    body:
      String(
        notification.body ||
        "Waffle House has an update."
      ),
    link:
      String(
        notification.link ||
        "index.html"
      ),
    category:
      String(
        notification.category ||
        "general"
      ),
    tag:
      String(
        notification.tag ||
        notification.category ||
        "waffle-update"
      )
  };

  Object.keys(
    notification.data ||
    {}
  ).forEach(
    function(key) {
      data[key] =
        String(
          notification.data[key] ===
            undefined ||
          notification.data[key] ===
            null
            ? ""
            : notification.data[key]
        );
    }
  );

  var payload = {
    message: {
      fid:
        record.fid,
      data:
        data,
      webpush: {
        headers: {
          TTL:
            String(
              notification.ttlSeconds ||
              3600
            )
        }
      }
    }
  };

  var response =
    UrlFetchApp.fetch(
      "https://fcm.googleapis.com/v1/projects/" +
      encodeURIComponent(
        config.projectId
      ) +
      "/messages:send",
      {
        method:
          "post",
        contentType:
          "application/json",
        headers: {
          Authorization:
            "Bearer " +
            accessToken
        },
        payload:
          JSON.stringify(
            payload
          ),
        muteHttpExceptions:
          true
      }
    );

  var code =
    response.getResponseCode();

  var text =
    response.getContentText();

  if (
    code >= 200 &&
    code < 300
  ) {
    var parsed =
      text
        ? JSON.parse(text)
        : {};

    return {
      ok:
        true,
      messageId:
        String(
          parsed.name ||
          ""
        )
    };
  }

  var readableError =
    text.slice(
      0,
      1000
    );

  try {
    var parsedError =
      JSON.parse(
        text
      );

    var errorObject =
      parsedError &&
      parsedError.error
        ? parsedError.error
        : null;

    if (errorObject) {
      var parts = [];

      if (
        errorObject.status
      ) {
        parts.push(
          String(
            errorObject.status
          )
        );
      }

      if (
        errorObject.message
      ) {
        parts.push(
          String(
            errorObject.message
          )
        );
      }

      var fieldViolations = [];

      (
        Array.isArray(
          errorObject.details
        )
          ? errorObject.details
          : []
      ).forEach(
        function(detail) {
          (
            Array.isArray(
              detail.fieldViolations
            )
              ? detail.fieldViolations
              : []
          ).forEach(
            function(violation) {
              fieldViolations.push(
                [
                  violation.field,
                  violation.description
                ]
                  .filter(Boolean)
                  .join(
                    ": "
                  )
              );
            }
          );
        }
      );

      if (
        fieldViolations.length
      ) {
        parts.push(
          fieldViolations.join(
            " | "
          )
        );
      }

      if (
        parts.length
      ) {
        readableError =
          parts.join(
            " — "
          );
      }
    }
  } catch (_) {}

  return {
    ok:
      false,
    status:
      code,
    error:
      readableError,
    rawError:
      text.slice(
        0,
        1000
      ),
    invalidRegistration:
      (
        code === 404 ||
        text.indexOf(
          "UNREGISTERED"
        ) !== -1
      )
  };
}


function readActivePushSubscriptions_(
  category
) {
  var sheet =
    getPushSubscriptionsSheet_();

  if (
    sheet.getLastRow() <
    2
  ) {
    return [];
  }

  var categoryColumn =
    PUSH_CATEGORY_COLUMN_[
      category
    ];

  if (!categoryColumn) {
    throw new Error(
      "Unknown push category: " +
      category
    );
  }

  var rows =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        PUSH_SUBSCRIPTIONS_HEADERS_.length
      )
      .getValues();

  var result = [];

  rows.forEach(
    function(row, index) {
      var record =
        pushRowToObject_(
          row,
          index + 2
        );

      if (
        !record.enabled ||
        !record.fid
      ) {
        return;
      }

      var enabledForCategory =
        row[
          categoryColumn - 1
        ] === true ||
        String(
          row[
            categoryColumn - 1
          ]
        )
          .toLowerCase() ===
          "true";

      if (
        enabledForCategory
      ) {
        result.push(
          record
        );
      }
    }
  );

  return result;
}


function sendPushToCategory_(
  category,
  notification
) {
  var sheet =
    getPushSubscriptionsSheet_();

  var records =
    readActivePushSubscriptions_(
      category
    );

  var sent = [];
  var failed = [];

  records.forEach(
    function(record) {
      try {
        var result =
          sendFirebaseMessageToFid_(
            record,
            Object.assign(
              {},
              notification,
              {
                category:
                  category
              }
            )
          );

        if (result.ok) {
          updatePushDeliveryRecord_(
            sheet,
            record,
            true,
            result.messageId,
            ""
          );

          sent.push(
            record.subscriptionId
          );
        } else {
          updatePushDeliveryRecord_(
            sheet,
            record,
            false,
            "",
            result.error
          );

          if (
            result.invalidRegistration
          ) {
            sheet
              .getRange(
                record.row,
                8
              )
              .setValue(
                false
              );
          }

          failed.push({
            subscriptionId:
              record.subscriptionId,
            error:
              result.error
          });
        }
      } catch (error) {
        updatePushDeliveryRecord_(
          sheet,
          record,
          false,
          "",
          error &&
          error.message
            ? error.message
            : String(error)
        );

        failed.push({
          subscriptionId:
            record.subscriptionId,
          error:
            error &&
            error.message
              ? error.message
              : String(error)
        });
      }
    }
  );

  return {
    category:
      category,
    targeted:
      records.length,
    sent:
      sent.length,
    failed:
      failed
  };
}


function safeSendPushToCategory_(
  category,
  notification
) {
  try {
    return sendPushToCategory_(
      category,
      notification
    );
  } catch (error) {
    console.warn(
      "Waffle push send skipped:",
      error
    );

    return {
      category:
        category,
      targeted:
        0,
      sent:
        0,
      skipped:
        true,
      error:
        error &&
        error.message
          ? error.message
          : String(error)
    };
  }
}


function sendTestPushForDevice_(
  subscriptionId
) {
  var sheet =
    getPushSubscriptionsSheet_();

  var record =
    findPushSubscription_(
      sheet,
      subscriptionId,
      ""
    );

  if (
    !record ||
    !record.enabled
  ) {
    throw new Error(
      "This notification device is not enabled."
    );
  }

  var result =
    sendFirebaseMessageToFid_(
      record,
      {
        title:
          "🐾 Waffle House Test",
        body:
          "Push notifications are working on this device.",
        link:
          "index.html",
        category:
          "test",
        tag:
          "waffle-test",
        ttlSeconds:
          300
      }
    );

  updatePushDeliveryRecord_(
    sheet,
    record,
    result.ok,
    result.messageId ||
      "",
    result.error ||
      ""
  );

  if (!result.ok) {
    throw new Error(
      "Test notification failed: " +
      (
        result.error ||
        "Unknown FCM error"
      )
    );
  }

  return {
    result:
      "success",
    action:
      "send_test_push",
    sent:
      true
  };
}


function getWafflePushEventState_() {
  var raw =
    String(
      PropertiesService
        .getScriptProperties()
        .getProperty(
          "WAFFLE_PUSH_EVENT_STATE"
        ) ||
      ""
    );

  if (!raw) {
    return {};
  }

  try {
    var parsed =
      JSON.parse(
        raw
      );

    return parsed &&
      typeof parsed ===
        "object"
        ? parsed
        : {};
  } catch (_) {
    return {};
  }
}


function saveWafflePushEventState_(
  state
) {
  var cutoff =
    Date.now() -
    (
      45 *
      24 *
      60 *
      60 *
      1000
    );

  var cleaned = {};

  Object.keys(
    state || {}
  ).forEach(
    function(key) {
      var timestamp =
        Date.parse(
          state[key]
        );

      if (
        !timestamp ||
        timestamp >= cutoff
      ) {
        cleaned[key] =
          state[key];
      }
    }
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      "WAFFLE_PUSH_EVENT_STATE",
      JSON.stringify(
        cleaned
      )
    );
}


function makePushEventKey_(
  type,
  parts
) {
  return [
    type
  ]
    .concat(
      Array.isArray(parts)
        ? parts
        : [
            parts
          ]
    )
    .map(
      function(value) {
        return String(
          value ||
          ""
        )
          .trim()
          .toLowerCase();
      }
    )
    .join("|");
}


function readFutureCapacityAlerts_(
  sheet,
  timezone,
  horizonDays
) {
  horizonDays =
    Number(
      horizonDays ||
      30
    );

  var today =
    Utilities.formatDate(
      new Date(),
      timezone,
      "yyyy-MM-dd"
    );

  var counts = {};
  var values =
    sheet
      .getDataRange()
      .getValues();

  function addDays(
    dateString,
    days
  ) {
    var date =
      new Date(
        dateString +
        "T12:00:00"
      );

    date.setDate(
      date.getDate() +
      days
    );

    return Utilities.formatDate(
      date,
      timezone,
      "yyyy-MM-dd"
    );
  }

  var horizonEnd =
    addDays(
      today,
      horizonDays
    );

  for (
    var i = 1;
    i < values.length;
    i++
  ) {
    var row =
      values[i];

    var dogName =
      String(
        row[1] ||
        ""
      ).trim();

    if (!dogName) continue;

    var startDate =
      normalizeDateValueForTimezone_(
        row[3],
        timezone
      );

    var endDate =
      normalizeDateValueForTimezone_(
        row[4],
        timezone
      ) ||
      startDate;

    var bookingType =
      String(
        row[11] ||
        ""
      )
        .trim()
        .toLowerCase();

    if (
      !startDate ||
      bookingType ===
        "meet & greet"
    ) {
      continue;
    }

    if (
      endDate < today ||
      startDate > horizonEnd
    ) {
      continue;
    }

    var cursor =
      startDate < today
        ? today
        : startDate;

    var finalDate =
      endDate > horizonEnd
        ? horizonEnd
        : endDate;

    while (
      cursor <=
      finalDate
    ) {
      counts[cursor] =
        (
          counts[cursor] ||
          0
        ) +
        1;

      cursor =
        addDays(
          cursor,
          1
        );
    }
  }

  return Object.keys(
    counts
  )
    .filter(
      function(dateString) {
        return (
          counts[
            dateString
          ] >= 4
        );
      }
    )
    .sort()
    .map(
      function(dateString) {
        return {
          date:
            dateString,
          count:
            counts[
              dateString
            ]
        };
      }
    );
}


function checkWaffleHousePushNotifications() {
  var sheet =
    getTargetSheet_();

  var timezone =
    sheet
      .getParent()
      .getSpreadsheetTimeZone() ||
    Session
      .getScriptTimeZone();

  var now =
    new Date();

  var today =
    Utilities.formatDate(
      now,
      timezone,
      "yyyy-MM-dd"
    );

  var currentHour =
    Number(
      Utilities.formatDate(
        now,
        timezone,
        "H"
      )
    );

  var currentMinute =
    Number(
      Utilities.formatDate(
        now,
        timezone,
        "m"
      )
    );

  var currentMinutes =
    (
      currentHour *
      60
    ) +
    currentMinute;

  var state =
    getWafflePushEventState_();

  var sent = {
    meetGreets:
      0,
    reminders:
      0,
    capacity:
      0
  };

  var summary =
    buildTodayBoardingNotificationSummary_(
      sheet,
      today,
      timezone
    );

  summary.meetGreets.forEach(
    function(meet) {
      if (
        meet.timeMinutes ===
        null
      ) {
        return;
      }

      var minutesUntil =
        meet.timeMinutes -
        currentMinutes;

      if (
        minutesUntil < 1 ||
        minutesUntil > 40
      ) {
        return;
      }

      var key =
        makePushEventKey_(
          "meet",
          [
            today,
            meet.dogName,
            meet.time
          ]
        );

      if (
        state[key]
      ) {
        return;
      }

      var result =
        safeSendPushToCategory_(
          "meetGreets",
          {
            title:
              "🤝 Meet & Greet — " +
              meet.dogName,
            body:
              (
                minutesUntil >=
                30
                  ? (
                      "Starts in about " +
                      minutesUntil +
                      " minutes"
                    )
                  : (
                      "Starts in " +
                      minutesUntil +
                      " minutes"
                    )
              ) +
              " · " +
              meet.time,
            link:
              "index.html",
            tag:
              "meet-" +
              today +
              "-" +
              meet.dogName
          }
        );

      if (
        result.sent > 0
      ) {
        state[key] =
          new Date()
            .toISOString();

        sent.meetGreets++;
      }
    }
  );

  var reminderRecords =
    readRemindersNotesRecords_(
      1000
    );

  reminderRecords.forEach(
    function(reminder) {
      if (
        String(
          reminder.status ||
          ""
        )
          .toLowerCase() ===
        "done"
      ) {
        return;
      }

      if (
        reminder.reminderDate !==
        today ||
        !reminder.reminderTime
      ) {
        return;
      }

      var timeMatch =
        String(
          reminder.reminderTime
        ).match(
          /^(\d{2}):(\d{2})$/
        );

      if (!timeMatch) {
        return;
      }

      var dueMinutes =
        (
          Number(
            timeMatch[1]
          ) *
          60
        ) +
        Number(
          timeMatch[2]
        );

      var minutesUntil =
        dueMinutes -
        currentMinutes;

      if (
        minutesUntil < -5 ||
        minutesUntil > 5
      ) {
        return;
      }

      var key =
        makePushEventKey_(
          "reminder",
          [
            reminder.noteId,
            reminder.reminderDate,
            reminder.reminderTime
          ]
        );

      if (
        state[key]
      ) {
        return;
      }

      var title =
        "📌 Reminder" +
        (
          reminder.dogName
            ? (
                " — " +
                reminder.dogName
              )
            : ""
        );

      var result =
        safeSendPushToCategory_(
          "reminders",
          {
            title:
              title,
            body:
              String(
                reminder.note ||
                "Reminder due now."
              ).slice(
                0,
                180
              ),
            link:
              "reminders.html",
            tag:
              "reminder-" +
              reminder.noteId
          }
        );

      if (
        result.sent > 0
      ) {
        state[key] =
          new Date()
            .toISOString();

        sent.reminders++;
      }
    }
  );

  var capacity =
    readFutureCapacityAlerts_(
      sheet,
      timezone,
      30
    );

  var capacitySignature =
    capacity
      .map(
        function(item) {
          return (
            item.date +
            ":" +
            item.count
          );
        }
      )
      .join("|");

  var properties =
    PropertiesService
      .getScriptProperties();

  var previousCapacitySignature =
    String(
      properties.getProperty(
        "WAFFLE_PUSH_CAPACITY_SIGNATURE"
      ) ||
      ""
    );

  if (
    capacitySignature &&
    capacitySignature !==
      previousCapacitySignature
  ) {
    var nextFull =
      capacity[0];

    var capacityResult =
      safeSendPushToCategory_(
        "capacity",
        {
          title:
            "🔴 Capacity Alert",
          body:
            capacity.length === 1
              ? (
                  nextFull.date +
                  " has " +
                  nextFull.count +
                  " dogs."
                )
              : (
                  capacity.length +
                  " high-capacity dates ahead · next " +
                  nextFull.date +
                  " (" +
                  nextFull.count +
                  " dogs)"
                ),
          link:
            "index.html",
          tag:
            "capacity-alert"
        }
      );

    if (
      capacityResult.sent >
      0
    ) {
      properties.setProperty(
        "WAFFLE_PUSH_CAPACITY_SIGNATURE",
        capacitySignature
      );

      sent.capacity++;
    }
  }

  if (
    !capacitySignature &&
    previousCapacitySignature
  ) {
    properties.deleteProperty(
      "WAFFLE_PUSH_CAPACITY_SIGNATURE"
    );
  }

  saveWafflePushEventState_(
    state
  );

  return {
    result:
      "success",
    today:
      today,
    sent:
      sent
  };
}


function sendMorningWafflePushNotifications() {
  var sheet =
    getTargetSheet_();

  var timezone =
    sheet
      .getParent()
      .getSpreadsheetTimeZone() ||
    Session
      .getScriptTimeZone();

  var now =
    new Date();

  var today =
    Utilities.formatDate(
      now,
      timezone,
      "yyyy-MM-dd"
    );

  var properties =
    PropertiesService
      .getScriptProperties();

  var lastDate =
    String(
      properties.getProperty(
        "WAFFLE_PUSH_MORNING_LAST_DATE"
      ) ||
      ""
    );

  if (
    lastDate ===
    today
  ) {
    return {
      result:
        "skipped",
      reason:
        "morning_push_already_sent",
      today:
        today
    };
  }

  var summary =
    buildTodayBoardingNotificationSummary_(
      sheet,
      today,
      timezone
    );

  var results = [];

  if (
    summary.arrivals.length
  ) {
    var arrivalNames =
      summary.arrivals
        .map(
          function(item) {
            return item.dogName;
          }
        )
        .join(", ");

    results.push(
      safeSendPushToCategory_(
        "arrivals",
        {
          title:
            "🏡 " +
            summary.arrivals.length +
            " Arrival" +
            (
              summary.arrivals.length ===
              1
                ? ""
                : "s"
            ) +
            " Today",
          body:
            arrivalNames,
          link:
            "index.html",
          tag:
            "arrivals-" +
            today
        }
      )
    );
  }

  if (
    summary.departures.length
  ) {
    var departureNames =
      summary.departures
        .map(
          function(item) {
            return item.dogName;
          }
        )
        .join(", ");

    results.push(
      safeSendPushToCategory_(
        "departures",
        {
          title:
            "👋 " +
            summary.departures.length +
            " Departure" +
            (
              summary.departures.length ===
              1
                ? ""
                : "s"
            ) +
            " Today",
          body:
            departureNames,
          link:
            "index.html",
          tag:
            "departures-" +
            today
        }
      )
    );
  }

  var state =
    getWafflePushEventState_();

  readRemindersNotesRecords_(
    1000
  ).forEach(
    function(reminder) {
      if (
        String(
          reminder.status ||
          ""
        )
          .toLowerCase() ===
        "done"
      ) {
        return;
      }

      if (
        reminder.reminderDate !==
        today ||
        reminder.reminderTime
      ) {
        return;
      }

      var key =
        makePushEventKey_(
          "date-reminder",
          [
            reminder.noteId,
            today
          ]
        );

      if (
        state[key]
      ) {
        return;
      }

      var result =
        safeSendPushToCategory_(
          "reminders",
          {
            title:
              "📌 Reminder Today" +
              (
                reminder.dogName
                  ? (
                      " — " +
                      reminder.dogName
                    )
                  : ""
              ),
            body:
              String(
                reminder.note ||
                "Reminder scheduled for today."
              ).slice(
                0,
                180
              ),
            link:
              "reminders.html",
            tag:
              "date-reminder-" +
              reminder.noteId
          }
        );

      if (
        result.sent > 0
      ) {
        state[key] =
          new Date()
            .toISOString();
      }
    }
  );

  saveWafflePushEventState_(
    state
  );

  properties.setProperty(
    "WAFFLE_PUSH_MORNING_LAST_DATE",
    today
  );

  return {
    result:
      "success",
    today:
      today,
    arrivals:
      summary.arrivals.length,
    departures:
      summary.departures.length,
    results:
      results
  };
}


function notifyPushIntakeCompleted_(
  stayKey,
  dogName
) {
  return safeSendPushToCategory_(
    "intakeCompleted",
    {
      title:
        "✅ Intake Complete — " +
        String(
          dogName ||
          "Guest"
        ),
      body:
        "The signed Digital Intake has been submitted and saved.",
      link:
        "directory.html?stayKey=" +
        encodeURIComponent(
          String(
            stayKey ||
            ""
          )
        ),
      tag:
        "intake-" +
        String(
          stayKey ||
          dogName ||
          "complete"
        )
    }
  );
}


function setupWaffleHousePushNotifications() {
  getFirebaseMessagingConfig_();

  var properties =
    PropertiesService
      .getScriptProperties();

  if (
    !String(
      properties.getProperty(
        "PUSH_ENROLLMENT_CODE"
      ) ||
      ""
    ).trim()
  ) {
    throw new Error(
      "PUSH_ENROLLMENT_CODE is missing. Add a private setup code in Apps Script Script Properties."
    );
  }

  var sheet =
    getPushSubscriptionsSheet_();

  var timezone =
    getTargetSheet_()
      .getParent()
      .getSpreadsheetTimeZone() ||
    Session
      .getScriptTimeZone();

  var handlers = {
    checkWaffleHousePushNotifications:
      true,
    sendMorningWafflePushNotifications:
      true
  };

  ScriptApp
    .getProjectTriggers()
    .forEach(
      function(trigger) {
        if (
          handlers[
            trigger.getHandlerFunction()
          ]
        ) {
          ScriptApp.deleteTrigger(
            trigger
          );
        }
      }
    );

  var checker =
    ScriptApp
      .newTrigger(
        "checkWaffleHousePushNotifications"
      )
      .timeBased()
      .everyMinutes(5)
      .create();

  var morning =
    ScriptApp
      .newTrigger(
        "sendMorningWafflePushNotifications"
      )
      .timeBased()
      .atHour(7)
      .nearMinute(0)
      .everyDays(1)
      .inTimezone(
        timezone
      )
      .create();

  return {
    result:
      "success",
    sheetName:
      sheet.getName(),
    timezone:
      timezone,
    checker:
      "Every 5 minutes",
    morning:
      "Approximately 7:00 AM",
    checkerTriggerId:
      checker.getUniqueId(),
    morningTriggerId:
      morning.getUniqueId(),
    message:
      "Waffle House V9 push notification triggers are enabled."
  };
}


function resetWaffleHousePushNotificationState() {
  var properties =
    PropertiesService
      .getScriptProperties();

  [
    "WAFFLE_PUSH_EVENT_STATE",
    "WAFFLE_PUSH_CAPACITY_SIGNATURE",
    "WAFFLE_PUSH_MORNING_LAST_DATE"
  ].forEach(
    function(key) {
      properties.deleteProperty(
        key
      );
    }
  );

  return {
    result:
      "success",
    message:
      "Waffle House push duplicate-prevention state has been reset."
  };
}


function verifyWaffleHouseFirebaseCredentials() {
  var result = {
    result:
      "success",
    privateKeyPem:
      false,
    rsaSigning:
      false,
    oauthAccessToken:
      false,
    firebaseProjectId:
      "",
    clientEmail:
      "",
    error:
      ""
  };

  try {
    var config =
      getFirebaseMessagingConfig_();

    result.firebaseProjectId =
      config.projectId;

    result.clientEmail =
      config.clientEmail;

    result.privateKeyPem =
      (
        config.privateKey.indexOf(
          "-----BEGIN PRIVATE KEY-----"
        ) ===
          0 &&
        config.privateKey.indexOf(
          "-----END PRIVATE KEY-----"
        ) !==
          -1
      );

    Utilities.computeRsaSha256Signature(
      "waffle-house-firebase-key-test",
      config.privateKey,
      Utilities.Charset.UTF_8
    );

    result.rsaSigning =
      true;

    CacheService
      .getScriptCache()
      .remove(
        "waffle_fcm_access_token"
      );

    var token =
      getFirebaseMessagingAccessToken_();

    result.oauthAccessToken =
      !!token;

  } catch (error) {
    result.result =
      "error";

    result.error =
      error &&
      error.message
        ? error.message
        : String(error);
  }

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


function verifyWaffleHousePushNotifications() {
  var config = null;
  var configError = "";

  try {
    config =
      getFirebaseMessagingConfig_();
  } catch (error) {
    configError =
      error.message;
  }

  var sheet =
    getPushSubscriptionsSheet_();

  var active = 0;

  if (
    sheet.getLastRow() >=
    2
  ) {
    var values =
      sheet
        .getRange(
          2,
          8,
          sheet.getLastRow() - 1,
          1
        )
        .getValues();

    values.forEach(
      function(row) {
        if (
          row[0] === true ||
          String(row[0])
            .toLowerCase() ===
            "true"
        ) {
          active++;
        }
      }
    );
  }

  var triggers =
    ScriptApp
      .getProjectTriggers()
      .filter(
        function(trigger) {
          var handler =
            trigger.getHandlerFunction();

          return (
            handler ===
              "checkWaffleHousePushNotifications" ||
            handler ===
              "sendMorningWafflePushNotifications"
          );
        }
      )
      .map(
        function(trigger) {
          return {
            handler:
              trigger.getHandlerFunction(),
            uniqueId:
              trigger.getUniqueId()
          };
        }
      );

  return {
    result:
      configError
        ? "warning"
        : "success",
    firebaseConfigured:
      !!config,
    firebaseProjectId:
      config
        ? config.projectId
        : "",
    configError:
      configError,
    activeDevices:
      active,
    sheetName:
      sheet.getName(),
    triggerCount:
      triggers.length,
    triggers:
      triggers
  };
}




/* ========================================================================
 * WAFFLE HOUSE EMAIL NOTIFICATIONS
 * ========================================================================
 *
 * 1) MORNING BOARDING MOVEMENTS
 *    One email at approximately 7:00 AM each day if there are:
 *      - new boarding arrivals today; and/or
 *      - boarding departures/offboarding today.
 *
 * 2) MEET & GREET REMINDERS
 *    A separate reminder email approximately 30 minutes before EACH
 *    Meet & Greet. A 5-minute checker is used so newly-added same-day
 *    bookings are also picked up without rebuilding triggers.
 *
 * Potential Stay rows are ignored.
 */


/**
 * Run this function ONCE manually after installing this version.
 *
 * It removes notification triggers created by the previous version and creates:
 *   - one daily morning trigger around 7:00 AM;
 *   - one Meet & Greet checker every 5 minutes.
 *
 * The checker uses a 30-40 minute reminder window. This gives the
 * recurring trigger more than one opportunity to send while still
 * ensuring the normal reminder is at least 30 minutes before the booking.
 */
function setupBoardingEmailNotifications() {
  var properties = PropertiesService.getScriptProperties();
  var recipient = String(
    properties.getProperty("DAILY_NOTIFICATION_EMAIL") || ""
  ).trim();

  if (!recipient) {
    recipient = String(Session.getEffectiveUser().getEmail() || "").trim();

    if (recipient) {
      properties.setProperty("DAILY_NOTIFICATION_EMAIL", recipient);
    }
  }

  if (!recipient) {
    throw new Error(
      "DAILY_NOTIFICATION_EMAIL is not configured. Add it under Apps Script > " +
      "Project Settings > Script Properties, then run setupBoardingEmailNotifications() again."
    );
  }

  var sheet = getTargetSheet_();
  var timezone =
    sheet.getParent().getSpreadsheetTimeZone() ||
    Session.getScriptTimeZone();

  var handlersToReplace = {
    sendBoardingEmailNotifications: true,
    sendMorningBoardingEmailNotification: true,
    checkMeetGreetEmailReminders: true
  };

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlersToReplace[trigger.getHandlerFunction()]) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  var morningTrigger = ScriptApp
    .newTrigger("sendMorningBoardingEmailNotification")
    .timeBased()
    .atHour(7)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone(timezone)
    .create();

  var meetGreetTrigger = ScriptApp
    .newTrigger("checkMeetGreetEmailReminders")
    .timeBased()
    .everyMinutes(5)
    .create();

  return {
    result: "success",
    recipient: recipient,
    timezone: timezone,
    morningEmail: "Approximately 7:00 AM daily when there is an arrival and/or departure",
    meetGreetReminder: "30-40 minutes before each Meet & Greet",
    meetGreetCheckFrequency: "Every 5 minutes",
    morningTriggerId: morningTrigger.getUniqueId(),
    meetGreetTriggerId: meetGreetTrigger.getUniqueId(),
    message: "Waffle House arrival, departure and Meet & Greet email notifications are enabled."
  };
}


/**
 * Backward-compatible handler for any old trigger that briefly remains before
 * setupBoardingEmailNotifications() is run.
 */
function sendBoardingEmailNotifications() {
  return sendMorningBoardingEmailNotification();
}


/**
 * DAILY MORNING EMAIL.
 *
 * Sends once for the local date if there is at least one arrival or departure.
 * It intentionally does NOT send a Meet-&-Greet-only morning email. Meet &
 * Greets now receive their own reminder approximately 30 minutes beforehand.
 */
function sendMorningBoardingEmailNotification() {
  return sendMorningBoardingEmailNotification_({
    force: false,
    isTest: false
  });
}


/**
 * Sends a TEST morning email immediately, even if there are no boarding
 * movements today. Does not consume today's duplicate-prevention state.
 */
function testMorningBoardingEmailNotification() {
  return sendMorningBoardingEmailNotification_({
    force: true,
    isTest: true
  });
}


/**
 * Legacy test function name retained for convenience.
 */
function testBoardingEmailNotifications() {
  return testMorningBoardingEmailNotification();
}


function sendMorningBoardingEmailNotification_(options) {
  options = options || {};

  var sheet = getTargetSheet_();
  var spreadsheet = sheet.getParent();
  var timezone =
    spreadsheet.getSpreadsheetTimeZone() ||
    Session.getScriptTimeZone();

  var now = new Date();
  var today = Utilities.formatDate(now, timezone, "yyyy-MM-dd");

  var summary = buildTodayBoardingNotificationSummary_(
    sheet,
    today,
    timezone
  );

  var hasMovements =
    summary.arrivals.length > 0 ||
    summary.departures.length > 0;

  if (!hasMovements && !options.force) {
    return {
      result: "skipped",
      reason: "no_boarding_arrivals_or_departures_today",
      today: today
    };
  }

  var properties = PropertiesService.getScriptProperties();
  var lastMorningDate = String(
    properties.getProperty("WAFFLE_MORNING_EMAIL_LAST_DATE") || ""
  );

  if (!options.force && lastMorningDate === today) {
    return {
      result: "skipped",
      reason: "morning_email_already_sent",
      today: today
    };
  }

  var recipient = getBoardingNotificationRecipient_();
  var email = buildMorningBoardingEmail_(
    summary,
    today,
    timezone,
    !!options.isTest
  );

  sendWaffleNotificationEmail_(recipient, email);

  if (!options.isTest) {
    properties.setProperty(
      "WAFFLE_MORNING_EMAIL_LAST_DATE",
      today
    );
  }

  return {
    result: "success",
    type: "morning_boarding_movements",
    recipient: recipient,
    subject: email.subject,
    today: today,
    arrivals: summary.arrivals.length,
    departures: summary.departures.length,
    activeBoardings: summary.activeBoardings.length,
    test: !!options.isTest
  };
}


/**
 * Checks today's Meet & Greets and sends individual reminders BEFORE the
 * 30-minute mark.
 *
 * The trigger runs every 5 minutes and the normal send window is 30-40
 * minutes before the Meet & Greet. This intentionally gives Apps Script
 * multiple opportunities to send the reminder while ensuring the normal
 * reminder is not sent with less than 30 minutes remaining.
 *
 * A late safety-net reminder is also sent if a qualifying booking somehow
 * reaches 1-29 minutes remaining without a recorded reminder. This prevents
 * a silent miss if a trigger was delayed, disabled temporarily, or the
 * booking was created less than 30 minutes beforehand.
 */
function checkMeetGreetEmailReminders() {
  return checkMeetGreetEmailReminders_({
    force: false,
    isTest: false
  });
}


/**
 * Test helper:
 * Sends a TEST reminder for the next Meet & Greet scheduled today, regardless
 * of how far away it is. If there are no Meet & Greets today it throws a clear
 * message so test data can be added first.
 */
function testMeetGreetEmailReminder() {
  return checkMeetGreetEmailReminders_({
    force: true,
    isTest: true
  });
}


function checkMeetGreetEmailReminders_(options) {
  options = options || {};

  var sheet = getTargetSheet_();
  var spreadsheet = sheet.getParent();
  var timezone =
    spreadsheet.getSpreadsheetTimeZone() ||
    Session.getScriptTimeZone();

  var now = new Date();
  var today = Utilities.formatDate(now, timezone, "yyyy-MM-dd");

  var currentHour = Number(
    Utilities.formatDate(now, timezone, "H")
  );
  var currentMinute = Number(
    Utilities.formatDate(now, timezone, "m")
  );
  var currentMinutesOfDay =
    (currentHour * 60) + currentMinute;

  var summary = buildTodayBoardingNotificationSummary_(
    sheet,
    today,
    timezone
  );

  if (!summary.meetGreets.length) {
    if (options.force) {
      throw new Error(
        "There are no Meet & Greets scheduled today to use for a test reminder."
      );
    }

    return {
      result: "skipped",
      reason: "no_meet_greets_today",
      today: today
    };
  }

  var reminderState = getMeetGreetReminderState_();
  var recipient = getBoardingNotificationRecipient_();
  var sent = [];
  var eligible = [];

  summary.meetGreets.forEach(function(meet) {
    if (meet.timeMinutes === null) {
      return;
    }

    var reminderKey = makeMeetGreetReminderKey_(
      today,
      meet
    );

    var minutesUntil =
      meet.timeMinutes - currentMinutesOfDay;

    var normalReminderWindow =
      minutesUntil >= 30 &&
      minutesUntil <= 40;

    var lateSafetyNet =
      minutesUntil >= 1 &&
      minutesUntil < 30;

    var shouldSend =
      options.force ||
      (
        !reminderState[reminderKey] &&
        (
          normalReminderWindow ||
          lateSafetyNet
        )
      );

    if (!shouldSend) {
      return;
    }

    eligible.push({
      meet: meet,
      reminderKey: reminderKey,
      minutesUntil: minutesUntil,
      lateSafetyNet: !options.force && lateSafetyNet
    });
  });

  if (options.force && eligible.length > 1) {
    eligible.sort(function(a, b) {
      return a.meet.timeMinutes - b.meet.timeMinutes;
    });

    eligible = [eligible[0]];
  }

  eligible.forEach(function(item) {
    var email = buildMeetGreetReminderEmail_(
      item.meet,
      today,
      timezone,
      item.minutesUntil,
      !!options.isTest,
      !!item.lateSafetyNet
    );

    sendWaffleNotificationEmail_(
      recipient,
      email
    );

    sent.push({
      dogName: item.meet.dogName,
      time: item.meet.time,
      minutesUntil: item.minutesUntil,
      lateSafetyNet: !!item.lateSafetyNet,
      subject: email.subject
    });

    if (!options.isTest) {
      reminderState[item.reminderKey] =
        new Date().toISOString();
    }
  });

  if (!options.isTest && sent.length) {
    saveMeetGreetReminderState_(
      today,
      reminderState
    );
  }

  if (!sent.length) {
    return {
      result: "skipped",
      reason: "no_meet_greet_is_within_the_reminder_window",
      today: today
    };
  }

  return {
    result: "success",
    type: "meet_greet_reminder",
    recipient: recipient,
    today: today,
    sent: sent,
    test: !!options.isTest
  };
}


/**
 * Run manually if you want to verify Meet & Greet reminder health.
 * Returns the configured recipient, timezone, trigger status and all Meet &
 * Greets found for today with their minutes remaining.
 */
function verifyMeetGreetEmailNotifications() {
  var sheet = getTargetSheet_();
  var spreadsheet = sheet.getParent();
  var timezone =
    spreadsheet.getSpreadsheetTimeZone() ||
    Session.getScriptTimeZone();

  var now = new Date();
  var today = Utilities.formatDate(now, timezone, "yyyy-MM-dd");
  var currentHour = Number(Utilities.formatDate(now, timezone, "H"));
  var currentMinute = Number(Utilities.formatDate(now, timezone, "m"));
  var currentMinutesOfDay = (currentHour * 60) + currentMinute;

  var summary = buildTodayBoardingNotificationSummary_(
    sheet,
    today,
    timezone
  );

  var triggers = ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === "checkMeetGreetEmailReminders";
    })
    .map(function(trigger) {
      return {
        handler: trigger.getHandlerFunction(),
        eventType: String(trigger.getEventType()),
        triggerSource: String(trigger.getTriggerSource()),
        uniqueId: trigger.getUniqueId()
      };
    });

  var reminderState = getMeetGreetReminderState_();

  var meetGreets = summary.meetGreets.map(function(meet) {
    var reminderKey = makeMeetGreetReminderKey_(today, meet);
    var minutesUntil =
      meet.timeMinutes === null
        ? null
        : meet.timeMinutes - currentMinutesOfDay;

    return {
      dogName: meet.dogName,
      breed: meet.breed,
      time: meet.time,
      minutesUntil: minutesUntil,
      reminderAlreadySent: !!reminderState[reminderKey],
      inNormalReminderWindow:
        minutesUntil !== null &&
        minutesUntil >= 30 &&
        minutesUntil <= 40
    };
  });

  return {
    result: "success",
    recipient: getBoardingNotificationRecipient_(),
    timezone: timezone,
    nowLocal: Utilities.formatDate(now, timezone, "yyyy-MM-dd HH:mm:ss"),
    today: today,
    reminderPolicy: "Normal reminder sends with 30-40 minutes remaining; checker runs every 5 minutes.",
    triggerInstalled: triggers.length > 0,
    triggerCount: triggers.length,
    triggers: triggers,
    meetGreets: meetGreets
  };
}


/**
 * Clears duplicate-prevention state for both the 7 AM email and Meet & Greet
 * reminders. Useful during testing.
 */
function resetBoardingEmailNotificationState() {
  var properties = PropertiesService.getScriptProperties();

  properties.deleteProperty(
    "WAFFLE_MORNING_EMAIL_LAST_DATE"
  );

  properties.deleteProperty(
    "WAFFLE_MEET_REMINDER_STATE"
  );

  // Clean up state keys from the previous notification version too.
  properties.deleteProperty(
    "WAFFLE_NOTIFICATION_LAST_DATE"
  );

  properties.deleteProperty(
    "WAFFLE_NOTIFICATION_LAST_SIGNATURE"
  );

  return {
    result: "success",
    message: "Waffle House email notification state has been reset."
  };
}


function getBoardingNotificationRecipient_() {
  var properties = PropertiesService.getScriptProperties();

  var recipient = String(
    properties.getProperty("DAILY_NOTIFICATION_EMAIL") || ""
  )
    .replace(/;/g, ",")
    .trim();

  if (!recipient) {
    recipient = String(
      Session.getEffectiveUser().getEmail() || ""
    ).trim();
  }

  if (!recipient) {
    throw new Error(
      "DAILY_NOTIFICATION_EMAIL is missing. Add the recipient email address " +
      "under Apps Script > Project Settings > Script Properties."
    );
  }

  return recipient;
}


function sendWaffleNotificationEmail_(recipient, email) {
  if (MailApp.getRemainingDailyQuota() < 1) {
    throw new Error(
      "Google Apps Script email quota has been reached for today."
    );
  }

  MailApp.sendEmail({
    to: recipient,
    subject: email.subject,
    body: email.textBody,
    htmlBody: email.htmlBody,
    name: "Waffle House"
  });
}


function buildTodayBoardingNotificationSummary_(
  sheet,
  today,
  timezone
) {
  var values = sheet.getDataRange().getValues();

  var summary = {
    meetGreets: [],
    arrivals: [],
    departures: [],
    activeBoardings: []
  };

  for (var i = 1; i < values.length; i++) {
    var row = values[i];

    var dogName = String(row[1] || "").trim();
    if (!dogName) continue;

    var breed =
      String(row[2] || "").trim() ||
      "Unknown";

    var startDate =
      normalizeDateValueForTimezone_(
        row[3],
        timezone
      );

    var endDate =
      normalizeDateValueForTimezone_(
        row[4],
        timezone
      ) || startDate;

    var ownerName =
      String(row[5] || "").trim();

    var phone =
      String(row[6] || "").trim();

    var notes =
      String(row[9] || "").trim();

    var bookingType =
      String(row[11] || "").trim();

    var typeLower =
      bookingType.toLowerCase();

    if (!startDate) continue;

    // Potential Stays do not generate operational notifications.
    if (typeLower === "potential stay") {
      continue;
    }

    if (typeLower === "meet & greet") {
      if (startDate === today) {
        var parsedMeetTime =
          extractMeetGreetTime_(notes);

        summary.meetGreets.push({
          dogName: dogName,
          breed: breed,
          time: parsedMeetTime.display,
          timeMinutes: parsedMeetTime.minutes,
          notes: notes
        });
      }

      continue;
    }

    // Match the web app: every non-Potential, non-Meet&Greet row is treated
    // as boarding, including historical rows with a blank Booking Type.
    if (
      startDate <= today &&
      today <= endDate
    ) {
      summary.activeBoardings.push({
        dogName: dogName,
        breed: breed,
        ownerName: ownerName,
        phone: phone,
        startDate: startDate,
        endDate: endDate,
        bookingType:
          bookingType || "Boarding"
      });
    }

    if (startDate === today) {
      summary.arrivals.push({
        dogName: dogName,
        breed: breed,
        ownerName: ownerName,
        phone: phone,
        startDate: startDate,
        endDate: endDate,
        bookingType:
          bookingType || "Boarding"
      });
    }

    if (endDate === today) {
      summary.departures.push({
        dogName: dogName,
        breed: breed,
        ownerName: ownerName,
        phone: phone,
        startDate: startDate,
        endDate: endDate,
        bookingType:
          bookingType || "Boarding"
      });
    }
  }

  summary.meetGreets.sort(function(a, b) {
    var aMinutes =
      a.timeMinutes === null
        ? 24 * 60
        : a.timeMinutes;

    var bMinutes =
      b.timeMinutes === null
        ? 24 * 60
        : b.timeMinutes;

    return aMinutes - bMinutes;
  });

  summary.arrivals.sort(function(a, b) {
    return a.dogName.localeCompare(
      b.dogName
    );
  });

  summary.departures.sort(function(a, b) {
    return a.dogName.localeCompare(
      b.dogName
    );
  });

  summary.activeBoardings.sort(function(a, b) {
    return a.dogName.localeCompare(
      b.dogName
    );
  });

  return summary;
}


function normalizeDateValueForTimezone_(
  value,
  timezone
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  if (
    Object.prototype.toString.call(value) === "[object Date]" &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      timezone,
      "yyyy-MM-dd"
    );
  }

  var text = String(value).trim();
  if (!text) return "";

  var isoMatch =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (isoMatch) {
    return (
      isoMatch[1] +
      "-" +
      isoMatch[2] +
      "-" +
      isoMatch[3]
    );
  }

  var auMatch =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (auMatch) {
    return (
      auMatch[3] +
      "-" +
      pad2_(auMatch[2]) +
      "-" +
      pad2_(auMatch[1])
    );
  }

  var parsed = new Date(text);

  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(
      parsed,
      timezone,
      "yyyy-MM-dd"
    );
  }

  return text;
}


/**
 * Supports the current web app format "Meet & Greet scheduled at 14:30".
 * Also accepts common 12-hour forms such as 2:30 PM.
 */
function extractMeetGreetTime_(notes) {
  var text = String(notes || "").trim();

  var twelveHour = text.match(
    /\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i
  );

  if (twelveHour) {
    var hour12 = Number(twelveHour[1]);
    var minute12 = Number(twelveHour[2]);
    var meridiem =
      String(twelveHour[3]).toUpperCase();

    if (
      hour12 >= 1 &&
      hour12 <= 12 &&
      minute12 >= 0 &&
      minute12 <= 59
    ) {
      var hour24 =
        hour12 % 12;

      if (meridiem === "PM") {
        hour24 += 12;
      }

      return {
        display:
          pad2_(hour24) +
          ":" +
          pad2_(minute12),
        minutes:
          (hour24 * 60) +
          minute12
      };
    }
  }

  var twentyFourHour = text.match(
    /\b([01]?\d|2[0-3]):([0-5]\d)\b/
  );

  if (twentyFourHour) {
    var hour =
      Number(twentyFourHour[1]);

    var minute =
      Number(twentyFourHour[2]);

    return {
      display:
        pad2_(hour) +
        ":" +
        pad2_(minute),
      minutes:
        (hour * 60) +
        minute
    };
  }

  return {
    display: "Time not listed",
    minutes: null
  };
}


function makeMeetGreetReminderKey_(
  dateString,
  meet
) {
  return [
    dateString,
    String(meet.dogName || "")
      .trim()
      .toLowerCase(),
    String(meet.time || "")
  ].join("|");
}


function getMeetGreetReminderState_() {
  var raw = String(
    PropertiesService
      .getScriptProperties()
      .getProperty(
        "WAFFLE_MEET_REMINDER_STATE"
      ) || ""
  );

  if (!raw) {
    return {};
  }

  try {
    var parsed = JSON.parse(raw);

    return parsed &&
      typeof parsed === "object"
      ? parsed
      : {};
  } catch (error) {
    return {};
  }
}


function saveMeetGreetReminderState_(
  today,
  state
) {
  var cleaned = {};

  Object.keys(state || {}).forEach(
    function(key) {
      if (
        String(key).indexOf(
          today + "|"
        ) === 0
      ) {
        cleaned[key] = state[key];
      }
    }
  );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      "WAFFLE_MEET_REMINDER_STATE",
      JSON.stringify(cleaned)
    );
}


function buildMorningBoardingEmail_(
  summary,
  today,
  timezone,
  isTest
) {
  var todayDate =
    new Date(
      today + "T12:00:00"
    );

  var displayDate =
    Utilities.formatDate(
      todayDate,
      timezone,
      "EEEE, d MMMM yyyy"
    );

  var subjectParts = [];

  if (summary.arrivals.length) {
    subjectParts.push(
      summary.arrivals.length +
      " arrival" +
      (
        summary.arrivals.length === 1
          ? ""
          : "s"
      )
    );
  }

  if (summary.departures.length) {
    subjectParts.push(
      summary.departures.length +
      " departure" +
      (
        summary.departures.length === 1
          ? ""
          : "s"
      )
    );
  }

  if (!subjectParts.length) {
    subjectParts.push(
      "No boarding movements"
    );
  }

  var subject =
    (isTest ? "[TEST] " : "") +
    "🐾 Waffle House 7 AM — " +
    subjectParts.join(" • ") +
    " — " +
    Utilities.formatDate(
      todayDate,
      timezone,
      "d MMM"
    );

  var html = [];

  html.push(
    '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#1f2937;">'
  );

  html.push(
    '<h2 style="margin-bottom:4px;">🐾 Waffle House Morning Handover</h2>'
  );

  html.push(
    '<div style="color:#64748b;margin-bottom:20px;">' +
    escapeHtmlEmail_(displayDate) +
    "</div>"
  );

  if (isTest) {
    html.push(
      '<div style="background:#eff6ff;border-left:4px solid #2563eb;padding:10px 12px;margin-bottom:16px;">' +
      "<strong>TEST EMAIL:</strong> This verifies the 7 AM boarding movement email." +
      "</div>"
    );
  }

  if (summary.arrivals.length) {
    html.push(
      '<h3 style="color:#166534;margin-bottom:8px;">🏡 New Boarding Arrivals Today</h3>'
    );

    html.push(
      buildBoardingEmailList_(
        summary.arrivals,
        "arrival"
      )
    );
  }

  if (summary.departures.length) {
    html.push(
      '<h3 style="color:#b91c1c;margin-bottom:8px;">👋 Offboarding / Departures Today</h3>'
    );

    html.push(
      buildBoardingEmailList_(
        summary.departures,
        "departure"
      )
    );
  }

  if (
    !summary.arrivals.length &&
    !summary.departures.length
  ) {
    html.push(
      '<div style="background:#f8fafc;padding:12px;border-radius:8px;">' +
      "No boarding arrivals or departures are scheduled today." +
      "</div>"
    );
  }

  html.push(
    '<div style="margin-top:18px;padding:10px 12px;background:#f8fafc;border-radius:8px;color:#475569;">' +
    "<strong>Boarding guests active today:</strong> " +
    summary.activeBoardings.length +
    "</div>"
  );

  html.push(
    '<div style="margin-top:22px;color:#94a3b8;font-size:12px;">' +
    "Meet & Greet reminders are sent separately approximately 30 minutes before each booking." +
    "</div>"
  );

  html.push("</div>");

  var text = [];

  text.push(
    "Waffle House Morning Handover"
  );
  text.push(displayDate);
  text.push("");

  if (summary.arrivals.length) {
    text.push(
      "NEW BOARDING ARRIVALS TODAY"
    );

    summary.arrivals.forEach(
      function(item) {
        text.push(
          "- " +
          item.dogName +
          " (" +
          item.breed +
          ")" +
          " | Owner: " +
          (
            item.ownerName ||
            "N/A"
          ) +
          " | Contact: " +
          (
            item.phone ||
            "N/A"
          ) +
          " | Stay: " +
          item.startDate +
          " to " +
          item.endDate
        );
      }
    );

    text.push("");
  }

  if (summary.departures.length) {
    text.push(
      "OFFBOARDING / DEPARTURES TODAY"
    );

    summary.departures.forEach(
      function(item) {
        text.push(
          "- " +
          item.dogName +
          " (" +
          item.breed +
          ")" +
          " | Owner: " +
          (
            item.ownerName ||
            "N/A"
          ) +
          " | Contact: " +
          (
            item.phone ||
            "N/A"
          )
        );
      }
    );

    text.push("");
  }

  if (
    !summary.arrivals.length &&
    !summary.departures.length
  ) {
    text.push(
      "No boarding arrivals or departures are scheduled today."
    );
    text.push("");
  }

  text.push(
    "Boarding guests active today: " +
    summary.activeBoardings.length
  );

  return {
    subject: subject,
    htmlBody: html.join(""),
    textBody: text.join("\n")
  };
}


function buildMeetGreetReminderEmail_(
  meet,
  today,
  timezone,
  minutesUntil,
  isTest,
  isLateSafetyNet
) {
  var todayDate =
    new Date(
      today + "T12:00:00"
    );

  var displayDate =
    Utilities.formatDate(
      todayDate,
      timezone,
      "EEEE, d MMMM yyyy"
    );

  var subject =
    (isTest ? "[TEST] " : "") +
    (isLateSafetyNet ? "⚠️ Meet & Greet soon — " : "🤝 Meet & Greet reminder — ") +
    meet.time +
    " — " +
    meet.dogName;

  var html = [];

  html.push(
    '<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1f2937;">'
  );

  html.push(
    '<div style="background:#f0fdfa;border-left:5px solid #0f766e;padding:16px;border-radius:8px;">'
  );

  if (isLateSafetyNet) {
    html.push(
      '<div style="background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;padding:9px 10px;border-radius:7px;margin-bottom:10px;font-size:13px;font-weight:700;">' +
      "⚠️ Safety-net reminder: the booking is now less than 30 minutes away. " +
      "The normal reminder window is 30-40 minutes before the booking." +
      "</div>"
    );
  }

  html.push(
    '<div style="font-size:13px;color:#7e22ce;font-weight:700;text-transform:uppercase;">Meet & Greet Reminder</div>'
  );

  html.push(
    '<h2 style="margin:6px 0 4px;">🤝 ' +
    escapeHtmlEmail_(
      meet.dogName
    ) +
    "</h2>"
  );

  html.push(
    '<div style="font-size:18px;font-weight:800;color:#6b21a8;">⏰ ' +
    escapeHtmlEmail_(
      meet.time
    ) +
    "</div>"
  );

  html.push(
    '<div style="margin-top:8px;">' +
    escapeHtmlEmail_(
      meet.breed
    ) +
    "</div>"
  );

  html.push(
    '<div style="margin-top:5px;color:#64748b;">' +
    escapeHtmlEmail_(
      displayDate
    ) +
    "</div>"
  );

  if (!isTest && isFinite(minutesUntil)) {
    html.push(
      '<div style="margin-top:12px;font-weight:700;">Scheduled in approximately ' +
      Math.max(
        0,
        Math.round(
          minutesUntil
        )
      ) +
      " minutes.</div>"
    );
  }

  if (meet.notes) {
    html.push(
      '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e9d5ff;font-size:13px;color:#475569;">' +
      "<strong>Booking notes:</strong> " +
      escapeHtmlEmail_(
        meet.notes
      ) +
      "</div>"
    );
  }

  html.push("</div>");
  html.push("</div>");

  var text = [
    "Meet & Greet Reminder",
    displayDate,
    "",
    meet.time +
      " — " +
      meet.dogName +
      " (" +
      meet.breed +
      ")"
  ];

  if (!isTest && isFinite(minutesUntil)) {
    text.push(
      "Scheduled in approximately " +
      Math.max(
        0,
        Math.round(
          minutesUntil
        )
      ) +
      " minutes."
    );
  }

  if (meet.notes) {
    text.push(
      "Notes: " +
      meet.notes
    );
  }

  return {
    subject: subject,
    htmlBody: html.join(""),
    textBody: text.join("\n")
  };
}


function buildBoardingEmailList_(
  items,
  mode
) {
  var html = [
    '<div style="display:block;">'
  ];

  items.forEach(
    function(item) {
      var dateText =
        mode === "arrival"
          ? (
            "Stay: " +
            item.startDate +
            " → " +
            item.endDate
          )
          : (
            "Checkout date: " +
            item.endDate
          );

      html.push(
        '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:11px 12px;margin-bottom:9px;">' +
        '<div style="font-size:16px;font-weight:700;">🐾 ' +
        escapeHtmlEmail_(
          item.dogName
        ) +
        "</div>" +
        '<div style="color:#64748b;margin-top:3px;">' +
        escapeHtmlEmail_(
          item.breed
        ) +
        "</div>" +
        '<div style="margin-top:7px;font-size:13px;">' +
        "<strong>Owner:</strong> " +
        escapeHtmlEmail_(
          item.ownerName ||
          "N/A"
        ) +
        " &nbsp; • &nbsp; " +
        "<strong>Contact:</strong> " +
        escapeHtmlEmail_(
          item.phone ||
          "N/A"
        ) +
        "</div>" +
        '<div style="margin-top:5px;font-size:13px;color:#475569;">' +
        escapeHtmlEmail_(
          dateText
        ) +
        "</div>" +
        "</div>"
      );
    }
  );

  html.push("</div>");
  return html.join("");
}


function escapeHtmlEmail_(value) {
  return String(
    value === null ||
    value === undefined
      ? ""
      : value
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


