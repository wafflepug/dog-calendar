/* ============================================================
 * WAFFLE HOUSE V11.1.91 / V11.2.02 — LEGACY INTAKE MEDIA UPLOAD
 * ------------------------------------------------------------
 * Adds photo/image intake support without creating a second profile-write path.
 * PDFs delegate directly to the established Legacy Intake workflow. Images are
 * converted into a private PDF record first, then handed to the exact same
 * Gemini extraction, field mapping, conflict review and Audit workflow.
 *
 * V11.2.02 resilience:
 * - transient Gemini capacity/high-demand failures are retried automatically;
 * - retries reuse the already-saved private PDF (never duplicate the upload);
 * - exhausted transient failures become "Retry Needed" instead of a hard
 *   "AI Failed" state, with a short user-safe message and manual retry support.
 * ============================================================ */

var LEGACY_INTAKE_AI_RETRY_DELAYS_V11202_ = [1200, 3500];


function decodeLegacyIntakeImageV11191_(fileData, fileName) {
  var match = String(fileData || '').match(
    /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i
  );

  if (!match) {
    throw new Error(
      'Please choose a PDF, JPG, PNG or WebP image. If your phone uses HEIC, choose the photo from your browser/photo library so it can be converted to JPEG first.'
    );
  }

  var mimeType = String(match[1] || '').toLowerCase();
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

  var bytes = Utilities.base64Decode(match[2]);

  if (bytes.length > 8 * 1024 * 1024) {
    throw new Error(
      'The image is larger than 8 MB after preparation. Please use a smaller photo and try again.'
    );
  }

  var extension =
    mimeType === 'image/png'
      ? '.png'
      : mimeType === 'image/webp'
        ? '.webp'
        : '.jpg';

  var safeName = String(fileName || ('Legacy Intake' + extension))
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 120) || ('Legacy Intake' + extension);

  return Utilities.newBlob(bytes, mimeType, safeName);
}


function legacyIntakeImageToPdfV11191_(imageBlob, fileName) {
  var tempDoc = DocumentApp.create(
    'Waffle Legacy Intake Photo ' + Utilities.getUuid()
  );

  try {
    var body = tempDoc.getBody();
    body.clear();

    var heading = body.appendParagraph('WAFFLE HOUSE — LEGACY INTAKE PHOTO');
    heading.setHeading(DocumentApp.ParagraphHeading.HEADING1);

    body.appendParagraph(
      'Original image: ' + String(fileName || imageBlob.getName() || 'Legacy intake photo')
    );

    body.appendParagraph('');

    var image = body.appendImage(imageBlob);

    try {
      var width = Number(image.getWidth() || 0);
      var height = Number(image.getHeight() || 0);
      var maxWidth = 520;

      if (width > maxWidth && width > 0 && height > 0) {
        image.setWidth(maxWidth);
        image.setHeight(Math.max(1, Math.round(height * maxWidth / width)));
      }
    } catch (_) {}

    tempDoc.saveAndClose();

    var docFile = DriveApp.getFileById(tempDoc.getId());
    var baseName = String(fileName || 'Legacy Intake Photo')
      .replace(/\.[^.]+$/, '')
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100) || 'Legacy Intake Photo';

    var pdfBlob = docFile
      .getAs(MimeType.PDF)
      .setName(baseName + '.pdf');

    try { docFile.setTrashed(true); } catch (_) {}

    return pdfBlob;
  } catch (error) {
    try {
      tempDoc.saveAndClose();
      DriveApp.getFileById(tempDoc.getId()).setTrashed(true);
    } catch (_) {}

    throw error;
  }
}


function legacyIntakeAiErrorTextV11202_(value) {
  if (value && typeof value === 'object') {
    if (value.errorMessage) return String(value.errorMessage);
    if (value.message) return String(value.message);
  }
  return String(value || '');
}


function isTransientLegacyIntakeAiErrorV11202_(value) {
  var text = legacyIntakeAiErrorTextV11202_(value).toLowerCase();
  if (!text) return false;

  return [
    'high demand',
    'temporarily unavailable',
    'temporarily busy',
    'try again later',
    'overloaded',
    'service unavailable',
    'backend error',
    'internal server error',
    'deadline exceeded',
    'resource exhausted',
    'http 500',
    'http 502',
    'http 503',
    'http 504'
  ].some(function(marker) {
    return text.indexOf(marker) !== -1;
  });
}


function setLegacyIntakeAiStatusV11202_(documentId, status) {
  try {
    var legacySheet = getLegacyIntakeSheet_();
    var record = findLegacyIntakeDocumentById_(legacySheet, documentId);
    if (!record) return;

    legacySheet.getRange(record.row, 2).setValue(new Date());
    legacySheet.getRange(record.row, 22).setValue(status);
  } catch (_) {}
}


function buildLegacyIntakeRetryNeededResultV11202_(documentId, retryCount) {
  var record = null;

  try {
    var legacySheet = getLegacyIntakeSheet_();
    record = findLegacyIntakeDocumentById_(legacySheet, documentId);
  } catch (_) {}

  setLegacyIntakeAiStatusV11202_(documentId, 'Retry Needed');

  try {
    logAuditEvent_({
      category: 'Intake',
      action: 'Legacy Intake AI Deferred',
      dogName: record && record.dogName ? record.dogName : '',
      reference: documentId,
      summary:
        'Gemini was temporarily at capacity after automatic retries. The intake PDF remains saved and can be retried without re-uploading.',
      changedFields: ['AI Status'],
      after: {
        aiStatus: 'Retry Needed',
        retryable: true,
        automaticRetryCount: Number(retryCount || 0)
      },
      source: 'Gemini Legacy Intake'
    });
  } catch (_) {}

  return {
    result: 'partial_success',
    action: 'legacy_intake_saved_ai_retry_needed',
    documentId: documentId,
    stayKey: record && record.stayKey ? record.stayKey : '',
    dogName: record && record.dogName ? record.dogName : '',
    pdfUrl: record && record.pdfUrl ? record.pdfUrl : '',
    aiStatus: 'Retry Needed',
    retryable: true,
    autoRetryAttempted: true,
    retryCount: Number(retryCount || 0),
    errorMessage:
      'Gemini is temporarily busy. Your intake is saved safely in Drive. Use Retry AI Read again shortly — you do not need to upload the file again.',
    conflicts: [],
    changedFields: []
  };
}


function runLegacyIntakeAiRetriesV11202_(documentId, initialError, delays) {
  var retryDelays = Array.isArray(delays) ? delays : [];
  var lastError = initialError;
  var attempted = 0;

  for (var index = 0; index < retryDelays.length; index += 1) {
    var delayMs = Math.max(0, Number(retryDelays[index] || 0));
    if (delayMs) Utilities.sleep(delayMs);

    attempted += 1;
    setLegacyIntakeAiStatusV11202_(documentId, 'AI Busy · Retrying');

    try {
      var result = retryGeminiLegacyIntakeFromHtml(documentId);
      if (result && typeof result === 'object') {
        result.autoRetried = true;
        result.retryCount = attempted;
      }
      return result;
    } catch (error) {
      lastError = error;
      if (!isTransientLegacyIntakeAiErrorV11202_(error)) {
        setLegacyIntakeAiStatusV11202_(documentId, 'AI Failed');
        throw error;
      }
    }
  }

  if (isTransientLegacyIntakeAiErrorV11202_(lastError)) {
    return buildLegacyIntakeRetryNeededResultV11202_(documentId, attempted);
  }

  throw lastError || new Error('Gemini intake extraction did not complete.');
}


function recoverTransientLegacyIntakeAiV11202_(result) {
  if (
    !result ||
    result.result !== 'partial_success' ||
    !result.documentId ||
    !isTransientLegacyIntakeAiErrorV11202_(result)
  ) {
    return result;
  }

  return runLegacyIntakeAiRetriesV11202_(
    String(result.documentId),
    result.errorMessage || '',
    LEGACY_INTAKE_AI_RETRY_DELAYS_V11202_
  );
}


function retryGeminiLegacyIntakeWithTransientRetryV11202(documentId) {
  assertWaffleActionAllowedDuringMaintenance_(
    'retryGeminiLegacyIntakeWithTransientRetryV11202'
  );

  documentId = String(documentId || '').trim();
  if (!documentId) {
    throw new Error('Legacy document ID is required.');
  }

  return runLegacyIntakeAiRetriesV11202_(
    documentId,
    '',
    [0, 1500, 3500]
  );
}


function saveLegacyIntakeMediaFromHtml(payload) {
  payload = payload && typeof payload === 'object' ? payload : {};

  var fileData = String(payload.fileData || '');
  var fileName = String(payload.fileName || 'Legacy Intake');
  var sourceKind = String(payload.sourceKind || '').toLowerCase();

  if (/^data:application\/pdf;base64,/i.test(fileData)) {
    return recoverTransientLegacyIntakeAiV11202_(
      saveLegacyIntakeFromHtml({
        stayKey: payload.stayKey,
        fileName: fileName,
        fileData: fileData
      })
    );
  }

  if (!/^data:image\//i.test(fileData)) {
    throw new Error('Please choose a PDF or a clear photo/image of the intake form.');
  }

  var imageBlob = decodeLegacyIntakeImageV11191_(fileData, fileName);
  var pdfBlob = legacyIntakeImageToPdfV11191_(imageBlob, fileName);
  var pdfData =
    'data:application/pdf;base64,' + Utilities.base64Encode(pdfBlob.getBytes());

  var pdfName = String(fileName || 'Legacy Intake Photo')
    .replace(/\.[^.]+$/, '') + '.pdf';

  var result = saveLegacyIntakeFromHtml({
    stayKey: payload.stayKey,
    fileName: pdfName,
    fileData: pdfData
  });

  result = recoverTransientLegacyIntakeAiV11202_(result);

  var documentId = String(result && result.documentId || '').trim();

  if (documentId) {
    try {
      var legacySheet = getLegacyIntakeSheet_();
      var record = findLegacyIntakeDocumentById_(legacySheet, documentId);

      if (record) {
        // Preserve the actual source filename in the database even though the
        // stored OCR record is a generated PDF representation of the photo.
        legacySheet.getRange(record.row, 13).setValue(fileName);
      }
    } catch (_) {}

    try {
      logAuditEvent_({
        category: 'Intake',
        action: 'Legacy Intake Photo Prepared',
        dogName: result && result.dogName ? result.dogName : '',
        reference: documentId,
        summary:
          'Legacy intake photo converted to a private PDF record before Gemini extraction.',
        changedFields: ['Legacy Intake Source'],
        after: {
          originalFilename: fileName,
          sourceKind: sourceKind || 'image',
          convertedToPdf: true
        },
        source: 'Gemini Legacy Intake'
      });
    } catch (_) {}
  }

  if (result && typeof result === 'object') {
    result.sourceKind = sourceKind || 'image';
    result.originalFilename = fileName;
    result.convertedToPdf = true;
  }

  return result;
}


function verifyWaffleHouseLegacyIntakeMediaV11191() {
  return {
    result: 'success',
    version: '11.2.02',
    supported: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    imageFlow: 'image -> private PDF -> existing Gemini OCR -> review -> profile',
    transientAiRetry: {
      automaticRetryDelaysMs: LEGACY_INTAKE_AI_RETRY_DELAYS_V11202_.slice(),
      exhaustedStatus: 'Retry Needed',
      manualRetryFunction: 'retryGeminiLegacyIntakeWithTransientRetryV11202'
    }
  };
}
