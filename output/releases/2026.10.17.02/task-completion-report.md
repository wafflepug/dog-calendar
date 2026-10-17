# Care Status & Navigation — release candidate

Requested items: 5, 8 and 9. Build 2026.10.17.02.

**Built Deliverables**

- A compact Care record freshness indicator distinguishes loading, refreshing, saved, offline and failed refresh. Only a valid shared record update timestamp is displayed; retrieval time is not treated as a save time. Duplicate successful detail status is visually reduced, while failures and Retry remain visible and announced. Pending edit/save feedback stays separate.
- Contextual empty Staying, Arriving and Past views lead to an existing useful category or Quick Add. Cached, offline, loading and unsuccessful reads remain distinct. Malformed responses do not replace the list with a confirmed empty roster. Existing search reset and intentional later-arrival loading are preserved; older empty messages do not appear alongside the new prompt.
- Detailed Care keeps independent section choices, including all sections closed. Cross-render memory uses a unique full Stay ID, Dog ID and stay key, with a bounded 50-entry page-session map. Legacy or ambiguous identities keep mounted-card state without sharing it with another card. No persistent care data or backend changes.

**Testing Matrix**

1. Open a saved profile; exercise delayed refresh, offline access, failed refresh and Retry. Check the visible timestamp against the shared record, including missing, invalid and future values.
2. Load empty categories, then search and clear a query. Use the suggested action with Enter. Confirm loading and failure do not claim an empty live list, and deferred arrivals do not load automatically.
3. Open and close multiple Care sections, close the profile and return. Rebuild the card and switch between same-name guests. Confirm all-collapsed and guest-specific choices, focus and drafts remain intact.
4. Check 320px, 390px and desktop layouts in light/dark themes, Chromium and WebKit. Confirm readable status/action text, visible focus and no clipped controls.

Local validation: full Node contracts; new status/empty/navigation browser suite; existing summary, roster, lazy arrival, media, continuity, rendering, loading/Retry, detailed overview and mobile hierarchy tests. Production verification is read-only. Exact counts and final CI/deployment evidence are recorded in the verified report after release; this candidate document does not claim deployment.

**Next Backlog Item**

Useful roster filters based on already-loaded metadata, scoped in output/backlog/after-care-status-empty-navigation.md. Preserve existing search, Back state, identity safety and lazy arrivals without extra reads.
