# Next Care Profile iteration: contextual routine editing

## User story
As a boarding owner, I want to edit the relevant routine from its summary without searching through the complete profile, while retaining the full care instructions and safe save/discard behavior.

## Implementation brief
Work from main after Unified Care Profile Tools. Inspect the existing `openCareReadinessTarget`, care-brief action delegation, independent category state, and `setDirectoryProfileEditMode` in waffle-app.js before making changes. Existing Review buttons already target some categories: improve the specific field focus and return behavior rather than add duplicate edit buttons. Reuse the existing controls and exact Dog/Stay identities; do not create an alternative save path.

Keep safety and medication text fully visible; no extra reads on expanding local sections. Preserve incomplete/failed-read states, conflict blocking, explicit Save and Discard changes, unsaved field values, focus, Back navigation and section memory. The More tools grouping and its records/booking handlers must remain intact. Keep read-only Past behavior.

## Acceptance criteria
- Feeding Review reaches the existing relevant populated field or first missing essential field with a clear category heading.
- Medication Review reaches medication instructions, not an unrelated earlier control.
- Save and Discard remain reachable above phone navigation, including with the keyboard open.
- Same-name dogs retain separate stable IDs; a refreshed conflict blocks writes.
- Unchanged refresh preserves focused editor/draft; failure retains known information.
- No added profile reads from local section/editor navigation.
- Verify native pointer/keyboard input at 320/390/1440px, light/dark, Chromium/WebKit with synthetic writes blocked.

Deliver a focused diff, relevant regression fixtures and a Built Deliverables / Testing Matrix / Next Backlog Item report. Keep existing free architecture, no new dependency or backend deployment.

## Following candidates
- On-demand concise care-change history, using an existing cached history read only when explicitly requested.
- Clarify date-derived home labels alongside the recorded operational check-in state.
