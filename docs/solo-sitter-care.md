# Solo sitter Care

Release 2026.10.26.02. Six Care-only refinements build on Care at a glance. Calendar and Today layout code is unchanged; shared asset revisions advance for consistent caching. No backend, schema or additional startup data reads.

## Deliverables and priority

| Enhancement | Expected frequency and benefit | Effort | Validation |
| --- | --- | --- | --- |
| Compact Guests return | Daily: reach the roster without a large empty panel | Small | Back remains a visible 44px target clear of header/footer |
| Quiet saved-record status | Daily: give care instructions more visual space | Small | Saved status is inline; offline/error/identity warnings stay prominent |
| One empty routine prompt | During incomplete onboarding: reduce repeated filler | Small | Only confirmed saved empty routine collapses; partial, error and unknown states remain distinct |
| Update handover beside note | Daily/as needed: edit without opening More tools | Small | Correct dog/stay editor opens, preserves drafts and closes safely |
| Emergency details beside Safety | Occasional but urgent: reach Health & Home directly | Small | Opens read-only, remains idempotently expanded, does not fetch history or enter edit mode |
| Copy sitter summary | As needed: hand over saved instructions explicitly | Medium | Copy selected saved identity/routine/full safety, medication and note only on tap; failure has manual fallback |

Frequency and effort are estimates; no time saving is claimed without measurement. Priority is daily readability and urgent access, followed by optional summary copying. No new icons are introduced.

## Testing matrix

1. Open Care on 320px, 390px and 1440px in light/dark themes. Check the Back target, compact status, labels and action wrapping. Scroll each action into view and verify it is unobstructed by navigation.
2. Expand saved-record Details with keyboard. Confirm its full source information remains accessible. Simulate offline, error and identity-warning states: warnings must stay visible and never imply reviewed care.
3. Load a validated saved profile with no feeding or walk values: one prompt shows with Edit routine. Add any saved routine value and re-render: the relevant normal rows return. Failed, missing, loading or ambiguous records must not be treated as confirmed empty.
4. Select Update handover from the note heading. Confirm the correct name/stay and current note. Decline the discard confirmation and verify the unsaved note remains open; accept discard and reopen to verify the saved baseline. Save failures retain the existing recoverable draft. No save occurs without explicit confirmation.
5. Select Emergency details while More tools is closed. Health & Home opens read-only. Repeat the action: it remains open. Missing contacts remain unknown; do not create a phone number or infer care readiness.
6. Select Copy sitter summary in More tools. Verify Dog ID, exact stay dates, saved source warning, full instructions and full long handover. Do not include editable drafts, separate owner-contact or care-link fields, or other guests.
7. Block/reject clipboard access. Show selectable read-only manual text and truthful failure feedback. Switch dog, change identity/dates/care, or enter edit mode during a delayed copy: stale feedback/manual text must not survive. Repeated clicks must not duplicate copying.
8. Confirm opening and copying add no profile/history reads or backend writes. Verify Calendar/Today layout content matches the base and that their runtime does not load the new Care-only script.

Automated checks use synthetic records and block production mutations. Emulation does not certify every physical phone. Publication must be attributed to the exact merge commit before reporting the release live.

## Operating notes

The summary is saved care guidance, not a log that food, medication or walks were completed. Copy is explicit and does not send a message. More tools keeps this occasional action secondary. Clipboard failure leaves a manual copy path. Safety and medication remain visible and complete.

## Next backlog item

Observe a solo sitter performing arrival, routine lookup, owner contact and checkout on a physical phone. Prioritize measured hesitation or extra steps before adding another control.
