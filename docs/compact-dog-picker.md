# Compact dog picker — 25 October 2026

## Six improvements

1. Keep the verified guest and dates visible while placing the identity browser behind **Change dog**. New, pending and unresolved identities retain visible selection and review controls.
2. Remove repeated name/ID instructions from the initial saved-care prompt when the same verified identity is already visible. Requested care reviews retain their dated source and explicit copy approval.
3. Show a bounded set of matching dog cards with a local **Show more** action. Search and the identity dropdown retain access to every loaded dog.
4. Preserve unchanged result nodes, keyboard focus and search edits during refresh. Selected and disabled states must remain accurate.
5. Distinguish loading, loaded and failed identity requests with an explicit retry. A failed read never confirms an identity or silently selects New dog.
6. Show accessible local result counts and a conditional **Clear search** action without losing the selected dog or booking fields.

No backend migration, additional startup fetch, automatic care inheritance or automatic booking save is included. Search, disclosure and pagination work from the current loaded identities.

## Testing matrix

| Journey | Happy path | Edge and failure checks |
| --- | --- | --- |
| Verified returning dog | Open Book Again, verify the external Dog ID and dates, expand Change dog if needed | Missing/duplicate source ID and failed lookup remain unresolved; never close a focused or deliberately opened browser on a late reply |
| Local browsing | Load many synthetic dogs; show more results; search an ID near the end of the list | Same-name dogs remain distinct; query changes reset the visible limit; all loaded records remain searchable; no extra reads from paging |
| Search reset | Enter a query, inspect the result count, clear it | Keep exact selected ID, dates, phone, notes and reviewed care; return focus to search; loading/failed state is not reported as zero matches |
| Stable refresh | Keep a result focused and repeat an unchanged refresh | Preserve the same node and search caret; update selection/disabled states; removed focused results use a safe existing fallback |
| Loading/retry | Delay or fail identity reads, then explicitly retry | No duplicate current-request clicks, false success, background retry or stale response/finally changing a newer context |
| Visit planner | Open and close the planner, select/add/edit dogs and resume a partial plan | Restore browser/field placement, preserve captured identities and care, retain save locks and frozen successful intents |
| Responsive access | Check 320px, 390px and 1440px, light/dark, keyboard and enlarged text | Wrapping names/counts, at least 44px controls, no horizontal overflow or navigation covering dialog actions |

Automated fixtures must block live mutations. Production smoke checks use public release assets and read-only system metadata. Physical-phone verification remains manual.

## Verification evidence

Local checks passed 380 Node tests and five Python contracts. The focused browser checks cover local paging/search, zero identity-subtree mutations during an unchanged render, retained nodes/caret, delayed and failed lookups, stale generations, duplicate UUID rows, synchronous transport errors and safe focus when a result disappears. Returning-care inheritance and the booking-tool regression checks also passed.

The full shipped modal is exercised with 40 synthetic identities at 320/390/1440px in both themes. Paging and clearing search must add zero reads/writes, retain the selected ID and dates, and leave the visible actions reachable. The broader booking/plan matrix and current-head CI remain release gates. These checks establish behavior and bounded initial rendering, not a measured production speedup.

## Next backlog item

Audit the final booking review and owner-link handoff with representative sitter tasks. Prioritize a demonstrated redundant step while preserving explicit save and send boundaries.
