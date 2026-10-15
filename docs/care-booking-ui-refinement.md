# Care and booking UI refinement

Release candidate: 2026.10.16.01. Development uses Luna; lead review and release verification follow.

## Delivered scope

1. Dog record maintenance is an explicit, initially closed Update dog record disclosure. Record provenance, freshness, safety and owner details remain available without opening maintenance. Save feedback must remain visible after the disclosure closes.
2. Populated photo groups start collapsed with counts. Full images and captions remain accessible on demand. Expanding/collapsing does not trigger backend reads, and deliberate disclosure state is retained for the same guest.
3. Multiple visits uses Owner → Dogs → Dates → Review steps. Back navigation retains drafts. Ordinary single bookings remain available independently of a paused plan.
4. Existing dogs can be searched and explicitly selected using identifying cards. Names alone never choose an identity. New dogs remain an explicit choice.
5. Review and save results are grouped by dog, with individual dates and outcomes. A single Resume action continues unfinished visits without repeating acknowledged visits.

## Verification matrix

- On 320px/390px phones and 1440px desktop, inspect light/dark themes and enlarged text. Check wrapping, reachable footer actions, visible focus and touch targets.
- Open Dog record with saved or derived data. Open/close maintenance with keyboard. Confirm no read/write occurs from toggling; freshness and care information remain visible.
- Save an edited record with deferred success, queued or failed transport. Close maintenance while waiting. Confirm status stays visible, double clicks do not duplicate writes, retry retains the exact guest and late responses cannot alter another guest.
- Open Photos with populated and empty groups. Check initial counts, expand each gallery, read long captions and switch tabs/guests. Confirm no extra reads on disclosure changes.
- Enter a shared owner/contact, select two dogs explicitly, add two date sets and review four visits. Go back and edit without losing drafts. Inspect per-dog grouped review and advisory warnings.
- Search same-name dogs by number, breed and owner. Confirm typing does not select a dog, and only an explicit choice applies its exact Dog ID.
- Save with a partial failure or queued response. Confirm saved visits remain saved, remaining dates are visible and Resume reuses the original write intent. Ordinary single booking must still work when a batch is paused.
- Open the actual mobile Add → Multiple visits entry, close the dialog and confirm keyboard focus returns to the visible Add control.

## Existing limits

This release changes presentation only. Same-day visits still use boarding capacity rules; legacy name/date collision guards remain. Plans remain in the current page session. No new paid service, owner account model or backend migration is introduced.

## Next backlog item

Show the age of cached Dog record information when a trustworthy timestamp exists, without new background reads or implying missing timestamps are fresh.
