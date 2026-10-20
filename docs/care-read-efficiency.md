# Care Read Efficiency — 2026.10.20.02

This iteration implements the first five performance backlog items on the existing free Sheets/Apps Script architecture. It changes no access flow, customer records, schema, or identity enrollment setting.

## Built deliverables

1. Anonymous timing distinguishes the client request round trip from the versioned backend read wrapper's elapsed time and reports a fixed server-cache state. This is not total Google execution time: routing, platform startup, serialization and transit outside the wrapper are excluded. Missing backend metadata remains unknown. The existing in-memory diagnostics retain at most 50 anonymous samples and upload nothing.
2. Active and Past directory builders reuse the booking snapshot they already loaded when resolving digital intake status. The active booking-values path loses one repeated read; Past retains its separate display-values read. Profile detail already used one booking snapshot plus one Care snapshot and retains that behavior.
3. The existing versioned cache keeps its current TTLs. A conditional acknowledgement requires an available server snapshot with the same version, query variant and opaque response token. Expired, missing or obsolete snapshots rebuild. A new snapshot gets a different token even if a direct Sheet edit did not bump the application version; another device with the older token receives the full replacement payload.
4. Clients persist tokens in the existing cache entry and request compact unchanged responses only when they retain eligible data. Missing or mismatched acknowledgement metadata triggers at most one unconditional retry. Cache eligibility is checked again after asynchronous work, so a write cannot revive a retired profile cache generation. Full responses from older backends remain supported.
5. Identical intake overview updates avoid repeated visibility/data-attribute writes, and already-closed change reviews avoid another close assignment. Existing changed-only summary renderers remain active for changed, removed, failed and unknown states. No new request, polling job or observer is introduced.

## Testing matrix

| Journey | Steps | Expected |
| --- | --- | --- |
| Cold and warm reads | Clear the synthetic server cache; read twice, then send the returned token | Build once; miss, hit and unchanged states; compact acknowledgement omits guest payload |
| Expiry and two devices | Retain A's old token; expire the server entry; rebuild changed fixture data for B; refresh A | A receives the changed full payload despite an unchanged application version |
| Application write | Change the directory data version between fixture reads | Prior snapshot cannot validate; fresh data rebuilds |
| Old server/client | Omit response tokens from saved data or server replies | Full reads work; an unverifiable unchanged marker retries once, never loops |
| Identity and pending write | Use distinct stable guest IDs; retire a generation while its request is pending | No cross-guest response sharing or stale cache resurrection |
| Offline/failure | Reject saved identity or fail a refresh with valid saved data | Invalid data is not reused; eligible saved data keeps existing honest offline/error behavior |
| Browser DOM work | Repeat identical digital/legacy/overview renders; then change flags/status | No redundant intake overview mutations; changed information still appears; focus, drafts and disclosures remain |
| Diagnostics | Open/reopen a profile and inspect `WAFFLE_CARE_PERFORMANCE.snapshot()` | Round-trip and explicit backend duration remain separate; no names, IDs, notes, URLs or payloads |

All automated mutation and failure scenarios use synthetic fixtures. Local read counts and DOM mutations do not establish a production wall-clock speedup. Physical phone behavior and Google runtime latency require separate observations. Deployment status is reported with the task completion evidence rather than inferred from this document.

## Next backlog item

Coordinate visibility-aware background refreshes: inventory existing jobs, suppress only demonstrated overlap, and pause unnecessary hidden-page work while preserving return-to-app freshness and explicit Retry.
