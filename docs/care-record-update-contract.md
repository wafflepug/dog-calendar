# Care record update timestamp contract

The `Updated At` value in column 1 of the shared `Pet_Belongings` row is the last-write time for that stay's combined care record. It is a record freshness marker, not a timestamp for one particular field or a claim that every value in the row changed at that moment.

`upsertBelongingsRecord_` writes a new `Date` to column 1 for both inserts and updates. `saveIntakeAttributesForStay_` also stamps column 1 when it updates an existing row; when it creates a row, it delegates to that upsert. The legacy intake confirmation path in `V11204LegacyIntakeFinalize.js` calls this save function after confirming the selected booking, so a finalized import refreshes the destination care record's timestamp.

`syncCoreBookingFieldsToIntakeAttributes_` refreshes column 1 for the matching care row when core booking fields are synchronized. Media mutations that change the care row (such as selecting, deleting, or reordering dog photos) also stamp column 1. These updates mean the shared care row was written; they do not imply an intake import occurred.

Reviewed care inheritance creates or updates only the destination stay through `upsertBelongingsRecord_`, which gives that destination row a new timestamp. It carries reviewed fields and labels their source as `Reviewed from previous stay`. The source stay's timestamp is not copied or changed by inheritance.

`readGuestProfileRowsReadOnly_` reads column 1 and serializes a stored `Date` to ISO text (or preserves a preformatted string). `getGuestProfileDetail_` returns that value as `updatedAt`. These profile-resolution and detail-read paths must not create sheets, rewrite headers, or update the care row.

Node tests extract the current Apps Script functions and run them with sheet and service stubs. They cover the write-on-import and sync paths, plus timestamp preservation and absence of sheet writes on direct and integrated profile reads. They do not connect to or mutate a live spreadsheet.

The Care navigation now exposes machine-checkable tab and panel relationships. Physical screen-reader behavior still needs a manual follow-up with VoiceOver and TalkBack; those assistive technologies have not been verified by the automated tests.

Source parity checked for this frontend release: `apps-script/Code.js` and `apps-script/V11204LegacyIntakeFinalize.js` have identical Git blobs to backend deployment commit `f737bc5394d9ac27627bbe492abc5814b08e80c5`. No backend redeployment or live data mutation is required for these refinements.
