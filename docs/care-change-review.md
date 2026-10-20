# Care Change Review

Three improvements for a busy boarding carer, using the existing edit screen and draft.

1. **Review changed fields:** an optional Review changes disclosure appears only when there are edits. It shows each field's full saved and draft values. Empty originals say Not provided; cleared values say Removed. Safety flags say Flagged / Not flagged without implying that missing safety information is clear. Save remains direct; there is no mandatory confirmation screen.
2. **Go to a change:** the field-name button opens its existing Care category and optional disclosure, scrolls to the control and focuses it. No extra record read occurs.
3. **Undo one field:** restores only that field's original value. Other edits remain. Undo is disabled while saving or when the existing identity/conflict guard blocks editing. Focus moves to a remaining review row, the summary, or Discard when no edits remain.

The review stays closed initially, preserves its open state and control focus during harmless same-identity refreshes, and disappears after successful save, discard or undoing all edits. User values are added as text nodes, never HTML. No draft values are persisted to browser storage.

## Test steps

1. Open a synthetic guest, Edit and Food & Walks. Change the food amount. Confirm the review appears closed, contains only that field and shows the original/new values. Save remains available without opening review.
2. Open review with Enter. Change medication instructions and an age under More details. Collapse Health & Home and More details, then use Go to Age. Confirm both reopen and the age input receives focus.
3. Undo the food amount. Confirm medication and age edits remain. Undo the remaining fields; confirm review disappears, Save disables and focus remains visible.
4. Toggle an existing safety checkbox and clear a feeding value. Verify the review labels, undo behavior and original values after Discard.
5. Simulate saving, failed save and identity conflict with synthetic fixtures. Undo remains blocked during saving/conflict; failed-save drafts remain available and field links recover when editing is enabled. Confirm no extra profile reads.
6. At 320/390/1440px, light/dark and enlarged text, read the complete instructions and operate 44px keyboard/touch controls. Closed content must remain hidden in WebKit. Physical-device accessibility settings remain a manual check.

No backend, schema, authentication, stored identity or commercial platform changes are involved. Tests intercept network requests and block production writes.

## Next ready backlog

1. Category-level change counts: make edited sections identifiable while keeping unchanged categories quiet.
2. Contextual save recovery: distinguish a rejected save from a confirmed save whose later refresh failed, using existing receipts and status paths.
3. Review the complete mobile care handover journey with representative short/long plans and reduce any demonstrated repeated labels or scrolling.

For each item, inspect existing behavior first; preserve drafts, safety wording, lazy reads, direct owner sharing and operation controls. Implement only demonstrated gaps rather than duplicating existing status or navigation.
