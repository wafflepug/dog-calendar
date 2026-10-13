# Task Completion Report â€” Care Profile Clarity and Feedback

## Built Deliverables

- Past cards retain Dog IDs and show recorded checkout dates in the spreadsheet timezone, or explicitly labelled scheduled checkout when no actual date is recorded.
- Repeat histories consolidate only for a proven Dog ID; same-name pets with different or missing IDs remain separate. Ambiguous operation evidence fails closed.
- Selected Care profiles use one identity header, a flatter Care essentials summary, prominent stay actions and purpose-labelled secondary controls. Long instructions remain readable.
- Operation and Master Profile failures use accessible inline messages. Explicit transport retries retain the selected stay and draft; offline and identity conflicts do not offer blind retries. Success announcements are polite.
- Arriving already uses one card per booking with identity, dates and alerts. Retained and regression-checked this implementation rather than adding another rendering layer.

## Testing Matrix

| Journey | Happy path | Edge case | Failure mode |
|---|---|---|---|
| Past | Search Dog ID and open the recorded checkout stay | Same names with different IDs; same dog across several stays; Sydney date boundary | Conflicting or duplicated operation IDs must not assign another stayâ€™s status |
| Profile | Read photo, identity, dates, care essentials and primary actions | 320px, desktop, both themes, long instructions, keyboard focus | A failed profile read retains clear retry/loading distinctions |
| Actions | Check in/out once; review success message | Cards refreshed during a pending request; repeated explicit retry | Offline sends nothing; collision offers review guidance; late response never paints another pet |
| Early checkout | Review selected pet and preserve booked dates | Retry preserves optional checkout note | Failed save leaves the modal and note intact |
| Arriving | One card per dated booking | One dog with multiple future stays; equal names with distinct IDs | Lazy profile read fails visibly without duplicating list rows |

Automated runs use synthetic records and block production writes. Actual iPhone/Fold hardware, operating-system text scaling, keyboards and screen readers remain unverified; see docs/care-physical-device-acceptance.md.

## Next Backlog Item

Remove the automatic Care startup photo-sync mutation from waffle-v11.2.14.js after tracing its explicit booking inheritance path. Opening Care should perform reads only; retain intentional photo inheritance for the selected Dog ID. Then validate optional Care identity enrollment on the isolated test spreadsheet with production enrollment left disabled.

Local validation: all 276 Node cases passed; all 33 unique focused browser cases passed across the hierarchy, roster and Past suites. Targeted reruns corrected stale disclosure expectations, keyboard focus modality, and asynchronous background-read assertions without weakening lazy detail-read checks. JavaScript syntax and Git whitespace checks passed.

Repository checks and deployment attribution are pending the reviewed commit publication.
