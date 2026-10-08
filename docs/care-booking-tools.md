# Care Booking Tools — 2026.10.08.06

Five bounded improvements follow the Care routine clarity release:

1. Readable Booking tools disclosure, action labels and helper text with responsive touch targets.
2. Dog-specific accessible names for owner-link, rebooking and history actions.
3. Compact selected-source guest context in the owner-link and new-stay forms, using the display Dog ID where available.
4. Accessible Sitter Tools dialog focus, keyboard navigation and return to its opener.
5. Immediate rebooking form presentation while exact Dog ID validation runs. Confirmed saves require validated identity or an explicit identity decision; late reads cannot overwrite edited identity fields or booking dates/notes.

No backend schema, production data migration or OCR changes are included. Opening tools does not create owner links or bookings. Existing explicit save actions remain the mutation boundary.

## Testing matrix

- Expand Booking tools for two similarly named guests. Verify dog-specific action names, readable helper text and non-overlapping targets at 320px, 390px and desktop in both themes.
- Open Owner care link. Verify source guest and stay context; opening alone must not create a link. Close with Escape and confirm focus returns to the action.
- Open Book again with a delayed identity response. Verify the form appears immediately, source context is visible, and typing dates/notes survives the response.
- Use two same-name dogs with different IDs. Confirm only the source UUID can resolve automatically; missing/failed identities must require explicit review before a confirmed save.
- Edit identity fields while loading, retry a failed read, and switch sources rapidly. Verify no stale response changes the active form or steals focus.
- Navigate Sitter Tools by keyboard, including first/last Tab boundaries and close controls. Verify nested dialogs keep their own keyboard handling and removed openers have a safe focus fallback.
- On physical iPhone and Galaxy Fold, repeat with the software keyboard open and bottom navigation visible. Browser emulation does not establish physical-device verification.

Local verification includes 227 passing Node tests, UI stability and Care future-stays contracts, 33 existing Care overview cases and 5 returning-dog inheritance cases. New layout/focus/flow regressions run through the existing cross-device CI configuration; final results are reported with the release. Browser fixtures block external mutations or record saves only in memory.

## Next backlog item

Inspect Records & forms with long document names, upload/loading/failure states and narrow phone layouts. Preserve existing OCR and explicit upload/save behavior; implement only demonstrated wrapping or action-placement gaps, with no extra initial reads.
