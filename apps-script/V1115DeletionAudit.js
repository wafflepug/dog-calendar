/* ========================================================================
 * WAFFLE HOUSE V11.1.5 — DELETE AUDIT GAP
 * Existing reminder, stay-photo, belongings-photo, Potential and Meet & Greet
 * deletions already log audit events. Dog profile photo deletion did not.
 * ======================================================================== */

var v1115DeletionAuditBaseProcessSheetAction_ = processSheetAction_;
processSheetAction_ = function(data) {
  data = data && typeof data === "object" ? data : {};
  var action = String(data.action || "");
  var dogName = String(data.dogName || "").trim();
  var stayKey = String(data.stayKey || "").trim();

  if (action === "delete_dog_photo" && !dogName && stayKey) {
    try {
      var photoSheet = getBelongingsSheet_();
      var photoRow = findBelongingsRow_(photoSheet, stayKey);
      if (photoRow >= 2) {
        dogName = String(photoSheet.getRange(photoRow, 3).getDisplayValue() || "").trim();
      }
    } catch (_) {}
  }

  var result = v1115DeletionAuditBaseProcessSheetAction_(data);

  if (action === "delete_dog_photo" && result && result.result === "success") {
    logAuditEvent_({
      category: "Photos",
      action: "Dog Profile Photo Deleted",
      dogName: dogName,
      bookingType: "Dog Profile",
      reference: stayKey,
      summary: "A dog profile photo was deleted.",
      changedFields: ["Dog Profile Photo"],
      before: { photoId: String(data.photoId || "") },
      after: { remaining: Array.isArray(result.gallery) ? result.gallery.length : null },
      source: "Web App"
    });
  }

  return result;
};
