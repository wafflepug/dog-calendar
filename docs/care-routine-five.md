# Five Care routine features — 3 November 2026

## Deliverables
1. Feeding entries with optional note and server timestamp.
2. Walk entries with optional note and server timestamp.
3. Explicit Medication given entries; no dosage advice or inferred completion.
4. Recent exact-stay history (latest 50), available for completed stays too.
5. Add verified saved activities to an editable owner update, preserving greeting, dog identity and existing edited text. No automatic sending.

## Data and operation design
Dedicated append-only Care_Routine_Log sheet: Event ID, Stay ID, Dog ID, Stay Key, Type, Note JSON, Recorded At. It is created on the first valid write; reads never create it. Notes are stored as JSON strings to preserve text without spreadsheet formula evaluation. Read action get_care_routine_log; write action record_care_routine_event. Version capability careRoutineLogVersion=1. Writes use the existing ScriptLock, prove one exact current confirmed booking and reject checkout/ambiguity. Stable event IDs make exact retries idempotent; changed replay payloads are rejected. Saved instructions are never overwritten. History reads permit exact historical stays.

The Care-only activity section is compact/collapsed and loads on demand. Recording controls require the server capability; offline or unconfirmed writes are not claimed as successful. Drafts and retry IDs are in-memory only. Server timestamps display in Australia/Sydney. Owner sharing reads verified events explicitly and never sends automatically.

## Verification performed
JavaScript syntax/diff review; phone/desktop before/after captures with fictional guests and simulated read responses; one synthetic clipboard preview. An isolated storage simulation verified read-without-creation, first-write creation, duplicate retry returning one saved entry and exact note JSON round-trip. No regression suites, live activity writes, medication events or real messages were performed.

## Manual use after publication
Care > select current guest > Recent care activity > choose activity > optional note > Record completed activity. Review the confirmed timestamp. For an owner message: Owner sharing options > Owner update > Daily check-in > Use saved activity for this stay > review > Copy/Share. During ordinary use, confirm that offline/rejected requests retain the draft and a retry cannot duplicate the same entry.

## Release gate
Production project 190HV0h4qkpo5i8agQi415LAM0u51GCo2BgDUkgeFnWga96LbKFfnaYyJ matches the live endpoint. It has 200 versions (2–201); live web app uses 201. Deployed historical versions are 13,16,18; Version 2 is unused. No history has been deleted and no production source has been pushed. Live version 201 and unpublished HEAD were downloaded for review and match repository base (excluding generated deployment attribution). Release requires explicit approval to permanently remove unused Version 2, then push/deploy this reviewed candidate. Keep the frontend unmerged until backend capability is available.

Screenshot summary: output/care-routine-review/review.html. Cache revision candidate 2026.11.03.07.

Next: clearer daily completion summaries using these saved entries.

Token report: two Luna development tasks; exact token usage is not exposed and is not estimated.
