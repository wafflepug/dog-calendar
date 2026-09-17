# Next UI refinements: Care

Priority set by the owner: after checkout safety and the mobile baseline, focus the next iterations on Care. Opening a profile reportedly takes three to five minutes. Treat that as a user observation to reproduce, not an established backend measurement.

## Care 1: Open profiles promptly and show useful progress

First bounded implementation: profile-only refresh uses one 15-second attempt, preserves saved attributes, offers scoped Retry, and rejects stale DOM updates after profile changes. Seven Node fixtures and two isolated Chromium fixtures verify these states. Backend latency and real-device click-to-shell/detail timings remain unmeasured; the reported minutes are not yet explained. This refinement does not establish a faster backend response.

User story: Selecting a dog immediately opens its available identity and stay information; slow details do not leave me waiting without feedback.

Luna prompt: Trace the actual `directory.html` startup and `openDirectoryGuestProfile`, `loadGuestDirectoryConsolidated`, `loadDirectoryProfileDetail`, `queryAppsScriptRaw`, and `queryAppsScriptSWR` in `waffle-app.js`. Verify where the reported minutes accumulate with read-only instrumentation. Directory currently allows two 45-second attempts and Profile two 30-second attempts, with retry delay; those are configured limits, not measured delays. Separate shell readiness, directory availability, click-to-profile shell, and click-to-fresh details. Preserve available dog/stay information during background reads. Add scoped loading/error/retry states and a bounded interactive read policy rather than globally shortening mutation timeouts. Preserve visible cached care information if refresh fails, label its freshness, and never imply unknown safety attributes are clear. Keep Back and tabs usable during requests. Prevent responses for a prior dog from modifying the selected profile. No backend schema change or broad visual redesign.

Acceptance: in deterministic delayed-read fixtures the selected profile shell appears within one second of clicking an available card; a stalled detail read reaches an actionable state within a documented bounded budget; cached details remain visible on refresh failure; switching dogs rapidly cannot mix data; keyboard focus and mobile Back work; cold/no-cache, warm-cache, offline, stale-cache and failed read paths are covered. Report actual timings separately from emulation and configured limits.

## Care 2: Clear profile hierarchy and consistent sections

Implemented slice: [overview readability](care-overview-refinement.md), with scoped typography, wrapping and focus styles. Generated profile/safety renderer fixtures use shipped CSS at 390, 412, 768 and 1440 widths, with light/dark text contrast checks. These are emulated layout checks; physical-device validation and the full configured-accent matrix remain separate checks.

User story: I can find care instructions, owner contact and stay dates without navigating unrelated panels.

Luna prompt: Inspect `care.js`, directory markup in `waffle-app.js`, relevant runtime styles and existing theme tokens. Lead agent provides design before implementation. Refine the profile overview with consistent titles, spacing and high-contrast attribute labels; group care instructions, owner/contact and stay dates in a readable order. Reuse the mobile Palz Stay header and avoid duplicate notification/search controls. Keep Profile, Belongings, History and Media navigation consistent across mobile and desktop; make selected/loading/error states visible. Do not relocate operational dates or media ownership keys, hide safety information, or change saved values.

Acceptance: light/dark and each configured accent remain readable; long names, multi-dog bookings, missing fields and long care notes fit at narrow phone and Fold widths; controls have accessible names and visible focus; no overlapping fixed navigation; repeated navigation does not reset edits or refetch unchanged panels. Deliver screenshots and relevant fixture/browser checks.

## Care 3: Load only selected content and preserve work

First bounded slice: [profile tab and field-draft preservation](next-care-state-preservation-prompt.md). Belongings upload drafts and broader cache invalidation remain separate follow-ups. Complete the [read-only timing diagnosis](next-care-read-timing-prompt.md) before choosing a performance optimization; fixture timings cannot establish the reported deployment delay.

Implemented slice: [state preservation policy](care-state-preservation-policy.md). Main/secondary/desktop tabs and edit mode survive matching refreshes, field modal drafts retain their DOM values, and missing/ambiguous/conflicting stays block saves. Rebuilt desktop panels load only the restored selection once. Twelve state fixtures and seven readiness fixtures cover this bounded behavior.

User story: Visiting one profile does not load every guest's media or repeatedly reload panels I already opened.

Luna prompt: Use Care 1 timings to inventory actual repeated/eager requests across `care.js`, `waffle-v11.0.js`, `waffle-v10.8.8.js`, and directory observers. Coalesce same-identity reads, keep secondary tabs lazy, and preserve selected profile/tab during harmless directory refreshes. Apply precise invalidation after edits and photo uploads; do not serve stale safety updates indefinitely. Use thumbnails for grids, loading full images only when opened. Separate backend scan optimization into its own task if client evidence shows server work dominates.

Acceptance: opening a profile loads only its required details; reopening an unchanged loaded tab adds no duplicate request; simultaneous callers share one read; explicit refresh and successful edits invalidate the correct data; upload failure retains retryable work; another dog's response or refresh cannot replace current input; thumbnails have stable dimensions and images remain accessible. Compare request counts and measured panel timings against Care 1 using identical fixtures.

For each task: use an isolated worktree from current main, Luna implementation and lead design/review, targeted meaningful fixtures, relevant CI, automatic push/merge, and the Built Deliverables / Testing Matrix / Next Backlog Item completion report.
