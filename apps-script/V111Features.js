/* ========================================================================
 * WAFFLE HOUSE V11.1 — REQUEST SOURCE + REMINDER EMAIL HELPERS
 * ======================================================================== */

var WAFFLE_REQUEST_SOURCE_HEADER_ = "Request Source";
var WAFFLE_REQUEST_SOURCE_VALUES_ = ["MadPaws", "Pawshake", "Facebook"];

function normalizeWaffleRequestSource_(value) {
  var text = String(value || "").trim();
  if (!text) return "";

  for (var i = 0; i < WAFFLE_REQUEST_SOURCE_VALUES_.length; i++) {
    if (WAFFLE_REQUEST_SOURCE_VALUES_[i].toLowerCase() === text.toLowerCase()) {
      return WAFFLE_REQUEST_SOURCE_VALUES_[i];
    }
  }

  throw new Error("Request Source must be MadPaws, Pawshake or Facebook.");
}

function getWaffleRequestSourceColumn_(sheet, createIfMissing) {
  if (!sheet) return 0;

  var lastColumn = Math.max(Number(sheet.getLastColumn() || 0), 12);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];

  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || "").trim().toLowerCase() === WAFFLE_REQUEST_SOURCE_HEADER_.toLowerCase()) {
      return i + 1;
    }
  }

  if (!createIfMissing) return 0;

  var preferredColumn = 13;
  var preferredHeader = String(headers[preferredColumn - 1] || "").trim();
  var targetColumn = preferredHeader ? lastColumn + 1 : preferredColumn;

  sheet.getRange(1, targetColumn).setValue(WAFFLE_REQUEST_SOURCE_HEADER_);
  return targetColumn;
}

function storeWaffleRequestSource_(sheet, row, value) {
  var source = normalizeWaffleRequestSource_(value);
  if (!source || !sheet || Number(row || 0) < 2) return "";

  var column = getWaffleRequestSourceColumn_(sheet, true);
  sheet.getRange(Number(row), column).setValue(source);
  return source;
}

function readWaffleRequestSource_(sheet, row) {
  if (!sheet || Number(row || 0) < 2) return "";
  var column = getWaffleRequestSourceColumn_(sheet, false);
  if (!column) return "";
  return String(sheet.getRange(Number(row), column).getDisplayValue() || "").trim();
}

function escapeWaffleEmailHtml_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendNewReminderEmail_(record) {
  record = record && typeof record === "object" ? record : {};

  var recipient = getBoardingNotificationRecipient_();
  var dogName = String(record.dogName || "").trim();
  var reminderDate = String(record.reminderDate || "").trim();
  var reminderTime = String(record.reminderTime || "").trim();
  var note = String(record.note || "").trim();
  var author = String(record.author || "").trim();

  var whenParts = [];
  if (reminderDate) whenParts.push(reminderDate);
  if (reminderTime) whenParts.push(reminderTime);
  var whenText = whenParts.join(" at ") || "No due date set";

  var subject = "📌 New Waffle House Reminder" + (dogName ? " — " + dogName : "");
  var textBody = [
    "A new Waffle House reminder has been created.",
    "",
    dogName ? "Dog: " + dogName : "Dog: General",
    "When: " + whenText,
    author ? "Added by: " + author : "",
    "",
    note || "No reminder note was supplied.",
    "",
    "Open Waffle House → Reminders to manage this item."
  ].filter(function(line) { return line !== "" || true; }).join("\n");

  var htmlBody =
    "<div style=\"font-family:Arial,sans-serif;line-height:1.5;color:#172033\">" +
      "<h2 style=\"margin:0 0 14px\">📌 New Waffle House Reminder</h2>" +
      "<p style=\"margin:0 0 12px\"><strong>" + escapeWaffleEmailHtml_(dogName || "General") + "</strong></p>" +
      "<p style=\"margin:0 0 6px\"><strong>When:</strong> " + escapeWaffleEmailHtml_(whenText) + "</p>" +
      (author ? "<p style=\"margin:0 0 12px\"><strong>Added by:</strong> " + escapeWaffleEmailHtml_(author) + "</p>" : "") +
      "<div style=\"margin-top:14px;padding:14px;border-radius:10px;background:#f5f7fb\">" +
        escapeWaffleEmailHtml_(note || "No reminder note was supplied.").replace(/\n/g, "<br>") +
      "</div>" +
      "<p style=\"margin-top:16px;color:#667085\">Open Waffle House → Reminders to manage this item.</p>" +
    "</div>";

  sendWaffleNotificationEmail_(recipient, {
    subject: subject,
    textBody: textBody,
    htmlBody: htmlBody
  });

  return true;
}
