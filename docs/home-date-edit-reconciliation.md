# Task Completion Report — Home stay-date reconciliation

## Built Deliverables
Reconcile the saved date-edit overlay with spreadsheet refreshes by proven booking identity. Preserve distinct stays, dogs and ambiguous records. The published sheet contained one Coco booking after the edit; this change corrects client composition without deleting customer records.

## Testing Matrix
- Original CSV dates/no Stay ID plus pending edit: one updated guest.
- Edited CSV dates/no Stay ID plus pending edit: one updated guest.
- Edited CSV dates/same Stay ID plus pending edit: one updated guest.
- Equivalent phone formatting and case-normalized stable IDs: no duplicate compatible booking copies.
- Different Dog IDs, Stay IDs, owners, phones or multiple matching source rows: preserve separate/unresolved entries.
- Home on desktop/mobile and light/dark: one Coco portrait with the edited date and stable Care link across refresh phases.
- Capacity: count a proven duplicated stay once and genuinely separate dogs separately.

Automated tests use synthetic records. Physical phone checks remain manual. No production booking mutation is part of verification.

## Next Backlog Item
Optimise repeated Apps Script profile reads with anonymous timings and existing cache invalidation safeguards.
