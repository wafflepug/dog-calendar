# Care arrival and rebooking

Release 2026.10.28.10. Ten refinements reuse the current Care and booking controls. Existing identity gates, saves and backend services remain in place.

## Built deliverables

1. Show a valid public Dog ID in returning-booking context; keep pending identity verification explicit and omit internal UUIDs.
2. Include the source owner's name in the existing context to distinguish similarly named dogs.
3. Label booking dates Check-in / Check-out, with New check-in / New check-out for rebooking.
4. Constrain the checkout date picker using a valid selected check-in date, preserving entered values and same-day stays.
5. Let unmodified Enter on a valid check-in field move to a missing/invalid checkout field without saving.
6. Keep the chosen new-stay range visible in the existing context, including honest same-day and invalid-date states.
7. Summarize available medication details and belongings in the collapsed arrival checklist without claiming readiness.
8. Preserve checklist disclosure and button focus during updates for the same stay; protect against reused identities.
9. Reuse a per-pass arrival snapshot to reduce repeated DOM and canonical operational lookups, with no persistent stale cache.
10. Ignore unrelated profile-editing mutations while retaining refresh for actual roster, care, identity and eligibility changes.

## Testing matrix

| Case | Steps | Expected |
| --- | --- | --- |
| Returning dog | Open Book Again for same-name dogs with distinct IDs/owners | Correct public ID and owner context; exact identity still required |
| Delayed identity | Type new dates while lookup is pending | Values and focus preserved; no automatic save or false verified state |
| New booking reset | Switch from returning context to a fresh booking | Labels/context reset; no previous owner or dates leaked |
| Dates | Set/clear/replace check-in and enter reversed or same-day dates | Min updates accurately; values retained; existing validation preserved |
| Keyboard | Enter on check-in; try modifiers, repeat and IME composition | Focus advances only on the intended valid-date action |
| New-stay context | Edit date range after identity resolves | Current new dates shown; invalid dates do not roll into plausible dates |
| Arrival summary | Load known, absent, stale or unknown medication/items | Honest compact summary; full review and warnings remain available |
| Checklist refresh | Focus a task, refresh same stay, then reuse the card for another identity | Same-stay node/focus retained; old identity cannot silently retarget |
| Client work | Compare identical fixture before/after and mutate unrelated profile notes | Fewer repeated lookups; unchanged output; no backend reads |
| Relevant changes | Change identity, operation, check-in eligibility, form state or first-paint visibility | Arrival controls refresh correctly |
| Responsive | 320px, 390px and desktop; light/dark; long names and owner context | Readable wrapping, reachable controls and no overlap |
| Safety | Fail lookup/save or open a locked visit plan | Existing guards, drafts and retry behavior remain intact |

Automated fixtures use synthetic records and block live writes. Native date keyboards, assistive technology and physical-device behavior require manual checks. Client call counts do not establish device or backend speed.

## Verification evidence

The same synthetic one-arrival fixture measured operation lookups and intake-state reads per explicit refresh: 3 each before, 1 each after. Unrelated note edits did not add arrival calculations; relevant care/visibility/operation changes still refreshed the UI. These are client call counts, not backend latency or physical-device timing.

Targeted checks cover Chromium and WebKit, the full Care runtime at 320px/390px/1440px in both themes, stable checklist focus, pending identity lookup, programmatic date replacement, same-day and invalid date entry, locked/queued visit plans and copy/share continuity. The layout fixture explicitly provides no historical visits, retaining strict collapsed-control, touch-target and footer checks.

## Next backlog item

Audit planned-visit review and incomplete-intake recovery before adding further first-level controls.
