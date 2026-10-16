# Task Completion Report — Care Rendering Performance

Candidate release: 2026.10.16.03. Implementation delegated to gpt-6-luna; reviewed and integrated by the lead model. Release validation is recorded separately after CI and deployment.

## Built Deliverables

- Unchanged directory responses preserve mounted guest cards even when the response is non-quiet. Full rendered booking fields, stable Stay ID and local date form an ordered, collision-safe signature. Explicit refresh still invalidates detail caches.
- Changed roster responses reconcile cards through unique Stay ID + Dog ID + stay key and an immutable generated-markup baseline. Unchanged guests retain their nodes and drafts; changed guests are replaced; removed guests disappear. Missing/ambiguous identity uses conservative replacement. Direct CSV refreshes recover a replaced selected profile through existing APIs.
- Cached Photos remain visible during shared freshness checks. Identical records no longer rebuild the gallery twice. Changed content renders once; refresh errors retain valid photos and one retry action; late responses remain identity-guarded.
- Care decorators skip unchanged status/flag writes. One guarded count observer covers late current/Past grids and ignores unrelated profile changes. Removed a duplicate initial decoration pass; required late compatibility passes remain.
- CI exposed a native Past Records & forms disclosure race: repeated decoration could restore stale saved state before the browser delivered its toggle event. State now restores only for a newly bound full identity; same-identity decoration preserves user intent, and unseen identities start closed. A deterministic regression covers close, immediate decoration, identity switch and restoration.
- Added focused Node and Chromium/WebKit tests, CI wiring, release identity and manual matrix. Existing history lazy loading remains unchanged because it already loads on intent.

## Testing Matrix

Local validation: 339 Node tests and 58 distinct focused browser cases (18 performance, 28 existing photo/cache/readiness, 10 Past disclosure cases and two PDF-return recovery cases). Final release evidence must confirm all current-head checks and deployed artifact identity. Initial synthetic neighbor-update fixture returned its old booking list during revalidation; the fixture was corrected to return the same authoritative synthetic state being exercised. The local WebKit full-page test completed its assertions at the 60-second total-test boundary and timed out during teardown; its total budget now matches the existing 90-second Care runtime suites. Assertion timeouts and coverage are unchanged. A separate PDF-return failure assertion was not reproduced in repeated unmodified Chromium/WebKit runs; diagnostic observation saw one scoped read and the retained failure marker. Its product and test logic were retained, with the new-head CI result required before release. No production writes were made.

Happy path: unchanged refresh retains card/detail/focus/draft; another guest's changed booking replaces only its card; Photos reopen retains existing nodes and disclosures.

Edge cases: missing/duplicate/full stable identities, same-name different dogs, Stay-ID-only changes, delimiter-containing fields, source ordering, local midnight rollover, current and historical header tags, late grid insertion and 390/1440 widths in Chromium/WebKit.

Failure modes: cold media error, cached refresh error, valid callback followed by failure, retry recovery, late response after changing identity, explicit refresh invalidation and existing JSONP timeout recovery.

Step-by-step checks: docs/care-render-performance.md. These checks demonstrate removed client DOM work, not a guaranteed wall-clock improvement in Google Apps Script or Sheets latency. Real devices and assistive technology remain manual checks.

## Next Backlog Item

Apply changed-only updates to summary/flag/overview fragments after unchanged metadata responses. Audit current behavior first; preserve identity, drafts, truthful freshness and error states, and demonstrate fewer DOM mutations without extra reads.
