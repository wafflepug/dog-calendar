# Fewer clicks in Care — 2026.10.25

## Delivered behavior

The existing checkout sheet can review missing medication and belongings through the existing shared readers. It keeps the current note editable during loading, applies only records verified for the same dog and stay, and keeps cancellation and explicit checkout confirmation. It distinguishes missing records from confirmed care instructions. Failed reads can be retried in the sheet; opening it does not start these reads.

Arrival review reuses the existing guarded Check In control near the reviewed profile content. It does not create another check-in operation or automatically check in a dog. Future, past, changed and conflicting stays retain their restrictions.

The first-level owner action becomes **Copy care link** only when the already prepared link belongs to the exact current dog and stay. It uses loaded data without a startup fetch. **Owner sharing options** remains in More tools for the original preparation, review and sharing flow. Copying does not send a message. Blocked clipboard access provides a manual field; changing the selected identity or link clears obsolete fields.

**Routine, owner & handover** remains collapsed by default. Opening it shows the complete feeding, walking, owner and handover information without a second disclosure. Safety and medication remain visible independently.

## Navigation comparison

| Task | Previous interaction | Current interaction |
| --- | --- | --- |
| Missing checkout details | Leave the checkout sheet for Care, then reopen checkout | Review missing details inside the sheet |
| Check in after arrival review | Return or scroll to the operational action | Use the same guarded action beside the review |
| Copy a prepared owner link | Open sharing, then choose Copy | Copy directly; other sharing choices stay in More tools |
| Read supporting routine or a long handover note | Open the outer disclosure and then the relevant inner disclosure | Open the outer disclosure once |

These are interaction changes, not measured customer time savings.

## Testing matrix

| Journey | Happy path | Edge and failure verification |
| --- | --- | --- |
| Checkout review | Open checkout with missing evidence, type a note, choose Review missing details; verify the exact saved medication and belongings without leaving the sheet | Edit the note while loading; reject stale, offline or conflicting results; cancel and reopen; retry failed reads; verify no checkout until Confirm |
| Arrival | Open the existing arrival care review; verify one Check In control for the selected current stay | Check future/past stays, identity replacement, duplicate identity, pending operations and profile close; no operation occurs on review alone |
| Owner link | Open a profile with a prepared current link; Copy care link; paste into a test editor | Block clipboard access, retry, replace the link or selected stay during copying; old manual fields disappear; legacy preparation and native Share remain reachable |
| Supporting details | Expand Routine, owner & handover once; read full feeding, walking, owner and handover values | Long notes, blank values, repeated rendering, light/dark themes, keyboard focus and no additional reads |
| Phone layout | Check 320px and 390px portrait and 1440px desktop | No horizontal overflow, wrapping labels, at least 44px controls, modal content and confirmation clear of navigation footer |

Use synthetic fixtures for automated checks. Production smoke checks must remain read-only. Browser emulation does not certify physical phones or screen readers.

## Next backlog item

Measure arrival, owner-link sharing and departure with a sitter on a physical phone. Refine labels or placement based on observed friction before adding more controls.
