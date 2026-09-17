# Checkout collision safety

Checkout lookup keeps the existing `dog name + raw start date + raw end date`
stay key. It does not change media/profile keys or the backend sheet schema.

The calendar's confirmed events provide collision evidence before any
operational checkout shortens the display range. A key is **unambiguous** when
all proven source copies have the same normalized breed, owner and phone. A
key is a **known collision** when two confirmed events on the same raw dates
have conflicting complete identities; Care, calendar status readers and the
shared operational write guard quarantine it. A key with missing identity is
**incomplete evidence**. It is retained as evidence but does not freeze a
unique legacy stay, preserving historical behavior such as Ralph's checkout.

The evidence map is monotonic across ordinary event refreshes and is not
replaced by an empty or failed read. This is deliberate: the client cannot
prove that a cached CSV, a directory-scoped response, or a malformed/partial
parse represents the complete booking set. A future authoritative stable-ID
read can explicitly replace the evidence map; that backend prerequisite is
separate from this compatibility guard.

There is no active client mutation outbox in the current runtime. The
`queued` response branch is handled by the shared save function, so queued
responses cannot bypass the guard before they are returned. If a replay queue
is introduced, it must call the same guarded save path or carry an equivalent
collision check before sending `checkout_stay` or `early_checkout_stay`.
