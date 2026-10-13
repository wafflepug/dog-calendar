# Task Completion Report — Care Loading and Cache Freshness

## Built Deliverables

- Verified cached profiles appear immediately. Online reopening or returning focus after the 45-second freshness window starts one shared version-aware revalidation, without global polling. Dirty local drafts remain intact.
- Belongings and Photos use one reader keyed by the full dog/stay identity. Server identity proofs are checked before sharing or caching a record. Offline saved data remains usable; failures and forced retries remain bounded.
- Quiet notifications and automatic AI health checks wait until the initial Care roster has rendered, including cached or empty results, or the initial request has settled. Secondary jobs coalesce and run serially. Explicit notification and AI actions bypass that startup queue.
- Read generations prevent superseded results from replacing current records. Saved browser-cache writes are guarded against responses from before a local mutation.
- The startup coordinator is included in the runtime and service-worker shell. CI covers the new coordinator, full-runtime startup/freshness flows and the Photos fallback.

## Testing Matrix

| Case | Steps | Expected result |
| --- | --- | --- |
| Cold Care load | Open Care in a fresh browser session; observe the guest list and network requests | Initial directory read precedes quiet notifications and AI health; guest interaction remains available |
| Warm reopen | Open a profile, return to the roster, then reopen it within 45 seconds | Saved details display immediately; no extra profile request inside the freshness window |
| Other-device update | Save a feeding change on another device; after 45 seconds, return focus to the first device or reopen its profile | One revalidation updates the visible saved record |
| Unsaved draft | Type a feeding draft; return focus after the freshness window while another saved version is available | Background refresh does not replace the typed draft |
| Belongings and Photos | Open both sections for the same stay, then switch between them again | One cold shared read; fresh warm reads reuse the verified result |
| Conflicting identities | Use synthetic dogs sharing a name/date key but different stable IDs | Separate requests/cache entries; mismatched server identity is rejected |
| Offline | Revisit a previously saved profile offline, then try an uncached one | Cached details remain available; no background network request; missing data is reported rather than invented |
| Failed refresh | Simulate a network failure while cached details are visible, revisit twice, then explicitly Retry | Saved data stays visible; failure feedback appears; cooldown prevents repeated automatic requests; Retry performs one fresh read |
| Save/read race | Hold an older response, save newer data, then release the older response | Superseded response does not replace newer memory/UI or repopulate saved cache |
| Explicit tools | Open Notifications or ask AI before the initial roster request completes | Explicit user action proceeds without waiting for the startup queue |

## Verification and Limits

Request-count fixtures demonstrate two independent Belongings/Photos requests becoming one shared request. A fresh warm or offline memory hit makes zero additional reads; concurrent refreshes after the freshness window share one read. These are synthetic request-count observations, not measured production latency reductions.

The production Sheets/Apps Script architecture and access flow remain unchanged. Cold server execution can still take time. Cross-device updates are refreshed on subsequent focus/reopening after the freshness window, not pushed instantly. Physical phone hardware acceptance remains unverified.

Automated totals, current-head CI and live deployment attribution are recorded in the verified report after release.

## Next Backlog Item

1. Scope cache invalidation to the affected dog/stay after writes, with coverage for date edits, checkout, intake and photo changes.
2. Measure booking-sheet reads on cold profile requests, then narrow range transfer only where evidence shows a benefit and identity checks remain intact.

Local verification: 301 Node tests pass; 23 focused browser tests pass (9 full-runtime Care, 7 Photos/fallback, 5 cold/warm timing and recovery, 2 intake metadata/readability). The current source was reviewed by the lead model after Luna implementation. Test fixtures block customer-data mutations. Detailed Care also retains responsive, enlarged-text, theme, keyboard and fixed-footer checks.

A broader CI case caught a dirty-draft metadata regression. The fix updates saved field count/source metadata independently of the editor DOM; the existing empty-to-populated-to-empty intake case and enlarged intake readability check pass with the draft and disclosures retained.
