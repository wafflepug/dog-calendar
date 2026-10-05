# Care multiline CSV handling

`waffle-csv.js` is the shared reader for the app's cached and downloaded CSV data. It separates logical records before decoding fields, so quoted commas, LF or CRLF inside quoted cells, and doubled quotes remain part of the original field. It supports a UTF-8 BOM, empty cells, and a final record with or without a line ending. Parsing returns both decoded cells and each record's original serialized text and line ending; cache patch and delete paths use those raw records so unrelated rows retain their formatting.

The reader rejects an unclosed quoted field, a quote in an unquoted field, or non-delimiter text after a closing quote. A failed parse returns no records. Read consumers return no CSV-derived rows rather than guessing at record boundaries. Cache mutation consumers leave the original cached CSV untouched when parsing fails. Spreadsheet fetch validation rejects malformed text before the sync path overwrites the cache; its existing error path restores and refreshes from the previous cache. Calendar refresh validates the cached CSV before removing event sources or resetting capacity counts. `parseCSVToEvents` also returns no CSV-derived events for malformed input. The future-stay reader still includes its separately stored optimistic local confirmed stays, as before.

The active consumers using `window.WaffleCsv` are:

- `waffle-app.js`: `getCsvBookingRecords`, `getCurrentBoardingStays`, `parseCSVToEvents`, and `patchGuestRecordInCachedCsv`.
- `phase4-core.js`: `rows`, used by capacity calculations.
- `waffle-v11.1.99.js`: `confirmedEventsFromCsv`, used by the future-stay bridge.
- `waffle-v11.1.11.js`: `cachedSpreadsheetMeetEvents`, used when composing Meet & Greet events.
- `waffle-v11.2.00.js`: `removeFromCachedCsv` and its row identity helper, used when deleting an exact cached stay.

These paths retain their existing column positions, header aliases, stay identity and date matching, optional Dog ID behavior, and network behavior. The old local cell helper definitions remain only for compatibility with existing scoped function harnesses; active CSV consumers use the shared parser. No backend schema or request was added.
