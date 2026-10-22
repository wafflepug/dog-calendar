## Current Care UI iteration — 22 October 2026

Implemented candidate 2026.10.22.02: [Compact departure handover](departure-handover-clarity.md). Separates loaded belongings into a short list, keeps medication instructions complete, consolidates unavailable-detail guidance and labels booked dates separately from checkout today. Initial keyboard focus is on the heading, with visible-only navigation. No extra profile read or backend change. Publication requires exact-head checks and live verification.

Next ready item: audit returning-dog booking setup so the existing Dog ID, dated source and explicit care reuse are clear without repeated prompts. Preserve same-name separation, stale-response guards and lazy reads.

## Previous Care UI iteration — 21 October 2026

Mobile layout clarity: reserve shared space for the existing menu and logo, keep Care Back clear of navigation, and verify long labels, enlarged text, dialogs and responsive transitions. See [Mobile layout clarity](mobile-layout-clarity.md) for acceptance steps. Publication depends on the candidate's checks and live verification.

Next ready item: audit multi-dog arrivals and repeated day-care booking for narrow-screen clarity, preserving exact identities and current read/save behaviour.

## Current Care UI iteration — 20 October 2026

Three implemented refinements awaiting release verification: an optional changed-field review, direct navigation to changed fields, and single-field Undo. See [Care Change Review](care-change-review.md) for acceptance checks and the next three scoped items. Prior Care Simple Editor refinements were merged in PR232 and published as 2026.10.19.01.
## Current Care UI iteration — 19 October 2026

Three implemented refinements awaiting release verification: compact blank optional editor fields, focus-safe independent category collapse, and enlarged-text/touch-friendly disclosures. See [Care Simple Editor](care-simple-editor.md) for scope and test steps. This continues the daily-carer persona from [Care Simple Glance](care-simple-profile.md).

Next ready item: a concise changed-field review before saving, using existing draft values and no new read.
# Next UI backlog

Completed and deployed 9 October 2026: PR204, Cleaner Care & Notification Recovery, release 2026.10.09.02.

Implemented candidate: seven improvements in [Care Document Recovery & Navigation](care-document-navigation.md), release 2026.10.09.03. Exact PR checks and live deployment must pass before treating this candidate as deployed.

## Next: Detailed Care category navigation

User story: I can collapse and reopen Food & Walks, Behaviour, Health and other detail categories without losing my place or unsaved edits.

Inspect the actual category controls, selected Care section and edit-mode behavior first. Reproduce a demonstrated problem before changing code; category collapse/reopen already exists and must not be rebuilt unnecessarily. Check keyboard focus when collapsing a panel, long summaries, empty states and a harmless matching refresh. Preserve lazy loads and drafts. Acceptance: labels and current state remain clear at 320px and desktop, keyboard focus stays visible, saved notes remain complete and no extra profile/media read occurs solely from disclosure navigation.

## Then: Care layout under enlarged text

Check the selected profile and roster at browser zoom / enlarged phone text with Settings accents. Fix demonstrated wrapping, status/action collisions or footer overlap without adding filler or hiding urgent care information.

Deferred separately: persisted-ID backend Care reads and the reviewed legacy migration map in next-care-search-consistency.md. Data correctness changes need their own migration and regression review.
