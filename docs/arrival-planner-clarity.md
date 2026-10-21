# Arrival and visit-plan clarity

Release candidate 2026.10.22.01. This is a frontend-only refinement of existing booking and Care flows.

## Built deliverables

- Arriving guest cards show the available owner name alongside each dog's existing ID and dates. Same-day care shows one date and an explicit label. Later-arrival cards remain lazy and distinct, including same-name dogs. The planner shows shared owner contact once because the user explicitly creates one household plan. The roster does not infer households or merge dogs from matching owner names.
- Dates and Review use weekday, day, month and year. Same-day visits and overnight stays have distinct labels. Review shows each dog with its number and breed, a chronological schedule, and a compact dog/date/total-stay count. The schedule appears once before saving. After saving begins, the existing per-visit results replace the schedule detail while the owner/count/warnings remain. Remove-date buttons name the date.
- Today's unambiguous arrivals show intake status and a separate Care review reminder in the existing review control. A received form does not imply a completed care review. Check In stays a separate action. Checked-in/out or ambiguous stays do not gain a new readiness claim.

No new startup request, storage, automatic message, backend schema or write operation is introduced. Save identities, capacity warnings and partial-save recovery remain unchanged. A new dog's permanent display number still requires its first confirmed save. Same-name dogs with identical dates remain subject to the existing legacy planner validation.

## Testing matrix

1. **Two dogs, two stays:** add two exact Dog IDs under one owner, then two date ranges. Review one owner contact and two identified dogs. Confirm four distinct Stay IDs. Before saving, each schedule appears once. After saving, inspect each result.
2. **Weekly same-day care:** choose a bounded weekly pattern. Verify weekday/full dates and the Same-day visit label in Dates and Review. Remove one date using its named button, review again, and confirm only the remaining occurrences.
3. **Arrival preparation:** open Staying with an arrival today. Intake complete, link ready, missing and unknown states remain truthful. Review care opens the selected dog only. Check in directly; its pending-arrival reminder disappears after the operational status updates.
4. **Distinct identities:** inspect same-name dogs with different numbers, dates or owners. Each card retains its own profile target. Matching owner names never combine records. Later arrivals remain unloaded until requested.
5. **Partial failure:** fail the second visit after the first succeeds. Results remain visible. Resume retries the failed intent and leaves the confirmed first stay unchanged. Queued writes remain queued, not saved.
6. **Layout/access:** check 320, 390 and 1440px, light/dark and enlarged text. Long owner and dog names wrap, controls remain reachable above the footer, keyboard focus stays visible and dates do not overlap Remove controls.

Automated fixtures use synthetic records and mocked writes. Physical-device verification is separate. Publication is only complete after the candidate passes CI and the exact deployed release is verified.

## Next backlog item

Compact departure handover: audit the existing guided checkout, belongings and medication review before changing it. Keep its retained same-stay note and explicit confirmation, and remove only demonstrated repeated information.
