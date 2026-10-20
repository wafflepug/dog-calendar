# Care Photo and Save Clarity — 2026.10.21.01

Three bounded bundles continue the existing Care performance and simple-editor work. This is a frontend release with no backend, schema, stored identity, uploaded-original, or paid-service change.

## Built deliverables

1. Roster photo delivery: recognized HTTPS Drive thumbnail URLs select a rendition from the tile's rendered width and device pixel ratio. Profile and gallery sources retain their existing quality. Unchanged photo updates preserve image nodes and the edit control, avoiding repeated DOM replacement. Small-preview failure tries the original once; a terminal tile failure reveals the existing initials instead of looping. New photo sources can load again.
2. Category changes: only categories with unsaved fields show a compact change count. Counts include safety flags and optional fields, survive collapse and same-record refresh, and disappear after Undo, Discard or a successful save. Existing category buttons expose the count in their accessible names. No additional record read or required review step is introduced.
3. Save recovery: confirmed saves whose subsequent local update fails show a visible recovery message with Retry refresh in the Care summary. Retry only reads the saved record; it never sends another save. Rejected saves keep their editable drafts. Captured stable identity guards prevent an old retry from reading for a different dog. A failed retry remains available; a successful retry focuses its completion message. Starting another edit removes the old recovery notice.

The existing profile-read failure cooldown now also retains returned backend errors and saved offline fallbacks. This prevents legacy profile observers from immediately repeating a known failed read. Explicit Retry still bypasses that cooldown. The synthetic save-recovery journey verifies two clicks (one failed read, one successful read) make two profile requests and no additional save or belongings request.

## Testing matrix

| Journey | Steps | Expected |
| --- | --- | --- |
| Roster to profile | Load a synthetic Drive photo in the roster, then open the dog | Small tile preview first; original profile rendition after intent; no extra photo record read |
| Repeated photo updates | Reapply the same source, change it, then clear it | Unchanged nodes/attributes stay; changed source updates in place; edit focus and placeholder remain |
| Photo failure | Fail small preview, then original; reapply unchanged record | One fallback attempt; initials remain; no retry loop |
| Category edits | Change feeding fields and a safety flag; collapse and reopen | Only affected categories show accurate counts; drafts and accessible expanded state remain |
| Undo and Discard | Undo one field, then all; make another draft and Discard | Other edits remain; counts clear correctly; focus stays usable |
| Rejected save | Return a synthetic backend rejection | Draft remains, Save becomes usable, rejection is visible |
| Confirmed save, failed update | Return success, then fail the local follow-up; use Retry refresh twice with one failed read | Saved status stays truthful; one read per retry; zero additional mutations; final completion receives focus |
| Identity switch | Change stable dog identity before using an old retry | No read or mutation for the replacement identity |
| Responsive layout | Check 320/390/1440 widths, both themes, Chromium and WebKit | Category counts wrap without clipping; recovery controls remain reachable and at least 44px high |

Tests use synthetic guests and intercept all external mutations. Photo dimensions and encoded bytes are fixture observations, not production transfer savings or a measured page-load speedup. Physical phone and assistive-technology checks remain separate. Exact executed test and release results are recorded in release evidence.

## Next backlog bundle

Audit the complete mobile arrival-to-handover journey with representative short and long care plans. Remove only demonstrated repeated labels or unnecessary scrolling, preserving urgent safety information, direct owner sharing, operational actions and existing lazy reads.
