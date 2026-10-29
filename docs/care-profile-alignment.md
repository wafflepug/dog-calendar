# Care profile alignment

Release candidate: `2026.10.29.06` · service worker `v11.4.159-care-profile-alignment-2026.10.29.06`.

The selected Care profile inherited spacing and button rules from older layouts. The owner-form receipt badge offset the adjacent primary action; moved booking buttons fell outside their original themed container; owner contact values wrapped independently.

The Directory-only canonical stylesheet now gives identity and dates room, removes redundant heading borders/spacing, aligns the saved-record text with Care essentials, and groups the owner name and readable phone beside Call owner. Primary actions share their top edge and minimum height while form receipt stays below its action. Existing Book Again and Owner sharing options use the same theme tokens, typography, touch targets and focus treatment as other profile tools.

No controls, icons, runtime handlers, backend behavior or Today/Calendar layouts change. Complete Safety and Medication remain visible. Exact Stay ID/Dog ID, drafts, explicit writes and lazy reads are preserved. The owner contact span uses CSS contents so its existing link and readable number can share the name's grid; tests target the interactive link rather than a noninteractive wrapper.

## Verification matrix

- Full-runtime synthetic fixture: Chromium and WebKit at 320, 390 and 1440 pixels, light/dark and 1×/2× text. Verify contact geometry, primary action top alignment, receipt placement, themed supporting buttons, hit targets, overflow, exact identity and unchanged Care read counts. Missing/invalid numbers retain Phone unavailable and Add number without a dial link, and hidden contact groups stay hidden.
- Existing Care mobile clarity, routine heading and solo-sitter checks: long names and complete instructions, touch targets, forced colors, emergency lookup, retained handover editing, editor focus and draft failure recovery.
- UI stability contract and release/deployment attribution contracts.
- Publication gate: all workflows on the final PR head and every UI regression job must pass before merge; Pages must finish before exact published asset and read-only deployment metadata verification.
- Live checks request static assets and capability/maintenance metadata only. No guest record reads, guest writes or sample notifications.

Screenshots are retained locally under `output/care-profile-alignment/`. Physical phone, native dialer and mobile PWA refresh remain manual follow-up checks; automated browser coverage does not substitute for those devices.
