/* Checkout reminders share the existing five-minute email trigger. */
function sendCheckoutTimeReminderEmails_(now) {
  var tz = getTargetSheet_().getParent().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  var today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var pickups = getSitterCheckoutReminderPickups_(today, stayAdvanceAddDaysV1_(today, 1));
  var due = pickups.filter(function(pickup) {
    var local = pickup.date + ' ' + pickup.time;
    var scheduled;
    try { scheduled = Utilities.parseDate(local, tz, 'yyyy-MM-dd HH:mm'); } catch (_) { return false; }
    var lead = scheduled.getTime() - now.getTime();
    return lead >= 60 * 60000 && lead <= 70 * 60000 &&
      Utilities.formatDate(scheduled, tz, 'yyyy-MM-dd HH:mm') === local;
  });
  if (!due.length) return 0;

  var operations = readStayOperations_();
  var recipient = getBoardingNotificationRecipient_();
  var cache = CacheService.getScriptCache();
  var sent = 0;
  due.forEach(function(pickup) {
    if (operations.some(function(operation) {
      var id = String(operation.stayId || operation.identityStayId || '').trim().toLowerCase();
      var sameKey = String(operation.stayKey || '') === pickup.stayKey;
      var status = String(operation.status || '').toLowerCase();
      return (id === pickup.stayId || ((!id || operation.identityConflict) && sameKey)) &&
        (operation.identityConflict || status === 'checked_out' || status === 'cancelled');
    })) return;

    var key = 'checkout-email:' + stayAdvanceDigestV1_([pickup.stayId, pickup.date, pickup.time].join('|'));
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) return;
    try {
      if (cache.get(key)) return;
      cache.put(key, 'sending', 900);
    } finally {
      lock.releaseLock();
    }

    var message = pickup.dogName + ' is scheduled to check out at ' + pickup.time + ' on ' + pickup.date + '.';
    try {
      sendWaffleNotificationEmail_(recipient, {
        subject: 'Checkout reminder — ' + pickup.dogName,
        textBody: message,
        htmlBody: '<p>' + escapeHtmlEmail_(message) + '</p>'
      });
    } catch (_) {
      cache.remove(key);
      console.error('Checkout reminder email delivery failed.');
      return;
    }
    sent++;
  });
  return sent;
}
