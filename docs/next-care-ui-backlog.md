# Next UI backlog

Completed and deployed 9 October 2026: PR204, Cleaner Care & Notification Recovery, release 2026.10.09.02.

Implemented candidate: seven improvements in [Care Document Recovery & Navigation](care-document-navigation.md), release 2026.10.09.03. Exact PR checks and live deployment must pass before treating this candidate as deployed.

## Next: Detailed Care category navigation

User story: I can collapse and reopen Food & Walks, Behaviour, Health and other detail categories without losing my place or unsaved edits.

Inspect the actual category controls, selected Care section and edit-mode behavior first. Reproduce a demonstrated problem before changing code; category collapse/reopen already exists and must not be rebuilt unnecessarily. Check keyboard focus when collapsing a panel, long summaries, empty states and a harmless matching refresh. Preserve lazy loads and drafts. Acceptance: labels and current state remain clear at 320px and desktop, keyboard focus stays visible, saved notes remain complete and no extra profile/media read occurs solely from disclosure navigation.

## Then: Care layout under enlarged text

Check the selected profile and roster at browser zoom / enlarged phone text with Settings accents. Fix demonstrated wrapping, status/action collisions or footer overlap without adding filler or hiding urgent care information.

Deferred separately: persisted-ID backend Care reads and the reviewed legacy migration map in next-care-search-consistency.md. Data correctness changes need their own migration and regression review.
