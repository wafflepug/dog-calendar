/* ============================================================
 * WAFFLE HOUSE V11.1.91 — MAINTENANCE SAFETY MODE
 * ------------------------------------------------------------
 * The code default is the deployment switch used by ChatGPT during
 * release work. Set true in a dedicated maintenance commit, wait for
 * Apps Script deployment, make changes, then set false only after
 * validation. A Script Property can override the code default when
 * an operator needs an emergency switch from Apps Script itself.
 *
 * Deployment note: maintenance is enabled while Waffle House active-code
 * consolidation and cache hardening are being performed.
 * ============================================================ */
var WAFFLE_MAINTENANCE_DEFAULT_ = true;
var WAFFLE_MAINTENANCE_PROPERTY_ = 'WAFFLE_MAINTENANCE_MODE';
var WAFFLE_MAINTENANCE_MESSAGE_PROPERTY_ = 'WAFFLE_MAINTENANCE_MESSAGE';
var WAFFLE_MAINTENANCE_UPDATED_PROPERTY_ = 'WAFFLE_MAINTENANCE_UPDATED_AT';
var WAFFLE_MAINTENANCE_PAGE_URL_ = 'https://wafflepug.github.io/dog-calendar/maintenance.html';

function parseWaffleMaintenanceBoolean_(value, fallback) {
  var text = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  if (!text) return fallback === true;
  if (['1','true','yes','on','enabled'].indexOf(text) !== -1) return true;
  if (['0','false','no','off','disabled'].indexOf(text) !== -1) return false;
  return fallback === true;
}

function getWaffleMaintenanceStatus_() {
  var properties = PropertiesService.getScriptProperties();
  var override = properties.getProperty(WAFFLE_MAINTENANCE_PROPERTY_);
  var enabled = parseWaffleMaintenanceBoolean_(override, WAFFLE_MAINTENANCE_DEFAULT_);
  var customMessage = String(properties.getProperty(WAFFLE_MAINTENANCE_MESSAGE_PROPERTY_) || '').trim();
  var updatedAt = String(properties.getProperty(WAFFLE_MAINTENANCE_UPDATED_PROPERTY_) || '').trim();

  return {
    result: 'success',
    action: 'maintenance_status',
    version: '11.1.91',
    enabled: enabled,
    message: customMessage || (enabled
      ? 'Waffle House is temporarily down for maintenance. Updates are paused to protect your data.'
      : ''),
    updatedAt: updatedAt,
    source: override === null ? 'code-default' : 'script-property'
  };
}

function getWaffleMaintenanceStatus() {
  return getWaffleMaintenanceStatus_();
}

function isWaffleMaintenanceMode_() {
  return getWaffleMaintenanceStatus_().enabled === true;
}

function isWaffleMaintenanceReadOnlyAction_(action) {
  var name = String(action || '').trim();
  if (!name) return false;
  if (name === 'maintenance_status' || name === 'health' || name === 'waffle_ai_health') return true;
  try {
    if (typeof isReadOnlySheetAction_ === 'function' && isReadOnlySheetAction_(name)) return true;
  } catch (_) {}
  return false;
}

function assertWaffleActionAllowedDuringMaintenance_(action) {
  if (!isWaffleMaintenanceMode_()) return true;
  if (isWaffleMaintenanceReadOnlyAction_(action)) return true;
  throw new Error(
    'Waffle House is temporarily in maintenance mode. Updates are paused to protect boarding data. Please try again when maintenance is complete.'
  );
}

function enableWaffleMaintenanceMode(message) {
  var properties = PropertiesService.getScriptProperties();
  properties.setProperty(WAFFLE_MAINTENANCE_PROPERTY_, 'true');
  properties.setProperty(
    WAFFLE_MAINTENANCE_MESSAGE_PROPERTY_,
    String(message || 'Waffle House is temporarily down for maintenance. Updates are paused to protect your data.').trim()
  );
  properties.setProperty(WAFFLE_MAINTENANCE_UPDATED_PROPERTY_, new Date().toISOString());
  return getWaffleMaintenanceStatus_();
}

function disableWaffleMaintenanceMode() {
  var properties = PropertiesService.getScriptProperties();
  properties.setProperty(WAFFLE_MAINTENANCE_PROPERTY_, 'false');
  properties.deleteProperty(WAFFLE_MAINTENANCE_MESSAGE_PROPERTY_);
  properties.setProperty(WAFFLE_MAINTENANCE_UPDATED_PROPERTY_, new Date().toISOString());
  return getWaffleMaintenanceStatus_();
}

function clearWaffleMaintenanceOverride() {
  var properties = PropertiesService.getScriptProperties();
  properties.deleteProperty(WAFFLE_MAINTENANCE_PROPERTY_);
  properties.deleteProperty(WAFFLE_MAINTENANCE_MESSAGE_PROPERTY_);
  properties.setProperty(WAFFLE_MAINTENANCE_UPDATED_PROPERTY_, new Date().toISOString());
  return getWaffleMaintenanceStatus_();
}

function buildWaffleMaintenanceRedirectHtml_() {
  var target = WAFFLE_MAINTENANCE_PAGE_URL_;
  var safeTarget = target.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="refresh" content="0;url=' + safeTarget + '"><title>Waffle House — Maintenance</title></head>' +
    '<body style="font-family:system-ui,sans-serif;background:#111827;color:#fff;text-align:center;padding:40px">' +
    '<p>Waffle House is in maintenance mode.</p><p><a style="color:#c4b5fd" href="' + safeTarget + '">Open maintenance page</a></p>' +
    '<script>location.replace(' + JSON.stringify(target) + ');<\/script></body></html>'
  ).setTitle('Waffle House — Maintenance');
}
