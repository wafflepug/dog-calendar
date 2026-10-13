# Synthetic Google validation for Care identity enrollment

This is a Google Apps Script editor harness for the persisted identity helpers. It runs only against a new, blank spreadsheet containing synthetic fixtures and a separate standalone Apps Script project. It does not read or copy customer records, call the web app, or deploy a version.

## One-time setup

1. Create a new blank spreadsheet and add one tab named `__CARE_ID_TEST_CONTROL__`. Put exactly `CARE_IDENTITY_TEST_ONLY:v1` in cell A1. Do not copy the production spreadsheet or any production data.
2. Use a new standalone Apps Script project, or reuse an existing private test project only by installing a scoped IIFE bundle that cannot collide with its globals. In either case, the project ID must be explicitly allowlisted below and must be separate from the bound production project. Include the reviewed `apps-script/CareRecordIdentity.js` source and this harness. Do not create a deployment or trigger. Keep the spreadsheet a new blank synthetic spreadsheet even when reusing a private test project; never point this harness at the existing copied-customer workbook.
3. In the harness configuration, set the new spreadsheet ID, the standalone Apps Script project ID, and every known production spreadsheet ID in the denylist. Do not run while any value begins `REPLACE_`. Verify the script ID and spreadsheet ID from their own Google editors.
4. Compare the harness's `migrateBelongingsIdentityForGuest_` implementation with the current function of the same name in `apps-script/Code.js`. It is included as a test-only excerpt because carry-forward lives in `Code.js`, outside `CareRecordIdentity.js`; record the reviewed source revision and confirm the function matches before running. Do not add `Code.js` or its web app entry points to this standalone project.
5. Run `careIdentitySyntheticRun` from the Apps Script editor. It creates only `__CARE_ID_TEST_BOOKINGS__` and `__CARE_ID_TEST_CARE__`, seeds synthetic rows, and logs a JSON result. The script property `CARE_RECORD_IDENTITY_WRITES_ENABLED` is toggled only in this isolated test project. Preserve the execution log and fixture workbook until evidence review. To remove fixtures, run `careIdentitySyntheticCleanup`; it deletes only those two exact configured tabs and retains the control marker tab.

The target guard checks the executing Script ID, exact spreadsheet ID, production ID denylist, marker sheet/value, and absence of a `Pet_Belongings` tab before any fixture tab is created. Use a dedicated spreadsheet with no other tabs or content. If any guard fails, it leaves script properties and spreadsheet tabs untouched; stop and investigate rather than weakening or bypassing it. After the target passes, the runner resets the enrollment property to false and restores `BELONGINGS_SHEET_NAME` to its prior value (or deletes it if previously unset), even when a fixture case fails.

## Cases and evidence

The harness calls the production identity module's real read, write-proof, header, booking-resolution, and row-persistence helpers. It checks disabled/enabled/disabled schema results of 34/36/36 columns; persistence of both IDs on the proven synthetic Care row while other values remain intact; preservation of existing IDs with enrollment disabled; reuse of one Dog ID over separate stays; duplicate booking and Care keys; unknown extension headers; stored ID conflicts; name/date carry-forward using the exact pre-mutation Stay ID against a synthetic booking; and unchanged sheet values/formulas across reads. Booking date cells are written as date-like values and resolution uses the Apps Script session timezone normalization. The local mock explicitly round-trips ISO fixture values as JavaScript `Date` objects in `Australia/Sydney`, reproducing Sheets coercion.

Receipt recovery is not covered by this harness. Validate that caller separately against a synthetic receipt and booking fixture, then attach its endpoint result and before/after sheet evidence before treating carry-forward recovery as covered. Do not infer receipt recovery from the direct name/date carry-forward case.

Attach a completed evidence record with:

| Field | Required evidence |
| --- | --- |
| Run | UTC timestamp, operator, Apps Script execution ID, result JSON and all case outcomes |
| Target | Test-only spreadsheet ID and standalone project ID (retain privately); confirmation that neither is on the production denylist |
| Guard | Marker tab and exact marker value; screenshot or equivalent record showing separate blank spreadsheet and standalone project |
| Source | Candidate Git SHA; hashes or reviewed revision for `CareRecordIdentity.js` and `Code.js`; confirmation that the carry-forward excerpt matches `migrateBelongingsIdentityForGuest_` |
| Schema | Header snapshots/counts at disabled, enabled, and disabled-again checkpoints: 34, 36 with exactly `Stay ID`/`Dog ID` appended, then 36 preserved |
| Reads | Before/after values and formulas for both generated tabs around read-only calls, with zero differences |
| Cleanup | Whether generated tabs remain for review or were removed by the exact-name cleanup function |

Report only observations from the recorded execution. A local Node fixture pass is not Google validation. The harness does not establish a production deployment, production enrollment, behavior of other Apps Script endpoints, or a migration of existing records.

## Existing private audit material

`docs/pr195-release-verification.md` and `docs/next-stable-care-record-identity.md` describe an owner-only private test project and a private copied database audit on 7 October 2026. That work validated a read-only profile adapter and in-memory identity overlays, not persisted 34-to-36-column enrollment, Care writes, or this harness. No spreadsheet IDs, credentials, or copied records are stored in this repository. The current rollout must produce its own evidence from the synthetic-only harness above.
