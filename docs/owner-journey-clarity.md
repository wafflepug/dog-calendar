# Owner Journey Clarity

Candidate release 2026.11.02.01, service worker 167. This iteration covers items 1–8 of the owner-workflow backlog. Items 9–10 remain in a separate intake and diagnostics task.

## Delivered changes

1. **Arrival preparation:** the existing collapsed checklist puts Safety and Medication ahead of Feeding and Belongings. Safety is read from the loaded profile. Unknown status remains unknown, and its review action stays inside the existing checklist.
2. **Pickup handover:** the existing belongings disclosure reports the recorded count. An explicit empty list says that zero items were recorded; an unavailable list remains unknown.
3. **Daily-care priorities:** the profile uses its existing Safety state and a restrained Medication accent for saved instructions. Verified routine and unknown values remain quiet.
4. **Returning bookings:** the existing compact review keeps owner, request source and saved-care choice together. Owner/source edits update the review; a cleared owner is shown as not confirmed.
5. **Multi-dog plans:** shared owner and phone labels state that they apply to every dog. Booking notes are labelled per dog.
6. **Repeated visits:** the plan shows its visit count and global earliest-start/latest-end range above the exact visit rows. Overlapping ranges retain the true outer bounds.
7. **Unsaved profile edits:** leaving a dirty profile shows a brief status message naming the unfinished category and confirming that the draft is kept. Reopening the profile restores the draft.
8. **Scoped refresh:** no refresh code change was needed. Existing behavior was verified to preserve the selected same-name guest, profile and disclosure state, focus, draft content and unrelated DOM, without a redundant profile read.

## Verification

Focused Playwright checks passed in Chromium and WebKit for arrival preparation, pickup counts, returning-booking context, overlapping visit ranges, daily-care emphasis and unsaved profile guidance. Existing scoped-refresh regression checks passed at 390px and 1440px. The focused checks use synthetic fixtures and make no production writes.
