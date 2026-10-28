# Product improvement backlog

Reviewed 17 September 2026. Repository: `wafflepug/dog-calendar`; always start implementation from current `origin/main` in an isolated worktree. Stack: static HTML/CSS, browser JavaScript, FullCalendar, Apps Script backend, Python contracts, Playwright. Keep production smoke checks read-only. Preserve existing theme settings, offline work, and early checkout behavior. Use Luna for bounded implementation; lead agent reviews design and integration. Complete relevant CI before merging.


## Current Care iteration - 29 October 2026

Candidate 2026.10.29.03: [Care journey shortcuts](care-journey-shortcuts.md). Direct due-today checkout, Enter to open one visible search result and immediate short saved handover notes. Preserve confirmation, exact identities, drafts, lazy reads and full text. Next: review phone arrival and pickup action placement with representative long-name and missing-data cases.

Published 2026.10.29.02 (PR #276): [Care reading layout](care-reading-layout.md). Three refinements: readable identity/status and care text, bounded desktop reading width and aligned heading/search. Preserve existing actions, full instructions and lazy reads. Next: review the arrival-to-profile-to-checkout journey with a sitter before adding controls.

## Current desktop iteration - 28 October 2026

Published 2026.10.29.01 (PR #275): [Care visual cleanup](care-visual-cleanup.md). Five recommended presentation refinements: one clear status, compact selected work filters, quiet roster surfaces, consistent primary actions and no single-arrival shortcut. Preserve warnings, dates, identity and existing requests. Next: review typography and desktop reading width using the cleaned baseline.

Published 2026.10.28.10 (PR #274): [Care arrival and rebooking](care-arrival-rebooking.md). Ten bounded refinements to returning-dog context, date entry, arrival summaries, checklist continuity and scoped arrival work. Preserve exact identity gates, explicit writes and lazy reads. Next: audit planned-visit review and incomplete-intake recovery with representative sitter tasks.

Published 2026.10.28.09 (PR #273): [Care daily efficiency](care-daily-efficiency.md). Ten scoped improvements to filtered-empty recovery, keyboard search, explicit owner sharing and named arrival shortcuts. Preserve loaded-data-only filtering, exact identities, drafts and existing writes. Next: review arrival handover and rebooking with representative solo-sitter tasks before adding controls.

Published 2026.10.28.08 (PR #272): [Care checkout completion](care-checkout-completion.md). Direct copy/share, identity-verified completion focus and position-preserving dismissal to the current roster. Preserve explicit checkout, drafts, exact identities and existing reads. Next: inspect empty-roster recovery and returning from owner sharing with a sitter.

Published 2026.10.28.07 (PR #271): [Care pickup and handover](care-pickup-handover.md). Five refinements: owner contact and saved handover in checkout review, explicit discard protection for unsaved notes, expanding early-checkout notes and safe pending copy/share feedback. Preserve exact stay verification, explicit saves, complete medication and existing reads. Next: assess the verified checkout completion and return-to-roster experience before adding more controls.

Published 2026.10.28.06 (PR #270): [Care contact access](care-contact-access.md). Readable owner phone numbers, direct missing-number editing, callable saved emergency/vet numbers and focused emergency lookup. Keep existing identities, drafts, lazy reads and plain missing states. Next: review practical pickup/handover tasks before adding any more profile controls.

Published 2026.10.28.05 (PR #269): [Care detail editing](care-detail-editing.md). Six bounded improvements to existing field editing: readable Dog ID context, correct label focus, field-specific input hints, growing persistent handover notes, guarded keyboard saving and safe delayed focus. Preserve exact stay identity, drafts, explicit writes and existing reads. Next: assess owner contact and emergency lookup with representative solo-sitter tasks.


Published 2026.10.28.04 (PR #268): [Care handover clarity](care-handover-clarity.md). Six bounded arrival-to-checkout refinements: concise arrival tasks, full-width owner-link feedback, direct single-item belongings, consolidated review guidance, growing optional departure note and readable verified departure context. Preserve unknown states, complete medication, explicit operations, drafts and existing reads. Next: validate the resulting arrival and departure journeys on physical phones before adding more controls.


Published 2026.10.28.03 (PR #267): [Busy-day Home](home-busy-day.md). Six refinements: known guest counts, local near-arrival labels, existing human-readable IDs for same-name guests, complete aligned names/dates, keyboard portrait navigation and truthful photo failures. Preserve exact stay links, canonical Calendar and lazy reads. Next: reduce repeated support text in the Care arrival-to-checkout journey using measured task evidence.


Published 2026.10.28.02 (PR #266): [Home clarity and continuity](home-clarity.md). Fit-aware pinned Calendar, concise acknowledged empty states and shared Palz Stay sidebar/Home styling. Preserve loading/error guidance, canonical calendar nodes, mobile routes, exact identities and no new backend reads. Validate dynamic height and viewport changes, current-head CI and live frontend attribution.

Published 2026.10.28.01 (PR #265): [Compact desktop Home](desktop-home-layout.md). Keep the mobile card hierarchy in a compact left column beside the existing full calendar on wide desktop workspaces, with a readable stacked fallback and unchanged mobile routes. Preserve canonical DOM nodes, exact links, existing event handlers and lazy data reads. Require cross-breakpoint checks, current-head CI and live frontend attribution.

## Current Care iteration - 27 October 2026

Published 2026.10.27.04 (PR #264): [Sitter UI efficiency](sitter-ui-efficiency.md). Six bounded improvements: adjacent search clearing, direct active-work-filter reset, keyboard stay tabs, truthful device readiness, guarded changed-only preferences and compact notification settings. Preserve exact identities, drafts, lazy reads and explicit delivery/permission actions. Require current-head CI and live frontend attribution.

Published 2026.10.27.03 (PR #263): [Stay advance reminders](stay-advance-reminders.md). Arrival and departure system push at one and two calendar days before the stay date, using existing category preferences and scheduled handlers. Require timezone-safe planning, exact stay identity, per-device receipts, failure retry and live scheduler/capability verification.

Published 2026.10.27.02 (PR #262): [Care compact toolbar](care-compact-toolbar.md). Give search its available width and consolidate existing supporting disclosures on phones, with readable full-width expansion and preserved search/filter/profile navigation. No new controls, reads or data writes.

Published 2026.10.27.01 (PR #261): [Care readable layout](care-readable-layout.md). Make the existing roster image/text columns effective, separate source and status badges and align routine editing with the other quiet heading actions. Keep touch targets, exact identities and lazy reads. Calendar and Today layouts remain unchanged.

## Current Care iteration - 26 October 2026

Published 2026.10.26.03 (PR #260): [Care alignment and current-stay selection](care-alignment-current-stay.md). Correct stale startup profile navigation overriding an explicit roster choice, and align Care identity, dates, badges and actions across phone and desktop widths. Preserve explicit historical stays, exact identities, drafts and lazy reads. Require current-head CI and frontend publication attribution.

Published 2026.10.26.02 (PR #259): [Solo sitter Care](solo-sitter-care.md). Six bounded refinements: compact roster return, quiet saved-record status, one confirmed-empty routine prompt, handover editing beside the note, Emergency details beside Safety, and an explicit saved-data sitter summary copy with manual recovery. Preserve exact identities, drafts, visible safety/medication and lazy reads. Calendar and Today layouts remain unchanged. Require current-head CI and frontend publication attribution.

Next ready item: validate the one-person arrival, care lookup and checkout journeys on physical phones before adding controls.

Published 2026.10.26.01 (PR #258): [Care at a glance](care-mobile-ten.md). Ten Care-only refinements improve mobile identity, photos, labels, actions, first-level routine/contact/handover, direct routine editing, medication readability and section navigation. Preserve exact identity, explicit saves, drafts and lazy reads. Calendar and Today layouts are unchanged. Publication requires current-head CI and frontend attribution.

Next ready item: observe arrival, daily-care and checkout tasks on physical phones; prioritize measured friction rather than adding controls.

## Current Care iteration - 25 October 2026

Published 2026.10.25.03 (PR #257): [Compact dog picker](compact-dog-picker.md). Six bounded identity-browser refinements: compact verified controls, remove repeated unreviewed identity context, bounded local results, stable focused cards, truthful lookup/retry controls and accessible search counts/reset. Preserve exact Dog IDs, care approval, draft/plan continuity and explicit saves. No new startup reads or backend changes. Current-head CI and frontend attribution are required.

Published 2026.10.25.02 (PR #256): [Simpler rebooking](simpler-rebooking.md). Three bounded refinements: dates-first returning bookings with optional enquiry tools, one editable supporting guest-details disclosure, and inline single-booking validation. Preserve exact Dog IDs, optional reviewed care inheritance, all draft/plan state and explicit saves. No new startup reads or backend changes. Current-head CI and frontend publication attribution are required.

Published 2026.10.25.01 (PR #255): [Fewer clicks in Care](care-fewer-clicks.md). Review missing checkout care inside its existing sheet, keep guarded check-in close to arrival review, copy identity-verified prepared owner links directly, and remove nested supporting-details disclosures. Preserve explicit operations, draft recovery, truthful unknown states and lazy shared readers. Next: measure the resulting sitter journeys on physical phones before adding more controls. Current-head CI and frontend publication attribution are required.

## Current Care iteration - 24 October 2026

Candidate 2026.10.24.07: [Simpler daily Care](care-daily-simplicity.md). Keep the selected identity, stay actions, safety and medication visible; collapse supporting routine/contact/handover, clarify prepared owner sharing and offer scoped arrival care checks using loaded evidence. Verify the existing guided checkout and immediate Past transition. Preserve exact identities, drafts and lazy reads. Next: validate these shorter daily journeys with sitter tasks before adding more controls. Publication requires current-head CI and frontend attribution.

Candidate 2026.10.24.06: [Saved profile photo editing](saved-profile-photo-editing.md). Open the stored photo in the crop editor without re-importing, retain an uncropped working copy for new uploads and keep replacement available. Preserve exact stay identity, read-only opening, upload receipts and scoped recovery. Requires both frontend and Apps Script publication attribution. Next: verify phone and keyboard crop interaction with representative sitter tasks.

Candidate 2026.10.24.05: [Returning booking flow](returning-booking-flow.md). Exact Dog ID selection no longer automatically reads care history; one explicit review action loads and opens it. Preserve same-selection edits, approval, restored plan prompts, guarded date focus and all identity/save protection. Next: simplify optional enquiry import for returning bookings. Full current-head CI and publication attribution are required.

Candidate 2026.10.24.04: [Faster pet onboarding](faster-pet-onboarding.md). Open Boarding directly from Care, retain interrupted drafts in memory, copy only confirmed shared-owner/date context for another dog, and remove speculative name-prefill reads while typing. Preserve exact returning Dog ID review, save locks and explicit owner sharing. Next: measure the returning-dog-to-dates transition. Full current-head CI and publication attribution are required.

Candidate 2026.10.24.03: [Care intake receipt context](care-intake-receipt.md). Show verified digital submission time in existing status details, bind it to the selected guest/stay, and retain unknown wording for stored profile fallbacks. No extra touchpoint, startup read or inferred delivery. Next: audit repeated Records & forms completion messaging. Full current-head CI and publication attribution are required.

Candidate 2026.10.24.02: [Care owner guidance](care-owner-guidance.md). Five improvements: inline owner-field validation, guarded keyboard preparation, quieter unavailable contact details, coordinated copy/share actions, and scoped guest-history progress/retry. Preserve explicit operations, exact identities and no background history reads. Next: audit verified owner-form receipt context using existing evidence. Publication requires full current-head CI and live attribution.

Candidate 2026.10.24.01: [Care sharing clarity](care-sharing-clarity.md). Three improvements: one primary action after owner-form preparation, compact sharing options without duplicate link controls, and recoverable clipboard feedback without duplicate clicks or stale focus. Preserve exact stay context, explicit owner sending, lazy reads and token privacy. Next: audit owner form validation errors for clear field-level guidance. Current-head CI and live attribution are required before publication.

## Current Care iteration - 23 October 2026

Candidate 2026.10.23.06: [Care owner workflow](care-owner-workflow.md). Five refinements: compact departure belongings, routine previews with essential values visible, direct Book Again in More tools, contextual owner-form follow-up, and truthful shared-save feedback. Preserve visible medication, exact guest identity, draft recovery and lazy reads. Next: simplify the existing owner sharing dialog without extra entry points or background polling. Publication requires current-head CI and deployment attribution.

Candidate 2026.10.23.05: [Care daily workflow value](care-daily-value.md). Three scoped improvements: queued booking verification and safe partial resume, measured changed-only Care preparation, and arrival exceptions without duplicate completed-intake prompts. Use existing authoritative reads only on an explicit recovery action; retain exact identities, immutable attempted payloads, lazy profile reads, visible safety/medication and Next arrival focus. Inherits the pending Care profile quick-action/clarity changes; full current-head CI is required before publication.



Candidate 2026.10.23.04: [Care profile quick actions](care-profile-quick-actions.md). Compact truthful freshness with full provenance on demand, unobstructed avatars with the existing photo controls in More tools, and one grouped owner-link action with its existing form-status badge. Preserve exact guest identity, explicit uploads/sharing, unknown states, stable DOM and lazy reads. Current-head CI is required before release.

Candidate 2026.10.23.03: [Care profile clarity](care-profile-cleanup.md). Three UI refinements: one compact return control without a repeated dog name, expandable long handover notes, and text-first Care section tabs. Preserve short notes, visible Safety/Medication, exact guest context, lazy reads and keyboard navigation. Builds on the published multi-visit release; publication requires current-head CI.

Published 2026.10.23.02: [Multi-visit completion and sharing](multi-visit-completion.md), merged in PR #243, including PR #242. All 21 pre-merge workflows passed. The live asset revision and deployment commit c4b31e00dd5d0c0326928c7dcd79e7e170186b1d were verified; backend attribution and maintenance state stayed unchanged. Duplicate post-merge checks may still be running. Keep queued/failed outcomes truthful, successful intents frozen, and sharing separate from sending.

Release priority: retain the full phone-regression gate and required read-count/hit-test assertions. Its previously failing checks passed on the tested PR #243 head; this does not establish a general cause for the earlier intermittent failures. The Care timing workflow's setup is now separately bounded and cached after its earlier 10-minute job expired during dependency installation. Next feature item: audit queued-plan recovery messaging using existing queue/reconciliation states, without automatic resubmission or additional background polling.

Candidate 2026.10.23.01: [Multi-visit Care and owner sharing](multi-visit-care-polish.md). Five scoped improvements: captured per-dog care choice, explicit pre-save dog editing, compact dog context on Dates, a primary owner care-link copy action after booking, and bounded cached browser CI setup. Preserve identity guards, explicit inheritance, immutable started save intents, lazy reads and read-only production smoke.

Next ready item: compact multi-visit completion guidance from existing saved/queued/failed result data.

## Previous Care iteration - 22 October 2026

Candidate 2026.10.22.03: [Compact returning Care review](returning-care-review.md). Three scoped improvements: a collapsed saved-care review with visible Dog ID and completed-source date, topical grouping of populated fields and saved alerts, and a clear opt-in copy decision that requires review again after edits. Preserve exact identities, dated sources, partial-save recovery and lazy reads. Publication requires final-head CI and exact live-release verification.

Next ready item: audit per-dog reviewed Care context in multi-visit plans, so the captured source and copy choice remain clear when adding another dog or returning from Dates. Preserve frozen successful save intents and explicit identity selection.

## Previous Care iteration - 21 October 2026

Current candidate: [Care journey simplification](care-journey-simplification.md), release 2026.10.21.02. Audit the existing arrival, departure, daily summary, returning-dog setup and list continuity before changing them. Preserve the established direct operations, explicit identity review and lazy loading. Exact-head checks and publication verification are required before release.

Previous release: [Care Photo and Save Clarity](care-photo-save-clarity.md), 2026.10.21.01, merged in PR #236 and published. It adds right-sized roster previews, category-level unsaved change counts and visible confirmed-save refresh recovery.

## Owner priority: Care UI refinements next

Candidate 14 October 2026: five compact controls and record refinements, [Care compact controls](care-compact-controls.md), release 2026.10.14.04. Next: simplify Dog record maintenance actions after a UI audit.

Candidate 14 October 2026: five profile clarity and navigation improvements in [Care profile clarity](care-profile-clarity.md), release 2026.10.14.03. Await current-head regression and deployment verification. Next: enlarged-text Care summaries and footer-safe dialog audit.

Candidate 14 October 2026: five compact Items, Photos and yearly Stay history improvements in [Compact Care panels](care-compact-panels.md), release 2026.10.14.02. Final checks and deployment evidence are required before treating this candidate as deployed. Next UI task: spatial keyboard focus on the mobile Care tab grid without activating tabs or adding reads.

Implemented candidate 9 October 2026: seven document-return, recovery, keyboard-navigation and responsive Records & forms improvements. See [Care Document Recovery & Navigation](care-document-navigation.md). Next inspect Detailed Care category collapse/focus and enlarged text.


Implemented candidate 9 October 2026: four refinements in [Cleaner Care & Notification Recovery](care-cleaner-ui.md): honest notification retry states, collapsed Care maintenance tools, compact selected identity/stay actions, and compact read-only fields. Next: scoped document recovery after returning from the uploader.

Completed 9 October 2026: four Records & forms and notification-access refinements: accurate OCR labels, separate intake metadata, keyboard tab navigation and dialog focus/return. See [Care Records & Notification Access](care-records-notification-access.md). Next inspect cached notification refresh recovery without adding polling.

Prepared 8 October 2026: five Booking tools refinements covering readable actions, guest-specific labels, source context, dialog focus and immediate identity-safe rebooking. See [Care Booking Tools](care-booking-tools.md). Next inspect Records & forms responsive document/action states without changing OCR or adding initial reads.

Completed 8 October 2026: six selected-profile refinements covering medication states, labeled feeding, category-specific empty states, contextual Edit/Discard names, readable source/count badges and unclipped curated summaries. See [Care routine clarity](care-routine-clarity.md) for acceptance checks and the next bounded action-layout item.

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

### P1.4 — Explain cached data and pending sync in System Status (implemented)

User story: As the owner, I can tell whether a booking change has reached the server before relying on the calendar after a refresh.

Delegation prompt: Inventory response-cache timestamps and the active V10.8 IndexedDB offline mutation queue. Add a read-only System Status view of last successful spreadsheet and stay-operations reads without reintroducing the removed Home live ticker. Display only a count from the real queue; never expose guest names, contact details, or mutation payloads in diagnostics. A network connection alone must not imply a successful data sync, and the directory summary cache must not imply a fresh spreadsheet read. Acceptance: synced, cached/offline, failed and unavailable-storage states are distinct; refresh never sends a mutation; absent timestamps show unknown rather than fabricated recency. Deliver small adapters and fixtures retaining user themes.

## Implemented — Care Clarity & Sync (2026.10.05.07)

Four bounded improvements: saved Detailed Care category summaries; readable responsive category disclosures; read-only spreadsheet/operations sync timestamps and actual offline queue counts in System Status; and conservative confirmed-stay reconciliation with Dog ID conflict guards. See `system-status-sync.md` and `confirmed-stay-reconciliation.md` for contracts and limitations.

Validation includes unit fixtures, browser checks across desktop/mobile/WebKit and both themes, and cache-upgrade checks. Physical iPhone/Fold verification remains a manual check. Stable booking IDs and server mutation receipts remain the next identity task; this release does not claim exactly-once mutation processing or migrate persisted Care/media keys.

## Completion report template

- Built Deliverables: final behavior, changed files, commit/PR, material limitations.
- Testing Matrix: numbered happy-path, edge-case, failure-mode steps; separate executed checks from instructions awaiting real-device verification.
- Next Backlog Item: next bounded prompt and why it follows.


Candidate 14 October 2026: [Multi-Visit Booking Plans](multi-visit-booking-plans.md), release 2026.10.14.05, supports shared-contact multi-dog and multiple-date booking, bounded weekly same-day visits, stable per-visit identity and partial retry. Existing production backend remains unchanged. A distinct day-care service type and same-name/date identity migration remain later backend work. Compact Dog record maintenance remains the next Care UI item.


## Care and booking UI refinement — 2026.10.16.01

Candidate scope: compact Dog record maintenance and photo galleries; guided multi-visit steps; explicit searchable dog identity cards; grouped per-dog review and save progress. See [implementation and test matrix](care-booking-ui-refinement.md). Next: trustworthy cached record age without additional reads.
