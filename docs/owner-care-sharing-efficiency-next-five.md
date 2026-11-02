# Owner care-link and planned-visit clarity

Candidate release 2026.11.02.03, service worker 169.

## Changes

1. **Per-stay care-form recovery.** Each saved planned stay shows whether its care form was returned. A stay with a missing link offers an explicit Prepare care form action when its public Dog Number and exact saved identity are available. The action opens the existing Owner & Return panel with that stay selected; the owner-link write still requires a separate click. A missing public Dog Number keeps the action unavailable and gives the sitter a truthful recovery cue.
2. **Exact same-name owner links.** The selected connected Care card can provide the exact Dog ID, Stay ID, dog name and dates while the booking CSV is still loading. Its public Dog Number, current card identity and unique Stay ID are checked; any current booking row for that Stay ID must agree exactly. Duplicate cards or rows, missing/stale IDs, detached cards and changed details fail closed. The existing server guard still checks the exact IDs and dates.
3. **Verified identity fast path.** A selected Care card, current row or verified create-booking receipt can prepare its care link without waiting for a dog-identity inventory read. Card proofs are bound to the real selected connected card and owner-form generation; booking receipts are bound to the successful frozen create-booking request and exact returned IDs. The fast path checks any current rows for that Stay ID; CSV lag with no current row is allowed, while any duplicate or conflicting row blocks the request. Phase 4 row parsing now retains valid Stay IDs from the CSV and leaves malformed or legacy values blank. Unknown identity continues through the existing inventory and exact-match checks.
4. **Truthful result identity.** Planned-visit headings display the public Dog Number or “Dog ID not returned.” They never expose a fragment of an internal UUID. Copy stays unavailable without a readable public number; missing-form preparation also stays unavailable without it.
5. **Readable save results.** Result rows use plain-language labels for queued, saving, pending and attention states. Full diagnostics remain available under Save details, and long errors wrap on narrow and enlarged layouts.

## Verification

- Browser tests cover Chromium and WebKit, including actual API-first Care-card selection with empty CSV rows, duplicate or detached cards, conflicting current CSV rows, exact same-name selection, fresh-receipt CSV lag, held inventory refresh, no extra inventory request after the read-count snapshot, and late result invalidation. The production Phase 4 parser is checked for valid, malformed and legacy Stay ID columns.
- Planned-visit results are checked with mixed returned/missing forms, queued and attention states, missing public Dog Numbers, 320/390/1440 px widths, both themes and 200% text.
- Save details are checked against a multiline error containing a long unbroken token. The full value remains available and does not cause horizontal overflow.
- During a held multi-visit save, the new preparation action remains disabled; a dispatched click cannot route to Owner & Return or write a link. It becomes enabled after the plan acknowledges all saves.
- Existing copy gates, immutable planned-save payloads, queued receipts, explicit writes and service-worker cached asset references remain covered by the relevant regression suite.

## Preserved behavior

No backend code or booking data format changes. No link is generated or sent automatically. Stable Dog ID, Stay ID and date checks remain required; ambiguous or stale identity does not fall back to a dog name. Existing booking receipts, frozen plan intents, Pending Sync semantics, draft state, lazy reads, complete Safety and Medication content, consent boundaries, Today and Calendar remain unchanged.
