# Care daily efficiency

Release 2026.10.28.09. Ten improvements reuse existing Care controls and loaded records. No additional backend reads or Apps Script deployment.

## Built deliverables

1. Distinguish an empty Today's work filter from an empty guest roster, with a direct clear-filter action.
2. Put Clear search beside the empty list, preserving the current tab and work filter.
3. Offer one explicit Clear search and filter action when both exclude every guest.
4. Escape clears a focused nonempty roster search without changing tabs, work filters or open profile drafts; composition is protected.
5. Put supported native Share beside Copy owner care link in compact handoff; full message remains under More options.
6. Return keyboard focus after native Share only while that handoff remains current and the user has not moved away.
7. Lock all full-message copy/share actions together while pending, with truthful feedback and safe retry.
8. Keep manual care-link copying available after clipboard failure without stealing focus from another task.
9. Identify the next arrival by name and a valid human-readable Dog ID; the label and keyboard destination agree.
10. Exclude pending, disabled or hidden check-in controls from the next-arrival shortcut and update when eligibility changes.

## Testing matrix

| Case | Steps | Expected |
| --- | --- | --- |
| Work filter empty | Choose a work filter with no visible guests | Filter-specific message; clear only the work filter |
| Search empty | Search an absent dog/owner/ID | Near-list recovery; clear only query; preserve range/tab |
| Combined empty | Apply work filter plus unmatched query | One deliberate reset for both |
| Keyboard | Escape in search; repeat during IME or with modifiers | Query-only clear for ordinary Escape; composition remains |
| Incomplete roster | Hold/fail loading; use offline saved data | No fabricated empty roster; saved-data caveat retained |
| Owner share | Use compact Share with More options closed | One native share request; truthful cancellation/completion feedback |
| Share return | Finish/cancel; alternatively move focus or replace host while pending | Restore only the original current action when appropriate |
| Delayed copy | Double press, switch context, then settle pending copy | One action; no stale message update or focus steal |
| Clipboard blocked | Fail copy, then manually select field | Current link remains accessible; other-task focus retained |
| Next arrival | Cycle same-name dogs with different IDs; filter/reorder | Label predicts exact eligible check-in target; no write |
| Pending check-in | Disable current target, then re-enable after failure | Count and next target update without polling or extra reads |
| Responsive | 320px, 390px, desktop, both themes and long names/URLs | Wrapped labels, 44px controls, no overlap/footer obstruction |

Synthetic fixtures block live guest writes and external messaging. Native share destinations, assistive technology and physical-phone viewport behavior require manual checks.

## Executed verification

412 Node fixtures and five Python contracts passed. Targeted browser coverage includes the real Care runtime at 320px, 390px and 1440px in Chromium/WebKit and both themes; loaded-data-only search/filter recovery; exact named arrival focus; pending/hidden check-in eligibility; owner copy/share cancellation and stale-action recovery; and cache/loader revision consistency. Full-runtime checks exposed a cold first-paint eligibility issue; the fix uses the existing first-paint-ready event and has its own regression. Ordinary search input events remain available to lazy arrival headings and range controls.

## Next backlog item

Review arrival handover and rebooking with a solo sitter before adding any further first-level controls.
