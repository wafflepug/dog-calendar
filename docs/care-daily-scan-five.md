# Care daily scan

Release candidate `2026.11.01.02` · service worker `v11.4.164-care-daily-scan-2026.11.01.02` (after Cino intake release `2026.11.01.01` / SW163).

Five Directory-only presentation refinements make the existing daily care information easier to scan:

1. Safety, Medication, Feeding & walks, Routine, Handover, and owner/contact information share a capped label rail so labels and complete values line up across the brief.
2. Emergency details, routine edit, and handover actions have a reserved action column, keeping them separate from care values on tablet and desktop.
3. Category headings wrap safely beside their existing actions on phones and at enlarged text sizes; the daily sections stay stacked on phones.
4. Booking setup status uses readable text sizing and balanced columns through tablet widths while preserving its existing state and Review action.
5. Daily values use a consistent line rhythm while retaining full notes and instructions.

No controls, labels, warnings, hidden states, identities, drafts, handlers, data reads/writes, backend behavior, or Today/Calendar layouts change. Safety and Medication remain complete and visible. CSS is gated to the Directory page. Existing phone targets remain at least 44px.

## Verification

- Actual Milo Directory renderer at 700px and 768px, 200% root text, light and dark: complete safety, medication, feeding, walks and handover values remain visible, no profile overflow, and the three existing actions are 44px with center-point hits. Screenshots: `evidence/care-overview/production-{700,768}-{light,dark}-200pct-final.png`.
- The existing Care alignment browser spec passes 6/6 across Chromium and WebKit after correcting the tablet track widths. Local contracts pass: Care Future Stays, Early Checkout, Media Carousel, and MVP readiness (425/425).
- The broader 330-case daily-workflows run was interrupted during investigation and is not counted as passing. Its first exact-head CI run found six failures in the Care alignment assertion because the initial tablet fallback moved Safety values to a second row. The latest correction restores the shared row at standard tablet text sizes while keeping readable 136–176px label rails and an intrinsic-width action track; the focused six-case assertion now passes.
- Exact-head CI and production static-asset/release metadata verification are required before publication. No production guest reads, writes, or notifications are used.

Physical phone and mobile PWA refresh checks remain manual.
