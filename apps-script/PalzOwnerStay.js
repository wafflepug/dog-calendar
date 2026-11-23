var PALZ_OWNER_STAY_HEADERS_ = ['Stay ID','Dog ID','Link hash','Expires','Update','Intake token','Photo 1','Photo 2','Photo 3','Photo 4'];

function palzOwnerStayHash_(token) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,token));
}

function palzOwnerStaySheet_(write) {
  var book = palzPrivateWorkbook_(), sheet = book.getSheetByName('Owner_Stay_Links');
  if (!sheet && write) sheet = book.insertSheet('Owner_Stay_Links');
  if (sheet && !sheet.getLastRow() && write) sheet.appendRow(PALZ_OWNER_STAY_HEADERS_);
  if (sheet && sheet.getLastRow() &&
      JSON.stringify(sheet.getRange(1,1,1,PALZ_OWNER_STAY_HEADERS_.length).getValues()[0]) !== JSON.stringify(PALZ_OWNER_STAY_HEADERS_)) throw new Error('Owner stay links need review.');
  return sheet;
}

function palzOwnerStayRows_(sheet) {
  return sheet && sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,PALZ_OWNER_STAY_HEADERS_.length).getValues() : [];
}

function palzIntakeForOwnerStay_(token, id) {
  if (!/^[A-Za-z0-9_\-]{20,128}$/.test(token || '')) return null;
  var record = findIntakeRecordByToken_(getIntakeSheet_(),token);
  return record && record.stayKey === id.stayKey &&
    String(record.stayId || '').toLowerCase() === id.stayId && String(record.dogId || '').toLowerCase() === id.dogId ? record : null;
}

function palzOwnerStayIssue_(payload, id) {
  var sheet = palzOwnerStaySheet_(payload.operation === 'issue'), rows = palzOwnerStayRows_(sheet);
  var matches = rows.map(function(row,index){return {row:row,index:index+2};}).filter(function(entry){return entry.row[0] === id.stayId;});
  if (matches.length > 1 || matches.some(function(entry){return entry.row[1] !== id.dogId;})) throw new Error('Owner link identity needs review.');
  var current = matches[0];
  if (payload.operation === 'revoke') {
    if (current) sheet.getRange(current.index,3,1,PALZ_OWNER_STAY_HEADERS_.length-2).clearContent();
    return {};
  }
  if (payload.operation === 'link_status') return {active:!!(current && current.row[2] && Number(current.row[3]) > Date.now())};
  var note = String(payload.update || '').trim(), intake = String(payload.intake || '').trim(), photo = String(payload.photo || '');
  if (note.length > 1000) throw new Error('Keep the owner update to 1,000 characters.');
  if (intake && !palzIntakeForOwnerStay_(intake,id)) throw new Error('The intake link does not match this stay.');
  if (photo && (photo.length > 150000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo))) throw new Error('Choose a small JPEG photo to share.');
  var token = makeIntakeToken_();
  var expires = Date.now()+7*86400000;
  var chunks = [0,1,2,3].map(function(index){return JSON.stringify(photo.slice(index*40000,(index+1)*40000));});
  var row = [id.stayId,id.dogId,palzOwnerStayHash_(token),expires,JSON.stringify(note),intake].concat(chunks);
  var index = current ? current.index : sheet.getLastRow()+1;
  if (index > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),1);
  sheet.getRange(index,1,1,row.length).setValues([row]);
  return {token:token,expires:expires};
}

function palzOwnerStayRead_(payload) {
  if (!/^[a-f0-9]{64}$/.test(payload.token || '')) throw new Error('This stay link is unavailable.');
  var hash = palzOwnerStayHash_(payload.token);
  var matches = palzOwnerStayRows_(palzOwnerStaySheet_(false)).filter(function(row){return row[2] === hash;});
  if (matches.length !== 1 || Number(matches[0][3]) <= Date.now()) throw new Error('This stay link has expired or been revoked.');
  var row = matches[0], inventory = stayOperationBookingIndexV11226_(), booking = inventory.byId[row[0]];
  if (!booking || inventory.idCounts[row[0]] !== 1 || booking.dogId.toLowerCase() !== row[1]) throw new Error('This stay link is unavailable.');
  var id = careRoutineLogResolveStay_({stayId:row[0],dogId:row[1],stayKey:booking.stayKey},false);
  var handover = sitterHandoverRead_(id);
  var operations = readStayOperationsV11226_({stayIds:[id.stayId]},{inventory:inventory});
  var now = Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
  var canEdit = now <= booking.endDate && !operations.some(function(op){return op.status === 'checked_out' || op.identityConflict;});
  var canEditDropoff = now <= booking.startDate && !operations.some(function(op){return op.status === 'checked_in';});
  if (payload.operation === 'handover') {
    if (!canEdit) throw new Error('This stay no longer accepts handover changes.');
    handover = saveSitterHandover_({stayId:id.stayId,dogId:id.dogId,stayKey:id.stayKey,expectedRevision:payload.revision,
      dropoffTime:canEditDropoff ? payload.dropoffTime : handover.times.dropoffTime,pickupTime:payload.pickupTime}).record;
  }
  var intake = palzIntakeForOwnerStay_(row[5],id);
  return {dogName:booking.dogName,startDate:booking.startDate,endDate:booking.endDate,times:handover.times,revision:handover.revision,canEdit:canEdit,canEditDropoff:canEditDropoff,
    update:JSON.parse(row[4] || '""'), photo:row.slice(6).map(function(chunk){return JSON.parse(chunk || '""');}).join(''),
    intakeToken:intake && String(intake.status || '').toLowerCase() !== 'complete' ? row[5] : '', intakeComplete:String(intake && intake.status || '').toLowerCase() === 'complete'};
}

function palzCareRecovery_(payload, id) {
  var previousKey = String(payload.previousKey || '').trim();
  var sheet = getBelongingsSheetReadOnly_(), main = getTargetSheet_(), bookingRows = main.getDataRange().getValues();
  var state = readCareRecordIdentityState_(sheet);
  if (!state.ok) throw new Error('Care records need review before recovery.');
  var intake, checkedIntake = false;
  function canRelink(record) {
    if (!record.valid || record.stayKey === id.stayKey || (state.byKey[id.stayKey] || []).length ||
        (state.byKey[record.stayKey] || []).length !== 1 ||
        (record.stayId && record.stayId !== id.stayId) || (record.dogId && record.dogId !== id.dogId)) return false;
    var values = state.values[record.rowNumber-1];
    if (normalizeDateValue_(values[3]) !== id.booking.startDate || normalizeDateValue_(values[4]) !== id.booking.endDate) return false;
    var hasStableIds = record.stayId === id.stayId && record.dogId === id.dogId;
    if (!hasStableIds) {
      if (!checkedIntake) {
        checkedIntake = true;
        var intakeSheet = main.getParent().getSheetByName(String(
          PropertiesService.getScriptProperties().getProperty('INTAKE_SHEET_NAME') || 'Dog_Intake_Records').trim());
        if (intakeSheet && intakeSheet.getMaxColumns() >= INTAKE_HEADERS_.length) {
          intake = findIntakeRecordByStableStayId_(intakeSheet,id.stayId,id.dogId);
        }
      }
      if (!intake || intake.stayKey !== record.stayKey || intake.startDate !== id.booking.startDate ||
          intake.endDate !== id.booking.endDate ||
          intake.dogName.trim().toLowerCase() !== String(values[2] || '').trim().toLowerCase()) return false;
    }
    return resolveCareBookingIdentity_(record.stayKey,'','',bookingRows).reason === 'no-booking-proves-stay-key';
  }
  if (!previousKey) {
    var candidates = state.rows.filter(canRelink);
    return {candidates:candidates.map(function(record){return {key:record.stayKey,name:String(state.values[record.rowNumber-1][2] || '')};})};
  }
  var records = state.byKey[previousKey] || [];
  if (records.length !== 1 || !canRelink(records[0])) {
    throw new Error('No matching Care record can be safely relinked.');
  }
  var old = state.values[records[0].rowNumber-1];
  var before = {dogName:String(old[2] || ''),startDate:normalizeDateValue_(old[3]),endDate:normalizeDateValue_(old[4]),stayId:id.stayId};
  if (!migrateBelongingsIdentityForGuest_(main.getParent(),previousKey,id.stayKey,id.booking.dogName,id.stayId)) throw new Error('The Care record changed. Review it again.');
  var migratedIntake = migrateIntakeIdentitiesForGuest_(previousKey,id.stayKey,id.booking.dogName,{before:before,after:id.booking,row:id.booking.row,dogId:id.dogId});
  touchWaffleDataVersion_('directory');
  return {recovered:true,intake:migratedIntake};
}

function palzOwnerStayResponse_(action, raw) {
  var lock;
  try {
    assertWaffleActionAllowedDuringMaintenance_(action);
    if (!raw || raw.length > 180000) throw new Error('Owner stay request is too large.');
    var payload = JSON.parse(raw), result;
    if (action === 'palz_operator') privateSalesAuthorize_(payload.key);
    lock = LockService.getScriptLock();
    lock.waitLock(15000);
    if (action === 'owner_stay' && ['read','handover'].indexOf(payload.operation) >= 0) result = palzOwnerStayRead_(payload);
    else if (action === 'palz_operator') {
      var id = careRoutineLogResolveStay_(payload,false);
      if (['issue','revoke','link_status'].indexOf(payload.operation) >= 0) result = palzOwnerStayIssue_(payload,id);
      else if (['recover_preview','recover_apply'].indexOf(payload.operation) >= 0) {
        if (payload.operation === 'recover_preview') delete payload.previousKey;
        result = palzCareRecovery_(payload,id);
      }
    }
    if (!result) throw new Error('Unsupported owner stay request.');
    SpreadsheetApp.flush();
    return jsonResponse_({result:'success',value:result});
  } catch (error) {
    return jsonResponse_({result:'error',error:action === 'owner_stay' && !/^This stay|^Choose|^Handover|^Same-day|^Drop-off|^Pickup/.test(error.message) ? 'The stay link could not be loaded or updated.' : error.message});
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}

function palzPrearrivalChecks_() {
  var date = Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
  var last = new Date(Date.parse(date+'T00:00:00Z')+3*86400000).toISOString().slice(0,10);
  var inventory = stayOperationBookingIndexV11226_();
  var upcoming = Object.keys(inventory.byId).map(function(id){return inventory.byId[id];}).filter(function(booking){
    return booking.startDate >= date && booking.startDate <= last && inventory.idCounts[booking.stayId.toLowerCase()] === 1 &&
      inventory.byKey[booking.stayKey].length === 1 && careRoutineLogUuidValid_(booking.dogId);
  }).sort(function(a,b){return a.startDate.localeCompare(b.startDate);}).slice(0,30);
  if (!upcoming.length) return {result:'success',checks:[]};
  var operations = readStayOperationsV11226_({stayIds:upcoming.map(function(stay){return stay.stayId;})},{inventory:inventory});
  var sheet = sitterHandoverSheet_(false);
  var handovers = sheet && sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,3).getValues() : [];
  var statuses = getIntakeStatusRecords_(upcoming.map(function(stay){return stay.stayKey;}),null,inventory.rows);
  var profiles = readBelongingsRecords_(getBelongingsSheetReadOnly_(),upcoming.map(function(stay){return stay.stayKey;}),inventory.rows);
  var checks = [];
  upcoming.forEach(function(booking) {
    var id = booking.stayId.toLowerCase(), dogId = booking.dogId.toLowerCase();
    if (operations.some(function(op){return op.stayId === id && ['checked_in','checked_out'].indexOf(op.status) >= 0 && !op.identityConflict;})) return;
    var status = statuses.find(function(record){return record.stayKey === booking.stayKey;});
    var rows = handovers.filter(function(row){return row[0] === id && row[1] === dogId;});
    var times = rows.length === 1 ? JSON.parse(rows[0][2]) : {};
    var needs = [];
    if (!status || String(status.status || '').toLowerCase() !== 'complete') needs.push('Review intake');
    if (!times.dropoffTime || !times.pickupTime) needs.push('Confirm handover times');
    var profile = profiles.find(function(record){return record.stayKey === booking.stayKey;});
    var answers = profile && profile.intakeAttributes || {};
    if (normalizeIntakeYesNo_(answers.vaccinated) !== true || !hasMeaningfulIntakeText_(answers.vaccinationDetails)) needs.push('Review vaccination record');
    if (needs.length) checks.push({stayId:id,dogId:dogId,stayKey:booking.stayKey,dogName:booking.dogName,startDate:booking.startDate,needs:needs});
  });
  return {result:'success',checks:checks};
}
