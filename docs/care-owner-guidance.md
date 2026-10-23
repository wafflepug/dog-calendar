# Care owner guidance — 2026.10.24.02

## Built deliverables

1. Owner-form preparation marks missing or invalid dog/date fields inline, opens Review stay details and focuses the first correction. Corrected fields lose their errors. Local validation runs before identity reads or link writes, and same-day stays remain valid.
2. Enter in an owner detail input uses the existing guarded Prepare action. Input-method composition, modifiers, textareas and other dialog controls do not trigger it. Opening or changing the form still does not submit anything.
3. A Care profile without a usable owner phone shows quiet **Phone unavailable** text. A valid phone restores the real Call owner link. The unavailable state no longer looks like a disabled button competing with useful actions.
4. Compact handoff copy and share actions share one pending state. Copying a link, copying a message or opening native Share temporarily blocks competing actions; failure/cancellation releases them. Manual-copy guidance preserves focus if the user has moved elsewhere.
5. Check Guest History shows progress, blocks repeat clicks and offers an explicit retry on failure. It retains the selected Dog ID and ignores results after the guest context changes. History remains an on-demand read.

No backend schema, paid dependency, automatic message, new polling or initial history read is introduced. These changes build on pending PR #248; current-head CI and deployment attribution must be verified before calling them live.

## Testing matrix

| Area | Happy path | Edge and failure checks |
| --- | --- | --- |
| Field guidance | Prepare a valid same-day or overnight form | Empty dog/dates and reversed dates show associated errors; focus goes to the first invalid field; no read/write occurs until local input is valid |
| Keyboard | Press Enter in a valid owner input | Repeated Enter creates one in-flight intent; composition/modifiers and unrelated controls do nothing; changing context clears stale errors |
| Owner contact | Tap Call owner when a valid number exists | Missing or invalid phone shows plain text and no telephone action; refreshed valid data restores the correct telephone target without another fetch |
| Copy/share | Copy the link or full message; paste into the usual owner chat | Rapid/competing actions issue one operation; clipboard rejection preserves manual-copy access; native cancellation never claims delivery; switching dogs blocks stale feedback |
| History | Explicitly request the selected dog's past stays | One request while pending; exact Dog ID retained; failure exposes Retry Guest History; a late response cannot populate a different guest |
| Responsive access | Review narrow phone, standard phone and desktop in both themes | Errors and missing-contact text wrap; actionable controls remain reachable and at least 44px; keyboard focus remains visible |

Synthetic tests do not demonstrate behavior on every physical phone or establish a production speed improvement. Production verification remains read-only.

Verification: 375 Node tests and five Python contracts passed. Owner coverage passed 33 existing Chromium cases plus five corrected form-fixture cases, and all 38 WebKit cases. The six field/error-layout scenarios across the two engines include same-day validation, composition/duplicate-Enter guards, exact-ID history, retry, guest switching and responsive errors. Two Care brief cases and the full-runtime invalid-phone case passed. The new fixture uses its configured base URL rather than the temporary development server.

## Next backlog item

Audit owner-form receipt evidence for useful completion context. Inspect the fields already returned by intake-status readers before adding UI. If a verified received time/source exists, show it in the existing status details; otherwise retain unknown wording. Do not infer delivery from a copied link, add an automatic follow-up message or introduce startup reads. Relevant files: `care-intake-status.js`, its existing fixtures and the compact Care status group.

Operator instructions: [Preparing an owner care message](owner-form-guidance.md).
