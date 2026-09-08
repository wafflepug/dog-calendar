/* ============================================================
 * WAFFLE HOUSE V11.2.11 — MASTER PROFILE PHOTO SYNC
 * ------------------------------------------------------------
 * Keeps the stay/master photo lifecycle in sync without adding a second
 * expensive post-save master pass:
 *   1) the existing V11 master save first resolves/persists the canonical
 *      master photo, including a photo derived from another matching stay;
 *   2) a photo-empty selected/upcoming stay then inherits that saved master
 *      photo immediately;
 *   3) a stay-specific photo still wins and is never overwritten.
 *
 * The same Google Drive photo references are reused; no duplicate image is
 * created. This order fixes the V11.2.10 edge case where a master photo was
 * established only after the empty stay had already tried to inherit it.
 * ============================================================ */

var MASTER_PROFILE_PHOTO_SYNC_VERSION_V11208_ = '11.2.11';
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

/*
 * Retained for backwards-compatible diagnostics/manual repair only.
 * The normal save path no longer calls this function: the base V11 save
 * already reads the exact stay record and persists its primary/gallery photo.
 */
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
 * The base V11 save runs first so it can resolve and persist the canonical
 * master photo, including a photo derived from another matching stay when the
 * selected/upcoming stay is empty. We then seed only that photo-empty selected
 * stay from the just-saved master. Existing stay-specific photos are preserved.
 *
 * This remains a single master-save pass: unlike V11.2.09 it does not perform
 * a second full belongings scan, master write, audit and reload, so the timeout
 * fix introduced in V11.2.10 is preserved.
 */
saveDogMasterProfile_ = function(data) {
  data = data && typeof data === 'object' ? data : {};

  var savedMaster = waffleSaveDogMasterProfileBaseV11208_(data);
  var stayPhotoSync = seedDogStayPhotoFromMasterV11208_(data, savedMaster);

  if (savedMaster && typeof savedMaster === 'object') {
    savedMaster.stayPhotoSync = stayPhotoSync;
    savedMaster.photoSyncVersion = MASTER_PROFILE_PHOTO_SYNC_VERSION_V11208_;
    savedMaster.photoSourceStayKey = String(data.stayKey || '').trim();
  }

  return savedMaster;
};

function getMasterProfilePhotoSyncHealthV11208() {
  return {
    result: 'success',
    version: MASTER_PROFILE_PHOTO_SYNC_VERSION_V11208_,
    behavior: 'single-pass-save-master-then-seed-empty-stay',
    preservesExistingStayPhoto: true,
    avoidsRedundantPostSaveResync: true,
    duplicatesDriveFile: false
  };
}
