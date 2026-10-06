# Care UI polish

This update improves three Care workflows while preserving their existing saved values, draft behavior, loading states, and confirmation steps.

- The selected guest profile now has readable, touch-sized Edit and Discard controls, a distinct Save action, visible keyboard focus, and a status row that can wrap on narrow screens.
- Editable profile fields use 16px text to avoid mobile browser zoom. Labels and long values wrap within their fields. The read-only profile keeps its compact presentation.
- Returning-stay linking uses readable selects, review labels, checkboxes, and buttons. Long dog names, owner names, and identifiers can wrap at phone and desktop widths. The separate review and explicit confirmation steps remain in place.

Manual checks: open a selected dog profile and verify its read-only density; enter edit mode, change a field, then save and discard drafts; inspect unsaved, saving, error, and success feedback; navigate with the keyboard and confirm visible focus; open Returning dog link, select a stay and dog, review the exact identity, exercise the name-mismatch check, and verify the final action stays disabled until required confirmations are checked. Repeat at 320px and desktop width in light and dark themes.

Automated coverage: `tests/care-ui-polish.browser.spec.js` checks the real imported CSS cascade and Settings palette declarations at 320, 390, 412 and 1440px in both themes. Profile fields come from the production intake renderer; the link form and review come from the production Care templates. It checks readonly density, editable field sizing, wrapping, hidden states, keyboard focus, initial disabled controls, all five accent styles, action/label contrast and save-status contrast. Compatibility transitions are disabled in this isolated fixture to measure settled colours. No backend calls are made.

The actual-runtime `care-mobile-hierarchy.browser.spec.js` additionally verifies entering and discarding edits, saved-value retention, Save visibility, readable control sizing and Save contrast. Its fixture blocks mutations and supplies synthetic reads. Local Chromium and WebKit checks use an explicitly started server for this worktree because managed Python server shutdown can hang on Windows.

Manual checks are still required on physical iPhone and Samsung Fold4 devices, especially the keyboard-open viewport. Automated browser emulation does not verify those devices or live backend writes. No Apps Script changes or deployment are required.

Next UI stories: see `next-care-ui-backlog.md`.
