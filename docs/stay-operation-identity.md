# Stay ID operations

Check-in, checkout, and owner-requested early checkout now use the confirmed
booking's Stay ID when a client supplies it. The backend validates the UUID,
requires exactly one confirmed booking with that ID, and checks the supplied
dog and booked dates. A malformed, duplicated, or missing UUID never falls
back to a name/date lookup. Older requests without a Stay ID are accepted only
when the complete confirmed-booking inventory proves one unique Stay Key owner.

`Stay_Operations` keeps its existing fifteen fields in place. The writer
appends a `Stay ID` header after all existing and unknown columns, then writes
the UUID into that indexed field. Reads do not add this new field. Existing
Stay Key values and formats remain unchanged for Care, belongings, intake,
photos, and profile links.

Operation reads resolve UUID rows to their exact confirmed booking. Legacy rows
without a UUID can be associated only when both the full booking inventory and
the operation row establish one unambiguous owner. The unique historical
Ralph-style early checkout remains active. Shared-key or otherwise unresolved
rows are returned with `identityConflict: true` and a reason such as
`ambiguous_legacy_stay`, `invalid_stay_id`, `duplicate_stay_id`, or
`missing_booking`; these records are not assigned to a dog by row order or
name. Both filtered and unfiltered reads use the full inventory before
filtering, and filtered UUID reads retain related quarantine evidence.

Before a confirmed booking date edit, the backend binds a legacy operation row
to the booking's existing or newly assigned Stay ID only when the old key has
one confirmed owner and exactly one untagged operation row. This preserves
operation ownership when booked dates change. Ambiguous rows are left as they
are. Date edits and confirmed deletion pause when they would make an ambiguous
legacy status appear uniquely owned by the remaining stay. Unique legacy
operations are also bound before deletion, so the orphaned record stays
quarantined instead of being reused for another booking. Early-checkout
`Original End Date` and `Actual Checkout Date` remain
separate from the edited booking schedule.

The normal check-in and checkout paths run inside the existing ScriptLock. The
status writer owns the lock for direct calls, including early checkout, and
reuses an outer operation lock when one is already held. Operation actions are
online-only. They do not return queued success or claim exactly-once receipts;
retries preserve a recorded checkout timestamp and early-checkout details.
Audit logging remains a secondary effect: if it fails after the operation row
is saved, the response reports `followUpNeeded` and the saved operation.

`get_data_versions.versions.stayOperationIdentityVersion` advertises version
1. Pages and Apps Script deploy independently; the client checks the live
capability before each operation write and refuses the write while the new
backend is not ready. No production backfill
or booking mutation is part of this rollout. Historical ambiguous operations
remain quarantined for a separately reviewed migration.
