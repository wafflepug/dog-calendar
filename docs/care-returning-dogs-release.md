# Returning dogs and Care refinement

This iteration covers the owner's eight requested backlog items. Dog ID identifies
the dog; Stay ID identifies one booking. Names, owner labels and dates are evidence,
not replacements for those identifiers.

## Acceptance matrix

| Item | Required behavior | Verification |
| --- | --- | --- |
| 1. Returning-dog recognition | Suggest evidenced existing identities, require exact selection, keep same-name candidates distinct | Name-only, matching owner/breed, ambiguous candidates, failed identity read |
| 2. Inherited care review | Display dated instructions with readable controls; apply only explicitly reviewed fields | Missing profile, changed instructions, stale selected dog, unconfirmed save |
| 3. Photo inheritance | Reuse exact Dog ID photo references; preserve usable booking photos | Renamed dog, same-name dogs, missing photos, existing photo |
| 4. Care overview | Essential instructions, alerts and contact remain accessible with concise hierarchy | Missing/long instructions, loading/error, keyboard navigation |
| 5. Care cards | Consistent legible typography, photos and badges across themes and widths | Small phone, Fold-width, desktop, long names and multiple flags |
| 6. Booking identity | Dates can change while exact booking identity persists; legacy ambiguity fails closed | Edits, confirmation, legacy source and conflicting owners |
| 7. Retry protection | One save intent retains its mutation/Stay IDs after uncertain failure | Lost response, repeated Save, changed input and receipt conflict |
| 8. Stay history | Chronological visits distinguish verified actual checkout from scheduled dates | Early checkout, missing operation, ambiguous legacy status, dated care provenance |

Production schema backfill is an explicit operator action, never a side effect of
opening Care or reading history. Local fixtures establish behavior; physical iPhone
and Samsung Fold checks remain separate from browser emulation.

## Care overview and history validation

The focused Playwright fixture covers 390 px phone, 412 px Fold-width, 768 px
tablet and 1440 px desktop layouts in light and dark themes. It exercises Care
category rendering, dog photo sizing, Dog ID and stay-status badge wrapping, and
history rendering for scheduled dates, a verified early checkout, original planned
checkout, and timestamped care-record provenance. Browser screenshots are saved in
[`evidence/care-overview`](../evidence/care-overview/). Physical iPhone and Samsung
Fold devices have not been tested.

## Local completion checks

- All 188 Node tests passed, including actual backend history and reviewed-care
  fixtures, form-row enrollment, durable receipts and photo ownership.
- All five returning-booking browser tests passed at 390 px with production
  modal styles: explicit selection, editable review, preserved handoff details,
  stale-response isolation and potential-booking retry identity.
- Care overview fixtures passed desktop Chromium, phone Chromium and iPhone
  WebKit; computed-style assertions use explicit values across browser engines.
- JavaScript syntax, Care Future Stays, UI stability and diff checks passed.

## Release verification matrix

1. Enter a returning dog's name and owner/breed. Confirm suggestions appear but
   no Dog ID is selected automatically; same-name dogs remain distinct.
2. Choose the exact Dog ID, edit a saved care value and confirm the dated review.
   Create the stay. Repeat without confirming: no care fields should be inherited.
3. Verify an existing usable stay photo wins; otherwise the selected dog's photo
   reference is reused. A different same-name dog's image must never appear.
4. Interrupt a confirmed or potential save, then retry without changing fields.
   Expect one booking and the same Stay ID. Changed details form a fresh intent.
5. Open Care in light and dark modes on phone and desktop. Check readable badges,
   wrapping names, essential instructions and independently collapsible details.
6. Inspect a verified early checkout: history must show the actual checkout and
   distinguish the originally scheduled end. Blank care plus default false flags
   must not replace older instructions or imply a completed care assessment.

Next backlog item: unify Care search and later-arrival access without loading
every future profile when the roster first opens.
