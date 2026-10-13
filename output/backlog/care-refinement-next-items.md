# Next Care backlog after 2026.10.13.01

## 1. Validate identity enrollment on an isolated Google test sheet

Story: prove optional Care IDs can be enrolled without interrupting Waffle House operations.

Implementation prompt: use the existing Apps Script test project and an isolated copied sheet with synthetic pets. Work with apps-script/CareRecordIdentity.js, apps-script/Code.js, apps-script/StableStayIdentity.js and docs/care-record-identity-persistence.md. Keep production CARE_RECORD_IDENTITY_WRITES_ENABLED unset/false. Record deployment SHA, test sheet identity and timestamp without private customer content. Validate reads with the switch off, then enable it only on the isolated project. Save belongings, safety, profile fields and media for one uniquely proven legacy stay; verify columns 35/36 and row ownership. Test a second stay for the same Dog ID, conflicting IDs, duplicate keys, unknown extension columns, date/name changes and receipt recovery. Disable the switch and confirm legacy writes preserve data. Do not bulk migrate or resolve ambiguous rows by name. Deliver a concise evidence report and a reviewed production activation/rollback proposal. Production activation remains pending this evidence.

Acceptance: no read changes sheet headers/data; default-off legacy sheet remains 34 columns; opted-in saves persist proven IDs; invalid/ambiguous identity never writes or returns shared private details; date edits and retries retain the same Care record. No paid infrastructure.

## 2. Remove unnecessary Care startup photo-sync work

Story: opening the guest list/profile performs reads and remains responsive.

Implementation prompt: trace the existing sync_dog_master_photos_to_upcoming_stays startup call and current explicit booking/photo inheritance paths. Inspect waffle-v11.2.8.js, waffle-app.js, the runtime bootstrap and Apps Script photo helpers; locate the actual caller before editing. Move redundant bulk synchronization to an explicit, clearly named maintenance action if needed. Retain explicit same-Dog-ID inheritance on booking creation and reviewed returning stays. Use the existing read-only full-runtime fixture action ledger; do not permit mutations just to make fixtures pass. Deliver a small source diff, synthetic regression fixtures and before/after request counts. Preserve profile draft state and concurrent identity-scoped reads.

Acceptance: opening Care or toggling a category does not start a photo-sync mutation; explicit new-booking photo inheritance still works only for the selected Dog ID; no new broad read or paid service; errors are visible and retry is intentional.

## 3. Complete targeted physical-device acceptance

Story: a sitter can read, edit and save Care on an actual iPhone and Fold without hidden controls.

Use docs/care-physical-device-acceptance.md. Record the installed release, device/OS/browser, enlarged text setting, keyboard, rotation/fold mode and screen-reader behavior. Save only synthetic records on the test deployment. Capture minimal annotated evidence for failures, then delegate one narrow layout/focus fix at a time. Browser viewport and font scaling are supplementary evidence, not replacements for these tests.

Acceptance: Save/Discard clear the keyboard and navigation footer; category states and drafts survive navigation, rotation and unfolding; screen readers announce headings, disclosure state and errors; touch controls remain reachable. Mark unavailable hardware unverified rather than passing it.
