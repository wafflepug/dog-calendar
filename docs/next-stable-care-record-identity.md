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
