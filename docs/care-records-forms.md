# Records & Forms refinement

Scope: readable Safety, Digital Intake and PDF records within the existing Care disclosure. Preserve intake link creation, PDF upload/OCR entry, saved document actions and exact stay ownership. No provider or backend change.

Acceptance and testing matrix:

1. Open the section at 320px, 390px and desktop widths in both themes. Long status text wraps; actions remain named, focusable and at least 44px high.
2. Check no intake/no PDF, awaiting owner and existing document cases. Each state has its existing relevant action without duplicated instructions.
3. Delay or fail the existing read. Loading, unavailable and confirmed empty states remain distinct; unknown safety never becomes a false all-clear.
4. Switch stays during a delayed read. Old results cannot update another dog's record controls.
5. Collapse and reopen. This presentation refinement must not add eager document requests or change intake/PDF mutations.

Automated checks execute actual renderers and shipped styles through `playwright.care-overview.config.js`, retaining release, first-open and existing Care regression checks. Physical iPhone and Fold validation remains a manual follow-up.

Next bounded backlog: refine Stay Contact & Handover presentation, with readable contact actions and concise saved/unsaved feedback. Retain existing owner editing and handover draft safety.

Delegation brief for that next item:

- Use the existing `data-directory-stay-contact` disclosure in `waffle-app.js` and its shipped CSS. Separate readable owner/contact values from the handover note; retain the existing edit field targets and exact stay ownership.
- Make long names, phone values and multiline notes wrap at 320px without clipping or touching the navigation footer. Keep actions at least 44px high with visible keyboard focus, using current theme/accent tokens.
- Preserve existing draft capture, discard confirmation, duplicate-identity guards and save payloads. Do not add backend calls or change profile loading.
- Verify empty contact information, long values, dirty edits, failed save and switching between same-named dogs. Extend actual-renderer browser coverage and run existing Care state preservation tests.
- Deliver one bounded implementation commit, relevant tests and a completion report. Deployment remains a separate reviewed step.
