# Next Care backlog item

## Search coverage and result consistency

As a sitter, I can understand whether Care search covers the next seven days or
later arrivals, and I can open the right booking without losing that context.

Inventory the merged explicit later-arrival search and filter renderer first.
Do not repeat the result count, Clear search or lazy expansion already delivered.
Review `waffle-v11.1.95.js`, `waffle-v11.1.96.js`, `waffle-app.js` and the runtime
roster fixtures. Record any specific inconsistency before changing code.

Confirmed review finding: `waffle-v11.1.96.js` deduplicates later events using
the legacy name/start/end stay key before building cards. Investigate two dogs
with distinct persisted IDs but identical names and dates. Preserve the backend
stay key contract while making frontend deduplication identity-aware; do not
silently merge conflicting UUIDs. Add a failing fixture before changing this path.

If gaps exist, use one concise search coverage message and retain the selected
tab, entered query and expanded range after profile Back. Test same-name dogs
with different owners, dates and stable IDs. Keep global counts distinct from
filtered matches. Do not add eager profile/media requests, automatic tab changes,
new backend endpoints or additional introductory text.

## MVP identity-safe arrival rendering (11.1.96)

The later-arrival cache and synthetic-card reconciliation compare validated
stable Dog ID, Stay ID, and Booking ID when present. Contradictory populated IDs
remain separate; copies sharing an ID collapse only when persisted identifiers
do not conflict (a shared Booking ID can tolerate changed descriptive owner
details). For records without IDs, matching source rows collapse by row
provenance; otherwise deduplication requires matching legacy name/date keys and
a matching, non-empty owner with no conflicting phone or breed evidence. A
per-event token keeps an id-less synthetic card stable through refresh without
merging different no-evidence events. The legacy stay key remains on
the card for compatibility with existing profile, media, and backend contracts.
Counts include separate identity-bearing arrivals even when those legacy keys
collide, and each generated card retains the event's Dog ID and Stay ID.

Legacy records with no IDs and the same name, dates, owner, phone, and breed
cannot be distinguished safely by the client. The shared profile-detail loader
now blocks reads and cached profile rendering when visible cards share a legacy
key but have conflicting persisted IDs or populated identity evidence. The Care
Brief also withholds shared care data and shows an identity-review state. A
collision discovered during a pending read cannot mark that response fresh.

This is a protective client guard, not a storage migration. Profile, belongings
and media still use legacy keys in the backend. Persisted-ID reads and an
explicit legacy migration map remain the next identity backlog item; distinct
saved care/media isolation is not claimed by this release.

Acceptance: near-term matches do not hide the explicit later search action;
expanded search and no-match wording agree; query and range persist through Back;
counts remain correct offline; missing cache and failed rendering expose one
useful retry. Check phone 320/390/412 px and desktop, both themes. If inspection
shows existing compliance, document evidence and move to the measured mobile
scrolling task rather than introducing redundant changes.

Deliver bounded Luna implementation where needed, meaningful fixture/browser
checks, lead review and the standard completion report. Performance claims must
use the same measured workload before and after a change. Physical iPhone and
Fold4 validation remains separate from browser emulation.
