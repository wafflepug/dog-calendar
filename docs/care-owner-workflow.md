# Care owner workflow — 2026.10.23.06

## Built deliverables

Five small refinements build on the existing Care workflows:

1. Departure belongings use a collapsed count disclosure. Medication instructions and unavailable-evidence warnings remain visible. Confirmation and early checkout retain their existing safeguards.
2. Feeding and walking use compact disclosures with meal times, amounts, walk counts and durations visible in the summary. Safety and medication remain directly readable. Identical renders preserve open disclosures.
3. Book Again sits directly in More tools. It reuses the selected Dog ID and owner context, requests new dates, and retains explicit review before copying dated care information.
4. The existing owner-form action explains the next step using available intake evidence. Prepared links do not imply delivery; legacy care does not imply a current form was received.
5. Confirmed Care saves identify the shared record. Failed saves retain the draft; a confirmed save followed by a failed refresh offers a read-only retry. Device-only queued profile saves remain unconfirmed and cannot create a second intent from the same editor. A missing timestamp stays unknown.

No additional background profile reads, automatic owner messages, backend deployment or paid services are introduced. This candidate is not a claim of publication: current-head CI and deployment attribution must be verified before calling it live.

## Testing matrix

| Journey | Happy path | Edge or failure check |
| --- | --- | --- |
| Departure | Open checkout, expand belongings, review medication, confirm once | Missing evidence stays visible; cancel/reopen preserves the same stay; early checkout keeps its separate action |
| Daily Care | Read the routine summary and expand full details with keyboard or touch | Partial and unknown values remain distinct; long text wraps at 320px; unchanged refresh preserves the open disclosure |
| Returning guest | More tools → Book Again; verify Dog ID and owner; enter new dates | Same-name dogs retain exact identity; care copying requires explicit review; repeated preparation creates no duplicate controls |
| Owner forms | Inspect Not prepared, Link ready, Awaiting owner and Form received | Unknown/legacy care is not called complete; opening options neither sends a message nor adds a profile read |
| Saving | Edit, save, and check confirmed shared-record feedback | Rejected save retains the draft; failed refresh after a confirmed save retries reads only; another selected guest cannot receive the response |
| Offline profile save | Queue one change and return to the same guest | Pending Sync retains its mutation; the editor blocks a second intent. After checking the queue and shared details, reload Care before editing again. Queue disappearance alone never proves success |
| Responsive access | Check 320px, 390px and desktop in both themes | Disclosure targets and modal footer actions remain reachable and at least 44px; medication is never clipped |

Synthetic tests cover these states without writing production guest data. Browser emulation does not establish behavior on every physical phone or assistive technology.

## Next backlog item

Audit the owner sharing dialog for one clear primary action and fewer repeated instructions. Reuse the existing copy/share controls; preserve explicit sending, exact stay identity, keyboard focus and token privacy. Do not add polling or another owner-link entry point.

Supporting operator notes: [Departure completion](departure-completion.md), [Daily priorities and save feedback](care-daily-priorities-save.md), [Returning owner follow-up](returning-owner-followup.md).
