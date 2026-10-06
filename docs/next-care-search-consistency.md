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
