# Task Completion Report — Care Profile Performance

## Built Deliverables

1. Shared profile reads use the validated Dog/Stay identity. Concurrent canonical and secondary Care consumers share one request; conflicting identities never share profile data. Verified memory results are reused; explicit refresh still reads the server.
2. Verified saved essentials appear before the fresh response. Identity conflict, missing records, offline status and retained edit drafts keep their existing protections.
3. Local anonymous timing is available through `WAFFLE_CARE_PERFORMANCE.snapshot()` and `.clear()`. The last 50 samples report click-to-shell, click-to-loaded-details, read duration and actual cache-boundary status. No dog identities, names, contacts, dates, payloads, URLs or error text are stored or uploaded. `backendMs` stays null: client timing cannot isolate Apps Script execution from network/cache work. A detail-loaded marker measures when saved profile fields are rendered, not completion of every optional section or photo.
4. Care profile reads use one attempt with a 15-second timeout. Joined reads share failure; pending state clears for one explicit Retry. A bounded 15-second failure cooldown prevents deferred badge consumers from silently retrying; explicit Retry bypasses it. Forced refresh during an ordinary pending read queues one shared follow-up without overlapping requests. Mutation writes and their durable retry policy are unchanged.

No paid service, database migration or customer data mutation is introduced. Waffle House keeps its existing access flow.

## Testing Matrix

| Journey | Verification | Expected |
|---|---|---|
| Cold open | Open Care and select a dog with no saved profile | Immediate shell; one identity-scoped profile read |
| Saved essentials | Hold the fresh response while saved details exist | Saved feeding/medication shown before response; saved/refreshing label |
| Shared consumers | Open profile while source badge also loads | One request for the same identity |
| Identity conflict | Give equal-name/date stays different stable IDs | Separate requests; no exchanged details |
| Failed read | Block request, then restore connection and Retry | One visible recovery action, one new request, correct identity |
| Draft | Edit a field during refresh or navigate away | Draft retained; stale response cannot replace selected dog |
| Live timing | Open/reopen a dog and inspect snapshot | Bounded anonymous durations; cache status from actual boundary; backend time null |
| Device layout | Verify on physical iPhone and Fold 4 | Existing profile/navigation and retry remain usable |

Browser fixtures are read-only and synthetic. Physical device checks remain manual. Final test/deployment results are in the task completion message.

## Repeated preparation audit — 2026.10.23

An unchanged selected-profile preparation previously re-ran the selected tab loader and the normal delayed reassertions. On the actual prior `care.js` source, a browser `MutationObserver` scoped to the Care tablist and managed panels recorded 525 attribute mutations during one repeated preparation (21 repeated writes across 25 IDs, roles, ARIA and visibility attributes). The updated code retains the bounded delayed reassertions, coalesces pending callbacks per card and delay, skips the loader when the selected tab is already prepared, and guards same-value state writes; a three-call preparation burst recorded 0 tab/panel attribute mutations. The cold open remained one identity-scoped profile request, and repeated preparation added 0 requests.

The synthetic read-only browser fixture also measures cold open, a switch to a second Dog/Stay identity, Back, warm return, then invalidation and a changed response. It observes one read for each cold identity, no read for the warm return, and one explicit refresh read after invalidation; reopening renders the changed record without another read. External write actions are blocked. This measures requests and DOM mutations, not elapsed-time improvement.

## Next Backlog Item

Use measured read durations to target repeated Apps Script spreadsheet reads and cache suitable summary data, without changing the current boarding workflow.
