# Care daily workflow value — 2026.10.23.05

## Built Deliverables

1. Planned-visit recovery distinguishes saved, queued and unfinished visits. Queued visits are excluded from Resume; an explicit Check saved visits action verifies the original Dog ID, Stay ID, dates and confirmed booking type against backend history. An absent queue item alone is never proof of success. See [planned visit recovery](plan-recovery-guidance.md).
2. Care preparation preserves the selected tab, drafts and late compatibility updates while avoiding same-value tab/panel writes and repeated loaders. The synthetic measurement fell from 525 attribute mutations on the previous source to zero for the updated repeated-prepare burst. This is a DOM-work result, not a measured improvement in server latency. Cold/warm/switch/return and changed-record checks are described in [Care profile performance](care-profile-performance.md).
3. Same-day arrivals show supplemental prompts for outstanding or unverified intake only. Received intake removes the extra prompt, without implying care was reviewed. Existing safety/medication warnings and Check In remain; Next arrival still includes eligible guests with received forms. See [arrival exceptions](arrival-exceptions.md).

No paid dependency, authentication change, Apps Script deployment or automatic owner message is introduced. Tests use synthetic guests and block external writes.

## Testing Matrix

| Journey | Steps | Expected outcome |
| --- | --- | --- |
| Partial booking | Save a multi-visit plan with one successful, one queued and one unsuccessful response | Exact per-visit outcomes; no duplicate successful or queued submission when resuming other eligible visits |
| Queue verification | Use Check saved visits after sync; exercise exact match, missing match, mismatched dates/IDs, duplicate history and failed read | Only unique authoritative matches become saved; all uncertain outcomes remain queued; no invented care link |
| New dog recovery | Queue a new dog's first stay, then resume | Dependent visits wait for the verified Dog ID; unrelated dogs can continue using their original intents |
| Care repeated preparation | Open a profile, repeat preparation, keep a draft focused and a disclosure open | No redundant tab/panel attribute mutations or profile reads; user state retained |
| Care navigation | Cold open first dog, Back, open another, Back, return, invalidate and refresh changed data | Separate identity reads, warm reuse, changed record rendered after explicit refresh |
| Arrival review | Compare complete, missing, link-ready and unknown intake; navigate Next arrival | Completed form has no supplemental prompt; truthful exception labels; all eligible unchecked-in guests remain reachable |
| Phone/desktop | Verify keyboard, 320/390/1440px, light/dark themes, large text, and fixed footer | No clipping/overlap, 44px actions, correct focus and guest context |

Evidence is stored under `output/releases/2026.10.23.05/` and focused test logs. Physical-phone checks remain manual. Publication is separate from local implementation and requires current-head CI and exact deployed-release verification.

## Local validation snapshot

- MVP readiness: 375 Node tests and five Python contracts passed.
- Arrival component: 42 Chromium/WebKit cases; arrival/checkout responsive integration: six cases passed.
- Profile read journey suite: five cases passed, including cold open, identity switch, Back, warm return, invalidation/changed data and explicit Retry.
- Targeted Care preparation and late-controls checks passed in both engines. The broader tools run exposed startup-timing assumptions; its corrected affected cases passed in both engines.
- Focused booking recovery covers mixed results, original payload preservation, exact verification, ambiguous/failed/duplicate history, shared history reads, repeated confirmation and focus restoration. The earlier broad planner run was 86/90; the identified old-copy, original-plan locking and recovery-focus cases subsequently passed targeted Chromium/WebKit checks. This is not a claim that the entire planner suite was rerun green.
- Latest WebKit phone audits: Today 29 configurations and Calendar 30, both with zero recorded overlap defects. Resize-only request counting pauses intentional interval polls during its measurement; actual resize handlers remain active and strict request equality is retained. Menu/settings checks use real pointer input after verifying touch size and the hit target.

Full current-head GitHub CI remains required. This candidate is committed/pushed for review and has not been deployed. Local synthetic tests do not prove production booking writes or physical-device behavior.

## Next Backlog Item

Simplify departure completion using the existing checkout, belongings and handover flow, showing only unresolved items and keeping explicit checkout confirmation.
