# Busy-day Home

Release candidate 2026.10.28.03. Six bounded improvements build on the existing compact Home and full Calendar.

1. Display known current/upcoming stay counts beside their headings. Unknown or failed schedule data does not show a misleading zero. Keep the heading name intact and give the count its own accessible label.
2. Use Today and Tomorrow within Upcoming arrivals, computed as local calendar dates across DST and year boundaries. Later arrivals retain their weekday/date.
3. Differentiate same-name guests using their already stored human-readable Dog Number, formatted as Dog ID #00001. Omit invalid/unassigned values; do not allocate IDs, expose internal UUIDs, infer matches or change stay links.
4. Align full names and date labels within portrait rows. Long names wrap without truncation, pictures remain circular, horizontal scrolling stays inside each row, and keyboard focus remains visible.
5. Support Left/Right/Home/End within current/arrival portrait rows. Retain normal Tab and Enter behavior, ignore modified keys, keep the focused guest visible and preserve it during background reconciliation. No added controls or data reads.
6. Keep photo failure guidance visible even when guest data is available. Retain initials, do not endlessly retry a known broken image URL in the same session, and clear the warning when affected guests leave the row. A page reload can retry images. No new server reads or image assets.

## Testing matrix

1. Happy path: load many current guests and future arrivals. Check counts, local near-arrival labels, exact profile links, matching names with distinct stored IDs and keyboard movement through the row.
2. Layout edges: use 320/390px phones and 1440/1920px desktop, both themes and enlarged text. Check complete long names, aligned dates, circular photos, contained scrolling and focus on first/last guests. Resize between desktop and mobile; Calendar must retain its host/month.
3. Identity edges: omit Dog Number or supply Other/zero/UUID values. No invented number appears. Remove one duplicate-name guest: unneeded number context disappears.
4. Failure modes: unknown schedule data hides count; acknowledged empty data shows zero; selector failure hides stale counts. Break one image while others succeed: initials and guidance persist. Repeat background refresh: the broken URL is not fetched repeatedly. Remove the affected guest: guidance clears.
5. Check that moving focus does not request Care records, submit operations or change the route. Enter follows the existing exact stay link.

Automated browser fixtures verify these cases without production guest reads or writes. Physical-phone validation remains a manual check; emulation does not establish measured device performance gains.

## Next backlog item

Review the existing Care arrival-to-checkout journey for repeated supporting text using representative sitter tasks. Preserve visible safety and medication, explicit operations, drafts and the current lazy reads.
