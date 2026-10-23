# Multi-visit Care and owner sharing

Candidate 2026.10.23.01 adds five improvements using the existing booking services.

## Deliverables

1. Show the care choice captured for each added dog, including its source date when available. Later form edits do not silently change that captured choice.
2. Edit or remove a specific dog before saving starts. Updating requires an explicit action; Cancel keeps the original row. Saved and queued visit intents stay frozen for recovery.
3. Keep compact selected-dog context on Dates, with the detailed schedule retained on Review.
4. After a confirmed booking, make copying the owner care link the primary next step. Reuse a valid returned link. If none is returned, preparing a link requires a separate explicit action. Additional sharing options stay collapsed. Nothing is sent automatically.
5. Bound CI setup waits, cache browser binaries with separate keys for each browser set, and distinguish setup failures from test failures. Passing matrix groups need not be rerun after an isolated setup failure.

No backend deployment, identity migration or new startup/profile read is required. Local review drafts must not become extra backend payload fields. Owner-link actions retain identity ambiguity checks and discard stale results after guest details change.

## Verification matrix

| Area | Steps | Expected |
| --- | --- | --- |
| Captured care | Add a dog with approved saved care; edit the current form afterward | Added row keeps its captured choice and source; write payload stays tied to that snapshot |
| No inherited care | Add without approval | Row says no care copied; no inheritance payload |
| Edit and cancel | Edit one of two dogs, change fields, then Cancel | Original dog and other row unchanged; no request |
| Explicit update | Edit, review changed saved care, then Update | Only target row changes; approval is deliberate; Review must be refreshed |
| Remove | Remove the named dog before saving | Only that dog and its unsaved visit rows are removed |
| Recovery | Start a save with partial success or a queued visit | Dog editing/removal blocked; successful intents not rebuilt or sent again |
| Dates | Move Dogs to Dates, then back | Compact exact dog context matches current plan; no duplicate detailed schedule |
| Ready owner link | Confirm a synthetic booking returning a valid link; copy it twice | One visible primary action; no new token write; no automatic clipboard/share call |
| Missing owner link | Confirm without a link, explicitly prepare, fail and retry | Booking stays saved; only explicit token preparation retries; booking write not repeated |
| Stale owner result | Change guest/date fields while preparation is pending | Late link cannot repopulate the old sharing card |
| Copy fallback | Block clipboard permission | Link is selectable with manual instructions; no claim that it was sent |
| Layout | Check 320/390/1440px, light/dark, keyboard and enlarged text | Wrapping text, reachable 44px actions, no horizontal overflow |
| CI | Inspect setup cache key and job summary | Chromium-only cache cannot shadow the full browser cache; setup timeout remains a failure distinct from test results |

Use intercepted synthetic saves for booking tests. Keep production smoke checks read-only. Browser emulation does not replace physical-phone verification.

See [CI browser setup](ci-browser-setup.md) for cache and timeout details. Release evidence belongs in `output/releases/2026.10.23.01/`.

## Next backlog item

Review multi-visit completion: give the sitter one compact next-action summary for saved, queued and failed visits, using existing result data and preserving deliberate per-stay owner sharing.
