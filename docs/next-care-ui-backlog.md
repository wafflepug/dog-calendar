# Next UI backlog

Completed 9 October 2026: four Records & forms and notification-access refinements are documented in [Care Records & Notification Access](care-records-notification-access.md). Earlier font/touch-target improvements were retained rather than repeated. Existing inline editor polish is documented in care-inline-editor-polish.md.

## Next: Notification refresh recovery

User story: I can distinguish available cached activity from a failed refresh and explicitly retry without losing the available feed.
Scope: inspect loadWaffleNotificationCentre/renderWaffleNotificationCentre and existing local cache/error flags first. Implement only a reproduced gap. Preserve read/unread semantics and device notification settings. No new polling or initial requests.
Acceptance: cached-success, stale-cached-failure, uncached-failure, retry-success and repeated activation states; one supported read-only Refresh/Retry action; no duplicate concurrent refresh; visible keyboard focus, 44px targets, 320px wrapping and both themes/settings accents; no invented success or destructive cache clearing.
Deliverables: bounded Luna implementation, actual-runtime fixtures and manual device checks.

## Then: Records & forms document recovery

Inspect the existing uploader-return refresh path on mobile/PWA before choosing a change. Keep explicit upload intent and the existing OCR implementation. Any refresh enhancement must stay scoped to the selected stay and reject responses for a different selected identity. Do not add eager document reads.

Deferred separately: backend persisted-ID Care reads and a reviewed legacy migration map described in next-care-search-consistency.md. This is a data correctness task and should not be bundled into visual polish.
