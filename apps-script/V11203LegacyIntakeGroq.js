/* ============================================================
 * WAFFLE HOUSE V11.2.03 — GROQ-FIRST LEGACY INTAKE OCR
 * ------------------------------------------------------------
 * New Legacy Intake uploads use Groq Vision first and Gemini as fallback.
 * The original PDF remains the source of truth in Drive. Browser-prepared
 * page images are stored beside it only as private OCR assets so Retry AI Read
 * can use Groq again without requiring the sitter to re-upload the document.
 *
 * Provider order:
 *   1. Groq Vision via GROQ_API_KEY (default qwen/qwen3.6-27b)
 *   2. Gemini fallback via GEMINI_API_KEY (enabled by default)
 *
 * The provider layer returns the same normalized extraction object consumed by
 * the existing conflict review, profile update and audit workflow.
 * ============================================================ */

var LEGACY_INTAKE_GROQ_MODEL_DEFAULT_V11203_ = 'qwen/qwen3.6-27b';
var LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_ = 5;
var LEGACY_INTAKE_GROQ_RETRY_DELAYS_V11203_ = [0, 900, 2400];


function legacyIntakePropertyBooleanV11203_(properties, key, fallback) {
  var raw = String(properties.getProperty(key) || '').trim().toLowerCase();
  if (!raw) return !!fallback;
  if (['1', 'true', 'yes', 'on'].indexOf(raw) !== -1) return true;
  if (['0', 'false', 'no', 'off'].indexOf(raw) !== -1) return false;
  return !!fallback;
}


function getLegacyIntakeProviderConfigV11203_() {
  var properties = PropertiesService.getScriptProperties();
  var model = String(
    properties.getProperty('GROQ_LEGACY_INTAKE_MODEL') ||
    properties.getProperty('WAFFLE_AI_GROQ_VISION_MODEL') ||
    LEGACY_INTAKE_GROQ_MODEL_DEFAULT_V11203_
  ).trim();

  return {
    groqApiKey: String(properties.getProperty('GROQ_API_KEY') || '').trim(),
    groqModel: model || LEGACY_INTAKE_GROQ_MODEL_DEFAULT_V11203_,
    geminiApiKey: String(properties.getProperty('GEMINI_API_KEY') || '').trim(),
    geminiFallbackEnabled: legacyIntakePropertyBooleanV11203_(
      properties,
      'LEGACY_INTAKE_ENABLE_GEMINI_FALLBACK',
      true
    )
  };
}


function legacyIntakeGroqMaxImagesPerRequestV11203_(model) {
  var value = String(model || '').toLowerCase();
  return value.indexOf('qwen3.8') !== -1 ? 3 : 5;
}


function legacyIntakeSafeErrorTextV11203_(error) {
  var text = '';
  if (error && typeof error === 'object' && error.message) {
    text = String(error.message);
  } else {
    text = String(error || '');
  }
  return text.substring(0, 900);
}


function isTransientLegacyIntakeProviderErrorV11203_(error) {
  var text = legacyIntakeSafeErrorTextV11203_(error).toLowerCase();
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
    'rate limit',
    'too many requests',
    'http 429',
    'http 500',
    'http 502',
    'http 503',
    'http 504'
  ].some(function(marker) {
    return text.indexOf(marker) !== -1;
  });
}


function legacyIntakeDecodeOcrImageV11203_(dataUrl, index) {
  var match = String(dataUrl || '').match(
    /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i
  );

  if (!match) {
    throw new Error('OCR page ' + (Number(index || 0) + 1) + ' is not a supported image.');
  }

  var mimeType = String(match[1] || '').toLowerCase();
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

  var bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 8 * 1024 * 1024) {
    throw new Error('OCR page ' + (Number(index || 0) + 1) + ' is too large.');
  }

  return {
    mimeType: mimeType,
    bytes: bytes,
    dataUrl: 'data:' + mimeType + ';base64,' + Utilities.base64Encode(bytes)
  };
}


function legacyIntakeOcrAssetNameV11203_(documentId, pageNumber, mimeType) {
  var extension = mimeType === 'image/png'
    ? '.png'
    : mimeType === 'image/webp'
      ? '.webp'
      : '.jpg';

  return String(documentId) + '_Groq_OCR_Page_' + String(pageNumber) + extension;
}


function persistLegacyIntakeOcrImagesV11203_(documentId, pdfFile, imageDataUrls) {
  var images = Array.isArray(imageDataUrls) ? imageDataUrls : [];
  if (!documentId || !pdfFile || !images.length) return 0;

  var parents = pdfFile.getParents();
  if (!parents.hasNext()) return 0;
  var folder = parents.next();
  var saved = 0;

  images.slice(0, LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_)
    .forEach(function(dataUrl, index) {
      try {
        var decoded = legacyIntakeDecodeOcrImageV11203_(dataUrl, index);
        var name = legacyIntakeOcrAssetNameV11203_(
          documentId,
          index + 1,
          decoded.mimeType
        );

        var existing = folder.getFilesByName(name);
        while (existing.hasNext()) {
          try { existing.next().setTrashed(true); } catch (_) {}
        }

        folder.createFile(
          Utilities.newBlob(decoded.bytes, decoded.mimeType, name)
        );
        saved += 1;
      } catch (_) {}
    });

  return saved;
}


function loadLegacyIntakeOcrImagesV11203_(record) {
  if (!record || !record.pdfFileId || !record.documentId) return [];

  var pdfFile;
  try {
    pdfFile = DriveApp.getFileById(record.pdfFileId);
  } catch (_) {
    return [];
  }

  var parents = pdfFile.getParents();
  if (!parents.hasNext()) return [];
  var folder = parents.next();
  var result = [];

  for (var page = 1; page <= LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_; page += 1) {
    var found = null;
    ['image/jpeg', 'image/png', 'image/webp'].some(function(mimeType) {
      var files = folder.getFilesByName(
        legacyIntakeOcrAssetNameV11203_(record.documentId, page, mimeType)
      );
      if (files.hasNext()) {
        found = files.next();
        return true;
      }
      return false;
    });

    if (!found) break;

    try {
      var blob = found.getBlob();
      result.push(
        'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes())
      );
    } catch (_) {
      break;
    }
  }

  return result;
}


function legacyIntakeGroqPromptV11203_(pageOffset, pageCount, totalPages) {
  var pageText = totalPages > 1
    ? 'These are pages ' + (pageOffset + 1) + '-' + (pageOffset + pageCount) +
      ' of a ' + totalPages + '-page legacy dog boarding intake form.'
    : 'This is a legacy dog boarding intake form.';

  return [
    'You are Waffle House OCR for historical dog boarding intake forms.',
    pageText,
    'Read printed text, handwriting, tick boxes, circles and short handwritten annotations carefully.',
    'Never invent a value. If a value cannot be read confidently, leave it blank or use unknown as the schema expects.',
    'Preserve meaningful wording for feeding, medication, behaviour, triggers, sleeping and care instructions.',
    'Return only a JSON object. Do not include markdown or commentary.',
    '',
    getGeminiLegacyIntakePrompt_()
  ].join('\n');
}


function legacyIntakeCallGroqOnceV11203_(apiKey, model, imageDataUrls, pageOffset, totalPages, useSchema) {
  var content = [
    {
      type: 'text',
      text: legacyIntakeGroqPromptV11203_(pageOffset, imageDataUrls.length, totalPages)
    }
  ];

  imageDataUrls.forEach(function(dataUrl) {
    content.push({
      type: 'image_url',
      image_url: { url: dataUrl }
    });
  });

  var payload = {
    model: model,
    messages: [
      {
        role: 'user',
        content: content
      }
    ],
    temperature: 0.1,
    top_p: 0.9,
    max_completion_tokens: 6000,
    stream: false,
    response_format: useSchema
      ? {
          type: 'json_schema',
          json_schema: {
            name: 'waffle_legacy_intake_extraction',
            strict: false,
            schema: getGeminiLegacyIntakeSchema_()
          }
        }
      : { type: 'json_object' }
  };

  var response = UrlFetchApp.fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + apiKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  var status = response.getResponseCode();
  var body = response.getContentText() || '';
  var parsed = null;

  try { parsed = JSON.parse(body); } catch (_) {}

  if (status < 200 || status >= 300) {
    var detail = parsed && parsed.error && parsed.error.message
      ? String(parsed.error.message)
      : ('HTTP ' + status);

    var schemaIssue = useSchema && status === 400 && (
      detail.toLowerCase().indexOf('schema') !== -1 ||
      detail.toLowerCase().indexOf('response_format') !== -1 ||
      detail.toLowerCase().indexOf('response format') !== -1
    );

    if (schemaIssue) {
      return legacyIntakeCallGroqOnceV11203_(
        apiKey,
        model,
        imageDataUrls,
        pageOffset,
        totalPages,
        false
      );
    }

    throw new Error('Groq OCR failed: ' + detail + ' [model=' + model + ']');
  }

  var text = '';
  try {
    text = String(parsed.choices[0].message.content || '').trim();
  } catch (_) {
    text = '';
  }

  if (!text) throw new Error('Groq OCR returned no structured intake data.');

  text = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  var extracted;
  try {
    extracted = JSON.parse(text);
  } catch (_) {
    throw new Error('Groq OCR returned data that could not be parsed as JSON.');
  }

  return normalizeGeminiLegacyIntakeExtraction_(extracted);
}


function legacyIntakeCallGroqChunkWithRetryV11203_(apiKey, model, images, offset, totalPages) {
  var lastError = null;

  for (var attempt = 0; attempt < LEGACY_INTAKE_GROQ_RETRY_DELAYS_V11203_.length; attempt += 1) {
    var delay = Number(LEGACY_INTAKE_GROQ_RETRY_DELAYS_V11203_[attempt] || 0);
    if (delay) Utilities.sleep(delay);

    try {
      return legacyIntakeCallGroqOnceV11203_(
        apiKey,
        model,
        images,
        offset,
        totalPages,
        true
      );
    } catch (error) {
      lastError = error;
      if (!isTransientLegacyIntakeProviderErrorV11203_(error)) throw error;
    }
  }

  throw lastError || new Error('Groq OCR did not complete.');
}


function legacyIntakeMergeScalarV11203_(current, incoming, path, warnings) {
  var left = String(current || '').trim();
  var right = String(incoming || '').trim();

  if (!left || left === 'unknown') return right || left;
  if (!right || right === 'unknown' || left === right) return left;

  warnings.push('OCR pages disagreed on ' + path + '; retained the earlier readable value for review.');
  return left;
}


function mergeLegacyIntakeGroqChunksV11203_(chunks) {
  var list = Array.isArray(chunks) ? chunks : [];
  if (!list.length) throw new Error('Groq OCR returned no page results.');
  if (list.length === 1) return list[0];

  var merged = {
    profile: {},
    care: {},
    details: {},
    extractionConfidence: 1,
    warnings: []
  };

  list.forEach(function(chunk) {
    var item = chunk || {};

    Object.keys(item.profile || {}).forEach(function(key) {
      merged.profile[key] = legacyIntakeMergeScalarV11203_(
        merged.profile[key],
        item.profile[key],
        'profile.' + key,
        merged.warnings
      );
    });

    Object.keys(item.care || {}).forEach(function(key) {
      var current = String(merged.care[key] || 'unknown');
      var incoming = String(item.care[key] || 'unknown');
      if (current === 'unknown') {
        merged.care[key] = incoming;
      } else if (incoming !== 'unknown' && incoming !== current) {
        merged.care[key] = 'unknown';
        merged.warnings.push(
          'OCR pages disagreed on care.' + key + '; left it unknown for manual review.'
        );
      }
    });

    Object.keys(item.details || {}).forEach(function(key) {
      merged.details[key] = legacyIntakeMergeScalarV11203_(
        merged.details[key],
        item.details[key],
        'details.' + key,
        merged.warnings
      );
    });

    var confidence = Number(item.extractionConfidence);
    if (isFinite(confidence) && confidence >= 0) {
      merged.extractionConfidence = Math.min(merged.extractionConfidence, confidence);
    }

    (Array.isArray(item.warnings) ? item.warnings : []).forEach(function(warning) {
      var text = String(warning || '').trim();
      if (text && merged.warnings.indexOf(text) === -1) merged.warnings.push(text);
    });
  });

  if (merged.extractionConfidence === 1 && list.every(function(item) {
    return !Number(item && item.extractionConfidence);
  })) {
    merged.extractionConfidence = 0;
  }

  return normalizeGeminiLegacyIntakeExtraction_(merged);
}


function callGroqLegacyIntakeExtractionV11203_(imageDataUrls) {
  var config = getLegacyIntakeProviderConfigV11203_();
  if (!config.groqApiKey) {
    throw new Error('Groq OCR is not configured. Add GROQ_API_KEY in Apps Script Script Properties.');
  }

  var images = (Array.isArray(imageDataUrls) ? imageDataUrls : [])
    .filter(function(value) { return /^data:image\//i.test(String(value || '')); })
    .slice(0, LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_);

  if (!images.length) {
    throw new Error('Groq OCR needs rendered intake page images.');
  }

  var maxImages = legacyIntakeGroqMaxImagesPerRequestV11203_(config.groqModel);
  var chunks = [];

  for (var offset = 0; offset < images.length; offset += maxImages) {
    chunks.push(
      legacyIntakeCallGroqChunkWithRetryV11203_(
        config.groqApiKey,
        config.groqModel,
        images.slice(offset, offset + maxImages),
        offset,
        images.length
      )
    );
  }

  return {
    provider: 'groq',
    model: config.groqModel,
    fields: mergeLegacyIntakeGroqChunksV11203_(chunks),
    pageCount: images.length
  };
}


function applyLegacyIntakeExtractionV11203_(documentId, extractionResult) {
  var legacySheet = getLegacyIntakeSheet_();
  var record = findLegacyIntakeDocumentById_(legacySheet, documentId);

  if (!record) throw new Error('The legacy intake record could not be found.');
  if (!record.pdfFileId) throw new Error('The legacy intake PDF file is missing from the record.');

  var mainSheet = getTargetSheet_();
  var rows = mainSheet.getDataRange().getValues();
  var bookingMatch = findBookingByStayKey_(rows, record.stayKey);

  if (!bookingMatch) {
    throw new Error('The assigned booking could not be found. Reassign the PDF first.');
  }

  legacySheet.getRange(record.row, 22).setValue('Processing');
  legacySheet.getRange(record.row, 2).setValue(new Date());

  var extraction = extractionResult.fields;
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
      'Legacy Intake · Groq'
    );
  }

  var methodLabel = 'Groq Vision · ' + extractionResult.model;

  legacySheet.getRange(record.row, 2).setValue(new Date());
  legacySheet.getRange(record.row, 4).setValue(finalStayKey);
  legacySheet.getRange(record.row, 5).setValue(finalDogName);
  legacySheet.getRange(record.row, 17).setValue(methodLabel);
  legacySheet.getRange(record.row, 18).setValue('');
  legacySheet.getRange(record.row, 19).setValue(JSON.stringify(extraction));
  legacySheet.getRange(record.row, 20).setValue(JSON.stringify(mergedApplied));
  legacySheet.getRange(record.row, 21).setValue(JSON.stringify(plan.conflicts));
  legacySheet.getRange(record.row, 22).setValue(finalStatus);

  logAuditEvent_({
    category: 'Intake',
    action: 'Legacy Intake AI Processed',
    dogName: finalDogName,
    bookingType: bookingMatch.record.bookingType || 'Boarding',
    reference: documentId,
    summary:
      'Groq Vision read the legacy intake for ' + finalDogName + '. ' +
      (appliedResult.changedFields.length
        ? appliedResult.changedFields.length + ' profile attribute' +
          (appliedResult.changedFields.length === 1 ? '' : 's') + ' updated.'
        : 'No new attributes required updating.') +
      (plan.conflicts.length
        ? ' ' + plan.conflicts.length + ' item' +
          (plan.conflicts.length === 1 ? '' : 's') + ' require review.'
        : ''),
    changedFields: appliedResult.changedFields,
    after: {
      provider: 'groq',
      model: extractionResult.model,
      pageCount: extractionResult.pageCount || 0,
      aiStatus: finalStatus,
      extractionConfidence: extraction.extractionConfidence,
      warnings: extraction.warnings,
      applied: mergedApplied,
      reviewConflicts: plan.conflicts
    },
    source: 'Groq Legacy Intake'
  });

  touchWaffleDataVersion_('directory');

  return {
    result: 'success',
    action: 'legacy_intake_ai_processed',
    documentId: documentId,
    stayKey: finalStayKey,
    dogName: finalDogName,
    pdfUrl: record.pdfUrl,
    provider: 'groq',
    model: extractionResult.model,
    extractionMethod: methodLabel,
    aiStatus: finalStatus,
    extraction: extraction,
    applied: mergedApplied,
    changedFields: appliedResult.changedFields,
    conflicts: plan.conflicts
  };
}


function legacyIntakeProviderFailureResultV11203_(documentId, providerErrors) {
  var sheet = getLegacyIntakeSheet_();
  var record = findLegacyIntakeDocumentById_(sheet, documentId);
  var errors = Array.isArray(providerErrors) ? providerErrors : [];
  var retryable = errors.some(function(item) {
    return isTransientLegacyIntakeProviderErrorV11203_(item && item.error);
  });
  var status = retryable ? 'Retry Needed' : 'AI Failed';

  if (record) {
    sheet.getRange(record.row, 2).setValue(new Date());
    sheet.getRange(record.row, 22).setValue(status);
  }

  var summary = retryable
    ? 'OCR providers are temporarily busy. The intake is saved safely in Drive; use Retry AI Read shortly.'
    : 'The intake is saved safely in Drive, but the configured OCR providers could not complete the read.';

  try {
    logAuditEvent_({
      category: 'Intake',
      action: retryable ? 'Legacy Intake AI Deferred' : 'Legacy Intake AI Failed',
      dogName: record && record.dogName ? record.dogName : '',
      reference: documentId,
      summary: summary,
      changedFields: ['AI Status'],
      after: {
        aiStatus: status,
        retryable: retryable,
        providerErrors: errors.map(function(item) {
          return {
            provider: item.provider,
            error: legacyIntakeSafeErrorTextV11203_(item.error)
          };
        })
      },
      source: 'Legacy Intake OCR'
    });
  } catch (_) {}

  return {
    result: 'partial_success',
    action: retryable
      ? 'legacy_intake_saved_ai_retry_needed'
      : 'legacy_intake_saved_ai_failed',
    documentId: documentId,
    stayKey: record && record.stayKey ? record.stayKey : '',
    dogName: record && record.dogName ? record.dogName : '',
    pdfUrl: record && record.pdfUrl ? record.pdfUrl : '',
    aiStatus: status,
    retryable: retryable,
    providerErrors: errors.map(function(item) {
      return {
        provider: item.provider,
        error: legacyIntakeSafeErrorTextV11203_(item.error)
      };
    }),
    errorMessage: summary,
    conflicts: [],
    changedFields: []
  };
}


function processLegacyIntakeWithProvidersV11203_(documentId, suppliedImages) {
  var config = getLegacyIntakeProviderConfigV11203_();
  var sheet = getLegacyIntakeSheet_();
  var record = findLegacyIntakeDocumentById_(sheet, documentId);
  if (!record) throw new Error('The legacy intake record could not be found.');

  var images = Array.isArray(suppliedImages) && suppliedImages.length
    ? suppliedImages
    : loadLegacyIntakeOcrImagesV11203_(record);
  var providerErrors = [];

  if (config.groqApiKey && images.length) {
    try {
      return applyLegacyIntakeExtractionV11203_(
        documentId,
        callGroqLegacyIntakeExtractionV11203_(images)
      );
    } catch (groqError) {
      providerErrors.push({ provider: 'groq', error: groqError });
    }
  } else if (config.groqApiKey && !images.length) {
    providerErrors.push({
      provider: 'groq',
      error: new Error('No stored page images are available for Groq OCR on this older intake record.')
    });
  }

  if (config.geminiFallbackEnabled && config.geminiApiKey) {
    try {
      var geminiResult = retryGeminiLegacyIntakeWithTransientRetryV11202(documentId);
      if (geminiResult && typeof geminiResult === 'object') {
        geminiResult.provider = 'gemini';
        geminiResult.providerFallback = !!providerErrors.length;
        geminiResult.providerErrors = providerErrors.map(function(item) {
          return {
            provider: item.provider,
            error: legacyIntakeSafeErrorTextV11203_(item.error)
          };
        });
      }
      return geminiResult;
    } catch (geminiError) {
      providerErrors.push({ provider: 'gemini', error: geminiError });
    }
  }

  if (!config.groqApiKey && !config.geminiApiKey) {
    providerErrors.push({
      provider: 'configuration',
      error: new Error('Legacy Intake OCR needs GROQ_API_KEY or GEMINI_API_KEY in Apps Script Script Properties.')
    });
  }

  return legacyIntakeProviderFailureResultV11203_(documentId, providerErrors);
}


function saveLegacyIntakeRecordOnlyV11203_(payload, pdfBlob, originalFileName) {
  assertWaffleActionAllowedDuringMaintenance_('saveLegacyIntakeMediaGroqFirstV11203');

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
  if (!bookingMatch) {
    throw new Error('The selected booking could not be found. Refresh and try again.');
  }

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

  var pdfFile = dogFolder.createFile(
    pdfBlob.copyBlob().setName(storedName)
  );
  var documentId = 'legacy_' + Utilities.getUuid().replace(/-/g, '');
  var legacySheet = getLegacyIntakeSheet_();

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
    'Saved · Pending AI'
  ]);

  logAuditEvent_({
    category: 'Intake',
    action: 'Legacy Intake Uploaded',
    dogName: booking.dogName,
    bookingType: booking.bookingType || 'Boarding',
    reference: documentId,
    summary:
      'Legacy intake saved privately in Google Drive for ' +
      booking.dogName +
      '. Groq-first OCR started.',
    changedFields: ['Legacy Intake PDF'],
    after: {
      stayKey: stayKey,
      documentId: documentId,
      pdfFileId: pdfFile.getId(),
      originalFilename: fileName,
      aiStatus: 'Saved · Pending AI',
      providerOrder: ['groq', 'gemini']
    },
    source: 'Legacy Intake OCR'
  });

  touchWaffleDataVersion_('directory');

  return {
    documentId: documentId,
    stayKey: stayKey,
    dogName: booking.dogName,
    bookingType: booking.bookingType || 'Boarding',
    pdfFile: pdfFile,
    pdfUrl: pdfFile.getUrl(),
    uploadedAt: now.toISOString()
  };
}


function saveLegacyIntakeMediaGroqFirstV11203(payload) {
  payload = payload && typeof payload === 'object' ? payload : {};

  var fileData = String(payload.fileData || '');
  var fileName = String(payload.fileName || 'Legacy Intake');
  var sourceKind = String(payload.sourceKind || '').toLowerCase();
  var ocrImages = Array.isArray(payload.ocrImages)
    ? payload.ocrImages.slice(0, LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_)
    : [];
  var ocrPageCount = Math.max(0, Number(payload.ocrPageCount || ocrImages.length || 0));
  var pdfBlob;
  var originalName = fileName;

  if (/^data:application\/pdf;base64,/i.test(fileData)) {
    pdfBlob = decodeLegacyPdfData_(fileData, fileName);
  } else if (/^data:image\//i.test(fileData)) {
    var imageBlob = decodeLegacyIntakeImageV11191_(fileData, fileName);
    pdfBlob = legacyIntakeImageToPdfV11191_(imageBlob, fileName);
    if (!ocrImages.length) ocrImages = [fileData];
    ocrPageCount = 1;
  } else {
    throw new Error('Please choose a PDF or a clear photo/image of the intake form.');
  }

  var saved = saveLegacyIntakeRecordOnlyV11203_(payload, pdfBlob, originalName);
  var documentId = saved.documentId;

  if (ocrImages.length) {
    persistLegacyIntakeOcrImagesV11203_(documentId, saved.pdfFile, ocrImages);
  }

  var result;
  if (ocrPageCount > LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_) {
    var config = getLegacyIntakeProviderConfigV11203_();
    if (config.geminiFallbackEnabled && config.geminiApiKey) {
      result = retryGeminiLegacyIntakeWithTransientRetryV11202(documentId);
      if (result && typeof result === 'object') {
        result.provider = 'gemini';
        result.providerFallback = true;
        result.providerReason = 'PDF has more than ' + LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_ + ' rendered OCR pages.';
      }
    } else {
      result = legacyIntakeProviderFailureResultV11203_(documentId, [{
        provider: 'groq',
        error: new Error(
          'This PDF has ' + ocrPageCount + ' pages. Groq OCR currently prepares up to ' +
          LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_ + ' pages per intake and Gemini fallback is unavailable.'
        )
      }]);
    }
  } else {
    result = processLegacyIntakeWithProvidersV11203_(documentId, ocrImages);
  }

  if (result && typeof result === 'object') {
    result.uploadedAt = saved.uploadedAt;
    result.sourceKind = sourceKind || (/^data:application\/pdf/i.test(fileData) ? 'pdf' : 'image');
    result.originalFilename = originalName;
    result.ocrPageCount = ocrPageCount;
    result.groqOcrPrepared = !!ocrImages.length;
  }

  if (sourceKind && sourceKind !== 'pdf') {
    try {
      var legacySheet = getLegacyIntakeSheet_();
      var record = findLegacyIntakeDocumentById_(legacySheet, documentId);
      if (record) legacySheet.getRange(record.row, 13).setValue(originalName);
    } catch (_) {}
  }

  return result;
}


function retryLegacyIntakeAiGroqFirstV11203(documentId) {
  assertWaffleActionAllowedDuringMaintenance_('retryLegacyIntakeAiGroqFirstV11203');
  documentId = String(documentId || '').trim();
  if (!documentId) throw new Error('Legacy document ID is required.');
  return processLegacyIntakeWithProvidersV11203_(documentId, null);
}


function verifyWaffleHouseLegacyIntakeGroqV11203() {
  var config = getLegacyIntakeProviderConfigV11203_();
  return {
    result: 'success',
    version: '11.2.03',
    providerOrder: ['groq', 'gemini'],
    groqConfigured: !!config.groqApiKey,
    groqModel: config.groqModel,
    geminiConfigured: !!config.geminiApiKey,
    geminiFallbackEnabled: config.geminiFallbackEnabled,
    maxPreparedPdfPages: LEGACY_INTAKE_GROQ_MAX_RENDERED_PAGES_V11203_,
    retryFunction: 'retryLegacyIntakeAiGroqFirstV11203'
  };
}
