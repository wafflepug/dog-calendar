# Care profile quick actions

The Care overview shows a single compact freshness line. Its label preserves the current saved, unknown-time, offline, loading, refresh, error, missing-record, and identity-conflict state. The “Details” disclosure expands the exact existing freshness text, including the source timestamp and shared-record provenance. Opening a profile does not refresh or change the source timestamp, and the label does not imply that anyone reviewed the care instructions.

Profile photo upload and gallery controls live together in the closed-by-default More tools section. They remain the same delegated buttons inside the same guest card; opening the section does not read profile or photo data. A photo read or upload starts only after its existing control is explicitly activated, and the selected card's stay identity remains the action context.

The first-level Owner Care Link action and its existing intake-status badge share one labeled group. The badge continues to report only evidence already available to the runtime: Form received, Link ready, Not prepared, or Status unknown (including legacy care whose current form completion is unverified). No link is generated or sent by opening the profile or grouping these controls.

Acceptance checks for this change:

- Compact freshness state is visible while exact timestamp/provenance remains expandable; every existing freshness state and identity guard remains truthful.
- Re-rendering unchanged profile data leaves the freshness DOM and disclosure focus/open state intact.
- The avatar has no photo controls overlaid. Photo tools are keyboard reachable, have at least 44px touch targets, retain the current guest context, and cause no read until activated.
- Owner link remains first-level and grouped with the single existing truthful intake badge across received, link-ready, not-prepared, and unknown states; same-name guests remain isolated.
- At 320, 390, and 1440px in both themes and doubled text, Safety and Medication remain visible, content does not clip, and expansion adds no duplicate controls or requests.

## Task Completion Report

### Built Deliverables

- A compact source-state label with the original full update timestamp and shared-record explanation behind a native disclosure. Offline, unavailable and identity-review states remain explicit.
- Photo upload and gallery in More tools, with labeled 44px controls and the original selected-stay action handlers. Closing the hosted uploader also clears its visual loading cover while retaining the paused upload session.
- One Owner Care Link and its existing form-status badge in a wrapping first-level group. Repeated preparation preserves the controls and does not generate links, send messages or start new reads.

### Testing Matrix

| Path | Steps | Expected result |
| --- | --- | --- |
| Saved care | Open a profile, expand Details, close and reopen it | Compact saved date; exact source timestamp and explanation on demand; opening does not change it |
| Unavailable care | Exercise offline saved care, failed refresh, missing record and identity conflict fixtures | Accurate visible state; no claim that instructions were reviewed or current form received |
| Photos | Open More tools, activate upload, close, then open gallery | Avatar unobstructed; controls retain selected stay; uploader cover removed; only explicit gallery action reads photos |
| Owner sharing | Use profiles with received, prepared, absent and unavailable intake evidence | One original action and one truthful badge; actual link dialog matches selected dog and dates |
| Small/large screens | Check 320, 390 and 1440px, both themes, keyboard and enlarged text | Wrapping without horizontal overflow, visible Safety/Medication, operable disclosures and footer clearance |
| Repeated updates | Refresh unchanged presentation and switch same-name guests | No duplicate nodes, unchanged disclosure/focus preserved, no cross-guest badge or photo context |

Automated evidence is recorded under `output/releases/2026.10.23.04/`. Synthetic local tests block external writes; browser checks are not evidence of a live production profile interaction. Publication requires current-head CI and release verification.

### Next Backlog Item

Audit queued multi-visit recovery messaging against existing saved, queued and failed states, with a compact next action and no automatic resubmission or added background polling.
