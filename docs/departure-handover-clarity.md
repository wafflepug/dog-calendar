# Compact departure handover

Candidate 2026.10.22.02 refines the existing due-today checkout sheet. Staff can scan the selected dog, booked dates, today's checkout date, each loaded belonging and the complete medication instructions before confirming. Missing Care details use one shared review prompt. Unknown information never becomes a claim that there is no medication, no belongings or that items were returned.

Opening checkout focuses its heading rather than Confirm checkout. Keyboard navigation skips hidden controls and stays inside the sheet. The body scrolls while the footer remains available on short screens. Mobile stacks the two evidence panels; desktop displays them side by side. The same-stay Care review bridge, optional handover note, verified operation save and separate Early Checkout flow remain in place.

There are no extra startup/profile reads, new persisted fields, backend deployment or automatic owner messages. Loaded values come from the existing selected card. Historical care reuse and checkout completion still require their existing explicit actions.

## Testing matrix

Use synthetic records and intercepted saves for checkout tests. Do not check out a live guest for validation.

| Area | Steps | Expected result |
| --- | --- | --- |
| Loaded handover | Open a due-today checkout with two belongings and long medication instructions | Items have separate lines; all instructions remain available; booked dates and today's checkout are labelled; no write on opening |
| Missing information | Open with one or both evidence sources unavailable/loading | Unavailable labels and one shared Care review prompt; no invented None or Returned state |
| Explicit empty information | Load a recorded empty belongings message or “No medication instructions saved” | Exact saved wording remains distinct from unavailable evidence |
| Keyboard | Open, press Enter, then Tab and Shift+Tab from heading and dialog boundaries | Enter does not save; focus stays on visible controls; hidden Care review is skipped; Escape dismisses before saving |
| Review Care | Type a note, choose Review Care, then reopen checkout for the same stay | Note restored only for matching Stay ID, Dog ID and stay key; no automatic save |
| Cancel and another guest | Type a note, cancel, reopen; also select a same-name guest | Cancel discards the note; no note or identity crosses guests |
| Save and recovery | Confirm once; simulate transport failure, queued result and identity conflict | Only verified success moves the selected stay to Past; duplicate submit blocked; safe retry retains note; uncertain/conflicting saves do not move it |
| Responsive | Chromium/WebKit at 320/390/1440px, light/dark, long content, enlarged text and a short viewport | No horizontal page overflow; note reachable by scrolling; footer buttons hit-test correctly and remain at least 44px high |
| Existing flows | Exercise direct check-in, separate Early Checkout and optional post-checkout message | Existing behaviour retained; owner communication remains explicit |

Run `playwright.arrival-checkout.config.js`, the departure cases in `playwright.care-daily-workflows.config.js`, and `scripts/check-mvp-readiness.js`. Screenshots and runner logs are saved under `output/releases/2026.10.22.02/` and `output/departure-handover*`. These are browser fixture checks, not a claim of physical-device coverage.

The publication smoke retains its exact-commit manifest gate and now allows up to 72 five-second polling intervals for Pages assets, following two releases where the former 24-interval window expired before publication. This changes only the metadata wait, not smoke assertions or application timeouts.

## Next backlog item

Audit returning-dog booking setup: show the selected permanent Dog ID and dated care source once, with a concise explicit reuse decision. First reproduce a real clarity problem in the existing flow. Keep same-name dogs separate, ignore stale source responses, preserve partial-save recovery and add no startup reads or automatic care inheritance.
