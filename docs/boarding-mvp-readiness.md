# Boarding MVP verification pack

This release targets the existing Waffle House boarding workflow. It is not a multi-business SaaS launch: tenant isolation, business authentication, subscriptions and public onboarding are outside this batch. Existing live access and the Sheets/Apps Script architecture are retained.

## Five delivery items

1. Records & forms: distinguish missing, awaiting, complete, loading and failed records; keep each operation's actions and errors readable.
2. Notifications: readable categories, counts and actions on phone and desktop, with keyboard focus and Settings colours.
3. Later Care arrivals: keep distinct same-name/date bookings visible and select the intended identity without changing persisted Care/media keys.
4. Navigation observer work: avoid unnecessary whole-page maintenance after irrelevant mutations; preserve hydration of late-created controls. Report measurements from identical synthetic workloads, not claimed phone speedups.
5. MVP verification: one local fixture/contract command, CI evidence and a repeatable operator checklist.

## Local automated verification

Run `npm run test:mvp` from the repository. It executes the local Node fixtures for booking identities, receipts, Care drafts, date changes and checkout, followed by the existing Care, checkout, navigation, modal and UI source contracts. It makes no production service calls and stops with a nonzero exit code on failure. Results are written to `test-results/mvp-readiness.json`.

Node and Python must be available. If Python is outside PATH, set `WAFFLE_PYTHON` to its executable path. Browser verification remains in the repository's Playwright workflows; this command does not imply those browsers or physical devices were tested. GitHub's Boarding MVP Readiness workflow publishes the same report.

## Operator acceptance matrix

Use a synthetic booking in a test environment for mutation checks. Production verification is read-only.

| Journey | Happy path | Edge or failure check | Expected result |
| --- | --- | --- | --- |
| Create booking | Create a confirmed stay and reopen its record | Retry the same save intent after an uncertain response | One persisted booking with a stable identity; no duplicate |
| Find guest | Search a dog or owner; expand later arrivals | Two dogs share name and dates but have distinct IDs | Both remain visible; each opens the intended booking |
| Care overview | Open current, arriving and past profiles | Missing information, slow read or failed refresh | Available saved data stays visible; unknown care is not described as clear |
| Edit care or dates | Change a care field and extend checkout date | Rejected save, refreshed conflict, blank required value | Explicit result; failed draft retained; blocked conflict cannot overwrite another stay |
| Records & forms | Open disclosure and use existing intake/document actions | Missing, awaiting, complete, loading and partial-read failure | Separate readable states; supported retry remains usable; no hidden error |
| Notifications | Open from sidebar, switch categories, read an item | Empty list, long message, read/unread states | Counts and actions fit without overlap; keyboard focus remains visible |
| Checkout | Check in, then check out early on the same day | Another same-name/date booking and stale refresh | Intended stay alone moves to Past; calendar ends on actual checkout date |
| Back and navigation | Search, open profile, return, switch page | Background refresh or tab replacement | Query, intended profile identity and relevant focus remain consistent |
| Connectivity | Reload with cached data and failed reads | Offline, no cache, uncertain write | Honest freshness/error states; no false success or blind duplicate write |

## Non-functional verification

- At 320/390/412px and desktop, check long names, values and messages for clipping or horizontal page overflow.
- Check light/dark and all five Settings accents. Normal text should meet 4.5:1 contrast; interactive controls should offer at least 44px targets.
- On physical iPhone and Samsung Fold4: open the keyboard, rotate, scroll dialogs and reach actions above the fixed navigation. Browser emulation does not establish physical-device behaviour.
- Compare observer workload measurements with the same fixture, instrumentation and source baseline. Timing results are local measurements, not evidence of Apps Script latency or production scroll speed.
- Verify the deployed commit and asset revision through System Status/deployment metadata. Cached service workers must load the coordinated revision.

## Release decision

Merge after relevant unit, contract and browser workflows pass. Confirm the public deployment's commit and revision before reporting it live. Record unresolved physical-device checks or source-data ambiguity separately; passing a local fixture suite is not a claim of production data integrity or external-market readiness.

## Next backlog

1. Migrate profile, safety, belongings and media reads to persisted Stay/Dog IDs. Preserve legacy records through an explicit migration map; never assign ambiguous records by name and dates alone. This release blocks conflicting legacy profile reads but does not complete that storage migration. The [first bounded implementation prompt](next-stable-care-record-identity.md) is ready for delegation.
2. Complete physical iPhone and Fold4 acceptance: keyboard, rotation, long records, modal actions and scrolling, recording failures against the matrix above.
3. Prepare a separate free-tier business-authentication pilot with tenant isolation and recovery tests, while preserving Waffle House's current access. Public customer onboarding remains gated on that work.
