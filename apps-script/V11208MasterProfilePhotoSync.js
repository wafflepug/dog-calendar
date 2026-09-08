/* ============================================================
 * WAFFLE HOUSE V11.2.13 — MASTER PROFILE PHOTO SYNC
 * ------------------------------------------------------------
 * Keeps the stay/master photo lifecycle in sync while repairing the case
 * where stored photo JSON exists but does not contain a usable image URL.
 *
 * A photo now counts as present only when it can actually be rendered by the
 * web UI. Legacy records that contain only a Google Drive file id are repaired
 * in memory with a Drive thumbnail URL, and stale/empty placeholder objects no
 * longer prevent recovery from an older photo-bearing stay.
 *
 * The same Google Drive photo references are reused; no duplicate image is
 * created.
 * ============================================================ */

var MASTER_PROFILE_PHOTO_SYNC_VERSION_V11208_ = '11.2.13';
var waffleSaveDogMasterProfileBaseV11208_ = saveDogMasterProfile_;

function extractDogPhotoDriveIdV11208_(photo) {
  photo = photo && typeof photo === 'object' ? photo : null;
  if (!photo) return '';

  var direct = String(
    photo.id || photo.fileId || photo.driveFileId || photo.driveId || ''
  ).trim();
  if (direct) return direct;

  var urls = [photo.previewUrl, photo.url, photo.driveUrl];
  for (var i = 0; i < urls.length; i++) {
    var value = String(urls[i] || '').trim();
    if (!value) continue;

    var byPath = value.match(/\/d\/([A-Za-z0-9_-]+)/);
    if (byPath && byPath[1]) return byPath[1];

    var byQuery = value.match(/[?&]id=([A-Za-z0-9_-]+)/);
    if (byQuery && byQuery[1]) return byQuery[1];
  }

  return '';
}

function usableDogPhotoV11208_(photo) {
  var parsed = parseDogPhotoJson_(photo);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  var normalized = {};
  Object.keys(parsed).forEach(function(key) {
    normalized[key] = parsed[key];
  });

  var driveId = extractDogPhotoDriveIdV11208_(normalized);
  var existingUrl = String(
    normalized.previewUrl || normalized.url || normalized.driveUrl || ''
  ).trim();

  /*
   * Older Waffle records sometimes retained the Drive id but lost the
   * thumbnail URL. Reconstruct the exact kind of URL the current uploader
   * writes so the frontend has a renderable src without copying the file.
   */
  if (driveId) {
    normalized.id = String(normalized.id || driveId).trim();
    normalized.previewUrl =
      'https://drive.google.com/thumbnail?id=' +
      encodeURIComponent(driveId) +
      '&sz=w1600';
    normalized.photoReferenceRepaired = !String(parsed.previewUrl || '').trim();
    existingUrl = normalized.previewUrl;
  }

  return existingUrl ? normalized : null;
}

function usableDogPhotoGalleryV11208_(gallery) {
  return Array.isArray(gallery)
    ? gallery
        .map(function(photo) {
          return usableDogPhotoV11208_(photo);
        })
        .filter(function(photo) {
          return !!photo;
        })
    : [];
}

function dogMasterPhotoCandidateV11208_(record) {
  record = record && typeof record === 'object' ? record : null;
  if (!record) return null;

  var primary = usableDogPhotoV11208_(record.dogPhoto);
  if (primary) return primary;

  var gallery = usableDogPhotoGalleryV11208_(record.dogPhotoGallery);
  return gallery.length ? gallery[gallery.length - 1] : null;
}

function persistedMasterPhotoCandidateV11208_(master) {
  master = master && typeof master === 'object' ? master : null;
  if (!master) return null;

  var primary = usableDogPhotoV11208_(master.primaryPhoto);
  if (primary) return primary;

  var gallery = usableDogPhotoGalleryV11208_(master.photoGallery);
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

  var rawExistingPrimary = parseDogPhotoJson_(
    sheet.getRange(row, 30).getValue()
  );
  var existingPrimary = usableDogPhotoV11208_(rawExistingPrimary);
  if (existingPrimary) {
    return {
      applied: false,
      reason: 'stay-photo-present',
      primaryPhoto: existingPrimary
    };
  }

  var existingGallery = usableDogPhotoGalleryV11208_(
    parseV108DogPhotoGalleryJson_(sheet.getRange(row, 33).getValue())
  );
  var masterGallery = usableDogPhotoGalleryV11208_(
    persistedMaster.photoGallery
  );
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
    reason: rawExistingPrimary
      ? 'unusable-stay-photo-replaced'
      : 'master-photo-applied',
    primaryPhoto: primary,
    photoGallery: gallery
  };
}

function resolveDogMasterPhotoSourceV11208_(data) {
  data = data && typeof data === 'object' ? data : {};

  var supplied = usableDogPhotoV11208_(data.primaryPhoto);
  if (supplied) {
    return {
      stayKey: String(data.stayKey || '').trim(),
      dogPhoto: supplied,
      dogPhotoGallery: usableDogPhotoGalleryV11208_(data.photoGallery)
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
   * Filter to genuinely renderable photo-bearing records before sorting. A
   * stale JSON placeholder on a newer/upcoming stay must not outrank an older
   * stay that actually contains Coco's Drive image.
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
 * Lightweight recovery used only when the base master save still has no
 * usable photo. It patches the two Dog_Master photo columns in place instead
 * of running saveDogMasterProfile_ a second time, preserving the timeout fix.
 */
function recoverMissingDogMasterPhotoV11208_(data, savedMaster) {
  data = data && typeof data === 'object' ? data : {};
  savedMaster = savedMaster && typeof savedMaster === 'object'
    ? savedMaster
    : {};

  var existingMasterPhoto = persistedMasterPhotoCandidateV11208_(savedMaster);
  if (existingMasterPhoto) {
    /* Persist a reconstructed preview URL if this was a legacy id-only record. */
    if (existingMasterPhoto.photoReferenceRepaired) {
      var existingDogName = String(savedMaster.dogName || data.dogName || '').trim();
      var existingBreed = String(savedMaster.breed || data.breed || '').trim();
      var existingMasterKey = String(
        savedMaster.masterKey || makeDogMasterKey_(existingDogName, existingBreed)
      ).trim();
      var existingSheet = getDogMasterSheet_();
      var existingRow = findDogMasterRow_(existingSheet, existingMasterKey);
      if (existingRow !== -1 && existingRow) {
        var repairedGallery = normalizeV108DogPhotoGallery_(
          usableDogPhotoGalleryV11208_(savedMaster.photoGallery),
          existingMasterPhoto
        );
        existingSheet.getRange(existingRow, 10).setValue(JSON.stringify(existingMasterPhoto));
        existingSheet.getRange(existingRow, 11).setValue(JSON.stringify(repairedGallery));
        existingSheet.getRange(existingRow, 1).setValue(new Date());
        savedMaster.primaryPhoto = existingMasterPhoto;
        savedMaster.photoGallery = repairedGallery;
        touchWaffleDataVersion_('directory');
      }
    }

    return {
      master: savedMaster,
      applied: !!existingMasterPhoto.photoReferenceRepaired,
      reason: existingMasterPhoto.photoReferenceRepaired
        ? 'master-photo-reference-repaired'
        : 'master-photo-present',
      sourceStayKey: String(savedMaster.photoSourceStayKey || '').trim(),
      primaryPhoto: existingMasterPhoto
    };
  }

  var source = resolveDogMasterPhotoSourceV11208_(data);
  var primary = dogMasterPhotoCandidateV11208_(source);

  if (!primary) {
    return {
      master: savedMaster,
      applied: false,
      reason: 'no-usable-photo-bearing-stay',
      sourceStayKey: ''
    };
  }

  var gallery = normalizeV108DogPhotoGallery_(
    usableDogPhotoGalleryV11208_(
      source && Array.isArray(source.dogPhotoGallery)
        ? source.dogPhotoGallery
        : []
    ),
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
    reason: primary.photoReferenceRepaired
      ? 'photo-bearing-stay-reference-recovered'
      : 'photo-bearing-stay-recovered',
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
    usableDogPhotoGalleryV11208_(
      source && Array.isArray(source.dogPhotoGallery)
        ? source.dogPhotoGallery
        : []
    ),
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
  data = data && typeof data === 'object' ? data : {};

  var savedMaster = waffleSaveDogMasterProfileBaseV11208_(data);
  var priorMasterPhotoUsable = !!persistedMasterPhotoCandidateV11208_(savedMaster);
  var recovery = recoverMissingDogMasterPhotoV11208_(data, savedMaster);
  savedMaster = recovery && recovery.master ? recovery.master : savedMaster;

  var stayPhotoSync = seedDogStayPhotoFromMasterV11208_(data, savedMaster);

  if (savedMaster && typeof savedMaster === 'object') {
    savedMaster.masterPhotoRecovery = {
      applied: !!(recovery && recovery.applied),
      reason: String((recovery && recovery.reason) || ''),
      sourceStayKey: String((recovery && recovery.sourceStayKey) || ''),
      priorMasterPhotoUsable: priorMasterPhotoUsable
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
    behavior: 'validate-renderable-photo-repair-drive-id-recover-history-seed-empty-stay',
    preservesExistingUsableStayPhoto: true,
    replacesUnusableStayPlaceholder: true,
    recoversOlderPhotoBearingStay: true,
    repairsPreviewUrlFromDriveId: true,
    requiresRenderablePhotoReference: true,
    avoidsSecondFullMasterSave: true,
    duplicatesDriveFile: false
  };
}
