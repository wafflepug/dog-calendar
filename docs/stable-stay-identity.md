# Stable stay identity and durable booking receipts

This rollout adds a booking UUID that is distinct from Dog ID, Dog Number, and
the legacy dog/date `stayKey`. The legacy key remains the key for belongings,
intake links, photos, and Care profiles; this work does not change those key
formats. A booking keeps its Stay ID when its dates or details change, and a
potential booking keeps that ID when it is confirmed.

## Sheet fields and reads

The booking sheet gains two header-discovered columns at its right edge:

| Field | Purpose |
| --- | --- |
| `Stay ID` | UUID for one physical boarding or potential booking row |
| `Last Stay Mutation ID` | Marker that proves which durable queued mutation last changed that row |

Dog ID remains the identity of the dog and is not repurposed. Existing A:L
booking fields and existing Dog ID/Dog Number columns are left in place. The
current, past, and potential booking reads include `stayId` when the column
exists; old sheets without the new headers continue to read without a write.
`get_data_versions.versions.stableStayIdentityVersion` advertises protocol
version 1. Reads and deployment never run a migration.

The explicit `backfill_stay_ids` action is repeatable and runs under the Apps
Script lock. It appends missing headers, validates existing IDs for UUID shape
and case-insensitive uniqueness, preflights boarding/potential row dates, then
assigns IDs only to confirmed Boarding and Potential Stay rows. It skips Meet &
Greet rows. It does not merge duplicate historical rows, choose an owner for
ambiguous data, or use a row number as an ID. Any malformed date or duplicate
existing ID stops the operation before row assignments begin. Successful
backfill invalidates directory and calendar data versions. A production
operator must explicitly invoke this action after taking a sheet backup.

## Mutation receipts and recovery

The persistent `Stay_Mutation_Receipts` sheet stores the client mutation ID,
action, SHA-256 digest of the canonical request, state, reserved Stay ID, exact
successful response JSON, and timestamps. Receipts are retained rather than
pruned after 100 entries. A repeated mutation ID with different request content
is rejected. A retained ID from the old timestamp-only ScriptProperties
receipt table is rejected because the former table cannot reproduce its
response. Mutation IDs are bounded and restricted to safe characters.

The booking receipt wrapper owns the ScriptLock across lookup, reservation,
primary row mutation, and receipt completion. The inner processor skips only
that same execution's lock when the private server flag is set, so the lock is
not acquired twice. Direct legacy confirmed-delete calls also take the lock.
Reads remain lock-free.

Creates reserve a client-supplied Stay ID before processing and append the
booking, Stay ID, client mutation marker, and (for boarding) Dog ID in one row
write. Reusing a UUID found on a booking row or any prior receipt, including a
deleted stay, is rejected. Date/detail updates write the row and mutation
marker in one range update. Potential-to-confirm changes the same row and
retains its Stay ID. Delete resolves by Stay ID first; a legacy name/date
request is accepted only when it has one safe candidate. No row number breaks
a tie.

If a request is interrupted after its primary row write, a retry checks the
mutation marker on the exact Stay ID and verifies the expected primary fields.
Date-update recovery retries the existing belongings/intake key migration from
the before/after key plan. A failed or changed marker, an incomplete request,
or a reused ID conflicts and is never blindly replayed. Delete reservations
persist the deletion response before deleting the exact row; absence of that
reserved Stay ID can then finalize that same deletion receipt. A later duplicate
returns the stored response and cannot recreate the row.

The booking row and receipt sheet are separate Google Sheets writes, so they
are not a single database transaction. The row marker and pending receipt make
the primary write recoverable. Secondary effects such as intake-link creation,
profile copying, Dog Number assignment, and audit logging do not yet have
individual receipts. A create recovered after append returns
`followUpNeeded: true`; this means the booking is saved but those side effects
may need review. A date update remains pending if its legacy-key migration
cannot be verified. No response should describe these cross-sheet/Drive effects
as atomic.

## Compatibility and rollout

Confirmed-stay deletion is online-only. It receives a durable retry receipt,
but a failed connection does not return a queued success or remove the profile.
Other existing queued booking actions retain their original receipt and Stay ID.
Queued conflicts can be reviewed from the desktop or mobile sidebar Tools.

Published CSV rows without a Stay ID remain conservative: date edits suppress
only a unique old row with matching dog/owner proof. A legacy deletion can
remain visible in an old CSV snapshot until publication catches up; UUID
tombstones suppress later snapshots carrying the assigned ID.

Deploy the Apps Script backend before the frontend that advertises protocol
version 1. That frontend checks the capability before sending supported queued
booking mutations and creates its Stay UUID and client mutation ID before
online submission or offline enqueue. Existing offline queue entries without a
Stay UUID/protocol marker are surfaced as conflicts rather than guessed or
silently replayed. A currently retained legacy timestamp receipt also produces
a conflict; a pruned legacy timestamp cannot prove whether an old write
committed, which is why old queued creates without a Stay UUID are not
auto-replayed.

Old read clients can still read sheets without the new columns. Direct legacy
web creates without a client mutation ID may receive a generated Stay ID, but
those direct calls do not have a retry receipt guarantee. Legacy update/delete
fallbacks require unique name/date evidence and fail closed when ambiguous.
External Google Form submissions and `onFormSubmit`/`save_intake` paths are not
assigned Stay IDs by this web-app integration; they need a separately reviewed
trigger integration or later explicit backfill. IDs are not automatically
assigned to historical records on reads.

`Stay_Operations` remains keyed by legacy `stayKey` in this slice. Existing
operation rows are not migrated or assigned to an owner. Unique historical
early checkout behavior remains on the existing reader; ambiguous legacy
operations stay quarantined under the current collision policy. Moving
operation records to Stay ID needs a separate migration with ambiguity and
rollback handling. Care/media/profile keys also remain unchanged.

The deploy workflow pushes to Apps Script and creates a live deployment when
the matching source reaches `main`; it verifies protocol version 1 through a
read-only live request. Production backfill is an explicit separate operation.

## Verification fixtures

`tests/stable-stay-backend.test.js` executes the actual receipt wrapper, actual
create and date handlers, the core action dispatcher, and the confirmed-delete
override against a Sheets/LockService fixture. It covers committed-create
recovery after an intake failure, date-key migration recovery, exact replay,
payload mismatch, unknown pending writes, retained legacy receipts, Stay ID
reuse/collision, same-name/date owner separation, potential confirmation,
deletion, lock ownership/rejection, >100 durable receipts, appended headers,
repeatable explicit backfill, malformed IDs, and formula preservation during
atomic row updates.
