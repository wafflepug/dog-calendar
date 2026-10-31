# Care daily scan

Release candidate `2026.10.31.01` · service worker `v11.4.162-care-daily-scan-five-2026.10.31.01`.

Five Directory-only presentation refinements make the existing daily care information easier to scan:

1. Safety, Medication, Feeding & walks, Routine, Handover, and owner/contact information share a capped label rail so labels and complete values line up across the brief.
2. Emergency details, routine edit, and handover actions have a reserved action column, keeping them separate from care values on tablet and desktop.
3. Category headings wrap safely beside their existing actions on phones and at enlarged text sizes; the daily sections stay stacked on phones.
4. Booking setup status uses readable text sizing and balanced columns through tablet widths while preserving its existing state and Review action.
5. Daily values use a consistent line rhythm while retaining full notes and instructions.

No controls, labels, warnings, hidden states, identities, drafts, handlers, data reads/writes, backend behavior, or Today/Calendar layouts change. Safety and Medication remain complete and visible. CSS is gated to the Directory page. Existing phone targets remain at least 44px.

## Verification

- Actual Directory runtime with `tests/fixtures/care-daily-workflows.js` and the Milo production-profile renderer at 700px and 768px, 200% root text, light and dark: complete five-value content, 44px emergency/routine/handover actions, and no profile horizontal overflow. Screenshots: `evidence/care-overview/production-{700,768}-{light,dark}-200pct-final.png`.
- `care-overview-refinement.browser.spec.js`: 33/33 passed in Chromium desktop, Chromium mobile, and iPhone WebKit before the final hidden-heading guard. After that final CSS guard, the three focused layout specs passed 6/6 in Chromium and WebKit at 390px. The actual runtime geometry capture above also reflects the final guard.
- The broader 330-case daily-workflows run was interrupted during investigation after its first geometry failure; it is not counted as passing. The failing alignment was reproduced and corrected, then focused affected specs were rerun (results recorded in the PR).
- Exact-head CI and production static-asset/release metadata verification are required before publication. No production guest reads, writes, or notifications are used.

Physical phone and mobile PWA refresh checks remain manual.
