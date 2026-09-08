/* ============================================================
 * WAFFLE HOUSE V11.2.12 — MASTER PROFILE PHOTO SYNC
 * ------------------------------------------------------------
 * Keeps the stay/master photo lifecycle in sync while repairing the case
 * where the newest stay is photo-empty but an older matching stay has a
 * valid profile photo:
 *   1) run the existing V11 master save once;
 *   2) if that save still has no master photo, recover the newest
 *      photo-bearing stay for the same dog and patch only the master photo
 *      columns (no second full master-save pass);
 *   3) seed the selected/upcoming stay only when it is photo-empty;
 *   4) preserve any stay-specific photo that already exists.
 *
 * The same Google Drive photo references are reused; no duplicate image is
 * created. This fixes the V11.2.11 logic hole where base master derivation
 * selected the newest matching stay even when that stay had no photo.
 * ============================================================ */

var MASTER_PROFILE_PHOTO_SYNC_VERSION_V11208_ = '11.2.12';
var waffleSaveDogMasterProfileBaseV11208_ = saveDogMasterProfile_;

function dogMasterPhotoCandidateV11208_(record) {
  record = record && typeof record === 'object' ? record : null;
  if (!record) return null;

  if (record.dogPhoto && typeof record.dogPhoto === 'object') {
    return record.dogPhoto;
  }

  var gallery = Array.isArray(record.dogPhotoGallery)
    ? record.dogPhotoGallery.filter(function(photo) {
        return photo && typeof photo === 'object';
      })
    : [];

  return gallery.length ? gallery[gallery.length - 1] : null;
}

function persistedMasterPhotoCandidateV11208_(master) {
  master = master && typeof master === 'object' ? master : null;
  if (!master) return null;

  var primary = parseDogPhotoJson_(master.primaryPhoto);
  if (primary) return primary;

  var gallery = Array.isArray(master.photoGallery)
    ? master.photoGallery
        .map(function(photo) {
          return parseDogPhotoJson_(photo);
        })
        .filter(function(photo) {
          return !!photo;
        })
    : [];

  return gallery.length ? gallery[gallery.length - 1] : null;
}

function seedDogStayPhotoFromMasterV11208_(data, persistedMaster) {
  data = data && typeof data === 'object' ? data : {};
  persistedMaster = persistedMaster && typeof persistedMaster === 'object'
    ? persistedMaster
    : null;

  var stayKey = String(data.stayKey || '').trim();
  var primary = persistedMasterPhotoCandidateV11208_(persistedMaster);

  if (!stayKey || !primary) {
    return {
      applied: false,
      reason: !stayKey ? 'missing-stay-key' : 'master-photo-missing'
    };
  }

  var sheet = getBelongingsSheet_();
  var row = findBelongingsRow_(sheet, stayKey);

  if (row === -1) {
    row = upsertBelongingsRecord_(sheet, {
      stayKey: stayKey,
      dogName: String(data.dogName || persistedMaster.dogName || '').trim(),
      startDate: data.startDate,
      endDate: data.endDate
    });
  }

  if (row === -1 || !row) {
    return {
      applied: false,
      reason: 'stay-row-unavailable'
    };
  }

  var existingPrimary = parseDogPhotoJson_(sheet.getRange(row, 30).getValue());
  if (existingPrimary) {
    return {
      applied: false,
      reason: 'stay-photo-present',
      primaryPhoto: existingPrimary
    };
  }

  var existingGallery = parseV108DogPhotoGalleryJson_(
    sheet.getRange(row, 33).getValue()
  );
  var masterGallery = Array.isArray(persistedMaster.photoGallery)
    ? persistedMaster.photoGallery
    : [];
  var gallery = normalizeV108DogPhotoGallery_(
    existingGallery.concat(masterGallery),
    primary
  );

  /* Pet_Belongings columns 30/33 are primary dog photo / gallery JSON. */
  sheet.getRange(row, 30).setValue(JSON.stringify(primary));
  sheet.getRange(row, 33).setValue(JSON.stringify(gallery));
  sheet.getRange(row, 1).setValue(new Date());

  touchWaffleDataVersion_('directory');

  return {
    applied: true,
    reason: 'master-photo-applied',
    primaryPhoto: primary,
    photoGallery: gallery
  };
}

function resolveDogMasterPhotoSourceV11208_(data) {
  data = data && typeof data === 'object' ? data : {};

  var supplied = data.primaryPhoto && typeof data.primaryPhoto === 'object'
    ? data.primaryPhoto
    : null;

  if (supplied) {
    return {
      stayKey: String(data.stayKey || '').trim(),
      dogPhoto: supplied,
      dogPhotoGallery: Array.isArray(data.photoGallery) ? data.photoGallery : []
    };
  }

  var stayKey = String(data.stayKey || '').trim();
  var dogName = String(data.dogName || '').trim();
  var dogIdentity = normalizeDogMasterIdentity_(dogName);
  var records = readBelongingsRecords_(getBelongingsSheet_(), []);

  var exact = stayKey
    ? records.filter(function(record) {
        return String(record.stayKey || '').trim() === stayKey;
      })[0] || null
    : null;

  if (dogMasterPhotoCandidateV11208_(exact)) return exact;

  /*
   * Deliberately filter to photo-bearing records before sorting. The base V11
   * derivation sorts all matching stays first and therefore selects a newer
   * empty upcoming stay over an older stay that actually has Coco's photo.
   */
  var candidates = records
    .filter(function(record) {
      return dogIdentity &&
        normalizeDogMasterIdentity_(record.dogName) === dogIdentity &&
        !!dogMasterPhotoCandidateV11208_(record);
    })
    .sort(function(a, b) {
      var left = String(a.updatedAt || a.endDate || a.startDate || '');
      var right = String(b.updatedAt || b.endDate || b.startDate || '');
      return right.localeCompare(left);
    });

  return candidates.length ? candidates[0] : exact;
}

/*
 * Lightweight recovery used only when the base master save still returns no
 * photo. It patches the two Dog_Master photo columns in place instead of
 * running saveDogMasterProfile_ a second time, preserving the timeout fix.
 */
function recoverMissingDogMasterPhotoV11208_(data, savedMaster) {
  data = data && typeof data === 'object' ? data : {};
  savedMaster = savedMaster && typeof savedMaster === 'object'
    ? savedMaster
    : {};

  if (persistedMasterPhotoCandidateV11208_(savedMaster)) {
    return {
      master: savedMaster,
      applied: false,
      reason: 'master-photo-present',
      sourceStayKey: String(savedMaster.photoSourceStayKey || '').trim()
    };
  }

  var source = resolveDogMasterPhotoSourceV11208_(data);
  var primary = dogMasterPhotoCandidateV11208_(source);

  if (!primary) {
    return {
      master: savedMaster,
      applied: false,
      reason: 'no-photo-bearing-stay',
      sourceStayKey: ''
    };
  }

  var gallery = normalizeV108DogPhotoGallery_(
    source && Array.isArray(source.dogPhotoGallery)
      ? source.dogPhotoGallery
      : [],
    primary
  );

  var dogName = String(savedMaster.dogName || data.dogName || '').trim();
  var breed = String(savedMaster.breed || data.breed || '').trim();
  var masterKey = String(
    savedMaster.masterKey || makeDogMasterKey_(dogName, breed)
  ).trim();

  var sheet = getDogMasterSheet_();
  var row = findDogMasterRow_(sheet, masterKey);

  if (row === -1 || !row) {
    return {
      master: savedMaster,
      applied: false,
      reason: 'master-row-unavailable',
      sourceStayKey: String((source && source.stayKey) || '').trim()
    };
  }

  /* Dog_Master columns 10/11 are Primary Photo JSON / Photo Gallery JSON. */
  sheet.getRange(row, 10).setValue(JSON.stringify(primary));
  sheet.getRange(row, 11).setValue(JSON.stringify(gallery));
  sheet.getRange(row, 1).setValue(new Date());
  touchWaffleDataVersion_('directory');

  var sourceStayKey = String((source && source.stayKey) || '').trim();
  savedMaster.primaryPhoto = primary;
  savedMaster.photoGallery = gallery;
  savedMaster.photoSourceStayKey = sourceStayKey;

  return {
    master: savedMaster,
    applied: true,
    reason: 'photo-bearing-stay-recovered',
    sourceStayKey: sourceStayKey,
    primaryPhoto: primary,
    photoGallery: gallery
  };
}

/*
 * Retained for backwards-compatible diagnostics/manual repair only. Normal
 * saves use recoverMissingDogMasterPhotoV11208_ so they do not pay for a full
 * post-write master reload.
 */
function syncDogMasterPhotoFromStayV11208_(data, savedMaster) {
  var source = resolveDogMasterPhotoSourceV11208_(data);
  var primary = dogMasterPhotoCandidateV11208_(source);

  if (!primary) return savedMaster;

  var gallery = normalizeV108DogPhotoGallery_(
    source && Array.isArray(source.dogPhotoGallery)
      ? source.dogPhotoGallery
      : [],
    primary
  );

  var dogName = String(
    (savedMaster && savedMaster.dogName) ||
    (data && data.dogName) ||
    ''
  ).trim();

  var breed = String(
    (savedMaster && savedMaster.breed) ||
    (data && data.breed) ||
    ''
  ).trim();

  var masterKey = String(
    (savedMaster && savedMaster.masterKey) ||
    makeDogMasterKey_(dogName, breed)
  ).trim();

  var sheet = getDogMasterSheet_();
  var row = findDogMasterRow_(sheet, masterKey);
  if (row === -1) return savedMaster;

  /* Columns 10/11 are Primary Photo JSON / Photo Gallery JSON. */
  sheet.getRange(row, 10).setValue(JSON.stringify(primary));
  sheet.getRange(row, 11).setValue(JSON.stringify(gallery));
  sheet.getRange(row, 1).setValue(new Date());

  touchWaffleDataVersion_('directory');

  logAuditEvent_({
    category: 'Care',
    action: 'Master Dog Photo Synced',
    dogName: dogName,
    bookingType: 'Dog Master',
    reference: masterKey,
    summary: 'The profile photo from the stay was synced to the master profile for ' + dogName + '.',
    changedFields: ['Master Profile Photo', 'Master Profile Photo Gallery'],
    after: {
      masterKey: masterKey,
      sourceStayKey: String((source && source.stayKey) || (data && data.stayKey) || '').trim(),
      photoId: String(primary.id || ''),
      galleryCount: gallery.length
    },
    source: 'Web App'
  });

  var refreshed = getDogMasterProfile_({
    masterKey: masterKey,
    dogName: dogName,
    breed: breed
  });

  if (refreshed && typeof refreshed === 'object') {
    refreshed.photoSyncVersion = MASTER_PROFILE_PHOTO_SYNC_VERSION_V11208_;
    refreshed.photoSourceStayKey = String(
      (source && source.stayKey) ||
      (data && data.stayKey) ||
      ''
    ).trim();
  }

  return refreshed || savedMaster;
}

/*
 * Wrap the existing master-save function rather than replacing its profile,
 * risk-flag, owner/contact, history or audit behavior.
 *
 * The base V11 save runs once. If its chosen newest stay is photo-empty, the
 * recovery step explicitly finds the newest matching photo-bearing stay and
 * patches only the Dog_Master photo fields. The selected/upcoming stay then
 * inherits that recovered photo only when it is still empty.
 */
saveDogMasterProfile_ = function(data) {
  data = data && typeof data === 'object' ? data : {};

  var savedMaster = waffleSaveDogMasterProfileBaseV11208_(data);
  var recovery = recoverMissingDogMasterPhotoV11208_(data, savedMaster);
  savedMaster = recovery && recovery.master ? recovery.master : savedMaster;

  var stayPhotoSync = seedDogStayPhotoFromMasterV11208_(data, savedMaster);

  if (savedMaster && typeof savedMaster === 'object') {
    savedMaster.masterPhotoRecovery = {
      applied: !!(recovery && recovery.applied),
      reason: String((recovery && recovery.reason) || ''),
      sourceStayKey: String((recovery && recovery.sourceStayKey) || '')
    };
    savedMaster.stayPhotoSync = stayPhotoSync;
    savedMaster.photoSyncVersion = MASTER_PROFILE_PHOTO_SYNC_VERSION_V11208_;
    savedMaster.photoSourceStayKey = String(
      (recovery && recovery.sourceStayKey) ||
      savedMaster.photoSourceStayKey ||
      data.stayKey ||
      ''
    ).trim();
  }

  return savedMaster;
};

function getMasterProfilePhotoSyncHealthV11208() {
  return {
    result: 'success',
    version: MASTER_PROFILE_PHOTO_SYNC_VERSION_V11208_,
    behavior: 'single-save-recover-photo-bearing-stay-then-seed-empty-stay',
    preservesExistingStayPhoto: true,
    recoversOlderPhotoBearingStay: true,
    avoidsSecondFullMasterSave: true,
    duplicatesDriveFile: false
  };
}
