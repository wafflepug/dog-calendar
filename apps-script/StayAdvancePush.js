/* Bounded arrival/departure reminders for confirmed stays. */
var STAY_ADVANCE_PUSH_VERSION_ = 1;
var STAY_ADVANCE_PUSH_RECEIPT_PREFIX_V1_ = 'stay_advance_push_receipt_v1_';
var STAY_ADVANCE_PUSH_RECEIPT_TTL_DAYS_V1_ = 7;
var STAY_ADVANCE_PUSH_MAX_RECEIPTS_V1_ = 1500;

function stayAdvanceHeaderNameV1_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stayAdvanceHeaderColumnsV1_(header) {
  var result = {}, duplicate = {};
  (header || []).forEach(function(value, i) {
    var name = stayAdvanceHeaderNameV1_(value);
    if (name === 'stayid' || name === 'dogid') {
      if (result[name] !== undefined) duplicate[name] = true;
      else result[name] = i;
    }
  });
  if (duplicate.stayid || duplicate.dogid) throw new Error('Duplicate stay identity headers; reminders are skipped for safety.');
  return result;
}

function stayAdvanceStrictDateV1_(value, timezone) {
  var text;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    text = Utilities.formatDate(value, timezone || Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } else {
    text = String(value || '').trim();
    var au = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (au) text = au[3] + '-' + ('0' + au[2]).slice(-2) + '-' + ('0' + au[1]).slice(-2);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) { /* canonical */ }
    else return '';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  var d = new Date(text + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text ? text : '';
}

function stayAdvanceAddDaysV1_(iso, days) {
  var d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function stayAdvancePlanV1_(stays, today, hour) {
  var planned = [], day = stayAdvanceStrictDateV1_(today);
  if (!day || Number(hour) < 7) return planned;
  (stays || []).forEach(function(stay) {
    if (!stay || stay.confirmed === false || stay.quarantined || stay.status === 'checked_out' || stay.status === 'cancelled') return;
    var id = String(stay.identity || '').trim(), dogName = String(stay.dogName || '').trim();
    var start = stayAdvanceStrictDateV1_(stay.startDate), end = stayAdvanceStrictDateV1_(stay.endDate);
    if (!id || !dogName || !start || !end || end < start) return;
    [
      { kind: 'arrival', date: start, category: 'arrivals', skip: stay.status === 'checked_in' },
      { kind: 'departure', date: end, category: 'departures', skip: false }
    ].forEach(function(event) {
      var offset = Math.round((new Date(event.date + 'T00:00:00Z') - new Date(day + 'T00:00:00Z')) / 86400000);
      if (event.skip || offset !== 1 && offset !== 2) return;
      planned.push({ identity: id, dogName: dogName, kind: event.kind, date: event.date, daysAhead: offset, category: event.category });
    });
  });
  return planned;
}

function stayAdvanceDigestV1_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(function(b) { var n = b < 0 ? b + 256 : b; return ('0' + n.toString(16)).slice(-2); }).join('');
}

function stayAdvanceReceiptKeyV1_(event, subscriptionId) {
  return STAY_ADVANCE_PUSH_RECEIPT_PREFIX_V1_ + stayAdvanceDigestV1_(
    [event.identity, event.kind, event.date, event.daysAhead, subscriptionId].join('|'));
}

function stayAdvanceReceiptExistsV1_(props, key, today) {
  var raw = props.getProperty(key);
  if (!raw) return false;
  try {
    var receipt = JSON.parse(raw);
    return receipt && receipt.delivered === true && receipt.expiresOn >= today;
  } catch (ignore) { return false; }
}

function stayAdvancePruneReceiptsV1_(props, today) {
  var all = props.getProperties(), keys = Object.keys(all).filter(function(k) { return k.indexOf(STAY_ADVANCE_PUSH_RECEIPT_PREFIX_V1_) === 0; });
  var currentCount = keys.length;
  keys.forEach(function(key) {
    var keep = false;
    try { keep = JSON.parse(all[key]).expiresOn >= today; } catch (ignore) {}
    if (!keep) { props.deleteProperty(key); currentCount--; }
  });
  return currentCount;
}

function stayAdvanceRowsV1_(rows, timezone) {
  if (!rows || rows.length < 2) return [];
  var identityColumns = stayAdvanceHeaderColumnsV1_(rows[0]), idCol = identityColumns.stayid;
  var dogIdCol = identityColumns.dogid, counts = {}, allIdCounts = {}, raw = [], uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (idCol !== undefined) rows.slice(1).forEach(function(row) {
    var id = String((row || [])[idCol] || '').trim().toLowerCase();
    if (id) allIdCounts[id] = (allIdCounts[id] || 0) + 1;
  });
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i] || [], type = String(r[11] || '').trim().toLowerCase();
    if (type && type !== 'boarding' && type !== 'confirmed boarding') continue;
    var dog = String(r[1] || '').trim(), start = stayAdvanceStrictDateV1_(r[3], timezone), end = stayAdvanceStrictDateV1_(r[4] || r[3], timezone);
    if (!dog || !start || !end || end < start) continue;
    var rawId = idCol === undefined ? '' : String(r[idCol] || '').trim();
    if (rawId && (!uuid.test(rawId) || allIdCounts[rawId.toLowerCase()] !== 1)) continue;
    var stableId = rawId.toLowerCase();
    var legacy = [dog.toLowerCase(), start, end, String(r[5] || '').trim().toLowerCase(), String(r[6] || '').replace(/\D/g, ''), String(r[2] || '').trim().toLowerCase(), dogIdCol === undefined ? '' : String(r[dogIdCol] || '').trim()].join('|');
    var identity = stableId ? 'id:' + stableId : 'legacy:' + legacy;
    counts[identity] = (counts[identity] || 0) + 1;
    raw.push({ identity: identity, stableId: stableId, legacy: legacy, dogName: dog, startDate: start, endDate: end, row: i });
  }
  return raw.filter(function(s) { return counts[s.identity] === 1; });
}

function sendStayAdvancePushNotifications_(now) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { skipped: true, reason: 'locked', sent: 0 };
  try {
    var current = now instanceof Date ? now : new Date(), sheet = getTargetSheet_();
    var tz = sheet.getParent().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
    var today = Utilities.formatDate(current, tz, 'yyyy-MM-dd'), hour = Number(Utilities.formatDate(current, tz, 'H'));
    if (hour < 7) return { skipped: true, reason: 'before_threshold', sent: 0 };
    var rows = sheet.getDataRange().getValues(), stays = stayAdvanceRowsV1_(rows, tz);
    var operations = typeof readStayOperations_ === 'function' ? readStayOperations_() : [];
    var stayKeyCounts = {}, allOps = operations || [];
    stays.forEach(function(stay) { var k = makeGuestStayKey_(stay.dogName, stay.startDate, stay.endDate); stayKeyCounts[k] = (stayKeyCounts[k] || 0) + 1; });
    stays = stays.map(function(stay) {
      var key = makeGuestStayKey_(stay.dogName, stay.startDate, stay.endDate);
      var matches = allOps.filter(function(op) {
        var opId = String(op.stayId || op.identityStayId || '').trim().toLowerCase();
        if (op.identityConflict) return stay.stableId ? opId === stay.stableId || String(op.stayKey || '') === key : String(op.stayKey || '') === key;
        return opId ? !!stay.stableId && opId === stay.stableId : String(op.stayKey || '') === key;
      });
      if (matches.some(function(op) { return op.identityConflict; }) || matches.length > 1 || stayKeyCounts[key] > 1 && matches.some(function(op) { return !op.stayId && !op.identityStayId; })) return null;
      var op = matches[0] || {}, status = String(op.status || 'expected').toLowerCase();
      if (status === 'checked_out' || status === 'cancelled') return null;
      stay.status = status;
      return stay;
    }).filter(Boolean);
    var plan = stayAdvancePlanV1_(stays, today, hour), props = PropertiesService.getScriptProperties(), sent = 0;
    var activeReceipts = stayAdvancePruneReceiptsV1_(props, today);
    var subscriptionCache = {}, pushSheet = plan.length ? getPushSubscriptionsSheet_() : null;
    plan.forEach(function(event) {
      if (!Object.prototype.hasOwnProperty.call(subscriptionCache, event.category)) subscriptionCache[event.category] = readActivePushSubscriptions_(event.category);
    });
    plan.forEach(function(event) {
      var subs = subscriptionCache[event.category] || [];
      subs.forEach(function(record) {
        var subId = String(record.subscriptionId || '');
        if (!subId) return;
        var receiptKey = stayAdvanceReceiptKeyV1_(event, subId);
        if (stayAdvanceReceiptExistsV1_(props, receiptKey, today)) return;
        var reserved = !!props.getProperty(receiptKey);
        if (!reserved && activeReceipts >= STAY_ADVANCE_PUSH_MAX_RECEIPTS_V1_) return;
        var title = event.dogName + (event.kind === 'arrival' ? ' arrival coming up' : ' departure coming up');
        var body = (event.kind === 'arrival' ? 'Arrives in ' : 'Goes home in ') + event.daysAhead + ' day' + (event.daysAhead === 1 ? '.' : 's.');
        var result, expiresOn = stayAdvanceAddDaysV1_(event.date, STAY_ADVANCE_PUSH_RECEIPT_TTL_DAYS_V1_);
        try {
          props.setProperty(receiptKey, JSON.stringify({ expiresOn: expiresOn, delivered: false }));
        } catch (reservationError) { return; }
        if (!reserved) activeReceipts++;
        try {
          result = sendFirebaseMessageToFid_(record, { title: title, body: body, category: event.category, tag: 'stay-' + event.kind + '-' + event.date + '-' + event.daysAhead + '-' + stayAdvanceDigestV1_(event.identity).slice(0, 16), link: 'directory.html', data: { stayEvent: event.kind, stayDate: event.date, daysAhead: event.daysAhead } });
        } catch (sendError) {
          try { updatePushDeliveryRecord_(pushSheet, record, false, '', 'Push send failed; retry will be attempted.'); } catch (ignoreFailureMetadata) {}
          return;
        }
        if (result && result.ok) {
          var saved = false;
          try {
            props.setProperty(receiptKey, JSON.stringify({ expiresOn: expiresOn, delivered: true }));
            saved = true;
          } catch (ignoreReceiptSave) {}
          if (saved) {
            sent++;
            try { updatePushDeliveryRecord_(pushSheet, record, true, result.messageId || '', ''); } catch (ignoreSuccessMetadata) {}
          }
        } else {
          try { updatePushDeliveryRecord_(pushSheet, record, false, '', 'Push send failed; retry will be attempted.'); } catch (ignoreFailureMetadata2) {}
        }
      });
    });
    return { planned: plan.length, sent: sent, receiptCapacityAvailable: activeReceipts < STAY_ADVANCE_PUSH_MAX_RECEIPTS_V1_ };
  } finally { lock.releaseLock(); }
}

function getStayAdvancePushStatus_() {
  var timezone = Session.getScriptTimeZone();
  try { timezone = getTargetSheet_().getParent().getSpreadsheetTimeZone() || timezone; } catch (ignore) {}
  var triggers = [];
  try { triggers = ScriptApp.getProjectTriggers(); } catch (ignoreTriggers) {}
  var checker = false, morning = false;
  triggers.forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === 'checkWaffleHousePushNotifications') checker = true;
    if (handler === 'sendMorningWafflePushNotifications') morning = true;
  });
  var credentialsConfigured = false;
  try { getFirebaseMessagingConfig_(); credentialsConfigured = true; } catch (ignoreCredentials) {}
  var activeArrivalDevices = null, activeDepartureDevices = null;
  try {
    var parent = getTargetSheet_().getParent(), props = PropertiesService.getScriptProperties();
    var sheetName = String(props.getProperty('PUSH_SUBSCRIPTIONS_SHEET_NAME') || 'Push_Subscriptions').trim();
    var pushSheet = parent.getSheetByName(sheetName);
    if (pushSheet && pushSheet.getLastRow() >= 1) {
      var header = pushSheet.getRange(1, 1, 1, pushSheet.getLastColumn()).getValues()[0] || [], columns = {};
      header.forEach(function(value, index) { var name = stayAdvanceHeaderNameV1_(value); if (columns[name] !== undefined) columns[name] = -1; else columns[name] = index; });
      var enabledCol = columns.enabled, fidCol = columns.firebaseinstallationid, arrivalCol = columns.arrivals, departureCol = columns.departures;
      if ([enabledCol, fidCol, arrivalCol, departureCol].every(function(col) { return col !== undefined && col >= 0; })) {
        activeArrivalDevices = 0; activeDepartureDevices = 0;
        if (pushSheet.getLastRow() > 1) {
          var values = pushSheet.getRange(2, 1, pushSheet.getLastRow() - 1, pushSheet.getLastColumn()).getValues();
          values.forEach(function(row) {
            var enabled = row[enabledCol] === true || String(row[enabledCol]).toLowerCase() === 'true';
            if (!enabled || !String(row[fidCol] || '').trim()) return;
            if (row[arrivalCol] === true || String(row[arrivalCol]).toLowerCase() === 'true') activeArrivalDevices++;
            if (row[departureCol] === true || String(row[departureCol]).toLowerCase() === 'true') activeDepartureDevices++;
          });
        }
      }
    }
  } catch (ignoreDeviceCounts) {}
  return { result: 'success', schemaVersion: 1, version: STAY_ADVANCE_PUSH_VERSION_, timezone: timezone, morningHour: 7,
    credentialsConfigured: credentialsConfigured, checkerTriggerPresent: checker, morningTriggerPresent: morning,
    activeArrivalDevices: activeArrivalDevices, activeDepartureDevices: activeDepartureDevices };
}
