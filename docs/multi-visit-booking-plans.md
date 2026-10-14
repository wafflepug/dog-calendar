# Multi-visit booking plans

Candidate release 2026.10.14.05: Multi-Visit Booking Plans. Existing Waffle House backend and data remain unchanged.

## User flow

Open Add > Multiple visits, or Sitter Tools > Booking > Plan multiple visits. Find a returning dog using the exact Dog ID, or explicitly choose New dog. Review saved care where available, then Add dog. Repeat for other dogs in the household. Enter shared owner contact once. Add one or more independent date ranges. For repeated single-day care, choose Same-day visits and add individual dates or a weekly pattern with an end date. Review every individual dog/date row, check combined capacity warnings, then confirm.

Each dog/date row creates its own confirmed stay with a unique Stay ID. A returning dog's permanent Dog ID is retained; a new dog's first acknowledged ID is reused for subsequent visits. The generated visits are ordinary independent bookings, editable or cancellable through existing stay controls. A later calendar change does not modify the whole original weekly pattern.

## Safety and practical bounds

The first version permits up to 5 dog profiles, 12 date sets and 30 confirmed stay records per plan. Weekly generation requires an end date; each range is bounded to 90 days. Dates must be valid and planned ranges cannot overlap. Existing exact-name/date collisions and exact-Dog-ID overlaps are rejected before confirmation. Combined daily capacity is advisory and counts all dogs, including legacy combined profiles and long existing stays. Existing combined profiles are preserved as supplied; they are not automatically split into new Dog IDs. Same-day visits use the existing daily boarding capacity rules; separate drop-off hours, daytime capacity and distinct backend service categories are future work.

The legacy Care stay key still includes name and dates, so two different dogs with the same name cannot safely be confirmed for identical dates in one plan. No automatic renaming or identity merging is used. A backend identity migration is needed to remove this limitation.

Saves are sequential and are not an atomic transaction. Already saved visits remain saved after a later failure. Retry preserves original Stay ID and client mutation ID and skips acknowledged rows. Queued/unknown responses pause the plan and never count as saved; a new dog cannot advance until its permanent ID is acknowledged. Source/profile snapshots are fixed once saving begins. Plan editing and clearing are blocked for unresolved writes; ordinary single-booking workflows remain available while the plan is paused. The current plan is retained in this open page, not an owner account or a permanent booking-group record.

## Verification matrix

1. Returning dog: select the exact ID and add 8–10 December and 15–20 December. Review and confirm two independent stays; both retain the Dog ID and have distinct Stay IDs.
2. Household: add two different dogs and those same two date ranges. Verify four stays, shared owner contact, separate Dog IDs/care details, and capacity increased by two on the requested days.
3. Weekly same-day visits: generate three weekly dates with an end date. Review all three; each start equals end, dates are seven days apart and no open-ended series is created.
4. New dog: delay first acknowledgement. Verify only one write occurs before a valid Dog ID is returned; later visits reuse that ID.
5. Partial failure: acknowledge row one, fail row two, then resume. Verify row one is skipped, row two uses the same mutation/Stay IDs and every row has accurate status.
6. Queued save: verify no success claim or next visit, preserve submitted input and stable retry IDs, retain the plan after modal close/reopen, and allow unrelated single bookings while paused.
7. Failure/edge states: duplicate names, overlapping dates, invalid/leap dates, missing contacts/identity, stale reviewed care, wrong response identity, capacity warnings and rapid double confirmation must fail safely without extra writes.
8. Layout: 320/390/1440px, light/dark, enlarged text and keyboard navigation. Labels/statuses wrap; interactive targets remain 44px; long rows and links do not overflow. Existing single booking, Book Again and owner-link workflows retain their current behaviour.

Automated tests use synthetic records and mocked writes; production checks are read-only. Physical-device acceptance remains for the owner.

## Next iteration

A server-side household/group booking API with strict Dog-ID/Stay-ID linking would permit same-name dogs on identical dates and support a persistent group summary. A separate day-care service type with hours and daytime capacity would follow that identity-safe foundation. Compact Dog record maintenance remains in the Care UI backlog.
