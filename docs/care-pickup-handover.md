# Care pickup and handover

Release 2026.10.28.07. Use existing card data and the existing verified checkout mutation; no backend deployment, new reads or new icons.

## Built deliverables

1. Show owner contact in the checkout review, with a callable original formatted phone only when valid. Hide absent contact.
2. Include the complete saved handover note in a quiet disclosure. Hide absent/placeholder notes; never insert it into the optional departure note or owner message.
3. Ask before discarding a nonblank unsaved note in normal or early checkout. Rejecting keeps the note and focus. Busy saves remain locked; verified success closes without a discard prompt.
4. Grow early checkout notes up to 180px, then scroll. Shrink when cleared; preserve the 1,000-character limit.
5. Make pending copy/share state explicit, lock duplicate actions, preserve manual copy recovery, and prevent obsolete completions from updating a replacement message or stealing focus.

## Testing matrix

| Case | Steps | Expected |
| --- | --- | --- |
| Pickup context | Open checkout with saved owner/contact and handover | Correct owner and tel target; complete escaped saved note; no new reads/writes |
| Missing context | Reopen checkout for another dog with no saved contact/note | Old contact and note cleared; absent blocks hidden |
| Unsafe phone | Supply invalid phone text | No callable target |
| Note protection | Type a departure note, close or press Escape, reject discard | Sheet remains; note and focus retained |
| Confirmed discard | Accept discard, then reopen | No write; note resets only after confirmed discard |
| Verified save | Save a noted normal/early checkout | One existing mutation, validated identity, no discard prompt |
| Pending/failed save | Hold or fail the existing mutation | No duplicate saves; controls guarded; note retained for retry |
| Long early note | Type multiple lines, clear, reopen | Grows then scrolls, shrinks/reset correctly, footer reachable |
| Copy/share | Delay copy, press again, replace/dismiss message, then settle | One operation, truthful feedback, replacement unaffected |
| Clipboard blocked | Reject copy with open/closed message | Manual selection when visible; no focus steal when closed |
| Responsive | Check 320px, 390px and desktop, light/dark and enlarged text | Readable wrapping and touch targets; medication complete; no covered footer |

Fixtures intercept all backend traffic. Actual phone dialing, native share destinations and physical keyboard/viewport behavior require manual device checks. No messages are sent automatically.

## Next backlog item

Review checkout completion and return-to-roster tasks with a solo sitter; reduce redundant confirmation text only when the saved outcome remains explicit.
