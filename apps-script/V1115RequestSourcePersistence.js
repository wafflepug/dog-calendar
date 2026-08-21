/* ========================================================================
 * WAFFLE HOUSE V11.1.5 — REQUEST SOURCE PERSISTENCE GAP
 * The Meet & Greet UI sends requestSource through legacy create/update actions.
 * Persist it in the shared Request Source column as well.
 * ======================================================================== */

var v1115RequestSourceBaseProcessSheetAction_ = processSheetAction_;
processSheetAction_ = function(data) {
  data = data && typeof data === "object" ? data : {};
  var action = String(data.action || "");
  var result = v1115RequestSourceBaseProcessSheetAction_(data);

  if (
    result &&
    Number(result.row || 0) >= 2 &&
    (action === "create" || action === "update") &&
    String(data.requestSource || "").trim()
  ) {
    storeWaffleRequestSource_(getTargetSheet_(), result.row, data.requestSource);
  }

  return result;
};
