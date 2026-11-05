# Sitter planning and owner updates

Release: 2026.11.06.01

## Built deliverables

1. Settings > Availability & handover windows: a shared optional maximum dog count, up to 30 inclusive time-off periods, and optional same-day drop-off/pickup windows. Defaults leave current booking behaviour unchanged. Existing stays are never rewritten when settings change. Server checks normal intake creation, Fast Booking, planned confirmations, potential confirmation and confirmed date changes. Counts include both arrival and departure dates and grouped dog names. Potentials and meet & greets do not consume capacity. The older capacity widget remains advisory; a saved shared maximum is a hard limit.
2. Fast Booking has optional drop-off/pickup times. Existing stays use the compact times editor near the Care profile header. Blank means not confirmed. Times follow the stable Stay ID across date changes, not the dog's name. Same-day pickup cannot precede drop-off. Today > Handover times loads the scheduled handovers on demand; it is a schedule, not proof that a dog has arrived or departed. Times are in the sitter's Apps Script timezone (Australia/Sydney in this deployment).
3. Care > Activity > Prepare owner update opens the existing composer on Daily check-in. Use saved activity for this exact stay, edit the text, optionally choose up to four JPG/PNG/WebP files from the device, review, then Copy or Share. Each file is limited to 8 MB. Copy includes text only. Native file sharing depends on browser/device support; otherwise copy text and attach the photos manually in the owner's chat. No messages are sent automatically. No AI claims or unsaved activities are inserted. Existing server photo galleries are not duplicated into this composer.

## Storage and performance

- Shared rules: Script Property PALZ_SITTER_PLANNING_V1, with optimistic revision checks. No availability request on startup or roster rendering.
- Times: Stay_Handover_Times sheet, columns Stay ID / Dog ID / Times JSON / Revision. Created on first explicit time save. Exact confirmed Stay ID + Dog ID + stay key required. Optimistic concurrency rejects changed records; a repeat identical save returns the same record. No new sheet is created by reads.
- Profile: one lazy time read for the opened profile; editor joins in-flight reads. Today schedule is fetched only on demand. No guest-list fan-out or background polling.
- Mutations use the existing router lock and maintenance gate. Failed booking follow-up recovery includes selected handover times. Rules do not create extra scheduled jobs or paid services.
- Existing authentication architecture is unchanged; per-person audit attribution requires future authenticated accounts. Settings/time revisions prevent silent overwrites, but do not identify which spouse edited a value.

## Testing matrix

| Flow | Steps | Expected |
|---|---|---|
| Availability | Open Settings, set maximum and a time-off interval, save, reopen on another device | Same shared rules; no existing booking changes |
| Capacity | Try a confirmed booking exceeding the saved maximum, including a grouped dog booking | Clear refusal with the affected date; no new stay |
| Time off | Confirm a potential or change dates onto either boundary of a blocked period | Refused on server; dates remain unchanged |
| Flexible rules | Leave maximum and paired windows blank; remove time off | Existing advisory booking behaviour remains |
| Handover | Save 09:00 / 15:00 on an exact stay, reopen profile | Times retained; Today shows them on their scheduled dates |
| Invalid times | Try same-day pickup before arrival, malformed time or an out-of-window time | Refused; existing saved values retained |
| Shared edits | Open editor on two devices, save different edits sequentially | Second device must reload; no silent overwrite |
| Repeat save | Retry identical handover values after a lost response | Same stored record, no duplicate row |
| Owner update | Open Activity, add verified activity, edit text, choose photos | Correct dog/stay context; editable preview; explicit share only |
| Sharing fallback | Block clipboard, cancel native share or use a browser without file sharing | Draft retained; manual-copy/attachment guidance; no false sent state |
| Privacy | Switch to another dog/stay | Old photo attachments clear; stale reads do not replace new profile |
| Responsive | Review 320px/390px phone and 1440px desktop; scroll modal | No overlap; full dates and controls readable; footer reachable |

Validation performed: four focused synthetic backend tests; syntax/diff checks; fixture-only browser save/copy checks and before/after phone/desktop captures. No broad regression suite or production booking mutations. Native share destinations and physical phone behaviour remain manual checks.

## Next backlog item

Add a booking enquiry inbox that converts an enquiry into a potential or confirmed stay while reusing these shared availability checks.

## Token report

Exact implementation token usage is unavailable. Scope: three features, existing composer reused, no new dependencies or broad regression run.
