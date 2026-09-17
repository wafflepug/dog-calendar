# Care overview refinement — ready for Luna

Start from current origin/main in an isolated worktree. Static HTML/CSS/browser JavaScript with FullCalendar and Apps Script; preserve the existing stack. Read applicable repository instructions. Do not change backend schemas, booking/profile/media identity, mutation timeouts or saved values.

User story: After opening a dog, a sitter can quickly find care instructions, owner contact and stay dates, with readable labels and clear loading/failure states.

Lead design: retain Palz Stay mobile branding and the existing sidebar. Profile content begins with dog identity and stay dates, followed by care instructions/attributes and owner contact. Reuse existing data fields only. Use one consistent section-heading style and regular readable body labels; increase tiny labels within the profile rather than globally changing typography. Keep loading/saved/error feedback adjacent to the affected section. Use existing surface/text/accent tokens, visible focus, and selected tab styling. Use a single column at narrow widths and only split sections where content fits without truncation. Do not hide safety attributes or represent missing details as clear.

Inspect `care.js`, `directory.html`, `waffle-app.js` (`openDirectoryGuestProfile`, `switchDirectoryProfileMainTab`, `switchDirectoryProfileSubTab`, `renderDirectoryIntakeAttributes`, profile markup), and `waffle-app.css` (`.directory-profile-*`, intake attributes). Preserve the scoped profile refresh/readiness behavior introduced in release 2026.09.17.02. Secondary tabs already load lazily; do not add eager requests. Profile open currently resets main tab/edit mode; keep work-preservation changes for the following task rather than restructuring state here.

Deliver minimal markup/style changes, a short design note, screenshots using synthetic fixture data and focused browser verification. Record the field-to-section mapping. Provide coordinated asset revision updates only after lead review.

Acceptance and verification:

1. At 390px, 412px, unfolded Fold and desktop widths, headings share font/size/weight, no controls overlap, long names and notes wrap, and contact/stay values remain discoverable.
2. Verify light/dark and every configured accent: normal text has at least 4.5:1 contrast; controls and meaningful boundaries have 3:1 where applicable. Record tested token combinations rather than relying only on screenshots.
3. Missing fields show an honest unavailable/empty state without fabricating care safety. Confirm multi-dog and long owner-name fixtures.
4. Keyboard navigation reaches Back, tabs and actions with visible focus; controls have accessible names. Mobile branding stays clear of the menu.
5. Delayed/failed profile reads preserve saved attributes and scoped Retry. Switching dogs cannot mix data. Compare network request counts with current main to catch new eager requests.
6. Run relevant existing Care, navigation and cross-device checks. Include executed results and separate physical-device verification steps. Commit/push automatically; lead merges only after relevant CI passes.

Following task: preserve selected profile/tab and unsaved work during harmless refreshes, coalesce identical reads, and invalidate only affected panels after successful edits/uploads. Measure real click-to-shell and click-to-fresh-details requests before choosing backend optimization.
