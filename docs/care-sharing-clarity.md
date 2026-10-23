# Care sharing clarity — 2026.10.24.01

## Built deliverables

1. **One primary step in the owner dialog.** Before preparation, use Prepare owner message. Once a valid link is ready, that control is hidden and Copy owner care link becomes the primary action. The complete message stays in More options. Editing the dog, phone or dates removes the old result and restores preparation. Invalid returned links leave the action available for an explicit retry.
2. **Fewer duplicate sharing controls.** Compact handoffs show the dog and dates once, a concise status, and one link-copy action. More options retains Copy message and native Share where available. It no longer repeats Copy link or exposes the raw link just because the options were expanded.
3. **Recoverable clipboard feedback.** A failed link copy reveals the selectable link field. A successful retry hides it again. Repeated clicks cannot start concurrent copies. Late responses from a replaced handoff cannot update another dog's card or move focus there. Moving to another control while copying preserves that focus.

The full message helper remains available to its existing callers. Sharing remains explicit: copying or closing the share sheet is not proof that a message was sent. No new backend reads, background polling, messages, subscription or deployment is required for these UI changes.

## Testing matrix

| Journey | Happy path | Edge and failure checks |
| --- | --- | --- |
| Prepare a form | Open the selected guest's owner action; prepare once; verify the dog and dates; copy the link | Exactly one visible primary action before and after preparation; no history read; unchanged preparation uses its existing cache |
| Change context | Expand Review stay details and change the end date | Old handoff is removed; Prepare returns; no stale result or token from another stay appears |
| Preparation fails | Correct the problem and retry explicitly | Missing dates, ambiguous Dog IDs, rejected requests and invalid returned URLs leave preparation usable; no success message is invented |
| Clipboard | Copy and paste into the owner's usual chat | With clipboard blocked, manually copy the selected link; retry successfully and verify the fallback closes; rapid clicks issue one clipboard request |
| Focus | Retry from the fallback, then navigate with keyboard | Pending success or rejection cannot steal focus after moving elsewhere; switching dogs prevents stale focus and status changes |
| Native share | Open More options and choose Share | Cancel safely; the UI never claims delivery; unsupported sharing leaves copy actions usable |
| Responsive layout | Review at 320px, 390px and desktop, light/dark and enlarged text | Link/message wraps within the dialog; visible controls remain reachable and at least 44px; fixed navigation does not cover them |

Tests use synthetic identity and link fixtures. Production smoke checks must remain read-only. Physical phones and assistive technologies still need an operator review.

Verification: 375 Node tests and five Python contracts passed. The owner/boarding/sharing matrix passed 60 cases in Chromium and WebKit at 390px, including viewport, theme and enlarged-text checks inside the layout tests. The booking-to-sharing integration passed all 12 cases across both engines. The focused helper checks also passed 14 Chromium cases at 320/390px and seven WebKit cases at 390px. Safari's body-active click behavior and the boarding flow's hidden-field compatibility were corrected before the final passing matrix. Full current-head CI remains required before publication.

## Next backlog item

Make owner-form validation errors point to the relevant field. Keep the current single owner-link entry point and identity guards. Show a concise inline explanation, open Review stay details only when correction is required, and focus the first invalid field after the explicit Prepare action. Do not auto-submit, generate a link on open, or fetch guest history.

Implementation notes: [Owner sharing helper](owner-sharing-helper.md). The prior release's stale copy/unknown-evidence integration expectations were corrected separately in PR #247; its full current-head CI remains a prerequisite for publication.
