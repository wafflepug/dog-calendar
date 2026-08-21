/* ========================================================================
 * WAFFLE HOUSE V11.1.6 — REQUEST SOURCE "OTHER"
 * ======================================================================== */

/*
 * V11.1 introduced a strict allow-list for Request Source. Extend that list
 * without changing the existing storage helpers or sheet layout.
 */
if (
  typeof WAFFLE_REQUEST_SOURCE_VALUES_ !== "undefined" &&
  Array.isArray(WAFFLE_REQUEST_SOURCE_VALUES_) &&
  WAFFLE_REQUEST_SOURCE_VALUES_.indexOf("Other") === -1
) {
  WAFFLE_REQUEST_SOURCE_VALUES_.push("Other");
}

/* Defensive wrapper in case the source list is initialised differently by an
 * Apps Script deployment. The existing normaliser remains authoritative for
 * MadPaws, Pawshake and Facebook.
 */
if (typeof normalizeWaffleRequestSource_ === "function") {
  var v1116BaseNormalizeWaffleRequestSource_ = normalizeWaffleRequestSource_;

  normalizeWaffleRequestSource_ = function(value) {
    var text = String(value || "").trim();
    if (text.toLowerCase() === "other") return "Other";
    return v1116BaseNormalizeWaffleRequestSource_(value);
  };
}
