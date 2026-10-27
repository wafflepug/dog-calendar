# Sitter UI efficiency

Candidate release 2026.10.27.04. Six refinements to the existing Care roster and notification settings, with no new dashboard panel or backend change.

## Built deliverables

1. Keep the existing Clear search action beside the Care search field, visible only while a query is entered. Retain the full-width empty search and existing search announcements.
2. Reset an active Today's work filter without reopening its disclosure. Reuse the existing reset action, preserve search, and keep conflicting/unknown status warnings accurate.
3. Use Arrow keys, Home and End to navigate Staying, Arriving and Past from the keyboard. Keep one tab stop, the canonical selection handler, and lazy reads for requested views.
4. Separate notification permission from confirmed device enrollment. Show failed checks as unknown with explicit retry, preserving existing local enrollment and preference drafts.
5. Save only changed notification preferences, prevent duplicate submissions and retain edits after failure or late responses. A successful response confirms only the captured values.
6. Group notification setup, category choices and actions into a compact phone-friendly layout. Keep one state-appropriate primary action, readable wrapping and usable touch targets.

No new icons, speculative guest/profile reads, notification broadcasts, automatic permission prompts, Calendar layout changes or Today layout changes. Notification delivery continues to use the published one-day/two-day reminder backend.

## Testing matrix

1. At 320, 390 and 1440px in light and dark themes, enter and clear a Care search. Clear must fit beside the field, return focus to it, preserve the selected stay tab and restore results without another profile read. Empty search keeps its available width.
2. Select Arriving today or Leaving today, close Today's work, then reset the filter in one click. Keep the search text; restore all matching stays. Returning from a profile retains the intended roster state. Unknown/conflicting operations must remain qualified.
3. Focus the active stay tab. Use Left/Right, Home/End, Enter and normal Tab navigation. Verify selected state, focus and roving tabindex agree. Re-selecting the current tab must not cause redundant loading; future/past reads remain tied to an explicit selection.
4. Open notification Settings with a new device, enabled enrollment, denied permission, unsupported browser, missing configuration and failed device read. Do not claim enrollment from permission alone or on a read failure. Retry must be explicit and must not discard edits or trigger a test notification.
5. Change a category or device name and save. Keep one save in flight; unchanged preferences need no new save. Delay acknowledgement, edit again and fail a request: preserve current edits, report the correct captured save result and allow a deliberate retry.
6. Enlarge text and verify settings fields, category labels and primary/secondary actions wrap within the dialog at phone widths. All controls remain keyboard accessible and above the app footer. Test delivery remains an explicit user action; server acceptance must not be labelled confirmed phone display.

Synthetic browser tests use isolated data and block external writes. Emulated layout checks do not replace physical-phone validation or prove reductions in real sitter task time.

## Next backlog item

Observe one arrival, care lookup and departure on the sitter's actual phones. Record the remaining repeated touches and prioritise measured friction before adding controls. Use the existing device setup and test action to confirm native notification display separately on each enrolled phone.
