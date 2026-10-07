# PR 195 release verification

## Private Google runtime audit — 7 October 2026

The `c4f3161e` profile reader was uploaded to the existing private owner-only test project. The production entry points remain disabled in that project. The audit passed in both the Apps Script editor and the deployed version 3 `/exec` endpoint; deployment access remained `MYSELF`.

The copied-sheet sample covered 12 legacy bookings: 11 resolved Care records and one correctly missing Care record. Missing key, nonexistent key and malformed ID requests remained unresolved without sensitive fallback. Values and formulas across all copied tabs matched before and after execution.

Seven additional cases used booking and Care rows read from the private copy, with identity changes held only in memory. No spreadsheet rows were created or changed:

| Case | Expected result | Result |
| --- | --- | --- |
| Unique stable Stay ID and matching Dog ID | Resolved | Passed |
| Stable Stay ID with mismatched Dog ID | Unresolved; sensitive details suppressed | Passed |
| Duplicate booking key with distinct Stay IDs | Unresolved; sensitive details suppressed | Passed |
| Duplicate Care rows | Unresolved; sensitive details suppressed | Passed |
| Reused stable Stay ID | Unresolved; sensitive details suppressed | Passed |
| Legacy booking with matching persisted Dog ID and no Stay ID | Resolved | Passed |
| Legacy booking with mismatched Dog ID | Unresolved; sensitive details suppressed | Passed |

These are Google-runtime copied-data memory overlays, not persisted identity fixtures or migration tests. The audit tests the profile-read contract; it does not claim complete mutation integration. Existing local operation and identity regression tests cover the separate mutation paths.

## Frontend verification

The actual Care page passed selected-profile hierarchy checks at 390px in light and dark modes and at 1440px in light mode. These checks verified one visible profile portrait, explicitly labeled dates, the operation bar directly below the identity header, and accessible Owner Care Link / Book Again actions in Booking tools. Existing check-in/checkout and collision tests passed (24 cases).

## Deployment order

After the final candidate CI checks pass, deploy the reviewed backend candidate first and verify its SHA and profile ownership response. Merge the frontend only after that backend verification succeeds. Monitor the normal main-branch backend and Pages releases. Do not deploy the private audit adapter to production.
