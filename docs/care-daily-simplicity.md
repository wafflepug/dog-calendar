# Care daily simplicity — 2026.10.24

## Delivered

The selected Care profile keeps the photo, dog name, Dog ID, stay dates, current operation status and its existing check-in/out action together at the top. Safety and full medication instructions remain directly visible. Feeding, walks, owner contact and the handover note now share one collapsed **Routine, owner & handover** disclosure with a 44px summary target.

The existing owner form action reads **Share care link** when a link is ready or awaiting the owner. Its accessible name follows the selected dog's status. The existing handoff still offers copy, native Share when supported, and the manual-copy fallback; its status explains that preparing or copying does not send a link and that the sitter must choose Copy or Share. No link is prepared automatically.

Today's existing intake indicator remains the single intake status/action. A collapsed **Care checks before check-in** checklist adds two task-specific actions for medication and belongings. Each opens the exact stay's selected Care profile, waits for its existing scoped profile read, then focuses the read-only medication category or Items tab; only an explicit Items click starts the existing lazy belongings read. Missing summary evidence says it has not been checked in that summary; absent medication instructions and belongings are never treated as proof that nothing is needed or that a task is complete. The checklist adds no startup reads or writes.

The guided checkout already brings exact dog/stay identity and dates, compact belongings, visible medication, the per-checkout handover note, and one explicit confirmation together. Its verified save remains the only path that moves a stay to Past. Cancel, failed/queued/uncertain results, replacement identities, and early checkout keep their existing safeguards; the flow receives regression coverage here rather than duplicate controls.

No Apps Script, schema, deployment settings, or production guest data changes were made.

## Functional and failure matrix

| Journey | Expected behavior | Edge and failure coverage |
| --- | --- | --- |
| First profile view | One identity header and current operation controls; Safety and complete medication remain visible; supporting details start collapsed | Same 44px disclosure target opens owner/routine/handover; 320/390/1440px and both themes; no horizontal overflow or added profile read |
| Owner link | One selected-stay **Share care link** entry opens the existing owner flow | Not prepared, awaiting owner, received and unknown states remain distinct; no token in summary; copy/share cancellation, blocked clipboard and manual fallback stay explicit; no automatic send |
| Arrival | One existing intake status/action plus a collapsed medication/belongings checklist beside check-in | Unknown values stay unverified; task clicks select the same exact stay and focus the read-only destination; explicit lazy reads only; no writes or edit mode |
| Checkout | One guided sheet combines identity, belongings, medication, handover note and confirmation | Cancel writes nothing; failed save retains the note for retry; queued/conflicting/uncertain results do not move to Past; successful exact-stay save moves immediately to Past |

Browser fixtures block non-local writes and use synthetic dog/stay identities. They do not prove behavior on physical phones or assistive technology.

## Executed verification

Lead review retained visible safety and medication, corrected idempotent arrival anchoring with the real observer enabled, and verified exact-stay read-only task navigation. The committed runtime passed 380 Node tests and five Python contracts. All 180 arrival/intake/checkout cases passed locally in Chromium and WebKit at 320, 390 and 1440px. Three Chromium full-runtime profile cases passed, covering the first-view matrix and both roster destinations. Screenshots are synthetic; final current-head CI and deployment attribution remain release requirements.

## Next bounded task

Have a sitter review the collapsed first profile and arrival checklist on a physical 320–390px phone with keyboard/screen-reader navigation. Confirm that the two task destinations are discoverable and that medication and belongings can be checked without accidentally entering edit mode; adjust labels or focus only if observed.
