# Next backlog: reviewed profile ownership map

## User story

As a sitter, I can explicitly assign an ambiguous legacy Care profile to the correct persisted stay after reviewing its owner and stay history. Opening a profile never makes that assignment automatically.

## Bounded task for implementation

Retain vanilla JavaScript, Apps Script and Sheets. Inspect `getGuestProfileDetail_` in `apps-script/Code.js`, the existing stable mutation receipt helpers, and `loadDirectoryProfileDetail` in `waffle-app.js` before selecting a schema. Design a dedicated, versioned profile ownership map with persisted Stay/Dog IDs and immutable source record identity; do not use a mutable sheet row number as lasting proof.

Provide a review-only preview first. Show the exact stay and dog number, source provenance, unresolved alternatives and fields affected. A separately confirmed assignment must use existing write authorization, concurrency checks and durable retry protection. Reject a changed source or target, duplicate mapping, deleted stay, malformed ID and conflicting ownership. Do not infer ownership from the dog name and dates alone.

Scope this first delivery to profile instructions. Belongings, safety summaries, documents and photos remain separate contracts. Preserve the unique legacy compatibility read. Expose mapping resolution metadata in reads and keep cache entries bound to the resolved identity.

## Acceptance and rollout

- Two equal-name/date stays cannot receive the same legacy medical details without explicit reviewed ownership.
- Opening, retrying or previewing performs no migration writes.
- Replayed confirmation produces one mapping; a rejected or uncertain save keeps the review state and gives an honest result.
- A stale response cannot alter the selected dog or overwrite a field draft.
- Synthetic tests cover ambiguity, concurrent assignments, source changes, duplicates, retry and rollback.
- Validate on a copied spreadsheet before production. Document a backend-first release gate, rollback, and retained legacy data; never delete or relabel source records as a side effect.

Deliver the schema and review flow for lead review before implementing migration writes. No paid dependency or change to the existing Waffle House access flow.
