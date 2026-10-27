# Care handover clarity

Release candidate 2026.10.28.04. Six bounded changes simplify the existing Care arrival-to-checkout journey.

1. Arrival tasks show Medication and Belongings once, with a single Review action and concise evidence below. Blank containers remain unknown. Existing readable values are not treated as evidence that care was performed; selected dog/stay context remains in accessible labels.
2. First-level owner-link copy outcomes use a full-width message below the action. Clipboard failure retains the selected manual-copy field at full width and a readable phone font. Normal form-status badges return when the verified state changes. Copying does not send a message.
3. A single recorded belonging, or a confirmed empty-record description, appears directly in checkout. Longer lists retain their existing disclosure. Missing or unverified evidence retains its warning and explicit review action.
4. Checkout keeps one full review error with a concise retry prompt. Each unknown category remains visibly unverified; partial success does not hide the failed source. Existing retry reads only the unresolved source and keeps the note.
5. Departure note (optional) starts as two rows, grows while typing and stops at 180px within the scrollable sheet. Confirmation stays in the existing footer. The note is still scoped to this explicit checkout, retains its 1000-character limit and survives recoverable save failure.
6. The optional post-checkout message shows the dog, an existing positive Dog Number formatted #00001 when available, and the verified actual checkout date. Internal IDs and Other placeholders are omitted from the visible summary; verification still uses the original exact identity.

No new control, automatic send, backend read, schema change or guest-data migration is introduced. Calendar and Today layouts remain unchanged; shared asset revisions advance for consistent caching.

## Testing matrix

1. Arrival: open a current-day guest's checklist. Check concise titles, one Review action per category, correct dog/stay accessible context, known instructions and item counts. Blank, loading and failed evidence must stay unknown. Change identity and verify labels update. No read or write occurs merely from displaying the checklist.
2. Owner link: explicitly copy an identity-verified prepared link; paste into a test editor. Block the clipboard and check full-width readable feedback, focused manual text and no page overflow on 320/390px phones or desktop in both themes. Change the link/stay: obsolete manual text and feedback styling must clear. No message is automatically sent.
3. Checkout belongings: test one item, multiple items, explicit empty record and unavailable record. One item/empty description is immediately readable; larger lists retain keyboard disclosure. Unknown categories and medication remain visible and complete. No read occurs on opening the sheet.
4. Review failure: fail only medication loading, then both sources. Show the full failure once and retain unknown warnings, note and explicit retry. Retry only unresolved sources. Reject replacement stay identities; no checkout occurs without Confirm.
5. Note: type a long note on 320px and 390px short phones and desktop. It grows to a bounded height, shrinks when cleared, and leaves Cancel/Confirm reachable above the navigation. Cancel writes nothing; a recoverable save failure retains text; a new checkout starts empty.
6. Departure: after an exact verified checkout, check name, normalized Dog Number and actual date. Missing/Other/zero/UUID identifiers never appear as display IDs. Queued, failed and conflicting results never produce a success banner. Copy/share stays optional and Dismiss remains reachable.

Automated verification uses synthetic fixtures and blocks production writes. Physical-phone and assistive-technology verification remains manual; no measured customer time saving is claimed.

## Next backlog item

Have a sitter complete arrival review, owner-link sharing and departure on physical phones. Use observed hesitation and extra steps to prioritize further refinements before adding more touchpoints.
