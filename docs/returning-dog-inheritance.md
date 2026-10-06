# Returning-dog identity and care inheritance

Booking suggestions require an exact dog-name match plus at least one independent breed, owner, or phone signal. Suggestions remain advisory: the sitter chooses the exact Dog ID explicitly, and no equal-score or name-only match is selected automatically.

Selecting an identity loads that UUID's care history. The review uses only `latestCompletedProfile` from a completed earlier stay; a future/current profile does not outrank prior completed care. The sitter sees dated, labelled fields with familiar text/select controls. Missing fields stay unrecorded, and applying anything requires an explicit checkbox. New stay dates, notes, owner/contact, photos, and other stay-specific values remain separate.

The browser sends only the reviewed care values with source Dog ID, stay key, end date, and stable stay ID when available. The Apps Script handler must re-check the exact UUID and source stay on every write, reject stale/ambiguous sources before appending, and merge only populated reviewed values. A legacy source without stable stay ID is eligible only when the backend resolves one unique stay under the selected UUID and the same key/date.

Photo inheritance resolves historic source stays by Dog ID. Legacy photo fallback requires a single corroborated unlinked booking (dog, breed, owner, phone) and rejects shared stay keys. A usable photo already on the destination stay is preserved.

Local contract checks: `node --test tests/dog-care-inheritance.test.js tests/dog-id-ui.test.js tests/dog-id-backend.test.js`. The photo fixture uses duplicate stay keys under two UUIDs to prove that name/key equality cannot leak another dog's image.