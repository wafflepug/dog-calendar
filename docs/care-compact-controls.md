# Compact Care controls and records

Candidate release 2026.10.14.04. Static UI changes only; no backend/data migration.

1. The current booking-source picker is closed until Change booking source is opened. Saved source and pending/error feedback remain visible, with acknowledgement required before showing Saved.
2. Past source values remain read-only and known owner phones have an explicit accessible call link. Long historical handovers are kept in a disclosure, retaining complete text.
3. Past document metadata is grouped under Records & forms. Primary care instructions and safety alerts stay outside. Unknown/absent/pending/unavailable document states are distinguished; summary updates are idempotent. The delayed background count task reuses already loaded Past records so it cannot rebuild an opened profile.
4. Dog record labels and metadata use scalable text, wrap identifiers and values, and keep full notes readable without a nested clipping limit.
5. Date/detail editor actions remain reachable on short phone viewports; field widths, long status messages and enlarged text wrap within the existing viewport-safe modal system.

## Testing matrix

Verify 320/390/1440px, light/dark and enlarged text. Check saved, missing, invalid, delayed, failed and queued source changes using synthetic fixtures. Opening a disclosure must add no reads; past synthetic source clicks must write nothing. Inspect long owner phones/notes and saved/missing/error/pending document summaries; alerts and primary care must remain visible. Verify modal action hit targets on 320x568, 390x320 and landscape views without saving real records. Run existing care identity, return-focus, photo/gallery, profile and source contract checks before merge. Production smoke stays read-only.

## Next backlog item

Simplify Dog record maintenance actions: one concise status and an explicit disclosure for syncing or photo maintenance, with clear pending/failure feedback. Audit the current renderer before implementation.
