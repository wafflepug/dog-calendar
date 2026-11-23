/* Private, append-only sales ledger. The owner key is accepted only in POST bodies. */
var PRIVATE_SALES_HEADERS_ = ['Stay ID', 'Revision', 'Change ID', 'Saved at', 'Sale JSON'];

function privateSalesAuthorize_(key) {
  var secret = PropertiesService.getScriptProperties().getProperty('PALZ_SALES_ACCESS_KEY');
  if (!secret || !/^[a-zA-Z0-9_-]{32,128}$/.test(secret)) throw new Error('Shared Sales has not been enabled.');
  if (typeof key !== 'string' || key.length > 128) throw new Error('Sales access denied.');
  var expected = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, secret);
  var actual = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key);
  var mismatch = 0;
  expected.forEach(function(byte, i) { mismatch |= byte ^ actual[i]; });
  if (mismatch) throw new Error('Sales access denied.');
}

function privateSalesMoney_(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 99999999999) throw new Error('Invalid sales amount.');
  return value;
}

function privateSalesRecord_(input, booking, now, checkPrice) {
  if (!input || ['direct', 'marketplace'].indexOf(input.channel) < 0 ||
      ['fixed', 'nightly'].indexOf(input.priceType) < 0 || !Array.isArray(input.payments) || input.payments.length > 150) {
    throw new Error('Invalid sales record.');
  }
  var rate = privateSalesMoney_(input.rate);
  var total = privateSalesMoney_(input.total);
  var nights = Math.max(1, Math.round((Date.parse(booking.endDate) - Date.parse(booking.startDate)) / 86400000));
  if (checkPrice && total !== rate * (input.priceType === 'nightly' ? nights : 1)) throw new Error('Stay dates changed. Refresh and review the price.');
  var payments = input.payments.map(function(payment) {
    if (!payment || ['Bank transfer', 'Cash', 'Other', 'Marketplace payout'].indexOf(payment.method) < 0) throw new Error('Invalid payment method.');
    var date = sitterDate_(payment.date);
    if (date > now) throw new Error('Payment dates cannot be in the future.');
    var normalized = {cents:privateSalesMoney_(payment.cents),date:date,method:payment.method};
    if (payment.kind === 'refund') normalized.kind = 'refund';
    return normalized;
  });
  var net = 0;
  var ordered = payments.slice().sort(function(a,b){return a.date.localeCompare(b.date) || Number(a.kind === 'refund') - Number(b.kind === 'refund');});
  if (ordered.some(function(p){net += p.kind === 'refund' ? -p.cents : p.cents; return net < 0;}) || net > total) throw new Error('Payments and refunds do not match the stay balance.');
  var note = String(input.bookkeepingNote || '');
  if (note.length > 240) throw new Error('Bookkeeping notes must be 240 characters or fewer.');
  return {dogName:booking.dogName,startDate:booking.startDate,endDate:booking.endDate,channel:input.channel,
    priceType:input.priceType,rate:rate,total:total,dueDate:sitterDate_(input.dueDate),payments:payments,
    expenses:privateSalesMoney_(input.expenses || 0),bookkeepingNote:note};
}

function palzPrivateWorkbook_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('PALZ_SALES_SPREADSHEET_ID');
  if (!spreadsheetId || spreadsheetId === getTargetSheet_().getParent().getId()) throw new Error('Owner tools need a separate private spreadsheet.');
  if (DriveApp.getFileById(spreadsheetId).getSharingAccess() !== DriveApp.Access.PRIVATE) throw new Error('Set the owner tools spreadsheet to restricted access.');
  return SpreadsheetApp.openById(spreadsheetId);
}

function privateSalesLedger_(request) {
  var spreadsheet = palzPrivateWorkbook_();
  var sheet = spreadsheet.getSheetByName('Palz_Private_Sales');
  var records = {}, changes = {};
  if (sheet && sheet.getLastRow()) {
    var rows = sheet.getDataRange().getValues();
    if (JSON.stringify(rows[0]) !== JSON.stringify(PRIVATE_SALES_HEADERS_)) throw new Error('Sales ledger needs review.');
    rows.slice(1).forEach(function(row) {
      if (!careRoutineLogUuidValid_(row[0]) || !careRoutineLogUuidValid_(row[1]) || !careRoutineLogUuidValid_(row[2]) || changes[row[0] + ':' + row[2]]) throw new Error('Sales ledger needs review.');
      var sale = JSON.parse(row[4]);
      changes[row[0] + ':' + row[2]] = sale;
      records[row[0]] = Object.assign({revision:row[1]}, sale);
    });
  }
  if (request.operation === 'read') return {records:records};
  if (request.operation !== 'commit' || !careRoutineLogUuidValid_(request.changeId) ||
      !Array.isArray(request.entries) || !request.entries.length || request.entries.length > 200) throw new Error('Invalid Sales update.');
  var inventory = stayOperationBookingIndexV11226_();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var seen = {};
  var pending = [];
  request.entries.forEach(function(entry) {
    var id = String(entry.stayId || '').toLowerCase(), previous = records[id], booking = inventory.byId[id];
    if (!careRoutineLogUuidValid_(id) || seen[id] || !booking || inventory.idCounts[id] !== 1) throw new Error('An entry did not match one confirmed stay.');
    seen[id] = true;
    var retry = changes[id + ':' + request.changeId];
    if (retry) {
      if (JSON.stringify(privateSalesRecord_(entry.record, retry, now, false)) !== JSON.stringify(retry)) throw new Error('This Sales update was already used for a different change.');
      return;
    }
    if (String(entry.expectedRevision || '') !== (previous ? previous.revision : '')) throw new Error('Sales changed on another device. Refresh and review before saving.');
    var priceChanged = entry.record.rate !== previous?.rate || entry.record.priceType !== previous?.priceType || entry.record.total !== previous?.total;
    var sale = privateSalesRecord_(entry.record, booking, now, priceChanged && !entry.importLocal);
    var revision = Utilities.getUuid();
    pending.push([id, revision, request.changeId, new Date(), JSON.stringify(sale)]);
    records[id] = Object.assign({revision:revision}, sale);
  });
  if (pending.length) {
    if (!sheet) sheet = spreadsheet.insertSheet('Palz_Private_Sales');
    if (!sheet.getLastRow()) sheet.appendRow(PRIVATE_SALES_HEADERS_);
    var firstRow = sheet.getLastRow() + 1;
    var requiredRows = firstRow + pending.length - 1;
    if (requiredRows > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
    sheet.getRange(firstRow, 1, pending.length, PRIVATE_SALES_HEADERS_.length).setValues(pending);
    SpreadsheetApp.flush();
  }
  return {records:records};
}

function privateSalesResponse_(json) {
  var lock;
  try {
    assertWaffleActionAllowedDuringMaintenance_('private_sales');
    if (!json || json.length > 1000000) throw new Error('Sales request is too large.');
    var request = JSON.parse(json);
    privateSalesAuthorize_(request.key);
    lock = LockService.getScriptLock();
    lock.waitLock(15000);
    return jsonResponse_(Object.assign({result:'success'}, privateSalesLedger_(request)));
  } catch (error) {
    return jsonResponse_({result:'error',error:error.message || 'Sales is unavailable.'});
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
