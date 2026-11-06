/* Shared planning settings and stay-specific handover times. Mutations use the router lock. */
var SITTER_PLANNING_KEY_ = 'PALZ_SITTER_PLANNING_V1';
function sitterDate_(value) {
  var s = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s + 'T12:00:00Z')) || new Date(s + 'T12:00:00Z').toISOString().slice(0,10) !== s) throw new Error('Choose a valid date.');
  return s;
}
function sitterTime_(value) {
  var s = String(value || '');
  if (s && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new Error('Choose a valid handover time.');
  return s;
}
function sitterPlanningRules_() {
  var raw = PropertiesService.getScriptProperties().getProperty(SITTER_PLANNING_KEY_);
  return raw ? JSON.parse(raw) : {version:1, revision:'', maxDogs:null, blocked:[], arrivalFrom:'', arrivalTo:'', pickupFrom:'', pickupTo:''};
}
function saveSitterPlanningRules_(data) {
  var previous = sitterPlanningRules_();
  if (String(data.expectedRevision || '') !== previous.revision) throw new Error('Availability changed on another device. Reload before saving.');
  var rules = typeof data.rules === 'string' ? JSON.parse(data.rules) : data.rules;
  if (!rules || typeof rules !== 'object') throw new Error('Availability settings are required.');
  var max = rules.maxDogs === '' || rules.maxDogs === null ? null : Number(rules.maxDogs);
  if (max !== null && (!Number.isInteger(max) || max < 1 || max > 100)) throw new Error('Maximum dogs must be 1–100, or blank for no limit.');
  if (!Array.isArray(rules.blocked) || rules.blocked.length > 30) throw new Error('Use at most 30 time-off periods.');
  var next = {version:1, revision:Utilities.getUuid(), maxDogs:max, blocked:rules.blocked.map(function(b) {
    var start = sitterDate_(b.start), end = sitterDate_(b.end);
    if (end < start) throw new Error('Time off must end on or after its start.');
    return {start:start, end:end};
  })};
  ['arrivalFrom','arrivalTo','pickupFrom','pickupTo'].forEach(function(k) {next[k] = sitterTime_(rules[k]);});
  ['arrival','pickup'].forEach(function(k) {if (!!next[k+'From'] !== !!next[k+'To'] || next[k+'From'] > next[k+'To']) throw new Error('Choose both ends of a same-day handover window.');});
  PropertiesService.getScriptProperties().setProperty(SITTER_PLANNING_KEY_, JSON.stringify(next));
  return {result:'success', rules:next};
}
function sitterPlanningAssert_(rows, start, end, name, excludeRow) {
  var rules = sitterPlanningRules_();
  if (!rules.maxDogs && !rules.blocked.length) return;
  start = sitterDate_(start); end = sitterDate_(end);
  if (end < start || (Date.parse(end)-Date.parse(start))/86400000 > 730) throw new Error('Booking dates must span no more than 730 days.');
  if (rules.blocked.some(function(b) {return start <= b.end && end >= b.start;})) throw new Error('These dates overlap your saved time off. Change the dates or update Availability in Settings.');
  if (!rules.maxDogs) return;
  var count = function(n) {return Math.max(1, String(n || '').split(/&|\s+and\s+/i).filter(function(x){return x.trim();}).length);};
  var bookings = rows.slice(1).map(function(r,i) {return {row:i+2, name:r[1], start:normalizeDateValue_(r[3]), end:normalizeDateValue_(r[4] || r[3]), type:String(r[11] || '').toLowerCase()};}).filter(function(b) {return b.row !== excludeRow && ['boarding','confirmed boarding'].indexOf(b.type) >= 0 && b.start <= end && b.end >= start;});
  for (var stamp=Date.parse(start+'T12:00:00Z'); stamp<=Date.parse(end+'T12:00:00Z'); stamp+=86400000) {
    var date=new Date(stamp).toISOString().slice(0,10), total=count(name);
    bookings.forEach(function(b){if(b.start<=date && b.end>=date) total+=count(b.name);});
    if (total > rules.maxDogs) throw new Error('Maximum '+rules.maxDogs+' dogs would be exceeded on '+date+'. Update Availability or choose other dates.');
  }
}
function sitterHandoverValidate_(data, start, end) {
  var dropoff=sitterTime_(data.dropoffTime), pickup=sitterTime_(data.pickupTime);
  if (start===end && dropoff && pickup && pickup<dropoff) throw new Error('Same-day pickup cannot be before drop-off.');
  var r=sitterPlanningRules_();
  if (dropoff && r.arrivalFrom && (dropoff<r.arrivalFrom || dropoff>r.arrivalTo)) throw new Error('Drop-off must be within the saved arrival window '+r.arrivalFrom+'–'+r.arrivalTo+'.');
  if (pickup && r.pickupFrom && (pickup<r.pickupFrom || pickup>r.pickupTo)) throw new Error('Pickup must be within the saved pickup window '+r.pickupFrom+'–'+r.pickupTo+'.');
  return {dropoffTime:dropoff,pickupTime:pickup};
}
function sitterHandoverSheet_(write) {
  var book=getTargetSheet_().getParent(), sheet=book.getSheetByName('Stay_Handover_Times');
  if(!sheet && write) {sheet=book.insertSheet('Stay_Handover_Times');sheet.appendRow(['Stay ID','Dog ID','Times JSON','Revision']);sheet.setFrozenRows(1);}
  if(sheet && JSON.stringify(sheet.getRange(1,1,1,4).getValues()[0])!==JSON.stringify(['Stay ID','Dog ID','Times JSON','Revision'])) throw new Error('Handover times schema needs review.');
  return sheet;
}
function sitterHandoverRead_(identity) {
  var sheet=sitterHandoverSheet_(false), matches=sheet && sheet.getLastRow()>1 ? sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues().map(function(r,i){return {row:i+2,stayId:String(r[0]),dogId:String(r[1]),times:JSON.parse(String(r[2])),revision:String(r[3])};}).filter(function(r){return r.stayId===identity.stayId;}) : [];
  if(matches.length>1 || matches.some(function(r){return r.dogId!==identity.dogId;})) throw new Error('Handover identity is ambiguous.');
  return matches[0] || {stayId:identity.stayId,dogId:identity.dogId,times:{dropoffTime:'',pickupTime:''},revision:''};
}
function getSitterHandover_(data) {
  var id=careRoutineLogResolveStay_(data,false);
  return {result:'success',record:sitterHandoverRead_(id)};
}
function saveSitterHandover_(data) {
  var id=careRoutineLogResolveStay_(data,false), old=sitterHandoverRead_(id), times=sitterHandoverValidate_(data,id.booking.startDate,id.booking.endDate);
  if(String(data.expectedRevision || '')!==old.revision) {
    if(old.times.dropoffTime===times.dropoffTime && old.times.pickupTime===times.pickupTime) return {result:'success',record:old};
    throw new Error('Handover times changed on another device. Reload before saving.');
  }
  var sheet=sitterHandoverSheet_(true), revision=Utilities.getUuid();
  sheet.getRange(old.row || sheet.getLastRow()+1,1,1,4).setValues([[id.stayId,id.dogId,JSON.stringify(times),revision]]);
  return {result:'success',record:{stayId:id.stayId,dogId:id.dogId,times:times,revision:revision}};
}

function getSitterDayHandovers_() {
  var today=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd'), index=stayOperationBookingIndexV11226_(), sheet=sitterHandoverSheet_(false), times={};
  if(sheet && sheet.getLastRow()>1) sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues().forEach(function(r){var id=String(r[0]);if(times[id])times[id]={conflict:true};else times[id]={dogId:String(r[1]),times:JSON.parse(String(r[2]))};});
  var entries=[];
  Object.keys(index.byKey).forEach(function(k){var list=index.byKey[k];if(list.length!==1)return;var b=list[0], t=times[b.stayId], valid=index.idCounts[b.stayId]===1 && (!t || !t.conflict && t.dogId===b.dogId);if(!valid)return;
    if(b.startDate===today)entries.push({stayId:b.stayId,dogId:b.dogId,dogName:b.dogName,type:'Drop-off',time:t ? t.times.dropoffTime : ''});
    if(b.endDate===today)entries.push({stayId:b.stayId,dogId:b.dogId,dogName:b.dogName,type:'Pickup',time:t ? t.times.pickupTime : ''});
  });
  entries.sort(function(a,b){return (a.time || '99:99').localeCompare(b.time || '99:99') || a.dogName.localeCompare(b.dogName);});
  return {result:'success',date:today,entries:entries};
}

function getSitterRosterPickups_() {
  var sheet = sitterHandoverSheet_(false);
  if (!sheet || sheet.getLastRow() < 2) return {result:'success', pickups:[]};
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var index = stayOperationBookingIndexV11226_();
  var counts = Object.create(null);
  var pickups = [];
  sheet.getRange(2, 1, sheet.getLastRow()-1, 3).getValues().forEach(function(row) {
    var stayId = String(row[0]).toLowerCase(), dogId = String(row[1]);
    var booking = index.byId[stayId];
    counts[stayId] = (counts[stayId] || 0) + 1;
    if (!booking || index.idCounts[stayId] !== 1 || booking.dogId !== dogId ||
        booking.startDate > today || booking.endDate < today) return;
    var entry = {stayId:stayId, dogId:dogId, stayKey:booking.stayKey, time:JSON.parse(String(row[2])).pickupTime};
    pickups.push(entry);
  });
  return {result:'success', pickups:pickups.filter(function(entry) { return entry.time && counts[entry.stayId] === 1; })};
}

function readPalzBusinessBrand_() {
  var props = PropertiesService.getScriptProperties();
  var stored = props.getProperty('PALZ_BUSINESS_BRAND');
  if (stored) return JSON.parse(stored);
  return {name:props.getProperty('PALZ_BUSINESS_NAME') || 'Waffle House', tagline:'Dog sitting, organised.', icon:''};
}

function savePalzBusinessName_(data) {
  var name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name || name.length > 60 || /[\x00-\x1f\x7f]/.test(name)) {
    throw new Error('Enter a business name between 1 and 60 characters.');
  }
  var brand = readPalzBusinessBrand_();
  if (data.tagline !== undefined) {
    if (typeof data.tagline !== 'string' || data.tagline.length > 80 || /[\x00-\x1f\x7f]/.test(data.tagline)) {
      throw new Error('Use up to 80 characters for the tagline.');
    }
    brand.tagline = data.tagline.trim();
  }
  if (data.icon !== undefined) {
    if (typeof data.icon !== 'string' || data.icon.length > 1350 ||
        (data.icon && !/^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(data.icon))) {
      throw new Error('Choose a supported business icon.');
    }
    brand.icon = data.icon;
  }
  brand.name = name;
  PropertiesService.getScriptProperties().setProperty('PALZ_BUSINESS_BRAND', JSON.stringify(brand));
  return Object.assign({result:'success'}, brand);
}

function bookingPetSpecies_(value) {
  var species = String(value || 'dog').trim().toLowerCase();
  if (species !== 'dog' && species !== 'cat') throw new Error('Choose Dog or Cat.');
  return species;
}
function setBookingPetSpecies_(sheet, row, value) {
  if (bookingPetSpecies_(value) === 'dog') return row;
  var width = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  var column = headers.findIndex(function(header) {return String(header).trim().toLowerCase() === 'species';});
  if (column < 0) {
    column = width;
    if (sheet.getMaxColumns && column >= sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), 1);
    sheet.getRange(1, column + 1).setValue('Species');
  }
  while (row.length <= column) row.push('');
  row[column] = 'Cat';
  return row;
}
