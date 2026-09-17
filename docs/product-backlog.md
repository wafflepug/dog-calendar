# Product improvement backlog

Reviewed 17 September 2026. Repository: `wafflepug/dog-calendar`; always start implementation from current `origin/main` in an isolated worktree. Stack: static HTML/CSS, browser JavaScript, FullCalendar, Apps Script backend, Python contracts, Playwright. Keep production smoke checks read-only. Preserve existing theme settings, offline work, and early checkout behavior. Use Luna for bounded implementation; lead agent reviews design and integration. Complete relevant CI before merging.


## Owner priority: Care UI refinements next

Care profile readiness is implemented in this release: saved attributes remain visible, profile reads have scoped timeout/retry, and responses cannot update a different selected dog. Next prioritize [Care UI refinements](care-ui-refinement-backlog.md): readable overview hierarchy, then lazy tabs and preserved work. Investigate reported 3–5 minute profile access with actual request timings; configured timeout limits alone do not prove the cause. Deployment metadata and general diagnostics move below these Care tasks.

## Completed — Safe confirmed-stay identity (#139)

User story: As a sitter, I can trust that each real booking appears once without hiding another owner's similarly named dog.

First implementation: owner/contact/breed-aware conservative Calendar deduplication, executable composition/capacity fixtures, and revision-tagged core loading. See `confirmed-stay-identity.md`. Operational identity migration remains next; this Calendar task does not change persisted keys.

Delegation prompt: Review `waffle-v11.0.5-core.js` (`v1105ConfirmedStayIdentity`, `v1105DedupeConfirmedStays`, `v1104ComposeCalendarEvents`) and `waffle-app.js` (`temporaryConfirmedStays` creation and CSV parsing). Current identity uses only dog name and dates. Implement a narrowly scoped confirmed-stay identity policy that preserves distinct owners/dogs and merges proven copies from spreadsheet and optimistic caches. Inspect available stable identifiers before choosing a fallback; document ambiguity instead of guessing. Preserve authoritative edit links and early checkout raw dates. Do not delete backend rows or introduce schema changes in this task. Deliver identity/composition changes plus executable fixture tests and a brief identity-policy note.

Acceptance: identical copies collapse; same-name dogs with different owners/contact identifiers remain separate; different dates remain separate; incomplete identity does not silently hide a potentially distinct booking; Meet & Greet/Potential behavior remains intact; capacity counts match the final unique confirmed collection. Verify sheet/local copies, retries, missing fields, whitespace, exclusive calendar end dates, and early checkout. Run early-checkout and capacity contracts. Report remaining source-data ambiguity.

## P1 — Measure and reduce mobile observer work

User story: As a sitter on iPhone or Galaxy Fold, I can scroll Home smoothly after data loads.

Delegation prompt: Review `waffle-sitter-navigation.js` (`maintain`, observer), `calendar.js` observer callbacks, and `waffle-runtime.css` mobile content visibility. First capture a reproducible local Home scroll baseline with fixture data; separate image/network loading from main-thread work. Scope the first optimization to navigation's whole-document observer and repeated launcher scans. Filter irrelevant changes and avoid scanning the whole document after calendar cell updates. Keep late-created settings/drawer/header controls working. Deliver minimal changes and before/after trace evidence; do not refactor all calendar observers together.

Acceptance: repeated unrelated calendar mutations do not trigger navigation scans; new/replaced relevant controls still hydrate; switching Today/Calendar/Care, resizing, opening Settings and drawer, and changing themes work. Compare identical scroll traces at narrow phone and Fold widths, light/dark themes, and large booking fixtures. Report long-task counts and observer invocations; do not claim device performance from emulation alone.

### Ready measurement prompt (before optimizing)

Use test-only Playwright instrumentation injected before navigation, without production runtime edits. Measure observer callback counts/durations, mutation records, RAF execution, and long tasks with fixed booking fixtures. Run Today and Calendar on `iphone-pro-390x844` and `android-large-412x915`, five repetitions each (20 runs total), with workers=1 for measurement isolation. Separate initial six-second hydration from a scripted scroll after hydration. Preserve native callback semantics and quantify instrumentation overhead; use the identical harness before and after optimization. Emit every raw run plus median/p95 by page/project. Require complete records for all 20 runs, no instrumentation errors, and unchanged UI regression behavior. No speedup claim or runtime edit belongs in the baseline task. Existing runner: Node 20, `@playwright/test@1.55.1`, `playwright.ui.config.js`, local server port 4173, explicit `WAFFLE_BASE_URL=http://127.0.0.1:4173`. Physical iPhone and Samsung Fold verification is still required for device-level performance claims.

## P1 — Generate release metadata from deployment

User story: As the owner, I can see which release is deployed without manually updating several files.

Delegation prompt: Review `system-status.html`, `waffle-build.json`, `waffle-release.json`, `waffle-bootstrap.js`, and GitHub Pages deployment workflows. Design a small deployment-time metadata step that records the actual deployed commit, asset revision, timestamp, and release label in the published artifact. Keep the original compatibility build and historical release verification separate. Update System Status to consume the generated metadata with a useful fallback and honest unavailable state. Avoid backend writes and avoid committing generated SHA data back into main.

Acceptance: deployed commit equals workflow commit; asset revision matches bootstrap; refresh uses fresh metadata; missing/malformed manifest and offline failures are readable; historical verification is preserved; older cached shells can still render status. Deliver workflow/script/status changes and fixture checks. Distinguish manifest availability from full runtime health.

## Next ready tasks — operational identity rollout

### P0.2 — Collision-safe operation lookup (design gate, then frontend)

Bounded frontend guard implemented: known name/date collisions quarantine operational status and block checkout writes. See `checkout-collision-safety.md`. Evidence survives partial refreshes. Incomplete identity alone retains historical compatibility; stable booking IDs and authoritative freshness remain prerequisites for universal ambiguity protection.

Ready bounded prompt: [next-operation-lookup-prompt.md](next-operation-lookup-prompt.md). Review cached date restoration, complete CSV evidence, and all mutation entry points before execution.

Delegation prompt: Inspect `waffle-v11.0.js` operation indexing, `v110StayKeyForEvent`, checkout readers, and `waffle-v11.2.17.js` early-checkout enhancements. Inventory all readers before editing. Introduce an identity-aware lookup that accepts the full event/payload, detects multiple current confirmed bookings sharing a legacy name/date key, and never applies one ambiguous legacy operation to every booking. Preserve the legacy key contract for unambiguous historical stays. Deliver a migration design note before changing persisted keys; the existing Apps Script operations sheet stores no owner/contact fields. Avoid fabricating ownership for historical rows. Acceptance: Ralph's existing early checkout stays effective; a same-name/date collision cannot cause both owners' dogs to disappear; ambiguous historical status is explicitly reported; refresh/offline states remain consistent. Focused fixtures must cover unique legacy data, collisions, stale cached records, and real checkout dates. Backend migration follows as its own task.

Architecture constraints from review: `makeGuestStayKey_` is shared by Care/media records, so do not globally replace it to fix operations. `Stay_Operations` currently stores Updated At, Stay Key, Dog Name, Start Date, End Date, Status, Checked In At, Checked Out At, and Operational Note. A versioned operation identity must remain separate from media/profile keys. Any future owner-aware persisted operation record needs explicit backend/client rollout, both filtered and unfiltered read coverage, and an unambiguous fallback for historical records. Never assign an old name/date-only status to one owner based on array order.

### P0.3 — Stable booking IDs and optimistic cache reconciliation

Delegation prompt: Inventory CSV identifiers, Apps Script guest directory fields, confirmation mutation receipts, and local confirmed event creation/reconciliation in `waffle-app.js`. Propose a stable identity propagated from mutation through authoritative reads; do not use spreadsheet row numbers as permanent IDs. Specify backward-compatible rollout and handling for old clients/offline queues before schema work. Deliver a design plus fixture plan first. Acceptance: mutation retries create one stay; a persisted authoritative row removes only its matching optimistic event; another owner's same-name/date record remains; edited dates preserve identity; deleted rows and offline retries do not resurrect bookings.

### P1.0 — Reproducible local browser verification (implemented this iteration)

Delegation prompt: Add a small documented local UI test setup pinned to the CI Playwright version. Current repository has no checked-in package manifest; CI initializes one at runtime. Inspect existing runner configs and workflows before choosing the minimum tooling. Make local fixture tests use the local URL explicitly, never the production default. Acceptance: a clean checkout can run the targeted phone regression with one documented setup and one test command; dependency versions match CI; production writes are intercepted/blocked; a failed test leaves trace artifacts; generated reports are ignored. Keep this separate from performance optimization.

### P1.4 — Explain cached data and pending sync in System Status

User story: As the owner, I can tell whether a booking change has reached the server before relying on the calendar after a refresh.

Delegation prompt: Inventory existing response-cache timestamps and any actual offline mutation queue API. Add a read-only System Status view of last successful boarding/operations sync without reintroducing the removed Home live ticker. Display pending mutation counts only if a real queue exists; current `queued` response branches do not establish one. Do not expose guest names, contact details, or mutation payloads in diagnostics. A network connection alone must not imply a successful data sync. Acceptance: synced, cached/offline, failed and unavailable-storage states are distinct; refresh never sends a mutation; absent timestamps show unknown rather than fabricated recency. Deliver small adapters and fixtures retaining user themes.

## Completion report template

- Built Deliverables: final behavior, changed files, commit/PR, material limitations.
- Testing Matrix: numbered happy-path, edge-case, failure-mode steps; separate executed checks from instructions awaiting real-device verification.
- Next Backlog Item: next bounded prompt and why it follows.
