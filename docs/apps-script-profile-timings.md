# Apps Script profile efficiency and operation timing

## Deliverables
- Master-profile derivation accepts a request-local booking snapshot. Loading and saving a master profile reuse it for identity resolution and Care ownership matching.
- Care lookup is scoped to verified stay keys for the selected dog; an empty verified-key set returns no Care records instead of requesting all records.
- Check-in/out responses include operationTimings: lockWaitMs, lookupMs, writeMs, versionMs, auditMs, profileSyncMs and totalMs. A successful operation emits the same numeric timing fields and fixed operation status in the Apps Script execution log. No names, contact details, IDs or notes are added to the timing log.
- Normal profile response and write/audit semantics remain. No persistent cache or new Sheets logging is introduced.

## Focused validation
JavaScript syntax/diff checks, operation identity tests, Care read-count checks and dog-ID/master-profile identity tests passed. The dog-ID test fixture was updated to load the existing phoneTextCell_ helper and model plain-text formatting. A focused VM check verified one top-level booking read, verified-key scope and preservation of the contact/profile values. No live guest writes, no broad regression suite and no live speed claim.

## Reading timings
After a normal business check-in/out, inspect the Apps Script execution log event stay_operation_timing. Compare several normal operations; cold starts/network time are outside these server-phase measurements. lockWaitMs measures this function's lock attempt; if the outer router already owns the lock, its prior wait is excluded. Timings are successful-path measurements; errors before the response do not emit a complete phase report. None are displayed in the customer UI.

## Next
Use real phase measurements to choose the next optimisation. Profile-sync and audit remain synchronous and must not be removed merely to reduce latency. No visual changes were made; the before/after evidence is request read behaviour and numeric timings, so UI screenshots are not applicable. Exact token usage unavailable.
