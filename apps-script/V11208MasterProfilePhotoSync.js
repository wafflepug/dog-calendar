/* ============================================================
 * WAFFLE HOUSE V11.2.08 — MASTER PROFILE PHOTO SYNC
 * ------------------------------------------------------------
 * Guarantees that "Sync This Stay to Master Profile" carries the dog's
 * profile photo as well as the profile/care data.
 *
 * The existing V11 master save remains authoritative. This layer verifies the
 * source photo after that save and repairs the Master row when necessary. The
 * same Google Drive photo reference is reused; no duplicate image is created.
 * ============================================================ */

var MASTER_PROFILE_PHOTO_SYNC_VERSION_V11208_ = '11.2.08';
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
 */
saveDogMasterProfile_ = function(data) {
  var savedMaster = waffleSaveDogMasterProfileBaseV11208_(data);
  return syncDogMasterPhotoFromStayV11208_(data, savedMaster);
};

function getMasterProfilePhotoSyncHealthV11208() {
  return {
    result: 'success',
    version: MASTER_PROFILE_PHOTO_SYNC_VERSION_V11208_,
    behavior: 'stay-profile-photo-to-master',
    duplicatesDriveFile: false
  };
}
