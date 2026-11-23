var CARE_SCHEDULE_HEADERS_ = ['Stay ID','Dog ID','Revision','Schedule JSON'];
var CARE_SCHEDULE_TYPES_ = ['feeding','walk','medication'];

function careScheduleSheet_(create) {
  var book = getTargetSheet_().getParent(), sheet = book.getSheetByName('Stay_Care_Schedule');
  if (!sheet && create) sheet = book.insertSheet('Stay_Care_Schedule');
  if (sheet && !sheet.getLastRow() && create) sheet.appendRow(CARE_SCHEDULE_HEADERS_);
  return sheet;
}

function careScheduleRows_() {
  var sheet = careScheduleSheet_(false);
  if (!sheet || !sheet.getLastRow()) return [];
  var rows = sheet.getRange(1,1,sheet.getLastRow(),4).getValues();
  if (JSON.stringify(rows[0]) !== JSON.stringify(CARE_SCHEDULE_HEADERS_)) throw new Error('Care schedule needs review.');
  return rows.slice(1).map(function(row,index) {
    return {row:index+2,stayId:row[0],dogId:row[1],revision:row[2],slots:JSON.parse(row[3])};
  });
}

function careScheduleFor_(id, rows) {
  var matches = rows.filter(function(row) { return row.stayId === id.stayId; });
  if (matches.length > 1 || matches.some(function(row) { return row.dogId !== id.dogId; })) throw new Error('Care schedule identity needs review.');
  return matches[0] || {stayId:id.stayId,dogId:id.dogId,revision:'',slots:[]};
}

function careScheduleGet_(data) {
  var id = careRoutineLogResolveStay_(data,false);
  return {result:'success',schedule:careScheduleFor_(id,careScheduleRows_())};
}

function careScheduleSave_(data) {
  var id = careRoutineLogResolveStay_(data,false), previous = careScheduleFor_(id,careScheduleRows_());
  if (String(data.expectedRevision || '') !== previous.revision) throw new Error('The care schedule changed. Reload before saving.');
  if (!Array.isArray(data.slots) || data.slots.length > 18) throw new Error('Add up to 18 daily care times.');
  var unique = {};
  var slots = data.slots.map(function(slot) {
    if (!slot || CARE_SCHEDULE_TYPES_.indexOf(slot.type) < 0) throw new Error('Choose a care activity.');
    var time = sitterTime_(slot.time), key = slot.type+':'+time;
    if (!time || unique[key]) throw new Error('Choose a time for each activity and remove duplicates.');
    if (slot.type === 'medication' && data.medicationConfirmed !== true) throw new Error('Confirm the medication schedule before saving.');
    unique[key] = true;
    return {type:slot.type,time:time};
  });
  var sheet = careScheduleSheet_(true), revision = Utilities.getUuid();
  var row = previous.row || sheet.getLastRow()+1;
  if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),1);
  sheet.getRange(row,1,1,4).setValues([[id.stayId,id.dogId,revision,JSON.stringify(slots)]]);
  return {result:'success',schedule:{stayId:id.stayId,dogId:id.dogId,revision:revision,slots:slots}};
}

function careScheduleEventId_(stayId, date, slot) {
  var hex = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,[stayId,date,slot.type,slot.time].join('|')).slice(0,16)
    .map(function(byte) { return ((byte + 256) % 256).toString(16).padStart(2,'0'); }).join('');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);
}

function careScheduleToday_() {
  var schedules = careScheduleRows_();
  if (!schedules.length) return {result:'success',tasks:[]};
  var now = new Date(), zone = Session.getScriptTimeZone(), date = Utilities.formatDate(now,zone,'yyyy-MM-dd');
  var time = Utilities.formatDate(now,zone,'HH:mm'), inventory = stayOperationBookingIndexV11226_();
  var operations = readStayOperationsV11226_({stayIds:schedules.map(function(row){return row.stayId;})},{inventory:inventory});
  var log = careRoutineLogSheetReadOnly_(), completions = {};
  if (log && log.getLastRow() > 1) log.getRange(2,1,log.getLastRow()-1,7).getValues().forEach(function(row) {
    completions[String(row[0])] = row[6] instanceof Date ? row[6].toISOString() : String(row[6] || '');
  });
  var tasks = [];
  schedules.forEach(function(plan) {
    var booking = inventory.byId[plan.stayId];
    if (!booking || inventory.idCounts[plan.stayId] !== 1 || booking.dogId.toLowerCase() !== plan.dogId ||
        booking.startDate > date || booking.endDate < date || inventory.byKey[booking.stayKey].length !== 1) return;
    if (!operations.some(function(op) { return op.stayId === plan.stayId && op.status === 'checked_in' && !op.identityConflict; })) return;
    plan.slots.forEach(function(slot) {
      var eventId = careScheduleEventId_(plan.stayId,date,slot), completedAt = completions[eventId] || '';
      tasks.push({stayId:plan.stayId,dogId:plan.dogId,stayKey:booking.stayKey,dogName:booking.dogName,date:date,
        type:slot.type,time:slot.time,eventId:eventId,completedAt:completedAt,overdue:!completedAt && slot.time < time});
    });
  });
  tasks.sort(function(a,b) { return a.time.localeCompare(b.time) || a.dogName.localeCompare(b.dogName); });
  return {result:'success',tasks:tasks};
}

function careScheduleComplete_(data) {
  var task = careScheduleToday_().tasks.find(function(row) { return row.eventId === data.eventId && row.stayId === data.stayId && row.dogId === data.dogId; });
  if (!task) throw new Error('This care activity is no longer on today’s schedule.');
  return recordCareRoutineEvent_({stayId:task.stayId,dogId:task.dogId,stayKey:task.stayKey,eventId:task.eventId,type:task.type,note:'Scheduled '+task.time});
}
