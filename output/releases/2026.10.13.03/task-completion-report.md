# Task Completion Report — Read-only Care Startup

## Built Deliverables

- Care startup, page restoration and maintenance-clear install Settings controls without running bulk Master Profile photo writes.
- Settings photo maintenance explains Dog ID matching, preserves booking-specific images and shows inline progress, completion or errors. Offline attempts send no request. Recognized transport failures offer a focused, deliberate Retry; identity errors and malformed/queued responses do not.
- Post-save upcoming-card refresh is scoped by supplied Dog ID when available.
- A guarded synthetic Google harness validates persisted Care identity without reading customer rows or deploying Apps Script. Its tests are wired into backend CI.

## Testing Matrix

| Scenario | Verification | Expected result |
| --- | --- | --- |
| Care startup | Open Care, switch filters, open a guest and toggle Detailed Care categories | No bulk photo-sync request; ordinary reads remain available |
| Explicit maintenance | Open Settings and select Resync Master Profile Photos, confirm once | One request; inline counts; booking-specific photos retained |
| Offline | Disconnect before selecting resync | Inline error; zero requests |
| Identity / invalid response | Return ambiguous identity, missing success, queued result or invalid counts | No success message and no blind Retry |
| Recognized transport error | Return a transport-marked error, select Retry, double-activate | Focused Retry; one additional request; controls restored |
| Google identity | Run the allowlisted synthetic harness | 11 case outcomes pass; 34/36/36 headers; duplicate/conflicting identities rejected; read snapshots unchanged |
| Property restoration | Inspect private test project after harness | Enrollment false; existing belongings sheet setting restored |

Local automated verification: 284 Node tests pass. Five focused full-runtime browser tests pass. Browser coverage includes phone, tablet and desktop widths, both themes, enlarged text, keyboard navigation, and fixed-footer clearance. Physical iPhone/Fold hardware has not been tested.

The app layer normalizes a JSONP abort to a generic Apps Script error, so that path intentionally offers no Retry. The recognized transport Retry branch is tested with a synthetic TypeError; this is not evidence of automatic recovery from every network failure.

Google validation uses a new synthetic workbook in the owner's account. An initial harness-only date coercion mismatch was corrected and reproduced in local mocks; production identity code was unchanged. Private target IDs and raw evidence stay outside tracked artifacts. Receipt recovery and other endpoint callers are not covered by this harness. Production Care identity enrollment remains disabled.

## Next Backlog Item

1. Validate receipt recovery and identity-bearing endpoint callers against synthetic bookings, including interrupted-save recovery and conflicting IDs.
2. Record actual iPhone and foldable-device acceptance for Care editors, Settings feedback and fixed-navigation clearance.
3. Measure Care profile read timing after removal of startup maintenance; prioritize remaining backend reads from observed timings.

Release checks and deployment attribution are recorded separately after CI and merge.
