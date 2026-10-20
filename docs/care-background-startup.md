# Care Startup and Refresh — 2026.10.20.03

Performance backlog items 6 and 7 build on Care Read Efficiency. This frontend change keeps the existing free architecture, backend, cache lifetimes, access and identity safeguards.

## Built deliverables

- The existing five-minute build-manifest interval skips hidden pages. Initial loading, visible intervals, return-to-app checks and persisted-page restoration retain their existing behavior and request coalescing.
- When Care reconnects while hidden, its directory freshness is invalidated, but its roster read waits for the existing foreground scheduler. Repeated foreground events retain the existing debounce, freshness and pending-load guards. The one-minute roster interval was already visibility-aware and remains so. Explicit refresh, popup returns and mutation delivery retain their paths.
- Care preparation coalesces pending timers with the same requested delay. Distinct compatibility passes and late hook-installation retries remain. This reduces repeated active-profile scans and tab/panel preparation without removing tools or adding a polling loop.
- On Care, calculations and reads for the closed Sitter Tools Reminders/Insights panels wait for user intent. Opening either panel and using its Refresh still work. Visible panels refresh after data changes; closed Care panels wait until opened. Other pages retain their original startup behavior. This concerns generated Sitter Tools suggestions; visible Care alerts, notification badges and the separate Organiser records retain their paths.

Synthetic measurements: one hidden build interval changes from 1 fetch to 0; the foreground return still makes one probe. Hidden reconnection adds zero directory reads and its foreground event burst makes one; explicit refresh can still request another read. A three-request preparation burst changes from 10 prepare invocations to 4, retaining the immediate and 80/240/650ms checks. A synthetic active arrival previously caused two unused Sitter Tools startup reads; Care now makes zero until intent, when the same two reads run. These are request/pass counts, not a measured production page-load speedup. Existing page-specific module loading and secondary startup scheduling were audited and retained; no JavaScript bundle-size reduction is claimed.

## Testing matrix

| Journey | Steps | Expected |
| --- | --- | --- |
| Initial loading | Open Care visibly and in a hidden fixture; reveal the hidden page | Initial build check remains; foreground return checks freshness |
| Background idle | Hide the page and advance its five-minute build interval | No interval build fetch while hidden; visible interval works |
| Reconnect | Dispatch repeated online events while hidden, then focus/visibility/restored-page events | No hidden roster read; one foreground roster refresh |
| Manual recovery | Use Refresh guests after foreground refresh; fail a profile read and Retry | Explicit actions still work and retain the intended identity |
| Startup burst | Trigger repeated preparation requests, mixed delays and another request after a timer fires | Duplicate pending delays share a pass; later work can schedule again |
| Late controls | Open a guest, allow delayed controls to mount, then navigate existing profile tools | Controls initialize and remain keyboard-accessible without extra profile reads |
| Secondary tools | Load Care, then open Sitter Tools Reminders and Insights; change fixture data with panels open/closed | No unused startup reads; requested panels render current data; other pages retain eager startup |
| Operational continuity | Check current/arriving/Past fixtures, saved care, draft retention and popup return | Existing operational actions and failure messages remain available |

Automated browser scenarios use synthetic fixtures and block production mutations. Physical iPhone/Fold checks and production latency percentiles are separate observations. Release status and exact test counts are recorded in the task completion evidence.

## Next backlog item

Audit photo delivery budgets using actual delivered dimensions/bytes, duplicate downloads and decoding work. Thumbnails, deferred galleries and gallery reuse already exist; measure a remaining gap before changing storage or adding a service.
