/*
 * Synthetic-only Google Sheets harness for CareRecordIdentity.js.
 * Install this file beside the reviewed production identity module in a NEW,
 * standalone Apps Script test project. Run only from the editor; no web app.
 * Configure every allowlist value below before running. No customer data is read.
 */
var CARE_ID_TEST_CONFIG_ = {
  spreadsheetId: 'REPLACE_WITH_NEW_BLANK_SYNTHETIC_SPREADSHEET_ID',
  scriptId: 'REPLACE_WITH_STANDALONE_TEST_SCRIPT_ID',
  productionSpreadsheetIds: ['REPLACE_WITH_EACH_KNOWN_PRODUCTION_SPREADSHEET_ID'],
  markerSheet: '__CARE_ID_TEST_CONTROL__',
  markerCell: 'A1',
  markerValue: 'CARE_IDENTITY_TEST_ONLY:v1',
  bookingSheet: '__CARE_ID_TEST_BOOKINGS__',
  careSheet: '__CARE_ID_TEST_CARE__'
};

var CARE_ID_TEST_PREFIX_ = '__CARE_ID_TEST_';
var CARE_ID_TEST_UUID_A_ = '00000000-0000-4000-8000-000000000001';
var CARE_ID_TEST_UUID_B_ = '00000000-0000-4000-8000-000000000002';
var CARE_ID_TEST_DOG_ = '10000000-0000-4000-8000-000000000001';
var CARE_ID_TEST_DOG_OTHER_ = '10000000-0000-4000-8000-000000000002';

function careIdentitySyntheticRun() {
  careIdentityTestAssertSafeTarget_();
  var scriptProperties = PropertiesService.getScriptProperties();
  var originalBelongingsSheetName = scriptProperties.getProperty('BELONGINGS_SHEET_NAME');
  var hadBelongingsSheetName = originalBelongingsSheetName !== null && originalBelongingsSheetName !== undefined;
  try {
    careIdentityTestSetWriteFlag_(false);
    return careIdentitySyntheticRunBody_();
  } finally {
    careIdentityTestSetWriteFlag_(false);
    if (hadBelongingsSheetName) scriptProperties.setProperty('BELONGINGS_SHEET_NAME', originalBelongingsSheetName);
    else scriptProperties.deleteProperty('BELONGINGS_SHEET_NAME');
  }
}

function careIdentitySyntheticRunBody_() {
  careIdentityTestAssertSafeTarget_();
  var ss = SpreadsheetApp.openById(CARE_ID_TEST_CONFIG_.spreadsheetId);
  careIdentityTestPrepareSheets_(ss);
  var booking = ss.getSheetByName(CARE_ID_TEST_CONFIG_.bookingSheet);
  var care = ss.getSheetByName(CARE_ID_TEST_CONFIG_.careSheet);
  careIdentityTestSeed_(booking, care);
  var results = [];

  careIdentityTestRun_(results, 'default-off write keeps 34 columns', function() {
    careIdentityTestSetWriteFlag_(false);
    ensureCareRecordIdentityHeadersForWrite_(care, careRecordIdentityWritesEnabled_());
    careIdentityTestEqual_(care.getLastColumn(), 34);
  });
  careIdentityTestRun_(results, 'opt-in appends exactly Stay ID and Dog ID', function() {
    careIdentityTestSetWriteFlag_(true);
    ensureCareRecordIdentityHeadersForWrite_(care, careRecordIdentityWritesEnabled_());
    careIdentityTestEqual_(care.getLastColumn(), 36);
    careIdentityTestEqual_(care.getRange(1, 35, 1, 2).getValues()[0].join('|'), 'Stay ID|Dog ID');
  });
  careIdentityTestRun_(results, 'turning enrollment off preserves the 36-column schema', function() {
    careIdentityTestSetWriteFlag_(false);
    ensureCareRecordIdentityHeadersForWrite_(care, careRecordIdentityWritesEnabled_());
    careIdentityTestEqual_(care.getLastColumn(), 36);
  });
  careIdentityTestRun_(results, 'proven write persists both IDs and preserves other Care values', function() {
    careIdentityTestSeed_(booking, care);
    careIdentityTestSetWriteFlag_(true);
    var key = careIdentityTestKey_('Milo','2026-10-01','2026-10-03');
    assertCareRecordWriteIdentity_(care, { stayKey:key });
    careIdentityTestEqual_(care.getRange(2, 35, 1, 2).getValues()[0].join('|'), CARE_ID_TEST_UUID_A_ + '|' + CARE_ID_TEST_DOG_);
    careIdentityTestEqual_(care.getRange(2, 6).getValue(), 'synthetic-care-value');
  });
  careIdentityTestRun_(results, 'disabled writes preserve existing persisted IDs', function() {
    careIdentityTestSetWriteFlag_(false);
    var key = careIdentityTestKey_('Milo','2026-10-01','2026-10-03');
    assertCareRecordWriteIdentity_(care, { stayKey:key });
    careIdentityTestEqual_(care.getLastColumn(), 36);
    careIdentityTestEqual_(care.getRange(2, 35, 1, 2).getValues()[0].join('|'), CARE_ID_TEST_UUID_A_ + '|' + CARE_ID_TEST_DOG_);
  });
  careIdentityTestRun_(results, 'one Dog ID may own multiple distinct stays', function() {
    var rows = careIdentityTestBookingRows_(booking);
    var a = resolveCareBookingIdentity_(careIdentityTestKey_('Milo','2026-10-01','2026-10-03'), '', '', rows);
    var b = resolveCareBookingIdentity_(careIdentityTestKey_('Milo','2026-10-05','2026-10-07'), '', '', rows);
    careIdentityTestAssert_(a.ok && b.ok && a.identity.dogId === b.identity.dogId && a.identity.stayId !== b.identity.stayId, 'same dog, distinct stays did not resolve');
  });
  careIdentityTestRun_(results, 'duplicate booking keys and duplicate Care keys fail closed', function() {
    careIdentityTestSeed_(booking, care);
    ensureCareRecordIdentityHeadersForWrite_(care, true);
    var rows = careIdentityTestBookingRows_(booking);
    var shared = resolveCareBookingIdentity_(careIdentityTestKey_('Twin','2026-10-09','2026-10-11'), '', '', rows);
    careIdentityTestAssert_(!shared.ok && shared.reason === 'multiple-bookings-share-stay-key', 'duplicate booking key resolved');
    careIdentityTestAppendCareRow_(care, careIdentityTestKey_('Milo','2026-10-01','2026-10-03'));
    careIdentityTestThrows_(function() { resolveCareRecordIdentityForWrite_(care, { stayKey: careIdentityTestKey_('Milo','2026-10-01','2026-10-03') }); }, 'duplicate Care key did not throw');
  });
  careIdentityTestRun_(results, 'unknown extra columns are rejected', function() {
    careIdentityTestSeed_(booking, care);
    ensureCareRecordIdentityHeadersForWrite_(care, true);
    if (care.getMaxColumns() < 37) care.insertColumnAfter(care.getMaxColumns());
    care.getRange(1, 37).setValue('Unexpected Customer Column');
    careIdentityTestAssert_(!readCareRecordIdentityState_(care).ok, 'unknown header was accepted');
  });
  careIdentityTestRun_(results, 'stored identity conflicts are rejected', function() {
    careIdentityTestSeed_(booking, care);
    ensureCareRecordIdentityHeadersForWrite_(care, true);
    var cleanCare = care;
    cleanCare.getRange(2, 35, 1, 2).setValues([[CARE_ID_TEST_UUID_A_, CARE_ID_TEST_DOG_OTHER_]]);
    careIdentityTestThrows_(function() { resolveCareRecordIdentityForWrite_(cleanCare, { stayKey: careIdentityTestKey_('Milo','2026-10-01','2026-10-03') }); }, 'conflicting stored identity did not throw');
  });
  careIdentityTestRun_(results, 'name/date carry-forward follows the proven synthetic Stay ID', function() {
    careIdentityTestSeed_(booking, care);
    careIdentityTestSetWriteFlag_(false);
    var oldKey = careIdentityTestKey_('Milo','2026-10-01','2026-10-03');
    var newKey = careIdentityTestKey_('Milo Renamed','2026-10-02','2026-10-04');
    booking.getRange(2, 2).setValue('Milo Renamed');
    booking.getRange(2, 4, 1, 2).setValues([['2026-10-02','2026-10-04']]);
    PropertiesService.getScriptProperties().setProperty('BELONGINGS_SHEET_NAME', CARE_ID_TEST_CONFIG_.careSheet);
    var moved = migrateBelongingsIdentityForGuest_(ss, oldKey, newKey, 'Milo Renamed', CARE_ID_TEST_UUID_A_);
    careIdentityTestAssert_(moved, 'proven destination identity did not carry the legacy Care row');
    careIdentityTestEqual_(care.getRange(2, 2).getValue(), newKey);
    careIdentityTestEqual_(care.getRange(2, 3).getValue(), 'Milo Renamed');
    careIdentityTestEqual_(care.getLastColumn(), 34);
  });
  careIdentityTestRun_(results, 'reads leave headers and values unchanged', function() {
    careIdentityTestSeed_(booking, care);
    careIdentityTestSetWriteFlag_(false);
    var before = careIdentityTestSnapshot_([booking, care]);
    readCareRecordIdentityState_(care);
    describeCareRecordIdentityReads_(care, [careIdentityTestKey_('Milo','2026-10-01','2026-10-03')], careIdentityTestBookingRows_(booking));
    var after = careIdentityTestSnapshot_([booking, care]);
    careIdentityTestEqual_(JSON.stringify(after), JSON.stringify(before));
  });

  var report = {
    result: results.every(function(x) { return x.ok; }) ? 'PASS' : 'FAIL',
    executedAtUtc: new Date().toISOString(),
    scriptId: ScriptApp.getScriptId(),
    spreadsheetId: ss.getId(),
    fixture: 'synthetic-only; two generated tabs; no customer rows',
    enrollmentHeaders: [34, 36, 36],
    cases: results
  };
  Logger.log(JSON.stringify(report, null, 2));
  careIdentityTestAssert_(report.result === 'PASS', 'One or more harness cases failed; see report log.');
  return report;
}

function careIdentitySyntheticCleanup() {
  careIdentityTestAssertSafeTarget_();
  var ss = SpreadsheetApp.openById(CARE_ID_TEST_CONFIG_.spreadsheetId);
  [CARE_ID_TEST_CONFIG_.bookingSheet, CARE_ID_TEST_CONFIG_.careSheet].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet && name.indexOf(CARE_ID_TEST_PREFIX_) === 0) ss.deleteSheet(sheet);
  });
  Logger.log('Removed only generated fixture tabs with exact configured names. Control marker tab was retained.');
}

function careIdentityTestAssertSafeTarget_() {
  var c = CARE_ID_TEST_CONFIG_;
  careIdentityTestAssert_(c.spreadsheetId.indexOf('REPLACE_') !== 0 && c.scriptId.indexOf('REPLACE_') !== 0, 'Configure the dedicated synthetic spreadsheet and standalone test project IDs.');
  careIdentityTestAssert_(c.productionSpreadsheetIds.length > 0 && c.productionSpreadsheetIds.every(function(id) { return id && id.indexOf('REPLACE_') !== 0; }), 'Configure the production spreadsheet denylist before running.');
  careIdentityTestAssert_(c.productionSpreadsheetIds.indexOf(c.spreadsheetId) < 0, 'Refusing a spreadsheet ID on the production denylist.');
  careIdentityTestEqual_(ScriptApp.getScriptId(), c.scriptId);
  var ss = SpreadsheetApp.openById(c.spreadsheetId);
  careIdentityTestEqual_(ss.getId(), c.spreadsheetId);
  var marker = ss.getSheetByName(c.markerSheet);
  careIdentityTestAssert_(marker && marker.getRange(c.markerCell).getDisplayValue() === c.markerValue, 'Synthetic-only spreadsheet marker missing or incorrect.');
  careIdentityTestAssert_(ss.getSheetByName('Pet_Belongings') === null, 'Refusing a spreadsheet containing the production Care tab name.');
  var allowedTabs = [c.markerSheet, c.bookingSheet, c.careSheet];
  ss.getSheets().forEach(function(sheet) {
    careIdentityTestAssert_(allowedTabs.indexOf(sheet.getName()) >= 0, 'Refusing unexpected spreadsheet tab: ' + sheet.getName());
  });
}

function careIdentityTestPrepareSheets_(ss) {
  [CARE_ID_TEST_CONFIG_.bookingSheet, CARE_ID_TEST_CONFIG_.careSheet].forEach(function(name) {
    var prior = ss.getSheetByName(name);
    if (prior) ss.deleteSheet(prior);
  });
  ss.insertSheet(CARE_ID_TEST_CONFIG_.bookingSheet);
  ss.insertSheet(CARE_ID_TEST_CONFIG_.careSheet);
}

function careIdentityTestSeed_(booking, care) {
  booking.clear(); care.clear();
  if (care.getMaxColumns() < 34) care.insertColumnsAfter(care.getMaxColumns(), 34 - care.getMaxColumns());
  var base = getBelongingsHeaders_();
  care.getRange(1, 1, 1, 34).setValues([base]);
  var careRow = Array(34).fill('');
  careRow[0] = 'synthetic'; careRow[1] = careIdentityTestKey_('Milo','2026-10-01','2026-10-03'); careRow[2] = 'Synthetic Milo'; careRow[5] = 'synthetic-care-value';
  care.getRange(2, 1, 1, 34).setValues([careRow]);
  var heads = ['Timestamp','Dog Name','Breed','Start Date','End Date','Owner','Phone','x','x','Notes','x','Type','Dog ID','Stay ID'];
  var rows = [heads,
    ['', 'Milo', '', '2026-10-01', '2026-10-03', '', '', '', '', '', '', '', CARE_ID_TEST_DOG_, CARE_ID_TEST_UUID_A_],
    ['', 'Milo', '', '2026-10-05', '2026-10-07', '', '', '', '', '', '', '', CARE_ID_TEST_DOG_, CARE_ID_TEST_UUID_B_],
    ['', 'Twin', '', '2026-10-09', '2026-10-11', '', '', '', '', '', '', '', CARE_ID_TEST_DOG_, '00000000-0000-4000-8000-000000000003'],
    ['', 'Twin', '', '2026-10-09', '2026-10-11', '', '', '', '', '', '', '', CARE_ID_TEST_DOG_OTHER_, '00000000-0000-4000-8000-000000000004']
  ];
  booking.getRange(1, 1, rows.length, heads.length).setValues(rows);
}

function careIdentityTestBookingRows_(sheet) { return sheet.getDataRange().getValues(); }
function careIdentityTestKey_(name, start, end) { return [String(name).trim().toLowerCase(), start, end || start].join('|'); }
function careIdentityTestAppendCareRow_(sheet, key) { var row = Array(sheet.getLastColumn()).fill(''); row[1] = key; sheet.appendRow(row); }
function careIdentityTestSnapshot_(sheets) { return sheets.map(function(s) { return { name:s.getName(), values:s.getDataRange().getValues(), formulas:s.getDataRange().getFormulas() }; }); }
function careIdentityTestSetWriteFlag_(enabled) { PropertiesService.getScriptProperties().setProperty('CARE_RECORD_IDENTITY_WRITES_ENABLED', enabled ? 'true' : 'false'); }
function careIdentityTestRun_(results, name, fn) { try { fn(); results.push({ name:name, ok:true }); } catch (e) { results.push({ name:name, ok:false, error:String(e && e.message || e) }); } }
function careIdentityTestAssert_(condition, message) { if (!condition) throw new Error(message); }
function careIdentityTestEqual_(actual, expected) { careIdentityTestAssert_(actual === expected, 'Expected ' + expected + ', got ' + actual); }
function careIdentityTestThrows_(fn, message) { var threw = false; try { fn(); } catch (e) { threw = true; } careIdentityTestAssert_(threw, message); }

/* Minimal test-project bindings used by the actual identity module. */
var BELONGINGS_ITEM_CONFIG_ = [
  { label:'Water Bowls' }, { label:'Food Bowls' }, { label:'Blankets' }, { label:'Beds' },
  { label:'Pet Crates' }, { label:'Toys' }, { label:'Leads / Harnesses' }, { label:'Medication' }, { label:'Other' }
];
var BELONGINGS_RISK_CONFIG_ = [
  { label:'Escape Risk' }, { label:'Food Allergy' }, { label:'Medicated' },
  { label:'Separation Anxiety' }, { label:'Weight Management' }
];
function getBelongingsHeaders_() {
  var headers = ['Updated At','Stay Key','Dog Name','Start Date','End Date'];
  BELONGINGS_ITEM_CONFIG_.forEach(function(item) { headers.push(item.label, item.label + ' Description'); });
  headers.push('Photos JSON');
  BELONGINGS_RISK_CONFIG_.forEach(function(flag) { headers.push(flag.label); });
  headers.push('Dog Photo JSON','Intake Attributes JSON','Intake Attributes Source','Dog Photo Gallery JSON','Stay Photos JSON');
  return headers;
}
function getTargetSheet_() { return SpreadsheetApp.openById(CARE_ID_TEST_CONFIG_.spreadsheetId).getSheetByName(CARE_ID_TEST_CONFIG_.bookingSheet); }
function makeGuestStayKey_(name, start, end) {
  return careIdentityTestKey_(name, careIdentityTestNormalizeDate_(start), careIdentityTestNormalizeDate_(end || start));
}
function careIdentityTestNormalizeDate_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var text = String(value).trim();
  if (!text) return '';
  var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  var au = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (au) return au[3] + '-' + ('0' + au[2]).slice(-2) + '-' + ('0' + au[1]).slice(-2);
  var parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return text;
}
function validStayIdV11225_(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim()); }
function findBelongingsRow_(sheet, key) { var rows = sheet.getDataRange().getValues(); for (var i=1;i<rows.length;i++) if (String(rows[i][1] || '').trim() === key) return i+1; return -1; }

/* Exact test-project copy of apps-script/Code.js migration helper. */
function migrateBelongingsIdentityForGuest_(
  spreadsheet,
  oldStayKey,
  newStayKey,
  newDogName,
  provenStayId
) {
  if (!spreadsheet || !oldStayKey || !newStayKey) return false;

  var properties = PropertiesService.getScriptProperties();
  var belongingsSheetName = String(
    properties.getProperty("BELONGINGS_SHEET_NAME") || "Pet_Belongings"
  ).trim();

  // Do not create a belongings sheet merely because a guest name was edited.
  var belongingsSheet = spreadsheet.getSheetByName(belongingsSheetName);
  if (!belongingsSheet || belongingsSheet.getLastRow() < 2) return false;

  var row = findBelongingsRow_(belongingsSheet, oldStayKey);
  if (row === -1) return false;

  var identityState = readCareRecordIdentityState_(belongingsSheet);
  var oldMatches = identityState.ok ? (identityState.byKey[oldStayKey] || []) : [];
  var bookingRows = getTargetSheet_().getDataRange().getValues();
  var bookingProof = resolveCareBookingIdentity_(newStayKey, String(provenStayId || ""), "", bookingRows);
  var oldBookings = resolveCareBookingIdentities_([oldStayKey], bookingRows)[oldStayKey];
  // The validated mutation supplies the stable ID captured from the exact
  // booking row before its key changed. This preserves 34-column legacy Care
  // rows while requiring the destination booking to match that same ID.
  if (!provenStayId || !bookingProof.ok || !oldBookings || oldBookings.reason !== "no-booking-proves-stay-key" || oldMatches.length !== 1 || !oldMatches[0].valid ||
      (oldMatches[0].stayId && oldMatches[0].stayId !== bookingProof.identity.stayId) ||
      (oldMatches[0].dogId && oldMatches[0].dogId !== bookingProof.identity.dogId) ||
      (identityState.byKey[newStayKey] || []).length) return false;

  belongingsSheet.getRange(row, 1).setValue(new Date());
  belongingsSheet.getRange(row, 2).setValue(newStayKey);
  belongingsSheet.getRange(row, 3).setValue(String(newDogName || "").trim());

  return true;
}
