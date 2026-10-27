# Stay advance system reminders

Candidate release 2026.10.27.03. Native web push reminders for a sitter preparing arrivals and departures.

## Built deliverables

- Notify each opted-in device two calendar days and one calendar day before a confirmed boarding arrival or departure. Returning dogs are included.
- Use the spreadsheet timezone and the existing approximate 7 am morning trigger. The existing five-minute checker retries after 7 am; a booking added later that day can still receive its applicable reminder.
- Reuse Notifications > Settings > Arrivals and Departures. Their descriptions cover today and the two advance reminders. No new preference or page is needed.
- Keep exact stay identity, exclude unconfirmed/non-boarding rows, and suppress checked-out stays and arrivals already checked in. Ambiguous identity records are skipped rather than guessed.
- Hold a short scheduler lease while sending; release the shared booking lock before network delivery so check-in, checkout and saves remain available. A terminated scheduler run recovers automatically.
- Record successful delivery separately for each device and each lead time. Failed deliveries remain eligible for retry; changed dates create a new reminder event. Receipts contain opaque hashes rather than owner contact details or device tokens.
- Expose aggregate, read-only scheduler health and a deployment capability version. Checking health neither installs triggers nor sends a test notification.

The existing Firebase FID registration and HTTP v1 target are retained, matching the current [Firebase web documentation](https://firebase.google.com/docs/cloud-messaging/web/get-started) and [message API](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages). No paid service is added.

## Testing matrix

1. Use synthetic stays arriving/departing in two days. At 7 am, each subscribed device receives the corresponding named reminder. Repeat the handler: successful devices receive no duplicate.
2. Advance the local calendar one day. The one-day reminder must still send, independently of the earlier two-day receipt. Test month/year boundaries, leap years and Sydney daylight saving changes.
3. Turn Arrivals off for one device and Departures off for another. Only the subscribed movement category is delivered. A newly enrolled device may receive the current day's applicable reminder.
4. Test distinct dogs sharing a name and separate stays for one dog. Each reminder must refer to its own stay. Duplicate/invalid IDs and ambiguous legacy operations must not produce guessed alerts.
5. Mark a stay checked out: no advance reminders. Mark an arrival checked in: suppress arrival alerts while retaining its future departure reminder. Potential stays and Meet & Greet records produce neither.
6. Fail one device send, retry, and check that only the failed device retries. Fail delivery-metadata recording separately: a successful send receipt must remain. Hold the scheduler lock: a concurrent invocation must skip.
7. Change a booking date: the next pass uses the new date; it must not send the obsolete event. Confirm ledger pruning does not evict current successful receipts and cause repeated notifications.
8. Verify the deployed SHA, `stayAdvancePushVersion: 1`, aggregate scheduler health, and existing live trigger ownership. Production verification is read-only; it does not broadcast sample alerts.

If a process stops after Firebase accepts a message but before the delivery receipt is saved, a retry can occur. A successful Firebase send is acceptance for delivery, not proof the phone displayed it. Browser/OS permissions, device connectivity and OS delivery policies still apply. Native push requires enrollment on each device. On iPhone/iPad, use the installed Home Screen web app with notifications allowed. Scheduled execution is approximate rather than a guaranteed exact minute.

## Sitter setup

Open Notifications > Settings on each phone or computer. Use Enable This Device if needed, allow notifications, and keep Arrivals and Departures checked. Save preferences. Devices already enrolled with those preferences enabled do not require re-enrollment.

## Next backlog item

Show a concise notification delivery status in existing Settings, with a recovery path for permission changes and expired registration, without adding background guest reads or another dashboard tile.
