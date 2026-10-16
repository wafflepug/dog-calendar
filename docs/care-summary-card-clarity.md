# Care summaries and guest cards — verification

Release candidate: 2026.10.17.01. Use synthetic fixtures for writes. Production checks are read-only.

| Journey | Steps | Expected result |
| --- | --- | --- |
| Unchanged refresh | Open a Care profile, focus a field, leave a draft, refresh identical directory metadata. | Existing summary/action nodes, draft, focus and disclosure state remain; no additional profile read. |
| Changed summaries | Change safety, digital intake and legacy document metadata for one synthetic guest. | Only affected outputs update; removed flags clear; missing, pending and failed states remain distinguishable. |
| PDF refresh failure | Retain a saved PDF, trigger a failed scoped uploader refresh, then apply identical background metadata. | Saved PDF and actionable error remain visible. Successful scoped retry clears the error. |
| Guest identity | Use same-name guests with distinct Dog/Stay IDs and switch profiles. | Summary updates and actions retain the exact stay identity; ambiguous identity is not silently reused. |
| Guest cards | At 360, 390 and 1440px, review names, IDs, dates, status, all care flags and booking source. | Text wraps without overlap or horizontal page overflow; care flags remain visible; source has a dedicated position. |
| Roster actions | Use keyboard and touch to check in/out a synthetic guest and reach any secondary actions. | Primary action is clear, secondary actions are labelled, pending/error feedback remains visible, profile need not open. |
| Organiser | Open Reminders; switch tabs and revisit. | Canonical organiser shell and stylesheet initialise once, with no requests for deleted v11.1.15 assets. |
| Other pages | Open Today/Calendar, Care and Logs. | No organiser feature requests; the retired 16–21 loader tail is not reactivated. Canonical Calendar, Care, Logs and shared UI remain under their existing bootstrap. |
| Loader ownership | Inspect local script requests after all four pages settle. | Existing bootstrap is the sole canonical organiser owner; no deleted 15 assets or resurrected legacy tail requests. |
| Offline stylesheet | Compare the canonical organiser CSS request URL with the service-worker cache key. | Canonical JS and CSS build query strings match their precached assets. Existing bootstrap readiness guards continue to prevent duplicate script insertion. |

Run the dedicated Chromium/WebKit suite with `playwright.care-summary-card-clarity.config.js`, then relevant existing refresh, roster, profile and Records tests. Review actual phone/desktop screenshots. CI retains the full cross-device matrix. Real devices and assistive technology require manual verification.

These changes reduce client rendering work and clarify layout. They do not change Google Sheets/Apps Script processing time, authentication or booking data.
