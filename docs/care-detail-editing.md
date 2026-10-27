# Care detail editing

Release candidate 2026.10.28.05. Existing single-field editing remains the only save path; no new data reads or backend changes.

## Built deliverables

1. Include the existing positive human Dog Number beside dog name and stay dates. Never show placeholder source labels or internal IDs.
2. Associate the visible label with the currently visible input or note textarea, including click-to-focus.
3. Offer phone keyboards for contact numbers and appropriate text hints for names/breed, resetting when the editor is reused. Keep customer autocomplete disabled and existing validation.
4. Grow the persistent handover note as it is typed, with a bounded scrollable field and unchanged 2,000-character limit.
5. Use Ctrl/Cmd+Enter to activate an enabled Save from the active field. Ignore composition, repeats and unrelated targets; preserve plain newline in notes.
6. Cancel obsolete delayed focus after close/replacement or deliberate movement to another control. Preserve initial field focus and draft discard confirmation.

## Testing matrix

| Scenario | Steps | Expected |
| --- | --- | --- |
| Identity | Open an existing dog's handover note | Name, existing #00017-style ID and exact stay dates; no internal ID |
| Label and hints | Click note label, then open phone and owner editors | Correct field focus; phone keyboard hints reset to text for owner |
| Long note | Type a multi-line note at 320px, 390px and desktop widths | Field grows then scrolls; all text remains; Save/Discard accessible |
| Keyboard save | Change a note; use Ctrl/Cmd+Enter | One explicit existing save; unchanged note cannot submit |
| Input edge cases | Compose text, hold shortcut, press plain Enter in notes or shortcut on Discard | No unintended save |
| Failure | Simulate unavailable save service | Draft retained, visible failure and enabled retry |
| Focus race | Open then immediately close; reopen and focus Discard before delayed callback | Hidden field never takes focus; deliberate focus preserved |
| Existing safeguards | Refresh an edited stay with conflicting identity; attempt save | Existing conflict guard prevents cross-stay write |

Automated checks use synthetic bookings and intercept backend traffic. Real phone keyboard/visual viewport behavior requires a physical-device check; desktop browser emulation does not establish that.

## Next backlog item

Observe owner contact and emergency lookup during a representative arrival and care task; reduce redundant instructions only where the existing direct action is clear.
