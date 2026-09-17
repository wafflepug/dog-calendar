# Next delegation: diagnose Care profile read timing

Investigate the reported 3–5 minute delay when opening a guest profile. Produce read-only evidence and a diagnosis; do not change runtime code, Apps Script, data, or backend behavior in this task.

Use the actual local app and the existing Playwright/local runner. Instrument timings with `performance.now()` and request metadata only. Never record dog names, owner names, phone numbers, notes, URLs containing identifiers, payload bodies, or response bodies. Use opaque request IDs and action names only.

Trace these phases separately:

1. Directory readiness: navigation start, DOM/UI-ready, first directory card, directory summary request start/end, cache-hit or cache-miss, and card render completion.
2. Click-to-shell: profile-card click, `.directory-card.is-profile-active`, `.directory-dashboard-fused.is-profile-mode`, breadcrumb/back-bar visibility, and first profile shell paint.
3. Fresh detail: `openDirectoryGuestProfile()` and `loadDirectoryProfileDetail()` in `waffle-app.js`; measure `get_guest_profile` request attempts, callback/timeout/error, `queryAppsScriptSWR` cache callback, record application, and `[data-directory-detail="profile"]` loaded state.
4. Secondary tabs: `switchDirectoryProfileMainTab()`, `switchDirectoryProfileSubTab()`, `loadDirectoryBelongingsDetail()`, and intake/care detail loads. Measure each tab click to content-ready separately; do not combine them with initial profile timing.
5. Transport retries: instrument `queryAppsScriptRaw()` and `queryAppsScriptSWR()` through test-only injected wrappers for action, attempt number, timeout, retry delay, success/error, opaque cache identifier, cached render, fresh response, and total elapsed time. Never log raw cache keys or payloads, since keys can contain guest identifiers.

Relevant code anchors are `waffle-app.js`: `loadGuestDirectoryConsolidated()` and `applyGuestDirectoryResponse()` for directory readiness; `openDirectoryGuestProfile()` around the profile shell; `loadDirectoryProfileDetail()` and `loadDirectoryBelongingsDetail()` for lazy reads; `switchDirectoryProfileMainTab()` / `switchDirectoryProfileSubTab()` for secondary navigation; and `queryAppsScriptRaw()` / `queryAppsScriptSWR()` for transport and cache behavior. Confirm current line locations before implementation because generated or bundled revisions may move them.

Run a bounded fixture matrix with the same opaque synthetic stay key and deterministic action responses:

- cold/no-cache directory → profile;
- warm-cache directory → profile;
- fresh profile detail with cache empty;
- profile detail served from stale-while-revalidate cache;
- secondary intake/profile and belongings tabs;
- offline or delayed transport with one retry, then successful response;
- offline or delayed transport exhausting retries.

Use controlled delays (for example 0 ms, 100 ms, 1.2 s retry delay, and timeout boundary) rather than real network waits. Assert request counts and phase completion. Keep directory readiness, click-to-shell, fresh detail, secondary tabs, and retry time in separate fields. Include median/p95 only when there are repeated runs; otherwise report every run and sample count.

Acceptance criteria:

- Evidence contains no names, contact details, notes, raw payloads, response bodies, or identifier-bearing URLs.
- Every phase has start/end timestamps or an explicit unavailable reason.
- Each Apps Script action reports request count, attempt count, cache state, retry/timeout state, and elapsed time.
- Cold, warm, delayed-success, and retry-exhausted cases are independently reproducible.
- Existing UI assertions pass and no production files are modified.
- Findings distinguish directory readiness, click-to-shell, detail reads, secondary tab reads, and transport retries; do not make a device-level performance claim.

Decision gate for the follow-up: if fresh detail time is dominated by repeated client reads or duplicate requests, inspect client cache/request coalescing first. If one read remains slow after request counts and retry behavior are proven, prepare a separate backend scan-optimization proposal with measured evidence. Do not implement either optimization in this diagnostic task.
