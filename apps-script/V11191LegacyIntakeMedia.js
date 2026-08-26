/* ============================================================
 * WAFFLE HOUSE V11.1.91 — LEGACY INTAKE MEDIA UPLOAD
 * ------------------------------------------------------------
 * Adds photo/image intake support without creating a second profile-write path.
 * PDFs delegate directly to the established Legacy Intake workflow. Images are
 * converted into a private PDF record first, then handed to the exact same
 * Gemini extraction, field mapping, conflict review and Audit workflow.
 * ============================================================ */

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


function saveLegacyIntakeMediaFromHtml(payload) {
  payload = payload && typeof payload === 'object' ? payload : {};

  var fileData = String(payload.fileData || '');
  var fileName = String(payload.fileName || 'Legacy Intake');
  var sourceKind = String(payload.sourceKind || '').toLowerCase();

  if (/^data:application\/pdf;base64,/i.test(fileData)) {
    return saveLegacyIntakeFromHtml({
      stayKey: payload.stayKey,
      fileName: fileName,
      fileData: fileData
    });
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
    version: '11.1.91',
    supported: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    imageFlow: 'image -> private PDF -> existing Gemini OCR -> review -> profile'
  };
}
