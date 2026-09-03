/* ========================================================================
 * WAFFLE HOUSE V11.2.05 — REUSE STORED LEGACY INTAKE FILES
 * ========================================================================
 * The Legacy Intake scanner is hosted by Apps Script, so it can read the
 * existing Legacy_Intake_Documents sheet directly through google.script.run.
 * This helper exposes the files already stored for a selected stay so staff
 * can OCR an existing document again without uploading a duplicate copy.
 */

function getLegacyIntakeStoredDocumentsForHtmlV11205(payload) {
  payload =
    payload &&
    typeof payload === "object"
      ? payload
      : {};

  var documentId =
    String(
      payload.documentId || ""
    ).trim();

  var stayKey =
    String(
      payload.stayKey || ""
    ).trim();

  var sheet =
    getLegacyIntakeSheet_();

  if (documentId) {
    var anchor =
      findLegacyIntakeDocumentById_(
        sheet,
        documentId
      );

    if (!anchor) {
      throw new Error(
        "The selected stored legacy intake could not be found."
      );
    }

    if (!stayKey) {
      stayKey =
        String(
          anchor.stayKey || ""
        ).trim();
    }
  }

  if (!stayKey) {
    throw new Error(
      "A guest/stay is required to load stored legacy intake files."
    );
  }

  if (sheet.getLastRow() < 2) {
    return {
      result: "success",
      stayKey: stayKey,
      documents: []
    };
  }

  var values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        LEGACY_INTAKE_HEADERS_.length
      )
      .getValues();

  var documents = [];

  values.forEach(
    function(row, index) {
      var record =
        legacyIntakeRowToObject_(
          row,
          index + 2
        );

      if (
        String(
          record.stayKey || ""
        ).trim() !== stayKey
      ) {
        return;
      }

      var parsedFields =
        record.parsedFields &&
        typeof record.parsedFields === "object"
          ? record.parsedFields
          : {};

      documents.push({
        documentId:
          String(
            record.documentId || ""
          ),
        stayKey:
          String(
            record.stayKey || ""
          ),
        dogName:
          String(
            record.dogName || ""
          ),
        uploadedAt:
          String(
            record.uploadedAt || ""
          ),
        updatedAt:
          String(
            record.updatedAt || ""
          ),
        originalFilename:
          String(
            record.originalFilename ||
            "Legacy intake"
          ),
        pdfUrl:
          String(
            record.pdfUrl || ""
          ),
        aiStatus:
          String(
            record.aiStatus ||
            "Not processed yet"
          ),
        extractionMethod:
          String(
            record.extractionMethod ||
            record.ocrMethod ||
            ""
          ),
        hasExtraction:
          Object.keys(
            parsedFields
          ).length > 0,
        conflictCount:
          Array.isArray(
            record.reviewConflicts
          )
            ? record.reviewConflicts.length
            : 0
      });
    }
  );

  documents.sort(
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

  return {
    result: "success",
    stayKey: stayKey,
    selectedDocumentId:
      documentId,
    documents:
      documents
  };
}
