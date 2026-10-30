# Care supporting-section consistency

Release candidate: `2026.10.30.01` · service worker `v11.4.160-care-support-consistency-2026.10.30.01`.

The full Care profile uses the same existing disclosure pattern in Booking setup, Records & forms, Stay contact & handover, More tools, and booking actions. Their original rules gave some headers a 44px minimum and others 52–56px, and their keyboard focus rings differed. Long Booking setup statuses could also stretch a grid row around its Review action.

The Directory-only canonical stylesheet gives these existing summaries a consistent 44px minimum and focus treatment. Headers with two-line supporting text can still grow naturally. Booking setup status and action text can wrap within the current row. No labels or status values are shortened, hidden states are untouched, and the existing actions keep their current touch targets.

No markup, icons, controls, runtime handlers, data reads/writes, backend behavior, or Today/Calendar layouts change. Complete Safety and Medication remain visible. Exact Stay ID/Dog ID, drafts, explicit writes, and lazy reads are preserved.

## Verification matrix

- Full-runtime profile-tools fixture in Chromium and WebKit at 320, 390, and 1440px in light and dark themes.
- At each viewport/theme, enlarge root text to 200% and verify no page overflow and that long readiness status/action text stays inside its row.
- Assert 44px minimum disclosure-header sizing and the shared visible keyboard focus ring; preserve the existing state and action assertions.
- Records & forms full-runtime responsive checks in Chromium across 320, 390, and 1440px and both themes.
- Missing owner/contact and long handover content checks across phone and desktop widths.
- Existing UI stability and release-attribution contracts; full current-head CI before merge.
- Production verification reads static assets and release/capability metadata only. No guest record reads, guest writes, or sample notifications.

The Playwright spec captures screenshots during the run; no screenshot artifact is committed. Physical phones, native dialers, and mobile PWA refresh remain manual follow-up checks.

Local results: profile tools 16/16, Records & forms 6/6, stay contact and handover 3/3, deployment attribution 6/6, and system-status release metadata 7/7 passed. UI stability contract passed. Physical device checks are still outstanding.
