# Returning-dog identity and care inheritance

Booking suggestions require an exact dog-name match plus at least one independent breed, owner, or phone signal. Suggestions remain advisory: the sitter chooses the exact Dog ID explicitly, and no equal-score or name-only match is selected automatically.

Returning-care reuse is already covered by `tests/returning-dog-inheritance.spec.js`: two same-name, same-breed Lunas remain separate options; identity selection is blank until the sitter chooses a Dog ID; the selected UUID loads that dog's completed history; the review shows dated source context and editable fields; future/current profile data is excluded; unchecked inheritance is omitted; and changed dog names clear the chosen identity. Booking and owner handoffs carry entered dates and contact forward while requiring the exact identity check before saving. These controls provide the onboarding path; no duplicate reuse control is needed.

Selecting an identity loads that UUID's care history. The review uses only `latestCompletedProfile` from a completed earlier stay; a future/current profile does not outrank prior completed care. The sitter sees dated, labelled fields with familiar text/select controls. Missing fields stay unrecorded, and applying anything requires an explicit checkbox. New stay dates, notes, owner/contact, photos, and other stay-specific values remain separate.

The browser sends only the reviewed care values with source Dog ID, stay key, end date, and stable stay ID when available. The Apps Script handler must re-check the exact UUID and source stay on every write, reject stale/ambiguous sources before appending, and merge only populated reviewed values. A legacy source without stable stay ID is eligible only when the backend resolves one unique stay under the selected UUID and the same key/date.

Photo inheritance resolves historic source stays by Dog ID. Legacy photo fallback requires a single corroborated unlinked booking (dog, breed, owner, phone) and rejects shared stay keys. A usable photo already on the destination stay is preserved.

Local contract checks: `node --test tests/dog-care-inheritance.test.js tests/dog-id-ui.test.js tests/dog-id-backend.test.js`. The photo fixture uses duplicate stay keys under two UUIDs to prove that name/key equality cannot leak another dog's image.