# Confirmed stay optimistic reconciliation

When a fresh spreadsheet CSV read succeeds, the client removes a local confirmed
stay only if the CSV contains a boarding row with the same dog, raw booked dates,
breed, owner, and contact identity. It uses the existing
`v1105ConfirmedStayIdentity` policy. Missing or conflicting identity stays
visible as an optimistic item until stronger evidence is available. A malformed
or unavailable CSV does not alter the local confirmed, potential, Meet & Greet,
or pending-removal caches.

If the same otherwise-proven identity has multiple distinct persisted Dog IDs,
the optimistic copy stays until its own Dog ID matches a source row. A source
row without Dog ID cannot resolve that conflict. Dog IDs are carried from a
potential event into its local confirmed copy when present; Dog Number is never
used as identity evidence.

The CSV currently exposes a dog UUID and dog number, but neither identifies a
booking. Its edit link and parsed row index point to a sheet row and can change
when rows move. Local confirmation IDs use a timestamp. Consequently, this
frontend fix does not provide retry idempotency, reconcile a date-edited booking
by stable identity, or safely distinguish two otherwise identical bookings.
The V10.8 IndexedDB outbox assigns a `clientMutationId` to supported create,
confirm, and date-update actions, then replays them through the raw Apps Script
transport. This client does not verify that every Apps Script action deduplicates
that ID, so it cannot claim exactly-once booking creation after ambiguous network
failures. Check-in, checkout, and early-checkout actions are not queueable. A
stable stay ID still needs a separate backward-compatible rollout through
mutation receipts, authoritative reads, and old clients/offline entries. No
backend schema or mutation behavior is changed here.
