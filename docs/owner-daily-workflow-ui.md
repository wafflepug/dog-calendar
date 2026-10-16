# Daily owner workflow UI — 2026.10.16.02

## Built deliverables

This iteration refines existing screens instead of adding another dashboard or Care summary.

1. Today's scheduled action queue removes repeated event rows, keeps distinct dogs/visits separate, and provides direct destinations for arrivals, departures and Meet & Greets. Counts use the same unique events. The queue is limited to scheduling data already loaded; it does not infer medication schedules or completed intakes. Care remains the destination for those checks.
2. Care essentials keeps the existing safety, feeding, medication and handover information. The call action now sits beside the owner's name and appears once.
3. Booking setup appears above the essentials grid. Its states identify missing intake, missing handover and identity review. “Setup complete” describes intake/handover checks only; it is not a safety or medication review certification. Existing disclosure rows retain the specific review actions.
4. Dog Record distinguishes the local copy's saved time from a successful network check. Unknown, invalid and future cache times remain unknown. Offline and failed refresh states remain explicit, and cached records stay visible on refresh failure.
5. Book Again verifies the exact Dog ID before handing focus to dates. Moving to another field while the lookup runs prevents focus being stolen. The selected guest summary provides a shortcut to the existing multi-visit planner with shared owner contact prefilled. Separate visit saves, capacity warnings and dated-care review remain required.

No backend deployment, paid service or additional startup read is introduced.

Late roster decoration also preserves the historical checkout label and marker in an opened Past profile. Current/upcoming status updates remain active.

The six existing profile regression configurations now run as separate CI matrix jobs. Their cases, browsers and final required gate remain unchanged. This permits isolated failure diagnosis and reruns; the overall speed improvement must be measured from CI rather than assumed.

## Testing matrix

Use synthetic data for writes; live verification is read-only.

| Journey | Steps | Expected result |
|---|---|---|
| Today queue | Load one arrival, one departure, one Meet & Greet and a repeated copy of one event. | Each unique event is counted once; the queue offers the appropriate action. |
| Same-name guests | Load two dogs sharing a name and dates but different Dog IDs. Open each queue destination. | Each destination uses the requested identity; mismatches never open a different guest. |
| Empty Today | Load no same-day events. | Only the scheduled queue is described as empty; medication/intake checks are not claimed complete. |
| Care glance | Open a current guest on phone and desktop. | Setup precedes essentials; owner name and one call action appear together; instructions remain complete. |
| Setup gaps | Start with missing intake/handover, then complete intake, then handover. Introduce identity conflict. | Needs intake → Needs handover → Setup complete; conflict takes precedence. Expand setup for individual actions. |
| No phone | Remove or invalidate the owner's phone number. | Call owner is unavailable, with no invalid telephone link. |
| Cached record | Load known, absent, invalid and future cache timestamps. | Only a trustworthy timestamp describes the local copy's age; no source-edit time is manufactured. |
| Network failure | Show a cached record, then fail its refresh. Retry. | Record remains visible with failed-refresh feedback and an accessible Retry; a verified success updates the check label. |
| Guest switch | Switch guests while a previous guest's read/save is pending. | Late callbacks cannot replace the new guest or carry over their copy timestamp/status. |
| Repeat booking | Choose Book Again for an existing dog. Wait for exact ID; choose new dates and review dated care. | Dates receive focus only after verification, and the original stay remains separate. |
| User focus | During delayed identity lookup, focus Owner or another input. | Lookup completion does not move focus away from that field. |
| Multiple visits | From the returning guest summary, choose Plan multiple visits. | Existing four-step planner opens with shared owner/phone; select exact dog and dates, review, then confirm individual visits. |
| Identity failure | Fail the lookup or remove the source Dog ID from results. | No name-based selection or accidental confirmed booking; explicit identity review remains required. |
| Responsive access | Check 320/390/1440px, light/dark, keyboard and enlarged text. | No horizontal overflow or overlapping labels; primary controls remain reachable with visible focus and 44px targets. |

## Next backlog item

Unify genuinely scheduled medication/reminder tasks with Today using an explicit due-time and completion contract. First audit existing reminders and cached data; do not turn a medication flag into a due task or add blocking startup reads. Keep each task associated with exact dog/stay identity and show when the schedule is unavailable.
