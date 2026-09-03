/* ============================================================
 * WAFFLE HOUSE V11.2.04 — LEGACY INTAKE FINALIZE
 * ------------------------------------------------------------
 * Lets the sitter explicitly confirm the selected booking when OCR reads a
 * different dog name. The selected Waffle booking remains authoritative:
 * the extracted dog name is never written back, while the remaining supported
 * intake attributes are applied to the selected guest and audited.
 * ============================================================ */


function finalizeLegacyIntakeForSelectedBookingV11204(payload) {
  assertWaffleActionAllowedDuringMaintenance_(
    'finalizeLegacyIntakeForSelectedBookingV11204'
  );

  payload = payload && typeof payload === 'object' ? payload : {};

  var documentId = String(payload.documentId || '').trim();
  if (!documentId) {
    throw new Error('Legacy document ID is required.');
  }

  var legacySheet = getLegacyIntakeSheet_();
  var record = findLegacyIntakeDocumentById_(legacySheet, documentId);

  if (!record) {
    throw new Error('The legacy intake document could not be found.');
  }

  var extraction =
    record.parsedFields && typeof record.parsedFields === 'object'
      ? JSON.parse(JSON.stringify(record.parsedFields))
      : null;

  if (!extraction) {
    throw new Error(
      'This intake has no stored AI extraction to apply. Run Retry AI Read first.'
    );
  }

  var conflicts = Array.isArray(record.reviewConflicts)
    ? record.reviewConflicts
    : [];

  var identityConflict = conflicts.filter(function(conflict) {
    return (
      conflict &&
      conflict.type === 'identity' &&
      conflict.key === 'dogName'
    );
  })[0] || null;

  if (!identityConflict) {
    throw new Error(
      'This intake does not require selected-dog identity confirmation.'
    );
  }

  var mainSheet = getTargetSheet_();
  var rows = mainSheet.getDataRange().getValues();
  var bookingMatch = findBookingByStayKey_(rows, record.stayKey);

  if (!bookingMatch) {
    throw new Error(
      'The selected booking could not be found. Reassign the intake before finalising it.'
    );
  }

  var booking = bookingMatch.record;
  var selectedDogName = String(booking.dogName || record.dogName || '').trim();

  if (!selectedDogName) {
    throw new Error('The selected booking does not have a dog name.');
  }

  extraction.profile =
    extraction.profile && typeof extraction.profile === 'object'
      ? extraction.profile
      : {};

  var extractedDogName = String(
    extraction.profile.dogName || identityConflict.extracted || ''
  ).trim();

  // The sitter selected this booking before scanning. Confirming Done means
  // that selection is authoritative; the OCR-read dog name is retained only
  // in the stored original extraction / audit trail, never written to profile.
  extraction.profile.dogName = selectedDogName;

  var plan = buildGeminiLegacyAutoApplyPlan_(record.stayKey, extraction);

  if (plan.blocked) {
    throw new Error(
      'The intake could not be finalised against the selected guest. Review the assignment and try again.'
    );
  }

  var applyResult = applyLegacyIntakeProfileUpdates_(
    record.stayKey,
    plan.updates,
    documentId
  );

  var finalStayKey = String(applyResult.stayKey || record.stayKey || '').trim();
  var finalDogName = String(applyResult.dogName || selectedDogName).trim();

  // Save the full supported intake profile even when a core directory/care
  // conflict remains for manual review. This matches the normal Legacy Intake
  // path: profile detail fields are retained while destructive replacements
  // of existing values still require explicit review.
  saveIntakeAttributesForStay_(
    finalDogName,
    booking.startDate,
    booking.endDate,
    finalStayKey,
    legacyParsedFieldsToIntakeAttributes_(extraction),
    'Legacy Intake · Confirmed'
  );

  var mergedApplied = mergeLegacyAppliedFields_(
    record.appliedFields,
    applyResult
  );

  var remaining = Array.isArray(plan.conflicts) ? plan.conflicts : [];
  var finalStatus = remaining.length ? 'Review Required' : 'Complete';

  legacySheet.getRange(record.row, 2).setValue(new Date());
  legacySheet.getRange(record.row, 4).setValue(finalStayKey);
  legacySheet.getRange(record.row, 5).setValue(finalDogName);
  legacySheet.getRange(record.row, 20).setValue(JSON.stringify(mergedApplied));
  legacySheet.getRange(record.row, 21).setValue(JSON.stringify(remaining));
  legacySheet.getRange(record.row, 22).setValue(finalStatus);

  var changedFields = []
    .concat(Array.isArray(applyResult.changedFields) ? applyResult.changedFields : [])
    .concat(['Legacy Intake Identity Confirmation', 'Profile Intake Attributes'])
    .filter(function(value, index, array) {
      return value && array.indexOf(value) === index;
    });

  logAuditEvent_({
    category: 'Intake',
    action: 'Legacy Intake Identity Confirmed',
    dogName: finalDogName,
    bookingType: booking.bookingType || 'Boarding',
    reference: documentId,
    summary:
      'Selected booking ' + finalDogName +
      ' was confirmed as authoritative for the legacy intake. ' +
      (extractedDogName
        ? 'OCR dog name “' + extractedDogName + '” was ignored. '
        : '') +
      'Supported intake attributes were saved to the selected profile.',
    changedFields: changedFields,
    before: {
      selectedDogName: finalDogName,
      extractedDogName: extractedDogName,
      aiStatus: record.aiStatus || 'Review Required'
    },
    after: {
      selectedDogName: finalDogName,
      extractedDogNameIgnored: extractedDogName,
      aiStatus: finalStatus,
      applied: mergedApplied,
      remainingConflicts: remaining
    },
    source: 'Legacy Intake Review'
  });

  touchWaffleDataVersion_('directory');

  return {
    result: 'success',
    action: 'legacy_intake_finalized',
    documentId: documentId,
    stayKey: finalStayKey,
    dogName: finalDogName,
    pdfUrl: record.pdfUrl || '',
    aiStatus: finalStatus,
    extraction: record.parsedFields,
    applied: mergedApplied,
    changedFields: changedFields,
    conflicts: remaining,
    identityConfirmed: true,
    extractedDogNameIgnored: extractedDogName
  };
}


function verifyWaffleHouseLegacyIntakeFinalizeV11204() {
  return {
    result: 'success',
    version: '11.2.04',
    behavior: 'Done confirms selected booking, ignores OCR dog name, applies supported profile attributes',
    functionName: 'finalizeLegacyIntakeForSelectedBookingV11204'
  };
}
