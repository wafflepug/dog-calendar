# Care photo recovery iteration

Implemented three related backlog items:

1. Keep the prepared hosted photo session when its modal closes. Resume targets the original unique stay and photo type; explicit Discard releases its selections.
2. Give each photo a stable upload ID. The server serializes writes, records receipts, and reuses a deterministic Drive file after an interrupted sheet update. Partial batches skip confirmed photos and check uncertain results before retrying.
3. Show prepared, uploading, awaiting confirmation and failed states with wrapping Resume, Check and Discard controls in Care.

Sessions and selected bytes live only in the current page's memory. Reloading or closing the browser does not restore them. Receipts expire after 24 hours; old timestamped IDs are rejected after cleanup. Old upload clients remain supported without the new receipt guarantee.

Verification: Node session/recovery/receipt fixtures; Care overview browser layouts at narrow phone and desktop widths in light/dark themes, including WebKit; first-open release/cache fixtures. A real upload smoke check still requires an authorized test stay and physical phones.

Manual testing matrix:

1. Select photos, close the modal, then Resume the same stay. Selection remains; another stay or photo type cannot replace the session.
2. Save a batch, interrupt the connection after one photo, then check/retry. Confirm saved photos occur once and only unfinished photos upload.
3. Change stay identity while paused. Resume must refuse a conflicting or ambiguous stay.
4. Discard an unsubmitted session, cancel the confirmation once, then confirm it. Controls disappear only after confirmation.
5. At 320px and Fold widths, verify controls wrap, focus remains visible and the footer does not cover them.

Next bounded backlog: review the Care media gallery's thumbnail sizing and empty/loading/error states. Keep original image loading lazy and preserve exact-stay ownership; compare request counts before claiming a performance improvement.
