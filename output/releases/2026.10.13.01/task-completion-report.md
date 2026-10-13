# Task Completion Report — Care Readability and Record Identity

## Built Deliverables

- Uncached profile detail uses one booking snapshot and one Care header/body snapshot, reducing synthetic spreadsheet data reads from three to two. Directory identity checks reuse the booking snapshot already loaded. This is a call-count result, not a measured production latency claim.
- Care records support optional persisted Stay/Dog IDs, conservative read/write ownership checks and visible unresolved read failures. Enrollment is off by default through CARE_RECORD_IDENTITY_WRITES_ENABLED. No bulk migration is included. Live enrollment requires copied-sheet evidence first.
- Unique legacy Care records follow verified date/name edits, including intake updates and interrupted-write recovery. Unknown extension columns, duplicate keys, reused Stay IDs and conflicting IDs are blocked; a Dog ID may legitimately appear across different stays.
- Detailed Care summaries wrap with readable light/dark contrast, 44px disclosure targets and visible focus. Editing controls use at least 16px text; Food Amount supports multiline instructions.
- Full-runtime coverage verifies local category navigation, two open categories, feeding draft preservation through Profile/Items/Profile, and Save/Discard above the fixed footer at a short viewport. A physical-phone acceptance checklist and the next three implementation prompts are prepared.

## Testing Matrix

Automated lead review: 276/276 Node cases; 2/2 full-runtime Detailed Care browser cases; 11/11 roster browser cases. The Detailed Care fixture tests 320/390/768/1440px, light/dark, three accent sets and measured doubled text. Startup photo synchronization is intercepted and denied by the read-only fixture; category changes add neither reads nor attempted mutations. No customer writes are used in browser smoke.

| Path | Verification | Expected result |
| --- | --- | --- |
| Happy path | Open a unique guest, expand Food & Walks and Health & Home; edit a feeding draft, visit Items, return | Both disclosure states and draft survive; toggles add no backend reads |
| Readability | Use a narrow phone viewport, doubled text, light/dark and each accent | Long labels/instructions wrap; controls remain reachable; Save/Discard clear navigation |
| Legacy date edit | On the isolated test sheet, change the end date of a uniquely identified legacy stay, then reopen | Same medical/photo data follows the verified stay; no new ID columns with enrollment off |
| Returning dog | Create a second distinct stay using the same Dog ID in synthetic fixtures | The same Dog ID is valid across stays; each Stay ID remains distinct |
| Identity failure | Try duplicate keys, malformed/reused IDs, unknown extra columns or conflicting ownership | No shared Care data or mutation; explicit unresolved/error state |
| Retry failure | Simulate an interrupted date write and retry the same mutation receipt | The verified Stay ID is passed to Care carry-forward; no duplicate booking |
| Enrollment | Enable the property only on the copied test project and save a proven legacy row | Exact optional columns 35/36 and proven IDs; production remains disabled |
| Physical phone | Follow docs/care-physical-device-acceptance.md on actual iPhone/Fold | Keyboard, screen reader, rotation and unfolding checks require recorded hardware evidence |

Physical iPhone/Fold, real on-screen keyboards, system text scaling, VoiceOver/TalkBack and copied Google-sheet enrollment are **not verified**. Headless Chromium geometry does not establish those results. The release can deliver compatible read/UI changes with enrollment disabled; production ID enrollment remains staged.

## Next Backlog Item

Validate default-off and opted-in enrollment on an isolated Apps Script test deployment/copy, then review activation evidence. Follow with removing redundant Care startup photo-sync work and targeted physical-device acceptance. Detailed prompts: output/backlog/care-refinement-next-items.md.

## Release State

The candidate has passed the local lead review above. Commit, PR, CI and live deployment attribution are recorded in the final task response and GitHub checks; this report does not imply an unverified live deployment.
