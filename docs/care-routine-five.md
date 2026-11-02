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

## Publication and history cleanup
On 3 November 2026, following the user's request to remove redundant Apps Scripts, removed 21 oldest unused historical versions: 2–12, 14–15, 17 and 19–25. Google's deletion dialog confirmed these were not used by active deployments. All current source files, deployed versions 13/16/18/201 and recent rollback history were preserved. Version count fell from 200 to 179; no guest data or triggers were changed.

Production project 190HV0h4qkpo5i8agQi415LAM0u51GCo2BgDUkgeFnWga96LbKFfnaYyJ was published manually as Version 202 from reviewed commit 591b430. The existing live deployment URL was retained. A cache-busted read-only get_data_versions request confirmed careRoutineLogVersion=1 and Care identity enrollment still disabled. No activity writes or notifications were sent. The manual deployment intentionally has no workflow attribution; the main-branch deployment workflow can supply its own attribution on publication.

Before deployment, downloaded live201 and unpublished HEAD matched the repository base except generated deployment attribution. Rollback201 remains available. Cleanup receipt: output/care-routine-deployment/history-cleanup.jpg.

Screenshot summary: output/care-routine-review/review.html. Cache revision candidate 2026.11.03.07.

Next: clearer daily completion summaries using these saved entries.

Token report: two Luna development tasks; exact token usage is not exposed and is not estimated.
