# Care rendering performance — 2026.10.16.03

## Behavior

The directory booking signature includes the rendered CSV fields and stable Stay ID. Unchanged responses keep mounted profiles. Changed booking responses still rebuild the schedule data, but the directory reconciles cards using unique Stay ID + Dog ID + stay key and the original generated markup. Only matching unchanged cards can survive. Missing or duplicate identity falls back to replacement; no identity is inferred from names. Changed cards and removed visits follow the existing selected-profile recovery behavior.

Photos remain loaded on intent. Reopening the Photos tab reuses the current gallery while the shared reader checks freshness. Equal cached/fresh responses do not replace gallery nodes. Changed records render once; failed refreshes preserve the current gallery and show the existing error/retry action. A new dog or stay cannot receive the previous identity's response.

Care status and flag decoration compares values before writing. Current/Past counts use one guarded observer, including late grids, and ignore unrelated profile content changes. Scheduled late compatibility passes remain so late modules and reminder results can still decorate cards.

These changes remove avoidable client DOM work. They do not reduce Google Sheets or Apps Script server latency or promise a specific wall-clock improvement. Existing history loading is already deferred and was retained.

## Testing matrix

1. Open Staying and select a guest. Leave a draft field focused and a disclosure open. Apply an unchanged directory response: the card and details nodes, focus, text and disclosure should remain.
2. With two guests loaded, change the other guest's booking details. Only that guest's card is replaced. The selected guest remains connected and does not issue another profile read.
3. Change Stay ID, dates, owner, breed or other rendered booking fields. The affected card updates; removed bookings disappear. Reordering respects incoming source order. Date rollover recalculates date-dependent labels.
4. Test same-name guests with distinct stable IDs, duplicated identities and missing IDs. Never reuse an ambiguous card or choose a record by name.
5. Open Photos twice. Existing gallery buttons, photo nodes and expanded groups remain during the freshness check. A changed record updates once.
6. Simulate failed refresh, valid callback followed by failure, cold failure, recovery and a late response after changing dogs. Keep valid photos and one retry notice; never cross guest identities.
7. Run decoration twice on current and historical profiles. An unchanged second pass produces zero DOM mutation records. Changed flags update; historical Checked Out labels remain intact.
8. Insert/replace current and Past grids after initialization. Counts update through one observer; unrelated profile changes do not cause count scans.

Automated browser fixtures block all external mutation actions and use synthetic guests. Physical-device/assistive-technology checks remain manual.

## Next backlog item

Audit repeated summary rendering after unchanged metadata responses. Apply only changed flags/overview fragments while preserving honest freshness and error states. Measure DOM mutations and request counts rather than guessing at perceived speed.
