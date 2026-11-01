# Owner intake submission recovery

## Durable intent and receipt

Each owner submission carries an opaque UUID. The server validates the signature PNG by decoding its base64 bytes, checking the PNG chunk structure and bounds, and requiring a nonzero IHDR plus image data and a terminal IEND before it reads or writes submission records. It then fingerprints the frozen token, answers and signature and stores only the token hash, UUID, fingerprint, stable booking IDs, safe receipt context and output file references in `Intake_Submission_Receipts`. The ledger does not store the token, signature pixels or canonical answers. The existing `Dog_Intake_Records` columns are unchanged.

A short script lock serializes reservation and completion. The server flushes `Pending` before changing the booking, guest profile or Drive documents. The owner UI freezes the attempted payload in memory, persists only the UUID in tab-scoped `sessionStorage`, and prevents further edits or submissions while the outcome is unknown. Existing answer drafts remain limited to permitted fields; consent, signature, signer name/date and booking identity are not restored. Draft writes flush before the UI locks and are suppressed while pending.

## Recovery states

- `not-started`: there is no durable receipt for this attempt. The owner may review and submit again using the same UUID.
- `pending`: the attempt may have changed booking/profile data or created one or more files. The same UUID remains pending and all other UUIDs for that token are blocked. No side effect is replayed. The owner is asked to contact Waffle House for review.
- `complete`: the form row and complete receipt were committed after both file IDs were available. Replaying the same UUID and exact payload returns the saved receipt only after stable Stay ID and Dog ID validation; it does not recreate documents or send another push.
- `identity-conflict`: the receipt cannot be tied to the exact current booking or the ledger contains ambiguous duplicate state. The owner is directed to support; no write is repeated.

The status function is read-only and returns only these states. If execution stops after the Complete receipt is flushed but before audit/version/push work finishes, retry returns the receipt without repeating those side effects. Staff must inspect that outcome manually; the retry does not send duplicate notifications.

A new UUID is accepted after a previous UUID is complete for an explicitly newly signed correction. Old completed UUIDs stay in the ledger and continue to replay their original receipt without overwriting the latest profile. Pending UUIDs never expire automatically; clearing one requires an investigation that accounts for any booking, profile and Drive effects already made.

## Verification

The regression tests inject invalid signatures before all sheet writes, an interruption after booking mutation, after profile/PDF work, after receipt commit and during push delivery. They also cover a concurrent duplicate intent, a changed payload on the same UUID, a new signed correction, an old receipt replay after correction, and a booking-date change while the PDF is generated. Browser tests exercise lost response handling and reload recovery in Chromium and WebKit.
