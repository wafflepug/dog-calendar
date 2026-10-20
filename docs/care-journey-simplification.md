# Care journey simplification

This bundle audits and refines five existing journeys: arrival, checkout and handover, the daily Care summary, returning-dog setup, and returning to the guest list. It retains the current free frontend and Apps Script architecture.

## Acceptance and verification

| Journey | Happy path | Edge or failure case |
| --- | --- | --- |
| Arrival | Review the existing intake indicator and check in from Staying | Unknown intake stays unknown; failed check-in remains actionable; no profile read merely for rendering the indicator |
| Checkout | Review available belongings and medication, write a handover note and confirm once | Cancel does not write; failed checkout keeps the note; switching guests cannot reuse another stay's note |
| Daily Care | Scan safety, medication, feeding and walks without opening another summary | Long instructions remain available; missing information is distinct from no medication; refreshed content preserves focus and disclosures |
| Returning dog | Select an exact Dog ID and review the dated source before reusing care | Same-name dogs remain distinct; no automatic inheritance or owner message; changed selection cannot retain a stale history response |
| List continuity | Open and close a profile or complete an operation, retaining useful list context | Preserve query and filter; restore an identity-matched row or a safe list fallback after reordering/removal |

Use synthetic records and intercepted writes. Check narrow phones (320/390px), desktop, light/dark themes, fixed navigation, keyboard focus and long text. Compare request counts for unchanged interactions. Fixture measurements do not establish physical-device performance.

## Audit decisions

Arrival review previously required opening Details, then choosing Review care. The refinement replaces those controls with one wrapping button showing the actual intake status and a visible explanation when completion is unverified. Direct check-in remains separate.

The guided checkout previously showed “check Care” for unloaded belongings or medication without a direct review action, and closing the sheet discarded a typed handover note. The explicit “Review Care · note kept” action now opens the exact connected stay's existing profile and keeps one bounded note in memory; staff return to Staying and manually reopen checkout. The note is restored only for the same stay, dog and stay key; ordinary Cancel still discards it. This bridge performs no write or added data read.

The daily Care summary already presents safety, medication, feeding and walks in one place. Existing synthetic browser journeys cover complete and missing values, long instructions, read failures and reminders. The audit's Chromium run passed seven cases, including the 320/390/1440px light/dark matrix. No additional summary, mandatory disclosure or record read is needed.

Returning-dog onboarding already requires explicit Dog ID selection and reviewed, dated care from a completed stay. The existing same-name identity and stale-response checks are retained. This iteration does not add a second reuse control or silently copy historic information.

Checkout now offers Review Care only when the sheet lacks loaded evidence and can identify the exact stay. The explicit review keeps one in-memory handover draft. The existing profile Check Out action or returning to the Staying roster reopens the guided checkout with that note for the same Stay ID, Dog ID and stay key. Normal Cancel discards the current note. A replaced or ambiguous identity stays in the sheet with its note and an explanation. Review never saves a checkout automatically, and focus moves to the visible Care Back control.

Back to the guest list now restores the matched opener's viewport position when rows above it have changed, with a clamped fallback if the original stay is gone. Search, filters and the existing bounded focus restoration remain intact. The implementation adds no storage or record read.

The arrival and checkout browser matrix passed 120/120 cases with Chromium and WebKit at 320, 390 and 1440px, including light/dark layout checks. The synthetic fixture screenshots and complete runner log are under `output/care-journey-arrival-final-results/` and `output/care-journey-arrival-final.log`. Browser fixture measurements do not establish physical-device performance.

## Next backlog items

First, review the Care Back control's clearance from the fixed menu launcher on narrow phones. The 390px full-runtime review screenshot shows the launcher overlapping the left edge of the Back bar. Measure both elements at 320/390px, light/dark and enlarged text; adjust the existing bar's spacing so its label and focus ring are unobstructed. Preserve global menu behavior, 44px controls and the restored guest anchor, with no new navigation control or data read.

Audit mobile multi-dog arrivals and repeated day-care booking. Use the existing visit planner and exact Dog IDs; measure whether carers can distinguish each dog and date without reopening the booking. Implement only demonstrated label, grouping or navigation improvements. Preserve per-visit save identity, partial-failure recovery and explicit owner sharing. Acceptance: same-name dogs and multiple dates remain distinct at 320/390px; no additional startup reads; one failed visit can be retried without recreating successful visits. Use synthetic records and report before/after steps.
