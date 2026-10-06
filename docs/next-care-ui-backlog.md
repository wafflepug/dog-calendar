# Next UI backlog

These are bounded follow-ups, not delivered changes. First inspect the rendered runtime: older CSS declarations alone do not prove a current defect.

## 1. Care inline edit dialogs
User story: as a sitter, I can edit a name, breed, contact or handover note on a small phone without losing the label, error or Save action.
Scope: existing `guestDetailEditModal` renderer and handlers in waffle-app.js, existing runtime modal sizing and scoped styles. Preserve validation, booking identity, drafts and request payloads.
Acceptance: 320px, 390px and desktop; long label/value; light/dark and all settings accents; 16px editable text; 44px actions; keyboard-open viewport, fixed footer and landscape; errors remain associated with their field; cancel preserves saved values. Use real runtime fixtures with mutations blocked or locally simulated. Do not claim physical-device verification from emulation.
Deliverables: minimal scoped CSS/markup changes only where rendered review demonstrates a gap, focused browser regression, manual verification notes.

## 2. Care Records & forms state clarity
User story: I can tell whether an intake is missing, ready or being processed without reading repeated filler.
Scope: existing Records & forms disclosure, intake-link and legacy-document status in waffle-app.js/care.js and their styles; preserve OCR implementation and available actions.
Acceptance: one readable status per operation; missing/loading/success/error fixtures; actionable Retry only where supported; no additional initial fetches; existing disclosure and confirmation rules preserved; narrow-screen labels and actions wrap; no overlapping fixed navigation; both themes/settings accents.
Deliverables: inspect current rendered states, implement only verified UI gaps, browser tests for those states, short manual matrix.

## 3. Notification centre readability
User story: I can read notification categories, counts and actions from the sidebar on mobile.
Evidence to inspect: waffle-app.css .v101-notification-tab has 40px/11px base declarations and panel action buttons 30px/9px; confirm the actual runtime cascade before editing.
Acceptance: minimum44px interactive targets; readable counts and text at320px; settings accents with high contrast; empty/read/unread/error states; keyboard focus and current modal footer clearance; preserve existing notification semantics and reads.
Deliverables: bounded typography/layout change with actual renderer fixtures and manual matrix; no new notifications or polling.

Deferred separately: identity-safe same-name/date later arrivals described in next-care-search-consistency.md. This remains a data correctness task and should not be bundled into a visual polish change.
