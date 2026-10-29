# Care arrival and owner handoff

Release 2026.10.29.05. Five refinements reuse existing controls and loaded records.

## Built deliverables

1. Compact owner sharing points an unavailable-share error to the visible Copy owner care link button. Full messages remain in More options; no automatic copy or sending occurs.
2. Successful compact care-link copying restores keyboard focus to its initiating button only when the control is still visible and the user has not moved on.
3. Full-message and link copying use the same guarded success-focus behavior, including the secondary Copy message control. Blocked clipboard recovery retains manual selection; a later user action takes priority.
4. Collapsed arrival care checks name Belongings explicitly, distinguishing unknown information from known zero or listed items. Full review remains available and no safety clearance is inferred.
5. Arrival review controls include the loaded owner and a valid public Dog Number in their accessible name when available. Internal IDs remain out of the user-facing labels; exact stay identity still guards activation.

These changes add no controls, profile reads, polling, automatic messages or backend changes. Today and Calendar layouts remain unchanged. Development uses Astra at the owner's request, followed by lead review.

## Sitter steps

- Open the owner sharing options and choose Copy owner care link, Share, or More options for the full message.
- If Share is unavailable, use the visible Copy owner care link button and paste into the owner's usual chat. Send it yourself.
- After copying with a keyboard, focus stays with the copy action unless you have chosen another task.
- Read Care checks as separate medication and belongings summaries. Unknown means unverified, and zero recorded items does not prove the guest is bringing nothing.
- When using assistive technology, confirm the dog, public Dog Number, owner and stay dates before reviewing arrival care.

## Testing matrix

| Case | Steps | Expected |
| --- | --- | --- |
| Share failure | Reject the compact native share request | Guidance names the visible copy control; no clipboard write or message sent |
| Share cancellation | Cancel the share sheet | Cancellation stays truthful; existing copy/share actions recover |
| Successful copy | Copy compact link, secondary message, full message and full link | Exact content copied once; originating visible control regains focus without scrolling |
| Changed user intent | Move focus, type, point elsewhere or close options while copy is pending | Late completion does not steal focus or reopen a disclosure |
| Removed/hidden result | Hide or replace the result before copy completes | No hidden or detached control is focused |
| Clipboard blocked | Reject clipboard access | Existing manual-copy field remains available and selected only when appropriate |
| Arrival evidence | Show unknown, fresh zero, one and multiple belongings records | Explicit Belongings summary; no invented readiness or new profile request |
| Same-name guests | Use matching names/dates and distinct loaded owners/public numbers | Review labels distinguish available context; internal UUIDs are omitted |
| Reused guest row | Change identity before activating a retained arrival review control | Existing stale-identity gate blocks the action |
| Layout | Use 320px, 390px and desktop, light/dark and enlarged text | Existing controls remain readable, reachable and free of horizontal overflow |

Automated fixtures block production writes. Real phone dialing, native share sheets, keyboards and screen readers require physical-device checks. Browser emulation does not establish device performance.

## Next backlog item

Audit full future-arrival date context and deferred-arrival recovery before adding more first-level controls.
