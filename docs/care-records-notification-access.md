# Care Records & Notification Access — 2026.10.09.01

## Built deliverables

Four bounded refinements follow Care Booking Tools:

1. Explicit legacy PDF OCR states for complete, review, failed, delayed, queued, processing, not-started and unavailable results. An unknown backend state does not imply a successful read. No OCR provider or processing behavior changes.
2. Separate intake status from saved-profile, file-count and submission/upload timestamps. Status remains prominent, metadata wraps underneath and existing upload/link/PDF actions remain available.
3. Notification Inbox/Settings tabs expose reciprocal tab/panel labels, a single tab stop and arrow/Home/End navigation through the existing activation path.
4. Notification dialog opening establishes focus; keyboard boundaries stay within visible enabled controls, and Escape, close and backdrop return to an available opener. Other active dialogs retain their keyboard handling.

The change preserves backend payloads, existing disclosure rules, stored care values, local notification read semantics and initial request behavior. Cache revision is advanced in every app entry point and the service worker.

## Testing matrix

Automated verification uses the actual runtime in `tests/care-records-forms.browser.spec.js` and `tests/mvp-records-notifications.browser.spec.js`. Network fixtures block mutations and stub external reads. Final executed results are reported with the PR.

1. Happy path: open a guest, expand Records & forms; check missing, awaiting and complete digital intakes, saved-profile fallback, file counts, PDF links and upload actions. Complete status and timestamp must be separate readable elements.
2. Edge cases: show each OCR state, no timestamp, several review differences and an unfamiliar status. Unknown must say unavailable; a document-processing failure must not create an unsupported direct Retry action. Existing scoped read Retry remains available for read failures.
3. Layout: check 320/390/412px and desktop, light/dark, all five Settings palettes and long labels; status, metadata and actions must wrap inside the card. Actions remain at least 44px. No new request is triggered solely by rendering these states.
4. Keyboard: open notifications from an actionable control, move Inbox/Settings with Left/Right/Home/End and verify selected panel and focus agree. Tab and Shift+Tab wrap at dialog boundaries; hidden Settings controls do not receive focus from Inbox.
5. Close and failure modes: close with Escape, close button and backdrop; return focus to the opener when available and to a safe visible control if it disappeared. An independently active dialog must retain its own Escape/Tab handling. Read/unread, empty and failed notification reads retain their existing behavior.
6. Physical-device follow-up: on iPhone and Galaxy Fold4, check portrait, landscape and Notification Settings with the keyboard open. Scroll to the last action above the navigation footer. Emulation is not physical-device verification.

## Next backlog item

Refine notification recovery messaging: inspect the cached-activity/error presentation and offer one explicit read-only Refresh action when supported. Preserve cached activity, avoid automatic polling or extra initial requests, and distinguish stale available data from a successful refresh. First reproduce the current failure state before editing.
