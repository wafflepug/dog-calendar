# Care profile state preservation — bounded implementation

User story: refreshing the guest directory or reopening a profile does not return me to the first tab or discard an unfinished field edit.

Start from the reviewed Care overview commit in its isolated worktree, after the lead confirms that commit is ready. Static HTML/CSS/browser JavaScript; retain existing Apps Script schema, booking/media keys and mutation payload contracts. Do not add eager media/history reads or a second read-coalescing mechanism: the application already coalesces reads and loads secondary tabs lazily.

Inspect `waffle-app.js`: `applyGuestDirectoryResponse`, `loadGuestDirectoryConsolidated`, `openDirectoryGuestProfile`, `restoreSelectedDirectoryProfile`, `switchDirectoryProfileMainTab`, `switchDirectoryProfileSubTab`, `activeDirectoryEditContext`, `openGuestDetailEditor`, `saveGuestDetailFromEditor`. Inspect `care.js`: `prepareCard`, `select`, `setVisualState`, and desktop tab storage. Scope this task to main/secondary tab selection, profile edit mode, and the guest-detail field modal draft. Belongings upload drafts and broader cache invalidation are separate follow-up tasks.

Lead design:

- Capture only the selected stay's UI state before card replacement: stay key, main tab, secondary tab, desktop tab and edit-mode flag. Restore by exact existing stay key. Add a preservation option for `openDirectoryGuestProfile` so restoration does not reset the tab/edit mode. Reopening an already visited connected card should prefer its own selected tab; opening a new dog defaults to Profile.
- Keep the existing modal input/textarea value in the DOM. Rebind its context to the replacement card by exact stay key and field key; do not call the editor opener again because it would overwrite the draft. Keep Back/cancel and focus usable.
- If the edited stay disappears or its identity cannot match, retain the draft visibly with a plain explanation, disable Save and require explicit cancellation. Never send the old mutation against a detached/unmatched card or guess another same-name dog. Guard immediately before the mutation as well as during restoration.
- When the directory stays unchanged, avoid gratuitous card replacement if this can be done without hiding summary/risk updates. Explicit refresh must still update available summaries and preserve honest profile-read status; do not mark cached care details fresh without a successful read.
- Preserve desktop tab state through card replacement and scheduled preparation. Restoration may load the selected unloaded panel once, but it must not load every tab. Preserve release 2026.09.17.02 stale-response guards.

Deliver a small implementation, focused actual-function fixtures, a state-policy note and a separate commit. Lead owns coordinated runtime asset revisions and final push/merge.

Acceptance:

1. Same response refresh preserves selected dog, main and secondary tab, desktop tab and edit mode. Summary/risk updates still apply.
2. Changed bookings retain an unchanged selected stay; removed stays never select a different dog. Exact legacy stay keys remain unchanged.
3. An unsaved owner/phone/notes modal draft survives replacement; a successful save sends the existing mutation contract for the correct stay once. Failed save retains the draft and Retry/cancel behavior.
4. Removed/rebound edited stays keep draft text and block Save before any mutation. Cancel closes explicitly. Duplicate same-name dogs never receive each other's drafts.
5. Rapid dog switches and late responses cannot update detached/rebound cards. No eager secondary-panel requests and no added duplicate read on unchanged reopen.
6. Verify narrow mobile and desktop flows, relevant existing Care/readiness/navigation fixtures, and relevant CI. Record executed checks separately from physical iPhone/Fold verification.

Next backlog: preserve unsaved belongings/upload work, precise cache invalidation after successful edits, and read-only request timings separating directory, profile and selected secondary-panel latency. The reported minutes are still a production timing question, not explained by configured retry limits alone.
