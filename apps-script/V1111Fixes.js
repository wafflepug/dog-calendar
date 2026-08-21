/* ========================================================================
 * WAFFLE HOUSE V11.1.1 — STAY PHOTO UPLOADER COPY FIX
 * ======================================================================== */

/*
 * The hosted uploader is shared by belongings, dog-profile and stay photos.
 * For a Stay Photo request, rewrite every remaining belongings-specific copy
 * in the generated HTML so the iframe and the parent modal say the same thing.
 */
var v1111BaseBuildBelongingsPhotoUploaderHtml_ =
  buildBelongingsPhotoUploaderHtml_;

buildBelongingsPhotoUploaderHtml_ = function(params) {
  var output =
    v1111BaseBuildBelongingsPhotoUploaderHtml_(
      params
    );

  var photoType =
    String(
      params && params.photoType ||
      "belongings"
    );

  if (
    photoType === "stayPhoto" &&
    output &&
    typeof output.getContent === "function" &&
    typeof output.setContent === "function"
  ) {
    var content =
      output.getContent();

    content = content
      .replace(
        /📷 Add Belongings Photos/g,
        "📸 Add Stay Photos"
      )
      .replace(
        /Add Belongings Photos/g,
        "Add Stay Photos"
      )
      .replace(
        /Choose up to 8 photos in one selection, or take a photo with the camera\./g,
        "Choose up to 8 stay photos in one selection, or take a photo with the camera."
      );

    output.setContent(
      content
    );
  }

  return output;
};
