# Next implementation: identity-scoped Care profile reads

## User story

As a sitter, I can open two dogs with the same name and stay dates without seeing another dog's saved care instructions. Existing Waffle House records continue to work through an explicit, conservative compatibility path.

## Bounded first delivery

Implement the profile-read contract first. Belongings, safety summaries, intake documents and media follow as separately reviewed tasks; do not claim they are migrated by changing only the profile endpoint.

Relevant sources: `apps-script/Code.js` (`get_guest_profile`, `getGuestProfileDetail_`, `readBelongingsRecords_`), `waffle-app.js` (`loadDirectoryProfileDetail`, `directoryProfileIdentityIsAmbiguous`, `renderDirectoryCareBrief`), the existing stable stay identity helpers, and `tests/care-profile-readiness.test.js`. Retain vanilla JavaScript, Apps Script and the existing Sheets service; introduce no paid service or dependency.

Add validated persisted Stay/Dog IDs alongside the compatibility `stayKey`. Return explicit resolution metadata and the record identity. Scope client caches and pending read keys to that identity. A successful HTTP/JSONP response alone must not imply the requested record was resolved.

Legacy records require a migration map with proven identity evidence. A legacy key that can refer to multiple persisted stays must remain unresolved until reviewed; neither a matching name/date nor the first matching sheet row is sufficient. Do not automatically relabel, copy, delete or merge stored records. Preserve the current client ambiguity guard until an identity-scoped response proves the intended record.

## Acceptance criteria

- A unique legacy record remains readable without changing the current live access flow.
- Two same-name/date stays with different IDs receive separate cache entries and only their own resolved profile data.
- Missing IDs, conflicting evidence, invalid IDs and an ambiguous migration map produce an honest unresolved state with no shared medical details.
- Cached data and late responses cannot replace the currently selected identity or overwrite its open draft.
- Retry remains read-only; no migration writes happen as a side effect of opening a profile.
- Fixture tests cover unique legacy compatibility, resolved stable identity, ambiguity, stale cache, a late response after switching dogs, and missing record versus failed transport.
- Document the backend-first rollout and rollback. Verify in a copied test sheet and test deployment before changing the live Apps Script service.

## Review deliverables

Provide a narrow source diff, synthetic fixtures, the compatibility/resolution contract, and rollout evidence. The lead reviews the identity policy and deployment order before releasing it. Physical-device and existing Care navigation checks remain part of the MVP acceptance matrix.

## Persisted schema and rollout contract

`Pet_Belongings` has 34 columns. Its identity fields are `Stay Key` (column B) and `Dog Name` (column C); it has no persisted Stay ID or Dog ID column. The booking sheet stores optional `Stay ID` and Dog ID fields discovered by header. This first read-only delivery therefore proves ownership through the current booking rows, then associates one unique legacy Care row with the requested booking key in memory. It does not write an identity map or alter either sheet.

`get_guest_profile` accepts `stayKey` and, when available, `stayId` and `dogId`. A resolved response carries `record.identity` (`stayKey`, validated `stayId` or empty string, and validated `dogId` or empty string) and `record.resolution` (`status: resolved`, with `method: stay-id-unique-legacy-key` or `legacy-key-unique`). A stable-ID request must match exactly one persisted booking; supplied identifiers must agree; the legacy key must identify exactly one booking row across all rows, including rows with missing or malformed IDs; and exactly one Care row must use that key. A no-ID request stays compatible only when the key uniquely identifies one booking and one Care row. Older bookings with a persisted Dog ID but no Stay ID also remain compatible: a supplied Dog ID must match that uniquely proven booking; missing or conflicting persisted Dog IDs remain unresolved. A Dog ID alone never disambiguates shared stay keys. Duplicate booking keys, duplicate Care rows, invalid IDs, and conflicting evidence return `status: unresolved` with empty intake/photo fields. Proven identity with no Care row returns `status: not_found`, separately from transport errors.

This mapping cannot resolve two persisted bookings with the same legacy key, even when both have stable IDs: the existing Care row contains no field that says which booking owns its contents. Those records require review and a later separately approved migration design. Profile open and retry remain read-only. Belongings, safety summaries, intake documents, and media are outside this endpoint contract.

### Backend-first copied-sheet rollout and rollback

1. Make a copy of the production spreadsheet and deploy this Apps Script source as a test deployment bound to that copy. Keep the production web app deployment unchanged.
2. In the copy, check a unique stable-ID stay, a unique legacy stay with no Stay ID, a missing Care row, two bookings sharing a name/date key, duplicate Care rows, an invalid ID, and conflicting Stay/Dog IDs. Confirm unresolved cases return no intake or photo details and no read creates sheets, adds headers, or changes cell values.
3. Verify both the test deployment and client against the copied spreadsheet, including the no-write assertions, before any production release. Release the Apps Script backend first and confirm the identity/resolution contract and existing Care reads. Publish client code only after that backend is confirmed. Keep the existing ambiguity guard for unresolved responses.
4. Rollback by restoring the prior Apps Script and client deployment versions. Because profile reads write no identity mapping and change no cells, rollback requires no data cleanup. Records with shared legacy keys remain unresolved after release until separately reviewed.

The repository's current workflows deploy when changes reach the main branch and do not enforce this backend-first sequence. Do not merge a combined backend/client release until copied-sheet evidence is available and deployment ordering is resolved; use separately controlled backend and client releases or add a reviewed deployment gate first. A private, owner-only read-only test deployment was verified on 2026-10-07 using a private copied database. Both editor and deployed /exec execution passed: 12 legacy bookings (11 resolved profiles and one missing Care row), plus missing-key, nonexistent-key and malformed-ID negative cases. All spreadsheet values and formulas matched before/after. This sample did not exercise persisted stable-ID or duplicate-key cases on Google; those are covered by local synthetic fixtures. It is a profile-read adapter, not a complete frontend/mutation deployment. No production deployment or migration was run.

## Implementation verification

The candidate passes 212 local Node fixture tests, five source contracts, and 12 targeted desktop/mobile Chromium and WebKit browser cases. Profile fixtures cover separate caches, missing versus unresolved records, safe legacy compatibility, late replies after identity switches, and retained drafts with blocked saves after server identity rejection. Browser emulation does not establish physical iPhone/Fold4 behaviour. Copied-sheet deployment verification and the broader GitHub browser workflow remain separate release gates.

## Controlled release sequence

After all candidate CI workflows pass and remaining copied-data identity cases are verified, dispatch Deploy Google Apps Script manually on the exact reviewed candidate branch. Verify the production backend echoes the candidate SHA and profile identity/resolution contract before merging the client PR. Only then merge and monitor the main Apps Script and Pages deployments; their normal independent triggers are safe once the compatible backend is already live. If backend verification fails, leave the client PR unmerged and restore the previous backend deployment. Never deploy the private test adapter to production.

