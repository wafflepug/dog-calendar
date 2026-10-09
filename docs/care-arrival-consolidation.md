# Task Completion Report — Unified Care Arrivals

Release candidate 2026.10.09.04.

## Built Deliverables

The future-arrivals CSV bridge now preserves header-indexed Dog ID, Stay ID, Dog Number and booking identity. Previously it discarded those identifiers, so the safe identity matcher treated the same booking's native profile and synthetic arrival as separate records. Matching copies now consolidate without collapsing separate stays or different persisted dogs.

Later arrivals use the canonical roster structure: avatar, name, readable Dog ID, breed, start–end dates and status in one card. The old floating date bar is removed. Native arriving profiles also show the complete date range in their context line. Later profiles still load only when opened; the next-seven-days view and on-demand expansion remain.

## Testing Matrix

| Journey | Steps | Expected |
| --- | --- | --- |
| Near arrivals | Open Care → Arriving | One Benny card with dates and profile details |
| Later arrivals | Choose View later arrivals | One card per stay, including Luna; no separate date-bar row |
| Repeat stays | Inspect Scooby's two different stays | Both remain separately visible with correct dates |
| Identity | Load copies with persisted dog/stay IDs | Matching booking consolidates; conflicting IDs remain separate |
| Lazy access | Expand later arrivals, then open Benny | Expansion sends no profile reads; opening requests the correct dog/stay |
| Layout | Phone light, phone dark WebKit, desktop | Avatar and dates visible; no horizontal card overflow |

Synthetic read-only fixtures are used; no customer booking rows change in this UI fix. Physical-device checks remain manual. Final test, merge and deployment results are recorded in the completion message.

## Next Backlog Item

Measure live Care profile opening delay and prioritise immediate essentials with deferred secondary data, while keeping saved drafts and stable dog identity intact.
