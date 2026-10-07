# Care search clarity

Care search now matches only each loaded stay's dog name, owner name, validated numeric Dog Number, or validated Dog ID. It no longer searches loaded profile notes and fields. The selected tab's query count and no-match state are announced in a separate status region; Clear search resets the input, retains the selected tab, and returns focus to the input.

The next-seven-day and later-arrival controls remain lazy. Typing a query does not read or materialize deferred stays and does not switch tabs. On Arriving, a no-match message says later arrivals are excluded while the explicit range button offers the longer view. Existing profile navigation continues to capture the entered query and list scroll position for Back restoration.

Past stays with distinct valid Dog IDs now remain separate roster groups even when dog names and breeds match. Past cards expose the Dog ID, Dog Number, and Stay ID only when supplied by the booking response. ID-less historical rows retain their legacy name-and-breed grouping because the source does not provide enough identity evidence to split them safely.

This is a roster/search change. Existing identity-review guards still apply when distinct dogs share a legacy name/date stay key; it does not migrate saved care or media records.

Focused browser coverage is in `tests/care-roster.spec.js`, `tests/care-future-arrivals-lazy.browser.spec.js`, and `tests/care-navigation-continuity.browser.spec.js`. The fixtures block live writes.

## Manual verification

1. In each Staying, Arriving and Past filter, search by dog name, owner and a displayed ID such as `#00017`. Check the query count separately from the filter's total.
2. Search for an unknown name and a long pasted ID. The message and Clear search action must fit at 320px, 390px, Fold/tablet and desktop widths in both themes.
3. Clear the query: keep the selected filter, return focus to search and show the loaded list and its month headings again.
4. On Arriving, search for a later dog before opening the longer range. Verify the coverage explanation, then choose View later arrivals explicitly. Collapse the range and verify the explanation returns; typing must not change the filter.
5. Open a matching profile and return to Guests. Keep the query, filter, expanded range and restored list focus/position. Search alone must not initiate profile or photo reads.
6. Verify distinct saved IDs remain separate for same-name/same-breed past dogs. Existing legacy identity conflicts must retain their review state.

Physical VoiceOver/TalkBack and phone verification remain separate from browser emulation. The next bounded implementation is described in `next-care-empty-states.md`.

## Automated validation

All 227 Node tests passed. The final search and navigation matrix passed 18 cases across mobile Chromium, mobile WebKit and desktop Chromium; the five isolated roster tests also passed. Fixtures use a fixed date with normal timers and block live writes. The pointer-access matrix and full GitHub workflow remain release gates.
