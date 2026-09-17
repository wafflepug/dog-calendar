# Next delegation: collision-safe checkout lookup

Implement in a fresh worktree from current `origin/main`. Use Luna. Stack is static browser JavaScript, FullCalendar, Apps Script, Node fixture tests and Python contracts. Do not write production booking data.

User story: A sitter checking out one guest must never check out another owner's same-name dog booked on the same dates.

Inspect `waffle-v11.0.js`: `v110MakeStayKey`, `v110StayKeyForEvent`, `v110OperationForStay`, `v110IndexOperations`, `v110ApplyEffectiveCheckoutDates`, `v110IsCheckedOutEvent`, `v110SaveOperationalStatus`, card status and Leaving modal readers/writers. Inspect `waffle-v11.2.17.js`: `payloadForCard`, `operationForCard`, submission and post-save decoration. Inventory callers before changing signatures. Inspect the confirmed identity policy in `waffle-v11.0.5-core.js` and its fixtures.

First deliver a short design note explaining lookup states: unambiguous legacy match, known collision, and incomplete evidence. Then implement an event/payload-aware lookup and a shared mutation guard. Build collision evidence from confirmed booking records before checkout truncates dates; compare raw booked dates. A legacy operation has no owner/contact in the backend sheet, so never assign it to an owner using array order. Preserve existing unique historical checkout behavior, including Ralph. On known collisions, show a concise actionable status in Care and prevent ambiguous writes from Care, early checkout and Leaving Today. Do not add an approval prompt for ordinary unique bookings.

Do not change media/profile stay keys or `makeGuestStayKey_`: photos and belongings share that contract. Do not introduce a backend schema migration, delete records, or pretend a filtered/cached feed proves complete uniqueness. Document how unavailable collision evidence is handled and which cases require the separate stable-ID rollout.

Acceptance and executable fixtures:

1. Ralph's unique legacy checkout ends the calendar on the actual checkout day, using an exclusive display end while retaining booked raw dates.
2. Two confirmed same-name/date bookings with different owners/contact cannot both inherit one checkout; no ambiguous mutation reaches `sendPayloadToAppsScript`.
3. Exact proven source copies do not create a false collision; incomplete/conflicting identities are handled conservatively.
4. A collision discovered after cached checkout was applied restores any incorrect truncated calendar end and quarantines the ambiguous operation across all status readers. A later unambiguous authoritative refresh may apply the valid status again. A failed read must not erase known collision evidence or promote a partial cache to proven uniqueness.
5. Care, Today departure counts, Leaving Today and calendar agree after cached data, fresh data, repeated refresh, offline queue and failed read transitions.
6. Cover missing identity, mixed raw/display ends, checked-in status, non-confirmed events, different dates, mutation rejection and unchanged media keys. Assert the guard at each Care checkout, Leaving Today and early-checkout entry point.

Design gate: inspect whether the existing reads provide a genuinely complete confirmed-booking collection. Do not invent a completeness flag or block every historical stay without assessing the effect on Ralph. If safe compatibility cannot be established with the current APIs, deliver the design and split out the backend prerequisite before runtime implementation. Inventory offline replay as well as initial submission: a queued checkout must not bypass known-collision protection when replayed. Specify a narrow replay guard or a separate prerequisite task; do not claim the mutation safety acceptance is complete while replay can still send the ambiguous operation.

Inventory evidence to verify: `parseCSVToEvents` emits confirmed events for all valid CSV rows; its seven-day filter controls directory/list materialization, not the full calendar collection. `fetchSpreadsheetCsv` / `syncSpreadsheetData` can fall back to cached CSV and malformed rows may be skipped. Distinguish a fresh full successful parse from fallback/partial data. Apps Script `getGuestDirectoryPayload_` is current plus seven days; past-directory reads are capped. No active client mutation outbox was found in the current source; `queued` response branches alone are not proof of replay implementation. Verify this before allocating queue work.

Deliver narrow runtime changes, a design/limitations note, fixtures exercising actual lookup/read/write paths, relevant CI wiring, coordinated asset revision if runtime assets change, and a Task Completion Report. Run early-checkout, calendar-capacity, navigation contracts and relevant browser checks before auto-push/merge. Backend stable IDs remain a separate task.
