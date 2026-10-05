# Care later-arrival search

Care initially shows the next seven days of arrivals. Searching the roster keeps that scope until the user selects **Search later arrivals**. The action uses the existing confirmed-event cache and materializes lightweight cards within the existing six-month horizon; it does not fetch every detailed profile. Profiles and belongings remain lazy.

The query and selected tab stay unchanged. Clear hides the action and resets the query. Query/tab changes invalidate queued materialization. If local rendering fails, the original roster is retained and a single Retry is offered. Cached results can be searched offline; these results are not a claim that every remote booking was searched.

Persisted Stay ID, or Dog ID plus dates, distinguishes known same-name stays. The CSV cache bridge retains named Dog ID/Stay ID fields. Name/date compatibility remains for legacy records only when the match is unambiguous and known IDs/owner context do not conflict. No IDs are generated and no booking writes are added.

## Verification

1. In Arriving, search for a dog outside the next seven days. Confirm no expansion until selecting Search later arrivals, then confirm the query remains and the matching result appears.
2. Search for a missing dog after expansion; confirm coverage text refers to cached arrivals. Clear, switch tabs and return; confirm no stranded busy button.
3. Open a result and return; confirm query, list position and opener focus restore. Check same-name dogs with different persisted IDs remain distinct.
4. Repeat at 320px in light/dark themes with Chromium and WebKit. Check readable text, visible focus and 44px controls.
5. Search cached results offline and simulate a local rendering failure; confirm no network dependency and one usable Retry.

Automated coverage: tests/care-future-arrivals-lazy.browser.spec.js and playwright.care-future-arrivals.config.js; full-runtime navigation continuity and first-open cache/loader suites. GitHub cross-device UI workflow runs the focused suite.
