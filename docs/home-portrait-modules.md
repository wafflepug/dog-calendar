# Home portrait modules

Home shows Your Guests followed immediately by Upcoming Arrivals. Both use canonical stay keys, the local calendar date and the shared Care photo sources, with initials when a photo is absent or broken. Portrait links open the matching `directory.html?stayKey=...` record; rendering never writes guest data.

Upcoming Arrivals covers the inclusive interval **today through today + 29 days**: exactly 30 local calendar dates. Local date arithmetic handles daylight-saving changes. Arrival dates sort ascending, then dog name and stay key. Repeated bookings for a dog remain separate stays.

Only boarding/confirmed boarding (including legacy untyped boarding events) is eligible. Potential/tentative requests, meet-and-greets, cancelled, completed, checked-out or already checked-in stays are excluded. Today's arrivals follow the canonical Arriving Today rule: expected until checked in. Those stay keys are omitted from Your Guests until check-in so the rows do not duplicate them. Existing stays that began before today remain current under the existing date-based selector.

The new portrait module replaces the older seven-day Coming up list. Today's agenda, capacity, Meet & Greet outlook, full calendar and pending requests remain available.

Validation is in `tests/home-guests.spec.js`: day 0, day 29 and day 30; DST, leap day and year rollover; exclusions; ordering; repeated identities; check-in transitions and preserved focus; Care/gallery/master photo fallback; empty/loading/error states; navigation and responsive bounds. `playwright.first-open.config.js` additionally protects upgrades with an older service worker and cached assets still active.
