/* ============================================================
 * WAFFLE HOUSE V11.2.15 — MASTER PHOTO -> UPCOMING STAYS
 * ------------------------------------------------------------
 * Makes the persisted Dog Master photo the automatic photo source for
 * matching upcoming stays when those stays do not already have a usable
 * stay-specific photo.
 *
 * Matching uses the canonical Dog Master identity (dog name + breed).
 * Stay discovery uses the same Form_Responses schema and generated stay key
 * as the live Guest Directory. Existing usable stay photos always win.
 * Google Drive references are reused; no image file is copied or duplicated.
 * ============================================================ */

var MASTER_UPCOMING_PHOTO_AUTO_SYNC_VERSION_V11214_ = '11.2.15';
var waffleProcessSheetActionBaseV11214_ = processSheetAction_;
var waffleSaveDogMasterProfileBaseV11214_ = saveDogMasterProfile_;

function getBoardingSheetV11214_() {
  var properties = PropertiesService.getScriptProperties();
  var configuredGid = String(
    properties.getProperty('BOARDING_SHEET_GID') || '1639615540'
  ).trim();
  var configuredName = String(
    properties.getProperty('BOARDING_SHEET_NAME') || ''
  ).trim();
  var spreadsheet = getWaffleSpreadsheet_();
  var sheet = null;

  if (configuredGid && /^\d+$/.test(configuredGid)) {
    sheet = spreadsheet.getSheetById(Number(configuredGid));
  }
  if (!sheet && configuredName) {
    sheet = spreadsheet.getSheetByName(configuredName);
  }
  if (!sheet) {
    sheet = spreadsheet.getSheetByName('Form_Responses');
  }
  if (!sheet) {
    throw new Error('Could not find the boarding worksheet for automatic Master Profile photo sync.');
  }
  return sheet;
}

function todayKeyV11214_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}

function isUpcomingMasterPhotoStayV11214_(startDate, bookingType) {
  var type = String(bookingType || '').trim().toLowerCase();
  if (
    type === 'potential' ||
    type === 'potential stay' ||
    type === 'meet & greet' ||
    type === 'meet and greet'
  ) {
    return false;
  }

  var startKey = normalizeDateValue_(startDate);
  return !!startKey && startKey >= todayKeyV11214_();
}

function normalizeMasterKeyFilterV11214_(data) {
  data = data && typeof data === 'object' ? data : {};
  var result = {};
  var keys = Array.isArray(data.masterKeys) ? data.masterKeys : [];

  keys.forEach(function(key) {
    key = String(key || '').trim();
    if (key) result[key] = true;
  });

  if (!keys.length && String(data.masterKey || '').trim()) {
    result[String(data.masterKey).trim()] = true;
  }

  return result;
}

function hasMasterKeyFilterV11214_(filter) {
  return filter && Object.keys(filter).length > 0;
}

function writeMasterPhotoToUpcomingStayV11214_(stay, master, belongingsSheet) {
  var stayKey = String(stay.stayKey || '').trim();
  var primary = persistedMasterPhotoCandidateV11208_(master);

  if (!stayKey || !primary) {
    return {
      updated: false,
      reason: !stayKey ? 'missing-stay-key' : 'master-photo-missing'
    };
  }

  var row = findBelongingsRow_(belongingsSheet, stayKey);
  if (row === -1) {
    row = upsertBelongingsRecord_(belongingsSheet, {
      stayKey: stayKey,
      dogName: String(stay.dogName || master.dogName || '').trim(),
      startDate: stay.startDate,
      endDate: stay.endDate
    });
  }

  if (row === -1 || !row) {
    return { updated: false, reason: 'stay-row-unavailable' };
  }

  var existingPrimary = usableDogPhotoV11208_(
    parseDogPhotoJson_(belongingsSheet.getRange(row, 30).getValue())
  );
  if (existingPrimary) {
    return {
      updated: false,
      reason: 'stay-photo-present',
      primaryPhoto: existingPrimary
    };
  }

  var existingGallery = usableDogPhotoGalleryV11208_(
    parseV108DogPhotoGalleryJson_(belongingsSheet.getRange(row, 33).getValue())
  );
  var masterGallery = usableDogPhotoGalleryV11208_(master.photoGallery);
  var gallery = normalizeV108DogPhotoGallery_(
    existingGallery.concat(masterGallery),
    primary
  );

  /* Pet_Belongings columns 30/33 = primary dog photo / gallery JSON. */
  belongingsSheet.getRange(row, 30).setValue(JSON.stringify(primary));
  belongingsSheet.getRange(row, 33).setValue(JSON.stringify(gallery));
  belongingsSheet.getRange(row, 1).setValue(new Date());

  return {
    updated: true,
    reason: 'master-photo-inherited',
    primaryPhoto: primary,
    photoGallery: gallery
  };
}

function syncDogMasterPhotosToUpcomingStaysV11214_(data) {
  data = data && typeof data === 'object' ? data : {};

  var boardingSheet = getBoardingSheetV11214_();
  var lastRow = boardingSheet.getLastRow();
  var masterFilter = normalizeMasterKeyFilterV11214_(data);
  var filterEnabled = hasMasterKeyFilterV11214_(masterFilter);

  if (lastRow < 2) {
    return {
      result: 'success',
      version: MASTER_UPCOMING_PHOTO_AUTO_SYNC_VERSION_V11214_,
      updatedCount: 0,
      updatedStayKeys: [],
      updates: []
    };
  }

  /*
   * Keep this aligned with getGuestDirectoryPayload_ in Code.js:
   * Form_Responses columns 2 dog name, 3 breed, 4 start, 5 end,
   * and 12 booking type. A stay key is generated from dog name + dates;
   * there is no authoritative stored stay-key column on Form_Responses.
   */
  var rows = boardingSheet.getRange(2, 1, lastRow - 1, 12).getValues();
  var stays = [];

  rows.forEach(function(row) {
    var dogName = String(row[1] || '').trim();
    var breed = String(row[2] || '').trim();
    var startDate = normalizeDateValue_(row[3]);
    var endDate = normalizeDateValue_(row[4] || row[3]);
    var bookingType = String(row[11] || 'Boarding').trim();

    if (!dogName || !startDate || !endDate) return;
    if (!isUpcomingMasterPhotoStayV11214_(startDate, bookingType)) return;

    var stayKey = makeGuestStayKey_(dogName, startDate, endDate);
    if (!stayKey) return;

    var masterKey = makeDogMasterKey_(dogName, breed);
    if (filterEnabled && !masterFilter[masterKey]) return;

    stays.push({
      stayKey: stayKey,
      dogName: dogName,
      breed: breed,
      masterKey: masterKey,
      startDate: startDate,
      endDate: endDate
    });
  });

  var masterCache = {};
  var belongingsSheet = getBelongingsSheet_();
  var updates = [];
  var skippedExistingCount = 0;
  var missingMasterPhotoCount = 0;
  var matchedMasterKeys = {};

  stays.forEach(function(stay) {
    var masterKey = stay.masterKey;

    if (!Object.prototype.hasOwnProperty.call(masterCache, masterKey)) {
      masterCache[masterKey] = readPersistedDogMaster_(masterKey) || null;
    }

    var master = masterCache[masterKey];
    var masterPhoto = persistedMasterPhotoCandidateV11208_(master);
    if (!master || !masterPhoto) {
      missingMasterPhotoCount += 1;
      return;
    }

    matchedMasterKeys[masterKey] = true;
    var outcome = writeMasterPhotoToUpcomingStayV11214_(
      stay,
      master,
      belongingsSheet
    );

    if (outcome.reason === 'stay-photo-present') {
      skippedExistingCount += 1;
      return;
    }
    if (!outcome.updated) return;

    updates.push({
      stayKey: stay.stayKey,
      dogName: stay.dogName,
      breed: stay.breed,
      masterKey: masterKey,
      startDate: stay.startDate,
      primaryPhoto: outcome.primaryPhoto
    });
  });

  if (updates.length) {
    touchWaffleDataVersion_('directory');
  }

  return {
    result: 'success',
    version: MASTER_UPCOMING_PHOTO_AUTO_SYNC_VERSION_V11214_,
    behavior: 'master-photo-auto-inherits-to-photo-empty-upcoming-stays',
    stayKeySource: 'makeGuestStayKey_(dogName,startDate,endDate)',
    boardingSchema: 'guest-directory-canonical',
    eligibleStayCount: stays.length,
    updatedCount: updates.length,
    skippedExistingCount: skippedExistingCount,
    missingMasterPhotoCount: missingMasterPhotoCount,
    matchedMasterCount: Object.keys(matchedMasterKeys).length,
    updatedStayKeys: updates.map(function(update) { return update.stayKey; }),
    updates: updates
  };
}

/* Dedicated mutation action used by the Care directory auto-sync client. */
processSheetAction_ = function(data) {
  var action = String(data && data.action || '').trim();
  if (action === 'sync_dog_master_photos_to_upcoming_stays') {
    return syncDogMasterPhotosToUpcomingStaysV11214_(data);
  }
  return waffleProcessSheetActionBaseV11214_(data);
};

/*
 * A newly saved Master Profile photo is also propagated immediately to every
 * matching upcoming photo-empty stay for that dog, without waiting for a page
 * reload or another manual sync click.
 */
saveDogMasterProfile_ = function(data) {
  data = data && typeof data === 'object' ? data : {};
  var savedMaster = waffleSaveDogMasterProfileBaseV11214_(data);

  if (savedMaster && typeof savedMaster === 'object') {
    var masterKey = String(
      savedMaster.masterKey ||
      makeDogMasterKey_(savedMaster.dogName || data.dogName, savedMaster.breed || data.breed)
    ).trim();

    savedMaster.upcomingPhotoAutoSync = syncDogMasterPhotosToUpcomingStaysV11214_({
      masterKeys: masterKey ? [masterKey] : [],
      source: 'master-save'
    });
    savedMaster.photoSyncVersion = MASTER_UPCOMING_PHOTO_AUTO_SYNC_VERSION_V11214_;
  }

  return savedMaster;
};

function getMasterUpcomingPhotoAutoSyncHealthV11214() {
  return {
    result: 'success',
    version: MASTER_UPCOMING_PHOTO_AUTO_SYNC_VERSION_V11214_,
    matchIdentity: 'dog-name-and-breed',
    stayKeySource: 'makeGuestStayKey_(dogName,startDate,endDate)',
    boardingSchema: 'guest-directory-canonical',
    upcomingOnly: true,
    sameDayIncluded: true,
    preservesExistingStayPhoto: true,
    duplicatesDriveFile: false,
    automaticOnDirectoryLoad: true,
    automaticAfterMasterSave: true
  };
}
