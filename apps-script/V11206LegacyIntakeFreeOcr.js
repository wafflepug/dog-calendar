/* ============================================================
 * WAFFLE HOUSE V11.2.06 — FREE BROWSER LEGACY INTAKE OCR
 * ------------------------------------------------------------
 * Provider-free fallback for Legacy Intake documents.
 *
 * OCR itself runs in the sitter's browser with PDF.js + Tesseract.js. This
 * Apps Script module only:
 *   - saves new intake media to the existing private Drive workflow;
 *   - returns an already-stored PDF to the authorised Apps Script UI;
 *   - converts browser OCR text into the existing structured intake schema;
 *   - reuses the proven conflict review, Profile/Care writes and audit flow.
 *
 * No API key, AI provider account or paid OCR service is required.
 * ============================================================ */

var LEGACY_INTAKE_FREE_OCR_VERSION_V11206_ = '11.2.06';
var LEGACY_INTAKE_FREE_OCR_MAX_TEXT_V11206_ = 60000;
var LEGACY_INTAKE_FREE_OCR_MAX_FILE_BYTES_V11206_ = 10 * 1024 * 1024;


function legacyFreeOcrCleanV11206_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/\r/g, '')
    .trim();
}


function legacyFreeOcrComparableV11206_(value) {
  return legacyFreeOcrCleanV11206_(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function legacyFreeOcrLinesV11206_(rawText) {
  var text = legacyFreeOcrCleanV11206_(rawText)
    .substring(0, LEGACY_INTAKE_FREE_OCR_MAX_TEXT_V11206_);

  return text
    .split(/\n+/)
    .map(function(line) {
      return String(line || '').replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);
}


function legacyFreeOcrTrimAtStopsV11206_(value, stops) {
  var text = legacyFreeOcrCleanV11206_(value);
  var lower = text.toLowerCase();
  var end = text.length;

  (Array.isArray(stops) ? stops : []).forEach(function(stop) {
    var token = String(stop || '').trim().toLowerCase();
    if (!token) return;
    var match = lower.indexOf(token);
    if (match > 0 && match < end) end = match;
  });

  return text
    .substring(0, end)
    .replace(/^[\s:;=\-–—._|]+/, '')
    .replace(/[\s:;=\-–—._|]+$/, '')
    .trim();
}


function legacyFreeOcrValueV11206_(lines, aliases, stops) {
  var source = Array.isArray(lines) ? lines : [];
  var labels = Array.isArray(aliases) ? aliases : [];

  for (var aliasIndex = 0; aliasIndex < labels.length; aliasIndex += 1) {
    var alias = String(labels[aliasIndex] || '').trim();
    if (!alias) continue;
    var aliasLower = alias.toLowerCase();
    var aliasComparable = legacyFreeOcrComparableV11206_(alias);

    for (var index = 0; index < source.length; index += 1) {
      var line = source[index];
      var lower = line.toLowerCase();
      var exactIndex = lower.indexOf(aliasLower);
      var comparable = legacyFreeOcrComparableV11206_(line);

      if (
        exactIndex === -1 &&
        (!aliasComparable || comparable.indexOf(aliasComparable) === -1)
      ) {
        continue;
      }

      if (exactIndex !== -1) {
        var after = legacyFreeOcrTrimAtStopsV11206_(
          line.substring(exactIndex + alias.length),
          stops
        );

        if (after && after.length <= 220) return after;
      }

      for (var offset = 1; offset <= 2; offset += 1) {
        var next = source[index + offset];
        if (!next) continue;
        var nextComparable = legacyFreeOcrComparableV11206_(next);
        if (!nextComparable) continue;

        var looksLikeAnotherLabel = labels.some(function(label) {
          var token = legacyFreeOcrComparableV11206_(label);
          return token && nextComparable === token;
        });

        if (looksLikeAnotherLabel) continue;

        var nextValue = legacyFreeOcrTrimAtStopsV11206_(next, stops);
        if (nextValue && nextValue.length <= 220) return nextValue;
      }
    }
  }

  return '';
}


function legacyFreeOcrChoiceV11206_(lines, aliases) {
  var source = Array.isArray(lines) ? lines : [];
  var labels = Array.isArray(aliases) ? aliases : [];

  for (var aliasIndex = 0; aliasIndex < labels.length; aliasIndex += 1) {
    var alias = String(labels[aliasIndex] || '').trim();
    var aliasComparable = legacyFreeOcrComparableV11206_(alias);
    if (!aliasComparable) continue;

    for (var index = 0; index < source.length; index += 1) {
      var lineComparable = legacyFreeOcrComparableV11206_(source[index]);
      if (lineComparable.indexOf(aliasComparable) === -1) continue;

      var windowText = [source[index], source[index + 1], source[index + 2]]
        .filter(Boolean)
        .join(' ');
      var lower = windowText.toLowerCase();

      var yesMarked = /(?:\[x\]|☑|✓|✔|\bx\b)\s*(?:yes|y)\b|(?:yes|y)\s*(?:\[x\]|☑|✓|✔|\bx\b)/i.test(windowText);
      var noMarked = /(?:\[x\]|☑|✓|✔|\bx\b)\s*(?:no|n)\b|(?:no|n)\s*(?:\[x\]|☑|✓|✔|\bx\b)/i.test(windowText);

      if (yesMarked && !noMarked) return 'yes';
      if (noMarked && !yesMarked) return 'no';

      var hasYes = /\byes\b/i.test(lower);
      var hasNo = /\bno\b/i.test(lower);
      if (hasYes && !hasNo) return 'yes';
      if (hasNo && !hasYes) return 'no';
    }
  }

  return 'unknown';
}


function legacyFreeOcrPhoneV11206_(value) {
  var text = legacyFreeOcrCleanV11206_(value);
  var match = text.match(/(?:\+?\d[\d\s()\-]{7,}\d)/);
  return match ? legacyFreeOcrCleanV11206_(match[0]) : text.substring(0, 60);
}


function legacyFreeOcrAgeV11206_(value) {
  var text = legacyFreeOcrCleanV11206_(value);
  var match = text.match(/\b\d{1,2}(?:\.\d+)?\s*(?:years?|yrs?|yo|months?|mths?)?\b/i);
  return match ? legacyFreeOcrCleanV11206_(match[0]) : text.substring(0, 40);
}


function legacyFreeOcrWeightV11206_(value) {
  var text = legacyFreeOcrCleanV11206_(value);
  var match = text.match(/\b\d{1,3}(?:\.\d+)?\s*(?:kg|kgs|kilograms?|lb|lbs|pounds?)?\b/i);
  return match ? legacyFreeOcrCleanV11206_(match[0]) : text.substring(0, 50);
}


function legacyFreeOcrSexV11206_(value) {
  var text = legacyFreeOcrCleanV11206_(value);
  var match = text.match(/\b(?:male|female|boy|girl)\b/i);
  return match ? match[0] : text.substring(0, 30);
}


function legacyFreeOcrMeaningfulV11206_(value) {
  var text = legacyFreeOcrComparableV11206_(value);
  return !!text && [
    'none', 'nil', 'no', 'na', 'n a', 'not applicable', 'none known', 'no known'
  ].indexOf(text) === -1;
}


function parseLegacyIntakeFreeOcrTextV11206_(rawText, ocrConfidence) {
  var text = legacyFreeOcrCleanV11206_(rawText)
    .substring(0, LEGACY_INTAKE_FREE_OCR_MAX_TEXT_V11206_);
  var lines = legacyFreeOcrLinesV11206_(text);

  var profile = {
    dogName: legacyFreeOcrValueV11206_(
      lines,
      ['dog name', "dog's name", 'dogs name', 'pet name', 'name of dog'],
      ['breed', 'age', 'owner', 'sex', 'gender', 'weight']
    ),
    breed: legacyFreeOcrValueV11206_(
      lines,
      ['breed'],
      ['age', 'owner', 'sex', 'gender', 'weight', 'mobile', 'contact']
    ),
    ownerName: legacyFreeOcrValueV11206_(
      lines,
      ['owner name', "owner's name", 'owners name', 'owner/client name', 'client name'],
      ['mobile', 'phone', 'contact', 'emergency', 'address']
    ),
    mobile: legacyFreeOcrPhoneV11206_(
      legacyFreeOcrValueV11206_(
        lines,
        ['mobile number', 'owner mobile', 'contact number', 'owner phone', 'mobile', 'phone number'],
        ['emergency', 'email', 'address', 'dog name', 'breed']
      )
    )
  };

  var details = {
    emergencyContact: legacyFreeOcrValueV11206_(lines, ['emergency contact name', 'emergency contact'], ['phone', 'number', 'relationship']),
    emergencyPhone: legacyFreeOcrPhoneV11206_(legacyFreeOcrValueV11206_(lines, ['emergency contact phone', 'emergency phone', 'emergency contact number'], ['relationship', 'age', 'weight'])),
    age: legacyFreeOcrAgeV11206_(legacyFreeOcrValueV11206_(lines, ['dog age', 'age'], ['weight', 'sex', 'gender', 'desexed'])),
    weight: legacyFreeOcrWeightV11206_(legacyFreeOcrValueV11206_(lines, ['dog weight', 'weight'], ['sex', 'gender', 'desexed', 'vaccinated'])),
    sex: legacyFreeOcrSexV11206_(legacyFreeOcrValueV11206_(lines, ['sex / gender', 'sex/gender', 'gender', 'sex'], ['desexed', 'vaccinated', 'microchip'])),
    desexed: legacyFreeOcrChoiceV11206_(lines, ['desexed', 'neutered', 'spayed']),
    vaccinated: legacyFreeOcrChoiceV11206_(lines, ['vaccinated', 'vaccinations up to date', 'vaccination up to date']),
    microchipped: legacyFreeOcrChoiceV11206_(lines, ['microchipped', 'microchip']),
    friendlyDogs: legacyFreeOcrChoiceV11206_(lines, ['friendly with other dogs', 'friendly with dogs', 'other dogs']),
    friendlyCats: legacyFreeOcrChoiceV11206_(lines, ['friendly with cats', 'cats']),
    friendlyChildren: legacyFreeOcrChoiceV11206_(lines, ['friendly with children', 'children', 'kids']),
    friendlyStrangers: legacyFreeOcrChoiceV11206_(lines, ['friendly with strangers', 'strangers']),
    aggression: legacyFreeOcrChoiceV11206_(lines, ['any aggression', 'aggression']),
    foodAggression: legacyFreeOcrChoiceV11206_(lines, ['food aggression', 'resource guarding']),
    indoorAccidents: legacyFreeOcrChoiceV11206_(lines, ['indoor accidents', 'toileting accidents', 'toilet accidents']),
    chewingFurniture: legacyFreeOcrChoiceV11206_(lines, ['chewing furniture', 'chews furniture', 'property damage']),
    triggersFears: legacyFreeOcrValueV11206_(lines, ['triggers / fears', 'triggers and fears', 'triggers', 'fears', 'sensitivities', 'things to avoid'], ['food', 'feeding', 'walk', 'medical']),
    foodBrandType: legacyFreeOcrValueV11206_(lines, ['food brand/type', 'food brand', 'food type', 'usual food'], ['feeding time', 'feed time', 'food amount', 'amount']),
    feedingTimes: legacyFreeOcrValueV11206_(lines, ['feeding times', 'feed times', 'feeding schedule', 'meal times'], ['food amount', 'feeding amount', 'portion', 'treat']),
    foodAmount: legacyFreeOcrValueV11206_(lines, ['food amount', 'feeding amount', 'amount per feed', 'portion size', 'portion'], ['treat', 'allerg', 'walk']),
    allowedTreats: legacyFreeOcrChoiceV11206_(lines, ['allowed treats', 'treats allowed', 'can have treats']),
    foodAllergies: legacyFreeOcrValueV11206_(lines, ['food allergies', 'food allergy', 'dietary allergies'], ['walk', 'exercise', 'medical', 'medication']),
    walksPerDay: legacyFreeOcrValueV11206_(lines, ['walks per day', 'number of walks', 'walk frequency', 'how many walks'], ['walk duration', 'duration', 'off leash']),
    walkDuration: legacyFreeOcrValueV11206_(lines, ['walk duration', 'duration of walks', 'usual walk duration', 'how long are walks'], ['off leash', 'pulls', 'medical']),
    offLeashAllowed: legacyFreeOcrChoiceV11206_(lines, ['off leash allowed', 'off-leash allowed', 'off leash']),
    pullsOnLeash: legacyFreeOcrChoiceV11206_(lines, ['pulls on leash', 'pull on leash', 'leash pulling']),
    medicalConditions: legacyFreeOcrValueV11206_(lines, ['medical conditions', 'medical condition', 'health issues', 'health conditions'], ['medication', 'vet', 'veterinary', 'sleep']),
    medicationInstructions: legacyFreeOcrValueV11206_(lines, ['medication instructions', 'medications', 'medication', 'medicine'], ['vet', 'veterinary', 'sleep', 'crate']),
    regularVetClinic: legacyFreeOcrValueV11206_(lines, ['regular vet clinic', 'vet clinic', 'veterinary clinic', 'regular vet'], ['vet phone', 'phone', 'sleep']),
    vetPhone: legacyFreeOcrPhoneV11206_(legacyFreeOcrValueV11206_(lines, ['vet phone', 'vet number', 'veterinary phone'], ['sleep', 'crate', 'alone'])),
    sleepLocation: legacyFreeOcrValueV11206_(lines, ['where does your dog sleep', 'where dog sleeps', 'sleep location', 'sleeps'], ['crate', 'left alone', 'alone']),
    crateTrained: legacyFreeOcrChoiceV11206_(lines, ['crate trained', 'crate-trained']),
    canBeLeftAlone: legacyFreeOcrChoiceV11206_(lines, ['can be left alone', 'left alone']),
    aloneDuration: legacyFreeOcrValueV11206_(lines, ['if yes for how long', 'how long can', 'alone duration', 'left alone for'], ['signature', 'consent', 'date'])
  };

  var care = {
    escapeRisk: legacyFreeOcrChoiceV11206_(lines, ['escape risk', 'escape attempts', 'tries to escape', 'escape artist', 'bolting', 'bolts']),
    foodAllergy: legacyFreeOcrChoiceV11206_(lines, ['food allergy', 'food allergies']),
    medicated: legacyFreeOcrChoiceV11206_(lines, ['currently on medication', 'requires medication', 'on medication']),
    separationAnxiety: legacyFreeOcrChoiceV11206_(lines, ['separation anxiety', 'anxious when left', 'anxiety when alone']),
    weightManagement: legacyFreeOcrChoiceV11206_(lines, ['weight management', 'weight control', 'weight loss diet', 'calorie restriction'])
  };

  if (care.foodAllergy === 'unknown' && details.foodAllergies) {
    care.foodAllergy = legacyFreeOcrMeaningfulV11206_(details.foodAllergies) ? 'yes' : 'no';
  }

  if (care.medicated === 'unknown' && details.medicationInstructions) {
    care.medicated = legacyFreeOcrMeaningfulV11206_(details.medicationInstructions) ? 'yes' : 'no';
  }

  var numericConfidence = Number(ocrConfidence);
  var confidence = isFinite(numericConfidence)
    ? Math.max(0, Math.min(1, numericConfidence > 1 ? numericConfidence / 100 : numericConfidence))
    : 0;

  var warnings = [
    'Free browser OCR (Tesseract.js / PDF text) was used. Review handwriting and tick-box answers before replacing existing Waffle values.'
  ];

  if (confidence && confidence < 0.65) {
    warnings.push('OCR confidence was below 65%; unclear handwritten fields should be checked against the stored intake.');
  }

  if (text.length < 120) {
    warnings.push('Only a small amount of readable text was detected. Open the stored intake and review the extraction carefully.');
  }

  var unknownChoices = 0;
  Object.keys(details).forEach(function(key) {
    if (details[key] === 'unknown') unknownChoices += 1;
  });
  Object.keys(care).forEach(function(key) {
    if (care[key] === 'unknown') unknownChoices += 1;
  });
  if (unknownChoices >= 8) {
    warnings.push('Several Yes/No or tick-box fields could not be read safely and were left unchanged.');
  }

  return normalizeGeminiLegacyIntakeExtraction_({
    profile: profile,
    care: care,
    details: details,
    extractionConfidence: confidence,
    warnings: warnings
  });
}


function saveLegacyIntakeRecordForFreeOcrV11206_(payload, pdfBlob, originalFileName) {
  payload = payload && typeof payload === 'object' ? payload : {};
  var stayKey = String(payload.stayKey || '').trim();
  var fileName = String(originalFileName || payload.fileName || 'Legacy Intake.pdf');

  if (!stayKey) throw new Error('Choose the dog/stay this intake belongs to.');
  if (!pdfBlob || typeof pdfBlob.getBytes !== 'function') {
    throw new Error('The legacy intake file could not be prepared.');
  }

  var mainSheet = getTargetSheet_();
  var rows = mainSheet.getDataRange().getValues();
  var bookingMatch = findBookingByStayKey_(rows, stayKey);
  if (!bookingMatch) throw new Error('The selected booking could not be found. Refresh and try again.');

  var booking = bookingMatch.record;
  var dogFolder = getIntakeDogFolder_(booking.dogName);
  var now = new Date();
  var dateStamp = Utilities.formatDate(
    now,
    mainSheet.getParent().getSpreadsheetTimeZone(),
    'yyyy-MM-dd'
  );
  var safeDog = String(booking.dogName || 'Dog')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  var storedName = dateStamp + '_' + safeDog.replace(/\s+/g, '_') + '_Legacy_Intake.pdf';
  var pdfFile = dogFolder.createFile(pdfBlob.copyBlob().setName(storedName));
  var documentId = 'legacy_' + Utilities.getUuid().replace(/-/g, '');
  var legacySheet = getLegacyIntakeSheet_();
  var pendingStatus = 'Saved · Ready for Free OCR';

  legacySheet.appendRow([
    now,
    now,
    documentId,
    stayKey,
    booking.dogName || '',
    booking.breed || '',
    booking.startDate || '',
    booking.endDate || '',
    booking.ownerName || '',
    booking.phone || '',
    pdfFile.getId(),
    pdfFile.getUrl(),
    fileName,
    100,
    'Assigned from Guest Directory / selected booking',
    bookingMatch.row,
    '',
    '',
    '{}',
    '{}',
    '[]',
    pendingStatus
  ]);

  logAuditEvent_({
    category: 'Intake',
    action: 'Legacy Intake Uploaded',
    dogName: booking.dogName,
    bookingType: booking.bookingType || 'Boarding',
    reference: documentId,
    summary: 'Legacy intake saved privately in Google Drive for ' + booking.dogName + '. Free browser OCR is ready.',
    changedFields: ['Legacy Intake PDF'],
    after: {
      stayKey: stayKey,
      documentId: documentId,
      pdfFileId: pdfFile.getId(),
      originalFilename: fileName,
      aiStatus: pendingStatus,
      ocrMode: 'free-browser',
      provider: 'Tesseract.js'
    },
    source: 'Free Browser Legacy Intake OCR'
  });

  touchWaffleDataVersion_('directory');

  return {
    documentId: documentId,
    stayKey: stayKey,
    dogName: booking.dogName,
    bookingType: booking.bookingType || 'Boarding',
    pdfFile: pdfFile,
    pdfUrl: pdfFile.getUrl(),
    uploadedAt: now.toISOString(),
    aiStatus: pendingStatus
  };
}


function saveLegacyIntakeMediaForFreeOcrV11206(payload) {
  assertWaffleActionAllowedDuringMaintenance_('saveLegacyIntakeMediaForFreeOcrV11206');
  payload = payload && typeof payload === 'object' ? payload : {};

  var fileData = String(payload.fileData || '');
  var fileName = String(payload.fileName || 'Legacy Intake');
  var sourceKind = String(payload.sourceKind || '').toLowerCase();
  var pdfBlob;

  if (/^data:application\/pdf;base64,/i.test(fileData)) {
    pdfBlob = decodeLegacyPdfData_(fileData, fileName);
  } else if (/^data:image\//i.test(fileData)) {
    var imageBlob = decodeLegacyIntakeImageV11191_(fileData, fileName);
    pdfBlob = legacyIntakeImageToPdfV11191_(imageBlob, fileName);
  } else {
    throw new Error('Please choose a PDF or a clear JPG/PNG/WebP image of the intake form.');
  }

  if (pdfBlob.getBytes().length > LEGACY_INTAKE_FREE_OCR_MAX_FILE_BYTES_V11206_) {
    throw new Error('Please keep the legacy intake at 10 MB or less.');
  }

  var saved = saveLegacyIntakeRecordForFreeOcrV11206_(payload, pdfBlob, fileName);

  return {
    result: 'success',
    action: 'legacy_intake_saved_for_free_ocr',
    documentId: saved.documentId,
    stayKey: saved.stayKey,
    dogName: saved.dogName,
    pdfUrl: saved.pdfUrl,
    uploadedAt: saved.uploadedAt,
    originalFilename: fileName,
    sourceKind: sourceKind || (/^data:application\/pdf/i.test(fileData) ? 'pdf' : 'image'),
    aiStatus: saved.aiStatus,
    provider: 'free-browser'
  };
}


function getLegacyIntakeOcrSourceForHtmlV11206(payload) {
  assertWaffleActionAllowedDuringMaintenance_('getLegacyIntakeOcrSourceForHtmlV11206');
  payload = payload && typeof payload === 'object' ? payload : {};
  var documentId = String(payload.documentId || '').trim();
  if (!documentId) throw new Error('Legacy document ID is required.');

  var sheet = getLegacyIntakeSheet_();
  var record = findLegacyIntakeDocumentById_(sheet, documentId);
  if (!record) throw new Error('The stored legacy intake could not be found.');
  if (!record.pdfFileId) throw new Error('The stored intake PDF is missing.');

  var file = DriveApp.getFileById(record.pdfFileId);
  var blob = file.getBlob();
  var bytes = blob.getBytes();
  if (bytes.length > LEGACY_INTAKE_FREE_OCR_MAX_FILE_BYTES_V11206_) {
    throw new Error('This stored intake is larger than 10 MB and cannot be sent to the browser OCR reader.');
  }

  return {
    result: 'success',
    documentId: documentId,
    stayKey: record.stayKey || '',
    dogName: record.dogName || '',
    fileName: record.originalFilename || file.getName() || 'Legacy Intake.pdf',
    pdfUrl: record.pdfUrl || file.getUrl(),
    sizeBytes: bytes.length,
    fileData: 'data:application/pdf;base64,' + Utilities.base64Encode(bytes)
  };
}


function applyLegacyIntakeFreeExtractionV11206_(documentId, extraction, meta) {
  var legacySheet = getLegacyIntakeSheet_();
  var record = findLegacyIntakeDocumentById_(legacySheet, documentId);
  if (!record) throw new Error('The legacy intake record could not be found.');

  var mainSheet = getTargetSheet_();
  var rows = mainSheet.getDataRange().getValues();
  var bookingMatch = findBookingByStayKey_(rows, record.stayKey);
  if (!bookingMatch) throw new Error('The assigned booking could not be found. Reassign the PDF first.');

  legacySheet.getRange(record.row, 22).setValue('Processing · Free OCR');
  legacySheet.getRange(record.row, 2).setValue(new Date());

  var plan = buildGeminiLegacyAutoApplyPlan_(record.stayKey, extraction);
  var appliedResult = {
    stayKey: record.stayKey,
    dogName: bookingMatch.record.dogName,
    directory: {},
    care: {},
    changedFields: []
  };

  if (!plan.blocked) {
    appliedResult = applyLegacyIntakeProfileUpdates_(
      record.stayKey,
      plan.updates,
      documentId
    );
  }

  var storedRecord = findLegacyIntakeDocumentById_(legacySheet, documentId);
  var existingApplied = storedRecord ? storedRecord.appliedFields : {};
  var mergedApplied = mergeLegacyAppliedFields_(existingApplied, appliedResult);
  var finalStatus = plan.conflicts.length ? 'Review Required' : 'Complete';
  var finalStayKey = appliedResult.stayKey || record.stayKey;
  var finalDogName = appliedResult.dogName || bookingMatch.record.dogName || record.dogName;

  if (!plan.blocked) {
    saveIntakeAttributesForStay_(
      finalDogName,
      bookingMatch.record.startDate,
      bookingMatch.record.endDate,
      finalStayKey,
      legacyParsedFieldsToIntakeAttributes_(extraction),
      'Legacy Intake · Free OCR'
    );
  }

  var methodLabel = 'Free Browser OCR · Tesseract.js';

  legacySheet.getRange(record.row, 2).setValue(new Date());
  legacySheet.getRange(record.row, 4).setValue(finalStayKey);
  legacySheet.getRange(record.row, 5).setValue(finalDogName);
  legacySheet.getRange(record.row, 17).setValue(methodLabel);
  legacySheet.getRange(record.row, 18).setValue('');
  legacySheet.getRange(record.row, 19).setValue(JSON.stringify(extraction));
  legacySheet.getRange(record.row, 20).setValue(JSON.stringify(mergedApplied));
  legacySheet.getRange(record.row, 21).setValue(JSON.stringify(plan.conflicts));
  legacySheet.getRange(record.row, 22).setValue(finalStatus);

  meta = meta && typeof meta === 'object' ? meta : {};

  logAuditEvent_({
    category: 'Intake',
    action: 'Legacy Intake Free OCR Processed',
    dogName: finalDogName,
    bookingType: bookingMatch.record.bookingType || 'Boarding',
    reference: documentId,
    summary:
      'Free browser OCR read the legacy intake for ' + finalDogName + '. ' +
      (appliedResult.changedFields.length
        ? appliedResult.changedFields.length + ' profile attribute' +
          (appliedResult.changedFields.length === 1 ? '' : 's') + ' updated.'
        : 'No new attributes required updating.') +
      (plan.conflicts.length
        ? ' ' + plan.conflicts.length + ' item' + (plan.conflicts.length === 1 ? '' : 's') + ' require review.'
        : ''),
    changedFields: appliedResult.changedFields,
    after: {
      provider: 'free-browser',
      model: 'Tesseract.js + PDF.js',
      pageCount: Number(meta.pageCount || 0),
      ocrConfidence: Number(meta.ocrConfidence || 0),
      aiStatus: finalStatus,
      extractionConfidence: extraction.extractionConfidence,
      warnings: extraction.warnings,
      applied: mergedApplied,
      reviewConflicts: plan.conflicts
    },
    source: 'Free Browser Legacy Intake OCR'
  });

  touchWaffleDataVersion_('directory');

  return {
    result: 'success',
    action: 'legacy_intake_free_ocr_processed',
    documentId: documentId,
    stayKey: finalStayKey,
    dogName: finalDogName,
    pdfUrl: record.pdfUrl,
    provider: 'free-browser',
    model: 'Tesseract.js + PDF.js',
    extractionMethod: methodLabel,
    aiStatus: finalStatus,
    extraction: extraction,
    applied: mergedApplied,
    changedFields: appliedResult.changedFields,
    conflicts: plan.conflicts
  };
}


function processLegacyIntakeFreeOcrTextV11206(payload) {
  assertWaffleActionAllowedDuringMaintenance_('processLegacyIntakeFreeOcrTextV11206');
  payload = payload && typeof payload === 'object' ? payload : {};

  var documentId = String(payload.documentId || '').trim();
  var rawText = legacyFreeOcrCleanV11206_(payload.rawText || '')
    .substring(0, LEGACY_INTAKE_FREE_OCR_MAX_TEXT_V11206_);

  if (!documentId) throw new Error('Legacy document ID is required.');
  if (!rawText) {
    throw new Error('Free OCR did not detect readable text. Open the stored intake and try a clearer scan/photo.');
  }

  var extraction = parseLegacyIntakeFreeOcrTextV11206_(
    rawText,
    payload.ocrConfidence
  );

  return applyLegacyIntakeFreeExtractionV11206_(
    documentId,
    extraction,
    {
      pageCount: payload.pageCount,
      ocrConfidence: payload.ocrConfidence
    }
  );
}


function verifyWaffleHouseLegacyIntakeFreeOcrV11206() {
  return {
    result: 'success',
    version: LEGACY_INTAKE_FREE_OCR_VERSION_V11206_,
    cost: 'free',
    apiKeyRequired: false,
    providerRequired: false,
    browserReader: 'PDF.js + Tesseract.js',
    parser: 'Waffle deterministic legacy intake mapper',
    storedFileFunction: 'getLegacyIntakeOcrSourceForHtmlV11206',
    processFunction: 'processLegacyIntakeFreeOcrTextV11206',
    saveFunction: 'saveLegacyIntakeMediaForFreeOcrV11206'
  };
}
