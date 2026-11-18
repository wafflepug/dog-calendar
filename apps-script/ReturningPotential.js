/** Attach an existing numbered pet to an exact potential booking under the booking lock. */
function linkReturningPotential_(sheet, rows, data) {
  var sourceStayId = String(data.sourceStayId || '').trim();
  var stayId = String(data.stayId || '').trim();
  var dogId = String(data.dogId || '').trim();
  if (![sourceStayId, stayId, dogId].every(validStayIdV11225_) || sourceStayId.toLowerCase() === stayId.toLowerCase()) {
    throw new Error('Select the exact existing pet and the exact potential stay.');
  }
  var sourceRow = findStayRowByIdV11225_(sheet, sourceStayId);
  var targetRow = findStayRowByIdV11225_(sheet, stayId);
  if (sourceRow < 2 || targetRow < 2) throw new Error('The source or potential stay was not found.');
  var source = auditBookingSnapshotFromSheetRow_(sheet, sourceRow);
  var target = auditBookingSnapshotFromSheetRow_(sheet, targetRow);
  var sourceDog = v108DogIdentityAt_(rows, sourceRow - 1);
  var targetDog = v108DogIdentityAt_(rows, targetRow - 1);
  if (!isConfirmedStayBookingTypeV11225_(source.bookingType) ||
      ['potential stay', 'potential'].indexOf(String(target.bookingType || '').trim().toLowerCase()) === -1 ||
      sourceDog.dogId !== dogId || !/^#?[0-9]+$/.test(sourceDog.dogNumber)) {
    throw new Error('The potential stay or existing dog changed. Refresh both records.');
  }
  var normalizedPhone = function(value) { return String(value || '').replace(/[^0-9]/g, ''); };
  if (normalizeV108Identity_(source.ownerName) !== normalizeV108Identity_(target.ownerName) ||
      !normalizedPhone(source.phone) || normalizedPhone(source.phone) !== normalizedPhone(target.phone)) {
    throw new Error('The owner and contact number must match before linking this potential stay.');
  }
  if (targetDog.dogId && targetDog.dogId !== dogId) throw new Error('The potential stay already belongs to a different Dog ID.');
  var beforeKey = makeGuestStayKey_(target.dogName, target.startDate, target.endDate);
  var linkedKey = makeGuestStayKey_(source.dogName, target.startDate, target.endDate);
  var alreadyLinked = targetDog.dogId === dogId && beforeKey === linkedKey;
  if (!alreadyLinked && beforeKey !== String(data.expectedStayKey || '').trim()) throw new Error('The selected potential stay changed.');
  if (!resolveCareBookingIdentity_(beforeKey, stayId, targetDog.dogId, rows).ok) throw new Error('The potential stay identity is ambiguous.');
  if (beforeKey !== linkedKey && resolveCareBookingIdentity_(linkedKey, '', '', rows).reason !== 'no-booking-proves-stay-key') {
    throw new Error('Another booking already uses the returning dog’s name and dates.');
  }
  var careSheet = getBelongingsSheetReadOnly_();
  var careState = readCareRecordIdentityState_(careSheet);
  if (!careState.ok || (!alreadyLinked && (
    (careState.byKey[beforeKey] || []).length || (careState.byKey[linkedKey] || []).length
  ))) throw new Error('Existing care details need review before changing this potential stay.');
  var properties = PropertiesService.getScriptProperties();
  var intake = sheet.getParent().getSheetByName(String(properties.getProperty('INTAKE_SHEET_NAME') || 'Dog_Intake_Records').trim());
  if (!alreadyLinked && beforeKey !== linkedKey && intake && findIntakeRecordByStayKey_(intake, beforeKey)) {
    throw new Error('An existing form for the potential stay needs review before it can be renamed.');
  }

  var sourceKey = makeGuestStayKey_(source.dogName, source.startDate, source.endDate);
  var profile = getGuestProfileDetail_({ stayKey: sourceKey, stayId: sourceStayId, dogId: dogId });
  if (profile.resolution.status === 'unresolved') throw new Error('The source care profile could not be verified.');
  var sourceCare = readBelongingsRecords_(careSheet, [sourceKey], rows, careState)[0] || {};
  var attributes = profile.intakeAttributes || {};
  var primary = profile.dogPhoto;
  var gallery = profile.dogPhotoGallery || [];

  if (!alreadyLinked) {
    var columns = ensureV108DogIdColumn_(sheet);
    var changes = { 2: source.dogName, 3: source.breed, 10: target.notes || source.notes || '' };
    changes[columns.id + 1] = dogId;
    changes[columns.number + 1] = sourceDog.dogNumber;
    setBookingPetSpecies_(sheet, [], sourceDog.species);
    var speciesColumn = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].findIndex(function(header) {
      return String(header).trim().toLowerCase() === 'species';
    });
    if (speciesColumn >= 0) changes[speciesColumn + 1] = sourceDog.species === 'cat' ? 'Cat' : 'Dog';
    updateStableStayRowV11225_(sheet, targetRow, changes);
  }
  var copiedCare = hasStoredIntakeAttributes_(attributes) || !!primary || gallery.length > 0 ||
    Object.keys(sourceCare.riskFlags || {}).some(function(flag) { return sourceCare.riskFlags[flag] === true; });
  if (copiedCare) {
    var destination = getBelongingsSheet_();
    var existing = readBelongingsRecords_(destination, [linkedKey])[0] || {};
    var merged = Object.assign({}, attributes);
    Object.keys(existing.intakeAttributes || {}).forEach(function(field) {
      if (String(existing.intakeAttributes[field] || '').trim()) merged[field] = existing.intakeAttributes[field];
    });
    var saved = upsertBelongingsRecord_(destination, {
      stayId: stayId, dogId: dogId, stayKey: linkedKey, dogName: source.dogName,
      startDate: target.startDate, endDate: target.endDate,
      intakeAttributes: merged, intakeAttributesSource: existing.intakeAttributesSource || 'Copied from previous stay',
      riskFlags: Object.assign({}, sourceCare.riskFlags || {}, existing.riskFlags || {})
    });
    if (primary && !existing.dogPhoto) destination.getRange(saved, 30).setValue(JSON.stringify(primary));
    if (gallery.length && !(existing.dogPhotoGallery || []).length) destination.getRange(saved, 33).setValue(JSON.stringify(gallery));
  }
  if (!alreadyLinked) {
    logAuditEvent_({
      category: 'Potential Stay', action: 'Potential Updated', dogName: source.dogName,
      bookingType: 'Potential Stay', reference: stayId, summary: 'Linked potential stay to existing Dog ID ' + sourceDog.dogNumber + '.',
      changedFields: ['Dog Name', 'Dog ID', 'Dog Number'], before: target,
      after: { stayId: stayId, dogId: dogId, dogName: source.dogName, sourceStayId: sourceStayId }
    });
  }
  return { result: 'success', action: 'link_returning_potential', stayId: stayId, stayKey: linkedKey,
    dogId: dogId, dogNumber: sourceDog.dogNumber, dogName: source.dogName, bookingType: 'Potential Stay',
    copiedCare: copiedCare, hasPhoto: !!primary };
}
